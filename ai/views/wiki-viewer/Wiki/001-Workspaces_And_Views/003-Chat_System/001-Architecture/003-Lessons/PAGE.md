---
name: Chat System Lessons
description: Recurring traps and learned constraints for chat system work. Use this page to avoid reintroducing stale Kimi-era, cursor, pressure, or fake-thinking behavior.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
    - Chat System Decisions
  outgoing-edges:
    - Chat System Runtime Model
    - Chat System Rendering Model
    - Chat System Protocol
  source-files:
    - fusion-studio-server/lib/harness/opencode/index.js
    - fusion-studio-client/src/components/LiveSegmentRenderer.tsx
    - fusion-studio-client/src/lib/ws/stream-handlers.ts
    - fusion-studio-client/src/hooks/useFileAutocomplete.ts
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
  connected-skills: []
  related-trigger-files: []
---

Things not to relearn.

## Exit Code 0 Is Not Turn End

OpenCode exit code `0` means the child process completed successfully. It does
not mean the model exposed reasoning, and it is not itself a canonical
`turn_end`.

## Reasoning Tokens Are Not Thinking Text

`tokens.reasoning` is usage metadata. Render a thinking block only when a
harness emits actual thinking text.

## Missing `step_finish` Is A Terminal Contract Gap

Some OpenCode endpoints emit useful output and exit cleanly without
`step_finish`. Repair that at the harness boundary with a marked synthetic
`turn_end`, not with a wait-and-kill timer.

## Browsing Is Not Send Intent

Clicking a thread should hydrate it. It should not warm, spawn, or kill runtime
sessions.

## User Bubble Is Post-Acceptance

Do not optimistically clear/commit user input before the server accepts the
prompt. Use `message:sent`.

## Live State Must Be Target-Aware

Sending/orb state must be keyed to the target thread. A background thread should
not light up the currently visible thread.

## Stop Must Preserve Partial Work

Stop should settle current assistant parts, persist a partial exchange, and
allow follow-up. It should not lose the assistant half of the exchange.

## Do Not Reintroduce Removed Cursor Layers

The visible typing cursor and cursor injection utilities were removed. Do not
bring them back while repairing reveal behavior.

## Do Not Rebuild Broad Mentions

Filename autocomplete is intentionally not an `@` mention system. Do not add a
modal picker, wiki/doc/ticket autocomplete, or broad repo search under this
feature.

## Keep Metadata Extraction Modular

Runtime, canonical chat application, audit persistence, and `HistoryFile` should
not own every metadata extraction rule. Add focused chat metadata collectors for
new fields such as entities, RAG keywords, symbols, or citations.

## Markdown Is Not A Filename Candidate

Autocomplete excludes `.md` files even when markdown resources are valid
send-to-chat attachments. This keeps filename completion focused on code/files.
