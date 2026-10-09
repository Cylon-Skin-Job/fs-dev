# SPEC-06 / 06A implementation report

Status: READY_FOR_ORCHESTRATOR_REVIEW. All required automated gates passed; fresh builder-owned spec-review-gate returned CLEAN. This is a builder handoff, not authoritative slice acceptance. This report is not slice acceptance or an owner symptom claim.

Authority is approved CHAT-AR-4641ca5897f0, SPEC-06 slice06A, the complete ROADMAP packet and supervisor dispatch confirming owner accepted05. The original SPEC draft label is historical; approval is recorded by AUTHORITY-AND-DECISIONS and dispatch. Work stays in primary development checkout `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, preserving the shared dirty owner baseline. Accepted05 aggregate is `da6ecbffec10d9f79951ecf6c2fb65996eb2a8ebfb341c5f26bd31458ca4ea73`; root independently verified105 prerequisite hashes.

## Result and candidate

The R1–R8 inventory now enforces all owned cases and independently requires each backend runtime executor. Upgrade coverage creates a pre045 database in a disposable staged fixture, applies the ordinary migration under real Electron authentication, preserves exact historical rows/null-view authority, sends publicly, and checks restart/readback. Two bounded product repairs close historical diagnostic-feedback and observed duplicate-panel history-read failures.

Current candidate source identity: `FINAL-IDENTITY-source.json`,1911 files, SHA256 `42e2f1a236cf87e5b75cc0354f28a8ad0d49332f4662611e1538e755c5675a06`. Build identity: `FINAL-IDENTITY-build.json`,200 files, SHA256 `a11a690f25fd730c5327e7d230da72c0252f24f28f755bf5b5d5a1e04350816a`. Four incidental server logs are separately hashed as runtime provenance and do not define source identity. The full unpartitioned manifest retains2115 files for provenance. Manifest helper includes client/src, electron, dist, e2e, server dependency sources/tests/package files, and staged System_Manager templates/configuration. No installed dependency was downloaded or changed. Per-run manifests record Node/Electron versions, staged process identity and command lines.

`START-GIT.txt`, `START-SOURCE.json`, and `CHANGED-SOURCE.json` identify preserved baseline and exact changed paths. Twelve existing source files changed; two added. Source changes:

- Client product: `src/components/MessageList.tsx`; `src/components/chat/{chatSurfaceContract.ts,useChatSessionActions.ts,ChatDiagnosticDetails.tsx}`. Existing callback carries `pending-acceptance` distinctly from unavailable; pending draft remains guarded, unknown editing remains available, successful append remains true.
- Server product: `lib/thread/ThreadWebSocketHandler.js`. Exact identical non-retired active panel/root/workspace/nonempty epoch/viewName preserves state identity; changed bindings retain fencing. Router rootFolder/list/config/panel_changed side effects remain outside this idempotent binding call.
- Client acceptance: `e2e/chat-architecture/{scenario-inventory.mjs,run.mjs,observation-contract.test.mjs,r5-r6-electron.mjs,stage-fixture.mjs,electron-case-helpers.mjs,server-focused-regressions.mjs}` plus new `r8-upgrade-electron.mjs`.
- Server regression: new `test/thread/thread-panel-rebind.test.js` forces a read queued behind duplicate set_panel and six changed-binding rejection branches.
- Owned evidence: this06A folder only. Root ledger/prerequisite audit and historical reports are preserved.

## Required checks and exact baseline-red disposition

| Check | Command / evidence | Current result |
|---|---|---|
| V-BUILD | `npm --prefix fusion-studio-client run build`; build-02.log | PASS; current client production bytes, Vite3.88s, preexisting chunk-size warning. Subsequent server/test repairs do not change client build inputs. |
| Full isolated server | `node fusion-studio-client/e2e/chat-architecture/owned-regression-launcher.mjs server-full`; server-full-01.log; run `server-full-1790301856956-22c0b5e3` | PASS215 suites,3187 tests,1 preexisting skipped; native pretest preserved; unfiltered `npm test -- --runInBand`. |
| Full historical boot | `node fusion-studio-client/e2e/chat-architecture/owned-regression-launcher.mjs boot --all`; boot-all-01.log; run `boot-1790301951682-5bfb59ef` | PASS131. Exact pending diagnostic historical red is case127,756ms. |
| V-ISOLATION | within client: `npx --no-install playwright test --config=playwright.chat-architecture.config.ts e2e/chat-surface-isolation.spec.ts`; isolation-01.log | PASS18,6.8s. Excluded old standalone HTTP boot is replaced by owned real Electron shell. |
| V-SHELL | `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite shell --mode enforce`; shell-01.log; `chat-arch-1790302073626-3687418b0f` | PASS. |
| Non-timing public matrix | Exact argv in non-timing-command.json; all-suite selected cases except R1-F2-F3-COMPOSER | PASS27 selected cases, `chat-arch-1790302546082-32740578af`; does not replace full V-ALL. |
| V-ALL | `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite all --mode enforce`; v-all-01/02.log | PASS28/28, `chat-arch-1790302916854-5e1db6da8f`; v-all-03.log. Earlier01/02 failures retained below. |
| Runner/source/lifecycle/sensitivity | node tests recorded separately | PASS32/32,0 skipped; `node --test fusion-studio-client/e2e/chat-architecture/*.test.mjs`; source-lifecycle-01.log. |

The diagnostic historical red was `working-activity.spec.ts > @terminal-error Ask AI cannot overwrite a server-owned pending acceptance`, prior run `boot-1790139404160-dd7e263e` (spec04/04B/full-boot-case-summary.json). Previous reports called its text oracle stale while draft/no-overwrite behavior passed. Current causal source inspection showed the callback collapsed a real pending denial into generic unavailable feedback. D03 fixes that cause; full boot now proves the unchanged strict text, draft and no-extra-prompt oracle. Historical reports are not rewritten.

V-ALL02 (`chat-arch-1790301543920-e3e78bf347`) failed R1_FOCUS_UNAVAILABLE after48 attempts: available:true, visible:true, minimized:false, focused:false. `focus-capability.txt` records read-only `ioreg -n Root -d 1 | rg IOConsoleLocked`, result Yes, and timestamp. No timing metrics are accepted from this failed capability window. No unlock or owner-window action was attempted. After capability returned, the exact full V-ALL ran and passed all28 cases. No required timing command remains for06A. Root/supervisor were informed. Later read-only recheck reported IOConsoleLocked=No. Full V-ALL03 passed under an orchestrator-authorized process-scoped `caffeinate -d` wrapper; it prevents idle display sleep only, with no lock bypass or settings change. No reduced foreground, relaxed threshold or omitted case can replace this gate.

## Criterion map

| Criterion | Concrete required public/automated evidence |
|---|---|
| R1 | R1-COMPOSER-CORRECTNESS, fixture isolation leaf/locality and calibrated R1-F2-F3-COMPOSER. Short focus-dependent timing passed; five-minute/native/45-minute belong06B. |
| R2 | R2-NO-ENQUEUE disconnect-before-click plus throw/race; retained editable draft, visible no-send, no prompt. |
| R3 | R3-LOST-ACK-STATUS and R3-RECONNECT-UI; real durable receipt/status/reconnect, one acceptance/bubble/dispatch. |
| R4 | R4-DISTINCT-ATTEMPTS, DISTINCT-RECEIPTS, LATE-DRAFT-RECOVERY, DUPLICATE-MISMATCH; exact IDs/fingerprints, repeated text, remount/restart/draft. |
| R5 | R5-R6-PUBLIC-ACTIONS, CURRENT-ACTIONS, DIAGNOSTIC-APPEND, CURRENT-OWNER; actual File/Wiki/Office/System actions, source-target ownership, no consumer and failure UX. |
| R6 | R6-PRODUCTION-ACTION-OWNER and LIFETIME-BOUNDARIES; production owner availability is mandatory, prompt/create/unmount/reconnect/exact response cleanup. |
| R7 | R7-HISTORY-LIVE plus R7-R8-RUNTIME-OWNERSHIP and full boot; two sessions, exact Stop/partial-save/finalization, late ACK, live metadata locality. |
| R8 | PRE-RECEIPT-UPGRADE, OWNER-GRAPH, EXACT-MEMBER-HYDRATION, UI-LIFECYCLE, RUNTIME-OWNERSHIP, MIRROR-RECOVERY, SESSION-LIFECYCLE; create/warm/send/Move/member/Delete/busy/capacity/mirror/outbox/restart/old-generation. Graph is not a runtime substitute. |
| Upgrade | Actual Create Project generates isolated canonical workspace; historical DB through044;045 restored before ordinary Electron server launch; exact old exchange digest/null-view retained, one new receipt/exchange, actual saved ACK and restart readback. Every read immediately follows a duplicate set_panel to exercise D05. |
| Baseline reds / closure | Strict full boot131, full server3187 and scenario removal sensitivity. No owned expected-failure marker, skipped required executor, or source-only public replacement. |

R1-SUMMARY.json links the raw10-window result: three startup/warm/settled trials plus dense history, exact retention in all windows, maximum input p95 0.700001ms, next-rAF p9514.400001ms, next-rAF maximum16.700001ms, wall1926ms against2550ms budget, zero long tasks/outbound frames/history formatter work, observer support and before/after focus true. This is synthetic short-run evidence, not native or owner symptom acceptance.

## Deviations, adapters and residuals

`DEVIATIONS.md` records original SPEC text, actual implementation, reason, files/checks, effect/risk, proposed classification and downstream effects for D01–D07. All classification proposals await orchestrator. `SELF-REVIEW.md` records integration inspection. Upgrade01–14, standalone15, cumulative01 and cumulative02 remain immutable historical receipts; a later pass never erases their failures. Canonical-path fixture correction is distinct from the evidenced same-panel product race. Stable fixture settling alone did not close the race; D05 and immediate duplicate/read probes address that exact path. Generic changed-panel stale-read fencing is preserved.

Adapters: deterministic canonical OpenCode iterator stubs provider computation only; real Electron shell auth/router/ownership/SQLite remain. Historical boot uses its established isolated authenticated fixture seam; real shell/public cases independently cover Electron. Historical DB seed/scaffold is deterministic disposable data, not private user content. Unit binding regression uses a minimal injected manager while public upgrade exercises the real manager. The one full-server skipped Kimi TODO is preexisting and outside owned contracts; no owned assertion is skipped. R9 indicator legacy metadata/request-identity correction, native keyboard/IME, original owner symptoms and full45-minute resource proof are06B, not claimed by06A.

Advisory accuracy cleanup for06B/06C: R1 and R2 results retain a legacy `characterization:true` metadata field even under enforce. The run manifest mode and actual enforce assertion branch govern the result; the field is not an expected-failure bypass. Root independently inspected the branch and all three strict trial receipts. Preserve current measured source bytes and carry the metadata cleanup separately.

Carry accepted05 residuals honestly: fresh-workspace no-reload `view_not_found`; intermittent SQLite read lock with unknown holder; one unknown late-draft restart observation;3s Stop effect grace,30s late save-delivery grace followed by readback,5s iterator bound and explicit retirement retry; shared exact admission/Delete leases and generation fencing. Passing reruns do not identify the unknown causes. Retain the separate06A unresolved label observation: requested token `2227ebc2` became renderer `2227ebc2nd`; neither OS correction nor unintended product mutation is established.06B must investigate native/autocomplete expected-input semantics. The earlier R6 menu-lookup failure also has no proven causal link to that suffix or screen lock. D06 uses deterministic display labels with exact registry/path assertions; it is not an input fix. Root additionally identified unproven OpenCode adapter session-map retention and group Delete Side-member client cache retention; SQL/file cleanup alone proves neither memory eviction nor no-growth.06B must investigate those with lifecycle/soak evidence.

## Isolation, review and remaining work

CLEANUP-AUDIT.json indexes all25 run receipts: every owned root was removed, with zero process leak, timeout or interruption exceptions. The final28 cases took 519721ms total measured case time; the short-suite900000ms deadline remained enforced. The process-scoped display assertion ended with its runner. Runtime lane was explicitly released to root after all checks finished.

Every runtime uses marked disposable profiles/workspaces/databases/stages, ephemeral ports and supervised exact owned PIDs. Source build and controlled timing never overlap. Cleanup receipts in each run/result and launcher/result must show removed owned root, no timeout/interruption/leaked descendants, and SQLite quick_check for Electron fixtures. Failed runs retain their cleanup too. No live dev/Alpha DB/profile, port3001, owner Fusion window, unrelated PID, dependency download, destructive migration, commit/push, Alpha operation or deployment was touched.

Builder-owned fresh read-only spec-review-gate review returned CLEAN on its first pass. Reviewer `/root/builder06a/review06a_pass1` used fork_turns:none and inherited model/effort; no tests/runtime/edits/subagents. It verified every1911 source/200 build hash and found no material defect. Terminal completed status was independently read from collaboration.list_agents. REVIEW-PASS-1.md preserves the verbatim result and REVIEW-LIFECYCLE.md records preflight, identity, terminal disposition and closure. close_agent was unavailable both before and after terminal result, so no callable close operation could be attempted. All descendants are terminal and non-conflicting. No repair pass or additional reviewer was needed; stop at the first materially clean pass. The prior focus capability limitation is resolved for06A by the full strict passing rerun; native/owner acceptance remains06B. No06B/06C work is implemented.
