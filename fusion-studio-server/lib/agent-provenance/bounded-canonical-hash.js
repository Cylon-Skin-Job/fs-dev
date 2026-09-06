'use strict';

const crypto = require('crypto');

const MAX_DEPTH = 32;
const MAX_VISITED = 10_000;
const MAX_CANONICAL_BYTES = 1_048_576;
const WRITE_CHUNK_CODE_UNITS = 8_192;

class BoundedCanonicalHashError extends TypeError {
  constructor(code) {
    super('Value cannot be fingerprinted within the bounded canonical contract.');
    this.name = 'BoundedCanonicalHashError';
    this.code = code;
  }
}

function createWriter() {
  const hash = crypto.createHash('sha256');
  let byteLength = 0;
  return Object.freeze({
    write(value) {
      let offset = 0;
      while (offset < value.length) {
        let end = Math.min(offset + WRITE_CHUNK_CODE_UNITS, value.length);
        if (end < value.length) {
          const last = value.charCodeAt(end - 1);
          if (last >= 0xd800 && last <= 0xdbff) end -= 1;
        }
        const chunk = value.slice(offset, end);
        const bytes = Buffer.byteLength(chunk, 'utf8');
        if (byteLength + bytes > MAX_CANONICAL_BYTES) {
          throw new BoundedCanonicalHashError('canonical_bytes_exceeded');
        }
        byteLength += bytes;
        hash.update(chunk, 'utf8');
        offset = end;
      }
    },
    digest() {
      return hash.digest('hex');
    },
    remaining() {
      return MAX_CANONICAL_BYTES - byteLength;
    },
  });
}

function measureJsonStringBytes(value, limit) {
  let bytes = 2;
  if (bytes > limit) throw new BoundedCanonicalHashError('canonical_bytes_exceeded');
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new BoundedCanonicalHashError('unpaired_surrogate');
      index += 1;
      bytes += 4;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new BoundedCanonicalHashError('unpaired_surrogate');
    } else if (code === 0x22 || code === 0x5c || [0x08, 0x09, 0x0a, 0x0c, 0x0d].includes(code)) {
      bytes += 2;
    } else if (code <= 0x1f) {
      bytes += 6;
    } else if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else {
      bytes += 3;
    }
    if (bytes > limit) throw new BoundedCanonicalHashError('canonical_bytes_exceeded');
  }
  return bytes;
}

function writeJsonString(value, writer) {
  writer.write('"');
  let plainStart = 0;
  function flush(end) {
    if (end > plainStart) writer.write(value.slice(plainStart, end));
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    let escaped = null;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new BoundedCanonicalHashError('unpaired_surrogate');
      index += 1;
    } else {
      if (code >= 0xdc00 && code <= 0xdfff) throw new BoundedCanonicalHashError('unpaired_surrogate');
      if (code === 0x22) escaped = '\\"';
      else if (code === 0x5c) escaped = '\\\\';
      else if (code === 0x08) escaped = '\\b';
      else if (code === 0x09) escaped = '\\t';
      else if (code === 0x0a) escaped = '\\n';
      else if (code === 0x0c) escaped = '\\f';
      else if (code === 0x0d) escaped = '\\r';
      else if (code <= 0x1f) escaped = `\\u${code.toString(16).padStart(4, '0')}`;
    }
    if (escaped != null) {
      flush(index);
      writer.write(escaped);
      plainStart = index + 1;
    } else if (index + 1 - plainStart >= WRITE_CHUNK_CODE_UNITS) {
      flush(index + 1);
      plainStart = index + 1;
    }
  }
  flush(value.length);
  writer.write('"');
}

function boundedCanonicalSha256(value) {
  const writer = createWriter();
  const ancestors = new WeakSet();
  let visited = 0;

  function preflightEnumerableKeys(current, limit, canonicalBudget = null) {
    const keys = [];
    let minimumCanonicalBytes = canonicalBudget == null ? 0 : 2;
    for (const key in current) {
      if (!Object.hasOwn(current, key)) continue;
      if (keys.length >= limit) throw new BoundedCanonicalHashError('visited_values_exceeded');
      if (canonicalBudget != null) {
        const separatorBytes = keys.length === 0 ? 0 : 1;
        const remaining = canonicalBudget - minimumCanonicalBytes - separatorBytes - 2;
        const keyBytes = measureJsonStringBytes(key, remaining);
        minimumCanonicalBytes += separatorBytes + keyBytes + 2;
      }
      keys.push(key);
    }
    return keys;
  }

  function visit(current, depth) {
    if (depth > MAX_DEPTH) throw new BoundedCanonicalHashError('depth_exceeded');
    visited += 1;
    if (visited > MAX_VISITED) throw new BoundedCanonicalHashError('visited_values_exceeded');
    if (current === null) {
      writer.write('null');
      return;
    }
    switch (typeof current) {
      case 'boolean':
        writer.write(current ? 'true' : 'false');
        return;
      case 'string':
        writeJsonString(current, writer);
        return;
      case 'number':
        if (!Number.isFinite(current)) throw new BoundedCanonicalHashError('non_finite_number');
        writer.write(Object.is(current, -0) ? '0' : JSON.stringify(current));
        return;
      case 'undefined':
      case 'bigint':
      case 'function':
      case 'symbol':
        throw new BoundedCanonicalHashError('unsupported_value');
      default:
        break;
    }

    if (ancestors.has(current)) throw new BoundedCanonicalHashError('cyclic_value');
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (current.length > MAX_VISITED - visited) throw new BoundedCanonicalHashError('visited_values_exceeded');
        const minimumCanonicalBytes = current.length === 0 ? 2 : (current.length * 2) + 1;
        if (minimumCanonicalBytes > writer.remaining()) {
          throw new BoundedCanonicalHashError('canonical_bytes_exceeded');
        }
        const enumerableKeys = preflightEnumerableKeys(current, MAX_VISITED - visited);
        if (enumerableKeys.length !== current.length
          || enumerableKeys.some((key, index) => key !== String(index))) {
          throw new BoundedCanonicalHashError('invalid_array_shape');
        }
        const keys = Reflect.ownKeys(current);
        if (keys.length !== current.length + 1 || keys[keys.length - 1] !== 'length'
          || keys.slice(0, -1).some((key, index) => typeof key !== 'string' || key !== String(index))) {
          throw new BoundedCanonicalHashError('invalid_array_shape');
        }
        writer.write('[');
        for (let index = 0; index < current.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
            throw new BoundedCanonicalHashError('array_accessor');
          }
          if (index > 0) writer.write(',');
          visit(descriptor.value, depth + 1);
        }
        writer.write(']');
        return;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) throw new BoundedCanonicalHashError('non_plain_object');
      preflightEnumerableKeys(current, MAX_VISITED - visited, writer.remaining());
      const keys = Reflect.ownKeys(current);
      if (keys.length > MAX_VISITED - visited) throw new BoundedCanonicalHashError('visited_values_exceeded');
      if (keys.some((key) => typeof key !== 'string')) throw new BoundedCanonicalHashError('symbol_property');
      keys.sort();
      writer.write('{');
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
          throw new BoundedCanonicalHashError('object_accessor');
        }
        if (index > 0) writer.write(',');
        writeJsonString(key, writer);
        writer.write(':');
        visit(descriptor.value, depth + 1);
      }
      writer.write('}');
    } finally {
      ancestors.delete(current);
    }
  }

  visit(value, 0);
  return writer.digest();
}

module.exports = {
  BoundedCanonicalHashError,
  MAX_CANONICAL_BYTES,
  MAX_DEPTH,
  MAX_VISITED,
  boundedCanonicalSha256,
};
