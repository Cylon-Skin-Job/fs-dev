# Final transport precondition investigation — no supported product repair

Codex side chat (ephemeral), `/root/m3_builder`, accountable to `/root`; read-only investigation completed 2026-10-07T23:29:50.815703+00:00. Assigned write: this report only. Disposition: **NO_SUPPORTED_PRODUCT_REPAIR** on available evidence. The failed final renderer run remains failed; this is neither a waiver nor a final-gate decision.

## Assignment and current bytes

Memory CWD is controller/launchpad/chat-integration-and-retirement; controller_home is `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Implementation checkout was separately verified as `/Users/rccurtrightjr./.codex/worktrees/chat-material-01/fs-dev`, branch `codex/chat-material-01`, HEAD `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`. Applicable approved M3/session/builder/gate boundaries remain in force. All65 current product hashes match sealed `SOURCE-SEAL.json` SHA256 `35cda972a106468eaa279c60da9ef51fc04ec23333f03de4226269b84e14ad07`; zero mismatches. Accepted M1/M2/M3 and their raw history are preserved.

No product, test, helper, Wiki, runtime/profile/database, Git, planning or prior handoff artifact was changed. No build/test/native/app operation, reviewer or other delegation was performed. Root owns unchanged runtime repetitions, repair validation and gates. The only output is this report.

## What the failed run establishes

Final renderer01 executed the exact16-suite command on its owned architecture port51988 with one worker. Receipt/log hashes match. It returned exit1 with268 passed and one failed: `chat-send-transport.spec.ts:416`, “definitely refused prompt keeps the draft and releases only its provisional attempt.” The reported failure is line420 `composer.fill('retain this draft')`, with the initial composer disabled. This is before line421 `setBindingAvailable(false)` and line422 public Send.

The current-page trace has page identity `page@e4a578503950da9a17b2a6fe34c5946a`, frame URL `about:blank`. Snapshot `after@call@9609` shows Capture Alpha/Beta rail rows with exact capture-group/thread IDs, but Main has empty `data-chat-thread-id`, workspace `worksurface-workspace`, view `capture-viewer`, and `rv-chat-area--inactive rv-chat-area--no-thread`. It renders “No thread selected” and a disabled, empty textarea. Fill polling repeatedly observes disabled through the test timeout; the refusal action and its assertions never execute. The trace's current-page API calls are setContent, addScriptTag, fixture-presence wait, mountView evaluate, rail wait, wrapper visibility, and fill; no refusal-toggle evaluate or Send click follows.

The `test.trace` context pairs wallTime1791415157706 with monotonicTime46482.069. Converting its call times yields:

| Call | Operation | UTC start | UTC end |
|---|---|---|---|
| `pw:api@29` | Evaluate | `2026-10-07T23:19:18.014+00:00` | `2026-10-07T23:19:18.017+00:00` |
| `pw:api@30` | Wait for selector | `2026-10-07T23:19:18.017+00:00` | `2026-10-07T23:19:18.024+00:00` |
| `expect@31` | Expect "toBeVisible" | `2026-10-07T23:19:18.025+00:00` | `2026-10-07T23:19:18.026+00:00` |
| `pw:api@32` | Fill "retain this draft" | `2026-10-07T23:19:18.027+00:00` | `2026-10-07T23:19:47.863+00:00` |

Native01 and Wiki01 final receipts begin23:20:01.135930Z and23:20:01.135926Z respectively, after this case's timeout around23:19:47.863Z. Their later overlap with the full renderer lane **does not establish overlap with this failing precondition**, and does not support a load/native/Wiki cause. No scheduling/capability/load attribution is made.

The trace also contains other page/context records for working-activity recovery frames. Those page IDs differ from this current about:blank fixture; they are not evidence that this fixture sent a refusal action or that such traffic disabled its composer. The current fake socket is an in-page object, whose sent/received fixture frames are not ordinary trace-network records.

## Actual fixture and product dependency path

1. `worksurface-harness.ts:496–567` resets controller/store state, seeds Capture Alpha/Beta populations and projectChat slots, explicitly leaves `currentThreadGroupIdByWorkspaceAndView` empty and `wireReadyByThread` empty, then establishes the fixture workspace epoch/revision/init. Seeded rail rows are population evidence, not selected-chat readiness.
2. `:449–480` awaits controlled shell authentication and installs the real product-send capability bound to the fake socket and current workspace binding. `fixtureBindingAvailable` starts true; this failing test does not change it because line421 is unreached. Installation precedes `createRoot/render` in `:612–620` and fixture publication.
3. `:761–762` `mountView` replaces the rendered active view with Capture. `mountHarness:934–953` waits only for `__wsFixture`, invokes this mount, and calls `openDock`. `openDock:964–970` waits for rail attachment and wrapper visibility. It does **not** assert exact selected group, expected Main thread, pending-open completion, hydrated owner or editable composer.
4. `useViewChatHost.ts:75–111` derives selectedRow from the selected group in the exact population, and supplies its thread identity to the session host. Its population-request effect `:124–135` requires an active host and open socket, and sends qualified thread:list through actual product admission.
5. Its MRU effect `:141–161` requires active/open socket, rows, no selected group and a group-bearing MRU row. For an adapter, `requestGroupSelection` owns the transition. `worksurfaceSwitch.ts:114–142` first selection binds the worksurface and calls `selectViewGroup`; `:31–55` sets the exact selected group synchronously before requesting/sending thread:open. Otherwise the host records and sends exact thread:open directly. Fake replies use `replyLater` setTimeout0 (`harness:249,366–379`) and actual message handlers; the fixture does not treat rail paint as response completion.
6. `useChatSessionHost.ts:68–90` hasThread derives from that selected-row thread, with separate wire/harness projection. `ConnectedChatComposer.ts:131–136` passes noThread when no selected thread; `ChatAreaFooter.ts:100` disables input for noThread/inactive/pending/finalizing. The traced no-thread presentation has an expected production guard. There is no source evidence that material insertion or a refusal attempt caused it.

M3's camera callback/commit and response-cleanup paths are not invoked at this failure. The failing test's scenario assertions deliberately depend on the above existing setup/selection path. This report does not assert that MRU ran, failed, or reset: the trace lacks that state/effect evidence.

## Attribution limits and repeat evidence

The exact unchanged case passed alone in root's `transport-focused-01` run: receipt exit0, raw log1 passed, case2.0s, overall5.2s. I verified the raw receipt/log hashes and command, not merely root's summary. This establishes that the unchanged setup and full refusal scenario completed in that repetition. It does not establish the original failure's cause, make the original a pass, or discharge the required full lane.

Root subsequently completed the exact16-suite renderer02 alone with other root-owned test runtimes stopped:23:26:24.823322Z→23:28:36.693423Z, exit0,269 passed (2.2m). I verified its raw receipt/log hashes and command equivalence to renderer01 except the separate owned output path. This renews the required full renderer execution on unchanged source; root owns its acceptance/final-gate decisions. The original renderer01 failure remains failed and unattributed. A passing repetition does not establish why the first setup stalled. Earlier accepted evidence and other final scopes remain preserved.

The failed trace does not include `__wsFixture.sentRaw()`/`store()` snapshots, product-send rejection outcomes, installed capability/current binding/authentication observations, an MRU effect-entry/completion record, or selected-group transitions. Thus it cannot distinguish: an effect that has not progressed; locally refused initial list/open work; a selected-group/read-model mismatch or later reset; or some other setup/runtime cause. These are missing-observation categories, not findings or established causes. In particular, a readiness wait explains why rail visibility is insufficient but does not explain why fill's own enabled polling never progressed for the rest of30seconds.

## Supported next step and affected scope

No acceptance-relevant product defect is established with an attributable execution path and direct evidence; no product repair is supported. Keep source and exact refusal/Send/preservation oracle unchanged. Root's unchanged focused and complete-lane repetitions are the next justified evidence, not a waiver.

If the setup symptom recurs, the smallest useful investigation is a bounded failure snapshot using the existing fixture's sentRaw/store and exact Main DOM identity, plus the setup errors already collected by mountHarness. Correlate group binding/currentGroup, request/capability/init/admission and pending-open results before proposing a repair. Avoid direct store forcing, explicit manual selection as a replacement for expected setup, longer arbitrary deadlines, forced fill or relaxed preservation assertions.

An explicit exact Main-thread/readiness assertion before exercising refusal could improve test diagnosis, but it is **advisory** here: fill already waits for enabled/editable. Such an assertion alone cannot repair the unproven selection/lifecycle cause. It must not silently claim the refusal regression was reached when setup failed. No such change was made or requested for execution by this leaf.

Affected evidence scope is the final renderer release lane and final integrated gate. This failure did not execute prompt refusal/ACK cleanup, material capture/save or database mutation; it supplies no reason to invalidate unaffected fresh build/fullserver/focusedserver/Wiki/native evidence or accepted slice gates. If a later validated product/setup repair is authorized, root must classify its exact dependency scope, renew affected focused/full renderer and any invalidated checks, reseal and assign fresh applicable review. This report grants none of those repairs or approvals.

## Exact raw and source bindings

Raw files below remain unchanged; zip parsing was in memory without extraction or mutation.

| Raw artifact, package-relative | SHA256 |
|---|---|
| `implementation/orchestrator-checks/final-integration-01/renderer-01.json` | `d47c13aec545583c2459e12cf9042d9bf495642bf25a14c3169415e669494059` |
| `implementation/orchestrator-checks/final-integration-01/renderer-01.log` | `adf811ef030dfaa5f06eb09e814894fff57bb361120315bcb515fbb917ec33e5` |
| `implementation/orchestrator-checks/final-integration-01/renderer-01-output/chat-send-transport-defini-34afd-nly-its-provisional-attempt-fixture-only-chromium/error-context.md` | `f23737b5d9e692c9455ffcdd0135fe4819c6445404c110a35fdc442ceea8ad30` |
| `implementation/orchestrator-checks/final-integration-01/renderer-01-output/chat-send-transport-defini-34afd-nly-its-provisional-attempt-fixture-only-chromium/trace.zip` | `aaa1d80308d92def525dbfd15874a2a47b050de27ee99ee24cf79d7b736d8bdc` |
| `implementation/orchestrator-checks/final-integration-01/transport-focused-01.json` | `39bb565b7c9b9881911e8521e2669141823bae4b9dc48f6e74aa29b9ac22f15c` |
| `implementation/orchestrator-checks/final-integration-01/transport-focused-01.log` | `bbf432236ac99e455776dc5861fae0f1214452f95242967a5775ed62f75a5f2e` |
| `implementation/orchestrator-checks/final-integration-01/renderer-02.json` | `ae151f3a27d2cd372b392981618b1f2da9b44956387c5acecfb5477e5f91d165` |
| `implementation/orchestrator-checks/final-integration-01/renderer-02.log` | `1487d41fc6151ab3346645d0cc2823964ee98eb872aa9c8bb7d8b6f6cdbe8834` |

| Inspected source, client-relative | Current SHA256 |
|---|---|
| `e2e/worksurface-harness.ts` | `d46425249cbbbd9bac3b6f4577bcca444db93bfec458d2b2213bb520c9e8bcf2` |
| `e2e/chat-send-transport.spec.ts` | `d87ae7b1394036bea8155ffb3b20bf0f034552fe45eede325270181d90b53a16` |
| `src/components/chat/useViewChatHost.ts` | `9763ce0d749a063236fa94c6a5e7162f5bcc68dc01402141592533bc2436861b` |
| `src/components/chat/useChatSessionHost.ts` | `67060e0790a1052b78ef27aadf24a1029c2753ac481628c8f0973684bdce61bc` |
| `src/components/chat/ConnectedChatComposer.tsx` | `5432630c2dd0876bc69ec2952aa66a985cfea3f4614f2e06563545744747b56e` |
| `src/components/chat/ChatAreaFooter.tsx` | `5a93c1b349d53b8cb773a7062d8e3373a23b68684cdb910c9af05ec0660fb380` |
| `src/lib/worksurface/worksurfaceSwitch.ts` | `eea36d5ebb58c063b3caaff01cc2bcfd80a26318e4353deb1e87e45e6a2c7af6` |
| `src/lib/ws/product-send.ts` | `ff110beb5dcb796c2fd066c57f87359e1f1ca5cfacc1c64ab1864e12fad88502` |

Read-only tools: Git root/branch/HEAD inspection; rg/sed source reads; Python JSON/zip parsing and SHA256 comparisons. All65 source bindings rechecked before this write. No later source write or runtime activity follows this report. Return: **NO_SUPPORTED_PRODUCT_REPAIR; original precondition cause unresolved; root repeat/full-lane/final gates remain authoritative.**
