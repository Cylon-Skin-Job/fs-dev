# CHAT-SIMPLE-01 — Focused transport owners

## Objective and complete packet

Deliver cohesive server ingress and client connection/response owners in two observable parity slices. This is D-004's first outcome, preserving draft IDs C1-A/C1-B. Candidate only; independent review and exact-candidate approval precede execution in a separate owner-started task.

Normatively incorporate [ROADMAP](ROADMAP.md) authority/order/deferrals, [CONTRACTS](CONTRACTS.md) in full (including **Execution packet inherited by every slice**), [OWNERSHIP-AND-VERIFICATION](OWNERSHIP-AND-VERIFICATION.md) and [SOURCES](SOURCES.json). The exact standards hub and all routed S1–S8 paths are in CONTRACTS; PREF/CHAT/RUNTIME/STRUCTURE/PROTOCOL/ACTIONS also apply. No supersession. This packet is independently executable with those accompanying files.

Prerequisite: approved candidate; actual source checkout/baseline verified against SOURCES; accepted CHAT-AR SPEC-06 remains closed with residuals; affected source drift resolved before edits. No predecessor in this roadmap. Do not require the waived historical soak or a nonexistent clean Git baseline. Preserve concurrent changes and record the actual dirty baseline used.

## Scope and behavior

Replace the mixed responsibilities in `fusion-studio-server/lib/ws/client-message-router.js` and `fusion-studio-client/src/lib/ws-client.ts` with focused existing/private domain owners. Entry facades retain public exports and compose/delegate in established order. Extraction does not redesign protocol, runtime, receipt status, shell authentication, provider retry, Working display, persistence or existing unrelated UI behavior.

Use the responsibility matrix in OWNERSHIP-AND-VERIFICATION as the complete moved/preserved inventory. New private modules must hide cohesive detail behind useful interfaces; no new central god file, mega-context passed everywhere, copied domain implementation or line-count split. Reuse current handler modules first. Remove retired inline implementations and stale imports in the same slice; external import compatibility through the existing entry facade is a live composition boundary, not a second implementation.

## C1-A — Server ingress ownership

**Fresh builder scope:** server router and the focused existing/new `lib/ws` ingress/domain composition modules identified in the ownership matrix, affected route tests, and assigned server Wiki owner references. Runtime/domain/persistence modules are read boundaries unless mechanically necessary integration is documented; no semantic expansion. One builder owns these writes.

**Public path:** authenticated decoded request → ordered router delegation → existing workspace/thread/domain owner → existing response/state effect → current client consumer. Preserve bounded decoder/request diagnostic boundary, diagnostic-prefix precedence, trusted-role checks, workspace-operation leases, prompt same-attempt serialization, captured workspace/root/epoch, per-connection handler creation and exact cleanup. Error denial order and post-commit failure isolation remain observable.

**Implementation:** move cohesive inline workspace/view fan-out and prompt/provider ingress wiring to focused owners; retain domain service ownership and named capabilities. Keep Stop/response routed to the owned-provider operation. Preserve logger redaction and temporary marker. Preserve cleanup delegation: transferred provider ownership must not receive a second close/kill from the router.

**Acceptance:** public prompt route produces one receipt/ACK and at most one provider dispatch; same-attempt race/status fencing stays serialized. Passive exact-member/historyOnly open remains effect-free on provider/Main selection. Workspace switch/binding denial causes no stale persistence/provider/list effects. Extracted workspace/view/file/non-chat family representatives produce the same response/state ordering. Diagnostic request is handled once before metadata; close cleans owned resources exactly once. Required C1-A commands and scenarios V1/V2/V4 pass on actual bytes before C1-B starts.

**Handoff:** follow CONTRACTS execution gates, including fresh builder-owned and orchestrator-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW` only after own clean gate. Required evidence includes moved-owner map, removed inline paths, public-route outputs, same-attempt/workspace race assertions and Wiki updates. No SPEC-level owner acceptance is claimed at this intermediate slice.

## C1-B — Client lifecycle and response ownership

**Prerequisite:** C1-A integrated with clean review and parity checkpoint. **Fresh builder scope:** `ws-client.ts`, cohesive client connection/application-dispatch modules from the ownership matrix, affected tests, the isolated native smoke fixture repair in V9, and client Wiki references. Retain existing runtime-transport and shell-auth ownership; no broad stream-handler or LiveSegmentRenderer split.

**Public path:** runtime descriptor → authenticated socket activation → ordered product-frame dispatch → established domain/store owner → visible exact chat/non-chat result. Separate connection/reconnect/subscription retirement from domain response application. Preserve initial buffered-frame delivery ordering, store socket installation timing, workspace initialization, recovery resume timing, current-connection guards, request-specific error precedence, frontier validation and diagnostic redaction before logs.

**Acceptance:** current socket/generation only can mutate; auth precedes released initialization; reconnect retires old subscriptions/timers/recovery and hydrates current workspace once. Exact Main/Side history and live snapshot survive navigation/reconnect. Shared response family representatives follow the inventory order. Two-second hourglass appears/clears exactly as baseline. Runtime descriptor absence remains disconnected with no endpoint fallback. Required C1-B commands and scenarios V1/V3/V4/V5/V9 pass.

**Handoff:** CONTRACTS execution gates apply in full, with a new builder and independent fresh reviewer threads. Report listener/timer ownership, exhaustive response-family map, retired imports/inline handlers, public UI observations, build hashes and Wiki changes.

## Integration and release

Run V1–V5, V8 and V9 applicable to both slices on the combined SPEC bytes and final SPEC-01 integration checks in the verification matrix; reuse unaffected slice evidence only with source coverage accounting. Confirm server/client entry files each have one compositional responsibility and all moved responsibilities have one owner. No public message/schema/data migration is required. No legacy runtime/retirement gap is silently closed.

SPEC completion requires clean builder/orchestrator review evidence for both slices, combined public-route/build evidence, documented deviations/downstream effects and current source/build manifest. Present results to the owner; **explicit SPEC-01 acceptance releases SPEC-02**. A behavior-preserving refactor passing does not certify the earlier freeze or OpenCode failure solved.
