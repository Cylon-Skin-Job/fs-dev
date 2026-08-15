# SPEC-33 — Universal Ledger File Versioning and Provenance

> **SUPERSEDED SNAPSHOT — DO NOT IMPLEMENT.** The current planning authority is [SPEC-33 in `008-Provenance-Temp`](../../008-Provenance-Temp/33-universal-ledger-file-versioning.md), its [spec-set map](../../008-Provenance-Temp/00-provenance-spec-set-map.md), and linked wiki authorities. This notice was reinforced by the [2026-07-15 provenance cross-article findings](../../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat to correct misleading guidance.

**Origin:** User architecture discussion, 2026-07-09 — future SQLite file versioning, Universal Event Bus provenance, tool-call/file-mutation correlation, and forensic file history.
**Status:** DISCUSSION DRAFT. Implement after SPEC-32 and after the relevant ULV blockers are resolved, unless the owner explicitly expands SPEC-32 scope.
**Related specs:** [SPEC-32 — Resource Event Sync Controller](32-resource-event-sync-controller.md), [SPEC-34 — UI Action Provenance Module](34-ui-action-provenance-module.md)
**Related wiki:** [Events And Ledger](../../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md), [Events Provenance Model](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md), [UI Action Provenance Module](../../../Wiki/010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md), [UI Action And Context Provenance Schema](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md), [File Version Provenance Schema](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/005-File_Version_Provenance_Schema/PAGE.md), [Events File Versioning](../../../Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md), [Events Change Storm Control](../../../Wiki/010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md)
**Blast radius:** High. Touches UEB event identity, SQLite ledger storage, file snapshots/diffs, tool-call correlation, trigger/scheduler attribution, and future assistant query workflows.

---

## Sequencing Decision Up Front

File versioning remains a separate follow-up spec unless the owner explicitly folds it back into SPEC-32 as a scope expansion. SPEC-32 should preserve the event/provenance contract this spec will consume, but should not implement snapshot storage, diff storage, retention, compaction, or assistant forensic query workflows.

### What SPEC-32 Must Preserve For This Spec

SPEC-32 does not need to implement file versioning, but it must not block it. Resource events should preserve:

- Stable `eventId` values.
- Workspace identity.
- Resource path and rename/delete metadata.
- Shared `ids`, `actor`, `provenance`, `context`, and `resources[]` fields from the Events Provenance Model.
- UI context for human-initiated changes.
- Thread/turn identity under `ids`, plus direct initiator IDs for UI actions, tool calls, harness IDs/runs/events, trigger runs, scheduler runs, scripts, automation runs, agents, and audits under `provenance.cause` when available.
- Enough before/after metadata to let a future versioning subscriber attach snapshots and diffs.

### Reasons To Fold Versioning Into SPEC-32

- Resource event contract and versioning contract can be designed together.
- Before/after semantics get tested immediately.
- The first migrated views can prove cache sync and ledger sync from the same event.
- Fewer later rewrites if versioning changes the event envelope.

Costs:

- SPEC-32 becomes larger and riskier.
- Wiki/resource sync work could be delayed by SQLite schema, retention, diffing, and storm-control decisions.
- More moving parts make failures harder to isolate.

### Reasons To Keep Versioning As SPEC-33

- SPEC-32 can stay focused on watcher/UEB/resource-cache correctness.
- Versioning can consume the same canonical events later as a subscriber.
- The ledger design can be more deliberate and not rushed into the UI sync build.
- File history, correlation, compaction, and assistant query workflows can be tested separately.

Costs:

- SPEC-32 must still make enough provenance decisions now.
- Some event-contract decisions may need revision if versioning later needs fields that were omitted.
- There is a temporary gap where resource sync works but file history is not yet durable.

### Sequencing Decision

Keep versioning in SPEC-33, with a small "future ledger compatibility contract" in SPEC-32. SPEC-32 should emit events that are good enough for a future SQLite versioning subscriber without implementing snapshot storage, diff storage, or forensic query behavior.

---

## Intent

One part of the Universal Ledger should answer:

- Which files, folders, or symlink resources were added, changed, renamed across same or different parent folders, or deleted?
- Was the mutation caused by a human using the UI?
- Was it caused by in-app document editing?
- Was it caused by an assistant tool call?
- Was it caused by a trigger, scheduler, script, sync/import, agent, system automation, or harness run/event?
- Was it only observed externally, meaning not linked to known UI, assistant, harness, automation, or system activity?
- Which chat turn, tool call, UI action, automation run ID, trigger run, script run, scheduler run, harness run, or harness event caused or likely caused the mutation?
- What did the file look like before and after the mutation?
- Which nearby mutations may have caused or broken related behavior?

Harness wording here refers to provider-neutral run/cause identities, not new actor/origin enum values. Use `harnessId`, `harnessRunId`, and `harnessEventId` for canonical harness attribution; OpenCode-native session, message, and event IDs belong in provider-keyed `nativeRefs` or provider-specific payloads. Harness uses `provenance.origin.type = 'harness'` only when the harness is the initiating context. Do not use `actor.type = 'harness'`; choose `assistant`, `agent`, `system`, `external`, or `unknown` according to the shared actor enum.

For event identity and operation mapping:

| Resource `eventType` | Resource operation | File-version operation |
|---|---|---|
| `resource.created` | `create` | `create` |
| `resource.changed` | `modify` | `modify` |
| `resource.deleted` | `delete` | `delete` |
| `resource.metadata_changed` | `metadata` | `metadata` |
| `resource.renamed` | `rename` | `rename` |

Moves are represented as `resource.renamed` / `operation = 'rename'` with old/new parent context; do not add separate moved event or operation values, and do not invent `metadata_changed` as an operation value.

The eventual workflow should let an assistant trace:

```text
file version
  -> resource mutation event
  -> tool call id or UI action id
  -> chat turn / trigger run / scheduler run
  -> related file mutations
  -> previous/next file versions
  -> explanation of what changed and why
```

This spec is not just about storing diffs. It is about durable causality.

---

## Known Existing Context

These points are known from current discussion and existing architecture:

- UEB already functions as the server firehose/pub-sub model.
- Chat send, tool calls, turn end, trigger activity, and related assistant events are intended to be canonical ledger events.
- Tool-call output SQL persistence exists today; tool-output/payload exposure remains subject to ULV-D10 redaction and hashing policy, while first-slice ledger edges/indexes follow ULV-D11.
- Legacy Git-based versioning is out of scope and will be replaced by SQLite file versioning as a UEB subscriber.
- Future file versioning should use SQLite and attach to canonical UEB resource events.
- SPEC-32 is expected to produce canonical resource events that resource sync, triggers, metadata, ledger, and future subscribers can consume.
- Chokidar observes filesystem changes but usually cannot prove who caused them.
- Some mutations can be known precisely because they come from UI commands, assistant tool calls, automation runs, or server APIs.
- Unknown external mutations should remain traceable as "observed by watcher, actor external/unknown" rather than being misattributed.

---

## Non-Goals For SPEC-32

The following belong in SPEC-33 or a later versioning slice, not in SPEC-32's resource-sync build:

- SQLite file snapshot tables.
- Full file content storage.
- Diff generation and diff query UI.
- High-frequency change storm compaction.
- Change-rate thresholds and retention rules.
- Tool-call-to-file-mutation correlation heuristics.
- OS/process-level attribution beyond chokidar.
- Assistant workflows that recursively summarize threads and search related file history.
- User-facing file history explorer.

SPEC-32 should only preserve the IDs, provenance, and before/after resource-state metadata required for this spec to work later.

---

## Provenance Model

File versioning should not invent a second provenance shape. It should consume the shared Events Provenance Model and the Resource Mutation/File Version provenance schemas from the wiki.

Required vocabulary:

| Field | Meaning |
|---|---|
| `eventId` | Canonical event/graph-node ID for the current record. |
| `ids` | Workspace, machine, thread, turn, `rootEventId`, `parentEventId`, correlation, and causation IDs. |
| `actor.type` | Who or what is believed to be responsible. |
| `provenance.source` | Producer of the canonical event record. |
| `provenance.origin` | Initiating actor or context that caused work, when known. |
| `provenance.observedBy` | Subsystem that detected the fact. |
| `provenance.confidence` | `direct`, `correlated`, `inferred`, or `unknown`. |
| `provenance.cause` | Upstream durable IDs such as UI action, tool call, harness ID/run/event, trigger run, scheduler run, script run, automation run, agent run, or audit query. |
| `context` | UI, client, route, scope, and active-resource context. |
| `resources[]` | Normalized resource references used by graph queries. |

Resource mutations use the `resourceMutation` domain payload. File versions use the `fileVersion` domain payload and link back through `fileVersion.createdFromResourceEventId`.

---

## Attribution Categories

### Human UI Action

Known when the renderer sends a command with UI context.

Examples:

- Button click such as `send_to_chat`.
- Rename/delete/move from a view.
- In-app document edit/save.
- Drag/drop into a view, if routed through the app.

Expected attribution for the downstream resource mutation event:

```ts
actor: { type: 'human' }
provenance: {
  source: { type: 'server-api' },
  origin: { type: 'ui', id: uiActionId },
  observedBy: { type: 'server-api' },
  confidence: 'direct',
  cause: { uiActionId }
}
ids: { workspaceId, serverMutationId }
context: { panelId, activeDocumentPath, activeResourcePath }
```

### Assistant Tool Call

Known when a mutation is directly produced by, or correlated to, an assistant tool call.

Direct app/API tool writes use direct confidence:

```ts
actor: { type: 'assistant' }
provenance: {
  source: { type: 'server-api' },
  origin: { type: 'tool', id: toolCallId },
  observedBy: { type: 'server-api' },
  confidence: 'direct',
  cause: { toolCallId }
}
ids: { workspaceId, threadId, turnId, correlationId, serverMutationId }
```

Watcher-correlated tool writes preserve uncertainty:

```ts
actor: { type: 'assistant' }
provenance: {
  source: { type: 'resource-enricher' },
  origin: { type: 'tool', id: toolCallId },
  observedBy: { type: 'watcher' },
  confidence: 'correlated',
  cause: { toolCallId }
}
ids: { workspaceId, threadId, turnId, correlationId }
```

### Automation Jobs

Known when a trigger, scheduler, script, sync/import, agent, or system job has an automation run ID and either writes directly through the app or can be correlated to watcher events.

These examples apply to downstream resource mutation events caused by an automation run. The automation run event itself follows the Automation Run Provenance Schema and must not place its own `automation.runId` in `provenance.cause`. File-version events are produced by the versioning subscriber, use the versioning subscriber as `provenance.source`, and link to the original mutation through `fileVersion.createdFromResourceEventId`.

Direct app writes must use `confidence: 'direct'` when the app/API performs the write and the automation run ID is known; use `correlated` only for watcher-correlated writes:

```ts
actor: { type: automationKind }
provenance: {
  source: { type: 'server-api' },
  origin: { type: automationKind, id: automationRunId },
  observedBy: { type: 'server-api' },
  confidence: 'direct',
  cause: { automationRunId, triggerRunId?, schedulerRunId?, scriptRunId?, agentRunId? }
}
ids: { workspaceId, correlationId, serverMutationId }
context: { scope: 'headless' }
automationRef: { automationRunId, automationKind }
```

Watcher-correlated automation preserves uncertainty:

```ts
actor: { type: automationKind }
provenance: {
  source: { type: 'resource-enricher' },
  origin: { type: automationKind, id: automationRunId },
  observedBy: { type: 'watcher' },
  confidence: 'correlated',
  cause: { automationRunId, triggerRunId?, schedulerRunId?, scriptRunId?, agentRunId? }
}
ids: { workspaceId, correlationId }
context: { scope: 'headless' }
automationRef: { automationRunId, automationKind }
```

`automationKind` covers `trigger`, `scheduler`, `script`, `sync`, `import`, `agent`, and `system`. Only include subtype IDs that apply to the actual automation kind. Sync, import, and system jobs use the common `automation.runId` and `automation.kind`, mirrored downstream as `provenance.cause.automationRunId` and `automationRef.*`; they do not need subtype IDs unless a future schema explicitly introduces them.
`automationRef.automationRunId` mirrors the automation-domain `automation.runId`, and `automationRef.automationKind` mirrors `automation.kind`; it is a compact reference, not a second automation schema.

### External / Unknown

Used when the mutation is only observed by the watcher and cannot be linked to a known UI action, assistant tool call, automation run, or system operation.

Possible causes:

- Finder drag/drop.
- Copy/paste in the filesystem.
- Symlink creation outside the app.
- Another editor saving a file.
- An ad hoc terminal script.
- A process not known to Fusion Studio.

External attribution when outside-app activity is inferred:

```ts
actor: { type: 'external' }
provenance: {
  source: { type: 'resource-enricher' },
  origin: { type: 'external' },
  observedBy: { type: 'watcher' },
  confidence: 'inferred'
}
```

Unknown attribution when classification itself is uncertain:

```ts
actor: { type: 'unknown' }
provenance: {
  source: { type: 'resource-enricher' },
  origin: { type: 'unknown' },
  observedBy: { type: 'watcher' },
  confidence: 'unknown'
}
```

Use `external` when there is evidence the change came from outside Fusion Studio. Use `unknown` when even that classification is uncertain. Do not relabel unknown external changes as system or user actions without evidence.

---

## Version Storage Concept

Future SQLite file versioning should persist the wiki `fileVersion` payload rather than inventing a parallel shape. Physical table names can differ, but the stored fields must map directly to the canonical event payload.

Canonical non-batch payload:

```ts
type FileVersionEvent = {
  schemaVersion: number;
  eventId: string;
  eventFamily: 'file.version';
  eventType:
    | 'file.version.created'
    | 'file.version.modified'
    | 'file.version.deleted'
    | 'file.version.renamed'
    | 'file.version.metadata_changed'
    | 'file.version.restored';
  eventPhase?: string;
  occurredAt: number;
  lifecycle?: unknown;
  ids: Record<string, unknown>;
  actor: Record<string, unknown>;
  provenance: Record<string, unknown>;
  context?: Record<string, unknown>;

  fileVersion: {
    fileVersionId: string;
    createdFromResourceEventId: string;
    createdFromResourceMutationId?: string;
    resourceId?: string;
    resourceType: 'file' | 'folder' | 'symlink';
    path: string;
    oldPath?: string;
    operation: 'create' | 'modify' | 'delete' | 'rename' | 'metadata' | 'restore';
    snapshotBeforeId?: string;
    snapshotAfterId?: string;
    diffId?: string;
    contentHashBefore?: string;
    contentHashAfter?: string;
    sizeBefore?: number;
    sizeAfter?: number;
    restoreOfVersionId?: string;
    retentionClass?: 'normal' | 'generated' | 'large' | 'binary' | 'secret';
    eligibility?: 'snapshot' | 'diff' | 'metadata_only' | 'excluded';
  };

  resources: Array<Record<string, unknown>>;
  redaction?: {
    policy: string;
    redactedKeys: string[];
    hashes: string[];
  };
  ledger: {
    ledgerEventId?: string;
    edgeIds: string[];
  };
};
```

`fileVersion.resourceType` is limited to physical file-like resources. Canonical resource events for `view`, `style`, `config`, and `registry` resources create file-version records only when explicitly mapped to a backing file/folder/symlink path; the record uses that physical `fileVersion.resourceType`. Pure virtual resources without a physical mapping remain canonical resource events and are not stored as file-version rows unless a later versioning spec expands the allowed file-version resource types.

Canonical `fileVersion.path` and `fileVersion.oldPath` are workspace-relative paths. Absolute paths, when needed for local diagnostics, must use explicitly named fields and must not replace canonical path identity.

Canonical resource mutation events must have non-null `ids.workspaceId` so workspace-relative paths can be keyed safely. The versioning subscriber rejects/audits malformed or legacy resource events without a workspace ID instead of creating a file-version row; record the rejection reason on the resource/ledger event or subscriber audit trail, not in `fileVersion.eligibility`.

`retentionClass` and `eligibility` are provisional policy outputs. Metadata/hash-only eligibility becomes final only after ULV-D03, ULV-D05, and ULV-D10 close; snapshot/diff eligibility remains provisional until ULV-D02 also closes. For storm-batch eligibility or compaction, ULV-D04 must also be resolved.

File-version event type mapping:

| `fileVersion.operation` | `eventType` |
|---|---|
| `create` | `file.version.created` |
| `modify` | `file.version.modified` |
| `delete` | `file.version.deleted` |
| `rename` | `file.version.renamed` |
| `metadata` | `file.version.metadata_changed` |
| `restore` | `file.version.restored` |

`fileVersion.operation = 'metadata'` does not imply `fileVersion.eligibility = 'metadata_only'`. Backing-file metadata events, including Wiki `PAGE.md` frontmatter-only edits, must still evaluate content hash, snapshot, diff, and redaction eligibility under the normal policies.

Storm batches have no `fileVersion.operation`; they use `eventType: 'file.version.change_batch'` with the separate `FileVersionChangeBatchEvent.changeStorm` payload.

`fileVersion.createdFromResourceEventId` stores the canonical resource mutation event's top-level `eventId`. If the resource mutation domain ID is also needed, store it separately as `fileVersion.createdFromResourceMutationId`.

Possible persistence tables:

```text
file_versions
  file_version_id
  event_id
  workspace_id
  created_from_resource_event_id
  resource_id
  resource_type
  path
  old_path
  operation
  snapshot_before_id
  snapshot_after_id
  diff_id
  content_hash_before
  content_hash_after
  size_before
  size_after
  restore_of_version_id
  retention_class
  eligibility
  provenance_json
  context_json
  redaction_json
  ledger_event_id
  created_at

file_content_blobs
  id
  hash
  size
  encoding
  storage_kind
  content
  created_at

file_mutation_correlations
  id
  created_from_resource_event_id
  created_from_resource_mutation_id
  related_event_id
  relation_type
  confidence
  reason
  evidence_json
  method
  event_edge_id
  created_at
```

Correlation reason/evidence lives in `file_mutation_correlations`, not in a new shared provenance envelope field. Each correlation row must link the resource/file-version event to the related event through `created_from_resource_event_id`, `related_event_id`, and/or `event_edge_id`, with `reason`, `evidence_json`, `method`, and `confidence` preserving why the link was made.

This is still conceptual. The final schema should be designed after SPEC-32 proves canonical resource events, but it must retain direct mapping to `fileVersion`, `ids`, `actor`, `provenance`, `context`, `resources[]`, `redaction`, `ledger`, and linked correlation rows.

Directories, deletes, renames, binaries, generated files, large files, restore events, and possible secrets need explicit eligibility and retention behavior before broad snapshotting is enabled.

---

## Ledger Storage And Traversal

File versions are useful only if they can be traversed from the rest of the Universal Ledger.

SPEC-33 should define or reuse ledger storage that provides:

- Canonical events stored unwrapped with their original `eventFamily`, `eventType`, payload, and `ledger.ledgerEventId`.
- Graph edges connecting UI actions, chat turns, tool calls, harness IDs/runs/events, automation runs, resource mutations, file versions, restores, and audit queries. Harness cause links are represented through `caused_by` edges from `provenance.cause.harnessId`, `provenance.cause.harnessRunId`, and `provenance.cause.harnessEventId` when known.
- Required indexes for workspace, path/resource ID, event family/type, thread, turn, tool call, UI action, harness ID, harness run, harness event, automation run, trigger run, script run, scheduler run, agent run, correlation ID, and timestamp range.
- Payload hashing and redaction rules before tool output, file metadata, snapshots, or diffs become broadly durable.
- A clear link from each file version to its source mutation through `fileVersion.createdFromResourceEventId`.
- A `versioned_as` edge from the resource mutation event to the file version event.
- Restore edges such as `restored_from` when a version restore occurs.

---

## Correlation Strategy

The ledger should prefer direct causal IDs over inference.

Priority order:

1. Direct UI action ID.
2. Direct tool call ID.
3. Direct automation or harness identity in `provenance.cause.automationRunId`, `provenance.cause.harnessId`, `provenance.cause.harnessRunId`, or `provenance.cause.harnessEventId`, optionally narrowed by subtype IDs such as `triggerRunId`, `schedulerRunId`, `scriptRunId`, or `agentRunId`.
4. Server API mutation ID in `ids.serverMutationId`.
5. Watcher event correlated by path, timestamp window, hash, and known active operation.
6. External/unknown.

The system should preserve uncertainty. A weak correlation should remain `confidence: 'correlated'` or `confidence: 'inferred'` as appropriate, not be promoted to `direct`.

`ids.correlationId` can group related events, but it is not proof of causation by itself. Direct causation belongs in `provenance.cause`.

---

## Change Storm Control

High-iteration file changes can spam the ledger.

Before any storm-batch persistence or compaction slice, ULV-D03/ULV-D04/ULV-D05/ULV-D10 must define:

- File type, size, and blob/snapshot eligibility limits.
- Changes-per-minute thresholds.
- Max versions per file per window.
- Per-path and per-workspace compaction windows.
- Whether intermediate versions are dropped, summarized, or stored as cheap metadata only.
- How to preserve the fact that a storm happened.
- How to avoid flooding assistant context when querying history.

Storm batches are file-version/ledger compaction events for versioning and audit queries. When a SPEC-33 slice adds metadata/hash-only storm-batch persistence after ULV-D03, ULV-D04, ULV-D05, and ULV-D10 are resolved, it treats them as `eventFamily: 'file.version'`, `eventType: 'file.version.change_batch'`, with a `changeStorm` domain payload unless a later explicit owner decision promotes storm control to its own event family. Persist representative snapshots or diffs from storm batches only after ULV-D02 is also resolved.

Required storm traversal:

- `firstEventId` and `lastEventId` should point to the top-level `eventId` of the first and last compacted canonical resource mutation events for the first storm slice. If later slices need file-version boundary IDs, add explicitly named fields instead of overloading these.
- The ledger should add `compacts` edges from the storm event to the compacted event range or representative events, and `represents` edges from the storm event to affected resources or representative before/after states.
- Indexes should support workspace, affected path, time range, actor, automation/tool/UI/harness cause IDs, provider-keyed `nativeRefs` or provider-specific payloads when needed, and storm reason.

Conceptual compacted event:

```ts
type FileVersionChangeBatchEvent = {
  schemaVersion: number;
  eventId: string;
  eventFamily: 'file.version';
  eventType: 'file.version.change_batch';
  eventPhase?: string;
  occurredAt: number;
  lifecycle?: unknown;
  ids: Record<string, unknown>;
  actor: Record<string, unknown>;
  provenance: Record<string, unknown>;
  context?: Record<string, unknown>;

  changeStorm: {
    // Workspace-relative canonical resource paths.
    affectedPaths: string[];
    // Number of compacted canonical resource mutation events.
    count: number;
    startedAt: number;
    endedAt: number;
    reason: 'rate_limit' | 'storm_control';
    firstEventId: string;
    lastEventId: string;
    representativeBeforeHash?: string;
    representativeAfterHash?: string;
    representativeBeforeMetadata?: Record<string, unknown>;
    representativeAfterMetadata?: Record<string, unknown>;
    representativeBeforeSnapshotId?: string;
    representativeAfterSnapshotId?: string;
  };

  resources: Array<Record<string, unknown>>;
  redaction: Record<string, unknown>;
  ledger: { ledgerEventId?: string; edgeIds: string[] };
};

type FileVersionLedgerEvent = FileVersionEvent | FileVersionChangeBatchEvent;
```

The TypeScript blocks above are conceptual payload sketches. Fields shown as `Record<string, unknown>`, `unknown`, or optional envelope slots are placeholders for the shared Events Provenance Model envelope and lifecycle/status contracts; final persistence must use the common envelope types rather than inventing file-version-only shapes.

Storm records should preserve the fact that a storm happened without forcing every intermediate edit into long-term snapshot storage.

---

## Assistant Query Workflow

The eventual assistant should be able to:

- Query a file's version history.
- Find the exact edit snapshot in question.
- Inspect metadata and provenance.
- Follow a linked `toolCallId` to a chat turn.
- Pull the surrounding chat pair or full thread.
- Compare nearby mutations within minutes of each other.
- Identify whether one thread/change likely broke another.
- Trace a trigger run to the script and output path.
- Explain whether a change came from UI, assistant, harness, automation including system jobs (`trigger`, `scheduler`, `script`, `sync`, `import`, `agent`, or `system`), or unknown external activity, using the shared provenance origin/cause categories.

This should be designed as a query/indexing layer over durable ledger/versioning data, not as logic embedded in resource sync.

---

## Dependency On SPEC-32

SPEC-33 depends on SPEC-32 producing events with:

- Stable `eventId`.
- Workspace/resource identity under `ids`, `resourceMutation`, and `resources[]`.
- Clear `provenance.source`, `provenance.observedBy`, and `provenance.origin`.
- UI and active-resource context under `context`.
- Direct upstream initiator IDs under `provenance.cause`.
- Before/after resource-state metadata for create, modify, delete, rename, and metadata operations, with explicit omission reasons when state is unavailable.
- Compatibility with UEB subscribers.

SPEC-32 should not need to know about file snapshot storage, diff storage, or assistant forensic search.

---

## Decision Queue

| ID | Decision | Notes |
|---|---|---|
| ULV-D01 | Fold versioning into SPEC-32 or implement after SPEC-32? | DECIDED: keep separate in SPEC-33 unless the owner explicitly expands SPEC-32 scope; make SPEC-32 ledger-compatible. |
| ULV-D02 | Store full snapshots, diffs, or both? | BLOCKER for any snapshot/diff/blob persistence. Full snapshots are simpler to query; diffs save space but complicate reconstruction. Blob/content persistence also requires ULV-D10 before any durable content capture. |
| ULV-D03 | What content sizes and file types are versioned? | BLOCKER for any snapshot/diff/blob persistence and storm-batch persistence/compaction. Binary files, generated files, and large files may need exclusion or metadata-only records. |
| ULV-D04 | What storm-control thresholds are acceptable? | BLOCKER for storm-batch persistence/compaction. Must be decided before any slice persists storm batches or applies compaction. |
| ULV-D05 | How long are file versions retained? | BLOCKER for any snapshot/diff/blob persistence and storm-batch persistence/compaction. May vary for workspace files, generated artifacts, and temp/build output. |
| ULV-D06 | How are weak watcher correlations represented? | DECIDED: preserve provenance confidence on the event and preserve correlation reason/evidence in linked `file_mutation_correlations` rows; never promote weak inference to `direct`. |
| ULV-D06a | What event family represents storm batches in the first slice that persists storm batches? | DECIDED: use `eventFamily: 'file.version'`, `eventType: 'file.version.change_batch'`, and `changeStorm` payload unless a later explicit owner decision promotes storm control to its own event family. |
| ULV-D07 | Should process attribution beyond chokidar be attempted? | DECIDED for first versioning slice: no process attribution beyond chokidar. Use direct IDs, correlation evidence, or explicit `external`/`unknown` attribution; process-level attribution is a later platform-specific enhancement. |
| ULV-D08 | What UI is needed to inspect file history? | DECIDED for initial slice: assistant-query-only is sufficient; full user-facing history viewer is later work. |
| ULV-D09 | What restore behavior and `restored_from` edge semantics are required? | BLOCKER for restore implementation. Restore should not be an ad hoc file write with lost provenance. |
| ULV-D10 | What redaction and secret-handling policy applies to snapshots, diffs, payload hashes, and tool output? | BLOCKER for any snapshot/diff/blob persistence, storm-batch persistence/compaction, or broad durable content capture. |
| ULV-D11 | Which ledger edges and indexes are required in the first versioning slice? | DECIDED for initial slice: use the listed ledger storage/traversal requirements and shared edge vocabulary; physical schema details remain implementation choices. |

---

## Completion Criteria

- Filesystem resource mutations for files, folders, and symlinks can be persisted to SQLite as durable versions.
- Each version links to a canonical resource event.
- Known UI, assistant, harness, automation, and system causes are preserved.
- Unknown external changes are represented honestly.
- Change storms do not flood the ledger or assistant context.
- The assistant can trace from file version to causal event and related chat/tool/harness/trigger context.
