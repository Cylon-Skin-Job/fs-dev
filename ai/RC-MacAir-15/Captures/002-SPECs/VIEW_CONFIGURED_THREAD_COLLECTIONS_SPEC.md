# SPEC — View-Configured Thread Collections

**Status:** Ready after `COMPOSABLE_THREADED_CHAT_SPEC.md`
**Sequence:** Second composable-chat SPEC
**Depends on:** `COMPOSABLE_THREADED_CHAT_SPEC.md`
**Source:** Vision Roadmap decisions D-084, D-085, D-095 through D-101, and D-102
**Scope:** View-capsule relocation, effective thread-display configuration, ranked collection metadata, collection filtering, and shared thread-row menu adoption

---

## 0. Executive Contract

This SPEC does not add another project, folder, template, or CWD step to New
Chat. A thread is created inside an already registered view exactly as defined
by the first composable-chat SPEC.

This SPEC adds the layer around those threads:

1. relocate view capsules from `ai/<machine>/Views/` to
   `ai/<machine>/System/Views/` through the central view registry;
2. extend each capsule's existing `content.json` with validated thread-display
   configuration;
3. make the thread rail read its New-action presentation and collection model
   from the effective view configuration;
4. persist lossless, ranked collection assignments on visible thread groups;
5. filter the rail through configured collections plus the synthetic Archive
   collection; and
6. replace the thread row's bespoke dropdown with the shared menu module,
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
2. Move view definitions beneath the machine-scoped System tree without moving
   or rewriting their declared content roots.
3. Let users rename, add, remove, and reorder configured collections without
   losing threads or coupling identity to display labels.
4. Preserve multiple collection memberships even when the view presents them
   as a single folder.
5. Keep the New Chat wire contract free of project/content folder IDs, paths,
   starter-file instructions, and config bodies.
6. Use one shared menu implementation for pointer, kebab, keyboard, submenu,
   pending, error, and dismissal behavior.
7. Use correct radio semantics for mutually exclusive folder projection and
   correct checkbox semantics for multi-select tags.
8. Keep SQLite authoritative for visible-thread collection metadata and the
   view capsule authoritative for collection definitions and presentation.

## 2. Non-Goals

- Create Project or Project Viewer provisioning.
- Project/content folder creation from New Chat.
- Starter files, templates, AGENTS.md copying, or CWD selection.
- Side-chat creation or chat-surface extraction; those belong to the first
  SPEC.
- Auto-Rename Chat Threads behavior.
- Transcript export.
- A GUI for editing view configuration.
- Config package export, cloning, or marketplace installation.
- Full protected-System enforcement against every harness/file path. This SPEC
  centralizes access behind services but does not claim that relocation alone
  is a security boundary.
- Reusing the Office table-color policy as a thread-ranking module.

---

## 3. Current-System Facts

The implementation must begin from these current paths and behaviors:

- `fusion-studio-server/lib/workspace/ai-paths.js` currently resolves the view
  root as `ai/<machine>/Views/`.
- `fusion-studio-server/lib/views/index.js` discovers capsules, reads
  `manifest.md`, `content.json`, icon/layout state, resolves content roots, and
  exposes view definitions.
- Existing `content.json` files are version 1 and already contain a `chat`
  declaration such as `{ "type": "threaded", "position": "right" }`.
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

## 4. View-Capsule Relocation

### 4.1 Canonical path

After this SPEC, the only canonical capsule root is:

```text
ai/<machine>/System/Views/
```

Add one canonical resolver in `workspace/ai-paths.js` and route view discovery,
content resolution, state, styles, CLI display overrides, registry updates,
reorder, restore, workspace bootstrap, and default scaffolding through it.
Consumers must not concatenate `Views` or `System/Views` themselves.

### 4.2 Content-root independence

Moving the capsule never moves its content. Existing `content.json.root`
declarations continue to resolve independently, including:

- `ai/${machine}/Wiki` or another machine-relative content folder;
- workspace-root `Wiki/`, `docs/wiki`, or another Git-tracked path;
- workspace/project root;
- view-relative content;
- selected-folder, absolute, SQLite, and none declarations already supported
  by the resolver.

The migration must not rewrite a valid content-root declaration merely because
the capsule moved.

### 4.3 Migration behavior

The migration is server-owned, preflighted, lossless, resumable, and
idempotent.

For every attached workspace and bundled/default workspace material:

1. inventory both old and new roots by immutable `metadata.view-id`;
2. reject duplicate IDs, ambiguous folders, and target collisions before
   moving an affected capsule;
3. move the complete capsule, including manifest, content config, styles,
   per-view config/state, and unknown user files;
4. preserve the folder name and numeric order prefix;
5. record enough migration state to resume after a partial process failure;
6. verify the moved capsule through the canonical loader before marking it
   complete; and
7. leave an empty legacy root harmless. Do not create a permanent two-root
   read path after successful migration.

If the same immutable view ID exists in both roots, stop and report a visible
repair diagnostic. Never merge, overwrite, or select one silently.

### 4.4 Identity

`metadata.view-id` remains durable identity. A folder such as
`001-project-viewer` is ordering/presentation metadata, not the binding key.
Renaming or reordering a capsule after relocation must preserve its threads,
collection metadata, content root, config, styles, and saved worksurfaces.

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

For every existing threaded view, migration writes or resolves these defaults:

- `newAction.label = "New Chat"`;
- `newAction.icon = "edit_square"`;
- `collections.mode = "folders"`;
- `collections.defaultId = "threads"`; and
- one configured item `{ "id": "threads", "label": "Threads" }`.

`defaultId` is the server-resolved assignment for newly committed visible
thread groups. It may be `null`, in which case new groups intentionally begin
in Archive. It is never supplied by the New Chat client request.

Views without threaded chat do not receive a thread-collection UI merely
because defaults exist.

### 5.3 Validation

The validated loader must enforce:

- `version` is supported;
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

### 5.4 Authority

Configuration is not authority. It can request presentation and collection
behavior but cannot grant permissions, authorize automation, create a thread,
or supply a folder path to New Chat. All reads and writes route through the
view/config service seam needed by the later protected-System implementation.

---

## 6. Collection Metadata

### 6.1 Ownership

The visible thread group owns collection membership. An underlying primary or
side-chat session does not own or duplicate it.

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

Backfill every non-Legacy group to its owning view's server-resolved
`defaultId`. Legacy groups without a view receive no collection assignment and
remain in the separate Legacy Threads population.

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

Every action includes `threadGroupId`, `viewId`, and an expected collection
revision. Promote/remove include `collectionId`. The server derives workspace
from the connection, verifies group/view ownership, resolves current config,
and rejects reserved or unknown IDs.

Successful mutation commits before fan-out and returns the complete fresh
assignment/effective projection plus a new revision. All mounted surfaces for
that group and all rails for that view receive the committed update. A stale
expected revision returns a conflict and current projection without partial
mutation.

Config changes also trigger a fresh effective projection. They do not rewrite
assignment rows merely because IDs became dormant.

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
interface MenuCheckboxDescriptor {
  kind: 'checkbox';
  id: string;
  label: string;
  checked: boolean;
  onSelect: (context: MenuActionContext) => MenuOutcome | Promise<MenuOutcome>;
}
```

Render it with `role="menuitemcheckbox"` and `aria-checked`. It uses the same
visual checkmark column as radio items but does not claim radio semantics.

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

1. A failed capsule migration never deletes the only complete copy.
2. Old/new duplicate immutable IDs stop migration and surface repair details.
3. Invalid config never becomes effective and never rewrites assignments.
4. An unavailable configured collection turns assignments dormant; it does not
   delete them.
5. A failed assignment mutation changes neither rank nor visible check state.
6. A stale mutation receives a conflict projection and may retry only from the
   refreshed state.
7. A missing or corrupt assignment row cannot hide a group; projection falls
   back to Archive.
8. Archive never deletes the thread group, member sessions, exchanges,
   transcript mirror, or worksurface state.
9. Restart reconstructs effective projection from SQLite assignments plus the
   current validated view config.

---

## 12. Dependency-Ordered Implementation Slices

### Slice 1 — Relocated capsules with unchanged content

- Add the canonical System/Views resolver and idempotent migration.
- Route every view consumer through the resolver.
- Move current workspace/default capsules without losing unknown files or
  state.
- Prove all built-in views, styles, state, and independently rooted content
  reopen after restart.

### Slice 2 — Effective view thread presentation

- Add the version-2 `content.json.chat` validator and effective projection.
- Upgrade existing threaded view configs with default New-action and collection
  declarations.
- Deliver the effective projection to the renderer.
- Render the configured New label/icon and collection selector without changing
  New Chat's public request.

### Slice 3 — Durable folder-mode collections

- Add ranked assignment persistence, backfill, revisions, and server actions.
- Seed new groups from server-resolved `defaultId` in the existing group
  transaction without new client fields.
- Filter the rail by collection plus derived Archive.
- Replace the bespoke thread menu with the shared menu and ship the
  **Collections**/`sub_header` radio submenu.

### Slice 4 — Lossless tag mode

- Add shared checkbox descriptors and accessibility behavior.
- Implement multi-select promote/remove with keep-open updates.
- Prove tag→folder→tag mode changes preserve lower-ranked assignments and that
  folder selection only reranks.

### Slice 5 — Dormancy, Archive, and recovery

- Preserve assignments across config removal/restoration.
- Clear every assignment through Archive without deleting chat data.
- Cover config edits, live fan-out, stale revisions, restart, partial migration,
  rank compaction, and menu-anchor removal.

---

## 13. Verification Matrix

### Server and persistence

| Check | Required proof |
|---|---|
| Capsule migration | Old-only, already-migrated, partial, collision, and duplicate-ID workspaces behave deterministically and losslessly. |
| Content roots | Machine-relative, workspace-relative, project-root, view-relative, selected-folder, absolute, SQLite, and none behavior does not change merely because the capsule moved. |
| Config defaults | Existing threaded views resolve to New Chat/edit_square/folders/Threads; non-threaded views do not gain chat. |
| Config validation | Duplicate/reserved IDs, invalid modes/defaults/icons/labels, and executable fields fail safely with last-known-good projection. |
| Backfill | Every view-bound group receives the owning view's default assignment once; Legacy groups remain separate. |
| Ranking | Promote is newest-wins, folder projection selects one, tag projection selects all, and compaction preserves order. |
| Dormancy | Removing a configured ID hides but does not delete its assignments; restoring the same ID restores membership. |
| Archive | Clear removes all assignments and no chat, group, exchange, mirror, or worksurface data. |
| Authorization | Wrong workspace/view/group, unknown ID, reserved Archive ID, and stale revision fail without mutation. |
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

---

## 14. Definition of Done

This SPEC is complete only when:

1. all active view capsules load exclusively from `System/Views/` through one
   canonical resolver;
2. capsule relocation is idempotent, lossless, and independent of content-root
   location;
3. every threaded view has a valid versioned New-action/collection config and
   the renderer consumes only the server's effective projection;
4. visible thread groups own durable ranked collection assignments in SQLite;
5. folder mode defaults to the highest-ranked valid assignment while retaining
   all metadata;
6. tag mode exposes all valid assignments with correct checkbox semantics;
7. Archive is synthetic, non-removable, and implemented by clearing all
   assignments rather than setting archive status;
8. config removal/restoration makes assignments dormant/effective without data
   loss;
9. thread right-click and kebab menus both use the shared menu module;
10. **Collections** uses the `sub_header` icon and a shared right-opening
    submenu;
11. the public New Chat payload and project/content file behavior remain
    unchanged; and
12. automated server, shared-menu, renderer, restart, migration, and
    accessibility checks pass.

---

## 15. Deferred Follow-Ups

- GUI editing for `content.json` thread settings.
- Full protected-System write enforcement and user-presence authorization.
- Project Viewer creation and provisioning.
- Import/export and clone flows.
- Auto-Rename Chat Threads configuration.
- Transcript destinations and retention.
- Collection colors, icons, nested collections, smart collections, or rules.
- Bulk assignment and multi-thread selection.
