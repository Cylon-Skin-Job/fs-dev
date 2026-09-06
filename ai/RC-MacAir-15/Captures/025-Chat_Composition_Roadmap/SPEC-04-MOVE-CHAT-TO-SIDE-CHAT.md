# SPEC-04 — Move Chat to Side Chat

**Status:** `DRAFT_CANDIDATE`  
**Domain owner:** the Move Chat to Side Chat product transition  
**Prerequisites:** owner-accepted SPEC-03  
**Blocks:** roadmap completion

## 1. Objective

Deliver one explicit action that moves the unchanged current Main Chat into a
Side Chat tab and creates a new empty Main Chat in the same Thread Group. The
action must be atomic at the durable chat boundary, idempotent across retries,
recoverable across process failure, and placed through the accepted generic tab
host without adding chat-specific behavior to that host.

No conversation context is copied. The old session remains a complete peer
member and the new session becomes current Main Chat. This is the only workflow
added by this SPEC.

## 2. Authorities And Baseline

Read before implementation:

- bundle `BUNDLE-INDEX.md`, `DECISIONS.md`, `ISSUES.md`, and `GUIDANCE.md`;
- `../../../../AGENTS.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`;
- the Chat System Identity And Persistence, WebSocket Protocol, Thread Actions,
  Chat UI, Runtime Model, Structure, and Testing And Operations pages;
- owner-accepted SPEC-01 through SPEC-03 reports, exact public types, tests,
  warnings, and deviations;
- the independently accepted Generic Component Tab Host report and exact
  descriptor/resolver/rendering contract; and
- current Main Chat, Secondary Chat, view-tab, model-selection, ThreadManager,
  WebSocket action, and thread runtime owners.

The orchestrator records the accepted migration head and revalidates that
`fusion.chat-surface` resolves through the generic host before Slice 04A.

## 3. User-Visible Contract

For a current Main Chat session `A` in group `G`:

1. the user invokes **Move Chat to Side Chat**;
2. Fusion durably creates a new empty session `B` in `G`;
3. `B` becomes the current Main Chat;
4. unchanged `A` appears centered in a Side Chat tab in the same view; and
5. the ThreadRail still shows one row for `G`.

`A` retains all transcript, turns, runtime, model history, usage, and
Provenance. `B` has no messages or copied context. A future Send to Chat action
may explicitly transfer material, but Move does not.

The Side Chat uses the same composable chat surface, header, composer, list
button, and menu behavior. It has no nested thread list. Its list button operates
the outer owning view's ThreadRail. Closing its tab removes only the placement;
it does not delete `A` or remove it from `G`.

## 4. Eligibility And Action Contract

The action is available only when all are true:

- the host is a view-bound `main` Chat Surface with non-null stable `viewId`;
- the selected group and session are hydrated and `threadId` is the group's
  current primary member;
- no accepted Move for the same `requestId` is already being resolved;
- the session has no active or accepting turn and no unresolved Stop boundary;
- the renderer has no unresolved `set_harness_selection` action for the session;
- the selected harness/model/variant can create a new session under current
  policy; and
- the owning view/tab host reports that `fusion.chat-surface` Side Chat
  placement is supported.

Legacy Main Chat, Side Chat, stale/non-primary member, pending creation or model
selection, disabled component, and active-turn callers receive classified inert
failures. The action never silently falls back to another view, group, session,
model, or component.

Use the accepted mutation family:

```ts
type MoveChatToSideChatAction = {
  type: 'thread:action';
  action: 'move_chat_to_side';
  requestId: string;
  threadGroupId: string;
  threadId: string;
  expectedPrimarySequence: number;
};
```

The correlated result returns group ID, moved and new Main session IDs, committed
primary sequence, authoritative view ID, stable placement ID/status, and
classified warnings. Workspace comes from the authenticated bound connection;
view comes from the group. Redundant client workspace/view authority fields are
schema-rejected. A `requestId` replay returns the recorded result and performs no
second move.

## 5. Atomic Group Transition

Under the accepted Thread Group mutation lease/transaction, the server:

1. authorizes the exact workspace/view/group/current-primary tuple;
2. validates expected primary sequence, runtime state, and current creation
   policy;
3. reserves an independently minted `newMainThreadId` and creates its group-
   scoped action ledger record;
4. invokes the ThreadManager-owned durable session/mirror creation boundary;
5. appends `B` as the next peer member with the next ordinal and
   `origin_kind='move-to-side-chat-primary'`;
6. appends a primary-change event from `A` to `B` with reason
   `move-to-side-chat` and updates the transactional primary cache;
7. inserts `move:{requestId}` activity kind `move-chat-to-side` and advances
   group MRU exactly once;
8. inserts a durable `open-side-chat-tab` placement outbox record for `A`; and
9. commits the correlated action result.

The accepted implementation may stage the external harness/mirror operation
through its existing recovery journal, but externally observable truth must be
all-or-recoverable: no committed primary points to a missing session, no created
session is silently lost outside recovery, and a crash at every boundary
converges to the one recorded action result.

`B` inherits only session-start policy resolved at action acceptance: the
server-owned source harness binding plus the source session's last
server-acknowledged portable `{model, variant}` selection from SPEC-01. The
transaction reads those values; neither action accepts a client-supplied harness,
Move payload selection, or pending renderer intent. It does not inherit
messages, usage, turns, draft, attachments, Todo, live frontier, tools,
Provenance, or UI state from `A`.

Primary history remains append-only. Members remain peers; no parent/sibling
role field is added. The action cannot be implemented as Fork.

## 6. Side Chat Placement Contract

The outbox uses a stable independently minted `sideChatPlacementId`. It is not a
Provenance projection ID, `tabId`, `componentInstanceId`, `surfaceId`,
`threadId`, or `threadGroupId`.

The SPEC-04 placement coordinator uses SPEC-03's managed-placement mutation to
convert the accepted record into a generic descriptor
equivalent to:

```ts
type SideChatDescriptor = {
  tabId: string;
  componentTypeId: 'fusion.chat-surface';
  componentInstanceId: string;
  targetKey: string;
  input: {
    workspaceId: string;
    viewId: string;
    threadGroupId: string;
    threadId: string;
    sideChatPlacementId: string;
    host: 'side-tab';
  };
};
```

The exact generic descriptor shape follows the accepted host. It contains no
callback, store, socket, path-derived authority, React element, or persisted
`surfaceId`. The chat registration validates that `A` remains a member of `G`
bound to the exact view before rendering.

The Generic Host remains ignorant of chat semantics and only validates/resolves/
renders the descriptor through its accepted seam. SPEC-04—not the Generic
Host—owns delivery lookup, stable placement matching, insert/focus, close
disposition, deduplication, and recovery through the view/tab adapter and
SPEC-03's managed-placement lane. It must not widen or edit the accepted Generic
Host contract.

SPEC-04 supplies one connected code-owned Side Chat bridge above the existing
adapter lookup. For Capture, File Viewer, or another native adapter, it preserves
that adapter as native-tab owner, composes managed Side Chat descriptors into
the visible ordered rail, delegates native actions unchanged, and renders
component content only while a Side Chat is active. For a registered
chat-enabled view with no adapter—including current Issues, Wiki, Browser, and
Agents—the bridge activates only while at least one Side Chat exists, constructs
a runtime-only root descriptor for the existing child, and appends managed Side
Chats. The root is never serialized or remounted as a plugin. Closing the last
Side Chat returns the view to its prior children-only presentation. Every
registered chat-enabled view is either covered by this bridge or explicitly
ineligible before the server commits Move.

## 7. Delivery, Close, And Recovery

The placement outbox is delivery intent, not a second owner of the view's
managed-placement state:

- a newly committed undelivered Move opens the Side Chat tab;
- a repeated delivery for an existing live/persisted placement focuses or
  acknowledges that placement and creates no duplicate;
- once the SPEC-03 service-owned lane persists the descriptor and the owning
  view adapter materializes/focuses it, delivery is acknowledged;
- closing the tab records a placement tombstone/closed disposition through the
  owning view contract before removing the descriptor;
- a closed disposition prevents restart/outbox replay from reopening the tab;
- a failed delivery remains observable and retryable without undoing the
  already committed group transition; and
- an explicit later member action may reopen the lifetime-retained
  `sideChatPlacementId`; ordinary outbox replay may not.

The SPEC-04 coordinator uses `sideChatPlacementId` as the durable idempotency
key and may use a stable `targetKey` only for its own live view lookup. The
Generic Host merely preserves/validates `targetKey`; it does not search or
deduplicate. Neither key is chat-session authority.

On restart, recover ThreadManager creation and the committed group result first,
then reconcile placement delivery against acknowledged descriptors and close
dispositions. Never reconstruct placement by scanning primary history; that
would resurrect intentionally closed Side Chats.

## 8. Member Access And Repeated Move

The Thread row and Main Chat continue to represent the group/current primary.
SPEC-04 adds a qualified `thread:members` query for one validated group. It
returns ordered projections containing `threadId`, ordinal, `isPrimary`, created
time, bounded display label, and current placement disposition; it never returns
transcript content. Workspace comes from the authenticated connection and the
server returns the group's authoritative nullable view.

The existing Thread row/menu exposes that ordered member list. Choosing a
non-primary member invokes a registered, idempotent `open_member_in_side`
`thread:action` with `requestId`, `threadGroupId`, and `threadId`. The server
validates membership and non-null view, then records a new placement delivery
for the member's existing `sideChatPlacementId` or focuses the existing open
placement. This
creates no session, primary event, or MRU activity. It is not a second
ThreadRail, not a general Collections redesign, and not available in Legacy.

The same member menu may request `copy_link` for an exact member. It returns the
version-1 group application URI with validated `threadId`. Resolving that URI
validates workspace, group, view, and membership, opens/focuses the group's
owning view, and reopens/focuses the member's lifetime
`sideChatPlacementId` through the same placement coordinator without promoting
it or advancing MRU. A group-only URI continues to open the current Main Chat.

After the first Move, the user may later Move current Main `B`. The system adds
empty peer `C`, makes `C` primary, and places unchanged `B` beside any still-open
`A`. Each action has independent primary and placement events. Eight consecutive
moves still produce one Thread row and nine ordered peer sessions, not nested
threads or a lineage tree.

## 9. Race And Failure Invariants

- Move and Delete serialize through the same group mutation authority and both
  revalidate under the lease. Move-first commits, then Delete enumerates and
  removes both members plus group worksurface/placement cleanup. Delete-first
  commits, then Move returns deleting/not-found and creates no session, mirror,
  event, or placement.
- Two windows moving the same primary with different request IDs cannot both
  commit from the same expected sequence.
- A retry with the same request ID returns the same `B` and placement ID.
- A stale window cannot move a non-primary session.
- Move reads the source session's last server-acknowledged portable selection;
  a pending/rejected selection cannot leak into the new Main Chat.
- Action acknowledgement and group/view fanout are distinct. Every window
  converges from qualified committed events without treating broadcast as its
  request acknowledgement.
- Live stream, Stop, saved-turn, usage, and readiness frames for `A` remain
  addressed to `A`; no frame is reassigned to `B` or the placement.
- Placement failure never copies, deletes, or changes either transcript.
- Closing/reopening a Side Chat never warms, forks, or creates a harness session
  for its existing member.
- Deleting `G` follows accepted group, worksurface, placement, and Provenance
  cleanup/retention contracts; no tab owner invents a cascade.

## 10. Existing Secondary Chat Retirement

The legacy singleton/floating Secondary Chat remains available until the new
Side Chat passes all focused and Electron acceptance checks. In the final slice,
remove its routes, state, rendering, shortcuts, and dead styles rather than
leaving two authorities.

Migration does not convert transient Secondary Chat UI into a group member or
tab. Existing durable sessions remain covered by SPEC-01 migration. If the
baseline reveals durable Secondary-only identity not represented there, stop
and record a migration/deviation decision before removal.

## 11. Dependency-Ordered Slices

### Slice 04A — End-to-end Move in one adapted view

- Start at the visible Main Chat menu and carry one Move through eligibility,
  trusted-shell `thread:action`, sequence/idempotency, ThreadManager/group/MRU
  transaction, durable outbox, SPEC-03 managed placement, the code-owned bridge,
  `fusion.chat-surface` resolution, centered Side rendering, authoritative
  fan-out, and restart/readback in one representative adapted view.
- Add the next free migration when needed and prove failure at every boundary
  without exposing a server-only primary change as an accepted slice.

### Slice 04B — Adapterless and native-view coverage

- Extend the same complete public Move path through the Side Chat bridge for
  Capture/File/native adapters and Issues/Wiki/Browser/Agents adapterless hosts.
- Preserve native tab owners, runtime-only roots, existing children, ARIA/focus,
  list-button outer-rail behavior, dedupe/focus, and ineligible precommit
  rejection; do not assume or add a Generic Host placement API.

### Slice 04C — Close, restart, access, and repetition

- Persist close disposition and prevent resurrection on restart.
- Add exact `thread:members` hydration and idempotent
  `open_member_in_side` access to non-primary group members.
- Prove repeated Move, close/reopen, restart, disabled component, unavailable
  member, two-window, and group-delete behavior.
- Run full server/client/build/Electron checks.

### Slice 04D — Retire singleton Secondary Chat

- Remove old Secondary Chat code paths only after replacement acceptance tests
  pass.
- Re-run route/state/style dead-code searches and full regressions.
- Synchronize Chat Wiki/code-standard references and produce the final report.

Every slice follows `GUIDANCE.md`: one fresh `spec-slice-builder` owns the slice,
repairs through its first clean independent review, then the orchestrator runs a
separate clean review and fail-forward repair before integration.

## 12. Required Verification

Add focused tests equivalent to:

- server integration coverage for `move_chat_to_side` and recovery;
- `e2e/move-chat-to-side-chat.spec.ts`;
- `e2e/side-chat-placement-recovery.spec.ts`; and
- `e2e/side-chat-isolation.spec.ts`.

Required scenarios:

- one Move leaves `A` unchanged, creates empty `B`, makes `B` primary, and keeps
  one Thread row;
- `B` membership uses origin `move-to-side-chat-primary`;
- one accepted Move writes one idempotent activity and advances group MRU once;
  retry, close, member reopen, and placement repair do not advance it;
- `A` and `B` send, stream, Stop, report usage/readiness/model, draft, attach,
  and restore without crossover;
- request replay creates no second session/tab and returns the same result;
- different-request two-window Move race commits once from one sequence;
- Move-first then Delete removes both members and placements; Delete-first makes
  Move inert without creating anything;
- failure/restart at every creation, group-commit, outbox-delivery, view-persist,
  and close-disposition boundary converges correctly;
- closing removes placement only, preserves member access, and does not reopen
  after restart;
- explicit reopen reuses the member's lifetime placement ID without warming or
  creating a session;
- an exact-member version-1 application link validates all identities and
  reopens/focuses that Side Chat without promotion or MRU activity;
- changing model/variant immediately before Move uses only the acknowledged
  exact-session value; pending/rejected intent is never inherited;
- repeated Move produces ordered peers with the newest empty Main Chat;
- Legacy, Side, stale, active-turn, disabled-component, and unsupported-policy
  invocations fail inertly;
- Side Chat has no nested rail and its list button controls the outer rail;
- Capture/File/native and Issues/Wiki/Browser/Agents adapterless views all take
  the complete Move path or reject before commit, preserving existing children;
- accepted Provenance, group, composable surface, worksurface, Generic Host,
  prompt, Stop, and live-overlay tests remain green; and
- no Fork or old Secondary Chat path remains after Slice 04D.

Run at minimum:

```bash
cd fusion-studio-server && npm test -- --runInBand
cd fusion-studio-client && npx playwright test e2e/move-chat-to-side-chat.spec.ts e2e/side-chat-placement-recovery.spec.ts e2e/side-chat-isolation.spec.ts
cd fusion-studio-client && npm run build
```

Perform an Electron smoke that moves the current Main Chat, starts a distinct
conversation in the empty replacement, uses both concurrently, closes/reopens
the Side Chat, relaunches the app, repeats Move several times, toggles the outer
ThreadRail from a Side Chat, and verifies the old Secondary Chat is absent.

## 13. Expected Changed Areas

Expected, not exclusive:

- Thread Group action service, action ledger, primary/activity events, and
  placement delivery persistence;
- ThreadManager session/mirror creation recovery;
- registered WebSocket action schemas/handlers and qualified fanout;
- renderer Main Chat action/menu, group member access, and connected chat host;
- view/tab placement adapter and `fusion.chat-surface` descriptor integration;
- legacy Secondary Chat modules/state/styles/routes removal;
- focused server/client tests and fixtures; and
- Chat/View Wiki and routed standards documentation.

The generic component rail/resolver, Provenance identity, transcript schema,
view adapter content schema, Collections, and Send to Chat are not redesigned.

## 14. Definition Of Done

SPEC-04 and this roadmap are complete only after all slices, targeted/full
checks, restart and Electron smokes, first clean builder-owned and
orchestrator-owned reviews, deviation accounting, supervisor review,
documentation sync, and explicit owner acceptance. A placed Side Chat plus a
fresh empty Main Chat is the required outcome; a passing server transition
without production placement is incomplete.
