# Follow-up issues

> Sourced residuals and consequential gaps. Closure acceptance does not resolve these technically.

## Verification and rendering

### I-001 — Original final gates were not completed

Source: CHAT-AR SPEC-06 implementation report, evidence and closure addendum; D-001.
Status: transferred to [chat integration and retirement](../chat-integration-and-retirement/ISSUES.md); non-blocking for owner closure. This record is a source-preserving pointer, not a second live issue owner.
The real 45-minute soak, complete native/original-symptom verification and 06C retirement/final integrated review were not completed as originally required. Bounded automated/native evidence and human usage do not substitute. A successor plan must inventory remaining retirement obligations, identify current-byte regressions and decide appropriate verification; do not blindly retire code or mark checks passed.

### I-002 — Render backlog and runtime observations need follow-up

Source: owner dogfooding and [instant-collapse report](../../../Captures/035-Composer_Typing_Regression/ROADMAP/evidence/spec-06/06B/INSTANT-COLLAPSE/ROOT-REPORT.md).
Status: open.
Skipping collapse when a later segment exists does not establish the desired one-or-two-chunk maximum reveal lag. Record arrival, queue depth, reveal progress, stage and terminal outcome separately before attributing stalls to harness or renderer. Isolated window closure is not by itself a crash diagnosis. Bookmark/time/build references support bounded investigations; lack of a bookmark is not proof no issue occurred.

## Foundation and logger

### I-003 — Governed foundation is bounded, not generic plugin registration

Source: current UEB, taxonomy and provenance wiki; admission, handler catalog, capability factory and startup source.
Status: open dependency; shared contract owner is [governed events and ledger](../governed-events-and-ledger/TICKET.md).
Four governed fact publishers and built-in subscribers exist; general chat/render health schemas, health-store append capabilities and general plugin/view registration do not follow automatically. Existing legacy chat emit/on and full-content chat audit are not safe health subscriptions. Extend the foundation explicitly; do not bypass it.

### I-004 — Logger candidate needs architecture and measurement rebase

Source: HL release manifest and D-003/D-004.
Status: held for replanning in this health-consumer folder, dependent on the [plugin foundation](../plugin-foundation/TICKET.md) and [governed events](../governed-events-and-ledger/TICKET.md).
HL-01-6e4c29f469a4 was cleanly reviewed as a planning candidate but never approved for implementation. Shared numeric ownership with Diagnostics and governed schemas/publishers/capabilities now need explicit contracts. Rebase and re-review before dispatch. Measure once per stage; server arrival and renderer receipt are distinct stages, not duplicate measurements. Display reset/close must not reset or double-count logger state.

Temporary-path retirement dependency (D-006): CHAT-AR has added `temp_chat_boundary_v1` directly to the existing development server log for I-007 diagnosis. The closed fields are stage, UUID thread/turn IDs, fixed harness IDs, PID, selected error/exit codes and presence booleans; after the 08:18 recurrence they also include selected Node/OS error codes, a closed error-name set, bounded errno and environment-ready status. Prompt, argv, path, stderr, provider JSON and raw error text remain excluded. The owning source is [`fusion-studio-server/lib/logging.js`](../../../../../fusion-studio-server/lib/logging.js) with call sites in `lib/harness/opencode/index.js` and `lib/thread/runtime-dispatch.js`; [CHAT-AR REF-009](../chat-integration-and-retirement/REFERENCES.md#ref-009--temporary-content-free-child-boundary-diagnostics) binds current dirty-file hashes, 160 initial and 61 follow-up focused passing tests. The 2026-09-28 08:24 UTC development-app restart activated the expanded classifier; no later affected send has been observed. When the governed subscriber is built, explicitly map any useful fields to its authorized content-free schema and remove this private sink, or delete it if unneeded. Verify there is no duplicate permanent emission and do not promote the temporary server log into the separate health-retention database by inference.

The owner's 08:28–08:31 UTC broken status/navigation report led to a second temporary extension in the same sink: closed prompt frame/denial/routing, receipt-status frame/result/denial, and thread-open request/return/error stages. Its only new correlation identifier is a 32-hex request ID; receipt outcome is a closed enum. Call sites now also include `lib/ws/client-message-router.js`, `lib/ws/thread-action-handler.js` and `lib/ws/thread-ws-handlers.js`. Thirteen focused tests and a client build passed before the 08:40 UTC dev restart. This route extension has the same explicit migration-or-deletion obligation as the child-boundary fields; do not carry it as an ungoverned permanent parallel logger. [CHAT-AR REF-011](../chat-integration-and-retirement/REFERENCES.md#ref-011--broken-status-display-temporary-route-traces-and-diagnostics-timer-review) captures the incident and limits.
