'use strict';

/**
 * @module thread-groups/action-identity
 * @role Canonical action target hashing and durable `ChatActionContext`
 *       sanitization for the canonical `thread:action` family (slice 01B).
 *
 * Pure functions only. No persistence, WebSocket, or manager dependency.
 * `surfaceId` is never accepted, derived, stored, echoed, or fanned out
 * (`BRIDGE-02-CONFORMANCE-OVERLAY.md` §2/§4.2/§4.5).
 */

const { createHash } = require('crypto');

const MAX_ID_BYTES = 128;
const MAX_TARGET_KEY_BYTES = 512;

/**
 * Durable `ChatActionContext` fields a component-backed host may supply.
 * `viewId`, `threadGroupId`, and `threadId` are server-derived; any client echo
 * is validated against the resolved authority and otherwise replaced.
 */
const COMPONENT_CONTEXT_FIELDS = Object.freeze([
  Object.freeze(['tabId', MAX_ID_BYTES]),
  Object.freeze(['componentInstanceId', MAX_ID_BYTES]),
  Object.freeze(['componentTypeId', MAX_ID_BYTES]),
  Object.freeze(['presenterId', MAX_ID_BYTES]),
  Object.freeze(['targetKey', MAX_TARGET_KEY_BYTES]),
]);

function scalarWithin(value, maxBytes) {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  if (Buffer.byteLength(value, 'utf8') > maxBytes) return undefined;
  return value;
}

/**
 * Deterministic canonical hash of the inputs that decide an action's result.
 * Same request/same input replays the stored result; different input under the
 * same requestId is `request_mismatch`.
 *
 * Slice 01C extends the hashed inputs to every action's deciding payload:
 * `rename` title, `resolve_link` URI, and the `set_harness_selection`
 * model/variant pair. Group/member scope is always hashed so a request cannot
 * be replayed against a different group or member.
 *
 * @param {{ action: string, threadGroupId?: string|null, threadId?: string|null,
 *           name?: string|null, uri?: string|null, model?: string|null,
 *           variant?: string|null }} input
 * @returns {string} lowercase hex sha256 (64 bytes, within the persisted cap)
 */
function canonicalTargetHash({
  action, threadGroupId = null, threadId = null,
  name = null, uri = null, model = null, variant = null,
}) {
  const payload = { action, threadGroupId, threadId };
  if (action === 'rename') payload.name = name;
  if (action === 'resolve_link' && uri) payload.uri = uri;
  if (action === 'set_harness_selection') {
    payload.model = model;
    payload.variant = variant;
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Build the durable action envelope from server-derived identities plus any
 * well-formed component context that a component-backed host supplied. Missing
 * or malformed context is fail-open: the base durable identities still ship and
 * never gate the action.
 *
 * @param {{ workspaceId: string, viewId: string|null, threadGroupId: string|null,
 *           threadId: string|null, componentContext?: object|null }} input
 * @returns {object}
 */
function buildDurableActionContext({
  workspaceId, viewId = null, threadGroupId = null, threadId = null, componentContext = null,
}) {
  const context = {
    workspaceId,
    viewId: viewId ?? null,
    threadGroupId: threadGroupId ?? null,
    threadId: threadId ?? null,
  };
  if (componentContext && typeof componentContext === 'object' && !Array.isArray(componentContext)) {
    for (const [name, maxBytes] of COMPONENT_CONTEXT_FIELDS) {
      const value = scalarWithin(componentContext[name], maxBytes);
      if (value !== undefined) context[name] = value;
    }
  }
  return Object.freeze(context);
}

module.exports = {
  buildDurableActionContext,
  canonicalTargetHash,
};
