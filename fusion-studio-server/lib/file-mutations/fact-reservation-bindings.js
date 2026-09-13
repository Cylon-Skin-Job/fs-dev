'use strict';

const { sha256CanonicalJson } = require('../event-registry/canonical-json');
const { assertBoundedString, assertNonemptyBoundedString } = require('./provenance-values');
const {
  reportedUiContextFromRow,
  sanitizeReportedUiContext,
} = require('./reported-ui-context');

const PRODUCER_ID = 'system.file-save-controller';
const SAVE_REASONS = new Set(['autosave', 'manual', 'session_end', 'checkpoint', 'milestone']);

function omitUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function originFromInput(origin, serverWorkspaceId, onDiagnostic = () => {}) {
  if (!origin || typeof origin !== 'object' || Array.isArray(origin)) throw new TypeError('origin is required');
  if (origin.kind !== 'local_client' || origin.assurance !== 'transport_only') {
    throw new TypeError('origin must truthfully identify the transport-only local client');
  }
  const connectionId = assertNonemptyBoundedString(origin.connectionId, 128, 'origin.connectionId');
  // Provenance context is observational, never authorization: sanitize it
  // fail-open so a malformed/oversized/stale renderer echo can never gate a
  // valid save (Metadata Must Not Gate Valid Work).
  const { context: reportedUiContext, diagnostic } = sanitizeReportedUiContext(
    origin.reportedUiContext,
    serverWorkspaceId,
  );
  if (diagnostic) {
    try { onDiagnostic(diagnostic); } catch (_error) {}
  }
  return Object.freeze(omitUndefined({
    kind: 'local_client', connectionId, assurance: 'transport_only', reportedUiContext,
  }));
}

function intentFromInput(input) {
  if (input.saveReason != null && !SAVE_REASONS.has(input.saveReason)) throw new TypeError('invalid saveReason');
  const milestone = input.milestone == null
    ? undefined
    : assertBoundedString(input.milestone, 256, 'milestone');
  if (milestone != null && input.saveReason !== 'milestone') {
    throw new TypeError('milestone requires milestone saveReason');
  }
  if (input.saveReason === 'milestone' && milestone == null) {
    throw new TypeError('milestone saveReason requires milestone');
  }
  return omitUndefined({
    kind: 'save',
    saveReason: input.saveReason,
    milestone,
    clientActionId: input.clientActionId == null
      ? undefined
      : assertNonemptyBoundedString(input.clientActionId, 128, 'clientActionId'),
  });
}

function commandBody(input, ids, resourceId, origin, intent) {
  return {
    commandId: ids.commandId,
    origin,
    resource: {
      resourceId,
      kind: 'file',
      path: input.canonicalPath,
      access: { panel: input.ingressPanel, path: input.ingressPath },
    },
    intent,
  };
}

function resourceBody(row) {
  const reportedUiContext = reportedUiContextFromRow(row);
  return {
    commandId: row.command_id,
    commandAcceptedEventId: row.command_accepted_event_id,
    origin: omitUndefined({
      kind: row.origin_kind,
      connectionId: row.origin_connection_id,
      assurance: row.origin_assurance,
      reportedUiContext,
    }),
    resource: {
      resourceId: row.resource_id,
      kind: 'file',
      path: row.canonical_path,
      access: { panel: row.ingress_panel, path: row.ingress_path },
    },
    mutation: omitUndefined({
      kind: row.mutation_kind,
      saveReason: row.save_reason ?? undefined,
      milestone: row.milestone ?? undefined,
    }),
    fileVersionId: row.file_version_id,
  };
}

function commandBodyFromRow(row) {
  return commandBody({
    canonicalPath: row.canonical_path,
    ingressPanel: row.ingress_panel,
    ingressPath: row.ingress_path,
  }, { commandId: row.command_id }, row.resource_id, omitUndefined({
    kind: row.origin_kind,
    connectionId: row.origin_connection_id,
    assurance: row.origin_assurance,
    reportedUiContext: reportedUiContextFromRow(row),
  }), omitUndefined({
    kind: 'save',
    saveReason: row.save_reason ?? undefined,
    milestone: row.milestone ?? undefined,
    clientActionId: row.client_action_id ?? undefined,
  }));
}

function durableHash({ schemaKey, eventId, occurredAt, workspaceId, operationId, body }) {
  return sha256CanonicalJson({
    producerId: PRODUCER_ID,
    schemaKey,
    schemaVersion: 1,
    eventId,
    occurredAt,
    workspaceId,
    operationId,
    body,
  });
}

function requestBindingHash({
  workspaceId,
  requestId,
  ingressPanel,
  ingressPath,
  origin,
  intent,
  intendedAfterSha256,
  intendedAfterByteLength,
}) {
  return sha256CanonicalJson({
    workspaceId,
    requestId,
    ingress: { panel: ingressPanel, path: ingressPath },
    origin,
    intent,
    intendedAfter: {
      sha256: intendedAfterSha256,
      byteLength: intendedAfterByteLength,
    },
  });
}

module.exports = {
  PRODUCER_ID,
  commandBody,
  commandBodyFromRow,
  durableHash,
  intentFromInput,
  originFromInput,
  requestBindingHash,
  resourceBody,
};
