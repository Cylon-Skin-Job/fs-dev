---
name: monitor
description: "Run one hourly monitoring cycle by invoking Status in a selected Mission Control task or authorized Roadmap Supervisor. Use on an intentional monitor directive or the supervisor's authorized child-dispatch transition. Continue for progress-only reports; pause before completion, next actions or supervisor review. Does not establish a persona or dispatch work."
---

# Monitor

Read applicable role instructions, D-023 in the controller home's decisions.md and [Status](../status/SKILL.md). This is a scheduling skill, not a persona. Require a selected Mission Control task or authorized Roadmap Supervisor with verified main-task identity, memory/report ownership and monitored scope. Explicit side-conversation restrictions remain in force. A general question/status request does not select a role or enable a timer.

## Start or resume one cycle

An owner monitor directive enables a Mission Control cycle. D-023 authorizes Roadmap Supervisors to monitor active orchestrators in assigned approved roadmap runs and resume after each authorized new dispatch, unless the owner pauses/narrows that authority. Installation authorizes no live build or timer. Role selection alone leaves scheduling inactive.

Restore prior status and cycle checkpoint. Reconcile predecessors, active writers and existing schedules before activation. Use the native app automation tool to create/update **one hourly thread heartbeat per owning task**, not shell cron, a standalone scheduled project task or a sleep loop. Inspect existing automation records/tool state; reuse the recorded automation identity across cycles and preserve fields/notification preferences. Reconcile uncertain creation/update before retrying. Do not claim active scheduling until tool-confirmed.

Persist a cycle record in the caller's owned memory/report area: owning role/task/host; monitored work/child identities; cycle identity and prior cycle pointer; automation ID and confirmed state; desired state; start/last-check/last-progress times; latest status pointer; standing continuation authority/owner pause; and end reason/time. Never invent task/automation UUIDs. Status history persists across cycles. Mission Control registers this compact state centrally; a supervisor owns it in its roadmap/job folder and returns a pointer.

The heartbeat prompt links this skill, Status, the role procedure and exact cycle record. It says: verify cycle/task ownership; if desired state is inactive, reconcile pause and do no work; invoke Status on registered work and associated processes; retain prior progress; apply role-specific end conditions; disable the heartbeat before an actionable report or role transition; never grant owner approval or dispatch from Monitor. Report meaningful incremental progress while continuing; stay quiet if unchanged/non-actionable unless routine updates were requested. The first check is due in one hour; one-off Status checks may happen sooner without duplicating a timer.

## Wake and classify

1. Verify ownership and that this cycle is active. Invoke Status against its previous snapshot and current evidence. Do not duplicate Status's inspection logic here.
2. For `progress_only`, persist status/check time, report meaningful incremental changes, and leave the same heartbeat enabled. No delta means no invented progress. Status bookkeeping and progress-only reports do not end a cycle.
3. **Mission Control:** end the whole cycle for any monitored build completion or whenever MC will inform the owner of a next action or perform one. This includes Commit Supervisor dispatch, recovery, holds/releases and owner questions. Other running tickets remain in the snapshot; they do not keep the cycle enabled.
4. **Roadmap Supervisor:** end the cycle when a child returns a completion packet or needs intervention. Keep monitoring disabled throughout supervisor review, repair routing, owner checkpoint and next-step selection. Resume a new cycle only after an authorized child dispatch/resumption is acknowledged. A running child still in its own review is progress, not supervisor review.
5. Return status, events and confirmed cycle disposition to the owning role. That role owns checks, decisions, messages and dispatch. Do not restart an owner wait, recover a child from elapsed time or treat observations as approval.

## End or pause

Before an actionable owner message or domain action, mark desired state inactive and pause the heartbeat through the native automation tool. Record confirmed state, end event, report pointer and responsible role. Ending a turn alone does not stop recurrence. If pause fails/is uncertain, record `stop_unconfirmed`, surface the scheduling failure and do not dispatch domain work or claim the cycle stopped. A later wake sees inactive intent and only reconciles pause; it must not repeat the completion handoff.

Owner pause/stop and turnover also disable the heartbeat. Retain an owner-pause flag so a supervisor cannot automatically re-arm afterward. Archive/pinning does not prove a timer stopped. Transfer ownership only after the old schedule is confirmed inactive.

Mission Control stays inactive after an end event until the owner requests a new cycle. A supervisor may reuse the same paused automation for a new cycle after the next authorized orchestrator/repair dispatch; record new scope and link prior status. Repeated monitor directives in an active cycle reuse it; do not duplicate heartbeats or reset history.
