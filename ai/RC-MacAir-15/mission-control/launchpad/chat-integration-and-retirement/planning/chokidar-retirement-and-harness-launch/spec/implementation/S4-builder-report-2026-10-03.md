# S4 Builder Report — integrated behavior, public chat and documentation

- **SPEC:** `CHAT-AR-SPEC-01`, approved candidate `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`.
- **Normative file:** `SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md`, SHA-256 `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3` (matches approval; left unchanged).
- **Builder role:** `/root/slice_s4`, assigned S4 only after S1–S3 acceptance. Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Memory CWD: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`. Implementation checkout: `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, initial HEAD `d1579292`.
- **Builder gate:** `BLOCKED` for acceptance because the mandatory public OpenCode acceptance could not execute with the failed native UI bridge. The code, tests, and docs are packaged for orchestrator inspection, but this is not a clean slice acceptance and does not claim `SPEC_READY_FOR_OWNER_REVIEW`.

## Accepted prerequisites and boundary

S1, S2 and S3 were already accepted by their orchestrator gates at current bytes; see their acceptance reports and builder reports in this directory. S4 did not change their production implementation. It removed one remaining test-only mock for deleted `lib/watch/core`, corrected the stale frontmatter catalog description identified by the S3 reviewer, ran the integrated checks, and aligned the required canonical documentation. No database, migration, user profile, Alpha installation, live Calendar service, Git publication, or unrelated product area was operated.

The current source hash of the normative SPEC still matches its owner-approval receipt. Current bytes were read as they stood in the dirty shared checkout. Unrelated owner edits were preserved; no reset, stash, cleanup, or whole-document rewrite was performed.

## Changed paths and acceptance mapping

**Code and test changes**

- `fusion-studio-server/test/screenshot-protected-view-path.test.js`: removed the remaining stale mock for deleted `lib/watch/core`. S2 had already removed the screenshot source-folder test setup and established direct capture correlation; that accepted code was preserved.
- `fusion-studio-server/lib/frontmatter/catalog.js`: changed the legacy `filter` type description to say it is retained for compatibility and has no active workspace watcher registration; set its documentation-only `activatesEventBus` marker to `false`. The S3 advisory was verified against current startup and loader source before correcting it.

**Canonical Wiki changes**

- `ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/006-Background_Services/PAGE.md`: removed the deleted watcher source-map entry; described retired workspace observation, watcher filters, file-driven trigger/theme updates, kept boot-time theme generation and independent services, and documented stale Apple cache, preserved Google polling, and future work links.
- `ai/RC-MacAir-15/Wiki/003-Automation_And_Agents/005-Background_Agents/PAGE.md`: clarified file-change definitions have no active input, while cron and chat/ticket/agent/system event registrations remain.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/006-Runtime_Model/PAGE.md`: kept the legacy exact-turn/late-event safeguards and collector, while removing any promise of generic external file observation from the retired workspace watcher.
- `ai/RC-MacAir-15/Wiki/004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md`: removed retired module source-map entries and refresh instructions; preserved direct in-app capture, saved PNG, pending attachment, gallery, and distinct ribbon preview behavior.
- `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/016-Calendar_View/PAGE.md`: recorded retired Apple auto-sync and stale-row limitation, preserved Calendar UI/routes/broadcaster and separate Google poller, disclaimed snapshot freshness, linked D-019/D-020 and I-021/I-022.
- `ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/PAGE.md`: replaced the Background Services ownership statement that described an active generic watcher; clarified Apple refresh loss and current storage/routes.
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`: documented the legacy topic's availability and the ledger's exclusion of `file:changed`.
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md`, `001-Universal_Event_Bus/PAGE.md`, `002-Event_Taxonomy/PAGE.md`, `003-Provenance_Model/PAGE.md`, `005-Resource_Events_And_Render_Sync/PAGE.md`, `007-Correlation_And_Causality/PAGE.md`, `008-Change_Storm_Control/PAGE.md`, and `010-Structure/PAGE.md`: aligned ledger whitelist, legacy bus, watcher/source map, metadata correlation and observation/causality descriptions with retired producer and preserved independent paths.
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md`: recorded that file-change blocks remain definitions without an active watcher input, while cron and event triggers keep their current owners.

The diff in these Wiki files also contains pre-existing dirty owner revisions from before S4. The list above identifies S4's specific edits; it is not an ownership claim over the entire dirty-file diff.

## Verification

| Check | Result |
|---|---|
| Focused integrated Jest command from `fusion-studio-server/` (ledger, screenshot correlation/protected path, trigger loader, cron, startup integration, shutdown, metadata collector) | **PASS**, 8 suites / 55 tests. First attempt exposed the stale deleted-module mocks in `screenshot-protected-view-path.test.js`; removed those mocks and reran successfully. |
| Required S2 Apple no-wait test `npx jest --runInBand --runTestsByPath test/calendar/apple-listener-retirement.test.js` | **PASS**, 1 suite / 1 test. No external Calendar service was contacted. |
| Full server suite `npm test -- --runInBand` on current code bytes | **PASS**, 219 suites / 3,244 passed / 1 skipped / 3,245 total. `pretest` ran `npm run build:native-observer`; node-gyp compiled and linked `secure_file_observer.node` successfully. |
| Client `npm run build` in `fusion-studio-client/` | **PASS**, preload build, TypeScript and Vite build completed. |
| Production source sweep from `fusion-studio-server/`: `! rg -n "require\(['\"]chokidar['\"]\)|from ['\"]chokidar['\"]|watch/core|watch/workspace-watcher|hotkey-screenshot-watcher|watch/calendar-watcher|abandonAll" lib package.json` | **PASS**, no matches. |
| Relative Markdown target check for 16 changed canonical pages | **PASS**, zero missing relative targets. |
| `git diff --check` over S4 code/tests and all assigned Wiki pages | **PASS**. |
| Public authenticated Electron/OpenCode chat through product UI, including acceptance, real child/session, completion, durable exchange identity and same-thread reopen/readback | **NOT RUN / BLOCKED**, details below. No automated test or readiness substitute is claimed. |

Warnings observed: Jest emits `(node) Warning: --localstorage-file was provided without a valid path`; the full suite also emits Node `[DEP0190]` for a child process using `shell: true`. Client build emits the existing `gray-matter` eval warning, a static/dynamic `CaptureTiles.tsx` import chunking warning, and a >500 KB minified chunk warning. These did not fail checks; their pre-existence was not independently established during this slice.

## Public UI smoke status and exact limitation

The mandatory public-route scenario was not attempted because the native UI automation bridge was unavailable. `cua.getState()` first timed out at 30 seconds and reset its kernel. The retry returned an empty native app list with this exact error: `Native apps: Error: Computer Use server error -10005: codex app-server exited before returning a response`. The caller then lacked a usable native UI surface to perform normal shell authentication and product actions. No scratch profile/workspace was created or launched; no owner normal profile, Alpha profile, database, provider credential, prompt, or user data was touched. There is no accepted `threadId`, provider PID/session identity, completed response, durable exchange identity, or reopen/readback evidence to report.

Therefore S4 does **not** satisfy SPEC §6.S4's public-chat pass criteria. The full server tests/build, helper tests, current startup evidence, and S1–S3 acceptance reports cannot substitute. The independent orchestrator must keep the SPEC blocked from owner review until a supported UI surface is available and the exact isolated public OpenCode scenario passes. No local chat failure was observed, so no spawn/launch/chat repair was attempted.

## Change-driven documentation sweep

Inspected every S4-assigned Wiki destination against the accepted SPEC and current code/startup/test owners. The sweep followed each changed claim across producer, consumer, persistence, lifecycle, and future-work boundary:

- ledger: only `workspace:switched` and `thread:state_changed` persist through the legacy ledger; independent subscribers and the bus topic remain;
- direct screenshot: in-app save/correlation and pending attachment remain, folder import/refresh retire, and gallery versus ribbon preview stay distinct;
- filesystem triggers/metadata: watcher-driven file triggers and broad external observation stop; exact-turn and ambiguous/late-event safeguards remain for any independently produced event;
- unrelated startup: cron, chat/ticket/agent/system event trigger owners, runner heartbeat, boot theme generation, mediated save/versioning and tool observations remain separately represented;
- Calendar: Apple callback removal means no current automatic Apple refresh and cached imported rows may stale; Google polling, UI/routes and completion broadcaster remain; snapshots and future native work are not presented as freshness or implemented behavior.

Changed-page relative targets were checked. A post-edit search for retired watcher/module source-map paths and stale claims found no remaining active-runtime assertion in the scoped pages. No Launchpad records outside this assigned implementation report were edited. The S3 `catalog.js` advisory is resolved in current code and these descriptions.

## Self-review, deviations, and residuals

Self-review confirmed that the test still covers protected-path safety plus direct screenshot capture, and that doc statements preserve event bus capability independently of the retired producer. No production watcher re-registration, replacement observation path, Calendar wait, service activation, database change, or user-profile operation was added.

Proposed deviations/out-of-allowlist touches for orchestrator classification:

1. **Frontmatter filter catalog correction** — `fusion-studio-server/lib/frontmatter/catalog.js` is an additional small product-source touch beyond the expected S4 source map/docs and test paths. Authority: the S3 reviewer advisory, expressly assigned to S4 for verification and correction if stale. Evidence: current loader/startup no longer registers filter file watching; previous catalog wording/marker described an active watcher. Observable effect: frontmatter catalog no longer advertises active file watcher filters. Verification: full server suite passed. Proposed classification: accepted / required documentation-adjacent correction; downstream effect is accurate filter consumers, no changed running trigger path.
2. **Stale screenshot test-fixture removal** — removed the remaining `lib/watch/core` mock from `test/screenshot-protected-view-path.test.js`; the screenshot source-folder test removal and direct capture assertions belonged to accepted S2 and were already present. Authority: S4 required current focused integrated checks and the approved S2 direct screenshot behavior. Observable effect: the test runs without resolving a retired watcher module. Verification: focused 8-suite command and full suite passed. Proposed classification: accepted mechanical integration; no runtime effect.

Residuals: public chat remains unverified due the concrete native UI bridge failure; no provider/runtime behavior can be accepted. The full build/suite warnings above remain. Future Apple monitoring/admission/lifecycle choices stay under D-019/D-020 and I-021/I-022; no monitoring or snapshot fallback was built. The report records the full-checkout dirty state as owner work and identifies only S4's scoped touches.

## Builder review gate and lifecycle

Current-byte self-review and required automated checks are complete. The fresh builder-owned reviewer received S4 criteria, current changed paths and this report without parent conversation or prior reviewer findings. Its status is terminal. No `close_agent` capability is exposed in this runtime, so a closure attempt was unavailable; lifecycle evidence is recorded below.

### Reviewer history

- **Reviewer:** `/root/slice_s4/s4_clean_room`; persistent UUID/host metadata unavailable.
- **Terminal result:** `BLOCKED / not CLEAN for acceptance`. Reviewer confirmed approved SPEC SHA-256, found no other material code/docs issue in its scoped review, but determined the public UI acceptance is mandatory and remains unsatisfied. It cited SPEC §6.S4 steps 1–4 and §8.8; exact CUA error and lack of thread/provider/response/readback evidence are recorded above. Automated results do not substitute.
- **Finding/repair:** no product repair was warranted because no local chat failure was observed. Required next action is rerun the exact public UI smoke when the supported native UI surface is available. No further reviewer pass can resolve that external execution blocker.
- **Closure:** no `close_agent` tool is available in this runtime; reviewer reached terminal final status.
