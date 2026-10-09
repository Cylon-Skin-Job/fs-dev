'use strict';

const fs = require('node:fs');

const BOOTSTRAP_FD = 3;
const MAX_BOOTSTRAP_BYTES = 512;
const GENERATION_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MASTER_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function parseBootstrapPayload(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BOOTSTRAP_BYTES) {
    throw new Error('shell_bootstrap_invalid');
  }
  if (!text.endsWith('\n') || text.slice(0, -1).includes('\n') || text.slice(0, -1).includes('\r')) {
    throw new Error('shell_bootstrap_invalid');
  }
  let value;
  try {
    value = JSON.parse(text.slice(0, -1));
  } catch {
    throw new Error('shell_bootstrap_invalid');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shell_bootstrap_invalid');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || !keys.includes('version') || !keys.includes('generation') || !keys.includes('master')) {
    throw new Error('shell_bootstrap_invalid');
  }
  if (value.version !== 1
    || typeof value.generation !== 'string'
    || !GENERATION_PATTERN.test(value.generation)
    || typeof value.master !== 'string'
    || !MASTER_PATTERN.test(value.master)) {
    throw new Error('shell_bootstrap_invalid');
  }
  const master = Buffer.from(value.master, 'base64url');
  if (master.length !== 32 || master.toString('base64url') !== value.master) {
    throw new Error('shell_bootstrap_invalid');
  }
  return Object.freeze({ version: 1, generation: value.generation, master });
}

function readBootstrapAuthority(options = {}) {
  const fd = options.fd ?? BOOTSTRAP_FD;
  const createReadStream = options.createReadStream || fs.createReadStream;
  const packaged = options.packaged ?? process.env.FUSION_APP_PACKAGED === '1';
  const expected = options.expected ?? process.env.FUSION_ELECTRON_SERVER === '1';

  if (!expected && !packaged) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    let stream;
    try {
      stream = createReadStream(null, { fd, autoClose: true });
    } catch (error) {
      return reject(new Error('shell_bootstrap_unavailable'));
    }
    let chunks = [];
    let bytes = 0;
    let settled = false;
    let parsed = null;
    let ended = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      chunks = [];
      callback(value);
    };
    stream.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BOOTSTRAP_BYTES) {
        stream.destroy(new Error('shell_bootstrap_invalid'));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    stream.once('error', (error) => {
      finish(reject, new Error(bytes > MAX_BOOTSTRAP_BYTES ? 'shell_bootstrap_invalid' : 'shell_bootstrap_unavailable'));
    });
    stream.once('end', () => {
      try {
        parsed = parseBootstrapPayload(Buffer.concat(chunks, bytes).toString('utf8'));
        ended = true;
      } catch (error) {
        finish(reject, error);
      }
    });
    stream.once('close', () => {
      if (!ended) {
        finish(reject, new Error('shell_bootstrap_unavailable'));
        return;
      }
      finish(resolve, parsed);
    });
  });
}

module.exports = {
  BOOTSTRAP_FD,
  MAX_BOOTSTRAP_BYTES,
  parseBootstrapPayload,
  readBootstrapAuthority,
};
