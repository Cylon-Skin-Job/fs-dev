---
name: UI Action And Context Provenance Schema
description: Schema guidance for client-originated actions, active view context, active resources, file commands, and send-to-chat operations.
metadata:
  incoming-edges:
    - Events Provenance Model
  outgoing-edges:
    - Chat Metadata Provenance Schema
    - Resource Mutation Provenance Schema
    - Ledger Event Provenance Schema
    - UI Action Provenance Module
  source-files:
    - fusion-studio-client/src/state/slices/viewSlice.ts
    - fusion-studio-client/src/state/activeResourceStore.ts
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-server/lib/ws/workspace-request-handlers.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before changing client-originated commands, active resource capture, send-to-chat metadata, or file save/create/move/rename/delete requests.

UI action provenance captures what the human did in Fusion Studio and what was active when the command was sent.

## Boundary

The renderer sends tentative non-ID active view, panel, tab, document, route, selected resource path, and similar UI context known at command time. The accepting server captures workspace ID/root/transition from the coordinator's `WorkspaceCommandContextRef`; session workspace/root fields are caches only. Renderer context/resources qualify only when the exact private workspace token binds to that same command ref and the server re-resolves paths/targets under it. The client token lives only in one memory-only slot keyed by the exact current OPEN WebSocket, outside all state caches and persistence, and is synchronously cleared on init/switch replacement, close, disconnect, socket replacement, and shutdown. First-package `ui.action` is a root canonical fact and omits root, parent, and causation IDs; any future UI relationship requires an exact SPEC-40 candidate/source selector and accepted capability. The server attempts an optional fresh correlation for the new chain. Successful generation inserts it through a private fresh-correlation binding; generator absence/throw, allocation, or registration failure omits only `ids.correlationId`, reports fixed `fresh_correlation_unavailable`, and leaves the otherwise safe UI fact and command unchanged. No renderer/client/session/operation/raw correlation is copied as fallback. Raw event/causation IDs in mutable session/operation state never qualify. Unknown legacy renderer relationship-ID fields are discarded. After successful workspace binding, missing optional UI details may remain null/unknown without blocking the command. Missing/stale/forged/wrong-connection binding or root/target mismatch creates no canonical `ui.action`, ID, ref, mirror, or edge and reports only exact frozen `{ code: 'workspace_context_unbound' }` to the dedicated one-key, process-memory counter sink; no token, path, workspace, connection, transition, attachment, reason, or exception value is retained. The command still proceeds.

Renderer input is not a durable canonical event by itself. After independently accepting the source command, the server starts the operational path and submits UI safe-core construction/redaction/validation/admission to the supervised executor outside the command/response chain. The command never invokes or awaits provenance or an accepted-ref promise. Accepted events eventually reach canonical subscribers; a downstream producer uses an already-filled ref slot through `prepareCanonicalCandidate` or omits the relationship and diagnoses without waiting. Optional enrichment is included only when already available.

Only after successful workspace binding, missing/failed/thrown first-pair UI redaction may use the exact safe core `redaction = { status: 'failed', policyId: 'ui-resource-metadata-v1', policyVersion: '1', omissions: ['/*:redaction_failed'] }`; both policy values are strings. It omits optional context/IDs/client correlation/result mirrors, carries empty resources, and contains no free-text summary, prompt, or content. Workspace binding failure is not redaction failure and cannot use this core.

For the owner-approved first adapter pair, the migrated command is `chat.send_with_resource` when Wiki Viewer or File Viewer is the active panel and the prompt actually sends at least one valid pending resource attachment. Attachments may originate in any panel; every valid attachment remains a subject resource and its origin does not choose the active-context adapter. Merely navigating, selecting, or staging an attachment does not emit `ui.action`.

## Domain Payload

```js
{
  schemaVersion: 1,
  eventId,
  eventFamily: 'ui',
  eventType: 'ui.action',
  occurredAt,
  ids,
  actor: { type: 'human' },
  provenance,
  context,
  uiAction: {
    uiActionId,
    clientCommandId,
    command
  },
  resources: [],
  redaction
}
```

This is the exact first-package shape after successful workspace binding: `redaction` is required; lifecycle, ledger, actor ID, input summary, and result/resource mirrors are absent. `context` is required for full success and absent only in the exact failed-redaction safe core. Failed binding produces no candidate rather than a partial shape.

`uiAction` describes user intent and command/request context. Resource mutations, tool calls, and chat turns describe the consequences.
Active document and thread context belong in the shared `context` and `ids` fields. `uiAction` may keep snapshots only when a value is intentionally different from the canonical context at event time.

Connection/client/receiver identifiers remain transient server-owned routing state and are not first-pair canonical or ledger fields. They are not authorization, stable identity, or causality. The server may use routing values in non-canonical diagnostics or future approved multi-client metadata, but the renderer does not echo them and their absence never blocks a prompt.

After the operational path starts and workspace binding succeeds, the server admission task generates the canonical `uiActionId`. The optional renderer `clientCommandId` must match `[A-Za-z0-9_-]{1,128}` and remains non-authoritative client correlation, never a fallback for canonical `ids.correlationId`. Invalid client correlation is omitted without suppressing an otherwise valid UI fact. Canonical correlation is separately optional and server-generated through SPEC-40's nullable fresh binding; unavailable/thrown generation omits that independent group only. Individually optional active UI details enrich the record when available; no other renderer correlation or relationship ID is accepted. Missing optional details degrade to null/unknown/omission state. The server accepts renderer input only through SPEC-34's fixed-schema nonrecursive bounded extractor and retains no original seed reference. Binding or extraction failure emits no record and only a non-sensitive fixed diagnostic. Neither branch fails or delays the source interaction.

Exact Wiki Viewer and File Viewer selector mappings are normative in the [UI Action Provenance Module](../../011-UI_Action_Provenance_Module/PAGE.md) and its child pages. For this pair, `context.route` and `context.selectedResourceId` are explicitly `null` because no authoritative source exists; an attachment ID is not promoted into either field.

## Connections

- Chat metadata captures UI context at prompt acceptance.
- Registered downstream mutations can use `provenance.cause.uiActionId` only when `prepareCanonicalCandidate` inserts it from the already-available accepted `ui.action` ref and records private proof; a copied accessor string, raw server candidate, or renderer value never qualifies.

First-package 40b1a leaves existing `chat:*` facts on a named non-canonical compatibility path and does not add `uiActionId` to them. Exact chat cause/result linkage begins only after `CHAT-D01` closes and SPEC-40b2a registers the affected chat schema and redaction policy; chat publication never waits for the UI ref.
- Resource events and file versions can point back to UI-origin commands.
- Ledger records distinguish local user actions from assistant, automation, and external changes.
- Audits can answer what view/document/tab was active when a mutation or chat send happened.

## Gaps To Close

- Most UI commands do not carry canonical `uiActionId`.
- Existing numeric view-state `clientMutationId` exists only for some view-state writes and is not a provenance identifier. UI action provenance uses `clientCommandId` when a client-side command correlation ID is needed.
- Active resource state is mostly client-only and is not consistently attached to server commands.
- Multi-client initiator/receiver identity remains a deferred routing/audit design and is not part of the first-pair canonical payload.
