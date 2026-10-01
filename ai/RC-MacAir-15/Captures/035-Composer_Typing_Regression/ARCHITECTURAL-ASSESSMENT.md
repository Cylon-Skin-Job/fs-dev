# Chat architecture assessment — 2026-09-19

Owner direction after the latency investigation: set aside the quick bounded fix; understand the architectural failure, the process that admitted it, and other potentially compromised chat behavior. No product change or implementation approval is inferred. This is an initial source-based assessment, not a completed whole-chat audit.

## What failed architecturally

The code centralizes both ownership and observation. A shared workspace/session draft is appropriate for continuity across mounts, pending acceptance, and retry. However, the high-level chat host subscribes to that rapidly changing string alongside transcript history, the live turn, usage, model selection, connecting state, menus, and thread metadata. It projects all of this through one ChatSurfaceModel. A draft update executes the host and its unprotected descendants. MessageList iterates history and InstantText calls renderTextInstant again. The current production flip places the same subscription inside PanelContent, above sibling ContentArea as well.

The semantic ownership is often explicit and correct (workspace/thread/surface), but the update boundaries do not match the ownership or change frequencies. The measured symptom is a consequence of that mismatch. RAM-only state and narrow store selectors do not prevent descendant work after the selected value changes.

The memoization experiment establishes that preventing unrelated subtree work removes the measured lag. It does not establish that two memo wrappers are the desired long-term architecture or that every chat path is sound.

## Why the existing verification could accept this

SPEC-02 sections 5–6 deliberately define a portable presentation boundary, a connected host, and session-owned drafts; they also permit existing connected descendants. Section 11 and the inspected tests emphasize identity, correct targeting, state continuity, late-response rejection, and isolation across mounted sessions. Those are valuable checks, and the tested cases passed.

The inspected roadmap/test files do not provide explicit typing-latency, per-character render-work, history-size scaling, or inactive-mount work budgets. A component can satisfy the import/identity contract and still rerender thousands of unchanged descendants. The ten passing rendered-isolation tests therefore never established responsiveness. Tests of explicit hosts also cannot certify that every old shell-level event consumer has been transferred when production host placement changes.

This is a demonstrated gap in the inspected verification contract. It is not evidence about an individual author's intent, nor a claim that every review or test in the repository has been exhaustively examined.

## Additional source findings

### Production action ownership appears lost in the host flip

`useViewChatHost.ts:91–100` passes `explicitTarget: true` to useLegacyChatHost. Both its global insert listener and CHAT_ACTION_EVENT listener return without installing when explicitTarget is true (`useLegacyChatHost.ts:603–614`). The source search found the corresponding event listeners only in that module. Production PanelContent now always uses the view host.

Meanwhile SendToChatButton still dispatches CHAT_ACTION_EVENT, then immediately displays "Link attached to chat" without a consumption acknowledgement. SystemViewer's workspace creation prompt flow also dispatches this event. This is a source-confirmed producer/consumer mismatch for the normal production mount composition. End-to-end reproduction of each affected action remains pending; a separately mounted eligible Legacy host could change behavior in nonstandard compositions.

### Old asynchronous action listeners have weak lifetime/target guarantees

The dormant Legacy action path registers a socket listener for a new chat, accepts the first thread:opened with a threadId without a request correlation check, and removes itself only on that event (`useLegacyChatHost.ts:628–643`). The prompt resolver does correlate a requestId, but its listener has no visible timeout or cleanup on effect teardown (`:662–684`). The effect cleanup removes the window listener, not these nested pending socket listeners. These are code-level hazards requiring targeted late-response/unmount/reconnect tests. They are not established causes of the typing lag and currently belong to a path the production explicit host excludes.

### More shared subscriptions require work-budget review

The host reads global currentThreadId, threads, connectingHarnessBySurface, and chatActive even when it also has an explicit target. useViewChatHost subscribes to the complete threadMembersByGroup map. These can schedule unrelated host work; they do not by themselves prove incorrect state or an infinite loop. The review needs to trace each observable's actual consumers and prove that unrelated sessions/panels remain quiet.

## Architectural rules to evaluate before choosing a remedy

1. Session truth has one owner; observation belongs at the smallest consumer that needs it. Shared state does not require a shared rendering parent to subscribe.
2. Draft editing, active-stream updates, completed history, thread navigation, and workspace content have distinct update boundaries.
3. Completed message processing scales with changes to those messages, not with typed characters or unrelated stream tokens. Evaluate immutable message projections, per-message rendering, and viewport limits with realistic histories.
4. Every command has an explicit destination, a live owner, and a success/failure acknowledgement. A toast after event dispatch does not prove success.
5. Every asynchronous request has correlation, cancellation/lifetime ownership, and a policy for disconnect, unmount, and target changes.
6. Inactive or duplicate mounts have explicit responsibilities and bounded work; preserving state does not imply continuing all expensive processing.
7. Integration verification covers actual production compositions and cross-feature actions, plus measurable work/latency budgets, not only isolated component correctness.

## Review scope still open

Reproduce the action-routing mismatch; map all chat entry points and owners; examine pending acceptance/retry/Stop across thread switches and remounts; audit live/history finalization and parsing costs; verify late-response cleanup and reconnect behavior; quantify hidden-mount work; and exercise realistic long sessions and OS input. Report demonstrated defects separately from risks and desired design changes. Preserve the earlier evidence about the August shared-draft regression versus the incompletely explained recent onset.

## Code Standards check requested by owner

Read the current Code Standards front page plus Frontend UI and State Management standards. The operative tests are one responsibility, no God files, unrelated imports, and separation of presentation/controller/data ownership. The connected-host exception permits established store reads/actions; it does not waive one-responsibility or permit arbitrarily broad update ownership. Line counts below include comments and are indicators, not the verdict by themselves.

### Confirmed concern concentrations in inspected chat code

- **useLegacyChatHost.ts — 764 lines:** one mounted hook combines session identity/projection, draft subscription, send/pending acceptance/retry recovery, attachment mutation, model/harness commands, group rename/link/Move commands, diagnostics/clipboard, DOM refs/menu listeners, and global action/event routing. These are independent reasons to change, beyond adapting a single cohesive controller. This fails the front-page modularity test. Its execution is also one React update unit; moving helpers to other files while continuing to call all of them from the same parent would not remove the latency coupling.
- **ThreadManager.js — 1,295 lines:** one workspace instance includes SQL session/group creation and deletion transactions, busy/fencing policy, session ownership/capacity management, mirror formatting/regeneration/recovery, startup group reconciliation, worksurface-cleanup recovery, and placement delivery recovery. Existing delegation to SessionManager and the group service does not make this a thin orchestrator: substantial policies and persistence/recovery implementations remain in the manager itself. This is a second clear concentration under the one-job rule. No backend malfunction is inferred solely from this structural finding.

### Avoid false positives

thread-runtime-controller.js (1,190 lines), ThreadWebSocketHandler.js (602), and chatSurfaceSlice.ts (664) warrant targeted responsibility assessments; size alone is not a completed finding. The standards explicitly allow cohesive lifecycle/parsing controllers, describe App.tsx as an expected root orchestrator, and historically exempt LiveSegmentRenderer from mechanical splitting because completion behavior is coupled. Those qualifications must be honored rather than treating every long file as a violation.

### Process evidence

The chat program recorded and repaired file-size issues in the worksurface controller and group service, so modularity enforcement was present but inconsistent. SPEC-02's connected-host boundary and tests strongly enforce identity/portability while accepting the aggregate host. Its summary contains no corresponding host-size/responsibility exception. This supports a concrete enforcement gap in the inspected artifacts; it does not establish the thinking or motives of any particular author/reviewer. The standards were capable of flagging the central hook before latency testing.

## Owner's additional symptom: spinning indicator / no Send

Owner reports a spinning circle with no send before losing the ability to type; they had initially attributed Send problems to the in-progress chat integration. Exact indicator and runtime cause are not yet reproduced.

The Send-button warming wheel is driven by `isAcceptancePending`, not by independent proof that a harness is connecting (ChatAreaFooter.tsx). The same flag disables ChatInput. A separate Completing spinner is driven by finalization; these must not be conflated with the assistant activity orb.

A concrete source-level failure path exists: useLegacyChatHost.sendToThread writes pendingPromptAcceptance before invoking the store's sendMessage. chatSlice.sendMessage silently returns if its socket is absent/not OPEN and does not return a send outcome. The caller does not undo the pending marker on that path. Thus a disconnected send attempt can create a pending state without transmitting a prompt; the UI maps that state to both the Send spinner and a disabled composer. Reproduction and connection-retirement/recovery analysis remain necessary before attributing the owner's incident to this path. This is separate from the demonstrated expensive transcript rendering and from toolbar Send-to-Chat event routing.
