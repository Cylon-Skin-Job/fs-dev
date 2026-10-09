---
name: Architecture Routing
description: Rules for finding and using existing dispatchers, interpreters, controllers, and service boundaries before adding new routes.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - WebSocket Protocol Standards
    - Universal Event Bus Standards
    - Harness Adapter Standards
    - Chat Thread Actions
  source-files:
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-server/lib/ws/thread-ws-handlers.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before adding a new user action, WebSocket message, backend
handler, service, event, or harness method.

## Rule

Find the existing owner before adding a path.

An implementation must identify the current dispatcher or interpreter for the
same category of work. If the existing owner cannot support the change, document
why before adding a new route or module.

## Required Questions

- What frontend action bridge or component owns this user intent?
- What backend router or domain handler receives this class of request?
- What service owns the state or persistence mutation?
- What adapter owns provider-specific syntax?
- What event, if any, should be emitted after the action succeeds?
- Which existing tests prove the full route, not just a helper?

## Allowed Path

Frontend code emits canonical product intent.

Backend routing resolves workspace, thread, runtime state, and ownership.

Domain services perform mutations through existing managers and persistence
helpers.

Adapters translate canonical intent into external provider, filesystem, or CLI
syntax.

Events are emitted after facts occur. Commands are not events.

## Forbidden Bypasses

- Adding a one-off WebSocket message when a domain action route exists.
- Adding frontend provider checks such as harness-specific IDs or config fields.
- Calling persistence directly when a manager owns mirrors or metadata.
- Putting UI behavior inside a harness translator.
- Emitting raw provider protocol onto the universal event bus.
- Adding a new service because it is convenient without checking the existing
  controller/service boundary.

## New Route Exception

A new route is allowed only when all are true:

- no existing dispatcher fits the action category
- the new route has a named domain owner
- the route uses canonical product vocabulary
- provider-specific syntax stays below the adapter boundary
- tests exercise the route from the public entry point

## Related Pages

- [Code Standards](../000-Code_Standards/PAGE.md)
- [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md)
- [Universal Event Bus Standards](../005-Universal_Event_Bus/PAGE.md)
- [Harness Adapter Standards](../006-Harness_Adapters/PAGE.md)
- [Chat Thread Actions](../../../007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md)
- [Chat WebSocket Protocol](../../../007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md)
