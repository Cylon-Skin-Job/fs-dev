# Handoff: Kimi Legacy Removal Slice O - Strict Live Stream Routing

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-m-retire-legacy-wire-runtime-results.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-n-frontend-canonical-tool-names-results.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A through N are complete or accepted. Slice N removed the frontend/server PascalCase tool-name compatibility bridge and verified canonical tool names in the live UI.

This slice is the next frontend compatibility cleanup: live stream events must route by explicit server metadata, not by the currently selected UI state.

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

The tree may contain accepted but uncommitted Slice F through N files plus runtime/user state. Inspect before editing and do not overwrite unrelated user work.

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

Live stream messages should never silently attach to the currently selected chat when the server omitted route metadata.

After this slice, live chat stream events must carry:

```text
scope: "project" | "view"
threadId: string
```

If a live stream event is missing `scope` or `threadId`, the frontend should warn/drop it instead of using `store.currentScope`, `currentThreadIds.project`, or another selected UI fallback.

## Current Problem

`fusion-studio-client/src/lib/ws/stream-handlers.ts` still has these fallbacks:

```ts
function resolveScope(msg: WebSocketMessage): Scope {
  if (msg.scope === 'project' || msg.scope === 'view') return msg.scope;
  const current = usePanelStore.getState().currentScope;
  if (current) return current;
  return 'project';
}
```

and:

```ts
const threadId: string | null = msg.threadId ?? null;
```

Those feed store helpers that can resolve a missing project `threadId` to `currentThreadIds.project`. That was useful during the old single-current-thread era, but it can hide a backend routing bug and put tokens into the wrong visible thread.

There is also a server-side gap: `wire-broadcaster.js` currently stamps `threadId` but not `scope` onto outbound `chat:*` websocket messages. The event bus payloads have `workspace`, but the client needs explicit `scope`.

## Scope

Primary scope:

```text
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/wire-broadcaster.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/test/wire/canonical-chat-event-applier.test.js
fusion-studio-server/test/ws/client-message-router.test.js
fusion-studio-client/src/lib/ws/stream-handlers.ts
fusion-studio-client/src/types/index.ts
```

Support scope if needed:

```text
fusion-studio-server/test/wire/wire-broadcaster.test.js
```

Do not edit:

```text
fusion-studio-client/src/mic/useAudioCapture.ts
fusion-studio-server/lib/transcription/index.js
fusion-studio-server/scripts/transcribe-file.js
```

## Non-Goals

Do not rewrite `thread-handlers.ts` in this slice.

Do not remove rich `exchanges` to legacy `history` hydration fallback yet.

Do not change `chatSlice.ts` helper behavior broadly. It still has call sites outside live stream handling. The acceptance criterion for this slice is that `stream-handlers.ts` no longer invokes those helpers with missing live route metadata.

Do not split `stream-handlers.ts` yet, even though it is oversized. That should happen after strict routing and hydration behavior are stable.

Do not change tool render visuals, chunking, reveal timing, cursor behavior, pressure cleanup, canonical tool names, or warm-session eviction.

## Task

1. Add `scope` to canonical chat event emissions.

   In `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`, add a helper like:

   ```js
   function getScope() {
     return session.currentScope || 'view';
   }
   ```

   Include `scope: getScope()` in every emitted `chat:*` payload:

   ```text
   chat:turn_begin
   chat:content
   chat:thinking
   chat:tool_call
   chat:tool_call_args
   chat:tool_result
   chat:subagent_event
   chat:status_update
   chat:turn_end
   ```

   Keep `workspace` unchanged. The event bus should carry both:

   ```text
   workspace: "workspace:..."
   scope: "project" | "view"
   ```

2. Forward `scope` over websocket.

   In `fusion-studio-server/lib/wire/wire-broadcaster.js`, add `scope: event.scope` to every outbound chat websocket payload:

   ```text
   turn_begin
   content
   thinking
   tool_call
   tool_call_args
   tool_result
   subagent_event
   turn_end
   status_update
   ```

   Update comments so they say every outbound live stream message carries both `scope` and `threadId`.

3. Add route metadata to direct prompt failures that the stream handler owns.

   In `fusion-studio-server/lib/ws/client-message-router.js`, prompt-related direct errors should include the same route identity when available:

   - `wire lacks _sendMessage`
   - `wire lacks direct canonical event delivery`
   - auth-style errors thrown from `_sendMessage`

   Use the local `scope` and `threadId` variables already computed in the prompt branch.

   This is important because the frontend `auth_error` handler clears a pending turn for the targeted chat. It should not guess the route from the currently selected UI state.

4. Replace client-side scope fallback with a route guard.

   In `fusion-studio-client/src/lib/ws/stream-handlers.ts`, remove `resolveScope()`.

   Add a small helper that validates live stream route metadata, for example:

   ```ts
   const ROUTED_STREAM_TYPES = new Set<WebSocketMessageType>([
     'turn_begin',
     'content',
     'thinking',
     'tool_call',
     'tool_call_args',
     'tool_result',
     'subagent_event',
     'turn_end',
     'status_update',
     'auth_error',
   ]);

   function getStreamRoute(msg: WebSocketMessage): { scope: Scope; threadId: string } | null {
     if (!ROUTED_STREAM_TYPES.has(msg.type)) return null;
     if ((msg.scope !== 'project' && msg.scope !== 'view') || !msg.threadId) {
       console.warn('[WS] Dropping stream message without explicit route metadata', {
         type: msg.type,
         scope: msg.scope,
         threadId: msg.threadId,
       });
       return null;
     }
     return { scope: msg.scope, threadId: msg.threadId };
   }
   ```

   Then in `handleStreamMessage()`:

   - For routed stream types, call the guard before the switch mutates state.
   - If the guard returns `null`, return `true` so the message is considered handled/dropped and does not fall through to other handlers.
   - For non-routed stream types still handled here, do not require route metadata unless that specific handler mutates chat state.

   `threadId` should become a non-null `string` for live routed mutations. Avoid passing `null` from `stream-handlers.ts` into chat store mutation calls.

5. Update top-of-file comments.

   Replace old language that says stream messages fall back to `store.currentScope`.

   The new contract should say:

   ```text
   Live stream messages route only by explicit server scope + threadId.
   Missing route metadata is a contract violation and is dropped with a diagnostic.
   ```

6. Keep generic errors sane.

   If `handleStreamMessage()` still handles a generic `error` message, do not require route metadata unless the handler clears or mutates chat state. It can continue logging.

## Acceptance Checks

Run these searches from repo root:

```bash
rg -n "resolveScope\\(|currentScope|currentThreadIds\\.project|Final fallback|fall back to store\\.currentScope|fallback to store\\.currentScope|threadId \\?\\? null" fusion-studio-client/src/lib/ws/stream-handlers.ts
```

Expected: no hits.

```bash
rg -n "scope: event\\.scope" fusion-studio-server/lib/wire/wire-broadcaster.js
```

Expected: hits for every outbound live chat websocket payload.

```bash
rg -n "scope: getScope\\(\\)" fusion-studio-server/lib/wire/canonical-chat-event-applier.js
```

Expected: hits for every emitted `chat:*` payload.

```bash
rg -n "type: 'auth_error'|Wire does not support ACP sendMessage|Wire does not support direct canonical event delivery" fusion-studio-server/lib/ws/client-message-router.js
```

Expected: prompt-related payloads include `scope` and `threadId`.

```bash
rg -n "ReadFile|WriteFile|EditFile|StrReplaceFile|SearchWeb|FetchURL|SetTodoList|TodoWrite|PascalCase|adaptToolNameForWebsocket" fusion-studio-client/src/lib/instructions.ts fusion-studio-server/lib/wire fusion-studio-server/test/wire
```

Expected: no hits. This keeps Slice N intact.

## Validation

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/ws/stream-handlers.ts src/types/index.ts
```

Server focused:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/wire/canonical-chat-event-applier.test.js test/ws/client-message-router.test.js test/wire/canonical-harness-event-bridge.test.js lib/harness/kimi/__tests__/harness-send-message.test.js
```

If you add `test/wire/wire-broadcaster.test.js`, include it in the focused command.

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

1. Plain prompt streams and completes.
2. Shell/tool prompt streams and completes.
3. Read or write prompt if practical.
4. Switch between two project threads while one response streams; content should stay on the originating thread.
5. If practical, open a view-scoped chat and confirm stream messages still render there.

## Report Back

Create:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-o-strict-live-stream-routing-results.md
```

Include:

- Repo root confirmation.
- Git status before edits.
- Files changed.
- Exact validation commands and results.
- Acceptance-check search results.
- Manual smoke result, including skipped items and why.
- Any dropped-message diagnostic behavior introduced.
- Risks/follow-up, especially anything deferred to the next history hydration slice.

Do not commit unless explicitly instructed.
