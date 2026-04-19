# Multi-Workspace Switching — Spec

**Status:** Draft — design locked, not yet implemented.
**Owner:** Open Robin core.
**Related wiki:** `system_wiki` slug `workspaces-and-views` (system DB).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

Today Open Robin runs against a single hardcoded project root. This spec introduces multi-workspace switching: a user can register multiple repos, switch between them, and have each one keep its own threads, wiki, settings, and background workers.

In production this app ships as Electron. The system DB lives in Electron `userData` and ships with the app. Each workspace is a pointer to a user repo on disk; the workspace list survives across launches; per-workspace state lives inside each repo's own `ai/`.

**Dev-time quirk:** Open Robin is currently being meta-developed inside Open Robin. `ai/system/robin.db` lives inside this repo as a development accident. In the production Electron build, the Open Robin repo is not present on the user's machine — they only see workspaces for their own repos. Treat the current location as transitional.

---

## 2. Mental model

A workspace is a project-level container. Each workspace has:

- An entry in the system DB `workspaces` table (registry, persistent)
- Its own `ai/` tree on disk inside the repo (threads, wiki, settings, etc.)
- A runtime state in RAM when loaded (`active` or `background`)
- Background workers that run independently of all of the above

**Exactly one workspace is `active` at any moment.** Others are either `background` (display cached in RAM) or unloaded (display dumped, threads still governed by their own timer, registry entry persists).

**Or zero workspaces are active.** When the registry is empty (fresh install in production Electron) or every registered workspace has been culled by the launch validator (§6a), the app enters its empty state: no sidebar, no panels, just the main content background with a single centered "Add Project" folder tile. The menu button in the top-left corner is the workspace switcher entry point regardless of state.

---

## 3. Three runtime tracks (fully decoupled)

| Track | Mechanism | Default | Scope |
|---|---|---|---|
| Display layer | LRU eviction | 5 workspaces | display state only |
| Thread layer | per-thread idle timer (suspended in-flight) | 45 min | chat threads only |
| Background workers | own pool, cooldown setting (deferred) | — | ignores the other two |

These three tracks **never reach into each other.** No thread cap influences workspace eviction. No workspace eviction kills threads. No display dump touches background workers. They are independently observable, independently configurable, independently testable.

### 3a. Display layer (workspace-scoped FIFO)

- Each workspace, once visited, has its rendered display state cached in RAM.
- Visiting a *new* workspace not already cached promotes it to MRU.
- When the cap is exceeded, the LRU workspace's display is evicted (its `ai/` data and threads remain untouched; only the rendered layer goes).
- Switching to a *cached* background workspace just promotes it — no eviction fires.
- Setting: `enforcement.max_workspace_displays_in_ram` (default 5).

### 3b. Thread layer (per-thread idle timer)

Each thread is in one of two states:

```
IDLE  ──turn:start──▶  IN_FLIGHT
  ▲                        │
  │                        │
  └──turn:end (start fresh timer)
```

- **`IDLE`** — eligible for eviction. Idle timer is running.
- **`IN_FLIGHT`** — eviction fully suspended. Timer is not running.

A turn end starts a fresh timer. A new turn start suspends it. A long-running 30-minute turn cannot be evicted mid-reply because the thread is `IN_FLIGHT` for the entire duration. This lets a user fan out across multiple threads while one runs long.

When the timer fires, the thread is evicted (state persisted to disk, RAM session killed). Coming back to it cold-loads from disk.

- Setting: `enforcement.thread_idle_timeout_minutes` (default 45).

### 3c. Background workers (exempt)

Background workers ignore the `active`/`background` workspace state, ignore display FIFO, ignore thread idle timer. They run on their own pool, governed only by the (deferred) cooldown setting. A worker keeps running whether its parent workspace is active, backgrounded with display cached, or fully unloaded. Whether the user has visited the workspace in a week is irrelevant to the worker.

### 3d. Hot reload (no central controller)

Hot reload is **not** a centralized concern. There is no `reload-controller`. Each module that holds RAM state subscribes to the events that should invalidate that state and handles its own reload. The Universal Event Bus *is* the hot-reload pattern.

| Trigger | Event | Subscriber | Reload action |
|---|---|---|---|
| Settings change (timeout) | `settings:enforcement_changed` | thread-lifecycle-controller | rebase all idle timers from the moment of change |
| Settings change (display cap) | `settings:enforcement_changed` | display-lru-controller | adjust cap; if shrunk, evict LRU until under the new cap |
| Workspace CSS file edit (future) | `workspace:css_changed` | display layer | reinject styles |

For the timeout setting specifically (resolving §11 question 4): when the user changes the value, every `IDLE` thread gets a fresh `new_timeout` window starting **from the moment of the change**, not from the original `last_activity`. `IN_FLIGHT` threads are unaffected — their timers are not running. No surprise evictions: a save click never causes a thread to disappear under the user.

When the next reload concern appears (probably workspace CSS), it adds a new event and a new subscriber. Nothing in §3d changes. There is no shared "reload" code to maintain because there is nothing structurally common between "recompute timers" and "reinject stylesheets" beyond the words.

---

## 4. Data model

### 4a. `workspaces` table (system DB)

Existing schema is repurposed. Placeholder rows are dropped. `repo_path` becomes load-bearing.

```sql
CREATE TABLE workspaces (
  id          text PRIMARY KEY,           -- slug, unique
  label       text NOT NULL,              -- user-facing name
  icon        text DEFAULT 'folder',
  description text,
  repo_path   text NOT NULL UNIQUE,       -- absolute, canonicalized path to repo root
  sort_order  integer DEFAULT 0,          -- explicit ordering in switcher
  created_at  text DEFAULT CURRENT_TIMESTAMP
);
```

`workspace_themes` continues to FK to `workspaces.id` unchanged.

**`repo_path` canonicalization (resolving §11 question 3):** every path is canonicalized via `fs.realpath()` (resolves symlinks and `.`/`..` segments) and lowercased on darwin (case-insensitive filesystem) before insertion. The `UNIQUE` constraint then guarantees no two rows can point at the same on-disk repo. When the user attempts to add a path that resolves to an existing row, the workspace controller emits `workspace:add_rejected_duplicate` carrying the existing row, and the client surfaces a modal: *"This repo is already in use in another workspace."*

**Migration note:** the seven current placeholder rows (`system`, `chat`, `home-office`, `bookkeeping`, `media-center`, `code-editor`, `research-vault`) are dropped. They were never wired to anything beyond the theme baseline.

### 4b. Settings (enforcement pane)

Two new keys, both user-adjustable:

| Key | Default | Range |
|---|---|---|
| `enforcement.max_workspace_displays_in_ram` | 5 | 1–unbounded |
| `enforcement.thread_idle_timeout_minutes` | 45 | 1–unbounded (0 disables) |

A future `enforcement.background_worker_cooldown_*` key set is reserved but out of scope for this spec.

### 4c. Runtime state (RAM only — never persisted)

```
WorkspaceRuntimeState
├── loaded: Map<workspace_id, { state: 'active'|'background', display: …, lru_position: int }>
└── active_id: string | null    ← null = empty state, app shell renders blank canvas

ThreadRuntimeState
├── loaded: Map<thread_id, { state: 'IDLE'|'IN_FLIGHT', idle_timer: handle|null, workspace_id: string }>
```

These two state slices are independent. Neither imports the other.

### 4d. `system_config` (resolving §11 question 1)

A single key in the existing `system_config` table tracks which workspace was active at last shutdown so the next launch can restore it:

| Key | Value | Behavior |
|---|---|---|
| `last_active_workspace_id` | text (workspace id) or NULL | On launch, the workspace controller validates the row still exists in `workspaces` AND survived the launch validator (§6a); if so, that becomes the active workspace. If the row was culled, fall through to first by `sort_order`. If the registry is empty, `active_id` stays `null` and the app renders the empty state. |

Written on every successful `workspace:switched` event. Single key, single write — no schema change to `workspaces`.

---

## 5. Event taxonomy

All cross-module communication flows through the existing Universal Event Bus. **No module calls a function in another module to drive workspace or thread lifecycle.** Modules emit events; other modules subscribe and react. Naming follows the existing colon-separated wire convention.

### 5a. Workspace events

| Event | Payload | Emitter | Subscribers |
|---|---|---|---|
| `workspace:add_requested` | `{ repo_path }` | switcher view, empty-state tile | workspace controller |
| `workspace:added` | `{ workspace }` | workspace controller | switcher view, runtime state |
| `workspace:add_rejected_duplicate` | `{ existing_workspace }` | workspace controller | switcher view (surfaces modal) |
| `workspace:remove_requested` | `{ workspace_id }` | switcher view | workspace controller |
| `workspace:removed` | `{ workspace_id }` | workspace controller | switcher view, runtime state |
| `workspace:culled_at_launch` | `{ workspace_id, reason }` | workspace controller (boot) | runtime state, telemetry |
| `workspace:registry_changed` | `{ workspaces[] }` | workspace controller | switcher view |
| `workspace:switch_requested` | `{ workspace_id }` | switcher view | workspace controller |
| `workspace:switched` | `{ from, to }` | workspace controller | display LRU controller, runtime state, all panel views |
| `workspace:state_changed` | `{ workspace_id, state }` | runtime state | future consumers (hook only) |
| `workspace:loaded` | `{ workspace_id }` | display LRU controller | runtime state |
| `workspace:display_evicted` | `{ workspace_id }` | display LRU controller | runtime state |

### 5b. Thread events (additions to existing taxonomy)

| Event | Payload | Emitter | Subscribers |
|---|---|---|---|
| `thread:turn_start` | `{ thread_id }` | existing turn machinery | thread lifecycle controller |
| `thread:turn_end` | `{ thread_id }` | existing turn machinery | thread lifecycle controller |
| `thread:state_changed` | `{ thread_id, state }` | thread lifecycle controller | runtime state |
| `thread:idle_expired` | `{ thread_id }` | thread lifecycle controller | thread eviction controller |
| `thread:evicted` | `{ thread_id }` | thread eviction controller | runtime state, panel views |

`thread:turn_start` and `thread:turn_end` may already exist under different names — use existing events if so, do not duplicate.

### 5c. Settings events (existing pattern)

| Event | Payload |
|---|---|
| `settings:enforcement_changed` | `{ key, value }` |

The display LRU controller and thread lifecycle controller subscribe and adjust their caps/timeouts hot, with no restart required (per SPEC-30 hot reload).

---

## 6. Module breakdown

Each file has one job. None imports another from a different layer. All cross-module work goes through the bus.

### 6a. Server side

```
services/
  workspace-registry-service.js     ← CRUD on workspaces table; pure data, no events
  workspace-loader-service.js       ← reads an existing workspace's ai/ from disk; pure data
  workspace-bootstrap-service.js    ← scaffolds default ai/ tree on first open; idempotent
  path-canonicalize-service.js      ← fs.realpath() + darwin lowercase; pure function

controllers/
  workspace-controller.js           ← subscribes to workspace:* request events,
                                       calls registry+loader+bootstrap+canonicalize,
                                       emits results. Also runs the launch validator
                                       (see below).
  thread-lifecycle-controller.js    ← subscribes to thread:turn_start/turn_end and
                                       settings:enforcement_changed; manages idle timers;
                                       rebases all timers from now on settings change;
                                       emits thread:state_changed, thread:idle_expired
  thread-eviction-controller.js     ← subscribes to thread:idle_expired,
                                       persists thread, emits thread:evicted
  display-lru-controller.js         ← subscribes to workspace:switched and
                                       settings:enforcement_changed; maintains LRU order;
                                       emits workspace:loaded / workspace:display_evicted

state/
  workspace-runtime-state.js        ← in-RAM map, subscribes to workspace events,
                                       exposes read-only getters
  thread-runtime-state.js           ← in-RAM map, subscribes to thread events,
                                       exposes read-only getters
```

**Launch validator (resolving §11 question 1, edge case).** On boot, `workspace-controller` walks every row in `workspaces` and verifies:

1. `repo_path` exists on disk.
2. `repo_path/ai/` exists (or can be bootstrapped — the workspace was added previously, the folder structure should be intact).
3. The basic folder shape is present: at minimum `ai/views/index.json`. Anything missing the proper structure is silently culled from the registry.

For each culled workspace, emit `workspace:culled_at_launch { workspace_id, reason }`. This is a silent fail by design — no error modal, no alert. The user is sophisticated enough to notice a workspace went missing, and the documentation in the system panel (see §13 TODO) explains why and how to re-add it. After culling, the launch validator tries `last_active_workspace_id` from `system_config`; if that id was culled, it falls through to first by `sort_order`; if the registry is now empty, the app renders the empty state.

**Bootstrap on first open.** When the user adds a path that doesn't yet have an `ai/` tree (i.e., a fresh repo, the common case in production), `workspace-bootstrap-service` scaffolds the default folder structure on the fly. If the path *does* already have an `ai/` tree (i.e., the dev-time meta case of opening Open Robin itself), bootstrap is a no-op — existing data is left alone. This is what makes `workspace-bootstrap-service` idempotent and safe to call unconditionally.

**Layer boundaries enforced:**

- Services never emit events, never touch the bus, never import controllers.
- Controllers never call services in other controllers' files. They call only their own service deps.
- State modules are write-only from controllers via events; read-only from views.

### 6b. Client side

```
views/
  workspace-switcher-view.tsx       ← opens on top-left menu button click; lists
                                       workspaces; emits workspace:switch_requested,
                                       workspace:add_requested, workspace:remove_requested
  workspace-add-modal.tsx           ← folder picker; emits workspace:add_requested
  workspace-duplicate-modal.tsx     ← surfaces on workspace:add_rejected_duplicate;
                                       offers "switch to existing workspace" CTA
  empty-state-view.tsx              ← rendered by app shell when active_id === null;
                                       blank canvas with centered "Add Project" folder
                                       tile; emits workspace:add_requested

state/
  workspaceStore.ts                 ← Zustand slice, subscribes to wire events
                                       (workspace:registry_changed, workspace:switched,
                                        workspace:culled_at_launch,
                                        workspace:add_rejected_duplicate)
```

**Shell-level branch.** The app shell reads `active_id` from `workspaceStore`. When `active_id === null`, it renders only the top-left menu button + `empty-state-view` and suppresses the sidebar and all panel views entirely. When `active_id !== null`, normal chrome returns. This is a render branch, not a separate route — the same shell handles both states.

The switcher view never imports the workspace controller. It emits and subscribes via the bus.

---

## 7. Switching flow (worked example)

User has workspaces `A` (active), `B`, `C`, `D`, `E` cached as background. Display LRU is at cap 5. User clicks workspace `F` in the switcher.

```
1. workspace-switcher-view emits  workspace:switch_requested { workspace_id: 'F' }
2. workspace-controller receives, validates F exists in registry
3. workspace-controller emits     workspace:switched { from: 'A', to: 'F' }
4. display-lru-controller receives:
   - F not in cache → must load
   - cache at cap → evict LRU (say, B)
   - emits  workspace:display_evicted { workspace_id: 'B' }
   - loads F display
   - emits  workspace:loaded { workspace_id: 'F' }
5. workspace-runtime-state receives all of the above, updates:
   - A.state: active → background
   - F.state: background|new → active
   - B: removed from loaded map
6. All panel views (code, wiki, issues, …) react to workspace:switched
   by re-binding to F's data via their existing data layer.
```

Background workers in B keep running. Threads in B keep running per their own timer. Only B's display state went away.

---

## 8. Thread idle timer (worked example)

```
T0:00  user opens thread X, sends message
       → thread:turn_start { X }
       → thread-lifecycle-controller suspends timer for X
       → X.state: IN_FLIGHT
T0:23  reply complete (23-minute turn)
       → thread:turn_end { X }
       → thread-lifecycle-controller starts fresh 45-min timer for X
       → X.state: IDLE
T0:24  user switches to thread Y, fans out work
       (X's timer keeps running in background, untouched)
T1:09  X's timer fires (45 min after T0:24, i.e. T1:09)
       → thread:idle_expired { X }
       → thread-eviction-controller persists X, emits thread:evicted
```

If the user had sent a follow-up to X at T0:50, `thread:turn_start` would have suspended the timer again — eviction averted.

---

## 9. Settings panel additions

Two new controls in the enforcement pane:

| Control | Field | Default | Notes |
|---|---|---|---|
| Max workspace displays in RAM | number input | 5 | Min 1, no max. Tooltip explains LRU behavior. |
| Thread idle timeout (minutes) | number input | 45 | 0 disables timeout entirely. Tooltip explains in-flight protection. |

Both emit `settings:enforcement_changed` on change. The display LRU controller and thread lifecycle controller subscribe and adjust live.

---

## 10. Out of scope (explicit non-goals)

- Background worker cooldown / pause / resume — reserved for a future spec.
- Per-workspace background worker quotas.
- Cross-workspace search / global thread index.
- Workspace import from a remote source (git clone integration).
- Workspace export / archive.
- The Electron migration of the system DB out of `ai/system/`.
- Replacing the dev-time `ai/system/robin.db` with `userData` storage.
- Reordering / drag-and-drop in the switcher beyond `sort_order` field support.

---

## 11. Decisions log

All four open questions resolved during design.

1. **Launch state → `system_config.last_active_workspace_id`.** Single key, written on every successful switch. On launch, validated against the registry + launch validator (§6a); if culled or absent, falls through to first by `sort_order`; if registry is empty, app renders empty state. See §4d.
2. **Empty state → blank canvas with centered "Add Project" tile.** No sidebar, no panels, no chat list. Only chrome is the top-left menu button (workspace switcher entry point). Same shell, render branch on `active_id === null`. See §2 + §6b.
3. **Identity collision → dedupe by canonicalized `repo_path`.** `UNIQUE` constraint enforced at SQL level. Path canonicalized via `fs.realpath()` + darwin lowercase before comparison. Duplicate add attempts surface a modal: *"This repo is already in use in another workspace."* See §4a + `workspace:add_rejected_duplicate` in §5a.
4. **Hot reload → no central controller, per-module subscription.** Settings change emits `settings:enforcement_changed`; thread-lifecycle-controller and display-lru-controller subscribe and adjust live. Timeout-specific behavior: every `IDLE` thread gets a fresh `new_timeout` window starting from the moment of the change (not from original `last_activity`). `IN_FLIGHT` threads unaffected. No surprise evictions on save. See §3d.

---

## 12. Code-standards compliance checklist

- [x] Each new file has one job (verified in §6).
- [x] No file expected to exceed 400 lines.
- [x] Imports respect layer boundaries (services ⊥ events, controllers ⊥ DOM, views ⊥ services).
- [x] All cross-module work goes through the Universal Event Bus.
- [x] No premature abstractions — modules added only where the spec demands them. No central reload controller (§3d).
- [x] No scope creep — background worker cooldown, Electron migration, switcher reorder all explicitly out of scope.
- [x] Naming follows existing conventions (`feature-controller.js`, `domain:action` events, `workspaceStore.ts`).

---

## 13. TODOs (follow-up work, not blocking this spec)

- [ ] **Document the launch validator behavior in the system panel.** When a workspace is silently culled because its `repo_path` no longer exists or its `ai/` structure is broken, the user has no notification. Add a wiki page (under enforcement or system storage) explaining: *"Workspaces are tied to their repo on disk. If you move, rename, or delete a repo's folder — or remove its `ai/` directory — the workspace will quietly disappear from the switcher on next launch. Re-add it via the menu button to restore."* This makes the silent fail discoverable when a user asks Robin about it.
- [ ] **Empty-state UX details.** This spec defines the structural behavior (blank canvas + centered tile). Visual design — tile size, exact icon, copy, hover state, what happens on click — is left to a follow-up. Uses the standard `--bg-primary` token for the canvas background per the existing theme system.
- [ ] **Bootstrap default `ai/` tree contents.** `workspace-bootstrap-service` needs an authoritative manifest of what files/folders to scaffold for a fresh repo. This is a small spec on its own — what does the minimum viable workspace look like? Out of scope here, but blocks first-open of any user repo.
- [ ] **Confirm `thread:turn_start` / `thread:turn_end` event names against existing turn machinery.** §5b notes these may already exist under different names. During implementation, audit and reuse rather than duplicate.
