---
name: Chat Lessons
description: Recurring traps and learned constraints for chat system work. Use this page to avoid reintroducing stale Kimi-era, cursor, pressure, broad mention, or fake-thinking behavior.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
    - Chat Decisions
  outgoing-edges:
    - Chat Rendering And Lifecycle
    - Chat Harness And Event Flow
    - Chat Decisions
  source-files:
    - fusion-studio-server/lib/harness/opencode/index.js
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-client/src/components/LiveSegmentRenderer.tsx
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/lib/tool-renderers/shell.ts
    - fusion-studio-client/src/lib/ws/stream-handlers.ts
    - fusion-studio-client/src/lib/ws/tool-result-helpers.ts
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

## Space Is Typing, Not Autocomplete Acceptance

Do not bind `Space` to ghost-text acceptance. Users need space to reject an
inline suggestion and keep composing a new word. Use explicit acceptance keys
such as `Tab` and non-shift `Enter`.

## Ghost Text Must Share Textarea Geometry

Inline ghost text should be positioned by mirroring typed prefix text, wrapping,
font size, font family, and line height. Do not guess from container width or
append a floating suffix based on rough measurements.

## Do Not Classify Tool Errors By Output Text

Words such as `fatal`, `error`, or `denied` are not the error contract. Use
canonical `isError` from the harness adapter, derived from reliable provider
signals such as exit code or explicit error state.

## Do Not Put Harness Status Heuristics In The Universal Interpreter

OpenCode-specific fields such as `state.title`, `metadata.exit`, and command
arguments belong in the OpenCode translator. The canonical backend interpreter
should receive normalized `output`, `statusMessage`, `isError`, and related
provider-neutral fields.

## Do Not Duplicate Shell Commands As Status Text

If a shell result already shows `$ git status`, a trailing red `git status` is
not a diagnostic. Suppress command-label status at the adapter boundary and keep
renderer-level dedupe as a defensive presentation guard.

## Do Not Add Per-Tool Error Chrome

Tool error state is canonical data, not a per-tool chrome style. Keep collapsed
tool chrome neutral and route all error body rendering through the shared
tool-renderer error formatter. Add tool-specific command/path/pattern/query/URL
context to the shared catalog instead of adding renderer-local error branches.

## `--thinking` And `--variant` Are Different Controls

`--thinking` controls visible thinking blocks. `--variant` controls provider
reasoning effort (high, max, minimal). They can interact but one does not imply
the other. Do not enable visible thinking globally; treat it as a model/profile
capability until proven stable for a specific model/variant combination.

## Free Or Weak Endpoints May Need Degraded Behavior

Some endpoints support enough OpenCode protocol to return text but not enough
for a complete stream contract. Classify model profiles by observed behavior:
visible thinking supported, stable terminal stream, useful text with missing
terminal event, error, or hang/timeout. Route product behavior based on the
profile, not assumptions about a provider or model family.

## Harness Visibility Has Three Separate Gates

A harness must pass all three to be selectable in the UI: runtime registry
(`lib/harness/registry.js`), picker catalogs
(`client config/harness.ts` + `server lib/cli-config/catalog.js`), and
install-status probe (`/api/harnesses`). Registration alone is not enough.

## `cli.json` Is Harness Policy

`cli.json` is the workspace harness policy, not a cosmetic catalog override.
`defaultHarness` sets the harness for new threads with no explicit
`harnessId`. `harnesses` is the allow-list with `enabled` flags. Missing or
empty config falls back to OpenCode-only (hides the selector). Do not add a
separate `harness-policy.json`; one file owns policy and display metadata.

## Default Harness Switch Gates

Before switching the default harness, verify: thread creation from
OpenCode-only `cli.json`, text streaming, tool calls, stop/interrupt,
per-thread session continuity through cold restart, missing-terminal repair,
existing threads keep their `harness_id`, and explicit `harnessId` still wins.
The switch should change the default for new threads only, not migrate
existing ones.
