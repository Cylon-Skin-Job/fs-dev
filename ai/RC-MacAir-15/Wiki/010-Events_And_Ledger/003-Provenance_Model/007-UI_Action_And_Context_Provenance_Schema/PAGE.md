---
name: UI Action And Context Provenance Schema
description: Implemented mediated-save UI context and the boundary to future general UI-action provenance.
metadata:
  source-files:
    - fusion-studio-client/src/lib/save-action-context.ts
    - fusion-studio-client/src/components/view-tabs/fileConnectedTabs.ts
    - fusion-studio-client/src/state/fileDataStore.ts
    - fusion-studio-server/lib/ws/file-save-route.js
    - fusion-studio-server/lib/file-mutations/reported-ui-context.js
    - fusion-studio-server/lib/file-mutations/file-operation-repository.js
    - fusion-studio-server/lib/file-mutations/fact-reservation-bindings.js
    - fusion-studio-server/lib/ledger/resource-provenance-repository.js
    - fusion-studio-client/src/lib/ws/resource-provenance-protocol.ts
  last-modified: "2026-09-19T11:52:20Z"
---

Status: source inspected on 2026-09-19 in the development checkout. Optional `reportedUiContext` on mediated saves is implemented. A general `ui.action` event, `uiActionId` envelope and per-view prompt-attachment provenance adapters are not implemented. Tests were inspected, not rerun; no app or Alpha behavior is certified.

## Current save-context contract

`fileDataStore.saveFile` calls `readSaveActionContext(panel)` for the versioned save request. The argument is the initiating document's panel, not an inferred currently focused panel. The synchronous reader requires a current workspace ID and a matching registered panel configuration. It reports workspace/view identity and reads tab/component details only from a live connected File owner matching that workspace and view. Missing owner, non-component tab, missing values or read failure omits fields or the whole context; it never invents identities or writes view state.

| Field | Current handling |
|---|---|
| `workspaceId` | Renderer echo; server derives authority from the captured session workspace/epoch. A supplied mismatching or invalid echo omits context. |
| `viewId` | Required for retained context; renderer checks panel registration. Server checks scalar shape, not actual current panel/tab existence. |
| `tabId`, `componentTypeId`, `componentInstanceId`, `presenterId` | Optional connected-owner values, each limited to 128 UTF-8 bytes. |
| `viewInstanceId` | Supported optional carrier field, not populated by the current reader. |
| `targetKey` | Optional opaque component target, up to 512 UTF-8 bytes; not path authority or a resource ID. |

Workspace/view and other identifier strings use the same 128-byte scalar bound. The server's `sanitizeReportedUiContext` drops unknown or malformed fields, requires usable view identity and substitutes the server workspace. It emits fixed noncanonical omission/degradation diagnostics. Sanitization precedes schema validation so optional context cannot reject an otherwise valid save. Syntactically valid tab/component values can still be stale or fabricated; the server does not verify the existence of the current tab. The save's workspace/epoch, content and path authorization remain independently enforced.

## Persistence and query chain

The save route passes sanitized context to the save owner. `file-operation-repository.js` stores its dedicated reported-context columns; `fact-reservation-bindings.js` reconstructs context from that durable operation into `file.command_accepted@1` and `resource.mutated@1`. The resource ledger projection stores the admitted mutation payload and query columns. Resource provenance queries return it under `origin.reportedUiContext`; the client response validator checks the bounded shape and current workspace pair.

This is a historical snapshot. Later tab closure or configuration changes do not rewrite the record, and provenance writes nothing back into the view's live `state.json`. `queryResourceProvenance` and response plumbing exist, but the bounded production client search finds no caller mounting a history/audit display. A query transport does not establish a user-facing UI.

Origin remains a reported local-client fact with `transport_only` assurance, not authenticated human identity or a direct causal proof. A tab, component, connection or target key is not a grant. Required save preimages and optional context have different failure rules; see [Resource Mutation Provenance](../003-Resource_Mutation_Provenance_Schema/PAGE.md) and [Ledger Event Provenance](../004-Ledger_Event_Provenance_Schema/PAGE.md).

## Approved granularity and remaining design

T1 domain mutations are durable/searchable; T2 UI action context belongs with the mutation as evidence. T3 ambient interaction such as focus, opening a tab, navigation or reordering is not durably recorded as provenance. Potential reaction-only telemetry is a separate future bus decision; scroll/geometry is excluded. These are coverage goals, not a claim that every current command emits history.

Keep workspace, immutable view, visible thread group, chat session, transient surface and tab/component identities separate. Tab/component identity belongs in context, never actor identity. The adopted actor taxonomy recognizes human, assistant, trigger, scheduler, script, sync, import, agent, system, external and unknown; it does not turn reported context into authenticated authorship. [Chat Metadata Provenance](../001-Chat_Metadata_Provenance_Schema/PAGE.md) describes the current Chat boundary.

The [UI Action Provenance Module](../../011-UI_Action_Provenance_Module/PAGE.md) retains the first Wiki/File direction and its unresolved implementation boundary. Before broader UI-action publication, decide the actual command coverage, identity/relationship schema, server admission, sensitive-field policy, executor capacities and lifecycle, and the live context selectors for each view. Older token, accepted-reference and safe-core examples are design input, not current wire contracts. They neither block accepted save context nor authorize a new producer.
