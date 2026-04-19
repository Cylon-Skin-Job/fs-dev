# Workspace Client UI — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Implements:** `MULTI_WORKSPACE_SPEC.md` §6b, §7, §2 (empty state).
**Depends on:** `WORKSPACE_CONTROLLER_SPEC.md` (landed — server-side CRUD is live).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

The server-side workspace infrastructure is complete: controller, broadcaster, client routing, lifecycle tracking. But the user can't see or interact with any of it — there's no UI for switching workspaces, adding new ones, or handling the empty state.

This spec adds the client-side workspace layer:
- A **workspace store** that tracks the registry and active workspace.
- A **workspace switcher** triggered by the existing menu button.
- An **add workspace flow** with folder path input.
- A **duplicate rejection modal**.
- An **empty state** when no workspaces exist.
- The **server-side switchover** that makes `projectRoot` change when the active workspace changes.

---

## 2. Workspace store

### 2a. File

```
src/state/workspaceStore.ts
```

New Zustand store, separate from `panelStore`. Workspace state is a higher level than panel state — panels exist within a workspace.

### 2b. Shape

```ts
interface Workspace {
  id: string;
  label: string;
  icon: string;
  description: string | null;
  repo_path: string;
  sort_order: number;
}

interface WorkspaceState {
  // Registry
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  // UI
  switcherOpen: boolean;
  addModalOpen: boolean;

  // Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  openSwitcher: () => void;
  closeSwitcher: () => void;
  openAddModal: () => void;
  closeAddModal: () => void;

  // Server requests (send via WebSocket)
  requestSwitch: (workspaceId: string) => void;
  requestAdd: (repoPath: string) => void;
  requestRemove: (workspaceId: string) => void;
}
```

### 2c. Server request actions

These send WebSocket messages that the client-message-router (Gap 3) routes to the bus:

```ts
requestSwitch: (workspaceId) => {
  const ws = usePanelStore.getState().ws;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'workspace:switch_requested', workspaceId }));
  }
},
requestAdd: (repoPath) => {
  const ws = usePanelStore.getState().ws;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'workspace:add_requested', repoPath }));
  }
},
requestRemove: (workspaceId) => {
  const ws = usePanelStore.getState().ws;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'workspace:remove_requested', workspaceId }));
  }
},
```

**Note:** The store reads `ws` from `panelStore` (cross-store read). This avoids duplicating the WebSocket reference. The stores are separate but the socket is shared.

---

## 3. WebSocket message handling

### 3a. New handler module

```
src/lib/ws/workspace-handlers.ts
```

Follows the same pattern as `thread-handlers.ts` and `stream-handlers.ts`: receives a parsed message, returns `true` if handled.

```ts
import { useWorkspaceStore } from '../../state/workspaceStore';
import { showModal } from '../modal';

export function handleWorkspaceMessage(msg: WebSocketMessage): boolean {
  const store = useWorkspaceStore.getState();

  switch (msg.type) {
    case 'workspace:registry_changed':
      store.setWorkspaces(msg.workspaces);
      return true;

    case 'workspace:switched':
      store.setActiveWorkspaceId(msg.to);
      store.closeSwitcher();
      // Trigger re-discovery (§5)
      return true;

    case 'workspace:added':
      // Registry will update via workspace:registry_changed (emitted right after)
      store.closeAddModal();
      store.closeSwitcher();
      return true;

    case 'workspace:removed':
      // Registry will update via workspace:registry_changed
      return true;

    case 'workspace:add_rejected_duplicate':
      store.closeAddModal();
      showModal({
        modalType: 'workspace-duplicate',
        title: 'Already registered',
        message: `This repo is already registered as "${msg.existingWorkspace?.label}".`,
        actions: [
          { label: 'Switch to it', action: () => store.requestSwitch(msg.existingWorkspace.id) },
          { label: 'Cancel', action: () => {} },
        ],
      });
      return true;

    case 'workspace:culled_at_launch':
      // Silent — no UI. Logged server-side.
      return true;

    case 'thread:state_changed':
      // Available for future UI (e.g. activity indicators). No-op for now.
      return true;

    default:
      return false;
  }
}
```

### 3b. Wire into ws-client.ts

In `handleMessage()`, add the workspace handler before the existing switch statement:

```ts
if (handleWorkspaceMessage(msg)) return;
```

This goes after `handleFileMessage(msg)` and before the `state:result` check.

---

## 4. Workspace switcher

### 4a. Component

```
src/components/WorkspaceSwitcher.tsx
```

A slide-out panel (or dropdown) triggered by the existing menu button in the header. Contains:

1. **Active workspace indicator** — name + icon at the top.
2. **Workspace list** — all registered workspaces, sorted by `sort_order`. Active workspace is highlighted. Click to switch.
3. **Add button** — "Add Project" button at the bottom. Opens the add modal.
4. **Remove action** — context menu or trash icon per workspace. Confirmation before removing.
5. **Close** — click outside, Escape, or click menu button again.

### 4b. Layout

The switcher overlays the left edge of the app (over the tools panel), similar to how mobile app drawers work. It does NOT push content — it floats on top with a scrim behind it.

```
┌──────────────────────────────────────────────┐
│ Header (menu btn highlighted)                │
├─────────────┬────────────────────────────────┤
│ Switcher    │                                │
│ ┌─────────┐ │  (scrim overlay)               │
│ │ ● Robin │ │                                │
│ │   My App│ │                                │
│ │   Other │ │                                │
│ ├─────────┤ │                                │
│ │ + Add   │ │                                │
│ └─────────┘ │                                │
├─────────────┴────────────────────────────────┤
```

### 4c. Styling

- Width: 260px fixed.
- Background: `var(--bg-inset)` or `var(--document-code-bg)`.
- Border-right: `1px solid var(--neutral-chrome-border)`.
- Z-index: above tools panel, below modals (`var(--z-drawer, 100)`).
- Transition: slide in from left, 200ms ease.
- Scrim: `rgba(0,0,0,0.3)` covering the rest of the viewport. Click to close.

### 4d. Workspace list item

Each item shows:
- Material icon (from workspace `icon` field).
- Label.
- Active indicator (left accent bar or background highlight using `var(--theme-primary)`).
- On hover: remove button (trash icon) appears at the right edge.

### 4e. Menu button wiring

The menu button in `App.tsx` (line 185) currently does nothing. Wire it to toggle the switcher:

```tsx
<button className="rv-menu-btn" onClick={() => {
  const { switcherOpen, openSwitcher, closeSwitcher } = useWorkspaceStore.getState();
  switcherOpen ? closeSwitcher() : openSwitcher();
}}>
```

---

## 5. Workspace switching — what happens

When the user clicks a workspace in the switcher:

### 5a. Client side

1. `requestSwitch(workspaceId)` sends `workspace:switch_requested` over WebSocket.
2. Server's workspace-controller handles it, emits `workspace:switched { from, to }`.
3. Workspace-broadcaster delivers `workspace:switched` to client.
4. `workspace-handlers.ts` receives it, calls `setActiveWorkspaceId(to)`.
5. **Re-discovery**: the client must re-discover panels for the new workspace. This means:
   a. Clear `panelConfigs` in panelStore (triggers loading state briefly).
   b. Send `set_panel` for the new workspace's default panel.
   c. Re-run `loadAllPanels(ws)` to discover the new workspace's views.
   d. `setPanelConfigs(configs)` populates the new panels.

### 5b. Server side — the projectRoot switchover

This is the critical piece. Today, `projectRoot` is set once per connection in `server.js` line 262:
```js
const projectRoot = getDefaultProjectRoot();
```

When a workspace switch happens, the connection's `projectRoot` must change to the new workspace's `repo_path`. The approach:

1. The workspace-controller resolves the new workspace's `repo_path` from the registry.
2. It emits `workspace:switched` with an additional field: `repoPath`.
3. The client-message-router (or a new subscriber) listens for `workspace:switched` and updates the per-connection session:
   ```js
   session.projectRoot = event.repoPath;
   ```
4. All subsequent operations on this connection (`set_panel`, `file_tree_request`, `thread:open-assistant`, etc.) use the new `session.projectRoot`.

**But:** the current code uses the module-level `projectRoot` const (line 262), not `session.projectRoot`. The fix:

- Add `projectRoot` to the session object (alongside `currentWorkspaceId`, `currentViewId`).
- Initialize it from `getDefaultProjectRoot()` at connection time.
- Update it on workspace switch.
- Change the client-message-router and wire lifecycle to read `session.projectRoot` instead of the closure variable.

This is the most invasive change in this spec, but it's contained to the per-connection code path. The module-level `getDefaultProjectRoot()` stays as the fallback.

### 5c. Server-side workspace switch handler addition

Add a bus subscriber in `server.js` (or a small helper) that updates per-connection state on workspace switch. Since `workspace:switched` is broadcast to all clients but each connection has its own session, the subscriber runs per-connection:

```js
// In the wss.on('connection') block, after session creation:
on('workspace:switched', (event) => {
  // Update this connection's project root
  if (event.repoPath) {
    session.projectRoot = event.repoPath;
    session.currentWorkspaceId = event.to;
  }
});
```

**Alternative:** handle this in the client-message-router when it receives `workspace:switch_requested`, before emitting to the bus. The router already has access to `session`. The workspace-controller responds with the `repoPath`, and the router updates the session. This avoids per-connection bus subscriptions.

The cleaner path: the workspace-controller emits `workspace:switched` with `repoPath` in the payload. A new per-connection handler in `server.js` subscribes and updates the session. This keeps the controller pure (it doesn't know about sessions) and the session update co-located with session creation.

### 5d. Panel re-discovery after switch

After the session's `projectRoot` changes, the server needs to re-send the panel list for the new workspace. The client triggers this by sending `set_panel` after receiving `workspace:switched`. But the panel discovery also needs the `__panels__` file tree from the new workspace.

Sequence:
1. Client receives `workspace:switched`.
2. Client calls `loadAllPanels(ws)` again (re-discovery).
3. `loadAllPanels` sends `file_tree_request` for `__panels__`.
4. Server resolves `__panels__` using the now-updated `session.projectRoot`.
5. Client receives the new workspace's panel list.
6. Client sends `set_panel` for the first panel.
7. Server resolves the panel path using `session.projectRoot`.

This works because the session's `projectRoot` was already updated in step 5b before the client's re-discovery request arrives.

---

## 6. Add workspace flow

### 6a. Add modal component

```
src/components/WorkspaceAddModal.tsx
```

A simple modal with:
- Text input for the repo path (absolute path).
- "Add" button (calls `requestAdd(path)`).
- "Cancel" button (closes modal).

**No folder picker.** Electron's `dialog.showOpenDialog` would be ideal but we're not in Electron yet. For now, the user pastes an absolute path. When Electron ships, this becomes a native folder picker.

### 6b. Validation

Client-side: check the string is non-empty and looks like an absolute path (starts with `/`). Server-side validation (path exists, not duplicate) is handled by the workspace-controller.

### 6c. Success flow

1. User enters path, clicks Add.
2. `workspace:add_requested` sent to server.
3. Server bootstraps `ai/` if needed, adds to registry.
4. Server emits `workspace:added` + `workspace:registry_changed`.
5. Client receives `workspace:added` → closes add modal and switcher.
6. Client receives `workspace:registry_changed` → updates workspace list.
7. User can now switch to the new workspace.

### 6d. Duplicate flow

1. User enters a path that's already registered.
2. Server emits `workspace:add_rejected_duplicate` (targeted to this client).
3. Client shows modal: "This repo is already registered as [name]. Switch to it?"
4. User clicks "Switch to it" → `requestSwitch(existingId)`.

---

## 7. Empty state

When `workspaceStore.workspaces.length === 0` and `activeWorkspaceId === null`:

- The app shell renders only the header (with menu button) and a centered "Add Project" tile.
- No tools panel, no sidebar, no chat, no content area.
- The menu button still opens the switcher (which shows only the "Add Project" button).
- The centered tile is a large folder icon + "Add Project" text. Click opens the add modal.

This matches MULTI_WORKSPACE_SPEC §2: "no sidebar, no panels, just the main content background with a single centered 'Add Project' folder tile."

### 7a. Detection

The app shell (`App.tsx`) reads `activeWorkspaceId` from `workspaceStore`:

```tsx
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

if (!activeWorkspaceId) {
  return <EmptyStateView />;
}
```

This check runs **before** the `loading` check (panel discovery). If there's no workspace, there's nothing to discover.

### 7b. Component

```
src/components/EmptyStateView.tsx
```

Minimal: centered container, folder icon, "Add Project" text, click handler opens the add modal.

---

## 8. Initial workspace load

On first connection, the client needs to know the current workspace state. Today the server sends `connected` and `panel_config` messages. We add a `workspace:init` message:

### 8a. Server sends workspace state on connection

In `server.js`, after the `connected` message, send the current workspace state:

```js
// After ws.send connected message...
const workspaceController = require('./workspace/workspace-controller');
const activeWs = await workspaceController.getActiveWorkspace();
const allWs = await workspaceController.listWorkspaces();
ws.send(JSON.stringify({
  type: 'workspace:init',
  activeWorkspaceId: workspaceController.getActiveWorkspaceId(),
  workspaces: allWs,
}));
```

### 8b. Client handles workspace:init

In `workspace-handlers.ts`:

```ts
case 'workspace:init':
  store.setWorkspaces(msg.workspaces);
  store.setActiveWorkspaceId(msg.activeWorkspaceId);
  return true;
```

This populates the workspace store before panel discovery runs. If `activeWorkspaceId` is null, the empty state renders immediately.

---

## 9. Remove confirmation

When the user clicks the trash icon on a workspace:

1. Show a confirmation modal: "Remove [workspace name]? This won't delete any files — the repo stays on disk."
2. On confirm: `requestRemove(workspaceId)`.
3. Server removes from registry, emits `workspace:removed` + `workspace:registry_changed`.
4. If the removed workspace was active, server auto-switches to the next one (or null).

---

## 10. Files changed

### New files

| File | Lines (est.) | Description |
|---|---|---|
| `src/state/workspaceStore.ts` | ~60 | Zustand store for workspace state |
| `src/lib/ws/workspace-handlers.ts` | ~50 | WebSocket message handler for workspace events |
| `src/components/WorkspaceSwitcher.tsx` | ~120 | Slide-out workspace list |
| `src/components/WorkspaceAddModal.tsx` | ~60 | Path input modal |
| `src/components/EmptyStateView.tsx` | ~30 | Centered "Add Project" tile |

### Edited files

| File | Change |
|---|---|
| `src/lib/ws-client.ts` | Add `handleWorkspaceMessage` to handler chain; handle `workspace:init` or delegate |
| `src/components/App.tsx` | Wire menu button to switcher toggle; add empty state gate; render `<WorkspaceSwitcher />` |
| `src/components/App.css` | Switcher slide-out styles, scrim, empty state styles |
| `open-robin-server/server.js` | Add `projectRoot` to session; send `workspace:init` on connection; add `workspace:switched` listener per connection |
| `open-robin-server/lib/ws/client-message-router.js` | Read `session.projectRoot` instead of closure `projectRoot` for workspace-aware path resolution |

### Total

**5 new files (~320 lines), 5 files edited.**

---

## 11. Implementation order

1. **workspaceStore.ts** — state and actions. No UI yet, just the data layer.
2. **workspace-handlers.ts** — wire into ws-client.ts. Can verify with DevTools (workspace events now handled instead of ignored).
3. **Server: `workspace:init` on connection** — client gets workspace state on connect.
4. **Server: session.projectRoot + workspace:switched listener** — the switchover.
5. **EmptyStateView.tsx** — the zero-workspaces case.
6. **WorkspaceSwitcher.tsx** — the slide-out panel. Wire menu button.
7. **WorkspaceAddModal.tsx** — the add flow.
8. **App.tsx integration** — empty state gate, switcher rendering, menu button wiring.
9. **client-message-router.js** — switch from closure `projectRoot` to `session.projectRoot`.

Steps 1-4 are structural (no UI visible). Steps 5-8 are the UI. Step 9 completes the switchover.

---

## 12. What this does NOT do

- **Electron native folder picker.** Uses a text input for now. Folder picker comes with Electron migration.
- **Display LRU eviction.** MULTI_WORKSPACE_SPEC §3a. The display layer caching is out of scope — every workspace switch does a full re-discovery. Performance optimization later.
- **Per-workspace themes.** Theme switching on workspace change is future work.
- **Drag-and-drop reorder.** `sort_order` field exists but the UI doesn't expose reordering.
- **Cross-workspace search.** Explicitly out of scope per MULTI_WORKSPACE_SPEC §10.
