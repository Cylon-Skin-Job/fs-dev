'use strict';

/**
 * @module thread-groups/application-link
 * @role Versioned application URI for a Thread Group link (`SPEC-01 §8.2/§9`).
 *
 * Pure functions only. A link carries durable identities only — workspace,
 * immutable view binding (null for Legacy), group, and an optional exact
 * member session. It never carries `surfaceId`, a panel selection, a path, a
 * title, provider state, or any placement identity
 * (`BRIDGE-02-CONFORMANCE-OVERLAY.md` §2/§4.4).
 *
 * Canonical form:
 *   `fusion-thread-group:v1?workspaceId=<id>&threadGroupId=<id>[&viewId=<id>][&threadId=<id>]`
 *
 * The scheme is intentionally opaque/versioned. Unknown versions, unknown
 * query keys, duplicate keys, and malformed/bounded-out values are rejected so
 * a stale or foreign link can never be borrowed as authority.
 */

const MAX_ID_BYTES = 128;
const MAX_URI_BYTES = 2048;
const SCHEME = 'fusion-thread-group';
const VERSION = '1';
const PREFIX = `${SCHEME}:v${VERSION}?`;
const ALLOWED_KEYS = Object.freeze(['workspaceId', 'threadGroupId', 'viewId', 'threadId']);

function isBoundedId(value) {
  return typeof value === 'string'
    && value.length > 0
    && Buffer.byteLength(value, 'utf8') <= MAX_ID_BYTES;
}

/**
 * Build the durable version-1 group URI, or null when an identity is malformed.
 *
 * @param {{ workspaceId: string, threadGroupId: string,
 *           viewId?: string|null, threadId?: string|null }} input
 * @returns {string|null}
 */
function buildGroupLink({
  workspaceId, threadGroupId, viewId = null, threadId = null,
}) {
  if (!isBoundedId(workspaceId) || !isBoundedId(threadGroupId)) return null;
  if (viewId !== null && viewId !== undefined && !isBoundedId(viewId)) return null;
  if (threadId !== null && threadId !== undefined && !isBoundedId(threadId)) return null;

  const raw = [
    ['workspaceId', workspaceId],
    ['threadGroupId', threadGroupId],
    ...(viewId != null ? [['viewId', viewId]] : []),
    ...(threadId != null ? [['threadId', threadId]] : []),
  ];
  const query = raw
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${PREFIX}${query}`;
}

/**
 * Parse and validate a version-1 group URI into durable identities, or null.
 *
 * @param {unknown} uri
 * @returns {{ version: 1, workspaceId: string, threadGroupId: string,
 *             viewId: string|null, threadId: string|null }|null}
 */
function parseGroupLink(uri) {
  if (typeof uri !== 'string' || !uri || Buffer.byteLength(uri, 'utf8') > MAX_URI_BYTES) {
    return null;
  }
  if (!uri.startsWith(PREFIX)) return null;

  const params = new URLSearchParams(uri.slice(PREFIX.length));
  const keys = [...params.keys()];
  if (keys.length === 0) return null;
  for (const key of keys) {
    // Unknown keys (including any transient `surfaceId`) invalidate the link.
    if (!ALLOWED_KEYS.includes(key)) return null;
    // A duplicated key is ambiguous and rejected.
    if (params.getAll(key).length !== 1) return null;
  }

  const workspaceId = params.get('workspaceId');
  const threadGroupId = params.get('threadGroupId');
  const viewId = params.get('viewId');
  const threadId = params.get('threadId');

  if (!isBoundedId(workspaceId) || !isBoundedId(threadGroupId)) return null;
  if (viewId !== null && !isBoundedId(viewId)) return null;
  if (threadId !== null && !isBoundedId(threadId)) return null;

  return Object.freeze({
    version: 1,
    workspaceId,
    threadGroupId,
    viewId: viewId ?? null,
    threadId: threadId ?? null,
  });
}

module.exports = {
  MAX_ID_BYTES,
  MAX_URI_BYTES,
  VERSION,
  buildGroupLink,
  isBoundedId,
  parseGroupLink,
};
