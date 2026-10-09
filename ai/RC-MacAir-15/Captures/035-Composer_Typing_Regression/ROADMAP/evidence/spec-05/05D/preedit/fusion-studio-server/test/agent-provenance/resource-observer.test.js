'use strict';

const fs = require('fs/promises');
const { createDb, migrate } = require('../resources/test-db');
const { createStableResourceRepository } = require('../../lib/file-mutations/stable-resource-repository');
const { createPathCoordinator } = require('../../lib/file-mutations/save-mutex');
const { createAgentResourceIdentityService } = require('../../lib/agent-provenance/resource-identity');
const { createAgentCheckpointRepository } = require('../../lib/agent-provenance/checkpoint-repository');
const { createAgentObservationJobRepository } = require('../../lib/agent-provenance/observation-job-repository');
const { createAgentResourceObserver } = require('../../lib/agent-provenance/resource-observer');
const { insertTerminalActivity, admitActivity, digest } = require('./helpers');

describe('durable agent resource observation owner', () => {
  let db;
  beforeEach(async () => { db = await migrate(createDb()); });
  afterEach(async () => { await db.destroy(); });

  async function setup(result, overrides = {}) {
    const inserted = await insertTerminalActivity(db, {
      authorityRootSha256: digest('/fixture/root'), authorityRootDevice: '1', authorityRootInode: '2',
      ...overrides,
    });
    await admitActivity(db, inserted.input.activityId);
    const repository = createAgentObservationJobRepository(db);
    const stable = createStableResourceRepository(db);
    const admissionSignals = [];
    const projectionSignals = [];
    const nativeObserver = {
      deadlineAfterMilliseconds: jest.fn(() => 1n),
      createCancellationHandle() { return { view: new Int32Array(new SharedArrayBuffer(4)), cancel() {} }; },
      observeSecureFile: jest.fn(async () => result),
    };
    const owner = createAgentResourceObserver({
      repository,
      checkpointRepository: createAgentCheckpointRepository(db, {
        resourceIdentity: createAgentResourceIdentityService(db, stable),
      }),
      pathCoordinator: createPathCoordinator(), nativeObserver,
      resolveWorkspaceRoot: async () => '/fixture/root',
      onObservationReserved: (id) => admissionSignals.push(id),
      onProjectionReserved: (id) => projectionSignals.push(id),
    });
    return { inserted, owner, repository, nativeObserver, admissionSignals, projectionSignals };
  }

  test('requires only exact observer ports and no ambient database capability', () => {
    expect(() => createAgentResourceObserver({
      repository: { claimDue() {} },
      checkpointRepository: { applySuccessfulObservation() {} },
      pathCoordinator: { tryAcquireObservation() {} },
      nativeObserver: {
        observeSecureFile() {}, createCancellationHandle() {}, deadlineAfterMilliseconds() {},
      },
      resolveWorkspaceRoot() {},
    })).not.toThrow();
  });

  test.each([
    [{ status: 'skipped', reason: 'final_symlink' }, 'skipped', 'final_symlink'],
    [{ status: 'skipped', reason: 'not_regular_file' }, 'skipped', 'not_regular_file'],
    [{ status: 'failed', reason: 'secure_open_unavailable' }, 'failed', 'secure_open_unavailable'],
    [{ status: 'failed', reason: 'unreadable' }, 'failed', 'unreadable'],
  ])('closes stable non-checkpoint outcome %#', async (result, state, reason) => {
    const fixture = await setup(result);
    await fixture.owner._drain();
    await expect(db('agent_tool_resource_edges').first()).resolves.toMatchObject({
      observation_state: state, observation_reason: reason, observation_attempt_count: 1,
    });
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(0);
  });

  test('creates first, unchanged, changed, and absent checkpoints plus projection jobs', async () => {
    const firstBytes = Buffer.from('A');
    const first = await setup({
      status: 'bytes', bytes: firstBytes,
      fingerprint: { dev: '1', ino: '11', size: 1, birthtimeMs: 1 },
    });
    await first.owner._drain();
    expect(firstBytes).toEqual(Buffer.alloc(1));
    expect(first.admissionSignals).toHaveLength(1);
    expect(first.projectionSignals).toEqual([first.inserted.input.candidates[0].edgeId]);
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(1);
    await expect(db('agent_renderer_projection_jobs')).resolves.toHaveLength(1);

    const unchanged = await setup({
      status: 'bytes', bytes: Buffer.from('A'),
      fingerprint: { dev: '1', ino: '11', size: 1, birthtimeMs: 1 },
    }, {
      activityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      edgeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', toolCallId: 'call-2', now: 200,
      terminalObservedAt: 200, announcedObservedAt: 200, argumentsObservedAt: 200,
    });
    await unchanged.owner._drain();
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(1);
    await expect(db('agent_tool_resource_edges').where({ edge_id: unchanged.inserted.input.candidates[0].edgeId }).first())
      .resolves.toMatchObject({ observation_state: 'unchanged' });
  });

  test('a failed post-I/O outcome zeroes stale bytes before releasing scheduler ownership', async () => {
    const inserted = await insertTerminalActivity(db, {
      authorityRootSha256: digest('/fixture/root'),
      authorityRootDevice: '1',
      authorityRootInode: '2',
    });
    await admitActivity(db, inserted.input.activityId);
    const bytes = Buffer.from('sensitive');
    const owner = createAgentResourceObserver({
      repository: createAgentObservationJobRepository(db),
      checkpointRepository: {
        applySuccessfulObservation: jest.fn(async () => {
          throw Object.assign(new Error('injected outcome failure'), { code: 'OUTCOME_FAILED' });
        }),
      },
      pathCoordinator: createPathCoordinator(),
      nativeObserver: {
        available: true,
        deadlineAfterMilliseconds: jest.fn(() => 1n),
        createCancellationHandle() {
          return { view: new Int32Array(new SharedArrayBuffer(4)), cancel() {} };
        },
        observeSecureFile: jest.fn(async () => ({
          status: 'bytes',
          bytes,
          fingerprint: { dev: '1', ino: '11', size: bytes.length, birthtimeMs: 1 },
        })),
      },
      resolveWorkspaceRoot: async () => '/fixture/root',
    });
    await owner._drain();
    expect(bytes).toEqual(Buffer.alloc(bytes.length));
    await expect(db('agent_tool_resource_edges').first()).resolves.toMatchObject({
      observation_state: 'pending', observation_attempt_count: 1,
    });
    await expect(owner.shutdown()).resolves.toBe(true);
  });

  test('does no I/O before admitted ownership and a save-priority miss consumes no attempt', async () => {
    const fixture = await setup({ status: 'absent' });
    await db('agent_tool_activities').update({
      fact_admission_state: 'pending', ledger_state: 'not_ready', ledger_next_attempt_at: null,
    });
    await fixture.owner._drain();
    expect(fixture.nativeObserver.observeSecureFile).not.toHaveBeenCalled();
    await admitActivity(db, fixture.inserted.input.activityId);
    const key = `workspace-1\u0000docs/a.txt`;
    const coordinator = createPathCoordinator();
    const observationLease = coordinator.tryAcquireObservation(key);
    const repository = createAgentObservationJobRepository(db);
    const owner = createAgentResourceObserver({
      repository,
      checkpointRepository: { applySuccessfulObservation: jest.fn() }, pathCoordinator: coordinator,
      nativeObserver: fixture.nativeObserver, resolveWorkspaceRoot: async () => '/fixture/root',
    });
    await owner._drain();
    observationLease.release();
    await expect(db('agent_tool_resource_edges').first()).resolves.toMatchObject({
      observation_attempt_count: 0,
    });
  });

  test('an unavailable addon fails closed before any workspace pathname lookup', async () => {
    const inserted = await insertTerminalActivity(db);
    await admitActivity(db, inserted.input.activityId);
    const resolveWorkspaceRoot = jest.fn(async () => '/must-not-be-read');
    const owner = createAgentResourceObserver({
      repository: createAgentObservationJobRepository(db),
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: createPathCoordinator(),
      nativeObserver: {
        available: false,
        deadlineAfterMilliseconds: jest.fn(() => 1n),
        createCancellationHandle: jest.fn(),
        observeSecureFile: jest.fn(),
      },
      resolveWorkspaceRoot,
    });
    await owner._drain();
    expect(resolveWorkspaceRoot).not.toHaveBeenCalled();
    await expect(db('agent_tool_resource_edges').first()).resolves.toMatchObject({
      observation_state: 'failed',
      observation_reason: 'secure_open_unavailable',
      observation_attempt_count: 1,
    });
  });

  test.each([
    ['missing registry row', null, digest('/missing-authority')],
    ['missing root path', '/definitely/missing/fusion-agent-observer-root', digest('/definitely/missing/fusion-agent-observer-root')],
    ['replaced root authority', process.cwd(), digest('/captured/root/that/was/replaced')],
  ])('%s closes as workspace_unavailable after one reserved attempt and reads no bytes', async (
    _label, repoPath, authorityRootSha256,
  ) => {
    await db.schema.createTable('workspaces', (table) => {
      table.text('id').primary();
      table.text('repo_path');
    });
    if (repoPath) await db('workspaces').insert({ id: 'workspace-1', repo_path: repoPath });
    const inserted = await insertTerminalActivity(db, {
      authorityRootSha256,
      authorityRootDevice: '1',
      authorityRootInode: '2',
    });
    await admitActivity(db, inserted.input.activityId);
    const nativeObserver = {
      available: true,
      deadlineAfterMilliseconds: jest.fn(() => 1n),
      createCancellationHandle: jest.fn(() => ({ cancel() {} })),
      observeSecureFile: jest.fn(),
    };
    const owner = createAgentResourceObserver({
      repository: createAgentObservationJobRepository(db),
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: createPathCoordinator(),
      nativeObserver,
      resolveWorkspaceRoot: async (workspaceId) => {
        const workspace = await db('workspaces')
          .where({ id: workspaceId }).select('repo_path').first();
        if (typeof workspace?.repo_path !== 'string') return null;
        try { return await fs.realpath(workspace.repo_path); } catch (_error) { return null; }
      },
    });
    await owner._drain();
    expect(nativeObserver.observeSecureFile).not.toHaveBeenCalled();
    await expect(db('agent_tool_resource_edges').first()).resolves.toMatchObject({
      observation_state: 'failed',
      observation_reason: 'workspace_unavailable',
      observation_attempt_count: 1,
      next_observation_at: null,
    });
    await expect(db('agent_observation_jobs').first()).resolves.toMatchObject({
      state: 'complete', claim_token: null, next_attempt_at: null,
    });
  });

  test('startup counts recovered claims inside the 16-disposition cap and defers remainder until enabled', async () => {
    let recovered = 0;
    let issued = 0;
    const repository = {
      recoverExpired: jest.fn(async (_now, { limit }) => {
        const count = Math.min(limit, 15 - recovered);
        recovered += count;
        return count;
      }),
      nextWakeAt: jest.fn(async () => (issued < 2 ? 0 : null)),
      claimDue: jest.fn(async () => {
        if (issued >= 2) return null;
        issued += 1;
        return {
          activityId: `activity-${issued}`,
          workspaceId: 'workspace-1',
          claimToken: `claim-${issued}`,
          claimedEdgeId: `edge-${issued}`,
          canonicalPath: `docs/${issued}.txt`,
        };
      }),
      releaseWithoutAttempt: jest.fn(async () => {}),
    };
    const owner = createAgentResourceObserver({
      repository,
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: { tryAcquireObservation: jest.fn(() => null) },
      nativeObserver: {
        available: true,
        deadlineAfterMilliseconds: jest.fn(() => 1n),
        createCancellationHandle: jest.fn(),
        observeSecureFile: jest.fn(),
      },
      resolveWorkspaceRoot: jest.fn(),
    });
    owner.deferContinuations();
    await expect(owner.start()).resolves.toMatchObject({ dispositions: 16, remaining: true });
    expect(recovered).toBe(15);
    expect(issued).toBe(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(issued).toBe(1);
    expect(owner.enableContinuations()).toBe(true);
    for (let count = 0; count < 4 && issued < 2; count += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(issued).toBe(2);
    await owner.shutdown();
  });

  test.each([
    ['retryable', 'agent_observation_transition_failed', 1, 2],
    ['nonretryable', 'foreign_database_failure', 0, 1],
  ])('%s pending-claim transition failure has one finite exact-key disposition', async (
    _kind, code, expectedTimers, expectedFailures,
  ) => {
    let now = 0;
    let failures = 0;
    const timers = [];
    const diagnostics = [];
    const activityId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const repository = {
      recoverExpired: jest.fn(async () => 0),
      nextWakeAt: jest.fn(async () => null),
      claimDue: jest.fn(async (_now, options = {}) => {
        if (options.excludedActivityIds?.includes(activityId)) return null;
        failures += 1;
        const error = new Error('injected claim transition failure');
        error.code = code;
        error.activityId = activityId;
        throw error;
      }),
    };
    const owner = createAgentResourceObserver({
      repository,
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: createPathCoordinator(),
      nativeObserver: {
        deadlineAfterMilliseconds: jest.fn(() => 1n),
        createCancellationHandle: jest.fn(),
        observeSecureFile: jest.fn(),
      },
      resolveWorkspaceRoot: jest.fn(),
      wallClock: () => now,
      setTimer(callback, delay) {
        const timer = { delay, unref() {}, run() { callback(); } };
        timers.push(timer);
        return timer;
      },
      clearTimer: jest.fn(),
      writeDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    await owner._drain();
    expect(timers).toHaveLength(expectedTimers);
    if (timers.length) {
      expect(timers[0].delay).toBe(1_000);
      now = 1_000;
      timers[0].run();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(failures).toBe(expectedFailures);
    expect(owner._delayed.size).toBe(0);
    expect(owner._suppressed).toContain(`activity:${activityId}`);
    expect(diagnostics).toEqual(['agent_observation_transition_failed']);
    await owner.shutdown({ timeoutMs: 0 });
  });

  test('a delayed claimed path shares the 16-disposition batch cap with fresh claims', async () => {
    let now = 0;
    let failed = false;
    let normalIssued = 0;
    let processed = 0;
    const delayedClaim = {
      activityId: 'activity-delayed', workspaceId: 'workspace-1', claimToken: 'claim-delayed',
      claimedEdgeId: 'edge-delayed', canonicalPath: 'docs/delayed.txt',
    };
    const repository = {
      recoverExpired: jest.fn(async () => 0),
      nextWakeAt: jest.fn(async () => (normalIssued < 20 ? now : null)),
      claimDue: jest.fn(async (_at, options = {}) => {
        if (!failed) {
          failed = true;
          const error = new Error('busy');
          error.code = 'agent_observation_transition_failed';
          error.activityId = delayedClaim.activityId;
          throw error;
        }
        if (options.onlyActivityId === delayedClaim.activityId) return delayedClaim;
        if (normalIssued >= 20) return null;
        normalIssued += 1;
        return {
          activityId: `activity-${normalIssued}`, workspaceId: 'workspace-1',
          claimToken: `claim-${normalIssued}`, claimedEdgeId: `edge-${normalIssued}`,
          canonicalPath: `docs/${normalIssued}.txt`,
        };
      }),
      releaseWithoutAttempt: jest.fn(async () => { processed += 1; }),
    };
    const owner = createAgentResourceObserver({
      repository,
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: { tryAcquireObservation: jest.fn(() => null) },
      nativeObserver: {
        available: true, observeSecureFile: jest.fn(), createCancellationHandle: jest.fn(),
        deadlineAfterMilliseconds: jest.fn(),
      },
      resolveWorkspaceRoot: jest.fn(),
      wallClock: () => now,
      setTimer: jest.fn(() => ({ unref() {} })),
      clearTimer: jest.fn(),
    });
    owner.deferContinuations();
    await expect(owner._drain()).resolves.toMatchObject({ dispositions: 0, remaining: true });
    now = 1_000;
    await expect(owner._drain()).resolves.toMatchObject({ dispositions: 16, remaining: true });
    expect(processed).toBe(16);
    expect(normalIssued).toBe(15);
    await owner.shutdown({ timeoutMs: 0 });
  });

  test('shutdown fences late workspace-root resolution from new durable work', async () => {
    let resolveRoot;
    let issued = false;
    const writes = [];
    const claim = {
      activityId: 'activity-late-root', workspaceId: 'workspace-1',
      claimToken: 'claim-late-root', claimedEdgeId: 'edge-late-root',
      canonicalPath: 'docs/a.txt',
    };
    const owner = createAgentResourceObserver({
      repository: {
        recoverExpired: jest.fn(async () => 0),
        nextWakeAt: jest.fn(async () => null),
        claimDue: jest.fn(async () => {
          if (issued) return null;
          issued = true;
          return claim;
        }),
        loadClaimContext: jest.fn(async () => ({
          activity: {
            workspace_id: 'workspace-1', authority_root_sha256: digest('/fixture/root'),
            authority_root_device: '1', authority_root_inode: '2',
          },
          dominantEdge: { canonical_path: 'docs/a.txt' },
        })),
        reserveAttempt: jest.fn(async () => { writes.push('reserve'); return 1; }),
        closeGroup: jest.fn(async () => { writes.push('close'); }),
        settleNoResult: jest.fn(async () => { writes.push('settle'); }),
        releaseWithoutAttempt: jest.fn(async () => { writes.push('release'); }),
      },
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: createPathCoordinator(),
      nativeObserver: {
        available: true, observeSecureFile: jest.fn(), createCancellationHandle: jest.fn(),
        deadlineAfterMilliseconds: jest.fn(),
      },
      resolveWorkspaceRoot: jest.fn(() => new Promise((resolve) => { resolveRoot = resolve; })),
    });
    const pending = owner._drain();
    while (!resolveRoot) await new Promise((resolve) => setImmediate(resolve));
    await expect(owner.shutdown({ timeoutMs: 0 })).resolves.toBe(false);
    resolveRoot('/fixture/root');
    await expect(pending).resolves.toMatchObject({ dispositions: 1, remaining: false });
    expect(writes).toEqual([]);
  });

  test('startup-retained slots preserve the four-global cap and shutdown owns every read', async () => {
    let now = 0;
    let issued = 0;
    let inFlight = 0;
    let maximum = 0;
    const completions = [];
    const claims = Array.from({ length: 8 }, (_, index) => ({
      activityId: `activity-${index}`,
      workspaceId: 'workspace-1',
      claimToken: `claim-${index}`,
      claimedEdgeId: `edge-${index}`,
      canonicalPath: `docs/${index}.txt`,
    }));
    const repository = {
      recoverExpired: jest.fn(async () => 0),
      nextWakeAt: jest.fn(async () => (issued < claims.length ? 0 : null)),
      claimDue: jest.fn(async (_at, { excludedActivityIds = [] } = {}) => {
        const claim = claims.find((item, index) => index >= issued
          && !excludedActivityIds.includes(item.activityId));
        if (!claim) return null;
        issued += 1;
        return claim;
      }),
      loadClaimContext: jest.fn(async (token) => ({
        activity: {
          workspace_id: 'workspace-1',
          authority_root_sha256: digest('/fixture/root'),
          authority_root_device: '1',
          authority_root_inode: '2',
        },
        dominantEdge: { canonical_path: claims.find((claim) => claim.claimToken === token).canonicalPath },
      })),
      reserveAttempt: jest.fn(async () => 1),
      closeGroup: jest.fn(async () => {}),
      settleNoResult: jest.fn(async () => {}),
      releaseWithoutAttempt: jest.fn(async () => {}),
    };
    const nativeObserver = {
      available: true,
      deadlineAfterMilliseconds: jest.fn(() => 1n),
      createCancellationHandle() {
        const handle = {
          completion: null,
          cancelled: false,
          cancel() {
            if (handle.cancelled) return;
            handle.cancelled = true;
            handle.completion?.({ status: 'failed', reason: 'observation_timeout' });
          },
        };
        return handle;
      },
      observeSecureFile: jest.fn(({ cancellation }) => {
        inFlight += 1;
        maximum = Math.max(maximum, inFlight);
        return new Promise((resolve) => {
          let completeOnce = false;
          const complete = (result) => {
            if (completeOnce) return;
            completeOnce = true;
            inFlight -= 1;
            resolve(result);
          };
          cancellation.completion = complete;
          completions.push({ complete });
        });
      }),
    };
    const owner = createAgentResourceObserver({
      repository,
      checkpointRepository: { applySuccessfulObservation: jest.fn(async () => ({ sourceEdgeId: 'edge' })) },
      pathCoordinator: createPathCoordinator(),
      nativeObserver,
      resolveWorkspaceRoot: async () => '/fixture/root',
      monotonicNow: () => now,
    });
    const startup = owner.start();
    for (let count = 0; count < 4 && completions.length < 4; count += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(inFlight).toBe(4);
    now = 2_000;
    completions[0].complete({ status: 'absent' });
    await expect(startup).resolves.toMatchObject({ dispositions: 4, remaining: true });
    await new Promise((resolve) => setImmediate(resolve));
    expect(maximum).toBe(4);
    const shutdown = owner.shutdown();
    await expect(shutdown).resolves.toBe(true);
    expect(inFlight).toBe(0);
    expect(owner._activeTasks.size).toBe(0);
  });

  test('the exact deadline releases the path while retaining native cleanup ownership', async () => {
    let now = 0;
    let releaseNative;
    let cancelled = false;
    const timers = [];
    const coordinator = createPathCoordinator();
    const repository = {
      loadClaimContext: jest.fn(async () => ({
        activity: {
          workspace_id: 'workspace-1',
          authority_root_sha256: digest('/fixture/root'),
          authority_root_device: '1',
          authority_root_inode: '2',
        },
        dominantEdge: { canonical_path: 'docs/a.txt' },
      })),
      reserveAttempt: jest.fn(async () => 1),
      closeGroup: jest.fn(async () => {}),
      settleNoResult: jest.fn(async () => {}),
      releaseWithoutAttempt: jest.fn(async () => {}),
      claimDue: jest.fn(),
    };
    const owner = createAgentResourceObserver({
      repository,
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: coordinator,
      nativeObserver: {
        available: true,
        deadlineAfterMilliseconds: jest.fn(() => 1n),
        createCancellationHandle() {
          return { cancel() { cancelled = true; } };
        },
        observeSecureFile: jest.fn(() => new Promise((resolve) => { releaseNative = resolve; })),
      },
      resolveWorkspaceRoot: async () => '/fixture/root',
      monotonicNow: () => now,
      setTimer(callback, delay) {
        const timer = { callback, delay, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimer: jest.fn(),
    });
    const pending = owner._processClaim({
      activityId: '123e4567-e89b-42d3-a456-426614174001',
      workspaceId: 'workspace-1',
      claimToken: '123e4567-e89b-42d3-a456-426614174002',
      claimedEdgeId: '123e4567-e89b-42d3-a456-426614174003',
      canonicalPath: 'docs/a.txt',
    });
    for (let count = 0; count < 4 && !releaseNative; count += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(releaseNative).toEqual(expect.any(Function));
    expect(timers[0].delay).toBe(2_000);
    now = 2_000;
    timers[0].callback();
    expect(cancelled).toBe(true);
    const saveLease = coordinator.tryAcquireObservation('workspace-1\0docs/a.txt');
    expect(saveLease).not.toBeNull();
    saveLease.release();
    let settled = false;
    pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    releaseNative({ status: 'failed', reason: 'observation_timeout' });
    await expect(pending).resolves.toBe(true);
  });

  test('the absolute deadline releases a queued save while reservation remains scheduler-owned', async () => {
    let now = 0;
    let resolveReservation;
    const timers = [];
    const coordinator = createPathCoordinator();
    const repository = {
      loadClaimContext: jest.fn(async () => ({
        activity: {
          workspace_id: 'workspace-1',
          authority_root_sha256: digest('/fixture/root'),
          authority_root_device: '1',
          authority_root_inode: '2',
        },
        dominantEdge: { canonical_path: 'docs/a.txt' },
      })),
      reserveAttempt: jest.fn(() => new Promise((resolve) => { resolveReservation = resolve; })),
      closeGroup: jest.fn(async () => {}),
      settleNoResult: jest.fn(async () => {}),
      releaseWithoutAttempt: jest.fn(async () => {}),
      claimDue: jest.fn(),
    };
    const nativeObserver = {
      available: true,
      deadlineAfterMilliseconds: jest.fn(() => 1n),
      createCancellationHandle: jest.fn(),
      observeSecureFile: jest.fn(),
    };
    const owner = createAgentResourceObserver({
      repository,
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: coordinator, nativeObserver,
      resolveWorkspaceRoot: async () => '/fixture/root',
      monotonicNow: () => now,
      setTimer(callback, delay) {
        const timer = { callback, delay, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimer: jest.fn(),
    });
    const pending = owner._processClaim({
      activityId: '123e4567-e89b-42d3-a456-426614174011',
      workspaceId: 'workspace-1',
      claimToken: '123e4567-e89b-42d3-a456-426614174012',
      claimedEdgeId: '123e4567-e89b-42d3-a456-426614174013',
      canonicalPath: 'docs/a.txt',
    });
    while (!resolveReservation) await new Promise((resolve) => setImmediate(resolve));
    let saveStarted = false;
    const save = coordinator.runExclusive('workspace-1\0docs/a.txt', async () => { saveStarted = true; });
    await Promise.resolve();
    expect(saveStarted).toBe(false);
    expect(timers[0].delay).toBe(2_000);
    now = 2_000;
    timers[0].callback();
    await save;
    expect(saveStarted).toBe(true);
    let settled = false;
    pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveReservation(1);
    await expect(pending).resolves.toBe(false);
    expect(nativeObserver.observeSecureFile).not.toHaveBeenCalled();
  });

  test('the absolute deadline zeroes outcome bytes and fences late projection callbacks', async () => {
    let now = 0;
    let resolveOutcome;
    const timers = [];
    const bytes = Buffer.from('checkpoint-sensitive');
    const coordinator = createPathCoordinator();
    const repository = {
      loadClaimContext: jest.fn(async () => ({
        activity: {
          workspace_id: 'workspace-1',
          authority_root_sha256: digest('/fixture/root'),
          authority_root_device: '1',
          authority_root_inode: '2',
        },
        dominantEdge: { canonical_path: 'docs/a.txt' },
      })),
      reserveAttempt: jest.fn(async () => 1),
      closeGroup: jest.fn(async () => {}),
      settleNoResult: jest.fn(async () => {}),
      releaseWithoutAttempt: jest.fn(async () => {}),
      claimDue: jest.fn(),
    };
    const checkpointRepository = {
      applySuccessfulObservation: jest.fn(() => new Promise((resolve) => { resolveOutcome = resolve; })),
    };
    const onObservationReserved = jest.fn();
    const onProjectionReserved = jest.fn();
    const owner = createAgentResourceObserver({
      repository, checkpointRepository,
      pathCoordinator: coordinator,
      nativeObserver: {
        available: true,
        deadlineAfterMilliseconds: jest.fn(() => 1n),
        createCancellationHandle() { return { cancel() {} }; },
        observeSecureFile: jest.fn(async () => ({
          status: 'bytes', bytes,
          fingerprint: { dev: '1', ino: '11', size: bytes.length, birthtimeMs: 1 },
        })),
      },
      resolveWorkspaceRoot: async () => '/fixture/root',
      monotonicNow: () => now,
      setTimer(callback, delay) {
        const timer = { callback, delay, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimer: jest.fn(),
      onObservationReserved,
      onProjectionReserved,
    });
    const pending = owner._processClaim({
      activityId: '123e4567-e89b-42d3-a456-426614174021',
      workspaceId: 'workspace-1',
      claimToken: '123e4567-e89b-42d3-a456-426614174022',
      claimedEdgeId: '123e4567-e89b-42d3-a456-426614174023',
      canonicalPath: 'docs/a.txt',
    });
    while (!resolveOutcome) await new Promise((resolve) => setImmediate(resolve));
    let saveStarted = false;
    const save = coordinator.runExclusive('workspace-1\0docs/a.txt', async () => { saveStarted = true; });
    await Promise.resolve();
    expect(saveStarted).toBe(false);
    now = 2_000;
    timers[0].callback();
    await save;
    expect(bytes).toEqual(Buffer.alloc(bytes.length));
    let settled = false;
    pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveOutcome({
      eventId: '123e4567-e89b-42d3-a456-426614174024',
      sourceEdgeId: '123e4567-e89b-42d3-a456-426614174023',
    });
    await expect(pending).resolves.toBe(false);
    expect(onObservationReserved).not.toHaveBeenCalled();
    expect(onProjectionReserved).not.toHaveBeenCalled();
  });

  test('bytes returned exactly at the deadline are zeroed before timeout settlement', async () => {
    let now = 0;
    const bytes = Buffer.from('deadline-sensitive');
    const fixture = await setup({
      status: 'bytes', bytes,
      fingerprint: { dev: '1', ino: '11', size: bytes.length, birthtimeMs: 1 },
    });
    fixture.owner = createAgentResourceObserver({
      repository: fixture.repository,
      checkpointRepository: { applySuccessfulObservation: jest.fn() },
      pathCoordinator: createPathCoordinator(),
      nativeObserver: fixture.nativeObserver,
      resolveWorkspaceRoot: async () => '/fixture/root',
      monotonicNow: () => now,
    });
    fixture.nativeObserver.observeSecureFile.mockImplementation(async () => {
      now = 2_000;
      return { status: 'bytes', bytes, fingerprint: { dev: '1', ino: '11', size: bytes.length, birthtimeMs: 1 } };
    });
    await fixture.owner._drain();
    expect(bytes).toEqual(Buffer.alloc(bytes.length));
    expect(fixture.owner.isAccepting()).toBe(true);
    await fixture.owner.shutdown();
  });
});
