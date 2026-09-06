'use strict';

const { createDb, migrate } = require('../resources/test-db');
const { createStableResourceRepository } = require('../../lib/file-mutations/stable-resource-repository');
const { createAgentResourceIdentityService } = require('../../lib/agent-provenance/resource-identity');
const { createAgentCheckpointRepository } = require('../../lib/agent-provenance/checkpoint-repository');
const { createAgentObservationJobRepository } = require('../../lib/agent-provenance/observation-job-repository');
const { createAgentRendererProjectionJobRepository } = require('../../lib/agent-provenance/renderer-projection-job-repository');
const { createAgentRendererProjectionAuthority } = require('../../lib/agent-provenance/renderer-projection-authority');
const { createAgentRendererProjectionOwner } = require('../../lib/agent-provenance/renderer-projection-scheduler');
const { insertTerminalActivity, admitActivity } = require('./helpers');

const IDS = Object.freeze({
  activity2: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  event2: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  edge2: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
});

describe('committed-job-bound renderer observation projection', () => {
  let db; let observations; let checkpoints; let jobs;
  beforeEach(async () => {
    db = await migrate(createDb());
    observations = createAgentObservationJobRepository(db);
    checkpoints = createAgentCheckpointRepository(db, {
      resourceIdentity: createAgentResourceIdentityService(db, createStableResourceRepository(db)),
    });
    jobs = createAgentRendererProjectionJobRepository(db);
  });
  afterEach(async () => { await db.destroy(); });

  async function checkpoint(overrides = {}) {
    const inserted = await insertTerminalActivity(db, overrides);
    await admitActivity(db, inserted.input.activityId);
    const claim = await observations.claimDue(overrides.now ?? 100);
    await observations.reserveAttempt(claim.claimToken, overrides.now ?? 100);
    const result = await checkpoints.applySuccessfulObservation({
      activityId: inserted.input.activityId,
      claimToken: claim.claimToken,
      sourceEdgeId: inserted.input.candidates[0].edgeId,
      canonicalPath: overrides.canonicalPath ?? 'docs/a.txt',
      state: overrides.state ?? 'absent',
      ...(overrides.state === 'bytes' ? {
        bytes: Buffer.from(overrides.content ?? 'A'),
        fingerprint: { dev: '1', ino: overrides.ino ?? '20', size: Buffer.byteLength(overrides.content ?? 'A'), birthtimeMs: 1 },
      } : {}),
      observedAt: (overrides.now ?? 100) + 1,
    });
    return { inserted, result };
  }

  test('pending checkpoint identity is withheld behind exact admitted-activity fallback', async () => {
    const fixture = await checkpoint();
    const changed = jest.fn();
    const refresh = jest.fn(async () => ({ matched: 1, delivered: 1 }));
    const authority = createAgentRendererProjectionAuthority(db, {
      publishResourceObservedV2: changed,
      publishRefreshRequired: refresh,
    });
    const owner = createAgentRendererProjectionOwner({ repository: jobs, authority });
    await owner._drain();
    expect(changed).not.toHaveBeenCalled();
    expect(refresh.mock.calls[0][0]).toEqual(expect.objectContaining({
      operationId: fixture.inserted.input.activityId,
      reason: 'fact_publish_failed',
    }));
    expect(refresh.mock.calls[0][0]).not.toHaveProperty('snapshotId');
    await expect(db('agent_renderer_projection_jobs').first()).resolves.toMatchObject({
      state: 'settled', settlement: 'refresh_required_sent',
    });
  });

  test('admitted first/changed and admitted-tool unchanged use strict v2 stable identities', async () => {
    const first = await checkpoint({ state: 'bytes', content: 'A' });
    await db('agent_resource_snapshots').where({ event_id: first.result.eventId }).update({
      fact_admission_state: 'admitted', ledger_state: 'pending', ledger_next_attempt_at: 101,
    });
    const changed = jest.fn(async () => ({ matched: 1, delivered: 1 }));
    const refresh = jest.fn();
    let authority = createAgentRendererProjectionAuthority(db, {
      publishResourceObservedV2: changed, publishRefreshRequired: refresh,
    });
    let owner = createAgentRendererProjectionOwner({ repository: jobs, authority });
    await owner._drain();
    expect(changed.mock.calls[0][0]).toEqual(expect.objectContaining({
      projectionId: first.inserted.input.candidates[0].edgeId,
      sourceEdgeId: first.inserted.input.candidates[0].edgeId,
      checkpointEventId: first.result.eventId,
      checkpointObservationId: first.result.observationId,
      snapshotId: first.result.snapshotId,
      relation: 'first_observation', state: 'bytes',
    }));

    const unchanged = await checkpoint({
      activityId: IDS.activity2, eventId: IDS.event2, edgeId: IDS.edge2,
      toolCallId: 'call-2', now: 200, terminalObservedAt: 200,
      announcedObservedAt: 200, argumentsObservedAt: 200,
      state: 'bytes', content: 'A', ino: '21',
    });
    expect(unchanged.result.relation).toBe('unchanged');
    changed.mockClear();
    authority = createAgentRendererProjectionAuthority(db, {
      publishResourceObservedV2: changed, publishRefreshRequired: refresh,
    });
    owner = createAgentRendererProjectionOwner({ repository: jobs, authority });
    await owner._drain();
    const unchangedEdge = await db('agent_tool_resource_edges').where({ edge_id: IDS.edge2 }).first();
    const originalSnapshot = await db('agent_resource_snapshots')
      .where({ snapshot_id: first.result.snapshotId }).first();
    expect(changed.mock.calls[0][0]).toEqual(expect.objectContaining({
      projectionId: IDS.edge2,
      relation: 'unchanged',
      snapshotId: first.result.snapshotId,
      resourceId: unchangedEdge.resource_id,
    }));
    expect(unchangedEdge.resource_id).not.toBe(originalSnapshot.resource_id);
    expect(changed.mock.calls[0][0]).not.toHaveProperty('checkpointEventId');
  });

  test('v2 failure attempts exactly one strict fallback and no recipient settles honestly', async () => {
    const fixture = await checkpoint();
    await db('agent_resource_snapshots').where({ event_id: fixture.result.eventId }).update({
      fact_admission_state: 'admitted', ledger_state: 'pending', ledger_next_attempt_at: 101,
    });
    const refresh = jest.fn(async () => ({ matched: 0, delivered: 0 }));
    const authority = createAgentRendererProjectionAuthority(db, {
      publishResourceObservedV2: jest.fn(async () => { throw new Error('send failed'); }),
      publishRefreshRequired: refresh,
    });
    const owner = createAgentRendererProjectionOwner({ repository: jobs, authority });
    await owner._drain();
    expect(refresh.mock.calls[0][0]).toEqual(expect.objectContaining({ reason: 'projection_failed' }));
    await expect(db('agent_renderer_projection_jobs').first()).resolves.toMatchObject({
      state: 'settled', settlement: 'no_recipient',
    });
  });

  test('delivery deadline aborts the scoped capability and never permits a late settlement', async () => {
    const claim = {
      sourceEdgeId: '33333333-3333-4333-8333-333333333333',
      claimToken: '44444444-4444-4444-8444-444444444444',
    };
    let selected = false;
    let observedSignal;
    const repository = {
      recoverExpired: jest.fn(async () => 0),
      nextWakeAt: jest.fn(async () => null),
      claimDue: jest.fn(async () => {
        if (selected) return null;
        selected = true;
        return claim;
      }),
      settle: jest.fn(async () => {}),
      failDelivery: jest.fn(async () => ({ failed: false, deliveryFailureCount: 1 })),
    };
    const authority = {
      deliverClaim: jest.fn((_claim, { signal }) => {
        observedSignal = signal;
        return new Promise(() => {});
      }),
    };
    const owner = createAgentRendererProjectionOwner({
      repository,
      authority,
      monotonicNow: () => 0,
      setTimer(callback) {
        queueMicrotask(callback);
        return { unref() {} };
      },
      clearTimer() {},
    });
    await owner._drain();
    expect(observedSignal.aborted).toBe(true);
    expect(repository.failDelivery).toHaveBeenCalledWith(claim.claimToken, expect.any(Number));
    expect(repository.settle).not.toHaveBeenCalled();
  });

  test.each([
    ['retryable', 'agent_renderer_projection_transition_failed', 1, 2],
    ['nonretryable', 'foreign_database_failure', 0, 1],
  ])('%s pending projection transition receives a finite exact-edge disposition', async (
    _kind, code, expectedTimers, expectedFailures,
  ) => {
    let now = 0;
    let failures = 0;
    const timers = [];
    const diagnostics = [];
    const sourceEdgeId = '33333333-3333-4333-8333-333333333333';
    const repository = {
      recoverExpired: jest.fn(async () => 0),
      nextWakeAt: jest.fn(async () => null),
      claimDue: jest.fn(async (_now, options = {}) => {
        if (options.excludedSourceEdgeIds?.includes(sourceEdgeId)) return null;
        failures += 1;
        const error = new Error('injected projection claim transition failure');
        error.code = code;
        error.sourceEdgeId = sourceEdgeId;
        throw error;
      }),
    };
    const owner = createAgentRendererProjectionOwner({
      repository,
      authority: { deliverClaim: jest.fn() },
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
      await owner._drain();
    }
    expect(failures).toBe(expectedFailures);
    expect(diagnostics).toEqual(['agent_renderer_projection_transition_failed']);
    await owner.shutdown({ timeoutMs: 0 });
  });

  test('startup leaves disposition 101 gated until sockets enable continuations', async () => {
    let issued = 0;
    const repository = {
      recoverExpired: jest.fn(async () => 0),
      nextWakeAt: jest.fn(async () => (issued < 101 ? 0 : null)),
      claimDue: jest.fn(async () => {
        if (issued >= 101) return null;
        issued += 1;
        return { sourceEdgeId: `edge-${issued}`, claimToken: `claim-${issued}` };
      }),
      settle: jest.fn(async () => {}),
      failDelivery: jest.fn(async () => {}),
    };
    const authority = {
      deliverClaim: jest.fn(async () => ({ settlement: 'no_recipient' })),
    };
    const owner = createAgentRendererProjectionOwner({ repository, authority });
    await expect(owner.start()).resolves.toMatchObject({ dispositions: 100, remaining: true });
    await new Promise((resolve) => setImmediate(resolve));
    expect(issued).toBe(100);
    expect(authority.deliverClaim).toHaveBeenCalledTimes(100);
    expect(owner.enableContinuations()).toBe(true);
    for (let count = 0; count < 4 && issued < 101; count += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(issued).toBe(101);
    expect(authority.deliverClaim).toHaveBeenCalledTimes(101);
    await owner.shutdown();
  });

  test('startup recovery shares the 100-disposition cap with new claims', async () => {
    let recovered = false;
    let issued = 0;
    const repository = {
      recoverExpired: jest.fn(async (_now, { limit }) => {
        if (recovered) return 0;
        recovered = true;
        return Math.min(limit, 99);
      }),
      nextWakeAt: jest.fn(async () => (issued < 2 ? 0 : null)),
      claimDue: jest.fn(async () => {
        if (issued >= 2) return null;
        issued += 1;
        return { sourceEdgeId: `edge-${issued}`, claimToken: `claim-${issued}` };
      }),
      settle: jest.fn(async () => {}),
      failDelivery: jest.fn(async () => {}),
    };
    const authority = { deliverClaim: jest.fn(async () => ({ settlement: 'no_recipient' })) };
    const owner = createAgentRendererProjectionOwner({ repository, authority });
    await expect(owner.start()).resolves.toMatchObject({ dispositions: 100, remaining: true });
    expect(issued).toBe(1);
    expect(authority.deliverClaim).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(issued).toBe(1);
    expect(owner.enableContinuations()).toBe(true);
    for (let count = 0; count < 4 && issued < 2; count += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(issued).toBe(2);
    expect(authority.deliverClaim).toHaveBeenCalledTimes(2);
    await owner.shutdown();
  });

  test('a delayed claimed projection shares the 100-disposition batch cap with fresh claims', async () => {
    let now = 0;
    let failed = false;
    let normalIssued = 0;
    const delayedClaim = { sourceEdgeId: 'edge-delayed', claimToken: 'claim-delayed' };
    const repository = {
      recoverExpired: jest.fn(async () => 0),
      nextWakeAt: jest.fn(async () => (normalIssued < 110 ? now : null)),
      claimDue: jest.fn(async (_at, options = {}) => {
        if (!failed) {
          failed = true;
          const error = new Error('busy');
          error.code = 'agent_renderer_projection_transition_failed';
          error.sourceEdgeId = delayedClaim.sourceEdgeId;
          throw error;
        }
        if (options.onlySourceEdgeId === delayedClaim.sourceEdgeId) return delayedClaim;
        if (normalIssued >= 110) return null;
        normalIssued += 1;
        return { sourceEdgeId: `edge-${normalIssued}`, claimToken: `claim-${normalIssued}` };
      }),
      settle: jest.fn(async () => {}),
      failDelivery: jest.fn(async () => {}),
    };
    const authority = { deliverClaim: jest.fn(async () => ({ settlement: 'no_recipient' })) };
    const owner = createAgentRendererProjectionOwner({
      repository, authority,
      wallClock: () => now,
      setTimer: jest.fn(() => ({ unref() {} })),
      clearTimer: jest.fn(),
    });
    await expect(owner._drain()).resolves.toMatchObject({ dispositions: 0, remaining: true });
    now = 1_000;
    await expect(owner._drain()).resolves.toMatchObject({ dispositions: 100, remaining: true });
    expect(authority.deliverClaim).toHaveBeenCalledTimes(100);
    expect(normalIssued).toBe(99);
    await owner.shutdown({ timeoutMs: 0 });
  });

  test('shutdown fences a delayed claim retry before any renderer delivery begins', async () => {
    let now = 0;
    let retryResolve;
    let first = true;
    const timers = [];
    const repository = {
      recoverExpired: jest.fn(async () => 0),
      nextWakeAt: jest.fn(async () => null),
      claimDue: jest.fn(async () => {
        if (first) {
          first = false;
          const error = new Error('busy');
          error.code = 'agent_renderer_projection_transition_failed';
          error.sourceEdgeId = 'edge-delayed';
          throw error;
        }
        return new Promise((resolve) => { retryResolve = resolve; });
      }),
    };
    const authority = { deliverClaim: jest.fn() };
    const owner = createAgentRendererProjectionOwner({
      repository,
      authority,
      wallClock: () => now,
      setTimer(callback) {
        const timer = { callback, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimer: jest.fn(),
    });
    owner.enableContinuations();
    await owner._drain();
    now = 1_000;
    timers[0].callback();
    for (let count = 0; count < 4 && !retryResolve; count += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    const shutdown = owner.shutdown();
    retryResolve({ sourceEdgeId: 'edge-delayed', claimToken: 'claim-delayed' });
    await expect(shutdown).resolves.toBe(true);
    expect(authority.deliverClaim).not.toHaveBeenCalled();
  });
});
