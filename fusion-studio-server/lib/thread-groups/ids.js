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

/** Validate a bounded opaque group identity without assuming any format. */
function isBoundedGroupId(value) {
  return typeof value === 'string'
    && value.length > 0
    && Buffer.byteLength(value, 'utf8') <= MAX_GROUP_ID_BYTES;
}

module.exports = { MAX_GROUP_ID_BYTES, mintThreadGroupId, isBoundedGroupId };
