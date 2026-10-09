--- review-and-merge-handoff.md preimage
+++ review-and-merge-handoff.md current
@@ -1,6 +1,8 @@
 # Commit Supervisor — structure and creation handoff
 
 > [D-024](decisions.md#d-024--commit-supervisor-and-one-integrated-workflow-spec) renames the top-level role and requests a single executable workflow SPEC. The older Review and Merge wording/identifiers below retain their historical provenance. Use [SPEC-COMMIT-SUPERVISOR-01](planning/commit-supervisor/SPEC.md) for the current implementation candidate after its independent release review; no replacement roles are installed merely by this handoff.
+
+Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. S5 cutover now routes entry/profile links below to the canonical [Commit Supervisor](.agents/skills/mc-commit-supervisor/SKILL.md). Historical prose, hierarchy and source fingerprints describe the earlier discussion/installation; they do not claim the retired identifiers remain discoverable. Actual rehearsal remains S6; see [deployment](deployment.md).
 
 > Owner-directed handoff for a separate, owner-managed setup chat. Recorded by Codex side chat (ephemeral), 2026-10-04T06:00:36Z (2026-10-03 PDT). This document creates no session, monitoring cycle or integration job. No session UUID is asserted.
 
@@ -85,7 +87,7 @@
 
 ## Existing Review and Merge and remaining design
 
-The current [skill](.agents/skills/mc-review-and-merge/SKILL.md) and [thin profile](.codex/agents/mc-review-and-merge.toml) already define bounded intake, preparation, required independent evaluation, owner wait and authorized publication receipts. [MC-T09](todo.md#mc-t09--build-the-branchintegration-agent) remains open for the fuller workflow and isolated rehearsal. Extend those definitions instead of creating a competing Branch Manager authority.
+The current [skill](.agents/skills/mc-commit-supervisor/SKILL.md) and [thin profile](.codex/agents/mc-commit-supervisor.toml) already define bounded intake, preparation, required independent evaluation, owner wait and authorized publication receipts. [MC-T09](todo.md#mc-t09--build-the-commit-supervisor) remains open for the fuller workflow and isolated rehearsal. Extend those definitions instead of creating a competing Branch Manager authority.
 
 Define a concrete assignment/return packet and checkpoint schema: accepted work IDs/SPEC grouping, exact source and target, dirty-input fingerprints, candidate identity/location, baseline history, applicable standards, writer ownership, prerequisite release evidence, actual checks, review findings/dispositions, permitted repairs and exact next action. Keep job reports separate from central monitoring state.
 
@@ -113,7 +115,7 @@
 
 1. Current [AGENTS.md](AGENTS.md), [session contract](session-contract.md), and [D-021/D-022/D-023](decisions.md). Preserve newer scoped owner revisions.
 2. This hierarchy and the [shared planning contract](.agents/skills/mc-roadmap-creator/references/planning-contract.md), especially validation/repair rules; [Planning Validator](.agents/skills/mc-planning-validation/SKILL.md) for handoff thresholds.
-3. Existing Review and Merge skill/profile above, [MC-T09](todo.md#mc-t09--build-the-branchintegration-agent), [assignment templates](record-templates.md), [investigation contract](investigation-contract.md), and [deployment status](deployment.md).
+3. Existing Review and Merge skill/profile above, [MC-T09](todo.md#mc-t09--build-the-commit-supervisor), [assignment templates](record-templates.md), [investigation contract](investigation-contract.md), and [deployment status](deployment.md).
 4. [Mission Control procedure](.agents/skills/mission-control/SKILL.md) for dispatch/cycle boundaries. Consult the existing implementation [supervisor](.agents/skills/mc-roadmap-implementation-supervisor/SKILL.md), [orchestrator](.agents/skills/mc-orchestrator/SKILL.md) and [builder](.agents/skills/mc-spec-slice-builder/SKILL.md) only to verify relevant integration boundaries.
 5. For actual skill/profile edits use the installed Skill Creator guidance. Use [Memory Maintenance](.agents/skills/mc-memory-maintenance/SKILL.md) for record/index changes. Use the [conversation evidence contract](conversation-evidence.md) when a consequential intent claim needs original context; avoid broad product-code research for workflow setup.
 
