# SPEC-04 — Server-owned remote turn continuity

Status: DRAFT candidate. Prerequisite: accepted SPEC-03.

## Execution packet

Read BUNDLE-INDEX.md, DECISIONS.md, ROADMAP.md, GUIDANCE.md and ISSUES.md in this directory. GUIDANCE.md's fresh builder/reviewer lifecycle applies to each slice below without exception. Each slice is a complete public-route increment, including necessary integration and its checks. A new builder handles the next slice only after orchestrator review is clean. Record every deviation and its consumers. Owner acceptance is required before the following SPEC.

Baseline: record the accepted current commit, relevant dirty paths and existing test results at dispatch. The planning snapshot is not a frozen execution branch. No live profile/DB mutations in fixtures. No migration may rewrite existing machine identities, workspaces, transcripts or view state. New module names below are proposed owner locations; if existing owners suffice, use them and report the mapping.

## Exact code standards

Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Read fully, plus:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

## Objective and scope

Make an already accepted browser-initiated AI turn survive loss of its browser connection. This is a material runtime change: current `handleClientClose` calls `ThreadWebSocketHandler.cleanup`, which closes the owned provider session and retires its drain. Do not claim reconnect UI alone solves it. No unattended job scheduler, auto-resubmission, provider crash restart, cross-server persistence or change to prompt/Stop vocabulary.

## Authorities and expected areas

BR-D04 and proposed continuity contract BR-D17 (approved with this candidate). Read full current Chat Runtime Model, WebSocket Protocol, Thread Actions, Overview, canonical drain and provider ownership tests. Owners: `fusion-studio-server/lib/ws/client-message-router.js`, `lib/thread/ThreadWebSocketHandler.js`, `ThreadManager.js`, `session-manager.js`, `thread-runtime-controller.js`, `thread-runtime-manager.js`, `canonical-drain-context.js`, `live-turn-snapshot.js`, `lib/wire/wire-broadcaster.js`, `lib/ws/workspace-operation-lease.js`, shutdown and lifecycle owners. New policy is bounded to remote-browser accepted turns. Preserve existing local-shell-only session lifetime unless it attaches to one of these already server-owned turns.

## Contract

At successful remote prompt admission, the server pins the immutable workspace ID, canonical root, thread/turn IDs, runtime generation and non-secret initiating principal identity. Acceptance/persistence and `message:sent` ordering remain unchanged. A server-owned execution lifetime must not borrow the lifetime of its originating WebSocket, current workspace selection or browser registration record. Separate execution ownership from output subscribers. A disconnected client is removed from recipients promptly, not retained as a fake open socket.

Do not weaken workspace epoch validation to keep a turn alive. Admission captures an execution context that can continue in its original scope after the originating session epoch retires; new commands still require a current authenticated workspace binding. Detached output uses the accepted execution context, never whichever global workspace is now active. Any required canonical-drain refactor preserves fences, ordering, streamSeq, terminalization and provenance association, and is reviewed here rather than hidden in networking work.

Browser reload, transport drop, self-logout, remote disable or credential revocation detaches observation and prevents new commands but does not undo an accepted turn. Active remote turns continue through shared workspace switch using the accepted original root; no output is delivered into the new workspace. On completion, persist exactly one terminal exchange and release detached runtime resources through existing manager/idle policy; do not leave a provider process immortal simply because its subscriber vanished. At full host quit or explicit authorized Stop, use existing stop/drain/partial persistence semantics. Host crash cannot promise continuity and must never replay the prompt automatically.

Reconnected authorized client uses passive thread open plus existing live-snapshot/history hydration to observe the same turn. It does not spawn or resume a second provider or take over the execution merely by viewing. Multiple authorized readers may subscribe without duplicate provider runs. A valid full-access client in the correct workspace can Stop that exact active thread through the normal route; duplicate Stop is idempotent. A second prompt to a busy session remains rejected by existing acceptance policy. Group deletion/move keep existing busy/lease rules. Terminal completion races with reconnect, Stop and revocation must leave one persisted result and no stale broadcast.

This explicitly supersedes the existing connection-close retirement rule only for server-owned remote accepted turns. Local shell viewing such a turn does not make its lifetime socket-owned. Ordinary shell-owned sessions retain current semantics. Record the exception in runtime wiki and accepted-report addendum during implementation. This does not authorize detached actions that were never accepted or new autonomous agent turns after completion.

## Slices

### 04A — Accepted turn survives disconnect

Introduce execution/subscriber separation at canonical admission and cleanup owners. Test via authenticated production browser WS: accept deterministic long-running prompt, close socket, allow provider output and terminal completion, then read saved exchange from another authorized connection. Ensure one provider launch, no send to closed/revoked recipient and no retained fake socket. Unaccepted prompt never starts after disconnect.

Check: `cd fusion-studio-server && npx jest --runInBand test/remote-access/turn-detach.integration.test.js test/ws/shell-auth-public-route.test.js test/thread/thread-runtime-controller.test.js test/thread/thread-runtime-automation.test.js`.

### 04B — Reconnect, workspace change, Stop and resource retirement

Exercise passive live-snapshot attachment, two readers, A-to-B workspace switch with A turn continuing, return to A, Stop from fresh authorized connection, revoked originator and full host shutdown. Inject late provider frames and terminal races, proving existing stream/frontier/drain invariants. Detached terminal resources are cleaned; inspect registry/session counts. Observe existing manager limits instead of inventing another scheduler. Test local-shell ordinary close remains unchanged and shell attachment to remote turn cannot kill it on close.

Check: `cd fusion-studio-server && npx jest --runInBand test/remote-access/turn-reconnect.integration.test.js test/remote-access/turn-workspace-switch.integration.test.js test/remote-access/turn-stop-shutdown.integration.test.js test/thread/thread-runtime-controller.test.js`; full server suite. Include existing session-manager, canonical-drain and workspace-lease tests discovered in BUNDLE-INDEX/runtime inventory, recording exact commands in report.

## Compatibility and final acceptance

No transcript copying or new offline DB. Existing DB remains authoritative and readback confirms one exchange. Prefer no schema change; any persistent execution metadata needed is additive via normal migration and never stores credentials. All required remote turn survival behaviors are proven without broadening passive open into activation or bypassing authority checks. Exact runtime-owner and shutdown changes are reported, not labeled a networking refactor. Regression surface: provider ownership, canonical drain, workspace leases, Stop, history, fan-out and process cleanup.
