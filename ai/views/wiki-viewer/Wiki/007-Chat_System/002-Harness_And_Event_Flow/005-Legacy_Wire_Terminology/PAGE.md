---
name: Legacy Wire Terminology
description: How to interpret active files that still contain the word wire without falling back to old Kimi protocol paths.
metadata:
  incoming-edges:
    - Chat Harness And Event Flow
  outgoing-edges:
    - Harness Boundary
  source-files:
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-server/lib/wire/wire-broadcaster.js
  connected-skills: []
  related-trigger-files: []
---

Some active files still contain the word `wire`. In current chat architecture,
that usually means internal transport/fan-out or canonical event plumbing.

It does not mean new chat work should use old Kimi raw wire protocol paths.

## Do Not

- Add frontend raw Kimi aliases.
- Parse provider-native output in frontend code.
- Route bookmark, note, reply chrome, copy, TTS, or metadata behavior through
  `harness/kimi/*` or compatibility stdout paths.

## Do

- Use backend harness translators.
- Use canonical chat events.
- Use the universal event bus.
- Use WebSocket application messages.
- Use saved SQLite exchanges for durable turn identity.
