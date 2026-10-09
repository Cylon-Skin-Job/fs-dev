'use strict';

const crypto = require('crypto');
const { runBoundedSqliteRetry } = require('./sqlite-contention');
const {
  ProvenanceConflictError,
  assertNonemptyBoundedString,
  assertTimestamp,
  assertUuid,
  fingerprintFromRow,
  fingerprintsEqual,
  normalizeCanonicalPath,
  normalizeFingerprint,
} = require('./provenance-values');

function mapResource(row) {
  if (!row) return null;
  return Object.freeze({
    resourceId: row.resource_id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    canonicalPath: row.canonical_path,
    lifecycleState: row.lifecycle_state,
    fingerprint: fingerprintFromRow(row),
    tombstoneReason: row.tombstone_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tombstonedAt: row.tombstoned_at,
  });
}

function createStableResourceRepository(db, { randomUuid = crypto.randomUUID } = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');

  async function findActive(trx, workspaceId, canonicalPath) {
    return trx('resource_registry')
      .where({ workspace_id: workspaceId, canonical_path: canonicalPath })
      .whereNot({ lifecycle_state: 'tombstoned' })
      .first();
  }

  async function findActiveOperationForPath(trx, workspaceId, canonicalPath) {
    return trx('file_operations')
      .where({ workspace_id: workspaceId, canonical_path: canonicalPath })
      .whereIn('state', ['accepted', 'prepared'])
      .first();
  }

  async function reserveInTransaction(trx, input) {
    const workspaceId = assertNonemptyBoundedString(input.workspaceId, 128, 'workspaceId');
    const canonicalPath = normalizeCanonicalPath(input.canonicalPath);
    const currentFingerprint = normalizeFingerprint(input.currentFingerprint, { allowNull: true });
    const now = assertTimestamp(input.now, 'now');
    let active = await findActive(trx, workspaceId, canonicalPath);

    if (active?.lifecycle_state === 'outcome_unknown') {
      throw new ProvenanceConflictError('resource path has an unresolved outcome', 'resource_outcome_unknown');
    }
    if (active?.lifecycle_state === 'reserved') {
      if (currentFingerprint) {
        throw new ProvenanceConflictError('reserved path unexpectedly exists', 'reserved_path_occupied');
      }
      return { resource: mapResource(active), created: false, reusedReservation: true };
    }
    if (active?.lifecycle_state === 'live') {
      const storedFingerprint = fingerprintFromRow(active);
      if (currentFingerprint && fingerprintsEqual(storedFingerprint, currentFingerprint)) {
        return { resource: mapResource(active), created: false, reusedReservation: false };
      }
      if (await findActiveOperationForPath(trx, workspaceId, canonicalPath)) {
        throw new ProvenanceConflictError(
          'resource path already has a nonterminal operation',
          'resource_operation_in_progress',
        );
      }
      await trx('resource_registry').where({ resource_id: active.resource_id }).update({
        lifecycle_state: 'tombstoned',
        tombstone_reason: 'compatibility_relocated_or_replaced',
        tombstoned_at: now,
        updated_at: now,
      });
      active = null;
    }

    const resourceId = input.resourceId
      ? assertUuid(input.resourceId, 'resourceId')
      : assertUuid(randomUuid(), 'generated resourceId');
    const row = {
      resource_id: resourceId,
      workspace_id: workspaceId,
      kind: 'file',
      canonical_path: canonicalPath,
      lifecycle_state: currentFingerprint ? 'live' : 'reserved',
      fingerprint_dev: currentFingerprint?.dev ?? null,
      fingerprint_ino: currentFingerprint?.ino ?? null,
      fingerprint_size: currentFingerprint?.size ?? null,
      fingerprint_birthtime_ms: currentFingerprint?.birthtimeMs ?? null,
      created_at: now,
      updated_at: now,
    };
    try {
      await trx('resource_registry').insert(row);
      return { resource: mapResource(row), created: true, reusedReservation: false };
    } catch (error) {
      if (!String(error?.message).includes('UNIQUE constraint failed')) throw error;
      const winner = await findActive(trx, workspaceId, canonicalPath);
      if (
        (winner?.lifecycle_state === 'reserved' && !currentFingerprint)
        || (
          winner?.lifecycle_state === 'live'
          && currentFingerprint
          && fingerprintsEqual(fingerprintFromRow(winner), currentFingerprint)
        )
      ) {
        return { resource: mapResource(winner), created: false, reusedReservation: true };
      }
      throw error;
    }
  }

  async function tryReserveAbsentAtomically(input) {
    if (input.currentFingerprint != null) return null;
    const workspaceId = assertNonemptyBoundedString(input.workspaceId, 128, 'workspaceId');
    const canonicalPath = normalizeCanonicalPath(input.canonicalPath);
    const now = assertTimestamp(input.now, 'now');
    const active = await findActive(db, workspaceId, canonicalPath);
    if (active) {
      if (active.lifecycle_state === 'reserved') {
        return { resource: mapResource(active), created: false, reusedReservation: true };
      }
      return null;
    }
    const resourceId = input.resourceId
      ? assertUuid(input.resourceId, 'resourceId')
      : assertUuid(randomUuid(), 'generated resourceId');
    const inserted = await db('resource_registry').insert({
      resource_id: resourceId,
      workspace_id: workspaceId,
      kind: 'file',
      canonical_path: canonicalPath,
      lifecycle_state: 'reserved',
      created_at: now,
      updated_at: now,
    }).onConflict().ignore();
    const winner = await findActive(db, workspaceId, canonicalPath);
    if (!winner || winner.lifecycle_state !== 'reserved') return null;
    return {
      resource: mapResource(winner),
      created: Number(inserted[0]) > 0 && winner.resource_id === resourceId,
      reusedReservation: winner.resource_id !== resourceId,
    };
  }

  return Object.freeze({
    async reserve(input) {
      return runBoundedSqliteRetry(async () => {
        const atomicAbsent = await tryReserveAbsentAtomically(input);
        if (atomicAbsent) return atomicAbsent;
        return db.transaction((trx) => reserveInTransaction(trx, input));
      }, {
        retryUnique: true,
        exhaustionCode: 'resource_reservation_contention',
        exhaustionMessage: 'resource reservation contention did not settle',
      });
    },
    reserveInTransaction,
    async getById(resourceId) {
      assertUuid(resourceId, 'resourceId');
      return mapResource(await db('resource_registry').where({ resource_id: resourceId }).first());
    },
    async getActiveByPath(workspaceId, canonicalPath) {
      assertNonemptyBoundedString(workspaceId, 128, 'workspaceId');
      normalizeCanonicalPath(canonicalPath);
      return mapResource(await findActive(db, workspaceId, canonicalPath));
    },
  });
}

module.exports = { createStableResourceRepository };
