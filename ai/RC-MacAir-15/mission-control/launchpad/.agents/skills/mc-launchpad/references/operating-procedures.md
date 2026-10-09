# Operating Procedure Router

Use this reference to choose an existing procedure or define a bounded support assignment. Installed skills vary by environment; prefer the named skill when it is available and applicable.

| Need | Procedure |
|---|---|
| Resume or shape the user-facing pre-roadmap workspace | Continue `$mc-launchpad`. |
| Save the current conversational state without launching a batch | Use `$mc-capture` against the active folder. |
| Research, inspect, compare, reconcile, or maintain working documents backstage | Use bounded support assignments; for schema and record operations read [Memory Maintenance](../../../../../.agents/skills/mc-memory-maintenance/SKILL.md). |
| Convert mature requirements and source-of-truth documents into an approved roadmap or SPEC bundle | Use `$mc-roadmap-creator` only when the owner invokes or authorizes that handoff. |
| Execute an approved specification | Use `$mc-orchestrator` or the applicable implementation supervisor; do not treat Launchpad readiness as execution authority. |
| Create or edit a specialized artifact such as a document, PDF, presentation, spreadsheet, image, or site | Use the installed artifact-specific skill and preserve the Launchpad folder as the planning and provenance surface. |
| Verify current or unstable external facts | Use authoritative current sources and record provenance in the applicable evidence document. |

## Define a Support Work Packet

Include:

- objective and why it matters now;
- exact folder, target document, and section;
- sources or search boundary;
- relevant genre, domain, or procedure reference;
- expected durable record or synthesis;
- authority boundary and prohibited actions;
- coordination needs and return condition.

Split work only when assignments can proceed independently. Give each writer a non-overlapping write lease. Use `BULLETIN.md` for cross-chat coordination that must survive the current turn, not for routine progress.

## Return to Launchpad

Return a concise synthesis containing:

- findings or artifacts completed;
- sources inspected;
- contradictions or confidence limits;
- documents changed;
- owner decisions still required; and
- the most useful next conversational step.

Do not present worker speculation as owner intent or automatically promote a recommendation into a decision.
