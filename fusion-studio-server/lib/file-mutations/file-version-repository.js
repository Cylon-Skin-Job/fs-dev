'use strict';

const crypto = require('crypto');
const { MAX_SNAPSHOT_BYTES } = require('../db/migrations/035_file_provenance');
const {
  ProvenanceConflictError,
  assertTimestamp,
  assertUuid,
} = require('./provenance-values');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function normalizePreimage(preimage) {
  if (!preimage || typeof preimage !== 'object' || Array.isArray(preimage)) {
    throw new TypeError('preimage must be an object');
  }
  if (preimage.kind === 'absent') {
    if (Object.keys(preimage).some((key) => !['kind'].includes(key))) {
      throw new TypeError('absent preimage cannot include bytes or metadata');
    }
    return Object.freeze({ kind: 'absent', bytes: null, sha256: null, byteLength: 0, encoding: null });
  }
  if (preimage.kind !== 'bytes' || !Buffer.isBuffer(preimage.bytes)) {
    throw new TypeError('bytes preimage requires a Buffer');
  }
  if (Object.keys(preimage).some((key) => !['kind', 'bytes'].includes(key))) {
    throw new TypeError('bytes preimage metadata is derived by the repository');
  }
  if (preimage.bytes.length > MAX_SNAPSHOT_BYTES) {
    throw new RangeError(`preimage exceeds ${MAX_SNAPSHOT_BYTES} bytes`);
  }
  const bytes = Buffer.from(preimage.bytes);
  return Object.freeze({
    kind: 'bytes',
    bytes,
    sha256: sha256(bytes),
    byteLength: bytes.length,
    encoding: 'utf-8',
  });
}

function metadataFromRow(row) {
  if (!row) return null;
  if (row.preimage_kind === 'absent') {
    return Object.freeze({ kind: 'absent', byteLength: 0, capturedAt: row.captured_at });
  }
  return Object.freeze({
    kind: 'bytes',
    sha256: row.sha256,
    byteLength: row.byte_length,
    capturedAt: row.captured_at,
  });
}

function createFileVersionRepository(db) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');

  async function insertInTransaction(trx, input) {
    const fileVersionId = assertUuid(input.fileVersionId, 'fileVersionId');
    const operationId = assertUuid(input.operationId, 'operationId');
    const resourceId = assertUuid(input.resourceId, 'resourceId');
    const resourceEventId = assertUuid(input.resourceEventId, 'resourceEventId');
    const capturedAt = assertTimestamp(input.capturedAt, 'capturedAt');
    const preimage = normalizePreimage(input.preimage);
    const row = {
      file_version_id: fileVersionId,
      operation_id: operationId,
      resource_id: resourceId,
      resource_event_id: resourceEventId,
      preimage_kind: preimage.kind,
      snapshot_bytes: preimage.bytes,
      sha256: preimage.sha256,
      encoding: preimage.encoding,
      byte_length: preimage.byteLength,
      captured_at: capturedAt,
    };
    const existing = await trx('file_versions').where({ file_version_id: fileVersionId }).first();
    if (existing) {
      const same = existing.operation_id === operationId
        && existing.resource_id === resourceId
        && existing.resource_event_id === resourceEventId
        && existing.preimage_kind === preimage.kind
        && existing.sha256 === preimage.sha256
        && existing.byte_length === preimage.byteLength
        && existing.captured_at === capturedAt
        && (
          preimage.kind === 'absent'
          || (Buffer.isBuffer(existing.snapshot_bytes) && existing.snapshot_bytes.equals(preimage.bytes))
        );
      if (!same) throw new ProvenanceConflictError('file version identity already has different content');
      return metadataFromRow(existing);
    }
    await trx('file_versions').insert(row);
    return metadataFromRow(row);
  }

  return Object.freeze({
    insertInTransaction,
    async getMetadata(fileVersionId) {
      assertUuid(fileVersionId, 'fileVersionId');
      return metadataFromRow(await db('file_versions').where({ file_version_id: fileVersionId }).first());
    },
    async readSnapshotBytes(fileVersionId) {
      assertUuid(fileVersionId, 'fileVersionId');
      const row = await db('file_versions')
        .select('preimage_kind', 'snapshot_bytes')
        .where({ file_version_id: fileVersionId })
        .first();
      if (!row) return null;
      return row.preimage_kind === 'absent' ? null : Buffer.from(row.snapshot_bytes);
    },
  });
}

module.exports = {
  MAX_SNAPSHOT_BYTES,
  createFileVersionRepository,
  normalizePreimage,
};
