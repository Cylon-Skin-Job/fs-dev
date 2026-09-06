'use strict';

const crypto = require('crypto');
const { createFileVersionRepository, MAX_SNAPSHOT_BYTES } = require('./file-version-repository');
const { createStableResourceRepository } = require('./stable-resource-repository');
const {
  PRODUCER_ID,
  commandBody,
  commandBodyFromRow,
  durableHash,
  intentFromInput,
  originFromInput,
  requestBindingHash,
  resourceBody,
} = require('./fact-reservation-bindings');
const { runBoundedSqliteRetry } = require('./sqlite-contention');
const {
  ProvenanceConflictError,
  assertNonemptyBoundedString,
  assertSha256,
  assertTimestamp,
  assertUuid,
  normalizeCanonicalPath,
  normalizeFingerprint,
} = require('./provenance-values');

const FAILURE_CODES = new Set([
  'snapshot_failed', 'unsupported_preimage', 'preimage_too_large', 'preimage_conflict',
  'write_prepare_failed', 'replace_failed', 'permission_denied',
  'interrupted_before_prepare', 'mutation_outcome_unknown',
]);
const PREPARE_FAILURE_CODES = new Set([
  'snapshot_failed', 'unsupported_preimage', 'preimage_too_large',
  'permission_denied', 'interrupted_before_prepare',
]);
const REPLACE_FAILURE_CODES = new Set([
  'preimage_conflict', 'write_prepare_failed', 'replace_failed', 'permission_denied',
]);

function parseTerminalResponse(value) {
  if (value == null) return null;
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ProvenanceConflictError('terminal response is corrupt');
  }
  if (Array.isArray(parsed.warningCodes)) Object.freeze(parsed.warningCodes);
  return Object.freeze(parsed);
}

function mapOperation(row, { idempotentReplay = false } = {}) {
  if (!row) return null;
  return Object.freeze({
    operationId: row.operation_id,
    workspaceId: row.workspace_id,
    requestId: row.request_id,
    commandId: row.command_id,
    commandAcceptedEventId: row.command_accepted_event_id,
    resourceEventId: row.resource_event_id,
    resourceId: row.resource_id,
    fileVersionId: row.file_version_id,
    canonicalPath: row.canonical_path,
    ingress: Object.freeze({ panel: row.ingress_panel, path: row.ingress_path }),
    mutationKind: row.mutation_kind,
    state: row.state,
    origin: Object.freeze({
      kind: row.origin_kind,
      connectionId: row.origin_connection_id,
      assurance: row.origin_assurance,
      reportedUiContext: row.reported_view_id || row.reported_view_instance_id
        ? Object.freeze({
          ...(row.reported_view_id ? { viewId: row.reported_view_id } : {}),
          ...(row.reported_view_instance_id ? { viewInstanceId: row.reported_view_instance_id } : {}),
        })
        : undefined,
    }),
    intent: Object.freeze({
      kind: 'save',
      ...(row.save_reason ? { saveReason: row.save_reason } : {}),
      ...(row.milestone == null ? {} : { milestone: row.milestone }),
      ...(row.client_action_id ? { clientActionId: row.client_action_id } : {}),
    }),
    commandFactAdmissionState: row.command_fact_admission_state,
    factAdmissionState: row.fact_admission_state,
    ledgerProjectionState: row.ledger_projection_state,
    tempCleanupState: row.temp_cleanup_state,
    terminalResponse: parseTerminalResponse(row.terminal_response_json),
    responseSnapshot: row.response_command_fact_state == null ? null : Object.freeze({
      commandFactState: row.response_command_fact_state,
      resourceFactState: row.response_fact_state,
      ledgerState: row.response_ledger_state,
      provenanceState: row.response_provenance_state,
      checkpointState: row.response_checkpoint_state,
      workspaceId: row.response_workspace_id,
      workspaceEpoch: row.response_workspace_epoch,
    }),
    idempotentReplay,
    preimageKind: row.preimage_kind,
    preimageSha256: row.preimage_sha256,
    preimageByteLength: row.preimage_byte_length,
    intendedAfterSha256: row.intended_after_sha256,
    intendedAfterByteLength: row.intended_after_byte_length,
    succeededFingerprint: row.succeeded_fingerprint_dev == null ? null : Object.freeze({
      dev: row.succeeded_fingerprint_dev,
      ino: row.succeeded_fingerprint_ino,
      size: row.succeeded_fingerprint_size,
      birthtimeMs: row.succeeded_fingerprint_birthtime_ms,
    }),
    observedTarget: row.observed_target_state == null ? null : Object.freeze({
      state: row.observed_target_state,
      sha256: row.observed_target_sha256,
      byteLength: row.observed_target_byte_length,
    }),
    requestBindingSha256: row.request_binding_sha256,
    commandReservationSha256: row.command_reservation_sha256,
    resourceReservationSha256: row.resource_reservation_sha256,
    failureCode: row.failure_code,
    acceptedAt: row.accepted_at,
    preparedAt: row.prepared_at,
    attemptedAt: row.attempted_at,
    completedAt: row.completed_at,
    occurredAt: row.resource_occurred_at,
    reconciledAt: row.reconciled_at,
  });
}

function createFileOperationRepository(db, options = {}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  const randomUuid = options.randomUuid || crypto.randomUUID;
  const resources = options.resources || createStableResourceRepository(db, { randomUuid });
  const versions = options.versions || createFileVersionRepository(db);

  function newId(provided, label) {
    return assertUuid(provided || randomUuid(), label);
  }

  async function reserve(input) {
    const workspaceId = assertNonemptyBoundedString(input.workspaceId, 128, 'workspaceId');
    const requestId = assertNonemptyBoundedString(input.requestId, 128, 'requestId');
    const canonicalPath = normalizeCanonicalPath(input.canonicalPath);
    const ingressPanel = assertNonemptyBoundedString(input.ingressPanel, 128, 'ingressPanel');
    const ingressPath = normalizeCanonicalPath(input.ingressPath, 'ingressPath');
    const acceptedAt = assertTimestamp(input.acceptedAt, 'acceptedAt');
    const currentFingerprint = normalizeFingerprint(input.currentFingerprint, { allowNull: true });
    const origin = originFromInput(input.origin);
    const intent = intentFromInput(input);
    const intendedAfterSha256 = assertSha256(input.intendedAfterSha256, 'intendedAfterSha256');
    const intendedAfterByteLength = input.intendedAfterByteLength;
    if (
      !Number.isSafeInteger(intendedAfterByteLength)
      || intendedAfterByteLength < 0
      || intendedAfterByteLength > MAX_SNAPSHOT_BYTES
    ) throw new RangeError('intendedAfterByteLength is outside the MVP limit');
    const requestHash = requestBindingHash({
      workspaceId,
      requestId,
      ingressPanel,
      ingressPath,
      origin,
      intent,
      intendedAfterSha256,
      intendedAfterByteLength,
    });
    const ids = {
      operationId: newId(input.operationId, 'operationId'),
      commandId: newId(input.commandId, 'commandId'),
      commandAcceptedEventId: newId(input.commandAcceptedEventId, 'commandAcceptedEventId'),
      resourceEventId: newId(input.resourceEventId, 'resourceEventId'),
      fileVersionId: newId(input.fileVersionId, 'fileVersionId'),
    };
    const normalizedInput = { ...input, canonicalPath, ingressPanel, ingressPath };

    function validateWinner(winner) {
      if (winner.request_binding_sha256 !== requestHash) {
        throw new ProvenanceConflictError('request identity already has different durable input');
      }
      return mapOperation(winner, { idempotentReplay: true });
    }

    async function reserveOnce() {
      return db.transaction(async (trx) => {
      const prior = await trx('file_operations').where({
        workspace_id: workspaceId,
        origin_connection_id: origin.connectionId,
        request_id: requestId,
      }).first();
      if (prior) return validateWinner(prior);
      const activePathOperation = await trx('file_operations')
        .where({ workspace_id: workspaceId, canonical_path: canonicalPath })
        .whereIn('state', ['accepted', 'prepared'])
        .first();
      if (activePathOperation) {
        throw new ProvenanceConflictError(
          'resource path already has a nonterminal operation',
          'resource_operation_in_progress',
        );
      }
      const reservation = await resources.reserveInTransaction(trx, {
        workspaceId,
        canonicalPath,
        currentFingerprint,
        resourceId: input.resourceId,
        now: acceptedAt,
      });
      const body = commandBody(normalizedInput, ids,
        reservation.resource.resourceId, origin, intent);
      const row = {
        operation_id: ids.operationId,
        workspace_id: workspaceId,
        request_id: requestId,
        command_id: ids.commandId,
        command_accepted_event_id: ids.commandAcceptedEventId,
        resource_event_id: ids.resourceEventId,
        resource_id: reservation.resource.resourceId,
        file_version_id: ids.fileVersionId,
        canonical_path: canonicalPath,
        ingress_panel: ingressPanel,
        ingress_path: ingressPath,
        mutation_kind: currentFingerprint ? 'modify' : 'create',
        state: 'accepted',
        origin_kind: origin.kind,
        origin_connection_id: origin.connectionId,
        origin_assurance: origin.assurance,
        reported_view_id: origin.reportedUiContext?.viewId ?? null,
        reported_view_instance_id: origin.reportedUiContext?.viewInstanceId ?? null,
        save_reason: intent.saveReason ?? null,
        milestone: intent.milestone ?? null,
        client_action_id: intent.clientActionId ?? null,
        intended_after_sha256: intendedAfterSha256,
        intended_after_byte_length: intendedAfterByteLength,
        request_binding_sha256: requestHash,
        command_reservation_sha256: durableHash({
          schemaKey: 'file.command_accepted',
          eventId: ids.commandAcceptedEventId,
          occurredAt: acceptedAt,
          workspaceId,
          operationId: ids.operationId,
          body,
        }),
        accepted_at: acceptedAt,
        updated_at: acceptedAt,
      };
      try {
        await trx('file_operations').insert(row);
      } catch (error) {
        if (!String(error?.message).includes('UNIQUE constraint failed')) throw error;
        const winner = await trx('file_operations').where({
          workspace_id: workspaceId,
          origin_connection_id: origin.connectionId,
          request_id: requestId,
        }).first();
        if (winner) return validateWinner(winner);
        const activeOperation = await trx('file_operations')
          .where({ workspace_id: workspaceId, canonical_path: canonicalPath })
          .whereIn('state', ['accepted', 'prepared'])
          .first();
        if (activeOperation) {
          if (
            activeOperation.origin_connection_id === origin.connectionId
            && activeOperation.request_id === requestId
          ) return validateWinner(activeOperation);
          throw new ProvenanceConflictError(
            'resource path already has a nonterminal operation',
            'resource_operation_in_progress',
          );
        }
        throw error;
      }
      return mapOperation(row);
      });
    }

    return runBoundedSqliteRetry(reserveOnce, {
      retryUnique: true,
      exhaustionCode: 'operation_reservation_contention',
      exhaustionMessage: 'operation reservation contention did not settle',
    });
  }

  async function prepare({ operationId, preimage, intendedAfterSha256, intendedAfterByteLength, preparedAt }) {
    assertUuid(operationId, 'operationId');
    assertSha256(intendedAfterSha256, 'intendedAfterSha256');
    if (!Number.isSafeInteger(intendedAfterByteLength) || intendedAfterByteLength < 0 || intendedAfterByteLength > 10 * 1024 * 1024) {
      throw new RangeError('intendedAfterByteLength is outside the MVP limit');
    }
    assertTimestamp(preparedAt, 'preparedAt');
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row) throw new ProvenanceConflictError('operation does not exist', 'operation_not_found');
      if (row.state !== 'accepted') throw new ProvenanceConflictError('operation is not accepted');
      if (preparedAt < row.updated_at) throw new ProvenanceConflictError('preparedAt would regress operation chronology');
      if (
        intendedAfterSha256 !== row.intended_after_sha256
        || intendedAfterByteLength !== row.intended_after_byte_length
      ) throw new ProvenanceConflictError('prepared content does not match the durable request binding');
      if (
        (row.mutation_kind === 'create' && preimage?.kind !== 'absent')
        || (row.mutation_kind === 'modify' && preimage?.kind !== 'bytes')
      ) throw new ProvenanceConflictError('preimage kind does not match the reserved mutation kind');
      const snapshot = await versions.insertInTransaction(trx, {
        fileVersionId: row.file_version_id,
        operationId,
        resourceId: row.resource_id,
        resourceEventId: row.resource_event_id,
        capturedAt: preparedAt,
        preimage,
      });
      await trx('file_operations').where({ operation_id: operationId }).update({
        state: 'prepared',
        preimage_kind: snapshot.kind,
        preimage_sha256: snapshot.kind === 'bytes' ? snapshot.sha256 : null,
        preimage_byte_length: snapshot.byteLength,
        prepared_at: preparedAt,
        updated_at: preparedAt,
      });
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function markAttempted(operationId, attemptedAt) {
    assertUuid(operationId, 'operationId');
    assertTimestamp(attemptedAt, 'attemptedAt');
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row || row.state !== 'prepared' || row.attempted_at != null) {
        throw new ProvenanceConflictError('only an unattempted prepared operation can be attempted');
      }
      if (attemptedAt < row.prepared_at || attemptedAt < row.updated_at) {
        throw new ProvenanceConflictError('attemptedAt would regress operation chronology');
      }
      await trx('file_operations').where({ operation_id: operationId }).update({
        attempted_at: attemptedAt,
        updated_at: attemptedAt,
      });
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function markPreparedBeforeReplaceFailed({ operationId, completedAt }) {
    assertUuid(operationId, 'operationId');
    assertTimestamp(completedAt, 'completedAt');
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row || row.state !== 'prepared') {
        throw new ProvenanceConflictError('only a prepared operation can abort before replacement');
      }
      if (completedAt < row.prepared_at || completedAt < row.updated_at) {
        throw new ProvenanceConflictError('completedAt would regress operation chronology');
      }
      await trx('file_operations').where({ operation_id: operationId }).update({
        state: 'failed',
        failure_code: 'write_prepare_failed',
        completed_at: completedAt,
        updated_at: completedAt,
      });
      if (row.mutation_kind === 'create') {
        await trx('resource_registry')
          .where({ resource_id: row.resource_id, lifecycle_state: 'reserved' })
          .update({
            lifecycle_state: 'tombstoned',
            tombstone_reason: 'create_failed_before_replace',
            tombstoned_at: completedAt,
            updated_at: completedAt,
          });
      }
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function markSucceeded({ operationId, occurredAt, completedAt, fingerprint }) {
    assertUuid(operationId, 'operationId');
    assertTimestamp(occurredAt, 'occurredAt');
    assertTimestamp(completedAt, 'completedAt');
    if (occurredAt > completedAt) throw new TypeError('occurredAt cannot follow completedAt');
    const normalizedFingerprint = normalizeFingerprint(fingerprint);
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row || row.state !== 'prepared') throw new ProvenanceConflictError('only prepared operations can succeed');
      if (row.attempted_at == null) throw new ProvenanceConflictError('operation must be attempted before success');
      if (occurredAt < row.attempted_at || occurredAt < row.updated_at || completedAt < occurredAt) {
        throw new ProvenanceConflictError('success timestamps would regress operation chronology');
      }
      const next = {
        ...row,
        state: 'succeeded',
        resource_occurred_at: occurredAt,
        completed_at: completedAt,
        succeeded_fingerprint_dev: normalizedFingerprint.dev,
        succeeded_fingerprint_ino: normalizedFingerprint.ino,
        succeeded_fingerprint_size: normalizedFingerprint.size,
        succeeded_fingerprint_birthtime_ms: normalizedFingerprint.birthtimeMs,
      };
      const body = resourceBody(next);
      const resourceHash = durableHash({
        schemaKey: 'resource.mutated',
        eventId: row.resource_event_id,
        occurredAt,
        workspaceId: row.workspace_id,
        operationId,
        body,
      });
      await trx('file_operations').where({ operation_id: operationId }).update({
        state: 'succeeded',
        resource_occurred_at: occurredAt,
        resource_reservation_sha256: resourceHash,
        succeeded_fingerprint_dev: normalizedFingerprint.dev,
        succeeded_fingerprint_ino: normalizedFingerprint.ino,
        succeeded_fingerprint_size: normalizedFingerprint.size,
        succeeded_fingerprint_birthtime_ms: normalizedFingerprint.birthtimeMs,
        completed_at: completedAt,
        updated_at: completedAt,
      });
      await trx('resource_registry').where({ resource_id: row.resource_id }).update({
        lifecycle_state: 'live',
        fingerprint_dev: normalizedFingerprint.dev,
        fingerprint_ino: normalizedFingerprint.ino,
        fingerprint_size: normalizedFingerprint.size,
        fingerprint_birthtime_ms: normalizedFingerprint.birthtimeMs,
        tombstone_reason: null,
        tombstoned_at: null,
        updated_at: completedAt,
      });
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function markFailed({ operationId, failureCode, completedAt, reconciledAt = null }) {
    assertUuid(operationId, 'operationId');
    if (!FAILURE_CODES.has(failureCode) || failureCode === 'mutation_outcome_unknown') {
      throw new TypeError('invalid failureCode');
    }
    assertTimestamp(completedAt, 'completedAt');
    if (reconciledAt != null) assertTimestamp(reconciledAt, 'reconciledAt');
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row || !['accepted', 'prepared'].includes(row.state)) {
        throw new ProvenanceConflictError('only nonterminal operations can fail');
      }
      const allowedCodes = row.state === 'accepted' ? PREPARE_FAILURE_CODES : REPLACE_FAILURE_CODES;
      if (!allowedCodes.has(failureCode)) {
        throw new ProvenanceConflictError('failureCode is incompatible with the operation phase');
      }
      if (row.state === 'prepared' && row.attempted_at == null) {
        throw new ProvenanceConflictError('prepared failure requires a recorded mutation attempt');
      }
      const phaseTime = row.attempted_at ?? row.prepared_at ?? row.accepted_at;
      if (completedAt < phaseTime || completedAt < row.updated_at) {
        throw new ProvenanceConflictError('completedAt would regress operation chronology');
      }
      if (reconciledAt != null && reconciledAt < completedAt) {
        throw new ProvenanceConflictError('reconciledAt cannot precede completedAt');
      }
      await trx('file_operations').where({ operation_id: operationId }).update({
        state: 'failed',
        failure_code: failureCode,
        completed_at: completedAt,
        reconciled_at: reconciledAt,
        updated_at: reconciledAt ?? completedAt,
      });
      if (row.mutation_kind === 'create') {
        await trx('resource_registry')
          .where({ resource_id: row.resource_id, lifecycle_state: 'reserved' })
          .update({
            lifecycle_state: 'tombstoned',
            tombstone_reason: 'create_failed_before_replace',
            tombstoned_at: completedAt,
            updated_at: completedAt,
          });
      }
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function markOutcomeUnknown({
    operationId, completedAt, observedTargetState, observedTargetSha256 = null,
    observedTargetByteLength = null, reconciledAt = null,
  }) {
    assertUuid(operationId, 'operationId');
    assertTimestamp(completedAt, 'completedAt');
    if (!['absent', 'bytes', 'unreadable'].includes(observedTargetState)) {
      throw new TypeError('invalid observedTargetState');
    }
    if (observedTargetState === 'bytes') {
      assertSha256(observedTargetSha256, 'observedTargetSha256');
      if (!Number.isSafeInteger(observedTargetByteLength) || observedTargetByteLength < 0) {
        throw new TypeError('observedTargetByteLength is required for bytes');
      }
    } else if (observedTargetSha256 != null || observedTargetByteLength != null) {
      throw new TypeError('non-byte target observation cannot include hash or length');
    }
    if (reconciledAt != null) assertTimestamp(reconciledAt, 'reconciledAt');
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row || row.state !== 'prepared') {
        throw new ProvenanceConflictError('only prepared operations can become outcome unknown');
      }
      const phaseTime = row.attempted_at ?? row.prepared_at;
      if (completedAt < phaseTime || completedAt < row.updated_at) {
        throw new ProvenanceConflictError('completedAt would regress operation chronology');
      }
      if (reconciledAt != null && reconciledAt < completedAt) {
        throw new ProvenanceConflictError('reconciledAt cannot precede completedAt');
      }
      await trx('file_operations').where({ operation_id: operationId }).update({
        state: 'outcome_unknown',
        failure_code: 'mutation_outcome_unknown',
        observed_target_state: observedTargetState,
        observed_target_sha256: observedTargetSha256,
        observed_target_byte_length: observedTargetByteLength,
        completed_at: completedAt,
        reconciled_at: reconciledAt,
        updated_at: reconciledAt ?? completedAt,
      });
      if (row.mutation_kind === 'create') {
        await trx('resource_registry')
          .where({ resource_id: row.resource_id, lifecycle_state: 'reserved' })
          .update({ lifecycle_state: 'outcome_unknown', updated_at: completedAt });
      }
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function setAxis(operationId, column, from, to, now) {
    assertUuid(operationId, 'operationId');
    assertTimestamp(now, 'now');
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row || ![from, to].includes(row[column])) {
        throw new ProvenanceConflictError(`invalid ${column} transition`);
      }
      if (row[column] === to) return mapOperation(row);
      if (now < row.updated_at) throw new ProvenanceConflictError(`${column} timestamp would regress chronology`);
      await trx('file_operations').where({ operation_id: operationId, [column]: from }).update({
        [column]: to,
        updated_at: now,
      });
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function markTempCleanupComplete(operationId, now) {
    return setAxis(operationId, 'temp_cleanup_state', 'pending', 'complete', now);
  }

  async function storeTerminalResponse(operationId, response, now) {
    assertUuid(operationId, 'operationId');
    assertTimestamp(now, 'now');
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new TypeError('terminal response object is required');
    }
    const serialized = JSON.stringify(response);
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row || !['succeeded', 'failed', 'outcome_unknown'].includes(row.state)) {
        throw new ProvenanceConflictError('only terminal operations can store a response');
      }
      if (row.terminal_response_json != null) {
        if (row.terminal_response_json !== serialized) {
          throw new ProvenanceConflictError('terminal response is already bound');
        }
        return mapOperation(row);
      }
      if (now < row.updated_at) throw new ProvenanceConflictError('terminal response timestamp would regress chronology');
      await trx('file_operations').where({ operation_id: operationId }).update({
        terminal_response_json: serialized,
        updated_at: now,
      });
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function storeResponseSnapshot(operationId, response, now) {
    assertUuid(operationId, 'operationId');
    assertTimestamp(now, 'now');
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new TypeError('terminal response object is required');
    }
    const responseWorkspaceId = assertNonemptyBoundedString(response.workspaceId, 128, 'response.workspaceId');
    const responseWorkspaceEpoch = assertUuid(response.workspaceEpoch, 'response.workspaceEpoch');
    const success = response.outcome === 'succeeded' && response.success === true;
    const terminalFailure = ['failed_before_replace', 'outcome_unknown'].includes(response.outcome)
      && response.success === false;
    if (!success && !terminalFailure) throw new TypeError('terminal response outcome is invalid');
    const snapshot = success ? {
      response_command_fact_state: response.commandFactState,
      response_fact_state: response.resourceFactState,
      response_ledger_state: response.ledgerState,
      response_provenance_state: response.provenanceState,
      response_checkpoint_state: response.checkpointState,
      response_workspace_id: responseWorkspaceId,
      response_workspace_epoch: responseWorkspaceEpoch,
    } : {
      response_command_fact_state: response.commandFactState,
      response_fact_state: 'not_emitted',
      response_ledger_state: 'not_applicable',
      response_provenance_state: null,
      response_checkpoint_state: null,
      response_workspace_id: responseWorkspaceId,
      response_workspace_epoch: responseWorkspaceEpoch,
    };
    return db.transaction(async (trx) => {
      const row = await trx('file_operations').where({ operation_id: operationId }).first();
      if (!row || !['succeeded', 'failed', 'outcome_unknown'].includes(row.state)) {
        throw new ProvenanceConflictError('only terminal operations can store a response snapshot');
      }
      if (row.workspace_id !== responseWorkspaceId) {
        throw new ProvenanceConflictError('terminal response workspace does not match operation');
      }
      if (row.response_command_fact_state != null) {
        if (Object.entries(snapshot).some(([column, value]) => row[column] !== value)) {
          throw new ProvenanceConflictError('terminal response snapshot is already bound');
        }
        return mapOperation(row);
      }
      if (now < row.updated_at) throw new ProvenanceConflictError('response snapshot timestamp would regress chronology');
      await trx('file_operations').where({ operation_id: operationId }).update({
        ...snapshot,
        updated_at: now,
      });
      return mapOperation(await trx('file_operations').where({ operation_id: operationId }).first());
    });
  }

  async function getById(operationId) {
    assertUuid(operationId, 'operationId');
    return mapOperation(await db('file_operations').where({ operation_id: operationId }).first());
  }

  return Object.freeze({
    reserve,
    prepare,
    markAttempted,
    markPreparedBeforeReplaceFailed,
    markSucceeded,
    markFailed,
    markOutcomeUnknown,
    markCommandFactAdmitted: (operationId, now) => setAxis(
      operationId, 'command_fact_admission_state', 'pending', 'admitted', now,
    ),
    markResourceFactAdmitted: (operationId, now) => setAxis(
      operationId, 'fact_admission_state', 'pending', 'admitted', now,
    ),
    markLedgerStored: (operationId, now) => setAxis(
      operationId, 'ledger_projection_state', 'pending', 'stored', now,
    ),
    markLedgerConflict: (operationId, now) => setAxis(
      operationId, 'ledger_projection_state', 'pending', 'conflict', now,
    ),
    markTempCleanupComplete,
    storeResponseSnapshot,
    storeTerminalResponse,
    getById,
    async getCommandFactBody(operationId) {
      assertUuid(operationId, 'operationId');
      const row = await db('file_operations').where({ operation_id: operationId }).first();
      if (!row) return null;
      return Object.freeze(commandBodyFromRow(row));
    },
    async getResourceFactBody(operationId) {
      assertUuid(operationId, 'operationId');
      const row = await db('file_operations').where({ operation_id: operationId }).first();
      if (!row) return null;
      if (row.state !== 'succeeded' || !row.resource_reservation_sha256) {
        throw new ProvenanceConflictError('resource fact input is not durable yet', 'reservation_not_bound');
      }
      return Object.freeze(resourceBody(row));
    },
    async listForReconciliation() {
      const rows = await db('file_operations')
        .where({ command_fact_admission_state: 'pending' })
        .orWhereIn('state', ['accepted', 'prepared'])
        .orWhere((builder) => builder
          .where({ state: 'succeeded' })
          .andWhere((pending) => pending
            .where({ fact_admission_state: 'pending' })
            .orWhere({ ledger_projection_state: 'pending' })))
        .orWhere((builder) => builder
          .whereIn('state', ['failed', 'succeeded', 'outcome_unknown'])
          .andWhere({ temp_cleanup_state: 'pending' }))
        .orderBy('accepted_at', 'asc')
        .orderBy('operation_id', 'asc');
      return Object.freeze(rows.map(mapOperation));
    },
    buildCommandBody(row) {
      const source = row.operation_id ? row : null;
      if (!source) throw new TypeError('durable operation row is required');
      return commandBodyFromRow(source);
    },
    buildResourceBody: resourceBody,
    resources,
    versions,
  });
}

module.exports = {
  PRODUCER_ID,
  createFileOperationRepository,
  durableHash,
};
