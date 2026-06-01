# Handoff: Kimi Stabilization - Dead Wire Recovery Before Next Legacy Slice

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A and B are already complete. Do not touch frontend cursor cleanup, pressure-gauge cleanup, renderer polish, catalog cleanup, vendor aliases, or future Write File filename/hourglass UI work in this slice.

This is a stabilization gate found during manual smoke. Kimi works in the terminal and was logged in, so do not treat this as a Kimi authentication issue.

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

Confirm:

```bash
git rev-parse --show-toplevel
git status --short
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

## Observed Failure

Thread under test:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/chat/threads/rccurtrightjr./2026-05-31T21-37-59-132.md
```

The user sent:

```text
Write a file to /users/rccurtrightjr./projects/fs-dev/ai/views/doc-viewer/captures/ explaining what you found.
```

The frontend showed a live `WriteFile` tool call, but no final assistant response appeared.

Known evidence:

- `fusion-studio-server/data/fusion.db` has the thread row with `status = suspended`, but only exchanges `seq = 1` and `seq = 2`; the write request did not persist as `seq = 3`.
- `ai/views/doc-viewer/captures/` was created, but no report file was written.
- Logs showed `TurnBegin`, then a `WriteFile` `ToolCall` with id `tool_W9UFYHmZXJ14h1mtKcloC81M`.
- There was no matching `ToolResult` for that `WriteFile`.
- There was no `TurnEnd` for that request.
- Shortly after the tool call started, logs showed:

```text
[SessionManager] Idle timeout for 2026-05-31T21-37-59-132
[Wire:legacy] Process 40331 exited with code null
[Wire] Session 95016f3b-f157-4801-8a2a-4ee1c14330c9 exited with code null
```

Then the user sent another request in the same thread. Logs showed:

```text
[WS →]: {"type":"prompt","scope":"project","threadId":"2026-05-31T21-37-59-132",...}
[WS] Message type: prompt Conn: 95016f3b Has wire: false Wire pid: none
[WS] PROMPT received: You got it hung up on your right file tool call la threadId: 2026-05- scope: project
[WS] Thread: 2026-05- Wire found: false
```

No subsequent wire spawn or `TurnBegin` was observed. The prompt handler currently sends only:

```text
No active wire for this thread. Please reopen the thread.
```

The client appears to leave the user request visually pending instead of recovering.

## Files Likely In Scope

Server:

- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/thread-ws-handlers.js`
- `fusion-studio-server/lib/thread/session-manager.js`
- `fusion-studio-server/lib/thread/ThreadManager.js`
- The wire lifecycle module used by `setupWireHandlers`, if that is where turn/tool activity can be observed.
- Existing server tests under `fusion-studio-server/test/`

Client, only if needed to clear a failed pending prompt:

- The WebSocket client/error handling code that receives `{ type: "error" }`.
- The chat state path that marks a user message as pending/sent/failed.

Do not broaden the slice into renderer animation behavior.

## Task

Fix the dead-wire recovery path caught by the smoke test.

Required outcomes:

1. A prompt sent to a known existing thread must not silently stall just because `getWireForThread(threadId)` returns no wire.
2. If a `threadId` is present and the wire is missing, the server should recover by reopening/resuming the thread through the same `thread:open-assistant` path, then send the prompt once the wire is ready.
3. If the server cannot reopen the thread, the client must receive a failure signal that clears or marks the pending user request instead of leaving it stuck.
4. The session idle timer must not kill an in-flight turn just because no user prompt was received for the idle window.
5. Wire activity should keep the session alive while a turn is actively producing protocol events or running a tool.
6. Once a turn reaches a terminal state, normal idle timeout behavior should remain intact.

Prefer reusing the existing `thread:open-assistant` implementation over adding a second wire-spawn path. If extraction is needed, keep it small and one-purpose.

## Important Code Pointers

`fusion-studio-server/lib/ws/client-message-router.js` currently handles prompts like this:

```js
const threadId = clientMsg.threadId;
const wire = threadId ? getWireForThread(threadId) : session.wire;

if (!wire) {
  ws.send(JSON.stringify({ type: 'error', message: 'No active wire for this thread. Please reopen the thread.' }));
  return;
}
```

`fusion-studio-server/lib/ws/thread-ws-handlers.js` owns the working reopen path in `thread:open-assistant`:

- `ThreadWebSocketHandler.handleThreadOpenAssistant(...)`
- `spawnThreadWire(...)`
- `registerWire(...)`
- `awaitHarnessReady(...)`
- `setupWireHandlers(...)`
- `initializeWire(...)`
- `wire_ready`
- `manager.openSession(...)`

`fusion-studio-server/lib/thread/session-manager.js` currently sets one timer on `openSession()` and only resets it when `touchSession()` is called. Confirm whether turn/tool wire events call `touchSession()` today. The observed logs suggest they did not.

## Acceptance Checks

Run these searches from repo root and report the results:

```bash
rg -n "No active wire for this thread|Please reopen the thread" fusion-studio-server fusion-studio-client
rg -n "touchSession\\(|Idle timeout for|openSession\\(" fusion-studio-server/lib
```

Expected:

- The old "reopen the thread" dead-end should either be removed or be reachable only after an attempted resume fails.
- There should be an intentional session activity path for live turns/tools, not only `openSession()`.

Add or update focused tests where practical. Good targets:

- Prompt with missing registered wire for an existing thread resumes/spawns the wire before sending.
- Prompt failure emits a client-visible failure/error state that does not leave the pending request stuck.
- Session idle timeout is extended/touched by wire activity during an active turn.

## Validation

Run server tests:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Run targeted lint or syntax checks for changed files. If the server package has no lint script, use the existing project validation pattern and report that no server lint script exists.

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

If client files are touched, also run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint <changed-client-files>
```

## Manual Smoke

After validation passes, restart Fusion:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Smoke sequence:

1. Reopen the thread `2026-05-31T21-37-59-132`.
2. Send a simple text-only prompt and confirm `TurnBegin` and `TurnEnd`.
3. Ask it to write a small report file under:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/doc-viewer/captures/
```

4. Confirm the UI shows the tool as complete only after `ToolResult`.
5. Confirm the file exists on disk.
6. Confirm `fusion.db` records the new exchange.
7. Kill/restart Fusion, reopen the same thread, and send another prompt. It should resume the wire or report a visible failure, not leave the user request stuck.

## Commit Guidance

If validation passes, make one commit for this stabilization slice only.

Suggested commit message:

```text
fix: recover prompts for suspended kimi threads
```

Do not include unrelated roadmap edits, renderer cleanup, UI filename/hourglass work, or user state files.

## Final Response Required

Report:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Commit SHA if committed.
- Files changed.
- Root cause found.
- Acceptance `rg` results.
- Tests/build/lint results.
- `git diff --check` result.
- Manual smoke coverage completed or skipped.
- Any code standards exception, risk, follow-up work, or blocker.
