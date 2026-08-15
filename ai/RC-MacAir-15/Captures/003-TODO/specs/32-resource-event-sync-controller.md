# SPEC-32 — Resource Event Sync Controller

> **SUPERSEDED SNAPSHOT — DO NOT IMPLEMENT.** The current planning authority is [SPEC-32 in `008-Provenance-Temp`](../../008-Provenance-Temp/32-resource-event-sync-controller.md), its [spec-set map](../../008-Provenance-Temp/00-provenance-spec-set-map.md), and linked wiki authorities. This notice was reinforced by the [2026-07-15 provenance cross-article findings](../../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat to correct misleading guidance.

**Origin:** User architecture discussion, 2026-07-09 — wiki render latency, stale live file updates, UEB firehose reuse, and view-local WebSocket/data-loading cleanup.
**Status:** DISCUSSION DRAFT. Do not implement until this spec is reviewed and approved.
**Related specs:** [SPEC-33 — Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md), [SPEC-34 — UI Action Provenance Module](34-ui-action-provenance-module.md)
**Related wiki:** [Events And Ledger](../../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md), [Resource Events And Render Sync](../../../Wiki/010-Events_And_Ledger/005-Resource_Events_And_Render_Sync/PAGE.md), [Events Provenance Model](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md), [Resource Mutation Provenance Schema](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md)
**Blast radius:** High. Touches server event routing, watcher lifecycle, WebSocket protocol, client resource cache, and multiple built-in views.
**Execution model:** Spec-first. Build the event contract and audit map before behavior changes. Implement in small vertical slices with smoke checks after each migrated view.

---

## Mission

Make Fusion Studio resource updates flow through one canonical event pipeline:

```text
event producers
  - chokidar workspace watcher
  - Fusion server file APIs
  - harness/provider events
  - scripts, scheduler, sync/import, and agent jobs
  - workspace/view/theme lifecycle
        |
        v
UEB canonical enriched events
        |
        +-- TRIGGERS.md subscriber family       automation, tickets, agents
        +-- resource sync subscriber            React/cache invalidation
        +-- ledger subscriber                   durable event audit
        +-- metadata subscriber                 chat/file mutation metadata
        +-- future subscribers                  no new watcher required
```

The goal is not to manually patch DOM nodes. The goal is to update the correct state/cache slices so React can reconcile stable DOM without tearing down whole views.

This fixes two linked problems:

- Views such as `wiki-viewer` can be slow after refresh/workspace switch because they rebuild whole private trees.
- External file changes can reach the server's UEB but not the renderer cache path, leaving rendered views stale.

Future SQLite file versioning and forensic provenance are intentionally partitioned into SPEC-33. This spec should preserve event identity and provenance hooks, but should not implement snapshot storage, diff storage, or assistant file-history query workflows unless the owner explicitly folds that work back into this build.

## Non-Negotiable Rules

- **Do not duplicate chokidar.** Use the existing watch core and UEB.
- **UEB is the firehose.** Subscriber filters decide relevance; event producers must not discard facts before subscribers can filter.
- **React sync is system behavior, not TRIGGERS.md behavior.** TRIGGERS and resource sync share UEB, but UI consistency must not depend on automation config.
- **Preserve rich event metadata.** Sibling files/folders, parent names, stats, line counts, and token counts belong in the canonical event envelope unless explicitly omitted with a reason.
- **All mutation paths emit canonical UEB events.** Direct WebSocket broadcasts are derived subscriber output, not separate source-of-truth paths.
- **Views read state/cache.** Built-in views must not own private WebSocket request/listen/update loops for file resources after they migrate.
- **Stable UI state survives refreshes.** Changing one file must not clear a whole view tree, selected document, active tab, scroll, or navigation history unless the resource itself disappeared.
- **Workspace switch must be explicit.** Watcher and resource subscriptions must follow the active workspace model without stale watchers bound to an old root.

---

## Current Findings

### Existing Central Pieces

| Area | Current owner | Notes |
|---|---|---|
| WebSocket connection | `fusion-studio-client/src/lib/ws-client.ts` | Single actual browser WebSocket connection. |
| File response cache | `fusion-studio-client/src/state/fileDataStore.ts` | Central cache for tree/content responses and invalidation. |
| Client file message routing | `fusion-studio-client/src/lib/ws/file-handlers.ts` | Populates `fileDataStore`; handles current `file_changed`. |
| Chokidar manager | `fusion-studio-server/lib/watch/core.js` | One watcher instance per watched path, multiple subscribers. |
| Workspace watcher | `fusion-studio-server/lib/watch/workspace-watcher.js` | Emits `file:changed` on UEB. |
| Event bus | `fusion-studio-server/lib/event-bus.js` | Server pub/sub firehose. |
| Trigger loader | `fusion-studio-server/lib/triggers/trigger-loader.js` | Registers UEB listeners for chat/ticket/agent/system triggers; file-change triggers compile into watcher filters. |
| Ledger subscriber | `fusion-studio-server/lib/ledger/event-ledger-subscriber.js` | Already records selected UEB events. |
| File mutation metadata | `fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js` | Subscribes to both `file:changed` and legacy `file_changed`. |

### Divergent or Ad Hoc Paths

| Area | Current behavior | Migration target |
|---|---|---|
| `WikiExplorer` | Private WS listener; recursively requests every folder; clears root/content before reload. | Resource-backed tree/content store with incremental invalidation. |
| `usePanelData` | Generic per-view WS hook; views parse/update their own stores. | Thin wrapper over central resource cache or removed. |
| `useFileTree`, `FolderNode`, `FileExplorer` | Older file-viewer request/listener path remains alongside `fileDataStore`. | Central cache only. |
| `AgentTiles` | Direct WS listeners for detail/workflow discovery. | Resource-backed tree/content reads. |
| `TicketBoard` | `usePanelData` around `content/tickets.json`. | Resource-backed index/content reads. |
| Office/Email | Mostly use `fileDataStore`, but some manual `handleContentResponse` paths remain. | No direct cache writes from components except explicit save/edit flows. |
| Server file move/rename/delete | Directly broadcasts `file_changed` in `workspace-request-handlers.js`. | Emit canonical UEB events; resource broadcaster fans out to clients. |
| Server `file-explorer.js` save/create | Emits legacy `file_changed`. | Emit canonical UEB events with origin and resource context. |
| Project watcher lifecycle | Starts for `getProjectRoot()` during startup pipeline. | Verify/rework so active workspace switches close/repoint watcher subscriptions. |

### Hardcoded Rules / Drift Risks

These are the current places where views can continue acting independently unless the new controller deliberately absorbs or normalizes the behavior.

| Area | Examples | Risk | Target |
|---|---|---|---|
| View root resolution | `lib/views/index.js`, `lib/views/panel-paths.js`, `lib/view-folders.js` hardcode built-in panel IDs, operational folders, archive folders, and pseudo-panels. | New or migrated views may resolve roots differently depending on which API path they use. | Move root/content/archive/pseudo-resource policy into one registry consumed by all request handlers. |
| Mutation routing | `workspace-request-handlers.js` has `OFFICE_PANEL`, `mutationPanels`, and direct `file_changed` broadcasting. `file-explorer.js` defaults missing panels to `file-viewer`. | File mutations can bypass canonical enrichment, origin capture, and consistent client invalidation. | All mutation commands emit canonical resource events routed on `resource:*` topics through one producer path. |
| Virtual resources | `file-explorer.js` serves `__workspace__`, `__panels__`, view metadata, style files, and special `agents-viewer/settings/agents.json` behavior. | Virtual/config resources may not invalidate like normal files, or may need different watcher semantics. | Treat virtual resources as first-class resource kinds with explicit registry policy. |
| Workspace startup jobs | `startup.js`, ticket sync, agent sync, dispatch, and prompt builders hardcode `issues-viewer` and `agents-viewer` operational roots. | Automation can update files outside the UI's resource cache assumptions. | Automation writes must emit or be mapped to canonical resource events. |
| Wiki conventions | `wiki-tree.js`, `WikiExplorer.tsx`, and `wikiStore.ts` hardcode `wiki-viewer`, `PAGE.md`, numeric heading/folder conventions, and recursive discovery depth. | Wiki can remain a private cache/listener island while other views migrate. | Encode wiki root, index, page, warm, and invalidation rules in resource sync policy. |
| Client component routing | `ContentArea.tsx` maps built-in panel IDs to React components. | Acceptable view routing can be confused with resource policy and grow more hardcoded behavior. | Keep component routing thin; move data/cache/watch rules out of components. |
| Client resource stores | `fileStore`, `fileDataStore`, `activeResourceStore`, `viewStates`, wiki store, Office/Email/Capture selected-path state, and agent/ticket local state overlap. | Active/open/cached resources can disagree across views. | Create one resource registry/store for active, open, cached, and dependent resources. |
| View-specific WebSocket listeners | Wiki, agents, file tree, ticket board, and older hooks listen for their own response/change messages. | A view can miss events handled elsewhere or refresh too broadly. | One client resource message handler updates central cache; views subscribe to cache selectors. |
| Theme/style lists | `connection-init.js`, `workspace-broadcaster.js`, client style hooks, and panel constants list specific CSS files and panel style files. | Theme updates may invalidate only some clients or miss new per-view styles. | Model theme/style files as resources with policy-driven affected views. |
| Archive/home modes | Capture, Office, and Email each carry local archive/home behavior. | Moving a document into archive may update one view's tree but not related indexes/tabs. | Archive/home is declared per view in resource policy and invalidates declared trees/indexes. |
| Chat/reference labels | Chat file-link helpers map panel-specific labels such as wiki/ticket. | Metadata and UI labels can drift from resource registry naming. | Derive labels/kinds from panel/resource metadata where possible. |

---

## Review Issues

These issues came from the independent spec review pass, were resolved by the decisions below, and should stay closed before implementation starts.

| ID | Issue | Why it matters | Resolution target |
|---|---|---|---|
| RSC-I01 | `source`, `origin`, and `observedBy` were not clearly separated. | A UI save handled by the server could be misread as UI-produced, server-produced, or watcher-observed depending on which path handled it. | RESOLVED BY RSC-D01: use the Events Provenance Model vocabulary: `provenance.source`, `provenance.origin`, `provenance.observedBy`, `actor`, `context`, and `provenance.cause`. |
| RSC-I02 | Non-resource events are named but not typed. | `workspace.switched`, `view.registry_changed`, and `theme.changed` were listed as canonical event identities, but only the resource-sync projection was defined. | RESOLVED BY RSC-D02: add minimal lifecycle contracts for workspace switch, view registry change, and theme change events handled by the same subscriber pipeline. |
| RSC-I03 | `file:changed` and `file_changed` compatibility were not explicitly separated. | UEB aliases and WebSocket legacy messages can be confused or double-handled. | RESOLVED BY RSC-D03: audit current usage, then replace both with canonical resource events routed on `resource:*` UEB topics and `resource:invalidate` renderer invalidation. |
| RSC-I04 | Delete and rename enrichment lacked before/after semantics. | `stats`, `parent`, and `siblings` are ambiguous for deleted resources and cross-folder renames. | RESOLVED BY RSC-D04: resource events carry required `before`/`after` snapshots or explicit unavailable blocks, with event-specific rules for create/modify/delete/rename/metadata. |
| RSC-I05 | `viewRefs` was mandatory before inclusion policy was decided. | Mapper output can vary depending on hidden/disabled/active view rules. | RESOLVED BY RSC-D05: `viewRefs` includes active workspace enabled views. |
| RSC-I06 | Resource sync policy was conceptual but required. | Early slices cannot implement a contract if the minimum required fields are undefined. | RESOLVED BY RSC-D06: Slice 32b/32c policy fields are root, tree key, content key, patterns, refresh mapping, and warm rules; richer fields remain future-compatible. |
| RSC-I07 | Folder rename invalidation was underspecified. | "Clear/rewrite cached descendants" could mean eager rewrite, clearing only known cached descendants, or lazy prefix invalidation. | RESOLVED BY RSC-D07: use lazy prefix invalidation of known cached descendants, with refetch on demand. |
| RSC-I08 | Wiki preservation language was not testable. | Earlier "where possible" language did not define behavior when the active page is deleted, renamed, moved, or loses its parent. | RESOLVED BY RSC-D08: use the deterministic Wiki fallback order defined in the Wiki Migration Target section. |
| RSC-I09 | Trigger watcher behavior during workspace switch was underspecified. | If TRIGGERS file-change filters remain watcher-bound, workspace switching can still drop facts before UEB subscribers can filter. | RESOLVED BY RSC-D09: TRIGGERS.md file-change triggers subscribe to canonical UEB resource events in this build. No new watcher-bound trigger filters should be added. Existing temporary watcher filters may remain only until Slice 32d and must be removed or recompiled behind the UEB/resource policy before Slice 32d is complete. |
| RSC-I10 | Slice probes and smoke tests did not define pass/fail artifacts. | High-blast-radius changes need auditable evidence before moving between slices. | RESOLVED BY RSC-D10: every slice records tests run, manual event-flow evidence when runtime paths are involved, temporary adapters left in place, and removal criteria. |

---

## Owner Decision Queue

These rows record owner decisions and remaining implementation choices. Rows marked `DECIDED` are part of this spec's contract; unresolved rows must be closed before the slice that depends on them begins.

| ID | Decision needed | Decision / Contract | Options / notes |
|---|---|---|---|
| RSC-D01 | What exactly does `source` mean versus `origin`? | DECIDED: Use the Events Provenance Model vocabulary. | `provenance.source` is the canonical event producer; `provenance.origin` is the initiating actor/context when known; `provenance.observedBy` is the detecting subsystem; `context` holds view/panel/active-resource details. |
| RSC-D02 | Do canonical non-resource events need full typed contracts now? | DECIDED: Add minimal typed contracts for render/resource sync correctness. | The renderer/resource-sync lifecycle projection only needs enough detail to invalidate or preserve cache/state correctly. Persisted ledger records still follow the shared event envelope, original event family/type, edge, index, hashing, and redaction requirements. Do not build a broad lifecycle framework yet. |
| RSC-D03 | What are the exact legacy names and migration window? | DECIDED: No long-lived legacy migration layer. Audit all existing file-change paths and convert them thoroughly to canonical resource events routed on `resource:*` UEB topics and `resource:invalidate` renderer messages. | Slice 32a must verify whether `file:changed` / `file_changed` exist in durable storage. If durable records exist, document migration/compatibility before removing legacy adapters. Temporary legacy adapters may span migration slices, but every current consumer of legacy invalidation must be covered by central `resource:invalidate` before the legacy adapter is removed. |
| RSC-D04 | Should event enrichment carry `before`/`after` blocks? | DECIDED: Yes, resource events carry required `before`/`after` blocks. | Needed for deletes, renames, cross-folder moves, resource sync, and future versioning. If a state cannot be captured, the block uses `ResourceStateUnavailable` with an explicit reason instead of being omitted or set to null. Snapshot/blob persistence remains SPEC-33. |
| RSC-D05 | Which views belong in `viewRefs`? | DECIDED: matching active-workspace enabled views. | `viewRefs` includes only enabled views whose central resource policy maps the event to affected cache keys; enabled but unrelated views are excluded. Enabled views are active workspace view-registry entries accepted by the central resource policy module's canonical `isViewEnabled(workspaceId, viewId)` decision. For Slice 32b/32c, that predicate must read the same registry/workspace-state fields on server and client; hidden, mounted, open, visible, or cached state affects warm behavior, not whether a resource can be mapped to a view. Renderer `viewRefs` and `resource:invalidate` messages are delivered only to clients whose active workspace matches `event.ids.workspaceId`. In this build, null-workspace events are only `workspace.switched` transitions to no active workspace, and they follow the workspace-switch delivery rule, not global broadcast. Ledger, trigger, automation, and versioning subscribers still consume all canonical events they are authorized to see. |
| RSC-D06 | What is the minimum resource policy contract for slice 32b/32c? | DECIDED: root, tree key, content key, patterns, refresh mapping, and warm rules. | Start with `file-viewer` and `wiki-viewer`; expand once the contract works for those. |
| RSC-D07 | How should subtree invalidation work? | DECIDED: lazy prefix invalidation of known cached descendants, with refetch on demand. | Eager rewrite is more complex; clearing all descendants is simpler but can lose state if overused. |
| RSC-D08 | What should happen when the active Wiki page is deleted, renamed, or moved? | DECIDED: preserve selection for rename/move when the resulting page still exists; otherwise select nearest valid fallback. | Fallback order: renamed/moved path, nearest existing parent page, previous valid history entry, wiki root, then empty-state if no wiki root exists. |
| RSC-D09 | Are TRIGGERS.md file-change triggers moved behind UEB in this build? | DECIDED: Yes. | File-change triggers consume canonical UEB resource events from the same resource-event pipeline used by render subscribers. Temporary watcher-bound trigger filters may exist only inside a migration slice, with explicit workspace recompilation and removal criteria before that slice is complete. |
| RSC-D10 | What proof is required after each migration slice? | DECIDED: automated tests where practical plus manual event-flow logs for runtime paths. | Each slice records tests run, manual log captures or screenshots when relevant, temporary adapters left in place, and removal criteria. Slice 32a can use a companion audit report because it is discovery-only. |
| RSC-D11 | Are token counts synchronous or size-limited? | DECIDED: synchronous only for text-like resources up to 512 KiB. | Larger text resources set `before.omissions.tokenCount` / `after.omissions.tokenCount = 'too_expensive'` when a `ResourceStatePresent` block exists; binary/unsupported resources use `not_supported`; redacted resources use `redacted`. Whole-state failures use `ResourceStateUnavailable.omissionReason`. This spec does not define deferred-stat follow-up events. |
| RSC-D12 | What is the source of truth for active UI context? | DECIDED: renderer command-time context from existing active panel/tab/doc stores. | UI-origin mutations capture active context before sending the command. Server-side inference is only fallback for non-UI paths. |
| RSC-D12a | Which exact UI store selectors feed command-time context? | BLOCKER before any slice emits UI-origin mutations for a view. | The relevant migration slice must name exact store selectors/fields for Wiki, Office, Email, Capture, and File viewer before wiring that view's UI-origin mutations. Required outputs are `viewId`, `panelId`, `route`, `activeTabId`, `activeDocumentPath`, `activeResourcePath`, and `selectedResourceId` where applicable. |
| RSC-D13 | How do multi-client events identify initiator versus receivers? | DECIDED: include `connectionId`/`clientId` in `context`, and clients compare against their own connection. | User identity is out of scope for this build. UI action events may carry `receiverConnectionIds` only for command acknowledgement/routing, not as cache invalidation truth. |
| RSC-D14 | Should `fileDataStore` become `resourceStore`, or should `resourceStore` wrap it? | DECIDED: first implementation adds a `resourceStore` facade/wrapper over existing `fileDataStore`. | Avoid a broad rename during event migration. Migrated views and `resource:invalidate` handlers use the `resourceStore` API boundary; internals can still delegate to `fileDataStore` until a later cleanup. |
| RSC-D15 | Is future SQLite file versioning folded into this build or kept in SPEC-33? | DECIDED: keep implementation in SPEC-33; SPEC-32 only preserves event identity, provenance, and before/after resource-state metadata hooks. | Owner can still decide to fold it back in later, but that is an explicit scope expansion. |

---

## Confirmed Assumptions

All listed assumptions are confirmed contract points.

| ID | Status | Assumption | Why it was assumed |
|---|---|---|---|
| RSC-A01 | CONFIRMED | UEB remains the canonical firehose for enriched events. | This matches the existing pub/sub model and avoids a second resource-event bus. |
| RSC-A02 | CONFIRMED | The existing chokidar watch core remains the only persistent filesystem watcher. | The user explicitly wanted to avoid duplicating existing watcher infrastructure; Slice 32a verifies exact watcher ownership/lifecycle without reopening the no-duplication rule. |
| RSC-A03 | CONFIRMED | React/resource sync is system-owned code, not TRIGGERS.md configuration. | UI consistency should not depend on automation filters. |
| RSC-A04 | CONFIRMED | The first proving view is `wiki-viewer`; `file-viewer` is the other early baseline. | Wiki exposes the latency/staleness issue, and file-viewer defines root tree semantics. |
| RSC-A05 | CONFIRMED | The fix is state/cache invalidation, not manual DOM patching. | React should reconcile stable component state after targeted cache updates. |
| RSC-A06 | CONFIRMED | Built-in views eventually migrate away from private file-resource WebSocket listeners. | Central resource sync cannot be reliable while views keep independent live-update paths. |
| RSC-A07 | CONFIRMED | Component routing can remain hardcoded for now; resource/cache policy should not. | `ContentArea` component mapping is less risky than scattered watch/cache behavior. |
| RSC-A08 | CONFIRMED | View resource policy starts minimal and grows from real built-in migrations. | Avoids designing an oversized schema before wiki/file-viewer prove the shape. |
| RSC-A09 | CONFIRMED | Legacy Git-based versioning is out of scope and future SQLite versioning should be a UEB subscriber. | This matches the discussion that Git versioning will be scrapped. |
| RSC-A10 | CONFIRMED | Direct command response messages can remain for command completion but not cache invalidation. | UI still needs acknowledgements like move/delete success, but cache truth should flow from events. |

---

## Canonical Event Contract

### Event Identity And Bus Topics

Canonical event identity uses `eventFamily` plus dotted `eventType`. Colon strings are UEB bus topics or transport messages, not canonical event identity.

Canonical event types:

```text
resource.created
resource.changed
resource.deleted
resource.renamed
resource.metadata_changed
workspace.switched
view.registry_changed
theme.changed
ui.action
```

Canonical event identity and domain operations intentionally use operation vocabulary:

| Canonical `eventType` | `resourceMutation.operation` |
|---|---|
| `resource.created` | `create` |
| `resource.changed` | `modify` |
| `resource.deleted` | `delete` |
| `resource.metadata_changed` | `metadata` |
| `resource.renamed` | `rename` |

File moves are represented as `resource.renamed` with `resourceMutation.operation = 'rename'` plus old/new parent context; do not add separate `resource.moved` or `operation = 'move'` values. Do not invent `operation = 'metadata_changed'`.

UEB bus topics may use colon names for subscription routing. These names are not canonical `eventType` identity:

```text
resource:changed
resource:renamed
resource:deleted
resource:created
resource:metadata_changed
workspace:switched
view:registry_changed
theme:changed
ui:action
```

Current `file:changed` and `file_changed` paths are implementation details to audit and replace, not durable compatibility contracts. The target state is canonical resource events routed on `resource:*` UEB topics and a single renderer `resource:invalidate` message. Temporary legacy adapters may span migration slices, but every current consumer of legacy invalidation must be covered by central `resource:invalidate` before the legacy adapter is removed, and legacy paths must not remain as parallel app behavior.

### Minimal Lifecycle Event Contracts

Lifecycle events use the same shared envelope basics as resource events, but their domain payloads stay minimal until implementation proves more is needed.

```ts
type EventLifecycleProjection = {
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  status?: string;
};

type LifecycleEventIds = {
  workspaceId: string | null;
  machineId?: string;
  machineName?: string;
  rootEventId?: string;
  parentEventId?: string;
  correlationId?: string;
  causationId?: string;
};

// Lifecycle events are workspace-scoped by default.
// `workspaceId: null` is allowed only for a `workspace.switched` transition to no active workspace,
// and that event follows the workspace-switch delivery rule, not global broadcast.
// `view.registry_changed` and `theme.changed` must carry a concrete workspace ID in this build.

type WorkspaceSwitchedEvent = {
  schemaVersion: number;
  eventId: string;
  eventFamily: 'workspace';
  eventType: 'workspace.switched';
  occurredAt: number;
  lifecycle?: EventLifecycleProjection;
  ids: LifecycleEventIds & { previousWorkspaceId?: string | null };
  actor: ResourceMutationEvent['actor'];
  provenance: ResourceMutationEvent['provenance'];
  context?: ResourceMutationEvent['context'];
  resources?: ResourceMutationEvent['resources'];
  redaction?: ResourceMutationEvent['redaction'];
  ledger?: ResourceMutationEvent['ledger'];
  workspace: {
    previousWorkspaceRoot?: string | null;
    workspaceRoot: string | null;
    reason?: 'startup' | 'user_switch' | 'reload' | 'system';
  };
};

// `ids.workspaceId` and `workspace.workspaceRoot` identify the post-switch active workspace.
// `ids.previousWorkspaceId` and `workspace.previousWorkspaceRoot` identify the pre-switch workspace.
// Workspace-switch renderer delivery is evaluated after the server records the receiver connection's
// post-switch active workspace. Send the lifecycle invalidation to the switching connection and to
// any other connection whose active workspace already matches `ids.workspaceId`; do not use the
// previous workspace match to route post-switch invalidation.

type ViewRegistryChangedEvent = {
  schemaVersion: number;
  eventId: string;
  eventFamily: 'view';
  eventType: 'view.registry_changed';
  occurredAt: number;
  lifecycle?: EventLifecycleProjection;
  ids: LifecycleEventIds & { workspaceId: string };
  actor: ResourceMutationEvent['actor'];
  provenance: ResourceMutationEvent['provenance'];
  context?: ResourceMutationEvent['context'];
  resources?: ResourceMutationEvent['resources'];
  redaction?: ResourceMutationEvent['redaction'];
  ledger?: ResourceMutationEvent['ledger'];
  viewRegistry: {
    reason: 'view_added' | 'view_removed' | 'view_updated' | 'registry_reloaded';
    affectedPanels?: string[];
    affectedResources?: Array<{ path: string; resourceType: 'view' | 'config' | 'registry' }>;
  };
};

type ThemeChangedEvent = {
  schemaVersion: number;
  eventId: string;
  eventFamily: 'theme';
  eventType: 'theme.changed';
  occurredAt: number;
  lifecycle?: EventLifecycleProjection;
  ids: LifecycleEventIds & { workspaceId: string };
  actor: ResourceMutationEvent['actor'];
  provenance: ResourceMutationEvent['provenance'];
  context?: ResourceMutationEvent['context'];
  resources?: ResourceMutationEvent['resources'];
  redaction?: ResourceMutationEvent['redaction'];
  ledger?: ResourceMutationEvent['ledger'];
  theme: {
    affectedPanels?: string[];
    affectedFiles?: string[];
    affectedResources?: Array<{ path: string; resourceType: 'style' | 'config' }>;
  };
};
```

### Canonical Resource Mutation Event

Resource events preserve facts. Subscribers filter them.

The canonical UEB resource mutation event follows the shared Events And Ledger provenance envelope. This is the event consumed by ledger, metadata, trigger, future versioning, and resource-sync subscribers.

```ts
type ResourceMutationEvent = {
  schemaVersion: number;
  eventId: string;
  eventFamily: 'resource';
  eventType: 'resource.created' | 'resource.changed' | 'resource.deleted' | 'resource.renamed' | 'resource.metadata_changed';
  eventPhase?: 'observe' | 'complete';
  occurredAt: number;
  lifecycle?: EventLifecycleProjection;

  ids: {
    workspaceId: string;
    machineId?: string;
    machineName?: string;
    threadId?: string;
    turnId?: string;
    exchangeId?: string;
    messageId?: string;
    rootEventId?: string;
    parentEventId?: string;
    correlationId?: string;
    causationId?: string;
    serverMutationId?: string;
    harnessId?: string;
    harnessRunId?: string;
    harnessEventId?: string;
  };

  actor: {
    type: 'human' | 'assistant' | 'trigger' | 'scheduler' | 'script' | 'sync' | 'import' | 'agent' | 'system' | 'external' | 'unknown';
    id?: string;
  };

  provenance: {
    source: { type: string; module?: string; path?: string; handler?: string };
    origin: { type: EventOriginType; id?: string };
    observedBy: { type: string; module?: string; path?: string; handler?: string };
    confidence: 'direct' | 'correlated' | 'inferred' | 'unknown';
    cause?: ResourceCauseProjection;
  };

  context?: {
    scope?: 'ui' | 'headless' | 'harness' | 'system' | 'external';
    connectionId?: string;
    clientId?: string;
    viewId?: string;
    panelId?: string;
    route?: string;
    activeTabId?: string | null;
    activeDocumentPath?: string | null;
    activeResourcePath?: string | null;
    selectedResourceId?: string | null;
  };

  before: ResourceStateSnapshot | ResourceStateUnavailable;
  after: ResourceStateSnapshot | ResourceStateUnavailable;
  parentListings?: {
    before?: ResourceParentProjection;
    after?: ResourceParentProjection;
  };
  parentListingOmissions?: {
    before?: OmissionReason;
    after?: OmissionReason;
  };

  resourceMutation: {
    resourceEventId: string;
    resourceId?: string;
    resourceType: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
    path: string;
    oldPath?: string;
    operation: 'create' | 'modify' | 'delete' | 'rename' | 'metadata';
    observedAt?: number;
    observerEventType?: string;
    contentHashBefore?: string;
    contentHashAfter?: string;
    sizeBefore?: number;
    sizeAfter?: number;
    symlink?: { target?: string; broken?: boolean };
  };

  automationRef?: {
    automationRunId: string;
    automationKind: 'trigger' | 'scheduler' | 'script' | 'sync' | 'import' | 'agent' | 'system';
    triggerRunId?: string;
    schedulerRunId?: string;
    scriptRunId?: string;
    agentRunId?: string;
  };

  resources: Array<{
    role: 'subject' | 'parent' | 'old-parent' | 'new-parent' | 'related';
    resourceId?: string;
    resourceType: string;
    path?: string;
    oldPath?: string;
    relatedEventId?: string;
    resourceEventId?: string;
    fileVersionId?: string;
  }>;

  redaction?: {
    policy?: string;
    redactedKeys?: string[];
    hashes?: string[];
  };

  ledger?: {
    ledgerEventId?: string;
    edgeIds?: string[];
  };
};

type ResourceStateSnapshot = ResourceStatePresent | ResourceStateAbsent;

type ResourceStatePresent = {
  exists: true;
  resourceId?: string;
  resourceType: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
  path: string;
  name?: string;
  parentPath?: string | null;
  parentName?: string | null;
  contentHash?: string;
  size?: number;
  mtimeMs?: number;
  lineCount?: number;
  wordCount?: number;
  tokenCount?: number;
  siblings?: Array<{
    name: string;
    path: string;
    type: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
    extension?: string;
    size?: number;
    mtimeMs?: number;
  }>;
  omissions?: ResourceStateOmissions;
};

type ResourceStateAbsent = {
  exists: false;
  resourceType?: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
  path: string;
  parentPath?: string | null;
  parentName?: string | null;
  omissions?: ResourceStateOmissions;
};

type ResourceStateUnavailable = {
  omitted: true;
  omissionReason: OmissionReason;
};

type OmissionReason = 'not_applicable' | 'not_observed' | 'too_expensive' | 'not_supported' | 'redacted' | 'unknown';

type ResourceStateOmissions = {
  contentHash?: OmissionReason;
  size?: OmissionReason;
  mtimeMs?: OmissionReason;
  lineCount?: OmissionReason;
  wordCount?: OmissionReason;
  tokenCount?: OmissionReason;
  siblings?: OmissionReason;
  parent?: OmissionReason;
};
```

`resourceMutation.resourceEventId` is the resource-mutation domain ID. It is not a replacement for the top-level canonical `eventId`; ledger/storage links should preserve both when both are present.

`automationRef.automationRunId` mirrors the automation-domain `automation.runId`, and `automationRef.automationKind` mirrors `automation.kind`. The `automationRef` object is a compact resource-event reference for subscribers, not a second automation schema.

View and panel fields belong under `context`, not inside `resourceMutation`. `ids` carries thread, turn, `rootEventId`, `parentEventId`, correlation, and causation identity. `provenance.cause` carries only durable upstream initiator IDs.

Canonical resource path semantics:

- `delete`: `resourceMutation.path` is the deleted path.
- `rename`: `resourceMutation.path` is the new path, and `resourceMutation.oldPath` is the previous path.
- Other operations use the current subject path in `resourceMutation.path`.

Canonical resource paths are workspace-relative unless explicitly named `absolutePath`. This applies to `resourceMutation.path`, `resourceMutation.oldPath`, `before.path`, `after.path`, and `resources[].path`. Renderer `viewRefs[].path` remains panel-relative and must not be copied back into canonical event identity.

`ResourceStateAbsent.path` is required for create/delete absent sides: use the created path for `before` on create and the deleted path for `after` on delete. If even that identity is unavailable, use `ResourceStateUnavailable` with an explicit omission reason instead of `ResourceStateAbsent`.

Before/after rules:

- `create`: `before` uses `ResourceStateAbsent`; `after` contains the created resource state or `ResourceStateUnavailable`. The new parent listing is carried in `after.siblings` or `parentListings.after` when available. If `after` is a state snapshot and only sibling data is missing, record that as `after.omissions.siblings`; if `parentListings.after` is missing, record `parentListingOmissions.after`; if `after` is unavailable as a whole, use `ResourceStateUnavailable.omissionReason`. Projections may mirror canonical omission reasons into `parentOmissions`, but canonical events must not rely on projection-only omissions.
- `modify`: `before` and `after` use the same path, with changed hash/size/stats, or an explicit omission reason.
- `delete`: `before` contains the deleted resource state and prior parent listing, or an explicit omission reason; `after` uses `ResourceStateAbsent`.
- `rename`: `before.path` is the old path and `after.path` is the new path; cross-folder renames include old and new parent context, or an explicit omission reason.
- `metadata`: `before` and `after` preserve path identity and capture changed stat/metadata fields.

Parent listing snapshots on `before.siblings` and `after.siblings` are the subject resource's parent listing captured alongside the subject state:

- For `create`, `after.siblings` is the new parent listing after the created child exists. The absent-side prior parent listing, if captured, belongs in canonical `parentListings.before`, not in `before.siblings` because `before` is `ResourceStateAbsent`.
- For `delete`, `before.siblings` is the prior parent listing before removal. The absent-side post-delete parent listing, if captured, belongs in canonical `parentListings.after`, not in `after.siblings` because `after` is `ResourceStateAbsent`.
- For `rename`, same-folder renames use `before.siblings` and `after.siblings` for the same parent. Cross-folder renames use `before.parentPath`/`before.siblings` for the old parent and `after.parentPath`/`after.siblings` for the new parent.
- `resources[]` contains normalized references to subject/parent resources; it does not replace before/after listing snapshots.

Minimum per-operation state:

| Operation | Required `before` | Required `after` |
|---|---|---|
| `create` | `ResourceStateAbsent` | Created resource state or `ResourceStateUnavailable` with explicit omission reason |
| `modify` | Prior state or `ResourceStateUnavailable` with explicit omission reason | New state or `ResourceStateUnavailable` with explicit omission reason |
| `delete` | Deleted resource state or `ResourceStateUnavailable` with explicit omission reason | `ResourceStateAbsent` |
| `rename` | Old path/parent state or `ResourceStateUnavailable` with explicit omission reason | New path/parent state or `ResourceStateUnavailable` with explicit omission reason |
| `metadata` | Prior metadata/stat state or `ResourceStateUnavailable` with explicit omission reason | New metadata/stat state or `ResourceStateUnavailable` with explicit omission reason |

These are resource state snapshots for sync/audit metadata, not SPEC-33 content blob snapshots.

Root resources use `parentPath: null` and `parentName: null` when no parent exists. Missing parent fields mean the enrichment pipeline did not include parent context; explicit root parent fields use null rather than sentinel strings such as `''` or `/`.

### Resource Sync Projection

The type below is the compact resource-sync projection used by the controller/broadcaster. It must be derivable from the canonical event and must not become a second event language. Projection `source` and `observedBy` carry the canonical provenance objects; they must not encode actor, origin, or cause.

Projection `resource.path` is the current/after path for create, modify, metadata, and rename events. For delete events, `resource.path` is the deleted/old path. Rename projections must include both `oldPath` and `newPath`.

Projection `stats` are after-state stats for create, modify, metadata, and rename events, and before-state stats for delete events. Consumers that need both directions must read `before` and `after`.

Projection `viewRefs[].path` is a panel-relative cache target path/key. It is not the canonical changed resource path; use `resource.path` or message `resourcePath` for the subject resource.

```ts
type ResourceSyncEventProjection = {
  eventId: string;
  eventType: ResourceMutationEvent['eventType'];
  occurredAt: number;

  workspaceId: string;
  workspaceRoot: string | null;
  projectionOmissions?: {
    workspaceRoot?: OmissionReason;
  };

  event: 'modify' | 'create' | 'delete' | 'rename' | 'metadata';
  source: ResourceMutationEvent['provenance']['source'];
  observedBy: ResourceMutationEvent['provenance']['observedBy'];

  origin?: EventOriginProjection;
  ids: Pick<ResourceMutationEvent['ids'], 'workspaceId' | 'threadId' | 'turnId' | 'rootEventId' | 'parentEventId' | 'correlationId' | 'causationId' | 'serverMutationId'>;
  context?: Pick<NonNullable<ResourceMutationEvent['context']>, 'scope' | 'connectionId' | 'clientId' | 'viewId' | 'panelId' | 'route' | 'activeTabId' | 'activeDocumentPath' | 'activeResourcePath' | 'selectedResourceId'>;
  cause?: ResourceCauseProjection;
  automationRef?: ResourceMutationEvent['automationRef'];

  resource: {
    type: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
    path: string;
    absolutePath?: string;
    name: string;
    basename: string;
    extension?: string;
    parentPath?: string | null;
    parentName?: string | null;
    oldPath?: string;
    oldName?: string;
    newPath?: string;
    newName?: string;
  };

  stats?: {
    size?: number;
    mtimeMs?: number;
    lineCount?: number;
    wordCount?: number;
    tokenCount?: number;
  };
  statOmissions?: Pick<ResourceStateOmissions, 'lineCount' | 'wordCount' | 'tokenCount' | 'size' | 'mtimeMs'>;

  parents?: {
    before?: ResourceParentProjection;
    after?: ResourceParentProjection;
  };
  parentOmissions?: {
    before?: OmissionReason;
    after?: OmissionReason;
  };

  before: ResourceStateSnapshot | ResourceStateUnavailable;
  after: ResourceStateSnapshot | ResourceStateUnavailable;

  viewRefs: Array<{
    panel: string;
    // Panel-relative cache target path/key, not the canonical changed resource path.
    path: string;
    kind: 'tree' | 'content' | 'style' | 'config' | 'registry';
    target: 'content' | 'parent-tree' | 'old-content' | 'new-content' | 'old-parent-tree' | 'new-parent-tree' | 'style' | 'config' | 'registry';
  }>;

  raw?: {
    chokidarEvent?: string;
    legacyEvent?: string;
    originalPath?: string;
    context?: unknown;
  };
};

type ResourceParentProjection = {
  path: string;
  name: string;
  files: number;
  folders: number;
  siblings: Array<{
    name: string;
    path: string;
    type: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
    extension?: string;
    size?: number;
    mtimeMs?: number;
  }>;
};
```

`workspaceRoot` is resolved from the event's `ids.workspaceId` against the workspace registry or captured workspace snapshot at projection time, not from the currently active workspace. If the workspace cannot be resolved, set `workspaceRoot: null` and record `projectionOmissions.workspaceRoot`. It is projection context, not a second canonical identity field.

Within `ResourceSyncEventProjection.resource`, `basename` is the final path segment including extension; `name` is the display label derived by the resource policy. They may match for ordinary files but are not interchangeable.

### Origin Envelope

All mutation-producing paths must provide normalized provenance and context. UI-origin operations carry active view context and a durable UI action ID.

```ts
type ResourceCauseProjection = {
  uiActionId?: string;
  toolCallId?: string;
  harnessId?: string;
  harnessRunId?: string;
  harnessEventId?: string;
  triggerRunId?: string;
  scriptRunId?: string;
  schedulerRunId?: string;
  automationRunId?: string;
  agentRunId?: string;
  auditQueryId?: string;
};

type EventOriginType = 'ui' | 'tool' | 'harness' | 'trigger' | 'scheduler' | 'script' | 'sync' | 'import' | 'agent' | 'system' | 'external' | 'unknown';

type EventOriginProjection = {
  type: EventOriginType;
  id?: string;
};
```

UI commands such as `file:rename`, `file:move`, `file:delete`, `file_save`, `folder_create`, and `document_create` must include renderer-supplied IDs, a renderer-created `uiActionId`, optional `clientCommandId`, and command-time UI context. Existing numeric view-state `clientMutationId` values are acknowledgement/order tokens, not provenance identifiers. Resource mutation events caused by those commands must set `provenance.cause.uiActionId`. Watcher-origin events must not pretend to be UI-origin.

`file:move` commands produce `resource.renamed` resource events with `operation = 'rename'` and old/new parent context.

SPEC-32 must emit a minimal UI action event for mutation-producing UI commands:

```ts
type UiActionEvent = {
  schemaVersion: number;
  eventId: string;
  eventFamily: 'ui';
  eventType: 'ui.action';
  occurredAt: number;
  lifecycle?: EventLifecycleProjection;
  ids: { workspaceId: string; threadId?: string; turnId?: string; rootEventId?: string; parentEventId?: string; correlationId?: string; causationId?: string };
  actor: { type: 'human'; id?: string };
  provenance: ResourceMutationEvent['provenance'];
  context: NonNullable<ResourceMutationEvent['context']>;
  resources: ResourceMutationEvent['resources'];
  redaction?: ResourceMutationEvent['redaction'];
  ledger?: ResourceMutationEvent['ledger'];
  uiAction: {
    uiActionId: string;
    clientCommandId?: string;
    command: string;
    inputSummary?: string;
    receiverConnectionIds?: string[];
    resultEventIds?: string[];
    resourceEventIds?: string[];
  };
};
```

`uiAction.resourceEventIds` is a convenience mirror for command handling. It does not replace normalized `resources[]` references or ledger edges.

If durable persistence of UI action events waits for SPEC-33, the event must still be emitted on UEB and the `uiActionId` must be carried through the resource mutation event.

Canonical provenance fields use the wiki vocabulary:

- `provenance.source` records the producer of the canonical event record.
- `provenance.origin` records the initiating actor/context when known.
- `provenance.observedBy` records the subsystem that detected the fact.
- `provenance.confidence` is `direct`, `correlated`, `inferred`, or `unknown`.
- `provenance.cause` stores upstream durable initiator IDs only. Root, parent, thread, turn, correlation, and causation IDs belong under `ids`.
- View/panel/route/active-resource details belong in shared `context`, not inside resource payloads.

Every server-side mutation command must generate or propagate `ids.serverMutationId`, including file save/create/move/rename/delete, background server jobs, and non-UI server API mutations.

### Future Ledger Compatibility Contract

SPEC-32 must preserve enough identity and provenance for SPEC-33 without implementing version storage.

Required now:

- Stable `eventId` for each canonical resource event.
- Workspace and resource identity.
- Shared provenance envelope compatibility: `ids`, `actor`, `provenance`, `context`, `resources[]`, and resource mutation domain payload.
- `provenance.source` as the canonical event producer.
- `provenance.observedBy` as the subsystem that detected the fact.
- `provenance.origin` as the initiating actor/context when known.
- `ids` for thread, turn, `rootEventId`, `parentEventId`, correlation, and causation identity when available.
- `provenance.cause` IDs for UI actions, tool calls, harness IDs/runs/events, trigger runs, script runs, scheduler runs, automation runs, agent runs, and audit queries when available.
- Explicit `before`/`after` resource state snapshots or explicit omission reasons for create/modify/delete/rename/metadata.

Not required in SPEC-32:

- SQLite file version tables.
- File content snapshot storage.
- Diff generation.
- Change-storm compaction.
- Assistant history query workflows.

### Enrichment Source

Event enrichment is layered:

1. Raw producer reports a direct mutation or observer fact, preserving whether it performed the mutation or only observed it.
2. `lib/resources/resource-context.js` implements the enricher role and adds path, parent, siblings, stats, line count, word count, and token count.
3. UEB emits the enriched canonical resource event.
4. Subscribers act.

For watcher-only canonical events, use `provenance.source.type = 'resource-enricher'` and `provenance.source.module = 'lib/resources/resource-context.js'`; `provenance.observedBy` remains the watcher that detected the filesystem fact.

`viewRefs` are not part of the canonical resource event payload. The resource-sync subscriber runs `resource-event-mapper` after UEB emission to derive the renderer-specific `ResourceSyncEventProjection.viewRefs` used for cache invalidation. Ledger, trigger, and future versioning subscribers consume the canonical event and may build their own projections without inheriting render-specific fields.

Token counting uses the existing tokenizer synchronously only for text-like resources up to 512 KiB. Text-like means the existing text-file helper accepts the path/extension or the first 8 KiB decode as UTF-8 without NUL bytes; known binary extensions and failed UTF-8/NUL-byte probes are `not_supported`. When a `ResourceStatePresent`/snapshot block exists, larger text resources omit the token count with `omissions.tokenCount = 'too_expensive'`; binary or unsupported resources use `not_supported`; redacted resources use `redacted`. If the whole state is unavailable, use `ResourceStateUnavailable.omissionReason`. The event must not block on tokenization outside that threshold and must not drop token metadata silently.

---

## Server Architecture

### Keep

| Module | Role |
|---|---|
| `lib/watch/core.js` | Central chokidar manager. |
| `lib/watch/workspace-watcher.js` | Raw project filesystem watcher and rename detection. |
| `lib/event-bus.js` | Firehose/pub-sub. |
| `lib/triggers/*` | Automation subscriber family. |
| `lib/ledger/*` | Audit subscriber family. |

### Add

| Module | Job |
|---|---|
| `lib/resources/resource-context.js` | Build enriched resource context: parent, siblings, stats, tokenizer data. |
| `lib/resources/resource-event-mapper.js` | Map workspace-relative resource paths to panels and client resource refs. |
| `lib/ws/resource-broadcaster.js` | Subscribe to UEB resource, workspace, view, and theme events and send client `resource:invalidate` messages. |
| `lib/watch/workspace-watch-controller.js` | Own active workspace watcher lifecycle; start/repoint/close watcher on workspace switch. |

### Normalize Existing Producers

| Producer | Current | Target |
|---|---|---|
| `workspace-watcher` | Emits `file:changed`. | Emit a raw resource observation into the enrichment pipeline, which then emits canonical resource events on `resource:*` topics. |
| `file-explorer.js` save/create | Emits legacy `file_changed`. | Emit canonical resource events on `resource:*` topics with origin; remove direct legacy broadcast. |
| `workspace-request-handlers.js` move/rename/delete | Directly broadcasts `file_changed`. | Emit canonical resource events on `resource:*` topics; broadcaster handles clients; remove direct legacy broadcast. |
| Harness/provider mutations | UEB already sees harness events in places. | Include canonical harness IDs under `ids.harnessId`, `ids.harnessRunId`, `ids.harnessEventId` and causal copies under `provenance.cause.harnessId`, `provenance.cause.harnessRunId`, and `provenance.cause.harnessEventId` when the harness caused the mutation. Use `origin.type = 'harness'` only when the harness is the initiator. Use `origin.type = 'tool'` and `actor.type = 'assistant'` only when the mutation is tied to an assistant/tool call; otherwise use the closest allowed origin/actor category. Provider-native identity such as OpenCode IDs stays on linked harness/tool events in provider-keyed `nativeRefs` or provider-specific payloads, not resource mutation events. |
| scripts/scheduler/sync/import/agent | Ad hoc or future. | Downstream resource events produced by known automation writes emit canonical resource events on `resource:*` topics with `origin.type` set to the concrete automation kind (`trigger`, `scheduler`, `script`, `sync`, `import`, `agent`) or `system`, `provenance.origin.id = automation.runId` when the automation run is the initiating context, `provenance.cause.automationRunId`, applicable subtype IDs in `provenance.cause` and `automationRef` when known, and `context.scope = 'headless'`. Automation run events themselves follow the Automation Run Provenance Schema and must not self-reference their own run ID in `provenance.cause`. Omit automation IDs only for genuinely external/unknown watcher-only events. |

Harness attribution uses `provenance.origin.type = 'harness'` only when the harness is the initiating context. If the harness mutation is tied to an assistant/tool call, use `provenance.origin.type = 'tool'`, `actor.type = 'assistant'`, preserve `context.scope = 'harness'`, and carry the tool-call ID in `provenance.cause`; otherwise use the best supported non-human actor category (`agent`, `system`, `external`, or `unknown`) without inventing `actor.type = 'harness'`. Durable harness identities belong in `ids.harnessId`, `ids.harnessRunId`, `ids.harnessEventId`, and in `provenance.cause.harnessId`, `provenance.cause.harnessRunId`, `provenance.cause.harnessEventId` when they caused the mutation. OpenCode-native identity belongs under provider-keyed `nativeRefs` or provider-specific payloads on linked harness/tool events; do not add canonical `openCodeRunId`, `openCodeEventId`, or `origin.type = 'openCode'`.

### Subscriber Split

| Subscriber | Consumes | Output |
|---|---|---|
| TRIGGERS subscriber | UEB resource/chat events, including events with `context.scope = 'harness'` or `provenance.origin.type = 'harness'` | tickets, agent runs, scripts, notifications |
| Resource sync subscriber | UEB resource/workspace/view/theme events | WebSocket `resource:invalidate` messages |
| Ledger subscriber | UEB firehose | SQLite event ledger |
| Metadata subscriber | UEB resource events | chat turn/file mutation metadata |

TRIGGERS can reuse the same match/exclude/condition primitives, but React/resource sync is code-owned and deterministic.

---

## Client Architecture

### Declarative Resource Sync Policy

Resource sync must not hardcode every view's cache behavior in React components.

Each view must be able to declare how workspace resources map to cache keys, active resources, and invalidation behavior. For the first implementation slices, 32b/32c, this policy lives in a central server/client resource policy module and that module is authoritative for root mapping, resource-kind mapping, path normalization, cache-key derivation, and invalidation policy. Existing view metadata may be read as an input only when the central policy explicitly maps that field; otherwise metadata reads are advisory and must not create server/client drift. Root, resource-kind, and path normalization from that registry may feed canonical enrichment. View/panel/cache mapping from that registry feeds only the resource-sync mapper, `viewRefs`, cache-key derivation, and renderer invalidation. Later slices may move or serialize declarations into view metadata such as `content.json`, `manifest.md`, or a resource policy file under the view capsule.

The policy must be workspace-aware. A new workspace or custom view must be able to define:

- Which filesystem root the view reads.
- Which paths are tree resources.
- Which paths are content resources.
- Which paths are indexes or registries.
- Which file patterns affect visible rows, previews, thumbnails, or document bodies.
- Which parent folder listings refresh after create/delete/rename.
- Which active/open resources are prefetched or kept warm.
- Which events trigger full rediscovery instead of local invalidation.

Example shape:

```json
{
  "resources": {
    "root": { "type": "machine-relative", "path": "Captures" },
    "tree": {
      "key": "{panel}:{folder}",
      "parentOf": "{path}"
    },
    "content": {
      "key": "{panel}:{path}",
      "patterns": ["**/*.md", "**/*.txt", "**/*.json"]
    },
    "indexes": [
      { "path": "content/tickets.json", "affects": ["board"] }
    ],
    "refresh": {
      "modify": ["content"],
      "create": ["parent-tree"],
      "delete": ["content", "parent-tree"],
      "rename": ["old-content", "new-content", "old-parent-tree", "new-parent-tree"]
    },
    "warm": {
      "active": true,
      "openTabs": true,
      "recents": 10,
      "siblings": 2
    }
  }
}
```

The JSON shape is illustrative, but the first policy implementation, Slices 32b/32c, requires policy fields for root, tree key, content key, patterns, refresh mapping, and warm rules. If a migrated view exposes metadata or index resources, its policy must also name those cache keys before the view can emit metadata/index invalidations. Metadata/index resources map to existing cache kinds: use `config` for configuration-like metadata and `registry` for index/listing metadata unless a later decision expands the `kind` and `target` unions. The first implementation should harden the central policy module around `file-viewer` and `wiki-viewer`; server and client cache keys derive from that registry or from serialized `viewRefs`, not from separate per-view rules.

View examples:

| View | Likely policy |
|---|---|
| `file-viewer` | Workspace root tree/content. Refresh nearest parent folder on structural changes. |
| `wiki-viewer` | Wiki folders as tree resources; `PAGE.md` as content resources; folder structure affects navigation tree. |
| `capture-viewer` | Capture folders as row groups; document files as content; archive moves affect source and archive folder rows. |
| `office-viewer` | Folder/document content plus document previews/thumbnails; selected/open docs stay warm. |
| `email-viewer` | Folder/document content plus account/folder indexes; selected/open email docs stay warm. |
| `issues-viewer` | Ticket index plus ticket files; create/delete/status changes affect board columns. |
| `agents-viewer` | Agent registry, settings files, workflow folders, and workflow docs. |
| `system-viewer` | System folders/files with central cache semantics. |

The resource sync controller reads the policy and converts canonical resource events into cache invalidations. React views then subscribe to cache/store state and do not own file-change routing.

### Message Contract

Server-to-client:

```ts
type ResourceInvalidateMessage = ResourceMutationInvalidateMessage | ResourceLifecycleInvalidateMessage;

type ResourceMutationInvalidateMessage = {
  type: 'resource:invalidate';
  eventId: string;
  eventType: ResourceMutationEvent['eventType'];
  ids: ResourceSyncEventProjection['ids'];
  cause?: ResourceCauseProjection;
  workspaceId: string;
  panel: string;
  path: string;
  resourcePath: string;
  kind: 'tree' | 'content' | 'style' | 'config' | 'registry';
  target: ResourceSyncEventProjection['viewRefs'][number]['target'];
  event: 'modify' | 'create' | 'delete' | 'rename' | 'metadata';
  oldResourcePath?: string;
  source: ResourceSyncEventProjection['source'];
  observedBy: ResourceSyncEventProjection['observedBy'];
  origin?: EventOriginProjection;
  context?: ResourceSyncEventProjection['context'];
};

type ResourceLifecycleInvalidateMessage = {
  type: 'resource:invalidate';
  eventId: string;
  eventType: WorkspaceSwitchedEvent['eventType'] | ViewRegistryChangedEvent['eventType'] | ThemeChangedEvent['eventType'];
  ids: WorkspaceSwitchedEvent['ids'] | ViewRegistryChangedEvent['ids'] | ThemeChangedEvent['ids'];
  cause?: ResourceCauseProjection;
  workspaceId: string | null;
  event: 'workspace-switch' | 'view-registry-change' | 'theme-change';
  lifecycleScope: 'workspace' | 'view-registry' | 'theme';
  kind: 'tree' | 'content' | 'style' | 'config' | 'registry' | 'all';
  affectedResources?: Array<{
    panel: string;
    path?: string;
    kind: 'tree' | 'content' | 'style' | 'config' | 'registry';
  }>;
  affectedPanels?: string[];
  source: WorkspaceSwitchedEvent['provenance']['source'] | ViewRegistryChangedEvent['provenance']['source'] | ThemeChangedEvent['provenance']['source'];
  observedBy: WorkspaceSwitchedEvent['provenance']['observedBy'] | ViewRegistryChangedEvent['provenance']['observedBy'] | ThemeChangedEvent['provenance']['observedBy'];
  origin?: EventOriginProjection;
  context?: WorkspaceSwitchedEvent['context'] | ViewRegistryChangedEvent['context'] | ThemeChangedEvent['context'];
};
```

The WebSocket message uses a renderer-specific `resource:invalidate` envelope. For `ResourceMutationInvalidateMessage`, the `event` field carries the specific resource mutation action; lifecycle invalidation messages carry lifecycle actions such as `workspace-switch`, `view-registry-change`, or `theme-change`. This avoids overloading canonical resource event identity with `resource:*` bus-topic or transport/cache semantics. Legacy `file_changed` handling is allowed only inside the temporary migration adapter window and must not remain as a parallel invalidation path.

Resource mutation invalidations are never workspace-null; in this build, `workspaceId: null` is reserved only for `workspace.switched` transitions to no active workspace. Null `workspace.switched` events follow workspace-switch delivery, not global broadcast. Global lifecycle invalidations are future/out of scope.

For resource mutations, the broadcaster emits one `resource:invalidate` message per `viewRef` in the `ResourceSyncEventProjection`. It does not send one aggregate message containing all affected views. In each emitted message, `panel`, `path`, `kind`, and `target` are copied from the emitted `viewRef`; `resourcePath` is the canonical subject path for the resource mutation. `oldResourcePath` is required only for rename, where `resourcePath` is the new path and `oldResourcePath` is the previous path. For delete, `resourcePath` is the deleted path and `oldResourcePath` is omitted. This prevents parent-tree invalidations such as `old-parent-tree` and `new-parent-tree` from being mistaken for the changed file's content key. For lifecycle events, the broadcaster sends the lifecycle variant so renderer cache/state can handle workspace switch, view registry, and theme invalidation without pretending those are file mutations.

For lifecycle invalidation, `affectedPanels` limits the panel set and `affectedResources[].panel` targets a specific panel cache key. If neither is present, the lifecycle event applies to all active workspace enabled views that match the `lifecycleScope` and lifecycle `kind`; `kind: 'all'` means all cache kinds under that lifecycle scope. `lifecycleScope` is a renderer routing field and is unrelated to provenance `context.scope`. The broadcaster copies lifecycle event `context` when present so clients can distinguish initiator and receiver connections.

### Cache Invalidation Rule

Resource sync must invalidate the smallest affected cached resource, not the whole view.

For default file-listing behavior:

```text
modify file -> invalidate content key for that file
create file -> invalidate parent folder tree key, and new content key if cached or optimistically opened
delete file -> invalidate content key and parent folder tree key
rename file -> invalidate old content key, new content key if cached, and parent folder tree key(s)
create folder -> invalidate the folder's parent tree key
delete folder -> invalidate the folder's parent tree key, mark known cached descendants under the old prefix stale, and refetch descendants on demand
rename/move folder -> invalidate affected parent tree key(s), mark known cached descendants under old and new prefixes stale, and refetch descendants on demand
```

The parent tree key is the folder listing that directly contains the changed resource.
`wiki-viewer` `PAGE.md` create/delete/frontmatter-affecting modify is a policy override: it invalidates page content plus the wiki metadata `config` key without refreshing parent tree listings. Body-only modify invalidates content only.
In Slice 32f, wiki tree rows are folder-only. `PAGE.md` create/delete changes page availability through the page content key and wiki metadata/config key, not by refreshing the parent tree, unless a later policy declares page-file fields that affect folder row labels or tree membership.

Examples:

| Event | Content key | Tree key |
|---|---|---|
| `file-viewer:README.md` modified | `file-viewer:README.md` | no tree refresh unless row metadata changes |
| `file-viewer:README.md` created/deleted | `file-viewer:README.md` | `file-viewer:` |
| `file-viewer:src/App.tsx` modified | `file-viewer:src/App.tsx` | no tree refresh unless row metadata changes |
| `file-viewer:src/components/NewThing.tsx` created | `file-viewer:src/components/NewThing.tsx` | `file-viewer:src/components` |
| `file-viewer:src/components` renamed | descendant content keys under old/new path | `file-viewer:src` |
| `wiki-viewer:005-Enforcement/New_Page` folder created | no content key unless opened | `wiki-viewer:005-Enforcement` |
| `wiki-viewer:005-Enforcement/New_Page/PAGE.md` created/deleted/frontmatter-affecting modify | `wiki-viewer:005-Enforcement/New_Page/PAGE.md` plus `wiki-viewer:005-Enforcement/New_Page/metadata`; body-only modify invalidates content only | no tree refresh unless wiki policy declares page-file metadata affects folder row |
| `wiki-viewer:005-Enforcement/001-Code_Standards` renamed | descendant content keys under old/new path | `wiki-viewer:005-Enforcement` |

Root tree invalidation is only correct when the changed resource is directly under the view content root or when the root itself changed. File-viewer usually maps to the workspace root, but a nested file change must target its nearest cached parent folder, not blindly refresh `file-viewer:`.
Wiki navigation is folder-derived in the first slice: folder create/delete/rename affects parent tree listings, while `PAGE.md` create/delete/frontmatter-affecting modify affects page content and the wiki metadata `config` key without refreshing the parent tree. Body-only `PAGE.md` modify invalidates page content only.

### Central State

Use one central resource/file cache path:

- Add a `resourceStore` API facade over existing `fileDataStore` for the first implementation.
- `resourceStore` owns the API boundary for pending requests, cached trees, cached content, metadata, dirty flags, and invalidation.
- Components request resources through `resourceStore`.
- WebSocket handlers populate/invalidate through `resourceStore`.
- `fileDataStore` can remain an internal delegate until a later cleanup removes or renames it.

### View Migration Targets

| View/hook | Current issue | Target |
|---|---|---|
| `components/wiki/WikiExplorer.tsx` | Private recursive WS tree, clears root/content on reload. | Read tree/content from central resource cache; incremental invalidation. |
| `hooks/usePanelData.ts` | Per-view WS listener and parser callback. | Replace with cache-backed resource reader or delete after migrations. |
| `hooks/useFileTree.ts` | Older file-viewer WS listener. | Use central resource cache. |
| `components/file-explorer/FolderNode.tsx` | Direct `file_tree_request`. | Use central resource cache. |
| `components/agents/AgentTiles.tsx` | Direct detail/workflow WS listeners. | Use central tree/content reads. |
| `components/tickets/TicketBoard.tsx` | Uses `usePanelData`. | Cache-backed ticket index read. |
| `components/office/OfficeGrid.tsx` and `components/email/EmailGrid.tsx` | Mostly cache-backed but has manual cache writes for created docs. | All server responses flow through central handlers. |
| `components/SystemViewer.tsx` | Already close to cache-backed. | Verify it only uses central resource requests. |
| `components/capture/CaptureTiles.tsx` and doc hooks | Already close to cache-backed. | Verify live invalidation and active doc refresh. |

### UI-Origin Context Capture

Client mutation senders must create and attach durable UI action identity plus command-time context. This is the renderer command/UI action envelope, not the downstream resource mutation event:

```ts
{
  uiActionId,
  clientCommandId,
  ids: {
    workspaceId,
    threadId,
    turnId,
    correlationId
  },
  context: {
    scope: 'ui',
    connectionId,
    clientId,
    viewId,
    panelId,
    route,
    activeTabId,
    activeDocumentPath,
    activeResourcePath,
    selectedResourceId
  },
  resources: [
    {
      role: 'subject',
      resourceId?,
      resourceType,
      path,
      oldPath?
    }
  ],
  provenanceInput: {
    origin: { type: 'ui', id: uiActionId },
    confidence: 'direct'
  }
}
```

The renderer command should include normalized resource refs when the command targets known resources. View/panel information stays in `context`, not `resources[]`. If a command has no resource target, use an empty `resources` array; downstream server mutation handlers may derive additional resource refs from command input but must preserve the original UI action ID and command-time context.

This context is captured at command time, not inferred later on the server. The renderer command envelope carries `provenanceInput`, not canonical event provenance. The canonical `ui.action` event uses `provenance.origin.type = 'ui'`, `provenance.origin.id = uiActionId`, `provenance.source.type = 'server-ui-action-ingestor'`, `provenance.observedBy.type = 'server-ui-action-ingestor'`, and `provenance.confidence = 'direct'`. The `ui.action` event must not self-reference its own `uiActionId` in `provenance.cause`; the downstream resource mutation caused by the command must carry the same `uiActionId` in `provenance.cause.uiActionId`.

Downstream resource mutation events produced by the server command handler must set `provenance.source` and `provenance.observedBy` to the server mutation producer, while preserving `provenance.origin = { type: 'ui', id: uiActionId }`.

---

## Wiki Target Behavior

Wiki is the proving ground for this spec.

### Today

- `WikiExplorer` clears `root` and selected content before loading.
- It recursively sends `file_tree_request` for every folder down to depth 4.
- It publishes the tree only when every pending folder request is complete.
- It does not consume central `fileDataStore` invalidation.

### Target

- Preserve root, selection, history, active page, scroll, and rendered document unless the selected resource disappears.
- In the first wiki migration slice, Slice 32f, `PAGE.md` create/delete and metadata/frontmatter-affecting modify invalidate both `wiki-viewer:<wiki-folder-path>/PAGE.md` and `wiki-viewer:<wiki-folder-path>/metadata`; body-only modify invalidates content only. If the slice cannot cheaply distinguish body-only from frontmatter-affecting changes, emit `resource.changed` / `operation = 'modify'` with metadata-affecting invalidation and invalidate both content and metadata.
- When frontmatter/body classification is implemented, frontmatter-only `PAGE.md` edits emit `resource.metadata_changed` / `operation = 'metadata'` and invalidate both the page content key and wiki metadata/config key; body-only edits emit `resource.changed` / `operation = 'modify'`; mixed body plus frontmatter edits emit `resource.changed` with metadata-affecting invalidation so both content and metadata cache keys refresh. Frontmatter-only metadata events still represent a backing `PAGE.md` file content mutation for versioning eligibility, hash, snapshot, and redaction policy. When classification is unavailable, use the fallback rule above.
- Wiki `PAGE.md` classifier outputs are: `frontmatter-only` when only the parsed frontmatter block changes; `body-only` when content outside the frontmatter block changes and parsed frontmatter is unchanged; `mixed` when both parsed frontmatter and body change; `no-frontmatter` when no frontmatter block exists, which routes as body-only; and `unknown` when parsing or comparison cannot classify cheaply, which uses the fallback rule above.
- Folder create/delete/rename invalidates only affected parent tree listings and lazily marks known cached descendants stale for folder delete/rename.
- Frontmatter-only changes update page metadata and dependent UI without full tree teardown. In the first wiki migration slice, Slice 32f, wiki navigation remains filesystem-derived, and the wiki metadata key is `wiki-viewer:<wiki-folder-path>/metadata` mapped as `config`; no parent-tree or index invalidation is emitted unless a later policy explicitly declares nav-affecting frontmatter fields and their metadata/index cache keys.
- Workspace switch resets only when the workspace/root actually changed.
- View refresh is incremental:

```text
PAGE.md body-only modify -> invalidate content -> request content -> update parsed page -> React reconciles page DOM
PAGE.md create/frontmatter modify -> invalidate content + metadata -> request content/metadata -> update parsed page -> React reconciles page DOM
PAGE.md delete -> evict content + metadata -> run active Wiki page fallback -> React reconciles page DOM
folder create -> invalidate parent tree -> request parent listing -> update tree node children
style change -> refresh CSS layer
view registry change -> rediscover panel configs
```

Active Wiki page fallback is deterministic:

Active Wiki page identity is `<wiki-folder-path>`; its panel-relative content path is `<wiki-folder-path>/PAGE.md`, and its full content cache key is `wiki-viewer:<wiki-folder-path>/PAGE.md`.
For fallback purposes, a Wiki page is considered missing when either its folder no longer maps after rename/move or its `PAGE.md` content resource is deleted.

1. If a rename/move maps the active page to a new existing path, keep that page active.
2. If the active page is deleted, select the nearest existing parent page.
3. If no parent page exists, select the previous valid history entry.
4. If history has no valid entry, select the wiki root page.
5. If no wiki root exists, show an empty-state without clearing unrelated cache entries.

## Migration Slices

### Slice 32a — Event Audit and Runtime Probe

**Goal:** Verify actual event flow before changing behavior.

- Add temporary/loggable probes or tests for:
  - external file edit
  - UI file save
  - UI rename/move/delete
  - workspace switch
  - harness-origin file mutation if available
- Confirm whether project watcher repoints on workspace switch.
- Confirm which events reach UEB and which only broadcast directly.
- Inventory every `file:changed`, `file_changed`, and view-local file-change listener path that must be replaced.

**Output:** Updated audit table in this spec or a companion report, plus a conversion checklist for all discovered legacy file-change paths.

### Slice 32b — Canonical Event and Enrichment Contract

**Goal:** Add server helpers without changing client behavior.

- Add resource context/enrichment helper.
- Add resource event mapper.
- Unit test parent, siblings, stats, line counts, token counts, token omission reasons, rename metadata, and view refs.
- Emit canonical resource events routed on `resource:*` topics behind a temporary legacy adapter, without removing existing client-facing behavior in this slice.
- Limit Slice 32b UI-origin producer work to views whose RSC-D12a exact store selectors are closed; otherwise emit only non-UI/watcher/server-origin resource events until that view's command-time context mapping is defined.
- Keep replacement/removal of `file:changed` and `file_changed` behavior for Slice 32c/32d after the broadcaster and client invalidation path exist.

### Slice 32c — Resource Broadcaster

**Goal:** UEB resource and lifecycle events can notify renderer cache.

- Add `lib/ws/resource-broadcaster.js`.
- Subscribe to canonical resource, workspace, view, and theme events needed for `resource:invalidate`.
- Send `resource:invalidate`.
- Client `file-handlers.ts` or new `resource-handlers.ts` translates resource changes to cache invalidation.
- Remove legacy `file_changed` client invalidation behavior only after every current consumer of legacy invalidation is covered by central `resource:invalidate`.

### Slice 32d — Normalize Server Mutation Producers

**Goal:** Remove direct client-broadcast source-of-truth paths.

- Close RSC-D12a for each UI-origin view/command path before converting that producer.
- Convert `workspace-request-handlers.js` file move/rename/delete to emit UEB events.
- Convert `file-explorer.js` save/create to emit UEB events.
- Migrate `chat-metadata/collectors/file-mutations.js` from `file:changed` / `file_changed` to canonical resource events.
- Remove watcher-bound trigger filters; trigger filters are recompiled as UEB resource-event subscriptions before Slice 32d is complete.
- Ensure UI-origin context is preserved.
- Keep client response messages such as `file:moved` for command completion, but not as cache invalidation source of truth.
- Remove the temporary legacy invalidation adapter before Slice 32d is complete, after confirming every current legacy invalidation consumer is covered by central `resource:invalidate`.

### Slice 32e — Watcher Lifecycle

**Goal:** Active workspace watcher follows active workspace.

- Introduce a workspace watch controller.
- On startup, watch active workspace if present.
- On the `workspace:switched` bus topic for `workspace.switched` events, close/repoint project watcher and reload UEB/resource-policy trigger subscriptions as needed.
- Avoid duplicate subscribers and stale old-root watchers.

### Slice 32f — Wiki Migration

**Goal:** Wiki uses central resource cache and incremental invalidation.

- Move tree/content requests into cache-backed hooks.
- Stop clearing root/content on ordinary refresh.
- Publish partial tree data as parent folders arrive if needed.
- Update only changed pages/folders.
- Verify app refresh, workspace switch, external PAGE.md edit, folder create/delete, and active page content change.

### Slice 32g — Remaining View Migration

**Goal:** Remove view-local file resource WebSocket listeners.

- Migrate file-viewer older hooks.
- Migrate ticket index read.
- Migrate agent detail/workflow reads.
- Verify `SystemViewer` uses central resource requests and invalidation only.
- Verify `CaptureTiles` and capture doc hooks use central resource requests and invalidation only.
- Clean up Office/Email manual cache writes.
- Retire `usePanelData` if no longer needed.

---

## Smoke Tests

At minimum:

1. Start app on `fs-dev`.
2. Open Wiki to a page.
3. Edit that `PAGE.md` externally.
4. Verify page content updates without clearing tree/selection.
5. Create a new wiki folder externally.
6. Verify only parent tree updates.
7. Rename a file through UI.
8. Verify UEB event includes `provenance.origin.type = 'ui'`, active panel/tab/document context, `provenance.cause.uiActionId` matching the `ui.action` event's `uiAction.uiActionId`, and `ids.serverMutationId`.
9. Switch workspace.
10. Verify watcher follows new workspace and old workspace edits do not invalidate current UI.
11. Trigger a `TRIGGERS.md` file-change automation.
12. Verify trigger subscriber and React sync both receive the same canonical event, but act independently.
13. During migration slices, explicitly named temporary adapters are allowed only with removal criteria. After Slice 32d and final completion, verify no remaining production path emits or consumes `file_changed` or `file:changed` for cache invalidation, metadata collection, trigger filtering, ledger input, or any other runtime behavior.

---

## First-Slice Decision Status

No open owner decisions remain for the first migration slice. Implementation still requires review approval per this spec's `DISCUSSION DRAFT` status.

---

## Completion Criteria

- One chokidar/watch pipeline feeds canonical UEB resource events.
- Server-side file mutations and watcher mutations use the same event path.
- Renderer cache invalidation is a UEB subscriber output, not ad hoc direct broadcast.
- Built-in views no longer own private file resource WebSocket listeners.
- Wiki updates incrementally and does not destroy/rebuild its DOM for ordinary file changes.
- Rich event metadata remains available to TRIGGERS and future subscribers.
- UI-origin mutations include active panel/tab/document context in the event envelope.
