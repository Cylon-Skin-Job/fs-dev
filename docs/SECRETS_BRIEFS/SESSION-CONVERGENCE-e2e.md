# Session CONVERGENCE — End-to-End Verification

**Track:** N/A — convergence step.
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — this checklist runs §14's test plan as the final gate before commit.
**Dependencies:** All seven prior sessions (T1L0, T1L1, T1L2, T1L3, T2L0, T2L1, T2L2, T3) merged. Server runnable, client buildable, wiki article in place.
**Estimated size:** Verification only. No code changes (unless a regression is found, in which case the relevant earlier brief is reopened).
**Runner:** This session is intended to be run by the orchestrator (the same session that wrote the briefs), but is fully self-contained for any agent or human to execute.

---

## 1. Pre-flight

Run from the repo root.

### 1a. Tree sanity

```bash
git status --short | grep -E "(secrets|api-keys|secrets-manager|robin\.db|startup|event-bus|ws-client)" | head -40
```

Expected: shows the new and modified files from the seven sessions. No surprises (e.g., no `_unused`, no `// deleted`, no orphaned `.tmp` files).

### 1b. Build green

```bash
cd open-robin-client && npm run build 2>&1 | tail -10
```

Expected: `vite build` succeeds, exit 0, no TypeScript errors.

### 1c. Server boots

Boot the server (background or foreground). Confirm console shows clean startup. No registration errors. No unhandled promise rejections during init.

After boot:

```bash
sqlite3 "$ROBIN_DB" ".schema secrets_index"
```

Expected: prints the 7-column schema with `name` PK.

```bash
sqlite3 "$ROBIN_DB" "SELECT id FROM system_tabs ORDER BY sort_order;"
```

Expected: no `secrets` row.

```bash
sqlite3 "$ROBIN_DB" "SELECT slug, tab, length(content) FROM system_wiki WHERE slug='secrets';"
```

Expected: `secrets|<NULL>|<positive int>` — slug intact, tab nulled, content preserved (dormant per §10b).

---

## 2. Wiki track verification

### 2a. Article exists

```bash
ls ai/views/wiki-viewer/content/system-tools/secrets-manager/
```

Expected: `PAGE.md`, `index.json`, `LOG.md`.

### 2b. Article is platform-agnostic

```bash
grep -E "Claude|Codex|Kimi|Gemini|Qwen|OpenCode|skill|slash-command|MCP" \
  ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md
```

Expected: zero matches.

### 2c. Article covers all six topics

Open the file and verify presence of headings for: capabilities-index intro, list-via-sqlite, capture-and-use, discipline rules, missing-key handling, metadata fields, progressive disclosure.

### 2d. Indexes registered

```bash
grep -F "secrets-manager" ai/views/wiki-viewer/content/system-tools/index.json
grep -F "system-tools/secrets-manager" ai/views/wiki-viewer/content/topics.json
```

Both expected: one match each.

### 2e. Article renders in the viewer

Open the wiki viewer in the browser. Confirm:
- The article appears in the system-tools section index.
- Click through to it — the page renders, code fences render with syntax, headings render at the right hierarchy.
- The shell snippets are copy-pasteable as-is.

---

## 3. End-to-end UI round-trip

### 3a. Header button

Open the app. Header right shows three icons in order: theme swatch, key, raven.

### 3b. Popover open/close

- Click the key icon → popover opens.
- Click outside the popover → closes.
- Click again → opens.
- Press Escape → closes.

### 3c. Empty state

With no secrets stored: popover body shows the empty-state copy and the "+ Add API key" button.

### 3d. Add a secret

In the form:

| Field | Value |
|-------|-------|
| Name | `STRIPE_KEY_TEST` |
| Value | `sk_test_convergence_e2e_value_long_enough_a3f7` |
| Description | `Convergence smoke test — delete me` |
| Use when | (under More options) `Smoke test only — never use in real flows` |
| Expires | (under More options) any date |

Live validation:
- Type `lower` in the name field — red message, Save disabled.
- Type `STRIPE` — message clears, Save still disabled (value too short).
- Paste the long value — Save enables.

Click Save. Verify:
- Form clears and collapses.
- Row appears at top of list with name `STRIPE_KEY_TEST` and fingerprint `••••••••••••a3f7` (last 4 chars of the value).

### 3e. Backend state matches

Run alongside the UI:

```bash
security find-generic-password -a "open-robin" -s "STRIPE_KEY_TEST" -w
```

Expected: prints the value.

```bash
sqlite3 "$ROBIN_DB" "SELECT name, fingerprint, description, use_when, expires_at FROM secrets_index WHERE name='STRIPE_KEY_TEST';"
```

Expected: one row with the fingerprint matching the UI display, description and use_when populated, expires_at as ms timestamp.

### 3f. UEB event verification

In a separate Node REPL or a temporary script attached to the server:

```js
const { on } = require('./open-robin-server/lib/event-bus');
on('*', (event) => {
  if (event.type.startsWith('secret:')) {
    console.log(event.type, JSON.stringify(event));
  }
});
```

Run an add / update / delete cycle from the UI. Verify each emitted event:
- `secret:added` fires once on add. Payload has `kind: 'api-key'`, name, description, use_when, expires_at, fingerprint. **No `value` field anywhere.**
- `secret:updated` fires once on update. Payload includes `changed_fields` listing what actually changed.
- `secret:deleted` fires once on delete. Payload is `{ kind, name }` only.

### 3g. Update flow

Click the row's name (or use whatever UI affords editing). Change description only. Save.

- Fingerprint unchanged (no value change).
- `secret:updated` event has `changed_fields: ['description']`.
- `updated_at` advances in SQLite.

Edit again, this time changing the value. Save.

- Fingerprint reflects new last-4.
- `changed_fields` includes `'value'` and `'fingerprint'`.
- `security ... -w` returns the new value.

### 3h. Delete flow

Click `[✕]` on the row. Inline confirm appears: "Delete `STRIPE_KEY_TEST`? [Cancel] [Delete]".

Click Delete. Verify:
- Row vanishes from UI.
- `security find-generic-password -a "open-robin" -s "STRIPE_KEY_TEST"` returns not-found.
- `sqlite3 ... WHERE name='STRIPE_KEY_TEST'` returns zero rows.
- `secret:deleted` event fired.

### 3i. Two clients

Open the app in a second browser tab. Add a secret in tab 1. The new row appears in tab 2 without manual refresh (broadcast). Delete in tab 2. Tab 1 updates automatically.

### 3j. Validation paths

- Submit a name like `lower-case` → `INVALID_NAME` error displayed inline.
- Submit a value of length 5 → `INVALID_VALUE` error displayed inline.
- Submit a name that already exists → "Update existing?" prompt appears (not an error).

### 3k. Backend-unavailable banner

Stop the server (or sever the WS connection). In the UI, attempt to add a secret. The top-of-popover red banner appears: *"Couldn't reach secrets storage..."*. Restore the server. The banner clears on the next successful operation.

---

## 4. AI access verification

### 4a. ROBIN_DB propagates

From a Bash tool spawned by any installed CLI:

```bash
echo "$ROBIN_DB"
ls -l "$ROBIN_DB"
```

Expected: prints the absolute path to `open-robin-server/data/robin.db`. The file exists.

### 4b. AI can list

From the same Bash tool:

```bash
sqlite3 "$ROBIN_DB" "SELECT json_object('name', name, 'description', description, 'use_when', use_when, 'expires_at', expires_at, 'fingerprint', fingerprint) FROM secrets_index ORDER BY name;"
```

Expected: one JSON object per line, no `value` fields anywhere in the output.

### 4c. AI can capture and use

Add a temporary key for this test (via UI):

| Field | Value |
|-------|-------|
| Name | `CONVERGENCE_AI_TEST_KEY` |
| Value | `ai_test_value_unique_token_xyz123` |
| Description | `Used by convergence brief §4c` |

From the AI's Bash tool:

```bash
TOKEN=$(security find-generic-password -a "open-robin" -s "CONVERGENCE_AI_TEST_KEY" -w 2>/dev/null)
[ -n "$TOKEN" ] && echo "captured ok" || echo "FAILED to capture"
# DO NOT echo $TOKEN — that would leak. The above only confirms it's non-empty.
```

Expected: `captured ok`. The actual token never appears in output.

### 4d. Discipline test (negative)

Confirm the discipline rules from §6d hold by attempting violations:

- `echo "$TOKEN"` (don't actually run; just confirm the wiki article forbids it).
- `echo "$TOKEN" > /tmp/leak.txt` (forbidden).
- Across two Bash calls (forbidden).

These are AI-discipline rules, not enforced by the harness in v1. Confirm they're in the wiki article (§2 of this brief already greps for related text).

Delete the test key.

---

## 5. Log discipline

### 5a. Server logs

```bash
grep -i "ai_test_value_unique_token_xyz123\|sk_test_convergence_e2e_value_long_enough_a3f7" \
  open-robin-server/server.log open-robin-server/server-live.log open-robin-server/wire-debug.log 2>/dev/null
```

Expected: zero matches. No raw values in any log file.

### 5b. UEB log scan (if a persistent log exists)

```bash
[ -f open-robin-server/data/event-log.json ] && \
  grep -i "ai_test_value_unique_token_xyz123\|sk_test_convergence_e2e_value_long_enough_a3f7" \
    open-robin-server/data/event-log.json || echo "no event log file (expected pre-implementation per SPEC-EVENT-SYSTEM.md)"
```

Expected: either zero matches, or the file doesn't exist (the wildcard listener is still spec-only per `SPEC-EVENT-SYSTEM.md`).

---

## 6. Code-standards spot-check

### 6a. server.js diff

```bash
git diff --stat HEAD~10..HEAD -- open-robin-server/server.js
```

Expected: ≤ 5 lines changed (one require, one registration call, possibly one factory dependency wiring).

### 6b. File-size sanity

```bash
wc -l open-robin-server/lib/secrets/api-keys/*.js \
      open-robin-server/lib/secrets/index.js \
      open-robin-client/src/components/secrets/**/*.tsx \
      open-robin-client/src/components/secrets/SecretsManager*.tsx 2>/dev/null
```

Expected: every file under 400 lines. Largest from reports: `ApiKeysPanel.tsx` at 409 — just over. Check whether it's genuinely one job (likely yes — list + form + delete is one cohesive UI surface). If not, flag for a future split.

### 6c. KEY_PATTERN single source of truth

```bash
grep -rn "\\^\\[A-Z\\]\\[A-Z0-9_\\]\\*\\$" open-robin-server/lib/secrets.js open-robin-client/src/
```

Expected: exactly two occurrences — one in `lib/secrets.js`, one in the client's validation (likely in `ApiKeysPanel.tsx` or a sibling validation helper).

### 6d. No DOM in backend, no event-bus in client

```bash
grep -rE "document\\.|window\\.|fetch\\(" open-robin-server/lib/secrets/
```

Expected: zero matches.

```bash
grep -rE "event-bus|emit" open-robin-client/src/components/secrets/ open-robin-client/src/state/secretsStore.ts
```

Expected: zero matches.

---

## 7. Cleanup

If any test secrets remain (`STRIPE_KEY_TEST`, `CONVERGENCE_AI_TEST_KEY`, etc.), delete them via the UI before commit. Confirm with:

```bash
sqlite3 "$ROBIN_DB" "SELECT name FROM secrets_index;"
```

Expected: empty (or only contains the user's real secrets, none of which start with `STRIPE_KEY_TEST` or `CONVERGENCE_*`).

```bash
security find-generic-password -a "open-robin" -s "STRIPE_KEY_TEST" 2>&1 | head -1
security find-generic-password -a "open-robin" -s "CONVERGENCE_AI_TEST_KEY" 2>&1 | head -1
```

Both expected: not-found.

---

## 8. Status flip

Once §1–§7 all pass, edit `docs/SECRETS_MANAGER_SPEC.md` line 3:

```
**Status:** Draft — ready for handoff.
```

becomes:

```
**Status:** Implemented — verified at <commit-sha>.
```

Where `<commit-sha>` is the sha of the all-in-one end-of-day commit. Fill in after the commit lands.

---

## Return format

Whichever agent runs this — orchestrator, fresh session, or human — produces:

```
Convergence verification complete.

Sections:
  1. Pre-flight:                              [pass / fail + notes]
  2. Wiki track:                              [pass / fail + notes]
  3. End-to-end UI round-trip:                [pass / fail + notes]
  4. AI access verification:                  [pass / fail + notes]
  5. Log discipline:                          [pass / fail + notes]
  6. Code-standards spot-check:               [pass / fail + notes]
  7. Cleanup:                                 [pass / fail + notes]
  8. Status flip:                             [done — commit-sha <X>]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Verdict: SHIP / HOLD
```

If verdict is HOLD, the surprises section names the failed criterion(a) and points at the relevant earlier brief to reopen.

---

## Implementation notes (for the runner)

- §3 requires browser interaction. If the runner is a fresh agent without browser access, mark §3 as "deferred to human" and run the rest. The orchestrator should run §3 manually if so.
- §3f requires attaching a temporary listener to the event bus. If the server is running as a long-lived process, the cleanest way is a one-off Node script that requires `lib/event-bus.js` and registers a wildcard listener for the duration of the test, then exits.
- §4 requires a CLI to be running and exposing a Bash tool to the runner. If the runner is the orchestrator session, this is "you running bash" — the env-var check is: does `process.env.ROBIN_DB` actually propagate to your Bash subprocess? If yes, T1L0 #4 passes. If not, the env-var injection in `lib/startup.js` didn't reach.
- §5b's `event-log.json` is expected to be absent until the broader event-log work ships. Don't fail the run on its absence.
