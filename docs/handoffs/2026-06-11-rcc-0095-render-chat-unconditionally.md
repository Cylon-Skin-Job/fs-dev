# RCC-0095 Handoff: Render Single Chat Independently Of View Folder Shape

**Date:** 2026-06-11
**Context:** AI Workspace Template V2 discussion
**Intent:** Reverse the current dependency where chat rendering depends on each view having properly formatted view folders or `chat/` marker folders.

## Product Decision

Fusion Studio should render the single project/workspace chat regardless of whether the active view has a perfectly formatted `ai/views/<view>/` folder.

The chat system is no longer a per-view capability. It is a workspace-level feature.

Current behavior still couples chat visibility to view discovery/config:

- `App.tsx` renders chat only when `config.hasChat` is true.
- `config.hasChat` comes from server-side view config.
- Server-side `resolveChatConfig()` currently requires `ai/views/<view>/chat/` to exist.

Desired behavior:

- The single project chat should render as part of the workspace shell.
- Missing/malformed view folders should not prevent chat from rendering.
- Missing/malformed view folders may affect `ContentArea`, but not the chat column/sidebar.
- Chat should not require `ai/views/<view>/chat/` folders.

## Current Chat Creation Flow

### 1. UI renders chat controls

File: `fusion-studio-client/src/components/App.tsx`

Current active project chat layout:

```tsx
<Sidebar panel={panel} scope="project" collapsed={collapsedSidebar} />
<ChatArea panel={panel} scope="project" collapsed={collapsedChat} sidebarCollapsed={collapsedSidebar} />
<ContentArea panel={panel} />
```

But it only renders inside `PanelContent` when `hasChat` is true.

Current gating:

```tsx
if (!hasChat) {
  return <ContentArea panel={panel} />;
}
```

And panel wrapper computes:

```tsx
const hasChat = !!config.hasChat;
const layoutClass = hasChat ? 'rv-layout-dual-chat' : 'rv-layout-full';
```

Problem:

- `config.hasChat` is still view-derived.
- A malformed/missing view config can remove chat from the shell.

Desired change:

- Render the single project chat independent of view config.
- Use a workspace-level/app-level chat availability flag if one is truly needed.
- Prefer default-on for normal workspaces.

### 2. User creates a thread

Files:

- `fusion-studio-client/src/components/sidebar/useSidebar.ts`
- `fusion-studio-client/src/components/chat/useChatArea.ts`
- `fusion-studio-client/src/state/panelStore.ts`

Both sidebar and chat header eventually call:

```ts
createDefaultAssistantThread(scope)
```

For the active single chat UI, `scope` is `project`.

Store action:

```ts
createDefaultAssistantThread: (scope) => {
  const s = get();
  set({
    connectingHarnessId: null,
    wireReady: false,
    currentThreadIds: { ...s.currentThreadIds, [scope]: null },
  });
  const ws = s.ws;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'thread:open-assistant', scope }));
  }
}
```

So new project chat sends:

```json
{ "type": "thread:open-assistant", "scope": "project" }
```

If multiple harnesses are selectable, `selectHarness(harnessId, scope)` sends:

```json
{ "type": "thread:open-assistant", "scope": "project", "harnessId": "..." }
```

### 3. Server receives `thread:open-assistant`

File: `fusion-studio-server/lib/ws/thread-ws-handlers.js`

Handler:

```js
async 'thread:open-assistant'(clientMsg) {
  const scope = clientMsg.scope === 'project' ? 'project' : 'view';
  ...
  await ThreadWebSocketHandler.handleThreadOpenAssistant(ws, clientMsg);
  ...
  await spawnAndSetupWire({ ..., threadId, scope, projectRoot });
}
```

For single chat, this should always be `project` from the active UI.

Cleanup goal:

- Remove default-to-view behavior after deleting legacy per-view chat.
- Invalid/missing scope should default to `project` or be rejected explicitly.

### 4. Thread CRUD creates the thread

File: `fusion-studio-server/lib/thread/thread-crud.js`

`handleThreadOpenAssistant()` chooses create vs resume.

Current scope default is legacy:

```js
const scope = msg.scope === 'project' ? 'project' : 'view';
```

If creating, `handleThreadCreate()`:

```js
const threadId = generateThreadId();
const policy = await resolveCliPolicy(manager.projectRoot);
const harnessId = msg.harnessId || policy.defaultHarness;

const { threadId: createdId, entry } = await manager.createThread(threadId, name, {
  harnessId,
  harnessConfig: msg.harnessConfig
});

ws.send(JSON.stringify({
  type: 'thread:created',
  threadId: createdId,
  panel: state.viewName,
  scope,
  thread: entry
}));

await sendThreadList(ws, scope);
await handleThreadOpen(ws, { threadId: createdId }, scope, { closePrevious: true });
```

Important:

- Thread ID is timestamp-based, filesystem-safe.
- Thread metadata is written to SQLite.
- Markdown file is created immediately.
- Then the thread is opened and hydrated back to the client.

### 5. ThreadManager persists metadata and markdown

File: `fusion-studio-server/lib/thread/ThreadManager.js`

Create flow:

```js
const entry = await this.index.create(threadId, name, {
  ...options,
  projectId: this.projectId,
});

const chatFile = this._createChatFile(threadId);
await chatFile.write(name, []);
```

Metadata:

File: `fusion-studio-server/lib/thread/ThreadIndex.js`

Rows are stored in `threads` with:

```js
workspace_id
project_id // deprecated backward compat
scope
view_id
thread_id
name
harness_id
harness_config
```

For single chat, expected values should be:

```text
scope = project
view_id = null
```

Markdown:

File: `fusion-studio-server/lib/thread/ChatFile.js`

`ChatFile` writes frontmatter + transcript markdown. It auto-creates the parent directory:

```js
await fs.mkdir(path.dirname(this.filePath), { recursive: true });
```

So chat thread creation does not require the chat directory to pre-exist.

### 6. Current chat storage location

File: `fusion-studio-server/lib/thread/ThreadManager.js`

Current `_getViewsDir()`:

```js
const baseViews = path.join(this.projectRoot, 'ai', 'views');
if (this.scope === 'project') {
  return path.join(baseViews, 'chat', 'threads', getUsername());
}
return path.join(baseViews, this.viewId, 'chat', 'threads', getUsername());
```

Current single-chat markdown location:

```text
ai/views/chat/threads/<user>/<threadId>.md
```

Legacy per-view markdown location:

```text
ai/views/<view>/chat/threads/<user>/<threadId>.md
```

Desired near-term behavior:

- Keep project chat creation working at the current single-chat location until RCC-0095 v2 storage is implemented.
- Delete the per-view branch separately or as part of the per-view chat cleanup.
- Do not require `ai/views/chat/threads` to pre-exist, because `ChatFile.ensureDir()` creates parents.

Desired v2 behavior:

- Move single chat storage out of `Views/` entirely.
- Likely target:

```text
ai/<user-machine>/Chat/threads/<user>/<threadId>.md
```

or another agreed `Chat/` shape.

## Current Hydration Flow

After creation, `handleThreadOpen()` sends:

```js
ws.send(JSON.stringify({
  type: 'thread:opened',
  threadId,
  panel: state.viewName,
  scope,
  thread: thread.entry,
  history: history?.messages || [],
  exchanges,
  liveTurn,
  contextUsage
}));
```

Client file: `fusion-studio-client/src/lib/ws/thread-handlers.ts`

`thread:opened` handler:

```ts
store.setCurrentThreadId(scope, msg.threadId);
store.setCurrentScope(scope);
store.clearChat(scope, msg.threadId);

if (msg.exchanges?.length > 0) {
  convertExchangesToMessages(scope, msg.threadId, msg.exchanges);
} else if (msg.history?.length > 0) {
  convertHistoryToMessages(scope, msg.threadId, msg.history);
}
overlayLiveTurn(scope, msg.threadId, msg.liveTurn, msg.exchanges);
```

Project chat state is keyed by thread ID:

```ts
state.projectChats[threadId]
```

`ChatArea` selects:

```ts
const selector = selectChatState(scope, panel, currentThreadId);
```

For project scope:

```ts
return tid ? state.projectChats[tid] : undefined;
```

This means rendering a project chat thread does not intrinsically need a valid view folder. The current dependency is caused by layout/config gating, not by chat state hydration itself.

## Bootstrap Coupling To Remove Or Reduce

File: `fusion-studio-server/lib/workspace/bootstrap-service.js`

Current bootstrap creates:

```js
const DIRS = [
  'ai/views',
  'ai/views/chat',
  'ai/views/chat/threads',
  'ai/system/workspace',
];
```

Comment says it creates folders so “views render and chat has somewhere to write threads.”

Reality:

- `ChatFile.ensureDir()` already creates parent folders for the markdown file.
- Chat should not require view folders to render.

Near-term cleanup:

- Stop treating `ai/views/chat/threads` as required bootstrap structure if possible.
- Be careful if other validation still expects these paths.

V2 cleanup:

- Bootstrap should target `ai/<user-machine>/Chat/`, not `ai/views/chat/`.

## Implementation Direction

### Client

1. Make project chat render independent of `config.hasChat`.
2. Keep content rendering tolerant of missing/malformed view config.
3. Rename/remove CSS class names that imply dual-chat only if safe; otherwise leave visual classes for a later cleanup.
4. Keep secondary chat working; it currently uses project scope.
5. Default thread scope should be project everywhere the single chat UI creates/opens/touches threads.

### Server

1. Stop using `resolveChatConfig()` to decide whether the single chat exists.
2. Do not require `ai/views/<view>/chat/` marker folders.
3. Change scope defaults from legacy `view` to `project`, or reject missing scope explicitly.
4. Keep project thread list/open/create available even if the current view failed to load.
5. Preserve current project thread persistence until the RCC-0095 v2 `Chat/` location is implemented.

## Files To Start With

Client:

- `fusion-studio-client/src/components/App.tsx`
- `fusion-studio-client/src/components/ChatArea.tsx`
- `fusion-studio-client/src/components/Sidebar.tsx`
- `fusion-studio-client/src/components/sidebar/useSidebar.ts`
- `fusion-studio-client/src/components/chat/useChatArea.ts`
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
- `fusion-studio-client/src/state/panelStore.ts`
- `fusion-studio-client/src/state/slices/chatSlice.ts`

Server:

- `fusion-studio-server/lib/views/index.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/thread-ws-handlers.js`
- `fusion-studio-server/lib/thread/thread-crud.js`
- `fusion-studio-server/lib/thread/ThreadManager.js`
- `fusion-studio-server/lib/thread/ThreadWebSocketHandler.js`
- `fusion-studio-server/lib/thread/thread-manager-registry.js`
- `fusion-studio-server/lib/workspace/bootstrap-service.js`

## Verification

- Remove or temporarily rename a per-view `chat/` marker folder and confirm chat still renders.
- Open a workspace where a view folder is incomplete and confirm project chat still renders.
- Create a new thread from the chat UI.
- Confirm SQLite row has `scope='project'` and `view_id IS NULL`.
- Confirm markdown is written to the current single-chat location.
- Switch views and confirm the same project chat thread remains accessible.
- Confirm secondary chat still opens.

## Important Constraint

Do not move chat storage into the new RCC-0095 v2 `Chat/` path as part of the immediate UI decoupling unless explicitly assigned. First decouple rendering from views. Storage migration can be a separate slice.
