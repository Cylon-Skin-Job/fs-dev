---
name: PW-01 claim and source evidence
description: Execution-time input census, bounded source observations, and later-slice evidence obligations.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Evidence register

S00 source inspection on 2026-09-19 at development HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, branch `agent/exact-workspace-paths`. Candidate `PW01-f24d5cd427b9ca14` matches all nine normative hashes and aggregate. This is evidence preparation: none of the wiki's existing claims becomes accepted merely by inclusion here. Later slices add exact changed-claim evidence and required scenario narratives before their own gates.

`EXECUTION-BASELINE.json` stores full current text, SHA-256 and exact generated blocks for all 27 targets, Git commands with UTC timestamps/exit/stdout, and 232 source/test file hashes. `S00-INPUT-INVENTORY.json` stores 438 paragraph/list/table/example claim blocks with exact page, heading and line range; 130 source-pointer entries; 75 links; and all 128 vocabulary matches with allocation. Full text and line ranges preserve details that the topic summaries below intentionally do not repeat. Those are input statements, not endorsements. The owning slice must reconcile every claim in its allocated blocks, removing obsolete implementation detail or labeling proposal/open status as appropriate.

## Authority and evidence classes

Use AUTHORITY-MATRIX.md for raw receipt paths and scope. PW decisions are owner_decision; approved MVP/ATP/BRIDGE requirements are spec_contract; repository/wiki guidance is source_of_truth_contract; inspected source is active_code_constraint; local internal mechanics without product authority are implementation_choice; wider unapproved designs are proposal. Current, target, proposal and open are separate status labels. Historical reports are dated receipts and inspected tests are assertions **not rerun**.

## Topic census and source owners

Paths beginning `lib/` below are under `fusion-studio-server/`; client paths explicitly start `src/` under `fusion-studio-client/`. Source hashes are keyed by full path in EXECUTION-BASELINE. A symbol/line reference identifies inspected bytes, not a live outcome. Broader listed integration owners are a discovery map for later slice verification.

| Topic | Input claims to reconcile; authority/status | Bounded inspected evidence and complete integration-owner map | Failure/limit; assigned work |
|---|---|---|---|
| T01 System | System ownership, control records vs historical purpose, connected content, workspace stores, plugins, preservation. PW-D01–09 approved target; DB path is current source. | `lib/db.js:14–17,25–53` selects fusion.db and migration singleton. Registry/subscription stores, thread managers and view-state services are existing separate owners. `lib/calendar/db-writer.js:1–19` calls this singleton. | Existing mutable/deletion APIs are not disproved by preservation target. No full application-storage audit or live DB inspection. S01 explains scope and current deletion limitation; S06 checks consistency. |
| T02 Calendar gap | Calendar currently SQL-backed under conditions; target forbids duplicate live connected-app store in System. active_code_constraint vs PW-D03. | `lib/startup.js:613–615` → `lib/calendar/index.js:14–29` opt-in checks → Apple watcher/Google poller → `calendar/{apple,google}/sync.js:run` → `db-writer.js:upsertCalendars/upsertEvents` → `calendar_sources/calendar_events`; `server.js:170` mounts `http/calendar-routes.js` → `src/state/calendarStore.ts:140–173` fetches/map rows. Migration 022 is the schema owner for later exact read. | Apple needs source DB and opt-in; Google needs opt-in/configuration/results. API existence says nothing about populated user data. S01 traces producer/read/UI chain and labels PW-O05 gap; no migration approved. |
| T03 Governed events | Four admitted fact types, locked schemas, sealed host publishers, grants/filter/handler compilation, admission vs delivery. MVP-D14 and ATP-D09/17 are accepted; old prepared-candidate/accepted-ref doctrine is proposal outside its narrow overlays. | `lib/startup.js:265–445` composes registry/repositories/controllers; `event-registry/{seed-catalog,subscription-seed-catalog,reconcile,repository}.js` → `subscriptions/file-provenance-bootstrap.js` → `subscriptions/admission.js:28–48,148–208` static `file.command_accepted@1`, `resource.mutated@1`, `agent.tool_completed@1`, `resource.state_observed@1` → `subscriptions/controller.js:264–306` → capability-scoped handlers. | Publisher awaits durable reservation validation and delivery. Controller invokes synchronously; required_ack awaits bounded result. Agent facts alone have pre-dispatch durable admission commit. `admitted:true` does not mean all subscribers persisted/delivered. S02 owns exact timing, schema/table catalog and standards repair. |
| T04 Legacy events/ledger | Public emit/on, watcher/chat/trigger compatibility and event_log are current; generalized ledger_events/graph/ref APIs are draft. | `lib/ledger/event-ledger-subscriber.js:11–29` wildcard legacy subscription → `event-ledger.js:5–9` whitelist (`workspace:switched`, `thread:state_changed`, `file:changed`) → `recordEvent`; `event-ledger.js:40–49` can infer file actor `user`. Migration 029 owns event_log/resource edges. Governed resource repository and agent ledger repository have separate writers. | Legacy actor inference is heuristic, not human proof. Public emit cannot mint governed admission. S02 maps real tables/columns and governs-vs-legacy paths; S04 verifies agent projection. |
| T05 Save safety/facts | Production mediated file_save, exact preimage, optional context and postwrite recovery. MVP-D09/D15/D16 + BRIDGE-01 accepted; broad fail-open snapshot language is wrong for this operation. | `src/state/fileDataStore.ts` save action → existing WebSocket → `lib/ws/client-message-router.js` → `ws/file-save-route.js` schema/workspace validation → `file-mutations/save-controller.js:430–589` path authority/lock, reserve, publish command, read/prepare preimage, mark attempted, atomicWriter.replace, terminal state → `fact-replay.js:58–112` admitted facts → subscription ledger/render handlers → resource projection publisher. | Missing save preimage/preparation aborts before writer invocation; absent target becomes create. Optional malformed context degrades. After rename, unknown outcome and committed success/projection pending must stay distinct. S03 completes exact size/symlink/caller/readback/reconciliation and three failure narratives. |
| T06 Reported context | Save context carries workspace/view/tab/component/presenter/target snapshot; no universal UI-action subsystem or authenticated human claim. BRG-D08/D09 + MVP-D16 accepted. | `src/lib/save-action-context.ts:49–105` reads live view state → fileDataStore save → file-save route → `lib/file-mutations/reported-ui-context.js:75–140` sanitizes/omits/degrades and uses server workspace → row columns `reportedUiContextColumns` → operation fact reconstruction and resource-provenance query. Migration 040 extends carrier storage/schema. | Requires usable view identity; reported workspace mismatch omits; unknown/overbound individual fields degrade. No history-to-view-state writeback. S03 verifies persistence/query; S05 rewrites UI module/adapter proposals. |
| T07 Visible freshness | Save resource:changed v1 and tool-observation v2 are current transport candidates; resource:invalidate and broad lifecycle token/ref mechanisms are draft. MVP-D12/ATP-D13 accepted. | Server `subscriptions/handlers/resource-render-projection.js` / `ws/resource-projection-publisher.js` → existing socket → `src/lib/ws/resource-projection-protocol.ts` + `file-handlers.ts` → `src/state/fileDataStore.ts`/`file-data-read-model.ts` → File Viewer. Discovery map; end-to-end production consumer reread required by S03/S04. | Reconnect, stale workspace epochs and dirty buffers cannot be inferred correct just from publisher presence. v2 is invalidation, not proof of tool authorship or forced dirty-buffer replacement. S03/S04 read tests and exact consumers; no runtime claims. |
| T08 Agent observations | Terminal tool activity/clocks, bounded extraction, native observation, sparse checkpoints/exchange binding and two ledger facts are current accepted subset. Broad chat.tool/nativeRefs/captured-output schemas remain open. | `lib/harness/opencode/json-event-translator.js:227–238` terminal snapshot → canonical wire bridge → activity owner `captureTerminalSnapshot:240–269` extracts candidates/fingerprints/clocks → activity repository/admission → observer `resource-observer.js:152–338` → secure native observer → `checkpoint-repository.js:169–348` → fact/ledger/renderer reconciliation; exchange-binder/exchange-bind repository attaches saved exchange reference. | Fingerprints are not raw disclosure or causality. First observation is not an earlier preimage; unchanged state reuses checkpoint. `resource-observer.js:210` fails secure_open_unavailable without native prerequisite. Interrupt/restart paths, missing/oversize/invalid candidates and explicit test assertions allocated S04; no addon loaded. |
| T09 Queries/UI | Resource and agent summary request routes exist; a helper is not mounted audit/history UI. MVP query + ATP-D12 current; broader AUD design proposal. | `lib/ws/client-message-router.js:452–472` routes resource:provenance and agent:activity; corresponding route modules validate/current workspace/query/response → resource-provenance and agent query repositories. `src/lib/ws/resource-provenance-protocol.ts:162–194` exports request helper, with result consumer at 157. Bounded caller search below. | Resource helper has no production call site in client src in inspected search. No agent activity client consumer was found in that same bounded search. S04 verifies receiver registration/callers before wording the precise absence; S05 separates saved audits and review loops. |
| T10 Future systems | Durable history, controlled plugin emission, eventual automation identity, audit/recommendation and storm control are product direction with specific unresolved details. Exact examples/ABIs/capacities in Capture 008 remain proposal/open. | Raw Capture 008 map/findings + numbered documents, 030 per-decision levels, 032 design-phase header; current static publisher list lacks general plugin/ui.action/automation/audit fact publishers. Legacy triggers and audit subscriber are independent compatibility source owners to reread in S05. | No arbitrary plugin grants/SQL, automatic retention, universal version/restore, broad UI adapters or source-operation never-waits guarantee can be inferred. S05 classifies each remaining branch; PW-O01–04 preserve future triggers. |

## Bounded negative searches

On 2026-09-19, `rg -n 'queryResourceProvenance|queryAgentActivity|resource:provenance|agent:activity|uiActionSeed|publishCanonical|PreparedCanonicalCandidate' fusion-studio-client/src fusion-studio-server/lib` returned resource helper definition/protocol/type/server schemas/routes and agent server schemas/routes. It found no uiActionSeed/publishCanonical/PreparedCanonicalCandidate implementation and no production invocation of queryResourceProvenance in this scope. This supports only those bounded absence statements, not an exhaustive UI/app audit. S04/S05 must recheck dependencies at edit time. Source search for secure_open_unavailable found observer failure branch and schema/migration failure reasons. Nothing was executed.

## Existing test evidence

These files were inspected as source or assertion-name inventory, **not rerun**. The 232 hash inventory includes discovered test identities; inventory inclusion alone is not a claim that its entire body was read.

| Test source | Inspected assertion / intended contract | Assigned detailed evidence |
|---|---|---|
| `fusion-studio-server/test/ws/file-save-route.test.js:351–414` | Valid component context preserved; malformed/oversized/stale context omitted/degraded without rejecting save. Read assertion bodies. | S03 context scenario |
| same file:171,231,299 | Assertion names cover 10 MiB, stale A→B→A intent, and mediated controller without retired save broadcast. | S03 body and integration inspection |
| `fusion-studio-server/test/resources/file-provenance-integration.test.js:28,45` | Atomic mediated-save/ledger/query suite and in-root symlink-parent query case (name inventory). | S03 |
| `fusion-studio-server/test/subscriptions/admission.test.js:136–387` | Names cover legacy bypass, exact reservation/freeze/replay, invalid authority/schema, sealed bootstrap, async input snapshot and agent shutdown/commit. | S02 |
| `fusion-studio-server/test/ws/agent-activity-route.test.js:48–130` | Names cover captured workspace selectors, stale/unavailable pair, fixed query failure and inactive schema. | S04 |
| `fusion-studio-server/test/agent-provenance/{jobs-and-checkpoints,resource-observer,exchange-bind-and-query,activity-owner,announced-activity-reconciler}.test.js` | Discovered actual tests for observation/checkpoint/binding/interruption paths; not claimed passed or fully inspected in S00. | S04 |

A discovery attempt referenced nonexistent `test/agent-provenance/checkpoint-repository.test.js`; corrected by `rg --files fusion-studio-server/test`, which identifies `jobs-and-checkpoints.test.js`. A query-handler discovery attempt referenced nonexistent `src/lib/ws/index.ts`; do not carry that guessed path into source metadata. These read-only misses were corrected, not validation successes.

## Initial V2–V4 findings and allocation

All 27 frontmatters parse with installed gray-matter. Source inventory contains 14 non-file entries: four Structure directory placeholders (S02), seven obsolete UI-helper pointers across four primary pages (S05), and three unrelated supporting limitations (DEP-07). A valid existing file still needs symbol-to-claim verification by its slice. All 75 scanned links resolve; external availability is unverified. No reference-style links or relevant HTML href links were found by the scanner in current targets; fenced examples are excluded as examples. Whole target raw bytes are retained for review of scanner limitations. One generated TOC block is preserved; future-sounding generated descriptions need status clarification outside it.

All 128 V4 matches are retained individually. Primary hand-written matches are repair input for the owning slice, not exceptions. Generated matches retain exact bytes with adjacent status explanation; any unchanged unrelated supporting match must be explicitly named by its slice. The old “schema correction authority” Capture links and draft IDs are mapped here/AUTHORITY-MATRIX and should disappear from durable hand-written explanation, without discarding settled intent. Existing hard-wrapped prose is readability repair input; rewrite ordinary paragraphs on one physical line. No snapshot is required in S00 because it changes no wiki page; subsequent builders must snapshot **current** bytes immediately before each edit, not reuse this evidence copy.

## Exact page allocation

All 27 are `read; input reconciliation required`, not final changed-and-checked. Claim IDs refer to full input blocks; each has topic allocations in the JSON inventory. Supporting rows are limited to named subjects.

| Page | Slice | Input claim IDs | Topic authority / repair |
|---|---|---|---|
| `010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md` | S01 | C0001–C0005 | T01, T03, T05, T08, T10 |
| `010-Events_And_Ledger/000-Events_And_Ledger/001-Vision/PAGE.md` | S01 | C0006–C0019 | T01, T10 |
| `010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md` | S01 | C0020–C0096 | T01, T03, T04, T05, T06, T08, T10 |
| `010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md` | S02 | C0097–C0101 | T03, T04 |
| `010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md` | S02 | C0102–C0105 | T03, T04, T10 |
| `010-Events_And_Ledger/003-Provenance_Model/PAGE.md` | S02 | C0106–C0139 | T03, T04, T05, T06, T08, T10 |
| `010-Events_And_Ledger/003-Provenance_Model/004-Ledger_Event_Provenance_Schema/PAGE.md` | S02 | C0140–C0152 | T03, T04, T08 |
| `010-Events_And_Ledger/004-Ledger_Schema/PAGE.md` | S02 | C0153–C0159 | T03, T04, T08 |
| `010-Events_And_Ledger/010-Structure/PAGE.md` | S02 | C0160–C0162 | T03, T04, T05, T07, T08 |
| `010-Events_And_Ledger/005-Resource_Events_And_Render_Sync/PAGE.md` | S03 | C0163–C0177 | T05, T07 |
| `010-Events_And_Ledger/006-File_Versioning/PAGE.md` | S03 | C0178–C0183 | T05, T08, T10 |
| `010-Events_And_Ledger/007-Correlation_And_Causality/PAGE.md` | S03 | C0184–C0188 | T04, T05, T06, T08 |
| `010-Events_And_Ledger/003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md` | S03 | C0189–C0199 | T05, T06, T07 |
| `010-Events_And_Ledger/003-Provenance_Model/005-File_Version_Provenance_Schema/PAGE.md` | S03 | C0200–C0210 | T05, T08, T10 |
| `010-Events_And_Ledger/003-Provenance_Model/001-Chat_Metadata_Provenance_Schema/PAGE.md` | S04 | C0211–C0234 | T08, T09 |
| `010-Events_And_Ledger/003-Provenance_Model/002-Tool_Call_Provenance_Schema/PAGE.md` | S04 | C0235–C0248 | T08, T09 |
| `010-Events_And_Ledger/009-Assistant_Query_And_Review_Loops/PAGE.md` | S04 | C0249–C0252 | T09, T10 |
| `010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md` | S05 | C0253–C0264 | T04, T10 |
| `010-Events_And_Ledger/003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md` | S05 | C0265–C0279 | T06, T10 |
| `010-Events_And_Ledger/003-Provenance_Model/008-Audit_Query_And_Review_Provenance_Schema/PAGE.md` | S05 | C0280–C0291 | T09, T10 |
| `010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md` | S05 | C0292–C0301 | T10 |
| `010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md` | S05 | C0302–C0364 | T06, T10 |
| `010-Events_And_Ledger/011-UI_Action_Provenance_Module/001-Wiki_Viewer_UI_Context/PAGE.md` | S05 | C0365–C0375 | T06, T10 |
| `010-Events_And_Ledger/011-UI_Action_Provenance_Module/002-File_Viewer_UI_Context/PAGE.md` | S05 | C0376–C0387 | T06, T10 |
| `002-Server_And_Runtime/PAGE.md` | S01 | C0388–C0399 | T01, T02 |
| `005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md` | S02 | C0400–C0420 | T03, T04, T05 |
| `005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md` | S01 | C0421–C0438 | T01, T05 |

Supplementary source identities bring the source/test manifest to 232 files. Query response registration was located at `fusion-studio-client/src/lib/ws-client.ts:19–21,429`; stale query retirement is in `lib/ws/workspace-handlers.ts`. Agent activity capture is called by `fusion-studio-server/lib/wire/canonical-chat-event-applier.js:257`; S04 follows the active bridge→applier path. These complete the S00 owner discovery without claiming detailed later-slice validation.

## S01 execution supplement

The five System-boundary targets now have per-page/claim mappings and current source chains in [S01-EVIDENCE.md](S01-EVIDENCE.md), exact identities in S01-SOURCE-EVIDENCE.json, and edit/snapshot provenance in S01-CHANGE-MANIFEST.json. Calendar source inspection includes the registered consumer and demo initial mount; preservation distinguishes existing deletion and diagnostic cleanup. S01 checks/gate are recorded in S01-HANDOFF.md and S01-CHECKS.json. This supplements S00 input evidence without certifying later-slice pages or any runtime.

## S02 execution supplement

Seven current event/storage targets are reconciled with per-page claims, narrow accepted overlays, actual table ownership and source chains in [S02-EVIDENCE.md](S02-EVIDENCE.md). S02-SOURCE-EVIDENCE.json identifies 82 source/test files and bounded search results; S02-CHANGE-MANIFEST.json preserves seven pre-edit snapshots plus three correction snapshots; S02-PAGES.diff reproduces the actual page changes. Builder-owned review is CLEAN, first pass, with exact results and lifecycle in S02-HANDOFF.md. This is source/documentation evidence, not product runtime certification.

## S03 execution supplement

Five save/snapshot/freshness primary pages are reconciled in [S03-EVIDENCE.md](S03-EVIDENCE.md), with exact hashes/source searches in S03-SOURCE-EVIDENCE.json and complete preimages/diff in S03-CHANGE-MANIFEST.json and S03-PAGES.diff. The production chain starts in Office/Email document save callers and ends in both policy-ready FileDocumentPresenter and fallback FileViewer; it does not claim a production File editor gesture. Source limits distinguish required preimage protection, unknown/postwrite outcomes, best-effort delivery, same-workspace dirty reconnect preservation and targeted File cache invalidation without a dirty guard. Two exact S02 context statements are corrected under S03-D02; their prior wording/byte evidence is superseded only there. S03-HANDOFF.md owns this builder gate and lifecycle, not later-slice acceptance or runtime certification.

## S04 tools, checkpoints and query evidence

Three primary pages reconciled against current source and accepted ATP-D15–17/Bridge identity boundaries. See [S04-EVIDENCE.md](S04-EVIDENCE.md), exact source/test/authority anchors in S04-SOURCE-EVIDENCE.json and checks in S04-CHECKS.json. Current full Chat arguments/results persistence is distinct from bounded provenance query disclosure; terminal-only capture, candidate misses, native prerequisites, sparse first/changed/unchanged checkpoints, exchange binding, ledger/query and actual renderer consumers are explicitly bounded. Product tests/runtime were not run. S04-D01 adopts newer owner-directed source-only wiki metadata and actual edit timestamps on three pages; S06 adapts cumulative validation/migration.

## S05 UI, automation and future contracts

Seven pages now distinguish the implemented optional save-context carrier and current legacy automation from unimplemented general UI-action, audit/storm and plugin contracts. [S05-EVIDENCE.md](S05-EVIDENCE.md) maps every page to raw authority, real producer/consumer chains and negative searches; S05-SOURCE-EVIDENCE.json records current source hashes. Durable automation runId/kind, T1/T2 history and T3 exclusion are preserved; exact future schemas/executors/output/lifecycle choices are not invented. S05 uses current owner-directed metadata with real edit times; parent completion stamping and earlier-page migration remain separate. No product tests/runtime were run.

## S06 cumulative disposition

All 27 current pages and all 438 S00 input blocks have terminal records in S06-DISPOSITIONS.json. S06-EVIDENCE.md supplies separate AC01–10 rows and V1–V6 scope, source chains remain raw evidence in S01–S05-EVIDENCE and current identities in S06-SOURCE-EVIDENCE. Metadata adopts explicit owner policy; only 17 earlier pages are edited, with actual timestamps and complete predecessor snapshots. FINAL-ARTICLE-HASHES.json is the exact 27-page pre-parent-completion-stamp identity. No runtime/app/Alpha certification follows.
