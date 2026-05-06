# Session W1C — Schema Migration

**Wave:** 1 (parallel leaf modules).
**Master spec:** `docs/CLIPBOARD_KEYCHAIN_REDESIGN.md` — read §3c (schema), §3e (lifecycle), §4 (migration nuke decision).
**Locked decisions:** `docs/CLIPBOARD_BRIEFS/WAVE-0-DECISIONS.md` — read D4 (existing-table-name correction).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md` — adhere strictly.
**Dependencies:** None. Run in parallel with W1A, W1B, W1D.
**Estimated size:** Tiny. One new migration file. ~40 lines.

---

## Files in scope

You will create exactly this file. Do not touch anything else.

### 1. `open-robin-server/lib/db/migrations/016_clipboard_keychain.js` (new)

The migration sequence's last existing file is `015_drop_use_when.js`. Use `016_clipboard_keychain.js` exactly.

```js
/**
 * Migration 016 — Clipboard keychain redesign
 *
 * Drops the legacy `clipboard_items` table (plaintext value column).
 * Creates `clipboard_index` — metadata only; values move to macOS Keychain at
 * service = "clipboard:<id>", account = "open-robin".
 *
 * Per §4 of CLIPBOARD_KEYCHAIN_REDESIGN.md: nuke, do not migrate. Existing
 * rows are pre-leak and not preserved.
 */

exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('clipboard_items');
  await knex.schema.createTable('clipboard_index', (t) => {
    t.increments('id').primary();
    t.text('type');                   // 'text' | 'link' | 'code' | 'secret' | ...
    t.text('preview');                // first 80 chars (display preview), or fingerprint for type='secret'
    t.text('content_hash').notNullable();
    t.integer('created_at').notNullable();
    t.integer('last_used_at').notNullable();
    t.text('source');                 // 'auto' | 'manual' | 'api' | ...
    t.unique(['content_hash']);
    t.index(['last_used_at'], 'clipboard_index_lru');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('clipboard_index');
  // Recreate legacy table shape so the migration is reversible. Data is not
  // recoverable — the original values lived in the dropped plaintext column.
  await knex.schema.createTable('clipboard_items', (t) => {
    t.increments('id').primary();
    t.text('text').notNullable();
    t.text('type').notNullable().defaultTo('text');
    t.text('preview').notNullable();
    t.text('content_hash').notNullable();
    t.integer('created_at').notNullable();
    t.integer('last_used_at').notNullable();
    t.text('source').defaultTo('manual');
    t.unique(['content_hash']);
    t.index(['last_used_at']);
  });
};
```

**No keychain entry deletion in this migration.** The legacy table never wrote to keychain, so there's nothing to clean up. The Wave 2 backend handles keychain lifecycle going forward.

---

## Files NOT in scope

Do not touch any of these:

- Any file under `open-robin-server/lib/clipboard/` — deletion is Wave 2's job.
- Any file under `open-robin-server/lib/secrets/clipboard/` — Waves 1A/1B/2 own those.
- The migration runner — `lib/db.js` and friends are unchanged for this wave.

---

## Acceptance criteria

After this session completes, these must hold:

1. **Migration file exists.** `open-robin-server/lib/db/migrations/016_clipboard_keychain.js` is present with the exact filename above.

2. **Migration applies cleanly.** Run the project's migration command (per `open-robin-server/package.json` or the existing migration script). After up:
   - `sqlite3 open-robin-server/data/robin.db ".schema clipboard_items"` returns nothing (table dropped).
   - `sqlite3 open-robin-server/data/robin.db ".schema clipboard_index"` shows the new schema with all seven columns plus the unique index on `content_hash` and the LRU index.

3. **Empty new table is queryable.** `sqlite3 open-robin-server/data/robin.db "SELECT * FROM clipboard_index;"` returns zero rows without error.

4. **Down path reverses cleanly.** Running the migration's down function:
   - Drops `clipboard_index`.
   - Recreates `clipboard_items` with the original schema.
   - The reversal applies without error on a fresh up-then-down cycle.

5. **No `text` column on the new table.** `sqlite3 ... "PRAGMA table_info(clipboard_index);"` does not include a column named `text`. This is the §1 invariant — it should be impossible to read values from SQLite.

6. **No regressions.** Server starts after the migration runs. Other tables are untouched.

7. **No out-of-scope changes.** `git status` shows only the one new migration file.

---

## Implementation notes

- The legacy table has unique-on-`content_hash` and a `last_used_at` index. The new table preserves both, since the dedup-on-insert and LRU-list-ordering behaviors are unchanged.
- Knex naming: pass an explicit `'clipboard_index_lru'` index name so it can be referenced by name later if needed.
- If the user has existing clipboard data when this migration runs, it will be lost — that is intentional per §4. No warning prompt is required.

---

## Return format

When complete, paste the following into the orchestrator session:

```
Session W1C complete.

Files changed:
  - <git diff stat output>

Acceptance criteria:
  1. Migration file exists:                   [pass / fail + notes]
  2. Migration applies cleanly:               [pass / fail + notes]
  3. Empty new table queryable:               [pass / fail + notes]
  4. Down path reverses cleanly:              [pass / fail + notes]
  5. No `text` column on new table:           [pass / fail + notes]
  6. No regressions:                          [pass / fail + notes]
  7. No out-of-scope changes:                 [pass / fail + notes]

Up + down cycle output: <relevant log lines>

Surprises / blockers:
  <anything unexpected; otherwise "none">
```
