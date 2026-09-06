# Universal Tab Header and Location Rail — Orchestrator Report

**Status:** `OWNER-ACCEPTED — UNCOMMITTED`

**Report date:** 2026-09-04

**Package:** `TABS-02A`

**SPEC:** `UNIVERSAL_TAB_HEADER_AND_LOCATION_RAIL_SPEC.md`

**Repository:** `/Users/rccurtrightjr./projects/fs-dev`

**Branch:** `agent/exact-workspace-paths`

**Baseline HEAD:** `9f89aea4d300b0f48ffdcbce2895fb6351c06464`

**Dispatch approval:** The owner directly instructed this session to run the
approved SPEC as a Spec Orchestrator and will manually hand the finished work
to another session. This is implementation authorization, not final owner
acceptance of the result.

**Commit/push status:** No commit or push was performed. The implementation and
this report remain mutable working-tree changes.

## Outcome

TABS-02A is implemented on the exact owner-accepted TABS-01/TABS-02 dependency
bytes. All three slices passed fresh builder review and orchestrator acceptance
on their final applicable candidates. Four successive whole-SPEC clean-room
reviews were used fail-forward: the first three found material defects, each
was repaired and re-reviewed, and the fourth returned `CLEAN` on the current
candidate.

The accepted role-specific Home/Content shell contract is replaced by one
universal model:

- one valid tab renders a centered descriptor identity;
- two or more valid tabs render the ordinary tab strip;
- every valid active tab renders an ordered location rail;
- optional Back/Forward capabilities are exact and active-tab-correlated;
- Empty and component bodies retain the accepted lifecycle beneath the chrome;
- malformed shell/navigation data is inert, while malformed component bodies
  retain valid correlated chrome and authorized tab management;
- presenter render/lifecycle errors are contained inside the body and expose
  only a fixed product-safe caught-error diagnostic; and
- no production view adopts the contract in this package.

## Dispatch baseline and candidate identity

The normative pre-edit dependency fingerprint was run before editing and
matched exactly:

```text
605fa50b7300b5c06f8b16a782d608d6af17331aa59aa6e9f552007c742b9721
```

That proves dispatch began from the owner-accepted, uncommitted TABS-02 package
recorded by the prerequisite report.

The final post-implementation fingerprint below is informational provenance,
not a substitute for the behavioral gates. It was computed from
`fusion-studio-client/` with these exact client-relative paths and order:

```text
src/main.tsx
src/reactRootErrorPolicy.ts
src/components/view-tabs/componentTabPresentationDomain.ts
src/components/view-tabs/componentTabPresentationValidation.ts
src/components/view-tabs/PresenterErrorBoundary.tsx
src/components/view-tabs/ComponentTabPanel.tsx
src/components/view-tabs/SingleTabIdentity.tsx
src/components/view-tabs/TabLocationRail.tsx
src/components/view-tabs/ComponentTabShellPanel.tsx
src/components/view-tabs/componentTabShell.css
src/components/view-tabs/componentTabDomain.ts
src/components/view-tabs/viewTabDomIds.ts
src/components/view-tabs/ViewTabBar.css
src/components/view-tabs/viewTabContentAdapter.ts
src/components/view-tabs/ViewTabBar.tsx
src/components/view-tabs/ViewTabStrip.tsx
e2e/component-tab-panel.spec.ts
e2e/component-tab-presentation-domain.spec.ts
e2e/component-tab-shell-panel.spec.ts
e2e/component-tab-host.spec.ts
e2e/view-tab-contract.spec.ts
e2e/file-viewer-tabs.spec.ts
```

Command shape:

```bash
for file in "${paths[@]}"; do
  shasum -a 256 "$file"
done | shasum -a 256
```

Final 22-path client-relative aggregate:

```text
f91b7cb7eb6263040c39c1931fbeef401c68c98e4157476c32eb6636f2210a35
```

Because `shasum` includes path text in its output, repository-root-relative
path prefixes produce a different aggregate for identical bytes. All recorded
slice hashes therefore state their working-directory/path basis.

## Delivered behavior

- Exact version-2 shell projection with explicit `tabId`, nullable
  `presenterId`, and version-1 ordered location projection.
- Exact one-to-512 segment breadcrumb contract with 1,024-byte UTF-8 labels,
  well-formed Unicode, C0/C1 rejection, and canonical deep cloning.
- Fail-closed rejection of unknown, symbol, accessor, inherited,
  custom-prototype, sparse, executable, excessive, and version-mismatched data
  without invoking supplied getters or callbacks.
- Only `legacy | single | tabbed | invalid` derived modes; no Home/Content roles
  or role-specific layout modes remain in the public surface.
- Empty requires `presenterId: null`; component content requires an explicit
  non-null presenter ID.
- Universal centered one-tab identity using the existing descriptor icon,
  label, add/close actions, accessibility metadata, and focus recovery.
- Universal 54px location rail beneath the 36px identity/tab row, with matching
  shell backgrounds, ordered semantic breadcrumbs, complete accessible/hover
  text, and final-segment overflow priority.
- Optional correlated Back/Forward controls that remain present while supported,
  disable independently, invoke once, and never own history or destinations.
- One connected render snapshot for active identity, location, navigation, and
  body. Test-owned target-changing navigation commits `targetKey`, revision,
  and location together and exposes no intermediate mixed DOM state.
- Stable presenter mounting across one-to-many and many-to-one layout-only
  changes; activating another tab retains active-only unmount/remount behavior.
- Valid chrome and descriptor-authorized add/close behavior remain around
  unavailable, invalid, unsupported, accessor-backed, non-enumerable, disabled,
  resolver-error, descendant-render-error, and lifecycle-error bodies.
- A body-scoped React error boundary renders generic unavailable copy and resets
  only when validated body identity changes, not for shell mode, cardinality,
  breadcrumb, descriptor label, or navigation changes.
- React 19 caught errors use a fixed generic root report. Supplied Error objects,
  messages, paths, stacks, and component info are not accepted or forwarded.
  Uncaught failures retain the default `pageerror` behavior.
- Capture and File remain non-adopters. No production store, persistence owner,
  server route, WebSocket message, SQLite migration, UEB fact, path policy,
  view-config reader, plugin behavior, Chat behavior, or target-placement action
  was added.

## Implementation inventory

Inventory is relative to the exact accepted TABS-02 dispatch bytes.

### Added production files

- `fusion-studio-client/src/reactRootErrorPolicy.ts`
- `fusion-studio-client/src/components/view-tabs/PresenterErrorBoundary.tsx`
- `fusion-studio-client/src/components/view-tabs/SingleTabIdentity.tsx`
- `fusion-studio-client/src/components/view-tabs/TabLocationRail.tsx`

### Removed superseded production files

- `fusion-studio-client/src/components/view-tabs/CenteredHomeIdentity.tsx`
- `fusion-studio-client/src/components/view-tabs/ContentLocationRail.tsx`

### Replaced or modified production files

- `fusion-studio-client/src/main.tsx`
- `fusion-studio-client/src/components/view-tabs/componentTabPresentationDomain.ts`
- `fusion-studio-client/src/components/view-tabs/componentTabPresentationValidation.ts`
- `fusion-studio-client/src/components/view-tabs/ComponentTabPanel.tsx`
- `fusion-studio-client/src/components/view-tabs/ComponentTabShellPanel.tsx`
- `fusion-studio-client/src/components/view-tabs/componentTabShell.css`
- `fusion-studio-client/src/components/view-tabs/componentTabDomain.ts`
- `fusion-studio-client/src/components/view-tabs/viewTabDomIds.ts`
- `fusion-studio-client/src/components/view-tabs/ViewTabBar.css`
- `fusion-studio-client/src/components/view-tabs/viewTabContentAdapter.ts`
- `fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx`
- `fusion-studio-client/src/components/view-tabs/ViewTabStrip.tsx`

### Tests added or updated

- `fusion-studio-client/e2e/component-tab-panel.spec.ts`
- `fusion-studio-client/e2e/component-tab-presentation-domain.spec.ts`
- `fusion-studio-client/e2e/component-tab-shell-panel.spec.ts`
- `fusion-studio-client/e2e/component-tab-host.spec.ts`
- `fusion-studio-client/e2e/view-tab-contract.spec.ts`
- `fusion-studio-client/e2e/file-viewer-tabs.spec.ts`

`viewTabAdapters.ts` was inspected and remains unchanged. Existing Capture and
File adapters still supply neither the corrected shell nor navigation data.
Unrelated dirty-worktree changes were preserved.

## Orchestration and review ledger

### Slice 1 — Corrective v2 presentation domain

- Builder: `/root/tabs_02a_slice_1`
- Builder review: `/root/tabs_02a_slice_1/slice1_builder_gate_1` — `CLEAN`
- Orchestrator acceptance: `/root/tabs_02a_slice_1_acceptance` — `CLEAN`
- Client-relative four-path aggregate:
  `8772db42fd62dbd7e966b23ed28cec3fed853f2bdd6ae6f5804c33ce0c8d389d`
- The intermediate full typecheck failure was expected downstream invalidation
  of role-specific Slice 2/3 callers and was fully resolved by later slices.

### Slice 2 — Universal portable shell and presenter containment

- Builder: `/root/tabs_02a_slice_2`
- Initial builder review:
  `/root/tabs_02a_slice_2/slice2_builder_gate_1` — `CLEAN`
- Initial orchestrator acceptance:
  `/root/tabs_02a_slice_2_acceptance` — `CLEAN`
- Later final integration invalidated that candidate because descendant React
  presenter errors could escape the synchronous resolver-render catch.
- Repair added `PresenterErrorBoundary` and strengthened `ComponentTabPanel`.
- Builder review:
  `/root/tabs_02a_slice_2/slice2_builder_gate_2` — `CLEAN`
- Orchestrator acceptance:
  `/root/tabs_02a_slice_2_acceptance_2` — `REPAIR_REQUIRED`
  - React 19's default root `onCaughtError` still wrote the original private
    Error/message/stack to the console.
- Repair added the fixed root caught-error policy and console/privacy coverage.
- Fresh builder review:
  `/root/tabs_02a_slice_2/slice2_builder_gate_3` — `CLEAN`
- Fresh orchestrator acceptance:
  `/root/tabs_02a_slice_2_acceptance_3` — `CLEAN`
- A later Slice 3 repair aligned `ComponentTabShellPanel`'s duplicate shallow
  lifecycle reader. Fresh adjacent Slice 2 acceptance:
  `/root/tabs_02a_slice_2_acceptance_4` — `CLEAN`
- Final relevant client-relative 13-path pre-alignment aggregate:
  `bafe68f75fbb8e70317d70b464cb9ff4fb58ca70f60533d2c43e0c33ddd317e7`.
  The final whole-package hash supersedes it after the adjacent alignment.

### Slice 3 — Strict connected seam and public-route proof

- Builder: `/root/tabs_02a_slice_3`
- Builder review:
  `/root/tabs_02a_slice_3/slice3_builder_gate_1` — `CLEAN`
- Orchestrator acceptance:
  `/root/tabs_02a_slice_3_acceptance` — `CLEAN`
- Final review 1 invalidated that candidate with two findings:
  - valid chrome/management was lost around invalid and unsupported nested
    component bodies;
  - the public route did not prove atomic canonical target/location commits.
- Repaired builder review:
  `/root/tabs_02a_slice_3/slice3_builder_gate_2` — `CLEAN`
- Repaired orchestrator acceptance:
  `/root/tabs_02a_slice_3_acceptance_2` — `CLEAN`
- Final review 2 invalidated downstream proof after discovering descendant
  presenter errors were not contained.
- Refreshed builder review:
  `/root/tabs_02a_slice_3/slice3_builder_gate_3` — `CLEAN`
- Refreshed orchestrator acceptance:
  `/root/tabs_02a_slice_3_acceptance_3` — `CLEAN`
- Final review 3 invalidated the candidate because accessor-backed and
  non-enumerable component slots lost otherwise valid chrome.
- Repair aligned connected and portable shallow lifecycle readers while leaving
  full body validation strict.
- Final builder review:
  `/root/tabs_02a_slice_3/slice3_builder_gate_4` — `CLEAN`
- Fresh adjacent Slice 2 acceptance:
  `/root/tabs_02a_slice_2_acceptance_4` — `CLEAN`
- Final Slice 3 acceptance:
  `/root/tabs_02a_slice_3_acceptance_4` — `CLEAN`
- Final six-path client-relative aggregate:
  `1649084373c00634c0ae7b258158762e97b4083450cb1d327752b518ccec2237`

### Whole-SPEC final integration

- `/root/tabs_02a_final_review` — `REPAIR_REQUIRED`
  - Found invalid/unsupported nested bodies suppressing valid chrome and inert
    management, and missing B17 atomic target/location proof.
- `/root/tabs_02a_final_review_2` — `REPAIR_REQUIRED`
  - Found descendant presenter render errors collapsing the shell and exposing
    raw error text.
- `/root/tabs_02a_final_review_3` — `REPAIR_REQUIRED`
  - Found accessor-backed component slots suppressing valid chrome despite zero
    getter execution.
- `/root/tabs_02a_final_review_4` — `CLEAN`
  - Reproduced the final 22-path digest, reran the 79-test matrix, and found no
    material issue across B1-B30, all slice exits, Definition of Done, privacy,
    accessibility, portability, identity, lifecycle, and ownership boundaries.

Every clean result invalidated by a later material finding is explicitly marked
above. Each repair received fresh builder review where applicable, fresh
orchestrator acceptance, and a fresh whole-SPEC review.

## Final verification evidence

All client commands were run from `fusion-studio-client/`.

### Integrated Chromium matrix

```text
npx playwright test \
  e2e/component-tab-domain.spec.ts \
  e2e/component-tab-panel.spec.ts \
  e2e/component-tab-presentation-domain.spec.ts \
  e2e/component-tab-shell-panel.spec.ts \
  e2e/component-tab-host.spec.ts \
  e2e/view-tab-contract.spec.ts \
  e2e/view-tab-path-events.spec.ts \
  e2e/captures-archive.spec.ts \
  e2e/clipboard-capture.spec.ts \
  e2e/file-viewer-tabs.spec.ts \
  --project=chromium --workers=1

79 passed
```

The final orchestrator reran this exact matrix on the report candidate. Coverage
includes the real `ViewTabBar` route, one/many layouts, Empty fill, target and
location atomicity, invalid/unsupported/accessor/non-enumerable bodies,
malformed shell/navigation inputs, descendant render/lifecycle errors, React
console privacy, focus/ARIA/mount continuity, and Capture/File regressions.

### Static and build gates

- `npx tsc -b --pretty false` — passed.
- Targeted ESLint over the 20 TypeScript/TSX/test candidate paths — passed.
- `npm run build` — passed; 1,862 modules transformed.
- `git diff --check` — passed.
- Stale Home/Content role/class/symbol sweeps — clean except intentional negative
  test patterns.
- Portability, production-adoption, store, persistence, server, protocol, UEB,
  path-policy, plugin, and Chat scope sweeps — clean.
- Expected existing notices only: Playwright `NO_COLOR`/`FORCE_COLOR`, injected
  Capture/clipboard diagnostics in passing regression cases, `gray-matter`
  `eval`, and Vite large-chunk warnings.

### Evidence limitations and authorized deferrals

`e2e/view-tab-runtime.spec.ts` was attempted. Its Capture case fails before the
changed route because the required `Capture-A.md` live fixture is absent; the
serial File case then skips. Builders and independent reviewers reproduced and
classified this as a live-fixture/persisted-state limitation, not a candidate
defect. Deterministic Capture/File and public-route regressions pass in the
79-test matrix.

Electron visual, non-Chromium, and manual assistive-technology validation remain
SPEC-authorized deferrals because this package intentionally creates no
production adopter. The first production adopter must run them. Server tests
were not required because no server or protocol surface changed.

## Deviation ledger

All deviations were independently reviewed and accepted as compatible. No
deviation requires correction to TABS-03 or another downstream SPEC.

### D1 — Universal focus helper integration

- `viewTabDomIds.ts` and `ViewTabStrip.tsx` use the universal single-identity
  target for close/add focus recovery.
- Effect is limited to preserving the accepted focus contract after removal of
  the role-specific centered-Home identity.
- Classification: accepted necessary integration.

### D2 — Shared rail-height token

- `ViewTabBar.css` exposes `--view-tab-rail-height` with a 36px fallback and
  border-box geometry shared by ordinary and single identity rows.
- Computed 36px/54px geometry is rendered-test verified.
- Classification: accepted compatible styling integration.

### D3 — Body-scoped presenter containment

- `PresenterErrorBoundary.tsx` was added and the accepted Generic Host's
  `ComponentTabPanel.tsx` was strengthened so descendant React render/lifecycle
  errors cannot collapse the shell.
- Reset identity uses validated tab/content/component/target/resolution facts,
  not display location, shell mode, cardinality, or navigation.
- This strictly strengthens prerequisite failure privacy without changing the
  resolver or lifecycle contract.
- Classification: accepted necessary B25 integration.

### D4 — React root caught-error privacy policy

- `main.tsx` supplies `reactRootErrorOptions` from
  `reactRootErrorPolicy.ts` because React 19 otherwise logs the original caught
  Error and stack even when a boundary handles it.
- The callback accepts no Error/info parameters and emits only fixed generic
  text. Uncaught and recoverable handlers are not overridden.
- Scope is root-wide for errors already caught by React boundaries. The current
  app has no other production boundary; future diagnostic policy must preserve
  the privacy guarantee.
- Classification: accepted necessary privacy integration.

### D5 — Opaque nested component slot for shallow lifecycle derivation

- Connected and portable shallow lifecycle readers validate exact safe outer
  facts but inspect only the required own `component` slot's presence.
- Accessor/non-enumerable nested bodies retain valid shell chrome without being
  read. Full `ComponentTabPanel` validation still rejects them and invokes no
  getter, resolver, render, or supplied callback.
- Classification: accepted necessary B25 correction.

### D6 — Test-owned connected adapter/controller

- `component-tab-host.spec.ts` expands the existing Vite virtual owner to prove
  v2 shell/navigation, atomic target/location commits, invalid body envelopes,
  descendant presenter failure, React caught-error policy, and recovery through
  the real `ViewTabBar` route.
- Effect is test-only; no production view, store, history engine, or sanitizer
  was added by the harness.
- Removal criterion: replace only when a canonical rendered public-route harness
  provides equivalent coverage.
- Classification: accepted necessary test integration.

### D7 — File geometry and v2 ARIA oracle updates

- `file-viewer-tabs.spec.ts` recognizes the accepted tokenized 36px shared rail
  while retaining the Browser rail's literal expectation.
- `view-tab-contract.spec.ts` recognizes universal single versus ordinary
  tabbed labeling targets.
- Both are test-only corrections to superseded static expectations.
- Classification: accepted compatible test integration.

## Downstream impact and residual risk

- TABS-03 may consume the corrected v2 contract and explicit
  `presenterId + targetKey`. It must not use tab labels, breadcrumbs, paths,
  extensions, icons, or presenter labels as canonical target match keys.
- A production owner that changes represented target must publish canonical
  `targetKey` and display location together in one state snapshot.
- No downstream SPEC correction is required by this implementation.
- No temporary production adapter or compatibility alias exists.
- The test harness has minor maintenance coupling to locked React 19.2.4 retry
  behavior and the optional connected seam. This is advisory only.
- The working tree contains unrelated owner changes and accepted uncommitted
  prerequisite work. All were preserved. Until committed, the final digest—not
  repository HEAD—identifies the reviewed candidate bytes.
- First production adoption must repeat Electron visual, cross-browser, manual
  assistive-technology, and relevant live-runtime validation.

## Handoff state

Implementation is complete. RC explicitly accepted the reviewed candidate on
2026-09-04 after independent verification reproduced its fingerprint and passed
the integrated Chromium matrix, TypeScript, targeted lint, production build,
and diff check. Acceptance does not claim commit, push, Alpha sync, packaging,
installation, or restart.
