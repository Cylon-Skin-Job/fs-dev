# Workspace Chrome Interaction Contract — orchestrator report

Status: `SPEC_READY_FOR_OWNER_REVIEW`

Approved SPEC: `SPEC-WORKSPACE-CHROME-INTERACTION-CONTRACT.md`
Universal prerequisite: `../002-SPECs/UNIVERSAL_VIEW_TAB_BAR_SPEC.md`
Repository: `/Users/rccurtrightjr./projects/fs-dev`
Branch: `agent/exact-workspace-paths` (not `main`)
Baseline provenance: `7422cc4a18ab43668560b7fe55b959fc96c764ff`
Final WCI.3 chained review digest: `226bc2c11a5abb74bd94f86ad0bd1b37dd52344e174085db85271f87ac8aab54`

The approved SPEC and its Universal prerequisite are implemented and materially clean. Each implementation slice passed builder-owned clean-room review, orchestrator inspection and verification, fresh slice acceptance, and a fresh cumulative integration review. No commit or push was performed.

## Slice ledger

| Slice | Result | Builder | Final builder review | Orchestrator acceptance | Primary evidence |
|---|---|---|---|---|---|
| WCI.1 — theme and shell states | Accepted | `/root/wci_1_theme_shell` | `/root/wci_1_theme_shell/wci1_builder_gate_1` — `CLEAN` | `/root/wci_1_acceptance` — `CLEAN` | Build; theme 13/13; shell 2/2 |
| WCI.2A — header menus | Accepted | `/root/wci_2a_header_menus` | `/root/wci_2a_header_menus/wci2a_builder_gate_2` — `CLEAN` | `/root/wci_2a_acceptance_pass2` — `CLEAN` | Build; focused/shared/Office 22/22 |
| WCI.2B — Ribbon Add menu | Accepted | `/root/wci_2b_ribbon_add_menu` | `/root/wci_2b_ribbon_add_menu/wci_2b_clean_room_pass_6` — `CLEAN` | `/root/wci_2b_acceptance_pass3` — `CLEAN` | Build; cumulative menu gate 31/31 |
| WCI.3 — universal tabs and path actions | Accepted | `/root/wci_3_universal_tabs` | `/root/wci_3_universal_tabs/wci3_cleanroom_16` — `CLEAN` | `/root/wci_3_acceptance_pass3` — `CLEAN` | Build; tab/path 19/19; default regressions 5/5; server 35/35 |

Final integrated reviewer: `/root/wci_final_integration_review` — `CLEAN`.

All reviewers reached a terminal result. The available collaboration API did not expose a separate child-closure operation, so terminal lifecycle evidence was used.

## Delivered behavior

### Theme and shell

- The canonical interaction context derives hover, pressed, and selected fills from the local surface at 92/8, 88/12, and 84/16 mixes toward a mode-correct black/white contrast foreground.
- Workspace Foreground owns ordinary/resting shell controls, the workspace title, machine selector contents, inactive tab contents/dividers, and ordinary tab chrome.
- Workspace Accent remains limited in this package to the selected left-rail view/marker and Connected status.
- Hover, pressed, selected-tab, and focus-ring foregrounds use the background-derived contrast token rather than Accent.
- Header, machine selector, Workspace Controls trigger, title/navigation, and left rail use the shared token/state language. The required rail geometry moved from the former 48-pixel treatment to the SPEC's 40/24 treatment.
- Persisted theme generation and live preview emit the same dark/light contrast result. Mounted tests verified preview removal, and generated `themes.css` remained byte-identical.

### Workspace menus

- The AI source selector now uses the shared element-anchored radio-menu path. Local remains checked; remote remains disabled; the existing workspace-store owner is unchanged.
- Workspace Controls now uses the shared action menu with its existing action order, icons, callbacks, and exactly-once effects. Destination focus is generation-tagged so a stale deferred focus cannot enter a closed or replaced surface.
- Connectors remains a specialized surface and owns only its independent close/outside lifecycle.
- The Workspace Ribbon Add menu now uses the shared renderer while the Ribbon overlay, grid, drag/remove behavior, scrim, and modals remain specialized.
- Shared descriptors gained semantic, noninteractive `heading` and `status` records. They never receive menu-item roles, tab stops, roving focus, activation, or outcomes.
- Add Project, Create New, and add-to-ribbon behavior retain their existing owners and results. Modal initial focus is deterministic.
- The replaced native selector, local header action-menu state/listeners/positioning, Ribbon Add DOM/state/listeners/positioning, and their obsolete action-row styles were removed or narrowed.
- No WCI.2 protocol, service, persistence path, store, global owner, or new user action was added.

### Shared tab system and navigation boundary

- `ContentFrame` owns the sole `ViewTabBar` mount. Capture and Files expose adapters; neither view mounts tab DOM or owns shared tab geometry/state CSS.
- `ViewTabStrip` is presentational and store/network/domain neutral. Descriptors and callbacks carry consumer behavior without recreating markup or interaction CSS.
- The shared rail owns responsive shrinking, compact labels, fades, dividers, selected connection, close/add ordering, local token binding, and the canonical `--view-tab-rail-bg: var(--panel-chrome-bg)` alias.
- Left/Right wrap, Home/End, manual Enter/Space activation, closable-only Delete, sequential close/add traversal, focus recovery, tab/tabpanel relationships, and strip-unmount fallback follow the normative contract.
- Files exposes no rail, tablist, tabpanel, or plus at zero tabs. The first file-tree selection creates the first document tab and reveals plus. Plus creates or focuses one session-only pathless FILES home; only an active home is filled by file selection; pathless home never persists or hydrates. Closing the last real tab returns to classic Files.
- Capture full-screen classic documents remain tabless while retaining the already-wired plus. First plus seeds the document and CAPTURE tabs and focuses CAPTURE. CAPTURE is create-or-focus/deduplicated and replaces in place where specified. Closing or Back transitions use acknowledged ownership transfer with recoverable failure behavior.
- Capture preserves independent active/archive UI buckets, normalizes corrupt/legacy records, restores durable tabs across restart, retains required hidden survivors, and clears obsolete legacy paths during final-document path events.
- Active close uses previous-first recovery; inactive focused close preserves the active document and moves focus appropriately.
- The Universal §4.1 page/detail surfaces use the shared floating path actions; tree/list/item actions remain local. Required rename, move, and delete transformations update durable Capture paths without leaking changes across workspaces.

### Shared ViewTabBar API

- `ViewTabBar({ panel, children })` is the shell-owned host. It resolves the registered adapter for `panel`, renders the strip when that adapter exists, and owns the labeled `tabpanel` around `children`; a null adapter renders only the children and therefore exposes no tab semantics.
- `ViewTabAdapterModel` supplies `panelId`, the tablist `label`, ordered `tabs`, `activeId`, `tabPanelTabIndex: 0 | -1`, `onActivate(id)`, `onClose(id)`, and optional `add`. The adapter registry is the only store-owning boundary.
- `ViewTabDescriptor` supplies `id`, `label`, `icon`, optional `iconClassName`, `closeLabel`, optional `closable`, and optional `closeDisabled`.
- `ViewTabAddAction` supplies an accessible `label`, optional `icon`, and `onAdd(): string | null`. A returned ID receives post-add focus; `null` preserves focus on the add control.
- `ViewTabStrip` consumes only those descriptors/callbacks and panel identity. It does not import view stores, persistence, network code, or Capture/File domain logic.

## Shared-menu file responsibilities

- `src/components/menu/MenuSurface.ts`: generic rendering, anchoring, lifecycle, focus restoration, and invocation-element ownership.
- `src/components/menu/MenuSurface.css`: canonical local-surface hover/pressed/focus styling plus safe heading/status/long-label layout.
- `src/components/menu/types.ts`: portable descriptor and handle types, including noninteractive heading/status forms.
- `src/components/menu/menuDescriptors.ts`: stable descriptor identities and descriptor construction shared by the Ribbon consumer/tests.
- `src/components/menu/menuActionRuntime.ts`: generic action eligibility and exactly-once result handling.
- `src/components/menu/menuKeyboard.ts`: roving traversal over interactive records only.
- `src/components/menu/menuSurfaceRecords.ts`: mounted surface/handle bookkeeping and teardown.
- `src/components/menu/menuTree.ts`: generic descriptor-tree rendering/traversal.
- `src/components/menu/menuTreeRecords.ts`: record derivation used consistently by render, keyboard, and runtime paths.
- `src/components/menu/index.ts`: public portable exports only.

No consumer-specific store, Workspace Ribbon dependency, or product action was moved into the portable menu component.

## Selectors removed and intentionally retained

Retired or narrowed selector families include the native/local selector path (`.rv-ai-source-selector__select`), local header action menu (`.rv-header-actions-menu*`), local Ribbon Add menu (`.rv-workspace-ribbon-add-menu*` and its dedicated action rows), old Capture strip (`.rv-capture-tab-*`), old File strip (`.rv-file-viewer-header`, `.rv-file-viewer-tabs`, `.rv-file-viewer-tab*`, and `.rv-file-viewer-tab-bar-action*`), and the obsolete page-action wrapper `.rv-file-page-actions`. Their active markup, geometry/state ownership, or dedicated lifecycle was removed with the migration.

Intentionally retained selectors are the specialized Ribbon overlay/grid/drag/remove/scrim families, the specialized Connectors surface and the shared out-of-scope dropdown stylesheet it still consumes, the shared `.rv-file-page-action` button reset used by `FloatingPathActions`, per-item/tree/list action selectors, and unrelated editor, native, browser-tab, color, table, status, and content/view dropdown families outside the three named Workspace menus. The remaining source references to retired tab symbols are negative regression assertions, not active cascade ownership.

## Verification record

### WCI.1 accepted gates

```text
cd fusion-studio-client && npm run build
```

- Passed: 1,838 modules; 6.740 seconds total; Vite 3.33 seconds.

```text
cd fusion-studio-server && npm test -- --runInBand test/theme/panel-surfaces.test.js
```

- Passed: 13/13; 0.642 seconds.

```text
cd fusion-studio-client && npx playwright test e2e/workspace-shell-states.spec.ts --project=chromium --workers=1
```

- Passed: 2/2; 9.449 seconds.
- Dark/light contrast, same-element token re-derivation, Workspace Foreground/Accent live reassignment, focus-visible, disabled hover, pressed/selected states, and 32/18 plus 40/24 geometry passed.

### WCI.2 accepted gates

```text
cd fusion-studio-client && npx playwright test --config=playwright.office.config.ts \
  e2e/workspace-header-menus.spec.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-shared-menu.spec.ts \
  --project=chromium --workers=1
```

- WCI.2A passed: 22/22; approximately 1.4 minutes. Its client build passed in 6.27 seconds.

```text
cd fusion-studio-client && npx playwright test --config=playwright.office.config.ts \
  e2e/workspace-header-menus.spec.ts \
  e2e/workspace-ribbon-add-menu.spec.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-shared-menu.spec.ts \
  --project=chromium --workers=1
```

- WCI.2 cumulative gate passed: 31/31; approximately 2.1 minutes.
- Ribbon-focused gate passed 8/8 in approximately 1.9 minutes.
- Ribbon all-corner placement repeat passed 3/3 in approximately 2.1 minutes.
- WCI.2B build passed: 1,840 modules; 6.95 seconds total; Vite 3.61 seconds.
- Targeted WCI.2B ESLint passed in 1.57 seconds.

### Final/current-byte WCI.3 gates

```text
cd fusion-studio-client && npm run build
```

- Orchestrator passed: 1,846 modules; 6.42 seconds total; Vite 3.42 seconds.
- Builder frozen gate passed: Vite 3.37 seconds.

```text
cd fusion-studio-client && npx playwright test \
  e2e/view-tab-contract.spec.ts \
  e2e/view-tab-path-events.spec.ts \
  --project=chromium --workers=1
```

- Orchestrator passed: 19/19; 1.67 seconds command time.
- Final builder reviewer independently passed 19/19.

```text
cd fusion-studio-client && npx playwright test \
  e2e/captures-archive.spec.ts \
  e2e/clipboard-capture.spec.ts \
  e2e/file-viewer-tabs.spec.ts \
  --project=chromium --workers=1
```

- Orchestrator passed: 5/5; 11.40 seconds.
- File relocation assertions now inspect the shell host/shared component/shared stylesheet while retaining behavior and geometry coverage.

```text
cd fusion-studio-server && npm test -- --runInBand \
  test/theme/panel-surfaces.test.js \
  test/view-state/writer.test.js \
  test/ws/workspace-folder-mutations.test.js \
  test/ws/workspace-office-thumbnails.test.js \
  test/ws/client-message-router.test.js
```

- Orchestrator passed: 5 suites, 35/35; 0.38 seconds Jest time.
- WCI.3's narrower frozen server gate passed 4 suites, 22/22; 0.478 seconds.

`git diff --check`, targeted ESLint, server syntax checks, old-selector/import/controller sweeps, no-op File-plus sweep, and shared-mount/cascade ownership sweeps passed. Only `ContentFrame` mounts `ViewTabBar`; no active Capture/File consumer defines shared tab geometry or state colors.

Expected pre-existing warnings only: `gray-matter` uses `eval`, the Vite bundle has chunks over 500 kB, Node reports the existing local-storage/DEP0190 notices in relevant harnesses, and Playwright reports the existing `NO_COLOR`/`FORCE_COLOR` notice.

## Clean-room repair ledger

- WCI.2A repaired a stale deferred-focus race into closed/replaced destinations before its final CLEAN review.
- WCI.2B repaired hidden-workspace focus, modal autofocus, narrow-viewport and long-label overflow, and initial WebSocket timing before its final CLEAN review.
- WCI.3 repaired, across sixteen builder review passes, tablist/add placement, Capture handoff ordering/recovery, inactive FILES-home retention, survivor state ownership, file-path transforms, first-plus focus, pressed foreground, File reselect order, Wiki PAGE-path use, corrupt File hydration, classic Back cleanup, final-document stale globals, workspace-scoped state/file responses and broadcasts, immutable async path origins, mutation tracking for every production write, same-workspace load ordering, partial/no-root correlation, lost-ack/reconnect abandonment, and synchronous send-failure cleanup.
- WCI.3 then passed builder clean-room pass 16, independent acceptance pass 3, root verification, and final cumulative integration review without further product edits.

## Compatible necessary-integration deviation

The Universal authority originally limited WCI.3 server work to persisted writer keys and its focused test. Independent review proved that asynchronous state and file responses could otherwise write Workspace A state into Workspace B, or leave hydration permanently blocked after a lost acknowledgement.

The accepted bounded integration therefore:

- adds optional request/workspace correlation to the existing `state:get`, `state:set`, and file move/rename/delete message families;
- scopes the existing `file_changed` fanout to sessions still on the originating workspace;
- rejects stale or mismatched responses before active-state lookup/path transformation;
- tracks same-workspace mutation/load ordering; and
- abandons pending request/mutation records on timeout, abort, synchronous send failure, connection close, or socket-generation replacement while ignoring late abandoned frames.

Classification: `compatible necessary integration`. It adds no route, protocol family, service, schema, durable/global state owner, or consumer-specific menu dependency. Fully uncorrelated legitimate current-workspace legacy frames remain supported. This strengthens future remote-machine isolation and does not constrain later menu, geometry, ViewNavBar, or DocumentSurface work.

The 540-line Capture tab controller exceeds the normal size preference but remains one cohesive acknowledged state machine. Review treated this as advisory, not a product or ownership deviation; a later refactor may delegate its generic persistence mechanics without changing the public tab API.

The acknowledged Capture ownership handoff also uses a controller-local `persistPatch` wrapper to send the existing correlated `state:set` envelope rather than routing through the store's generic `_persistViewPatch` helper named by Universal §9.3. This is an accepted advisory implementation-detail deviation: it shares the same workspace/mutation tracking and server message family, was necessary to await exact acknowledgements, and has no demonstrated behavioral or durable-owner divergence. A future persistence transport change must update or consolidate both chokepoints. It does not affect remote-machine, menu, geometry, ViewNavBar, or DocumentSurface contracts.

## Files changed for this SPEC

Machine-scoped cascade cleanup:

- `ai/RC-MacAir-15/System/styles/file-viewer.css`
- `ai/RC-MacAir-15/System/styles/views.css`
- `ai/RC-MacAir-15/Views/001-capture-viewer/styles/layout.css`
- `ai/RC-MacAir-15/Views/002-file-viewer/styles/layout.css`
- `ai/RC-MacAir-15/Views/007-agents-viewer/styles/layout.css`

Client tests/configuration:

- `fusion-studio-client/playwright.office.config.ts`
- `fusion-studio-client/e2e/captures-archive.spec.ts`
- `fusion-studio-client/e2e/file-viewer-tabs.spec.ts`
- `fusion-studio-client/e2e/office/global-setup.mjs`
- `fusion-studio-client/e2e/shared-menu-component.spec.ts`
- `fusion-studio-client/e2e/view-tab-contract.spec.ts`
- `fusion-studio-client/e2e/view-tab-path-events.spec.ts`
- `fusion-studio-client/e2e/view-tab-runtime.spec.ts`
- `fusion-studio-client/e2e/workspace-header-menus.spec.ts`
- `fusion-studio-client/e2e/workspace-ribbon-add-menu.spec.ts`
- `fusion-studio-client/e2e/workspace-shell-states.spec.ts`

Client shell, menu, and views:

- `fusion-studio-client/src/components/AiSourceSelector.css`
- `fusion-studio-client/src/components/AiSourceSelector.tsx`
- `fusion-studio-client/src/components/App.css`
- `fusion-studio-client/src/components/App.tsx`
- `fusion-studio-client/src/components/ConnectorsDropdown.tsx`
- `fusion-studio-client/src/components/ContentArea.tsx`
- `fusion-studio-client/src/components/Fusion/fusion.css`
- `fusion-studio-client/src/components/HeaderActionsMenu.css`
- `fusion-studio-client/src/components/HeaderActionsMenu.tsx`
- `fusion-studio-client/src/components/Modal/DragFileModal.tsx`
- `fusion-studio-client/src/components/ToolsPanel.css`
- `fusion-studio-client/src/components/ToolsPanel.tsx`
- `fusion-studio-client/src/components/ViewLayoutControls.tsx`
- `fusion-studio-client/src/components/WorkspaceAddModal.tsx`
- `fusion-studio-client/src/components/WorkspaceCreateModal.tsx`
- `fusion-studio-client/src/components/WorkspaceRibbon.css`
- `fusion-studio-client/src/components/WorkspaceRibbon.tsx`
- `fusion-studio-client/src/components/WorkspaceRibbonAddMenu.tsx`
- `fusion-studio-client/src/components/WorkspaceTitle.css`
- `fusion-studio-client/src/components/agents/AgentTiles.tsx`
- `fusion-studio-client/src/components/capture/CaptureTabStrip.css` (deleted)
- `fusion-studio-client/src/components/capture/CaptureTabStrip.tsx` (deleted)
- `fusion-studio-client/src/components/capture/CaptureTiles.tsx`
- `fusion-studio-client/src/components/capture/DocViewerHeader.tsx`
- `fusion-studio-client/src/components/capture/FilePageView.tsx`
- `fusion-studio-client/src/components/capture/captureTabsController.ts` (deleted/moved to shared tab ownership)
- `fusion-studio-client/src/components/email/EmailDocumentTopbar.tsx`
- `fusion-studio-client/src/components/email/EmailGrid.css`
- `fusion-studio-client/src/components/email/EmailGrid.tsx`
- `fusion-studio-client/src/components/file-explorer/FileExplorer.tsx`
- `fusion-studio-client/src/components/file-explorer/FileNode.tsx`
- `fusion-studio-client/src/components/file-explorer/FileViewer.tsx`
- `fusion-studio-client/src/components/menu/MenuSurface.css`
- `fusion-studio-client/src/components/menu/MenuSurface.ts`
- `fusion-studio-client/src/components/menu/index.ts`
- `fusion-studio-client/src/components/menu/menuActionRuntime.ts`
- `fusion-studio-client/src/components/menu/menuDescriptors.ts`
- `fusion-studio-client/src/components/menu/menuKeyboard.ts`
- `fusion-studio-client/src/components/menu/menuSurfaceRecords.ts`
- `fusion-studio-client/src/components/menu/menuTree.ts`
- `fusion-studio-client/src/components/menu/menuTreeRecords.ts`
- `fusion-studio-client/src/components/menu/types.ts`
- `fusion-studio-client/src/components/office/OfficeDocumentTopbar.tsx`
- `fusion-studio-client/src/components/office/OfficeGrid.css`
- `fusion-studio-client/src/components/office/OfficeGrid.tsx`
- `fusion-studio-client/src/components/view-tabs/ViewTabBar.css`
- `fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx`
- `fusion-studio-client/src/components/view-tabs/ViewTabStrip.tsx`
- `fusion-studio-client/src/components/view-tabs/captureTabDomain.ts`
- `fusion-studio-client/src/components/view-tabs/captureTabPathReferences.ts`
- `fusion-studio-client/src/components/view-tabs/captureTabsController.ts`
- `fusion-studio-client/src/components/view-tabs/viewTabAdapters.ts`
- `fusion-studio-client/src/components/view-tabs/viewTabDomIds.ts`
- `fusion-studio-client/src/components/wiki/EdgePanel.tsx`

Client state, persistence, and shared styles:

- `fusion-studio-client/src/hooks/useDocViewerState.ts`
- `fusion-studio-client/src/hooks/useTileFileActions.ts`
- `fusion-studio-client/src/lib/theme/live-preview.ts`
- `fusion-studio-client/src/lib/viewStateMutationTracker.ts`
- `fusion-studio-client/src/lib/workspaceResponseTracker.ts`
- `fusion-studio-client/src/lib/ws-client.ts`
- `fusion-studio-client/src/lib/ws/file-handlers.ts`
- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
- `fusion-studio-client/src/state/fileStore.ts`
- `fusion-studio-client/src/state/panelStoreTypes.ts`
- `fusion-studio-client/src/state/slices/viewSlice.ts`
- `fusion-studio-client/src/styles/document.css`
- `fusion-studio-client/src/styles/variables.css`
- `fusion-studio-client/src/types/file-explorer.ts`
- `fusion-studio-client/src/types/view-state.ts`
- `fusion-studio-client/src/types/websocket.ts`

Server generation, persistence, routing, and tests:

- `fusion-studio-server/lib/theme/panel-css.js`
- `fusion-studio-server/lib/view-state/writer.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/workspace-request-handlers.js`
- `fusion-studio-server/test/theme/panel-surfaces.test.js`
- `fusion-studio-server/test/view-state/writer.test.js`
- `fusion-studio-server/test/ws/workspace-folder-mutations.test.js`

## Excluded concurrent changes

The worktree was dirty before and during this orchestration. Captures/001 deletions, Captures/002 and Captures/022 documentation, the WebSocket/Persistence standards pages, `ViewerSearchFilters.tsx`, and other owner work were preserved and are not attributed to this SPEC. The System, Capture, and File runtime `state.json` files were already dirty and had no preflight hashes; exact byte preservation is unprovable, so they are explicitly excluded from implementation attribution. They were not restored or intentionally used as fixtures.

## Residual owner/manual checks

- Run the complete macOS VoiceOver keyboard/relationship walk for Capture and Files, including File's zero-tab absence of tab semantics and post-first-selection tablist/tabpanel semantics.
- Perform the final Electron visual pass for dark/light live sliders, compact tab fades/resizing, destination focus, and all Workspace menu corner placements.
- A final isolated Office-fixture rerun was not attempted after the fixture clone hit `ENOSPC`; the last accepted cumulative isolated menu result is 31/31 and the final integration reviewer accepted that evidence. Current disk space was deliberately preserved rather than deleting unrelated user data.
- The prior isolated runtime suite passed 2/2. Its post-correlation rerun was skipped after the same disk/fixture limitation; the changed race, reconnect, timeout, stale-response, no-root, and synchronous-send paths have deterministic focused coverage.
- A true renderer/server process-crash simulation was not run; connection-close, generation replacement, lost acknowledgement, late frame, and reconnect behavior are covered directly.

These residuals are manual/fixture-environment acceptance work, not unresolved material code findings. The implementation is ready for owner review on the current branch.
