'use strict';

const crypto = require('crypto');
const { canonicalizeJson } = require('../event-registry/canonical-json');
const {
  assertSha256,
  assertTimestamp,
  assertUuid,
  normalizeFingerprint,
} = require('../file-mutations/provenance-values');
const { MAX_SNAPSHOT_BYTES } = require('../db/migrations/036_agent_tool_provenance');
const { runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');

class AgentSnapshotConflictError extends Error {
  constructor(code = 'snapshot_integrity_conflict') {
    super('Agent snapshot conflicts with established durable truth.');
    this.name = 'AgentSnapshotConflictError';
    this.code = code;
  }
}

class AgentUnsupportedTextError extends TypeError {
  constructor() {
    super('snapshot is not NUL-free exact UTF-8');
    this.name = 'AgentUnsupportedTextError';
    this.code = 'unsupported_text';
  }
}

const ACCESS_RANK = Object.freeze({ write: 0, read: 1, execute: 2, unknown: 3 });

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function storedBytesEqual(stored, observed) {
  if (!Buffer.isBuffer(stored) && !(stored instanceof Uint8Array)) return false;
  const view = Buffer.isBuffer(stored)
    ? stored
    : Buffer.from(stored.buffer, stored.byteOffset, stored.byteLength);
  return view.equals(observed);
}

function verifyUtf8Bytes(value, { takeOwnership = false } = {}) {
  if (!Buffer.isBuffer(value)) throw new TypeError('bytes must be a Buffer');
  if (value.length > MAX_SNAPSHOT_BYTES) throw new RangeError('snapshot exceeds 10 MiB');
  const bytes = takeOwnership ? value : Buffer.from(value);
  if (bytes.includes(0)) throw new AgentUnsupportedTextError();
  try {
    // Perform the required fatal-decode/re-encode comparison in bounded
    // chunks. This preserves a BOM as ordinary content and avoids retaining a
    // second file-sized byte buffer or decoded string beside the native bytes.
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    let verifiedOffset = 0;
    const verifyText = (text) => {
      const encoded = Buffer.from(text, 'utf8');
      if (!bytes.subarray(verifiedOffset, verifiedOffset + encoded.length).equals(encoded)) {
        throw new AgentUnsupportedTextError();
      }
      verifiedOffset += encoded.length;
    };
    for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
      verifyText(decoder.decode(bytes.subarray(offset, offset + 64 * 1024), { stream: true }));
    }
    verifyText(decoder.decode());
    if (verifiedOffset !== bytes.length) throw new AgentUnsupportedTextError();
  } catch (error) {
    if (error instanceof AgentUnsupportedTextError) throw error;
    throw new AgentUnsupportedTextError();
  }
  return bytes;
}

function stateMatches(snapshot, state, sha256, byteLength) {
  return snapshot && snapshot.state === state
    && (state === 'absent' || (snapshot.blob_sha256 === sha256 && snapshot.byte_length === byteLength));
}

function chooseDominant(edges) {
  return [...edges].sort((left, right) => (
    ACCESS_RANK[left.access_family] - ACCESS_RANK[right.access_family]
      || left.candidate_ordinal - right.candidate_ordinal
  ))[0];
}

function observationFact({ activity, dominant, eventId, observationId, snapshotId, observedAt, state, relation, resourceId, sha256, byteLength, previousSnapshotId }) {
  return {
    eventId,
    eventType: 'resource.state_observed',
    schemaVersion: 1,
    occurredAt: observedAt,
    workspaceId: activity.workspace_id,
    operationId: observationId,
    source: {
      activityId: activity.activity_id,
      edgeId: dominant.edge_id,
      threadId: activity.thread_id,
      turnId: activity.turn_id,
      toolCallId: activity.tool_call_id,
      harnessId: activity.harness_id,
      accessFamily: dominant.access_family,
      accessKind: dominant.access_kind,
      extractionBasis: dominant.extraction_basis,
    },
    resource: {
      ...(resourceId == null ? {} : { resourceId }),
      kind: 'file',
      path: dominant.canonical_path,
    },
    observation: {
      snapshotId,
      state,
      relation,
      ...(state === 'bytes' ? { sha256 } : {}),
      byteLength,
      ...(previousSnapshotId == null ? {} : { previousSnapshotId }),
    },
  };
}

function createAgentCheckpointRepository(db, {
  resourceIdentity,
  randomUuid = crypto.randomUUID,
  hashBytes = digest,
} = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  if (!resourceIdentity) throw new TypeError('resource identity service is required');

  async function insertBlob(trx, bytes, sha256, now) {
    const existing = await trx('agent_snapshot_blobs').where({ sha256 }).first();
    if (existing) {
      if (existing.byte_length !== bytes.length || !storedBytesEqual(existing.bytes, bytes)) {
        throw new AgentSnapshotConflictError();
      }
      return false;
    }
    await trx('agent_snapshot_blobs').insert({
      sha256,
      byte_length: bytes.length,
      encoding: 'utf8',
      bytes,
      first_stored_at: now,
    });
    return true;
  }

  async function advanceObservationJob(trx, activityId, claimToken, now) {
    const job = await trx('agent_observation_jobs').where({ activity_id: activityId }).first();
    if (!job || job.state !== 'running' || job.claim_token !== claimToken) {
      throw new AgentSnapshotConflictError('observation_claim_conflict');
    }
    const next = await trx('agent_tool_resource_edges')
      .where({ activity_id: activityId, observation_state: 'pending' })
      .min({ next_attempt_at: 'next_observation_at' })
      .first();
    await trx('agent_observation_jobs').where({ activity_id: activityId, claim_token: claimToken }).update({
      state: next?.next_attempt_at == null ? 'complete' : 'pending',
      claim_token: null,
      claimed_edge_id: null,
      claimed_attempt: null,
      claimed_at: null,
      lease_expires_at: null,
      next_attempt_at: next?.next_attempt_at ?? null,
      updated_at: now,
    });
  }

  return Object.freeze({
    async applySuccessfulObservation(input) {
      const activityId = assertUuid(input.activityId, 'activityId');
      const claimToken = assertUuid(input.claimToken, 'claimToken');
      const observedAt = assertTimestamp(input.observedAt, 'observedAt');
      const state = input.state;
      if (!['bytes', 'absent'].includes(state)) throw new TypeError('state is invalid');
      const bytes = state === 'bytes'
        ? verifyUtf8Bytes(input.bytes, { takeOwnership: input.takeByteOwnership === true })
        : null;
      if (state === 'absent' && input.bytes != null) throw new TypeError('absent state has no bytes');
      const sha256 = bytes ? assertSha256(hashBytes(bytes), 'snapshot sha256') : null;
      const fingerprint = state === 'bytes' ? normalizeFingerprint(input.fingerprint) : null;
      if (fingerprint && fingerprint.size !== bytes.length) {
        throw new TypeError('fingerprint size must match observed bytes');
      }
      const deadlineGuard = typeof input.deadlineGuard === 'function'
        ? input.deadlineGuard
        : () => true;
      if (!deadlineGuard()) throw new AgentSnapshotConflictError('observation_deadline_expired');
      return runBoundedSqliteRetry(() => {
        if (!deadlineGuard()) throw new AgentSnapshotConflictError('observation_deadline_expired');
        return db.transaction(async (trx) => {
        if (!deadlineGuard()) throw new AgentSnapshotConflictError('observation_deadline_expired');
        const activity = await trx('agent_tool_activities').where({ activity_id: activityId }).first();
        if (!activity) throw new TypeError('activity does not exist');
        const claim = await trx('agent_observation_jobs').where({
          activity_id: activityId,
          state: 'running',
          claim_token: claimToken,
        }).first();
        if (!claim || claim.claimed_attempt < 1) throw new AgentSnapshotConflictError('observation_claim_conflict');
        const claimedEdge = await trx('agent_tool_resource_edges').where({ edge_id: claim.claimed_edge_id }).first();
        if (!claimedEdge || claimedEdge.activity_id !== activityId || claimedEdge.workspace_id !== activity.workspace_id) {
          throw new AgentSnapshotConflictError('observation_claim_edge_conflict');
        }
        if (input.sourceEdgeId != null && claimedEdge.edge_id !== assertUuid(input.sourceEdgeId, 'sourceEdgeId')) {
          throw new AgentSnapshotConflictError('dominant_edge_mismatch');
        }
        if (input.canonicalPath !== claimedEdge.canonical_path) throw new AgentSnapshotConflictError('observation_claim_path_conflict');
        const selected = await trx('agent_tool_resource_edges').where({
          activity_id: activityId,
          canonical_path: claimedEdge.canonical_path,
          observation_state: 'pending',
        }).orderBy('candidate_ordinal', 'asc');
        if (!selected.length) throw new AgentSnapshotConflictError('observation_group_not_pending');
        if (selected.some((edge) => edge.observation_attempt_count !== claim.claimed_attempt)) {
          throw new AgentSnapshotConflictError('observation_attempt_drift');
        }
        const dominant = chooseDominant(selected);
        if (dominant.edge_id !== claimedEdge.edge_id) {
          throw new AgentSnapshotConflictError('dominant_edge_mismatch');
        }
        const latest = await trx('agent_resource_snapshots').where({
          workspace_id: activity.workspace_id,
          canonical_path: dominant.canonical_path,
        }).orderBy('id', 'desc').first();

        if (bytes && latest && latest.state === 'bytes' && latest.blob_sha256 === sha256 && latest.byte_length === bytes.length) {
          const establishedBlob = await trx('agent_snapshot_blobs').where({ sha256 }).first();
          if (!establishedBlob || establishedBlob.byte_length !== bytes.length
            || !storedBytesEqual(establishedBlob.bytes, bytes)) {
            throw new AgentSnapshotConflictError();
          }
        }

        let resourceId = null;
        if (state === 'bytes') {
          const reserved = await resourceIdentity.observeBytesInTransaction(trx, {
            workspaceId: activity.workspace_id,
            canonicalPath: dominant.canonical_path,
            currentFingerprint: fingerprint,
            now: observedAt,
            resourceId: input.resourceId,
          });
          resourceId = reserved.resource.resourceId;
        } else {
          await resourceIdentity.observeAbsentInTransaction(trx, {
            workspaceId: activity.workspace_id,
            canonicalPath: dominant.canonical_path,
            now: observedAt,
          });
        }

        const byteLength = bytes?.length ?? 0;
        if (stateMatches(latest, state, sha256, byteLength)) {
          await trx('agent_tool_resource_edges').whereIn('edge_id', selected.map((edge) => edge.edge_id)).update({
            resource_id: resourceId,
            observation_state: 'unchanged',
            observation_reason: null,
            observed_at: observedAt,
            snapshot_id: latest.snapshot_id,
            previous_snapshot_id: latest.previous_snapshot_id,
            next_observation_at: null,
            updated_at: observedAt,
          });
          await trx('agent_renderer_projection_jobs').insert({
            source_edge_id: dominant.edge_id,
            workspace_id: activity.workspace_id,
            activity_id: activityId,
            observed_at: observedAt,
            relation: 'unchanged',
            state: 'pending',
            next_attempt_at: observedAt,
            created_at: observedAt,
            updated_at: observedAt,
          });
          await advanceObservationJob(trx, activityId, claimToken, observedAt);
          if (!deadlineGuard()) throw new AgentSnapshotConflictError('observation_deadline_expired');
          return Object.freeze({ relation: 'unchanged', snapshotId: latest.snapshot_id, sourceEdgeId: dominant.edge_id });
        }

        const relation = latest ? 'changed' : 'first_observation';
        const snapshotId = assertUuid(input.snapshotId ?? randomUuid(), 'snapshotId');
        const observationId = assertUuid(input.observationId ?? randomUuid(), 'observationId');
        const eventId = assertUuid(input.eventId ?? randomUuid(), 'eventId');
        if (bytes) await insertBlob(trx, bytes, sha256, observedAt);
        const factJson = canonicalizeJson(observationFact({
          activity, dominant, eventId, observationId, snapshotId, observedAt, state, relation,
          resourceId, sha256, byteLength, previousSnapshotId: latest?.snapshot_id ?? null,
        }));
        const factSha256 = digest(Buffer.from(factJson, 'utf8'));
        await trx('agent_resource_snapshots').insert({
          snapshot_id: snapshotId,
          observation_id: observationId,
          event_id: eventId,
          workspace_id: activity.workspace_id,
          resource_id: resourceId,
          canonical_path: dominant.canonical_path,
          file_name: dominant.file_name,
          folder_path: dominant.folder_path,
          state,
          blob_sha256: sha256,
          byte_length: byteLength,
          relation,
          previous_snapshot_id: latest?.snapshot_id ?? null,
          source_activity_id: activityId,
          source_edge_id: dominant.edge_id,
          access_family: dominant.access_family,
          access_kind: dominant.access_kind,
          extraction_basis: dominant.extraction_basis,
          snapshot_observed_at: observedAt,
          fact_json: factJson,
          fact_sha256: factSha256,
          created_at: observedAt,
          updated_at: observedAt,
        });
        await trx('agent_tool_resource_edges').whereIn('edge_id', selected.map((edge) => edge.edge_id)).update({
          resource_id: resourceId,
          observation_state: relation,
          observation_reason: null,
          observed_at: observedAt,
          snapshot_id: snapshotId,
          previous_snapshot_id: latest?.snapshot_id ?? null,
          next_observation_at: null,
          updated_at: observedAt,
        });
        await trx('agent_renderer_projection_jobs').insert({
          source_edge_id: dominant.edge_id,
          workspace_id: activity.workspace_id,
          activity_id: activityId,
          observed_at: observedAt,
          relation,
          state: 'pending',
          next_attempt_at: observedAt,
          created_at: observedAt,
          updated_at: observedAt,
        });
        await advanceObservationJob(trx, activityId, claimToken, observedAt);
        if (!deadlineGuard()) throw new AgentSnapshotConflictError('observation_deadline_expired');
        return Object.freeze({ relation, snapshotId, observationId, eventId, sourceEdgeId: dominant.edge_id, resourceId, sha256, byteLength });
        });
      }, {
        attempts: 5,
        exhaustionCode: 'agent_observation_transition_failed',
        exhaustionMessage: 'agent observation checkpoint did not settle',
      });
    },
  });
}

module.exports = {
  AgentSnapshotConflictError,
  AgentUnsupportedTextError,
  createAgentCheckpointRepository,
  verifyUtf8Bytes,
};
