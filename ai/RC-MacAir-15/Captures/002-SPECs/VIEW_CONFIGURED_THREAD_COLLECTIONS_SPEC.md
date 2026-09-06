# SPEC — View-Configured Thread Collections

**Status:** Ready after `COMPOSABLE_THREADED_CHAT_SPEC.md` and
`SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md`
**Sequence:** After both prerequisites; independent of the later Move Chat to
Side Chat feature
**Depends on:** `COMPOSABLE_THREADED_CHAT_SPEC.md` and
`SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md`
**Source:** Vision Roadmap decisions D-084, D-085, D-099, D-100, D-102, D-124,
and D-169
**Scope:** Effective thread-display configuration, ranked collection metadata,
collection filtering, and shared thread-row menu adoption

---

## 0. Executive Contract

This SPEC does not add another project, folder, template, or CWD step to New
Chat. A thread is created inside an already registered view exactly as defined
by `COMPOSABLE_THREADED_CHAT_SPEC.md`. It neither depends on nor implements
`MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`.

This SPEC adds the layer around those threads:

1. extend each capsule's existing `content.json` with validated thread-display
   configuration;
2. make the thread rail read its New-action presentation and collection model
   from the effective view configuration;
3. persist lossless, ranked collection assignments on visible thread groups;
4. filter the rail through configured collections plus the synthetic Archive
   collection; and
5. replace the thread row's bespoke dropdown with the shared menu module,
   including a **Collections** right-opening submenu using the Material Symbol
   `sub_header`.

Folder mode is the default. It displays one effective collection but preserves
all ranked assignments. Tag mode is the advanced option and displays every
valid assignment. Archive is not a stored status: it is the derived state of a
thread with no valid assignment, and the Archive action clears all assignment
metadata.

---

## 1. Goals

1. Give every view one portable, inspectable source for thread-rail display
   behavior.
2. Let users rename, add, remove, and reorder configured collections without
   losing threads or coupling identity to display labels.
3. Preserve multiple collection memberships even when the view presents them
   as a single folder.
4. Keep the New Chat wire contract free of project/content folder IDs, paths,
   starter-file instructions, and config bodies.
5. Use one shared menu implementation for pointer, kebab, keyboard, submenu,
   pending, error, and dismissal behavior.
6. Use correct radio semantics for mutually exclusive folder projection and
   correct checkbox semantics for multi-select tags.
7. Keep SQLite authoritative for visible-thread collection metadata and the
   view capsule authoritative for collection definitions and presentation.

## 2. Non-Goals

- Create Project or Project Viewer provisioning.
- Project/content folder creation from New Chat.
- Starter files, templates, AGENTS.md copying, or CWD selection.
- Chat-surface extraction belongs to `COMPOSABLE_THREADED_CHAT_SPEC.md`;
  Side Chat creation belongs to `MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`. Neither is
  implemented here.
- Auto-Rename Chat Threads behavior.
- Transcript export.
- A GUI for editing view configuration.
- Config package export, cloning, or marketplace installation.
- Capsule relocation, canonical System paths, registry cutover, generic
  Fusion-route protection, or direct harness/OS filesystem enforcement. Those
  boundaries belong to `SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md` and later
  permissions work.
- Reusing the Office table-color policy as a thread-ranking module.

---

## 3. Current-System Facts

The implementation must begin from these current paths and behaviors:

- `fusion-studio-server/lib/views/index.js` discovers capsules, reads
  `manifest.md`, `content.json`, icon/layout state, resolves content roots, and
  exposes view definitions.
- Existing `content.json` files are version 1 and already contain a `chat`
  declaration such as `{ "type": "threaded", "position": "right" }`.
- The current Issues, Wiki, and Agents capsules instead declare the legacy
  `chat.type: "rolling-daily"`; current runtime propagates the label but has no
  complete rollover lifecycle, and this roadmap explicitly does not preserve
  that behavior.
- `normalizeV2ContentConfig()` currently discards unknown top-level behavior
  instead of producing a complete validated chat projection.
- `SidebarThreadList.tsx` currently renders a bespoke row dropdown and
  `useSidebar.ts` owns local `menuOpenId` dismissal state.
- The recently extracted shared menu lives under
  `fusion-studio-client/src/components/menu/`. It already supports nested
  right-opening submenus, radio items, async single-flight actions, live
  descriptor updates, focus restoration, viewport flipping, and the
  `{ kind: "stay" }` outcome.
- The shared menu does not yet have a checkbox descriptor or
  `menuitemcheckbox` rendering.
- `Sidebar.tsx` currently exposes an Active Threads/Archive selector, but the
  Archive side is only a placeholder.
- The first composable-chat SPEC introduces visible thread groups and makes the
  group—not an underlying chat session—the owner of rail metadata.

Do not create parallel loaders, a second menu framework, a client-side config
reader, or collection metadata on individual member sessions.

---

## 4. Consumed Foundation Contract

`SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md` exclusively owns capsule relocation,
the canonical `System/Views` resolver, migration readiness, registry generation,
and protected Fusion mutation routes. This SPEC begins only after that work is
accepted and reads/writes view configuration through its registry and narrow
versioned config service.

Collections never inspect the legacy root, move a capsule, coordinate registry
cutover, authorize a generic file route, or duplicate protected-path logic. A
missing/conflicted view arrives here as an authoritative registry diagnostic;
the collection domain preserves its groups and waits for the same immutable
view ID to become healthy.

---

## 5. Canonical View Thread Configuration

### 5.1 File and schema

Extend the existing capsule-root `content.json`; do not introduce a second
thread-display config file.

Version 2 adds the following optional fields under `chat`:

```json
{
  "version": 2,
  "dataSource": "Captures",
  "root": {
    "type": "workspace-relative",
    "path": "ai/${machine}/Captures"
  },
  "chat": {
    "type": "threaded",
    "position": "right",
    "newAction": {
      "label": "New Chat",
      "icon": "edit_square"
    },
    "collections": {
      "mode": "folders",
      "defaultId": "threads",
      "items": [
        {
          "id": "threads",
          "label": "Threads"
        }
      ]
    }
  }
}
```

The array order is display order. Item IDs are stable identity. Labels are
presentation and may change freely.

### 5.2 Defaults

For every existing chat-enabled view whose declaration is `threaded` or the
legacy `rolling-daily`, migration first canonicalizes `chat.type` to `threaded`
and then writes or resolves these defaults:

- `newAction.label = "New Chat"`;
- `newAction.icon = "edit_square"`;
- `collections.mode = "folders"`;
- `collections.defaultId = "threads"`; and
- one configured item `{ "id": "threads", "label": "Threads" }`.

`defaultId` is the server-resolved assignment for newly committed visible
thread groups. It may be `null`, in which case new groups intentionally begin
in Archive. It is never supplied by the New Chat client request.

`rolling-daily` has no retained rollover behavior. It is migration input only,
not an effective V2 enum value. The migration explicitly covers the current
Issues, Wiki, and Agents capsules and removes the stale client/server enum,
branches, fixtures, and tests once all bundled/default content is upgraded.
Views without chat do not receive a thread-collection UI merely because
defaults exist.

### 5.3 Validation

The validated loader must enforce:

- `version` is supported;
- effective `chat.type` is exactly `threaded`; post-migration
  `rolling-daily` is rejected with a visible repair diagnostic rather than
  silently inventing rollover behavior;
- `newAction.label` is a non-empty bounded string;
- `newAction.icon` is a bounded Material Symbol name;
- `collections.mode` is exactly `folders` or `tags`;
- `defaultId` is `null` or references a configured item;
- item IDs are non-empty, normalized, unique, and immutable once assignments
  use them;
- item labels are non-empty bounded strings;
- the reserved synthetic ID `archive` cannot appear in `items`; and
- unknown executable/script fields are rejected rather than ignored.

An empty `items` array is valid only with `defaultId: null`; every thread then
resolves into Archive.

The server produces one effective config projection. The renderer never parses
the file or supplies its own defaults. Invalid edited config remains inactive,
surfaces field-level diagnostics, and leaves the last-known-good effective
projection active. If no last-known-good projection exists, use the safe
threaded defaults above without executing unknown content.

Every effective projection includes an opaque `configRevision` derived by the
config service from the canonical validated source revision/hash. It changes
whenever effective New-action/collection behavior changes, remains stable for
the same effective bytes across restart, and accompanies config fan-out,
thread-rail state, and collection-menu commands. Invalid edits that leave the
last-known-good projection active do not invent a new effective revision.

The view/config service is the sole owner of that effective projection and its
last-known-good value. The last-known-good projection is an in-memory derived
cache keyed by `{workspaceId, viewId}` and records the source revision/hash that
produced it; a later invalid hash does not replace the valid entry. It is never
written back into `content.json`, view state, renderer state, or thread-group
metadata. It is discarded when the workspace detaches or the process restarts.
After restart, invalid source config therefore resolves to the documented safe
defaults until the canonical file validates again. Config watch/reload asks the
service to rebuild and replaces the cached projection only after validation.

### 5.4 Authority

Configuration is not authority. It can request presentation and collection
behavior but cannot grant permissions, authorize automation, create a thread,
or supply a folder path to New Chat. All reads and writes route through the
view/config service seam needed by the later protected-System implementation.

---

## 6. Collection Metadata

### 6.1 Ownership

The visible thread group owns collection membership. An underlying Main Chat
or Side Chat session does not own or duplicate it. These are user-facing names;
the prerequisite SPEC retains `primary` and `side-chat` only where they are
internal persistence, protocol, or projection terms.

SQLite is authoritative for assignments. `content.json` defines which
collection IDs are currently valid and how they are presented; it does not
store per-thread membership.

### 6.2 Persistence

Add `thread_group_collection_assignments`:

| Field | Contract |
|---|---|
| `group_id` | Owning visible thread group; cascade delete with the group. |
| `collection_id` | Stable configured collection ID. |
| `rank` | Non-negative server-issued precedence integer. |
| `assigned_at` | Wall-clock audit/display timestamp; never precedence. |
| `updated_at` | Timestamp of the latest promotion/toggle. |

Constraints and indexes:

- primary key `{group_id, collection_id}`;
- unique `{group_id, rank}`;
- index `{collection_id, group_id}` for filtered lists; and
- foreign key from `group_id` to `thread_groups` with cascade delete.

The same migration adds `thread_groups.collection_revision INTEGER NOT NULL
DEFAULT 0` and nullable `thread_groups.collection_initialized_at`. The timestamp
is an initialization marker, not precedence: null means the group's immutable
view was unavailable and default seeding has never run; non-null means seeding
was conclusively processed even when `defaultId` was null and no assignment row
was created. `collection_revision` is the server-owned monotonic compare-and-
swap version for collection mutations; ranks are precedence, not a revision substitute.
`collection_promote`, an effective `collection_remove`, and an effective
`collections_clear` increment it in the same transaction as their assignment
changes. A valid no-op returns the current projection and unchanged revision.
Backfill/default seeding establishes assignments, initialization marker, and
revision atomically.

The public thread-group shape may expose:

```json
{
  "collectionAssignments": [
    { "collectionId": "threads", "rank": 14 },
    { "collectionId": "research", "rank": 21 }
  ],
  "effectiveCollectionIds": ["research"]
}
```

Do not put this metadata in `threads.metadata` or copy it to every member
session.

### 6.3 Ranking

The server allocates rank transactionally. Promoting an existing assignment or
adding a new one gives it a rank strictly greater than every other assignment
for that group. Equal-rank ambiguity is invalid and repaired deterministically.

At safe-integer exhaustion, compact ranks for that group while preserving total
order, then allocate the next rank. Wall-clock timestamps never break ties.

Folder mode projects the highest-ranked assignment whose ID exists in the
current view config. Lower-ranked valid and dormant assignments remain stored.
Tag mode projects every stored assignment whose ID exists in the current config.

The Office Viewer table-color policy uses a similar newest-rank-wins idea, but
its implementation remains Office-specific. Thread ranking is a server-owned
domain service with transactional database concerns. Do not import or relocate
`officeTableColorPolicy.ts`. Extract a small generic rank helper only if the
implementation proves an identical pure contract and preserves both suites of
tests.

### 6.4 Dormant assignments

Removing an item from configuration does not delete matching assignment rows.
Those rows become dormant and do not create phantom dropdown/menu entries.

If no stored assignment matches a currently configured ID, the thread resolves
into Archive. Restoring the same stable ID makes the dormant assignment valid
again unless the user explicitly used Archive to clear all assignments.

### 6.5 Archive

Archive is synthetic and non-removable. It is not present in `content.json`, is
not an assignment row, and is not a group-level status flag.

The Archive action deletes every assignment row for the group in one
transaction. The group and every member chat remain intact. A group with no
valid configured assignments appears in Archive.

### 6.6 Existing and new groups

Backfill every non-Legacy group whose immutable view ID resolves through a
unique registry entry to that view service's effective `defaultId`, then set
`collection_initialized_at` in the same transaction. A null default inserts no
assignment but still marks initialization complete. Legacy groups without a
view receive no collection assignment and remain in the separate Legacy Threads
population.

“Effective” includes §5.3's safe threaded defaults. If source config is invalid
and no in-memory last-known-good projection survives restart, the unique view
remains available with visible repair diagnostics, existing uninitialized
groups initialize to the safe `threads` default, and New Chat may commit with
that same server projection. Invalid source never makes this path choose between
skip and fallback, and the renderer never invents the fallback.

A view-bound group whose capsule is missing or duplicate-ID conflicted is
preserved but skipped: create no assignment,
leave `collection_initialized_at` null, and keep the group unavailable with its
existing orphan/registry diagnostic. It is treated as derived Archive only in
bounded diagnostic projections; because its view is unavailable, it does not
appear in another view's Archive rail. Never guess a default from another
capsule or write a replacement view ID.

When the registry later resolves that exact immutable view ID uniquely, the collection
service reconciles only its groups with `collection_initialized_at IS NULL`,
using the now-effective default and setting the marker atomically. Repeated
registry events are idempotent. Groups already initialized—including groups the
user later archived or whose assignments became dormant—are never reseeded.

The public New Chat request, pending-intent object, and client payload do not
gain collection, path, config, or folder fields. After the first SPEC's group
creation service resolves the authoritative view, it seeds the configured
default assignment inside the same SQLite transaction as group creation. This
is an internal group-domain invariant, not a client-controlled creation step or
cross-store workflow. If `defaultId` is null, no row is inserted and the new
group resolves into Archive.

---

## 7. Effective Collection Projection

For a group and effective view config:

1. read stored assignments ordered by descending rank;
2. discard IDs absent from the effective config for projection only;
3. in folder mode, return the first valid ID or `archive` if none exists;
4. in tag mode, return every valid ID or `archive` if none exists; and
5. never persist `archive` as an assignment.

The selected rail collection is per-view navigation state, not per-thread
worksurface state. If the selected configured ID disappears, fall back to
Archive and persist that safe selection through the view-state service.

Its exact durable path is:

```ts
viewStates[viewId].activity.threadCollectionSelection = {
  schemaVersion: 1,
  selectedCollectionId: 'archive' // or one configured stable ID
}
```

`activity` is already a forced per-view namespace in the view-state writer, so
do not add a new top-level key or store this selection in workspace-shared
state. The view/config service validates the ID against the current effective
projection, treats malformed/missing state as the configured default (or
Archive), and persists Archive when a selected ID becomes unavailable. Two
views may select different collections without affecting each other.

The thread list query remains view-bound and adds one effective collection
filter. A thread in tag mode may therefore appear in more than one configured
grouping, while still producing only one row inside any selected grouping.

---

## 8. Server Commands and Fan-Out

Use the canonical `thread:action` command family. Do not add standalone
top-level WebSocket commands.

Required actions:

| Action | Behavior |
|---|---|
| `collection_promote` | Validate the configured ID, upsert it, and assign newest rank. |
| `collection_remove` | Remove one stored assignment. Used by tag-mode uncheck. |
| `collections_clear` | Remove every assignment. Implements Archive. |

Every action includes the common Composable Chat `requestId`, `threadGroupId`,
an expected collection revision, and the exact `expectedConfigRevision` from
the menu's effective projection. Promote/remove include `collectionId`.
The server derives workspace from the
connection and view binding from the authoritative group, verifies ownership,
resolves current config through the registry, and rejects reserved or unknown
IDs. `viewId` is not accepted as a redundant client assertion on a group action.

After same-`requestId` replay resolution but before any new mutation, the server
requires `expectedConfigRevision` to equal the current effective projection.
`collection_remove` additionally requires the authoritative current mode to be
`tags`; it is invalid in folder mode even when the collection ID and assignment
revision still exist. Mismatch returns `stale_config` with the current effective
projection/revision and changes no assignment, rank, or collection revision.

Successful mutation commits before fan-out and returns
`thread:action:completed` with the complete fresh assignment/effective
projection plus its revision. Validation, authority, persistence, or conflict
failure returns `thread:action:error`; a stale expected revision includes the
current projection without partial mutation. All mounted surfaces for that
group and all rails for its server-derived view receive the committed update.

Requester acknowledgement, each workspace-recipient delivery, and optional
post-commit UEB publication are mutually failure-isolated. A failed requester or
one failed recipient cannot stop the remaining delivery attempts or change the
commit. Clients that miss fan-out rehydrate authoritative collection state on
reconnect/init; delivery failure never replays the mutation.

The collection service records the common action-ledger result in the same
transaction as its assignment/revision change. Same-ID/same-payload retry after
a lost acknowledgement returns that stored projection and does not encounter a
false stale-revision conflict or allocate another rank. Different-payload reuse
returns `request_mismatch`. Completed/error responses echo `requestId`.

Config changes also trigger a fresh effective projection and `configRevision`
to every bound window. They do not rewrite assignment rows merely because IDs
became dormant. A delayed old-mode command is judged against authoritative
config at server receipt, never against the originating window's menu.

---

## 9. Thread-Rail Display Behavior

The renderer receives the effective view chat config from the server and uses
it for:

- the New button label and icon;
- the collection selector's labels and order;
- folder-versus-tag assignment behavior;
- the configured default indicator where relevant; and
- the synthetic Archive entry.

The default effective experience remains visually compatible with today's
rail: **New Chat**, `edit_square`, one **Threads** collection, and **Archive**.

Selecting a collection changes the view-bound rail query/filter. It does not
open, warm, move, or mutate a chat.

---

## 10. Shared Thread-Row Menu

### 10.1 Adopt the shared module

Replace the bespoke dropdown in `SidebarThreadList.tsx` and its local
`menuOpenId`/outside-click implementation with
`fusion-studio-client/src/components/menu/openMenuTree`.

The same descriptor builder and action controller must serve:

- right-click on the thread row using a pointer anchor; and
- the existing kebab button using an element anchor.

Do not retain a second thread-only menu DOM/CSS/keyboard system.

### 10.2 Collections submenu

Add this root descriptor:

```ts
{
  kind: 'submenu',
  id: 'thread-collections',
  label: 'Collections',
  icon: 'sub_header',
  items: collectionItems,
}
```

The shared module opens ordinary submenus to the right and flips them left near
the viewport edge. Preserve that behavior.

### 10.3 Folder mode

Configured collections render as `radio` descriptors with the highest-ranked
valid assignment checked. Archive renders as the checked radio only when the
group has no valid assignment.

Selecting a configured collection performs `collection_promote` and closes the
menu after acknowledgement. Selecting Archive performs `collections_clear` and
closes the menu. Lower-ranked assignment metadata remains intact when another
folder is selected.

### 10.4 Tag mode

Extend the shared menu with:

```ts
interface MenuCheckboxDescriptor extends MenuInteractiveDescriptorBase {
  kind: 'checkbox';
  checked: boolean;
  onSelect: (context: MenuActionContext) => MenuOutcome | Promise<MenuOutcome>;
}
```

Render it with `role="menuitemcheckbox"` and `aria-checked`. It uses the same
visual checkmark column as radio items but does not claim radio semantics.
This is a first-class shared-menu descriptor, not a thread-only row type. It
inherits the same stable ID, label, icon, secondary text, disabled state and
reason, accessible label, and tone contract as the existing action and radio
descriptors. Existing `heading` and `status` descriptors remain noninteractive
menu content; they are not substitutes for radio or checkbox choices.

Each valid configured collection is an independent checkbox:

- unchecked → `collection_promote`;
- checked → `collection_remove`; and
- successful actions update the descriptors and return `{ kind: "stay" }` so
  the user can make several selections.

If unchecking removes the row from the rail's currently selected grouping, or
if assigning from Archive removes it from the Archive filter, close the menu
after acknowledgement because its anchor row is leaving the list.

Archive appears after a separator as a distinct action that clears every
assignment and closes the menu. It is not one checkbox among the tags.

### 10.5 Interaction and accessibility

- Arrow Right opens Collections; Arrow Left returns to the root menu.
- Up/Down navigation follows shared menu behavior.
- Enter and Space activate radio and checkbox items.
- Checked state updates only from server acknowledgement.
- Pending items remain single-flight and expose `aria-busy`.
- Mutation errors keep the menu open when its anchor remains valid, restore the
  last committed check state, and surface one user-visible error.
- Escape, outside click, Tab, replacement, and unmount use the shared menu's
  existing focus/dismissal contract.

---

## 11. Failure and Recovery Semantics

1. Invalid config never becomes effective and never rewrites assignments.
2. An unavailable configured collection turns assignments dormant; it does not
   delete them.
3. A failed assignment mutation changes neither rank nor visible check state.
4. A stale mutation receives a conflict projection and may retry only from the
   refreshed state.
5. A missing or corrupt assignment row cannot hide a group; projection falls
   back to Archive.
6. Archive never deletes the thread group, member sessions, exchanges,
   transcript mirror, or worksurface state.
7. Restart reconstructs effective projection from SQLite assignments plus the
   current validated view config.
8. A missing/conflicted capsule leaves its bound groups untouched and
    uninitialized rather than failing the whole migration or borrowing another
    view's config. Recovery of the same immutable ID initializes each skipped
    group exactly once; already initialized/archive-cleared groups are not
    reseeded.

---

## 12. Dependency-Ordered Implementation Slices

### Slice 1 — Effective view thread presentation

- Add the version-2 `content.json.chat` validator and effective projection.
- Canonicalize every chat-enabled legacy `rolling-daily` config—including the
  bundled/current Issues, Wiki, and Agents capsules—to `threaded`, remove the
  stale enum/branches/tests, and upgrade all chat-enabled configs with default
  New-action and collection declarations.
- Deliver the effective projection and stable `configRevision` to the renderer
  and fan every valid change to all bound windows.
- Render the configured New label/icon and collection selector without changing
  New Chat's public request.
- Open a threaded view through the public shell and prove valid, invalid,
  live-edited, and post-restart config behavior uses only the config service's
  effective projection.

### Slice 2 — Durable folder-mode collections

- Add ranked assignment persistence, backfill, revisions, and server actions.
- Skip missing/conflicted-view groups without marking them initialized, and
  reconcile them exactly once when the same immutable view ID becomes healthy.
- Seed new groups from server-resolved `defaultId` in the existing group
  transaction without new client fields.
- Filter the rail by collection plus derived Archive.
- Persist the selected filter only at
  `activity.threadCollectionSelection`, preserving independent selections in
  two views across restart.
- Replace the bespoke thread menu with the shared menu and ship the
  **Collections**/`sub_header` radio submenu.
- Exercise promote and clear from the public row menu through
  `thread:action:completed`/`:error`, two-window fan-out, and restart/readback
  before proceeding. Every action proves both assignment revision and
  `expectedConfigRevision` validation.

### Slice 3 — Lossless tag mode

- Add shared checkbox descriptors and accessibility behavior.
- Implement multi-select promote/remove with keep-open updates.
- Prove tag→folder→tag mode changes preserve lower-ranked assignments and that
  folder selection only reranks.
- Delay a tag-mode `collection_remove` until folder mode becomes authoritative
  and prove `stale_config` leaves every membership intact.

### Slice 4 — Dormancy, Archive, and recovery

- Preserve assignments across config removal/restoration.
- Clear every assignment through Archive without deleting chat data.
- Cover config edits, live fan-out, stale revisions, restart, partial migration,
  rank compaction, and menu-anchor removal.
- Inject requester-send, individual-recipient, and optional UEB failures and
  prove remaining delivery attempts plus reconnect hydration still converge.

---

## 13. Verification Matrix

### Server and persistence

| Check | Required proof |
|---|---|
| Foundation consumption | Configuration resolves only through the accepted canonical registry/versioned config service. No legacy-root lookup, capsule move, migration coordinator, generic-path authorization, or protected-path logic enters this SPEC's diff. |
| Config defaults | Existing chat-enabled views resolve to threaded/New Chat/edit_square/folders/Threads; views without chat do not gain it. |
| Legacy chat type | Every bundled/workspace `rolling-daily` declaration migrates once to `threaded`; the stale enum/code/tests are removed, no rollover timer/grouping survives, and an unconverted post-migration value fails visibly instead of being skipped. |
| Config validation | Duplicate/reserved IDs, invalid modes/defaults/icons/labels, and executable fields fail safely with last-known-good projection. Effective projections carry stable `configRevision`; valid changes update/fan it, while invalid edits retaining last-known-good do not invent a revision. After restart with no cache, a uniquely registered view uses the server's safe threaded defaults, surfaces diagnostics, initializes pending groups to `threads`, and gives New Chat the identical effective default. |
| Selected filter state | `activity.threadCollectionSelection` routes to the owning view capsule, validates against the effective config, falls back durably to Archive when needed, and restores two different view selections independently after restart. No workspace-shared selection key exists. |
| Backfill | Every healthy view-bound group processes the owning view's default once and records `collection_initialized_at`, including null-default/Archive results. Missing/conflicted-view groups remain preserved, without an assignment, and uninitialized; recovery of the same immutable ID seeds them once. Legacy groups remain separate, and archived/already-initialized groups are never reseeded. |
| Ranking | Promote is newest-wins, folder projection selects one, tag projection selects all, and compaction preserves order. |
| Dormancy | Removing a configured ID hides but does not delete its assignments; restoring the same ID restores membership. |
| Archive | Clear removes all assignments and no chat, group, exchange, mirror, or worksurface data. |
| Authorization | Wrong workspace/group, unresolved authoritative group view, unknown ID, reserved Archive ID, stale assignment revision, and stale config revision fail without mutation. `collection_remove` also fails unless authoritative current mode is `tags`; redundant client `viewId` is rejected. |
| Request correlation | Completion/error echoes `requestId`; a dropped acknowledgement and same-ID retry returns the stored result without changing rank/revision, while different-payload reuse fails. Open a tag menu in window A, switch config to folders in B while delaying fan-out, then submit A's old remove: server returns `stale_config` and tag→folder→tag retains every assignment. |
| New Chat boundary | No new client payload field or folder/config input is accepted; default assignment comes from server-resolved view config. |

### Shared menu

Extend `shared-menu-component.spec.ts` to prove:

- checkbox descriptors render `menuitemcheckbox` and `aria-checked`;
- radio and checkbox checked states can update without losing submenu ancestry
  or focus;
- `{ kind: "stay" }` keeps multi-select open;
- async checkbox actions remain single-flight;
- keyboard activation works with Enter and Space;
- rejection preserves committed state and focus; and
- existing menu consumers retain their behavior.

### Thread rail

Prove through component/Electron coverage:

1. right-click and kebab open the same shared menu;
2. **Collections** uses `sub_header` and opens to the right or flips safely;
3. folder mode has one checked radio and reranks without deleting metadata;
4. tag mode has independent checkboxes and supports several selections;
5. Archive clears all assignments and moves the row to Archive;
6. a row removed from the active filter closes its anchored menu safely;
7. config label/order changes update the selector and menu without changing
   stable assignments;
8. restart restores collection filtering and checked state; and
9. long labels, empty configured collections, keyboard-only use, and narrow
   viewport positioning remain usable.

Run a stale-symbol sweep proving the bespoke thread-row menu DOM, local
`menuOpenId` dismissal path, and any superseded thread-only menu CSS are gone
after both right-click and kebab use the shared descriptor tree.

---

## 14. Definition of Done

This SPEC is complete only when:

1. the accepted System View Capsule foundation supplies the only registry and
   versioned config-write boundary, with no relocation/security implementation
   duplicated here;
2. every chat-enabled view has canonical `chat.type: "threaded"` plus a valid
   versioned New-action/collection config, with `rolling-daily` removed from
   active enums/code/tests, and
   the renderer consumes only the server's effective projection;
3. visible thread groups own durable ranked collection assignments and one
   monotonic collection revision in SQLite;
4. folder mode defaults to the highest-ranked valid assignment while retaining
   all metadata;
5. tag mode exposes all valid assignments with correct checkbox semantics;
6. Archive is synthetic, non-removable, and implemented by clearing all
   assignments rather than setting archive status;
7. config removal/restoration makes assignments dormant/effective without data
   loss;
8. thread right-click and kebab menus both use the shared menu module;
9. **Collections** uses the `sub_header` icon and a shared right-opening
    submenu;
10. the public New Chat payload and project/content file behavior remain
    unchanged;
11. requester acknowledgement, per-window fan-out, reconnect hydration, and
    optional UEB delivery remain failure-isolated after commit;
12. automated server, shared-menu, renderer, restart, migration, and
    accessibility checks pass; and
13. a missing/conflicted view cannot fail collection migration or borrow another
    default: its groups remain uninitialized and unavailable, then the same
    immutable ID's recovery seeds them exactly once without reseeding any
    previously initialized/archive-cleared group.

---

## 15. Deferred Follow-Ups

- GUI editing for `content.json` thread settings.
- Enforceable direct harness/OS protection for `System/Views`, broader System
  roots, and additional privileged editor surfaces.
- Project Viewer creation and provisioning.
- Import/export and clone flows.
- Auto-Rename Chat Threads configuration.
- Transcript destinations and retention.
- Collection colors, icons, nested collections, smart collections, or rules.
- Bulk assignment and multi-thread selection.
