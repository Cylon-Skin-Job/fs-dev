# Session W1D — WS Logger Redaction Map

**Wave:** 1 (parallel leaf modules).
**Master spec:** `docs/CLIPBOARD_KEYCHAIN_REDESIGN.md` — read §3i (logging discipline) and §7 (related WS logger redaction).
**Locked decisions:** `docs/CLIPBOARD_BRIEFS/WAVE-0-DECISIONS.md` — read D1 (module location) and D3 (truncation length).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md` — adhere strictly.
**Dependencies:** None for authoring. The actual wiring into the WS logger happens in Wave 3 (Brief W3G); this session produces the map module + tests so Wave 3 can drop it in.
**Estimated size:** Small. Two files, ~150 lines total.

---

## Files in scope

You will create exactly these files. Do not touch anything else.

### 1. `open-robin-server/lib/ws/redaction-map.js` (new)

A pure module exporting:

```js
/**
 * Per-WS-message-type redaction map.
 *
 * Used by the WS debug logger to scrub credential-bearing fields before
 * `JSON.stringify(msg)` lands in server-live.log.
 *
 * Adding a new message type that carries a value? Add an entry here.
 */

const REDACTED = '[redacted]';

const RULES = {
  // Clipboard family — value-bearing messages.
  'clipboard:append':  { redactPaths: ['text', 'value'] },
  'clipboard:use':     { redactPaths: ['text', 'value'] }, // both request and response
  // Secrets family — value-bearing messages.
  'secrets:api-keys:set': { redactPaths: ['value'] },
};

function redactWsMessage(msg) {
  // Returns a new object suitable for logging. Never mutates the input.
  // - Looks up RULES[msg.type] (or msg.kind / msg.event — match the project's actual envelope key).
  // - For each path in redactPaths, replaces the value at that path with REDACTED.
  // - Paths are dot-separated (e.g. 'payload.value') for nested fields.
  // - If no rule matches, returns the input as-is (pass-through).
}

module.exports = { redactWsMessage, RULES, REDACTED };
```

**Pure-function rule:** No I/O, no logging, no state.

**Non-mutation:** `redactWsMessage` must clone the input before redacting. The caller is the logger; mutating the message would alter what the protocol layer downstream sees.

**Envelope key:** Match whatever the project's WS messages use as the type discriminator. Inspect `open-robin-server/lib/clipboard/ws-handlers.js` and `open-robin-server/lib/secrets/api-keys/handlers.js` to confirm — typical convention in this codebase is `msg.type` but verify. Document the choice in a comment at the top of `RULES`.

**Path-based redaction:** Implement a small `setAtPath(obj, 'a.b.c', value)` helper inline. Do not pull in `lodash.set` or similar; the project doesn't carry that dependency for one operation. ≤ 10 lines is plenty.

**File-size budget:** ≤ 150 lines including `RULES` and the helper.

### 2. `open-robin-server/test/ws/redaction-map.test.js` (new)

Jest test file. Cases:
- `clipboard:append` with `text: 'sk_live_abc...'` → output has `text: '[redacted]'`, all other fields unchanged.
- `clipboard:use` response with `value: '...'` → output has `value: '[redacted]'`.
- `secrets:api-keys:set` with `value: '...'` → output has `value: '[redacted]'`.
- Unknown message type (`thread:create`) → output deeply equals input (pass-through).
- Input must not be mutated — assert `originalMsg.text === 'sk_live_abc...'` after the call.
- Nested-path case: synthesize a message with `payload.value` and a rule with `redactPaths: ['payload.value']`, confirm only the leaf is redacted.

---

## Files NOT in scope

Do not touch any of these:

- The actual WS debug logger — Wave 3, Brief W3G wires the map in.
- `open-robin-server/lib/secrets/clipboard/*` — Waves 1A/1B/2.
- `open-robin-server/lib/secrets/api-keys/*` — read-only inspection only (to confirm envelope key convention).
- `open-robin-server/lib/clipboard/*` — read-only inspection only.

---

## Acceptance criteria

After this session completes, these must hold:

1. **Module exists at the path.** `open-robin-server/lib/ws/redaction-map.js` exports `redactWsMessage`, `RULES`, `REDACTED`.

2. **Three rules present at minimum.** `RULES` has entries for `clipboard:append`, `clipboard:use`, and `secrets:api-keys:set`.

3. **Pure & non-mutating.** All test cases that assert input non-mutation pass.

4. **Pass-through for unknowns.** Messages whose type is not in `RULES` round-trip identically.

5. **Envelope key documented.** A top-of-file comment names which message field is used as the type discriminator and points to the source file inspected to confirm.

6. **No external dependencies added.** `package.json` is not modified. `lodash`, `lodash.set`, etc. are not introduced.

7. **No out-of-scope changes.** `git status` shows only the two new files.

8. **File size discipline.** `redaction-map.js` ≤ 150 lines.

---

## Implementation notes

- The map is intentionally written so adding a new credential-bearing message type later is a one-liner. Do not over-design — no plugin system, no decorator pattern, no schema validator. Just an object literal.
- If the project's WS envelope wraps the actual type under e.g. `msg.event` or has both `msg.type` and `msg.kind`, document which one the redaction lookup uses and why. Future maintenance hinges on this being unambiguous.
- The `[redacted]` placeholder is a literal string. Do not use a Symbol — the message goes through `JSON.stringify` and Symbols are dropped.

---

## Return format

When complete, paste the following into the orchestrator session:

```
Session W1D complete.

Files changed:
  - <git diff stat output>

Acceptance criteria:
  1. Module exists at path:                   [pass / fail + notes]
  2. Three rules present:                     [pass / fail + notes]
  3. Pure & non-mutating:                     [pass / fail + notes]
  4. Pass-through for unknowns:               [pass / fail + notes]
  5. Envelope key documented:                 [pass / fail + notes]
  6. No external dependencies added:          [pass / fail + notes]
  7. No out-of-scope changes:                 [pass / fail + notes]
  8. File size discipline:                    [pass / fail + notes]

Test command run: <command + final result line>
Envelope key chosen: <msg.type / msg.kind / etc.>

Surprises / blockers:
  <anything unexpected; otherwise "none">
```
