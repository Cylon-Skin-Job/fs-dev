# M2 builder packet

Status before independent builder gate: `REVIEW_PENDING`. Owner-approved CHAT-MATERIAL-SPEC-01, M2 only. Writer: Codex side chat (ephemeral), runtime child `/root/m2_builder`, manager `/root`. Exact controller/memory/checkout/HEAD/permissions and pre-M2 hashes are in START.json. No persistent task identity is invented. Procedure: controller mc-spec-slice-builder and mc-spec-review-gate; one fresh read-only clean-room reviewer per pass, fork none, inherited model/effort.

## Implemented behavior

Composer gallery, clipboard selected/top, recents selected/top, microphone and diagnostic Ask AI begin through the accepted M1 action before the actual source preparation. They commit through the sole app consumer into the existing session draft/attachment stores. `useComposerMaterialSource` is a connected adapter, not a consumer/controller/store. Portable source types carry only cancellation and prepared text/attachment/failure completion; no send/create mode.

The composer adapter captures its committed lifetime holder and original editor handle. A holder is keyed to the exact tuple/authority lifetime; cleanup empties that particular holder permanently. Tuple-scoped host callback slots prevent an old same-instance closure from reading the new composer adapter. Actual focus or isActive changes do not retire it. Shared current validation precedes editor reads and insertion. Current selection is accepted only with matching live DOM value, store revision, binding and range; otherwise shared text commit paragraph-appends to the latest owner draft. Caret restoration runs only in the original still-current focused editor, with another frame-time guard. Applied cursor-source text preserves the original emoji-recent API side effect; append-only diagnostics do not acquire it.

Source completion renders in the exact owner. Existing eligible composer warm intent uses the captured thread and current eligibility, pending/unknown guards and best-effort failure handling. It cannot revoke local insertion. Diagnostics gain no warming. Pending blocks preparation; unknown permits composition while ordinary Send remains blocked. Diagnostic Ask AI accepts a lazy preparation callback so begin precedes validated/redacted retrieval in the real details UI.

Mic cancellation propagates to permission preparation, stream setup, MediaRecorder onstop and fetch completion. The stop callback is stable; changing callback identities does not clean up retained work. Cancellation releases a stream returned later by getUserMedia, and temporary enumeration streams stop in finally. Unmount/lease retirement/explicit source close abort the operation; success closes the source UI without aborting the already-committed insertion. Existing recording/transcription/STT prewarm/Edit prompt flows are retained.

## Source and changed-file identity

SOURCE-SEAL.json lists all current dirty tracked and untracked paths by absolute-root-relative name and hash/mode, and separately identifies M2 changes against M1 accepted preimages or baseline HEAD. M2-slice.patch is the full M2-only diff, including originally untracked M1 inputs. START.json/baseline preserve initial bytes. M1 files outside that delta are retained. Every raw check receipt binds HEAD, branch, before/after dirty and untracked bytes, dependencies and real command/environment/log/exit. PRELOAD-RECONCILIATION.json and BUILD-OUTPUT.json bind generated preload and built renderer artifacts; tracked preload is reconciled only to its verified pre-M2 bytes because no preload API/source changed.

## Acceptance and check coverage

| Contract | Current evidence and limitation |
|---|---|
| R-01/R-03/R-04/R-08/R-09 | Actual source menus and real details UI → accepted app consumer → real existing stores → rendered text/pills; M2 seam no external-material store/DOM write or destination lookup after preparation; final caller sweep |
| R-05/R-06; A07/A08/A09/A11/A13 | Deferred clipboard/top-recents focus/view survival, unrelated Main selection for Side/explicit Main, actual unmount and Main tuple selection, workspace/hydration/placement/binding loss, equal tuple return, genuine reusable DOM-instance stale begin/text/attachment rejection; mic permission/processing cancel and reuse |
| A06 | Main/Side selected/top clipboard, selected/top recents, selected gallery. Adapterless Side top clipboard/recents/gallery uses managed placement without Main rows |
| A12 | Concurrent actual clipboard row requests for distinct owners, out-of-order and duplicate/wrong completion; no cross-owner/double revision; M1 shared operation idempotence retained |
| A15 | Pending denies before source list lookup; unknown allows composition/no warm/no resend; captured Side warm, inactive suppression, thrown warm preserves insert; exact ordinary Send ACK, stable-ID readd/attachment generation, duplicate mount one attempt/bubble, System Create/New Chat regressions |
| A16 | Current cursor replacement and intervening typing, stale DOM safe append, same-instance reuse, mic deferred completion without focus theft, diagnostics append validated redacted report without prompt/warm, emoji recent once |
| A17 and preserved A01–A05 | Cumulative M1 global activation/unavailable/authority cases, existing identity/isolation/registration/System workflows and source-bound menu/diagnostic/Send/prompt ownership/recovery suites |
| A10/A11 camera; A14 native/save; final R-07/R-10 | M3-owned direct cameras, actual Electron PNG/save/native scenario, final Wiki and mandatory fresh full-server final runs remain pending. No M2 run certifies them |

The final automated evidence is checks/build-05.json and checks/renderer-08.json (exit 0: fresh build and 163 passed renderer checks). Earlier cumulative checks/renderer-07.json passed 136 checks; focused checks/mic-diagnostic-06.json passed seven; checks/material-02.json passed 31 retained M1 cases through the real authenticated transport fixture. All five M2 builds completed. Build warnings: existing Vite large-chunk warning; review raw logs for any compiler warnings. Final structural check and generated-artifact reconciliation have separate receipts. Build performs preload generation, `tsc -b`, and Vite.

The browser-only architecture lane allocates an actually free owned port, sets CHAT_TRANSPORT_TEST_PORT, uses reuseExistingServer false, and writes each run to owned output. It runs compiled renderer components with controlled native/HTTP/WS source data. The fixture initializes actual ws-client/runtime transport and authentication plumbing, uses source production APIs and handlers, and retains the existing action consumer and authoritative stores. It does not prove native PNG capture, filesystem save, actual provider completion, restart persistence, or the final server minimum.

## Failed checks and repairs

All raw failures, traces and logs remain under checks; no failed receipt overwritten or relabeled.

- material-01: exit 130, nine failed and the rest interrupted/unrun. Newly introduced fake socket omitted onmessage dispatch and returned a non-conforming shell proof shape; fixture never mounted. Stopped only the owned Playwright process with SIGINT (PID 85564). Fixed EventTarget/on-property dispatch and the exact existing proof shape. material-02: 31 passed.
- material-03: exit 1, 60 passed, four failed; two mic completions absent, two diagnostic controls absent because synthetic history message shape was wrong; also recorded runner teardown error. Corrected diagnostic fixture through existing exchange/history handler, not a direct malformed message/store oracle.
- mic-diagnostic-04: exit 1, four failed. Diagnostics now inserted correctly, but oracle wrongly forbade unrelated Side input-focus warm. Narrowed oracle to the diagnostic's captured Main thread. Mic cancellation still reproduced.
- mic-debug-05: exit 1, one failed. Temporary source-abort trace showed shared document outside-click detection treating the removed recorder Send button as outside after React swapped it for processing UI. Fixed the event containment seam using composedPath plus existing contains checks. Removed temporary debug instrumentation after root cause confirmed.
- build-02 + mic-diagnostic-06: current fix passed seven mic/diagnostic completion/cancel cases. build-03 + renderer-07: 136 passed, including same-instance callback, adapterless Side, emoji and regressions.
- Final self-review: make temporary microphone enumeration-stream cleanup unconditional; stop late stream immediately after cancellation; do not set permission-needed state after a retired permission failure; terminate an empty recent-files response; report source-failure result concisely. Final build-05/renderer-08 renew affected cumulative coverage and add actual clipboard/recents source-error observations. Exploratory no-emit TypeScript check passed before cumulative run, but is not a primary source-bound receipt; build's fresh `tsc -b` is authoritative.

## Caller inventory and residual routes

caller-sweep-final.txt records every required symbol hit including currentThreadId. M2 source controls and session action callbacks contain no draft/pill mutation or currentThreadId destination fallback. Shared chat-material-commit owns prepared material store writes; ordinary ConnectedChatComposer onDraftChange remains ordinary typing. Ordinary editor insertText/native emoji picker and distinct chat-action-creation/System Create paths retain their existing owners. The dead fusion:chat-insert listener was removed by accepted M1 and has no producer.

Global SendToChatButton/FloatingPathActions/direct TopicList/FileNode/FolderNode and File/Wiki/office/email/ticket/agent wrappers retain accepted M1 shared global behavior; M2 doesn't edit those callers. Workspace preview capture remains separate and untouched. Header App camera and composer Take screenshot still call existing chatScreenshotCapture; its currentPrimaryOwner/ScreenshotAttachmentOwner/global Main fallback/focus checks/direct attachment write and screenshot index export are exact M3-only residuals. Their presence is not M2 adoption or whole-SPEC completion. M3 must migrate them through this source adapter/accepted shared action, remove stale helpers, renew native/save paths, and update exact Wiki/test claims. Legacy chat action consumer insertion remains for the distinct existing create/send commands, not any migrated M2 source.

No new source protocol, server/library/API/schema, governed event, native capture/save owner or persistence change. Original recents uses source panel correlation and clipboard uses established per-id source response matching; insertion correlation is independently one exact operation/owner token. Final camera correlation is M3.

## Deviations

Full structured original text, actual change, necessity/authority, file/check/effect/risk/downstream/proposed classification records are in DEVIATIONS.json. All are proposals for the orchestrator to classify. Accepted M1-D01–D06 remain upstream authority; M2 adopts its lifetime fencing, activation, explicit New Chat intent, shared consumer/state ownership, host registration and test guarantees without reclassifying them.

## Skips, risks and lifecycle

No live app/Alpha operation, server startup against user DB, native capture/save, dependency install/rebuild, commit-producing Git operation, push/publication, Wiki/planning/central memory/identity/checkpoint change, schedule or persistent thread messaging. Final M3/full-SPEC native/Wiki/full-server and owner acceptance remain mandatory; no unaffected historical server/provider evidence is claimed as a fresh M2 result. Source HTTP/media/native are controlled boundary adapters; destinations/consumer/stores are production. Recents retains its existing panel response protocol; no new server correlation family is created.

Builder reviewer history and terminal lifecycle: REVIEW-LIFECYCLE.json and BUILDER-REVIEW-01.md. close_agent is unavailable in this runtime; record that explicitly after each terminal result. No other child delegation is allowed or used. The orchestrator's acceptance is separate and pending. After READY_FOR_ORCHESTRATOR_REVIEW, builder stops writing.
