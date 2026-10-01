# Chat transport ownership and verification inventory

## Assignment and result

CHAT-SIMPLE-ROADMAP-001 · R2/R4 · revision 1 · Codex side chat (ephemeral), runtime child `/root/candidate_stage/inventory`, reporting to `/root/candidate_stage`. Observed 2026-09-28T23:22:05Z. **Answered for candidate authoring.** Exact R1 result design and R3 recovery transitions are separate investigations; this report does not approve their implementation.

Verified memory CWD `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`, controller home its Mission Control ancestor, and distinct read-only source `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Runtime has unrestricted filesystem access and approval never; assignment restricts it to reads and this report. No delegation. Other writers' changes were preserved. The only durable authored file is this report; a temporary search-output file under `/tmp` was created then removed (minor scope deviation, no product change).

Read session/investigation/shared planning contracts and planning-stage skill; applicable repository/memory AGENTS; First Draft, Roadmap preparation, standards and boundaries reports; current roadmap PLANNING/INTAKE-SNAPSHOT; current Preferences, Code Standards hub/all eight routed articles and Chat overview. This applies focused responsibility, existing ownership, explicit UI identity, durable acknowledgements and public-route verification. No external lookup was needed for repository evidence.

## Complete bounded client send inventory

Search boundary: all `fusion-studio-client/src/**/*.{ts,tsx}` for `.send(`, `sendFusionMessage`, literal chat message families and uses of `threadOpenRequest`/`threadAction*`/`socketSend`. Followed the dynamic diagnostic family and generic helper callers. This inventory covers production renderer chat command emission in that tree; it does not assert that scripts, tests, Electron, plugins, arbitrary iframe content or server provider writes are renderer chat callers. Static type declarations and payload builders are distinguished from emitters. No product client emitter of `response` or `thread:search` was found in that boundary; server support remains preserved.

All source paths in the following tables are relative to the checkout. C2 should migrate these emitters to the one transport owner while retaining domain-owned pending state, targeting and response handling.

| ID / source locator | Actual emitted family and ownership | Response/observable result that must survive |
| --- | --- | --- |
| SEND-01 `src/state/slices/chatSlice.ts:344–386` | `sendMessage` is the one user-text `prompt` sender; request/thread, text, attachments and acknowledged portable selection. Raw send currently reports enqueued/uncertain/not_enqueued. | `message:sent` through thread handler commits one bubble; canonical stream remains stream handler owned. UI submission hook retains drafts/attachments for definite refusal, records uncertainty without replay. |
| SEND-02 same file `:389–400` | `warmThread` emits `thread:warm`, currently chatActive and target gated. | Existing server runtime warm behavior; no invented acceptance/turn start from local enqueue. |
| SEND-03 `src/components/chat/useChatSessionActions.ts:195–229` | Exact-session `turn:stop`; new-thread and model/harness-selected `thread:open-assistant`. Stop sets pending exchange-save before send; creation has surface-owned connecting state. | Stop terminal/save frames remain server authority; `thread:created`/`thread:opened` hydrate exact session. Preserve current pending ownership; no new retry/cancel UX. |
| SEND-04 `src/components/chat/useViewChatHost.ts:113–173` | Generic local send helper used for `thread:open-assistant`; `thread:list` effect; MRU `thread:open` via builder. | List hydration is workspace/view qualified; dedupe includes socket identity. Open records correlated pending selection; worksurface-capable selection delegates before raw fallback. |
| SEND-05 `src/lib/chat/thread-group-command-controller.ts:22–109` | `sendAtWorkspace` sends `thread:open`, `thread:members`, `thread:action` actions rename/delete/copy_link/view_markdown/open_member_in_side/move_chat_to_side/set_harness_selection. | Thread handler applies completed/error, members and opened. Open/model pending state begins only under intended local result; durable mutation result/fan-out/readback remains authoritative. Exact workspace, group and member checks stay. |
| SEND-06 `src/components/chat/ChatSurfaceComponentMount.tsx:107–118` | Restored exact member `thread:open`, requestId, `historyOnly:true`, group/thread IDs. | Passive history hydration cannot activate/warm provider or change Main selection; reconnect/remount belongs to exact surface. |
| SEND-07 `src/lib/worksurface/worksurfaceSwitch.ts:33–50` through `worksurfaceRuntime.ts:88–93` | Selected group's `thread:open` uses shared `socketSend`. | Acknowledgement-gated worksurface switch and exact group content must survive. Recommended migrate the chat call directly; retain non-chat helper unless intentionally adopting same transport with its regressions. |
| SEND-08 `src/lib/chat-action-creation.ts:78–81,130,153` | Already uses `sendFusionMessage` for `thread:open-assistant` and `prompt:resolve`; currently boolean false becomes not_enqueued. | Connection-scoped listeners correlate created/opened/resolved/resolve_error/error by requestId+workspace+epoch; cancellation must not roll back an already committed group. Explicit dispatch continues through the sole prompt route. |
| SEND-09 `src/lib/chat/reply-metadata-api.ts:86–92` | Already uses `sendFusionMessage` for `chat-turn:metadata:update`; ignores return. | `chat-turn:metadata:updated/error` exact thread/exchange; socket retirement and timeout stay with metadata owner. Migration must consume truthful result without interpreting uncertain mutation as definitely absent. |
| SEND-10 `src/lib/chat/prompt-submission-recovery.ts:123–160` and `src/lib/ws-client.ts:455` | `thread:action/prompt_receipt_status`; recovery callback supplied at authenticated workspace:init, currently void. | Receipt handler has dispatch priority, may synthesize accepted ack; C3 changes inquiry outcome/timer consumption only. |
| SEND-11 `src/state/panelStore.ts:522–548` | `selectHarness` and `createDefaultAssistantThread` raw `thread:open-assistant`. `useViewChatHost.ts:227` calls selectHarness. No current call of createDefaultAssistantThread found outside declaration/definition. | Migrate the callable store paths too (or prove and delete unused path/type within scoped cleanup); do not leave hidden raw-send bypass. Existing state resets are not proof of successful creation. |
| SEND-12 `src/lib/ws/chat-diagnostic-handlers.ts:84–134` | Raw `chat-turn:diagnostic:get`; exact diagnostic/thread/turn, optional workspace. | Report/unavailable processed by existing stream diagnostic handler; bounded wait, silent unmatched/null echo, connection retirement. Never log report payload. |
| SEND-13 `src/lib/diagnostics/stream.ts:50–54` | Dynamic `chat-turn:diagnostic:subscribe/unsubscribe` from channel open/reconcile/close. | `chat-turn:diagnostic:stream` keeps subscription ID, target, generation, retired-turn and sequence checks. Cleanup unsubscribe must not be redirected to a replacement socket; old channel target is explicit. No redesign of sampling/logger. |

`src/lib/ws/threadGroupRows.ts:60–267` is a payload-builder owner, not a socket owner. It need not become another transport layer. `chat-action.ts` dispatches user intents to connected owners, not an independent prompt transport. Keep both distinctions.

Deliberate exclusions from the **chat** migration: screenshot storage (`screenshots/chatScreenshotCapture.ts`, `hooks/useScreenshotCapture.ts`), logger `client_log`, non-chat file/view/workspace/clipboard/bookmarks/emoji/secrets/Fusion/Office/Email sends. Chat-adjacent UI names do not change those domains' protocol ownership. `worksurfaceRequests.ts:100,132,166` sends `state:worksurface_put/get/placement` through the helper shared with SEND-07: either leave that helper for those three non-chat operations or cover their CAS/conflict/readback/placement behavior if changing it. Authentication proof writes stay inside shell-auth. Every exclusion remains subject to C1 shared-dispatch regressions.

**Migration completion check:** rerun the same searches over the whole source tree; classify every remaining send. Within SEND-01–13, no direct WebSocket write or separate serialize/send algorithm may remain. Assert the actual shared production function is exercised by caller tests (do not mock it away). Keep non-chat existing `sendFusionMessage` compatibility only where its signature still has live consumers; a separate chat outcome function may use the same underlying transport mechanics, never a second native send. Do not change a global boolean return to a truthy object without adapting all its consumers.

## Current unavailable and pre-authentication policy per sender

`ws-client.ts:290–302` installs `usePanelStore.ws` only in authenticated activation; `:244–253` clears it on retirement. Consequently raw panel-store sends are currently immediate/authenticated-only. Sharing the authenticated sender must **not silently convert them to queueable operations**. The following describes current behavior, including weaknesses to preserve or deliberately handle under R1; it is not an endorsement of absent feedback.

| Sender IDs | Current unavailable behavior | Current pre-auth / retry policy to carry |
| --- | --- | --- |
| SEND-01 prompt | Missing/closed socket yields not_enqueued; native throw uses buffer delta for uncertain versus not_enqueued. | No preauth queue. One deliberate request ID. No automatic original-prompt replay on reconnect or uncertain send. |
| SEND-02 warm | Returns without sending when socket missing/closed, chat inactive or no target; native throw is not caught locally. | No preauth queue or automatic transport replay. |
| SEND-03 Stop/create/select | Stop no-ops without current turn/open socket. Create silently skips send on unavailable socket; select still sets connecting surface state and closes picker. Native throws are not caught locally. | No preauth queue. Stop always exact thread/current command; never replay into a replacement connection. Do not imply local submission proves stopped. |
| SEND-04 list/open/create | Helper silently skips unavailable; effects guard open socket. List records dedupe before raw send, MRU records pending open before raw send. | No preauth queue; list reissues from the host on a new socket (domain-owned discovery), not transport replay. Preserve workspace/view and captured socket identity. |
| SEND-05 group controller | False on wrong workspace/missing closed socket; native throw escapes. Open/model pending state follows local send. | No preauth queue. No automatic replay of any group mutation or model selection. |
| SEND-06 restored history | Effect returns without open socket; native throw escapes. | No preauth queue; new socket reruns passive exact-member hydration via effect, never activation. |
| SEND-07 worksurface open | Shared helper false on missing/closed socket; native throw escapes; selection and request bookkeeping precede send. | No preauth queue. Existing worksurface retry/flush logic remains domain-owned; do not add transport replay or change non-chat content policy. |
| SEND-08 creation/prompt resolve | Initial active workspace+epoch+init+panel socket guard; sameBinding before send. False invokes failed/not_enqueued; retirement cancels scoped operation. | Practically authenticated-only because captured panel socket and initialized binding are required. Existing generic helper can queue elsewhere, but this caller must not gain preauth capability. Preserve 15-second command lifecycle and committed creation semantics. |
| SEND-09 saved metadata | Registers listeners and timeout, calls generic sendFusionMessage, ignores false; disconnected call currently expires by timeout or connection retirement. | Can be admitted to generic bounded preauth queue when transport socket is open but auth pending; queued admission is not metadata success. If new typed boundary narrows this behavior, author must explicitly document it and settle/reject this query locally; never silently retain it for replacement connection. Preserve uncertain mutation as uncertain rather than auto-replay. |
| SEND-10 receipt status | Query returns early unless current attempt, workspaceReady, sender, matching active workspace, no same-generation in-flight. Void call ignores false and starts response deadline; throw clears and schedules bounded status-only retry. | Sender installed/resumed after workspace:init, so keep authenticated workspace-qualified immediate inquiries. Existing bounded status-only retries remain recovery-owned; never retry prompt. C3 owns the false/uncertain transition fix. |
| SEND-11 store create methods | Local state reset happens first; unavailable socket skips send; throw escapes. | Authenticated-only/immediate. Do not queue a reset-derived new-thread operation into another workspace/generation. |
| SEND-12 saved diagnostic get | Invalid IDs return null; missing/closed socket settles pending null immediately; native throw currently escapes. | Authenticated-only/immediate. Connection retirement resolves pending null. No automatic query replay; report still requires explicit action. |
| SEND-13 live diagnostic channels | No-op for captured socket not open; throw marks disconnected. | Immediate on captured channel socket; re-subscribe is channel-owned on changed socket with a new subscription ID and fresh observation window. Unsubscribe for retired channel must refuse if it cannot target that owner; never send to replacement. |

The new transport may surface failures more truthfully according to R1, but caller ownership remains. Queueability requires an explicit caller policy, captured workspace/generation and retirement disposition; it must not be an accidental property of routing through sendFusionMessage. Mutating original commands never replay automatically. Explicit domain refresh/read/re-subscription and existing receipt-status inquiry retries are separately owned operations with their existing identities.

## Extraction recommendations and complete entry dispatch map

These are implementation recommendations, not additional product scope. Current sizes: server 918 lines, client 665 lines. Extract coherent owners, not arbitrary line bands. Keep existing public entry module paths if consumers need them, but each must retain a meaningful responsibility rather than become a shim over a second god file.

### Server

| Proposed owner | Current locations/responsibility | Boundaries and checks |
| --- | --- | --- |
| `client-message-router.js` retained ingress/composition | `:81–139` handler construction/recipient dependencies; `:284–355` bounded decoding/log minimization/dispatch precedence; existing delegated families `:793–878`; error and close `:881–915`. | Receives decoded product messages only after shell auth factory admission. Keep request diagnostic boundary around async work and close. Close disposes diagnostic subscription then awaits exact-session cleanup; finally deletes session/root. Never second-kill transferred wire. Aim below400 lines after domain moves. |
| Proposed `view-workspace-ws-handlers.js` | `:140–235` readiness, captured workspace binding, discovery leases, recipient fan-out/rejection; `:498–680` workspace state push, registry changes/options and set_panel. | One owner of view-bound connection operations; each mutation remains trusted, serialized and revalidated; registry recipients each receive their own epoch. Do not add these responsibilities to the already broad `workspace-request-handlers.js`. |
| Proposed `chat-runtime-ws-handlers.js` | `:237–282` exact provider binding; `:418–444` prompt resolution; `:684–790` initialize/prompt/Stop/response. | Private chat ingress operations delegate to existing receipt/runtime/wire owners. Prompt keeps trusted guard→request/config validation→captured current workspace binding→workspace lease→same-attempt receipt lock→runtime accept. Keep temporary stage logging. Resolve and initialize retain fixed error behavior. |
| Proposed `file-request-dispatch.js` or existing file explorer composition where cohesive | `:357–416,446–494` file tree/content/recent, governed save, provenance/activity query, fixture, folder/document create. | Classify File Viewer versioned/unspecified panel before compatibility panel route. Installed governed routes fail closed; view discovery acquires readiness lease through view owner. This is dispatch to owners, not new persistence/file policy. |

The full retained server dispatch order is: client_log redaction; thread handler map; diagnostic prefix (unknown diagnostic consumes without metadata fallthrough); chat-turn metadata trusted gate; file tree/content/recent; prompt resolve; file_save/resource provenance/agent activity/test fixture; folder/document create; workspace state/view registry/panel; initialize/prompt/turn:stop/response; fusion; clipboard; bookmarks; emoji_recents; theme; secrets; harness; workspaceRequestHandlers exact key; screenshot; fixed unknown/error handling. Author may combine adjacent cohesive helper responsibilities but must preserve this map and precedence.

Existing owners remain `thread-ws-handlers.js` for open/open-assistant/action/fork denial/warm/search/list/members; `thread-action-handler.js` for receipt status and mutation dispatch; chat-turn metadata/live/saved diagnostic modules; workspaceRequestHandlers for workspace lifecycle, folder browse, state and worksurface, file move/rename/delete, Office thumbnails. They are dependencies, not incidental decomposition targets.

### Client

| Proposed owner | Current locations/responsibility | Boundaries and checks |
| --- | --- | --- |
| `ws-client.ts` retained connection lifecycle and product transport | `:77–105,191–196,244–416` socket/auth/generation/reconnect and retirement. | One native transport owner, same runtime descriptor authority. Retain socket+generation guard, auth-before-store activation, reset/retire ordering, one reconnect timer. C2 extends this owner via R1 contract rather than introducing a competing chat socket. |
| Proposed `ws/fusion-response-listeners.ts` | `:107–145,198–241` subscriptions/retirement registry. | Lifetime distinction between persistent listeners and connection-scoped responses; deduplicate retirement callbacks and unsubscribe before invoking. No circular import through store to sender required. |
| Proposed `ws/application-message-router.ts` | `:147–188,418–466,657–665` safe ingress/redaction, diagnostic boundary and ordered domain dispatch. | Preserve terminal sanitization before logs, fixed allowlist diagnostic redaction, and currentness passed to workspace owner. Keep local outcome handling outside this inbound router. |
| Proposed `ws/view-state-handlers.ts` | `:467–588` state:result/error. | Own mutation watermark, request origin/workspace guard, pending optimistic merge, bound content protection, settle/load and currentThreadId logic together. This is substantive state reconciliation, not transport policy. |
| Proposed `ws/shell-message-handlers.ts` (or existing fitting domain handlers) | `:590–653` connected/modal/panel delta/Fusion/clipboard/emoji/secrets responses. | Separate residual shell presentation/dispatch from lifecycle; retain actual stores/listener owners. Avoid recreating all domain handlers in one new catch-all module. Split secrets application only if reuse/cohesion warrants. |

Full inbound precedence: metadata/document notifications first; receipt status next (including synthesized ack); correlated generic error listeners before stream; stream before thread; workspace/epoch check before created/opened thread mutation; thread notifications after handler success; worksurface; file; provenance; workspace (resume receipt recovery only after init); prompt resolved/error notification; harness; theme; screenshot; bookmarks; calendar; Office palette; state result/error; connected/modal/panel/Fusion/clipboard/emoji/secrets. Keep exactly one handling decision per frame except deliberately documented notification+domain application cases.

Response preservation map: thread:list/members/created/opened/action completed/error/message:sent → thread handlers; canonical begin/content/thinking/tool/end/error/saved/diagnostics → stream handlers with live frontier; receipt status → recovery then optional thread accepted ack; metadata updated/error → scoped response listeners plus established application; prompt resolve/creation errors → chat-action-creation listeners; worksurface result/error/changed → worksurface handlers; workspace init/change → workspace handlers; state result/error → extracted state owner. Existing non-chat handlers keep their own family matching.

## Verification plan grounded in existing entry tests

Nothing below was executed. Read existing test titles/configuration and selected public-route bodies to establish executable starting points. Tests listed here must remain meaningful after extraction; changed source paths in source assertions need deliberate migration, not weakening.

From `fusion-studio-server`:

```sh
npm test -- --runInBand --runTestsByPath test/ws/client-message-router.test.js test/ws/prompt-canonical-route.integration.test.js test/ws/privileged-thread-public-route.integration.test.js test/ws/chat-turn-diagnostic-route.integration.test.js test/ws/live-diagnostic-route.integration.test.js
```

C1 server base covers public decoder/save routing, view readiness/trust/lease changes and fan-out, owned Stop/response transfer, prompt route canonical drain, diagnostic precedence and fixed log values. `npm test` invokes native observer build in pretest; record environmental failures, do not silently claim tests passed. Add missing delegated-family parity cases to public router test, especially fusion/clipboard/bookmarks/emoji/theme/secrets/harness/workspace/screenshot route selection, prompt resolution and close. Existing tests mock some domain dependencies; pair mutation semantics with real owner integration below.

```sh
npm test -- --runInBand --runTestsByPath test/ws/thread-group-protocol.integration.test.js test/ws/thread-group-member-access.integration.test.js test/ws/thread-group-move-side-chat.integration.test.js test/ws/thread-worksurface-routes.integration.test.js test/ws/prompt-submission-recovery.integration.test.js test/ws/shell-auth-public-route.test.js
```

Use only affected cases per slice. Durable action evidence must include requester result, second recipient, authoritative readback and delivery-failure isolation; worksurface migration requires revision conflict and exact restored content. Receipt-service integration is supporting evidence; it is not a client transport-outcome test.

From `fusion-studio-client`:

```sh
npm run build
npx playwright test --config=playwright.chat-architecture.config.ts e2e/runtime-transport.spec.ts e2e/shell-auth-client.spec.ts e2e/thread-bootstrap-order.spec.ts e2e/prompt-ownership.slice-c.spec.ts e2e/chat-diagnostic-actions.slice-c.spec.ts e2e/stream-diagnostics.spec.ts
```

That existing configuration is fixture-only, no webServer, one worker. Runtime transport tests include stale native callbacks, listener/diagnostic retirement and log suppression. Prompt fixture tests boot the built client via the trusted-shell fixture, exercise correlated acceptance/reload/late-error ownership and source store portions; these do not certify native OpenCode. Build must precede browser fixture tests and identify generated bytes. Do not run the default `playwright.config.ts` for this job: it reuses whatever listens at3001. Existing chat-surface/chat03/thread-group configurations use isolated ports/profiles but their HTTP/native assumptions must be assessed if selected; they are not substitutes for authenticated shell evidence.

**Required added tests in the approved implementation:** the current inventory does not supply a complete shared-send or C3 test. Add focused transport tests exercising actual connection/auth owner plus each SEND ID (table-driven appropriate), refused and uncertain transmission, workspace/generation rotation, queued cancellation contract from R1 and no prompt replay. Add public recovery/UI route checks for explicit Check status and scheduled status when definitely refused vs uncertain, both acceptance and execution watches, late exact reply, reconnect and unrelated new attempt. Verify no orphan five-second inquiry deadline on definite refusal. Assert two-second Working/hourglass behavior using existing working-activity fixture; do not change that timer or introduce new provider liveness inference.

Non-chat regression minimum for C1: File Viewer versioned route + legacy panel readiness; view registry recipient epochs and denied mutation; state mutation ordering/bound worksurface content; Office palette generation/bootstrap; clipboard listener retirement; secrets diagnostics suppression; resource provenance retirement; startup workspace:init before any recovery/list work. Existing router/runtime-transport tests cover parts; add route cases for moved uncovered branches. A compile/build alone is insufficient.

Suggested stale-bypass checks, from checkout (inspect/classify results; success is not zero matches globally):

```sh
rg -n '\.send\(|sendFusionMessage' fusion-studio-client/src --glob '*.{ts,tsx}'
rg -n 'threadOpenRequest|threadAction[A-Z]|socketSend|chat-turn:diagnostic:' fusion-studio-client/src
rg -n 'temp_chat_boundary_v1|TEMP CHAT-AR I-007' fusion-studio-server/lib/logging.js
```

### Required native authentication/restart evidence

Additional bounded source read: current Chat Testing And Operations hub, `e2e/trusted-shell-auth-smoke.mjs` in full, `e2e/side-chat-electron-smoke.mjs:1–110`, and existing authentication test inventory. The domain hub requires broad server regression for shared chat contracts, and shell/auth-specific checks when these boundaries change. Add at final integration `cd fusion-studio-server && npx jest --runInBand`, with build evidence, rather than describing focused suites as the complete domain gate.

The existing native authentication entry is **`fusion-studio-client/e2e/trusted-shell-auth-smoke.mjs`**. After the current build, its command from client root is:

```sh
node e2e/trusted-shell-auth-smoke.mjs
```

It already launches Electron against a temporary profile, observes committed `fusion-shell://app/`, authentication before workspace:init, absence of auth material in renderer logs, kills only its identified Electron child server, verifies endpoint/generation rotation and fresh auth/init, emits fixed success marker, closes app and removes temporary profile. Optional `FUSION_SMOKE_EXECUTABLE` points to an explicitly selected packaged executable for the packaged variant; absent that variable it launches the checkout's electron/main.cjs.

**Concrete isolation repair required before running in this dirty checkout:** its current temporary profile seeds the development workspace and its finally restores two development style/config files. That restoration can overwrite a concurrent legitimate edit. Extend this existing smoke with the already implemented isolated migration/seed-removal/temp workspace setup in `e2e/side-chat-electron-smoke.mjs:41–70`, eliminating live-file restore writes. Keep assertions for no residual child/owned cleanup after close and exactly-once post-init cleanup; the current smoke does not fully assert those. This is a scoped SPEC1 verification-harness change, not a product feature or a reason to operate on the owner profile. Use existing cleanup/shutdown tests as supporting evidence, and extend the native smoke to observe the needed lifecycle result.

Additional executable supporting commands:

```sh
# client root
node --test electron/shell-launch-authority.test.cjs electron/shell-bootstrap-inventory.test.cjs electron/runtime-preload.test.cjs electron/runtime-ipc.test.cjs
# server root
npm test -- --runInBand --runTestsByPath test/shell-bootstrap.test.js test/ws/shell-auth.test.js test/ws/shell-auth-dispatch.test.js test/ws/shell-auth-public-route.test.js test/ws/shell-auth-recipient-isolation.test.js test/ws/server-runtime-activation.test.js test/shutdown.test.js
```

Server real upgraded-socket cases and activation/shutdown tests cover complementary expiry/abnormal close/preauth denial and factory/recipient/cleanup barrier assertions; native smoke alone must not be claimed to establish every denial. The two-second visible-wait fixture and native shell restart test are different evidence. Existing Side Chat Electron smoke is a reuse source for isolation; its outdated outer-rail control assertions are outside this refactor and need not be run to imply approval of that deferred behavior.

## Current source/build provenance and deferred-repair protection

All 35 INTAKE-SNAPSHOT entries matched at23:22:05Z. Product tree is dirty: `git status --short --untracked-files=normal` produced785 entries; both extraction targets are tracked modified. This is an observed working-copy baseline, not a reproducible source commit/build attestation. Capture exact owned input hashes and changed files before each implementation slice; do not overwrite concurrent changes. Existing built output timestamps cannot establish that every imported source matched that build, and no running app identity was inspected.

Observed artifacts: `dist/index.html` mtime2026-09-28T08:40:06.844046Z links `assets/index-DrVEJV-g.js` and `assets/index-D-VGcjKx.css`; preload mtime08:40:00.045032Z. Build/package scripts explicitly run preload build, `tsc -b`, Vite; Electron dev does that before launching. Fresh implementation verification must bind source snapshot, command and resulting output hashes. Do not claim these old bundle bytes are a certified rendering baseline.

D-005 remains repairable because receipt projection/status and same-attempt lock stay in `prompt-submission-service`, runtime dispatch remains server-owned, provider session/retry behavior stays in adapters, and client recovery retains exact attempt identity. These extractions require no receipt/schema/provider changes. Hold any selected API that collapses enqueue uncertainty, strips request/thread/workspace/connection identity, replays a prompt, freezes unresolved recovery as a plugin contract or relocates receipt/runtime authority into transport. Resolver is parked task `01a0ea32-f152-77a2-afc2-b73e8976685a`, owner resumes after three-SPEC build/approval. No consumer reliability release is established here.

`fusion-studio-server/lib/logging.js:17–19` explicitly says remove private temporary sink or migrate closed fields to governed content-free health subscriber; `:40` emits `temp_chat_boundary_v1`. Preserve annotation and existing fixed stages at moved ingress boundaries. No logger redesign, leak diagnosis, broad failure matrix, DB process analysis or new health capability was undertaken.

## Fingerprints and remaining work

The initial extraction hashes and previously mapped twelve product files remain as in the draft BOUNDARIES-REPORT; current intake matching independently confirms its intake-covered entries. Additional inspected migration/build identities follow. Hashes identify bytes only.

| Checkout-relative path | SHA-256 |
| --- | --- |
| fusion-studio-server/lib/ws/client-message-router.js | b59f4d74c218e73a4cc828a82a5faa7cbbe08299d7ed1ac78718eac7412036a6 |
| fusion-studio-client/src/lib/ws-client.ts | 799ea39d8085c7d7472aab0e56ba3c748488a3f9a007a18b79c427854e708648 |
| fusion-studio-client/src/state/panelStore.ts | 6f307272016a41c47cd55007958254bd555fce2fc9f79ce65eb88c13b234b648 |
| fusion-studio-client/src/lib/chat-action-creation.ts | 511723c364bdc1cadc72aa4d9911fb05eea1d9add525e23574a2fa08c3a77a4b |
| fusion-studio-client/src/lib/ws/chat-diagnostic-handlers.ts | 52234681f285090fae98cb893f7dbb474a53c3f3c27a20f9421f62db6dd8652f |
| fusion-studio-client/src/lib/diagnostics/stream.ts | b90d969d815076e67afc415e620d9a7ea9458ea70308a0dd0ac6b2967b48b04b |
| fusion-studio-client/src/lib/worksurface/worksurfaceSwitch.ts | da896c39e5e2695f7708b6413caea0287eecc96832daad167272c8fe80f6719e |
| fusion-studio-client/src/lib/worksurface/worksurfaceRequests.ts | 90f021112e110a2e463e609d13311b9ee8db84f1cf9af44556101a69c95eacc9 |
| fusion-studio-server/lib/logging.js | 2acf3c7bee42238358add9b447fe3091a3eb275e20ccccc45f5ea8e77bf4b0ab |
| fusion-studio-client/package.json | 9b9e9c906358afd17eb5027af187fbe2030c537a9536d6d0d6fbcf64fb70dfb0 |
| fusion-studio-server/package.json | 3833f2758cec00e0e4be6ba561def3732ed15f2796452b041d25bfb2c4e0389e |
| fusion-studio-client/dist/index.html | 48c847d7df0967e025bf65d77248dce94b68baa96e56c996a876aaa762af9d26 |
| fusion-studio-client/dist/assets/index-DrVEJV-g.js | 49892ddce5e85ec9f1ac2acdc148871625f9ca59589bf1c42f978923ebb3e29c |
| fusion-studio-client/dist/assets/index-D-VGcjKx.css | 230b93ffbc7fda6a3c17eb38982513963b679b1c994530524ce5ade90417a951 |
| fusion-studio-client/electron/preload.cjs | a87aaefb6d60425ec30013a6a1b8a2a3e21d50208a6c1727adc0be9968adef05 |

Remaining author work: settle R1/R3 with their assigned investigators; choose exact cohesive file names/slice ownership and incorporate this SEND inventory; create explicit added-test responsibilities, not pretend existing tests cover new behavior; update current Chat Structure/protocol owner maps when implementation moves code. No additional owner decision identified. Next safe action is author synthesis and independent candidate-stage validation. No tests, builds, app/database operations, Git publication or product writes occurred in this investigation.

Additional verification-source fingerprints:

| Checkout-relative path | SHA-256 |
| --- | --- |
| fusion-studio-client/e2e/trusted-shell-auth-smoke.mjs | f95dd2e6aeb3dc3cf5c5b2608167137b3eab04dd70b9009c8c094c2256e64984 |
| fusion-studio-client/e2e/side-chat-electron-smoke.mjs | 5665798ac5f8289debf00ab8bbd5173574afacbb6ef5d172b5adc0ac4581fbc6 |
| fusion-studio-client/playwright.chat-architecture.config.ts | 30605cd962368f6ed861727a7ec88d3baebd28a193a2edd5e792f23c58a71f24 |
| ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/PAGE.md | f56259979108c6b5b188527a5a3eb5f75f718c8bf892c8cfee3872c70d94b7c7 |
