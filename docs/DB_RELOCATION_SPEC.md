# DB Relocation — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Prerequisite for:** Electron wrap, clean empty-state testing.
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

`robin.db` currently lives at `<workspace>/ai/system/robin.db` — inside a workspace. This is wrong. The DB holds app-level state (workspace registry, system theme, system config) that exists above any individual workspace. A new workspace shouldn't contain (or bootstrap) a system database.

This spec moves `robin.db` to `open-robin-server/data/robin.db` — a server-owned, workspace-independent location. The `data/` directory already exists and holds `config.json`. When Electron ships, the path changes to `app.getPath('userData')/robin.db` — a one-line change.

After this:
- **App-level state** lives at `server/data/robin.db` (or Electron `userData`)
- **Workspace state** lives at `<repo>/ai/views/` — threads, wiki, content, view settings
- **No more `ai/system/`** — workspaces don't create or own it
- A clean install starts with an empty DB, zero workspaces, empty state UI

---

## 2. Current state

| Path | Contents | Status |
|---|---|---|
| `ai/system/robin.db` | Live DB — workspace registry, themes, config, wiki, threads | **Active** — this is the one `initDb` opens |
| `server/data/robin.db` | Empty file, no tables | Stale — leftover from an earlier experiment |
| `server/data/config.json` | Old `lastProject` config | Still read by now-deleted `getDefaultProjectRoot()` — dead code |

---

## 3. Changes

### 3a. `lib/db.js` — change DB path

The `initDb` function currently receives `projectRoot` and builds the path as `<projectRoot>/ai/system/robin.db`. Change it to use a fixed app-level path:

**Before:**
```js
async function initDb(projectRoot) {
  const systemDir = path.join(projectRoot, 'ai', 'system');
  fs.mkdirSync(systemDir, { recursive: true });
  instance = knex({
    connection: { filename: path.join(systemDir, 'robin.db') },
    ...
  });
}
```

**After:**
```js
async function initDb() {
  const dataDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  instance = knex({
    connection: { filename: path.join(dataDir, 'robin.db') },
    ...
  });
}
```

- `initDb` no longer takes a `projectRoot` argument. The path is `<server>/data/robin.db`, resolved from `__dirname` (which is `lib/`).
- `data/` is created if it doesn't exist (idempotent).
- When Electron ships, this single path changes to `app.getPath('userData') + '/robin.db'`. One line.

### 3b. `lib/startup.js` — simplify initDb call

**Before:**
```js
const bootstrapRoot = path.resolve(__dirname, '..', '..');
await initDb(bootstrapRoot);
```

**After:**
```js
await initDb();
```

Remove the `bootstrapRoot` variable entirely.

### 3c. `lib/workspace/bootstrap-service.js` — remove `ai/system/`

The `DIRS` array currently includes `'ai/system'`. Remove it. Workspaces only get `ai/views/`:

**Before:**
```js
const DIRS = [
  'ai',
  'ai/views',
  'ai/views/chat',
  'ai/views/chat/threads',
  'ai/system',
];
```

**After:**
```js
const DIRS = [
  'ai',
  'ai/views',
  'ai/views/chat',
  'ai/views/chat/threads',
];
```

### 3d. `.gitignore` — update paths

The server `.gitignore` currently ignores `ai/system/*.db`. Update to ignore `data/robin.db`:

**Before:**
```
ai/system/*.db
ai/system/*.db-journal
ai/system/*.db-wal
```

**After:**
```
data/robin.db
data/robin.db-journal
data/robin.db-wal
```

### 3e. Migrate the live data

The existing `ai/system/robin.db` has the live data (workspace registry, themes, config, wiki, thread metadata). Copy it to `server/data/robin.db` (replacing the empty stale file):

```bash
cp ai/system/robin.db open-robin-server/data/robin.db
```

This is a one-time operation. After the code changes land and the server restarts, it reads from the new location. The old `ai/system/robin.db` can be deleted (but doesn't hurt if left — nothing reads it).

### 3f. Clean up dead code

`server/data/config.json` held the `lastProject` field that `getDefaultProjectRoot()` read. That function is now deleted. `config.json` is dead. It can be deleted or left — nothing reads it.

---

## 4. What this does NOT change

- **DB schema.** No migration needed. The file is copied as-is.
- **Knex migrations directory.** Still at `lib/db/migrations/`. Unchanged.
- **Any workspace's `ai/views/` tree.** Workspaces are unaffected.
- **The workspace controller.** It reads from `getDb()` which returns the singleton — doesn't care where the file lives.
- **The Electron path.** That's a future one-liner: swap `path.join(__dirname, '..', 'data')` for `app.getPath('userData')`.

---

## 5. Clean install test

After this spec lands, to test a fresh empty-state install:

1. Stop the server.
2. Delete `server/data/robin.db`.
3. Start the server.
4. Migrations run against a fresh DB. Zero workspaces. Zero config rows.
5. Client connects → `workspace:init` with `workspaces: [], activeWorkspaceId: null`.
6. Client renders empty state → "Add Project" tile.
7. Click Add → folder picker → select a repo → workspace created → panels discover → app is live.

No workspace has `ai/system/` injected. The DB lives with the app.

---

## 6. Files changed

| File | Change |
|---|---|
| `lib/db.js` | Remove `projectRoot` param from `initDb`. Resolve path as `<server>/data/robin.db`. |
| `lib/startup.js` | `await initDb()` — no argument. Remove `bootstrapRoot` variable. |
| `lib/workspace/bootstrap-service.js` | Remove `'ai/system'` from `DIRS`. |
| `.gitignore` (server) | Update ignore patterns from `ai/system/` to `data/`. |
| `server/data/robin.db` | Replace stale empty file with copy of `ai/system/robin.db`. |

**Total:** 3 files edited, 1 file copied, 1 gitignore updated.
