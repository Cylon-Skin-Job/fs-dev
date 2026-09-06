# Universal View Tab Bar — SPEC

**Date:** 2026-08-27
**Status:** Implemented and accepted at commit `9f89aea`; retained as the
foundation contract for later tab work. The accepted orchestrator report named
below controls where this pre-implementation wording differs from an accepted
necessary-integration deviation.
**Enforces:** `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/PAGE.md`
**Supersedes:** None (initial)
**Machine:** RC-MacAir-15
**Sequence:** Implemented before `GENERIC_COMPONENT_TAB_HOST_SPEC.md`, which in
turn precedes `COMPOSABLE_THREADED_CHAT_SPEC.md` and
`MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`. It is neutral to capsule physical location.

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
| `ViewTabBar` | `fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx` | Shell host. Reads panel id → resolves the connected adapter → renders strip plus one labeled tabpanel, or children only when no adapter exists. One job: host+route. |
| `ViewTabStrip` | same dir | Dumb presentational rail: config-in / callbacks-out. Clones file-viewer anatomy exactly (icon, label, close button, active fill, hover reveal of ×, Enter/Space keyboard activation, and the in-strip trailing plus slot after the last tab per §2.4). |
| `ViewTabBar.css` | same dir | Strip + bar styles. Token-fallback recipes cloned from `.rv-file-viewer-tab` treatments currently split across `document.css` (`.rv-file-viewer`-scoped overrides) AND machine-side CSS: `ai/RC-MacAir-15/System/styles/file-viewer.css` plus the registry-resolved file-viewer capsule's `styles/layout.css` compact-density rules (pinned by `file-viewer-tabs.spec.ts`). Class prefix: `rv-view-tab-*`. |
| Adapters | `same dir/viewTabAdapters.ts` | Store-owning registry mapping panel id to the explicit `ViewTabAdapterModel`: panel/list identity, ordered descriptors, active ID, tabpanel focus policy, select/close callbacks, and optional add action. |

Dependency rules honored: components accept props/callbacks only; adapters touch stores; views register handlers.

### 2.3 Adapter availability as implemented

The accepted implementation expresses visibility by whether the connected hook
returns an adapter; it did not add a separate visibility-mode submodule:

- File Viewer returns no adapter at zero tabs. The first file-tree selection
  creates the first real file tab; the rail and trailing plus then appear.
- Capture returns an adapter only for a latched multi-tab surface or its
  controller-owned recovery case. Classic single-content mode stays tabless.

`ViewTabBar` therefore renders children without tab semantics whenever the
adapter is null.

### 2.4 Plus button policy

Plus presence is a **per-adapter action**, not hardcoded per view. An adapter
without `add` renders no plus:

```ts
add?: {
  label: string;
  icon?: string;
  onAdd: () => string | null;
};
```

| `capture-viewer` | adapter supplies add only while the tab rail is latched and not in its recovery-only state | The classic document's pre-tab plus remains separately owned by the existing layout controller. |
| `file-viewer` | adapter supplies add whenever at least one file/home tab exists | The first file-tree selection creates the first real tab; thereafter plus follows B11. |
| other views | none until they adopt the rail | Explicit decision per view; never a default. |

**Placement model (owner-approved, 2026-08-27):**

- **Non-tab mode:** the plus sits at the **far LEFT** of the view's top bar zone (today: the leading slot of the conditional `.rv-view-layout-controls` overlay — the owner's completed preliminary work).
- **Tabs latched:** the plus renders **INSIDE the strip, immediately after the last tab** — exactly the file-explorer pattern (its in-strip add button after the tab list). First `+` press therefore relocates it: bar converts to tabs, plus hops from far-left to after-tabs. Unlatching to one document (B7) returns it to the far-left slot; unlatching to CAPTURE collapses to the plain grid and hides it.
- **Two-slot gating (prevents double-render):** derive `isTabsLatched` from at least two normalized tabs. The far-left overlay plus shows only while `docViewerFullPage === true && !isTabsLatched`; the in-strip plus shows only while `isTabsLatched`. Exactly one plus is ever visible. A retained single hidden document record is classic mode, not a latched strip; a lone CAPTURE is normalized back to the record-free classic grid per B7.
- Availability is adapter-owned by returning/nulling the adapter or omitting its
  add action, so the shell remains generic.

## 3. Behavior Contract — Capture Viewer Tabs

Owner-approved rules from the design conversation (authoritative; builder must not reinterpret):

| # | Rule |
|---|------|
| B1 | Plus button sits at the FAR LEFT of the view's top bar zone when visible; appears only while a doc/artifact is open full screen OR tabs mode is latched. Never on the default tile scroll menu. (Placement model: §2.4.) |
| B2 | Single-item mode = pixel-identical to current classic UI: grid shows centered "Document and Artifact Capture" + section bar; doc view shows centered filename chrome + back-arrow subheader. NO tabs anywhere. |
| B3 | First `+` press converts the top bar to tabs seeded `[open doc] [CAPTURE]`, CAPTURE focused: tabs insert into the bar and the plus RELOCATES from its far-left slot to immediately after the last tab (file-explorer pattern). Tab strip replaces ONLY the upper centered title text. Section bar stays on CAPTURE tabs; back-arrow subheader stays on doc tabs. |
| B4 | CAPTURE tab displays the workspace's capture icon (from `panelConfigs.icon`) + literal all-caps `CAPTURE` (distinct from docs). Docs display their file icon + filename. Same tab anatomy/styling as file-viewer tabs. |
| B5 | Opening a doc from a CAPTURE tab REPLACES that tab in place (`CAPTURE` → filename). If active tab is a doc, a new doc tab appends. Dedupe by path: opening an already-open doc activates its tab instead (right-click tile AND preview-modal Expand both route through this). |
| B6 | While the strip is latched, Back on a doc tab morphs THAT tab into a fresh CAPTURE (stay put). Any OTHER existing CAPTURE tab is disposed — never more than one CAPTURE simultaneously. In classic single-document mode, the existing Back control instead uses §9.3's acknowledged ownership handoff, clears the last durable document record, and returns to the plain grid; it must never manufacture an inaccessible hidden CAPTURE record. |
| B7 | Tabs latch until closed down to ONE item, then unwind to single-item/classic look. A document survivor remains as the hidden durable record that restores classic document content and can be exited through the classic Back control in B6. A CAPTURE survivor is already visually the plain grid, so the same close transition uses the acknowledged crash-safe handoff in §9.3: persist its latest UI into legacy globals first, then clear the tab array. There is therefore no hidden CAPTURE record with no close affordance. |
| B8 | Per-tab memory: each tab remembers own section/mode, scroll positions, selections. **Tabs survive restarts** (persisted through the existing `state:set` view-state pipeline — see §9). Existing keys (`docViewerMode`, selected-path, scroll keys) describe the ACTIVE tab globally. Whenever at least one durable tab record exists—including one hidden document survivor—the controller is the sole persistence owner: it owns atomic swaps and live write-through into that record while globals are reader-facing RAM projections only. The legacy durable global-key writer is used in record-free classic mode and only during §9.3's ordered ownership handoff immediately before the last record is cleared. |
| B9 | Plus when CAPTURE already open → focus existing CAPTURE (no duplicate). |
| B10 | File viewer adopts the universal placement model after its first real tab exists: its plus renders in-strip after its tabs. With zero tabs the accepted adapter is absent; the first file-tree selection creates the first real tab and reveals the rail/plus. Capture plus remains governed by its classic-versus-latched controller behavior. |
| B11 | File-viewer plus creates or focuses one session-only pathless FILES Home tab and slides the right file drawer open if hidden. Home shows centered "Select File" content. Only a selected Home is filled in place by the next file selection; otherwise a file selection appends/activates by the existing file-store rules. Home never persists or hydrates. |

### 3.1 Known round-one compromises carried forward or fixed

- Search is CLASSIC-MODE ONLY this cycle: in tabs mode there is no search affordance anywhere (round-one code short-circuits before the search branch when tabs are latched — verified fact, not an aspiration). Adding tabs-mode search is NOT scoped work here; treat its absence as a documented limit.
- Scroll snapshot drift ≤100ms (throttled persistence) — acceptable, document as known.

### 3.2 Decision record

| # | Decision | Resolution |
|---|----------|------------|
| OD-1 | ~~File-viewer plus click semantics~~ **RESOLVED and accepted:** after at least one real tab exists, create/focus one session-only FILES Home, open the drawer, show "Select File," and fill only the active Home. At zero tabs the file tree creates the first real tab. | Implemented per B10/B11 and the accepted orchestrator report. |

## 4. Refactor Targets (file viewer)

1. Move `TabRow` out of `FileViewer.tsx` internals into the shared `ViewTabStrip`.
2. File viewer stops rendering its own strip. Note: `.rv-file-viewer-header` contains ONLY the strip (breadcrumb/symlink/actions live in the sibling `.rv-file-viewer-info` row — file actions now render through the owner-extracted `components/FloatingPathActions.tsx`), so once the strip moves out the empty header wrapper is deleted — file-level chrome reduces to `.rv-file-viewer-info`.
3. Wire the in-strip add button to B11 semantics through
   `openViewHomeTab()`: create/focus one pathless `kind: 'home'` record only
   after a real tab exists, expand the right file drawer when collapsed, and
   render the centered "Select File" surface. `openFileTab()` replaces only an
   active Home. File persistence filters Home out before `activity.tabs`, and
   hydration accepts only real path-bearing file records.
4. Keyboard/click behaviors preserved verbatim.

Care: `document.css` carries `.rv-file-viewer` scoped overrides of tab visuals; `ai/RC-MacAir-15/System/styles/file-viewer.css` carries base tab styles, and the registry-resolved file-viewer capsule's `styles/layout.css` carries compact-density rules (all pinned by e2e). These rules must be re-pointed at the new classes (or generalized to both strips) without changing rendered outcome. Audit each source before touching tokens — do not assume a single source or hardcode the capsule root.

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
- Keep the `docViewerFullPage`, `docViewerTabs`, and
  `docViewerActiveTabId` state fields in
  `fusion-studio-client/src/types/view-state.ts`, but upgrade
  `DocViewerTabUi` to the §9.2 mode-keyed schema and replace the tab item with a
  discriminated union whose `doc` variant requires `path`. The current flat UI
  shape and optional-path item type do not stay as-is.

No `_unused` prefixes, no compat shims.

## 6. Verification Matrix

| Check | How |
|-------|-----|
| TS + build green | `npm run build` in `fusion-studio-client/` |
| Accepted server integration | Per-view writer keys plus the report's compatible workspace/request-correlation changes in `client-message-router.js` and `workspace-request-handlers.js`; no new route, protocol family, service, schema, or durable/global owner (§9.1) |
| e2e passes | `captures-archive.spec.ts`, `clipboard-capture.spec.ts`, AND `file-viewer-tabs.spec.ts`. **Known red baseline:** the owner's preliminary work has already invalidated 8 pins — 3 source pins (`CopyPathButton`/`SendToChatButton` imports + `rv-file-page-actions` wrapper) and 5 machine-CSS pins (`max-width: 200px`→`140px`; divider token→`--content-foreground-color` chain; divider selector now has a `:last-of-type` arm; two `--chat-header-height`→`--view-header-height`). §4 authorizes exact fates: the 5 CSS pins re-pin to current values; of the 3 source pins, the wrapper pin is DELETED (feature deliberately removed — actions are floating now, §4.1) and the import pins re-pin to `FloatingPathActions`. Relocation-related pins update to the shared module/CSS. Never delete coverage beyond the one wrapper pin |
| Visual parity | manual: file-viewer tabs look unchanged (icon/name/×/active/hover/density) |
| B-rule walk | run the eleven-row table in §3 (B1–B11) manually in dev Electron |
| Bug regression | strip visible over open docs; strip displaces centered title, sits left (both modes) |
| Restart survival | with tabs latched: quit app, relaunch → same tab set, same active tab, per-tab sections restored; active DOC tab reopens full-screen (derived from kind — see §9.4), content reloads from its `path` |
| Corrupt-state tolerance | hand-edit the registry-resolved capture-viewer capsule's `state/state.json`: unknown `kind`, missing `id`, non-array, dangling/duplicate `docViewerActiveTabId`, two `capture` entries — hydrate degrades per §9.4 rules, never crashes |
| Per-view routing | `state:set` a `docViewerTabs` patch → key appears in the registry-resolved view capsule's `state/state.json`, NOT in shared `System/state/state.json`; after the later relocation SPEC, the same check resolves under `System/Views/<id>/` without changing this feature |
| Plus policy + placement | capture: plus hidden on tile grid; far-left classic control while a document is open before latching; in-strip after the last tab once latched; exactly one plus visible. File Viewer: at zero tabs no rail/tabpanel/plus exists; first tree selection creates a real tab and reveals them; thereafter plus follows B11. An adapter without `add` renders none. |
| FILES Home (B11) | after a real file tab exists, tap plus → one Home appears/focuses, drawer opens if hidden, and centered "Select File" renders; second tap focuses rather than stacks; a file selection fills only the active Home; Home never persists/hydrates |
| Path actions uniformity | every page-level surface listed in §4.1 renders FloatingPathActions bottom-right; per-item tree/list contexts unchanged; no inline copy/send pairs remain on page chrome |

Manual walk documented in PR description with pass/fail per rule.

## 7. Out of Scope

- Persistence of OTHER panels' tab state via this SPEC's schema (capture persists this cycle; the pattern generalizes). File-viewer real tabs already persist through the pre-existing `activity.tabs` pipeline; B11 Home is session-only and excluded (§4 item 3).
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
| F6 | The universal tab rail and ordinary content data APIs have zero knowledge of tab kinds. Later domain features may persist or project opaque tab descriptors through the existing view-state service, but they must not teach the shared rail or content APIs what a side chat, document, or transported view means. |
| F7 | Nested-view mount side effects (duplicate WS listeners, repeated `requestTree`) are known-safe/idempotent reads today; note for the eventual drag-and-drop spec, not actionable here. |

Design intent on record: this spec delivers cosmetic-looking parity, but F1–F7 are the actual deliverables that prevent the transportable-views feature from inheriting debt.

## 9. Tab Persistence Across Restarts (owner-approved, this cycle)

Goal: tabs, active tab, and per-tab UI state survive app restarts — laying the durable-state groundwork that transportable views will later reuse unchanged.

### 9.1 Pipeline and accepted bounded integration

The persistence channel already exists end-to-end; its destination routing has one wrinkle:

```
controller patch → setViewState (RAM) + controller-local persistPatch
                 → correlated WS 'state:set' → writeViewStatePatch
                 → <registry-resolved capsule>/state/state.json       ← per-view capsule
                   ai/<machine>/System/state/state.json                ← workspace-shared fallback
```

Writer routing (`view-state/writer.js`): top-level keys listed in `FORCE_VIEW_OVERRIDE_TOP_KEYS` always go to the **per-view** file; any other NEW key defaults to the workspace-shared file unless already pinned there. Today's `activity` / `collections` / `office*` are force-listed; live disk shows all eight current `docViewer*` keys landed in the shared file. Leaving tab keys unrouted therefore contradicts both the isolation story (F3, §8) and the schema section below.

The implementation appends `"docViewerTabs"` and
`"docViewerActiveTabId"` to `FORCE_VIEW_OVERRIDE_TOP_KEYS` in
`fusion-studio-server/lib/view-state/writer.js`. It also includes the accepted
compatible necessary-integration delta recorded in the orchestrator report:
optional request/workspace correlation on existing state and file-mutation
families, originating-workspace fan-out scoping, stale/mismatched response
rejection, same-workspace mutation/load ordering, and pending-record cleanup on
timeout, abort, synchronous send failure, close, or socket-generation change.
These changes add no route, protocol family, service, schema, or durable/global
state owner.

Implementation retains one controller persistence chokepoint. Every persisted
tab write updates renderer state and uses the controller-local `persistPatch`
wrapper to send the existing correlated `state:set` envelope and await its exact
acknowledgement. This accepted wrapper is intentionally not the generic
`_persistViewPatch` helper named in the original plan. Both paths share the
established mutation tracking and server family; future transport changes must
update or consolidate both.

While any durable tab record remains, transition swap patches over global
mode/selected-path/scroll keys are RAM-only projections—durability comes from
the tab array plus hydrate-time re-application. The only exception is the
explicit tab-owner-to-classic-owner handoff in §9.3: it durably writes the
already-existing legacy global keys and waits for acknowledgement before
clearing the final record. The full-page flag transitions route through the
controller for normalization but stay RAM-only and never enter `state:set`.

### 9.2 Schema — self-describing tab records

```jsonc
// excerpt of <registry-resolved-view-capsule>/state/state.json
{
  "docViewerTabs": [
    {
      "id": "cvt-lz4f01-a",            // opaque unique string (F2); never parsed for meaning
      "kind": "doc",
      "path": "002-Captures/ideas.md", // IDENTITY: canonical dedupe key; content re-fetched by path on restore
      "name": "ideas.md",              // display only, derivable from path (kept for cheap rendering)
      "extension": "md",               // icon selection, derivable from name (kept)
      "ui": {
        "mode": "active",
        "lastOpenedPath": "002-Captures/ideas.md",
        "byMode": {
          "active": {
            "selectedPath": "002-Captures/ideas.md",
            "gridScroll": 120,
            "docScroll": 3408
          },
          "archive": {
            "selectedPath": null,
            "gridScroll": 44,
            "docScroll": 0
          }
        }
      }
    },
    {
      "id": "cvt-lz4h22-b",
      "kind": "capture",               // singleton kind (rule B6) — no payload beyond remembered section
      "ui": {
        "mode": "recent",
        "lastOpenedPath": null,
        "byMode": {
          "active": { "selectedPath": null, "gridScroll": 0, "docScroll": 0 },
          "archive": { "selectedPath": null, "gridScroll": 0, "docScroll": 0 }
        }
      }
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

Derive-over-store where deterministic (doc name/extension), store only non-derivable bits (`ui`, future explicit labels). Latch consistency is automatic: two or more normalized records render the strip, one retained document restores hidden single-document/classic state, and zero records restore the plain grid. A lone CAPTURE reached while unwinding transfers through B7's acknowledged two-phase handoff; it is not retained as an unreachable tab record after that succeeds.

`ui.byMode.active` owns the globals used by Active, Recent, and Starred;
`ui.byMode.archive` owns the Archive globals. Each bucket contains its own
`selectedPath`, `gridScroll`, and `docScroll`, while `ui.mode` records the active
section and `lastOpenedPath` preserves the remaining tab-varying navigation
fact. Update `DocViewerTabUi` to this complete mode-keyed shape; the old flat
`gridScroll`/`docScroll` record is accepted only as a one-time migration input
and normalized into the bucket selected by its saved mode.

```ts
type DocViewerModeBucket = {
  selectedPath: string | null;
  gridScroll: number;
  docScroll: number;
};

type DocViewerTabUi = {
  mode: 'active' | 'recent' | 'starred' | 'archive';
  lastOpenedPath: string | null;
  byMode: {
    active: DocViewerModeBucket;
    archive: DocViewerModeBucket;
  };
};
```

### 9.3 Staleness fix folded in — transition-time snapshots replace flush plumbing

Whenever one or more normalized durable tab records exist, tab-varying mode,
selected-path, and scroll changes route through one controller-owned live
write-through helper. That includes a hidden single document survivor after the
strip unwinds; a CAPTURE survivor instead performs B7's one-time ordered handoff
to legacy globals as defined below. The helper updates the reader-facing globals and the active tab's
current mode bucket plus `ui.mode`/`lastOpenedPath` and identity fields in one
store transition, while preserving the other mode bucket, then persists the updated
`docViewerTabs` array through the same chokepoint. Scroll updates retain the
current ~100ms throttle; discrete mode and selection changes persist
immediately. `useDocViewerState` and other producers must call this helper
instead of durably writing active-tab globals on their own. The existing
durable global-key behavior remains only in true classic mode with zero durable
tab records; once a record exists, those globals are RAM projections and cannot
compete as a second persistence owner.

Two transitions transfer ownership back to classic globals: closing down to a
lone CAPTURE and using classic Back on a lone document. At the controller
chokepoint they use an ordered, acknowledged two-phase handoff:

1. snapshot and sanitize the survivor's complete Active/Archive mode,
   selection, last-opened-path, and scroll state;
2. persist those existing legacy global keys through the controller-local
   correlated `persistPatch` wrapper and wait for the exact `state:result`;
3. only after success, persist `docViewerTabs: []` and
   `docViewerActiveTabId: null`; and
4. then expose the record-free grid/classic owner in the UI.

If phase 1/2 fails, retain/reopen the durable survivor and report the failure.
A crash before the clear leaves the tab record authoritative; a crash after the
clear finds already-durable globals. The two file destinations therefore do not
need a fictitious cross-file atomic write and never leave zero durable owners.

Additionally, **at every controller transition, snapshot CURRENT globals into
the outgoing entry directly from the store** instead of passing `{gridScroll}`
flush args from components. This is a final same-chokepoint guard for any update
between the last throttled write and the transition. Together, live write-through
and transition snapshots (a) remove component flush plumbing, (b) prevent a
tab's durable `ui` from going stale after the last transition, and (c) keep the
persisted tab array consistent at rest.

### 9.4 Hydration, normalization & resilience

- `DEFAULT_VIEW_UI_STATE` gains `docViewerTabs: []`, `docViewerActiveTabId: null`. Absent keys → defaults → classic mode (old files read fine by new build).
- Hydration is free: `state:result` handler already applies merged JSON into `viewStates`; UI derives from store.
- **Normalization pass (controller-owned, runs once after hydrate and after every transition):**
  1. Drop entries that are not objects, lack a non-empty opaque `id`, or carry an unknown/disallowed `kind`. A present-but-non-array `docViewerTabs` value coerces to `[]`.
  2. Validate and sanitize the discriminated variant. A `doc` requires one canonical non-empty path inside the view's supported content namespace; missing/unsafe paths drop the record. A `capture` carries no document path. Sanitize `ui.mode`, `lastOpenedPath`, and both required `byMode.active`/`byMode.archive` buckets; each bucket accepts only a safe nullable selected path and finite bounded grid/document scroll values. Discard unknown fields, fill missing values from safe defaults, and migrate the earlier flat scroll shape into only its selected bucket. Update the TypeScript type to a discriminated union so `path` is required for `kind: 'doc'` rather than remaining optional on every variant.
  3. Deduplicate ids (keep first occurrence), then deduplicate canonical document paths per B5 (keep first). If the requested active ID names a dropped duplicate, remap it to the retained record representing the same path.
  4. Enforce the B6 capture singleton — keep the FIRST valid `capture` entry and remap an active duplicate-capture ID to that survivor.
  5. Resolve the final active record only from the surviving entries: retain/remap `docViewerActiveTabId` when possible, otherwise choose the first survivor or null.
  6. Apply that final surviving record to the GLOBAL keys reader components consume exactly once: `docViewerMode` and `docViewerLastOpenedPath` come from `ui`; both Active and Archive selected-path/grid-scroll/doc-scroll global sets come from their matching `ui.byMode` buckets. For a selected doc, its canonical `path` remains the displayed document identity and the current bucket is normalized consistently with it. Never apply a record before validation, deduplication, and singleton removal decide that it survives.
  7. Derive effective render state deterministically: normalized tabs ≥2 → strip latched with the resolved active record; exactly one `doc` survivor → retain that record durably, hide the strip, and render classic document state from it; exactly one `capture` survivor from hydrate or any transition → keep it authoritative while scheduling §9.3's acknowledged legacy-global handoff, then clear the two tab keys and render the record-free grid; zero survivors → safe classic/grid state owned by durable globals. A surviving active `doc` renders full-screen FilePageView regardless of any stale `docViewerFullPage` value, and its classic Back control uses the same handoff before clearing the record and returning to the grid.
- Resilience rule of thumb: malformed input degrades silently to safe defaults; crash-proof over perfect.
- Concurrency note: two instances sharing one workspace+machine subtree = whole-key last-writer-wins (identical to existing selected-path behavior). Accepted; document, don't engineer around.

### 9.5 Upgrade path delivered for transportable views

When drag-and-drop arrives, its tabs are new `kind: 'view'` variants in the same array, persisted by the same chokepoint — schema design above is the groundwork the owner asked for; nothing about §9 is throwaway.

### 9.6 Downstream handoff to thread-keyed worksurfaces

This SPEC lands before visible thread groups. Until the composable-chat group
layer exists, Capture's top-level `docViewerTabs` and File Viewer's existing
`activity.tabs` remain the sole owners of their current view-global tab state.

When `COMPOSABLE_THREADED_CHAT_SPEC.md` lands, its connected worksurface adapter
changes the persistence destination while a visible thread group is selected:

- thread-varying tabs, locations, selection, mode, and scroll state write only
  to `viewStates[viewId].threadWorksurfaces[threadGroupId]`;
- the existing top-level Capture keys and File Viewer `activity.tabs` remain an
  unbound view-default surface only when no visible thread group is selected;
- a group without a stored worksurface starts from the adapter's declared safe
  default and does not silently clone the unbound view-default surface;
- the adapter must stop the old top-level/activity writer while group-bound so
  the same open-tab fact never has two persistence owners; and
- File Viewer's `kind: 'home'` tab remains session-only in either mode.

The controller's transition-time snapshot rule in §9.3 remains authoritative.
The downstream adapter reads current state at its controller chokepoint; it does
not reintroduce component-supplied flush arguments or a second tab controller.

`GENERIC_COMPONENT_TAB_HOST_SPEC.md` is the sole intervening owner of generic
component-backed content and empty-container lifecycle. This implemented rail
SPEC does not acquire component resolution, Side Chat, plugin, or launcher
semantics retroactively.

## 10. Dependency-Ordered Vertical Slices

Each slice starts from the public shell UI, crosses the connected adapter and
owning state path, and finishes with focused user-observable verification before
the next slice begins.

### Slice 1 — Shell-owned Capture rail

- First add the two `FORCE_VIEW_OVERRIDE_TOP_KEYS` entries and the accepted
  request/workspace correlation lifecycle so every tab write is per-view and
  every acknowledgement is attributed before mutation.
- Mount the shared rail from `ContentFrame`, adapt Capture through explicit
  callbacks, and remove the view-local strip.
- Exercise the first-plus transition, doc/CAPTURE switching, close-to-classic
  behavior, and keyboard operation through the rendered shell.
- Route live active-tab mode, selection, and throttled scroll updates through
  the controller write-through helper and prove a final edit with no later tab
  transition survives restart.
- In tab A, set distinct Active and Archive selection/grid/document scroll
  values, change modes, switch to tab B and back, restart, and prove both mode
  buckets plus the selected mode round-trip without inheriting B's globals.
- Latch two tabs and close to one document survivor; change its mode, selection,
  and scroll in the classic-looking surface, restart, and prove the survivor—not
  a stale durable global—restores the exact latest state. Use classic Back and
  prove it clears the durable record and returns to the grid after restart.
- Repeat with CAPTURE as the survivor and prove the close-to-one transition
  durably acknowledges its latest sanitized classic UI state in the legacy
  globals before clearing the tab record; inject failure/crash on each side of
  the two phases and prove restart always has one owner, then restart on the
  plain grid with no inaccessible record after success.
- Run the client build and Capture regressions before proceeding.

### Slice 2 — File Viewer adoption and session-only Home tab

- Move the existing File Viewer strip into the shared rail without changing
  its file-tab behavior or style.
- Preserve zero-tab classic Files: the first file-tree selection creates the
  first real tab and reveals rail/plus.
- Add the create-or-focus Home, drawer opening, Select File surface, and
  active-Home-only fill-in-place behavior through the public plus button.
- Prove Home never enters `activity.tabs`, restart never resurrects it,
  and the existing real-tab persistence route still hydrates.

### Slice 3 — Per-view Capture persistence and cleanup

- Through the routing installed in Slice 1, prove the two durable Capture keys
  travel over the public `state:set` path to the registry-resolved capsule, then
  prove restart/readback and corrupt state normalization.
- Prove malformed duplicate/singleton/dangling-active input is reduced to the
  final surviving tab before that record is applied to reader globals. Cover a
  pathless/unsafe doc, malformed `ui`, duplicate IDs, duplicate canonical doc
  paths, duplicate Capture records, and active-ID remapping.
- Complete the path-action migrations and visual parity checks in §4.1.
- Run a stale-symbol sweep for `CaptureTabStrip`, its CSS, the old private
  `TabRow`, superseded inline path-action pairs, and the orphaned CSS selector;
  delete the old paths once the shared route passes.
