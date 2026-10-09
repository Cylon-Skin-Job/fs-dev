--- skills-and-agents.md preimage
+++ skills-and-agents.md current
@@ -7,6 +7,8 @@
 D-015 adds local `mc-preflight` as an inline Launchpad procedure and renames the planned independent final gate to Release Validation. Historical Preflight references below describe that older gate; current definitions and availability are in deployment.md.
 
 D-018 rebuilds the local creator as a Creation Supervisor and adds stage orchestration, candidate authoring and independent planning validation. D-019 adds the standalone Draft Supervisor; current local definitions total sixteen skills/nine profiles; the historical global inventory below remains unchanged. See deployment.md for tested limits.
+
+Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. S5 replaces the discoverable historical `mc-review-and-merge` entry/profile with [mc-commit-supervisor](.agents/skills/mc-commit-supervisor/SKILL.md), registering [initial/final review orchestration](.agents/skills/mc-code-review-orchestrator/SKILL.md) and [bounded leaf repair](.agents/skills/mc-commit-repair-worker/SKILL.md). Current installation is twenty-two local skills/twelve profiles; earlier counts below remain dated inventory. The supervisor owns separate fresh worker/Wiki handoff gates and terminal owner wait; runtime rehearsal remains S6. See [deployment](deployment.md) and [shared workflow](.agents/skills/mc-commit-supervisor/references/workflow.md).
 
 ## Scope and status
 
