---
title: View Spec — Chat
created: 2026-03-28
updated: 2026-06-03
status: active
parent: MASTER_SYSTEM_SPEC.md
absorbs: SPEC.md (thread management), thread-system-README.md, RICH_STORAGE_FORMAT.md, chat-renderer-rebuild.md, CHAT_RENDER_SPEC.md
---

# Chat View

Chat is not a standalone workspace — it attaches to workspaces. Every workspace can have a chat. The chat type and display mode depend on the workspace.

---

## Chat Folder Structure

A `chat/` folder anywhere defines chat behavior. The folder contains:

```
ai/<machine>/Views/{workspace}/chat/
  chat.json              ← chat type config
  MEMORY.md              ← persistent memory (agent can write)
  TRIGGERS.md            ← chat-specific triggers (agent can write)
  settings/
    PROMPT.md            ← agent identity (human-deployed only)
    SESSION.md           ← CLI profile, tools, DB access (human-deployed only)
    archive/             ← prior versions auto-archived on replacement
      PROMPT-2026-03-28T14-30-00.md
      SESSION-2026-03-27T10-00-00.md
  threads/
    index.json           ← sort/filter config (by date, name, last-active, custom)
    {username}/
      refactor-auth.md   ← human-readable thread receipt
      fix-deploy-bug.md
    {collaborator}/
      review-endpoints.md
```

`threads/index.json` is the single source of truth for how threads appear — drives both the UI sidebar thread list and the markdown folder ordering. Sort by date, name, last-active, or custom order.

### Settings Folder (Human-Only Zone)

**Any folder named `settings/` is permanently write-locked for AI.** This is a system-wide enforcement rule hardcoded in the server — not configurable, not trigger-driven. The AI can read from settings/ but can never write to it.

PROMPT.md and SESSION.md live inside `settings/` to ensure the AI cannot modify its own identity or permissions without human review.

**Deploy flow:**
1. AI generates a new PROMPT.md or SESSION.md and drops it in the `chat/` folder (not settings/)
2. A trigger detects the new file and shows a drag-to-deploy modal overlay
3. The user drags the file from the preview panel to the settings/ drop target
4. The server archives the prior copy to `settings/archive/` and moves the new file in
5. The modal dismisses and the new configuration is live

**Archive pattern:** When a file is deployed to settings/, any existing file with the same name is moved to `settings/archive/FILENAME-{ISO-date}.md`. This creates an immutable audit trail.

### Chat-Level Files

For **daily-rolling** chats, PROMPT.md and SESSION.md in `settings/` define the agent's behavior. MEMORY.md and TRIGGERS.md live in the chat root where the agent can write to them. MEMORY.md is written to at nightly rollover when the day transitions.

For **threaded** chats, MEMORY.md is loaded before context compression when resuming a thread — it acts as a refresher of key context.

---

## Two Storage Layers

### SQLite (machine layer)
- Wire protocol structural data
- Session state and resource tracking
- Renders the live chat UI
- Source of truth for the running app

### Markdown (human layer, in repo)
- Human-readable receipt of each thread
- Lives in per-user folders inside the chat's `threads/` directory
- Portable — push repo, collaborators pull your threads
- Format matches existing CHAT.md (frontmatter + User/Assistant blocks)
- `threads/index.json` controls sort order for both UI and folder

```
ai/<machine>/Views/code/chat/threads/
  index.json            ← sort config
  rcc/
    refactor-auth.md
    fix-deploy-bug.md
  collaborator/
    review-endpoints.md
```

---

## Chat Types

### Three Thread Strategies (all built)

| Strategy | Folder Convention | Behavior | Used By |
|----------|-------------------|----------|---------|
| `daily-rolling` | `chat/` | One thread per day, auto-created, date-named. Old threads viewable but not resumable. | Agent personas, issues panel |
| `multi-thread` | `threads/` | Named conversations, MRU ordered, manual creation. User picks or creates. | Explorer panel, code workspace |
| `single-persistent` | (auto) | One thread always. No list, no creation UI. | Project-root agent (future) |

Configured in SESSION.md via `thread-model` field. Strategy modules in `lib/thread/strategies/`.

### Thread Lifecycle

```
Create/select thread -> Cold (durable history only)
  -> send intent / automation intent -> Warming
  -> runtime ready -> Ready
  -> prompt sent -> In flight
  -> turn_end / interrupt -> Ready or Cold
```

**What's built:**
- [x] All 3 thread strategies implemented (daily-rolling.js, multi-thread.js, single-persistent.js)
- [x] ThreadManager with session lifecycle (active/suspended, FIFO at 10)
- [x] ThreadIndex (threads.json) with MRU ordering
- [x] Idle timeout (9min default, configurable via SESSION.md)
- [x] Wire process spawn with `--session {threadId}` for resume

The built FIFO/idle-timeout behavior is an implementation detail from the older
warm-session model. The required lifecycle is now intent-based: in-flight turns
are protected, idle threads may go cold, and warm retention/FIFO are optional
future optimizations if cold-start measurements justify them.

### Background Thread Runtime and Reconnectable UI

The live thread runtime is the source of truth for streaming progress. React
state is only a projection of that runtime. A visible chat component may mount,
unmount, hide, or switch to another thread without pausing, killing, retargeting,
or slowing the running harness turn.

Required behavior:

- A user can browse other threads while a thread is streaming. The original
  stream continues in the background.
- Returning to a streaming thread shows the latest known state, not the last
  token that happened to be visible before the user navigated away.
- If the turn completed while the user was away, returning to that thread shows
  a completed turn immediately.
- Switching workspaces unsubscribes the UI from the visible stream, but does not
  kill an in-flight autonomous process. A user may return after 30 minutes and
  inspect what happened during that time.
- In-flight turns are never eligible for idle cleanup. They stay running until
  completion, user interrupt, harness failure, or explicit application shutdown.
- Idle threads may go cold after completion. Warm idle retention is an
  optimization, not a required lifecycle policy.

This requires separating four concepts that older code paths often conflate:

| Concept | Meaning |
|---|---|
| Selected thread | The thread the UI is currently showing. |
| Hydrated history | Completed exchanges loaded from durable storage. |
| Active harness thread | The thread with a live CLI/runtime session. |
| Live turn route | The pinned `workspace + scope + threadId + turnId` for an in-flight assistant response. |

`thread:open` is a browse/hydrate operation. It must not spawn, kill, close, or
retarget a harness runtime. Harness activation happens when the user sends a
prompt or explicitly warms a session.

Cold threads do not warm merely because the user selected or browsed them.
Warm-up requires send intent:

- the user focuses/clicks into the chat input,
- the user inserts text through one of the composer helper buttons,
- or the user presses send while the thread is still cold.

If the user presses send against a cold thread, the UI should enter a connecting
state, warm/resume the harness session, then show the message as sent and start
the orb once the runtime is ready. The send button must not imply that a prompt
has reached the harness until the session is warm enough to accept it.

When a prompt starts, the server captures the live turn route. Every content,
thinking, tool, status, subagent, and turn-end event for that assistant response
uses the captured route until completion. Event routing and assistant-message
persistence must not read mutable "currently selected thread" state while a turn
is in flight.

### Live Snapshot Model

Completed exchanges live in durable storage. Active or recently completed turns
live in a server-side live snapshot layer until they are safely persisted and
the client has had a chance to reconcile.

Opening a thread should return completed history plus any live overlay:

```ts
{
  threadId: string;
  exchanges: Exchange[];
  liveTurn: LiveTurnSnapshot | null;
  streamSeq: number;
}
```

The client hydrates completed exchanges first, then overlays `liveTurn` if
present. `turnId`, `messageId`, or another stable exchange key must prevent
duplicate display when a turn completes while the client is away and is then
loaded from durable history.

The server should retain enough live event/snapshot state for reconnecting
clients to fast-forward to the current point in the stream. The client should not
depend on hidden React components continuing to animate.

### Interrupt / Stop Semantics

The stop button is a user interrupt, equivalent to pressing Escape in an
interactive CLI. It is not a client-only render shortcut and it must not discard
the current exchange.

Required stop behavior:

- Stop immediately ends the active assistant turn from the user's perspective.
- Whatever assistant content, thinking, and completed tool results have already
  been produced becomes a real assistant response.
- The partial assistant response is persisted to durable history with explicit
  interruption metadata.
- The UI fast-renders everything already received, clears the active spinner/orb
  state, and allows the user to send the next prompt.
- Refreshing after stop shows the interrupted assistant response between the
  user prompt and the next user prompt. It must not collapse into two adjacent
  user bubbles with no assistant exchange.
- The harness/runtime must be left in a known state. If the underlying CLI
  supports cooperative interrupt, use that. If it only supports process
  termination, terminate and respawn/resume deliberately before accepting the
  next prompt.

Stopping a turn should produce a terminal event with an explicit reason, for
example:

```ts
{
  type: "turn_end";
  reason: "interrupted";
  partial: true;
  threadId: string;
  turnId: string;
  fullText: string;
  parts: AssistantPart[];
}
```

The server-side live turn snapshot owns this operation because it has the
authoritative accumulated assistant parts. Client-side `finalizeTurn()` may
complete local rendering, but it is not sufficient for persistence or harness
state management.

After an interrupt, the next prompt must start from a coherent history:

```text
User prompt A
Assistant partial response A (interrupted)
User prompt B
Assistant response B
```

The system must not persist only the user side of an interrupted exchange while
the harness retains private memory of the partial assistant side. That creates a
split-brain history where the CLI context and SQLite history disagree.

### Intent-Based Cold/Warm Lifecycle

The required lifecycle model does not depend on a warm-retention countdown.
Threads can safely go cold when they are idle, as long as resume is reliable and
send intent warms the runtime before prompt delivery.

Default policy:

- In-flight turns stay running and are never cleaned up merely because the user
  navigated away.
- Passive thread browsing does not warm a cold thread.
- Send intent warms or resumes the thread.
- If the user presses send while the thread is cold, the UI shows a connecting
  state, warms the harness session, then delivers the prompt.
- Ticket/status automation warms the target thread before injecting a `Status`
  prompt.
- A future warm pool, FIFO policy, or countdown may be added only if measured
  cold-start latency or automated orchestration load proves it is needed.

The runtime should still emit lifecycle events so future UI, orchestration, and
diagnostics can observe state without coupling to harness internals. Possible
event vocabulary:

```ts
thread:warming
thread:ready
thread:cold
thread:in_flight
thread:interrupted
thread:state_changed
```

If a warm-retention countdown is added later, it is only a projection of runtime
lifecycle state. It should not become the mechanism that preserves or kills a
session.

### Orchestration And Background Agent Requirements

The chat/runtime model must support future orchestrated background work where a
primary orchestrator delegates slices through the ticketing system to narrower
agents such as worker, validator, and reviewer.

Expected future workflow:

1. The orchestrator creates or updates an issue ticket with a slice handoff for a
   worker profile.
2. The worker completes the slice and returns a result report.
3. The orchestrator files follow-up validation work for a validator profile with
   clean context and narrowed acceptance checks.
4. The validator report feeds a reviewer profile that applies code standards,
   brittleness checks, and broader implementation heuristics.
5. The orchestrator receives each result and decides whether to repair, accept,
   or create the next slice.

Ticket status automation can inject a `Status` prompt into the orchestrator chat:

- automatically after 15 minutes of no ticket completion,
- immediately when the ticket completes,
- and potentially on explicit user request.

This requirement depends on the background runtime model: orchestrator and worker
threads may need to continue running without being visible. Idle orchestration
threads can go cold as long as ticket/status automation warms them before sending
the next prompt.

### Implementation Direction

Start with a narrow server-owned `ThreadRuntimeManager` foundation rather than a
tactical patch on the current WebSocket-owned session model.

The first implementation slice should establish ownership and fix the visible
runtime bugs without attempting the full orchestration system.

Initial server scope:

- Add a focused thread runtime manager keyed by `workspaceId + scope + threadId`.
- Move prompt delivery through the runtime manager.
- Let the runtime own the live turn snapshot.
- Pin live turn route identity at prompt acceptance.
- Emit chat events from the runtime with explicit route identity.
- Handle stop as a server-owned interrupt that emits `chat:turn_end` with
  `reason: "interrupted"` and `partial: true`.
- Make browse-only `thread:open` select/hydrate without spawning, killing,
  warming, closing, or retargeting harness runtimes.

Initial client scope:

- Use browse-only thread opens for passive navigation.
- Use intent-based warm-up from input focus, composer insert, send, and
  automation send.
- Show a distinct clockwise spoke/wheel connecting loader over the send button
  while cold-send warm-up is in progress.
- Disable/freeze the send button during warm-up to prevent duplicate sends.
- Commit the user bubble only after the server accepts the prompt.
- Send stop/interrupt to the server instead of relying on client-only
  `finalizeTurn()`.
- Hydrate completed history plus live snapshot overlay when opening a thread.

Initial validation scope:

- Switching threads does not kill, pause, cool, or retarget an in-flight turn.
- Returning to an in-flight thread fast-forwards to the latest live snapshot.
- Stop mid-stream persists a partial assistant exchange.
- Refresh after stop shows user prompt, interrupted assistant response, and the
  next user prompt in order.
- Cold send shows the connecting loader, accepts once warm, then starts the orb.

Implementation must follow the code standards:

- Keep one job per file; split if a file cannot be described in one sentence
  without "and".
- Avoid pushing more runtime logic into WebSocket handlers.
- Keep services, controllers, state, and presentation concerns separated.
- Do not add warm-pool/FIFO orchestration until measured cold-start behavior
  proves it is needed.

---

## Structured History (history.json)

Dual-write: CHAT.md (human-readable) + history.json (structured). history.json is the source of truth. CHAT.md can be regenerated from it.

```json
{
  "version": "1.0.0",
  "threadId": "uuid",
  "createdAt": 1712345678901,
  "updatedAt": 1712345682345,
  "exchanges": [
    {
      "seq": 1,
      "ts": 1712345679200,
      "user": "What files are in this project?",
      "assistant": {
        "parts": [
          { "type": "text", "content": "..." },
          { "type": "tool_call", "name": "Glob", "arguments": {...}, "result": {...} },
          { "type": "text", "content": "..." }
        ]
      }
    }
  ]
}
```

**What's built:**
- [x] ChatFile.js — CHAT.md parser and writer
- [x] HistoryFile.js — history.json structured format with exchange/parts model
- [x] Dual-write on every message
- [x] Auto-rename after first response (spawns kimi for summary generation)

**What's needed:**
- [ ] SQLite storage for machine layer
- [ ] Markdown generation from history.json into per-user thread folders
- [ ] Per-user folder creation on first chat (username from git config or Robin profile)

---

## MEMORY.md in Chat Context

### Daily-Rolling
When the day rolls over (nightly), the system summarizes key points from the day's conversation into MEMORY.md. Next day's session loads this as context — continuity across days without loading the full history.

### Threaded (multi-thread)
When resuming a thread after context compression, MEMORY.md is loaded as a refresher. Contains key decisions, user preferences, and patterns discovered across all threads in that workspace.

**What's built:**
- [x] MEMORY.md loaded as system context at session start (via SESSION.md `system-context`)
- [x] Session invalidation checks MEMORY.md mtime (`checkSessionInvalidation()`)

**What's needed:**
- [ ] Nightly rollover summarization (fire at day transition, summarize -> write MEMORY.md)
- [ ] Pre-compact loading for threaded chats
- [ ] Agent self-write capability (agents update MEMORY.md with discovered preferences)

---

## SESSION.md in Chat Context

SESSION.md in a chat folder defines:
- Which CLI and model profile to use
- Thread model (daily-rolling, multi-thread, single-persistent)
- Idle timeout
- What files load as system context
- Tool permissions (allowed, restricted, denied)

```yaml
---
thread-model: daily-rolling
session-invalidation: memory-mtime
idle-timeout: 9m
system-context: ["PROMPT.md", "MEMORY.md"]
cli: kimi
profile: default
tools:
  allowed: [read_file, glob, grep]
  denied: [shell_exec]
---
```

**What's built:**
- [x] `parseSessionConfig()` in session-loader.js
- [x] `buildSystemContext()` loads files from `system-context` list
- [x] Thread strategy selection based on `thread-model`
- [x] Session invalidation based on `session-invalidation`
- [x] System context injection on first prompt in server.js

**What's needed:**
- [ ] CLI profile fields (cli, profile, model, endpoint)
- [ ] Tool permissions parsing and server-side enforcement

---

## Render Pipeline

Two render modes from the same segment catalog:

### Live Streaming
Segments animate one at a time: shimmer -> typing blitz -> collapse -> next.
- Orb bridges gap between user action and first token (dynamic, holds until token arrives)
- Speed attenuator (fast/slow binary based on buffer depth — 2 chunks ahead)
- Chunk boundaries: paragraphs, headers, code fences, list items

### Instant Render (history / thread switch)
Completed history renders collapsed immediately. Same visual identity from
catalog. No animation.

Active or recently active turns reconnect through the live snapshot model:

- Missed completed chunks fast-render immediately.
- The visible renderer animates only the live tail after the client catches up.
- If the turn ended while the user was away, the completed assistant turn renders
  as complete rather than replaying the whole response token-by-token.
- Hidden React DOM is not responsible for background progress.

### Key Modules
```
segmentCatalog.ts           ← single source of truth (icons, colors, labels, renderMode)
LiveSegmentRenderer.tsx     ← animation lifecycle
InstantSegmentRenderer.tsx  ← collapsed, no animation
ToolCallBlock.tsx           ← shared shell (header + collapsible content)
transforms/markdown.ts      ← ONE configured marked instance
transforms/code.ts          ← ONE escapeHtml, codeBlockHtml
text/                       ← chunk boundary detection, sub-renderers (paragraph, header, code-fence, list)
```

---

## Crons on Chat

Any conversation can have a cron attached. Implemented as a self-blocking ticket (see VIEW-TICKETING.md):

- Cron fires -> sends **gray system message** to the chat
- Agent sees it as a system directive, responds naturally
- The ticket re-blocks itself with countdown to next fire
- System events can postpone (reset the countdown)
- User or agent can set up crons conversationally ("remind me to check deployments every afternoon")

---

## WebSocket Protocol

```
Client -> Server:
  thread:create, thread:open, thread:rename, thread:delete, thread:list
  prompt (requires open thread)

Server -> Client:
  thread:created, thread:opened, thread:renamed, thread:deleted, thread:list
  turn_begin, content, thinking, tool_call, tool_result, turn_end
  message:sent
```

`thread:opened` must be able to carry durable history plus live-turn overlay
state. Stream messages must carry explicit route identity (`scope`, `threadId`,
and enough workspace identity to route across workspaces). The client must treat
missing route identity as a protocol violation, not infer it from the currently
selected UI thread.

See STREAMING_RENDER_SPEC.md for wire protocol details.

---

## Existing Implementation

The thread/chat system is **fully built and file-based**. No SQLite yet — all persistence is markdown + JSON + in-memory session tracking.

### Built Modules

| Module | What it does |
|--------|-------------|
| `ChatFile.js` | CHAT.md writer — serialize/parse markdown with User/Assistant blocks + `**TOOL CALL(S)**` markers |
| `HistoryFile.js` | history.json writer — structured exchanges with parts (text/think/tool_call), metadata, sequential numbering |
| `ThreadIndex.js` | threads.json manager — MRU ordering, CRUD, activate/suspend, date tagging (daily-rolling), rebuild from filesystem |
| `ThreadManager.js` | Orchestrator — combines ChatFile + HistoryFile + ThreadIndex. Session lifecycle, FIFO eviction (max 10), idle timeout (9min default), auto-rename after first response via kimi summary |
| `ThreadWebSocketHandler.js` | Per-connection WS state, panel switching, thread CRUD, message send/receive, global threadManagers Map |
| `daily-rolling.js` | One thread per day, auto-selected by YYYY-MM-DD date tag |
| `multi-thread.js` | Manual selection from thread list, user creates new |
| `single-persistent.js` | One thread always, no list, no switching |
| `session-loader.js` | Parses SESSION.md frontmatter, builds system context from file list, checks MEMORY.md mtime for invalidation |

### SQLite Migration Path

The code already separates concerns cleanly:
- **ChatFile.js** writes markdown (stays in repo as human-readable receipts)
- **HistoryFile.js** writes structured JSON (redirects to SQLite)
- **ThreadIndex.js** writes metadata JSON (redirects to SQLite)

The migration is: redirect HistoryFile and ThreadIndex to read/write SQLite instead of .json files. ChatFile continues writing .md to per-user thread folders in the repo. Same interfaces, different storage backend.

---

## TODO

### Built (working)
- [x] Three thread strategies (daily-rolling, multi-thread, single-persistent)
- [x] ThreadManager with FIFO eviction (max 10), idle timeout (9min)
- [x] ChatFile (CHAT.md) markdown writer + parser
- [x] HistoryFile (history.json) structured JSON writer with exchange/parts model
- [x] ThreadIndex (threads.json) with MRU ordering, CRUD, activate/suspend
- [x] ThreadWebSocketHandler with per-connection state and panel switching
- [x] Session loader: parseSessionConfig, buildSystemContext, checkSessionInvalidation
- [x] Wire process spawn with --session for resume
- [x] WebSocket protocol (thread:create, thread:open, thread:rename, thread:delete, message:send)
- [x] Render pipeline: orb, live streaming, instant render, segment catalog
- [x] Auto-rename threads after first response (kimi summary generation)
- [x] Dual-write: CHAT.md + history.json on every message

### Needed
- [ ] Redirect HistoryFile.js + ThreadIndex.js to SQLite (same interfaces, new backend)
- [ ] ChatFile.js writes to per-user `threads/{username}/` folders (currently writes to thread UUID folders)
- [ ] threads/index.json sort config (by date, name, last-active, custom)
- [ ] Chat folder with chat.json config
- [ ] PROMPT.md + SESSION.md + MEMORY.md in chat folders
- [ ] Nightly MEMORY.md rollover (daily rolling day transition)
- [ ] Pre-compact MEMORY.md loading (threaded chat resume)
- [ ] CLI profile fields in SESSION.md
- [ ] Tool + DB permissions in SESSION.md + server-side enforcement
- [ ] Cron attachment UI (self-blocking ticket pattern)
- [ ] Thread search (full-text via SQLite)
- [ ] Thread import/export
- [ ] Cross-thread citations
- [ ] Server-owned live turn runtime and reconnectable live snapshots
- [ ] Browse-only `thread:open` that does not activate or kill harness sessions
- [ ] Pinned live turn route for event emission and assistant persistence
- [ ] Client hydration merge that fast-forwards missed live chunks
- [ ] Workspace/background session policy that preserves in-flight turns
- [ ] Server-owned stop/interrupt command that persists partial assistant turns
- [ ] Durable interruption metadata and coherent resume after stop
- [ ] Intent-based warm-up: input focus, composer insert, or send, not thread browse
- [ ] Cold-send connecting state that warms the session before prompt delivery
- [ ] In-flight protection without requiring a warm-retention timer
- [ ] Optional warm pool/FIFO only if measured cold-start latency requires it
- [ ] Ticket/orchestrator status automation hooks for background agent workflows
