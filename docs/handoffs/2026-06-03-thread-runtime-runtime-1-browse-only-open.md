# Handoff: Thread Runtime Runtime-1 - Browse-Only Open

## Status

READY FOR EXECUTION

## Objective

Introduce the smallest server-owned thread runtime boundary and make passive
thread navigation browse/hydrate only. Do not route prompt delivery through the
runtime yet.

This is the first vertical slice from:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md
```

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/doc-viewer/content/specs/VIEW-CHAT.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-o-strict-live-stream-routing-results.md
```

## Startup Checks

Run from the repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
```

Expected root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The worktree is expected to be dirty with accepted prior runtime/harness slices,
handoff docs, and runtime/user state. Do not revert unrelated changes.

Known dirty paths may include:

```text
System Source Files/ai/system/state/state.json
ai/system/state/state.json
ai/views/doc-viewer/content/specs/VIEW-CHAT.md
ai/views/wiki-viewer/settings/state.json
fusion-studio-client/src/lib/ws/stream-handlers.ts
fusion-studio-server/lib/harness/**
fusion-studio-server/lib/thread/thread-crud.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/ws/harness-ws-handlers.js
fusion-studio-server/lib/ws/thread-ws-handlers.js
fusion-studio-server/server.js
docs/handoffs/*kimi-legacy-slice-*
```

## Current Implementation Clues

Passive navigation currently still uses activation semantics:

- `fusion-studio-client/src/lib/ws/thread-handlers.ts` auto-opens MRU with
  `thread:open-assistant`.
- `fusion-studio-client/src/components/ThreadJumpDropdown.tsx` selects threads
  with `thread:open-assistant`.
- `fusion-studio-client/src/components/sidebar/useSidebar.ts` opens sidebar
  thread rows with `thread:open-assistant`.
- `fusion-studio-client/src/state/slices/secondarySlice.ts` opens secondary
  thread state with `thread:open-assistant`.
- `fusion-studio-server/lib/ws/thread-ws-handlers.js` handles
  `thread:open-assistant` by killing `session.wire`, opening/hydrating the
  thread, then spawning a new wire.
- `fusion-studio-server/lib/thread/thread-crud.js` has a private
  `handleThreadOpen()` that already hydrates history and sends `thread:opened`,
  but it closes the current scoped thread before switching.

These are the slice seams. Preserve create/new-thread behavior; change passive
open behavior only.

## Scope

### Server

1. Add a focused runtime manager module:

```text
fusion-studio-server/lib/thread/thread-runtime-manager.js
```

2. The module must own only runtime state/key bookkeeping for now:

- Runtime states: `cold`, `warming`, `ready`, `in_flight`, `stopping`.
- Structured key input from callers.
- Internal serialized key that prevents project/view collisions.
- Read-only lookup for runtime state.
- A browse-away/cool helper may mark idle `ready` runtimes `cold`.
- In-flight runtimes must never be cooled by browsing away.

3. Use structured key input at call sites. Do not concatenate ad hoc keys at
call sites.

Project key shape:

```ts
{ workspaceId, scope: "project", threadId }
```

View key shape:

```ts
{ workspaceId, scope: "view", viewId, threadId }
```

4. Add or expose a browse-only `thread:open` server path that:

- Selects/hydrates the requested thread.
- Sends `thread:opened` with durable history exactly as today.
- Does not spawn a wire.
- Does not kill an in-flight wire/runtime.
- Does not warm a cold runtime.
- Does not retarget `session.wire` or live stream route state.

5. Keep `thread:open-assistant` as the activation/create-or-resume path for now
because prompt delivery is not part of Runtime-1. Do not delete it in this slice.

6. Preserve `thread:create` / new-chat behavior. Creating a new chat may still
use the existing assistant activation flow unless a smaller safe separation is
obvious.

### Client

1. Change passive thread navigation to send browse-only `thread:open` instead
of `thread:open-assistant`:

- MRU auto-open in `fusion-studio-client/src/lib/ws/thread-handlers.ts`.
- Thread dropdown selection in `fusion-studio-client/src/components/ThreadJumpDropdown.tsx`.
- Sidebar thread row selection in `fusion-studio-client/src/components/sidebar/useSidebar.ts`.
- Secondary open hydration in `fusion-studio-client/src/state/slices/secondarySlice.ts`, if this is passive viewing rather than create/send intent.

2. Do not add cold-send UI, prompt acceptance UI, or live snapshot overlay in
this slice.

## Non-Goals

- Do not route `prompt` through `ThreadRuntimeManager` yet.
- Do not add `prompt:accepted` yet.
- Do not move user-bubble commit timing yet.
- Do not implement cold-send connecting loader yet.
- Do not implement live snapshot overlay yet.
- Do not implement server-owned stop/interrupt yet.
- Do not implement OpenCode as default.
- Do not remove Kimi adapter.
- Do not split `LiveSegmentRenderer.tsx`.
- Do not add warm pools, FIFO policy, or visible retention timers.

## Acceptance Checks

Run targeted searches after edits. Equivalent `grep`/tool searches are acceptable
if `rg` is unavailable.

1. Passive client paths send `thread:open`, not `thread:open-assistant`:

```bash
rg -n "thread:open-assistant" fusion-studio-client/src/lib/ws/thread-handlers.ts fusion-studio-client/src/components/ThreadJumpDropdown.tsx fusion-studio-client/src/components/sidebar/useSidebar.ts fusion-studio-client/src/state/slices/secondarySlice.ts
```

Expected: no hits in passive browse handlers, unless a hit is clearly create/send
intent and documented.

2. Browse-only open does not spawn or kill wires:

```bash
rg -n "thread:open'|thread:open\"|spawnAndSetupWire|kill\('SIGTERM'\)|session\.wire" fusion-studio-server/lib/ws/thread-ws-handlers.js fusion-studio-server/lib/thread/thread-crud.js
```

Expected: `thread:open` handler does not call `spawnAndSetupWire`, does not kill
`session.wire`, and does not mutate active wire route state.

3. Runtime manager exists and exposes read-only state lookup:

```bash
rg -n "cold|warming|ready|in_flight|stopping|getRuntimeState|thread-runtime-manager" fusion-studio-server/lib/thread
```

Expected: runtime states are centralized in the new runtime manager, not scattered
through WebSocket handlers.

## Validation

Baseline:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Server:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/ws/thread-handlers.ts src/components/ThreadJumpDropdown.tsx src/components/sidebar/useSidebar.ts src/state/slices/secondarySlice.ts
```

Restart smoke if the slice builds cleanly:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Manual smoke, if available:

1. Start a streaming response.
2. Click another thread from the sidebar or dropdown.
3. Verify the original stream is not killed by the browse click.
4. Return to the original thread and record current behavior. Runtime-1 does not
   need full live snapshot catch-up yet, but it must not introduce a kill or
   retarget regression.
5. Refresh and confirm MRU hydration still opens a thread history without
   automatically spawning/warming a harness.

## Worker Report Requirements

Final report must include:

- Repo root result.
- `git status --short` before and after edits.
- Files changed.
- Validation command results.
- Acceptance search results.
- Any standards exception with reason.
- Any deferred issue discovered for Runtime-2 or Runtime-3.
