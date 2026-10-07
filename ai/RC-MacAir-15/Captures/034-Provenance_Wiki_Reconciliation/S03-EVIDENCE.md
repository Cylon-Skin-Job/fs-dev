---
name: S03 save snapshots and freshness evidence
description: Bounded source claims, authority mappings and documentation scenarios for S03.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Evidence scope

Candidate `PW01-f24d5cd427b9ca14`; development HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`; inspected 2026-09-19. S03-SOURCE-EVIDENCE.json holds per-file SHA-256, symbol/test line anchors and timestamped raw read-only command results. S03-CHANGE-MANIFEST.json records every edited page's exclusive complete preimage and before/after hashes; S03-PAGES.diff is the exact initial-snapshot-to-current diff. Source inspection establishes implementation, not fresh runtime behavior. All test assertions below are **not rerun**.

## Authority map

| Raw authority | Accepted scope applied | Residual branch |
|---|---|---|
| Capture 023 DECISIONS MVP-D07/09/14/15/16 and SPEC-03/04 | Exact ≤10 MiB NUL-free UTF-8 save preimage; trusted admission; create-by-save; transport-only origin; File Viewer projections | No all-operation versioning, general accepted-ref graph, universal restore or untrusted plugin authority |
| Capture 023 RELEASE-MANIFEST owner approval 2026-08-29; IMPLEMENTATION-LEDGER SPEC-03 owner Accept 2026-09-02; SPEC-04-IMPLEMENTATION-REPORT, authenticated predecessor in Capture 024 integration | Approved save/projection predecessor, despite stale pending/working headers elsewhere | Historical test results are not current passes |
| Capture 024 DECISIONS ATP-D10/11/13/15/16/17; PROV-01-INTEGRATION-REPORT OWNER_ACCEPTED 2026-09-06, source acf12da / integration d31fc8a | Sparse post-tool checkpoints, bounded observation metadata, v2 invalidation, narrow hash/storage and ledger overlay | No pre-tool interception, causal verdict, general file.version/diff/restore/lifecycle policy |
| Bridge DECISIONS BRG-D01–09; RELEASE-MANIFEST acceptance 2026-09-12 and commit 16ccecf | Optional reported action context, historical snapshot, no tab-state writeback; T1/T2 direction and T3 exclusion | General ui.action and mounted provenance display remain outside bridge; older BRIDGE-02 rationale does not describe today's Chat |
| Current DECISIONS PW-D01/02/06/07/08/09 | System snapshot/recovery ownership; preservation direction; separate restore permission; documentation-only work | PW-O01/02/04 deferred, no migration or new product approval |

Normative preparation headers remain unchanged. Current approval is recorded in RELEASE-MANIFEST/REVIEW; the orchestrator packet authorizes S03. Guidance read: root/server AGENTS, all five Wiki Guidance pages, complete standards hub and routed 001/002/003/004/005/007/008 pages. WebSocket thread postcommit guidance is applied in its thread-action scope; required save preimage behavior uses the explicit accepted save overlay and current UEB standard.

## Claim and source mapping

Paths below abbreviate server `fusion-studio-server/lib/` as S and client `fusion-studio-client/src/` as F. Every listed source has its exact hash in S03-SOURCE-EVIDENCE.json. Evidence class is `active_code_constraint` for current behavior; accepted direction above is `owner_decision/spec_contract`; future schema details are `proposal/open`.

| Page/topic | Source symbols and lines | Status, chain and limit |
|---|---|---|
| Render Sync: production save caller | F `components/office/OfficeDocumentPage.tsx:259–307`, `components/email/EmailDocumentPage.tsx:156–181`, `components/documentSaveAcknowledgement.ts:20–55`; F `state/fileDataStore.ts:518–578` | Current: serialize/captured revision → awaited store save → v1 request. File readers have no edit/save control; fixture socket is not a UI gesture. |
| Render Sync: public ingress | S `ws/client-message-router.js:442–451`, `ws/file-save-route.js:110–190`; F `lib/ws/file-save-protocol.ts:175–236` | Current: current session workspace/epoch, sanitized context, locked schema, owning save; reason maps to saveReason. Held stale A1 cannot choose A after A→B→A. |
| File Versioning: authority/eligibility | S `file-mutations/path-authority.js:96–203`, `text-codec.js:42–81`, `save-controller.js:82–116,335–455`; protected-path-policy.js | Current: workspace registry/panel resolver → real parent/final checks → NUL-free exact UTF-8 ≤10 MiB → shared physical lock/re-resolution. Final symlink/directory/external parent rejected, in-root parent alias allowed. |
| File Versioning + schema: durable snapshot | S `file-mutations/file-operation-repository.js:135–315`, `file-version-repository.js:15–121`, `db/migrations/035_file_provenance.js` | Current: reserve IDs/hash and operation → transaction inserts preimage plus prepared state → markAttempted. Bytes/absent, prospective resource event identity; no universal version event. |
| File Versioning: atomic write/failure | S `file-mutations/atomic-writer.js:36–252`, `save-controller.js:456–547` | Current: exclusive temp write/sync/verify → final hash/identity check → one rename → identity check/directory sync. Before-write failure preserves target; after-rename uncertainty is unknown/non-retry-safe. Final pathname syscall race remains. |
| File Versioning: restart | S `file-mutations/reconciliation.js:117–170`, `save-controller.js:243–318`; S `startup.js:469` | Current: accepted fails, unattempted prepared fails, attempted prepared unknown with observed evidence; pending successful fact/ledger replay, no rewrite. Matching hash is not success. Persist-success outage may leave prepared durable state despite a truthful successful current response. |
| Resource schema: fact shape | S `event-registry/schemas/{file-command-accepted-v1,resource-mutated-v1}.json`; `file-mutations/fact-reservation-bindings.js:56–128`, `durable-reservations.js`; `subscriptions/admission.js` | Current closed top-level shape; origin local_client/transport_only, physical path versus access alias, host IDs. No resource payload snapshot bytes/hash or generic resourceMutation envelope. CommandAcceptedEventId does not prove separate command admission. |
| Render Sync: admission/subscription | S `file-mutations/fact-replay.js:49–120`, `event-registry/subscription-seed-catalog.js:36–124`, `subscriptions/controller.js`, `startup.js:402–473` | Current: reserve → command attempt → replace → resource attempt → required-ack ledger and best-effort renderer. Required preimage storage differs from optional context and pending admission. |
| Render Sync: postwrite recovery | S `file-mutations/fact-replay.js:74–120`, `save-controller.js:187–242`; `subscriptions/handlers/resource-render-projection.js:20–122` | Current: publication failure → fact_publish_failed; missing invoked renderer → projection_unavailable; handler failure → projection_failed. Success/provenanceComplete excludes best-effort visible delivery. |
| Render Sync: WS and validator | S `ws/resource-projection-publisher.js:132–231`, `ws/workspace-session.js`; F `lib/ws-client.ts:428`, `lib/ws/file-handlers.ts:275–308`, `lib/ws/resource-projection-protocol.ts` | Current: match recipients → inject/recheck epoch → bounded send; strict v1/v2/recovery guard → central store. Send/no-recipient result is not client ack. |
| Render Sync: cache and mounted consumers | F `state/fileDataStore.ts:379–458`; `components/ContentArea.tsx:53`, `view-tabs/ViewTabBar.tsx:58–148`, `view-tabs/viewTabAdapters.ts:48–65`, `view-tabs/fileConnectedAdapter.ts:59–87`; `file-explorer/FileDocumentPresenter.tsx:29–64`, `FileExplorer.tsx:75`, `FileViewer.tsx:17–104`, `FileContentRenderer.tsx` | Current: policy-ready adapter presenter or fallback FileViewer → same File cache → React. Narrow content/parent refetch and dedupe, not every app/view. |
| Render Sync: reconnect/dirty limits | F `state/fileDataStore.ts:341–377,479–498,879–992`; `lib/ws/workspace-handlers.ts:157,608` | Current: same workspace dirty cache preserved; clean content/tree refetch; different workspace reset; request/generation/pair guard. Targeted projection at 418–458 has no dirty guard. Office/Email buffers not directly projected because scope is File only. |
| Resource schema: optional context | F `lib/save-action-context.ts:49–104`, `state/fileDataStore.ts:543`; S `file-mutations/reported-ui-context.js:17–191`, `ws/file-save-route.js:126–142` | Current: registered view, matching File connected component only, omissions; server view ID requirement, workspace derivation, 128/512 byte bounds and diagnostic degradation. Not human auth/path authority. |
| Resource schema + causality: persistence/query | S `file-mutations/file-operation-repository.js:218–222`, `fact-reservation-bindings.js:69–127`, `ledger/resource-provenance-repository.js:78–110,167–196,218–315`, `ws/resource-provenance-route.js:162–192`; F `lib/ws/resource-provenance-protocol.ts:144–201`, `lib/ws-client.ts:429` | Current: frozen context from columns → fact → canonical ledger payload + query columns → typed result. No tab config reread/writeback. Query helper defined but no production invocation found in client src. |
| File Versioning + version schema: Git versus observation | S `file-mutations/checkpoint-adapter.js:6–26`, `versioning.js`; `agent-provenance/checkpoint-repository.js:44–75,169–338`, `resource-observer.js:207–215,240–305`, migration 036 | Current: optional post-save Git reason handling versus eligible post-tool checkpoint; first/changed creates, unchanged reuses, no native fallback. No general diff/restore surface in inspected ownership search. |
| Causality: current ledger links and legacy | S `ledger/resource-provenance-repository.js:149–156`; `agent-provenance/agent-ledger-repository.js`; `chat-metadata/collectors/file-mutations.js:8–98`, `ledger/event-ledger.js:40–51,144–160` | Current: operation/activity correlation, null governed causation; full tuple or sole eligible turn association, partial/ambiguous reject; legacy user actor default is heuristic. |
| Compatibility and proposals | S `ws/workspace-request-handlers.js:87`, `watch/workspace-watcher.js:84–91`; bounded source searches in JSON | Current nonmigrated broadcasts/watchers separate. Wider schema/restore/UI/graph claims replaced with target/proposal/open labels, not enabled behavior. |

## Required source narratives

Supported save: a production Office document handler serializes supported text and calls saveFile with its panel/path and dirty revision. The server route accepts only its captured active pair and schema-valid command. Path authority normalizes a valid panel alias into the physical workspace-relative target; reservation/prepare retain exact old bytes before writer invocation. Atomic replacement succeeds, mutation fact admits, resource ledger projection stores, renderer subscriber sends the canonical File path with each recipient epoch, validator/store invalidate the addressed tree/content and both current File consumers render from those selectors. This is a source trace, not a claim that this sequence was run live. It does not prove Office itself receives File-scoped invalidation.

Required-preimage failure: existing bytes `[0xc3,0x28]` cannot fatal-decode as UTF-8. Reservation may already exist and command publication may have occurred. readPreimage rejects; prepare/writer does not replace the file; controller terminalizes the accepted operation as failed_before_replace/unsupported_preimage, resourceFactState not_emitted, ledger not_applicable, retrySafe true. Test `save-controller.test.js:638` explicitly asserts unchanged bytes and failed durable state. Repository/preparation errors similarly prevent writer invocation; no successful resource fact or save-driven refresh is fabricated.

Postwrite publication/projection failure: after verified rename and directory sync, publishResource can reject admission and leave resource/ledger pending. The save still returns succeeded with provenance_pending and requests fact_publish_failed recovery. If admitted render publication itself rejects, the best-effort handler requests projection_failed without revoking admission or rolling back replacement. The publisher closes failed recipients for reconnect; valid recovery enters the same store invalidation. A missing renderer yields projection_unavailable. If both projection and recovery are missed, reconnect hydration is the remaining route; neither complete provenance nor successful send proves visible freshness. Existing tests assert these paths, not rerun.

Additional limits: after-rename identity/sync failure yields outcome_unknown/non-retry-safe and no resource success fact. Malformed context is sanitized before request validation and cannot deny an otherwise valid save. Same-workspace reconnect preserves dirty cached File content; targeted projections delete/refetch it without that guard. These distinct paths are stated explicitly rather than inheriting older proposed conflict-buffer semantics.

## Test assertions inspected, not executed

| File | Selected assertion bodies |
|---|---|
| server test/ws/file-save-route.test.js | 299 production controller composition; 351 context; 380 malformed/oversized/stale context; 231 stale pair |
| server test/resources/save-controller.test.js | 562 command admission pending; 569 resource publication failure; 587 absent renderer; 638 unsupported preimage; 709 pre/post rename; 740 DB outage; 978 checkpoint warning |
| server test/resources/path-authority-and-atomic-writer.test.js | 84 target classes; 98 single rename; 117 conflict; 269 directory sync uncertainty |
| server test/resources/reconciliation.test.js | 77 reopen and no replacement replay; prepared attempted remains unknown even matching intended bytes |
| server test/resources/reported-ui-context.test.js | 138 durable operation/fact binding replay; 186 mismatching workspace omission |
| server test/resources/file-provenance-integration.test.js | 45 in-root alias through save/admission/ledger/query and canonical path |
| server test/subscriptions/resource-render-projection-handler.test.js | 128 publication failure recovery and retry |
| server test/ws/resource-projection-publisher.test.js | recipient epoch, queue ordering, stale deferred validation and send-close assertions |
| client e2e/file-save-protocol-source.spec.ts | dirty-revision acknowledgment and 284 reconnect preservation assertions |
| client e2e/agent-resource-projection-source.spec.ts | 56 strict union, 80 dedupe/conflict, 104 targeted refetch, 141 stale/malformed |
| client e2e/provenance/file-viewer-live-resource.spec.ts | 282 external fixture socket → ordinary File rendering; 496 injected publication failure → recovery then visible text. Historical integration evidence only; not a File editor UI gesture and not rerun. |

## Negative searches and evidence limits

Exact commands/results are retained in S03-SOURCE-EVIDENCE.json. The bounded `saveFile\(|queryResourceProvenance|readSaveActionContext` search covers client src, finding production Office/Email/acknowledgment callers and query helper definition only. `readSnapshotBytes|file\.version|restoreOfVersionId|resource:invalidate|recoveryRemote|conflict_pending|uiActionSeed|PreparedCanonicalCandidate` covers server lib and client src; the internal snapshot reader is not a public restore API. Registration and callback ownership were additionally read. This supports the named absence claims only, not an audit of every possible source string or external plugin.

No source/test drift from S00 was found for overlapping inspected files; branch/remote/tag refs are unchanged. The dirty worktree and untracked external changes are preserved. Read-only discovery misses (guessed file-read-route.js, earlier path-policy/atomic-write/resource-provenance-query/builtin-seeds/consumer filenames) were corrected by rg inventory; none became page pointers or successful-check claims. The first evidence-script run failed on guessed file-read-route.js before producing evidence; the corrected inventory is the passing run. No dependency installation occurred.

## Bounded earlier-page integration

The exact optional-context sentences in the S02 Provenance Model and UEB standard now distinguish malformed/oversized fields and workspace-echo mismatch from arbitrary stale tab IDs. Source owner: client save-action-context.ts:49–104 and server reported-ui-context.js:88–153. The reader checks a matching connected owner; the server cannot verify current tab existence. No wider S02 behavior changed. The seven-page manifest/check covers these corrections, with S02 source/decision evidence reused elsewhere. S03-D02 records the authorization and downstream invalidation; only the earlier statements and their byte identities are superseded.
