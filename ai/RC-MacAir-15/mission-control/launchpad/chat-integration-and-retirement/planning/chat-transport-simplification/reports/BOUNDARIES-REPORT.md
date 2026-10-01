# CHAT-SIMPLE-DRAFT-001 — transport boundaries investigation

Assignment revision 1. Author: Codex side chat (ephemeral), runtime child `/root/draft_stage/boundaries`. Observed 2026-09-28T22:55:08Z. Outcome: answered at First Draft depth; recommended order and constraints below are technical recommendations, not owner approval.

Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Verified memory CWD: its `launchpad/chat-integration-and-retirement` folder. Separate read-only checkout: `/Users/rccurtrightjr./projects/fs-dev`, expected dev root, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`; dirty source bytes are identified below. Parent packet names branch `agent/exact-workspace-paths`; this investigator verified root/HEAD and source hashes, not a new full branch/status inventory. Runtime supports shell reads and this assigned report write with unrestricted filesystem permission; no product execution, tests, mutations, delegation or persistent tasks were authorized or performed. Sole owned write: this report. Recipient: `/root/draft_stage`.

## Answer and candidate order

Keep three candidates. Recommended sequence is **responsibility extraction → unified chat command transport → receipt-status send-result handling**. C1 should establish focused owners while preserving observable protocol behavior; C2 should migrate the existing callers onto an explicit transport outcome contract; C3 should make recovery consume that outcome. This ordering avoids implementing C3 against a boolean boundary that C2 must then reshape. C3 is small and technically implementable before C2, so this is a rework-minimizing recommendation rather than a hard semantic dependency.

The most consequential overlap is the send outcome. The current generic authenticated sender is **not a drop-in replacement** for prompt sending. `chatSlice.ts:344–386` reports `enqueued`, `uncertain`, or `not_enqueued`, retaining uncertainty if a send throws after the socket buffer changed. `ws-client.ts:191–196` instead returns a boolean from `shell-auth-client.ts:97–115`, which catches a send exception and returns false, and can return true when merely retaining a frame in its pre-authentication queue. Mapping that false directly to prompt `not_enqueued`, or that true to server acceptance, would weaken the existing contract. This is a concrete C2 constraint, not a reason to bring the entire parked failure-map project into this draft.

Use the existing canonical message families and owners. “Unified send” means one shared client transport boundary with explicit outcomes, not one undifferentiated chat operation, one new WebSocket family, or a second user-text prompt route. The server still owns acceptance, durable mutations, runtime readiness and provider dispatch. C2 should preserve each caller's existing intent/state ownership rather than relocating all pending-operation logic into the sender.

## Observed boundaries

### C1 — two entry files

- Server `client-message-router.js` composes existing per-connection handler groups at lines 81–139, then also contains view registry fan-out/discovery, workspace/view operations, prompt admission wiring and provider commands. Suitable seams follow those responsibilities. Its product ingress already preserves bounded frame decoding, a request diagnostic boundary, trusted role checks, workspace operation leases and exact per-connection cleanup. At lines 897–913, cleanup deliberately delegates provider termination to `ThreadWebSocketHandler.cleanup` and must not signal a transferred wire twice.
- The prompt path at server lines 702–768 captures the live `workspaceId/projectRoot/workspaceEpoch`, verifies that binding, enters `runWorkspaceOperation`, then acquires the receipt's workspace/thread/request lock before runtime admission. Moving this route must not hoist identity out of the current connection, weaken the lease, or bypass the lock. `turn:stop` and `response` use the existing owned-provider operation path.
- Diagnostic routing precedes general `chat-turn:*` metadata at server lines 335–351 and intentionally does not fall through. Extraction must retain that discrimination and logging redaction.
- Client `ws-client.ts` contains transport lifecycle/authentication, connection-scoped response subscriptions, ordered domain dispatch, and inline state/workspace projections. Its `isCurrentConnection` at lines 284–288 checks both socket and runtime descriptor generation. Authentication activation installs the store socket, and workspace-bound recovery resumes only after `workspace:init` at line 455. Connection retirement cancels listeners/recovery and clears the store socket at lines 244–253.
- Client dispatch first handles receipt status, then request-qualified errors, live streams, thread handlers, and remaining domains (`:418–465`). Changing that order could let the generic stream error consumer swallow creation errors or allow stale workspace responses to mutate state. Source extraction is not permission to merge these semantic stages.

### C2 — callers share transport, not all state transitions

The bounded call-site trace found these concrete paths:

| Caller | Existing intent and important distinction |
| --- | --- |
| `chatSlice.sendMessage` | Sole user-text `prompt`; exact request/thread plus attachments and acknowledged model; rich enqueue result. |
| `chatSlice.warmThread` | `thread:warm`; gated by chat activity and target. |
| `useViewChatHost` | View-qualified list, creation, MRU/open. List request deduplication includes socket identity, so reconnect must issue a fresh list. |
| `useChatSessionActions` | Exact-session Stop; new thread/harness selection. Stop sets pending exchange-save state before socket send. Transport migration must not invent successful stop acknowledgement. |
| `thread-group-command-controller` | Workspace guard around open, members, rename/delete/link/Move and portable model selection. Open and model-selection pending state follows a successful local send; durable mutation still follows server response. |
| `ChatSurfaceComponentMount` | Restored side/component chat sends exact-member `thread:open` with `historyOnly: true`. Must not activate/warm a provider or select Main as a side effect. |
| `worksurfaceRuntime.socketSend` | Shared worksurface requests including the chat selection integration. Any shared transport change must preserve its request correlation and non-chat consumers. |
| `reply-metadata-api` | Already uses `sendFusionMessage` and connection-scoped response listeners. A saved reply update is not prompt submission; response timeout and listener retirement remain its owner's concern. |
| `prompt-submission-recovery` | Already wired to `sendFusionMessage` but types its callback as returning void. This is C3's consumer seam. |

This table is a bounded inventory, not proof that every chat-related emitter across the repository was found. The Roadmap author should close the exact migration inventory, including any diagnostic/read-only chat API callers, before claiming all chat command writes are unified. Do not expand C2 into rewriting every non-chat sender that happens to share the base socket.

At `useChatSessionActions.ts:103–151`, `not_enqueued` retains the draft and shows a local failure; `uncertain` creates an unknown attempt; ordinary enqueue creates a pending attempt. Neither commits the user bubble. C2 must retain these distinctions, attachment/draft ownership, and the already single prompt path. The shared transport may report a local submission result; existing server messages remain the application acknowledgements.

### C3 — precisely the ignored result

`prompt-submission-recovery.ts:123–160` marks a status attempt in flight, displays checking, calls the void-typed `sendAction`, and arms a response timer even if the underlying sender returned false. The thrown-exception branch already clears the in-flight marker, displays unknown status and schedules only a status retry. C3 can consume an explicit failed-send result through that same recovery ownership without converting the original prompt to rejected/cancelled, releasing a pending/unknown send gate, or sending the prompt again.

Preserve both acceptance and accepted-execution recovery entries; preserve request ID, workspace identity, current recovery generation and retirement cleanup. A failure to transmit a **status request** is not proof that the **original prompt** failed. A boolean false from the current authenticator is also not a global proof that no bytes ever left the process, so wording/state must remain conservative. Exact callback type and compatibility strategy depend on C2's selected transport outcome contract.

## Deferred recovery work remains repairable under explicit constraints

D-005 parks comprehensive Fusion/OpenCode failure mapping until the three-SPEC chain is built and owner-approved. Existing I-007/I-008/I-009 remain unresolved; neither this draft nor transport refactoring is evidence that those failures are fixed or safe for new consumers.

Specific source evidence supporting a bounded deferral:

1. Receipt persistence/status projection is owned outside the two transport entry files in `prompt-submission-service.js`. `project` at lines 49–61 currently retains the claimed/unknown distinction; same-key `status` at lines 134–152 can fence an absent attempt and never invokes a provider. C1 can keep calling this owner and C2/C3 can keep requesting the same status family. Later durable terminal classification remains possible in that service/repository/runtime chain.
2. C3 changes whether the existing request was locally submitted and which existing recovery state/timer applies. It does not require changing receipt schemas, dispatch claims, provider session lifecycle, prompt identity or accepted-bubble hydration. Those owners therefore remain available for the later pre-begin failure and reload repair described in INV-001 F1/F2.
3. Exact thread/workspace/request identity and rich enqueue uncertainty can be preserved by C2's boundary. Preserving them retains the evidence and correlation needed by the later failure map; converting to a generic success boolean or auto-retrying prompts would instead compound it.
4. The two-second visible-wait renderer and provider adapters are outside the needed source changes. Preserving their behavior allows later retry/liveness visibility to be designed from real provider signals instead of tying it to transport success.

These are design constraints and a feasibility inference, not runtime proof of harmlessness. Hold affected progression and return to the owner if the selected implementation would add automatic prompt resend, equate enqueue with acceptance, strip failure reason/identity, alter dispatch/receipt state semantics, replace the existing recovery owner, or expose today's unresolved recovery as a stable new plugin contract. Transport extraction can reduce coupling; it must not freeze known failure behavior behind an allegedly final consumer API.

Resolver for deferred recovery: owner-resumed same-folder task `01a0ea32-f152-77a2-afc2-b73e8976685a`; trigger is completion/approval of this three-SPEC work. Downstream consumers are new plugin/view chat integrations and any contract claiming reliable post-reload accepted-prompt reconstruction. Their release must revisit those unresolved prerequisites; this draft does not release them.

## High-risk smoke scenarios for later planning

These are proposed observable checks, not executed tests or an executable test plan.

- Submit from an exact Main and Side session: one prompt route, one accepted user bubble only after `message:sent`, correct attachments/model and exact destination.
- Inject send failure before enqueue and after a changed buffer: draft remains recoverable; only the latter produces uncertainty; neither silently resends.
- Replace socket/runtime generation during response/status work: stale socket callbacks cannot mutate current state; new authenticated workspace initialization resumes the correct attempt and list population once.
- Fail a receipt-status local send: checking state does not wait on a request reported failed; existing unknown state/send gate remains; reconnect retries only status with the original request ID.
- Receive a late status response or a new attempt after retirement: it cannot settle the wrong request/thread/workspace or leave an old timeout active.
- Exercise accepted acknowledgement racing with status, plus no-receipt status fencing: existing server lock/receipt behavior survives extracted ingress and no duplicate provider dispatch occurs.
- Open a restored exact side member and switch visible groups through worksurface acknowledgement: browsing stays passive and non-chat worksurface content is not overwritten.
- Stop the exact active session and close/reconnect the client: owned termination and cleanup remain single-owner, with no second signal to a transferred wire.
- Exercise public ingress for extracted non-chat workspace/view/file paths and diagnostic prefix discrimination: chat refactoring does not bypass readiness/trusted role checks or expose diagnostic content.

## Evidence and limits

Read completely: session contract, investigation contract, planning-stage skill, shared planning contract; local/repository AGENTS; PLANNING/SOURCE-SNAPSHOT; D-004/D-005; both prior investigation reports; current Chat overview; User Preferences; Code Standards router plus Architecture Routing, State Management, WebSocket Protocol and Testing/Smoke pages. Read relevant I-011/REF-012 and targeted source spans listed above. Prior failure reports are reused as dated evidence, not re-reproduced. No exhaustive architecture review, current OpenCode source/retry investigation, UI check, tests, app restart, database access or Git write occurred.

Material SHA-256 at observation (paths relative to checkout):

| Path | SHA-256 |
| --- | --- |
| `fusion-studio-server/lib/ws/client-message-router.js` | `b59f4d74c218e73a4cc828a82a5faa7cbbe08299d7ed1ac78718eac7412036a6` |
| `fusion-studio-client/src/lib/ws-client.ts` | `799ea39d8085c7d7472aab0e56ba3c748488a3f9a007a18b79c427854e708648` |
| `fusion-studio-client/src/lib/shell-auth-client.ts` | `c334aea10184b722eda46077fb139f817d1765608a90ed62b9311cb45313f6fc` |
| `fusion-studio-client/src/state/slices/chatSlice.ts` | `6573e55f2afa0af6a02618894cd4f77ba290ac7a2772d60c1e832a00112ec421` |
| `fusion-studio-client/src/components/chat/useChatSessionActions.ts` | `09eee115f44535b6b52260da0c9c48dd16029993eac1fbf2ad0222d8743a256a` |
| `fusion-studio-client/src/lib/chat/prompt-submission-recovery.ts` | `787206f278c433c18a0f73f8b3257f2f9ad71e940c2f7341ae4e7d2c4a951c67` |
| `fusion-studio-client/src/components/chat/useViewChatHost.ts` | `f0d42ae389f0b550ce135a2817985292bc42b97b08cbb79a0a474252f0f6e0ab` |
| `fusion-studio-client/src/lib/chat/thread-group-command-controller.ts` | `eceaecdc2be83aa11c68803943d331c2099d7533c79f234ab96d8ccb563dcfc0` |
| `fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx` | `cf729072e8534ea93af8c3fd637298a4cc6ae3b68a0aa982712ad64c1d244fed` |
| `fusion-studio-client/src/lib/worksurface/worksurfaceRuntime.ts` | `e00eb47a3090f59bd706f5a540b0b13601ab381547ea5ea74c2781aada1ee792` |
| `fusion-studio-client/src/lib/chat/reply-metadata-api.ts` | `587adad9f67e2e7824beea3c62f7396917eb468cd5fe49a5b4045bb620117b8f` |
| `fusion-studio-server/lib/thread/prompt-submission-service.js` | `c6c2ceb640e5aa9d8de221c9d8ca43899a263247da39b3d7a1ec380f72d36966` |

Changed files: this report only. Stop reason: source constraints suffice for a provisional skeleton; exact migration inventory and executable verification belong to later authoring. Next safe action: stage incorporates these constraints and ordering recommendation into its one author packet, then validates the resulting draft independently.
