'use strict';

const { createDb, migrate } = require('../resources/test-db');
const { createStableResourceRepository } = require('../../lib/file-mutations/stable-resource-repository');
const { createFileOperationRepository } = require('../../lib/file-mutations/file-operation-repository');
const { createAgentResourceIdentityService } = require('../../lib/agent-provenance/resource-identity');
const { AgentSnapshotConflictError, createAgentCheckpointRepository, verifyUtf8Bytes } = require('../../lib/agent-provenance/checkpoint-repository');
const {
  createAgentObservationJobRepository,
  createAgentObservationScheduler,
  AgentObservationClaimError,
} = require('../../lib/agent-provenance/observation-job-repository');
const {
  createAgentRendererProjectionJobRepository,
  createAgentRendererProjectionScheduler,
  AgentRendererProjectionClaimError,
} = require('../../lib/agent-provenance/renderer-projection-job-repository');
const { insertTerminalActivity, admitActivity } = require('./helpers');
const { acceptedCandidateSha256 } = require('../../lib/agent-provenance/candidate-fingerprints');

const UUIDS = Array.from({ length: 80 }, (_, index) => `${String(index + 10).padStart(8, '0')}-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);

function generatedUuid(index) {
  const value = index.toString(16).padStart(8, '0');
  return `${value}-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, '0')}`;
}

describe('agent observation/checkpoint/projection durable primitives', () => {
  let db; let observations; let checkpoints; let projections; let stable; let uuidIndex;
  beforeEach(async () => {
    db = await migrate(createDb()); uuidIndex = 0;
    const randomUuid = () => UUIDS[uuidIndex++];
    stable = createStableResourceRepository(db, { randomUuid });
    checkpoints = createAgentCheckpointRepository(db, { resourceIdentity: createAgentResourceIdentityService(db, stable), randomUuid });
    observations = createAgentObservationJobRepository(db, { randomUuid });
    projections = createAgentRendererProjectionJobRepository(db, { randomUuid });
  });
  afterEach(async () => { await db.destroy(); });

  async function activity(index, overrides = {}) {
    const activityId = UUIDS[20 + index]; const edgeId = UUIDS[25 + index];
    await insertTerminalActivity(db, {
      activityId, eventId: UUIDS[30 + index], edgeId, toolCallId: `call-${index}`,
      now: 100 + index, terminalObservedAt: 100 + index,
      announcedObservedAt: 100 + index, argumentsObservedAt: 100 + index,
      ...overrides,
    });
    await admitActivity(db, activityId);
    return { activityId, edgeId };
  }
  async function claimAndReserve(now) {
    const claim = await observations.claimDue(now); expect(claim).not.toBeNull();
    await observations.reserveAttempt(claim.claimToken, now); return claim;
  }

  test('claims admitted owners only, guards tokens, and recovers exact attempt state at lease expiry', async () => {
    const pending = await insertTerminalActivity(db);
    await expect(observations.claimDue(100)).resolves.toBeNull();
    await expect(observations.nextWakeAt()).resolves.toBeNull();
    await admitActivity(db, pending.input.activityId);
    const claim = await observations.claimDue(100, { leaseMs: 30 });
    expect(claim).toMatchObject({ activityId: pending.input.activityId, claimedAttempt: 0, leaseExpiresAt: 130 });
    await expect(observations.reserveAttempt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 101)).rejects.toBeInstanceOf(AgentObservationClaimError);
    await expect(observations.recoverExpired(129)).resolves.toBe(0);
    await expect(observations.recoverExpired(130)).resolves.toBe(1);
    await expect(db('agent_observation_jobs').first()).resolves.toMatchObject({ state: 'pending', next_attempt_at: 230 });
    const second = await observations.claimDue(230, { leaseMs: 10 });
    await observations.reserveAttempt(second.claimToken, 230);
    await expect(observations.reserveAttempt(second.claimToken, 231)).rejects.toMatchObject({
      code: 'observation_attempt_already_reserved',
    });
    await expect(db('agent_observation_jobs').first()).resolves.toMatchObject({ claimed_attempt: 1 });
    await expect(db('agent_tool_resource_edges').first()).resolves.toMatchObject({ observation_attempt_count: 1 });
    await expect(observations.recoverExpired(240)).resolves.toBe(1);
    await expect(db('agent_tool_resource_edges').first()).resolves.toMatchObject({ observation_attempt_count: 1, next_observation_at: 490 });
  });

  test('a claim token cannot settle another pending path group in the same activity', async () => {
    const secondEdgeId = UUIDS[50];
    const first = await insertTerminalActivity(db, { candidates: [
      {
        edgeId: UUIDS[49], candidateSha256: require('../../lib/agent-provenance/candidate-fingerprints').acceptedCandidateSha256('a.txt'),
        canonicalPath: 'a.txt', accessFamily: 'write', accessKind: 'write', extractionBasis: 'structured_path',
      },
      {
        edgeId: secondEdgeId, candidateSha256: require('../../lib/agent-provenance/candidate-fingerprints').acceptedCandidateSha256('b.txt'),
        canonicalPath: 'b.txt', accessFamily: 'write', accessKind: 'write', extractionBasis: 'structured_path',
      },
    ], reportedCount: 2 });
    await admitActivity(db, first.input.activityId);
    const claim = await observations.claimDue(200); await observations.reserveAttempt(claim.claimToken, 200);
    await expect(checkpoints.applySuccessfulObservation({
      activityId: first.input.activityId, claimToken: claim.claimToken, sourceEdgeId: secondEdgeId,
      canonicalPath: 'b.txt', state: 'absent', observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3], fact: { state: 'absent' },
    })).rejects.toMatchObject({ code: 'dominant_edge_mismatch' });
    await expect(db('agent_tool_resource_edges').where({ edge_id: secondEdgeId }).first()).resolves.toMatchObject({ observation_state: 'pending', snapshot_id: null });
  });

  test('permits pending attempt three only under its exact running claim and closes it on recovery', async () => {
    const current = await activity(0);
    const first = await observations.claimDue(100, { leaseMs: 10 });
    await observations.reserveAttempt(first.claimToken, 100);
    await observations.settleNoResult(first.claimToken, 101);
    const second = await observations.claimDue(351, { leaseMs: 10 });
    await observations.reserveAttempt(second.claimToken, 351);
    await observations.settleNoResult(second.claimToken, 352);
    const third = await observations.claimDue(1_352, { leaseMs: 10 });
    await expect(observations.reserveAttempt(third.claimToken, 1_352)).resolves.toBe(3);
    await expect(db('agent_observation_jobs').first()).resolves.toMatchObject({ state: 'running', claimed_attempt: 3 });
    await expect(db('agent_tool_resource_edges').where({ edge_id: current.edgeId }).first())
      .resolves.toMatchObject({ observation_state: 'pending', observation_attempt_count: 3 });
    await expect(observations.recoverExpired(1_362)).resolves.toBe(1);
    await expect(db('agent_tool_resource_edges').where({ edge_id: current.edgeId }).first())
      .resolves.toMatchObject({ observation_state: 'failed', observation_reason: 'observation_incomplete' });
  });

  test('token-owned settlement and checkpoint paths fail closed on edge/job attempt drift', async () => {
    const current = await activity(0); const claim = await claimAndReserve(200);
    await db('agent_tool_resource_edges').where({ edge_id: current.edgeId }).update({ observation_attempt_count: 0 });
    await expect(observations.settleNoResult(claim.claimToken, 201)).rejects.toMatchObject({
      code: 'observation_attempt_drift',
    });
    await expect(checkpoints.applySuccessfulObservation({
      activityId: current.activityId, claimToken: claim.claimToken, sourceEdgeId: current.edgeId,
      canonicalPath: 'docs/a.txt', state: 'absent', observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3],
    })).rejects.toMatchObject({ code: 'observation_attempt_drift' });
    await expect(db('agent_observation_jobs').first()).resolves.toMatchObject({
      state: 'running', claim_token: claim.claimToken, claimed_attempt: 1,
    });
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(0);
  });

  test('attempt-zero release and settlement reject nonuniform sibling history without clearing the claim', async () => {
    const candidates = ['read', 'write'].map((family, index) => ({
      edgeId: UUIDS[45 + index],
      canonicalPath: 'same.txt',
      candidateSha256: acceptedCandidateSha256('same.txt'),
      accessFamily: family,
      accessKind: family,
      extractionBasis: 'structured_path',
    }));
    const inserted = await insertTerminalActivity(db, { candidates, reportedCount: 2 });
    await admitActivity(db, inserted.input.activityId);
    const claim = await observations.claimDue(200);
    await db('agent_tool_resource_edges').where({ edge_id: candidates[1].edgeId }).update({ observation_attempt_count: 1 });
    await expect(observations.releaseWithoutAttempt(claim.claimToken, 201)).rejects.toMatchObject({
      code: 'observation_attempt_drift',
    });
    await expect(observations.settleNoResult(claim.claimToken, 201)).rejects.toMatchObject({
      code: 'observation_attempt_drift',
    });
    await expect(db('agent_observation_jobs').first()).resolves.toMatchObject({
      state: 'running', claim_token: claim.claimToken, claimed_attempt: 0,
    });
    await expect(db('agent_tool_resource_edges').orderBy('candidate_ordinal', 'asc'))
      .resolves.toEqual(expect.arrayContaining([
        expect.objectContaining({ observation_attempt_count: 0, next_observation_at: 100 }),
        expect.objectContaining({ observation_attempt_count: 1, next_observation_at: 100 }),
      ]));
  });

  test('selects the ready path with the lowest dominant-edge ordinal', async () => {
    const candidates = [
      { edgeId: UUIDS[45], canonicalPath: 'a.txt', accessFamily: 'read', accessKind: 'read' },
      { edgeId: UUIDS[46], canonicalPath: 'b.txt', accessFamily: 'read', accessKind: 'read' },
      { edgeId: UUIDS[47], canonicalPath: 'a.txt', accessFamily: 'write', accessKind: 'write' },
    ].map((candidate) => ({
      ...candidate,
      candidateSha256: acceptedCandidateSha256(candidate.canonicalPath),
      extractionBasis: 'structured_path',
    }));
    const inserted = await insertTerminalActivity(db, { candidates, reportedCount: 3 });
    await admitActivity(db, inserted.input.activityId);
    await expect(observations.claimDue(200)).resolves.toMatchObject({
      canonicalPath: 'b.txt', claimedEdgeId: UUIDS[46],
    });
  });

  test('creates sparse deduplicated checkpoints and atomic projection jobs for all successful relations', async () => {
    const first = await activity(0); const c1 = await claimAndReserve(200);
    const r1 = await checkpoints.applySuccessfulObservation({
      activityId: first.activityId, claimToken: c1.claimToken, sourceEdgeId: first.edgeId,
      canonicalPath: 'docs/a.txt', state: 'bytes', bytes: Buffer.from('A'),
      fingerprint: { dev: '1', ino: '2', size: 1, birthtimeMs: 3 }, observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3],
      fact: { content: 'TOP-SECRET-SNAPSHOT-CONTENT', oversized: 'x'.repeat(1_048_577) },
    });
    expect(r1.relation).toBe('first_observation');
    const safeFact = await db('agent_resource_snapshots').where({ snapshot_id: UUIDS[1] }).first();
    expect(safeFact.fact_json).toContain('resource.state_observed');
    expect(safeFact.fact_json).not.toContain('TOP-SECRET-SNAPSHOT-CONTENT');
    expect(safeFact.fact_json).not.toContain('oversized');
    const unchanged = await activity(1); const c2 = await claimAndReserve(210);
    const r2 = await checkpoints.applySuccessfulObservation({
      activityId: unchanged.activityId, claimToken: c2.claimToken, sourceEdgeId: unchanged.edgeId,
      canonicalPath: 'docs/a.txt', state: 'bytes', bytes: Buffer.from('A'),
      fingerprint: { dev: '1', ino: '2', size: 1, birthtimeMs: 3 }, observedAt: 211,
    });
    expect(r2).toMatchObject({ relation: 'unchanged', snapshotId: UUIDS[1] });
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(1);
    await expect(db('agent_snapshot_blobs')).resolves.toHaveLength(1);
    const changed = await activity(2); const c3 = await claimAndReserve(220);
    await expect(checkpoints.applySuccessfulObservation({
      activityId: changed.activityId, claimToken: c3.claimToken, sourceEdgeId: changed.edgeId,
      canonicalPath: 'docs/a.txt', state: 'bytes', bytes: Buffer.from('BB'),
      fingerprint: { dev: '1', ino: '2', size: 2, birthtimeMs: 3 }, observedAt: 221,
      snapshotId: UUIDS[4], observationId: UUIDS[5], eventId: UUIDS[6], fact: { state: 'BB' },
    })).resolves.toMatchObject({ relation: 'changed' });
    const absent = await activity(3); const c4 = await claimAndReserve(230);
    await expect(checkpoints.applySuccessfulObservation({
      activityId: absent.activityId, claimToken: c4.claimToken, sourceEdgeId: absent.edgeId,
      canonicalPath: 'docs/a.txt', state: 'absent', observedAt: 231,
      snapshotId: UUIDS[7], observationId: UUIDS[8], eventId: UUIDS[9], fact: { state: 'absent' },
    })).resolves.toMatchObject({ relation: 'changed', resourceId: null });
    await expect(db('agent_renderer_projection_jobs')).resolves.toHaveLength(4);
    await expect(db('resource_registry').whereNot({ lifecycle_state: 'tombstoned' })).resolves.toHaveLength(0);
  });

  test('copies checkpoint bytes before async work and rejects a contradictory physical size without mutation', async () => {
    const first = await activity(0); const firstClaim = await claimAndReserve(200);
    const mutable = Buffer.from('A');
    const pending = checkpoints.applySuccessfulObservation({
      activityId: first.activityId, claimToken: firstClaim.claimToken, sourceEdgeId: first.edgeId,
      canonicalPath: 'docs/a.txt', state: 'bytes', bytes: mutable,
      fingerprint: { dev: '1', ino: '2', size: 1, birthtimeMs: 3 }, observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3],
    });
    mutable[0] = 'B'.charCodeAt(0);
    await expect(pending).resolves.toMatchObject({ relation: 'first_observation' });
    const blob = await db('agent_snapshot_blobs').first();
    expect(Buffer.from(blob.bytes).toString('utf8')).toBe('A');
    expect(blob.sha256).toBe(require('crypto').createHash('sha256').update('A').digest('hex'));

    const second = await activity(1, { canonicalPath: 'docs/b.txt' });
    const secondClaim = await claimAndReserve(210);
    await expect(checkpoints.applySuccessfulObservation({
      activityId: second.activityId, claimToken: secondClaim.claimToken, sourceEdgeId: second.edgeId,
      canonicalPath: 'docs/b.txt', state: 'bytes', bytes: Buffer.from('A'),
      fingerprint: { dev: '3', ino: '4', size: 999, birthtimeMs: 5 }, observedAt: 211,
      snapshotId: UUIDS[4], observationId: UUIDS[5], eventId: UUIDS[6],
    })).rejects.toThrow(/size must match/u);
    await expect(db('agent_resource_snapshots').where({ canonical_path: 'docs/b.txt' })).resolves.toHaveLength(0);
    await expect(db('resource_registry').where({ canonical_path: 'docs/b.txt' })).resolves.toHaveLength(0);
    await expect(db('agent_tool_resource_edges').where({ edge_id: second.edgeId }).first())
      .resolves.toMatchObject({ observation_state: 'pending', snapshot_id: null });
  });

  test('preserves a UTF-8 BOM byte-for-byte in the content-addressed checkpoint blob', async () => {
    const first = await activity(0); const claim = await claimAndReserve(200);
    const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x41]);
    await expect(checkpoints.applySuccessfulObservation({
      activityId: first.activityId, claimToken: claim.claimToken, sourceEdgeId: first.edgeId,
      canonicalPath: 'docs/a.txt', state: 'bytes', bytes,
      fingerprint: { dev: '1', ino: '2', size: bytes.length, birthtimeMs: 3 }, observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3],
    })).resolves.toMatchObject({ relation: 'first_observation' });
    const blob = await db('agent_snapshot_blobs').first();
    expect(Buffer.from(blob.bytes)).toEqual(bytes);
    expect(blob.byte_length).toBe(bytes.length);
    expect(blob.sha256).toBe(require('crypto').createHash('sha256').update(bytes).digest('hex'));
  });

  test('first absent creates no identity, absent-to-bytes creates a successor, and a foreign reservation stays pending', async () => {
    const absent = await activity(0); const c1 = await claimAndReserve(200);
    await checkpoints.applySuccessfulObservation({
      activityId: absent.activityId, claimToken: c1.claimToken, sourceEdgeId: absent.edgeId,
      canonicalPath: 'docs/a.txt', state: 'absent', observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3], fact: { state: 'absent' },
    });
    await expect(db('resource_registry')).resolves.toHaveLength(0);
    const bytes = await activity(1); const c2 = await claimAndReserve(210);
    const successor = await checkpoints.applySuccessfulObservation({
      activityId: bytes.activityId, claimToken: c2.claimToken, sourceEdgeId: bytes.edgeId,
      canonicalPath: 'docs/a.txt', state: 'bytes', bytes: Buffer.from('A'),
      fingerprint: { dev: '1', ino: '2', size: 1, birthtimeMs: 3 }, observedAt: 211,
      snapshotId: UUIDS[4], observationId: UUIDS[5], eventId: UUIDS[6], fact: { state: 'A' },
    });
    expect(successor.resourceId).toMatch(/^[0-9a-f-]{36}$/u);
    const foreignStable = createStableResourceRepository(db, { randomUuid: () => UUIDS[60] });
    await foreignStable.reserve({ workspaceId: 'workspace-1', canonicalPath: 'docs/foreign.txt', currentFingerprint: null, now: 220 });
    const foreign = await activity(2, { canonicalPath: 'docs/foreign.txt' });
    const c3 = await claimAndReserve(220);
    await expect(checkpoints.applySuccessfulObservation({
      activityId: foreign.activityId, claimToken: c3.claimToken, sourceEdgeId: foreign.edgeId,
      canonicalPath: 'docs/foreign.txt', state: 'bytes', bytes: Buffer.from('B'),
      fingerprint: { dev: '3', ino: '4', size: 1, birthtimeMs: 5 }, observedAt: 221,
      snapshotId: UUIDS[7], observationId: UUIDS[8], eventId: UUIDS[9], fact: { state: 'B' },
    })).rejects.toMatchObject({ code: 'reserved_path_occupied' });
    await expect(db('agent_tool_resource_edges').where({ edge_id: foreign.edgeId }).first()).resolves.toMatchObject({ observation_state: 'pending' });
  });

  test('a compatible live identity remains uncheckpointed while a mediated save owns the path', async () => {
    const fingerprint = { dev: '1', ino: '2', size: 1, birthtimeMs: 3 };
    await stable.reserve({ workspaceId: 'workspace-1', canonicalPath: 'docs/owned.txt', currentFingerprint: fingerprint, now: 100 });
    const operations = createFileOperationRepository(db, { resources: stable });
    await operations.reserve({
      workspaceId: 'workspace-1', requestId: 'owned-request', canonicalPath: 'docs/owned.txt',
      ingressPanel: 'file-viewer', ingressPath: 'docs/owned.txt', currentFingerprint: fingerprint,
      origin: { kind: 'local_client', connectionId: 'connection-1', assurance: 'transport_only' },
      saveReason: 'manual', acceptedAt: 110, intendedAfterSha256: 'a'.repeat(64), intendedAfterByteLength: 1,
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', commandId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      commandAcceptedEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', resourceEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
      fileVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    });
    const current = await activity(0, { canonicalPath: 'docs/owned.txt' });
    const claim = await claimAndReserve(200);
    await expect(checkpoints.applySuccessfulObservation({
      activityId: current.activityId, claimToken: claim.claimToken, sourceEdgeId: current.edgeId,
      canonicalPath: 'docs/owned.txt', state: 'bytes', bytes: Buffer.from('A'), fingerprint, observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3], fact: { state: 'A' },
    })).rejects.toMatchObject({ code: 'resource_operation_in_progress' });
    await expect(db('agent_tool_resource_edges').where({ edge_id: current.edgeId }).first())
      .resolves.toMatchObject({ observation_state: 'pending', snapshot_id: null });
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(0);
    await expect(db('file_operations').first()).resolves.toMatchObject({ state: 'accepted' });
  });

  test('an absent observation cannot bypass a mediated save whose registry path is unavailable', async () => {
    const operations = createFileOperationRepository(db, { resources: stable });
    const operation = await operations.reserve({
      workspaceId: 'workspace-1', requestId: 'absent-owned-request', canonicalPath: 'docs/absent-owned.txt',
      ingressPanel: 'file-viewer', ingressPath: 'docs/absent-owned.txt', currentFingerprint: null,
      origin: { kind: 'local_client', connectionId: 'connection-2', assurance: 'transport_only' },
      saveReason: 'manual', acceptedAt: 110, intendedAfterSha256: 'b'.repeat(64), intendedAfterByteLength: 1,
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', commandId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      commandAcceptedEventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', resourceEventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
      fileVersionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
    });
    await db('resource_registry').where({ resource_id: operation.resourceId }).update({
      canonical_path: 'docs/registry-relocated.txt', updated_at: 120,
    });
    await expect(db('resource_registry').where({ canonical_path: 'docs/absent-owned.txt' })).resolves.toHaveLength(0);
    const current = await activity(0, { canonicalPath: 'docs/absent-owned.txt' });
    const claim = await claimAndReserve(200);
    await expect(checkpoints.applySuccessfulObservation({
      activityId: current.activityId, claimToken: claim.claimToken, sourceEdgeId: current.edgeId,
      canonicalPath: 'docs/absent-owned.txt', state: 'absent', observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3], fact: { state: 'absent' },
    })).rejects.toMatchObject({ code: 'resource_operation_in_progress' });
    await expect(db('agent_tool_resource_edges').where({ edge_id: current.edgeId }).first())
      .resolves.toMatchObject({ observation_state: 'pending', snapshot_id: null });
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(0);
    await expect(db('file_operations').where({ operation_id: operation.operationId }).first())
      .resolves.toMatchObject({ state: 'accepted' });
  });

  test.each(['\ud800', '\udfff'])('resource identity rejects lone surrogate authority without mutation', async (surrogate) => {
    const identity = createAgentResourceIdentityService(db, stable);
    await expect(db.transaction((trx) => identity.observeBytesInTransaction(trx, {
      workspaceId: surrogate, canonicalPath: 'docs/a.txt',
      currentFingerprint: { dev: '1', ino: '2', size: 1, birthtimeMs: 3 }, now: 100,
    }))).rejects.toThrow(/Unicode scalar/u);
    await expect(db.transaction((trx) => identity.observeBytesInTransaction(trx, {
      workspaceId: 'workspace-1', canonicalPath: `docs/${surrogate}.txt`,
      currentFingerprint: { dev: '1', ino: '2', size: 1, birthtimeMs: 3 }, now: 100,
    }))).rejects.toThrow(/Unicode scalar/u);
    await expect(db.transaction((trx) => identity.observeAbsentInTransaction(trx, {
      workspaceId: surrogate, canonicalPath: 'docs/a.txt', now: 100,
    }))).rejects.toThrow(/Unicode scalar/u);
    await expect(db.transaction((trx) => identity.observeAbsentInTransaction(trx, {
      workspaceId: 'workspace-1', canonicalPath: `docs/${surrogate}.txt`, now: 100,
    }))).rejects.toThrow(/Unicode scalar/u);
    await expect(db('resource_registry')).resolves.toHaveLength(0);
  });

  test('rejects binary/oversize content and closes symlink outcomes without a snapshot', async () => {
    expect(() => verifyUtf8Bytes(Buffer.from([0xff]))).toThrow(/utf-8/ui);
    expect(() => verifyUtf8Bytes(Buffer.from('a\0b'))).toThrow(/NUL/u);
    expect(() => verifyUtf8Bytes(Buffer.alloc(10 * 1024 * 1024 + 1))).toThrow(/10 MiB/u);
    const current = await activity(0); const claim = await observations.claimDue(200);
    await expect(observations.closeGroup(claim.claimToken, 201, { state: 'skipped', reason: 'final_symlink' }))
      .rejects.toMatchObject({ code: 'observation_attempt_not_reserved' });
    await observations.reserveAttempt(claim.claimToken, 201);
    await observations.closeGroup(claim.claimToken, 201, { state: 'skipped', reason: 'final_symlink' });
    await expect(db('agent_tool_resource_edges').where({ edge_id: current.edgeId }).first()).resolves.toMatchObject({ observation_state: 'skipped', observation_reason: 'final_symlink', snapshot_id: null });
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(0);
    expect(checkpoints.getBlob).toBeUndefined();
  });

  test('detects a content-address collision and rolls registry/checkpoint/edge changes back', async () => {
    const collisionHash = 'f'.repeat(64);
    const stable = createStableResourceRepository(db, { randomUuid: () => UUIDS[60 + uuidIndex++] });
    const collisionCheckpoints = createAgentCheckpointRepository(db, {
      resourceIdentity: createAgentResourceIdentityService(db, stable),
      randomUuid: () => UUIDS[70 + uuidIndex++],
      hashBytes: () => collisionHash,
    });
    const first = await activity(0); const c1 = await claimAndReserve(200);
    await collisionCheckpoints.applySuccessfulObservation({
      activityId: first.activityId, claimToken: c1.claimToken, sourceEdgeId: first.edgeId,
      canonicalPath: 'docs/a.txt', state: 'bytes', bytes: Buffer.from('A'),
      fingerprint: { dev: '1', ino: '2', size: 1, birthtimeMs: 3 }, observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3], fact: { state: 'A' },
    });
    const second = await activity(1); const c2 = await claimAndReserve(210);
    await expect(collisionCheckpoints.applySuccessfulObservation({
      activityId: second.activityId, claimToken: c2.claimToken, sourceEdgeId: second.edgeId,
      canonicalPath: 'docs/a.txt', state: 'bytes', bytes: Buffer.from('B'),
      fingerprint: { dev: '1', ino: '2', size: 1, birthtimeMs: 3 }, observedAt: 211,
      snapshotId: UUIDS[4], observationId: UUIDS[5], eventId: UUIDS[6], fact: { state: 'B' },
    })).rejects.toBeInstanceOf(AgentSnapshotConflictError);
    await expect(db('agent_resource_snapshots')).resolves.toHaveLength(1);
    await expect(db('agent_tool_resource_edges').where({ edge_id: second.edgeId }).first()).resolves.toMatchObject({ observation_state: 'pending' });
  });

  test('projection claims are token guarded, lease-recoverable, and fail at exact count three', async () => {
    const first = await activity(0); const observed = await claimAndReserve(200);
    await checkpoints.applySuccessfulObservation({
      activityId: first.activityId, claimToken: observed.claimToken, sourceEdgeId: first.edgeId,
      canonicalPath: 'docs/a.txt', state: 'absent', observedAt: 201,
      snapshotId: UUIDS[1], observationId: UUIDS[2], eventId: UUIDS[3], fact: { state: 'absent' },
    });
    const projection = await projections.claimDue(201, { leaseMs: 10 });
    await expect(projections.settle('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 202, 'v2_sent')).rejects.toBeInstanceOf(AgentRendererProjectionClaimError);
    await expect(projections.recoverExpired(211)).resolves.toBe(1);
    let next = await projections.claimDue(311);
    await expect(projections.failDelivery(next.claimToken, 312)).resolves.toMatchObject({ failed: false, deliveryFailureCount: 1 });
    next = await projections.claimDue(562); await projections.failDelivery(next.claimToken, 563);
    next = await projections.claimDue(1563);
    await expect(projections.failDelivery(next.claimToken, 1564)).resolves.toMatchObject({ failed: true, deliveryFailureCount: 3 });
    await expect(db('agent_renderer_projection_jobs').first()).resolves.toMatchObject({ state: 'failed', settlement: 'retry_exhausted' });
  });

  test('lease recovery is bounded to one observation disposition batch', async () => {
    for (let index = 0; index < 17; index += 1) {
      const current = await activity(index);
      await db('agent_observation_jobs').where({ activity_id: current.activityId }).update({
        state: 'running', claim_token: UUIDS[60 + index], claimed_edge_id: current.edgeId,
        claimed_attempt: 0, claimed_at: 500, lease_expires_at: 600, updated_at: 500,
      });
    }
    await expect(observations.recoverExpired(600)).resolves.toBe(16);
    await expect(db('agent_observation_jobs').where({ state: 'running' })).resolves.toHaveLength(1);
  });

  test('lease recovery is bounded to one renderer-projection disposition batch', async () => {
    const allEdges = [];
    for (const [group, count] of [64, 37].entries()) {
      const candidates = Array.from({ length: count }, (_, ordinal) => {
        const sequence = group * 64 + ordinal + 1;
        const canonicalPath = `bulk/${sequence}.txt`;
        return {
          edgeId: generatedUuid(1_000 + sequence),
          candidateSha256: acceptedCandidateSha256(canonicalPath),
          canonicalPath,
          accessFamily: 'read', accessKind: 'read', extractionBasis: 'structured_path',
        };
      });
      const owner = await insertTerminalActivity(db, {
        activityId: generatedUuid(100 + group), eventId: generatedUuid(200 + group),
        toolCallId: `projection-recovery-${group}`, candidates, reportedCount: count,
      });
      await admitActivity(db, owner.input.activityId);
      allEdges.push(...candidates.map((candidate) => ({ ...candidate, activityId: owner.input.activityId })));
    }
    await db('agent_renderer_projection_jobs').insert(allEdges.map((edge, index) => ({
      source_edge_id: edge.edgeId, workspace_id: 'workspace-1', activity_id: edge.activityId,
      observed_at: index, relation: 'unchanged', state: 'running', delivery_failure_count: 0,
      next_attempt_at: null, claim_token: generatedUuid(10_000 + index), claimed_at: 500,
      lease_expires_at: 600, settled_at: null, settlement: null, created_at: 1, updated_at: 500,
    })));
    await expect(projections.recoverExpired(600)).resolves.toBe(100);
    await expect(db('agent_renderer_projection_jobs').where({ state: 'running' })).resolves.toHaveLength(1);
  });

  test.each([[15, 15, 0], [16, 16, 0], [17, 16, 1]])(
    'observation scheduler handles %i jobs as %i dispositions plus %i durable remainder',
    async (count, dispositions, remainder) => {
      for (let index = 0; index < count; index += 1) await activity(index);
      const scheduler = createAgentObservationScheduler(observations);
      let active = 0; let maximumActive = 0;
      const results = await scheduler.drainBatch(1_000, async (claim) => {
        active += 1; maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setImmediate(resolve));
        await observations.releaseWithoutAttempt(claim.claimToken, 1_000);
        active -= 1;
      });
      expect(results).toHaveLength(dispositions);
      expect(maximumActive).toBeLessThanOrEqual(4);
      if (count >= 4) expect(maximumActive).toBe(4);
      await expect(db('agent_observation_jobs').where({ state: 'pending' }).where('next_attempt_at', '<=', 1_000))
        .resolves.toHaveLength(remainder);
      await expect(db('agent_observation_jobs').where({ state: 'running' })).resolves.toHaveLength(0);
    },
  );

  test.each([[99, 99, 0], [100, 100, 0], [101, 100, 1]])(
    'renderer projection scheduler handles %i jobs as %i dispositions plus %i durable remainder',
    async (count, dispositions, remainder) => {
      let pending = count; let active = 0; let maximumActive = 0; let ordinal = 0;
      const repository = {
        async claimDue() {
          if (pending === 0) return null;
          pending -= 1; ordinal += 1;
          return { sourceEdgeId: `edge-${ordinal}`, claimToken: `claim-${ordinal}` };
        },
      };
      const scheduler = createAgentRendererProjectionScheduler(repository);
      const results = await scheduler.drainBatch(1_000, async () => {
        active += 1; maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setImmediate(resolve));
        active -= 1;
      });
      expect(results).toHaveLength(dispositions);
      expect(pending).toBe(remainder);
      expect(maximumActive).toBe(1);
    },
  );
});
