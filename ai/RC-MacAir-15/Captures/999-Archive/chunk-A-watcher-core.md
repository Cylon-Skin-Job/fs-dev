# Chunk A — File Watcher Core

**Phase:** 0 (prerequisite — must land before all other chunks)
**Depends on:** nothing
**Spec written:** 2026-05-21
**Status:** Ready for handoff

← [ROADMAP-REVISED.md](../ROADMAP-REVISED.md)

---

## Goal

Replace all `fs.watch` usage in the server with a centralized chokidar subscription
API. Every domain that needs filesystem events imports from `lib/watch/core.js` and
gets its own consumer file. No domain manages its own watcher after this chunk lands.

---

## Current State

| File | Watch mechanism | Problem |
|------|----------------|---------|
| `lib/watcher/index.js` | `fs.watch` recursive | Hand-rolled debounce, no symlink support, rename detection is fragile |
| `lib/calendar/apple/watcher.js` | chokidar (standalone) | Duplicates chokidar setup, not wired through core |
| `lib/tickets/dispatch.js` | `fs.watch` inline (lines 172, 177) | Debounce map duplicated inline |
| `lib/wiki/hooks.js` | `fs.watch` inline (lines 174, 200) | Same |

---

## Target State

```
lib/watch/
├── core.js                 ← chokidar manager — subscribe/unsubscribe/closeAll
├── workspace-context.js    ← buildContext, statDir, statFile, isExcluded (moved from watcher/index.js)
├── workspace-watcher.js    ← replaces lib/watcher/index.js — uses core.js, keeps filter system
├── calendar-watcher.js     ← replaces lib/calendar/apple/watcher.js — uses core.js
├── views-watcher.js        ← new — watches ai/<machine>/Views/, emits UEB events
├── tickets-watcher.js      ← new — extracts fs.watch from dispatch.js
└── wiki-watcher.js         ← new — extracts fs.watch from wiki/hooks.js
```

Files deleted after migration is confirmed working:
- `lib/watcher/index.js`
- `lib/calendar/apple/watcher.js`

Files updated (imports only, no logic change):
- `lib/watcher/filters/*` — update import path from `lib/watcher` to `lib/watch/workspace-context`
- `lib/tickets/dispatch.js` — remove inline `fs.watch`, import from `lib/watch/tickets-watcher`
- `lib/wiki/hooks.js` — remove inline `fs.watch`, import from `lib/watch/wiki-watcher`
- `server.js` — update require from `lib/watcher` to `lib/watch/workspace-watcher`

---

## File Specs

### `lib/watch/core.js`

One job: manage chokidar instances and expose a subscribe/unsubscribe API.

```js
// subscribe({ id, path, options, handler }) → unsubscribe function
// unsubscribe(id)
// closeAll()
```

**Instance sharing:** one chokidar instance per unique watched path. All subscribers
on the same path share the instance. The first subscriber's options win for that path
(document this constraint in a comment — it is intentional, not a bug).

**chokidar config (defaults, overridable per subscription):**
```js
{
  followSymlinks: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  ignored: [],
}
```

`awaitWriteFinish` replaces all hand-rolled debounce in callers. Do not add a
separate debounce layer on top of it.

**API:**
```js
// Returns an unsubscribe function
const unsub = subscribe({
  id: 'tickets-watcher',
  path: '/abs/path/to/watch',
  options: { ignored: ['*.log'], depth: 2 },
  handler: (event, filePath) => { /* event: 'add'|'change'|'unlink'|'addDir'|'unlinkDir' */ },
});

unsub(); // removes subscriber, closes chokidar instance if no other subscribers remain
closeAll(); // call on server shutdown
```

**Error handling:** wrap each handler call in try/catch. Log the error with the
subscriber ID. Never let one handler crash others.

---

### `lib/watch/workspace-context.js`

One job: build event context objects for workspace file events.

Move these functions verbatim from `lib/watcher/index.js` — do not rewrite:
- `buildContext(projectRoot, filePath, event)` → `{ parentDir, type, ext, basename, delta, parentStats, fileStats }`
- `statDir(absoluteDir)` → `{ files, folders }`
- `statFile(absolutePath)` → `{ lines, words, tokens, size }`
- `isExcluded(filePath, excludes)` → boolean

Export all four. This module has no imports from `core.js` — it is pure utility.

---

### `lib/watch/workspace-watcher.js`

One job: watch the project root and route file events to registered domain filters.

Replaces `lib/watcher/index.js`. Keeps the filter system (`addFilter`), exclude
patterns, rename detection, and context building — but drives them from `core.js`
rather than `fs.watch`.

**What changes:**
- Replace `fs.watch(projectRoot, { recursive: true }, handleFileEvent)` with
  `subscribe({ id: 'workspace', path: projectRoot, options: { ignored: DEFAULT_EXCLUDES }, handler: handleFileEvent })`
- Remove hand-rolled debounce maps (`pending`, `pendingModify`) — chokidar's
  `awaitWriteFinish` handles this
- Keep rename detection logic (the `recentDeletes` window) — chokidar does not
  synthesize rename events from add+unlink pairs, so this logic remains necessary
- Keep `buildContext` usage via import from `workspace-context.js`
- Keep `DEFAULT_EXCLUDES` list — pass as `ignored` to subscribe options

**Exports:** `{ createWatcher }` — same API as before so `server.js` needs only
an import path change, not a logic change.

---

### `lib/watch/calendar-watcher.js`

One job: watch the Apple Calendar directory and call a trigger on change.

Replaces `lib/calendar/apple/watcher.js`. Uses `core.js` instead of its own
chokidar instantiation.

**What changes:**
- Replace direct `chokidar.watch(...)` with `subscribe({ id: 'calendar', path: CALENDAR_DIR, options: { depth: 0, awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 } }, handler })`
- Remove the local `debounce()` helper — `awaitWriteFinish` replaces it
- Keep `CALENDAR_DIR` constant, keep the `start(onTrigger)` export signature so callers need no changes

---

### `lib/watch/views-watcher.js`

One job: watch `<workspace>/ai/<machine>/Views/` and emit UEB events when views are added,
removed, or changed.

New file — no existing code to migrate.

```js
const { subscribe } = require('./core');
const { emit } = require('../event-bus');

function start(projectRoot) {
  const viewsPath = path.join(projectRoot, 'ai', 'views');
  return subscribe({
    id: 'views',
    path: viewsPath,
    options: { depth: 1, ignored: [] },
    handler(event, filePath) {
      const rel = path.relative(viewsPath, filePath);
      const viewId = rel.split(path.sep)[0];
      if (!viewId) return;

      if (event === 'addDir') emit('views:added', { viewId });
      else if (event === 'unlinkDir') emit('views:removed', { viewId });
      else emit('views:changed', { viewId, filePath: rel, event });
    },
  });
}

module.exports = { start };
```

`depth: 1` — only watch the top-level view folders and their immediate contents.
Do not watch thread history, run logs, or chat inside view folders.

---

### `lib/watch/tickets-watcher.js`

One job: watch the issues-viewer folder and call handlers when ticket files change.

Extracts the `fs.watch` calls from `lib/tickets/dispatch.js` (lines 172, 177).

```js
const { subscribe } = require('./core');

function watchIssuesDir(issuesDir, onChange) {
  return subscribe({
    id: 'tickets',
    path: issuesDir,
    options: { ignored: ['*.json'], depth: 2 },
    handler: (event, filePath) => {
      if (!filePath.endsWith('.md')) return;
      onChange(event, filePath);
    },
  });
}

module.exports = { watchIssuesDir };
```

Update `lib/tickets/dispatch.js`:
- Remove the `fs.watch` block and its debounce map
- Import `{ watchIssuesDir }` from `lib/watch/tickets-watcher`
- Call `watchIssuesDir(issuesDir, handleChange)` in `startDispatchWatcher`

---

### `lib/watch/wiki-watcher.js`

One job: watch wiki content folders and call handlers when wiki files change.

Extracts the `fs.watch` calls from `lib/wiki/hooks.js` (lines 174, 200).

Examine the exact paths and handler signatures in `hooks.js` before implementing —
mirror the existing call signatures exactly so `hooks.js` changes are import-only.

---

## Migration Order

Execute in this order to keep the server running throughout:

1. Create `lib/watch/core.js` and `lib/watch/workspace-context.js`
2. Create `lib/watch/workspace-watcher.js` — update `server.js` import
3. Verify workspace watcher works: save a file, confirm events fire
4. Create `lib/watch/calendar-watcher.js` — update caller import
5. Create `lib/watch/tickets-watcher.js` — update `dispatch.js`
6. Create `lib/watch/wiki-watcher.js` — update `hooks.js`
7. Create `lib/watch/views-watcher.js` — wire into server startup
8. Update `lib/watcher/filters/*` import paths
9. Delete `lib/watcher/index.js` and `lib/calendar/apple/watcher.js`

Do not delete old files until step 8 is complete and smoke tests pass.

---

## Smoke Tests

- [ ] Save a workspace file → watcher fires, existing filter handles it (same behavior as before)
- [ ] Calendar `.sqlitedb` touched → calendar-watcher fires trigger
- [ ] Create new ticket `.md` in `open/` → tickets-watcher fires, dispatch picks it up
- [ ] Wiki `PAGE.md` modified → wiki-watcher fires hook
- [ ] Add a new folder to `ai/<machine>/Views/` → `views:added` emitted on event bus
- [ ] Remove a folder from `ai/<machine>/Views/` → `views:removed` emitted
- [ ] Symlink a file into workspace → change to symlinked file fires workspace-watcher event
- [ ] Rapid saves to same file → only one event fires (awaitWriteFinish confirmed working)
- [ ] `unsubscribe()` called → events stop; no further handler calls
- [ ] Two subscribers on same path → one unsubscribes → other still fires
- [ ] `grep -r "fs\.watch" lib/` → zero hits (post-migration assertion)
- [ ] `grep -r "require.*watcher/index" .` → zero hits (no old import paths remain)

---

## What NOT to Change

- Filter logic inside `lib/watcher/filters/*` — logic is correct, only import paths change
- `dispatch.js` dispatch logic — only the `fs.watch` setup changes
- `hooks.js` hook logic — only the `fs.watch` setup changes
- The `createWatcher` return API (`{ close, addFilter }`) — `server.js` must not need logic changes
