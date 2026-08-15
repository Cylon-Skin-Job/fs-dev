---
name: Events Assistant Query And Review Loops
description: How future workers can inspect conversations, tool calls, file versions, and failures to surface concrete improvements.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Events Provenance Model
    - Events Correlation And Causality
    - Events File Versioning
  source-files:
    - fusion-studio-server/lib/ledger/event-ledger-subscriber.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before designing assistant-facing ledger queries or automated review loops.

The long-term ledger goal is to let an assistant answer what changed, why it changed, which conversation or tool call was involved, and which nearby mutation likely caused a failure.

## Query Paths

```text
file version
  -> resource event
  -> UI action, tool call, harness run, automation run, or unknown external observation
  -> chat turn, trigger run, scheduler run, script run, or agent run where available
  -> nearby mutations by path, time range, correlation, or causation
  -> storm-batch/changeStorm records when nearby mutations were compacted
  -> before/after versions
  -> likely cause
```

Review loops should store compact evidence references and produce concrete recommendations: code fix, UI affordance, trigger adjustment, rule update, skill creation, or workflow change.
