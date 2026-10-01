# SPEC-05 Implementation Report — Backend lifecycle and persistence ownership

Candidate: `CHAT-AR-4641ca5897f0`  
Baseline HEAD: `88637d11c65be53d4f2ad0f049f64a07fa3db1de`  
Branch: `agent/exact-workspace-paths`  
State: **SPEC_READY_FOR_SUPERVISOR_REVIEW — implementation, checks and independent review CLEAN**

This report records the completed SPEC05 implementation and validation. Supervisor and owner acceptance remain separate. Necessary Stop, reconnect and termination-cleanup repairs are complete and independently revalidated. All deviations and historical failed runs are retained under `evidence/spec-05/`. Accepted01–04 and unrelated dirty work remain the baseline; GitHEAD is not the slice diff source.

## Implemented ownership boundaries

| Responsibility | Owner and preserved authority |
|---|---|
| Workspace-qualified facade | ThreadManager composes explicit operations and delegates; no copied transaction/policy/recovery body |
| Session lifecycle and capacity | SessionLifecycle, SessionManager, session repository; bounded admission, exact provider ownership, activation rollback and suspended metadata |
| Group create/delete/Move | Existing group service holds the exclusive lease and membership/primary/activity policy; transaction owners use caller transaction handles |
| Durable exchange and prompt acceptance | Existing HistoryFile/audit exchange writer and SPEC02 submission receipt/activity transaction remain canonical |
| Disposable chatlog and recovery | ChatlogMirror plus transactional MirrorJournal invalidation and conditional revision ACK; existing file-backed placement/deletion outboxes |
| Runtime activation and turn orchestration | Focused interactive/automation activation, admission, dispatch, context and Stop owners using explicit capabilities |
| Canonical runtime identity/state | ThreadRuntimeManager remains sole runtime map; immutable generation/thread identity and captured object/drain revision guard late work |
| Transport and passive history | Narrow WS provider/action/open delegates; exact Side member hydration with optional historyOnly that preserves Main selection and pending user opens |
| Architecture evidence | Bounded affected CommonJS/ESM owner graph with explicit external edges; executable sensitivity checks supplement real routes and UI readback |

New and changed05 production owners are required to remain coherent and at most400 lines. No provider-specific rewrite, second runtime authority, separate worksurface SQL snapshot or general provenance redesign is part of this work. Existing migration045 is the accepted02 baseline; no production migration is introduced by05.

## Slice records

05A introduced lifecycle/session SQL and group transaction operations. Real rollback tests cover seven create-write fault points, activation metadata failure, singleton deletion rollback, duplicate commands and concurrent bounded capacity. Builder and root acceptance reviews were CLEAN on 15-file manifest `6db4eed15de32045150a2ad60bc91d2071fabee53902f103c852691a2806093e`. Later05D provider-exit changes passed expanded current revalidation and fresh05D acceptance review.

05B separated mirror projection/journals/recovery, made write invalidation atomic with canonical exchange persistence, and retained conditional acknowledgement of the exact export revision. Delete failures remain uncommitted/retryable; admission and deletion share the existing mutation lease with a fresh owned-row read and IN_FLIGHT reservation before release. Builder and root reviews were CLEAN on 24-file manifest `f057e0ad94b78fd805824ab925f8a05567d7d7ea0fd1f2516bc2da8ae2197f20`.

05C separated activation, prompt admission/dispatch, Stop and automation owners. Late callbacks cannot recreate retired runtime records or clean replacement drains; terminalized drains reject late mutation, and completed empty/pre-begin-failed iterators release orphan drains except genuine failed-stop reservations. Builder and root reviews were CLEAN on 27-file manifest `b4c05e2456693fb809e62ed1bcf66afe37b893932bfe9a35f221973a4a99af50`. Later05D Stop changes passed expanded current revalidation and fresh05D acceptance review.

05D current 78-file manifest is `5fe5337047401bf19aed7a4c90d6d82cd0fb6d0e5a4ade5c1bfea980b5394792`. It closes facade/dependency limits, raw ThreadIndex bypasses, server staging, actual UI lifecycle and scoped Chat Wiki updates. Actual UI uncovered Stop save-ACK/exit races and exact Side reconnect history gaps; these are required compatibility repairs, not new product intent. Fresh builder review then exposed an additional Stop effect-timeout recovery gap. The repair terminates the exact provider after a 3s save-effect grace and retains a finite 30s listener for one genuine late saved acknowledgement, with exact identity guards, shared delivery receipt and complete listener/timer cleanup. Failed save never fabricates an ACK; failed provider termination remains fenced. Eleven real-session/OpenCode-proxy regressions and current full backend/submission/actions/server checks pass. The final repair handles an accepted pre-begin drain after failed Stop and actual provider exit: bounded iterator settlement, exact ownership checks, metadata-before-release and explicit retry after failure. Twelve regressions and the original independent root reproduction pass. Fresh builder and root05D reviews are CLEAN; final integrated gates and fresh final review are CLEAN. The final cleanup repair disposes only helper-owned evented termination waiters after success or failure. Six regressions and root repeated-timeout reproduction verify no listener accumulation while preserving truthful failure, lifecycle observers and replacement isolation.

Detailed slice scopes, contracts, identities, revisions and lifecycle are in `evidence/spec-05/SLICE-LEDGER.md`, `CONTRACT-MATRIX.md`, each builder report, and each root acceptance record.

## Current integrated source identity

The 105-path union of05A–D source/verification inventories is `evidence/spec-05/INTEGRATED-SOURCE-SHA256.txt`, digest `da6ecbffec10d9f79951ecf6c2fb65996eb2a8ebfb341c5f26bd31458ca4ea73`. Root verified current bytes, scoped whitespace and that every affected production module is<= 400 lines. All four slice gates are accepted on this integrated candidate; final SPEC review is CLEAN. Per-slice snapshots/diffs preserve the actual dirty prerequisite bytes. Of 690 initial source hashes, 52 existing files changed and every one is accounted for in the 105-path inventory; no initial hashed file changed outside that inventory. Available accepted04 frontend preedit hashes also match.

## Final integration verification

All five commands ran sequentially **after the D18 repair and all slice gates were reaccepted**, exit 0, against the current 105-file candidate. Commands/logs/status are in `evidence/spec-05/FINAL-VERIFICATION.json`; independent receipt/source/cleanup checks are in `FINAL-EVIDENCE-AUDIT.json`. Earlier final passes and the subsequent finding are retained in the `-01` audit/review records and the exact historical source manifest.

| Gate | Current result / raw run identity |
|---|---|
| `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite backend --mode enforce` | Six cases: graph 2, store 4, actual UI 6 flows, runtime 26 suites / 550 tests, mirror 24 / 413, session 15 / 282. `chat-arch-1790255487009-f51dcf83f5` |
| Same runner `--suite submit --mode enforce` | All seven cases. `chat-arch-1790255544092-3ef44b09e3` |
| Same runner `--suite actions --mode enforce` | All six cases. `chat-arch-1790255639018-264b288937` |
| `npm --prefix fusion-studio-client run build` | Passed; existing chunk-size warning retained. `integration-build-2.log` |
| `node fusion-studio-client/e2e/chat-architecture/owned-regression-launcher.mjs server-full` | Unfiltered `npm test -- --runInBand`, real provider source and mandatory native compile/link pretest: 214 suites, 3,180 passed, one existing Kimi TODO skip. `server-full-1790255827447-30e97acc` |
| Current architecture/fixture lifecycle | 17 passed / 0 skipped in `05D/architecture-lifecycle-final-4.log`; no subsequent source change invalidates it. Final backend repeats graph sensitivity. |
| Independent repair checks | Original observed-exit recovery trigger passes. Repeated evented provider timeouts retain zero helper listeners across three attempts. Root runtime `chat-arch-1790254963625-4c3ac1a639`: 26 suites / 550 tests. |

All 105 integrated hashes match. Full server and three backend staged lanes each match all 1,607 dependencies; top-level backend/submission/action manifests match their recorded source files. Every raw case reports exit 0, no leaked owned PIDs and removed owned roots. Final UI SQLite quick_check is ok, with six-flow DB/file readbacks. Root inspected the restored Side history beside the selected empty Main; raw bootstrap/style warnings remain disclosed. Cross-slice source inspection is in `CROSS-SLICE-INSPECTION.md`.

Fresh final reviewer `/root/review05_final_integration_2` returned **CLEAN**, no material findings or new advisories. Its independent scope, evidence and lifecycle are recorded in `FINAL-REVIEW-02.md`. All required implementation gates are complete.

## Deviation accounting

Every original criterion, actual touch, reason, file surface, observable effect, test, risk and downstream consequence is retained in the following canonical records; final root classifications below include the verified05D repair and fresh acceptance.

| IDs | Root classification / effect |
|---|---|
|05A D1–D6|accepted: explicit group operations; atomic singleton journal/delete repair; serialized bounded capacity; executable backend runner; shared evidence root; activation failure metadata rollback|
|05B B1/B2/B4/B5|accepted: exchange-transaction mirror invalidation/revisionACK; lease/deletion failure repair; asynchronous placementACK containment; executable recovery lane and explicit isolated adapters|
|05B B3/B6|downstream_impact resolved in05C/D: shared admission and cross-generation busy protection, final facade/line-limit/Wiki closure|
|05C C1/C3–C7|accepted: narrow identities/context/capabilities; terminal gate; relocated stage hooks; real SQLite failure proof; shared evidence root; completed orphan cleanup|
|05C C2|downstream_impact resolved in05D: exact eager activation ownership and final WS router decomposition|
|05D D01–D06/D08–D11/D13–D15/D17/D18|accepted: coherent facade/query/transport closure, executable graph/staging/UI, stale fixture reconciliation, truthful Stop save delivery and exit ownership, exact Side reconnect, Wiki/evidence containment, and bounded timeout and listener cleanup repair. Full original/actual/reason/files/tests/risk contracts are in05D/DEVIATIONS.md and root assessment.|
|05D D07/D12/D16|downstream_impact: baseline-reproduced fresh-workspace no-reload issue; unknown SQLite lock; unknown single restart hydration observation. Accept D16 stronger bounded hydration oracle and diagnostics, preserve original unknown cause.|

The earlier test-temp cleanup gap is addressed by confining TMPDIR/TMP/TEMP beneath each owned staged root; no deletion of historical host temporary directories is claimed. Stale migration/request fixtures follow accepted045/request-aware behavior while preserving fault/FK/rollback/no-runtime assertions. Full isolated server staging uses real provider source and preserves native pretest; deterministic provider substitution applies only to owned GUI computation.

## Verification adapters and skipped work

GUI evidence declares a deterministic provider and bounded fault injection in owned stages; full server executes real provider source with each test's own mocks. Installed dependency links remain confined to private stages, with no download. Direct-handler fixtures lacking a group resolver retain a minimal fixture-only fallback; real managers validate membership through group service. Adapter removal requires equivalent repeatable owned provider/fault setup or migration of direct fixtures to full group service. No temporary production bypass was added.

No new test/check skip. Older standalone smokes were not launched against the live development profile; owned authenticated UI covers the required behavior. Build retains its existing chunk-size warning. Historical failed/intermediate runs remain available and are superseded only where current bytes invalidated them.

## Residual limitations and later work

- Fresh-workspace New Chat without the established authenticated post-create reload returned view_not_found before group creation. Restoring accepted05C server bytes in an owned diagnostic reproduced it. No05D cause or timing fix is claimed. The required lifecycle gate uses a loaded workspace with the documented reload precondition; carry the separate issue to supervisor/owner.
- Isolated direct SQLite readback intermittently reported database locked. The holder/root cause was not captured before cleanup, so remains unknown. Retained failed runs and subsequent passing runs do not establish a fix. New bounded holder/file/server-log diagnostics must remain for recurrence.
- One late-draft postrestart probe observed zero bubbles without sufficient error correlation. Two unchanged diagnostic repetitions passed; the final fixture awaits exact history/error rather than a fixed500ms. Original cause remains unknown. Current full submission passes do not establish a product or timing fix.
- A real save arriving after the 30s post-timeout delivery deadline requires existing history/reconnect recovery; no later live ACK delivery is guaranteed.
- Iterator settlement beyond 5s or metadata failure retains the exact retiring session and requires explicit retirement retry; unlimited automatic recovery is not claimed.
- UI bootstrap/style warnings remain in raw evidence; required lifecycle assertions pass without claiming zero console errors.
- Failed durable persistence never produces a fabricated saved ACK. An exact partial in-memory snapshot does not promise crash recovery for a write that failed. Mirror recovery after unavailable storage requires subsequent activation/retry.
- The existing empty Kimi TODO placeholder remains skipped and is not passing behavior evidence. Applicable full server tests still run unfiltered with native pretest.
- GUI verification uses a declared deterministic provider; it proves actual Electron/authenticated WS/UI/SQLite/file lifecycle, not external provider quality.
- SPEC06 performance/45-minute mixed soak, native/IME input and explicit owner freeze-symptom acceptance remain later work. No claim closes the original owner symptom.

## Lifecycle and handoff boundary

Fresh builders were used for05A/B/C/D with one writer at a time. Each accepted slice has a separate fresh builder reviewer and root acceptance reviewer. Missing close_agent is recorded as unavailable; terminal children remain lifecycle evidence. 05D final builder reviewer /root/builder05d/review05d_waiter and root acceptance reviewer /root/review05d_acceptance_3 are terminal CLEAN; earlier failed/repaired passes remain recorded. Final integration reviewer `/root/review05_final_integration_2` is terminal CLEAN. All reviewers performed independent read-only checks; first clean ended each gate.

No commit, push, Alpha sync/build/install/restart, live profile/database mutation, owner Fusion window operation, fixed port3001, unrelated process termination, dependency download or SPEC06 execution is authorized or claimed. Final disposition: **SPEC_READY_FOR_SUPERVISOR_REVIEW**. Do not begin SPEC06 until the supervisor handoff and explicit owner acceptance checkpoint are complete.
