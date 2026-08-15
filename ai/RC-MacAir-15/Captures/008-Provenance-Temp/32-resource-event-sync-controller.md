# SPEC-32 — Resource Event Sync Controller

**Origin:** User architecture discussion, 2026-07-09 — wiki render latency, stale live file updates, UEB firehose reuse, and view-local WebSocket/data-loading cleanup.
**Status:** DISCUSSION DRAFT. Do not implement until this spec is reviewed and approved.
**Related specs:** [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md), [SPEC-34 - UI Action Provenance Module](34-ui-action-provenance-module.md), [SPEC-35 - Universal Ledger Storage, Edges, and Indexes](35-universal-ledger-storage-edges-indexes.md), [SPEC-40 - Provenance Schema Registry and Event Validation](40-provenance-schema-registry-validation.md)
**Related wiki:** [Events And Ledger](../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md), [Resource Events And Render Sync](../../Wiki/010-Events_And_Ledger/005-Resource_Events_And_Render_Sync/PAGE.md), [Events Provenance Model](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md), [Resource Mutation Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md)
**Blast radius:** High. Touches server event routing, watcher lifecycle, WebSocket protocol, client resource cache, and multiple built-in views.
**Execution model:** Spec-first. Build the event contract and audit map before behavior changes. Implement in small vertical slices with smoke checks after each migrated view.

**Schema correction authority:** [2026-07-15 provenance cross-article findings](provenance-schema-findings.md) plus owner direction in chat on 2026-07-15. This SPEC supplies the concrete generator/consumer contract for mechanical finding 2; decision-tagged findings remain open.

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
- **UEB is the canonical provenance firehose.** Canonical subscriber filters decide relevance; event producers must not discard accepted facts before those subscribers can filter. Operational watcher, workspace, and trigger behavior remains independently fail-open.
- **React sync is system behavior, not TRIGGERS.md behavior.** Resource sync consumes accepted canonical UEB events plus its defined recovery path; operational trigger matching neither controls nor depends on that provenance path.
- **Preserve rich event metadata.** Sibling files/folders, parent names, stats, line counts, and token counts belong in the canonical event envelope unless explicitly omitted with a reason.
- **Every mutation path attempts the canonical UEB producer.** Successful provenance flows through that single canonical source of truth. Unexpected post-mutation validation/publication failure is diagnosed and uses the non-canonical freshness recovery contract for render state; it does not suppress already-valid operational watcher/trigger behavior or create a second canonical fact.
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
| Mutation routing | `workspace-request-handlers.js` has `OFFICE_PANEL`, `mutationPanels`, and direct `file_changed` broadcasting. `file-explorer.js` defaults missing panels to `file-viewer`. | File mutations can bypass canonical enrichment, origin capture, and consistent client invalidation. | All mutation commands call one canonical `resource:*` producer. Accepted facts emit on UEB; failed post-mutation candidates record diagnostics and invoke only `resource:refresh_required`. |
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
| RSC-I09 | Trigger watcher behavior and provenance failure during workspace switch were underspecified. | Binding trigger execution to canonical admission lets provenance failure suppress valid automation; failing to repoint the operational watcher can also drop real observations. | RESOLVED BY RSC-D09: keep one operational watcher/trigger path, repoint it from the authoritative operational workspace transition, and treat canonical resource/automation publication as independent observation. |
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
| RSC-D05 | Which views belong in `viewRefs`? | DECIDED: matching active-workspace enabled views. | `viewRefs` includes only enabled views whose central resource policy maps the event to affected cache keys; enabled but unrelated views are excluded. Enabled views are active workspace view-registry entries accepted by the central resource policy module's canonical `isViewEnabled(workspaceId, viewId)` decision. For Slice 32b/32c, that predicate must read the same registry/workspace-state fields on server and client; hidden, mounted, open, visible, or cached state affects warm behavior, not whether a resource can be mapped to a view. Renderer `viewRefs` and `resource:invalidate` messages are delivered only to clients whose active workspace matches `event.ids.workspaceId`. In this build, null-workspace events are only `workspace.switched` transitions to no active workspace, and they follow the workspace-switch delivery rule, not global broadcast. Ledger, automation-provenance, and versioning subscribers still consume all canonical events they are authorized to see; operational file-change trigger execution remains governed by RSC-D09. |
| RSC-D06 | What is the minimum resource policy contract for slice 32b/32c? | DECIDED: root, tree key, content key, patterns, refresh mapping, and warm rules. | Start with `file-viewer` and `wiki-viewer`; expand once the contract works for those. |
| RSC-D07 | How should subtree invalidation work? | DECIDED: lazy prefix invalidation of known cached descendants, with refetch on demand. | Eager rewrite is more complex; clearing all descendants is simpler but can lose state if overused. |
| RSC-D08 | What should happen when the active Wiki page is deleted, renamed, or moved? | DECIDED: preserve selection for rename/move when the resulting page still exists; otherwise select nearest valid fallback. | Fallback order: renamed/moved path, nearest existing parent page, previous valid history entry, wiki root, then empty-state if no wiki root exists. |
| RSC-D09 | Does canonical provenance admission control TRIGGERS.md file-change execution? | DECIDED: No. | Preserve the existing single workspace-watcher file-change matcher; mutation-conversion Slice 32d must not invoke, repoint, recompile, or duplicate it. Watcher-lifecycle Slice 32e exclusively repoints/recompiles it from permanent `workspace:operational_switched`. An established watcher observation reaches applicable trigger matching exactly once without awaiting provenance. The canonical resource branch consumes that observation independently. While `AUT-D02` is open, later file-trigger automation provenance omits the resource ID relationship; after closure it may use only the approved non-wait accepted-ref handoff. Candidate/redaction/validation/publication failure cannot suppress or duplicate trigger execution. Other trigger kinds retain their current operational ingress until an owning migration defines equivalent fail-open semantics. |
| RSC-D10 | What proof is required after each migration slice? | DECIDED: automated tests where practical plus manual event-flow logs for runtime paths. | Each slice records tests run, manual log captures or screenshots when relevant, temporary adapters left in place, and removal criteria. Slice 32a can use a companion audit report because it is discovery-only. |
| RSC-D11 | May token counting delay an operation or renderer invalidation? | DECIDED: no synchronous tokenization in either critical path. | Include a token count only when the accepted operation or an existing cache already provides it. Otherwise set `before.omissions.tokenCount` / `after.omissions.tokenCount = 'not_observed'` for supported text, `too_expensive` for text over 512 KiB, `not_supported` for binary/unsupported resources, or `redacted` for redacted resources. Whole-state failures use `ResourceStateUnavailable.omissionReason`. Deferred token-stat events are outside this spec. |
| RSC-D12 | What is the source of truth for active UI context? | DECIDED: renderer command-time panel/tab/doc stores provide non-ID context evidence only when bound to the same server-issued workspace command context as the accepted operation. | UI-origin commands capture renderer context before send, but renderer workspace/root/cache values are fallible evidence. The server coordinator owns the command's workspace ID/root/transition capability. Missing/stale/mismatched workspace context omits renderer-derived canonical context/resources with a diagnostic and never blocks the command. Server-side context inference remains fallback only for non-UI paths. |
| RSC-D12a | Which exact UI store selectors feed command-time context? | DECIDED for the first adapter pair: Wiki and File Viewer mappings are normative in SPEC-34 and the UI-context wiki child pages. Later views remain blocked until their own mappings are added. | Wiki reads only `useWikiStore.getState().viewedPagePath` for both active document/resource path and does not read `selectedPath` during send capture. File Viewer derives active tab/path only from workspace-scoped `usePanelStore.viewStates['file-viewer'].activity`, never global `useFileStore.activeTabPath`. Both use literal view/panel IDs. Canonical workspace/thread/cause/resource relationship IDs are server-owned and absent from renderer provenance input. `route` and `selectedResourceId` are explicit `null`; do not synthesize values. |
| RSC-D13 | How do multi-client events identify initiator versus receivers? | DECIDED for first-package routing only: opaque connection and lifecycle-epoch references remain private transport state; durable multi-client audit identity remains deferred. | `connectionId`, `clientId`, receiver IDs, and lifecycle epochs are not canonical context or ledger fields. They are not authorization, stable identity, or causality. A delivery-time epoch check prevents an older queued lifecycle fact/recovery from applying to an initiator after a newer transition. Missing/stale routing state skips or reconciles only renderer freshness work; provenance and the source interaction never depend on it. |
| RSC-D14 | Should `fileDataStore` become `resourceStore`, or should `resourceStore` wrap it? | DECIDED: first implementation adds a `resourceStore` facade/wrapper over existing `fileDataStore`. | Avoid a broad rename during event migration. Migrated views and `resource:invalidate` handlers use the `resourceStore` API boundary; internals can still delegate to `fileDataStore` until a later cleanup. |
| RSC-D15 | Is future SQLite file versioning folded into this build or kept in SPEC-33? | DECIDED: keep implementation in SPEC-33; SPEC-32 only preserves event identity, provenance, and before/after resource-state metadata hooks. | Owner can still decide to fold it back in later, but that is an explicit scope expansion. |
| RSC-D16 | What bounded watchdog deadlines govern watcher close diagnostics, current-generation readiness, and reconciliation? | OPEN - OWNER APPROVAL REQUIRED before Slice 32e. | Approve exact positive millisecond values, monotonic clock/timer ownership, configuration location, test override, boundary behavior, cancellation on generation change/shutdown, and diagnostic/recovery dedupe. Ready/reconciliation timeout must enter `degraded_recovery_pending` and issue exactly one current-generation freshness recovery; close timeout is diagnostic/resource-cleanup only. No default may be invented, and none may block workspace FIFO or provenance. |
| RSC-D17 | What bounded lifecycle governs the detached workspace-context-token metadata executor and live token bindings? | OPEN - OWNER APPROVAL REQUIRED before Slice 32b0 implements or activates token allocation. | Approve exact global and per-connection queue item/byte caps; concurrency and connection/workspace fairness; enqueue admission/eviction/drop behavior; wrapper cancellation/finalizer deadline and treatment of an abort-ignoring or never-settling provider; per-job retained context/route/provider byte and lifetime caps; live-token binding count/byte caps and cleanup; saturation diagnostics; shutdown deadline/disposition; and restart behavior. Define the exact measured job/binding representation and encoding, object/container/provider-wrapper overhead, shared-reference apportionment, queued/active/cancelling/live-binding ownership, charge/release transition points, cap precedence, and a bounded measurement algorithm that never serializes or traverses beyond cap-plus-one. Overflow, cancellation, exhaustion, or capacity failure may only omit current token metadata with a fixed value-free diagnostic; it never retries, retains an unbounded provider/job, or delays/alters init, transitions, panels, prompts, reconnect, disconnect, shutdown, or any source operation. No capacity/accounting/default may be invented. |

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

`eventId` is the unique canonical event/graph identity. `eventFamily` plus dotted `eventType` classifies the event. Colon strings are UEB bus topics or transport messages, not canonical classification or identity.

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

Canonical event classification and domain operations intentionally use operation vocabulary:

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

Canonical `workspace:switched` is enabled only after Slice 32b0's atomic topic fence. Before that gate, active `workspace-controller.js`/`workspace-ribbon.js` producers, `server.js` per-session root/workspace projection, `workspace-broadcaster.js`, and the legacy event-ledger path use/recognize the operational `{from,to,repoPath}` shape on the existing name. Slice 32b0 moves every operational producer/consumer together to permanent private `workspace:operational_switched`, removes workspace switching from the legacy ledger record whitelist, and proves all other old-shape listeners are moved or fenced before any canonical publisher can emit `workspace:switched`. The operational transport is owned by the workspace subsystem for coordinator-authoritative root resolution, best-effort session display caches, synchronous baseline switch notification, reconnect/snapshot recovery, and later watcher generation changes; it is never canonical or persisted and cannot enter accepted-only subscribers. It has no provenance retirement requirement. A future replacement must explicitly preserve those functions. The canonical topic carries only the registered frozen envelope and never enters the operational broadcaster or legacy storage path.

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

type LifecycleProvenance = {
  source: { type: string; module: string };
  origin: { type: EventOriginType; id?: string };
  observedBy: { type: string; module: string };
  confidence: 'direct' | 'correlated' | 'inferred' | 'unknown';
  cause?: ResourceCauseProjection;
};

type LifecycleRedaction =
  | { status: 'not_required'; policyId: 'lifecycle-metadata-v1'; policyVersion: '1' }
  | { status: 'applied'; policyId: 'lifecycle-metadata-v1'; policyVersion: '1'; omissions: readonly [string, ...string[]] };

type LifecycleActor = { type: 'human' | 'assistant' | 'system' | 'external' | 'unknown' };

type WorkspaceSwitchedEvent = {
  schemaVersion: 1;
  eventId: string;
  eventFamily: 'workspace';
  eventType: 'workspace.switched';
  occurredAt: number;
  ids: LifecycleEventIds & { previousWorkspaceId: string | null };
  actor: LifecycleActor;
  provenance: LifecycleProvenance;
  redaction: LifecycleRedaction;
  workspace: {
    reason: 'startup' | 'user_switch' | 'reload' | 'system';
  };
};

// `ids.workspaceId` and required-nullable `ids.previousWorkspaceId` identify the transition.
// Absolute/local workspace roots remain operational routing state and never enter the canonical lifecycle event.
// Workspace-switch renderer delivery is evaluated after the server records the receiver connection's
// post-switch active workspace. Send the lifecycle invalidation to the switching connection and to
// any other connection whose active workspace already matches `ids.workspaceId`; do not use the
// previous workspace match to route post-switch invalidation.

type ViewRegistryChangedEvent = {
  schemaVersion: 1;
  eventId: string;
  eventFamily: 'view';
  eventType: 'view.registry_changed';
  occurredAt: number;
  ids: LifecycleEventIds & { workspaceId: string };
  actor: LifecycleActor;
  provenance: LifecycleProvenance;
  redaction: LifecycleRedaction;
  viewRegistry: {
    reason: 'view_added' | 'view_removed' | 'view_updated' | 'registry_reloaded';
    affectedPanels?: string[];
    affectedResources?: Array<{ path: string; resourceType: 'view' | 'config' | 'registry' }>;
  };
};

type ThemeChangedEvent = {
  schemaVersion: 1;
  eventId: string;
  eventFamily: 'theme';
  eventType: 'theme.changed';
  occurredAt: number;
  ids: LifecycleEventIds & { workspaceId: string };
  actor: LifecycleActor;
  provenance: LifecycleProvenance;
  redaction: LifecycleRedaction;
  theme: {
    affectedPanels?: string[];
    affectedFiles?: string[];
    affectedResources?: Array<{ path: string; resourceType: 'style' | 'config' }>;
  };
};
```

The first package registers lifecycle publication only for an operation accepted from a live initiating connection. The active producer set below uses only `reason: 'user_switch'`. The schema reserves `startup|reload|system`, but 40b1a does not authorize a producer/reason pair for them; they cannot publish until a later registry update names an exact connection-bound producer and tests its routing. It does not register a headless/global lifecycle producer. A later headless/global producer must define its own recipient, null-workspace, recovery, and stale-delivery semantics before registration.

| Active operational ingress/branch | Transition | Canonical reason | Initiator contract |
|---|---|---|---|
| `workspace:switch_requested` -> `handleSwitchRequested` | current -> requested workspace | `user_switch` | Preserve the requesting WebSocket's opaque route context through controller completion. |
| `workspace:create_requested` -> successful create/activate | current -> created workspace | `user_switch` | Preserve the create request's opaque route context. |
| `workspace:remove_requested` when removing active | active -> deterministic fallback or null | `user_switch` | Preserve the remove request's opaque route context through fallback selection. |
| `workspace:ribbon_remove_requested` when removing active ribbon entry | active -> next ribbon workspace or null | `user_switch` | Preserve the ribbon request's opaque route context through `workspace-ribbon.js`. |
| `workspace:ribbon_add_requested` when current workspace is null | null -> restored ribbon workspace | `user_switch` | Preserve the ribbon request's opaque route context through `workspace-ribbon.js`. |

Invalid/unknown requests, same-workspace switch requests, removal of a non-active workspace, ribbon changes that do not change active workspace, and ordinary add-without-activation emit no canonical workspace lifecycle fact. No current startup, reload, or headless branch is silently mapped to a reason.

At WebSocket ingress, the connection manager converts server-owned `connectionId` to an opaque `WorkspaceOperationRouteContext` containing `ConnectionRouteRef`; the request object may carry that nonserializable capability as private operational state, never as canonical/renderer/ledger metadata. Synchronous ingress enqueues the complete switch/create/remove/ribbon intent plus this route context in the single workspace transition coordinator before any asynchronous lookup or active-state read. Every controller/ribbon branch preserves it. Only when that intent reaches the head of the coordinator queue may it resolve registry state and capture the authoritative pre-operation workspace. After the coordinator's operational transaction, memory commit, and synchronous private transition dispatch complete, the connection manager advances that connection's lifecycle generation with the exact coordinator-produced `(previousWorkspaceId, workspaceId)` pair and returns the bound `LifecycleRouteEpochRef`; the producer captures the two refs plus both transition values in `FrozenLifecycleRouteSnapshot` and schedules provenance. A disconnect after accepted ingress does not erase the completed canonical fact; it only makes renderer routing non-current. If ingress lacks a live route capability, operational behavior and the operational notification/recovery rules continue, but first-package canonical lifecycle publication is omitted with `initiator_route_unavailable`; no branch substitutes a different connection or raw ID.

### Operational Workspace Transition Sequencer

Slice 32b0 introduces one workspace-subsystem-owned FIFO transition coordinator before the topic cutover. Every active-workspace mutation ingress uses it: `switch_requested`, create-and-activate, active remove fallback/null, active ribbon remove fallback/null, and ribbon add from null. The generic EventBus may deliver request listeners without awaiting their promises, so each registered listener must synchronously call `enqueueWorkspaceTransition(intent)` and return; it must not begin lookup/mutation work before enqueue. `workspace-controller.js` and `workspace-ribbon.js` lose all direct writes to `activeWorkspaceId`, `activeWorkspace`, last-active settings, or operational switch emission. Non-active registry/ribbon edits may keep their own bounded path only when they cannot change active selection; any branch that can do so re-enters the coordinator.

At the head of the FIFO, the coordinator performs target/fallback lookup, no-op validation, and captures `from` from the last committed state. It assigns an opaque monotonically ordered transition capability, never a canonical/renderer/ledger ID. Switch persistence and active registry mutation use one database transaction: create/remove/ribbon registry changes that affect selection and the last-active setting commit together. On transaction failure, memory and operational transition output remain at the prior committed state and the request receives the existing bounded operational failure behavior. After a successful database commit, the coordinator atomically updates `activeWorkspaceId` and cached `activeWorkspace`, constructs the exact adjacent `{ from, to, repoPath, transitionCapability }`, and calls dedicated private synchronous `dispatchOperationalWorkspaceSwitched`. The permanent name remains `workspace:operational_switched`, but this ordering-critical dispatcher is not the generic unawaited EventBus and accepts no Promise/thenable-returning hook.

The coordinator itself synchronously updates the authoritative workspace/root routing source before dispatch; per-session copies are caches, and every workspace-scoped command resolves against the coordinator source or its captured command-context ref rather than trusting a stale cache. A per-session cache assignment failure marks only that cache stale and forces recomputation/reconnect snapshot; it cannot retain A as authorization/target state. The broadcaster hook invokes at most one baseline wire notification attempt for the pair using no async enrichment. Queue/send failure records a bounded diagnostic and relies on the next connection/reconnect authoritative workspace snapshot plus `lifecycle:refresh_required`; it does not retry the same notification or claim exactly-once delivery. Healthy delivery remains exactly one. After RSC-D16 closes, the Slice-32e watcher hook synchronously verifies the pair, invalidates A, installs B/null generation bindings/listeners, starts close/readiness/reconciliation tasks plus their approved monotonic watchdogs under the supervised executor, and returns a non-Promise acknowledgment. Each task checks generation after every await, stale work no-ops, and a current ready/reconciliation throw or watchdog expiry enters explicit `degraded_recovery_pending` with bounded deduped diagnostics and exactly one direct freshness recovery. Close expiry is diagnostic/resource cleanup only. A later transition synchronously cancels/invalidates prior watchdogs/state and proceeds.

Unexpected throw or thenable return from any synchronous dispatcher hook is caught per hook, diagnosed, and mapped to the hook-specific recovery above; remaining hooks still run once and the coordinator starts the next intent. No dispatcher hook, diagnostic, recovery send, watcher close/readiness, broadcaster send, or provenance work is awaited by the FIFO. Canonical lifecycle preparation is supervised only after synchronous operational dispatch and never participates in commit or ordering.

The dispatcher admits only the next capability from its coordinator and each synchronous hook acknowledges the same immutable adjacent pair. Duplicate, missing, reordered, or forged capabilities are diagnosed and do nothing. Thus concurrent `B`/`C` requests have one ingress FIFO order; database, authoritative memory/session routing, notification attempts, watcher generation invalidation, and later canonical observations see the same adjacent sequence without liveness depending on hook promises. Startup restoration completes before request listeners open and initializes coordinator revision zero; it is not raced through this queue.

Dispatcher hooks are a closed registry of audited workspace-subsystem module/export pairs. They may perform only bounded in-memory validation/state assignment, watcher construction/listener attachment, and direct nonblocking enqueue/send invocation. Synchronous filesystem/database/network/style lookup, unbounded iteration/CPU, user/plugin callbacks, and reentrant workspace mutation are prohibited. No in-process contract can recover from a function that never returns synchronously; code review, the closed registry, static checks, and unit tests enforce that such work is absent. The liveness guarantee covers hook throws, returned thenables (rejected without observation), and all detached async/background work.

The operational broadcaster no longer owns a serialized async transition queue or awaits registry/style/theme work. From the committed transition and already-available cache only, its synchronous hook constructs the baseline workspace identity/root notification and invokes each receiver's outbound send/enqueue at most once. Healthy delivery is exactly one. Missing style enrichment sets the existing/updated explicit styles-pending/refetch branch so the renderer fetches current styles independently; it does not delay the switch notification. Invocation throw/queue rejection/send completion failure is diagnosed, never retried for that pair, and recovers through authoritative reconnect snapshot plus `lifecycle:refresh_required`. Independent later notifications cannot be stranded behind an earlier Promise.

### Workspace Root Consumer Authority Gate

Slice 32b0 creates `fusion-studio-server/lib/workspace/workspace-root-consumers.v1.json` and a closed schema. The inventory contains every production occurrence/closure/factory that reads `session.projectRoot`, `session.currentWorkspaceId`, a captured initial `projectRoot`, `getProjectRoot(ws)`, `getActiveWorkspace*`, or an equivalent workspace-root/ID cache. Each sorted entry names exact module/export, command family, use (`authorization|target_resolution|display_cache|workspace_neutral`), replacement authority (`coordinator_command_context|explicit_workspace_argument|cache_only`), migration status, and test evidence. A bidirectional AST/static inventory fails on any unregistered occurrence or stale registered location.

The coordinator exposes `captureWorkspaceCommandContext(connectionRef)` returning an opaque nonserializable ref privately bound to frozen `{ workspaceId, workspaceRoot, transitionCapability }` at operation acceptance. Authorization and target-resolution paths must consume that ref or an explicit already-authorized workspace argument; they never trust session caches or live-look up a newer root mid-command. Async paths reverify the bound ref before irreversible effects without requiring it to remain the current UI workspace. Per-session fields are display caches only, carry the matching capability privately, and on missing/mismatch/assignment failure recompute from coordinator authority or use the command ref. Root-bound factories are rebuilt from the ref/explicit argument or proven workspace-neutral; startup-root closures cannot handle later commands.

### Isolated Provenance E2E Launcher

Slice 32b0 adds shared `fusion-studio-client/playwright.provenance.config.ts`, `fusion-studio-client/e2e/provenance-test-server.cjs`, and `fusion-studio-client/e2e/run-provenance-playwright.cjs`. The launcher creates one unique OS-temp run root containing only `user-data/`, `workspace/`, and the startup-marker path; it separately creates a nonce-scoped cleanup-receipt path outside that root. It exports both paths plus nonce/port, invokes the requested Playwright test, and afterward verifies the managed server exited, the run root is absent, and the outside-root receipt matches the nonce; it records then deletes the receipt. The config requires those launcher variables, uses `baseURL: 'http://127.0.0.1:43132'`, and defines `webServer = { command: 'node e2e/provenance-test-server.cjs', url: 'http://127.0.0.1:43132', reuseExistingServer: false }`; an occupied port fails rather than reusing a process. The wrapper sets `PORT=43132` and `FUSION_APP_USER_DATA=<run-root>/user-data`, spawns `../fusion-studio-server/server.js`, forwards termination, waits for exit, removes the run root, and atomically writes only the outside receipt. Its in-root marker contains PID, port, resolved DB/user-data/fixture paths, and nonce, with containment checks. Tests register/select only the isolated fixture database/workspace and assert marker/process/path identity plus cleanup.

Before 32b0 adds tokens to `workspace:init`, operational `workspace:switched`, `workspace:context_token`, or later `panel_config`, it removes renderer inbound WebSocket payload/type logging from `fusion-studio-client/src/lib/ws-client.ts` and the complete-object log in `src/lib/ws/workspace-handlers.ts` for these message families. No console/debug/logger/redactor/formatter/stringifier or logging executor is called from their receive/handler stack before or after dispatch. Observability is limited to module-private saturating counters keyed by a closed compile-time safe-type enum; the handler increments its counter only after applying the original message, and overflow stays at `Number.MAX_SAFE_INTEGER`. Counter update is fixed O(1), throws nowhere, serializes/persists nothing, and contains no token/value. Unknown types use one `unknown` counter. Add `fusion-studio-client/src/provenance/__tests__/workspace-command-token-log-redaction.test.ts`; cover init/switch/context-token/panel-config and every registered/unknown type, duplicate/wrong-path/malformed/array/inherited token keys, arbitrary nested sentinels, zero logger/redactor/formatter/stringifier calls, exact counter saturation, and successful original handling before the counter update.

The renderer token owner is exactly `fusion-studio-client/src/lib/ws/workspace-command-context-token.ts`, a module-private memory-only slot `{ socket: WebSocket, workspaceId: string | null, projectRoot: string | null, token: WorkspaceCommandContextToken } | null`. It is not Zustand/panel state, `workspaceState`, panel config, view state, a state-push field, local/session storage, IndexedDB, URL/history state, Electron persistence, or any serialized snapshot. `installWorkspaceCommandContextToken(socket, workspaceId, projectRoot, value)` accepts only the current OPEN socket, exact token syntax, and workspace/root equal to the atomic client state. Every `workspace:init` or operational `workspace:switched` synchronously clears the prior slot before optional validation/install, so an absent/malformed degraded message cannot retain an older token; exact-current `workspace:context_token` also clears-before-installs, while `panel_config` never installs one. `readWorkspaceCommandContextToken(socket)` returns a token only for exact object identity with the current OPEN socket and still-equal workspace/root. Connection replacement, `close`, explicit `disconnectWs`, and shutdown synchronously call `clearWorkspaceCommandContextToken(socket)` before changing the global socket/store, scheduling reconnect, or allowing another prompt read. A new socket begins with null and cannot reuse workspace-cached state. Clear/install/read failure omits the prompt token and never delays or changes the prompt/workspace operation.

The initial workspace state is one atomic wire message. Immediately before send, capture the final coordinator snapshot with no later await; synchronously build `panelRoots` from that snapshot's root; and include `projectRoot`, workspace identity/registry fields, `panelRoots`, and `panelConfigStatus: 'ready' | 'unavailable'` together in `workspace:init`. A recipient token is included only when the detached allocator below has already completed for this exact snapshot; init/switch never waits or calls entropy. The opaque token binds the exact connection, coordinator transition capability, workspace ID, and root; no separate client-visible revision/counter is introduced. Remove the separate connection-open-root `buildPanelConfig(projectRoot)` startup send. If panel-root construction throws, send the same internally consistent init with `panelRoots: {}` and `panelConfigStatus: 'unavailable'`, then use the metadata-only current-context refetch path below; never reuse earlier-root output. The client applies these fields atomically.

After owner-approved `RSC-D17`, connection-context creation and each committed transition synchronously invalidate the old binding and offer one allocation job to the D17-bounded dedicated token-metadata executor without awaiting or joining it to init/switch serialization, baseline broadcast, coordinator completion, or any source-operation promise. Before D17 closes, Slice 32b0 may not implement or activate token allocation. Admission, retained context/provider ownership, concurrency, saturation, cancellation/finalization, live bindings, and shutdown follow D17's exact caps and disposition. An unadmitted, evicted, cancelled, expired, or otherwise failed job installs/sends nothing, releases all executor-owned context under D17, records only its approved fixed value-free diagnostic, and never retries. Each admitted job makes at most four attempts with an abort-aware asynchronous 32-byte CSPRNG provider; throw/rejection or live-set collision consumes an attempt. Context supersession/disconnect takes D17's exact cancellation/finalizer path even if an injected provider never settles; late provider completion has no retained route authority. Success re-verifies the exact live connection/transition/workspace/root, atomically installs the unique binding within D17's live-binding caps, and sends metadata-only `{ type: 'workspace:context_token', workspaceId, projectRoot, workspaceCommandContextToken }` directly to that recipient. The client accepts it only on the exact current socket when workspace ID/root equal its atomic state, then clears-before-installs its ephemeral slot; it changes no workspace/panel/operation field. Missing/mismatched/stale/late messages are ignored. Four failures record exact value-free `workspace_context_token_unavailable/entropy_or_collision_exhausted`, install/send nothing, and make no fifth attempt. Shared broadcaster data/buffers never contain the token. Thus paused/throwing/saturated token metadata cannot delay a workspace notification; a prompt simply omits the token until a current metadata update arrives.

A panel change and a panel-metadata refresh are distinct commands. Operational `{ type: 'set_panel', panel: RegisteredPanelId }` selects the panel and performs its existing session/thread effects exactly once. Connection open no longer sends it from `ws.onopen`; after the atomic `workspace:init` applies/restores client state, the init handler is the sole initial issuance point and sends it once for the registered restored/current panel. A later explicit human panel change sends it once. Neither startup metadata construction nor metadata recovery may call or re-enter `set_panel`.

The exact metadata-only request is `{ type: 'request_panel_config', panel: RegisteredPanelId }`. Its handler may only resolve/send panel configuration: it cannot mutate session root/current panel, call `ThreadWebSocketHandler.setPanel`, list threads, emit `panel_changed`, acknowledge a user operation, or invoke any other panel-selection side effect. `rootFolder`, `projectRoot`, `workspaceId`, `panelRoot`, and token fields are forbidden as client authority on both request types. Unknown extra root/identity fields are ignored and diagnosed without their values while a valid `set_panel` continues; a metadata request remains metadata-only. At metadata-request acceptance the server synchronously captures one `WorkspaceCommandContextRef` plus its current recipient token before any await. It resolves the registered panel root only from that ref's coordinator-owned workspace root, requires the result to be null or an absolute path contained by that root, and sends only after re-verifying that the same ref/token is still current. A stale result is discarded and schedules one coalesced metadata-only `request_panel_config` retry/current server push for the latest token; it never sends earlier-root data or invokes `set_panel`.

The exact later response is `{ type: 'panel_config', panel, workspaceId, projectRoot, panelRoot, panelConfigStatus, workspaceCommandContextToken? }`, where every workspace field and any already-available token come from that one server snapshot and `panelConfigStatus` is `'ready' | 'unavailable'`. When a token is present, the client requires exact equality with its current token, workspace ID, and project root; when token allocation is still unavailable, the response can only set status `unavailable` and cannot change a panel root. A successful ready response also requires a registered panel name and updates only `panelRoots[panel]` plus that panel's status. It never changes `projectRoot`, workspace ID, the token, or another panel from `panel_config`; only atomic `workspace:init`, authoritative operational workspace snapshot, or exact `workspace:context_token` may replace token state. Missing/malformed/mismatched context, an outside-root resolution, or unavailable root/token is ignored with a value-free diagnostic and one coalesced metadata-only refetch. Per `(token-or-null,panel)`, at most one request is in flight and one automatic recovery attempt is allowed; a new token resets/cancels that state, success clears it, and failure of the automatic attempt leaves metadata unavailable until a new token, authoritative server push, or explicit human panel action. It never schedules another automatic attempt for that pair. These metadata failures never reject, delay, retry, suppress, duplicate, or alter the valid `set_panel` operation or other user interaction. Thus neither a matched token nor any client-supplied path can overwrite B/null state with A or outside-workspace roots.

### Canonical Resource Mutation Event

Resource events preserve facts. Subscribers filter them.

The canonical UEB resource mutation event follows the shared Events And Ledger provenance envelope. It is consumed by ledger, metadata, future versioning, and resource-sync subscribers. TRIGGERS.md file-change execution remains on its one operational workspace-watcher matcher; canonical automation/resource consumers may correlate its accepted facts but do not initiate the trigger.

```ts
type ResourceMutationIds = {
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
};

type ResourceMutationPayloadCommon = {
  resourceEventId: string;
  resourceId?: string;
  resourceType: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
  path: string;
  hashOmissions?: {
    contentHashBefore?: OmissionReason;
    contentHashAfter?: OmissionReason;
  };
  sizeBefore?: number;
  sizeAfter?: number;
  symlink?: { target?: string; broken: boolean };
};

type ResourceAcceptedRedaction =
  | { status: 'not_required'; policyId: 'resource-metadata-v1'; policyVersion: '1'; omissions?: never }
  | { status: 'applied'; policyId: 'resource-metadata-v1'; policyVersion: '1'; omissions: readonly [string, ...string[]] };

type ResourceMutationEventCommon = {
  schemaVersion: 1;
  eventId: string;
  eventFamily: 'resource';
  occurredAt: number;

  ids: ResourceMutationIds;

  actor: {
    type: 'human' | 'assistant' | 'trigger' | 'scheduler' | 'script' | 'sync' | 'import' | 'agent' | 'system' | 'external' | 'unknown';
  };

  provenance: {
    source: { type: string; module: string };
    origin: { type: EventOriginType; id?: string };
    observedBy: { type: string; module: string };
    confidence: 'direct' | 'correlated' | 'inferred' | 'unknown';
    cause?: ResourceCauseProjection;
  };

  context?: {
    scope?: 'ui' | 'headless' | 'harness' | 'system' | 'external';
    viewId?: string;
    panelId?: string;
    route?: string | null;
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

  resources: Array<{
    role: 'subject' | 'parent' | 'old-parent' | 'new-parent' | 'related';
    resourceId?: string;
    resourceType: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
    path?: string;
    oldPath?: string;
    relatedEventId?: string;
    resourceEventId?: string;
  }>;

  redaction: ResourceAcceptedRedaction;

};

type ResourceMutationEventFor<
  EventType extends 'resource.created' | 'resource.changed' | 'resource.deleted' | 'resource.renamed' | 'resource.metadata_changed',
  Operation extends 'create' | 'modify' | 'delete' | 'rename' | 'metadata',
  OperationFields extends object
> = ResourceMutationEventCommon & { eventType: EventType } & (
  | {
      eventPhase: 'complete';
      ids: Omit<ResourceMutationIds, 'serverMutationId'> & { serverMutationId: string };
      resourceMutation: ResourceMutationPayloadCommon & OperationFields & {
        operation: Operation;
        observedAt?: never;
        observerEventType?: never;
      };
    }
  | {
      eventPhase: 'observe';
      ids: Omit<ResourceMutationIds, 'serverMutationId'> & { serverMutationId?: never };
      resourceMutation: ResourceMutationPayloadCommon & OperationFields & {
        operation: Operation;
        observedAt: number;
        observerEventType: Operation;
      };
    }
);

type ResourceMutationEvent =
  | ResourceMutationEventFor<'resource.created', 'create', { oldPath?: never }>
  | ResourceMutationEventFor<'resource.changed', 'modify', { oldPath?: never }>
  | ResourceMutationEventFor<'resource.deleted', 'delete', { oldPath?: never }>
  | ResourceMutationEventFor<'resource.renamed', 'rename', { oldPath: string }>
  | ResourceMutationEventFor<'resource.metadata_changed', 'metadata', { oldPath?: never }>;

type ResourceStateSnapshot = ResourceStatePresent | ResourceStateAbsent;

type ResourceStatePresent = {
  exists: true;
  resourceId?: string;
  resourceType: 'file' | 'folder' | 'symlink' | 'view' | 'style' | 'config' | 'registry';
  path: string;
  name?: string;
  parentPath?: string | null;
  parentName?: string | null;
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

type OmissionReason = 'not_applicable' | 'not_observed' | 'too_expensive' | 'not_supported' | 'redacted' | 'policy_unapproved' | 'unknown';

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

For first-package resource candidates, every successful `not_required` or `applied` resource redaction envelope uses exact string literals `policyId: 'resource-metadata-v1'` and `policyVersion: '1'`. Until ULV-D10 or a separate owner-approved content-hash policy closes, `resourceMutation.contentHashBefore`, `resourceMutation.contentHashAfter`, and every `ResourceStatePresent.contentHash` are prohibited even when a producer already computed them. Omit them and set the corresponding `hashOmissions`/`omissions.contentHash = 'policy_unapproved'`; first-package redaction/validation rejects a candidate that retains any content-derived hash. Resource redaction failure emits no canonical resource fact and follows the defined mutation/watcher freshness recovery branch.

`resourceMutation.resourceEventId` is the resource-mutation domain ID. It is not a replacement for the top-level canonical `eventId`; ledger/storage links should preserve both when both are present.

`automationRef` is not part of the first-package resource event or render projection. SPEC-37 plus SPEC-40b2c may add a registered resource-event extension in a later package; until then automation kind may support honest non-ID origin classification, but automation IDs/mirrors are absent.

View and panel fields belong under `context`, not inside `resourceMutation`. `ids` carries thread, turn, `rootEventId`, `parentEventId`, correlation, and causation identity. `provenance.cause` carries only durable upstream initiator IDs.

Canonical resource path semantics:

- `delete`: `resourceMutation.path` is the deleted path.
- `rename`: `resourceMutation.path` is the new path, and `resourceMutation.oldPath` is the previous path.
- Other operations use the current subject path in `resourceMutation.path`.

Canonical resource paths are workspace-relative unless explicitly named `absolutePath`. This applies to `resourceMutation.path`, `resourceMutation.oldPath`, `before.path`, `after.path`, and `resources[].path`. Renderer `viewRefs[].path` remains panel-relative and must not be copied back into the canonical resource payload.

`ResourceStateAbsent.path` is required for create/delete absent sides: use the created path for `before` on create and the deleted path for `after` on delete. If even that identity is unavailable, use `ResourceStateUnavailable` with an explicit omission reason instead of `ResourceStateAbsent`.

Before/after rules:

- `create`: `before` uses `ResourceStateAbsent`; `after` contains the created resource state or `ResourceStateUnavailable`. The new parent listing is carried in `after.siblings` or `parentListings.after` when available. If `after` is a state snapshot and only sibling data is missing, record that as `after.omissions.siblings`; if `parentListings.after` is missing, record `parentListingOmissions.after`; if `after` is unavailable as a whole, use `ResourceStateUnavailable.omissionReason`. Projections may mirror canonical omission reasons into `parentOmissions`, but canonical events must not rely on projection-only omissions.
- `modify`: `before` and `after` use the same path, with changed size/stats and, only after an approved hash policy, hash; otherwise hashes use explicit `policy_unapproved` omissions.
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

  event: 'modify' | 'create' | 'delete' | 'rename' | 'metadata';
  source: ResourceMutationEvent['provenance']['source'];
  observedBy: ResourceMutationEvent['provenance']['observedBy'];

  origin?: EventOriginProjection;
  ids: Pick<ResourceMutationEvent['ids'], 'workspaceId' | 'threadId' | 'turnId' | 'rootEventId' | 'parentEventId' | 'correlationId' | 'causationId' | 'serverMutationId'>;
  context?: Pick<NonNullable<ResourceMutationEvent['context']>, 'scope' | 'viewId' | 'panelId' | 'route' | 'activeTabId' | 'activeDocumentPath' | 'activeResourcePath' | 'selectedResourceId'>;
  cause?: ResourceCauseProjection;
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

The immediate mutation projection performs no workspace-registry lookup. It uses the accepted event plus the ref-keyed immutable resource-policy snapshot defined below; `workspaceRoot` is absent from mutation and lifecycle canonical records. Operational workspace-switch routing may use server-owned roots outside provenance. Any later non-immediate projection that needs a root resolves it outside canonical payloads and records omission independently.

### Resource Policy Snapshot Sidecar

Before resource admission, the producer reads the already-loaded central resource-policy generation synchronously without I/O and canonical-clones/deep-freezes the exact mapper inputs: `generationId`, workspace ID, enabled-view decisions, panel roots, resource-kind mappings, cache-key rules, and warm rules. On `{ published: true, acceptedRef }`, and before the current JavaScript stack can yield to the supervised listener executor, it stores that snapshot in a module-private `WeakMap<AcceptedCanonicalRef, FrozenResourcePolicySnapshot>`. UEB guarantees queued listener tasks never execute inline before `publishCanonical` returns.

The resource-sync listener receives `(frozenEvent, { acceptedRef })`, calls `assertAcceptedDelivery`, and reads only `resourcePolicySnapshots.get(acceptedRef)`. It never reads the live registry. A missing/mismatched snapshot is `projection_failed` and invokes recovery without revoking admission. The WeakMap entry is garbage-collected with the ref; it is never serialized. Policy reload atomically replaces the live generation for future producers. Already-admitted/queued events retain their captured generation, so a reload cannot reinterpret them.

Tests pause the listener executor, publish under generation A, confirm the sidecar is installed, atomically load generation B, release the executor, and prove mapping used A with zero live-registry/root-resolver calls. They also delete/withhold the sidecar to prove projection recovery, accepted-ref preservation, and WeakMap-only ownership.

### Lifecycle Routing Sidecar

Connection routing remains non-canonical server state. The connection manager creates an opaque, process-local `ConnectionRouteRef` bound privately to the initiating live connection; it exposes no connection/client ID and cannot be serialized. After the operational lifecycle change establishes its post-change workspace, the lifecycle producer captures:

```ts
type FrozenLifecycleRouteSnapshot =
  | Readonly<{
      kind: 'workspace_transition';
      initiator: ConnectionRouteRef;
      routeEpoch: LifecycleRouteEpochRef;
      previousWorkspaceId: string | null;
      workspaceId: string | null;
    }>
  | Readonly<{
      kind: 'lifecycle_current_workspace';
      initiator: ConnectionRouteRef;
      routeEpoch: LifecycleRouteEpochRef;
      workspaceId: string | null;
    }>;
```

`LifecycleRouteEpochRef` is an opaque, process-local capability bound either to that connection's exact workspace transition generation and `(previousWorkspaceId, workspaceId)` pair or, for view/theme facts, its captured current-workspace generation/value. The connection manager advances the generation after every completed operational workspace transition. A same-workspace `user_switch` no-op emits no fact and does not advance it; a future same-workspace reload could advance it only after an authorized producer/reason registry update. It exposes `assertCapturedLifecycleRouteBinding(connectionRef, epochRef, routeSnapshot)`, which verifies the immutable original discriminant and values without requiring them to remain current, and `isCurrentLifecycleRoute(connectionRef, epochRef, workspaceId)`, which is used only for renderer delivery/recovery. It exposes no numeric/string epoch and neither ref may be logged as an ID, serialized, or persisted.

The producer calls `publishLifecycleCanonical(preparedCandidate, routeSnapshot)`. Before admission, the wrapper uses `assertCapturedLifecycleRouteBinding` to verify both opaque refs and the full discriminated snapshot were issued together for the initiating operation. For `workspace.switched`, it requires `kind = 'workspace_transition'` and exact equality of both snapshot transition values with final safe `ids.previousWorkspaceId` and `ids.workspaceId`; missing or wrong previous workspace is rejection even when the post workspace matches. For view/theme it requires `kind = 'lifecycle_current_workspace'` and exact workspace equality, and those event schemas forbid `ids.previousWorkspaceId`. A forged or internally mismatched snapshot publishes nothing and uses `candidate_validation_failed` direct lifecycle recovery only if that route is still current. A legitimately captured route becoming stale because a later operation completed is never an admission failure: the earlier lifecycle fact is still accepted for ledger and non-render subscribers, while renderer delivery applies the separate currency rule below. On a true publish result, before the current JavaScript stack yields to the listener executor, the wrapper stores the frozen snapshot in a module-private `WeakMap<AcceptedCanonicalRef, FrozenLifecycleRouteSnapshot>`. The wrapper retains the operational route snapshot until installation completes. UEB never runs listener tasks inline, so the lifecycle broadcaster cannot observe the accepted ref before installation.

`projectLifecycleInvalidate(frozenEvent, { acceptedRef })` calls `assertAcceptedDelivery` and reads the route sidecar internally. At delivery it rechecks the initiator's epoch and authoritative workspace. If the epoch is stale, it sends neither the old invalidation nor its recovery to that initiator, records `stale_lifecycle_route`, and leaves freshness to the newer operational transition's own invalidation/recovery or reconnect rewarm; it never rewinds, clears, or rewarms the newer workspace from the stale fact. For `workspaceId: null`, normal invalidation and post-admission `projection_failed` recovery target only the still-current null-workspace initiator; they never select every null-workspace connection. For non-null lifecycle events, delivery includes the initiator only when its epoch/workspace are still current, plus other connections whose authoritative active workspace equals the snapshot/event workspace at delivery. A disconnected opaque target is skipped and reconnect rewarm applies; it is never converted to metadata.

If sidecar installation itself fails, the wrapper retains the producer's operational route and epoch refs, records a projection diagnostic, and directly sends `lifecycle:refresh_required` with `projection_failed` before releasing listener tasks only when the epoch/workspace remain current. If already stale, it records `stale_lifecycle_route` and sends nothing from the obsolete transition. The lifecycle projection task then treats missing sidecar as already-handled infrastructure failure and emits only a diagnostic. Admission and other subscribers remain valid. Arbitrary lifecycle publication that bypasses the wrapper is rejected by the registered publisher boundary. The WeakMap entry follows accepted-ref reachability and is never canonical, logged as an ID, or persisted.

Tests use two simultaneous connections whose authoritative workspace is null and prove only the opaque, current initiator receives null-switch invalidation and projection-failure recovery. They pause admission and listener release; run rapid `A -> null -> B` and `A -> B -> C`; prove every completed transition with its exact previous/current pair remains an accepted canonical fact for ledger/non-render subscribers; and prove obsolete normal invalidation, projection recovery, and direct installation-failure recovery never touch the initiator's newer state. They reject missing/null-when-non-null/wrong/swapped previous workspace, post-only route proof, and wrong snapshot discriminant. They prove same-workspace `user_switch` is a no-event/no-epoch-change branch and that unauthorized `startup|reload|system` producer/reason pairs plus initiator-absent/headless publication are rejected without affecting operational behavior. They also cover non-null initiator-plus-delivery-time matching-workspace routing, disconnect/reconnect, forged/wrong route or epoch refs, wrapper-bypass rejection, injected installation failure with exactly one current-epoch direct recovery, missing-sidecar diagnostic-only behavior, all five active user-switch ingress branches, no routing identity/epoch in event/ledger/renderer payloads, and WeakMap cleanup subject to external ref retention.

Within `ResourceSyncEventProjection.resource`, `basename` is the final path segment including extension; `name` is the display label derived by the resource policy. They may match for ordinary files but are not interchangeable.

### Origin Envelope

All mutation-producing paths attempt normalized provenance and context without making them an operational gate. Accepted UI-action records provide active view context and a durable action ID; degraded paths preserve the mutation fact with honest unavailable/unknown attribution and no dangling ID.

```ts
type ResourceCauseProjection = {
  uiActionId?: string;
};

// Slice 40b1a registers only UI cause identity for resource/lifecycle candidates.
// The applicable SPEC-40b2a-40b2f slice extends this type and the pointer/domain registries before later causes are admitted.

type EventOriginType = 'ui' | 'tool' | 'harness' | 'trigger' | 'scheduler' | 'script' | 'sync' | 'import' | 'agent' | 'system' | 'external' | 'unknown';

type EventOriginProjection = {
  type: EventOriginType;
  id?: string;
};
```

UI commands such as `file:rename`, `file:move`, `file:delete`, `file_save`, `folder_create`, and `document_create` may include renderer context and optional `clientCommandId`; after the operational path starts, the server's admission task generates canonical `uiActionId` and other server-owned event IDs. Existing numeric view-state `clientMutationId` values are acknowledgement/order tokens, not provenance identifiers. Missing provenance metadata never blocks an operationally valid command. When a canonical UI action ref is already available, a caused resource mutation may bind its UI relationship; otherwise it preserves honest UI/unknown attribution without inventing or waiting for a cause ID. Watcher-origin events must not pretend to be UI-origin.

`file:move` commands produce `resource.renamed` resource events with `operation = 'rename'` and old/new parent context.

Any SPEC-32 slice that migrates UI-origin provenance must use the SPEC-34 contract and waits until RSC-D12a is closed for that path. This gates migration, not the existing user command. The UI-action contract emits a minimal event when provenance succeeds:

For the owner-approved first pair, the current code audit found no direct durable file create/save/move/rename/delete commands in Wiki or File Viewer. Their first migrated durable command is `chat.send_with_resource` when Wiki Viewer or File Viewer is the active panel and `useChatArea.sendToThread` consumes at least one valid pending resource attachment from any panel. The active panel chooses the context adapter; attachment origin never does. Every valid attachment's panel-relative path is a `subject` resource even when it differs from the active document/resource, while invalid attachments are diagnosed and omitted. Non-mutating Wiki/File navigation and attachment staging do not emit `ui.action` events.

```ts
type UiActionIds = {
  workspaceId: string;
  threadId?: string;
  turnId?: string;
  rootEventId?: string;
  parentEventId?: string;
  correlationId?: string;
  causationId?: string;
};

type UiActionProvenance = {
  source: { type: 'ui-action-ingestor'; module: 'provenance/ui-action-ingestor' };
  origin: { type: 'ui'; id: string };
  observedBy: { type: 'ui-action-ingestor'; module: 'provenance/ui-action-ingestor' };
  confidence: 'direct';
};

type UiActionResource = {
  role: 'subject';
  resourceType: 'file' | 'folder' | 'wiki' | 'ticket' | 'doc';
  path: string;
};

type UiActionContext = {
  scope: 'ui';
  route: null;
  activeTabId?: string | null;
  activeDocumentPath?: string | null;
  activeResourcePath?: string | null;
  selectedResourceId: null;
} & (
  | { viewId: 'wiki-viewer'; panelId: 'wiki-viewer' }
  | { viewId: 'file-viewer'; panelId: 'file-viewer' }
);

type UiActionEventBase = {
  schemaVersion: 1;
  eventId: string;
  eventFamily: 'ui';
  eventType: 'ui.action';
  occurredAt: number;
  actor: { type: 'human' };
  provenance: UiActionProvenance;
  uiAction: {
    uiActionId: string;
    clientCommandId?: string;
    command: 'chat.send_with_resource';
  };
};

type UiActionFullEvent = UiActionEventBase & {
  ids: UiActionIds;
  context: UiActionContext;
  resources: readonly [UiActionResource, ...UiActionResource[]];
  redaction:
    | { status: 'not_required'; policyId: 'ui-resource-metadata-v1'; policyVersion: '1' }
    | { status: 'applied'; policyId: 'ui-resource-metadata-v1'; policyVersion: '1'; omissions: readonly [string, ...string[]] };
};

type UiActionRedactionSafeCoreEvent = UiActionEventBase & {
  ids: { workspaceId: string };
  context?: never;
  resources: readonly [];
  uiAction: { uiActionId: string; command: 'chat.send_with_resource'; clientCommandId?: never };
  redaction: {
    status: 'failed';
    policyId: 'ui-resource-metadata-v1';
    policyVersion: '1';
    omissions: readonly ['/*:redaction_failed'];
  };
};

type UiActionEvent = UiActionFullEvent | UiActionRedactionSafeCoreEvent;
```

This is the exact first-package type: lifecycle, ledger, actor ID, input summary, and result/resource mirrors are absent. Later links use downstream accepted events, ledger edges, or a separately registered update event.

If durable persistence of UI action events waits for SPEC-35 ledger ingestion, an accepted `ui.action` still emits on UEB independently. A later resource mutation carries `uiActionId` only when its producer's ref lease already exposes the accepted UI ref; pending, failed, closed, or late-producer branches omit the relationship without waiting or copying a raw ID.

Canonical provenance fields use the wiki vocabulary:

- `provenance.source` records the producer of the canonical event record.
- `provenance.origin` records the initiating actor/context when known.
- `provenance.observedBy` records the subsystem that detected the fact.
- `provenance.confidence` is `direct`, `correlated`, `inferred`, or `unknown`.
- `provenance.cause` stores upstream durable initiator IDs only. Root, parent, thread, turn, correlation, and causation IDs belong under `ids`.
- View/panel/route/active-resource details belong in shared `context`, not inside resource payloads.

Every server-side mutation command must generate or propagate `ids.serverMutationId`, including file save/create/move/rename/delete, background server jobs, and non-UI server API mutations.

This assignment resolves the apparent orphan in provenance finding 2: `serverMutationId` belongs to the server-produced resource-mutation branch, where the command handler generates or propagates it and resource validation/projection/ledger consumers use it for that mutation's operational correlation and branch checks. It is required for the server branch, prohibited for watcher-observed resource facts, and does not belong on unrelated workspace/view lifecycle events.

### Future Ledger Compatibility Contract

SPEC-32 must preserve enough identity and provenance for SPEC-33 without implementing version storage.

Required now:

- Stable `eventId` for each canonical resource event.
- Workspace and resource identity.
- Shared provenance envelope compatibility: `ids`, `actor`, `provenance`, `context`, `resources[]`, and resource mutation domain payload.
- `provenance.source` as the canonical event producer.
- `provenance.observedBy` as the subsystem that detected the fact.
- `provenance.origin.type` as the initiating actor/context when known; in 40b1a an ID-bearing origin is registered only for accepted UI action proof.
- `ids` for thread, turn, `rootEventId`, `parentEventId`, correlation, and causation identity when available.
- In 40b1a, only builder-proven `provenance.cause.uiActionId`. Tool/harness/automation/audit cause IDs are later-domain requirements and remain absent until the applicable SPEC-40b2b/40b2c/40b2f slice plus its owning domain slice registers exact types, domain keys, and pointer bindings.
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
2. `lib/resources/resource-context.js` implements the enricher role and derives path/parent without I/O, then adds only already-available siblings, stats, and counts. It never performs optional file reads, directory scans, or tokenization on the operation-response or renderer-invalidation path.
3. The validated/diagnosed publisher emits the canonical resource fact after the SPEC-40 validators for the touched family/domain are registered. Optional enrichment failure uses unavailable/omission forms and does not suppress the fact or source mutation.
4. Canonical-only subscribers act only on accepted events. Publisher/subscriber failure is isolated from the already-valid source mutation or safely established watcher observation; render sync retains the explicit fallback refresh/diagnostic path for unexpected post-fact publication failure.

For watcher-only canonical events, use `provenance.source.type = 'resource-enricher'` and `provenance.source.module = 'lib/resources/resource-context.js'`; `provenance.observedBy` remains the watcher that detected the filesystem fact.

`viewRefs` are not part of the canonical resource event payload. The resource-sync subscriber runs `resource-event-mapper` after UEB emission to derive the renderer-specific `ResourceSyncEventProjection.viewRefs` used for cache invalidation. Ledger, metadata, and future versioning subscribers consume the canonical event and may build their own projections without inheriting render-specific fields. Trigger provenance may observe accepted events, but operational file-change matching remains watcher-owned.

Operational trigger eligibility uses only the closed existing watcher-condition key set: `filePath`, `parentDir`, `type`, `ext`, `basename`, `delta`, `oldPath`, `newPath`, `parentStats.files`, `parentStats.folders`, `fileStats.lines`, `fileStats.words`, `fileStats.tokens`, and `fileStats.size`. The last six stats are operational watcher context, not canonical provenance enrichment; their existing observation semantics remain trigger behavior. Conditions are UTF-8 strings at most 512 bytes, with only ASCII space/tab allowed around tokens; the grammar consumes the full input and parses operators longest-first. Numeric keys (`delta`, `parentStats.*`, `fileStats.*`) accept `>= | <= | === | !== | > | <` and a base-10 safe integer matching `0|-?[1-9][0-9]*`; leading `+`, negative zero, leading zeros, floats, exponents, and values outside `Number.isSafeInteger` are invalid. String/path keys accept only `=== | !==` and either: a single- or double-quoted UTF-8 string of at most 256 bytes (empty allowed; no quote, backslash, control character, newline, or escape sequence inside), or a non-empty bare ASCII token matching `[A-Za-z0-9_./:@*-]+` of at most 256 bytes. `ext`, `oldPath`, and `newPath` additionally accept unquoted exact `null`; their missing runtime value normalizes to null before comparison. No coercion, boolean, compound expression, interpolation, or second operator is supported. Optional canonical provenance/enrichment, including UI/tool/automation IDs, accepted refs, content hashes, and canonical before/after fields, is outside that allowlist. Unknown keys, malformed syntax, wrong key/operator/value combinations, or extra tokens reject only that file-change block at load/reload with a diagnostic; `evaluateCondition` is never called for it and invalid syntax never defaults to `true`. Valid sibling file-change blocks still install. Optional provenance may affect only post-execution diagnostics/correlation. Render-sync eligibility uses its required operational resource fact core and recovery, never trigger stats or optional attribution/enrichment.

The file-change block schema is also closed and uses `additionalProperties: false`. It has exactly required `name`, `type`, `events`, `match`, `prompt`, and `message`, with optional `exclude`, `condition`, and `action`. `type` is required exact `'file-change'`; missing or unknown types are not default file filters. `name` is a trimmed non-control UTF-8 string of 1-128 bytes. `events` is a non-empty unique array, never a scalar, drawn only from `modify|create|delete|rename` and normalized to that fixed order. `match` is one pattern string or a 1-32 unique string array; `exclude` is absent, one string, or a 0-32 unique string array. Each pattern is 1-512 UTF-8 bytes, contains no NUL/control/newline/backslash/absolute prefix or `.`/`..` segment, and is passed unchanged to the active `matchesPattern` implementation; Slice 32a freezes golden match/non-match vectors for every active pattern plus literal, `*.ext`, single-`*`, and `**` branches, and 32e must preserve those vectors without broadening. `condition`, when present, uses the exhaustive grammar above. `action` is absent or exact `'create-ticket'`; absence normalizes to that value. `prompt` is a repository-relative POSIX path of 1-512 bytes with no absolute prefix, backslash, or `.`/`..` segment. `message` is either a non-empty UTF-8 string or the active parser's plain-object multiline form. The object has 1-32 insertion-ordered entries; each key is a non-empty no-NUL/control/newline UTF-8 string of at most 256 bytes and each value is a no-NUL/control/newline UTF-8 scalar string of at most 4 KiB. It normalizes deterministically to `key: value` lines in insertion order. The final normalized message is non-empty and at most 16 KiB. Arrays, nested objects, prototypes other than `Object.prototype|null`, and non-string values are invalid. `script`, `function`, `modal`, `retry`, bus/cron fields, and every other key are prohibited for file-change blocks in this slice. The assignee remains derived from the scanned agent path and is not block input. This schema covers every active file-change block found by 32a; any future action or field requires its own operational contract and schema update before loading.

Token counting never runs synchronously on the source-operation response or renderer-invalidation path. Include `tokenCount` only when the accepted operation or an existing cache already provides it. For a `ResourceStatePresent` block without an available count, supported text at or below 512 KiB uses `omissions.tokenCount = 'not_observed'`; larger text uses `too_expensive`; binary/unsupported resources use `not_supported`; and redacted resources use `redacted`. Existing text/binary classification may be reused only when already available without additional I/O; otherwise use `unknown`. If the whole state is unavailable, use `ResourceStateUnavailable.omissionReason`. Deferred token-stat follow-up events are outside this spec.

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
| `lib/resources/resource-context.js` | Derive no-I/O path/parent context and attach only already-available siblings, stats, and count data; omit unavailable optional enrichment. |
| `lib/resources/resource-event-mapper.js` | Map workspace-relative resource paths to panels and client resource refs. |
| `lib/ws/resource-broadcaster.js` | Subscribe to UEB resource, workspace, view, and theme events and send client `resource:invalidate` messages. |
| `lib/watch/workspace-watch-controller.js` | Own active workspace watcher lifecycle; start/repoint/close watcher on workspace switch. |

### Normalize Existing Producers

| Producer | Current | Target |
|---|---|---|
| `workspace-watcher` | Emits `file:changed`. | Emit a raw resource observation into the enrichment pipeline, which then emits canonical resource events on `resource:*` topics. |
| `file-explorer.js` save/create | Emits legacy `file_changed`. | Emit canonical resource events on `resource:*` topics with origin; remove direct legacy broadcast. |
| `workspace-request-handlers.js` move/rename/delete | Directly broadcasts `file_changed`. | Emit canonical resource events on `resource:*` topics; broadcaster handles clients; remove direct legacy broadcast. |
| Harness/provider mutations | UEB already sees harness events in places. | In 40b1a, use only justified non-ID `origin.type = 'harness'|'tool'` and actor/confidence; omit harness/tool IDs and causes. After SPEC-36/40b2b registers the exact resource extension, builder bindings may insert canonical harness/tool IDs and causes from already-available accepted refs. Provider-native IDs remain on linked harness/tool events under provider-keyed `nativeRefs`, never resource mutation events. |
| scripts/scheduler/sync/import/agent | Ad hoc or future. | First-package resource events may use the known automation kind as a non-ID origin type when justified but omit automation IDs and `automationRef`. A later SPEC-37/SPEC-40b2c extension may add ID-bearing automation origin/cause/subtype mirrors only through `prepareCanonicalCandidate` bindings that consume an accepted automation reference. Failure never affects execution or resource facts. Automation events never self-reference. |

First-package harness attribution uses `origin.type = 'harness'` only for initiating harness context, or `tool` with assistant actor when tied to an assistant/tool call, and carries no harness/tool ID. Only after SPEC-36/40b2b registration may ID-bearing origin, causes, mirrors, or edge candidates use `prepareCanonicalCandidate` bindings from an already-available accepted harness/tool ref. Failure always preserves execution/resource facts with honest non-ID attribution. Provider-native identity stays under `nativeRefs` on linked harness/tool events; never add provider-specific resource fields/origin types.

### Subscriber Split

| Subscriber | Consumes | Output |
|---|---|---|
| TRIGGERS file-change matcher | One established workspace-watcher observation path; accepted canonical refs only as optional already-available provenance | tickets, agent runs, scripts, notifications exactly once |
| Resource sync subscriber | UEB resource/workspace/view/theme events | WebSocket `resource:invalidate` messages |
| Ledger subscriber | UEB firehose | SQLite event ledger |
| Metadata subscriber | UEB resource events | chat turn/file mutation metadata |

TRIGGERS keeps one operational match/exclude/condition path. Canonical UEB subscribers may record and correlate its accepted automation facts, but they do not authorize or initiate the operational match. React/resource sync is code-owned and deterministic.

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

type ResourceRefreshRequiredMessage = {
  type: 'resource:refresh_required';
  workspaceId: string;
  reason: 'candidate_construction_failed' | 'candidate_validation_failed' | 'redaction_failed' | 'canonical_publish_failed' | 'canonical_publish_suppressed' | 'projection_failed';
  resourcePaths: string[];
  operation?: 'modify' | 'create' | 'delete' | 'rename' | 'metadata';
};

type LifecycleRefreshRequiredMessage = {
  type: 'lifecycle:refresh_required';
  workspaceId: string | null;
  scope: 'workspace' | 'view-registry' | 'theme';
  reason: 'candidate_construction_failed' | 'candidate_validation_failed' | 'redaction_failed' | 'canonical_publish_failed' | 'canonical_publish_suppressed' | 'projection_failed';
  affectedPanels?: string[];
};

type FreshnessRecoveryMessage = ResourceRefreshRequiredMessage | LifecycleRefreshRequiredMessage;

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

type ResourceLifecycleInvalidateBase = {
  type: 'resource:invalidate';
  eventId: string;
  cause?: ResourceCauseProjection;
  source: LifecycleProvenance['source'];
  observedBy: LifecycleProvenance['observedBy'];
  origin?: EventOriginProjection;
};

type WorkspaceSwitchInvalidateMessage = ResourceLifecycleInvalidateBase & {
  eventType: 'workspace.switched';
  ids: WorkspaceSwitchedEvent['ids'];
  event: 'workspace-switch';
  lifecycleScope: 'workspace';
  kind: 'all';
  affectedResources?: never;
  affectedPanels?: never;
};

type ViewRegistryInvalidateMessage = ResourceLifecycleInvalidateBase & {
  eventType: 'view.registry_changed';
  ids: ViewRegistryChangedEvent['ids'];
  event: 'view-registry-change';
  lifecycleScope: 'view-registry';
  kind: 'registry';
  affectedResources?: Array<{
    panel: string;
    path?: string;
    kind: 'config' | 'registry';
  }>;
  affectedPanels?: string[];
};

type ThemeInvalidateMessage = ResourceLifecycleInvalidateBase & {
  eventType: 'theme.changed';
  ids: ThemeChangedEvent['ids'];
  event: 'theme-change';
  lifecycleScope: 'theme';
  kind: 'style';
  affectedResources?: Array<{
    panel: string;
    path?: string;
    kind: 'style' | 'config';
  }>;
  affectedPanels?: string[];
};

type ResourceLifecycleInvalidateMessage =
  | WorkspaceSwitchInvalidateMessage
  | ViewRegistryInvalidateMessage
  | ThemeInvalidateMessage;
```

Lifecycle invalidations are constructed only by `projectLifecycleInvalidate(frozenEvent, { acceptedRef })`. The function first calls `assertAcceptedDelivery`, reads the private lifecycle routing sidecar, switches on the accepted canonical `eventType`, and constructs the one matching discriminated variant. Its result must preserve `eventId` exactly and deep-copy only the accepted event's registered `ids`; `ids.workspaceId` and, only for workspace switches, required `ids.previousWorkspaceId` are the only workspace identities in the renderer message. Runtime validation rejects any event/action/scope/kind cross-pair, any `eventId` or `ids` mismatch with the accepted frozen event, any extra top-level workspace identity, missing/mismatched route proof except the wrapper's already-recovered install-failure branch, and arbitrary callers/publication.

The WebSocket message uses a renderer-specific `resource:invalidate` envelope. For `ResourceMutationInvalidateMessage`, the `event` field carries the specific resource mutation action; lifecycle invalidation messages carry lifecycle actions such as `workspace-switch`, `view-registry-change`, or `theme-change`. This avoids overloading canonical resource event identity with `resource:*` bus-topic or transport/cache semantics. Legacy `file_changed` handling is allowed only inside the temporary migration adapter window and must not remain as a parallel invalidation path.

Canonical `eventId`, selected `ids`, cause/origin, and context in this server-to-renderer projection exist only for dedupe, traceability, and cache correlation. They do not authorize renderer behavior, are not the transport identity, and must never be echoed into renderer command envelopes or later canonical candidates. The renderer-input prohibition on canonical relationship IDs remains unchanged.

Resource mutation invalidations are never workspace-null; in this build, `workspaceId: null` is reserved only for `workspace.switched` transitions to no active workspace. Null `workspace.switched` events follow workspace-switch delivery, not global broadcast. Global lifecycle invalidations are future/out of scope.

For resource mutations, the broadcaster emits one `resource:invalidate` message per `viewRef` in the `ResourceSyncEventProjection`. It does not send one aggregate message containing all affected views. In each emitted message, `panel`, `path`, `kind`, and `target` are copied from the emitted `viewRef`; `resourcePath` is the canonical subject path for the resource mutation. `oldResourcePath` is required only for rename, where `resourcePath` is the new path and `oldResourcePath` is the previous path. For delete, `resourcePath` is the deleted path and `oldResourcePath` is omitted. This prevents parent-tree invalidations such as `old-parent-tree` and `new-parent-tree` from being mistaken for the changed file's content key. For lifecycle events, the broadcaster sends the lifecycle variant so renderer cache/state can handle workspace switch, view registry, and theme invalidation without pretending those are file mutations.

For lifecycle invalidation, `affectedPanels` limits the panel set and `affectedResources[].panel` targets a specific panel cache key. If neither is present, the lifecycle event applies to all active workspace enabled views that match the `lifecycleScope` and lifecycle `kind`; `kind: 'all'` means all cache kinds under that lifecycle scope. `lifecycleScope` is a renderer routing field and is unrelated to provenance `context.scope`. Connection-specific acknowledgements and receiver routing remain outside canonical lifecycle context.

### Fail-Open Freshness Recovery

`FreshnessRecoveryMessage` is a non-canonical emergency recovery union, not a second event language or legacy invalidation source of truth. `resource:refresh_required` applies after an operation or observation safely established workspace and resource paths but canonical validation/publication or render projection unexpectedly failed. `lifecycle:refresh_required` applies after a workspace, view-registry, or theme operation established its authoritative operational result but lifecycle validation/publication or projection unexpectedly failed. Neither message is admitted to UEB or delivered to canonical subscribers.

Ownership:

- The resource producer uses `candidate_construction_failed` when safe candidate construction throws/cannot produce its required core, `candidate_validation_failed` when the constructed safe candidate fails schema validation, `redaction_failed` when resource redaction is missing/fails/throws, `canonical_publish_failed` when publication throws, and `canonical_publish_suppressed` when acknowledged UEB publication returns false. No pre-admission branch produces an accepted reference.
- `lib/ws/resource-broadcaster.js` catches its own mapping/projection failures and invokes the same recovery broadcaster. It must not rely only on UEB's outer `runSafely` logging because that cannot notify the producer or renderer.
- The server sends recovery only to connected clients whose active workspace matches `workspaceId`. It never sends the rejected candidate to canonical-only subscribers.
- The lifecycle producer uses the same exact construction/validation/redaction/publication reason mapping for `lifecycle:refresh_required`. Its projection subscriber sends `projection_failed` when accepted-event projection fails; admission and other subscribers remain valid. `scope` is derived from the completed operational action, never from the rejected candidate. `affectedPanels` is only a narrowing hint.
- For a non-null lifecycle `workspaceId`, the server sends recovery to the initiating connection and other connections whose authoritative active workspace matches it. For a null workspace switch, it sends only to the initiating connection after its operational routing state has changed to no active workspace.
- The client resource handler marks the active workspace's resource cache stale and preserves panel, tab, selection, navigation/history, document scroll, dirty flags/buffers, pending optimistic operations, and undo state. `resourcePaths` are diagnostic/narrowing hints; recovery correctness does not depend on the failed projection.
- Clean warm/visible tree/content/config/registry entries refetch and replace their cache values. A dirty entry or entry with a pending optimistic operation never has its local value or state overwritten. Its server response is stored in a separate `recoveryRemote` shadow with server revision/metadata, and the entry becomes `freshness: 'conflict_pending'` until the normal save, revert, or conflict-resolution path explicitly reconciles it. A failed shadow fetch remains stale and retryable. The workspace cannot claim fully fresh while any entry is stale or `conflict_pending`.
- WebSocket delivery failure cannot use the same socket for recovery. Reconnect handling applies the same clean-versus-dirty rules before treating the active workspace as fresh; it never clobbers a dirty/optimistic entry during rewarm.
- On lifecycle scope `workspace` with non-null `workspaceId`, the client adopts the already-authoritative operational workspace routing state, marks its caches stale, and rewarms them with the same clean-versus-dirty protections. With null `workspaceId`, it clears active-workspace cache/routing claims but preserves every unsaved dirty buffer in detached recovery/conflict state; it cannot claim those buffers or the no-workspace state fully reconciled until normal resolution completes.
- On lifecycle scope `view-registry`, the client refetches the registry and recomputes enabled views without replacing dirty buffers, pending navigation, or optimistic state. On scope `theme`, it refetches affected style/config resources, or all active theme resources when `affectedPanels` is absent, with the same dirty-state protections. A failed rewarm remains stale and retryable.

Recovery is deliberately broader than ordinary `resource:invalidate`. It exists so provenance infrastructure cannot make a successful mutation or lifecycle change invisible. It does not feed triggers, ledger, versioning, or other canonical subscribers.

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
- `resourceStore` also owns recovery freshness (`fresh`, `stale`, `conflict_pending`) and the non-rendered `recoveryRemote` shadow used to compare a server refetch without overwriting dirty or optimistic local state.
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

Client mutation senders attach best-effort command-time context. This is renderer command input, not canonical provenance and not authorization:

```ts
{
  clientCommandId,
  context: {
    scope: 'ui',
    viewId,
    panelId,
    route,
    activeTabId,
    activeDocumentPath,
    activeResourcePath
  },
  resources: [
    {
      role: 'subject',
      resourceType,
      path,
      oldPath?
    }
  ]
}
```

The renderer command may include normalized path/type/role resource inputs. It supplies no canonical or domain relationship IDs. View/panel information stays in `context`, not `resources[]`. Missing or invalid optional provenance inputs do not block the source command; downstream handlers use operational command inputs to perform their own authorization, target, workspace, and path-safety checks.

Context is captured at command time when already available. After the operational path starts, the admission task generates `uiActionId` and canonical envelope/provenance fields from the known UI ingress path. The `ui.action` event uses server-owned source/origin/observer/confidence and does not self-reference its own ID in `provenance.cause`. A downstream resource mutation binds the UI relationship only when the accepted ref slot is already filled; pending/failure paths omit it without waiting and preserve honest UI/unknown attribution.

Downstream resource mutation events produced by the server command handler set source/observer to the mutation producer. They preserve an ID-bearing UI origin only when the upstream `ui.action` was accepted; otherwise known UI ingress may retain `origin.type = 'ui'` without `origin.id` or `cause.uiActionId`.

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
- Inventory every first-package resource/workspace/view/theme/UI-action candidate producer and observer. For each exact event variant record the active handler/module path, operational origin, proposed canonical `provenance.source {type,module}`, proposed `provenance.observedBy {type,module}`, whether the pair is currently emitted or introduced by a named later slice, and probe/code evidence. Unverified or placeholder module names are not freezeable.
- Create `fusion-studio-server/lib/provenance/registries/first-package-producers.v1.json` and colocated Draft 2020-12 `first-package-producers.v1.schema.json` as the initial registry artifact and continuing single producer authority. The data root has exactly `{ schemaVersion: 1, registryId: 'first-package-producers', freezeVersion: 1, entries: [...] }`; the schema uses `additionalProperties: false` at every object. Each entry has exactly: stable `producerToken`; `handler = { modulePath, exportName }`; non-empty sorted unique `eventTypes`; exact `source = { type, module }`; exact `observedBy = { type, module }`; `leaseRole: 'command_downstream' | 'none'`; sorted unique `commandTypes` (non-empty only for `command_downstream`, otherwise empty); sorted unique `workspaceReasons` (non-empty only for a `workspace.switched` producer, otherwise empty); `implementationStatus: 'active' | 'planned'`; `owningSlice`; and non-empty sorted unique `evidence` code/probe references. Entries sort by `producerToken`. Every initial entry is required by the declared first-package order and names an owning slice at or before 40b1b; any later producer is absent until its owning 32d or 40b2a-40b2f slice performs a semantic registry/schema update. `producerToken` matches `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$` and is at most 128 bytes; `eventTypes` are exact registered dotted event literals; source/observer fields use the canonical module/type validators; `commandTypes` use the registered command vocabulary; `workspaceReasons` use the exact lifecycle reason enum and bind the producer/reason pair; `modulePath` and each evidence path are repository-relative POSIX paths with no absolute prefix, backslash, or `.`/`..` segment; and `exportName` is a JavaScript identifier at most 128 bytes. `owningSlice` is an exact literal enumerated by the schema for that freeze: the initial freeze permits only the named 34d1 and 32b producer slices; a later producer addition atomically adds its exact approved 32d or 40b2a-40b2f owner literal while incrementing `freezeVersion`. Slice 34d2 updates the existing resource entry and remains evidence rather than a new owner identity. `producerToken`, handler pair, and each `(eventType, source, observedBy)` ownership tuple are unique. Planned entries must name the exact implementing slice and evidence for the current ingress they replace; placeholders are forbidden.
- Slice 40a generates the closed `RegisteredDownstreamProducer` token union/table only from entries with `implementationStatus = 'active'` and `leaseRole = 'command_downstream'`; planned entries grant no lease or publication permission. Slice 40b1a may compile planned event/source/observer definitions for unit validation, but the publisher authorizes only an exact active producer entry and active producer/reason pair. Every inventoried first-package producer must be represented or explicitly excluded in the companion report with a reason; exclusions are not artifact entries. Duplicate/conflicting semantic owners, unknown handlers, or artifact/report drift fail 32a acceptance.

**Output:** Updated audit table in this spec or a companion report; a conversion checklist for all discovered legacy file-change paths; and the reviewed, frozen data/schema pair consumed by Slices 40a/40b1a. Slice 32a is incomplete until Draft 2020-12 validation passes, deterministic sort/uniqueness checks pass, the bidirectional inventory/artifact comparison has zero unexplained rows, every entry has code/probe evidence, and both the closed lease-token registry and schema pair allowlists can be generated without inventing a token/module/type value. `freezeVersion` increments for any later semantic entry change and the consuming code rejects unsupported versions. Creating the inert artifact remains discovery-only and enables no publisher or runtime migration.

#### Registry Update Gate

Every later slice named by an artifact entry owns this gate before its own acceptance. It re-probes the handler, updates `implementationStatus` and evidence, validates/sorts the data/schema pair, and runs the bidirectional inventory check. A `planned -> active` promotion changes runtime activation but not the frozen intended semantic contract: it keeps `freezeVersion` only when every token/handler/event/reason/source/observer/lease/command/owner value is unchanged, while atomically regenerating the active-only token/authorization tables. Evidence-only updates behave the same. Any change to those intended semantic values increments `freezeVersion`, updates 40a's generated token table and 40b1a's allowlist/version support atomically, and reruns all registry generation/uniqueness tests. Unsupported/mismatched versions disable only the affected provenance producer with diagnostics; operations continue. Because artifact membership is the required set, Slice 40b1b cannot pass unless every entry is `active`, has current evidence, and matches the loaded/generated registries. There is no separate `enabled` state.

After the first package, each producer-owning 32d or 40b2a-40b2f slice extends this same gate. It atomically adds the exact `owningSlice` schema literal and a `planned` producer entry, increments `freezeVersion`, regenerates 40a tokens plus all validator/publication allowlists, implements the producer, then promotes the unchanged entry to `active` with evidence before publication is enabled. `leaseRole: 'none'` is required unless that exact producer consumes a command-scoped accepted-ref slot. A consuming producer uses `command_downstream` with a non-empty exact command list. Tests reject absent/planned/old-version/wrong-owner/wrong-command/synthetic tokens and accept only the current active entry. A later domain never reuses another producer's token.

### Slice 32b0 - Workspace Topic Fence

**Goal:** Make the active legacy workspace-switch shape and future canonical lifecycle shape mutually exclusive before canonical publication.

**Hard blocker:** owner-approved/back-validated `RSC-D17` supplies the exact token-metadata executor and live-binding capacity/lifecycle contract before this slice implements or activates token allocation. The workspace topic fence, coordinator, root authority, atomic init, logging removal, and E2E launcher may be prepared independently, but 32b0 cannot be accepted or enable token transport until D17 closes.

- From the 32a inventory, enumerate every exact `emit|on|once` and wildcard path that can produce, consume, broadcast, or persist `workspace:switched`, including every emit in `workspace-controller.js` and `workspace-ribbon.js`, `server.js` per-session root/workspace projection, `workspace-broadcaster.js`, `event-ledger-subscriber.js`, `event-ledger.js`, startup registration, watcher lifecycle, tests, and any newly discovered path. Unknown paths block the cutover.
- In one deploy/slice, rename every old-shape operational producer and consumer to permanent private `workspace:operational_switched`, including per-session display-cache projection and the operational broadcaster. Move authorization/target authority out of session `projectRoot/currentWorkspaceId` into the coordinator resolver. Preserve the renderer baseline wire message `type: 'workspace:switched'` with healthy exactly-one delivery; use already-cached styles only, and make unavailable styles an explicit pending/refetch branch rather than awaited enrichment. Failure is at-most-once plus reconnect/snapshot recovery. The private bus name is not exposed to clients. This topic remains the workspace subsystem's operational transport after 40b1b and is not a canonical compatibility adapter awaiting provenance removal.
- In the same atomic slice, add the Operational Workspace Transition Sequencer above. Route every active switch/create/remove/ribbon branch through synchronous FIFO enqueue; move active-state/last-active/active-registry mutation into its transaction/commit boundary; and deliver the private topic through its dedicated synchronous capability-ordered dispatcher rather than generic EventBus promises. Reject/catch thenable or throwing hooks and apply the exact session/broadcaster recovery contract above. Slice 32e later fills the synchronous watcher hook without changing this ordering ABI.
- Remove `workspace:switched` from `RECORDED_EVENT_TYPES` in the legacy event ledger before canonical publication. Do not add `workspace:operational_switched`; legacy workspace-switch persistence pauses until SPEC-35's accepted-delivery subscriber owns canonical storage. Existing historical rows remain legacy/noncanonical and are not upgraded by this slice.
- Fence canonical-only lifecycle subscribers behind `assertAcceptedDelivery`; they ignore the private operational topic/shape. The operational broadcaster subscribes only to `workspace:operational_switched` and rejects/diagnoses canonical-envelope or wrong-shape input rather than broadcasting it.
- Run `cd fusion-studio-server && npm test -- --runInBand test/provenance/workspace-operational-transition-order.test.js`. Pause registry lookup and last-active transaction commits independently; concurrently enqueue switch/create-activate/active-remove/ribbon-remove/ribbon-add-from-null intents from multiple connections; and assert a single ingress FIFO order, exact adjacent pairs, atomic registry/settings commit, matching database/memory/coordinator-resolver state, healthy exactly-one baseline wire delivery, no output on failed/no-op intents, and capability rejection for duplicate/gap/reordered/forged dispatch. Independently make session-cache projection, broadcaster enqueue/send, and stub watcher hooks throw and return permanently pending thenables; assert thenables are rejected rather than awaited, remaining hooks and the next queued intent complete, workspace-scoped commands resolve B/C from coordinator authority rather than stale A cache, broadcaster failure is at-most-once with reconnect/snapshot recovery, and watcher failure enters/invalidates the specified degraded state without rollback or provenance involvement.
- Add `cd fusion-studio-server && npm test -- --runInBand test/provenance/workspace-root-authority.test.js`. The bidirectional static inventory covers every `session.projectRoot`, `session.currentWorkspaceId`, captured initial root, `getProjectRoot(ws)`, active-workspace accessor, and root-bound factory closure. For each inventoried authorization/target-resolution command family, test null workspace, missing/mismatched cache capability, cache assignment throw, `A -> B -> C`, reconnect, async command continuation, and stale startup closure; assert the command's captured coordinator context or explicit authorized argument determines the only root, and no stale cache/closure is consulted.
- Add `fusion-studio-client/e2e/workspace-command-context-transport.spec.ts` and run `cd fusion-studio-client && node e2e/run-provenance-playwright.cjs e2e/workspace-command-context-transport.spec.ts`. With two real WebSocket clients, pause every init enrichment/panel-root build boundary across `A -> B`, `A -> null`, and reconnect; prove the single atomic init leaves workspace ID/root/panel roots on one final coordinator capability with no later stale overwrite and settles while asynchronous entropy is unresolved. Then release entropy and prove only exact-current `workspace:context_token` installs the recipient-specific token; stale A, disconnected, replaced-socket, and late completions install nothing. Prove recipient inequality, transition rotation/reconnect, synchronous close/disconnect/replacement clearing before a prompt can read, null start before re-init, exact later panel-config equality gating and single-panel-only update, rejection of client `rootFolder`/absolute/out-of-workspace paths even with a current token, stale-result discard after an await, token-free shared broadcaster/state snapshots/workspace caches/persistence/logs, collision/CSPRNG/panel-root-build degraded omission, missed-send convergence, a healthy tentative path under final panel roots, and isolated run-root cleanup. Count `set_panel`, session-root mutation, thread binding/list, `panel_changed`, and `request_panel_config` separately: initial connect/restoration invokes the operational counters exactly once, metadata stale/unavailable/coalesced retry changes only the metadata counter, and explicit human panel change adds exactly one operational invocation. This accepts transport/store behavior only; 34d1 owns prompt echo/binding/canonical admission.
- Add `fusion-studio-server/test/provenance/workspace-command-context-transport.test.js` and run `cd fusion-studio-server && npm test -- --runInBand test/provenance/workspace-command-context-transport.test.js`. With injected async entropy, test paused/never-settling/aborted provider plus collision and rejection at every one of the four attempt positions, attempts one-through-three failing then success on four, and all four failing. Run D17 minus/exact/plus global/per-connection item and byte capacities, fairness boundaries, concurrent saturation, every enqueue/eviction/drop branch, retained-context/provider lifetime expiry, live-binding count/byte saturation and cleanup, cancellation/finalizer deadline minus/exact/plus, shutdown deadline minus/exact/plus, and restart. Byte tests cover every approved representation/encoding/overhead class, shared-ref apportionment, queued-to-active-to-cancelling-to-live-binding transitions, exact release points, competing-cap precedence, and cap-plus-one early stop without an over-cap traversal/serialization operand. Assert each attempted entropy failure consumes one attempt, no fifth attempt/exception-material log, live-set uniqueness within D17 caps, old-binding invalidation before notification, current-only atomic install, wrapper/provider ownership release under D17, late-completion discard, saturation/exhaustion omission, exact fixed value-free diagnostics, no unbounded retained job/binding/diagnostic memory, and normal token-omitted workspace handling. Pause every connection-init async enrichment and panel-root construction boundary across `A -> B`, `A -> null`, reconnect, enrichment throw, and panel-root throw; assert final no-await coordinator capture/build/single-init-send uses one latest immutable workspace ID/root/panelRoots/status, removes the legacy startup panel-config send and `ws.onopen` `set_panel`, never calls/awaits entropy, and never mixes coordinator capabilities. Assert baseline init/switch/coordinator completion settle while entropy remains paused or saturated; later exact-current metadata-only token update changes no workspace/panel state. For later panel config, test exact healthy shape, absent/stale/malformed token, workspace/root mismatch, unknown panel, captured-ref invalidation after every await, malicious `rootFolder`, absolute and out-of-workspace paths with a matched token, resolver throw/unavailable, bounded/coalesced retry, and new-token cancellation. Assert only the named panel root can change, stale/outside roots never enter client state, diagnostics contain no rejected values, and refetch converges. Instrument separate counters and prove metadata requests/responses have zero session-root, panel-selection, thread, thread-list, `panel_changed`, or acknowledgement effects while initial restoration and each explicit human `set_panel` perform those operational effects exactly once.
- Run `cd fusion-studio-client && npm run test:provenance -- --run src/provenance/__tests__/workspace-command-token-log-redaction.test.ts src/provenance/__tests__/workspace-command-token-lifetime.test.ts` and `cd fusion-studio-client && npm run build`; 32b0 is not accepted with workspace token transport enabled before these checks pass. The lifetime suite proves exact-socket reads, clear-before-close/disconnect/replacement/reconnect, absent/malformed transition clearing, panel-config non-installation, stale prompt omission, workspace switch/cache roundtrip, workspace-state push serialization, Zustand/state snapshot serialization, local/session storage and IndexedDB spies, persisted view-state roundtrip, and static rejection of the reserved key in every persistence/state schema.
- Add a startup/cutover assertion that canonical workspace publication cannot be enabled unless both the topic and workspace-root-consumer inventories are closed, every authorization/target entry is migrated, the legacy producer/subscriber topic rename is installed, the old ledger whitelist entry is absent, and no production old-shape handler remains on canonical `workspace:switched`. Failure leaves canonical lifecycle publication disabled with a diagnostic and never affects operational switching.
- Acceptance tests exercise the 32b0 fence without enabling a production canonical publisher. A healthy legacy operational switch updates coordinator authority and best-effort session display caches, yields exactly one baseline renderer operational `workspace:switched` message with cached styles or explicit styles-pending/refetch, zero canonical accepted deliveries, and zero new legacy-ledger rows. Independently fail cache assignment, baseline send, and styles availability; assert authoritative commands still use the coordinator root, send failure is not retried, reconnect/snapshot recovery converges, and later notification attempts run. Feed synthetic canonical-envelope fixtures directly to the operational topic/broadcaster guard and operational-shape fixtures directly to the canonical-only guard; both wrong-lane inputs are rejected/ignored with zero session projection, broadcaster, accepted delivery, renderer invalidation, or persistence. Concurrent synthetic cross-lane probes cannot bypass the fence or wildcard exclusions. Actual canonical lifecycle acceptance belongs to 32b/40b1b, and exact `resource:invalidate` lifecycle projection/delivery belongs to 32c/40b1b.

**Output:** Updated 32a collision inventory, closed workspace-root-consumer inventory, coordinator resolver/context capability, recipient-specific detached asynchronous four-attempt allocator plus metadata-only current-token update, atomic init/panel-root migration with no legacy startup overwrite or entropy wait, token-gated later panel config, token-safe renderer logging/lifetime, accepted isolated E2E launcher/transport evidence, fenced operational producer/broadcaster, removed legacy ledger whitelist entry, startup assertion, and automated ordering/root-authority/dual-shape evidence. No canonical lifecycle publisher is enabled by this slice.

### Slice 32b — Canonical Event and Enrichment Contract

**Goal:** Add server helpers without changing client behavior.

- Hard prerequisite: Slice 32b0 is complete and its startup assertion passes before any canonical `workspace:switched` publication flag/path is enabled.
- Apply the registry update gate to every Slice 32b producer before enabling it. Workspace producers must match the operation/reason/route matrix above; no producer may publish a reason absent from its registry entry.

- Add resource context/enrichment helper.
- Add resource event mapper.
- Unit test parent, siblings, stats, line counts, token counts, token omission reasons, rename metadata, and view refs.
- Install a throwing workspace-root/registry resolver spy in mapper tests and prove immediate mutation mapping still succeeds from the accepted event plus captured resource-policy snapshot; the resolver must have zero calls.
- Install zero-call throwing spies for optional file reads, `stat`/directory scans, sibling/count loaders, tokenizer import/counting, and any deferred enrichment provider at the producer/enricher boundary. A mutation and minimal watcher observation must schedule candidate admission and settle the operational response/render invalidation path without invoking them. For watcher input, capture/schedule the minimal resource observation before the separate operational trigger-context branch may run existing `buildContext` stats/tokenization; pausing or throwing that branch may affect only trigger behavior under its existing operational contract, never canonical resource scheduling or freshness recovery.
- Prerequisite: register SPEC-40 resource/lifecycle validators and any UI-action validators touched by UI-origin work, then route candidate events through the validation/diagnostic gate before canonical-only subscribers consume them. Source operations remain isolated from provenance failure.
- Emit canonical resource events routed on `resource:*` topics behind a temporary legacy adapter, without removing existing client-facing behavior in this slice.
- Enable canonical lifecycle publication only through accepted SPEC-40 validators/publisher after the 32b0 startup fence passes. Tests prove an accepted synthetic/production `workspace.switched` is eligible for canonical non-render subscribers, never invokes the operational session projection/broadcaster, and creates no durable row before SPEC-35. Renderer lifecycle invalidation remains uninstalled until 32c.
- Limit Slice 32b UI-origin producer work to views whose RSC-D12a exact store selectors are closed; otherwise emit only non-UI/watcher/server-origin resource events until that view's command-time context mapping is defined.
- Keep replacement/removal of `file:changed` and `file_changed` behavior for Slice 32c/32d after the broadcaster and client invalidation path exist.
- Add producer-side failure hooks/tests proving candidate validation rejection, publisher throw, and UEB max-depth/same-event suppression return the successful operational result, record diagnostics, return no accepted reference, and call the shared recovery broadcaster with authoritative workspace/path/operation.

### Slice 32c — Resource Broadcaster

**Goal:** UEB resource and lifecycle events can notify renderer cache.

- Add `lib/ws/resource-broadcaster.js`.
- Subscribe only to validated canonical resource, workspace, view, and theme events needed for `resource:invalidate`.
- For each accepted lifecycle variant, test the exact `resource:invalidate` projection and delivery with zero operational topic/session/broadcaster calls. Production cross-module acceptance remains part of 40b1b.
- Send `resource:invalidate`.
- Add the exact `FreshnessRecoveryMessage` broadcaster and client handlers: resource recovery plus workspace/view-registry/theme lifecycle recovery, including null-workspace detachment semantics.
- Add the private lifecycle route-epoch sidecar and delivery-time currency check. Rapid subsequent transitions must make older initiator-targeted invalidation/recovery a diagnosed no-op rather than applying stale workspace state.
- Test clean replacement and dirty/optimistic protection: a recovery refetch updates clean entries, but stores remote data only in `recoveryRemote` for dirty or optimistic entries while preserving local content, flags, pending operations, undo state, and scroll. Cover lifecycle candidate rejection/publication suppression/throw/projection failure for every scope, including null-workspace dirty-buffer detachment.
- Catch injected mapper/projection failure inside the broadcaster and prove it sends recovery rather than relying on UEB's swallowed/logged subscriber error.
- Client `file-handlers.ts` or new `resource-handlers.ts` translates resource changes to cache invalidation.
- Remove legacy `file_changed` client invalidation behavior only after every current consumer of legacy invalidation is covered by central `resource:invalidate`.

### Slice 32d — Normalize Server Mutation Producers

**Goal:** Remove direct client-broadcast source-of-truth paths.

- Execute this slice as one named producer or an explicitly bounded producer group. Before converting each producer, atomically add its exact entry to `first-package-producers.v1.json` as `planned` with `leaseRole: 'none'`, `commandTypes: []`, exact event/source/observer/handler identity, owning Slice 32d, and review evidence. This semantic registry addition increments `freezeVersion` and regenerates the SPEC-40a active-token table plus SPEC-40b1a validator/authorization allowlists in the same change. A missing or `planned` entry has no publication or lease authority.
- Convert and verify that producer, then promote the unchanged entry to `active` with implementation evidence before enabling canonical publication. The owning 32d unit must load the new registry version atomically with the conversion; it may not reuse an earlier token or enable a handler while only a planned entry is loaded. Focused tests prove absent/planned/wrong-version tokens are rejected without affecting the mutation or recovery path, and only the exact active entry can publish.
- Close RSC-D12a for each UI-origin view/command path before converting that producer.
- Convert `workspace-request-handlers.js` file move/rename/delete to emit UEB events.
- Convert `file-explorer.js` save/create to emit UEB events.
- Migrate `chat-metadata/collectors/file-mutations.js` from `file:changed` / `file_changed` to canonical resource events.
- Preserve exactly one existing workspace-watcher file-change trigger matcher; converted mutation handlers do not call, repoint, recompile, or duplicate it. Slice 32d removes only duplicate legacy match paths and proves, within the current watcher lifecycle, that pausing/failing provenance admission after observation still lets every applicable trigger execute once, no inapplicable trigger execute, and no fallback or mutation handler duplicate a healthy-path execution. Workspace/null repointing and recompilation belong exclusively to Slice 32e after its controller exists.
- Ensure UI-origin context is preserved.
- Keep client response messages such as `file:moved` for command completion, but not as cache invalidation source of truth.
- Remove the temporary legacy invalidation adapter before Slice 32d is complete, after confirming every current legacy invalidation consumer is covered by central `resource:invalidate`.
- Before removing legacy invalidation, run `cd fusion-studio-server && npm test -- --runInBand test/provenance/resource-fallback.test.js` and `cd fusion-studio-client && npm run build`; inject publisher and mapper failures, assert the forbidden workspace-root resolver has zero calls, and record runtime evidence that the mutation succeeds, `resource:refresh_required` is delivered, clean warm/visible resources refetch, and dirty/optimistic state follows the shadow/conflict contract.
- Run `cd fusion-studio-server && npm test -- --runInBand test/provenance/failure-isolation-latency.test.js`; Promise-returning admission hooks are rejected, pre-admission failures cannot gate the mutation, and an unresolved/throwing post-admission projection subscriber cannot block later listeners or the response, revoke its accepted ref, or prevent defined recovery.

### Slice 32e — Watcher Lifecycle

**Goal:** Active workspace watcher follows active workspace.

- Hard blocker: owner-approved/back-validated RSC-D16 supplies the exact watchdog deadlines and semantics before this slice begins. No timeout default is an implementation choice.
- Introduce a workspace watch controller.
- On startup, watch active workspace if present.
- On permanent private `workspace:operational_switched`, synchronously invalidate/repoint the project watcher generation, install the B/null bindings/listeners and current trigger-filter generation, and acknowledge before synchronous operational dispatch returns. Start old-watcher close, new-watcher readiness, and reconciliation as supervised generation-checked tasks; their completion never gates the workspace FIFO or canonical lifecycle scheduling. Canonical `workspace:switched` observes the committed/synchronously installed transition and never controls watcher/trigger lifecycle. The watch controller alone issues unforgeable monotonically unique generation capabilities and owns their currency.
- Own a side-effect-free `parseAndClassifyTriggerDefinitions` boundary that returns explicitly typed file-change blocks, cron blocks, bus blocks, unknown blocks, and diagnostics without registering listeners/actions. Slice 32e validates only exact `type: 'file-change'` blocks against the complete block/condition schemas above, then builds their watcher filters. Missing/unknown types are diagnosed and rejected rather than falling through. Cron and `chat|ticket|agent|system` blocks do not pass through the watcher grammar and are not registered, removed, or reloaded by this API; their existing one-time startup owner remains unchanged until a separate lifecycle migration is approved.
- At startup, load the fixed server watcher-filter directory exactly once into immutable `baseFilterDescriptors`: parsed declarative definitions plus programmatic module descriptors, not filters already closed over the startup root/action handlers. Preserve current per-file skip/diagnostic behavior and reject duplicate identities within `(base, repository-relative module/file path, filter name)`. Slice 32e converts any programmatic filter with workspace/path side effects, including the current theme regenerator, to `createFilter({ workspaceRoot, generation, isCurrent })`; a legacy direct object may remain only when the audit proves it has no workspace/path side effect, and its callbacks are still wrapped by the generation currency check.
- On each watcher generation, instantiate declarative base descriptors with `createActionHandlers` bound to an opaque frozen `{ workspaceRoot, generation }`, never the startup root or a later live lookup. Every filesystem/modal/path action resolves and contains targets against that bound root. It checks `isCurrent(generation)` before work, again after every `await` or asynchronous callback boundary, and immediately before each irreversible filesystem, modal, ticket, or path side effect; stale callbacks diagnose and do nothing. Timers, queued callbacks, and abortable work retain the capability and are cancelled when possible, but cancellation never replaces the final currency check. Instantiate programmatic factories with the same binding/guard. Separately build the active workspace's validated TRIGGERS file filters with identity `(trigger, TRIGGERS.md path, block name)` and the same generation-bound action handlers. Add `workspace-watch-controller.replaceFilters({ baseFilters, triggerFilters, generation })` as the only watcher installation/reload API and remove production `addFilter` loops after migration. It atomically installs the flattened immutable union; same names from different qualified sources remain distinct, while duplicates within one source are rejected. Reload reuses descriptor identity but creates current-generation bindings exactly once; it never retains an A-root closure in B.
- Define the watcher linearization point at synchronous entry to the Slice-32b0 coordinator's dedicated watcher hook, after the server transaction/memory commit established the new authoritative workspace. The hook verifies the next coordinator capability/pair, issues/publishes the B (or null) watcher capability as current, irreversibly invalidates A, synchronously constructs/attaches the B watcher and generation-bound handlers (null attaches none), starts supervised A-close/B-ready/reconciliation tasks with RSC-D16 watchdogs, and returns a non-Promise acknowledgment without waiting. A events/callbacks after the point are stale no-ops. B events may queue under B and execute only with B-bound targets. A ready/close/timer completion cannot restore currency. Every supervised task/watchdog checks currency before effects; current B ready/reconciliation throw or expiry sets bounded `degraded_recovery_pending` and sends exactly one direct freshness recovery, close expiry only diagnoses cleanup, and a later transition cancels/invalidates prior timers/state. Reconciliation never synthesizes trigger execution. Same-workspace trigger reload uses a watcher-local new generation and the same currency/check rules without creating an operational workspace transition. Sequences such as `A -> null -> B` and `A -> B -> C` consume exact adjacent coordinator pairs; obsolete/hung work cannot act on the newer generation or block it.
- On workspace transition, repoint to the new/null watcher with the retained base set plus the new workspace's valid trigger set; a fatal trigger scan/parse failure uses empty `triggerFilters` and never retains old-workspace triggers. On same-workspace trigger config reload, a fatal whole-scan/parse failure retains the last valid trigger set; individual invalid blocks are excluded while valid siblings replace their prior versions. A fatal initial base-directory scan yields an empty base set with a diagnostic, matching current fail-open startup; individual invalid base files remain skipped. Bounded diagnostics distinguish every branch.
- Avoid duplicate subscribers and stale old-root watchers.
- Failure-inject lifecycle candidate/redaction rejection, publisher throw, suppression, and missing route capability after a successful workspace transition; the operational watcher/filter controller still closes the old root, repoints to the new/null root exactly once, and old-root edits cannot trigger or invalidate current-workspace behavior. Failure-inject watcher-resource candidate rejection, publisher throw, and suppression after a filesystem observation; each exposes no ref/reaches no canonical subscriber but every applicable operational trigger still executes exactly once. Separately inject broadcaster projection failure after successful admission; preserve the accepted ref/exact delivery for other canonical subscribers, diagnose the failed projection, and send `resource:refresh_required` without duplicating trigger execution.
- Add table tests for every file-block required/optional/unknown key, required explicit type, event shape/literals/uniqueness, pattern scalar/array/bounds/safety plus frozen `matchesPattern` vectors, action default/exact value, prompt path, string and active plain-object message branches/normalization/bounds/prototype/nesting/value rejection, and prohibited script/function/modal/cron/bus fields. Also cover the exhaustive condition grammar. Test mixed classification; invalid siblings; declarative descriptors; generation-factory programmatic filters; rejection of side-effecting direct objects; duplicate identities; startup; same-workspace errors; workspace-switch fatal scan; null workspace; and repeated reload. In controlled `A -> B`, fire every filesystem/path/modal/ticket action and current theme programmatic filter, pausing each action before and after every await plus immediately before its side effect: B-generation effects must resolve only under B, retained descriptor identities occur once, and paused/stale A callbacks/timers must produce zero A or B side effects after transition. With an injected monotonic clock, test each RSC-D16 close/ready/reconciliation watchdog at minus-one/exact/plus-one, throw, true background nonsettlement, cancellation by later generation, diagnostic/recovery dedupe, stale late completion, and shutdown. Also cover events in the transition gap, B events before ready, and concurrently requested `A -> null -> B`/`A -> B -> C`; assert exact adjacent pairs, synchronous acknowledgments, later transitions/notifier attempts proceed, only current generation may recover/reconcile/act, and no reconciliation executes a trigger. Assert invalid blocks cause zero builder/evaluator/action calls; valid trigger/base filters execute once; cron/bus counts do not change; no listener duplicates/removals occur; diagnostics are bounded; and no old-workspace filter or handler closure remains.

### Slice 32f — Wiki Migration

**Goal:** Wiki uses central resource cache and incremental invalidation.

- Move tree/content requests into cache-backed hooks.
- Stop clearing root/content on ordinary refresh.
- Publish partial tree data as parent folders arrive if needed.
- Update only changed pages/folders.
- Add `fusion-studio-server/test/provenance/wiki-resource-migration.test.js` and `fusion-studio-client/e2e/wiki-resource-migration.spec.ts`; reuse the accepted Slice-32b0 isolated provenance launcher/config/wrapper without changing its authority or cleanup contract. Run `cd fusion-studio-server && npm test -- --runInBand test/provenance/wiki-resource-migration.test.js`, `cd fusion-studio-client && npm run build`, and `cd fusion-studio-client && node e2e/run-provenance-playwright.cjs e2e/wiki-resource-migration.spec.ts`.
- The automated/runtime matrix registers/selects only the run root's workspace fixture through the real workspace API; its isolated database may change `last_active_workspace_id` without touching the developer database or workspace. Before testing, assert the startup marker, live server PID/port, resolved database path, user-data path, and fixture path match the same run nonce/root. It covers app refresh; workspace switch and null workspace; reconnect; external `PAGE.md` edit/create/delete/rename; active-page and parent-folder changes; candidate rejection and recovery; clean replacement versus dirty/optimistic conflict preservation; and retention of selection, history, tree expansion, scroll, dirty buffers, optimistic operations, and undo state. It proves incremental changes do not clear/rebuild the full tree and repeated mount/reconnect does not duplicate listeners. After the Playwright-owned server exits, assert the wrapper removed the full run root; on interruption its signal/exit handlers perform the same cleanup.
- Before acceptance, commit a Wiki migration inventory naming every prior view-local file-resource WebSocket listener, direct cache write, and recursive/full-tree reload path with its replacement/removal evidence. The accepted Wiki scope must have zero remaining production instances of those forbidden paths. The slice report records exact changed files, all three command results, runtime logs/screenshots, inventory evidence, and every temporary adapter plus its owner/removal criterion.

### Slice 32g — Remaining View Migration

**Goal:** Remove view-local file resource WebSocket listeners.

- Execute one explicitly bounded view group per 32g work packet, naming its exact view IDs and source files before edits. Candidate groups are File Viewer legacy hooks; ticket index; agent detail/workflow; `SystemViewer`; `CaptureTiles` and capture-document hooks; and Office/Email manual cache writes. Do not combine unbounded "remaining views" into one acceptance claim. Retire `usePanelData` only in the bounded packet that proves its last consumer is gone.
- Each packet adds `fusion-studio-server/test/provenance/<slice-id>-resource-view-migration.test.js` and `fusion-studio-client/e2e/<slice-id>-resource-view-migration.spec.ts`, reuses the accepted test-only launcher/config/wrapper, then runs `cd fusion-studio-server && npm test -- --runInBand test/provenance/<slice-id>-resource-view-migration.test.js`, `cd fusion-studio-client && npm run build`, and `cd fusion-studio-client && node e2e/run-provenance-playwright.cjs e2e/<slice-id>-resource-view-migration.spec.ts`.
- For every named view, the acceptance matrix uses the wrapper-owned isolated OS-temp user-data/database/workspace run root and verifies its nonce, containment, PID, port, DB path, startup marker, and post-server cleanup. It covers clean update, dirty/optimistic protection, rename/delete fallback, workspace switch/null/reconnect, candidate failure/recovery, state preservation, and listener deduplication. A before/after inventory must prove zero private file-resource WebSocket listeners and zero direct cache writes remain within that packet's named scope; paths outside the named group are reported as deferred, not accepted.
- The packet report records its exact view IDs/source files, changed files, all command results, runtime logs/screenshots, inventory diff, state-preservation evidence, and every temporary adapter plus its owner/removal criterion.

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
8. Run two controlled UI-rename branches. First drain UI admission before creating the resource-producer lease and verify builder-proven `provenance.cause.uiActionId`/ID-bearing origin match the accepted `ui.action`, with active panel/tab/document context and `ids.serverMutationId`. Then pause UI admission until after the resource producer peeks; verify the resource event succeeds with the same non-ID context/server mutation ID but omits UI cause/origin ID without waiting, then release admission and prove no retroactive mutation.
9. Switch workspace.
10. Verify watcher follows new workspace and old workspace edits do not invalidate current UI.
11. Trigger a `TRIGGERS.md` file-change automation.
12. Verify the operational watcher matcher executes the applicable trigger exactly once and React sync receives the corresponding accepted canonical event. Repeat with canonical candidate rejection and verify the trigger still executes once while React uses recovery and no canonical trigger relationship is claimed.
13. During migration slices, explicitly named temporary adapters are allowed only with removal criteria. After Slice 32d and final completion, verify no remaining production path emits or consumes `file_changed` or `file:changed` for cache invalidation, metadata collection, trigger filtering, ledger input, or any other runtime behavior.
14. For both a valid server mutation and safely established watcher observation, inject candidate rejection, publisher throw, and UEB suppression before admission: assert no accepted ref, no canonical delivery, diagnostic, and recovery. Separately inject broadcaster projection failure after successful admission: assert the accepted ref remains valid, `assertAcceptedDelivery` still passes for the frozen event, other canonical subscribers receive it, only the broadcaster projection fails, and recovery is sent. In all branches preserve the mutation/observed fact. Seed `LOCAL_UNSAVED`, optimistic/undo/scroll state, and remote `REMOTE_CHANGED`; assert conflict shadow semantics and reconnect freshness rules.
15. For workspace switch (including null), view-registry change, and theme change, inject lifecycle validation/redaction rejection, publisher throw, UEB suppression, and post-admission projection failure. Assert exact `lifecycle:refresh_required` reason/scope/routing, no pre-admission ref/delivery, preserved post-admission ref/other subscribers, and no dirty/optimistic/navigation loss during rewarm. Pause delivery across rapid `A -> null -> B` and `A -> B -> C` transitions and prove stale normal invalidation, projection recovery, and direct recovery never alter the initiator's newer state; separately prove same-workspace `user_switch` is a no-event branch.

---

## First-Slice Decision Status

No additional SPEC-32-local owner-value blocker remains beyond `RSC-D17` for 32b0 and `RSC-D16` for later watcher/Wiki migration Slices 32e/32f. The currently reviewed 32a-through-40b1b decision batch also remains blocked by SPEC-40's `UEB-D01`. The first package cannot be assembled/frozen for orchestrator handoff until D17 and D01 are owner-approved, propagated, and clean-reviewed; 32e/32f additionally require D16. All implementation still requires the applicable packet approval per this spec's `DISCUSSION DRAFT` status.

---

## Completion Criteria

- One chokidar/watch pipeline feeds canonical UEB resource events.
- Server-side file mutations and watcher mutations use the same event path.
- Renderer cache invalidation is a UEB subscriber output, not ad hoc direct broadcast.
- Built-in views no longer own private file resource WebSocket listeners.
- Wiki updates incrementally and does not destroy/rebuild its DOM for ordinary file changes.
- The operational watcher fact retains the current fields required by TRIGGERS; accepted canonical resource metadata remains available to future provenance subscribers without becoming trigger authorization.
- Accepted UI-action provenance includes best-available panel/tab/document context; missing context or provenance-publication failure is explicit and does not fail the mutation.
- Candidate validation rejection, publisher throw, acknowledged UEB suppression, and projection failure each send `resource:refresh_required` with authoritative workspace/reason/path hints only to matching-workspace clients.
- Recovery preserves panel/tab/selection/navigation/history, scroll, dirty buffers/flags, optimistic operations, and undo state. Clean warm/visible entries replace from refetch; dirty/optimistic entries retain local state, store the remote response in `recoveryRemote`, and remain `conflict_pending`. Reconnect uses the same rules and never claims full freshness while stale/conflicted entries remain.
- Failure-injection tests prove the mutation succeeds, no accepted/dangling reference leaks, canonical-only subscribers do not see the candidate, and the renderer cannot remain silently stale.
