'use strict';

const crypto = require('crypto');

const UNPAIRED_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

function assertUnicodeScalarString(value, path) {
  if (UNPAIRED_SURROGATE.test(value)) {
    throw new TypeError(`Canonical JSON rejects unpaired Unicode surrogates at ${path}`);
  }
}

function serialize(value, path, ancestors) {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      assertUnicodeScalarString(value, path);
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`Canonical JSON rejects non-finite numbers at ${path}`);
      }
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    case 'undefined':
    case 'bigint':
    case 'function':
    case 'symbol':
      throw new TypeError(`Canonical JSON rejects ${typeof value} at ${path}`);
    default:
      break;
  }

  if (ancestors.has(value)) {
    throw new TypeError(`Canonical JSON rejects cyclic values at ${path}`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      const expectedKeys = Array.from({ length: value.length }, (_, index) => String(index));
      const actualElementKeys = ownKeys.filter((key) => key !== 'length');

      if (
        actualElementKeys.some((key) => typeof key !== 'string')
        || actualElementKeys.length !== expectedKeys.length
        || actualElementKeys.some((key, index) => key !== expectedKeys[index])
      ) {
        throw new TypeError(`Canonical JSON rejects sparse or decorated arrays at ${path}`);
      }

      const items = expectedKeys.map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new TypeError(`Canonical JSON rejects accessor array entries at ${path}[${key}]`);
        }
        return serialize(descriptor.value, `${path}[${key}]`, ancestors);
      });
      return `[${items.join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Canonical JSON rejects non-plain objects at ${path}`);
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) {
      throw new TypeError(`Canonical JSON rejects symbol properties at ${path}`);
    }

    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !('value' in descriptor)) {
        throw new TypeError(`Canonical JSON rejects hidden or accessor properties at ${path}.${key}`);
      }
      assertUnicodeScalarString(key, `${path} key`);
    }

    keys.sort();
    const entries = keys.map((key) => (
      `${JSON.stringify(key)}:${serialize(descriptors[key].value, `${path}.${key}`, ancestors)}`
    ));
    return `{${entries.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

function canonicalizeJson(value) {
  return serialize(value, '$', new WeakSet());
}

function parseStrictJson(text) {
  let offset = 0;

  function fail(message) {
    throw new SyntaxError(`Invalid JSON text at offset ${offset}: ${message}`);
  }

  function skipWhitespace() {
    while (offset < text.length && /[\u0009\u000a\u000d\u0020]/u.test(text[offset])) {
      offset += 1;
    }
  }

  function parseString() {
    const start = offset;
    offset += 1;
    let escaped = false;
    while (offset < text.length) {
      const character = text[offset];
      if (!escaped && character === '"') {
        offset += 1;
        try {
          return JSON.parse(text.slice(start, offset));
        } catch (error) {
          fail(error.message);
        }
      }
      if (!escaped && character.charCodeAt(0) <= 0x1f) {
        fail('unescaped control character in string');
      }
      if (!escaped && character === '\\') {
        escaped = true;
      } else {
        escaped = false;
      }
      offset += 1;
    }
    fail('unterminated string');
  }

  function parseArray() {
    const result = [];
    offset += 1;
    skipWhitespace();
    if (text[offset] === ']') {
      offset += 1;
      return result;
    }

    while (offset < text.length) {
      result.push(parseValue());
      skipWhitespace();
      if (text[offset] === ']') {
        offset += 1;
        return result;
      }
      if (text[offset] !== ',') fail('expected comma or closing bracket');
      offset += 1;
      skipWhitespace();
    }
    fail('unterminated array');
  }

  function parseObject() {
    const result = Object.create(null);
    const keys = new Set();
    offset += 1;
    skipWhitespace();
    if (text[offset] === '}') {
      offset += 1;
      return result;
    }

    while (offset < text.length) {
      if (text[offset] !== '"') fail('expected object key');
      const key = parseString();
      if (keys.has(key)) fail(`duplicate object key ${JSON.stringify(key)}`);
      keys.add(key);
      skipWhitespace();
      if (text[offset] !== ':') fail('expected colon after object key');
      offset += 1;
      const value = parseValue();
      Object.defineProperty(result, key, { value, enumerable: true });
      skipWhitespace();
      if (text[offset] === '}') {
        offset += 1;
        return result;
      }
      if (text[offset] !== ',') fail('expected comma or closing brace');
      offset += 1;
      skipWhitespace();
    }
    fail('unterminated object');
  }

  function parseValue() {
    skipWhitespace();
    const character = text[offset];
    if (character === '"') return parseString();
    if (character === '[') return parseArray();
    if (character === '{') return parseObject();

    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(literal, offset)) {
        offset += literal.length;
        return value;
      }
    }

    const numberMatch = text.slice(offset).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (numberMatch) {
      offset += numberMatch[0].length;
      const value = Number(numberMatch[0]);
      if (!Number.isFinite(value)) fail('number is outside the supported finite range');
      return value;
    }

    fail('expected a JSON value');
  }

  const value = parseValue();
  skipWhitespace();
  if (offset !== text.length) fail('unexpected trailing content');
  return value;
}

function canonicalizeJsonText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('Canonical JSON text must be a string');
  }
  return canonicalizeJson(parseStrictJson(text));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function sha256CanonicalJson(value) {
  return sha256(canonicalizeJson(value));
}

function sha256CanonicalJsonText(text) {
  return sha256(canonicalizeJsonText(text));
}

module.exports = {
  canonicalizeJson,
  canonicalizeJsonText,
  sha256CanonicalJson,
  sha256CanonicalJsonText,
};
