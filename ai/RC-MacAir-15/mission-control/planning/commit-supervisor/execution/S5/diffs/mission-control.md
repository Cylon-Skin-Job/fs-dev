--- mission-control.md preimage
+++ mission-control.md current
@@ -7,7 +7,7 @@
 
 ## Established by the owner
 
-This home's default role is the general-purpose Mission Control Assistant. D-023 establishes one designated Mission Control role explicitly with `$mission-control`. The separate Monitor skill runs hourly Status calls only after authorized activation. MC ends its whole cycle before announcing/performing any next action and on any tracked build completion. Supervisors pause while reviewing/setting next steps and resume after authorized child dispatch; owner acceptance remains required. Separate same-folder Review and Merge tasks prepare eligible integrations and wait for the owner's explicit say-so before commit/push. Other maintenance, scheduling and question tasks remain owner-managed. Installation does not activate these roles or schedules. The owner handles handoff, archival and pinning.
+This home's default role is the general-purpose Mission Control Assistant. D-023 establishes one designated Mission Control role explicitly with `$mission-control`. The separate Monitor skill runs hourly Status calls only after authorized activation. MC ends its whole cycle before announcing/performing any next action and on any tracked build completion. Supervisors pause while reviewing/setting next steps and resume after authorized child dispatch; owner acceptance remains required. Separate same-folder Commit Supervisor tasks prepare eligible integrations and wait for the owner's explicit say-so before commit/push. Other maintenance, scheduling and question tasks remain owner-managed. Installation does not activate these roles or schedules. The owner handles handoff, archival and pinning.
 
 **The current project is Mission Control itself.** We are building its operating guidance, durable records, agent roles, review and integration procedures, status artifact, and eventual monitoring. The three product roadmaps it will later coordinate are future inputs: their subjects, owners and SPECs will be chosen and assigned after Mission Control is ready to receive them. They are not the current build targets and need not be invented to complete this setup.
 
@@ -17,7 +17,7 @@
 
 The three future roadmap identities are deliberately deferred. Earlier assistant proposals for five plugin tracks are background, not an approved structure. Newer chat direction continues to supersede conflicting plugin-folder assumptions.
 
-The owner further specifies that MC decides when completed work warrants an integration assignment, including waiting for additional SPECs where appropriate. A dedicated session handles detailed integration, history, evaluation and its report. The current Mission Control/Review and Merge skills define the bounded packet and owner commit/push gate; D-023 requires MC to stop its cycle before reporting or dispatching completion. Earlier prerequisite-planning proposals remain in [integration-jobs.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md), not automatic build authority.
+The owner further specifies that MC decides when completed work warrants an integration assignment, including waiting for additional SPECs where appropriate. A dedicated session handles detailed integration, history, evaluation and its report. The current Mission Control/Commit Supervisor skills define the bounded packet and owner commit/push gate; D-023 requires MC to stop its cycle before reporting or dispatching completion. Earlier prerequisite-planning proposals remain in [integration-jobs.md](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md), not automatic build authority.
 
 ### Earlier assignment hierarchy — supporting workflow context
 
@@ -30,7 +30,7 @@
     └── Sub Agents
 ```
 
-This earlier hierarchy describes supporting planning/build workflows, not automatic startup roles or authority to launch every branch. D-021/D-023 keep the general assistant default, explicitly establish Mission Control and name the integration task Review and Merge. Roadmap Supervisors and SPEC Orchestrators retain their separately assigned workflow contracts and the current per-SPEC acceptance checkpoint. Earlier test/walkthrough and FFmpeg proposals remain future work.
+This earlier hierarchy describes supporting planning/build workflows, not automatic startup roles or authority to launch every branch. D-021/D-023 keep the general assistant default and explicitly establish Mission Control; D-024 names the integration role Commit Supervisor (historical alias: Review and Merge). Roadmap Supervisors and SPEC Orchestrators retain their separately assigned workflow contracts and the current per-SPEC acceptance checkpoint. Earlier test/walkthrough and FFmpeg proposals remain future work.
 
 ## Ticket sessions and unattended coordination
 
@@ -88,6 +88,6 @@
 
 ## Current phase
 
-The owner is developing this system in managed chats. D-023 establishes the latest split; local Mission Control, Status, Monitor and Review and Merge definitions are installed without activating a monitor, creating its heartbeat or dispatching a review task. The owner plans a fresh pinned Mission Control task after handoff. Actual runtime behavior and turnover still need that deliberate invocation. See [deployment.md](deployment.md) and [handoff.md](handoff.md).
+The owner is developing this system in managed chats. D-023 establishes the latest split; local Mission Control, Status, Monitor and Commit Supervisor definitions are installed without activating a monitor, creating its heartbeat or dispatching a review task. The owner plans a fresh pinned Mission Control task after handoff. Actual runtime behavior and turnover still need that deliberate invocation. See [deployment.md](deployment.md) and [handoff.md](handoff.md).
 
 Earlier setup tasks and completion attributions remain in [todo.md](todo.md) and [registry.md](registry.md). Installing these two roles does not certify the earlier planning, ticket, artifact or behavioral exercises. Full Access is the chosen execution default; per-SPEC owner acceptance and the explicit integration commit/push gate remain.
