# VIEW-02 Implementation Report — New Tab Behavior Corrections

**Written:** 2026-09-10, by the VIEW-02 corrections orchestrator session
**Bundle:** `ai/RC-MacAir-15/Captures/028-System-View-Relocation-And-Configured-Tabs/`
**Contract:** `VIEW-02-NEW-TAB-BEHAVIOR-SPEC.md` (the contract) + `VIEW-02-OWNER-DIRECTIVE.md`
(rank 1) + `VIEW-02-CORRECTIONS-HANDOFF.md` (state/mechanics). Report contents per
`GUIDANCE.md` "Required implementation report contents".
**Note on scope:** this report covers the VIEW-02 corrections run (the seven job items
dispatched 2026-09-10). The inherited uncommitted VIEW-02 session work (adapters,
presenters, `tabs` config) was reconciled, not reverted; its presentation surfaces are
part of the accepted candidate and are inventoried here where this run touched them.
With this report the implementation-report debt of the previous VIEW-02 session and of
this session is discharged by one consolidated document.

---

## 1. Identity and prerequisite evidence

- **Repository root (worktree, the candidate):** `/Users/rccurtrightjr./.codex/worktrees/9572/fs-dev`
- **HEAD:** detached at `7f0d3c862845609bada9605607c506c99363fcb0`
  ("docs: accept trusted shell authority implementation")
- **Tree state:** dirty BY DESIGN (322 dirty paths at final count) = accepted VIEW-01 +
  the previous VIEW-02 session's uncommitted work + three interim patches (handoff §5,
  reconciled) + the bundle docs. **No commit, revert, clean, stash, or reset was
  executed at any point.** The dirty tree IS the candidate.
- **Prerequisite:** VIEW-01 accepted and closed (report + acceptance ledger in
  `RELEASE-MANIFEST.md`; 002 drift ledger in `RECOVERY-002-CLOSURE.md`). Baseline of
  the three standing gates re-established on the pre-work dirty tree at session start
  (see §6, baseline row).
- **Protected bytes respected:** `fusion-studio-client/e2e/view-capsule-public-shell-smoke.mjs`
  unmodified (sha256 `a5cad011d0712c2493de14fc399b0ff4ddd53db94c5fad654994c115138a8bd8`
  before and after the run); no server data/migration files touched; no
  `ai/RC-MacAir-15/System/state/state.json` or other owner live-tree view-state bytes
  touched; `/Applications/Fusion Studio Alpha.app` and
  `/Users/rccurtrightjr./projects/fs-dev` never touched.
- **Merge commits:** none — the tree constraints for this run explicitly forbid
  committing. The candidate is the current dirty worktree state; the owner/supervisor
  decides commit granularity at acceptance.

## 2. What shipped (shape)

Executed as six implementation slices (S1–S6) plus final integration (S7), one fresh
`spec-slice-builder` per slice, each gated by a builder-owned fresh
`spec-gate-reviewer` pass and an orchestrator acceptance pass (§3).

### S1 — Per-view new-tab policy pipeline (spec §7)
- Server strict parser `fusion-studio-server/lib/views/tab-policy.js`: the `tabs`
  object now accepts BOTH the pre-existing 5-key shape and an extended 6-key shape
  with an optional `newTab` record — exact keys `{blankKind: 'home'|'empty',
  autoOpenDrawer: boolean}`, fail-closed (invalid ⇒ that view's `tabPolicies` entry
  becomes `unavailable`; never throws). The normalized ready policy ALWAYS carries a
  total frozen `newTab`; defaults when absent: `{blankKind: 'empty', autoOpenDrawer:
  false}`. Schema version stays 1. Wire projection (`buildTabPolicyWireEntry` →
  `buildTabPoliciesProjection` → panel_config `tabPolicies`) carries it.
- Client strict parser `src/lib/tab-policy-projection.ts` mirrors the extension and
  REQUIRES `newTab` on ready policies (the single wire producer always emits it);
  `TabPolicy` type + both stand-in policies updated (Capture stand-in home/false,
  File stand-in empty/true).
- Config shipped (live + template, byte-identical pairs):
  - `ai/RC-MacAir-15/System/Views/001-capture-viewer/content.json` +
    `System_Manager/ai-template/templates/view-templates/002-capture-viewer/content.json`:
    `tabs.newTab = {blankKind: "home", autoOpenDrawer: false}`
  - `ai/RC-MacAir-15/System/Views/002-file-viewer/content.json` +
    `System_Manager/ai-template/templates/view-templates/010-file-viewer/content.json`:
    `tabs.newTab = {blankKind: "empty", autoOpenDrawer: true}`
- Owner-pinned values implemented exactly (§7): **File: `empty`; Capture: `home`.**

### S2 — Chrome: one strip, always (spec §3)
- `SingleTabIdentity` centered-chrome path RETIRED: `SingleTabIdentity.tsx` deleted,
  `viewTabSingleIdentityDomId` deleted, the `.rv-component-tab-single-*` CSS block
  removed, zero residual references (only negative counter-assertions in specs).
- `ViewTabBar` renders the left-aligned `ViewTabStrip` unconditionally — one tab
  renders exactly like twenty (same 36px strip geometry, same + / close actions, same
  focus-recovery contract). `TabLocationRail` untouched. The `'single'` shell-mode
  value survives as inert internal machinery (deviation D-S2-1).

### S3 — Plus button contract + blank lifecycle + hydration sentinel (spec §4, §9)
- Plus is dumb and deterministic, never a menu: active tab Home → no-op; active tab
  Empty → no-op; otherwise create the view's configured blank per
  `policy.newTab.blankKind` — recentering an existing blank (same recenter contract
  as reopening an open document). A view never holds two blanks.
  - `blankKind 'home'` (Capture): TABS-03 placement `new` to the landing target
    (`capture.landing` / `CAPTURE_HOME_TARGET_KEY`) — exact match activates+reveals,
    else appends; never fills an Empty tab. Implemented via a new bounded owner-port
    capability `blankPlacementTarget` (supplied by Capture; File deliberately omits
    it — File's blank is the Empty tab).
  - `blankKind 'empty'` (File): activate the existing Empty tab or create exactly one.
- New pure transition `dedupeConfiguredBlankTabs` (componentTabLifecycle.ts): ≤1 blank
  of the configured kind per view; lone sentinel returned unchanged by identity; rank
  rule pending > failed > first-in-order; a pending reservation is never dropped;
  active remap onto the kept blank; idempotent; runs as ONE atomic intent inside
  `ensureInitial` (hydration normalization).
- Cold-start sentinel survival: hydrated generic records still win over initial
  policy; a lone persisted sentinel is never eaten (proven by connected-owner tests).

### S4 — Empty tab presentation + drawer-only fill (spec §6, §5, §7)
- The `EmptyTabPanel` "Add content" launcher GRID is RETIRED — no menu, no launcher
  buttons on any Empty tab. The reservation machinery survives generically (pending /
  failed / retry / cancel as the bounded failure surface), with a bounded
  `reservationLabel` channel and a new optional bounded `renderEmptyBody(tabId)` slot
  so a view can supply its Empty body without leaking view vocabulary into the shell.
- File Empty reference pattern shipped in File-owned modules:
  `file-explorer/FileEmptyTabBody.tsx/.css` — centered folder icon, "Open file"
  (larger font), "Select a file from the workspace tree" (normal font), plus a dock
  control on the established `toggleCollapsed('file-viewer','rightCol')` seam.
- `autoOpenDrawer` honored (§7): the generic runtime exposes creation-only
  `onEmptyTabCreated(tabId)`; the File connected adapter expands the drawer on session
  creation of an Empty tab (initial policy or + -created blank) when the shipped
  policy says so (File: true). Hydrated sentinels are NOT "created" this session and
  never fire it (structural: single fire site inside creation transitions).
- Drawer hosting widened: hosted while a File Empty tab is ACTIVE and not collapsed
  (subsumes the reservation-pending hosting); collapse unmounts it; the dock
  re-mounts it; drawer close still retires the pending picker context + reservation.
- Fill contract (§5): the ONLY remaining `current` disposition is the drawer path
  (`lib/file-tree.ts` → `openFileDocument`); all Capture in-app opens (preview-modal
  expand, right-click, new-tab) now use `new` (exact match → recenter; else append —
  an Empty tab is never filled by an in-app open). No condition exists under which a
  Home tab opens an Empty tab (verified by the reviewer tracing all open paths).

### S5 — Tab-scoped presenter state (spec §8)
- The app-wide `activeResourceStore` singleton is RETIRED AND DELETED:
  - `FilePageView.tsx` no longer writes a global "active resource" slot on open;
  - `lib/ws/file-handlers.ts` no longer reads it for `file_changed` refresh;
  - `src/state/activeResourceStore.ts` deleted; zero remaining references (only
    negative source-contract assertions in a spec).
- Live refresh is tab-scoped: `fileDataStore.invalidate(panel, path)` (panel+path
  keyed) + each document presenter's own per-path `requestContent` effect
  (`[generation, path, requestContent]`). No new global introduced.
- Render-path audit: connected document presenters render from their own committed
  descriptor input + per-path store keys; the only view-level read remaining in a
  presenter is `collapsed.rightCol` (drawer layout — explicitly layout-only, not
  presenter content state). `resolveCaptureDocumentTarget` bakes classic
  mode/scroll/selection into a NEW tab's descriptor at placement-resolve time —
  snapshot-at-open into that tab's own record (per-tab state, permitted).
- §11 proof shipped: browser-level test "opening a document in tab B leaves tab A's
  rendered state untouched" (`e2e/capture-connected-adoption-ui.spec.ts`) — tab A's
  committed record deep-equal unchanged after tab B opens; re-activating tab A renders
  its own document from its own record.

### S6 — Consolidation mandate (directive §4) + legacy hydration reconciliation
- §4.1 Single entry points: every connected capture open routes through
  `openCaptureDocument` (via the new presenter-facing `openCaptureDocumentFromPresenter`
  which pins the accepted `new` disposition); every connected file open routes through
  `openFileDocument`; a `false` return now always produces the established toast
  (bounded failure) — no silent classic fallback on any public connected action path.
  Previews remain previews (left-click tile → `DocumentPreviewModal` unchanged).
- §4.3 Dumb presenters: `CaptureTiles` receives `onOpenDocument` from the landing
  registration and contains no `openCaptureDocument` import, no disposition
  selection, and no connected-vs-fallback branching when the handler is supplied
  (source-contract test enforces this). Disposition policy lives in the connected
  layer (`captureConnectedTabs`).
- §4.4 Single chrome source: nothing on a connected public path can render the
  centered classic chrome (`hideChromeTitle` on connected capture documents;
  content-direct File presenter; `ViewTabBar` renders the classic surface only when
  the connected adapter model is absent).
- §4.2 Fallback retirement (kept-with-reason deviation D-S6-2, adjudicated accepted):
  the classic full-page open, `isTabsMode` shim, and legacy local match/fill are
  retired from PUBLIC CONNECTED action paths (reviewer traced every reachability
  route — none reachable). The legacy machinery itself (legacy `useCaptureAdapter`,
  `captureTabsController` legacy functions, `openFileTab` fall-through) remains ONLY
  for: views without a ready `tabPolicies` entry (exact pre-corrections legacy
  behavior), persisted-classic path-reference rewrites on public move/rename/delete,
  and the accepted post-close classic lifecycle. The ONE-TIME classic conversion
  (`captureClassicConversion.ts` + `applyCaptureClassicConversionOnce`) STAYS — it is
  the accepted hydration path for persisted classic state.
- Legacy hydration reconciliation (handoff §2.3/§4 defect — the 6→1 silent reset):
  root-caused and fixed at two levels:
  1. the initial-policy effect could create AND PERSIST the session blank before the
     persisted view state landed (with a mutation in flight the `state:get` response
     merge keeps local state while the server had been overwritten) — now the initial
     policy waits on a new `viewStateLoadPending` gate (set in `loadViewState` when
     the `state:get` is sent; settled on `state:result` / non-stale `state:error` in
     ws-client; reset per workspace switch);
  2. even without persisting, the session blank blocked the one-time classic
     conversion (`records.tabs.length > 0` early return) — now blank-only records
     (home/empty shape, including a mid-flight reservation) are treated as the
     pre-hydration session artifact and discarded ONLY when persisted classic tabs
     exist; real records (any document tab) still win; a lone persisted sentinel with
     no classic tabs is never eaten; post-close collections never re-arm.
  The S3 hydration dedupe now runs when hydration LANDS (the gate is in the
  initial-policy effect deps), closing the async-hydration window flagged by the S3
  review.

## 3. Independent review

Every slice was gated twice by independent fresh read-only `spec-gate-reviewer`
subagents (pinned GLM 5.3 Flash, Nebius Token Factory, high reasoning effort): a
builder-owned gate inside the slice and an orchestrator acceptance gate with no prior
conclusions. All gates ran fail-forward; every gate stopped at its first materially
clean pass.

| Slice | Builder (task) | Builder gate | Acceptance gate | Verdict |
|---|---|---|---|---|
| S1 | ses_f71cabe9cffeWv0jh4HyUr6PNH | pass1 ses_f71c705abffeJnjYPel6CybS71 BLOCKED (broken e2e fixtures) → repaired; pass2 ses_f71c16f3bffeJZC5Vrlv58TuIv CLEAN | ses_f71be3c66ffeOvAYZQjaw9yLb4 | CLEAN |
| S2 | ses_f71bb7b49ffe0gAnbxt9tDYrRb | ses_f71af25eeffeNeSnHn3hWLrZkO CLEAN (1st pass) | ses_f71ac8be9ffeAQj3Wapl2tLi7a | CLEAN |
| S3 | ses_f71a924b0ffeRNDNoNEkBpgkvP | CLEAN (1st pass) | attempt1 ses_f719a08fcffeZ7ziR5BUg9yJOs returned EMPTY (failed closure, lifecycle evidence); attempt2 ses_f7196ecb8ffeqNPRrZKjYc0KDo | CLEAN |
| S4 | ses_f71929a70ffetk8m5JM17G8jhO | ses_f718189edffepmaiuX5u4LQEQN CLEAN (1st pass) | ses_f717e3312ffeZYeYWzgbraBp7Y | CLEAN |
| S5 | ses_f7175f7dfffegHs82NJXAVKEWv | ses_f716f610bffe07jQ4tY1v1y0Ss CLEAN-WITH-ADVISORIES | ses_f716bd2f7ffezbSWivMad1FF6i | CLEAN |
| S6 | ses_f716807caffegoZ1ewGvvXLNm7 | ses_f714a53c2ffeZbEM4brY0GVzW0 CLEAN (1st pass) | ses_f7143d924ffeGz0q4oNMzfbQOZ | CLEAN |
| S7 final integration | (orchestrator) | — | see §10 | see §10 |

No `BLOCKED`/`AUTHORITY_BLOCKED` terminal states at any level. One failed reviewer
closure (S3 attempt 1, empty result) recorded as lifecycle evidence and re-spawned.

## 4. Migration / config schema actually shipped

- **No new database migration.** No server schema change; no WS message type added;
  no new persistence. The durable `tabs` config schema (content.json `tabs`, version 1)
  gains ONE additive-optional record (`newTab`) with total normalized defaults —
  backward compatible: a pre-§7 5-key `tabs` object still parses (defaults apply), and
  the strict fail-closed surface was extended with 21 new server tests
  (2862 → 2883 passing) without weakening any existing assertion.
- Config values shipped: see S1 above (four content.json files, live + template pairs
  byte-identical).

## 5. Public contracts exported or consumed

- **Wire:** panel_config `tabPolicies[viewId].policy.newTab = {blankKind, autoOpenDrawer}`
  (total on every ready policy). Single producer `lib/views/index.js`; single consumer
  parser `src/lib/tab-policy-projection.ts` (requires it; fail-closed to legacy).
- **Owner ports (client, store-free):** `blankPlacementTarget?`,
  `onEmptyTabCreated?` on `ConnectedTabOwnerPorts`; `createOrRecenterBlank(blankKind)`
  on `ConnectedTabOwnerRuntime`; `initialGateOpen?` on the connected adapter config;
  `reservationLabel` + `renderEmptyBody` on the generic empty-body surface
  (`launchers`/`onSelectLauncher` REMOVED from `ViewTabContentAdapter`).
- **Presenter contract:** `CaptureTiles` accepts optional
  `onOpenDocument({folder, path, name})` — supplied by the landing registration;
  disposition selection is owned by the connected layer.
- **Removed public surface:** `SingleTabIdentity.tsx`, `viewTabSingleIdentityDomId`,
  `src/state/activeResourceStore.ts`, the Empty-tab launcher grid, and (from connected
  public paths) the classic full-page open / isTabsMode branches.
- **Server:** `lib/views/tab-policy.js` exports extended (newTab normalization);
  `buildTabPolicyWireEntry` shape extended additively.

## 6. Every test/build/visual command and result

All commands run in the worktree. `--maxWorkers=2` on server jest per the standing
gate (full parallelism flakes two timing suites).

| When | Command | Result |
|---|---|---|
| Baseline (pre-work) | `cd fusion-studio-client && npm run build` | PASS (3.96s) |
| Baseline | `cd fusion-studio-server && npx jest --maxWorkers=2` | 196 suites, 2862 passed, 1 skipped |
| Baseline | `cd fusion-studio-client && node e2e/view-capsule-public-shell-smoke.mjs` | `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK` |
| S1 | server jest (full) | 196 suites, 2883 passed, 1 skipped (+21 tests) |
| S1 | client build; 4× content.json parse + pinned values + live↔template `cmp` | PASS / PASS |
| S1 | `npx playwright test` (6 policy/adoption specs) | 66 passed |
| S2 | client build; chrome specs (52+41 passed); 18-file batch (119 passed + 2 pre-existing reds) | PASS |
| S2 | smoke (unmodified); server jest (full) | `…SMOKE_OK`; 196/2883/1 |
| S3 | client build; connected-owner 22; adoption node 42; adoption UI 14; placement 60 | PASS |
| S3 | smoke; server jest (full) | `…SMOKE_OK`; 196/2883/1 |
| S4 | client build; 20-suite battery 196 passed | PASS |
| S4 | smoke; server jest (full) | `…SMOKE_OK`; 196/2883/1 |
| S5 | client build; adoption UI 8 (incl. §8 proof); 4 related specs 43; ws-message specs 49 | PASS |
| S5 | smoke; server jest (full) | `…SMOKE_OK`; 196/2883/1 |
| S6 | client build; 25-spec battery 228 passed; 11 extra suites green | PASS |
| S6 | smoke — sha256 verified identical before/after the slice | `…SMOKE_OK` |
| S6 | server jest (full) | 196 suites, 2883 passed, 1 skipped |
| S7 final | client build | PASS (4.01s) |
| S7 final | smoke (`VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK`, file unmodified) | PASS |
| S7 final | server `npx jest --maxWorkers=2` | 196 suites, 2883 passed, 1 skipped (29.2s) |
| S7 final | 6-spec adoption/owner/panel battery | 79 passed |

**Known reds, all verified independent of this run** (each reproduced and root-caused
by gate reviewers; none references this run's bytes):
- `e2e/view-tab-runtime.spec.ts` — environmental: expects office-e2e-gated fixture
  files (`Capture-A.md`) that do not exist in the live dev workspace.
- `e2e/workspace-shell-states.spec.ts:87` — header-count source assertion vs
  unrelated uncommitted `App.tsx` session work in the candidate tree.
- `e2e/file-viewer-nav-toggle.spec.ts` — stale source-pattern assertions against
  `App.tsx`/`types`/`viewSlice` bytes this run did not author.
- `e2e/file-connected-adoption-ui.spec.ts` test-2 failure from S1 review was RESOLVED
  during S2 (stale presenter-DOM assertions realigned to the owner-accepted presenter
  contract; test bytes only).
- Full untargeted `npx playwright test` aborts inside the Office e2e infrastructure
  (Electron fixture launch; stacks reference the primary checkout's fixture root) —
  environmental, outside this run's dependency surface; the standing gates do not
  include a full sweep.

## 7. Crash/restart and durability evidence

- The durable smoke (`view-capsule-public-shell-smoke.mjs`, unmodified) passes on the
  final bytes — it launches the real Electron shell against an isolated pre-migrated
  profile (migration-009 seed stripped), exercises the custom-app shell protocol,
  restart, and byte-asserted sentinel preservation, and prints
  `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK`.
- §9 durability is proven at two levels: node-level tests
  (`e2e/capture-connected-adoption.spec.ts` §9 reconciliation block: gate-closed
  initial policy emits no `state:set`; blank artifact discarded only when persisted
  classic tabs exist; lone persisted sentinel never eaten; real records win) and the
  browser-level hydration-gate test (`e2e/capture-connected-adoption-ui.spec.ts`).
  Cold-start sentinel survival + per-view dedupe are proven in
  `e2e/component-tab-connected-owner.spec.ts` (lone-sentinel identity/reservation
  intact; duplicate-blank dedupe; reserved-vs-plain ordering).
- One environmental flake recorded: the smoke timed out once under concurrent load
  from a live acceptance-profile Electron instance (port 54283) and passed on retry
  with identical bytes. Not a product finding.

## 8. Dirty-path preservation evidence

- No destructive git operation was executed at any point (no commit/revert/clean/
  stash/reset/checkout). The tree entered this run dirty (322 paths) and remains
  dirty with all pre-existing work intact — including the three interim patches from
  the VIEW-01 session (handoff §5: `DocumentPreviewModal.css`, `FileDocumentPresenter
  .tsx/.css`, `CaptureTiles.tsx` right-click), which were RECONCILED and extended
  (right-click now routes through the dumb-presenter handler; the presenter patch is
  the accepted content-direct contract; the modal CSS patch is untouched).
- Attributable changed paths of THIS run (compiled from the six slice handoffs and
  verified by orchestrator inspection; the tree also contains prior-session work that
  this run preserved):
  - Client product: `src/components/view-tabs/{componentTabLifecycle.ts,
    componentTabConnectedOwner.ts, componentTabConnectedAdapter.ts, captureConnectedTabs.ts,
    captureViewTabAdapter.ts, captureConnectedOwnerPorts.ts, fileConnectedAdapter.ts,
    fileConnectedTabs.ts, fileConnectedOwnerPorts.ts, EmptyTabPanel.tsx, ComponentTabPanel.tsx,
    ComponentTabShellPanel.tsx, ViewTabBar.tsx, ViewTabStrip.tsx, viewTabContentAdapter.ts,
    viewTabDomIds.ts, componentTabShell.css, componentTabPanel.css}`;
    DELETED: `SingleTabIdentity.tsx`, `src/state/activeResourceStore.ts`;
    `src/components/view-tabs/` NEW: `file-explorer/FileEmptyTabBody.tsx/.css` (under
    `src/components/file-explorer/`);
    `src/components/capture/{CaptureTiles.tsx, FilePageView.tsx}`;
    `src/state/{panelStoreTypes.ts, slices/viewSlice.ts, panelStore.ts}`;
    `src/lib/ws-client.ts`, `src/lib/ws/file-handlers.ts`,
    `src/lib/tab-policy-projection.ts`;
    `src/components/view-tabs/fileConnectedAdapter.ts` (drawer hosting/auto-open).
  - Server product: `lib/views/tab-policy.js`.
  - Config: the four content.json files (S1).
  - Server tests: `test/views/tab-policy.test.js`, `test/views/tab-policy-projection.test.js`.
  - Client specs (fixture/assertion alignment + new §8/§9 proofs): component-tab-*,
    capture/file-connected-adoption*(.spec.ts/_ui), view-tab-contract,
    file-viewer-tabs/empty-tab, tab-policy-projection.
- Out-of-scope touches by this run: test/spec bytes only (listed above), each recorded
  as a deviation (§9) and adjudicated.

## 9. Deviations (all recorded at every gate; none silent)

| # | Original text | Actual change | Reason / effect | Risk | Downstream | Classification |
|---|---|---|---|---|---|---|
| D1 | §7 field "name and placement TBD at implementation" | `tabs.newTab {blankKind, autoOpenDrawer}`, defaults `{empty,false}` | The spec-recommended design adopted verbatim; defines the wire contract | Minimal | Downstream slices consume it | **accepted** |
| D2 | Expected-file lists name no e2e specs | 6 client e2e spec fixtures updated (S1, parser now requires `newTab`) | Mechanically necessary bounded integration | Low (test-only) | Corrections sessions own these files | **accepted** |
| D3 | "do NOT weaken existing fail-closed assertions" | Two exact-shape server test expectations extended with the normalized key | Additive; normalized shape always includes `newTab` | None | — | **accepted** |
| D-S2-1 | §3 retire the single-tab identity | `'single'` shell-mode value + `--single` class retained though now presentationally identical to `'tabbed'` | Removal would broaden the change into presentation-domain validation | None (inert) | Optional future cleanup | **accepted** |
| D-S2-2 | — | Sole-active-tab close focus now follows the universal strip contract | Uniform chrome requires uniform focus recovery | Low | Covered by updated specs | **accepted** |
| D-S2-3 | — | `file-connected-adoption-ui.spec.ts` stale presenter-DOM assertions realigned (test bytes only) | The asserted info bar was removed by an owner-accepted interim patch; assertion was red pre-slice | Low | Resolves the S1 downstream impact early | **accepted** |
| D-S3-1..5 | Plus focus after create (stays on +); dedupe folded into `ensureInitial`'s single intent; all-pending pathological dedupe leaves duplicates; `home` without capability → bounded no-op; test-harness helpers | as stated | Sync `onAdd` vs lane-async op; lane-FIFO ordering verified; no reservation ever dropped; fail-closed parity; test-only | Low | Owner visual walk should include focus-after-create | **accepted** (all five) |
| D-S4-1..5 | `reservationLabel` bounded channel; `onEmptyTabCreated` owner port; drawer host gated on `!drawerCollapsed`; grid-only harness fixtures kept; shell prop surface extended via `ComponentTabPanelProps` | as stated | Grid items gone (labels needed a channel); §7 needed a creation-observation mechanism; preserves the collapse contract | Low | Seams reusable by future views | **accepted** (all five) |
| D-S5-1 | Harness runtime-descriptor stub in the §8 spec | opt-in `withRuntime` harness stub | Real presenter rendering requires a runtime descriptor; proof otherwise vacuous | Low (test-only) | Reusable for future harness tests | **accepted** |
| D-S5-2 | — | Retired retry edge: panel-bearing `file_changed` on a focused doc with a previously FAILED uncached fetch no longer re-requests until the presenter effect/remount | The old global-slot path no-oped identically for the watcher (panel-less) case; no new global permitted by §8 | Marginal | Fold into future refresh work if it surfaces in dogfood | **accepted** (residual risk) |
| D-S6-1 | Source-contract test asserted presenter-level `openCaptureDocument` bytes | Test realigned to the new dumb-presenter contract (strengthens the gate) | The consolidation removes exactly the asserted surface | Low | — | **accepted** |
| D-S6-2 | §4.2 "the `isTabsMode` shim branch and pre-TABS-03 local tab logic are deleted from the public action paths" | Retired from PUBLIC CONNECTED action paths (reviewer-traced: unreachable); the legacy modules remain for unready-policy views, persisted-classic rewrites, and the post-close lifecycle | Views without a ready `tabPolicies` entry must keep exact legacy behavior; conversion must stay as the hydration path | None on adopted views | Full module deletion can follow once no non-adopted view exists | **accepted** (kept-with-reason) |
| — | — | One failed reviewer closure (S3 acceptance attempt 1, empty result) | Lifecycle evidence; fresh reviewer re-spawned and completed | None | — | lifecycle note |

## 10. Final integration (S7)

- Full SPEC suite on integrated bytes: client build PASS; durable smoke PASS
  (unmodified, sha256 verified); server jest `--maxWorkers=2` PASS (196 suites,
  2883 passed, 1 skipped); adoption/owner/panel battery 79 passed. (Exact tails in §6.)
- Cross-slice contracts inspected: the `newTab` wire shape (S1) is consumed exactly by
  the plus contract (S3) and `autoOpenDrawer` (S4); the S2 strip is the only chrome the
  S3/S4 paths render through; the S5 tab-scoped refresh underpins S6's entry-point
  consolidation; the S6 hydration gate closes the async window the S3/S5 reviews
  flagged. No cross-slice conflict found.
- A fresh `spec-gate-reviewer` final-integration pass on current integrated bytes was
  executed after this report was written. **Verdict: CLEAN** (final-integration gate,
  task `ses_f713d7c8cffevj45Mprnu0pns6`): every §1–§11 criterion verified against the
  integrated bytes; cross-slice contracts verified (wire shape single-producer/single-
  consumer, policy fields consumed exactly by S3/S4, chrome single-source, cleanup
  completeness, schema-version compatibility); the standing gates reproduced at the
  reported numbers on current bytes (build ✓, smoke `…SMOKE_OK` with the pinned sha256,
  server jest 196/2883/1, adoption/owner suites 31+22+7 passed); the report itself was
  audited against the tree (HEAD, 322 dirty paths, sha256, fingerprint instructions all
  reproduced); the deviation ledger adjudicated at SPEC level with no silent
  deviations; impact assessment: `tabPolicies.newTab` = compatible additive extension,
  new seams = platform surfaces for spec §10 future work, **requires downstream
  correction: none; requires owner ruling: none**; three non-blocking advisories
  (the §10 forward reference closed by this paragraph; focus-after-plus-create routed
  to the owner visual walk; `empty.launcherIds` retained consistent with the surviving
  reservation machinery). No repairs were required; the loop stopped at its first
  clean pass.
- **Impact assessment for later SPECs (BRIDGE-01 next per RC's sequence):**
  - `tabPolicies.newTab` is a compatible additive wire extension — no downstream
    correction required; BRIDGE-01 should treat it as part of the accepted policy
    contract.
  - The generic empty-body seams (`renderEmptyBody`, `reservationLabel`,
    `onEmptyTabCreated`, `blankPlacementTarget`, `createOrRecenterBlank`,
    `initialGateOpen`) are the platform surfaces later surfaces (chat display
    surfaces, per spec §10) build on — none require rework.
  - **requires downstream correction:** none identified. **requires owner ruling:**
    none. Office/Email presenters still live-read panel-keyed selection (out of
    VIEW-02's adopted scope) — flagged for a future view-platform pass, not a
    BRIDGE-01 blocker.

## 11. Post-implementation fingerprint (reproduce)

```bash
cd /Users/rccurtrightjr./.codex/worktrees/9572/fs-dev
git rev-parse HEAD                      # 7f0d3c862845609bada9605607c506c99363fcb0 (detached)
git status --porcelain | wc -l          # dirty candidate (no commits made)
cd fusion-studio-client
shasum -a 256 e2e/view-capsule-public-shell-smoke.mjs
# a5cad011d0712c2493de14fc399b0ff4ddd53db94c5fad654994c115138a8bd8  (unmodified gate)
npm run build                           # ✓ built (tsc -b + vite)
node e2e/view-capsule-public-shell-smoke.mjs   # VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK
cd ../fusion-studio-server && npx jest --maxWorkers=2   # 196 suites / 2883 passed / 1 skipped
```

Owner visual-walk launch (preserved valid; the owner runs it after acceptance review):

```bash
cd /Users/rccurtrightjr./.codex/worktrees/9572/fs-dev/fusion-studio-client
env FUSION_APP_USER_DATA="$HOME/.fusion-view01-acceptance" \
    FUSION_LOCAL_MACHINE=RC-MacAir-15 \
    ./node_modules/.bin/electron electron/main.cjs
# server port: cat ~/.fusion-view01-acceptance/server.port
```

Checklist for the walk (spec §11 + directive §5): one tab vs twenty identical
left-aligned strip; + on Home / Empty / Document = nothing / nothing / one blank
recentered; no launcher menu on any Empty tab (File: folder icon + "Open file" +
"Select a file from the workspace tree", drawer auto-opens on creation); opening a
document in tab B leaves tab A untouched; blank survives cold start exactly once;
drawer toggle collapses the tree; rail shows the full path; no centered filename
chrome anywhere.

## 12. Residual risks and scope statements

- Owner visual walk (SPEC §13 + directive §5 + spec §11) is AFTER this run — the owner
  runs it; this run prepared for it (launch config verified valid; renderer built).
- Known reds in the candidate tree owned by OTHER in-flight work: `workspace-shell-states.spec.ts:87`
  and `file-viewer-nav-toggle.spec.ts` (uncommitted `App.tsx` session work),
  `view-tab-runtime.spec.ts` (environmental fixtures). They must be reconciled when
  that session lands.
- Advisories carried (non-blocking, recorded at their gates): focus stays on the +
  button after it CREATES a blank; sub-second pre-hydration window for user-initiated
  opens (transient classic surface, self-healing conversion, no data loss); conversion
  guard on policy-unready views (flag for the visual walk on old-template capsules);
  `evictWorkspaceRuntimeState` leaves `viewStateLoadPending` uncleared (dead weight);
  §8 spec harness bundle-cache never hits (test-only perf); watcher-driven panel-less
  `file_changed` events no longer live-refresh the focused doc (S5-introduced narrowing
  of a niche path, accepted — the tab-scoped mechanism cannot serve panel-less
  messages).
- The bundle mirror in `/Users/rccurtrightjr./projects/fs-dev/…/028-…/` was NOT
  updated (this run is forbidden from touching the primary checkout). Mirroring this
  report and the bundle docs is a pending owner/supervisor step.
- **Explicit scope statement:** direct unsandboxed host writes remain out of scope.
  No host filesystem writes outside the worktree were performed; no commits were made;
  the Alpha installation was not touched.
