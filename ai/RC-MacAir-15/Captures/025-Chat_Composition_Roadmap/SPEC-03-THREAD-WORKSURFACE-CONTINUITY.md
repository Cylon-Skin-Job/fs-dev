# SPEC-03 — Thread Worksurface Continuity

**Status:** `DRAFT_CANDIDATE`  
**Domain owner:** view-state persistence and view-specific worksurface adapters  
**Prerequisites:** owner-accepted SPEC-02  
**Blocks:** SPEC-04

## 1. Objective

Make each view-bound Thread Group remember the content worksurface that belongs
to it. Switching groups must restore the files, pages, tabs, locations,
selections, and scroll positions that the owning view elected to save, while
chat transcripts and chat chrome continue to use their existing owners.

This SPEC establishes one versioned adapter contract rather than inventing a
universal worksurface schema. It also adds durable cleanup coordination so
deleting a Thread Group cannot leave its content snapshot indefinitely orphaned.

## 2. Authorities And Baseline

Read before implementation:

- bundle `BUNDLE-INDEX.md`, `DECISIONS.md`, `ISSUES.md`, and `GUIDANCE.md`;
- `../../../../AGENTS.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`;
- the Chat System Identity And Persistence, WebSocket Protocol, Runtime Model,
  Structure, and Testing And Operations pages;
- the owner-accepted SPEC-01 and SPEC-02 reports, exact types, tests, and
  deviations;
- current workspace/view-state services, handlers, renderer stores, navigation
  owners, and built-in view state; and
- the independently accepted Generic Component Tab Host state contract used by
  SPEC-02.

The orchestrator records the exact accepted baseline commit and migration head
before assigning Slice 03A. Unaccepted tab-host or Provenance worktree code is
not authority.

## 3. Scope

### In scope

- one group-keyed content-state namespace under each stable view identity;
- a versioned, JSON-safe capture/sanitize/restore adapter contract per view;
- explicit cutover from existing global/top-level tab and content writers while
  a view is group-bound;
- flush-before-leave and restore-after-select group switching;
- optimistic concurrency with explicit revision/conflict handling;
- reconnect, restart, inactive-view, and multi-window behavior;
- server-owned state mutation and changed-state fanout;
- durable deletion cleanup coordinated from the Thread Group transaction;
- explicit non-copy treatment of pre-group/global view state; and
- focused unit, integration, restart, multi-window, and Electron proof.

### Out of scope

- transcript, turn, runtime, prompt, Stop, usage, draft, attachment, model,
  ThreadRail, Chat/Threads visibility, full-screen, focus, or menu persistence;
- a cross-view universal list of filenames, URLs, scroll fields, or tab kinds;
- default content selection when a group has no saved snapshot;
- database-backed duplication of view-state snapshot JSON;
- production Side Chat placement or Move Chat to Side Chat;
- group schema/lifecycle changes other than the deletion-cleanup outbox;
- arbitrary tab creation, launcher behavior, or changes to the Generic Host;
- System View Capsule relocation, config inheritance, or protected-root policy;
  and
- Pending New Chat, project-folder creation, CWD, Collections, and plugins.

## 4. Canonical Ownership And Key

The view-state document remains the sole owner of worksurface content:

```ts
type ThreadWorksurfaceEntry = {
  schemaVersion: number;
  adapterId: string;
  adapterVersion: number;
  contentRevision: string;
  placementRevision: string;
  updatedAt: string;
  content: JsonValue;
  managedComponentPlacements: Record<string, ManagedPlacement>;
};

viewStates[viewId].threadWorksurfaces[threadGroupId]
```

The exact persisted envelope may follow the accepted view-state schema, but the
logical key is always `{workspaceId, viewId, threadGroupId}`. `workspaceId` is
supplied by the containing service/document identity and may not be inferred
from a path. `viewId` comes from the central registry and existing
`metadata.view-id`. `threadGroupId` comes from accepted SPEC-01.

There is no Legacy entry when `viewId` is null. The Legacy chat host has no
view-owned content worksurface. No code guesses a view from the active panel,
folder name, title, component, or group label.

`content` is adapter-owned. `managedComponentPlacements` is service-owned and is
mutated only through a narrow placement command, not a renderer content PUT.
The map is empty throughout SPEC-03; SPEC-04 activates it for Side Chat. The two
lanes have independent opaque revisions so an ordinary content save cannot
erase, overwrite, or acknowledge a concurrent managed placement change.

SQLite may own cleanup intent and delivery state. It must not own a second copy
of either lane.

## 5. View Worksurface Adapter

Each participating built-in view registers an implementation-equivalent
adapter:

```ts
type WorksurfaceAdapter = {
  adapterId: string;
  adapterVersion: number;
  capture(): JsonValue;
  sanitize(input: JsonValue, storedVersion: number): SanitizedResult;
  restore(content: JsonValue): Promise<RestoreResult>;
};
```

- `capture` includes only content navigation the view already owns.
- `sanitize` validates size, types, supported resources, versions, and unsafe or
  stale values before any renderer mutation.
- `restore` is idempotent and reports unavailable resources without inventing a
  replacement identity.
- Version upgrades are explicit, deterministic, and testable. Unsupported data
  produces an inert/default result and a classified warning; it does not crash
  the workspace or silently rewrite unknown fields.
- An adapter may persist content tabs, active content, document/location
  selection, browser URL/history cursor, and scroll/selection positions when
  that view owns them. These are examples, not a mandatory shared schema.

An ordinary user-created serialized component tab is content and may contain
the Generic Host's stable `componentInstanceId`. A service-managed Side Chat
descriptor is excluded from `capture` and lives in the managed-placement lane.
Neither lane may contain transcript/runtime state, the ThreadRail, shell
visibility, transient `surfaceId`, secrets, callbacks, DOM nodes, stores, or
non-JSON runtime objects.

While a view is bound to a Thread Group, its adapter/controller is the only
writer for every tab/content fact included in `content`. Existing global,
top-level, or `activity.tabs` write-through for those same facts is disabled or
routed into the selected group's content lane. It may remain only for an
explicit non-group/Legacy compatibility state and cannot hydrate over a
group-owned snapshot. The builder inventories each participating view's current
writers and proves one owner before activation.

## 6. Switching And Persistence Lifecycle

### 6.1 Select another group

The connected view owner performs this ordered transition:

1. freeze one immutable capture of the outgoing group's current content;
2. submit it with the last acknowledged opaque content revision;
3. keep the outgoing group/view selected and mounted until correlated success;
4. on success, select/open the incoming group through accepted SPEC-01/02
   behavior;
5. request the exact incoming `{workspaceId, viewId, threadGroupId}` entry; and
6. sanitize and restore both the adapter content and valid managed placements,
   or preserve the view's current/default behavior when
   no entry exists.

On conflict, rejection, or timeout, retain the capture and keep the outgoing
surface selected. Offer retry/reconcile and an explicit **Switch without
saving** choice that names the loss risk. Only that warned user choice may
discard the pending capture and continue. A late read or write acknowledgement
cannot overwrite the selected group or another key.

The same acknowledgement gate applies before changing views or detaching a
workspace. Panel/window close and orderly renderer teardown use the platform's
bounded close-veto/confirmation lifecycle where available; timeout requires the
same warned discard choice. Unpreventable process loss restores the last
acknowledged snapshot and is never described as a successful save.

### 6.2 Optimistic concurrency

The server compares the opaque expected revision for the mutation lane. On
mismatch it returns that lane's current revision and entry without applying the
stale write. Dirty/pending local state is never silently replaced by broadcast
or reconnect hydration.

Conflict handling is deterministic:

- if the local capture is identical to current content, acknowledge the current
  revision;
- otherwise retain the local pending capture, surface a non-destructive
  conflict state to the owning view, and allow an explicit recapture/retry after
  current state is reconciled; and
- never merge view-specific JSON in the generic service.

Each accepted mutation publishes a qualified, lane-specific state-changed
event. Other windows update only clean cached entries; a dirty entry records
that newer remote state exists. A content mutation server-merges against the
current managed-placement lane; a placement mutation server-merges against the
current content lane. Clients can never replace the opposite lane.

### 6.3 First selection and unavailable content

When no snapshot exists, selecting a group leaves the view in its established
initial/current content state. Choosing a configured default document or page is
a later View Capsule concern.

No migration copies one global view snapshot into one or more groups. The first
acknowledged capture creates that group's entry. Pre-existing global state may
remain only as the non-group/Legacy compatibility owner described above and
must not rehydrate over any group entry.

Missing or renamed files, disabled components, invalid URLs, and retired adapter
versions produce the view's existing unavailable/empty representation and a
classified warning. They do not rebind the group or delete the snapshot.

## 7. Server Contract

Use the established workspace/view-state route family and server authority.
Requests and responses carry exact workspace, view, group, adapter/version,
request, and revision identity. A representative contract is:

```ts
type ThreadWorksurfaceGet = {
  viewId: string;
  threadGroupId: string;
  requestId: string;
};

type ThreadWorksurfacePut = ThreadWorksurfaceGet & {
  expectedContentRevision: string | null;
  adapterId: string;
  adapterVersion: number;
  content: JsonValue;
};
```

Workspace is derived from the authenticated bound connection and is echoed in
the authoritative response. Exact event names may follow the accepted
view-state protocol, but they must be
registered, schema-validated, authorized, and correlated before mutation. The
client does not write view-state files directly. Payload and entry limits follow
existing workspace-state policy and receive focused abuse tests.

Reserve an internal/publicly registered narrow managed-placement mutation for
later feature owners. It addresses the same workspace/view/group plus stable
placement ID, expected placement revision, descriptor or closed disposition,
and request ID. It owns only `managedComponentPlacements`; it cannot mutate
adapter `content`. SPEC-03 proves the empty-lane merge and concurrency behavior;
SPEC-04 is the first producer.

The implementation-equivalent service command is:

```ts
type ManagedPlacementMutation = {
  requestId: string;
  viewId: string;
  threadGroupId: string;
  placementId: string;
  expectedPlacementRevision: string | null;
  operation: 'upsert' | 'close';
  descriptor?: JsonValue;
};
```

Workspace is derived from the authenticated bound connection or trusted
in-process outbox consumer. Renderer requests use the established registered
view-state route rather than a new top-level WebSocket family. `upsert` requires
a schema-valid descriptor; `close` stores a disposition and removes it from the
materialized tab set without erasing its idempotency history.

## 8. Durable Group-Deletion Cleanup

After this SPEC activates, deleting a view-bound group in SPEC-01's service must
atomically insert a durable `remove-group-worksurface` projection/outbox record
with the group tombstone. The record contains only workspace/view/group identity,
an idempotency key, status, attempts, and timestamps. It contains no snapshot.

The view-state service consumes it and removes only the exact entry, then
acknowledges completion. Retry after crash or restart is idempotent. A failed
cleanup remains observable and retryable and does not roll back a committed
group deletion. Legacy groups produce no cleanup record.

This is an extension point in the Thread Group domain, not a second delete
implementation. There is no filesystem cascade and no direct database-to-file
mutation. The accepted Provenance deletion contract remains unchanged.

Groups deleted before SPEC-03 activation require no backfill because no
group-keyed snapshot existed before activation. If implementation discovers a
pre-existing equivalent snapshot, the orchestrator must stop that slice and
record a migration/deviation assessment rather than silently deleting it.

## 9. Failure And Recovery Invariants

- A group switch never stores outgoing content under the incoming group and
  never completes before acknowledgement without an explicit warned discard.
- A view switch never stores content under another `viewId` with the same group
  or label.
- Pending local state survives list/open/state-change races until resolved, and
  the outgoing surface remains mounted for reconciliation.
- Content and managed-placement mutations cannot erase or acknowledge each
  other's lane.
- Reconnect hydrates acknowledged server truth, then reapplies or flags the
  exact pending local capture; it does not treat a broadcast as a write ack.
- Restart restores only acknowledged, schema-valid content.
- Deleting a group eventually removes exactly its worksurface entry even if the
  server stops between the SQLite commit and file mutation.
- Delete cleanup cannot remove another workspace, view, or group entry.
- Chat transcript/session state remains available and routed exactly as before
  while content restoration is pending or unavailable.

## 10. Dependency-Ordered Slices

### Slice 03A — One-view worksurface continuity

- Start at group selection in one representative production view and traverse
  capture, global-writer cutover, registered get/put, content CAS, server-owned
  persistence, acknowledgement-gated switch, restore/render, and restart.
- Include strict adapter validation plus the empty managed-placement lane and
  prove two groups retain distinct content with no second writer.

### Slice 03B — Conflict, lifecycle, and multi-window continuity

- Start at a second-window/view switch, close, detach, and reconnect intent and
  traverse pending capture, lane-specific CAS/fan-out, conflict UI,
  retry/reconcile or warned discard, restore, and restart/readback.
- Add the next representative view adapter and prove inactive mounts and late
  acknowledgements cannot steal selection or state.

### Slice 03C — Group Delete cleanup

- Add the next free migration for the cleanup projection/outbox if persistence
  is required by the accepted baseline.
- Insert cleanup intent in the existing group-delete transaction.
- Implement idempotent view-state consumption, retry, observability, and
  restart recovery.
- Exercise the public Delete action through outbox insertion, failed
  cross-store delivery, retry, renderer/view-state disappearance, and restart;
  then re-run Provenance and group-delete regression suites.

### Slice 03D — Remaining built-in view acceptance

- Connect remaining in-scope production view adapters one complete user path at
  a time without widening their schemas or restoring legacy writers.
- Prove switch, unavailable-content, multi-window, and Electron behavior after
  each increment.
- Run full integration/build/restart checks and produce the implementation
  report.

Every slice follows `GUIDANCE.md`: one fresh `spec-slice-builder` owns the slice,
repairs through its first clean independent review, then the orchestrator runs a
separate clean review and fail-forward repair before integration.

## 11. Required Verification

Add focused tests equivalent to:

- `e2e/thread-worksurface-switching.spec.ts`;
- `e2e/thread-worksurface-conflict.spec.ts`;
- `e2e/thread-worksurface-restart.spec.ts`; and
- server integration coverage for worksurface state and deletion cleanup.

Required scenarios:

- two groups in one view retain distinct content and exact scroll/selection;
- global/top-level/`activity.tabs` state neither writes nor hydrates over the
  selected group's authoritative content;
- the same group ID cannot cross two workspaces or views;
- switching while a write is pending cannot misfile or discard the capture;
- rejection, conflict, and timeout keep the outgoing surface selected unless
  the user explicitly confirms warned discard;
- view switch, panel close, workspace detach, and orderly teardown flush the
  outgoing key;
- first selection with no entry preserves established default/current content;
- invalid versions and unavailable resources fail inertly with warnings;
- two windows accept clean fanout and preserve dirty local conflict state;
- concurrent content and managed-placement mutations preserve both lanes;
- reconnect and restart restore acknowledged state without chat-state leakage;
- deletion commits when cleanup delivery fails, then retry removes only the
  exact entry;
- repeated cleanup delivery is harmless;
- Legacy groups create no worksurface state; and
- accepted SPEC-01/02, Provenance, Generic Host, chat, and view-state tests remain
  green.

Run at minimum:

```bash
cd fusion-studio-server && npm test -- --runInBand
cd fusion-studio-client && npx playwright test e2e/thread-worksurface-switching.spec.ts e2e/thread-worksurface-conflict.spec.ts e2e/thread-worksurface-restart.spec.ts
cd fusion-studio-client && npm run build
```

Perform an Electron smoke that changes content in two groups, switches views and
groups repeatedly, relaunches the app, verifies exact acknowledged restoration,
then deletes one group and confirms only its worksurface entry is removed.

## 12. Expected Changed Areas

Expected, not exclusive:

- workspace/view-state service, protocol registry, schemas, and handlers;
- renderer workspace/view state, navigation orchestration, and focused adapter
  registry/modules;
- existing `activity.tabs`/top-level view writers and hydrators touched by the
  adapter cutover;
- initial participating built-in view adapters;
- Thread Group deletion service plus a next-free migration for durable cleanup;
- focused server/client tests and fixtures; and
- Chat/View Wiki and code-standard routing updates required by the final shape.

No transcript schema, live routing, Generic Host rail, production Side Chat,
default view configuration, or generalized component persistence is changed.

## 13. Definition Of Done

SPEC-03 is complete only after all slices, targeted/full checks, restart and
Electron smoke, first clean builder-owned and orchestrator-owned reviews,
deviation accounting, supervisor review, documentation sync, and explicit owner
acceptance. SPEC-04 remains blocked until then.
