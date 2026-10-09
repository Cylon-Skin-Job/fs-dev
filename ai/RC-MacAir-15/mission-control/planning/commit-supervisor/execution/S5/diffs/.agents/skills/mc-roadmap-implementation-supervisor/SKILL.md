--- .agents/skills/mc-roadmap-implementation-supervisor/SKILL.md preimage
+++ .agents/skills/mc-roadmap-implementation-supervisor/SKILL.md current
@@ -164,7 +164,7 @@
 
 Report the roadmap ledger, owner acceptance receipts, orchestrator and revision identities, evidence paths, accumulated deviations, cross-SPEC checks, repairs/invalidations, reviewer results, residual risks, and final status.
 
-Use Status to produce the final incremental roadmap report and link all evidence. Leave monitoring paused with the `roadmap_complete` end reason. Return completion to Mission Control/owner; an eligible Review and Merge handoff belongs to the selected Mission Control task after its own cycle stops. Do not leave a completed-roadmap heartbeat enabled.
+Use Status to produce the final incremental roadmap report and link all evidence. Leave monitoring paused with the `roadmap_complete` end reason. Return completion to Mission Control/owner; an eligible Commit Supervisor handoff belongs to the selected Mission Control task after its own cycle stops. Do not leave a completed-roadmap heartbeat enabled.
 
 ## Local session contract
 
