# Folder Picker — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Replaces:** The text input in `WorkspaceAddModal.tsx`.
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

The workspace add flow currently uses a text input for the repo path. This spec replaces it with a visual folder picker that browses the filesystem from the device root (`/`). Click a folder, click Open.

The existing file explorer components (`FileTree`, `FolderNode`, etc.) are tightly coupled to `fileStore`, `panelStore`, and the `code-viewer` panel. Rather than force-fitting them, this spec creates a **self-contained folder picker** with its own lightweight message type, its own server handler, and its own client component. It can be reused anywhere a folder selection is needed.

---

## 2. Server side

### 2a. New message type: `folder:browse`

A new WebSocket message type for browsing arbitrary directories on the device. Unlike `file_tree_request` (which is panel-scoped and restricted to the workspace), this has no panel concept and no base path restriction.

**Request:**
```json
{
  "type": "folder:browse",
  "path": "/Users/rccurtrightjr./projects"
}
```

- `path` is an absolute directory path. Defaults to `/` if empty or omitted.

**Response:**
```json
{
  "type": "folder:browse_result",
  "path": "/Users/rccurtrightjr./projects",
  "folders": [
    { "name": "open-robin", "path": "/Users/rccurtrightjr./projects/open-robin", "hasChildren": true, "isRepo": true },
    { "name": "my-app", "path": "/Users/rccurtrightjr./projects/my-app", "hasChildren": true, "isRepo": false },
    { "name": "empty-dir", "path": "/Users/rccurtrightjr./projects/empty-dir", "hasChildren": false, "isRepo": false }
  ],
  "parent": "/Users/rccurtrightjr.",
  "success": true
}
```

**Key differences from `file_tree_request`:**
- **Folders only** — no files in the response.
- **Absolute paths** — every folder carries its full absolute path (no relative resolution needed).
- **`isRepo` flag** — true if the folder contains a `.git` directory. Visual hint for the user.
- **`parent` field** — the parent directory path, for the "go up" navigation. `null` when at `/`.
- **Shows dotfiles** — `.git` presence is checked but dotfile folders themselves (`.config`, etc.) are still hidden to reduce noise. Only top-level signal: `isRepo`.
- **No security restriction** — any readable directory. The user is trusted on their own machine (per the project threat model).

**Error:**
```json
{
  "type": "folder:browse_result",
  "path": "/nonexistent",
  "success": false,
  "error": "ENOENT: no such file or directory"
}
```

### 2b. Server handler

Add to the client-message-router, alongside the existing workspace routing block:

```js
// ---- Folder picker (FOLDER_PICKER_SPEC) ----

if (clientMsg.type === 'folder:browse') {
  const browsePath = clientMsg.path || '/';
  try {
    const resolved = path.resolve(browsePath);
    const entries = await fsPromises.readdir(resolved, { withFileTypes: true });

    const folders = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;      // hide dotfiles
      if (entry.name === 'node_modules') continue;   // noise

      const fullPath = path.join(resolved, entry.name);
      let hasChildren = false;
      let isRepo = false;
      try {
        const children = await fsPromises.readdir(fullPath);
        hasChildren = children.length > 0;
        isRepo = children.includes('.git');
      } catch (_) {}

      folders.push({
        name: entry.name,
        path: fullPath,
        hasChildren,
        isRepo,
      });
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));

    const parent = resolved === '/' ? null : path.dirname(resolved);
    ws.send(JSON.stringify({
      type: 'folder:browse_result',
      path: resolved,
      folders,
      parent,
      success: true,
    }));
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'folder:browse_result',
      path: browsePath,
      success: false,
      error: err.message,
    }));
  }
  return;
}
```

This is ~40 lines added to client-message-router.

---

## 3. Client side

### 3a. Component

```
src/components/FolderPicker.tsx
```

A modal/overlay component that renders a folder tree browser. Self-contained — no dependency on `fileStore`, `panelStore`, or the existing file explorer components.

### 3b. Props

```tsx
interface FolderPickerProps {
  open: boolean;
  onSelect: (absolutePath: string) => void;
  onCancel: () => void;
  initialPath?: string;   // defaults to '/'
}
```

### 3c. Internal state

```tsx
const [currentPath, setCurrentPath] = useState(initialPath || '/');
const [folders, setFolders] = useState<BrowseFolder[]>([]);
const [parent, setParent] = useState<string | null>(null);
const [selectedPath, setSelectedPath] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### 3d. Behavior

1. **On mount / path change**: sends `folder:browse` for `currentPath`. Populates `folders` from response.

2. **Folder click**: Two behaviors depending on state:
   - **Single click** → selects the folder (highlights it, sets `selectedPath`).
   - **Double click** → navigates into the folder (sets `currentPath`, triggers re-browse).

3. **"Up" button**: navigates to `parent` (if not null). Displayed as a row at the top of the list with a `arrow_upward` icon and the parent path.

4. **Breadcrumb bar**: shows `currentPath` split into clickable segments. Click any segment to jump to that level. e.g. `/` → `Users` → `rccurtrightjr.` → `projects`.

5. **"Open" button**: enabled when `selectedPath` is set. Calls `onSelect(selectedPath)`. Disabled when nothing is selected.

6. **"Cancel" button**: calls `onCancel()`.

7. **Keyboard**: Enter on selected folder → Open. Escape → Cancel. Arrow keys for navigation (future polish, not required for v1).

### 3e. Folder row rendering

Each row shows:
- **Folder icon**: `folder` (default), `source` (if `isRepo` — indicates a git repo).
- **Name**: the folder name.
- **Selected state**: background highlight using `var(--theme-primary)` at low opacity.
- **Hover state**: subtle background shift.

### 3f. Layout

```
┌─────────────────────────────────────────┐
│ Select Folder                     [✕]   │
├─────────────────────────────────────────┤
│ / › Users › rccurtrightjr. › projects   │  ← breadcrumb (clickable segments)
├─────────────────────────────────────────┤
│ ↑ ..                                    │  ← parent navigation
│ 📁 empty-dir                            │
│ 📁 my-app                               │
│ ⬡  open-robin                     ←selected (repo icon)
│ 📁 scratch                              │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ Selected: /Users/.../projects/open-robin│
│                        [Cancel] [Open]  │
└─────────────────────────────────────────┘
```

### 3g. Styling

- **Modal overlay**: same scrim as the workspace switcher (`rgba(0,0,0,0.3)`).
- **Picker container**: centered, 480px wide, 520px tall max, rounded corners.
- **Background**: `var(--bg-inset)` or `var(--document-code-bg)`.
- **Border**: `1px solid var(--neutral-chrome-border)`.
- **Z-index**: above everything (`var(--z-modal, 200)`).
- **Folder list**: scrollable area, `overflow-y: auto`.
- **Open button**: accent-colored (`var(--theme-primary)`), disabled state dimmed.

### 3h. Integration with WorkspaceAddModal

Replace the text input in `WorkspaceAddModal.tsx` with `<FolderPicker>`:

```tsx
<FolderPicker
  open={true}
  onSelect={(path) => {
    requestAdd(path);
    closeAddModal();
  }}
  onCancel={() => closeAddModal()}
  initialPath="/"
/>
```

Or replace `WorkspaceAddModal` entirely — the folder picker IS the add modal. The "Add Project" button in the switcher opens the folder picker directly. No intermediate modal needed.

---

## 4. Recommended initial path

Default to `/` as specified, but on macOS the user's home directory is more useful. Detect platform:

```ts
// The server can send the home directory in workspace:init
// or the client can use a reasonable default
const initialPath = '/Users';  // or just '/'
```

Better: the server includes `homePath` in the `workspace:init` message so the picker can start there:

```js
// In server.js workspace:init
ws.send(JSON.stringify({
  type: 'workspace:init',
  activeWorkspaceId: ...,
  workspaces: ...,
  homePath: require('os').homedir(),
}));
```

The picker uses `homePath` as its initial path if available, falls back to `/`.

---

## 5. Files changed

| File | Change |
|---|---|
| `src/components/FolderPicker.tsx` | **New** — ~180 lines |
| `src/components/WorkspaceAddModal.tsx` | Replace text input with FolderPicker (or delete and open picker directly from switcher) |
| `open-robin-server/lib/ws/client-message-router.js` | Add `folder:browse` handler (~40 lines) |
| `open-robin-server/server.js` | Add `homePath` to `workspace:init` message |

**Total:** 1 new file (~180 lines), 3 files edited.

---

## 6. Verification

1. Click menu button → workspace switcher opens.
2. Click "Add Project" → folder picker modal opens, showing `/Users` (or home dir).
3. Click a folder → it highlights (selected).
4. Double-click a folder → navigates into it, breadcrumb updates.
5. Click breadcrumb segment → jumps to that level.
6. Click "↑ .." → goes up one level.
7. Select a repo folder (shows git icon) → click Open → workspace added, picker closes.
8. Navigate to `/` → all top-level directories visible.
9. Try to browse a permission-denied directory → error displayed inline (not a crash).
