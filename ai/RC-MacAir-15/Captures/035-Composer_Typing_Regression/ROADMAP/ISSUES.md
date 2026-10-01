# Issue ledger

| ID | Evidence class and issue | State | Owner / dependency impact |
| --- | --- | --- | --- |
| AR-001 | Measured per-key history render amplification; current settled 68 chars took 36.5s, 136 long tasks, no WS traffic | open | SPEC-04; SPEC-01 must reproduce; gates 06 |
| AR-002 | Source-level pending marker before silently rejected enqueue; spinner/disabled input outcome needs public-route reproduction | open | SPEC-02 after 01 |
| AR-003 | Production explicitTarget excludes event consumers while SendToChatButton/SystemViewer still emit | open | SPEC-03 after 01; public-route reproduction required |
| AR-004 | Nested creation/prompt-resolution listeners lack complete correlation/lifetime policy | open | SPEC-03; callbacks must move to the command owner |
| AR-005 | useLegacyChatHost aggregates independent concerns and update frequencies | open | SPEC-02/03/04; final removal gate |
| AR-006 | ThreadManager combines transactions/session policy/mirror/recovery; other long runtime files need responsibility evidence | open | SPEC-05; no size-only verdict or wholesale rewrite |
| AR-007 | Original hard freeze and recent onset not fully attributed; diagnostic and native input evidence missing | open | SPEC-01 capture; final SPEC-06 owner gate, never silently deferred |
| AR-008 | Source/wiki drift: old Legacy production description and current view-bound direction | open | Per-SPEC doc updates + 06 final reconciliation; do not edit other wiki program bytes wholesale |
| AR-009 | No attempt identity/durable admission receipt exists for reliable lost-ACK recovery | open | SPEC-02; bounded schema/protocol change under AR-P01 |
| AR-010 | Pending recovery UX decision AR-P01 | awaiting_owner | Candidate finalization; recommended proposal documented consistently, not approved |
| AR-011 | Historical baseline-red tests and old standalone HTTP auth assumptions | open | SPEC-01 inventory/runner; affected failures cannot be waived |

Allowed issue states: open, awaiting_owner, propagated_pending_review, validated, deferred, blocked. A claim can be disproved; record evidence and adjust affected scope under the owner-approved observable contracts rather than forcing a patch for a nonexistent bug.

## Explicit non-blocking deferrals

| ID | Deferred scope | Owner / future gate | Why it does not block this program |
| --- | --- | --- | --- |
| AR-F01 | Alpha distribution, commit/push | Product owner; explicit separate request after acceptance | Development verification can finish without altering dogfood app |
| AR-F02 | General provenance/event-bus platform redesign | Provenance program owner; own roadmap | Preserve existing boundaries and measure traffic; no evidence requires redesign for the reproduced lag |
| AR-F03 | Pending New Chat/provider-signal-gated creation | Product owner; existing future New Chat scope | Preserve accepted eager creation while repairing its routing |
| AR-F04 | Unrelated Office SPEC-12 and non-chat God files | Their owning programs; separate approval | Protect their bytes; audit is limited to chat and mechanically affected callers |
| AR-F05 | Mandatory virtualization | Chat rendering owner; measured failure of defined workload | Consumer isolation/caching may satisfy acceptance without changing copy/search/scroll semantics |

None of AR-001–011 is declared non-blocking by this table. Any later deferral affecting an acceptance contract requires exact owner decision and affected review.
