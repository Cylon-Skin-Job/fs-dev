# S4 New Chat repair — builder packet

## Assignment and current disposition

- Recorded by Codex side chat (ephemeral), `/root/s4_new_chat_repair`, at 2026-10-05T08:19:03Z; manager `/root`.
- Bounded assignment: diagnose the owner-observed New Chat failure, repair only a demonstrated renderer/thread binding defect and necessary integration under approved S4, then return a fresh builder-owned review packet. Whole-S4 public OpenCode acceptance remains the manager's pending runtime work.
- Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.
- Verified memory CWD: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`.
- Separately verified implementation root: `/Users/rccurtrightjr./projects/fs-dev`; branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`.
- Procedure: controller `session-contract.md`, `.agents/skills/mc-spec-slice-builder/SKILL.md`, and `.agents/skills/mc-spec-review-gate/SKILL.md`, read fully. Repository and memory-folder instructions refreshed separately. Actual execution permissions are unrestricted filesystem, network enabled, approval policy never; assignment boundaries still apply.
- Authority: [approved SPEC](../SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md), [owner receipt](../OWNER-APPROVAL.md), [dispatch](../IMPLEMENTATION-DISPATCH.md), and manager's bounded 2026-10-05 follow-up. Normative SPEC SHA-256 remains `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`. Approved candidate `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`.
- Accepted prerequisites S1–S3 and earlier S4 automated/documentation evidence preserved. Prior reports/ledger were read; this builder edits none of them.
- Candidate disposition: **READY_FOR_ORCHESTRATOR_REVIEW** for this bounded repair. Automated checks passed and the fresh builder-owned gate is **CLEAN**. No whole-S4/SPEC completion or native acceptance claim.

## Diagnosis and evidence boundaries

The ordinary view rail (`useViewChatHost`) and collapsed header (`useChatSessionActions`) send `thread:open-assistant` with their explicit `viewId` and no `requestId`. Server normalization preserves that target; `thread-crud.js` resolves it, creates the group/session, sends `thread:created`, refreshes that group's own list, and sends `thread:opened`. Persistence and creation are therefore separate from renderer selection and provider readiness.

Before this repair, `thread:created` selected only global `currentThreadId` for an uncorrelated create. That global setter also persists a raw current-thread patch through the active view state. Production hosts instead read the selected group for `{workspaceId, viewId}`. The automatic `thread:opened` changes that population only if the response matches a pending open, its group is already selected, or the population has no selection. Ordinary New Chat registered no pending open. A second New Chat therefore kept the oldest selected group even after the server created and opened the new one.

The added handler/store regression failed before the product patch: first it exposed the unwanted Legacy selection mutation (`legacy-selected` became `new-thread`); checking the primary view assertion first then showed selected group `group-alpha` instead of `new-group`. After the patch it passes through the actual message handler with created/list/opened ordering. The rendered regression clicks the actual rail New Chat button and verifies the accepted new group, exact `data-chat-thread-id`, and enabled composer.

Manager-supplied read-only runtime observations corroborate this boundary, without establishing every owner symptom:

- The isolated profile contains four newly created empty OpenCode sessions at 2026-10-05T07:54:31.708Z, 07:54:39.020Z, 07:54:47.439Z, and 07:55:04.524Z. Their groups are all bound to `capture-viewer`, workspace `fs-dev`, with matching current primaries. `threads.view_id = null` is not a failed group binding; `thread_groups.view_id` is authoritative.
- Capture's oldest row/group (`tg-d454fda7-9086-4bab-80ee-6c6f42c8024e`) remained selected; the newest three were unselected. Latest active panel was Issues, leaving Capture inactive and its composer disabled. That later panel does not establish where the first attempt occurred.
- Actual selected workspace was the development repository, label Fusion Studio, rather than the offered scratch workspace. Scratch setup remains a separate runtime prerequisite.
- No accepted prompt, exchange, real provider PID/session, completed response, or readback evidence exists in this follow-up. Durable session rows are not provider/readiness proof.

The reported temporary renderer CPU/memory spike and large mounted DOM remain unattributed. The supplied macOS sample is V8-heavy and the app later became idle; the sample alone does not identify a New Chat render cause. This repair makes no measured latency/resource claim and does not alter full document mounting. Source/DB/UI observations must not be represented as a provider launch defect.

## Changed files and behavior

| Path | Builder-owned change |
|---|---|
| `fusion-studio-client/src/lib/ws/thread-handlers.ts` | Route an accepted uncorrelated view-bound create through existing `requestGroupSelection`; adapterless views register an exact population/session pending open. Legacy/null create retains global selection behavior, and correlated creation retains its existing action owner. |
| `fusion-studio-client/e2e/threaded-chat-host.spec.ts` | Add selection, outgoing Capture save-ack, and rendered rail/button regressions. Refresh the isolated fixture's transport capability to exercise the current `product-send` entry rather than using a socket that admission cannot recognize. |
| `fusion-studio-client/e2e/chat-send-transport.spec.ts` | Correct SEND-05's synthetic creation response to preserve the outgoing request's nullable view. Legacy helpers omit `viewId`; the server does not infer `view-sync` from a prior passive open. Its synchronous global-selection oracle is retained. |
| This report | Dedicated builder evidence and deviation accounting only. |

No server, hook, protocol, harness, transport policy, provider, retry, persistence/schema, canonical Wiki, owner runtime profile, Alpha, or shared coordination record was changed by this builder. Existing unrelated dirty edits were preserved.

## Acceptance mapping and immediate integration self-review

| Approved obligation / invariant | Evidence and disposition |
|---|---|
| A-06 / R-06: diagnose and repair a concrete ordinary public-chat failure within S4; no speculative redesign | Reproduced second-create selection failure, source-traced accepted response path, bounded handler repair. This completes the local repair prerequisite; actual public chat remains pending. |
| A-07: thread identity, server-owned acceptance, canonical harness/persistence ownership | New selection uses the accepted group/session and explicit population; no prompt, acceptance, translator, exchange writer, provider ownership, or identity change. |
| §6.S4: rerun affected automated checks after concrete repair | 34 focused client checks and current client build pass; exact command below. |
| View populations and late-open discipline | Adapterless accepted creates register the existing exact pending-open intent; other population and Legacy selections/content remain untouched. Existing correlated/cancelled creation and `historyOnly` handling remain unchanged. |
| Existing worksurface save/conflict gate | Registered content views use the established outgoing capture/CAS/ack transition. The Capture regression proves automatic opened cannot bypass it, old group/content binding persists until ack, then new binding/select/passive open/exact entry GET occurs. No global `state:set` is emitted by the view-bound create. |
| Workspace/epoch isolation | The outer application-message router rejects foreign workspace/epoch create/open responses before this handler. Existing active-workspace addressing is preserved; no new authority is taken from a renderer request. |
| Public OpenCode acceptance §6.S4 / §8.8 | **PENDING / unverified**: authenticated product prompt, actual child/session, completed assistant response, exact durable exchange and normal reopen/readback required. Tests and build do not substitute. |

Read the full current Chat Overview, Harness Boundary, Testing and Operations, Runtime Model, Code Standards hub and all eight routed standards. Important current source identities: Chat Overview `696afb2d3ec027256e783957c3461eb03300db0b97b34b3e62162977c22ed42f`; Harness Boundary `c2befc2bfc71701074fae823ea1c13f1f2d87f4e19702b01e78f9407f01d52e2`; Testing and Operations `bf5109fd6a7a310a8d62311274708829df0ab9ab4ae09334ccb003d20701d37b`; Runtime Model `ec38f18dc55ffb9d59f46683116aae158f2cf2643ae76a99a6f26df2d9f6d293`; standards hub `de3995c68ae84f3b0fa389c6af0327e21dd08f30ac9ffbc7548b76f80ac393d7`. Runtime Model includes prior accepted S4 retirement edits; it was read as current source, not overwritten with the planning baseline.

Self-review covered request emission, server create/list/open order, `addThread` population projection, `hydrateOpenedThread` pending-open consumption, registered/adapterless selection, outgoing worksurface capture/revision/ack/conflict ownership, Legacy/correlated paths, transport-fixture admission and workspace guards. An initial pending-open-only candidate would bypass the registered Capture content transition; the final candidate uses the existing controller instead.

## Checks, fixture adapters and invalidation

All new verification uses isolated test-owned surfaces. Neither default `playwright.config.ts` nor port 3001 was used.

| Check | Exact command / result |
|---|---|
| Pre-repair causal regression | Client: `npx playwright test --config=playwright.chat-architecture.config.ts e2e/threaded-chat-host.spec.ts --grep 'ordinary New Chat'` — failed on unwanted global mutation, then failed on old view selection when that assertion was checked first. These are expected red results on original product bytes. |
| Cumulative affected client tests | Client: `npx playwright test --config=playwright.chat-architecture.config.ts e2e/threaded-chat-host.spec.ts e2e/chat-send-transport.spec.ts` — **PASS, 34/34**, 24.1 seconds. Terminal runner; log `/tmp/chat-ar-s4-new-chat-checks.log`. |
| Current client build | Client: `npm run build` — **PASS**, preload, TypeScript, Vite (1,957 modules). Existing warnings: gray-matter eval, CaptureTiles mixed dynamic/static import, large output chunk. |
| Scoped whitespace | Checkout: `git diff --check -- fusion-studio-client/src/lib/ws/thread-handlers.ts fusion-studio-client/e2e/threaded-chat-host.spec.ts fusion-studio-client/e2e/chat-send-transport.spec.ts` — **PASS**. |
| Authority/current checkout | `git rev-parse --show-toplevel`, `git branch --show-current`, `git rev-parse HEAD`, SHA-256 of normative SPEC and changed paths — expected primary root/branch/HEAD; approval hash matches. |
| Prior S4 server/docs verification | Reused report-attested unchanged server/docs evidence in [prior builder packet](S4-builder-report-2026-10-03.md) and [orchestrator acceptance](S4-orchestrator-acceptance-2026-10-03.md): integrated Jest 8 suites/55 tests; Apple no-wait 1/1; full server 219 suites, 3,244 passed/1 skipped including native-observer pretest build; retired-source sweep, 16-page relative links and scoped diff check. This builder did not rerun those server/docs checks. The repair changes only renderer selection/tests and does not invalidate their dependency surface. Parent retains final integration ownership. |
| Native public UI smoke | **Not executed by this builder.** Manager explicitly owns live diagnostics/manual UI and prohibits live clicks, prompts, stop/restart/profiling here. No native acceptance is inferred. |

`playwright.chat-architecture.config.ts` uses one worker, port `CHAT_TRANSPORT_TEST_PORT` or 43177, rejects 3001, and `reuseExistingServer: false`. Its `node e2e/chat-transport-test-server.mjs <port>` constructs a fresh `/tmp` profile and workspace, registers only `boot-fixture`, sets `FUSION_APP_USER_DATA` and `FUSION_LOCAL_MACHINE=RC-MacAir-15`, and owns its server/cleanup. Root was told the runner is terminal before its rerun, avoiding shared `test-results` collisions.

The threaded-host fixture installs a test-only ProductSendCapability with its fake socket and immutable fixture binding. Actual product-send serialization, caller policy, expected socket, binding recheck and result contract still run. It does not claim real shell authentication, generation handling, actual transport delivery, provider response, or durable storage. The separate transport suite exercises those production send-result seams within its declared fixture. Browser rendering uses the production connected host/handler with fixture messages, not an actual public OpenCode session.

Intermediate candidate runs exposed stale transport-fixture admission (18 passed/3 failed), then a wrong test-only ChatSurface attribute (22 passed/1 failed; actual DOM showed `data-chat-thread-id`), then SEND-05's impossible inferred view binding (33 passed/1 failed). Each was repaired in the test source and the cumulative 34/34 gate rerun. Product repair was not weakened to satisfy those stale fixture assumptions.

## Deviations and downstream impact

Proposed classifications are for the orchestrator to decide; they do not grant acceptance.

Manager's current scope classifications in its ledger: D-02 is `accepted` bounded S4 handler repair scope with implementation acceptance pending; D-03 is `accepted` bounded fixture correction with fresh repair review pending. Those scope rulings are separate from this builder gate and whole-S4 runtime acceptance.

1. **Bounded renderer repair beyond original S4 expected code/docs paths — proposed accepted.** Original: “Repair only the concrete launch/chat failure shown by the approved scenario” (A-06 / §6.S4). Change: `thread-handlers.ts` accepted uncorrelated view create selects via the existing worksurface gate or exact pending open. Reason: source and deterministic reproduction prove a view selection failure after durable creation; the manager explicitly assigned this repair. Checks: pre-repair red regression, final selection/render/Capture ack checks and build. Effect: second New Chat can replace the selected group without Legacy/content mutation. Risk: existing content-save failure/conflict may intentionally delay switching; the repair preserves that gate. Downstream: native smoke must reload current renderer bytes and verify actual selected scratch workspace; plugin consumers keep the same identity/routes.
2. **Fixture transport refresh — proposed accepted mechanical integration.** Original: §6.S4 requires affected automated checks; current CHAT-SIMPLE send contract requires authenticated captured binding. Change: threaded-host fixture installs its own explicit transport capability. Reason: fake sockets alone are no longer admitted, so historical rendered command checks had silently stale setup. Checks: all affected tests now pass through product-send. Effect/risk: fixture is more representative of current admission but does not prove authentication; stated above. Downstream: no product transport behavior changes.
3. **SEND-05 nullable-view correction — proposed accepted mechanical test correction.** Original: canonical server `viewTarget` defaults null and never infers active/prior view. Change: synthetic create response uses `frame.viewId ?? null` rather than hard-coded `view-sync`. Reason: Legacy helper calls omit viewId and their old oracle depended on the defect this repair removes. Checks: transport suite and cumulative 34/34 pass, synchronous global selection assertion preserved. Effect/risk: distinguishes Legacy and explicit-view create; no runtime change. Downstream: no public protocol change.

Native smoke is an **unmet required S4 criterion under delegated manager ownership**, not an accepted scope deviation or downstream product impact. §6.S4 still requires isolated profile **and scratch workspace**, authenticated public prompt, actual provider child/session, response, durable exchange/readback. Current wrong-workspace setup and explicit live-operation ownership explain the pending state; whole S4/SPEC remains unaccepted until direct evidence passes.

## Candidate identity

| Artifact | SHA-256 |
|---|---|
| Normative SPEC | `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3` |
| `src/lib/ws/thread-handlers.ts` | `7b45de46522d0cb67666bf63fe286474eb9c4e3fb6e6ee644ae5cf5e7058d81b` |
| `e2e/threaded-chat-host.spec.ts` | `ec6802c336107d25e1b443a3bf3519a002eef7c86cf2ea8dc74d7fc839bafb27` |
| `e2e/chat-send-transport.spec.ts` | `c6b5b57d57e450e2d7e5927d75adeee686f200dd3da61b0d94b983885a5a0e3b` |

## Builder review and lifecycle

- Fresh reviewer: `/root/s4_new_chat_repair/new_chat_cleanroom_1`, Codex side chat (ephemeral), `clean-room-reviewer`, spawned with `fork_turns: none`, inherited root model/effort with no override.
- Gate: builder-owned bounded repair and immediate integration, not full S4 acceptance. The packet contained raw assignment/authority, current files/hashes, criteria, check results/adapters and D-02/D-03 scope rulings; no prior reviewer conclusions or author/manager conversation were inherited.
- Terminal result at 2026-10-05T08:27:39Z: **REVIEW_COMPLETE — CLEAN for the bounded New Chat repair**, no material findings, required corrections or blocking advisories. The reviewer checked the exact candidate hashes above, source request/create/list/open order, registered and adapterless selection, save-ack/conflict ownership, correlated/Legacy/history-only behavior, workspace guards and fixture admission. It read controller/gate/instructions, approved authorities, Chat sources and all eight routed standards.
- Evidence: reviewer independently inspected current bytes and the isolated 34/34 log; reused report-attested build/diff checks without rerunning tests or touching the live app. It explicitly retained actual public OpenCode prompt/PID-session/response/exchange/history as an unmet required whole-S4 criterion under manager ownership and made no resource attribution claim.
- Lifecycle: reviewer delivered a terminal final result; no other reviewer in this repair task exists and no conflicting child writer remains. `close_agent` is unavailable in this runtime, so closure could not be attempted. This is recorded lifecycle evidence, not a gate blocker.
- No post-review product/test changes or invalidated checks. Parent's independent acceptance/final gates remain separate.

## Residuals and next safe action

The candidate repairs demonstrated renderer selection; initial create latency/resource attribution and live owner acceptance remain unproven. Parent must verify scratch registration/selection, coordinate current renderer reload through the canonical restart workflow when appropriate, then run the full §6.S4 public OpenCode prompt/session/response/persistence/reopen scenario and separate fresh acceptance/final gates. Existing native UI selection/profile limitations and the temporary large DOM/resource observation remain evidence boundaries. No commit, push, Alpha, worktree, MC activation, scheduling, identity/checkpoint change or external completion message was performed by this builder.
