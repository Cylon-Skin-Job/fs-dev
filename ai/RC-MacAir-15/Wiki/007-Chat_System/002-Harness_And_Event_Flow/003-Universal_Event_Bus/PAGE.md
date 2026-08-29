---
name: Universal Event Bus
description: Server cross-module pub/sub backbone used by chat lifecycle, persistence, fan-out, and automation.
metadata:
  incoming-edges:
    - Chat Harness And Event Flow
  outgoing-edges:
    - Chat WebSocket Protocol
  source-files:
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/lib/audit/audit-subscriber.js
    - fusion-studio-server/lib/wire/wire-broadcaster.js
  connected-skills: []
  related-trigger-files: []
---

The universal event bus is the server-side pub/sub backbone.

Chat lifecycle events, exchange persistence, WebSocket fan-out, metadata
collection, file mutation correlation, and future automations meet here.

## Chat Use

- Canonical chat appliers emit `chat:*` events.
- The audit subscriber persists turn-end exchanges.
- The broadcaster fans events out to WebSocket clients by `threadId`.
- Metadata collectors listen for relevant events without owning chat runtime.

RCC-0108 lifecycle events, including `chat:step_begin` and the safe error
`chat:turn_end`, use this existing `chat:*` compatibility bus. They do not enter
canonical-admission-only publication or ledger paths.

## Rule

Do not bypass the event bus for normal chat turn lifecycle. Do not put raw
provider protocol events on the bus.
