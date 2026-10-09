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
    - fusion-studio-server/lib/harness/errors.js
    - fusion-studio-server/lib/harness/opencode/harness-diagnostic-redactor.js
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

## Step Activity And Failure Markers

OpenCode `step_start` and part `step-start` are translated to provider-neutral
`step_begin`. Shared runtime code never parses OpenCode event names. The event
means a fresh model generation/API step began; it is activity, not thinking
content.

Specific authentication, timeout, and process-exit classification also occurs
only inside the OpenCode boundary. It emits a closed `HarnessRuntimeError`
marker and may attach an already-redacted, allowlist-only V1 diagnostic
candidate. Shared code reconstructs the fixed transcript catalog from genuine
markers and treats every unmarked failure as generic. It never parses raw
provider codes, messages, names, causes, stacks, or lookalikes.

The adapter redactor replaces configured secrets and sensitive environment
values, credential/token/private-key/URL-userinfo patterns, and home/workspace
prefixes before a candidate crosses the boundary. Failure falls back to
structured-only fields; arbitrary provider objects are never traversed or
serialized.

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
