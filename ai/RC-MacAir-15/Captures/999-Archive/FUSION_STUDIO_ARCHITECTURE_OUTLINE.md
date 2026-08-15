# Fusion Studio — Architecture Outline

> Rough reference for wiki/documentation agents. Covers the app structure, event bus, harness system, view/panel architecture, and the new System Viewer (connectors).

---

## 1. What This App Is

**Fusion Studio** (codename "Open Robin") is a web-based IDE that integrates with command-line AI assistants. It is a **harness/display layer**, not an AI itself — the CLI handles all inference; Fusion Studio handles organization, files, chat UI, and workspace management.

### Stack
| Layer | Tech |
|-------|------|
| **Shell** | Electron (macOS app wrapper) |
| **Client** | React 19 + TypeScript + Vite |
| **Server** | Node.js + Express + WebSocket (`ws`) |
| **State** | Zustand (client), SQLite `fusion.db` (server) |
| **Protocol** | JSON-RPC 2.0 over WebSocket (client↔server) and stdin/stdout (server↔CLI) |

### Three-Layer Flow
```
┌─────────────┐     WebSocket      ┌─────────────┐     stdin/stdout     ┌─────────┐
│   Client    │ ◄────────────────► │   Server    │ ◄──────────────────► │   CLI   │
│  (React)    │    (port 3001)     │  (Node.js)  │    (JSON-RPC wire)   │(kimi/   │
│             │                    │             │                      │claude/  │
│  Pure UI    │                    │ All state   │                      │codex/etc)│
│  No logic   │                    │ + routing   │                      │         │
└─────────────┘                    └─────────────┘                      └─────────┘
```

---

## 2. Repository Layout

```
fs-dev/
├── fusion-studio-client/       # React + Vite frontend
│   ├── src/
│   │   ├── components/         # UI components (App.tsx, ContentArea.tsx, SystemViewer.tsx, ...)
│   │   ├── state/              # Zustand stores (panelStore.ts, ...)
│   │   ├── lib/                # Utilities (ws-client.ts, panels.ts, theme/)
│   │   └── types/              # TypeScript types
│   └── electron/               # Electron main process + protocol handler
│
├── fusion-studio-server/       # Node.js backend
│   ├── server.js               # Main entry (HTTP + WS server)
│   ├── lib/
│   │   ├── event-bus.js        # Central pub/sub
│   │   ├── harness/            # CLI harness system
│   │   ├── wire/               # Wire protocol + broadcaster
│   │   ├── views/              # View discovery & resolution
│   │   ├── workspace/          # Workspace registry & state cache
│   │   ├── theme/              # OKLCH theme engine
│   │   ├── thread/             # Thread lifecycle & chat scope
│   │   ├── tickets/            # Ticket routing (RCC-NNNN system)
│   │   ├── wiki/               # Wiki hooks & topic discovery
│   │   └── db.js               # SQLite (fusion.db)
│   └── data/                   # Runtime data (gitignored)
│
└── System Files/               # The "special" preloaded workspace
    ├── ai/
    │   ├── views/              # View definitions (file-viewer, wiki-viewer, system-viewer, ...)
    │   ├── system/
    │   │   ├── styles/         # Workspace CSS (variables.css, themes.css, ...)
    │   │   └── state/          # Runtime state JSON
    │   └── components/         # Shared modal components
    └── views/                  # Template sources (mirrors ai/<machine>/Views/)
```

---

## 3. The Event Bus

**File:** `fusion-studio-server/lib/event-bus.js`

The backbone of the server. All chat events, workspace lifecycle, thread lifecycle, ticket dispatch, and automations flow through this bus.

### Mechanics
- Wraps Node's `EventEmitter` with **max 200 listeners**
- **Max chain depth:** 5 (prevents runaway event cascades)
- **Same-event loop suppression:** if an event handler emits the same event type on the same entity, it is dropped
- Every emit also fires on wildcard `'*'` for catch-all subscribers

### Key Event Types
| Namespace | Events |
|-----------|--------|
| `chat:*` | `turn_begin`, `content`, `thinking`, `tool_call`, `tool_call_args`, `tool_result`, `turn_end`, `status_update` |
| `workspace:*` | `added`, `removed`, `switched`, `registry_changed`, `culled_at_launch` |
| `thread:*` | `state_changed`, `idle_expired` |
| `ticket:*` | `claimed`, `dispatched`, `closed` |

### Subscribers
- **Wire Broadcaster** — bus → WebSocket fan-out for chat events
- **Workspace Broadcaster** — bus → WebSocket fan-out for workspace/thread events
- **Audit Subscriber** — persists exchange metadata to DB
- **Thread Lifecycle Controller** — observes chat turns, emits idle timeouts
- **Trigger Loader** — listens for ticket events to fire agent triggers

---

## 4. The Harness System

**Directory:** `fusion-studio-server/lib/harness/`

The harness wraps CLI processes and translates their JSON-RPC wire protocol into **canonical events** that the rest of the server understands.

### Supported CLIs
| Harness | CLI | Protocol |
|---------|-----|----------|
| `KimiHarness` | `kimi --wire --yolo` | JSON-RPC over stdin/stdout |
| `CodexHarness` | `codex` | JSON-RPC |
| `ClaudeCodeHarness` | `claude` | ACP (Agent Communication Protocol) |
| `GeminiHarness` | `gemini` | ACP |
| `QwenHarness` | `qwen` | Custom event stream |

### Canonical Event Types
All harnesses normalize output to these events:
```
turn_begin  →  start of an AI turn
content     →  streaming text chunk
thinking    →  reasoning/thought block
tool_call   →  agent wants to call a tool
tool_result →  tool execution result
turn_end    →  turn complete (with token usage, context %)
```

### Compatibility Layer
`lib/harness/compat.js` provides drop-in replacements for legacy wire functions. Feature flags control:
- **Legacy mode** — spawn CLI directly (old way)
- **New mode** — spawn via `KimiHarness` (new way)
- **Parallel mode** — run both, compare events, log mismatches

### Wire Broadcaster
`lib/wire/wire-broadcaster.js` subscribes to `chat:*` events on the bus and routes each to the WebSocket client that owns the thread.

---

## 5. Workspace System

### Two Workspace Concepts
1. **Fusion Home** (`~/Projects/Fusion-Home/`) — the app itself. Hub workspace with wiki, panels, templates. Loads on startup.
2. **fs-dev** (`~/Projects/fs-dev/`) — the source code repo being developed. Managed *by* Fusion Home. Dev-only.

### Workspace Registry
- Stored in SQLite `fusion.db` (server-side, workspace-independent)
- Workspaces have `type`: `code`, `media`, `hub`
- Templates live in `Fusion-Home/workspace-templates/`

### State Cache
- `data/workspace-cache.json` persists per-workspace panel configs and view states
- Survives browser refresh / app restart
- Cleared when views are added/removed on disk

---

## 6. View / Panel System

### Discovery
Views are discovered by scanning `ai/<machine>/Views/<id>/index.json` in the active workspace.

### View Files
| File | Purpose |
|------|---------|
| `index.json` | Identity: `id`, `label`, `icon`, `rank`, `type` |
| `content.json` | Display type + chat config (`display`, `chat`) |
| `styles/layout.json` | Optional layout overrides |
| `app/index.html` | **Iframe entry point** (if view ships its own UI) |
| `ui/module.js` | Runtime-loaded plugin (optional) |
| `chat/` | Folder marker — chat enabled for this view |

### Render Tracks (`ContentArea.tsx`)
1. **Iframe track** — if `app/index.html` exists, renders `<iframe src="fusion-studio://<panel>/app/index.html">`
2. **React component track** — if panel ID is in `CONTENT_COMPONENTS` map, renders the built-in component
3. **Placeholder** — fallback for unknown panels

### Panel Configs
Discovered client-side via WebSocket:
- `__panels__` pseudo-panel resolves to `ai/<machine>/Views/`
- `__apps__` pseudo-panel resolves to `ai/apps/`
- Each discovered folder becomes a `PanelConfig` with `category: 'tool'` or `'app'`

---

## 7. WebSocket Protocol (Client ↔ Server)

### Client → Server
| Message Type | Purpose |
|--------------|---------|
| `set_panel` | Tell server which panel is active |
| `prompt` | Send user input to the active CLI thread |
| `file_tree_request` | Browse files in a panel's content root |
| `file_content_request` | Read a specific file |
| `state:get` / `state:set` | View state persistence |
| `workspace:cache_push` | Save workspace state to server cache |

### Server → Client
| Message Type | Purpose |
|--------------|---------|
| `workspace:init` | Initial registry + active workspace on connect |
| `panel_config` | Project root info |
| `panel_changed` | View config (content.json + layout.json) for active panel |
| `file_tree_response` | Directory listing |
| `file_content_response` | File content |
| `thread:list` | Available threads |
| `state:result` | State operation acknowledgement |

### Chat Events (Wire)
| Type | Direction | Payload |
|------|-----------|---------|
| `turn_begin` | S→C | `threadId`, `turnId`, `userInput` |
| `content` | S→C | `text` (streaming chunk) |
| `thinking` | S→C | `text` (reasoning) |
| `tool_call` | S→C | `toolName`, `toolCallId` |
| `tool_result` | S→C | `toolOutput`, `toolDisplay`, `isError` |
| `turn_end` | S→C | `fullText`, `hasToolCalls` |

---

## 8. Theme System

- **OKLCH color space** for perceptually uniform palettes
- `color-math.js` — pure math shared by server + client (cross-project import)
- **Segment modules** — each CSS concern (panel, content, text, border, accent, syntax) in its own file
- **Live preview** — ThemePicker writes CSS variables directly to `document.documentElement`
- **Auto-regeneration** — filesystem watcher detects `themes.json` edits and rebuilds `themes.css`

---

## 9. macOS Connectors (System Viewer)

**View:** `system-viewer` (iframe view inside `System Files/ai/<machine>/Views/system-viewer/`)

The **System** panel provides macOS integrations. Currently static content; toggle state is in-memory only (no persistence yet).

### Four Connectors
| Connector | Read Path | Write Path | macOS Permission Required |
|-----------|-----------|------------|---------------------------|
| **Apple Mail** | SQLite `~/Library/Mail/V10/MailData/Envelope Index` | AppleScript (drafts) | **Full Disk Access** |
| **Apple Calendar** | EventKit API | EventKit API | **Calendar TCC** |
| **Apple Notes** | AppleScript | AppleScript | **Automation TCC (AppleEvents)** |
| **Apple Reminders** | EventKit API | EventKit API | **Reminders TCC** |

### Permission Probe Strategy
Recommended: try `fs.accessSync` on the Mail Envelope Index. `EPERM`/`EACCES` = no Full Disk Access.

### Known Gaps
- Toggle state not persisted (no DB/file storage)
- No actual backend implementation for connectors yet (static UI only)
- No permission probing implemented

---

## 10. Files to Point a Wiki Agent At

### For Architecture Overview
- `docs/FUSION_STUDIO_OVERVIEW.md` (if it exists)
- `AGENTS.md` — agent-focused project guide
- `HANDOFF.md` — recent theme refactor handoff

### For Event Bus
- `fusion-studio-server/lib/event-bus.js`
- `fusion-studio-server/lib/wire/wire-broadcaster.js`
- `fusion-studio-server/lib/ws/workspace-broadcaster.js`

### For Harness System
- `fusion-studio-server/lib/harness/index.js`
- `fusion-studio-server/lib/harness/compat.js`
- `fusion-studio-server/lib/harness/types.js`
- `fusion-studio-server/lib/harness/kimi/index.js`

### For View/Panel System
- `fusion-studio-server/lib/views/index.js`
- `fusion-studio-client/src/components/ContentArea.tsx`
- `fusion-studio-client/src/lib/panels.ts`
- `System Files/ai/<machine>/Views/index.json`

### For Workspace System
- `fusion-studio-server/lib/workspace/state-cache.js`
- `fusion-studio-server/lib/workspace/registry-service.js`
- `fusion-studio-client/src/state/panelStore.ts`

### For Theme System
- `fusion-studio-server/lib/theme/color-math.js`
- `fusion-studio-server/lib/theme/themes-service.js`
- `fusion-studio-client/src/components/ThemePicker.tsx`

### For Connectors / System Viewer
- `fusion-studio-server/lib/views/index.js`
- `fusion-studio-client/src/components/SystemViewer.tsx`
- `System Source Files/ai/<machine>/Views/system-viewer/index.json`
- `System Source Files/ai/<machine>/Views/system-viewer/content.json`

---

## 11. Active Decisions & WIP

| Decision | Status |
|----------|--------|
| System Viewer renamed from `tools` → `system-viewer` | ✅ Done |
| System Viewer uses the built-in React/server-resolved view paradigm, not a view-local iframe app | ✅ Done |
| Workspace chat enabled for System Viewer | ✅ Done |
| No Robin chat / no system wiki integration in System Viewer | ✅ Done |
| Connectors architecture: SQLite/EventKit/AppleScript (not SPEC-compliant) | ✅ Researched (RCC-0092 ticket filed) |
| Connector toggle persistence | ❌ Not built |
| Overlay mode for System Viewer | ❌ Not built |
| Permission probing | ❌ Not built |
| Backend connector implementations | ❌ Not built |
| Tools section inside System Viewer (agent-callable tools) | ❌ Planned |
