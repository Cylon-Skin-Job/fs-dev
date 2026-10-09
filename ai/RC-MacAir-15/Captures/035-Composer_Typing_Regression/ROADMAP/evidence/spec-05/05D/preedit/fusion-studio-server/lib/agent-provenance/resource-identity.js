'use strict';

const {
  ProvenanceConflictError,
  assertTimestamp,
  normalizeCanonicalPath,
} = require('../file-mutations/provenance-values');
const { assertScalarBoundedString } = require('./values');

function createAgentResourceIdentityService(db, stableResourceRepository) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  if (!stableResourceRepository?.reserveInTransaction) throw new TypeError('stable resource repository is required');

  async function findActiveOperation(trx, workspaceId, canonicalPath) {
    return trx('file_operations')
      .where({ workspace_id: workspaceId, canonical_path: canonicalPath })
      .whereIn('state', ['accepted', 'prepared'])
      .first();
  }

  return Object.freeze({
    async observeBytesInTransaction(trx, input) {
      const workspaceId = assertScalarBoundedString(input.workspaceId, 128, 'workspaceId');
      const canonicalPath = normalizeCanonicalPath(assertScalarBoundedString(input.canonicalPath, 4096, 'canonicalPath'));
      if (await findActiveOperation(trx, workspaceId, canonicalPath)) {
        throw new ProvenanceConflictError('resource path is owned by a nonterminal operation', 'resource_operation_in_progress');
      }
      return stableResourceRepository.reserveInTransaction(trx, { ...input, workspaceId, canonicalPath });
    },

    async observeAbsentInTransaction(trx, input) {
      const workspaceId = assertScalarBoundedString(input.workspaceId, 128, 'workspaceId');
      const canonicalPath = normalizeCanonicalPath(assertScalarBoundedString(input.canonicalPath, 4096, 'canonicalPath'));
      const now = assertTimestamp(input.now, 'now');
      if (await findActiveOperation(trx, workspaceId, canonicalPath)) {
        throw new ProvenanceConflictError('resource path is owned by a nonterminal operation', 'resource_operation_in_progress');
      }
      const active = await trx('resource_registry')
        .where({ workspace_id: workspaceId, canonical_path: canonicalPath })
        .whereNot({ lifecycle_state: 'tombstoned' })
        .first();
      if (!active) return Object.freeze({ retiredResourceId: null });
      if (active.lifecycle_state !== 'live') {
        throw new ProvenanceConflictError('resource path is owned by a nonterminal operation', 'resource_operation_in_progress');
      }
      await trx('resource_registry').where({ resource_id: active.resource_id }).update({
        lifecycle_state: 'tombstoned',
        tombstone_reason: 'compatibility_relocated_or_replaced',
        tombstoned_at: now,
        updated_at: now,
      });
      return Object.freeze({ retiredResourceId: active.resource_id });
    },
  });
}

module.exports = { createAgentResourceIdentityService };
