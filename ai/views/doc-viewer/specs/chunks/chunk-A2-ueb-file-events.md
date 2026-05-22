# Chunk A2 — UEB File Events (dispatch.js + hooks.js → bus listeners)

**Phase:** 0 (follow-on to Chunk A)
**Depends on:** Chunk A (complete)
**Spec written:** 2026-05-21
**Status:** Ready for handoff

← [ROADMAP-REVISED.md](../ROADMAP-REVISED.md)

---

## Goal

`tickets-watcher.js` and `wiki-watcher.js` exist because Chunk A needed drop-in
replacements for the inline `fs.watch` calls. They are transitional files — not
the final architecture. This chunk removes them.

`workspace-watcher.js` already sees every file event in the project. It should
emit those events onto the UEB so any domain can subscribe without owning a
watcher. `dispatch.js` and `hooks.js` become UEB listeners. `tickets-watcher.js`
and `wiki-watcher.js` are deleted.

This also makes ticket dispatch and wiki hooks expressible as TRIGGERS.md entries
in the future — no code required.

---

## Current State (post Chunk A)

| File | Role | Problem |
|------|------|---------|
| `lib/watch/tickets-watcher.js` | Wraps core.js for dispatch.js | Transitional — a domain owns its own watcher |
| `lib/watch/wiki-watcher.js` | Wraps core.js for hooks.js | Same |
| `lib/tickets/dispatch.js` | Imports watchIssuesDir from tickets-watcher | Should subscribe to UEB, not filesystem |
| `lib/wiki/hooks.js` | Imports watch from wiki-watcher | Same |
| `lib/watch/workspace-watcher.js` | Fires filter callbacks on file events | Should also emit `file:changed` on UEB |

---

## Changes

### 1. `lib/watch/workspace-watcher.js` — emit on UEB

After building the context and notifying filters, emit `file:changed` on the
event bus for every event:

```js
const { emit } = require('../event-bus');

// Inside notifyFilters(), after the filter loop:
emit('file:changed', {
  filePath,       // relative path from project root
  event,          // 'create' | 'modify' | 'delete' | 'rename'
  context,        // full buildContext() result
});
```

For rename events, emit twice — one for the old path, one for the new:
```js
emit('file:changed', { filePath: oldPath, event: 'delete', context: oldCtx });
emit('file:changed', { filePath: newPath, event: 'create', context: newCtx });
```

This does not replace the filter system — filters still fire. The UEB emission
is additive. Both paths coexist.

---

### 2. `lib/tickets/dispatch.js` — UEB listener

Remove the `watchIssuesDir` import and call. Add a `on('file:changed', ...)` 
listener that replicates the same path + extension filtering:

```js
const { on } = require('../event-bus');

function startDispatchWatcher(issuesDir) {
  on('file:changed', ({ filePath, event }) => {
    const abs = path.join(projectRoot, filePath);
    if (!abs.startsWith(issuesDir)) return;
    if (!filePath.endsWith('.md')) return;
    handleChange(event, abs);
  });
}
```

`handleChange` is the existing dispatch logic — do not touch it.

---

### 3. `lib/wiki/hooks.js` — UEB listener

Same pattern. Remove the `wiki-watcher` import. Add `on('file:changed', ...)`
with path filtering matching the wiki content directory:

```js
on('file:changed', ({ filePath, event }) => {
  if (!filePath.startsWith('ai/views/wiki-viewer/content/')) return;
  if (!filePath.endsWith('.md')) return;
  handleWikiChange(event, filePath);
});
```

Mirror the existing path and event filters exactly. Do not change hook logic.

---

### 4. Delete transitional files

- `lib/watch/tickets-watcher.js`
- `lib/watch/wiki-watcher.js`

Delete only after UEB listeners are confirmed working via smoke tests.

---

## Smoke Tests

- [ ] Edit a ticket `.md` file → `dispatch.js` handler fires (same behavior as before)
- [ ] Edit a wiki `PAGE.md` → `hooks.js` handler fires (same behavior as before)
- [ ] Edit an unrelated file (e.g. `server.js`) → neither dispatch nor hooks fires
- [ ] `file:changed` event appears on UEB for every workspace file save (verify via temporary bus listener log)
- [ ] `grep -r "tickets-watcher\|wiki-watcher" lib/` → zero hits after deletion

---

## Future State (not this chunk)

Once TRIGGERS.md gains `type: file-change` entries that route through the UEB,
the `on('file:changed')` listeners in `dispatch.js` and `hooks.js` can be
replaced by TRIGGERS.md blocks — no code required. That migration is deferred
to Phase 7 (AI-Native Layer / trigger system maturation).
