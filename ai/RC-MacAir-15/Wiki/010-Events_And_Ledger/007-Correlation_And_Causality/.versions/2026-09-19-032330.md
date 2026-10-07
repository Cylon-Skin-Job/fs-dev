---
name: Events Correlation And Causality
description: How the system links watcher observations to UI actions, tool calls, trigger runs, scheduler scripts, and nearby file versions.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Events Provenance Model
    - Events File Versioning
  source-files:
    - fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before adding heuristics that connect file mutations to possible causes.

Direct causal IDs are preferred. Correlation is a fallback when the system observed related events close together but cannot prove causation.

Every direct ID below must come from the accepted canonical reference for its upstream event. A raw runtime/provider/candidate ID is not a canonical cause. Without an accepted reference, correlation may record evidence and a justified origin type/confidence, but it omits ID-bearing origin, cause fields, mirrors, and edges.

## Priority Order

1. Direct UI action ID.
2. Direct assistant tool call ID.
3. Direct harness cause identity: `provenance.cause.harnessId`, `provenance.cause.harnessRunId`, or `provenance.cause.harnessEventId`.
4. Direct automation cause identity: `provenance.cause.automationRunId`, with trigger, scheduler, script, sync, import, or agent run IDs as subtype/index helpers when present.
5. Server API mutation ID.
6. Watcher observation correlated by path, time window, active operation, or content hash.
7. External or unknown.

Correlated attribution must record confidence. It should not pretend to be direct proof or promote an unaccepted raw ID into canonical provenance.
