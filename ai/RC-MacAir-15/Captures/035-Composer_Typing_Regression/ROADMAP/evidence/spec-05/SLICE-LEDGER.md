# SPEC-05 slice ledger

Authority: CHAT-AR-4641ca5897f0; supervisor records owner instruction “Begin SPEC 5.” Explicit acceptance supersedes old owner_review label in SPEC-04 review. Shared dirty checkout on agent/exact-workspace-paths, HEAD 88637d11c65be53d4f2ad0f049f64a07fa3db1de. Initial source/status snapshots are adjacent.

| Slice | Scope | Prerequisite | Criteria/checks | Builder/reviewers | Revision | Deviations/impact | State |
|---|---|---|---|---|---|---|---|
| 05A | Session lifecycle/group transaction | Accepted 04 | SPEC-05 05A; focused V-BACKEND, V-SUBMIT, lifecycle/activation/public-route suites | /root/builder05a; builder reviewer /root/builder05a/review05a CLEAN; /root/review05a_acceptance CLEAN | 05A/SOURCE-SHA256.txt | D1–D6 accepted;05D provider-exit ownership repair requires affected revalidation | accepted; current05D revalidation CLEAN |
| 05B | Mirror/deletion recovery | Clean 05A | SPEC-05 05B; R8 and four focused suites | /root/builder05b; /root/builder05b/review05b CLEAN; /root/review05b_acceptance CLEAN | 05B/SOURCE-SHA256.txt | B1/B2/B4/B5 accepted; B3/B6 downstream | accepted |
| 05C | Activation/turn-drain orchestration | Clean 05B | SPEC-05 05C; R7/R8, runtime/automation/canonical suites, V-SUBMIT | /root/builder05c; /root/builder05c/review05c CLEAN; /root/review05c_acceptance CLEAN | 05C/SOURCE-SHA256.txt | C1/C3–C7 accepted; C2 downstream;05D Stop ACK repair requires affected revalidation | accepted; current05D revalidation CLEAN |
| 05D | Facade/integrated backend/docs | Clean 05C | Full backend/submit/actions/build/server, architecture, UI flows | /root/builder05d READY; /review05d_waiter CLEAN; /root/review05d_acceptance_3 CLEAN |05D/SOURCE-SHA256.txt (5fe53370...)|D01–D18 classified; D07/D12/D16 downstream|accepted; D18 revalidated|

One slice writer at a time. Product edits belong to builders. Read-only independent reviews follow each builder clean gate. No close_agent tool is exposed; terminal lifecycle will be recorded. No live profiles/databases, port 3001, owner-window operations, commit/push, Alpha operations, destructive migration or SPEC-06 work authorized.

Lifecycle: /root/builder05a terminal READY_FOR_ORCHESTRATOR_REVIEW; its /review05a terminal CLEAN. close_agent is unavailable. New direct child /root/review05a_acceptance is read-only, so no conflicting writer remains.

Lifecycle: /root/review05a_acceptance terminal CLEAN; no closure API available. No active writer remains before 05B dispatch.

Lifecycle: /root/builder05b terminal READY_FOR_ORCHESTRATOR_REVIEW; /root/builder05b/review05b terminal CLEAN. close_agent unavailable. Root read-only /root/review05b_acceptance CLEAN; no conflicting writer/workload.

Lifecycle: /root/review05b_acceptance terminal CLEAN; close_agent unavailable.05B accepted; all prior writers/reviewers terminal before05C dispatch.

Lifecycle: /root/builder05c terminal READY_FOR_ORCHESTRATOR_REVIEW; /root/builder05c/review05c terminal CLEAN. close_agent unavailable. Fresh root acceptance /root/review05c_acceptance CLEAN read-only, no writer/workload.

Lifecycle: /root/review05c_acceptance terminal CLEAN. All prior writers/reviewers terminal before05D dispatch; close_agent unavailable.

Lifecycle: /root/builder05d terminal renewed READY on76-file f079fcdabb0aed5ba157064c3444dd25788f80337193044b67b4908b7a0aba5b. Children review05d terminal material finding, review05d_2 CLEAN after repair, review05d_docs CLEAN bounded correction, review05d_consistency CLEAN full affected documentation sweep. Root independently inspected/checks current bytes; fresh /root/review05d_acceptance dispatched read-only with neutral packet/raw evidence. No active writer or workload; all prior direct children terminal. close_agent unavailable.

Lifecycle: /root/review05d_acceptance terminal NOT CLEAN, one validated high retained-drain late-exit finding. Reproduction and raw outcome in05D/ORCHESTRATOR-REVIEW-01.md/.cjs. Root reopened D09 and affected05A/C/D gates; /root/builder05d resumed as sole writer for bounded repair. All prior reviewers terminal; close_agent unavailable. No root workload; source can now change under builder ownership.

Lifecycle: /root/builder05d terminal renewed READY on77-file2e0f359712e6e8e3a5861648d73b4ac47510887948ff319dd17bb908e36b0597; child /review05d_recovery terminal CLEAN on current bytes. Root independently reran original failure with recovery assertions and UI/runtime25suites/544tests, all passed,1606dependencies match. All direct previous reviewers and builders terminal; no workload or conflicting writer. close_agent unavailable. Fresh root05D acceptance may now be dispatched with neutral current packet.

Lifecycle: /root/review05d_acceptance_2 terminal CLEAN, no material findings, read-only/no workloads/descendants. Root accepted05D and affected05A/C current revalidation; all deviations classified. All slices accepted before final SPEC integration commands. close_agent unavailable.

Final integration dispatch lifecycle: all direct slice builders/acceptance reviewers terminal; full postacceptance backend/submission/actions/build/nativepretestserver gates exited0 sequentially, no workload remains. Raw audit confirms current source and cleanup. Fresh final reviewer may start; close_agent unavailable.

Lifecycle: /root/review05_final_integration terminal REPAIR_REQUIRED, one material evented-provider waiter leak validated independently by root. No other material findings. Original final runs retained. Responsible /root/builder05d may resume as sole writer for bounded helper cleanup; all reviewers terminal/no workload. close_agent unavailable.

D18 lifecycle: builder05d renewed READY on78-file5fe53370..., fresh builder reviewer /root/builder05d/review05d_waiter terminal CLEAN, no material findings/additional advisories. No source mutation/workload; root independent original-trigger and26suite550test runtime checks passed,1607dependencies match. All reviewers terminal; no conflicting writer. close_agent unavailable. Dispatch fresh affected05D acceptance reviewer next.

Lifecycle: /root/review05d_acceptance_3 terminal CLEAN, root reaccepted05D/affected05A/C; no unresolved material finding. All direct children terminal and no workload before final second-pass gates. close_agent unavailable.

Final integration02 dispatch: all direct builders/acceptance reviewers terminal; five current post-D18-reacceptance gates passed sequentially, raw source/cleanup audit clean. No workload or writer remains. Fresh final reviewer next; close_agent unavailable.

Final lifecycle: /root/review05_final_integration_2 terminal CLEAN on105-fileda6ecbff...; no material findings/new advisories, read-only/no workload/descendants. First clean ends final gate. All slices and required final execution/review gates complete; no active writer/workload remains. close_agent unavailable. Root handoff SPEC_READY_FOR_SUPERVISOR_REVIEW; no owner acceptance or06 authorization.
