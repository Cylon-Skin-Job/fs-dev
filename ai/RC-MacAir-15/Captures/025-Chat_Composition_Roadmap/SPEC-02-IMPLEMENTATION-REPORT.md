# SPEC-02 Implementation Report — Composable Chat Surfaces

**Status:** `READY_FOR_INDEPENDENT_OWNER-SIDE_REVIEW` — orchestrator final integration CLEAN; **not owner-accepted**
**Approved candidate:** `CHAT-COMPOSITION-2d34f8b45562f8f3` (owner-approved; overlaid packet)
**SPEC:** `SPEC-02-COMPOSABLE-CHAT-SURFACES.md`
**Implementation baseline (dispatch):** `5f46d1aa15e4ef2866d271c477e895cd2a7fddd0` (commit `5f46d1a feat: thread group foundation (CHAT-01/SPEC-01)`)
**Baseline branch:** `agent/exact-workspace-paths`
**Migration head at dispatch and at completion:** `042_thread_group_action_recovery.js` (no server migration or schema change)
**Orchestrator:** primary session acting as spec orchestrator (owner-appointed, direct run)
**Execution ledger:** `CHAT-02-EXECUTION-LEDGER.md` (slice gates, deviations, lifecycle)

## Accepted prerequisites and authority

- SPEC-01 (CHAT-01) owner-accepted 2026-09-13 and committed `5f46d1a`; product digest `2a4ba090c7d82dc9411057a3495f23b7c10201db3bddf0beb0014b633bae2ce0`; migration head `042`.
- Generic Component Tab Host independently accepted (`D-170`, `GENERIC_COMPONENT_TAB_HOST_ORCHESTRATOR_REPORT.md`; bytes integrated via Tab Platform milestone `22cc435` / owner-released `333d49e`).
- SPEC-00 accepted `7f0d3c8`; BRIDGE-01 owner-accepted `16ccecf`; BRIDGE-02 owner-approved and consumed through `BRIDGE-02-CONFORMANCE-OVERLAY.md`; overlaid `025` candidate owner-approved 2026-09-13.
- Recorded orchestrator interpretations (all reviewed): production composition remains the workspace Legacy host (`viewId:null`) with view-bound `ThreadedChat` introduced as explicit/fixture hosts; `{workspaceId,viewId}` composite population keys incl. explicit Legacy; request ownership by the active host only; non-component hosts mint transient `surfaceId` from their own mount generation and component-backed mounts derive it from `componentInstanceId` + mount generation; Send snapshots the last server-acknowledged `{model,variant}` for the exact `threadId`; all new Playwright lanes run isolated (never port 3001, the dev DB, or Alpha).

## Slice ledger

| Slice | Scope | Accepted revision | State |
|---|---|---|---|
| 02A | Explicit Legacy Main Chat (`ChatSurface` + connected host, `threadId`/`surfaceId` keying, model pending/acknowledgement) | product manifest `3ed2fbf7a17a22e989d03969a356c8c5477824de4ac9abfcac00458558d224ff` (21 paths) | **accepted** (2026-09-13) |
| 02B | View-bound ThreadedChat (`ThreadRail`, composite `{workspaceId,viewId}` populations, request ownership, hidden inactive panels) | product manifest `49abebabac4368ac4b80dcd53707bfd83f71a2720d6ee92ecd3f19afcca2b44e` (38 paths) | **accepted** (2026-09-13) |
| 02C | Concurrent surfaces and component registration (`fusion.chat-surface`, isolation, integration evidence) | product manifest `dae8380a7d4483f54155a3fa6447d3850e5dc7dc469b98576489c5365e33218a` (17 paths) after final comment fix; final whole-SPEC bytes below | **accepted** (2026-09-13); final integration CLEAN |

Every slice used a fresh `spec-slice-builder`; every builder-owned gate and every orchestrator acceptance gate used fresh read-only `spec-gate-reviewer` agents that stopped at the first materially clean pass on current bytes.

## Delivered outcome (whole SPEC)

Fusion Studio's chat and thread-list presentation is now explicitly addressed:

- **Identity contract.** `ChatMountIdentity` (`workspaceId`, nullable `viewId`, `threadGroupId`, `threadId`, `surfaceId`, `host`) is the single mount address. `threadGroupId` owns the visible row/body of work; `threadId` remains the transcript/runtime/routing/Provenance identity; `surfaceId` is transient mounted UI identity minted at mount (non-component host: own runtime mount generation; component-backed: `componentInstanceId` + mount generation) and is never persisted, sent, or carried in descriptors/envelopes/results/fan-out. Missing/malformed context is fail-open.
- **Portable `ChatSurface` + connected hosts.** The Legacy Main Chat is one connected host (`LegacyChatHost`/`useLegacyChatHost`) projecting store state into the portable boundary; the legacy floating Secondary Chat renders outside the identity path with a legacy-local DOM id. Session state (history/live frontier, readiness, usage, model selection, drafts, attachments, warm/turn/error/Todo) is keyed by `threadId`; mounted DOM/menu/focus/connecting state is keyed by `surfaceId`.
- **Model selection.** Composer selection is pending optimistically by exact `threadId`, promoted only by the exact-session `thread:action:completed` acknowledgement, restored on rejection, and hydrated from server-owned `entry.harnessConfig`; Send snapshots the acknowledged value for that `threadId` and never reads a panel-global config.
- **`ThreadRail` + `ThreadedChat` + composite populations.** Group lists and selected groups are keyed by `{workspaceId, viewId}` with an explicit `viewId:null` Legacy population; only the active connected host solicits its qualified `thread:list`/`thread:open`; inactive mounted panels render cached state and cannot request or steal selection; late list/open/usage/action responses cannot fill or mutate another population. Accepted SPEC-01 row actions are preserved, and rename/delete/create acks stay in lockstep with the population read model.
- **`fusion.chat-surface` registration.** One code-owned first-party component type is registered through the accepted Generic Host resolver seam (composed additively into the shell's connected registration lists). Its JSON-safe input carries durable identities only; semantic tuple validation against hydrated authority renders an inert-unavailable body for foreign/stale/unhydrated tuples; valid descriptors mount the real surface with the derived transient `surfaceId`. No launcher, empty-tab, placement, persistence, dedupe, catalog, or production Side Chat descriptor was added, and no Generic Host implementation byte changed.
- **Concurrency.** Two simultaneously mounted explicit surfaces keep Send, stream, Stop, model, usage, readiness, drafts, attachments, Todo, errors, and saved-turn acknowledgements isolated; Stop targets one exact session; shell Chat/Threads visibility and full-screen collapse/expand never clear or reassign identity.

## Required verification results

All commands were run on the final integrated bytes (2026-09-13); the orchestrator reran them independently after each slice and at final integration.

| Command | Result |
|---|---|
| `cd fusion-studio-server && npx jest --runInBand` | **203 suites passed; 2975 passed, 1 skipped, 2976 total** |
| `cd fusion-studio-client && npm run build` | passed (TypeScript + Vite production build; only the pre-existing >500 kB chunk warning) |
| `cd fusion-studio-client && npx playwright test e2e/chat-surface-identity.spec.ts e2e/chat-surface-isolation.spec.ts e2e/threaded-chat-host.spec.ts e2e/chat-component-registration.spec.ts --config=playwright.chat-surface.config.ts` | **49 passed** (10 / 11 / 20 / 8); isolated port 3316, throwaway `/tmp` profile, `reuseExistingServer: false` |
| `cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts` | **65 passed** |
| `cd fusion-studio-client && npx playwright test e2e/thread-group-compatibility.spec.ts --config=playwright.thread-group.config.ts` | **7 passed** (accepted SPEC-01 predecessor lane) |
| `cd fusion-studio-client && npx playwright test component-tab-* component-action-context-source --config=playwright.chat-surface.config.ts` | **142 passed** (Generic Host non-regression) |
| `cd fusion-studio-client && npx playwright test e2e/thread-hover-peek.spec.ts e2e/chat-composer-mode-menu.spec.ts --config=playwright.chat-surface.config.ts` | **2 passed** |
| `cd fusion-studio-client && node e2e/chat-surface-concurrency-smoke.mjs` | `CHAT_SURFACE_CONCURRENCY_SMOKE_OK`; `CHAT_02C_SMOKE_STOP_EXERCISED=true`; `CHAT_02C_SMOKE_STOP_FRAMES=2` |

The focused specs cover the §11 scenario list end to end, including two groups in two views restoring independent selected rows, two mounted sessions interleaving content/thinking/tools/usage/readiness/model selection/drafts/attachments/**Todos**/errors/saved-turn acknowledgements without crossover, single-session Stop, late-response isolation, model pending/ack/rejection/restart hydration, two mounts of one session sharing truth but not DOM/menu/focus, passive open and exact live overlay, hidden Chat/Threads and full-screen preservation, ready/invalid/disabled/unknown descriptor behavior, identity derivation sweeps, and the no-`surfaceId`-outbound guarantees.

**Electron smoke** (`e2e/chat-surface-concurrency-smoke.mjs`): launches the real built app via `_electron` on a throwaway `FUSION_APP_USER_DATA` profile and temp workspace (`FUSION_LOCAL_MACHINE=RC-MacAir-15`; never Alpha/port 3001/dev DB), creates two groups, opens each, Sends a long prompt and Stops each with a hard-asserted exact-`threadId` `turn:stop` and terminalization, toggles Threads and Chat/content independently, enters/exits the full-screen arrangement, and verifies header focus/menu accessibility (Enter opens, Escape closes). Green across five recorded runs (builder ×3, orchestrator ×1, reviewers ×2).

## Deviation ledger (summary)

Full records with clause/actual/reason/files/tests/effect/classification live in `CHAT-02-EXECUTION-LEDGER.md`.

- **02A-D1** workspace-global usage fields retained as a compatibility mirror (per-thread maps authoritative) — accepted; removal when remaining consumers migrate.
- **02A-D2** pending-new-thread connecting state global in 02A — resolved by 02C-D1 (surface-owned).
- **02A-D3** inert panel-global model fallback in `chatSlice.sendMessage` (zero writers) — accepted; delete with Secondary retirement (SPEC-04).
- **02A-D4** `thread:opened` visible-selection correlation gate — accepted.
- **02A-D5/R1** legacy Secondary removed from the `ChatMountIdentity`/`ChatSurface` path (repair) — resolved.
- **02A-D6** no client-invented session default; Send omits `harnessConfig` until acknowledged — accepted.
- **02A-D7** required regression set is pre-existing baseline-red at `5f46d1a` (five source/CSS specs, `prompt-ownership.slice-c` browser case, 56/59 `working-activity` fixture cases), independently reproduced with identical per-test sets — accepted/downstream; owner re-baseline item.
- **02A-D8** `openThreadMarkdown` retains panel navigation (pre-existing) — advisory.
- **02B-D1…D11** production Legacy composition preserved (portable `ThreadRail` via `Sidebar`); explicit `viewId:null` post-bind re-read; dead `ThreadJumpDropdown` + `SidebarThreadList` removed (extraction supersession); hover-peek source-path remap (assertions preserved 1:1); identity-spec A-3/A-5 updates; isolated profile; host generalization; active-panel global-intent gating; qualified Legacy selection mirror; `ThreadedChat.css` token fallback; **02B-D11 (R2 repair)** rename/delete/create population read-model lockstep after the composite migration — accepted.
- **02C-D1…D10** surface-owned connecting state; component `surfaceId` derivation; semantic tuple-invalid inert body; additive registration composition; lazy mount; generation-aware population re-request; create-routing documentation; isolated profile naming; **02C-D9 (R3 repair)** Electron smoke hard-asserts Send→Stop in both groups; wiki updates — accepted.
- **Final M-1/A-1 repair:** §11 Todos interleave coverage added to the isolation spec through the real handler path; stale smoke comment corrected — resolved; fresh final re-review CLEAN.

**Out-of-scope touches:** `CliPickerDropdown.tsx` optional controlled props (02A); test-only changes and deletions listed above; three routed Chat wiki pages updated. No server bytes, migration, protocol, Generic Host implementation, Side Chat placement, creation lifecycle, Collections, plugin, Fork, or Provenance change.

## Changed-path summary and current-byte fingerprint

Final product manifest (43 existing paths; sorted `<sha256><two spaces><path>`), excluding this report, the execution ledger, and the two unrelated preserved paths:

```text
MANIFEST = /tmp/chat02/final/manifest-product-final.txt
PRODUCT_DIGEST = ca7c23e66a0a7d7d4a12447a0da29e2cd4f96d417b35101232bf561669aa6a50
UNION_PATH_LIST = /tmp/chat02/final/union-paths-sorted.txt (46 paths)
UNION_PATH_LIST_SHA256 = 5c8c3de0b6d6d7a357f82d5df1ac44c80e045f4b5f40cbcf22aef70b91099c33
DELETIONS = 3
DELETIONS_SHA256 = b779fab94c69280471f73847af0e94109d03ba07e1ce21c8f5853e05ec079a04
spec-02/02a accepted revision: 3ed2fbf7a17a22e989d03969a356c8c5477824de4ac9abfcac00458558d224ff
spec-02/02b accepted revision: 49abebabac4368ac4b80dcd53707bfd83f71a2720d6ee92ecd3f19afcca2b44e
spec-02/02c accepted revision: dae8380a7d4483f54155a3fa6447d3850e5dc7dc469b98576489c5365e33218a
spec-02/final whole-SPEC revision: PRODUCT_DIGEST above
```

Deletions (3): `fusion-studio-client/src/components/ThreadJumpDropdown.css`, `fusion-studio-client/src/components/ThreadJumpDropdown.tsx`, `fusion-studio-client/src/components/sidebar/SidebarThreadList.tsx`.

Unrelated bytes preserved and excluded: `M ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json`, `?? ai/RC-MacAir-15/Captures/031-Remote_Access/`.

## Warnings, residual risks, and downstream impact

- **Baseline-red regression set (02A-D7):** the five source/CSS specs, the `prompt-ownership.slice-c` browser case, and 56/59 `working-activity` fixture cases fail identically at clean baseline `5f46d1a` and on SPEC-02 bytes. They are pre-existing SPEC-01-era drift, not SPEC-02 regressions, and remain a documented owner re-baseline decision.
- **Compatibility mirrors:** workspace-global `contextUsage`/`tokenUsage`/`wireReady` and the global `connectingHarnessId` mirror remain only for pre-SPEC-02 consumers/Secondary; per-`threadId`/per-`surfaceId` state is authoritative. The inert `composerModelConfig[currentPanel]` fallback has zero callers and is reserved for deletion with Secondary retirement.
- **Electron smoke determinism:** the smoke hard-asserts Stop against a real provider turn; a pathologically fast completion or harness failure now fails the smoke loudly. Five consecutive recorded greens; residual nondeterminism noted.
- **View-bound production chrome:** `ViewChatHost`/`ThreadedChat` are proven through explicit hosts and rendered fixtures; production view chrome placement (and the rail's dock callback) belongs to later work (SPEC-03 consumption / SPEC-04 Side Chat).
- **Downstream impact:** SPEC-03 — `none` (bytes integration-clean; overlay present). SPEC-04 — `compatible deviation`: delete the inert panel-global model fallback with Secondary retirement; watch the latent create-routing note (`addThreadToPopulations` via `entry.viewId`); the future component-backed Side Chat must derive `surfaceId` from `componentInstanceId` + mount generation and must not inherit the legacy Secondary's singleton behavior. `resolve_link` remains without a client entry point (accepted 01C-D5).

## Documentation updated

- `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/006-Runtime_Model/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/007-Structure/PAGE.md`

## Review and lifecycle record

- 02A: builder `ses_f6349f4f4ffe4bBs5yoC8rVTOb`; builder gates CLEAN (pass 1 + R1 repair pass 2); orchestrator acceptance reviewer `ses_f62de6e94ffeuTcfPgR3hpZHZh` CLEAN.
- 02B: builder `ses_f62d6ed2cffeaT3vnbb2YbbVYN`; builder gates CLEAN (pass 1 + R2 repair pass 2 `ses_f62af34a1ffe7K2qR3CT7Usw4G`); orchestrator acceptance reviewer `ses_f62ab2acfffeBJhWK28WNOFmDQ` CLEAN.
- 02C: builder `ses_f62a235bcffe4RImMyx9NfyJ8u`; builder gates CLEAN (pass 1 + R3 repair `ses_f62749aebffeJGM1LGyKaXG3k8` + comment fix `ses_f62650482ffeqRjjVUlB5o32Oz`); orchestrator acceptance reviewer `ses_f6271197bffex2r1pEqlHRoAqJ` CLEAN.
- Final integration: first whole-SPEC reviewer found M-1 (Todos coverage) + A-1; repaired and independently verified; fresh final reviewer `ses_f6252dc5fffep44pk8ZDqBmous` CLEAN on final bytes.
- Orchestrator-ordered repairs across the SPEC: R1 (Secondary `side-tab` conformance), R2 (population read-model lockstep), R3 (Electron smoke Stop), M-1/A-1 (Todos coverage + comment), plus the 02C comment-only fix. No finding was left unclassified.
- HEAD remained `5f46d1aa15e4ef2866d271c477e895cd2a7fddd0`; no commit, amend, or push was performed; no owner acceptance is claimed.

## Final Statement

**READY FOR INDEPENDENT OWNER-SIDE REVIEW.** The orchestrator does not self-accept. Owner acceptance of this exact current byte set (product digest `ca7c23e66a0a7d7d4a12447a0da29e2cd4f96d417b35101232bf561669aa6a50`, 43 paths + 3 deletions, migration head `042`) is required before SPEC-03 or any downstream consumer begins.
