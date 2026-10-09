# Verification and evidence renewal investigation

> CHAT-MATERIAL-PLAN-01 revision 1, candidate stage. Codex side chat (ephemeral), `/root/chat_material_candidate_stage/verification_investigator`, 2026-10-07T09:37:02Z. Authored/provisional investigation; independent worker-handoff review and manager acceptance remain pending.

## Answer and planning consequence

**Answered within the assigned source boundary.** Existing tests can be extended to observe the owner-required behavior through the real action consumer, connected composers, menus and view/placement owners. Their current screenshot expectations do not cover the new contract: global resolution selects Main, and several screenshot tests deliberately cancel a retained composer solely because another view gains focus. Renew those expectations and add active Side/global/no-chat and delayed source-preparation cases. Preserve the completed build's acceptance and receipts as historical evidence; do not reopen its gates.

Use one shared destination/insertion owner over the existing `chat-action.ts` / `chat-action-controller.ts` and `chatComposerDraftStore.ts` / `chatFileLinkStore.ts`. Tests must verify callers reach it. Helper-only success or mocking the consumer being changed cannot establish routing closure. Source-specific preparation remains observable separately, especially native capture/save, clipboard value fetch, recent-file response and any included prompt resolution.

The current source matches all **832** file/hash/mode or absence bindings in the completed integration's `unaffected-evidence-dependencies.json`. This is a read-only equality check, not a new server, provider or Electron test. It makes dependency-bound retention possible at this baseline; later implementation must compare its actual changed dependencies again.

## Identity, operations and ownership

Manager: `/root/chat_material_candidate_stage`. Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Actual memory CWD: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`. Separate source checkout: `/Users/rccurtrightjr./projects/fs-dev`, verified root, branch `main`, HEAD `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`. Runtime identity is a child path, not a persistent-task UUID or the registered Launchpad main identity. No model/effort override was selected.

Sole write ownership is this report. Root/source/memory/Wiki AGENTS, session and investigation contracts, shared planning contract, planning-stage procedure, `PLANNING.md` and `OWNER-REQUEST.md` were read. No agent was dispatched. No build, test, app, provider, database, Git mutation, runtime change, central record or checkpoint operation ran. Checks actually performed were source reads/searches, Git root/HEAD/status and scoped diff inspection, JSON inspection and SHA-256/mode comparison. The actual runtime supplied unrestricted filesystem execution; successful reads confirm source access. Node/npm/Python resolve to `/opt/homebrew/bin/node`, `/opt/homebrew/bin/npm`, `/usr/bin/python3`; this does not establish native app/test readiness or execution authority. The owner's “Don't build” remains in force.

Initial/final scoped product diffs under inspected client source/e2e/package/config and server lib/test/package paths were empty, and the staged index had no paths. Unrelated dirty runtime/config/theme state, Wiki audit/restart article, Launchpad records/AGENTS and restart support were observed and preserved. The current uncommitted restart support/article is a separate coherent pending unit described by the completed-build handoff; it is not implicitly accepted by this planning assignment.

## Authority and observed source seams

The current owner request governs **global active open Main or Side at click**, **composer's own destination**, **snapshot before preparation**, **revalidate before insertion**, **cancel genuine owner/lifetime/validity loss**, and **compose-only default with no auto-send/create**. Focus in another view/chat alone is not destination invalidation. Earlier Main-only/Legacy fallback and hidden-view cancellation claims are observations of old behavior, superseded for this new work's affected scope.

| Observed owner/seam | Evidence and verification consequence |
| --- | --- |
| `captureChatActionAddress()` / `dispatchChatAction()` | `src/lib/chat-action.ts` resolves a selected group row in the source/current view and freezes its Main `threadId`. It does not resolve the selected Side placement. `dispatchChatAction` captures at its invocation, so a caller invoking it only after preparation must capture earlier. Test global Main and Side resolution with stale/null Legacy identity and a source resource in a different view. |
| Existing app-lifetime consumer | `chat-action-controller.ts` validates a qualified row or exact member, writes existing draft/attachment stores and separates insertion from send. It accepts explicit Side member addresses; current insert branches do not check `request.signal` or composer mount lifetime. Test the actual listener, once-only insertion, stale lifecycle and no-target outcomes. Preserve existing pending/unknown submission policy and server acceptance. |
| Send path button | `SendToChatButton.tsx` prepares through `resource-path.ts`, then sends `target: current`, `delivery: insert`, `sourceViewId: panel`. Source resource identity must remain independent of global destination identity. Render/click the button while a different chat is active; a direct controller call is insufficient for this seam. |
| Composer plus menu | `ChatComposerAddMenu.tsx` has capture, gallery, Clipboard and Edits actions. Current capture has a separate screenshot owner; gallery/text callbacks use session actions. Tests must click every action family and prove one shared validation/insertion boundary, keeping menu close from being mistaken for composer closure. |
| Delayed source preparation | `ClipboardTrigger.handleSelect` awaits `fetchEntryValue`; top-ranked insertion first awaits `listPage`. `RecentFilesTrigger.handleInsertMostRecent` awaits `recent_files_response`; ordinary selected recent rows already have their paths. `ScreenshotsTrigger.handleSelect` prepares a saved-path attachment synchronously. Snapshot at each material action's click, before its first relevant await; do not snapshot only in a callback reached after preparation. |
| Current screenshot path | `chatScreenshotCapture.ts` snapshots capture owner/socket, awaits native capture and request-correlated save, then directly adds an attachment. Its `currentPrimaryOwner` resolves Main/Legacy; `isCurrentOwner` tests `currentPanel`. `ConnectedChatComposer` additionally invalidates a mount token on `screenshotViewActive`/`isActive`. Renew focus-only tests while retaining real address change/unmount/placement-close protection. |
| Side selection and open validity | `useSideChatRailAdapter.ts` reads existing worksurface binding, selected group and active Side placement; focusing a native tab clears that placement. Open placements come from the existing pure placement reader. These source facts are usable inputs to the shared resolver; they are not proof that every open placement is the active global destination. Tests must exercise the real rail/tab selection path and rejected stale/closed placements. |
| Session stores | Drafts and attachments key by exact `workspaceId + threadId`; attachment generations protect newly readded IDs during acceptance. Do not introduce another material/draft store. Verify all non-target keys remain unchanged and duplicate mounts share session data while retaining independent lifetime tokens. |
| Text insertion and transient refs | `ChatInput.insertText` reads the current textarea value/selection, replaces the selected range, then invokes `onDraftChange` and schedules focus/caret restoration; `appendText` uses a double-newline separator. `useChatMountInteractions` keeps stable callbacks forwarding to `inputRef.current`. An old deferred callback can therefore reach a replacement composer after same-instance reuse. Preserve source insertion/append semantics while moving authoritative writes into the shared owner, use current same-owner draft content at application time, and guard any presentation/focus callback by the original mount token. |

### SystemViewer visible action classification

`src/components/SystemViewer.tsx` has **New Workspace → source/name form → Create**, calling `createWorkspaceViaSystemAgent`. This inspected component has no visible **Send to Chat** or **Ask AI** label. Its request is `promptId: workspace-manager.workspace-creation`, `target: new`, `delivery: insert`, `sourceViewId: system-viewer`. The existing creation consumer waits for `prompt:resolved`, issues `thread:open-assistant`, opens the created chat and writes its draft. Thus `delivery: insert` alone does not imply compose-only or no-create.

The candidate must classify this visible intent explicitly. An ordinary material-add must not be exempted because legacy flags happen to say `new` or use a prompt; if included as material insertion, snapshot the existing destination before `prompt:resolve`, use shared insertion on resolution, and assert no `thread:open-assistant`/prompt frame. A bounded exclusion for the distinct pre-existing workspace command must cite its visible Create workflow and preserve it separately; it must not claim a future controller mode was implemented. Manager/author must reconcile that classification with the owner request. No additional broad System inventory was performed.

`e2e/system-viewer-action-outcome.spec.ts` contains **System Create reports an unrequested cancellation and keeps its exact draft target available** and **System Create reports an exact server denial without claiming creation**. It substitutes the chat-action event consumer, so it proves notices/form retention only. It cannot prove the real shared insertion route or no-create semantics. Add real-consumer delayed-resolution/no-target coverage if this action is included; preserve separate outcome checks if it is excluded with evidence.

## Current test owners and useful existing cases

Paths in this section are relative to `fusion-studio-client/` unless specified. Cases were inspected as source; no current run is claimed.

| Current test owner | Exact cases / useful coverage and limit |
| --- | --- |
| `e2e/chat-architecture/observation-boundaries.spec.ts` | **R5 current action owner inserts once across duplicate mounts and reports send pending**; **R5 unknown attempt permits exact insert and attachment while blocking resend**. Uses real action consumer and stores; explicit addresses survive selecting another panel. Extend shared destination/lifetime coverage here or a cohesive new material-route suite; these existing cases alone do not exercise global resolution or real source buttons. |
| `e2e/threaded-chat-host.spec.ts` | **New Chat composer screenshot uses its exact view owner with Legacy ${legacyThreadId}**; **header screenshot resolves qualified New Chat with Legacy ${legacyThreadId}**; **Side composer screenshot preserves its placement owner when Main selection changes**; **an explicit Main component screenshot uses its hydrated session independently of the rail**. Real rendered composers and connected lifecycle; capture/save are controlled external dependencies. |
| Same owner, cancellation cases | **composer screenshot cancels on actual ${change} owner change during ${phase}**, changes `thread`, `workspace`, `view`, `inactive`, `unmount`; **Side composer screenshot cancels ${change} during ${phase}**, changes `placement-close`, `unmount`. Retain concrete identity/closure/invalidity cases at both `capture` and `save`; classify each state change by what actually happened to the original composer. A label such as inactive is not evidence of identity loss. |
| Same owner, superseded expectations | **qualified header screenshot cancels owning view switch during ${phase}** and **retained ${host} component screenshot cancels active panel switch during ${phase}${returnsToView ? ' even after return' : ''}**, hosts Main/Side, capture/save, with/without return. Retained-component cases explicitly preserve `surfaceId` and open placement through actual `WorkspacePanel → ContentArea → ViewTabBar → resolver` composition. Replace focus-only cancellation with successful insertion to the original still-valid open target; add separate genuine closure/remount negatives. **header screenshot retains the actual Legacy fallback when qualified Main is unavailable** must not authorize stale/global Main-only targeting. |
| `e2e/prompt-ownership.slice-c.spec.ts` | **Slice C: direct screenshot attaches only the path acknowledged for its request ID**; **qualified screenshot guards reject arbitrary requested sessions and stale mounts before capture**; **Slice C: deferred screenshot cancels when its workspace and thread owner changes**. Extend to concurrent/out-of-order ACKs and shared-controller revalidation. Other exact-owner cases include **Slice C: identical attachment IDs remain isolated by workspace and thread owner** and **correlated message:sent commits once; unmatched, deleted and foreign ownership cannot recreate state**. |
| `e2e/chat-composer-screenshot-menu.spec.ts` | **composer screenshot menu preserves split capture and gallery controls** checks visible menu layout and source wiring. Its exact string assertions reference the old screenshot call; update to shared ownership without dropping public control/layout assertions. It does not prove every delayed plus-menu callback. |
| `e2e/chat-surface-isolation.spec.ts` / `chat-surface-identity.spec.ts` | **drafts and attachments remain per workspace/thread owner stores and never cross surfaces**; **ACK cleanup preserves a stable-ID attachment removed and readded while pending**; **duplicate mounts preserve exact draft input semantics while other sessions stay isolated**; **opening a menu on surface A leaves surface B DOM/menu/focus untouched**; **two mounts of one session share session truth but keep DOM/menu/focus state separate**; **surfaceId is minted at mount, never persisted, and collapse/expand preserves it**. Useful regression constraints for the reused owners; transient identity must not enter persistence/protocol. |
| `e2e/chat-send-transport.spec.ts` | **SEND-01–13 share production serialization and socket admission; sources have no raw chat send**; **SEND-03 Stop and SEND-06 passive component history use the installed product lane**; **synchronous native-send ACK keeps the prompt attempt and Stop terminal state exact**. Retain explicit send/acceptance behavior; default material addition must emit no prompt/creation frames. |
| Server: `test/screenshot-file-capture-request-id.test.js` | **echoes requestId when rejecting an invalid capture request**; **saves the direct capture and echoes its requestId without folder services**. Real temporary file readback, domain handler entry, correlation and no retired refresh handler. |
| Server: `test/screenshot-protected-view-path.test.js` | **public file capture denies a symlink alias before writing generated bytes**; **ordinary direct screenshot capture remains functional and correlated**; **public file capture denies a broken final symlink into a protected tree**. Retain if save/protected-path dependencies remain unchanged. |
| Electron: `electron/ipc/screenshot-handlers.test.cjs` | **screenshot listing returns saved file paths while reads provide preview bytes**. Preserves gallery prepared path versus preview bytes. It does not exercise real native capture or destination routing. |

Within the searched `fusion-studio-client/e2e/**/*.spec.ts` action/capture references, no complete rendered global active-Side/no-chat plus delayed Clipboard/Edits lifetime matrix was found. This is a bounded negative finding, not a claim that no other tests exist anywhere.

## Necessary acceptance matrix for later implementation

These are proposed check IDs, not passes. A new cohesive `e2e/chat-material-insertion.spec.ts` is a recommended test owner for the shared entry-point matrix; the author may extend existing owners instead if real caller coverage and responsibility remain clear.

| ID | Required observable scenario and pass criterion |
| --- | --- |
| MAT-GLOBAL-MAIN | Click a real global Send to Chat and global camera with Main active/open. Destination tuple equals click-time owner; resource panel/path remains source-owned. Non-target view/session drafts and attachments are unchanged. Repeat with null/stale/foreign Legacy `currentThreadId`. |
| MAT-GLOBAL-SIDE | Select an open Side through the actual native-adapted rail, then an adapterless rail. Global Send to Chat and camera target that Side even when Main exists and source material is in another view. Selecting native/Main subsequently resolves Main for a *new* action, while an earlier pending action retains Side. |
| MAT-NO-TARGET | No valid active open chat, stale/closed active placement, removed group/member, or unresolved/invalid destination returns truthful unavailable/cancelled result. No fallback into a different view/Main/Legacy, no draft/attachment mutation, no new chat and no prompt. |
| MAT-COMPOSER | In Main, explicit Main component and Side, click every plus-menu action family: capture, saved-image selection, clipboard row/top item, recent-file row/most-recent. Each targets its invoking composer even if another chat/view has focus. Normal menu close after selection does not cancel an action. |
| MAT-DELAY-FOCUS | Suspend capture; separately suspend save ACK, Clipboard value/list response and recent-file response. Change focus to another chat/view while original destination stays valid and composer retains identity/open placement. Finish preparation: exactly the original owner changes once. Run for global and composer actions and leave/return. Do not rely on a fake lifecycle that equates focus to unmount. |
| MAT-LIFETIME | At each delayed boundary, actually change invoking composer's workspace/view/group/thread tuple or mount generation, unmount it, close its placement or remove its destination. Completion cancels and mutates neither original nor replacement/sibling. Close/remount or address-away/return must not revive the old token, even with identical durable IDs. A changed unrelated rail row/group alone does not invalidate an explicit still-open session. |
| MAT-CORRELATION | Two captures with distinct request IDs finish out of order; inject unrelated success/error, duplicate ACK and wrong saved path on wrong request. Each request uses only its own matching saved path and exact owner, once. Timeout/socket close/error gives no attachment or false success. Saved PNG may remain in gallery when cancellation occurs after saving began. |
| MAT-STORE-ISOLATION | Existing nonempty draft receives prepared text once under exact owner/revision with the source's established insertion/append semantics; attachment uses existing identity/dedupe/generation semantics. Same-session duplicate mounts share session data without double listener/application; other threads/views/workspaces are unchanged. Lifetime cancellation remains per invoking mount. |
| MAT-TEXT-REF | Through the rendered Clipboard/Edits menus and real connected input, test insertion into a nonempty draft at a caret and selected range, double-newline append where that source uses append, empty draft, and same-owner typing while preparation waits. Preserve latest draft edits and intended remainder; destination snapshot must not become a stale full-draft overwrite. Capture a callback before await, actually reuse the same component/input ref for another owner, then complete: neither replacement text nor focus changes. Valid originating focus/caret restoration stays local to that mount and cannot mutate another view's selection. Source-string checks supplement this public behavior test. |
| MAT-DEFAULT | Every ordinary material-add route results only in draft/attachment addition. Capture outgoing frames: zero `prompt`, `thread:create` or `thread:open-assistant` caused by insertion. Transcript/exchanges do not gain a user bubble. Existing explicit New Chat/send commands stay distinguishable by visible intent. |
| MAT-ACCEPTANCE | A subsequent explicit Send uses exact target `threadId`, existing attachment path/metadata/provenance, and server `message:sent` acceptance. Verify exact revision/generation cleanup and non-target preservation with current ownership/transport regression cases. No optimistic acceptance is introduced. |
| MAT-SYSTEM | Apply the SystemViewer classification above. If ordinary material-add is included, delayed prompt resolution also uses click-time shared compose-only insertion, ignores unrelated resolution, cancels genuine origin loss and never creates/sends. Existing consumer-replacement outcome tests are insufficient for that positive route. |

Genuine destination invalidity must be demonstrated against the owning state and placement/mount identity, not inferred from `currentPanel`, global `currentThreadId`, source panel or another surface's focus. If the final implementation introduces a single action mutating several stores, the Testing standard's injected second-store failure and deterministic recovery coverage additionally applies; current text-only or attachment-only branches do not justify inventing a combined material mode.

## Proposed commands and native smoke

All commands below are **for a later authorized implementation**, from the stated CWD. No commands in this section ran during planning. The renderer package has no `npm test` script. Its build runs preload generation, TypeScript and Vite. Server `npm test` has a `pretest` native-observer build; direct focused Jest avoids implicitly claiming that native pretest ran.

From `/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client` (substitute the later assigned implementation checkout):

```sh
npm run build
CHAT_TRANSPORT_TEST_PORT=43793 npx --no-install playwright test --config=playwright.chat-architecture.config.ts e2e/threaded-chat-host.spec.ts e2e/prompt-ownership.slice-c.spec.ts -g screenshot
CHAT_TRANSPORT_TEST_PORT=43794 npx --no-install playwright test --config=playwright.chat-architecture.config.ts e2e/chat-material-insertion.spec.ts e2e/chat-architecture/observation-boundaries.spec.ts e2e/chat-composer-screenshot-menu.spec.ts e2e/threaded-chat-host.spec.ts e2e/prompt-ownership.slice-c.spec.ts e2e/chat-send-transport.spec.ts e2e/chat-surface-isolation.spec.ts e2e/chat-surface-identity.spec.ts e2e/chat-component-registration.spec.ts e2e/side-chat-isolation.spec.ts e2e/side-chat-adapterless-native.spec.ts e2e/side-chat-placement-recovery.spec.ts e2e/move-chat-to-side-chat.spec.ts e2e/system-viewer-action-outcome.spec.ts
node --test electron/ipc/screenshot-handlers.test.cjs
```

The second command renews the historical focused lane; the third is the proposed affected shared-route/regression lane and includes a **not-yet-authored** test file. Use actually free job-owned ports and report exact later invocations/output directories. Architecture config rejects port 3001, uses one worker/retries zero and `reuseExistingServer: false`, and excludes the real app-boot case. It serves a fixture lane, not native-shell proof. The default `playwright.config.ts` reuses live 3001 and must not be selected accidentally for this unattended assignment. `playwright.source.config.ts` enumerates unrelated source suites, so it does not automatically select a new material test.

From `/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server`:

```sh
npx --no-install jest test/screenshot-file-capture-request-id.test.js test/screenshot-protected-view-path.test.js --runInBand
```

Run that focused save/protection lane when its dependencies change or fresh route integration requires it; otherwise retain exact unchanged server evidence with dependency proof. Broaden to `npm test` only for new shared server/protocol/persistence/native dependencies or unexplained failures. Do not repeat the completed 221-suite run merely to manufacture a new pass label.

A later native smoke must launch the actual freshly built candidate with a fresh isolated profile/workspace and real Electron capture/preload/server save. `e2e/side-chat-electron-smoke.mjs` supplies existing Main/Side placement/relaunch isolation mechanics, but currently covers Move/close/reopen, not shared material insertion. Its current command is `node e2e/side-chat-electron-smoke.mjs`; passing it alone cannot satisfy this new native gate. Recommend a dedicated implementation-owned `e2e/chat-material-electron-smoke.mjs`, invoked as `node e2e/chat-material-electron-smoke.mjs`, that reuses the established isolated launch pattern and records the matrix's native subset. This is a proposed file/command, not an existing runner or executed check.

Native pass criteria: identity-bound checkout/build/profile/machine/main/server/renderer and sustained connected state after workspace initialization; one Main and one open Side in native-adapted and adapterless views; real global and composer controls add to the intended owner; native PNG exists with PNG signature/dimensions/hash; real sent/received request IDs agree and acknowledged saved path equals attachment path; no new thread or prompt caused by addition; no sibling draft/attachment changes. Focus-survival and genuine closure cases should be covered by deterministic renderer tests at each await, with at least the normal Main/Side destination routes and actual capture/save exercised natively. No interception, `capturePage` stub or direct store mutation may count as native capture proof. Readback of saved PNG proves capture durability; drafts/attachments remain transient owner stores and must not be silently given a new restart-persistence requirement.

The old job's `runtime-chat-smoke.cjs` records actual native capture, but hardcodes its private candidate and only Main capture routes. Do not replay it against the owner's running apps or treat it as the new Side/focus gate. No Alpha operation, live app restart, provider prompts, 45-minute soak or old acceptance replay is necessary merely to prepare this candidate; any later operation needs its own authorized assignment and scope.

## Proportional evidence invalidation and reuse

| Evidence | Retainable meaning / required renewal |
| --- | --- |
| Owner accepted retirement/startup SPECs, original ledgers and October 7 publication/Alpha receipts | Preserve unchanged as completed historical work. The new scope does not revoke old acceptance, change the commit or repeat publication/deployment. |
| Screenshot handoff 02 and old Main/Legacy/hidden-view conclusions | Historical proof of the reviewed old behavior remains. They do not approve global active Side or focus survival. Renew affected source, tests and independent review against new owner authority. Original SCR-D dispositions remain attributable; document the new supersession instead of rewriting them. |
| 34 focused screenshot tests / 106 cumulative renderer tests / old client build | Preserve raw logs and hashes. Changes to action bridge/consumer/callers/composer lifetime/store boundaries/config/fixtures invalidate their *current coverage claims* for those changed paths. Renew affected lanes/current build; retain independent unrelated cases only with an explicit dependency/coverage map. Never label the old aggregate 106 result as a new whole-renderer pass. |
| Current whole-candidate final review pass 02 | Its clean verdict belongs to tree `1c80f83c6c4b2b61e42c4dbb988c1f942b672ade`. New product changes require fresh affected independent review plus the appropriate assembled integration gate. Retain unchanged lenses and sources only with named exact dependencies; old CLEAN is not new-candidate acceptance. Planning worker/stage/release gates likewise remain distinct from later product review. |
| 19 focused server suites/186 passes, 221 suites/3,265 passes/one existing Kimi TODO skip, guarded startup/provenance lanes | 832 dependency rows currently match exact hashes/modes/absences. Retain original test scope if subsequent implementation preserves those dependencies, including protocols, package/native sources and relevant fixtures. Changes to screenshot saving, request envelopes, server validation/persistence or Electron IPC require affected renewal; root dependency map must account for crossings, not just file names. |
| Accepted public OpenCode two usable chats/three completed persisted exchanges/passive reopen | Historical provider/persistence proof survives unchanged provider/server dependencies. It does not prove new shared renderer insertion, native screenshot destination or current runtime health. No automatic broader harness assignment or provider replay follows. |
| `runtime-acceptance.json`: two chats, three native captures, six rendered Wiki pages | Preserve the dated actual-native receipt, stopped private instance and stated no-new-provider limit. It covers Main composer/header capture, not global Side/delayed focus/lifecycle. A changed built renderer/capture route needs a fresh actual-native affected smoke, not reused images as new proof. |
| Composer/Screenshot Wiki handoffs and rendered affected pages | Preserve complete preimages and historical checks. Revise current Main-only/global fallback and focus-based cancellation prose after implementation; renew source/metadata/link and affected rendering review. Unchanged watcher retirement/gallery/privacy/workspace-preview descriptions may be retained with exact source evidence. |
| October 7 development/Alpha restart health receipts and remaining limitations | Dated identity/connection/deployment observations remain historical. They are not present runtime checks and do not establish new material behavior. DB-byte equality and prior interrupted protection comparison remain unproved, background-write causation remains inference, and the waived soak remains unperformed. No new gate retroactively repairs those facts. |

Retain/recheck recipe for the later owner: enumerate each changed source and every affected caller/test/config/fixture/store/protocol/native/Wiki dependency; bind old claim to old inputs and new claim to current inputs; preserve original results; run only affected checks or explain exact unaffected equality; assign fresh independent affected review, then reconcile whole-gate coverage on current candidate bytes. A changed test expectation must be justified by current owner authority and strengthen the new observable rule, not simply erase a failing assertion.

## Fingerprints and reading limits

Observation time: 2026-10-07T09:37:02Z. Product paths below are relative to the source root. All inspected product/test/config paths were clean at the assigned HEAD. The unhashed wider inventories were bounded searches; the author still owns comprehensive entry-point tracing. These fingerprints are report provenance, not a candidate manifest. Mutable `PLANNING.md` may change under its owner without changing the original product authority; recheck any material assignment change before incorporating this report.

| Source | SHA-256 |
| --- | --- |
| Output `OWNER-REQUEST.md` | `71dd8441f4ee79f9c0688ec335de0a553d9dfd6f4a6b2b60a93d8f222a529c1d` |
| Output `PLANNING.md` | `d43a9a2844620ccbef7193c14d3196a8c8ba695f5d2910f0d969789c1d946337` |
| Controller `session-contract.md` | `d82d5a815a94f8c27b64d1d90aa0085790e3d98408c011e86d6126dd1bd9b570` |
| Controller `investigation-contract.md` | `908f7f438b1ea06636d43f10527b7500b97e19a517d68445e0d3bc41d4d60a26` |
| Controller shared planning contract | `ce471fe594051c7c375c1f371c0ebe4af18b65639f740ad3d95c918a70b9e5ad` |
| Controller planning-stage skill | `fbef99148a1b863543dd85ccdc6a3a115808232534a282c670a001b56e147de5` |
| Completed-build handoff | `a4b4895940f72e3352446770625023e7c925a1369fb5f611dd03b478d742ee89` |
| Old job screenshot handoff 02 | `edf0de56770b2c2fa85ef69406dc03bfdb4c9c3ad1b23311fcf7ed94b60e7e3e` |
| Old job screenshot checks | `64c2fd4cbce7eb44680bf777559fd82a3dc8620776713e662d9fdb522feefac7` |
| Old job final-review pass 02 | `383600a1238b1318dac82e12f65f1843589b14d84da43f3c990735020ea7dd5d` |
| Old job retention/invalidations | `208458f8203d5182130fcd2ef204b457f4cc919956a7d2455e5da5bfd0c79594` |
| Old job 832-dependency receipt | `9ffa19551b86394fd8e9863fae19bff42762ed2381de2f604660e0f7b5febd6a` |
| Old job runtime acceptance | `2647fa5fcc0138ceae761fa5e0b1c6d850cd3e5284185ff0afb8d244e2b60b58` |
| Old job runtime-chat-smoke script | `5bd39cb11ddaf1d96d6cf7ebfdfca882a8f2e74487be92893d197b1dff9417fd` |
| Wiki User Preferences | `45fa9f630563d79935d5a461b308c823c0db3ded5c23817ba6d4c8a06c794ed5` |
| Wiki Code Standards hub | `de3995c68ae84f3b0fa389c6af0327e21dd08f30ac9ffbc7548b76f80ac393d7` |
| Wiki Architecture Routing | `4c5fcbf62912c9e8ff6d3d0e1ec07016145e1f1c90c792a162dfcc3ca1b0bfba` |
| Wiki Frontend UI | `18a093c333a610ec8d2c77661b29744f1fae6e9ca8f4e113148fee10a0d9fc18` |
| Wiki State Management | `2b4e55ed7580659b35a91d13f5a7b781960c659868027dd8b6ea6f79e609b105` |
| Wiki Testing/Smoke Slices | `e7319750bd27b7ccdad8e5e451b9779044e8fc7a713fc6d461113b409b39018d` |
| Wiki Chat Overview | `696afb2d3ec027256e783957c3461eb03300db0b97b34b3e62162977c22ed42f` |
| Wiki Composer | `6c5c3847270c0bef52f0e858216f54d602472a9400cddcf2c97a39c5d15e437e` |
| Wiki Screenshot Capture | `57b85d4acc3034dbc2a64fec9994effa98386419d41bcd6dcc526fbcd6a96d18` |
| Client package | `9b9e9c906358afd17eb5027af187fbe2030c537a9536d6d0d6fbcf64fb70dfb0` |
| Architecture Playwright config | `cb9e918351eac456daabdf02bd2eb41ead52e7c42824a43a34add4cd0a9c0be6` |
| Source Playwright config | `2af13680bfc22aa9c1cb732bee189215169f76c7a1108181055cfa4bd80f1720` |
| Chat-surface Playwright config | `eab75f5761a78b50851abe7b0392e697493400d256df2cfd04f8fa6c42326321` |
| Default Playwright config | `27c68c50b15c383a217e2066316f7d641da8eb9b8418bd8d28b026b786f35c82` |
| Client `src/lib/chat-action.ts` | `ee4b84aa06b763dc9e06ac6cc28860e1c7f0b78a62189092eefbbfcecb0b54a9` |
| Client `src/lib/chat-action-controller.ts` | `7a23aa9ee58c4724bf7db42b4ad5fc521f66c3505610177b7971b6a72cc5ef89` |
| Client `src/components/SendToChatButton.tsx` | `88cb2886d2530d29bd5084106a31a737a8ced9d04e95ea45bcf56ad011b6b2e3` |
| Client `src/components/chat/ChatComposerAddMenu.tsx` | `9d61acd10d826a53a2fed5d2c3b4a185721d5ef364632713454b679909a15cd1` |
| Client `src/components/chat/ConnectedChatComposer.tsx` | `b3dcd745e057d9e8d350f6623d8a0b697f47b69778af1e29fc95946c0f758463` |
| Client `src/components/chat/useChatSessionActions.ts` | `d887b972d197c3a3afe92b9fce2a3686dfea1c8291251c76d400a409a4f3887d` |
| Client `src/components/chat/useSideChatRailAdapter.ts` | `2a1205bd426604f805eb7fe2b93ce8f3be65f1a18207bba7653d6534c01d317a` |
| Client `src/screenshots/chatScreenshotCapture.ts` | `18eb2caf9261a19d30ad35c5ac36a64c51ee22e08567e8cfb2ac48d84e9b12f1` |
| Client `src/screenshots/ScreenshotsTrigger.tsx` | `47c1883432b7c203f4b0ac20992d8e8efc353b4d68e3cb3bd5b5f75415359926` |
| Client `src/clipboard/ClipboardTrigger.tsx` | `1f68e64c75570d3109598ea8be243f4699db4020aa8d05e88b8c58456574e087` |
| Client `src/recent-files/RecentFilesTrigger.tsx` | `7ffa38a6d129f77ffda6d417c393197d5ccac9d32d8a86d059e49baec9c36496` |
| Client `src/lib/resource-path.ts` | `588893bf0c90f22d618457227c46762030b735be059e7ef6aa7d64cde5325bf9` |
| Client draft store | `0e71377c3ec9fd2473aa895b27f566e80a582b7df82e473f38ae89ce48e280ac` |
| Client attachment store | `c32cbb3e85afc696b0a47412d5d26ca41cad9d247dc3e351666e766a768e0374` |
| `e2e/chat-architecture/observation-boundaries.spec.ts` | `63bb35d7cc67b0310545e5fcc51a863ec2d64803c453ff988168380c0a6b89ca` |
| `e2e/threaded-chat-host.spec.ts` | `4c2cdef55c38b815cf8d35ed5bcac3c04bf595db5d6126ae6f83f704f17ccb30` |
| `e2e/prompt-ownership.slice-c.spec.ts` | `733f5a7cdc902a68c75c906338a042340209abf34205ab385f89b691e47ad699` |
| `e2e/chat-composer-screenshot-menu.spec.ts` | `93db83a1f751645778b55f4c54b50d5372fbfd4a9acc8e363b8b71bb23a1f03a` |
| `e2e/chat-send-transport.spec.ts` | `c6b5b57d57e450e2d7e5927d75adeee686f200dd3da61b0d94b983885a5a0e3b` |
| `e2e/chat-surface-isolation.spec.ts` | `c21e1f347d0f36f9ddf9d73586d4b99542c96caf293b38ff0e690a9afabb14f4` |
| `e2e/chat-surface-identity.spec.ts` | `17fb34728856a3557b5cf833b393f291a9b08be9021471135442f6aa58bfafed` |
| `e2e/chat-component-registration.spec.ts` | `6f944b2dc873e518c8cd10cf8503e0527677f0f119fa0927006cdf63aca5ceb1` |
| `e2e/side-chat-electron-smoke.mjs` | `5665798ac5f8289debf00ab8bbd5173574afacbb6ef5d172b5adc0ac4581fbc6` |
| Electron screenshot handlers test | `1dc78749eec9327d3605d5ee163fa2fb6c18e9d5f17ef87a926b6ca6382c0ba9` |
| Server package | `15113c033b6deb5622aa8a5213042bcb1b67e82d87f63df3b006efc9640717db` |
| Server request-ID test | `79f331849cff605f963731744066d94941c80b8d3298d2300e49778880bb78e8` |
| Server protected-path test | `1fe319e540ca4376398bbb8b0daa48bdea18a1ed2a7889d2618d74e9e799d8c6` |

The current guidance pages and named contracts were read fully. Representative high-risk action/preparation/controller/lifecycle paths and relevant test blocks were inspected; this report does not claim every entry point or full test dependency graph was read. Additional inspected source includes `SystemViewer.tsx`, `chat-action-creation.ts` and the System outcome suite; supplemental hashes are recorded below on final readback. Native/Playwright capability availability beyond file/tool access was not exercised. The old receipt's raw runtime files may expire under temporary paths; its durable map remains evidence, not a promise those files still exist. No historical conversation or checkpoint recall was needed because current owner authority was supplied directly.

Final authority freshness: the supervisor added the narrow October 7 D-009 planning-only exception to the parent Launchpad `AGENTS.md` during this investigation. The full updated file was reread; it preserves “Don't build,” prior acceptance, side-role and checkpoint restrictions. Product HEAD and dependencies did not change. Final supplemental source/dirty-input fingerprints follow; dirty runtime/support files were fingerprinted for preservation/context, not audited or accepted.

| Source relative to fs-dev | SHA-256 |
| --- | --- |
| `AGENTS.md` | `41dc4e9dc4d58e7505cb6fc37b500129502231293894b5f90eda9398315e001d` |
| `fusion-studio-server/AGENTS.md` | `00d56bfd0e50a512bd1d8e76110c6882ce7d9cbdac58782839ee6426c1d54fd2` |
| `ai/RC-MacAir-15/Wiki/AGENTS.md` | `9d353611f3b5ac94efa92048d1c0f8879d71786bcf1b641f915a0f695f5ef697` |
| Controller `AGENTS.md` | `d4dce1ca561b013641ca999d4183a73be739b408cfa5e518c750af783420de6d` |
| Launchpad `AGENTS.md`, updated D-009 | `428c8939c8c57ec172624934ad1425ff2d4fdc1a359570ed71a38fcc837292cc` |
| `fusion-studio-client/src/components/SystemViewer.tsx` | `1e4b3b5e6c628e399ad4a8f82179220a8172f1fee92f331626afe33825af62c5` |
| `fusion-studio-client/src/lib/chat-action-creation.ts` | `3ca8d14fc5599c2966b6cc83de8c6d70909559dd4d2833d941824861a2eb619f` |
| `fusion-studio-client/e2e/system-viewer-action-outcome.spec.ts` | `eeccf1908c3ae9ddce0bec5799c5e2b406d3f8469d5392d31c33952ba2b6f871` |
| `fusion-studio-client/src/components/ChatInput.tsx` | `f19c88c23acae8aedfa66f5766ba30bc69c4e9495d66f31f6b9b1e1647c71065` |
| `fusion-studio-client/src/components/chat/useChatMountInteractions.ts` | `331e8eb45262408d58632a81b3ad939ab1ae7f76bd92ae74fd83ceb6803c99ea` |
| Dirty `ai/RC-MacAir-15/System/config/cli.json` | `8a160b32a5556218ee18a14c0d3553e074286d7d72bdc40ed59b5fd08c8e4c32` |
| Dirty Capture view state | `e7b7587b036096da01b6ea71a2df16f0ecae3b68549ac4e46107ae14929ea375` |
| Dirty File view state | `11a159d725671df9d700bdb7104f5039ef1834c88d707e97eb5a9f4d252b1471` |
| Dirty Wiki view state | `4ff336960d867ec8393849a3bb28906d92d4ee0d39ba8c3cc21c6524920995c2` |
| Dirty Wiki Fusion Restart article | `ccf7a76b4201ce3f5a95b29816f72f85cf1506b6f94172a581c100170dd4b94e` |
| Dirty `restart-fusion.sh` | `b855f5d829d85b6fda20864c081c25f56f73bebc54e325e70826ec5e42622952` |

## Holds and return

No missing owner product decision was established by the destination/focus rules. SystemViewer intent classification must be explicitly reconciled by the manager/author; a flags-only exemption is insufficient. Comprehensive entry-point inventory, concrete implementation details and exact candidate manifest belong to the assigned author. A later implementation cannot claim completion until the affected acceptance matrix, actual native subset, Wiki reconciliation and independent product review pass on its current bytes; old build receipts cannot substitute for them.

Stop reason: sufficient evidence to inform the candidate's acceptance and dependency-renewal plan. Changed file: this report only. Next safe action: manager assigns a fresh independent `mode: worker-handoff`, `deliverable_kind: investigation` review against original assignment, owner request and current raw source; incorporate only after acceptance, then the separately fresh candidate-stage/release gates. This report is not `WORKER_HANDOFF_VALIDATED`, stage validation, release approval or implementation authorization.
