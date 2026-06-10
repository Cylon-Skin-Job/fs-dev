# Handoff: Kimi Legacy Removal Slice P - Browse Threads Without Killing Active Stream

> Superseded: do not assign this handoff as written.
>
> Use this newer runtime-manager spec instead:
>
> `/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-thread-runtime-manager-foundation-spec.md`
>
> The original Slice P correctly identified that browsing is coupled to harness
> activation, but the proposed fix is too narrow. The next implementation should
> start the server-owned `ThreadRuntimeManager` foundation so active streams,
> stop/interrupt behavior, live snapshots, and future background automation share
> one ownership model.

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-o-strict-live-stream-routing-results.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A through O are complete or accepted. Slice O made live stream messages route strictly by explicit `scope` and `threadId`.

Interactive smoke after Slice O exposed a separate navigation/session bug:

```text
Clicking around threads while a response is streaming appears to kill the stream
or make it disappear into the background. Returning to the thread looks like a
SQLite reload instead of the live streaming state.
```

This is not a reason to roll back Slice O. Slice O made the route identity explicit. The new bug is that thread browsing is still coupled to harness activation.

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

Confirm:

```bash
git rev-parse --show-toplevel
git status --short
git log -1 --oneline
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The tree may contain accepted but uncommitted Slice F through O files plus runtime/user state. Inspect before editing and do not overwrite unrelated user work.

Known runtime/user state files that may be dirty and must be left alone:

```text
System Source Files/ai/system/state/state.json
ai/system/state/state.json
ai/views/wiki-viewer/settings/state.json
fusion-studio-server/data/workspace-cache.json
```

Known unrelated user work may include:

```text
fusion-studio-client/src/mic/useAudioCapture.ts
fusion-studio-server/lib/transcription/index.js
fusion-studio-server/scripts/transcribe-file.js
```

## Goal

Make clicking/opening an existing thread a browse/hydrate action, not a harness activation action.

After this slice:

- Switching the visible project thread while another thread is streaming must not kill that active stream.
- Returning to a still-streaming thread must preserve its live `currentTurn`, `segments`, and `pendingTurnEnd` state.
- Hydration from SQLite should happen for inactive threads only.
- The app should not spawn/warm a harness merely because the user clicked a thread.

This aligns with the roadmap’s later warm-session design: clicking around should not automatically kill or replace active sessions.

## Current Root Cause

There are two coupled problems.

### 1. Sidebar clicks use the harness-activation verb

`fusion-studio-client/src/components/sidebar/useSidebar.ts` sends:

```ts
sendMessage({ type: 'thread:open-assistant', scope, threadId });
```

`fusion-studio-client/src/lib/ws/thread-handlers.ts` also auto-opens the MRU thread with `thread:open-assistant`.

`fusion-studio-client/src/state/slices/secondarySlice.ts` opens the secondary popup with `thread:open-assistant`.

### 2. `thread:open-assistant` kills the current wire

`fusion-studio-server/lib/ws/thread-ws-handlers.js` currently does:

```js
if (session.wire) {
  session.wire.kill('SIGTERM');
  session.wire = null;
}
```

before it resumes/creates the requested thread and spawns a new wire.

That means a normal browse click can terminate an active streaming harness turn.

### 3. Thread hydration wipes live UI state

`fusion-studio-client/src/lib/ws/thread-handlers.ts` always clears and hydrates on `thread:opened`:

```ts
store.clearChat(scope, msg.threadId);
convertExchangesToMessages(...);
```

If the thread already has a live `currentTurn` or unreleased `segments`, returning to that thread replaces the live slot with whatever SQLite has persisted so far.

## Scope

Primary scope:

```text
fusion-studio-server/lib/thread/thread-crud.js
fusion-studio-server/lib/ws/thread-ws-handlers.js
fusion-studio-client/src/components/sidebar/useSidebar.ts
fusion-studio-client/src/lib/ws/thread-handlers.ts
fusion-studio-client/src/state/slices/secondarySlice.ts
fusion-studio-client/src/types/index.ts
```

Support scope if needed:

```text
fusion-studio-server/test/ws/thread-ws-handlers.test.js
fusion-studio-server/test/thread/*.test.js
fusion-studio-client/src/components/ThreadJumpDropdown.tsx
```

Do not edit:

```text
fusion-studio-client/src/mic/useAudioCapture.ts
fusion-studio-server/lib/transcription/index.js
fusion-studio-server/scripts/transcribe-file.js
```

## Non-Goals

Do not implement the full warm-session expiration queue in this slice.

Do not support sending prompts concurrently to multiple active streaming threads yet. If the user sends a new prompt in another thread while one is still active, that is part of the upcoming warm-session/concurrency architecture.

Do not remove the legacy `history` hydration fallback yet.

Do not split `stream-handlers.ts` or `thread-handlers.ts`.

Do not change render timing, tool rendering, canonical tool names, or strict live stream routing.

## Task

1. Add a browse-only thread-open websocket route.

   Server side already has a `handleThreadOpen()` helper inside `fusion-studio-server/lib/thread/thread-crud.js`, but it is not exported from `createCrudHandlers()`.

   Export it as `handleThreadOpen`.

   In `fusion-studio-server/lib/ws/thread-ws-handlers.js`, add a handler:

   ```js
   async 'thread:open'(clientMsg) {
     const scope = clientMsg.scope === 'project' ? 'project' : 'view';
     await ThreadWebSocketHandler.handleThreadOpen(ws, clientMsg, scope);
   }
   ```

   Important: `thread:open` must not kill `session.wire`, must not call `spawnAndSetupWire()`, and must not send `wire_ready`.

   This route is for browsing/hydrating a thread only.

2. Move browse clicks to `thread:open`.

   Update existing-thread browse actions to send `thread:open` instead of `thread:open-assistant`:

   ```text
   fusion-studio-client/src/components/sidebar/useSidebar.ts
   fusion-studio-client/src/lib/ws/thread-handlers.ts   // MRU auto-open
   fusion-studio-client/src/state/slices/secondarySlice.ts
   ```

   Check `fusion-studio-client/src/components/ThreadJumpDropdown.tsx` too. If it opens existing threads for browsing, move it to `thread:open`.

   Keep `thread:open-assistant` for actions that intentionally create/activate a harness session.

3. Preserve live thread state during `thread:opened`.

   In `fusion-studio-client/src/lib/ws/thread-handlers.ts`, before `clearChat()` in the `thread:opened` handler, check whether the target slot has live state.

   Suggested helper:

   ```ts
   function hasLiveTurnState(scope: Scope, threadId: string): boolean {
     const state = usePanelStore.getState();
     const chat = scope === 'project'
       ? state.projectChats[threadId]
       : state.panels[state.currentPanel];
     return Boolean(
       chat?.currentTurn ||
       chat?.pendingTurnEnd ||
       chat?.segments.length
     );
   }
   ```

   If the opened thread has live state:

   - Still update selected/current thread state for primary opens.
   - Still clear secondary tracker claims where appropriate.
   - Do not call `clearChat()`.
   - Do not hydrate from `exchanges` or `history`.
   - Do not overwrite `contextUsage` from old persisted data.
   - Log a clear diagnostic such as:

     ```text
     [WS] thread:opened: preserving live state for active stream
     ```

   This prevents returning to a streaming thread from replacing live content with a SQLite snapshot.

4. Keep create/new-chat behavior working.

   Existing new chat creation may still flow through `thread:open-assistant` with no `threadId` and a `harnessId`.

   Do not break:

   - Creating a new thread.
   - Opening an app with no active thread and auto-hydrating the MRU thread.
   - Sending a prompt to the selected thread.

   It is acceptable if sending a prompt to a browsed thread uses the existing dead-wire recovery path to spawn a wire.

5. Update websocket message types.

   Add `'thread:open'` to `fusion-studio-client/src/types/index.ts` if the message type union needs it.

6. Add tests where the repo already has coverage.

   At minimum, add or update server/client tests if existing harnesses are easy to extend:

   - Server route test: `thread:open` calls history open and does not call `spawnAndSetupWire()` / does not kill `session.wire`.
   - Client handler test, if no test setup exists then document skipped: `thread:opened` preserves a live slot and does not clear/hydrate over `currentTurn`.

   Do not create a large new frontend test framework just for this slice.

## Acceptance Checks

Run these from repo root:

```bash
rg -n "thread:open-assistant" fusion-studio-client/src/components/sidebar/useSidebar.ts fusion-studio-client/src/lib/ws/thread-handlers.ts fusion-studio-client/src/state/slices/secondarySlice.ts fusion-studio-client/src/components/ThreadJumpDropdown.tsx
```

Expected: no existing-thread browse/open clicks use `thread:open-assistant`. If there are hits, document why they intentionally create/activate a harness session.

```bash
rg -n "async 'thread:open'|handleThreadOpen" fusion-studio-server/lib/ws/thread-ws-handlers.js fusion-studio-server/lib/thread/thread-crud.js
```

Expected: browse-only route exists and is exported/routed.

```bash
rg -n "kill\\('SIGTERM'\\)|spawnAndSetupWire|wire_ready" fusion-studio-server/lib/ws/thread-ws-handlers.js
```

Expected: these remain only in `thread:open-assistant` / activation path, not in `thread:open`.

```bash
rg -n "hasLiveTurnState|preserving live state|clearChat\\(scope, msg\\.threadId\\)" fusion-studio-client/src/lib/ws/thread-handlers.ts
```

Expected: live-state preservation exists; unconditional clear/hydrate over live state is gone.

Slice O guard should remain intact:

```bash
rg -n "resolveScope\\(|currentScope|currentThreadIds\\.project|threadId \\?\\? null" fusion-studio-client/src/lib/ws/stream-handlers.ts
```

Expected: no hits.

## Validation

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/ws/thread-handlers.ts src/components/sidebar/useSidebar.ts src/state/slices/secondarySlice.ts src/types/index.ts
```

Server focused:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/ws/client-message-router.test.js test/wire/canonical-chat-event-applier.test.js
```

Add any new focused test file to the command if created.

Server full:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

Whitespace:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Manual smoke:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Then smoke:

1. Start a plain prompt and switch to another existing project thread while it streams.
2. Return to the streaming thread. It should still show live stream state, not a stale SQLite reload.
3. Start a shell/tool prompt and repeat the same thread switch.
4. Confirm the original stream is not killed by the browse click.
5. Confirm opening an inactive old thread still hydrates from persisted exchanges.
6. Confirm creating a new thread still works.

## Report Back

Create:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-p-browse-without-killing-active-stream-results.md
```

Include:

- Repo root confirmation.
- Git status before edits.
- Files changed.
- Exact validation commands and results.
- Acceptance-check search results.
- Manual smoke result, including skipped items and why.
- Whether thread browsing now avoids harness spawn/kill.
- Whether live state preservation triggered during smoke.
- Risks/follow-up, especially concurrent prompts across multiple live threads and the later warm-session expiration queue.

Do not commit unless explicitly instructed.
