'use strict';

const { sha256CanonicalJson } = require('../event-registry/canonical-json');
const { assertBoundedString, assertNonemptyBoundedString } = require('./provenance-values');

const PRODUCER_ID = 'system.file-save-controller';
const SAVE_REASONS = new Set(['autosave', 'manual', 'session_end', 'checkpoint', 'milestone']);

function omitUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function originFromInput(origin) {
  if (!origin || typeof origin !== 'object' || Array.isArray(origin)) throw new TypeError('origin is required');
  if (origin.kind !== 'local_client' || origin.assurance !== 'transport_only') {
    throw new TypeError('origin must truthfully identify the transport-only local client');
  }
  const connectionId = assertNonemptyBoundedString(origin.connectionId, 128, 'origin.connectionId');
  let reportedUiContext;
  if (origin.reportedUiContext != null) {
    const context = origin.reportedUiContext;
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      throw new TypeError('reportedUiContext must be an object');
    }
    const allowed = new Set(['viewId', 'viewInstanceId']);
    if (Object.keys(context).some((key) => !allowed.has(key))) {
      throw new TypeError('reportedUiContext contains an unknown field');
    }
    reportedUiContext = omitUndefined({
      viewId: context.viewId == null ? undefined : assertNonemptyBoundedString(context.viewId, 128, 'viewId'),
      viewInstanceId: context.viewInstanceId == null
        ? undefined
        : assertNonemptyBoundedString(context.viewInstanceId, 128, 'viewInstanceId'),
    });
    if (Object.keys(reportedUiContext).length === 0) reportedUiContext = undefined;
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
  const reportedUiContext = omitUndefined({
    viewId: row.reported_view_id ?? undefined,
    viewInstanceId: row.reported_view_instance_id ?? undefined,
  });
  return {
    commandId: row.command_id,
    commandAcceptedEventId: row.command_accepted_event_id,
    origin: omitUndefined({
      kind: row.origin_kind,
      connectionId: row.origin_connection_id,
      assurance: row.origin_assurance,
      reportedUiContext: Object.keys(reportedUiContext).length ? reportedUiContext : undefined,
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
    reportedUiContext: row.reported_view_id || row.reported_view_instance_id
      ? omitUndefined({
        viewId: row.reported_view_id ?? undefined,
        viewInstanceId: row.reported_view_instance_id ?? undefined,
      })
      : undefined,
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
