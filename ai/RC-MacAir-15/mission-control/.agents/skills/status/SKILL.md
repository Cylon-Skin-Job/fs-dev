---
name: status
description: "Build an incremental evidence-backed status report for Mission Control, a Roadmap Supervisor or a SPEC Orchestrator. Use on an owner status request or a Monitor wakeup in an assigned task. Observe and persist progress; classify events for the caller without scheduling, dispatching, reviewing or approving work."
---

# Status

Resolve the caller's actual role, assignment, report ownership, memory folder and separate product checkout. Read applicable instructions, previous status and current ledger/checkpoint/evidence pointers. Shared folder does not mean shared report ownership. Follow [report format](references/report-format.md) for the incremental record and role-specific presentation.

## Observe current work

Inspect assigned persistent tasks through native status/history tools with bounded reads/cursors; inspect runtime children through supported runtime tools when permitted. Correlate tasks with associated processes using recorded identities and evidence. Do not interact with subagents where the session prohibits it. Missing process visibility or old logs cannot establish health, failure or completion. Do not deep-search product code to reconstruct progress.

Read current roadmap/SPEC/slice ledgers and source revision. Distinguish running, reported complete, under supervisor review, waiting-owner, waiting-dependency, failed, stalled, accepted, invalidated and unknown. Elapsed time or an unchanged report alone does not prove a stall. Record suspected stalls separately from confirmed terminal execution or unmet work, with evidence and responsible role. An intentional approval/dependency wait is not a stalled child.

Preserve valid completed/accepted work from prior status. Change it only with explicit revision/invalidation evidence and a reason. Reconcile added, removed or reordered scope from the actual ledger, preserving prior IDs and disposition. Derive totals/ordinal positions from current approved scope; never infer six SPECs from an example or count a review-stage slice as accepted. Record check time separately from last progress. Carry issues/holds and unfinished tickets forward; do not reset them when monitoring restarts.

## Return observation and event classification

Persist reports only in the caller's owned status location; do not change source workflow states, approval receipts, checkpoint cursors or another role's registry. A side task follows its bounded record-writing authority and does not acquire a main role. Status may update its snapshot/history and an existing artifact through its documented report source; these are observation bookkeeping, not next-step execution.

Return the report and structured events to the caller **before** emitting an actionable owner message during an active cycle. Include caller role, cycle scope, work IDs, current evidence, progress deltas, responsible actor and one of:

- `progress_only`: running work or incremental milestones needing no action from this caller;
- `child_returned`: this caller's child produced a packet requiring its review/transition;
- `build_complete`: a monitored build unit completed, whether ready for the owner, held or eligible for integration;
- `action_required`: intervention, recovery, a dependency decision, missing intent or another next action is needed from this caller/owner;
- `unknown`: evidence is insufficient; identify what could not be checked. If missing evidence now requires an action, also return `action_required`.

Classification is role-relative: a supervisor reviewing its SPEC completion is a progress update to Mission Control unless MC needs to act; the same completion is `child_returned` for that supervisor. For Mission Control, any tracked build completion or its own next-action announcement/execution ends the entire cycle, even if other tickets remain running. For a Roadmap Supervisor, a returned/failed/stalled child needing attention ends the cycle before review/transition. The caller uses Monitor to pause first; Status itself never schedules or dispatches. A one-off report does not activate monitoring.
