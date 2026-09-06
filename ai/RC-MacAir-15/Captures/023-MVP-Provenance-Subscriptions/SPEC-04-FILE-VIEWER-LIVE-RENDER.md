# SPEC-04 — File Viewer Live Render Through Central Zustand State

**Status:** `CANDIDATE — OWNER APPROVAL REQUIRED`  
**Prerequisite:** Owner-accepted SPEC-03  
**Mission:** Make the File Viewer the first confirmed customer of the governed UEB projection path, remove its private resource cache/listener split, and prove the complete save-to-visible-update loop in an isolated runtime.

## Applicable Code Standards

- Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- Routed pages:
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`
- Approved supersessions: none. The standards explicitly cover one canonical resource cache, epochs/stale-response rejection, targeted recovery, compatibility removal, and isolated runtime proof.

## Observable Outcome

An already-open File Viewer text document updates after an app-mediated `file_save` without menu refresh, view remount, workspace switch, polling, a second event service, watcher dependence, or direct DOM mutation.

## Server Projection Contract

This SPEC adds the `system.resource-render-projection` handler, its registry row, and its grants together. It consumes only privately admitted `resource.mutated` v1 facts from SPEC-02 and can route one typed projection to renderer sessions currently bound to the event workspace.

```ts
type ResourceChangedMessageV1 = {
  type: 'resource:changed';
  version: 1;
  eventId: string;
  operationId: string;
  workspaceId: string;
  resourceId: string;
  resourceKind: 'file';
  operation: 'create' | 'modify';
  panel: 'file-viewer';
  path: string;
  occurredAt: number;
  workspaceEpoch: string;
};
```

The subscriber has only:

- filter: `resource.mutated`, schema version 1;
- `fact.consume` scoped to that event/version;
- `renderer.publish_resource_changed` scoped to workspace, event/version, and message type/version, mapped only to `publishResourceChanged`;
- `renderer.publish_resource_refresh_required` scoped to workspace, message type/version, and `projection_failed` only, mapped only to `publishResourceRefreshRequired`;
- `diagnostic.write_fixed` scoped to `render_projection_failed` and `render_projection_duplicate_conflict`, mapped only to `writeDiagnostic`.

It receives no raw socket/session registry, filesystem, DB, event-emission, or command capability. The handler builds a workspace-scoped base projection only from the admitted fact. For this MVP it always translates `resource.path`, the canonical workspace-relative path, to the read-only File Viewer alias `{ panel: 'file-viewer', path: resource.path }`; it never targets the ingress Office/Email panel and therefore cannot adopt or overwrite a deferred dirty editor. The narrow publisher capability resolves matching sessions and injects each recipient's epoch into its final message.

SPEC-03 already establishes a fresh server-generated UUID `workspaceEpoch` for every successful initial bind/switch, one ordered workspace-message bind buffer bounded at 256 messages and 8 MiB, and epoch-gated save/query replies. This SPEC extends that same buffer's admitted message kinds to completed versioned File Viewer tree/content replies and matching resource/recovery projections; it does not create a second queue. `binding` retires the old epoch and allocates the new one; the server queues the recipient-specific `workspace:init` or `workspace:switched` frame carrying workspace ID and epoch before marking the session `active`; it then flushes buffered replies/projections in their one completion order on the same socket. A projection or read reply cannot route with the new epoch before the bind frame. Either buffer limit or send failure closes the socket so authoritative reconnect/hydration occurs rather than silently claiming freshness. The client continues to apply workspace and epoch atomically before accepting later file messages. The projection message carries no file content and performs no file read.

## Epoch-Safe File Viewer Read Protocol

Slice 04b versions the File Viewer tree/content request family. Other panel callers may remain on their inventoried unversioned compatibility paths; only the literal `file-viewer` shapes below satisfy this MVP's canonical File Viewer cache.

```ts
type FileViewerReadBaseV1 = {
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: 'file-viewer';
  path: string;
};

type FileTreeRequestV1 = FileViewerReadBaseV1 & {
  type: 'file_tree_request';
  includeHiddenFolders?: boolean;
};

type FileContentRequestV1 = FileViewerReadBaseV1 & {
  type: 'file_content_request';
};

type FileTreeNodeV1 =
  | {
      name: string;
      path: string;
      type: 'file';
      extension?: string;
      isSymlink?: true;
      symlinkTarget?: string;
    }
  | {
      name: string;
      path: string;
      type: 'folder';
      hasChildren: boolean;
      isSymlink?: true;
      symlinkTarget?: string;
    };

type FileReadResponseBaseV1 = {
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: 'file-viewer';
  path: string;
};

type FileReadProtocolErrorV1<T extends 'file_tree_response' | 'file_content_response'> =
  | {
      type: T;
      version: 1;
      success: false;
      code: 'invalid_request';
      requestId?: string;
      error: string;
    }
  | {
      type: T;
      version: 1;
      success: false;
      code: 'workspace_unavailable';
      requestId: string;
      error: string;
    }
  | {
      type: T;
      version: 1;
      success: false;
      code: 'invalid_request' | 'stale_workspace';
      requestId: string;
      workspaceId: string;
      workspaceEpoch: string;
      error: string;
    };

type FileTreeResponseV1 =
  | FileReadProtocolErrorV1<'file_tree_response'>
  | (FileReadResponseBaseV1 & {
      type: 'file_tree_response';
      success: false;
      code:
        | 'path_not_allowed'
        | 'not_found'
        | 'permission_denied'
        | 'not_directory'
        | 'too_many_entries'
        | 'read_failed';
      error: string;
    })
  | (FileReadResponseBaseV1 & {
      type: 'file_tree_response';
      success: true;
      nodes: FileTreeNodeV1[];
      isSymlink?: true;
      symlinkTarget?: string;
    });

type FileContentResponseV1 =
  | FileReadProtocolErrorV1<'file_content_response'>
  | (FileReadResponseBaseV1 & {
      type: 'file_content_response';
      success: false;
      code:
        | 'path_not_allowed'
        | 'not_found'
        | 'permission_denied'
        | 'is_directory'
        | 'unsupported_text'
        | 'read_failed';
      error: string;
    })
  | (FileReadResponseBaseV1 & {
      type: 'file_content_response';
      success: true;
      content: string;
      size: number;
      lastModified: number;
      isSymlink?: true;
      symlinkTarget?: string;
    });
```

All these schemas reject unknown fields and null optionals. Request/workspace IDs use the 128-byte bounds, epochs are lowercase UUIDs, `path` is `''` only for the tree root and otherwise a normalized workspace-relative path capped at 4096 UTF-8 bytes, node names are 1–255 UTF-8 bytes, node paths use the same 4096-byte bound, and a tree has at most 1,000 nodes. `error` is a fixed non-secret display string capped at 256 bytes. `size` is the exact UTF-8 byte length and `lastModified` is a nonnegative integer epoch millisecond. When `isSymlink` is present it is literal `true` and `symlinkTarget` is required; `symlinkTarget` without `isSymlink` is invalid. File Viewer content success requires fatal UTF-8 decode without U+0000 and exact byte round-trip; unsupported bytes return `unsupported_text`, not replacement characters.

The request's workspace pair is only a stale-intent precondition. The server validates type/version/request ID/pair, captures the active server pair, requires exact equality, then resolves the File Viewer root and path from server policy. Mismatch returns `stale_workspace` with the current pair and performs no read; an A1 request remains stale after A→B→A. An envelope error has no pair, a binding/no-active-session request returns `workspace_unavailable`, and post-capture semantic errors carry the complete current pair without echoing invalid panel/path values. An accepted read captures the server pair before asynchronous I/O, and every success/domain error carries that captured pair even if navigation later changes.

The client removes wire-level `generation` and never sends a workspace value as authority. Its pending entry retains `{ requestId, localGeneration, workspaceId, workspaceEpoch }`. A reply is applied only when its request ID matches the pending entry, its captured pair matches both the pending entry and current store pair, and the pending local generation is current. A resource projection invalidation supersedes the old pending request with a new request ID before refetch. A delayed A1 read, including one delivered after A→B→A or buffered behind a bind frame, is discarded and cannot overwrite A2 content. The registry migration for SPEC-04 installs locked `definition_kind = query` keys `file_tree` version 1 and `file_content` version 1, each containing its exact request and response union. Canonical JSON uses JSON Schema 2020-12 with `additionalProperties: false` at every object; checked-in schemas, checksummed seeds, server validators, shared client types, and drift tests must agree byte-semantically.

## Immediate Recovery Projection

A successful filesystem write must not leave an open view stale merely because provenance admission or the ordinary projection failed. Add a deliberately noncanonical recovery message:

```ts
type ResourceRefreshRequiredV1 = {
  type: 'resource:refresh_required';
  version: 1;
  workspaceId: string;
  panel: 'file-viewer';
  path: string;
  operationId: string;
  workspaceEpoch: string;
  reason: 'fact_publish_failed' | 'projection_failed' | 'projection_unavailable' | 'mutation_outcome_unknown';
};
```

Both projection schemas reject unknown fields. `workspaceEpoch`, event, operation, and resource IDs are canonical lowercase UUID strings; the registered workspace ID is nonempty UTF-8 capped at 128 bytes; panel is the literal `file-viewer`; path is the canonical normalized workspace-relative path and is capped at 4096 UTF-8 bytes; reasons and operations are the closed enums shown above.

- if SPEC-03 post-write `publishFact` fails, the mutation controller directly invokes a narrow recovery publisher;
- if the render subscriber cannot construct or publish the canonical projection, its narrow capability invokes the same recovery publisher;
- if SPEC-02's resource-fact delivery report contains no invoked `system.resource-render-projection`, the mutation controller sends recovery with `projection_unavailable`;
- if atomic rename occurred but durable outcome could not be claimed, the mutation controller may send recovery with `mutation_outcome_unknown` while emitting no canonical success fact;
- the recovery route targets only sessions bound to the workspace and contains no content or provenance claim;
- both controller- and subscriber-owned recovery translate the canonical resource path to the literal `file-viewer` panel; they never target the ingress Office/Email cache key;
- the central client store treats it as targeted invalidate/refetch, not as a canonical event;
- an unavailable/closed socket is not queued in MVP; normal reconnect and authoritative hydration recover it.

For normal admission/projection failure, the mutation remains successful and provenance may remain pending reconciliation. `mutation_outcome_unknown` is limited to the narrower case where atomic rename returned but durability/final recording failed. Recovery may never be emitted for a validation or pre-rename failure.

The owning mutation controller's trusted startup injection may use only `fact_publish_failed`, `projection_unavailable`, and `mutation_outcome_unknown`; it is not a subscriber grant and exposes no raw session map. The render subscriber's registry capability may use only `projection_failed`. Both call the same narrow workspace/epoch-bound recovery publisher.

## Atomic Compatibility Cutover

SPEC-03 retains the legacy `file_changed` save broadcast. In Slice 04a:

1. install the projection handler, schema, registry row, and grants;
2. compile the next immutable subscription generation;
3. prove canonical projection and recovery behavior against that generation;
4. activate the generation and remove the SPEC-03 save compatibility broadcast in the same reviewed change.

There must be no committed state in which the new subscriber is enabled without its handler/grants, or in which neither old nor new save projection exists. `file_changed` remains compatibility behavior for non-migrated routes.

## Central Store Contract

`fileDataStore.ts` or its deliberately renamed successor owns:

- workspace generation;
- panel/path keyed trees and content;
- request IDs and stale-response rejection;
- pending/errors/metadata;
- targeted invalidation and refetch;
- event/operation dedupe for repeated canonical projections.

On `resource:changed`:

- only the literal `file-viewer` panel is valid in this MVP, and the path is already the canonical workspace-relative File Viewer path;
- modify invalidates/refetches the cached content and its parent tree;
- create invalidates/refetches the parent tree and refetches content only if that path is currently requested/open;
- unrelated panels/paths remain cached and do not refetch;
- a projection whose `workspaceEpoch` is not the store's current server-issued epoch is ignored, even if the workspace ID matches an earlier A→B→A visit.

On `resource:refresh_required`, the same target is invalidated/refetched only when its epoch matches, without adding canonical event dedupe or inventing ledger state.

The store must clear or supersede a pending-content entry before refetch after invalidation. Request generations ensure a stale response cannot overwrite newer content, including when the old request resolves after the projection-triggered read.

## File Viewer Cutover

Keep `fileStore` only for view presentation state such as tab order, active tab ID, expanded folders if not yet generalized, hidden-folder preference, and persisted view activity. Remove its ownership of canonical file content/tree response state.

Required changes:

- `FileViewer.tsx` selects active panel/path content from the central store;
- `FileExplorer.tsx` selects tree/loading/error from the central store;
- `useFileTreeListener` and direct component `ws.addEventListener` resource handling are removed;
- `lib/file-tree.ts` delegates requests to central store actions or is retired;
- central `ws-client.ts`/`file-handlers.ts` is the only renderer resource-message path;
- tab close behavior and the active path are preserved through a narrow adapter, not duplicated content cache logic;
- a modify does not lose tab order, active document, breadcrumb, collapse state, or unrelated cached content.

Rename, move, and delete tab remapping are not part of this save-only proof; their existing compatibility handlers remain until their mutation SPEC.

## Isolated Runtime Proof

Add a dedicated configuration and launcher, for example:

- `fusion-studio-client/playwright.provenance.config.ts`;
- `fusion-studio-client/e2e/provenance/run-file-viewer-live.mjs`;
- `fusion-studio-client/e2e/provenance/file-viewer-live-resource.spec.ts`.

The launcher must:

- allocate a unique non-3001 port;
- create and exclusively own temporary app-data and workspace directories;
- set `FUSION_APP_USER_DATA` to the temporary profile;
- set `FUSION_LOCAL_MACHINE=Test-Provenance`;
- initialize that profile's `fusion.db` and workspace registry;
- set Playwright `reuseExistingServer: false`;
- use a test-only injected isolated-provenance startup mode whose production default remains unchanged; it suppresses and asserts against every background watcher or external adapter, including workspace, screenshot/hotkey, calendar, email, connector, and harness-startup paths;
- refuse to run if the resolved DB, workspace, port, or app-data path equals the developer checkout, normal Application Support profile, configured development port, or any non-owned path;
- create a small UTF-8 fixture file outside the repository;
- launch the isolated server and built client;
- clean only directories bearing its owned test marker.

The proof opens File Viewer and the fixture through ordinary UI/WS behavior, submits `file_save` through a second local-client fixture WebSocket, and asserts visible content changes without page reload or view remount. That fixture is not described as authenticated or authorized user UI; its recorded origin is `local_client` with `transport_only` assurance.

A focused companion case opens `ai/Test-Provenance/Office/shared.md` through File Viewer and saves the same physical file through the recognized Office alias `{ panel: 'office-viewer', path: 'shared.md' }`. It proves both aliases resolve to one `resourceId`, the emitted resource fact retains canonical path plus ingress correlation, only the `file-viewer` projection/cache key invalidates, and no Office/Email dirty-state adoption is attempted.

The proof must observe the typed `resource:changed` message with the matching reserved event/operation IDs before accepting the visible update. With watcher initialization disabled and the mediated-save `file_changed` broadcast removed, no legacy refresh path can satisfy the assertion accidentally.

It then queries the typed `resource:provenance:query` WebSocket route and matches the command, operation, resource-event, resource, and file-version IDs. The save response and query result must also carry the same currently active workspace epoch; the fixture rejects a deliberately delayed response from an earlier A epoch after A→B→A.

Required command:

```bash
cd fusion-studio-client
node e2e/provenance/run-file-viewer-live.mjs
```

If the builder chooses equivalent paths, the dedicated launcher semantics and exact command must be recorded in the completion evidence. Direct use of the repository's default Playwright configuration is not acceptable for this proof.

## Slices

### Slice 04a — Typed projection subscriber and atomic cutover

Implement schema, allowlisted handler, exact grants, workspace-scoped routing, recovery projection, diagnostics, generation activation, and simultaneous removal of the mediated-save legacy broadcast.

### Slice 04b — Central store event semantics

Install the two locked File Viewer read protocol definitions, implement their server-captured epoch replies and shared bind-queue routing, then implement canonical/recovery message handling, dedupe, targeted create/modify invalidation, pending-request supersession, stale-response protection, and focused protocol/store tests.

### Slice 04c — File Viewer store cutover

Move tree/content reads and requests to central state, remove the component listener/duplicate content cache, and preserve tabs/navigation/UI behavior.

### Slice 04d — Isolated live acceptance

Build and run the guarded temporary runtime proof, then run complete server tests and client build.

## Expected Integration Areas

- new server resource projection subscriber under `fusion-studio-server/lib/subscriptions/handlers/` or equivalent
- `fusion-studio-server/lib/startup.js` and narrow workspace-session routing injection
- `fusion-studio-server/lib/file-explorer.js`, registry migration/schema seeds, and shared server wire validation for the versioned File Viewer reads
- `fusion-studio-client/src/state/fileDataStore.ts`
- `fusion-studio-client/src/lib/ws/file-handlers.ts`
- `fusion-studio-client/src/types/`
- File Viewer components/hooks/stores named in `CODE-INVENTORY.md`
- dedicated client tests and isolated e2e fixture

## Acceptance

Automated and runtime evidence must prove:

- the exact SPEC-03 save response, command fact, resource fact, ledger row, version row, renderer projection, central refetch, and visible update share matching IDs/path as applicable;
- the visible change occurs without `page.reload`, menu refresh, `set_panel`, view remount, polling, new socket service, or watcher event;
- the isolated server proves its workspace watcher never started and the matching typed projection was observed before the render assertion;
- the compatibility save broadcast remains through SPEC-03 and is removed only with the active SPEC-04 generation;
- fact-admission or projection failure after a successful write sends targeted recovery and visibly refreshes;
- unrelated cached file content and tree branches do not refetch;
- stale responses cannot roll content backward and exact duplicate projections do not refetch twice;
- File Viewer tree/content requests carry request ID plus the current workspace pair as a precondition; the server captures that pair before I/O, the reply carries the captured epoch, and the store requires pending/current request, epoch, and local generation agreement;
- failed/pre-write-rejected save produces no canonical or recovery projection and leaves visible content unchanged;
- reconnect/workspace generation rejects stale projections and rehydrates authoritatively;
- A→B→A navigation proves that a delayed projection from the first A epoch is ignored;
- delayed File Viewer tree/content replies from A1 are ignored after A→B and A→B→A, and a read completing during `binding` is delivered only behind the bind frame through the one bounded queue;
- a fact arriving while a session is `binding` is delivered only after the matching switch/init frame is queued; buffer overflow closes/reconnects instead of losing freshness;
- one physical file reached through File Viewer and Office aliases retains one resource ID and refreshes only the File Viewer canonical cache key;
- no component-owned WebSocket resource listener or second canonical file-content cache remains in File Viewer;
- the proof records the second fixture connection honestly as transport-only;
- live developer DB/workspace/profile remain untouched by the fixture.

Run at minimum:

```bash
cd fusion-studio-server
npm test

cd ../fusion-studio-client
npm run build
node e2e/provenance/run-file-viewer-live.mjs
```

## Review Packet

Reviewers must inspect duplicate state ownership, stale closures/responses, pending-request invalidation, generation/workspace isolation, tab preservation, reconnect behavior, direct listener/broadcast remnants, recovery misuse, test refusal guards, test-owned cleanup, and whether the proof accidentally relies on chokidar or the default development profile.

## Out of Scope

Rename/move/delete render semantics, Office/Email dirty-editor adoption, migration of every file-backed view, arbitrary external-file refresh guarantees, authenticated plugin/custom-view bridges, restore UI, and general document edit-controller extraction.
