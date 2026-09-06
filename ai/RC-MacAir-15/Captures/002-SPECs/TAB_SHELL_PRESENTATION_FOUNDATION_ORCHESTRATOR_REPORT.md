# Tab Shell Presentation Foundation — Orchestrator Report

**Status:** `OWNER_ACCEPTED — UNCOMMITTED`

**Report date:** 2026-09-04

**Dispatch approval:** The owner directly instructed this session to implement
`TAB_SHELL_PRESENTATION_FOUNDATION_SPEC.md` as a SPEC orchestrator without a
Roadmap Implementation Supervisor. This is implementation authorization, not
final owner acceptance of the result.

**Owner acceptance:** Accepted by RC on 2026-09-04 after an independent owner
review reran the 68-test integrated gate, TypeScript, targeted lint, production
build, and `git diff --check`. RC explicitly treated the aggregate-fingerprint
discrepancy described below as bookkeeping rather than a product or acceptance
failure.

**SPEC:** `TAB_SHELL_PRESENTATION_FOUNDATION_SPEC.md`

**Repository:** `/Users/rccurtrightjr./projects/fs-dev`

**Branch:** `agent/exact-workspace-paths`

**Baseline HEAD:** `9f89aea4d300b0f48ffdcbce2895fb6351c06464`

**Commit/push status:** No commit or push was performed. The implementation and
this report remain owner-accepted working-tree changes.

## Outcome

The approved Tab Shell Presentation Foundation behavior is implemented and has
passed slice-level builder review, fresh orchestrator acceptance for every
slice, cumulative integration verification, and a fresh whole-SPEC clean-room
review.

The result extends the accepted Generic Component Tab Host with an optional,
exact, versioned shell presentation projection. Home and Content are
presentation roles; Empty remains the accepted lifecycle state; centered Home
is derived from the active role and collection shape rather than stored. A
test-owned connected adapter proves the real shell route while production
Capture, File, Chat, and other view adapters remain unchanged.

## Delivered behavior

- Exact, bounded, versioned Home/Content presentation and Content Location/Path
  contracts with explicit presenter identity.
- Strict canonical validation that rejects unknown keys, symbols, accessors,
  inherited/custom prototypes, executable values, invalid Unicode, invalid
  correlations, unsupported versions, and over-limit data without executing
  supplied accessors or callbacks.
- Pure shell-mode derivation for `legacy`, `centered-home`, `tabbed-home`,
  `tabbed-content`, `tabbed-empty`, and `invalid`.
- A centered single-Home identity composed from the active tab descriptor's
  icon, label, add action, close metadata, and deterministic accessible target.
- A common display-only Content Location and Path rail rendered before the
  presenter body.
- The accepted Empty picker beneath a visible tab rail, including when Empty is
  the sole tab.
- Exactly one active `tabpanel`, with a live centered or tabbed label target and
  no nested tablist/tabpanel semantics.
- Stable Home presenter mounting and resolver identity while the rail appears
  or disappears with Home still active.
- Returned-ID and null add-focus behavior, rail-to-centered close recovery,
  centered close recovery, content fallback, and preservation of deliberate
  owner-directed outside focus.
- Valid shell chrome retained around unavailable, disabled, invalid, and
  version-unsupported presenter bodies.
- Presence-sensitive compatibility: an absent `shell` property preserves the
  accepted Generic Host; a present-invalid shell is inert, product-safe, and
  never falls through to legacy children.
- No production adopter, state mirror, persistence owner, backend route,
  WebSocket message, UEB fact, filesystem authority, plugin discovery, dynamic
  registry, view-configuration reader, or target-placement controller.

## Candidate identity and prerequisite provenance

The prerequisite Generic Component Tab Host was owner-accepted but uncommitted
when this SPEC was dispatched. Therefore there is no honest commit hash that
contains the accepted prerequisite implementation.

- Repository HEAD at dispatch:
  `9f89aea4d300b0f48ffdcbce2895fb6351c06464`
- Exact Generic Host dispatch snapshot:
  `/tmp/tab-shell-baseline.IpIqQ0`
- Generic Host snapshot fingerprint:
  `7ef0e2dfd519eb9a7c7e0648136231d46386849cf53836a46dd3c9d3e7ed8da6`
- Accepted Slice 1 fingerprint:
  `7b8e2b3cd314523cf010be7982df91d99ed26846d4693cae7a7bd58108d105ba`
- Accepted Slice 2 candidate fingerprint:
  `a2b264498655f88293adeef552ad28075709bf5c09611641f62439ce94122be1`
- Accepted Slice 2 full-surface snapshot:
  `/tmp/tab-shell-slice2.lTELDq`
- Slice 2 full-surface fingerprint:
  `57887603e0439b67d63e6c62d8febceeaa4f72b7499f71879af4c475575f55f1`
- Accepted Slice 3 fingerprint:
  `e2f85b26431ddae101ed82f266318e2627adf886fd4704a599226b78fbca805c`
- Corrected owner-verification whole-SPEC 16-file fingerprint:
  `605fa50b7300b5c06f8b16a782d608d6af17331aa59aa6e9f552007c742b9721`
- Original orchestrator-run aggregate retained for provenance:
  `9657539b7d3856fd5fe9a96db66444cc601845ceb74f915868ae977c9d7586b5`

The corrected whole-SPEC fingerprint is the SHA-256 of the ordered
`shasum -a 256` output for the 16 repository-relative paths listed below, in
inventory order. Owner review could not reproduce the original aggregate
because the original command's exact path spelling/order was not preserved.
All 16 files predated the report, and the complete behavioral and static gates
passed again. RC explicitly accepted the current working-tree implementation;
the corrected aggregate identifies those accepted bytes until commit.

## Implementation inventory

Inventory is relative to the exact accepted Generic Host dispatch snapshot.

### New production files

- `fusion-studio-client/src/components/view-tabs/componentTabPresentationDomain.ts`
- `fusion-studio-client/src/components/view-tabs/componentTabPresentationValidation.ts`
- `fusion-studio-client/src/components/view-tabs/CenteredHomeIdentity.tsx`
- `fusion-studio-client/src/components/view-tabs/ContentLocationRail.tsx`
- `fusion-studio-client/src/components/view-tabs/ComponentTabShellPanel.tsx`
- `fusion-studio-client/src/components/view-tabs/componentTabShell.css`

### Modified production files

- `fusion-studio-client/src/components/view-tabs/componentTabDomain.ts`
- `fusion-studio-client/src/components/view-tabs/viewTabDomIds.ts`
- `fusion-studio-client/src/components/view-tabs/ViewTabBar.css`
- `fusion-studio-client/src/components/view-tabs/viewTabContentAdapter.ts`
- `fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx`
- `fusion-studio-client/src/components/view-tabs/ViewTabStrip.tsx`

### New tests

- `fusion-studio-client/e2e/component-tab-presentation-domain.spec.ts`
- `fusion-studio-client/e2e/component-tab-shell-panel.spec.ts`

### Modified tests

- `fusion-studio-client/e2e/component-tab-host.spec.ts`
- `fusion-studio-client/e2e/view-tab-contract.spec.ts`

### Protected prerequisite and production surfaces

- Generic Host descriptor, lifecycle, validation, resolver, portable panel,
  Empty panel, and their focused tests remain byte-identical to the exact
  dispatch snapshot except for the declared public barrel integration.
- `viewTabAdapters.ts` remains byte-identical to the accepted Slice 2 snapshot;
  SHA-256:
  `71faaff9a1eebafc72530e83fc224ecd2c61d286dd305f524fdbb319b3320ec7`.
- Existing Capture and File adapters do not supply `shell`.
- No server, SQLite, protocol, persistence, store, UEB, Chat, plugin,
  view-capsule, or Alpha implementation was changed for this SPEC.

## Orchestration and review ledger

### Slice 1 — Presentation contract, validation, and pure derivation

- Builder: `/root/tab_shell_slice_1`
- Builder review pass 1:
  `/root/tab_shell_slice_1/slice1_builder_gate_1` — `CLEAN`
- Orchestrator acceptance pass 1:
  `/root/tab_shell_slice_1_acceptance` — `REPAIR_REQUIRED`
  - Found that `TextEncoder` replaces lone UTF-16 surrogates with U+FFFD,
    allowing malformed source text through the earlier byte-bound check.
  - Repaired by rejecting unmatched high and low surrogates before UTF-8 byte
    counting while retaining valid surrogate pairs.
- Fresh repaired builder review:
  `/root/tab_shell_slice_1/slice1_builder_gate_2` — `CLEAN`
- Fresh repaired orchestrator acceptance:
  `/root/tab_shell_slice_1_acceptance_2` — `CLEAN`

### Slice 2 — Portable shell presentation and styling

- Builder: `/root/tab_shell_slice_2`
- Builder review pass 1:
  `/root/tab_shell_slice_2/slice2_builder_gate_1` — `CLEAN`
- Orchestrator acceptance pass 1:
  `/root/tab_shell_slice_2_acceptance` — `REPAIR_REQUIRED`
  - Found that the centered tabpanel label target included the close button,
    yielding an accessible name such as `Capture Home Close Capture Home`.
  - Repaired by placing the deterministic ID and focus target on the label-only
    span while keeping the icon decorative and close control separate.
- Fresh repaired builder review:
  `/root/tab_shell_slice_2/slice2_builder_gate_2` — `CLEAN`
- Fresh repaired orchestrator acceptance:
  `/root/tab_shell_slice_2_acceptance_2` — `CLEAN`

### Slice 3 — Optional connected seam and full-route proof

- Builder: `/root/tab_shell_slice_3`
- Builder review pass 1:
  `/root/tab_shell_slice_3/slice3_builder_gate_1` — `CLEAN`
- The builder's subsequent validation found an opted-in invalid shell with no
  matching active rail descriptor could still reach component resolution.
  That clean result was invalidated.
- Repair: opted-in invalid state now supplies no active component, remains
  safely labeled, and renders the inert unavailable body without resolving.
  A briefly over-broad guard that changed shell-absent Generic Host
  `version_unsupported` behavior was narrowed to opted-in invalid shells.
- Fresh repaired builder review:
  `/root/tab_shell_slice_3/slice3_builder_gate_2` — `CLEAN`
- Fresh orchestrator acceptance:
  `/root/tab_shell_slice_3_acceptance` — `CLEAN`

### Final integration

- Reviewer: `/root/tab_shell_final_integration`
- Result: `CLEAN`
- The reviewer independently read the full SPEC, repository instructions,
  routed standards, Tabs/Provenance coordination material, prerequisite
  contracts, current production bytes, test coverage, verification results,
  and full deviation ledger.
- The reviewer found no material issue across B1–B26, privacy, portability,
  accessibility, focus, identity, unavailable-state, or ownership boundaries.

All superseded clean passes are explicitly identified above; every repaired
candidate received a fresh builder review and a fresh orchestrator acceptance
review before advancement.

## Verification evidence

All client commands were run from `fusion-studio-client/` unless stated
otherwise.

### Integrated component-shell and legacy regression gate

```text
npx playwright test \
  e2e/component-tab-domain.spec.ts \
  e2e/component-tab-panel.spec.ts \
  e2e/component-tab-host.spec.ts \
  e2e/component-tab-presentation-domain.spec.ts \
  e2e/component-tab-shell-panel.spec.ts \
  e2e/view-tab-contract.spec.ts \
  e2e/view-tab-path-events.spec.ts \
  e2e/captures-archive.spec.ts \
  e2e/clipboard-capture.spec.ts \
  e2e/file-viewer-tabs.spec.ts \
  --project=chromium --workers=1

68 passed
```

This rendered route exercises the real:

```text
ViewTabBar
  -> optional shell normalization and mode derivation
  -> ViewTabStrip or centered Home identity
  -> ComponentTabShellPanel
  -> ComponentTabPanel / EmptyTabPanel
```

Coverage includes centered → tabbed Empty → tabbed Home → centered; sole
Content and sole Empty; active Home state continuity; unavailable-to-ready
recovery; returned-ID and null add focus; rail and centered close outcomes;
missing active descriptors; exact ARIA relationships; malformed, accessor,
symbol, function, inherited, mismatch, and private-data adversaries; legacy
Generic Host behavior; Capture regressions; and File Viewer regressions.

### Static and build checks

- `npx tsc -b --pretty false` — passed.
- Targeted ESLint over all Slice 3 production/test changes — passed.
- Slice builders and reviewers also linted the Slice 1 and Slice 2 file sets —
  passed.
- `npm run build` — passed; 1,860 modules transformed.
- `git diff --check` — passed.
- Production-adoption sweeps — no component shell adopter found.
- Server/store/Capture/File cross-boundary import sweeps — no forbidden shell
  dependency found.
- Exact `viewTabAdapters.ts` Slice 2 comparison — unchanged.

Expected non-failing output was limited to the Playwright
`NO_COLOR`/`FORCE_COLOR` notice, intentional injected Capture handoff-failure
diagnostics inside passing tests, clipboard smoke output, the existing
`gray-matter` `eval` warning, and the existing Vite large-chunk warning.

### Authorized deferrals and skips

- `e2e/view-tab-runtime.spec.ts` was not used as a blocking gate because its
  required `Capture-A*.md`/`Tab-A-*` fixtures are absent and its File scenario
  assumes reset persisted state not present in this checkout. Equivalent shell,
  legacy, Capture, and File contracts are covered by the passing deterministic
  68-test gate.
- Server tests: not required; there is no server or protocol change.
- Electron visual smoke: deferred by the SPEC because there is no production
  adopter.
- Manual assistive-technology verification: deferred until first production
  adoption.
- Non-Chromium verification: deferred until first production adoption.

## Repair ledger

### R1 — Ill-formed Unicode accepted as display text

- Finding: lone UTF-16 surrogates passed byte counting because `TextEncoder`
  substituted U+FFFD.
- Repair: explicit well-formed Unicode scan before byte counting.
- Proof: lone high/low surrogates reject; 256 `😀` characters at exactly 1,024
  UTF-8 bytes remain valid.
- Downstream effect: stricter valid display projection; no schema or identity
  change.

### R2 — Centered panel name included close-control text

- Finding: the original `aria-labelledby` target wrapped label and close.
- Repair: label-only deterministic target with decorative icon and separate
  close control.
- Proof: exact accessible name remains `Capture Home` in closable,
  close-disabled, and non-closable states.
- Downstream effect: Slice 3 reuses the same target for labeling and focus.

### R3 — Missing active rail descriptor could still resolve opted-in content

- Finding: an invalid derived shell state with no active descriptor could enter
  the generic component body.
- Repair: only opted-in invalid shells null their connected active record;
  the panel uses safe unavailable labeling and does not invoke the resolver.
- Proof: rendered regression plus retained Generic Host
  `version_unsupported` behavior.
- Downstream effect: stronger fail-closed behavior; absent-shell callers remain
  unchanged.

## Deviation and out-of-scope-touch ledger

Every deviation below was reviewed as accepted-compatible. None requires a
downstream SPEC correction.

### D0 — Snapshot-pinned prerequisite instead of an exact prerequisite commit

- SPEC intent: replace the report-only Generic Host dependency with the exact
  commit containing that accepted implementation before dispatch.
- Actual execution: no such commit exists; the prerequisite is owner-accepted
  and uncommitted. Dispatch used an exact read-only snapshot plus SHA-256
  fingerprint and per-slice candidate fingerprints.
- Reason: the owner directly instructed implementation in this checkout before
  committing the accepted prerequisite.
- Observable effect: HEAD alone cannot reproduce the candidate.
- Risk: uncommitted bytes are mutable until committed.
- Mitigation: exact snapshots/fingerprints, protected byte comparisons, full
  review ledger, the corrected owner-verification fingerprint above, and this
  explicit disclosure. The original non-reproducible aggregate is retained as
  run provenance but is not an acceptance gate.
- Downstream impact: commit the accepted Generic Host and this foundation before
  depending on them from another checkout or release branch.
- Classification: owner-authorized execution variance; no false commit identity
  is asserted.

### D1 — Pure contract tests use Playwright under `e2e/`

- SPEC intent: focused pure contract and derivation coverage.
- Actual implementation: unit-style TypeScript cases execute through the
  repository's existing Playwright/Vite infrastructure.
- Reason: the client has no separate unit runner for these modules.
- Observable effect: test placement/runtime only.
- Risk: coupling to the existing test harness.
- Downstream impact: none.
- Classification: accepted compatible repository convention.

### D2 — Public presentation exports in `componentTabDomain.ts`

- SPEC intent: a bounded public presentation contract.
- Actual implementation: the accepted domain barrel re-exports the presentation
  domain and validator.
- Reason: mechanically necessary public integration.
- Observable effect: two new public module exports; lifecycle behavior is
  unchanged.
- Downstream impact: later tab placement can consume the canonical contract.
- Classification: accepted compatible necessary integration.

### D3 — Shared rail CSS-variable exposure

- SPEC intent: centered identity and tab rail use the same icon and typography
  recipes.
- Actual implementation: existing rail literal sizes are exposed through CSS
  variables with identical fallbacks.
- Reason: one shared recipe without copying rail styling.
- Observable effect: no default visual change.
- Risk: minimal token-surface increase.
- Classification: accepted compatible necessary styling integration.

### D4 — Centered identity DOM-ID helper

- SPEC intent: deterministic panel-scoped live label and focus target.
- Actual implementation: `viewTabCenteredIdentityDomId(panelId, tabId)` extends
  existing DOM-ID conventions.
- Reason: prevents duplicated hashing and supplies one accessible/focus target.
- Observable effect: deterministic DOM identity only.
- Classification: accepted compatible necessary accessibility integration.

### D5 — `ViewTabStrip` centered and outside-focus recovery

- SPEC intent: modify `ViewTabStrip` only if mechanically necessary; closing
  back to sole Home must reach the centered target and must not steal deliberate
  owner focus.
- Actual implementation: focus recovery tries the surviving rail tab, then the
  centered identity, then content fallback, while respecting an outside target.
- Observable effect: disappearing rails now recover focus correctly.
- Risk: low; legacy tab/content fallback order remains intact.
- Classification: accepted necessary integration.

### D6 — Existing ARIA regression oracle update

- SPEC intent: centered and tabbed modes use their respective live label
  targets.
- Actual implementation: the former rail-only static assertion now verifies
  centered, tabbed, and safe unavailable labeling.
- Observable effect: test-only correction to predecessor expectations.
- Classification: accepted compatible test update.

### D7 — Existing reactive host harness expanded

- SPEC intent: prove the full route through a test-owned adapter without adding
  a production adopter.
- Actual implementation: the existing virtual Vite adapter/controller in
  `component-tab-host.spec.ts` was extended instead of creating a second
  harness.
- Observable effect: test-only.
- Risk: the harness must evolve if the optional seam changes.
- Removal criterion: replace only when a canonical rendered-component harness
  supplies equivalent public-route coverage.
- Classification: accepted compatible test integration.

### D8 — Transient close-origin element plumbing

- SPEC intent: close focus must recover without overriding intentional owner
  focus.
- Actual implementation: centered close passes its transient originating
  `HTMLElement` to connected recovery code.
- Reason: post-close recovery must distinguish displaced focus from deliberate
  focus movement.
- Observable effect: focus behavior only; the value is never serialized,
  stored, persisted, or exposed as durable adapter state.
- Risk: the presentation callback signature carries a DOM-only detail.
- Downstream impact: none; there is no production adopter.
- Classification: accepted compatible necessary focus provenance.

## Protected dirty-worktree accounting

The repository was dirty before this run. Existing owner changes under `ai/`,
including Capture, roadmap, wiki, state, and theme files, were preserved. The
pre-existing change to
`fusion-studio-client/src/components/search/ViewerSearchFilters.tsx` was also
preserved and is outside this implementation.

The target SPEC and prerequisite report/SPEC were already untracked at
preflight. No database, runtime cache, packaged Alpha checkout, installed Alpha
application, or Alpha user data was changed.

## Residual risks and downstream impact

- No production view adopts the optional shell seam by design. The first real
  adopter must supply its own approved owner/controller and repeat Electron
  visual, manual assistive-technology, and browser coverage appropriate to that
  production path.
- The implementation is not immutable until the prerequisite and this
  foundation are committed.
- `TABS-03` may consume `tabId`, explicit `presenterId`, component `targetKey`,
  Home/Content role, and Content location projection. It must still own target
  matching, placement, activate/reveal/recenter, and Open in Current/New Tab.
- `BRIDGE-01` remains blocked on accepted `TABS-03` plus its provenance
  prerequisites. This SPEC creates no command/provenance chokepoint and emits no
  UEB facts.
- Declarative view adoption, Chat adoption, dynamic registration, permissions,
  persistence, and backend work remain out of scope.
- Coordination status advances from this recorded owner acceptance; commit and
  publication remain separate follow-up operations.

## Owner review disposition

RC accepted the implementation on 2026-09-04, including the deliberate lack of
a production adopter, the compatible deviations and repairs, the authorized
test deferrals, and the corrected aggregate-fingerprint accounting. The
Generic Component Tab Host prerequisite and this foundation remain uncommitted;
commit and publication were not authorized by this acceptance and were not
performed here.
