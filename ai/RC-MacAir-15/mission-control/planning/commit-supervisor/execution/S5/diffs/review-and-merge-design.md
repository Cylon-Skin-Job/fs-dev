--- review-and-merge-design.md preimage
+++ review-and-merge-design.md current
@@ -2,6 +2,8 @@
 
 > Current role name: **Commit Supervisor**, under [D-024](decisions.md#d-024--commit-supervisor-and-one-integrated-workflow-spec). Review and Merge below is the historical name used by the original discussion and currently installed identifiers. The executable workflow will be specified in [SPEC-COMMIT-SUPERVISOR-01](planning/commit-supervisor/SPEC.md); writing that SPEC does not install or run it.
 
+Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. S5 cutover now routes entry/profile links below to the canonical [Commit Supervisor](.agents/skills/mc-commit-supervisor/SKILL.md). Historical prose, hierarchy and source fingerprints describe the earlier discussion/installation; they do not claim the retired identifiers remain discoverable. Actual rehearsal remains S6; see [deployment](deployment.md).
+
 Recorded by **Codex side chat (ephemeral)** on 2026-10-03, America/Los_Angeles.
 
 This document captures the owner's direction and the proposed workflow from the side conversation. The owner initially requested implementation, then redirected the task: “Let's just create a thorough markdown file of what we discussed and I will hop back into the main chat.” This is a design handoff. No new profiles, skills, review runs, integration candidates, commits, pushes, app launches or monitoring cycles were created by this task.
@@ -24,7 +26,7 @@
 
 The following sources were inspected during the discussion:
 
-- [Review and Merge skill](.agents/skills/mc-review-and-merge/SKILL.md) and [profile](.codex/agents/mc-review-and-merge.toml): bounded intake, candidate preparation, integration evidence, owner wait before commit/push and publication receipts already exist.
+- [Review and Merge skill](.agents/skills/mc-commit-supervisor/SKILL.md) and [profile](.codex/agents/mc-commit-supervisor.toml): bounded intake, candidate preparation, integration evidence, owner wait before commit/push and publication receipts already exist.
 - [Local configuration](.codex/config.toml): existing local role registrations. This document does not add registrations.
 - [Local instructions](AGENTS.md), [session contract](session-contract.md), and [decisions](decisions.md): D-021 retains the owner publication gate, D-022 establishes independent planning worker-handoff reviews, and D-023 governs Mission Control's role and Status/Monitor cycle boundaries.
 - [SPEC review gate](.agents/skills/mc-spec-review-gate/SKILL.md): useful clean-room principles for material findings, fresh review, repair and preservation of valid evidence. Its approved-SPEC execution scope is distinct from this proposed integration workflow.
