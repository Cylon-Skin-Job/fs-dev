# TABS-03 — Tab Target Placement

**Status:** `CANDIDATE — NOT IMPLEMENTATION AUTHORITY`  
**Date:** 2026-09-04  
**Lane:** Tabs  
**Requires:** TABS-00, TABS-01, TABS-02, and owner-accepted TABS-02A  
**Blocks:** BRIDGE-01 and every production tab-native view adoption

## 1. Objective

Implement one canonical renderer-owned placement controller that accepts a
typed request for a fully resolved presenter/resource target and deterministically:

1. activates an exact already-open target and asks its presenter to
   reveal/recenter;
2. otherwise fills the active unreserved Empty tab for `current`;
3. otherwise appends a new committed tab; and
4. returns a validated product-safe result suitable for the later provenance
   bridge.

This package lays the generic placement foundation only. It proves the flow
through the public tab host using a virtual test adapter and does not convert a
production view.

## 2. Authority And Standards

### 2.1 Authoritative artifacts

- `/Users/rccurtrightjr./projects/fs-dev/AGENTS.md`
- `ai/RC-MacAir-15/Captures/022-Vision_Roadmap/DECISIONS.md`
- `ai/RC-MacAir-15/Captures/002-SPECs/GENERIC_COMPONENT_TAB_HOST_SPEC.md`
- `ai/RC-MacAir-15/Captures/002-SPECs/GENERIC_COMPONENT_TAB_HOST_ORCHESTRATOR_REPORT.md`
- `ai/RC-MacAir-15/Captures/002-SPECs/TAB_SHELL_PRESENTATION_FOUNDATION_SPEC.md`
- `ai/RC-MacAir-15/Captures/002-SPECs/TAB_SHELL_PRESENTATION_FOUNDATION_ORCHESTRATOR_REPORT.md`
- `ai/RC-MacAir-15/Captures/002-SPECs/UNIVERSAL_TAB_HEADER_AND_LOCATION_RAIL_SPEC.md`
- `ai/RC-MacAir-15/Captures/002-SPECs/UNIVERSAL_TAB_HEADER_AND_LOCATION_RAIL_ORCHESTRATOR_REPORT.md`
- `ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-COORDINATION/INTERFACE-CONTRACT.md`
- `ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-COORDINATION/OWNER-DECISIONS.md`
- this bundle's `DECISIONS.md`, `ISSUES.md`, `CODE-INVENTORY.md`, and
  `IMPLEMENTATION-GUIDANCE.md`.

### 2.2 Code standards

Hub:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`

Routed pages beneath that directory:

- `001-Architecture_Routing/PAGE.md`
- `002-Frontend_UI/PAGE.md`
- `003-State_Management/PAGE.md`
- `008-Testing_And_Smoke_Slices/PAGE.md`

No code standard is superseded. This renderer-only package does not route to
WebSocket, UEB, persistence, or database standards because those layers are
explicit non-goals.

### 2.3 Authority precedence

Newer explicit owner decisions govern the exact contract they address. TABS-02A
supersedes downstream use of TABS-02's Home/Content role split while preserving
TABS-02 as historical implementation evidence. Active code constrains feasible
integration but does not override approved behavior.

## 3. Preconditions And Accepted Baseline

Before implementation:

- TABS-00, TABS-01, and TABS-02 remain accepted prerequisites;
- the owner explicitly accepted the completed TABS-02A implementation on
  2026-09-04;
- the worker records the current repository root, branch, dirty paths, and exact
  TABS-02A baseline evidence without overwriting unrelated changes;
- the corrected v2 shell projection is the only downstream presentation model;
- Empty remains a content lifecycle state, not a presentation role; and
- generic unaddressed components remain legal, but they are not placeable or
  deduplicable through TABS-03.

The receiving orchestrator must run this exact dependency check **once at
preflight, before editing product or test files**, from
`fusion-studio-client/`:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
paths=(
  'src/main.tsx'
  'src/reactRootErrorPolicy.ts'
  'src/components/view-tabs/componentTabPresentationDomain.ts'
  'src/components/view-tabs/componentTabPresentationValidation.ts'
  'src/components/view-tabs/PresenterErrorBoundary.tsx'
  'src/components/view-tabs/ComponentTabPanel.tsx'
  'src/components/view-tabs/SingleTabIdentity.tsx'
  'src/components/view-tabs/TabLocationRail.tsx'
  'src/components/view-tabs/ComponentTabShellPanel.tsx'
  'src/components/view-tabs/componentTabShell.css'
  'src/components/view-tabs/componentTabDomain.ts'
  'src/components/view-tabs/viewTabDomIds.ts'
  'src/components/view-tabs/ViewTabBar.css'
  'src/components/view-tabs/viewTabContentAdapter.ts'
  'src/components/view-tabs/ViewTabBar.tsx'
  'src/components/view-tabs/ViewTabStrip.tsx'
  'e2e/component-tab-panel.spec.ts'
  'e2e/component-tab-presentation-domain.spec.ts'
  'e2e/component-tab-shell-panel.spec.ts'
  'e2e/component-tab-host.spec.ts'
  'e2e/view-tab-contract.spec.ts'
  'e2e/file-viewer-tabs.spec.ts'
)
for file in "${paths[@]}"; do
  shasum -a 256 "$file"
done | shasum -a 256
```

Expected preflight output:

```text
f91b7cb7eb6263040c39c1931fbeef401c68c98e4157476c32eb6636f2210a35  -
```

This is the final 22-path client-relative aggregate recorded in
`UNIVERSAL_TAB_HEADER_AND_LOCATION_RAIL_ORCHESTRATOR_REPORT.md` and independently
reproduced during owner review. The working directory, path spelling, and order
above are normative because `shasum` includes printed path text in the
aggregate.

This digest is a pre-edit dependency identity check, not an expected
post-implementation result. If it differs, do not label the checkout or
implementation failed from the hash alone. Inventory the named paths against
the accepted report, record the difference, and stop only for an unexplained
material dependency change. Do not silently rebuild or reinterpret the
baseline. Any optional final candidate fingerprint must state its exact ordered
paths, working directory, command, and result and cannot replace the required
behavioral gates.

## 4. Scope

TABS-03 owns:

- canonical placement request/result types and strict validation;
- a synchronous first-party target-resolution port;
- exact `presenterId + targetKey` matching;
- non-destructive `current|new` placement planning;
- controller-owned `tabId` and `componentInstanceId` minting;
- atomic direct fill or append of committed component content and v2 shell
  presentation;
- existing-target activation and presenter reveal/recenter callback routing;
- bounded safe failure outcomes; and
- public-route test coverage through `ViewTabBar`.

## 5. Non-Goals

This package does not implement:

- Capture, File Explorer, Wiki, Tickets, Projects, Browser, Office, Email, Chat,
  or another production adopter;
- preview/drawer/sidebar visual design or DOM source-specific behavior;
- dynamic component discovery, imports, user registrations, schemas,
  permissions, consent, or revocation;
- server, Electron, HTTP, WebSocket, SQLite, filesystem, harness, or UEB work;
- provenance facts, action admission, principals, timestamps, actor attribution,
  causal claims, or snapshotting;
- resource loading, saving, dirty-buffer resolution, live refresh, or edits;
- durable worksurface persistence, migration, or restart hydration;
- presenter history stacks or Back/Forward behavior; or
- a second state store or global placement service.

## 6. Canonical Contracts

The final implementation may choose file names that fit the existing module
layout, but must export the following observable contract from the component-tab
domain surface.

### 6.1 Placement request

```ts
type TabPlacementDisposition = 'current' | 'new';

interface TabPlacementTargetRef {
  presenterId: string;
  targetKey: string;
}

interface TabPlacementRequest {
  schemaVersion: 1;
  requestId: string;
  disposition: TabPlacementDisposition;
  target: TabPlacementTargetRef;
}
```

`requestId`, `presenterId`, and `targetKey` are trimmed, bounded opaque strings.
`requestId` and `presenterId` both use
`COMPONENT_TAB_LIMITS.maxIdBytes` (256 UTF-8 bytes); `targetKey` uses
`COMPONENT_TAB_LIMITS.maxTargetKeyBytes` (512 UTF-8 bytes). Exact object shape
is mandatory. Unknown keys, inherited keys, accessors, symbols,
blank/untrimmed/control-character strings, and unsupported versions are rejected
before any resolver or state callback runs.

`requestId` correlates one invocation and result. It is not a timestamp,
idempotency ledger, permission grant, actor identity, or causal assertion.

### 6.2 Resolved target

The controller calls one injected synchronous first-party resolver only after
request/state validation proves that no exact target is already open. The
resolver returns either unavailable or a fully known committed projection
equivalent to:

```ts
interface ResolvedTabPlacementTarget {
  schemaVersion: 1;
  presenterId: string;
  targetKey: string;
  componentTypeId: string;
  input: Record<string, JsonValue>;
  tab: Omit<ViewTabDescriptor, 'id'>;
  location: TabLocationProjection;
}
```

The implementation may reuse an existing validated descriptor type or define a
narrower equivalent. The following requirements are invariant:

- resolved `presenterId` and `targetKey` exactly equal the request;
- the resolver never supplies `tabId` or `componentInstanceId`;
- `componentTypeId`, input, and location validate under the existing
  generic-host and TABS-02A size/shape policies;
- `tab` is an exact plain record with required own enumerable data properties
  `label`, `icon`, and `closeLabel`; optional own enumerable data properties are
  only `iconClassName`, `closable`, and `closeDisabled`; symbols, accessors,
  inherited properties, and unknown keys are rejected;
- `label` and `closeLabel` are nonblank, trimmed, control-free strings bounded by
  `COMPONENT_TAB_PRESENTATION_LIMITS.maxDisplayTextBytes` (1,024 UTF-8 bytes);
  `icon` and optional `iconClassName` are nonblank, trimmed, control-free strings
  bounded by `COMPONENT_TAB_LIMITS.maxIdBytes` (256 UTF-8 bytes); and optional
  `closable`/`closeDisabled` values are booleans;
- callbacks, functions, classes, DOM nodes, and arbitrary modules are not
  descriptor data. Valid JSON input may contain URL strings as inert presenter
  input, but URLs and display strings never select identity, permissions,
  modules, or placement;
- a thrown resolver or invalid/unavailable result becomes a bounded failure;
  raw exception text, paths, stacks, and arbitrary values do not escape; and
- resolution is code-owned for this package. User-authored/dynamic registrations
  require the later control-plane authority.

### 6.3 Atomic placeable state

The connected tab owner must expose one validated placement snapshot containing
enough correlated data to decide and apply placement:

- ordered tab records and active tab identity;
- Empty reservations;
- component content descriptors;
- tab-strip descriptor presentation;
- v2 shell presenter/location projection; and
- presenter reveal/recenter routing for committed component instances.

The implementation may group these values into a new connected adapter record
or compute a pure placement plan against existing records. It must apply a
successful fill/append/activation once at the connected owner. There must be no
intermediate render in which component content, active identity, tab descriptor,
shell presenter, or location refers to a different target.

The owner exposes an atomic acknowledged commit port. A commit receives the
validated prior snapshot (or its owner-issued revision) and the complete next
snapshot. It returns synchronously or asynchronously with exactly one of:

- `committed`, including a freshly readable validated snapshot that contains
  the exact planned content/order/active/reservation/presentation transition; or
- `rejected`, with state unchanged and no partial application.

Throwing, rejecting, returning a thenable with an invalid result, reporting
success without the exact transition, or changing state on a rejected commit is
a host-contract failure and produces `state_commit_failed`. The controller does
not report placement success or release its per-host decision/commit lane until
a valid committed acknowledgement is observable. Paint may occur later; the
authoritative connected-owner snapshot may not.

Presentation components remain prop-driven. They do not import a store or run
the placement algorithm.

### 6.4 Placement result

Every invocation returns exactly one validated result equivalent to:

```ts
type TabPlacementOutcome =
  | 'activated_existing'
  | 'filled_current'
  | 'appended_new';

interface TabPlacementSuccess {
  schemaVersion: 1;
  ok: true;
  requestId: string;
  outcome: TabPlacementOutcome;
  tabId: string;
  componentTypeId: string;
  componentInstanceId: string;
  presenterId: string;
  targetKey: string;
  reveal: 'not_required' | 'completed' | 'failed';
}

interface TabPlacementFailure {
  schemaVersion: 1;
  ok: false;
  requestId: string | null;
  code: TabPlacementFailureCode;
  message: string;
}
```

For every request failure, `requestId` is the valid ID when it can be extracted
without invoking code from an own enumerable data property of a plain outer
record, even when another field is invalid. It is `null` when the ID is missing,
inherited, an accessor, non-enumerable, malformed, or cannot be inspected
safely. Unknown outer fields or symbols still reject the request but do not
erase an otherwise independently valid own data `requestId`.

Required stable failure codes are:

```text
invalid_request
invalid_state
target_unavailable
target_contract_conflict
ambiguous_existing_target
capacity_exceeded
invalid_generated_id
id_conflict
state_commit_failed
```

Equivalent names are allowed only if they remain typed, stable, documented, and
covered one-for-one. Messages are product-safe and bounded. Results contain no
breadcrumb/path display, raw errors, actor, permission, timestamp, event name,
or causal proof. BRIDGE-01 may wrap the accepted result later.

Result envelopes are exact plain records with own enumerable data properties,
no symbols/accessors/inheritance/unknown keys, and the same ID/target bounds as
their source contracts. Failure `message` is nonblank, trimmed, control-free,
and bounded by `COMPONENT_TAB_LIMITS.maxErrorMessageBytes` (512 UTF-8 bytes).

## 7. Normative Placement Algorithm

For every request, the controller performs these steps in order.

### 7.1 Validate before effects

1. Strictly validate the request envelope and target reference.
2. Strictly validate the current placement snapshot and correlation invariants.
3. Resolve an exact existing target as defined in §7.2.
4. Only when no exact target exists, invoke the synchronous target resolver
   exactly once, strictly validate its result, and confirm that its
   presenter/target exactly match the request before applying disposition.

Failure at any point returns without state mutation, reveal, focus, or ID
minting. Getter/accessor traps and hostile objects cannot crash the public route
or disclose arbitrary values.

### 7.2 Resolve exact existing target first

Search only populated component tabs whose committed shell projection and
component descriptor are mutually valid. Match the validated request only:

```text
request.target.presenterId === shell.presenterId
AND
request.target.targetKey === component.targetKey
```

Do not normalize, case-fold, decode, trim, infer, or compare labels,
breadcrumbs, filenames, extensions, path display, input payloads, tab IDs, DOM
IDs, or component instance IDs.

- Zero matches: resolve the target once, then continue to disposition.
- More than one match: fail `ambiguous_existing_target`; do not choose one.
- One valid match: if needed, atomically activate its `tabId`, then invoke
  reveal/recenter for that exact `componentInstanceId` with the validated target
  reference. When it is already active, the controller verifies that latest
  state and performs no redundant state commit before reveal.

A tab with a structurally valid addressed component descriptor and mutually
valid committed shell projection remains eligible for exact matching when its
current rendering resolver or rendered body is unavailable. Rendering
availability is not target identity. An exact match still activates/recenters,
does not invoke the creation resolver, and does not create a duplicate.

A tab whose component descriptor, tab descriptor, or shell projection is
structurally invalid, legacy, or unaddressed is preserved but unavailable to
placement. It is skipped for matching and cannot be direct-filled even when its
outer content appears Empty; `current` treats it as protected and appends. Its
accessors are never invoked. Duplicate/invalid tab IDs, duplicate or malformed
reservation ownership, impossible active identity, or another malformed
collection envelope is `invalid_state` and rejects the whole request.

An existing match wins for both `current` and `new` dispositions. The controller
does not invoke the creation resolver, mint an ID, or append a duplicate exact
target. Resolver availability or a changed resolver component mapping cannot
invalidate a valid target that is already open.

The connected reveal port accepts the exact committed `tabId`,
`componentInstanceId`, `presenterId`, and `targetKey` and may return `void` or a
promise. The controller may therefore be asynchronous even though target
resolution and placement planning are synchronous. If reveal/recenter succeeds,
return `activated_existing` with `reveal: 'completed'`. If the callback is
absent, throws, rejects, or returns an invalid outcome, retain activation and
return the same placement outcome with `reveal: 'failed'`. No raw failure detail
escapes. A presenter callback may change only presenter-owned internal
selection/navigation; it cannot rewrite the placement result or shell identity.

### 7.3 Open in Current

When no exact target exists and disposition is `current`:

- if the active record is a valid Empty tab and no pending or failed reservation
  exists for that tab/revision, direct-fill it;
- otherwise append a new tab when the valid collection has no active tab or the
  active tab is populated/reserved.

A non-null active ID that does not identify exactly one outer collection
record, or a malformed collection/active-identity ownership envelope under
§6.3, is `invalid_state`; it is not an append fallback. Nested component,
tab-presentation, or shell-projection invalidity described in §7.2 does not
invalidate an otherwise sound active identity. Such a protected active record
cannot be filled and is an append fallback.

Direct fill:

- preserves the Empty tab's `tabId` and collection position;
- mints a fresh `componentInstanceId`;
- increments the existing content revision exactly once;
- installs validated component content, tab descriptor, presenter, and location
  in one connected-owner commit;
- makes that tab active; and
- returns `filled_current` with `reveal: 'not_required'`.

It does not reserve the Empty tab, generate an operation ID, select/cancel a
launcher, or reuse `commitEmptyTabFill`. Direct placement and async launcher
completion remain distinct authority paths.

### 7.4 Open in New and append fallback

When no exact target exists, append when:

- disposition is `new`; or
- disposition is `current` but the valid collection has no active tab or its
  active tab is populated or has a reservation.

Append:

- mints fresh `tabId` and `componentInstanceId` through injected owner factories;
- rejects invalid or currently used IDs before commit;
- adds one correlated committed tab record at the end of the collection;
- preserves every existing tab, reservation, and order;
- activates the appended tab; and
- returns `appended_new` with `reveal: 'not_required'`.

The tab limit is 512, aligned with the existing container bound. At capacity, an
existing exact target may still activate; a request requiring fill does not add
a record and may still succeed; a request requiring append fails
`capacity_exceeded` without minting or mutation.

### 7.5 Commit and focus semantics

The pure domain returns a transition/plan; the connected owner performs at most
one acknowledged atomic state commit under §6.3. Any rejected, thrown,
malformed, or unobservable acknowledgement returns `state_commit_failed`
without invoking reveal. A compliant rejection leaves state unchanged. No
compensating second store or silent partial mutation is allowed.

The placement domain performs no DOM query, click, focus, scroll, or layout
measurement. After a successful fill/append, the existing tab shell's normal
active-panel focus behavior applies. For an existing target, the presenter-
owned reveal callback owns internal reveal/recenter/focus behavior.

### 7.6 Concurrent requests

Each connected tab host serializes request validation through state commit and
evaluates every accepted request against the latest committed state. Two
concurrent requests for the same previously unopened presenter/target therefore
produce at most one fill/append; the later request observes the committed exact
match and activates it. Two different requests are placed in controller-arrival
order, so only the first may consume an available Empty tab.

This lane is instance-local coordination, not a store or global service. It is
held across asynchronous commit acknowledgement and released only after the
committed transition is readable and validated, or after final rejection. It is
released before awaiting a presenter reveal/recenter callback. Reveal failure
cannot roll back or reorder the already committed placement.

## 8. Invariants

| ID | Invariant |
|---|---|
| B01 | There is one placement algorithm and one connected controller route for every future source. |
| B02 | Exact target identity is `presenterId + targetKey` only. |
| B03 | Existing-target resolution occurs before disposition. |
| B04 | A valid exact existing target is never duplicated by TABS-03. |
| B05 | A populated tab is never replaced by `current`. |
| B06 | A reserved Empty tab is never consumed, cancelled, retried, or overwritten by placement. |
| B07 | Direct fill preserves `tabId`; append mints a new `tabId`; both mint a new `componentInstanceId`. |
| B08 | Sources and resolvers cannot choose tab or component-instance identity. |
| B09 | Content target, presenter, tab descriptor, location, order, active tab, and reservations remain correlated through one commit. |
| B10 | Breadcrumbs, labels, filenames, extensions, and DOM IDs never authorize or match placement. |
| B11 | Ambiguous duplicates and invalid or identity-mismatched resolver outputs fail closed without mutation. |
| B12 | Invalid/hostile requests, state, resolver output, IDs, and callbacks cannot crash the public tab route or expose raw errors. |
| B13 | Reveal failure retains successful activation and is reported safely. |
| B14 | TABS-03 creates no store, backend route, WebSocket message, UEB event, provenance fact, or persistence schema. |
| B15 | Generic components without `targetKey` remain hostable but cannot satisfy an addressed placement match. |
| B16 | Presenter navigation after placement continues under TABS-02A: the connected owner updates canonical target and location together. |
| B17 | Existing Capture/File adapters and all unrelated views preserve current behavior. |
| B18 | Concurrent placement is serialized per connected host against latest committed state; the same exact target is not duplicated by a stale decision. |
| B19 | Structurally invalid, legacy, and unaddressed tab records remain preserved placement-unavailable records; a structurally valid addressed exact target remains matchable even when its current renderer/body is unavailable; collection identity/ownership corruption still fails closed. |
| B20 | Placement success requires an acknowledged exact atomic commit; the per-host lane remains held until the committed state is observable. |

## 9. Failure Matrix

| Condition | Result | State/reveal effects |
|---|---|---|
| Malformed/hostile request | `invalid_request` | none |
| Malformed or internally inconsistent snapshot | `invalid_state` | none |
| Resolver unavailable/throws/structurally invalid output after no match | `target_unavailable` | none; raw detail suppressed |
| Resolved identity differs from request | `target_contract_conflict` | none |
| More than one exact target | `ambiguous_existing_target` | none |
| Exact target reveal fails | success `activated_existing`, `reveal: failed` | exact tab remains active |
| Append required at 512 records | `capacity_exceeded` | none |
| Factory returns invalid/colliding ID | `invalid_generated_id` or `id_conflict` | none |
| Connected owner rejects commit | `state_commit_failed` | no reveal; no partial second-state write |

## 10. Dependency-Ordered Slices

### Slice 1 — Placement contract, validation, and pure transition

Implement:

- request, resolved-target, snapshot/record, result, and failure types;
- strict request/resolver/snapshot/result validation using existing bounds;
- exact-match classification;
- non-destructive fill/append planning;
- duplicate, type-conflict, reservation, capacity, revision, and ID checks; and
- public domain exports.

Required proof:

- table-driven pure tests for `current`, `new`, existing match, active Empty,
  populated fallback, valid empty-collection fallback, invalid active identity,
  reserved Empty fallback, exact
  capacity behavior, same resource/different presenter, different resource/same
  presenter, display collisions, duplicates, type conflicts, ID collisions, and
  revision increments;
- hostile-object/accessor/symbol/inherited/unknown-field/boundary tests for every
  new validation envelope, including tab display fields and partial-validity
  `requestId` correlation; and
- structurally invalid/legacy/unaddressed unrelated tabs are skipped and
  preserved, while a structurally valid exact target with an unavailable
  renderer/body still matches without creation resolution or duplication, and
  invalid collection identity/reservation envelopes reject;
- a valid collection whose uniquely identified active record has protected
  nested component/tab-presentation/shell invalidity appends for `current`,
  while malformed outer collection or active-identity ownership rejects; and
- all pre-existing component-tab domain and presentation tests remain green.

### Slice 2 — Connected controller and presenter reveal boundary

Implement:

- one connected controller that validates, resolves once, plans, applies once,
  and returns one safe result;
- owner-injected tab and component-instance ID factories;
- exact `componentInstanceId` presenter reveal/recenter routing;
- safe resolver, callback, and commit-failure containment; and
- the narrow adapter/public export required by future sources and BRIDGE-01.

Required proof:

- resolver is not called for invalid request/state, ambiguous duplicates, or an
  exact existing match;
- IDs are not minted for an exact existing match or a capacity rejection;
- fill/append is one observable owner commit;
- false/throw/reject/malformed/delayed acknowledgements never return early
  success, and the serialization lane is held until a valid commit is readable;
- concurrent same-target requests produce one committed target, and concurrent
  distinct targets consume at most one Empty tab in controller-arrival order;
- reveal runs only after existing-target activation and against the exact
  instance;
- reveal failure retains activation and leaks no thrown path/message/stack;
- rejected requests cause no commit, focus, reveal, or source callback; and
- no store/service/event/server dependency is introduced.

### Slice 3 — Public host proof and regression closure

Extend the Vite virtual-adapter harness and exercise the placement route through
the public `ViewTabBar` render. Test sources may represent sidebar, preview,
landing, or Empty-selector callers but must all invoke the same controller.

Required public-path scenarios:

1. single Empty `current` fills in place and retains centered single-tab identity;
2. one populated `current` appends and changes to ordinary tab rail;
3. a uniquely identified active tab with protected nested descriptor or
   presentation invalidity causes `current` to append rather than fill or fail;
4. multi-tab `new` appends, activates, and shows correlated location;
5. exact existing target activates/recenters without duplication for both
   dispositions, including while creation-time resolution or that target's
   current rendering resolver/body is unavailable;
6. identical display labels/breadcrumbs with different target identity do not
   deduplicate;
7. same `targetKey` under different presenters produces distinct tabs;
8. reserved Empty `current` appends and preserves the reservation;
9. duplicate exact targets fail closed without a UI crash;
10. unavailable/hostile resolver output shows only a bounded safe failure path;
11. reveal failure retains the correct active tab;
12. close/add/async Empty/presenter navigation/error-boundary behavior from the
    accepted host remains unchanged; and
13. current production Capture/File tabs remain behaviorally unchanged.

No screenshot-only assertion satisfies a contract that can be asserted through
state, accessible role/name, visible content, callback evidence, and exact tab
count/identity.

## 11. Verification Commands And Pass Criteria

Run from `fusion-studio-client/` unless stated otherwise.

### Slice checks

Use exact focused commands discovered from the current `package.json` and test
configuration. At minimum:

```bash
npx playwright test e2e/component-tab-domain.spec.ts --project=chromium --workers=1
npx playwright test e2e/component-tab-presentation-domain.spec.ts --project=chromium --workers=1
npx playwright test e2e/component-tab-host.spec.ts --project=chromium --workers=1
npx playwright test e2e/component-tab-panel.spec.ts --project=chromium --workers=1
npx playwright test e2e/component-tab-shell-panel.spec.ts --project=chromium --workers=1
```

If placement coverage is placed in a new `component-tab-placement.spec.ts`, run
that file explicitly. The worker must record the exact commands and counts;
equivalent supported package scripts are acceptable when they execute the same
tests.

### Final client gates

```bash
npx tsc -b --pretty false
npx eslint <every changed TypeScript/TSX/test path>
npm run build
git diff --check
```

Also run the focused current production regression tests:

```bash
npx playwright test e2e/view-tab-contract.spec.ts --project=chromium --workers=1
npx playwright test e2e/view-tab-runtime.spec.ts --project=chromium --workers=1
npx playwright test e2e/file-viewer-tabs.spec.ts --project=chromium --workers=1
npx playwright test e2e/view-tab-path-events.spec.ts --project=chromium --workers=1
npx playwright test e2e/captures-archive.spec.ts --project=chromium --workers=1
npx playwright test e2e/clipboard-capture.spec.ts --project=chromium --workers=1
```

`e2e/view-tab-runtime.spec.ts` is a recorded diagnostic, not an unconditional
zero-exit gate in the current checkout. Its accepted TABS-02A evidence records a
pre-route failure from absent `Capture-A.md` fixture state and a following File
skip. Run it only when a hermetic fixture is available or record that exact
known limitation; repairing persisted/live fixture state is outside TABS-03.
Any different failure that reaches a changed TABS-03 route is a blocker.

### Pass criteria

- every required scenario and failure branch has a deterministic assertion;
- all required blocking focused/regression commands exit zero with recorded
  counts; the explicitly diagnostic `view-tab-runtime.spec.ts` follows its
  separate expected-outcome rule above;
- typecheck, lint, build, and diff checks exit zero;
- no raw exception/path data appears in user-visible or result payloads;
- no production adapter, server, UEB, provenance, persistence, or Chat path is
  modified without a recorded material deviation and owner approval; and
- a fresh final public-path smoke demonstrates fill, append, dedupe/activate,
  and safe failure in one mounted host.

Electron launch is not required because TABS-03 has no production adopter. If a
worker changes a production adapter despite scope, the relevant Electron/manual
smoke becomes mandatory and the change is a material deviation.

## 12. Final SPEC Integration Criteria

TABS-03 is implementation-complete only when:

1. Slices 1–3 are individually clean under the lifecycle in
   `IMPLEMENTATION-GUIDANCE.md`.
2. One exported typed controller route covers all tested sources.
3. The normative algorithm and B01–B20 invariants are proven through the public
   host plus focused pure tests.
4. The accepted TABS-01/TABS-02A lifecycle, presentation, error containment, and
   current production adapter behavior remain green.
5. The orchestrator records exact changed paths, commands, counts, deviations,
   residual risks, and a reproducible aggregate fingerprint for relevant bytes.
6. Fresh orchestrator-owned clean-room review reaches its first materially clean
   pass after all repairs.
7. The final report explicitly exports to BRIDGE-01:
   - validated `requestId`, `tabId`, `componentTypeId`, `componentInstanceId`,
     `presenterId`, and `targetKey` context;
   - the one controller/result chokepoint;
   - the fact that no timestamp, actor, permission, or provenance authority was
     created; and
   - all implementation deviations and downstream consequences.
8. The implementation supervisor presents the result to the owner and receives
   explicit acceptance before any dependent SPEC begins.

## 13. Downstream Contracts

### BRIDGE-01

BRIDGE-01 may wrap accepted placement requests/results with validated actor,
container/component/presenter/resource context, authoritative server time,
action admission, and provenance publication. It must not move tab-placement
authority into UEB subscribers or treat tab identity as actor/permission/causal
proof.

### Production view adopters

Each future view SPEC supplies its code-owned presenter mapping, stable target
key, resolved component input, tab identity projection, breadcrumb policy,
preview behavior, and resource/live-refresh contract. It calls TABS-03 instead
of reproducing target matching or current/new placement locally.

### Persistence and control plane

Later persistence may serialize validated component and presentation state; a
later DB-authoritative control plane may register permitted components and
schemas. Neither may allow caller-controlled tab/component instance identities
or display strings to become placement authority.

## 14. No Open Decisions Inside This SPEC

All behavior needed to implement TABS-03 is fixed by the authorities and
decisions above. TABS-02A is owner-accepted; the refreshed clean-room verdict
and exact TABS-03 candidate approval are the remaining dispatch gates, not
undefined product behavior.
