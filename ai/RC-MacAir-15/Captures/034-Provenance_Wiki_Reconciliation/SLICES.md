---
name: "PW-01 Ordered Slice Packets"
description: "PW-01 Ordered Slice Packets for the documentation-only provenance reconciliation."
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Ordered execution packets

Every packet inherits SPEC.md sections 2–7, INDEX.md standards routing, DECISIONS.md, and VALIDATION.md. One new `spec-slice-builder` per slice, one active writer; builder-owned clean review then independent orchestrator inspection and fresh acceptance review before the next slice. Builders may spawn only fresh read-only reviewers. No product code or runtime operations. Record all deviations and current evidence. PAGE-MAP.json is the exact page census and primary ownership map; later slices may make necessary consistency corrections to earlier pages through the same gate protocol.

## S00 — Establish execution evidence and authority

Prerequisite: owner-approved candidate. Writes: C execution artifacts only.

Recapture root, HEAD, branch, dirty files, current 27 page bytes and source/test hashes for inspected claims. Recheck branch evidence if refs or relevant source changed since preparation; fetch only if needed and record availability, never merge. Record pre-existing page hashes and generated marker content. Create EXECUTION-BASELINE.json, EXECUTION.md, EVIDENCE.md, and CROSS-SECTION-DEPENDENCIES.md. Use execution-time bytes, not preparation copies, for subsequent snapshots.

Read all 24 section pages; inventory every substantive current/target claim and source owner by topic. Read the three supporting pages within scope, guidance and exact routed standards. Build an authority matrix for Capture 008, approved Capture 023/024, BRIDGE-01/02, plugin 030/032 and PW-D01–09. Resolve approval status from actual receipts rather than stale headers. Every row states contract, authority, exact scope, supersession and residual open branches. Record excluded-owner dependencies without edits.

Checks: V1, initial V2–V5 inventory from VALIDATION.md; existing defects are input findings rather than silently passed. Exit: all 27 pages assigned, source owners discovered, no unexplained missing prerequisite, and a plan to resolve or truthfully label each material claim. This is evidence preparation, not a runtime acceptance slice.

## S01 — System ownership and reusable decision guidance

Prerequisite: accepted S00. Primary pages: Server And Runtime; overview, Vision, Decisions; Persistence And Metadata standard.

Write the approved System boundary in the existing Server hub, linked from primary provenance overview/decisions and the persistence standard. Explain mutable system records versus durable history, authoritative app/workspace data, separate workspace databases, controlled plugin interfaces, snapshots as evidence/recovery, and preservation default. Do not imply the filesystem `System/` tree is identical to fusion.db or move all configuration/state into SQLite.

Trace and document the calendar exception through DB selection, opt-in startup, writers, HTTP routes and client consumer. State source-present conditional behavior, not observed user data. Describe any relevant current deletion behavior separately from the preservation target; use Chat references without modifying Chat contracts. Add overview guidance on reading current/target/open claims and avoiding repeated settled questions. Don't mark the whole section reconciled until S06.

Checks: V1–V5 for changed pages, semantic AC02/AC08 and approved-direction traceability to PW-D01–09. Exit example: a future email/calendar spec cannot add live content tables to fusion.db based on legacy code; a user-created workspace SQLite file remains valid; a plugin cannot self-grant database authority. No policy or migration implementation is implied.

## S02 — Current event, schema, subscription and storage architecture

Prerequisite: accepted S01. Primary pages: bus, taxonomy, Provenance Model, Ledger Schema, Ledger Event schema, Structure; UEB standard.

Trace startup → registry seeds/migrations/reconcile → admitted publisher catalog/reservations → subscription compilation/capabilities/delivery → relevant durable projections. Contrast with legacy EventEmitter and legacy ledger whitelist. Explain real current event names, carrier fields, table ownership, admission versus delivery/persistence success, retries/reconciliation and failure timing. Distinguish `event_log` and current resource/agent stores from proposed generalized `ledger_events`/accepted-ref graph. Describe actual causal limits and heuristic legacy attribution rather than calling every field proof.

Apply scoped MVP/ATP supersessions in the UEB standard and section prose. Separate general commands/facts principle from concrete mandatory prewrite save protection; do not state a universal asynchronous/nonwaiting admission rule if actual approved code awaits it. Remove old exact lease/candidate APIs from current guidance; retain only explicitly supported future intent and label unresolved proposals. Structure lists actual current source owners and planned areas separately.

Checks: V1–V5; trace representative command/resource/agent facts against active seeds, migration and subscriber code; AC03. Exit: a builder can identify current authority/admission, public legacy paths, real tables and the limits of the older design without opening an implementation SPEC.

## S03 — Mediated save, snapshots, causal limits and visible freshness

Prerequisite: accepted S02. Primary pages: Resource Events And Render Sync, File Versioning, Resource Mutation schema, File Version schema, Correlation And Causality. Make necessary current-carrier corrections in S05-owned UI pages only if needed for coherence, recording the shared touch.

Trace production save caller → public route → workspace/path/encoding validation → durable operation/preimage → atomic replacement → emitted facts → subscriptions → WebSocket projection → client validator/handler → central store invalidation/refetch → File Viewer consumer. Include create-by-save versus non-migrated rename/move/delete/watcher paths, supported UTF-8 size/symlink limits, prewrite failure, ambiguous outcome, postwrite publication failure, reconnect/stale epoch and dirty-buffer behavior. Report absent legs rather than inferring visible correctness from server events.

Describe save snapshots versus agent checkpoints as separate mechanisms; general restoration, diffs, all-operation coverage and canonical file-version events remain unimplemented or unresolved unless newly proven. Trace BRIDGE-01 reported context into the stored operation/facts/query result; record current field semantics and optionality, untrusted reporting, malformed-context behavior, and no tab-state writeback. Tie correlation claims to actual evidence rather than time proximity or a post-tool hash.

Checks: V1–V5; inspect relevant existing save-route, snapshot, resource integration/projection tests as unrun assertions; AC04 and freshness portion of AC06. Exit includes one supported save, one required-preimage failure and one postwrite projection failure narrative, with source evidence for each and no live-pass claim.

## S04 — Agent activity, checkpoints, queries and Chat boundary

Prerequisite: accepted S03. Primary pages: Chat Metadata schema, Tool Call schema, Assistant Query And Review Loops. Current storage descriptions may need bounded S02/S03 corrections.

Trace configured OpenCode ingress → canonical translation/bridge → activity capture and clocks → candidate extraction → governed tool fact → observation/checkpoint and exchange-binding jobs → ledger projection and query routes → renderer freshness. Inspect interrupted/incomplete terminal activity, bounded candidate misses, raw material disclosure, native-observer prerequisites/failure, first observation versus prior checkpoint, unchanged bytes, queries and restart/reconciliation source paths. Do not promote provider-reported arguments to verified writes or an observation into proof of causation.

Separate full Chat persistence from the bounded provenance overlay; preserve group/session/view/surface identity distinctions and mark Chat-owned gaps as dependencies. Inspect resource-provenance and agent-activity query server routes, request validation/response handlers, client helpers, and production caller searches. State absence of a mounted query/audit UI where supported by the search; no “query exists therefore history UI exists.” Preserve ATP-D15–17 limits and BRIDGE-02 status/meaning.

Checks: V1–V5; inspect existing agent activity, query, checkpoint, exchange-bind and renderer tests without claiming a rerun; AC05/AC06. Exit: an agent tool observation can be followed across the current code, its limitations and disclosure boundary are explicit, and Chat owners retain their files.

## S05 — UI, plugin, automation and future-contract separation

Prerequisite: accepted S04. Primary pages: Automation Run schema, UI Action And Context schema, Audit Query schema, Change Storm Control, UI Action Module and Wiki/File adapter children.

Separate implemented save-context carrier from the first Wiki/File `ui.action` design. Do not claim all commands, panels, buttons, prompt attachments or per-view adapters use the proposed module. Distinguish approved context/granularity principles from detailed unapproved schemas and executor gates. Explain current legacy triggers/automation independently of future governed/plugin emission; make no new producer permission, raw bus access, captured-output schema, or app-content table contract.

Document durable history, automation/storm/audit/query-review goals in product terms; classify residual old decision branches after exact overlays. Preserve owner-approved target without re-asking it. For unresolved details, explain what the owner must eventually decide and the feature trigger. Record plugin 030/032 contradictions and potential Chat dependencies in CROSS-SECTION-DEPENDENCIES.md; do not edit those captures or assume everything labeled pending elsewhere remains blocked after an accepted overlay.

Checks: V1–V5; AC06/AC07. Exit: every design-only example is clearly such; a future builder can distinguish enabled producers from permission requests, and current carriers from proposed schemas.

## S06 — Whole-section consistency and final handoff

Prerequisite: accepted S05. Scope: all 24 section pages and bounded supporting edits; no new product scope.

Read all pages together against execution evidence. Ensure source lists, examples, terminology, authority, failure rules and current/target/open labels agree. Repair through responsible slices where a finding invalidates a lower gate. Complete per-page disposition, claim evidence, decision mapping and external dependency records. Confirm durable prose no longer relies on capture/SPEC history. Finalize the overview's exact reconciliation date/source baseline and evidence limitations, including known calendar divergence and product deferrals.

Checks: cumulative V1–V6 and all AC01–10; a fresh independent final SPEC integration review on current bytes. Exit: REPORT.md states exact scope, source versus runtime evidence, all deviations and residual gaps, checked paths, untouched exclusions, owner decisions and next questions only where real choices remain. Return owner/supervisor-review-ready status, never claim the product or whole wiki is fully verified.
