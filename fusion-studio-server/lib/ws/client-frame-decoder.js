'use strict';

const { TextDecoder } = require('util');

const MAX_SHELL_AUTH_FRAME_BYTES = 4 * 1024;

class ClientFrameError extends Error {
  constructor(message, closeCode) {
    super(message);
    this.name = 'ClientFrameError';
    this.closeCode = closeCode;
  }
}

function toBuffer(raw) {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof ArrayBuffer) return Buffer.from(raw);
  if (Array.isArray(raw) && raw.every(Buffer.isBuffer)) return Buffer.concat(raw);
  if (ArrayBuffer.isView(raw)) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  return null;
}

function rawByteLength(raw) {
  if (typeof raw === 'string') return Buffer.byteLength(raw, 'utf8');
  if (Buffer.isBuffer(raw)) return raw.byteLength;
  if (raw instanceof ArrayBuffer) return raw.byteLength;
  if (Array.isArray(raw) && raw.every(Buffer.isBuffer)) {
    return raw.reduce((total, chunk) => total + chunk.byteLength, 0);
  }
  if (ArrayBuffer.isView(raw)) return raw.byteLength;
  return null;
}

function decodeClientTextFrame(raw, isBinary = false, options = {}) {
  if (isBinary) throw new ClientFrameError('Binary client frames are unsupported.', 1003);
  const maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
  const byteLength = rawByteLength(raw);
  if (byteLength !== null && byteLength > maxBytes) {
    throw new ClientFrameError('Client frame exceeds the permitted size.', 1009);
  }
  let text;
  if (typeof raw === 'string') {
    text = raw;
  } else {
    const bytes = toBuffer(raw);
    if (!bytes) throw new ClientFrameError('Client frame is not valid text.', 1007);
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch (_error) {
      throw new ClientFrameError('Client frame contains invalid UTF-8.', 1007);
    }
  }
  try {
    return Object.freeze({ text, value: JSON.parse(text) });
  } catch (_error) {
    throw new ClientFrameError('Client frame contains malformed JSON.', 1007);
  }
}

module.exports = {
  ClientFrameError,
  MAX_SHELL_AUTH_FRAME_BYTES,
  getClientFrameByteLength: rawByteLength,
  decodeClientTextFrame,
};
