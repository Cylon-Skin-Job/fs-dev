# SPEC-01 — Thread Group Foundation

**Status:** `DRAFT_CANDIDATE`  
**Domain owner:** server Thread Group domain with ThreadManager integration  
**Prerequisites:** accepted SPEC-00; integrated owner-accepted Agent Tool Provenance; approved BRIDGE-01 and BRIDGE-02; owner-released accepted Tab Platform milestone
**Blocks:** SPEC-02, Pending New Chat, Collections, and every multi-member thread action

## 1. Objective

Introduce one durable Thread Group as the user-visible Thread while preserving
every existing chat session as an independently routed `threadId`. Migrate
retained sessions into one-member groups, make every production session-creation
path group-safe, move visible-thread behavior to the group owner, and remove
Fork before group-backed data becomes public.

At acceptance, the current interface may look much as it does today. The
structural change is that every visible row is now a group with one current Main
Chat, not a raw session row.

## 2. Authorities And Baseline

Read before implementation:

- `BUNDLE-INDEX.md`, `DECISIONS.md`, `ISSUES.md`, and `GUIDANCE.md`;
- `../../../../AGENTS.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`;
- `../../Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`;
- Chat Identity And Persistence, Chat WebSocket Protocol, Thread Actions,
  Runtime Model, Structure, and Testing And Operations;
- the final owner-accepted Agent Tool Provenance SPEC, implementation report,
  changed-path evidence, and accepted regression commands; and
- the accepted `SPEC-00-TRUSTED-FUSION-SHELL-AUTHORITY.md` report and exported
  server connection-authority guard;
- the approved BRIDGE-01 and BRIDGE-02 contracts, consumed without local
  additions or reinterpretation;
- the accepted TABS-03 report, implementation commits, exact fingerprint, and
  exported placement boundary as a protected non-owned baseline; and
- the current `threads`, `exchanges`, ThreadManager, ThreadIndex, thread runtime,
  thread WebSocket, chat search, OpenCode, and Markdown mirror code/tests.

The orchestrator records the exact integrated Provenance commit, accepted
SPEC-00 commit/report, approved bridge candidates, owner-released Tab Platform
milestone, and migration head before dispatch. Use the next free migration
after that baseline. Do not rename an already-run migration, assume `037`, or
edit an accepted prerequisite migration.

## 3. Scope

### In scope

- Thread Group schema, repositories, constraints, and migration;
- registry-owned stable view-ID preflight before any group binding;
- lossless one-group-per-session backfill;
- one-member group creation through the ThreadManager-owned session primitive;
- membership, initial primary history, group activity/MRU, and repair checks;
- group-backed list, passive open, eager create/open, search, Rename, Delete,
  Copy Link, Resolve Link, and View Markdown;
- canonical `thread:action` mutation routing, request idempotency, requester
  acknowledgement, workspace fan-out, and reconnect hydration;
- consumption of SPEC-00's accepted server-owned `trusted-shell` connection
  guard on new-session creation and durable thread mutations;
- runtime-safe, mirror-recoverable, Provenance-safe group deletion;
- end-to-end removal of Fork/context cloning and the obsolete `thread:touch`
  secondary-chat ordering path; and
- minimal current-renderer compatibility needed to consume group-backed rows
  without extracting the composable surfaces owned by SPEC-02.

### Out of scope

- portable `ChatSurface` or `ThreadRail` extraction;
- group-keyed view worksurface persistence;
- component tabs, registration, Side Chat placement, or multiple members;
- Pending New Chat/provider-signal-gated commit;
- Collections, System view relocation, or protected-root enforcement beyond the
  bounded missing-ID preflight;
- Send to Chat expansion, automatic naming, transcript export, folders,
  templates, CWD policy, plugins, or automation authority; and
- Electron shell origin, runtime descriptor, connection proof, child-process
  environment policy, protected-System permissions, or a general remote-account
  authentication platform.

## 4. Identity And Ownership Contract

| Identity | Owner | Meaning |
|---|---|---|
| `workspaceId` | workspace registry | Durable workspace owner; never a path or basename |
| `viewId` | view registry | Immutable view binding; null only for Legacy |
| `threadGroupId` | Thread Group service | Visible Thread/body of work and group actions |
| `threadId` | ThreadManager | One transcript, runtime, harness binding, and live route |
| `turnId` | prompt/runtime owner | One accepted in-flight turn |
| `exchangeId` | SQLite exchange owner | One saved exchange after canonical turn-end persistence |
| `requestId` | caller plus action-result owner | One durable user action retry identity |

`threadGroupId` and `threadId` are different types even when migration assigns
the same legacy string to both. New groups and new sessions receive independently
minted opaque host IDs. Live frames, Stop, exchanges, provider state, and Agent
Tool Provenance continue to use `threadId`/`turnId`, never group identity.

The group owns its title, view binding, membership, current-primary cache and
history, visible-list MRU, and group actions. The session continues to own its
transcript, exchanges, Markdown mirror, harness/provider binding, runtime,
usage, draft, and live route.

## 5. Persistence Contract

### 5.1 `thread_groups`

Required fields:

- bounded opaque `group_id` primary key;
- non-null registered `workspace_id`;
- nullable immutable `view_id`, where null means Legacy;
- nullable visible `name`;
- non-null `current_primary_thread_id` naming an exact member;
- `created_at`; and
- `updated_at`, the sole visible-list MRU clock.

Index list reads by `{workspace_id, view_id, updated_at, group_id}`. Ordering is
`updated_at DESC, group_id ASC` so equal clocks remain deterministic.

### 5.2 `thread_group_members`

Required fields:

- `group_id`;
- `thread_id`, globally unique in this table so one session belongs to exactly
  one group;
- positive immutable `ordinal`, unique within the group;
- `origin_kind='initial'` in this SPEC; and
- `joined_at`.

The accepted database mechanism must prevent a committed group from naming a
non-member primary. A deferred composite foreign key is preferred; an
implementation-equivalent transactional/repository invariant is allowed only
when tests prove no crash, replay, or direct repository call can commit an
invalid group/member/current-primary combination.

### 5.3 `thread_group_primary_events`

Store an append-only per-group monotonic sequence, group ID, nullable previous
member, required next member, `reason='initial'`, and occurred time. The group
cache and its event commit together. This SPEC writes only the initial event;
SPEC-04 activates `move-to-side-chat`.

### 5.4 `thread_group_activity_events`

Store a durable idempotency key, group ID, exact member thread ID, nullable turn
ID for initial creation, bounded kind, and occurred time. SPEC-01 accepts only
`initial|prompt-accepted`; SPEC-04 extends the owner with
`move-chat-to-side` without changing the meaning of earlier rows.
Canonical keys are:

- `initial:{threadGroupId}`; and
- `prompt:{threadId}:{turnId}`.

Inserting the event and monotonically advancing group `updated_at` are one
transaction. In this SPEC, only initial creation and accepted user prompts
advance group MRU. SPEC-04 adds accepted Move as the third explicit cause.

### 5.5 Operational recovery records

The Thread Group domain owns a durable action-result record keyed by
`{workspaceId, requestId}` and storing action, canonical target/payload hash,
bounded terminal result, and timestamps. It has no cascading group foreign key.

ThreadManager owns durable mirror-creation and mirror-deletion recovery records.
They retain workspace, group, thread, deterministic mirror identity, status,
bounded failure code, and timestamps without transcript text or arbitrary
client paths. The transaction creating a new session/group records mirror work
before commit. Delete records every member mirror before canonical rows vanish.
Startup/workspace reattach retries pending work idempotently.

This SPEC creates no view-state projection or worksurface row. SPEC-03 adds the
separate cross-store cleanup owner when group-keyed worksurfaces become real.

### 5.6 Foreign keys and retained Provenance

- Group/member/current-primary constraints protect structural integrity.
- Group Delete occurs only through the group service; raw session deletion that
  would orphan a group is rejected.
- Action results and cleanup tombstones survive their deleted group for the
  bounded retry/diagnostic window.
- No group/session foreign key cascades into `agent_tool_activities`, resource
  edges, snapshots, blobs, admitted facts, or event-ledger rows.
- Cascading exchange deletion may clear only the optional Provenance exchange
  binding exactly as the accepted Provenance trigger defines.
- This migration synthesizes no historical tool activity or resource fact.

## 6. Migration And Activation

Before touching group rows, the central registry scans every discovered view
capsule. A capsule lacking a valid `metadata.view-id` receives a new opaque ID
through an atomic Fusion-owned manifest-frontmatter write that preserves body,
unrelated keys, content root, state, styles, folder suffix, and order. Existing
valid human-readable IDs are grandfathered. Re-running is a no-op. Parse/write
failure or duplicate ID emits a repair-required diagnostic and stops activation;
the registry does not fall back to the mutable folder suffix or arbitrarily
choose a duplicate.

For every retained registered-workspace session after that preflight:

1. create one group using the existing `thread_id` value as initial `group_id`;
2. copy registered workspace ownership;
3. preserve an exact view ID only when the current registry resolves it;
4. otherwise set `view_id=NULL` and place it in the workspace Legacy host only
   when no exact prior view binding resolves after successful preflight;
5. insert ordinal-1 membership;
6. insert initial primary and activity events;
7. preserve session ID, exchanges, transcript, harness config, provider session,
   name, timestamps, status, message count, and Markdown mirror; and
8. never infer a view from active UI, display title, project name, folder name,
   content root, or path shape.

The owner has authorized retirement of test-stage thread/exchange pairs whose
workspace is null or no longer registered. Before deletion, record only bounded
IDs/counts and reconcile exact generated mirrors through ThreadManager. Preserve
every registered-workspace row.

The schema/backfill may land internally before public activation. Immediately
before group-backed routes become public, quiesce new creation, reconcile every
remaining ungrouped session, switch every production session-creation path to
the atomic group primitive, remove Fork, verify zero ungrouped sessions, and
then publish the group-backed protocol. No interval may expose group-backed
lists while a reachable path can create an ungrouped session.

Migration and activation are idempotent and restart-safe.

## 7. ThreadManager And Runtime Integration

ThreadManager remains the only session/mirror creator and deleter. Add a
transaction-capable primitive that lets the Thread Group service commit session,
group, membership, primary event/cache, initial activity, action result, and
mirror-recovery instruction together. The group service must not clone
ThreadManager's session-limit, harness-config, or mirror rules.

New eager `thread:open-assistant` creation preserves current product behavior:
resolve allowed harness policy, create the one-member group/session, acknowledge,
open, hydrate, and activate. It accepts an already resolved view target and does
not create a file, folder, project, view, template, or CWD binding.

Prompt acceptance records the idempotent group activity before `message:sent`
or provider dispatch. It uses the same immutable workspace/thread/turn authority
accepted by Provenance and never re-reads the current panel to retarget the turn.

Passive open remains passive. It cannot warm, spawn, kill, resume, or reorder a
group. Stop remains `turn:stop` against exact `threadId`.

## 8. Public Protocol

### 8.1 Listing and opening

`thread:list` remains the query family but selects one exact
`{workspaceId, viewId}` population and returns group projections containing at
least:

```ts
type ThreadGroupProjection = {
  threadGroupId: string;
  workspaceId: string;
  viewId: string | null;
  name: string | null;
  currentPrimaryThreadId: string;
  currentPrimarySequence: number;
  memberCount: number;
  createdAt: number;
  updatedAt: number;
};
```

This SPEC always returns `memberCount === 1`; the numeric field is deliberately
forward-compatible because SPEC-04 activates multi-member groups. It does not
expose a member collection in this SPEC.

Workspace comes from the bound server session. A requested view is validated
through the registry and is never authority to switch workspace. Legacy is an
explicit null-view query, not a fallback to whichever panel is active.

Visible-row `thread:open` carries `threadGroupId`; the server resolves and
returns the authoritative current primary plus both identities. An exact-member
open may also carry `threadId`, but the server verifies membership. Unknown
explicit group/member IDs return `not_found` and never create a replacement.

### 8.2 Canonical actions

Use `thread:action` for:

- `rename` — group scope;
- `delete` — group scope;
- `copy_link` — group scope;
- `resolve_link` — group or optional exact current-member target;
- `view_markdown` — exact member; and
- `set_harness_selection` — exact member with client-supplied portable `model`
  and nullable `variant` only; and
- existing provider-backed session actions such as `compact` — exact member.

Durable actions carry `requestId`; group actions carry `threadGroupId`; exact
session actions carry `threadId` and, when membership matters, the group ID.
Same-request/same-input returns the stored result. Different-input reuse returns
`request_mismatch`. Responses are `thread:action:completed|error` and echo the
request/action/authoritative identifiers.

Remove superseded public Rename/Delete/Copy-Link routes rather than keeping
aliases. In this one-member SPEC, `copy_link` returns a versioned application
URI for the group with an optional validated sole/current member, and
`resolve_link` opens Main Chat either way. `view_markdown` separately returns a
validated exact-member mirror path. SPEC-04 exclusively adds non-primary member
link production and Side Chat reopen/focus semantics after such members and
placements exist. Legacy rejects member-placement semantics.

`set_harness_selection` accepts only `{model, variant}` and validates both against
current server policy. Harness ID/binding is read only from server-owned session
state and cannot be supplied or changed by this action. The owner updates the
exact session's authoritative portable selection and returns/fans out the
acknowledged value by `threadId`. Rejection leaves the prior value authoritative.
Renderer intent is pending until that acknowledgement; neither a panel-global
choice nor an unacknowledged optimistic value can be read by creation or Move.

### 8.3 Fan-out and facts

After commit, requester acknowledgement, each other workspace-window delivery,
and any optional post-commit UEB fact are separately failure-isolated. A failed
recipient cannot block another. Reconnect/init hydrates authoritative group
state and never replays the mutation.

Commands are not UEB events. Optional facts cannot gate, roll back, or rewrite
the command result.

### 8.4 Accepted Fusion-shell authority dependency

SPEC-00 exclusively owns the Electron shell origin, runtime endpoint,
bootstrap secret, proof handshake, connection role, privileged-route guard,
redaction, restart rotation, and child-environment policy. This SPEC consumes
only its accepted server-owned guard.

`thread:open-assistant` creation and every durable `thread:action` mutation
require the accepted `trusted-shell` role in addition to server-derived
workspace and validated view/group/session ownership. No request, bridge field,
tab/component identity, workspace file, view config, attachment, model output,
harness message, or automation payload may assert or mint it.

The Thread Group builder may add new guarded call sites and tests but may not
modify, fork, weaken, or reimplement the proof protocol. A discovered defect in
SPEC-00 is an external prerequisite repair, not an implementation deviation.

### 8.5 Search

Search remains exchange/session-backed and returns exact `threadId` and
`exchangeId`. It additionally joins membership/group ownership to return
`threadGroupId`, visible group name, and authoritative view binding. It does not
replace exchange identity with group identity.

## 9. Rename, Delete, And Legacy

Rename changes the group title. It does not rewrite session identity, provider
state, or historical Provenance. Session/mirror title compatibility is not a
second visible-title owner.

Delete acquires the exclusive group-mutation lease, checks every member, and
returns non-mutating `group_busy` while any member is accepting, active,
finalizing, stopping, or draining. Once terminal, it fences every runtime
generation, records mirror deletion and action recovery, deletes group/member/
session/exchange state transactionally, and retries mirror cleanup after commit.
Late frames cannot recreate exchanges or runtime state. Provenance facts remain.

Same-ID retries replay the action result. During the retained recovery window, a
new request against an already deleted group must resolve the group-scoped
cleanup tombstone and return the retained aggregate rather than `not_found` or
rerunning deletion. In the same recovery operation it records that aggregate as
the new request ID's durable action result, so later replay survives tombstone
expiry. Once the bounded tombstone expires, an unseen request receives ordinary
`not_found`.

Legacy groups support list, passive open, eager open/activation, prompt, Stop,
Rename, Delete, Copy Link, Resolve Link, View Markdown, and search. They have no
view worksurface, Collections, or Side Chat. A Legacy link resolves to the
workspace Legacy host and never borrows the active view.

## 10. Fork Removal

Before public group activation remove:

- the Fork composer/button and hook;
- `thread:fork` and `thread:forked` protocol/types/handlers;
- the thread-fork service;
- copied exchange/history creation;
- `pendingFork`, `forkProvenance`, and related config fields;
- OpenCode `--fork` argument construction/consumption;
- Fork-specific tests and compatibility smoke; and
- active plan/Wiki claims that Fork remains available.

Existing stored pending Fork records in the test-stage product must be retired
or normalized without invoking Fork. Never reinterpret one as a Side Chat or
silently resume a provider Fork.

## 11. Dependency-Ordered Slices

### Slice 01A — Safe one-member Thread activation

- Start at the existing New Thread/list/open UI and carry the increment through
  stable view-ID preflight, next-free migration/backfill, repositories,
  accepted trusted-shell guard, atomic ThreadManager group/session/mirror recovery,
  registered WebSocket routes, minimal group-backed rail rendering, restart,
  and second-window hydration.
- Remove Fork and reconcile every creation path before activating the feature;
  no schema-only or hidden ungrouped interval is accepted.
- Prove fresh/upgrade databases, invalid view IDs, untrusted-route denial, one visible
  row per retained/new session, passive open, eager create, crash repair, and
  rollback/readback through the public path.

### Slice 01B — Group Rename and Delete

- Start at the visible row actions and carry Rename/Delete through
  `thread:action`, accepted shell guard, idempotent ledger, group lease/runtime
  fences, transaction, mirror deletion recovery, Provenance retention, fan-out,
  renderer result, and restart/readback.
- Remove superseded raw-session mutation routes and prove busy, late-frame,
  lost-acknowledgement, failed-recipient, and injected mirror failure behavior.

### Slice 01C — Activity, links, Markdown, and search

- Start at accepted prompt/list ordering, Copy Link, Resolve Link, View Markdown,
  exact-session model selection, and chat-search UI entry points and traverse
  their registered routes, owners, persistence/joins, renderer projection,
  multi-window delivery, and restart.
- Add prompt-accepted idempotent activity and deterministic MRU, remove
  `thread:touch`, prove Legacy behavior, and run the full integration report.

Every slice follows `GUIDANCE.md`: one fresh `spec-slice-builder` owns the slice,
including mechanically necessary integration, self-review, checks, and
deviations. It may spawn only fresh `clean-room-reviewer` agents, never another
builder, and repairs forward until its first clean pass. The orchestrator then
runs a separate fresh review and routes any repair back through the owning
builder before integration.

## 12. Required Verification

Add focused tests equivalent to:

- `test/thread/thread-group-migration.test.js`;
- focused view-registry identity and accepted-shell-guard integration tests;
- `test/thread/thread-group-repository.test.js`;
- `test/thread/thread-group-lifecycle.test.js`;
- `test/thread/thread-group-delete-recovery.test.js`;
- `test/ws/thread-group-protocol.integration.test.js`; and
- `e2e/thread-group-compatibility.spec.ts`.

Required proof:

- accepted Provenance migrations plus the new migration on fresh and populated
  temporary databases;
- every retained registered session has exactly one group/member/initial event;
- missing view IDs are atomically filled once; duplicate/invalid/unwritable
  capsules stop with repair diagnostics and folder rename preserves identity;
- unregistered test rows follow only the authorized bounded retirement branch;
- migration equality does not make group/session IDs interchangeable;
- new creation commits session/group/member/event/activity/recovery atomically;
- passive open and live-turn overlay remain passive and exact-session routed;
- unknown explicit IDs never create;
- prompt acceptance advances group MRU exactly once; open/warm/completion/Stop
  do not;
- Rename/Delete/Copy Link/Resolve Link/View Markdown traverse `thread:action`;
- exact-session model/variant selection remains pending until server validation,
  persists by `threadId`, fans out, and survives restart;
- same-ID replay, mismatched reuse, lost acknowledgement, second-window fan-out,
  failed-recipient isolation, and reconnect converge;
- after failed cleanup and restart, Delete with a new request ID returns the
  retained cleanup aggregate, records it durably under the new ID, and resumes
  idempotent repair; replay of that ID survives tombstone expiry;
- authenticated shell requests succeed while untrusted, forged-role,
  model-content, bridge-context, and harness-payload attempts fail before
  session creation or mutation; SPEC-00 owns proof/reconnect/origin mechanics;
- Delete busy/fence/late-frame/mirror-failure/restart behavior is deterministic;
- deleting sessions clears only allowed Provenance exchange binding and retains
  every durable Provenance fact;
- search returns group plus exact session/exchange identities; and
- stale-symbol sweeps find no Fork route/service/UI/type/config/provider flag,
  old group-mutation route, or public `thread:touch`.

Run at minimum:

```bash
cd fusion-studio-server && npm test -- --runInBand
cd fusion-studio-client && npx playwright test e2e/thread-group-compatibility.spec.ts
cd fusion-studio-client && npm run build
```

Also rerun the accepted Agent Tool Provenance deletion, exchange-binding,
prompt/runtime, and full regression commands named by its final report.

## 13. Expected Changed Areas

Expected, not exclusive:

- next-free server database migration;
- new focused `fusion-studio-server/lib/thread-groups/` modules;
- ThreadManager/ThreadIndex transaction and mirror-recovery seams;
- thread CRUD/runtime prompt-acceptance integration;
- thread WebSocket handlers/router/redaction and server/client types;
- chat search and application-link handling;
- minimal existing Sidebar/thread handlers needed for compatibility;
- OpenCode/Fork removal paths; and
- focused server/client tests.

No accepted SPEC-00, TABS-03, bridge, Provenance migration, or Provenance fact
schema is edited.

## 14. Definition Of Done

SPEC-01 is complete only when the first clean builder-owned and orchestrator-
owned reviews pass, every check above is green, deviations and downstream
effects are reported, the supervisor presents the completed result, and the
owner explicitly accepts it. Until then SPEC-02 and every downstream group
consumer remain blocked.
