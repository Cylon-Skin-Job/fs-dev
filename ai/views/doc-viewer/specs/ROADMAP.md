# Fusion Studio — View Architecture Migration Roadmap

## Project Context

- **App Name:** Fusion Studio
- **Repository:** `fs-dev` (current working repo)
- **Runtime:** Electron wrapper around a React/Vite client + Node.js server
- **Platform Target:** macOS primary (System Views leverage native Calendar/Reminders/Mail)

## Vision

Transform Fusion Studio from a monolithic React SPA into a **local-first, view-based workspace shell**. Views become self-contained HTML/CSS/JS plugins discovered from the filesystem. The app provides the container, theme tokens, and data layer. Views provide the rendering.

## Architectural Principles

1. **Views are folders**, not code. Drop a folder into `ai/views/`, it appears in the app.
2. **Shell owns the chrome**. Tools panel, chat sidebar, layout grid, theme tokens, and view lifecycle are the shell's responsibility.
3. **Views own their rendering**. Each view ships its own HTML, CSS, and JS. It consumes shell tokens via `postMessage`.
4. **System data is centralized**. `ai/system/data/` (renamed from `settings`) holds workspace state, view configuration, and the SQLite versioning database.
5. **Mac-integrated data stays global**. Calendar, Reminders, and Email sync to a central system database. Any workspace can mount a view that reads this data.
6. **Templates are separate from instances**. `System Files` is a reference workspace shipping with the app. Users instantiate views from templates into their own workspaces.
7. **Git is optional**. Local SQLite versioning is primary. Git is the emergency parachute.

## Distribution & First-Run Setup

Fusion Studio is distributed as an Electron binary. The `System Files` template library is **bundled inside the binary** and copied to the user's filesystem on first launch. No network download is required for core functionality.

### Bundled Seed Model

```
Inside Electron .app bundle:
└── Contents/Resources/System Files/
    ├── views/         # View templates
    ├── agents/        # Agent templates (legacy, migrating to tools)
    ├── skills/        # AI skill definitions
    ├── hooks/         # Per-CLI hook configs
    ├── scripts/       # Sample automation
    ├── triggers/      # Trigger definitions
    └── manifest.json  # Built-in template inventory + version
```

### First-Run Copy Sequence

On launch, the main process checks for `~/Fusion Studio/System Files/`:

```
Does ~/Fusion Studio/System Files/ exist?
├── No → Copy entire seed from app bundle
│        Create ~/Fusion Studio/System Files/
│        Copy views/, agents/, scripts/, triggers/, skills/, hooks/
│        Write system-manifest.json (tracks seed version)
│        Log: "System Files initialized"
└── Yes → Merge mode
         Read built-in manifest.json from app bundle
         Read system-manifest.json from user folder
         For each template in built-in manifest:
             If not in user folder → copy it (new template!)
             If exists in user folder → skip (preserve user customization)
         Update system-manifest.json to match built-in version
         Log: "N new templates added"
```

### Why This Model

| Approach | Pros | Cons |
|----------|------|------|
| **Bundled seed + copy** (chosen) | Works offline; instant first launch; user can customize templates; updates merge gracefully | Slightly larger binary (~few MB) |
| **Download on install** | Smaller binary | Requires internet; slower setup; fragile download failures; not local-first |
| **Read-only inside app.asar** | Clean updates | User can't customize templates in-place; harder to fork |

### Update Behavior

- **App updates** ship new templates in the bundle. The merge step adds them without touching existing user templates.
- **User customizations** survive forever. If they edited `System Files/views/wiki/style.css`, that file is never overwritten.
- **New template versions** appear alongside old ones (e.g., `wiki/` and `wiki-v2/`) or the user must explicitly delete their old copy to receive the new version.

### Folder Locations

| Path | Purpose |
|------|---------|
| `~/Fusion Studio/System Files/` | Reference templates (copied from bundle) |
| `~/Fusion Studio/Back Ups/` | iCloud-synced workspace databases |
| `~/projects/` or user-defined | Actual user workspaces |
| `~/Library/Application Support/Fusion Studio/` | Electron app data, central `system.db`, logs |

### iCloud Backup & First Run

The iCloud backup folder (`~/Library/Mobile Documents/.../Fusion Studio/Back Ups/`) is also created during first-run setup, but only if the user opts in or if iCloud Drive is available.

---

## Phase 0: Connectors (System Integration Layer)

**Goal:** Centralize every external system integration into one opt-in panel. This is the permission gate and the data faucet for all System Views.

### 0.1 Connectors Panel UI
- [ ] Build `Connectors` panel (menu item or view)
- [ ] Simple checklist UI: click to toggle each connector on/off
- [ ] No dropdown lists, no folder pickers in this panel — just check/uncheck
- [ ] Status indicators: gray (needs permission), yellow (connecting), green (active), red (error)
- [ ] Last sync timestamp per connector

### 0.2 macOS Permission Handling
- [ ] Request TCC permissions on toggle: Calendar, Reminders, Photos
- [ ] Request Full Disk Access for: Mail, Messages, Notes
- [ ] Graceful degradation: if permission denied, connector stays off, user can retry
- [ ] Store permission state in `~/Library/Application Support/Fusion Studio/permissions.json`

### 0.3 Connector Modules
Each connector is a small module in `lib/connectors/` that reads from macOS and writes to `fusion.db`:

| Connector | Source | Target Table in `fusion.db` |
|-----------|--------|---------------------------|
| Apple Calendar | `Calendar.sqlitedb` | `calendar_events`, `calendar_sources` |
| Apple Reminders | Reminders TCC API | `reminders` |
| Apple Mail | `~/Library/Mail/` | `emails` |
| Apple Messages | `~/Library/Messages/` | `messages` |
| Apple Notes | `~/Library/Group Containers/group.com.apple.notes/` | `notes` |
| Apple Photos | Photos TCC API | `photos` |

- [ ] Build `lib/connectors/calendar.js` (refactor existing watcher)
- [ ] Build `lib/connectors/reminders.js`
- [ ] Build `lib/connectors/mail.js`
- [ ] Build `lib/connectors/messages.js`
- [ ] Build `lib/connectors/notes.js`
- [ ] Build `lib/connectors/photos.js`

### 0.4 External Files via Symlink ONLY
- [ ] **No external folder lists in dropdowns.** User symlinks files/folders into the workspace using Finder or `ln -s`
- [ ] File-Viewer already identifies symlinks with a separate icon — preserve this
- [ ] `lib/watch/core.js` follows symlinks (`followSymlinks: true` in chokidar)
- [ ] File changes through symlinks emit `file:changed` UEB events natively — no special handling needed
- [ ] Workspace treats symlinked files as native; UEB has full access
- [ ] Export/save operations use native macOS picker as usual

### Smoke Tests (Phase 0)
- [ ] Toggle Calendar connector → permission dialog → events appear in `fusion.db`
- [ ] Toggle Reminders connector → reminders sync to central DB
- [ ] Symlink `~/Downloads/contract.pdf` into workspace → File-Viewer shows it with symlink icon → edits emit UEB events
- [ ] Deny permission → connector stays gray → no crash

### Decisions (Phase 0)
- [ ] **Sync frequency:** On-demand only, or background polling? (e.g., every 5 min when connector is active)
- [ ] **Schema changes:** How to handle future macOS updates that change Calendar/Reminders/Mail database schemas?
- [ ] **Permission revocation:** What happens if user revokes TCC permission while connector is actively syncing?
- [ ] **Photos connector scope:** Download thumbnails to workspace, or store metadata-only in `fusion.db`?
- [ ] **Threading:** Do connectors run in the main server process or in a worker thread?

---

## Phase 1: Infrastructure (Foundation)

**Goal:** Build the shell and plumbing that all future views depend on. No view migration yet.

### 1.1 Filesystem Restructure
- [ ] Rename `ai/settings/` → `ai/system/` (pre-launch, no migration needed)
- [ ] Create `ai/system/data/` for per-workspace SQLite databases
  - `workspace.db` — file versioning, checkpoints, undo/redo
  - `solobooks.db` — bookkeeping data (Spending view, optional per workspace)
- [ ] Create `ai/system/state.json` for layout/view states
- [ ] Create `ai/system/theme.json` for base design tokens
- [ ] **Scope clarification:** `fusion-studio-server/data/fusion.db` remains **global** (workspace registry, chat, calendar, reminders, email). `ai/system/data/` is **per-workspace**.

### 1.2 System Files Workspace
- [ ] Create `System Files` reference workspace (ships with app)
  - `System Files/views/` — view templates (File-Viewer, Wiki, Office, Calendar, Email, Library, Spending, Tools, Issues, Doc)
  - `System Files/skills/` — AI skill definitions (markdown + tool schemas)
  - `System Files/hooks/` — per-CLI hook configurations (Claude, Kimi, Codex, Anti-Gravity)
  - `System Files/agents/` — agent templates (legacy)
  - `System Files/skills/` — AI skill definitions (markdown + tool schemas)
  - `System Files/hooks/` — per-CLI hook configurations (Claude, Kimi, Codex, Anti-Gravity)
  - `System Files/scripts/` — sample automation (backup, restore)
  - `System Files/triggers/` — event trigger definitions
- [ ] Build template discovery: shell scans `System Files/views/` on boot
- [ ] Build template instantiation: copy template folder to active workspace's `ai/views/`

### 1.3 View Loader & Lifecycle
- [ ] Replace `ContentArea.tsx` static component map with dynamic view loader
- [ ] Build `PanelWrapper` that can mount views via **iframe** (default) or **shadow DOM** (opt-in)
- [ ] Register `fusion-studio://` custom protocol in `app.whenReady()` before creating BrowserWindow
- [ ] Map protocol to workspace `ai/views/` folder and `System Files` templates
- [ ] **Warm views:** Create all view iframes on workspace load; toggle `active` CSS class for switching (same as current React memo pattern)
- [ ] View discovery: shell scans `ai/views/` on workspace load, re-scans on `views:changed` UEB event
- [ ] View registration: read `index.json`, `content.json`, `settings.json` from view folder
- [ ] View cleanup: unmount removes iframe/shadow DOM, clears listeners (destroy `postMessage` handlers)
- [ ] **Secure postMessage:** Use explicit `fusion-studio://` origin (not `*`) for all shell ↔ iframe communication; validate `event.origin` in views; allow `http://localhost:5173` in dev mode only
- [ ] **View dependency subscriptions:** Views declare watched files/folders via `fusion.subscribe(path)`; shell maintains subscription map; only subscribed views receive `postMessage` events
- [ ] **Granular DOM updates via postMessage:** Event payload includes `{ path, change, diff }`; views update only affected elements (insert row, update text, animate removal) without full rebuild or screen flash

### 1.4 Theme Token Bridge
- [ ] Shell reads `ai/system/theme.json` + slider values
- [ ] Shell computes live tokens (base × slider attenuation)
- [ ] Shell broadcasts tokens to active view via `postMessage`
- [ ] View receives tokens and writes CSS custom properties to `:root`
- [ ] Support view-private tokens via `settings.json` overrides

### 1.5 Right-Click Add View
- [ ] Context menu on workspace panel: "Add View"
- [ ] Menu populated from `System Files/views/` templates
- [ ] Click copies template to workspace `ai/views/<name>/`
- [ ] **Auto-number view IDs:** On copy, assign sequential ID `wiki-viewer-01`, `wiki-viewer-02`, etc. Hard-coded `id` in template `index.json` is rewritten to the next available number. `label` auto-increments (`Wiki`, `Wiki 2`, `Wiki 3`) unless user overrides.
- [ ] **Migration:** Rewrite all existing `index.json` files in user workspaces and `System Files/views/` templates to use the new numbered scheme. Built-in views become the `-01` baseline.
- [ ] Remove View: delete folder from `ai/views/`, shell updates panel config

### 1.6 iCloud Backup Scripts
- [ ] Create `~/Library/Mobile Documents/com~apple~CloudDocs/Fusion Studio/Back Ups/` on first run
- [ ] Build backup script: copy `ai/system/data/workspace.db` to iCloud backup folder
- [ ] Build restore script: pull `.db` from iCloud back to local workspace
- [ ] Build workspace-folder creation: new workspace gets matching iCloud backup folder
- [ ] Build periodic sync (every N minutes or on checkpoint)

### 1.7 Versioning Database (SQLite)
- [ ] Schema: `file_versions`, `checkpoints`, `undo_stack`, `diffs`
- [ ] FIFO + checkpoint algorithm: last 20 changes as diffs, checkpoint at 21
- [ ] Daily checkpoint automation
- [ ] AI-modification checkpoint automation (before any AI tool call)
- [ ] File-close checkpoint automation
- [ ] Smoke Test: create workspace, edit file, verify checkpoint chain in SQLite

### 1.8 Decouple FS Home from Code Repo
- [ ] App boots without requiring its own source files as a workspace
- [ ] `System Files` loads as reference, not as editable project
- [ ] User workspaces are distinct from app installation

### 1.9 File Watcher Core (Centralized)
- [ ] Extract `lib/watch/core.js` — single chokidar subscription API
  - `subscribe({ id, path, options, handler })` — returns unsubscribe function
  - One chokidar instance manager, multiple consumers
  - `followSymlinks: true` (enables external file monitoring via symlink)
- [ ] Refactor `lib/calendar/apple/watcher.js` to use `watch/core.js`
- [ ] **Audit and migrate all existing `fs.watch` usage to `watch/core.js`:**
  - Find all `fs.watch` calls in `lib/watcher/index.js`, `lib/tickets/dispatch.js`, `lib/wiki/hooks.js`
  - Replace with `watch/core.js` `subscribe()` calls
  - Remove duplicate debounce logic (chokidar handles this)
  - Delete standalone watcher modules once migrated
- [ ] Build `lib/views/watcher.js` — watches `<workspace>/ai/views/`, emits to UEB
  - Emits: `views:changed`, `views:added`, `views:removed`
- [ ] **Route watcher events to subscribed views:** UEB receives file change → shell looks up subscription map → sends targeted `postMessage` to affected view iframes only
- [ ] Do NOT watch `System Files` continuously; scan on boot and "Add View" menu open

### 1.5 Workspace Lifecycle (Add, Switch, Remove)
- [ ] **Unified workspace creation API** — one function called from any entry point (Electron menu, AI chat, keyboard shortcut, RPC)
  - `createWorkspace({ source: 'folder' | 'new', path?, name? })`
  - Returns workspace ID, becomes active immediately
  - Same code path regardless of how it was triggered
- [ ] **Add from Project Folder** — macOS file picker, validate folder exists, create `ai/` substructure, preserve existing files
- [ ] **Add New Workspace** — text input for name, create at `~/projects/{name}/`, populate default structure
- [ ] **No workspace templates — only view templates.** On workspace creation, instantiate individual views from `System Files/views/`. User (or AI) picks which views to include. No pre-packaged "workspace template."
- [ ] **Copy/clone view templates** on workspace creation:
  - Copy templates from `System Files/views/` to workspace `ai/views/`
  - Auto-number IDs: `file-viewer-01`, `issues-01`, `wiki-01`, `tools-01`
  - Rewrite `index.json` id + label for each copied view
  - Deterministic: same inputs always produce same workspace structure
- [ ] **Activate on create** — new workspace immediately becomes `activeWorkspaceId`, panel config loads, chat sidebar resets
- [ ] **Welcome chat message** — generic system message injected into new workspace chat:
  > *"Welcome to {workspaceName}. I've set up the basics — file explorer, issues, wiki, and tools. Say 'Create New' to chat about finishing your workspace setup."*
- [ ] **Remove workspace** — set `ribbonVisible = false`, soft-reset session state, keep file explorer tabs (24h grace period, then hard reset)

### 1.6 System Files Copy/Merge Engine
- [ ] **Copy on first run:** Bundle `System Files/` seed → `~/Fusion Studio/System Files/`
- [ ] **Merge on update:** Built-in manifest vs user manifest, add new templates without overwriting user customizations
- [ ] **Template instantiation API:** `instantiateTemplate(templateId, workspacePath)` — copies folder, rewrites `index.json`, auto-numbers ID
- [ ] **Deterministic copy:** Hash template contents, skip if already present; never overwrite user-modified files

### 1.7 Three Preloaded Workspaces

Three workspaces are always present and preloaded on app launch. They are not user-deletable:

| Workspace | ID | Purpose | Views |
|-----------|-----|---------|-------|
| **Fusion Home** | `fusion-home` | Default landing workspace, onboarding, quick access | File explorer, Issues, Wiki, Tools (minimal) |
| **Media Studio** | `media-studio` | Video/audio editing, asset library | Media Studio, Library, File explorer |
| **System Files** | `system-files` | Global template management, CLI hooks, skills | **Tools** (primary), File explorer |

**System Files is special:**
- Hosts the global Tools view that manages skills, hooks, scripts, triggers
- Other workspaces can add a Tools view, but it always points back to `~/Fusion Studio/System Files/`
- System Files is the source of truth for all view templates
- Changes to System Files templates propagate to new workspace instantiations (existing workspaces keep their copies)

### 1.10 Process Architecture (Three Layers)

Fusion Studio is **desktop-first, GUI-required**. The server and Electron are bundled — when the app quits, everything stops. No background daemons, no headless mode. The anti-black-box principle means the user always sees what the app is doing.

```
┌─────────────────────────────────────────┐
│  Electron Main Process                  │
│  - Window management                    │
│  - Native menus, dialogs, notifications │
│  - Custom protocol registration         │
│  - Screenshots, exports                 │
└──────────────┬──────────────────────────┘
               │ IPC (native OS bridge)
┌──────────────▼──────────────────────────┐
│  Renderer Process (React)               │
│  - UI rendering, view mounting          │
│  - Theme computation, CSS injection     │
│  - postMessage broadcasting to views    │
│  - WebSocket client to server           │
└──────────────┬──────────────────────────┘
               │ WebSocket (app logic)
┌──────────────▼──────────────────────────┐
│  Node Server (fusion-studio-server)     │
│  - File watching (chokidar)             │
│  - SQLite (fusion.db, workspace.db)     │
│  - File explorer, tickets, wiki, chat   │
│  - Business logic, UEB routing          │
└─────────────────────────────────────────┘
```

**Server keeps the brain.** Moving file watching or SQLite to the Electron main process would kill headless/server mode forever. The server is the constant; Electron is the optional UI shell.

**Future LAN/home-server mode** (post-MVP, distant future): A separate fork where the server runs standalone and the renderer is a browser on a phone/tablet. Not the current architecture's concern.

### Ownership Rules

| Concern | Owner | Why |
|---------|-------|-----|
| File watching, SQLite, business logic | **Server** | Must survive without Electron; headless/server mode possible later |
| Window, menus, dialogs, protocol | **Main process** | Native OS APIs, no alternative |
| UI rendering, themes, view mounting | **Renderer** | Browser environment required |
| `postMessage` to views | **Renderer** | Iframes live in renderer DOM |
| File open/save dialogs | **Main → Renderer** | Main triggers native dialog, returns path to renderer |
| Workspace menu updates | **Renderer → Main** | Renderer knows workspace list; tells main to rebuild menu |
| Media player audio backend | **Server** | Decoupled from UI; can play while user works elsewhere |

### IPC Channels

| Channel | Direction | Payload |
|---------|-----------|---------|
| `menu-action` | Main → Renderer | `{ type: 'open-theme-picker' }` |
| `workspace:menu-update` | Renderer → Main | `{ workspaces: [...], activeId: '...' }` |
| `dialog:showOpen` | Renderer → Main → Renderer | `{ title, filters }` → `{ canceled, filePaths }` |
| `protocol:register` | Main | `fusion-studio://` mapped to workspace paths |
| `backup:trigger` | Renderer → Server | `{ workspaceId, reason: 'checkpoint' }` |
| `theme:broadcast` | Renderer → View iframes | `{ type: 'theme:tokens', tokens }` |

### Smoke Tests (Phase 1)
- [ ] Template discovery finds all views in `System Files`
- [ ] Add View creates functional folder in workspace
- [ ] Theme tokens reach view iframe and apply CSS variables
- [ ] iCloud backup folder creates and receives `.db` file
- [ ] SQLite checkpoints persist and are queryable
- [ ] `fusion-studio://` protocol serves view HTML/CSS/JS without CORS errors
- [ ] All view iframes load warm; switching views is instant (CSS toggle only)
- [ ] File watcher detects added/removed views and emits UEB events
- [ ] Calendar watcher continues working after refactor to `watch/core.js`

### Decisions (Phase 1)
- [ ] **View load failure:** If a view's `index.json` is malformed or `app.js` throws on load, show error placeholder or skip silently?
- [ ] **SQLite contention:** If `workspace.db` is locked by another process, queue writes or fail fast?
- [ ] **iCloud fallback:** If iCloud path is unavailable on first run, silently skip backup setup or show modal?
- [ ] **Protocol fallback:** If `fusion-studio://` registration fails (rare), fallback to `file://` or refuse to launch?
- [ ] **Keyboard shortcuts:** Full shortcut map — `Cmd+1/2/3` for workspace switching? `Cmd+K` command palette? `Cmd+Shift+N` new workspace?
- [ ] **Notification system:** Toast popups (bottom-right), badge counts on icons, or modal dialogs? Or all three for different severities?
- [ ] **Context menus:** Right-click in file explorer = native menu or custom styled menu? Right-click on ticket card = move/assign/close?
- [ ] **Build tool:** `electron-builder` or `electron-forge`? Code signing strategy?
- [ ] **Auto-update:** `electron-updater`, Sparkle, or manual download? Check on launch or background?
- [ ] **Sleep/wake:** What happens to WebSocket connections and file watchers when macOS sleeps?
- [ ] **Safe mode:** If a view crashes the renderer on load, blacklist it or retry with dev tools?
- [ ] **Max views:** Hard limit on views per workspace? (e.g., 20) or unlimited?
- [ ] **View ordering:** Who controls sidebar order — user drag-and-drop, or fixed by `rank` in `index.json`?

---

## Phase 2: System Views (Mac Integration)

**Goal:** Build views that read from macOS system databases. These views are global — their data lives in a central system database, and any workspace can mount them.

### 2.1 System Database Design
- [ ] Create `system.db` in app support directory (or `ai/system/data/system.db`)
- [ ] Tables: `calendar_events`, `reminders`, `emails`
- [ ] Sync layer: Electron main process reads from Mac Calendar/Reminders/Mail APIs or `.ics`/SQLite exports
- [ ] Deduplication: system items keyed by native ID to prevent duplicates
- [ ] Sync trigger: on app launch, on view focus, on manual refresh

### 2.2 Calendar View
- [ ] Template: `System Files/views/calendar/`
- [ ] Reads from central `calendar_events` table
- [ ] View config (per-workspace): `shown_calendars: ['Personal', 'Work']`, `default_view: 'week'`
- [ ] Renders month/week/day grid using shell tokens
- [ ] Smoke Test: create event in Mac Calendar → appears in view → checkpoint created

### 2.3 Reminders View
- [ ] Template: `System Files/views/reminders/`
- [ ] Reads from central `reminders` table
- [ ] View config: `shown_lists`, `sort_order`, `show_completed`
- [ ] Smoke Test: check off reminder in Mac Reminders → view updates

### 2.4 Email View
- [ ] Template: `System Files/views/email/`
- [ ] Reads from central `emails` table
- [ ] View config: `shown_accounts`, `unread_only`, `threading`
- [ ] Smoke Test: receive email in Mac Mail → appears in view

### Central Source of Truth Rule
System views **never** write to their own isolated workspace database. They read from the central system DB. Their view-specific settings (filters, sort order) live in the workspace's `ai/system/state.json` under the view ID.

### Smoke Tests (Phase 2)
- [ ] Calendar view mounts in two different workspaces, shows same events
- [ ] Reminder completion in view A reflects in view B after refresh
- [ ] Email view respects per-workspace account filters

### Decisions (Phase 2)
- [ ] **Sync trigger:** System views sync on app launch only, or also on view focus, or on a schedule?
- [ ] **Writeback:** Are system views read-only, or can users create Calendar events / Reminders from within Fusion Studio?
- [ ] **Deduplication key:** Use Apple native ID only, or hash of event content? What if native ID changes?
- [ ] **Offline behavior:** If macOS is offline, show cached data with stale badge, or hide system views entirely?

---

## Phase 3: Core Content Views (Migration)

**Goal:** Migrate existing React-based views to self-contained HTML/CSS/JS folders. One at a time. Each view gets its own `ai/views/<name>/` folder with `index.html`, `style.css`, `app.js`.

### Migration Order (easiest to hardest)

#### 3.1 Doc-Viewer
- [ ] Self-contained HTML/CSS/JS bundle
- [ ] Consumes shell tokens
- [ ] Reads document content from workspace `ai/system/data/` or local files
- [ ] Smoke Test: renders document, respects theme changes

#### 3.2 Wiki-Viewer
- [ ] Self-contained bundle
- [ ] Wiki pages stored in workspace (e.g., `wiki/` folder or SQLite)
- [ ] Internal linking between pages
- [ ] Smoke Test: create page → link to second page → both render

#### 3.3 Office-Viewer
- [ ] Self-contained bundle
- [ ] Grid/tile layout for office apps/quick links
- [ ] Config stored in `ai/system/state.json`
- [ ] Smoke Test: add tile → persists after reload

#### 3.4 Issues-Viewer
- [ ] Self-contained bundle
- [ ] Ticket board (Kanban or list)
- [ ] Data source: workspace files, SQLite, or future GitHub integration
- [ ] Smoke Test: create issue → move to "Done" → state persists

#### 3.5 Tools-Viewer
- [ ] Self-contained bundle
- [ ] Tabbed interface: Skills, Triggers, Scripts, Hooks
- [ ] Skills tab: list discovered skills with summaries, toggle active/inactive
- [ ] Triggers tab: GUI for trigger management (not file explorer)
- [ ] Scripts tab: runnable automation scripts
- [ ] Hooks tab: per-CLI hook status and symlink management
- [ ] Reads from `System Files/skills/`, `System Files/hooks/`, workspace `ai/skills/`, `ai/hooks/`
- [ ] Smoke Test: skill appears → toggled → AI can reference it

#### 3.6 File-Viewer (Privileged)
- [ ] Self-contained bundle with elevated privileges
- [ ] Only view that accesses filesystem outside workspace folder
- [ ] Reads directory trees, file contents
- [ ] Respects macOS sandbox / Electron permissions
- [ ] Smoke Test: browse to `~/Downloads/` → open file → edit → save

### Smoke Tests (Phase 3)
- [ ] Each migrated view loads without React errors
- [ ] Each view applies theme tokens correctly
- [ ] Each view's state persists across reloads
- [ ] Right-click Add View works for all migrated templates

### Decisions (Phase 3)
- [ ] **Migration order:** User directed Issues first, then Tools. Update ROADMAP order or keep Doc-first for logical progression?
- [ ] **Data migration:** When a React view migrates to iframe, does existing state transfer or does the view start fresh?
- [ ] **React cleanup:** During migration, do we keep the old React component as fallback until iframe is stable, or cut over immediately?
- [ ] **View crash isolation:** If one iframe view crashes (e.g., infinite loop in `app.js`), does it bring down the whole renderer or just that iframe?

---

## Phase 4: Specialized Views

**Goal:** Views that don't exist yet or are currently buried inside other concepts.

### 4.1 Library View
- [ ] Media/asset management (images, audio, video clips)
- [ ] Thumbnail grid, metadata, tags
- [ ] Data stored in workspace `ai/system/data/` or local `assets/`
- [ ] Smoke Test: drop image → thumbnail appears → metadata extracted

### 4.2 Spending View (Solobooks)
- [ ] Income/expense tracking
- [ ] Charts using shell token colors
- [ ] Data in workspace SQLite (not central system DB — this is project-specific accounting)
- [ ] **Optional add-on:** Does not ship with binary. Downloaded on demand from menu. License modal on first open (free under $1M income, subscription above). See RCC-0079.
- [ ] Smoke Test: add transaction → category filter → totals update

### 4.3 Email Composer (Extension)
- [ ] If Email view grows, split read (inbox) from write (composer)
- [ ] Composer may be a panel overlay rather than full view
- [ ] Smoke Test: compose → send → appears in sent folder

### Smoke Tests (Phase 4)
- [ ] Library view renders thumbnails without leaking memory
- [ ] Spending view calculates totals correctly after CRUD operations

### Decisions (Phase 4)
- [ ] **Library thumbnails:** Generate on-demand (slow first load) or pre-generate on file drop (background job)?
- [ ] **Spending currency:** Single currency or multi-currency support? Exchange rates API or manual?
- [ ] **Office viewer data format:** JSON files on disk, or SQLite table? (Impacts symlink sync strategy)

---

## Phase 5: Media Views

**Goal:** Heavy visual editors. These are the most complex views and benefit most from isolation.

### 5.1 Video Editor
- [ ] Timeline, preview pane, clip library
- [ ] Reads from workspace `assets/` or `Library/` view
- [ ] Potentially WebGL or canvas-based
- [ ] Data model: project files in `ai/system/data/` or JSON on disk
- [ ] Smoke Test: import clip → trim → save project → reload intact

### 5.2 Audio Editor
- [ ] Waveform display, multi-track timeline
- [ ] Reads from workspace `assets/` or `Library/` view
- [ ] Smoke Test: import audio → split clip → export

### Smoke Tests (Phase 5)
- [ ] Video editor renders 1080p preview without crashing shell
- [ ] Audio editor saves project and restores timeline state

### Decisions (Phase 5)
- [ ] **Hardware acceleration:** Use WebGL/WebGPU for video preview, or CPU canvas fallback?
- [ ] **Codec support:** Which codecs are supported? H.264/HEVC/AV1/VP9? macOS hardware decode only?
- [ ] **Project format:** JSON-based project files (portable) or SQLite (structured queries)?

---

## Phase 6: AI-Native Layer (Future)

**Goal:** Make the workspace fully operable by AI through skills, tools, hooks, and activity context. Not blocking for view migration.

### 6.1 Skills System
- [ ] `System Files/skills/` — built-in skill definitions
  - `skill.json` — identity, description, available tools
  - `prompt.md` — system prompt fragment
  - `tools/*.json` — tool schemas (name, description, parameters)
- [ ] Workspace skills: `ai/skills/` (user-created or copied from templates)
- [ ] Skill discovery: scanned on workspace load, registered in `fusion.db`
- [ ] **Front matter standard:** Every skill has a name + 3-line max summary in `skill.json`
- [ ] Tools exposed per view in `index.json`:
  ```json
  {
    "tools": [
      { "name": "wiki_search", "description": "Search wiki pages", "parameters": {...} }
    ]
  }
  ```

### 6.2 CLI Hook Integration
- [ ] Detect installed CLIs (Claude, Kimi, Codex, Anti-Gravity)
- [ ] Offer symlink onboarding: link Fusion Studio skills to CLI skills folder
- [ ] `~/.claude/skills/fusion-studio → ~/Fusion Studio/System Files/skills/`
- [ ] `~/.kimi/skills/fusion-studio → ~/Fusion Studio/System Files/skills/`
- [ ] Document per-CLI hook format (YAML before-send hooks)
- [ ] **Hook front matter:** `hook.yaml` with name + summary for discoverability

### 6.3 Tools-Viewer GUI (System Files View)
- [ ] Rename `agents-viewer` → `tools-viewer` (icon: `manufacturing` / gears)
- [ ] **System Files workspace:** Preloaded on app launch. Tools view is the primary interface for managing global templates and CLI hooks.
- [ ] Tabbed interface: Skills | Triggers | Scripts | Hooks
- [ ] Skills tab: list with summaries, toggle on/off
- [ ] Triggers tab: GUI control panel (not file explorer)
  - Trigger name, events, match pattern
  - Toggle active/inactive
  - Edit in detail panel with chat sidebar
- [ ] **Trigger front matter:** Name + summary (paragraph max) + function explanations in `trigger.yaml`
- [ ] Scripts tab: run buttons, output logs
- [ ] Hooks tab: CLI status, symlink health, re-link button
- [ ] **CLI registry in SQLite:** `cli_connections` table stores installed CLIs, their paths, and symlink status. Tools view queries this to show which CLIs are connected.

### 6.4 Activity Ledger
- [ ] Table: `activity_log` in `workspace.db`
  - `type`: chat, file_edit, view_switch, button_click, tool_call, save
  - `view_id`, `file_path`, `metadata` (JSON), `description`
- [ ] Recorded automatically via UEB subscribers
- [ ] Filtered before AI context (last N entries, relevance scoring)
- [ ] Summarized for system prompt injection

### 6.5 Dynamic System Prompt
- [ ] Assemble prompt from:
  - Base app prompt
  - Workspace context (available views + tools)
  - Activity ledger (recent actions)
  - Current view context (active view + its tools)
- [ ] Injected into every AI message (before-send hook or appended to user message)

### Smoke Tests (Phase 6)
- [ ] Skill appears in Tools viewer, toggle activates it
- [ ] AI chat references available tools for current view
- [ ] Activity ledger records view switch and file edit
- [ ] CLI symlink created, CLI sees Fusion Studio skills

### Decisions (Phase 6)
- [ ] **Skill validation:** What happens if a skill's JSON schema is invalid? Reject entirely or load with warnings?
- [ ] **Hook format:** One universal hook format, or per-CLI format (Claude uses YAML, Kimi uses TOML, etc.)?
- [ ] **Activity retention:** How long does activity log persist? FIFO 30 days? Forever? Configurable?
- [ ] **Dynamic prompt length:** AI context window is limited. How to prioritize what goes into the dynamic system prompt? (Activity ledger vs workspace context vs view tools)

---

## Cross-Cutting Concerns

### Versioning Strategy
- [ ] **Tier 1 (source files):** Diff-based, FIFO 20 diffs, checkpoint at 21, daily rollup
  - Text files: unified diff strings via `diff` npm package
  - Binary files: full snapshot at checkpoints only
  - Daily cleanup: keep all of today, last checkpoint of each prior day
- [ ] **Tier 2 (entities: invoices, customers):** Full JSON snapshot on explicit save, never auto-deleted
- [ ] **Tier 3 (transactions):** Append-only log, no versioning needed
- [ ] Versioning API exposed in `ai/system/api/versioning.js` for scripts and AI tools

### Backup & Recovery
- [ ] Local SQLite versioning (Phase 1) is primary
- [ ] iCloud backup syncs `.db` files (Phase 1)
- [ ] Git remains optional emergency parachute
- [ ] Disaster recovery: `git clone` → API restore from Postgres/iCloud

### Multi-Workspace Support
- [ ] Each workspace has its own `ai/system/data/workspace.db`
- [ ] System views read from central `system.db`
- [ ] Switching workspaces unmounts old views, mounts new ones, restores their states

### Progressive Disclosure & Front Matter Standard
- [ ] All discoverable artifacts use front matter for searchability and tool calling:
  - **Skills:** `skill.json` — name + 3-line summary + tools list
  - **Triggers:** `trigger.yaml` — name + paragraph summary + function explanations
  - **Hooks:** `hook.yaml` — name + summary + CLI target
  - **Tools:** `tools/*.json` — name + one-line description + parameters
  - **Wiki pages:** Front matter — name + summary (already adapting)
- [ ] Progressive disclosure: AI receives index first (names + summaries), drills down only when needed
- [ ] Alternative to front matter: maintain `index.json` — but must be auto-generated to stay fresh
- [ ] Searchable by AI: tool call `search_artifacts(query)` returns matching names + summaries

### View Update Strategy
- [ ] App updates never overwrite view CSS/JS
- [ ] New view versions ship as new templates in `System Files/`
- [ ] User views remain untouched unless user explicitly copies new template

### Security
- [ ] Iframe views run same-origin (`fusion-studio://` protocol) with no Node access
- [ ] `postMessage` uses explicit origin (not `*`) after protocol registration
- [ ] File-Viewer is the only privileged view; access mediated by main process IPC
- [ ] API tokens (Postgres, GitHub) stored in OS keychain, never in workspace files

### Custom Protocol
- [ ] `fusion-studio://` registered in `app.whenReady()` before window creation
- [ ] Protocol handler resolves to workspace `ai/views/` and `System Files` paths
- [ ] Dev mode: protocol maps to `fs-dev/System Files/` (repo root)
- [ ] Production: protocol maps to `~/Fusion Studio/System Files/` (user folder)

### Cross-Cutting Decisions
- [ ] **Search:** Full-text search across wiki + docs + tickets? Use SQLite FTS5, or external indexer (e.g., `flexsearch`)?
- [ ] **Export:** What formats? Zip workspace, CSV tickets, JSON wiki, PDF docs? All optional post-MVP?
- [ ] **Logging:** Server logs to `~/Library/Logs/Fusion Studio/`? Crash reporting — none (anti-black-box), or local-only crash dump?
- [ ] **Fonts:** System fonts only, or bundle a font (e.g., Inter)? Variable font for weight interpolation?
- [ ] **Auto-theme:** Follow macOS dark/light mode automatically, or manual toggle only?
- [ ] **File limits:** Max file size for preview? (e.g., 50MB). Max files per folder for tree view? (e.g., 1000)
- [ ] **Multi-monitor:** Support multiple windows? Or single-window with workspace switching?
- [ ] **Print:** Print support for docs, tickets, wiki pages? Or export-to-PDF only?

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-05-19 | Views are self-contained HTML/CSS/JS | Enables right-click add, user customization, no rebuild required |
| 2025-05-19 | `ai/settings/` → `ai/system/` | Clearer separation of system state from user content |
| 2025-05-19 | System views use central DB | Calendar/Reminders/Email must be consistent across all workspaces |
| 2025-05-19 | iCloud backup is external mirror | User-visible, survives app uninstall, deterministic path |
| 2025-05-19 | Theme tokens via postMessage | Iframe isolation requires explicit communication; keeps views dumb |
| 2025-05-19 | Bundled seed + copy for System Files | Offline-first, user-customizable templates, graceful updates |
| 2025-05-19 | `ai/system/` scope: per-workspace DB | `fusion.db` stays global; `ai/system/data/` is per-workspace versioning only |
| 2025-05-19 | Custom protocol: `fusion-studio://` | Registered before window creation; no race conditions |
| 2025-05-19 | No migration strategy | Pre-launch, single copy; rename `settings` → `system` across codebase |
| 2025-05-19 | Centralized file watcher | `lib/watch/core.js` extracts chokidar into one subscription API; Calendar + Views consume it |
| 2025-05-19 | Warm views preserved | All iframes created on workspace load; CSS visibility toggle; no lazy load for core views |
| 2025-05-19 | Connectors panel as permission gate | One UI for all macOS integrations; opt-in; simple check/uncheck |
| 2025-05-19 | External files via symlink ONLY | No folder lists in dropdowns; symlinks into workspace; File-Viewer shows symlink icon; chokidar follows symlinks |
| 2025-05-19 | Tiered versioning strategy | Diff-based for source files (pruned daily); full snapshots for entities (invoices, customers); append-only for transactions |
| 2025-05-19 | Daily checkpoint rollup | Keep all checkpoints today; last checkpoint of each prior day; delete intra-day diffs |
| 2025-05-19 | Agents → Tools rename | Icon: `manufacturing` (gears); tabbed GUI for Skills, Triggers, Scripts, Hooks |
| 2025-05-19 | Skills + hooks folder structure | `System Files/skills/` and `System Files/hooks/` discovered alongside views |
| 2025-05-19 | CLI hook integration (future) | Symlink Fusion Studio skills to CLI skills folders (Claude, Kimi, Codex, Anti-Gravity) |
| 2025-05-19 | Activity ledger | `activity_log` table tracks chat, edits, view switches, button clicks for AI context |
| 2025-05-19 | Diff library | `diff` (npm) for text file unified diffs; pure JS, no native deps |
| 2025-05-19 | Front matter standard | All skills, triggers, hooks, tools use front matter (name + summary) for progressive disclosure and AI searchability |
| 2025-05-19 | Progressive disclosure | AI receives index of names+summaries first; drills down only when needed via tool calls |
| 2025-05-19 | State storage: JSON + SQLite fallback | JSON is fast for frequent micro-updates (resizes, toggles); SQLite is the recovery parachute if JSON corrupts |
| 2025-05-19 | State persistence rules | Sizing and collections (file explorer tabs) persist across sessions. Focus, selection, scroll position, and active workflows do not |
| 2025-05-19 | Granular DOM updates | Views declare dependencies via `fusion.subscribe()`; shell routes file-watcher events to specific iframes; no full rebuild, no screen flash |
| 2025-05-19 | `fs.watch` → chokidar migration | Replace all Node built-in `fs.watch` with centralized `lib/watch/core.js` using chokidar; removes duplicate debounce logic, enables `followSymlinks` |
| 2025-05-19 | WorkspaceSwitcher obsoletion | Ribbon dropdown + Electron menu bar replace the slide-out drawer; `ribbonVisible` flag controls which workspaces appear |
| 2025-05-19 | Media player in header | Global, workspace-independent audio/video playback; integrates Spotify/Apple Music/YouTube/local; preemption rules for workspace media vs ambient playback |
| 2025-05-19 | Ticket priority system | Interrupt / High / Medium / Backlog; only Interrupt triggers auto-injection into new chats |
| 2025-05-19 | `postMessage` explicit origin | `fusion-studio://` replaces wildcard `*` for shell ↔ iframe security; dev mode allows `localhost` additionally |
| 2025-05-19 | Auto-numbered view IDs | `wiki-viewer-01`, `wiki-viewer-02` etc. on copy; eliminates duplicate ID collisions within a workspace; built-ins become the `-01` baseline |
| 2025-05-19 | No workspace templates | Only view templates exist. Workspaces are built by instantiating individual views. Three preloaded workspaces (Fusion Home, Media Studio, System Files) are always present |
| 2025-05-19 | System Files as special workspace | Hosts global Tools view. All Tools views in any workspace point back to System Files. System Files is the template source of truth |
| 2025-05-19 | Tools view architecture | Not self-contained. Points to System Files folder. SQLite CLI registry. Wraps each CLI's internal markdown in unified interface |
| 2025-05-19 | Three-layer process architecture | Server owns all business logic (always runs); Electron main owns native OS APIs only; renderer owns UI. Desktop-first, no headless mode, anti-black-box |
| 2025-05-19 | Future LAN mode acknowledged | Possible distant fork where server runs standalone + browser renderer. Not current architecture concern |
| 2025-05-19 | Memory cleanup for heavy views | User is the garbage collector — close workspace from ribbon to tear down all its views. No automatic memory management needed |
| 2025-05-19 | Zustand state migration | Keep Zustand for shell chrome only: workspaceStore, panelStore, chatStore. View-specific stores (ticketStore, wikiStore, fileStore) move into iframe views and are deleted from shell |

---

## State Reset Behavior

Closing a workspace from the ribbon (× button or Electron menu uncheck) resets its **focus state** but preserves **geometry and collections**:

| Reset (Discard) | Preserve |
|-----------------|----------|
| Active view / focused panel | Panel widths / sidebar sizes |
| Scroll positions | Layout geometry |
| Selected ticket / expanded preview | File explorer open tabs |
| Active agent workflow | Theme settings |
| Doc viewer centered document | |
| Wiki viewer selected page | |

**Implementation blocked by:** RCC-0076 — Obsolete WorkspaceSwitcher drawer; ribbon + menu bar only. The `ribbonVisible` flag and close/remove boundary must exist before state reset logic can be wired.

**Grace period:** Workspaces closed < 24h ago keep file explorer tabs on reopen. Closed > 24h → hard reset (tabs cleared too). Timer stored in `~/Library/Application Support/Fusion Studio/workspace-close-times.json`.

---

## Next Step

Flesh out Phase 1 infrastructure specs. Start with the view loader contract (`index.json` schema, `postMessage` protocol, iframe lifecycle) and the `ai/system/` folder restructure.
