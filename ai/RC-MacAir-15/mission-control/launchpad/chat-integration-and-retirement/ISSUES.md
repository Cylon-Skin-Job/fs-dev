# CHAT-AR integration and retirement — issues

> Sourced gaps and consequential unresolved intent; no implementation defect is inferred from a planning question.

## Scope and contracts

### I-011 — Chat transport and presentation responsibilities exceed code standards

- **Category:** scope and contracts
- **Type:** source_backed_architecture_gap
- **Severity:** medium
- **Status:** open
- **Source:** Owner's 2026-09-28 request to check simplification against the User Profile and Code Standards; current source review at REF-012.
- **Observation:** The standards call for one job per file, a 400-line design goal, reuse of established owners, and provider-neutral presentation. The active server `client-message-router.js` is 918 lines and combines multiplexing with inline prompt validation/admission, view-readiness operations and connection cleanup. Client `ws-client.ts` is 665 lines and combines authenticated connection lifecycle with many domain response branches and store mutations. `stream-handlers.ts` is 509 lines and combines live sequence handling with post-terminal metadata/autocomplete and accepted-prompt error handling. User text prompts have one main client path (`useChatSessionActions` → `chatSlice.sendMessage` → `prompt`); the duplication is in transport writes for other chat intents (open, list, Stop, group actions and status), which send directly on the stored socket in several places while `sendFusionMessage` owns a generation-aware authenticated send result. `prompt-submission-recovery.ts` discards that boolean result by typing the callback as `void`. The 407-line model menu remains largely one visual job, so length alone does not prove it needs splitting; it does read an OpenCode-specific catalog in the presentation component. Existing canonical thread/runtime/adapter owners and small connected surfaces show substantial prior decomposition.
- **Affected scope:** Chat send/open/status reliability, reviewability of route changes, presentation portability, and later plugin/view consumers.
- **Consequence:** A change to one route or connection state can affect unrelated behavior; false send results can be missed, and new consumers may copy provider-specific or legacy assumptions. This is a maintainability and failure-isolation risk, not a proven cause of the current runtime incidents.
- **Resolution needed:** Under D-004, shape the two transport entry files, one acknowledged chat command send boundary and the concrete false-send status-check seam as three bounded candidates. Preserve one central ingress and the live frontier invariant; avoid a line-count-only split or a new generic framework. D-005 parks the broader accepted-prompt recovery and Fusion/OpenCode failure-state redesign for the later task, subject to a precise dependency/compounding-risk check before roadmap release.
- **Owner:** Chat domain for bounded source/route assessment and repair proposal; owner for any changed product interaction or compatibility choice.
- **Next:** Use REF-013's independently reviewed three-candidate draft for Creator research R1–R4 and executable verification design. Complete the caller inventory and preserve explicit transport uncertainty before claiming unified sends. Keep I-007/I-008/I-009 deferred and enforce the stated repair/consumer constraints; preserve the dirty worktree and SPEC-06 acceptance.
- **Related:** I-001, I-005, I-007, I-008, I-009, REF-012, [CAPTURE](CAPTURE.md).

### I-001 — Exact integrated baseline

- **Category:** scope and contracts
- **Type:** gap
- **Severity:** unassessed
- **Status:** open
- **Source:** [SPEC-06 closure addendum](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06-OWNER-CLOSURE-ADDENDUM.md); current setup conversation and linked predecessor records.
- **Observation:** RD-02's 1,997-path source identity matches 1,993 current paths, and its 200-path build identity matches all 200 current dist paths. The four source mismatches are three human-session fixture scripts and one issue record; two additional human-session resume fixtures are outside the manifest. Current product source in the checked client/server paths matches, but no owned candidate or current runtime verification is yet bound to the handoff.
- **Affected scope:** CHAT-AR integration and retirement and named consumers.
- **Consequence:** Plugin consumers cannot safely take HEAD alone as the accepted chat baseline.
- **Resolution needed:** Identify included bytes, later changes, evidence coverage, and a reproducible handoff.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Recheck cited current sources and bring the specific choice or finding into this folder.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).

### I-005 — Legacy open and history compatibility paths

- **Category:** scope and contracts
- **Type:** gap
- **Severity:** unassessed
- **Status:** open
- **Source:** Current `thread-crud.js`, `thread-open-handler.js`, `ThreadManager.js`, `ChatFile.js`, and client `thread-history.ts` at REF-006's observed source identity.
- **Observation:** A manager-without-`threadGroups` target fallback remains in the production open handler; `thread:opened` still includes Markdown-mirror `history`, and the client renders it when SQLite `exchanges` is empty. No supported production scenario or actual stale-display incident was reproduced in this inspection.
- **Affected scope:** Chat open authorization, transcript hydration, retirement and plugin consumer contract map.
- **Consequence:** Removing these paths without checking callers could break compatibility; retaining an unintended fallback could obscure the canonical authority boundary.
- **Resolution needed:** Establish production reachability and supported compatibility need, test the empty-exchange/mirror case, then either retire the paths with affected checks or document their explicit contract and failure behavior.
- **Owner:** Assigned chat domain session for evidence and proposal; owner for consequential compatibility decisions.
- **Next:** Bound a source/caller review and affected test before any production edit.
- **Related:** I-002, REF-006, [CAPTURE](CAPTURE.md).

### I-006 — Side Chat header control crosses the view boundary

- **Category:** scope and contracts
- **Type:** gap
- **Severity:** unassessed
- **Status:** open
- **Source:** [Chat Wiki overview](../../../Wiki/007-Chat_System/000-Overview_and_References/PAGE.md) and [Chat UI](../../../Wiki/007-Chat_System/004-Chat_UI/PAGE.md); current `useChatSessionHost.ts`, `ChatAreaHeader.tsx`, and `useChatSessionActions.ts` at REF-006's observed source identity.
- **Observation:** The documented Side Chat target removes its left “Show threads” control. Current `side-tab` projection always presents a collapsed rail, the header renders that control, and its action toggles the outer view sidebar.
- **Affected scope:** Side Chat presentation and plugin/view consumer host contract.
- **Consequence:** Packaging or copying this header behavior into a first plugin view could make the accepted presentation gap harder to repair and spread outer-view control across the wrong boundary.
- **Resolution needed:** Determine the owned Side Chat control behavior and apply a bounded fix with affected UI checks before a dependent view implementation freezes that contract.
- **Owner:** Chat domain for source-backed repair scope; owner for any changed product interaction; plugin-view domain for consumption sequencing.
- **Next:** Treat as a concrete consumer dependency in the contract handoff and propose the smallest affected UI repair.
- **Related:** I-004, REF-003, REF-006, [CAPTURE](CAPTURE.md).

### I-004 — Effect of deferred work on plugin consumers

- **Category:** scope and contracts
- **Type:** gap
- **Severity:** unassessed
- **Status:** open
- **Source:** [Owner preferences](../../../Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md#scope-and-the-8020-preference); supervisor comparison and D-002 handoff.
- **Observation:** REF-013's current-source draft assessment finds receipt projection/fencing, dispatch, provider adapter and recovery ownership remain separate from transport extraction. Later repair is structurally viable if the three candidates preserve exact identities, acceptance facts and typed uncertainty, without replaying prompts or moving provider retry policy into transport. This bounded inference does not assess a final executable change or release plugin/view recovery consumers; R4 must check actual planned changes and their exact baseline.
- **Affected scope:** Integration/retirement sequencing and the specific chat contracts consumed by plugin and view work.
- **Consequence:** Closing the historical SPEC is not proof that every later migration can safely build over its residuals.
- **Resolution needed:** For each relevant residual, identify the affected boundary and whether repair remains viable after planned consumer changes; sequence prerequisite repair or raise a consequential owner decision if it does not.
- **Owner:** Assigned domain session for evidence; owner for consequential scope/architecture decisions.
- **Next:** Carry the draft's deferral constraints into Creator R4. Hold affected release if a planned change erases identity/uncertainty, compounds known recovery gaps or freezes them behind a consumer API; resolve that specific conflict before release. Keep broader consumer/retirement assessment open without reopening SPEC-06 acceptance.
- **Related:** I-001, I-002, I-003, [CAPTURE](CAPTURE.md), sibling plugin/view tickets.

### I-002 — Retirement and final review

- **Category:** scope and contracts
- **Type:** gap
- **Severity:** unassessed
- **Status:** open
- **Source:** [SPEC-06 closure addendum](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06-OWNER-CLOSURE-ADDENDUM.md); current setup conversation and linked predecessor records.
- **Observation:** The closure addendum transfers 06C retirement and final integrated review without claiming they passed.
- **Affected scope:** CHAT-AR integration and retirement and named consumers.
- **Consequence:** Legacy owners or stale documentation could mislead plugin integration.
- **Resolution needed:** Audit actual current paths, repair only evidenced remaining conflicts, and review the final contract map.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Recheck cited current sources and bring the specific choice or finding into this folder.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).

### I-003 — Verification scope

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** [SPEC-06 closure addendum](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06-OWNER-CLOSURE-ADDENDUM.md); D-003 and linked predecessor records.
- **Observation:** The original 45-minute soak and complete native/original-symptom checks remain historically incomplete. D-003 waives the soak for this successor work; exact affected checks for current repairs and consumer handoff are still to be selected.
- **Affected scope:** CHAT-AR integration and retirement and named consumers.
- **Consequence:** Without a defined affected gate, new repairs or consumer changes could rely on stale source/build evidence.
- **Resolution needed:** Define bounded current-byte integration, affected runtime and documentation checks for the actual changes; retain the unperformed historical native/soak limits honestly.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Turn REF-013's proposed public-route smokes into exact executable checks for the three candidates during Creator work. Record current source/build identity and relevant shared-route regression coverage. The broader integration/consumer gate remains open; do not restart the old soak chain.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).

## Live runtime

### I-009 — Delivery-status display and thread navigation stalled during broken render

- **Category:** live runtime
- **Type:** observed_failure_with_source_backed_gap
- **Severity:** high
- **Status:** open
- **Source:** Owner's 2026-09-28 08:28–08:31 UTC report of “Checking delivery status” followed by a broken render and thread clicks that did not open; read-only development DB/log/process inspection and current client recovery source at REF-011.
- **Observation:** No new durable prompt receipt or child-boundary event was found after the successful 08:26 UTC turn during the reported interval. Without the request ID, the status UI could belong to that earlier accepted attempt or to a new attempt that did not reach the receipt service. The client status path invokes a transport function typed as `void` while its implementation returns a delivery boolean; a false return is ignored and the UI can wait for its five-second status deadline. This is source-backed brittleness, not an established cause of the reported freeze. The owner reported that other threads remained clickable but did not open. Electron and server stayed alive; non-main-frame-specific Electron loading events do not prove a renderer reload loop.
- **Affected scope:** Prompt delivery/status recovery, thread navigation, renderer responsiveness and chat visibility.
- **Consequence:** The user may be left with an uncertain send and no usable navigation; repeated sends could duplicate an accepted prompt.
- **Resolution needed:** Correlate a recurrence across prompt frame, receipt-status frame/result, thread-open request/result and renderer connection using content-free request IDs. Establish whether the client fails to send, the server denies or stalls, or the renderer fails to apply a returned result. Test the false-send status branch and active-tab navigation path before choosing a repair.
- **Owner:** Chat domain for diagnosis and bounded repair; owner for consequential recovery interaction choices.
- **Next:** D-005 parks broad incident diagnosis in the later same-folder task. Candidate C3/R3 retains only the concrete status-send seam, preserving original prompt uncertainty and no replay. Preserve the 08:40 UTC trace and its delete/migrate marker for later correlation; no cause of the render/navigation freeze is established.
- **Related:** I-007, I-008, REF-009, REF-011, [CAPTURE](CAPTURE.md).

### I-010 — Diagnostics sampling and renderer memory attribution

- **Category:** live runtime
- **Type:** investigation_gap
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's question about the 250 ms logger/display monitor; current Diagnostics client/server source and post-restart process sample at REF-011.
- **Observation:** The temporary logger has no interval and writes to one existing log file descriptor. The Diagnostics display samples at 200 ms per mounted tab; the server flushes each live subscription at 100 ms. Both have teardown paths, and client text/server event queues have explicit caps. Diagnostic tabs start empty after a restart and the 200 ms timer only mounts with a selected Diagnostics tab. Renderer PID 77021 measured about 1.27 GB resident immediately after the 08:40 UTC restart, climbed to 2.67 GB within two minutes, then fell to about 0.67 GB by six minutes. This is allocation/reclamation evidence, not a proven accumulating leak or Diagnostics attribution.
- **Affected scope:** Renderer responsiveness, live diagnostic tabs and memory attribution.
- **Consequence:** Large renderer allocations could affect navigation and sends if they recur under pressure, but the current measurements do not establish a leak or a specific timer as the cause.
- **Resolution needed:** Measure renderer memory over time with diagnostic tabs open and closed, and correlate with actual tab/subscription counts and render responsiveness. Review retained surface snapshots and nonterminal turn entries if growth is reproducible.
- **Owner:** Chat/Diagnostics domain for measurement and bounded fix; health folder for eventual governed observability.
- **Next:** Compare process memory on the current app without forcing an automated send; capture a reproducible trend before treating a timer as causal.
- **Related:** I-007, I-009, REF-011.

### I-007 — Accepted messages whose OpenCode response did not start

- **Category:** live runtime
- **Type:** observed_failure
- **Severity:** high
- **Status:** open
- **Source:** Owner-observed warning in this conversation; read-only live development SQLite receipts, OpenCode session/message metadata and current code at REF-007; independent reports at REF-008; recurrent instrumented failure at REF-010.
- **Observation:** Four prompts at 2026-09-28 06:51:30–06:52:43 UTC across two OpenCode threads have `outcome=accepted`, `execution=claimed`, `reason=provider_failed`. The affected threads have no corresponding new OpenCode session/message records at those times, and no persisted harness diagnostic row. The warning text is set by the client's accepted-execution-failure path. A separate isolated OpenCode probe using the configured Together model and Fusion child-environment policy succeeded later. INV-002 confirmed that `wire_ready` binds an in-memory deferred proxy while the OpenCode child is launched per turn; a 15–19 ms receipt lifetime is consistent with a fast failure but does not identify its step. At 08:18 UTC, a new affected turn was logged as synchronous OpenCode `spawn_throw` after durable acceptance/dispatch claim, without a returned PID; its receipt became `provider_failed` in 24 ms. An 08:09 turn on the same thread had launched and closed normally. The thrown code was omitted by the first diagnostic allowlist. The owner reported force reloading Electron around both occurrences, but no causal link is established. The 167 MB database is dominated by historical event data and the server held about 16,100 regular-file descriptors after the incident and shortly after the next restart; neither is established as causal. A metadata-lookup error can silently select a Kimi fallback, but no evidence places that branch in this incident.
- **Affected scope:** Current development app prompt-to-provider execution, saved conversation state and debugging visibility.
- **Consequence:** The user sees committed messages without responses; resending blindly could duplicate accepted prompts, while generic log redaction obscures the actual exception.
- **Resolution needed:** Capture a content-free failure class at the per-turn child boundary: actual harness, spawn attempt/PID/error code, exit state, native output/session-ID presence and session-ID persistence. Distinguish spawn/resource failure, early CLI exit, provider-session binding/persistence failure and harness mismatch before choosing the bounded repair and affected check.
- **Owner:** Chat domain for diagnosis and repair proposal; owner for any consequential behavior change.
- **Next:** Park comprehensive diagnosis under D-005 in the same-folder follow-up task. Preserve the active content-free trace and its delete/migrate obligation; on later owner resumption or a new affected send, correlate `temp_chat_boundary_v1` with the exact receipt and classify the synchronous exception before choosing a repair. Do not resend an accepted prompt blindly.
- **Related:** D-003, I-001, I-003, I-008, REF-007, REF-008, REF-009, REF-010, [CAPTURE](CAPTURE.md).

### I-008 — Accepted prompt recovery after response-start failure

- **Category:** live runtime
- **Type:** source_backed_gap
- **Severity:** high
- **Status:** open
- **Source:** [CHAT-AR-INV-001](investigations/CHAT-AR-INV-001/report.md) at REF-008; current client/server prompt receipt, dispatch, status and thread-open paths; REF-007's accepted/no-exchange incident.
- **Observation:** `provider_failed` after dispatch claim remains `unknown_after_dispatch_claim` on receipt readback, while the foreground `accepted_execution_failed` path clears the client's execution watch and its Check status control. Acceptance commits a receipt and user bubble in the current renderer, but `thread:opened` sends history/exchanges/live turn without accepted receipts; if failure occurs before an exchange or live turn, a fresh renderer may have no source from which to show the accepted prompt. The fresh-renderer state was not reproduced in a route test.
- **Affected scope:** User-visible recovery from accepted-message/no-response errors, reconnect/reopen behavior and future plugin/view chat consumers.
- **Consequence:** A user told to review the conversation can lose the status affordance and may not see the accepted prompt after a fresh load; a deliberate retry then carries duplicate/uncertain-execution risk.
- **Resolution needed:** Verify the pre-`turn_begin`, no-exchange reopen path through the public route. Provide a durable, content-safe distinction or status affordance for known local failure versus truly uncertain external execution, and hydrate accepted prompts without duplicate bubbles or automatic redispatch. Preserve exact `threadId` and server-owned acceptance.
- **Owner:** Chat domain for bounded repair/check proposal; owner for any consequential recovery interaction choice.
- **Next:** Park the comprehensive recovery UX under D-005 for the same-folder follow-up task, including one route test spanning acceptance, failure before provider output, renderer restart and exact-thread reopen. First Draft for D-004 must identify any direct dependency or compounding risk. Do not infer provider nonreceipt from `provider_failed` alone.
- **Related:** I-007, I-003, REF-007, REF-008, [CAPTURE](CAPTURE.md).
