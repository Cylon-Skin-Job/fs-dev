# SPEC-34 — UI Action Provenance Module

**Status:** DISCUSSION DRAFT. Do not implement until this spec is reviewed and approved.
**Related wiki:** [UI Action Provenance Module](../../Wiki/010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md)
**Depends on:** [SPEC-32 resource event contract](32-resource-event-sync-controller.md), [SPEC-40 validation contract](40-provenance-schema-registry-validation.md), [Events Provenance Model](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md), [UI Action And Context Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md), [Resource Mutation Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md)
**Supports:** Provides the central contract for closing [SPEC-32](32-resource-event-sync-controller.md) `RSC-D12a`; migration of each view/command path waits until its adapter page names exact selectors/stores, but the existing interaction remains available.

**Schema correction authority:** [2026-07-15 provenance cross-article findings](provenance-schema-findings.md) plus owner direction in chat on 2026-07-15. This SPEC participates in the mechanical `serverMutationId` branch matrix; decision-tagged cross-domain findings remain open.

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

## First-Pair Owner Decision

The owner approved Wiki and File Viewer as the first UI action adapter pair. Capture, Office, Email, and remaining adapters are deferred until this pair is proven.

The current-code audit found no direct durable file create/save/move/rename/delete commands in Wiki or File Viewer. The first durable command migrated for this pair is `chat.send_with_resource` at actual prompt send when the active panel is `wiki-viewer` or `file-viewer` and `useChatArea.sendToThread` consumes at least one valid pending resource attachment. The attachment may have been staged from any panel; its origin does not select the active-context adapter. Attachment staging and ordinary Wiki/File navigation are non-mutating UI behavior and do not emit `ui.action` events.

The central context capture chooses an adapter from `usePanelStore.getState().currentPanel` at actual prompt-send time. Slices 34b/34c prepare a local UI action envelope when that active panel is `wiki-viewer` or `file-viewer` and at least one pending resource attachment is valid for provenance normalization; they do not attach it to the wire. Slice 34d1 first installs the complete prompt-log fence and then atomically enables wire attachment. The central resource-ref helper normalizes every provenance-valid pending attachment as a subject even when an attachment originated in another panel; attachment origin does not choose the active-context adapter. Other active panels or a send with no provenance-valid resource attachment prepare no first-pair UI envelope and record a development diagnostic, while the separately validated operational prompt and attachment list remain unchanged. Attachment panel/path identifies the subject resource and may differ from the active document/resource in command-time context.

All renderer provenance capture is optional and enclosed by one catch-all degradation boundary after the operational prompt/attachment request object and its baseline serialization inputs are fixed. The send path performs no provenance I/O, await, Promise/thenable call, entropy, dynamic import, user/plugin callback, filesystem/provider access, or unbounded traversal. It may execute only the exact bounded pure capture below. Adapter/store access, panel-root lookup from already-present memory, attachment normalization, envelope construction, diagnostic reporting, and local enriched serialization may throw; none may prevent or duplicate the send. In 34b/34c the send path always serializes and sends the exact operational baseline payload once; the separately prepared JSON-safe envelope remains local. In 34d1, after the server logging fence is installed and verified, the same boundary may serialize the bounded enriched wire payload. On any provenance-only exception or bound exhaustion it best-effort reports the fixed diagnostic inside its own nested catch, serializes the unchanged baseline payload, and calls `socket.send` exactly once. It never retries after entering `socket.send`, because a transport throw has unknown delivery state and is an operational transport failure rather than provenance degradation. Baseline operational serialization/validation failure retains existing command behavior and is not relabeled as provenance failure.

The synchronous capture budget is exact: `MAX_UI_PROVENANCE_SUBJECTS = 32`, `MAX_UI_PROVENANCE_CAPTURE_STEPS = 512`, `MAX_UI_PROVENANCE_SEED_UTF8_BYTES = 16_384`, `MAX_UI_PROVENANCE_PATH_CODE_UNITS = 4_096`, `MAX_UI_PROVENANCE_PATH_UTF8_BYTES = 4_096`, `MAX_UI_PROVENANCE_ID_CODE_UNITS = 256`, and `MAX_UI_PROVENANCE_ID_UTF8_BYTES = 256`. The path caps apply independently to cached project root, every cached panel root, attachment absolute `path`, panel-relative `relativePath`, Wiki viewed path, File Viewer active-tab path, active document/resource path, every path segment, and every intermediate joined/normalized/relative/canonical path. The dual 256 ID caps are outer computational preflight limits for panel/view/tab/client-command and other context identifiers; each field must also pass its narrower semantic schema. In particular, optional `clientCommandId` must match `[A-Za-z0-9_-]{1,128}`. A wrong-format or 129-256-unit/byte value is omitted as optional correlation while the otherwise valid envelope proceeds; a value above either 256 preflight cap exhausts capture and omits the whole seed. Resource name/extension uses both 512 code units and 512 UTF-8 bytes.

Before any path library call, concatenation, normalization, containment, relative calculation, equality scan, or UTF-8 measurement, the code checks `typeof` and the O(1) JavaScript code-unit length against the applicable cap. Only then may a bounded UTF-8 counter scan at most cap-plus-one bytes. Before concatenation/join, precomputed component byte and code-unit lengths plus the exact separator count must be at most 4,096; otherwise no intermediate is created. Every path operation receives only already-capped operands and must return a value passing both path caps before any later operation. One step is charged before every property/store read, root lookup, scalar validation, path-segment/containment operation, subject append, and output-field write; no work occurs after step 512. The first 32 provenance-valid subjects in operational attachment order are appended. After the 32nd, capture continues inspecting later attachments only under the remaining step budget and only to decide whether a 33rd provenance-valid subject exists. Reaching a 33rd qualifier omits the whole seed immediately and inspects nothing later; reaching list end with no 33rd preserves the 32-subject seed; exhausting step or scalar/path/byte preflight before that determination omits the whole seed and inspects nothing later. Thus subject overflow is detected, never silently truncated. The final JSON-safe seed is measured with a byte-counting serializer that stops at 16,385 without producing a partial seed. Any code-unit/byte/step/subject/seed overflow, async-returning hook, or capture/serialization failure omits the entire seed with exact frozen `{ code: 'ui_provenance_capture_unavailable' }` to the same one-key process-memory diagnostic pattern; the already-fixed baseline request is sent once. These are computational safety bounds, not operational attachment limits.

## Contract

The module outputs a universal `UiActionCommandEnvelope`:

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
  workspaceCommandContextToken?: WorkspaceCommandContextToken;
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
  workspaceCommandContextToken?: WorkspaceCommandContextToken;
  queuedEnvelope?: UiActionQueuedEnvelope;
}>;

// Exact prompt extension. No other token location is read at runtime.
type PromptUiActionExtension = {
  uiActionSeed?: UiActionPrivateSeed;
};
```

`resources[].operationalAttachmentIndex` is private renderer-to-server correlation, optional in the future-generic envelope type but required for every first-pair `chat.send_with_resource` subject. While iterating the already-fixed operational attachment array, the renderer copies the original zero-based array index for each provenance-valid subject; skipped invalid attachments create gaps, but emitted indices remain strictly increasing and unique. The value is never inferred from path/type and is not a canonical resource field. The server uses it only for the direct-index ABI below, then strips it before redaction/canonical candidate construction; it never reaches UEB, logs, diagnostics, ledger, or any response.

`WorkspaceCommandContextToken` is exact string `wctx_` plus 43 base64url characters generated from 32 CSPRNG bytes (`^wctx_[A-Za-z0-9_-]{43}$`, 48 ASCII bytes total). A healthy token-capable `workspace:init` or operational `workspace:switched` may carry one already-available top-level token; neither waits for one. Otherwise exact metadata-only `workspace:context_token` delivers it later, and `panel_config` may only echo an already-installed current token. Absence is degraded metadata that never blocks workspace/panel handling. The client keeps it only in SPEC-32b0's exact module-private memory slot keyed by the current WebSocket object, outside all Zustand/workspace caches and persistence. Every init/switch clears before optional install; the metadata-only update clears-before-installs only after exact socket/workspace/root equality; close, explicit disconnect, socket replacement, and shutdown clear synchronously before another prompt can read. The prompt reads it only for the exact current OPEN socket; absence/clear failure omits it without affecting the prompt. At context creation the server invalidates the old binding and submits a detached abort-aware allocator; notification serialization never calls or awaits entropy. `MAX_WORKSPACE_CONTEXT_TOKEN_ATTEMPTS = 4`: each attempt awaits one asynchronous 32-byte CSPRNG call; rejection or collision consumes the attempt. Success after exact current-context re-verification atomically installs/sends the recipient-only metadata update. Context replacement/disconnect aborts the wrapper and late completion is discarded. Four failures make no fifth attempt/message and record exact value-free `{ code: 'workspace_context_token_unavailable', reason: 'entropy_or_collision_exhausted' }`. Shared broadcaster base objects, cached serialized buffers, and messages for another recipient never contain the token. The prompt carries it only at `uiActionSeed.workspaceCommandContextToken`, alongside optional `uiActionSeed.envelope`. The server binder reads only that exact own-property path. Top-level prompt tokens, tokens inside the envelope, arrays, alternate/nested seed names, inherited properties, duplicate reserved keys elsewhere, wrong types, and malformed values are ignored as runtime input and cannot create a binding. Unknown locations are diagnosed without including their values and never block the prompt.

The server never trusts renderer bounds. After operational prompt validation starts the source command, `extractBoundedUiActionSeed(parsedMessage): ExtractedUiActionSeed | null` performs one pure nonrecursive schema-selective copy with exact `MAX_SERVER_UI_SEED_DEPTH = 4` measured from `uiActionSeed`, `MAX_SERVER_UI_SEED_PROPERTY_READS = 207`, `MAX_SERVER_UI_SEED_SCALARS = 170`, `MAX_SERVER_UI_SEED_STEPS = 1_034`, `MAX_SERVER_UI_SEED_SUBJECTS = 32`, and `MAX_SERVER_UI_SEED_UTF8_BYTES = 16_384`. The 207 reads include the message's `uiActionSeed` descriptor, two seed fields, four envelope fields, seven context fields, the resource array's own `length`, 32 indexed element descriptors, and five fields for each of 32 resource objects. Array length and indexed elements are charged. The complete worst-case schedule is exactly 1,034 charged sites: 207 descriptor reads, 37 native-JSON container/array checks including the message, 170 scalar validations, 138 bounded string scans, 207 property presence/branch decisions, 170 scalar output writes, 36 output-container allocations, 32 subject appends, 36 bounded output-container freezes, and one bounded serialization. Every site charges before work; absent/invalid optional fields replace a write with an already-counted branch/omission decision and cannot increase the total; nothing runs after step 1,034. It uses only `Object.getOwnPropertyDescriptor` against the fixed pointer set in `UiActionPrivateSeed`/`UiActionCommandEnvelope`; every consumed property must be an own data property on the immediate native-JSON plain object/array shape. It never invokes getters, enumerates keys, recurses, generic-clones/freezes/stringifies the input, or reads an unknown child. Deep/wide unknown subtrees are never traversed, measured, copied, or retained. Array length above 32, a recognized container at depth above four, a property/scalar/step/output-byte overflow, an accessor/inherited/non-JSON object, an invalid/non-increasing/duplicate `operationalAttachmentIndex`, or an over-preflight scalar omits the entire seed with exact fixed `ui_provenance_seed_unavailable`. Each index is a required non-negative safe integer, strictly increases in renderer subject order, and is copied only as private server correlation. Recognized strings pass the same cap-plus-one path/ID/name byte and code-unit preflights before copy; `clientCommandId` then uses its 128-character semantic rule and invalid optional correlation is omitted without losing the otherwise valid seed. The extractor allocates one frozen null-prototype `ExtractedUiActionSeed`: the transient token is a sibling of an independently frozen, recursively readonly, token-free `queuedEnvelope`. The bounded serializer measures the complete extraction result and stops at byte 16,385 without partial output. Binder/target preflight consumes the transient wrapper and token; successful preflight passes the already-created `queuedEnvelope` object directly, with no second copy or uncharged traversal, then drops the wrapper/token before slot allocation. Missing envelope omits UI provenance. The extractor never retains the original seed or unknown references.

`UiProvenanceOperationalTarget` is plain data, never an opaque handle or capability:

```ts
type UiProvenanceOperationalTarget = Readonly<{
  subjectOrdinal: number;              // integer 0..31
  operationalAttachmentIndex: number; // non-negative safe integer
  role: 'subject';
  resourceType: 'file' | 'folder' | 'wiki' | 'ticket' | 'doc';
  canonicalWorkspaceRelativePath: string;
}>;
```

The operational handler already owns the operationally required validated attachment vector; provenance creates no auxiliary map or key index and adds no scan. Its only target ABI is module-owned non-pluggable `copyUiProvenanceOperationalTarget(validatedAttachments, operationalAttachmentIndex, subjectOrdinal)`. It is invoked once per seed subject in ascending `subjectOrdinal`. The required private seed index selects that exact vector position; gaps are allowed for operational attachments omitted from provenance, while duplicates, descending/equal indices, out-of-range indices, holes, or non-accepted entries omit all UI provenance. Each call performs one direct indexed own-data read, then reads only the indexed accepted attachment's exact `accepted`, `resourceType`, and `canonicalWorkspaceRelativePath` own primitive fields. It iterates nothing and returns a newly allocated null-prototype five-field descriptor or null; it never returns/stores the attachment, vector, callback, map entry, capability, operation object, or graph reference. `subjectOrdinal` is server-derived from seed resource order; `operationalAttachmentIndex` is only a selector and must equal the copied descriptor field. The copied type/path must match the bounded renderer subject and is re-resolved/revalidated later against the bound command context before canonical use. The private index and ordinals are stripped before canonical candidate construction and never enter canonical UEB data, logs, diagnostics, ledger, or wire output.

Exact target-copy bounds are `MAX_SERVER_UI_TARGETS = 32`, `MAX_SERVER_UI_TARGET_PROPERTY_READS = 129`, `MAX_SERVER_UI_TARGET_SCALARS = 160`, `MAX_SERVER_UI_TARGET_STEPS = 901`, and `MAX_SERVER_UI_TARGETS_UTF8_BYTES = 16_384`; individual paths use dual 4,096 caps, ordinals use the numeric ranges above, and enum literals are exact. The complete worst-case schedule is exactly 901 charged sites: one vector-length read, 32 indexed element reads, 96 accepted-entry field reads, 32 returned-container checks, 160 scalar validations, 64 bounded type/path validation scans, 64 bounded renderer-to-operational type/path comparisons, 32 index/order/result decisions, 129 read-result branch decisions, 160 output writes, 33 output-container allocations, 32 appends, 33 freezes, 32 direct-index selections, and one cap-plus-one serialization. Every site charges before work and nothing runs after step 901. The validated attachment vector is used only during these synchronous direct reads and is dropped before D01 offer. Extraction/envelope, target, or context preflight failure occurs before any slot/link allocation. On success, preflight drops the transient extraction wrapper/token and retains the already-created token-free `UiActionQueuedEnvelope` without copying it. Once all three data values are ready, the handler follows SPEC-40's nullable slot/install contract and a successful install immediately calls the module-private fixed offer with that slot as a synchronous nonqueued input. The D01 task's data plane owns only the token-free queued envelope, target array, and `BoundUiProvenanceContext`; its sole queued control-plane value is the private D01-created/accounted `AcceptedRefSlotTaskLink`. D01 charges and releases all four on every terminal branch. No queued value reaches the workspace token/extraction wrapper, owner cell/slot handle, attachment vector/object, command context, or operation graph.

The opaque `WorkspaceCommandContextRef` and echoed token are never queued. After the operational path starts, closed module-private `bindUiProvenanceContextForQueue(commandContextRef, token)` runs synchronously before D01 offer and returns null or exact plain data:

```ts
type BoundUiProvenanceContext = Readonly<{
  schemaVersion: 1;
  workspaceId: string | null;
  workspaceRoot: string | null;
}>;
```

The binder has no callback/provider/plugin/I/O/Promise/thenable path. It performs exactly two private-registry lookups, five fixed type/shape checks, four cap-plus-one workspace-ID/root scans, four connection/workspace/root/transition equality or capability comparisons, three binding/liveness decisions, one output allocation, three writes, one freeze, and one outcome decision: `MAX_SYNC_UI_CONTEXT_BIND_STEPS = 24`. Workspace ID uses dual 256 caps, root uses dual 4,096 caps, and exact `MAX_BOUND_UI_PROVENANCE_CONTEXT_UTF8_BYTES = 4_608` is measured by a cap-plus-one serializer before offer. The token is fixed 48-byte syntax. Binder creation and D01 offer are in one module-private closure; neither the function nor its result-acceptance path is exported, and no caller-supplied lookalike object is accepted. The command ref and token are used only inside those 24 charged sites and released from provenance locals before slot creation/offer; the result contains no connection, token, transition capability, ref, callback, registry entry, or external object reference. Failure returns null before slot/link allocation, reports only exact `workspace_context_unbound`, and schedules no UI provenance. Each accepted command attempts bounded private owner-cell initialization; null disables only provenance, while a non-null cell is closed from command `finally`. On full preflight success, nullable slot allocation failure installs/offers nothing. A non-null slot atomically installs only into an open cell; `owner_closed` terminalizes/releases it once without offer. A successful install reaches the fixed offer in the same callback-free, non-yielding turn. The offer receives the installed branded slot synchronously and D01 byte-charges only those three UI data values plus the one fixed `AcceptedRefSlotTaskLink` control value defined and owned by SPEC-40; only the link enters task ownership. It releases all data/cell/link/partial charges and terminalizes an installed slot once on every link creation/measurement/setup failure, completion, rejection/overflow, cancellation, expiry, forced-cleanup, or shutdown branch. No caller callback/finalizer or command-context handle is accepted. Later admission re-resolves context/resources from this already-proven command root and never consults live session/current-workspace state. The private workspace root is omitted from every canonical/ledger/log/diagnostic/response output.

The renderer envelope contains no event/domain relationship IDs. The accepting handler derives workspace identity/root from the coordinator-captured command context; authoritative thread/turn and selected-resource identity come from their owning server operational state, while session workspace/root fields remain caches. The first-package `ui.action` is a root canonical fact and therefore omits `rootEventId`, `parentEventId`, and `causationId`; any future UI relationship requires an exact SPEC-40 candidate/source selector and accepted capability. The server may attempt optional fresh correlation through SPEC-40's nullable private generator. Unavailable/thrown generation omits only correlation with fixed `fresh_correlation_unavailable`; it never suppresses the safe fact, affects the command, or copies client/caller/session/operation/raw correlation as fallback. Raw event/causation IDs in mutable state never qualify. Mutation commands still require a safely resolved workspace/path as operational inputs, but provenance metadata does not provide or authorize them.

`connectionId` is not part of the required renderer envelope. It remains transient server-owned WebSocket session state, is not authorization or causal identity, and is not required for first-pair canonical provenance. The server may attach its own connection ID to non-canonical diagnostics or future explicitly approved multi-client metadata, but the renderer does not need to store, echo, or validate it for this module.

After the operational path starts, the server's admission task generates the canonical `uiActionId` and envelope fields it owns. A renderer-created `clientCommandId` may be used for correlation but is optional. Missing active tab, document, route, selected-resource, cause, or resource-enrichment metadata degrades to explicit `null`, omission, or a diagnostic and never prevents the prompt or another otherwise valid command from executing.

The envelope is renderer-supplied command context, not canonical event provenance. The accepting UI command path is the evidence for UI origin. Outside the command/response chain, the server admission task constructs the canonical `ui.action`, generates `uiActionId`, assigns `provenance.source`, `provenance.origin`, `provenance.observedBy`, and `provenance.confidence`, and routes the candidate through the SPEC-40 validation/diagnostic publisher.

## UI Action Event

Mutation-producing UI commands ask the first accepting server handler to construct a canonical `ui.action` candidate and route it through the SPEC-40 validation/diagnostic publisher. Accepted candidates emit on UEB; a provenance failure records a diagnostic without failing the source command:

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

For the first package, `schemaVersion` is exactly `1`, `redaction` is required, and `lifecycle`, `ledger`, `inputSummary`, `resultEventIds`, and `resourceEventIds` are absent. The exact full-success and failure-safe-core branches are defined below.

UEB emission is the required successful provenance outcome for migrated mutation-producing paths. Unexpected provenance construction/publication failure is an observable degraded state, not a reason to fail the source command.

The `ui.action` event itself must not self-reference its own `uiActionId` in `provenance.cause`. Downstream events carry that cause only after the upstream action was accepted.

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
| `client-command-id` | Optionally create the renderer correlation value `clientCommandId` with a `uicmd_*` prefix; never create `uia_*` or any canonical/domain relationship ID in the renderer. Do not reuse React keys, tab IDs, view IDs, or existing numeric view-state `clientMutationId` values. |
| `ui-action-registry` | Own universal command vocabulary and metadata. |
| `ui-context-capture` | Preserve optional `clientCommandId` and capture command-time context; canonical `uiActionId` is server-generated. |
| `ui-resource-normalizer` | Convert local paths/selections into normalized `resources[]`. |
| `ui-action-dispatch` | Wrap mutation command dispatch; keep the envelope local through 34c, then attach it only in 34d1 after the server prompt-log fence is installed. |
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
| `resources[]` | Path/type/role inputs only; server adds canonical resource/relationship IDs from accepted references. |

The adapter documents local selectors for non-ID context. Canonical selected-resource and relationship IDs are server-derived only and are not adapter outputs.

### Normative First-Pair Context Mapping

Common fields:

| Output | Wiki and File Viewer source |
|---|---|
| Canonical `ids.workspaceId` | The bounded `BoundUiProvenanceContext` produced synchronously from the server coordinator's `WorkspaceCommandContextRef` and token after the operational path starts; never `session.currentWorkspaceId` or renderer envelope input. Missing provenance metadata does not block chat. |
| `context.viewId` | Literal current adapter ID: `wiki-viewer` or `file-viewer`; must equal `usePanelStore.getState().currentPanel`. |
| `context.panelId` | Same literal as `viewId` for these built-in panel-scoped views. |
| `context.route` | `null`; neither view has an authoritative route store. Do not synthesize one. |
| Canonical `context.selectedResourceId` | Server-derived only from an accepted resource reference; absent/null for the first pair. Never accept `ChatLinkAttachment.id` or another renderer value. |

View-specific fields:

| Output | Wiki Viewer | File Viewer |
|---|---|---|
| `activeTabId` | `null`; Wiki uses navigation history, not tabs. | `activity.activeTabId`, where `activity = normalizeViewActivity(usePanelStore.getState().viewStates['file-viewer']?.activity)`. |
| `activeDocumentPath` | Convert panel-relative `useWikiStore.getState().viewedPagePath` through the validated Wiki panel root to a canonical workspace-relative path; null on absent/conversion failure. | Convert the active activity tab's panel-relative `path` through the validated File Viewer panel/workspace root; null on absent/conversion failure. |
| `activeResourcePath` | Same converted workspace-relative value as `activeDocumentPath`. | Same converted workspace-relative value as `activeDocumentPath`. |
| Adapter selection evidence | `usePanelStore.getState().currentPanel === 'wiki-viewer'`. | `usePanelStore.getState().currentPanel === 'file-viewer'`. |

Renderer `viewedPagePath`, activity-tab paths, and `ChatLinkAttachment.relativePath` are panel-relative evidence, never canonical paths by themselves. The central helper reads separately server-hydrated `usePanelStore.getState().projectRoot` as the renderer's cached workspace-root evidence and `panelRoots[targetPanel]` only as the cached target content root; neither is authoritative after a missed/failed transition notification, and no panel root, including File Viewer, is assumed equal to project root. It tentatively canonicalizes without I/O, proves the target panel root and absolute target are contained by the cached project root, proves `targetPanelRoot + panelRelativePath` exactly equals the supplied attachment absolute `path` when an attachment is present, then derives the tentative workspace-relative path. It validates the result with `isCanonicalWorkspaceRelativePath`; no absolute root/path is serialized in canonical JSON. Missing/malformed cached roots, panel roots outside or different from the expected cached containment, equality failure, or conversion error produces a diagnostic and null context/omitted subject without changing the operational attachment. The server independently revalidates every tentative value under the command-context gate below.

### Workspace Command Context Gate

Every authoritative workspace snapshot/healthy operational switch invalidates the prior connection-scoped token binding and begins detached allocation for that exact connection plus coordinator transition capability/workspace/root. The notification carries the token only if already complete; otherwise exact-current metadata-only delivery installs it later. The server retains at most the latest binding per live connection; transition/reconnect rotates to a newly generated unequal token, disconnect deletes it, and an older/cross-connection token fails binding. It is transport state, not authorization by itself, canonical metadata, an audit ID, or persisted provenance. It is never exposed by inspectors or written to shared broadcaster objects/buffers, canonical payloads, ledger, logs, diagnostics, or recovery messages. The renderer may echo the latest valid token only at `uiActionSeed.workspaceCommandContextToken`; absence never blocks the prompt. At the first accepting 34d1 handler, after the operational path starts, the exact 24-step binder consumes the coordinator's `WorkspaceCommandContextRef` plus transient extracted token and produces only `BoundUiProvenanceContext`; it then copies at most 32 closed plain-data `UiProvenanceOperationalTarget` records through the exact direct-index ABI. Failure in any bounded preparation step allocates no slot/link. The command's private owner cell is independently closed from `finally`, so fast completion/cancel/throw wins atomically over late provenance installation. On success, the extraction wrapper/token, command ref, complete attachment list, and all operational objects/capabilities are discarded; the already-frozen token-free queued envelope is retained without another copy. Nullable slot allocation may still omit provenance. A non-null slot installs only if the cell remains open, otherwise it terminalizes/releases without offer. Successful installation immediately invokes the fixed offer in the same non-yielding turn. The admission task consumes only the queued envelope, target copies, bound context, and SPEC-40's one private D01-accounted slot link; it never receives the workspace token/wrapper, owner cell/slot handle, or session/current-workspace state.

Connection initialization may perform optional async enrichment first, but authoritative workspace fields are not sampled during that work. Immediately before `workspace:init` serialization, in one no-await block, capture one immutable coordinator workspace snapshot/ref, synchronously build every workspace ID/root-derived field and `panelRoots` from it, include a token only if its detached allocation already completed for that snapshot, and invoke the single atomic init send. Init/switch never invokes or awaits entropy; a later exact-current `workspace:context_token` updates only the ephemeral token slot. Slice 32b0 removes the separate connection-open-root startup `panel_config` message. Optional enrichment is included only when it carries the same snapshot capability; stale/unproven enrichment is omitted. Panel-root failure uses empty roots plus explicit unavailable status and current-context refetch, never earlier-root data. No workspace transition can interleave inside this capture/build/send block. Operational `set_panel` is issued once after init restoration; it is never a metadata retry. Later panel metadata recovery uses only SPEC-32b0's side-effect-free `request_panel_config`; a ready response requires the already-installed current token, while token-unavailable response changes no root. Tests pause enrichment, panel-root work, and entropy across `A -> B`, `A -> null`, and reconnect and prove notification/coordinator completion plus correct root state do not wait, with no mixed-capability or stale token/root overwrite.

On a matching binding, the server resolves the registered Wiki/File panel roots under the command ref's authoritative root, re-resolves each renderer tentative active path/subject, proves it corresponds to the same operationally accepted attachment target where applicable, and derives canonical workspace-relative paths itself. The renderer-derived path is comparison evidence, never copied canonical output. On missing/stale/forged/wrong-connection token, A-root/B-root mismatch, panel-root mismatch, operational-target mismatch, or server resolution failure, create no canonical `ui.action` candidate, `uiActionId`, accepted ref, result mirror, or edge. Submit exactly `WORKSPACE_CONTEXT_UNBOUND_DIAGNOSTIC = Object.freeze({ code: 'workspace_context_unbound' })`; runtime `Object.keys` are exactly `['code']`. The dedicated `reportUiProvenanceDiagnostic` sink accepts only that exact one-key literal, increments one process-local saturating counter keyed by the code up to `Number.MAX_SAFE_INTEGER`, may log only the fixed code, and immediately discards the object. It has no ring entries, payloads, serialization, network output, canonical/ledger persistence, or cross-process retention; restart resets the counter. Token, path/root, workspace, connection/client, transition/capability, panel/attachment, reason/subcode, stack, message, and exception-derived values are categorically forbidden even though other noncanonical diagnostic families may carry server routing IDs. Sink throw is swallowed by the supervised provenance boundary. Do not reuse the `redaction.status = 'failed'` safe core because binding failure is not redaction failure. The baseline prompt/attachment bytes, acceptance, response, and operational target remain unchanged and are never retried. Server session caches are not consulted by this gate.

For `chat.send_with_resource`, each valid pending attachment becomes a `resources[]` `subject` using its `panel`, derived workspace-relative path, and classified resource kind. An attachment is valid only when `panel`, `path`, panel-relative `relativePath`, and `kind` have the declared types; `kind` is one of `file`, `folder`, `wiki`, `ticket`, or `doc`; the panel-relative path contains no absolute prefix, backslash, `.` segment, or `..` segment; both roots resolve in the active workspace; the equality/containment proof above succeeds; and the derived workspace-relative output is canonical. An empty panel-relative path is valid only for the resolved panel root, but its canonical output is the panel root's workspace-relative path (empty only when the panel root is the workspace root). Map `ChatLinkAttachment.kind` directly and exhaustively to the same `resourceType` string.

Invalid entries are omitted and produce a development diagnostic; they never contribute direct resource provenance. A mixed list prepares an envelope for all valid subjects, while a list with no valid subject uses the legacy prompt path. That envelope remains local through 34c and reaches the wire only under 34d1's fence. The generic resource-ref helper may normalize attachments originating outside the first adapter pair; the active Wiki/File panel still supplies command-time context. The subject path is not substituted into active context when it differs from the active Wiki page or File Viewer tab.

Attachment handling has two explicit, one-way outputs. The operational attachment list is decided only by the existing prompt command's operational validation and is the sole list serialized into or rejected from the harness prompt. Separately, provenance receives an immutable snapshot of the operationally accepted inputs and derives a `resources[]` subject list under the stricter rules above. Provenance normalization must not mutate, filter, reorder, default, add to, or reject the operational list. Therefore an operationally accepted attachment that is provenance-invalid remains in the prompt but is omitted from `resources[]` with a diagnostic; an all-provenance-invalid list still sends the same operational prompt and simply emits no first-pair `ui.action`. Any future hardening of path safety belongs to the operational validator and must be specified/tested independently of provenance.

### First-Pair Redaction Boundary

The first-pair renderer envelope carries no free-text `inputSummary`, content, prompt text, provider-native IDs, or relationship IDs. Slice 40b1a registers `ui-resource-metadata-v1` for enumerated command/view fields and canonical workspace-relative path metadata, and `resource-metadata-v1` with string `policyVersion: '1'` for resource fact metadata without file content.

The first-package policies are exhaustive JSON-pointer allowlists. `*` means one existing array index and does not allow additional child keys.

`ui-resource-metadata-v1` / version `'1'` keeps only:

```text
/schemaVersion /eventId /eventFamily /eventType /occurredAt
/ids/workspaceId /ids/threadId /ids/turnId /ids/correlationId
/actor/type
/provenance/source/type /provenance/source/module
/provenance/origin/type /provenance/origin/id
/provenance/observedBy/type /provenance/observedBy/module
/provenance/confidence
/context/scope /context/viewId /context/panelId /context/route
/context/activeTabId /context/activeDocumentPath
/context/activeResourcePath /context/selectedResourceId
/resources/*/role /resources/*/resourceType /resources/*/path
/uiAction/uiActionId /uiAction/clientCommandId /uiAction/command
/redaction/status /redaction/policyId /redaction/policyVersion
/redaction/omissions/*
```

Rules: `schemaVersion` is integer literal `1`; `eventFamily`/`eventType` are exactly `ui`/`ui.action`; `actor.type` is exactly `human`; `command` is a registered universal command; `clientCommandId`, when present, matches `[A-Za-z0-9_-]{1,128}`. It is optional correlation: invalid renderer input is omitted by the bounded renderer/server extractors and never selects a safe core, rejects an otherwise valid UI fact, or affects the prompt. `provenance.origin.id` must equal `uiAction.uiActionId`, and the 40b1a identity extractor must return that same value as `domainIds.uiActionId`; this is schema-approved current-record identity, not an upstream relationship. Any mismatch is validation error before admission. `context.activeDocumentPath`, `context.activeResourcePath`, and every resource path are canonical workspace-relative paths. For the first pair, `context.route` and `context.selectedResourceId` are exactly `null`. Upstream relationship IDs, when a schema permits them, require SPEC-40's private builder binding.

All retained scalar values must also pass their canonical field schema: IDs are non-empty strings no longer than 256 bytes with no ASCII control characters except that `clientCommandId` has the exact narrower 128-character rule above; `machineName` is valid UTF-8, 1-255 bytes, with no NUL/control character; module identifiers match `^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$`, contain no `.`/`..` segment, and are at most 256 bytes; resource names/extensions are valid UTF-8, contain no NUL/control character, and are at most 512 bytes; counts/sizes/timestamps are finite non-negative numbers, with count fields integers. UI `viewId`/`panelId` values must be registered first-pair literals; other context strings are at most 256 bytes and contain no control characters. Resource `resources[].resourceType` is the exact seven-value resource enum; UI subjects use the exact five-value UI enum. `resourceMutation.observerEventType` is the exact five-value operation enum. A source/observer `{type,module}` pair must be an exact 40b1a producer-registry entry created from the Slice 32a inventory; no arbitrary module string is safe merely because it matches the syntax. Missing registry entry is `unregistered_producer` error and blocks only the candidate.

`isCanonicalWorkspaceRelativePath(value, rootAllowed)` is the single path predicate for UI/resource policies. It returns true only when `value` is valid UTF-8 no longer than 4096 bytes, contains no NUL/control character, uses `/` only, has no leading/trailing `/`, repeated `//`, empty segment, `.` segment, or `..` segment, and resolves lexically against the already-established workspace root without escape. Before containment, it rejects `path.posix.isAbsolute(value)`, `path.win32.isAbsolute(value)`, any `^[A-Za-z]:` drive-qualified or drive-relative prefix (`C:/x`, `C:x`), UNC/device prefixes (`//server`, `\\server`, `\\?\\`), and every backslash. Percent sequences are not decoded and Unicode is not normalized. Empty string is valid only with `rootAllowed`: a validated UI panel root, or a `folder|view` resource root with explicit null parent fields. All other paths use `rootAllowed = false`. The policy never repairs failure; required failure rejects the candidate (UI uses safe core), while an unsafe optional symlink target is omitted with `:unsafe_path`. Tests cover POSIX absolute, drive absolute/relative in both cases, UNC/device, slash/backslash, repeated/trailing separators, dot segments, controls, overlength, root exceptions, and containment escape.

Successful first-pair UI presence is exact:

- Required: the five top-level envelope fields in the keep set; `ids.workspaceId`; `actor.type`; all retained source/origin/observedBy/confidence fields; `context` with `scope = 'ui'`, registered `viewId`/`panelId`, `route = null`, and `selectedResourceId = null`; a non-empty `resources` array whose every entry has exactly `role = 'subject'`, one of `file|folder|wiki|ticket|doc`, and `path`; `uiAction.uiActionId`; `uiAction.command = 'chat.send_with_resource'`; and all redaction status/policy/version fields.
- Optional: `ids.threadId`, `turnId`, and successfully server-generated `correlationId`; `context.activeTabId`, `activeDocumentPath`, and `activeResourcePath` as string or null; `uiAction.clientCommandId`; and `redaction.omissions` under the status rule below. Fresh-correlation generator absence/throw, allocation failure, or private-registration failure omits only `ids.correlationId` with exact fixed `fresh_correlation_unavailable`; the safe UI fact remains admissible and the command is unchanged. `clientCommandId`, caller/session/operation state, inspected refs, and raw IDs are never fallback canonical correlation. First-package `ui.action` rejects populated `rootEventId`, `parentEventId`, or `causationId` because 40b1a registers no predecessor/cause selector for it. No other retained pointer is optional.
- Full successful records require `context`; only the exact redaction-failed safe core may omit it. `redaction` is required on every first-package UI record. `omissions` is required and non-empty when status is `applied`, absent when `not_required`, and exactly `['/*:redaction_failed']` when `failed`.

The UI policy omits these known optional paths with `policy_forbidden`: `/actor/id`, `/provenance/source/path`, `/provenance/source/handler`, `/provenance/observedBy/path`, `/provenance/observedBy/handler`, `/lifecycle`, `/ledger`, `/uiAction/inputSummary`, `/uiAction/resultEventIds`, `/uiAction/resourceEventIds`, and `/resources/*/{resourceId,oldPath,relatedEventId,resourceEventId,fileVersionId}`. It also omits top-level `/content`, `/prompt`, `/nativeRefs`, `/preview`, and `/hashes` if a compatibility adapter supplies them. Unsafe/unresolvable UI paths cause redaction failure and replacement by the exact safe core below. Any other pointer not in the keep or known-omit set is `unknown_field` validation error; it is never silently retained or dropped.

`resource-metadata-v1` / version `'1'` keeps only:

```text
/schemaVersion /eventId /eventFamily /eventType /eventPhase /occurredAt
/ids/{workspaceId,machineId,machineName,threadId,turnId,exchangeId,messageId,
      rootEventId,parentEventId,correlationId,causationId,serverMutationId}
/actor/type
/provenance/source/{type,module} /provenance/origin/{type,id}
/provenance/observedBy/{type,module} /provenance/confidence
/provenance/cause/uiActionId
/context/{scope,viewId,panelId,route,activeTabId,activeDocumentPath,
          activeResourcePath,selectedResourceId}
/before and /after children {exists,omitted,omissionReason,resourceId,resourceType,
  path,name,parentPath,parentName,size,mtimeMs,lineCount,wordCount,tokenCount}
/before/omissions/* /after/omissions/*
/before/siblings/*/{name,path,type,extension,size,mtimeMs}
/after/siblings/*/{name,path,type,extension,size,mtimeMs}
/parentListings/{before,after}/{path,name,files,folders}
/parentListings/{before,after}/siblings/*/{name,path,type,extension,size,mtimeMs}
/parentListingOmissions/{before,after}
/resourceMutation/{resourceEventId,resourceId,resourceType,path,oldPath,operation,
                    observedAt,observerEventType,sizeBefore,sizeAfter}
/resourceMutation/symlink/{target,broken}
/resourceMutation/hashOmissions/{contentHashBefore,contentHashAfter}
/resources/*/{role,resourceId,resourceType,path,oldPath,relatedEventId,resourceEventId}
/redaction/{status,policyId,policyVersion} /redaction/omissions/*
```

Braced child lists above are exhaustive. All canonical resource paths, context document/resource paths, sibling/parent paths, and symlink targets retained by this policy are canonical workspace-relative. Accepted-only relationship/domain IDs require `prepareCanonicalCandidate`'s registered pointer/ref binding; an accessor-returned string, unregistered binding, raw ID, or `/automationRef` is stripped before final validation, omits its entire registered relationship group, and reports only fixed `accepted_relationship_unbound` while the relationship-free safe fact proceeds. The policy omits `/actor/id`, source/observer `path` and `handler`, `/lifecycle`, `/ledger`, and all four possible concrete content-hash fields with the reasons below. Top-level or nested content, snippet, diff, preview, provider/native-ref, raw, or other unlisted non-relationship fields are `unknown_field` errors. An unsafe required resource path is `unsafe_path` error and rejects the candidate; an unsafe optional symlink target is omitted as `unsafe_path`.

Successful first-package resource presence is exact:

- Required for every branch: `schemaVersion`, `eventId`, `eventFamily = 'resource'`, a registered resource `eventType`, `eventPhase`, `occurredAt`, `ids.workspaceId`, `actor.type`, registered source/observedBy `{type,module}`, `provenance.origin.type`, `provenance.confidence`, `before`, `after`, `resourceMutation.resourceEventId/resourceType/path/operation`, a non-empty `resources` array with at least one `role = 'subject'`, and redaction status/policy/version.
- Server mutation branch: `eventPhase = 'complete'` and `ids.serverMutationId` is required; `resourceMutation.observedAt` and `observerEventType` must be absent. Watcher branch: `eventPhase = 'observe'`, `resourceMutation.observedAt` and `observerEventType` are required, and `ids.serverMutationId` must be absent. Origin ID, cause fields, other relationship IDs, context, parent listings, and non-subject resources are optional only when sourced/validated under their owning rules.
- Per operation, `before`/`after` variants follow SPEC-32's minimum-state table. A present state requires `exists = true`, `resourceType`, and `path`; an absent state requires `exists = false` and `path`; an unavailable state requires exactly `{ omitted: true, omissionReason }`. Rename requires `resourceMutation.oldPath`; other operations omit it. A symlink object is allowed only for `resourceType = 'symlink'` and requires `broken`; `target` is optional.
- Every `resources[]` entry requires `role` and one of `file|folder|symlink|view|style|config|registry`; `resourceType` values `wiki|ticket|doc` are UI-only and are resource-policy errors. A subject entry requires `path`; optional accepted-only relationship IDs require SPEC-40's registered builder binding. Canonical `eventType`, `resourceMutation.operation`, and watcher `observerEventType` use the exact paired union in SPEC-32; any cross-pair is an error. A present `resourceMutation.symlink` requires `broken`.
- `redaction` is required. `omissions` presence follows the same applied/not-required rule; `failed` resource redaction is never admitted, so no canonical resource record has status `failed`.

`redaction.omissions` is a sorted unique `string[]`. Each item is an RFC 6901 JSON pointer plus exactly one suffix: `:policy_forbidden`, `:policy_unapproved`, `:unsafe_path`, or `:redaction_failed`. Array entries use their actual numeric index, never `*`. Known omitted fields add their exact pointer/reason. The UI failure safe core uses exactly `['/*:redaction_failed']` and no field-specific list.

No first-package policy trims, case-folds, coerces types, rewrites separators, resolves `.`/`..`, or otherwise transforms a retained scalar. The only successful transformations are (1) removing a known-omit field, (2) removing an unsafe optional symlink target, and (3) synthesizing missing branch-required hash omission metadata and matching redaction omission pointers. A conflicting supplied omission value is an error, not corrected. Any successful transformation makes `status = 'applied'`; hash-omission synthesis is applied even when the producer supplied no hash. `not_required` is valid only when the input already equals the complete retained safe form, the hash matrix requires no policy omission, and no known-omit field was present; in that branch `redaction.omissions` is absent. Errors publish no candidate and never affect the source operation.

Hash omission is branch-exact. For each `before` or `after` side:

| Side variant | State hash field | State omission | Mutation hash omission | `redaction.omissions` entry |
|---|---|---|---|---|
| `ResourceStatePresent` | `contentHash` absent | `side.omissions.contentHash = 'policy_unapproved'` required | matching `resourceMutation.hashOmissions.contentHashBefore/After = 'policy_unapproved'` required | both `/side/contentHash:policy_unapproved` and `/resourceMutation/contentHashBefore|After:policy_unapproved` required, even when the producer supplied no hash |
| `ResourceStateAbsent` | absent | no content-hash omission | matching mutation hash omission = `not_applicable` | none |
| `ResourceStateUnavailable` | absent | unavailable object has no child omission | matching mutation hash omission = `not_observed` | none |

Thus create/delete produce two policy-unapproved redaction entries for their one present side; modify/rename/metadata produce four when both sides are present, fewer only when a side is unavailable. There are four possible concrete forbidden hash pointers, not three. Any retained hash is validation error.

`lifecycle-metadata-v1` / version `'1'` is the third first-package policy. Its common keep set is exactly `/schemaVersion`, `/eventId`, `/eventFamily`, `/eventType`, `/occurredAt`, `/ids/workspaceId`, `/ids/machineId`, `/ids/machineName`, `/ids/correlationId`, `/ids/previousWorkspaceId`, `/actor/type`, `/provenance/source/type`, `/provenance/source/module`, `/provenance/origin/type`, `/provenance/observedBy/type`, `/provenance/observedBy/module`, `/provenance/confidence`, `/redaction/status`, `/redaction/policyId`, `/redaction/policyVersion`, and `/redaction/omissions/*`. First-package lifecycle rejects populated root, parent, causation, ID-bearing origin, or UI cause fields because 40b1a registers no accepted canonical predecessor/cause for lifecycle. Variant-only keep sets are exactly:

- workspace: `/workspace/reason`; canonical workspace roots are never present;
- view registry: `/viewRegistry/reason`, `/viewRegistry/affectedPanels/*`, and `/viewRegistry/affectedResources/*/{path,resourceType}`;
- theme: `/theme/affectedPanels/*`, `/theme/affectedFiles/*`, and `/theme/affectedResources/*/{path,resourceType}`.

Workspace reason, view reason, actor/origin/confidence, and resource types use their declared enums. Workspace-switch `ids.previousWorkspaceId` is required but nullable and pairs with required-nullable `ids.workspaceId`; view/theme variants forbid `previousWorkspaceId`. Panel IDs are registered identifiers. Every affected path/file passes `isCanonicalWorkspaceRelativePath(..., false)`. Known compatibility fields `/workspace/workspaceRoot`, `/workspace/previousWorkspaceRoot`, `/actor/id`, `/provenance/source/path`, `/provenance/source/handler`, `/provenance/observedBy/path`, `/provenance/observedBy/handler`, `/lifecycle`, `/context`, `/resources`, and `/ledger` are omitted with `policy_forbidden`, making status `applied`; arbitrary unlisted fields are errors. Redaction is required and uses `lifecycle-metadata-v1`/`'1'`; `not_required` is valid only with no omitted compatibility field and has no omissions, while `applied` requires a sorted non-empty unique omissions tuple. Status `failed` is not a canonical lifecycle branch. Missing, failed, or thrown lifecycle redaction publishes no canonical lifecycle event or accepted reference, preserves the operational lifecycle change, records a diagnostic, and sends the matching non-canonical `lifecycle:refresh_required` recovery message. The first package defines no lifecycle safe core.

Potentially sensitive UI fields are client correlation, route/document/resource/selection context, and resource paths. If UI redaction is missing, fails, or throws, the pre-UEB publisher replaces the candidate with exactly this shape; no other key is present:

```ts
{
  schemaVersion: 1,
  eventId,
  eventFamily: 'ui',
  eventType: 'ui.action',
  occurredAt,
  ids: { workspaceId },
  actor: { type: 'human' },
  provenance: {
    source: { type: 'ui-action-ingestor', module: 'provenance/ui-action-ingestor' },
    origin: { type: 'ui', id: uiActionId },
    observedBy: { type: 'ui-action-ingestor', module: 'provenance/ui-action-ingestor' },
    confidence: 'direct'
  },
  resources: [],
  uiAction: { uiActionId, command },
  redaction: {
    status: 'failed',
    policyId: 'ui-resource-metadata-v1',
    policyVersion: '1',
    omissions: ['/*:redaction_failed']
  }
}
```

`workspaceId`, `uiActionId`, and envelope values are server-owned; `command` is the already-validated registry command. Slice 40b1a registers the exact source/observer pair above. If even this safe core cannot validate, admit no event and continue the command without a propagatable reference.

Resource mutation candidates require workspace/path/operation as their fact core. If `resource-metadata-v1` redaction fails, do not emit a path-bearing or incomplete canonical resource event; record a diagnostic, return no accepted reference, and invoke `resource:refresh_required` after the valid mutation. No first-pair pre-UEB failure branch may expose prompt/content text or a hash/preview derived from omitted material.

## Server Handoff

The renderer constructs command context and resource inputs. The first server handler accepts or rejects the source command using operational rules independently of provenance. After acceptance it starts the operational command path, performs only the exact fixed-schema nonrecursive extraction and bounded target copy, consumes the transient token for binding, and submits only the already-frozen token-free queued envelope, target copies, and bound context for `ui.action` construction/redaction/validation/admission. The extraction wrapper/token is discarded before admission without another envelope copy, and no later stage runs or is awaited in the command/response chain. Extraction failure omits UI provenance. A command-scoped accepted-reference slot is write-once; downstream producers check it synchronously and either pass the available ref to `prepareCanonicalCandidate` or omit the relationship and diagnose without waiting. Optional enrichment is included only when already available. The canonical record uses the accepting server ingestor for `provenance.source` and `provenance.observedBy` and assigns its schema-approved self-origin; downstream `resource.*` events use the server mutation producer.

The server discards unknown legacy ID-bearing fields in renderer provenance input. It never promotes renderer `eventId`, root/parent/cause IDs, resource IDs, related-event IDs, resource-event IDs, or file-version IDs. When the canonical `ui.action` is admitted, the ingestor receives its accepted reference for downstream propagation. On failure it returns no propagatable action ID. Server handlers must:

- Preserve an upstream UI relationship only through a `prepareCanonicalCandidate` binding that consumes the already-available accepted UI ref; copying `uiActionId`, including from `inspectAcceptedRef`, is insufficient.
- Preserve command-time `context` unless a field is invalid or redacted.
- Preserve normalized `resources[]` and add server-derived resource refs when useful.

Resource mutation handlers must:

- Attach `provenance.cause.uiActionId` only through the registered builder binding when the upstream `ui.action` ref is already available.
- Set downstream resource mutation `provenance.source` and `provenance.observedBy` to the server mutation producer. For an accepted upstream action, preserve `provenance.origin = { type: 'ui', id: uiActionId }` and its cause ID. If UI-action publication failed, the known UI ingress may still use `origin.type = 'ui'`, but `origin.id` and `cause.uiActionId` are omitted and a diagnostic records the gap. Do not copy UI-action event provenance wholesale.
- Generate or propagate `ids.serverMutationId` on every downstream resource mutation produced by a server-side mutation command.

First-package Slice 40b1a does not register canonical chat events. Existing `chat:*` facts remain a named compatibility path and must not be mutated with `uiActionId` or treated as canonical relationship consumers. Owner-approved `CHAT-D01` and SPEC-40b2a must register the exact affected chat event/schema/redaction policy and replace that gap before any chat cause/result linkage is accepted; at that point chat producers use `prepareCanonicalCandidate` with an already-available UI ref or omit the relationship without waiting. This deferral does not affect prompt execution or the independent `ui.action` record. If a later registered chat/tool flow causes a resource mutation, its accepted-only relationships follow the same builder rule; operational `ids.serverMutationId` remains independent.

The `ui.action` event itself must not self-reference its own `uiActionId` in `provenance.cause`.

## Migration Slices

### Slice 34a — Audit Current UI Mutation Entry Points

- Identify mutation-producing command paths in Wiki, File Viewer, Capture, Office, Email, and shared file APIs.
- Record whether each path starts from button, menu, keyboard shortcut, drag/drop, autosave, command palette, or view-local handler.
- Do not wire events yet.

### Slice 34b — Central Module Skeleton

- Add central UI action command envelope builder.
- Keep Slice 34b renderer-only: it may create an optional `clientCommandId` for operational correlation but must neither create nor accept `uiActionId`. Server ID creation and all admission work belong to 34d1.
- Add normalized resource ref helper.
- Add command registry with the initial universal vocabulary.
- Unit test envelope construction and resource normalization with a table covering every validity branch: each missing/wrong typed `panel`, `path`, panel-relative `relativePath`, or `kind`; unsupported kind; absolute prefix; backslash; `.` segment; `..` segment; missing/malformed/stale `panelStore.projectRoot`; unresolved/out-of-project target panel root; a File Viewer root equal to project root and a valid configured File Viewer subdirectory root; target absolute containment failure; `panelRoot + relativePath`/absolute-path mismatch; invalid empty non-root path; valid empty target-panel-root path; and derived workspace-relative validation. Prove a Wiki panel-relative `010-X/PAGE.md` becomes `ai/<machine>/Wiki/010-X/PAGE.md`; prove a File Viewer subroot `src` plus panel path `a.ts` becomes `src/a.ts`, not `a.ts`; raw panel-relative values and absolute roots never enter canonical JSON. Prove both active-context conversions, null/diagnostic degradation, exhaustive five-kind mapping, and mixed lists that preserve every valid operational subject while diagnosing/omitting invalid provenance. Test 31/32/33 subjects, steps 511/512/513, seed bytes 16,383/16,384/16,385, code-unit/UTF-8 boundaries minus/exact/plus for every root/path/ID/name field and intermediate join, and `clientCommandId` at 127/128/129 plus the outer 255/256/257 preflight boundary. Assert wrong-format and 129-256 optional correlation is omitted without losing the envelope, while above-256 exhausts capture and omits the whole seed. Install spies on every path/normalization/containment/equality helper and prove no helper receives an over-cap operand or runs after preflight/budget failure; limit-plus-one scanning and exact whole-seed omission must not inspect later entries.
- Prove every renderer seed subject carries its exact original zero-based operational attachment index: mixed invalid provenance produces strictly increasing indices with gaps, subject order is unchanged, the field adds no operational-list mutation, and the private index never appears outside `uiActionSeed` or in any canonical-shaped local object.
- Make the 31/32/33 subject result explicit: 31 and end-of-list 32 produce a seed; 32 followed only by fully inspected invalid attachments and list end still produces 32; the first 33rd qualifier omits the whole seed immediately; and step/preflight exhaustion while examining the post-32 tail omits the seed as indeterminate. Spies prove no attachment after the deciding qualifier, list end, or exhaustion is inspected.
- Snapshot the pre-provenance operational attachment decision/list and prove provenance normalization cannot mutate it. Mixed and all-provenance-invalid cases must serialize exactly the same operational attachment paths and order as the pre-provenance baseline while changing only the independent provenance subject list/diagnostic.
- Inject throws separately from adapter lookup, panel/wiki/file store reads, panel-root resolution, attachment normalization, envelope construction, the diagnostic sink, and enriched serialization. Static inventory permits only the named synchronous in-memory functions and rejects async/thenable extension seams; install zero-call paused/Promise-returning spies for every forbidden I/O/provider/plugin/entropy hook. Every branch and every budget exhaustion must call `socket.send` once with byte-equivalent baseline operational prompt/attachment JSON and no provenance envelope. The diagnostic-sink throw is swallowed only by the provenance degradation boundary. A `socket.send` throw is observed through the existing operational error behavior and is never retried; a baseline serializer throw likewise remains an operational failure.
- Add Vitest as a locked client dev dependency, add package script `"test:provenance": "vitest --config vitest.provenance.config.ts"`, and add `vitest.provenance.config.ts` with Node environment, isolated mocks, cleared/restored mocks between cases, and only the named provenance unit-test include pattern. Add `src/provenance/__tests__/ui-action-command-envelope.test.ts` for the complete construction/path/resource table and `src/provenance/__tests__/ui-action-send-fallback.test.ts` for every failure-injection branch. The fallback suite captures the pre-provenance serialized baseline bytes and asserts strict byte equality, exactly one `socket.send` call, no enriched envelope, no retry after send failure, and unchanged operational serializer failure behavior.
- Required client checks: `cd fusion-studio-client && npm run test:provenance -- --run src/provenance/__tests__/ui-action-command-envelope.test.ts src/provenance/__tests__/ui-action-send-fallback.test.ts` and `cd fusion-studio-client && npm run build`. The slice report records the added Vitest version and lockfile change; tests are not accepted through build-only evidence or an unconfigured global runner.

### Slice 34c — First Adapter Pair Preparation

- Implement adapters for Wiki and File Viewer first, matching SPEC-32 priority.
- Use the normative mappings above and the two per-view wiki child articles.
- Integrate local first-pair envelope preparation at actual `chat.send_with_resource` prompt construction when the active context uses a first-pair adapter and at least one pending resource attachment is valid, but do not attach `uiActionSeed` or any provenance field to the wire request in this slice. Wire attachment is atomic with the complete server prompt-log fence in 34d1. Do not prepare on attachment staging or navigation.
- Preserve legacy prompt behavior outside the supported pair until later adapters exist.
- Verify `RSC-D12a` is closed for each command path before conversion.
- Required client check: `cd fusion-studio-client && npm run build`.
- Required manual smoke: cover (1) Wiki active with a valid attachment staged by another panel, (2) File Viewer active with a mixed provenance-valid/invalid list, (3) an unsupported active panel with a valid Wiki/File attachment, and (4) Wiki/File active with an operationally accepted but all-provenance-invalid attachment list. The first two prepare exactly one local envelope using active-panel context, preserve every provenance-valid subject, and omit invalid provenance subjects with diagnostics; the last two prepare none. In every case, assert the actual wire request has no `uiActionSeed`/provenance fields and its serialized prompt/attachment paths/order are byte-equivalent to the pre-provenance operational baseline. Staging alone prepares nothing.
- Repeat the supported sends with each synchronous provenance capture/diagnostic/local-enrichment throw injected. Assert exactly one wire send with the unchanged baseline prompt and attachment bytes and no provenance seed. Separately inject `socket.send` failure and prove there is no provenance fallback retry.

### Slice 34d1 - UI-Only Server Handoff

- Hard prerequisite: accepted Slice 32b0 coordinator/root authority, recipient-specific token transport/store/logging fence, and isolated provenance E2E launcher. 34d1 must reuse them and cannot create a parallel workspace/session/token authority or temporary compatibility path.
- Apply the registry update gate to the UI-action ingestor entry before enabling it; promotion/evidence and any semantic registry/version change ship atomically with generated consumer updates.
- First install and verify the complete prompt/UI-seed logging fence below, then atomically attach the first-pair UI action envelope/token to the durable chat request path in the same release. No intermediate state may put `uiActionSeed` on the wire without the accepted fence. This slice does not integrate a resource mutation producer.
- After operational validation starts the source command, run only the exact bounded nonrecursive `extractBoundedUiActionSeed` pure copy above; never clone, freeze, stringify, recursively validate, or retain the untrusted parsed seed. It returns one transient token sibling plus one already-frozen recursively readonly token-free queued envelope. Complete extraction/envelope, target, and bound-context preflight before allocating any accepted-ref slot/link; pass the same envelope object without another copy and drop the wrapper/token before allocation. Submit only those successful three token-free bounded data values to D01 admission, otherwise omit UI provenance with zero slot/link state. Emit accepted events on UEB and prove failure isolation/non-delay for the source command.
- At command acceptance, attempt SPEC-40's bounded nullable owner-cell initialization; null disables only provenance, while command `finally` closes a non-null cell. After the operational path starts, run only the exact 24-step `bindUiProvenanceContextForQueue`, consuming the transient extracted token, and discard the extraction wrapper/token plus opaque command ref before slot creation/offer. On successful token-free-envelope/target/context preflight, call nullable slot allocation. Null installs/offers nothing; a non-null slot atomically installs only while the owner cell is open, and `owner_closed` terminalizes/releases it without offer. A successful install immediately calls SPEC-40's module-private fixed offer with the slot synchronously in the same non-yielding turn. Only the D01-created slot link enters the task; never queue the workspace token/extraction wrapper, owner cell/slot handle, command-context capability/ref, attachment/vector entry/operation object, or clone/freeze/scan/retain the complete operational attachment list. Re-resolve all context/resources later from `BoundUiProvenanceContext`; never use `session.currentWorkspaceId`, `session.projectRoot`, renderer roots, or copied relative paths as server authority.
- Reuse the accepted 32b0 zero-payload-log boundary. Before any 34d1 wire attachment, close the server prompt inventory covering `fusion-studio-server/lib/ws/redaction-map.js`, pre-handler serialization/truncation in `client-message-router.js`, and every prompt console/debug/rejection/error serializer. Remove all prompt-family ingress payload/type logging: no console/debug/logger/redactor/formatter/stringifier or logging executor receives the raw text, parsed message, `uiActionSeed`, safe type, rejection, or exception from the operational handler stack. After handler invocation, observability may only increment a module-private saturating counter selected from a closed compile-time prompt-type/outcome enum; it is fixed O(1), has no callbacks, stays at `Number.MAX_SAFE_INTEGER`, serializes/persists nothing, and contains no input-derived value. Parse/rejection failures increment only fixed `parse_rejected|route_rejected|unknown` counters. Thus arbitrary synchronous logger code cannot run in or backpressure prompt ingress.
- Create the server-owned `uiActionId` only inside that post-acceptance supervised admission task. Ignore/reject any renderer-supplied `uiActionId`; optional renderer `clientCommandId` remains non-authoritative correlation only. The Jest suite asserts both boundaries.
- Preserve the operational attachment decision/list before deriving provenance subjects. The provenance branch reads an immutable snapshot and has no write path back to prompt serialization or command acceptance.
- Do not mutate legacy `chat:*` facts with `uiActionId` in 40b1a. Downstream chat cause/result linkage remains deferred to `CHAT-D01` and 40b2a, and this slice makes no resource-producer integration claim.
- Keep legacy command acknowledgement messages separate from cache invalidation truth.
- Add focused 34d1 Jest coverage for prompt echo/binding, bounded server extraction, and admission only; allocator, init/panel-root linearization, recipient transport, token lifetime, and workspace-message logging remain exclusively implemented/owned by accepted 32b0. Cover accepted binding, degraded optional context after binding, operationally invalid command rejection, self-reference, paused-admission non-delay, cross-panel/mixed-validity attachments, and genuine missing/failed/thrown UI redaction after successful binding. For the server seed extractor, statically assert that the generated fixed-pointer/charge table equals 207 reads, 170 scalars, and 1,034 total sites, then run the maximally populated valid shape and assert those exact counts; 33 subjects must fail from array length before an extra index/property/step. Test 127/128/129 and 255/256/257 `clientCommandId`; recognized path/ID/name and 16,383/16,384/16,385 total-byte caps; missing/wrong/duplicate/equal/descending/out-of-range attachment indices; accessors/inherited/non-JSON containers; huge unknown sibling counts; and deeply nested/wide unknown subtrees with throwing getter sentinels. Assert the extraction result contains a transient token sibling and recursively frozen token-free `UiActionQueuedEnvelope`; binder/target preflight passes that exact envelope identity without another copy and drops the wrapper/token before slot allocation. For target copies, statically assert the direct-index charge table equals 129 reads, 160 scalars, and 901 total sites including all 64 type/path comparisons, then run 32 maximally populated valid targets and assert those exact counts; a 33rd subject must fail before another vector read. Also test 16,383/16,384/16,385 bytes, gaps, duplicates, order, holes, non-accepted entries, copied index equality, every numeric/enum/path boundary, returned attachment/vector/object/callback/capability rejection, and D01 completion/rejection/overflow/cancellation/expiry/forced-cleanup/shutdown release. These structural/table assertions reach exact maxima without artificial padding; over-structural fixtures prove the implementation stops before crossing them. Assert unknown branches/getters are never accessed, over-cap/non-JSON input retains no original reference and yields only fixed `ui_provenance_seed_unavailable`, 129-256 or wrong-format optional client correlation is omitted while the UI fact remains eligible, above-256 input omits the whole seed, and prompt acceptance/response settles. Assert owner-cell initialization failure disables only provenance; extraction/envelope/target/binder failure allocates zero slots/links; nullable slot allocation releases partial charges and never installs/offers; and install-versus-completion/cancel/throw at every boundary either installs and immediately offers in the same non-yielding turn or returns `owner_closed`, terminalizes/releases once, and never offers. Assert link creation/measurement/setup/rejection/overflow each terminalizes an installed slot once and permits normal deletion without expiry. Assert D01's UI data plane receives only the token-free queued envelope, closed five-field target copies, and bound context; its queued control plane receives exactly one D01-created/accounted slot link while the offer sees the branded slot only synchronously. Prove type/ABI and WeakRef sentinels make the workspace token/extraction wrapper absent and unreachable from queued/active/cancelling task data; prove all cell/data/slot/link charges release, exactly one terminal slot settlement, rejection of caller lookalikes/callbacks/finalizers/command-context handles, and no queued owner cell/slot handle or external reachability to the attachment list/vector/operation graph. Supply an operational attachment vector far above 32 and prove provenance performs at most 32 strictly increasing direct indexed reads and never scans/clones/retains that vector; unavailable/mismatched input omits provenance. Feed healthy, omitted, stale, forged, wrong-connection, rotated, A/B panel-root mismatch, same-relative-path-in-both-roots, and async-admission-after-later-transition outcomes from the 32b0 public test seam without reimplementing its allocator/init hooks. Every binding-failure case asserts zero candidate-builder/publisher calls, no `uiActionId`/event/ref/mirror/edge, deep equality with frozen `{ code: 'workspace_context_unbound' }`, exact one-key sink acceptance, saturating/reset behavior, no serialized retention, and no token/path/root/workspace/connection/client/transition/panel/attachment/reason/exception sentinel in the sink, every generic error/logger path, or persistence output. Inject sink throw and prove unchanged prompt bytes/acceptance and no redaction-safe-core misuse. Genuine redaction failure tests exact `policyId === 'ui-resource-metadata-v1'` and `policyVersion === '1'`. Legacy chat facts receive no `uiActionId`, publisher call, accepted ref/context/status, or canonical subscriber delivery; raw/copy-only relationship IDs fail.
- Inject fresh-correlation generator absence, synchronous throw, allocation failure, and private-registration failure after a safe UI base exists. Each must produce exact one-key `fresh_correlation_unavailable`, omit only `ids.correlationId`, admit the otherwise identical UI fact, and leave prompt/command execution unchanged. Spies and sentinels prove zero fallback reads/copies from `clientCommandId`, renderer/caller/session/operation state, raw IDs, or accepted-ref inspection and no failed-generation value retention.
- Assert `operationalAttachmentIndex` and `subjectOrdinal` are consumed before redaction/canonical construction and are absent from every candidate, safe core, accepted event/ref inspection, subscriber delivery, diagnostic, log, persistence row, and response. A static keep-set test fails if either private name becomes a canonical/ledger/output pointer.
- Test the synchronous binder's generated charge table and exact healthy count of 24; wrong/missing/stale/forged/cross-connection token, workspace/root/transition mismatch, closed ref, over-cap ref fields, byte 4,607/4,608/4,609, and registry absence all return null with only `workspace_context_unbound`. Install throwing/Promise/nonreturning spies on every non-registry callback/provider/I/O seam and prove zero calls. Static export/import tests prove the binder/result acceptance is module-private and a same-shape caller object cannot enter D01. Before offer, use type/ABI plus reachability/WeakRef sentinels to prove no extraction wrapper, workspace token, command ref, connection, transition capability, registry entry, session, or live workspace object is retained; D01 contains only the token-free queued envelope, target copies, bound context, and its own accounted slot link and releases all four in every terminal branch. Sentinels prove the bound root/context never enters canonical events, safe cores, logs, diagnostics, persistence, or responses.
- Add `fusion-studio-server/test/provenance/ui-action-wire-log-redaction.test.js`. Reuse the accepted 32b0 client tests and cover canonical prompt seed plus absent, wrong type/format, inherited, top-level prompt, inside-envelope, alternate nesting, duplicate canonical/wrong-path, arrays, malformed siblings, every registered prompt-family type, parse/route rejection, and unknown type. Seed fixtures place unique sentinels in `clientCommandId`, every context path/ID, every resource field, future unknown seed children, token occurrences, raw text, and thrown exception fields. Spy on every statically inventoried console/logger/redactor/formatter/stringifier/rejection/error function and assert zero calls, no sentinel/reserved key anywhere, handler/binder invocation, then exact fixed counter increment/saturation. Install synchronous-prefix, nonreturning-worker, throwing, and never-settling logger spies and prove none is reachable from production prompt ingress while prompt acceptance/response settles. A bidirectional static assertion fails when a new prompt logger/serializer/error path or provenance wire field is not inventoried/tested.
- Required server checks: `cd fusion-studio-server && npm test -- --runInBand test/provenance/ui-action-ingestor.test.js test/provenance/ui-action-wire-log-redaction.test.js`.
- Required prerequisite regression rerun, unchanged: `cd fusion-studio-server && npm test -- --runInBand test/provenance/workspace-command-context-transport.test.js` and `cd fusion-studio-client && node e2e/run-provenance-playwright.cjs e2e/workspace-command-context-transport.spec.ts`. Failures return to 32b0 ownership; 34d1 does not patch around them.
- Required client check: `cd fusion-studio-client && npm run build` (the token logging unit check is an accepted 32b0 prerequisite and remains in the regression suite).
- Add `fusion-studio-client/e2e/ui-action-workspace-token.spec.ts` and run `cd fusion-studio-client && node e2e/run-provenance-playwright.cjs e2e/ui-action-workspace-token.spec.ts`. Through real WebSockets and the isolated 32b0 harness, use two browser contexts to prove token-optional init receipt -> detached exact-current `workspace:context_token` -> recipient-specific ephemeral client slot -> prompt private-seed echo -> server binder -> eventual accepted `ui.action`; then prove paused entropy leaves prompts operational with no event, switch rotation, close-before-reinit clearing, reconnect rotation, cross-client/stale/missing token no-event, persistence/workspace-cache exclusion, missed-notification convergence, and healthy re-admission. Record run nonce/root cleanup, both connection token inequality without printing values, transition capability changes, prompt response timing, accepted event IDs only for healthy bindings, and zero candidate/ref/edge for failed bindings.
- Required runtime smoke: run the four cross-panel/mixed-validity/unsupported/no-valid cases from Slice 34c. For each supported case, verify prompt acceptance is not sequenced behind provenance, the independent `ui.action` is eventually accepted when healthy, active-panel context and valid subjects are preserved, and legacy chat facts contain no unregistered `uiActionId`. Pause the admission executor and prove the prompt response settles; then release it and verify eventual admission. Downstream chat cause/result linkage is explicitly deferred to `CHAT-D01` and SPEC-40b2a.

### Slice 34d2 - Downstream Resource Producer Binding

This is not part of the first Wiki/File `chat.send_with_resource` handoff because that command does not itself mutate a resource. Prerequisites: Slice 32b's canonical resource contract is accepted, the applicable UI-origin mutation producer has been converted in Slice 32d, and its exact producer entry is active in the registry with `leaseRole: 'none'`.

- Atomically promote that same producer entry from `leaseRole: 'none'` to `leaseRole: 'command_downstream'` and add only the exact approved command types. This semantic authorization change increments `freezeVersion` and regenerates the SPEC-40a active token/command table plus SPEC-40b1a consumers in the same 34d2 unit. It does not create a second producer identity. Tests prove the old version, the prior no-lease entry, unlisted commands, and synthetic tokens cannot acquire a lease while the exact updated entry can.
- Acquire the command-scoped lease only for the registered converted producer. Attach `provenance.cause.uiActionId` and ID-bearing UI origin only through `prepareCanonicalCandidate` when the accepted UI ref is already available; pending/failed/closed/late branches omit them without waiting while preserving server mutation ID and non-ID context.
- Add focused resource-producer tests for builder-bound success, pending/late omission, rejected/suppressed UI admission, copied/raw ID atomic relationship-group omission with base resource-fact admission, resource redaction success/failure, mutation success isolation, fixed one-key diagnostics, and no retroactive cause insertion. Successful resource redaction asserts `policyId === 'resource-metadata-v1'` and string `policyVersion === '1'`; unrelated required-core/redaction failure invokes recovery and returns no resource ref.
- Required server check: `cd fusion-studio-server && npm test -- --runInBand test/provenance/resource-event-producer.test.js test/provenance/harness-tool-cause-propagation.test.js` only when the latter domain is registered; otherwise run only the resource-producer test and report the deferred later-domain matrix.
- Acceptance is per converted producer. No synthetic producer token or unconverted command may acquire a lease.
- Apply the registry update gate for each converted producer before lease acquisition is enabled; 34d2 cannot reuse a stale planned token or change handler/command coverage without the atomic freeze-version/consumer update.

### Slice 34e — Remaining View Adapters

- Add Capture, Office, Email, and other mutating view adapters as their migration slices reach UI-origin commands.
- Each adapter gets a small mapping page, not a separate provenance model.

## Completion Criteria

- Mutation-producing UI commands use one central envelope shape.
- Downstream resource mutation events carry `provenance.cause.uiActionId` only through a registered builder binding that consumes an already-available accepted upstream UI ref; failure/pending paths contain no rejected, unpublished, or unproven ID.
- Canonical UI-origin mutation events use the server-resolved workspace and best available command-time context; absent optional context is explicit and never blocks the mutation.
- Wiki and File Viewer adapters are documented and implemented first.
- Server-side inference is not used for UI-origin context except malformed legacy requests during migration.
- SPEC-32 `RSC-D12a` is closed for every migrated UI-origin view/command path.
