# MVP Provenance and Governed Subscriptions — Implementation Ledger

**Supervisor status:** `ACTIVE`
**Approved candidate:** `MVP-PROV-SUB-3b8cb4f1e41df682`
**Approved aggregate SHA-256:** `3b8cb4f1e41df682c56d03dbf39d8337ad318019e127106dce372fcab000f310`
**Target worktree:** `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar`
**Started:** 2026-08-29

This is a non-normative execution record maintained by the Roadmap Implementation Supervisor. It is not part of the approved candidate digest and does not amend the product contract.

## Candidate Authentication

- Manifest approval: verified owner-approved on 2026-08-29.
- Ordered-path hashes: verified against current bytes on 2026-08-29.
- Aggregate digest: verified exact on 2026-08-29.
- Current overlap: no modified product-source path exists under `fusion-studio-server/` or `fusion-studio-client/`; approved planning/standards edits and the manifest-declared runtime/style exclusions remain present and must be preserved.

## Roadmap Ledger

| SPEC | Dependencies | State | Orchestrator | Accepted revision | Evidence/report | Deviations | Downstream impact | Residual risks | Owner acceptance receipt |
|---|---|---|---|---|---|---|---|---|---|
| SPEC-01 Database Registry Authority | Approved bundle | `accepted` | `/root/spec_01_registry` (`SPEC_READY_FOR_SUPERVISOR_REVIEW`) | Uncommitted 27-file aggregate `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356` on `806b33521907ed4b51cf792d5ef664fe319ea349` | `SPEC-01-IMPLEMENTATION-REPORT.md`; final implementation gate `CLEAN`; packet identity gate `CLEAN` | D-01–D-05: `accepted_no_downstream_impact` for this roadmap | SPEC-02/03/04 packets remain valid; future Systems work must model a subtractive locked-filter overlay if needed | Ajv/package-audit maintenance; later-SPEC runtime behavior intentionally absent; live Electron/browser smoke not applicable | Owner response `Accept`, 2026-08-29 |
| SPEC-02 Subscription Controller | SPEC-01 accepted | `accepted` | `/root/spec_02_subscriptions` (`SPEC_READY_FOR_SUPERVISOR_REVIEW`) | Uncommitted 22-file aggregate `06d9e15aba776aa73ce13c62c2dd9d12d78537820668c31dc56d3aa9cdaaa49f` on accepted SPEC-01 baseline | `SPEC-02-IMPLEMENTATION-REPORT.md`; final integration gate `CLEAN` | D-02/D-05: `accepted_update_downstream_packet`; D-01/D-03/D-04/D-06/D-07/D-08: `accepted_no_downstream_impact` | SPEC-03 must atomically replace reject-all verifier/discard-only installer and install durable reservation verification plus exact save-owner publishers; SPEC-04 remains compatible | Production governed path intentionally inert; real wall-clock cron/live Electron-browser not run; temporary staged bootstrap exists until SPEC-03 | Owner response `Okay, I will approve and let's go on to the next spec.`, 2026-08-30 |
| SPEC-03 Mediated File Provenance | SPEC-02 accepted | `accepted` | `/root/spec_03_file_provenance` (`SPEC_READY_FOR_SUPERVISOR_REVIEW`) | Uncommitted 92-file aggregate `bb0fe8420ef0a07f7559432e84715162b4f5737bcbacbb450973e1dfaa28e374` on accepted SPEC-01/SPEC-02 baseline | `SPEC-03-IMPLEMENTATION-REPORT.md`; final integration gate `CLEAN`; supervisor clean-room gate `CLEAN` | D-08: `accepted_update_downstream_packet`; D-01–D-07: `accepted_no_downstream_impact` | SPEC-04 must deliberately remove/replace the single successful-save `file_changed` compatibility broadcast during its epoch-aware projection cutover | Bounded final-rename syscall window; possible omission of non-authoritative post-success compatibility side effects after crash; panel-aware historical queries depend on current filesystem; manual Electron/Alpha smoke not run | Owner response `Accept`, 2026-09-02 |
| SPEC-04 File Viewer Live Render | SPEC-03 accepted | `orchestrating` | `/root/spec_04_live_render` | Accepted SPEC-01, SPEC-02, and SPEC-03 baselines plus SPEC-04 work in progress | `SPEC-04-IMPLEMENTATION-REPORT.md` (expected) | Pending | Pending | Pending | — |

## SPEC-01 Execution Packet

- Approved SPEC: `SPEC-01-DATABASE-REGISTRY.md`
- Shared authority: `SPEC.md`, `ROADMAP.md`, `GUIDANCE.md`, `DECISIONS.md`, `ISSUES.md`, `CODE-INVENTORY.md`, and `RELEASE-MANIFEST.md`
- Code Standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- Routed standards: `001-Architecture_Routing`, `004-WebSocket_Protocol`, `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, and `008-Testing_And_Smoke_Slices`
- Approved standards supersessions: none
- Accepted prerequisite report: none; bundle approval is the prerequisite
- Required minimum checks: `npm test -- --runInBand test/event-registry` and `npm test -- --runInBand test/ledger/event-ledger.test.js` from `fusion-studio-server/`, plus all additional checks required by the SPEC, standards, and validated implementation deviations
- Completion status required from orchestrator: `SPEC_READY_FOR_SUPERVISOR_REVIEW`, `AUTHORITY_BLOCKED`, or `BLOCKED`, with a complete evidence and deviation packet

## Owner Checkpoints

No later SPEC may start until the current SPEC reaches supervisor-clean `owner_review` and the owner explicitly accepts it.

### SPEC-01 Supervisor Checkpoint — 2026-08-29

- Supervisor result: `CLEAN`; state moved to `owner_review`.
- Candidate authority reauthenticated: approved 32-path aggregate unchanged.
- Current implementation identity: 27 unique files, all per-file hashes verified, ordered aggregate `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`.
- Independent supervisor rerun: registry plus legacy-ledger targets, 9 suites and 80 tests passed.
- Orchestrator evidence: registry 77/77, ledger 3/3, full server 749 passed/1 skipped, client build passed, isolated bootstrap 4 schemas/0 subscriptions/0 grants/4 effective schemas.
- Final implementation review: `CLEAN` after locale-determinism repair.
- Corrected packet identity review: `CLEAN`; the earlier unsupported aggregate was removed without changing implementation bytes.
- Deviation decisions: D-01 through D-05 are `accepted_no_downstream_impact` for SPEC-02 through SPEC-04. The D-01 subtractive-overlay note applies only to a future Systems/configuration roadmap.
- Owner acceptance: received as exact response `Accept` on 2026-08-29.

## SPEC-02 Execution Packet

- Approved SPEC: `SPEC-02-SUBSCRIPTION-CONTROLLER.md`
- Accepted prerequisite: SPEC-01 current 27-file aggregate `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`; report `SPEC-01-IMPLEMENTATION-REPORT.md`; owner accepted 2026-08-29.
- Shared authority: `SPEC.md`, `ROADMAP.md`, `GUIDANCE.md`, `DECISIONS.md`, `ISSUES.md`, `CODE-INVENTORY.md`, and `RELEASE-MANIFEST.md`.
- Code Standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`.
- Routed standards: `001-Architecture_Routing`, `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, and `008-Testing_And_Smoke_Slices`.
- Approved standards supersessions: none.
- Completion status required from orchestrator: `SPEC_READY_FOR_SUPERVISOR_REVIEW`, `AUTHORITY_BLOCKED`, or `BLOCKED`, with a complete evidence and deviation packet.

### SPEC-02 Supervisor Checkpoint — 2026-08-30

- Supervisor result: `CLEAN`; state moved to `owner_review`.
- Approved candidate and accepted SPEC-01 prerequisite reauthenticated.
- Current SPEC-02 identity: 22 unique files; all per-file hashes verified; ordered aggregate `06d9e15aba776aa73ce13c62c2dd9d12d78537820668c31dc56d3aa9cdaaa49f`.
- Independent supervisor rerun: subscriptions plus watcher/TRIGGERS targets, 8 suites and 76 tests passed.
- Orchestrator evidence: subscriptions 69/69; watcher/TRIGGERS 7/7; full server 824 passed/1 skipped; client build passed; isolated startup sealed with zero active subscriptions and clean stop.
- Final integration review: `CLEAN` on current bytes.
- Deviation decisions: D-02 and D-05 are `accepted_update_downstream_packet`; all others are `accepted_no_downstream_impact`.
- Required SPEC-03 packet correction: replace `staged-bootstrap.js` reject-all reservation verifier and discard-only publisher installer atomically with the durable reservation repository, exact file-save-owner publisher injection, ledger handler/provider, locked subscription, and exact grants. Preserve opaque full-input reservation binding and expose no publisher/minter.
- SPEC-04 packet: no correction required; its narrow publisher owns recipient-session resolution and final `workspaceEpoch` injection.
- Owner acceptance: received as exact response `Okay, I will approve and let's go on to the next spec.` on 2026-08-30.

## SPEC-03 Execution Packet

- Approved SPEC: `SPEC-03-MEDIATED-FILE-PROVENANCE.md`.
- Accepted prerequisites: SPEC-01 aggregate `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`; SPEC-02 aggregate `06d9e15aba776aa73ce13c62c2dd9d12d78537820668c31dc56d3aa9cdaaa49f`; both owner accepted.
- Required accepted reports: `SPEC-01-IMPLEMENTATION-REPORT.md` and `SPEC-02-IMPLEMENTATION-REPORT.md`.
- Shared authority: `SPEC.md`, `ROADMAP.md`, `GUIDANCE.md`, `DECISIONS.md`, `ISSUES.md`, `CODE-INVENTORY.md`, and `RELEASE-MANIFEST.md`.
- Code Standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`.
- Routed standards: `001-Architecture_Routing`, `003-State_Management`, `004-WebSocket_Protocol`, `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, and `008-Testing_And_Smoke_Slices`.
- Approved standards supersessions: none.
- Mandatory downstream correction from SPEC-02: atomically replace the reject-all reservation verifier and discard-only publisher installer with the durable reservation repository, exact file-save-owner publisher injection, provenance-ledger handler/provider, locked subscription, and exact grants. Preserve opaque full-input reservation binding and expose no publisher/minter.
- Completion status required from orchestrator: `SPEC_READY_FOR_SUPERVISOR_REVIEW`, `AUTHORITY_BLOCKED`, or `BLOCKED`, with a complete evidence and deviation packet.

### SPEC-03 Supervisor Checkpoint — 2026-09-02

- Supervisor result: `CLEAN`; state moved to `owner_review`.
- Approved candidate and accepted SPEC-01/SPEC-02 prerequisites reauthenticated against current bytes.
- Current SPEC-03 identity: 92 unique files; all per-file hashes verified; ordered aggregate `bb0fe8420ef0a07f7559432e84715162b4f5737bcbacbb450973e1dfaa28e374`.
- Independent supervisor reruns: required resources/ledger/WebSocket gate, 24 suites and 200 tests passed; client source protocol gate, 26 tests passed; `git diff --check` passed.
- Orchestrator evidence: full server 996 passed/1 existing skip; client production build passed; isolated startup exposed six schemas, one configured and active provenance subscription, both protocol routes, and a clean stop.
- Final orchestrator integration review: `CLEAN` after repair of the segment-prefix containment defect found by its first final gate.
- Fresh supervisor-owned clean-room review: `CLEAN`; 11 focused suites and 130 tests passed; no material correctness, security, protocol, persistence, lifecycle, scope, or reporting finding.
- Staging removal verified: both `staged-bootstrap` files are absent, retired reject-all/discard-only symbols have zero active references, and public Universal Event Bus exports remain only `bus`, `emit`, and `on`.
- Deviation decisions: D-01 through D-07 are `accepted_no_downstream_impact`; D-08 is `accepted_update_downstream_packet` because SPEC-04 must deliberately remove/replace the single successful-save `file_changed` compatibility broadcast during its projection cutover.
- Residuals accepted as non-blocking: bounded final-rename syscall window under Node's standard filesystem API; possible omission of non-authoritative checkpoint/legacy notification after durable success and crash; panel-aware historical queries depend on current filesystem; manual Electron and Alpha smoke were not run for this nonvisual SPEC.
- Owner acceptance: received as exact response `Accept` on 2026-09-02.

## SPEC-04 Execution Packet

- Approved SPEC: `SPEC-04-FILE-VIEWER-LIVE-RENDER.md`.
- Accepted prerequisites: SPEC-01 aggregate `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`; SPEC-02 aggregate `06d9e15aba776aa73ce13c62c2dd9d12d78537820668c31dc56d3aa9cdaaa49f`; SPEC-03 aggregate `bb0fe8420ef0a07f7559432e84715162b4f5737bcbacbb450973e1dfaa28e374`; all owner accepted.
- Required accepted reports: `SPEC-01-IMPLEMENTATION-REPORT.md`, `SPEC-02-IMPLEMENTATION-REPORT.md`, and `SPEC-03-IMPLEMENTATION-REPORT.md`.
- Shared authority: `SPEC.md`, `ROADMAP.md`, `GUIDANCE.md`, `DECISIONS.md`, `ISSUES.md`, `CODE-INVENTORY.md`, and `RELEASE-MANIFEST.md`.
- Code Standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`.
- Routed standards: `001-Architecture_Routing`, `002-Frontend_UI`, `003-State_Management`, `004-WebSocket_Protocol`, `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, and `008-Testing_And_Smoke_Slices`.
- Approved standards supersessions: none.
- Mandatory downstream correction from SPEC-03: during atomic projection activation, deliberately remove/replace the single controller-owned successful-save `file_changed` compatibility broadcast; retain legacy behavior only for non-migrated routes. Preserve the accepted epoch/bind-buffer, durable provenance, canonical File Viewer alias, and capability boundaries.
- Required minimum checks: full server `npm test`; client `npm run build`; guarded isolated runtime `node e2e/provenance/run-file-viewer-live.mjs`; plus all focused checks required by the SPEC, standards, and validated deviations.
- Completion status required from orchestrator: `SPEC_READY_FOR_SUPERVISOR_REVIEW`, `AUTHORITY_BLOCKED`, or `BLOCKED`, with a complete evidence and deviation packet.
