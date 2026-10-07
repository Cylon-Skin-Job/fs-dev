---
name: Wiki Update
description: Manually invoked wiki maintenance with a supervisor, research and repair workers, and independent audit.
metadata:
  source-files: []
  last-modified: "2026-09-28T05:19:05Z"
---

Start a session in this Wiki folder and invoke **Wiki Update** or `$wiki-update`. Give it a commit range, feature/section or explicit current-state review scope. The session becomes Wiki Update Supervisor and follows the local [entry instructions](../../AGENTS.md) and [supervisor skill](../../.agents/skills/wiki-update/SKILL.md).

## Roles

| Role | Responsibility |
|---|---|
| Wiki Update Supervisor | Scope, assignments, report synthesis, finding resolution and final handoff. |
| Wiki Research Worker | Read-only sub-agent investigations; facts, missing coverage and article dispositions. |
| Wiki Repair Worker | Sub-agents with distinct article ownership; source-backed edits and cross-page integration. |
| Wiki Audit | Fresh independent sub-agents; factual correctness, omissions and integrity checks. |

Research feeds Repair, then independent Audit. Findings return to targeted research/repair and fresh review. Completion is scoped to the assigned evidence and final reviewed files; known in-scope material gaps prevent a complete result.

## Local package

AGENTS.md supplies shared instructions. `.agents/skills/` contains the four procedures; `.codex/agents/` and `.codex/config.toml` define their local role profiles. [Session contract](../../.agents/wiki-session-contract.md) defines assignments, baselines, report ownership and recovery. Operational records are created under hidden `.wiki-runs/` only when a run starts.

This is a manually invoked agent workflow. It has no Mission Control dependency, automatic merge/commit trigger or timer. Folder-local definitions do not themselves start agents or prove that the current host loaded them. Verify local discovery and delegation when starting a run. Product code, runtime data and template wiki copies are outside a normal update's write scope.

[Sync Wiki Context](../001-Sync_Wiki_Context/PAGE.md) remains a narrow procedure for refreshing the Guide when structure changes. [Audit Workflow](../../000-Wiki_Guidance/004-Audit_Workflow/PAGE.md) supplies article integrity checks; it is not itself the independent agent audit.
