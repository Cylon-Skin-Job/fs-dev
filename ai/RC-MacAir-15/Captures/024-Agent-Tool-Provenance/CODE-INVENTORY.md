# Agent Tool Provenance Code Inventory

## Accepted Predecessor Surface

The current worktree contains the owner-accepted 023 implementation as uncommitted files. The exact accepted product manifest is recorded in `../023-MVP-Provenance-Subscriptions/SPEC-04-IMPLEMENTATION-REPORT.md`; aggregate `15c18e67df1d9a69ef96fea6819ade662de23b1f41234c824eb2e92351237590` is the continuation baseline.

## Harness And Chat Flow

| Path | Current role | Required change |
|---|---|---|
| `fusion-studio-server/lib/harness/opencode/json-event-translator.js` | Maps OpenCode JSON parts into canonical tool lifecycle events; provider timestamp is placed in `timestamp`; result `files` is empty | Preserve reported-vs-host time and the exact bounded native tool name/call identity; keep generic result `files` extraction inert |
| `fusion-studio-server/lib/harness/opencode/index.js` | Spawns OpenCode with workspace cwd and streams translated canonical events | Preserve adapter identity on the canonical stream; no execution interception |
| `fusion-studio-server/lib/harness/types.js` | Documents canonical event shapes | Add explicit reported/observed timing and the exact OpenCode-only structured/shell extraction input contract |
| `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js` | Converts canonical events to applier payloads | Stop discarding timestamps/harness/native tool identity and complete parsed arguments; await application |
| `fusion-studio-server/lib/wire/canonical-chat-event-applier.js` | Owns Fusion turn ID, assistant parts, tool arg assembly/result application, and legacy `chat:*` events | Inject immutable turn authority/activity owner; resolve terminal-derived Settings enforcement once against the captured root before reservation; preserve later chat continuation |
| `fusion-studio-server/lib/wire/message-router.js` | Builds per-connection applier/bridge | Inject workspace and resolved harness identity/activity owner |
| `fusion-studio-server/lib/thread/thread-runtime-controller.js` | Drains foreground harness events but currently does not await application | Await canonical application and synthetic interrupted terminal handling |
| `fusion-studio-server/lib/thread/thread-runtime-automation.js` | Drains headless harness events through the same bridge | Inject identical activity owner/harness identity and await it |
| `fusion-studio-server/lib/thread/thread-crud.js` | Opens thread and has its persisted `harnessId` | Bind server-resolved harness ID to the session, not client assertion |
| `fusion-studio-server/lib/thread/HistoryFile.js` | Stores complete exchange `{parts}` JSON and returns integer `exchangeId` | Remains raw-detail source; insert the agent bind job in the same transaction; no duplicate raw arguments/results |
| `fusion-studio-server/lib/audit/audit-subscriber.js` | Persists exchange at turn end and emits `chat-turn:saved` | Supply immutable turn authority and schedule bounded bind-job drain after commit without timestamp rewrite |

## Existing Governed UEB Surface

| Path | Current role | Required change |
|---|---|---|
| `fusion-studio-server/lib/event-bus.js` | Legacy bus plus sealed private admitted-fact runtime | Extend the existing governed path only; no second bus |
| `fusion-studio-server/lib/event-registry/seed-catalog.js` | Locked v1 schema seeds | Add final tool/observation fact schemas in 01c, final `resource:changed@2` server authority in 01d before observer compilation, and query schemas in 01e; allow seed version argument without changing prior locked rows |
| `fusion-studio-server/lib/event-registry/subscription-seed-catalog.js` | Two locked subscriptions | Install the final two-fact agent ledger subscription in 01c and the final observer subscription only after its complete schema/capability surface exists in 01d; v2 rendering is durable scheduler work, not a third subscription |
| `fusion-studio-server/lib/event-registry/filter.js` | Currently accepts only `resource.mutated@1` | Generalize to the closed active event set while retaining exact validation and narrowing rules |
| `fusion-studio-server/lib/event-registry/capability-catalog.js` | Closed capabilities bound to exact handlers | Add exact agent ledger/observation/render capabilities; no ambient FS/DB/publish grant |
| `fusion-studio-server/lib/event-registry/schema-validator.js` | Registry-backed payload validation | Add only fact-specific semantic checks not expressible in JSON Schema |
| `fusion-studio-server/lib/subscriptions/admission.js` | Sealed static file-save publishers and one reservation verifier | Generalize the sealed static producer catalog and route verification/installers by exact producer/schema; add the private pre-dispatch durable admission commit only for the two new agent fact pairs, preserving existing file-save behavior |
| New `fusion-studio-server/lib/agent-provenance/fact-admission-reconciler.js` | Not present | Own ordered pending tool/observation fact replay with bounded startup/yield/retry/suppression/shutdown and wake-only durable-owner continuations |
| `fusion-studio-server/lib/subscriptions/generation-compiler.js` | Closed handler/grant contracts | Add exact required grants/output schemas; permit required acknowledgement only for listed locked system handlers |
| `fusion-studio-server/lib/subscriptions/handler-catalog.js` | Closed two-handler allowlist | Add exact built-in handler keys |
| `fusion-studio-server/lib/subscriptions/capability-factory.js` | Mints narrow lexical capabilities | Add fact-bound append/observe closures and the committed-job-bound renderer-projection closure with exact message/fact checks |
| `fusion-studio-server/lib/subscriptions/handlers/resource-render-projection.js` | `resource.mutated@1` to `resource:changed@1` | Keep unchanged; add the exact v2/fallback capability to the committed-job-bound renderer scheduler, not this v1 handler |
| `fusion-studio-server/lib/ledger/resource-provenance-repository.js` | Save-only provenance ledger/query | Keep v1 behavior stable; agent repositories remain separate and later unification is deferred |
| `fusion-studio-server/lib/startup.js` | Composes registry, controller, publishers, file owner, routes before sockets/watchers | Compose dependency-ordered final schemas/publishers/subscriptions and bounded admission/observation/ledger/renderer-projection/binder owners before public sockets and legacy observers |
| `fusion-studio-server/lib/shutdown.js` | Sequential shutdown with a 2,500-ms force timer | Implement the exact concurrent Phase-A owner drain, subscription stop, database close, and 8,000-ms outer force graph without post-close callbacks |
| `fusion-studio-server/lib/file-mutations/save-mutex.js` | Existing per-key bounded mediated-save queue: one active plus 32 waiters | Extend with save-priority, non-queuing observation try-acquire and one save-only handoff slot during active observation so the existing total 33-save admission invariant is preserved |

## Database And Resource Surface

| Path | Current role | Required change |
|---|---|---|
| `fusion-studio-server/lib/db/migrations/001_initial.js` | `exchanges` table with thread, sequence, timestamp, assistant JSON, metadata JSON | Do not rewrite; reference its integer exchange key |
| `fusion-studio-server/lib/db/migrations/006_harness_selector.js` | Adds `threads.harness_id` | Use persisted value as harness identity |
| `fusion-studio-server/lib/db/migrations/029_event_ledger.js` | Shared event log and resource edges | Append governed agent facts through scoped handlers |
| `fusion-studio-server/lib/db/migrations/034_event_registry_authority.js` | Locked/mutable schema and subscription authority | Seed/reconcile new locked rows through catalogs, not hand-edit DB |
| `fusion-studio-server/lib/db/migrations/035_file_provenance.js` | Resource registry, mediated save operations, preimage versions, provenance rows | Reuse resource registry; do not overload one-to-one save preimages as agent checkpoints |
| New migration `036_agent_tool_provenance.js` | Not present | Add normalized activity, candidate/edge, content-addressed blob, checkpoint, exchange-bind job, durable observation-job, renderer-projection job, and fact/ledger state tables/indexes |
| New `fusion-studio-server/lib/agent-provenance/exchange-binder.js` | Not present | Drain bind jobs in exact order with bounded database retry, yielded batches, exact-ID suppression until restart, and bounded shutdown |
| New `fusion-studio-server/lib/agent-provenance/renderer-projection-scheduler.js` | Not present | Drain successful dominant-edge projections from durable jobs with stable-ID at-least-once replay, admission gates, fallback, bounded retries, and shutdown ownership |
| New `fusion-studio-server/native/secure-file-observer/` | Not present | Add the bounded asynchronous Darwin Node-API descriptor-relative observer, native build definition/loader, and fail-closed unavailable branch |
| `fusion-studio-server/package.json` | Server scripts/dependencies | Add a deterministic native-observer build/test prerequisite and pinned build dependency; do not fetch/build at runtime |
| `fusion-studio-client/package.json` | Electron preparation and server `extraResources` filters | Build the observer before packaging and include `fusion-studio-server/native/**/*` in the packaged server resources |

## Renderer Surface

| Path | Current role | Required change |
|---|---|---|
| `fusion-studio-server/lib/ws/resource-projection-publisher.js` | Workspace/epoch-bound v1 resource projections over existing socket | Add exact v2 publisher on the same bind buffer/socket |
| `fusion-studio-server/lib/ws/client-message-router.js` | Routes versioned save/provenance/read protocols | Add typed agent activity query route; preserve current routes |
| `fusion-studio-client/src/lib/ws/resource-projection-protocol.ts` | Strict v1 changed/refresh validation | Add strict v2 observation projection validation |
| `fusion-studio-client/src/lib/ws/file-handlers.ts` | Routes v1 projection to central file-data store | Route v2 to the same canonical invalidation/refetch action |
| `fusion-studio-client/src/state/fileDataStore.ts` | Canonical File Viewer tree/content cache, dedupe, epochs, invalidation | Accept v2 identity without altering dirty Office/Email state |
| `fusion-studio-client/src/types/file-explorer.ts` | File/resource protocol types | Add v2 projection type only |

## Verification Surfaces

- Existing narrow tests under `fusion-studio-server/test/harness/opencode`, `test/wire`, `test/event-registry`, `test/subscriptions`, `test/ledger`, `test/ws`, and `test/runtime`.
- Existing client source-contract and live provenance tests under `fusion-studio-client/e2e/provenance`.
- Server full suite: `npm test` in `fusion-studio-server`.
- Client source suite and build: existing package commands/configuration used by accepted SPEC-04.
- New isolated proof must use a temporary `FUSION_APP_USER_DATA`, temporary workspace, dynamic port, disabled watchers/background effects, and deterministic adapter fixture.
- Native-observer verification must run against the direct server Node runtime and the actual packaged `electron/server-spawn.cjs` child-server path using its production-resolved system Node on supported macOS architecture; both must load the copied N-API artifact and pass descriptor-swap fixtures. An Electron run-as-Node surrogate is insufficient.

## Dirty Worktree Rule

All pre-existing modified/untracked paths belong to the user or accepted predecessor implementation. Builders may edit an overlapping path only when their assigned slice requires it, must preserve the accepted behavior, and must never reset, checkout, delete, or broadly rewrite unrelated changes.
