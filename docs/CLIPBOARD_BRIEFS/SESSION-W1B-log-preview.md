# Session W1B — Log-Preview Helper

**Wave:** 1 (parallel leaf modules).
**Master spec:** `docs/CLIPBOARD_KEYCHAIN_REDESIGN.md` — read §3i (logging discipline) before starting.
**Locked decisions:** `docs/CLIPBOARD_BRIEFS/WAVE-0-DECISIONS.md` — read D1 (module location) and D3 (truncation length).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md` — adhere strictly.
**Dependencies:** None. Run in parallel with W1A, W1C, W1D.
**Estimated size:** Tiny. Two files, ~80 lines total.

---

## Files in scope

You will create exactly these files. Do not touch anything else.

### 1. `open-robin-server/lib/secrets/clipboard/log-preview.js` (new)

A pure module exporting:

```js
const LOG_PREVIEW_MAX_CHARS = 16;

function formatClipboardLogPreview(row) {
  // row: { id, type, preview, content_hash, source, last_used_at, ... }
  // Returns a short string suitable for log output.
  // - If row.type === 'secret', return the fingerprint (row.preview is already the fingerprint per W1A; pass through).
  // - Otherwise, return row.preview truncated to LOG_PREVIEW_MAX_CHARS, suffixed with '…' if truncated.
  // - Never return the row's underlying value (the helper has no access to it; it works from metadata only).
}

function formatClipboardLogEnvelope(row) {
  // Returns a single-line log-friendly object: { id, type, source, len: row.preview?.length, last_used_at, preview: formatClipboardLogPreview(row) }
  // For use at insert / use / delete log sites in the backend (W2).
}

module.exports = {
  LOG_PREVIEW_MAX_CHARS,
  formatClipboardLogPreview,
  formatClipboardLogEnvelope,
};
```

**Pure-function rule:** No I/O, no state, no logging. Inputs → outputs. The helper is *consumed by* loggers; it does not log.

**No access to values.** This helper takes only metadata rows. It cannot accept the raw clipboard value as a parameter, by design — that prevents accidental misuse where a caller could pass the value and have it land in logs. If a future caller needs to log a value-bearing event, they must redact at their site before calling here.

**Truncation:** Use `LOG_PREVIEW_MAX_CHARS = 16`. The ellipsis is U+2026 (`…`), not three dots. Multi-byte-safe slicing as in W1A.

**File-size budget:** ≤ 100 lines including comments and exports.

### 2. `open-robin-server/test/secrets/clipboard/log-preview.test.js` (new)

Jest test file. Cases:
- Secret row (`type: 'secret', preview: '••••••••••••abcd'`) → output equals `'••••••••••••abcd'`.
- Short text row (`type: 'text', preview: 'hello'`) → output equals `'hello'` (no ellipsis).
- Long text row (`type: 'text', preview: 'a'.repeat(50)`) → output is exactly 17 characters: 16 chars + `…`.
- URL row (`type: 'link', preview: 'https://example.com/foo/bar/baz'`) → truncated to 16 chars + `…`.
- Multi-byte preview (e.g. `'你好世界你好世界你好世界你好世界你好'`) → does not split a codepoint at boundary.
- Envelope: returns the documented keys and the preview equals what `formatClipboardLogPreview` returns for the same row.

---

## Files NOT in scope

Do not touch any of these:

- `open-robin-server/lib/secrets/clipboard/secret-detector.js` — Wave 1, Brief W1A.
- `open-robin-server/lib/secrets/clipboard/backend.js` — Wave 2.
- `open-robin-server/lib/secrets/clipboard/handlers.js` — Wave 2.
- `open-robin-server/lib/clipboard/*` — deleted in Wave 2; do not touch.
- The actual logger — Wave 1, Brief W1D wires the helper in.

---

## Acceptance criteria

After this session completes, these must hold:

1. **Module exists at the locked path.** `open-robin-server/lib/secrets/clipboard/log-preview.js` exports `LOG_PREVIEW_MAX_CHARS`, `formatClipboardLogPreview`, `formatClipboardLogEnvelope`.

2. **Pure functions.** No imports of `fs`, `console`, `winston`, or any logger. No top-level side effects.

3. **No-value-input contract.** The helper signatures accept *only* metadata rows. Document the rule in a one-line comment at the top of the file.

4. **Truncation length is exactly 16.** Long inputs return `value.slice(0, 16) + '…'`. The constant is exported as `LOG_PREVIEW_MAX_CHARS = 16`.

5. **All test cases pass.** Run via the project's Jest command.

6. **No out-of-scope changes.** `git status` shows only the two new files.

7. **File size discipline.** `log-preview.js` ≤ 100 lines.

---

## Implementation notes

- Treat `row.preview?.length` defensively — if `preview` is missing, return a placeholder like `'(empty)'` rather than throwing. The helper is a logger dependency; it must never be the cause of an unhandled exception that drops a log line.
- Multi-byte safety: `Array.from(str).slice(0, 16).join('') + (Array.from(str).length > 16 ? '…' : '')`.
- `formatClipboardLogEnvelope` is the helper that backend log sites will actually call most. Keep its return shape stable — it appears in every clipboard log line going forward.

---

## Return format

When complete, paste the following into the orchestrator session:

```
Session W1B complete.

Files changed:
  - <git diff stat output>

Acceptance criteria:
  1. Module exists at locked path:           [pass / fail + notes]
  2. Pure functions:                          [pass / fail + notes]
  3. No-value-input contract:                 [pass / fail + notes]
  4. Truncation length is 16:                 [pass / fail + notes]
  5. All test cases pass:                     [pass / fail + notes]
  6. No out-of-scope changes:                 [pass / fail + notes]
  7. File size discipline:                    [pass / fail + notes]

Test command run: <command + final result line>

Surprises / blockers:
  <anything unexpected; otherwise "none">
```
