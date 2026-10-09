# Manager recordkeeping contract

> Working design for the five manager homes. Owner-requested roles and folder separation are established; the storage/operation details below are proposals to exercise before deployment.

## Owner direction and source

On October 1, 2026, the owner named Mission Control — Status Manager, WorkFolder Manager, Git Manager, Staging Manager and Discussion Manager, then requested a folder for each and a recordkeeping system. Status Manager should use a single Launchpad Status Check skill. WorkFolder Manager should maintain folders and a registry available to Status Manager. Git Manager should own the Git/Alpha procedure moved into a skill. Staging Manager should assess planned-work dependencies and shared impacts. Discussion Manager should support broad discussion, research and packages handed to other managers.

Recorded from this side conversation by Codex side chat (ephemeral), 2026-10-02T01:37:11Z (October 1 PDT). No side-chat or manager-session UUID is asserted. Detailed proposals in this document are not additional owner approvals.

## Folder layout and minimal entry packet

```text
managers/
  AGENTS.md
  recordkeeping.md
  handoff.md
  BULLETIN.md
  index.json
  status-manager/       AGENTS.md, handoff.md, index.json
  workfolder-manager/   AGENTS.md, handoff.md, index.json
  git-manager/          AGENTS.md, handoff.md, index.json
  staging-manager/      AGENTS.md, handoff.md, index.json
  discussion-manager/   AGENTS.md, handoff.md, index.json
```

The manager folder stores role continuity; Launchpad/workfolders store subject continuity. Do not relocate domain content into manager folders. Each manager resumes from its own handoff, then follows only the references needed for the current request. The index remains static schema/routing metadata, not a live database.

## Sources of truth and intended writers

| Record | Intended owner | Other managers' use |
|---|---|---|
| Workfolder catalog and session bindings | WorkFolder Manager | Locate the subject, responsible sessions and evidence/check locations. |
| Ticket/SPEC progress and completion evidence | Assigned workfolder/build owner | Read the source and record an observation or assessment without overwriting it. |
| Status-check report | Status Manager | See what was actually checked, when, and whether attention is needed. |
| Sequencing/dependency assessment | Staging Manager | Identify exact prerequisites, overlaps, safe parallel work and hold/release recommendations. |
| Git/PR/merge/deployment receipt | Git Manager | Establish branch/candidate/landed revision and verified deployment outcome. |
| Discussion synthesis and handoff package | Discussion Manager | Recover intent, questions, sources and the outcome requested from another manager. |
| Each manager's current handoff and job records | That manager's assigned writer | Resume a job or incorporate a result with its provenance. |

These are distinct claims. Status Manager's observation does not approve completion; Staging's assessment does not grant a build or merge; Git landing does not prove consumer adoption or Alpha installation. Owner decisions remain at the designated decision source and are linked by applicability.

## Workfolder catalog contract

The existing [registry](../registry.md) remains the canonical catalog during this setup. WorkFolder Manager's eventual maintenance authority/location must be reconciled with its current writer contract before switching. Do not create an independent populated catalog in this package.

A proposed catalog entry contains stable folder ID/path, purpose, local entry/brief, relevant native ticket/work IDs, responsible role, verified session address and designation source, authoritative progress/evidence/checkpoint locations, and registration/update provenance.

Each registered monitored item also identifies its kind (conversation task, build command or service), how to check it, expected completion/wait/stop conditions, latest durable report and responsible return point. A conversation UUID is not a process ID. Do not invent a service PID, port, tool address or monitoring target to fill the entry.

WorkFolder Manager maintains the catalog of what to inspect, not all evolving build status. Status Manager records observed status and uncertainty. Source owners maintain their progress. Prepared folders can be registered with no active session; inactivity is not a failed process.

## Manager operation records

For a substantive assigned operation, create an earned directory under its manager home, such as operations/<job-id>/. Use a unique immutable job ID; it is not a product ticket number or conversation UUID. Preserve external work IDs unchanged. Allocation convention/tooling remains to be chosen; existing ticket numbering is not changed here.

Minimal proposed files:

- request.md: owner/assignment source, question or outcome, scope/exclusions, authoritative inputs and revisions, owned write surfaces, dependencies, completion conditions and intended recipient.
- result.md: actual outcome, checked/changed sources, evidence/check results, uncertainty/issues, disposition, next action and any delivered/acknowledged handoff.
- events.md: material transitions and their evidence, added when transitions warrant it. Keep current state in the handoff rather than replaying a log on every resume.

Reports use the same packet fields as [record-templates.md](../record-templates.md), proportionate to the job. A one-shot status report can be a dated report in the Status home without a separate request directory; it states the requested inventory/scope. Do not require a large form for a small question.

Checkpoint unfinished work before ending: what completed, what remains, exact source/candidate, any active writer, why it waits, and what must not be repeated. Track last checked separately from last progress. Use states such as active, waiting-owner, waiting-dependency, ready-for-review, completed-within-assignment, stopped-unexpectedly and unknown, with evidence rather than inference from elapsed time.

## Issues, decisions and handoffs

Record an issue with local stable ID, observation/missing intent, source/revision, affected work, consequence, resolution condition, responsible role and next action. Link related issues instead of silently generating five copies. New shared issues/owner decisions return to their designated writer for incorporation; preserve each manager's evidence and result until incorporated.

A cross-manager handoff identifies from/to roles, work/job ID, requested outcome, source record/revision, outstanding choices and report return path. Track prepared, delivered and acknowledged separately. A file reference or bulletin does not deliver a message. Actual cross-session messaging follows the owner's authorization.

Discussion can prepare a package for Staging; Staging can return parallel-work advice; Git can return an integration receipt; Status can point out a stopped registered assignment. None of those interactions silently grants the next operation permission. Record the specific action already covered by standing or current authority.

## Status-check record

Every check includes observation time, registry/source revision, inventory inspected, per-item evidence and classification, and unverified or inaccessible targets. Return only attention items plus a concise checked count when all is well. Never claim stopped or healthy solely because a task ended a turn or a report is old.

Status Manager uses only the focused Launchpad Status Check workflow; it does not become the registry curator, restart agents, investigate feature architecture or repair builds as an incidental status operation. Its own reports preserve what was observed without changing source progress or checkpoint cursors.

## Existing records and cutover

This setup creates five memory homes and a local design entry packet. It does not install profiles/skills, move Git instructions, register sessions, renumber/migrate tickets or activate MC monitoring. Existing central files and the five Launchpad homes are preserved.

Before deployment, choose the canonical catalog writer/location, operation-ID convention and how these homes are reached by installed profiles. Update the parent routing/role hierarchy and record any superseded clauses. Move a source only with an explicit migration and source-to-destination receipt; preserve history and links. The parent integrator owns shared index/config adoption unless reassigned.

## Verification and next step

Validate each local index, local links and role boundaries. Then exercise a small folder registration → status observation → attention handoff scenario without inventing live sessions. Keep deployment and behavioral test results distinct from file/schema validation.

Next proposed setup job: settle the WorkFolder registry contract and its shared-file cutover. Then implement Launchpad Status Check against that catalog. The remaining manager skills can use the same request/result and handoff conventions.
