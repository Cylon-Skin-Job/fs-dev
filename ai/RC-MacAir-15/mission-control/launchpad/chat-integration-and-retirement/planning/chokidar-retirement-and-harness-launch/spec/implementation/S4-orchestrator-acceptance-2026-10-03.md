# S4 orchestrator acceptance — runtime blocked

- **SPEC:** `CHAT-AR-SPEC-01`; approved candidate `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`.
- **Normative fingerprint:** `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`, matching `OWNER-APPROVAL.md` and `CANDIDATE.json`.
- **Current implementation checkout:** `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`; unrelated dirty owner work was preserved.
- **Disposition:** `RUNTIME_BLOCKED`. Do not report `SPEC_READY_FOR_OWNER_REVIEW` until the mandatory public UI scenario is performed and accepted.

## S4 work and checks

The builder completed the S4 code/test integration and assigned Wiki/source-map updates. The exact paths, source-sweep coverage, relative-link results, test/build results, and limitations are recorded in [S4-builder-report-2026-10-03.md](S4-builder-report-2026-10-03.md). The normative SPEC remained unchanged.

The builder reported passing the focused integrated Jest set (8 suites / 55 tests), Apple Calendar no-wait test (1/1), full server suite (219 suites; 3,244 passed, 1 skipped), native observer pretest build, client build, retired-source sweep, relative links for 16 changed canonical pages, and `git diff --check`. These results are report-attested; the orchestrator and final reviewer did not independently rerun product tests. Existing tool warnings are recorded in the builder report.

The scope also includes two bounded touches beyond the primary S4 source-map/docs paths: `fusion-studio-server/lib/frontmatter/catalog.js` corrects stale watcher filter metadata following the S3 reviewer advisory; `fusion-studio-server/test/screenshot-protected-view-path.test.js` removes a mock for the module S3 deleted. The builder supplied rationale and checks. The fresh integrated reviewer found both accounted for and appropriately classified, with no material runtime effect. The [implementation ledger](SLICE-AND-DEVIATION-LEDGER.md) records them as accepted bounded deviations D-01.

## Independent integrated review

Fresh reviewer `/root/integrated_final_review` returned **CLEAN-EXCEPT-UI-BLOCKER**. It verified the normative hash against approval records and inspected the current integrated source/docs, including the accepted S1–S3 work, S4 edits, and deviation accounting. It found no other material source, documentation, integration, or classification issue. It did not rerun product checks. Full reviewer synopsis and final disposition are in the [implementation ledger](SLICE-AND-DEVIATION-LEDGER.md).

## Blocking acceptance criterion

SPEC §6.S4 / §8.8 requires an authenticated ordinary public OpenCode conversation through the product UI using an isolated disposable Electron profile and scratch workspace. Evidence must show prompt acceptance, actual OpenCode child/session, completed response, persisted exchange identity, and normal same-thread history reopen/readback without duplication, misrouting, or a missing exchange.

The test was **not run**. The CUA native-app inventory timed out; its retry returned no apps and `Computer Use server error -10005: codex app-server exited before returning a response`. Without a native app surface the normal shell authentication and public product UI steps could not be performed. No scratch profile/workspace or chat/provider session was created, and no thread, PID/session, completed response, durable exchange, or readback evidence exists. The builder's fresh reviewer independently withheld acceptance for this same mandatory criterion; the integrated reviewer reached the same conclusion. Automated tests/builds do not substitute for it. No product runtime failure was observed, so there is no evidence-based launch/spawn repair to perform.

## Resume condition and handoff

When a supported native UI surface is available, rerun the exact isolated public chat scenario from the approved SPEC. Preserve both normal and Alpha profiles. Record direct evidence for each acceptance element, repair only a concrete local failure if one occurs, rerun impacted verification, and obtain a fresh independent integrated review. Until then, S1–S4 implementation artifacts and automated checks are complete for review, but the SPEC remains runtime-blocked.

Owner source-thread notification was sent to authorized source thread `01a0ea32-f152-77a2-afc2-b73e8976685a` after the integrated review. It reported `RUNTIME_BLOCKED`, summarized passing automated checks and the missing public UI evidence, linked this report, the S4 builder report, and the ledger, and stated the safe resume condition. Delivery was confirmed by the tool response.

### Owner-requested retry on 2026-10-04

After the owner started a two-hour caffeinate hold and requested another native CUA attempt, CUA inventory and binding became available for the normal development window. The normal window visibly showed existing `FS Dev` workspace content, so it was left untouched. A fresh isolated development Electron shell/server also started with a separate scratch profile/workspace and announced port `57436`, but CUA's Electron binding continued returning the older normal-profile window; it could not select the duplicate isolated process by app name/path or title. No prompt was submitted from the normal instance. The isolated process was stopped through the `electron/main.cjs` SIGTERM cleanup handler, and its scratch evidence was preserved. The exact retries and process/profile facts are recorded in [S4-native-ui-retry-2026-10-04.md](S4-native-ui-retry-2026-10-04.md). The required authenticated public-chat criteria therefore remain unverified and disposition remains `RUNTIME_BLOCKED`. This fresh material-blocker update, with both reports and the ledger linked, was delivered to the authorized source thread; delivery was confirmed by the tool response.
