# CHAT-SIMPLE-03 — Consume receipt inquiry send outcomes

## Objective and complete packet

Fix the concrete ignored false-send seam: a definitely refused status inquiry promptly uses existing unknown feedback instead of starting a five-second response wait. A possibly transmitted inquiry remains uncertain and can reconcile a late exact receipt. This is D-004's third outcome and draft C3-A; it does not redesign accepted/no-response UX or diagnose provider failures.

Normatively incorporate [ROADMAP](ROADMAP.md), [CONTRACTS](CONTRACTS.md) in full, [OWNERSHIP-AND-VERIFICATION](OWNERSHIP-AND-VERIFICATION.md) and [SOURCES](SOURCES.json). CONTRACTS **Execution packet inherited by every slice** applies directly. Exact S0/S1–S8 and PREF/CHAT/RUNTIME/STRUCTURE/PROTOCOL/ACTIONS references there govern this independent packet; no supersession. Candidate approval and a separate owner-started implementation task are required.

Prerequisite: approved candidate plus completed, reviewed and **owner-accepted CHAT-SIMPLE-02** with its typed outcome/admission contract, full migrated caller inventory and current source/build evidence. Confirm actual accepted files before use. Preserve owner-accepted CHAT-AR SPEC-06 and D-005 deferral.

## C3-A — Existing recovery consumes truthful inquiry results

**Fresh builder write scope:** `C/src/lib/chat/prompt-submission-recovery.ts`; sender/lifecycle wiring in C1/C2 transport and `C/src/lib/ws/workspace-handlers.ts` only where required to observe binding invalidation/resume; result types, focused recovery/public-route tests and assigned Wiki updates. `C` means `fusion-studio-client`. Existing submission store/presentation remain owners and need changes only for necessary integration, not new UI labels/states. Server receipt projection/schema/runtime/adapter behavior is unchanged.

**Public path:** existing scheduled receipt recovery or visible Check status → existing recovery controller → C2 real transport → existing `thread:action/prompt_receipt_status` server owner → qualified current receipt response → existing submission/execution feedback and correlation. Both acceptance and accepted-execution watches consume the same local result contract.

Implement CONTRACTS **Receipt inquiry outcome — C3 consumer contract** in full. Definite refusal clears only the current waiting inquiry, immediately invokes existing unknown/executionUnknown behavior and schedules the existing bounded status-only retry where current. Arm no response deadline for that refusal. Uncertain/socket/queue outcomes retain checking and at most one five-second budget, explicitly not proof of wire delivery. Existing initial 15-second and retry schedule remain unchanged.

Separate waiting lock from possible-response eligibility with the minimum per-entry marker. **Necessary bounded changed behavior:** timeout currently erases eligibility and loses a late exact reply; preserve possible inquiry eligibility through timeout/retry exhaustion and a later definite refusal, while retaining current identity fences. This follows the reviewed draft's late-response requirement and is not a general receipt lifecycle redesign.

Correlate exact attempt/workspace/thread/current binding generation and accepted turn ID when applicable. Before processing an eligible response, cancel its active response timer and retry; apply existing authoritative receipt/execution mapping exactly once. A synchronous response/ACK/retirement during send cannot be followed by an orphan timer. Invalidation on workspace epoch/revision change, including same-ID rebind, retires eligibility; qualified resume queries the same original request only. No per-query protocol field is introduced.

## Acceptance and failure branches

- Definite inquiry refusal in both watch kinds displays existing unknown feedback promptly; no five-second waiting timer exists, and the original attempt retains its pending/unknown send gate or accepted phase as appropriate.
- Enqueued/socket, enqueued/auth_queue and uncertain retain one bounded inquiry wait; queue failure/drop uses existing timeout or retirement. None authorizes original prompt replay, draft loss, acceptance rejection, provider cancellation or fabricated assistant reply.
- Matching receipt during waiting, timeout-to-retry gap, after retry exhaustion, or after a later definitely refused inquiry can reconcile once only when prior possible-send eligibility remains current. Unsolicited/no-eligible, wrong request/thread/workspace/turn and retired generation cannot mutate.
- ACK/turn_begin/terminal/new attempt/session removal/manual recheck/reconnect/workspace A→B→A/same-ID rebind cannot leave an orphan deadline, duplicate bubble, deleted revised draft or stale result. Only existing server rejected/cancelled mapping permits a new deliberate attempt.
- Preserve current execution status mappings and live-turn begin end-of-watch behavior. The unknown/provider_failed/readback/accepted-no-exchange gaps remain D-005. No new Working label, elapsed retry UI, hourglass effect or provider retry policy.
- Existing retry schedule sends only receipt-status actions with the original request ID. Assert exact outgoing message counts; no prompt or Stop is sent by this fix.

## Verification and documentation

Run V1, V5, V7, V8, V9 native receipt scenarios and static searches from ownership/verification on final integrated bytes. Add `e2e/prompt-submission-recovery.spec.ts` exercising the actual rich transport/recovery/UI boundary for every branch above, both watch kinds and both user/manual and scheduled entry. Server receipt-service tests support authoritative fencing/readback; native isolated real WS/SQLite scenarios establish public-route behavior. Retain current visible-wait timing tests. No live user draft or development database is used.

Update PROTOCOL and RUNTIME with local inquiry-result semantics, preserved acceptance/Stop/no-replay boundaries, late eligibility and limitations. Update Testing And Operations with the exact new checks/source evidence, plus STRUCTURE only if owner references moved. Preserve temporary sink deletion/migration annotation and all D-005 limitations; documentation does not claim the reported render freeze or OpenCode launch failure fixed.

CONTRACTS execution gates apply in full: fresh builder implements/inspects, records every deviation, runs required checks and obtains fresh builder-owned clean-room review before `READY_FOR_ORCHESTRATOR_REVIEW`; orchestrator independently inspects and obtains fresh clean-room review. Material repairs return through builder plus both fresh gates; stop after first clean pass, no arbitrary ceiling. Descendants inherit root model/effort.

## Integration and final handoff

No schema/data/consumer API migration is needed. Final output includes actual source/build hashes, truthful commands/results, scenario evidence, cleanup, Wiki changes, removed ignored-result path, deviations and residual limitations. Owner explicitly accepts completed SPEC-03 before this sequence is called complete. The separate parked failure-map task is then eligible for owner resumption; this packet does not create/resume it or certify its outcomes. Implementation remains held for a separate owner-started task.
