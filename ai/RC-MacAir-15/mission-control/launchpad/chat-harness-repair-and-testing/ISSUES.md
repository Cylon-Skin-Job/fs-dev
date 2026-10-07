# Chat Harness Repair and Testing — sourced gaps

> Six imported findings supply starting points. Prior observations and proposed checks are distinct; this folder has not reproduced a current defect or assigned product repair.

## Harness behavior and verification

### I-001 — Structured-error reporting needs a bounded proof

- **Category:** harness error reporting
- **Type:** gap
- **Severity:** unassessed
- **Status:** deferred
- **Source:** [REF-002](REFERENCES.md#ref-002--october-5-harness-and-build-handoff), item 1; [REF-004](REFERENCES.md#ref-004--targeted-source-conversation-reads), original controlled probes and first-item discussion.
- **Observation:** Reported OpenCode v1.18.32 local-provider probes rejected 401 after one attempt and persistent 429 after six attempts/five retries. Both direct JSON runs emitted structured error frames and exit 1. Offline replay through the then-current Fusion adapter emitted no canonical Fusion event, leaving generic process-exit feedback. A controlled 401 says nothing about the owner's live key.
- **Affected scope:** Follow-on OpenCode adapter error reporting and testing.
- **Consequence:** The observed adapter boundary loses useful failure details; the probes do not establish the owner's live incident cause.
- **Resolution needed:** Reproduce on the exact post-closeout baseline and agree on the safe canonical/user-visible result. Proposed check: pass controlled terminal 401 and exhausted 429 frames through the actual adapter route, compare native frame to Fusion event and terminal display, and retain successful-completion coverage. Translation through the existing error contract was an assistant proposal, not an approved repair.
- **Owner:** Future owner-designated harness session; unassigned. Owner decides consequential product choices.
- **Next:** Continue the prior first-item discussion here. Assign reproduction/repair after current-build closeout and a scoped owner decision; the named raw probe file is now absent.
- **Related:** I-002, I-003, [CAPTURE](CAPTURE.md), [D-003](DECISIONS.md#d-003--bring-the-existing-opencode-failure-mode-work-into-this-ticket).

### I-002 — Retry state is not visible through the tested JSON mode

- **Category:** harness execution visibility
- **Type:** observed_mode_gap
- **Severity:** unassessed
- **Status:** deferred
- **Source:** [REF-002](REFERENCES.md#ref-002--october-5-harness-and-build-handoff), item 2; [REF-004](REFERENCES.md#ref-004--targeted-source-conversation-reads), probe matrix and retry discussion.
- **Observation:** OpenCode v1.18.32 direct JSON output reported success after 429 then success (two attempts), without a retry notification. Headless event streaming exposed retry attempts 1–5 and incremental text. The source discussion described bounded backoff/Retry-After and socket closure as retryable; 401 did not retry in the fixture.
- **Affected scope:** Fusion's distinction between an active retry, completion and terminal harness failure; later mode selection and adapter verification.
- **Consequence:** Fusion cannot reliably display retry state from a signal omitted by the tested input stream. Delay alone cannot establish retry or terminal failure.
- **Resolution needed:** Decide what retry visibility is required and which supported OpenCode surface can supply evidence. Proposed check: compare native events and Fusion state for success, retry-then-success and exhausted retry on the selected mode. Do not invent retry state or duplicate provider retry policy in transport.
- **Owner:** Future owner-designated harness session; unassigned. Owner decides consequential product choices.
- **Next:** Recheck version and actual launch mode after build closeout; recreate missing fixtures before treating the historical matrix as an executable test.
- **Related:** I-001, I-004, I-005, [CAPTURE](CAPTURE.md), [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work).

### I-003 — Accepted-prompt recovery and fresh reopen have unresolved gaps

- **Category:** acceptance and recovery
- **Type:** source_backed_gap
- **Severity:** high (historical investigation assessment; current applicability pending)
- **Status:** deferred
- **Source:** Source-native CHAT-AR I-008; [CHAT-AR-INV-001 F1/F2](../chat-integration-and-retirement/investigations/CHAT-AR-INV-001/report.md) and [CHAT-AR-INV-002](../chat-integration-and-retirement/investigations/CHAT-AR-INV-002/report.md) at [REF-005](REFERENCES.md#ref-005--historical-recovery-and-fallback-investigations); later [REF-004](REFERENCES.md#ref-004--targeted-source-conversation-reads) discussion; handoff item 3.
- **Observation:** Historical source projects a dispatch-claimed receipt with `provider_failed` as `unknown_after_dispatch_claim`, while foreground `accepted_execution_failed` clears the execution watch/status control. Passive thread-open hydration includes history/exchanges/live turn but not accepted receipts; a fresh renderer after pre-`turn_begin` failure with no exchange/live turn may lack the accepted prompt. The exact fresh-reopen route was not reproduced. Earlier false-send/enqueue status handling was already addressed by intervening CHAT-SIMPLE work and is excluded.
- **Affected scope:** Durable accepted-prompt visibility, foreground recovery, reconnect/reopen, exact-thread status readback and future view/plugin consumers.
- **Consequence:** The user may be told to review a conversation without a useful status control or visible accepted prompt. Blind resend can compound execution uncertainty.
- **Resolution needed:** Recheck both edges independently. Proposed public-route scenario: accept an exact request, fail before provider output/`turn_begin`/exchange, inspect foreground error/status, restart renderer, reopen exact `threadId`, and compare receipt with visible conversation. Preserve server-owned acceptance, exact identity, no duplicate bubbles and no automatic redispatch; `provider_failed` alone does not prove provider nonreceipt.
- **Owner:** Future owner-designated harness session; unassigned. Owner decides consequential product choices.
- **Next:** Reconcile historical source hashes with the accepted post-closeout baseline, then scope reproduction and recovery outcomes. Original issue/report IDs remain unchanged; this record tracks the imported follow-on concern.
- **Related:** I-001, I-006, [CAPTURE](CAPTURE.md), [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work).

### I-004 — Attached CLI can miss final events saved by the headless server

- **Category:** harness mode and completion
- **Type:** observed_mode_gap
- **Severity:** unassessed
- **Status:** deferred
- **Source:** [REF-002](REFERENCES.md#ref-002--october-5-harness-and-build-handoff), item 4; [REF-004](REFERENCES.md#ref-004--targeted-source-conversation-reads), original controlled probes.
- **Observation:** In the reported v1.18.32 attach probe, the headless server saved the completed answer or error while the attached CLI exited before forwarding final events. The raw trace/fixture was not recovered at the handoff's named temporary path.
- **Affected scope:** Any later supported attach path, completion/error forwarding and durable terminal-state observation.
- **Consequence:** CLI exit/output alone may not describe the saved server outcome in that mode. The probe does not establish that Fusion used the path or that it caused a live incident.
- **Resolution needed:** Establish whether the actual or proposed Fusion launch path uses attachment before selecting a product repair. Proposed check, if applicable: correlate attached output/exit with server terminal events and saved session state for one exact request.
- **Owner:** Future owner-designated harness session; unassigned. Owner decides consequential product choices.
- **Next:** Determine mode relevance after current-build closeout; defer attach repair if outside supported scope.
- **Related:** I-002, [CAPTURE](CAPTURE.md), [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work).

### I-005 — Intermittent Together socket failure has unresolved attribution

- **Category:** provider and connection diagnosis
- **Type:** observed_failure_with_attribution_gap
- **Severity:** unassessed
- **Status:** deferred
- **Source:** [REF-002](REFERENCES.md#ref-002--october-5-harness-and-build-handoff), item 5; [REF-004](REFERENCES.md#ref-004--targeted-source-conversation-reads), credential, resumed-session and connection-comparison turns.
- **Observation:** The source chat reports September 30 socket-close errors followed by successful retries in two Together-backed sessions. One loaded config before its last edit and the other afterward; both used the inspected model. Credential inspection found one Together credential and no observed key rotation. Later comparisons succeeded 8/8 with normal reuse and 8/8 with fresh connections, zero retries, with idle pauses up to 30 seconds. Socket sampling could not identify the closing peer; packet capture was unavailable. Python-route HTML 403 did not establish Together authentication failure because native OpenCode succeeded.
- **Affected scope:** Intermittent provider/network behavior, session/config attribution and evidence needed to diagnose a later failure.
- **Consequence:** Key fallback, stale config, connection reuse, server warming and provider attribution remain unsupported incident explanations. Successful comparisons do not disprove intermittent failure.
- **Resolution needed:** Obtain a bounded trace of an actual failure on an authorized test session: exact request, selected model/credential source, error class, retry and final outcome. Keep provider/network/reuse hypotheses distinct and record content-safe metadata.
- **Owner:** Future owner-designated harness session; unassigned. Owner decides consequential product choices.
- **Next:** Carry the historical finding without assigning a cause. After build closeout, select a bounded check if the symptom recurs or affects the selected repair; the original comparison summary is absent.
- **Related:** I-001, I-002, [CAPTURE](CAPTURE.md), [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work).

### I-006 — Metadata lookup failure can silently select another harness

- **Category:** harness identity and routing
- **Type:** conditional_source_backed_risk
- **Severity:** unassessed
- **Status:** deferred
- **Source:** [CHAT-AR-INV-002](../chat-integration-and-retirement/investigations/CHAT-AR-INV-002/report.md), ranked hypothesis 3, at [REF-005](REFERENCES.md#ref-005--historical-recovery-and-fallback-investigations); [REF-002](REFERENCES.md#ref-002--october-5-harness-and-build-handoff), item 6; source-native CHAT-AR I-007 context.
- **Observation:** September 28 source inspection found `harness/compat.js` catching a harness metadata DB lookup error and returning `harnessId: 'kimi'`; warmup can then start that harness. The report says a wire/thread harness mismatch check in `runtime-dispatch.js` can skip optional turn authority and continue. No evidence shows the branch ran in the incident; post-closeout source was not checked here.
- **Affected scope:** Persisted thread harness identity, metadata failure handling, actual wire selection and failure classification.
- **Consequence:** If still reachable, metadata failure can obscure configured/persisted harness identity and complicate diagnosis. This differs from provider model retention and the unsupported two-key fallback theory.
- **Resolution needed:** Recheck reachability and applicable failure policy on the accepted baseline. Proposed check: induce a metadata lookup error in an isolated fixture and compare persisted thread identity with actual selected wire. Owner intent must settle consequential fallback behavior; the hypothesis does not approve a routing redesign.
- **Owner:** Future owner-designated harness session; unassigned. Owner decides consequential product choices.
- **Next:** Retain as a conditional candidate. Investigate only in a later scoped assignment, preserving OpenCode-only policy and canonical thread identity.
- **Related:** I-003, [CAPTURE](CAPTURE.md), [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work).

Imported by Codex side chat (ephemeral); evidence checked 2026-10-05T16:47:32Z. All six await baseline reconciliation and product assignment; no proposed check above was run in this intake.
