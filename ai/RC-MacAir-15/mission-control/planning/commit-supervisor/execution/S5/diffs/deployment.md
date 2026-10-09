--- deployment.md preimage
+++ deployment.md current
@@ -2,7 +2,7 @@
 
 ## Installed definitions
 
-D-023 installs `$mission-control` as the explicit coordination entry and splits shared Status from Monitor. Status observes/records incremental progress. Monitor runs hourly Status calls, retains the prior report across cycles, and pauses before actionable reporting/transitions. MC ends its whole cycle on any tracked build completion or its own next-action announcement/execution; it requires a new owner monitor directive afterward. Roadmap Supervisors pause while reviewing/selecting next steps or waiting for owner acceptance and resume only after authorized child dispatch. The SPEC Orchestrator supplies detailed Status without acquiring a timer. Review and Merge dispatch remains MC-owned after pause confirmation; commit/push approval remains owner-owned.
+D-023 installs `$mission-control` as the explicit coordination entry and splits shared Status from Monitor. Status observes/records incremental progress. Monitor runs hourly Status calls, retains the prior report across cycles, and pauses before actionable reporting/transitions. MC ends its whole cycle on any tracked build completion or its own next-action announcement/execution; it requires a new owner monitor directive afterward. Roadmap Supervisors pause while reviewing/selecting next steps or waiting for owner acceptance and resume only after authorized child dispatch. The SPEC Orchestrator supplies detailed Status without acquiring a timer. Commit Supervisor dispatch remains MC-owned after pause confirmation; commit/push approval remains owner-owned.
 
 Initial package created 2026-09-26T02:11:26Z under D-007; First Draft added under D-008. These are executable instruction definitions on disk, not active agents or evidence of completed build tasks.
 
@@ -11,7 +11,9 @@
 | `mission-control` (explicit coordination role) | [SKILL.md](.agents/skills/mission-control/SKILL.md) |
 | `status` (shared incremental observation/reporting) | [SKILL.md](.agents/skills/status/SKILL.md) |
 | `monitor` (shared cycle scheduling) | [SKILL.md](.agents/skills/monitor/SKILL.md) |
-| `mc-review-and-merge` | [SKILL.md](.agents/skills/mc-review-and-merge/SKILL.md) |
+| `mc-commit-supervisor` | [SKILL.md](.agents/skills/mc-commit-supervisor/SKILL.md) |
+| `mc-code-review-orchestrator` | [SKILL.md](.agents/skills/mc-code-review-orchestrator/SKILL.md) |
+| `mc-commit-repair-worker` | [SKILL.md](.agents/skills/mc-commit-repair-worker/SKILL.md) |
 | `mc-preflight` | [SKILL.md](.agents/skills/mc-preflight/SKILL.md) |
 | `mc-document-sweep` | [SKILL.md](.agents/skills/mc-document-sweep/SKILL.md) |
 | `mc-draft-supervisor` | [SKILL.md](.agents/skills/mc-draft-supervisor/SKILL.md) |
@@ -31,7 +33,9 @@
 
 | Local spawned role | Profile | Procedure |
 |---|---|---|
-| `mc-review-and-merge` | [TOML](.codex/agents/mc-review-and-merge.toml) | mc-review-and-merge |
+| `mc-commit-supervisor` | [TOML](.codex/agents/mc-commit-supervisor.toml) | mc-commit-supervisor |
+| `mc-code-review-orchestrator` | [TOML](.codex/agents/mc-code-review-orchestrator.toml) | mc-code-review-orchestrator |
+| `mc-commit-repair-worker` | [TOML](.codex/agents/mc-commit-repair-worker.toml) | mc-commit-repair-worker |
 | `mc-roadmap-creation-supervisor` | [TOML](.codex/agents/mc-roadmap-creation-supervisor.toml) | mc-roadmap-creator |
 | `mc-planning-stage-orchestrator` | [TOML](.codex/agents/mc-planning-stage-orchestrator.toml) | mc-planning-stage |
 | `mc-roadmap-author` | [TOML](.codex/agents/mc-roadmap-author.toml) | mc-roadmap-author |
@@ -42,7 +46,7 @@
 | `mc-spec-orchestrator` | [TOML](.codex/agents/mc-spec-orchestrator.toml) | mc-orchestrator |
 | `mc-spec-slice-builder` | [TOML](.codex/agents/mc-spec-slice-builder.toml) | mc-spec-slice-builder |
 
-Profiles are thin: they resolve controller_home, read the [session contract](session-contract.md), select a local procedure and establish role boundaries. Slice implementation instructions were extracted from the original builder profile into a skill. The creator, supervisor, orchestrator and review-gate procedures retain their existing standards, independent review, deviation and owner-acceptance contracts. D-018 installs the planning validator, stage orchestrator, candidate author and Creation Supervisor profiles below. D-021 now installs the narrowed integration role as Review and Merge; behavioral evaluation remains unexercised.
+Profiles are thin: they resolve controller_home, read the [session contract](session-contract.md), select a local procedure and establish role boundaries. Slice implementation instructions were extracted from the original builder profile into a skill. The creator, supervisor, orchestrator and review-gate procedures retain their existing standards, independent review, deviation and owner-acceptance contracts. D-018 installs the planning validator, stage orchestrator, candidate author and Creation Supervisor profiles below. D-024/S5 now installs Commit Supervisor and its two subordinate roles; actual isolated workflow/recovery rehearsal remains S6 work. The historical D-021 installation account below is retained as provenance.
 
 Earlier activation mapping below is superseded by D-023: role selection is `$mission-control`, and Monitor only schedules shared Status calls.
 
@@ -62,7 +66,7 @@
 
 ## Local scope and global compatibility
 
-[Project config](.codex/config.toml) retains Full Access and now maps ten distinct `mc-` profile names. There are twenty local skills including the Launchpad-only entry. All except `mission-control`, `status` and `monitor` use `mc-` names. No personal skills with those three names were present at D-023 setup; global definitions are unchanged. Role and Monitor selection are explicit; Status may be selected for an assigned observation request. D-013 removed the legacy personal Second Brain installation and repaired its five caller files; other personal profiles/skills remain installed. Rollback files are outside discovery at `/Users/rccurtrightjr./.codex/skill-backups/2026-09-26-second-brain-retirement/`. Root MC has no automatically discovered local mc-launchpad entry because that workflow is scoped under `launchpad/`; it can reference the local definition explicitly in assignments.
+[Project config](.codex/config.toml) retains Full Access and now maps twelve distinct `mc-` profile names. There are twenty-two local skills including the Launchpad-only entry. All except `mission-control`, `status` and `monitor` use `mc-` names. No personal skills with those three names were present at D-023 setup; global definitions are unchanged. Role and Monitor selection are explicit; Status may be selected for an assigned observation request. D-013 removed the legacy personal Second Brain installation and repaired its five caller files; other personal profiles/skills remain installed. Rollback files are outside discovery at `/Users/rccurtrightjr./.codex/skill-backups/2026-09-26-second-brain-retirement/`. Root MC has no automatically discovered local mc-launchpad entry because that workflow is scoped under `launchpad/`; it can reference the local definition explicitly in assignments.
 
 The shared global `clean-room-reviewer` profile remains an external dependency. General `clean-room-loop` and `fusion-electron-restart` skills remain globally available. Profile names are distinct from the old global spec profiles to avoid relying on an unverified same-name profile override. Always use the local role names in this package’s packets.
 
@@ -77,6 +81,9 @@
 [Document Sweep](.agents/skills/mc-document-sweep/SKILL.md) now owns review of documentation changes since a prior reviewed snapshot, including cross-document propagation and source sufficiency. It includes a bounded snapshot/diff/baseline helper; its reports carry unresolved findings. Capture, explicit Checkpoint, Memory Maintenance and investigator assignments retain their separate responsibilities. The personal Launchpad installation retains standalone copies of the record rules and two helpers so legacy Capture/Launchpad callers do not break when Second Brain is removed.
 
 ## Validation and remaining runtime checks
+
+Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. S5 installs the sole canonical [Commit Supervisor entry](.agents/skills/mc-commit-supervisor/SKILL.md), twelve profile mappings and active caller routes under the [owner implementation assignment](planning/commit-supervisor/execution/approval-receipt.md). Legacy `mc-review-and-merge` discovery/profile is retired after the [cutover inventory](planning/commit-supervisor/execution/S5/cutover-inventory.json) found no registered/live legacy job or matching schedule. Complete old entry/profile bytes remain in bounded execution preimages outside discovery. MC-T09 is **installed; isolated rehearsal pending**, not complete. Static/current checks and the S5 builder gate are recorded in [the builder packet](planning/commit-supervisor/execution/S5-builder.md); actual runtime role loading, full fresh agent chain, app handoff and recovery behavior are S6 requirements. No operational MC, persistent task, schedule, publication or Alpha action is created by this installation.
+
 
 D-023 structural checks passed for six affected skill entrypoints and their UI metadata, all ten TOML mappings with unchanged access/model defaults, and the actual twenty-skill inventory. The seventeen-document index passed; 25 affected/caller files passed whitespace checks and 149 local file links resolved. A local startup-prompt probe from this home exposed the Mission Control command route, shared Status path and cycle-end rule in AGENTS.md. This proves the instruction route is available to a fresh local task; it does not establish skill-selector UI discovery, a live role invocation or scheduling behavior. No heartbeat, Status snapshot, child task, live review or build was started. Runtime pause/resume, scheduling-failure handling, incremental report production and owner-gated supervisor advancement remain to be exercised on an explicitly assigned run.
 
