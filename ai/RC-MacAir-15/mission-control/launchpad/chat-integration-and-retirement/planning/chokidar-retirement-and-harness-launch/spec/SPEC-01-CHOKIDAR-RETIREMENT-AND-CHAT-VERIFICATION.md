# SPEC-01 — Chokidar Retirement and Public Chat Verification

- **Planning ID:** `CHAT-AR-SPEC-CHOKIDAR-RETIREMENT-001`
- **SPEC ID:** `CHAT-AR-SPEC-01`
- **Candidate status:** authored for independent candidate-stage and release validation; not approved for implementation
- **Authority:** current owner direction in “Map Fusion–OpenCode chat failure states” (local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`); owner amendment `planning/chokidar-retirement-and-harness-launch/reports/owner-direction-file-changed-ledger.md`; plugin-foundation D-015/D-016/D-019/D-020, I-021/I-022, and REF-018/REF-019/REF-020
- **Implementation checkout baseline:** `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`. The checkout was dirty overall; the scoped source and test paths listed below were clean at author inspection. Implementation must refresh status and fingerprints before editing.
- **Accepted shaping input:** `planning/chokidar-retirement-and-harness-launch/FIRST-DRAFT.md`, revision 2, SHA-256 `98329563e1ac24d1eeaa5753ad9490c10057cf9e9a065e912663ae1f3e907a9c`; independent draft validation `DRAFT_VALIDATED_FOR_DISCUSSION`, no material findings. The accepted draft's pre-amendment fallback-readiness hold is superseded by the current owner amendment and is not part of this SPEC.

## 1. Bundle index and purpose

This is a single bounded SPEC. It removes the Chokidar dependency and all runtime registrations that depend on it, retires the obsolete macOS screenshot-folder monitor and the optional Apple Calendar directory-listener, disables only legacy ledger recording of `file:changed`, and establishes ordinary authenticated Fusion chat operation through an actual OpenCode child, response, persistence, and readback after removal.

The SPEC is complete only when the implementation proves both removal and the accepted public chat behavior. A static import sweep, lower descriptor count, successful generic child spawn, `wire_ready`, deterministic fake provider, or healthy server process alone does not satisfy chat acceptance.

### Authority classes

| ID | Type | Contract and effect |
|---|---|---|
| A-01 | `owner_decision` | Remove Chokidar and its watch registrations and obsolete startup/refresh calls; establish real public chat operation afterward. |
| A-02 | `owner_decision` | Disable `file:changed` recording in the legacy ledger only. Keep workspace and thread ledger recording and other event listeners. |
| A-03 | `owner_decision` | Retire the old macOS screenshot-folder monitor; retain in-app direct capture, its correlated saved PNG, and pending chat attachment. |
| A-04 | `owner_decision` | Apple Calendar's directory listener may be removed only after confirming no server or renderer wait/race relies on its callback. Because the current `calendar/index.js` invokes Apple sync only from that callback, retiring it means no automatic Apple Calendar sync/refresh in this interim build; existing imported rows are not deleted and may become stale. Preserve the Calendar surface/handlers and separately opted-in Google poller. Route replacement Apple-native monitoring to I-021 as future separate work under D-020; the repo-local 30-minute snapshot fallback is not Calendar freshness. |
| A-05 | `owner_decision` | No replacement detector/readiness prerequisite. Periodic and event-triggered snapshots, their store/schema/migration, and future UEB/subscription delivery are separate future work. Existing mediated-save preimages/versioning, shadow Git checkpoints, tool-completion observations, cron and chat/ticket/agent/system event triggers stay independently owned. |
| A-06 | `owner_decision` | If normal public chat still fails after retirement, diagnose and repair the concrete failure found by that check within this workstream. Together retry and server warm-up are unconfirmed/separate; do not add speculative spawn, transport, UX, or stress redesign. |
| A-07 | `source_of_truth_contract` | The Chat System owns server-side prompt acceptance, thread identity, canonical harness translation, SQLite exchange persistence, and history readback. `threadId` remains the routing identity. |
| A-08 | `active_code_constraint` | The live tree has one broad workspace watcher and direct screenshot/Apple Calendar subscribers through `lib/watch/core.js`; startup also uses watcher filters and agent file-change filters. Existing source/hash inventory is in §3. |
| A-09 | `implementation_choice` | No SQLite schema or data migration is planned. The old `screenshot_source_folder` cache table/migration may remain inert; no startup or UI route may read/write it after watcher retirement. Reconsider only if implementation evidence shows active non-watcher ownership or a cleanup migration is strictly necessary. |

D-019 directs a separate bounded native Apple Mail/Calendar monitoring plan under I-021 and rejects the 30-minute repo snapshot fallback as Calendar freshness. D-020 further directs that a future native listener is plugin-owned, with System-managed scheduling and governed UEB admission; its schedule, producer, schema, delivery and lifecycle contract remains open under I-022. This SPEC records the interim absence of automatic Apple sync after removing its sole Chokidar callback; it does not implement native monitoring or gate Chokidar removal on that future work.

A-09 is an author implementation choice to avoid an unrelated destructive migration: the direct capture flow writes to the workspace's `ai/<machine>/Data/Screenshots/` and does not need the macOS source-folder cache. No approval to edit `fusion.db` or delete stored user state is implied.

## 2. Scope and contracts

### In scope

1. Remove Chokidar as a server runtime dependency and remove its shared watch core and broad project-root watch registration.
2. Remove watcher-only startup/filter plumbing and obsolete source-folder refresh calls. Keep supported consumers that do not need the watcher: boot-time theme CSS bootstrap, cron scheduling, and chat/ticket/agent/system event trigger subscriptions. File-change triggers, static watcher filters, and their automatic external-file observations stop; no replacement delivery is built.
3. Stop recording `file:changed` into the legacy event ledger while retaining ledger behavior for `workspace:switched` and `thread:state_changed`, and keeping the bus available to other existing listeners and producers.
4. Remove the old macOS screenshot-folder listener, its startup effect, and any UI/server refresh-source path whose only purpose is to follow that watcher. Preserve the direct in-app capture path, correlated `screenshot:file-captured` response, persisted workspace PNG and pending chat attachment. Gallery and workspace ribbon preview remain distinct.
5. Retire the Apple Calendar directory watcher only after confirming no server/renderer wait or race depends on its callback. Current source starts Apple sync only from this callback, so this removes automatic Apple refresh for the interim build; imported rows remain and may become stale. Preserve Calendar UI/routes and the separate opt-in Google poller and broadcaster. Route replacement Apple-native monitoring under plugin-foundation I-021 and D-020 as future work, with its open scheduler/producer/lifecycle contract tracked by I-022; the repo-local snapshot fallback is not Calendar freshness and is not a gate here.
6. Run focused automated checks and a later implementation-time public chat smoke that exercises normal shell authentication, new/activated thread, prompt, actual OpenCode child and session, assistant response, durable exchange, and history readback after removal.
7. Update implementation source maps, directly affected tests/startup inventories, and canonical Wiki pages after code/test outcomes are stable and before final SPEC integration is declared.

### Explicit non-goals and deferrals

- No new filesystem detector, native watcher, polling replacement, repository scan, watcher readiness gate, fallback scanner, snapshot database, migration, retention system, plugin grant, snapshot schema, or UEB/subscription trigger delivery.
- No Together.ai retry, provider networking, startup warm-up, generic process-spawn redesign, user-facing transport/failure redesign, descriptor scan, FD stress test, broad benchmark, or repeated provider probing.
- No deletion of saved exchanges, existing history, workspace/thread ledger records, user-save preimages/file versions, shadow Git checkpoints, or admitted tool-completion/resource observations.
- No blanket deletion of Calendar, screenshot gallery, screenshot request/attachment support, chat metadata collection interfaces, event bus, generic trigger actions, cron, or chat/ticket/agent/system event subscriptions.
- No reopening SPEC-06 or unrelated accepted work; no Alpha deployment or certification claim.

Stopping watcher-fed automatic observation is a known result of this retirement. The implementation must not preserve dead event producers by substituting another watcher, and must not claim that the preserved independent save/tool mechanisms cover every external edit or intermediate write.

## 3. Sources, current evidence, and freshness

### Input and authority fingerprints

| Source | Revision/fingerprint | Use and limit |
|---|---|---|
| Original owner conversation | local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, “Map Fusion–OpenCode chat failure states”; later direction is incorporated in REF-019 and owner amendment | Exact current owner intent; this planning author did not advance history/checkpoint state. |
| Owner amendment | `.../reports/owner-direction-file-changed-ledger.md`, SHA-256 `b564b62e86d968d56ae39e60f9f51be9e9e9cd5ff341dfcd901557fb5157e9e2` | Explicitly supersedes any snapshot-readiness prerequisite and states actual chat verification is required. |
| Plugin foundation current authorities | `DECISIONS.md` SHA-256 `727d55583268cc8fca1a0cd21aa1b059fefdbc9c125cc3434d97d9941750308e`; `ISSUES.md` `1e268cb7a699e71ae7f3669c0f60158601ba581153e175407ea2ef4722c0d868`; `REFERENCES.md` `8b8e1498877e440080d631c6ef1d071e96af617d0d495383a808965d10c5b6dd`; `INTENT.md` `034d8ea1fc3a5e34be7ec3faa9d831b52eab157d065f757fb385186e701148bd`; `TICKET.md` `6e6b56e88742c93edc6783aac58bb6ecba63b4071a28eb061652080905143fe7` | Current D-015/D-016/D-019/D-020, I-016/I-017/I-019/I-021/I-022 and REF-018/019/020. Snapshot and native-monitoring plans remain separate; neither gates this removal. |
| Preparation packet | `spec/PLANNING.md` SHA-256 `872c1187f9778f04f24de02945b86edf52b87c5eae5af3cc3e989fee3bfd3298`; parent `PLANNING.md` SHA-256 `f3e8a8f92235c2014be3b2baa8fcca1ff2a7c0aee0b96168014a376afde21e89` | Intake, prior evidence, operating restrictions. Read-only inputs for this author. |
| First Draft rev 2 | SHA-256 `98329563e1ac24d1eeaa5753ad9490c10057cf9e9a065e912663ae1f3e907a9c` | Shaping input only; no candidate slice is treated as already approved code behavior. |
| Draft validation rev 2 | `reports/independent-draft-review-revision-2.md`, SHA-256 `177264f784c3765e3ff05e44fad02737bf42ea8b6b1fcfe5f4abe81280dd9ff4` | `DRAFT_VALIDATED_FOR_DISCUSSION`; predates candidate and cannot validate this SPEC. |

### Implementation baseline and source fingerprints

Current checkout at author inspection: branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`. The checkout has extensive unrelated dirty Wiki, capture, issue, and state files. Do not reset, stash, or overwrite them. The scoped product files below were unmodified in `git status` and match the hashes recorded in the prior bounded audit.

| Current code path | SHA-256 | Verified finding / likely disposition |
|---|---|---|
| `fusion-studio-server/package.json` | `3833f2758cec00e0e4be6ba561def3732ed15f2796452b041d25bfb2c4e0389e` | Direct Chokidar dependency; remove dependency and refresh package lock. |
| `fusion-studio-server/package-lock.json` | `6ba2abd5d146a1897bcaffea03d89160f1bd79c52314aede9fd3a98c689a20e5` | Current lockfile; regenerate after dependency removal and record new hash. |
| `fusion-studio-server/lib/watch/core.js` | `3f0ea12c0732d0e44721709e21681358514aae7145c96d7763e81996829b8ba2` | Shared Chokidar singleton, three registrations, close/abandon lifecycle. Delete after callers removed. |
| `fusion-studio-server/lib/watch/workspace-watcher.js` | `acd4b8a7e58223c5c3fa0259f7c2d6471b618e769e98b24b2b3ed0c9104511b3` | Broad active-root watcher, filters, rename heuristic and `file:changed` producer. Remove runtime module/path. |
| `fusion-studio-server/lib/startup.js` | `9e6d99316fde584d08828685c3df762d1ea3e557d118b1e1207defe52993e382` | Startup screenshot and workspace watcher effects, filter setup, trigger loader, shutdown abandon callback, boot theme bootstrap. Remove watcher-only dependencies while retaining supported startup effects. |
| `fusion-studio-server/lib/screenshot/ws-handlers.js` | `4fe5c9bf3a55a59c0c68931cd6bb584154ad9229691ed6e173700684c137ac14` | Direct capture currently performs stale source-folder refreshes; `refresh-source` route refreshes the retired watcher. Remove only stale coupling. |
| `fusion-studio-server/lib/screenshot/hotkey-screenshot-watcher.js` | `c1295999db0687a23e5d6a3e48996146cd0897c6267c2a169d64fa9ed907f16f` | Folder import listener via core; retire module. |
| `fusion-studio-server/lib/screenshot/source-folder-service.js` | `08a4052ea6a2eeb66bda9c156530fb8ab6666cd6f41beed3cfc392d3b2706b82` | Reads macOS setting and caches source path for watcher; remove runtime ownership. Leave historical migration/data inert per A-09 unless fresh evidence changes that choice. |
| `fusion-studio-server/lib/calendar/index.js` | `3677e7563383c9e4c0b56077212247a7dab838a7492a1cc6ea4849b44804407b` | Starts Apple sync only through the directory watcher callback and separately starts Google poller. Removing the callback stops automatic Apple refresh; Google stays independent. |
| `fusion-studio-server/lib/watch/calendar-watcher.js` | `60dd2503592e65bab15c61b62b39b09957a91704f5cfb6f2ae640b163024044c` | Apple directory subscription via core; retire module. |
| `fusion-studio-server/lib/workspace/workspace-controller.js` | `4042bde78e7e6a7bfed1a6fd98828e8c82667632ef0143f09e3650d036ad2c27` | Workspace lifecycle has no watcher close/rebind path; earlier audit did not prove a leak. Do not add a new rebinding service as an assumed fix. |
| `fusion-studio-server/lib/harness/opencode/index.js` | `5dbe53e8f262661164dca0a87ab3f217ead35150629fd43ca42020685f9973e0` | OpenCode adapter path to inspect only if real post-retirement smoke gives a concrete launch failure. No adapter redesign is presumed. |
| `fusion-studio-client/src/screenshots/chatScreenshotCapture.ts` | `bd34c041e9f8fa6cfc7a328633af7c53566045b1e6e6c55ee61617d030a89687` | Direct app capture sends correlated file-capture request and uses saved path as pending attachment. Preserve. |
| `fusion-studio-server/lib/ledger/event-ledger.js` | `c5b68f7646535182a75f24be88783a631f8492b16904ddeedfcf480240cd08ca` | Whitelist currently contains workspace, thread, and file events; `recordEvent` already rejects types outside the whitelist. Remove only file type and its now-dead classification branches if tests prove no other owner uses them. |
| `fusion-studio-server/lib/ledger/event-ledger-subscriber.js` | `2ba6334af1c4a23a7829507434a2c3a3b688a9abb4b2a3ebf30d4f15bc8e0692` | Wildcard subscriber delegates only whitelisted event types to ledger. Preserve its lifecycle/drain. |
| `fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js` | `cbd83ed651b03a2eeee368f99210c6e1b52733a5179d765b7909d59d593b06d7` | Existing listener associates watcher emissions with active turns; do not assign observations arriving after turn completion. Preserve collector contract for any other producer; do not claim it receives filesystem data once Chokidar is removed. |

Prior reproduced EBADF evidence is retained as context, not recertified: `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/alpha-chat-launch-ebadf-ecobqazx/` contains a numeric descriptor boundary reproduction and sparse native probe. It does not identify actual production pipe descriptors, prove a leak, or prove Chokidar removal alone fixes chat. The required acceptance is the post-removal normal chat scenario in §7.

### Applicable standard and domain sources

Implementation must refresh and read in full the current versions of:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` (hub, SHA-256 `de3995c68ae84f3b0fa389c6af0327e21dd08f30ac9ffbc7548b76f80ac393d7`); and the routed `001-Architecture_Routing/PAGE.md` (`4c5fcbf62912c9e8ff6d3d0e1ec07016145e1f1c90c792a162dfcc3ca1b0bfba`), `004-WebSocket_Protocol/PAGE.md` (`5b77528cec69d60c11c0487a349ec1cfb0b9a47eb69c213dedd1fbf1797dbad6`), `005-Universal_Event_Bus/PAGE.md` (`4407d595f6f926996bd8bcacb6b0117849606de61662acfe463c3d80f8f4f640`), `006-Harness_Adapters/PAGE.md` (`5ece90e88dac136f7ec464b0219a3eb242b7837d118dbbdaba57de673b8a5919`), `007-Persistence_And_Metadata/PAGE.md` (`bd3e7be468289ac0a6ee6502cd8b9fc340f03fd7568deb59370ed00cc3b2a7a3`), and `008-Testing_And_Smoke_Slices/PAGE.md` (`e7319750bd27b7ccdad8e5e451b9779044e8fc7a713fc6d461113b409b39018d`). These constrain narrow cleanup, no new protocol/route, selective legacy-event handling, real public-route verification, and preserved persistence ownership.
- `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md` (SHA-256 `45fa9f630563d79935d5a461b308c823c0db3ded5c23817ba6d4c8a06c794ed5`): smallest useful abstraction, avoid compounding deferred work, present evidence and risks clearly.
- Required `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` (SHA-256 `696afb2d3ec027256e783957c3461eb03300db0b97b34b3e62162977c22ed42f`), plus `007-Chat_System/002-Harness_And_Event_Flow/001-Harness_Boundary/PAGE.md` (`c2befc2bfc71701074fae823ea1c13f1f2d87f4e19702b01e78f9407f01d52e2`), `007-Chat_System/005-Testing_And_Operations/PAGE.md` (`bf5109fd6a7a310a8d62311274708829df0ab9ab4ae09334ccb003d20701d37b`), and `007-Chat_System/006-Runtime_Model/PAGE.md` (`bccc60bdaee7052bbd1d36fd5e7a9c9a2f988eaf5455fd88eb290282fcdf5340`): provider normalization, thread/session identity, server-owned acceptance and durable exchange readback. Do not change those contracts in this SPEC.
- Supporting current contract for bounded event names and evidence: `010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md` (`c888e284547801d98ec1daacf5404902d896ea6618a1be9b3d0f28d19f76341a`), `003-Provenance_Model/PAGE.md` (`03252f26487d812ae5a9e24dfe09d8e717bed1741fdad970bab30714a49664f5`), and `003-Provenance_Model/004-Ledger_Event_Provenance_Schema/PAGE.md` (source read for bounded context). They do not authorize a substitute observation schema or causal assertion.
- Screenshot owner contract: `004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md` (SHA-256 `f2c246f03da1f9b6858f7dd28019368bc9a05de4f83a9a0dc8ab6cbaa9bae7a5`). Calendar distinction: `001-Workspaces_And_Views/016-Calendar_View/PAGE.md` (`3994815e9be4d446c3d3e235a5738d3b6f62d5c6a4def7ca76bf594a4d25c2b4`).

These are external authorities, not candidate deliverables. Implementation must refresh their hashes and check for newer owner direction before applying this SPEC.

## 4. Requirements and traceability

| Requirement | Authority | Implementation surface | Verification / disposition |
|---|---|---|---|
| R-01 Remove all direct Chokidar imports, package dependency and runtime watch registrations; no application-owned process watches repository/macOS directories via this dependency. | A-01 | Server package/lock, `lib/watch/*`, startup, screenshot and calendar subscribers | Focused suite, startup inventory/static import sweep, package dependency check. No replacement detector. |
| R-02 Remove broad workspace watcher and its watcher-only file filters/file-change trigger delivery; preserve unrelated actions and event/cron triggers. | A-01, A-05 | `startup.js`, `watcher/filter-loader.js`/`watcher/filters/*` callers, `triggers/trigger-loader.js`, runner heartbeat composition | Focused startup and trigger tests: event + cron registrations continue; watcher filters are no longer activated; file-change trigger effects do not claim delivery. |
| R-03 Stop legacy ledger writes for `file:changed` only; keep workspace/thread recording. | A-02 | `lib/ledger/event-ledger.js`, associated tests and event description docs | `recordEvent` returns no row for file change; emit-to-ledger test; workspace/thread events still persist and drain normally. |
| R-04 Retire old macOS screenshot import and its refresh route/coupling; preserve direct button capture + attachment. | A-03 | screenshot watcher/service, server WS handlers, client message type only if retired route is removed, screenshot tests, screenshot Wiki | Direct route writes PNG and echoes exact request ID/path; renderer adds returned path as pending attachment; no watcher startup or source refresh call. |
| R-05 Retire Apple directory listener only if no await/race depends on its callback; explicitly record that the callback currently triggers all automatic Apple sync, so Apple refresh stops in this interim build. Preserve Calendar UI/routes and the Google poller/broadcaster. | A-04, D-019 | `calendar/index.js`, `watch/calendar-watcher.js`, startup effect inventory/tests, Calendar/runtime docs | Source and focused tests show no waiter, promise gate, or renderer prerequisite; no automatic Apple sync remains, imported rows are not purged, Google stays wired. I-021 native monitoring under D-020 is future work and not a removal gate; I-022 tracks its open lifecycle/admission contract. |
| R-06 Preserve normal chat contracts and prove success after R-01 to R-05. | A-01, A-06, A-07 | Existing shell-authenticated public thread and prompt route; OpenCode adapter only if a concrete failure is observed | Runtime smoke in §7. Actual process/session, completed assistant result, accepted user + assistant exchange persisted and read back. |
| R-07 Update affected code maps/tests/Wiki to describe post-removal system accurately. | A-01 to A-05, reviewer advisory RV2-A01 | Implementation source maps, focused test/startup inventories, listed canonical Wiki pages | Documentation sweep/search after code/test evidence is stable; no remaining live claims that a retired watcher is active. |

### Coverage/disposition

- `CAPTURE/INTENT` and plugin-foundation D-015/D-016: carry future System-owned snapshot direction and links only as an explicit deferral. No scanner, schema or trigger migration belongs here. The current 30-minute repo snapshot fallback does not supply Mail/Calendar freshness.
- `CHAT-AR` TICKET and accepted First Draft cards CD-01..CD-04: CD-01/R-01..R-03; CD-02/R-04; CD-03/R-05; CD-04/R-06. These mappings are proposed candidate coverage, not delivered behavior.
- SPEC-06: remains accepted/closed with residuals; not reopened or used as proof of this work.
- Inferred FD cause: strong diagnostic hypothesis only. No requirement to achieve a target FD count or prove a production descriptor leak.

## 5. Dependencies and execution order

There is one SPEC and no cross-SPEC dependency. The internal order is:

1. **S1 — Disable only ledger file-change recording.** Independent narrow behavior change and tests; workspace/thread ledger durability/drain remains the baseline.
2. **S2 — Detach screenshot and Apple Calendar watcher consumers.** Remove old direct imports/registrations and obsolete refresh calls; assert screenshot direct flow and Calendar no-wait behavior. Keep Google poller and other calendar paths.
3. **S3 — Remove shared Chokidar core and broad watcher startup.** Once direct consumers are detached, remove broad watcher startup and close/abandon plumbing, dependency and dead filter registration. Refactor post-listen startup so cron and chat/ticket/agent/system event listeners still start, while file-change triggers/static file filters are intentionally inactive. Keep theme boot CSS regeneration and action handlers needed by surviving event-trigger/cron paths.
4. **S4 — Integrated acceptance, documentation and retirement audit.** Run exact focused automated checks, actual OpenCode public-route smoke, review scoped diffs, then update code maps and Wiki after all behavior is known. If the chat smoke identifies a concrete reproducible failure attributable to the local spawn/launch/chat route, add only the narrow correction required by that evidence and repeat the affected checks and the smoke. If it identifies a separate Together.ai, provider-network, generic transport, or unrelated product failure, preserve evidence and stop for owner routing; do not claim success or expand this SPEC speculatively.

A slice returns `READY_FOR_ORCHESTRATOR_REVIEW` only after its checks, self-review, deviation accounting and a materially clean builder-owned review. Each slice uses a fresh `mc-spec-slice-builder`; it may spawn only fresh `clean-room-reviewer` threads, never another builder, and stops after its first clean pass while repairing forward. The SPEC orchestrator independently inspects integrated changes with fresh `clean-room-reviewer` passes, stopping after its first clean pass and routing repairs otherwise. Every new slice uses a new builder. Material acceptance repair returns through a builder, fresh builder-owned review, and fresh orchestrator-owned review. Descendants inherit the approved invoking root model/effort. The orchestrator records all deviations and downstream effects. A roadmap implementation supervisor, if used, presents the completed SPEC to the owner for explicit acceptance before a following SPEC; there is no following SPEC in this candidate.

## 6. Executable slice packets

### S1 — Stop `file:changed` ledger recording

**Change:** Remove `file:changed` from `RECORDED_EVENT_TYPES`; preserve `workspace:switched`, `thread:state_changed`, wildcard subscriber/drain, and public event bus. Remove its ledger-only mapping branches only if the resulting code remains cohesive and the test/source sweep proves no remaining ledger writer needs them. Do not suppress `file:changed` globally or remove chat metadata/event listeners as part of ledger work.

**Expected areas:** `fusion-studio-server/lib/ledger/event-ledger.js`; `test/ledger/event-ledger.test.js`; relevant ledger tests only if they assert the changed whitelist. No database schema or migration.

**Automated checks (from `fusion-studio-server/`):**

```sh
npx jest --runInBand --runTestsByPath test/ledger/event-ledger.test.js
```

The updated tests must prove both direct `recordEvent` and subscriber emission ignore `file:changed` with no `event_log`/edge/tag writes, while `workspace:switched` and `thread:state_changed` still persist, unrelated event types remain ignored, and held-write shutdown drain behavior remains.

### S2 — Retire screenshot-folder and Apple Calendar directory listeners

**Change:** Delete `lib/screenshot/hotkey-screenshot-watcher.js` and `lib/watch/calendar-watcher.js` after removing imports. Remove the screenshot watcher startup effect and stale `sourceFolderService.refresh()` / watcher `.refresh()` calls from direct capture. Remove the user-invocable `screenshot:refresh-source` route and its client message union members if still present; this command only rebinds the retired folder monitor. Preserve `screenshot:file-capture`, the client request correlation, actual file save under active workspace `ai/<machine>/Data/Screenshots/`, returned saved path, and pending attachment. Remove `calendar/appleWatcher.start(...)` and any watch-only startup effect. Current `calendar/index.js` invokes Apple sync only through that callback, so no automatic Apple sync/refresh occurs after S2; existing imported Calendar rows are not deleted and may become stale. Preserve Calendar UI/routes, the shared `calendar:sync_complete` broadcaster, and independent opt-in Google polling. Do not substitute the repo 30-minute snapshot fallback for Calendar freshness. I-021 owns future native Apple monitoring planning/proof under D-020; I-022 tracks the open scheduling, producer, schema, delivery and lifecycle contract; do not implement it or gate this retirement on it.

**No-wait proof:** Inspect call sites and tests for `calendar.start`, Apple sync/watch callback, Calendar initialization, and renderer wait logic. A waiter/race is absent only when no Promise or startup/render-ready gate waits on the Apple directory callback/sync event. Add a focused startup test or deterministic unit test establishing ordinary startup/Calendar surface progress without any Apple directory notification; preserve Google poll path assertions. Do not call external Calendar services during this check. Record the intentionally missing automatic Apple refresh until a separately approved I-021 native connector is released; do not imply stale cached rows are current.

**Expected areas:** `lib/screenshot/ws-handlers.js`, screenshot watcher/source service module and associated server tests; client screenshot message type declaration only if refresh-source is retired; `lib/calendar/index.js`, `lib/watch/calendar-watcher.js`, Calendar startup tests, and existing Google poller/broadcaster tests. Preserve `screenshot_source_folder` schema/history per A-09; do not edit migration history or database contents.

**Automated checks (from `fusion-studio-server/`):**

```sh
npx jest --runInBand --runTestsByPath test/screenshot-file-capture-request-id.test.js test/screenshot-protected-view-path.test.js test/calendar/apple-listener-retirement.test.js
```

Add `test/calendar/apple-listener-retirement.test.js` for the no-wait proof and update focused screenshot assertions so a successful direct handler request produces a saved in-workspace PNG response with the original request ID and never invokes a folder service/watcher. The client-side capture flow must continue waiting for that matching ID and add only its saved path as pending attachment. Reuse an existing client harness if available; otherwise cover the direct client helper with the smallest focused test in its established test location.

### S3 — Remove shared Chokidar core and broad workspace watch registration

**Change:** Remove `lib/watch/core.js`, `lib/watch/workspace-watcher.js`, direct dependency and lockfile edge after confirming no remaining imports or runtime registrations. Remove the workspace watcher startup and its shutdown `closeWatchers`/`abandonAll` callback path when it has no other owner. Remove static watcher filter startup (`loadFilters` and registrations) and watcher-only file-change trigger activation. Keep component loading, action handlers used by active routes, post-listen startup, cron scheduling, chat/ticket/agent/system event trigger subscribers and runner heartbeat. Keep boot-time `themes.json` → `themes.css` regeneration and app-mediated theme operations; retire only file-change-driven regeneration. Preserve existing save/versioning and agent tool-completion observation owners. The `file:changed` bus event remains available if another independent future/legacy producer uses it; only its ledger writer is removed in S1.

**Consumer disposition:**

- watcher filters and `TRIGGERS.md` `file-change` blocks no longer fire automatically; no replacement, readiness gate, scanning or alternative observation source is added;
- cron triggers and `chat`, `ticket`, `agent`, `system` event blocks continue registering and dispatching through existing owners;
- legacy chat metadata collector remains wired for any other legitimate producer and keeps its exact-turn/late-event safeguards, but SPEC completion makes no promise of external file observations from a retired watcher;
- ticket dispatcher's bus subscriber remains as code, but prior source audit found no active startup registration; do not silently activate it;
- background service safety/logging and event-bus guard behavior remain unchanged.

**Automated checks (from `fusion-studio-server/`):**

```sh
npx jest --runInBand --runTestsByPath \
  test/watch/watcher-retirement.test.js \
  test/triggers/trigger-loader.test.js \
  test/triggers/cron-scheduler.test.js \
  test/event-registry/startup-integration.test.js \
  test/shutdown.test.js \
  test/chat-metadata/file-mutations-collector.test.js
```

Replace the old watcher implementation test with `test/watch/watcher-retirement.test.js`, focused on the startup/package/runtime inventory and intentional absence of watcher activation; do not leave tests passing by mocking away the changed boundary. Preserve event-trigger and cron tests. Startup tests must assert there is no Chokidar/workspace/screenshot/Apple watcher startup or shutdown hook, that public server startup and unrelated registry/provenance owners retain their established ordering, and that non-file triggers still activate after listen. Static production-source sweep from `fusion-studio-server/` (a match is a failure; historical assertions may retain names under `test/`):

```sh
! rg -n "require\(['\"]chokidar['\"]\)|from ['\"]chokidar['\"]|watch/core|watch/workspace-watcher|hotkey-screenshot-watcher|watch/calendar-watcher|abandonAll" lib package.json
```

Expected: no production import/registration/dependency; test fixtures may contain historical strings only when a regression assertion specifically requires their absence. The package lock must no longer record Chokidar as a direct dependency; a transitive package reference is acceptable only if another actual dependency requires it.

### S4 — Integrated behavior, public OpenCode chat and documentation

This slice owns the final cross-cutting retirement verification and doc integration only after S1–S3 are implemented. Verify all current bytes and user data paths before any live app operation. Use an isolated disposable Electron profile and scratch workspace, not Alpha and not the owner's normal chat database; preserve the selected machine subtree and workspace identity consistently. Do not remove or replace existing profile databases as cleanup.

**Exact manual/public-route procedure:**

1. Start the ordinary development Electron shell/server on the scratch profile/workspace using the normal authenticated shell route and current supported OpenCode CLI policy. Do not invoke an adapter helper as a substitute.
2. Through the product UI, create/activate a new public thread and send one short, non-sensitive prompt expected to yield a brief response. Observe normal server-owned acceptance and a real OpenCode child process/session (PID/session identity from the harness's existing safe operational evidence), not a fake executable or generic Node child.
3. Wait for a completed assistant response translated into normal chat state. Record the created `threadId`, provider session identity, response completion, and exact exchange identity from supported product logs/test instrumentation with secrets and prompt content redacted.
4. Reopen/reconnect the same `threadId` through normal history hydration and confirm the accepted user prompt and assistant response are present from durable exchange storage. Confirm the exact thread/provider session ownership did not change and there is no duplicate exchange.
5. Inspect focused server logs only for the fixed evidence needed to correlate process launch and completion; do not expose credentials, raw provider output, or unrelated user data. Stop the scratch app/server through the established shutdown path and preserve the scratch evidence until its report is reviewed.

**Pass criteria:** one authenticated public prompt is accepted; an actual OpenCode process/session starts; the assistant produces a completed response; the user/assistant exchange persists and is returned by readback/reopen; no duplicate, wrong-thread, or missing exchange appears. Chokidar imports/registrations are absent, Apple no-wait proof passes, Google and independent trigger/ledger/screenshot contracts pass, and scoped regression tests/build pass. Server boot or `wire_ready` alone is not pass.

If the prompt fails, preserve the exact failure boundary. Reproduce once only as required to distinguish transient evidence from the same deterministic failure. Examine the actual spawned command/pipe path only after an observed local launch failure. Repair only the concrete launch/chat failure shown by the approved scenario; do not assume the EBADF hypothesis, add broad FD scanning, introduce a generic spawn subsystem, redesign provider retry, or expand into Together.ai. Re-run the affected automated checks and full public chat acceptance after repair. If the observed failure belongs to a separately deferred system (Together.ai, external provider availability, unrelated shell transport) and cannot be safely corrected within this bounded launch/removal contract, report `RUNTIME_BLOCKED` with evidence; do not claim this SPEC's chat acceptance or invent a workaround.

**Focused integrated automated verification (from `fusion-studio-server/`):**

```sh
npx jest --runInBand --runTestsByPath \
  test/ledger/event-ledger.test.js \
  test/screenshot-file-capture-request-id.test.js \
  test/screenshot-protected-view-path.test.js \
  test/triggers/trigger-loader.test.js \
  test/triggers/cron-scheduler.test.js \
  test/event-registry/startup-integration.test.js \
  test/shutdown.test.js \
  test/chat-metadata/file-mutations-collector.test.js
```

Also run the server suite and client build required by the Chat Testing and Operations guidance when feasible: `cd fusion-studio-server && npm test -- --runInBand` and `cd fusion-studio-client && npm run build`. In the current package, `npm test` invokes `pretest` (`npm run build:native-observer`) before Jest; report that native build as part of command outcome. Never let broad suite completion replace the required public OpenCode smoke.

### Implementation source-map and documentation assignment (RV2-A01)

Implementation owns these updates; canonical Wiki is read-only during candidate creation. First update tests and code references alongside the corresponding code slice. After focused tests have passed and S4 determines actual behavior, update the canonical descriptions below before final SPEC review. If the public chat outcome fails or a code change invalidates a proposed description, update text to match evidence, not the intended result. Do not update unrelated dirty Wiki pages or reformat whole documents.

| Wiki/document path | Required change and timing |
|---|---|
| `Wiki/002-Server_And_Runtime/006-Background_Services/PAGE.md` | After S3: remove claim of active generic watcher and file-change publication; describe retired automatic watcher/file trigger input and preserved independent background services. |
| `Wiki/003-Automation_And_Agents/005-Background_Agents/PAGE.md` | After S3: distinguish still-active cron/event triggers from inactive file-change trigger blocks; refresh stale `source-files` only if modules are actually removed. |
| `Wiki/007-Chat_System/006-Runtime_Model/PAGE.md` | After S3/S4: update the watcher-to-active-turn metadata observation description and clearly retain exact-turn/late-event safeguards and independent tool/save evidence. Do not claim external file observation remains. |
| `Wiki/004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md` | After S2: state old macOS screenshot-folder auto-import/source refresh is retired; preserve direct in-app capture, saved PNG, attachment, gallery and separate ribbon preview. Remove stale setup instructions that tell users to refresh/restart a watcher. |
| `Wiki/001-Workspaces_And_Views/016-Calendar_View/PAGE.md` and `Wiki/002-Server_And_Runtime/006-Background_Services/PAGE.md` | After S2: state that retiring the Apple directory callback stops current automatic Apple sync/refresh, existing imported rows are not purged and may become stale, and Google five-minute opt-in polling and Calendar UI/routes remain separate. Link D-019/D-020 and I-021/I-022 native monitoring as future proof with open latency/coverage/permission/resource and lifecycle/admission choices; explicitly state repo-local 30-minute snapshots are not Calendar freshness. Do not imply Calendar is deleted or native monitoring is implemented. |
| `Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md` | After S1/S3: accurately document legacy bus availability and that the ledger no longer records `file:changed`; keep other whitelist/current governance claims accurate. |
| `Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md`, `001-Universal_Event_Bus/PAGE.md`, `002-Event_Taxonomy/PAGE.md`, `003-Provenance_Model/PAGE.md`, `005-Resource_Events_And_Render_Sync/PAGE.md`, `007-Correlation_And_Causality/PAGE.md`, `008-Change_Storm_Control/PAGE.md`, `010-Structure/PAGE.md` | After S1/S3: align ledger whitelist and watcher/source-map descriptions with the removal; preserve distinction between legacy bus capability and events actively produced; preserve non-causal evidence limits and independent version/tool paths. Avoid rewriting unrelated proposals. |
| `Wiki/010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md` | After S3: document that cron and event blocks remain, but file-change blocks have no active watcher input pending future separately authorized delivery. |
| `Wiki/002-Server_And_Runtime/PAGE.md` | After S3: source map/ownership link must no longer call Background Services the owner of a live generic watcher. |

The existing screenshot-source DB table/migration is intentionally not altered under A-09. The direct file-capture route and browser/renderer pending attachment are treated as a preservation contract, not documentation-only status. Calendar docs are updated only for behavior they actually describe.

## 7. Failure behavior, migration, compatibility and integration

- There is no `fusion.db` migration or data cleanup in this SPEC. Existing saved exchanges, event history, screenshot-source cache row and all independent file-version/provenance records remain untouched.
- Dependency cleanup updates `package.json` and its lockfile using the repository's package manager. Do not delete a transitive Chokidar node if another package demonstrably requires it; no application source may import it or register a watcher.
- Shutdown no longer needs a Chokidar abandon hook, but all active turns, audit saves, legacy ledger writes, governed subscriptions and databases retain their current owner and shutdown ordering. Update shutdown unit tests to prove removal of only the watcher callback does not skip other phases.
- No public WebSocket route is added. Removing `screenshot:refresh-source` is an intentional retirement of the command for the removed monitor; the `screenshot:file-capture` request/response contract remains unchanged.
- The legacy `file:changed` topic itself is not prohibited. The broad watcher no longer emits it; no ledger row is created for it. Other subscribers must not be removed solely because this producer goes away.
- No replacement path starts observing workspaces, user screenshot folders, Apple Calendar directories, or theme JSON changes as files. The startup theme CSS bootstrap still handles its existing boot-time job.
- Keep the accepted future sequence (fallback observes an eligible file mutation, then subscribed trigger may run) as future planning context. This SPEC neither supplies detection during the gap nor blocks removal waiting for a future scanner.

## 8. Integration acceptance and reporting

The SPEC orchestrator's final integration must show:

1. A changed-path/deviation list against the dirty checkout, with every out-of-scope or unplanned deviation mapped to downstream impact.
2. Focused automated checks and relevant full suite/build outcomes, including native pretest/build behavior and pre-existing warnings.
3. No production import, dependency or startup registration for Chokidar/workspace, screenshot-folder, or Apple Calendar directory watchers; no watcher close/abandon dependency remains.
4. Ledger tests prove `file:changed` is excluded and workspace/thread rows remain.
5. Direct screenshot route and pending attachment work without source-folder refresh; gallery and workspace preview behavior remains distinct.
6. Apple startup/render code has no wait/race on its directory callback; report that its current automatic sync stops and cached rows may become stale pending separately owned I-021/D-020 work, with its lifecycle/admission contract open under I-022; preserve the Google poller and shared Calendar completion broadcaster. Repo-local 30-minute snapshots are not presented as Calendar freshness.
7. Cron plus `chat`, `ticket`, `agent`, and `system` event triggers still register through their existing bus owner; no file-change filters or file-change trigger delivery is silently represented as active.
8. Public OpenCode chat smoke passes every criterion in §6.S4. If not, acceptance is blocked with exact evidence; no descriptor-based inference substitutes.
9. Canonical Wiki, affected tests and module/source maps were updated at the specified integration point and checked for stale claims.
10. Independent slice-builder and SPEC-orchestrator review gates are materially clean; every deviation and remaining external limitation is recorded.

## 9. Dependencies, deferrals and release gates

| Item | Owner / state | Trigger to resume and required evidence | Effect here |
|---|---|---|---|
| System-owned periodic/event snapshots, repository-local SQLite storage, schema/path/migration/grants, preserved edit history, copies/windows and association links | Plugin Foundation, System/file-versioning and event/trigger owners; future planning and implementation | Separately authorized candidate and implementation; accepted schema/grant contract, migration and runtime evidence for capture/fallback/delivery before that future feature is released. | No dependency. Removal does not wait for replacement readiness and does not claim equivalent coverage. |
| Future UEB/subscription file-trigger delivery | Trigger/UEB owners; future | Separately approved delivery contract with source permissions, subscriber behavior and event/file timing; prove intended fallback-first trigger order. | Existing file-change trigger execution stops with its producer. No replacement in this SPEC. |
| Future event from direct screenshot button | Screenshot/System/UEB owners; future | Separate schema/event assignment and accepted source contract. | Direct capture and attachment remain; event is not required now. |
| Apple Mail/Calendar change monitoring | Plugin-foundation I-021 under owner D-019/D-020; separate, open work, with the scheduling/producer/schema/delivery/lifecycle contract open under I-022. | Owner selects latency/coverage priorities; native connector owners prove mechanism, permissions, lifecycle and resource budget; event/view owners define invalidation; plugin-foundation owns capability/grant seam. I-021's bounded proof covers a Calendar edit via EventKit, incoming Mail and read/move signal/reconciliation, end-to-end delay, descriptor use, and Mail-closed behavior. | Current Chokidar removal leaves no automatic Apple Calendar sync/refresh; imported rows are not deleted and may become stale. I-021/I-022 are not gates on this SPEC. The 30-minute repo-file snapshot fallback is explicitly not Mail/Calendar freshness. Do not implement native monitoring here. |
| Together.ai socket retry and server warm-up | Separate, unconfirmed hypothesis | New direct evidence and separately authorized work. | Not part of this SPEC and not a reason to weaken OpenCode proof. |
| Broader health/logging, bookmarks, unrelated Alpha reports or global user telemetry | Health/other workstreams | Their respective TICKET and owner approval. | Explicitly out of scope. |

All deliverables require implementation approval. This candidate is not approved by this SPEC's existence, `CANDIDATE.json`, a clean author self-check, candidate-stage review, or release review alone. After fresh candidate and release validation, the Creation Supervisor presents the exact candidate ID and evidence for owner approval. Implementation may then use the existing direct `$mc-orchestrator` route for this single approved SPEC, or the external-packet-capable `$mc-roadmap-implementation-supervisor`; neither route is invoked here. Any future multi-SPEC supervisor must retain explicit owner acceptance before moving to a following SPEC.

## 10. Author self-check (not an independent gate)

- One SPEC is justified by a single retirement and its required chat proof; no artificial roadmap hierarchy or extra snapshot SPEC is included.
- Current owner amendment supersedes the draft's readiness hold only within current Chokidar retirement. Future scanner/UEB work is kept separate with resolver, trigger and evidence conditions.
- All removals are paired with remaining consumer behavior: event/cron triggers, direct screenshot, Google polling, shared calendar routes/broadcaster, workspace/thread ledger history and Chat persistence.
- New source claims distinguish observation from cause; FD evidence remains a hypothesis, and public OpenCode chat success is a required implementation-time observation.
- Concrete screenshot refresh and Calendar no-wait tasks are bounded. S2's known interim loss of automatic Apple refresh is explicit and routed to I-021/D-020, with I-022 still open; it is not replaced by repo snapshots or a gate. The runtime smoke cannot pass on helper spawn, fake provider, startup readiness, DB size, FD count, or unverified acceptance.
- Documentation ownership and update timing for source maps, legacy ledger/resource-event descriptions, screenshot, Apple Calendar, chat metadata, tests and startup inventories are explicit.
- No product, tests, Wiki, DB, runtime, Alpha, provider, external message, checkpoint or shared/sibling coordination document was changed by this author.
- Open owner questions: none identified. If current implementation inspection during execution finds an actual server/renderer wait on Apple callback or shows another live owner for screenshot source cache, that concrete evidence routes to the SPEC orchestrator before repair; it is not silently assumed away.

## 11. Proposed handoff

After the stage orchestrator's independent candidate validation and repairs, a fresh independent release validator should review this exact manifest and all normative coverage. If release validation is clean, return `CANDIDATE_READY_FOR_OWNER_APPROVAL`; do not create or assign implementation until owner approval of the exact candidate. The downstream implementer starts with fresh checkout/worktree status, confirms current standards and source hashes, and follows slices S1–S4 with the per-slice builder/orchestrator gates above.
