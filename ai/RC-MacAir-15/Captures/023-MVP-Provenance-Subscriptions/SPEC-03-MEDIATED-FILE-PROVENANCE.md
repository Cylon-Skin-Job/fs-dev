# SPEC-03 — Mediated Text-File Save Provenance and Before Snapshots

**Status:** `CANDIDATE — OWNER APPROVAL REQUIRED`  
**Prerequisite:** Owner-accepted SPEC-02  
**Mission:** Make the existing `file_save` path the first fully mediated mutation: validate one text-file save, reserve host identities, durably prepare a before snapshot, perform one atomic replacement, reconcile crash ambiguity, admit one resource fact, and make its timeline queryable.

## Applicable Code Standards

- Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- Routed pages:
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`
- Approved supersessions: none. The standards explicitly cover server-derived path authority, before-snapshot gating, durable operation states, idempotent replay, and truthful post-write failure handling.

## Exact MVP Boundary

This SPEC migrates only `file_save` for:

- a new or existing file whose bytes satisfy the deterministic MVP UTF-8 text rule below;
- at most 10 MiB before and after the save;
- inside the active workspace and resolved panel root;
- whose resolved parent remains inside that root and whose final target is not a directory or symlink.

An absent target is a create. An existing target is a modify. Invalid-Unicode JSON content, NUL-bearing or non-UTF-8 text, oversized content or preimage, binary WebSocket frames, directories, any final symlink, and any parent resolving outside the authoritative root are rejected before mutation. This intentionally narrows the legacy linked-file save behavior; linked-resource authorization and identity require a later SPEC.

Create-folder, create-document, move, rename, delete, Office sidecar mutations, arbitrary server writers, and external filesystem changes remain on compatibility paths and are not claimed mediated.

## Command and Origin Boundary

The mutation controller accepts a server connection plus an untrusted intent:

```ts
type SaveFileIntent = {
  requestId: string;
  expectedWorkspaceId: string;
  expectedWorkspaceEpoch: string;
  panel: string;
  path: string;
  content: string;
  saveReason?: 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';
  milestone?: string;
  clientActionId?: string;
  reportedUiContext?: {
    viewId?: string;
    viewInstanceId?: string;
  };
};
```

The existing field names remain, but Slice 03c atomically versions the first-party request and adds correlation:

```ts
type FileSaveRequestV1 = {
  type: 'file_save';
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: string;
  path: string;
  content: string;
  reason?: 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';
  milestone?: string;
  clientActionId?: string;
  reportedUiContext?: { viewId?: string; viewInstanceId?: string };
};
```

The shared renderer types and every first-party sender move to this shape in the same slice. `workspaceId` and `workspaceEpoch` are the client's current pair used only as a stale-intent precondition; they never select workspace authority or a root. The server maps wire field `reason` to internal `saveReason`; no renderer is required to rename that field, and wire-level `saveReason` is rejected as an unknown field. `requestId`, workspace ID, panel, client-action, and reported-view identifiers are nonempty strings capped at 128 UTF-8 bytes; `workspaceEpoch` is a lowercase UUID; path follows the 4096-byte normalized-path bound; milestone follows the 256-byte bound. Unknown fields, null optionals, an absent/invalid `version`, request ID, or expected workspace pair, and a milestone supplied for a non-milestone reason are rejected as `invalid_request` without mutation.

Before generic WebSocket logging serializes the message, the redaction map must replace `file_save.content` with the fixed redaction marker while leaving the original in-memory message available to the owning handler. Paths and bounded save metadata may follow existing logging policy; source bytes never enter `server-live.log` or diagnostic payloads.

The wire accepts this request only in a WebSocket text frame containing valid JSON. The router closes an unsupported binary frame with WebSocket code 1003 and malformed/invalid-UTF-8 text payload with code 1007; neither can produce a `file_save_response` because no trusted type/request correlation was decoded. After JSON parsing, `content` must be a JavaScript string with no unpaired UTF-16 surrogate and no U+0000 code point. Encode that exact scalar-value string once with UTF-8; the resulting `Buffer` is the intended file content, its hash/length are authoritative, and it must be at most 10 MiB. These intended-content failures occur before ID reservation. For an existing file, read the preimage as bytes under the save mutex after reservation, decode with a fatal UTF-8 decoder, reject U+0000, re-encode, and require byte-for-byte equality with the bytes read. Preimage validation failure records `failed_before_replace` and never mutates. Empty text and a UTF-8 BOM are allowed. The server does not claim to recover hypothetical invalid source bytes after JSON decoding; the supported input is precisely the validated Unicode JSON string and its exact UTF-8 encoding.

## Workspace Bind Epoch and Save Response

SPEC-03 establishes the workspace epoch required by its asynchronous save and query replies. Every successful initial workspace bind and every workspace switch allocates a new server-generated lowercase UUID `workspaceEpoch`. A session transition enters `binding`, retires the old pair, allocates the new pair, and buffers completed workspace-bound save/query replies up to both 256 messages and 8 MiB of serialized payload. A new workspace-bound request arriving while the session is `binding` receives `workspace_unavailable` and cannot capture either the retired or not-yet-active pair. The server queues the recipient-specific `workspace:init` or `workspace:switched` frame carrying `{ workspaceId, workspaceEpoch }` before marking the session active, then flushes buffered replies in completion order on the same socket. Either buffer limit, or a bind-frame/reply send failure, closes the socket for authoritative reconnect rather than silently losing a reply. The client applies the pair atomically. A save or query accepted while active captures that authoritative pair. Every reply that can outlive navigation carries the captured pair, and the client accepts it only when both still equal its current pair. A buffered old-epoch reply is therefore delivered only behind the new bind frame and discarded. Thus a delayed reply from the first A visit is rejected after A→B→A even though its `workspaceId` matches.

SPEC-03 does not yet add unsolicited resource projections. SPEC-04 extends this same bounded bind buffer to resource/recovery projections, but it must preserve the epoch allocation, bind-frame ordering, response ordering, overflow-close behavior, and client gating established here.

The exact save response is the following closed union. `error` is a fixed, non-secret, user-displayable string capped at 256 UTF-8 bytes; it never contains raw OS, SQL, payload, or snapshot data.

```ts
type FileSaveIdsV1 = {
  operationId: string;
  commandId: string;
  commandAcceptedEventId: string;
  resourceEventId: string;
  resourceId: string;
  fileVersionId: string;
  canonicalPath: string;
};

type FileSaveResponseBaseV1 = {
  type: 'file_save_response';
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: string;
  path: string;
};

type FileSaveResponseV1 =
  | {
      success: false;
      type: 'file_save_response';
      version: 1;
      outcome: 'rejected';
      errorCode: 'invalid_request';
      requestId?: string; // present only when requestId itself passed validation
      error: string;
      retrySafe: true;
    }
  | {
      success: false;
      type: 'file_save_response';
      version: 1;
      outcome: 'rejected';
      errorCode: 'invalid_request' | 'stale_workspace';
      requestId: string;
      workspaceId: string;
      workspaceEpoch: string;
      error: string;
      retrySafe: true;
    }
  | {
      success: false;
      type: 'file_save_response';
      version: 1;
      outcome: 'rejected';
      errorCode: 'workspace_unavailable';
      requestId: string;
      error: string;
      retrySafe: true;
    }
  | (FileSaveResponseBaseV1 & {
      success: false;
      outcome: 'rejected';
      errorCode:
        | 'path_not_allowed'
        | 'unsupported_text'
        | 'too_large'
        | 'save_busy'
        | 'storage_unavailable';
      error: string;
      retrySafe: true;
    })
  | (FileSaveResponseBaseV1 & FileSaveIdsV1 & {
      success: false;
      outcome: 'failed_before_replace';
      errorCode:
        | 'snapshot_failed'
        | 'unsupported_preimage'
        | 'preimage_too_large'
        | 'preimage_conflict'
        | 'write_prepare_failed'
        | 'replace_failed'
        | 'permission_denied';
      error: string;
      retrySafe: true;
      commandFactState: 'admitted' | 'pending';
      resourceFactState: 'not_emitted';
      ledgerState: 'not_applicable';
    })
  | (FileSaveResponseBaseV1 & FileSaveIdsV1 & {
      success: false;
      outcome: 'outcome_unknown';
      errorCode: 'mutation_outcome_unknown';
      error: string;
      retrySafe: false;
      commandFactState: 'admitted' | 'pending';
      resourceFactState: 'not_emitted';
      ledgerState: 'not_applicable';
    })
  | (FileSaveResponseBaseV1 & FileSaveIdsV1 & {
      success: true;
      outcome: 'succeeded';
      commandFactState: 'admitted' | 'pending';
      resourceFactState: 'admitted' | 'pending';
      ledgerState: 'stored' | 'pending' | 'conflict';
      provenanceState: 'complete' | 'pending_reconciliation';
      checkpointState: 'not_requested' | 'committed' | 'no_change' | 'failed';
      warningCodes?: Array<'checkpoint_failed' | 'provenance_pending'>;
    });
```

Validation order is fixed: validate the decoded type/version/request ID/expected-pair envelope; capture the active server pair; require exact equality with the expected pair; validate ingress fields and intended content; acquire the mutex; then reserve IDs and inspect the existing preimage. An envelope-level `invalid_request` has no workspace pair and includes `requestId` only when that field independently passed validation. A post-capture semantic `invalid_request` carries the valid request ID and complete captured pair but never echoes the invalid panel/path. A precondition mismatch returns `stale_workspace` with the current captured pair and no IDs or mutation; an A1 request remains stale after A→B→A because the epoch differs. `path_not_allowed` is used only after panel/path passed their type and byte bounds but failed recognized-root/containment policy. `storage_unavailable` covers failure of the pre-acceptance reservation transaction and has no reserved IDs. `replace_failed` means the atomic rename reported failure before replacement; any error after rename returned success is instead `outcome_unknown` until durability can be claimed. `rejected` is the only response without reserved IDs because it occurs before durable acceptance. A workspace-unavailable response has the validated request ID but cannot invent a workspace pair. Other rejected requests have a captured pair and bounded ingress echoes. Every non-rejected variant contains the complete reserved identity set. `complete` requires admitted command and resource facts plus a stored ledger projection; every other successful combination is `pending_reconciliation`. The `conflict` ledger state is terminal for that event ID but remains an explicit provenance warning. `warningCodes` is omitted exactly when neither warning applies; otherwise it is a sorted, duplicate-free array containing `checkpoint_failed` iff `checkpointState = failed` and `provenance_pending` iff `provenanceState = pending_reconciliation`. `outcome_unknown` is never safe for automatic retry. The first-party store correlates by `requestId`, then gates replies that have a workspace pair by workspace ID/epoch; panel/path remain bounded ingress echoes and cannot substitute for either check.

The server resolves the active workspace root from the authoritative workspace-registry row and derives the recognized panel root beneath it. Session fields and `set_panel.rootFolder` are untrusted navigation hints and can never become a mutation root. The server then converts the validated ingress alias `{ panel, path }` into one canonical workspace-relative physical path, verifies containment, and assigns all authoritative IDs. The canonical path—not panel or ingress alias—is the resource identity/query path. `clientActionId`, ingress alias, and reported UI context are bounded correlation echoes, not identities or proof.

Because the current loopback WebSocket has no authenticated principal or protected renderer bridge, MVP truthfully records:

```ts
origin: {
  kind: 'local_client';
  connectionId: string;
  assurance: 'transport_only';
  reportedUiContext?: { viewId?: string; viewInstanceId?: string };
}
```

It must not claim `user_ui`, `assistant_tool`, or `script` identity. Strong principals may be added later without replacing the event envelope.

For every syntactically and semantically accepted request, before snapshot or filesystem work, the server reserves:

- `operationId`;
- `commandId`;
- `commandAcceptedEventId`;
- `resourceEventId`;
- stable `resourceId`;
- `fileVersionId`.

## Stable Resource Identity

Add a persistent `resource_registry` (or coherently named equivalent) keyed by workspace and `resource_id`, with a unique non-tombstoned mapping for the canonical workspace-relative physical path. It stores kind, created time, latest canonical path, last successful physical file fingerprint (`dev`, `ino`, size, and platform birth/creation time when available), `lifecycle_state = reserved | live | outcome_unknown | tombstoned`, and nullable tombstone time. A separate validated ingress alias may be recorded on the operation, but never creates a second resource row for the same physical path.

Rules:

- an existing live path reuses its resource ID across restarts and concurrent saves only when the current regular-file fingerprint matches the row's last successful fingerprint;
- if a compatibility rename/delete/recreate leaves a row at a now-absent path, or a different file fingerprint occupies that path, tombstone the stale row as `compatibility_relocated_or_replaced` before reserving a new ID; never attach the stale ID to the new file;
- an absent path receives one `reserved` ID under a transaction/unique constraint, with loser retry/read behavior, and becomes `live` only with the succeeded operation transaction;
- if an absent-target create fails before replacement, its reserved mapping is tombstoned in the same terminal-state transaction; an existing resource mapping remains live after a failed modify;
- an ambiguous absent-target create changes its reserved mapping to `outcome_unknown`, continues to occupy that path, and rejects later mutation until a separate repair flow resolves it; it is never silently reused or tombstoned;
- this SPEC does not define move/rename continuity or resurrection semantics.

## Required Command-Accepted Fact

After validation and durable ID reservation, attempt one independent `file.command_accepted` v1 admission through the trusted SPEC-02 publisher, even if snapshot preparation or the later write fails. It is not a claim that mutation succeeded.

```ts
type FileCommandAcceptedV1 = {
  eventId: string;
  eventType: 'file.command_accepted';
  schemaVersion: 1;
  occurredAt: number;
  workspaceId: string;
  operationId: string;
  commandId: string;
  origin: {
    kind: 'local_client';
    connectionId: string;
    assurance: 'transport_only';
    reportedUiContext?: { viewId?: string; viewInstanceId?: string };
  };
  resource: {
    resourceId: string;
    kind: 'file';
    path: string; // canonical workspace-relative physical path
    access: { panel: string; path: string }; // validated ingress alias
  };
  intent: {
    kind: 'save';
    saveReason?: 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';
    milestone?: string;
    clientActionId?: string;
  };
};
```

Admission failure does not fail or delay an otherwise valid save. It leaves `command_fact_admission_state = pending`, emits a fixed diagnostic, and is retried from the durable operation row on startup. No subscriber is required to persist this fact in this SPEC; later chat/action correlation can consume it without changing the save event.

Both MVP event schemas reject unknown fields. Newly generated event/operation/command/resource/version IDs are canonical lowercase UUID strings; existing registered `workspaceId`, connection/view/client-action identifiers, and panel keys are nonempty UTF-8 strings capped at 128 bytes; timestamps are integer epoch milliseconds; normalized paths are nonempty UTF-8 strings capped at 4096 bytes; milestone is capped at 256 UTF-8 bytes; enums are closed; omitted optional fields are not serialized as null. These same bounds are the locked definitions seeded by SPEC-01.

## Durable Snapshot and Operation State Machine

Evolve the existing ledger schema with `file_operations` and `file_versions` (or coherent equivalents).

`file_operations` must hold:

- all reserved IDs, canonical workspace-relative path, and validated ingress panel/path alias;
- `mutation_kind = create | modify`;
- `state = accepted | prepared | succeeded | failed | outcome_unknown`;
- `command_fact_admission_state = pending | admitted`;
- `fact_admission_state = pending | admitted` independently from filesystem outcome;
- `ledger_projection_state = pending | stored | conflict` independently from admission;
- honest origin and bounded client correlation;
- preimage status/hash/length and intended after hash/length;
- fixed failure or reconciliation code;
- accepted, prepared, attempted, completed, and reconciled timestamps as applicable.

`file_versions` stores exact preimage bytes as a BLOB for an existing supported file, with SHA-256, encoding, byte length, captured time, operation/resource identity, and reserved resource event ID. A create records an explicit absent preimage without invented bytes.

Preimage bytes are sensitive and remain behind the named repository boundary. The compact provenance query returns identity, timestamps, hashes, lengths, and status—not raw snapshot bytes. MVP enforces the 10 MiB limit at capture, performs no automatic snapshot deletion, and retains rows until a separately approved retention/restore SPEC supplies quota, deletion, and user-control policy. No renderer, subscriber capability, or generic database handle receives snapshot-byte access in this bundle.

Protocol:

1. Validate the decoded versioned envelope, correlation fields, normalized containment, scalar-value/NUL rule, exact intended UTF-8 encoding, and encoded size; compute the intended-after hash from the one validated `Buffer`.
2. Acquire the controller's per-workspace/canonical-path save mutex before reading the preimage. Aliases from File Viewer, Office, Email, or another recognized panel resolve to the same mutex and resource row. One active save plus at most 32 FIFO waiters is allowed per key; overflow fails with `save_busy` before ID reservation or mutation. Release in the outermost `finally`.
3. In one DB transaction, reserve the resource and all operation/fact/version IDs, record command acceptance time, and persist the operation as `accepted` with both fact-admission states pending. The resource fact's `occurredAt` is not assigned yet.
4. Attempt the required `file.command_accepted` admission and record success; failure remains pending and does not stop the save.
5. Read the preimage once while holding the mutex. For a modify, enforce the 10-MiB limit and fatal-decode/NUL/byte-round-trip text rule before storing the snapshot; failure records `preimage_too_large`, `unsupported_preimage`, or `snapshot_failed` as applicable. In one DB transaction, persist the operation as `prepared`, its captured/absent version, and intended after metadata. If this fails, do not write.
6. Create a temporary file in the already resolved in-root physical parent, write all intended bytes, flush the file to stable storage, and close it. Recheck physical-parent containment, then require the final target still be absent for a create or be a non-symlink regular file whose bytes hash to the captured preimage for a modify. On mismatch, mark `failed` with `preimage_conflict` and do not replace. Otherwise atomically rename through that resolved parent over the target and flush the containing directory before claiming durable success.
7. Mark the operation `succeeded`, assign/store the resource fact's `occurredAt` from the completed durable replacement, update the resource fingerprint, leave resource-fact admission and ledger projection pending, and durably store its success metadata in one DB transaction.
8. Admit the reserved `resource.mutated` fact and inspect SPEC-02's delivery report. Mark fact admission admitted. The ledger handler's transaction marks `ledger_projection_state = stored`; rejection, absence, or 2,000-ms timeout leaves it pending and makes the response provenance state pending. A conflicting ledger event marks `conflict` and is never retried under another ID. A crash between these actions is safe because exact re-admission is idempotent at every governed subscriber.
9. Preserve the existing `commitIfChanged` side effect for `session_end`, `checkpoint`, and `milestone`, using the normalized reason/milestone after the file outcome is fixed. Git failure cannot turn the completed filesystem save into a failed save; return success with a bounded `checkpointState: 'failed'` warning/diagnostic. A successful/no-change result retains current behavior.
10. Continue emitting the legacy `file_changed` compatibility message for this save until SPEC-04 completes its atomic projection cutover.

A pre-rename failure marks `failed` and emits no resource success fact. Failure after rename but before the parent-directory flush records/returns `outcome_unknown` and never emits a success fact. If the durable atomic replacement succeeds but the post-write DB update, fact admission, or required ledger delivery fails, return filesystem success with `provenanceState: 'pending_reconciliation'`; never report that the file write failed or ask the client to retry it blindly.

On startup, an operation left `accepted` is known not to have reached snapshot/write preparation. In one transaction mark it `failed` with fixed code `interrupted_before_prepare`; tombstone its reserved absent-target resource mapping while preserving an existing live mapping. It emits no resource success fact. Its independently reserved command-accepted fact still follows the pending retry rule.

Every operation left `prepared` becomes `outcome_unknown`. Record the currently observed target state/hash when safely readable, preserve the known before/intended hashes, update a reserved create mapping to `outcome_unknown`, emit a fixed diagnostic, and do not admit a resource success fact from byte coincidence. Target equality is correlation only: the process cannot prove whether its atomic replacement occurred before the crash or another actor produced/restored those bytes.

Retry every pending command-fact admission from any durable operation state. Then re-admit every `succeeded` operation whose resource-fact admission or ledger projection remains pending, using its reserved event ID/timestamp and durable success fields. Successful admission marks its state admitted; required ledger completion marks its projection stored. The operation row is the bounded producer-owned replay marker, so no generic retry queue is introduced. Every governed subscriber treats an exact duplicate as a no-op; any subscriber that already holds a conflicting payload emits its fixed diagnostic, marks the operation conflict, and never overwrites it or asks for a new event ID.

Temporary files are operation-named and cleaned only after their operation is terminal or reconciled.

The crash contract covers server-process termination and restart. File and containing-directory flushes are required before `succeeded`, but sudden host power loss, storage-controller failure, and media failure remain outside MVP acceptance unless the active SQLite/filesystem stack can prove equivalent durability. No test may infer power-loss guarantees from process-kill evidence.

## Resource Fact

For an operation durably marked `succeeded`, admit:

```ts
type ResourceMutatedV1 = {
  eventId: string;
  eventType: 'resource.mutated';
  schemaVersion: 1;
  occurredAt: number;
  workspaceId: string;
  operationId: string;
  commandId: string;
  commandAcceptedEventId: string;
  origin: {
    kind: 'local_client';
    connectionId: string;
    assurance: 'transport_only';
    reportedUiContext?: { viewId?: string; viewInstanceId?: string };
  };
  resource: {
    resourceId: string;
    kind: 'file';
    path: string; // canonical workspace-relative physical path
    access: { panel: string; path: string }; // validated ingress alias
  };
  mutation: {
    kind: 'create' | 'modify';
    saveReason?: 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';
    milestone?: string;
  };
  fileVersionId: string;
};
```

MVP does not add a declarative direct-cause field or optional thread/turn/tool/script placeholders. The command fact, resource fact, snapshot, and future independently timestamped chat/tool facts can be correlated without pretending certainty. A later trusted producer may add a versioned causality assertion.

## Ledger Subscription and Query

This SPEC adds the ledger handler, registry row, and grants together; SPEC-01 does not pre-enable a handler that does not exist.

The `system.provenance-ledger` subscriber has only:

- filter: `resource.mutated`, schema version 1;
- `fact.consume` scoped to that event/version;
- `ledger.append_resource_fact` scoped to its workspace/event and mapped only to `appendResourceFact`;
- `diagnostic.write_fixed` scoped to `ledger_write_failed` and `ledger_duplicate_conflict`, mapped only to `writeDiagnostic`.

It receives no raw DB, filesystem, socket/session registry, event-emission, or command capability. In one transaction, `appendResourceFact` stores `resource.mutated` idempotently in the migration-029 ledger evolution and marks the matching operation's ledger projection stored. Exact duplicate event ID plus identical canonical payload also marks stored and is a no-op. A conflicting payload for an existing event ID is not overwritten; emit the fixed diagnostic, mark the operation conflict, and fail that delivery. The operation row—not a generic queue—drives restart replay while projection remains pending.

Expose a named repository plus an exact public WebSocket query route, never raw SQL. The request is:

```ts
type ResourceProvenanceQueryV1 = {
  type: 'resource:provenance:query';
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel?: string;
  path?: string;
  fileName?: string;
  folderPrefix?: string;
  operationId?: string;
  since?: number;
  limit?: number;
};

type ResourceProvenanceItemV1 = {
  eventId: string;
  eventType: 'resource.mutated';
  occurredAt: number;
  acceptedAt: number;
  operationId: string;
  commandId: string;
  commandAcceptedEventId: string;
  resourceId: string;
  fileVersionId: string;
  mutationKind: 'create' | 'modify';
  canonicalPath: string;
  ingress: { panel: string; path: string };
  origin: { kind: 'local_client'; assurance: 'transport_only'; connectionId: string };
  snapshot:
    | {
        kind: 'bytes';
        sha256: string; // lowercase 64-hex SHA-256
        byteLength: number;
        capturedAt: number;
      }
    | {
        kind: 'absent';
        byteLength: 0;
        capturedAt: number;
      };
};

type ResourceProvenanceResultV1 = {
  type: 'resource:provenance:result';
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  items: ResourceProvenanceItemV1[];
};

type ResourceProvenanceErrorV1 =
  | {
      type: 'resource:provenance:error';
      version: 1;
      code: 'invalid_request';
      requestId?: string;
    }
  | {
      type: 'resource:provenance:error';
      version: 1;
      code: 'invalid_request';
      requestId: string;
      workspaceId: string;
      workspaceEpoch: string;
    }
  | {
      type: 'resource:provenance:error';
      version: 1;
      code: 'workspace_unavailable';
      requestId: string;
    }
  | {
      type: 'resource:provenance:error';
      version: 1;
      code: 'query_failed' | 'stale_workspace';
      requestId: string;
      workspaceId: string;
      workspaceEpoch: string;
    };
```

`client-message-router` delegates this family to a resource-provenance handler. Validation order is fixed: validate the type/version/request ID/expected-pair envelope first; derive and capture `{ workspaceId, workspaceEpoch }` from the connection's active server session second; require exact equality with the request pair third; validate and normalize selectors fourth; then execute the repository query. The request pair is a stale-intent precondition and cannot select workspace authority or a root. Mismatch returns `stale_workspace` with the current pair and does not query either workspace. The repository query remains bound to the captured workspace even if navigation changes before it completes, and the result/error echoes the captured epoch. The client resolves a pending query only when request ID, workspace ID, and epoch all still match; otherwise it discards the stale response. With `panel`, `path` and `folderPrefix` are validated against that recognized panel then converted to canonical workspace-relative paths. Without `panel`, they are already canonical workspace-relative paths. `fileName` is an exact normalized basename match. Present selectors combine with AND semantics. `requestId` and expected workspace ID are untrusted correlation/precondition strings capped at 128 UTF-8 bytes; expected epoch is a lowercase UUID; panel uses the existing 128-byte bound; path/folder use the 4096-byte path bound; filename is nonempty and capped at 255 UTF-8 bytes; `operationId` uses canonical lowercase UUID syntax; `since` is a nonnegative epoch millisecond. Limit defaults to 50, accepts 1–200, and results order by `occurredAt DESC, eventId ASC`. Unknown fields, null optionals, invalid normalization, or out-of-range values return `invalid_request`.

An envelope-level `invalid_request` includes `requestId` only if that field independently passed validation and has no workspace pair. A selector-level `invalid_request` has the validated request ID and complete captured pair. `workspace_unavailable` requires a validated request ID but has no invented workspace pair. `stale_workspace` and `query_failed` always carry the current/captured pair. Tests cover missing, wrong-type, empty, and over-128-byte request IDs without echoing invalid data, selector errors after active-workspace capture, and held A1 requests rejected after both A→B and A→B→A.

The response never includes raw snapshot bytes, raw payload JSON, SQL errors, or secrets. A server exception produces the fixed `query_failed` code and a bounded diagnostic. SPEC-03's migration installs two locked system definitions: command key `file_save` version 1 contains the exact request schema and complete response union; query key `resource:provenance` version 1 contains the exact request/result/error family. Their canonical JSON uses JSON Schema 2020-12 with `additionalProperties: false` at every object and the conditional/discriminated rules stated here. The owning route validates through the checksummed active definition rather than a divergent hand-coded shape. Checked-in schema, migration seed, server validator, shared client types, and protocol fixtures must agree byte-semantically. Public-message integration tests include a delayed first-A query released after A→B→A.

The item schema rejects a bytes snapshot without a lowercase 64-hex SHA-256 and rejects an absent snapshot with a hash, bytes, or nonzero length. Integration fixtures cover both discriminants.

## Slices

### Slice 03a — Registry, operation, and version repositories

Add migrations, stable-resource lookup/reservation, operation state transitions, snapshot codec, normalized lookup indexes, and query repository.

### Slice 03b — Save controller and crash reconciliation

Implement validation, ID reservation, required command acceptance, prepare transaction, safe atomic replacement, truthful result states, startup reconciliation, and focused failure-boundary tests.

### Slice 03c — `file_save` route cutover with compatibility projection

Install the locked `file_save@1` command definition containing request and response schemas, route only that validated command through the controller, atomically update first-party senders to the versioned request, adapt wire `reason` to internal `saveReason`, implement the exact response union and epoch gating, preserve checkpoint/milestone Git behavior, and retain one legacy `file_changed` save broadcast until SPEC-04.

### Slice 03d — Ledger handler, registration, and grants

Add and atomically activate the narrow ledger subscriber; install the locked `resource:provenance@1` query/result/error definition and public route; prove schema drift rejection, idempotent storage, and resource/path/name/folder queries.

## Expected Integration Areas

- new `fusion-studio-server/lib/resources/` or `lib/file-mutations/`
- `fusion-studio-server/lib/file-explorer.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/redaction-map.js`
- server workspace-session bind/switch broadcaster and shared wire schemas
- `fusion-studio-server/lib/startup.js`
- `fusion-studio-server/lib/ledger/`
- `fusion-studio-server/lib/db/migrations/`
- focused server tests under `test/resources`, `test/ledger`, and `test/ws`
- `fusion-studio-client/src/state/fileDataStore.ts`, `src/lib/ws/file-handlers.ts`, and shared client message types for request IDs and epoch-gated save/query replies

## Acceptance

Tests prove:

- normalized/resolved-parent containment and final-symlink rejection before mutation, including the intentional legacy behavior change;
- a raw client cannot escape by setting `rootFolder` to `/tmp` or another external directory before `file_save`; containment always uses the server workspace registry and derived panel policy;
- honest `local_client`/`transport_only` origin, with no authenticated identity claim;
- File Viewer and recognized Office aliases for the same physical path serialize on one mutex and reuse one canonical resource ID while preserving the actual ingress alias as correlation;
- every accepted command has a durable reserved command fact and an admission attempt; normal and restart-recovery paths reach admitted, while injected admission failure is reported honestly as pending without blocking the save;
- existing file captures exact old bytes/hash and absent file records an absent preimage;
- compact provenance query and subscriber contexts never expose raw preimage bytes, and no automatic cleanup deletes MVP snapshots;
- provenance query items require a hash and actual byte length for bytes snapshots, while absent snapshots have no hash and literal zero length;
- concurrent mediated saves are serialized per resource, queue overflow is bounded, and the immediate preimage is revalidated before replacement;
- binary frames, invalid JSON/non-string content, lone high/low surrogates, NUL, invalid or non-round-tripping UTF-8 preimages, oversized encoded content/preimages, directories, final symlinks, and external-resolved-parent cases are rejected without mutation; ASCII, empty text, BOM text, and astral/emoji fixtures round-trip byte-exactly;
- only one atomic filesystem replacement occurs;
- pre-write failures emit no resource success fact;
- every valid save reply matches the exact versioned union: rejected replies have no reserved IDs, every accepted-operation reply has the complete reserved ID set, outcome/status enums are closed, and post-write persistence/admission failure returns success with pending reconciliation;
- existing `reason` callers preserve session/checkpoint/milestone Git behavior, and injected Git failure returns file success with an honest checkpoint warning rather than false write failure;
- WebSocket logging redacts the complete `file_save.content` value before serialization while the mutation handler still receives the original bytes;
- required ledger rejection/absence/timeout remains pending and is idempotently replayed on restart until stored or conflicting;
- restart reconciliation deterministically resolves `accepted` to interrupted failure, `prepared` to outcome unknown, and succeeded pending projections by replay, without a second write; crash injection covers post-reservation and post-command-fact/pre-prepare boundaries;
- resource identity survives restart, aliases, and concurrent reservation, while a compatibility rename/delete/recreate cannot cause a stale canonical-path row to be reused for a different fingerprint;
- exact duplicate event is a no-op and conflicting event ID never overwrites ledger truth;
- save and query replies carry the captured server-issued workspace epoch and are rejected after A→B→A when stale; the one bounded bind buffer queues completed replies behind the bind frame, rejects new workspace requests while binding, and closes on overflow/send failure;
- save/query requests carry the client's workspace pair only as an equality precondition; held A1 requests are rejected without mutation/query after A→B and A→B→A and can never select the server workspace;
- the public typed WebSocket query derives workspace authority server-side, normalizes panel aliases to canonical paths, returns deterministic path/filename/folder-prefix/operation matches and fixed errors, omits an invalid request ID rather than echoing it, and exposes no snapshot bytes;
- legacy `file_changed` continues for this save until SPEC-04;
- create/move/rename/delete and watcher observations do not enter this MVP ledger subscription.

Run at minimum:

```bash
cd fusion-studio-server
npm test -- --runInBand test/resources test/ledger test/ws
npm test
```

## Review Packet

Reviewers must inspect path/symlink containment and time-of-check/time-of-use limits, stable-ID races, exact prepare/write/finalize ordering, post-write truthfulness, startup reconciliation, preimage exposure, hash/byte correctness, idempotency/conflict handling, legacy compatibility broadcasting, and any mutation path incorrectly claimed mediated.

## Out of Scope

Authenticated local principals, declarative causality, create-folder/document, move, rename, delete, Office sidecars, restore UI/command, retention cleanup, binary files, full chat/tool/script producers, harness interception, arbitrary external filesystem observations, and unrelated server writers.
