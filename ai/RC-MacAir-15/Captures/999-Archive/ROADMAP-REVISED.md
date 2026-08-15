# Fusion Studio — View Architecture Migration Roadmap (Revised)

> Revised from ROADMAP.md. Do not edit the original — treat it as the decision archive.
> This file reflects resolved issues and corrected phase ordering.
> Issues are resolved one at a time; each resolution produces an enriched SPEC in `specs/chunks/`.

---

## Resolved Issues

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Phase 0 Connectors depend on Phase 1.9 watcher — dependency inversion | Move watcher to Phase 0. Connectors become Phase 1. |
| 2 | Duplicate section numbers (1.5, 1.6, 1.7 appear twice) | Renumbered sequentially under Phase 2 in this document. |
| 3 | Electron main process location unconfirmed | Confirmed: `fusion-studio-client/electron/main.cjs`. IPC handler pattern established. Protocol registration slots into `app.whenReady()` before `createWindow()`. |
| 4 | `ai/<machine>/System/styles/` → `ai/<machine>/System/` scope — is it actually trivial? | Not trivial — 9 production files reference it. Rename + subfolder reorganization. Final structure: `config/` (cli.json), `state/` (state.json, workspace.json), `styles/` (themes.json + all CSS), `data/` (SQLite — Phase 2.7). Chunk B spec must include post-rename grep assertion: zero hits for `ai/<machine>/System` before marking done. |
| 5 | Phase 3 first view: Issues-viewer or Doc-viewer? | Issues-viewer first — not a port, a full redesign. Spec at `specs/chunks/chunk-J-issues-viewer.md`. Doc-viewer migrates second as a simpler follow-on. |
| 6 | ContentArea transition: dual-track fallback or hard cutover? | Dual-track. `ContentArea.tsx` checks for `app/index.html` first — if present, mount iframe; if not, fall through to existing React component. One `if` statement, zero disruption. Dead React components removed in a single cleanup pass after all views migrate. |
| 7 | Three preloaded workspaces require `fusion.db` schema changes | Migration 023 adds `is_system boolean default false`. Guard in `workspace-controller.js` rejects remove if `is_system = true`. Seeding happens in first-run bootstrap (not migrations) — after folders are created, `registry-service.seedSystemWorkspaces()` uses INSERT OR IGNORE. Phases 2.10 + 2.11 merged into one chunk: folder creation and DB seeding are the same operation. |
| 8 | No server spawning in `main.cjs` — app ships broken without it | Added Chunk K. Server spawns as managed child process. Port via OS-assigned bind-to-0 + SERVER_READY signal. Port file written to App Support for user script access. |

---

## Code Standards Constraint (All Chunks)

From `enforcement/code-standards/PAGE.md` — applies to every chunk spec:

- **One job per file.** Describable in one sentence without "and."
- **Chokidar consumers are separate files.** `lib/watch/core.js` exports the subscription API. Each consumer (`calendar-watcher.js`, `views-watcher.js`, etc.) is its own file — it imports from `core.js` and handles only its domain.
- **Extract when the second consumer appears** — not before.
- **Over 400 lines = doing too much.** Split it.

---

## Phase Order (Revised)

| Phase | Name | Was | Chunk Spec |
|-------|------|-----|------------|
| **0** | File Watcher Core | 1.9 | `specs/chunks/chunk-A-watcher-core.md` |
| **1** | Connectors (macOS integrations) | 0 | `specs/chunks/chunk-F-connectors.md` |
| **2** | Infrastructure | 1 | Multiple chunks B–I |
| **3** | System Views | 2 | TBD |
| **4** | Core Content Views (migration) | 3 | TBD |
| **5** | Specialized Views | 4 | TBD |
| **6** | Media Views | 5 | TBD |
| **7** | AI-Native Layer | 6 | TBD |

---

## Phase 0 — File Watcher Core (was Phase 1.9)

**Goal:** Single centralized chokidar subscription API. All filesystem watching flows through here. Must land before Connectors so connector modules never touch raw `fs.watch`.

### 0.1 `lib/watch/core.js`
- Exports `subscribe({ id, path, options, handler })` — returns unsubscribe function
- One chokidar instance manager, multiple consumers
- `followSymlinks: true`
- Debounce built into chokidar config (remove hand-rolled debounce from callers)

### 0.2 Consumer Files (each separate, each one job)
| Consumer File | Replaces | Watches |
|---------------|----------|---------|
| `lib/watch/calendar-watcher.js` | `lib/calendar/apple/watcher.js` | Apple Calendar SQLite |
| `lib/watch/views-watcher.js` | *(new)* | `<workspace>/ai/<machine>/Views/` |
| Existing `fs.watch` sites in `lib/watcher/index.js`, `lib/tickets/dispatch.js`, `lib/wiki/hooks.js` | → migrate to `core.js` | per-domain paths |

### Smoke Tests (Phase 0)
- [ ] `subscribe()` returns working unsubscribe — second call stops events
- [ ] Calendar watcher fires on `.sqlitedb` change after refactor
- [ ] Views watcher emits `views:added`, `views:removed`, `views:changed`
- [ ] No duplicate events on rapid file saves (debounce confirmed)
- [ ] `followSymlinks: true` — change to a symlinked file fires event

---

## Phase 1 — Connectors (was Phase 0)

**Goal:** Centralize every external macOS system integration into one opt-in panel. Connectors use `lib/watch/core.js` exclusively — no raw `fs.watch`.

### 1.1 Connectors Panel UI
- Simple checklist: click to toggle each connector on/off
- Status indicators: gray / yellow / green / red
- Last sync timestamp per connector

### 1.2 macOS Permission Handling
- TCC permissions: Calendar, Reminders, Photos
- Full Disk Access: Mail, Messages, Notes
- Graceful degradation on denial
- State persisted in `permissions.json`

### 1.3 Connector Modules
Each is a separate file in `lib/connectors/`. One job per file.

| File | Source | Target Table |
|------|--------|--------------|
| `lib/connectors/calendar.js` | `Calendar.sqlitedb` | `calendar_events`, `calendar_sources` |
| `lib/connectors/reminders.js` | Reminders TCC API | `reminders` |
| `lib/connectors/mail.js` | `~/Library/Mail/` | `emails` |
| `lib/connectors/messages.js` | `~/Library/Messages/` | `messages` |
| `lib/connectors/notes.js` | group.com.apple.notes | `notes` |
| `lib/connectors/photos.js` | Photos TCC API | `photos` |

### 1.4 External Files via Symlink Only
- No external folder pickers. Symlink into workspace via Finder or `ln -s`
- `lib/watch/core.js` `followSymlinks: true` handles events natively

### Open Decisions (Phase 1)
- [ ] Sync frequency: on-demand only, or background polling every N min?
- [ ] Schema evolution: macOS updates that change Calendar/Reminders DB schemas?
- [ ] Permission revocation during active sync: queue, abort, or error state?
- [ ] Photos connector scope: thumbnails or metadata-only?
- [ ] Threading: main server process or worker thread per connector?

### Smoke Tests (Phase 1)
- [ ] Toggle Calendar → permission dialog → events in `fusion.db`
- [ ] Toggle Reminders → reminders sync to central DB
- [ ] Symlink `~/Downloads/contract.pdf` → File-Viewer shows symlink icon → edits emit events
- [ ] Deny permission → connector stays gray → no crash

---

## Phase 2 — Infrastructure (was Phase 1)

> Section numbering corrected here. Original had duplicate 1.5, 1.6, 1.7 blocks.
> Pending Issue 2 resolution — numbers will be finalized after that discussion.

### 2.1 Filesystem Restructure
- Rename `ai/<machine>/System/styles/` → `ai/<machine>/System/` (9 production files updated — see Chunk B)
- Final subfolder structure:
  - `ai/<machine>/System/config/` → `cli.json`
  - `ai/<machine>/System/state/` → `state.json`, `workspace.json` (new workspace descriptor)
  - `ai/<machine>/System/styles/` → `themes.json` + all CSS files
  - `ai/<machine>/System/data/` → `workspace.db`, `solobooks.db` (created in Phase 2.7)
- `index.json` convention preserved: `state/workspace.json` is the workspace descriptor (not `index.json`, which means "describes the folder" everywhere else in the project)
- Post-rename: grep entire codebase for `ai/<machine>/System` — must return zero hits before Chunk B is marked done

### 2.2 System Files Workspace
- `System Files/views/`, `skills/`, `hooks/`, `agents/`, `scripts/`, `triggers/`
- Template discovery on boot
- Template instantiation API

### 2.3 View Loader & Lifecycle
- Replace `ContentArea.tsx` static map with dynamic view loader *(transition strategy TBD — see Issue 6)*
- `PanelWrapper` mounts views via iframe (default) or shadow DOM (opt-in)
- Register `fusion-studio://` custom protocol *(Electron location TBD — see Issue 3)*
- Warm views: all iframes created on workspace load, CSS toggle for switching
- Secure `postMessage`: explicit `fusion-studio://` origin, validate in views

### 2.4 Theme Token Bridge
- Shell reads `ai/<machine>/System/theme.json` + slider values
- Broadcasts computed tokens to active view via `postMessage`
- View receives tokens, writes CSS custom properties to `:root`

### 2.5 Right-Click Add View
- Context menu populated from `System Files/views/`
- Auto-number view IDs: `wiki-viewer-01`, `wiki-viewer-02`

### 2.6 iCloud Backup Scripts
- Create iCloud backup folder on first run
- Backup/restore scripts for `workspace.db`
- Periodic sync trigger

### 2.7 Versioning Database (SQLite)
- Schema: `file_versions`, `checkpoints`, `undo_stack`, `diffs`
- FIFO 20 diffs, checkpoint at 21
- Daily, AI-mod, and file-close checkpoint automation

### 2.8 Decouple FS Home from Code Repo
- App boots without source files as workspace
- `System Files` as reference, not editable project

### 2.9 Workspace Lifecycle (Add, Switch, Remove)
- Unified `createWorkspace()` API
- Add from project folder or create new
- No workspace templates — only view templates
- Welcome chat on new workspace

### 2.10 System Files Copy/Merge Engine
- Bundled seed → copy on first run
- Merge on update: add new templates, preserve user customizations
- `instantiateTemplate(templateId, workspacePath)` API

### 2.11 Three Preloaded Workspaces
*(Pending Issue 7 resolution — may require fusion.db schema changes)*

| Workspace | ID | Views |
|-----------|----|-------|
| Fusion Home | `fusion-home` | File explorer, Issues, Wiki, Tools |
| Media Studio | `media-studio` | Media Studio, Library, File explorer |
| System Files | `system-files` | Tools (primary), File explorer |

### 2.12 Process Architecture (Three Layers)
- Server owns all business logic
- Electron main owns native OS APIs
- Renderer owns UI, view mounting, postMessage

### Open Decisions (Phase 2)
- [ ] View load failure: error placeholder or silent skip?
- [ ] SQLite contention: queue writes or fail fast?
- [ ] iCloud fallback: skip silently or show modal?
- [ ] Protocol fallback: `file://` or refuse launch?
- [ ] Keyboard shortcuts map
- [ ] Notification system: toasts / badges / modals
- [ ] Build tool: electron-builder or electron-forge?
- [ ] Auto-update strategy
- [ ] Sleep/wake: WebSocket and watcher behavior
- [ ] Safe mode for crashing views
- [ ] Max views per workspace

### Smoke Tests (Phase 2)
- [ ] Template discovery finds all views in `System Files`
- [ ] Add View creates functional folder in workspace
- [ ] Theme tokens reach view iframe and apply CSS variables
- [ ] iCloud backup folder creates and receives `.db` file
- [ ] SQLite checkpoints persist and are queryable
- [ ] `fusion-studio://` serves view HTML/CSS/JS without CORS errors
- [ ] All view iframes load warm; switching is instant (CSS toggle only)
- [ ] File watcher detects added/removed views and emits UEB events
- [ ] Calendar watcher continues working post-refactor

---

## Phase 3 — System Views (was Phase 2)

*(Unchanged from original — System Views: Calendar, Reminders, Email)*

---

## Phase 4 — Core Content Views / Migration (was Phase 3)

> Migration order TBD — see Issue 5.

- 4.1 First view migration *(Issues-viewer or Doc-viewer — pending)*
- 4.2 Wiki-Viewer
- 4.3 Office-Viewer
- 4.4 Remaining views
- 4.5 File-Viewer (privileged, last)

---

## Phase 5 — Specialized Views (was Phase 4)

*(Unchanged: Library View, Spending View)*

---

## Phase 6 — Media Views (was Phase 5)

*(Unchanged: Video Editor, Audio Editor)*

---

## Phase 7 — AI-Native Layer (was Phase 6)

*(Unchanged: Skills, CLI Hooks, Tools-Viewer GUI, Activity Ledger, Dynamic System Prompt)*

---

## Chunk Spec Index

Enriched handoff specs live in `ai/<machine>/Views/doc-viewer/specs/chunks/`.

| Chunk | File | Phase | Depends On | Status |
|-------|------|-------|------------|--------|
| A | [chunk-A-watcher-core.md](chunks/chunk-A-watcher-core.md) | 0 | — | **complete** |
| A2 | [chunk-A2-ueb-file-events.md](chunks/chunk-A2-ueb-file-events.md) | 0 (follow-on) | A | **complete** |
| K | [chunk-K-server-spawn.md](chunks/chunk-K-server-spawn.md) | 2 (prereq) | — | **complete** |
| B | [chunk-B-filesystem-restructure.md](chunks/chunk-B-filesystem-restructure.md) | 2.1 | A | **complete** |
| C | [chunk-C-custom-protocol.md](chunks/chunk-C-custom-protocol.md) | 2.3 (partial) | K, B | **complete** |
| D | [chunk-D-view-loader-iframe.md](chunks/chunk-D-view-loader-iframe.md) | 2.3 | C | **complete** |
| E | [chunk-E-theme-token-bridge.md](chunks/chunk-E-theme-token-bridge.md) | 2.4 | D | **complete** |
| F | `chunk-F-connectors.md` | 1 | A | *pending* |
| G | `chunk-G-system-files-engine.md` | 2.10 | B | *pending* |
| H | `chunk-H-view-discovery-add.md` | 2.2 + 2.5 | G, D | *pending* |
| I | `chunk-I-versioning-db.md` | 2.7 | B | *pending* |
| J | [chunk-J-issues-viewer.md](chunks/chunk-J-issues-viewer.md) | 4.1 | D, E | *pending* |

### Chunk K — Managed Server Spawn + Port Negotiation

**Goal:** `main.cjs` owns the server process lifecycle. App is distributable without manual server startup. Port conflict is impossible.

**What changes in `main.cjs`:**
- Spawn `fusion-studio-server/server.js` as a child process inside `app.whenReady()`
- Server binds to port `0` (OS assigns a guaranteed-free port)
- Server writes `SERVER_READY:{port}` to stdout when bound
- `main.cjs` reads that signal before calling `createWindow()`
- `createWindow()` loads `http://localhost:{port}` (not hardcoded 3001)
- On `app.quit()`, kill the child process

**Port file for user scripts:**
- On `SERVER_READY`, write port to `~/Library/Application Support/Fusion Studio/server.port`
- Clear the file on `app.quit()`
- User scripts: `PORT=$(cat ~/Library/Application\ Support/Fusion\ Studio/server.port)`
- Tools-Viewer Scripts tab exposes this automatically — users don't need to know the file path

**Files (one job each, per code standards):**
- `electron/server-spawn.cjs` — spawns child, listens for `SERVER_READY`, returns port promise
- `electron/port-file.cjs` — writes/clears `server.port` in App Support
- `main.cjs` — imports both, orchestrates in `app.whenReady()`, no spawn logic inline

**Smoke Tests:**
- [ ] App launches with server already on 3001 → no crash, uses different port
- [ ] `server.port` file exists after launch, contains correct port
- [ ] `server.port` file is deleted after quit
- [ ] Server crash → `main.cjs` detects exit, shows dialog or respawns (decision needed)
- [ ] Renderer connects to correct port after spawn signal

**Decision:** Server crash → show Electron dialog "Server crashed, restarting…" → respawn. Dialog dismisses automatically when `SERVER_READY` signal received.
