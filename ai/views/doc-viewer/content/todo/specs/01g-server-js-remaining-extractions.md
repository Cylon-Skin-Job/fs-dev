# SPEC-01g: server.js Remaining Extractions (Final Compliance Pass)

## Issue
SPEC-01a–01f are complete and server.js dropped from 1,752 to 649 lines. It is still over the 400-line threshold and still fails the one-sentence test: it does HTTP route handling AND panel path resolution AND WebSocket connection bootstrap AND startup glue. This spec covers the final extractions to bring it to a pure glue file (~200-250 lines).

Dead imports left behind by 01a–01f (uuidv4, spawn, spawnThreadWire, sendToWire, registerWire, unregisterWire, getWireForThread, moveFileWithArchive, config, initDb, createFusionHandlers, createClipboardHandlers, createRecentDocsHandlers, layoutService) were already deleted 2026-06-11, along with the stale "NOTE: x is now imported from y" comments.

## File
`fusion-studio-server/server.js` — 649 lines

## Current Responsibilities (by line range, post-cleanup)
| Job | Lines | Description |
|-----|-------|-------------|
| Imports | 1-50 | Requires for glue wiring |
| Logging override | 54-64 | console.log → server-live.log tee |
| Express setup + static | 66-87 | App, HTTP server, WSS, static dist serving with cache headers |
| HTTP API routes | 90-279 | capabilities (3), transcription mount, panel-file, harnesses (2), view-config, calendar (2), SPA fallback |
| Panel path resolution | 281-380 | sessions map, getProjectRoot, sessionRoots, getPanelPath |
| WS connection handler | 387-590 | Session creation, router wiring, workspace:init payload, panelRoots |
| Startup glue | 593-649 | startServer() call, handler refs, material-symbols mount |

## Extraction Targets

### Extract 1: HTTP Route Modules
**Lines 90-279 → `lib/http/`** (one file per domain, mounted from server.js)
- `lib/http/capabilities-routes.js` — warm + STT prompt get/put (lines 92-135)
- `lib/http/panel-file-route.js` — fuzzy-match file serving (lines 141-177)
- `lib/http/harness-routes.js` — list + status (lines 181-205)
- `lib/http/view-config-route.js` — CSS layers + layout resolution (lines 207-243)
- `lib/http/calendar-routes.js` — calendars + events (lines 245-274)
- Each exports a `createRouter(deps)` factory (matches `lib/screenshot/router.js` and `lib/transcription` pattern already in use)
- Needs injected: `getProjectRoot`, `getPanelPath` (panel-file, view-config only)
- SPA fallback stays in server.js — it is ordering-critical glue

### Extract 2: Panel Path Resolver
**Lines 281-380 → `lib/views/panel-paths.js`** (or extend existing `lib/views`)
- `getProjectRoot()`, `setSessionRoot()`, `getSessionRoot()`, `clearSessionRoot()`, `getPanelPath()`
- `sessions` and `sessionRoots` Maps move with their accessors
- Export a factory `createPanelPathResolver({ workspaceController, views })` returning the five functions plus the `sessions` Map (server.js and startup.js both need the Map reference)

### Extract 3: Connection Init Payload Builder
**Lines 503-590 → `lib/ws/connection-init.js`**
- Builds the `workspace:init` message (workspaces, cliConfig, themes, pre-read style files, cachedStates) and the `panel_roots` / `panel_config` payload
- Pure assembly: takes `projectRoot`, returns message objects; server.js does the `ws.send()`
- One job: "assemble the initial state payloads a new connection needs"

### Extract 4: Logging Tee
**Lines 54-64 → `lib/logging.js`**
- `installLogTee(logFilePath)` — installs the console.log override
- Must be called before anything else logs; first require in server.js

### Extract 5: Material Symbols Mount → startup.js
**Lines 626-645 → move into `lib/startup.js`**
- It is a startup concern (DB lookup → static mount) living in a `.then()` callback
- startup.js needs the `app` reference injected (currently only gets `server`)

## Resulting server.js (~200-250 lines)
Imports, Express/WSS creation, static serving, route mounting, SPA fallback, WS connection handler that wires the three per-connection factories (wire message router, wire lifecycle, client message router), startServer() call. Describable in one sentence: "wires the HTTP routes, WebSocket routers, and startup orchestrator together."

## Dependencies
- 01a–01f complete (they are)
- No dependency on remaining specs 02-22

## Gotchas

### Middleware ordering — CRITICAL (inherited from SPEC-01)
Order must remain: express.json → static dist → /api/screenshot → API routes → SPA fallback LAST. The SPA fallback regex excludes /api/ and /material-symbols/, but route modules mounted AFTER the fallback are unreachable. Mount everything in server.js in the current order; do not let route modules self-mount.

### `sessions` Map is shared three ways
`sessions` is read by server.js (connection handler), passed into `startServer()` (startup.js), and captured by `getProjectRoot`. After Extract 2 all three must reference the SAME Map instance — export the Map from the resolver factory, never create a second one.

### getProjectRoot has dual mode
With a `ws` argument it resolves per-connection root (workspace switching); without, server-wide active workspace. Both panel-file route (no ws) and getPanelPath (ws) depend on this. Preserve the optional-parameter signature exactly.

### Per-connection projectRoot is mutable
`session.projectRoot` is reassigned by the `workspace:switched` listener (line 419-424). Extract 3's payload builder must take `projectRoot` as an argument at call time, never capture it at factory-creation time.

### Logging tee install order
The console.log override must install before `getHarnessMode()` logs at line 31. If Extract 4 moves the install after other requires, early startup lines silently stop reaching server-live.log.

## Silent Fail Risks
| Risk | What Breaks | Symptom |
|------|-------------|---------|
| Route module mounted after SPA fallback | API returns index.html | Panel files/harness list silently broken |
| Second `sessions` Map created | Workspace switches don't propagate to file ops | Files resolve against old workspace root |
| Payload builder captures stale projectRoot | workspace:init shows previous workspace after switch | Client renders wrong workspace state |
| `getPanelPath` not injected into panel-file route | Tiled-rows views (doc-viewer/agents-viewer) 404 on images | Screenshots broken only in some views |

## Verification
- `node --check server.js` passes
- Server starts, http://localhost:3001 returns 200
- `/api/harnesses` returns JSON (not index.html) — proves route ordering intact
- Open a doc-viewer page with an embedded screenshot — proves panel-file resolver injection
- Switch workspace, open a file — proves shared sessions Map
- `wc -l server.js` ≤ 250
