// Log-preview helpers for clipboard rows.
// Contract: these functions accept ONLY metadata rows (id, type, preview, content_hash,
// source, last_used_at, ...). They never accept the raw clipboard value as a parameter,
// so callers cannot accidentally route a value through here into a log line.
// Pure: no I/O, no logging, no top-level state.

const LOG_PREVIEW_MAX_CHARS = 16;
const ELLIPSIS = '…';
const EMPTY_PLACEHOLDER = '(empty)';

function formatClipboardLogPreview(row) {
  if (!row || typeof row !== 'object') return EMPTY_PLACEHOLDER;
  const { type, preview } = row;
  if (typeof preview !== 'string' || preview.length === 0) {
    return EMPTY_PLACEHOLDER;
  }
  // Secret rows: preview is already a fingerprint per W1A — pass through.
  if (type === 'secret') return preview;
  // Multi-byte-safe truncation by codepoint.
  const codepoints = Array.from(preview);
  if (codepoints.length <= LOG_PREVIEW_MAX_CHARS) return preview;
  return codepoints.slice(0, LOG_PREVIEW_MAX_CHARS).join('') + ELLIPSIS;
}

function formatClipboardLogEnvelope(row) {
  const safe = row && typeof row === 'object' ? row : {};
  const preview = typeof safe.preview === 'string' ? safe.preview : undefined;
  return {
    id: safe.id,
    type: safe.type,
    source: safe.source,
    len: preview ? preview.length : undefined,
    last_used_at: safe.last_used_at,
    preview: formatClipboardLogPreview(safe),
  };
}

module.exports = {
  LOG_PREVIEW_MAX_CHARS,
  formatClipboardLogPreview,
  formatClipboardLogEnvelope,
};
