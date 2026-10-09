'use strict';

const { PRODUCER_ID } = require('./file-operation-repository');
const { ProvenanceConflictError, assertUuid } = require('./provenance-values');

const SUPPORTED_SCHEMAS = Object.freeze({
  'file.command_accepted': Object.freeze({
    eventColumn: 'command_accepted_event_id',
    occurredColumn: 'accepted_at',
    hashColumn: 'command_reservation_sha256',
  }),
  'resource.mutated': Object.freeze({
    eventColumn: 'resource_event_id',
    occurredColumn: 'resource_occurred_at',
    hashColumn: 'resource_reservation_sha256',
  }),
});

function createDurableReservationAuthority(db) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  const tokens = new WeakMap();

  async function issue({ operationId, schemaKey }) {
    assertUuid(operationId, 'operationId');
    const schema = SUPPORTED_SCHEMAS[schemaKey];
    if (!schema) throw new TypeError('unsupported reservation schema');
    const row = await db('file_operations').where({ operation_id: operationId }).first();
    if (!row) throw new ProvenanceConflictError('operation does not exist', 'operation_not_found');
    if (row[schema.hashColumn] == null || row[schema.occurredColumn] == null) {
      throw new ProvenanceConflictError('durable fact input is not bound yet', 'reservation_not_bound');
    }
    const reservation = Object.freeze(Object.create(null));
    tokens.set(reservation, Object.freeze({
      operationId,
      schemaKey,
      eventId: row[schema.eventColumn],
    }));
    return reservation;
  }

  async function verify({ reservation, producerId, schemaKey, schemaVersion }) {
    if (producerId !== PRODUCER_ID || schemaVersion !== 1 || !SUPPORTED_SCHEMAS[schemaKey]) {
      throw new ProvenanceConflictError('reservation authority mismatch');
    }
    const token = tokens.get(reservation);
    if (!token || token.schemaKey !== schemaKey) {
      throw new ProvenanceConflictError('unknown reservation');
    }
    const schema = SUPPORTED_SCHEMAS[schemaKey];
    const row = await db('file_operations').where({ operation_id: token.operationId }).first();
    if (
      !row
      || row[schema.eventColumn] !== token.eventId
      || row[schema.hashColumn] == null
      || row[schema.occurredColumn] == null
    ) throw new ProvenanceConflictError('reservation is no longer bound');
    return Object.freeze({
      producerId: PRODUCER_ID,
      schemaKey,
      schemaVersion: 1,
      workspaceId: row.workspace_id,
      operationId: row.operation_id,
      eventId: row[schema.eventColumn],
      occurredAt: row[schema.occurredColumn],
      canonicalHash: row[schema.hashColumn],
    });
  }

  return Object.freeze({ issue, verify });
}

module.exports = { createDurableReservationAuthority };
