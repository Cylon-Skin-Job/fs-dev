const {
  LOG_PREVIEW_MAX_CHARS,
  formatClipboardLogPreview,
  formatClipboardLogEnvelope,
} = require('../../../lib/secrets/clipboard/log-preview');

describe('LOG_PREVIEW_MAX_CHARS', () => {
  it('is exactly 16', () => {
    expect(LOG_PREVIEW_MAX_CHARS).toBe(16);
  });
});

describe('formatClipboardLogPreview', () => {
  it('passes through secret fingerprints unchanged', () => {
    const row = { type: 'secret', preview: '••••••••••••abcd' };
    expect(formatClipboardLogPreview(row)).toBe('••••••••••••abcd');
  });

  it('returns short text previews unchanged (no ellipsis)', () => {
    const row = { type: 'text', preview: 'hello' };
    const out = formatClipboardLogPreview(row);
    expect(out).toBe('hello');
    expect(out).not.toContain('…');
  });

  it('truncates long text to 16 chars + U+2026 ellipsis (length 17)', () => {
    const row = { type: 'text', preview: 'a'.repeat(50) };
    const out = formatClipboardLogPreview(row);
    expect(Array.from(out).length).toBe(17);
    expect(out.endsWith('…')).toBe(true);
    expect(out.slice(0, 16)).toBe('a'.repeat(16));
  });

  it('truncates URL previews to 16 chars + ellipsis', () => {
    const row = { type: 'link', preview: 'https://example.com/foo/bar/baz' };
    const out = formatClipboardLogPreview(row);
    expect(Array.from(out).length).toBe(17);
    expect(out.endsWith('…')).toBe(true);
    expect(Array.from(out).slice(0, 16).join('')).toBe('https://example.');
  });

  it('does not split a multi-byte codepoint at the boundary', () => {
    const preview = '你好世界你好世界你好世界你好世界你好';
    const row = { type: 'text', preview };
    const out = formatClipboardLogPreview(row);
    const codepoints = Array.from(out);
    expect(codepoints.length).toBe(17);
    expect(out.endsWith('…')).toBe(true);
    // First 16 codepoints from the source preview must round-trip cleanly.
    const expectedHead = Array.from(preview).slice(0, 16).join('');
    expect(codepoints.slice(0, 16).join('')).toBe(expectedHead);
    // Round-trip via Buffer to confirm no surrogate-half corruption.
    expect(Buffer.from(out, 'utf8').toString('utf8')).toBe(out);
  });

  it('returns a placeholder when preview is missing', () => {
    expect(formatClipboardLogPreview({ type: 'text' })).toBe('(empty)');
    expect(formatClipboardLogPreview({ type: 'text', preview: '' })).toBe('(empty)');
  });

  it('returns a placeholder when row is null/undefined', () => {
    expect(formatClipboardLogPreview(null)).toBe('(empty)');
    expect(formatClipboardLogPreview(undefined)).toBe('(empty)');
  });
});

describe('formatClipboardLogEnvelope', () => {
  it('returns the documented keys with preview matching formatClipboardLogPreview', () => {
    const row = {
      id: 42,
      type: 'text',
      source: 'paste',
      preview: 'a'.repeat(50),
      last_used_at: '2026-05-05T12:00:00Z',
      content_hash: 'deadbeef',
    };
    const env = formatClipboardLogEnvelope(row);
    expect(Object.keys(env).sort()).toEqual(
      ['id', 'last_used_at', 'len', 'preview', 'source', 'type'].sort()
    );
    expect(env.id).toBe(42);
    expect(env.type).toBe('text');
    expect(env.source).toBe('paste');
    expect(env.len).toBe(50);
    expect(env.last_used_at).toBe('2026-05-05T12:00:00Z');
    expect(env.preview).toBe(formatClipboardLogPreview(row));
  });

  it('preview field equals the formatter for a secret row', () => {
    const row = { id: 1, type: 'secret', source: 'copy', preview: '••••••••••••abcd' };
    const env = formatClipboardLogEnvelope(row);
    expect(env.preview).toBe('••••••••••••abcd');
    expect(env.preview).toBe(formatClipboardLogPreview(row));
  });
});
