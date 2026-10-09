'use strict';

/**
 * @module thread-groups/ids
 * @role Opaque identity minting for the Thread Group domain.
 *
 * `threadGroupId` and `threadId` are different types even when the migration
 * assigns the same legacy string to both (`SPEC-01 §4`). New groups and new
 * sessions receive independently minted opaque host IDs; nothing is ever
 * reconstructed from another identity's string, a title, folder, or path.
 */

const { randomUUID } = require('crypto');

const MAX_GROUP_ID_BYTES = 128;

/** Mint an opaque Thread Group identity that is distinct from any session id. */
function mintThreadGroupId() {
  return `tg-${randomUUID()}`;
}

/**
 * Independently mint one new Main Chat session identity for Move (`SPEC-04 §5`
 * step 3). Filesystem-safe and never derived from another identity.
 */
function mintThreadId() {
  return `th-${randomUUID()}`;
}

/**
 * Stable durable placement key for Move (`CHAT-RD-012`). Distinct from
 * `projectionId`, `surfaceId`, `threadId`, `threadGroupId`, `tabId`, and
 * `componentInstanceId`.
 */
function mintSideChatPlacementId() {
  return `scp-${randomUUID()}`;
}

/**
 * Deterministic component-instance identity for one managed placement. The
 * placement lane key is the authority; the generic descriptor's
 * `componentInstanceId` is derived from it so repeated delivery of the same
 * placement is byte-identical (idempotent) and no transient identity is stored.
 */
function componentInstanceIdForPlacement(sideChatPlacementId) {
  return `chat-side:${sideChatPlacementId}`;
}

/** Validate a bounded opaque group identity without assuming any format. */
function isBoundedGroupId(value) {
  return typeof value === 'string'
    && value.length > 0
    && Buffer.byteLength(value, 'utf8') <= MAX_GROUP_ID_BYTES;
}

module.exports = {
  MAX_GROUP_ID_BYTES,
  componentInstanceIdForPlacement,
  isBoundedGroupId,
  mintSideChatPlacementId,
  mintThreadGroupId,
  mintThreadId,
};
