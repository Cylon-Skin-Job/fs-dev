# SPEC-02 — Composable Chat Surfaces

**Status:** `DRAFT_CANDIDATE`  
**Domain owner:** renderer chat composition and chat-state projection  
**Prerequisites:** accepted SPEC-01 and independently accepted Generic Component Tab Host  
**Blocks:** SPEC-03 and every production Side Chat placement

## 1. Objective

Extract Fusion Studio's chat and thread-list presentation into explicitly
addressed renderer surfaces. A connected host can mount one Main Chat, one
Legacy Main Chat, or a future Side Chat without deriving the target from a
global current thread or current panel. Two mounted chats must remain isolated
while sharing the existing server-owned chat lifecycle.

This SPEC does not persist a per-thread content worksurface and does not place a
Side Chat in a production tab. It creates the renderer boundary those later
domains consume.

## 2. Authorities And Baseline

Read before implementation:

- bundle `BUNDLE-INDEX.md`, `DECISIONS.md`, `ISSUES.md`, and `GUIDANCE.md`;
- `../../../../AGENTS.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`;
- `../../Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`;
- the Chat System Overview, WebSocket Protocol, Chat UI, Runtime Model,
  Structure, and Testing And Operations pages;
- the accepted SPEC-01 report and exact group protocol/types;
- the final accepted Generic Component Tab Host SPEC, report, commit, tests, and
  public exports; and
- current App, Sidebar, ChatArea/useChatArea, chat state slices, thread/stream
  handlers, draft/attachment stores, full-screen controls, and Secondary Chat.

The orchestrator must verify that the Generic Host has completed all accepted
slices. The presence of `componentTab*` files or passing domain tests alone does
not satisfy this prerequisite.

## 3. Scope

### In scope

- explicit chat mount identity and presentation contracts;
- one connected chat host and one reusable `ChatSurface` boundary;
- one explicit `ThreadRail` plus `ThreadedChat` composition;
- a workspace Legacy host with `viewId: null`;
- per-thread readiness, usage, selection, live state, model/variant, drafts,
  attachments, and explicit action targets;
- per-surface DOM, focus, menu, and accessibility identity;
- per-`{workspaceId, viewId}` group populations and selected-group state;
- correct list/open request ownership when inactive views remain mounted;
- independent Chat/Threads visibility and existing full-screen behavior;
- code-owned `fusion.chat-surface` registration behind the accepted generic
  component resolver; and
- simultaneous-surface, navigation, live-stream, Stop, and build regression
  proof.

### Out of scope

- database migrations or Thread Group service/protocol changes;
- Pending New Chat or a new creation lifecycle;
- group-keyed content worksurface persistence, flush, CAS, or deletion cleanup;
- production Side Chat tabs, component placement, target matching, dedupe, or
  tab persistence;
- generic empty-tab creation/reservation/fill, launcher catalogs, or changes to
  the accepted Generic Host;
- Collections or thread menu redesign;
- plugin/dynamic component discovery, permissions, trust, or view config; and
- a transitive rewrite of every existing chat leaf into a dependency-free
  component.

## 4. Canonical Identity Contract

```ts
type ChatMountIdentity = {
  workspaceId: string;
  viewId: string | null;
  threadGroupId: string;
  threadId: string;
  surfaceId: string;
  host: 'main' | 'legacy-main' | 'side-tab';
};
```

- `{workspaceId, viewId}` selects one visible group population.
- `threadGroupId` selects one visible body of work.
- `threadId` selects one transcript/runtime and routes every live message.
- `surfaceId` selects one transient mounted UI instance.
- `host` affects presentation only. It never changes membership, prompt
  acceptance, Stop, Provenance, or transport routing.

No identity is reconstructed from panel selection, title, folder, tab, DOM ID,
or another identity's string shape. `surfaceId` is never persisted or sent as
session authority.

## 5. Component Boundaries

### 5.1 `ChatSurface`

`ChatSurface` renders one explicit session model and emits explicit actions. Its
public props are implementation-equivalent to:

```ts
type ChatSurfaceProps = ChatMountIdentity & {
  chat: ChatSurfaceModel;
  actions: ChatSurfaceActions;
  onToggleThreads: () => void;
};
```

The portable boundary imports no app store, WebSocket client, thread controller,
service, filesystem API, or tab owner. A connected host may use those existing
application owners and passes projected data/callbacks into `ChatSurface`.

Existing descendants may remain connected internally when extracting them would
create a separate voice, attachment, reply-chrome, Todo, or autocomplete
refactor. However, every descendant behavior in the mounted surface must receive
or resolve the explicit target `threadId`/`surfaceId`; none may fall back to the
global current chat or current panel.

### 5.2 Connected host

The connected host:

- validates workspace/view/group/member relationships from accepted SPEC-01
  projections;
- reads session state by `threadId`;
- reads mounted UI state by `surfaceId`;
- adapts existing send/warm/Stop/open/model/attachment/todo/header actions to
  exact targets;
- correlates asynchronous responses before state mutation; and
- passes no store, socket, controller, service, or mutable global object into
  the portable surface.

### 5.3 `ThreadRail` and `ThreadedChat`

`ThreadRail` receives one explicit population, selected group, and callbacks.
It does not request a list, inspect a panel, or mutate a store directly.

`ThreadedChat` composes one `ThreadRail` with the selected group's Main Chat.
The Legacy host composes the workspace Legacy rail and Main Chat with
`viewId:null`. A future Side Chat host mounts `ChatSurface` alone; it never
mounts a second local rail.

The shared list/menu button always invokes the connected outer host callback.
In a future Side Chat this will focus/toggle the owning view's rail.

## 6. Renderer State Ownership

### 6.1 Group populations and selection

Key group lists and selected groups by the composite workspace/view identity:

```ts
threadGroupsByWorkspaceAndView[workspaceId][viewId]
currentThreadGroupIdByWorkspaceAndView[workspaceId][viewId]
legacyThreadGroupsByWorkspaceId[workspaceId]
currentLegacyThreadGroupIdByWorkspaceId[workspaceId]
```

An implementation-equivalent collision-safe composite key is allowed. View ID
alone and panel index are forbidden. A late list/open response for one pair
cannot fill another workspace or view with the same label/ID.

Only the active connected host requests/opens its group population. Fusion may
keep inactive panels mounted, but they must not issue duplicate unqualified
`thread:list` requests or steal current selection.

### 6.2 Session state

Key transcript/history, live-turn frontier, readiness, wire state, context/token
usage, current model/variant, draft, pending attachments, warm state, turn state,
errors, Todo, and session actions by `threadId` under the owning workspace.

Existing draft and attachment stores that already use workspace/thread identity
remain authoritative. Do not create a surface copy. Model/variant selection is
the last server-acknowledged exact-session value established by SPEC-01's
`set_harness_selection`; optimistic UI remains pending and cannot become Send or
Move authority. Send snapshots that acknowledged value by `threadId` and never
reads whichever panel became current after the user acted.

The selection request contains only portable `model` and nullable `variant`.
The session's harness binding is server-owned and remains immutable through this
action.

`thread:opened`, `wire_ready`, context/usage, action responses, saved-turn
acknowledgements, and live frames validate their exact session/group request
before mutation. Existing `threadId + turnId + streamSeq` frontier rules remain
unchanged.

### 6.3 Surface state

Key DOM IDs, focus restoration, mounted menu state, local measurement, and
accessibility relationships by `surfaceId`. Two mounts of the same session are
allowed only when both present the same session-owned truth and keep transient
DOM/focus state separate; they do not create another runtime or duplicate
session store.

Shell visibility/full-screen state is not session or worksurface state. Hiding
Chat or Threads does not clear, reassign, or persist a new chat identity.

## 7. Existing Lifecycle Preservation

- Passive row selection uses `thread:open` and does not warm/spawn/kill.
- Assistant activation uses the accepted SPEC-01 route.
- Prompt acceptance remains server-owned; the user bubble commits on
  `message:sent`.
- Live output routes by `threadId` and uses the current frontier gate.
- Stop remains server-owned and persists partial interrupted output.
- Revisit hydrates SQLite history then overlays the exact session's live turn.
- The OpenCode-only harness policy and conditional picker behavior remain.
- No surface directly persists an exchange, changes Provenance, or invokes
  provider syntax.

## 8. Generic Component Registration

Register one code-owned first-party component type, `fusion.chat-surface`,
through the accepted resolver seam. Its JSON-safe input contains explicit
workspace, nullable view, group, session, and host identity, but no transient
`surfaceId`, store, socket, callback, path, React element, import, or authority
claim.

The connected resolver:

1. validates descriptor/schema version;
2. validates the workspace/view/group/member tuple against hydrated authority;
3. binds established state/actions;
4. mints a fresh `surfaceId` from the unique `componentInstanceId` plus a runtime
   mount generation; and
5. returns the ready or accepted inert-unavailable projection.

`tabId`, `componentInstanceId`, `threadGroupId`, `threadId`, and `surfaceId`
remain distinct. The registration is proven with fixture rendering but is not
placed in a production tab here.

This SPEC does not use or duplicate the Generic Host's empty-tab reservation,
launcher, retry, `targetKey`, placement, persistence, or dedupe behavior.

## 9. Architecture Rules

- Presentation renders models and emits callbacks.
- Connected hosts orchestrate existing stores and action bridges.
- Existing stores remain the single owners of session facts after their keys are
  corrected.
- WebSocket handlers validate/correlate before store mutation.
- No chat-specific case enters the generic tab rail or portable component host.
- Preserve shared CSS variables and existing visual language.
- Shared buttons retain `aria-label`, title, keyboard, and focus behavior.
- The legacy floating Secondary Chat remains temporarily present but supplies no
  foundation or identity to these new surfaces. SPEC-04 retires it after its
  replacement passes.

## 10. Dependency-Ordered Slices

### Slice 02A — Explicit Legacy Main Chat

- Start at Legacy row selection and carry open, hydrate, composer, attachment,
  model, Send, stream, usage, Stop, and focus/menu rendering through one
  connected `ChatSurface` with exact `threadId` and `surfaceId` state.
- Cut over each touched global current-thread/current-panel dependency in the
  same increment and prove passive open, live overlay, late responses, restart,
  and existing visible behavior through the public UI.

### Slice 02B — View-bound ThreadedChat

- Start at selecting groups in two registered views and traverse qualified list,
  selected-group state, `ThreadRail`, Main Chat open/actions, renderer state,
  hidden inactive panels, fan-out, navigation, and restart.
- Preserve accepted SPEC-01 row actions and prove two view populations cannot
  request, hydrate, or mutate each other.

### Slice 02C — Concurrent surfaces and component registration

- Start at two simultaneously mounted explicit chat surfaces and carry Send,
  stream, model, usage, Stop, attachments, menus, focus, Chat/Threads visibility,
  and full-screen behavior through isolated session/surface owners.
- Register `fusion.chat-surface` through the accepted Generic Host resolver and
  exercise ready, invalid, disabled, and unavailable descriptors end to end in
  its public rendered fixture without production Side Chat placement.
- Run full integration/build/Electron checks and produce the report.

Every slice follows `GUIDANCE.md`: one fresh `spec-slice-builder` owns the slice,
including mechanically necessary integration, self-review, checks, and
deviations. It may spawn only fresh `clean-room-reviewer` agents, never another
builder, and repairs forward until its first clean pass. The orchestrator then
runs a separate fresh review and routes any repair back through the owning
builder before integration.

## 11. Required Verification

Add focused tests equivalent to:

- `e2e/chat-surface-identity.spec.ts`;
- `e2e/chat-surface-isolation.spec.ts`;
- `e2e/threaded-chat-host.spec.ts`; and
- `e2e/chat-component-registration.spec.ts`.

Required scenarios:

- two groups in two views restore independent selected rows;
- two simultaneously mounted sessions interleave content, thinking, tools,
  usage, readiness, model selection, drafts, attachments, Todos, errors, and
  saved-turn acknowledgements without crossover;
- Stop targets one active session and leaves the other running;
- a late list/open/wire/context/usage/action response cannot mutate another
  workspace/view/session;
- model/variant change remains pending until the exact-session acknowledgement;
  rejection restores the prior value and restart hydrates the acknowledged one;
- two mounts of one session share session truth but not DOM/menu/focus state;
- passive open remains passive and live history overlay remains exact;
- hidden Chat/Threads and full-screen transitions preserve state;
- the known component descriptor resolves with explicit props;
- invalid/disabled/unknown descriptors remain inert under the accepted host;
- no component resolver or `ChatSurface` derives identity from global current
  panel/thread; and
- existing chat foreground, message layout, prompt ownership, working activity,
  bootstrap, hover-peek, and component-tab tests remain green.

Run at minimum:

```bash
cd fusion-studio-server && npm test -- --runInBand
cd fusion-studio-client && npx playwright test e2e/chat-surface-identity.spec.ts e2e/chat-surface-isolation.spec.ts e2e/threaded-chat-host.spec.ts e2e/chat-component-registration.spec.ts
cd fusion-studio-client && npm run build
```

Perform an Electron smoke that opens two view-bound groups, sends/Stops in each,
toggles Chat and Threads independently, enters/exits full-screen, and verifies
focus/menu accessibility.

## 12. Expected Changed Areas

Expected, not exclusive:

- `fusion-studio-client/src/components/ChatArea.tsx` and focused chat modules;
- new focused `ChatSurface`, connected host, `ThreadRail`, and `ThreadedChat`
  modules;
- App/Sidebar composition and full-screen integration;
- chat/thread Zustand slices and workspace/view selection state;
- thread/stream WebSocket handlers and shared types;
- first-party component resolver registration adapter; and
- focused client tests/fixtures.

No server migration, Thread Group schema, Generic Host implementation, view-state
worksurface persistence, or production Side Chat descriptor is changed.

## 13. Definition Of Done

SPEC-02 is complete only after all slices, targeted/full checks, Electron smoke,
first clean builder-owned and orchestrator-owned reviews, deviation accounting,
supervisor review, and explicit owner acceptance. SPEC-03 remains blocked until
then.
