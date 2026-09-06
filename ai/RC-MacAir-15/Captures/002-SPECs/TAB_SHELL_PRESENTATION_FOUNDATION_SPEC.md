# Tab Shell Presentation Foundation — SPEC

**Date:** 2026-09-03
**Status:** `CANDIDATE — OWNER REVIEW REQUIRED`
**Owner:** Fusion Studio renderer shell and shared view-tab infrastructure.
**Source:** Vision Roadmap decisions D-145 through D-155, especially D-146,
D-154, and D-155; Tabs/Provenance coordination decisions TPC-D01 through
TPC-D09 and ruling TPC-O02.
**Depends on:** Owner-accepted Generic Component Tab Host implementation
described by `GENERIC_COMPONENT_TAB_HOST_ORCHESTRATOR_REPORT.md`. Before
dispatch, replace this report-only dependency with the exact commit containing
that accepted implementation.
**Coordinates with:** `TABS-PROVENANCE-COORDINATION/`.
**Enforces:** `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/`, especially
Code Standards, Architecture Routing, Frontend UI, State Management, Universal
Event Bus, Persistence and Metadata, and Testing and Smoke Slices.
**Blocks:** The later Tab Target Placement SPEC, Component/Tab Action Context
bridge, declarative view adoption, and Composable Chat's eventual tab-facing
integration.

---

## 0. Clean-Session Implementation Brief

Extend the accepted generic component-tab host with one shell-owned
presentation contract. An opted-in view presenter is presented as either
**Home** or **Content**; the accepted generic component route remains available
for later non-view components until their owning SPEC selects a shell role.
**Empty** remains the accepted empty-tab lifecycle state rather than becoming a
fake component or a third component role. **Centered** is a derived layout used
when one Home surface stands alone; it is not stored as tab identity.

The resulting shell has four render outcomes derived from two independent
facts:

```text
durable/owner state                 shell projection
------------------                 ----------------
empty tab                           tabbed Empty picker
one Home component                  centered Home
Home component in a multi-tab set   tabbed Home
Content component                   tabbed Content
```

The transition from centered Home to tabbed Home preserves the same `tabId`,
`componentInstanceId`, component input, and presenter identity. Adding another
tab changes only shell layout. Closing back to one Home derives the centered
layout again.

This SPEC does not place real Capture, File Explorer, Wiki, Ticket, Project,
Chat, Browser, Office, Email, or plugin content into the generic host. It adds
no view-folder configuration reader, dynamic component registry, permission
system, backend route, database schema, WebSocket message, Universal Event Bus
fact, or worksurface persistence owner. A test-owned connected adapter proves
the complete public shell route while production adapters remain unchanged.

The immediately following tab-domain SPEC will own typed target placement,
presenter-and-target matching, recenter/reveal, and the exact **Open in Current
Tab** / **Open in New Tab** flow. Keeping that action controller separate gives
the Provenance bridge one bounded chokepoint without turning layout changes
into action or resource facts.

---

## 1. Problem and Bounded Outcome

The accepted Generic Component Tab Host deliberately models only
`empty | component`. Its shell seam always renders the universal rail whenever
the connected adapter is present. It does not know whether a resolved
component is an app-style Home surface or an addressed Content surface, and it
does not own the mandatory Content location row or the centered single-Home
layout.

Those omissions are intentional foundation boundaries, but they now block the
next shared tab behaviors:

1. Capture and Tickets must be able to begin as a centered Home and retain the
   same Home tab when another surface is added.
2. Wiki and File content must begin as visible Content tabs even when only one
   tab exists.
3. Every tabbed Content surface must receive the same shell-owned Tabs and
   File Location and Path rails before presenter-owned content begins.
4. Empty must remain a shell-owned picker beneath the visible tab rail.
5. The plus action must be reachable in centered Home and move into the rail
   when tabs appear without creating a second tab implementation.

This SPEC provides only that presentation foundation. It introduces a bounded,
serializable shell projection; derives layout without storing it; renders the
shared centered-Home identity and Content location rail; and carries the
accepted component panel inside the same single active `tabpanel`.

---

## 2. Authoritative Behavior Contract

| # | Rule |
|---|---|
| B1 | The accepted `TabContentDescriptor` remains `empty | component`. This SPEC does not add `home`, `content`, or `centered` to that lifecycle union. |
| B2 | An opted-in active tab provides one exact shell projection. A component-backed tab supplies a non-null presentation whose role is `home` or `content`; an Empty tab supplies a null presentation. The role is presentation metadata, not component implementation identity, resource identity, permission, or authority. |
| B3 | `presenterId` is explicit and independent from `componentTypeId`. The former identifies the product presentation; the latter identifies the allowlisted implementation class. The shell never infers either from a filename, extension, folder, label, or one another. |
| B4 | Empty state has no Home/Content presentation. Its opted-in shell projection carries `presentation: null`, and the accepted `EmptyTabPanel` renders beneath a visible rail. A Home/Content presentation for an empty tab is invalid and fails closed. |
| B5 | Exactly one component tab with role `home` derives `centered-home`. The tab rail is not rendered; the Home canvas occupies the view region beneath global app chrome, including behind the centered identity row. |
| B6 | Two or more tabs always derive a visible tab rail. A Home component in that collection renders as `tabbed-home`; the Home body begins immediately below the rail and no location rail appears. |
| B7 | A Content component always derives `tabbed-content`, including when it is the only tab. Its vertical stack is shell-owned Tabs, shell-owned File Location and Path, then presenter-owned Content. |
| B8 | Empty always derives `tabbed-empty`, including when it is the only tab. Its vertical stack is shell-owned Tabs followed by the shell-owned picker. |
| B9 | Centered Home uses the active tab descriptor's existing icon and label. Their icon size and typography are the same token recipes used by that descriptor in the tab rail; only placement changes. The shell does not maintain a second title or icon source. |
| B10 | If the connected adapter supplies `add`, centered Home renders that same add action in the accepted far-left pre-tab shell slot. Invoking it calls the adapter once. When the owner adds and activates an Empty tab, the next render shows the unchanged Home as the left tab and the new Empty tab as active, with the add control after the tab list. Exactly one slot is live. |
| B11 | Centered-to-tabbed and tabbed-to-centered changes preserve `tabId`, `componentInstanceId`, component input, revision, presenter ID, target key, and collection order. No unmount-dependent identity rewrite, component clone, or tab replacement is allowed merely because layout changed. |
| B12 | Closing or otherwise removing tabs may derive centered Home again only when the sole remaining active record is that Home component. A sole Content or Empty record remains tabbed. |
| B13 | `ViewTabBar` continues to expose exactly one active `role="tabpanel"`. Centered Home, tabbed Home, Content, Empty, unavailable content, and invalid projections all render inside that one panel relationship; no nested tablist or tabpanel is introduced. |
| B14 | The Content location projection is required whenever role is `content`. It supplies bounded display-only Location and Path text. It is not filesystem authority, a resource lookup instruction, a copy-path command, or proof that the target exists. |
| B15 | The shell location rail renders only the validated projection. It does not call filesystem, workspace, navigation, or presenter services. Any later interactive path action must enter through an explicit connected callback and its own approved SPEC. |
| B16 | If the optional `shell` property is absent, the accepted generic-host behavior remains unchanged for existing callers. If `shell` is present but malformed, mismatched to the active tab, or inconsistent with Empty/component state, the shell renders a bounded inert unavailable state and never falls through to legacy `children`. |
| B17 | An unavailable or disabled registered component retains valid shell chrome. For example, valid Content metadata still shows its tab and location rail while the presenter body shows the accepted inert unavailable projection. Closing it remains possible when the tab descriptor allows closing. |
| B18 | The portable centered header, location rail, and presentation panel import no store, controller, WebSocket client, filesystem API, event bus, plugin API, or app-global state. They receive validated state and callbacks through props. |
| B19 | The connected adapter remains the sole owner of tab collection, active identity, revisions, add/close/activate effects, and any later persistence. This SPEC adds no store and does not mirror the collection. |
| B20 | Centering, tab focus, rail appearance, rail disappearance, activation, and layout transition are presentation state. This SPEC publishes no UEB facts and makes no causal, resource-mutation, or user-action provenance claim. |
| B21 | All new CSS uses `rv-` class prefixes and existing CSS variables with fallbacks. Home owns its canvas styling; shell owns centered identity, tabs, Empty, and the Content location rail. The active presenter cannot restyle shared shell rails. |
| B22 | No production view adopts the optional presentation seam in this SPEC. Existing Capture and File behavior and their current adapters remain regression-protected and visually unchanged. |
| B23 | A centered-Home/tabbed-Home layout change while Home remains active must preserve the mounted component subtree and its resolver key. Shell branching must not remount the active presenter merely to add or remove rail chrome. Inactive-tab mounting policy remains unchanged. |
| B24 | The centered identity supplies the accessible label target for the single tabpanel when no tab button exists. The tabpanel must never retain `aria-labelledby` pointing to an absent rail element. Tabbed modes continue to use the active tab button. |
| B25 | Centered add uses the same focus contract as rail add. A returned new tab ID focuses the corresponding tab after the rail appears; a null result retains focus on the centered add control. When closing back to centered Home, focus recovery targets the centered identity before falling back to the content area. |
| B26 | Hiding the rail must not hide an action permitted by the active Home descriptor. If the sole Home is closable, its centered shell identity renders one close action using the descriptor's existing `closeLabel`, `closeDisabled`, and the adapter's existing `onClose`; if it is not closable, no centered close appears. The close action invokes the owner once, does not invent the post-close collection state, and recovers focus to the owner's resulting live shell target or the content-area fallback. |

---

## 3. Canonical Presentation Contract

### 3.1 Presentation role and presenter identity

Add one serializable, versioned shell projection beside the accepted active
`TabContentRecord`. Its explicit null presentation opts an Empty tab into the
new shell without inventing an Empty component role. Names are normative;
exact file placement may follow the one-job rule:

```ts
type ComponentTabShellProjection = {
  schemaVersion: 1;
  tabId: string;
  presentation: ComponentTabPresentation | null;
};

type ComponentTabPresentation =
  | {
      role: 'home';
      presenterId: string;
    }
  | {
      role: 'content';
      presenterId: string;
      location: ContentLocationProjection;
    };

type ContentLocationProjection = {
  schemaVersion: 1;
  location: string;
  path: string;
};
```

Contract details:

- `tabId` must exactly equal the connected adapter's active tab ID and the
  active `TabContentRecord.tabId`.
- `presenterId` uses the accepted bounded opaque-ID rules.
- `location` and `path` are non-empty, trimmed, control-character-free UTF-8
  display strings, each capped at 1,024 bytes.
- The projection is exact: unknown own keys, symbol keys, accessors, functions,
  inherited data, unsupported versions, or malformed values are invalid.
- Validation returns a canonical clone and never retains caller-owned mutable
  input.
- The location projection is UI text only. A later target-placement descriptor
  owns stable target identity; a later connected action owns navigation or copy
  behavior.

This is a durable-safe shape, but this SPEC does not choose where an adopter
stores it. A future view owner may serialize equivalent data alongside its tab
record only after its own persistence contract is approved.

### 3.2 Adapter seam

Extend the accepted optional connected content seam with one optional own data
property:

```ts
interface ViewTabContentAdapter {
  active: TabContentRecord;
  shell?: ComponentTabShellProjection;
  // accepted launcher, reservation, resolver, and callback fields unchanged
}
```

Absence preserves the owner-accepted Generic Host route. Presence opts the
connected caller into this SPEC and therefore requires exact validation.
An own `shell` property whose value is `undefined`, `null`, an accessor, or an
invalid present value does not mean absence and must not reactivate legacy
children. The only valid null is `shell.presentation: null` for correlated
active Empty content.

The normalizer must correlate all three active identities before rendering:

```text
ViewTabAdapterModel.activeId
  == ViewTabContentAdapter.active.tabId
  == ComponentTabShellProjection.tabId
```

It must also enforce:

- active `empty` content has `shell.presentation === null`;
- active `component` content has one non-null valid Home or Content
  presentation; and
- the projection remains plain data and contains no React node or callback.

### 3.3 Derived shell mode

Use one pure derivation boundary:

```ts
type ComponentTabShellMode =
  | 'legacy'
  | 'centered-home'
  | 'tabbed-home'
  | 'tabbed-content'
  | 'tabbed-empty'
  | 'invalid';
```

The derivation consumes only the validated ordered tab descriptors, active
content, and optional shell projection. It performs no store read, DOM query,
resource lookup, or side effect.

| Active content | Shell projection | Tab count | Mode |
|---|---|---:|---|
| any accepted content | property absent | any | `legacy` |
| `empty` | valid with null presentation | 1+ | `tabbed-empty` |
| `empty` | Home/Content presentation | any | `invalid` |
| `component` | valid Home presentation | 1 | `centered-home` |
| `component` | valid Home presentation | 2+ | `tabbed-home` |
| `component` | valid Content presentation | 1+ | `tabbed-content` |
| `component` | null, malformed, or mismatched present shell | any | `invalid` |

Zero tabs or a missing active tab is already invalid connected state under the
accepted host contract and remains fail-closed.

### 3.4 Render stacks

```text
centered-home
├── far-left pre-tab shell add (only when adapter supplies it)
└── one active tabpanel
    ├── centered shell identity: existing active icon + label
    ├── centered shell close (only when active descriptor is closable)
    └── presenter-owned Home body (fills container)

tabbed-home
├── shell ViewTabStrip
└── one active tabpanel
    └── presenter-owned Home body

tabbed-content
├── shell ViewTabStrip
└── one active tabpanel
    ├── shell ContentLocationRail
    │   ├── Location
    │   └── Path
    └── presenter-owned Content body

tabbed-empty
├── shell ViewTabStrip
└── one active tabpanel
    └── shell EmptyTabPanel
```

The exact visible words used to label Location and Path should reuse existing
Fusion vocabulary when available. Assistive names must distinguish the two
values without requiring visual position.

---

## 4. Centered Home Transition Contract

### 4.1 Initial centered Home

A connected test owner supplies one component tab, one matching Home
presentation, an active rail descriptor, and an add action. The shell:

1. does not render `role="tablist"`;
2. renders one labeled `role="tabpanel"`;
3. renders the rail descriptor's icon and label in centered placement;
4. renders the add action once in the accepted far-left pre-tab shell slot
   with its configured accessible label; and
5. renders one close action beside the centered identity when the active
   descriptor is closable, preserving its `closeLabel` and disabled state; and
6. renders the resolved Home component below/behind the shell identity within
   the same Home canvas.

The centered identity is shell chrome, not part of the Home component's own
markup. Home presenters therefore do not duplicate their title to opt in.
The centered label has a deterministic panel-scoped DOM ID, and the tabpanel's
`aria-labelledby` points to that live element instead of the absent tab button.
The optional centered close is shell chrome too. It calls the same connected
`onClose(activeId)` path used by the strip exactly once; the connected owner
decides whether closing the sole Home reveals a replacement, removes the
adapter, or is otherwise rejected by its own state contract. A non-closable or
close-disabled Home never gains an enabled close action merely because it is
centered. If the focused close control disappears after a successful owner
transition, the shell follows the accepted focus-recovery order: resulting
active tab or centered identity when one exists, then the content area.

### 4.2 Add another tab

The centered add button invokes the same `ViewTabAddAction.onAdd` used by the
rail. The connected owner may apply the accepted `createEmptyTab` transition.
On the next render:

- the original Home record is unchanged and remains first;
- the new Empty record is active;
- the shell derives `tabbed-empty`;
- one tablist shows both records and then the same add action; and
- one tabpanel shows the Empty picker; and
- the tab returned by `onAdd` receives focus after it appears.

Activating the Home tab derives `tabbed-home`; it does not recreate Home.

### 4.3 Return to one Home

When the owner closes every other tab and activates the sole remaining Home,
the shell derives centered Home again. If rail focus was inside a tab that is
removed, focus recovery follows the accepted `ViewTabStrip`/owner callback
contract before the rail disappears and targets the centered identity when the
surviving tab no longer has a rail button. The shell must not steal focus from
an intentional destination outside the component surface. If Home remains
active while rail visibility changes, its resolved component subtree and key
remain mounted rather than resetting presenter-local state.

### 4.4 No layout event

The layout transition may be observed in React rendering and accessibility
tests, but it does not emit a command, WebSocket message, UEB event, resource
fact, or provenance edge. A later UI-action package may record the initiating
add/close/open action through its accepted controller context; it must not
invent a resource mutation from the resulting layout.

---

## 5. Content Location and Failure Behavior

### 5.1 Location ownership

The shell owns only the common rail and labels. The connected view/presenter
owner supplies validated display values. The renderer must not:

- concatenate a workspace root;
- normalize or resolve filesystem paths;
- infer presenter identity from an extension;
- check whether the resource exists;
- turn the displayed path into authorization;
- add copy, reveal, breadcrumb, or navigation effects; or
- publish the path to Provenance.

Those effects belong to later adopter or placement contracts.

### 5.2 Invalid present projection

If a caller opts in by supplying the `shell` property and any validation
or correlation check fails:

- development/test builds assert with one product-safe diagnostic;
- production renders an inert bounded unavailable body;
- the tab remains visible and closable under its valid rail descriptor;
- no caller-owned function or accessor executes;
- legacy `children` never renders; and
- no raw location, path, plugin, provider, or internal error text appears.

### 5.3 Unavailable component

A valid Home or Content shell remains stable when the accepted resolver returns
`unknown`, `disabled`, `version_unsupported`, or `invalid`. The component body
uses the accepted generic unavailable projection. If registration later
becomes available, rerender may recover in place without changing tab,
component-instance, or presenter identity.

---

## 6. Code-Standards Compliance and Ownership

### 6.1 Existing owners

| Concern | Existing owner used by this SPEC |
|---|---|
| Tab collection, active ID, add/close/activate | Connected `ViewTabAdapterModel` owner |
| Rail markup, keyboard behavior, close/add chrome | `ViewTabStrip` |
| One shell tabpanel and adapter routing | `ViewTabBar` |
| Empty/component lifecycle | Accepted `componentTabLifecycle.ts` domain |
| Component validation and first-party resolution | Accepted component-tab validation/resolver modules |
| Empty and unavailable body presentation | Accepted `EmptyTabPanel` / `ComponentTabPanel` |
| Durable view state | Existing owning view-state/store path; unchanged here |
| Facts and provenance | Existing governed UEB/Provenance path; not invoked here |

No new user-action transport, backend handler, persistence service, event, or
global store is justified by this renderer-only presentation work.

### 6.2 File responsibilities

Exact filenames are advisory, but one-job boundaries are mandatory:

| Responsibility | Expected boundary |
|---|---|
| Presentation types, limits, and pure mode derivation | One domain module |
| Exact runtime validation/canonical clone | One validation module |
| Centered Home shell identity | One portable component |
| Content Location and Path rail | One portable component |
| Shell stack selection | `ViewTabBar` or one extracted shell component if `ViewTabBar` would gain a second job |
| Connected normalization | Existing `viewTabContentAdapter.ts`, split only if it can no longer be described as one normalization job |
| Presentation styling | Component-local `rv-` CSS using variables with fallbacks |

No production view adapter is changed except for compile-preserving type
adjustments required by the optional field.

### 6.3 Portability

The new presentation components accept only canonical data and callbacks.
They do not know the workspace, view, thread, resource service, plugin source,
or provider. The connected owner may know those contexts but passes only the
minimum display projection required here.

### 6.4 State and persistence

The shell derives layout every render. It must not store `centered`,
`tabbed-home`, `tabbed-content`, or `tabbed-empty` in local or durable state.
No accepted state schema or persistence route changes in this SPEC. Future
adopters store their own tab and presentation records once their exact
view-state contract is approved.

---

## 7. Dependency-Ordered Implementation Slices

### Slice 1 — Presentation contract and pure derivation

- add exact versioned Home/Content and location types;
- add bounded canonical validation;
- add the pure shell-mode derivation;
- prove every valid and invalid matrix row, exact-key rejection, bounds,
  cloning, and identity correlation; and
- rerun accepted component lifecycle tests before proceeding.

Exit: pure contract tests pass and accepted descriptor/lifecycle bytes remain
behaviorally compatible.

### Slice 2 — Portable shell presentation

- add centered Home identity using the active tab icon/label, shared add
  action, and descriptor-governed close action;
- add the shell-owned Content Location and Path rail;
- compose Home, Content, Empty, unavailable, and invalid bodies inside one
  tabpanel;
- implement token-derived styling and responsive overflow; and
- prove keyboard reachability, accessible naming, focus continuity, and no
  nested tab semantics.

Exit: rendered component tests pass without store, network, filesystem, or
event-bus imports.

### Slice 3 — Optional connected seam and full-route proof

- extend the strict connected normalizer with a presence-sensitive shell
  projection;
- derive whether `ViewTabStrip` is shown;
- route centered add and close actions through the existing adapter callbacks;
- exercise the real `ViewTabBar -> shell -> ComponentTabPanel` route through a
  test-owned adapter/controller; and
- prove production Capture/File adapters and legacy children remain unchanged.

Exit: the public shell route passes centered-to-tabbed-to-centered transitions,
Content and Empty stacks, malformed-input failure, and legacy regression tests.

---

## 8. Verification Matrix

| Risk / contract | Required proof |
|---|---|
| Role/lifecycle conflation | Type and runtime tests prove Empty remains lifecycle state and Home/Content apply only to component records. |
| Centered stored as identity | Pure derivation tests prove the same records yield centered or tabbed layout based only on collection shape. |
| Identity churn | Full-route test snapshots `tabId`, `componentInstanceId`, revision, presenter ID, input, and order across both layout transitions. |
| Duplicate title/icon sources | Centered Home test changes the active rail descriptor and proves the centered identity follows it without a second config field. |
| Plus placement and duplication | Exactly one add control exists in the accepted far-left pre-tab slot for centered Home and exactly one exists after the tab list in tabbed modes; one click invokes one callback. |
| Plus focus | A successful centered add focuses the returned new tab after the rail appears; a null add result leaves focus on the centered control. |
| Centered close | A closable sole Home exposes exactly one action with its descriptor's `closeLabel`, calls `onClose(activeId)` once, honors `closeDisabled`, remains closable when its component is unavailable or disabled, and recovers focus to the resulting live shell target or content-area fallback; a non-closable Home exposes none. |
| Content shell ownership | Single- and multi-tab Content tests prove Tabs -> Location/Path -> body ordering. |
| Home shell ownership | Centered and tabbed Home tests prove no location rail and presenter body begins at the required boundary. |
| Empty shell ownership | Single Empty test proves visible rail and accepted picker beneath it. |
| ARIA regression | Exactly one tablist when tabbed, none when centered Home, exactly one labeled tabpanel in every valid mode, a live centered `aria-labelledby` target, and existing roving-keyboard behavior unchanged. |
| Active Home remount | A stateful test presenter proves a rail visibility change while Home remains active does not remount or reset the resolved body. |
| Return focus | Closing back to a sole Home from rail focus lands on its centered identity, with content-area fallback only when that target cannot exist. |
| Invalid opt-in | Unknown keys, accessor fields, symbol fields, malformed strings, wrong tab correlation, component+null, and Empty+Home/Content render inertly without legacy fallback or callback execution. |
| Unavailable recovery | Valid shell remains stable while component resolution moves unknown -> ready in place. |
| Privacy | Invalid diagnostics and UI never expose supplied path, plugin, provider, stack, or filesystem text. |
| Portability | Static import test forbids stores, controllers, network, filesystem, plugin, and UEB modules from portable presentation files. |
| Production non-adoption | Static sweep proves current Capture/File adapters do not supply the new `shell` property and no other production adapter opts in. |
| Existing regressions | Run accepted component-tab domain/panel/host tests plus `view-tab-contract.spec.ts`, `view-tab-path-events.spec.ts`, Capture, clipboard, and File Viewer tab suites. |
| Build quality | TypeScript build, targeted lint, client production build, and `git diff --check`. |

Electron visual, manual assistive-technology, and non-Chromium verification may
remain deferred because this SPEC adds no production adopter. They become
mandatory when the first real view adopts Home/Content/Empty shell behavior.

Server tests are not required because this SPEC changes no server or protocol
code. If implementation discovery requires either, stop and amend the SPEC
rather than quietly widening it.

---

## 9. Definition of Done

This SPEC is complete only when:

- Home and Content have one exact, bounded, versioned presentation projection;
- Empty remains the accepted empty lifecycle state;
- centered is derived and never persisted;
- one Home component moves between centered and tabbed layouts without
  identity or state churn;
- Content always receives the common Tabs and File Location and Path rails;
- Empty always renders as a visible tab plus picker;
- the same add callback appears in the correct centered or rail location, never
  both;
- a centered Home preserves the active descriptor's close availability,
  accessible name, disabled state, and owner callback;
- centered add and return-to-Home focus recover to live shell targets;
- an active Home presenter is not remounted solely because rail visibility
  changes;
- invalid present projections fail closed and never reveal legacy children;
- portable components obey the dependency and CSS standards;
- no production view, Chat surface, dynamic registry, configuration reader,
  persistence owner, server route, or UEB publisher is added;
- focused and integrated tests, typecheck, lint, build, and diff checks pass;
  and
- an orchestrator report records exact files, commands, deviations, residual
  risks, and the accepted Generic Host baseline commit.

---

## 10. Explicitly Out of Scope

- typed resource/open-target requests;
- presenter-and-target matching or deduplication;
- reveal, select, scroll, focus, or recenter callbacks;
- **Open in Current Tab** and **Open in New Tab** placement;
- direct committed-descriptor placement used by Side Chat;
- view-folder relocation or `System/Views` control-plane work;
- reading, merging, editing, or persisting view configuration;
- dynamic registration, plugin discovery/import, permissions, consent, or
  revocation;
- production conversion of Capture, File Explorer, Wiki, Tickets, Projects,
  Browser, Office, Email, or any other view;
- drawers, drawer icons, preview policy, or card expansion;
- thread groups, ChatSurface, Pending New Chat, Side Chat, or thread
  collections;
- group-keyed worksurface persistence or restart hydration;
- copy/reveal/path actions or filesystem authority;
- WebSocket, backend, SQLite, harness, or provider changes;
- UI-action, layout, resource, or causal Provenance publication; and
- mobile-specific presentation.

---

## 11. Downstream Contracts

### 11.1 Tab Target Placement

The next tab-domain SPEC consumes:

- `tabId` and accepted empty/component lifecycle;
- explicit `presenterId`;
- component `targetKey` as an opaque resource-match seed;
- Home/Content role;
- Content location projection; and
- one connected owner for ordered tabs and active state.

It adds one validated action/controller chokepoint for:

```text
match presenterId + stable target identity
  -> activate existing and ask presenter to reveal/recenter
  -> else Open in Current: fill active Empty or append when populated
  -> else Open in New: append
```

It must not infer causation, use the UEB as command transport, or make a tab a
principal, permission, or resource.

### 11.2 Component/Tab Action Context bridge

The Provenance bridge must depend on accepted Tab Target Placement rather than
only on the Generic Host, because the placement controller is the first owner
that can validate `tabId`, `componentTypeId`, `componentInstanceId`,
`presenterId`, and `targetKey` together for one action. The bridge may retain
those values as opaque context; it cannot derive authority or causal proof from
them.

### 11.3 Declarative view adoption

View configuration may later choose a default Home, Content, or Empty surface;
whether add is available; and which launcher targets appear in Empty. That work
waits for the DB-authoritative registration, validation, permission, consent,
and revocation foundation identified as PROV-02. Each view then adopts the
shared shell in its own approved SPEC.

### 11.4 Chat

Chat remains blocked until the owner-defined tab milestone and the reconciled
Tabs/Provenance bridge are accepted. This SPEC does not register ChatSurface,
place Side Chat, or decide whether a Side Chat uses the base component shell or
an accepted Home/Content role. The later Chat integration must make that choice
explicitly without changing session routing by `threadId`.

---

## 12. No Open Decisions

The owner has already fixed the product choices needed by this bounded SPEC:

- Empty, Home, and Content are the three visible paradigms;
- Empty is the picker state;
- Home is centered when alone and becomes an ordinary tab without identity
  replacement when another tab appears;
- Content always uses the shared Tabs and File Location and Path rails;
- Wiki is the Content reference, Capture the Home reference, and File Explorer
  the Empty reference; and
- existing views are adopted separately after shared groundwork.

The exact first production adopter, dynamic registry/control-plane design,
durable tab snapshot schema, and provenance event policy remain later package
decisions and do not block this presentation-only foundation.
