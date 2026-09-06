'use strict';

const crypto = require('crypto');
const {
  canonicalizeJson,
  canonicalizeJsonText,
  sha256CanonicalJson,
  sha256CanonicalJsonText,
} = require('../../lib/event-registry/canonical-json');

describe('event registry canonical JSON', () => {
  test('sorts object keys recursively while retaining array order', () => {
    const left = {
      zebra: 1,
      alpha: { second: true, first: 'value' },
      list: [{ y: 2, x: 1 }, null],
    };
    const right = {
      list: [{ x: 1, y: 2 }, null],
      alpha: { first: 'value', second: true },
      zebra: 1,
    };

    const expected = '{"alpha":{"first":"value","second":true},"list":[{"x":1,"y":2},null],"zebra":1}';
    expect(canonicalizeJson(left)).toBe(expected);
    expect(canonicalizeJson(right)).toBe(expected);
    expect(sha256CanonicalJson(left)).toBe(sha256CanonicalJson(right));
    expect(sha256CanonicalJson(left)).toBe(
      crypto.createHash('sha256').update(expected, 'utf8').digest('hex'),
    );
  });

  test('canonicalizes valid JSON text and rejects trailing or malformed input', () => {
    expect(canonicalizeJsonText(' { "b": -0, "a": 1 } ')).toBe('{"a":1,"b":0}');
    expect(sha256CanonicalJsonText('{"b":2,"a":1}')).toBe(
      sha256CanonicalJsonText('{"a":1,"b":2}'),
    );
    expect(() => canonicalizeJsonText('{"a":1} trailing')).toThrow(SyntaxError);
    expect(() => canonicalizeJsonText('{"a":}')).toThrow(SyntaxError);
    expect(() => canonicalizeJsonText('{"a":1,"a":2}')).toThrow(/duplicate object key/);
    expect(() => canonicalizeJsonText('{"a":1,"\\u0061":2}')).toThrow(/duplicate object key/);
    expect(() => canonicalizeJsonText(null)).toThrow(TypeError);
  });

  test('defines negative zero as canonical JSON zero', () => {
    expect(canonicalizeJson(-0)).toBe('0');
    expect(sha256CanonicalJson(-0)).toBe(sha256CanonicalJson(0));
  });

  test('hashes the exact UTF-8 bytes of canonical non-ASCII text', () => {
    const canonical = '{"label":"café","symbol":"🦊"}';
    expect(canonicalizeJson({ symbol: '🦊', label: 'café' })).toBe(canonical);
    expect(sha256CanonicalJson({ symbol: '🦊', label: 'café' })).toBe(
      crypto.createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest('hex'),
    );
  });

  test.each([
    ['undefined', undefined],
    ['bigint', 1n],
    ['non-finite number', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
    ['function property', { unsafe: () => true }],
    ['symbol property', Object.assign({ ok: true }, { [Symbol('unsafe')]: true })],
    ['date', new Date(0)],
    ['unpaired surrogate value', '\uD800'],
    ['unpaired surrogate key', { ['\uDC00']: true }],
  ])('rejects unsupported %s values', (_label, value) => {
    expect(() => canonicalizeJson(value)).toThrow(TypeError);
  });

  test('rejects cycles, sparse arrays, decorated arrays, and accessors', () => {
    const cyclic = {};
    cyclic.self = cyclic;

    const sparse = [];
    sparse.length = 1;

    const decorated = [1];
    decorated.extra = true;

    const accessor = {};
    Object.defineProperty(accessor, 'value', {
      enumerable: true,
      get: () => 1,
    });

    expect(() => canonicalizeJson(cyclic)).toThrow(/cyclic/);
    expect(() => canonicalizeJson(sparse)).toThrow(/sparse or decorated/);
    expect(() => canonicalizeJson(decorated)).toThrow(/sparse or decorated/);
    expect(() => canonicalizeJson(accessor)).toThrow(/accessor/);
  });

  test('is reentrant and does not reject repeated non-cyclic references', () => {
    const shared = { b: 2, a: 1 };
    const value = { right: shared, left: shared };

    expect(canonicalizeJson(value)).toBe(
      '{"left":{"a":1,"b":2},"right":{"a":1,"b":2}}',
    );
    expect(Promise.all(Array.from({ length: 20 }, () => sha256CanonicalJson(value))))
      .resolves.toEqual(Array(20).fill(sha256CanonicalJson(value)));
  });
});
