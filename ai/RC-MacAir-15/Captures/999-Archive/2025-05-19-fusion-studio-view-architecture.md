# Handoff: Fusion Studio View Architecture Migration

**Date:** 2025-05-19  
**Context:** Extended architecture session covering view migration, system design, Connectors, versioning, and AI-native layer.  
**Status:** ROADMAP enriched to 518 lines. 21 decisions logged. System Files templates created. Issue tracker cleaned.  

---

## What Was Built / Changed

### 1. ROADMAP.md
**Location:** `ai/<machine>/Views/doc-viewer/specs/ROADMAP.md` (518 lines)

**Phases defined:**
- **Phase 0:** Connectors (System Integration Layer) — permission gate for macOS integrations
- **Phase 1:** Infrastructure — filesystem, view loader, theme bridge, file watcher, iCloud backup, versioning DB
- **Phase 2:** System Views — Calendar, Reminders, Email (read from central `fusion.db`)
- **Phase 3:** Core Content Views — Doc, Wiki, Office, Issues, Tools (was Agents), File-Viewer
- **Phase 4:** Specialized Views — Library, Spending (Solobooks)
- **Phase 5:** Media Views — Video Editor, Audio Editor
- **Phase 6:** AI-Native Layer — Skills, CLI hooks, Tools GUI, Activity Ledger, Dynamic System Prompt

### 2. System Files Templates
**Location:** `System Files/`

Created/updated:
- `manifest.json` — updated view list (agents → tools), added skills/hooks arrays
- `views/tools/` — renamed from `agents`, icon: `manufacturing` (gears)
- `views/<all-10-views>/` — `index.json`, `content.json`, `index.html`, `style.css`, `app.js`
- `skills/README.md` — AI skill definitions (markdown + tool schemas)
- `hooks/README.md` — Per-CLI hook configs (Claude, Kimi, Codex, Anti-Gravity)
- `scripts/README.md` — Sample automation
- `triggers/README.md` — Event triggers

### 3. Issue Tracker Cleanup
**Location:** `ai/<machine>/Issues/`

- Deleted 70 fake stub issues (KIMI-0005 through KIMI-0070)
- Deleted `done/*.md` stubs
- Moved `KIMI-0071.md` → `inbox/RCC-0071.md` (renamed, assigned to rccurtrightjr)
- Created folders: `inbox/`, `open/`, `complete/`, `archive/`
- Regenerated `content/tickets.json` (version 2.0, contains RCC-0071 only)

### 4. Code Changes

**`fusion-studio-server/lib/tickets/loader.js`**
- `loadAllTickets()` now scans subdirectories (one level deep)
- Accepts both `KIMI-*` and `RCC-*` prefixes

**`fusion-studio-server/lib/tickets/dispatch.js`**
- Watcher now uses `{ recursive: true }`
- Accepts both `KIMI-*` and `RCC-*` file events

---

## Key Architectural Decisions (21 Total)

| # | Decision | Location in ROADMAP |
|---|----------|---------------------|
| 1 | Views are self-contained HTML/CSS/JS | Vision / Phase 1.3 |
| 2 | `ai/<machine>/System/styles/` → `ai/<machine>/System/` | Phase 1.1 |
| 3 | System views use central DB (`fusion.db`) | Phase 2 |
| 4 | iCloud backup is external mirror | Phase 1.6 / Distribution |
| 5 | Theme tokens via `postMessage` | Phase 1.4 |
| 6 | Bundled seed + copy for System Files | Distribution |
| 7 | `ai/<machine>/System/` scope: per-workspace DB | Phase 1.1 |
| 8 | Custom protocol: `fusion-studio://` | Phase 1.3 |
| 9 | No migration strategy (pre-launch) | Phase 1.1 |
| 10 | Centralized file watcher (`lib/watch/core.js`) | Phase 1.9 |
| 11 | Warm views preserved (CSS toggle) | Phase 1.3 |
| 12 | Connectors panel as permission gate | Phase 0 |
| 13 | External files via symlink ONLY | Phase 0.4 |
| 14 | Tiered versioning strategy | Cross-Cutting |
| 15 | Daily checkpoint rollup | Cross-Cutting |
| 16 | Agents → Tools rename | Phase 3.5 / Phase 6.3 |
| 17 | Skills + hooks folder structure | Phase 6.1 / 6.2 |
| 18 | CLI hook integration (future) | Phase 6.2 |
| 19 | Activity ledger | Phase 6.4 |
| 20 | Diff library (`diff` npm) | Cross-Cutting |
| 21 | Front matter standard + progressive disclosure | Cross-Cutting |

---

## Database Architecture

**Global (`fusion-studio-server/data/fusion.db`):**
- Workspace registry
- Chat threads/exchanges
- Calendar events/sources
- System config, themes, tabs
- Secrets/clipboard metadata
- Activity log (future)

**Per-workspace (`<workspace>/ai/<machine>/System/data/`):**
- `workspace.db` — file versioning, checkpoints, undo/redo
- `solobooks.db` — bookkeeping (optional per workspace)
- `state.json` — layout, panel widths, view config
- `theme.json` — base design tokens + slider values

---

## Versioning Strategy (Tiered)

| Tier | Content | Strategy | Pruning |
|------|---------|----------|---------|
| 1 | Source files, docs | Unified diff strings (`diff` npm) | Aggressive: FIFO 20, checkpoint at 21, daily rollup |
| 2 | Invoices, customers | Full JSON snapshot on explicit save | Never auto-delete |
| 3 | Transactions | Append-only log | No versioning needed |

**Daily rollup algorithm:**
- Keep all checkpoints/diffs from today
- Keep only the **last checkpoint** of each prior day
- Delete all intra-day diffs and intermediate checkpoints from prior days

---

## Open Issues from Queue (Not Yet Resolved)

Original queue: Issues #1–#15  
Resolved: #1–#7  
Remaining:

| # | Issue | Status |
|---|-------|--------|
| 8 | iCloud path fragility & fallback | **Discussed, needs decision** — iCloud preferred with folder picker fallback |
| 9 | `postMessage` origin security (wildcard `*`) | Not discussed |
| 10 | Shell vs. view state ownership | Partially resolved by themes-and-state spec |
| 11 | First-run detection mechanism | Not discussed |
| 12 | Main vs. renderer process split | Partially resolved in Phase 1.10 |
| 13 | Duplicate ID handling in `index.json` | Not discussed |
| 14 | Memory cleanup for heavy views | Not discussed |
| 15 | Zustand state shape migration | Not discussed |

---

## Next Session Priorities

1. **Resolve Issue #8** — iCloud path fragility & fallback (user wants to make a ticket for this)
2. **Make second ticket** — topic TBD by user
3. **Return to ROADMAP** — user wants to enrich further with ticketing details
4. **Potential building** — user may want to start implementation after spec is complete

---

## Important Files to Read on Resume

- `ai/<machine>/Views/doc-viewer/specs/ROADMAP.md` — master spec
- `ai/<machine>/Wiki/enforcement/themes-and-state/PAGE.md` — existing theme/state spec
- `ai/<machine>/Wiki/enforcement/code-standards/PAGE.md` — file size/modularity rules
- `fusion-studio-server/lib/event-bus.js` — Universal Event Bus
- `fusion-studio-server/lib/db.js` — SQLite setup
- `fusion-studio-server/lib/tickets/loader.js` — Updated ticket scanner
- `System Files/manifest.json` — template inventory

---

## Notes for Next Session

- User wants to discuss "tiny details around ticketing" before returning to ROADMAP
- User may compact context soon after reading handoff
- User is pre-launch, single copy — no migration concerns
- App branding: **Fusion Studio** (Electron wrapper)
- Repo: **fs-dev**
- User's assignee initials: **RCC**
- Tools view icon: `manufacturing` (Material Symbol / gears)
