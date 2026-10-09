# 05D acceptance, ownership and failure matrix

This map is builder evidence for approved SPEC05/05D, not orchestrator acceptance. Exact changed files are `changed-files.json`; exact preedit bytes are in `preedit/`, not GitHEAD. `OWNER-GRAPH.json` is the explicit affected-owner inventory with external immediate edges. It includes final frontend history owners because the required reconnect gate exposed their necessary integration.

## Ownership map

| Concern | Authority / call direction | Evidence |
|---|---|---|
| Workspace-qualified session facade | ThreadManager constructs explicit session/mirror/group capabilities and delegates; it has no transaction/recovery loops, counter/config/rename policy or private adapter bypass. |263lines; backend owner contract plus full suite. |
| Group mutation lease | `thread-groups/group-mutation-lease` remains shared admission owner. `session-transactions`, move/member/delete services use this established lease. |Concurrent/duplicate lifecycle, Move/delete and prompt admission integration tests. |
| Session create transaction | Group service/session-transactions retains membership/primary/activity transaction; SessionLifecycle stages session row via session-repository and mirror journal with caller trx. |Rollback and duplicate/concurrent create/group tests. |
| Delete transaction | Group delete service fences/drains; delete-transaction owns passed-trx group/member/session/receipt/tombstone/projection-outbox changes. |Delete recovery, receipt cascade, late-provider and worksurface cleanup tests. |
| SQL query owners | Session repository owns session row writes; structural group repository plus action-result, projection-outbox and mirror repositories each own their distinct SQL concerns. Reexports preserve dynamic test fault seam. |Full suite preserves transaction rollback, conditional ACK, recovery and file outbox assertions. |
| Canonical runtime | ThreadRuntimeManager remains single canonical map. Runtime activation/admission/dispatch/stop and automation use captured object/key/drain revision authority. SessionManager owns only provider/session records, not a second canonical state. |Interleaved/replaced/generation-fenced drains, automation, Stop and late callbacks in backend runtime case. |
| Provider/session cleanup | SessionLifecycle owns capacity, activation metadata and row lifecycle; SessionManager owns exact process session reservation; provider-termination owns bounded signal/exit helper. Explicit Stop token/closePromise and observed exit reconcile only exact session. |Runtime real-bus Stop barrier and session late-exit/replacement regressions. |
| Receipt/exchange durability | Accepted SPEC02 prompt service/repository owns idempotent request receipts; HistoryFile/canonical audit effect remains exchange durable writer. No independent mirror write can acknowledge a terminal save. |Submission seven cases; HistoryFile rollback/saveACK/receipt tests; UI count and receipt readback. |
| Disposable chatlogs | ChatlogMirror/MirrorJournal plus narrow mirror repository own materialization/retry; startup reconciliation invokes recovery with explicit workspace/root. |Faults between SQL, file write and ACK; restart/retry; exact mirror paths and cleanup. |
| File-backed worksurface outbox | Placement delivery/projection-outbox repository and existing view state owner remain file projection authority; no second SQL view state. |Move source history/new Main cold portable config, Delete files/outbox recovery. |
| Passive exact member history | Coordinator captures explicit open/read/metadata capabilities; open handler uses resolver's exact thread target; historyOnly does not select/warm. Renderer exact history hydrator cannot consume Main open intent. |Real public Move route, two-group store regression, actual Side reload UI. |

## Criteria and fault mapping

| Criterion / branch | Executable proof |
|---|---|
| Create/open/warm/close/capacity remain public compatible; passive zero activation | `thread-group-lifecycle`, `thread-activation-lifecycle`, `session-manager`, privileged public route; full backend session case. |
| Rollback at SQL failure and duplicate/concurrent command | Group lifecycle/delete recovery/Move/worksurface and prompt recovery integration; full server. |
| Mirror write/delete/ACK failure and restart recovery | HistoryFile, audit-subscriber-chatlog-finalize, chatlog sync/path, group delete recovery; backend mirror case. |
| Authorized delete removes receipts; no late resurrection | Prompt submission recovery, group delete recovery, worksurface cleanup, exact runtime fences. |
| Busy Move/delete and provider admission serialization | Move side chat integration; group lifecycle; actual UI waits real save and retirement before Move. |
| Interleaved/replaced drain, activation failure, late generation | Runtime-controller/automation, canonical bridge/applier, prompt canonical route, activation lifecycle. |
| Delayed Stop save, failed save, replacement, timeout | Runtime-controller real event-bus exact identity tests, explicit3s grace plus actual SessionManager/OpenCode proxy recovery, exact late ACK and30s listener/timer bound; actual stopped partial ACK and Move. |
| Actual exit during active Stop, after failed Stop or failed metadata; replacement after await | Session-manager regressions pin token reservation, observed-exit reconciliation, queued/deferred drain replacement isolation and metadata-before-release. |
| Passive source member after Move, preserving selected other Main and pending requests | Move public route test checks source exchanges/current primary/provider; chat-surface-identity store regression checks different selected group and same-group pending request; actual reloaded Side prompt. |
| Architecture shape and limits | Owner detector sensitivity fixtures + graph (CommonJS/ESM) and existing architecture-contract tests. Static proof is supplementary to public behavior. |

## Actual UI flow map

`r8-ui-electron.mjs`, launched by full backend via owned supervisor, copied source, private profile/migrated DB/workspace, ephemeral port and real Electron authentication. Adapter controls provider output only. No store mutation or private endpoint creates the tested lifecycle outcome.

| Flow | Actual UI and readback |
|---|---|
| Create | Create Project UI, established postcreate authenticated reload, Capture New Chat. One group/session and mirror; composer becomes enabled after eager readiness. |
| Send | Fill composer, click Send message; visible server-accepted user bubble and provider text; one receipt, one matching exchange. |
| Stop | Click Stop generating while output is active; exact interrupted partial exchange and actual chat-turn:saved observed; one terminal frame; await provider retirement. |
| Move | Chat options → Move Chat to Side Chat; two members, old source preserved, new Main has no exchanges, worksurface state.json contains exact source. Retained moved screenshot. |
| Reconnect | Real reload/same private profile/authentication, select Capture, click Side Chat. Exact original prompt visible and still one exchange. Retained restored screenshot on final run. |
| Delete | Actual Thread options → Delete with confirmation; rail row removed; zero groups, members, threads, exchanges, receipts; both mirrors and worksurface entry removed. |

UI evidence asserts actual message/terminal/ACK counts, authentication count, final quick_check=ok and exact owned cleanup. It also retains existing initialization console errors without claiming a clean browser-console blanket. Fresh-workspace no-reload New Chat reproduction is D07, distinct from this gate's documented precondition. D12 retains the isolated single read-lock attribution limit.

Final timeout correction: D15 supersedes initial timeout-retains-STOPPING behavior. Runtime-stop always attempts exact provider termination after3s effect grace; terminal-saved-delivery retains only a bounded truthful ACK transport, with shared event-local actual-delivery receipt and cancelable existing effect wait. All new production owners participate in the explicit affected graph.

Final D17 observed-exit recovery proof: `exited-drain-retirement.test.js` adds12 real lifecycle sequence cases (accepted pre-turn_begin drain, actual bound Stop/provider deadline, fulfilled/rejected/delayed iterator, timeout+retry, metadata+retry, active token, session/wire/epoch/runtime/drain replacement and replacement during suspension). Full backend12 runtime26/550 and the current unfiltered server gate execute them; canonical drain mutation remains owned by ThreadRuntimeManager.

D18 finite operation cleanup: `provider-termination.test.js` adds six cases for evented helper waiter disposal on success/failure, three actual SessionManager double-timeout retries, preserved exact SessionLifecycle observer/unrelated listener identities, late exit recovery, custom termination authority/rejection and replacement isolation. Existing cancellation runs in finally; provider lifetime/admission truth and escalation policy are unchanged. Focused final-repair1 and full backend12 exercise the new suite, with native pretest; current full-server and Node evidence is indexed in CURRENT-REPORT.
