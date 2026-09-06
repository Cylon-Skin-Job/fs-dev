# Composable Threaded Chat Module — SPEC

**Date:** 2026-09-03
**Status:** Implementation-ready; extracted from the superseded combined chat/Side Chat SPEC and bounded to chat composition, view-bound visible threads, and content continuity.
**Owner:** Fusion Studio chat domain, renderer chat composition, thread-group persistence, and view-state worksurface adapter.
**Source:** `../999-Archive/2026-09-02-COMBINED_COMPOSABLE_CHAT_AND_SIDE_CHAT_SPEC.md` plus Vision Roadmap decisions D-078 through D-101 and D-124.
**Depends on:** `GENERIC_COMPONENT_TAB_HOST_SPEC.md`; `PENDING_CHAT_INTENT_SPEC.md` executes as the New Chat sub-SPEC after the group commit primitive exists.
**Enforces:** `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/` and the current Chat System wiki at `ai/<machine>/Wiki/007-Chat_System/`.
**Blocks:** `MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`,
`SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md`, and
`VIEW_CONFIGURED_THREAD_COLLECTIONS_SPEC.md`.
**Supersedes:** The executable scope formerly carried by Slices 0–5 of the archived combined SPEC.

---

## 0. Clean-Session Implementation Brief

Turn the current shell-global chat presentation into a composable, explicitly
identified module that a connected host can mount in any view without changing
the server-owned chat lifecycle.

At completion:

- `ChatSurface` renders exactly one explicit underlying chat session;
- `ThreadRail` renders one explicit view's visible thread groups;
- `ThreadedChat` composes the rail and current Main Chat for normal use;
- every visible thread group is durably bound to one immutable view ID, or to
  the workspace Legacy host when no view can be resolved;
- selecting a group restores that group's content-only worksurface from its
  owning view capsule; and
- the extracted chat surface is registered as first-party component content
  behind the accepted generic component-tab resolver, without yet placing it in
  a production content tab.

This SPEC does not create or display Side Chats, add a second session to a
visible thread, move a Main Chat, or remove the legacy Secondary Chat UI. Those
belong exclusively to `MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`.

Current lifecycle invariants remain authoritative:

- `threadId` routes live output;
- passive `thread:open` hydrates without warming;
- `thread:open-assistant` activates the assistant;
- the server owns prompt acceptance and `message:sent` commits the user bubble;
- active in-memory turns overlay SQLite history on revisit;
- Stop is server-owned and interrupted partial turns persist; and
- exchanges and Markdown mirrors belong to the underlying session.

---

## 1. Product and Scope Contract

| # | Rule |
|---|---|
| B1 | Chat, Threads rail, and content worksurface are independent shell surfaces. A view may expose any declared combination without changing chat identity. |
| B2 | A visible user-facing thread is a stable group bound to `{workspaceId, viewId}`. One unresolved legacy group may instead use `{workspaceId, viewId: null}` in the workspace Legacy host. |
| B3 | This SPEC permits exactly one underlying session member per group. It lands the membership and current-primary structure required by the follow-on, but exposes no action that adds or changes members after initial creation. |
| B4 | `threadGroupId` owns the visible row, name, view binding, membership, current-primary cache/history, group MRU, and group actions. `threadId` owns transcript, exchanges, harness/provider binding, runtime, usage, draft, and live routing. `surfaceId` owns one transient mounted UI instance. |
| B5 | The selected group renders its one member as the Main Chat. `primary` remains internal persistence/protocol vocabulary; user-facing copy says Main Chat. |
| B6 | `ChatSurface` receives explicit workspace, nullable view, group, session/thread, and surface identities plus render models and callbacks. It does not derive the session from a global current thread. |
| B7 | `ChatSurface` is portable presentation: no stores, WebSocket client, controllers, services, persistence, or app-global state imports. A connected host supplies all data and behavior. |
| B8 | The normal connected composition may mount `ThreadRail + ChatSurface`. The workspace Legacy host mounts its own rail and current Main Chat without inventing a view or worksurface. |
| B9 | Renderer session state is keyed by `threadId`; transient DOM/menu/focus state is keyed by `surfaceId`; each visible population and selected group is keyed by the composite `{workspaceId, viewId}`. View ID alone is never a cross-workspace key. |
| B10 | The existing server-owned lifecycle and `threadId` wire route remain unchanged. This SPEC does not rename transport `threadId` to session ID. |
| B11 | New Chat creates a renderer-RAM pending intent and commits no durable session/group until `PENDING_CHAT_INTENT_SPEC.md` observes its server-owned committing signal. No eager competing creation path ships. |
| B12 | New Chat consumes the already resolved active view. It never creates a project/view/content folder, starter document, template, or client-supplied CWD/path binding. |
| B13 | A view capsule's immutable identity is `metadata.view-id` in `manifest.md`, qualified by workspace. Folder name, numeric prefix, display name, and later physical relocation do not change it. |
| B14 | The central view registry is the only owner of capsule paths. This SPEC does not move capsules, but no new chat consumer may concatenate `Views/`, `System/Views/`, suffixes, or folder names. |
| B15 | Registered workspace sessions migrate one-to-one into visible groups without transcript loss or guessed view assignment. Only the owner's authorized null/unregistered-workspace test rows may be retired. |
| B16 | A visible rail reads groups, not raw sessions. Group `updated_at`, advanced by idempotent accepted-user-activity records, is its sole MRU owner. Passive open/warm and assistant completion do not reorder it. |
| B17 | Before group-backed rows become public, add one canonical `thread:action` dispatcher beneath the existing top-level `thread:*` router and move group-level Rename, Delete, Copy Link, and link resolution through it. Session actions remain explicitly keyed to the current verified member. Remove superseded mutation routes; no `thread-group:*` family is added. |
| B18 | Only content worksurface state varies by selected group. Shell chrome, thread-list visibility, chat transcript/runtime, and chat-column exposure are never embedded in the worksurface snapshot. |
| B19 | The owning view capsule stores the versioned worksurface under `viewStates[viewId].threadWorksurfaces[threadGroupId]`; SQLite never duplicates that snapshot. Legacy groups own no worksurface. |
| B20 | A folder associated with a view or group is a worksurface starting context, not a filesystem, permission, or reasoning boundary. |
| B21 | The generic component-tab descriptor for Composable Chat contains explicit identity input only. Its connected registration supplies runtime data/actions. No production tab placement is added here. |
| B22 | View configuration, model output, content files, raw sockets, and harness children cannot authorize thread creation or destructive group mutations. New authority follows the trusted Fusion shell path and server validation. |
| B23 | Before group-backed rows become public, remove Fork end to end: UI, client actions/types, public protocol, server handler/service, pending fields, provider arguments, tests, and active roadmap/plan dependencies. No compatibility alias, ungrouped-session escape hatch, context inheritance, or chat-to-chat parent/child relationship remains. |
| B24 | Every `thread:action` carries a stable `requestId` echoed by completion/error. Durable mutation owners persist same-request idempotency with the domain transition; a lost acknowledgement and retry can never repeat the mutation. |

---

## 2. Canonical Identities and Components

### 2.1 Identity tuple

```ts
type ChatMountIdentity = {
  workspaceId: string;
  viewId: string | null;
  threadGroupId: string;
  threadId: string;
  surfaceId: string;
};
```

- `workspaceId + viewId` selects the visible population.
- `threadGroupId` selects one body of work and content worksurface.
- `threadId` selects one transcript/runtime and routes live messages.
- `surfaceId` prevents mounted UI instances from colliding.

No identity is reconstructed from the selected panel, folder basename, title,
or another identity's string shape.

### 2.2 Component boundaries

| Component | One job |
|---|---|
| `ChatSurface` | Render one explicit session model and emit explicit chat intents. |
| connected chat host/hook | Read established stores for the exact identity tuple and adapt existing actions into `ChatSurface` props. |
| `ThreadRail` | Render/select/create visible groups for one explicit workspace/view host. |
| `ThreadedChat` | Compose one rail with the selected group's Main Chat. |
| `LegacyThreadHost` | List/select Legacy groups and mount their Main Chat with `viewId: null`. |
| `WorksurfaceAdapter` | Capture, sanitize, persist, and restore content-only view state for one selected group. |

The precise TypeScript spelling may vary, but `ChatSurface` must receive:

```ts
type ChatSurfaceProps = ChatMountIdentity & {
  host: 'main' | 'legacy-main';
  chat: ChatSurfaceModel;
  actions: ChatSurfaceActions;
  onToggleThreads: () => void;
};
```

`host` is presentation input, not durable membership. It must not change
message routing, prompt acceptance, Stop, or shared header/menu behavior.

### 2.3 First-party component registration

After `GENERIC_COMPONENT_TAB_HOST_SPEC.md` is accepted, register one code-owned
component type such as `fusion.chat-surface`. Its JSON-safe input carries
workspace, nullable view, group, session/thread, and presentation identities,
but not the transient `surfaceId`. The connected resolver validates membership,
binds store/action props, and mints the mount's `surfaceId` from the descriptor's
unique `componentInstanceId` plus a runtime mount generation before rendering
`ChatSurface`. This is an explicit adapter mapping; neither tab ID nor
`threadId` is treated as surface identity.

This SPEC proves that registration with focused tests but adds no launcher,
view-config declaration, Side Chat tab, plugin registration, or dynamic import.
An unavailable/invalid descriptor follows the generic host's inert behavior.

---

## 3. Persistence Model

The existing `threads` and `exchanges` rows remain authoritative for one chat
session. Add a stable group layer above them.

### 3.1 `thread_groups`

Required fields:

| Field | Contract |
|---|---|
| `group_id` | Stable user-visible thread identity and primary key. |
| `workspace_id` | Required registered workspace owner. |
| `view_id` | Immutable view binding; null only for Legacy groups. |
| `name` | Nullable display title. |
| `current_primary_thread_id` | Exact current member; always present after group commit. |
| `created_at` | Creation time. |
| `updated_at` | Visible-rail MRU cache. |

Indexes cover `{workspace_id, view_id, updated_at, group_id}` and the workspace
Legacy population where `view_id IS NULL`. Visible lists use the total order
`updated_at DESC, group_id ASC`; the stable group-ID tie-break is mandatory when
migrated or same-clock groups share a timestamp.

### 3.2 Membership and primary history

`thread_group_members` contains unique `{group_id, thread_id}`, immutable
ordinal, `origin_kind='initial'`, and `joined_at`. A session belongs to exactly
one group.

`thread_group_primary_events` contains a server-assigned monotonic sequence,
group, nullable previous member, next member, `reason='initial'`, and wall-clock
time. The group current-primary field is a transactional read cache and changes
in the same transaction as its event.

This SPEC writes only the initial member/event. Follow-on reasons and additional
members are owned by `MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`.

### 3.3 Existing session owner

`ThreadManager` remains the only creator/deleter of underlying sessions and
their Markdown mirrors. The group service calls a manager-owned transaction
primitive; it never raw-inserts a `threads` row or copies manager invariants.

Within current `harness_config`, portable `{model, variant}` selection and
provider session/runtime binding are separate allowlisted namespaces. Clients
may propose only portable selection. Provider identity, credentials, resume
state, unknown keys, and retired Fork fields are never accepted or cloned.

Existing `threads` compatibility columns remain until a separately reviewed
destructive cleanup moves every reader. `ThreadManager` is their only writer.
For every new member it receives the authoritative group binding inside the
shared transaction and writes `threads.workspace_id = group.workspace_id` and
`threads.view_id = group.view_id` (null only for Legacy). It retains
`threads.scope='project'` because current runtime/wire scope means
workspace-scoped execution; view placement belongs to the group and does not
revive the retired session-scope router. The group service never patches a
second copy later, and immutable group view binding means no synchronization
loop is required.

Backfill makes each retained member's compatibility workspace/view agree with
its new group and normalizes the supported runtime scope through
`ThreadManager`. Visible list/selection reads switch to group tables in this
SPEC. Remaining compatibility consumers such as chat search either join the
authoritative group projection or read the manager-maintained columns and must
return the same workspace/view. A mismatch is a repair diagnostic, never a
reason to route a view-bound group through Legacy.

#### 3.3.1 Mirror-creation recovery

`ThreadManager` owns one durable mirror-creation journal for every new session,
including Pending New Chat and Move Chat to Side Chat. The SQLite transaction
that creates the session also inserts:

| Field | Contract |
|---|---|
| `creation_id` | Stable primary key `mirror-create:{workspaceId}:{threadId}`. |
| `workspace_id` / `thread_id` | Canonical owner and session identity; unique together and retained without a cascading session foreign key. |
| `group_id` | New group ID for ordinary New Chat or existing group ID for Move, retained without a cascading group foreign key. |
| `status` | `pending`, `applied`, or `cancelled`. |
| `failure_code` | Nullable bounded/redacted diagnostic. |
| timestamps | Created, updated, and nullable terminal timestamps. |

The row stores no transcript, prompt, arbitrary path, or provider payload. No
final mirror file is written before the SQLite transaction commits. After
commit, the manager acquires the shared per-thread mirror lease, derives the
canonical filename from authoritative IDs, and creates the empty compatibility
mirror through an atomic no-clobber install before marking the journal applied.
Failure leaves `pending` and reports
`mirrorStatus: 'repair_required'`; it never rolls back or duplicates the
committed session/group. Startup and workspace reattach retry every pending row.
A crash after final rename but before acknowledgement verifies the exact mirror
identity and marks the same row applied rather than rewriting or duplicating it.

Every mirror writer shares the manager-owned per-thread mirror lease: initial
creation, canonical turn-end/finalization, interruption persistence, explicit
rebuild, and deletion. A turn finalizer encountering a pending creation row may
atomically write the authoritative nonempty mirror and mark that creation row
`applied` only after the file succeeds. A creation worker encountering an
existing mirror validates that it belongs to the same workspace/thread. A
valid empty or authoritative nonempty mirror satisfies creation and is marked
applied without replacement; invalid or ambiguous content is preserved and
leaves a visible repair error. The empty creation writer never overwrites an
existing file.

Deleting a session writes its deletion row and changes a still-pending creation
row to `cancelled` in the structural delete transaction. The creation worker
validates that the authoritative session still exists immediately before its
no-clobber install. Therefore the only legal race outcomes are
create/finalize-then-delete or cancel-before-create; startup repair can neither
clobber a completed transcript nor resurrect a mirror for a deleted session.

The manager owns the temporary filename namespace. Startup removes an orphaned
temporary file only when no creation row/session exists and its canonical root,
name, and empty compatibility payload are all validated. A final mirror with no
session/journal is deleted only under that same exact empty-artifact proof;
nonempty or ambiguous files are preserved and surfaced for repair. A committed
session with a missing mirror is rebuilt only from its creation row and
authoritative SQLite metadata. Terminal rows remain through the supported
retry/diagnostic window.

### 3.4 Group activity

`thread_group_activity_events` provides durable idempotency for initial creation
and accepted prompts. A canonical prompt uses `prompt:{threadId}:{turnId}`.
Inserting the event and monotonically advancing group `updated_at` share one
transaction. Prompt acceptance must complete that write before acknowledging
`message:sent` or dispatching the provider; retry cannot double-advance it.

### 3.5 Delete recovery

Group Delete acquires the group mutation lease, proves every member runtime is
terminal/drained, and fences the runtime generation before deleting. A busy
member yields a non-mutating `group_busy` result.

Before canonical session rows disappear, `ThreadManager` writes one durable
mirror-deletion journal entry per member. A view-bound delete also writes a
durable `remove-group-worksurface` projection instruction. Filesystem/view-state
cleanup retries idempotently after commit and restart. A Legacy delete creates
no view-state projection.

The manager-owned mirror journal has this minimum contract:

| Field | Contract in this SPEC |
|---|---|
| `deletion_id` | Stable primary key `mirror:{workspaceId}:{threadId}`. |
| `workspace_id` | Required workspace registry identity used to resolve the canonical chatlog root. |
| `group_id` | Logical deleted-group identity retained with **no cascading foreign key** to `thread_groups`. |
| `thread_id` | Deleted session identity and deterministic mirror filename input. |
| `status` | `pending` or `applied`. |
| `failure_code` | Nullable bounded/redacted diagnostic; never transcript content. |
| timestamps | Created, updated, and nullable applied timestamps. |

The journal stores neither transcript text nor an arbitrary client path. Enforce
unique `{workspace_id, group_id, thread_id}` rows and index
`{workspace_id, group_id, status}` so recovery and result lookup remain scoped
to one deleted group even while unrelated deletes are pending. Missing mirror
files count as applied. Pending rows retry on startup/workspace reattach through
`ThreadManager`; they never age out. Applied rows remain for at least the same
bounded retry/diagnostic window as the action-result ledger.

The Composable Chat migration establishes
`thread_group_view_projections` with this base contract:

| Field | Contract in this SPEC |
|---|---|
| `projection_id` | Stable primary key; group cleanup uses `delete:{workspaceId}:{groupId}`. |
| `workspace_id` | Required workspace owner retained after group deletion. |
| `group_id` | Logical group identity with **no cascading foreign key** to `thread_groups`; the cleanup instruction must survive deletion. |
| `view_id` | Required immutable owning view; Legacy never creates a projection. |
| `kind` | Exactly `remove-group-worksurface` in this SPEC. Follow-ons add separately contracted kinds. |
| `member_thread_id` / `member_ordinal` | Null for group cleanup; reserved for a later projection kind. |
| `status` | `pending`, `applied`, or `cancelled`. |
| timestamps | Created and nullable terminal timestamps. |

The group service enforces live-group existence before inserting any projection
that requires it. Group cleanup is inserted in the same transaction that
deletes the group and remains independently retryable afterward. Terminal rows
remain for the bounded idempotency/diagnostic window; pending rows cannot age
out. This bounded rule applies to this SPEC's
`remove-group-worksurface` kind; the Move follow-on explicitly gives
`open-side-chat-tab` rows group/member lifetime because their projection IDs
remain link/placement identities.

After commit, Delete returns the stored deleted result plus current aggregate
`mirrorCleanupStatus: 'persisted' | 'repair_required'` and
`viewStateStatus: 'persisted' | 'repair_required' | 'not_applicable'`. The
aggregate joins the stable group-cleanup projection to the
`{workspace_id, group_id}` mirror-journal index; Legacy derives
`viewStateStatus='not_applicable'` without a projection. Repeating Delete with
the same **or a new** `requestId` finds those tombstones and returns the exact
group-scoped aggregate without recreating an instruction, re-entering session
deletion, or reporting plain `not_found`. This is a Delete recovery lookup, not
permission to reuse an unrelated action result under a new request ID. Terminal
projection/journal retention must cover that recovery window; cleanup records
may be purged only after no supported retry can observe them.

Do not store the worksurface in an outbox or group row. The outbox carries only
the idempotent cleanup instruction.

If the cached current-primary ID is missing or not a member during hydration,
recover it from the newest valid primary event and repair the cache through the
group service. If no valid event/member exists, mark the group damaged and keep
it unavailable; never select an unrelated session.

### 3.6 Migration

For every registered-workspace session:

1. create one group, using existing `thread_id` as initial `group_id`;
2. add the session as ordinal 1 and current primary;
3. append the initial primary and activity events;
4. preserve title, timestamps, status, harness data, exchanges, and mirrors;
5. through `ThreadManager`, make the member compatibility workspace/view fields
   agree with that group and retain canonical workspace runtime
   `scope='project'`;
6. keep a resolvable immutable view ID, otherwise set group `view_id=NULL`;
7. do not infer a view from the active UI, project name, or folder basename; and
8. do not copy current global view state into the new group's worksurface.

Before backfill, a bounded migration may delete only the explicitly authorized
test rows whose `workspace_id` is null or no longer registered, plus their
exchanges. It records IDs/counts, not transcript text, and reconciles exact
generated mirrors only within canonical registered roots through
`ThreadManager`. All workspace-owned data is preserved.

Migration is idempotent, transactional, and covered by restart/readback tests.

---

## 4. View Registry, Listing, and Selection

The current physical view root remains unchanged in this SPEC. Before binding
groups, make the central registry authoritative for:

- manifest discovery and immutable view ID;
- ID-to-current-folder resolution;
- content root, state, styles, CLI config, restore, and reorder; and
- duplicate/missing-ID diagnostics.

Before any group backfill or new binding, run a one-time registry-owned identity
migration over every discovered capsule that lacks a valid
`metadata.view-id`. Mint a new opaque stable ID, patch only the manifest
frontmatter through an atomic Fusion-owned write, and preserve the manifest
body, unrelated frontmatter keys, content root, state, styles, folder suffix,
and order. Existing valid human-readable IDs are grandfathered and never
rewritten merely to become opaque. Re-running the migration returns the same ID
and performs no write.

If manifest parsing/writing fails or two capsules claim the same ID, expose a
repair-required registry diagnostic and keep the affected capsule unavailable;
never fall back to mutable folder identity or choose one duplicate. A reorder
may change only the numeric prefix and must retain the capsule's existing folder
suffix rather than reconstructing it from `view-id` or display name.

Folder rename/reorder must preserve the same view identity and all consumers.
The later `SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md` may move capsules to
`System/Views` through this registry without changing group IDs or content-root
declarations.

Normal list/query context is `{workspaceId, viewId}` and returns groups with
their `currentPrimaryThreadId` and `currentPrimarySequence`, the sequence of the
primary event backing that cached pointer. Hydration/list updates expose both
values atomically from the authoritative group projection so a client can form
a stale-safe follow-on action after restart. Legacy list/query context is
`{workspaceId, viewId:null}` and is rendered only by `LegacyThreadHost`.

Renderer state separates populations and selection, for example:

```ts
threadGroupsByWorkspaceAndView: Record<
  WorkspaceId,
  Record<ViewId, ThreadGroup[]>
>;
currentThreadGroupIdByWorkspaceAndView: Record<
  WorkspaceId,
  Record<ViewId, ThreadGroupId | null>
>;
legacyThreadGroupsByWorkspaceId: Record<WorkspaceId, ThreadGroup[]>;
currentLegacyThreadGroupIdByWorkspaceId: Record<WorkspaceId, ThreadGroupId | null>;
```

An implementation-equivalent composite `{workspaceId, viewId}` key is valid;
view ID alone is not. Switching workspaces or views restores only that exact
context's selection. A late response/fan-out is correlated and rejected before
it can mutate another workspace's same-named built-in view. No transition
changes another context's selected group or fills a null binding from the
active view.

Legacy supports open/send/stop and group Rename/Delete/Copy Link/View Markdown.
It has no content worksurface, collections, member-specific link, Side Chat, or
view-state write.

### 4.1 Canonical primary-group application link

Copy Link no longer returns the Markdown mirror path. View Markdown remains the
separate, exact-session action that may return a validated mirror path for File
Viewer. Group Copy Link returns this URL-encoded application intent:

```text
fusion-studio://thread/open?v=1&workspaceId=<opaque-id>&threadGroupId=<group-id>
```

The workspace value is the registry's opaque ID, never a local path. The
correlated completion includes request ID, group ID, `linkVersion: 1`, and URI.

Electron reserves this exact authority/path before the custom-content protocol
can treat it as a file. Cold-start, `open-url`, and already-running
second-instance entry points forward the same bounded parsed intent. The
renderer sends `thread:action` with `action='resolve_link'`; link values request
a target but grant no authority. The server compares the workspace to the
connection's authoritative current workspace, resolves the group and its
nullable view binding, and returns either `{hostKind:'view', viewId,
currentPrimaryThreadId}` or `{hostKind:'legacy', viewId:null,
currentPrimaryThreadId}`.

Only after acknowledgement may the client change host/view/group selection. A
malformed/unsupported URI, wrong workspace, missing view/group, or damaged
group returns a bounded error and leaves current workspace, view, group, tabs,
and selection unchanged. Cross-workspace navigation is outside this SPEC.

`MOVE_CHAT_TO_SIDE_CHAT_SPEC.md` extends this exact version-1 grammar with an
optional member `threadId`; it does not invent a second link family.

---

## 5. New Chat

`PENDING_CHAT_INTENT_SPEC.md` is normative for New Chat and is executed inside
this SPEC after the group/session commit primitive exists.

Required integration:

- click creates one RAM-only pending intent scoped to trusted
  `{workspaceId, viewId}`;
- first send uses the pending-draft route and server-normalized harness/model
  selection;
- the committing signal atomically creates the canonical session through
  `ThreadManager`, group, initial membership/primary/activity, and first
  exchange ownership;
- requester acknowledgement and authoritative multi-window group-list fan-out
  occur after the same commit and cannot roll it back;
- pre-commit failure creates no chat/session/group/exchange or Markdown mirror,
  apart from the bounded attempt journal defined by that sub-SPEC; and
- the eager create path is removed before this slice completes.

No configuration label, icon, template, CWD override, folder creation, or
collection assignment is added here.

---

## 6. Session-Keyed Renderer and Runtime State

At minimum, messages, current assistant turn, stream frontier, pending prompt,
usage, readiness, active/stopping state, composer draft, attachments,
model/variant selection, diagnostics, and todo state resolve by `threadId`.

Menus, focus refs, element IDs, and mounted-instance state resolve by
`surfaceId`. Pre-commit composer state resolves by pending-intent ID and
transfers to the committed session only from the authoritative acknowledgement.

A committed model/variant change uses `thread:action` with explicit group and
session IDs. The server verifies membership/policy and changes only portable
selection through `ThreadManager`, preserving provider binding. UI commits only
from acknowledgement.

Server runtime remains keyed by `threadId`. Remove any one-wire-per-WebSocket
assumption that prevents independently mounted sessions, while preserving
passive hydration, exact-session Stop, stream ordering, and terminal behavior.
Open request/response correlation must carry and echo the requesting
`surfaceId`, group identity, and a request correlation ID (or a demonstrably
equivalent composite token) so two mounted surfaces cannot settle one another's
open response. Live model frames continue to route by `threadId`.

The acceptance fixture mounts two independent `ChatSurface` instances using
existing sessions to prove isolation. It does not place either in a Side Chat
tab or create a multi-member group.

---

## 7. Content Worksurface Continuity

The selected group's view capsule owns:

```ts
viewStates[viewId].threadWorksurfaces[threadGroupId]
```

The snapshot is versioned, bounded, JSON-safe, and adapter-sanitized. It may
contain content tabs, locations, modes, selections, and scroll positions. It
must not contain transcripts, chat drafts, runtime, Threads/chat visibility, or
shell layout chrome.

The existing view-state service remains the only writer. Register
`threadWorksurfaces` for forced per-view routing. Add opaque per-view revision
comparison and existing mutation correlation so two windows cannot silently
overwrite dirty local intent. On conflict, retain/rebase the exact pending group
replacement or expose a retryable collision; do not guess.

Each client has one view-state coordinator per `{workspaceId, viewId}`. It
retains the last acknowledged base and every exact dirty/pending group
replacement keyed by `clientMutationId` until acknowledgement or explicit
conflict resolution. After every successful group-worksurface write, the server
uses the existing view-state family to fan a server-owned `state:changed` fact
to every authenticated window bound to the workspace. This is not a second
command or state owner. The bounded, adapter-sanitized fact carries immutable
workspace/view/group IDs, `clientMutationId` when one exists, previous and
resulting opaque `viewStateRevision`, and the replacement for only that group's
worksurface. Requester acknowledgement and each recipient delivery are
failure-isolated after commit; reconnect/state hydration returns the current
revision without replaying the mutation.

A receiver applies the remote replacement directly only when its held revision
equals the fact's previous revision and it has no dirty/pending intent for that
group. The same result revision is idempotent. With pending local intent, it
updates the authoritative base without overwriting the rendered local edit,
performs a bounded three-way rebase from the mutation's acknowledged base, and
retries with the new expected revision. For user-owned tabs/locations, locally
changed fields win only where they differ from the captured base; untouched
remote fields survive. An ambiguous same-field collision becomes visibly
`conflict_pending`. Any other revision mismatch performs `state:get` and the
same retained-intent rebase; opaque revision tokens are never ordered or
guessed. The later Move SPEC extends this fact with service-owned projection
placement/tombstone fields and their stricter merge rules.

Ordinary logs exclude the replacement and all opaque worksurface contents.

The connected `WorksurfaceAdapter` is the sole capture/restore owner:

1. snapshot the outgoing group at the existing controller transition
   chokepoint;
2. persist it with expected view-state revision and await the correlated
   authoritative acknowledgement;
3. only after success, activate the incoming group;
4. sanitize and restore its stored snapshot or safe default;
5. restore content before selection and scroll; and
6. passively hydrate its Main Chat.

Group selection is therefore a two-phase controller transition. While the
write is pending, the outgoing group and its exact adapter remain selected and
mounted and repeated selection is single-flight. Conflict, rejection, timeout
without authoritative acknowledgement, or server-drain failure leaves the
outgoing group unchanged with retryable save state; it never activates the
incoming group from an enqueued/local-only write. An explicit **Discard and
Switch** may proceed only after warning that the outgoing group's
unacknowledged content-position state will be lost. Late acknowledgements are
matched to the transition correlation and cannot switch a newer selection.

The same controller tracks the latest dirty snapshot even when the user never
switches groups. It cancels/debounces any scroll/selection timer, captures the
active group, and drains the revisioned view-state write before view navigation
or unmount, workspace detach/change, window close, and ordinary application
quit.

View selection/navigation uses the same rule as group selection and is a
shell-owned two-phase transition, not a React
cleanup effect: before changing the selected view or removing its component,
the shell sends a correlated pre-navigation flush to the mounted adapter and
awaits the server-acknowledged state write. Only success commits navigation and
unmount. Conflict/write failure keeps the old view and adapter mounted, leaves
selection unchanged, and presents retry or explicit discard-and-leave. A
component cleanup hook may be a final safety assertion but never owns the only
durable flush.

Electron main similarly initiates window/app close with a correlated
`worksurface:flush-request`, delays normal teardown, and waits for the top
renderer to finish all dirty adapter writes through the existing state service.
Workspace detach/change uses the same shell gate before dropping its adapter.
The server then drains every accepted view-state coordinator write before
closing the workspace/SQLite owner and returns an explicit success/failure
result.

A conflict or write/drain failure remains visible and retryable and is never
reported as saved. Normal view navigation, unmount, close, or workspace detach
stays pending or is cancelled until retry succeeds. An explicit **Discard and
Leave / Force Quit / Force Detach** may cross the boundary only after a
user-facing warning that unacknowledged content-position state can be lost; it
is not the default timeout behavior. Sudden process/OS death can restore only
the last acknowledged snapshot, which is the documented crash boundary rather
than a false successful drain.

While group-bound, existing top-level/activity tab persistence must not write
the same fact. When no group is selected, it remains the unbound view-default
owner. Do not add component-supplied flush arguments or a second tab controller.

This SPEC may serialize existing view-owned tab descriptors as opaque content
state. It does not persist generic component-tab descriptors or place
Composable Chat in a tab. That first use belongs to the Side Chat follow-on.

---

## 8. Architecture and Code-Standards Compliance

### 8.1 Existing routes and owners

- Existing frontend chat action bridges emit canonical product intent.
- The existing top-level `thread:*` router is the public owner. This SPEC adds a
  focused canonical `thread:action` dispatcher/handler beneath it because the
  current handler map exposes only separate session-era mutation messages. The
  dispatcher owns action validation and delegates to the relevant group/session
  service; it does not absorb domain mutation logic.
- A focused thread-group domain service owns group mutations and membership.
- `ThreadManager` owns sessions and Markdown mirrors.
- Canonical exchange persistence owns turns.
- The existing view-state service owns group-keyed content snapshots.
- Harness adapters own provider syntax.

New modules are justified only for the new group domain, connected chat host,
portable chat presentation, and worksurface adapter. Do not add one-off socket
families except the already justified pre-commit draft family in the incorporated
Pending Chat Intent sub-SPEC.

### 8.2 Canonical action envelope and idempotency

Every `thread:action` request carries a bounded client-generated `requestId`
that is unique to one user invocation and reused only when retrying that same
invocation:

```ts
type ThreadActionRequest = {
  type: 'thread:action';
  action: string;
  requestId: string;
  threadGroupId?: string;
  threadId?: string;
  // action-specific, validated product fields
};
```

Both `thread:action:completed` and `thread:action:error` echo the exact
`requestId`, action, and validated target identities so the requester can settle
only the matching pending UI. Authoritative workspace and view context still
come from the connection/group, not the request.

The dispatcher validates request ID shape and delegates idempotency to the
owning domain service. Durable mutations record a bounded request/result entry
in the same SQLite transaction as their domain change, keyed by
`{workspaceId, requestId}` and containing action, canonical target/payload hash,
terminal result code, and only the identifiers/revision needed to reconstruct
the response. The ledger has no cascading group foreign key, so Delete's result
survives the deleted group. Retention must cover the supported client retry and
reconnect window.

Repeating the same ID with the same canonical action/target/payload returns the
stored result without rerunning a mutation or external effect. Reusing it with
different content returns `request_mismatch` without mutation. An authoritative
domain rejection recorded for an invocation is likewise replayed; a deliberate
new user attempt normally uses a new request ID. Delete is the contracted
exception: a new-ID retry against a deleted group resolves through its durable,
group-indexed cleanup tombstones and records that recovered aggregate as the new
invocation's result. Read-only `copy_link`/`resolve_link`
need correlated responses but no durable result ledger because they create no
side effect.

All group mutations in this SPEC, Move Chat to Side Chat, and collection
mutations consume this common envelope. Pending first-send continues to use its
separate `draftId` idempotency contract.

### 8.3 File responsibility

Keep pure presentation, connected store/action adaptation, group domain logic,
persistence queries, migrations, view-state coordination, and tests in
single-job modules. Do not turn `ChatArea`, `ws-client`, `ThreadIndex`,
`ThreadManager`, or one WebSocket handler into the sole owner of unrelated UI,
routing, persistence, and recovery.

Portable components use prefixed classes and CSS variables with fallbacks.
They import no controller, service, store, or network code.

### 8.4 Trusted mutation

Before exposing any shell-authentication capability, Electron loads the trusted
app renderer from an Electron-owned secure origin such as
`fusion-shell://app/`, not the server's localhost origin and not the
workspace-file `fusion-studio://<view>/` origin. Only packaged/dev app assets
are served there. Navigation policy prevents a subframe from loading that shell
origin and prevents the main frame from navigating to workspace/web content.
The shell CSP allows the known API/WebSocket endpoint and configured child
content origins without making them same-origin. Existing localhost panel-file
HTML, custom views, browser frames, and remote pages therefore cannot read or
invoke `parent.electronAPI`; `contextIsolation` alone is explicitly
insufficient.

The server still selects its runtime loopback port. After that port is known,
Electron main exposes one bounded, non-secret shell runtime descriptor through
a main-frame/exact-shell-origin preload IPC call:

```ts
type ShellRuntimeDescriptor = {
  httpBaseUrl: `http://127.0.0.1:${number}`;
  webSocketUrl: `ws://127.0.0.1:${number}`;
  launchGeneration: string;
};
```

The server itself listens explicitly on IPv4 `127.0.0.1`, exactly matching the
descriptor, never `::1`, `localhost` resolution, or the Node default wildcard
host. Startup verifies `server.address().address === '127.0.0.1'` before
advertising readiness; failure aborts launch. HTTP, WebSocket, panel-file, and
every other mounted route share that listener. Tests must prove the selected
port cannot be reached through IPv6 or a LAN/non-loopback interface.

A single renderer transport/bootstrap module validates that descriptor, holds
it in memory, and supplies URL builders to the WebSocket client and every
server-backed REST/resource consumer. Before loading feature state it rebases
all existing `window.location.host` and relative `/api`/asset assumptions onto
that owner, including view config, panels, icons, shared styles, screenshots,
and other discovered server resources. Browser/custom-view navigation URLs
remain content targets and do not become API authority. The shell CSP and
server CORS use the exact runtime descriptor plus exact `fusion-shell://app`
origin; no wildcard origin/port or client-provided endpoint is accepted.

Renderer startup awaits this descriptor before opening the socket or issuing a
server-relative fetch. A server restart/port change is delivered only by
Electron main as a new launch generation, invalidates the old socket/proof and
URL owner, aborts old-generation requests, and bootstraps/authenticates again.
Missing, malformed, non-loopback, stale-generation, or renderer-supplied
descriptors fail closed with a visible disconnected shell rather than falling
back to `window.location`.

Electron main generates a cryptographically random, high-entropy master secret
for each app/server launch and retains it only in main-process memory. It sends
the master to the server over a dedicated inherited bootstrap pipe that is read
once and closed before server readiness; the master never enters an environment
variable, command line, log, workspace, or renderer JavaScript. On each
WebSocket connection the server first sends a short-lived
challenge containing an opaque connection ID and random nonce. A narrow
context-isolated preload method accepts that
challenge plus a renderer nonce and asks Electron main to return a one-use HMAC
proof bound to all three values. The IPC handler serves only the current
`webContents.mainFrame` whose committed URL has the exact trusted shell origin;
it rejects subframes, stale navigation generations, reused challenges, and
unexpected fields. The proof—not the master—is returned to renderer code and
is consumed immediately by the socket authentication frame.

Before accepting privileged traffic, the server validates exact challenge
binding, constant-time proof equality, one-use status, expiry, and the trusted
shell Origin, then marks the connection `trusted-shell`. It binds that
connection to the server-validated current workspace; workspace changes occur
only through the existing acknowledged trusted-shell selection path and update
that binding. A reconnect obtains a new challenge/proof. Invalid, absent,
expired, replayed, or prior-launch proofs leave the socket read-only or close it
before any draft/action journal, provider start, or mutation dispatch. Rotation
on either server/app relaunch invalidates every prior proof.

A standalone server launched without the Electron bootstrap master exposes no
trusted-shell mutation role. Focused server tests inject the master and signer
through an internal test seam; no production HTTP/WebSocket message can mint or
retrieve it.

Introduce one server-owned `buildChildEnvironment(kind, adapterPolicy)` helper
before trusted mutations ship. It starts from a documented minimal OS/runtime
allowlist and adds only explicitly named adapter-required variables; the shell
master/proofs/nonces, Electron bootstrap descriptors, and other server-only
secrets are unconditional denylist entries. Replace every `{...process.env}` or
equivalent child spawn in OpenCode, the shared CLI harness, Kimi, Claude, Codex,
Gemini, Qwen, legacy wire/process runners, and any discovered spawn path with
this helper. New child-process code cannot bypass it; a static test/sweep
enforces that boundary. The server also keeps the pipe-read master in a private
auth owner that the environment builder cannot inspect.

Logs/redaction treat the master, challenge, proof, renderer nonce, and
authentication frame as secrets. New
group creation and destructive actions then pass through one server guard that
requires the connection role and derives workspace authority from that binding.
Request fields cannot self-assert origin, consent, permission, provenance, or
workspace authority. Custom/iframe views, same-origin workspace HTML attempting
`parent.electronAPI`, raw sockets, harness children, model output, and a trusted
connection bound to another workspace cannot invoke the mutation. Automation
remains disabled until a separate server-stored grant SPEC.

---

## 9. Dependency-Ordered Vertical Slices

### Slice 1 — Rename-safe view registry and trusted mutation guard

- Centralize view ID-to-path resolution without moving capsules.
- Migrate each missing manifest ID exactly once with frontmatter/body and folder
  suffix preservation; make parse/write/duplicate failures visibly unavailable.
- Change reorder to preserve the existing suffix rather than deriving a folder
  name from immutable ID or display name.
- Move the app shell to its Electron-owned origin, enforce main/subframe
  navigation separation; add the main-frame runtime endpoint descriptor and one
  client URL owner; rebase WebSocket and every REST/resource producer away from
  `window.location`/relative server paths; bind/verify the server listener on
  the exact loopback address; and establish the dedicated master bootstrap pipe,
  server challenge, main-frame-only preload signing IPC, one-use proof,
  WebSocket authentication, server-owned workspace/role binding, redaction,
  rotation, and the new centralized child-environment builder across every
  harness/process spawn path.
- Prove rename/reorder/restart retains identity, content root, state, styles,
  CLI config, manifest body/frontmatter, and suffix; prove a second migration is
  a no-op. Prove authenticated top-level renderer reconnect succeeds while
  missing/stale/replayed proofs, raw sockets, same-origin workspace HTML calling
  `parent.electronAPI`, custom/iframe views, harness children, cross-workspace
  use, and request-asserted authority cannot perform a representative guarded
  mutation or reach its durable journal. Prove the actual dynamic-port Electron
  build loads styles/icons/config/resources, connects/reconnects WebSocket, and
  rejects malformed/non-loopback/stale-generation endpoints without a
  `window.location` fallback. Prove `server.address()` is loopback, LAN-address
  connection fails, a canary bootstrap secret is absent from every child kind,
  and a stale-symbol sweep finds no direct environment-spread spawn bypass.

### Slice 2 — One-member visible thread groups

- Remove Fork end to end before migration or any group-backed row/list becomes
  public. Prove the public route is absent and no provider adapter can receive
  fork syntax or create an ungrouped session.
- Add group/member/initial-primary/activity storage and focused service.
- Add the canonical `thread:action` dispatcher before moving group Rename,
  Delete, Copy Link, and `resolve_link` to it; remove the superseded public
  mutation routes before the slice completes.
- Add the common `requestId` envelope and mutation-result ledger; prove a lost
  requester acknowledgement followed by same-ID retry returns the committed
  result, while different-payload reuse is rejected.
- Backfill registered-workspace sessions losslessly; apply only the authorized
  unowned-test-row retirement. Normalize manager-owned compatibility
  workspace/view/scope fields and migrate visible readers to groups.
- Switch list/select/Rename/Delete/Copy Link to group ownership and canonical
  routes; keep session actions explicit.
- Land the version-1 group URI, Electron parsing/forwarding, acknowledged server
  resolution, and separation of Copy Link from View Markdown.
- Add runtime fence, mirror journal, and worksurface cleanup instruction for
  Delete.
- Add the manager-owned mirror-creation journal/atomic writer before New Chat or
  Move can call session creation; prove DB-commit/file-write crashes, orphan
  temporary/final empty artifacts, missing mirrors, and restart repair.
- Prove Legacy behavior, multi-window list fan-out, MRU, restart/readback, and
  deletion recovery. No action may add a second member.

### Slice 3 — Signal-gated New Chat

- Execute `PENDING_CHAT_INTENT_SPEC.md` against the group commit primitive.
- Remove eager creation and prove first-send commit, retry, cancellation,
  provider-commit recovery, list fan-out, and restart reconciliation.

### Slice 4 — Portable ChatSurface and connected composition

- Extract `ChatSurface`, connected host, `ThreadRail`, `ThreadedChat`, and
  `LegacyThreadHost` with explicit identities.
- Key session and surface state correctly while preserving every current chat
  lifecycle/UI behavior.
- Register the first-party chat component behind the generic component host and
  prove resolution with fixture input only.
- Mount two independent fixture surfaces and prove no cross-routing/state/DOM
  collisions. Add no Side Chat placement.

### Slice 5 — Group-keyed content continuity

- Add bounded versioned worksurface state through the existing view-state path,
  per-view revision handling, and connected adapter.
- Switch between two groups and prove exact content restoration across restart
  without duplicating state in SQLite. Inject rejection/conflict/timeout before
  acknowledgement and prove the outgoing group/adapter remains selected and
  mounted unless the user explicitly chooses warned discard-and-switch.
- Prove corrupt-state fallback, two-window conflict behavior, delete cleanup,
  authoritative `state:changed` fan-out/rebase, lifecycle flush/drain, and
  Legacy no-op behavior.

Each slice starts at its public UI/WS entry, crosses the owning service/state
boundary, proves persistence/readback where applicable, and records changed
files, exact commands, warnings, and residual risk before the next slice.

---

## 10. Verification Matrix

| Area | Required proof |
|---|---|
| Existing chat lifecycle | Passive open, assistant activation, prompt acceptance, `message:sent`, streaming, reconnect overlay, Stop, interruption persistence, and history hydration remain correct. |
| Portable component | `ChatSurface` has no store/network/service imports and works from explicit identities/models/callbacks. |
| Identity isolation | Two mounted fixture sessions do not cross messages, readiness, usage, drafts, model selection, menus, DOM IDs, Stop, or open responses. |
| Group migration | Every owned session/exchange/mirror survives one-to-one; only authorized null/unregistered test rows are removed; no view is guessed. |
| Session compatibility | New Chat, migrated members, and later Move members have manager-owned `threads.workspace_id`/`view_id` matching their group and canonical `scope='project'`. Visible lists read groups; chat search and every remaining compatibility reader returns the same view or a repair diagnostic, never false Legacy. |
| View scoping | Each view lists/selects only its groups; rename/reorder/restart preserves immutable binding; Legacy never borrows active view. List/hydration atomically exposes the current primary member and primary-event sequence. |
| Missing-ID migration | A capsule without `metadata.view-id` receives one stable ID through an atomic frontmatter-preserving write before binding; restart/reorder/rename retains it and its folder suffix; malformed/duplicate/write-failed capsules stay visibly unavailable without fallback identity. |
| New Chat | Full `PENDING_CHAT_INTENT_SPEC.md` matrix passes through the public route and canonical owners. |
| Group actions | The newly added `thread:action` dispatcher routes Rename/Delete/Copy Link/`resolve_link` to group owners; session actions verify the exact current member; superseded mutation routes are removed. |
| Action correlation | Every completion/error echoes `requestId`; same-ID mutation retry returns its stored result once, different-payload reuse fails, and Delete idempotency survives removal of the group row. Drop a Delete acknowledgement, inject one member mirror-cleanup failure, concurrently delete another group, then retry the first group with a new `requestId`: the exact first-group `mirrorCleanupStatus` and `viewStateStatus` return without rerunning deletion or confusing the second group's records. |
| Application links | Copy Link returns the version-1 `fusion-studio://thread/open` group URI, never the Markdown path; Electron and acknowledged server resolution handle view/Legacy targets and reject invalid input without changing selection. |
| MRU | Initial creation and accepted prompt advance group order once; passive/runtime/finalization changes do not. Equal timestamps use `group_id` as the stable total-order tie-break before and after restart. |
| Delete | Busy returns non-mutating failure; terminal deletion fences runtime and recovers mirrors/view state after injected failures and restart. Same-ID and new-ID retries after canonical group removal return the durable group-scoped aggregate, never plain `not_found` while its recovery tombstones are retained. |
| Projection durability | Group cleanup instruction survives the deleted group row, retries after restart, and never stores a duplicate worksurface. |
| Mirror creation durability | Kill before SQLite commit, after commit/before mirror write, after atomic mirror install/before journal acknowledgement, during turn finalization, and during retry. All mirror writers share the per-thread lease; the empty writer never clobbers an existing file; a valid nonempty finalized mirror satisfies a pending creation row. No precommit final mirror survives; a committed missing mirror is rebuilt once; exact empty orphan artifacts are removed; ambiguous files are preserved for repair; Pending and Move report current `mirrorStatus`. |
| Worksurface | Two groups restore distinct tabs/location/mode/selection/scroll; shell/chat state is absent; SQLite has no copy. Dirty Group A -> Group B selection waits for correlated persistence; injected rejection/conflict/timeout keeps A selected and its exact adapter mounted, and a late acknowledgement cannot steal selection. Discard-and-Switch requires an explicit loss warning. |
| Worksurface lifecycle drain | Change the active group's tabs/selection/scroll without switching groups, then exercise shell view navigation, attempted unmount, workspace detach/change, window close, and app quit. The shell keeps the adapter mounted until timers flush and the server acknowledges/drains the exact snapshot; only then may selection/unmount/teardown commit. Inject conflict/write/server-drain failure and prove the old view remains selected/mounted and ordinary teardown does not report success; explicit discard/force exit requires the loss warning. |
| Worksurface multi-window convergence | Commit a group worksurface in window A and prove requester acknowledgement plus one authoritative `state:changed` fact reaches B with previous/result revisions. Clean B applies it; dirty B retains its exact intent, rebases unchanged fields over the new base, retries, or exposes same-field `conflict_pending`. Duplicate facts are idempotent, missed delivery rehydrates, and no opaque content is logged. |
| Trusted-shell guard | The app shell has an Electron-owned origin distinct from all workspace/web content. The server binds and verifies the exact loopback listener and rejects LAN reachability. Main supplies the validated dynamic loopback HTTP/WebSocket descriptor; one renderer URL owner drives every socket, REST, style, icon, panel, screenshot, and discovered server resource without `window.location`/relative fallback, and generation change aborts/rebinds old work. A pipe-delivered per-launch master plus server challenge/main-frame-only signing IPC yields a short-lived one-use proof and binds only the authenticated shell socket to its server-owned workspace role. Reconnect reauthenticates; stale/absent/replayed/raw/custom/harness/cross-workspace attempts and same-origin workspace HTML calling `parent.electronAPI` fail before durable work. Actual packaged/dev Electron dynamic-port loading, navigation/origin/CORS/CSP rules, redaction, rotation, and a central allowlisted child-environment builder replacing every direct environment spread are proved with canaries/static sweeps. |
| Component-host integration | First-party chat descriptor resolves in focused tests, but no production content tab or launcher is introduced. |
| Regression/build | Focused server/client suites plus `npm test` in server and `npm run build` in client pass; warnings are classified. |
| Stale-symbol/scope sweep | No Side Chat action/tab, second-member creation, plugin/config conversion, capsule move, auto-rename, transcript export, project scaffolding, or CWD behavior enters the diff. |

---

## 11. Definition of Done

1. Chat presentation and thread rail are independently composable from explicit
   identity contracts.
2. Normal and Legacy hosts preserve all current lifecycle behavior.
3. Visible rows are view-bound groups with exactly one session member in this
   SPEC.
4. Session/runtime and surface/UI state cannot collide across two mounted
   fixtures.
5. New Chat follows the signal-gated sub-SPEC and has no eager bypass.
6. Registered chat history migrates losslessly and immutable view IDs survive
   folder rename/reorder.
7. Group MRU, actions, deletion fencing, mirror creation/deletion recovery, and
   multi-window fan-out have one authoritative service path.
8. Each group's content-only worksurface survives switch and restart through
   its owning view capsule, drains on ordinary teardown, and has no SQLite
   duplicate.
9. Composable Chat is a resolvable first-party component but has no production
   tab placement.
10. No action can add/change group members or create a Side Chat.
11. Fork is absent end to end, and every public group mutation/link uses the
    canonical dispatcher without leaving an ungrouped-session bypass.
12. Origin-isolated trusted-shell authentication gates every privileged action;
    code-standards checks, focused tests, server tests, client build, and the
    Electron acceptance walk pass with a complete handoff.

---

## 12. Explicitly Out of Scope

- Move Chat to Side Chat or any other second-member creation;
- Side Chat tabs, centering, labels, menu behavior, links, or projections;
- removing the legacy Secondary Chat implementation before its replacement is
  accepted;
- arbitrary Create/Send to Side Chat or automatic context handoff;
- generic Open Current/New placement, target matching, or recentering;
- view-capsule relocation, view-configured labels/icons/collections, or System
  editors;
- plugins, Provenance, templates, Home/Content configuration, or launchers;
- project/content folder creation or CWD overrides from New Chat;
- automatic/LLM thread naming, transcript export, Routines, Agents, or inbox
  chats;
- automation-origin thread creation;
- promoting a member or storing chat-to-chat parent/child/sibling roles; and
- using filesystem inode metadata as durable identity.

---

## 13. No Open Decisions

The owner-approved combined source has been separated by implementation domain.
This SPEC controls only the composable Main Chat, one-member visible groups,
and group-keyed content continuity. Any implementation choice that would add a
second member, place chat in a product tab, move the primary, copy context, or
remove the current Secondary Chat feature belongs to the dependent Side Chat
SPEC and must not be pulled forward.
