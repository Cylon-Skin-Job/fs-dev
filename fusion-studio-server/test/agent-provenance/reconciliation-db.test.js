'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { createDb, migrate } = require('../resources/test-db');
const { createAgentReconciliationDb } = require('../../lib/agent-provenance/reconciliation-db');
const { createAgentFactAuthorityRepository } = require('../../lib/agent-provenance/fact-authority-repository');
const { createAgentFactAdmissionReconciler } = require('../../lib/agent-provenance/fact-admission-reconciler');
const { createAgentLedgerRepository } = require('../../lib/agent-provenance/agent-ledger-repository');
const { createAgentLedgerReconciler } = require('../../lib/agent-provenance/agent-ledger-reconciler');
const { createAnnouncedActivityReconciler } = require('../../lib/agent-provenance/announced-activity-reconciler');
const { insertTerminalActivity } = require('./helpers');

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await immediate();
  }
  throw new Error('condition did not settle');
}

describe('dedicated agent reconciliation database', () => {
  let directory;
  let filename;
  let primaryDb;
  let reconciliationDb;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-agent-reconciliation-'));
    filename = path.join(directory, 'fixture.db');
    primaryDb = await migrate(createDb(filename));
    reconciliationDb = await createAgentReconciliationDb(primaryDb);
  });

  afterEach(async () => {
    await reconciliationDb?.destroy();
    await primaryDb?.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('requires file-backed primary storage', async () => {
    const memoryDb = await migrate(createDb());
    await expect(createAgentReconciliationDb(memoryDb)).rejects.toThrow(/File-backed/);
    await memoryDb.destroy();
  });

  test('enforces foreign keys and zero busy timeout on its single shared connection', async () => {
    const connection = await reconciliationDb.client.acquireConnection();
    expect(Number(connection.pragma('foreign_keys', { simple: true }))).toBe(1);
    expect(Number(connection.pragma('busy_timeout', { simple: true }))).toBe(0);
    await reconciliationDb.client.releaseConnection(connection);
    expect(reconciliationDb.client.pool.numUsed()).toBe(0);
    expect(reconciliationDb.client.pool.numFree()).toBe(1);
  });

  test.each([
    ['minus', 5, true],
    ['equal', null, false],
    ['plus', 6, false],
  ])('real exclusive-lock attempt boundary %s uses at most five immediate SQL attempts', async (_boundary, releaseAtAttempt, succeeds) => {
    const terminal = await insertTerminalActivity(primaryDb, {
      activityId: '70000000-0000-4000-8000-000000000001',
      eventId: '70000000-0000-4000-8000-000000000002',
      edgeId: '70000000-0000-4000-8000-000000000003',
    });
    const blocker = new Database(filename);
    blocker.pragma('busy_timeout = 0');
    blocker.exec('BEGIN EXCLUSIVE');
    let attempts = 0;
    let locked = true;
    const repository = createAgentFactAuthorityRepository(reconciliationDb, {
      canAttempt: () => {
        attempts += 1;
        if (attempts === releaseAtAttempt) {
          blocker.exec('ROLLBACK');
          blocker.close();
          locked = false;
        }
        return true;
      },
    });
    const started = Date.now();
    const result = repository.markConflict('tool', terminal.input.eventId);
    if (succeeds) await expect(result).resolves.toBe(true);
    else await expect(result).rejects.toMatchObject({ code: 'agent_fact_admission_transition_failed' });
    expect(Date.now() - started).toBeLessThan(500);
    expect(attempts).toBe(5);
    if (locked) {
      blocker.exec('ROLLBACK');
      blocker.close();
    }
  });

  test('startup selectors resolve under a real exclusive lock, retry once at +1s, then suppress', async () => {
    const blocker = new Database(filename);
    blocker.pragma('busy_timeout = 0');
    blocker.exec('BEGIN EXCLUSIVE');
    const owners = [];
    try {
      const cases = [
        {
          key: 'selector:pending-agent-facts',
          diagnostic: 'agent_fact_admission_failed',
          create({ timers, diagnostics }) {
            const owner = createAgentFactAdmissionReconciler({
              authority: createAgentFactAuthorityRepository(reconciliationDb),
              writeDiagnostic: (code) => diagnostics.push(code),
              setTimer: (callback, delay) => {
                timers.push({ callback, delay });
                return { unref() {} };
              },
              clearTimer: () => {},
            });
            owner.installPublishers({
              publishAgentToolCompleted: async () => ({ admitted: true }),
              publishResourceStateObserved: async () => ({ admitted: true }),
            });
            return owner;
          },
        },
        {
          key: 'selector:agent-ledger-candidates',
          diagnostic: 'agent_ledger_transition_failed',
          create({ timers, diagnostics, clock }) {
            return createAgentLedgerReconciler({
              repository: createAgentLedgerRepository(reconciliationDb),
              now: () => clock.value,
              writeDiagnostic: (code) => diagnostics.push(code),
              setTimer: (callback, delay) => {
                timers.push({ callback, delay });
                return { unref() {} };
              },
              clearTimer: () => {},
            });
          },
        },
        {
          key: 'selector:announced-activities',
          diagnostic: 'agent_tool_reservation_failed',
          create({ timers, diagnostics }) {
            return createAnnouncedActivityReconciler({
              db: reconciliationDb,
              activityRepository: { reserveTerminal: jest.fn() },
              writeDiagnostic: (code) => diagnostics.push(code),
              setTimer: (callback, delay) => {
                timers.push({ callback, delay });
                return { unref() {} };
              },
              clearTimer: () => {},
            });
          },
        },
      ];

      for (const item of cases) {
        const timers = [];
        const diagnostics = [];
        const clock = { value: 0 };
        const owner = item.create({ timers, diagnostics, clock });
        owners.push(owner);
        await expect(owner.start()).resolves.toEqual({ dispositions: 0, remaining: false });
        expect(timers).toHaveLength(1);
        expect(timers[0].delay).toBe(1_000);
        expect(owner._suppressed).not.toContain(item.key);

        clock.value = 1_000;
        timers.shift().callback();
        await waitFor(() => owner._suppressed.has(item.key));
        expect(diagnostics).toEqual([item.diagnostic]);
      }
    } finally {
      await Promise.allSettled(owners.map((owner) => owner.shutdown({ timeoutMs: 0 })));
      blocker.exec('ROLLBACK');
      blocker.close();
    }
  });
});
