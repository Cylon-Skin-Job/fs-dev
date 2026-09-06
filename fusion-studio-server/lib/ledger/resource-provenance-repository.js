'use strict';

const path = require('path');
const { canonicalizeJson, sha256CanonicalJson } = require('../event-registry/canonical-json');
const { resourceBody } = require('../file-mutations/fact-reservation-bindings');
const { runBoundedSqliteRetry } = require('../file-mutations/sqlite-contention');
const {
  ProvenanceConflictError,
  assertNonemptyBoundedString,
  assertTimestamp,
  assertUuid,
  normalizeCanonicalPath,
  normalizeFolderPrefix,
} = require('../file-mutations/provenance-values');

function validateFact(fact) {
  if (!fact || typeof fact !== 'object' || Array.isArray(fact)) throw new TypeError('fact is required');
  if (fact.eventType !== 'resource.mutated' || fact.schemaVersion !== 1) {
    throw new TypeError('only resource.mutated@1 is supported');
  }
  assertUuid(fact.eventId, 'eventId');
  assertTimestamp(fact.occurredAt, 'occurredAt');
  assertNonemptyBoundedString(fact.workspaceId, 128, 'workspaceId');
  assertUuid(fact.operationId, 'operationId');
  assertUuid(fact.commandId, 'commandId');
  assertUuid(fact.commandAcceptedEventId, 'commandAcceptedEventId');
  assertUuid(fact.resource?.resourceId, 'resourceId');
  assertUuid(fact.fileVersionId, 'fileVersionId');
  normalizeCanonicalPath(fact.resource?.path);
  if (!['create', 'modify'].includes(fact.mutation?.kind)) throw new TypeError('invalid mutation kind');
  if (
    fact.origin?.kind !== 'local_client'
    || fact.origin?.assurance !== 'transport_only'
  ) throw new TypeError('invalid origin');
  assertNonemptyBoundedString(fact.origin.connectionId, 128, 'origin.connectionId');
  assertNonemptyBoundedString(fact.resource?.access?.panel, 128, 'resource.access.panel');
  normalizeCanonicalPath(fact.resource?.access?.path, 'resource.access.path');
}

function rowMatchesFact(operation, fact) {
  const {
    eventId: _eventId,
    eventType: _eventType,
    schemaVersion: _schemaVersion,
    occurredAt: _occurredAt,
    workspaceId: _workspaceId,
    operationId: _operationId,
    ...body
  } = fact;
  return operation.state === 'succeeded'
    && operation.workspace_id === fact.workspaceId
    && operation.operation_id === fact.operationId
    && operation.command_id === fact.commandId
    && operation.command_accepted_event_id === fact.commandAcceptedEventId
    && operation.resource_event_id === fact.eventId
    && operation.resource_id === fact.resource.resourceId
    && operation.file_version_id === fact.fileVersionId
    && operation.resource_occurred_at === fact.occurredAt
    && operation.mutation_kind === fact.mutation.kind
    && operation.canonical_path === fact.resource.path
    && operation.ingress_panel === fact.resource.access.panel
    && operation.ingress_path === fact.resource.access.path
    && operation.origin_kind === fact.origin.kind
    && operation.origin_connection_id === fact.origin.connectionId
    && operation.origin_assurance === fact.origin.assurance
    && canonicalizeJson(resourceBody(operation)) === canonicalizeJson(body);
}

function mapQueryRow(row) {
  const snapshot = row.preimage_kind === 'absent'
    ? Object.freeze({ kind: 'absent', byteLength: 0, capturedAt: row.captured_at })
    : Object.freeze({
      kind: 'bytes',
      sha256: row.sha256,
      byteLength: row.byte_length,
      capturedAt: row.captured_at,
    });
  return Object.freeze({
    eventId: row.event_id,
    eventType: 'resource.mutated',
    occurredAt: row.occurred_at,
    acceptedAt: row.accepted_at,
    operationId: row.operation_id,
    commandId: row.command_id,
    commandAcceptedEventId: row.command_accepted_event_id,
    resourceId: row.resource_id,
    fileVersionId: row.file_version_id,
    mutationKind: row.mutation_kind,
    canonicalPath: row.canonical_path,
    ingress: Object.freeze({ panel: row.ingress_panel, path: row.ingress_path }),
    origin: Object.freeze({
      kind: row.origin_kind,
      assurance: row.origin_assurance,
      connectionId: row.origin_connection_id,
    }),
    snapshot,
  });
}

function createResourceProvenanceRepository(db) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');

  async function appendResourceFact(fact, { projectedAt = Date.now() } = {}) {
    validateFact(fact);
    assertTimestamp(projectedAt, 'projectedAt');
    const canonicalPayload = canonicalizeJson(fact);
    const payloadSha256 = sha256CanonicalJson(fact);
    const appendOnce = () => db.transaction(async (trx) => {
      const operation = await trx('file_operations').where({ operation_id: fact.operationId }).first();
      if (!operation || !rowMatchesFact(operation, fact)) {
        throw new ProvenanceConflictError('resource fact does not match its durable operation');
      }
      const existing = await trx('event_log').where({ event_id: fact.eventId }).first();
      if (existing) {
        const provenance = await trx('resource_provenance_events').where({ event_id: fact.eventId }).first();
        if (provenance?.payload_sha256 === payloadSha256 && provenance.operation_id === fact.operationId) {
          await trx('file_operations').where({
            operation_id: fact.operationId,
            ledger_projection_state: 'pending',
          }).update({
            ledger_projection_state: 'stored',
            updated_at: trx.raw('MAX(updated_at, ?)', [projectedAt]),
          });
          return Object.freeze({ status: 'duplicate', eventId: fact.eventId });
        }
        await trx('file_operations').where({ operation_id: fact.operationId }).update({
          ledger_projection_state: 'conflict',
          updated_at: trx.raw('MAX(updated_at, ?)', [projectedAt]),
        });
        return Object.freeze({ status: 'conflict', eventId: fact.eventId });
      }

      const fileName = path.posix.basename(operation.canonical_path);
      const folderPath = path.posix.dirname(operation.canonical_path) === '.'
        ? ''
        : path.posix.dirname(operation.canonical_path);
      await trx('event_log').insert({
        event_id: fact.eventId,
        event_type: 'resource.mutated',
        workspace_id: fact.workspaceId,
        machine_id: null,
        machine_name: null,
        actor_type: 'local_client',
        actor_id: fact.origin.connectionId,
        occurred_at: fact.occurredAt,
        summary: `${fact.mutation.kind} file: ${fact.resource.path}`,
        payload_json: canonicalPayload,
        source_module: 'file-save-controller',
        correlation_id: fact.operationId,
        causation_id: null,
        created_at: projectedAt,
      });
      await trx('event_resource_edges').insert({
        event_id: fact.eventId,
        resource_type: 'file',
        resource_id: fact.resource.resourceId,
        workspace_id: fact.workspaceId,
        machine_id: null,
        path: fact.resource.path,
        role: 'subject',
      });
      await trx('resource_provenance_events').insert({
        event_id: fact.eventId,
        payload_sha256: payloadSha256,
        workspace_id: fact.workspaceId,
        occurred_at: fact.occurredAt,
        accepted_at: operation.accepted_at,
        operation_id: fact.operationId,
        command_id: fact.commandId,
        command_accepted_event_id: fact.commandAcceptedEventId,
        resource_id: fact.resource.resourceId,
        file_version_id: fact.fileVersionId,
        mutation_kind: fact.mutation.kind,
        canonical_path: fact.resource.path,
        file_name: fileName,
        folder_path: folderPath,
        ingress_panel: fact.resource.access.panel,
        ingress_path: fact.resource.access.path,
        origin_kind: fact.origin.kind,
        origin_connection_id: fact.origin.connectionId,
        origin_assurance: fact.origin.assurance,
      });
      await trx('file_operations').where({ operation_id: fact.operationId }).update({
        ledger_projection_state: 'stored',
        updated_at: trx.raw('MAX(updated_at, ?)', [projectedAt]),
      });
      return Object.freeze({ status: 'stored', eventId: fact.eventId });
    });
    return runBoundedSqliteRetry(appendOnce, {
      retryUnique: true,
      exhaustionCode: 'ledger_append_contention',
      exhaustionMessage: 'ledger append contention did not settle',
    });
  }

  async function query(options) {
    const workspaceId = assertNonemptyBoundedString(options.workspaceId, 128, 'workspaceId');
    const limit = options.limit == null ? 50 : options.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new TypeError('limit must be 1 through 200');
    let builder = db('resource_provenance_events as provenance')
      .join('file_versions as version', 'version.file_version_id', 'provenance.file_version_id')
      .select(
        'provenance.*',
        'version.preimage_kind',
        'version.sha256',
        'version.byte_length',
        'version.captured_at',
      )
      .where('provenance.workspace_id', workspaceId);
    if (options.canonicalPath != null) {
      builder = builder.where('provenance.canonical_path', normalizeCanonicalPath(options.canonicalPath));
    }
    if (options.fileName != null) {
      const fileName = assertNonemptyBoundedString(options.fileName, 255, 'fileName');
      if (
        fileName === '.'
        || fileName === '..'
        || fileName.includes('/')
        || fileName.includes('\\')
        || path.posix.basename(fileName) !== fileName
      ) {
        throw new TypeError('fileName must be a normalized basename');
      }
      builder = builder.where('provenance.file_name', fileName);
    }
    if (options.folderPrefix != null) {
      const prefix = normalizeFolderPrefix(options.folderPrefix);
      if (prefix !== '') {
        builder = builder.where((nested) => nested
          .where('provenance.folder_path', prefix)
          .orWhereRaw(
            'substr(provenance.folder_path, 1, length(?)) = ? AND substr(provenance.folder_path, length(?) + 1, 1) = ?',
            [prefix, prefix, prefix, '/'],
          ));
      }
    }
    if (options.operationId != null) {
      builder = builder.where('provenance.operation_id', assertUuid(options.operationId, 'operationId'));
    }
    if (options.since != null) {
      builder = builder.where('provenance.occurred_at', '>=', assertTimestamp(options.since, 'since'));
    }
    const rows = await builder
      .orderBy('provenance.occurred_at', 'desc')
      .orderBy('provenance.event_id', 'asc')
      .limit(limit);
    return Object.freeze(rows.map(mapQueryRow));
  }

  return Object.freeze({ appendResourceFact, query });
}

module.exports = { createResourceProvenanceRepository };
