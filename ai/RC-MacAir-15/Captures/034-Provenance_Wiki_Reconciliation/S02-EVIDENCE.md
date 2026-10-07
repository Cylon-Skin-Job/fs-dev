---
name: S02 governed event and storage evidence
description: Source and authority chains for seven reconciled event architecture pages.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# S02 evidence

Candidate PW01-f24d5cd427b9ca14. Source inspected 2026-09-19 in `/Users/rccurtrightjr./projects/fs-dev`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. S02-SOURCE-EVIDENCE.json records 82 exact SHA-256 identities, line/symbol anchors and timestamped search/metadata command results. Source rows identify the bounded claims inspected; they do not certify entire modules. Existing S00/S01 evidence is reused where still valid. No overlapping S00 source hash changed. Branch/remote/tag identities are unchanged; newly observed stash/Codex internal refs do not change this inspected feature source. No fetch or merge was needed. Installed Alpha remains unverified.

## Page and authority mapping

All seven targets are changed-and-checked for their S02 subject; S02-CHANGE-MANIFEST.json is the exact path/prehash/snapshot/posthash record and S02-PAGES.diff is the complete baseline-to-current diff. Primary input claims are C0097–C0162; supporting UEB claims C0400–C0420 from S00 inventory.

| Target | Claim group / status | Authority |
|---|---|---|
| Universal Event Bus, C0097–C0101 | Startup authority, admission, filters/grants/compilation, delivery timing, legacy separation; current | S02-C1–C4 active_code_constraint; MVP-D01–07/D14/D18 and ATP-D09/D15–17 accepted contracts |
| Event Taxonomy, C0102–C0105 | Exact registered names and actual carriers; conceptual domains separate from enabled schemas | S02-C2/C3/C5; approved timestamped facts and bounded overlays; wider schemas proposal/open |
| Provenance Model, C0106–C0139 | Real IDs, transport/context versus human cause, observation versus preimage; required/optional failure rules | S02-C2/C4/C5; PW-D01–07, MVP-D06–09/D14–16, ATP-D02/D04/D15–17, BRG-D09; common envelope/graph proposal |
| Ledger Event schema, C0140–C0152 | Actual ingress/sink transactions, retry marker and limits; admission is not persisted success | S02-C4/C5/C6; current plus narrow MVP/ATP overlays; broader integrity/graph/ledger-internal policy open |
| Ledger Schema, C0153–C0159 | Real table owners, keys/indexes and current context migration; no generalized ledger schema | S02-C1/C5/C6; PW-D01/02/05–07; future retention/restore separate |
| Structure, C0160–C0162 | Actual source ownership and client integration versus planned module areas | S02-C1–C7; current file existence/symbol checks; no broad UI/automation implementation claim |
| UEB standard, C0400–C0420 | Replaces conflicting accepted-ref/nonwaiting doctrine with precise trusted-current contract and scoped supersession | Raw MVP-D14/D18, ATP-D15–17 and PW decisions; S02-C1–C6 source; unrelated Chat behavior not recertified |

Raw authority: DECISIONS.md, AUTHORITY-MATRIX.md and S00 receipt evidence; reread Capture 023 DECISIONS and Capture 024 DECISIONS, especially exact MVP-D09/D14/D15/D16 and ATP-D15/D16/D17. Historical accepted receipts identify the save/subscription and agent implementation contracts but are not current test results. Capture 008 map/common-envelope/ledger draft requirements are proposals outside their accepted overlays. BRIDGE-01's reported-context acceptance remains the S00/S01 raw-receipt authority, not approval of general ui.action. Durable wiki prose contains no capture/SPEC IDs. No product intent was changed.

## S02-C1 — Startup, migrations, registry and effective authority

`lib/db.js:14–17,25–47` selects System DB and runs migrations. `startup.js:231,247–255,408–469` initializes registry before public traffic, constructs four handlers and scoped providers, starts controller, seals admission, runs agent startup owners and save reconciliation; `538–545` installs routes before subsequent subscribers. `event-registry/index.js:createInitializedEventRegistry/createReadAccess` → `reconcile.js:reconcileSystemSchemas` reads/inserts seeds transactionally and preserves existing rows/reductions → `repository.js:408–454 calculateEffectiveState` → `policy.js:203–353 evaluateSchemaRow/evaluateSubscriptionRow` validates canonical bytes, hash/locked identities, state, references, installed handlers and intersected grants. `repository.js:543–562` exposes ordinary repository; human authorization capability exists only in the NODE_ENV=test fixture, not a shipped Systems UI. The registry initialized access is read/validate only.

Migration 034 defines three authority tables with unique semantic schemas and distinct requests/grants. Migration 040 explicitly refreshes four changed locked schema definitions during migration before ordinary reconciliation, as well as reported-context columns/indexes. It is not a contradiction to reconciliation's preservation rule. Bad rows are derived inactive, not silently overwritten/quarantined by this read; infrastructure errors can fail startup. No live DB was inspected.

`test/event-registry/seed-reconciliation.test.js:72–114` asserts four seeded subscriptions and 13 grants; `183–216` asserts changed locked definitions/missing grants remain persisted and inactive. Bodies inspected, **test asserted, not rerun**.

## S02-C2 — Four reserved publishers and actual carriers

`subscriptions/admission.js:28–51` is the immutable lexical catalog; `148–245 createPublisher` snapshots the body, awaits reservation verification, compares canonical durable hash, validates active schema, deep-freezes and dispatches. Bootstrap seals before installer calls. Host bootstrap and file-provenance bootstrap wire exact closure sets. Current `durable-reservations.js:8–78` issues WeakMap-bound tokens over `file_operations`; fact-reservation-bindings builds exact command/resource bodies. `agent-provenance/fact-authority-repository.js:11–32,101–207` binds tool activity or snapshot rows and commits only their admission/ledger readiness before dispatch. Save markers are updated afterward by fact-replay. Rejected public body cannot supply reserved envelope keys. Replays can redeliver.

Four JSON schemas were read as data: file-command-accepted, resource-mutated, agent-tool-completed and resource-state-observed v1. Shared top-level keys are eventId/eventType/schemaVersion/occurredAt/workspaceId/operationId; no common eventFamily/ids/provenance envelope. `file.command_accepted` body is commandId/origin/resource/intent; mutation adds reserved acceptance identity, mutation and fileVersionId. Agent tool origin/thread/tool/timing/resources/candidatesTruncated and observation source/resource/observation are distinct. Observation schema permits only first/changed bytes/absent; unchanged belongs to v2 projection. Reserved acceptance identity does not imply admitted delivery or an event_log row.

`test/subscriptions/admission.test.js:150–246` asserts freezing, exact reserved input/replay, forged identity/schema/body rejection. `test/agent-provenance/fact-authority-and-ledger.test.js:83–178` asserts agent commit-before-delivery, claim gating, exact tool/observation projections and rejected mutated bodies. **Not rerun.**

## S02-C3 — Grants, filters, handlers, delivery and downstream projection

`event-registry/filter.js:10–17,97–155` supports only resource.mutated, agent.tool_completed and resource.state_observed v1 with closed AND resource predicates. `file.command_accepted` is registered/publishable but unfilterable and has no seeded subscriber. `subscription-seed-catalog.js` binds four locked handlers with priorities -100/-50/0 and policies: save ledger, agent ledger and observation scheduling required_ack; save renderer best_effort. `generation-compiler.js:compileGeneration` requires exact handler grants and active referenced schemas, validates providers and sorts ordinally. `capability-factory.js:createScopedContext` binds append/schedule to the same fact and restricts projection fields/diagnostic codes; it does not expose DB/bus handles.

`controller.js:performReload` atomically installs valid generations, keeps only unchanged independently revalidated prior descriptors on compile failure, clears on authority-read failure. `dispatchAdmittedFact:264–306` snapshots a generation, invokes in order, awaits required acknowledgments, observes best-effort rejection. `observeRequiredAck:228–262` has a two-second timer; the unresolved underlying handler remains drain-owned (`stop:194–210`). A callback resolving rescheduled/conflict status is still completed at the transport layer. Admission awaits delivery and catches failures, so admitted=true is not stored/delivered/client-confirmed.

Save renderer chain: admitted fact → `subscriptions/handlers/resource-render-projection.js:handleResourceRenderProjection` → narrow capability → `ws/resource-projection-publisher.js:174–216` snapshot exact workspace/epoch, schema validate, recheck recipient, send/close failed socket → `src/lib/ws/file-handlers.ts:275–299` validates v1/v2/recovery → `src/state/fileDataStore.ts:383–435` drops stale pair, deduplicates and applies targeted invalidation → `src/components/file-explorer/FileViewer.tsx:27–30` consumes store content/metadata/error/loading. Source-inspected chain only, no live visible-success claim. Agent observation projection uses separate durable jobs signaled at admission; no extra event bus or general audit UI follows.

`test/subscriptions/controller.test.js:250–369` asserts timeout, immutable in-flight generation and late settlement retained through stop. `compatibility.test.js:64–105` asserts legacy emit cannot invoke governed handlers. Bodies inspected, **not rerun**. Detailed freshness/dirty-buffer and agent-runtime cases remain S03/S04's scope.

## S02-C4 — Save required protection versus optional/postwrite facts

`save-controller.js:420–575` validates target/text and server workspace, reserves durable operation, awaits command publication, reads/prepares preimage, records attempted write then invokes atomic replacement. `file-operation-repository.js:277–314` prepares file_versions transactionally. `fact-replay.js:58–113` handles pending command admission and postwrite resource publication/projection recovery. Rejection of optional command-fact admission can remain pending; prewrite operation/preimage/attempt registration failure prevents replacement. `reconciliation.js:116–175` does not infer succeeded from observed postimage after interrupted attempted replacement; it retains outcome_unknown and recovery.

`test/resources/save-controller.test.js:877–896` asserts persistent prewrite outage gives failed_before_replace without target creation; `575–614` asserts successful bytes with pending fact and projection-unavailable recovery. **Not rerun.** Optional UI context sanitization is verified S01 evidence and current fact-reservation-bindings originFromInput; its omission does not weaken required preimage protection.

## S02-C5 — Real storage and legacy attribution

Migration 029 owns event_log/event_resource_edges/event_tags; 035 owns resource_registry/file_operations/file_versions/resource_provenance_events; 036 owns agent_tool_activities/agent_tool_resource_edges/agent_snapshot_blobs/agent_resource_snapshots and bind/observation/renderer jobs; 040 extends save context and locked schema definitions. Exact create-table/index anchors are in S02-SOURCE-EVIDENCE.json. Source owners are actual query/update/insert callsites, not inferred from filenames.

`ledger/resource-provenance-repository.js:validateFact/rowMatchesFact/appendResourceFact` verifies succeeded durable save input and transactionally writes event_log, subject resource edge, compact save projection and stored marker; duplicate hashes and conflicting identities have separate outcomes. `agent-ledger-repository.js:sourceBindingMatches/projectionFor/appendClaimed` verifies admitted canonical JSON/hash and transactionally writes event/edges/source ledger state. Tool path-bearing edges use agent access roles; observations use observed role; both keep causation null. `created_at` is first-write-owned, excluded from exact agent replay comparison. No tags/causal graph are inserted by governed writers.

Legacy `event-ledger-subscriber.js:11–29` schedules writes for its whitelist only; `event-ledger.js:5–9,40–59,73–101,139–193` records three topics, infers file actor user/source watcher if absent, sanitizes selected content keys/truncates long strings, copies optional correlation/causation, writes event/edges/tags. This heuristic is not proof. `event-bus.js:emit/emitSafely` uses synchronous process-local depth/trigger guards, not universal async causal context. The corrected producer search records actual watcher/workspace/thread/Chat emission paths. The first guessed lifecycle filename search exited 2; the corrected exact path search exited 0 and supersedes that discovery miss.

`test/ledger/event-ledger.test.js:60–135` asserts narrow topics, resource edge/redaction and unrelated-event omission; `test/ledger/resource-provenance-repository.test.js:75–109` asserts duplicate/conflict behavior. Bodies inspected, **not rerun**.

## S02-C6 — Bounded retries and negative feature claims

`file-mutations/sqlite-contention.js:16–40` defaults to five immediate yielded attempts; save repository uses it. Save reconciliation scans its own pending/terminal records and is not described as having the agent scheduler cap. Agent fact reconciler constants/functions record 100-source/one-second startup and one delayed retry with exact-key suppression. Agent ledger repository constants/claim/settleFailure enforce three charged cycles, 30-second lease, +250/+1,000 ms retries; agent ledger reconciler project uses five immediate attempts and transition suppression. Durable pending is not guaranteed eventual success, and callback timeout is not cancellation.

Exact negative search in S02-SOURCE-EVIDENCE.json: `rg -n 'resource:invalidate|ledger_events|PreparedCanonicalCandidate|prepareCanonicalCandidate|AcceptedCanonicalRef|loadAcceptedLedgerRowRef|publishCanonical' fusion-studio-server/lib fusion-studio-client/src` exits 1 (no matches). Together with complete active seeds, four-publisher catalog, filter list, migration inventory and producer/repository consumers, this supports bounded absence of the old generalized schema/APIs. It does not claim absence from history or every possible external module. No remote availability or app-wide code audit is implied.

## S02-C7 — Self-review, scope and residual dependencies

Self-review read the rewritten prose/diff against exact schemas and source chains, verified S01 decision consistency, and corrected the FileViewer path to file-explorer. A second self-review made migration 040's controlled schema refresh explicit. Root integration inspection additionally identified the connected FileDocumentPresenter path. Independently read ContentArea → ViewTabBar → policy-gated viewTabAdapters/fileConnectedAdapter → FileDocumentPresenter (central store selectors/requestContent at lines 33–44); legacy children remain FileExplorer → FileViewer. Structure now lists both paths with another exact snapshot. S03 retains full production save/freshness mount coverage. Each correction has its own pre-edit snapshot. No earlier-page corrections were needed. Seven page names/paths remain stable and all generated marker bytes remain unchanged.

UEB supporting-page rewrite is bounded to conflicting event/provenance rules; command/fact, provider separation and Chat persistence ownership remain. The stale exact draft machinery was replaced rather than promoted to mandatory future work. Chat-specific emitted optional examples were removed from the standard's illustrative table rather than recertified; the Chat owner remains authoritative. This is within the named supporting reconciliation target, not an out-of-scope touch.

Other primary pages still contain their S03–S05 input defects until those slices; whole-section V4 output explicitly retains these pending-owner results. No broad section completion claim is made. General UI/automation/graph/plugin/retention/restore remains open; no adapter/code/test/config/DB/runtime edits or runs. Product smoke/build/runtime checks are N/A under the explicit documentation-only boundary. Structural Markdown checks are not visual runtime validation.
