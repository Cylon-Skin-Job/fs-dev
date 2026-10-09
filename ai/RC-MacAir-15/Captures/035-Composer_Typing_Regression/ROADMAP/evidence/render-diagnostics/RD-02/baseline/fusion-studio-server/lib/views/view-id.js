'use strict';

const MAX_VIEW_ID_BYTES = 128;
const VIEW_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class ViewIdentityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ViewIdentityError';
    this.code = code;
  }
}

function parseCanonicalViewId(value, context = 'view') {
  if (typeof value !== 'string') {
    throw new ViewIdentityError('view_id_invalid', `${context} has an invalid metadata.view-id`);
  }
  if (
    value.length === 0
    || Buffer.byteLength(value, 'utf8') > MAX_VIEW_ID_BYTES
    || !VIEW_ID_PATTERN.test(value)
  ) {
    throw new ViewIdentityError('view_id_invalid', `${context} has an invalid metadata.view-id`);
  }
  return value;
}

function canonicalViewIdsEqual(left, right) {
  return parseCanonicalViewId(left) === parseCanonicalViewId(right);
}

function assertUniqueCanonicalViewIds(entries, getId = (entry) => entry.id) {
  const seen = new Set();
  for (const entry of entries) {
    const id = parseCanonicalViewId(getId(entry));
    if (seen.has(id)) {
      throw new ViewIdentityError('view_id_duplicate', `Duplicate metadata.view-id: ${id}`);
    }
    seen.add(id);
  }
  return entries;
}

module.exports = {
  MAX_VIEW_ID_BYTES,
  VIEW_ID_PATTERN,
  ViewIdentityError,
  parseCanonicalViewId,
  canonicalViewIdsEqual,
  assertUniqueCanonicalViewIds,
};
