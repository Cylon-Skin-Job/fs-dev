---
name: Chat Thread Actions
description: Canonical path for user-initiated thread/session actions such as fork and compact.
metadata:
  incoming-edges:
    - Chat Harness And Event Flow
    - Architecture Routing
    - WebSocket Protocol Standards
    - Harness Adapter Standards
  outgoing-edges:
    - Chat WebSocket Protocol
    - Harness Boundary
    - Universal Event Bus
  source-files:
    - fusion-studio-client/src/components/chat/
    - fusion-studio-server/lib/ws/thread-ws-handlers.js
    - fusion-studio-server/lib/harness/
  connected-skills: []
  related-trigger-files: []
---

Thread actions are user-initiated operations on a thread or provider session.
They are not ordinary prompt text and they are not provider-native protocol.

Examples:

- `fork`
- `compact`

## Canonical Message

Thread actions should enter the backend through a canonical product message:

```json
{
  "type": "thread:action",
  "action": "compact",
  "threadId": "..."
}
```

Use canonical Fusion Studio action names. Do not name messages after provider
flags or command syntax.

## Ownership

Frontend:

- renders the action in the correct scope
- disables only for generic UI/runtime conditions
- sends canonical action intent

Backend thread action handler:

- resolves workspace, thread, scope, runtime state, and harness
- validates that the action is currently allowed
- delegates provider-specific syntax to the harness adapter
- persists Fusion-owned state through normal managers
- returns canonical success or error messages

Harness adapter:

- translates canonical action into provider syntax
- preserves provider session identity
- reports unsupported actions clearly

## Action Semantics

| Action | Product scope | OpenCode translation |
|---|---|---|
| `fork` | Create a new Fusion thread from current thread head | `opencode run --session <source> --fork` |
| `compact` | Compact provider context for future turns; visible Fusion history remains | `opencode run --session <id> --command compact` |

## Events

Thread actions are commands. They are not UEB events.

After an action changes durable state or session state, the backend may emit a
fact such as `thread:forked` or `thread:compacted` for subscribers and fan-out.

## Forbidden Bypasses

- frontend harness-specific checks such as `harnessId === "opencode"`
- one-off `thread:fork` or `thread:compact` handlers when `thread:action` fits
- provider CLI flags in frontend code
- direct DB mutation that skips thread managers or metadata paths
- treating compact as a per-reply action

## Required Tests

- frontend action sends canonical `thread:action`
- backend routes action through the thread action handler
- harness adapter receives canonical action and emits provider args
- unsupported harness/action returns visible canonical error
- restart/hydration behavior is covered when durable state changes

## Related Pages

- [Chat Harness And Event Flow(../000-Harness_And_Event_Flow/PAGE.md)
- [Chat WebSocket Protocol](../004-WebSocket_Protocol/PAGE.md)
- [Harness Boundary](../001-Harness_Boundary/PAGE.md)
- [Universal Event Bus](../003-Universal_Event_Bus/PAGE.md)
- [Architecture Routing](../../../005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md)
- [Harness Adapter Standards](../../../005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md)
