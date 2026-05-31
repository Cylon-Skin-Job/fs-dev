# Chat Threads & Turn Lifecycle

How Fusion Studio chat state is opened, streamed, rendered, and persisted. This replaces the older per-workspace session-scoping model and the separate turn-finalization note.

## Current Model

The persistent unit is a **thread**, not a workspace tab.

Project chat is universal across views in a workspace. Switching from one view to another does not create a new conversation identity. The same project thread list, current thread, and SQLite history follow the workspace. View-scoped thread support still exists in the code for special cases, but it is not the default mental model for normal chat.

Threads are stored in SQLite:

| Table | Purpose |
|---|---|
| `threads` | Thread metadata: id, workspace id, scope, view id, name, harness, status, MRU timestamp |
| `exchanges` | Rich turn history: user input, assistant parts, metadata, sequence number |

Markdown chat files still exist for compatibility and link/view workflows, but the rich chat renderer hydrates from SQLite exchanges.

## Opening A Workspace

When a workspace opens, the client requests the project thread list:

```
thread:list { scope: "project" }
```

The server returns MRU-ordered rows from SQLite. If the client has no active project thread and the list is non-empty, it auto-opens the MRU thread:

```
thread:open-assistant { scope: "project", threadId }
```

Opening a thread is also what happens when the user clicks a row in the threads list. The server resumes the thread, sends `thread:opened` with rich exchange history, then spawns and registers a wire process for that `threadId`.

## Starting A New Chat

New chat also uses `thread:open-assistant`, but without a `threadId`:

```
thread:open-assistant { scope: "project", harnessId }
```

That message is an upsert-style dispatcher:

1. If `threadId` exists and belongs to the requested scope, open it.
2. If no valid `threadId` exists, create a new SQLite thread row.
3. Send `thread:created`.
4. Immediately open it and send `thread:opened`.
5. Spawn the selected harness wire and send `wire_ready`.

This is why “click a thread” and “new chat” feel like one workflow: both converge on opening an assistant thread.

## Active Wire Routing

The server keeps a wire registry keyed by thread id:

```
threadId -> { wire, projectRoot, ws, workspaceId, viewId }
```

Prompt messages carry the target `threadId`. The server looks up the wire from the registry and sends the prompt to that process. Canonical chat events carry the same `threadId`, and the broadcaster routes them back to the owning client.

This is the important scoping rule: **events route by thread id first**. Workspace and view data describe context, but thread id is what prevents stream cross-contamination.

## Sending A Turn

Client path:

1. `sendMessage(text, "project", threadId)` appends the user message optimistically.
2. The websocket sends `prompt { scope, threadId, user_input }`.
3. Server records the user message for the active thread.
4. Server forwards the prompt to the registered wire.

Stream path:

1. Harness output becomes canonical `chat:*` events.
2. `wire-broadcaster` sends websocket events with `threadId` and `scope`.
3. `stream-handlers.ts` writes into `projectChats[threadId]`.
4. `LiveSegmentRenderer` reveals segments sequentially.

## Turn Finalization

Live rendering and API completion can finish in either order. The client handles that with two separate signals:

| Signal | Meaning |
|---|---|
| `turn_end` | The stream is done producing content |
| `revealedCount >= segments.length` | The UI has finished showing all live segments |

`turn_end` sets `pendingTurnEnd = true`. `LiveSegmentRenderer` uses an effect, not a stale callback, to finalize once both conditions are true.

Finalization is deliberately atomic in the client store:

- `currentTurn.status = "complete"`
- `pendingTurnEnd = false`
- message snapshot is ready for history rendering
- live `segments` are no longer treated as an in-flight turn

History rendering uses `InstantSegmentRenderer`, which reconstructs completed exchanges without live animation.

## Persistence

The server audit subscriber listens for turn completion on the event bus. On `chat:turn_end`, it writes the rich exchange into SQLite:

```
exchanges.thread_id
exchanges.seq
exchanges.user_input
exchanges.assistant = { parts: [...] }
exchanges.metadata
```

Metadata can include context usage, token usage, plan mode, and message ids. On thread open, `ThreadWebSocketHandler` reads those exchanges back and sends them to the client as `thread:opened.exchanges`.

## Invariants

- Thread ids are the routing key for live chat streams.
- Project chat state is keyed by `projectChats[threadId]` on the client.
- `thread:open-assistant` is the only create-or-resume entry point for assistant threads.
- `thread:opened` hydrates history before the next live turn.
- `wire_ready` fires for both new and resumed threads.
- `turn_begin` clears stale `pendingTurnEnd`.
- Completion detection belongs in a React effect that sees current `revealedCount`, `segments.length`, and `onRevealComplete`.
- A turn must not finalize just because the stream ended; it finalizes after live reveal catches up.

## Retired Model

The old “one CLI session per workspace tab” model is stale. Workspace files, workspace prompts, and model defaults still matter, but they are not the primary chat persistence boundary.

The current boundary stack is:

```
workspace -> project thread list -> thread id -> wire process -> turn -> exchange
```

That stack is what lets the same conversation follow the user across views while still preserving per-thread harness choice, history, and live stream routing.

## Files

| File | Role |
|---|---|
| `fusion-studio-server/lib/thread/thread-crud.js` | `thread:open-assistant` create/resume dispatcher |
| `fusion-studio-server/lib/ws/thread-ws-handlers.js` | Spawns wires for opened threads |
| `fusion-studio-server/lib/wire/process-manager.js` | Thread-keyed wire registry |
| `fusion-studio-server/lib/wire/wire-broadcaster.js` | Sends chat events to the owning thread client |
| `fusion-studio-server/lib/thread/ThreadIndex.js` | SQLite `threads` metadata |
| `fusion-studio-server/lib/thread/HistoryFile.js` | SQLite `exchanges` read/write |
| `fusion-studio-server/lib/audit/audit-subscriber.js` | Persists rich exchanges on `chat:turn_end` |
| `fusion-studio-client/src/lib/ws/thread-handlers.ts` | Hydrates thread lists and exchange history |
| `fusion-studio-client/src/lib/ws/stream-handlers.ts` | Routes live stream events into scoped chat state |
| `fusion-studio-client/src/state/slices/chatSlice.ts` | `projectChats[threadId]`, turn state, finalization |
| `fusion-studio-client/src/components/LiveSegmentRenderer.tsx` | Sequential live reveal and completion effect |
| `fusion-studio-client/src/components/InstantSegmentRenderer.tsx` | Completed thread/history rendering |
