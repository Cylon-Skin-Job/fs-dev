from pathlib import Path
import re,json,hashlib,datetime,difflib
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
W=Path('ai/RC-MacAir-15/Wiki/010-Events_And_Ledger')
S='fusion-studio-server/'
pages={}
def add(rel,src,body): pages[W/rel/'PAGE.md']=(src,body.strip()+'\n')
status='Status: source inspected on 2026-09-19 in the development checkout. This page describes the implemented bounded contracts and separates future direction below. Existing tests were inspected as assertions, not rerun; no live runtime or installed Alpha verification is claimed.'
add('001-Universal_Event_Bus',['lib/event-bus.js','lib/startup.js','lib/event-registry/index.js','lib/event-registry/reconcile.js','lib/event-registry/policy.js','lib/event-registry/filter.js','lib/event-registry/subscription-seed-catalog.js','lib/subscriptions/admission.js','lib/subscriptions/generation-compiler.js','lib/subscriptions/controller.js','lib/subscriptions/capability-factory.js'],f'''
{status}

Use this page before adding an event producer, subscriber or cross-system event path. Commands enter the owning controller; facts describe command acceptance, completed work or observations. The bus is not a request/response command router.

## Current startup and authority

`fusion-studio-server/lib/startup.js` initializes the System database and migrations, then `initializeEventRegistry` reconstructs effective authority before subscribers, watchers and public sockets start. Migration `034_event_registry_authority.js` owns schema, subscription and grant tables. `reconcileSystemSchemas` inserts missing locked shipped definitions and their initial grants, preserves existing rows and lifecycle reductions, and diagnoses collisions. It does not repair a modified locked definition by silently overwriting it or restore a removed grant. Invalid rows become ineffective in derived state; infrastructure initialization failure remains startup-fatal.

`event-registry/policy.js` checks canonical JSON/checksum, locked identity, enabled state, schema references, installed handler and requested-versus-granted capabilities. Requests do not grant themselves authority. The public initialized registry exposes read/validate access, not a human permission UI. Folder discovery cannot install or activate a handler. Platform migrations own schema evolution; the [System boundary](../../002-Server_And_Runtime/PAGE.md#system-database-boundary) excludes arbitrary plugin tables and self-grants.

The subscription compiler selects the four built-in handler keys, validates exact required capability scopes and provider availability, then orders descriptors by priority and ordinal subscription ID. Filters allow exact event type/version and closed resource predicates for operation, kind and ingress panel; they are not arbitrary executable expressions. `file.command_accepted@1` is registered and publishable but is not an allowed subscription filter or a seeded ledger input.

## Current governed admission

`subscriptions/admission.js` seals one lexical publisher catalog and injects exact closures into the durable save and agent owners. It does not expose a public producer selector. The catalog is:

| Producer | Fact |
|---|---|
| `system.file-save-controller` | `file.command_accepted@1`, `resource.mutated@1` |
| `system.agent-tool-activity-controller` | `agent.tool_completed@1` |
| `system.agent-resource-observer` | `resource.state_observed@1` |

Each publisher accepts a private reservation plus a body. The reservation authority rereads durable producer state; admission binds producer/schema/workspace/operation/event/time and verifies the canonical input hash, validates the active schema, then deep-freezes the fact. Caller-supplied envelope fields in the body are rejected. Rejection returns `admitted: false`, null event ID and no deliveries. Replaying identical reserved input can redeliver the same event; admission is not a universal deduplication service.

Save reservations come from `file_operations`. Agent reservations come from `agent_tool_activities` or `agent_resource_snapshots`; only those two publishers commit their producer admission state before dispatch. This asymmetry is intentional current behavior. Durable source state, rather than an older proposed accepted-reference graph, supplies the authority.

## Current delivery and failure timing

| Handler | Seeded input | Policy and bounded responsibility |
|---|---|---|
| `system.provenance-ledger` | `resource.mutated@1` | `required_ack`; append the exact save projection through a same-fact capability |
| `system.agent-provenance-ledger` | Both agent facts | `required_ack`; invoke the durable ledger owner |
| `system.agent-resource-observer` | `agent.tool_completed@1` | `required_ack`; validate/signal the durable observation queue, not perform detached filesystem observation in the callback |
| `system.resource-render-projection` | `resource.mutated@1` | `best_effort`; publish File Viewer invalidation or freshness recovery |

`controller.js` snapshots one generation per delivery, calls matching handlers in order and awaits each required acknowledgment for up to 2,000 ms. Best-effort promises are observed for rejection but not awaited. A required timeout does not cancel its handler; the controller retains it for drain, and application shutdown supplies the outer deadline. This is not the older proposal in which every listener runs in an independent nonwaiting executor.

The publisher awaits reservation lookup, payload validation and delivery. `admitted: true` means admission succeeded even if delivery throws, times out, is absent or a later projection fails. Delivery `completed` means the callback resolved; inspect the owning durable state to learn whether ledger work stored, conflicted or was rescheduled. `invoked` is not persistence or client acknowledgment. Scoped capability contexts expose only the permitted same-fact append, scheduling, renderer message and fixed diagnostic operations; handlers receive no ambient database or bus authority.

Reload atomically installs a valid generation. If compilation fails, only unchanged, independently revalidated prior descriptors survive; an authority-read failure clears the visible generation. In-flight work retains its selected generation. Reload is explicit/startup-driven, not a filesystem settings watcher.

A save awaits command-fact publication before preparing its required preimage. Rejected command-fact admission can remain pending without denying the save, but failed operation reservation, durable preimage preparation or attempted-write recording prevents replacement. After replacement, admission/projection recovery must not reinterpret the completed write as an untouched target. Agent observations follow reported tool activity and do not authorize or reverse execution. See [Ledger Event Provenance](../003-Provenance_Model/004-Ledger_Event_Provenance_Schema/PAGE.md) for persistence and reconciliation.

## Legacy compatibility remains separate

`lib/event-bus.js` still exports `emit`, `on` and the EventEmitter singleton. `emit` delivers type listeners then wildcard listeners under synchronous depth/same-event guards, with best-effort error handling. Its depth counter is process-local synchronous state, not a generalized async causal chain. Governed delivery never calls public `emit/on`; emitting a governed-looking topic cannot create admitted delivery.

Chat, watchers and existing triggers still use legacy paths. The wildcard legacy ledger subscriber records only `workspace:switched`, `thread:state_changed` and `file:changed`; it cannot make every bus topic durable. Chat's adapter-normalized event naming does not imply admission into these four governed facts. Chat lifecycle remains owned by [Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md).

## Approved direction and open work

Use one governed fact architecture, separate commands from facts, keep permission requests distinct from grants, and preserve honest timestamped observations without requiring causal verdicts. The accepted trusted save/subscription scope replaced older accepted-reference/lease/causal-proof prerequisites only for that bounded implementation. The accepted agent overlay adds normalized activity, eligible observation checkpoints and exactly two ledger facts; it does not activate the wider draft.

General plugin emission/executors, canonical chat/tool/native-output schemas, causal graphs, canonical version events and broad automation remain future work. Older exact candidate/ref/lease APIs and executor capacities are proposals, not current APIs or mandated implementations. Resolve their material choices when a feature needs them; do not reopen the settled System boundary.

## Related Pages

- [Decisions](../000-Events_And_Ledger/002-Decisions/PAGE.md)
- [Taxonomy](../002-Event_Taxonomy/PAGE.md)
- [Universal Event Bus Standards](../../005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md)
''')
add('002-Event_Taxonomy',['lib/event-bus.js','lib/event-registry/seed-catalog.js','lib/event-registry/filter.js','lib/event-registry/schemas/file-command-accepted-v1.json','lib/event-registry/schemas/resource-mutated-v1.json','lib/event-registry/schemas/agent-tool-completed-v1.json','lib/event-registry/schemas/resource-state-observed-v1.json'],f'''
{status}

Use this page before naming or classifying events. A name's punctuation does not establish authority. Legacy topics, registered commands/queries, governed facts and renderer projections are different contracts.

## Current registered vocabulary

`fusion-studio-server/lib/event-registry/seed-catalog.js` defines the shipped schema catalog. The event schemas use top-level `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `workspaceId` and `operationId`; they do not implement the older universal `eventFamily`/`ids`/`provenance` envelope.

| Kind | Name/version | Meaning and current consumer |
|---|---|---|
| Command | `file_save@1` | Validated mediated UTF-8 save; a request, not a mutation fact |
| Fact | `file.command_accepted@1` | Durable save acceptance; contains `commandId`, `origin`, `resource`, `intent`; no seeded subscriber or ledger row for this fact |
| Fact | `resource.mutated@1` | Successful mediated save, `create` or `modify`; adds `commandAcceptedEventId`, `mutation`, `fileVersionId`; save ledger and renderer subscribers |
| Fact | `agent.tool_completed@1` | Terminal activity, including schema statuses `completed`, `error`, `blocked`, `interrupted`; `origin`, `thread`, `tool`, `timing`, `resources`, `candidatesTruncated`; ledger and observation scheduling |
| Fact | `resource.state_observed@1` | First/changed eligible `bytes` or `absent` checkpoint; `source`, `resource`, `observation`; agent ledger, with renderer work owned by durable projection jobs |
| Projection | `resource:changed@1` | File Viewer invalidation after a mediated create/modify |
| Projection | `resource:changed@2` | Agent observation invalidation with `first_observation`, `changed` or `unchanged`; does not assert a tool caused a mutation |
| Projection | `resource:refresh_required@1` | Non-fact freshness recovery; no canonical mutation claim |
| Query | `resource:provenance@1`, `agent:activity@1`, `file_tree@1`, `file_content@1` | Typed protocol contracts; registration alone says nothing about a mounted audit UI |

An unchanged observation may issue v2 invalidation without creating another observation fact/checkpoint. Tool status is a terminal activity classification, not a promise of successful execution or a synonym for the event name. Save-to-missing is create; separate create/move/rename/delete commands and arbitrary external writes have not become governed save facts.

## Legacy topics

Public `emit/on` uses colon topics such as `chat:*`, `workspace:switched`, `thread:state_changed` and `file:changed`, with `{{type, timestamp, ...data}}` rather than the governed envelope. The legacy ledger whitelist includes only the latter three exact names. Legacy watcher and trigger activity is not admission, causal proof or comprehensive provenance. See [Universal Event Bus](../001-Universal_Event_Bus/PAGE.md).

## Direction and proposals

Product domains include UI actions, chat/harness activity, automation, resource mutations, render synchronization and external observations. This is a useful conceptual taxonomy, not a list of registered governed families. General `ui.action`, `chat.tool.*`, `file.version` and audit/automation envelopes remain outside the implemented catalog. Do not add fields or register an event merely because a conceptual category exists. Approved intent favors distinct timestamped facts and unknown attribution where necessary; exact wider schemas and permission grammar require their own decisions.
''')
add('003-Provenance_Model',['lib/subscriptions/admission.js','lib/file-mutations/fact-reservation-bindings.js','lib/file-mutations/reported-ui-context.js','lib/agent-provenance/fact-authority-repository.js','lib/agent-provenance/agent-ledger-repository.js','lib/ledger/event-ledger.js'],f'''
{status}

Provenance records what Fusion knew, when it knew it and the identity of the responsible operation or observation. Observation and causation are separate. A path mentioned by a tool, a later file hash, a watcher callback or an admitted event identity does not alone prove who changed the file.

## Current carriers and identities

| Carrier | Identity and meaning | Limit |
|---|---|---|
| Save command/mutation | Server-reserved operation, command, acceptance-event, resource-event, resource and preimage-version IDs; `resource.path` is canonical workspace-relative identity while `resource.access` is ingress panel/path | `commandAcceptedEventId` references the reserved acceptance identity; it is not an older accepted-reference capability and need not prove delivery or a ledger row |
| Save origin | `origin.kind = local_client`, server `connectionId`, `assurance = transport_only`, optional `reportedUiContext` | Reported view/tab/component context is historical context, not authenticated human identity, permission, a general UI action record or ownership of live view state |
| Tool activity | `operationId` is the host activity ID; `thread` carries thread/turn, `tool` carries provider tool-call ID/name/status and optional argument/result fingerprints; reported and observed times are separate | Fingerprints do not publish raw output or prove execution changed a path; the activity is normalized separately from detailed Chat exchange content |
| File observation | `operationId` is the observation ID; `source` links activity/edge/thread/turn/tool/harness; checkpoint and previous checkpoint IDs describe a path-scoped observed history | First observation is not a pre-tool image. Prior observed state need not immediately precede the tool's write; `absent` has no live resource ID |
| Legacy ledger | Compatibility fields, inferred actor/source, correlation/causation values copied when present | `file:changed` defaults to actor `user`; this is heuristic attribution, not an authenticated user or accepted cause |

The four governed facts share only their actual registered top-level identity fields and domain-specific bodies. No universal common envelope, confidence enum, accepted-reference delivery ABI or generalized causal graph is implemented. Consult the exact [Taxonomy](../002-Event_Taxonomy/PAGE.md) and [Ledger Event Provenance](004-Ledger_Event_Provenance_Schema/PAGE.md) before adding fields.

## Failure boundaries

Operational authentication/authorization, command shape, workspace/path safety and required save recovery protection can gate work. The mediated save requires a durable operation and exact eligible preimage before replacement. A storage or preimage failure there must prevent replacement; a blanket rule that versioning is always optional would violate the supported guarantee.

Optional reported UI context is sanitized and omitted when malformed, stale or oversized without rejecting otherwise valid work. After a filesystem replacement, failed admission or projection cannot make it un-happen; pending/conflict states and freshness recovery describe that failure. Tool provenance observes reported execution and cannot rewrite an executed result as failed. Admission and required acknowledgments are actually awaited at their owning boundaries; they are not guaranteed zero-latency side effects.

## Approved direction

Use timestamped facts with shared host identities where available, preserve unknown attribution and keep source evidence separate from causal conclusions. Record save/session grain rather than keystrokes. Historical copies support auditing/recovery while [System ownership](../../002-Server_And_Runtime/PAGE.md#system-database-boundary) keeps connected applications and workspace content authoritative outside the System database. Restoration remains a separately permitted operation against that source.

The trusted save/subscription agreement replaced older accepted-reference and broad versioning blockers only within that bounded scope. The agent extension separately covers normalized observational activity/fingerprints, sparse eligible checkpoints and two admitted ledger projections. The save-context extension reuses the existing carrier. None approves every older chat/tool/native-reference, automation, UI-action or graph design.

## Open design

A composable common envelope and durable causal graph remain design directions, not executable schemas. Exact relationship meaning/proof, canonical tool/native-output handling, broad version events, automation run generation and audit schemas need feature-specific decisions. Older candidate/ref/lease APIs, redaction branches and executor capacities must not be presented as current or automatically required. Preserve meaningful distinctions between producer, reported origin, observer and evidence without manufacturing a confidence verdict or inserting unregistered fields.

## Children

- [Chat Metadata Provenance Schema](001-Chat_Metadata_Provenance_Schema/PAGE.md)
- [Tool Call Provenance Schema](002-Tool_Call_Provenance_Schema/PAGE.md)
- [Resource Mutation Provenance Schema](003-Resource_Mutation_Provenance_Schema/PAGE.md)
- [Ledger Event Provenance Schema](004-Ledger_Event_Provenance_Schema/PAGE.md)
- [File Version Provenance Schema](005-File_Version_Provenance_Schema/PAGE.md)
- [Automation Run Provenance Schema](006-Automation_Run_Provenance_Schema/PAGE.md)
- [UI Action And Context Provenance Schema](007-UI_Action_And_Context_Provenance_Schema/PAGE.md)
- [UI Action Provenance Module](../011-UI_Action_Provenance_Module/PAGE.md)
- [Audit Query And Review Provenance Schema](008-Audit_Query_And_Review_Provenance_Schema/PAGE.md)
''')
add('003-Provenance_Model/004-Ledger_Event_Provenance_Schema',['lib/ledger/event-ledger.js','lib/ledger/event-ledger-subscriber.js','lib/ledger/resource-provenance-repository.js','lib/agent-provenance/agent-ledger-repository.js','lib/agent-provenance/agent-ledger-reconciler.js','lib/agent-provenance/fact-admission-reconciler.js','lib/file-mutations/fact-replay.js','lib/file-mutations/reconciliation.js','lib/db/migrations/029_event_ledger.js'],f'''
{status}

Use this page before changing ledger ingress, payload projection, identity or reconciliation. The implemented sinks use `event_log` and resource edges; they do not implement the older generalized `ledger_events` schema or accepted-reference graph.

## Current durable sinks

| Ingress | Producer truth and transaction | Stored attribution |
|---|---|---|
| Legacy wildcard subscriber | `event-ledger-subscriber.js` selects three whitelisted topics; `recordEvent` writes event, resource edges and tags in one transaction | Actor/source may be inferred; selected content keys are redacted and strings truncated to 4,000 characters; this is not the exact governed payload branch |
| Governed `resource.mutated@1` | `resource-provenance-repository.js` checks the succeeded `file_operations` row and exact body, then writes `event_log`, one subject resource edge, `resource_provenance_events` and operation projection state transactionally | `local_client` with connection ID, operation correlation, null causation; canonical fact JSON and its projection hash, including optional reported context |
| Governed `agent.tool_completed@1` | Agent ledger repository requires matching already-admitted activity fact JSON/hash; claimed projection writes event, path-bearing resource edges and source ledger state atomically | `agent_harness`, harness ID, activity correlation, null causation; roles `agent_read`, `agent_write`, `agent_execute`, `agent_unknown` |
| Governed `resource.state_observed@1` | Same owner verifies the admitted snapshot fact; transaction writes event, one observed-file edge and source ledger state | `agent_harness`, source harness, source activity correlation, null causation; `observed` role, live resource ID only for bytes |

`file.command_accepted@1` has a durable operation reservation and admission state but no seeded ledger subscription. Governed resource/agent projections do not create tags or generic event-to-event causal edges. An `event_resource_edges` row connects an event to a resource/path and role; it is not a `caused_by` verdict. The public event ID is the `event_log` primary key; private integer resource-edge keys are a different identity.

## Admission is not storage success

The private publisher verifies a reservation, validates and freezes the fact, then awaits delivery. Only the two agent publishers persist admitted state before dispatch. Save replay updates its admission marker after the returned report. A subscriber failure cannot revoke the admitted fact; `admitted: true` can coexist with pending, conflict or failed persistence. A resolved required-ack handler can return a rescheduled/conflict state, so `completed` alone is not proof of a stored row.

Exact save replays compare operation identity and payload hash, return duplicate, and can repair a pending marker; conflicting event identity records conflict without replacing established ledger truth. Agent replays compare exact projected event and ordered edges; `created_at` stays owned by first insertion and is excluded from replay comparison. The durable producer row is the retry marker, not a generic replay table or historical accepted capability.

## Current retry and restart boundaries

Save ledger append uses a five-attempt SQLite contention cycle. `fact-replay.js` preserves pending admission/projection and requests `resource:refresh_required` when publication or render delivery is unavailable. Startup `reconciliation.js` handles reserved/prepared/succeeded operations, replays eligible pending facts and cleans temporary files. An interrupted attempted replacement remains `outcome_unknown` even if later observed bytes match the intended postimage; this does not invent a success fact. The save recovery scan is separate from the agent scheduler budgets and does not claim a universal bounded background executor.

Agent admission has a deterministic 100-source/one-second startup cap, yielded continuation and one delayed retry for retryable transition failures; repeated exhaustion or nonretryable failure suppresses that exact key until restart. Agent ledger work is claimed and charged durably before each cycle: at most three cycles of five immediate SQLite attempts, a 30-second claim lease, +250 ms then +1,000 ms scheduling after the first two contention failures, then terminal `failed`. Semantic mismatch is `conflict`. Transition errors use one delayed retry then exact-key suppression; expired claims consume the charged cycle rather than repeating it. These are inspected implementation bounds, not promised eventual delivery or general plugin queue policy.

Legacy write failures only warn in the subscriber; there is no durable per-event retry marker on that path. Its shutdown drain is bounded, but the public emitter does not await ledger writes. No live persistence success was exercised for this page.

## Approved direction and open schema work

System retains history for audit and recovery by default; exact cleanup/retention remains future policy. The accepted save scope settled its own snapshot/hash/idempotency and persistence contract. The agent overlay separately authorized only its two exact facts into the existing event and resource-edge tables. Neither blanket-blocks these implemented projections on older design decisions nor approves all general ledger work.

General causal edges, ledger-internal events, common-envelope storage, historical proof capabilities, native-reference projections and cross-domain retention/redaction contracts remain open. Broader integrity serialization and migration choices must be decided for that feature; current canonical JSON/hash helpers do not silently approve the whole older design. Historical snapshots are not live editable app data or a universal restore interface.

See [Ledger Schema](../../004-Ledger_Schema/PAGE.md) for table ownership and [Provenance Model](../PAGE.md) for evidence limits.
''')
add('004-Ledger_Schema',['lib/db/migrations/029_event_ledger.js','lib/db/migrations/034_event_registry_authority.js','lib/db/migrations/035_file_provenance.js','lib/db/migrations/036_agent_tool_provenance.js','lib/db/migrations/040_reported_ui_context.js','lib/ledger/resource-provenance-repository.js','lib/agent-provenance/agent-ledger-repository.js'],f'''
{status}

The following tables belong to `fusion.db`, the [System database](../../002-Server_And_Runtime/PAGE.md#system-database-boundary). They are platform-owned control, history and recovery stores. A plugin cannot create arbitrary System tables or turn these records into its own application database. This is a bounded provenance inventory, not an audit of every application table.

## Current table owners

Migration paths below are under `fusion-studio-server/lib/db/migrations/`; runtime owners are under `fusion-studio-server/lib/`.

| Tables | Migration | Runtime owner and purpose |
|---|---|---|
| `event_log`, `event_resource_edges`, `event_tags` | `029_event_ledger.js` | `ledger/event-ledger.js` for legacy whitelist; `ledger/resource-provenance-repository.js` and `agent-provenance/agent-ledger-repository.js` for exact governed projections; governed writers do not add tags |
| `event_schema_registry`, `event_subscription_registry`, `event_subscription_grants` | `034_event_registry_authority.js` | `event-registry/reconcile.js`, `repository.js`, `policy.js`; mutable lifecycle/grant authority distinct from authored requests, with locked shipped definitions |
| `resource_registry` | `035_file_provenance.js` | `file-mutations/stable-resource-repository.js`; workspace/path/fingerprint identity and lifecycle, reused by agent observation |
| `file_operations` | `035_file_provenance.js` | `file-mutations/file-operation-repository.js`; request binding, reserved IDs, prewrite/replacement state, admission/projection markers and terminal response/recovery |
| `file_versions` | `035_file_provenance.js` | `file-mutations/file-version-repository.js` through operation preparation; exact eligible preimage bytes or absent state, not general canonical version events |
| `resource_provenance_events` | `035_file_provenance.js` | `ledger/resource-provenance-repository.js`; compact save query projection joined to the preimage row |
| `agent_tool_activities`, `agent_tool_resource_edges` | `036_agent_tool_provenance.js` | `agent-provenance/activity-repository.js`; bounded normalized activity, resource candidates, clocks, optional fingerprints and binding/observation state |
| `agent_snapshot_blobs`, `agent_resource_snapshots` | `036_agent_tool_provenance.js` | `agent-provenance/checkpoint-repository.js`; exact content-addressed eligible bytes and sparse path-scoped observation checkpoints/fact authority |
| `agent_exchange_bind_jobs`, `agent_observation_jobs`, `agent_renderer_projection_jobs` | `036_agent_tool_provenance.js` | Corresponding repositories and binder/observer/projection scheduler; durable work, claim and settlement state |
| Additional reported context columns on `file_operations` and `resource_provenance_events` | `040_reported_ui_context.js` | Save context sanitization/projection; historical view/tab/component/presenter/target metadata, not live view state |

`event_log.event_id` is the public event primary key. Its other columns include type, workspace/machine, actor, occurrence/creation times, summary, payload JSON, source, correlation and causation. Indexes cover type/workspace/machine with occurrence time and correlation. Resource edges have private integer row IDs, resource/path/role fields and event/resource/workspace-path indexes; tags are unique per event/tag. These resource edges already exist, but they are not a general event-to-event graph.

Save operation IDs and reserved event/version IDs have uniqueness constraints; operation state and projection state remain separate. Save query projections index workspace/time, path, filename and folder. Agent tables add their own activity, thread/turn, exchange, path/access, observation and due/lease indexes. Read the migration and owning repository before extending a query; a desired future index is not an existing column.

## Payload and failure semantics

Legacy `recordEvent` sanitizes selected keys and truncates long strings. Governed save and agent projections store their canonical fact JSON, verified against the corresponding producer-owned durable record. Save projection hashes live in `resource_provenance_events`; agent fact hashes and admission/ledger schedules live on activity/snapshot rows. There is no common `canonical_admission_status` or older three-branch `validation_status` scheme on every event row.

Admission, filesystem outcome, subscriber acknowledgment, ledger storage and renderer delivery are separate states. Required save preimages precede replacement; failed later projection does not undo a write. Existing snapshot tables do not supply universal restoration or retention. See [Ledger Event Provenance](../003-Provenance_Model/004-Ledger_Event_Provenance_Schema/PAGE.md) for exact ingress and retry limits.

## Target and open work

The older generalized `ledger_events` design, common-envelope graph, accepted ledger-row proof capability, universal redaction branches and broad indexes are proposals, not current storage contracts. The accepted save/subscription and agent-observation agreements supersede their older blockers only for those bounded tables and facts. Retention, causal edges, ledger-internal events, wider versioning and restore require separate feature decisions. System's preservation direction and source/application ownership are already settled and do not require reopening.
''')
add('010-Structure',['lib/event-bus.js','lib/startup.js','lib/event-registry/index.js','lib/event-registry/seed-catalog.js','lib/subscriptions/admission.js','lib/subscriptions/controller.js','lib/ledger/event-ledger-subscriber.js','lib/ledger/resource-provenance-repository.js','lib/agent-provenance/fact-authority-repository.js','lib/file-mutations/save-controller.js'],f'''
{status}

This map identifies current owners; it is not a claim that every planned provenance subsystem is implemented. Server paths below begin at `fusion-studio-server/`; client paths begin at `fusion-studio-client/`.

## Current server

| Owner | Responsibility |
|---|---|
| `lib/db.js`, `lib/startup.js` | System DB/migrations, registry initialization, host composition and startup reconciliation before public traffic |
| `lib/event-registry/index.js`, `reconcile.js`, `repository.js`, `policy.js` | Database-backed effective schema/subscription/grant authority; no project-file discovery |
| `lib/event-registry/seed-catalog.js`, `subscription-seed-catalog.js`, `schemas/*.json` | Shipped locked schema and handler contracts; command/query/projection definitions are not all facts |
| `lib/subscriptions/admission.js`, `file-provenance-bootstrap.js` | Four sealed publisher identities and durable reservation verification |
| `lib/subscriptions/generation-compiler.js`, `handler-catalog.js`, `capability-factory.js`, `controller.js` | Closed handlers, exact grants/filter compilation, reload generations, delivery and acknowledgments |
| `lib/event-bus.js` | Separate legacy EventEmitter compatibility API and synchronous chain guards |
| `lib/ledger/event-ledger-subscriber.js`, `event-ledger.js` | Legacy whitelist, heuristic/sanitized event projection and shutdown drain |
| `lib/ws/file-save-route.js`, `lib/file-mutations/save-owner.js`, `save-controller.js` | Public save validation and the required operation/preimage/atomic replacement contract |
| `lib/file-mutations/durable-reservations.js`, `fact-replay.js`, `reconciliation.js` | Save authority, pending fact replay, restart outcome/cleanup handling |
| `lib/ledger/resource-provenance-repository.js`, `provenance-ledger-handler.js` | Same-fact save ledger transaction and compact provenance queries |
| `lib/agent-provenance/activity-owner.js`, `activity-repository.js`, `fact-authority-repository.js`, `fact-admission-reconciler.js` | Normalized agent activity, producer fact state and admission reconciliation |
| `lib/agent-provenance/resource-observer.js`, `checkpoint-repository.js`, `observation-job-repository.js` | Bounded post-tool observation/checkpoints and durable jobs; uses `native/secure-file-observer/index.js` |
| `lib/agent-provenance/agent-ledger-repository.js`, `agent-ledger-reconciler.js` | Two admitted agent fact projections with producer-owned durable retry state |
| `lib/agent-provenance/renderer-projection-authority.js`, `renderer-projection-scheduler.js` | Durable observation invalidation work, distinct from save projection callback |
| `lib/subscriptions/handlers/resource-render-projection.js`, `lib/ws/resource-projection-publisher.js` | Save invalidation and workspace-bound projection transport |
| `lib/ws/resource-provenance-route.js`, `agent-activity-route.js`, `lib/agent-provenance/query-repository.js` | Typed bounded query transports/repositories; no mounted audit UI follows from these modules |
| `lib/watch/workspace-watcher.js`, `lib/chat-metadata/collectors/file-mutations.js` | Legacy filesystem observations and Chat metadata collection; not new governed facts |

## Current client integration

| Owner | Responsibility |
|---|---|
| `src/state/fileDataStore.ts` | Mediated save caller and central File Viewer invalidation/refetch state |
| `src/lib/save-action-context.ts` | Optional reported context captured from registered live view/component state |
| `src/lib/ws/file-handlers.ts` | Save/query/read response and resource projection handling |
| `src/components/views/FileViewer.tsx` | Mounted File Viewer consumer of central file state |

Detailed save/freshness and tool/query contracts are in their topic articles. Chat persistence and identity remain owned by [Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md); naming a source here does not replace that authority.

## Planned areas

General UI action adapters, canonical automation/audit records, causal graph traversal, canonical file-version events, arbitrary plugin producers and universal restore/retention remain future or open. The implemented save context, sparse checkpoint stores and query helpers are narrower counterparts. Locate the current owner and [settled decisions](../000-Events_And_Ledger/002-Decisions/PAGE.md) before planning an extension; do not infer a production module from an older exact API proposal.
''')
std=Path('ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md')
pages[std]=(['lib/event-bus.js','lib/startup.js','lib/subscriptions/admission.js','lib/subscriptions/controller.js','lib/subscriptions/generation-compiler.js','lib/subscriptions/capability-factory.js','lib/file-mutations/save-controller.js','lib/wire/canonical-chat-event-applier.js','lib/wire/wire-broadcaster.js','lib/audit/audit-subscriber.js'],f'''
Status: event/provenance rules reconciled against approved direction and source inspected on 2026-09-19. This page distinguishes the implemented trusted built-in path from broader design proposals. It does not certify unrelated Chat behavior or a fresh product test/runtime pass.

Use this page before emitting, subscribing to or bypassing universal event bus events.

## Commands and facts

User requests enter existing WebSocket handlers/controllers or authorized scheduled commands. Facts describe acceptance, success, failure or observation after the described transition has occurred. A command-accepted fact can precede mutation; a mutation fact cannot. The event bus is not a request/response command router. Subscribers needing new work use an authorized owning command rather than bypassing its validation.

Payloads use product vocabulary, relevant entity/workspace identity and the smallest non-sensitive context. Do not emit raw provider protocol or secrets. Adapter-normalized Chat events and governed provenance facts are different boundaries; the word canonical in an older module name does not establish governed admission.

## Current governed contract

The host seals four publisher identities in `subscriptions/admission.js`: the save owner's `file.command_accepted@1` and `resource.mutated@1`, and the agent owners' `agent.tool_completed@1` and `resource.state_observed@1`. Each verifies a durable reservation and complete canonical input hash, validates the active database-backed schema, and freezes the fact before private delivery. Public legacy `emit/on` cannot grant admitted status. There is no public arbitrary producer catalog or plugin publisher factory.

The current facts use top-level event/workspace/operation/time fields plus closed domain bodies. Do not require the older proposed common `eventFamily`/`ids`/`provenance` envelope or accepted-reference listener ABI. Exact command/query/projection names and versions are listed in [Event Taxonomy](../../../010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md).

Database definitions and permission requests are separate from grants. The compiler requires an installed allowlisted handler and its exact capabilities; runtime contexts expose same-fact append, scheduling, bounded renderer messages and fixed diagnostics, not ambient DB/bus access. Configuration may narrow or revoke authority but cannot grant, restore or expand it. A future human Systems authorization surface is not implied by a test-only authorization fixture. Plugins remain subject to the [System boundary](../../../002-Server_And_Runtime/PAGE.md#system-database-boundary).

## Failure timing and required protection

Do not impose a universal rule that source commands never await provenance. Current admission awaits durable reservation verification, schema validation and subscriber dispatch. The controller invokes handlers in deterministic order; `required_ack` waits up to 2,000 ms per handler, while best-effort promises are observed without awaiting. Timeout is not cancellation. Current trusted handlers do not use the older proposed independent listener executor or accepted-ref leases.

`admitted: true` is not proof of delivery, persistence or renderer receipt. A required callback's completion can still represent rescheduled/conflicting work; consult producer-owned durable state. Subscriber failure cannot retroactively revoke admission or undo completed source work. Preserve the implemented bounded retry/reconciliation rules described in [Ledger Event Provenance](../../../010-Events_And_Ledger/003-Provenance_Model/004-Ledger_Event_Provenance_Schema/PAGE.md), rather than inferring unbounded retry or forbidding all retry.

The mediated save requires a durable operation and eligible exact preimage before replacement. Required prewrite storage/protection failure prevents mutation. Optional reported UI context is different: malformed/stale/oversized context is omitted without denying a valid save. Postwrite publication or projection failure records pending/conflict/recovery state without claiming that the completed write did not happen. Agent observation follows reported tool execution and cannot rewrite its result or create a pre-tool image after the fact.

Use the registered `resource:changed` projections and `resource:refresh_required` recovery through the workspace-bound WebSocket and central File Viewer state. A successful server send is not client acknowledgment. Preserve the owning freshness/dirty-buffer contract; do not turn recovery into a canonical mutation fact or promise general view coverage.

## Legacy and scoped supersessions

Legacy `emit/on` remains available for existing Chat, watcher and trigger paths. It uses colon topics and synchronous chain guards. The legacy ledger records only `workspace:switched`, `thread:state_changed` and `file:changed`; neither those events nor every `chat:*` emission pass the private governed admission path. Preserve Chat exchange persistence ownership and route new claims through [Chat System](../../../007-Chat_System/000-Overview_and_References/PAGE.md).

The accepted trusted save/subscription implementation supersedes older accepted-reference, causal-proof and broad versioning prerequisites only for that bounded scope. The separately accepted agent overlay covers normalized activity/fingerprints, sparse eligible checkpoints and its two exact ledger facts. It does not register broad `chat.tool.*` or native-output events, causal edges, canonical version events, ledger-internal events or arbitrary plugin executors. The save-context carrier does not implement general `ui.action`.

Older exact candidate/ref/lease APIs, historical proof capabilities and executor capacities remain proposals outside those agreements. Broader causal, plugin, automation, redaction, versioning and retention/restore contracts require feature-specific decisions. Apply settled System and observation principles without treating the whole old draft as approved or reopening already settled bounded behavior.

## Required review questions

- Is this a command, an accepted-command fact, a mutation fact, an observation or a projection, and who owns the transition?
- Does the real producer have a host-minted publisher and durable reservation, or is this still legacy compatibility?
- Are schema/filter/grant/handler checks and the exact scoped capability preserved?
- Are required prewrite protection, optional context, admission, acknowledgment, durable storage and client freshness distinguished?
- Do retries, duplicates, conflicts, timeouts and restart/shutdown follow the owning bounded implementation?
- Could a raw topic, copied ID, reported UI context or observed hash be mistaken for permission, authentication or causal proof?
- Are provider details and sensitive content kept within their approved disclosure boundary?

## Related Pages

- [Code Standards](../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md)
- [Universal Event Bus](../../../010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md)
- [Chat Universal Event Bus](../../../007-Chat_System/002-Harness_And_Event_Flow/003-Universal_Event_Bus/PAGE.md)
'''.strip()+'\n')
manifest={'slice':'S02','at':datetime.datetime.now().astimezone().isoformat(),'pages':[],'deviations':[]}
sha=lambda b:hashlib.sha256(b).hexdigest()
diffs=[]
for p,(sources,body) in pages.items():
 old=p.read_bytes(); text=old.decode(); front=text.split('---',2)[1]
 front=re.sub(r'  source-files:[\s\S]*?(?=  connected-skills:)', '  source-files:\n'+''.join('    - '+S+x+'\n' for x in sources),front)
 blocks=re.findall(r'<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->',text)
 new=('---'+front+'---\n\n'+body).encode()
 if blocks:
  new+= ('\n'+'\n\n'.join(blocks)+'\n').encode()
 p.parent.joinpath('.versions').mkdir(exist_ok=True)
 stamp=datetime.datetime.now().astimezone().strftime('%Y-%m-%d-%H%M%S'); snap=p.parent/'.versions'/f'{stamp}.md'
 with snap.open('xb') as f:f.write(old)
 assert sha(p.read_bytes())==sha(old),f'concurrent edit: {p}'
 p.write_bytes(new)
 manifest['pages'].append({'path':str(p),'snapshot':str(snap),'before_sha256':sha(old),'snapshot_sha256':sha(snap.read_bytes()),'after_sha256':sha(new)})
 diffs.extend(difflib.unified_diff(text.splitlines(True),new.decode().splitlines(True),fromfile=str(snap),tofile=str(p)))
(C/'S02-CHANGE-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
(C/'S02-PAGES.diff').write_text(''.join(diffs))
print('Wrote',len(pages),'pages with exclusive exact pre-edit snapshots')
