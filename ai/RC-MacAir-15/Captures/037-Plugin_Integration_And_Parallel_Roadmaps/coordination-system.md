# Mission Control — System Sketch

**Capture:** Mission Control working memory · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** proposal; not an active registry or controller
**Updated:** 2026-09-23 (PDT)
**Trickle-down:** [Mission Control role](mission-control.md) · **Roll-up:** profiles and operating guidance

## Durable information

| Surface | Responsibility |
|---|---|
| Guidance/decisions | Role, adopted principles, authority and owner choices. |
| Registry | Current work identities, hierarchy, assignments, dependencies, evidence and state. |
| Bulletin | Handoffs, conflicts, questions, holds and resolutions that another session must see. |
| HTML artifact | Readable projection of the records; not a second independent source of truth. |

**Current project boundary:** Mission Control's coordination system is the work being designed now. The three product roadmaps are future inputs, selected and assigned later; do not fabricate roadmap content to populate the controller's design.

SPEC ledgers retain execution evidence; tickets retain original requests/history; Mission Control owns coordination and synthesis. File formats and write ownership remain to be settled. Reviewers should produce assigned result records instead of competing to edit one central file.

**MC-T02 and MC-T03 result:** flat Markdown [registry](registry.md) and [bulletin](bulletin.md) hold current state and material cross-session coordination. [Domain routing](domain-routing.md) defines role ownership and future roadmap intake. The registry links to authoritative source records, SPEC reports and task-specific checkpoints instead of copying them. Product roadmap subjects are assigned later; no JSON sidecar or HTML-owned progress state is introduced.

## Ticket relationships

Allow many-to-many, requirement-level mappings between tickets and work. Record ticket/requirement, relationship, target roadmap/SPEC/slice, rationale, evidence, checked revision/time, reviewer, remaining scope and decision authority.

Keep these separate:

- **Disposition:** active, superseded, obsolete, duplicate or unresolved.
- **Coverage:** none, projected, partial or covered by an approved SPEC.
- **Delivery:** unknown, in progress, reported implemented, verified, integrated and owner-accepted as applicable.

These names are provisional. Coverage cannot close a ticket as delivered. Supersession identifies its replacement and authority; obsolescence explains why the requirement no longer applies. Reviewers propose mappings; Mission Control synthesizes; canonical status changes retain the applicable owner authority. Preserve historical decisions instead of silently rewriting them.

## Roles and context boundaries

Mission Control owns cross-roadmap coordination and owner dialogue. Ticket reviewers examine assigned tickets against named authorities. Integration/dependency investigators answer a bounded overlap, merge or recovery question. Roadmap supervisors own their approved programs and acceptance policies. SPEC orchestrators, builders and reviewers retain their existing execution responsibilities.

Local Codex profile files already exist for `spec-orchestrator`, `spec-slice-builder` and `clean-room-reviewer`. New profiles should add missing coordination roles and load a named workspace entry point without embedding every roadmap. Profile installation/configuration is a later step after the behavior is settled.

Every specialist returns: finding, evidence references, uncertainty, affected IDs and recommended next action. Detailed logs remain at the source. Mission Control does not need to inherit the specialist's transcript.

## Domain stewardship and Capture progression

**Origin:** tentative owner suggestion on September 23: consider domain-scoped agents assigned by Mission Control, then use other Captures to manage ideation → shaping → review → SPEC/roadmap creation. The following interpretation is an assistant proposal, not an adopted organization or a dispatch instruction.

Separate three dimensions:

- **Domain:** enduring subject responsibility and memory, such as chat, views or plugin capabilities; actual boundaries remain undecided.
- **Capture:** a bounded problem or opportunity moving through ideation, shaping and review toward a planning handoff. Existing Captures should be reused where appropriate rather than copied for each phase.
- **Roadmap:** an approved execution sequence that can involve several domains. Domain count need not match the three roadmap count.

Mission Control routes questions and coordinates dependencies. A domain steward maintains its source map, decisions, relevant ticket relationships, open questions and a compact current brief in durable files. A replacement session can resume that stewardship; it does not depend on one agent retaining unlimited context. The steward engages bounded researchers, shapers or planners as authorized, and returns only material findings and cross-domain implications to Mission Control.

Review remains a distinct assignment where independent judgment is required. Domain knowledge does not grant self-approval, product-decision authority, permission to implement, or permission to bypass existing roadmap gates. Mission Control assigns work but does not take over roadmap authoring.

Suggested Capture progression: ideation preserves possibilities; shaping defines the problem, boundaries and unresolved choices; review challenges assumptions and assesses readiness; a named planning role produces SPECs/roadmaps from the authorized scope. Review may return work to shaping. Promotion links back to the Capture and records remaining questions rather than erasing the source discussion.

Next design question: should a domain agent be a continuing steward of the domain's working memory, with task-specific specialists underneath, or a temporary investigator for each assignment? The continuing-steward model is the assistant's recommendation; no profile or session has been created.

## Proposed Branch Manager

**Refinement:** The owner's subsequent vision makes this a bounded integration assignment dispatched by MC when the chosen SPEC/feature unit is ready. [integration-jobs.md](integration-jobs.md) records that direction, the agent's evaluation gate, and the separately reviewed requirements → planning → prerequisite execution path. A waiting integration job can checkpoint and end its session. The earlier flow below remains a supporting proposal, with PR completion distinguished from landing on main.

**Origin:** September 23 owner exploration of a Branch Manager that employs specialists to integrate completed SPECs and notify dependent roadmap supervisors. This is role design, not authorization to commit, merge, publish or dispatch agents.

Mission Control owns cross-roadmap priority and escalation; roadmap supervisors own SPEC readiness and existing acceptance gates; domain stewards explain contract meaning; the Branch Manager owns the integration queue and evidence for the shared baseline. It may delegate candidate preparation, conflict investigation/repair, independent integration checks and downstream adoption checks. Keep a single writer for the shared integration branch/target while independent analysis and isolated checks run in parallel.

Suggested flow:

1. Receive a SPEC handoff containing source branch/worktree, exact candidate, owned changes including necessary deviations, dependencies, checks and acceptance receipts. Accepted uncommitted changes need explicit ownership separation; never collect an entire shared dirty checkout by default.
2. Confirm required gates and integration authority. Prepare scoped commits in isolation if needed, preserving unrelated work. Record the source candidate and intended target baseline.
3. Assemble a candidate against current main. Delegate conflicts to the appropriate domain/execution owner; semantic changes require affected review again. Validate combined behavior and the capabilities downstream work requires.
4. Land through the agreed publishing/merge workflow only when its gates are satisfied. If the target advanced, reconcile and refresh affected evidence before landing. Record the actual landed commit, not merely the source branch commit.
5. Mark the named capability available at that revision and send the dependent supervisor a durable notification reference, exact revision, contract/version, evidence and remaining holds.
6. The receiving supervisor incorporates that baseline into its own branch/worktree, verifies the prerequisite and acknowledges readiness. It starts dependent work only when all other dependencies and its owner gates permit it.

Distinguish: completed → accepted under applicable gates → integration-ready → landed → downstream-adopted. A capability landing satisfies a particular dependency; it does not automatically unblock every task mentioning that feature. Dependency mappings must name the required behavior/contract and consumer work IDs.

Persist each integration job's stable ID, source/target revisions, authority, state, assigned task IDs, review evidence, landed result, affected consumers and notification acknowledgements. After a restart, inspect Git and task state before replaying a mutation or message. A lost acknowledgement after a successful merge must not cause a duplicate integration. Messages prompt attention; durable records retain the obligation.

Fusion-specific publishing guidance still applies: after a successful GitHub push, ask about Alpha follow-up. Updating main and updating the installed Alpha app are separate operations; the Branch Manager must not infer Alpha deployment authority.

Open design choices: merge policy and standing authority, how supervisors submit candidate packets, which role owns the integration gate, and whether consumer baseline adoption is delegated to the Branch Manager or retained by the receiving supervisor. The latter is the current assistant recommendation.

## HTML hierarchy

Show three roadmap roots, expandable through Milestone/SPEC → Slice → Checklist. A details pane shows state, owner/task, evidence, dependencies, holds and next action. Milestones group SPECs only where the source roadmap defines that relationship.

Cross-links expose dependencies between branches. Ticket mappings appear with their relevant work; uncovered requirements remain visible. Distinguish reported completion, review, integration and acceptance. Show evidence freshness; do not invent percentages or checked items. The first skeleton may use unnamed slots until the three roadmap identities are supplied.

## Proposed hourly cycle

Read the compact checkpoint and active bulletin; obtain bounded task snapshots; inspect deeper evidence only for material changes or ambiguity; reconcile dependencies and ticket findings; classify stopped runs before resuming authorized unfinished work; route holds and merge readiness; persist state and refresh the artifact; notify only when meaningful; sleep until the next scheduled check.

Check existing writers before any recovery. Resume from durable checkpoints, preserving completed work. Replacement-task creation, dispatch, merges and continuation across owner gates must follow established authority. The actual automation ID, controller identity and resume path must be recorded when activated; this proposal starts no timer.

## Successor packet

A new Mission Control starts with the role guidance, handoff and compact registry/bulletin. The checkpoint identifies the three roadmap sources, active task IDs and ownership, holds, current evidence, unresolved owner choices, recovery attempts and exact next actions. Confirm whether the previous controller is still active before dispatching work. Follow detailed links only when a coordination decision requires them.
