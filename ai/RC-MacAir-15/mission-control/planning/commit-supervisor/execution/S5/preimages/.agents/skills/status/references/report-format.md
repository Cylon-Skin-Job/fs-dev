# Incremental status records

Use the caller's assigned report path. If no convention exists, use `status/current.md` and append-only `status/history.md` inside its owned memory/job folder, separate from other same-folder jobs. Do not create these live records during installation. Reuse existing ledgers/reports rather than copying full implementation evidence.

Each current report carries sequence/revision, previous report pointer, observed-at time, caller role/task identity when verified, work/cycle scope, source revisions/evidence paths, last progress, current hierarchy, retained holds/unknowns, changes since the prior report and structured events with responsible actor. Append transitions and material deltas to history. An unchanged check refreshes observed-at without inventing progress or duplicating long reports. One writer owns a report sequence; re-read current state before writing.

A new monitoring cycle refers to the same status history and last valid snapshot. It records a new cycle identity; it does not renumber work or erase completed slices. Reopening accepted work requires an invalidation entry identifying the affected revision/gate and reason. Missing sources retain last-known facts labeled stale/unknown.

## Detailed supervisor view

The supervisor reports roadmap → SPEC → slice. A SPEC Orchestrator reports its assigned SPEC → slices and detailed child-review state; it cannot certify other SPECs. For example (illustrative only, not a live assignment):

```text
TICKET-10001 — File System Monitor Rebuild
COMPLETE: SPEC 1 — Remove chokidar [accepted]
IN PROGRESS: SPEC 2 — New file watch system
  ✅ Slice 1 — … [accepted]
  ✅ Slice 2 — … [accepted]
  🔄 Slice 3 — …
     3rd clean-room pass [running; gate/actor/evidence linked]
  ⌛ Slice 4 — … [pending]
PENDING: SPEC 3 — Snapshot trigger
PENDING: SPEC 4 — Integration check
Changes since previous status: Slice 2 accepted; Slice 3 entered review.
```

Show review level and pass number only when evidenced. A clean pass at one gate is not final slice acceptance. Distinguish `reported complete`, `supervisor review`, `owner review` and `accepted`. Totals come from the current roadmap, including documented scope amendments.

## Mission Control view

Use compact summaries sourced from the responsible supervisor's current status, with linked detail. For example (illustrative only):

```text
TICKET-10001 — File System Monitor Rebuild
2 of 6 SPECs accepted
SPEC 3 in progress — Slice 3 of 4 in clean-room review

TICKET-10002 — …
ROADMAP COMPLETE — final checks and acceptance evidenced
Final report: <actual report path>
```

The examples depict different moments/scope; never combine their numbers into live status. Roadmap completion is a cycle-end event for Mission Control. Include its disposition (owner report, dependency hold or Review and Merge handoff) only from evidence; eligible for dispatch does not mean handed off. Status reports readiness; the role acts after monitoring stops.
