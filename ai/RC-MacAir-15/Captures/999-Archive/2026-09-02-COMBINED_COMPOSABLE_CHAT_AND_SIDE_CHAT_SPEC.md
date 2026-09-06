# Historical Combined Composable Chat and Move Chat to Side Chat — SPEC

**Date:** 2026-09-02
**Status:** Superseded as an executable SPEC on 2026-09-03. Retained only as requirements provenance after the generic component host, composable chat extraction, and Move Chat to Side Chat were separated into independently reviewable SPECs.
**Active replacements:** `../002-SPECs/GENERIC_COMPONENT_TAB_HOST_SPEC.md`,
`../002-SPECs/COMPOSABLE_THREADED_CHAT_SPEC.md`, and
`../002-SPECs/MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`. These active documents control
on conflict. Do not hand this archived bundle to an implementation
orchestrator. Relative SPEC links in the historical body reflect its former
location under `002-SPECs/`.
**Owner:** Fusion Studio chat, workspace shell, and view infrastructure.
**Source:** `../022-Vision_Roadmap/` decisions D-078 through D-101, D-132, and D-133.
**Depends on:** The shell-owned tab foundation in `UNIVERSAL_VIEW_TAB_BAR_SPEC.md`; Slice 6 additionally requires the separately specified, implemented, and accepted Tabs as Containers contract produced outside the threads domain.
**Incorporates:** `PENDING_CHAT_INTENT_SPEC.md` as the normative New Chat sub-SPEC after the group foundation exists; it is not a separately schedulable prerequisite.
**Supersedes:** The floating/sticky/minimized presentation in `../999-Archive/SECONDARY_CHAT_SPEC.md` and the retired OpenCode context-cloning path.
**Preserves:** The server-owned chat lifecycle documented in `ai/<machine>/Wiki/007-Chat_System/`.

---

## 0. Clean-Session Implementation Brief

This SPEC delivers one bounded product capability: **threaded chat as a reusable
view module, with a hidden advanced action that moves the current chat into a
content tab and creates an empty new Main Chat in the same visible thread.**

The normal user experience remains simple:

```text
Threads rail | Main Chat | Content worksurface
```

A view may independently show or hide the rail, chat, and content. A Side Chat
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
  └── Chat A (Main Chat)

After
  Visible Thread G
  ├── Chat B (new, empty Main Chat)
  └── Chat A (unchanged Side Chat in a centered content tab)
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
3. The same chat UI must mount as the Main Chat column or inside a content
   tab without duplicating behavior.
4. Multiple mounted chats must stream, stop, warm, draft, and report usage
   independently.
5. A user must be able to move the current chat into a Side Chat tab and begin
   with a completely empty Main Chat while keeping one visible thread row.
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
| B4 | A visible thread owns its display name, view binding, ordering metadata, membership, and primary-role history. Its owning view capsule stores that thread's content-worksurface snapshot. An underlying chat session owns its transcript, exchanges, harness identity, portable model/variant selection, provider-session binding, runtime, usage, and composer state. Portable selection and provider binding are separate validated namespaces even while the current database serializes both in `harness_config`. |
| B5 | The selected visible thread renders its current **Main Chat** in the ordinary chat position. Internally, this is the group's current primary session. |
| B6 | **Move Chat to Side Chat** moves the current Main Chat into a content tab and immediately creates a new, durable, cold, empty Main Chat inside the same visible thread. |
| B7 | Move Chat to Side Chat never copies messages, provider session state, summaries, prompts, or hidden context into the new Main Chat. Fresh means fresh. |
| B8 | The old chat remains unchanged and interactive in its Side Chat tab. Closing that tab does not delete or archive the chat session. |
| B9 | A Side Chat tab mounts the same reusable chat module, centered in the content surface. It never mounts a persistent Threads rail beside itself. |
| B10 | The centered Side Chat retains the shared chat header, including the current list/menu button and its menu behavior. It is not a reduced or bespoke chat UI. |
| B11 | The visible thread retains one current Main Chat at all times after creation. Every internal primary change is recorded append-only; the current Main Chat is the newest committed transition. |
| B12 | The visible thread umbrella is the parent. Its chat sessions are peer members. Do not create chat-to-chat parent, child, sibling-role, or Fork relationships; chronology comes from immutable membership order and primary-change history. |
| B13 | The visible thread remains bound to one view. Move Chat to Side Chat changes only the Main Chat session and content tabs; it does not move the umbrella to another view. |
| B14 | Only content-worksurface state is restored per visible thread. Shell chrome, chat transcript state, and whether the Threads rail/chat column are exposed are not embedded in the worksurface snapshot. |
| B15 | An assigned folder is a worksurface starting context, not a filesystem, permission, or reasoning boundary. |
| B16 | Every view capsule has an immutable manifest-owned ID. Folder name, numeric order prefix, and display name are presentation and may change without affecting thread ownership. |
| B17 | Existing workspace-owned threads without a resolvable view are preserved without guessed view ownership in that workspace's **Legacy Threads** population until explicitly assigned to a view by a future flow. |
| B18 | The legacy floating, sticky, and minimized Secondary Chat UI is removed. Side chats exist as content tabs only. |
| B19 | Fork is removed from Fusion's UI, client actions, WebSocket protocol, server services, OpenCode invocation, tests, roadmaps, and active plans. **Send to Chat** is the explicit, simpler mechanism for bringing prior material into another chat. |
| B20 | This SPEC does not move view capsules. It makes the central registry/service the only owner of their physical location so the dependent View-Configured Thread Collections SPEC can migrate them from `ai/<machine>/Views/` to `ai/<machine>/System/Views/` without changing thread identity or consumers. |
| B21 | The future structural move must preserve the separation between a capsule and its declared content root and must not treat filesystem placement alone as a security boundary. This SPEC must not create direct-path dependencies or generic harness write routes that the protected-System follow-up would need to preserve. |
| B22 | New visible-thread creation is a server-owned mutation accepted in this SPEC only from the trusted shell's direct user-action path. View configuration, agent output, content-root files, raw sockets, and harness processes cannot grant that authority. A future automation path requires a separately specified server-stored user grant; no automation-origin creation route ships here. |
| B23 | View configuration remains inspectable and portable. Future GUI editors and direct user JSON editing must operate on the same canonical schema and validated Fusion-owned write service rather than create separate sources of truth. |
| B24 | Any future clone/import path remints instance identity and copies only portable declarations. It does not copy secrets, granted permissions, consent records, active sessions, thread history, or ordinary runtime/view state; requested capabilities require fresh consent. This is a compatibility constraint, not added clone UI scope. |
| B25 | Future folder/tag organization is view-configured. Thread metadata always retains multiple stable, ranked collection-ID assignments. `mode: "folders"` is the default and projects only the highest-ranked valid assignment; `mode: "tags"` projects every valid assignment. Selecting another folder raises that assignment's rank without deleting the others. Fusion always injects a non-removable **Archive** collection; its button clears all assignments, and any thread with no currently valid assignment resolves there without being deleted. This is a forward-compatibility constraint, not collection-UI scope for this SPEC. |
| B26 | Project creation and thread creation are separate operations. A user creates a Project Viewer in side navigation once; that view owns the project content-root/workspace binding and may supply view-level instructions or a CWD override. New Chat inside it creates only a visible thread group and initial chat session using the already-resolved view context. It never creates a project folder, starter documents, or a new view, and never accepts a client-supplied folder ID/path as part of thread creation. Existing chat transcript-mirror persistence remains unchanged. |
| B27 | A moved-to-side replacement session inherits only the old primary's server-resolved `harnessId` and portable `{model, variant}` selection. The source is the session's last acknowledged selection, or the current effective server default when no explicit selection exists. This preserves the user's execution preference without copying context. Provider session IDs, resume/fork fields, process state, credentials, pending turns, and other provider-private data are never copied. Composer model/variant state is keyed by pending-intent ID before commit and by `threadId` afterward, never by panel/view alone. |
| B28 | This test-stage migration may explicitly retire legacy thread/exchange pairs whose `workspace_id` is null or no longer identifies a registered workspace. It never guesses ownership from `project_id`, a basename, or the active workspace. Every workspace-owned chat remains losslessly preserved and backfilled. |

### 2.1 Normal and advanced presentation

Normal use stays one row to one apparent conversation:

```text
Threads rail
└── Release Planning          Main Chat: Chat A
```

After using Move Chat to Side Chat twice, the rail still shows one row:

```text
Threads rail
└── Release Planning          Main Chat: Chat C

Content tabs owned by Release Planning
├── Side Chat 1               Session A
└── Side Chat 2               Session B
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

### 3.6 Main Chat and Side Chat

**Main Chat** and **Side Chat** are the exact user-facing designations. UI copy,
accessible names, fallback titles, help text, and user documentation must not
call either surface Primary Chat, primary chat, Secondary Chat, child chat, or
sibling chat.

Main Chat means the member currently rendered in the ordinary chat position.
Persistence and protocol continue to call its durable group role `primary`,
including `current_primary_thread_id`, primary events, and compare-and-swap
fields. Side Chat means a peer member projected into a content tab; persisted
descriptor/projection discriminators may continue to use `side-chat`.

This terminology decision does not add or rename database columns, tables,
protocol fields, or durable enum values. Do not store `main` or `side` as a
mutable membership role. Main Chat is derived from the newest committed primary
transition; Side Chat placement is derived from view state and its durable
projection record.

### 3.7 Membership chronology

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
| `LegacyThreadHost` | Workspace-level host for migrated groups whose `view_id` is null. It lists/selects Legacy Threads and mounts their current Main Chat without inventing a view or worksurface. |
| `SideChatTab` | Content-tab adapter that centers `ChatSurface` for one explicit member session. It never renders `ThreadRail`. |
| `WorksurfaceAdapter` | View-owned capture, validation, migration, and restore of opaque content state for a selected thread group. |

`ChatSurface` is the portable presentation boundary. It receives explicit data
and callbacks and does not read app-global stores, call WebSocket code, or own
routing. A connected host/controller hook resolves store state and actions for
the exact `{workspaceId, viewId, threadGroupId, threadId, surfaceId}` tuple and
passes them into `ChatSurface`. `ThreadedChat` and `SideChatTab` are connected
composition hosts, not alternate chat implementations. `viewId` is nullable
only in `LegacyThreadHost`; that host supplies no worksurface adapter or content-
tab capabilities and never substitutes the currently selected view.

### 4.2 Mounting matrix

| Host presentation | ThreadRail | ChatSurface | Content |
|---|---:|---:|---:|
| Standard view | yes | Main Chat | yes |
| Threads hidden | no | Main Chat | yes |
| Chat hidden | yes | no | yes |
| Full-screen content | no | no | yes |
| Side Chat content tab | no local rail | explicit member session, centered | the tab itself |
| Workspace Legacy Threads | legacy population | current Main Chat | no view-bound content surface |

The outer view may still show or hide its normal Threads rail. A side-chat tab
must never inject another persistent rail into its own content.

### 4.3 Required `ChatSurface` contract

The precise TypeScript spelling may vary, but the boundary must carry these
concepts explicitly:

```ts
type ChatSurfaceProps = {
  surfaceId: string;
  workspaceId: string;
  viewId: string | null; // null only in the workspace LegacyThreadHost
  threadGroupId: string;
  threadId: string; // exact underlying session
  host: 'primary' | 'side-tab' | 'legacy-primary'; // internal presentation discriminator; never user-facing copy
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
moves externally rooted content or rewrites its declaration. Content physically
inside a view-relative root moves losslessly with the capsule and continues to
resolve through the unchanged relative declaration. Moving any other content
requires an explicit content-root change.

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
another generic Fusion file route. The rule applies equally to future
harnesses. This is not yet a direct host-filesystem boundary: an unsandboxed
harness with workspace access can still write System through native tools until
the later protected-root threat model lands. Neither this SPEC nor the dependent
relocation SPEC may claim otherwise.

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
| `workspace_id` | Required registered workspace owner. |
| `view_id` | Immutable view binding; nullable only for workspace-owned Legacy Threads. |
| `name` | User-visible title; nullable for existing fallback-title behavior. |
| `current_primary_thread_id` | Exact current member session. Required after group creation commits. |
| `created_at` | Creation timestamp. |
| `updated_at` | MRU/activity timestamp for the visible rail row. |
Indexes must support `{workspace_id, view_id, updated_at}` and the workspace-
owned Legacy population where `view_id IS NULL`.

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
| `projection_id` | Stable idempotency key. An open uses the matching primary-event sequence; the only possible group deletion uses `delete:{workspaceId}:{groupId}`. |
| `workspace_id` | Required workspace owner retained even after group deletion. |
| `group_id` | Logical owning/deleted visible-thread identity. It deliberately does not use a cascading foreign key because a delete-cleanup instruction must survive deletion of the group row. The domain service enforces existence for live open-tab instructions. |
| `view_id` | Required owning immutable view. Legacy groups never create a row in this table. |
| `kind` | `open-side-chat-tab` or `remove-group-worksurface`. |
| `member_thread_id` | Session to place in the side-chat tab; null for group cleanup. |
| `member_ordinal` | Deterministic fallback label input; null for group cleanup. |
| `status` | `pending`, `applied`, or `cancelled`. |
| `created_at` | Creation timestamp. |
| `terminal_at` | Nullable applied/cancelled timestamp. |

The outbox records a pending projection instruction, not the worksurface
snapshot. It is inserted in the same transaction as the matching primary event.
Applying it through the view-state service is idempotent. `cancelled` means the
user durably closed the projected tab before initial application completed.
Keep terminal records long enough to make retries and diagnostics deterministic;
`open-side-chat-tab` records remain for the life of their group/member so an
explicit deep link can resolve the original stable `projectionId`. They are not
replayed merely because they remain. Any later retention policy must not make a
still-pending instruction disappear.
An open-tab worker must verify that the group and member still exist before
writing view state. A missing group cancels that instruction and relies on the
transactionally created `remove-group-worksurface` instruction; it never opens
a tab for a deleted group.

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

The existing `harness_config` JSON column does not make all of its keys one
copyable policy object. The thread manager/harness adapter must expose two
allowlisted operations:

- **portable selection:** the server-validated `model` and optional `variant`
  for that session; and
- **provider binding/runtime metadata:** `opencodeSessionId` or an equivalent
  provider resume identity, Markdown-sync metadata, and future provider-private
  fields.

Client prompt/draft messages may propose only the portable selection, which the
server validates against the effective harness/view/workspace policy. Provider
binding fields come only from the owning adapter/manager and are never accepted
from a client. A clone-like session creation operation must construct a fresh
config from the portable allowlist rather than spreading or shallow-copying the
JSON object. Fork-era `pendingFork`/`forkProvenance` fields are removed in
Slice 2 and are not valid in either namespace.

### 6.6 Migration

Before group backfill, identify legacy test rows whose `workspace_id` is null or
does not identify a registered workspace. Under the owner's explicit test-stage
retirement decision, delete only those session rows and their exchanges in one
migration transaction. Do not consult `project_id`, basename, or current UI to
assign them. Record only bounded counts and thread IDs in migration diagnostics,
never transcript content. `ThreadManager` then runs a one-time generated-mirror
reconciliation over each registered workspace's canonical Chatlogs root,
removing exact thread-ID mirrors that no longer have a SQLite session; missing
files are success. An unattached/unknown filesystem is not searched or claimed
as owned. This is a named destructive test-data exception, not a general policy
for future migrations.

For every remaining workspace-owned `threads` row:

1. Create one `thread_groups` row.
2. Use the existing `thread_id` as the initial `group_id` so existing links can
   continue resolving without guesswork.
3. Add the existing session as ordinal 1 with `origin_kind='initial'`.
4. Set it as current primary and append the initial primary event.
5. Append the initial group-activity event and seed group MRU from the preserved
   session `updated_at`.
6. Preserve its title, timestamps, status, workspace, harness,
   exchanges, and Markdown history.
7. If its existing `view_id` resolves within that workspace, retain it;
   otherwise leave group `view_id=NULL` and expose it through that workspace's
   Legacy Threads.
8. Do not infer a view from the UI active during migration.
9. Do not copy the existing global view state into every migrated group. The
   owning view's `threadWorksurfaces` map begins without an entry and its
   adapter supplies the safe default on first selection.

Migration is idempotent and transaction-safe. Never delete workspace-owned chat
data; the only destructive set is the preflighted null/unregistered-workspace
test data authorized above.

### 6.7 `thread_mirror_deletions`

Markdown mirrors require a manager-owned durable deletion journal because the
filesystem cannot participate in the SQLite group-delete transaction. Before a
member `threads` row is removed, `ThreadManager` inserts one row:

| Field | Contract |
|---|---|
| `deletion_id` | Stable key `mirror:{workspaceId}:{threadId}`; primary key. |
| `workspace_id` | Workspace registry identity used to resolve the current canonical chatlog root. |
| `group_id` | Logical deleted-group identity retained without a cascading foreign key. |
| `thread_id` | Deleted session identity and deterministic mirror filename input. |
| `status` | `pending` or `applied`. |
| `failure_code` | Nullable bounded/redacted diagnostic; never transcript content. |
| timestamps | Created, updated, and nullable applied timestamps. |

The journal never stores transcript text or an arbitrary client path. After the
SQLite delete commits, `ThreadManager` removes the canonical mirror (missing is
success) and marks the row applied. Failure remains pending and retries on
startup/workspace reattach through `ThreadManager`; terminal rows remain for the
bounded action-idempotency/diagnostic window. A repeated group Delete returns
the stored result by joining the stable group-cleanup projection to the
`{workspace_id, group_id}` mirror-journal index and cannot skip or duplicate
these member cleanup rows. That aggregate is scoped to one deleted group even
when unrelated deletions are pending concurrently.
Enforce unique `{workspace_id, group_id, thread_id}` rows and index
`{workspace_id, group_id, status}` for retry/result lookup.

### 6.8 Visible-thread MRU ownership

`thread_groups.updated_at` is the sole ordering timestamp for group-backed
Threads rails. The group domain service exposes one
`recordAcceptedUserActivity(groupId, threadId, occurredAt)` write boundary that
verifies current membership and advances the group timestamp monotonically
(`max(current + 1, serverOccurredAt)`). A stable `group_id` tie-break makes list
ordering deterministic across equal timestamps.

Idempotency is durable, not inferred from the timestamp. Add
`thread_group_activity_events` with server sequence primary key, unique
`activity_id`, `group_id`, nullable member `thread_id`, `kind` (`initial`,
`prompt-accepted`, or `move-to-side-chat`), and `occurred_at`. Prompt activity ID
is `prompt:{threadId}:{turnId}`; initial creation uses `initial:{groupId}` and
Move uses `move:{primaryEventSequence}`. `group_id` has a cascading foreign key;
`thread_id` is required only for prompt activity. Inserting the event and
updating the cached group timestamp share one transaction. A duplicate event
returns the already-recorded group snapshot without advancing MRU.

The server invokes that boundary exactly when it durably accepts a user prompt
and emits `message:sent` for any existing member session. New pending-chat
commit sets the initial group activity in its creation transaction; Move Chat to
Side Chat advances it in the structural transaction already defined in §10.2.
Passive open/warm/resume, assistant-only streaming, and list/view hydration do
not affect group MRU. Rename may update ordinary metadata audit time but must
not silently become a rail-ordering event unless the product policy is changed
explicitly.

Prompt acceptance does not emit `message:sent` or hand the turn to the provider
until the group activity write succeeds. A failure rejects/restores the prompt
through the existing acceptance path and leaves ordering unchanged; retry
cannot double-advance the same accepted turn because the activity write is
idempotent by canonical turn ID.

The current `ThreadManager.recordSavedExchange()` may continue maintaining
session compatibility/count metadata, but its session `updated_at` is no longer
a visible-list source. Canonical prompt acceptance calls the group service; turn
finalization must not omit or independently compete with that group write.
Migration seeds each group timestamp from its preserved initial session. Group
list queries order only by group `updated_at` plus the stable tie-break.

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
currentLegacyThreadGroupIdByWorkspaceId: Record<WorkspaceId, ThreadGroupId | null>;
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
thread is committed before first send. It executes as the New Chat sub-slice
after this SPEC's group persistence and commit primitive exist, rather than as
a separate prerequisite that would create a dependency cycle. This SPEC must
use that canonical New Chat creation service rather than create a competing
path.

### 7.4 Legacy Threads

Legacy groups with `view_id=NULL` remain reachable from a workspace-level
Legacy Threads population. They do not appear in every view and are not
automatically assigned. Reassignment UI and folder/tag organization are outside
this SPEC; persistence must permit a later explicit reassignment.

`LegacyThreadHost` is a real workspace-level route, not a projection into the
currently selected view. It owns `currentLegacyThreadGroupIdByWorkspaceId`,
mounts the selected group's current primary with `viewId: null`, and supports
normal session hydration/send/stop plus group Rename, Delete, Copy Link, and
current-primary View Markdown. It has no `WorksurfaceAdapter`, content-tab host,
collections, or Move Chat to Side Chat action. Consequently it performs no
view-state write and cannot create or reopen a side-chat placement. Delete uses
the same runtime barrier and member/mirror ownership as any group but returns
`viewStateStatus: 'not_applicable'` and creates no `remove-group-worksurface`
projection. No handler may fill a null binding from the active view.

Copy Link for a Legacy primary uses the group-only URI in §10.6. Resolution
returns `hostKind: 'legacy'` and `viewId: null`; after server validation the
client enters `LegacyThreadHost` and selects the group. Member-specific Legacy
links are rejected because this SPEC never creates Legacy side members or a
view-owned placement. A later explicit reassignment flow may bind such a group
to a view, but that flow is outside this SPEC.

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
- composer model and variant selection;
- diagnostics and todo state; and
- any connecting overlay state.

The existing `projectChats[threadId]` is the correct direction. Move remaining
global `contextUsage`, `tokenUsage`, `chatActive`, and `wireReady` values into
the same per-session boundary or an equivalent keyed runtime map.

Replace the current panel-keyed `composerModelConfig[currentPanel]` ownership.
A committed surface reads/writes selection by exact `threadId`; a pre-commit New
Chat row reads/writes it by `intentId` and transfers the server-normalized value
to the committed `threadId`. Opening two sessions in one view therefore cannot
change the other session's menu or next prompt. Server hydration/commit results
remain authoritative when client cache and persisted session selection differ.

For a committed session, changing model/variant uses the canonical
`thread:action` dispatcher with `action='set_harness_selection'`, exact
`threadGroupId`/`threadId`, and the proposed allowlisted selection. The server
verifies membership and current policy, updates only portable keys through
`ThreadManager`, preserves provider-binding keys, and returns the normalized
selection. The client commits the menu change only from that acknowledgement;
prompt acceptance also validates/persists the same exact session selection as a
race-safe fallback. Move is unavailable while that session action is pending,
and the group mutation queue reads the last acknowledged value. Pending intents
remain RAM-only until their first send and follow the separate draft contract.

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

The current writer sends unknown new top-level keys to workspace-shared state,
so this SPEC must explicitly register `threadWorksurfaces` as a forced per-view
key in the view-state writer/service. The server validates the bounded envelope,
group/view ownership, revision, and size; the active view's adapter sanitizes the
versioned payload. No generic arbitrary System-file write route is introduced.

The current `state:set` route has `clientMutationId` correlation and a per-view
write queue but no compare-and-swap revision. This SPEC adds an opaque
`viewStateRevision` derived from the exact per-view override document (for
example, a canonical content hash) to `state:result`. Group-keyed worksurface
writes must include the expected token. Under the existing per-view queue, the
server compares the token, applies the bounded patch atomically, and returns a
new token or a conflict plus current state. The token is concurrency control,
not a second state document or a value interpreted by the renderer.

Each client has one view-state write coordinator per `{workspaceId, viewId}`.
It retains the last acknowledged base plus every exact dirty/pending
group-replacement keyed by `clientMutationId` until acknowledgement or explicit
conflict resolution. A remote state fact may replace locally rendered state
only when its previous revision matches and there is no dirty/pending
replacement for the affected group. When local intent is pending, the
coordinator records the new authoritative base without overwriting that intent,
performs a bounded three-way rebase from the mutation's acknowledged base, and
retries with the new expected revision. Side-chat descriptors and projection
tombstones are service-owned entries keyed by `projectionId`: an ordinary
content capture cannot remove or overwrite a remotely added/closed placement.
The coordinator merges such a service-owned placement into/away from the
rendered dirty surface immediately by `projectionId`, while preserving and
rebasing the user-owned pending fields.
Only the explicit acknowledged side-tab close operation may add its tombstone
or remove that descriptor. For user-owned tabs/locations, the retained local
fields win only where they changed from the captured base; untouched remote
fields survive. An ambiguous same-field collision remains `conflict_pending`
and visibly retryable rather than guessing. Concurrent edits to the same group
therefore resolve as ordered accepted CAS writes or an explicit conflict; they
never silently discard an unacknowledged local snapshot or a system projection.

After a successful group-worksurface write, the existing view-state message
family also emits a server-owned `state:changed` application fact to every open
window in the workspace. This is not a second command route. It carries the
immutable `viewId`, affected `threadGroupId`, `clientMutationId` when one exists,
the previous and resulting opaque `viewStateRevision`, and one bounded,
adapter-sanitized replacement for that group's worksurface. Projection writes
also carry `projectionId`, `placementStatus: 'open' | 'closed'`, and the
outbox's `projectionStatus: 'pending' | 'applied' | 'cancelled'`. Placement and
outbox lifecycle are separate because closing an already-applied projection
leaves that outbox row applied while the current placement is closed. A client
applies the fact only when its held revision matches the fact's previous
revision and the coordinator has no affected dirty/pending intent; receiving
the same result revision is idempotent, and any other mismatch triggers
`state:get` plus the same retained-intent rebase rather than ordinal comparison
of opaque tokens. The fact and all opaque worksurface content are excluded from
ordinary payload logging.

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

The universal-tab SPEC lands before groups and therefore retains view-global
Capture `docViewerTabs` and File Viewer `activity.tabs` as the unbound surface
only while no group is selected. Once a group is selected, the connected
`WorksurfaceAdapter` becomes the sole writer for thread-varying tabs and related
content state. It must suppress the old top-level/activity tab writer while
group-bound. A group without a saved snapshot starts from `empty()`; Fusion does
not guess which migrated group should inherit the unbound surface and does not
copy that surface into every group. Returning to no selected group may restore
the unbound surface. The same open-tab fact is never persisted in both places.

### 9.2 Save and restore ordering

On visible-thread switch:

1. At the connected controller's transition chokepoint, synchronously snapshot
   current globals into the outgoing adapter-owned tab/worksurface model. Do not
   pass component-supplied flush arguments or add a second tab controller.
2. Place that exact outgoing snapshot in the view-state coordinator and persist
   or enqueue it through the revisioned service. The coordinator retains the
   immutable snapshot after the UI restores another group and does not discard
   it until acknowledgement or an explicit conflict rebase succeeds.
3. Select the incoming group.
4. Sanitize/migrate the incoming snapshot through the active view adapter.
5. Restore tab structure.
6. Restore active content/location.
7. Restore selections and scroll positions after their content is ready.
8. Passively hydrate the group's Main Chat and any visible Side Chat tab.

Closing/restarting Fusion persists the latest controller-owned snapshot and
drains its pending view-state write. Corrupt or newer snapshots fall back to
the adapter's safe empty/default state without blocking the Main Chat.
Failure to drain remains visible and retryable; it is never reported as saved.

View-state writes use the existing `state:get`/`state:set` path plus this SPEC's
new compare-and-swap token. `clientMutationId` continues to correlate a request;
it is not the revision. `viewStateRevision` belongs to the per-view override
document, not the SQLite thread group.

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

The deterministic fallback label is the member ordinal (`Side Chat 1`, `Side
Chat 2`, and so on). This is core structural labeling, not automatic semantic
naming.

The threads implementation consumes the accepted Tabs as Containers host
contract. It does not implement generic container creation, empty-tab behavior,
launcher configuration, component registration, or container lifecycle. If
that prerequisite has not landed and passed its own acceptance gate, stop before
Slice 6 and report **Move Chat to Side Chat** as blocked. Do not absorb the
missing prerequisite into this SPEC or create a thread-specific tab system.

### 9.4 Cross-store recovery

SQLite and the view folder cannot share one transaction. The committed group
transition is authoritative and a durable projection-outbox row makes the
side-tab placement recoverable without storing a second worksurface:

1. commit the session membership, primary transition, and pending
   `open-side-chat-tab` projection in SQLite;
2. write/focus the previous primary's side-tab descriptor through the owning
   view-state service;
3. mark the projection applied only after the view-state write succeeds;
4. fan the authoritative `state:changed` worksurface replacement, applied
   projection status, `placementStatus='open'`, and resulting
   `viewStateRevision` to every workspace window;
5. acknowledge the completed action with both the authoritative transition and
   `viewStateStatus: 'persisted' | 'repair_required'`; and
6. on startup/reconnect, retry pending projections through the same idempotent
   view-state operation.

The projection/repair key is
`{viewId, threadGroupId, primaryEventSequence}`. A crash after writing view
state but before marking the projection applied may replay it; replay must
focus or preserve the existing descriptor, never create a duplicate tab.
Applied or cancelled historical projections are not replayed, so intentionally
closed tabs do not reopen. Corrupt view state falls back safely and does not
infer desired open tabs from all historical moves. A view-state failure does
not undo or obscure the committed new primary. The current pending projection,
including its intended side-tab descriptor, is part of the authoritative
primary-change fact described in §10.3; clients never reconstruct it from the
historical event log.

Every projected side-tab descriptor carries its `projectionId`. Closing it is
a durable view-state action, not an optimistic local removal:

1. write one view-state revision that removes the tab and adds a tombstone for
   its `projectionId`;
2. after that write succeeds, mark a still-pending outbox row `cancelled` (or
   leave an already-applied row terminal);
3. fan the successful write as a `state:changed` removal/tombstone replacement
   to every workspace window, using the previous/resulting revision pair and
   `placementStatus='closed'` plus the cancelled/applied outbox status;
4. only then acknowledge the close and remove the visible tab; and
5. on projection replay, check the tombstone before opening—when present, mark
   the outbox row `cancelled` and do not recreate the tab.

If the close write fails, the UI reports failure and keeps/reopens the tab. A
crash after the tombstone write but before the outbox update is safe because
replay observes the tombstone. Tombstone cleanup may occur only after the
outbox row is durably terminal. A window that misses the removal fact reloads
the authoritative worksurface through `state:get` on reconnect; delivery
failure never repeats or reverses the close write.

Group deletion first crosses a server-owned runtime barrier. The group service
acquires the exclusive group-mutation lease shared by every membership/primary
mutation, marks it `deleting`, enumerates every member, and asks
`ThreadRuntimeManager` to prove each member is idle/terminal with no accepting,
in-flight, finalizing, stopping, canonical-event, or persistence-drain work. If
any member is busy, Delete returns `thread:action:error` with bounded code
`group_busy`, releases the lease, and mutates nothing; the user may Stop the
exact sessions and retry. The UI may disable Delete from known state, but this
server check is authoritative.

Once all members are terminal, the runtime manager fences the member generation
under that lease, detaches/closes any idle provider wire, and awaits all
canonical event and persistence queues. New prompt/open-assistant/runtime
mutations for those members are rejected as `group_deleting`; late provider
frames from the fenced generation are quarantined and cannot write exchanges,
recreate runtime snapshots, or fan client events. If fencing or drain fails,
the service releases the barrier and performs no SQLite delete. Passive reads
may return a deleting status but grant no new runtime authority.

Move Chat to Side Chat must acquire this same exclusive lease before reading the
expected primary or creating a session. If Move wins, its full SQLite transition
commits and releases before Delete can enumerate, so Delete sees and fences the
new member and cancels any pending projection. If Delete wins, Move receives
`group_deleting` (or not-found after commit) and creates nothing. Rename and
collection mutations may use the same coordinator according to their own
conflict policy, but no membership-changing operation may bypass it.

For a view-bound group, deletion then uses the projection outbox rather than
treating file-backed state as a best-effort afterthought. In the authoritative
SQLite delete transaction, the group service cancels all pending open-tab
projections, inserts one idempotent `remove-group-worksurface` instruction keyed
by `delete:{workspaceId}:{threadGroupId}`, asks `ThreadManager` to journal one
pending mirror deletion per member, and deletes the group plus member
sessions/exchanges through their owning services. The cleanup instruction
survives because projection `group_id` is a logical tombstone key rather than a
cascading foreign key. A Legacy group skips the view projection entirely but
uses the same runtime fence, member deletion, and mirror journal.

After commit, the view-state service removes
`threadWorksurfaces[threadGroupId]`, every side-tab descriptor for a view-bound
group, and associated placement tombstones, then fans the authoritative
`state:changed` removal and marks cleanup applied. Legacy deletion performs no
view-state operation. The delete response reports
`viewStateStatus: 'persisted' | 'repair_required' | 'not_applicable'` and
`mirrorCleanupStatus: 'persisted' | 'repair_required'`. Only after commit does
the runtime manager discard the fenced snapshots; the group tombstone keeps any
late old-generation frame inert. View-state or Markdown cleanup failure never
resurrects the SQLite group: startup separately retries the pending projection
when one exists and every pending mirror row through `ThreadManager`. Once
cleanup is applied and no related retry can observe the tombstones, ordinary
retention may remove the terminal projection and mirror-journal rows.
Repeated Delete with the same or a new request ID finds the group-indexed mirror
rows in every case and, for a view-bound group, the stable cleanup projection.
Those durable deletion records return the stored deleted status plus current
aggregate mirror status and either view cleanup status or `not_applicable`;
the request never creates another instruction or re-enters member deletion.

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
- a `set_harness_selection` request for the primary is pending; or
- group deletion holds or is waiting on the exclusive mutation lease; or
- a Move Chat to Side Chat request for the group is already pending.

Side Chat surfaces retain the same list/menu button and common menu behavior,
but do not recursively offer Move Chat to Side Chat for a non-primary member.

### 10.2 Canonical command and authoritative transition

Client request includes:

```json
{
  "type": "thread:action",
  "action": "move_chat_to_side",
  "requestId": "...",
  "threadGroupId": "...",
  "expectedPrimaryThreadId": "chat-a"
}
```

The server acquires the shared exclusive group-mutation lease, then derives the
immutable view binding and validates workspace ownership, membership, expected
current primary, non-deleting state, and terminal runtime state. It revalidates
group existence, member set, and expected primary inside the SQLite transaction.
A canonical thread-action handler introduced by this SPEC routes this
Fusion-owned action to a focused thread-group domain service; no harness adapter
is called. The current code still has separate `thread:rename`, `thread:delete`,
`thread:copyLink`, and related handlers, so builders must not assume the
dispatcher already exists.

In one SQLite transaction the service:

1. creates Chat B as a durable, cold, empty underlying session through a
   transaction-capable `ThreadManager` creation primitive using Chat A's
   server-resolved `harnessId` plus only its portable `model`/`variant`
   selection (last acknowledged explicit value, or the current effective
   server default when none is stored); the manager constructs a fresh config
   and does not copy A's `opencodeSessionId`, provider/runtime metadata,
   credentials, pending state, or any unknown key. Chat B has no provider
   session and no exchange; that primitive owns the session-limit check and
   Markdown mirror;
2. adds Chat B to `thread_group_members` as the next peer ordinal with
   `origin_kind='move-to-side-chat-primary'`; no source-session or inherited-
   context relationship is created;
3. appends the primary transition event A → B;
4. sets the group's cached current primary to B;
5. inserts the pending `open-side-chat-tab` projection for Chat A keyed by the
   primary-event sequence;
6. inserts the idempotent `move-to-side-chat` group-activity event keyed by that
   same primary-event sequence; and
7. advances the group's cached activity timestamp.

The service must not insert a `threads` row directly. If the current
`ThreadManager` cannot participate in the transaction, refactor a narrow
manager-owned primitive that preserves its invariants; do not duplicate them
inside the group service. A failed database transaction leaves Chat A primary.
An unindexed empty Markdown mirror left by process death is detected and
removed or rebuilt by idempotent startup repair before it can appear as a
thread.

The action revalidates A's explicit portable selection against the current
effective policy inside the guarded transition. If it remains valid, B receives
that exact model/variant; if A has no explicit selection, the server resolves
and stores the effective default on B. If a formerly selected value is no longer allowed, the
action fails with a bounded configuration error and creates nothing; it does
not silently substitute a model during a structural Move. The completion
snapshot includes B's normalized `harnessId`, `model`, and nullable `variant`,
which initializes B's thread-keyed composer menu. A's selection and provider
binding remain unchanged.

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
    "id": "side-chat-42",
    "kind": "side-chat",
    "projectionId": "42",
    "threadGroupId": "...",
    "threadId": "chat-a",
    "label": "Side Chat 1"
  },
  "projectionStatus": "applied",
  "viewStateStatus": "persisted",
  "viewStateRevision": "opaque-result-token"
}
```

`viewStateStatus` may be `repair_required` when the group transition committed
but the file-backed projection did not; in that case `projectionStatus` remains
`pending` and no new `viewStateRevision` is claimed. The response still contains
enough authoritative data for the client to render the correct primary and tab
without pretending that the group mutation failed.

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
including the requester. The fact includes the current pending/applied
projection ID, intended side-tab descriptor, and `viewStateStatus`, so a window
can show the new primary and the intended side placement even when the
file-backed write still needs repair. It never derives that descriptor by
replaying historical primary changes. A successful projection write separately
fans the authoritative `state:changed` replacement and resulting
`viewStateRevision` from §9.1. Either delivery order converges by group event
sequence, projection ID, and the view-state revision pair. It may publish the
same post-commit primary fact to the Universal Event Bus. UEB
admission/subscriber failure never delays, rolls back, or rewrites the action
response or WebSocket fan-out.

Requester acknowledgement, each primary-fact delivery, each projection-fact
delivery, and optional UEB publication are mutually failure-isolated
post-commit operations. A closed requester or one failed/stalled recipient
cannot prevent attempts to all other recipients. Delivery code observes
failures per recipient and never rethrows them into the mutation path. A client
that misses either fact reloads the current group snapshot and view state during
normal reconnect/init; no delivery failure repeats the Move Chat to Side Chat
mutation.

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

If B is later moved to Side Chat, the same operation creates C as the Main Chat
and adds/focuses B as another tab. A remains intact. The main rail still shows one
visible thread group.

### 10.6 Canonical thread deep links

Copy Link no longer returns or copies the Markdown `filePath`. View Markdown is
a separate session action that may return the validated mirror path for the
existing File Viewer flow. Copy Link uses `thread:action` with
`action='copy_link'` and returns this versioned, URL-encoded application link:

```text
fusion-studio://thread/open?v=1&workspaceId=<opaque-id>&threadGroupId=<group-id>
fusion-studio://thread/open?v=1&workspaceId=<opaque-id>&threadGroupId=<group-id>&threadId=<member-id>
```

The first form is copied from a view-bound or Legacy Main Chat surface and
intentionally resolves the group's current primary when opened. A side-chat
surface includes its exact member `threadId`; member-specific links are valid
only for view-bound groups. Workspace identity is the opaque registry ID, never
a local path. The correlated completion includes `requestId`, `threadGroupId`,
optional `threadId`, `linkVersion: 1`, and `uri`.

Electron reserves the exact `fusion-studio://thread/open` authority/path as an
application-navigation intent before the existing custom-content protocol tries
to resolve it as a file. Cold-start/open-url and already-running/second-instance
paths forward the same bounded parsed intent to the renderer. The renderer then
sends `thread:action` with `action='resolve_link'`, the version and parsed
identities; these values identify a requested target but grant no authority.
The server compares the link workspace with the connection's authoritative
current workspace, resolves the group and its nullable binding, and, when
present, verifies exact membership and a concrete view-owned placement. For a
view-bound group it returns `hostKind: 'view'`, immutable `viewId`, current
primary, and resolved member placement. For a null-bound group it returns
`hostKind: 'legacy'`, `viewId: null`, and current primary, and rejects a supplied
member ID. Only after that success may the client change host/view/group
selection.

Opening a Main Chat link selects either the resolved view/group or the workspace
Legacy host/group and its current primary, according to `hostKind`.
Opening a valid side-member link focuses its existing descriptor or explicitly
reopens that member by revisioned view-state write using the member's original
projection ID; this user action may remove that projection's prior close
tombstone. It does not create a session, group, primary event, or context copy.
A malformed/unsupported link, unavailable workspace/view/group, deleted group,
or non-member session returns a bounded error and leaves workspace, view,
thread, tabs, and selection unchanged. Cross-workspace navigation is outside
this SPEC; a link for another workspace fails safely rather than attaching it.

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
- Copy Link identifies the visible group and, for a Side Chat, the exact member
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
   sessions/exchanges through one confirmed server operation. It first acquires
   §9.4's group delete lease; any active/draining member returns `group_busy`
   without mutation, and successful fencing prevents late runtime events from
   writing after deletion. The transaction creates the manager-owned per-member
   Markdown deletion rows and, only for a view-bound group, cancels pending
   open-tab projections and creates the durable group-worksurface cleanup
   instruction. A failed view-state or mirror cleanup reports its separate
   repair-required status and retries after restart without restoring the group.
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

- **Move Chat to Side Chat** uses the canonical `thread:action` command family
  required by the current standards with `action='move_chat_to_side'`. This SPEC
  introduces the actual handler/dispatcher in code. Do not add a
  `thread-group:*` family.
- Group actions carry `threadGroupId`; session actions carry `threadId`; an
  action that crosses the boundary carries both and the server verifies
  membership.
- `set_harness_selection` is a session action carrying both IDs plus only
  `model` and nullable `variant`. The server rejects client-supplied provider
  identity/runtime/resume/credential/unknown fields, updates portable keys
  through `ThreadManager`, and returns the normalized selection before the
  client treats the menu change as committed.
- Do not include `viewId` on a group action merely as a client assertion. The
  server derives it from the authoritative group and resolves its view through
  the registry.
- Before these mutation routes ship, Electron main and the server establish an
  ephemeral per-launch trusted-shell credential. It is presented during the
  renderer WebSocket handshake through a narrow context-isolated preload path,
  never persisted in a workspace, never logged, never exposed to iframes/custom
  views, and never inherited by harness child processes. The server binds an
  accepted connection to the trusted-shell role and its validated current
  workspace context; a raw or uncredentialed socket remains read-only or is
  rejected before mutation dispatch. Client-supplied workspace IDs are never
  sufficient authority.
- Direct user UI handlers invoke mutations only over that trusted-shell
  connection. No automation-origin mutation route ships in this SPEC. A future
  automation executor must resolve a server-stored grant scoped to workspace,
  action, and target view before it can reach the same guard. Public requests
  never accept `originKind`, permission, grant, or consent assertions.
- Creating a new visible thread requires the server-verified trusted-shell
  origin. Model output, view content, editable workspace files, custom views,
  raw local sockets, and harness processes are not authority.
- Effective launch permissions are read from server-owned policy. A request
  cannot enlarge its authority by supplying alternative view configuration,
  working-directory policy, skills, or permission fields.
- The server verifies that `threadId` is a member of `threadGroupId` before
  open, send, stop, rename, link, Markdown view, or Move Chat to Side Chat behavior that uses
  both values.
- `copy_link` returns the versioned application URI from §10.6; it never returns
  the Markdown path. `view_markdown` remains the separate session/path action.
  `resolve_link` treats parsed IDs only as requested targets, compares workspace
  to the trusted connection, validates group/view/member, and changes no client
  selection before its correlated success response.
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
- A successful group-worksurface projection or side-tab close emits
  `state:changed` through the existing view-state family with its authoritative
  revision pair and bounded group replacement. It is a post-write multi-window
  fact, not a thread action or a substitute for the requester's `state:result`.
- Requester delivery, each fan-out recipient, and UEB publication are separate
  supervised attempts. Failure in any one cannot skip the others. Reconnect
  group and view-state hydration is the recovery path for a client that misses
  either family of delivery.

---

## 14. Required Implementation Slices

Slices are dependency ordered, user-observable, end-to-end increments. Each
slice begins at a public UI/WS entry, crosses its owning service/state boundary,
and proves persistence or readback before the next slice begins. Builders may
subdivide internal tasks but must not turn these into frontend/backend/database
phases.

### Slice 0 — Trusted mutation authority

- Establish the ephemeral Electron-main/server credential, context-isolated
  preload handoff, trusted-shell WebSocket role, current-workspace binding, and
  central mutation guard before exposing any new thread/group mutation.
- Keep automation-origin creation disabled; reserve no client assertion or
  bypass for it. A later automation SPEC must add server-stored scoped grants
  through this guard before enabling that origin.
- Prove a representative guarded mutation can cross only from the trusted shell,
  while a raw socket, iframe/custom view, harness child, model-originated
  content, stale credential, wrong
  workspace, and request-supplied provenance/grant fields cannot. Later slices
  repeat this proof on New Chat and destructive group actions. Confirm
  credentials are absent from logs, workspace files, clone/export data, and
  harness environments.

### Slice 1 — Rename-safe view registry

- Keep view capsules at their current physical root but make the central
  registry the only owner of that location so a dependent SPEC can relocate
  them without changing consumers.
- Make `manifest.md` `metadata.view-id` authoritative through one central
  ID-to-current-folder registry for content, state, configuration, styles,
  restore, and reorder.
- Preserve folder suffixes on reorder; migrate missing IDs once and fail
  duplicate IDs visibly.
- Open an existing view through the public shell, restart, rename/reorder its
  capsule folder, and prove the same view, state, styles, CLI overrides, and
  declared content root resolve without changing identity. Do not create a
  visible thread in this slice; the group storage and canonical New Chat path do
  not exist yet.

### Slice 2 — Visible thread-group foundation with preserved sessions

- Before migrating or exposing any group-backed row, remove Fork end to end:
  its UI/control, client action and shared types, public `thread:fork` protocol,
  server handler/service, pending fields, OpenCode `--fork` invocation, focused
  tests, and active roadmap/plan language. Prove the route is unavailable and
  the provider cannot receive `--fork`; no compatibility alias or low-level
  Fusion escape hatch remains.
- Add the group/member/primary-event, view-projection-outbox, and manager-owned
  mirror-deletion-journal migrations, focused persistence modules, and group
  domain service, including the activity-event ledger and group-owned MRU write
  boundary; do not add worksurface columns.
- Introduce the canonical `thread:action` dispatcher before group rows become
  public. Move visible-row Rename, Delete, and Copy Link to group-aware actions;
  keep View Markdown and other session actions explicitly keyed to the current
  primary/member and verified against group membership. Remove the superseded
  session-only mutation routes and client calls in this slice. If any action
  cannot yet be made group-safe, remove/disable its control until its owning
  slice lands; no visible group row may reach a legacy single-session mutation.
- Land the version-1 primary-group URI, strict Electron parser/forwarder,
  `resolve_link` validation, and separation of Copy Link from View Markdown.
  Prove a valid primary link navigates only after server resolution and invalid
  or wrong-workspace links leave selection unchanged.
- Backfill every existing thread one-to-one without losing exchanges, harness
  configuration, status, or Markdown mirrors; unresolved view bindings
  appear only in Legacy Threads. Before backfill, scuttle only the owner-
  authorized null/unregistered-workspace test rows and their exchanges, then
  reconcile exact generated mirrors in registered roots; prove migration does
  not consult `project_id`, basename, or current UI to assign them.
- List/select migrated groups through the public Legacy Threads population when
  `view_id` is null and through a view rail for a migration fixture with a valid
  `{workspaceId, viewId}` binding. Hydrate each underlying session by `threadId`
  and prove restart/readback plus compatibility-field ownership. In the Legacy
  host prove workspace-keyed selection, send/stop, Rename, Delete, group-only
  Copy Link, and View Markdown without selecting or writing any view; prove Move,
  collections, worksurface writes, and member links are unavailable. Implement
  the group delete lease/fence here and prove an active initial member returns
  `group_busy`, then Stop/finalize, retry, and reject a late fenced frame without
  restoring data. New Chat remains unavailable within this slice rather than
  retaining a temporary eager-create path. Do not introduce a permanent
  archive-status field before ranked collections land.
- Send a prompt in an older migrated group through the public acceptance path
  and prove its idempotent activity event advances the group-backed rail before
  provider dispatch; completion/count/session metadata cannot independently
  reorder it, and passive open/warm leaves it unchanged.

### Slice 3 — Signal-gated ordinary New Chat

- Execute `PENDING_CHAT_INTENT_SPEC.md` now that the group/member/primary commit
  primitive exists.
- Route the public New Chat UI through RAM-only intent, the focused
  `thread:draft:*` handler, server-owned recovery journal/payload, canonical
  session manager, group commit, exchange owner, requester acknowledgements,
  multi-window list fan-out, and restart reconciliation.
- Remove the eager durable-create bypass before completing the slice; no
  temporary competing creation route ships.

### Slice 4 — One reusable chat in two mounted surfaces

- Extract pure `ChatSurface` presentation plus connected primary/side-tab host
  adapters with explicit group, session, view, workspace, and surface IDs.
- Key usage, readiness, active state, drafts, attachments, diagnostics, and
  messages plus composer model/variant selection by `threadId`; key
  menus/focus/DOM state by `surfaceId`. Replace panel-keyed model selection and
  add acknowledged `set_harness_selection` through the canonical dispatcher,
  preserving provider-binding fields.
- Remove the one-wire-per-WebSocket assumption while preserving passive open,
  prompt acceptance, Stop, finalization, snapshots, and stream ordering.
- Mount two sessions simultaneously through the real shell and prove they can
  hydrate, stream, stop, and finish without crossing state.

### Slice 5 — Per-thread content continuity in the view folder

- Add the versioned `WorksurfaceAdapter` contract and
  `viewStates[viewId].threadWorksurfaces[threadGroupId]` through the existing
  view-state read/write path, including forced per-view routing, an opaque
  compare-and-swap `viewStateRevision`, and bounded envelope/ownership
  validation for the new top-level key.
- Integrate the universal tab host; capture/restore only content tabs,
  locations, selections, view modes, and scroll positions in the required
  order.
- Extend the already group-safe Delete action with the durable
  `remove-group-worksurface` projection, authoritative multi-window removal,
  and restart repair before any group can own file-backed worksurface state.
- Switch between two visible threads through the UI and prove each restores its
  own content while shell/chat chrome remains outside the snapshot.
- Inject stale/corrupt state, restart, and prove safe fallback without a second
  SQLite owner.

### Slice 6 — Move Chat to Side Chat

- **Hard entry gate:** the separately owned Tabs as Containers SPEC is complete,
  implemented, independently accepted, and exposes the stable host contract
  consumed here. Earlier slices do not waive this gate, and the threads-domain
  orchestrator must not implement or repair generic tab-container behavior to
  get around it.
- Add `move_chat_to_side` to the canonical `thread:action` dispatcher established
  in Slice 2. Temporary within-slice aliases are not shipped.
- Add the shared-menu action and send `thread:action` with
  `action='move_chat_to_side'` through the public route.
- Execute the guarded manager-owned session creation and group transition,
  persist/project the side-tab descriptor through view state, return the
  canonical completion/error, and fan `thread:primary_changed` plus successful
  `state:changed` projection replacements to two clients.
- Prove the new primary receives only the source primary's acknowledged
  harness/model/variant selection (or resolved default), never its provider
  session ID or runtime metadata; a stale invalid selection aborts the whole
  action, and model changes in either mounted member remain independent.
- Render the unchanged old session as the same centered `ChatSurface`, with the
  shared list/menu button and no local rail; render the new primary cold and
  completely empty.
- Extend Copy Link to exact side-member URIs and explicitly reopen/focus the
  validated member through acknowledged revisioned view state, including an
  intentionally closed member, without replaying historical placements.
- Prove conflict handling, repeated moves, view-state repair, restart, tab-close
  semantics, and independent concurrent use. With two active members, prove
  Delete returns `group_busy` without partial cleanup; after both become
  terminal, retry and prove the fence drains both runtimes and quarantines
  injected late frames before member/group removal.
- Race Delete and Move from two windows on an idle group. Prove the shared
  exclusive lease yields only: Move-first, after which Delete enumerates and
  removes both members/projections; or Delete-first, after which Move returns
  `group_deleting`/not-found and creates no session. No interleaving may leave an
  unjournaled member, mirror, primary event, or side-tab projection.
- Remove the floating/sticky/minimized Secondary Chat implementation and all
  of its store/routing/geometry remnants once the tab replacement passes.
- Delete temporary compatibility aliases before the slice completes unless a
  named external consumer and removal boundary are documented.
- Update the Chat System Wiki's Identity, Runtime, UI, Structure, Decisions,
  and Changelog pages to the shipped model and record operational recovery.

---

## 15. Verification Matrix

### 15.1 Automated server checks

| Check | Required proof |
|---|---|
| Migration | Every registered-workspace thread preserves exchanges, harness IDs/config, names, timestamps, and status and receives exactly one group/member/initial-primary event plus one initial activity event. Owner-authorized null/unregistered-workspace test rows and their exchanges are deleted before backfill without basename/project/UI inference; exact generated mirrors are reconciled only in registered canonical roots. Re-running migration is safe. |
| Group MRU | Group `updated_at` is the sole visible-list timestamp. Initial creation, accepted prompts, and Move insert idempotent activity events and advance it transactionally; an older group's accepted prompt moves its row before provider dispatch. Duplicate acceptance, saved-turn/session timestamp writes, passive open/warm/resume, and assistant streaming do not double-advance or independently reorder it. |
| View registry | Folder rename and reorder preserve resolution; missing IDs migrate once; duplicate IDs fail visibly; cross-workspace equal IDs remain isolated. Every consumer resolves the current capsule location centrally so the dependent relocation SPEC has no direct-path stragglers. |
| View lists | `{workspaceId, viewId}` returns only that view's groups; Legacy rows and workspace-keyed selection stay in `LegacyThreadHost`; member sessions never duplicate rail rows. A null-bound group is never projected into the active view. |
| Group-safe actions | As soon as group rows are visible, Rename/Delete/Copy Link use group-aware `thread:action` semantics and session actions verify current membership. No legacy single-session destructive mutation is reachable from a group row. |
| Harness selection boundary | `set_harness_selection` validates group membership and allowed model/variant, updates only the exact session's portable keys, and preserves its provider binding. Two mounted members can change selections independently. A moved replacement inherits the old primary's last acknowledged valid selection (or a resolved default when absent) while every provider-session/runtime/credential field remains absent. Invalid stale selection makes Move fail without mutation. |
| Deep links | `copy_link` returns the exact version-1 application URI and never a Markdown path. `resolve_link` opens the current primary or exact side member only after workspace/group/nullable-host/view/membership validation. A Legacy group-only link selects the Legacy host with `viewId:null`; Legacy member links fail. Malformed, unsupported, wrong-workspace, deleted-group, and non-member links return bounded errors with no selection/tab mutation. |
| Move transition | DB success produces one manager-created cold empty session with Markdown mirror, one member, one primary event, one primary-pointer update, and one pending view projection. A pre-commit failure leaves none; a post-commit view-state failure returns `repair_required` and later applies exactly one side tab. |
| Move conflict | Two requests with the same expected primary yield exactly one success and one conflict. |
| Fork retirement | No UI action or public protocol can request Fork; OpenCode is never invoked with `--fork`; active plans contain no future Fork slice. |
| Delete runtime barrier | Delete rejects with `group_busy` and no mutation while any member accepts, runs, finalizes, stops, or drains. After every member is terminal, the group lease fences provider generations and drains event/persistence queues before SQLite deletion; injected late frames cannot append exchanges, recreate runtime state, or fan events. This holds for one-member Legacy groups and multi-member view groups. |
| Delete/Move serialization | Both actions acquire one exclusive group-mutation lease and revalidate inside their transactions. Move-first makes its new member visible to Delete's fence/journals; Delete-first makes Move fail before session creation. Concurrent two-window races leave no escaped member, mirror, event, or projection. |
| Authorization | Cross-workspace, wrong-view, wrong-group, and non-member session requests fail without mutation. |
| Creation authority | Direct trusted-shell user intent can create a thread; automation origin remains disabled, and model output plus client-supplied policy/permission/provenance fields cannot. |
| Transport authority | A per-launch trusted-shell handshake and server-owned workspace/provenance binding gate mutations. Raw sockets, stale credentials, iframes/custom views, and harness children cannot invoke New Chat or destructive group actions; request-supplied origin/grant fields are rejected and secrets are not logged or inherited. |
| Runtime isolation | Two sessions on one WebSocket can warm, stream, stop, and finish independently; passive open warms neither. |
| Protocol and fan-out | Public `thread:action` yields correlated completed/error response; two workspace clients receive the same `thread:primary_changed` snapshot with the intended projection, and both receive a successful `state:changed` side-tab replacement. A later acknowledged close fans the removal/tombstone replacement and closes the tab in both windows before reconnect. Injected requester-send, individual primary-recipient, individual projection-recipient, and UEB failures do not prevent the remaining delivery attempts or change committed state. A missed client rehydrates group and view state on reconnect without replaying the mutation. |
| Recovery | Missing current-primary cache recovers from valid events; a pending projection replays idempotently; applied/cancelled projections never resurrect an intentionally closed tab; invalid membership and corrupt view-folder worksurface state fail safely. Deleting a view-bound group with pending, applied, or failed-cleanup projections cancels opens, removes its worksurface/placements idempotently, and converges after restart without resurrecting the group or leaving a retry that targets deleted sessions. Deleting a Legacy group creates no view projection and reports `not_applicable`. An injected mirror-delete failure retains every member and group ID in the manager journal and removes the orphan mirror after restart/workspace reattach. Drop the first delete response, concurrently delete another group, then retry the first with a new request ID and prove its group-scoped aggregate status is exact and no deletion work repeats. |

Run the complete server suite with `npm test` in `fusion-studio-server/`.

### 15.2 Automated client checks

| Check | Required proof |
|---|---|
| Component boundary | Pure `ChatSurface` imports no store/network/controller; two connected instances render from explicit session IDs without global-selection leakage or duplicate DOM IDs. |
| Per-session state | Usage, readiness, Working, drafts, attachments, diagnostics, messages, model/variant selection, and Stop remain isolated. Changing one mounted member's selection never alters the other's menu or next prompt. |
| Per-view selection | Switching views restores each view's own selected group and does not reorder/reselect another view. Entering/leaving Legacy Threads restores its workspace-keyed Legacy selection and never substitutes the active view ID. |
| Worksurface | Switching groups captures outgoing content-only state under the owning view's `threadWorksurfaces` map and restores tabs/location/scroll in order. A switch during a CAS conflict retains and rebases the exact outgoing snapshot until acknowledged. Two windows editing the same group never let an incoming `state:changed` fact overwrite local dirty/pending intent; concurrent service-owned side-tab open/close still merges by `projectionId` and survives the rebase. Ambiguous same-field collisions remain visibly pending. Chrome is not embedded and SQLite has no duplicate snapshot. |
| Side-tab layout | Centered shared chat renders with its list/menu button and no local Threads rail. |
| Link navigation | Primary and side-member links survive copy/paste, navigation, and restart. Opening an intentionally closed side-member link performs one acknowledged reopen with its stable projection ID; invalid links preserve the entire prior selection and tab state. |
| Close semantics | Closing a side tab waits for durable view-state acknowledgement, tombstones a still-pending projection, fans the authoritative `state:changed` replacement, and removes placement in every open workspace window; transcript and membership remain. A failed close write leaves/reopens the tab everywhere. |
| Failure UI | A failed/conflicted Move Chat to Side Chat action leaves the old Main Chat visible and usable. |

Run `npm run build` in `fusion-studio-client/` plus focused component/store tests.

### 15.3 Electron acceptance walk

1. Open two different views and create/select different visible threads.
2. Switch views repeatedly; confirm each retains its own rail population,
   selected thread, Main Chat, open content, and scroll/location state.
3. Rename the active view folder without changing `metadata.view-id`; restart
   Fusion and confirm the view, state, and bound threads still resolve.
4. Point the Wiki view at a workspace-root `Wiki/`, keep the System capsule
   under ignored `ai/`, and confirm the content remains independently eligible
   for Git tracking without changing view identity.
5. In one visible thread, finish any active response and choose **Move Chat to
   Side Chat**.
6. Confirm the ordinary Main Chat is completely empty and uses a new
   underlying session ID.
7. Confirm the prior transcript is unchanged in a centered content tab.
8. Confirm the side tab has the same list/menu button and menu behavior but no
   adjacent/local Threads rail.
   Keep a second Fusion window open and confirm the same Main Chat and Side Chat
   projection appear there without reconnecting.
9. Copy/open a Main Chat link and an exact Side Chat member link after navigating away
   and after restart. Close the side tab, open its link to perform one explicit
   acknowledged reopen, then prove malformed, wrong-workspace, deleted-group,
   and non-member links leave the current selection and tabs unchanged.
10. Send unrelated prompts concurrently in the new Main Chat and old Side Chat;
   confirm messages, tools, usage, Stop, and completion never cross.
11. Restart Fusion; confirm the same visible thread row, empty/new Main Chat if
   still unused, Side Chat tab, transcript, active content tab, and scroll
   positions restore.
12. Use Move Chat to Side Chat again; confirm the rail still has one row and
    both earlier chats remain intact as tabs.
13. With a projection still pending, close its side tab and restart; confirm it
    closes in both open windows before reconnect, stays closed after restart,
    and does not delete the session. Inject a failed close write and confirm the
    tab stays/reopens in both windows. Then delete the visible thread through
    the explicit destructive path and confirm all of its members are handled
    together. Inject one member Markdown deletion failure, confirm the response
    distinguishes mirror repair from view-state repair, restart, and verify the
    manager journal removes that orphan without restoring the group.
14. Open a migrated pre-SPEC thread from Legacy Threads and confirm its history
    remains intact. Rename it, copy/open its group link, view its Markdown, and
    send/stop from the Legacy host without changing any view selection or state;
    confirm Move, collections, side tabs, and member links are unavailable.
15. While a Legacy or view-bound member is active, attempt Delete and confirm
    `group_busy` leaves group, sessions, exchanges, mirrors, and worksurface
    untouched. Stop/finalize every member, retry Delete, inject an old-generation
    late frame, and confirm it cannot write, render, or resurrect anything.
16. Load a test fixture containing one registered-workspace chat and one null/
    unregistered-workspace chat pair. Run migration twice: confirm the owned
    chat is preserved and grouped exactly once, the unowned test thread and its
    exchanges are absent, no guessed workspace/group exists, and any exact
    generated mirror in a registered canonical root is removed.
17. From two windows, race Move against Delete on the same idle group. Exercise
    both lock winners and confirm either Delete includes the newly moved member
    and projection, or Move fails before creating anything; restart with no
    escaped session, mirror, activity/primary event, or side tab.

Document pass/fail for every step in the implementation handoff.

---

## 16. Definition of Done

This SPEC is complete only when all of the following are true:

1. `ChatSurface` renders any explicit session as Main Chat or Side Chat content
   with the same behavior and no global current-thread dependency.
2. `ThreadRail` lists one row per visible group for one explicit view context.
3. Every current view capsule resolves by immutable manifest ID through the
   central registry after rename/reorder; no consumer owns the physical root.
4. Registered-workspace chat data migrates without loss or guessed view
   assignment; owner-authorized unowned test pairs are retired without guessed
   workspace ownership.
5. **Move Chat to Side Chat** transactionally moves the old Main Chat into a
   centered content tab and installs a durable, cold, empty new Main Chat.
6. No transcript or hidden context transfers automatically.
7. Multiple mounted sessions route, stream, stop, and report usage independently.
8. The owning view folder restores each visible thread's content worksurface,
   including side-chat tabs, exactly after thread switch and application
   restart; SQLite does not duplicate that state.
9. Primary-role history is append-only and deterministically ordered.
10. Side Chat tabs have no local rail but retain the shared list/menu control
    and behavior.
11. The legacy Secondary Chat popup/sticky/minimized implementation and routing
    workarounds are removed.
12. Client build, server tests, focused client tests, migration tests, and the
   Electron acceptance walk pass.
13. Move Chat to Side Chat uses `thread:action`; no `thread-group:*` transport
    family exists.
14. The requester and all workspace windows converge on the same committed
    primary and current side-tab projection/removal before reconnect whenever
    their deliveries succeed, and recover both through group plus view-state
    hydration when a delivery, UEB publication, or view-state projection fails.
15. Pending view projections replay idempotently, while an applied projection
    never reopens a side tab the user later closed.
16. Capsule identity and content-root resolution are independent of physical
    folder location, allowing the dependent relocation SPEC to move the capsule
    without moving content.
17. New-thread and destructive group authority comes only through the
    server-verified trusted-shell connection. Automation origin remains disabled
    pending its own server-stored-grant SPEC; model output, raw sockets, harness
    children, custom views, and request-supplied
    permission/configuration/provenance fields have no authority.
18. Group deletion transactionally creates one manager-owned Markdown deletion
    row per member and, for a view-bound group, a durable worksurface cleanup
    projection. Pending/applied/failed cleanup converges across view state,
    mirrors, open windows, and restart without orphaned worksurfaces/transcripts
    or resurrected side tabs/groups.
19. Copy Link emits the versioned application URI, not a Markdown path; primary
    and exact side-member links resolve through server-validated
    workspace/group/nullable-host/view/membership rules and invalid links never
    change selection.
20. Legacy groups have workspace-keyed selection and a nullable-host contract:
    their Main Chat, Rename/Delete/Copy Link/View Markdown, and group link work
    without a guessed view, while worksurfaces, Side Chats, collections,
    and member links remain unavailable.
21. Group Delete cannot begin while any member runtime is active or draining.
    Once all members are terminal, a group-scoped fence drains canonical writes
    before deletion and permanently rejects late frames from the old generation.
    Its exclusive group-mutation lease also serializes against Move so membership
    cannot change between enumeration and deletion.
22. Harness configuration has an enforced copy boundary: pending first send
    retains its validated model/variant through commit; committed surfaces store
    selection by session; Move copies only that portable selection and harness
    ID into the new primary while provider identity/runtime fields stay fresh.
23. Null/unregistered-workspace legacy test pairs are the migration's only
    destructive exception. They are removed before group backfill with bounded
    diagnostics and registered-root mirror reconciliation; every owned row is
    preserved.
24. Group-backed rail ordering reads only group MRU. Initial creation, Move, and
    each accepted canonical prompt write one idempotent activity event and
    advance that cache before acknowledgement/provider dispatch; session
    finalization timestamps and passive runtime activity cannot reorder rows.

---

## 17. Explicitly Out of Scope

- automatic or LLM-generated thread naming;
- attachment-aware naming and attachment icon stacks;
- automatic transcript summaries or context inheritance;
- the agent/helper implementation for explicit resume handoffs;
- arbitrary “create Side Chat” actions beyond Move Chat to Side Chat;
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
- automation-origin thread creation and its server-stored grant model;
- mobile layouts; and
- using filesystem inode metadata as durable identity;
- direct harness/OS protected-root enforcement for `System/Views` and the
  broader System tree; the dependent collections SPEC closes generic Fusion
  mutation routes, while the host-filesystem boundary requires its own threat
  model and implementation SPEC. This SPEC must still centralize privileged
  System/View services and must not create another Fusion-route bypass; and
- the visual GUI builders/editors, package export, and clone/import workflows
  for views, components, templates, and other System configuration; this SPEC
  preserves their single-schema/write-service and portability seams but does
  not build those experiences.

These features may build on the stable group, session, view-ID, worksurface,
and `ChatSurface` seams established here. They must not be partially introduced
inside this implementation.

---

## 18. Historical Closure — Non-Authoritative

This combined document is not an executable or conflict-resolving authority.
Its active replacements named in the header control their respective domains,
including any requirement wording that differs from this historical snapshot.
Use this file only to trace why requirements were split and to check that no
owner decision disappeared during extraction. Newly discovered product choices
belong in the applicable active SPEC and return to the owner when required by
that SPEC's decision boundary.
