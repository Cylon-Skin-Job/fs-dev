---
name: Chat Harness And Event Flow
description: Boundary between provider harness output, canonical chat events, the universal event bus, and WebSocket application messages.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Harness Boundary
    - Canonical Events
    - Universal Event Bus
    - Chat WebSocket Protocol
    - Legacy Wire Terminology
    - Chat Thread Actions
  source-files:
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/lib/wire/wire-broadcaster.js
    - fusion-studio-server/lib/ws/client-message-router.js
  connected-skills: []
  related-trigger-files: []
---

Use this section before changing harness adapters, canonical chat events,
WebSocket message routing, or any feature that reacts to turn lifecycle.

## Flow

```text
provider/native harness output
  -> backend harness translator
  -> canonical harness events
  -> canonical chat event applier
  -> universal event bus chat:* events
  -> persistence, snapshots, and WebSocket fan-out
  -> frontend stream handlers
  -> renderer state and components
```

New user-facing chat features should attach after canonical app state exists.
They should not parse provider-native output or depend on historical Kimi
compatibility paths.

<!-- children:start -->
## Children

- [Harness Boundary](001-Harness_Boundary/PAGE.md) - Where provider-specific harness output ends and Fusion Studio chat behavior begins.
- [Canonical Events](002-Canonical_Events/PAGE.md) - Canonical harness and chat events used after provider-specific output has been translated.
- [Universal Event Bus](003-Universal_Event_Bus/PAGE.md) - Server cross-module pub/sub backbone used by chat lifecycle, persistence, fan-out, and automation.
- [Chat WebSocket Protocol](004-WebSocket_Protocol/PAGE.md) - WebSocket and canonical event contracts for Fusion Studio chat. Use this page when changing client/server messages, canonical harness events, stream routing, or chat-turn messages.
- [Legacy Wire Terminology](005-Legacy_Wire_Terminology/PAGE.md) - How to interpret active files that still contain the word wire without falling back to old Kimi protocol paths.
- [Chat Thread Actions](006-Thread_Actions/PAGE.md) - Canonical path for user-initiated thread/session actions such as fork and compact.
<!-- children:end -->
