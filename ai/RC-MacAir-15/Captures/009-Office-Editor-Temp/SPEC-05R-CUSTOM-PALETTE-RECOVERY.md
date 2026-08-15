# SPEC-05R — Custom Palette Retry Recovery and Completion

**Status:** `RETIRED — SUPERSEDED 2026-07-21`
**Recovery candidate:** `OE-009-RECOVERY-RC1`
**Supersedes on acceptance:** blocked SPEC-05 execution, not the original product contract
**Depends on:** accepted SPEC-04R

## Objective

> This recovery packet is historical evidence only. Do not execute its watcher/retry design. Current authority is `GUIDANCE.md` §4 and the owner-superseded SPEC-05 packet.

Create a fresh changed candidate that repairs the confirmed self-write/retry-lifecycle defect, preserves accepted Slice 05.1 semantics, and completes the original SPEC-05 picker cutover and three-workspace integration work. Acceptance of this packet accepts SPEC-05 behavior; the earlier `IMPLEMENTATION_UNSTABLE` invocation remains historical evidence.

## Authoritative Builder Inputs

This is one composite released SPEC under `RECOVERY-ROADMAP.md`'s bounded builder-input amendment. Every orchestrator and slice builder must receive and read:

1. this recovery member;
2. `SPEC-05-CUSTOM-COLOR-SYNC.md` in full; and
3. `GUIDANCE.md` in full.

The original SPEC-05 member supplies the complete participation, path/write, journal, barrier, wire envelope/order, UI, picker, failure, validation, and smoke contract. This file controls only changed-candidate recovery, the retry clarification, restoration after SPEC-04R quarantine, and remapped execution slices. No preparation/history document may be used to invent product behavior.

## Recovery Boundary

The previous invocation exhausted its discovery and reserved-confirmation budget on unchanged Slice 05.2 bytes. Its final candidate is unaccepted and contains a reproduced material defect:

1. a config rename becomes visible;
2. destination-parent fsync or post-rename durability confirmation fails;
3. durability debt is recorded, but the visible self-write signature is not registered;
4. the watcher forwards that same signature;
5. `notifyWatch` calls a reset reconciliation, cancelling/resetting the pending retry episode;
6. the system may perform attempts beyond the exact `250/1000/4000 ms` contract.

SPEC-05R is a new implementation execution only after a builder changes code/tests to address that defect. It may use the current candidate as a starting point. It may not present unchanged bytes to a fresh reviewer, reuse prior reviewers, or call its first review a continuation/fifth pass.

## Normative Contract

Every original SPEC-05 requirement remains normative, including participation, complete-array union, 16,384-byte ceiling, trusted materialization and writes, removal journal, registry barrier, wire ordering, idempotence, atomic picker cutover, Add/Sync/Remove behavior, failure handling, and isolated variants.

This packet clarifies the retry episode invariant:

- A write that has renamed canonical bytes but still owes destination-parent durability is an owned self-write plus durability debt.
- The coordinator must record enough signature/identity state before the watcher can observe the rename to classify that observation without resetting the episode.
- A matching self-write/equality watch event may be ignored or folded into the existing serialized repair. It performs no reset, creates no second timer, and does not advance, restart, or duplicate the retry schedule.
- The debt remains until the same destination and trusted write context pass required parent fsync and post-rename reread/identity verification. Merely observing equal canonical bytes is not durability confirmation.
- A genuine external byte/flag change, registry change, or new user intent retains the original reset semantics and replans from current trusted bytes.
- One logical failure episode schedules at most one operation at a time and exactly the remaining delays from `250`, `1000`, `4000` milliseconds. After the third failed retry it remains degraded until a legitimate reset event.
- Success and shutdown cancel/reset the episode and leave no timer or queued repair.

## Preserved Baselines

- Slice 05.1 pure model composite was accepted. Revalidate it on the recovery candidate; redesign is out of scope.
- Slice 05.2's broad durability, journal, race, cleanup, and 128-test evidence is useful regression evidence but not acceptance.
- SPEC-04R's target-workspace rehydration must remain green through picker cutover and all A/B/C cycles.
- SPEC-02C color policy and SPEC-03 geometry behavior are untouched.

## Non-Goals

- A general watcher/retry framework or retry-policy redesign.
- More attempts, jitter, backoff changes, or weaker durability requirements.
- Reopening product intent settled by original SPEC-05.
- Cloud/account sync, database palette state, provenance/versioning, clear-palette/delete-file UI, or SPEC-06 behavior.
- Editing live workspace configs or using live databases in tests.

## Vertical Slices

### Slice 05R.1 — Changed retry-lifecycle candidate

Restore the runtime coordinator activation quarantined by SPEC-04R, using the same single coordinator/watcher integration path, then repair self-write classification and durability-debt handling at that boundary. Add a deterministic native-watcher regression that exercises the exact post-rename/pre-parent-fsync failure and then delivers the visible signature through the same production notification path. Runtime activation is not accepted independently; it remains inside this packet until the complete picker cutover and integration pass.

Required test matrix:

- first failure schedules one 250 ms retry and records debt;
- matching self-write watch does not cancel the timer, reset `retryIndex`, start immediate parallel repair, or create a new episode;
- repeated duplicate/equality watch notifications remain inert;
- failures at 250/1000/4000 yield no fourth retry;
- a genuine external edit resets exactly once and replans;
- a registry change and new user intent retain their explicit reset behavior;
- successful debt repair confirms parent durability/identity before clearance;
- shutdown clears timer/debt work without residue;
- journal cleanup/recovery and missing-parent durability cases remain green.

**Slice gate:** the isolated probe that failed the prior confirmation now passes through production watcher wiring, targeted 05.2 tests pass, and code/test identities differ from the rejected candidate before review begins.

### Slice 05R.2 — Mutation protocol and atomic picker cutover

Execute original Slice 05.3 without changing its contract. Add exact mutation messages and atomically replace active legacy/document sources with None, Google, and file-backed Custom. Land the always-visible Sync row, exact `+`, acknowledged Add/apply, and one-action right-click Remove only when server mutations are live.

Preserve inert byte-equivalent legacy localStorage, no Document-color scraping, captured-target/stale-target behavior, last-confirmed projection on error, and document/config Undo separation.

**Slice gate:** original 05.3 pointer/keyboard/count/idempotence/divergence tests pass together with the 05R.1 retry regression and SPEC-04R rehydration regression.

### Slice 05R.3 — Three-workspace integration and recovery smoke

Execute original Slice 05.4 and its documentation boundary. Use A/B/C for all missing, false fork, enable/disable, later registration, 21+ arrays, byte ceiling, contributor/destination failures, partial global Remove, restart recovery, and every original wire/hash/status assertion.

Add cyclic A → B → C → A and rapid A → B → A during healthy, degraded, and recovered states. A stale workspace or self-write event may not reset retries or project another workspace's state.

Update only the authorized Tables and Workspace Paradigm Wiki pages after runtime acceptance.

**Slice gate:** all eight original Electron variants, full automated gates, retry counts, complete-array hashes, journal lifecycle, and cleanup pass on one integrated candidate.

## Expected Changed Areas

- `fusion-studio-server/lib/office/palette-sync-coordinator.js`
- `fusion-studio-server/lib/office/palette-config-watcher.js`
- `fusion-studio-server/test/office/palette-sync.test.js`
- `fusion-studio-server/test/office/palette-watcher.test.js`
- original SPEC-05 Slice 05.3/05.4 server/client/test/fixture areas
- `fusion-studio-server/lib/startup.js` to restore the single runtime coordinator before the watcher
- SPEC-04R rehydration tests where needed for cumulative integration
- authorized post-acceptance Wiki and execution evidence files

The repair should reuse existing serialization, signatures, and durability debt rather than adding a second coordinator or unbounded event history.

## Exact Validation

Recovery-owned tests use `[slice 05R.1]`, `[slice 05R.2]`, or `[slice 05R.3]` at the start of their test/describe titles in the original owning files. Derive and run these incremental commands; zero matched tests fail:

Slice 05R.1:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js --testNamePattern='\[slice 05R\.1\]'
```

This tagged gate must include the production watcher-route retry probe, coordinator-restoration startup/process assertion, duplicate/equality notifications, all three delays/no fourth retry, legitimate reset events, debt durability verification, and shutdown cleanup. Its isolated filesystem/process assertion is the incremental smoke.

Slice 05R.2:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js --testNamePattern='\[slice 05R\.2\]'
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npx playwright test --config=playwright.office.config.ts e2e/office-palette-sync.spec.ts --grep '\[slice 05R\.2\]' --project=chromium --workers=1
```

The tagged Playwright assertion is the isolated incremental UI smoke and must cover the atomic cutover rather than a pure controller mock alone.

Slice 05R.3:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
node --test --test-name-pattern='\[slice 05R\.3\]' e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-palette-sync.spec.ts --grep '\[slice 05R\.3\]' --project=chromium --workers=1
```

The tagged Playwright gate must operate the isolated A/B/C server/browser runtime, including cyclic workspace checks and post-run bytes. Slice 05R.3 then runs every unfiltered command below as the cumulative final gate. At every slice, run the relevant `node --check`, `npm run build`, and exact sorted changed-client-file lint required by `GUIDANCE.md`.

On the final integrated revision, run every original SPEC-05 command.

From `fusion-studio-server/`:

```bash
node --check lib/office/palette-config-service.js
node --check lib/office/palette-config-watcher.js
node --check lib/office/palette-sync-coordinator.js
node --check lib/office/palette-removal-journal.js
node --check lib/ws/office-palette-handlers.js
node --check lib/ws/client-message-router.js
node --check lib/startup.js
node --check lib/workspace/registry-service.js
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js
```

From `fusion-studio-client/`:

```bash
npm run build
npx eslint e2e/office/fixture-scenarios.mjs e2e/office-palette-sync.spec.ts e2e/office-workspace-rehydration.spec.ts src/components/office/OfficeDocumentPage.tsx src/components/office/officeColorPopover.ts src/components/office/useCrepeEditor.ts src/lib/ws/office-palette-handlers.ts src/lib/ws-client.ts src/state/officePaletteStore.ts src/types/index.ts
node --test e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts e2e/office-palette-persistence.spec.ts e2e/office-palette-sync.spec.ts e2e/office-workspace-rehydration.spec.ts --project=chromium --workers=1
```

The cumulative Playwright command above owns the SPEC-04R rehydration regression; it is not optional or a separate unrecorded check. Also run scoped whitespace/diff checks, exact timer/retry assertions using a deterministic scheduler, and cleanup scans for config temps, journal temps, fixture roots, watchers, timers, and child processes. Record every command and duration.

## Isolated Electron Acceptance

Run the eight original SPEC-05 variants separately, retaining at most one isolated clone at a time:

```bash
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=valid --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=read-only --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=all-missing-first-add --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=over-20-external --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=file-too-large --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=contributor-read-failure --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=destination-write-failure --workspaces=3 --copies=1 --relaunches=1
node e2e/office/run-isolated-electron.mjs --scenario=palette --variant=remove-partial --workspaces=3 --copies=1 --relaunches=2
```

Pass requires original visible behavior and persisted-byte assertions plus bounded retry evidence from the server log/assertion surface. The second `remove-partial` launch must recover the durable pending removal before ordinary union. Workspace cycles must retain correct Office content and palette state.

## Acceptance Criteria

- The prior material probe passes because a changed implementation preserves one exact retry episode through matching self-write watcher delivery.
- No fourth retry, parallel timer, equality reset, or durability-by-byte-equality shortcut exists.
- Every original SPEC-05 acceptance criterion passes; accepted Slice 05.1 semantics remain intact.
- Atomic picker cutover exposes no partial read-only palette and performs no legacy migration/access/clear.
- SPEC-04R rehydration remains green under all healthy/degraded/restart workspace cycles.
- Builder-owned and orchestrator-owned adaptive gates are clean on the changed integrated candidate, followed by supervisor acceptance.

## Worker Handoff

Return the changed-candidate identity evidence, exact retry timeline/counters, production watcher-route regression, original criterion mapping, complete versus visible arrays, wire ordering, file/journal hashes, UI count matrix, cyclic workspace evidence, commands/durations, cleanup, and residuals. Do not call the old invocation accepted and do not mark SPEC-05 accepted yourself.
