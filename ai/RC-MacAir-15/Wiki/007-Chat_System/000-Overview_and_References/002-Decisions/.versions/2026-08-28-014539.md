---
name: Chat Decisions
description: Durable decisions for Fusion Studio chat. Use this page before changing harness policy, runtime ownership, prompt acceptance, stop behavior, metadata, or thinking display.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Identity And Persistence
    - Chat Harness And Event Flow
    - Chat Rendering And Lifecycle
    - Chat Lessons
  source-files:
    - ai/<machine>/System/config/cli.json
    - fusion-studio-server/lib/cli-config/resolver.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/harness/opencode/index.js
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-server/lib/harness/types.js
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/lib/tool-renderers/index.ts
    - fusion-studio-client/src/lib/tool-renderers/shared/error-display.ts
    - fusion-studio-client/src/lib/tool-renderers/shell.ts
    - fusion-studio-client/src/lib/catalog-visual.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
  connected-skills: []
  related-trigger-files: []
---

Durable architectural decisions for chat.

## `cli.json` Is Harness Policy

`ai/<machine>/System/config/cli.json` controls default, allowed, and displayed harnesses.
Do not add a separate `harness-policy.json`.

## OpenCode Is The Current Normal-User Harness

The current config is OpenCode-only. New Thread creates OpenCode directly. Kimi
remains as implementation/plugin reference, but it is not displayed or allowed
for new thread creation unless `cli.json` is changed.

## Passive Browse Is Separate From Activation

Use `thread:open` for passive hydration. Use `thread:open-assistant` for
assistant activation and new thread creation.

## Server Owns Prompt Acceptance

The server accepts a prompt through runtime readiness and emits `message:sent`.
The client commits the user bubble after acceptance.

## `Send to chat` Is Attachment Metadata

`Send to chat` creates removable link attachment pills, not raw textarea path
text. The prompt can carry structured attachment metadata, and the harness sees
a compact attached-reference block.

Copy path/link controls remain separate and continue to copy paths.

## Filename Autocomplete Is Plain Text

Filename autocomplete inserts plain filename text only. It never creates an
attachment, mention object, or hidden metadata.

Autocomplete candidates are RAM-only and limited to files with extensions that
do not end in `.md`.

Autocomplete acceptance is explicit: `Tab` and non-shift `Enter` accept the
ghost suggestion. `Space` does not accept it, because space is needed to reject
the suggestion and keep typing a new word.

## Harness Adapters Normalize Tool Status

Provider-native status fields must be normalized in the harness adapter before
they reach the universal backend interpreter. `statusMessage` means optional
displayable diagnostic/status text; it is not a command label or raw provider
title.

For OpenCode shell calls, nonzero `metadata.exit` drives `isError`. If
`state.title` duplicates the shell command, the OpenCode adapter suppresses it
instead of letting the UI render the command twice.

## Tool Error Chrome Stays Neutral

Tool failures should not turn collapsed tool chrome into red error badges. Keep
the normal tool icon/label and render the failure inside the expanded dropdown.

`ToolCallBlock` does not receive `isError`; `lib/tool-renderers/index.ts` wraps
all tool renderers with the shared error formatter. Tool-specific context such
as command, file path, pattern, query, URL, or agent type belongs in the shared
error context catalog, not in one-off renderer branches.

## Exchange Metadata Is Collector-Based

`exchanges.metadata` stores turn metadata such as `attachments`, `mentions`, and
`fileMutations`. New extraction work should be added as a chat metadata
collector instead of growing runtime, audit, or persistence modules into a
monolith.

## Server Owns Stop

Stop emits a synthetic interrupted terminal event server-side and persists the
partial assistant turn through the normal persistence path.

## Live Snapshot Bridges Active Turns

Switching threads or workspaces should not stall a live turn. The server keeps
an in-memory `liveTurn` snapshot that the client overlays on durable history.

## Do Not Fake Thinking

Visible thinking requires actual thinking text. `tokens.reasoning` is usage
metadata, not a thought trace.

## OpenCode Clean Exit Can Synthesize Completion

If OpenCode exits code `0` after useful output but without `step_finish`, the
harness synthesizes `turn_end` and marks `terminalSource`.

## Existing Threads Are Not Migrated By Policy

Changing `cli.json` affects new thread creation and UI selection. It does not
rewrite existing `harness_id` values.
