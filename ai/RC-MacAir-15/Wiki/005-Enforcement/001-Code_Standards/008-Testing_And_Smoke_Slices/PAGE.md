---
name: Testing And Smoke Slices
description: Rules for vertical slices, focused smoke tests, route-level verification, and reporting residual risk.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Architecture Routing
  source-files:
    - fusion-studio-server/test/
    - fusion-studio-client/src/
  connected-skills: []
  related-trigger-files: []
---

Use this page before choosing tests for a feature, refactor, standards cleanup,
or smoke slice.

## Rule

Test the public route that users exercise, not only the helper that was easiest
to call.

## Slice Shape

A vertical slice should include:

- the narrow user intent or system trigger
- the public frontend or backend entry point
- the owning service or adapter
- the persistence or state side effect
- a focused smoke test before the next slice

## Required Coverage By Risk

| Risk | Required check |
|---|---|
| New WebSocket action | public message to backend result |
| New harness syntax | adapter args plus route-level smoke |
| Durable state write | restart/hydration or readback test |
| UI chrome move | client build plus stale-symbol sweep |
| Event bus change | emitted fact plus subscriber behavior |
| Refactor of routing | old bypass removed and canonical path exercised |

## Forbidden Test Gaps

- helper-only tests for routing changes
- tests that mock away the boundary being changed
- smoke tests that skip persistence readback when durability matters
- relying on TypeScript build to prove runtime protocol behavior
- ignoring known warnings without saying whether they are pre-existing

## Report Format

For each slice, report:

- changed files
- exact verification commands
- pass/fail result
- warnings and whether they are pre-existing
- residual risk or untested behavior

## Related Pages

- [Code Standards(../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md)
- [Harness Adapter Standards](../006-Harness_Adapters/PAGE.md)

