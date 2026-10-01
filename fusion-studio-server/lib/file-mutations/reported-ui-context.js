'use strict';

/**
 * BRIDGE-01 SPEC-01 §4/§6 — server-side `ComponentActionContext` handling.
 *
 * One job: treat the renderer-supplied `reportedUiContext` as untrusted
 * comparison evidence, bound/sanitize it fail-open, and project the validated
 * context to and from the durable operation row.
 *
 * The server-derived workspace is the only authority. A renderer workspace echo
 * that disagrees, or any malformed/oversized/unknown subtree, never changes the
 * save result: the context is omitted or degraded and a fixed non-canonical
 * diagnostic is reported (Metadata Must Not Gate Valid Work).
 */

const IDENTIFIER_MAX_BYTES = 128;
/** Matches the accepted TABS-03 `COMPONENT_TAB_LIMITS.maxTargetKeyBytes`. */
const TARGET_KEY_MAX_BYTES = 512;

const CONTEXT_FIELDS = Object.freeze([
  Object.freeze(['workspaceId', IDENTIFIER_MAX_BYTES]),
  Object.freeze(['viewId', IDENTIFIER_MAX_BYTES]),
  Object.freeze(['viewInstanceId', IDENTIFIER_MAX_BYTES]),
  Object.freeze(['tabId', IDENTIFIER_MAX_BYTES]),
  Object.freeze(['componentTypeId', IDENTIFIER_MAX_BYTES]),
  Object.freeze(['componentInstanceId', IDENTIFIER_MAX_BYTES]),
  Object.freeze(['presenterId', IDENTIFIER_MAX_BYTES]),
  Object.freeze(['targetKey', TARGET_KEY_MAX_BYTES]),
]);

const KNOWN_FIELDS = new Set(CONTEXT_FIELDS.map(([name]) => name));

/** Fixed non-canonical diagnostics; never registered event/fact codes. */
const REPORTED_UI_CONTEXT_DIAGNOSTICS = Object.freeze({
  omitted: 'reported_ui_context_omitted',
  degraded: 'reported_ui_context_degraded',
  workspaceMismatch: 'reported_ui_context_workspace_mismatch',
});

const ROW_COLUMN_BY_FIELD = Object.freeze({
  viewId: 'reported_view_id',
  viewInstanceId: 'reported_view_instance_id',
  tabId: 'reported_tab_id',
  componentTypeId: 'reported_component_type_id',
  componentInstanceId: 'reported_component_instance_id',
  presenterId: 'reported_presenter_id',
  targetKey: 'reported_target_key',
});

/** Non-empty, well-formed Unicode scalar string within the byte cap. */
function scalarWithin(value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  if (Buffer.byteLength(value, 'utf8') > maxBytes) return undefined;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return undefined;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return undefined;
    }
  }
  return value;
}

function isUsableWorkspaceId(value) {
  return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 128;
}

/**
 * Sanitize a renderer context against the server-derived workspace.
 *
 * @returns {{ context: object|undefined, diagnostic: string|null }}
 */
function sanitizeReportedUiContext(rawContext, serverWorkspaceId) {
  if (rawContext == null) return { context: undefined, diagnostic: null };
  if (typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    return { context: undefined, diagnostic: REPORTED_UI_CONTEXT_DIAGNOSTICS.omitted };
  }
  if (!isUsableWorkspaceId(serverWorkspaceId)) {
    return { context: undefined, diagnostic: REPORTED_UI_CONTEXT_DIAGNOSTICS.omitted };
  }
  const keys = Object.keys(rawContext);
  if (keys.length === 0) return { context: undefined, diagnostic: null };

  let degraded = keys.some((key) => !KNOWN_FIELDS.has(key));
  const bounded = {};
  for (const [name, maxBytes] of CONTEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(rawContext, name)) continue;
    const value = rawContext[name];
    if (value == null) {
      degraded = true;
      continue;
    }
    const scalar = scalarWithin(value, maxBytes);
    if (scalar === undefined) {
      degraded = true;
      continue;
    }
    bounded[name] = scalar;
  }

  if (Object.prototype.hasOwnProperty.call(rawContext, 'workspaceId')) {
    if (bounded.workspaceId === undefined) {
      return { context: undefined, diagnostic: REPORTED_UI_CONTEXT_DIAGNOSTICS.omitted };
    }
    if (bounded.workspaceId !== serverWorkspaceId) {
      return { context: undefined, diagnostic: REPORTED_UI_CONTEXT_DIAGNOSTICS.workspaceMismatch };
    }
  }
  if (bounded.viewId === undefined) {
    return {
      context: undefined,
      diagnostic: degraded
        ? REPORTED_UI_CONTEXT_DIAGNOSTICS.degraded
        : REPORTED_UI_CONTEXT_DIAGNOSTICS.omitted,
    };
  }

  // The persisted context workspace is always the server-derived authority.
  bounded.workspaceId = serverWorkspaceId;
  const context = {};
  for (const [name] of CONTEXT_FIELDS) {
    if (bounded[name] !== undefined) context[name] = bounded[name];
  }
  return {
    context: Object.freeze(context),
    diagnostic: degraded ? REPORTED_UI_CONTEXT_DIAGNOSTICS.degraded : null,
  };
}

/**
 * Strict variant for already-persisted, server-generated fact/origin context.
 * Throws when the context is not exactly the canonical sanitized projection.
 */
function assertCanonicalReportedUiContext(rawContext, serverWorkspaceId) {
  if (rawContext == null) return undefined;
  const { context, diagnostic } = sanitizeReportedUiContext(rawContext, serverWorkspaceId);
  if (diagnostic || !context) throw new TypeError('reportedUiContext is not a canonical context');
  const givenKeys = Object.keys(rawContext).sort();
  const canonicalKeys = Object.keys(context).sort();
  if (givenKeys.length !== canonicalKeys.length
    || givenKeys.some((key, index) => key !== canonicalKeys[index])
    || givenKeys.some((key) => rawContext[key] !== context[key])) {
    throw new TypeError('reportedUiContext is not a canonical context');
  }
  return context;
}

/** Project the durable operation row's context columns into a context object. */
function reportedUiContextFromRow(row) {
  if (!row) return undefined;
  const context = {};
  if (isUsableWorkspaceId(row.workspace_id)) context.workspaceId = row.workspace_id;
  for (const [name, column] of Object.entries(ROW_COLUMN_BY_FIELD)) {
    const value = row[column];
    if (typeof value === 'string' && value.length > 0) context[name] = value;
  }
  return Object.keys(context).length > 1 ? Object.freeze(context) : undefined;
}

/** Project a sanitized context into durable `file_operations` column values. */
function reportedUiContextColumns(context) {
  const columns = {};
  for (const [name, column] of Object.entries(ROW_COLUMN_BY_FIELD)) {
    const value = context?.[name];
    columns[column] = typeof value === 'string' && value.length > 0 ? value : null;
  }
  return columns;
}

module.exports = {
  REPORTED_UI_CONTEXT_DIAGNOSTICS,
  assertCanonicalReportedUiContext,
  reportedUiContextColumns,
  reportedUiContextFromRow,
  sanitizeReportedUiContext,
};
