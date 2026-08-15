# Modular Database Subscribers Capture

## Context

This capture records the follow-on ideas from the Events and Ledger discussion. The working direction is not to make the Universal Ledger responsible for every event or database write. Instead, the Universal Event Bus becomes the shared event pipeline, and separate subscribers consume schema-defined event streams for their own purposes.

The database should be treated as storage behind subscriber capabilities, not as a permission model by itself.

## Core Model

```text
event producers / plugins
  -> UEB firehose
  -> subscription controller
      -> schema validation
      -> context enrichment
      -> filtering
      -> permission checks
      -> rate limits / retention policy
      -> subscriber dispatch
  -> subscribers
      -> ledger writer
      -> browser diagnostics ring buffer
      -> file versioning writer
      -> render sync notifier
      -> trigger matcher
      -> chat metadata writer
      -> custom app storage
```

The database should not be thought of as "the subscriber." Storage services should be subscribers. Each subscriber owns why it stores data, what schema it uses, how long it keeps rows, and what queries it exposes.

## Current Code Direction

The existing code already partially follows this shape:

- `event-ledger-subscriber` listens to the UEB firehose with `on('*')`, filters event types, and writes to `event_log`, `event_resource_edges`, and `event_tags`.
- `audit-subscriber` listens to chat events, aggregates exchange metadata, persists chat history, and emits follow-up events.
- `transcription/history-subscriber` listens to `transcription:completed`, writes history rows, and prunes them.
- `workspace-watcher` emits `file:changed` events into UEB so domains can subscribe without owning their own watcher.

The gap is that subscribers are currently narrow and hand-built. The new design should make subscriber creation a first-class extension point.

## Command State vs Subscriber State

Canonical app state should still be mutated by the owning service.

Example:

```text
workspace rename command
  -> workspace service updates canonical workspace tables
  -> workspace service emits workspace:renamed
  -> subscribers record history, diagnostics, render invalidations, or automation traces
```

Events describe what happened. Subscribers build history, projections, diagnostics, sync, automation, and render updates from those events.

Do not require every database write to flow through UEB. That would blur ownership and create loop risk.

## Subscriber Capabilities

A subscriber should declare its capabilities instead of receiving broad database access.

Subscriber declarations should include:

- event families consumed
- schema versions accepted
- durable or ephemeral storage behavior
- table namespace or database scope
- migrations required
- retention policy
- rate limits and backpressure rules
- whether it can emit follow-up events
- redaction and sanitization requirements
- query handlers exposed to the assistant or UI
- whether it can run code or only declarative transforms

The runtime question becomes:

```text
Is there an approved subscriber with permission to consume this event and write its own projection/history/cache?
```

Not:

```text
Can this event write to SQLite?
```

## Custom App Storage

This model should allow custom apps or views to use SQLite without hand-wiring the whole platform.

A custom app should be able to define:

- event schemas
- subscriber configs
- migrations
- query handlers
- optional UI panels

The platform should provide:

- UEB event delivery
- schema validation
- workspace/view/user context injection
- scoped SQLite access
- migration execution
- retention/rate enforcement
- error handling
- logs
- assistant query boundaries

Recommended default: use the same physical SQLite database, but require scoped table namespaces per plugin/subscriber unless there is a reason to split into a separate database.

## Governance Model

This should follow the trigger-file permission pattern.

The AI may propose a subscriber by writing a config file, but the GUI is the authority that enables it.

```text
AI writes proposed subscriber config
  -> app discovers config as proposed / disabled
  -> GUI shows requested events, tables, retention, emissions, queries, and risks
  -> user approves specific permissions
  -> GUI writes approved state
  -> runtime grants only effective approved permissions
```

Editing the config manually should not grant permissions.

Separate these states:

- requested permissions: what the config asks for
- approved permissions: what the user enabled through the GUI
- effective permissions: what runtime grants after policy checks

The GUI may rewrite the config to mark approvals, or it may write an approval store. Either way, runtime should trust GUI-approved state, not raw file claims.

## Subscriber Config Sketch

```yaml
id: browser-diagnostics
name: Browser Diagnostics
status: proposed

subscribes:
  - event: browser:console
    approved: false
  - event: browser:exception
    approved: false

storage:
  database: workspace
  namespace: browser_diagnostics
  tables:
    - name: browser_diagnostics_logs
      mode: append
      approved: false
  retention:
    ttl_minutes: 30
    approved: false

queries:
  - name: recent_browser_logs
    approved: false

emits:
  - event: diagnostics:promoted
    approved: false

permissions:
  read_dom_snapshot:
    requested: true
    approved: false
  track_mouse:
    requested: true
    approved: false
```

## Browser Diagnostics

Browser diagnostics should be a short-retention subscriber, not a permanent Universal Ledger feature.

Potential event families:

- `browser:console`
- `browser:exception`
- `browser:navigation`
- `browser:network_error`
- `browser:render_crash`
- `browser:interaction`
- `browser:dom_snapshot`

Recommended behavior:

- store logs in separate SQLite tables
- keep rows for about 30 minutes by default
- enforce row count and size caps
- allow selected diagnostics to be promoted or linked as evidence
- preserve correlation fields such as workspace, view, route, active document, UI action, chat turn, tool call, and timestamp

This supports agent troubleshooting without turning high-volume browser data into durable audit history.

## Agent-Readable UI Diagnostics

The system should support optional user-enabled diagnostics that let an assistant understand what the user is seeing.

Possible captures:

- console logs
- click traces
- mouse position when enabled
- focused element
- active view and document
- visible text
- button labels and IDs
- ARIA roles
- DOM path or component identity where available
- bounded DOM or accessibility-tree snapshots

Prefer an accessibility-tree-style snapshot before raw DOM because raw DOM is often too large and noisy. Raw DOM can remain a deeper diagnostic mode behind explicit approval.

## System Manager Data Explorer

Add a System Manager app/view for read-first database inspection and subscriber management.

Suggested shape:

```text
System Manager
  -> Data Explorer
      -> Tables
      -> Event Streams
      -> Subscribers
      -> Permissions
      -> Retention
      -> Queries
```

The Data Explorer should not begin as a generic SQLite editor. It should be a permission-aware, read-only explorer with controlled management actions.

Useful features:

- read-only table browsing
- schema inspection
- search, filter, and sort
- row detail drawer
- JSON payload viewer
- export/copy selected rows
- subscriber discovery
- permission approval toggles
- retention visibility
- query exposure controls

Subscriber management could show a proposed subscriber with checkboxes for requested permissions:

```text
Subscriber: browser-diagnostics
Status: Proposed

[ ] Subscribe to browser:console
[ ] Subscribe to browser:exception
[ ] Create table browser_diagnostics_logs
[ ] Keep rows for 30 minutes
[ ] Expose query recent_browser_logs to AI
[ ] Capture DOM snapshot on demand
[ ] Track clicks while diagnostics mode is on
```

When the user flips a switch, the GUI writes the approved permission state. Runtime only honors the effective approved permission state.

## Design Boundary

The Universal Ledger is one subscriber, not the whole event system.

The broader system is:

```text
schema-defined events + governed subscribers + scoped storage/query capabilities
```

That makes future features additive:

```text
new capability = producer/plugin + schema + subscriber + GUI-approved permissions
```

## Notes From Provenance Flow Review

The current provenance planning set already uses the same conceptual split this capture proposes:

```text
producers emit facts
subscribers filter, project, persist, compact, or notify
```

That means the modular database/subscriber model should not be introduced as a competing architecture. It should be implemented as the extension/governance layer around the planned provenance subscriber model.

Important source specs reviewed:

The [2026-07-15 provenance cross-article findings](../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat are part of this review authority. Decision-tagged findings remain unresolved; this capture must not be used to settle them implicitly.

- `00-provenance-spec-set-map.md`
- `01-provenance-implementation-master-plan.md`
- `32-resource-event-sync-controller.md`
- `33-universal-ledger-file-versioning.md`
- `34-ui-action-provenance-module.md`
- `35-universal-ledger-storage-edges-indexes.md`
- `36-harness-tool-native-ref-provenance.md`
- `37-automation-trigger-scheduler-provenance.md`
- `38-audit-query-review-provenance-loops.md`
- `39-change-storm-control-compaction.md`
- `40-provenance-schema-registry-validation.md`
- `provenance-flow.html`

## Implementation Hooks To Reserve

### 1. Subscriber Registry

Add a central subscriber registry rather than letting each storage feature subscribe directly to the raw event bus by hand.

The registry should know:

- subscriber ID
- subscriber owner/module path
- event families/topics consumed
- schema versions accepted
- active/proposed/disabled status
- approval state
- storage namespace
- retention policy
- query handlers exposed
- whether the subscriber consumes canonical-only accepted events, compatibility events, or local diagnostics

This registry should eventually be generated or validated against the same registry/update-gate discipline described in SPEC-40. Runtime activation should require `active`, not merely `planned` or `proposed`.

### 2. Canonical Delivery ABI

Do not design durable subscribers against only the current `on(type, event)` EventEmitter shape.

The provenance plan moves canonical delivery toward:

```ts
listener(frozenEvent, deliveryContext)
```

where `deliveryContext` contains an opaque `acceptedRef`, and the subscriber must prove delivery with `assertAcceptedDelivery(frozenEvent, acceptedRef)`.

Durable/canonical subscribers such as ledger, file versioning, audit records, and accepted automation/tool projections must use that accepted-delivery contract. They must not treat raw IDs, copied events, validation status, or database row IDs as proof.

### 3. Subscriber Capability Context

Subscriber handlers should receive a scoped capability object, not global app powers.

Possible runtime shape:

```ts
type SubscriberContext = {
  subscriberId: string;
  workspaceId?: string | null;
  deliveryKind: 'canonical' | 'compatibility' | 'diagnostic';
  acceptedRef?: AcceptedCanonicalRef;
  db: ScopedSubscriberDb;
  emit?: ScopedEventEmitter;
  query?: ScopedQueryRegistry;
  retention: RetentionController;
  diagnostics: SubscriberDiagnosticSink;
};
```

The context should expose only what the subscriber has GUI-approved permission to use.

### 4. Scoped Database And Migration Hooks

Custom app/subscriber storage should not get a raw app-wide SQLite handle by default.

Reserve hooks for:

- subscriber-scoped table namespace
- subscriber migrations
- migration approval state
- read-only query exposure
- retention cleanup jobs
- row/byte caps
- error and terminal/no-write diagnostics

The existing provenance plan is strict that storage failure must not delay or fail the source operation. Modular DB subscribers should follow the same rule.

### 5. Retention Hooks

Retention must be a first-class subscriber capability.

The provenance specs already reserve retention/compaction hooks for ledger/versioning/storm control. Browser diagnostics and custom app ring buffers should use the same conceptual pattern, but with ephemeral retention by default.

Examples:

- browser logs: default 30 minute TTL plus row/byte caps
- mouse/click traces: diagnostic mode only, short TTL
- custom app tables: explicit GUI-approved retention
- ledger/file versions: durable only through their own approved specs

### 6. Query Handler Registry

Assistant access should be through approved query handlers, not arbitrary SQL.

Query handlers should declare:

- name
- input schema
- output schema
- max rows/bytes
- redaction behavior
- whether results may include payloads or only compact summaries
- whether the handler is exposed to the assistant, GUI, or both

This lines up with SPEC-38, which expects compact evidence and explicit follow-up reads rather than dumping every payload, snapshot, diff, or tool output into context.

## Provenance Flow Constraints For Modular DB Work

### Canonical vs Noncanonical Streams

The modular subscriber system needs to separate stream classes:

```text
canonical accepted events
  -> require schema registry, accepted ref, frozen event, accepted delivery proof

compatibility events
  -> temporary migration support, named removal criteria

local diagnostics
  -> browser logs, validation warnings, UI traces, dev console ring buffers
```

Browser diagnostics should start as local diagnostics, not canonical ledger events. If a diagnostic needs to become durable evidence, a separate approved "promote diagnostic" path should create or link an accepted canonical record.

### No Source Operation Backpressure

The provenance specs repeatedly require that validation, ledger writes, file versioning, diagnostics, and subscribers do not block already-accepted source operations.

Subscriber execution should therefore be:

- asynchronous
- failure-isolated
- bounded
- nonblocking
- unable to hold command responses open
- unable to roll back completed file/UI/tool/automation operations

This is especially important for browser diagnostics and custom plugins, which may be noisy or buggy.

### Accepted Proof Discipline

The system must not let subscribers construct causal relationships from:

- raw event IDs
- copied payload IDs
- database row IDs
- validation status strings
- user-provided filter IDs
- provider-native IDs
- path/time proximity alone

Durable relationship fields and graph edges must come from accepted canonical refs, approved historical row refs, or explicitly approved correlation evidence. Weak correlation should remain `correlated`, `inferred`, or `unknown`.

### GUI Approval Must Gate Activation

The trigger-file permission pattern fits the provenance registry model, but it needs to distinguish:

- proposed config
- GUI-approved config
- active runtime registry entry
- effective runtime permissions

Editing YAML should never activate a subscriber, migration, table write, query exposure, event emission, DOM capture, or browser diagnostic mode by itself.

The GUI should be able to show why a subscriber is inactive:

- proposed but unapproved
- approved but schema invalid
- approved but migration pending
- approved but retention policy missing
- planned registry entry not active
- blocked by an owner decision such as `UEB-D01`, `LED-D04`, `ULV-D04`, or `AUD-D01`

## Hooks Needed In The Existing Provenance Plan

### Event Subscription Controller

The current specs name multiple subscribers but do not yet describe a user-facing subscriber/plugin registry. Add a controller layer that sits between UEB delivery and configurable subscribers.

It should handle:

- subscriber lookup
- schema/version compatibility
- approval/effective permission checks
- canonical vs diagnostic stream separation
- delivery to bounded executors
- retention scheduling
- diagnostics
- lifecycle enable/disable/reload

This controller should not replace SPEC-40 validation. It should consume validation/admission results.

### Subscriber Config Loader

Add a loader for proposed subscriber configs, probably near the trigger config pattern.

It should:

- parse declarative config
- validate requested permissions
- never treat `approved: true` in the raw file as sufficient by itself
- compare file requests against GUI approval state
- produce an effective runtime config
- surface pending permission requests in System Manager

### System Manager Data Explorer

The Data Explorer should become the GUI surface for this system.

It should include:

- read-only table inspection
- schema inspection
- subscriber list
- proposed subscriber review
- permission toggles
- migration status
- retention status
- query handler exposure
- recent diagnostics
- row/byte cap visibility

Avoid making this a generic SQLite editor in the first pass.

### Browser Diagnostics Subscriber

Add a dedicated diagnostic subscriber family rather than mixing browser logs into the ledger.

Potential hooks:

- Electron renderer console capture
- renderer exception capture
- navigation/network failure capture
- optional click/mouse/focus tracing
- optional accessibility-tree or bounded DOM snapshot
- short-retention SQLite tables
- assistant query handler for recent diagnostics
- GUI toggle for user-enabled tracing

The assistant should query this through approved diagnostic query handlers, not by reading arbitrary browser tables.

### Promotion Path

If a short-lived diagnostic item becomes important evidence, do not mutate it into a ledger event.

Instead:

```text
diagnostic row
  -> user/assistant requests promotion
  -> approved promotion producer emits canonical audit/evidence event
  -> ledger subscriber stores accepted event
  -> edge/native-ref links back to diagnostic source when policy allows
```

This preserves the boundary between ephemeral observability and durable audit.

## Decisions To Carry Forward

These are not blockers for the capture, but they should be decided before implementation.

1. **Where approval truth lives**
   Decide whether GUI approval is stored by rewriting YAML, storing approvals in SQLite, or both. Runtime should trust the effective GUI approval state, not raw file text.

2. **Subscriber namespace model**
   Decide whether custom subscribers get table prefixes in the shared workspace DB, separate attached SQLite databases, or a hybrid.

3. **Declarative vs code subscribers**
   Decide whether first custom subscribers may run arbitrary JS, or whether initial support is declarative transforms plus approved query handlers only. Safer recommendation: start declarative and expand later.

4. **Diagnostic stream schema**
   Browser diagnostics need schemas too, but they do not need to be canonical ledger schemas at first. Define a local diagnostic schema with TTL, caps, redaction, and query limits.

5. **Promotion semantics**
   Decide what event family owns promoted diagnostics: audit, diagnostics, browser, or a future observability family.

6. **Data Explorer scope**
   Decide whether Data Explorer can run read-only SQL, or only table/query-handler browsing. Safer recommendation: table/query-handler browsing first, read-only SQL later behind explicit permission.

7. **Plugin migration policy**
   Decide whether proposed subscriber migrations are previewed as SQL diffs before approval and whether destructive migrations are ever allowed.

8. **Permission request propagation**
   Match the trigger-file pattern: a subscriber that attempts a denied capability should surface a permission request to the GUI, not silently gain access.

9. **Retention and cap defaults**
   Browser diagnostics can default to 30 minutes, but custom subscribers should not inherit durable retention without explicit approval.

10. **Assistant query boundaries**
    Decide how assistant tools enumerate approved query handlers and how query results cite subscriber/table/source provenance without exposing raw unrestricted SQL.

## Implementation Warning

Do not implement modular subscriber plugins as a shortcut around the provenance sequence.

The safe order is:

1. Preserve the provenance plan's schema registry/admission boundary.
2. Add subscriber registry/governance as an extension of that boundary.
3. Start with noncanonical browser diagnostics and read-only Data Explorer surfaces.
4. Add custom subscriber storage only with GUI-approved permissions and scoped database access.
5. Let durable ledger, versioning, audit, tool, and automation subscribers follow their existing SPEC decision gates.

This keeps the modular database idea aligned with the provenance flow instead of creating a second event/storage authority.

## Notes From View Builder + Config-Driven Architecture Discussion

Following the modular DB/subscriber discussion, the conversation expanded into how far the declarative model can go — through to the view layer and the repo-as-app-package concept.

### Views As HTML/CSS Pairs With Config, No Per-View JS

Instead of each view being a React component, views become HTML + CSS pairs with a JSON config file declaring:

- what triggers (buttons, links, data attributes) exist
- what data sources they fetch (server API or in-memory array)
- what template to render results into
- what filters/sorts apply

One generic JavaScript runtime (never changes per feature) handles event delegation, fetching, template rendering, and DOM swapping. The view author writes only HTML, CSS, and config.

### View Builder Workspace

Users compose or customize views through a "View Builder" workspace — the same mechanism the built-in views (Wiki, File Viewer, Capture, Office, Email) use. There is no fork between "built-in" and "custom." A built-in view just ships pre-installed in the workspace; a user customizes it through the exact same config/template system.

New app types (video editor, invoice manager, kanban) are built by composing the same library of display components (file tree, card grid, calendar, filter bar, search) and wiring them via config.

### The ai/ Folder Becomes A Shareable App Package

The existing `ai/` folder convention — originally designed for prompts, agents, and workspace config — now also holds view definitions:

```
repo/
├── ai/
│   ├── Views/
│   │   ├── invoice-manager/     ← HTML + CSS + config.json
│   │   ├── kanban-board/        ← same structure
│   │   └── video-timeline/
│   ├── Agents/                  ← original intent
│   ├── Prompts/
│   └── manifest.json            ← declares views, agents, data schemas
```

Pull the repo, Fusion Studio registers the views, they appear as installable apps. Same pipe — views are now cargo.

### Data Layer: Config-Driven Auto-Provisioning

New tables = config entries. When the server sees a schema config referencing a table that does not exist, it auto-provisions SQLite storage in the repo:

```
schema.json mentions "invoices" → server creates invoices table → UEB consumer wired in config → all data flows through provenance/tagging/event bus
```

Config on one side of the pipe, config on the other. No manual database provisioning, no SQL scripts, no migrations to hand-write. The AI assists by editing the config.

### UEB Consumer + Config = Full Data Flow For Free

Any custom app that declares a UEB consumer in config gets:

- canonical event delivery through SPEC-40 validation
- accepted-ref provenance
- tagging and metadata
- renderer invalidation
- subscriber governance (GUI-approved permissions)
- retention/compaction

The database never needs to be provisioned directly. The config declares what events to consume, what schema to store them in, and what queries to expose. The runtime handles the rest.

### AI Composition Layer

The user does not write config by hand. The AI reads the Wiki (which documents the component library, config format, and schema conventions), then the user says:

- "Move this, move that, put this here"
- "I want that to show me X, Y, and Z"
- "Add a filter by client name"
- "Show a running total at the bottom"

The AI edits the config, places components, wires data sources, and provisions storage. No code written by the user.

### Iframe View Panel Already Exists

The iframe single-page, no-browser-address-bar view panel is already built — it is the shell that hosts custom views. The View Builder workspace populates it. New apps are just new configs loaded into the existing iframe.

### Architecture Summary

```
repo/ai/ manifest.json
  │
  ├── declares views (HTML + CSS + config)
  ├── declares data schemas (auto-provisioned SQLite)
  ├── declares UEB consumers (event → storage pipeline)
  └── declares query handlers (what the AI/GUI can ask)
        │
        ▼
  server interprets config
  │
  ├── provisions tables on demand
  ├── wires UEB consumers
  ├── registers views in View Builder
  └── exposes approved query handlers
        │
        ▼
  user opens iframe panel → view is live, wired, provenance-aware
```

No backend code. No frontend code. Config interpreted by a system that already exists.
