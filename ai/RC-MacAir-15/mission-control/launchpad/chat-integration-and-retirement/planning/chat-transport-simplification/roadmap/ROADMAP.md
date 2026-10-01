# Chat transport simplification — executable roadmap candidate

## Identity and authority

Planning `CHAT-SIMPLE-ROADMAP-001`, revision 1. Candidate status: authored for independent review; no implementation approval. Exact normative bytes are identified by [CANDIDATE.json](CANDIDATE.json). This roadmap incorporates [CONTRACTS](CONTRACTS.md), [ownership and verification](OWNERSHIP-AND-VERIFICATION.md), and [source fingerprints](SOURCES.json). Mutable coordination and review reports are evidence, not normative requirements.

Owner authority: [D-004](../../../DECISIONS.md#d-004--keep-the-next-planning-effort-to-three-simple-spec-candidates) names three outcomes; [D-005](../../../DECISIONS.md#d-005--park-comprehensive-fusionopencode-failure-state-work-in-a-later-task) parks the broad failure map; [D-003](../../../DECISIONS.md#d-003--waive-the-historical-soak-for-successor-work) waives the historical soak; [D-007](../../../DECISIONS.md#d-007--authorize-roadmap-creation-from-the-reviewed-draft) authorizes candidate creation/review only. [Accepted shaping](../FIRST-DRAFT.md) and [Roadmap preparation](../ROADMAP-PREP.md) establish input scope, not executable approval. Existing CHAT-AR SPEC-06 acceptance is retained.

Memory home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`. Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Planning source checkout: `/Users/rccurtrightjr./projects/fs-dev`, dirty `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Neither commit nor source fingerprints certify a build. Implementation must establish its exact checkout and current source baseline before edits.

## Ordered SPECs and release conditions

| Order / stable draft IDs | Executable packet | Producer output / consumer release condition |
| --- | --- | --- |
| 1 / C1-A, C1-B | [CHAT-SIMPLE-01 — focused transport owners](SPEC-01.md) | Cohesive server ingress and client lifecycle/response owners, public-route parity and docs. C1-A precedes C1-B with a passing smoke checkpoint. Release C2 only after whole SPEC integration/review and explicit owner acceptance. |
| 2 / C2-A | [CHAT-SIMPLE-02 — unified chat send](SPEC-02.md) | One private client boundary with truthful local outcomes, completed finite caller migration and removed bypasses. Release C3 only after integration/review and explicit owner acceptance. |
| 3 / C3-A | [CHAT-SIMPLE-03 — receipt inquiry result](SPEC-03.md) | Existing receipt recovery consumes local outcomes without false waiting or prompt replay; bounded correlation correction and affected checks. Final owner acceptance completes this sequence, not deferred work. |

The chosen C1 → C2 → C3 order reduces rework. C3 is technically independently fixable, but this approved-candidate route consumes C2's result contract. Implementation dependency is therefore explicit. Shared client entry/transport/caller and Wiki files make simultaneous slice or SPEC writes unsafe. Independent reading may overlap; implementation and shared documentation writes run in this order with one named writer. No cycle, branch of optional SPECs or fourth SPEC is introduced.

## Coverage and decisions

| Requirement / original question | Proposed coverage | Disposition and evidence |
| --- | --- | --- |
| D-004 two god files / I-011 | C1-A and C1-B ownership inventory, eliminated inline responsibilities, preserved public behavior | Proposed coverage; not delivered. Module seams are implementation choices under standards. |
| D-004 unified chat command sends / R1, R2 | C2-A result contract and complete bounded caller inventory | Technical choices settled in CONTRACTS and ownership table; independent validation pending. One existing user-text route remains. |
| D-004 ignored false / R3 / concrete part of I-009 | C3-A inquiry state table, queued settlement, timeout/late response tests | Proposed targeted fix. Incident cause and broad recovery remain deferred. |
| R4 / I-001, I-004 | SOURCES plus per-slice current-byte baseline, deferral checks, final evidence manifest | Planning source identified; implementation/build baseline is mandatory future completion evidence. |
| I-003 affected verification | Exact commands and public-path scenarios in ownership/verification | Required later checks; none executed by planning. |
| User preferences, all routed standards | CONTRACTS guidance map and execution packets | Maintained sources constrain every SPEC; no invented exemption or supersession. |
| D-003 soak | Focused parity/fault/readback checks | 45-minute historical soak waived and historically unperformed; future logging not treated as an equivalent test. |

Issue lifecycle within this candidate: R1/R2/R3/R4 are `propagated_pending_review` as technical contracts; the stage validator determines whether they are validated. There is no `awaiting_owner` product question in this authored packet. Module naming and implementation details can vary only while satisfying the explicit responsibility and behavioral contracts; record deviations. A proposal to change provider retry/resend/cancellation, published consumer behavior or a deferral tradeoff is outside this candidate and returns through the supervisor to the owner.

Authority classification: D-003–D-007 are `owner_decision`; current Wiki/preferences/standards are `source_of_truth_contract`; current queue activation order, caught-send limitations and route inventories are `active_code_constraint`; cohesive module choices, rich local result representation and bounded correlation bookkeeping are `implementation_choice`. The three executable SPECs become `spec_contract` only after explicit exact-candidate approval. Prior advisor recommendations do not create authority.

## Deferred scope and holds

| Deferred item / resolver | Trigger and consumers | Viability evidence / hold / eventual release |
| --- | --- | --- |
| D-005, I-007/I-008/I-009 comprehensive Fusion/OpenCode send/execution/retry/UI mismatch map, provider_failed readback, accepted-no-exchange hydration and liveness UX; Chat domain and owner-resumed [parked task](codex://threads/01a0ea32-f152-77a2-afc2-b73e8976685a) | After these three SPECs are built and owner accepted; current/future Chat and plugin/view consumers | Receipts, runtime dispatch, adapters, presentation and recovery remain separately owned; wire identity/schema, acceptance and no-replay remain intact. No new external recovery API is published. Hold affected implementation if it erases uncertainty/correlation, relocates provider policy into transport, or freezes a defect into a consumer contract; repair within scope or obtain owner tradeoff. Later consumer release requires the deferred task's resolved contracts and affected verification, not this sequence alone. |
| Temporary `temp_chat_boundary_v1` / `TEMP CHAT-AR I-007`; health/observability domain | Governed content-free subscriber implementation; diagnostic and retained-health consumers | Preserve content-free fields, best-effort execution and explicit delete/migrate annotation through extraction. No second sink, new logger, retention schema or subscription is added. Remove or migrate under that later assigned health work; a permanent/broader sink would require separate scope. |
| I-002/I-005/I-006 broader retirement/Side Chat gaps; existing Chat owners | Their separate bounded work and any directly dependent consumer release | No compatibility-host, Side Chat control, exact-link focus or pending-New-Chat redesign here. Preserve existing routes without declaring those mismatches approved. Hold any new consumer that requires the unresolved behavior. |
| I-010 memory/logger/database attribution; health/Chat diagnosis owners | Owner resumes incident diagnosis or a measured regression requires it | No DB mutation, sampler change or causal claim. Existing diagnostic sampling/Working timers are preserved. A reproduced regression introduced by these changes is repaired under the responsible slice; prior unexplained freezes remain open. |

Deferral safety is a bounded structural inference. Every slice must prove preserved seams on actual implementation bytes; unknown runtime cause is not proof of harmlessness. This sequence does not certify stable plugin adoption of accepted-prompt reconstruction or reopen accepted SPEC-06.

## Completion and handoff

Each SPEC independently incorporates CONTRACTS, ownership/verification and SOURCES and is executable through `$mc-orchestrator` only after exact-candidate approval. Alternatively `$mc-roadmap-implementation-supervisor` can consume the owner-approved roadmap; that route also accepts independently prepared approved executable packets and does not require Creator provenance. Neither route is invoked by this document. Latest owner steering: “Hold the SPECs until ready. We will start the Implementation in another task.” Hold this reviewed candidate here; implementation belongs to a separate owner-started task. Do not create or launch that task from planning.

Final roadmap completion requires all four slices, current-byte required checks, removed migrated bypasses, updated Wiki ownership/contracts, per-SPEC independent review, deviation/downstream impact accounting and explicit owner acceptance of each SPEC. The implementation supervisor presents each completed SPEC to the owner and waits for acceptance before the next. Publish no Git/Alpha update without separately applicable owner authorization. Return an evidence manifest naming source/build hashes, commands/results, warnings, residuals and approved deviations; do not promote passing refactor checks into proof that deferred incidents are fixed.

## Author self-check and proposed return

Author: Codex side chat (ephemeral), runtime `/root/candidate_stage/author`, assigned by `/root/candidate_stage`. Read session, author/shared planning contracts, applicable instructions, current preference/standards router and all eight routed articles, Chat overview/runtime/structure/protocol/actions/testing guidance, draft/preparation/decisions and both current research reports. Actual memory CWD/source checkout and filesystem capabilities were verified separately; source remained read-only. No delegation, product edits, tests, build, app/database operations or Git/Alpha actions occurred.

Self-check covers exactly three ordered SPECs/four slices, complete SEND-01–13 policies and response inventory, exact source/test paths, source freshness, closed result reasons, queue retirement, both recovery watch kinds and races, standards/Wiki ownership, acyclic acceptance gates, safe deferrals, no-replay/provider/Working invariants, normative manifest completeness and local link targets/whitespace. SOURCES records 112 current source/authority/evidence/artifact fingerprints; all 35 intake files and both report source tables matched. Current old build artifacts are observations only; each implementation slice must obtain fresh certification.

The native smoke's live-file restore hazard is addressed as explicit C1-B verification-harness work before any run. C2/C3 extend its safe isolated fixture for their public-route evidence and keep tests modular. This is mechanically necessary verification integration within the four slices. R1–R4 are resolved into authored requirements pending independent validation; no owner question is inferred. Local target checks initially identified only the not-yet-created manifest link; final manifest creation/check and link recheck close that expected authoring dependency. Anchor targets are not claimed independently audited.

Proposed author return is `CANDIDATE_AUTHORED` after manifest check, never approval or independent verdict. The stage runs fresh candidate validation; the supervisor later runs separate fresh release validation and requests exact-candidate owner approval. Hold the SPECs here for the separate owner-started implementation task.
