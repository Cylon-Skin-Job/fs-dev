# Spec: Thread Runtime Manager Foundation

## Status

Ready for orchestration planning. Do not implement this as one large slice.

This spec supersedes:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-p-browse-without-killing-active-stream.md
```

The old Slice P identified the immediate symptom, but its proposed browse-only
patch was too narrow. The correct next direction is a narrow server-owned thread
runtime foundation.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/doc-viewer/content/specs/VIEW-CHAT.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-o-strict-live-stream-routing-results.md
```

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
```

Expected root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The working tree may contain accepted but uncommitted Kimi legacy-removal slices
and unrelated user/runtime state. Inspect before editing. Do not revert user or
runtime state.

Known unrelated/user/runtime paths may include:

```text
System Source Files/ai/system/state/state.json
ai/system/state/state.json
ai/views/wiki-viewer/settings/state.json
fusion-studio-server/data/workspace-cache.json
fusion-studio-client/src/mic/useAudioCapture.ts
fusion-studio-server/lib/transcription/index.js
fusion-studio-server/scripts/transcribe-file.js
```

## Problem

The current chat runtime is still too closely tied to a visible WebSocket and
the currently selected thread. That causes several related failures:

- Clicking another thread can kill or retarget the active stream.
- Returning to a streaming thread can reload SQLite history instead of the live
  state.
- Stop is client-local and can lose the partial assistant response.
- Refresh after stop can show two user bubbles and no assistant exchange.
- Future ticket/orchestration work needs to run harnesses in unfocused
  workspaces.

The fix is not another frontend fallback. The server must own thread runtimes,
live turn snapshots, prompt delivery, stop semantics, and route identity.

## Architectural Decisions

### 1. Runtime Ownership

Each active thread has a server-owned runtime object. WebSockets subscribe to
threads; they do not own the harness process.

```text
threadId owns runtime
websocket subscribes to threadId
```

### 2. Runtime States

Use explicit states:

```text
cold -> warming -> ready -> in_flight -> stopping
```

Meaning:

- `cold`: no active harness process/session.
- `warming`: harness process/session is being created or resumed.
- `ready`: harness can accept a prompt.
- `in_flight`: prompt accepted; events are streaming.
- `stopping`: user interrupt requested; runtime is finalizing the partial turn.

After a completed or interrupted turn, keep the selected thread `ready` while
the user remains on that thread. When the user browses away, the idle ready
thread may go `cold`.

In-flight turns are protected and must not be killed, cooled, paused, or
retargeted by navigation.

### 3. Warm Triggers

Cold threads do not warm from passive browsing.

Warm on send intent:

- chat input focus
- composer helper insertion / paste into the input
- send fallback if the runtime is still cold
- ticket/status automation send fallback

`thread:open` is browse/hydrate only.

### 4. Cold Send UI

When the user sends while the runtime is cold or warming:

```text
send click
  -> send button shows a small clockwise spoke/wheel loader
  -> send button is frozen/disabled against double-click
  -> button background may lighten to show pending/connecting state
  -> runtime warms
  -> server accepts prompt
  -> user bubble is committed/displayed
  -> orb starts
  -> assistant streams
```

The connecting loader must be visually distinct from the existing spinning
three-quarter-circle stop/turn-active indicator.

Do not show the user bubble until the server accepts the prompt.

### 5. Browse Semantics

Browsing/selecting a thread:

- updates selected thread
- loads completed history from SQLite
- overlays a live snapshot if that thread has one
- does not spawn a harness
- does not kill any in-flight harness
- does not warm a cold harness
- does not retarget an existing live stream

When browsing from Thread A to Thread B:

- A `ready` and idle: A may go `cold`.
- A `in_flight`: A stays running in background.
- B is selected/hydrated only.

Workspace switching follows the same rule as thread browsing.

### 6. Live Snapshot Contract

Do not write render queue chunks to SQLite.

Use:

```text
SQLite:
  completed or interrupted exchanges only

Server RAM:
  active in-flight live turn snapshot

Frontend:
  projection of SQLite history + live snapshot overlay
```

The live snapshot stores canonical assistant state, not render chunks:

```ts
type LiveTurnSnapshot = {
  workspaceId: string;
  scope: "project" | "view";
  threadId: string;
  turnId: string;
  userInput: string;
  status: "in_flight" | "complete" | "interrupted" | "error";
  fullText: string;
  parts: AssistantPart[];
  streamSeq: number;
  updatedAt: number;
};
```

Crash recovery for midstream turns is out of scope.

### 7. Stop Semantics

Stop should mimic CLI Escape as closely as each harness allows.

Preferred flow:

```text
user clicks stop
  -> runtime enters stopping
  -> server freezes current live snapshot
  -> server sends harness-specific cooperative interrupt
  -> harness stops active generation/tool loop
  -> runtime emits interrupted chat:turn_end
  -> SQLite persists partial exchange
  -> UI fast-renders partial assistant response
  -> runtime returns to ready if coherent
```

Fallback:

```text
persist partial exchange
kill process
mark runtime cold
next send resumes from durable history
```

Stop is not client-only `finalizeTurn()`.

### 8. Persistence Boundary

Use one terminal event:

```ts
chat:turn_end
```

with terminal metadata:

```ts
{
  reason: "complete" | "interrupted" | "error";
  partial: boolean;
}
```

Normal completion, user stop, and terminal harness error all use the same
persistence path.

### 9. Harness Memory Consistency

Fusion's canonical transcript is the UI source of truth.

If the harness has seen or produced part of an exchange, durable history must
represent that exchange before the next prompt is accepted.

Do not allow this split-brain state:

```text
Harness remembers:
  User A
  Assistant partial A

SQLite remembers:
  User A only
```

### 10. OpenCode Golden Harness

OpenCode is the intended default/golden harness. Kimi remains a secondary
adapter/reference pattern.

OpenCode capabilities to verify during future smoke:

- server mode (`opencode serve`)
- session/message APIs
- async prompt
- event stream
- cooperative abort
- abort transcript semantics

Harnesses should declare capabilities:

```ts
type HarnessCapabilities = {
  supportsServerMode: boolean;
  supportsAsyncPrompt: boolean;
  supportsEventStream: boolean;
  supportsCooperativeAbort: boolean;
  interruptSemantics:
    | "preserves_partial_context"
    | "drops_partial_context"
    | "unknown";
};
```

Other harnesses may have degraded behavior if they cannot match OpenCode's
model.

### 11. Automation Hooks

Background agents and ticket processes may warm and run harnesses in workspaces
that are not focused.

Automation sends use the same path as user sends:

```text
cold -> warming -> ready -> in_flight -> ready/cold
```

Automation must not interrupt in-flight user or agent turns.

Ticket/status automation should check runtime state:

- `cold` / `ready`: warm/send.
- `warming`: wait/defer.
- `in_flight` / `stopping`: defer; do not interrupt.

Future orchestrator behavior:

- worker, validator, and reviewer profiles can be driven through tickets
- ticket completion or a 15-minute status timer can inject `Status`
- the fronting/orchestrator agent may ask whether to enter AFK status mode

### 12. Implementation Direction

Use Option B: start a narrow server-owned `ThreadRuntimeManager` foundation.

Do not implement a tactical patch that preserves WebSocket-owned session
ownership.

## Initial Slice Proposal

Do this as several vertical slices. The first slice should establish the
smallest useful runtime ownership boundary and prove it with smoke tests.

### Slice Runtime-1: Runtime Skeleton and Browse-Only Open

Goal: introduce the runtime ownership boundary without changing render behavior
more than necessary.

Server scope:

- Add a focused runtime manager module under `fusion-studio-server/lib/thread/`
  or `fusion-studio-server/lib/runtime/`.
- Runtime manager is keyed by `workspaceId + scope + threadId`.
- Add runtime states and read-only state lookup.
- Add browse-only `thread:open` that selects/hydrates without spawning, killing,
  warming, closing, or retargeting harness runtimes.
- Move passive thread clicks/dropdowns/MRU hydration to browse-only open.
- Preserve current create/new-thread flow.

Client scope:

- Use browse-only open for passive navigation.
- Do not warm on thread click.
- Hydrate completed history without clearing a live snapshot if present.

Validation:

- Clicking other threads does not call harness spawn/warm.
- Clicking other threads does not kill an in-flight runtime.
- Returning to an in-flight thread shows live state or live snapshot, not only
  SQLite history.

### Slice Runtime-2: Prompt Acceptance Through Runtime

Goal: prompt delivery is owned by the runtime, not raw WebSocket session state.

Server scope:

- Route `prompt` through runtime manager.
- Warm/resume runtime if prompt arrives while cold.
- Pin route identity at prompt acceptance.
- Commit user message only after runtime accepts prompt.
- Runtime emits explicit `message:sent` / accepted state to client.

Client scope:

- Cold send shows the distinct send-button connecting loader.
- Send button is disabled/frozen while warming.
- User bubble appears only after server acceptance.
- Orb starts after prompt acceptance.

Validation:

- Cold send warms then sends.
- Double-click send cannot create duplicate prompts.
- Failed warm-up does not create a phantom user bubble.

### Slice Runtime-3: Live Snapshot Overlay

Goal: reconnecting to a thread shows current server-owned progress.

Server scope:

- Runtime owns `LiveTurnSnapshot`.
- Canonical events update the live snapshot.
- `thread:opened` can include `liveTurn`.
- `thread:opened` includes enough sequence/version identity to dedupe.

Client scope:

- Hydrate SQLite exchanges.
- Overlay `liveTurn`.
- Fast-render missed content.
- Animate only the live tail.

Validation:

- Switch away during streaming, wait, switch back: UI catches up to latest
  snapshot.
- If turn completed while away, UI shows completed turn immediately.

### Slice Runtime-4: Server-Owned Stop/Interrupt

Goal: stop persists partial assistant output and leaves runtime coherent.

Server scope:

- Add stop/interrupt client message.
- Runtime enters `stopping`.
- Runtime freezes live snapshot and performs cooperative interrupt when
  supported.
- Runtime emits `chat:turn_end` with `reason: "interrupted"` and
  `partial: true`.
- Audit persistence writes interrupted exchanges.

Client scope:

- Stop button sends server interrupt.
- Client no longer treats local `finalizeTurn()` as persistence.
- Interrupted turn fast-renders and clears active state.

Validation:

- Stop mid-stream persists partial assistant exchange.
- Refresh after stop shows user prompt, interrupted assistant response, then any
  later user prompt in correct order.
- Next send works after stop.

### Slice Runtime-5: Automation Hooks

Goal: expose enough runtime state/control for future ticket orchestration.

Server scope:

- Add runtime state lookup for automation.
- Add automation send path or metadata on existing send path.
- Do not require workspace focus.
- Defer rather than interrupt if target runtime is in flight.

Validation:

- Automation can warm/send to an unfocused workspace/thread.
- Automation does not interrupt an in-flight thread.

## Non-Goals For Initial Runtime Work

- Do not implement OpenCode as default yet.
- Do not remove Kimi adapter yet.
- Do not implement warm pool/FIFO.
- Do not implement crash recovery for midstream turns.
- Do not write render queue chunks to SQLite.
- Do not support concurrent prompts to the same runtime.
- Do not create full ticket/orchestrator automation.
- Do not split `LiveSegmentRenderer.tsx`.

## Standards Gate

Every slice must follow:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Relevant constraints:

- One job per file.
- Avoid growing WebSocket handlers into runtime controllers.
- Runtime orchestration is server-side controller logic.
- UI is presentation/state projection, not runtime source of truth.
- Services do data/harness access only.
- Do not create abstractions for one-time use.
- Do not add warm-pool/FIFO until measurements justify it.

## Validation Baseline

Every worker should report:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
git diff --check
```

Server:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Frontend, when touched:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint <changed frontend files>
```

Restart smoke, when runtime or UI changes are meaningful:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

## Manual Smoke Matrix For Runtime Work

At minimum:

1. Send a normal plain-text prompt.
2. Switch to another thread while response streams.
3. Return before completion and verify fast-forward to latest live state.
4. Return after completion and verify completed assistant turn appears.
5. Stop mid-stream and verify partial assistant response persists.
6. Refresh after stop and verify no adjacent user-only bubbles.
7. Send again after stop.
8. Cold-send from a browsed thread and verify connecting loader before user
   bubble/orb.
9. Switch workspace while a turn is in flight; return and verify progress.

## Defaults For First Implementation

Use these defaults unless implementation discovers a concrete blocker.

### Runtime Module Path

Create the first runtime manager under:

```text
fusion-studio-server/lib/thread/thread-runtime-manager.js
```

Reason: this runtime owns chat thread lifecycle, not generic process lifecycle.
Keep it focused on runtime state/ownership. Do not turn it into a WebSocket
router, harness adapter, or persistence service.

### Runtime Key

Use a structured key helper, not ad hoc string concatenation at call sites.

Project scope key:

```ts
{ workspaceId, scope: "project", threadId }
```

View scope key:

```ts
{ workspaceId, scope: "view", viewId, threadId }
```

The helper may serialize internally, but callers should pass structured fields
so view-bound and project-bound chats cannot collide.

### Initial WebSocket Message Names

Prefer explicit names:

```text
thread:open             browse/hydrate only
thread:warm             focus/intent warm-up
prompt                  send prompt; runtime warms first if needed
prompt:accepted         server accepted prompt; client may commit user bubble
thread:live_snapshot    optional explicit live snapshot response/update
turn:stop               user interrupt request
```

If an existing message name already exists for one of these concepts, reuse it
only if the semantics match exactly. Do not keep names that imply activation
when they are browse-only.

### Cooling After Browsing Away

When a selected thread is `ready` and idle, browsing away may mark it `cold`
immediately. A short internal debounce is acceptable only to avoid implementation
churn. It must not become a visible timer or a required warm-retention policy.

`in_flight` runtimes are never cooled by browsing away.

### OpenCode Timing

Do not include OpenCode implementation in Runtime-1. Keep Runtime-1 focused on
ownership, browse-only open, and existing harness compatibility. OpenCode gets a
dedicated harness slice after runtime ownership is proven.
