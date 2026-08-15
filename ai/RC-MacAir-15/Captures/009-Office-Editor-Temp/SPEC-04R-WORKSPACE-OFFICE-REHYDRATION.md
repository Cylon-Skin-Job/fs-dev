# SPEC-04R — Workspace-Bound Office Rehydration

**Status:** `APPROVED`
**Recovery candidate:** `OE-009-RECOVERY-RC1`
**Repairs:** invalidated SPEC-04 execution
**Depends on:** SPEC-03 accepted for sequencing; original SPEC-04 implementation present

## Objective

Make every settled workspace switch load the target workspace's Office panel data even when `office-viewer` remains mounted and the panel/folder IDs are unchanged. Then rerun the entire original SPEC-04 contract so its dormant palette read/watch foundation can be reaccepted on an integrated candidate.

## Authoritative Builder Inputs

This is one composite released SPEC under `RECOVERY-ROADMAP.md`'s bounded builder-input amendment. Every orchestrator and slice builder must receive and read:

1. this recovery member;
2. `SPEC-04-WORKSPACE-CUSTOM-COLORS.md` in full; and
3. `GUIDANCE.md` in full.

The original SPEC-04 text is not preparation evidence; it is the complete unchanged product contract for this recovery. This file controls only runtime quarantine, workspace rehydration, additional regression coverage, and reacceptance. No other roadmap/history artifact may be used to invent product behavior.

## Confirmed Failure and Earliest Cause

The isolated valid run completed A → B → C, then C → A changed the workspace label but left Office indefinitely at `Loading files...`. The server stayed connected and palette reads continued.

The current client clears the global file-data cache during `workspace:switched`. `OfficeGrid` obtains its directory through `useFolderFiles(panel, folder)`, and that hook's request effect does not depend on active workspace identity or a cache generation. If the Office panel remains mounted and its folder is still `''`, the cache becomes empty but no new tree request is sent. Clicking Home preserves the same inputs and cannot recover.

This packet treats the `set_panel` log's `rootFolder:null` as expected under the existing client message shape unless implementation evidence proves otherwise. The repair must target the first missing re-request/correlation invariant and may not add an unnecessary server path protocol.

## Unaccepted SPEC-05 Runtime Quarantine

The dirty integrated worktree already contains unaccepted SPEC-05 Slice 05.1/05.2 files, and current `startup.js` starts the sync coordinator before the config watcher. That activation is incompatible with a real SPEC-04 dormant zero-write reacceptance: divergent valid `sync_enabled:true` configs can be converged at startup or after a watch event even though the active picker has not cut over.

Before any 04R acceptance evidence, quarantine only that runtime activation:

- remove the startup call that constructs/starts `startRuntimePaletteSyncCoordinator`;
- start the accepted SPEC-04 config watcher without a coordinator, so validated read/watch state still works but cannot fan out writes;
- preserve all unaccepted coordinator/model/journal source and tests byte-for-byte except for independently necessary merge accommodation; do not delete, revert, or represent them as accepted;
- do not add a production feature flag, environment escape hatch, test-only branch, or second watcher;
- SPEC-05R explicitly owns restoring coordinator activation on its changed candidate before its own integration gate.

Add an isolated `dormant-divergent-true` palette variant: A and B are distinct canonical valid `sync_enabled:true` configs and C is canonical valid false. On launch, workspace cycles, and one external valid replacement, only the externally replaced file may change; no startup/watch fanout is permitted. Dormant projections must update correctly and all untouched hashes must remain exact.

## Behavioral Contract

### Target-workspace rehydration

- A settled switch to workspace W establishes a new workspace data generation before filesystem-backed views consume cached trees/content.
- Every mounted filesystem-backed consumer whose current cache is cleared must issue or receive exactly one effective target-generation request for its active directory. Correctness may not depend on the view unmounting.
- `office-viewer` at Home, a nested folder, or an open document must either restore W's valid persisted view state and fetch W's matching resources, or safely fall back to W's Home when that path no longer exists. It must never show another workspace's nodes/content.
- A → B → C → A and rapid A → B → A complete on the final target. Late responses from superseded generations are ignored and cannot clear or populate final-target pending/cache state.
- An explicit failed tree/content response settles the matching request and exposes the existing empty/error behavior; it may not leave an unbounded loading state. Recovery after a later valid switch requires no reload.

### Palette-foundation preservation

- Original SPEC-04 path, schema, logical-missing, byte ceiling, watcher, request-ID, availability, last-known-good, dormant-store, first-20 projection, and zero-write contracts remain unchanged.
- Switching workspaces requests/accepts palette state only for the active workspace. Late palette responses remain ignored.
- The active picker remains the pre-SPEC-05 baseline: exactly one None, 80 Google swatches, and the existing Add control; no Sync, Remove, or file-backed Custom swatch.
- No read, switch, retry, or rehydration action writes, normalizes, creates, or deletes `colors.json` or accesses the legacy custom-color localStorage key through the new foundation.
- The quarantined unaccepted SPEC-05 coordinator is not constructed or attached to the watcher in the SPEC-04R runtime. Its source remains present and unaccepted.

## Non-Goals

- Active-picker cutover, palette mutations, Remove, or retry repair (SPEC-05R). The sole sync-coordination change authorized here is quarantining its unaccepted runtime activation so original SPEC-04 zero-write behavior can be tested honestly.
- Redesigning workspace persistence, view navigation, panel discovery, or server path resolution.
- Fixing deferred SPEC-03 pointer evidence.
- Treating a null client-supplied `set_panel.rootFolder` as a defect by itself.
- Database, versioning, provenance, or live-workspace testing.

## Vertical Slices

### Slice 04R.1 — Dormant-runtime quarantine and reproduction

Quarantine the unaccepted coordinator activation exactly as specified above. Add `dormant-divergent-true` lifecycle and real-process coverage proving startup/watch zero-write behavior. In the same isolated app test file, reproduce a still-mounted `office-viewer` across A → B → C → A and record that the pre-repair cache-clear/no-effect-rerun path leaves no target tree request.

Owned tests use `[slice 04R.1]` at the start of their test titles in:

- `e2e/office/fixture-lifecycle.test.mjs` for the new variant's exact bytes and cleanup;
- `e2e/office-workspace-rehydration.spec.ts` for a real isolated server/browser process, divergent-true zero writes, and the cyclic Office reproduction.

**Slice gate:** record the cyclic test's expected pre-repair failure before changing rehydration; after quarantine, the divergent-true process assertion passes with zero coordinator construction/fanout and exact hashes. Zero matched tags fail. The real-process Playwright assertion is the incremental smoke.

### Slice 04R.2 — Workspace-aware rehydration

Implement the smallest shared rehydration mechanism. Prefer one explicit workspace/generation signal consumed by the shared file-loading layer over Office-only remount tricks. Ensure mounted consumers re-request after clear, request de-duplication remains correct within a generation, and pending bookkeeping cannot be stranded by stale/error responses.

If a necessary shared file-store or WebSocket message shape is expanded, keep the change mechanical and scoped to request/response correlation; do not create a second workspace authority.

Extend `e2e/office-workspace-rehydration.spec.ts` with `[slice 04R.2]` tests covering Home, unchanged same-named folder, nested/open document, late prior-workspace response, explicit failed response followed by a healthy switch, and rapid A → B → A. Assert requests, response correlation, final workspace content, and pending-state settlement—not only spinner absence.

**Slice gate:** the tagged real-process tests pass with exactly the final target rendered, no stale response acceptance, no pending-state strand, and no duplicate request storm. This Playwright assertion is the incremental smoke; zero matches fail.

### Slice 04R.3 — Original SPEC-04 reacceptance

Run the original SPEC-04 codec, watcher, WS, client-store, build, lint, lifecycle, cumulative Playwright, and all five isolated Electron variants on the integrated revision. Add the cyclic/rapid switch checks to the valid variant and retain raw config hashes.

Update the Workspace Paradigm Wiki only after the full runtime gate passes, and only if accepted behavior requires a documentation correction. Record the invalidation and recovery in `REVIEW-HISTORY.md`; the supervisor updates `ROADMAP-LEDGER.md` after acceptance.

Add `[slice 04R.3]` real-process assertions to `e2e/office-workspace-rehydration.spec.ts` that combine the final A → B → C → A/restart listing check, active-picker dormant baseline, `dormant-divergent-true` startup/watch zero-write hashes, and cleanup. The tagged integration assertion runs before the unfiltered cumulative suite and is the slice's incremental smoke.

**Slice gate:** the tagged 04R.3 integration assertion matches and passes; then every original SPEC-04 criterion and every unfiltered final command passes. A/B/C return to the correct Office listing after cycles/restart; configs and legacy bytes are unchanged except the one deliberately external replacement; no fixture/process residue remains.

## Expected Changed Areas

- `fusion-studio-client/src/lib/ws/workspace-handlers.ts`
- `fusion-studio-client/src/state/fileDataStore.ts`
- `fusion-studio-client/src/lib/ws/file-handlers.ts`
- `fusion-studio-client/src/hooks/useFolderFiles.ts`
- only if needed for shared generation consumption: `fusion-studio-client/src/components/office/OfficeGrid.tsx`, panel/workspace store types, or shared file-tree helpers
- `fusion-studio-server/lib/startup.js` for the exact unaccepted-coordinator quarantine
- `fusion-studio-client/e2e/office-workspace-rehydration.spec.ts`
- `fusion-studio-client/e2e/office-palette-persistence.spec.ts`
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs` and isolated Electron checklist/assertion support
- post-acceptance evidence/docs named above

This list is advisory. A mechanically necessary integration file is Tier 1 when the behavior is already required, but must be recorded and fully gated.

## Exact Validation

The named recovery test ownership is:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
node --test --test-name-pattern='\[slice 04R\.1\]' e2e/office/fixture-lifecycle.test.mjs
FUSION_OFFICE_E2E_SCENARIO=palette FUSION_OFFICE_E2E_VARIANT=dormant-divergent-true FUSION_OFFICE_E2E_WORKSPACES=3 npx playwright test --config=playwright.office.config.ts e2e/office-workspace-rehydration.spec.ts --grep '\[slice 04R\.1\]' --project=chromium --workers=1
FUSION_OFFICE_E2E_SCENARIO=palette FUSION_OFFICE_E2E_VARIANT=valid FUSION_OFFICE_E2E_WORKSPACES=3 npx playwright test --config=playwright.office.config.ts e2e/office-workspace-rehydration.spec.ts --grep '\[slice 04R\.2\]' --project=chromium --workers=1
FUSION_OFFICE_E2E_SCENARIO=palette FUSION_OFFICE_E2E_VARIANT=dormant-divergent-true FUSION_OFFICE_E2E_WORKSPACES=3 npx playwright test --config=playwright.office.config.ts e2e/office-workspace-rehydration.spec.ts --grep '\[slice 04R\.3\]' --project=chromium --workers=1
```

Run the first two test commands after `cd` for Slice 04R.1, the next command for Slice 04R.2, and the final tagged command for Slice 04R.3. Run `npm run build` and exact changed-client-file lint at every implementation slice. Zero matched tests, skipped process assertions, or retained roots fail the slice. After its tagged command, Slice 04R.3 runs every unfiltered command below as the cumulative packet gate.

On the final integrated revision, run every original SPEC-04 command plus the recovery-owned file:

From `fusion-studio-server/`:

```bash
node --check lib/office/palette-config-service.js
node --check lib/office/palette-config-watcher.js
node --check lib/ws/office-palette-handlers.js
node --check lib/ws/client-message-router.js
node --check lib/startup.js
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/ws/office-palette-handlers.test.js
```

From `fusion-studio-client/`:

```bash
npm run build
npx eslint e2e/office/fixture-scenarios.mjs e2e/office-palette-persistence.spec.ts e2e/office-workspace-rehydration.spec.ts src/hooks/useFolderFiles.ts src/lib/ws/file-handlers.ts src/lib/ws/office-palette-handlers.ts src/lib/ws-client.ts src/lib/ws/workspace-handlers.ts src/state/fileDataStore.ts src/state/officePaletteStore.ts src/types/index.ts
node --test e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts e2e/office-palette-persistence.spec.ts e2e/office-workspace-rehydration.spec.ts --project=chromium --workers=1
```

Also run scoped whitespace/diff checks and verify no isolated root, process, watcher, or pending request remains. Every command and duration goes in the run log.

## Isolated Electron Reacceptance

Run the five original SPEC-04 commands plus the recovery zero-write variant separately. The valid variant adds these mandatory observations:

1. A → B → C → A at Office Home, with visibly distinct listings per workspace.
2. A → B → A while the panel and folder names are unchanged.
3. A nested-folder/open-document switch and return, with correct target-state restoration or safe Home fallback.
4. A rapid final-target cycle, proving no stale response overwrites the final workspace.
5. Picker baseline and A/B/C raw `colors.json` hashes remain exact.

```bash
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=valid --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=malformed-cold --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=malformed-after-valid --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=over-20-read --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=file-too-large --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=dormant-divergent-true --workspaces=3 --copies=1 --relaunches=1
```

Do not retain multiple cloned runtimes concurrently. The prior run showed each clone can copy the bundled model and exhaust disk. Seed, run, assert, and remove one exact realpath-validated isolated root at a time.

## Acceptance Criteria

- The confirmed still-mounted Office failure is reproduced, repaired at the shared rehydration boundary, and covered against regression.
- Same-panel/same-folder and rapid cyclic switches settle on the final workspace with no stale data and no indefinite loading.
- Errors and stale responses settle only their own generation's pending state.
- Original SPEC-04 behavior, picker baseline, and zero-write hashes pass in full; no criterion is waived because the first valid run now succeeds.
- Divergent true configs prove the unaccepted SPEC-05 coordinator is dormant: startup and watcher reads perform no fanout, while external replacement updates only its own bytes/projection.
- The integrated candidate passes its builder-owned and orchestrator-owned adaptive review gates and the supervisor's independent reacceptance.

## Worker Handoff

Return the focused before/after reproduction, target-generation request/response matrix, exact changed-file list, all commands and durations, cyclic runtime evidence, config/localStorage hashes, cleanup scan, and a criterion-to-evidence table. Do not mark SPEC-04 accepted; that belongs to the Roadmap Implementation Supervisor.
