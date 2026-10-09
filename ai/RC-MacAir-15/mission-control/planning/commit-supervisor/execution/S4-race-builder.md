# S4-R2 builder handoff

Status: **READY_FOR_ORCHESTRATOR_REVIEW**. Responsible builder `/root/s4_builder`; manager/report recipient `/root`. This is the bounded S4 actual cleanup inventory-race repair, not S6 execution or acceptance. First fresh current builder-owned gate is CLEAN with no material findings or advisories. Root separate acceptance remains required before S6 resumes.

## Assignment and current identity

Controller home/memory CWD `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`; implementation Git root `/Users/rccurtrightjr./projects/fs-dev`. Branch `agent/exact-workspace-paths`; HEAD `d15792920731f85e45b743519d4af2b807d95a9c`; source index SHA-256 `f37b5bfc9a44893b132661290fe095ddafccb79bed38ca9007dc3803d2ff7966`. All unchanged at final readback. Host permissions danger-full-access/never; inherited root model/effort without override. MC inactive. S6 writer acknowledged ALL writes paused; no S6 preparation reviewer; earlier writers/reviewers terminal.

Authority: full approved SPEC-COMMIT-SUPERVISOR-01 candidate `sha256:c12ff1fff3c391e5183eea219553c547a91e461d9cb114c21719b37cfe209d02`, full SPEC hash `6d7b351db87e535b0950f94c42c61d503a3ac3fef6587299dfc024c7887df664`, original owner receipt, and [consolidated repair assignment](S4-runtime-race-repair-assignment.md). Read current applicable root/controller AGENTS, exact local session/builder/review-gate procedures, standards hub/full Architecture Routing, Persistence And Metadata, Testing And Smoke Slices, full Preferences, current dependencies and affected code before writes. Baseline/preimages recorded before repair; no borrowed/global workflow.

## Changed files and repair

| File | Current SHA-256 | Size |
|---|---|---|
| `R/scripts/fusion-restart-processes.mjs` | `d2c536e6cc7219587240301a0f428266a8770fa765b79c7edf278c070be2c181` | 178 lines |
| `C/.agents/skills/mc-commit-supervisor/tests/test_restart_runtime.mjs` | `9b4bb189ebff26ceaf9b899abafa75400ebbd5e9157f0a45468640d87459ad85` | 328 lines |

Only these production/test paths changed. Current [manifest](S4-race-current-files.json), [complete preimages](S4-race-preimages/), [exact diff](S4-race.diff) and [baseline](S4-race-baseline.json) preserve prior bytes. All other restart modules, launcher, personal skill, runtime reference and current S5 workflow/routes are retained. Both files remain cohesive and below 400 lines.

Raw actual S6 failure [cleanup.log](S6-prep/cleanup.log) captured PID76638 in ps before `lsof` returned status1 with empty stdout/stderr during shutdown; [owned-runtime-stop.json](S6-prep/owned-runtime-stop.json) subsequently showed no private app/server remaining. Their original hashes/bytes remain intact.

Current process inventory records OS state and reobserves exact PID/UID/start/command at lsof/environment boundaries and after enrichment. An empty exit1 inspection may omit only a reobserved absent process or matching-identity terminal Z/X process. A terminal `<defunct>` command requires matching UID/start before omission. Live empty failures, permission/error diagnostics, malformed/read-denied inventory, UID/start/command drift and incomplete live evidence still refuse. The existing `stopOwned` signal/revalidation/ESRCH behavior is unchanged; no signal permission grows.

## Criterion mapping and checks

| Approved criterion | Current evidence |
|---|---|
| Proper selected cleanup survives process disappearance | Actual disposable Node fixtures reproduce real empty lsof exit1 at inspection and after real SIGTERM; real environment-read exit race also completes through public `systemProcesses`/`stopOwned`. Selected remaining list is empty; unrelated live profile remains alive. |
| Live ambiguity/read errors/PID reuse remain fail-closed | Synthetic OS-command boundary fixtures assert zero signals for live empty/permission/read/malformed errors and UID/start/command changes, including terminal PID reuse and successful-read drift. After legitimate SIGTERM, a replacement process receives no signal. |
| Default/inherited/explicit profile and exact Alpha ownership preserved | Full focused suite exercises canonical shell dry runs, default checkout DB versus profile server-data, inherited/explicit environment, malformed/unsafe profile flags, CLI/env disagreement, exact Alpha suffix isolation and shared/foreign profile refusal. Real-system selector excludes Alpha. |
| Wrong runtime identity/disconnected renderer withhold readiness | Retained focused tests exercise wrong path/profile/server/renderer/listener and sustained connection oracles plus injected postlaunch failure/DB/cache readbacks. Actual live Electron success remains S6. |
| Preserve source, prerequisites and protected runtimes | 49 latest accepted unmodified artifact/absence facts, 11,720 outside-controller source files, 193 source build caches, eight relevant links, 13 TOML files and raw original failure bytes verified. Source HEAD/index unchanged. Normal PIDs77002/77007 and Alpha48636/48653 keep exact start/command/profile/machine/cwd/main-executable evidence; zero source/Alpha signals. |

Exact argv/cwd/environment/exit/log entries are in [checks](S4-race-checks.json). Final current focused run: **17/17 pass**, [raw final log](S4-race-focused-final.log), [fixture readbacks](S4-race-smoke-final/). Cumulative workflow regressions: **55/55 pass**, [raw log](S4-race-cumulative-python.log). `bash -n` canonical script, `node --check` all four restart modules, canonical `--repo R --machine RC-MacAir-15 --dry-run`, offline personal-skill `quick_validate.py` with specified Python/PyYAML, memory index validator all pass. [Static raw proof](S4-race-static-checks.json), [static log](S4-race-static.log), [protected final identity](S4-race-protected-final.json) and [postreview hash/HEAD/index readback](S4-race-post-review-readback.json) pass. Reviewer independently checked current test syntax too.

Initial and prefinal focused runs also passed and remain preserved; final run adds UID-drift/malformed-ps negative assertions. One read-only builder static harness attempt mistakenly counted the deliberately owned changed helper as unowned; its [failed raw log](S4-race-static-attempt-1.log) remains, owned paths were excluded, and corrected proof passed. No product test failed. Reviewer had two read-only tooling-assumption probe failures (default Python lacked tomllib; intentionally deleted legacy path assumed present), corrected successfully; the exact terminal report preserves its account. Builder checks have exact command/raw logs; separate reviewer probe stdout exports were not requested after CLEAN.

## Fresh review and lifecycle

Fresh read-only `/root/s4_builder/s4_race_review_1`, `fork_turns=none`, inherited root model/effort/no overrides; first materially clean pass terminal at `2026-10-04T12:19:04Z`. [Exact inline raw report](S4-race-builder-review-1.md) is persisted verbatim. `collaboration.list_agents` confirms completed status. Closure tool is unavailable; no callable close action exists. [Lifecycle](S4-race-lifecycle.json) also confirms prior own reviewer terminal. No review/repair loop was extended after CLEAN.

Original immutable [75-entry archive](S4-race-pass-1/manifest.json) inadvertently captured manager preliminary assessment entry036 through an evidence glob. Root identified it before gate completion. Reviewer promptly confirmed it had seen only path/hash provenance, never displayed/interpreted assessment content. Source/entry were explicitly excluded; [74-entry filtered manifest](S4-race-filtered-manifest.json) governed completion, current packet identity `sha256:3d36ef2d8e7edf9112b4eb79624f1a1f0dbf629e82c6c45ca78a6521fce79c23`. [Exact correction/consumption evidence](S4-race-independence-note.json) and [filtered freeze identity](S4-race-filtered-freeze.json) retain that distinction. All 74 frozen/current pairs match at reviewer and final builder readback. The excluded original remains historical evidence only, never a fresh-review input.

## Deviations, invalidation and limits

[Full-field deviations](S4-race-builder-deviations.json) record original criterion, actual result, reason, authority, paths, checks, observable effect, risk, downstream impact and proposed classification for both:

- S4-R2-D1: necessary state/reobservation and injectable OS-command boundary within the existing authorized process helper/test seam; proposed `accepted` for root to classify. No stop/selection/profile/DB/cache/launch/readiness behavior expansion.
- S4-R2-D2: accidentally captured manager assessment was explicitly excluded before consumption; immutable original preserved and filtered raw gate completed independently. Proposed `accepted` procedural correction for root. Acceptance consumers must use filtered inputs and exclude manager/prior reviewer conclusions.

Earlier accepted S4 support-module/runtime-reference deviations remain retained; their old frozen evidence and S5 evidence are not overwritten. Prior inventory/cleanup claims affected by D1 require current gates; unchanged profile resolution, launcher, DB/cache/port/log protection, DOM/readiness implementation and S1-S5 prerequisite behavior retain valid evidence and received required cumulative checks. All consequential deviation classification belongs to root.

Only actual disposable Node process tests occurred. Their timing adapter kills only the exact selected fixture to create real OS races; they do not certify Electron application health. Synthetic boundary facts remain labeled injection. No source/private-candidate app build/restart, source/Alpha/profile/database/cache write, S6/private candidate/central write, commit/ref/index/remote operation, persistent task/schedule or MC activation occurred. Default unpackaged DB semantics remain unchanged. Residual limits are non-atomic OS observation/signal races and existing lstart precision; no universal atomic ownership claim. Permission/read errors intentionally remain visible. Real Electron connection/UI/machine/watcher verification is skipped here by assignment and belongs to S6.

Next safe action: root independently inspects/reruns affected checks and assigns a separate fresh S4 repair acceptance gate. Only after acceptance may S6 resume, replay changed accepted helper into private candidate, refresh affected candidate/input/recovery fingerprints, renew runtime/cleanup evidence and preparation gate. This handoff grants no S6 acceptance or owner-ready runtime claim.
