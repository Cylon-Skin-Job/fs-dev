---
name: Chat System Decisions
description: Durable decisions for Fusion Studio chat. Use this page before changing harness policy, runtime ownership, prompt acceptance, stop behavior, or thinking display.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
  outgoing-edges:
    - Chat System Runtime Model
    - Chat System Protocol
    - Chat System Lessons
  source-files:
    - ai/<machine>/System/config/cli.json
    - fusion-studio-server/lib/cli-config/resolver.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/harness/opencode/index.js
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
