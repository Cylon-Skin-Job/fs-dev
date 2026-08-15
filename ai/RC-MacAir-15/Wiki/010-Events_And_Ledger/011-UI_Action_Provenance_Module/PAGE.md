---
name: UI Action Provenance Module
description: Central client module contract for capturing UI-origin command context, normalized resources, and handoff to server-owned UI action provenance.
metadata:
  incoming-edges:
    - Events And Ledger
    - UI Action And Context Provenance Schema
    - Resource Event Sync Controller
  outgoing-edges:
    - Events Provenance Model
    - Resource Mutation Provenance Schema
    - Events And Ledger Decisions
  source-files:
    - fusion-studio-client/src/state/slices/viewSlice.ts
    - fusion-studio-client/src/state/slices/chatSlice.ts
    - fusion-studio-client/src/state/activeResourceStore.ts
    - fusion-studio-client/src/state/fileDataStore.ts
    - fusion-studio-client/src/state/panelStore.ts
    - fusion-studio-client/src/state/workspaceStore.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-client/src/state/wikiStore.ts
    - fusion-studio-client/src/state/fileStore.ts
    - fusion-studio-client/src/hooks/useFileTree.ts
    - fusion-studio-client/src/hooks/useTileFileActions.ts
    - fusion-studio-client/src/hooks/useDocViewerState.ts
    - fusion-studio-client/src/components/file-explorer/FileExplorer.tsx
    - fusion-studio-client/src/components/file-explorer/FolderNode.tsx
    - fusion-studio-client/src/components/file-explorer/FileNode.tsx
    - fusion-studio-client/src/components/SendToChatButton.tsx
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-client/src/components/Modal/DragFileModal.tsx
    - fusion-studio-client/src/components/office/OfficeGrid.tsx
    - fusion-studio-client/src/components/office/OfficeDocumentPage.tsx
    - fusion-studio-client/src/components/email/EmailGrid.tsx
    - fusion-studio-client/src/lib/chat-action.ts
    - fusion-studio-client/src/lib/resource-path.ts
    - fusion-studio-client/src/lib/ws-client.ts
    - fusion-studio-client/src/lib/ws/file-handlers.ts
    - fusion-studio-client/src/lib/ws/workspace-handlers.ts
    - fusion-studio-client/src/types/index.ts
    - fusion-studio-client/src/types/file-explorer.ts
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/server.js
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-server/lib/ws/workspace-request-handlers.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/file-explorer.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before implementing UI-origin file/resource mutations, view command wrappers, send-to-chat resource attachments, or view adapter mappings.

The UI Action Provenance Module is the renderer-side boundary that turns local user commands into normalized UI-action inputs for server-side canonical event materialization. It uses one universal command/context shape across views, with small per-view adapters that read local state and map local resources into the shared provenance envelope.

## Purpose

The module answers: what did the human do, from which view/panel/tab/document, against which resource, and what durable ID should downstream resource mutations reference?

It exists so each view does not invent its own provenance logic. Buttons, menus, keyboard shortcuts, drag/drop, autosave, command palette actions, and view-local command handlers should all enter the same module before sending a mutation command to the server.

## Boundary

The renderer is authoritative for UI-origin active context at command time. The server should not reconstruct active view, active tab, selected resource, active document, or route context when the renderer already knew it.

The server remains authoritative for the resulting resource mutation event. Server handlers attach `provenance.cause.uiActionId` only after the upstream action was accepted and preserve valid normalized context/resources from the command input.

Watcher-observed changes must not pretend to be UI-origin. If a watcher event cannot be linked to a known `uiActionId`, it remains external, unknown, or correlated according to the provenance model.

## Module Responsibilities

The renderer module should provide:

- Optional `clientCommandId` creation or preservation using `uicmd_*`; it creates or accepts no `uiActionId`, canonical ID, or domain relationship ID and does not reuse React keys, tab IDs, view IDs, or existing numeric view-state `clientMutationId` values.
- Universal command naming.
- Command-time context capture.
- Normalized resource reference capture.
- UI action domain inputs for server-side `ui.action` materialization.
- Command envelope attachment for server requests.

The separate server admission module should provide typed durable `uiActionId` creation using `uia_*`, only inside the post-command-acceptance supervised admission task. In the implementation sequence, renderer-only Slice 34b owns the first list and has no server-ID work; server handoff Slice 34d1 owns the second list and rejects/ignores any renderer-supplied `uiActionId`.
- A per-view adapter registry.

It should not own resource cache invalidation, server mutation execution, file versioning, or ledger persistence.

## Universal Command Vocabulary

Command names should describe intent, not the button or component that triggered it.

Initial vocabulary:

| Command | Meaning |
|---|---|
| `resource.create` | Create a file, folder, page folder, symlink, or view-backed resource. |
| `resource.rename` | Rename a resource without changing its parent. |
| `resource.move` | Move a resource across parents. |
| `resource.delete` | Delete a resource. |
| `resource.save` | Save content to an existing resource. |
| `document.create` | Create a durable document through a document-oriented view. |
| `document.save` | Commit document edits to durable storage. |
| `document.import` | Import/upload durable content. |
| `chat.send_with_resource` | Send chat text with explicit resource context. |
| `resource.export` | Export or copy durable data to another resource/location when it mutates app-managed state. |

View adapters may define narrower local command names internally, but the module output should use the universal command where one exists. New universal commands require updating this article and the UI action spec.

`resource.move` is UI command intent only. Downstream canonical resource mutation events still use `eventType: 'resource.renamed'`, `operation: 'rename'`, and old/new parent context.

## Universal Envelope

```ts
type UiActionCommandEnvelope = {
  clientCommandId?: string;
  command: string;
  context: {
    scope: 'ui';
    viewId: string;
    panelId?: string;
    route?: string | null;
    activeTabId?: string | null;
    activeDocumentPath?: string | null;
    activeResourcePath?: string | null;
  };
  resources: Array<{
    operationalAttachmentIndex?: number;
    role: 'subject' | 'parent' | 'old-parent' | 'new-parent' | 'related';
    resourceType: string;
    path?: string;
    oldPath?: string;
  }>;
};

type UiActionPrivateSeed = {
  workspaceCommandContextToken?: string;
  envelope?: UiActionCommandEnvelope;
};

type UiActionQueuedEnvelope = Readonly<{
  clientCommandId?: string;
  command: string;
  context: Readonly<{
    scope: 'ui';
    viewId: string;
    panelId?: string;
    route?: string | null;
    activeTabId?: string | null;
    activeDocumentPath?: string | null;
    activeResourcePath?: string | null;
  }>;
  resources: readonly Readonly<{
    operationalAttachmentIndex?: number;
    role: 'subject' | 'parent' | 'old-parent' | 'new-parent' | 'related';
    resourceType: string;
    path?: string;
    oldPath?: string;
  }>[];
}>;

type ExtractedUiActionSeed = Readonly<{
  workspaceCommandContextToken?: string;
  queuedEnvelope?: UiActionQueuedEnvelope;
}>;

// The prompt accepts this wrapper only at top-level `uiActionSeed`.
```

`operationalAttachmentIndex` is private seed correlation, optional in the future-generic envelope type but required on every first-pair `chat.send_with_resource` subject. The renderer copies each provenance-valid subject's original zero-based position in the already-fixed operational attachment array; gaps are allowed, but indices are strictly increasing and unique. The server direct-reads only those positions from the already-required validated attachment vector, copies the closed five-field target data, and strips both index and server ordinal before canonical construction. Neither value reaches UEB, logs, diagnostics, ledger, or output.

The private token is exact `wctx_` plus 43 base64url characters generated from 32 CSPRNG bytes. Init/switch may carry an already-available top-level token but never calls or awaits entropy; otherwise detached asynchronous allocation later sends exact recipient-only `workspace:context_token` with workspace ID/root/token. Panel config only echoes an already-installed token and never replaces it. Absence is degraded metadata and never blocks workspace/panel handling. The renderer owns exactly one module-private memory-only slot keyed by the current WebSocket object, outside Zustand, workspace/panel/view caches, state pushes, local/session storage, IndexedDB, URL/history, Electron persistence, and serialized snapshots. Every init/switch clears before optional install; the metadata update installs only after exact current socket/workspace/root equality; close, explicit disconnect, replacement, and shutdown clear synchronously before another prompt read. A prompt reads only for the exact current OPEN socket, so a new connection starts null and stale workspace state cannot restore a token. The allocator checks all live tokens and makes at most four abort-aware async CSPRNG attempts; rejection/collision consumes one, context change aborts/discards late completion, and exhaustion sends nothing with fixed value-free diagnostic. Two connections never share a bound token, and shared broadcaster objects/buffers contain none. Prompt echo is accepted only at `uiActionSeed.workspaceCommandContextToken`; the UI envelope itself never contains it. Other, inherited, duplicate, malformed, array, or alternate nested locations are ignored by runtime binding. Token-bearing inbound messages have no payload/type logger path; only a fixed private counter increments after original handling.

`RSC-D17` is OWNER APPROVAL REQUIRED before SPEC-32b0 activates that allocator or token transport and before first-package assembly. It defines exact global/per-connection executor queue item/byte caps, concurrency/fairness, enqueue/eviction/drop behavior, cancellation/finalizer deadlines including abort-ignoring providers, per-job retained context/provider byte and lifetime caps, live-token binding count/byte caps and cleanup, shutdown/restart, and fixed value-free saturation diagnostics. Byte accounting defines measured job/binding representation/encoding, object/provider-wrapper overhead, shared-ref apportionment, queued/active/cancelling/live ownership, charge/release points, cap precedence, and bounded cap-plus-one measurement. Unadmitted, evicted, cancelled, expired, saturated, or otherwise failed work installs/sends nothing, releases only bounded state, and never retries or affects init, transitions, panels, prompts, connection lifecycle, or source operations. No capacity/accounting/default may be inferred.

The renderer envelope contains no event/domain relationship IDs. Mutation handlers resolve authoritative workspace/path from the coordinator-captured operational command context or an explicit authorized workspace argument; session workspace/root fields are caches only. Chat thread/turn and selected-resource identity may come from their authoritative server operational facts. First-package `ui.action` is a root canonical fact and omits root, parent, and causation IDs; a future UI relationship requires an exact SPEC-40 candidate/source selector and accepted capability. The server may attempt optional fresh correlation through SPEC-40's nullable private generator. Unavailable/thrown generation omits only correlation with fixed `fresh_correlation_unavailable`; it never suppresses the safe UI fact, affects the command, or copies client/caller/session/operation/raw correlation as fallback. Raw event/causation IDs in mutable state never qualify. Unknown legacy ID-bearing renderer fields are discarded. Non-mutating UI telemetry is out of scope unless a later article defines a separate type.

Connection/client/receiver identifiers remain transient server-owned routing state. They are not first-pair canonical or ledger fields, authorization, stable identity, or causality. The renderer does not echo them for this module. The server may use its own routing state in non-canonical diagnostics or future approved multi-client metadata without making prompt acceptance depend on it.

After the operational path starts, the Slice-34d1 server admission task generates `uiActionId` and other canonical fields it owns. Slice 34b cannot generate or accept that field. A renderer `clientCommandId` is optional correlation only. Missing active-view detail, selected-resource identity, cause links, or enrichment degrades to explicit null/unknown/omission state or a diagnostic and does not block the valid source command.

The envelope is renderer-supplied command context, not canonical event provenance. The accepting UI path establishes UI origin. Outside the command/response chain, the server admission task generates `uiActionId`, constructs the canonical candidate, assigns source/origin/observer/confidence, and routes it through validation/diagnostics. A provenance failure does not fail or delay the accepted command.

Resource paths are workspace-relative canonical paths unless explicitly named otherwise. View/panel fields belong in `context`, not in `resources[]`.

## UI Action Event

Mutation-producing UI commands ask the first accepting server handler to construct a canonical `ui.action` candidate and route it through validation/diagnostics. Accepted candidates emit on UEB and may separately be enqueued for persistence; provenance failure is diagnosed without failing the source command:

```ts
{
  schemaVersion: 1,
  eventId,
  eventFamily: 'ui',
  eventType: 'ui.action',
  occurredAt,
  ids,
  actor: { type: 'human' },
  provenance: {
    source: { type: 'ui-action-ingestor', module: 'provenance/ui-action-ingestor' },
    origin: { type: 'ui', id: uiActionId },
    observedBy: { type: 'ui-action-ingestor', module: 'provenance/ui-action-ingestor' },
    confidence: 'direct'
  },
  context,
  resources,
  redaction,
  uiAction: {
    uiActionId,
    clientCommandId,
    command
  }
}
```

For the first package, `schemaVersion` is exactly `1`, `redaction` is required, and `lifecycle`, `ledger`, `inputSummary`, `resultEventIds`, and `resourceEventIds` are absent. Later links belong in downstream accepted events/ledger edges or a future explicit update event, never mutation of the frozen action. Connection routing and acknowledgements stay outside the canonical event.

The `ui.action` event must not put its own `uiActionId` in `provenance.cause`. Downstream events carry that cause only after the upstream action was accepted.

## View Adapter Contract

Each view adapter maps local view state into the universal envelope.

An adapter must provide:

| Field | Required behavior |
|---|---|
| `viewId` | Stable view ID from the active panel/view registry. |
| `panelId` | Active panel ID when the command is panel-scoped. |
| `route` | Current route or view route when available. |
| `activeTabId` | Active tab/document tab when the view has tabs. |
| `activeDocumentPath` | Workspace-relative path for the active document when present. |
| `activeResourcePath` | Workspace-relative path for the active resource under command. |
| `resources[]` | Path/type/role inputs only; server adds canonical resource/relationship IDs from accepted references. |

Adapter pages map non-ID UI context only. Canonical selected-resource and relationship IDs are server-derived and never accepted from renderer input. Adapter pages should remain small tables, not separate provenance models.

## Per-View Mapping Pages

Per-view pages should be added as views are audited or migrated. Each page should list:

- Mutation-producing commands.
- Entry mechanisms that invoke those commands.
- Local selectors/stores used for each required context field.
- Resource mapping rules.
- Known gaps.

Initial expected child pages under `011-UI_Action_Provenance_Module/`:

- `001-Wiki_Viewer_UI_Context/PAGE.md` - normative first-pair mapping.
- `002-File_Viewer_UI_Context/PAGE.md` - normative first-pair mapping.
- `003-Capture_Viewer_UI_Context/PAGE.md` - to be added during Capture adapter migration.
- `004-Office_Viewer_UI_Context/PAGE.md` - to be added during Office adapter migration.
- `005-Email_Viewer_UI_Context/PAGE.md` - to be added during Email adapter migration.

The owner approved Wiki and File Viewer as the first adapter pair. Their current durable UI-origin path is `chat.send_with_resource` when either is the active panel and prompt send consumes at least one valid pending resource attachment from any panel. Attachment staging and navigation remain non-mutating and do not emit `ui.action`. Active context is captured from the panel active at actual send time; every valid attachment remains a subject resource, and attachment origin does not overwrite active context or choose the adapter.

The first-pair provenance migration applies when the active panel has a Wiki/File adapter and at least one pending resource attachment is valid for provenance. The generic resource-ref helper normalizes every provenance-valid attachment as a subject even if it originated in another panel; attachment origin does not replace the command-time active-context adapter. Other active panels or sends without provenance-valid attachments emit no first-pair UI envelope and record a development diagnostic; the separately validated operational prompt and attachment list remain unchanged.

The renderer sends no free-text summary/content or relationship IDs. Pre-UEB policy `ui-resource-metadata-v1` treats client correlation, UI path/context, and resource paths as potentially sensitive. Missing/failed/thrown redaction uses exactly the failure safe core defined in [SPEC-34](../../../Captures/008-Provenance-Temp/34-ui-action-provenance-module.md), including `redaction = { status: 'failed', policyId: 'ui-resource-metadata-v1', policyVersion: '1', omissions: ['/*:redaction_failed'] }`, empty resources, and no optional context/IDs/correlation/mirrors. Safe-core validation failure emits no event/reference but never blocks the prompt. Resource metadata redaction failure emits no incomplete/path-bearing resource fact and uses `resource:refresh_required` after a valid mutation or safely established watcher observation.

Successful first-package treatment uses the exhaustive JSON-pointer keep/known-omit/error sets in [SPEC-34](../../../Captures/008-Provenance-Temp/34-ui-action-provenance-module.md); this page does not broaden them. `*` is one array index, braced child sets are exhaustive, every unlisted pointer is `unknown_field` error, and omission entries are sorted RFC 6901 pointer strings with the exact approved suffix. `ui-resource-metadata-v1` and `resource-metadata-v1` are both version `'1'`. Content hashes are always absent with `:policy_unapproved` until a separate owner-approved policy closes. Unsafe required paths reject the provenance candidate; unsafe optional symlink targets are omitted with `:unsafe_path`. Failures never change the source operation or watcher-observed fact.

An attachment is renderer-eligible for tentative provenance only when its typed `panel`, `path`, panel-relative `relativePath`, and `kind` fields are present; `kind` is one of `file`, `folder`, `wiki`, `ticket`, or `doc`; the panel-relative path has no absolute prefix, backslash, `.` segment, or `..` segment; the cached target panel root and separately server-hydrated `panelStore.projectRoot` resolve; `panelRoot + relativePath` exactly reproduces its absolute `path`; and the target is contained by that cached project root. An empty panel-relative path represents the panel root; panel roots may be subdirectories. Map the five kinds exhaustively. The server then requires the renderer's private workspace token to match the coordinator's `WorkspaceCommandContextRef`, re-resolves panel roots/targets under that authoritative command root, and derives canonical `resources[].path` itself. Missing/stale/forged/wrong-connection token or any A/B root/target mismatch creates no canonical candidate, `uiActionId`, accepted ref, result mirror, or edge and records only value-free `workspace_context_unbound`; it never uses the redaction-failed safe core, stamps the current workspace onto copied tentative paths, or changes the operational prompt/attachment list.

Operational attachment acceptance and provenance subject eligibility are separate outputs. The existing prompt command's operational validator alone decides the attachment list serialized into the harness prompt. Provenance reads an immutable snapshot of operationally accepted inputs and may only derive or omit `resources[]` subjects; it cannot mutate, filter, reorder, default, add to, or reject the operational list. An operationally accepted but provenance-invalid attachment therefore remains in the prompt, while an all-provenance-invalid list sends the same prompt and emits no first-pair `ui.action`. Operational path-safety hardening, if needed, is a separate command-validation change rather than a provenance side effect.

The Office adapter must classify `office:thumbnail_save` from `OfficeDocumentPage.tsx` as either UI-derived autosave or system preview generation before wiring provenance.

The send-to-chat adapter should account for `dispatchChatAction` in `fusion-studio-client/src/lib/chat-action.ts`, because `SendToChatButton` dispatches through that bridge and chat UI listeners consume the browser event. The current bridge stages any `action.attachment`; resource-backed `chat.send_with_resource` should be captured when `sendToThread` consumes pending resource attachments and the server `prompt` path reaches `acceptPromptThroughRuntime`. The existing `delivery: 'send'` bridge path applies to non-attachment chat actions unless the attachment bridge is changed.

## Server Handoff

The renderer constructs tentative command context/resource inputs and echoes its latest private token only at `uiActionSeed.workspaceCommandContextToken` by reading the exact current OPEN socket's ephemeral slot. The server keeps only the latest binding per live connection; transition/reconnect invalidates it and disconnect deletes it. The client clears its side synchronously on every init/switch/close/disconnect/replacement boundary before prompt access or reconnect scheduling. `workspace:init` performs optional async enrichment first, then in one no-await block captures the latest coordinator snapshot, synchronously derives workspace ID/root and panel roots, includes only an already-completed token, and sends one atomic init. Paused entropy never delays it; a later exact-current metadata-only message may install the token. The token binds the exact coordinator transition capability; no separate client revision exists. The old separate connection-open-root startup `panel_config` is removed; panel-root failure uses empty roots/unavailable status/refetch.

Prompt-time renderer provenance work is pure and hard-bounded: at most 32 provenance subjects, 512 charged reads/validation/path/output steps, and 16,384 UTF-8 bytes in the final seed. Every cached root, input/active/relative/absolute path, path segment, and intermediate has both a 4,096-code-unit and 4,096-UTF-8-byte cap; identifiers use dual 256 outer computational caps and resource names/extensions dual 512 caps. Optional `clientCommandId` has the narrower exact `[A-Za-z0-9_-]{1,128}` semantic rule: wrong-format or 129-256 input is omitted while the otherwise valid envelope proceeds, and above-256 exhausts capture. O(1) code-unit and then cap-plus-one byte checks occur before any concatenation, path-library, normalization, containment, equality, or UTF-8 operation; precomputed component lengths must prove every join fits before allocation. After appending 32 qualifying subjects, capture inspects later attachments only under the remaining step budget and only until list end or a 33rd qualifier. A 33rd qualifier immediately omits the whole seed; reaching list end with none preserves 32; step/preflight exhaustion before the determination omits the seed. Nothing after the deciding attachment/exhaustion is inspected, so overflow is detected rather than truncated. There is no provenance I/O, await/thenable, entropy, dynamic import, provider/filesystem call, user/plugin callback, or unbounded traversal in the send path. Any other bound exhaustion or provenance exception omits the whole seed with fixed code-only `ui_provenance_capture_unavailable` and sends the already-fixed operational baseline exactly once; operational attachments are never truncated or reordered by these metadata limits.

The server independently treats the seed as untrusted. After operational prompt validation starts the command, its fixed-schema nonrecursive extractor reads at most 207 charged own data properties including the message seed, array length, and 32 indexed element descriptors; 170 scalars; 32 subjects; four schema levels from `uiActionSeed`; an exactly enumerated 1,034 steps; and 16,384 UTF-8 output bytes. Each private subject carries its strictly increasing original operational attachment index. Target evidence is direct-read only at those positions from the already-required validated attachment vector and becomes at most 32 closed five-field null-prototype data copies under separate 129-property/160-scalar/exact 901-step/16,384-byte caps. Gaps are allowed; duplicate/reordered/out-of-range/hole/non-accepted/mismatched entries omit provenance, and indices/ordinals are stripped before canonical construction. There is no key/map scheme or scan, and no handle, attachment/vector entry, callback, capability, operation object, or graph reference enters the queue. Structural/budget/preflight/direct-read failure emits fixed `ui_provenance_seed_unavailable`, schedules no UI candidate, allocates no slot/link, and cannot affect prompt acceptance/response. Those bounded seed/target copies enter D01 only with the bound context below; all three data values are byte-charged and released whenever an offer is attempted.

The opaque command ref/token also stay outside D01. After the operational path starts, the closed synchronous binder performs exactly 24 charged registry/shape/cap/equality/liveness/allocation/write/freeze/outcome sites and emits null or frozen `{ schemaVersion: 1, workspaceId, workspaceRoot }` capped at 4,608 UTF-8 bytes. No callback/I/O/Promise/general binder runs. Each accepted command attempts bounded private owner-cell initialization; null disables only provenance, while command `finally` atomically closes a non-null cell. Seed/target/binder failure occurs before slot/link allocation and schedules no UI candidate. On full preflight success, the ref/token are discarded. Nullable slot failure installs/offers nothing; a non-null slot installs only into an open owner cell, while `owner_closed` terminalizes/releases it once without offer. Successful installation invokes the module-private fixed offer in the same callback-free non-yielding turn, and the offer receives that slot synchronously. D01's UI-task data plane receives and byte-charges/releases only seed, targets, and bound context. Its sole queued control-plane value is one private D01-created/accounted `AcceptedRefSlotTaskLink`; only the link enters task ownership. Setup/rejection failure settles the installed slot once and releases all partial state, with no queued owner cell/slot handle, caller callback/finalizer, or command-context handle.

The queued "seed" above is exactly the token-free `UiActionQueuedEnvelope`, not `UiActionPrivateSeed`. One bounded extractor result holds the transient workspace token as a sibling of an independently frozen recursively readonly queued envelope. Binder/target preflight consumes and drops the wrapper/token before slot allocation, passes the same envelope object without a second copy, and type/ABI plus WeakRef sentinels prove the token/wrapper is absent and unreachable from queued, active, and cancelling tasks.

Operational `set_panel` is issued once after init restoration or explicit human change and owns existing panel/session/thread effects. Metadata recovery uses distinct `{ type: 'request_panel_config', panel }`; its handler has no panel-selection, session-root, thread, list, acknowledgement, or `panel_changed` effects. Client `rootFolder`, workspace, panel-root, and token fields are never root authority. The server captures the current coordinator ref/token before any await, resolves the panel root beneath that ref's root, rechecks the same ref/token immediately before send, and discards stale work. Its exact `panel_config` response carries the panel, coordinator workspace ID/root, server-resolved panel root/status, and current recipient token. The client requires all context fields to equal its current atomic snapshot and then changes only that named panel-root/status entry; it never replaces project root, workspace, token, or another panel from this message. Missing/malformed/mismatched/outside-root data is ignored with a value-free diagnostic and at most one coalesced automatic metadata-only recovery attempt per token/panel. A failed attempt remains unavailable until a newer token, authoritative server push, or explicit human panel action; it cannot loop. The valid panel/thread/user operation continues exactly once in every metadata branch. Thus even a current token cannot authorize a client path or poison cached root evidence.

The token never enters shared broadcaster data, cached/persisted client state, canonical/ledger/log/diagnostic/recovery output. Token-bearing renderer ingress and prompt-family server ingress call no console/debug/logger/redactor/formatter/stringifier or logging executor with raw, parsed, type, seed, rejection, error, or exception material. After original handling, observability is only a module-private saturating counter selected from a closed compile-time type/outcome enum; it has no callback/value/serialization and is fixed O(1). The whole seed is sensitive, including client correlation, context, resource paths, token, future children, and malformed duplicates. Static bidirectional inventory, zero-call logger spies including synchronous nonreturning workers, exact counter saturation, and sentinels cover every ingress/error path. Runtime binding receives only the untouched canonical original prompt path through the dedicated binder. The first server handler decides the source command using operational validation independently of provenance, starts the operational path, then runs the exact bounded binder and direct-index copy to produce only the three bounded plain-data inputs. The D01 task additionally receives exactly one D01-created/accounted opaque slot link solely for settlement. It never queues a command-context handle/token, caller callback/finalizer, attachment/vector entry, operation object/capability, scans/clones/freezes/retains the complete attachment list, or gives D01 reachability into the operation graph. The command invokes only that bounded synchronous binder after operational start and never invokes or awaits a general or async binder, safe-core construction, redaction, validation, admission, or an accepted-ref promise. The admission task uses only the already-bound context and target copies, re-resolving renderer context/resources under that proven command root without the token or opaque ref. Binding failure emits no canonical UI action/ID/ref/edge and submits exactly frozen `{ code: 'workspace_context_unbound' }` to a dedicated one-key-only development sink. That sink retains only one process-local saturating count, may log only the fixed code outside ingress, serializes/persists nothing, and resets on restart. It forbids token, path/root, workspace, connection/client, transition/capability, panel/attachment, reason/subcode, message/stack, and exception-derived values; sink failure is swallowed. It never reuses the redaction-failed safe core. Genuine redaction failure after successful binding may use that registered safe core. Downstream producers synchronously use an already-filled ref slot with `prepareCanonicalCandidate` or omit the relationship and diagnose without waiting. Optional enrichment is included only when already available. The canonical record uses the accepting server ingestor for source/observer and its exact schema-approved self-origin; downstream `resource.*` events use the server mutation producer.

This treats the renderer envelope as a renderer-originated UI fact, not as a pre-trusted canonical event record.

The ingestor writes the command-scoped slot only after canonical UEB admission. Server handlers receive the command envelope and:

- Preserve an upstream UI relationship only through a `prepareCanonicalCandidate` binding that consumes the already-available accepted UI ref; copying `uiActionId`, including from inspection, is insufficient.
- Preserve command-time renderer `context` only after workspace token binding and authoritative server re-resolution; otherwise omit/degrade it.
- Rebuild normalized `resources[]` under the captured coordinator command root and operational targets; never copy renderer paths or session-cache roots.

Resource mutation handlers:

- Attach `provenance.cause.uiActionId` only through the registered builder binding when the upstream action ref is already available.
- Set downstream resource mutation source/observer to the server mutation producer. For an accepted action, preserve its ID-bearing UI origin and cause. If UI-action publication failed, known UI ingress may retain `origin.type = 'ui'`, but `origin.id`, `cause.uiActionId`, result edges, and resource-event mirrors omit the rejected/unpublished ID.
- Generate or propagate `ids.serverMutationId` on every downstream resource mutation produced by a server-side mutation command.

In first-package 40b1a, existing `chat:*` facts remain a named compatibility path and receive no `uiActionId`; they are not canonical cause/result consumers. `CHAT-D01` must close and SPEC-40b2a must register the exact affected chat contract before removing that gap. Registered downstream events use only ref-consuming builder bindings, never copied strings, and never wait for a ref. Operational `ids.serverMutationId` remains independent.

Renderer provenance capture is a catch-all optional branch after the operational prompt/attachment baseline is fixed. Adapter/store/root-resolution/normalization/envelope/diagnostic/enriched-serialization exceptions fall back to the byte-equivalent baseline request and exactly one `socket.send`. The diagnostic sink has its own nested catch. Once `socket.send` is entered, a transport throw is not retried because delivery state is unknown; baseline serialization and transport errors remain operational failures, not provenance failures.

For current prompt sends, the concrete server handoff is `prompt` in `client-message-router.js` into `acceptPromptThroughRuntime` in `thread-runtime-controller.js`.

Server-side inference is fallback only for non-UI paths or malformed legacy requests during migration.

## Migration Rule

Before a view emits UI-origin mutation events through SPEC-32, its adapter selectors must be documented. This closes SPEC-32 `RSC-D12a` for that view/command path.

Watcher/server-origin resource events can migrate before view adapter pages are complete, because they do not claim UI-origin active context.
