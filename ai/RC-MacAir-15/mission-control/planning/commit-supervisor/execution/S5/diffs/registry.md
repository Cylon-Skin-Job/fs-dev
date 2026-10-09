--- registry.md preimage
+++ registry.md current
@@ -9,7 +9,7 @@
 
 This Markdown file is the compact current-state index for Mission Control. It is not the source of product requirements, ticket text, SPEC evidence or owner decisions. Each row links to the source that owns those facts.
 
-The owner manages ordinary setup/maintenance chats; the assigned chat records outcomes within its scope after checking for concurrent edits. D-023 keeps this home's default role a general assistant; $mission-control explicitly selects the coordinator. It uses shared Status/Monitor skills. One designated MC task owns central monitoring/dispatch state; supervisors own local cycle records. Review and Merge tasks return job reports without concurrently rewriting that state. Append coordination requiring other sessions to [bulletin.md](bulletin.md). Record durable owner choices in the designated decision source, then link them here.
+The owner manages ordinary setup/maintenance chats; the assigned chat records outcomes within its scope after checking for concurrent edits. D-023 keeps this home's default role a general assistant; $mission-control explicitly selects the coordinator. It uses shared Status/Monitor skills. One designated MC task owns central monitoring/dispatch state; supervisors own local cycle records. Commit Supervisor tasks return job reports without concurrently rewriting that state. Append coordination requiring other sessions to [bulletin.md](bulletin.md). Record durable owner choices in the designated decision source, then link them here.
 
 State means the current assignment/workflow position, not quality, delivery or approval. Keep implementation, integration and owner acceptance explicit in their own columns. Use source-native IDs unchanged; never mint a duplicate SPEC or ticket ID to fit this registry.
 
@@ -32,7 +32,7 @@
 
 ### Mission Control ownership and monitor cycles
 
-- **Definitions:** [Mission Control](.agents/skills/mission-control/SKILL.md), shared [Status](.agents/skills/status/SKILL.md)/[Monitor](.agents/skills/monitor/SKILL.md) and [Review and Merge](.agents/skills/mc-review-and-merge/SKILL.md) installed under D-023; runtime exercise pending.
+- **Definitions:** [Mission Control](.agents/skills/mission-control/SKILL.md), shared [Status](.agents/skills/status/SKILL.md)/[Monitor](.agents/skills/monitor/SKILL.md) and [Commit Supervisor](.agents/skills/mc-commit-supervisor/SKILL.md) installed under D-024/S5; isolated rehearsal pending. Historical Review and Merge is a searchable alias, not an active entry.
 - **Monitor task / host:** unregistered by this setup; no UUID asserted.
 - **Role / schedule:** not selected or activated by this setup. No heartbeat created; automation ID and next wakeup remain unassigned.
 - **Launch path evidence:** native project listing on 2026-10-04T03:26:55Z returned saved project `🖥️ Mission Control`, ID `54fe8ed4-5911-4033-8f65-7d0126a4f29c`, with this home's exact absolute path. Re-resolve it before task creation; actual child startup CWD is still unexercised.
@@ -53,7 +53,7 @@
 | MC-T06 | Update SPEC/Roadmap Creator for First Draft and Release Validation | installed; exercise pending | Codex side chat (ephemeral), D-018/019 setup | MC-T05 | Creation Supervisor and standalone Draft Supervisor (D-019), shared stages, leaf authors and validators installed; structural checks complete, no live run. |
 | MC-T07 | Build requirements-definition agent | queued | — | MC-T04, MC-T05, MC-T06 | — |
 | MC-T08 | Build and pilot ticket sessions and reconciliation | queued | — | MC-T02, MC-T03, MC-T04 | — |
-| MC-T09 | Build Commit Supervisor | reviewed SPEC ready to assign; implementation/rehearsal pending | Owner-directed planning, D-024; no persistent integration job UUID registered | Existing accepted integration prerequisites; D-021/D-023/D-024 | [Integrated workflow SPEC](planning/commit-supervisor/SPEC.md) passed separate worker/stage/release reviews; [planning/review record](planning/commit-supervisor/PLANNING.md) holds exact identity/next step. Replacement-role implementation and isolated rehearsal remain required. |
+| MC-T09 | Build Commit Supervisor | installed; isolated rehearsal pending | Owner-directed planning, D-024; no persistent integration job UUID registered | Existing accepted integration prerequisites; D-021/D-023/D-024 | [Integrated workflow SPEC](planning/commit-supervisor/SPEC.md) passed separate worker/stage/release reviews; [planning/review record](planning/commit-supervisor/PLANNING.md) holds exact identity/next step. S5 canonical entry/three integration-role mappings and active routes are installed; [setup report](planning/commit-supervisor/execution/S5-builder.md) records current checks. Actual S6 agent/runtime/recovery rehearsal remains required; MC-T09 is not complete. No persistent integration job or operational MC is registered. |
 | MC-T10 | Build navigable HTML skeleton | queued | — | MC-T02, MC-T03 | — |
 | MC-T11 | Assemble MC profile and rehearse turnover | instructions installed; exercise pending | Codex side chat (ephemeral), D-023 setup | D-023 role split | General-assistant AGENTS and explicit mission-control entry installed; successor/runtime rehearsal remains. |
 | MC-T12 | Configure hourly monitoring and recovery | procedure installed; inactive | Codex side chat (ephemeral), D-023 setup | Assigned role and authorized cycle activation | Shared incremental Status and hourly Monitor with role-specific ends/resumption installed; no automation created. |
