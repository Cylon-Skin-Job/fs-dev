# RCC-0095 Handoff: Delete Legacy Per-View Chat Plumbing

**Date:** 2026-06-11
**Context:** AI Workspace Template V2 discussion
**Intent:** Remove obsolete dual-chat/per-view-chat assumptions. Fusion Studio now uses a single project/workspace chat paradigm.

## Summary

The repository still contains server and client plumbing for an older dual chat model:

- Project-scoped chat: shared workspace/project chat.
- View-scoped chat: separate chat tied to each view folder.

The product direction is single chat only. The per-view chat model was replaced a long time ago and should be deleted, not migrated into the v2 `ai/<user-machine>/` schema.

The current `ai/views/<view>/chat/` folders are misleading legacy artifacts. For example, `ai/views/doc-viewer/chat/settings/` is empty, but server code still treats `ai/views/doc-viewer/chat/` as a capability marker.

## Important Finding

The main React layout only renders project-scoped chat.

Current active layout in `fusion-studio-client/src/components/App.tsx`:

```tsx
<Sidebar panel={panel} scope="project" collapsed={collapsedSidebar} />
<ChatArea panel={panel} scope="project" collapsed={collapsedChat} sidebarCollapsed={collapsedSidebar} />
```

There is no normal visible UI path rendering:

```tsx
<Sidebar panel={panel} scope="view" />
<ChatArea panel={panel} scope="view" />
```

So the codebase still has view-scope plumbing, but the active UI no longer exposes a per-view chat column.

## Current Legacy Behavior To Remove

### 1. Per-view chat folder as capability marker

File: `fusion-studio-server/lib/views/index.js`

Function: `resolveChatConfig(projectRoot, viewId)`

Current behavior:

```js
const chatMarker = path.join(view.viewRoot, 'chat');
if (!fs.existsSync(chatMarker)) return null;
```

This makes `ai/views/<view>/chat/` control whether a view reports `hasChat: true`.

Desired direction:

- Stop using per-view `chat/` folders as a marker.
- Single chat availability should not depend on empty folders inside each view.
- If a view needs to opt in/out of showing the single chat panel, use explicit view metadata/config, not a `chat/` directory.
- For the current app, likely all normal workspace views with chat-capable layout can use the single project chat directly.

### 2. View-scoped thread storage

File: `fusion-studio-server/lib/thread/ThreadManager.js`

Function: `_getViewsDir()`

Current behavior:

```js
if (this.scope === 'project') {
  return path.join(baseViews, 'chat', 'threads', getUsername());
}
return path.join(baseViews, this.viewId, 'chat', 'threads', getUsername());
```

This preserves obsolete view-scoped markdown storage:

```text
ai/views/<view>/chat/threads/<user>/
```

Desired direction:

- Delete the view-scoped markdown storage branch.
- Keep only the single shared chat location until RCC-0095 v2 moves it.
- Current legacy single-chat location is:

```text
ai/views/chat/threads/<user>/
```

- Future v2 location should be decided separately, likely under:

```text
ai/<user-machine>/Chat/
```

Do not preserve per-view chat storage in the v2 template.

### 3. Client scope support for view chat

Files observed:

- `fusion-studio-client/src/components/App.tsx`
- `fusion-studio-client/src/components/Sidebar.tsx`
- `fusion-studio-client/src/components/sidebar/useSidebar.ts`
- `fusion-studio-client/src/components/chat/useChatArea.ts`
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
- `fusion-studio-client/src/state/panelStore.ts`
- `fusion-studio-client/src/state/slices/chatSlice.ts`

Current state:

- Components and state types still accept `scope: 'view' | 'project'`.
- Main app layout passes only `scope="project"`.
- Some comments say things like `SECONDARY_CHAT_SPEC: view-scope narrowed to agents-viewer` or preserve old SPEC-26 behavior.

Desired direction:

- Remove or simplify view-scope chat paths if no remaining active feature uses them.
- Make project/workspace chat the only normal scope.
- Keep caution around secondary chat: secondary chat currently uses project scope too and should not be broken.

## Server Files To Audit

Start with these exact files:

- `fusion-studio-server/lib/views/index.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/thread/ThreadManager.js`
- `fusion-studio-server/lib/thread/ThreadWebSocketHandler.js`
- `fusion-studio-server/lib/thread/thread-manager-registry.js`
- `fusion-studio-server/lib/thread/thread-crud.js`
- `fusion-studio-server/lib/thread/thread-messages.js`
- `fusion-studio-server/lib/thread/thread-runtime-controller.js`
- `fusion-studio-server/lib/chat-scope.js`
- `fusion-studio-server/lib/harness/kimi/index.js`
- `fusion-studio-server/lib/harness/clis/base-cli-harness.js`
- `fusion-studio-server/lib/wire/message-router.js`
- `fusion-studio-server/lib/wire/canonical-chat-event-applier.js`

Useful search terms:

```text
scope === 'view'
scope='view'
currentScope
currentViewId
getViewThreadManager
ai/views/<view>/chat
view-scoped
view scope
```

## Client Files To Audit

Start with these exact files:

- `fusion-studio-client/src/components/App.tsx`
- `fusion-studio-client/src/components/Sidebar.tsx`
- `fusion-studio-client/src/components/sidebar/useSidebar.ts`
- `fusion-studio-client/src/components/chat/useChatArea.ts`
- `fusion-studio-client/src/components/ThreadJumpDropdown.tsx`
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
- `fusion-studio-client/src/state/panelStore.ts`
- `fusion-studio-client/src/state/panelStoreTypes.ts`
- `fusion-studio-client/src/state/slices/chatSlice.ts`
- `fusion-studio-client/src/types/index.ts`

Useful search terms:

```text
scope: 'view'
scope="view"
Scope
currentScope
currentThreadIds.view
threads.view
panels[panel]
```

## Workspace Folder Cleanup Implication

After code stops requiring per-view chat folders, remove empty legacy markers from workspace/template content:

- `ai/views/*/chat/` when only used as empty marker/settings shell.
- `System Source Files/ai-template/ai/views/*/chat/` if present.
- Do not delete actual thread markdown without checking whether it contains user data.

Known example checked during this handoff:

```text
ai/views/doc-viewer/chat/settings/
```

It exists but contains no files.

## RCC-0095 V2 Schema Decision

Do not carry `Views/<viewer>/chat/` into the canonical v2 template.

In v2, `Views/` should hold only view registration, layout, appearance, and UI state:

```text
Views/001-doc-viewer/
  styles/layout.json
  state/state.json
```

Chat belongs in the top-level category:

```text
Chat/
```

The exact v2 `Chat/` shape can be decided later, but it should represent the single workspace chat paradigm, not per-view chat.

## Verification Suggestions

After deleting legacy view-chat code:

- Start the app and switch between normal views.
- Confirm each chat-capable view still shows the single project/workspace chat.
- Create a new thread and confirm it persists in the single chat location.
- Open an existing project-scoped thread after switching views.
- Confirm secondary chat still opens and uses project scope.
- Confirm no code path creates `ai/views/<view>/chat/threads/`.
- Confirm empty `ai/views/<view>/chat/` folders are no longer required for `hasChat`.

## Caution

There are many comments/spec references around `SPEC-24c`, `SPEC-26b`, and `SECONDARY_CHAT_SPEC`. Treat them as historical unless they describe the current single-chat UI. The current product decision is single chat only.
