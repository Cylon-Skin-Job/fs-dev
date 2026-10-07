# CHAT-AR integration and retirement — decisions

> Explicit owner choices only; source approval is limited to the recorded scope.

## Folder ownership

### D-001 — Prepare this Launchpad folder

- **Source:** Owner approval in the current Mission Control setup conversation following the four-folder discussion; the chat close-out folder was added before provisioning.
- **Status:** active
- **Scope:** Prepare this distinct durable memory home for chat-ar integration and retirement. The owner will sort out detailed scope and sequencing in the new folders. No product plan, SPEC or implementation is approved by this decision.

### D-002 — Transfer supervisor responsibilities into this folder

- **Source:** Direct owner message in supervisor task `01a0c1c8-6e85-7f83-8d67-2cb5c1476007`: “Let's transfer your responsibilities here: /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement/”. Recorded 2026-09-28 UTC.
- **Status:** active
- **Scope:** Make this folder the durable return point for remaining CHAT-AR integration, retirement, verification-scope shaping and stable consumer-baseline handoff. Preserve the completed owner acceptance and historical evidence. Other domains retain their existing responsibilities. This transfer authorizes memory reconciliation, not a new implementation chain, task creation, app relocation, history checkpoint, Git/Alpha operation or monitoring activation.

## Verification direction

### D-003 — Waive the historical soak for successor work

- **Source:** Direct owner message in this CHAT-AR folder conversation, 2026-09-28 UTC: “We are waving the soak in favor of future plans to connect logging.”
- **Status:** active
- **Scope:** The original 45-minute soak is no longer an exit requirement for this folder's chat integration/retirement follow-up. Preserve the historical fact that it was not completed. Future logging belongs to the health/observability domain and is not claimed implemented or equivalent to a passing soak. Choose and report affected present-state checks for any repair or consumer handoff; this decision does not waive diagnosis of a current blocking failure or authorize product code changes.

### D-004 — Keep the next planning effort to three simple SPEC candidates

- **Source:** Direct owner direction in this conversation, 2026-09-28: “3 Simple SPECs,” following “Fixing the two god files and unifying chat send behavior and the targeted fix you discovered we need.” The owner then explicitly deferred the broader OpenCode/Fusion mismatch investigation.
- **Status:** active for First Draft shaping; no roadmap or implementation approval.
- **Scope:** Shape three bounded candidates: (1) simplify the two identified transport entry files, server `client-message-router.js` and client `ws-client.ts`, by responsibility rather than line count; (2) unify chat command sends through one acknowledged client transport boundary while preserving the already single user-text prompt route; (3) fix the concrete `prompt-submission-recovery.ts` false-send/status-check seam. First Draft must test dependencies and propose observable outcomes; the number and exact boundaries remain discussion candidates until the owner reviews the draft. Do not absorb the accepted-response failure UI/recovery redesign into candidate 3 by implication.

### D-005 — Park comprehensive Fusion/OpenCode failure-state work in a later task

- **Source:** Direct owner direction in this conversation, 2026-09-28: “Leave this issue for later” and “In a later session, we will flesh out EVERY single way a connection can fail to send, or there be a mismatch between Open Code and Fusion Ui.” The owner requested a separate task with current context and will resume it after the three-SPEC work passes First Draft, Roadmap, Build and owner approval.
- **Status:** parked in [Map Fusion–OpenCode chat failure states](codex://threads/01a0ea32-f152-77a2-afc2-b73e8976685a), a local task in this same Chat Integration project folder. Its intake turn is limited to context acknowledgment; the owner will resume it later.
- **Scope:** Defer the comprehensive failure-path inventory and accepted/no-response UX design, including durable `provider_failed` versus unknown readback, pre-begin fresh-renderer hydration, retry/liveness visibility and recovery after reconnect. Preserve I-007/I-008/I-009 as known gaps and the temporary diagnostic migration marker. This is a sequencing decision, not a claim that failures are solved or safe for downstream consumers; the next planning stage must identify any direct dependency or compounding risk before this deferral is treated as harmless.

### D-006 — Run First Draft, review and prepare Roadmap inputs

- **Source:** Direct owner message in this conversation, 2026-09-28: “Let’s run first draft, then review and prep for Roadmap.”
- **Status:** active; draft and preparation assignment only.
- **Scope:** Run the managed First Draft with bounded research, one author and independent validation for D-004's three candidates, reconcile records, review the documentation package and prepare a concrete Roadmap handoff. Candidate order remains a planning recommendation. Executable Roadmap creation, product implementation and owner acceptance are separate later steps; D-005 remains in force.

### D-007 — Authorize Roadmap Creation from the reviewed draft

- **Source:** Direct owner message in this conversation, 2026-09-28: “Let’s send it to Roadmap Creation.”
- **Status:** active planning authorization; executable candidate approval remains pending.
- **Scope:** Reuse CHAT-SIMPLE-DRAFT-001 rev1 and ROADMAP-PREP to create the three-SPEC executable candidate, resolve R1–R4, run independent stage and release validation, and return the exact candidate for owner approval. Preserve D-005's deferred failure-map scope. This authorizes planning and review, not product implementation.

### D-008 — Narrow to the current build and separate follow-on harness work

- **Source:** Direct owner instruction in the project-folder planning conversation, October 5, 2026: “We can keep Integration and Retirement scoped to the current jib of fixing this last build.” Followed by “After that, I think the Open Code harness stuff needs to be in a new folder” and “Let's call it Chat harness repair and testing.” Recorded by Codex side chat (ephemeral), 2026-10-05T16:19:23Z. No unavailable conversation UUID/turn locator is invented.
- **Status:** active
- **Scope:** Keep this home focused on fixing/finishing the current last-build job identified by the October 5 Chokidar/harness handoff, including necessary concrete repairs, verification and existing owner acceptance. Subsequent broader OpenCode harness repair/testing belongs in [the new folder](../chat-harness-repair-and-testing/TICKET.md) after closeout. This narrows D-001/D-002's future remit and changes D-005's follow-on workfolder destination; prior approvals, findings and task history are preserved. No task is reassigned/resumed, implementation/evidence relocated, new product repair approved or Git/Alpha prerequisite added.
