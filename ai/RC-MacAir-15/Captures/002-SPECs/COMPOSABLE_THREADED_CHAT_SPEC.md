# Composable Threaded Chat and Move Chat to Side Chat — SPEC

**Date:** 2026-09-02
**Status:** Implementation-ready — owner behavior resolved; no open product decisions.
**Owner:** Fusion Studio chat, workspace shell, and view infrastructure.
**Source:** `../022-Vision_Roadmap/` decisions D-078 through D-101.
**Depends on:** The shell-owned content-tab contract in `UNIVERSAL_VIEW_TAB_BAR_SPEC.md`.
**Supersedes:** The floating/sticky/minimized presentation in `../999-Archive/SECONDARY_CHAT_SPEC.md` and the retired OpenCode context-cloning path.
**Preserves:** The server-owned chat lifecycle documented in `ai/<machine>/Wiki/007-Chat_System/`.

---

## 0. Clean-Session Implementation Brief

This SPEC delivers one bounded product capability: **threaded chat as a reusable
view module, with a hidden advanced action that moves the current chat into a
content tab and creates an empty new primary chat in the same visible thread.**

The normal user experience remains simple:

```text
Threads rail | Primary chat | Content worksurface
```

A view may independently show or hide the rail, chat, and content. A side-chat
tab mounts the same chat module centered in the content area, without placing a
second Threads rail next to it.

The user-visible word **thread** refers to the stable umbrella representing one
body of work. Internally, that umbrella can contain multiple independent chat
sessions. Normally it contains exactly one. The additional structure becomes
visible only when the user chooses **Move Chat to Side Chat**.

That action has one exact meaning:

```text
Before
  Visible Thread G
  └── Chat A (primary)

After
  Visible Thread G
  ├── Chat B (new, empty, primary)
  └── Chat A (unchanged, shown in a centered content tab)
```

The action does not copy, summarize, inherit, or inject Chat A's context into
Chat B. A future explicit **Send to Chat** action with resume instructions may
ask an agent or helper to read Chat A and prepare a bounded handoff. That
workflow is not part of this SPEC.

Implementation must preserve these current chat invariants:

- the underlying chat-session ID remains the live-stream routing key;
- passive browsing hydrates without warming or spawning a harness;
- assistant activation is distinct from passive browsing;
- the server owns prompt acceptance and emits `message:sent` before the client
  commits the user bubble;
- active in-memory turns overlay SQLite history when revisited;
- Stop is server-owned and persists interrupted partial turns; and
- exchanges and Markdown compatibility files remain attached to the underlying
  chat session, not to the visible umbrella.

Do not implement Routines, Agent Profiles, Plugins, automatic naming, transcript
export, configurable launch recipes, folder/tag collections, or automatic
resume as part of this work. Fork is retired, not deferred: remove its product
controls and OpenCode path rather than carrying it forward.

---

## 1. Problem Statement

Fusion Studio currently treats workspace chat as shell-global state. The
renderer stores a workspace-wide thread list and current thread, several chat
runtime values remain global, and the server intentionally forces all rows to
`scope='project'` with `view_id=NULL`. `ChatArea` can point at a second thread,
but it infers a special secondary presentation from `threadIdOverride` and the
legacy Secondary Chat feature wraps it in a separate popup/sticky shell.

That model cannot safely support the intended product:

1. Each view needs its own visible thread population and selected thread.
2. Selecting a visible thread needs to restore that thread's content
   worksurface.
3. The same chat UI must mount as the primary chat column or inside a content
   tab without duplicating behavior.
4. Multiple mounted chats must stream, stop, warm, draft, and report usage
   independently.
5. A user must be able to move the current chat into a side-chat tab and begin
   with a completely empty primary chat while keeping one visible thread row.
6. View-folder renames must not sever thread bindings or view-owned state.

The current filesystem model also mixes view identity with directory naming.
Most discovery code reads `metadata.view-id` from `manifest.md`, but several
state and CLI resolvers still locate a view through exact/suffix directory-name
matching. Folder reordering also reconstructs names from the view ID. A folder
rename is therefore not yet safe even though the manifest already contains the
right identity field.

---

## 2. Owner-Approved Product Contract

The following rules are authoritative. Builders must not reinterpret them.

| # | Rule |
|---|------|
| B1 | Chat, Threads rail, and content worksurface are independent shell surfaces. A view may show all three, chat+content, Threads+content, content only, or another declared combination. |
| B2 | The visible Threads rail is scoped to the active workspace and immutable view ID. Selecting a row selects a visible thread umbrella, not an arbitrary underlying chat session. |
| B3 | A visible thread normally contains one underlying chat session. The umbrella is deliberately invisible as a separate UI layer. |
| B4 | A visible thread owns its display name, view binding, ordering metadata, membership, and primary-role history. Its owning view capsule stores that thread's content-worksurface snapshot. An underlying chat session owns its transcript, exchanges, harness identity/configuration, runtime, usage, and composer state. |
| B5 | The selected visible thread renders its current primary chat session in the ordinary chat position. |
| B6 | **Move Chat to Side Chat** moves the current primary chat into a content tab and immediately creates a new, durable, cold, empty primary chat session inside the same visible thread. |
| B7 | Move Chat to Side Chat never copies messages, provider session state, summaries, prompts, or hidden context into the new primary. Fresh means fresh. |
| B8 | The old chat remains unchanged and interactive in its side-chat tab. Closing that tab does not delete or archive the chat session. |
| B9 | A side-chat tab mounts the same reusable chat module, centered in the content surface. It never mounts a persistent Threads rail beside itself. |
| B10 | The centered side chat retains the shared chat header, including the current list/menu button and its menu behavior. It is not a reduced or bespoke chat UI. |
| B11 | The visible thread retains one current primary at all times after creation. Every primary change is recorded append-only; current primary is the newest committed transition. |
| B12 | The visible thread umbrella is the parent. Its chat sessions are peer members. Do not create chat-to-chat parent, child, sibling-role, or Fork relationships; chronology comes from immutable membership order and primary-change history. |
| B13 | The visible thread remains bound to one view. Move Chat to Side Chat changes only the primary session and content tabs; it does not move the umbrella to another view. |
| B14 | Only content-worksurface state is restored per visible thread. Shell chrome, chat transcript state, and whether the Threads rail/chat column are exposed are not embedded in the worksurface snapshot. |
| B15 | An assigned folder is a worksurface starting context, not a filesystem, permission, or reasoning boundary. |
| B16 | Every view capsule has an immutable manifest-owned ID. Folder name, numeric order prefix, and display name are presentation and may change without affecting thread ownership. |
| B17 | Existing workspace-wide threads are preserved without guessed ownership in a workspace-level **Legacy Threads** population until explicitly reassigned by a future flow. |
| B18 | The legacy floating, sticky, and minimized Secondary Chat UI is removed. Side chats exist as content tabs only. |
| B19 | Fork is removed from Fusion's UI, client actions, WebSocket protocol, server services, OpenCode invocation, tests, roadmaps, and active plans. **Send to Chat** is the explicit, simpler mechanism for bringing prior material into another chat. |
| B20 | This SPEC does not move view capsules. It makes the central registry/service the only owner of their physical location so the dependent View-Configured Thread Collections SPEC can migrate them from `ai/<machine>/Views/` to `ai/<machine>/System/Views/` without changing thread identity or consumers. |
| B21 | The future structural move must preserve the separation between a capsule and its declared content root and must not treat filesystem placement alone as a security boundary. This SPEC must not create direct-path dependencies or generic harness write routes that the protected-System follow-up would need to preserve. |
| B22 | New visible-thread creation is a server-owned mutation accepted only from an authorized user action or a separately user-authorized automation. View configuration, agent output, or content-root files cannot grant that authority. |
| B23 | View configuration remains inspectable and portable. Future GUI editors and direct user JSON editing must operate on the same canonical schema and validated Fusion-owned write service rather than create separate sources of truth. |
| B24 | Any future clone/import path remints instance identity and copies only portable declarations. It does not copy secrets, granted permissions, consent records, active sessions, thread history, or ordinary runtime/view state; requested capabilities require fresh consent. This is a compatibility constraint, not added clone UI scope. |
| B25 | Future folder/tag organization is view-configured. Thread metadata always retains multiple stable, ranked collection-ID assignments. `mode: "folders"` is the default and projects only the highest-ranked valid assignment; `mode: "tags"` projects every valid assignment. Selecting another folder raises that assignment's rank without deleting the others. Fusion always injects a non-removable **Archive** collection; its button clears all assignments, and any thread with no currently valid assignment resolves there without being deleted. This is a forward-compatibility constraint, not collection-UI scope for this SPEC. |
| B26 | Project creation and thread creation are separate operations. A user creates a Project Viewer in side navigation once; that view owns the project content-root/workspace binding and may supply view-level instructions or a CWD override. New Chat inside it creates only a visible thread group and initial chat session using the already-resolved view context. It never creates a project folder, starter documents, or a new view, and never accepts a client-supplied folder ID/path as part of thread creation. Existing chat transcript-mirror persistence remains unchanged. |

### 2.1 Normal and advanced presentation

Normal use stays one row to one apparent conversation:

```text
Threads rail
└── Release Planning          Primary: Chat A
```

After using Move Chat to Side Chat twice, the rail still shows one row:

```text
Threads rail
└── Release Planning          Primary: Chat C

Content tabs owned by Release Planning
├── Chat 1                    Session A
└── Chat 2                    Session B
```

Do not add an expandable family tree, nested session rows, or a second rail.

---

## 3. Canonical Terms and Identities

### 3.1 View capsule

A folder currently under `ai/<machine>/Views/` containing `manifest.md`,
`content.json`, state, and styles. Consumers resolve it through the central
registry rather than depending on that physical path. The dependent
View-Configured Thread Collections SPEC moves capsules under
`ai/<machine>/System/Views/`. A capsule's declared content root remains a
separate location and need not live under `System` or even under `ai/`.

### 3.2 View ID

The immutable value in `manifest.md` at `metadata.view-id`. It is unique within
one workspace and qualified everywhere by `workspaceId`.

Existing human-readable values such as `capture-viewer` are grandfathered as
valid stable IDs. Do not rewrite them merely to make them opaque. Newly
duplicated or installed instances must receive a newly generated ID. The
`metadata.view-type` field identifies the renderer/capability kind and may be
shared by multiple view instances.

### 3.3 Visible thread / thread group

The stable user-visible umbrella shown as one row in a view's Threads rail.
User-facing copy continues to say **thread**. Code and storage use
`threadGroupId` where the distinction matters.

### 3.4 Chat session / session thread

One independent transcript and harness runtime. This is the entity currently
stored in the `threads` and `exchanges` tables and routed by `threadId`.

Do not perform a big-bang rename of existing transport fields. Existing
`threadId` remains the session routing key. New group-aware payloads add
`threadGroupId` explicitly.

### 3.5 Surface ID

An identifier for one mounted `ChatSurface`. It prevents transient header,
menu, focus, request/response, and DOM state from colliding when two sessions
from the same view are rendered simultaneously. It is not durable identity and
is never used to route live model output.

### 3.6 Membership chronology

Sessions are peers under the visible thread umbrella. Their stable member
ordinal records creation order. Primary-change events record which peer was
treated as primary at each point. No session is the parent of another, and no
membership field implies inherited context.

---

## 4. Target Composition

### 4.1 Components

| Component | Responsibility |
|---|---|
| `ChatSurface` | Render exactly one explicit chat session and emit explicit callbacks for shared header/menu, message list, composer, attachments, usage, warm/send/stop behavior. No thread-list or routing ownership. |
| `ThreadRail` | List/create/select visible thread groups for one explicit `{workspaceId, viewId}` context. No transcript rendering. |
| `ThreadedChat` | Convenience composition of `ThreadRail + ChatSurface` for ordinary views. It contains no independent persistence or routing rules. |
| `SideChatTab` | Content-tab adapter that centers `ChatSurface` for one explicit member session. It never renders `ThreadRail`. |
| `WorksurfaceAdapter` | View-owned capture, validation, migration, and restore of opaque content state for a selected thread group. |

`ChatSurface` is the portable presentation boundary. It receives explicit data
and callbacks and does not read app-global stores, call WebSocket code, or own
routing. A connected host/controller hook resolves store state and actions for
the exact `{workspaceId, viewId, threadGroupId, threadId, surfaceId}` tuple and
passes them into `ChatSurface`. `ThreadedChat` and `SideChatTab` are connected
composition hosts, not alternate chat implementations.

### 4.2 Mounting matrix

| Host presentation | ThreadRail | ChatSurface | Content |
|---|---:|---:|---:|
| Standard view | yes | primary session | yes |
| Threads hidden | no | primary session | yes |
| Chat hidden | yes | no | yes |
| Full-screen content | no | no | yes |
| Side-chat content tab | no local rail | explicit member session, centered | the tab itself |

The outer view may still show or hide its normal Threads rail. A side-chat tab
must never inject another persistent rail into its own content.

### 4.3 Required `ChatSurface` contract

The precise TypeScript spelling may vary, but the boundary must carry these
concepts explicitly:

```ts
type ChatSurfaceProps = {
  surfaceId: string;
  workspaceId: string;
  viewId: string;
  threadGroupId: string;
  threadId: string; // exact underlying session
  host: 'primary' | 'side-tab';
  chat: ChatSurfaceModel;
  actions: ChatSurfaceActions;
  onToggleThreads: () => void;
};
```

Prohibited dependencies:

- deriving the session from one global `currentThreadId`;
- treating `threadIdOverride` as a presentation mode;
- hiding the shared header merely because a non-primary session is mounted;
- keying menus or DOM IDs only by panel/view ID; or
- reading global usage/readiness values that can belong to another session.
- importing the workspace store, WebSocket client, controllers, or persistence
  services directly into the portable surface.

`ChatArea` may be evolved into `ChatSurface` rather than replaced wholesale.
Preserve its existing MessageList, composer, attachment, diagnostic, menu, and
accessibility behavior.

---

## 5. View-Capsule Identity and Rename Safety

### 5.1 Manifest is authoritative

Current manifest shape remains valid:

```yaml
---
name: Captures
metadata:
  view-id: capture-viewer
  view-type: captures
---
```

Rules:

1. `metadata.view-id` is immutable after a view instance is created.
2. `name` is a mutable display label.
3. `metadata.view-type` selects the implementation/type and is not instance
   identity.
4. The directory name and its numeric prefix are mutable location/order data.
5. Moving or renaming a directory preserves `view-id`.
6. Duplicating/installing another instance mints a new `view-id` while retaining
   the intended `view-type`.
7. Manual copies that create duplicate IDs inside one workspace are reported as
   conflicts; Fusion never silently chooses the first folder or silently
   rewrites identity.
8. The same `view-id` may exist in different workspaces because the durable key
   is `{workspaceId, viewId}`.

### 5.2 One central registry

Create one server-owned view-capsule registry/resolver that scans manifests and
returns at least:

```ts
type ViewCapsuleRecord = {
  workspaceId: string;
  viewId: string;
  viewType: string;
  label: string;
  order: number;
  folderName: string;
  absolutePath: string;
};
```

All consumers must resolve folders through this registry. Replace duplicated
exact/suffix lookup logic in at least:

- `fusion-studio-server/lib/views/index.js`;
- `fusion-studio-server/lib/views/workspace-registry-writer.js`;
- `fusion-studio-server/lib/view-state/resolver.js`;
- `fusion-studio-server/lib/view-state/defaults.js`; and
- `fusion-studio-server/lib/cli-config/loader.js`.

Do not add another suffix-matching helper elsewhere.

### 5.3 Legacy and reorder behavior

- A legacy capsule lacking `metadata.view-id` receives one once through an
  atomic frontmatter-preserving migration. Until migration completes, the
  existing suffix remains a read-only fallback.
- Reordering changes only the numeric prefix. It preserves the folder's current
  suffix/name instead of rebuilding that suffix from `view-id`.
- Rename/reorder tests must cover view loading, content roots, CLI overrides,
  styles, view state, and bound thread groups after restart.

Filesystem inode/file IDs may help a watcher correlate a live rename, but they
are never durable identity and are never persisted as the binding key.

### 5.4 Relocation seam and content-root independence

This SPEC leaves capsules under `ai/<machine>/Views/` while making the central
registry the only source of their physical location. Consumers must not
concatenate the current path or the future `ai/<machine>/System/Views/` path.
The dependent View-Configured Thread Collections SPEC owns the physical move.

`content.json` remains the view's routing declaration. Its `root` may resolve
to a machine-relative location such as `ai/${machine}/Wiki`, a workspace-root
location such as `Wiki` or `docs/wiki`, the project/session root, the view
capsule, SQLite, or another already-supported root type. Moving a capsule never
moves or rewrites its content root. Moving content requires an explicit
content-root change.

This separation permits, for example, Git-tracked `Wiki/` content while the
machine-scoped `ai/` tree remains ignored. The capsule's inclusion or exclusion
from Git never silently determines the content root's Git policy.

The later migration must be one-time, idempotent, and lossless for manifest,
`content.json`, styles, configuration, and `state/state.json`. This SPEC proves
that identity and all consumers already flow through the registry so that move
does not require a second thread migration.

### 5.5 Portable configuration and cloning

The capsule's declarative configuration is the interchange format. A future
GUI editor and direct user JSON editing both read and write that same versioned
schema through one validated Fusion-owned service. Invalid edits remain
inactive, return field-level diagnostics, and leave the last-known-good
effective configuration available.

Portable declarations may include view type, content-root declaration,
component/type references, layout, presentation defaults, requested
capabilities, and templates. References use stable registered identifiers and
explicit compatible versions; an unavailable component leaves the affected
configuration inert and visibly unresolved rather than executing fallback
code from the bundle.

A clone/import operation:

1. mints a new `metadata.view-id`;
2. preserves portable declarations and compatible component references;
3. excludes `state/state.json`, thread/workspace selections, active sessions,
   thread history, and generated local caches by default;
4. excludes secret values, granted permissions, and consent/activation records;
5. presents requested capabilities for fresh user review; and
6. commits only after schema, dependency, path, and permission-request
   validation succeeds.

OpenCode is the first named harness subject to the read-only System rule. It
may inspect the effective configuration and tell the user what to change, but
it cannot invoke the privileged configuration writer or mutate System through
another generic file route. The rule applies equally to future harnesses.

This section constrains the registry/config seam preserved by this SPEC. The
dependent View-Configured Thread Collections SPEC implements relocation and the
initial effective chat configuration. GUI editing, package export, and
clone/import remain later work.

---

## 6. Persistence Model

The existing `threads` table remains the source for underlying chat-session
metadata and the parent of `exchanges`. Add a stable group layer above it.

### 6.1 `thread_groups`

Required fields:

| Field | Contract |
|---|---|
| `group_id` | Primary key; stable user-visible thread identity. |
| `workspace_id` | Required workspace owner. |
| `view_id` | Immutable view binding; nullable only for migrated Legacy Threads. |
| `name` | User-visible title; nullable for existing fallback-title behavior. |
| `current_primary_thread_id` | Exact current member session. Required after group creation commits. |
| `created_at` | Creation timestamp. |
| `updated_at` | MRU/activity timestamp for the visible rail row. |
Indexes must support `{workspace_id, view_id, updated_at}` and the
Legacy population where `view_id IS NULL`.

### 6.2 `thread_group_members`

Required fields:

| Field | Contract |
|---|---|
| `group_id` | Owning visible thread. |
| `thread_id` | Unique underlying session; foreign key to `threads.thread_id`. |
| `ordinal` | Stable creation order within the group. |
| `origin_kind` | `initial`, `move-to-side-chat-primary`, or a reserved future value. This describes why the peer member was created; it does not identify a source chat or imply context transfer. |
| `joined_at` | Timestamp. |

Primary key: `{group_id, thread_id}`. A session may belong to exactly one group.
“Sibling” is derived from common `group_id`; do not store it as a mutable role.

### 6.3 `thread_group_primary_events`

Required fields:

| Field | Contract |
|---|---|
| `sequence` | Server-assigned monotonically increasing primary key. |
| `group_id` | Affected visible thread. |
| `previous_thread_id` | Nullable for initial assignment. |
| `next_thread_id` | Newly assigned primary session. |
| `reason` | `initial` or `move-to-side-chat`; future values require explicit contracts. |
| `occurred_at` | Wall-clock timestamp for display/audit. |

The sequence resolves equal timestamps and is the authoritative ordering. The
`thread_groups.current_primary_thread_id` value is a transactional read cache.
Every cache change and event insertion occur in the same SQLite transaction.

### 6.4 `thread_group_view_projections`

Cross-store work uses a durable projection outbox. Required fields:

| Field | Contract |
|---|---|
| `projection_id` | Stable idempotency key; the matching primary-event sequence is sufficient. |
| `group_id` | Owning visible thread. |
| `view_id` | Owning immutable view. |
| `kind` | `open-side-chat-tab` for this SPEC. |
| `member_thread_id` | Session to place in the side-chat tab. |
| `member_ordinal` | Deterministic fallback label input. |
| `status` | `pending`, `applied`, or `cancelled`. |
| `created_at` | Creation timestamp. |
| `terminal_at` | Nullable applied/cancelled timestamp. |

The outbox records a pending projection instruction, not the worksurface
snapshot. It is inserted in the same transaction as the matching primary event.
Applying it through the view-state service is idempotent. `cancelled` means the
user durably closed the projected tab before initial application completed.
Keep terminal records long enough to make retries and diagnostics deterministic;
any later retention policy must not make a still-pending instruction disappear.

### 6.5 Existing `threads` rows

Retain existing columns during this SPEC to avoid a broad destructive rewrite.
For new sessions, compatibility fields such as `workspace_id`, `view_id`, and
`scope` must agree with their owning group, but group metadata is authoritative
for visible listing and selection.

During this SPEC, `ThreadManager` remains the write owner for session-owned
compatibility fields and Markdown mirrors. The thread-group domain service
supplies group-derived values to that manager and never writes a second
independent copy afterward. Reads for visible listing switch to the group
tables. A later destructive schema cleanup may remove redundant session
columns only after every active reader has moved; this SPEC does not add a
permanent synchronization loop.

`ThreadIndex` remains session CRUD. Add a focused group/member persistence
module and a thread-group domain service rather than growing `ThreadIndex` into
mixed-purpose code. Every new underlying session must be created through
`ThreadManager.createThread()` or a manager-owned transaction-capable primitive
that preserves session-limit policy and the generated Markdown mirror. Raw
`threads` inserts are prohibited.

### 6.6 Migration

For every existing `threads` row:

1. Create one `thread_groups` row.
2. Use the existing `thread_id` as the initial `group_id` so existing links can
   continue resolving without guesswork.
3. Add the existing session as ordinal 1 with `origin_kind='initial'`.
4. Set it as current primary and append the initial primary event.
5. Preserve its title, timestamps, status, workspace, harness,
   exchanges, and Markdown history.
6. If its existing `view_id` resolves, retain it. Otherwise leave group
   `view_id=NULL` and expose it through Legacy Threads.
7. Do not infer a view from the UI that happened to be active during migration.
8. Do not copy the existing global view state into every migrated group. The
   owning view's `threadWorksurfaces` map begins without an entry and its
   adapter supplies the safe default on first selection.

Migration is idempotent and transaction-safe. Never wipe chat data.

---

## 7. View-Bound Listing and Selection

### 7.1 Server query contract

The normal list query is keyed by:

```text
workspaceId + viewId
```

It returns visible thread groups, not every underlying member session. Each row
includes `threadGroupId`, `currentPrimaryThreadId`, name, timestamps, and view
ID. Member lists are requested only when required to restore or manage
side-chat tabs.

The server validates that the requested view ID exists in the current
workspace registry. It never trusts a client-supplied folder path.

### 7.2 Client state

Replace the workspace-global list/selection assumption with state shaped around
view contexts, for example:

```ts
threadGroupsByViewId: Record<ViewId, ThreadGroup[]>;
currentThreadGroupIdByViewId: Record<ViewId, ThreadGroupId | null>;
legacyThreadGroups: ThreadGroup[];
```

Changing views restores that view's last selected group and worksurface. It
does not rewrite another view's selection.

### 7.3 New Chat

For this SPEC the visible label remains **New Chat**. Creating a normal new
thread creates a group and its initial session bound to the active immutable
view ID. Do not introduce configurable labels, icons, templates, working
directory overrides, or collection modes here.

The active view must already exist and resolve through the workspace view
registry. New Chat does not create or populate project/content folders and does
not create a Project Viewer. A Project Viewer's content root, worksurface,
instructions, and optional CWD policy are view configuration established by a
separate user-owned Create Project flow. Thread creation consumes that resolved
view context and remains independent of its filesystem provisioning. The
existing generated chat Markdown mirror is session persistence, not project
scaffolding, and remains governed by `ThreadManager`.

`PENDING_CHAT_INTENT_SPEC.md` continues to govern whether a brand-new visible
thread is committed before first send. This SPEC must use the canonical New
Chat creation service rather than create a competing path.

### 7.4 Legacy Threads

Legacy groups with `view_id=NULL` remain reachable from a workspace-level
Legacy Threads population. They do not appear in every view and are not
automatically assigned. Reassignment UI and folder/tag organization are outside
this SPEC; persistence must permit a later explicit reassignment.

### 7.5 Future collection compatibility

A later collection layer stores multiple stable, ranked collection-ID
assignments in thread-group metadata regardless of presentation. Conceptually:

```json
{
  "collectionAssignments": [
    { "collectionId": "threads", "rank": 14 },
    { "collectionId": "research", "rank": 21 }
  ]
}
```

The concrete SQLite representation may normalize these entries into rows.
Configuration defines the available IDs, labels, display order, and
`mode: "folders" | "tags"`. The default is `"folders"`. Folder mode projects
only the valid assignment with the highest server-issued rank. Tag mode
projects every valid assignment, allowing one thread to appear in multiple
groupings.

Assigning a folder or adding a tag raises that assignment to the newest rank.
In folder mode this changes the visible folder without deleting lower-ranked
metadata. Switching back to tag mode therefore reveals the preserved valid
memberships. Rank allocation and any compaction are server-owned and
transactional; wall-clock timestamps do not resolve precedence.

**Archive** is a system-provided effective collection, not a removable ordinary
tag. A thread resolves into Archive whenever it has no assignment that exists in
the current view configuration. Its Archive action clears every assignment,
including dormant ones, rather than setting a separate archive flag. Removing
or renaming configuration entries must never delete a thread or make it
unreachable. Renaming changes a label, not the stable ID. Assignments whose IDs
are temporarily absent from configuration remain dormant metadata; restoring
the same configured ID makes them valid again unless the user explicitly used
Archive to clear them.

The Office Viewer color-precedence code demonstrates the same newest-rank-wins
idea, but it is not the reusable module for this domain. That policy is coupled
to rows, columns, cell overrides, structural edits, and renderer metadata.
Thread collection precedence belongs in the server-owned thread-group domain.
Extract a shared rank utility only if a later implementation identifies a
small, genuinely identical pure operation and can preserve both domains' tests.

---

## 8. Per-Session Runtime and Renderer Isolation

Multiple `ChatSurface` instances may be mounted and may become active
independently. The implementation must remove remaining single-active-chat
assumptions before Move Chat to Side Chat ships.

### 8.1 Client state that must be session-keyed

At minimum, these values must resolve by underlying `threadId`:

- messages and exchanges;
- current assistant turn and segments;
- pending prompt acceptance and retry draft;
- context usage and token usage;
- active/warming/ready/in-flight/stopping status;
- transient Working activity and stream frontier;
- composer draft and pending attachments;
- diagnostics and todo state; and
- any connecting overlay state.

The existing `projectChats[threadId]` is the correct direction. Move remaining
global `contextUsage`, `tokenUsage`, `chatActive`, and `wireReady` values into
the same per-session boundary or an equivalent keyed runtime map.

Transient surface UI—open menus, focus refs, element IDs—uses `surfaceId`, not
only panel ID. Rendering the primary and a side tab from one view must not
produce duplicate DOM IDs or close each other's menus accidentally.

### 8.2 Server runtime isolation

The server already routes live events and runtime-manager records by
`threadId`. Preserve that rule and remove WebSocket-connection assumptions that
one `session.wire` or one `state.threadId` represents every mounted chat.

Required outcomes:

- opening/hydrating a side session never changes the selected primary;
- activating one session never kills another session's active wire merely
  because both use the same WebSocket connection;
- Stop targets the exact session/turn;
- two member sessions may run concurrently without crossed output;
- `wire_ready`, usage, errors, and terminal events carry the exact `threadId`;
  and
- passive side-tab hydration does not warm a harness.

The existing global wire registry and thread-keyed runtime manager should be
used as foundations. Remove the `secondaryTracker` race workaround once open
requests/responses carry explicit session and surface correlation.

### 8.3 Open correlation

An open request for a mounted surface includes `surfaceId`, `threadGroupId`, and
`threadId`. The response echoes them. The client verifies group membership
before hydrating the target slot. Live events continue to route only by
`threadId`; `surfaceId` is not a model-output route key.

---

## 9. Worksurface State

### 9.1 Ownership

The active view capsule owns one opaque, versioned content-worksurface snapshot
per visible thread group. It persists through the existing view-state path in:

```ts
viewStates[viewId].threadWorksurfaces[threadGroupId]
```

SQLite owns the group, membership, and primary history. It does not store a
copy of the worksurface. The active view owns the snapshot schema through a
`WorksurfaceAdapter`:

Fusion's view-state service may update this application-owned state
automatically. A harness/agent must not receive a generic file-write path to
the System capsule merely because the app itself can persist view state.

```ts
interface WorksurfaceAdapter<T> {
  schemaVersion: number;
  capture(): T;
  sanitize(value: unknown): T;
  restore(value: T): void;
  empty(): T;
}
```

Adapters whitelist view-owned content state. They must not capture:

- Threads rail visibility or width;
- chat visibility or width;
- theme/tint settings;
- chat messages, drafts, attachments, or runtime state; or
- other workspace shell chrome.

Typical allowed state includes open content tabs, active document/location,
browser URL, file selection, view mode, scroll positions, and side-chat-tab
descriptors.

### 9.2 Save and restore ordering

On visible-thread switch:

1. Flush the outgoing group's debounced worksurface capture.
2. Select the incoming group.
3. Sanitize/migrate the incoming snapshot through the active view adapter.
4. Restore tab structure.
5. Restore active content/location.
6. Restore selections and scroll positions after their content is ready.
7. Passively hydrate the group's primary chat and any visible side-chat tab.

Closing/restarting Fusion flushes pending captures. Corrupt or newer snapshots
fall back to the adapter's safe empty/default state without blocking the
primary chat.

View-state writes use the existing view-state compare-and-swap/revision
contract. The revision belongs to the view-state document, not the SQLite
thread group.

### 9.3 Content tabs

Side-chat tabs use the universal content-tab host. A persisted descriptor needs
at least:

```ts
type SideChatTabDescriptor = {
  id: string;
  kind: 'side-chat';
  projectionId: string;
  threadGroupId: string;
  threadId: string;
  label: string;
};
```

The deterministic fallback label is the member ordinal (`Chat 1`, `Chat 2`,
and so on). This is core structural labeling, not automatic semantic naming.

If `UNIVERSAL_VIEW_TAB_BAR_SPEC.md` has not landed, implement its shell tab-host
contract first. Do not create a second view-specific tab system for side chat.

### 9.4 Cross-store recovery

SQLite and the view folder cannot share one transaction. The committed group
transition is authoritative and a durable projection-outbox row makes the
side-tab placement recoverable without storing a second worksurface:

1. commit the session membership, primary transition, and pending
   `open-side-chat-tab` projection in SQLite;
2. write/focus the previous primary's side-tab descriptor through the owning
   view-state service;
3. mark the projection applied only after the view-state write succeeds;
4. acknowledge the completed action with both the authoritative transition and
   `viewStateStatus: 'persisted' | 'repair_required'`; and
5. on startup/reconnect, retry pending projections through the same idempotent
   view-state operation.

The projection/repair key is
`{viewId, threadGroupId, primaryEventSequence}`. A crash after writing view
state but before marking the projection applied may replay it; replay must
focus or preserve the existing descriptor, never create a duplicate tab.
Applied or cancelled historical projections are not replayed, so intentionally
closed tabs do not reopen. Corrupt view state falls back safely and does not
infer desired open tabs from all historical moves. A view-state failure does
not undo or obscure the committed new primary.

Every projected side-tab descriptor carries its `projectionId`. Closing it is
a durable view-state action, not an optimistic local removal:

1. write one view-state revision that removes the tab and adds a tombstone for
   its `projectionId`;
2. after that write succeeds, mark a still-pending outbox row `cancelled` (or
   leave an already-applied row terminal);
3. only then acknowledge the close and remove the visible tab; and
4. on projection replay, check the tombstone before opening—when present, mark
   the outbox row `cancelled` and do not recreate the tab.

If the close write fails, the UI reports failure and keeps/reopens the tab. A
crash after the tombstone write but before the outbox update is safe because
replay observes the tombstone. Tombstone cleanup may occur only after the
outbox row is durably terminal.

---

## 10. Move Chat to Side Chat

### 10.1 Entry point

Add **Move Chat to Side Chat** to the shared chat menu when the mounted surface
is the selected group's primary session. The same menu component is used in all
hosts; capability state determines whether this one action is available.

The action is unavailable when:

- no durable group/session is selected;
- the mounted session is not the group's current primary;
- the current turn is accepting, in flight, finalizing, or stopping; or
- a Move Chat to Side Chat request for the group is already pending.

Side-chat surfaces retain the same list/menu button and common menu behavior,
but do not recursively offer Move Chat to Side Chat for a non-primary member.

### 10.2 Canonical command and authoritative transition

Client request includes:

```json
{
  "type": "thread:action",
  "action": "move_chat_to_side",
  "requestId": "...",
  "threadGroupId": "...",
  "expectedPrimaryThreadId": "chat-a",
  "viewId": "..."
}
```

The server validates workspace ownership, immutable view binding, membership,
expected current primary, and terminal runtime state. The existing thread-action
handler routes this Fusion-owned action to a focused thread-group domain
service; no harness adapter is called.

In one SQLite transaction the service:

1. creates Chat B as a durable, cold, empty underlying session through a
   transaction-capable `ThreadManager` creation primitive using the group's
   harness policy but no provider session and no exchange; that primitive owns
   the session-limit check and Markdown mirror;
2. adds Chat B to `thread_group_members` as the next peer ordinal with
   `origin_kind='move-to-side-chat-primary'`; no source-session or inherited-
   context relationship is created;
3. appends the primary transition event A → B;
4. sets the group's cached current primary to B;
5. inserts the pending `open-side-chat-tab` projection for Chat A keyed by the
   primary-event sequence; and
6. updates the group's activity timestamp.

The service must not insert a `threads` row directly. If the current
`ThreadManager` cannot participate in the transaction, refactor a narrow
manager-owned primitive that preserves its invariants; do not duplicate them
inside the group service. A failed database transaction leaves Chat A primary.
An unindexed empty Markdown mirror left by process death is detected and
removed or rebuilt by idempotent startup repair before it can appear as a
thread.

After the SQLite commit, the server applies the pending projection by
writing/focusing Chat A's side-tab descriptor through the owning view-state
service as specified in §9.4. The requester then receives:

```json
{
  "type": "thread:action:completed",
  "action": "move_chat_to_side",
  "requestId": "...",
  "threadGroupId": "...",
  "previousPrimaryThreadId": "chat-a",
  "currentPrimaryThreadId": "chat-b",
  "primaryEventSequence": 42,
  "memberOrdinal": 2,
  "sideChatTab": {
    "kind": "side-chat",
    "projectionId": "42",
    "threadId": "chat-a"
  },
  "viewStateStatus": "persisted"
}
```

`viewStateStatus` may be `repair_required` when the group transition committed
but the file-backed projection did not. The response still contains enough
authoritative data for the client to render the correct primary and tab without
pretending that the group mutation failed.

This operation intentionally creates a durable empty **underlying session**.
It does not create another visible Threads-rail row, and it is not the ordinary
New Chat action. Durability is required so the deliberate move and blank primary
survive restart. The new session remains cold until normal warm/send intent.

Database failure returns `thread:action:error` and leaves Chat A primary. A
post-commit view-state failure follows §9.4 recovery and never creates a second
blank primary on retry.

### 10.3 Concurrency

`expectedPrimaryThreadId` is a compare-and-swap guard. If another window has
already moved that primary to a side tab, the server returns a conflict plus the current
group snapshot. The losing client reloads it and does not create a second blank
primary.

After commit the server fans a `thread:primary_changed` application fact with
the authoritative group snapshot to every open window for the workspace,
including the requester. It may publish the same post-commit fact to the
Universal Event Bus. UEB admission/subscriber failure never delays, rolls back,
or rewrites the action response or WebSocket fan-out.

Requester acknowledgement, each workspace-recipient delivery, and optional UEB
publication are mutually failure-isolated post-commit operations. A closed
requester or one failed/stalled recipient cannot prevent attempts to all other
recipients. Delivery code observes failures per recipient and never rethrows
them into the mutation path. A client that misses the fact reloads the current
group snapshot during normal reconnect/init; no delivery failure repeats the
Move Chat to Side Chat mutation.

### 10.4 Client commit

Before acknowledgement, the client may show a pending action but must not move
Chat A or clear the primary. After success it atomically:

1. installs Chat B's empty per-session state;
2. points the primary `ChatSurface` at Chat B;
3. applies or repairs the group-keyed view worksurface projection;
4. opens/focuses Chat A's centered side-chat tab; and
5. focuses Chat B's composer when layout/focus policy allows.

There is no automatic transcript attachment or resume prompt.

### 10.5 Repeated use

If B is later moved to side chat, the same operation creates C as primary and
adds/focuses B as another tab. A remains intact. The main rail still shows one
visible thread group.

---

## 11. Centered Side-Chat Presentation

`SideChatTab` fills its content-tab body and centers one ordinary
`ChatSurface`. It uses shared chat sizing/tokens and responsive constraints;
do not create a second chat CSS system.

Required behavior:

- full shared header, message list, tools, diagnostics, todo surface, composer,
  usage presentation, attachments, and accessibility behavior;
- the shared list/menu (`event_list`) button and menu behavior remain present;
- the menu's Show/Hide Threads action controls the host view's outer rail; it
  does not mount a rail inside the side-chat tab;
- Rename acts on the visible thread-group title;
- View Markdown opens the mounted session's transcript;
- Copy Link identifies the visible group and, for a side chat, the exact member
  session so the deep link can restore the proper tab;
- send, warm, stop, and live rendering target the tab's exact `threadId`; and
- tab close durably removes only the tab descriptor, records the projection
  tombstone when applicable, and never deletes the member session.

A closed member remains in persistence and primary history. A later history or
management UI may reopen it; that UI is outside this SPEC.

---

## 12. Deletion, Collection Archive, and Failure Semantics

1. Do not add a permanent group-level archive flag. When the future collection
   UI ships, its Archive action clears all collection assignments and the group
   consequently resolves into the derived Archive collection described in
   §7.5. The present SPEC may leave the existing placeholder Archive UI
   unavailable until that collection layer exists.
2. Deleting a visible thread explicitly deletes its group and all member
   sessions/exchanges through one confirmed server operation. Existing
   Markdown deletion/retention policy remains in force.
3. Closing a side-chat tab is never deletion or archive. It follows the
   acknowledged view-state/tombstone sequence in §9.4 and is not optimistic.
4. A missing/corrupt side member produces a recoverable placeholder tab that
   can be closed. It does not block the primary.
5. If the cached primary points to a missing/non-member session, recover from
   the newest valid primary event; if none exists, mark the group damaged and
   do not silently select an unrelated session.
6. Duplicate view IDs make the affected capsules unavailable and produce a
   clear registry error. Bound groups remain stored and recover when the
   conflict is fixed.
7. Removing a view capsule does not cascade-delete its groups. They remain
   unavailable/orphaned until that immutable view ID returns or a future
   reassignment workflow handles them.

---

## 13. Protocol and Authorization Rules

- **Move Chat to Side Chat** uses the existing `thread:action` command family
  with `action='move_chat_to_side'`. Do not add a `thread-group:*` family.
- Group actions carry `threadGroupId`; session actions carry `threadId`; an
  action that crosses the boundary carries both and the server verifies
  membership.
- Every group/session request is scoped by the authenticated/current workspace
  session; client-supplied workspace IDs are never sufficient authority.
- Creating a new visible thread requires an authenticated origin classified as
  a direct user UI action or a previously user-authorized automation. Model
  output, view content, and editable workspace files are not authority.
- Effective launch permissions are read from server-owned policy. A request
  cannot enlarge its authority by supplying alternative view configuration,
  working-directory policy, skills, or permission fields.
- The server verifies that `threadId` is a member of `threadGroupId` before
  open, send, stop, rename, link, Markdown view, or Move Chat to Side Chat behavior that uses
  both values.
- The group view binding is server-owned after creation.
- Live events remain keyed by underlying `threadId` and retain existing
  `turnId`, `streamSeq`, and drain ownership guarantees.
- Group/list messages carry the SQLite group revision or primary-event sequence.
  Worksurface writes separately carry the owning view-state document revision.
  Do not compare or synchronize these as though they were one counter.
- Unknown fields and invalid enum values are rejected at the boundary; do not
  persist arbitrary client objects without adapter sanitization.
- Add the command, completion, error, and primary-change shapes to the shared
  client/server protocol types and the central redaction/logging policy.
- `requestId`, group/session IDs, action name, event sequence, and status are
  loggable. Prompts, transcript content, provider payloads, attachment bodies,
  and opaque worksurface contents are not logged by this action path.
- `thread:action:completed`/`thread:action:error` correlate the requester.
  `thread:primary_changed` is a post-commit fact and multi-window fan-out, not a
  substitute acknowledgement.
- Requester delivery, each fan-out recipient, and UEB publication are separate
  supervised attempts. Failure in any one cannot skip the others. Reconnect
  hydration is the recovery path for a client that misses delivery.

---

## 14. Required Implementation Slices

Slices are dependency ordered, user-observable, end-to-end increments. Each
slice begins at a public UI/WS entry, crosses its owning service/state boundary,
and proves persistence or readback before the next slice begins. Builders may
subdivide internal tasks but must not turn these into frontend/backend/database
phases.

### Slice 1 — Rename-safe view-bound thread

- Keep view capsules at their current physical root but make the central
  registry the only owner of that location so a dependent SPEC can relocate
  them without changing consumers.
- Make `manifest.md` `metadata.view-id` authoritative through one central
  ID-to-current-folder registry for content, state, configuration, styles,
  restore, and reorder.
- Preserve folder suffixes on reorder; migrate missing IDs once and fail
  duplicate IDs visibly.
- Create/list/select one visible thread through the public UI for an explicit
  `{workspaceId, viewId}` and hydrate its underlying session by `threadId`.
- Restart, rename/reorder the folder, and prove the same view and visible thread
  resolve without changing identity or its declared content root.

### Slice 2 — Visible thread groups with preserved sessions

- Add the group/member/primary-event and view-projection-outbox migrations,
  focused persistence module, and group domain service; do not add worksurface
  columns.
- Backfill every existing thread one-to-one without losing exchanges, harness
  configuration, status, or Markdown mirrors; unresolved view bindings
  appear only in Legacy Threads.
- Route New Chat creation through the existing pending-intent contract and the
  canonical session manager, then attach the committed session to a group.
- List one rail row per group, delete through group semantics, and prove
  restart/readback plus compatibility-field ownership. Do not introduce a
  permanent archive-status field before ranked collections land.

### Slice 3 — One reusable chat in two mounted surfaces

- Extract pure `ChatSurface` presentation plus connected primary/side-tab host
  adapters with explicit group, session, view, workspace, and surface IDs.
- Key usage, readiness, active state, drafts, attachments, diagnostics, and
  messages by `threadId`; key menus/focus/DOM state by `surfaceId`.
- Remove the one-wire-per-WebSocket assumption while preserving passive open,
  prompt acceptance, Stop, finalization, snapshots, and stream ordering.
- Mount two sessions simultaneously through the real shell and prove they can
  hydrate, stream, stop, and finish without crossing state.

### Slice 4 — Per-thread content continuity in the view folder

- Add the versioned `WorksurfaceAdapter` contract and
  `viewStates[viewId].threadWorksurfaces[threadGroupId]` through the existing
  view-state read/write path.
- Integrate the universal tab host; capture/restore only content tabs,
  locations, selections, view modes, and scroll positions in the required
  order.
- Switch between two visible threads through the UI and prove each restores its
  own content while shell/chat chrome remains outside the snapshot.
- Inject stale/corrupt state, restart, and prove safe fallback without a second
  SQLite owner.

### Slice 5 — Move Chat to Side Chat

- Add the shared-menu action and send `thread:action` with
  `action='move_chat_to_side'` through the public route.
- Execute the guarded manager-owned session creation and group transition,
  persist/project the side-tab descriptor through view state, return the
  canonical completion/error, and fan `thread:primary_changed` to two clients.
- Render the unchanged old session as the same centered `ChatSurface`, with the
  shared list/menu button and no local rail; render the new primary cold and
  completely empty.
- Prove conflict handling, repeated moves, view-state repair, restart, tab-close
  semantics, and independent concurrent use.
- Remove the floating/sticky/minimized Secondary Chat implementation and all
  of its store/routing/geometry remnants once the tab replacement passes.
- Remove the retired context-cloning UI, client protocol, server service,
  provider invocation, pending fields, tests, and active-plan language. No
  low-level escape hatch remains accessible through Fusion.
- Delete temporary compatibility aliases before the slice completes unless a
  named external consumer and removal boundary are documented.
- Update the Chat System Wiki's Identity, Runtime, UI, Structure, Decisions,
  and Changelog pages to the shipped model and record operational recovery.

---

## 15. Verification Matrix

### 15.1 Automated server checks

| Check | Required proof |
|---|---|
| Migration | Existing threads, exchanges, harness IDs/config, names, timestamps, and status remain intact; each receives exactly one group/member/initial-primary event. Re-running migration is safe. |
| View registry | Folder rename and reorder preserve resolution; missing IDs migrate once; duplicate IDs fail visibly; cross-workspace equal IDs remain isolated. Every consumer resolves the current capsule location centrally so the dependent relocation SPEC has no direct-path stragglers. |
| View lists | `{workspaceId, viewId}` returns only that view's groups; Legacy rows are separate; member sessions never duplicate rail rows. |
| Move transition | DB success produces one manager-created cold empty session with Markdown mirror, one member, one primary event, one primary-pointer update, and one pending view projection. A pre-commit failure leaves none; a post-commit view-state failure returns `repair_required` and later applies exactly one side tab. |
| Move conflict | Two requests with the same expected primary yield exactly one success and one conflict. |
| Fork retirement | No UI action or public protocol can request Fork; OpenCode is never invoked with `--fork`; active plans contain no future Fork slice. |
| Authorization | Cross-workspace, wrong-view, wrong-group, and non-member session requests fail without mutation. |
| Creation authority | Direct user UI intent and user-authorized automation can create a thread; model output and client-supplied policy/permission fields cannot. |
| Runtime isolation | Two sessions on one WebSocket can warm, stream, stop, and finish independently; passive open warms neither. |
| Protocol and fan-out | Public `thread:action` yields correlated completed/error response; two workspace clients receive the same `thread:primary_changed` snapshot. Injected requester-send, individual-recipient, and UEB failures do not prevent the remaining delivery attempts or change committed state. A missed client rehydrates on reconnect without replaying the mutation. |
| Recovery | Missing current-primary cache recovers from valid events; a pending projection replays idempotently; applied/cancelled projections never resurrect an intentionally closed tab; invalid membership and corrupt view-folder worksurface state fail safely. |

Run the complete server suite with `npm test` in `fusion-studio-server/`.

### 15.2 Automated client checks

| Check | Required proof |
|---|---|
| Component boundary | Pure `ChatSurface` imports no store/network/controller; two connected instances render from explicit session IDs without global-selection leakage or duplicate DOM IDs. |
| Per-session state | Usage, readiness, Working, drafts, attachments, diagnostics, messages, and Stop remain isolated. |
| Per-view selection | Switching views restores each view's own selected group and does not reorder/reselect another view. |
| Worksurface | Switching groups captures outgoing content-only state under the owning view's `threadWorksurfaces` map and restores tabs/location/scroll in order. Chrome is not embedded and SQLite has no duplicate snapshot. |
| Side-tab layout | Centered shared chat renders with its list/menu button and no local Threads rail. |
| Close semantics | Closing a side tab waits for durable view-state acknowledgement, tombstones a still-pending projection, and removes placement only; transcript and membership remain. A failed close write leaves/reopens the tab. |
| Failure UI | A failed/conflicted Move Chat to Side Chat action leaves the old primary visible and usable. |

Run `npm run build` in `fusion-studio-client/` plus focused component/store tests.

### 15.3 Electron acceptance walk

1. Open two different views and create/select different visible threads.
2. Switch views repeatedly; confirm each retains its own rail population,
   selected thread, primary chat, open content, and scroll/location state.
3. Rename the active view folder without changing `metadata.view-id`; restart
   Fusion and confirm the view, state, and bound threads still resolve.
4. Point the Wiki view at a workspace-root `Wiki/`, keep the System capsule
   under ignored `ai/`, and confirm the content remains independently eligible
   for Git tracking without changing view identity.
5. In one visible thread, finish any active response and choose **Move Chat to
   Side Chat**.
6. Confirm the ordinary primary chat is completely empty and uses a new
   underlying session ID.
7. Confirm the prior transcript is unchanged in a centered content tab.
8. Confirm the side tab has the same list/menu button and menu behavior but no
   adjacent/local Threads rail.
9. Send unrelated prompts concurrently in the new primary and old side chat;
   confirm messages, tools, usage, Stop, and completion never cross.
10. Restart Fusion; confirm the same visible thread row, empty/new primary if
   still unused, side-chat tab, transcript, active content tab, and scroll
   positions restore.
11. Use Move Chat to Side Chat again; confirm the rail still has one row and
    both earlier chats remain intact as tabs.
12. With a projection still pending, close its side tab and restart; confirm it
    stays closed and the session is not deleted. Inject a failed close write and
    confirm the tab stays/reopens. Then delete the visible thread through the
    explicit destructive path and confirm all of its members are handled
    together.
13. Open a migrated pre-SPEC thread from Legacy Threads and confirm its history
    remains intact.

Document pass/fail for every step in the implementation handoff.

---

## 16. Definition of Done

This SPEC is complete only when all of the following are true:

1. `ChatSurface` renders any explicit session as primary or side-tab content
   with the same behavior and no global current-thread dependency.
2. `ThreadRail` lists one row per visible group for one explicit view context.
3. Every current view capsule resolves by immutable manifest ID through the
   central registry after rename/reorder; no consumer owns the physical root.
4. Existing chat data migrates without loss or guessed view assignment.
5. **Move Chat to Side Chat** transactionally moves the old primary into a
   centered content tab and installs a durable, cold, empty new primary.
6. No transcript or hidden context transfers automatically.
7. Multiple mounted sessions route, stream, stop, and report usage independently.
8. The owning view folder restores each visible thread's content worksurface,
   including side-chat tabs, exactly after thread switch and application
   restart; SQLite does not duplicate that state.
9. Primary-role history is append-only and deterministically ordered.
10. Side-chat tabs have no local rail but retain the shared list/menu control
    and behavior.
11. The legacy Secondary Chat popup/sticky/minimized implementation and routing
    workarounds are removed.
12. Client build, server tests, focused client tests, migration tests, and the
   Electron acceptance walk pass.
13. Move Chat to Side Chat uses `thread:action`; no `thread-group:*` transport
    family exists.
14. The requester and all workspace windows converge on the same committed
    primary even when UEB publication or view-state projection fails.
15. Pending view projections replay idempotently, while an applied projection
    never reopens a side tab the user later closed.
16. Capsule identity and content-root resolution are independent of physical
    folder location, allowing the dependent relocation SPEC to move the capsule
    without moving content.
17. New-thread authority comes only from direct user intent or a separately
    user-authorized automation, never from model output or request-supplied
    permission/configuration fields.

---

## 17. Explicitly Out of Scope

- automatic or LLM-generated thread naming;
- attachment-aware naming and attachment icon stacks;
- automatic transcript summaries or context inheritance;
- the agent/helper implementation for explicit resume handoffs;
- arbitrary “create side chat” actions beyond Move Chat to Side Chat;
- promoting an existing side chat back to primary;
- a side-chat history/management browser;
- folders, tags, custom collections, ranked-assignment persistence, or their
  management UI; the later implementation must honor the lossless mode
  projection and derived Archive contract in section 7.5;
- physical view-capsule relocation into `System/Views/` and effective view-chat
  configuration; both belong to the dependent View-Configured Thread
  Collections SPEC;
- configurable New labels/icons or launch recipes;
- folder-template creation, starter documents, or CWD overrides;
- the side-navigation Create Project flow and Project Viewer provisioning;
  project/content folder creation from New Chat is prohibited rather than
  deferred;
- view-level prompt/instruction schema and precedence;
- transcript export destinations, formats, retention, or naming;
- inbox-embedded reply chats;
- Routines, Agent Profiles, Plugins, or Project Viewer product surfaces;
- mobile layouts; and
- using filesystem inode metadata as durable identity.
- full harness-wide enforcement of the future agent-write-protected System root;
  that security boundary requires its own threat model and implementation SPEC.
  This SPEC must still centralize all System/View writes behind services and
  must not create a bypass the later enforcement would need to preserve.
- the visual GUI builders/editors, package export, and clone/import workflows
  for views, components, templates, and other System configuration; this SPEC
  preserves their single-schema/write-service and portability seams but does
  not build those experiences.

These features may build on the stable group, session, view-ID, worksurface,
and `ChatSurface` seams established here. They must not be partially introduced
inside this implementation.

---

## 18. No Open Decisions

All behavior necessary to implement this bounded SPEC is resolved. If active
code or another draft document conflicts with the owner-approved rules in §2,
this SPEC controls this feature. A newly discovered choice that would change
visible behavior, persistence meaning, deletion semantics, or context transfer
must return to the owner; builders may resolve ordinary internal details within
the boundaries above.
