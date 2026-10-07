# S3 Builder Report — Remove shared Chokidar watcher and startup pipeline

- **Handoff:** `READY_FOR_ORCHESTRATOR_REVIEW`.
- **Assigned work:** `CHAT-AR-SPEC-01`, S3 only; S1/S2 were accepted before dispatch.
- **Builder identity:** `/root/slice_s3` (ephemeral agent task; trusted UUID/host metadata unavailable).
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.
- **Memory CWD:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`.
- **Implementation checkout:** `/Users/rccurtrightjr./projects/fs-dev`.
- **Refreshed root / branch / HEAD:** `/Users/rccurtrightjr./projects/fs-dev` / `agent/exact-workspace-paths` / `d15792920731f85e45b743519d4af2b807d95a9c`.
- **Candidate:** `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`.
- **Normative SPEC SHA-256:** `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3` (refreshed; matches approved bytes). Normative bytes were not modified.

## Scope and acceptance mapping

| S3 criterion | Implementation and evidence |
|---|---|
| Remove shared Chokidar core, broad workspace watcher, direct dependency and lock edge | Deleted `lib/watch/core.js` and `lib/watch/workspace-watcher.js`; removed Chokidar from `package.json` and lockfile. New retirement regression test verifies files and package entries are absent; production-source sweep passes. No application import or watcher registration remains. |
| Remove watcher startup/readiness/shutdown plumbing | `startup.js` no longer imports the watcher readiness wrapper, starts a workspace watcher, or loads static watcher filters. Post-listen automation starts directly after `listen()`; `shutdown.js` no longer accepts or awaits a watcher close/abandon callback. Startup integration test verifies the remaining pipeline follows `listen()` and preserves registry/provenance/startup ordering. |
| Keep event and cron triggers while file triggers remain inactive | `trigger-loader.js` now registers only `chat`, `ticket`, `agent`, and `system` bus events and returns cron triggers. `file-change` blocks create no filters or listeners. The existing event-trigger and cron-loader tests pass; the file-change test emits `file:changed` and verifies its action is not called. The cron scheduler remains wired to `evaluateCondition`. |
| Preserve component/action owners and runner heartbeat | `_startPipeline` still loads components, creates action handlers, reads trigger definitions, registers event listeners, starts configured cron jobs, and calls runner heartbeat. The action module remains because event/cron actions use it; condition/template helpers needed by surviving consumers remain. |
| Preserve theme behavior and independent file-change consumers | Boot-time `themes.json` to `themes.css` generation remains. App-mediated theme service code, chat metadata collector/listener, file save/versioning, agent tool observations, and the public event bus were not removed. The S1 ledger behavior remains in current bytes. No claim of external-file observation is made. |
| Preserve accepted S2 direct screenshot/Google behavior and retire Apple directory watch | S2 source changes remain intact: direct screenshot capture and its request correlation remain; screenshot source-folder monitor is absent; Apple watcher module is absent; Google poller remains. The S3 production sweep asserts no screenshot or Calendar watcher paths. |
| Retire no unrelated subscriber or pipeline | No ticket dispatcher registration was added. Its existing unregistered subscriber code remains untouched. Background safety/logging and governed subscription startup/shutdown owners remain. |

## S3-owned changed files

- `fusion-studio-server/lib/startup.js` (also contains the accepted S2 startup-effect removal; S3 removed its watcher pipeline/readiness/filter wiring and preserved S2 edits).
- `fusion-studio-server/lib/shutdown.js`.
- `fusion-studio-server/lib/triggers/trigger-loader.js`.
- `fusion-studio-server/lib/watcher/filter-loader.js` (now retains only shared condition/template helpers).
- `fusion-studio-server/lib/watcher/actions.js` (comments updated; live actions retained).
- `fusion-studio-server/lib/watcher/filters/theme-json-regenerator.js` (deleted with static-filter directory).
- `fusion-studio-server/lib/watch/core.js` (deleted).
- `fusion-studio-server/lib/watch/workspace-watcher.js` (deleted).
- `fusion-studio-server/package.json`.
- `fusion-studio-server/package-lock.json`.
- `fusion-studio-server/test/watch/workspace-watcher.test.js` (deleted and replaced).
- `fusion-studio-server/test/watch/watcher-retirement.test.js` (new).
- `fusion-studio-server/test/triggers/trigger-loader.test.js`.
- `fusion-studio-server/test/watcher/drop-file-protected-path.test.js` (now directly invokes the action).
- `fusion-studio-server/test/event-registry/startup-integration.test.js`.
- `fusion-studio-server/test/shutdown.test.js`.

No canonical Wiki or product documentation was edited; that work belongs to S4. The broad checkout contains extensive dirty files from unrelated work and accepted S1/S2 slices. They were preserved and are not attributed to S3.

## Verification

From `/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server`:

1. `npx jest --runInBand --runTestsByPath test/watch/watcher-retirement.test.js test/triggers/trigger-loader.test.js test/triggers/cron-scheduler.test.js test/event-registry/startup-integration.test.js test/shutdown.test.js test/chat-metadata/file-mutations-collector.test.js test/watcher/drop-file-protected-path.test.js` — **PASS**, 7 suites / 53 tests.
2. `! rg -n "require\(['\"]chokidar['\"]\)|from ['\"]chokidar['\"]|watch/core|watch/workspace-watcher|hotkey-screenshot-watcher|watch/calendar-watcher|abandonAll|loadFilters|buildFilter|matchesPattern|theme-json-regenerator|watcher/filters|FilterLoader|filterDef|filter's ticket" lib package.json` — **PASS**, no production matches.
3. `git diff --check` — **PASS**, no whitespace errors.
4. `npm uninstall chokidar --package-lock-only --ignore-scripts` — **PASS**, package lock refreshed; direct package and lock entries are absent. npm printed its existing audit summary (28 vulnerabilities: 7 low, 4 moderate, 17 high); no audit remediation was in scope.

Jest emitted the environment warning `--localstorage-file was provided without a valid path`; tests passed. S3 did not run server-wide `npm test`, client build, Electron runtime, or public OpenCode chat. The SPEC's S3 exact focused checks were run; full integrated public-route chat and broader verification belong to S4. No profile, database, Alpha installation, or external Calendar service was used.

## Self-review and review gate

Self-review checked the changed code and immediate integration points against the approved S3 contract, current Code Standards hub and routed UEB/Persistence/Testing pages, the full Chat overview, server `AGENTS.md`, and the assigned builder/review-gate procedures. Particular checks confirmed:

- startup registry initialization, `listen()`, post-listen trigger setup, and shutdown ordering remain;
- no replacement detector, repository scan, polling path, watcher readiness gate, or file-change trigger listener was introduced;
- `loadTriggers` event conditions still use `evaluateCondition`, cron uses the same condition helper, and action helpers remain for event/cron paths;
- the metadata collector stays wired, while removal of this producer is not represented as continued external-file observation;
- theme bootstrap and independent save/versioning/tool-observation paths remain.

Review history and current candidate:

- `/root/slice_s3/s3_clean_room` — terminal **CLEAN** for the pre-repair candidate; the subsequent orchestrator review identified remaining static watcher-filter code, which was repaired.
- `/root/slice_s3/s3_repair_review` — terminal **CLEAN**, no material findings. Advisory: residual legacy filter terminology in helper/action comments and the warning label. The builder updated the affected wording and reran checks.
- `/root/slice_s3/s3_final_repair_review` — fresh terminal **CLEAN**, no material findings in the final current bytes. It verified removed filter modules/APIs, retained condition/template and action paths, inert file-change triggers, direct protected-path tests, and the supplied test/sweep evidence.
- All reviewer tasks reached terminal completion before handoff. No `close_agent` operation is available in this runtime, so closure could not be attempted. No reviewer remains active or conflicts with the writer.

The advisory from the second review is resolved in current bytes; it is retained here as review history, not a current residual.

## Deviations, downstream impact, and residuals

- **SPEC deviations:** none identified.
- **Out-of-scope touches:** none beyond bounded startup, shutdown, test and package integration necessary for S3. `startup.js` contains accepted S2 edits preserved from its pre-dispatch state.
- **Proposed classification:** none to classify.
- **Downstream impact:** S4 must document that automatic file-change trigger input and generic external-file observation stop, while event/cron triggers, direct saves/tool observations, and the legacy bus remain separate. S4 owns canonical Wiki/source-map changes and integrated public chat verification.
- **Residual limitation:** Apple Calendar automatic refresh and screenshot-folder auto-import are intentionally retired by accepted S2; those imported rows/cache may be stale or absent until separately authorized future work. They are not S3 blockers.
- **Skipped checks:** broad server suite, client build, and public UI/OpenCode smoke are not S3 gates and remain S4 obligations.

## Next safe action

Orchestrator performs independent S3 acceptance and deviation classification. Current S3 handoff is `READY_FOR_ORCHESTRATOR_REVIEW`. Builder stops here and does not start S4.
