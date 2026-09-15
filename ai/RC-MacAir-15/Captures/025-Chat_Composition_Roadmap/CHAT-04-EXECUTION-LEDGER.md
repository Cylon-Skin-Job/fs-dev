# CHAT-04 (SPEC-04) — Move Chat to Side Chat Execution Ledger

**Bundle:** `025-Chat_Composition_Roadmap` · **Candidate:** `CHAT-COMPOSITION-2d34f8b45562f8f3` (owner-approved 2026-09-13)
**SPEC:** `SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md` (overlaid packet owner-approved; SPEC-04 dispatch authorized by owner direction after SPEC-03 acceptance, 2026-09-14)
**Baseline commit (dispatch):** `5073b1056fce4872751ab60de0b030560929b823` (commit `5073b10 feat: composable chat surfaces (CHAT-02/SPEC-02)`) plus the owner-accepted, still-uncommitted SPEC-03 product bytes in the worktree
**Baseline branch:** `agent/exact-workspace-paths`
**Migration head at dispatch:** `043_thread_group_worksurface_cleanup.js` → next free migration expected `044`
**Orchestrator:** primary session acting as spec orchestrator (owner-appointed, direct run)
**Gates:** SPEC-04 §12 (`npx jest --runInBand` on `fusion-studio-server`; focused Playwright `e2e/move-chat-to-side-chat.spec.ts`, `e2e/side-chat-placement-recovery.spec.ts`, `e2e/side-chat-isolation.spec.ts` on an isolated config/port/profile; client `npm run build`; Electron smoke per §12; restart/readback; fingerprint)
**Hard constraints:** never commit/amend/push; preserve unrelated worktree bytes; consume `BRIDGE-02-CONFORMANCE-OVERLAY.md` as binding conformance; no `surfaceId` in any envelope, persisted action result, placement record, descriptor, live frame, or fan-out; `threadId` remains the routing/Provenance identity; `sideChatPlacementId` is the durable placement key (CHAT-RD-012); Move goes through the SPEC-03 service-managed placement lane, never the empty-launcher lifecycle; no edits to accepted SPEC-00/01/02/03, TABS, bridge, Provenance, or Generic Host contracts; migrations 001–043 are frozen.

## Prerequisite Record (verified at dispatch)

- **SPEC-03 (CHAT-03) owner-accepted 2026-09-14** (owner statement recorded in `RELEASE-MANIFEST.md` §7). Product digest `6b1e36ce28689121857200ddbd997a618596a37c00744c305b4896e8714b793d` (71 paths, 0 deletions; migration head `043`). At dispatch the orchestrator re-verified every product-manifest hash with `shasum -a 256 -c /tmp/chat03/final/manifest-product.txt` → **71/71 OK**, and re-hashed the manifest to the exact accepted digest `6b1e36ce…`. SPEC-03 bytes remain uncommitted; the worktree is the accepted baseline.
- **SPEC-02 (CHAT-02) owner-accepted** and committed `5073b10`; SPEC-01 owner-accepted and committed `5f46d1a`; SPEC-00 owner-accepted `7f0d3c8`; BRIDGE-01 owner-accepted `16ccecf`; BRIDGE-02 owner-approved consumed through `BRIDGE-02-CONFORMANCE-OVERLAY.md`; overlaid `025` candidate owner-approved 2026-09-13.
- **`fusion.chat-surface` generic-host resolution revalidated before Slice 04A** (SPEC-04 §2): `cd fusion-studio-client && npx playwright test e2e/chat-component-registration.spec.ts --config=playwright.chat-surface.config.ts` → **8 passed** (isolated port 3316, `/tmp` profile, `reuseExistingServer: false`), preceded by `npm run build` (passed, only the pre-existing >500 kB chunk warning).
- **Carried owner re-baseline item (02A-D7):** five source/CSS specs, `prompt-ownership.slice-c` browser case, 56/59 `working-activity` fixture cases are pre-existing baseline-red at `5f46d1a`; measured against that documented set, not treated as new regressions.
- **Carried accepted advisories (non-blocking):** SPEC-03 stale comment drifts (`captureViewerWorksurfaceAdapter.ts`, `ViewChatHost.tsx`), pre-existing `captureTabsController.ts` size carry, `playwright.chat03.config.ts` profile path naming `/tmp/chat03/03b`, 03B-D1/D2 fire-through view-switch/best-effort teardown owner-visible residuals.
- **Migration vocabulary is pre-admitted** by migration `041` CHECK constraints (01A-D12): membership `origin_kind='move-to-side-chat-primary'`, primary event `reason='move-to-side-chat'`, activity `kind='move-chat-to-side'`. No CHECK rebuild is expected; migration `044` is expected only for the durable placement outbox (and any close disposition persistence required by §7/§10).

## Pre-existing unrelated worktree bytes (preserve; never touch)

- `M ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json` (owner live view-state drift; not in the accepted SPEC-03 product manifest)
- `M ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json` (owner live view-state drift; excluded from the accepted manifest)
- `?? ai/RC-MacAir-15/Captures/031-Remote_Access/` (separate concurrent worker artifact)
- `M ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/RELEASE-MANIFEST.md` (owner acceptance record; excluded from candidate hash)
- Uncommitted SPEC-03 evidence artifacts (`SPEC-03-IMPLEMENTATION-REPORT.md`, `CHAT-03-EXECUTION-LEDGER.md`) — workflow artifacts, excluded from product fingerprints.
- Concurrent Office-chain bytes belonging to a separate `009-Office-Editor-Temp` SPEC-00 chain
  (`fusion-studio-client/e2e/office/fixture-lifecycle.mjs`, `fixture-lifecycle.test.mjs`,
  `fusion-studio-client/playwright.office.config.ts`) — verified against that SPEC's file list; not
  SPEC-04 product touches (recorded from the 04C builder-gate advisory).

## Orchestrator interpretations recorded at dispatch (binding for builders unless superseded by a validated finding)

1. **Route family.** `move_chat_to_side` and `open_member_in_side` are durable `thread:action` names registered in `DURABLE_THREAD_ACTIONS` (`lib/ws/thread-ws-handlers.js`); `thread:members` is a registered qualified read in the existing thread family (workspace from the bound connection, one validated `threadGroupId`, no new `thread-group:*` transport family). All require the accepted trusted-shell role in addition to server-derived workspace/view/group/member ownership.
2. **Identity.** `sideChatPlacementId` is an independently minted opaque durable placement key, distinct from `projectionId`, `surfaceId`, `threadId`, `threadGroupId`, `tabId`, and `componentInstanceId`. `surfaceId` never appears in an envelope, persisted action result, outbox row, placement record, descriptor, live frame, or fan-out. `threadId` remains the routing/Provenance identity.
3. **Lane.** Move commits the SQLite group transition first (membership + primary event + activity/MRU + `open-side-chat-tab` outbox row in one transaction under the accepted group mutation lease). Delivery of the placement is a separate, durable, retryable step that uses SPEC-03's narrow `state:worksurface_placement`/`mutateManagedPlacement` service lane through the trusted in-process consumer (or its registered route); a failed delivery never rolls back the committed transition. Never reconstruct placement by scanning primary history.
4. **Descriptor.** The placement descriptor follows the exact accepted Generic Host shape (SPEC-04 §6 code shape is equivalent, not literal): durable identities only (`workspaceId`, `viewId`, `threadGroupId`, `threadId`, `sideChatPlacementId`, `host:'side-tab'`), `componentTypeId:'fusion.chat-surface'`, plus `tabId`/`componentInstanceId`/`targetKey` per the accepted host. No callback, store, socket, path authority, React element, or persisted `surfaceId`. The Generic Host contract is not widened or edited.
5. **Bridge.** SPEC-04 owns one connected code-owned Side Chat bridge above the existing adapter lookup: for native adapters (Capture/File) it preserves the native tab owner, composes managed Side Chat descriptors into the visible ordered rail, delegates native actions unchanged, and renders component content only while a Side Chat is active; for adapterless chat-enabled views (Issues/Wiki/Browser/Agents) it activates only while ≥1 Side Chat exists, constructs a runtime-only root descriptor for the existing child, and appends managed Side Chats without serializing/remounting the root as a plugin. Closing the last Side Chat returns the view to children-only presentation.
6. **Representative view for 04A.** `file-viewer` (File Explorer) — the first accepted SPEC-03 adapter (03A) with native file-tab ownership — is the default 04A representative adapted view unless the builder records a validated reason to choose another. Remaining views are 04B.
7. **No singleton carry-over.** `sideChatPlacementId` is never the legacy singleton Secondary Chat identity; the new component-backed path must not inherit its routes, state, or singleton behavior. The legacy Secondary Chat stays available until 04D and is removed there only after replacement acceptance checks pass.
8. **Test isolation.** New Playwright specs run only under an isolated config (fresh port and `/tmp` profile, isolated DB); never port 3001, the dev DB `fusion-studio-server/data/fusion.db`, or the Alpha profile. Electron smokes use a throwaway `FUSION_APP_USER_DATA` profile and temp workspace.
9. **`thread:members`.** Returns ordered projections only (`threadId`, ordinal, `isPrimary`, created time, bounded display label, current placement disposition) for one validated group; never transcript content; server returns the group's authoritative nullable view. Choosing a non-primary member is the idempotent `open_member_in_side` action (04C).
10. **Link extension (04C).** Version stays `1`; exact-member URIs validate workspace/group/view/membership, reopen/focus the member's lifetime `sideChatPlacementId` without promotion or MRU; group-only URIs continue to open the current Main Chat. No `surfaceId`, no placement authority in the URI.

## Slices

| Slice | Scope | Builder | Builder gate | Orchestrator gate | State |
|---|---|---|---|---|---|
| 04A | End-to-end Move in one adapted view (menu → eligibility → trusted `thread:action` → sequence/idempotency → ThreadManager/group/MRU transaction → migration 044 outbox → managed placement → bridge → `fusion.chat-surface` → centered Side render → fan-out → restart/readback) | `ses_f5d5c2190ffeBHXZY5Heuu34v1` → repair continuation `ses_f5d1f366dffeffiQcungrhT531` | pass 1 `ses_f5d4a45b1ffengmAlCu0kpHsfu` BLOCKED (F1) → repaired; pass 2 `ses_f5d3505acffeWA3odYLCK8WjmD` CLEAN; pass 3 `ses_f5d17d22cffeCosH2bJqliYo4o` CLEAN on repaired bytes | orchestrator findings R1–R5 routed + repaired; fresh acceptance reviewer `ses_f5d14da0fffeX9SFHtQbDzXcQA` **CLEAN** (no material findings; all deviations accurate; D1–D6/D8/D9/R1–R4 accepted; D3/D7 accepted↓04C) | **accepted** (2026-09-14) |
| 04B | Adapterless and native-view coverage (native tab owners, runtime-only roots, existing children, dedupe/focus, ineligible precommit rejection) | `ses_f5d10b23bffeMeTAqeZVSS4YIY` | pass 1 `ses_f5d0095aeffeMEK9KJY6soD8Sy` CLEAN | fresh acceptance reviewer `ses_f5cfadb85fferltO0JyBmZCT8v` **CLEAN** (no material findings; all 04B/04A deviations accurate; dockless cold-start carried to 04C; reachability adjudicated satisfied with 04C/04D obligation) | **accepted** (2026-09-14) |
| 04C | Close, restart, access, repetition (`thread:members`, `open_member_in_side`, close disposition/no resurrection, repeated Move, full checks + Electron smoke + `side-chat-placement-recovery`/`side-chat-isolation` specs) | `ses_f5cf47e8affe5TRkqtH7ntEhLt` (stalled) → fresh continuation `ses_f5c909441ffebZlu9CL8wicvwP` | pass 1 `ses_f5c752547ffexePPKCFh0A8Dyu` CLEAN | fresh acceptance reviewer `ses_f5c6cb9b3ffeycKAQoJCq1gcr6` **CLEAN** (no material findings; all 04C deviations accurate; D5/D6 accepted advisories → 04D) | **accepted** (2026-09-14) |
| 04D | Retire singleton Secondary Chat, `service.js` split (04A-D9), dead-code sweeps, full regressions, Wiki sync, final report | `ses_f5c5fe1d0ffez0C3BkLPRjZFuX` | pass 1 `ses_f5c49cbc2ffeX1cnfdgPkXdNk0` CLEAN | acceptance `ses_f5c3cf73fffeCsoMiIhQ4pBu6r` **CLEAN** (M1/M2 record repair applied); final integration `ses_f5c32bbf9ffePX9ZH91feEITo9` **CLEAN** | **accepted** (2026-09-14); whole-SPEC integration CLEAN |

## Deviations

### Slice 04A

Builder-owned gate: pass 1 `BLOCKED` (F1, material, repaired); pass 2 `CLEAN`; pass 3
(fresh reviewer on the R1–R4-repaired bytes) `CLEAN`. Proposed classifications below;
the orchestrator classifies authoritatively.

- **04A-D1 — Migration head 043 → 044; five migration oracles updated.** *Clause:* SPEC-04 §11
  "Add the next free migration"; recorded interpretation 5 "Update the migration oracle tests".
  *Actual:* `044_thread_group_placement_outbox.js` is the new head; the four head assertions in
  `test/event-registry/migration.test.js`, `test/fusion/system-wiki-view-path-migration.test.js`,
  `test/thread/thread-group-migration.test.js`, `test/views/view-relocation-journal.test.js` now
  assert 044; the 043 cleanup-migration down test rolls back 044 first. *Files:* as listed.
  *Tests:* `test/thread/thread-group-placement-outbox-migration.test.js` (new) + those five;
  full server suite green. *Effect:* schema-only, create-only, no backfill. *Risk:* low.
  *Downstream:* later SPECs use 045+. **Proposed: accepted.**
- **04A-D2 — Placement descriptor input omits `sideChatPlacementId`.** *Clause:* SPEC-04 §6 input
  list vs "the exact generic descriptor shape follows the accepted host" and BRIDGE-02 §4.3.
  *Actual:* the accepted `parseChatSurfaceDescriptorInput` allows exactly the five durable keys
  (`workspaceId`, `viewId`, `threadGroupId`, `threadId`, `host`); `sideChatPlacementId` rides as
  the placement-lane key (`placementId`) and the derived stable `componentInstanceId`
  (`chat-side:{placementId}`) and `targetKey`. *Files:* `placement-delivery.js`, `ids.js`.
  *Tests:* move integration test asserts the exact persisted descriptor shape and no `surfaceId`.
  *Effect:* no Generic Host widening. *Risk:* none. *Downstream:* 04C reopen/close reuse the same
  lane key. **Proposed: accepted.**
- **04A-D3 — Side Chat tab is `closable: false` in 04A.** *Clause:* SPEC-04 §7 close disposition is
  whole-SPEC; §11 assigns close/restart/repetition to 04C. *Actual:* `sideChatBridge.ts`. *Tests:*
  move e2e. *Effect:* the placement is never removed in 04A. *Risk:* none. *Downstream:* 04C adds
  the tombstone/closed disposition. **Proposed: accepted / downstream_impact (04C).**
- **04A-D4 — Side-only rail model when the view has no native connected collection.** *Clause:*
  SPEC-04 §6 "composes managed Side Chat descriptors into the visible ordered rail". *Actual:*
  `composeSideChatAdapter` returns a side-only `ViewTabAdapterModel` when the base adapter is null
  but open placements exist; with no placement the base adapter is returned byte-identical.
  *Tests:* move e2e (rail renders the Side Chat without a native tab). *Effect:* the placement rail
  is real independent of adapter content. *Risk:* low. *Downstream:* 04B extends to adapterless
  views. **Proposed: accepted.**
- **04A-D5 — `ChatSurfaceComponentMount` tuple validation accepts a non-primary member.** *Clause:*
  SPEC-04 §6 "chat registration validates that `A` remains a member of `G` bound to the exact view".
  *Actual:* for `host:'side-tab'` the mount accepts `input.threadId` when the exact view's
  server-persisted open placement names that member; the primary-row match still wins. *Tests:*
  move e2e mounts `A`; server integration proves the placement is server-authoritative.
  *Effect:* Side Chat for `A` renders without a client member-list scan. *Risk:* low (placement lane
  is trusted-service-owned). *Downstream:* 04C `thread:members` may add a direct member check.
  **Proposed: accepted.**
- **04A-D6 — Test-only harness extension.** *Clause:* SPEC-04 §12; GUIDANCE §6 isolation.
  *Actual:* `e2e/worksurface-harness.ts` gains a real `ViewTabBar` rail mount, a ready File tab
  policy, placement seeding/population controls, and an idempotent `openDock`. No product bytes.
  *Tests:* move e2e + the four chat03 specs re-verified green. *Risk:* none. **Proposed: accepted.**
- **04A-D7 — No Electron smoke created for 04A.** *Clause:* SPEC-04 §12 whole-SPEC Electron smoke;
  §11 assigns full shell checks to 04C. *Actual:* not created. *Effect:* 04A relies on the focused
  server + Playwright gates. *Risk:* shell-level composition unproven until 04C. **Proposed:
  accepted (deferred) / downstream_impact (04C must run the full smoke, including the 04A move;
  reviewer advisory: `e2e/side-chat-placement-recovery.spec.ts` and `e2e/side-chat-isolation.spec.ts`
  required by SPEC-04 §12 do not exist yet and must arrive under 04C/04D so the whole-SPEC §12
  command set is eventually satisfied verbatim).**
- **04A-D8 — Outer-rail dock open state is store-mirrored for the session.** *Clause:* SPEC-04 §3
  "Its list button operates the outer owning view's ThreadRail"; F1 repair. *Actual:*
  `worksurfaceDockOpenByView` keyed `{workspaceId, viewId}`; `ViewWorksurfaceDock` reads/writes it
  instead of local `useState`; a `side-tab` host's list button toggles it; test-only `openDock` is
  now idempotent. The state is transient RAM, never persisted (CHAT-RD-010). *Tests:* move e2e
  asserts both directions; chat03 lane (46) re-run green. *Effect:* the outer rail control is
  reachable from the Side Chat. *Risk:* low (in-session dock memory). *Downstream:* 04B/04C reuse
  the same outer-rail control. **Proposed: accepted (repair resolves F1).**
- **04A-R1 — placement-lane fan-out repair (orchestrator finding).** *Clause:* SPEC-04 §7 "a failed
  delivery remains observable and retryable and never undoes the group transition"; restart/outbox
  reconcile. *Actual:* `worksurfaceFrames.handleWorksurfaceChangedFrame` previously returned early
  when `frame.contentRevision === binding.contentRevision`, so a placement-only change (same content
  revision, bumped placement revision — exactly a retried delivery / restart sweep) never triggered
  the exact re-read for a clean bound group. It now issues the same `sendGetRequest` when either the
  content OR placement revision changed, keeping every guard (bound group only, not dirty, no
  in-flight read). *Files:* `src/lib/worksurface/worksurfaceFrames.ts`; test-only harness controls
  `seedServerPlacementEx`/`broadcastPlacement`. *Tests:* new move e2e "a placement-only broadcast
  after a failed delivery materializes the Side Chat without another trigger" (same content
  revision, bumped placement revision). *Effect:* a retried/restart delivery materializes the Side
  Chat tab on a clean window. *Risk:* low. *Downstream:* 04C close/repair reuses the same re-read.
  **Proposed: accepted (repair resolves R1).**
- **04A-R2 — Move eligibility unresolved Stop boundary (orchestrator finding).** *Clause:* SPEC-04 §4
  "no active or accepting turn and no unresolved Stop boundary". *Actual:* `canMoveToSideChat` now
  also requires `!isTurnFinalizing` (the `pendingTurnEnd`/`pendingExchangeSaveTurnId` projection) in
  addition to `!isTurnActive`/`!isAcceptancePending`/no pending selection. *Files:*
  `src/components/chat/useLegacyChatHost.ts`; harness control `setThreadFinalizing`. *Tests:* move
  e2e "Move is unavailable while the session has an unresolved finalizing Stop boundary" (menu item
  disabled). *Effect:* the menu cannot offer Move during a Stop/finalize boundary. *Risk:* none.
  *Downstream:* server remains authoritative. **Proposed: accepted (repair resolves R2).**
- **04A-R3 — Move toast truthfulness (orchestrator finding).** *Clause:* SPEC-04 §3/§7 user-visible
  contract. *Actual:* (a) the `group_busy` error copy is action-aware ("Stop it before moving." for
  `move_chat_to_side`); (b) the non-fanOut completion toast says "Moved. The Side Chat tab is pending
  retry." unless `placementStatus === 'applied'`, instead of claiming the tab opened; fanOut frames
  stay silent. *Files:* `src/lib/ws/thread-handlers.ts`. *Tests:* covered by the R1 e2e
  (`placementStatus:'failed'`) plus the existing applied-path e2e. *Effect:* no false success claim.
  *Risk:* none. **Proposed: accepted (repair resolves R3).**
- **04A-R4 — session-row view binding restored to accepted bytes (orchestrator finding).** *Clause:*
  accepted SPEC-03 `ThreadManager._insertSessionRow` (`view_id: null`); §13 "not redesigned". *Actual:*
  `_insertSessionRow` is restored to hardcoded `view_id: null` and `stageNewSession` no longer accepts
  or forwards a `viewId`; the group projection and `thread:action:completed.viewId` carry the view.
  *Files:* `lib/thread/ThreadManager.js`, `lib/thread-groups/service.js`. *Tests:* focused move
  integration suite + full server suite green; no 04A behavior/test depends on a session-row view
  binding. *Effect:* accepted SPEC-03 create bytes are byte-identical again. *Risk:* none.
  *Downstream:* none. **Proposed: accepted (repair resolves R4).**
- **04A-D9 — `lib/thread-groups/service.js` file-size carry.** *Clause:* routed Code Standards "no
  file over 400 lines".   *Actual:* `moveChatToSide` + `_resolveMoveSessionPolicy` added ~279 lines to
  an already 787-line accepted file (now 1066 lines). *Reason:* keeping the Move transaction in the
  existing group-mutation service preserved the accepted lease/replay/context helpers without a
  parallel service. *Tests:* all suites green. *Effect:* none on behavior. *Risk:* maintainability.
  *Downstream:* **04D split plan** — extract `moveChatToSide` and `_resolveMoveSessionPolicy` into
  `lib/thread-groups/move-service.js` (or `move.js`) as a focused module, with `ThreadGroupService`
  delegating from its stable `performAction` facade; no public export/import path changes. Recorded
  as a carried advisory until then. **Proposed: accepted (carried advisory, mechanical split in 04D).**

### Slice 04B

Builder-owned gate: pass history recorded under Lifecycle. Proposed classifications
below; the orchestrator classifies authoritatively.

- **04B-D1 — Centralized Side Chat composition seam (04A File composition moved up to `useViewTabAdapter`).**
  *Clause:* SPEC-04 §6 "one connected code-owned Side Chat bridge above the existing adapter
  lookup"; §11 04B extension; §13 "view/tab placement adapter". *Actual:* the 04A composition
  block was removed from `useFileConnectedAdapter` (it now returns its protected native model
  unchanged) and the single composition lives in the new
  `src/components/chat/useSideChatRailAdapter.ts`, called from `useViewTabAdapter`; native-adapted
  views (`file-viewer`, `capture-viewer`) keep their adapter as the native-tab owner and compose
  managed Side Chats into the same rail, while adapterless chat-capable views get a runtime-only
  root. *Reason:* 04B adds Capture (connected + legacy policy paths) and six adapterless hosts;
  duplicating the composition per adapter would diverge. *Files:* `fileConnectedAdapter.ts`,
  `viewTabAdapters.ts`, `useSideChatRailAdapter.ts`, `sideChatBridge.ts`. *Tests:* 04A move e2e 5
  passed unchanged; new 04B e2e 6; chat03 lane 46. *Effect:* behavior-equivalent single seam;
  File rail byte-identical with no placement. *Risk:* low. *Downstream:* 04C close/disposition
  lands in one place. **Proposed: accepted.**
- **04B-D2 — `ChatSurfaceComponentMount` side-tab tuple validation no longer requires a view population row.**
  *Clause:* SPEC-04 §6 "chat registration validates that `A` remains a member of `G` bound to the
  exact view"; §11 04B adapterless hosts; carried 04A-D5. *Actual:* for `host:'side-tab'` the mount
  accepts the descriptor when the exact view's server-persisted open placement names the member
  even when `getThreadGroupPopulation` has no matching row (adapterless hosts issue no
  `thread:list`). The primary-row match still wins; a non-side host still requires the row.
  *Files:* `ChatSurfaceComponentMount.tsx`. *Tests:* new 04B issues/office/email e2e; chat-surface
  lane 49 green. *Effect:* adapterless Side Chat mounts from the durable server-owned placement
  lane. *Risk:* low (view-bound placement lane is the authority). **Proposed: accepted.**
- **04B-D3 — Test-only harness extensions.** *Clause:* SPEC-04 §12; GUIDANCE §6 isolation.
  *Actual:* `e2e/worksurface-harness.ts` gains per-view rail mounting
  (`mountRailFor`/`unmountRailFor`), generic placement seeding
  (`seedPlacementEntry`/`seedSidePlacementIn`/`seedServerPlacementIn`), an optional dock-less
  mount, per-view native child wrappers, and extra seeded threads; the accepted
  `#file-view-tab-rail` wrapper id is preserved for 04A. No product bytes. *Tests:* 04A move e2e 5
  + new 04B e2e 6. *Risk:* none. **Proposed: accepted.**
- **04B-D4 — Capture legacy policy-gated path composed but not covered by a dedicated e2e.**
  *Clause:* §11 04B "Capture/File/native adapters". *Actual:* the centralized seam composes
  whatever `useCaptureAdapter` (legacy, policy-gated) returns exactly as the connected path; the
  new e2e exercises the connected path. *Effect:* legacy capture composition is structurally
  identical (same hook, same `composeSideChatAdapter`); no renderer case for the legacy variant.
  *Risk:* low. *Downstream:* 04C/04D can add a case. **Proposed: accepted (advisory).**
- **04B-D5 — Issues/Agents/Browser have no production Main Chat entry point.** *Clause:* §6/§11;
  mission interpretation 4. *Actual:* these views mount no `ViewWorksurfaceDock`, so the bridge
  proves presentation from a seeded server-persisted placement but there is no in-view Move menu;
  no unrequested chrome added. *Effect:* placement presentation proven; Move entry point awaits a
  production host. *Risk:* none. **Proposed: accepted (recorded reachability note).**
- **04B-D6 — No new migration.** *Clause:* §11 "Add the next free migration when needed"; hard
  constraint. *Actual:* migration head remains `044_thread_group_placement_outbox.js`; placement
  delivery is view-agnostic through the accepted SPEC-03 lane. *Risk:* none.
  **Proposed: accepted.**

### Slice 04C

Builder-owned gate: see Lifecycle. Proposed classifications below; the orchestrator
classifies authoritatively.

- **04C-D1 — Close disposition lands on the SPEC-03 managed-placement lane.** *Clause:* SPEC-04
  §7/§9 and §11 04C (resolves carried 04A-D3). *Actual:* the client sends one canonical
  `state:worksurface_placement` `operation:'close'` with the stable `sideChatPlacementId` and the
  expected placement revision (`sendPlacementCloseRequest`/`closeSideChatPlacement`; new
  `TrackedRequest.kind:'placement'`); `failRequest` treats a placement failure as a classified
  non-destructive warning with no fabricated content capture; `sideChatBridge` marks the Side tab
  `closable:true` and wires `onClosePlacement`; `useSideChatRailAdapter` closes with the entry's
  placement revision. The tab is removed only after the acknowledged `closed` disposition reaches
  the store. *Files:* `worksurfaceRequests.ts`, `worksurfaceFailures.ts`, `worksurfaceRuntime.ts`,
  `worksurfaceFrames.ts`, `worksurfaceController.ts`, `sideChatBridge.ts`,
  `useSideChatRailAdapter.ts`. *Tests:* `side-chat-placement-recovery.spec.ts` (5), member-access
  integration close/repeat-close/no-reopen, Electron smoke `CLOSE_DISPOSITION`. *Effect:* close
  removes the placement only; member session/transcript/Provenance/membership untouched; CAS
  conflict is non-destructive. *Risk:* low. *Downstream:* 04D removes the legacy Secondary Chat.
  **Proposed: accepted.**
- **04C-D2 — Ordinary delivery no longer re-upserts a non-open disposition.** *Clause:* SPEC-04 §7
  "a closed disposition prevents restart/outbox replay from reopening the tab"; mission required
  behavior 1. *Actual:* `consumePlacementOutbox` early-acknowledges (`applied`) when the persisted
  record is `closed`, instead of upserting; the explicit `materializeMemberPlacement` coordinator
  is the only reopen path. *Files:* `lib/thread-groups/placement-delivery.js`. *Tests:*
  member-access integration "ordinary outbox replay never reopens a closed placement"; recovery e2e
  "placement-only broadcast for a closed placement never reopens the tab". *Effect:* restart/outbox
  replay cannot resurrect an intentionally closed Side Chat. *Risk:* none. **Proposed: accepted.**
- **04C-D3 — `thread:members` registered qualified read (new `thread:` message type).** *Clause:*
  SPEC-04 §8; dispatch interpretations 1 and 9. *Actual:* handler + `ThreadGroupService.listGroupMembers`
  return ordered projections (`threadId`, ordinal, `isPrimary`, created time, bounded label,
  placement disposition) for one validated `threadGroupId`; workspace from the bound connection; the
  server returns the group's authoritative nullable `viewId`; no transcript content; unknown/foreign
  groups fail inertly (`thread:members:error`); Legacy (null view) returns members with `absent`.
  No `requestId` correlation (the read is idempotent and group-keyed). No `thread-group:*` transport
  family. *Files:* `lib/ws/thread-ws-handlers.js`, `lib/thread-groups/service.js`,
  `src/lib/ws/thread-handlers.ts`, `src/state/slices/worksurfaceSlice.ts`, `src/state/panelStoreTypes.ts`,
  `src/types/websocket.ts`. *Tests:* member-access integration (ordered projections, unknown group,
  Legacy nullable view + absent dispositions). *Effect:* exact member hydration for the rail menu.
  *Risk:* low. **Proposed: accepted.**
- **04C-D4 — `open_member_in_side` durable action and member placement coordinator.** *Clause:*
  SPEC-04 §8; interpretation 1. *Actual:* registered in `DURABLE_THREAD_ACTIONS` with an exact key
  set (group/member + fail-open `context`; redundant workspace/view authority schema-rejected);
  `openMemberInSide` validates non-primary membership, a non-null authoritative view, and the
  chat-capable view set, then `materializeMemberPlacement` reopens (if closed) or focuses (if open)
  the member's existing lifetime `sideChatPlacementId` with a bounded CAS retry; creates no session,
  primary event, MRU activity, or transcript effect; `requestId` replay returns the recorded result.
  *Files:* `lib/ws/thread-ws-handlers.js`, `lib/thread-groups/service.js`,
  `lib/thread-groups/placement-delivery.js`, `src/components/chat/threadGroupRows.ts`,
  `src/components/chat/useViewChatHost.ts`, `src/lib/ws/thread-handlers.ts`. *Tests:* member-access
  integration reopen/focus/replay/non-member/non-primary/invalid-request/view_not_supported and the
  requester+fan-out convergence case. *Effect:* explicit non-primary access without promotion/MRU.
  *Risk:* low. **Proposed: accepted.**
- **04C-D5 — Member `copy_link`/`resolve_link` are server-owned; the production renderer has no
  per-member link entry point and never sends `resolve_link`.** *Clause:* SPEC-04 §8 (`CHAT-I-029`);
  mission requirement 4 "record any client entry-point boundary (01C-D5 had none)". *Actual:* the
  server `copyLink` now accepts a validated non-primary member `threadId` (group-only stays the
  current primary) and `resolveLink` validates workspace/group/view/membership and reopens/focuses
  the member's lifetime placement without promotion/MRU; group-only still opens Main Chat and is
  Legacy-safe. The renderer member menu exposes open only; the row Copy Link stays group/current-primary;
  the renderer has no URI-resolve sender (pre-existing, unchanged since 01C). *Files:*
  `lib/thread-groups/service.js`, `lib/ws/thread-ws-handlers.js`. *Tests:* member-access integration
  copy_link member/group-only and resolve_link member/group-only. *Effect:* exact-member link
  production/resolution is a tested server contract but is not reachable from production UI.
  *Risk:* low. *Downstream:* 04D may add a member Copy Link entry or record an owner ruling.
  **Proposed: accepted (recorded boundary / advisory).**
- **04C-D6 — Member list is a new nested section inside the existing shared ThreadRail kebab, not the
  portal `src/components/menu/` module.** *Clause:* routed Frontend UI "New or migrated … nested
  action menus use the shared menu module"; mission requirement 4 "via the shared menu module".
  *Actual:* the member group renders inside the pre-existing `.rv-thread-menu-dropdown` using
  `.rv-dropdown-item`, sharing the parent menu's outside-click and mouse-leave behaviour; no new
  outside-click, focus-restoration, submenu-positioning, pending-action, or keyboard behaviour is
  recreated. The parent ThreadRail kebab predates SPEC-04 (last committed at SPEC-02) and is asserted
  by the accepted `threaded-chat-host.spec.ts`; migrating the whole kebab to the portal module is a
  broader migration outside SPEC-04's expected changed areas and would rewrite an accepted lane.
  *Reason:* smallest correct change; this kebab is the shared thread menu both hosts use and is the
  routed Chat Menus wiki's referenced chrome. *Files:* `ThreadRail.tsx`. *Tests:* chat-surface 49
  (portable boundary + render), chat03 46, Electron smoke member menu. *Effect:* new entries inherit
  the existing menu behaviour; the nested group has no portal submenu/focus restoration.
  *Risk:* low-advisory (a11y parity). *Downstream:* 04D or a menu-migration slice could adopt the
  portal module. **Proposed: accepted (advisory); orchestrator may instead require a repair.**
- **04C-D7 — Transient renderer state for members and Side-Chat focus.** *Clause:* routed State
  Management ("client stores own render state"; hydration handled by a WebSocket message handler).
  *Actual:* `threadMembersByGroup` is hydrated only by the `thread:members` handler and
  `sideChatActivePlacementByView` is transient focus keyed `{workspaceId, viewId}`; neither is
  persisted and the durable placement remains server-owned. *Files:* `worksurfaceSlice.ts`,
  `panelStoreTypes.ts`. *Tests:* isolation + recovery e2e. *Effect:* no second durable owner.
  *Risk:* none. **Proposed: accepted.**
- **04C-D8 — Test-only harness extensions.** *Clause:* SPEC-04 §12; GUIDANCE isolation; carried
  04A-D6/04B-D3. *Actual:* `worksurface-harness.ts` gains a `setPanelConfigs` seed,
  `reconcileSideChats` (unbound sweep trigger), an Issues projection + `thread:list` branch, and the
  `reconcileSideChatPlacementsOnReconnect` import (plus 04A/04B controls). No product bytes.
  *Files:* `e2e/worksurface-harness.ts`, `e2e/side-chat-adapterless-native.spec.ts`. *Tests:* all
  Playwright lanes. *Risk:* none. **Proposed: accepted.**
- **04C-D9 — Portable member-projection type extracted (regression repair).** *Clause:* routed
  Frontend UI/State Management portability; accepted `threaded-chat-host.spec.ts` "ThreadRail is a
  portable population/menu boundary with no store or socket access". *Actual:* the 04C partial
  imported `ThreadMemberProjection` from `state/slices/worksurfaceSlice`, breaking the accepted
  portability sweep (chat-surface lane 48 passed / 1 failed). Repair: the contract now lives in the
  portable `src/types/threadGroupMember.ts` and is re-exported from the slice; `ThreadRail` imports
  the portable module. *Files:* `src/types/threadGroupMember.ts` (new), `worksurfaceSlice.ts`,
  `ThreadRail.tsx`. *Tests:* chat-surface lane 49 green. *Effect:* portable boundary restored.
  *Risk:* none. **Proposed: accepted (repair).**
- **04C-D10 — Dockless/unbound restart placement trigger (carried 04B binding note 1).** *Clause:*
  SPEC-04 §7 "restart/readback"; carried 04B acceptance note. *Actual:* `reconcileSideChatPlacementsOnReconnect`
  sweeps unbound chat-capable `panelConfigs` with a bounded qualified `thread:list`; the response
  handler then issues the exact per-group `state:worksurface_get` so a persisted open placement
  materializes with no action frame. No Generic Host widening, no new transport family, no
  primary-history scan. *Files:* `worksurfaceFrames.ts`, `workspace-handlers.ts`,
  `thread-handlers.ts`. *Tests:* adapterless e2e "dockless restart/readback materializes an unbound
  open placement without an action frame"; Electron smoke `RELAUNCH_READBACK`. *Effect:* relaunch
  readback for adapterless hosts is proven. *Risk:* low. **Proposed: accepted.**
- **04C-D11 — Electron smoke scope.** *Clause:* SPEC-04 §12. *Actual:* the smoke moves the current
  Main Chat, asserts the replacement Main host addresses the new empty session and shows only the
  empty conversation state, closes/reopens (same lifetime placement id), relaunches and reads back,
  repeats Move (4 peers / 1 row / ordered ordinals), and toggles the outer rail from a Side Chat;
  exact markers include `CHAT_04C_SMOKE_EMPTY_REPLACEMENT=true`. It does not inject a real harness
  model turn (no guaranteed model in a throwaway profile/workspace); frame-level Send/stream/Stop
  isolation is proven by `side-chat-isolation.spec.ts` plus the accepted `chat-surface-isolation`
  spec. The old Secondary Chat absence assertion is 04D scope (recorded split). Production shell
  renders one ViewTabBar content at a time, so "concurrent" is proven at the frame/store level and
  by independent real-shell addressability rather than two simultaneously visible panels. *Files:*
  `e2e/side-chat-electron-smoke.mjs`. *Tests:* smoke markers above. *Risk:* low. **Proposed:
  accepted (advisory scope note).**
- **04C-D12 — No new migration.** *Clause:* §11; hard constraint "prefer no new migration (head stays
  044)". *Actual:* the closed disposition reuses the existing SPEC-03 managed-placement lane
  (`disposition:'closed'`); migration head stays `044_thread_group_placement_outbox.js`; migrations
  001–043 frozen. *Risk:* none. **Proposed: accepted.**
- **04C-D13 — `lib/thread-groups/service.js` file-size carry grows.** *Clause:* routed Code
  Standards "no file over 400 lines"; carried 04A-D9. *Actual:* `listGroupMembers`/`openMemberInSide`
  add ~180 lines to the already 1066-line accepted file (~1300 now); kept in the existing
  group-mutation/service owner to reuse the accepted replay/lease/context helpers. *Reason:* avoid a
  parallel service; the 04D split is already committed for the Move methods. *Tests:* full server
  suite. *Effect:* none on behaviour. *Risk:* maintainability. *Downstream:* **04D split extends to
  the 04C member methods.** **Proposed: accepted (carried advisory).**

### Slice 04D

Builder-owned gate: see Lifecycle. Proposed classifications below; the orchestrator
classifies authoritatively.

- **04D-D1 — Legacy Secondary Chat retired with no compatibility alias.** *Clause:* SPEC-04 §10
  "remove its routes, state, rendering, shortcuts, and dead styles". *Actual:* deleted
  `SecondaryChat.tsx`, `SecondaryHeader.tsx`, `SecondaryDockButton.tsx`,
  `state/slices/secondarySlice.ts`, `lib/secondary-tracker.ts`, and the orphaned
  `components/chat/useChatArea.ts`; removed the `ChatArea` secondary override, the `App`
  sticky/popup/dock render, the Secondary menu entry, `RightSecondaryResize`, the `rv-secondary-*`
  styles, the `rightSecondary`/`popup`/`secondaryThreadId` client view-state fields and server
  resolver defaults, and the dead `secondaryThreadId`/`openSecondary`/`reorderWithSecondary` wiring.
  *Tests:* build; all lanes; Electron smoke `CHAT_04D_SECONDARY_ABSENT=true`. *Effect:* exactly one
  Side Chat authority. *Risk:* none. **Proposed: accepted.**
- **04D-D2 — Workspace-global mirror inventory: `contextUsage`/`tokenUsage`/`wireReady`/`connectingHarnessId` retained.** *Clause:* mission inventory "mirrors whose only remaining consumers are Secondary". *Actual:* every remaining consumer is the production Legacy Main Chat (`useLegacyChatHost.ts`) or the WS writers; the retired Secondary was not their sole consumer. Kept rather than removed. **Proposed: accepted (recorded boundary).**
- **04D-D3 — Inert panel-global `composerModelConfig[currentPanel]` fallback deleted (02A-D3 downstream).** *Clause:* carried 04C note; SPEC §10 dead-state removal. *Actual:* `chatSlice.sendMessage` reads only `options?.harnessConfig`; `composerModelConfig`/`setComposerModelConfig`/`ComposerModelSelection` (zero writers/readers) removed. *Effect:* behavior-identical. **Proposed: accepted.**
- **04D-D4 — `lib/thread-groups/service.js` split (04A-D9 + 04C-D13).** *Clause:* routed Code Standards 400-line checklist; carried split plan. *Actual:* `moveChatToSide`/`_resolveMoveSessionPolicy` → `lib/thread-groups/move-service.js`; `listGroupMembers`/`openMemberInSide`/`boundedMemberLabel` → `lib/thread-groups/member-service.js`; both take the owning service instance as first arg; `service.js` keeps thin delegating methods, unchanged `performAction` facade, and unchanged exports. *Tests:* focused move 14 + member access 12; full server 209/3038/1; all lanes. *Effect:* behavior-identical. *Risk:* none. *Downstream:* `service.js` ~857 lines remains over the checklist; concrete future split plan recorded (link/selection/delete modules). **Proposed: accepted (partial split; residual carry).**
- **04D-D5 — Per-member Copy Link renderer entry added (resolves 04C-D5).** *Clause:* SPEC-04 §8. *Actual:* `ThreadRail` member entries gain a trailing Copy Link control emitting the canonical exact-member `copy_link` through `useViewChatHost.handleCopyLinkMember`. *Tests:* build; chat-surface/chat03 lanes; Electron smoke member menu. **Proposed: accepted.**
- **04D-D6 — Portal `src/components/menu/` adoption carried (04C-D6).** *Clause:* routed Frontend UI nested-menu rule. *Reason:* the ThreadRail kebab predates SPEC-04 and is asserted by the accepted `threaded-chat-host.spec.ts` lane; migrating the whole kebab is a broader menu-migration task. *Effect:* advisory a11y-parity only. *Risk:* low-advisory. **Proposed: accepted (advisory carry).**
- **04D-D7 — Visible Move menu label aligned to SPEC §3.** *Actual:* `ChatAreaHeader` now says "Move Chat to Side Chat"; focused specs + smoke selectors updated. **Proposed: accepted.**
- **04D-D8 — SPEC-03 stale comment drifts swept.** *Actual:* corrected `captureViewerWorksurfaceAdapter.ts` (connected records lane IS elected) and `ViewChatHost.tsx` (IS in production chrome); swept stale Secondary comments in `panelStore`, `harness`, `MessageList`, `stream-handlers`, `chatScreenshotCapture`, `ChatArea`, `FileExplorer`. *Effect:* comment-only. **Proposed: accepted.**
- **04D-D9 — `isSecondary` retired from the `ChatSurface` contract.** *Actual:* removed the hard-coded-`false` field and its conditional header branch; header always renders. *Tests:* chat-surface lane 49; build. **Proposed: accepted.**
- **04D-D10 — Screenshot owner surface narrowed to `'primary'`.** *Actual:* `ScreenshotAttachmentOwner.surface` is `'primary'`; `isCurrentOwner` checks workspace + current Main thread. *Effect:* behavior-identical. **Proposed: accepted.**
- **04D-D11 — Test-only updates.** *Actual:* removed the Secondary minimize/restore case (`chat-diagnostic-actions.slice-c.spec.ts`); dropped the removed `.rv-secondary-header-identity` CSS assertion (`theme-picker-header.spec.ts`); dropped `rightSecondary` from `file-connected-adoption-ui.spec.ts` fixtures. No surviving-feature assertion weakened. **Proposed: accepted.**
- **04D-D12 — Electron smoke Secondary-absence assertion added.** *Clause:* SPEC-04 §12; 04C-D11 split. *Actual:* hard-asserts zero legacy Secondary DOM and zero "Open a side chat" entry; prints `CHAT_04D_SECONDARY_ABSENT=true`; the 04C-D11 model-turn limitation still holds. **Proposed: accepted (advisory scope note).**
- **04D-D13 — No new migration; test isolation.** *Actual:* migration head stays `044_thread_group_placement_outbox.js`; 001–043 frozen; isolated ports/profiles/throwaway Electron profile. **Proposed: accepted.**

## Lifecycle Log

- 2026-09-14 — Preflight complete: owner dispatch of CHAT-04 verified against `RELEASE-MANIFEST.md` §7 (SPEC-03 owner-accepted; SPEC-04 unblocked and authorized by owner direction). Prerequisites in ancestry (`5073b10`, `5f46d1a`, `1ded59c`, `16ccecf`); branch `agent/exact-workspace-paths`; migration head `043`; worktree dirty paths enumerated and preserved; accepted SPEC-03 product digest re-verified 71/71; `fusion.chat-surface` generic-host registration revalidation green (8 passed) on an isolated config after a clean client build. Packet, routed standards, Chat/View wiki, and predecessor reports/ledgers read. Ledger opened. Slice 04A builder to be dispatched.
- 2026-09-14 — **Slice 04A implemented by a fresh `spec-slice-builder`.** Migration head `044`; product manifest 34 paths, 0 deletions, manifest digest `d287a8b1743176d8820128f77590622db9da27807be4e28b4bcf71bb8ace0224`. Server: `move_chat_to_side` durable action, atomic group transition under the group mutation lease, ThreadManager `stageNewSession`/`ensureSessionMirror`, migration 044 placement outbox, trusted in-process placement-delivery consumer, restart sweep. Client: visible Main Chat menu Move action, population patch + placement-lane read on completion, code-owned Side Chat bridge in the File connected rail, `fusion.chat-surface` mount tuple validation, outer-rail list-button control. Builder-owned gate pass 1 (`ses_f5d4a45b1ffengmAlCu0kpHsfu`) returned `BLOCKED` with one material finding F1 (Side Chat list button did not operate the outer rail); repaired by D8 and re-reviewed. Builder-owned gate pass 2 (`ses_f5d3505acffeWA3odYLCK8WjmD`, fresh, GLM 5.3 Flash) returned **CLEAN** on current bytes; all 34 manifest hashes verified; no material findings. Checks: server full suite 208 suites / 3020 passed / 1 skipped; focused move integration 11; migration/outbox oracles 8; client build passed; move e2e 3; chat-surface lane 49; chat03 lane 46; thread-group lane 7; source lane 65; component-tab + action-context 142. Deviations D1–D8 recorded above. No commit/amend/push performed. Status `READY_FOR_ORCHESTRATOR_REVIEW`.
- 2026-09-14 — **Orchestrator inspection findings R1–R5 repaired by the same 04A builder.** R1: placement-only `state:worksurface_changed` now triggers the exact lane re-read on a clean bound group. R2: `canMoveToSideChat` now also requires no finalizing/Stop boundary. R3: action-aware `group_busy` copy and truthful placement toast. R4: `_insertSessionRow` restored to accepted `view_id: null`; `stageNewSession` no longer forwards a view binding. R5: records 04A-R1..R4 and the `service.js` size carry (04A-D9) added above. Checks rerun green: focused move integration 11; full server suite 208/3020; client build; move e2e 5; chat03 lane 46; chat-surface lane 49; thread-group 7; source 65; component-tab + action-context 142. Builder-owned gate pass 3 to be run on the repaired bytes.
- 2026-09-14 — **04A re-handoff continued on the repaired bytes.** Independent current-byte verification confirmed R1–R4 present and correct in source: `worksurfaceFrames.ts` triggers the exact placement-lane re-read on a non-dirty bound group; `useLegacyChatHost.ts` `canMoveToSideChat` requires `!isTurnFinalizing`; `thread-handlers.ts` uses action-aware `group_busy` copy and a truthful non-fanOut placement toast; `ThreadManager.js` `_insertSessionRow` is restored to accepted `view_id: null` with no `viewId` pass-through in `stageNewSession`. Cumulative checks rerun green: focused move integration 11; full server suite 208 suites / 3020 passed / 1 skipped; client build passed (pre-existing >500 kB chunk warning only); move e2e 5; chat03 worksurface lane 46; chat-surface lane 49; thread-group lane 7; source lane 65; component-tab + action-context 142. Product manifest recomputed on repaired bytes: `/private/tmp/chat04a/manifest-product.txt`, 34 paths, 0 deletions, SHA-256 `61295e24740dfe080613ff3520f41d3537724c93e716f879e89e5852d9cef1fb`; all 34 hashes verified. Builder-owned gate pass 3 run with a fresh `spec-gate-reviewer` `ses_f5d17d22cffeCosH2bJqliYo4o` (GLM 5.3 Flash, read-only) on current bytes → **CLEAN**, no material findings; two non-blocking advisories recorded (whole-SPEC §12 e2e specs tracked to 04C; server-restart retry/E2E shell composition deferred to 04C). No commit/amend/push performed. Status `READY_FOR_ORCHESTRATOR_REVIEW`.

- 2026-09-14 — **Slice 04B implemented by a fresh `spec-slice-builder`** (baseline HEAD `5073b105…` + accepted SPEC-03/04A bytes; migration head `044`). Server: code-owned chat-capable view set (`lib/thread-groups/chat-capable-views.js`) and a Move precommit that returns the classified `view_not_supported` for any registered view outside the bridge-covered set before any row is created; focused integration adds capture-viewer and wiki-viewer Move success plus an ineligible `system-viewer` precommit rejection (14 tests). Client: one code-owned Side Chat composition seam (`useSideChatRailAdapter` called from `useViewTabAdapter`) — native adapters (File/Capture) keep their adapter as native-tab owner, adapterless chat-capable hosts (Wiki/Office/Email/Issues/Agents/Browser) get a runtime-only root only while an open managed placement exists; `ChatSurfaceComponentMount` side-tab tuple validation accepts the durable placement lane when no view population row exists. Focused e2e `e2e/side-chat-adapterless-native.spec.ts` 6 passed (capture connected native composition; wiki complete Move path + children-only; issues seeded presentation; office/email focused; file no-op). Deviations 04B-D1…D6 recorded above. No commit/amend/push performed.

- 2026-09-14 — **Slice 04B builder-owned gate pass 1 → CLEAN (no material findings).** Fresh read-only `spec-gate-reviewer` `ses_f5d0095aeffeMEK9KJY6soD8Sy` (GLM 5.3 Flash, high effort) independently reproduced the 38-path manifest (`87329751…`) and path-list digest (`ffe18b3f…`), verified the precommit order, runtime-only root, native-owner preservation, the `ChatSurfaceComponentMount` view-bound side-tab fallback, the contract freeze (no Generic Host / registration-contract edit; migration head `044`), and the absence of `surfaceId` leakage; re-ran the focused integration (14/14), full server suite (208/3024, 1 skipped), client build, and the Playwright 04B+04A spec (11 passed). Advisories (non-blocking): (a) combined-spec count is 11, not the 9 cited in the build summary — report-only; (b) `firstGroupWithOpenPlacement` is a deterministic insertion-order pick when an adapterless view is unbound with multiple placed groups (not reachable via the server delivery path in this slice; member access/repetition is 04C); (c) capture legacy composition is by construction (04B-D4). No commit/amend/push performed.

## Final Identity

- **Slice 04A candidate (current bytes):** product manifest `/private/tmp/chat04a/manifest-product.txt`, 34 paths, 0 deletions, SHA-256 `61295e24740dfe080613ff3520f41d3537724c93e716f879e89e5852d9cef1fb`; path list `/private/tmp/chat04a/paths-sorted.txt` SHA-256 `67fe1ba49260231b1a3383161745e0059d6b97dbe766251568a0f4601f3357d2`. Excludes this ledger, the SPEC-03/04 reports, and the preserved unrelated worktree bytes.
- **Builder-owned gate:** pass 3 fresh reviewer `ses_f5d17d22cffeCosH2bJqliYo4o` → **CLEAN** (no material findings). Pass 1 `ses_f5d4a45b1ffengmAlCu0kpHsfu` BLOCKED (F1 repaired); pass 2 `ses_f5d3505acffeWA3odYLCK8WjmD` CLEAN.
- **Status:** `READY_FOR_ORCHESTRATOR_REVIEW`. The orchestrator performs authoritative classification.

## Slice 04A Acceptance Record (orchestrator)

- Accepted revision: product manifest `/private/tmp/chat04a/manifest-product.txt`, 34 paths, 0 deletions, SHA-256 `61295e24740dfe080613ff3520f41d3537724c93e716f879e89e5852d9cef1fb`; path list SHA-256 `67fe1ba49260231b1a3383161745e0059d6b97dbe766251568a0f4601f3357d2`. Migration head `044_thread_group_placement_outbox.js`.
- Orchestrator inspection on current bytes: all 34 manifest hashes verified; focused move integration suite rerun 11 passed; client build passed; move e2e rerun 5 passed (isolated port 3317 + `/tmp` profile). Findings R1–R5 routed in one consolidated repair packet and repaired by a fresh builder continuation; builder-owned pass 3 (`ses_f5d17d22cffeCosH2bJqliYo4o`) CLEAN on repaired bytes.
- Fresh orchestrator acceptance reviewer `ses_f5d14da0fffeX9SFHtQbDzXcQA` (read-only, GLM 5.3 Flash high effort) returned **CLEAN** on the accepted manifest: independently reproduced 34/34 hashes, migration freeze, focused suites (7 suites / 34 tests), build, and move e2e (5); every deviation record validated accurate with none unrecorded; no material finding.
- Orchestrator classifications (authoritative): `04A-D1`, `04A-D2`, `04A-D4`, `04A-D5`, `04A-D6`, `04A-D8`, `04A-D9`, `04A-R1`…`04A-R4` → **accepted** (D9 carried advisory, mechanical `lib/thread-groups/service.js` split committed to 04D); `04A-D3`, `04A-D7` → **accepted / downstream_impact** (04C must deliver close disposition, the §12-mandated `side-chat-placement-recovery.spec.ts` / `side-chat-isolation.spec.ts`, and the Electron smoke including the 04A move path).
- Advisories carried: menu label "Move to Side Chat" vs SPEC §3 "Move Chat to Side Chat" (cosmetic; 04D doc sync); per-group outbox retry resolves one row pending 04C repeated-Move/reopen (plural sweep exists); best-effort failure-status write with the restart sweep as the durable retry path.
- Lifecycle closed: no commit/amend/push; HEAD `5073b1056fce4872751ab60de0b030560929b823`; unrelated bytes preserved. **Slice 04A accepted; Slice 04B unblocked.**

## Slice 04B Acceptance Record (orchestrator)

- Accepted revision: product manifest `/private/tmp/chat04b/manifest-product.txt`, 38 paths, 0 deletions, SHA-256 `87329751f395307290a22d557ba2f2aeb2aadace4ec1127464a69e8f74a25e53`; sorted path list SHA-256 `ffe18b3f78f2217f54beec195d9afcc07e77a59bbe035cb15136deb531bab567`. Migration head stays `044_thread_group_placement_outbox.js` (no new migration; 001–043 frozen).
- Delta over accepted 04A: new `lib/thread-groups/chat-capable-views.js`, `src/components/chat/useSideChatRailAdapter.ts`, `src/components/view-tabs/viewTabAdapters.ts`, `e2e/side-chat-adapterless-native.spec.ts`; changed `sideChatBridge.ts`, `fileConnectedAdapter.ts`, `ChatSurfaceComponentMount.tsx`, `service.js`, `e2e/worksurface-harness.ts`, `test/ws/thread-group-move-side-chat.integration.test.js`.
- Orchestrator inspection on current bytes: 38/38 manifest hashes verified; focused move integration rerun 14 passed; client build passed; combined 04B + 04A e2e rerun 11 passed (isolated port 3317, `/tmp` profile). No Generic Host bytes touched; server capability precommit precedes lease/transaction/rows; client bridge coverage matches the 8-view server set.
- Fresh orchestrator acceptance reviewer `ses_f5cfadb85fferltO0JyBmZCT8v` returned **CLEAN** with independently rerun server 14, build, e2e 11, and accepted regression lanes (chat-surface 49; chat03 46; thread-group 7; source 65; component-tab/action-context 142; full server 208/3024/1).
- Orchestrator classifications (authoritative): `04B-D1`…`04B-D6` → **accepted** (D4 advisory; D5 reachability note accepted for 04B with a 04C/04D whole-SPEC obligation; D6 no new migration).
- Advisories carried: client composition applies to any non-native view with open placements (no drift possible — the server lane is the sole placement writer and rejects ineligible views precommit); builder summary arithmetic (9 vs actual 11 combined e2e) report-only.
- **Carried to 04C (binding dispatch note):** (1) dockless-host restart reconciliation trigger — after relaunch with an existing open placement in `issues/agents/browser`, nothing currently triggers the worksurface entry read (reconnect reconciliation iterates bound views only); 04C's restart machinery must add the placement-read trigger for unbound dockless views. (2) §12 needs `side-chat-placement-recovery.spec.ts` and `side-chat-isolation.spec.ts` plus the Electron smoke. (3) 04C/04D whole-SPEC verification must show the covered hosts exercising the real entry point or record an explicit owner-ruling item. (4) 04A-D9 `service.js` split remains committed to 04D.
- Lifecycle closed: no commit/amend/push; HEAD `5073b1056fce4872751ab60de0b030560929b823`; unrelated bytes preserved. **Slice 04B accepted; Slice 04C unblocked.**

- 2026-09-14 — **Slice 04C builder session churn (recorded).** First 04C builder dispatch (`ses_f5cf47e8affe5TRkqtH7ntEhLt`) reported `Failed to execute statement` from the spawn call but ran in the background and produced substantial partial 04C bytes (server close-disposition guard + member access; client closable tabs/member menu/members hydration; new `e2e/side-chat-placement-recovery.spec.ts`, `e2e/side-chat-isolation.spec.ts`, `e2e/side-chat-electron-smoke.mjs`, `test/ws/thread-group-member-access.integration.test.js`). A retry spawn was aborted by the owner and a resume attempt stalled; the session never handed off, produced no 04C manifest, no ledger records, and no builder gate. Orchestrator state check: no active writer processes; client build green on the partial bytes; 18 accepted-union files changed + `ThreadRail.tsx` + 4 new files (no 04C accepted manifest yet). Recovery: fresh continuation builder dispatched to finish 04C on the existing partial bytes (not restart), record deviations/ledger entries, run the full 04C verification + Electron smoke, and run the builder-owned gate.

- 2026-09-14 — **Slice 04C continued and completed by a fresh `spec-slice-builder`** on the existing
  partial bytes (baseline HEAD `5073b105…` + accepted SPEC-03/04A/04B bytes; migration head `044`).
  Assessed the partial work: `thread:members` registered qualified read with authoritative nullable
  view + bounded ordered projections; `open_member_in_side` durable action with bounded CAS
  reopen/focus; close disposition through the SPEC-03 `state:worksurface_placement` lane;
  `consumePlacementOutbox` no-re-upsert on `closed`; member menu in the ThreadRail kebab; dockless
  unbound restart sweep; recovery/isolation specs and the Electron smoke. Repairs completed by this
  builder: (a) **portable-boundary regression** — the partial ThreadRail imported
  `ThreadMemberProjection` from `state/slices/worksurfaceSlice`, failing the accepted
  `threaded-chat-host.spec.ts` portability sweep (chat-surface lane 48/1); extracted the contract to
  the portable `src/types/threadGroupMember.ts` and re-exported it from the slice (04C-D9);
  (b) added focused member-access coverage for the Legacy nullable view + inert Legacy member action,
  the requested/other-window fan-out convergence, and repeated-close harmlessness (12 tests);
  (c) added the dockless/unbound restart readback test and harness controls (04C-D10);
  (d) strengthened the restart recovery spec to re-read the durable closed placement through the
  SPEC-03 reconnect lane (not just cleared memory); (e) strengthened the Electron smoke to assert the
  replacement Main host addresses the new empty session and shows the empty conversation state, adding
  `CHAT_04C_SMOKE_EMPTY_REPLACEMENT=true`. Deviation records 04C-D1…04C-D13 added above. No commit/
  amend/push. Product manifest `/private/tmp/chat04c/manifest-product.txt`, 25 paths, 0 deletions,
  SHA-256 `28c94387bad72823f37aa7594aeca2bc0173f691a02a44caa64832031832d633`; sorted path list
  `/private/tmp/chat04c/paths-sorted.txt` SHA-256
  `55f46f46b93b14f80f14d8e0f9cf2ff14983e7d0b3814f9cfcfcfe610546a870`; all 25 hashes verified
  25/25. Cumulative checks on current bytes: focused member-access integration 12; full server suite
  209 suites / 3036 passed / 1 skipped; client build passed; move + recovery + isolation + adapterless
  e2e 20; chat03 worksurface lane 46; chat-surface lane 49; thread-group lane 7; source lane 65;
  component-tab + action-context 142; Electron smoke all 8 markers. Status
  `READY_FOR_ORCHESTRATOR_REVIEW`.
- 2026-09-14 — **Slice 04C builder-owned gate pass 1 → CLEAN (no material findings).** Fresh read-only
  `spec-gate-reviewer` spawn `ses_f5c752547ffexePPKCFh0A8Dyu` (pinned GLM 5.3 Flash, high effort; no
  inherited parent conversation) independently reproduced the 25-path manifest (25/25) and path-list
  digest, cross-checked the accepted SPEC-03/04A/04B union for unrecorded product touches (0 outside
  the 25-path delta), confirmed migration head `044` and no `surfaceId` emission, verified the close
  disposition/no-resurrection path, `thread:members`, `open_member_in_side`, member menu + links,
  repeated Move, races/isolation, and the dockless restart trigger, and read every 04C-D1…D13 record
  as accurate and complete. It re-ran every check green: member access 12; full server 209/3036/1;
  client build; e2e 20; chat03 46; chat-surface 49; thread-group 7; source 65; component-tab +
  action-context 142; Electron smoke 8/8 markers. Advisories (non-blocking): 04C-D6 nested-menu
  deviation, 04C-D11 smoke scope, 04C-D13 size carry, and the ledger preserve-list now names the
  concurrent Office-chain bytes (added above). No commit/amend/push performed.


## Slice 04C Candidate Identity

- **Slice 04C candidate (current bytes):** product manifest `/private/tmp/chat04c/manifest-product.txt`,
  25 paths, 0 deletions, SHA-256 of the manifest file
  `28c94387bad72823f37aa7594aeca2bc0173f691a02a44caa64832031832d633`; sorted path list
  `/private/tmp/chat04c/paths-sorted.txt` SHA-256
  `55f46f46b93b14f80f14d8e0f9cf2ff14983e7d0b3814f9cfcfcfe610546a870`. Excludes this ledger, the
  SPEC-03/04 reports, and the preserved unrelated worktree bytes.
- **Delta over accepted 04B:** 19 changed paths (`side-chat-adapterless-native.spec.ts`,
  `worksurface-harness.ts`; chat `sideChatBridge`, `useSideChatRailAdapter`, `useViewChatHost`;
  worksurface `worksurfaceController`/`Failures`/`Frames`/`Requests`/`Runtime`; ws `thread-handlers`,
  `threadGroupRows`, `workspace-handlers`; state `panelStoreTypes`, `worksurfaceSlice`;
  `types/websocket`; server `placement-delivery`, `service`, `thread-ws-handlers`) plus 6 new paths
  (`ThreadRail.tsx` changed vs HEAD but outside the accepted 04A/04B/SPEC-03 manifests,
  `types/threadGroupMember.ts`, `e2e/side-chat-placement-recovery.spec.ts`,
  `e2e/side-chat-isolation.spec.ts`, `e2e/side-chat-electron-smoke.mjs`,
  `test/ws/thread-group-member-access.integration.test.js`).
- **Migration head:** `044_thread_group_placement_outbox.js` (unchanged; 001–043 frozen; no new
  migration).
- **Builder-owned gate:** pass 1 fresh read-only `spec-gate-reviewer` spawn
  `ses_f5c752547ffexePPKCFh0A8Dyu` → **CLEAN** (no material findings; 3 recorded advisories).
- **Status:** `READY_FOR_ORCHESTRATOR_REVIEW`. The orchestrator performs authoritative classification
  and slice acceptance.

## Slice 04C Acceptance Record (orchestrator)

- Accepted revision: product manifest `/private/tmp/chat04c/manifest-product.txt`, 25 paths, 0 deletions, SHA-256 `28c94387bad72823f37aa7594aeca2bc0173f691a02a44caa64832031832d633`; sorted path list SHA-256 `55f46f46b93b14f80f14d8e0f9cf2ff14983e7d0b3814f9cfcfcfe610546a870`. Migration head stays `044_thread_group_placement_outbox.js` (001–043 frozen).
- Delta over accepted 04B: 19 changed + 6 new (0 deletions). Accepted-union preservation verified: every path outside the delta is byte-identical to its accepted 04B hash.
- Orchestrator inspection on current bytes: 25/25 manifest hashes verified; focused member-access integration rerun 12 passed; client build passed; combined move/recovery/isolation/adapterless e2e rerun 20 passed (isolated port 3317, `/tmp` profile); Electron smoke independently rerun with all eight markers (`CHAT_04C_SIDE_CHAT_SMOKE_OK`, `PEERS=4`, `SINGLE_ROW=true`, `CLOSE_DISPOSITION=true`, `REOPEN_LIFETIME_PLACEMENT=true`, `RELAUNCH_READBACK=true`, `OUTER_RAIL_TOGGLE=true`, `EMPTY_REPLACEMENT=true`).
- Fresh orchestrator acceptance reviewer `ses_f5c6cb9b3ffeycKAQoJCq1gcr6` returned **CLEAN** with independently rerun full server 209/3036/1, member access 12, build, e2e 20, smoke, and regression lanes (chat03 46; chat-surface 49; thread-group 7; source 65; component-tab/action-context 142).
- Orchestrator classifications (authoritative): `04C-D1`…`04C-D4`, `04C-D7`…`04C-D11`, `04C-D13` → **accepted**; `04C-D5` (server-owned member links; no production renderer entry point) and `04C-D6` (member list nested in the pre-existing ThreadRail kebab rather than the portal menu module) → **accepted / advisory, downstream 04D**; `04C-D12` no new migration accepted.
- Carried to 04D (binding dispatch note): (1) Secondary Chat retirement + the smoke's Secondary-absence assertion; (2) the inert panel-global `composerModelConfig[currentPanel]` fallback deletion (02A-D3 downstream); (3) `lib/thread-groups/service.js` split (now ~1300 lines; `moveChatToSide` + `_resolveMoveSessionPolicy` + `openMemberInSide`/`listGroupMembers` extraction behind the stable `performAction` facade); (4) possible per-member Copy Link renderer entry or recorded owner ruling (04C-D5); (5) portal-menu adoption or recorded carry for the rail member group (04C-D6); (6) Wiki/doc sync including the "Move Chat to Side Chat" menu-label alignment and SPEC-03 stale comment drifts; (7) `SPEC-04-IMPLEMENTATION-REPORT.md` draft.
- Lifecycle closed: no commit/amend/push; HEAD `5073b1056fce4872751ab60de0b030560929b823`; unrelated bytes (owner `state.json` drifts, `031-Remote_Access/`, concurrent Office-chain and capture-handoff artifacts, `RELEASE-MANIFEST.md`, SPEC-03 report/ledger) preserved. **Slice 04C accepted; Slice 04D unblocked.**
- 2026-09-14 — **Slice 04D implemented by a fresh `spec-slice-builder`** (baseline HEAD `5073b105…` + accepted SPEC-03/04A/04B/04C bytes; migration head `044`). Inventory first: the legacy Secondary Chat is a singleton/floating UI authority (`SecondaryChat.tsx`, `SecondaryHeader.tsx`, `SecondaryDockButton.tsx`, `secondarySlice.ts`, `secondary-tracker.ts`, the `ChatArea` secondary override, and `isSecondary`/screenshot-surface branches); it holds no durable chat identity beyond existing SPEC-01 group/session migration (its state is transient UI + `thread:open` reuse), so removal was safe with no migration/deviation decision. Global mirror audit: `contextUsage`/`tokenUsage`/`wireReady`/`connectingHarnessId` still have the production Legacy Main Chat as a consumer and were kept; the inert panel-global `composerModelConfig[currentPanel]` fallback (zero writers) was deleted. Removed every Secondary route/state/render/menu/resize/style plus the client view-state `rightSecondary`/`popup`/`secondaryThreadId` fields and the server resolver defaults; deleted `useChatArea.ts` (orphaned after the override removal). Split `lib/thread-groups/service.js`: `moveChatToSide`/`_resolveMoveSessionPolicy` → `move-service.js`, `listGroupMembers`/`openMemberInSide` → `member-service.js`, behavior-identical behind thin delegating methods and the unchanged `performAction` facade. Added the per-member Copy Link renderer entry (04C-D5), aligned the Move label to SPEC §3, swept SPEC-03 stale comments (`captureViewerWorksurfaceAdapter.ts`, `ViewChatHost.tsx`) and stale Secondary comments, and synced the routed Chat/View wiki pages. No new migration (head stays `044`; 001–043 frozen). Checks on current bytes: focused move+member integration 26; full server 209 suites / 3038 passed / 1 skipped; client build passed; SPEC-04 e2e 20; chat-surface + component-tab/action-context 191; thread-group 7; source 65; chat03 worksurface 46; Electron smoke all 9 markers including `CHAT_04D_SECONDARY_ABSENT=true`. Deviations 04D-D1…D13 recorded above. Product manifest `/private/tmp/chat04d/manifest-product.txt`, 77 paths, 6 deletions, SHA-256   `e98dc87b1ade63a79fb04d54321cbaeac3fefd2b46c8cebfca47ffcb0ec17879`; all 77 hashes verified. No commit/amend/push. Status `READY_FOR_ORCHESTRATOR_REVIEW`.
- 2026-09-14 — **Slice 04D builder-owned gate pass 1 → CLEAN (no material findings).** Fresh read-only
  `spec-gate-reviewer` spawn `ses_f5c49cbc2ffeX1cnfdgPkXdNk0` (pinned GLM 5.3 Flash, high effort; no
  inherited parent conversation) independently reproduced the candidate identity (manifest
  `e98dc87b…879`, 77/77 entries re-hashed OK; path list `40bc04ab…d56`; deletions `18ef01f2…60d`;
  the 04A∪04B∪04C union ⊆ the 04D list with zero silently dropped paths), confirmed migration head
  `044_thread_group_placement_outbox.js` and no new migration, confirmed no `surfaceId`/Fork residue,
  verified the smoke absence assertion is real (seven legacy DOM selectors + the "Open a side chat"
  menu text asserted zero inside the live Electron flow, `CHAT_04D_SECONDARY_ABSENT=true`), verified
  the `service.js` split is behavior-identical behind the unchanged `performAction`/`ThreadGroupService`
  surface, read every 04D-D1…D13 record as accurate and complete, reran the focused move/member
  integration (26/26) and a fresh Electron smoke with all nine markers, and confirmed the preserved
  unrelated bytes were untouched. Three non-blocking advisories: `chat-surface-identity.spec.ts`
  retains `useChatArea` as an inert forbidden-import token; the carried 04D-D4 `service.js` residual
  size split and 04D-D6 portal-menu migration remain future work; split behavior-identity is
  established semantically plus by rerun evidence because the pre-04D bytes are uncommitted (low
  residual). No commit/amend/push performed.

## Slice 04D Candidate Identity

- **Slice 04D candidate (current bytes):** whole-SPEC-04 product manifest
  `/private/tmp/chat04d/manifest-product.txt`, 77 paths, 6 deletions, SHA-256 of the manifest file
  `e98dc87b1ade63a79fb04d54321cbaeac3fefd2b46c8cebfca47ffcb0ec17879`; sorted path list
  `/private/tmp/chat04d/paths-sorted.txt` SHA-256
  `40bc04ab35bc78a4f7a8593fd3055081717f3bc87f9c9f14d126a755b5f64d56`; deletions list
  `/private/tmp/chat04d/deletions.txt` SHA-256
  `18ef01f2eed4efd3aeeb212c4a03368dd9cc6ec46d8b065dc2837ff8ac6b260d` (6 paths). Excludes this ledger,
  the SPEC-03/04 reports, the Wiki docs, and the preserved unrelated worktree bytes.
- **Delta:** legacy Secondary Chat retirement (5 modules + orphaned `useChatArea.ts` deleted; state,
  render, menu, resize, styles, and test wiring removed), `service.js` split (`move-service.js` +
  `member-service.js`), per-member Copy Link, Move label alignment, SPEC-03 stale-comment sweep,
  `isSecondary`/screenshot-surface retirement, view-state `rightSecondary`/`popup`/`secondaryThreadId`
  removal, Wiki sync.
- **Migration head:** `044_thread_group_placement_outbox.js` (unchanged; 001–043 frozen; no new
  migration).
- **Builder-owned gate:** pass 1 fresh read-only `spec-gate-reviewer` spawn
  `ses_f5c49cbc2ffeX1cnfdgPkXdNk0` → **CLEAN** (no material findings; 3 recorded advisories).
- **Status:** `READY_FOR_ORCHESTRATOR_REVIEW`. The orchestrator performs authoritative classification
  and slice acceptance.

## Slice 04D Acceptance Record (orchestrator) and record-identity repair

- Builder revision: whole-SPEC product manifest `/private/tmp/chat04d/manifest-product.txt`, 77 paths, 6 deletions, digest `e98dc87b1ade63a79fb04d54321cbaeac3fefd2b46c8cebfca47ffcb0ec17879`.
- Orchestrator final-integration reruns on current bytes: full server suite 209 suites / 3038 passed / 1 skipped; client build passed; SPEC §12 e2e set (move/recovery/isolation/adapterless) 20 passed (isolated port 3317, `/tmp` profile); Electron smoke all nine markers incl. `CHAT_04D_SECONDARY_ABSENT=true`; regression lanes chat03 46, chat-surface 49, thread-group 7, source 65, component-tab/action-context 142.
- Fresh orchestrator acceptance reviewer `ses_f5c3cf73fffeCsoMiIhQ4pBu6r` returned **CLEAN** on product behavior with one material record-level finding **M1** (subsuming M2): the builder's 77-path product manifest omitted `fusion-studio-client/src/lib/worksurface/sideChatViews.ts` (behavior-bearing: gates the dockless restart sweep; imported by `thread-handlers.ts`/`worksurfaceFrames.ts`; must stay in lockstep with the server `chat-capable-views.js`) and the comment-only 04D touch `fusion-studio-client/src/components/chat/ViewChatHost.tsx`. No product byte was missing or wrong; every executed check remained valid.
- **Repair (orchestrator-owned, no product-byte change):** regenerated the whole-SPEC manifest at `/private/tmp/chat04/final/manifest-product.txt` — **79 paths, 6 deletions**, digest `03171a3954972dccf0abe19fbaa1513c12315b78fd4a34c6ab5de976285c24e7`; path list `/private/tmp/chat04/final/paths-sorted.txt` SHA-256 `6c84b83bf6576d48a99e223d45ce955cb0cfbc685653f039d196d0bfa713e3de`; all 79 hashes re-verified OK. `SPEC-04-IMPLEMENTATION-REPORT.md` fingerprint/counts/final statement updated to the corrected identity; the repair is disclosed in the report's fingerprint section.
- Orchestrator classifications (authoritative): `04D-D1`…`04D-D13` → **accepted** (D4 `service.js` 857-line residual carry with link/selection/delete split plan; D6 portal-menu carry; D12 smoke absence assertion; D13 no new migration). Carried 04C-D5 resolved by 04D-D5 (per-member Copy Link entry). No unrecorded product deviations.
- Advisories carried: `chat-surface-identity.spec.ts` inert `useChatArea` forbidden-import token; manifest/path-list collation normalization for byte-exact set comparisons; client `sideChatViews.ts` ↔ server `chat-capable-views.js` lockstep by convention (now fingerprinted); Electron smoke has no real model turn (frame-level isolation proven by specs); pre-existing 02A-D7 baseline-red set unchanged.
- **Slice 04D accepted.** Proceeding to the whole-SPEC final-integration review on the corrected 79-path identity.

## Slice 04D Final Identity (corrected)

- Whole-SPEC product manifest: `/private/tmp/chat04/final/manifest-product.txt`, 79 paths, 6 deletions, digest `03171a3954972dccf0abe19fbaa1513c12315b78fd4a34c6ab5de976285c24e7`; path list SHA-256 `6c84b83bf6576d48a99e223d45ce955cb0cfbc685653f039d196d0bfa713e3de`; deletions SHA-256 `18ef01f2eed4efd3aeeb212c4a03368dd9cc6ec46d8b065dc2837ff8ac6b260d` (6 paths).
- Baseline: `5073b1056fce4872751ab60de0b030560929b823` + accepted uncommitted SPEC-03 bytes (digest `6b1e36ce…`, 71 paths). Migration head `044_thread_group_placement_outbox.js`; migrations 001–043 frozen.
- HEAD unchanged; no commit/amend/push performed.

## Whole-SPEC Final Integration Record (orchestrator)

- Final integration on the corrected 79-path identity: full server suite `npx jest --runInBand` 209 suites / 3038 passed / 1 skipped; client build passed; SPEC §12 e2e set + 04B adapterless spec 20 passed (isolated port 3317, `/tmp` profile); Electron smoke all nine markers (`CHAT_04C_SIDE_CHAT_SMOKE_OK`, `PEERS=4`, `SINGLE_ROW=true`, `CLOSE_DISPOSITION=true`, `REOPEN_LIFETIME_PLACEMENT=true`, `RELAUNCH_READBACK=true`, `OUTER_RAIL_TOGGLE=true`, `EMPTY_REPLACEMENT=true`, `CHAT_04D_SECONDARY_ABSENT=true`); regressions chat03 46, chat-surface 49, thread-group 7, source 65, component-tab/action-context 142.
- Fresh whole-SPEC final-integration reviewer `ses_f5c32bbf9ffePX9ZH91feEITo9` (read-only, GLM 5.3 Flash high effort) returned **CLEAN**: 79/79 manifest hashes, 6 absent deletions, path-set closure (no unexpected product path), report fingerprint/claims accurate, §3–§14 criteria verified, cross-slice identity/lease/recovery contracts conform, Secondary retirement and no-Fork verified, capability-set lockstep verified, migrations 001–043 frozen, all reruns matching. Advisories only (recorded below).
- Deviation accounting closed: `04A-D1`…`D9` + `R1`…`R4`; `04B-D1`…`D6`; `04C-D1`…`D13`; `04D-D1`…`D13` — every record validated against current bytes, every classification made at the owning gate, none unrecorded.
- Carried advisories (non-blocking): `service.js` 857-line residual split with concrete plan; portal-menu adoption for the rail member group; inert `useChatArea` token in `chat-surface-identity.spec.ts`; capability lockstep by convention (both sets now fingerprinted); Electron smoke model-turn scope (frame-level isolation separately proven); pre-existing 02A-D7 baseline-red set unchanged.
- Downstream impact: no schema change beyond migration 044; no Generic Host widening; no transport-family addition; no Fork return; future SPECs start migrations at 045. Roadmap-level completion items (supervisor review and explicit owner acceptance) remain with the owner.
- **Status: SPEC_READY_FOR_OWNER_REVIEW — READY FOR INDEPENDENT OWNER-SIDE REVIEW. Not owner-accepted. No commit/amend/push. HEAD `5073b1056fce4872751ab60de0b030560929b823`.**
