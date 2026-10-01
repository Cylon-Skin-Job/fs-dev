# SPEC-12 — Office Harness Lifetime and Resource Bounds

**Domain:** Test-harness resource and lifetime containment (no product behavior)  
**Depends on:** Accepted SPEC-00 harness plus the post-acceptance maintenance change (`e2e/office/fixture-lifecycle.mjs` CoW clone + owner lease + `sweepStaleOfficeFixtureRoots`)  
**Blocks:** none; closes the remaining unbounded-run / unbounded-disk exposure of the Office harness

## Context and Incident Record

The Office harness is correct about isolation (never touch the live workspace or DB) but its entry points were never resource-bounded. Three observed failures motivate this packet:

1. **2026-09-15/16 — 46-hour runaway.** An orphaned `node --test e2e/office/fixture-lifecycle.test.mjs` (parent shell died; reparented to PID 1) spun at ~99% CPU for ~46 h until an operator killed it. There is no parent-loss watch on the `node --test` runner path and no run deadline. The existing `e2e/office/parent-lifecycle-watch.cjs` covers only `run-isolated-electron.mjs` and `isolated-electron-output-main.cjs`.
2. **2026-09-14 — disk amplification (fixed, now guard-less).** Per-run runtime staging physically duplicated large owned files (including the 1.55 GB whisper model) because `COPYFILE_FICLONE` silently falls back to byte copies; interrupted runs leaked roots. The post-acceptance change fixed the mechanism (CoW clone, owner lease, stale sweep; tested at `[slice 00.2]`) but nothing asserts the physical delta stays near zero, so a regression would be silent again.
3. **2026-09-15 — runtime download/build fallback.** `fusion-studio-server/lib/transcription/index.js:109-136` downloads the model (`npx nodejs-whisper download`) and builds `whisper-cli` with `cmake` when the staged runtime lacks them; `lib/transcription/setup.js:31-37` carries the same download path. A fixture whose staged clone lacks the model can therefore re-fetch or compile during a test run (a GGML/clang compile was observed during incident investigation). No harness guard prevents this.

Known pre-existing blocker (out of scope, recorded in `ISSUES.md` 2026-09-14): the office Playwright lane cannot boot its isolated server under the accepted Trusted Fusion Shell Authority (`shell_bootstrap_unavailable`), and the office Electron lane times out waiting for the renderer. This SPEC must not attempt to repair those lanes; its acceptance uses the module-runner surface that works today.

## Objective

Bound the Office harness in wall-clock time, process lifetime, disk usage, and network activity, and prove each bound with tagged probes. No observable product behavior changes; no fixture semantics, scenario catalog, or accepted clone/sweep logic may change except as extended here.

## Bounded-Run Constants (shared)

Add one shared bounds surface (in `fixture-lifecycle.mjs` or a new sibling `.mjs` imported by every entry point; no duplicated literals):

| Bound | Default | Override (documented) |
|---|---|---|
| `node --test` harness run deadline | 15 min | `FUSION_OFFICE_E2E_TEST_DEADLINE_MS` |
| Playwright per-test timeout | 120 s | (config constant) |
| Playwright global run timeout | 45 min | `FUSION_OFFICE_E2E_GLOBAL_TIMEOUT_MS` |
| Parent-loss poll interval | existing helper default (250 ms) | (helper option) |
| Orphan cleanup deadline | 30 s | (constant) |
| Disk headroom requirement | staged logical bytes + 2 GiB | `FUSION_OFFICE_E2E_DISK_HEADROOM_MB` |
| CoW delta ceiling | max(64 MiB, 2% of staged logical bytes) | (constant) |
| Janitor age threshold | existing sweep default (6 h) | existing env overrides retained |

`playwright.office.config.ts` must set `timeout` and `globalTimeout` from these constants; the `node --test` entry must arm the run deadline regardless of invocation; the documented invocation additionally passes `--test-timeout=<per-test ms>`.

## Required Behavior

**R1 — Parent-loss self-termination.** Extend parent-loss watching (reuse `createParentLifecycleWatch`) to every long-lived harness entry point that lacks it, at minimum: the `fixture-lifecycle.test.mjs` runner process and the Playwright runner path (`global-setup.mjs` at lifecycle creation; config load may arm it where cleanup state exists). On loss: perform the same cleanup as the SIGTERM path (owned child process groups, fixture/runtime roots) within the 30 s cleanup deadline, print a stable marker, and exit 143. A watch that fires must never leave an owned root or child process behind; roots that cannot be cleaned are left for the stale sweep (lease intact), never silently.

**R2 — Wall-clock deadlines.** The `node --test` harness run self-terminates after the run deadline: print `OFFICE_E2E_TEST_DEADLINE_EXCEEDED`, run bounded cleanup, exit 124. The Playwright office config carries `globalTimeout` and explicit per-test `timeout` from the shared constants. A deadline expiry is a classified failure with diagnostics (active fixture roots, child PIDs, last marker), never a silent exit.

**R3 — Disk guards.** Before any staging or root allocation, compute the planned staged logical bytes (reuse the clone inventory walk) and require free space ≥ staged + headroom (default 2 GiB) via `statfsSync`; fail before creating anything with `OFFICE_E2E_LOW_DISK free_bytes=… required_bytes=…`. After staging, print `OFFICE_E2E_STAGED_BYTES=<logical>`. Add a physical-delta regression assertion in `fixture-lifecycle.test.mjs`: with the runtime/fixture staged, the `statfs` free-space delta must stay ≤ the CoW ceiling (proving clones remain clones); failure marker `OFFICE_E2E_COW_REGRESSION delta_bytes=… logical_bytes=…`. If no ≥4 MiB owned file exists to stage in the environment, the test records an explicit classified skip marker — never a silent pass.

**R4 — No-network / no-build fail-closed.** Before spawning any isolated server or Electron lane, the harness verifies every required model/runtime asset in the staged tree (at minimum the `ggml-*.bin` whisper model and `whisper-cli` when transcription is in the staged runtime). Missing assets fail closed before spawn with `OFFICE_E2E_RESOURCE_MISSING path=… hint=…` (hint names the developer setup command). The harness must be incapable of triggering `npx nodejs-whisper download` or a `cmake` build during a test run: prove it with a probe that stages a runtime missing the model and shows the classified failure with interception evidence that no download/build command executed (e.g., a PATH shim that records and fails on `npx`/`cmake` invocations from the child tree). No product-code change: if the transcription init is reachable in the lane, the harness must supply/verify assets, not patch the server.

**R5 — Janitor.** Extend `sweepStaleOfficeFixtureRoots` (or a sibling called from the same entry points) to remove empty, age-gated, harness-owned leftover directories matching documented prefixes (including the empty `fusion-spec00a-*` packaging shells observed in `/tmp`). Rules: never remove non-empty directories, never follow symlinks, never touch `~/.whisper`, model caches, or unmatched names; print `OFFICE_E2E_JANITOR_SWEPT=<n>` when entries are removed. The existing live-owner skip and env overrides are preserved.

## Dependency-Ordered Slices

### Slice 12.1 — Lifetime bounds (R1, R2)

- Shared bounds constants; parent watch wired into the `node --test` runner and the Playwright lifecycle path; run deadlines armed and reported.
- Gates (tagged `[slice 12.1]`): parent-loss probe on a spawned `node --test` run (kill the intermediate parent; assert orphan exits 143 within the cleanup deadline, with marker and zero leftover owned roots/children); deadline probe (injected stall; assert exit 124, marker, bounded cleanup); Playwright config assertions (via `--list`, config loads with both timeouts set from constants). Reuse/extend the existing parent-watch test file where applicable.

### Slice 12.2 — Resource bounds and janitor (R3, R4, R5)

- Disk preflight, staged-bytes reporting, CoW delta assertion, asset presence verification with interception probe, janitor extension.
- Gates (tagged `[slice 12.2]`): low-disk fault-injection probe (`OFFICE_E2E_LOW_DISK`, no roots created); CoW physical-delta test; missing-asset probe (`OFFICE_E2E_RESOURCE_MISSING` with no download/build evidence); janitor test (empty stale shells removed; live/fresh/non-empty/unmatched preserved).

Both slices are module-runner slices (process integration surface exists); no `SMOKE_NA_PURE` claim is available.

## Exact Validation

```bash
cd fusion-studio-client
node --test e2e/office/fixture-lifecycle.test.mjs
node --test e2e/office/parent-lifecycle-watch.test.cjs
npx playwright test --list --config=playwright.office.config.ts
npx eslint e2e/office/fixture-lifecycle.mjs e2e/office/fixture-lifecycle.test.mjs e2e/office/parent-lifecycle-watch.cjs e2e/office/global-setup.mjs e2e/office/run-isolated-electron.mjs playwright.office.config.ts
```

Plus the mechanically derived tagged gates: `node --test --test-name-pattern='\[slice 12\.1\]' e2e/office/fixture-lifecycle.test.mjs` and the `12.2` equivalent. All commands must exit 0; the harness test run itself must satisfy the new deadline value in the command used.

## Non-Goals

- Any product behavior change, including transcription init logic; no edits under `fusion-studio-server/lib/`.
- Repairing the pre-existing Playwright/Electron lane blocker (`ISSUES.md` 2026-09-14) or changing trusted-shell authority.
- Changing fixture semantics, scenario catalogs, clone/sweep correctness rules, retention rules, or the accepted isolation contract.
- CI configuration, new tooling, or repository-wide lint cleanup.

## Acceptance Criteria

1. Every harness entry point self-terminates on parent loss with the marker, bounded cleanup, and exit 143; proven by probe.
2. The `node --test` harness run cannot exceed its deadline; proven by probe (exit 124 + marker + cleanup).
3. `playwright.office.config.ts` sets `timeout` and `globalTimeout` from the shared constants; proven by config load.
4. Staging fails before allocation when free space is below staged + headroom; proven by injected low-disk probe.
5. Staged physical delta stays within the CoW ceiling on this platform; asserted each harness-test run.
6. Missing model/runtime assets fail closed before spawn with guidance and no download/build execution; proven by interception probe.
7. Janitor removes only empty, stale, harness-owned leftovers; live/fresh/non-empty/unmatched names and model caches are untouched; proven by test.
8. All existing `[slice 00.x]`–`[slice 11.x]` tagged gates remain green; no accepted behavior regresses.
9. Every gate command above exits 0; deviations recorded per `GUIDANCE.md` §8 with orchestrator classification.

## Terminal Report

Per `GUIDANCE.md` §8 (`SPEC_READY_FOR_SUPERVISOR_REVIEW` / `AUTHORITY_BLOCKED` / `BLOCKED`), including changed files, acceptance-criterion mapping, exact commands and results, probes with captured markers, deviations, residuals (including the lane blocker reference), and the orchestrator's classification.
