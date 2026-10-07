# S2 Orchestrator Acceptance — screenshot and Apple Calendar listener retirement

- **Gate:** S2 slice acceptance, CHAT-AR-SPEC-01
- **Result:** `CLEAN`
- **Builder:** `/root/slice_s2`, terminal. [Builder report](S2-builder-report-2026-10-03.md).
- **Builder reviewer:** `/root/slice_s2/s2_cleanroom_1`, terminal `CLEAN`.
- **Orchestrator reviewer:** `/root/s2_acceptance_review`, terminal `CLEAN`.
- **Reviewer persistent UUID/host metadata:** unavailable in this runtime; agent paths are the available identities.

## Independent inspection and verification

The current diff retires the screenshot-folder watcher/source-folder service, startup registration, refresh calls/API and obsolete client message types. Direct capture still validates active workspace/protected paths, saves to `ai/<machine>/Data/Screenshots/`, and returns the matching `requestId` and saved path; client flow queues only the acknowledged saved path for the original workspace/thread. Gallery and ribbon preview owners remain untouched.

The Apple directory watcher and startup effect are removed. Call sites and renderer behavior have no wait/race on the Apple callback. The new deterministic test proves startup returns without Apple sync and the separately enabled Google poller still starts. Calendar routes, UI, sync broadcaster, Apple sync module, existing rows, and Google poller remain. Existing imported Apple rows may become stale while automatic Apple refresh is retired; this is the approved interim behavior.

Orchestrator reruns:

- Server Jest: screenshot request ID, protected path, Apple listener retirement and isolated provenance suites — **PASS**, 4 suites / 18 tests.
- Client Playwright: `npx playwright test e2e/prompt-ownership.slice-c.spec.ts --grep 'direct screenshot attaches'` — **PASS**, 1 test.
- `git diff --check` over S2 changed paths — **PASS**.

Node local-storage and Playwright color/harness diagnostic warnings were reported; the tests passed. Neither independent review found a material issue or advisory. Deviation ledger remains empty; S2 is accepted at current bytes. Startup and provenance fixture changes are bounded mechanical integration. No external Calendar service, database, or migration was used.

## Downstream effect

S3 may proceed. Shared Chokidar retirement remains separate. S4 must document the stopped Apple refresh and stale-cache limitation, plus the retired macOS screenshot-folder auto-import. No native monitoring or snapshot substitute is authorized here.
