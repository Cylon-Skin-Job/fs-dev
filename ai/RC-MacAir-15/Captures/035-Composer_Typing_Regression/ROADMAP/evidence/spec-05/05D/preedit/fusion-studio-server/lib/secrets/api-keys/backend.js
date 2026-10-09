/**
 * API keys backend — coordinates keychain (values) and secrets_index (metadata).
 *
 * One job: provide a clean four-method API for Layer 2 (WS handlers) to call.
 * No WS handling, no event emission, no DOM. Pure data access + validation +
 * cross-store atomicity.
 * See SECRETS_MANAGER_SPEC.md §6, §7a, §7b, §11b, §11c.
 */

const secrets = require('../../secrets');
const fingerprint = require('./fingerprint');
const indexTable = require('./index-table');

const MIN_VALUE_LENGTH = 8;
const MAX_DESCRIPTION_LENGTH = 150;

class ApiKeysBackendError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiKeysBackendError';
    this.code = code;
  }
}
ApiKeysBackendError.INVALID_NAME = 'INVALID_NAME';
ApiKeysBackendError.INVALID_VALUE = 'INVALID_VALUE';
ApiKeysBackendError.DUPLICATE = 'DUPLICATE';
ApiKeysBackendError.NOT_FOUND = 'NOT_FOUND';
ApiKeysBackendError.BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE';

function validateName(name) {
  if (typeof name !== 'string' || !secrets.KEY_PATTERN.test(name)) {
    throw new ApiKeysBackendError(
      ApiKeysBackendError.INVALID_NAME,
      `Name "${name}" must match ${secrets.KEY_PATTERN}`
    );
  }
}

function validateValue(value) {
  if (typeof value !== 'string' || value.length < MIN_VALUE_LENGTH) {
    throw new ApiKeysBackendError(
      ApiKeysBackendError.INVALID_VALUE,
      `Value must be a string of length >= ${MIN_VALUE_LENGTH}`
    );
  }
}

function validateDescription(description) {
  if (description == null) return;
  if (typeof description === 'string' && description.length <= MAX_DESCRIPTION_LENGTH) return;
  throw new ApiKeysBackendError(
    ApiKeysBackendError.INVALID_VALUE,
    `description must be ≤ ${MAX_DESCRIPTION_LENGTH} characters`
  );
}

async function withRollback(name, indexOp, rollback, label) {
  try {
    await indexOp();
  } catch (err) {
    try {
      await rollback();
    } catch (rollbackErr) {
      console.error(
        `[api-keys] CRITICAL: keychain rollback failed for "${name}" after ${label}.`,
        { primaryError: err, rollbackError: rollbackErr }
      );
      throw new ApiKeysBackendError(
        ApiKeysBackendError.BACKEND_UNAVAILABLE,
        `Inconsistent state for "${name}": ${label} and rollback also failed`
      );
    }
    throw err;
  }
}

async function list() {
  return indexTable.list();
}

async function add({ name, value, description = null, expires_at = null }) {
  validateName(name);
  validateValue(value);
  validateDescription(description);

  const existing = await indexTable.get(name);
  if (existing) {
    throw new ApiKeysBackendError(
      ApiKeysBackendError.DUPLICATE,
      `Secret "${name}" already exists`
    );
  }

  const now = Date.now();
  const row = {
    name,
    description,
    expires_at,
    fingerprint: fingerprint.compute(value),
    created_at: now,
    updated_at: now,
  };

  await secrets.set(name, value);
  await withRollback(
    name,
    () => indexTable.insert(row),
    () => secrets.del(name),
    'index insert failed'
  );

  return row;
}

async function update(name, { value, description, expires_at } = {}) {
  validateName(name);
  if (description !== undefined) validateDescription(description);

  const existing = await indexTable.get(name);
  if (!existing) {
    throw new ApiKeysBackendError(
      ApiKeysBackendError.NOT_FOUND,
      `Secret "${name}" not found`
    );
  }

  const fields = {};
  const changed_fields = [];

  if (description !== undefined && description !== existing.description) {
    fields.description = description;
    changed_fields.push('description');
  }
  if (expires_at !== undefined && expires_at !== existing.expires_at) {
    fields.expires_at = expires_at;
    changed_fields.push('expires_at');
  }

  let newFingerprint = null;
  let oldKeychainValue = null;

  if (value !== undefined) {
    validateValue(value);
    newFingerprint = fingerprint.compute(value);
    oldKeychainValue = await secrets.get(name);
    await secrets.set(name, value);
    changed_fields.push('value');
    if (newFingerprint !== existing.fingerprint) {
      fields.fingerprint = newFingerprint;
      changed_fields.push('fingerprint');
    }
  }

  if (changed_fields.length === 0) {
    return { row: existing, changed_fields };
  }

  fields.updated_at = Date.now();

  const rollback = (value !== undefined && oldKeychainValue !== null)
    ? () => secrets.set(name, oldKeychainValue)
    : async () => {};

  await withRollback(
    name,
    () => indexTable.update(name, fields),
    rollback,
    'index update failed'
  );

  const row = { ...existing, ...fields };
  return { row, changed_fields };
}

async function remove(name) {
  validateName(name);

  const existing = await indexTable.get(name);
  if (!existing) {
    throw new ApiKeysBackendError(
      ApiKeysBackendError.NOT_FOUND,
      `Secret "${name}" not found`
    );
  }

  const oldKeychainValue = await secrets.get(name);
  await secrets.del(name);

  const rollback = oldKeychainValue !== null
    ? () => secrets.set(name, oldKeychainValue)
    : async () => {};

  await withRollback(
    name,
    () => indexTable.remove(name),
    rollback,
    'index delete failed'
  );

  return true;
}

module.exports = { list, add, update, remove, ApiKeysBackendError };
