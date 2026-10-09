# Ticket sessions and unattended work

> Owner-approved operating design under D-014. This contract defines future ticket work and its records; it does not start a ticket, grant a particular product change or activate Mission Control during construction.

## Work unit and ownership

A Launchpad folder can hold a simple fix, an investigation or a larger project. TICKET.md is its first intake brief, introduced alongside the five conversational documents. The main session owns discussion, synthesis and the local return point. The conversation is the working interface; the folder preserves the assignment and evidence across replacement sessions. Preserve existing external ticket IDs and links without automatically changing the external system.

Use the [starter ticket](launchpad/template/TICKET.md) and local AGENTS/index. INTENT and DECISIONS retain accepted direction; ISSUES retains consequential gaps; PROPOSALS retains candidate fixes; REFERENCES, CHANGE_SURFACE and CONTRACTS retain their existing roles. TICKET summarizes and links these authorities. Keep small assignments proportionate: do not manufacture a roadmap, duplicate decisions or fill every section before useful investigation.

## Intake and workflow selection

Capture the objective, known evidence, scope, success conditions, unresolved intent and actual authority. Select the smallest sufficient workflow based on evidence, not the label “bug.” A bounded fix can proceed through intake, investigation, proposed fix, independent review, implementation, verification and approval or integration within its assignment authority. A First Draft or full roadmap is unnecessary when a short proposal states the change, boundaries, dependencies and checks adequately.

Use First Draft for work that needs a skeleton and discussion; route larger work through shaping, Creator and independent Release Validation when those procedures are ready. Escalate when investigation reveals unresolved product intent, broader architecture or compatibility changes, migrations, cross-project dependencies or an unbounded impact surface. Record why the workflow changed and continue only independent authorized work. Existing SPEC acceptance gates remain applicable to work routed into SPECs.

## Investigation and repair

Use the [investigation contract](investigation-contract.md) for bounded questions and separate evidence reports. Inspect the applicable code standards and routed guidance, relevant wiki principles, changed code and affected callers/consumers. Record source revisions, reproduction limits, dependencies, concurrent ownership, likely regressions and needed wiki updates. Broaden discovery only where it can change the fix or its verification; do not claim complete coverage from a supplied packet alone.

Before implementation, state the proposed mechanism, affected surfaces, alternatives where consequential, smoke/regression checks and any unresolved intent. The implementation assignment names its checkout and exact ownership. A valid authorization may cover the full bounded repair cycle; do not require repeat approval for routine repairs already inside it. New product intent or work outside that scope returns to the owner. A general setup decision does not authorize a specific future commit, PR or merge.

## Independent review and audit trail

MC may assign an independent adversarial reviewer under the active work authority and available session tools. The reviewer challenges the proposal against intent, standards, dependencies and evidence, then reviews the implemented candidate and relevant verification before release. Proposal approval alone does not certify code. Reviewers own their reports, not the author's shared synthesis or repair files, unless separately assigned.

All contributors use the same designated memory folder. Each assignment may create only its allocated evidence directory, such as `investigations/<assignment-id>/`, `reviews/<assignment-id>/` or `verification/<assignment-id>/`. Record these paths in TICKET; do not create empty directories in the template. Shared memory does not imply concurrent writes to the same code checkout. Follow the [session contract](session-contract.md) for actual CWD, identities and write ownership.

Each report identifies its assignment and author, input document revisions and code commit plus dirty diff/snapshot identity when applicable, sources inspected, checks performed, findings with stable local IDs, limitations and completion state. A branch name or “latest” is insufficient to identify a reviewed candidate. Retain prior reports; the main session links each finding to repair evidence, explicit deferral, rejection with rationale or a remaining blocker. Material changes invalidate affected review conclusions and require an appropriate recheck. No fixed number of reviews or claims of universal coverage substitute for resolving material findings.

## Mission Control and unattended activity

After activation under D-004, MC provisions authorized folders, tracks unattended assignments across intake, First Draft, investigation, implementation and integration, and runs checks on the owner's selected schedule. Hourly is the discussed default, not an already active timer. The responsible session retains detailed reasoning; MC retains purpose, owner, stage, dependencies, evidence freshness and next action.

A handoff to unattended work records scope/authority, expected deliverables, input revision, session identity, report destination, completion/stop conditions and next return point. A returned result distinguishes ready for discussion, needs owner input, ready for authorized next step, intentionally held and completed within scope. Missing deliverables require checking whether the agent stopped prematurely; an ended turn, elapsed time or owner wait alone is not failure. Before recovery, verify no active writer and resume only authorized unfinished work.

MC alerts on meaningful completion, blockers, failure or needed decisions, with a short synopsis and link to the responsible session. A First Draft completed for discussion remains unapproved for implementation. MC can answer broad questions from current records or send a bounded question to the responsible assigned agent and relay its sourced answer and uncertainty. File bulletins do not deliver messages. Preserve explicit session/tool restrictions and avoid duplicate dispatch by recording the active assignment and its return condition.

## Steering, acceptance and continuity

The owner may return to the ticket session to steer at any point. Record changed intent, identify affected assignments and reviews, and obtain acknowledgment of a hold or use an authorized interruption before reallocating a writer. Reassess stale proposals, pending work and earlier approvals; do not discard unaffected evidence or silently continue contradictory work.

A return packet links the result, candidate revision, checks, finding dispositions, remaining issues, requested decision and next safe action. Record implementation, integration and acceptance separately. MC routes approval or integration to the appropriate authority; tests passing do not grant merge permission. Replacement sessions read TICKET and follow its links before resuming; preserve historical identities and evidence rather than resetting the audit trail.

## Construction status

The intake template and this workflow are defined. Runtime ticket automation, specialized review/execution profiles, a concrete ticket pilot, monitoring and turnover remain setup work. MC-T04 owns template adaptation, MC-T08 owns ticket workflow/reconciliation and its pilot, MC-T09 owns integration, and MC-T11–12 own controller and monitoring behavior. No current ticket or agent run is created by this contract.
