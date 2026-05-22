# Handoff: Fusion Studio View Architecture — Session 3

**Date:** 2026-05-22
**Context:** Resumed from 2026-05-19 handoff. This session was a test-and-fix pass on Chunks A/A2/K/B, then wrote and implemented Chunk C. Five chunks are now complete and the app boots cleanly.
**Status:** Ready for Chunk D implementation.

---

## What Was Done This Session

### Chunks Completed (5)

| Chunk | Name | Ticket |
|-------|------|--------|
| A | File Watcher Core (`lib/watch/core.js`) | RCC-0080 |
| A2 | UEB File Events (`file:changed` on event-bus) | RCC-0081 |
| K | Managed Server Spawn + Port Negotiation | RCC-0082 |
| B | Filesystem Restructure (`ai/settings/` → `ai/system/`) | RCC-0083 |
| C | Custom Protocol `fusion-studio://` | RCC-0084 |

All five are filed as closed tickets in `ai/views/issues-viewer/done/`.

### Bug Fixes Found During Testing

1. **ABI mismatch** — `server-spawn.cjs` was using `process.execPath` (Electron binary, ABI 146) to spawn the server. `better-sqlite3` compiled for system node (ABI 141) crashed on load. Fix: `execSync('which node')` to find system binary.

2. **WebSocket hardcoded port** — `ws-client.ts` had `ws://localhost:3001`. After Chunk K the server runs on a dynamic port. Fix: `ws://${window.location.host}`.

3. **Force-reload CSS bug** — `workspace:init` in `server.js` (line 516) was pre-reading CSS from `ai/settings/` (old path → empty). Client called `injectWorkspaceStyles([])` which stripped all CSS. Fix: corrected to `ai/system/styles`.

4. **Four Chunk B path misses** — `themes-service.js` (2), `workspace-broadcaster.js` (1), `server.js` `/api/view-config` (1) — all still referenced `ai/settings/`. Found via grep audit after testing.

5. **EMFILE: too many open files** — chokidar `ignored` option received simple strings (`'node_modules'`). These don't match against absolute paths. Fix: pass a function that converts absolute → relative before calling `isExcluded()`.

### Other Work

- **`agents-viewer/AGENTS.md`** — rewrote entirely; was describing `kimi-claude` from two project revisions ago. Now describes Fusion Studio with correct workspace layout, agent categories, and ticket format (`RCC-NNNN`).
- **KIMI stub tickets** — purged from `kimi-claude` and `solobooks` workspace `tickets.json` files.
- **Ticket copy-path button** — added `link_2` hover button to every ticket card in the issues viewer. Copies absolute file path to clipboard. Pattern matches wiki viewer's existing link button.
- **Roadmap ↔ chunk links** — ROADMAP-REVISED.md chunk index entries are now markdown links. Each chunk file has a `← ROADMAP-REVISED.md` back link.
- **ast-grep installed** — `sg` v0.42.3 at `/opt/homebrew/bin/sg`. Global CLAUDE.md updated with usage guidance and when to use vs grep.

---

## Current State of the App

The app boots cleanly in Electron. Verified:
- Server spawns on a dynamic port; `server.port` file written to App Support
- `fusion-studio://` protocol registered and serving files from active workspace
- CSS loads correctly on initial boot and workspace switch
- File watcher running without EMFILE errors
- Issues viewer shows 8 real RCC tickets in the Inbox column; KIMI stubs gone

---

## What's Next: Chunk D

**Spec location:** needs to be written — `ai/views/doc-viewer/specs/chunks/chunk-D-view-loader-iframe.md`

**Depends on:** Chunk C (complete)

**Goal:** Replace `ContentArea.tsx` static panel map with a dynamic iframe loader. Views mount as `<iframe src="fusion-studio://{viewId}/index.html">` inside `PanelWrapper`.

**First task per ROADMAP note:**
> Delete `lib/watch/views-watcher.js`, replace with `file:changed` UEB listener filtering `ai/views/` paths. No view ever gets its own backend watcher.

**Key decisions already resolved (from ROADMAP-REVISED.md Issue 6):**
- Dual-track transition: `ContentArea.tsx` checks for `app/index.html` first — if present, mount iframe; if not, fall through to existing React component.
- Dead React components removed in a single cleanup pass after all views migrate.
- Warm views: all iframes created on workspace load, CSS toggle for active/inactive.
- Secure `postMessage`: validate `fusion-studio://` origin in views.

**Files that will change:**
- `src/components/ContentArea.tsx` — add dual-track iframe mount
- `src/components/PanelWrapper.tsx` (may need creating) — iframe host component
- `fusion-studio-server/lib/watch/views-watcher.js` — DELETE this file
- Some server listener replacing it (UEB `file:changed` filter on `ai/views/`)

---

## Key File Locations

| What | Path |
|------|------|
| Roadmap | `ai/views/doc-viewer/specs/ROADMAP-REVISED.md` |
| Chunk D spec (to write) | `ai/views/doc-viewer/specs/chunks/chunk-D-view-loader-iframe.md` |
| Chunk C spec (complete) | `ai/views/doc-viewer/specs/chunks/chunk-C-custom-protocol.md` |
| Protocol handler | `fusion-studio-client/electron/protocol-handler.cjs` |
| Server spawn | `fusion-studio-client/electron/server-spawn.cjs` |
| Workspace watcher | `fusion-studio-server/lib/watch/workspace-watcher.js` |
| Views watcher (to delete) | `fusion-studio-server/lib/watch/views-watcher.js` |
| ContentArea | `fusion-studio-client/src/components/ContentArea.tsx` |
| Code Standards | `System Files/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md` |

---

## Orchestration Notes

- Background workers execute; IDE Claude (orchestrator) plans, assigns, verifies, commits.
- Never commit directly — report results and let the operator commit.
- Check `git log` and `git status` at session start to see what background sessions did.
- Next session should: write Chunk D spec → assign to background worker → verify → commit → continue.
