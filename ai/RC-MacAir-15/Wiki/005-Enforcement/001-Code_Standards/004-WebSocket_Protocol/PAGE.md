---
name: WebSocket Protocol Standards
description: Rules for WebSocket message additions, canonical client intent, backend routing, and handler ownership.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Architecture Routing
    - Universal Event Bus Standards
    - Chat WebSocket Protocol
  source-files:
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-client/src/lib/ws/
    - fusion-studio-client/src/types/index.ts
  connected-skills: []
  related-trigger-files: []
---

Use this page before adding or changing WebSocket message types, client message
handlers, backend route handlers, or shared message types.

## Rule

WebSocket messages are product protocol. They carry canonical Fusion Studio
intent and state, not provider-specific syntax.

## Allowed Path

Client code sends a canonical message through the existing WebSocket client or
domain action bridge.

The server message router delegates to the existing domain handler group.

The domain handler resolves ownership and calls services or adapters.

Server responses use existing handler families where possible.

## Adding A Message

Before adding a message type, prove why one of these does not fit:

- existing domain message family
- `thread:action` for thread/session actions
- `prompt` for user text sent to a thread
- `chat-turn:*` for saved exchange metadata
- an existing workspace, file, clipboard, or harness handler family

## Forbidden Bypasses

- one-off messages for actions that fit an existing domain action path
- frontend message types named after provider flags or CLI syntax
- server handlers that directly mutate persistence without the owning service
- backend responses that bypass existing client handler families
- unredacted logs for messages carrying credentials, prompts, or provider data

## Required Checks

- Is this a command/request or an event/fact?
- Which router owns this message family?
- Which client handler hydrates the response?
- Does the shared TypeScript type include the new message?
- Does the redaction map need an entry?
- Is there an integration test from public WS message to result?

## Related Pages

- [Code Standards(../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [Universal Event Bus Standards](../005-Universal_Event_Bus/PAGE.md)
- [Chat WebSocket Protocol](../../../007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md)
- [Chat Thread Actions](../../../007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md)

