# S2 Builder Report — Screenshot and Apple Calendar listener retirement

- **Gate requested:** Builder-owned SPEC Review Gate for S2 of CHAT-AR-SPEC-01.
- **Handoff status:** `READY_FOR_ORCHESTRATOR_REVIEW`.
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.
- **Memory folder:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`.
- **Implementation checkout:** `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`.
- **Normative authority:** candidate `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`; SPEC SHA-256 `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`. Normative SPEC bytes were not modified.
- **Builder identity:** `/root/slice_s2` (ephemeral agent task identity; host UUID metadata unavailable).

## Scope and acceptance mapping

| S2 criterion | Implementation and evidence |
|---|---|
| Retire screenshot-folder import/source-refresh monitor and stale capture refresh calls | Removed `hotkey-screenshot-watcher.js` and watcher-only `source-folder-service.js`; removed startup registration and `screenshot:refresh-source` handler; removed both obsolete client message type names. Direct capture no longer calls refresh APIs. Repository code sweep found no remaining obsolete production references. |
| Preserve direct capture, path, saved PNG, correlation, pending attachment | `screenshot:file-capture` retains active-workspace validation and protected-path checks, writes beneath `ai/<machine>/Data/Screenshots/`, and returns the same `requestId`, workspace, and saved path. Server test reads the actual saved PNG bytes. Client regression sends an unrelated response before the matching response, verifies it waits for matching `requestId`, and verifies only the acknowledged path is pending for the original workspace/thread. |
| Preserve gallery and ribbon preview separately | Existing gallery and preview service/UI files were not changed. |
| Retire Apple directory listener and prove ordinary startup does not wait for it | Removed `calendar-watcher.js`, its Apple sync callback registration, and Apple startup watch plumbing. New deterministic test invokes Calendar startup with Apple and Google enabled, asserts the synchronous startup call returns without Apple sync, and confirms opt-in Google poller start remains. Source inspection confirms `calendar/index.js` has no Apple watcher, Apple sync, filesystem watch, or startup wait reference. No Apple Calendar service was contacted. |
| Preserve Calendar surface/routes/broadcaster and Google poller | Calendar UI, HTTP routes, `calendar:sync_complete` broadcaster, Apple sync module, existing data/table/schema, and Google poller remain. `calendar/index.js` only starts the independent opt-in Google poller. No database or migration was changed. |
| Keep deferred work out of S2 | Did not implement future Apple native monitoring, future snapshots, new subscriptions, or any S3 shared Chokidar retirement. Canonical documentation belongs to S4 and was not edited. |

## Changed files

- `fusion-studio-server/lib/screenshot/ws-handlers.js`
- `fusion-studio-server/lib/screenshot/hotkey-screenshot-watcher.js` (deleted)
- `fusion-studio-server/lib/screenshot/source-folder-service.js` (deleted; watcher/source-refresh-only consumer confirmed by repository search)
- `fusion-studio-server/lib/watch/calendar-watcher.js` (deleted)
- `fusion-studio-server/lib/calendar/index.js`
- `fusion-studio-server/lib/startup.js`
- `fusion-studio-server/lib/testing/isolated-provenance-runtime.js`
- `fusion-studio-server/test/screenshot-file-capture-request-id.test.js`
- `fusion-studio-server/test/screenshot-protected-view-path.test.js`
- `fusion-studio-server/test/calendar/apple-listener-retirement.test.js` (new)
- `fusion-studio-client/src/types/websocket.ts`
- `fusion-studio-client/e2e/prompt-ownership.slice-c.spec.ts`
- `fusion-studio-client/e2e/provenance/file-viewer-live-resource.spec.ts`

The startup registration and isolated-provenance expected-effect list were updated as mechanically necessary integration for removing the watcher. The related existing provenance E2E fixture was aligned. These are within S2 and do not change product behavior outside the approved retirement.

## Verification

Commands run from `/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server` unless specified:

1. `npx jest --runInBand --runTestsByPath test/screenshot-file-capture-request-id.test.js test/screenshot-protected-view-path.test.js test/calendar/apple-listener-retirement.test.js` — **PASS**, 3 suites / 6 tests.
2. `npx jest --runInBand --runTestsByPath test/runtime/isolated-provenance-runtime.test.js` — **PASS**, 1 suite / 12 tests.
3. From `/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client`: `npx playwright test e2e/prompt-ownership.slice-c.spec.ts --grep 'direct screenshot attaches'` — **PASS**, 1 test.
4. `git diff --check -- <all changed S2 product/test paths>` — **PASS**, no whitespace errors.
5. `rg -n 'hotkey-screenshot-watcher|source-folder-service|calendar-watcher|screenshot:refresh-source|screenshot:source-refreshed|sourceFolderService|appleWatcher' --glob '!ai/**' --glob '!System_Manager/**' --glob '!**/node_modules/**' --glob '!**/.git/**'` — only the deliberate test assertion that the retired refresh route is undefined remained; no production references remain.

The Jest process emitted a Node warning that `--localstorage-file` had no valid path. It did not affect results. Playwright emitted harness `diagnostic_error` log lines and color-environment warnings; the focused test passed.

No full client build or broad server suite was run; the assignment requested the exact focused Jest command and smallest client test, both of which ran. No app profile, external Calendar service, normal user profile, or Alpha process was used.

## Self-review, repairs, and source review

- Refreshed the exact implementation checkout root, branch, HEAD, scoped worktree status, and source hashes before editing. Assigned S2 source paths were clean and matched the approved fingerprints at dispatch. Existing extensive dirty files outside this slice were preserved.
- Reviewed the direct handler and client correlation flow, protected workspace path behavior, Calendar entry/startup order, broadcaster, Google poller, screenshot gallery/preview ownership, isolated startup-effect fixtures, routed standards, current Chat overview, Screenshot Capture contract, and Calendar View contract.
- Standards and domain source hashes matched the SPEC §3 fingerprints, including Code Standards hub, Architecture Routing, WebSocket Protocol, Universal Event Bus, Harness Adapters, Persistence and Metadata, Testing and Smoke Slices, User Profile guidance, Chat overview/boundary/testing/runtime pages, Screenshot Capture, and Calendar View.
- The first exact Jest invocation exposed an incorrect relative import in the new calendar test. Corrected the test's `../../lib/...` paths, reran the exact command successfully, then reran it after a cleanup to confirm current bytes.
- Replaced old watcher-specific screenshot assertions with direct save/correlation assertions instead of preserving tests for removed behavior.

## Builder-owned independent review gate

- Fresh read-only reviewer: `/root/slice_s2/s2_cleanroom_1` (ephemeral task identity; runtime thread UUID/host metadata unavailable).
- Reviewer outcome: terminal **`CLEAN`**, no material findings, no advisories.
- Reviewer covered current S2 diff, direct saved path/request correlation and pending attachment, Calendar callback retirement/Google poller, and the stated verification evidence.
- Lifecycle: reviewer task reached terminal final result before handoff. The runtime exposes no `close_agent` operation; closure was unavailable. No reviewer remains active or conflicts with the slice writer.
- No repair was needed after the clean review. No reviewer pass was repeated.

## Deviations, classification proposal, and residuals

- **SPEC/product deviations:** none.
- **Out-of-scope touches:** none. Startup effect and test fixture updates are bounded mechanical integration required by S2.
- **Deviation classification proposal:** none to classify; no orchestrator ruling is needed on behavior.
- **Persistence:** no SQLite reads/writes, migrations, table changes, or cleanup; screenshot source history and Calendar imported rows remain untouched per approved direction. Existing Apple rows may become stale after automatic refresh stops.
- **Residual product limitation:** no automatic Apple Calendar refresh remains until separately approved future I-021/native-monitoring proof and the open I-022 producer/scheduling/lifecycle contract. This is intentional and does not block S2. Google polling remains opt-in.
- **Downstream effect:** S3 may remove shared Chokidar while leaving independent screenshot direct capture, Calendar UI/routes/broadcaster, and Google polling intact. S4 must document the retired macOS screenshot auto-import and Apple Calendar stale-cache limitation.

## Next safe action

Orchestrator independently reviews this S2 handoff and records its acceptance decision. Builder stops here; S3 has not been started.
