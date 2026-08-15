---
name: Harness Boundary
description: Where provider-specific harness output ends and Fusion Studio chat behavior begins.
metadata:
  incoming-edges:
    - Chat Harness And Event Flow
  outgoing-edges:
    - Canonical Events
    - Legacy Wire Terminology
  source-files:
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-server/lib/harness/types.js
    - fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
  connected-skills: []
  related-trigger-files: []
---

Fusion Studio is not a model provider. Harnesses are adapters.

The active default policy currently routes through OpenCode. OpenCode JSON
output is provider-native until the backend harness translator converts it into
canonical harness events.

## Rule

New chat features should consume canonical chat state or saved exchange state,
not provider-native harness output.

Do not add reply chrome, bookmarks, notes, copy actions, TTS, or metadata edits
to harness translators. Those features belong after canonical chat state and
SQLite persistence.

## Status Normalization

Provider-native tool titles, descriptions, process states, and exit metadata are
harness concerns until translated into canonical events.

For OpenCode shell results, `state.title` can be a command label such as
`git status`, while `metadata.exit` carries the reliable failure signal. The
OpenCode adapter must suppress command-duplicate status text and emit only
canonical displayable diagnostics in `statusMessage`.

The universal backend interpreter should receive provider-neutral fields such as
`output`, `statusMessage`, `isError`, `display`, `returnedDiff`, and `files`. Do
not add OpenCode-specific parsing to the universal interpreter.
