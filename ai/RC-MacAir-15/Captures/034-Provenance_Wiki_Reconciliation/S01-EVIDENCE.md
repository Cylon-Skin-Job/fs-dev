---
name: S01 System boundary evidence
description: Per-page authority, current source chains, and bounded inspection evidence for S01.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# S01 evidence

Candidate PW01-f24d5cd427b9ca14; source inspected 2026-09-19 in `/Users/rccurtrightjr./projects/fs-dev`, development HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. `S01-SOURCE-EVIDENCE.json` gives exact current SHA-256 and line/symbol anchors for every source/test below. `S01-CHANGE-MANIFEST.json` gives exact pre-edit/snapshot/post-edit page hashes. S00 baseline/authority evidence remains applicable; no current source hash drift was found by the documentation verifier. Inspection did not import application modules, read a live DB or execute product code. Installed Alpha remains unverified.

## Per-page and claim mapping

| Page (under Wiki) | Reconciled claims and status | Authority/evidence and limit |
|---|---|---|
| `010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md` | C0001–C0005: current subset, System ownership, current/target/open reading rule and incomplete-section warning; generated topic descriptions are not deployment claims. | PW-D01–09 owner_decision; current facts S01-C1/C4/C5/C6 below. Source inspected; no runtime result. Capture links moved out of durable explanation; authority remains in AUTHORITY-MATRIX. |
| same folder `001-Vision/PAGE.md` | C0006–C0019: durable goals retained, broad restore/graph/self-improvement described as future; System/source/workspace/plugin and retention boundary explicit. | PW-D01–07/09, MVP-D07/D08, BRG-D01/D03/D04/D08 spec_contract. Future graph paths are illustrative product direction, not live schema or accepted executor/capacity choices. |
| same folder `002-Decisions/PAGE.md` | C0020–C0096: settled System boundary; bounded save/subscription, ATP and Bridge overlays; actual awaiting/failure timing, legacy evidence, context/actor separation, snapshot timing and future decision triggers. | PW-D01–09; raw MVP-D09/D14/D15/D16; ATP-D15/D16/D17; BRG-D03/D05/D08/D09, accepted receipts in S00 matrix. Current S01-C4–C6; old exact token/lease/accepted-reference/executor doctrine is proposal outside overlays. No wholesale schema/design approval. |
| `002-Server_And_Runtime/PAGE.md` | C0388–C0399 existing unrelated workspace/view text retained; inserted authoritative System boundary, complete calendar chain, and bounded deletion/cleanup limitation. | PW-D01–07 owner_decision, PW-O01/O05 open; S01-C1–C3 active_code_constraint. Not an app-wide storage/lifecycle audit. |
| `005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md` | C0421–C0438 existing owner contracts retained; bounded System/provenance section links hub, distinguishes target/enforcement, required preimage from optional context. | Same owner direction; S01-C1–C6. Existing unrelated Chat/recovery standards are not recertified. Unchanged directory pointers remain reported limitations. |

The approved raw decisions and receipt paths are preserved in AUTHORITY-MATRIX.md; S01 reread the complete PW decision ledger and the raw MVP, ATP and Bridge decision sections used here. Approval is determined by the accepted receipts, not their stale planning headers. No capture/SPEC identifier remains in rewritten primary prose.

## S01-C1 — System, current singleton and target separation

`lib/db.js:14–17,25–53` selects development or explicit user-data `fusion.db`, initializes migrations and exposes one initialized Knex singleton. This is active_code_constraint/current. System's mutable controls plus history, external app authority, separate workspace content DBs, plugin interfaces/no self-grants, snapshots as copies and preservation default are owner_decision/approved target (PW-D01–07). They do not assert all filesystem System state is in SQL or complete plugin/filesystem enforcement exists. Future email/calendar specs may not cite current SQL calendar storage as approval to add live-content tables. A separate user workspace SQLite file remains valid content.

## S01-C2 — Conditional calendar producer, storage, API and consumer

Current producer chain: `startup.js:231` initializes DB; `613–616` starts calendar adapters through the startup effect owner → `calendar/index.js:14–29` checks each opt-in via `background-services/config.js` (default false; environment override; fixed server `data/config.json` path). Apple also checks the local Calendar DB exists → `watch/calendar-watcher.js:17–29` subscription callback → `calendar/apple/sync.js:9–29` bounded date-window reads/conversion, null-read skip → `calendar/db-writer.js:1–19` upserts. Google `google/poller.js:7–25` starts immediately then at five-minute intervals → `google/sync.js:8–30` calls bridge and skips missing results → `google/client.js:3–21` requires bridge URL/key → same writer. This is source-present conditional behavior, not observed sync enablement or user data.

Storage/read chain: writer `getDb()` is the System singleton → migration `022_calendar_sync.js:1–29` creates calendar source metadata and event content fields → `server.js:170` mounts `http/calendar-routes.js:13–43`; calendars sorted by title, events queried for overlapping start/end with optional source → `src/state/calendarStore.ts:140–174` fetches/maps into calendars/events. Sync completion bus → `ws/calendar-broadcaster.js:9–26`, startup `591–594` → `src/lib/ws-client.ts:31,435` registers `handleCalendarMessage` → `src/lib/ws/calendar-handlers.ts:8–16` fetches current-range events. This reader is real code even though initial mounting uses demo data.

Actual UI consumer: `src/components/ContentArea.tsx:28,42` registers CalendarViewer; `CalendarViewer.tsx:10–32` selects the store and calls `loadDemoData()` on mount, then `110–128` passes store events/calendars to CalendarMonthView. Store `189–215` avoids date-navigation fetch in demo mode, but the sync handler does not check demoMode; it can fetch real event rows afterward. No production invocation of `fetchCalendars` was found outside its definition by `rg -n 'fetchCalendars|fetchEvents|calendarStore|calendar:sync_complete' fusion-studio-client/src`. Store `177–187` create/update/delete only warn, so no live write-back claim is made.

PW-D03 target conflicts with this System live-content projection; PW-O05 defers removal/migration/alternative access. No user database was queried, no live provider was contacted, and no migration approved or executed. This bounded adjacent audit does not certify every app's storage.

## S01-C3 — Preservation target versus actual deletion/cleanup

`ThreadManager.js:681–725 deleteThread` checks group membership, closes session, records mirror recovery where applicable, calls `ThreadIndex.js:202–210 delete`, and cleans group/mirror state. Migration `001_initial.js:24–30` cascades thread deletion to exchanges. Migration `036_agent_tool_provenance.js:36,396–404` nullable binding/trigger clears the three exchange binding fields; checkpoint tables are separate. This establishes actual current delete behavior without redefining Chat ownership or promising restore. Full group lifecycle is a read-only Chat dependency.

`harness-diagnostic-service.js` retention constants and `cleanupHarnessDiagnosticsIn` purge expired diagnostic rows and evict to 500 per workspace/5,000 total; insertion applies it transactionally, and `startup.js:240–241` calls its best-effort startup wrapper. These are dedicated diagnostic limits, not an approved universal retention policy. `test/thread/harness-diagnostic-service.test.js:212–274,318–340` asserts expiry/caps and startup cleanup; bodies read, **test asserted, not rerun**. PW-D07 preservation remains target; exact harmonization is PW-O01 future lifecycle work.

## S01-C4 — Governed and legacy distinction; narrow overlays

`subscriptions/admission.js:28–51,148–221` defines four static publisher identities, verifies durable reservations, validates/freezes facts, commits agent admission before dispatch, awaits delivery and catches delivery failure. `controller.js:264–306` invokes handlers, awaits required_ack and records separate status. Thus admitted is not persisted/delivered, and source does not implement the older universal no-await executor doctrine. `ledger/event-ledger-subscriber.js:11–29` separately observes legacy wildcard events; `ledger/event-ledger.js:5–9,40–49` whitelists three topics and can heuristically infer `user` for file changes. This is bounded current behavior, not causal proof or generalized common-envelope implementation.

MVP-D14 supersedes old UEB/LED/ULV blockers only for its four save/subscription SPECs. ATP-D15/D16/D17 overlay only normalized activity/fingerprints, exact observational checkpoints and two admitted ledger facts. Wider canonical tool/native-ref/output/graph/version/restore branches remain open. S02 owns full schemas/tables and standards reconciliation; S04 owns full tool pipeline.

## S01-C5 — Save protection and reported context

Production caller `src/state/fileDataStore.ts:518–568` reads context and sends v1 `file_save` → `ws/client-message-router.js:442` dispatches → `ws/file-save-route.js:114–173` validates current workspace pair and sanitizes optional context → `save-controller.js:420–594` validates text/path, reserves operation, publishes acceptance, reads/prepares preimage, marks attempted, calls atomic replace, persists terminal outcome and returns. `text-codec.js:15–68` establishes exact scalar/NUL-free UTF-8 and 10 MiB rules; `path-authority.js:72–181` enforces workspace/panel/final-target safety; `readPreimage:141–168` reads safely and rejects incompatible/oversized/unreadable preimages.

Preimage preparation failure stays before atomicWriter invocation; `test/resources/save-controller.test.js:877–896` injects persistent prewrite storage outage and asserts failed_before_replace and untouched target. Postwrite `fact-replay.js:58–112` recovers failed publication or missing projection without relabeling a successful replacement as prewrite failure; test `575–635` asserts completed bytes and recovery. Both bodies inspected, **test asserted, not rerun**. Detailed readback/reconnect/dirty-buffer/runtime scenarios remain S03; S01 makes no live-success claims.

`src/lib/save-action-context.ts:49–105` reads registered live view/component context, omits unusable fields and never writes view state → same save caller/route → `reported-ui-context.js:75–140` sanitizes against server workspace. `test/ws/file-save-route.test.js:351–413` asserts valid context and malformed/oversized/stale degradation, **not rerun**. BRG-D09 uses the existing carrier, not a general `ui.action` or authenticated human actor; historical context cannot own live view state.

## S01-C6 — Observation checkpoint boundary and negative claims

`agent-provenance/resource-observer.js:152–338 processClaim` processes an already reported activity resource, fails with secure_open_unavailable if the native observer is unavailable, and calls checkpoint storage on successful eligible observation. `checkpoint-repository.js:169–348 applySuccessfulObservation` reuses unchanged state, inserts first/changed state with content-addressed bytes/absent state, and preserves distinct observation metadata. No earlier preimage or causal verdict follows from post-tool timing. Full terminal/interruption/exchange/query chains remain S04's ownership, not claimed complete here.

Exact bounded search: `rg -n 'queryResourceProvenance|queryAgentActivity|uiActionSeed|publishCanonical|PreparedCanonicalCandidate|file\.version' fusion-studio-client/src fusion-studio-server/lib` returned only `src/lib/ws/resource-provenance-protocol.ts:162` helper definition. Combined with four static publisher registrations and accepted scope, this supports absence of those broader provenance APIs in inspected source; it is not an app-wide claim that no independent restore or query facility exists. General restore/audit/UI statements are explicitly future contracts. No external process searched or executed.

## Inspection commands and limits

Reads used `cat` for exact guidance/authority/source files and `sed -n` for the line ranges above; symbol/caller discovery used `rg -n` and `rg --files`. All successful reads returned exit 0. Two discovery reads guessed nonexistent `022-calendar-tables.js` and `test/file-mutations/save-controller.test.js`, and another guessed nonexistent `text-validation.js`/`preimage.js`; these returned missing-file diagnostics and were corrected with `rg --files` to `022_calendar_sync.js`, `test/resources/save-controller.test.js`, `text-codec.js` and inline `readPreimage`. They are not reported as passed checks. Current exact hashes resolve all final pointers.

Read-only reviewers append `--read-only` to suppress receipt writes while running the same assertions. The exact rerunnable check is `node ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation/s01-verify.cjs`; command arrays, timestamps, exit statuses/stdout, full scope vocabulary sweep and status are in S01-CHECKS.json. The script checks every normative candidate hash, all 27 frontmatters, five current page hashes/snapshots/navigation/identity, changed-page links/anchors and source pointers, source evidence hashes and required diff whitespace. It reads application files as data and imports only installed gray-matter. Raw changed Markdown was manually reviewed for semantic scope, tables, fences and physical paragraphs; no visual runtime validation claimed.

Unchanged supporting limitations: missing Server hub `lib/thread/ThreadRuntimeManager.js` source pointer; Persistence standard directory pointers `lib/thread/` and `lib/chat-metadata/`; existing hard-wrapped unrelated supporting prose. DEP-07 routes these without certifying or broadening the update. Generated navigation is byte-exact and its future descriptions are qualified immediately above the block. Other slices' vocabulary matches remain their allocated input, not S01 passes.
