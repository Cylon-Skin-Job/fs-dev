# Fusion Studio — Application Overview

> Rough outline for wiki authors. Covers architecture, event bus, harness system, view migration, and key subsystems.

---

## What It Is

Fusion Studio is a **desktop workspace application** built on **Electron + React + Node.js server**. It manages multiple project workspaces, each with its own AI-assisted views (file explorer, wiki, issue tracker, document viewer, etc.).

Each workspace is a folder on disk with an `ai/` subdirectory containing views, system config, styles, and state.

---

## Three-Layer Architecture

| Layer | Owner | Responsibilities |
|-------|-------|-----------------|
| **Server** (`fusion-studio-server/`) | Node.js child process | Business logic, file watching, database, WebSocket routing, event bus |
| **Electron Main** (`fusion-studio-client/electron/`) | Electron main process | Native OS APIs, window management, custom protocol, server lifecycle |
| **Renderer** (`fusion-studio-client/src/`) | React + Vite | UI, view mounting (iframes), `postMessage`, WebSocket client |

The server spawns as a managed child process on app launch, binds to an OS-assigned port (port 0), and signals `SERVER_READY:{port}` to the main process.

---

## Universal Event Bus (UEB)

The backbone of the server. All cross-module communication flows through here.

- **Location:** `fusion-studio-server/lib/event-bus.js`
- **Pattern:** Pub/sub with chain-depth limiting (max 5) and same-event-loop suppression
- **Emitters:** Wire message router, harnesses, client message router, runner, dispatch
- **Listeners:** Wire-broadcaster, audit-subscriber, trigger-loader, wiki hooks, ticket dispatch
- **Key events:**
  - `file:changed` — fired by workspace watcher on any file change (create/modify/delete/rename)
  - `chat:turn_end`, `ticket:claimed`, `thread:open-assistant` — chat/thread lifecycle
  - `workspace:switched`, `workspace:added`, `workspace:removed` — workspace lifecycle
  - `views:added`, `views:removed`, `views:changed` — view lifecycle (deprecated; use `file:changed` filtered for `ai/views/`)

---

## File Watcher System

Centralized filesystem watching via chokidar.

- **Core:** `lib/watch/core.js` — exports `subscribe({ id, path, options, handler })`
- **Workspace watcher:** `lib/watch/workspace-watcher.js` — watches entire project root, emits `file:changed` on UEB
- **Calendar watcher:** `lib/watch/calendar-watcher.js` — watches Apple Calendar SQLite
- **Filters:** Pluggable filter system for declarative actions on file events (`.md` filters in `lib/watcher/filters/`)
- **Key features:** Rename detection (2-second window), symlink following, debounce via chokidar config

---

## Workspace System

A workspace is a project folder with this structure:

```
{workspace}/
├── ai/
│   ├── system/
│   │   ├── config/cli.json
│   │   ├── state/state.json, workspace.json
│   │   ├── styles/themes.json, *.css
│   │   └── data/workspace.db, solobooks.db
│   ├── views/
│   │   ├── file-viewer/
│   │   ├── issues-viewer/
│   │   ├── wiki-viewer/
│   │   └── ...
│   └── chat/
└── (project files)
```

- Workspaces are discovered, added, switched, and removed at runtime
- `System Files/` contains bundled templates (views, skills, hooks, scripts) that seed the user's home on first run
- Three preloaded workspaces planned: Fusion Home, Media Studio, System Files

---

## View Architecture (Migration in Progress)

Views are migrating from React components to self-contained **iframe-based apps**.

### Current State
- **Custom protocol:** `fusion-studio://{viewId}/app/index.html` serves files from `ai/views/{viewId}/`
- **Dual-track loader:** `ContentArea.tsx` checks if view has `app/index.html` → iframe; else falls through to existing React component
- **Warm iframes:** All panels render into DOM; inactive panels hidden via CSS (`opacity: 0; visibility: hidden`)
- **Theme token bridge:** Shell parses CSS custom properties from theme style tags and broadcasts them to all warm iframes via `postMessage`
- **Security:** Views validate `event.origin === 'fusion-studio://'` before acting on messages

### View Convention (established by Chunk J)
```
ai/views/{viewId}/
├── index.json           ← identity, icon, rank
├── content.json         ← display type, chat config
├── app/
│   ├── index.html       ← thin shell
│   ├── app.js           ← entry point, postMessage handler
│   ├── style.css        ← structural layout only (no hardcoded colors)
│   └── ...modules/
└── settings/
    └── layout.json
```

---

## AI Harness System

AI agents ("harnesses") connect to workspace threads via WebSocket. Each harness is a CLI tool or service that communicates over the wire.

- **Harnesses:** `kimi`, `claude-code`, `codex`, `gemini`, `qwen`, `robin`
- **Connection:** WebSocket from renderer → server → harness process
- **Threads:** Dual-scope (project + view). Project threads persist across panel switches; view threads reset
- **Wire protocol:** Server routes messages between harness and renderer via `lib/wire/`
- **State:** Harness statuses cached in panel store; connecting state tracked per harness

---

## Connectors (Phase 1 — Pending)

macOS system integration panel. Six connectors planned:

| Connector | Source | Target Table |
|-----------|--------|-------------|
| Calendar | `Calendar.sqlitedb` | `calendar_events`, `calendar_sources` |
| Reminders | TCC API | `reminders` |
| Mail | `~/Library/Mail/` | `emails` |
| Messages | `~/Library/Messages/` | `messages` |
| Notes | `group.com.apple.notes` | `notes` |
| Photos | TCC API | `photos` |

Uses the file watcher core exclusively. No raw `fs.watch`.

---

## Ticket / Issue System

File-based ticket tracking in `ai/views/issues-viewer/`.

- **Markdown source:** `inbox/RCC-NNNN.md` (open), `closed/RCC-NNNN.md` (closed), `archived/` (obsolete)
- **App index:** `content/tickets.json` — machine-readable index consumed by TicketBoard
- **Front matter:** `id`, `title`, `assignee`, `created`, `author`, `state`, optional `completed`
- **Columns:** Inbox (human-assigned + open), Open (bot-assigned + open), Completed (closed)
- **Bots:** `kimi-wiki`, `kimi-code`, `kimi-review`, `kimi-bot`

---

## Theme System

- **Workspace styles:** `ai/system/styles/` — `themes.json`, `themes.css`, `variables.css`, `components.css`, `views.css`, etc.
- **Runtime loading:** `useSharedWorkspaceStyles()` fetches CSS from server on workspace switch
- **Theme picker:** Modal with sliders for hue, saturation, lightness, border intensity, card intensity
- **Computed tokens:** Parsed from CSS custom properties and broadcast to iframe views

---

## Chunk Status (View Architecture Roadmap)

| Chunk | Phase | Status | Description |
|-------|-------|--------|-------------|
| A | 0 | ✅ | File Watcher Core |
| A2 | 0 | ✅ | UEB File Events |
| K | 2 | ✅ | Managed Server Spawn |
| B | 2.1 | ✅ | Filesystem Restructure (`ai/settings` → `ai/system`) |
| C | 2.3 | ✅ | Custom Protocol `fusion-studio://` |
| D | 2.3 | ✅ | Iframe View Loader (dual-track fallback) |
| E | 2.4 | ✅ | Theme Token Bridge |
| F | 1 | 🟡 | macOS Connectors |
| G | 2.10 | 🟡 | System Files Copy/Merge Engine |
| H | 2.2+2.5 | 🟡 | View Discovery & Right-Click Add |
| I | 2.7 | 🟡 | Versioning Database |
| J | 4.1 | 🟡 | Issues-Viewer Redesign (iframe migration) |

---

## Key File Locations

| What | Path |
|------|------|
| Roadmap | `ai/views/doc-viewer/specs/ROADMAP-REVISED.md` |
| Event Bus | `fusion-studio-server/lib/event-bus.js` |
| Watcher Core | `fusion-studio-server/lib/watch/core.js` |
| Workspace Watcher | `fusion-studio-server/lib/watch/workspace-watcher.js` |
| Protocol Handler | `fusion-studio-client/electron/protocol-handler.cjs` |
| Server Spawn | `fusion-studio-client/electron/server-spawn.cjs` |
| ContentArea | `fusion-studio-client/src/components/ContentArea.tsx` |
| Theme Bridge Hook | `fusion-studio-client/src/hooks/useThemeTokenBridge.ts` |
| Panel Config Loader | `fusion-studio-client/src/lib/panels.ts` |
| Ticket Store | `fusion-studio-client/src/state/ticketStore.ts` |
| Panel Store | `fusion-studio-client/src/state/panelStore.ts` |
| Chunk Specs | `ai/views/doc-viewer/specs/chunks/` |
| Ticket Markdown | `ai/views/issues-viewer/{inbox,closed,archived}/` |
| Ticket JSON Index | `ai/views/issues-viewer/content/tickets.json` |

---

## Open Decisions

- Sync frequency for connectors: on-demand vs polling?
- iCloud backup: skip silently or show modal?
- Build tool: electron-builder vs electron-forge?
- Max views per workspace?
- Notification system: toasts / badges / modals?

---

*Last updated: 2026-05-22*
