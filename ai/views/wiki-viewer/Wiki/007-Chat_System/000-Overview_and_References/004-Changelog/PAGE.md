---
name: Chat Changelog
description: Dated record of chat system architecture changes. Use this page to understand when runtime, harness, rendering, and UI behavior changed.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Decisions
    - Chat Lessons
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Dated architecture changes that matter for future work.

## 2026-06-27

- Filename autocomplete ghost text no longer accepts on `Space`; only `Tab` and
  non-shift `Enter` accept the suggestion.
- The autocomplete ghost overlay was documented as a textarea-geometry mirror:
  typed prefix text is invisible and the suffix is visible so wrapping and cursor
  position stay aligned.
- OpenCode shell status normalization moved to the OpenCode harness translator.
  Command-duplicate titles such as `git status` are suppressed before canonical
  events reach the universal backend interpreter.
- Canonical `statusMessage` was clarified as optional displayable diagnostic
  text, not raw provider title/status text.
- Tool failures now keep normal collapsed chrome and route error body rendering
  through the shared tool-renderer error formatter.
- Live and history tool rendering paths now consume canonical status fields
  consistently.

## 2026-06-25

- Chat System became a top-level wiki domain at
  `ai/views/wiki-viewer/Wiki/007-Chat_System/`.
- The old Workspaces And Views chat page became a compatibility pointer.
- Domain articles were added for identity/persistence, harness/event flow,
  rendering/lifecycle, UI, user metadata, text/media payloads, testing, durable
  decisions, lessons, vision, changelog, and structure.

## 2026-06-20

- `Send to chat` changed from raw path insertion to removable link attachment
  pills above the composer.
- Filename autocomplete was added as plain text completion from RAM-only
  non-`.md` file candidates.
- Prompt payloads gained optional attachment metadata.
- Turn metadata gained collector-backed `attachments`, `mentions`, and
  `fileMutations` fields in SQLite exchange metadata.
- `exchange_metadata` broadcasts refresh client autocomplete candidates after
  turn-end persistence.

## 2026-06-07

- `cli.json` became the single harness policy.
- OpenCode-only config hides the harness picker.
- New Thread directly creates OpenCode-backed threads.
- Stale Kimi-default wording was removed from active docs/comments.

## 2026-06-06

- OpenCode clean-exit terminal repair added synthetic `turn_end` when OpenCode
  exits code `0` after useful output but without `step_finish`.
- OpenCode thinking/variant matrix showed visible thinking is model/profile
  specific.
- Only `openai/gpt-5.5 --thinking` and `openai/gpt-5.5 --thinking --variant high`
  were known-good visible-thinking profiles in that matrix.

## 2026-06-05

- OpenCode became selectable from the New Chat picker before the selector was
  later hidden by OpenCode-only policy.
- OpenCode durable session binding persisted `opencodeSessionId` in
  `threads.harness_config`.

## 2026-06-04

- Server-owned stop/interrupt persisted interrupted turns as partial exchanges.
- Automation hooks gained headless prompt support.
- Warm intent triggers were added for focus, paste, insertion, and send fallback.

## 2026-06-03

- Passive browse split from assistant activation.
- Runtime manager foundation added cold/warming/ready/in-flight/stopping states.
- Live turn snapshot overlay added for active background streams.
- Kimi wire runtime path removed in favor of canonical harness events.
- Frontend canonical tool names became the active contract.

## Earlier Cleanup

- Visible typing cursor removed.
- Frontend pressure gauge and instant reveal branch removed.
- Inactive segment renderer layer removed.
- Static chunk strategy layer removed.
