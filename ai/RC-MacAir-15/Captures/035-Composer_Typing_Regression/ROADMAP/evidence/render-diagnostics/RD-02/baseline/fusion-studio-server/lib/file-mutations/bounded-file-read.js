'use strict';

const { MAX_SNAPSHOT_BYTES } = require('./file-version-repository');

class FileReadLimitError extends Error {
  constructor(message = 'File exceeds the bounded read limit.') {
    super(message);
    this.name = 'FileReadLimitError';
    this.code = 'file_read_too_large';
  }
}

async function readFileHandleBounded(handle, maxBytes = MAX_SNAPSHOT_BYTES) {
  if (!handle || typeof handle.read !== 'function') throw new TypeError('open FileHandle is required');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new TypeError('maxBytes must be nonnegative');
  const bytes = Buffer.allocUnsafe(maxBytes + 1);
  let offset = 0;
  while (offset <= maxBytes) {
    const length = Math.min(64 * 1024, (maxBytes + 1) - offset);
    const result = await handle.read(bytes, offset, length, offset);
    if (!result || !Number.isInteger(result.bytesRead) || result.bytesRead < 0 || result.bytesRead > length) {
      throw new TypeError('FileHandle.read returned an invalid byte count');
    }
    if (result.bytesRead === 0) return Buffer.from(bytes.subarray(0, offset));
    offset += result.bytesRead;
    if (offset > maxBytes) throw new FileReadLimitError();
  }
  throw new FileReadLimitError();
}

module.exports = { FileReadLimitError, readFileHandleBounded };
