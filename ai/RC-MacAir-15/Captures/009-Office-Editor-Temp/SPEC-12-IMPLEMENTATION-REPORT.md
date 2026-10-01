# SPEC-12 Implementation Report — Office Harness Lifetime and Resource Bounds

**Terminal status:** `SPEC_READY_FOR_SUPERVISOR_REVIEW`
**Orchestrator:** primary session executing `$orchestrator` under the owner-authorized dispatch packet (2026-09-17)
**Repo:** `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, baseline HEAD `88637d1`
**Authorities:** `SPEC-12-HARNESS-LIFETIME-AND-RESOURCE-BOUNDS.md` + `GUIDANCE.md` (builder inputs only)
**Nothing committed or staged.** Unrelated dirty/untracked bytes preserved exactly.

---

## 1. Changed files and behavior summary

All changes are Office-harness test infrastructure. No product code, no fixture semantics,
no scenario catalog, no clone/sweep/retention correctness rules, no transcription-path edits.

| File | sha256 (final) | Δ vs pre-SPEC-12 | Behavior |
|---|---|---|---|
| `fusion-studio-client/e2e/office/harness-bounds.mjs` (new) | `1fbf8ba546a45b7ff4a75ec6bb58918c24590026ed9d41b8510792980177a4d6` | new | Single shared bounds surface: run deadline 15 min (`FUSION_OFFICE_E2E_TEST_DEADLINE_MS`), Playwright per-test 120 s, Playwright global 45 min (`FUSION_OFFICE_E2E_GLOBAL_TIMEOUT_MS`), orphan cleanup deadline 30 s, parent poll 250 ms (single literal re-exported from the helper), disk headroom 2 GiB (`FUSION_OFFICE_E2E_DISK_HEADROOM_MB`), CoW ceiling `max(64 MiB, 2%)`, all stable markers, `armOfficeHarnessLifetime()` |
| `fusion-studio-client/e2e/office/fixture-lifecycle.mjs` | `0b9f0fa990d33c0e633396157a4419fd4938d721ddb1bc8d72a216b6539676da` | +468 lines | Lifetime cleanup (`cleanupActiveOfficeHarness`, root/PID diagnostics), shared clone/inventory walk, disk preflight (`assertOfficeE2eDiskHeadroom`), staged-bytes report, whisper asset provisioning/verification (`prepareOfficeRuntimeLaneAssets`), R5 empty-shell janitor (`sweepOfficeHarnessEmptyShells`) |
| `fusion-studio-client/e2e/office/fixture-lifecycle.test.mjs` | `c5cc64e5de0990e47741e30d4c1b73b40a0d357bda88a9f28f5a23229142cfff` | +638 lines | 6 `[slice 12.1]` + 6 `[slice 12.2]` tagged probes (parent-loss, deadline, config load, low-disk, CoW delta, missing-asset interception, janitor); two stale parent-watch assertions repaired |
| `fusion-studio-client/e2e/office/global-setup.mjs` | `2f01b332de1cd9e120ba9a733bee644c862051319b4b26a2365faff233ad973d` | +16 lines | Arms Playwright-runner parent watch at lifecycle creation; provisions + verifies lane assets before build/server spawn |
| `fusion-studio-client/e2e/office/global-teardown.mjs` | `26d6ae435816c4ece1269c381e02f2f83fb9d71f83306a0d1345805dff1082a2` | +1 line | Stops the armed watch during orderly teardown |
| `fusion-studio-client/e2e/office/parent-lifecycle-watch.cjs` | `d8175398b8403f7dfae93c75025d14c74c48b7a70074fa268c2fc5eda5587eda` | +6 lines | Exports the single `DEFAULT_PARENT_WATCH_INTERVAL_MS` literal |
| `fusion-studio-client/e2e/office/parent-lifecycle-watch.test.cjs` | `6b1669ccf3b0c3c5a62b85f49cfdc60e79c3ca24b868a72a1eb48abcf6058974` | +14 lines | Repairs two stale assertions (SPEC-11 export-repair drift; VM sandbox `module` shell) |
| `fusion-studio-client/e2e/office/run-isolated-electron.mjs` | `53b52e30170b593bd6df844bda5ac0d51e7c2a1a596ede113a60ee74b60cb64b` | +9 lines | Parent watch for every isolated-Electron scenario; lane assets prepared before any child spawn |
| `fusion-studio-client/playwright.office.config.ts` | `f70bf469e4d473dcdcf0b55d0e3cd583cffa69bba0f94f4daa55951c11418e53` | +19 lines | `timeout`/`globalTimeout` from shared constants; empty-shell janitor invoked alongside the stale-root sweep at config load |

Slice 12.1 accepted candidate (superseded bytes, recorded for provenance): harness-bounds
`797c0b56…`, fixture-lifecycle `42ad527e…`, test `6fc7b4ff…`, global-setup `a6243227…`,
run-isolated `5d50de37…`, config `eb52328c…`; the other four files are unchanged since.

## 2. Slice ledger and review records

| Slice | Scope | Builder (fresh) | Builder gate reviewers | Orchestrator acceptance reviewer | Candidate |
|---|---|---|---|---|---|
| 12.1 | R1, R2 (lifetime bounds) | `ses_f51ba2e11ffedxYPP4p8DEj7F9` → `READY_FOR_ORCHESTRATOR_REVIEW` | pass 1 `ses_f5193ba61ffeTe7gh2JNglvSfn` → `CLEAN` (advisories only) | `ses_f517dc864ffe1wMod7OtfFoT0P` → `CLEAN` | 12.1 hashes above |
| 12.2 | R3, R4, R5 (resource bounds + janitor) | `ses_f5177c279ffeZqMVxBkn3b9QXJ` → `READY_FOR_ORCHESTRATOR_REVIEW` | pass 1 `ses_f502b4040ffeRYLarskZsflVjj` → `CLEAN` (advisories only) | `ses_f501127d5ffeud7HVg4Ua6QG5Y` → `CLEAN` | final hashes above |
| Final integration | whole SPEC | — | — | fresh `ses_f4ffe6cbfffeI18h0R9odPCpY9` → `CLEAN` (advisories only) | final hashes above (recomputed and matched) |

Builder gate loops stopped after the first materially clean pass per `spec-review-gate`.
Reviewers ran read-only on the pinned reviewer model with no inherited context.

## 3. Acceptance-criterion mapping

| # | Criterion | Evidence |
|---|---|---|
| 1 | Parent-loss self-termination (marker, bounded cleanup, exit 143) | Tagged probe `[slice 12.1] parent-loss probe…` (real orphaned `node --test` run; runner SIGKILLed): evidence `{cause: parent-loss, exit_code: 143, marker: OFFICE_E2E_PARENT_LOST_CLEANUP, cleaned_roots:[one], retained_roots:[], current_parent_pid:1, expected_parent_pid:60836}`, owned child and root gone, no leftovers. Orchestrator reproduced first-hand. |
| 2 | `node --test` run cannot exceed deadline (exit 124 + marker + cleanup) | Tagged probe `[slice 12.1] deadline probe…` (direct variant exit 124 literal; `node --test` variant documented). Marker `OFFICE_E2E_TEST_DEADLINE_EXCEEDED role=fixture-lifecycle-runner deadline_ms=4000 active_roots=[…] child_pids=[60392] last_marker=…` + cleanup report `exit_code:124, retained_roots:[]`. |
| 3 | Playwright config timeouts from shared constants | Config probe imports the config: `timeout=120000`, `globalTimeout=2700000` default, override `1234000` honored; `npx playwright test --list` exit 0. |
| 4 | Staging fails before allocation below free+headroom | Tagged low-disk probe + first-hand direct run: `OFFICE_E2E_LOW_DISK free_bytes=83272572928 required_bytes=104861524126277`, code `OFFICE_E2E_LOW_DISK`, zero roots before/after, env restored. |
| 5 | Staged physical delta within CoW ceiling; asserted each run | Tagged CoW probe: `OFFICE_E2E_COW_OK delta_bytes=32768 logical_bytes=3393743591 ceiling_bytes=67874872` (0–36 KB observed across passes; all ≪ ceiling). Classified skip marker (`OFFICE_E2E_COW_SKIP`) exists for the no-large-file case. See deviation A for scope. |
| 6 | Missing assets fail closed; no download/build | Tagged missing-asset probe: `OFFICE_E2E_RESOURCE_MISSING path=…/ggml-large-v3-turbo.bin hint=npx nodejs-whisper download large-v3-turbo`; `LANE_COMMAND_INVOCATIONS_AFTER_GUARD=0`; positive control `POSITIVE_CONTROL_STATUS=1,1`, `POSITIVE_CONTROL_RECORDED=2` (shim records and fails npx/cmake). Guard runs before build/server (global-setup) and before any child (run-isolated-electron). |
| 7 | Janitor removes only empty, stale, harness-owned leftovers | Tagged janitor test (removes 2 stale empty shells; preserves fresh, non-empty, model-cache-like, unmatched, symlink) + real effect: 9 empty `/tmp/fusion-spec00a-*` shells removed, 5 non-empty siblings preserved; marker `OFFICE_E2E_JANITOR_SWEPT=2` (test) / config-load count for the real shells. Existing sweep semantics and env overrides unchanged. |
| 8 | No accepted regression | Full suite: pre-SPEC-12 baseline 47 tests / 44 pass / 3 fail; after: 59 / 57 / 2. The only reds are the two pre-existing `[slice 07.4]` lane-blocker tests (out of scope); the baseline environmental launcher flake passed in both post-slice runs. |
| 9 | Gate commands exit 0; deviations recorded | Tagged 12.1 6/6 exit 0; tagged 12.2 6/6 exit 0; parent-watch 4/4 exit 0; `--list` exit 0; ESLint exit 0; `node --check` clean. Unfiltered `node --test e2e/office/fixture-lifecycle.test.mjs` exits 1 solely from the two pre-existing `[slice 07.4]` lane reds (SPEC Known-blocker carve-out). All deviations below recorded and classified. |

## 4. Exact commands and results (final integrated bytes)

| Command (cwd `fusion-studio-client`) | Result |
|---|---|
| `node --test --test-timeout=300000 e2e/office/fixture-lifecycle.test.mjs` (documented invocation) | exit 1 — 59 tests / 57 pass / 2 fail / 438.4 s; reds are the two `[slice 07.4]` lane tests |
| `node --test e2e/office/fixture-lifecycle.test.mjs` (literal SPEC command) | exit 1 — 59 / 57 / 2 / 447 s; same two reds; orchestrator also ran this after 12.1 (53 / 51 / 2 / 389 s) |
| `node --test --test-name-pattern='\[slice 12\.1\]' e2e/office/fixture-lifecycle.test.mjs` | exit 0 — 6 matched / 6 pass / 10.9–11.4 s |
| `node --test --test-name-pattern='\[slice 12\.2\]' e2e/office/fixture-lifecycle.test.mjs` | exit 0 — 6 matched / 6 pass / ~51 s |
| `node --test e2e/office/parent-lifecycle-watch.test.cjs` | exit 0 — 4/4 (pre-SPEC-12 baseline 2/4) |
| `npx playwright test --list --config=playwright.office.config.ts` | exit 0 — Total: 371 tests in 22 files |
| `npx eslint e2e/office/fixture-lifecycle.mjs e2e/office/fixture-lifecycle.test.mjs e2e/office/parent-lifecycle-watch.cjs e2e/office/global-setup.mjs e2e/office/run-isolated-electron.mjs playwright.office.config.ts` | exit 0 |
| `node --check` on every changed `.mjs`/`.cjs` | clean |
| `git diff --cached --stat` | empty (nothing staged) |
| `git diff -- fusion-studio-server/lib` | empty (no product-code change) |

The harness run satisfies its own bound: 447 s (max) < 900 s default deadline; max single
test ≈ 205 s < 300 s documented `--test-timeout`.

## 5. Probes and captured markers (verbatim)

```
OFFICE_E2E_LOW_DISK free_bytes=83272572928 required_bytes=104861524126277
OFFICE_E2E_STAGED_BYTES=3924126277
OFFICE_E2E_COW_OK delta_bytes=32768 logical_bytes=3393743591 ceiling_bytes=67874872
OFFICE_E2E_RESOURCE_MISSING path=…/node_modules/nodejs-whisper/cpp/whisper.cpp/models/ggml-large-v3-turbo.bin hint=npx nodejs-whisper download large-v3-turbo
LANE_COMMAND_INVOCATIONS_AFTER_GUARD=0
POSITIVE_CONTROL_STATUS=1,1
POSITIVE_CONTROL_RECORDED=2
OFFICE_E2E_JANITOR_SWEPT=2
OFFICE_E2E_PARENT_LOST_CLEANUP role=fixture-lifecycle-runner expected_parent_pid=60836 current_parent_pid=1
OFFICE_E2E_LIFETIME_CLEANUP_REPORT {"cause":"parent-loss","cleaned_roots":["/private/…/fusion-office-e2e-KvfRUG"],"duration_ms":7,"exit_code":143,"failures":[],"marker":"OFFICE_E2E_PARENT_LOST_CLEANUP","retained_roots":[],"role":"fixture-lifecycle-runner","expected_parent_pid":60836,"current_parent_pid":1}
OFFICE_E2E_TEST_DEADLINE_EXCEEDED role=fixture-lifecycle-runner deadline_ms=4000 active_roots=[…] child_pids=[60392] last_marker=OFFICE_E2E_LIFETIME_PROBE_READY=1
OFFICE_E2E_LIFETIME_CLEANUP_REPORT {"cause":"deadline","cleaned_roots":["/private/…/fusion-office-e2e-94xyY0"],"duration_ms":8,"exit_code":124,"failures":[],"marker":"OFFICE_E2E_TEST_DEADLINE_EXCEEDED","retained_roots":[],"role":"fixture-lifecycle-runner"}
```

Environment effects of R5 (intended): the 9 real empty `/tmp/fusion-spec00a-*` packaging
shells were removed by the janitor during validation; the 5 non-empty siblings remain.
`~/.whisper/ggml-large-v3-turbo.bin` unchanged after all runs (1,624,555,275 bytes,
Apr 4 mtime, 3 links). No harness root or owned process left anywhere.

## 6. Deviations, classifications, and recommended corrections

| ID | Original SPEC text (abridged) | Actual change | Reason / effect / risk | Classification |
|---|---|---|---|---|
| D1 | AC8/AC9: "All existing gates remain green; every gate command exits 0" | Repaired two stale assertions in `parent-lifecycle-watch.test.cjs` (current SPEC-11 wiring; VM `module` shell) | Test-only drift from accepted SPEC-11 bytes; 2/4 → 4/4; no weakening; risk none | `accepted` |
| D2 | R1: "every long-lived harness entry point that lacks it" | `run-isolated-electron.mjs` watches all scenarios (`isolated-electron-runner` role; presentation role preserved) | R1 intent; loss path still exits 1 without the SPEC marker (pre-existing path, advisory F1); no leak | `accepted` — see residual R2 |
| D3 | R1/R2 integration | `global-teardown.mjs` stops the armed watch | Mechanical; no risk | `accepted` |
| D4 | Constants table: "no duplicated literals" | `DEFAULT_PARENT_WATCH_INTERVAL_MS` exported from the helper and re-exported by the bounds surface | Single literal; no risk | `accepted` |
| D5 | Constants table: `--test-timeout=<per-test ms>` (value unspecified) | `OFFICE_E2E_NODE_TEST_TIMEOUT_MS = 300 s` | Measured max single test 204.7 s; 120 s would false-fail; run deadline remains outer bound | `accepted` |
| D6 | R2: "…print …, run bounded cleanup, exit 124" | Deadline owner is the `node --test` file process; outer runner exits 1 on file failure | Node runner semantics; literal 124 proven by direct invocation; the run cannot exceed the deadline | `accepted` |
| D7 | R1: "every long-lived harness entry point" | `run-presentation-output-electron.mjs` left unwatched | Child wait hard-bounded at 180 s; only env-gated test checkpoints are unbounded; Electron lane out of scope | `accepted` — advisory |
| A | R3/AC5: "with the runtime/fixture staged, the statfs delta must stay ≤ the CoW ceiling" | CoW probe measures the ≥4 MiB clone-candidate inventory through the real clone helper, not aggregate full-staging delta | Full-staging physical delta is ~795 MiB by the accepted small-file copy contract (> literal 78.5 MB ceiling); changing that contract is a Non-Goal; SPEC's skip clause keys on ≥4 MiB files | `accepted` (interpretation) — see residual R3 |
| B | 12.1 gate must stay green | 12.1 config probe extracts the JSON line from child stdout | Config load now prints sweep/janitor markers; values still asserted exactly | `accepted` |
| C | — | New ESM cycle `harness-bounds.mjs` ↔ `fixture-lifecycle.mjs` | Centralization requirement; both import orders verified TDZ-free | `accepted` |
| D | R4: "the harness must supply/verify assets" | Provisioning at lane launch (global-setup before build/server; run-isolated before any child) from `FUSION_OFFICE_E2E_WHISPER_CACHE` (default `~/.whisper`) via hardlink/clone | Keeps the accepted staged-model-absent `[slice 00.2]` assertion true; no download/build reachable; fails closed with hint | `accepted` |
| E | R3 staged-bytes report | Reproducible 44-byte cross-process measurement variance (diagnostic only) | Assertions use `{fresh:true}`; impact ~1e-8 of headroom | `accepted` — residual R5 |

Out-of-scope touches: **none**. No edits to `ISSUES.md`, `ROADMAP-LEDGER.md`,
`SPEC-12`, `GUIDANCE`, `DECISIONS.md`, `CAPTURE.md`, `fusion-studio-server/lib/`,
`fixture-scenarios.mjs`, or the out-of-scope lane paths.

## 7. Temporary adapters and skipped checks

- Temporary adapters: **none**.
- Skipped: Playwright/Electron lane execution (documented pre-existing `shell_bootstrap_unavailable`
  blocker; SPEC acceptance uses the module-runner surface). Manual/browser smoke: **N/A** by
  SPEC design (no lane repair). Persistence evidence: **N/A** (no product/persistence change).
  No required automated check was skipped.

## 8. Residual risks

1. Pre-existing lane blocker keeps the two `[slice 07.4]` tests red; AC9's literal "all commands
   exit 0" is unmet for the unfiltered command. Explicitly out of scope (ISSUES.md 2026-09-14).
2. `run-isolated-electron.mjs` parent-loss path exits 1 without the stable marker (cleanup
   verified, no leak) — advisory F1; candidate follow-up: route that path through
   `armOfficeHarnessLifetime` semantics in a future packet if the supervisor reads AC1 absolutely.
3. CoW probe does not exercise the `createOfficeRuntimeLayout` call site end-to-end, so a
   regression bypassing the clone helper at the call site would not be caught (large-file
   duplication — the incident root cause — is caught).
4. Provisioning depends on a populated `~/.whisper` cache or a buildable source; absence fails
   closed by design with the setup hint.
5. 44-byte cross-process staged-bytes variance, root cause unidentified; diagnostic only.
6. Other bounded helpers (`run-presentation-output-electron.mjs`, packaged-module verifiers)
   remain unwatched but hard-bounded.

## 9. Downstream impact

`compatible deviation` — `harness-bounds.mjs` is now the single source for harness lifetime and
resource bounds; future harness entry points must adopt `armOfficeHarnessLifetime` /
`assertOfficeE2eDiskHeadroom` / `prepareOfficeRuntimeLaneAssets`. No product, schema, API,
authority, or downstream SPEC contract is affected. The R5 janitor removes only empty
age-gated harness-owned shells; the accepted `fusion-office-e2e-*` sweep semantics are unchanged.

**Terminal:** `SPEC_READY_FOR_SUPERVISOR_REVIEW`.
