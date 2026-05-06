# Session COLLAPSE — Merge `description` + `use_when` into a single field

**Track:** Cross-cutting (server + client + wiki).
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for context. Sections most relevant: §5d (form layout, validation), §6c (capabilities-index query shape), §7g (UEB payload), §8a (WS protocol), §13 (migrations).
**Dependencies:** All seven prior sessions (T1L0–T1L3, T2L0–T2L2, T3) merged.
**Estimated size:** Medium-pervasive. ~80 lines of code touched across 8 files plus a new migration and the wiki article. Mechanical — every change is "remove the `use_when` field" plus the form rebuild and a 150-char cap.

The change: drop `use_when` everywhere. The `description` field absorbs its job — single combined narrative covering *what it is*, *when AI uses it*, *what user requests trigger it*. Hard cap 150 chars. Form drops the "More options" disclosure; `expires_at` moves inline.

---

## Files in scope

### 1. `open-robin-server/lib/db/migrations/015_drop_use_when.js` (new)

```js
exports.up = (knex) => knex.schema.alterTable('secrets_index', (t) => {
  t.dropColumn('use_when');
});

exports.down = (knex) => knex.schema.alterTable('secrets_index', (t) => {
  t.text('use_when');
});
```

SQLite supports `ALTER TABLE … DROP COLUMN` natively in modern versions; if the project's better-sqlite3 binding rejects this, fall back to the rebuild-table pattern (create new table without the column, copy rows, drop old, rename). Note approach taken in the return report.

### 2. `open-robin-server/lib/secrets/api-keys/index-table.js` (modify)

Drop `use_when` from every SELECT column list, every INSERT field list, every UPDATE field list. Drop from the row shape returned by `list()`/`get()`. ~3-5 lines net.

### 3. `open-robin-server/lib/secrets/api-keys/backend.js` (modify)

- Drop `use_when` from `add()` and `update()` parameter destructuring.
- Drop from the row-shape constructed before insert.
- Add validation: if `description` exists and `description.length > 150`, throw `ApiKeysBackendError.INVALID_VALUE` with message *"description must be ≤ 150 characters"*.
- The `changed_fields` array in `update()` should no longer ever contain `'use_when'`.

### 4. `open-robin-server/lib/secrets/api-keys/handlers.js` (modify)

- Drop `use_when` from the destructure of incoming `secrets:api-keys:set` messages.
- Drop from the `publicFields()` helper (or wherever the broadcast payload is shaped).
- Drop from the UEB event payloads in `secret:added` / `secret:updated`.

### 5. `open-robin-client/src/state/secretsStore.ts` (modify)

Drop `use_when: string | null` from the `ApiKeyIndexEntry` interface.

### 6. `open-robin-client/src/components/secrets/api-keys/api-keys-api.ts` (modify)

Drop `use_when` from `setApiKey`'s options type.

### 7. `open-robin-client/src/components/secrets/api-keys/ApiKeysPanel.tsx` (modify — biggest change)

The form rebuild:

- Remove the entire "More options" disclosure logic (toggle state, the `<details>`/disclosure markup, etc.).
- Remove the `Use when` textarea/input.
- Promote `Description` from a single-line input to a `<textarea>` (~3 visible rows). Same field name, same store path, just multi-line.
- Add a character counter `{description.length} / 150` rendered in the lower-right corner beneath the textarea. Counter span goes red when count > 150.
- Move the `Expires` date picker to render inline below the description (no longer behind a disclosure).
- Save button disabled when:
  - Name fails regex (existing rule), OR
  - Value length < 8 (existing rule), OR
  - **Description length > 150** (new rule).

The row rendering remains as T2L1 shipped it — single-line truncated description with `title` attribute carrying the full text on hover. If T2L1 didn't implement the `title` hover (the report didn't say), add it now: `<span title={entry.description ?? ''}>{truncate(entry.description, 50)}</span>` or similar.

### 8. `ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md` (modify)

Update the article's metadata-fields section to describe one field instead of two. Replace any "use_when" references with explanation of the combined `description`. Update the example JSON output of `get-secret-list` to match the new shape (no `use_when`). Add a `LOG.md` entry noting the schema change.

---

## Files NOT in scope

- `lib/secrets.js` — keychain wrapper, untouched.
- Migrations 013, 014 — already shipped; do not retroactively modify.
- `lib/secrets/api-keys/fingerprint.js` — pure function, no change.
- `App.tsx` — mount sites unchanged.
- `server.js`, `lib/startup.js`, `lib/ws/client-message-router.js` — wiring unchanged.
- The legacy `system_wiki.secrets` SQLite row — still dormant.

---

## Acceptance criteria

1. **Migration runs cleanly.** `015_drop_use_when.js` applies on a real `robin.db` containing the previous schema. After migration: `sqlite3 "$ROBIN_DB" ".schema secrets_index"` shows no `use_when` column. Existing rows (if any) are preserved minus that field.

2. **Server build clean.** No reference to `use_when` remaining in `open-robin-server/lib/secrets/`. Run `grep -rn "use_when" open-robin-server/lib/secrets/ open-robin-server/lib/db/migrations/015*` — only the migration's `t.text('use_when')` in the `down()` path should match.

3. **Client build clean.** `npx tsc --noEmit` and `npm run build` both succeed. No reference to `use_when` remaining in `open-robin-client/src/components/secrets/` or `open-robin-client/src/state/secretsStore.ts`. `grep -rn "use_when\|useWhen" open-robin-client/src/` returns zero matches.

4. **Description length validation — backend.** Sending a `secrets:api-keys:set` with `description.length === 151` returns `secrets:api-keys:error { code: 'INVALID_VALUE' }`. With 150 chars: succeeds. With null/undefined: succeeds (description is optional).

5. **Description length validation — UI.** Type 150 chars: counter shows `150 / 150` in normal color, Save remains enabled. Type a 151st: counter goes red, Save disables.

6. **Form layout.** Form fields render in this order, all inline (no disclosure): Name → Value → Description (textarea) → Expires. Counter `N / 150` renders in the lower-right beneath the description textarea.

7. **Add round-trip.** With server running: add a key with all four fields populated. Verify keychain entry, `secrets_index` row (no `use_when` column), broadcast payload contains description but no use_when, UEB `secret:added` payload contains `{kind, name, description, expires_at, fingerprint}` and no `use_when`.

8. **Update round-trip.** Update an existing key's description. `secret:updated` payload has `changed_fields: ['description']`. Update the value too: `changed_fields: ['value', 'fingerprint']`.

9. **Wiki article matches new schema.** `ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md` has zero references to `use_when`. The example `get-secret-list` JSON output in the article matches the new shape exactly.

10. **No out-of-scope changes.** `git status` after this session shows changes only to the 8 listed files (1 new migration + 5 server files + 2 client files + the wiki PAGE.md, plus the wiki LOG.md entry). The `index.json` files in the wiki need no change (they don't reference `use_when`).

11. **Backwards-compat hack absent.** No code path that "if the user passes use_when, ignore it" — the field is gone. No comments saying `// removed use_when`. Per code-standards: delete, don't deprecate.

---

## Implementation notes

- `better-sqlite3` (the binding this project uses) supports `ALTER TABLE DROP COLUMN` natively as of SQLite 3.35+. If the migration runner objects, fall back to the rebuild-table pattern rather than papering over with a NOOP migration.
- The 150-char limit is a hard cap, not a soft warning. Backend rejects, UI prevents.
- Don't keep the `Use when` field around as deprecated/hidden. Delete it entirely. The spec's earlier mention of `use_when` is now historical context for why the collapse happened.
- The wiki article rewrite should fold the "use_when as retrieval hint" framing into a single section about how `description` serves both purposes. Re-read §10d (the content outline) — it already lists "metadata fields" as one section; just rewrite that section to cover one field instead of two.
- Field-counter UX: render as a small muted-color span in the lower-right corner of the textarea wrapper. Switches to a red color (use the existing CSS error variable) when over. The Save button's disabled-state UI is presumably already styled from T2L1 — just extend its disable condition.

---

## Return format

```
Session COLLAPSE complete.

Files changed:
  - <git diff stat>

Acceptance criteria:
  1. Migration runs cleanly:                  [pass / fail + notes]
  2. Server build clean (no use_when):        [pass / fail + notes]
  3. Client build clean (no use_when):        [pass / fail + notes]
  4. Description length — backend:            [pass / fail + notes]
  5. Description length — UI:                 [pass / fail + notes]
  6. Form layout:                             [pass / fail + notes]
  7. Add round-trip:                          [pass / fail + notes]
  8. Update round-trip:                       [pass / fail + notes]
  9. Wiki article matches new schema:         [pass / fail + notes]
  10. No out-of-scope changes:                [pass / fail + notes]
  11. No deprecated cruft:                    [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: convergence (e2e verification — resume from §3 of SESSION-CONVERGENCE-e2e.md).
```
