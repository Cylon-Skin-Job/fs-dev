# Generic Component Tab Host and Empty-Tab Lifecycle — SPEC

**Date:** 2026-09-03
**Status:** Implementation-ready; owner scope fixed by Vision Roadmap D-166 and D-167.
**Owner:** Fusion Studio renderer shell and shared view-tab infrastructure.
**Source:** `../022-Vision_Roadmap/` decisions D-126, D-133, D-166, and D-167; proposal P-014; capture CAP-183.
**Depends on:** The accepted Universal View Tab Bar implementation at commit `9f89aea` and its report at `../020-CSS_UI_Changes/WORKSPACE-CHROME-INTERACTION-CONTRACT-ORCHESTRATOR-REPORT.md`.
**Enforces:** `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/`, especially Architecture Routing, Frontend UI, State Management, Persistence and Metadata, and Testing and Smoke Slices.
**Blocks:** Composable Chat registration as tab content and every Side Chat placement flow.

---

## 0. Clean-Session Implementation Brief

Build one generic renderer capability on top of the accepted shell-owned tab
rail: an active tab may contain a component selected by a stable, serializable
reference, and a newly created generic tab begins as an empty container that can
be filled exactly once.

This SPEC does not give any existing view new behavior. Capture and File Viewer
continue to supply their current content as the `ViewTabBar` child. The new host
is an optional adapter path until a later SPEC registers Composable Chat as its
first product consumer.

The implementation has three boundaries:

```text
existing connected view-tab adapter
  owns tab collection and mutations
       |
       v
serializable component-tab descriptor
  contains IDs and JSON input only
       |
       v
portable component-tab panel
  renders empty / resolved / unavailable projection
```

The shared tab rail remains presentation-only and kind-agnostic. The portable
panel receives explicit state and callbacks. A connected resolver maps an
allowlisted first-party `componentTypeId` to a renderable component with
explicit props. No production folder scan, plugin registry, dynamic import,
view configuration, chat extraction, server route, or persistence migration is
part of this work.

---

## 1. Problem and Bounded Outcome

The accepted Universal View Tab Bar owns tab chrome, ARIA tab semantics, focus
recovery, and connected Capture/File adapters. Its `ViewTabBar` still renders
one opaque `children` value for the active view. That is sufficient for today's
view-owned tabs but cannot yet host a reusable component selected per tab.

Side Chat must eventually mount the same composable chat surface inside a
content tab. Building that directly in the threads domain would make chat own
generic container creation, component resolution, and empty-tab races. Later
views and plugins would then need to undo a thread-specific container system.

This SPEC establishes only the missing generic boundary:

1. a JSON-safe descriptor can identify component-backed tab content;
2. an optional connected adapter can give that descriptor to the shell host;
3. the shell renders it inside the existing active `tabpanel`;
4. a generic `+` action can create a distinct empty container;
5. a launcher can reserve and fill that same container without replacing a
   populated tab or accepting a stale asynchronous completion; and
6. an unavailable component remains visible, inert, closable, and recoverable.

It deliberately stops before any product view adopts the new path.

---

## 2. Authoritative Behavior Contract

| # | Rule |
|---|---|
| B1 | `ViewTabStrip` remains unaware of empty, component, chat, file, Home, Content, plugin, or presenter kinds. It renders descriptors and emits callbacks only. |
| B2 | `ViewTabBar` continues to render exactly one active `role="tabpanel"`. The new content host renders inside it and does not add another tablist or tabpanel. |
| B3 | A component-backed tab stores a stable `componentTypeId`, opaque `componentInstanceId`, tab ID, schema version, and bounded JSON input. It never stores a React element, component function, callback, import path, store reference, DOM node, or network client. |
| B4 | The portable component-tab panel imports no Zustand store, controller, service, WebSocket client, filesystem API, plugin API, or app-global state. All render state, resolution, and actions enter through props. |
| B5 | A connected adapter remains the one owner of its tab collection. This SPEC adds no global tab store and does not mirror an existing view's tab state into another owner. |
| B6 | Every generic `+` invocation creates and activates a new empty tab with a fresh opaque tab ID. Multiple empty tabs are allowed. File Viewer's existing create-or-focus empty tab remains a view-specific legacy rule and is not changed or generalized here. |
| B7 | Empty is container state, not a fake component type. Empty presentation is supplied with explicit launcher descriptors and callbacks by the connected adapter. |
| B8 | Selecting a launcher reserves the exact empty tab. A successful selection fills that same tab in place, preserving tab ID, order, active state, rail label focus relationship, and close behavior. |
| B9 | The empty-fill route never overwrites a component-backed tab. Replacement, navigation, deduplication, and Open in Current/New Tab are later placement contracts. |
| B10 | Every reservation carries a unique operation ID and the tab's expected content revision. A completion is accepted only while that tab still exists, is empty, has the same revision, and owns that operation. Closing, filling, cancelling, or re-reserving the tab makes an older completion stale. |
| B11 | A stale completion performs no tab or reservation mutation. A current failed completion leaves the tab empty and changes only its matching reservation from `pending` to `failed`, preserving launcher identity and a bounded retryable error. Success or explicit cancellation clears the reservation. |
| B12 | If resolution reports an unknown, invalid, disabled, or unavailable component, the descriptor remains component-backed and is not reclassified as empty or deleted. The host renders an inert unavailable state; it performs no dynamic import or component code execution. |
| B13 | A later resolver update may make an unavailable descriptor render normally without changing tab identity or stored content. |
| B14 | The initial resolver boundary accepts code-owned, first-party registrations only. Provenance later supplies validated dynamic registrations behind the same narrow interface; this SPEC does not define trust, installation, permissions, dependencies, or configuration discovery. |
| B15 | No current Capture or File Viewer tab/state shape is migrated. When an adapter supplies no component-container model, `ViewTabBar` renders its existing child exactly as it does at commit `9f89aea`. |
| B16 | This SPEC creates no server message, SQLite table, view-state key, view-folder file, plugin folder, or durable writer. The descriptor is serializable for later owners, but serialization capability does not assign persistence ownership. |
| B17 | `tabId`, `componentInstanceId`, and a future chat `surfaceId` are distinct concepts. A later chat adapter may deliberately use the component instance as the mounted-surface seed, but the generic host never treats a tab ID as a chat/session/thread identity. |
| B18 | User-visible labels, icons, launcher order, and disabled state are explicit adapter input. The generic host does not infer them from component type, filename, active view, or folder configuration. |

---

## 3. Canonical Data and Render Boundaries

Exact type names may vary, but the implementation must preserve this semantic
shape.

### 3.1 JSON-safe descriptor

```ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type EmptyTabContent = {
  kind: 'empty';
  revision: number;
};

type ComponentTabContent = {
  kind: 'component';
  revision: number;
  component: {
    schemaVersion: 1;
    componentTypeId: string;
    componentInstanceId: string;
    input: { [key: string]: JsonValue };
    targetKey?: string;
  };
};

type TabContentDescriptor = EmptyTabContent | ComponentTabContent;

type TabContentRecord = {
  tabId: string;
  content: TabContentDescriptor;
};
```

`revision` is adapter-owned optimistic concurrency for this in-memory tab
record. It increments whenever content changes. It is not a server revision,
view-state revision, timestamp, or persistence promise.

`targetKey` is optional schema headroom for the later placement/deduplication
SPEC. This implementation preserves and validates it but does not search,
deduplicate, activate, replace, or recenter targets.

The descriptor's `input` contains declarative, JSON-safe input only. A connected
registration may bind that input to runtime callbacks, store projections, or
controller actions, but none of those live in the descriptor.

### 3.2 Transient reservation

```ts
type EmptyTabReservation = {
  tabId: string;
  operationId: string;
  expectedRevision: number;
  launcherId: string;
  status: 'pending' | 'failed';
  error?: { code: string; message: string };
};
```

Reservations are renderer-runtime state owned alongside the adapter's tab
collection. They are not component descriptors and are not serialized by the
generic contract. One tab has at most one current reservation. Re-reserving an
empty tab invalidates the older operation before starting the new one.

### 3.3 Launcher projection

```ts
type EmptyTabLauncherItem = {
  id: string;
  label: string;
  icon: string;
  description?: string;
  disabled?: boolean;
};

type EmptyTabPanelProps = {
  tabId: string;
  items: EmptyTabLauncherItem[];
  reservation: EmptyTabReservation | null;
  onSelect: (tabId: string, launcherId: string) => void;
  onRetry: (tabId: string) => void;
  onCancel: (tabId: string) => void;
};
```

This SPEC supplies a portable shell-owned empty presentation adequate for a
centered list or grid of launcher buttons. It does not read a view config or
ship any production launcher list. Empty-state copy must be neutral; it must
not say File, Capture, Chat, or Plugin unless the adapter supplies that label.

### 3.4 Connected resolution

```ts
type ComponentResolution =
  | {
      status: 'ready';
      key: string;
      render: () => React.ReactNode;
    }
  | {
      status: 'unavailable';
      code: 'unknown' | 'invalid' | 'disabled' | 'version_unsupported';
      label: string;
    };

type ResolveTabComponent = (
  descriptor: ComponentTabContent['component'],
) => ComponentResolution;
```

The connected adapter or first-party registration boundary performs
resolution. It must validate the descriptor before invoking registered code and
must pass explicit props/callbacks into the resolved component. The portable
panel consumes only the returned projection. The generic host must not use an
arbitrary import path, `eval`, filesystem lookup, or convention-based module
name.

`render` is transient injected behavior, not serialized tab state. An
implementation may instead return a component plus explicit props if that is
cleaner; it must preserve the same dependency direction.

### 3.5 Optional adapter seam

The existing `ViewTabAdapterModel` gains one optional concept, named to fit the
implementation:

```ts
type ViewTabContentAdapter = {
  active: TabContentRecord;
  launchers: EmptyTabLauncherItem[];
  reservation: EmptyTabReservation | null;
  resolve: ResolveTabComponent;
  selectLauncher: (tabId: string, launcherId: string) => void;
  retryLauncher: (tabId: string) => void;
  cancelLauncher: (tabId: string) => void;
};

type ViewTabAdapterModel = ExistingViewTabAdapterModel & {
  content?: ViewTabContentAdapter;
};
```

When `content` is absent, `ViewTabBar` renders `children`. When present,
`content.active.tabId` must equal the adapter's `activeId`; the host renders the
empty, resolved, or unavailable projection instead of `children`. Supplying a
mismatched active record is a programmer error caught by development/test
assertion and rendered as an inert unavailable state in production. The host
never renders the mismatched component beneath the selected tab's label or ARIA
relationship.

Do not add an adapter registration, component registration, or launcher list
for Capture, File Viewer, or Chat in this SPEC.

---

## 4. Empty-to-Filled State Machine

The adapter/controller owns these pure transitions. Names may vary; semantics
may not.

### 4.1 Create

`createEmptyTab()`:

1. mints a new opaque `tabId`;
2. appends `{ kind: 'empty', revision: 0 }` to the owning collection;
3. supplies an ordinary rail descriptor for that ID;
4. activates it; and
5. returns the ID synchronously so the accepted `ViewTabStrip` focus recovery
   can focus the new tab.

The generic operation never searches for another empty tab. Legacy File Viewer
create-or-focus behavior remains inside its existing adapter and store.

### 4.2 Reserve

`reserveEmptyTab(tabId, launcherId)` atomically checks that the record exists
and is empty, mints an `operationId`, records the current revision, and returns
the reservation. No external work begins until reservation succeeds.

If the tab is missing or filled, the function returns a typed rejection and
does not mutate another tab or create a replacement.

### 4.3 Commit fill

`commitEmptyTabFill(operationId, componentDescriptor)` succeeds only when all
of the following still match:

- reservation operation ID;
- exact tab ID;
- expected content revision;
- current content kind `empty`; and
- current reservation ownership.

Success replaces only the content of that tab with `kind: 'component'`, assigns
the caller-supplied fresh component instance ID, increments revision, clears
the reservation, and retains the tab's collection position and active status.
It does not close or reorder any other tab.

### 4.4 Failure, cancellation, close, and late completion

- A matching failure changes its reservation from `pending` to `failed`,
  records a bounded safe error there, and keeps the tab empty. It preserves the
  launcher ID needed for deterministic retry.
- Retry reads the launcher ID from that failed reservation and creates a new
  `pending` reservation with a new operation ID. The failed ID can never commit
  afterward.
- Matching cancellation clears the reservation and keeps the tab empty.
- Closing the tab deletes its reservation before or atomically with the tab.
- A late completion for a closed, cancelled, retried, or already filled tab is
  rejected as stale and creates no replacement tab.
- Errors contain product-safe codes/copy only; arbitrary provider, filesystem,
  or plugin diagnostics are not rendered or logged through this component.

### 4.5 Focus

Creation uses the existing rail's returned-ID focus behavior. Filling retains
the same active tab and its `aria-controls` relationship. If focus was inside
the empty panel when it is replaced, the resolved component receives an
explicit initial-focus request or the panel root receives focus; focus must not
fall to `document.body`. The generic host does not steal focus when the tab was
filled in the background.

---

## 5. Unavailable and Invalid Content

Resolution is fail-closed.

An unavailable projection:

- shows the adapter/resolver-supplied safe label and a generic explanation;
- remains inside the active shell tabpanel;
- preserves the descriptor and tab identity;
- keeps the ordinary tab close control available;
- exposes no retry that installs, enables, grants, or imports code; and
- may render normally on a later state update if the connected resolver then
  returns `ready`.

Descriptor validation rejects unsupported schema versions, empty or oversized
IDs, non-JSON values, prototype-polluting keys, excessive nesting/size, and
unknown fields unless a future version explicitly permits them. Validation
must not echo the full invalid input into UI, telemetry, or errors.

Malformed content never falls back to `children`, because doing so could display
unrelated view content under the wrong tab label. Legacy children are used only
when the adapter omits the new content contract entirely.

---

## 6. Code-Standards Compliance and Ownership

### 6.1 Existing owner

The existing owner is `fusion-studio-client/src/components/view-tabs/`:

- `ViewTabBar.tsx` is the shell host;
- `ViewTabStrip.tsx` owns portable rail presentation and keyboard behavior;
- `viewTabAdapters.ts` is the store-owning connected boundary; and
- existing Capture/File controllers and stores own their domain mutations.

No backend dispatcher fits because this SPEC adds no backend action or durable
mutation. No new WebSocket route, service, event, or store is justified.

### 6.2 New files, one job each

Exact filenames may follow repository conventions, but responsibilities remain
split:

| Module | One job |
|---|---|
| component-tab domain/types | Validate JSON-safe descriptors and perform pure empty/reservation/fill transitions. |
| component-tab panel | Render one explicit empty, resolved, or unavailable projection from props. |
| empty-tab presentation | Render explicit launcher items and pending/failed state accessibly. |
| first-party resolver seam | Resolve an allowlisted component type to transient render input without scanning folders. |
| focused tests | Exercise the public adapter/panel boundary and pure race transitions. |

Do not grow `ViewTabBar.tsx` or `viewTabAdapters.ts` into a combined state
machine, resolver, launcher, and renderer. No new production module should need
to exceed 400 lines or require unrelated imports.

### 6.3 Portable presentation

All new CSS classes use the `rv-component-tab-*` or `rv-empty-tab-*` prefix.
Every visual value derives from an existing workspace/content token with a
fallback. Do not add hardcoded colors, spacing, z-index, or inline styles.

The portable panel and empty presentation import components/types/styles only.
They do not import state or action owners. Connected code passes explicit IDs,
models, resolver projection, and callbacks.

### 6.4 One state owner

The adapter that opts into component tabs owns records and reservations through
its established store/controller. The generic domain exposes pure transition
helpers; it does not create an independent Zustand store. Existing view data is
not copied into this schema. A later worksurface owner may serialize descriptors
through the existing view-state service, but that is explicitly outside this
SPEC.

---

## 7. Dependency-Ordered Implementation Slices

These are renderer infrastructure slices. Their public boundary is the exported
connected-adapter-to-shell contract and the DOM users will exercise through
later consumers; no backend route exists to test in this SPEC.

### Slice 1 — Descriptor and lifecycle domain

- Add bounded JSON-safe descriptor validation.
- Add pure create, reserve, commit, fail, cancel, and close invalidation
  transitions.
- Prove multiple new empties have unique IDs and independent reservations.
- Prove a populated tab cannot be filled through the empty route.
- Prove every stale asynchronous completion is a non-mutating rejection.
- Run focused unit tests before integrating rendering.

### Slice 2 — Portable panel and empty presentation

- Add the portable active-content panel and neutral launcher presentation.
- Add the inert unavailable projection.
- Prove ready components receive explicit descriptor input and injected actions.
- Prove keyboard activation, pending/disabled state, error announcement, and
  focus continuity in rendered component tests.
- Prove the portable modules have no state, network, service, filesystem, or
  plugin imports.

### Slice 3 — Optional shell seam and legacy regression

- Add the optional content contract to the connected adapter model.
- Render it inside the one existing `ViewTabBar` tabpanel when present.
- Preserve the existing `children` path when absent.
- Exercise the complete generic route with a test adapter: press `+`, focus the
  new empty tab, choose a synchronous and an asynchronous launcher, fill the
  same tab, render the resolved fixture component, and close it.
- Race close/retry/fill through the rendered route and prove stale results do
  not mutate the tab collection.
- Run the existing Capture/File tab tests unchanged and build the client.
- Perform a stale-symbol/import sweep proving no view, chat, plugin, server, or
  persistence module adopted the new contract in this SPEC.

---

## 8. Verification Matrix

| Risk | Required proof |
|---|---|
| Existing tab rail regression | Existing Capture and File Viewer focused suites pass without expectation changes; rail keyboard/close/add behavior remains owned by `ViewTabStrip`. |
| Legacy content regression | With no `content` adapter, `ViewTabBar` renders the exact supplied child and one tabpanel as before. |
| Generic creation | Two successive generic adds create two unique empty tabs, append in order, activate/focus the newest, and do not invoke File Viewer's create-or-focus rule. |
| Fill in place | Launcher completion changes only the reserved tab's content; tab ID, order, active state, ARIA relationship, and close behavior remain stable. |
| Filled protection | Reserve/fill against a component-backed tab is rejected without replacement or new-tab fallback. |
| Async race | Close, cancel, retry, re-reserve, and prior fill each invalidate an older operation; late completions are non-mutating. |
| Failure recovery | A current failed operation leaves a retryable empty tab and a `failed` reservation that retains launcher identity and bounded error; retry replaces it with a new operation ID and can succeed. |
| Resolution boundary | Known first-party fixture resolves with explicit props; unknown/invalid/disabled/version-unsupported references render inert and execute no component. |
| Serialization | Valid descriptors round-trip through JSON. Functions, React nodes, symbols, cyclic objects, unsafe keys, excessive depth/size, and unsupported versions fail closed. |
| Dependency direction | Portable panel/empty modules import no store, controller, service, WebSocket, filesystem, or plugin code. |
| Scope | `git diff` contains no view capsule/config, Chat, server, SQLite, plugin, Provenance, Capture, or File Viewer behavior change beyond the optional shared adapter seam and tests. |
| Build | `npm run build` passes in `fusion-studio-client/`; warnings are classified as new or pre-existing. |

The implementation handoff records changed files, exact commands, results,
warnings, and residual risk for every slice.

---

## 9. Definition of Done

This SPEC is complete only when:

1. the accepted universal rail can optionally render component-backed content
   inside its existing active tabpanel;
2. the component descriptor and input are JSON-safe and contain no executable
   or app-global references;
3. the portable panel and empty presentation depend only on explicit props;
4. connected code resolves only code-owned first-party registrations;
5. each generic add produces a distinct active empty container;
6. reservation and revision correlation make empty-to-filled transition atomic
   and stale-safe;
7. a filled tab cannot be overwritten through that transition;
8. unavailable content is inert, preserved, closable, and recoverable;
9. legacy `children` behavior and current Capture/File tests remain unchanged;
10. no new state owner, persistence writer, server route, view configuration,
    plugin behavior, chat extraction, or Side Chat behavior exists; and
11. focused tests and the client build pass with a documented implementation
    handoff.

---

## 10. Explicitly Out of Scope

- extracting `ChatArea` into `ChatSurface` or changing any chat behavior;
- registering Chat, Capture, File Viewer, Wiki, Tickets, Home, Browser,
  Terminal, or any other product component with this host;
- creating, moving, resuming, naming, or persisting a Side Chat;
- thread groups, thread creation, collections, worksurfaces, or chat routing;
- Open in Current Tab, Open in New Tab, duplicate matching, target recentering,
  content replacement, preview expansion, or sidebar-to-tab placement;
- Home/Content/Empty view configuration and per-view launcher lists;
- moving or converting view capsules;
- plugin discovery, installation, dependency resolution, activation,
  permissions, trust, Browse, sideloading, or Provenance;
- scanning folders or resolving arbitrary module/import paths;
- persisting component tabs to view state, SQLite, or another durable store;
- changing File Viewer's existing single create-or-focus empty-tab behavior;
- automatic thread naming, Send to Chat, Routines, Agents, or Plugins UI; and
- drag/drop or transportable views.

---

## 11. Downstream Contracts

The next chat-extraction SPEC may register a first-party composable chat surface
without changing this host. It must provide explicit workspace, view,
thread-group, session/thread, and surface identities through its connected
adapter; the generic descriptor does not infer them.

The later Move Chat to Side Chat SPEC may ask the owning worksurface controller
to insert a component descriptor directly into a new or existing container. It
must not implement a second empty/fill state machine or teach the rail about
chat.

The later tab-placement SPEC owns stable target matching and the exact
`existing match -> current empty -> new tab` disposition. It composes with, but
does not alter, the filled-tab protection in this SPEC.

After Provenance lands, an authorized registration service may implement the
same resolver interface for installed components. It must not weaken the
descriptor validator or make the portable host responsible for trust and
permission decisions.

No downstream document may claim this SPEC provides durable component tabs,
view configurability, or plugin execution.

---

## 12. No Open Decisions

The owner fixed the product scope and accepted the P-014 implementation shape
by directing this SPEC. Builders may choose ordinary TypeScript names and file
boundaries that preserve the contracts above. Any discovery that requires a
new state owner, persistence route, production consumer, view/config change, or
dynamic registration must stop and return to the owner rather than widening
this implementation.
