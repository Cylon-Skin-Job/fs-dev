# SPEC-04 Implementation Report — Move Chat to Side Chat

**Status:** `READY_FOR_INDEPENDENT_OWNER-SIDE_REVIEW` — builder-owned gate clean; **not owner-accepted**
**Approved candidate:** `CHAT-COMPOSITION-2d34f8b45562f8f3` (owner-approved; overlaid packet)
**SPEC:** `SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md`
**Implementation baseline (dispatch):** `5073b1056fce4872751ab60de0b030560929b823` (commit `5073b10 feat: composable chat surfaces (CHAT-02/SPEC-02)`) plus the owner-accepted, still-uncommitted SPEC-03 product bytes
**Baseline branch:** `agent/exact-workspace-paths`
**Migration head at completion:** `044_thread_group_placement_outbox.js` (001–043 frozen; no 04D migration)
**Orchestrator:** primary session acting as spec orchestrator (owner-appointed, direct run)
**Execution ledger:** `CHAT-04-EXECUTION-LEDGER.md` (slice gates, deviations, lifecycle)

## Accepted prerequisites and authority

- SPEC-03 (CHAT-03) owner-accepted 2026-09-14; product digest `6b1e36ce28689121857200ddbd997a618596a37c00744c305b4896e8714b793d` (71 paths); migration head `043`. SPEC-02 owner-accepted and committed `5073b10`; SPEC-01 owner-accepted `5f46d1a`; SPEC-00 owner-accepted `7f0d3c8`; BRIDGE-01 owner-accepted `16ccecf`; BRIDGE-02 owner-approved and consumed through `BRIDGE-02-CONFORMANCE-OVERLAY.md`; overlaid `025` candidate owner-approved 2026-09-13.
- SPEC §10 precondition satisfied: slices 04A–04C passed focused and Electron acceptance checks before the legacy Secondary Chat was retired.
- Recorded orchestrator interpretations: durable `thread:action` names `move_chat_to_side`/`open_member_in_side` plus the qualified `thread:members` read (no new transport family); `sideChatPlacementId` is the durable placement key (never `surfaceId`/`projectionId`/`threadId`/`threadGroupId`); Move commits SQLite first and delivers placement separately through the SPEC-03 lane; no Generic Host widening; isolated Playwright lanes and throwaway-profile Electron smoke.

## Slice ledger

| Slice | Scope | Accepted revision | State |
|---|---|---|---|
| 04A | End-to-end Move in one adapted view (menu → trusted `thread:action` → sequence/idempotency → group/MRU transaction → migration 044 outbox → managed placement → bridge → `fusion.chat-surface` Side render → fan-out → restart/readback) | product manifest `61295e24740dfe080613ff3520f41d3537724c93e716f879e89e5852d9cef1fb` (34 paths) | **accepted** (2026-09-14) |
| 04B | Adapterless and native-view coverage (native tab owners, runtime-only roots, existing children, dedupe/focus, ineligible precommit rejection) | product manifest `87329751f395307290a22d557ba2f2aeb2aadace4ec1127464a69e8f74a25e53` (38 paths) | **accepted** (2026-09-14) |
| 04C | Close, restart, access, repetition (`thread:members`, `open_member_in_side`, close disposition/no resurrection, repeated Move, full checks + Electron smoke + recovery/isolation specs) | product manifest `28c94387bad72823f37aa7594aeca2bc0173f691a02a44caa64832031832d633` (25 paths) | **accepted** (2026-09-14) |
| 04D | Retire singleton Secondary Chat, `service.js` split, dead-code sweeps, full regressions, Wiki sync, final report | builder 77 paths + 6 deletions, digest `e98dc87b…`; orchestrator-final 79 paths + 6 deletions, digest `03171a39…` | builder-owned gate CLEAN (this report) |

Every slice used a fresh `spec-slice-builder`; every builder-owned gate used a fresh read-only `spec-gate-reviewer` that stopped at the first materially clean pass on current bytes.

## Delivered outcome (whole SPEC)

Fusion Studio now delivers one explicit **Move Chat to Side Chat** action and retires the legacy singleton Secondary Chat:

- **User-visible contract.** For the current Main Chat `A` in group `G`, invoking **Move Chat to Side Chat** durably creates a new empty session `B` in `G`, makes `B` the current Main Chat, and places unchanged `A` centered in a Side Chat tab in the same view. The ThreadRail still shows one row for `G`. `A` retains all transcript, turns, runtime, model history, usage, and Provenance; `B` copies no messages or context. Move is never a Fork.
- **Atomic group transition.** Under the accepted group mutation lease shared with Rename/Delete, Move appends the peer member with `origin_kind='move-to-side-chat-primary'`, appends the primary event with reason `move-to-side-chat`, advances the transactional primary cache, writes one idempotent `move:{requestId}` `move-chat-to-side` activity that advances group MRU exactly once, and inserts a durable `open-side-chat-tab` placement outbox row. `B` inherits only the immutable server-owned harness binding plus the source session's last server-acknowledged portable `{model, variant}`.
- **Placement and close (04C).** Delivery is a separate retryable step through SPEC-03's service-managed placement lane keyed by the stable, independently minted `sideChatPlacementId`. Ordinary outbox replay focuses/acknowledges an existing placement and creates no duplicate; it never reopens a closed disposition. Closing a Side Chat records a durable closed disposition through the owning view contract before the descriptor is removed; explicit `open_member_in_side` (or exact-member link resolution) is the only reopen path and reuses the lifetime placement without warming or creating a session.
- **Member access (04C).** `thread:members` returns ordered durable projections (threadId, ordinal, isPrimary, created time, bounded label, placement disposition) for one validated group, with no transcript content. The shared thread-row kebab exposes those members; choosing a non-primary member reopens/focuses its Side Chat without promotion or MRU activity. SPEC-04 04D adds a per-member Copy Link entry that emits the canonical exact-member `copy_link` action.
- **Renderer composition.** One code-owned Side Chat bridge above the existing adapter lookup: native adapters (File/Capture) keep their tab owner and compose managed Side Chats into the visible rail; adapterless chat-capable views (Issues/Wiki/Browser/Agents/Office/Email) get a runtime-only root only while a Side Chat is open. The Side Chat uses the same composable surface, header, composer, list button, and menu behavior; it has no nested thread list and its list button operates the outer owning view's ThreadRail.
- **Secondary Chat retirement (04D).** The legacy singleton/floating Secondary Chat is removed with no compatibility alias: components, state slice, tracker, `ChatArea` override, menu entry, resize handle, view-state fields (`rightSecondary`/`popup`/`secondaryThreadId`), the dead panel-global `composerModelConfig` fallback, and its dedicated tests/styles. The inert workspace-global `contextUsage`/`tokenUsage`/`wireReady`/`connectingHarnessId` mirrors were inventoried and **kept**, because the production Legacy Main Chat still consumes them; they are not Secondary-only.
- **Module hygiene (04D).** `lib/thread-groups/service.js` delegates `move_chat_to_side`/`_resolveMoveSessionPolicy` to the new focused `lib/thread-groups/move-service.js` and `listGroupMembers`/`openMemberInSide` to `lib/thread-groups/member-service.js`, behavior-identical behind the stable `performAction`/`ThreadGroupService` public surface (public imports/exports unchanged).

## Required verification results

All commands were run on the final 04D bytes; the builder reran the focused/full server, build, Playwright, and Electron gates after the targeted/full checks.

| Command | Result |
|---|---|
| `cd fusion-studio-server && npx jest --runInBand` | **209 suites passed; 3038 passed, 1 skipped, 3039 total** |
| `cd fusion-studio-server && npx jest test/ws/thread-group-move-side-chat.integration.test.js test/ws/thread-group-member-access.integration.test.js --runInBand` | **26 passed** (14 move + 12 member access) |
| `cd fusion-studio-client && npm run build` | passed (TypeScript + Vite production build; only the pre-existing >500 kB chunk warning) |
| `cd fusion-studio-client && npx playwright test e2e/move-chat-to-side-chat.spec.ts e2e/side-chat-placement-recovery.spec.ts e2e/side-chat-isolation.spec.ts e2e/side-chat-adapterless-native.spec.ts --config=playwright.chat03.config.ts` | **20 passed** (5 / 5 / 3 / 7). Isolated port 3317, throwaway `/tmp` profile + DB, `reuseExistingServer: false` (isolation from the owner's port 3001 is mandatory per GUIDANCE §6) |
| `cd fusion-studio-client && npx playwright test e2e/chat-surface-identity.spec.ts e2e/chat-surface-isolation.spec.ts e2e/threaded-chat-host.spec.ts e2e/chat-component-registration.spec.ts 'component-tab-' 'component-action-context-source' --config=playwright.chat-surface.config.ts` | **191 passed** (accepted SPEC-02 chat-surface lane 49 + Generic Host/action-context 142) |
| `cd fusion-studio-client && npx playwright test e2e/thread-group-compatibility.spec.ts --config=playwright.thread-group.config.ts` | **7 passed** (accepted SPEC-01 predecessor lane) |
| `cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts` | **65 passed** (Provenance/source suite) |
| `cd fusion-studio-client && npx playwright test e2e/thread-worksurface-switching.spec.ts e2e/thread-worksurface-conflict.spec.ts e2e/thread-worksurface-restart.spec.ts e2e/thread-worksurface-builtins.spec.ts --config=playwright.chat03.config.ts` | **46 passed** (accepted SPEC-03 worksurface lane) |
| `cd fusion-studio-client && node e2e/side-chat-electron-smoke.mjs` | `CHAT_04C_SIDE_CHAT_SMOKE_OK`; `PEERS=4`; `SINGLE_ROW=true`; `CLOSE_DISPOSITION=true`; `REOPEN_LIFETIME_PLACEMENT=true`; `RELAUNCH_READBACK=true`; `OUTER_RAIL_TOGGLE=true`; `EMPTY_REPLACEMENT=true`; **`CHAT_04D_SECONDARY_ABSENT=true`** |

**Electron smoke** (`e2e/side-chat-electron-smoke.mjs`): launches the real built app via `_electron` on a throwaway `FUSION_APP_USER_DATA` profile and temp workspace (`FUSION_LOCAL_MACHINE=RC-MacAir-15`; never Alpha/port 3001/dev DB), moves the current Main Chat from the production menu in the Capture native-adapted view, asserts the replacement Main host addresses the new empty session, closes/reopens the Side Chat on the same lifetime placement id, relaunches and reads back the open Side Chat, repeats Move to four ordered peers with one Thread row, and toggles the outer owning view's ThreadRail from a Side Chat. 04D adds a hard Secondary-absence assertion over the legacy render/dock/header/menu selectors, printed as `CHAT_04D_SECONDARY_ABSENT=true`. Protected development bytes are byte-asserted in `finally`.

**Dead-code sweeps (04D).** Recorded exact searches proving no Secondary route/state/style/shortcut remains:
- `grep -rniE 'secondarychat|secondary-chat|rv-secondary|secondarytracker|openSecondary|closeSecondary|…' fusion-studio-client/src fusion-studio-server/lib` → **no product match** (the only remaining `.rv-secondary-*` strings are the smoke's deliberate absence selectors).
- `grep -rniE 'rightSecondary|secondaryThreadId|reorderWithSecondary|threadIdOverride|…'` over client `src`/`e2e` and server `lib`/`test` → **no match outside the smoke's absence list**.
- No `secondary` route/action/message remains; `thread:open` is reused unchanged. The removed `useChatArea` hook had no remaining importer.

## Deviation ledger (summary)

Full records with clause/actual/reason/files/tests/effect/risk/downstream/classification live in `CHAT-04-EXECUTION-LEDGER.md` (04A–04C) and below (04D). The orchestrator classifies every deviation authoritatively after handoff.

### Slice 04A–04C (accepted; see execution ledger)

- **04A-D1…D9, R1…R4** migration head 044 and oracle updates; descriptor input omits `sideChatPlacementId`; 04A Side tab non-closable (→04C); side-only rail model; tuple validation; test-only harness; deferred Electron smoke; store-mirrored outer-rail dock; `service.js` size carry (→04D); placement-only re-read, finalizing Stop boundary, truthful toast, restored `view_id: null`.
- **04B-D1…D6** centralized Side Chat composition seam; side-tab tuple validation without a population row; test-only harness; capture legacy policy path (advisory); adapterless reachability note; no new migration.
- **04C-D1…D13** close disposition on the SPEC-03 lane; outbox no-re-upsert on `closed`; `thread:members`; `open_member_in_side`; server-owned member links (no production renderer entry point → 04D); member list nested in the pre-existing kebab (portal-menu carry → 04D); transient renderer state; test-only harness; portable member-projection type; dockless restart sweep; Electron smoke scope; no new migration; `service.js` size carry (→ 04D split).

### Slice 04D (builder-owned gate; proposed classifications)

- **04D-D1 — Legacy Secondary Chat retired with no compatibility alias.** *Clause:* SPEC-04 §10 "remove its routes, state, rendering, shortcuts, and dead styles". *Actual:* deleted `SecondaryChat.tsx`, `SecondaryHeader.tsx`, `SecondaryDockButton.tsx`, `state/slices/secondarySlice.ts`, `lib/secondary-tracker.ts`, and the orphaned `components/chat/useChatArea.ts`; removed the `ChatArea` secondary override, the `App` sticky/popup/dock render, the Secondary menu entry, `RightSecondaryResize`, the `rv-secondary-*` styles (App/ChatArea/Email/Office), the `rightSecondary`/`popup`/`secondaryThreadId` client view-state fields and server resolver defaults, and the now-dead `secondaryThreadId`/`openSecondary`/`reorderWithSecondary` wiring. *Tests:* build + all lanes + smoke absence marker. *Effect:* exactly one Side Chat authority (the component-backed tab). *Risk:* none (durable sessions remain SPEC-01/SPEC-02/SPEC-03 governed). **Proposed: accepted.**
- **04D-D2 — Workspace-global mirror inventory: `contextUsage`/`tokenUsage`/`wireReady`/`connectingHarnessId` retained.** *Clause:* mission inventory. *Actual:* every remaining consumer is the production Legacy Main Chat (`useLegacyChatHost.ts`) or the WS handlers that write them, not the retired Secondary. They were therefore kept rather than removed. *Effect:* no behavior change; no incomplete retirement. **Proposed: accepted (recorded boundary).**
- **04D-D3 — Inert panel-global `composerModelConfig[currentPanel]` fallback deleted (02A-D3 downstream).** *Clause:* carried 04C note; SPEC §10 dead-state removal. *Actual:* `chatSlice.sendMessage` now reads only `options?.harnessConfig`; `composerModelConfig`/`setComposerModelConfig`/`ComposerModelSelection` (zero writers/readers) are removed. *Tests:* build; all lanes. *Effect:* behavior-identical (the fallback always returned `undefined`). **Proposed: accepted.**
- **04D-D4 — `lib/thread-groups/service.js` split (04A-D9 + 04C-D13).** *Clause:* routed Code Standards "no file over 400 lines"; carried split plan. *Actual:* `moveChatToSide`/`_resolveMoveSessionPolicy` moved to `lib/thread-groups/move-service.js`; `listGroupMembers`/`openMemberInSide`/`boundedMemberLabel` moved to `lib/thread-groups/member-service.js`. Both take the owning `ThreadGroupService` instance as the first argument; `service.js` keeps thin delegating methods and its unchanged `performAction` facade and exports. *Tests:* focused move 14 + member access 12; full server suite; all lanes. *Effect:* behavior-identical; public surface unchanged. *Risk:* none. *Downstream:* `service.js` is ~857 lines and still over the checklist; the remaining link/selection/delete/recovery methods are a recorded carry with a concrete future split plan. **Proposed: accepted (partial split; residual carry recorded).**
- **04D-D5 — Per-member Copy Link renderer entry added (resolves 04C-D5).** *Clause:* SPEC-04 §8 "The same member menu may request `copy_link` for an exact member". *Actual:* `ThreadRail` member entries gain a trailing Copy Link control emitting the canonical exact-member `copy_link` action through `useViewChatHost.handleCopyLinkMember`; the server path already validated member scope. *Tests:* build; chat-surface/chat03 lanes; Electron smoke member menu. *Effect:* exact-member link production is now reachable from the production member menu. *Risk:* low. **Proposed: accepted.**
- **04D-D6 — Portal `src/components/menu/` adoption for the rail member group carried (04C-D6).** *Clause:* routed Frontend UI "New or migrated … nested action menus use the shared menu module". *Reason:* the ThreadRail kebab predates SPEC-04, is asserted by the accepted `threaded-chat-host.spec.ts` portability/render lane, and migrating the whole kebab to the portal module is a broader menu-migration task outside SPEC-04's expected changed areas; the added member entries inherit the existing outside-click/mouse-leave behavior and add no new menu machinery. *Effect:* advisory a11y-parity gap only. *Risk:* low-advisory. *Downstream:* a future menu-migration slice. Recorded in the Chat Menus wiki. **Proposed: accepted (advisory carry).**
- **04D-D7 — Visible Move menu label aligned to SPEC §3.** *Clause:* SPEC §3 "Move Chat to Side Chat"; carried 04A advisory. *Actual:* `ChatAreaHeader` label is now "Move Chat to Side Chat"; the focused specs and Electron smoke selectors were updated consistently. *Effect:* UI copy matches the contract. **Proposed: accepted.**
- **04D-D8 — SPEC-03 stale comment drifts swept.** *Clause:* carried 03D advisories. *Actual:* corrected `captureViewerWorksurfaceAdapter.ts` (the connected `captureTabRecords` lane IS elected into content) and `ViewChatHost.tsx` (it IS mounted into production chrome by `ViewWorksurfaceDock`); also swept stale Secondary references in `panelStore`, `harness`, `MessageList`, `stream-handlers`, `chatScreenshotCapture`, `ChatArea`, and `FileExplorer` comments. *Tests:* build; source lanes. *Effect:* comment-only. **Proposed: accepted.**
- **04D-D9 — `isSecondary` retired from the `ChatSurface` contract.** *Clause:* SPEC-04 §10 dead-rendering removal; accepted SPEC-02 `ChatSurface` contract. *Actual:* `chatSurfaceContract.ts` no longer carries `isSecondary`, and `ChatSurface` always renders the header (behavior-identical: the value was hard-coded `false` in `useLegacyChatHost`). *Tests:* chat-surface lane 49; build. *Effect:* removes the last legacy secondary branch from the portable surface. *Risk:* none. **Proposed: accepted.**
- **04D-D10 — Screenshot owner surface narrowed to `'primary'`.** *Clause:* SPEC-04 §10; the only `'secondary'` owner producer was the retired `useChatArea`. *Actual:* `ScreenshotAttachmentOwner.surface` is now `'primary'` and `isCurrentOwner` checks workspace + current Main thread. *Tests:* build; lanes. *Effect:* behavior-identical for the production Main Chat. **Proposed: accepted.**
- **04D-D11 — Test-only updates: removed the Secondary minimize/restore case; corrected CSS assertion and view-state fixtures.** *Clause:* SPEC-04 §10; GUIDANCE §6. *Actual:* `chat-diagnostic-actions.slice-c.spec.ts` drops its secondary-chat case; `theme-picker-header.spec.ts` drops the removed `.rv-secondary-header-identity` assertion; `file-connected-adoption-ui.spec.ts` fixtures drop `rightSecondary`. No behavior assertion was weakened for a surviving feature. **Proposed: accepted.**
- **04D-D12 — Electron smoke scope: Secondary-absence assertion added.** *Clause:* SPEC-04 §12 "verifies the old Secondary Chat is absent"; 04C-D11 recorded split. *Actual:* the smoke hard-asserts zero legacy Secondary DOM and zero "Open a side chat" menu entry and prints `CHAT_04D_SECONDARY_ABSENT=true`; the model-turn injection limitation from 04C-D11 still holds (frame-level Send/stream/Stop isolation is proven by `side-chat-isolation.spec.ts`). **Proposed: accepted (advisory scope note).**
- **04D-D13 — No new migration; test isolation.** *Clause:* hard constraint "prefer no new migration (head stays 044)". *Actual:* migration head remains `044_thread_group_placement_outbox.js`; 001–043 frozen; no 04D migration. All new/repaired tests use isolated ports/profiles and the throwaway Electron profile/temp workspace. **Proposed: accepted.**

## Changed-path summary and current-byte fingerprint

Whole-SPEC product manifest (79 existing paths; sorted `<sha256><two spaces><path>`), excluding this report, the execution ledger, the Wiki docs, and the preserved unrelated worktree bytes:

```text
MANIFEST = /private/tmp/chat04/final/manifest-product.txt
PRODUCT_DIGEST = 03171a3954972dccf0abe19fbaa1513c12315b78fd4a34c6ab5de976285c24e7
PATHS_SORTED = /private/tmp/chat04/final/paths-sorted.txt (79 paths)
PATHS_SORTED_SHA256 = 6c84b83bf6576d48a99e223d45ce955cb0cfbc685653f039d196d0bfa713e3de
DELETIONS = 6 (legacy Secondary Chat modules + orphaned useChatArea)
DELETIONS_SHA256 = 18ef01f2eed4efd3aeeb212c4a03368dd9cc6ec46d8b065dc2837ff8ac6b260d
spec-04/04a accepted revision: 61295e24740dfe080613ff3520f41d3537724c93e716f879e89e5852d9cef1fb (34 paths)
spec-04/04b accepted revision: 87329751f395307290a22d557ba2f2aeb2aadace4ec1127464a69e8f74a25e53 (38 paths)
spec-04/04c accepted revision: 28c94387bad72823f37aa7594aeca2bc0173f691a02a44caa64832031832d633 (25 paths)
spec-04/04d builder revision: e98dc87b1ade63a79fb04d54321cbaeac3fefd2b46c8cebfca47ffcb0ec17879 (77 paths + 6 deletions)
spec-04/final whole-SPEC revision: PRODUCT_DIGEST above (79 paths + 6 deletions)
```

The 04D builder manifest omitted two behaviour-bearing product paths that the
orchestrator gate reviewer found in the record-identity cross-check
(`fusion-studio-client/src/lib/worksurface/sideChatViews.ts`, which gates the
dockless restart materialization sweep and must stay in lockstep with the
server `chat-capable-views.js`, and the comment-only 04D touch
`fusion-studio-client/src/components/chat/ViewChatHost.tsx`). The final
manifest regenerated all current bytes at 79/79 verified paths; no product
byte changed and every executed check remains valid.

Deletions (04D; recorded as a separate digest):

```text
fusion-studio-client/src/components/SecondaryChat.tsx
fusion-studio-client/src/components/SecondaryHeader.tsx
fusion-studio-client/src/components/SecondaryDockButton.tsx
fusion-studio-client/src/state/slices/secondarySlice.ts
fusion-studio-client/src/lib/secondary-tracker.ts
fusion-studio-client/src/components/chat/useChatArea.ts
```

Every manifest entry was re-hashed against current bytes and verified (79/79 OK). Unrelated bytes preserved and excluded: `M ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json`, `M .../002-file-viewer/state/state.json`, `?? ai/RC-MacAir-15/Captures/031-Remote_Access/`, `?? .../001-Captures/chat-packet-role-handoff-2026-09-14.md`, concurrent Office-chain bytes, `RELEASE-MANIFEST.md`, `SPEC-03-IMPLEMENTATION-REPORT.md`, `CHAT-03-EXECUTION-LEDGER.md`. The execution ledger and this report are excluded by definition.

## Warnings, residual risks, and downstream impact

- **`service.js` size carry (04D-D4):** after the mandated Move/member extraction the file is ~857 lines, still above the routed 400-line checklist. Concrete future plan: extract `copyLink`/`resolveLink`/`viewMarkdown`/`setHarnessSelection` into `link-service.js`/`selection-service.js` and the delete tombstone/recovery helpers into `delete-service.js`, each delegating from the unchanged `performAction` facade. Behavior-identical; no owner decision required.
- **Portal menu carry (04D-D6):** the member submenu is rendered inside the pre-existing ThreadRail kebab, not the portal `components/menu/` module. Advisory a11y-parity only; recorded in the Chat Menus wiki.
- **Electron smoke model-turn scope (04D-D12 / 04C-D11):** the smoke does not inject a real harness model turn (no guaranteed model in a throwaway profile/workspace); frame-level Send/stream/Stop isolation is proven by `side-chat-isolation.spec.ts` plus the accepted `chat-surface-isolation` spec.
- **Member Copy Link reachability (resolves 04C-D5):** the exact-member link is now reachable from the production member menu; URI *resolution* remains server-owned with no production renderer sender (pre-existing since 01C).
- **Dockless-host reachability (04B-D5):** Issues/Agents/Browser have no production in-view Move menu; placement presentation is proven from the durable server lane. Recorded reachability note, unchanged by 04D.
- **Pre-existing baseline-red (02A-D7):** five source/CSS specs, the `prompt-ownership.slice-c` browser case, and 56/59 `working-activity` fixture cases remain pre-existing baseline-red at `5f46d1a`; the 04D lanes measured green are the documented set above.
- **Downstream impact:** no transcript/runtime schema change, no new migration, no Generic Host widening, no `surfaceId` anywhere, `threadId` remains the routing/Provenance identity, and no Fork path returns. Deleting the legacy Secondary removes the last competing Side Chat authority.

## Documentation updated

- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md` — `move_chat_to_side`, `open_member_in_side`, `thread:members`, Move/member/placement semantics, forbidden bypasses, required tests.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md` — `thread:members`/`thread:members:error` messages and the SPEC-04 action family/placement notes.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/007-Structure/PAGE.md` — new server/client modules, retired Secondary paths.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/PAGE.md` — Main/Side Chat and Move behavior, close disposition, label.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/005-Menus_And_Modals/PAGE.md` — member submenu, per-member Copy Link, portal-menu carry.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/PAGE.md` — new specs, isolated commands, Electron smoke.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/001-Identity_And_Persistence/PAGE.md` — `sideChatPlacementId` identity and Move identity preservation.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/006-Runtime_Model/PAGE.md` — SPEC-04 descriptor delivery through the managed-placement lane; placement tables.
- `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections/PAGE.md` — Side Chat placement lane semantics.
- Routed Code Standards: no change required — the Frontend UI standard already names `move_chat_to_side`/"Move Chat to Side Chat"; the shared-menu rule remains the goal with the member-submenu carry recorded in the Chat Menus wiki and the execution ledger.

## Review and lifecycle record

- 04A–04C: each builder-owned gate reached the first materially clean pass (`04A` pass 2/3 CLEAN after an F1 repair; `04B` pass 1 CLEAN; `04C` pass 1 CLEAN), and each orchestrator acceptance reviewer returned CLEAN.
- 04D builder-owned `spec-gate-reviewer` pass 1 (`ses_f5c49cbc2ffeX1cnfdgPkXdNk0`, fresh read-only, pinned GLM 5.3 Flash high effort, no inherited parent conversation) returned **CLEAN** with no material findings. It independently reproduced the candidate identity (`manifest-product.txt` `e98dc87b…879`, 77/77 entries OK; `paths-sorted.txt` `40bc04ab…d56`; `deletions.txt` `18ef01f2…60d`; ABC union ⊆ 04D list with zero silent drops), confirmed migration head `044` and no `surfaceId`/Fork residue, verified the smoke absence assertion is real (not vacuous) and the `service.js` split is behavior-identical behind an unchanged public surface, read every 04D-D1…D13 record as accurate and complete, reran the focused move/member integration (26/26) and a fresh Electron smoke with all nine markers, and confirmed preserved unrelated bytes were untouched. Three non-blocking advisories recorded: `chat-surface-identity.spec.ts` retains `useChatArea` as an inert forbidden-import token; the carried 04D-D4 `service.js` size split and 04D-D6 portal-menu migration remain future work; split behavior-identity is established semantically plus by rerun evidence because the pre-04D bytes are uncommitted/unrecoverable (low residual).
- **Orchestrator 04D acceptance reviewer** `ses_f5c3cf73fffeCsoMiIhQ4pBu6r` (fresh read-only, GLM 5.3 Flash high effort) returned **CLEAN** on product behavior with one material record-level finding (M1, subsuming M2): the 77-path builder manifest omitted `fusion-studio-client/src/lib/worksurface/sideChatViews.ts` and the comment-only 04D touch `fusion-studio-client/src/components/chat/ViewChatHost.tsx`. No product byte was missing or wrong; every executed check remained valid. The orchestrator repaired the record during report finalization: whole-SPEC manifest regenerated at 79/79 paths, digest `03171a39…`, path-list digest `6c84b83b…`, deletions unchanged; the report fingerprint/counts/final statement were updated and the rebuild disclosed above.
- **Orchestrator final-integration reviewer** `ses_f5c32bbf9ffePX9ZH91feEITo9` (fresh read-only, GLM 5.3 Flash high effort) returned **CLEAN** on the corrected 79-path integrated bytes: independently reproduced 79/79 hashes, the 6 absent deletions, path-set closure, the report fingerprint and claims, all §3–§14 criteria, cross-slice identity/lease/recovery contracts, Secondary retirement and no-Fork launch, capability-set lockstep, migrations 001–043 frozen, and reran the full server suite (209/3038/1), build, the §12 e2e set + 04B spec (20), Electron smoke (9 markers incl. `CHAT_04D_SECONDARY_ABSENT=true`), and regression lanes (chat03 46, chat-surface 49, thread-group 7, source 65, component-tab/action-context 142). No material findings; advisories only (recorded in the ledger).
- HEAD remained `5073b10`; no commit, amend, or push was performed; no owner acceptance is claimed. Only fresh spec-slice-builder and spec-gate-reviewer subagents were used across the SPEC; no other agent types.

## Final Statement

**READY FOR INDEPENDENT OWNER-SIDE REVIEW.** The orchestrator does not self-accept. Owner acceptance of this exact current byte set (product digest `03171a3954972dccf0abe19fbaa1513c12315b78fd4a34c6ab5de976285c24e7`, 79 paths + 6 deletions, migration head `044`) is required before SPEC-04 or any downstream consumer is declared complete.
