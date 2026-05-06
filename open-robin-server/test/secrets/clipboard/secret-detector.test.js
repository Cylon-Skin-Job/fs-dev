'use strict';

const { detect } = require('../../../lib/secrets/clipboard/secret-detector');

const FINGERPRINT_RE = /^••••••••••••.{4}$/;

describe('detect — prefix matches (synthetic)', () => {
  const positives = [
    'sk_test_abc123def456ghij',
    'sk_live_abc123def456ghij',
    'rk_test_abc123def456ghij',
    'rk_live_abc123def456ghij',
    'pk_test_abc123def456ghij',
    'pk_live_abc123def456ghij',
    'ghp_abcdefghij1234567890',
    'gho_abcdefghij1234567890',
    'ghu_abcdefghij1234567890',
    'ghs_abcdefghij1234567890',
    'ghr_abcdefghij1234567890',
    'github_pat_11ABCDEFG_abcdefghij1234',
    'xoxb-1234-5678-abcdef',
    'xoxp-1234-5678-abcdef',
    'xoxa-1234-5678-abcdef',
    'xoxr-1234-5678-abcdef',
    'xoxe.xoxb-1234-abcdef',
    'sk-ant-api03-abcdefghijklmnop',
    'sk-' + 'a'.repeat(40),
    'AIza' + 'B'.repeat(35),
    'ya29.A0AfH6SMBabcdefghij',
    'AKIA' + 'A'.repeat(16),
    'ASIA' + 'A'.repeat(16),
    'Bearer abc123def456ghij',
    'eyJ' + 'a'.repeat(60),
    'npm_abcdefghij1234567890',
    'glpat-abcdefghij1234567890',
    'dop_v1_abcdefghij1234567890',
    'dor_v1_abcdefghij1234567890',
    'doo_v1_abcdefghij1234567890',
  ];

  positives.forEach((s) => {
    test(`marks "${s.slice(0, 24)}…" as secret`, () => {
      const out = detect(s);
      expect(out.type).toBe('secret');
      expect(out.preview).toMatch(FINGERPRINT_RE);
    });
  });
});

describe('detect — shape matches (synthetic)', () => {
  test('long hex (32+) is secret', () => {
    const out = detect('a1b2c3d4e5f6'.repeat(4)); // 48 hex chars
    expect(out.type).toBe('secret');
    expect(out.preview).toMatch(FINGERPRINT_RE);
  });
  test('long base64url (40+) is secret', () => {
    const out = detect('aB1-_xY9'.repeat(6)); // 48 base64url chars
    expect(out.type).toBe('secret');
    expect(out.preview).toMatch(FINGERPRINT_RE);
  });
  test('long opaque (64+, no whitespace, no ://) is secret', () => {
    const out = detect('!@#$%^&*()'.repeat(7)); // 70 non-whitespace chars
    expect(out.type).toBe('secret');
  });
});

describe('detect — non-matches', () => {
  test('URL is link, not secret', () => {
    const out = detect('https://example.com/foo/bar/baz/qux');
    expect(out.type).toBe('link');
  });
  test('paragraph with whitespace is text, not secret', () => {
    const out = detect('Hello, this is a multi-line\nnote with spaces.');
    expect(out.type).toBe('text');
  });
  test('short string is text, not secret', () => {
    const out = detect('hello world');
    expect(out.type).toBe('text');
  });
  test('markdown heading is text, not secret', () => {
    const out = detect('## Some heading text here it is\n');
    expect(out.type).toBe('text');
  });
  test('code fence is code, not secret', () => {
    const out = detect('```js\nconst x = 1;\n```');
    expect(out.type).toBe('code');
  });
  test('inline code with backtick is code, not secret', () => {
    const out = detect('use `npm install` to set up the project');
    expect(out.type).toBe('code');
  });
});

describe('detect — preview shape', () => {
  test('non-secret preview is at most 80 codepoints', () => {
    const long = 'https://example.com/' + 'x'.repeat(200);
    const out = detect(long);
    expect(Array.from(out.preview).length).toBeLessThanOrEqual(80);
  });
  test('multi-byte safe preview', () => {
    const s = '你'.repeat(120);
    const out = detect(s); // 120 chars of Chinese is "single-line, no whitespace, length>=64" -> opaque shape match
    // Either secret-via-opaque or non-secret-via-allow-list — either way, no codepoint splits.
    if (out.type !== 'secret') {
      expect(Array.from(out.preview).length).toBeLessThanOrEqual(80);
      // Verify no surrogate-half corruption.
      expect(Buffer.from(out.preview, 'utf8').toString('utf8')).toBe(out.preview);
    }
  });
  test('secret preview matches the fingerprint format exactly', () => {
    const out = detect('sk_live_abcdef1234567890');
    expect(out.preview).toBe('••••••••••••' + '7890');
  });
});

describe('detect — edge cases', () => {
  test('empty string returns empty text row', () => {
    const out = detect('');
    expect(out).toEqual({ type: 'text', preview: '' });
  });
  test('non-string input returns empty text row', () => {
    expect(detect(null)).toEqual({ type: 'text', preview: '' });
    expect(detect(undefined)).toEqual({ type: 'text', preview: '' });
    expect(detect(42)).toEqual({ type: 'text', preview: '' });
  });
  test('Bearer prefix beats whitespace allow-list', () => {
    const out = detect('Bearer ' + 'a'.repeat(20));
    expect(out.type).toBe('secret');
  });
});
