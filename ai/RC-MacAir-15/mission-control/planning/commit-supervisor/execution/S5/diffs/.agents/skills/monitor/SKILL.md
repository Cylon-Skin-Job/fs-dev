--- .agents/skills/monitor/SKILL.md preimage
+++ .agents/skills/monitor/SKILL.md current
@@ -21,7 +21,7 @@
 
 1. Verify ownership and that this cycle is active. Invoke Status against its previous snapshot and current evidence. Do not duplicate Status's inspection logic here.
 2. For `progress_only`, persist status/check time, report meaningful incremental changes, and leave the same heartbeat enabled. No delta means no invented progress. Status bookkeeping and progress-only reports do not end a cycle.
-3. **Mission Control:** end the whole cycle for any monitored build completion or whenever MC will inform the owner of a next action or perform one. This includes Review and Merge dispatch, recovery, holds/releases and owner questions. Other running tickets remain in the snapshot; they do not keep the cycle enabled.
+3. **Mission Control:** end the whole cycle for any monitored build completion or whenever MC will inform the owner of a next action or perform one. This includes Commit Supervisor dispatch, recovery, holds/releases and owner questions. Other running tickets remain in the snapshot; they do not keep the cycle enabled.
 4. **Roadmap Supervisor:** end the cycle when a child returns a completion packet or needs intervention. Keep monitoring disabled throughout supervisor review, repair routing, owner checkpoint and next-step selection. Resume a new cycle only after an authorized child dispatch/resumption is acknowledged. A running child still in its own review is progress, not supervisor review.
 5. Return status, events and confirmed cycle disposition to the owning role. That role owns checks, decisions, messages and dispatch. Do not restart an owner wait, recover a child from elapsed time or treat observations as approval.
 
