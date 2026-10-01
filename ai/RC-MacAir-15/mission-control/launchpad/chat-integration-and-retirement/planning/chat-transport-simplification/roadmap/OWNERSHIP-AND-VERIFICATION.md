# Ownership inventory and verification contract

## Inventory boundary

Normative for all three SPECs. Source-grounded research: [ownership report](reports/OWNERSHIP-VERIFICATION-REPORT.md) and [transport/recovery report](reports/TRANSPORT-RECOVERY-REPORT.md); those reports are evidence, while requirements are fixed here and in CONTRACTS. `C` means `fusion-studio-client/`; `S` means `fusion-studio-server/`, each relative to the source checkout in ROADMAP.

SEND-01–13 exhaust the inspected production renderer chat emitters in `C/src/**/*.{ts,tsx}` for native `.send`, `sendFusionMessage`, literal chat families, dynamic diagnostics and generic open/action/socket helpers. Scripts, tests, Electron authentication proofs, server provider writes, third-party content and future plugins are outside this claim. No current production renderer sender for server-supported `response` or `thread:search` was found; C1 preserves those server routes.

## C1 owned modules and dispatch

File names below are concrete implementation choices; an equally cohesive change is a reported technical deviation, not permission to change scope. New modules remain private and have narrow named dependencies, never a copied ThreadManager or whole mutable context for convenience. Each slice must record final responsibility/size and delete displaced inline code/imports.

| Slice / file | One responsibility and preserved boundary |
| --- | --- |
| C1-A `S/lib/ws/client-message-router.js` | Compose authenticated product ingress and delegate in established order; keep bounded decoding, request diagnostic boundary, connection factories and exact close dispatch. |
| C1-A new `S/lib/ws/view-workspace-ws-handlers.js` | Own view-bound connection operations: readiness/discovery leases, workspace/view registry changes, workspace state/panel handling and recipient-qualified epochs. Existing services remain mutation owners. |
| C1-A new `S/lib/ws/chat-runtime-ws-handlers.js` | Adapt canonical chat ingress to existing exact provider/receipt/runtime owners: prompt resolution, initialize, prompt, Stop and response. Keep trusted guard/config validation/captured binding/lease/same-attempt lock order. |
| C1-A new `S/lib/ws/file-request-dispatch.js` | Select existing file/provenance request owners, preserving versioned File Viewer versus compatibility-panel precedence and governed fail-closed behavior. |
| C1-B `C/src/lib/ws-client.ts` | Own application connection lifecycle and exported product transport facade: descriptor/auth/current socket, reconnect and retirement. C2 extends this owner, never adds another chat socket. |
| C1-B new `C/src/lib/ws/fusion-response-listeners.ts` | Own subscriptions and response listener retirement; persistent versus connection-scoped lifetimes stay distinct, deduplicated callbacks unsubscribe before invocation. |
| C1-B new `C/src/lib/ws/application-message-router.ts` | Select inbound domain handlers with diagnostic minimization and currentness checks in established order. No outbound result or provider policy. |
| C1-B new `C/src/lib/ws/view-state-handlers.ts` | Reconcile `state:result/error`: mutation watermark, request origin/workspace, optimistic merge, bound worksurface content and settled selection. |
| C1-B new `C/src/lib/ws/shell-message-handlers.ts` | Dispatch residual shell response projection to existing stores/listeners. Keep connected/modal/panel/Fusion/clipboard/emoji/secrets matching explicit; do not accumulate independent new service policies. |

Existing `thread-ws-handlers`, receipt/action/runtime services, file/workspace owners, stream/frontier handlers, runtime-transport, shell-auth and worksurface owners remain dependencies. Their behavioral decomposition is not an extra workstream.

**Server ordered map:** client_log suppression → thread handler map → diagnostic prefix (including consuming unknown diagnostic types) → trusted chat-turn metadata → file tree/content/recent → prompt resolve → file_save/resource provenance/agent activity/isolated fixture → folder/document create → workspace state/view registry/panel → initialize/prompt/turn:stop/response → fusion → clipboard → bookmarks → emoji_recents → theme → secrets → harness → exact workspaceRequestHandlers key → screenshot → fixed unknown/error. Cleanup disposes live diagnostics, awaits exact thread/session cleanup, then removes session/root; it must not second-kill a transferred wire.

**Client ordered map:** metadata/document notifications → receipt status and optional synthesized accepted ACK → request-correlated error listeners → stream → qualified thread mutation then success notification → worksurface → file → provenance → workspace (init resumes receipt recovery) → prompt resolved/error notification → harness → theme → screenshot → bookmarks → calendar → Office palette → state result/error → connected/modal/panel/Fusion/clipboard/emoji/secrets. Preserve deliberate notification plus application pairs and exactly one consuming domain decision.

**Response owners:** list/members/created/opened/action results/message:sent → thread handlers; canonical live/end/saved/diagnostics → stream/frontier owners; receipt status → recovery then optional accepted ACK; metadata responses → scoped listener plus current metadata application; creation/resolve errors → chat-action-creation listeners; worksurface result/error/changed → worksurface controller; workspace init/change → workspace handler; state result/error → extracted state reconciler. Existing non-chat handlers keep family matching.

## C2 finite send migration

Every row adopts the single production transport boundary; command payload, target and response owner remain unchanged. `auth_queue` below is local pre-auth admission only and cannot be inferred from a merely OPEN socket. Exact admission/retirement rules are in CONTRACTS.

| ID | Source under C | Family and pending/response ownership |
| --- | --- | --- |
| SEND-01 | `src/state/slices/chatSlice.ts` sendMessage | Sole `prompt`; exact attempt/input/attachments/acknowledged model; UI keeps rich uncertainty and server `message:sent` commits bubble. |
| SEND-02 | same, warmThread | `thread:warm`; existing chatActive/target gates; no local runtime readiness claim. |
| SEND-03 | `src/components/chat/useChatSessionActions.ts` | Exact `turn:stop` and `thread:open-assistant`; preserve Stop pending-save and surface connecting state ownership. |
| SEND-04 | `src/components/chat/useViewChatHost.ts` | `thread:open-assistant`, qualified `thread:list`, MRU `thread:open`; socket-aware dedupe, pending-open/population correlation and worksurface delegation survive. |
| SEND-05 | `src/lib/chat/thread-group-command-controller.ts` | `thread:open`, `thread:members`, `thread:action` rename/delete/copy_link/view_markdown/open_member_in_side/move_chat_to_side/set_harness_selection; exact workspace/group/member and domain pending ownership. |
| SEND-06 | `src/components/chat/ChatSurfaceComponentMount.tsx` | `thread:open` with request/group/member and historyOnly; passive exact-member hydration, no Main selection/provider activation. |
| SEND-07 | `src/lib/worksurface/worksurfaceSwitch.ts` | Chat `thread:open` currently through worksurfaceRuntime.socketSend; migrate this call directly, leave non-chat helper untouched. |
| SEND-08 | `src/lib/chat-action-creation.ts` | Existing generic sends for open-assistant/prompt:resolve; listeners qualify request/workspace/epoch; local refusal cannot roll back committed group. |
| SEND-09 | `src/lib/chat/reply-metadata-api.ts` | Existing generic metadata update; exact exchange/thread listener, retirement and timeout remain domain-owned; uncertain mutation never means no mutation. |
| SEND-10 | `src/lib/chat/prompt-submission-recovery.ts` via workspace-init wiring | Existing receipt-status action; C2 supplies typed outcome callback, C3 consumes it; no C2 recovery redesign. |
| SEND-11 | `src/state/panelStore.ts` selectHarness/createDefaultAssistantThread | Both callable store open-assistant paths migrate, even unused-looking default creation. State resets are not server success. |
| SEND-12 | `src/lib/ws/chat-diagnostic-handlers.ts` | Exact chat-turn:diagnostic:get; report/unavailable wait/correlation/retirement remain; no payload logging. |
| SEND-13 | `src/lib/diagnostics/stream.ts` | Dynamic diagnostic subscribe/unsubscribe; captured socket/channel target, sequence/generation/retired-turn guards; cleanup never retargets replacement socket. |

`threadGroupRows.ts` builds payloads and `chat-action.ts` dispatches intents; neither is another transport writer. Deliberate non-chat exclusions: screenshot storage, client_log, file/view/workspace/clipboard/bookmark/emoji/secrets/Fusion/Office/Email sends. Authentication proof writes remain inside shell-auth. `worksurfaceRequests.ts` put/get/placement continues its existing non-chat socketSend path; changing that helper instead requires documenting deviation and running full CAS/conflict/placement/readback checks. Keep the live non-chat boolean API only as a truthful mapping over shared mechanics; never return a truthy result object to an unadapted boolean consumer.

Migration completion requires rerunning the whole bounded search, classifying every remaining native send and proving SEND-01–13 call the actual unified function. No caller-local JSON serialization/send algorithm or hidden raw bypass remains. A renamed import or mocked sender is not proof of adoption.

## Admission policy and local result consumption

This table fixes the policy for every migrated caller. Existing weaknesses are observations, not approved new UX. A newly caught uncertainty keeps domain correlation alive rather than declaring success or absence. Existing domain refresh/read/subscription triggers are distinct from transport replay.

| SEND IDs | Required admission | Refusal/uncertainty and existing lifecycle |
| --- | --- | --- |
| 01 | socket_only | Definite refusal preserves draft/attachments; uncertain starts unknown attempt; socket enqueue starts pending. Only message:sent commits. |
| 02 | socket_only, chatActive + target | Unavailable remains no-op; uncertainty does not set ready or retry warm. |
| 03 | socket_only; Stop requires current turn | Unavailable creates no queued Stop/create. Preserve current pending-save/connecting ownership without declaring success; uncertain stays response-owned, never replayed to replacement. |
| 04 | socket_only | Keep qualified pending-open/dedupe ownership; failed attempt cannot become durable success. New socket's host effect may refresh list/history, never replay a mutation. |
| 05 | socket_only, matching explicit workspace | Definite refusal returns local failure and starts no new open/model pending state. Enqueued or uncertain retains exact pending correlation so a possible response can settle; durable results remain ACK-owned. |
| 06 | socket_only | Missing/closed/stale socket causes no request. Remount/new socket may issue fresh passive historyOnly read; no activation. |
| 07 | socket_only | Existing worksurface request/selection state owns failure and reconciliation; no transport replay or non-chat helper policy change. |
| 08 | socket_only, existing initialized workspace/epoch/panel-socket guard | This existing generic user is practically authenticated-only. Definite refusal settles local not_enqueued; uncertain retains existing scoped listener/15s wait, never claims group absence or rolls back committed creation. Retirement cancels scoped operation. |
| 09 | auth_queue_allowed only with valid captured workspace binding | Register existing exact metadata listener/timeout. Definite refusal may settle existing failure locally; uncertain/queue/socket keeps bounded existing response/retirement behavior. No automatic mutation replay, no metadata success on admission. Missing binding is a truthful refusal rather than retaining stale work. |
| 10 | auth_queue_allowed with installed exact binding, including activation's buffered workspace:init | C2 supplies rich callback; C3 owns its consumption. No hasReceivedInit-only rejection. Bounded inquiry/status-only retries remain domain-owned. |
| 11 | socket_only | Preserve callable store paths' state reset/connecting ownership; unavailable cannot retain reset-derived command in a new generation; no automatic creation retry. |
| 12 | socket_only | Invalid target or definite refusal settles pending null using existing unavailable behavior; uncertain keeps bounded exact response listener until response/retirement/timeout. No automatic replay or payload logs. |
| 13 | socket_only against captured channel socket | Definite refusal/uncertain marks channel disconnected under current owner. Its explicit new-socket subscription uses fresh ID/window. Old unsubscribe is refused instead of retargeted. |

## Exact verification commands

These are **required implementation checks**, not planning results. Run from the explicitly stated directory on captured implementation bytes. Added test files below are implementation deliverables and do not exist by implication. New assertions exercise actual production transport/ingress boundaries; fixture a deterministic provider below the adapter boundary, never mock away the boundary being changed. Use temporary workspace/profile/ports; do not run default Playwright config against port 3001 or the owner's live database.

**V1 — client build and provenance, C1-B/C2/C3 and every SPEC final:** from C, `npm run build`. Record source snapshot, Node/npm/dependency state, exact command/result, hashes of generated `dist/index.html`, its JS/CSS assets and `electron/preload.cjs`. A prior build timestamp proves neither current source nor healthy runtime.

**V2 — server public ingress, C1-A and SPEC-01 final:** from S:

```sh
npm test -- --runInBand --runTestsByPath test/ws/client-message-router.test.js test/ws/prompt-canonical-route.integration.test.js test/ws/privileged-thread-public-route.integration.test.js test/ws/chat-turn-diagnostic-route.integration.test.js test/ws/live-diagnostic-route.integration.test.js
```

Extend the public router suite for every moved delegated family, prompt resolve and close. Pass: matching response/state effect once, unchanged precedence/denials, no sensitive payload logs, no stale binding effect or double termination. pretest builds the native observer; environmental failure must be reported, not silently bypassed.

**V3 — client connection/response baseline, C1-B and SPEC-01 final:** from C after V1:

```sh
npx playwright test --config=playwright.chat-architecture.config.ts e2e/runtime-transport.spec.ts e2e/shell-auth-client.spec.ts e2e/thread-bootstrap-order.spec.ts e2e/prompt-ownership.slice-c.spec.ts e2e/chat-diagnostic-actions.slice-c.spec.ts e2e/stream-diagnostics.spec.ts e2e/visible-wait.spec.ts e2e/chat-transport-entry.spec.ts
```

C1-B adds `e2e/chat-transport-entry.spec.ts`. Pass: all client map branches dispatch with required notification ordering; stale native callbacks cannot mutate; auth/buffer/init ordering, recovery resume and listener retirement are unchanged. Include non-chat File Viewer readiness, view epoch fan-out, state watermark/bound content, Office palette bootstrap, clipboard/provenance listener retirement and secrets suppression. Tests of moved inline source shapes must migrate assertions without weakening behavioral coverage.

**V4 — server owner integration, C1-A/C2 and final affected checks:** from S:

```sh
npm test -- --runInBand --runTestsByPath test/ws/thread-group-protocol.integration.test.js test/ws/thread-group-member-access.integration.test.js test/ws/thread-group-move-side-chat.integration.test.js test/ws/thread-worksurface-routes.integration.test.js test/ws/prompt-submission-recovery.integration.test.js test/ws/shell-auth-public-route.test.js
```

Pass: canonical action requester result + second-recipient fan-out + durable readback; requester/recipient failure does not replay/undo mutation or block remaining delivery. Exact-member historyOnly remains passive. Prompt/status same-attempt race yields one provider dispatch or one cancellation fence as appropriate. Run the full listed command at SPEC-01 and SPEC-02 integration; C3 runs receipt recovery integration with V7. Owner integration supports but does not replace client transport outcome checks.

**V5 — public UI parity:** required automated assertions in V3/V6 plus isolated Electron smoke described below. Main and exact Side each send one deliberate prompt to correct thread with attachment/model snapshot; user bubble appears only after server ACK. Open/historyOnly/list retain population/identity after navigation/reconnect. Stop targets exact session and saves partial output through server terminal path. Simulated live gap shows unchanged two-second hourglass, clears on established reveal/terminal transition. Use actual existing visible-wait implementation and deterministic clock/frames; do not infer provider retry from elapsed time.

**V6 — unified sends, C2 and SPEC-02 final:** C2 adds `e2e/chat-send-transport.spec.ts`; from C after V1:

```sh
npx playwright test --config=playwright.chat-architecture.config.ts e2e/chat-send-transport.spec.ts e2e/runtime-transport.spec.ts e2e/shell-auth-client.spec.ts e2e/thread-bootstrap-order.spec.ts e2e/prompt-ownership.slice-c.spec.ts e2e/chat-diagnostic-actions.slice-c.spec.ts e2e/stream-diagnostics.spec.ts e2e/visible-wait.spec.ts
```

Pass: real unified boundary exercised for every SEND ID; socket admission/queue policy preserved per table; successful native return, definite prewrite refusal, caught uncertain send, pre-auth queue/drain, workspace revision and generation replacement handled by CONTRACTS. Assert exact wire payload/order, no duplicate serialized path, no silent prompt queue/replay, no stale queued frame or diagnostic cleanup retarget. Durable action public UI result/readback covered alongside V4.

**V7 — inquiry outcomes, C3 and SPEC-03 final:** C3 adds `e2e/prompt-submission-recovery.spec.ts`; from C after V1:

```sh
npx playwright test --config=playwright.chat-architecture.config.ts e2e/prompt-submission-recovery.spec.ts e2e/chat-send-transport.spec.ts e2e/prompt-ownership.slice-c.spec.ts e2e/thread-bootstrap-order.spec.ts e2e/visible-wait.spec.ts
```

From S: `npm test -- --runInBand --runTestsByPath test/ws/prompt-submission-recovery.integration.test.js`.

Pass every C3 transition through both explicit Check status and scheduled invocation, acceptance and execution watches, real transport outcome boundary and recovery UI/store projection. Definite inquiry refusal creates no orphan five-second response wait; uncertainty never releases original attempt's send gate; late matching reply after deadline reconciles only eligible current identity. Race reconnect/workspace switch, original ACK, terminal/new attempt, rejection/not-accepted and duplicate/late status. Count wire messages to prove only status queries retry and no prompt resend/provider cancel. Server receipt projection semantics remain unchanged.

**V8 — final shared-contract integration, each SPEC:** from S `npx jest --runInBand`; from C V1. This satisfies current Chat Testing And Operations minimum. Attach failures with baseline comparison and affected disposition; an unrelated pre-existing failing check does not become a claimed pass. Run once on each SPEC's final integrated bytes, not after every trivial edit. No historical soak is reinstated.

**Static retirement checks:** from checkout:

```sh
rg -n '\.send\(|sendFusionMessage' fusion-studio-client/src --glob '*.{ts,tsx}'
rg -n 'threadOpenRequest|threadAction[A-Z]|socketSend|chat-turn:diagnostic:' fusion-studio-client/src
rg -n 'temp_chat_boundary_v1|TEMP CHAT-AR I-007' fusion-studio-server/lib/logging.js
```

Pass is classified remaining matches, complete migrated-call inventory and preserved marker, not zero sends globally. Verify moved modules have one responsibility, no dead old implementation/import, and appropriate sizes. Each SPEC audits Wiki source-file references and links for moved owners.

## Evidence and consumer release

Planning read-only observations and old generated artifact hashes are in SOURCES; no test/build/runtime was run by this author. Before each implementation slice, capture source hashes and compare approved planning/current accepted predecessor bytes. Before final checks, capture combined source and generated output hashes again. Record command environment, fixture identities, observed requests/results and cleanup. Keep content/credentials out of durable reports.

Release each later slice/SPEC only on its preceding gates; release new external consumer baselines only after their independent unresolved requirements are satisfied. The bounded current source separation supports D-005 deferral: receipt projection/status/lock, server dispatch and adapters remain available for later repair. Mandatory actual-byte preservation checks prevent the extraction or result contract from making those later repairs harder. No source/build baseline here certifies runtime health, Alpha or accepted-no-exchange reconstruction.

## Isolated native authentication and cleanup gate

V9 is required at SPEC-01 final after C1-B's explicit harness adaptation, then at SPEC-02 final because queue/auth mechanics change. C3 reuses native receipt-route assertions in this same isolated harness when adding recovery behavior; do not substitute browser fixture success for native auth/public-route evidence.

Existing `C/e2e/trusted-shell-auth-smoke.mjs` launches a temporary profile but currently seeds the development workspace and restores live style/config files in finally. That restore can overwrite a concurrent edit. **C1-B owns correcting this verification fixture before running it:** reuse `C/e2e/side-chat-electron-smoke.mjs`'s isolated migration/seed-removal/temp-workspace pattern, remove live-file restore writes, prove no access/mutation to owner workspace/profile, preserve cleanup even on failure. This is necessary test integration, not a fourth product slice. Extend native assertions for exactly-once post-init cleanup/no residual owned child; reuse current auth-before-init, committed shell origin, secret suppression and fresh server generation/auth after restart assertions.

After V1, from C:

```sh
node e2e/trusted-shell-auth-smoke.mjs
node --test electron/shell-launch-authority.test.cjs electron/shell-bootstrap-inventory.test.cjs electron/runtime-preload.test.cjs electron/runtime-ipc.test.cjs
```

From S:

```sh
npm test -- --runInBand --runTestsByPath test/shell-bootstrap.test.js test/ws/shell-auth.test.js test/ws/shell-auth-dispatch.test.js test/ws/shell-auth-public-route.test.js test/ws/shell-auth-recipient-isolation.test.js test/ws/server-runtime-activation.test.js test/shutdown.test.js
```

Pass: isolated installed workspace only; authenticated before init, no auth material retained, restart rotates endpoints/generation with fresh auth; public denial/expiry/abnormal close/factory-recipient barriers and cleanup all pass. Fixture kills only its identified child server, closes Electron and cleans owned temporary data. Default development invocation uses checkout Electron; no packaged Alpha operation or FUSION_SMOKE_EXECUTABLE override is required here.

C2/C3 extend this same corrected native fixture with deterministic provider/receipt scenarios, reusing the below-adapter fixture patterns in `e2e/chat-architecture/future-submit-electron.mjs` and `deterministic-opencode-adapter.cjs` without invoking their owner-session runner. C2 proves Main/Side exact prompt ACK and durable action readback through real WS/SQLite. C3 proves lost-ACK status recovery and definitely refused/uncertain inquiry handling through actual native transport and UI, with no prompt replay and one receipt; assertions can reuse real route fault seams. Keep the native smoke entry cohesive by composing focused fixture/scenario helpers where needed, not growing another god file. Command remains `node e2e/trusted-shell-auth-smoke.mjs`; added scenarios must be included by default so the stated command actually exercises them. Use isolated test-owned source/config hooks, no production authority bypass or real provider/network credentials. If a fixture change would require a production behavior change, stop that addition for scoped review. No live OpenCode failure attribution is claimed by deterministic provider tests.
