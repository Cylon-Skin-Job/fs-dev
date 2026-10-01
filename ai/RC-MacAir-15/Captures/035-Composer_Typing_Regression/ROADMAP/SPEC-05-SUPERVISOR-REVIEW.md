# SPEC-05 supervisor review

Candidate: `CHAT-AR-4641ca5897f0`. Review date: 2026-09-24 PDT. State: `owner_review`; SPEC-06 remains blocked pending explicit owner acceptance.

## Contract and integrated result

SPEC-05 was to decompose backend lifecycle, persistence, mirror/recovery and turn orchestration responsibilities without creating a second runtime map, duplicate worksurface store, provider rewrite or generic provenance redesign. Its ordered slices 05A–05D delivered focused owners while preserving the accepted SPEC-02 receipt/acceptance contract, SPEC-03 exact action/correlation contract and SPEC-04 renderer/session-host boundary.

`ThreadManager` is now a workspace-qualified 263-line facade. Explicit owners cover session lifecycle and capacity, group transactions and leases, session metadata, mirror projection and cleanup journals, startup reconciliation, runtime activation, prompt admission/dispatch, Stop and automation. `ThreadRuntimeManager` remains the sole canonical runtime map. Group mutation policy and the exclusive lease remain in the group service; canonical exchange persistence and prompt receipt/activity acceptance remain with their existing owners. The WebSocket layer delegates provider binding, public action execution and passive exact-member history reads rather than absorbing those policies.

The canonical handoff is `SPEC-05-IMPLEMENTATION-REPORT.md`; slice reports, review records, deviations and raw receipts are under `evidence/spec-05/` and the shared isolated runner artifact tree. No SPEC-06 work was started.

## Slice and review outcome

- 05A moved session create/delete/capacity and transaction primitives behind explicit lifecycle/repository operations. Seven create-write rollback points, activation metadata rollback, singleton deletion rollback, duplicate commands and bounded concurrent capacity are covered. Its 15-file manifest and both review gates were clean.
- 05B established the focused chatlog mirror and deletion-recovery owner. Mirror invalidation shares the canonical exchange transaction; conditional acknowledgements apply only to the captured revision; deletion/file/outbox failures remain durable and retryable. Its 24-file manifest and both review gates were clean.
- 05C separated activation, prompt admission, dispatch, Stop and automation owners using immutable workspace/runtime/thread/turn/drain identities. Late work cannot recreate retired runtime state or clear replacement drains. Its 27-file manifest and both review gates were clean before 05D's actual UI findings caused affected behavior to be revalidated.
- 05D closed the facade, repository and transport boundaries; published the bounded owner graph; added isolated full-server staging and the actual UI lifecycle; and reconciled affected Chat Wiki sections. Builder and orchestrator review found and repaired Stop save-ack ordering, provider-exit contention, Stop timeout cleanup, exact Side reconnect hydration, accepted pre-begin drain recovery and helper-owned termination-listener accumulation. Each repair was returned to the owning builder, affected evidence was invalidated and rerun, and the current 78-file 05D candidate received fresh clean builder and orchestrator acceptance. The final fresh integration reviewer returned `CLEAN` with no finding or new advisory.

## Evidence inspected

- Supervisor independently verified all 105 integrated hashes against `evidence/spec-05/INTEGRATED-SOURCE-SHA256.txt`; its digest is `da6ecbffec10d9f79951ecf6c2fb65996eb2a8ebfb341c5f26bd31458ca4ea73`. The canonical report hash is `d5f6cfa506f25a125e0660160e398d5c8e43a8ed235ee2b069f41c6dda0c27cd`. Scoped `git diff --check` passes. The checkout remains intentionally uncommitted at HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, with unrelated owner/concurrent changes preserved.
- Final V-BACKEND `chat-arch-1790255487009-f51dcf83f5` passed all six cases: owner graph 2 tests, exact-member hydration 4, actual UI 6 flows, runtime 26 suites/550 tests, mirror recovery 24 suites/413 tests and session lifecycle 15 suites/282 tests.
- The actual authenticated Electron flow passed Create, Send, Stop, Move, Side reconnect/history hydration and Delete. SQL/file readback proved the accepted receipt/exchange and interrupted partial, retained original Side history with a new empty Main, exact two-member state, and removal of the group, sessions, receipts, mirrors and worksurface placement. SQLite quick-check was `ok`; owned roots and the port file were removed.
- Final V-SUBMIT `chat-arch-1790255544092-3ef44b09e3` passed all seven cases. Final V-ACTIONS `chat-arch-1790255639018-264b288937` passed all six cases. The client build passed with the existing large-chunk advisory.
- The full isolated server run `server-full-1790255827447-30e97acc` ran unfiltered `npm test -- --runInBand` after the required native compile/link pretest: 214/214 suites and 3,180 tests passed, with the one pre-existing empty Kimi compatibility TODO skip retained. Architecture/lifecycle checks passed 17/17.
- Final evidence audit found no current manifest mismatch, no leaked owned PID and no remaining owned stage/profile/workspace/temp root. Full-server and backend stage manifests match all 1,607 current dependencies.
- Fresh final reviewer `/root/review05_final_integration_2` independently inspected current source, cross-slice contracts, raw receipts, cleanup and deviations and returned terminal `CLEAN` with no material finding or advisory.

## Deviation decisions and downstream packet corrections

| Departure | Supervisor classification | Downstream action |
| --- | --- | --- |
| Explicit lifecycle/repository/group operations, executable backend runner and shared isolated evidence roots | `accepted_no_downstream_impact` | Mechanically required ownership and verification boundaries; accepted public behavior is preserved. |
| Atomic singleton deletion journal, mirror invalidation/revision acknowledgement and file/outbox retry mechanics | `accepted_no_downstream_impact` | These implement the approved persistence/recovery contract without a second durable owner. |
| Shared admission/deletion lease reservation and exact cross-generation busy protection | `accepted_update_downstream_packet` | SPEC-06 must preserve fresh owned-row validation, `IN_FLIGHT` reservation and exact generation/drain fencing in integrated fault/soak tests. |
| Focused runtime activation/admission/dispatch/Stop/automation modules and eager activation ownership | `accepted_no_downstream_impact` after current-SPEC repair | `ThreadRuntimeManager` remains sole state authority; final full gates cover interactive and automation consumers. |
| Stop save-effect grace, exact provider retirement and finite genuine late-saved-event delivery | `accepted_update_downstream_packet` | SPEC-06 must preserve truthful save failure, exact identity guards, replacement isolation, 3-second effect grace, finite 30-second delivery bound and reconnect/history recovery after the bound. |
| Provider-exit reconciliation, accepted pre-begin drain recovery and helper-owned waiter disposal | `accepted_update_downstream_packet` | SPEC-06 fault/soak work must exercise repeated timeout/retry, late exit, metadata/iterator failure and prove no listener/session/runtime growth. |
| Passive `historyOnly` exact Side-member hydration | `accepted_no_downstream_impact` | Necessary to preserve existing Move/reconnect behavior; it performs no warm and does not change selected Main/group or consume pending user opens. |
| Full-server staging, owner graph, actual UI lane and scoped Chat Wiki reconciliation | `accepted_no_downstream_impact` | Required 05D integration and evidence closure; no product authority moved into test or docs code. |
| Fresh-workspace no-reload failure, intermittent SQLite lock and one late-draft observation with unknown causes | `accepted_update_downstream_packet` as unresolved diagnostics | Preserve the bounded diagnostics and exact residual statements; do not claim these causes are fixed. SPEC-06 should distinguish recurrence from the accepted reload precondition and passing bounded hydration oracle. |

No accepted prerequisite is invalidated and no owner design ruling is required. The Stop and reconnect findings were required compatibility repairs within SPEC-05, not product-direction changes.

## Residual risks and owner gate

- A freshly created workspace still needs the established authenticated post-create reload before New Chat; a no-reload diagnostic reproduced `view_not_found`. This is retained as a separate pre-existing issue, not claimed fixed by SPEC-05.
- One isolated direct SQLite readback reported `database is locked`; the holder was not captured. Subsequent passes do not establish a cause or fix.
- One late-draft restart probe observed no bubble without sufficient correlation. Two unchanged repetitions passed, and the final oracle waits for exact history or correlated rejection, but the original cause remains unknown.
- A genuine save after the 30-second late-delivery window relies on normal history/reconnect recovery. Iterator settlement beyond five seconds or persistent metadata failure retains the exact owner for explicit retirement retry rather than promising unlimited automatic recovery.
- Raw UI bootstrap/style warnings remain disclosed. The full suite retains one pre-existing empty Kimi TODO skip. Deterministic GUI provider evidence does not certify external provider availability or performance.
- SPEC-06 still owns V-ALL, the 45-minute mixed soak, native/IME input and explicit owner acceptance of the original freeze/typing symptoms.

No live development or Alpha profile/database, fixed port 3001, owner Fusion window, destructive migration, dependency download, commit, push, Alpha operation or SPEC-06 implementation was used.

SPEC-05 meets its backend lifecycle and persistence-ownership acceptance boundary on current evidence. The owner must explicitly accept this review before the supervisor may dispatch SPEC-06 in a fresh independent orchestrator task.
