# Universal View Tab Bar — SPEC

**Date:** 2026-08-27
**Status:** Draft v12 — clean-room reviewed; OD-1 RESOLVED (B11 empty-tab semantics incl. activity-pipeline exclusion), path-actions uniformity scoped (§4.1), owner placement revision folded in; ONE bounded two-key server delta (§9.1). No open decisions remain.
**Enforces:** `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/PAGE.md`
**Supersedes:** None (initial)
**Machine:** RC-MacAir-15

---

## 1. Problem Statement

The capture-viewer gained a tabbed mode (tabs latched by the shell `+` button while a doc is open full-screen). Its first implementation placed the tab strip *inside* the view's grid branch (`DocViewerHeader` slot). Result: two live bugs —

1. **Strip never appears over open documents.** `CaptureTiles` early-returns `<FilePageView>` for full-screen docs; that render path has no strip.
2. **Tabs don't displace the centered title / position left.** The centered chrome title is owned by a different component than the one rendering tabs, so there is nothing to align against.

Root cause is architectural: each view's internal branches must remember to mount a per-view tab bar; any missed branch silently drops it. Meanwhile the file viewer already owns a mature, battle-tested tab row (icon + name + ×, active fill, hover reveal, keyboard activation) that is *not importable* — `TabRow` is private to `FileViewer.tsx` and wired directly to `useFileStore`.

**Thesis:** the top tab bar is universal view chrome, like `ViewLayoutControls`. It should live above the content surface, shell-rendered, with per-view semantics injected. Lower headers stay view-specific.

## 2. Solution Shape

### 2.1 Shell-rendered rail (the fix for the bug class)

`ContentFrame` in `ContentArea.tsx` renders a new **`ViewTabBar`** above the view body, inside `.rv-content-area`, positioned as the first flex child above existing content. No view renders its own copy; no branch can forget.

```
app header
└── AppHeaderLayoutControls             (content expand/reduce — first_page/last_page; owner-relocated)

.rv-content-area
├── .rv-view-layout-controls            (minimalist conditional overlay: capture plus pre-tabs + threads-dock edge case)
├── ViewTabBar                          (NEW — shell-owned, conditional)
└── {panel content}                     (view mounts as today)
```

The top bar is **minimalist**: it holds only tabs + the plus button (tabs mode); in non-tab mode the BAR renders nothing — the centered title text stays view-rendered exactly as today (B2; §2.2's contract is "strip or nothing"). Content/chat expand-collapse controls no longer live in this zone — the owner relocated them to the app header (`AppHeaderLayoutControls` in `ViewLayoutControls.tsx`, mounted at `App.tsx`); the old `dock_to_left`/robot overlay buttons are gone from the content area.

Integration details: the bar renders with `flex: 0 0 auto` (override `.rv-content-area > * { flex: 1 }` so it does not grow like a view body); the `.rv-view-layout-controls` overlay is `position: absolute` (out of flow) and may coexist with the latched strip only for the threads-dock edge case — keep the strip's top edge clear of the overlay's 4px offset zone (e.g., strip padding-top), with z-index below the overlay's.

### 2.2 Components

| Piece | Path | Job |
|-------|------|-----|
| `ViewTabBar` | `fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx` | Shell host. Reads panel id → resolves adapter → decides visibility via mode config → renders strip or nothing. One job: host+route. |
| `ViewTabStrip` | same dir | Dumb presentational rail: config-in / callbacks-out. Clones file-viewer anatomy exactly (icon, label, close button, active fill, hover reveal of ×, Enter/Space keyboard activation, and the in-strip trailing plus slot after the last tab per §2.4). |
| `ViewTabBar.css` | same dir | Strip + bar styles. Token-fallback recipes cloned from `.rv-file-viewer-tab` treatments currently split across `document.css` (`.rv-file-viewer`-scoped overrides) AND machine-side CSS: `ai/RC-MacAir-15/System/styles/file-viewer.css` plus `Views/<id>/styles/layout.css` compact-density rules (pinned by `file-viewer-tabs.spec.ts`). Class prefix: `rv-view-tab-*`. |
| Adapters | `same dir/viewTabAdapters.ts` | Per-panel registry mapping panel id → `{ getTabs, getActiveId, onSelect(id), onClose(id), getLabel(tab), getIcon(tab), visibility: {...} (see §2.3), plus?: {...} (see §2.4) }`. |

Dependency rules honored: components accept props/callbacks only; adapters touch stores; views register handlers.

### 2.3 Mode submodule

Per-panel mode decides when the rail shows:

- `'always'` — file viewer. Rail visible whenever its adapter reports ≥1 open tab.
- `'state'` — capture viewer. Visible only when the latched flag says so (derived from `docViewerTabs.length > 0`, re-homed into the adapter so the shell stays generic).

Declared in the adapter as `visibility: { mode: 'always' } | { mode: 'state', isVisible(state): boolean }`.

### 2.4 Plus button policy

Plus presence is a **per-adapter flag**, not hardcoded per view. Views without a `plus` block render no plus at all (absent by default):

```ts
plus?: {
  label: string;            // aria/title text, e.g. 'New file tab', 'New capture view'
  icon?: string;            // default 'add'
  availability: 'always'    // surface whenever the view is active…
            | 'expanded';   // …only while expanded/openable content occupies the view
  onPlus: () => void;       // click semantics stay view-owned (plus duplicates HOST paradigm)
}
```

| `capture-viewer` | `expanded` | Easter-egg rule B1: hidden until a doc is full-screen or tabs are latched. |
| `file-viewer` | `always` — **ships this cycle** (OD-1 resolved, §3.2) | Placement parity is inherent: in-strip after its tabs, where its current add button already sits. Semantics per B11. |
| other views | none until they adopt the rail | Explicit decision per view; never a default. |

**Placement model (owner-approved, 2026-08-27):**

- **Non-tab mode:** the plus sits at the **far LEFT** of the view's top bar zone (today: the leading slot of the conditional `.rv-view-layout-controls` overlay — the owner's completed preliminary work).
- **Tabs latched:** the plus renders **INSIDE the strip, immediately after the last tab** — exactly the file-explorer pattern (its in-strip add button after the tab list). First `+` press therefore relocates it: bar converts to tabs, plus hops from far-left to after-tabs. Unlatching (B7) returns it to the far-left slot.
- **Two-slot gating (prevents double-render):** the far-left overlay plus shows only while `docViewerFullPage === true && docViewerTabs.length === 0`; the in-strip plus shows only while `docViewerTabs.length > 0`. Exactly one plus is ever visible.
- `availability` evaluation is adapter-owned, so the shell stays generic. Concrete capture predicate for `'expanded'`: `docViewerFullPage === true || docViewerTabs.length > 0` (matches current gating in `ViewLayoutControls`).

## 3. Behavior Contract — Capture Viewer Tabs

Owner-approved rules from the design conversation (authoritative; builder must not reinterpret):

| # | Rule |
|---|------|
| B1 | Plus button sits at the FAR LEFT of the view's top bar zone when visible; appears only while a doc/artifact is open full screen OR tabs mode is latched. Never on the default tile scroll menu. (Placement model: §2.4.) |
| B2 | Single-item mode = pixel-identical to current classic UI: grid shows centered "Document and Artifact Capture" + section bar; doc view shows centered filename chrome + back-arrow subheader. NO tabs anywhere. |
| B3 | First `+` press converts the top bar to tabs seeded `[open doc] [CAPTURE]`, CAPTURE focused: tabs insert into the bar and the plus RELOCATES from its far-left slot to immediately after the last tab (file-explorer pattern). Tab strip replaces ONLY the upper centered title text. Section bar stays on CAPTURE tabs; back-arrow subheader stays on doc tabs. |
| B4 | CAPTURE tab displays the workspace's capture icon (from `panelConfigs.icon`) + literal all-caps `CAPTURE` (distinct from docs). Docs display their file icon + filename. Same tab anatomy/styling as file-viewer tabs. |
| B5 | Opening a doc from a CAPTURE tab REPLACES that tab in place (`CAPTURE` → filename). If active tab is a doc, a new doc tab appends. Dedupe by path: opening an already-open doc activates its tab instead (right-click tile AND preview-modal Expand both route through this). |
| B6 | Back arrow on a doc tab morphs THAT tab into a fresh CAPTURE (stay put). Any OTHER existing CAPTURE tab is disposed — never more than one CAPTURE simultaneously. |
| B7 | Tabs latch until closed down to ONE item, then unwind to single-item/classic look. Closing the last tab lands on the plain grid. |
| B8 | Per-tab memory: each tab remembers own section/mode, scroll positions, selections. **Tabs survive restarts** (persisted through the existing `state:set` view-state pipeline — see §9). Existing keys (`docViewerMode`, selected-path, scroll keys) describe the ACTIVE tab globally; the controller owns swapping them atomically and mirroring truth into tab entries. |
| B9 | Plus when CAPTURE already open → focus existing CAPTURE (no duplicate). |
| B10 | File viewer adopts the universal placement model: its plus renders in-strip after its tabs — the same position its current add button already occupies — so file-explorer placement parity is inherent, not added. Click SEMANTICS: **RESOLVED (OD-1, §3.2)** — see B11. Capture plus stays expanded-only per §2.4. |
| B11 | File-viewer plus semantics (owner decision, 2026-08-27): tapping it opens a NEW EMPTY TAB (session-only) and slides the right file drawer open if not already visible. The empty tab's content area shows a centered "Select File" placeholder. Create-or-focus: a second tap focuses the existing empty tab rather than stacking duplicates. First file selected from the tree FILLS the empty tab in place (editor-standard) rather than appending. |

### 3.1 Known round-one compromises carried forward or fixed

- Search is CLASSIC-MODE ONLY this cycle: in tabs mode there is no search affordance anywhere (round-one code short-circuits before the search branch when tabs are latched — verified fact, not an aspiration). Adding tabs-mode search is NOT scoped work here; treat its absence as a documented limit.
- Scroll snapshot drift ≤100ms (throttled persistence) — acceptable, document as known.

### 3.2 Decision record

| # | Decision | Resolution |
|---|----------|------------|
| OD-1 | ~~File-viewer plus click semantics~~ **RESOLVED by owner 2026-08-27:** new empty tab + slide out the right file drawer if hidden + centered "Select File" placeholder (now codified as B11). No open decisions remain in this SPEC. | Implemented this cycle per B10/B11. |

## 4. Refactor Targets (file viewer)

1. Move `TabRow` out of `FileViewer.tsx` internals into the shared `ViewTabStrip`.
2. File viewer stops rendering its own strip. Note: `.rv-file-viewer-header` contains ONLY the strip (breadcrumb/symlink/actions live in the sibling `.rv-file-viewer-info` row — file actions now render through the owner-extracted `components/FloatingPathActions.tsx`), so once the strip moves out the empty header wrapper is deleted — file-level chrome reduces to `.rv-file-viewer-info`.
3. Wire the in-strip add button to B11 semantics: `fileStore` gains an empty-tab variant (current `openFileTab(file)` requires an existing path — add a pathless tab shape, e.g. a `kind: 'empty'` EditorTab); clicking the universal plus creates-or-focuses the empty tab, expands the right file drawer via `toggleCollapsed('file-viewer', 'rightCol')` when collapsed, and the content area renders a centered "Select File" placeholder (reuse the existing `.rv-file-explorer-empty` pattern). First real file selection fills the empty tab in place. **Empty-tab persistence exclusion (required):** file-viewer tabs ALREADY persist today via the activity pipeline (`fileStore.persistFileTabs` → `replaceViewTabs` writes `activity.tabs`, force-routed per-view; `hydrateTabsFromActivity` rebuilds them on mount). The empty-tab variant MUST be excluded from that channel — filter `kind: 'empty'` out before `replaceViewTabs`, and have `hydrateTabsFromActivity` defensively drop any pathless activity item — otherwise a pathless item corrupts `activity.tabs` and resurrects a ghost empty tab on every restart.
4. Keyboard/click behaviors preserved verbatim.

Care: `document.css` carries `.rv-file-viewer` scoped overrides of tab visuals; `ai/RC-MacAir-15/System/styles/file-viewer.css` carries base tab styles, and `ai/RC-MacAir-15/Views/002-file-viewer/styles/layout.css` carries compact-density rules (all pinned by e2e). These rules must be re-pointed at the new classes (or generalized to both strips) without changing rendered outcome. Audit each named file before touching tokens — do not assume a single source.

### 4.1 Path Actions Uniformity (owner directive: floating bottom-right across all apps)

The copy-path / send-to-chat pair becomes the floating `FloatingPathActions` component (bottom-right) on every PAGE-LEVEL surface. Boundary rule, applied mechanically:

- **Page/detail-level chrome → migrate to `FloatingPathActions`** (one instance per surface, bound to that surface's current path):
  - already done by owner: `FileViewer.tsx`, `wiki/PageViewer.tsx`, `tickets/TicketBoard.tsx`, `capture/FilePageView.tsx` capture branch
  - remaining: `FilePageView.tsx` `!isCaptureView` branch (email's reuse), `office/OfficeDocumentTopbar.tsx`, `email/EmailDocumentTopbar.tsx`, folder-path pairs in `office/OfficeGrid.tsx` + `email/EmailGrid.tsx` headers, `agents/AgentTiles.tsx` detail view, `wiki/EdgePanel.tsx`
- **Per-item list/tree/menu affordances → UNCHANGED** (not page actions; floating per row would be wrong): `FolderNode.tsx`, `FileNode.tsx`, `wiki/TopicList.tsx`

After migration, remove the superseded inline pairs — delete, don't deprecate. Known cleanup residue: the orphaned `.rv-file-page-actions` rule in `ai/RC-MacAir-15/System/styles/views.css` (~line 1532) becomes dead once its last consumer migrates — delete it in the same pass.

## 5. Fate of Current Capture Implementation

Delete, don't deprecate:

- `capture/CaptureTabStrip.tsx` + `.css` — absorbed into `view-tabs/`
- Tab logic inside `CaptureTiles.tsx` collapses to calling adapter/controller functions
- `captureTabsController.ts` — keep logic, relocate under `components/view-tabs/`; capture specifics become the capture adapter, transition mechanics become the shared tab-controller module
- `docViewerFullPage` / `docViewerTabs` / `docViewerActiveTabId` types stay as-is in `types/index.ts`

No `_unused` prefixes, no compat shims.

## 6. Verification Matrix

| Check | How |
|-------|-----|
| TS + build green | `npm run build` in `fusion-studio-client/` |
| Bounded server delta | ONLY the two-key `FORCE_VIEW_OVERRIDE_TOP_KEYS` addition in `view-state/writer.js`; zero other server diffs (§9.1) |
| e2e passes | `captures-archive.spec.ts`, `clipboard-capture.spec.ts`, AND `file-viewer-tabs.spec.ts`. **Known red baseline:** the owner's preliminary work has already invalidated 8 pins — 3 source pins (`CopyPathButton`/`SendToChatButton` imports + `rv-file-page-actions` wrapper) and 5 machine-CSS pins (`max-width: 200px`→`140px`; divider token→`--content-foreground-color` chain; divider selector now has a `:last-of-type` arm; two `--chat-header-height`→`--view-header-height`). §4 authorizes exact fates: the 5 CSS pins re-pin to current values; of the 3 source pins, the wrapper pin is DELETED (feature deliberately removed — actions are floating now, §4.1) and the import pins re-pin to `FloatingPathActions`. Relocation-related pins update to the shared module/CSS. Never delete coverage beyond the one wrapper pin |
| Visual parity | manual: file-viewer tabs look unchanged (icon/name/×/active/hover/density) |
| B-rule walk | run the eleven-row table in §3 (B1–B11) manually in dev Electron |
| Bug regression | strip visible over open docs; strip displaces centered title, sits left (both modes) |
| Restart survival | with tabs latched: quit app, relaunch → same tab set, same active tab, per-tab sections restored; active DOC tab reopens full-screen (derived from kind — see §9.4), content reloads from its `path` |
| Corrupt-state tolerance | hand-edit the PER-VIEW `Views/001-capture-viewer/state/state.json`: unknown `kind`, missing `id`, non-array, dangling/duplicate `docViewerActiveTabId`, two `capture` entries — hydrate degrades per §9.4 rules, never crashes |
| Per-view routing | `state:set` a `docViewerTabs` patch → key appears in `Views/<id>/state/state.json`, NOT in `System/state/state.json` |
| Plus policy + placement | capture: plus hidden on tile grid; far-left slot ONLY when a doc is open pre-tabs (`docViewerFullPage && tabs === 0`); in-strip after the last tab once tabs latch; exactly one plus ever visible (§2.4). file viewer: plus always visible, in-strip after tabs; B11 semantics (§3). A view with no `plus` block renders none. The content-area TOP-BAR ZONE holds no other expand/collapse chrome except the threads-dock edge case (§2.1); view-internal chrome is unaffected (e.g. file-viewer's in-info tree dock survives, §4 item 2) |
| Empty tab (B11) | tap file-viewer plus → empty tab appears (or existing one focuses), right drawer slides open if hidden, content shows centered "Select File"; second tap focuses, does not stack; first tree selection fills the tab in place |
| Path actions uniformity | every page-level surface listed in §4.1 renders FloatingPathActions bottom-right; per-item tree/list contexts unchanged; no inline copy/send pairs remain on page chrome |

Manual walk documented in PR description with pass/fail per rule.

## 7. Out of Scope

- Persistence of OTHER panels' tab state via this SPEC's schema (capture persists this cycle; the pattern generalizes). File-viewer REAL tabs already persist through the pre-existing `activity.tabs` pipeline (outside this SPEC's schema); only B11 empty tabs are excluded from persistence (§4 item 3).
- Other viewers adopting tabs (office/email/calendar) — rail must make adoption trivial, but their adapters are follow-on work.
- Redesigning lower headers, search UX changes, drag-reorder of capture tabs.

## 8. Forward Compatibility — Transportable Views (planned, not built)

Owner roadmap: after tab behavior propagates to all views, a drag-and-drop feature lets users drag a view icon (file viewer, wiki, …) from the sidebar into another view's content area, opening that view as a new tab ("transportable view panels"). Plus always duplicates the HOST view's own paradigm; drag-and-drop is the only inlet for foreign-view tabs. These constraints are binding on this build even though the feature itself is out of scope:

| # | Constraint |
|---|-----------|
| F1 | `ViewTabStrip` is kind-agnostic. It renders whatever `(icon, label)` the adapter supplies. NO knowledge of `'capture'`/`'doc'` unions or any future `'view'` kind. First-pass bug to avoid repeating: `CaptureTabStrip` branching on `tab.kind === 'capture'`. |
| F2 | Tab ids are opaque globally-unique strings (`cvt-*` prefix today). No semantic meaning encoded in ids. |
| F3 | ~~Do not refactor tab state toward per-tab objects now~~ **Superseded by owner decision (persistence, §9):** tab entries are the durable truth; MIRRORING globals into tab entries is owned exclusively by the controller (transition-time snapshots, §9.3) while live scroll persistence continues hook-driven exactly as today and serves as the snapshot source. Reader components (e.g. `useDocViewerState`) keep reading globals unchanged — zero churn outside the controller. The durable tab array routes to the per-view capsule via `FORCE_VIEW_OVERRIDE_TOP_KEYS` (§9.1), so each panel's tabs stay isolated in its own capsule — isolation holds by routing, not by accident. |
| F4 | Schema headroom: tab records may one day carry `kind: 'view'` + `panelId`. Reserve the concept when writing types/comments; do not implement plumbing. |
| F5 | Activation route = single controller chokepoint (`activateTab`). Whether inactive tabs unmount (today) or hide-keep-alive (possible later) is internal to that chokepoint's consumer. |
| F6 | Server: zero tab-awareness. Data APIs are path-keyed and reentrant; multiple tabs hitting the same panel are ordinary cached reads. Any future server work belongs to drag-and-drop's own spec. |
| F7 | Nested-view mount side effects (duplicate WS listeners, repeated `requestTree`) are known-safe/idempotent reads today; note for the eventual drag-and-drop spec, not actionable here. |

Design intent on record: this spec delivers cosmetic-looking parity, but F1–F7 are the actual deliverables that prevent the transportable-views feature from inheriting debt.

## 9. Tab Persistence Across Restarts (owner-approved, this cycle)

Goal: tabs, active tab, and per-tab UI state survive app restarts — laying the durable-state groundwork that transportable views will later reuse unchanged.

### 9.1 Pipeline (one bounded server delta)

The persistence channel already exists end-to-end; its destination routing has one wrinkle:

```
controller patch → setViewState (RAM) + _persistViewPatch
                 → WS 'state:set' → writeViewStatePatch (server, view-state/writer.js)
                 → ai/<machine>/Views/001-capture-viewer/state/state.json   ← per-view capsule
                   ai/<machine>/System/state/state.json                     ← workspace-shared fallback
```

Writer routing (`view-state/writer.js`): top-level keys listed in `FORCE_VIEW_OVERRIDE_TOP_KEYS` always go to the **per-view** file; any other NEW key defaults to the workspace-shared file unless already pinned there. Today's `activity` / `collections` / `office*` are force-listed; live disk shows all eight current `docViewer*` keys landed in the shared file. Leaving tab keys unrouted therefore contradicts both the isolation story (F3, §8) and the schema section below.

**Required server delta (the ONLY server change in this SPEC):** append `"docViewerTabs"` and `"docViewerActiveTabId"` to `FORCE_VIEW_OVERRIDE_TOP_KEYS` in `fusion-studio-server/lib/view-state/writer.js`. This reuses the established owner mechanism for durable per-view arrays (recents/starred) so the durable-truth tab array lives in the capture-viewer capsule while legacy global keys keep their existing shared-file routing. Verify after wiring: `docViewerTabs` writes land in `Views/<id>/state/state.json`.

Every other constraint stands: server accepts arbitrary JSON keys deep-merged by the resolver; `clientMutationId` tracking applies automatically.

Implementation is a single client chokepoint rule: every PERSISTED write (`docViewerTabs`, `docViewerActiveTabId`) goes through ONE controller helper that calls BOTH `setViewState` AND `_persistViewPatch`. Transition swap patches over the global keys (mode/selected-path/scrolls) remain RAM-only-transient — durability comes from the durable tab array plus hydrate-time re-application (§9.4 step 0). The full-page flag transitions also route through the controller for normalization, but stay RAM-only-transient — never sent through `state:set` (rendering derives from active-tab kind per §9.4; this is why the server delta stays exactly two keys).

### 9.2 Schema — self-describing tab records

```jsonc
// excerpt of Views/<id>/state/state.json
{
  "docViewerTabs": [
    {
      "id": "cvt-lz4f01-a",            // opaque unique string (F2); never parsed for meaning
      "kind": "doc",
      "path": "002-Captures/ideas.md", // IDENTITY: canonical dedupe key; content re-fetched by path on restore
      "name": "ideas.md",              // display only, derivable from path (kept for cheap rendering)
      "extension": "md",               // icon selection, derivable from name (kept)
      "ui": { "mode": "active", "gridScroll": 120, "docScroll": 3408 }
    },
    {
      "id": "cvt-lz4h22-b",
      "kind": "capture",               // singleton kind (rule B6) — no payload beyond remembered section
      "ui": { "mode": "recent" }
    }
  ],
  "docViewerActiveTabId": "cvt-lz4f01-a"
}
// NOTE: docViewerFullPage is intentionally ABSENT from durable state under this SPEC:
// fullscreen rendering is derived from the active tab's kind (§9.4). The field survives
// only as an in-RAM classic-mode flag (existing behavior), never sent through state:set.
```

**Identification contract:** every variant keyed by `kind`; each variant self-contained enough to reconstruct its tab with zero contextual assumptions:

| kind | Identity | Reconstruct from record |
|------|----------|------------------------|
| `doc` | `path` equality | filename/icon derived, content fetched via path, ui restored verbatim |
| `capture` | none (singleton) | label constant `CAPTURE`, panel icon, `ui.mode` |
| `view` *(reserved, NOT built)* | future `panelId` + optional `params` envelope | drag-and-drop spec owns this shape; reserve the concept in types/comments only (F4) |

Derive-over-store where deterministic (doc name/extension), store only non-derivable bits (`ui`, future explicit labels). Latch consistency is automatic: B7 unwinds ≤1 tab to `[]`, so a restored file either shows ≥2-tab rail or clean classic mode — no partial states possible.

### 9.3 Staleness fix folded in — transition-time snapshots replace flush plumbing

Global keys are live-written (~100ms throttled during scrolling). Therefore **at every controller transition, snapshot CURRENT globals into the outgoing entry directly from the store** instead of passing `{gridScroll}` flush args from components. This (a) removes the flush plumbing entirely, (b) fixes the first-pass bug where a tab's `ui` snapshot went stale between swaps, (c) makes the persisted file consistent at rest: entries always mirror last-known globals.

### 9.4 Hydration, normalization & resilience

- `DEFAULT_VIEW_UI_STATE` gains `docViewerTabs: []`, `docViewerActiveTabId: null`. Absent keys → defaults → classic mode (old files read fine by new build).
- Hydration is free: `state:result` handler already applies merged JSON into `viewStates`; UI derives from store.
- **Normalization pass (controller-owned, runs once after hydrate and after every transition):**
  0. Re-apply the resolved active tab record into the GLOBAL keys reader components consume (the controller's existing tab-to-globals mapping): `docViewerMode` ← active tab's `ui.mode`; selected-path key ← doc tab's `path` or null for capture; scroll keys ← `ui` values. This step is what makes restart survival work end-to-end — globals are rebuilt FROM durable entries at hydrate time.
  1. Drop entries that are not objects, lack an `id`, or carry an unknown/disallowed `kind`. A present-but-non-array `docViewerTabs` value coerces to `[]` (→ classic mode).
  2. Deduplicate ids (keep first occurrence).
  3. Enforce the B6 capture singleton — keep the FIRST valid `capture` entry, dispose extras.
  4. Resolve `docViewerActiveTabId`: null out if absent/dangling; otherwise keep.
  5. Derive effective render state deterministically: normalized tabs ≥2 → strip latched, active = resolved id or first entry; ≤1 remaining → unwind to classic (B7); active tab with `kind:'doc'` renders full-screen FilePageView regardless of any stale `docViewerFullPage` value.
- Resilience rule of thumb: malformed input degrades silently to safe defaults; crash-proof over perfect.
- Concurrency note: two instances sharing one workspace+machine subtree = whole-key last-writer-wins (identical to existing selected-path behavior). Accepted; document, don't engineer around.

### 9.5 Upgrade path delivered for transportable views

When drag-and-drop arrives, its tabs are new `kind: 'view'` variants in the same array, persisted by the same chokepoint — schema design above is the groundwork the owner asked for; nothing about §9 is throwaway.
