'use strict';

const { parseRelocationErrorCode, ViewRelocationError } = require('./relocation-errors');
const { parseMachineIdentity, parseWorkspaceId } = require('./relocation-identity');

const TABLE = 'view_capsule_relocations';

function parseTimestamp(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('timestamp is invalid');
  return value;
}

function parseDecimalIdentity(value) {
  const text = String(value);
  if (!/^(?:0|[1-9][0-9]{0,19})$/u.test(text)) {
    throw new TypeError('filesystem identity is invalid');
  }
  return text;
}

function parseDigest(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError('digest is invalid');
  }
  return value;
}

function createViewRelocationJournal({ db, now = Date.now } = {}) {
  if (typeof db !== 'function' || typeof now !== 'function') {
    throw new TypeError('view relocation journal dependencies are required');
  }

  function identity(where) {
    return {
      workspace_id: parseWorkspaceId(where.workspaceId),
      machine_identity: parseMachineIdentity(where.machineIdentity),
    };
  }

  async function get(where) {
    return db(TABLE).where(identity(where)).first();
  }

  async function createPlanned(input) {
    const timestamp = parseTimestamp(now());
    const row = {
      ...identity(input),
      source_root_identity_sha256: parseDigest(input.sourceRootIdentity),
      destination_root_identity_sha256: parseDigest(input.destinationRootIdentity),
      directory_device: parseDecimalIdentity(input.directoryDevice),
      directory_inode: parseDecimalIdentity(input.directoryInode),
      inventory_sha256: parseDigest(input.inventoryDigest),
      status: 'planned',
      error_code: null,
      created_at: timestamp,
      updated_at: timestamp,
      completed_at: null,
    };
    try {
      await db(TABLE).insert(row);
    } catch (_error) {
      throw new ViewRelocationError('journal_conflict');
    }
    return row;
  }

  async function createVerified(input) {
    const timestamp = parseTimestamp(now());
    const row = {
      ...identity(input),
      source_root_identity_sha256: parseDigest(input.sourceRootIdentity),
      destination_root_identity_sha256: parseDigest(input.destinationRootIdentity),
      directory_device: parseDecimalIdentity(input.directoryDevice),
      directory_inode: parseDecimalIdentity(input.directoryInode),
      inventory_sha256: parseDigest(input.inventoryDigest),
      status: 'verified',
      error_code: null,
      created_at: timestamp,
      updated_at: timestamp,
      completed_at: timestamp,
    };
    try {
      await db(TABLE).insert(row);
    } catch (_error) {
      throw new ViewRelocationError('journal_conflict');
    }
    return row;
  }

  async function transition(where, expectedStatus, nextStatus) {
    if (!['planned', 'moved'].includes(expectedStatus) || !['moved', 'verified'].includes(nextStatus)) {
      throw new TypeError('journal transition is invalid');
    }
    const timestamp = parseTimestamp(now());
    const patch = {
      status: nextStatus,
      updated_at: timestamp,
      completed_at: nextStatus === 'verified' ? timestamp : null,
    };
    const updated = await db(TABLE)
      .where({ ...identity(where), status: expectedStatus })
      .update(patch);
    if (updated !== 1) throw new ViewRelocationError('journal_conflict');
    return get(where);
  }

  async function fail(where, errorCode) {
    const timestamp = parseTimestamp(now());
    const code = parseRelocationErrorCode(errorCode);
    const updated = await db(TABLE)
      .where(identity(where))
      .whereIn('status', ['planned', 'moved'])
      .update({
        status: 'failed',
        error_code: code,
        updated_at: timestamp,
        completed_at: timestamp,
      });
    if (updated !== 1) {
      const row = await get(where);
      if (!row || row.status !== 'failed') throw new ViewRelocationError('journal_conflict');
    }
    return get(where);
  }

  return Object.freeze({ createPlanned, createVerified, fail, get, transition });
}

module.exports = {
  TABLE,
  createViewRelocationJournal,
  parseDecimalIdentity,
  parseDigest,
};
