# CHAT-AR integration and retirement — references

> Source map for this prepared folder; citations do not transfer authority or certify current runtime behavior.

## Current runtime evidence

### REF-012 — Current chat modularity and design-philosophy review

- **Kind:** bounded_read_only_source_review
- **Status:** assessed_with_targeted_gaps
- **Source:** [User Profile and Design Philosophy](../../../Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md); [Code Standards](../../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md), Architecture Routing, Frontend UI, State, WebSocket and Harness Adapter subpages; [Chat overview](../../../Wiki/007-Chat_System/000-Overview_and_References/PAGE.md) and Structure; current named client/server source; earlier [CHAT-AR-INV-001](investigations/CHAT-AR-INV-001/report.md) for recovery/retirement leads.
- **Locator:** I-011; `fusion-studio-server/lib/ws/client-message-router.js:1-26,81-139,284-380,700-765,891-918`; `fusion-studio-client/src/lib/ws-client.ts:1-75,191-196,244-360,418-665`; `src/lib/ws/stream-handlers.ts:1-55,227-506`; `src/components/chat/useViewChatHost.ts:112-174`; `src/components/chat/useChatSessionActions.ts:198-230`; `src/lib/chat/prompt-submission-recovery.ts:41,123-154,261-278`; `src/components/chat/ChatComposerModelMenu.tsx:1-25,104-125`; I-005's history/open fallback.
- **Revision:** Development branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, dirty. SHA-256: server router `b59f4d74c218e73a4cc828a82a5faa7cbbe08299d7ed1ac78718eac7412036a6`; client socket `799ea39d8085c7d7472aab0e56ba3c748488a3f9a007a18b79c427854e708648`; stream handler `3e3ee79eec79bede2922b46437e9a8636a67ee57dfb526bfb68260abb6d6627c`; view host `f0d42ae389f0b550ce135a2817985292bc42b97b08cbb79a0a474252f0f6e0ab`; session actions `09eee115f44535b6b52260da0c9c48dd16029993eac1fbf2ad0222d8743a256a`; recovery `787206f278c433c18a0f73f8b3257f2f9ad71e940c2f7341ae4e7d2c4a951c67`.
- **Checked:** 2026-09-28 22:05 UTC; read-only file-size, import, call-site and responsibility inspection. No code, DB or runtime mutation for this review.
- **Supports:** There is substantial intended separation of server-owned acceptance, exact thread runtime, provider translation, repositories and connected chat hosts. It is not accurate to certify full modularity compliance: multiple transport entry points still exceed the stated file-size goal and mix dispatch with domain operations; direct socket sends are spread across chat hosts/actions despite a central authenticated send function; and recovery ignores the transport's false return. The model menu is a qualified portability concern rather than a line-count-only verdict. Existing legacy open/history paths remain a separately tracked reachability question.
- **Limitations:** A bounded source review, not an exhaustive import-graph audit, runtime reproduction or broad test pass. It does not establish that any identified structure caused the current send failure, that every large file needs a split, or that a particular refactor is safe without affected route checks. Existing dirty/untracked source must be treated as current observed bytes, not a clean HEAD candidate.
- **Related:** I-005, I-007, I-008, I-009, I-011, REF-008, [CAPTURE](CAPTURE.md).

### REF-011 — Broken status display, temporary route traces, and Diagnostics timer review

- **Kind:** live_runtime_and_bounded_source_observation
- **Status:** instrumented; cause unresolved
- **Source:** Owner's 08:28–08:31 UTC display/navigation report and clarification about the Diagnostics monitor; read-only development SQLite/server/Electron/process inspection; current `prompt-submission-recovery.ts`, `ConnectedDiagnostics.tsx`, `lib/diagnostics/stream.ts`, `live-diagnostic-service.js`, `live-diagnostic-handlers.js`, `diagnostics/tabs.ts`; temporary chat trace extension in REF-009.
- **Locator:** I-009/I-010 and CAPTURE “Broken status display and Diagnostics timer”.
- **Revision:** Dirty development checkout HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Reviewed Diagnostics SHA-256: `ConnectedDiagnostics.tsx` `77036f9b547a03b5b792d2d518b4ea1880944db28d8d0933629de4bd384433e1`, `stream.ts` `b90d969d815076e67afc415e620d9a7ea9458ea70308a0dd0ac6b2967b48b04b`, `live-diagnostic-service.js` `f9434147f5d280bd7811cd1b15d7da624d6f46e8`. REF-009 records the edited trace bytes. Runtime samples are mutable.
- **Checked:** 2026-09-28 08:29–08:40 UTC; 13 focused server tests passed; canonical client build/restart at 08:40 UTC launched Electron PID 77002/server PID 77007 on port 51857, machine `RC-MacAir-15`; HTTP 200 and a post-restart `thread_open_request`/`thread_open_return` pair were observed.
- **Supports:** No later receipt or child-boundary event was observed after the successful 08:26 turn through the reported interval. Status recovery ignores a false transport return. The temporary logger itself has no polling timer. A mounted Diagnostics display samples every 200 ms with cleanup; each server subscription flushes every 100 ms with cleanup. Diagnostic tabs start empty after restart. The client text buffer is capped at 131,072 characters; server queues at 131,072 UTF-16 units/128 events and 16 subscriptions per connection. Renderer PID 77021 measured 1,271,072 KB RSS shortly after restart, peaked at 2,666,688 KB within about two minutes, then fell to 671,568 KB by about six minutes.
- **Limitations:** No request ID or screen image survived the broken render, and native desktop control returned `-10005`; the report cannot be mapped to a particular receipt or server frame. RSS samples show allocation and reclamation, without a heap profile or confirmed Diagnostics-tab state; they establish neither a leak nor a Diagnostics contribution. The new route trace has not yet observed a failed send/status/open sequence. Non-main-frame-specific Electron loading events do not establish a reload loop.
- **Related:** I-007, I-009, I-010, REF-009, REF-010, [CAPTURE](CAPTURE.md).

### REF-010 — Recurrent accepted-message failure after diagnostic restart

- **Kind:** live_runtime_observation
- **Status:** classified_to_sync_child_launch_boundary; exact error pending
- **Source:** Owner's 2026-09-28 report that the warning recurred and Electron required force reload twice; development `fusion-studio-server/server-live.log`; read-only `prompt_submission_receipts` metadata; Electron launch log; process/socket and `lsof` inspection.
- **Locator:** `server-live.log` 08:09:51 and 08:18:29 UTC `temp_chat_boundary_v1` records, including lines 468910–468912 for the failed turn; receipt turn IDs `0ca3d0c8-6051-4e16-a602-01b3e2369b60` and `d3796d39-1b2a-4b40-ac05-1c14c6498af8`. CAPTURE “Recurrent child-launch failure”.
- **Revision:** First diagnostic run: Electron PID 72921, server PID 72934, port 51498, source at REF-009's initial revision. Follow-up classification revision and restarted process are recorded in REF-009. Runtime log/database/process data are mutable and timestamped.
- **Checked:** 2026-09-28 08:19–08:25 UTC; metadata-only SQLite reads, bounded log reads, process/socket inspection.
- **Supports:** The 08:09 turn returned child PID 73303 and closed normally after native JSON/session ID/turn end. The 08:18 turn was accepted/claimed, then `spawn_attempt`, `spawn_throw`, and `dispatch_failure` occurred at 08:18:29.344 UTC with no child PID or bound turn; its receipt was marked `provider_failed` 24 ms after creation. Its user input was 206 UTF-8 bytes, with zero attachments and no NUL byte. Server PID 72934 held about 16,145 descriptors at inspection, chiefly regular checkout files. The 08:12 Electron log records a navigation/reload interval, while the owner's two force-reload observations remain user reports.
- **Limitations:** The original closed code allowlist omitted the thrown error's code, if any; no raw exception was retained. The actual process FD soft limit and incident-time FD count were not measured, and the 16k open files are not established as the spawn failure's cause. Navigation entries alone do not prove that reload caused the failure. No provider child or provider receipt is inferred for the failed turn.
- **Related:** I-007, I-008, REF-007, REF-009, [CAPTURE](CAPTURE.md).

### REF-009 — Temporary content-free child-boundary diagnostics

- **Kind:** scoped_local_product_edit_and_test
- **Status:** active_in_development_app; expanded_error_and_route_classification_pending_next_failure
- **Source:** Direct owner authorization in this conversation for temporary logs with delete/migrate annotation; `fusion-studio-server/lib/logging.js`, `lib/harness/opencode/index.js`, `lib/thread/runtime-dispatch.js`, `lib/ws/client-message-router.js`, `lib/ws/thread-action-handler.js`, `lib/ws/thread-ws-handlers.js`, and affected logging/OpenCode tests.
- **Locator:** CAPTURE “Temporary child-boundary diagnostics”; marker `temp_chat_boundary_v1` and source comment `TEMP CHAT-AR I-007`.
- **Revision:** Dirty checkout HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`; current SHA-256: `logging.js` `2acf3c7bee42238358add9b447fe3091a3eb275e20ccccc45f5ea8e77bf4b0ab`, `opencode/index.js` `9fb9b1e55036c245abb2ff4c0782e3970623992efb21c507a1b752de12a65790`, `runtime-dispatch.js` `6b479e5d9fd355e85f4821cba724abe0fbbb46d9e353a07018544849380dfd15`, `client-message-router.js` `b59f4d74c218e73a4cc828a82a5faa7cbbe08299d7ed1ac78718eac7412036a6`, `thread-action-handler.js` `b647c99d03b3f871f9c76d0586b6f9db2306edb7e43f9292fae895fc6b465af7`, `thread-ws-handlers.js` `f9c1ed9b35faa9654996943e35271ac33d5226e096d918952fbab1a96213856f`, `test/logging.test.js` `5885608c8ce77ae5c223942e0110be8da20bad8862f44967dbdf75900032b345`. The dispatch source was untracked before and after this edit, so HEAD cannot identify its contents. Earlier installed hashes were `b10337c475cd93adb7a83b0cae436716b604f2f716f2932b0d1df4c28b685008` and `64f38d8f5c4a9d837c43560f702a3e2e97cbd8bf24d617b27b3c5a2a4b74f519` for logging and OpenCode respectively.
- **Checked:** Initial five affected suites passed 160/160 at about 07:49 UTC. On recurrence, the closed classifier gained selected Node/OS error codes, error name, bounded errno and environment-ready presence. Two focused suites passed 61/61 at about 08:23 UTC; restart at 08:24 UTC launched Electron PID 74921/server PID 74930 on port 51629. At 08:26 UTC a turn launched PID 75070 and closed successfully. Following the owner's broken status report, closed prompt/status/thread-open stages were added; two focused suites passed 13/13, changed paths passed `git diff --check`, and canonical restart at 08:40 UTC launched Electron PID 77002/server PID 77007 on port 51857 with HTTP 200.
- **Supports:** The restarted development server can log bounded child spawn/exit/session-binding, synchronous spawn-error classification and prompt/status/thread-open route stages without prompt, argv, path, stderr, provider JSON or raw error text. The explicit code comment names the future health subscriber as removal/migration target.
- **Limitations:** The expanded classifier has not yet observed another failed send, and the exact thrown exception remains unknown. The user’s 06:51–06:52 UTC failures cannot be reconstructed by later code. Full-tree `git diff --check` reports an unrelated pre-existing EOF blank line in an Office e2e fixture; it was not edited here.
- **Related:** I-007, I-008, REF-008, [CAPTURE](CAPTURE.md).

### REF-008 — Independent adversarial and failure-path investigations

- **Kind:** bounded_source_and_runtime_investigation
- **Status:** received_and_incorporated_with_limits
- **Source:** [CHAT-AR-INV-001](investigations/CHAT-AR-INV-001/report.md), owner-preference/Code Standards/Chat contract review; [CHAT-AR-INV-002](investigations/CHAT-AR-INV-002/report.md), send/session/dispatch/database/resource review. Both were read-only product investigations with separate report ownership.
- **Locator:** CAPTURE “Owner-requested independent investigations”; I-007 and I-008. Each report contains exact source lines, measured metadata, hypotheses and material dirty-file SHA-256 values.
- **Revision:** Branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, dirty. Dispatch fingerprints and each report's material hashes bind the inspected bytes; live process/database observations are dated mutable snapshots.
- **Checked:** 2026-09-28 07:37–07:42 UTC; reports received and reconciled in this folder. Computer Use retried afterward and again returned `-10005`.
- **Supports:** Claimed dispatch may fail before a per-turn OpenCode child/session is established; existing evidence cannot classify the exact error. Identifies two source-backed accepted-prompt recovery gaps, confirms I-006, and measures database/event-ledger and file-descriptor state without assigning causality.
- **Limitations:** No app UI inspection, incident-time FD/soft-limit measurement, pre-begin fresh-renderer route test, content-safe child-boundary diagnostic, or new affected prompt send. The reports do not prove whether spawn, early exit, session-ID persistence, resource pressure, or conditional harness fallback caused I-007.
- **Related:** I-005, I-006, I-007, I-008, REF-007, [CAPTURE](CAPTURE.md).

### REF-007 — Live accepted-message failure inspection

- **Kind:** runtime_observation
- **Status:** inspected
- **Source:** Owner warning in this conversation; read-only `fusion-studio-server/data/fusion.db` prompt receipts/exchange metadata; `~/.local/share/opencode/opencode.db` session/message metadata and OpenCode log; current app process/port; `runtime-dispatch.js`, `runtime-prompt-admission.js`, client `prompt-submission-recovery.ts`, and server/Electron logging owners. One isolated OpenCode CLI probe used the configured model and child-environment builder.
- **Locator:** CAPTURE “Live accepted-message failure”; I-007. The four receipt times are 2026-09-28 06:51:30, 06:51:59, 06:52:28 and 06:52:43 UTC; no prompt text, credentials or raw diagnostic payload was copied into this folder.
- **Revision:** Development checkout HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de` with dirty accepted product bytes per REF-006; live Electron PID 62360/server PID 62366/port 50449 observed 2026-09-28 07:18–07:26 UTC; mutable runtime evidence, not a frozen candidate.
- **Checked:** 2026-09-28 07:18–07:26 UTC, read-only SQLite/process/log inspection plus one isolated CLI probe (exit 0, one text event, no stderr).
- **Supports:** The reported warning corresponds to accepted prompts whose claimed execution ended `provider_failed`; no corresponding OpenCode records were observed at the failure times. A standalone CLI invocation worked later.
- **Limitations:** Desktop control failed with `-10005`; the exact live app UI was not observed. Current logging suppresses the exception details, so the root cause, whether a child process launched, and the role of high file-descriptor count remain unknown. The isolated probe does not certify the affected app threads.
- **Related:** D-003, I-007, [CAPTURE](CAPTURE.md).

## Owner direction and prior work

### REF-006 — RD-02 current-byte comparison and retirement leads

- **Kind:** source_and_build_observation
- **Status:** inspected
- **Source:** [RD-02 root report](../../../Captures/035-Composer_Typing_Regression/ROADMAP/evidence/render-diagnostics/RD-02/ROOT-REPORT.md), its `root-source.json` and `root-build.json`; current development checkout `fusion-studio-client/src`, `fusion-studio-server/lib`, `fusion-studio-server/test`, `fusion-studio-client/dist`, and cited open/history/Side Chat files.
- **Locator:** CAPTURE “Bounded current-byte baseline check” and “Initial retirement inventory”; exact manifests in the RD-02 evidence directory.
- **Revision:** Branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`; accepted root-source SHA-256 `0a7dc263147fac3a29de1bd528cc940bf6cb44e720e147086a39b7e14d1c0ad7`; root-build SHA-256 `d66e0386a57a084f896d515a63a48f87e8318c0b983433fbb47f753024d40d4e`.
- **Checked:** 2026-09-28 06:57 UTC, path-by-path SHA-256 read-only comparison and bounded source search.
- **Supports:** 1,993/1,997 listed source paths match; all 200 listed build files match with no extra dist files; checked client/server product-source trees are fully listed and matching. Identifies four changed listed paths, two out-of-manifest fixture paths, specific remaining compatibility candidates, and the current Side Chat control path.
- **Limitations:** A manifest matches listed bytes, not unlisted resources, active runtime state, a fresh build/test gate, or a proof that candidate compatibility paths are safe to remove. Other worktree edits may still affect a future integrated handoff.
- **Related:** I-001, I-002, I-005, I-006, [CAPTURE](CAPTURE.md).

### REF-004 — Supervisor responsibility transfer and evidence identities

- **Kind:** conversation_and_prior_work
- **Status:** inspected
- **Source:** Direct owner transfer message in supervisor task `01a0c1c8-6e85-7f83-8d67-2cb5c1476007`; [closure addendum](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06-OWNER-CLOSURE-ADDENDUM.md), [ledger](../../../Captures/035-Composer_Typing_Regression/ROADMAP/ROADMAP-LEDGER.md), [SPEC-06](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06.md).
- **Locator:** D-002 quotes the transfer; CAPTURE preserves the bounded handoff. Original evidence remains at linked paths.
- **Revision:** SHA-256 respectively: closure `3052e8898ccc5d5ec41fdfb6a2b54f547811610d3fb0f4e1b2c9e819e0a2c52b`; ledger `29f79a2e502f8ee5248403082adc4136141ea04ae56fd8ada9c0f26d8e3d509d`; SPEC-06 `ecb6d1dde9c9fa6bd808c7f67c75960dd61706f347dc6fac00356d7642e17006`.
- **Checked:** 2026-09-28 06:26 UTC.
- **Supports:** Accepted closure, residual obligations and this folder's durable responsibility.
- **Limitations:** Documentation identities only; no product baseline/hash freeze, history checkpoint or implementation approval.
- **Related:** D-002, I-001–I-004, [TICKET](TICKET.md).

### REF-005 — Latest Diagnostics preview launch

- **Kind:** runtime_observation
- **Status:** inspected
- **Source:** Supervisor task's preceding owner-requested launch; canonical `/Users/rccurtrightjr./projects/fs-dev/restart-fusion.sh`; Electron log and process/socket inspection.
- **Locator:** CAPTURE “Source and runtime continuity” contains paths, process identities, port and limitations.
- **Revision:** Current development renderer build completed at the 2026-09-28 05:26 UTC launch; no full-source manifest bound to this preview.
- **Checked:** Build/launch in preceding turn; processes and connection rechecked 2026-09-28 06:26 UTC.
- **Supports:** Development app launch for owner preview, not a new integration/soak pass.
- **Limitations:** Desktop-control service failed; Diagnostics UI not visually verified. Log denial markers remain unexplained. A live socket is not proof all product functions work.
- **Related:** [CAPTURE](CAPTURE.md), I-001, I-003.

### REF-001 — Owner closure

- **Kind:** prior_work
- **Status:** inspected
- **Source:** [SPEC-06 closure addendum](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06-OWNER-CLOSURE-ADDENDUM.md)
- **Locator:** Linked file and named sections; see source for exact records.
- **Revision:** Current file observed during 2026-09-27/28 setup; no immutable content hash recorded.
- **Checked:** 2026-09-27/28, bounded document read.
- **Supports:** Acceptance and transferred residuals; not a passing product certification.
- **Limitations:** Source may contain dated status; recheck current bytes and direct owner decisions before executable planning.
- **Related:** [TICKET](TICKET.md), [ISSUES](ISSUES.md).

### REF-002 — Historical implementation

- **Kind:** prior_work
- **Status:** inspected
- **Source:** [CHAT-AR ledger](../../../Captures/035-Composer_Typing_Regression/ROADMAP/ROADMAP-LEDGER.md), [SPEC-06](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06.md), and [implementation report](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06-IMPLEMENTATION-REPORT.md)
- **Locator:** Linked file and named sections; see source for exact records.
- **Revision:** Current file observed during 2026-09-27/28 setup; no immutable content hash recorded.
- **Checked:** 2026-09-27/28, bounded document read.
- **Supports:** Original requirements and dated evidence; reruns on current bytes remain to be selected.
- **Limitations:** Source may contain dated status; recheck current bytes and direct owner decisions before executable planning.
- **Related:** [TICKET](TICKET.md), [ISSUES](ISSUES.md).

### REF-003 — Chat architecture

- **Kind:** prior_work
- **Status:** inspected
- **Source:** [Chat Wiki overview](../../../Wiki/007-Chat_System/000-Overview_and_References/PAGE.md)
- **Locator:** Linked file and named sections; see source for exact records.
- **Revision:** Current file observed during 2026-09-27/28 setup; no immutable content hash recorded.
- **Checked:** 2026-09-27/28, bounded document read.
- **Supports:** Current documented architecture; reconcile against the chosen baseline.
- **Limitations:** Source may contain dated status; recheck current bytes and direct owner decisions before executable planning.
- **Related:** [TICKET](TICKET.md), [ISSUES](ISSUES.md).

### REF-013 — Reviewed three-candidate First Draft

- **Kind:** managed_planning_and_independent_review
- **Status:** inspected; DRAFT_VALIDATED_FOR_DISCUSSION.
- **Source:** D-004/D-005/D-006, current preference/standards/Chat sources, bounded standards and transport investigators, sole author and fresh independent validator.
- **Locator:** [FIRST-DRAFT](planning/chat-transport-simplification/FIRST-DRAFT.md), [stage report](planning/chat-transport-simplification/reports/STAGE-REPORT.md), [independent validation](planning/chat-transport-simplification/reports/DRAFT-VALIDATION-01.md), [input snapshot](planning/chat-transport-simplification/SOURCE-SNAPSHOT.json).
- **Revision:** CHAT-SIMPLE-DRAFT-001 rev1; draft SHA-256 `6e14ca1119c403754629dd463c838c62ccbe89b98ac7da9d6b2893d50f3f0393`; independent review `c3f484628b94a215a641fdf9f0e8281c2a9ae8fca1067e41937d90acb9ea2688`; stage report `c3e45b7004e956f0eeca376dbfa520363b6ad65cf39933ba4e7dc729f0d1b873`; original input snapshot `4756ff742ff7a4fa71927246aeded7660335caf0279e69e8994724b0413345f1`.
- **Checked:** 2026-09-28; stage rechecked all 28 input hashes at 23:03 UTC; root independently matched all 28 plus draft/review/stage output hashes before this memory reconciliation.
- **Supports:** Three candidate outcomes, four cards, proposed order/smokes, standards coverage and bounded deferral constraints. All four draft review perspectives covered; no material finding or new owner product decision required.
- **Limitations:** No executable roadmap, product change, test/build pass or consumer release. R1–R4 remain Creator technical work. Current memory reconciliation follows the preserved original intake snapshot; it does not rewrite that historical snapshot or the reviewed draft. Current product source must be rechecked before executable release.
- **Related:** D-004–D-006, I-001, I-003, I-004, I-009, I-011.
