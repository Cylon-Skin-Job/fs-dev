# S04 source and decision evidence

Candidate `PW01-f24d5cd427b9ca14`; source inspected 2026-09-19, development HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Exact 61 file SHA-256 values and source/test/authority line anchors are in S04-SOURCE-EVIDENCE.json. Overlapping S00 source hashes are unchanged. Reuse S02 admission/schema/ledger evidence and S03 save-context, projection and real consumer evidence where source identities remain valid. This slice does not certify whole modules, the app runtime, native addon availability, live databases or Alpha.

## Page and acceptance mapping

| Page | Claims/status | Authority and acceptance |
|---|---|---|
| Chat Metadata Provenance Schema | Full exchange versus normalized overlay; clocks, disclosure and immutable identity; transactional binding; current. Wider envelopes/causal/output policy proposal/open. | C1/C2 below; ATP-D15–17; BRIDGE-02 accepted conformance, PW-D01/02/06/07; AC05/06/09/10 |
| Tool Call Provenance Schema | Configured terminal ingress, capture/extraction, fact, native observation and checkpoints; current. General tool/native/output/versioning proposals remain distinct. | C2–C4; raw accepted ATP-D01–17, especially narrow D15–17; AC05/09/10 |
| Assistant Query And Review Loops | Ledger/query/consumer/recovery chain; current transport, absent production audit consumer. Future review goals and open features. | C5/C6; ATP-D09–17, BRG-D01/03/06/08–10 and later approval receipt; PW-D05–07; AC05/06/07 within S04/09/10 |

Raw Capture 024 DECISIONS ATP-D15–17 authorize only normalized activity/fingerprints, exact bounded checkpoint storage and two admitted ledger facts. They do not approve broad chat.tool/nativeRefs/captured-output/restore/retention contracts. Capture 024 accepted receipt in S00 authority matrix is reused; no historical test result is relabeled fresh. Bridge DECISIONS and RELEASE-MANIFEST were reread: later 2026-09-13 explicit BRIDGE-02 approval supersedes the stale pending headings and the earlier zero-code premise. Current Chat overview and shared view page were read without editing. Current owner guidance and scope supersede historical plan-only headings.

## C1 — Full Chat storage and disclosure

`audit/audit-subscriber.js:31–48,167–248` derives binding authority, keys pending metadata by workspace/root/epoch/thread/turn, aggregates metadata and passes complete parts to `HistoryFile.addExchange`. `HistoryFile.js:79–121` serializes `{parts}` and metadata in the exchange transaction and adds a bind job in that same transaction. Therefore Chat can retain arguments/results even though the public provenance query returns bounded metadata only. No universal redaction or raw-data absence claim is made. Existing exchange storage is not conditioned on the older draft accepted-reference machinery.

`exchange-bind-repository.js:17–43,72–164` verifies saved session/time, one matching complete version-1 terminal tool part, activity set and every available fingerprint; duplicate, incomplete, mismatched or differently bound detail conflicts. Missing hashes are skipped. Binder changes nullable exchange binding/clocks after commit. `exchange-binder.js:6–9,68–99` and its start/drain/shutdown owners provide concurrency-one, 100-job batches, one-second startup and one delayed retry/suppression. Migration 036's exchange deletion handling is reused from accepted S01 evidence: nullable ID/save/bound clocks clear and jobs cascade, checkpoints remain. No historical exchange rescan is implied.

## C2 — Ingress, clocks, identity and interruption

`harness/opencode/index.js:165–299` handles configured JSON ingress and translator outputs. `json-event-translator.js:158–176,192–280` captures host receipt, accepts own bounded callID/tool identity and completed/error status, and separately records reported provider clocks; invalid identity/status takes legacy fail-open Chat translation. `canonical-harness-event-bridge.js:563–685` carries OpenCode fields and immutable route lifecycle; `canonical-chat-event-applier.js:195–322` fences the current turn, computes result-phase Settings transformation before fingerprint/reservation, then expands call/arguments/result once. Later tools/text remain valid. `turn-authority.js:26–51` pins canonical root/hash/device/inode at accepted prompt. The indexed tool status is not Chat exit/error-display normalization.

`activity-owner.js:9–10,46–88,161–285 (`createTerminalReservationGate`, `reserve`, `captureTerminalSnapshot`)` owns the two-second cancellation gate, five immediate zero-timeout attempts, fingerprints and atomic terminal reservation. `activity-repository.js:35–65,150–170` constructs closed fact fields and normalizes bounds; source rows own admission/ledger state. `canonical-chat-event-applier.js:24,119–190` disables synthetic incremental provenance by default. Bounded production search for `enableSyntheticIncrementalProvenance` finds only applier declarations/branches (including the legacy module), not an enabling caller. A stopped tool with no reported terminal snapshot need not have a provenance row. `announced-activity-reconciler.js:41–68` recovers persisted announced rows with interrupted status, stored authority/known clocks, null result and empty candidates; it does not invent lost inputs or provider terminal time.

Chat overview establishes current group/session/view/surface distinctions and private trusted-shell authorization; Bridge conformance does not imply universal provenance emission. Preserve session/turn provenance, nullable Legacy view absence and view-owned state. `transport_only` historical assurance is not a claim that sockets are unauthenticated or that human identity is proven.

## C3 — Candidate extraction and facts

`resource-extractor.js:8,219–295 (`extractShellCandidates`, `extractStructuredPath`, `extractOpenCodeCandidates`)` plus its parser/classifier functions restrict structured read/write/edit and bash literal grammar. Unsupported tools, dynamic/ambiguous shell forms, mismatched path fields and result hints can yield missing candidates. `candidate-fingerprints.js:69–137 (`admitCandidatePath`, `retainCandidates`)` performs lexical root-relative normalization and fingerprinting, access-tuple deduplication, retain-64/detect-65 saturation. Rejected raw candidates are not stored by the normalized edge writer, but full Chat argument storage is separate. Invalid/over-bound shell input emits fixed diagnostics, zero candidates and false truncation. No completeness/causation claim follows.

`fact-authority-repository.js:11–32,101–207` verifies exact source/hash, privately reserves publication and commits admission; accepted S02 `subscriptions/admission.js`/bootstrap/locked schema inspection still applies. `startup.js:323–469` wires the singleton activity owner, admitted source callbacks, observation scheduling and ledger owners before routes. Admission is distinct from successful downstream storage/delivery.

## C4 — Observation and checkpoint scenarios

`resource-observer.js:131–143,156–350` acquires shared save-priority path coordination; unavailable addon closes as secure_open_unavailable before root lookup, otherwise root digest and pinned device/inode travel into native observation. `native/secure-file-observer/index.js:7–18,47–94` requires Darwin addon, validates input and offers no pathname fallback. C native descriptor traversal at lines 243–395 uses required flags, pinned root and openat/fstatat checks; symlink/nonregular/too-large/racing outcomes cannot become successful bytes. `checkpoint-repository.js:44–71 (`verifyUtf8Bytes`)` rejects NUL/invalid UTF-8/over-10-MiB input and preserves exact bytes. Current runtime addon load was not tested.

First eligible read/other observation: `checkpoint-repository.js:280–340 (first/changed branch of `applySuccessfulObservation`)` inserts one bytes/absent checkpoint with no invented prior image and a new observation fact; changed state links previous observed snapshot. Repeated unchanged state: `checkpoint-repository.js:253–277` reuse the prior checkpoint and reserve only a renderer job, no new observation fact/blob. Absent state retires live identity and has no resource ID. A previous checkpoint is not an immediately preceding tool preimage or causal verdict. Same-path edge dominance and all successful relations' projection jobs are explicit.

`resource-observer.js` scheduler and observation job repository implement four-global/one-per-activity work, 16-disposition batches, three timeout attempts, durable claims and bounded failure/retry/suppression. Lock misses consume no I/O attempt; lease recovery consumes reserved attempts; failed uncommitted bytes are discarded/zeroed. External agents are not intercepted by Fusion's internal coordinator.

## C5 — Ledger, queries and UI absence

`agent-ledger-repository.js:56–107 (`projectionFor`)` maps only exact admitted agent/observation fact JSON to event_log/event_resource_edges with null causation. Tool access roles are extracted evidence. Durable claims/three cycles and source markers support bounded retries; S02 C5 source details remain valid.

`client-message-router.js:451–470` routes both queries; `ws/agent-activity-route.js:103–178 (`handleValidatedQuery`)` and `resource-provenance-route.js:114–196 (`handleValidatedQuery`)` validate envelope/current workspace pair/registry, normalize paths, call repositories and validate bounded replies. `agent-provenance/query-repository.js:57–96,125–250 (`normalizeQuery`, `timing`, `detailRef`, `toolCalls`, `resourceEdges`)` supports subjects, closed selectors, default50/max100 and descending keyset pages; `ledger/resource-provenance-repository.js:209–295` is mediated-save history, default50/max200 with reported-context filters. Agent summaries omit raw arguments/results/bytes/private root authority; detailRef requires nullable exchange binding. `changedOnly` selects exactly changed edges, not first/write/causal truth.

`client/src/lib/ws/resource-provenance-protocol.ts:139–195` pairs pending request/workspace epoch, validates strict responses and exposes helper. `ws-client.ts:245,266,429` retires/handles; workspace handlers also retire. Exact `rg -n 'queryResourceProvenance|agent:activity|resource:provenance' fusion-studio-client/src` output is recorded: only resource helper definition/types/response validation and no agent activity consumer. It supports absence of a mounted production query/audit UI on these routes, not absence of all historical/external tooling. Fixtures/tests are not UI consumers.

## C6 — Renderer freshness and restart

`renderer-projection-authority.js:27–132 (`loadCommittedClaim`, `v2Message`, `deliverClaim`)` requires admitted activity; first/changed needs admitted checkpoint or refresh-required fallback, unchanged uses tool admission; stable dominant-edge projection identity. `startup.js:459–469,694–698` starts bounded recovery before enabling continuations. Binding, admission, observation, ledger and renderer schedulers keep durable jobs/markers, bounded retry/suppression and shutdown ownership rather than historical rescan/unlimited retry.

`file-handlers.ts:275–299` validates v1/v2/recovery; `fileDataStore.ts:383–453` checks epoch/dedupe and targeted cache invalidation/refetch. Current targeted projection has no dirty guard; reconnect preservation at 895–941 does. Existing S03 full FileDocumentPresenter and legacy FileViewer source-to-consumer evidence and hashes are reused; both read the central store, neither proves history UI. Office/Email editor buffers are not directly overwritten by file-viewer projection. No all-view freshness or visual runtime guarantee is claimed.

## Existing tests inspected — not rerun

| Test file under server test/agent-provenance | Inspected assertion/scenario |
|---|---|
| activity-owner.test.js | 54 atomic reserve; 132 synthetic incremental; 268/288/304 bounded failure/cancellation/lifecycle; 520 interruption |
| candidates-and-activity.test.js | 20 lexical rejected metadata; 41 65th candidate; 51 atomicity; 79 interrupted replay; 124 stored authority |
| jobs-and-checkpoints.test.js | 181–220 first/unchanged/changed/absent, no secret in fact, sparse rows and four projection jobs; 368 invalid bytes |
| resource-observer.test.js | 138–191 admission gate, save lock miss and unavailable addon without pathname lookup; 192 root failure cases |
| exchange-bind-and-query.test.js | 26 deletion/binding; 179–235 bounded summaries/cursors/path and invalid/null/unknown selectors; 264 transactional rollback; 273 no historical rescan |
| announced-activity-reconciler.test.js | 50–111 stored authority/known timing with interrupted status and no invented candidates/provider terminal clock |
| exchange-binder.test.js | 22/44 bounded startup; 63/120 delayed retry and suppression; 174 shutdown |
| renderer-projection-runtime.test.js | 51/72 admitted first/changed versus unchanged; 119 fallback/no-recipient; 137 late-settlement fence |

Names and selected assertion bodies were inspected; no product test/build/server/fixture/native/runtime command was run. S02/S03 related assertion evidence remains valid and is also not rerun.

## Self-review, adapters and deviations

Self-review checked each rewritten page against raw source, accepted overlay and immediate S02/S03/Chat boundaries. It removed stale broad accepted-ref/hash-blocker claims, distinguished current terminal capture from synthetic incremental support, explicit no-candidate coverage gaps, disclosure storage versus query, required bind transaction versus capture fail-open, and targeted versus reconnect dirty behavior. No prior-page repair was needed. Exact preimages/diffs and stable names/navigation are recorded.

S04-D01: frozen V2 requires four legacy relationship lists, but current owner-edited Wiki000 Style/Updating guidance requires removal of those lists and an actual quoted UTC last-modified timestamp. Root confirmed current owner guidance applies. The three pages use the new schema; verifier checks new rules there and permits historical schema on untouched pages. Guidance hashes are recorded among 61 files; actual write times are in the page/manifest. Proposed classification accepted; S06 downstream migration/validation needed. No new product contract or out-of-scope wiki touch.

Evidence authoring and validation scripts exist only under this capture and import no application modules. The only validation adapter is the scoped V2 policy adaptation. Read-only discovery mistakes (guessed State_And_Stores/FileViewer/tabs locations) produced missing-path errors and were corrected by current inventory; no guessed pointer remains. First evidence inventory search used absent src/lib/tabs, exit2; corrected search covers src, exit0. No dependency installation or network evidence was used.

### Evidence-anchor repair during gate preparation

Root integration read found several hand-written ranges extending beyond actual file ends. All human-readable source ranges were systematically checked against the recorded current files; extractor/candidate/query/native/projection ranges were corrected to actual symbol regions, with checkpoint first/unchanged branches separated accurately. Source/wiki bytes and substantive claims did not change. JSON source anchors already recorded actual lines. This capture-only evidence correction is within V5 and does not invalidate page snapshots or source inspection.
