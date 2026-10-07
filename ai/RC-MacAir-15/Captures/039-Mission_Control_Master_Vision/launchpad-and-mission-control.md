# Launchpad and Mission Control

> Working synthesis of owner-directed vision. This records intended product behavior; it is not an approved roadmap, a claim about current Fusion implementation, or an instruction to migrate existing folders.

**Created:** 2026-09-28 (PDT)
**Track home:** [Mission Control — Master Vision](vision.md)
**Detailed flow:** [Launchpad and Work Folders](launchpad-and-work-folders.md)

## Why this capture

Launchpad and Mission Control are two halves of one entry surface, not two products. Launchpad is where work is named and opened; Mission Control is where work that needs the owner is surfaced and actioned. This capture records that relationship so the two are shaped together rather than drifting into separate designs.

## The two halves

| Half | Role | Primary interaction |
|---|---|---|
| **Launchpad** | Entry point at the top of every workspace template. Names and opens Work Folders. | Create/open a bounded body of work. |
| **Mission Control** | Launchpad's top thread. An attention list over agent activity and pending decisions. | Read a synopsis, then approve or reply in the linked chat. |

In the Code Workspace shape, Mission Control sits at the top of Launchpad, with **New Work Folder** beneath it.

## What Mission Control surfaces

The tabbed view is an attention list, not a build-runtime monitor:

1. Builds frozen because they need input.
2. Approvals needed before the next step (review, audit, merge).
3. Proposed merges awaiting a decision.
4. Housekeeping, including Wiki updates.

**CURRENT / UPCOMING** are presentation groupings: CURRENT needs attention now; UPCOMING waits on a named prerequisite (for example, "Update wiki — Pending Merge Acceptance"). Satisfying a prerequisite does not itself grant approval for the next action.

Mission Control exercises judgment over what to surface, how to prioritize and group it, and when to notify, adapting to the owner's instructions and the work's context. Underlying work approvals remain unchanged; monitoring never approves new scope or completes a gate.

## Where the attention layer lives

Attention/notification items live in the **app database**, each with a synopsis and a direct link into its associated chat. The intended flow is: open an item, read the synopsis, then approve or compose a response in the linked chat and hit Send. Work Folder documents retain their own role; this decision does not change document storage.

## Relationship to Work Folders

A Work Folder is one auditable object: its thread family and files belong to the same body of work, and its attention items, approvals, and responses connect to that work. Mission Control is how the owner regains awareness across those objects. Launchpad is where each object is opened and inspected.

## Open questions

- Whether one Mission Control oversees one workspace or a wider portfolio, and how other templates present it.
- How Launchpad/Work Folder navigation connects to the linked-chat action path.
- How attention records relate to work, role, assignment, chat-session, and checkpoint identities.
- How readable checkpoints support re-entry and account for work since the last checkpoint.

These remain shaping questions, not decisions. See [handoff.md](handoff.md) for the current resume point.
