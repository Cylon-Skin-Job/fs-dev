---
name: Harness Adapter Standards
description: Rules for provider-specific CLI/service adapters, canonical events, and canonical thread actions.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Architecture Routing
    - WebSocket Protocol Standards
    - Harness Boundary
    - Chat Thread Actions
  source-files:
    - fusion-studio-server/lib/harness/
    - fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before changing harness adapters, provider protocol translators,
CLI argument builders, or provider-specific session behavior.

## Rule

Harness adapters translate between canonical Fusion Studio intent/events and
provider-native syntax. Provider syntax does not leak upward into UI,
WebSocket product messages, or generic thread services.

## Adapter Responsibilities

- build provider CLI/API calls from canonical input
- translate provider output into canonical harness events
- preserve durable provider session identifiers behind `harness_config`
- report unsupported canonical actions clearly
- repair known provider stream gaps before events reach app state

## Not Adapter Responsibilities

- reply chrome behavior
- bookmarks, notes, copy actions, or UI metadata
- global product routing
- frontend disabled-state logic
- direct SQLite exchange persistence
- raw event bus emission of provider protocol

## Canonical Actions

Provider-backed session actions use product names such as `compact`.

Adapters map those names to provider-specific syntax.

Examples:

| Canonical action | OpenCode mapping |
|---|---|
| `compact` | `opencode run --session <id> --command compact` |

Fusion-owned group actions such as `move_chat_to_side` remain in the thread
domain service. They must not call a harness adapter because they create no
provider session, inherit no provider context, and translate to no provider
syntax.

## Required Checks

- What canonical action or event is being translated?
- Is provider syntax contained in the adapter?
- Does the adapter preserve session identity correctly?
- Does output become canonical before app state consumes it?
- Are unsupported actions visible and recoverable?
- Are tests written at the adapter boundary and through the public route?

## Related Pages

- [Code Standards](../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md)
- [Harness Boundary](../../../007-Chat_System/002-Harness_And_Event_Flow/001-Harness_Boundary/PAGE.md)
- [Canonical Events](../../../007-Chat_System/002-Harness_And_Event_Flow/002-Canonical_Events/PAGE.md)
- [Chat Thread Actions](../../../007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md)
