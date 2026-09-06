'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const knex = require('knex');
const { createAgentActivityRepository } = require('../../lib/agent-provenance/activity-repository');
const { boundedCanonicalSha256 } = require('../../lib/agent-provenance/bounded-canonical-hash');
const {
  RESERVATION_ATTEMPTS,
  RESERVATION_DEADLINE_MS,
  createAgentActivityOwner,
  getSharedAgentActivityOwner,
  createTerminalReservationGate,
  jsonSafePersistedResult,
} = require('../../lib/agent-provenance/activity-owner');
const { createZeroBusyTimeoutDb } = require('./zero-timeout-db');
const { migrate } = require('../resources/test-db');

function authority(root) {
  return Object.freeze({
    workspaceId: 'workspace-1', threadId: 'thread-1', turnId: 'turn-1',
    harnessId: 'opencode', provider: 'opencode', canonicalRoot: root,
    authorityRootSha256: 'a'.repeat(64), authorityRootDevice: null, authorityRootInode: null,
  });
}

function snapshot(overrides = {}) {
  return {
    toolCallId: 'call-1', toolName: 'write', nativeToolName: 'write', status: 'completed',
    observedAt: 100, hasInput: true, input: { filePath: 'src/a.txt' },
    executionStartedReportedAt: 10, terminalReportedAt: 20, terminalSnapshotReportedAt: 30,
    ...overrides,
  };
}

describe('bounded terminal activity owner', () => {
  let directory;
  let filename;
  let db;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-agent-owner-'));
    filename = path.join(directory, 'fixture.db');
    db = await createZeroBusyTimeoutDb(filename);
  });

  afterEach(async () => {
    await db?.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('uses the explicit zero-timeout connection and atomically reserves timing, hashes, edge, and job', async () => {
    const repository = createAgentActivityRepository(db);
    const owner = createAgentActivityOwner({ db, activityRepository: repository });
    const persistedResult = jsonSafePersistedResult({
      output: 'blocked at result', isError: true, enforcementPhase: 'tool_result', omitted: undefined,
    });
    const result = await owner.captureTerminalSnapshot(
      authority('/workspace/root'),
      snapshot({ input: { filePath: 'Settings/config.json' } }),
      persistedResult,
    );
    expect(result.replay).toBe(false);
    const row = await db('agent_tool_activities').first();
    expect(row).toMatchObject({
      status: 'completed', announced_observed_at: 100, arguments_observed_at: 100,
      terminal_observed_at: 100, execution_started_reported_at: 10,
      terminal_reported_at: 20, terminal_snapshot_reported_at: 30,
      candidate_reported_count: 1, candidate_retained_count: 1,
    });
    expect(row.arguments_sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(row.result_sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(row.result_sha256).toBe(boundedCanonicalSha256(persistedResult));
    expect(await db('agent_tool_resource_edges').count('* as count').first()).toEqual({ count: 1 });
    expect(await db('agent_observation_jobs').count('* as count').first()).toEqual({ count: 1 });
  });

  test('shares one activity owner across foreground and rebound connection adapters', async () => {
    const repository = createAgentActivityRepository(db);
    const first = getSharedAgentActivityOwner({ db, activityRepository: repository });
    const rebound = getSharedAgentActivityOwner({ db, activityRepository: repository });
    expect(rebound).toBe(first);
    await first.shutdown();
  });

  test('production-style database uses a dedicated zero-timeout reservation connection', async () => {
    const productionFilename = path.join(directory, 'production-default.db');
    const productionDb = knex({
      client: 'better-sqlite3',
      connection: { filename: productionFilename },
      useNullAsDefault: true,
      pool: {
        afterCreate(connection, done) {
          connection.pragma('foreign_keys = ON');
          done(null, connection);
        },
      },
    });
    await migrate(productionDb);
    const pooledConnection = await productionDb.client.acquireConnection();
    expect(Number(pooledConnection.pragma('busy_timeout', { simple: true }))).not.toBe(0);
    await productionDb.client.releaseConnection(pooledConnection);

    const repository = createAgentActivityRepository(productionDb);
    const owner = getSharedAgentActivityOwner({ db: productionDb, activityRepository: repository });
    await expect(owner.captureTerminalSnapshot(
      authority('/workspace/root'), snapshot(), { ok: true },
    )).resolves.toMatchObject({ replay: false });
    expect(await productionDb('agent_tool_activities').count('* as count').first()).toEqual({ count: 1 });

    let resumeBeforeTransaction;
    const beforeTransaction = new Promise(resolve => { resumeBeforeTransaction = resolve; });
    const lateReservation = owner.captureTerminalSnapshot(
      authority('/workspace/root'),
      snapshot({ toolCallId: 'late-after-shutdown' }),
      { ok: true },
      { timeoutMs: 200, beforeTransaction: () => beforeTransaction },
    );
    await new Promise(resolve => setImmediate(resolve));

    await owner.shutdown({ timeoutMs: 20 });
    await expect(lateReservation).resolves.toBeNull();
    resumeBeforeTransaction();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    expect(await productionDb('agent_tool_activities').count('* as count').first()).toEqual({ count: 1 });
    await productionDb.destroy();
  });

  test('synthetic announced arguments, pre-execution bounce, and terminal result use repository ports', async () => {
    const repository = createAgentActivityRepository(db);
    const owner = createAgentActivityOwner({ db, activityRepository: repository });
    const turnAuthority = authority('/workspace/root');
    const announced = snapshot({
      toolCallId: 'blocked-call', nativeToolName: 'write', toolName: 'write', observedAt: 10, reportedAt: 8,
    });
    await owner.announce(turnAuthority, announced);
    await owner.acceptArguments(turnAuthority, {
      ...announced,
      hasCompleteArgs: true,
      completeArgs: { filePath: 'Settings/config.json' },
      observedAt: 11,
      reportedAt: 9,
    });
    await owner.blockBeforeExecution(turnAuthority, { ...announced, observedAt: 12, reportedAt: 10 });

    const blocked = await db('agent_tool_activities').where({ tool_call_id: 'blocked-call' }).first();
    const blockedEdge = await db('agent_tool_resource_edges').where({ activity_id: blocked.activity_id }).first();
    expect(blocked).toMatchObject({ status: 'blocked', result_sha256: null, terminal_observed_at: 12 });
    expect(blockedEdge).toMatchObject({
      canonical_path: 'Settings/config.json', observation_state: 'skipped',
      observation_reason: 'blocked_before_execution', observed_at: 12,
    });
    expect(await db('agent_observation_jobs').where({ activity_id: blocked.activity_id }).first()).toBeUndefined();

    const outside = snapshot({
      toolCallId: 'outside-blocked-call', nativeToolName: 'write', toolName: 'write', observedAt: 14,
    });
    await owner.announce(turnAuthority, outside);
    await owner.acceptArguments(turnAuthority, {
      ...outside,
      hasCompleteArgs: true,
      completeArgs: { filePath: '../Settings/outside.json' },
      observedAt: 15,
    });
    await owner.blockBeforeExecution(turnAuthority, { ...outside, observedAt: 16 });
    const outsideActivity = await db('agent_tool_activities').where({ tool_call_id: 'outside-blocked-call' }).first();
    expect(await db('agent_tool_resource_edges').where({ activity_id: outsideActivity.activity_id }).first())
      .toMatchObject({ canonical_path: null, observation_state: 'skipped', observation_reason: 'outside_workspace' });

    const completed = snapshot({
      toolCallId: 'completed-call', nativeToolName: 'read', toolName: 'read', observedAt: 20,
    });
    await owner.announce(turnAuthority, completed);
    await owner.acceptArguments(turnAuthority, {
      ...completed,
      hasCompleteArgs: true,
      completeArgs: { filePath: 'README.md' },
      observedAt: 21,
    });
    await owner.complete(turnAuthority, { ...completed, observedAt: 22, isError: false }, { output: 'ok' });
    expect(await db('agent_tool_activities').where({ tool_call_id: 'completed-call' }).first())
      .toMatchObject({ status: 'completed', terminal_observed_at: 22 });

    const interrupted = snapshot({
      toolCallId: 'interrupted-call', nativeToolName: 'edit', toolName: 'edit', observedAt: 30, reportedAt: 28,
    });
    await owner.announce(turnAuthority, interrupted);
    await owner.acceptArguments(turnAuthority, {
      ...interrupted,
      hasCompleteArgs: true,
      completeArgs: { filePath: 'docs/interrupted.md' },
      observedAt: 31,
      reportedAt: 29,
    });
    await owner.interruptOpen(turnAuthority, { observedAt: 40 });
    expect(await db('agent_tool_activities').where({ tool_call_id: 'interrupted-call' }).first())
      .toMatchObject({
        status: 'interrupted', announced_observed_at: 30, announced_reported_at: 28,
        arguments_observed_at: 31, arguments_reported_at: 29,
        terminal_observed_at: 40, terminal_reported_at: null, reconciled_at: 40,
      });
  });

  test('replays exact normalized terminal truth under an advancing receipt clock', async () => {
    const diagnostics = [];
    const repository = createAgentActivityRepository(db, {
      onDiagnostic: code => diagnostics.push(code),
    });
    const owner = createAgentActivityOwner({
      db,
      activityRepository: repository,
      onDiagnostic: code => diagnostics.push(code),
    });
    await owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot(), { ok: true });
    const replay = await owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot({ observedAt: 999 }), { ok: true });
    expect(replay.replay).toBe(true);
    expect((await db('agent_tool_activities').first()).terminal_observed_at).toBe(100);

    const conflict = await owner.captureTerminalSnapshot(
      authority('/workspace/root'),
      snapshot({ observedAt: 1_000, status: 'error', input: { filePath: 'src/conflict.txt' } }),
      { ok: false },
    );
    expect(conflict).toBeNull();
    expect(diagnostics).toContain('agent_tool_activity_conflict');
    expect(await db('agent_tool_activities').first()).toMatchObject({
      status: 'completed', terminal_observed_at: 100,
    });
    expect(await db('agent_tool_resource_edges').count('* as count').first()).toEqual({ count: 1 });
  });

  test('raw-different over-cap inputs with omitted digests replay one bounded normalized record', async () => {
    const diagnostics = [];
    const repository = createAgentActivityRepository(db);
    const owner = createAgentActivityOwner({
      db,
      activityRepository: repository,
      onDiagnostic: code => diagnostics.push(code),
    });
    const chargedPrefix = 'a'.repeat(4_097);
    const suffix = 'z'.repeat(1_048_576);
    const firstInput = `${chargedPrefix}X${suffix}`;
    const rawDifferentInput = `${chargedPrefix}Y${suffix}`;

    await owner.captureTerminalSnapshot(
      authority('/workspace/root'), snapshot({ input: { filePath: firstInput } }), { ok: true },
    );
    const replay = await owner.captureTerminalSnapshot(
      authority('/workspace/root'),
      snapshot({ observedAt: 999, input: { filePath: rawDifferentInput } }),
      { ok: true },
    );

    expect(replay.replay).toBe(true);
    expect(await db('agent_tool_activities').count('* as count').first()).toEqual({ count: 1 });
    expect(await db('agent_tool_resource_edges').count('* as count').first()).toEqual({ count: 1 });
    const activity = await db('agent_tool_activities').first();
    const edge = await db('agent_tool_resource_edges').first();
    expect(activity).toMatchObject({ arguments_sha256: null, terminal_observed_at: 100 });
    expect(edge).toMatchObject({ canonical_path: null, observation_reason: 'invalid_path' });
    expect(JSON.stringify({ activity, edge })).not.toContain(chargedPrefix);
    expect(diagnostics.filter(code => code === 'agent_tool_fingerprint_omitted')).toHaveLength(2);
  });

  test('performs exactly five immediate zero-busy-wait attempts and leaves no partial row', async () => {
    const blocker = new Database(filename);
    blocker.pragma('busy_timeout = 0');
    blocker.exec('BEGIN IMMEDIATE');
    const diagnostics = [];
    let acquisitions = 0;
    const repository = createAgentActivityRepository(db);
    const owner = createAgentActivityOwner({
      db, activityRepository: repository,
      acquireConnection: async () => { acquisitions += 1; return db.client.acquireConnection(); },
      onDiagnostic: (code) => diagnostics.push(code),
    });
    await owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot(), { ok: true });
    blocker.exec('ROLLBACK');
    blocker.close();
    expect(acquisitions).toBe(RESERVATION_ATTEMPTS);
    expect(diagnostics).toContain('agent_tool_reservation_failed');
    expect(await db('agent_tool_activities').count('* as count').first()).toEqual({ count: 0 });
  });

  test('cancels a never-settling pre-transaction step and a late resume cannot write', async () => {
    const repository = createAgentActivityRepository(db);
    const owner = createAgentActivityOwner({ db, activityRepository: repository });
    let resume;
    const blocker = new Promise((resolve) => { resume = resolve; });
    const started = Date.now();
    await owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot(), { ok: true }, {
      timeoutMs: 20,
      beforeTransaction: () => blocker,
    });
    expect(Date.now() - started).toBeLessThan(500);
    resume();
    await new Promise((resolve) => setImmediate(resolve));
    expect(await db('agent_tool_activities').count('* as count').first()).toEqual({ count: 0 });
  });

  test('a lifecycle invalidated across an await cannot enter the terminal transaction', async () => {
    const repository = { reserveTerminalSync: jest.fn() };
    let resume;
    let current = true;
    const blocker = new Promise(resolve => { resume = resolve; });
    const owner = createAgentActivityOwner({ db, activityRepository: repository });
    const reservation = owner.captureTerminalSnapshot(
      authority('/workspace/root'), snapshot(), { ok: true }, {
        beforeTransaction: () => blocker,
        isCurrent: () => current,
        timeoutMs: 200,
      },
    );
    await new Promise(resolve => setImmediate(resolve));
    current = false;
    resume();
    await expect(reservation).resolves.toBeNull();
    expect(repository.reserveTerminalSync).not.toHaveBeenCalled();
  });

  test('nonretryable failure is fail-open after one attempt', async () => {
    const diagnostics = [];
    const repository = { reserveTerminalSync: jest.fn(() => { throw new Error('fatal'); }) };
    const owner = createAgentActivityOwner({ db, activityRepository: repository, onDiagnostic: code => diagnostics.push(code) });
    await expect(owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot(), { ok: true })).resolves.toBeNull();
    expect(repository.reserveTerminalSync).toHaveBeenCalledTimes(1);
    expect(diagnostics).toContain('agent_tool_reservation_failed');
  });

  test.each([
    [3, true, 4],
    [4, true, 5],
    [5, false, 5],
  ])('bounded busy attempts: %i failures => success %s with %i transactions', async (busyFailures, succeeds, expectedCalls) => {
    let calls = 0;
    const repository = {
      reserveTerminalSync: jest.fn(() => {
        calls += 1;
        if (calls <= busyFailures) {
          const error = new Error('database is locked');
          error.code = 'SQLITE_BUSY';
          throw error;
        }
        return { replay: false };
      }),
    };
    const connection = { pragma: () => 0 };
    const owner = createAgentActivityOwner({
      db, activityRepository: repository,
      acquireConnection: async () => connection,
      releaseConnection: async () => {},
    });
    const result = await owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot(), { ok: true });
    expect(Boolean(result)).toBe(succeeds);
    expect(repository.reserveTerminalSync).toHaveBeenCalledTimes(expectedCalls);
  });

  test('a nonzero busy timeout disables only terminal provenance', async () => {
    const diagnostics = [];
    const repository = { reserveTerminalSync: jest.fn() };
    const owner = createAgentActivityOwner({
      db, activityRepository: repository,
      acquireConnection: async () => ({ pragma: () => 1_000 }),
      releaseConnection: async () => {},
      onDiagnostic: code => diagnostics.push(code),
    });
    await expect(owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot(), { ok: true })).resolves.toBeNull();
    expect(repository.reserveTerminalSync).not.toHaveBeenCalled();
    expect(diagnostics).toEqual(['agent_tool_reservation_unavailable']);
  });

  test('successful reservation tracks a nonsettling release without delaying chat delivery', async () => {
    let resumeRelease;
    const releaseBlocker = new Promise(resolve => { resumeRelease = resolve; });
    const repository = { reserveTerminalSync: jest.fn(() => ({ replay: false })) };
    const owner = createAgentActivityOwner({
      db,
      activityRepository: repository,
      acquireConnection: async () => ({ pragma: () => 0 }),
      releaseConnection: jest.fn(() => releaseBlocker),
    });

    const started = Date.now();
    await expect(owner.captureTerminalSnapshot(
      authority('/workspace/root'), snapshot(), { ok: true }, { timeoutMs: 20 },
    )).resolves.toEqual({ replay: false });
    expect(Date.now() - started).toBeLessThan(500);
    expect(owner._cleanup.size).toBe(1);

    const shutdownStarted = Date.now();
    await expect(owner.shutdown({ timeoutMs: 20 })).resolves.toBe(false);
    expect(Date.now() - shutdownStarted).toBeLessThan(500);
    expect(owner._cleanup.size).toBe(1);
    resumeRelease();
    await new Promise(resolve => setImmediate(resolve));
    expect(owner._cleanup.size).toBe(0);
  });

  test('shutdown cancels an open pre-transaction gate without a late reservation', async () => {
    let resume;
    const blocker = new Promise(resolve => { resume = resolve; });
    const repository = { reserveTerminalSync: jest.fn() };
    const owner = createAgentActivityOwner({
      db, activityRepository: repository,
      acquireConnection: () => blocker,
      releaseConnection: async () => {},
    });
    const reservation = owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot(), { ok: true });
    await new Promise(resolve => setImmediate(resolve));
    await owner.shutdown({ timeoutMs: 10 });
    await expect(reservation).resolves.toBeNull();
    resume({ pragma: () => 0 });
    await new Promise(resolve => setImmediate(resolve));
    expect(repository.reserveTerminalSync).not.toHaveBeenCalled();
  });

  test('shutdown owns a late acquire through delayed connection release', async () => {
    let resumeAcquire;
    let resumeRelease;
    const acquireBlocker = new Promise(resolve => { resumeAcquire = resolve; });
    const releaseBlocker = new Promise(resolve => { resumeRelease = resolve; });
    const connection = { pragma: () => 0 };
    const repository = { reserveTerminalSync: jest.fn() };
    const releaseConnection = jest.fn(() => releaseBlocker);
    const owner = createAgentActivityOwner({
      db,
      activityRepository: repository,
      acquireConnection: () => acquireBlocker,
      releaseConnection,
    });

    await owner.captureTerminalSnapshot(authority('/workspace/root'), snapshot(), { ok: true }, { timeoutMs: 20 });
    resumeAcquire(connection);
    await new Promise(resolve => setImmediate(resolve));
    expect(releaseConnection).toHaveBeenCalledWith(connection);
    expect(owner._cleanup.size).toBe(1);

    let shutdownSettled = false;
    const shutdown = owner.shutdown({ timeoutMs: 200 }).then(() => { shutdownSettled = true; });
    await new Promise(resolve => setImmediate(resolve));
    expect(shutdownSettled).toBe(false);
    resumeRelease();
    await shutdown;
    expect(owner._cleanup.size).toBe(0);
    expect(repository.reserveTerminalSync).not.toHaveBeenCalled();
  });

  test('shutdown dynamically drains a release installed when acquire resolves during shutdown', async () => {
    let resumeAcquire;
    let resumeRelease;
    const acquireBlocker = new Promise(resolve => { resumeAcquire = resolve; });
    const releaseBlocker = new Promise(resolve => { resumeRelease = resolve; });
    const connection = { pragma: () => 0 };
    const repository = { reserveTerminalSync: jest.fn() };
    const releaseConnection = jest.fn(() => releaseBlocker);
    const owner = createAgentActivityOwner({
      db,
      activityRepository: repository,
      acquireConnection: () => acquireBlocker,
      releaseConnection,
    });

    const reservation = owner.captureTerminalSnapshot(
      authority('/workspace/root'), snapshot(), { ok: true }, { timeoutMs: 200 },
    );
    await new Promise(resolve => setImmediate(resolve));
    let shutdownSettled = false;
    const shutdown = owner.shutdown({ timeoutMs: 200 }).then(() => { shutdownSettled = true; });
    resumeAcquire(connection);
    await new Promise(resolve => setImmediate(resolve));

    expect(await reservation).toBeNull();
    expect(releaseConnection).toHaveBeenCalledWith(connection);
    expect(shutdownSettled).toBe(false);
    resumeRelease();
    await shutdown;
    expect(owner._cleanup.size).toBe(0);
    expect(repository.reserveTerminalSync).not.toHaveBeenCalled();
  });

  test('multiple open activities share one absolute interruption deadline', async () => {
    let resume;
    const blocker = new Promise(resolve => { resume = resolve; });
    const repository = {
      reserveAnnounced: jest.fn(async () => ({ replay: false })),
      reserveTerminalSync: jest.fn(),
    };
    let acquisitions = 0;
    const owner = createAgentActivityOwner({
      db,
      activityRepository: repository,
      acquireConnection: () => {
        acquisitions += 1;
        return blocker;
      },
      releaseConnection: async () => {},
    });
    const turnAuthority = authority('/workspace/root');
    await owner.announce(turnAuthority, snapshot({ toolCallId: 'call-1' }));
    await owner.announce(turnAuthority, snapshot({ toolCallId: 'call-2' }));

    const started = Date.now();
    const results = await owner.interruptOpen(turnAuthority, { observedAt: 200, timeoutMs: 20 });
    expect(Date.now() - started).toBeLessThan(500);
    expect(results).toEqual([null, null]);
    expect(acquisitions).toBeLessThanOrEqual(2);
    expect(repository.reserveTerminalSync).not.toHaveBeenCalled();

    const acquisitionsAfterFinalization = acquisitions;
    await owner.interruptOpen(turnAuthority, { observedAt: 300, timeoutMs: 20 });
    expect(acquisitions).toBe(acquisitionsAfterFinalization);
    resume({ pragma: () => 0 });
    await new Promise(resolve => setImmediate(resolve));
    expect(repository.reserveTerminalSync).not.toHaveBeenCalled();
  });

  test('shutdown durably interrupts every active announced tool before database close', async () => {
    const repository = createAgentActivityRepository(db);
    const owner = createAgentActivityOwner({ db, activityRepository: repository });
    const turnAuthority = authority('/workspace/root');
    const event = snapshot({ toolCallId: 'shutdown-active', observedAt: 100, reportedAt: 90 });
    await owner.announce(turnAuthority, event);
    await owner.acceptArguments(turnAuthority, {
      ...event,
      hasCompleteArgs: true,
      completeArgs: { filePath: 'docs/shutdown-active.md' },
      observedAt: 110,
      reportedAt: 95,
    });

    await owner.shutdown({ timeoutMs: 2_000 });

    const activity = await db('agent_tool_activities').where({ tool_call_id: 'shutdown-active' }).first();
    expect(activity).toMatchObject({
      status: 'interrupted',
      fact_admission_state: 'pending',
      ledger_state: 'not_ready',
      announced_observed_at: 100,
      arguments_observed_at: 110,
      terminal_reported_at: null,
    });
    expect(activity.terminal_observed_at).toBeGreaterThanOrEqual(110);
    await expect(db('agent_tool_resource_edges').where({ activity_id: activity.activity_id }))
      .resolves.toEqual([expect.objectContaining({
        canonical_path: 'docs/shutdown-active.md',
        observation_state: 'pending',
      })]);
    await expect(db('agent_observation_jobs').where({ activity_id: activity.activity_id }))
      .resolves.toEqual([expect.objectContaining({ state: 'pending' })]);
    expect(JSON.parse(activity.fact_json)).toMatchObject({
      eventType: 'agent.tool_completed',
      operationId: activity.activity_id,
      tool: { status: 'interrupted' },
      resources: [{ path: 'docs/shutdown-active.md' }],
    });
  });

  test('constants retain the approved absolute deadline and attempt budget', () => {
    expect(RESERVATION_ATTEMPTS).toBe(5);
    expect(RESERVATION_DEADLINE_MS).toBe(2_000);
  });

  test('absolute reservation gate accepts deadline-minus and cancels at equal/plus', () => {
    for (const [boundary, accepted] of [[1_999, true], [2_000, false], [2_001, false]]) {
      let now = 0;
      const gate = createTerminalReservationGate({ now: () => now, timeoutMs: 2_000 });
      now = boundary;
      expect(gate.beginCommit()).toBe(accepted);
      if (accepted) gate.settle();
      else expect(gate.state).toBe('cancelled');
    }
  });
});
