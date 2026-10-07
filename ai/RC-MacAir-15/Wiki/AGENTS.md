# Wiki agent home

## Scope and entry

This folder is the working home for manually invoked Wiki Update and Wiki Audit sessions. These instructions apply to wiki work; they do not turn every reader or ordinary page edit into an update run. Creating or discussing the package does not invoke it.

When the user says **Wiki Update** or invokes `$wiki-update` from this folder, the current session acts as **Wiki Update Supervisor** and reads `.agents/skills/wiki-update/SKILL.md`. There is no Mission Control, post-commit hook, timer or automatic dispatch requirement. A user may supply commits, a feature/section, or request a current-state review. Resolve scope before claiming coverage.

When explicitly assigned research, repair or independent audit, read that role's local skill instead of starting a second supervisor. `$wiki-audit` can run independently as a read-only review of an assigned scope.

## Role hierarchy

- Wiki Update Supervisor: owns scope, assignments, synthesis, findings and final handoff.
- Wiki Research Worker: coordinates read-only research sub-agents and produces a repair assignment.
- Wiki Repair Worker: coordinates sub-agents with disjoint article ownership and integrates their edits.
- Wiki Audit: fresh independent reviewer coordinating audit sub-agents; checks correctness and omissions, reports without repairing reviewed pages.

During an invoked workflow, delegate these bounded roles and their independent sub-tasks as described in the skills. Do not use a repair author as their own final auditor. Ordinary wiki edits outside this workflow do not require delegation.

## Shared contract

Read [.agents/wiki-session-contract.md](.agents/wiki-session-contract.md) for source baselines, assignment fields, report ownership, concurrency and completion. Preserve the invoking model, reasoning effort and effective permissions. The local agent profiles define roles, not new authority or a filesystem sandbox.

The project root is available for source inspection; resolve it with Git. Wiki CWD is context, not a prohibition on reading source outside Wiki. Product-code changes, runtime data, template copies, external messages, Git commits/pushes and deployment are outside an ordinary Wiki Update unless separately assigned. Report an implementation discrepancy; do not change code to make an article true.

## Article rules

Before writing, read [Style Guide](000-Wiki_Guidance/001-Style_Guide/PAGE.md), [Updating Wiki Content](000-Wiki_Guidance/003-Updating_Wikis/PAGE.md) and [Audit Workflow](000-Wiki_Guidance/004-Audit_Workflow/PAGE.md). Distinguish source-backed current behavior, approved future direction and unresolved decisions. Do not promote plans, stale comments or test names into implemented facts.

Use exact code files in `metadata.source-files`, no relationship edges. Timestamp actual article edits, never untouched reviews. Preserve complete preimages in `.versions/`; never rewrite earlier snapshots. Use staged generation for script-owned navigation. Operational reports belong in the assigned hidden run directory, not durable article prose or normal wiki navigation.

This local package is the entry point for manual wiki maintenance. Historical background `wiki-manager` workflows outside this folder are not its procedure and are not activated by it.
