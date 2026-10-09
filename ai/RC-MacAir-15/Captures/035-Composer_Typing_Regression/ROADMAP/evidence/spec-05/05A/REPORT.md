# SPEC-05 / 05A builder handoff

Candidate CHAT-AR-4641ca5897f0. Branch agent/exact-workspace-paths; HEAD 88637d11c65be53d4f2ad0f049f64a07fa3db1de. Accepted SPEC-01–04 dirty bytes preserved. Scope: 05A session lifecycle and group transaction boundary only. Builder `/root/builder05a`. Builder gate CLEAN on current bytes; READY_FOR_ORCHESTRATOR_REVIEW. Orchestrator acceptance remains separate.

## Changed files and owner map

Exact 15-file inventory: changed-files.json. Exact original-byte diff: slice.diff. SOURCE-SHA256.txt identifies current bytes. baseline/ contains all twelve preexisting touched files, including accepted dirty source. BASELINE-CHECK.json proves every baseline copy matches the orchestrator's START-SOURCE-SHA256 (some originals reconstructed by reversing the exact edits, verified by those hashes).

- New `lib/thread/session-lifecycle.js` (204 lines): session row/journal staging, provider claim/activation metadata, close/Stop completion, shutdown, capacity policy. Depends on explicit workspace/root identity, ThreadIndex, SessionManager, session repository, existing group journal repository, canonical ThreadRuntimeManager. Receives no ThreadManager or group service.
- New `lib/thread/session-repository.js` (28 lines): workspace-qualified session SQL using caller's transaction.
- New `lib/thread-groups/session-transactions.js` (85 lines): initial group creation and singleton removal transaction/lease owner. Calls explicit lifecycle operations; owns membership/primary/initial activity/action result writes.
- `lib/thread/ThreadManager.js`: workspace-qualified composition and delegation for extracted operations; existing mirror/recovery and group deletion bodies remain for ordered 05B/05D work. Group deletion now delegates row deletion to lifecycle repository boundary.
- `lib/thread-groups/service.js`, `move-service.js`, `member-service.js`, `selection-service.js`, `link-service.js`, `delete-service.js`: group domain receives workspace/root plus named operations, no retained full manager reference. Existing lease, action result, placement, and prompt activity behavior preserved.
- `test/thread/thread-group-lifecycle.test.js`: seven insert fault points, two activation metadata fault points, three singleton deletion fault points, duplicate create/delete readback.
- `test/thread/session-manager.test.js`: concurrent different-thread capacity admission/retirement coverage.
- `test/ws/prompt-submission-recovery.integration.test.js`: construct explicit group operations for existing receipt/activity test; oracle unchanged.
- `e2e/chat-architecture/run.mjs`, `server-focused-regressions.mjs`: executable R8-SESSION-LIFECYCLE runner case with owned copied stage and required native pretest. Existing focused ten suites plus session manager and submission recovery suites. Catalog use receives a marked child directory, so cleanup preserves the shared suite root for subsequent cases.

Acyclic path: public WS router → existing domain handler → ThreadManager facade → group transaction owner / SessionLifecycle → repositories using initialized transaction. SessionLifecycle → SessionManager and ThreadRuntimeManager for canonical live state/drain retirement. Group action owners → named operations → existing persistence/mirror recovery owners. No second runtime map, independent connection, worksurface SQL snapshot, or provider-specific logic added.

## Acceptance mapping and evidence

| 05A contract | Evidence |
|---|---|
| Narrow session create/delete/capacity API, no full manager dependency | Three new bounded modules; `ThreadGroupService` explicit operations; slice.diff |
| Group owns initial membership, primary, activity and mutation lease | session-transactions transaction; existing Move/Delete lease retained; focused group/Move suites |
| Eager create, selected session, passive open zero warm, warm/close behavior | thread-activation-lifecycle, privileged-thread-public-route, thread-group-lifecycle, session-manager tests; V-SUBMIT actual authenticated Electron creation/activation and cleanup |
| Atomic receipt/activity and claim-before-dispatch unchanged | prompt-submission-recovery + prompt-canonical-route suites; full V-SUBMIT durable receipts/status/reconnect |
| Rollback each creation DB failure | SQLite abort triggers at threads/group/member/primary/activity/mirror/action-result writes; all seven tables empty and no mirror after rejection |
| Rollback singleton deletion failures | Abort at journal insert/session delete/group delete retains session/group/member/mirror, no delete journal |
| Duplicate/concurrent mutation exactly once | Concurrent duplicate fixed session/group creation produces one fulfillment/one unique rejection, one session/group/activity; concurrent delete returns true/false and one delete journal; existing duplicate Move/Delete public-route suites |
| Concurrent capacity bounded and no stranded activation | Two different pending targets cannot evict/await each other; one settled LRU is killed once under concurrent requests; terminal count bounded and shutdown zero |
| Readback/restart and no unrelated damage | Group reconciliation across fresh manager; existing delete recovery and mirror/worksurface suites; V-SUBMIT restart and reconnect; source baseline equality |

## Exact checks and raw results

1. `node --check fusion-studio-server/lib/thread/ThreadManager.js`, `node --check fusion-studio-server/lib/thread/session-lifecycle.js`, `node --check fusion-studio-server/lib/thread-groups/session-transactions.js`: passed after extraction.
2. `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite backend --mode enforce --cases R8-SESSION-LIFECYCLE`: final run `chat-arch-1790239308422-d7368490e4`, PASS, 12/12 Jest suites, 209/209 tests, 6.887 seconds Jest duration. Actual copied-stage command is `npm test -- --runInBand --runTestsByPath test/ws/prompt-canonical-route.integration.test.js test/ws/privileged-thread-public-route.integration.test.js test/thread/thread-runtime-controller.test.js test/thread/thread-activation-lifecycle.test.js test/thread/thread-crud-active-turn-reconnect.test.js test/thread/thread-group-lifecycle.test.js test/thread/thread-group-delete-recovery.test.js test/thread/thread-manager-chatlog-sync.test.js test/ws/thread-group-move-side-chat.integration.test.js test/ws/thread-group-worksurface-cleanup.integration.test.js test/thread/session-manager.test.js test/ws/prompt-submission-recovery.integration.test.js`.
3. `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite submit --mode enforce`: run `chat-arch-1790239219947-899d51ba36`, PASS, seven executable cases: R2-NO-ENQUEUE (two fault scenarios), R3-LOST-ACK-STATUS, R3-RECONNECT-UI, R4-DISTINCT-ATTEMPTS, R4-DISTINCT-RECEIPTS, R4-LATE-DRAFT-RECOVERY, R4-DUPLICATE-MISMATCH. Actual authenticated Electron/public router/SQLite evidence retained, not helper-only mocks.

RUNS.json and receipts/<run-id>/ contain copied raw manifest/results/logs. Original runner raw roots remain under evidence/spec-01/01B and are linked in RUNS.json. Each manifest records commands, source hashes, owned PID/token, profile/root, versions, ephemeral endpoints. All recorded executions (including repair iterations) removed owned run root and recorded zero leaked owned PIDs. Staged `npm test` invoked native `node-gyp` pretest successfully; no native pretest bypass or large runtime asset fallback. Node 25 emits existing `--localstorage-file` warning; no product failure. Builder ran workloads sequentially and coordinated with orchestrator. The final two isolated server correctness reruns were dispatched near each other; their process timing receipts are retained. No controlled benchmark or build-performance workload overlapped. Server suite wall time is not presented as a performance measurement.

## Self-review and repairs

- Inspected current source, integration paths and initial dirty status before editing; read complete selected SPEC/packet, root/server AGENTS, standards hub and 001/003/004/005/006/007/008 routes, Chat overview/runtime/persistence and exchange storage references. Approval recorded by release manifest and supervisor dispatch despite historical draft labels.
- Initial backend run failed ten new fault-test assertions because native SQLite errors do not satisfy Jest's cross-realm `toThrow` matcher. Switched to rejected object's exact message match; all ten rollback/readback assertions then passed (205 tests before capacity additions). No product relaxation.
- Fixed demonstrated preexisting raw singleton deletion split transaction/swallowed journal-error hazard while moving its canonical delete primitive. Removal now uses shared group lease and one SQL transaction.
- Root inspection identified concurrent capacity admissions could select pending peers, wait on each other's activation completion, or evict the same LRU twice. Added serial capacity decisions, excluded pending activations as victims, and bounded `session_capacity` rejection when no eligible settled victim exists; retained synchronous exact provider claim and rollback. New concurrent tests pass. Current cumulative backend and submission gates rerun afterward.
- Verified all new production files below 400 lines; no whole ThreadManager dependency passed to extracted owners or group service; no changed provider syntax, runtime map, receipt authority, view snapshot authority, or wire identities.

- Further self-review confirmed new activation failure after `index.activate` could leave SQLite active when `markResumed` failed. Failed new activation now invokes lifecycle close after resolving its activation barrier, preserving canonical drain retirement and durable suspended state. Two real SQLite trigger tests prove status suspended, resumed_at null, provider released, and unchanged group MRU. Later cumulative runs supersede prior 207-test evidence.
- Session delete repository preserves the original raw index deletion workspace/project-scope qualification; explicit creation identity wins over incidental option keys.

## Deviations and downstream impact (proposals; orchestrator decides)

| ID | Original contract / actual touch | Reason, effect, tests | Proposed classification and downstream |
|---|---|---|---|
| 05A-D1 | Advisory expected areas include group/session services; five existing group helpers and receipt fixture changed to use named operations | Necessary to actually remove full-manager dependency; only member accesses change; full focused routes and receipt suite pass | accepted; 05B/C/D use `service.operations` and explicit `service.projectRoot` |
| 05A-D2 | Preserve lifecycle behavior and prove rollback; raw delete previously suppressed journal errors and split deletion | Atomically retain journal/session/group on fault; session-transactions + ThreadManager + lifecycle and rollback tests | accepted correctness repair; 05B must keep this lease/transaction guarantee while extracting journals/recovery |
| 05A-D3 | Preserve capacity and bounded concurrent commands; existing implementation could deadlock pending admissions | Serialize eviction, exclude pending victims, expose bounded session_capacity when no settled victim; SessionLifecycle and session-manager tests | accepted correctness repair; callers retain existing activation error handling, 05C preserve exact rollback/drain identity; no new UI/protocol family |
| 05A-D4 | V-BACKEND was a reserved inventory-only enforce failure | Added actual R8-SESSION-LIFECYCLE copied-stage case; existing native pretest and process supervisor reused; adds 2 relevant focused suites beyond mandatory 3 | accepted validation integration; 05B/C/D must activate remaining R8 matrix/full backend gate, not treat inventory assertion as behavior proof |
| 05A-D6 | Preserve create/open/warm/close behavior and DB rollback; activation metadata failure cleanup omitted suspended persistence | Route failed new activation through canonical lifecycle close; lifecycle and real DB fault tests | accepted correctness repair; 05C must retain cleanup ordering and exact ownership |
| 05A-D5 | Evidence root requested spec-05/05A; existing runner writes spec-01/01B | Kept established runner location and copied JSON/log raw receipts under this slice; source manifest explicitly captures current changed files | accepted evidence adapter; no runtime/product effect, later slices may choose root routing |

No new migration. No receipt retention/schema change. No owner decision required. No semantic changes to provider selection, eager creation, view/group/session identities or Main/Side rules. Remaining existing ThreadManager group attach/mirror/delete bodies are intentionally later ordered slices, not a claim that final facade closure is complete. ThreadIndex.create/delete remain preexisting raw metadata APIs with no production callers; only a harness-config unit fixture uses create. Carry retirement/delegation of those dormant APIs to 05D dead-adapter closure. Chat wiki reconciliation is explicitly assigned 05D; this report supplies its owner map without touching concurrent provenance prose.

## Skipped checks, adapters, residual risks

Full V-BACKEND unfiltered, full server suite, V-ACTIONS, V-BUILD and actual UI Move/delete/reconnect integration acceptance belong to 05D; not claimed for 05A. Full backend inventory case remains fail-closed pending remaining slices. No standalone dev server or owner-window manual smoke run: required runtime evidence uses authenticated isolated Electron V-SUBMIT and staged public-route suites instead. No native-input/soak claim (SPEC-06).

Temporary test adapter: existing staged deterministic harness/fault seams unchanged; no test-only production route. Narrow lazy lifecycle composition supports existing focused fixtures built with ThreadManager.prototype without exposing manager internals; the same owner is used by real instances. Remaining risks: broad 05B mirror/deletion recovery and 05C runtime decomposition not implemented by this slice; capacity contenders may receive bounded retryable errors while all possible victims are pending rather than queue indefinitely. Existing runtime retirement/provider termination deadlines retained.

Forbidden operations confirmation: no live dev/Alpha database/profile write, port 3001, owner Fusion window interaction, unrelated process termination, destructive migration, commit, push, Alpha operation or SPEC-06 work.

## Builder review lifecycle

Pass 1: `/root/builder05a/review05a`, fresh read-only clean-room-reviewer, fork_turns none, no model/effort override, CLEAN with no material findings. Reviewed current source/diff/immediate callers and raw gates; reused evidence, ran no tests, modified no files, spawned no descendants. Terminal completed status confirmed by list_agents. close_agent was searched before and after review and is unavailable; no closure attempt can be called. Recorded in REVIEW-LIFECYCLE.json and BUILDER-REVIEW-01.md. No prior reviewer exists; stop after this first materially clean pass. Current source manifest rechecked 15/15 matching before handoff.
