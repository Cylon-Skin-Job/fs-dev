# Phase 2 Handoff: Client Store + WS Plumbing for Recent Docs

## Project Context

- **Project root**: `/Users/rccurtrightjr./projects/fs-dev`
- **Client**: `fusion-studio-client/` (React + Vite, TypeScript)
- **State**: Zustand stores in `src/state/` — `fileDataStore.ts` is the pattern to follow
- **WS handlers**: `src/lib/ws/*.ts` — each domain has a handler file returning `boolean`
- **WS dispatch**: `src/lib/ws-client.ts` → `sendFusionMessage()` sends, `handleXMessage()` routes receives
- **Types**: `src/types/index.ts` has `WebSocketMessageType` union; `src/types/file-explorer.ts` has file-specific types
- **Panel ID**: `'office-viewer'` (constant `PANEL` in OfficeGrid.tsx)
- **Phase 1 status**: ✅ Server layer complete. DB table `recent_docs` exists. WS handlers respond to `recent_docs:list`, `recent_docs:record`, `recent_docs:clear`.

## Phase 2 Scope

Build the client-side state layer, wire WebSocket messages, and start recording opens from the folder grid. **No UI changes to the document page yet** — that is Phase 3.

---

## Files to Create (2)

### 1. Store: `fusion-studio-client/src/state/recentDocsStore.ts`

```ts
/**
 * @module recentDocsStore
 * @role Track recently opened office-viewer documents + 3s promotion delay
 *
 * Reads list from server. Writes record events (immediate or delayed).
 * Does NOT duplicate file content — previews come from fileDataStore.contents.
 */

import { create } from 'zustand';
import { sendFusionMessage } from '../lib/ws-client';

export interface RecentDoc {
  id: number;
  workspaceId: string;
  path: string;
  folder: string;
  name: string;
  panel: string;
  openedAt: number;
}

interface RecentDocsState {
  recentDocs: RecentDoc[];
  highlightedPath: string | null;

  setRecentDocs: (items: RecentDoc[]) => void;
  recordOpen: (doc: Pick<RecentDoc, 'workspaceId' | 'path' | 'folder' | 'name' | 'panel'>) => void;
  previewSelect: (path: string) => void;
  cancelPreviewSelect: () => void;
  loadRecentDocs: (workspaceId: string) => void;
}

export const useRecentDocsStore = create<RecentDocsState>((set, get) => {
  let promoteTimer: ReturnType<typeof setTimeout> | null = null;
  let promoteTarget: string | null = null;

  return {
    recentDocs: [],
    highlightedPath: null,

    setRecentDocs: (items) => set({ recentDocs: items }),

    recordOpen: ({ workspaceId, path, folder, name, panel }) => {
      sendFusionMessage({ type: 'recent_docs:record', workspaceId, panel, path, folder, name });
    },

    previewSelect: (path) => {
      set({ highlightedPath: path });
      if (promoteTimer) clearTimeout(promoteTimer);
      promoteTarget = path;
      promoteTimer = setTimeout(() => {
        if (promoteTarget === path) {
          const doc = get().recentDocs.find((d) => d.path === path);
          if (doc) {
            sendFusionMessage({
              type: 'recent_docs:record',
              workspaceId: doc.workspaceId,
              panel: doc.panel,
              path: doc.path,
              folder: doc.folder,
              name: doc.name,
            });
          }
          set({ highlightedPath: null });
          promoteTarget = null;
        }
      }, 3000);
    },

    cancelPreviewSelect: () => {
      if (promoteTimer) clearTimeout(promoteTimer);
      promoteTimer = null;
      promoteTarget = null;
      set({ highlightedPath: null });
    },

    loadRecentDocs: (workspaceId) => {
      sendFusionMessage({ type: 'recent_docs:list', workspaceId });
    },
  };
});
```

### 2. WS Handlers: `fusion-studio-client/src/lib/ws/recent-docs-handlers.ts`

```ts
/**
 * @module recent-docs-handlers
 * @role Handle incoming recent_docs:* WebSocket messages
 */

import { useRecentDocsStore } from '../../state/recentDocsStore';
import type { WebSocketMessage } from '../../types';

export function handleRecentDocsMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'recent_docs:list':
    case 'recent_docs:updated': {
      const m = msg as any;
      if (m.items && Array.isArray(m.items)) {
        useRecentDocsStore.getState().setRecentDocs(m.items);
      }
      return true;
    }

    case 'recent_docs:cleared': {
      useRecentDocsStore.getState().setRecentDocs([]);
      return true;
    }

    default:
      return false;
  }
}
```

---

## Files to Modify (3)

### 3. `fusion-studio-client/src/types/index.ts`

**Extend the `WebSocketMessageType` union** (~line 64) by adding these 7 entries:

```ts
  | 'recent_docs:list'
  | 'recent_docs:record'
  | 'recent_docs:clear'
  | 'recent_docs:updated'
  | 'recent_docs:cleared'
  | 'recent_docs:error'
```

Add them anywhere in the union, grouped together. For example, after the clipboard group (~line 107):

```ts
  // Recent docs messages
  | 'recent_docs:list'
  | 'recent_docs:record'
  | 'recent_docs:clear'
  | 'recent_docs:updated'
  | 'recent_docs:cleared'
  | 'recent_docs:error'
```

### 4. `fusion-studio-client/src/lib/ws-client.ts`

**Add import** near the other handler imports (~line 17):

```ts
import { handleRecentDocsMessage } from './ws/recent-docs-handlers';
```

**Add to message pipeline** in `handleMessage()` (~line 137):

```ts
  if (handleRecentDocsMessage(msg)) return;
```

Place it after `handleScreenshotMessage(msg)` and before the `state:result` block.

### 5. `fusion-studio-client/src/components/office/OfficeGrid.tsx`

**Add import** near the other state imports (~line 16):

```ts
import { useRecentDocsStore } from '../../state/recentDocsStore';
import { usePanelStore } from '../../state/panelStore';
```

**Add recording to `handleFileClick`** (~line 98). Replace the existing function:

```ts
  const handleFileClick = useCallback((file: FileWithContent) => {
    setSelectedFile(file);

    // Record in recent docs (markdown only)
    if (isMarkdownDocument(file) && currentFolder) {
      const workspaceId = usePanelStore.getState().activeWorkspaceId ?? '';
      if (workspaceId) {
        useRecentDocsStore.getState().recordOpen({
          workspaceId,
          panel: PANEL,
          path: file.path,
          folder: currentFolder,
          name: file.name,
        });
      }
    }
  }, [currentFolder]);
```

> **Important:** `usePanelStore.getState().activeWorkspaceId` may be `null` during early boot. Guard with `if (workspaceId)` to avoid sending empty workspace IDs to the server.

---

## Smoke Tests

After all files are created/modified, build the client and run these:

### Test 2.1 — Store loads on connect
```
1. Start server (from Phase 1)
2. Open client in browser, navigate to Office Viewer
3. Open browser DevTools → Network → WS
4. Observe outgoing frame: { type: 'recent_docs:list', workspaceId: '...' }
```
**Expected:** Frame sent within ~1s of panel load. Server responds with `recent_docs:list` containing items/total.

### Test 2.2 — Folder-grid click records immediately
```
1. Open a folder in Office Viewer
2. Click a markdown file
3. Check WS frames
```
**Expected:** Outgoing `recent_docs:record` frame sent immediately. Server broadcasts `recent_docs:updated` to all clients.

### Test 2.3 — Non-markdown files ignored
```
1. Create a `.json` file in an office-viewer folder (or use existing non-md)
2. Click it
```
**Expected:** No `recent_docs:record` frame sent. File opens in `FilePageView` normally.

### Test 2.4 — Store populates from broadcast
```
1. Open client in Browser A
2. Open client in Browser B (or use wscat)
3. From B, send a raw recent_docs:record for the same workspace
4. Check Browser A
```
**Expected:** Browser A receives `recent_docs:updated` and `recentDocsStore.recentDocs` updates (verify via React DevTools Zustand plugin or console log).

### Test 2.5 — Workspace switch resets list
```
1. Open Office Viewer, verify recent docs list has items
2. Switch workspace via workspace picker
3. Check recentDocsStore state
```
**Expected:** `recentDocsStore.recentDocs` resets to `[]`. New `recent_docs:list` request sent for new workspace.

### Test 2.6 — Client builds without errors
```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```
**Expected:** Clean build, no TypeScript errors.

---

## Report Template

After implementing Phase 2, copy and paste this filled-in report back to the parent session:

```markdown
## Phase 2 Implementation Report

### Files Created
- [ ] `fusion-studio-client/src/state/recentDocsStore.ts`
- [ ] `fusion-studio-client/src/lib/ws/recent-docs-handlers.ts`

### Files Modified
- [ ] `fusion-studio-client/src/types/index.ts`
- [ ] `fusion-studio-client/src/lib/ws-client.ts`
- [ ] `fusion-studio-client/src/components/office/OfficeGrid.tsx`

### Smoke Test Results
| Test | Result | Notes |
|------|--------|-------|
| 2.1 Store loads on connect | PASS / FAIL | |
| 2.2 Folder-grid click records | PASS / FAIL | |
| 2.3 Non-markdown ignored | PASS / FAIL | |
| 2.4 Cross-client broadcast | PASS / FAIL | |
| 2.5 Workspace switch reset | PASS / FAIL | |
| 2.6 Build clean | PASS / FAIL | |

### Issues Encountered
[Describe any deviations from spec, unexpected errors, or design changes made]

### Next Phase Readiness
[Is the client plumbing solid enough to hand off Phase 3 (UI integration: ribbon removal + recent panel rendering)?]
```
