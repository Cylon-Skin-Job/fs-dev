---
name: Universal Event Bus Standards
description: Rules for using the server-side universal event bus without confusing commands, facts, chat lifecycle, and provider protocol.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Architecture Routing
    - WebSocket Protocol Standards
    - Chat Universal Event Bus
  source-files:
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-server/lib/wire/wire-broadcaster.js
    - fusion-studio-server/lib/audit/audit-subscriber.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before emitting, subscribing to, or bypassing universal event bus
events.

## Rule

The event bus carries facts after something happened. It is not the command
transport for user requests.

## Event Shape

Use flat `domain:action` names.

Payloads use product vocabulary and include the smallest useful context:

- entity ID, such as `threadId`, `ticketId`, or `workspaceId`
- workspace or scope when ownership matters
- non-sensitive metadata needed by subscribers
- no raw secrets
- no raw provider protocol

## Chat Lifecycle

Normal chat turn lifecycle must go through canonical chat events and the
canonical chat applier. The applier emits `chat:*` facts that persistence,
metadata collectors, automation, and WebSocket fan-out can consume.

## Commands Versus Events

Commands enter through WebSocket handlers, controllers, or scheduled jobs.

Events are emitted after the command succeeds, fails, or changes state.

Examples:

| User request | Command path | Event/fact path |
|---|---|---|
| Send prompt | `prompt` WS message | `chat:*` lifecycle events |
| Compact thread | `thread:action` with `action: compact` | optional `thread:compacted` fact |
| Add secret | `secrets:*` WS handler | `secret:added` fact |

## Forbidden Bypasses

- emitting raw OpenCode, Kimi, or other provider events
- using the event bus as a request/response API
- persisting chat exchanges outside the canonical turn-end path
- emitting facts before the owning mutation succeeds
- adding listener side effects without loop and failure considerations

## Required Checks

- Is this a fact or a request?
- Who owns the mutation that makes the fact true?
- Which subscribers need the event?
- Could the event loop back into the same action?
- Does the payload expose secrets, prompts, or provider-native data?

## Related Pages

- [Code Standards(../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md)
- [Chat Universal Event Bus](../../../007-Chat_System/002-Harness_And_Event_Flow/003-Universal_Event_Bus/PAGE.md)
- [Canonical Events](../../../007-Chat_System/002-Harness_And_Event_Flow/002-Canonical_Events/PAGE.md)

