--- handoff.md preimage
+++ handoff.md current
@@ -1,6 +1,11 @@
 # Mission Control — Resume here
 
 ## Current state
+
+### S5 — Canonical Commit Supervisor installed; rehearsal pending
+
+Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. [Owner-approved S1–S5 setup](planning/commit-supervisor/execution/approval-receipt.md) installs the sole [mc-commit-supervisor entry](.agents/skills/mc-commit-supervisor/SKILL.md) and subordinate review/repair routes. Historical Review and Merge names below describe earlier events. [Cutover evidence](planning/commit-supervisor/execution/S5/cutover-inventory.json) found no legacy job/writer/schedule needing transfer; no job IDs or intentional waits were renamed/restarted. [S5 report](planning/commit-supervisor/execution/S5-builder.md) is the setup evidence pointer. MC-T09 remains **installed; isolated rehearsal pending**. No operational MC role/timer, integration job, publication, acceptance cursor or Alpha action is created.
+
 
 ### 2026-10-03 — Latest role and cycle revision (D-023)
 
@@ -47,6 +52,8 @@
 ## Next safe action
 
 ### Commit Supervisor SPEC — D-024
+
+Current continuation: the assigned SPEC orchestrator accepts the current S5 packet, then performs approved S6 fixture preparation and isolated agent/runtime/recovery rehearsal. Use [execution ledger](planning/commit-supervisor/execution/slice-ledger.json) for accepted current revisions; setup acceptance does not approve any future integration candidate or Git operation. Earlier planning/creation paragraphs below retain their dates/provenance and no longer select the installed route.
 
 The owner renamed the top-level Review and Merge role **Commit Supervisor** and requested [one integrated workflow SPEC](planning/commit-supervisor/SPEC.md), including appropriate clean-room gates. Its [planning record](planning/commit-supervisor/PLANNING.md) owns candidate identity and independent review status. The installed legacy identifiers remain until implementation. This assignment prepares the SPEC; MC-T09 stays open for workflow installation and isolated rehearsal. Use the reviewed candidate and record an owner implementation assignment before dispatching it. Existing commit/push, per-SPEC acceptance and D-023 cycle rules remain.
 
