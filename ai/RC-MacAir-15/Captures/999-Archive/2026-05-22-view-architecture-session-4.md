# Handoff: Fusion Studio View Architecture — Session 4

**Date:** 2026-05-22
**Context:** Resumed from Session 3 handoff. Session 3 expected Chunk D as the next task. This session completed Chunk D, committed all prior chunks (A–C, K, B), absorbed a background session's Chunk E implementation, generated tickets for F–J, and created a project overview doc for wiki agents.
**Status:** Ready for Chunk G implementation. Seven chunks complete (A, A2, K, B, C, D, E).

---

## What Was Done This Session

### Chunks Completed (7)

| Chunk | Name | Ticket | Commit |
|-------|------|--------|--------|
| A | File Watcher Core | RCC-0080 | `96ae139` |
| A2 | UEB File Events | RCC-0081 | `96ae139` |
| K | Managed Server Spawn | RCC-0082 | `96ae139` |
| B | Filesystem Restructure | RCC-0083 | `96ae139` |
| C | Custom Protocol | RCC-0084 | `96ae139` |
| D | Iframe View Loader | RCC-0085 | `75b08bd` |
| E | Theme Token Bridge | RCC-0086 | `c465260` |

All seven are filed as closed tickets in `ai/<machine>/Issues/closed/`.

### Chunk D Details

- Deleted `fusion-studio-server/lib/watch/views-watcher.js` (standalone watcher redundant; workspace watcher already covers `ai/<machine>/Views/`)
- Removed views-watcher import/startup from `lib/startup.js`
- Added `hasAppHtml` probe to `loadPanelConfig` in `lib/panels.ts` — checks for `app/index.html` during panel discovery
- Rewrote `ContentArea.tsx` with dual-track logic: `config.hasAppHtml` → iframe via `fusion-studio://`, else existing static React component map
- Added `.rv-view-iframe` CSS rule in `App.css`
- No existing views have `app/index.html` yet, so all panels fall through to React components — zero disruption

### Chunk E Details (background session implementation)

- `useThemeTokenBridge.ts` — DOM-observing hook that parses CSS custom properties from theme style tags and broadcasts structured tokens to all `.rv-view-iframe` elements
- `MutationObserver` on theme tag re-broadcasts on CSS swap (theme changes, slider adjustments)
- Body-level `MutationObserver` detects newly-added iframes and sends current tokens immediately
- `App.tsx` wired with `useThemeTokenBridge()` call
- Spec written: `chunk-E-theme-token-bridge.md`
- View contract documented: validate `event.origin === 'fusion-studio://'`, write tokens to `:root`

### Ticket Housekeeping

- RCC-0080–0085 moved from `done/` → `closed/` (proper folder convention per ticket system)
- RCC-0086 closed and moved to `closed/`
- RCC-0087–0091 generated for remaining chunks F–J
- `tickets.json` index updated for all changes
- Created `fusion-tickets` skill to prevent future dual-source sync mistakes

### Wiki Overview Doc

Created `docs/FUSION_STUDIO_OVERVIEW.md` for wiki agents — covers architecture, event bus, harnesses, view migration, chunk status, key file locations.

---

## Current State of the App

The app boots cleanly in Electron. Verified:
- Server spawns on dynamic port; `server.port` file written to App Support
- `fusion-studio://` protocol registered and serving files from active workspace
- CSS loads correctly on initial boot and workspace switch
- File watcher running without EMFILE errors
- Theme token bridge broadcasts computed CSS tokens to all warm iframes
- Issues viewer shows 14 open + 6 closed RCC tickets in correct columns

---

## What's Next: Chunk G

**Spec location:** needs to be written — `ai/<machine>/Views/doc-viewer/specs/chunks/chunk-G-system-files-engine.md`

**Depends on:** Chunk B (complete)

**Blocked by:** —

**Goal:** Build the engine that copies bundled System Files seed to the user's home on first run, then merges updates (add new templates, preserve user customizations).

**Why G before F:** G unblocks H (View Discovery & Add), which is a Phase 2 infrastructure dependency. F (Connectors) is Phase 1 and independent — can be done anytime, but completing the infrastructure chain first is cleaner.

**What needs to happen:**
1. Write Chunk G spec
2. First-run seed copy: detect first run, copy `System Files/` templates to `~/Fusion Studio/System Files/`, create `first-run.json` bookkeeping
3. Merge engine: on app update, compare bundled seed vs user copy; add new templates, preserve user modifications
4. Template instantiation API: `instantiateTemplate(templateId, workspacePath)` — copies a view template into a workspace's `ai/<machine>/Views/`, auto-numbers IDs (`wiki-viewer-01`, `wiki-viewer-02`)
5. Template discovery on boot: scan `System Files/views/` for available templates, expose to client for "Add View" context menu

**Files that will likely change:**
- New: `fusion-studio-server/lib/system-files/engine.js`
- New: `fusion-studio-server/lib/system-files/discovery.js`
- New: `fusion-studio-server/lib/system-files/merge.js`
- Modified: `fusion-studio-server/lib/startup.js` — first-run check

---

## Remaining Chunks After G

| Order | Chunk | Depends On | Why This Order |
|-------|-------|-----------|----------------|
| 2 | H | G, D | View Discovery needs G's instantiate API |
| 3 | I | B | Independent SQLite versioning — slots cleanly here |
| 4 | F | A | Phase 1 connectors — independent, do anytime |
| 5 | J | D, E | Issues-viewer redesign — last because it's the first real iframe view and validates everything |

---

## Key File Locations

| What | Path |
|------|------|
| Roadmap | `ai/<machine>/Views/doc-viewer/specs/ROADMAP-REVISED.md` |
| Chunk G spec (to write) | `ai/<machine>/Views/doc-viewer/specs/chunks/chunk-G-system-files-engine.md` |
| Overview doc | `docs/FUSION_STUDIO_OVERVIEW.md` |
| System Files templates | `System Files/views/`, `System Files/ai/<machine>/Views/` |
| Theme bridge hook | `fusion-studio-client/src/hooks/useThemeTokenBridge.ts` |
| Event Bus | `fusion-studio-server/lib/event-bus.js` |
| Watcher Core | `fusion-studio-server/lib/watch/core.js` |
| Protocol Handler | `fusion-studio-client/electron/protocol-handler.cjs` |
| ContentArea | `fusion-studio-client/src/components/ContentArea.tsx` |
| Panel Config Loader | `fusion-studio-client/src/lib/panels.ts` |
| Ticket Index | `ai/<machine>/Issues/content/tickets.json` |
| Open Tickets | `ai/<machine>/Issues/inbox/` |
| Closed Tickets | `ai/<machine>/Issues/closed/` |

---

## Orchestration Notes

- Background workers execute; IDE Claude (orchestrator) plans, assigns, verifies, commits.
- Check `git log` and `git status` at session start to see what background sessions did.
- Next session should: write Chunk G spec → assign to background worker → verify → commit → continue.
