# Move Chat to Side Chat — SPEC

**Date:** 2026-09-03
**Status:** Implementation-ready after both prerequisites are implemented and independently accepted.
**Owner:** Fusion Studio thread-group domain, chat connected hosts, and view-owned worksurface projection.
**Source:** `../999-Archive/2026-09-02-COMBINED_COMPOSABLE_CHAT_AND_SIDE_CHAT_SPEC.md` plus Vision Roadmap decisions D-079 through D-083, D-088 through D-094, D-127, D-132, and D-133.
**Depends on:** `GENERIC_COMPONENT_TAB_HOST_SPEC.md` and `COMPOSABLE_THREADED_CHAT_SPEC.md`.
**Enforces:** `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/` and the current Chat System wiki at `ai/<machine>/Wiki/007-Chat_System/`.
**Supersedes:** The Side Chat and Slice 6 execution scope formerly carried by the archived combined SPEC, plus the legacy floating/sticky/minimized Secondary Chat implementation after this replacement passes.

---

## 0. Clean-Session Implementation Brief

Add one advanced group action: **Move Chat to Side Chat**.

```text
Before
  Visible Thread G
  └── Chat A (Main Chat)

After one authoritative transition
  Visible Thread G
  ├── Chat B (new, durable, cold, empty Main Chat)
  └── Chat A (unchanged, mounted in a centered Side Chat content tab)
```

The rail still shows one visible thread. Chat A keeps its transcript, provider
session, runtime identity, exchanges, and Markdown mirror. Chat B is a fresh
session. Nothing summarizes, copies, resumes, forks, or injects Chat A's
context into B.

The Side Chat tab uses the accepted generic component host and the same
first-party `ChatSurface` registration created by the Composable Chat SPEC. It
does not render a local Threads rail. It retains the shared chat header,
list/menu button, message list, composer, attachment behavior, usage, warm,
send, and Stop behavior.

This SPEC adds no arbitrary Create Side Chat or Send to Side Chat action. Those
may later compose the same group/session and component-placement primitives.

---

## 1. Authoritative Product Contract

| # | Rule |
|---|---|
| B1 | Move Chat to Side Chat is available only for the selected group's current Main Chat in a registered chat-enabled, view-bound host. This SPEC supplies a code-owned Side Chat tab bridge for both existing tab adapters and currently adapterless views, so eligibility never commits a projection the shell cannot render. It remains unavailable in Legacy, a Side Chat surface, a pending New Chat intent, or while the relevant group/session action is pending or active. |
| B2 | One invocation preserves the visible `threadGroupId`, moves the old current-primary session into a Side Chat tab, and creates one new current-primary session in the same group. |
| B3 | The old session is unchanged. It is not cloned, summarized, compacted, restarted, or assigned a new `threadId`. Its transcript/runtime/provider binding remains its own. |
| B4 | The new Main Chat is a durable, cold, empty session created through `ThreadManager`. It receives no messages, exchanges, provider-session ID, resume/fork state, summary, hidden prompt, attachment, draft, pending turn, or runtime state from the old session. |
| B5 | The new session inherits only the server-resolved harness ID and last acknowledged portable `{model, variant}` selection from the old Main Chat, or the current effective server default when no explicit selection exists. Invalid/stale selection aborts before structural commit. |
| B6 | The group membership is peer-based. The group is the parent; member sessions do not store parent/child/sibling roles. Membership ordinal records creation chronology, while append-only primary events record which member became Main Chat. |
| B7 | User-facing copy says **Main Chat** and **Side Chat**. Durable fields may retain `primary` and `side-chat` discriminators; do not rename existing transport `threadId`. |
| B8 | A Side Chat is a component-backed Content tab using the accepted `fusion.chat-surface` first-party registration or its implementation-equivalent stable type ID. A connected Side Chat tab bridge composes placement with the current view adapter/children; the generic tab rail and portable host never learn Side Chat semantics. |
| B9 | The Side Chat is centered and mounts no local thread list. Its existing list/menu button operates the outer view's shared Threads rail/menu behavior; it is not removed or replaced with bespoke chrome. |
| B10 | Closing a Side Chat tab closes only the placement. It does not delete, archive, interrupt, or remove the member session from its group. |
| B11 | Reopening an exact member link may recreate/focus the placement after membership validation. Ordinary restart/repair never reopens a tab the user intentionally closed. |
| B12 | Repeated Move creates one new peer and one side placement per accepted invocation. The rail remains one row; it never expands into a session tree. |
| B13 | The owning view capsule remains the sole owner of Side Chat tab placement through the group-keyed worksurface. SQLite stores membership/history and a projection instruction, not a duplicate tab snapshot. |
| B14 | The SQLite group transition is authoritative. A failed post-commit view-state projection reports `repair_required` and retries idempotently; it does not roll back by hand or create an ambiguous Main Chat. |
| B15 | A group-level exclusive mutation lease serializes Move against Move, Delete, and any future membership/primary mutation. Every transaction revalidates expected current primary and membership under that lease. |
| B16 | Main and Side surfaces remain independently keyed by `threadId` for runtime/render state and `surfaceId` for mounted UI. Both may run concurrently without crossed output, Stop, usage, draft, model selection, or DOM/menu state. |
| B17 | The Composable Chat prerequisite has already removed Fork end to end before group-backed rows became public. This SPEC verifies it stays absent and introduces no replacement context-cloning route. Send to Chat is the future explicit material-transfer model, but it is not implemented here. |
| B18 | The legacy Secondary Chat popup/sticky/minimized UI and its tracking/geometry/routing remnants are deleted only after the content-tab replacement passes. No compatibility alias remains without a named external consumer and removal boundary. |
| B19 | No empty-tab launcher is involved in Move. The owning worksurface controller and Side Chat tab bridge directly append/focus the committed component descriptor. They reuse the generic component host but do not duplicate its empty/reservation/fill lifecycle. |
| B20 | Move is a canonical product action in the existing `thread:action` family. No `thread-group:*`, provider-specific, browser event, or one-off socket route is introduced. |
| B21 | The initiating renderer never treats local intent as a committed Move. Chat A remains Main and no Side placement appears until matching authoritative success; any rejection or unconfirmed failure leaves/restores the exact pre-action UI. |

---

## 2. Entry Point and Presentation

### 2.1 Shared menu action

Add **Move Chat to Side Chat** to the shared chat-level menu when the mounted
surface is the exact current primary member of a view-bound group. The action is
thread/group scope, not per-message chrome.

The shared menu module owns right-click/button parity, keyboard navigation,
outside click, pending state, and focus restoration. Do not create a Side Chat
specific context-menu implementation.

Disable or omit Move when:

- `viewId` is null;
- the mounted member is not the current primary;
- the surface is a pending uncommitted chat;
- a turn is active, stopping, or draining in the current Main Chat;
- a model/variant mutation is pending for the source session;
- the group mutation lease is held; or
- the trusted shell/server route is unavailable.

Backend validation remains authoritative. Renderer disabled state is not proof
that the mutation is legal.

### 2.2 Side Chat host

The connected Side Chat host resolves this exact identity:

```ts
type SideChatIdentity = {
  workspaceId: string;
  viewId: string;
  threadGroupId: string;
  threadId: string;
  surfaceId: string;
  projectionId: string;
};
```

It passes `host: 'side-tab'` into the same portable `ChatSurface`. The portable
surface does not import the tab store, infer current group/session, or hide its
shared header. The list button asks the outer connected host to toggle/focus
the view's Threads rail; no nested rail is mounted beside the centered chat.

Fallback tab label is `Side Chat <member ordinal>`. This is deterministic
structural copy, not automatic semantic naming.

---

## 3. Canonical Component-Tab Descriptor

### 3.1 Code-owned Side Chat tab bridge

The generic host intentionally changed no production view. This SPEC supplies
the first product adoption through one connected, code-owned bridge above
`useViewTabAdapter`; it does not convert views to declarative/plugin config.

For a view that already has a Capture/File/native tab adapter, the bridge:

- preserves that adapter as the owner of native descriptors and mutations;
- composes persisted Side Chat descriptors into one shell-visible ordered rail;
- retains the native adapter's active item while a Side Chat is active and
  restores it when the Side Chat closes;
- delegates native activate/close/add without copying native tab state; and
- supplies component content only while a Side Chat is active, so native tabs
  continue rendering the existing `ViewTabBar` child unchanged.

For a registered chat-enabled view whose current adapter is null, the bridge
activates only when at least one Side Chat placement exists. It reconstructs a
runtime-only root descriptor using the view's existing label/icon and exact
`viewId`, then appends the persisted Side Chat descriptor(s). The root renders
the pre-existing `ViewTabBar` child by omitting component content while active;
the child is never placed in JSON, cloned, or remounted as a plugin. When the
last Side Chat placement closes, the synthetic root/rail disappear and the view
returns to its prior children-only presentation.

The root marker is deterministic but not durable content. Side Chat descriptors
and combined active/ordering state live only in the owning group's worksurface.
The bridge is the sole owner of the combined projection; native stores remain
the sole owner of native tabs. It must preserve the adapter's current
tab/tabpanel ARIA relationship, add/close keyboard behavior, and focus recovery.

This bridge covers every currently registered chat-enabled built-in/custom
view, including Issues, Wiki, Browser, and Agents, without registering each view
as a component. If a view cannot safely preserve/render its existing child
through this boundary, Move is server-rejected for that explicit view
capability until a separately reviewed adapter lands; the UI must not offer an
action that can commit an unrenderable projection.

### 3.2 Persisted Side Chat descriptor

The worksurface adapter creates one normal generic component record, equivalent
to:

```ts
type SideChatComponentTab = {
  tabId: string;
  content: {
    kind: 'component';
    revision: number;
    component: {
      schemaVersion: 1;
      componentTypeId: 'fusion.chat-surface';
      componentInstanceId: string;
      targetKey: string;
      input: {
        workspaceId: string;
        viewId: string;
        threadGroupId: string;
        threadId: string;
        projectionId: string;
        host: 'side-tab';
      };
    };
  };
};
```

Exact property names may follow the accepted generic contract. The semantics
may not change.

Stable target identity is the Side Chat presenter plus exact
`{workspaceId, viewId, threadGroupId, threadId}`. `projectionId` supplies
idempotent placement identity. Component instance/surface identity remains
distinct from session and tab IDs.

The registered resolver follows the Composable Chat contract: persisted input
does not carry transient `surfaceId`. On mount it derives a fresh surface ID
from the descriptor's unique `componentInstanceId` plus a runtime mount
generation, then passes that explicit value to `ChatSurface`. It never derives
surface identity from `tabId`, `threadGroupId`, or `threadId`.

For this action only, the worksurface controller implements a focused
`ensureSideChatPlacement(projection)` operation:

1. if the matching open descriptor already exists, activate it;
2. if a matching closed tombstone exists for an ordinary repair/restart, keep
   it closed and mark the projection reconciled;
3. for a newly committed Move, append one filled component tab and activate it;
4. for an explicit validated member deep link, reopen/focus it; and
5. never fill or replace another populated tab.

This is idempotent projection handling, not the later general Open in Current
Tab/Open in New Tab placement system. It does not inspect empty tabs or expose a
launcher.

---

## 4. Authoritative Group Transition

### 4.1 Canonical request

Use the existing product action family:

```json
{
  "type": "thread:action",
  "action": "move_chat_to_side",
  "requestId": "stable-user-invocation-id",
  "threadGroupId": "...",
  "threadId": "expected-current-primary",
  "expectedPrimarySequence": 7
}
```

Workspace/view/trusted-shell context comes from the authenticated connection
and server registry, not arbitrary paths or authority fields in the payload.
`requestId` follows the Composable Chat dispatcher contract: same-ID/same-input
retry returns the stored result, different-input reuse fails, and every
completion/error echoes it. `expectedPrimarySequence` comes from the atomic
`{currentPrimaryThreadId, currentPrimarySequence}` group list/hydration
projection required by Composable Chat; it is never guessed from local tab
order or requested through an undocumented side channel.

### 4.2 Transaction

After the dispatcher checks the common action ledger, under the group's
exclusive mutation lease the service:

1. resolves the registered workspace and immutable view binding;
2. verifies the request member belongs to the group, remains current primary,
   and `expectedPrimarySequence` exactly equals the authoritative current
   primary-event sequence under the group lease;
3. proves the source runtime is terminal and drained;
4. reads the last acknowledged server-owned harness and portable model/variant
   selection, validating it against current policy;
5. asks `ThreadManager` to create a fresh cold session and its pending
   mirror-creation journal row through the transaction-capable primitive,
   passing the authoritative group's workspace/view compatibility binding and
   canonical workspace runtime scope; no final mirror is written before commit;
6. inserts the new member at the next immutable ordinal with
   `origin_kind='move-to-side-chat-primary'`;
7. appends a primary event from old to new with `reason='move-to-side-chat'`;
8. updates the group's current-primary cache in the same transaction;
9. inserts the idempotent group activity event and advances group MRU;
10. inserts a pending `open-side-chat-tab` projection for the old member;
11. records the reconstructable successful action result for `requestId`; and
12. commits once.

Any failure before commit leaves membership, primary, MRU, projection, session,
mirror journal, and final mirror unchanged. After commit, `ThreadManager`
applies the mirror row through the Composable Chat atomic writer; failure leaves
the structural Move committed, returns `mirrorStatus='repair_required'`, and
retries on startup/workspace reattach. A crash after final rename is reconciled
against that row. Never raw-insert a session, write an unjournaled final mirror,
or shallow-copy `harness_config`.

A retry after commit but before requester delivery reads that stored result and
does not acquire the lease, create another session, append another primary
event, or duplicate the projection.

A missing, malformed, fabricated, or stale `expectedPrimarySequence` returns a
bounded `stale_primary` conflict containing the current primary ID/sequence and
performs no session, mirror-journal, membership, event, MRU, projection, action
result-success, or UI mutation. The client must rehydrate before deliberately
retrying against the new authoritative pair.

### 4.3 Response and fan-out

After commit:

- the projection worker applies/focuses the Side Chat tab through the owning
  view-state service;
- the server marks projection status only after that write succeeds;
- regardless of projection success, one authoritative `thread:primary_changed`
  fact and group/list result fan to all workspace windows. The fact carries
  workspace/view/group IDs, previous and new primary IDs, primary sequence,
  group revision, stable `projectionId`, current projection status, the bounded
  intended Side Chat descriptor, and
  `viewStateStatus: 'persisted' | 'repair_required'`;
- successful view-state replacement fans through the existing `state:changed`
  path with the same projection ID and resulting worksurface revision. A failed
  or still-pending projection sends no fictitious applied state; every window
  can show the same bounded repair/pending status, and later repair fans the
  authoritative `state:changed` placement;
- the requester receives the committed transition plus
  `viewStateStatus: 'persisted' | 'repair_required'` and
  `mirrorStatus: 'persisted' | 'repair_required'` from the manager-owned
  creation row.

Reconnect/group hydration returns the same current-primary sequence and pending
or terminal projection summary, so a window that missed either fan-out learns
both the committed primary and whether Side placement still needs repair. The
intended descriptor is identity/presentation input, not proof that file-backed
placement was applied.

Requester delivery, other-window delivery, optional event publication, and
view-state application are mutually failure-isolated after commit. None may
rerun the group transaction or create a second replacement session.

The initiating renderer treats the request as pending presentation only. Chat A
remains mounted as Main, no Side Chat placement is installed locally, and no
composer/thread selection is cleared until a matching
`thread:action:completed` or `thread:primary_changed` carries the committed new
primary. The Side tab itself appears only from an authoritative persisted
`state:changed` worksurface fact, never merely from the intended descriptor.
Any precommit rejection, conflict, policy error,
database error, timeout without authoritative state, or mismatched/stale
response releases pending affordances and leaves/restores the exact pre-action
UI. If the server committed but the requester acknowledgement was lost, the
same-`requestId` retry recovers the stored transition and current mirror/view
repair statuses; optimistic inference is forbidden.

---

## 5. Projection Persistence and Recovery

Extend the group view-projection outbox established by Composable Chat with
`kind='open-side-chat-tab'` and fields sufficient for stable idempotency:

- projection ID derived from view, group, and primary-event sequence;
- workspace ID and immutable view ID;
- group ID;
- old member thread ID and ordinal;
- `status: pending | applied | cancelled`;
- created and terminal timestamps.

The outbox never stores the worksurface snapshot. The view capsule's existing
`threadWorksurfaces[threadGroupId]` record remains its only owner.

Unlike the base group-delete cleanup row's bounded terminal retention, every
`open-side-chat-tab` row remains for the life of its group/member in all
`pending`, `applied`, or `cancelled` states. Its stable `projectionId` is the
durable identity used by close tombstones and exact-member reopen links; normal
retention cannot purge or replace it. Only group deletion may make the member
link invalid and retire the row, after group cleanup plus the supported
delete/link retry window completes.

Recovery rules:

- retry only `pending` instructions through the same idempotent view-state
  operation;
- a crash after state write but before outbox acknowledgement finds/focuses the
  matching descriptor rather than duplicating it;
- an applied instruction is not replayed merely because its row remains;
- every close first sends a stable-`clientMutationId`, revision-checked
  view-state command. The owning service durably writes the closed
  placement/tombstone before any window removes the tab; it does not change
  membership. An already `applied` outbox row remains applied;
- successful close fans the authoritative `state:changed` result to every
  mounted window, which removes/focuses from that committed snapshot rather
  than optimistic local state;
- when close races a `pending` initial application, the tombstone write commits
  first; only afterward does the projection owner mark the SQLite outbox row
  `cancelled` in its own transaction. These stores are never described as one
  atomic write. If process death or cancellation-write failure occurs between
  them, startup/retry sees the durable tombstone before applying the pending
  open and idempotently marks the same row cancelled without opening a tab;
- the open worker and close writer serialize through the per-view state queue
  and revision CAS. It rechecks the tombstone immediately before writing: open
  first is followed by the authoritative close; tombstone first makes a stale
  open fail/reconcile to cancelled;
- if the tombstone write or revision check fails, every window keeps or
  restores the Side Chat placement and exposes a retryable error. If requester
  delivery is lost after the tombstone commits, same-mutation retry or
  authoritative fan-out returns the closed fact; the requester never guesses
  from timeout. A local-only close is forbidden;
- ordinary startup/reconnect preserves a closed tombstone;
- an explicit validated exact-member link may reopen it;
- a missing/deleted group cancels pending open and relies on the group's
  existing cleanup projection; and
- projection failure is visible/retryable and never changes the committed Main
  Chat back to the old member.

Close completion/fan-out reports the durable `placementStatus='closed'`, current
projection status, resulting view-state revision, and
`projectionCancelStatus: 'persisted' | 'repair_required'` when a pending row
needed cancellation. A repair-required cancellation never weakens the already
durable tombstone.

Cross-window worksurface writes use the per-view revision/coordinator from
Composable Chat. Projection entries are service-owned by `projectionId` so an
ordinary content capture/rebase cannot silently remove or duplicate them. A
projection `state:changed` fact additionally carries `projectionId`,
`placementStatus: 'open' | 'closed'`, and
`projectionStatus: 'pending' | 'applied' | 'cancelled'`. Placement and outbox
status remain distinct: closing an applied projection closes placement while
the historical outbox row stays applied. When local content intent is dirty,
the coordinator merges the service-owned open/closed placement immediately by
`projectionId`, preserves/rebases user-owned pending fields, and never lets an
ordinary capture reopen a tombstone. Only the acknowledged close or validated
exact-member reopen action may change that placement state.

---

## 6. Runtime, Concurrency, and Deletion

### 6.1 Independent mounted sessions

The new Main and old Side session may be mounted and run concurrently.

- messages, streams, readiness, usage, drafts, attachments, model/variant,
  diagnostics, Stop, and runtime generations remain keyed by `threadId`;
- menu/focus/DOM state remains keyed by `surfaceId`;
- open responses echo enough surface/group/session correlation to hydrate the
  intended mount;
- live provider frames remain routed by `threadId`; and
- passive Side Chat hydration never warms the harness.

Changing model/variant in one member cannot change the other. Future Move reads
the source Main Chat's last acknowledged selection only.

### 6.2 Move/Move and Move/Delete

The group mutation lease covers every membership/primary-changing action.

- Concurrent Moves serialize; the loser revalidates the now-current primary
  and either applies to it only with a matching request or returns a conflict.
- Move-first versus Delete causes Delete to enumerate and remove both members
  plus projections after the Move transaction.
- Delete-first versus Move causes Move to return deleting/not-found and create
  no session or mirror.
- No interleaving may leave a member without membership, a primary cache without
  an event, an unjournaled mirror, or an orphaned projection.

Group Delete still rejects while any member is active/draining. Once all are
terminal, it fences every member runtime, writes mirror cleanup rows and the
group worksurface removal projection, and deletes canonically. Injected late
frames from the old generation cannot recreate data or publish a ghost result.

---

## 7. Exact Member Links

Keep the primary group URI from Composable Chat and add a versioned exact-member
form for view-bound Side Chats:

```text
fusion-studio://thread/open?v=1&workspaceId=<opaque-id>&threadGroupId=<group-id>&threadId=<member-id>
```

The URI identifies workspace, group, and exact member. The server resolves and
validates the group's immutable view binding; the URI never embeds a view-folder
name or filesystem path.

Electron forwards the URI to the existing server resolver. The server validates
workspace ownership, view binding, group membership, and projection/member
eligibility before the renderer changes selection. Invalid, removed,
wrong-workspace, wrong-view, or Legacy member links leave current selection
unchanged.

A valid link selects the group and uses acknowledged revisioned view-state
placement to focus/reopen the exact Side Chat. It does not make that member Main
Chat or copy its context.

---

## 8. Code-Standards Compliance

### 8.1 Existing owners

- Shared chat menu emits the canonical product action.
- Existing `thread:action` dispatcher owns the public command route.
- Thread-group service owns lease, membership, primary history, group MRU, and
  projection instruction.
- `ThreadManager` owns session creation, harness namespaces, and Markdown
  mirrors.
- Runtime manager owns drain/fence/late-frame rejection.
- Existing view-state service and `WorksurfaceAdapter` own tab placement.
- Generic component-tab host owns component rendering only.
- Connected Side Chat host adapts stores/actions into portable `ChatSurface`.

No layer may bypass another owner or duplicate its state.

### 8.2 Canonical vocabulary and boundaries

The renderer sends `move_chat_to_side`, never OpenCode/provider syntax. The
adapter does not interpret product membership. Portable UI does not call the
backend or mutate global stores. Provider bindings remain server-owned.

New CSS, if any, uses prefixed classes and existing workspace/content variables
with fallbacks. Centering belongs to the host layout, not inline styles in
`ChatSurface`.

### 8.3 File responsibility

Keep menu descriptor, connected Side Chat host, group transition, projection
worker, link parsing, and focused tests in single-job modules. Do not grow
`ChatSurface`, `ViewTabBar`, `ThreadManager`, view-state writer, or one WebSocket
handler into the combined owner of the feature.

---

## 9. Dependency-Ordered Vertical Slices

### Slice 1 — Verify prerequisite boundaries

- Prove Composable Chat's Fork removal remains complete and no public or
  low-level Fusion path can emit provider fork syntax or create an ungrouped
  session.
- Prove the generic component host and first-party `ChatSurface` registration
  match their accepted contracts before adding a Side Chat branch.

### Slice 2 — Transactional Move

- Extend group membership reasons, primary events, activity, and projection
  kinds.
- Add the shared-menu action through `thread:action` and the group lease.
- Create the fresh Main Chat through `ThreadManager`, copying only validated
  harness/model/variant selection and using its durable mirror-creation journal.
- Prove atomicity, stale-primary conflicts, active-source rejection,
  same-request idempotency after a dropped acknowledgement, multi-window
  fan-out, DB/file crash recovery, and restart/readback before rendering.
- Prove the requester retains Chat A as Main and creates no local Side placement
  until authoritative success; every precommit rejection and mismatched/timeout
  response leaves or restores the exact prior UI.

### Slice 3 — Side Chat component placement

- Add the connected Side Chat tab bridge. Prove it composes with Capture/File
  adapters and supplies a reversible synthetic root for every adapterless
  chat-enabled view without copying native state or view children into JSON.
- Add idempotent filled-component placement through the existing worksurface
  adapter and accepted generic host.
- Mount the old member with the exact composable `ChatSurface`, centered, no
  local rail, shared header/list/menu intact.
- Route close through the revision-checked view-state owner, persist the
  tombstone/cancelled projection before UI removal, and fan the acknowledged
  snapshot to every window. Prove write/revision/ack failure keeps or restores
  placement and ordinary restart preserves an intentional successful close.

### Slice 4 — Recovery, links, repeated use, and deletion races

- Add projection retry/acknowledgement, explicit exact-member reopen links, and
  two-window revision convergence. Retain each open projection identity for its
  group/member lifetime; inject initial placement failure and prove every
  window/reconnect receives the same pending projection-aware primary fact.
- Repeat Move and prove one rail row with chronological Side Chats and a fresh
  Main Chat each time.
- Run concurrent Main/Side prompts and exact Stop actions.
- Race Move/Delete and pending-open/close; kill after file-backed tombstone but
  before SQLite cancellation; inject view-state/mirror/delivery/late-frame
  failures and prove deterministic recovery.

### Slice 5 — Retire Secondary Chat

- After the content-tab path passes, delete the floating/sticky/minimized
  Secondary Chat UI, store state, geometry, tracker, routing workarounds, CSS,
  tests, and active documentation.
- Update Chat System Identity, Runtime, UI, Structure, Decisions, and Changelog
  pages to the shipped model.
- Run the complete regression and Electron acceptance walk.

Every slice begins at the public action, crosses the owning service/state
boundaries, proves persistence/readback where applicable, and records changed
files, exact commands/results, warnings, and residual risk.

---

## 10. Verification Matrix

| Area | Required proof |
|---|---|
| Entry/authority | Action appears only on eligible Main Chat; raw/custom/harness/model origins fail server authorization; UI disabled state is not trusted. |
| Atomic structure | One request yields one new member, primary event/cache, activity, and projection or no structural change. Duplicate/stale requests cannot add sessions. |
| Acknowledged UI commit | Before correlated authoritative success, Chat A remains Main and no Side placement or cleared composer/selection appears. Ineligible-view, stale-primary, active-runtime, policy, database, timeout, and mismatched-response cases restore/retain the exact prior UI. Lost acknowledgement converges only through same-ID recovery or authoritative fan-out. |
| Request retry | Completion/error echoes `requestId`; dropping the post-commit response and retrying the same ID returns the stored transition without another member/event/projection; payload mismatch fails. Correct primary ID with missing/fabricated/stale sequence returns `stale_primary` and creates nothing. |
| Freshness | New Main contains no old messages, exchanges, summaries, provider ID, resume/fork state, attachments, drafts, or runtime. Only validated harness/model/variant selection carries. |
| Old-session preservation | Old `threadId`, exchanges, provider binding, runtime identity, and Markdown mirror remain unchanged. |
| Generic host use | Persisted tab is a normal component descriptor resolved by the first-party Chat registration; rail/host contain no Side Chat branch; no empty-fill implementation is duplicated. |
| View-host coverage | Capture/File preserve native adapter behavior while Side tabs compose into the rail; Issues/Wiki/Browser/Agents and other adapterless chat-enabled views retain their existing child as a reconstructed root, render Side Chat, and return to children-only presentation after the last Side tab closes. Ineligible views reject before commit. |
| Presentation | Side Chat is centered, has no local rail, and retains the same header/list/menu/composer/message/attachment/usage/Stop behavior. |
| Isolation | Concurrent Main and Side prompts, streams, model changes, Stop, menus, focus, and usage do not cross. |
| Close/reopen | Close removes placement only after its correlated durable tombstone succeeds; acknowledgement then fans one authoritative removal to all windows. Inject tombstone/revision failure and prove the tab remains; drop delivery after commit and recover the same closed result without guessing. Kill after tombstone but before pending-outbox cancellation: restart sees the tombstone, cancels the row, and never opens. A validated exact-member link reuses the original lifetime-retained `projectionId` to reopen/focus without promotion. |
| Projection failure | Inject the first view-state write failure after SQLite Move commit. Every window receives the same projection-aware `thread:primary_changed` fact with new primary, sequence, stable projection ID, intended descriptor, pending status, and `viewStateStatus='repair_required'`; none treats it as applied. Later idempotent repair fans the persisted `state:changed` once, never duplicates a tab, and never rolls back primary. Reconnect between failure and repair hydrates the same pending fact. |
| Mirror creation | A pending manager journal row is committed with the new session; no final mirror precedes commit. Process death before write or after atomic rename repairs/acknowledges exactly once, exposes current `mirrorStatus`, and creates no orphan or duplicate. |
| Multi-window | Both windows converge on current Main/member structure plus pending/applied/cancelled projection identity and repair status, even when initial placement fails; successful placement/close facts use authoritative `state:changed`, and reconnect hydrates missed facts. |
| Repeated Move | Two moves retain one group row, append two peers/events/Side tabs in ordinal order, and leave the third fresh session Main. |
| Delete race | Only Move-first or Delete-first legal outcome occurs; no orphan member/mirror/event/projection; busy runtimes prevent partial deletion; late frames stay fenced. |
| Fork/Secondary removal | Stale-symbol and provider-argument sweeps find no Fork path; after replacement, no Secondary popup/sticky/minimized code or state remains. |
| Build/tests | Focused client/server tests, full server `npm test`, client `npm run build`, restart/readback, and Electron acceptance walk pass with warnings classified. |

---

## 11. Definition of Done

1. Move Chat to Side Chat is one guarded `thread:action` transition.
2. The old Main Chat remains unchanged as a centered component-backed Side Chat.
3. The replacement Main Chat is durable, cold, empty, and context-free.
4. Only validated harness/model/variant selection carries forward.
5. Membership and primary history are transactional, append-only, peer-based,
   and serialized against Delete/Move.
6. View state owns placement; SQLite owns only structure and recoverable
   projection instruction. The renderer changes Main/Side presentation only
   from correlated authoritative success.
7. Closing/reopening, restart repair, multi-window fan-out, and exact links are
   deterministic and idempotent.
8. Main and Side sessions operate concurrently without state or routing leaks.
9. The generic rail/host and portable ChatSurface acquire no Side Chat-specific
   state ownership.
10. Fork and the replaced Secondary Chat implementation are deleted end to end.
11. New-session mirror creation uses the manager journal and survives every
    DB/file crash boundary without orphaning or duplicating a mirror.
12. All verification and documentation updates pass with a complete handoff.

---

## 12. Explicitly Out of Scope

- arbitrary New Side Chat or Send to Side Chat commands;
- automatic resume, summarization, helper/subagent handoff, or appended text;
- promoting an existing Side Chat to Main Chat;
- a side-session browser, nested rail, family tree, or chat parent/child roles;
- generic Open in Current/New Tab placement and empty launcher behavior;
- view-configured tab selectors, Home/Content presenters, or capsule relocation;
- collection folders/tags, ranking, Archive UI, or thread reassignment;
- plugins, Provenance, dependencies, permissions, Browse, or sideloading;
- automatic/LLM naming, attachment title/icon stacks, or transcript export;
- project folder creation, templates, CWD overrides, Routines, Agents, or inbox
  reply surfaces; and
- automation-origin thread/session creation.

---

## 13. No Open Decisions

The prior combined document is archival provenance only. This SPEC controls the
Move Chat to Side Chat action and its component placement; the generic host and
Composable Chat prerequisites control their own domains. Any proposal to copy
context, use an empty launcher, introduce another transport family, make a Side
Chat visible in the rail, or add general placement/config/plugin behavior must
return to the owner instead of widening this implementation.
