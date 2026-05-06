# Session W1A — Secret-Pattern Detector

**Wave:** 1 (parallel leaf modules).
**Master spec:** `docs/CLIPBOARD_KEYCHAIN_REDESIGN.md` — read §3g (heuristic preview redaction) before starting.
**Locked decisions:** `docs/CLIPBOARD_BRIEFS/WAVE-0-DECISIONS.md` — read D1 (module location) and D2 (regex set).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md` — adhere strictly.
**Dependencies:** None. Run in parallel with W1B, W1C, W1D.
**Estimated size:** Small. Two new files, one of which is a test file. ~150 lines total.

---

## Files in scope

You will create exactly these files. Do not touch anything else.

### 1. `open-robin-server/lib/secrets/clipboard/secret-detector.js` (new)

A single pure module exporting one function: `detect(value)`. Given a string, returns one of:

```js
// Secret-shaped:
{ type: 'secret', preview: '••••••••••••' + value.slice(-4) }

// Not secret-shaped:
{ type: <inferred-type>, preview: <truncated-preview> }
```

Where `<inferred-type>` is `'link'` if the string starts with `http://` / `https://`, `'code'` if it contains a backtick or matches a code-block prefix, otherwise `'text'`. `<truncated-preview>` is the first 80 characters of the value (the existing convention from the current `clipboard_items.preview` column — this is the *display preview*, distinct from the log preview in W1B).

**Pattern set:** Exactly the list in `WAVE-0-DECISIONS.md` D2 — Prefix matches first (case-sensitive), then Shape matches, with the non-match allow-list applied first to short-circuit. Implement as a `PATTERNS` array of `{ name, test }` entries so future additions go in one place.

**Reuse:** Import the fingerprint formatter from `open-robin-server/lib/secrets/api-keys/fingerprint.js` rather than duplicating the dot+last4 logic. Both submodules use the same fingerprint format per the redesign §3g.

**Pure-function rule:** No I/O, no state, no logging. Input string → output object.

**File-size budget:** ≤ 200 lines including the `PATTERNS` array.

### 2. `open-robin-server/test/secrets/clipboard/secret-detector.test.js` (new)

Jest test file. One positive case per Prefix-match row in D2 (use synthetic test strings — never a real key). One positive case per Shape-match rule. Non-match cases for: URL, paragraph with whitespace, markdown heading, short string. Verify the output shape (both `type` and `preview` fields).

**Test directory:** Mirror the source path under `open-robin-server/test/`. Create the `test/secrets/clipboard/` directory.

---

## Files NOT in scope

Do not touch any of these. They belong to other sessions:

- `open-robin-server/lib/secrets/clipboard/backend.js` — Wave 2.
- `open-robin-server/lib/secrets/clipboard/handlers.js` — Wave 2.
- `open-robin-server/lib/secrets/clipboard/log-preview.js` — Wave 1, Brief W1B.
- `open-robin-server/lib/clipboard/*` — deleted in Wave 2; do not touch in Wave 1.
- `open-robin-server/lib/secrets/api-keys/fingerprint.js` — read-only import.
- Migrations — Wave 1, Brief W1C.
- WS logger — Wave 1, Brief W1D.

---

## Acceptance criteria

After this session completes, these must hold:

1. **Module exists at the locked path.** `open-robin-server/lib/secrets/clipboard/secret-detector.js` is present and `require('./lib/secrets/clipboard/secret-detector').detect` is a function.

2. **Pure function.** Calling `detect(value)` with the same input twice returns deeply equal output. No module-level mutable state.

3. **All D2 patterns covered.** Tests pass for every Prefix-match and Shape-match listed in `WAVE-0-DECISIONS.md` D2. Run with the project's existing Jest command — exact command lives in `open-robin-server/package.json` `test` script.

4. **Non-match cases work.** A URL (`https://example.com/foo`), a paragraph (`Hello, this is a multi-line\nnote with spaces.`), and a 10-char string (`hello world`) all return `type !== 'secret'`.

5. **Fingerprint reuse.** `secret-detector.js` imports from `lib/secrets/api-keys/fingerprint.js` (verify with `grep`); does not redeclare the dot+last4 logic.

6. **No out-of-scope changes.** `git status` after the work shows only the two new files (and any new directories created to hold them).

7. **File size discipline.** `secret-detector.js` is ≤ 200 lines. Test file is unbounded.

---

## Implementation notes

- The `PATTERNS` array can be authored as `[{ name, regex }, ...]` for the regex-based rows and `[{ name, predicate }, ...]` for the shape rows that need length checks beyond what a single regex expresses cleanly. Pick whichever shape keeps the file readable. One job per file is the constraint, not one expression style.
- Detector returns `{ type, preview }`. The `preview` field here is the **display preview** (first 80 chars or fingerprint), not the log preview. They differ — log preview is shorter and lives in W1B's helper.
- The `'link'` / `'code'` / `'text'` inference can be a small helper inside this same file if it's a few lines. Don't extract to a sibling file unless a second consumer appears (per code-standards "extract when second consumer appears").
- For the 80-char preview cap on non-secret items, slice with `Array.from(value).slice(0, 80).join('')` so multi-byte characters aren't split mid-codepoint.

---

## Return format

When complete, paste the following into the orchestrator session:

```
Session W1A complete.

Files changed:
  - <git diff stat output>

Acceptance criteria:
  1. Module exists at locked path:           [pass / fail + notes]
  2. Pure function:                           [pass / fail + notes]
  3. D2 patterns covered:                     [pass / fail + notes]
  4. Non-match cases work:                    [pass / fail + notes]
  5. Fingerprint reuse:                       [pass / fail + notes]
  6. No out-of-scope changes:                 [pass / fail + notes]
  7. File size discipline:                    [pass / fail + notes]

Test command run: <command + final result line>

Surprises / blockers:
  <anything unexpected; otherwise "none">
```
