---
name: Chat Thread Actions
description: Canonical path for user-initiated visible-thread and chat-session actions.
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

Thread actions are user-initiated operations on a visible thread group or one
underlying chat session. They are not ordinary prompt text and they are not
provider-native protocol.

Before Thread Groups replace the current route vocabulary, New Chat,
assistant activation/resume, Rename, Delete, Touch, Warm, and prompt-triggered
runtime activation are admitted only for a live
server-private `trusted-shell` connection. This transport guard does not trust
request fields or event/provenance metadata and does not replace the normal
workspace/thread ownership checks. Legacy Fork/context cloning is unavailable
for trusted and untrusted clients and is not part of the action taxonomy.
Public creation configuration is closed to portable `model` and `variant`
selection; stored Fork-era provider state is inert at runtime activation.

Examples:

- `move_chat_to_side`
- `compact`

## Canonical Message

Thread actions should enter the backend through a canonical product message:

```json
{
  "type": "thread:action",
  "action": "move_chat_to_side",
  "threadGroupId": "...",
  "expectedPrimaryThreadId": "..."
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

- resolves workspace, view, thread group, session membership, runtime state,
  and harness only when the action needs one
- validates that the action is currently allowed
- routes Fusion-owned group actions to the thread-group domain service
- delegates only provider-backed session actions to the harness adapter
- persists Fusion-owned state through normal managers
- returns `thread:action:completed` or `thread:action:error`
- fans committed state out to every window in the workspace

Harness adapter:

- translates canonical action into provider syntax
- preserves provider session identity
- reports unsupported actions clearly

## Action Semantics

| Action | Product scope | OpenCode translation |
|---|---|---|
| `move_chat_to_side` | Move the current primary session into a content tab and create a cold, empty primary peer in the same visible thread | none; Fusion-owned |
| `compact` | Compact provider context for future turns; visible Fusion history remains | `opencode run --session <id> --command compact` |

Group actions carry `threadGroupId`. Session actions carry `threadId` and may
also carry `threadGroupId` when membership must be checked. Live chat output
continues to route by `threadId`.

## Events

Thread actions are commands. They are not UEB events.

After an action changes durable state or session state, the backend may emit a
post-commit fact such as `thread:primary_changed` or `thread:compacted` for
subscribers. Fact publication never gates the action response or fan-out.

## Forbidden Bypasses

- frontend harness-specific checks such as `harnessId === "opencode"`
- one-off `thread-group:*` or `thread:compact` handlers when `thread:action` fits
- provider CLI flags in frontend code
- direct DB mutation that skips thread managers or metadata paths
- treating compact as a per-reply action
- routing `move_chat_to_side` through a harness adapter

## Required Tests

- frontend action sends canonical `thread:action`
- backend routes action through the thread action handler
- Fusion-owned actions use the group service and never invoke a harness
- provider-backed actions reach the adapter and emit provider args
- unsupported harness/action returns visible canonical error
- restart/hydration behavior is covered when durable state changes
- multi-window clients receive the same committed primary transition

## Related Pages

- [Chat Harness And Event Flow](../PAGE.md)
- [Chat WebSocket Protocol](../004-WebSocket_Protocol/PAGE.md)
- [Harness Boundary](../001-Harness_Boundary/PAGE.md)
- [Universal Event Bus](../003-Universal_Event_Bus/PAGE.md)
- [Architecture Routing](../../../005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md)
- [Harness Adapter Standards](../../../005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md)
