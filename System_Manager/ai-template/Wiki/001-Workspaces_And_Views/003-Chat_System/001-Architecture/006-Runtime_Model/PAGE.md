---
name: Chat System Runtime Model
description: Explains how chat threads are opened, warmed, streamed, stopped, persisted, and resumed. Use this page when changing runtime state or thread lifecycle behavior.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
    - Chat System Protocol
  outgoing-edges:
    - Chat System Rendering Model
    - Chat System UI Surface
    - Chat System Decisions
  source-files:
    - fusion-studio-server/lib/thread/thread-crud.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/thread/thread-runtime-manager.js
    - fusion-studio-server/lib/thread/live-turn-snapshot.js
    - fusion-studio-server/lib/thread/HistoryFile.js
    - fusion-studio-server/lib/thread/ThreadIndex.js
  connected-skills: []
  related-trigger-files: []
---

How threads are opened, warmed, streamed, stopped, and persisted.

## Persistent Unit

The persistent unit is a thread.

| Table | Purpose |
|---|---|
| `threads` | Metadata: id, workspace, scope, view, name, harness, status, MRU |
| `exchanges` | Rich turn history: user input, assistant parts, metadata, sequence |

Markdown chat files still exist for compatibility and link/view workflows. The
rich renderer hydrates from SQLite exchanges.

## Workspace Open

When a workspace opens, the client requests the project thread list:

```json
{ "type": "thread:list", "scope": "project" }
```

If there is no active project thread and the list is non-empty, the client
passively opens the MRU thread:

```json
{ "type": "thread:open", "scope": "project", "threadId": "..." }
```

This hydrates history without spawning a harness.

## Passive Browse

Clicking an existing thread sends `thread:open`.

Server response:

- `thread:opened`
- rich exchange history
- optional `liveTurn` snapshot when the thread has an active in-memory turn

Passive browse must not warm, spawn, or kill a runtime.

## New Thread And Activation

New chat uses `thread:open-assistant` without a `threadId`:

```json
{ "type": "thread:open-assistant", "scope": "project" }
```

The server resolves the default harness from `ai/<machine>/System/config/cli.json`. In the
current OpenCode-only config, no explicit `harnessId` is needed.

`thread:open-assistant` is the assistant activation/create path:

1. If a valid `threadId` is supplied, resume/open that assistant thread.
2. If no valid `threadId` exists, create a new SQLite thread row.
3. Persist the resolved harness id on the thread.
4. Send `thread:created`.
5. Open and hydrate the thread.

Server-side policy rejects explicit disabled or absent harnesses for new thread
creation.

## Warm And Cold Runtime

Runtime state is centralized around:

```text
cold -> warming -> ready -> in_flight -> stopping
```

Intent to send can warm a cold runtime:

- input focus
- paste/insert into input
- send fallback
- automation prompt

Passive thread browsing does not warm.

## Prompt Acceptance

Prompt sending goes through `threadRuntimeController.acceptPromptThroughRuntime`.

Current flow:

1. Client sends prompt with `scope`, `threadId`, and `user_input`.
2. Server checks/warm runtime readiness.
3. Server rejects in-flight/stopping conflicts.
4. Server persists/accepts the user message.
5. Server emits `message:sent`.
6. Client commits the user bubble and clears accepted input.
7. Harness events stream through the canonical path.

The client no longer commits the user bubble optimistically on click.

## Live Turns

The runtime owns an in-memory `liveTurn` snapshot. Canonical events update this
snapshot through the same state path used for persistence.

When a user revisits a thread with an active turn, `thread:opened` can include
`liveTurn`. The client hydrates durable history first, then overlays the live
turn.

## Stop And Interrupt

Stop uses:

```json
{ "type": "turn:stop", "scope": "project", "threadId": "..." }
```

The server owns stop behavior:

- mark runtime stopping
- emit one synthetic interrupted canonical `turn_end`
- persist partial assistant parts through the normal turn-end path
- stop the harness process/session
- cool the runtime

The client should not locally finalize a stopped turn before the server's
terminal event.

## OpenCode Clean Exit Repair

Some OpenCode model paths emit useful content and exit code `0` without
`step_finish`. Fusion treats clean exit after useful output as a terminal event
and synthesizes canonical `turn_end` with metadata:

```text
terminalSource: "process_exit_missing_step_finish"
```

Nonzero exits, process errors, and clean exits with no useful output still fail.

## Automation

Automation hooks can send prompts without a focused UI. They use explicit
workspace/project/thread targets and the same runtime/canonical event path. They
do not call `ws.send` directly and should not interrupt in-flight user turns.
