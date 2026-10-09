# SPEC-05 / 05C builder report

Candidate CHAT-AR-4641ca5897f0; branch agent/exact-workspace-paths, HEAD 88637d11c65be53d4f2ad0f049f64a07fa3db1de plus accepted and owner dirty bytes. Builder /root/builder05c. Scope: approved slice05C, after accepted05A/B. Current candidate: SOURCE-SHA256.txt (27 files); exact preedit bytes and PREEDIT-SHA256.txt captured before edits. SLICE.diff compares those actual incoming bytes, not Git HEAD. Status: READY_FOR_ORCHESTRATOR_REVIEW. Current-byte backend and submission PASS; fresh builder-owned gate CLEAN. Manifest SHA-256 b4c05e2456693fb809e62ed1bcf66afe37b893932bfe9a35f221973a4a99af50.

## Ownership and changes

All27 changed paths are listed in changed-files.json and hashed in SOURCE-SHA256.txt. New production owners:

- runtime-activation: interactive warm/READY reservation under05B session admission lease.
- runtime-prompt-admission: validates the interactive attempt, commits receipt+group activity through existing submission service, acknowledges acceptance, delegates accepted dispatch.
- runtime-dispatch: accepted interactive iterator, canonical claim, dispatch claim, safe terminal error and exact pending-context cleanup.
- runtime-stop: exact Stop reservation, terminal synthesis, provider termination and compare-current cleanup.
- runtime-session-activation: provider ownership transfer/rollback with explicit session methods. ThreadWebSocketHandler retains transport selection/binding, serialization and handler delegation.
- runtime-session-binding: transport adapter projects explicit workspace/root/session methods, group-activity callback, lookup, selection and activation operations. Policy owners cannot reach an entire ThreadManager through their argument.
- runtime-response: bounded safe transport errors; runtime-identity: pure frozen key construction/resource matching.
- turn-application-context: exact pending/base-turn cleanup and canonical application projection.
- automation-runtime-activation: headless warm ownership using explicit session operations. automation-turn-context: headless canonical bridge/context composition. automation-drain: headless canonical iterator retirement/terminal lifecycle.

thread-runtime-controller is the existing public facade. thread-runtime-automation remains the headless admission entry point. Automation creates no request receipt. ThreadRuntimeManager remains the only canonical runtime map. Its frozen ownership stamp references one exact runtime record/key and its drain revision; every new claim changes the revision. The stamp distinguishes normal terminal clear from missing fenced state, replacement generation, and replacement-drain-then-clear. No second state map was introduced. The existing per-WS activation queue is transport serialization, not runtime authority.

Pure key normalization moved into runtime-identity and the existing bounded drain wait moved into canonical-drain-context. Manager methods are still the single owner of state mutations. Terminalization checks turnId as well as drainId; a terminalized drain cannot begin again or accept late live mutations. Retained snapshots preserve partial data when publication or SQLite save fails. Existing canonical HistoryFile/audit persistence remains untouched.

Dependency direction: public WS/router -> runtime facade -> activation/admission/dispatch/Stop owners -> sole runtime manager/canonical drain API and narrow session capabilities; transport adapter -> ThreadWebSocketHandler session binding -> runtime-session-activation -> session capabilities. Automation admission -> automation activation/context/drain -> same canonical state APIs. Receipt service -> existing repository+group activity callback with one DB transaction; no new receipt owner/schema. No new provider-specific syntax, route family, view-state SQL snapshot or provenance redesign.

Every new/extracted production module is<=400physical lines: largest runtime-stop281, runtime-dispatch266; ThreadWebSocketHandler375, runtime manager400, automation entry261. FINAL-CHECKS.json records exact syntax results and counts. The preexisting ws/thread-ws-handlers module remains long; its necessary eager-spawn exact-ownership touch is deviationC2, with final router/facade inventory carried to05D.

## Acceptance mapping

| Approved05C criterion | Current evidence |
|---|---|
| Separate activation from receipt admission/dispatch/Stop/terminal cleanup | Explicit owners above; no full-manager injection into extracted policy; new production modules bounded; source/import self-review |
| Preserve receipt+activity transaction and claim-before-dispatch | Existing prompt-submission service/repository unchanged; public receipt/recovery suites and seven-case V-SUBMIT; delayed dispatch-claim test proves no provider invocation after replacement |
| Immutable generation/thread/turn/drain and exact cleanup | Ownership stamp; runtime-session activation and eager spawn recheck captured runtime across awaits; old callbacks cannot recreate fenced record or cool replacement |
| Stop touches only its exact drain/provider | New delayed old-retire callback test; delayed finalization recheck before stopHarness; bound/never-begun/preclaim retirement delay matrix; replacement+clear and reused-wire unregister guard; existing real canonical Stop/interleaved same-socket tests |
| Activation failure / late generation | Parameterized late warm resolve/reject; eager readiness after fence; automation late warm; existing activation failure/rollback and capacity suites |
| Terminal failure / cleanup | New canonical publication-failure snapshot and late content/tool/status test; real SQLite trigger failure through canonical applier -> UEB -> audit -> HistoryFile: zero exchange, no saved ACK, exact partial snapshot retained, drain cleared |
| Automation canonical parity | Existing automation suite plus late warm, retained retire callback, replacement during terminal application; uses same runtime/drain API without fake receipt |
| Preserve05B lease/deletion/mirror seams | withSessionAdmission held through IN_FLIGHT reservation, fresh session recheck retained; no nested lease. All05B affected public group/mirror/Move/delete/outbox/receipt tests pass in cumulative23suite gate |
| Runtime smoke | Full authenticated Electron V-SUBMIT with copied staged code/private profile/workspace/ephemeral endpoints; public backend route and canonical application/readback suites |

## Checks and raw evidence

Final focused backend command:
`node fusion-studio-client/e2e/chat-architecture/run.mjs --suite backend --mode enforce --cases R7-R8-RUNTIME-OWNERSHIP`

Run chat-arch-1790243283327-eda18ee2a7: **23suites/512tests passed**, exit0. Staged npm test expands to npm test -- --runInBand --runTestsByPath and the23exact paths recorded in receipts/<run-id>/session-lifecycle/manifest.json. This includes runtime-controller, automation, activation, active-turn reconnect, canonical bridge/applier, prompt-canonical-route, privilege/public routes, group lifecycle/delete/Move/worksurface, mirror/history/audit, agent provenance, session manager and receipt recovery. Required native npm pretest ran node-gyp rebuild for secure-file-observer; successful, no bypass/download. Result records no timeout, no interruption, zero leaked owned PIDs, owned root removed. Current source dependency hashes are in that manifest.

Full submission command:
`node fusion-studio-client/e2e/chat-architecture/run.mjs --suite submit --mode enforce`

Initial run chat-arch-1790242604412-a0a1d9fd84 passed all seven cases before the final terminalized-mutation fence. Second run chat-arch-1790242876104-4826b3d5f6 passed all seven after the terminalized-mutation fence. Third current-byte run chat-arch-1790243312056-358efb0d3d passed its first four cases then failed R4-DISTINCT-RECEIPTS readback with database is locked after30seconds. Adapter trace reached before/after-save-ack within165ms of dispatch; fixture cleanup reports dbQuickCheck ok, no leaked PIDs and root removed. Root cause is unproven because that fixture did not retain server-live logs. No assertions/timeouts/source bytes changed for the full rerun. Final unchanged full rerun chat-arch-1790243438774-f63e71e54c passed all seven cases, exit0, no violations, no timeout/interruption, zero leaked owned PIDs, fixture roots removed. This establishes a current passing cumulative gate; it does not establish the cause of the prior isolated readback lock.05D should retain this observation and capture bounded server logs if it recurs. Cases: R2-NO-ENQUEUE, R3-LOST-ACK-STATUS, R3-RECONNECT-UI, R4-DISTINCT-ATTEMPTS, R4-DISTINCT-RECEIPTS, R4-LATE-DRAFT-RECOVERY, R4-DUPLICATE-MISMATCH. Real Electron authentication/production routes and DB readback retained; deterministic adapter substitutes provider computation only.

All changed production files passed node --check; git diff --check passed for changed tracked files. Exact command arrays/exits are FINAL-CHECKS.json. RUNS.json indexes raw logs and receipts copied from the runner's established spec-01/01B evidence root. No new migration. No direct dev server run: native pretest plus staged public-route tests and actual authenticated Electron smoke provide isolated runtime evidence.

Intermediate failures/repairs are retained, not waived: backend1 failed closed on a relocated fault-hook exact match; backend2 found omitted mock ownership capabilities, an accidentally misplaced scope guard and completed-record cleanup incompatible with historical record-shape assertions. The final orphan repair captures claim-time records for those shape assertions and adds explicit completion cleanup/STOPPING oracles; backend3 compatibility23/487; backend4 ownership23/502; backend5 additional reservation/preclaim23/504; backend6 new terminal test used sync throw assertion on async applier (fixed awaited rejection); backend7 only native SQLite cross-realm Error matcher failed (changed to exact message match), backend8 all506; backend9 orphan repair23/510; final backend10 includes failed-stop retention23/512. No baseline-red label was used.

## Self-review and validated repairs

Read complete slice authority/dependencies, repository/server guidance, standards hub/routed pages, accepted05A/B reports/manifests, runtime/identity/persistence wiki and affected sources/tests before editing. Reviewed current diff and immediate WS, session lifecycle, canonical applier/bridge, group admission/receipt and audit persistence callers. Repaired:

1. late warm/activation READY/COLD cleanup recreating fenced runtime records;
2. retire closures selecting a replacement because expected drainId was absent;
3. Stop cleanup after awaited finalization/provider/session retirement affecting replacement generation/drain, including replacement already cleared;
4. preclaim provider completion unregistering a reused replacement wire;
5. receipt dispatch claim completing after replacement still dispatching or resetting state;
6. rejected admission on retired transport stranding its still-owned IN_FLIGHT reservation;
7. canonical terminalization accepting foreign turnId, restarted terminal records and live mutations after terminal publication failure;
8. safe pending authority/context release on failed claim/dispatch while preserving a replacement's state;
9. completed empty/pre-begin-failed iterators retaining activeDrain forever and blocking Delete through getResourceBusyState. Completed owned drains clear unless genuine retirement failure leaves STOPPING; both paths test empty, pre-begin failure and failed provider retirement. Historical shape tests capture claim-time records and still assert all identity/immutability/control behavior plus eventual cleanup.

New tests demonstrate each repaired boundary; existing same-socket interleaved thread tests, mirrors, receipt and provider-error disclosure oracles remain. Runtime manager's legacy fixture initialization APIs are retained for existing callers/tests; all changed asynchronous production paths use captured ownership APIs. No generic compatibility mode added.

## Deviations / bounded integration proposals

| ID | Original packet boundary / actual change and reason | Observable effect, evidence, downstream / risk | Proposed classification |
|---|---|---|---|
| C1 | Separate runtime owners; pure identity and bounded drain wait moved too, plus context/transport capability projection | Removes whole-manager reach-through and preserves sole map. All focused checks pass. No product semantics change from extraction;05D must include new owners in final dependency inventory/wiki | accepted |
| C2 | Expected runtime/WS delegation includes mechanically necessary eager assistant spawn in existing ws/thread-ws-handlers.js | Its own late READY/COLD/STOPPING path could recreate fenced state despite activation owner checks. Exact eager late-ready regression and full public activation/submission pass. Existing long router remains for05D final structural inventory; no protocol change | downstream_impact |
| C3 | Exact turn/drain terminal cleanup required; canonical manager terminal gate strengthened | Foreign turn cannot terminalize; terminalized drain cannot restart or accept late canonical content/tool/status after publication failure. Real chain tests plus SQLite fault readback. No new durable recovery journal/UEB policy | accepted |
| C4 | Existing isolated runner staged hooks targeted old controller text | Relocated fail-closed before/after admission/ACK hooks to actual admission owner, preserving single-match assertions. Registered R7-R8-RUNTIME-OWNERSHIP and extended dependency/test manifest; two transport-only fixture adapters gained explicit ownership methods. No production test API or weakened oracle | accepted |
| C5 | Native focused tests lack a real terminal persistence failure case | Added SQLite-trigger test to existing audit subscriber suite (one additional test file beyond advisory list); confirms no fabricated saved ACK and retained snapshot under actual DB failure | accepted |
| C7 | Completed iterator orphan cleanup and five existing record-shape assertions | Old tests inspected retained record shape rather than expressing an owner requirement to retain completed orphan drains. Capture original claim, preserve shape assertions, assert cleanup; six new interactive/headless empty/failure/failed-stop cases prove resource busy behavior. Genuine STOPPING remains retained. Root authorized this bounded defect repair; no owner semantics supersession | accepted |
| C6 | Evidence requested spec-05/05C while existing runner writes spec-01/01B | Preserve runner root and copy exact raw receipts/logs here; manifest binds current dirty-worktree source. No runtime effect; later slices may keep same evidence adapter | accepted |

No owner intent change or indispensable decision. Proposals do not bind orchestrator classification.05D retains full server, unfiltered backend, actions/build/architecture closure, integrated UI create/Send/Stop/Move/delete/reconnect and Wiki reconciliation. Carry05B preexisting external os.tmpdir workspace cleanup gap; runner removal only proves its own root/PIDs. No claim every historical host temp directory was removed.

## Skips, adapters and residual risks

Full server npm test, unfiltered backend, V-ACTIONS/V-BUILD and full manual UI matrix are assigned05D; not waived or claimed here. Native OS input, original freeze acceptance and soak remain06. No owner/live window action, dev/Alpha database/profile write, port3001, unrelated kill, dependency download, commit/push or Alpha operation occurred.

The inherited deterministic provider adapter and stage-only exact-match fault hooks remain test-only. Existing unit persistence/transport adapters do not certify SQL; actual SQLite/public-route suites do. A failed SQLite terminal save does not become durable: the exact partial runtime snapshot is retained and no saved ACK is fabricated, while the owning audit drain reports failure. This slice introduces no disk recovery promise for data whose write failed. Existing safe-terminal diagnostics and shutdown/retirement bounds remain. Headless activation has the same exact stamp checks but no interactive receipt requirement.

Preexisting Node warning --localstorage-file without a valid path is fixture noise. No remaining known material05C defect. Lifecycle and final current-byte review are recorded below.

## Builder-owned gate and handoff

Fresh reviewer /root/builder05c/review05c returned CLEAN on the first pass, no material findings or required repairs. REVIEW-RESULT.md records its source/evidence checks, REVIEW-LIFECYCLE.md records fresh fork with inherited model/effort, pre-spawn non-conflict check and confirmed completed disposition. No edits/workloads/descendants by reviewer. close_agent was searched before spawn and after terminal result and is unavailable; closure absence is recorded, not waived. Stop after this first materially clean pass. No product changes after reviewed manifest.

Root independently ran backend chat-arch-1790243555508-675cfa595b23/512 and targeted receipt case chat-arch-1790243591694-373426c7bd PASS with clean owned lifecycle; all66 backend dependency hashes and27 source hashes current. This supports evidence; orchestrator acceptance/classification remains separate.

READY_FOR_ORCHESTRATOR_REVIEW. No unresolved material05C finding. C1-C7 proposals remain for authoritative orchestrator disposition; preserve all declared05D/06 obligations and limitations.
