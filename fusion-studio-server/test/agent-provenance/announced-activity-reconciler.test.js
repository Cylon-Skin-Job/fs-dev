'use strict';

const { createDb, migrate } = require('../resources/test-db');
const { createAgentActivityRepository } = require('../../lib/agent-provenance/activity-repository');
const {
  BATCH_LIMIT,
  RETRY_DELAY_MS,
  STARTUP_BUDGET_MS,
  createAnnouncedActivityReconciler,
} = require('../../lib/agent-provenance/announced-activity-reconciler');

function identity(index, overrides = {}) {
  const suffix = (index + 1).toString(16).padStart(12, '0');
  return {
    activityId: `10000000-0000-4000-8000-${suffix}`,
    eventId: `20000000-0000-4000-8000-${suffix}`,
    workspaceId: 'workspace-1',
    threadId: 'thread-1',
    turnId: `turn-${index}`,
    harnessId: 'opencode',
    provider: 'opencode',
    toolCallId: `call-${index}`,
    toolName: 'write',
    nativeToolName: 'write',
    authorityRootSha256: `${(index % 16).toString(16)}`.repeat(64),
    authorityRootDevice: '1',
    authorityRootInode: '2',
    announcedObservedAt: 100 + index,
    announcedReportedAt: 90 + index,
    now: 100 + index,
    ...overrides,
  };
}

function immediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('announced activity startup reconciliation', () => {
  let db;

  beforeEach(async () => {
    db = await migrate(createDb());
  });

  afterEach(async () => {
    await db.destroy();
  });

  test('uses immutable stored authority and phase times to reserve an interrupted fact', async () => {
    const repository = createAgentActivityRepository(db);
    const announced = identity(0);
    await repository.reserveAnnounced(announced);
    await repository.reserveArguments({
      ...announced,
      argumentsSha256: 'b'.repeat(64),
      argumentsObservedAt: 110,
      argumentsReportedAt: 95,
      now: 110,
    });
    const inputs = [];
    const reconciler = createAnnouncedActivityReconciler({
      db,
      activityRepository: {
        reserveTerminal: async (input) => {
          inputs.push(input);
          return repository.reserveTerminal(input);
        },
      },
      now: () => 150,
    });

    await reconciler.start();
    await reconciler.shutdown();

    expect(inputs).toEqual([expect.objectContaining({
      activityId: announced.activityId,
      eventId: announced.eventId,
      workspaceId: announced.workspaceId,
      threadId: announced.threadId,
      turnId: announced.turnId,
      harnessId: announced.harnessId,
      provider: announced.provider,
      authorityRootSha256: announced.authorityRootSha256,
      authorityRootDevice: announced.authorityRootDevice,
      authorityRootInode: announced.authorityRootInode,
      status: 'interrupted',
      announcedObservedAt: 100,
      announcedReportedAt: 90,
      argumentsObservedAt: 110,
      argumentsReportedAt: 95,
      argumentsSha256: 'b'.repeat(64),
      terminalObservedAt: 150,
      reconciledAt: 150,
      candidates: [],
    })]);
    const row = await db('agent_tool_activities').where({ activity_id: announced.activityId }).first();
    expect(row).toMatchObject({
      status: 'interrupted', fact_admission_state: 'pending', ledger_state: 'not_ready',
      terminal_observed_at: 150, terminal_reported_at: null, reconciled_at: 150,
      authority_root_sha256: announced.authorityRootSha256,
    });
    expect(JSON.parse(row.fact_json)).toMatchObject({
      eventId: announced.eventId,
      operationId: announced.activityId,
      origin: { harnessId: 'opencode', provider: 'opencode' },
      tool: { status: 'interrupted', argumentsSha256: 'b'.repeat(64) },
      resources: [],
    });
  });

  test('processes deterministic oldest-first batches of 100 and yields the continuation', async () => {
    const repository = createAgentActivityRepository(db);
    for (let index = 0; index < 101; index += 1) {
      await repository.reserveAnnounced(identity(index));
    }
    const order = [];
    let releaseLast;
    const lastGate = new Promise((resolve) => { releaseLast = resolve; });
    const onTerminalReserved = jest.fn();
    const reconciler = createAnnouncedActivityReconciler({
      db,
      activityRepository: {
        reserveTerminal: async (input) => {
          order.push(input.activityId);
          if (order.length === 101) await lastGate;
          return repository.reserveTerminal(input);
        },
      },
      now: () => 1_000,
      monotonicNow: () => 0,
      onTerminalReserved,
    });

    const startup = await reconciler.start({ deferContinuations: true });
    expect(startup).toEqual({ dispositions: 100, remaining: true });
    expect(order).toHaveLength(100);
    expect(order[0]).toBe(identity(0).activityId);
    expect(order[99]).toBe(identity(99).activityId);
    expect(onTerminalReserved).toHaveBeenCalledTimes(100);
    await immediate();
    expect(order).toHaveLength(100);
    reconciler.enableContinuations();
    await immediate();
    expect(order).toHaveLength(101);
    releaseLast();
    await immediate();
    await reconciler.shutdown();
    expect(order[100]).toBe(identity(100).activityId);
    expect(onTerminalReserved).toHaveBeenCalledTimes(101);
    expect(await db('agent_tool_activities').where({ status: 'announced' }).count('* as count').first())
      .toEqual({ count: 0 });
  });

  test('uses one exact delayed retry for retryable contention and suppresses nonretryable failure immediately', async () => {
    const repository = createAgentActivityRepository(db);
    await repository.reserveAnnounced(identity(0));
    let timerCallback;
    let attempts = 0;
    const retrying = createAnnouncedActivityReconciler({
      db,
      activityRepository: {
        reserveTerminal: async (input) => {
          attempts += 1;
          if (attempts <= 5) {
            const error = new Error('busy');
            error.code = 'SQLITE_BUSY';
            throw error;
          }
          return repository.reserveTerminal(input);
        },
      },
      now: () => 1_000,
      setTimer: (callback, delay) => {
        expect(delay).toBe(RETRY_DELAY_MS);
        timerCallback = callback;
        return { unref() {} };
      },
      clearTimer: () => {},
    });
    await retrying.start();
    expect(attempts).toBe(5);
    expect(typeof timerCallback).toBe('function');
    timerCallback();
    await immediate();
    await immediate();
    expect(attempts).toBe(6);
    expect(await db('agent_tool_activities').where({ activity_id: identity(0).activityId }).first())
      .toMatchObject({ status: 'interrupted' });
    await retrying.shutdown();

    await repository.reserveAnnounced(identity(1));
    const diagnostics = [];
    const fatal = createAnnouncedActivityReconciler({
      db,
      activityRepository: {
        reserveTerminal: jest.fn(async () => {
          const error = new Error('io');
          error.code = 'SQLITE_IOERR';
          throw error;
        }),
      },
      writeDiagnostic: (code) => diagnostics.push(code),
    });
    await fatal.start();
    expect(fatal._suppressed).toContain(identity(1).activityId);
    expect(diagnostics).toEqual(['agent_tool_reservation_failed']);
    await fatal.shutdown();
  });

  test('shutdown waits for selected work and starts no later repository operation', async () => {
    const repository = createAgentActivityRepository(db);
    await repository.reserveAnnounced(identity(0));
    await repository.reserveAnnounced(identity(1));
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const reserveTerminal = jest.fn(async (input) => {
      await gate;
      return repository.reserveTerminal(input);
    });
    const reconciler = createAnnouncedActivityReconciler({
      db, activityRepository: { reserveTerminal }, now: () => 1_000,
    });
    const startup = reconciler.start();
    await immediate();
    const shutdown = reconciler.shutdown();
    await immediate();
    expect(reserveTerminal).toHaveBeenCalledTimes(1);
    release();
    const [, drained] = await Promise.all([startup, shutdown]);
    expect(drained).toBe(true);
    expect(reserveTerminal).toHaveBeenCalledTimes(1);
    expect(await db('agent_tool_activities').where({ status: 'announced' }).count('* as count').first())
      .toEqual({ count: 1 });
  });

  test('reports a local shutdown timeout while selected work remains unsettled', async () => {
    await createAgentActivityRepository(db).reserveAnnounced(identity(0));
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const reconciler = createAnnouncedActivityReconciler({
      db,
      activityRepository: { reserveTerminal: jest.fn(() => gate) },
      setTimer: (callback) => {
        callback();
        return { unref() {} };
      },
      clearTimer: () => {},
    });
    const startup = reconciler.start();
    await immediate();

    await expect(reconciler.shutdown()).resolves.toBe(false);
    release(null);
    await startup;
  });

  test('exports the approved startup bounds', () => {
    expect(BATCH_LIMIT).toBe(100);
    expect(STARTUP_BUDGET_MS).toBe(1_000);
    expect(RETRY_DELAY_MS).toBe(1_000);
  });
});
