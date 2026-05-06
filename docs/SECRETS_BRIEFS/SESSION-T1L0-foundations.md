# Session T1L0 — Server Foundations

**Track:** 1 (Server). **Layer:** 0 (Foundations).
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for full architectural context. Sections most relevant to this session: §2c, §2d, §6c, §7a, §7b, §7c.1, §11c, §11f, §13.
**Dependencies:** None. This is the first session that runs.
**Estimated size:** Small. Five files, mostly small additions or pure functions.

---

## Files in scope

You will create or modify exactly these files. Do not touch anything else.

### 1. `open-robin-server/lib/db/migrations/013_secrets_index.js` (new)

Create the `secrets_index` table per §13. Exact knex code is in the spec — copy it. Schema:

```js
exports.up = (knex) => knex.schema.createTable('secrets_index', (t) => {
  t.text('name').primary();
  t.text('description');
  t.text('use_when');
  t.integer('expires_at').nullable();
  t.text('fingerprint').notNullable();
  t.integer('created_at').notNullable();
  t.integer('updated_at').notNullable();
});
exports.down = (knex) => knex.schema.dropTable('secrets_index');
```

### 2. `open-robin-server/lib/db/migrations/014_drop_secrets_system_tab.js` (new)

Removes the `secrets` row from `system_tabs`, retiring the Secrets tab from the Robin overlay. Exact code in §13:

```js
exports.up = async (knex) => {
  await knex('system_tabs').where('id', 'secrets').delete();
};
exports.down = async (knex) => {
  // Re-seed from migration 002 literal (see open-robin-server/lib/db/migrations/002_system_panel.js for the row).
};
```

### 3. `open-robin-server/lib/db.js` (modify)

Export `DB_PATH` as a module-level constant alongside the existing exports. The path is resolved at module-load time using the same logic `initDb()` already uses. Reference: `docs/DB_RELOCATION_SPEC.md` §3a — the resolution is `path.join(__dirname, '..', 'data', 'robin.db')`.

This export is consumed by `lib/startup.js` (this session, file 4) and is the single source of truth for the DB path going forward.

### 4. `open-robin-server/lib/startup.js` (modify)

After `initDb()` completes successfully, set `process.env.ROBIN_DB`:

```js
const { DB_PATH } = require('./db');
process.env.ROBIN_DB = DB_PATH;
```

This propagates the DB path to every spawned AI child process via Node's standard env inheritance. Per the spec §7c.1, every existing AI-spawn site already passes `env: { ...process.env, ... }`, so the variable reaches the AI without per-site changes.

### 5. `open-robin-server/lib/secrets.js` (modify)

This file already exists and is **kept**, not rewritten. The only change in this session: export `KEY_PATTERN` so the WS handler layer (a future session) can reuse the same regex object rather than redeclaring it.

```js
// add to module.exports:
module.exports = { get, set, del, has, getMany, SecretsError, ACCOUNT, KEY_PATTERN };
```

The regex itself stays exactly as-is: `/^[A-Z][A-Z0-9_]*$/`.

---

## Files NOT in scope

Do not touch any of these. They belong to later sessions:

- Anything under `open-robin-server/lib/secrets/api-keys/` — that's Layer 1 (Session T1L1).
- `server.js` — that's Layer 3 (Session T1L3).
- Any client file under `open-robin-client/` — that's Track 2.
- Any wiki content under `ai/views/wiki-viewer/content/` — that's Track 3.
- `lib/git-credential-open-robin.sh` — kept as-is, no change.
- `scripts/migrate-keychain.sh` — kept as-is, no change.
- The `system_wiki.secrets` row — left dormant per §10b.

---

## Acceptance criteria

After this session completes, these must hold:

1. **Migrations apply cleanly.** Running the server's migration command:
   - Creates the `secrets_index` table with all seven columns and the `name` PK.
   - Removes the `secrets` row from `system_tabs`.
   - Both `down()` paths reverse the changes when run.

2. **Empty table is queryable.** `sqlite3 open-robin-server/data/robin.db "SELECT * FROM secrets_index;"` returns zero rows without error.

3. **`DB_PATH` is exported.** A test script `node -e "console.log(require('./open-robin-server/lib/db').DB_PATH)"` prints the absolute path to `open-robin-server/data/robin.db`.

4. **`ROBIN_DB` propagates to spawned processes.** Start the server. From any installed CLI's Bash tool, `echo $ROBIN_DB` prints the same absolute path that `DB_PATH` returns. This verifies the env-var inheritance through every existing AI-spawn site.

5. **`KEY_PATTERN` is exported.** `node -e "console.log(require('./open-robin-server/lib/secrets').KEY_PATTERN)"` prints the regex `/^[A-Z][A-Z0-9_]*$/`.

6. **No regressions.** The existing Robin overlay still loads (other tabs — CLIs, Connectors, LLM Providers, Enforcement — still render). The Secrets tab is gone; that's expected.

7. **No new files outside scope.** `git status` after the work shows changes only to the five files listed above (plus the two new migration files).

---

## Implementation notes

- The migration filenames must be exactly `013_secrets_index.js` and `014_drop_secrets_system_tab.js` to slot into the existing migration sequence (last existing is `012_drop_harness_theme.js`).
- `lib/db.js` already does the path resolution inside `initDb`. Pull that resolution to module top-level so it's available before `initDb` is called. Mirror with how `__dirname` is used in `lib/db.js` today.
- For migration 014, the `down()` path is best-effort. The literal row data lives in `lib/db/migrations/002_system_panel.js` if you need to copy it for reverse-migration.

---

## Return format

When complete, paste the following back into the orchestrator session:

```
Session T1L0 complete.

Files changed:
  - <git diff stat output, each file with insertions/deletions>

Acceptance criteria:
  1. Migrations apply cleanly:               [pass / fail + notes]
  2. Empty table is queryable:                [pass / fail + notes]
  3. DB_PATH exported:                        [pass / fail + notes]
  4. ROBIN_DB propagates:                     [pass / fail + notes]
  5. KEY_PATTERN exported:                    [pass / fail + notes]
  6. No regressions:                          [pass / fail + notes]
  7. No out-of-scope changes:                 [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: T1L1 (backend), T2L0 (client foundations), T3 (wiki content).
```

Anything more than the above is overkill — the orchestrator will read git history if it needs more.
