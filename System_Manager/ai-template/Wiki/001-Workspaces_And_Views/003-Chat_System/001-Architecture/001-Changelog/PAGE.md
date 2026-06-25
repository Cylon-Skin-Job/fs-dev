---
name: Chat System Changelog
description: Dated record of chat system architecture changes. Use this page to understand when runtime, harness, rendering, and UI behavior changed.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
  outgoing-edges:
    - Chat System Decisions
    - Chat System Lessons
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Dated architecture changes that matter for future work.

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
