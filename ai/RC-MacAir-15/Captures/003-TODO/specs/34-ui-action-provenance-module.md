# SPEC-34 — UI Action Provenance Module

> **SUPERSEDED SNAPSHOT — DO NOT IMPLEMENT.** The current planning authority is [SPEC-34 in `008-Provenance-Temp`](../../008-Provenance-Temp/34-ui-action-provenance-module.md), its [spec-set map](../../008-Provenance-Temp/00-provenance-spec-set-map.md), and linked wiki authorities. This notice was reinforced by the [2026-07-15 provenance cross-article findings](../../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat to correct misleading guidance.

**Status:** DISCUSSION DRAFT. Do not implement until this spec is reviewed and approved.  
**Related wiki:** [UI Action Provenance Module](../../../Wiki/010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md)  
**Depends on:** [SPEC-32 resource event contract](32-resource-event-sync-controller.md), [Events Provenance Model](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md), [UI Action And Context Provenance Schema](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md), [Resource Mutation Provenance Schema](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md)  
**Supports:** Provides the central contract for closing [SPEC-32](32-resource-event-sync-controller.md) `RSC-D12a`; each view/command path remains blocked until its adapter page names exact selectors/stores.

---

## Mission

Build one renderer-side module that captures UI-origin command context and produces a universal command envelope for mutation-producing UI actions.

The goal is not to list every button. The goal is to route every resource, document, and chat mutation entry point covered by this spec through one provenance boundary so downstream resource and durable chat events can answer:

- Which human UI action initiated the mutation?
- Which view, panel, route, tab, document, or selected resource was active?
- Which resources were the subject, parent, old parent, new parent, or related context?
- Which server resource mutation, chat, prompt, or turn events resulted from the UI action?

## Non-Goals

- Do not build file versioning in this spec.
- Do not replace the resource cache/store work in SPEC-32.
- Do not create per-view provenance models.
- Do not track non-mutating UI telemetry unless a later spec explicitly adds it.
- Do not infer UI context on the server when the renderer can provide it.

## Contract

The module outputs a universal `UiActionCommandEnvelope`:

```ts
type UiActionCommandEnvelope = {
  uiActionId: string;
  clientCommandId?: string;
  command: string;
  ids: {
    workspaceId: string;
    threadId?: string;
    turnId?: string;
    rootEventId?: string;
    parentEventId?: string;
    correlationId?: string;
    causationId?: string;
  };
  context: {
    scope: 'ui';
    connectionId?: string;
    clientId?: string;
    viewId: string;
    panelId?: string;
    route?: string;
    activeTabId?: string | null;
    activeDocumentPath?: string | null;
    activeResourcePath?: string | null;
    selectedResourceId?: string | null;
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
  provenanceInput: {
    origin: { type: 'ui'; id: string };
    confidence: 'direct';
  };
  inputSummary?: string;
};
```

Mutation-producing UI actions require non-null `ids.workspaceId` and `context.scope = 'ui'`.
The module must capture `connectionId` from the server `connected` WebSocket message and make it available to command-time context capture; this likely requires updating `fusion-studio-client/src/lib/ws-client.ts`, `fusion-studio-client/src/types/index.ts` / `WebSocketMessage`, or a small client connection store.

`provenanceInput` is renderer-supplied domain input, not canonical event provenance. The canonical `ui.action` event emitted by the server assigns `provenance.source` and `provenance.observedBy` at the accepting server ingestor, while preserving `provenance.origin = { type: 'ui', id: uiActionId }`.

## UI Action Event

Mutation-producing UI commands must cause the first accepting server handler to emit a canonical `ui.action` event on the server Universal Event Bus:

```ts
{
  schemaVersion,
  eventId,
  eventFamily: 'ui',
  eventType: 'ui.action',
  occurredAt,
  lifecycle?,
  ids,
  actor: { type: 'human' },
  provenance: {
    source: { type: 'server-ui-action-ingestor' },
    origin: { type: 'ui', id: uiActionId },
    observedBy: { type: 'server-ui-action-ingestor' },
    confidence: 'direct'
  },
  context,
  resources,
  redaction?,
  ledger?,
  uiAction: {
    uiActionId,
    clientCommandId,
    command,
    inputSummary,
    receiverConnectionIds: [],
    resultEventIds: [],
    resourceEventIds: []
  }
}
```

`schemaVersion`, `eventId`, `occurredAt`, optional `lifecycle`, optional `redaction`, and optional `ledger` follow the canonical `UiActionEvent` shape in SPEC-32.

Persistence may be deferred to a ledger subscriber, but UEB emission is not optional for migrated mutation-producing UI command paths.

The `ui.action` event itself must not self-reference its own `uiActionId` in `provenance.cause`. Downstream resource mutation events caused by the command carry `provenance.cause.uiActionId`.

## Universal Commands

Initial command vocabulary:

| Command | Used for |
|---|---|
| `resource.create` | File/folder/page/symlink/resource creation. |
| `resource.rename` | Rename within the same parent. |
| `resource.move` | Move across parents. |
| `resource.delete` | Delete/remove resource. |
| `resource.save` | Save content to an existing resource. |
| `document.create` | Create durable document. |
| `document.save` | Commit document edits. |
| `document.import` | Import/upload durable document or resource. |
| `chat.send_with_resource` | Send chat with explicit resource context. |
| `resource.export` | Export/copy when it mutates app-managed durable state. |

New command names must be added to both this spec and the wiki article before use.

`resource.move` is UI command intent only. Downstream canonical resource mutation events still use `eventType: 'resource.renamed'`, `operation: 'rename'`, and old/new parent context.

## Module Pieces

Suggested client modules:

| Module | Responsibility |
|---|---|
| `ui-action-id` | Create typed IDs such as `uia_*` and `uicmd_*`; do not reuse React keys, tab IDs, view IDs, or existing numeric view-state `clientMutationId` values as provenance IDs. |
| `ui-action-registry` | Own universal command vocabulary and metadata. |
| `ui-context-capture` | Create `uiActionId`, preserve `clientCommandId`, and capture command-time context. |
| `ui-resource-normalizer` | Convert local paths/selections into normalized `resources[]`. |
| `ui-action-dispatch` | Wrap mutation command dispatch and attach the envelope to server requests. |
| `ui-action-adapters/*` | Per-view selector/resource mapping adapters. |

Exact file paths can be chosen during implementation, but the module boundary and data shape are contract-bearing.

## View Adapter Contract

Each migrated UI-origin view/command path must document and implement an adapter mapping.

Required mapping outputs:

| Output | Requirement |
|---|---|
| `viewId` | Stable active view ID. |
| `panelId` | Active panel when panel-scoped. |
| `route` | Current route when available. |
| `activeTabId` | Active tab/document tab when applicable. |
| `activeDocumentPath` | Workspace-relative active document path when applicable. |
| `activeResourcePath` | Workspace-relative active resource path when applicable. |
| `selectedResourceId` | Stable selected resource ID when applicable. |
| `resources[]` | Normalized resource refs using shared provenance shape. |

The adapter must document which local selector/store provides each output. If a field is not applicable, the adapter should say so explicitly.

## Server Handoff

The renderer constructs the command envelope and UI-action domain inputs. The first server handler that accepts a UI action envelope validates/redacts that envelope, constructs the canonical `ui.action` event, and emits it on the server Universal Event Bus before or alongside downstream command handling. The canonical `ui.action` record uses the accepting server ingestor for `provenance.source` and `provenance.observedBy`, preserves `provenance.origin = { type: 'ui', id: uiActionId }`, and downstream `resource.*` events use the server mutation producer.

Server handlers that receive a UI action envelope must:

- Preserve `uiActionId`.
- Preserve command-time `context` unless a field is invalid or redacted.
- Preserve normalized `resources[]` and add server-derived resource refs when useful.

Resource mutation handlers must:

- Attach `provenance.cause.uiActionId` to downstream canonical `resource.*` events.
- Set downstream resource mutation `provenance.source` and `provenance.observedBy` to the server mutation producer; preserve `provenance.origin = { type: 'ui', id: uiActionId }` and `provenance.cause.uiActionId`. Do not copy the UI action event provenance wholesale.
- Generate or propagate `ids.serverMutationId` on every downstream resource mutation produced by a server-side mutation command.

Chat handlers for `chat.send_with_resource` must link resulting chat, prompt, or turn events to the `uiActionId` through `provenance.cause.uiActionId`, ledger/result edges, or a future explicit update event. They must not mutate the already-emitted `ui.action` event. If the chat command also causes a resource mutation, downstream resource events carry `ids.serverMutationId` and `provenance.cause.uiActionId`; resource/result links belong in ledger/result edges or an explicit update event unless they were known before initial `ui.action` emission.

The `ui.action` event itself must not self-reference its own `uiActionId` in `provenance.cause`.

## Migration Slices

### Slice 34a — Audit Current UI Mutation Entry Points

- Identify mutation-producing command paths in Wiki, File Viewer, Capture, Office, Email, and shared file APIs.
- Record whether each path starts from button, menu, keyboard shortcut, drag/drop, autosave, command palette, or view-local handler.
- Do not wire events yet.

### Slice 34b — Central Module Skeleton

- Add central UI action command envelope builder.
- Add `uiActionId` creation.
- Add normalized resource ref helper.
- Add command registry with the initial universal vocabulary.
- Unit test envelope construction and resource normalization.

### Slice 34c — First Adapter Pair

- Implement adapters for Wiki and File Viewer first, matching SPEC-32 priority.
- Document selectors in per-view child articles before wiring mutation-producing commands.
- Verify `RSC-D12a` is closed for each command path before conversion.

### Slice 34d — Server Handoff

- Attach UI action envelope to server mutation or durable chat requests.
- Emit the canonical `ui.action` event on the server Universal Event Bus at the first accepting handler.
- Preserve `uiActionId` into downstream `resource.*`, chat, prompt, or turn events as `provenance.cause.uiActionId` or result links.
- Keep legacy command acknowledgement messages separate from cache invalidation truth.

### Slice 34e — Remaining View Adapters

- Add Capture, Office, Email, and other mutating view adapters as their migration slices reach UI-origin commands.
- Each adapter gets a small mapping page, not a separate provenance model.

## Completion Criteria

- Mutation-producing UI commands use one central envelope shape.
- Downstream resource mutation events caused by UI commands carry `provenance.cause.uiActionId`.
- UI-origin mutation events have non-null workspace ID and command-time context.
- Wiki and File Viewer adapters are documented and implemented first.
- Server-side inference is not used for UI-origin context except malformed legacy requests during migration.
- SPEC-32 `RSC-D12a` is closed for every migrated UI-origin view/command path.
