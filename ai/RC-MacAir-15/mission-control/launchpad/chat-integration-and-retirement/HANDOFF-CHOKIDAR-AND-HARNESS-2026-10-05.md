# Handoff: Chokidar retirement, New Chat failure and OpenCode investigation

> Owner-requested work handoff, recorded 2026-10-05 at 16:08 UTC / 9:08 a.m. PDT. This describes implementation, evidence and unfinished verification. It does not grant final acceptance, publication or a new assignment.

Prepared by **Codex side chat (ephemeral)**, source task **Map Fusion–OpenCode chat failure states**, `01a0ea32-f152-77a2-afc2-b73e8976685a` (`local`). This source task coordinated the bounded investigation and owner-authorized retirement implementation; it is not the registered main of this folder.

## Current position

**The Chokidar removal has passed its automated and independent slice checks. The required actual OpenCode chat test has not passed. Overall work remains `NATIVE_CHECK_WAITING_OWNER_MANUAL_RESULT`.** A reproduced New Chat selection defect was repaired and reviewed, then the isolated app was rebuilt and restarted. There is no successful owner result demonstrating New Chat selection, completed provider response, durable exchange and reopening on those refreshed bytes.

The owner reported that clicking New Chat did not select a usable new chat and that rendering seemed delayed. They then questioned the smoke-test claims, overlapping processes, possible file growth and whether this targeted removal had caused regressions. The source task began a read-only causation audit; the owner requested this handoff before that audit finished. **The cause of the render delay and the relationship between retirement and the owner's previously working runtime remain unresolved.** Do not present either as settled.

No commit, push, merge or Alpha update was performed for this retirement work. Earlier accepted CHAT-SIMPLE work and historical SPEC-06 acceptance remain as recorded in [TICKET](TICKET.md); this assignment does not reopen them.

## Authority, sessions and checkout

| Item | Verified identity / scope |
|---|---|
| Product checkout | `/Users/rccurtrightjr./projects/fs-dev` |
| Branch and baseline HEAD | `agent/exact-workspace-paths`; `d15792920731f85e45b743519d4af2b807d95a9c` (rechecked for this handoff) |
| Planning task | `01a10120-0665-7413-befe-84e3861153c4`, local; **SPEC creation: Chokidar retirement and chat verification**; draft/creation handoff completed |
| Implementation task | `01a1042c-09df-7473-a1e1-f458eee6b93d`, local; **Orchestrator: Chokidar retirement and chat verification** |
| Latest implementation observation | Idle; most recent turn interrupted after restart-receipt verification, with owner manual testing pending. Inspect its current state before resuming or assigning overlapping work. |
| Registered folder main | `01a0e6c9-e4e0-7872-9268-9a77a76f0c57`, local; **Resume chat integration work** |
| Checkpoint state | [CHECKPOINT.json](CHECKPOINT.json) still has `lastCheckpoint: null`. This handoff does not rebind or advance it. |

The worktree contains extensive unrelated owner and worker changes, including Wiki, configuration and workspace state. Do not treat the whole dirty diff as this assignment, reset it, or restore capsule state without determining ownership. This source task yields after saving the requested handoff. Mission Control is not activated by this document.

## Work completed and owner boundaries

### Investigation and planning

Initial diagnosis separated a local launch failure from intermittent provider/socket failures. During discussion, the source task prematurely edited startup code and tests. The owner stopped that approach and required **First Draft → SPEC → implementation**. Those premature edits were reverted and verified before the managed planning run. Preserve that correction when explaining how this work was authorized.

The managed [First Draft](planning/chokidar-retirement-and-harness-launch/FIRST-DRAFT.md) was revised, independently [validated](planning/chokidar-retirement-and-harness-launch/reports/independent-draft-review-revision-2.md), corrected through [preflight](planning/chokidar-retirement-and-harness-launch/reports/preflight-spec-handoff-revision-2.md), and sent to SPEC creation. Candidate creation and [release validation](planning/chokidar-retirement-and-harness-launch/spec/reports/release-validation.md) completed before owner dispatch.

Approved SPEC: [CHAT-AR-SPEC-01](planning/chokidar-retirement-and-harness-launch/spec/SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md).

- Candidate: `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`.
- Normative SPEC SHA-256: `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`.
- [Manifest](planning/chokidar-retirement-and-harness-launch/spec/CANDIDATE.json), [owner approval](planning/chokidar-retirement-and-harness-launch/spec/OWNER-APPROVAL.md), and [implementation dispatch](planning/chokidar-retirement-and-harness-launch/spec/IMPLEMENTATION-DISPATCH.md) preserve exact authority. Owner direction: “Send it to an Orchestrator, tell it to message you when complete.” This authorizes implementation and completion/blocker reporting, not final acceptance or publication. Normative SPEC bytes were preserved.

### Retirement implementation

The current [slice/deviation ledger](planning/chokidar-retirement-and-harness-launch/spec/implementation/SLICE-AND-DEVIATION-LEDGER.md) is the implementation return point; use its latest disposition over dated initial S4 reports.

| Slice | Changes and retained behavior | Disposition |
|---|---|---|
| S1 | Disable only legacy ledger recording of `file:changed`. Preserve workspace/thread durability, other event classes and subscriber lifecycle. | Internally accepted through builder and independent orchestrator gates. |
| S2 | Delete obsolete macOS screenshot-folder auto-import and unfinished Apple Calendar directory listener. Preserve direct in-app screenshot capture, saved PNG/correlated request/attachment/gallery; Calendar UI/routes/shared broadcaster and opt-in Google polling. | Internally accepted. Apple automatic refresh ceases and cached imported rows can become stale until separately approved replacement work. |
| S3 | Remove shared Chokidar core, broad workspace watcher, startup/shutdown/filter plumbing, file-trigger watching and package dependency. Preserve theme bootstrap, cron and chat/ticket/agent/system triggers, mediated-save preimages, shadow Git and admitted post-tool observations. | Internally accepted. No replacement scanner or file-change trigger mechanism added. |
| S4 | Integrated checks and Wiki/source-map updates; required ordinary authenticated OpenCode UI prompt, completion, persisted exchange and reopening. Concrete New Chat repair added after owner failure report. | Automated checks and bounded repair gates passed; actual public chat scenario and refreshed final integration remain pending. |

Future snapshots were recorded in **plugin-foundation**, specifically [D-015–D-017](../plugin-foundation/DECISIONS.md), [capture synthesis](../plugin-foundation/CAPTURE.md), and [REF-018/019](../plugin-foundation/REFERENCES.md). Direction: System owns snapshots; plugins declare permissions/source/destination; repository-local SQLite; event-triggered capture plus a half-hour fallback; linked events without asserting causation. This is future work, not a prerequisite for removal. The current implementation must not silently grow into scanner, subscription or trigger redesign. The new screenshot path's future System-event emission is likewise deferred. Native Apple Mail/Calendar freshness work is separate from repository snapshots.

## Evidence for the original launch failure

Alpha's accepted-message/no-response incident was captured as **synchronous `spawn EBADF` before an OpenCode PID returned**. SQLite recorded durable acceptance and dispatch claim, followed by `provider_failed`. Watcher-heavy process observations found approximately 16,242 descriptors on Alpha and 16,837 on development; most were checkout vnode/file watches.

Controlled macOS reproductions supported a descriptor-number limit in child launch setup: valid descriptor 10,239 worked while 10,240 and 16,300 produced `EBADF`; piped Node launches failed with approximately 10,300/16,300 held descriptors and worked with inherited stdio or after releasing handles. This is strong evidence connecting watcher footprint to the local launch problem. Actual production pipe numbers were not captured, and a leaking descriptor lifecycle was not proved. **Removing Chokidar does not by itself certify actual chat operation.**

The database size was not shown to cause this failure. Historical rows do not keep files open, and the examined send path used targeted receipt queries. The watcher covered the broad fs-dev checkout, including other machine subtrees. Alpha had six registered workspaces in the inspected registry, despite one being visible in the owner's context; visibility and registration were different facts.

Temporary diagnostic evidence, which may disappear with OS cleanup:

- `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/alpha-chat-launch-ebadf-ecobqazx/`
- `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/fusion-profile-path-comparison-guolzbn5/observations.json`

Existing `temp_chat_boundary_v1` / `TEMP CHAT-AR I-007` traces retain their future removal/migration obligation when governed health subscriptions replace them. Logger design remains in the health folder.

## New Chat failure and repair

Owner report: “Selecting new chat doesn't work, and it seems to have inserted a render delay before it appears.” Read-only inspection of the isolated profile found four newly created OpenCode chats with zero messages. The server had created authoritative Capture-bound thread groups, but the oldest Capture group remained selected. Null `threads.view_id` was expected because binding belongs to `thread_groups.view_id`; it did not establish failed server binding.

The builder reproduced the second-create selection failure through the production handler and store before repair: an uncorrelated view-bound `thread:created` wrote legacy global `currentThreadId` instead of selecting the newly created view/group. The repair in `fusion-studio-client/src/lib/ws/thread-handlers.ts` uses existing `requestGroupSelection` and save/conflict/ACK behavior for registered adapters, and an exact pending open for adapterless views. Correlated, Legacy and null-view routes retain their ownership.

Evidence: [builder packet](planning/chokidar-retirement-and-harness-launch/spec/implementation/S4-new-chat-repair-builder-2026-10-05.md) and [orchestrator repair/runtime report](planning/chokidar-retirement-and-harness-launch/spec/implementation/S4-new-chat-orchestrator-2026-10-05.md). Ledger D-02/D-03 records the bounded repair and fixture corrections. Builder and orchestrator independently passed **34/34 focused isolated tests and client build**; separate fresh repair reviewers returned CLEAN. These tests did not exercise the owner's live provider account and do not close S4.

Reviewed repair hashes, rechecked before handoff:

| File | SHA-256 |
|---|---|
| `fusion-studio-client/src/lib/ws/thread-handlers.ts` | `7b45de46522d0cb67666bf63fe286474eb9c4e3fb6e6ee644ae5cf5e7058d81b` |
| `fusion-studio-client/e2e/threaded-chat-host.spec.ts` | `ec6802c336107d25e1b443a3bf3519a002eef7c86cf2ea8dc74d7fc839bafb27` |
| `fusion-studio-client/e2e/chat-send-transport.spec.ts` | `c6b5b57d57e450e2d7e5927d75adeee686f200dd3da61b0d94b983885a5a0e3b` |

### Unresolved causation and size questions

The defective global-selection branch exists at the pre-retirement HEAD. That establishes an older source defect; it does not establish what changed between the owner's known working app and the reported failure. There is no matched before/after trial using the same artifact, profile and workspace. Retirement also changed startup readiness plumbing by removing `startWorkspacePipelineWhenReady` and calling `_startPipeline` directly; its timing relationship has not been fully audited. Do not assume it is defective or irrelevant.

The scoped tracked product-source/package diff was **20 files, 58 insertions, 1,039 deletions** (net 981 lines removed), excluding tests/docs and unrelated work. `thread-handlers.ts` grew 404 → 419 lines; startup shrank 891 → 862, trigger loader 302 → 210, filter loader 244 → 59. The local handler growth is real, but this work did not broadly expand those source files. The reviewed repair adds no rendering timer, and no rendering component was changed by that patch. Those facts do not explain the observed delay.

One renderer observation showed 163.5% CPU and an approximately 3.7 GB native-sample footprint. A later DOM snapshot counted 92,252 nodes, 1,452 buttons, 105 disabled inputs and two local iframes; all nine mounted main-chat textareas were disabled. A later CPU snapshot was idle. These are symptoms, not a proven leak or source attribution. Native sample: `/tmp/fusion-chat-ar-smoke.wZoDy5/renderer-new-chat-delay.sample.txt`. No broad performance repair was undertaken.

## Verification limits and runtime to preserve

Reported retirement verification: full server suite **219 suites / 3,244 passed / 1 skipped**; focused integration **8 suites / 55 tests**; Apple no-wait test; client build; source absence sweep; 16 Wiki-page link checks; diff check. Initial final integrated review was `CLEAN-EXCEPT-UI-BLOCKER` and did not independently rerun product tests. After the renderer repair, focused build/tests were independently rerun. Fresh final integration must follow actual public runtime evidence on current bytes.

Native Computer Use repeatedly timed out or returned `-10005`; duplicate Electron app identity could select the older window. A uniquely named temporary Electron copy was tried, but overlays/workspace selection blocked progress. CUA's returned instructions required explicit owner approval for another UI technology. The owner chose manual testing and app restart; **automated Playwright/CDP UI fallback approval remains ungranted**. Read-only CDP observations and isolated regression tests are not live UI input authorization. No actual authenticated prompt, provider session, completed response, exact durable exchange or reopening proof was obtained.

The disposable SQLite profile auto-selected the real fs-dev workspace; the prepared scratch workspace was never registered/selected. **An isolated profile did not isolate shared workspace capsule state.** Two prepared scratch paths remain:

- `/tmp/fusion-chat-ar-smoke.wZoDy5/workspace`
- `/Users/rccurtrightjr./Fusion-Chat-S4-Smoke-smmkcmhz` (reachable from the normal Home-based folder picker; policy-only preparation).

### Latest canonical restart

The proper development restart workflow was used after the reviewed repair:

```bash
/Users/rccurtrightjr./projects/fs-dev/restart-fusion.sh \
  --repo /Users/rccurtrightjr./projects/fs-dev \
  --machine RC-MacAir-15 \
  --user-data /tmp/fusion-chat-ar-smoke.wZoDy5/profile-isolated
```

It rebuilt the renderer, stopped the selected profile's process tree, cleared that profile's renderer/session caches and preserved its database. Receipt: `/private/tmp/fusion-chat-ar-smoke.wZoDy5/profile-isolated/fusion-restart/run-qhsAQ1/verified.json`; launcher log: `/tmp/fusion-chat-ar-smoke.wZoDy5/manual-restart-new-chat-fix.log`.

Latest process inventory at 2026-10-05 approximately 16:03 UTC (recheck before operating):

| Instance | Processes / ports / profile |
|---|---|
| Refreshed isolated development app | Main 12886; server 12892; renderers 12904/13000; server 50700; CDP 50699; `/private/tmp/fusion-chat-ar-smoke.wZoDy5/profile-isolated`; machine `RC-MacAir-15`. Receipt reports continuing connection after init over 11 samples / 2 seconds. |
| Older normal development app | Main 77002; server 77007; renderer 77021; `/Users/rccurtrightjr./Library/Application Support/Fusion Studio`. Left running with its older in-memory runtime. |
| Installed Alpha | Main 48636; server 48653; `/Applications/Fusion Studio Alpha.app`. Left untouched. |

The previous isolated tree (main 97673 / server 97678) was gone. **All Fusion instances were not killed.** Two development windows could look alike, so an owner click cannot be attributed to the refreshed runtime without identifying the window/profile. A running process and connected-after-init receipt verify startup only. The requested two-hour `caffeinate` hold had run earlier; it was not observed active in the latest inventory. First Draft's hourly wake was paused when planning completed.

## Other OpenCode harness issues retained for later work

These findings came from source reads, official documentation and isolated OpenCode **v1.18.32** probes. The owner asked to discuss them one at a time. No broad provider/retry/recovery repair is approved by this retirement SPEC.

1. **Structured errors lost at the adapter boundary:** controlled 401 and persistent 429 errors produced native error frames but no canonical Fusion event, leaving generic process-exit feedback. A controlled 401 is not evidence that the owner's live key is invalid. This is the first pending discussion item.
2. **Retry visibility differs by mode:** run JSON output omitted a successful 429 retry signal, while headless event streaming exposed retry. Tested retry policy: 401 ended without retry; 429 allowed five retries/six total attempts with backoff/Retry-After; socket-close errors were retryable. Fusion cannot show a retry signal it never receives.
3. **Accepted-prompt recovery gap:** source projection can turn `provider_failed` into `unknown_after_dispatch_claim`; a fresh reopen may hide an accepted prompt without an exchange. Exact affected public route still needs reproduction. Earlier CHAT-SIMPLE false-send handling was already addressed; do not count it as a new omission.
4. **Attach-mode completion gap:** controlled CLI attachment missed final events that the headless server saved. No evidence establishes that attachment mode caused the owner's Fusion incident.
5. **Intermittent Together/socket failure:** an earlier resumed session failed, retried, then succeeded. The inspected configuration had one credential, with no key-fallback evidence. Both a session started before the config edit and another started afterward showed similar failure; stale session configuration was not established. Eight reused-connection and eight fresh-connection probes succeeded, including tested idle intervals up to 30 seconds. Which peer closed a socket, server warming, connection reuse and provider/network attribution remain unresolved. The owner's willingness to suspect Together is a hypothesis.
6. **Model metadata fallback:** source contains a conditional silent Kimi fallback on a metadata lookup miss; it was not established as the live incident's cause.

Probe evidence may be temporary:

- `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/chat-opencode-observation-isdnmwen/observations.json` (alongside credential-count and session-resume metadata).
- `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/opencode-connection-comparison-0mnr49fb/summary.json`.

Primary documentation examined: [OpenCode v1.18.32 retry implementation](https://github.com/anomalyco/opencode/blob/v1.18.32/packages/opencode/src/session/retry.ts) and [Together error codes](https://docs.together.ai/docs/error-codes). These findings describe that tested version, not a newly checked latest release.

## Next safe action

1. Read this handoff, the current implementation ledger and latest repair/runtime report. Inspect the existing orchestrator before resuming it; it currently waits for the source task's owner manual result. Preserve the approved candidate, unrelated edits and existing acceptance.
2. Establish the exact app window, profile, workspace and current PID for the next observation. Coordinate with the owner before closing their older normal development instance. Do not kill all processes or alter Alpha as an isolation shortcut.
3. Complete the approved public test on a disposable profile **and scratch workspace** through owner manual UI or an explicitly approved UI fallback. Verify first and second New Chat select the exact usable thread; send a short real OpenCode prompt; correlate PID/session, completed response, exact persisted exchange and normal same-thread reopen without duplicates. Owner UI results require corresponding runtime/persistence evidence. Startup, empty thread creation and synthetic providers cannot satisfy this gate.
4. If the failure persists, capture the actual request/ACK, view/group/thread selection and timing on that exact runtime before another repair. Finish the matched-baseline audit for the owner's known working state and investigate startup timing/resource symptoms only where evidence warrants. Keep repairs within the approved concrete-failure clause; a broader redesign needs its own planning/approval.
5. Refresh independent final integration on current bytes after actual runtime proof, then request owner acceptance. Git operations that produce commits or publish work and Alpha deployment retain separate owner gates.

No new automatic monitoring, task dispatch, checkpoint operation or harness redesign is initiated by this handoff. Detailed implementation reports remain owned by the existing orchestrator under `planning/chokidar-retirement-and-harness-launch/spec/implementation/`; this document is the owner's bounded return packet.
