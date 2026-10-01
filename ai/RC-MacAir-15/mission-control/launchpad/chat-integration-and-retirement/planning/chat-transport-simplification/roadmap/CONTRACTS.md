# Shared contracts and execution gates

## Applicability and authority

This file is normative for all three SPECs and all four slices. [ROADMAP](ROADMAP.md) owns order, coverage, authority classifications and deferrals; [OWNERSHIP-AND-VERIFICATION](OWNERSHIP-AND-VERIFICATION.md) owns the finite migration/regression matrix and exact checks. [SOURCES](SOURCES.json) identifies external source revisions. No current implementation is declared approved merely because it is preserved during this bounded refactor.

## Maintained guidance and documentation ownership

All source paths in this section are relative to `/Users/rccurtrightjr./projects/fs-dev`. The active Wiki root is `ai/RC-MacAir-15/Wiki/` (`W` below). Every builder/reviewer reads the current exact source, including local Wiki AGENTS before a later authorized Wiki edit. The source map is an expansion rule for exact paths, not a different authority.

| Key | Exact path under W | Applicability |
| --- | --- | --- |
| PREF | `000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md` | All: reuse/deep modules, purpose over lines, preserve future repair, attended consequential gates. |
| S0 | `005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` | All: router and shared rules. |
| S1 | `005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md` | All: existing dispatcher/domain ownership. |
| S2 | `005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md` | C1-B/C2/C3: connected actions, portable identity, existing UI. C1-A preserves consumer contract. |
| S3 | `005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md` | All: single owner, correlation and hydration. |
| S4 | `005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md` | All: canonical wire families, authoritative ACK/fan-out. |
| S5 | `005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md` | All: preservation of command/fact and post-commit isolation. |
| S6 | `005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md` | All: preserve adapter/provider boundary; no new adapter behavior. |
| S7 | `005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md` | All: manager/receipt/exchange authority, no new persistence writer. |
| S8 | `005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md` | All: exercise public paths, readback and failure isolation. |
| CHAT | `007-Chat_System/000-Overview_and_References/PAGE.md` | All: mandatory overview and accepted baseline. |
| RUNTIME | `007-Chat_System/006-Runtime_Model/PAGE.md` | All: lifecycle, binding, acceptance and Stop. |
| STRUCTURE | `007-Chat_System/007-Structure/PAGE.md` | All: owner map. |
| PROTOCOL | `007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md` | All: public routes, identity, correlation and redaction. |
| TESTING | `007-Chat_System/005-Testing_And_Operations/PAGE.md` | All: affected public-route and final shared-contract verification. |
| CHANGELOG | `007-Chat_System/000-Overview_and_References/004-Changelog/PAGE.md` | Each delivered slice records only its actual bounded change if a dated entry is warranted. |
| ACTIONS | `007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md` | All: authoritative action/receipt owner and durable effects. |

The author read PREF, S0–S8 and CHAT/RUNTIME/STRUCTURE/PROTOCOL/ACTIONS. No exact rule is superseded by this candidate. Modules target fewer than 400 lines with one coherent responsibility. A cohesive exception needs its concrete complexity tradeoff documented and independently reviewed; splitting by line count or creating another catch-all is a failure. No mandatory new service/bus layer is justified where an existing focused owner fits.

Documentation is part of each slice: C1-A updates STRUCTURE's server owners and any RUNTIME/PROTOCOL owner references it moves; C1-B updates STRUCTURE's client owners and connection/dispatch references. C2 owns PROTOCOL's truthful local outcome distinction and STRUCTURE's unified sender/caller boundary. C3 owns PROTOCOL/RUNTIME's inquiry outcomes, timer/correlation limitations, and Testing And Operations guidance for its new checks. Each slice reports an explicit unchanged-with-reason disposition for relevant pages whose contract did not change. Add a bounded dated Changelog entry only for delivered work. No article may claim the deferred failure map, runtime symptom or plugin contract has been solved.

This candidate moves private existing transport mechanics and consumes an existing receipt query. It adds no cross-capability publisher, subscriber, plugin executor, event family or persistence schema. Existing Chat facts remain existing legacy facts; local result values are not governed facts or server ACKs. If implementation needs a new capability, hold that addition and plan against `W/010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md`, `W/010-Events_And_Ledger/003-Provenance_Model/PAGE.md` and S5; missing foundations cannot become an undocumented bypass.

## Preserved invariants

- One existing user-text path: exact-session action → `chatSlice.sendMessage` → canonical `prompt`. `message:sent` alone commits the accepted user bubble and submitted draft/attachment snapshot; no local transport result proves acceptance, provider start or completion.
- One deliberate prompt attempt retains its immutable request ID, workspace/thread identity, input/attachment snapshot and acknowledged portable model selection. No automatic prompt resend, no provider cancellation on status-query failure, no local Stop terminalization.
- Server receipt admission, same-attempt lock, group activity persistence, runtime/dispatch claims, workspace-operation lease, private trusted role and exact workspace/root/epoch checks remain at their existing owners. Provider translation/retry remains below the adapter boundary.
- Canonical wire families and payloads stay compatible. Group/view/session/surface identities stay distinct; live routes retain `threadId + turnId + streamSeq` with frontier checks before state mutation. Passive/historyOnly open does not create or activate a provider or change Main selection.
- Connection generation and socket ownership gate all callbacks. Domain response precedence, diagnostic redaction before logging, exact listener cleanup and post-commit requester/peer/fact isolation remain observable. Removal of an old path means delete migrated behavior, not maintain two implementations.
- Preserve the two-second live-turn visible-wait hourglass and its reveal/terminal clearance. Receipt inquiry timeout is separate; no new Working/retry/liveness dialogue or timer policy is introduced.
- No schema/data migration, runtime database cleanup, logger expansion, broad renderer split, adapter change or external plugin API. Preserve `temp_chat_boundary_v1` content-free best-effort behavior and `TEMP CHAT-AR I-007` delete/migrate marker for future governed health work.

## Execution packet inherited by every slice

Each SPEC's slices incorporate this entire section by exact reference. Before execution, verify approved candidate ID/receipt, accepted predecessor evidence, actual memory CWD, separate implementation checkout/branch, root model/effort, effective tool permissions/capacity, applicable AGENTS and current source hashes. Resolve a moved checkout explicitly; never implement by assuming the memory CWD grants product ownership. Establish an isolated verification profile/fixture, preserving the owner's running development/Alpha app and data. Capture dirty baseline and concurrent writers; a source difference requires impact review and affected revalidation, not blind overwrite or automatic whole-plan invalidation.

Assign a **fresh `mc-spec-slice-builder`** to exactly one named slice and its exact write scope. The builder implements that slice plus mechanically necessary omitted integration, self-reviews, runs required checks, records every deviation with downstream effect, and obtains a materially clean builder-owned review before returning `READY_FOR_ORCHESTRATOR_REVIEW`. The builder may spawn only fresh `clean-room-reviewer` threads, never another builder. Repair forward after material findings and stop after the first clean pass; there is no arbitrary pass ceiling. Read-only evidence cannot substitute for required runtime checks, and a blocked check is reported honestly.

The SPEC orchestrator independently inspects the current work and assigns fresh `clean-room-reviewer` passes. Stop after the first materially clean pass; otherwise return material repairs through a builder, fresh builder-owned review, and fresh orchestrator-owned review. Every new slice uses a new builder. All descendants inherit the invoking root thread's model and reasoning effort. Verify the actual reviewer capability before starting the gate; unavailable independent review is a reported hold, never author self-certification.

Every return names changed paths; input/output/source/build fingerprints; exact commands and observations; passed/failed/blocked checks; warnings and whether pre-existing; removed paths; deviations, consequences and residuals; Wiki changes; independent review identities and evidence. The orchestrator reports all deviations/downstream effects at SPEC completion. The supervisor presents that SPEC to the owner and obtains **explicit acceptance before starting the next SPEC**. A clean reviewer, earlier draft approval or planning authorization is not owner acceptance.

Implementation may repair routine technical deviations within approved observable scope and preserved deferrals. Material owner decisions (changed retry/resend/cancel policy, degraded authority, externally frozen recovery contract, or impaired deferred repair) return through the supervisor. No Git publication, Alpha operation, recurring monitor or unrelated task is conferred by the execution packet.

## Unified local send result — C2 producer contract

R1 is resolved by this private typed result, not a wire schema:

```ts
type ProductSendResult =
  | { status: 'enqueued'; destination: 'socket' | 'auth_queue' }
  | { status: 'uncertain'; reason: 'send_failed_after_enqueue' | 'send_outcome_unknown' }
  | { status: 'not_enqueued'; reason:
      'disconnected' | 'retired' | 'stale_connection' |
      'binding_unavailable' | 'stale_binding' | 'auth_not_ready' |
      'serialization_failed' | 'queue_refused' | 'send_failed_before_enqueue' };
```

Prompt's `no_target`/`invalid_request` remain domain validation results before transport. Result reasons are closed fixed values, never exception messages, prompts, credentials or diagnostic content. `enqueued/socket` means native send returned normally; `enqueued/auth_queue` means only local queue custody. Neither proves server receipt, persistence, accepted turn or eventual flush.

Use a focused private `C/src/lib/ws/product-send.ts` boundary (C = fusion-studio-client). It owns product serialization, expected-context validation and result production using narrowly installed connection capabilities; it imports neither the inbound router nor the whole store. `ws-client.ts` owns install/retire lifecycle. Extend the existing `shell-auth-client.ts` actual socket-send/queue machinery to report rich outcomes before its current caught-false information is lost. There remains one physical product-send implementation for the migrated chat callers and generic wrappers; deliberate unrelated raw non-chat exclusions in the inventory are outside that unification claim. Auth proof is a distinct internal lane. Existing `sendFusionMessage` may keep a live non-chat boolean signature as an explicit mapping over those same mechanics, never a second native send and never an object returned to boolean callers.

Every chat invocation supplies canonical payload plus local expected context from its domain owner: explicit workspace ID, captured connection/socket generation and installed workspace binding epoch/revision. A small capture helper may read current lifecycle context, but cannot derive a target from whichever chat is focused. Validate at admission and immediately before queue flush. Missing binding refuses workspace-bound work; beginInit invalidates the token even when visible workspace ID remains. Same-ID rebinding and A→B→A cannot make old work current. These local guards add no authority fields to wire payloads and do not duplicate server group/member validation.

Each caller explicitly selects `socket_only` or `auth_queue_allowed` according to the admission table. No generic default silently broadens admission. Socket-only requires the current authenticated product lane; an OPEN transport alone is insufficient. Existing raw callers never gain pre-auth storage. The current bootstrap constraint is that auth activation installs the store socket and delivers buffered workspace:init before its final authenticated phase; receipt recovery may therefore queue against the just-installed valid binding. `hasReceivedInit` waits for an asynchronous Electron projection, so it is not the queue binding gate.

Preserve the existing auth queue's FIFO and 64-frame/1,048,576-byte limits. Each queued item captures immutable payload and exact local context; flush revalidates it without retargeting. Stale binding item is discarded. Auth failure, overflow, retirement or generation replacement clears retained frames; a new connection never inherits/replays them. A flush send exception retains fail/close behavior and drops remaining frames. Previously returned queue admission does not become original-prompt rejection. Existing bounded domain timeout/retirement handles unanswered queue work; no new completion-callback or persisted transport receipt is required.

Serialization failure occurs before native send and is definitely not_enqueued. At the lowest actual send, preserve prompt's current local buffer-observation classification: an increase in bufferedAmount after throw yields uncertain; a known pre-enqueue failure with reliable unchanged observation yields send_failed_before_enqueue. If that evidence cannot establish the local condition (including wrappers or unavailable observation), return send_outcome_unknown. Never flatten authenticator caught false into proof that nothing left. Synchronous send-triggered retirement or response may run before return; a caller must recheck its captured entry/generation before scheduling later work.

## Receipt inquiry outcome — C3 consumer contract

Keep the existing recovery controller, its acceptance and accepted-execution watch kinds, 15-second initial/start deadlines, 5-second inquiry wait budget and status-only retry schedule 1/2/4/8/15 seconds. Only status requests retry with the original attempt's request ID. No original prompt replay, Stop or provider cancel follows any local inquiry result.

| Event | Existing presentation/attempt state | Required waiting and response eligibility |
| --- | --- | --- |
| not_enqueued | Acceptance pending becomes unknown with existing paused-send feedback; execution remains accepted with existing executionUnknown feedback/event. Draft/attachments and original send gate stay. | Release this inquiry lock immediately; no 5s response deadline. Existing bounded status retry only on current qualified binding. No new response eligibility; retain prior same-generation eligibility if an earlier possible inquiry exists. |
| uncertain or enqueued/socket | Existing checking feedback; original acceptance/accepted phase unchanged. | Current generation becomes response-eligible; at most one 5s inquiry deadline if still current after send. |
| enqueued/auth_queue | Same checking feedback, meaning bounded inquiry wait budget, not proven socket transmission. | Same deadline/eligibility. Later drop/refusal uses timeout/unknown or binding retirement; never declares original prompt unsent. |
| 5s deadline | Existing unknown/executionUnknown feedback. | Release waiting lock and schedule existing status retry; preserve possible late reply eligibility. |
| Exact eligible receipt, including after timeout/exhaustion | Existing accepted/rejected/cancelled/reserved and execution policies apply. | Cancel response deadline and scheduled retry before processing; settle once or schedule only the existing nonterminal follow-up. |
| Binding invalidation/replacement, retirement, session removal, replacement attempt or settled/live turn | Existing suspend/settle semantics. | Clear both waiting and response eligibility plus timers. New current binding explicitly resumes only its qualified attempt. |

R3 requires one minimal bookkeeping separation: `inFlightGeneration` continues to own the single waiting inquiry; an additional `responseEligibleGeneration` (or equivalent) tracks whether any query for this attempt/current binding may answer. This is a **necessary changed behavior**: current code clears inFlight at timeout and drops a late matching reply, contrary to the accepted draft's late reconciliation requirement. No new UX or broad receipt state machine is introduced. Generation must also advance/retire on workspace epoch/revision invalidation, not only workspace ID change.

Correlate exact workspace/thread/original request, current recovery generation/binding and accepted turn ID for execution watches. All repeated inquiries query the same server receipt, so no per-query wire ID is added. An unsolicited response without eligible query is ignored. A later definitely refused inquiry cannot erase eligibility from an earlier possible send. Prepare provisional eligibility before send for synchronous fixtures; on definite refusal remove only newly provisional eligibility, preserving earlier eligibility. After send, require the same entry/request/generation and still-active inquiry before arming a deadline. Synchronous ACK/response/close therefore cannot leave an orphan timer.

Authoritative missing receipt can fence the original attempt through the existing server owner. Only that matched server rejected/cancelled outcome can release the original pending/unknown send gate under existing behavior. Preserve `not_dispatched`, `unknown_after_dispatch_claim`, `failed_before_dispatch`, `interrupted_before_dispatch` and turn-begin handling as current recovery mappings; their wider correctness/UX remains D-005.
