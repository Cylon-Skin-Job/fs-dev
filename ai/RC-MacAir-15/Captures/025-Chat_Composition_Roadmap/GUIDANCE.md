# Chat Composition Implementation Guidance

## 1. Execution Boundary

This bundle authorizes planning only until the owner approves the exact release
candidate. After approval, each SPEC may be executed only in roadmap order and
only after every named external and internal prerequisite is accepted.

Do not implement product code from the Roadmap Creator session. Preserve all
unrelated user and worker changes in dirty worktrees.

## 2. Required Builder Lifecycle

For every slice, the SPEC orchestrator assigns one fresh `spec-slice-builder`.
That builder:

1. reads the accepted SPEC, this guidance, its accepted baseline, routed Code
   Standards, relevant Chat Wiki pages, and current code/tests;
2. implements the entire slice, including mechanically necessary integration
   omitted from an expected-path list;
3. preserves unrelated work and records every deviation;
4. self-reviews and runs the required checks;
5. repairs validated findings forward;
6. may spawn only fresh `clean-room-reviewer` agents, never another builder;
7. continues builder-owned review until the first materially clean current-byte
   pass, without an arbitrary pass ceiling; and
8. returns `READY_FOR_ORCHESTRATOR_REVIEW` with changed paths, exact commands,
   results, warnings, residual risks, and deviations.

A new slice receives a fresh builder. Descendants inherit the invoking root
thread's model and reasoning effort.

## 3. Required Orchestrator Lifecycle

The SPEC orchestrator independently inspects every returned slice and uses fresh
`clean-room-reviewer` passes. It stops at the first clean current-byte pass and
otherwise routes repairs through the owning builder until clean.

Material acceptance repairs return through a builder, fresh builder-owned
review, and fresh orchestrator-owned review. The orchestrator reports every
deviation and downstream effect. It cannot declare owner acceptance.

The implementation supervisor independently reviews the completed SPEC and
presents it to the owner. Only explicit owner acceptance permits the next SPEC.

## 4. Baselines And External Gates

- SPEC-00 baseline is the final owner-accepted Agent Tool Provenance result,
  rebased/integrated into the implementation checkout. It also records the
  accepted TABS-03 identity as a protected non-owned baseline and re-inventories
  any overlapping bridge paths without editing bridge contracts.
- SPEC-01 baseline includes accepted SPEC-00, approved BRIDGE-01/BRIDGE-02,
  and the owner-released accepted Tab Platform milestone. Determine the next free
  migration from that accepted database chain; do not rename an already-run
  migration or assume the planning worktree's number is still free.
- SPEC-02 baseline includes accepted SPEC-01 and the final independently
  accepted Generic Component Tab Host commit/report. Partial files and passing
  Slice-1 tests do not satisfy that gate.
- SPEC-03 baseline is accepted SPEC-02.
- SPEC-04 baseline is accepted SPEC-03 and all prior accepted dependencies.

Before each SPEC, record the exact baseline commit, prerequisite reports, dirty
paths, migration head, and affected accepted tests.

## 5. Deviation Policy

Mechanically necessary omitted integration is permitted and must be documented.
A deviation may not silently:

- change user-visible Main Chat or Side Chat behavior;
- conflate group, session, turn, exchange, surface, tab, component, or placement
  identity;
- weaken server ownership or Provenance retention;
- add Fork/context cloning;
- add a new WebSocket family when the accepted route fits;
- move view configuration, Collections, plugin behavior, Pending New Chat, or
  protected-System permissions into this roadmap;
- weaken SPEC-00's narrow trusted-shell command gate or expand it into a general
  remote authentication platform;
- modify an accepted external prerequisite's contract; or
- begin a later SPEC's behavior early.

A material contract change requires an updated roadmap candidate, affected
fresh review, and owner approval before implementation continues.

## 6. Testing And Isolation

Use temporary databases, profiles, and workspaces. Never run migration or
destructive fixtures against `fusion-studio-server/data/fusion.db`, the Alpha
profile, or user workspace chat history.

Every public behavior slice must test the real public route and its owning
service/state effect. Durable behavior requires restart/readback. Multi-window
actions require requester acknowledgement, authoritative fan-out, failed-
recipient isolation, and reconnect convergence. Cross-store behavior requires
injected second-store failure plus deterministic repair.

The minimum whole-SPEC commands are:

```bash
cd fusion-studio-server && npm test
cd fusion-studio-client && npm run build
```

Each SPEC adds its exact targeted Jest/Playwright commands and an Electron smoke
when shell composition, focus, full-screen, tabs, or cross-window behavior is in
scope.

## 7. Completion Vocabulary

- `READY_FOR_ORCHESTRATOR_REVIEW`: builder and builder-owned review are clean.
- `READY_FOR_SUPERVISOR_REVIEW`: integrated SPEC and orchestrator-owned review
  are clean.
- `AWAITING_OWNER_ACCEPTANCE`: supervisor has presented the result.
- `ACCEPTED`: owner explicitly accepted the completed SPEC.
- `BLOCKED`: genuine execution impossibility, not a failing test, finding,
  dirty worktree, changed hash, difficult repair, or incomplete work.
