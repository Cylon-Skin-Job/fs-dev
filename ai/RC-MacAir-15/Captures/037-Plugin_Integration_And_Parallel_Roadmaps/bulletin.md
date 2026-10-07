# Mission Control Bulletin

**Capture:** Mission Control working memory · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** proposed coordination surface; no active agent dispatches
**Updated:** 2026-09-24 (PDT)
**Trickle-down:** Mission Control coordination rules · **Roll-up:** material handoffs and unresolved coordination

> This bulletin is for cross-session coordination. It is not an authority source, a ticket tracker, a substitute for the registry or permission to expand an assignment.

## When to post

Post when another session could otherwise duplicate work, collide with a shared edit, remain blocked, or proceed using materially wrong context. Examples: an owner decision that unblocks work; a dependency/hold; a shared-target conflict; a material source/status change; an integration result and consumer handoff; or an assignment completion another session needs.

Keep detailed reasoning, SPEC evidence and ticket requirements in their owning documents. Do not post routine “still working” updates, questions answerable from the named source, or a second copy of the registry. Record a durable owner decision at its designated source and link it here only when coordination depends on it.

## Entry template

Copy for each new item; use a stable ID and do not recycle it. Update only your entry. Add an attributed resolution and retain the original summary.

### B-001 — Short coordination title

- **Type:** assignment / dependency / decision-needed / conflict / handoff / integration / resolution
- **State:** open / claimed / waiting / resolved / superseded
- **Owner:** Mission Control, named supervisor/agent, or owner decision required
- **Affected IDs:** roadmap / SPEC / slice / ticket / job IDs
- **Source:** authoritative record or evidence link, including revision/date when relevant
- **Summary:** what another session needs to know
- **Next action:** one bounded action and its owner
- **Due/check condition:** event or evidence that should trigger the next check; do not invent a deadline
- **Resolution:** append outcome, evidence and date when resolved

## Active coordination

No cross-session assignments are active yet. MC-T01 and MC-T02 are being handled sequentially in an owner-managed setup chat; their status belongs in the [registry](registry.md) and [TODO](todo.md), so they are not duplicated here.

## Resolved coordination

No bulletin entries have been resolved; the setup conversation's owner directions are recorded in the Mission Control guidance and handoff.
