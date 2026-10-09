--- todo.md preimage
+++ todo.md current
@@ -17,7 +17,7 @@
 
 Each task should return its decisions, changed files, checks, unresolved issues and exact next action. Record its chat ID and result here when assigned/completed. Do not mark a task complete merely because a draft or proposal exists. For a profile task, distinguish guidance drafted, profile installed and behavior exercised.
 
-Established requirements: MC coordinates rather than authors roadmaps or searches deeply; continuity lives in files; unspecified intent is surfaced by both creator and reviewer; integration timing/grouping is deliberate. D-023 defines the explicit Mission Control role, shared Status/Monitor and cycle ends; D-021 retains same-folder Review and Merge dispatch; owner approval remains required before commit/push. Future roadmap identities and unadopted detailed workflow choices remain separate decisions.
+Established requirements: MC coordinates rather than authors roadmaps or searches deeply; continuity lives in files; unspecified intent is surfaced by both creator and reviewer; integration timing/grouping is deliberate. D-023 defines the explicit Mission Control role, shared Status/Monitor and cycle ends; D-021/D-024 retain same-folder Commit Supervisor dispatch; owner approval remains required before commit/push. Future roadmap identities and unadopted detailed workflow choices remain separate decisions.
 
 ## Ordered TODO list
 
@@ -98,9 +98,11 @@
 
 ### MC-T09 — Build the Commit Supervisor
 
+- **Current S5 state:** installed; isolated rehearsal pending. Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. [Canonical entry/profile and active routes](deployment.md) replace historical `mc-review-and-merge`; [owner assignment](planning/commit-supervisor/execution/approval-receipt.md) authorizes S1–S6 setup/rehearsal. [Current execution evidence](planning/commit-supervisor/execution/S5-builder.md) does not complete MC-T09. S6 owns actual independent role/app/recovery rehearsal and final completion evidence.
+
 - **D-024 planning result:** [SPEC-COMMIT-SUPERVISOR-01](planning/commit-supervisor/SPEC.md) defines the integrated workflow and identifier migration; separate independent worker-handoff, stage and release reviews passed. [Exact candidate/evidence](planning/commit-supervisor/PLANNING.md) is ready for owner assignment. SPEC preparation does not finish this task; implementation and the isolated behavioral rehearsal remain required.
 
-- **D-021/D-023 status:** `mc-review-and-merge` skill/profile and bounded packet/evaluation/approval procedure installed. Commit/push requires owner go-ahead; Mission Control may dispatch preparation after its cycle stops. Behavioral rehearsal below remains unperformed; installation is not whole-task completion.
+- **Historical D-021/D-023 installation:** `mc-review-and-merge` skill/profile and bounded packet/evaluation/approval procedure installed. Commit/push requires owner go-ahead; Mission Control may dispatch preparation after its cycle stops. Behavioral rehearsal below remains unperformed; installation is not whole-task completion.
 - [ ] **Deliver:** profile, MC assignment packet, integration evaluation gate, change/issue report and checkpoint/resume procedure.
 - **Decide:** accepted SPEC grouping, scoped commit ownership, conflict routing, PR-only versus merge outcomes and standing Git authority. Include the path from a missing requirement to MC-T07/06 and prerequisite execution while integration waits.
 - **Done when:** an isolated rehearsal preserves unrelated work, evaluates a combined candidate, records a dependency wait and resumes from its checkpoint. It distinguishes capability landed from consumer adoption and retains notification obligations. No production merge is needed to prove the workflow.
