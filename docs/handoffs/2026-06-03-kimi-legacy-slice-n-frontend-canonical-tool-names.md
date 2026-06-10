# Handoff: Kimi Legacy Removal Slice N - Frontend Canonical Tool Names

## Context

Read these first:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/KIMI_LEGACY_WORKER_STANDARDS.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-m-retire-legacy-wire-runtime-results.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

Slices A through M are complete or accepted. Slice M retired the live raw Kimi wire runtime. One review repair was added after the initial Slice M report: prompt sends now require direct canonical event delivery and fail visibly instead of draining a non-direct `_sendMessage` stream.

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

The tree may contain accepted but uncommitted Slice F through M files plus runtime/user state. Inspect before editing and do not overwrite unrelated user work.

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

Remove the temporary frontend/server tool-name compatibility bridge.

After this slice:

```text
harness parser / translator
  -> canonical toolName values
  -> canonical-harness-event-bridge
  -> websocket broadcaster
  -> frontend toolNameToSegmentType()
  -> canonical StreamSegment.type
```

The frontend should consume canonical tool names directly:

```text
shell
read
write
edit
glob
grep
web_search
fetch
subagent
todo
```

It should not require raw Kimi/PascalCase names such as:

```text
Shell
ReadFile
WriteFile
EditFile
StrReplaceFile
SearchWeb
FetchURL
Agent
Task
SetTodoList
TodoWrite
```

## Scope

Primary scope:

```text
fusion-studio-client/src/lib/instructions.ts
fusion-studio-client/src/lib/ws/stream-handlers.ts
fusion-studio-client/src/lib/ws/thread-handlers.ts
fusion-studio-server/lib/wire/message-router.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js
```

Support scope if needed:

```text
fusion-studio-server/lib/wire/wire-broadcaster.js
fusion-studio-server/test/ws/client-message-router.test.js
```

Do not edit:

```text
fusion-studio-client/src/mic/useAudioCapture.ts
fusion-studio-server/lib/transcription/index.js
fusion-studio-server/scripts/transcribe-file.js
```

## Non-Goals

Do not split `stream-handlers.ts` in this slice.

Do not remove current-scope/current-thread routing fallbacks yet.

Do not remove `thread-handlers.ts` rich `exchanges` to legacy `history` hydration fallback yet.

Do not change tool renderer visuals, chunking, reveal timing, cursor behavior, pressure cleanup, or warm-session eviction.

Do not broaden frontend aliases for future harnesses. If a non-Kimi harness emits a non-canonical tool name, fix that harness interpreter in a later harness-specific slice.

## Task

1. Make `toolNameToSegmentType()` canonical-only.

   In `fusion-studio-client/src/lib/instructions.ts`, replace the raw Kimi/PascalCase map with canonical names only.

   Suggested shape:

   ```ts
   const CANONICAL_TOOL_SEGMENTS: Record<string, SegmentType> = {
     shell: 'shell',
     read: 'read',
     write: 'write',
     edit: 'edit',
     glob: 'glob',
     grep: 'grep',
     web_search: 'web_search',
     fetch: 'fetch',
     subagent: 'subagent',
     todo: 'todo',
   };
   ```

   Update comments from "wire tool name" to "canonical tool name".

   Unknown tool names should not silently become `read` without any diagnostic. Keep the UI from crashing, but add a visible development diagnostic such as a `console.warn` with the unknown name. Avoid introducing a large toast system in this slice unless one already exists locally and is easy to use.

2. Remove the server-side PascalCase websocket adapter.

   In `fusion-studio-server/lib/wire/message-router.js`, remove:

   ```text
   CANONICAL_TO_PASCAL_CASE
   adaptToolNameForWebsocket()
   adaptToolNameForWebsocket passed into createCanonicalHarnessEventBridge()
   comments saying the frontend still expects PascalCase
   ```

   The bridge should receive and apply canonical tool names unchanged.

3. Simplify `canonical-harness-event-bridge.js`.

   Remove the optional `adaptToolNameForWebsocket` dependency if it no longer has a caller.

   `tool_call` and `tool_result` should pass `event.toolName` directly into the applier payload.

4. Update tests.

   In `fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js`:

   - Update `tool_call` and `tool_result` tests to use canonical names such as `shell`.
   - Delete or replace the "tool name websocket compatibility adapter" test.
   - Add/keep an assertion that canonical names are passed unchanged.

   If there are frontend tests available locally, add a focused test for `toolNameToSegmentType()` canonical mapping and unknown-name warning. If there is no frontend unit-test setup, do not create one just for this slice.

5. Update stale comments.

   Relevant comments in `stream-handlers.ts` and `thread-handlers.ts` should say canonical tool names, not Kimi names or wire tags. Do not rewrite these files beyond comments and any type/import changes required by the canonical-only mapper.

## Acceptance Checks

Run these searches from repo root:

```bash
rg -n "ReadFile|WriteFile|EditFile|StrReplaceFile|SearchWeb|FetchURL|SetTodoList|TodoWrite|Agent|Task|PascalCase|CANONICAL_TO_PASCAL_CASE|adaptToolNameForWebsocket" fusion-studio-client/src/lib/instructions.ts fusion-studio-server/lib/wire fusion-studio-server/test/wire
```

Expected: no hits.

```bash
rg -n "Map wire tool name|frontend still expects PascalCase|websocket compatibility adapter|map\\[toolName\\] \\|\\| 'read'|\\|\\| 'read'" fusion-studio-client/src/lib/instructions.ts fusion-studio-server/lib/wire fusion-studio-server/test/wire
```

Expected: no stale compatibility comments and no silent `read` fallback in `toolNameToSegmentType()`.

```bash
rg -n "toolName: 'Shell'|toolName: 'ReadFile'|toolName: 'WriteFile'|toolName: 'EditFile'" fusion-studio-server/test/wire
```

Expected: no hits.

Canonical Kimi harness mapping should still exist at the harness boundary:

```bash
rg -n "ReadFile|WriteFile|EditFile|ToolResult|StatusUpdate|SubagentEvent" fusion-studio-server/lib/harness/kimi fusion-studio-server/lib/harness/kimi/__tests__
```

Expected: hits are OK in Kimi harness/parser/translator code and tests.

## Validation

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/lib/instructions.ts src/lib/ws/stream-handlers.ts src/lib/ws/thread-handlers.ts
```

Server focused:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/wire/canonical-harness-event-bridge.test.js test/wire/canonical-chat-event-applier.test.js test/ws/client-message-router.test.js lib/harness/kimi/__tests__/event-translator.test.js lib/harness/kimi/__tests__/harness-send-message.test.js
```

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

Then smoke at least:

1. Plain prompt.
2. Shell/tool prompt.
3. A read or write prompt if practical.

Confirm tool rows still render with the correct segment type and do not fall back to read.

## Report Back

Create:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-kimi-legacy-slice-n-frontend-canonical-tool-names-results.md
```

Include:

- Repo root confirmation.
- Git status before edits.
- Files changed.
- Exact validation commands and results.
- Acceptance-check search results.
- Manual smoke result, including skipped items and why.
- Any unknown tool-name warning behavior introduced.
- Risks/follow-up.

Do not commit unless explicitly instructed.
