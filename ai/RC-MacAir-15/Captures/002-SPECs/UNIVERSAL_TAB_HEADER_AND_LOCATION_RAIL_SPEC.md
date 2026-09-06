# Universal Tab Header and Location Rail — Corrective SPEC

**Package ID:** TABS-02A  
**Date:** 2026-09-04  
**Status:** `OWNER-APPROVED — READY FOR ORCHESTRATOR`  
**Owner:** Fusion Studio renderer shell and shared view-tab infrastructure.  
**Source:** RC's 2026-09-04 refinement that every one-tab worksurface uses the
same centered identity, every active tab uses a breadcrumb-style location rail,
and Home is presenter behavior rather than a shell layout kind.  
**Depends on:** Owner-accepted TABS-01 Generic Component Tab Host and TABS-02
Tab Shell Presentation Foundation, as recorded in their orchestrator reports.
The owner-authorized snapshot dispatch and its exact reproducible dependency
fingerprint are recorded below because no commit yet contains both accepted
working-tree implementations.  
**Supersedes downstream use of:** TABS-02's `Home | Content` shell-role and
`centered-home | tabbed-home | tabbed-content` layout contract. TABS-02 remains
the accepted historical implementation baseline; this corrective package does
not rewrite its report or acceptance record.  
**Blocks:** TABS-03 Tab Target Placement and any production view adoption of the
generic component-tab shell.  
**Enforces:** `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/`, especially
Code Standards, Architecture Routing, Frontend UI, State Management,
Persistence and Metadata, and Testing and Smoke Slices.

---

## Dispatch Baseline and Fingerprint

RC authorized handing this SPEC to another session after the clean-room loop
reached `CLEAN` on its fifth completed pass. Because TABS-01 and TABS-02 are
owner-accepted but still uncommitted in this checkout, the receiving
orchestrator must run this exact dependency check **once at preflight, before
editing product or test files**:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
files=(
  'fusion-studio-client/src/components/view-tabs/componentTabPresentationDomain.ts'
  'fusion-studio-client/src/components/view-tabs/componentTabPresentationValidation.ts'
  'fusion-studio-client/src/components/view-tabs/CenteredHomeIdentity.tsx'
  'fusion-studio-client/src/components/view-tabs/ContentLocationRail.tsx'
  'fusion-studio-client/src/components/view-tabs/ComponentTabShellPanel.tsx'
  'fusion-studio-client/src/components/view-tabs/componentTabShell.css'
  'fusion-studio-client/src/components/view-tabs/componentTabDomain.ts'
  'fusion-studio-client/src/components/view-tabs/viewTabDomIds.ts'
  'fusion-studio-client/src/components/view-tabs/ViewTabBar.css'
  'fusion-studio-client/src/components/view-tabs/viewTabContentAdapter.ts'
  'fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx'
  'fusion-studio-client/src/components/view-tabs/ViewTabStrip.tsx'
  'fusion-studio-client/e2e/component-tab-presentation-domain.spec.ts'
  'fusion-studio-client/e2e/component-tab-shell-panel.spec.ts'
  'fusion-studio-client/e2e/component-tab-host.spec.ts'
  'fusion-studio-client/e2e/view-tab-contract.spec.ts'
)
for file in "${files[@]}"; do
  shasum -a 256 "$file"
done | shasum -a 256
```

Expected preflight output:

```text
605fa50b7300b5c06f8b16a782d608d6af17331aa59aa6e9f552007c742b9721  -
```

This is the corrected owner-accepted TABS-02 whole-package fingerprint already
documented in `TAB_SHELL_PRESENTATION_FOUNDATION_ORCHESTRATOR_REPORT.md`. It was
reproduced again immediately before this dispatch handoff. The ordered file
list and command above are normative; no hidden temporary snapshot, different
path spelling, alternate ordering, or undocumented aggregate is an acceptance
gate.

This digest is a **pre-edit dependency check**, not an expected post-build
digest. It will naturally stop matching after this SPEC changes those files.
The orchestrator records the successful preflight result in its report and
then relies on this SPEC's required behavioral, static, build, and diff gates
for implementation acceptance. If preflight does not match, do not label the
checkout or implementation failed from the hash alone: inventory the listed
files against the accepted report and stop only for an unexplained material
dependency change. Any optional post-implementation fingerprint must record
its exact ordered paths, exact command, and resulting digest in the report; it
cannot become an undocumented substitute for the required verification matrix.

---

## 0. Clean-Session Implementation Brief

Replace the accepted role-specific tab presentation with one universal header
model:

```text
one tab                              two or more tabs
-------                              ----------------
centered short label + view icon     ordinary tab rail
location/navigation rail             location/navigation rail for active tab
presenter body or Empty picker        presenter body or Empty picker
```

Every tab supplies a human-readable location. Empty, app landing surfaces,
files, Wiki pages, Capture documents, browsers, and later Side Chats all use the
same shell structure. A landing surface may contain previews or internal
navigation, but `Home` is no longer a shell role or layout branch.

Examples:

```text
CAPTURE                              CAPTURE
Capture Documents and Artifacts     Capture > Collection > Name
```

The first row continues to take its icon and short label from the existing
`ViewTabDescriptor`. The second row receives a bounded presenter/adapter-owned
breadcrumb projection. The breadcrumb is display data only: stable matching
continues to use explicit `presenterId + targetKey`, never labels, paths,
extensions, or breadcrumb text.

This package changes no production view. A test-owned connected adapter proves
the public route. It adds no view-config reader, target-placement action,
filesystem behavior, persistence owner, server route, event, plugin registry,
Chat surface, or Side Chat.

---

## 1. Problem and Bounded Outcome

TABS-02 correctly established shell-owned presentation, centered identity,
Content location chrome, and non-remounting transitions. Its role split is now
unnecessarily specific:

- only a sole `Home` component receives centered identity;
- `Content` is always tabbed, even when it is the only tab;
- only `Content` receives the location rail; and
- Empty has no human-readable location of its own.

The revised product model has fewer special cases. Tab count determines the
first row. Every active tab determines the second row. The body remains either
the accepted Empty picker or the accepted resolved component.

This SPEC therefore delivers exactly four things:

1. every one-tab collection uses the same centered identity treatment;
2. every active tab provides one breadcrumb-style location projection;
3. optional back/forward actions appear before that breadcrumb through a strict
   connected adapter seam; and
4. the accepted component and Empty lifecycles continue beneath those two
   universal rows without identity churn or production adoption.

---

## 2. Authoritative Behavior Contract

| # | Rule |
|---|---|
| B1 | Tab lifecycle remains exactly `empty | component`. This SPEC does not add Home, Content, landing, browser, file, or chat kinds to `TabContentDescriptor`. |
| B2 | One valid tab always derives the universal single-tab layout, whether its body is Empty, a landing presenter, addressed content, unavailable content, or another allowed component. |
| B3 | Two or more valid tabs always derive the universal tabbed layout. The active tab alone supplies the location rail and body. |
| B4 | In single-tab layout, the first row displays the active `ViewTabDescriptor` icon and short label centered with the same icon and typography tokens used in the ordinary tab rail. No second icon or short-label source is introduced. |
| B5 | In tabbed layout, the first row remains the accepted `ViewTabStrip`, including its tab semantics, add control, close behavior, keyboard navigation, and focus recovery. |
| B6 | The second row is always present for a valid opted-in tab, including Empty and landing surfaces. It displays one non-empty ordered breadcrumb projection for the active tab. |
| B7 | A landing presenter uses an explicit human-readable location such as `Capture Documents and Artifacts`. It does not require a Home role, Home shell mode, fake path, or special body wrapper. |
| B8 | Addressed content uses presenter-owned breadcrumb segments such as `Capture > Collection > Name`. The shell renders separators; callers do not concatenate styled markup or HTML. |
| B9 | Empty uses an explicit neutral or view-specific location such as `New Tab`. Empty is still lifecycle state and still renders the accepted picker; the location does not turn it into a component or resource. |
| B10 | Breadcrumb labels are display projections only. They are never used as `presenterId`, `targetKey`, component identity, tab identity, filesystem authority, permission, or deduplication input. |
| B11 | `presenterId` remains explicit for component-backed tabs. Empty has no presenter and represents that absence explicitly. The shell never infers a presenter from the icon, short label, breadcrumb, filename, extension, or component type. |
| B12 | A component target's complete `targetKey` remains separate from any displayed breadcrumb. Removing `PAGE.md` or shortening another terminal name changes display only and cannot merge distinct targets. |
| B13 | Wiki-style omission is supported by supplying already-filtered breadcrumb segments. The generic shell does not hardcode `PAGE.md`, inspect a path, or read a view flag. A later view-config/adopter SPEC owns the flag and projection policy. |
| B14 | Optional back and forward buttons appear immediately before the breadcrumb. Their availability and actions come from one active-tab-correlated connected navigation adapter. |
| B15 | When navigation support is supplied, both controls remain present so the rail does not shift; each is disabled from its explicit `canGoBack` or `canGoForward` projection. When support is absent, neither control appears. |
| B16 | The shell emits a navigation intent once through the supplied callback. It does not own history, calculate destinations, mutate component input, inspect a resource, or publish a UEB command. |
| B17 | If presenter navigation changes the represented target, the connected owner must update the component's canonical `targetKey` and breadcrumb projection together. TABS-03 will match only the canonical committed target, not stale display data. |
| B18 | The identity and location rows use shell background through their full height in both single and tabbed layout. Presenter body background begins below the location row. No landing presenter paints behind shell chrome. |
| B19 | The location row has a 54px default minimum height—150% of the accepted 36px identity/tab rail—and exposes tokenized overrides with fallbacks. It vertically centers one breadcrumb line and optional navigation controls. |
| B20 | The breadcrumb keeps its final segment visible as space narrows, truncates earlier context deterministically, and exposes the complete ordered label to assistive technology and pointer users without changing layout. |
| B21 | A single-tab add action uses the same accepted adapter `add` action and far-left shell slot established by TABS-02. Invoking it once invokes the callback once. A successful second-tab result reveals the ordinary rail without duplicating the add control. |
| B22 | A closable single tab preserves the accepted centered close action, accessible label, disabled state, owner callback, and focus recovery. No close action is synthesized for a non-closable descriptor. |
| B23 | Moving between one and multiple tabs preserves `tabId`, component content, content revision, `componentInstanceId`, component input, `presenterId`, `targetKey`, location projection, and collection order. While a presenter remains active, layout alone cannot replace or remount its body or reset its runtime state. Activating another tab retains the accepted active-only mounting policy and may unmount the prior presenter. |
| B24 | Changing the active tab changes identity selection, location projection, navigation availability, and body as one connected render. The shell must not display a prior tab's breadcrumb or invoke a prior tab's navigation actions. |
| B25 | Loading, unavailable, disabled, invalid-component, and presenter-error bodies retain the valid tab identity and intended location projection. Diagnostics remain generic and must not expose hidden paths, provider data, stacks, or arbitrary supplied text. |
| B26 | A malformed, unbounded, accessor-backed, symbol-bearing, version-mismatched, or wrong-tab shell/navigation projection fails closed. It never falls back to legacy children and never invokes supplied callbacks. |
| B27 | The portable identity, location, and component panels import no store, controller, service, WebSocket client, filesystem API, plugin API, UEB publisher, or app-global state. They consume validated props and emit callbacks only. |
| B28 | The connected view adapter remains the sole runtime state owner. This SPEC creates no global tab, breadcrumb, navigation-history, or presentation store and mirrors no existing state. |
| B29 | Current Capture and File Viewer adapters remain unchanged and do not opt into the corrective shell contract. The existing production behavior remains regression-protected. |
| B30 | This SPEC adds no durable schema, view-state key, config file, server route, WebSocket message, SQLite migration, UEB fact, resource mutation, plugin registration, Chat behavior, or production view behavior. |

---

## 3. Canonical Presentation Boundary

Exact implementation names may follow repository conventions, but the accepted
public semantics must be equivalent to this versioned shape.

### 3.1 Serializable shell projection

```ts
type TabBreadcrumbSegment = {
  label: string;
};

type TabLocationProjection = {
  schemaVersion: 1;
  segments: readonly [TabBreadcrumbSegment, ...TabBreadcrumbSegment[]];
};

type ComponentTabShellProjection = {
  schemaVersion: 2;
  tabId: string;
  presenterId: string | null;
  location: TabLocationProjection;
};
```

Rules:

- `schemaVersion: 2` deliberately distinguishes this contract from accepted
  TABS-02's role-bearing version 1 projection.
- `presenterId` is a bounded opaque ID for component content and exactly `null`
  for Empty content.
- `segments` contains at least one and at most the shared bounded container
  limit. Each segment is plain data with one bounded, non-empty, well-formed
  Unicode label and no control characters.
- Unknown keys, sparse arrays, accessors, symbol properties, unsafe object
  prototypes, excessive depth/size, and unsupported versions fail closed.
- Validation returns canonical cloned data. It never returns caller-owned
  arrays or objects.
- Location segments deliberately contain no `targetKey`, path authority,
  callbacks, React nodes, icons, URLs, commands, or arbitrary attributes.

The examples are projections, not fixed product strings:

```ts
// Empty
{ segments: [{ label: 'New Tab' }] }

// Capture landing surface
{ segments: [{ label: 'Capture Documents and Artifacts' }] }

// Open Capture document
{
  segments: [
    { label: 'Capture' },
    { label: 'Collection' },
    { label: 'Name' },
  ],
}

// Wiki adapter has already applied its future omit-index-document policy.
{ segments: [{ label: 'Wiki' }, { label: 'Chat System' }] }
```

### 3.2 Connected navigation adapter

Navigation behavior cannot be serialized into the shell projection. The
connected content adapter may therefore supply one presence-sensitive runtime
capability:

```ts
type ViewTabNavigationAdapter = {
  tabId: string;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
};

type ViewTabContentAdapter = ExistingViewTabContentAdapter & {
  shell: ComponentTabShellProjection;
  navigation?: ViewTabNavigationAdapter;
};
```

If `navigation` is present, `navigation.tabId`, `shell.tabId`, `active.tabId`,
and the connected adapter's `activeId` must all match. Both callbacks and both
booleans are required. Partial navigation capability is invalid.

The strict adapter normalizer treats an absent `navigation` property as no
navigation support and a present malformed property as invalid opt-in. It must
inspect exact own data properties without executing getters.

### 3.3 Header derivation

The former role-specific modes are replaced by tab-count-driven modes:

```ts
type ComponentTabShellMode =
  | 'legacy'
  | 'single'
  | 'tabbed'
  | 'invalid';
```

| Connected state | Mode |
|---|---|
| no optional component content | `legacy` |
| one valid tab, valid correlated v2 shell | `single` |
| two or more valid tabs, valid correlated v2 shell | `tabbed` |
| zero tabs, missing active tab, invalid content, invalid shell, or correlation mismatch | `invalid` |

Empty versus component affects only body rendering and the required
`presenterId` nullability. It does not select header layout.

### 3.4 Stable machine identity versus display identity

These values must remain separate:

| Value | Purpose | Example | Must not determine |
|---|---|---|---|
| tab descriptor icon + short label | first-row shell identity | note icon + `CAPTURE` | target matching, resource authority |
| breadcrumb segments | second-row human location | `Capture > Collection > Name` | `presenterId`, `targetKey`, permissions |
| `presenterId` | renderer/presentation contract identity | opaque registered ID | display copy, filesystem authority |
| `targetKey` | stable find-or-open match identity | opaque canonical target key | component occurrence, tab ID |
| `componentInstanceId` | one mounted component occurrence | opaque fresh ID | resource identity, presenter class |
| `tabId` | rail/container identity | opaque fresh ID | thread, resource, or component identity |

Renaming a collection, localizing a label, omitting `PAGE.md`, shortening a
path, or changing a view's display name may update the first two rows without
silently changing the latter four identities.

---

## 4. Universal Render Stack

### 4.1 Single tab

```text
shell
└── one active role="tabpanel"
    ├── single-tab identity row (36px default)
    │   ├── accepted add action in far-left slot when supplied
    │   ├── centered active descriptor icon + short label
    │   └── accepted close action when descriptor allows
    ├── location row (54px default)
    │   ├── optional Back
    │   ├── optional Forward
    │   └── breadcrumb navigation/list
    └── accepted Empty picker or ComponentTabPanel body
```

The single identity and location rail render inside the accepted active
`tabpanel`, immediately before the presenter body. The ordinary multi-tab rail
remains outside and labels that same panel. No mode creates a second tabpanel.

### 4.2 Multiple tabs

```text
shell
├── accepted ViewTabStrip (36px default)
└── one active role="tabpanel"
    ├── active location row (54px default)
    │   ├── optional Back
    │   ├── optional Forward
    │   └── active breadcrumb navigation/list
    └── accepted Empty picker or ComponentTabPanel body
```

The two shell rows use the same shell-background ownership. The active
presenter owns only the body below them.

### 4.3 Breadcrumb behavior

- Render semantic ordered breadcrumb content with a shell-owned separator.
- Do not place the separator in the accessible label between every segment if
  native list semantics already provide adequate structure; expose one complete
  readable location label regardless.
- The last segment is the highest-priority visible segment.
- Earlier segments may collapse or truncate as width decreases, but their text
  remains available through a non-layout-shifting accessible/hover affordance.
- Breadcrumb segments are non-interactive in this package. Clickable ancestor
  navigation requires a later explicit action contract rather than smuggling
  commands into display data.
- Back and Forward are actual buttons with accessible names, visible disabled
  states, accepted focus tokens, and no callback when disabled.

---

## 5. Identity and Transition Invariants

### 5.1 One tab to many and back

Changing only collection cardinality changes only header presentation:

```text
single -> add second tab -> tabbed -> close second tab -> single
```

The original active body must remain mounted while it remains the active tab.
The implementation must not key the presenter body by shell mode, breadcrumb,
label, tab count, or navigation state.

This guarantee does not add inactive-tab keep-alive behavior. The accepted
shell renders one active body; when `+` creates and activates another tab, the
prior presenter may unmount and later remount under the existing policy. This
SPEC adds no cache or second owner for presenter-local runtime state.

### 5.2 Empty fill

The accepted reservation/fill lifecycle continues to preserve the Empty tab's
`tabId`. When a fill commits:

- the shell projection changes from `presenterId: null` and its Empty location
  to the component presenter's ID and location;
- the content revision increments through the accepted lifecycle;
- no second tab is created by the shell; and
- header/body changes appear as one owner commit.

This SPEC does not add another fill transition. TABS-03 will separately own
direct synchronous placement of a fully known committed target.

### 5.3 Internal presenter navigation

Landing surfaces may show previews, cards, settings, or internal navigation.
Those are presenter behaviors, not shell roles. If navigation remains within
the same stable target, only display/history state may change. If it changes
the target represented by the tab, the owner must update the target and
location as one canonical transition. The later placement controller must not
infer which case occurred from breadcrumb text.

---

## 6. Ownership and Code-Standards Compliance

### 6.1 One owner per concern

| Concern | Owner |
|---|---|
| tab collection, active tab, component content, location projection | connected view/workspace adapter |
| target match and open-current/new decision | later TABS-03 placement controller |
| presenter history and destination | connected presenter/controller |
| tab rail, single identity row, location row, ARIA, shell tokens | shared renderer shell |
| component body | registered portable presenter/component |
| view-specific names and breadcrumb policy | later view config/adopter contract |
| durable worksurface state | later approved persistence owner |
| action/provenance admission | later BRIDGE/Provenance contract |

### 6.2 Expected file responsibilities

The implementation may adjust exact names while preserving these jobs:

- `componentTabPresentationDomain.ts`: v2 projection types and pure
  single/tabbed/invalid derivation only;
- `componentTabPresentationValidation.ts`: exact bounded v2 validation and
  canonical cloning only;
- a renamed universal single-tab identity component: first-row display and
  accepted add/close actions only, with stale Home terminology removed;
- a universal location-rail component: breadcrumb rendering and optional
  navigation controls only;
- `ComponentTabShellPanel.tsx`: compose the two rows without remounting an
  active body solely because header layout changes;
- `viewTabContentAdapter.ts`: strict active-correlated shell/navigation
  normalization only;
- `ViewTabBar.tsx`: choose legacy/single/tabbed/invalid and retain the accepted
  single active tabpanel;
- focused domain/component/host tests and the existing integrated view-tab
  suites.

Do not put validation, history, target matching, store access, view policy, or
persistence into `ViewTabStrip`, the portable location rail, or the component
body.

### 6.3 Styling

- Use `rv-` classes and existing Workspace Chrome variables.
- Derive both header rows from shell/workspace background with explicit
  fallbacks.
- Expose a location-row height token defaulting to 54px and keep the accepted
  identity/tab rail default at 36px.
- Use shared icon, type, spacing, focus, border, foreground, muted, hover,
  pressed, and disabled tokens rather than raw product-specific values.
- Keep selectors shallow and component-scoped.
- Do not introduce a second theme system, inline product colors, or presenter
  CSS that reaches upward into shell chrome.

### 6.4 State, events, and persistence

- Derive single versus tabbed layout every render; never store it.
- Do not create component-local copies of active tab, location, or navigation
  availability.
- Do not use the UEB as navigation command transport.
- Do not emit layout, focus, breadcrumb, or rail events as Provenance facts.
- Do not persist callbacks or treat this serializable projection as permission
  to choose a durable owner.

---

## 7. Dependency-Ordered Implementation Slices

### Slice 1 — Corrective v2 presentation domain

- replace role-bearing v1 downstream use with the universal v2 shell and
  breadcrumb contract;
- add exact bounded validation and canonical cloning;
- reduce shell derivation to legacy/single/tabbed/invalid;
- prove presenter nullability against Empty/component lifecycle; and
- rerun accepted component lifecycle and descriptor tests.

Exit: the pure domain proves the complete valid/invalid matrix, and no Home or
Content role remains in the public presentation contract.

### Slice 2 — Universal identity and location rows

- generalize the centered Home identity into the single-tab identity;
- replace the two-field Content location display with ordered breadcrumbs;
- add optional active-correlated Back/Forward controls;
- apply the 36px/54px shell stack and responsive breadcrumb behavior;
- preserve one tabpanel, accessible labeling, add/close behavior, and active
  body mount identity across layout-only changes; and
- delete or rename stale role-specific components/classes/tests rather than
  leaving two presentation systems.

Exit: focused component tests prove Empty, landing, addressed, loading,
unavailable, and invalid bodies under both collection cardinalities.

### Slice 3 — Strict connected seam and public-route proof

- extend the existing content adapter normalizer for v2 shell and optional
  navigation capability;
- route the test-owned owner's active tab, location, and actions through the
  real `ViewTabBar` public path;
- prove active-tab switching cannot retain stale location/actions;
- prove cardinality-only layout changes preserve the original body instance
  while it remains active, and separately prove activating another tab retains
  the accepted inactive-tab unmount/remount policy; and
- prove Capture/File production adapters remain unmodified and legacy children
  remain unchanged.

Exit: the integrated route passes without a production adopter, another store,
or a protocol/persistence change.

---

## 8. Required Verification Matrix

| Risk / contract | Required proof |
|---|---|
| Role special cases survive | Static and runtime checks prove no `home`, `content`, `centered-home`, `tabbed-home`, or `tabbed-content` decision remains in the corrected public contract. |
| Every one-tab surface is universal | Render Empty, landing, addressed, ready, and unavailable one-tab bodies; each gets centered descriptor identity followed by a location row. |
| Every multi-tab surface is universal | Active Empty and component tabs both render ViewTabStrip, active location row, then body. |
| Human versus machine identity | Change short label and breadcrumbs while holding presenter/target identities; prove content identity remains unchanged. Change target identity while labels stay identical; prove the records remain distinguishable. |
| Wiki terminal omission | Test-owned projection omits an index-document terminal segment while retaining distinct full target keys; no shell code contains `PAGE.md`. |
| Navigation correlation | Switch active tabs with different histories; only the active tab's controls and callbacks are live. Wrong-tab and partial adapters fail closed. |
| Navigation disabled state | Both buttons remain present with one or both disabled, disabled clicks and keyboard activation invoke nothing, and enabled activation invokes once. |
| Atomic active change | No render exposes tab A's location/actions beneath tab B's selected identity or body. |
| Identity preservation | One-to-many-to-one snapshots tab/component/presenter/target/input/revision/order/location and proves no presenter remount while the original stays active. |
| Empty fill | Accepted reservation commit preserves tab ID and moves from Empty location/null presenter to component location/presenter in one owner update. |
| Breadcrumb bounds | Reject empty, sparse, excessive, malformed Unicode, control-character, accessor, symbol, prototype, and unknown-field input; accepted input is cloned. |
| Breadcrumb overflow | Narrow layout retains the final segment, makes the complete location available accessibly, and does not overflow shell width. |
| ARIA and focus | Exactly one tabpanel; zero tablists in single layout and one in tabbed layout; live `aria-labelledby`; semantic breadcrumb; named navigation buttons; accepted add/close focus recovery. |
| Header geometry | Computed styles prove 36px default identity/tab rail, 54px default location rail, shell-background ownership, and presenter body beginning below both. |
| Failure privacy | Invalid/unavailable UI and diagnostics do not expose supplied breadcrumb/path/provider/stack values. |
| Portability | Static import guard forbids stores, controllers, filesystem, network, plugin, and UEB imports from portable shell components. |
| Production non-adoption | Static sweep proves Capture/File adapters still do not supply corrected shell/navigation data. |
| Regressions | Run component-tab domain/panel/host/presentation/shell tests plus `view-tab-contract.spec.ts`, `view-tab-path-events.spec.ts`, `view-tab-runtime.spec.ts`, Capture suites, and File Viewer tab suites. |
| Build quality | TypeScript, targeted lint, production client build, and `git diff --check` pass. |

Because no production adapter opts in, manual Electron visual, non-Chromium,
and assistive-technology passes may be explicitly deferred in the orchestrator
report. They become mandatory for the first production adopter. Server tests
are not required because this package changes no server code. Discovery of a
needed server/protocol/persistence change stops implementation and returns for
scope amendment.

---

## 9. Definition of Done

This corrective package is complete only when:

- all valid one-tab component/Empty surfaces use centered descriptor identity;
- all valid active tabs use one ordered breadcrumb location rail;
- Home and Content are absent as shell roles and layout decisions;
- Empty and landing surfaces provide explicit human-readable locations;
- shell labels/breadcrumbs remain separate from presenter and target identity;
- optional Back/Forward controls are active-tab-correlated and presenter-owned;
- one-to-many-to-one layout changes preserve durable content identity, while
  an active presenter is not remounted solely because header layout changes;
- the accepted active-only presenter lifecycle remains unchanged, with no
  inactive keep-alive cache or new runtime-state owner;
- location and canonical target cannot become stale relative to one another in
  the test-owned connected route;
- both header rows use shell background and the location row defaults to 54px;
- validation, accessibility, privacy, focus, responsive overflow, and failure
  behavior satisfy the verification matrix;
- existing production Capture/File behavior and accepted Generic Host
  lifecycle remain regression-clean;
- no placement, config, production adoption, persistence, server, UEB,
  Provenance, Chat, or plugin behavior is added; and
- an orchestrator report records exact files, commands, deviations, residual
  risks, accepted dependency identity, and any authorized deferrals.

---

## 10. Explicitly Out of Scope

- TABS-03 presenter/target matching and deduplicated placement;
- **Open in Current Tab** or **Open in New Tab**;
- direct committed-target placement or Side Chat;
- clickable breadcrumb ancestors or breadcrumb-driven resource navigation;
- reading or applying a Wiki `PAGE.md` omission flag;
- view-folder/config migration, default-surface selection, or Empty launcher
  configuration;
- production conversion of Capture, File Explorer, Wiki, Tickets, Projects,
  Browser, Office, Email, Chat, or any other view;
- preview behavior, drawers, sidebar modules, or view-internal navigation
  implementation;
- durable worksurface persistence or restart hydration;
- resource fetch, file save, dirty-buffer policy, or filesystem authority;
- component/plugin discovery, dynamic import, permissions, consent, or
  revocation;
- server, WebSocket, SQLite, harness, provider, or UEB changes;
- provenance facts, action admission, principals, resources, or causal proof;
- thread groups, collections, sessions, transcripts, or ChatSurface; and
- mobile-specific layout.

---

## 11. Downstream Contracts

### 11.1 TABS-03 Tab Target Placement

TABS-03 consumes the corrected contract, not TABS-02's role-bearing projection.
Its match key remains:

```text
explicit presenterId + canonical stable targetKey
```

It never matches the first-row label, icon, breadcrumb segments, navigation
state, filename, extension, or location copy. Its controller must keep a
committed target and its display location correlated when it fills an Empty
tab, appends a tab, activates an existing tab, or receives presenter navigation.

The placement algorithm remains:

```text
exact target already open
  -> activate it and ask that presenter to reveal/recenter
else Open in Current
  -> fill active Empty, otherwise append
else Open in New
  -> append
```

No non-empty tab is replaced by that flow.

### 11.2 View configuration and adoption

A later control-plane/adopter contract may choose either:

- load one registered view/component target; or
- load one Empty tab and its selector/sidebar capability.

That choice does not select a header mode. A one-tab result always uses the
single layout; multiple tabs always use the tabbed layout. Future config may
also provide view-specific landing copy, Empty copy, breadcrumb projection
policy such as omitting `PAGE.md`, and navigation capability. It must validate
those values through the registered view/presenter boundary.

### 11.3 Provenance and Chat

The future action-context bridge may retain `tabId`, `componentTypeId`,
`componentInstanceId`, `presenterId`, and `targetKey` as validated opaque
context. It must not retain breadcrumb text as resource identity or causal
proof. Chat remains blocked until the owner-defined tab milestone and bridge
contracts are accepted; this package does not register or place Chat.

---

## 12. No Open Decisions Inside This Package

RC has fixed the choices needed to dispatch this correction:

- every one-tab surface uses centered short identity and view icon;
- every active tab has a second breadcrumb-style location row;
- optional Back/Forward controls precede that breadcrumb;
- the second row defaults to 150% of the top row's height;
- all header chrome uses shell background;
- Home is presenter behavior, not a shell special case;
- Empty remains an available body/selection state;
- default creation later means either load a registered view target or load an
  Empty tab; and
- display labels stay separate from stable presenter/target identities.

Exact product strings beyond the illustrative Capture examples, the future
Wiki flag's config location, clickable breadcrumb behavior, the first
production adopter, and durable persistence remain later package decisions.
