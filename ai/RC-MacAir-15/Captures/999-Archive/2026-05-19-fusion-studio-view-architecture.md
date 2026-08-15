# Handoff: Fusion Studio View Architecture — Session 2

**Date:** 2026-05-19  
**Context:** Resumed from 2025-05-19 handoff. Resolved all 15 open issues from original queue, created 9 tickets, fleshed out 2 view templates, enriched ROADMAP to 734 lines.  
**Status:** All original issues resolved. 45 open decisions inserted into ROADMAP by phase. Ready for implementation or decision resolution.

---

## What Changed Since Last Handoff

### 1. ROADMAP Enrichment
**Location:** `ai/<machine>/Views/doc-viewer/specs/ROADMAP.md` (734 lines, up from 518)

**Major additions:**
- **Phase 1.5** — Workspace Lifecycle (unified creation API, auto-numbered IDs, no workspace templates)
- **Phase 1.6** — System Files Copy/Merge Engine
- **Phase 1.7** — Three Preloaded Workspaces (Fusion Home, Media Studio, System Files)
- **Phase 1.10** — Rewritten as Three-Layer Process Architecture (server/main/renderer)
- **State Reset Behavior** section (reset vs preserve table, RCC-0076 blocker)
- **Decision Log** expanded from 21 → 32 entries
- **45 open decisions** inserted into 8 sections (Phase 0–6 + Cross-Cutting)

**Key new decisions logged:**
- Three-layer architecture (server owns logic, main owns native, renderer owns UI)
- Auto-numbered view IDs (`wiki-viewer-01`, `wiki-viewer-02`)
- No workspace templates — only view templates
- System Files as special workspace (hosts global Tools view)
- Tools view points to System Files folder, not self-contained
- Workspace ribbon = user-controlled memory cleanup
- Zustand kept for shell chrome only (workspace, panel, chat stores)
- Granular DOM updates via `fusion.subscribe()` + targeted postMessage
- `fs.watch` → chokidar migration
- Media player in header (global, workspace-independent)
- Ticket priority system (Interrupt/High/Medium/Backlog)

### 2. Tickets Created (9 Total)

| ID | Title | Priority | State | Notes |
|---|---|---|---|---|
| RCC-0071 | Pre-Deployment: Handle Full Disk Access for Packaged Calendar Module | Medium | open | |
| RCC-0072 | Create onboarding tickets to download with app | Medium | open | |
| RCC-0073 | First-run detection mechanism | Medium | open | `blocked_by: RCC-0076` |
| RCC-0074 | Ticket Registry: AI-Guided Onboarding via Chat | Medium | open | Priority system: Interrupt/High/Medium/Backlog |
| RCC-0076 | Obsolete WorkspaceSwitcher drawer; ribbon + menu bar only | Medium | open | Full SPEC, includes screenshot bug fix |
| RCC-0077 | Persistent Media Player in App Header | Medium | open | Sources: Spotify/Apple Music/YouTube/Local |
| RCC-0078 | Workspace Creation Flow & Default Views | Medium | open | Two-option modal, AI onboarding prompt |
| RCC-0079 | Solobooks Integration: Licensing, Download, Cloud Sync & Workspace Lifecycle Events | Medium | open | Free <$1M, subscription above |
| RCC-0075 | ~~postMessage origin security~~ | — | deleted | Moved to ROADMAP Phase 1.3 build checkbox |

### 3. View Templates Fleshed Out

**Issues View** (`System Files/views/issues/`):
- `index.json` — View identity + exposed AI tools (`search_tickets`, `move_ticket`)
- `index.html` — 3-column Kanban (Inbox/Open/Completed) + detail panel
- `style.css` — Full styling using `var(--shell-*)` theme tokens
- `app.js` — Self-contained: loads tickets.json, renders board, handles postMessage, origin validation, granular DOM updates, frontmatter parsing

**Tools View** (`System Files/views/tools/`):
- `index.json` — View identity + exposed AI tools (`toggle_skill`, `run_script`, `relink_cli`)
- `index.html` — Tabbed interface (Skills/Triggers/Scripts/Hooks)
- `style.css` — Full styling with toggles, CLI registry cards, run buttons
- `app.js` — Not yet written (infrastructure not ready)

### 4. System Files Additions

- `System Files/cloud-backup/README.md` — Cloud backup pattern, symlink security model
- `System Files/media-player/media/` — Folder for local audio/video files
- `System Files/media-player/README.md` — Supported formats, preemption rules, how to add files

### 5. Code Fixes

**`ai/<machine>/Issues/inbox/RCC-0071.md`**
- `state: inbox` → `state: open` (was invisible to TicketBoard filter)

**`ai/<machine>/Issues/content/tickets.json`**
- Updated `state` field to `"open"`

**`fusion-studio-server/lib/tickets/dispatch.js`**
- Fixed watcher to use `path.basename(filename)` before prefix check (was missing subdir files with `recursive: true`)

### 6. Spec Amendments

**`ai/<machine>/Wiki/enforcement/themes-and-state/PAGE.md`**
- Added **Persistent State** vs **Session State** distinction
- Persistent: sizing, collections (file explorer tabs), filters, sort order
- Session: focus, selection, scroll, active workflow, active view (cleared on workspace close or nightly refresh)

---

## Original Issue Queue — Final Status

| # | Issue | Resolution |
|---|-------|------------|
| 8 | iCloud path fragility & fallback | Hybrid probe + fallback → ROADMAP Phase 1.6 |
| 9 | postMessage origin security (wildcard `*`) | Explicit `fusion-studio://` → ROADMAP Phase 1.3 checkbox |
| 10 | Shell vs. view state ownership | Persistent/Session split → spec amendment |
| 11 | First-run detection mechanism | RCC-0073 |
| 12 | Main vs. renderer process split | Three-layer architecture → ROADMAP Phase 1.10 |
| 13 | Duplicate ID handling in `index.json` | Auto-numbered IDs → ROADMAP Phase 1.5 |
| 14 | Memory cleanup for heavy views | Workspace ribbon = user GC → Decision Log |
| 15 | Zustand state shape migration | Shell chrome only → Decision Log |

**All 15 original issues resolved.**

---

## Open Decisions by Phase (45 Total)

**Phase 0 — Connectors (5):** Sync frequency, schema change handling, permission revocation, Photos scope, threading

**Phase 1 — Infrastructure (13):** View load failure, SQLite contention, iCloud fallback, protocol fallback, keyboard shortcuts, notifications, context menus, build tool, auto-update, sleep/wake, safe mode, max views, view ordering

**Phase 2 — System Views (4):** Sync trigger, writeback, deduplication key, offline behavior

**Phase 3 — Migration (4):** Migration order (user wants Issues first), data migration, React cleanup, crash isolation

**Phase 4 — Specialized (3):** Library thumbnails, currency, office data format

**Phase 5 — Media (3):** Hardware acceleration, codec support, project format

**Phase 6 — AI-Native (4):** Skill validation, hook format, activity retention, prompt prioritization

**Cross-Cutting (8):** Search strategy, export formats, logging/crash policy, fonts, auto-theme, file limits, multi-monitor, print

---

## Database Architecture (Unchanged)

**Global (`fusion-studio-server/data/fusion.db`):**
- Workspace registry, chat threads, calendar events, system config, themes, tabs, secrets, activity log (future)

**Per-workspace (`<workspace>/ai/<machine>/System/data/`):**
- `workspace.db` — file versioning, checkpoints, undo/redo
- `solobooks.db` — bookkeeping (optional)
- `state.json` — layout, panel widths, view config (persistent + session layers)
- `theme.json` — base design tokens + slider values

---

## Next Session Options

1. **Resolve Phase 1 decisions** — Work through the 13 infrastructure decisions (keyboard shortcuts, notifications, build tool, error handling, etc.)
2. **Start building Phase 1** — Implement view loader, custom protocol, theme bridge, file watcher core
3. **Resolve more decisions** — Pick a phase and close its open questions
4. **Create more tickets** — For ideas that surfaced during the session

---

## Important Files

- `ai/<machine>/Views/doc-viewer/specs/ROADMAP.md` — master spec (734 lines)
- `ai/<machine>/Wiki/enforcement/themes-and-state/PAGE.md` — theme/state boundary spec
- `fusion-studio-server/lib/views/index.js` — view discovery and resolution
- `fusion-studio-server/server.js` — WebSocket server, process architecture
- `fusion-studio-client/electron/main.cjs` — Electron main process
- `System Files/views/issues/` — first view template (fleshed out)
- `System Files/views/tools/` — second view template (fleshed out)
- `ai/<machine>/Issues/content/tickets.json` — ticket index (v2.0, 8 tickets)

---

## Notes

- App branding: **Fusion Studio** (Electron wrapper)
- Repo: **fs-dev**
- User assignee initials: **RCC**
- Tools view icon: `manufacturing` (Material Symbol / gears)
- Three preloaded workspaces: Fusion Home, Media Studio, System Files
- No workspace templates — only view templates
- State: JSON primary + SQLite fallback for recovery
- Session state cleared on workspace close or nightly refresh
