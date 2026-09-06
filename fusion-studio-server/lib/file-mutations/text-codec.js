'use strict';

const crypto = require('crypto');
const { TextDecoder } = require('util');
const { MAX_SNAPSHOT_BYTES } = require('./file-version-repository');

class TextValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TextValidationError';
    this.code = code;
  }
}

function assertScalarNulFreeString(value, code = 'unsupported_text') {
  if (typeof value !== 'string') throw new TextValidationError('Content must be text.', code);
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit === 0) throw new TextValidationError('Text cannot contain NUL.', code);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) {
        throw new TextValidationError('Text contains invalid Unicode.', code);
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TextValidationError('Text contains invalid Unicode.', code);
    }
  }
  return value;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function encodeIntendedText(value) {
  assertScalarNulFreeString(value);
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > MAX_SNAPSHOT_BYTES) {
    throw new TextValidationError('Text exceeds the 10 MiB limit.', 'too_large');
  }
  return Object.freeze({ bytes, sha256: sha256(bytes), byteLength: bytes.length });
}

function validatePreimageBytes(value) {
  if (!Buffer.isBuffer(value)) throw new TypeError('preimage bytes must be a Buffer');
  if (value.length > MAX_SNAPSHOT_BYTES) {
    throw new TextValidationError('Existing file exceeds the 10 MiB limit.', 'preimage_too_large');
  }
  let decoded;
  try {
    // `ignoreBOM: true` means treat U+FEFF as content instead of consuming it
    // as a decoder signature, preserving the exact accepted preimage bytes.
    decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(value);
  } catch (_error) {
    throw new TextValidationError('Existing file is not supported UTF-8 text.', 'unsupported_preimage');
  }
  try {
    assertScalarNulFreeString(decoded, 'unsupported_preimage');
  } catch (error) {
    if (error instanceof TextValidationError) throw error;
    throw new TextValidationError('Existing file is not supported UTF-8 text.', 'unsupported_preimage');
  }
  const roundTrip = Buffer.from(decoded, 'utf8');
  if (!roundTrip.equals(value)) {
    throw new TextValidationError('Existing file is not canonical UTF-8 text.', 'unsupported_preimage');
  }
  return Object.freeze({ bytes: Buffer.from(value), sha256: sha256(value), byteLength: value.length });
}

module.exports = {
  TextValidationError,
  assertScalarNulFreeString,
  encodeIntendedText,
  sha256,
  validatePreimageBytes,
};
