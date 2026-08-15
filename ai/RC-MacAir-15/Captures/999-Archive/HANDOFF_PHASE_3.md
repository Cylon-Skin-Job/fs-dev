# Phase 3 Handoff: UI Integration for Recent Docs

## Project Context

- **Project root**: `/Users/rccurtrightjr./projects/fs-dev`
- **Client**: `fusion-studio-client/` (React + Vite, TypeScript)
- **Phase 1 status**: ✅ Server layer complete
- **Phase 2 status**: ✅ Client store + WS plumbing complete
- **Files from prior phases**:
  - `src/state/recentDocsStore.ts` — Zustand store with `recentDocs[]`, `highlightedPath`, `previewSelect()`, `recordOpen()`, `loadRecentDocs()`
  - `src/lib/ws/recent-docs-handlers.ts` — routes `recent_docs:list`/`updated`/`cleared` into store
  - Server handles `recent_docs:list`, `record`, `clear`

## Phase 3 Scope

Replace the sibling ribbon in `OfficeDocumentPage` with the recent docs list from `recentDocsStore`. Wire click handlers for instant open + 3-second promotion delay. Remove all `siblings`/`onSelectSibling` plumbing. Add highlighted tile styling.

---

## Files to Modify (4)

### 1. `fusion-studio-client/src/components/office/OfficeDocumentPage.tsx`

This is the largest change. Make these edits in order:

**a. Update imports** (~line 19). Add:
```ts
import { useRecentDocsStore } from '../../state/recentDocsStore';
import { usePanelStore } from '../../state/panelStore';
```

**b. Change `PendingNavigation` type** (~line 28). Replace:
```ts
type PendingNavigation =
  | { type: 'back' }
  | { type: 'sibling'; file: FileWithContent };
```
with:
```ts
type PendingNavigation =
  | { type: 'back' }
  | { type: 'file'; path: string; folder: string };
```

**c. Update props interface** (~line 38). Replace:
```ts
interface OfficeDocumentPageProps {
  file: FileWithContent;
  siblings: FileWithContent[];
  folder: string;
  folderName?: string;
  onBack: () => void;
  onSelectSibling: (file: FileWithContent) => void;
}
```
with:
```ts
interface OfficeDocumentPageProps {
  file: FileWithContent;
  folder: string;
  folderName?: string;
  onBack: () => void;
  onOpenFile: (path: string, folder: string) => void;
}
```

**d. Update destructuring** (~line 47). Replace:
```ts
export function OfficeDocumentPage({
  file,
  siblings,
  folder,
  folderName,
  onBack,
  onSelectSibling,
}: OfficeDocumentPageProps) {
```
with:
```ts
export function OfficeDocumentPage({
  file,
  folder,
  folderName,
  onBack,
  onOpenFile,
}: OfficeDocumentPageProps) {
```

**e. Change default side panel** (~line 62). Replace:
```ts
  const [sidePanel, setSidePanel] = useState<'none' | 'versions' | 'files'>('files');
```
with:
```ts
  const [sidePanel, setSidePanel] = useState<'none' | 'versions' | 'files'>('none');
```

**f. Add store subscriptions** after the existing store hooks (~line 70). Add:
```ts
  const recentDocs = useRecentDocsStore((s) => s.recentDocs);
  const highlightedPath = useRecentDocsStore((s) => s.highlightedPath);
  const previewSelect = useRecentDocsStore((s) => s.previewSelect);
  const cancelPreviewSelect = useRecentDocsStore((s) => s.cancelPreviewSelect);
  const loadRecentDocs = useRecentDocsStore((s) => s.loadRecentDocs);
  const workspaceId = usePanelStore((s) => s.activeWorkspaceId);
```

**g. Load recent docs on mount** (new `useEffect`, add after existing effects, e.g. after line 188):
```ts
  useEffect(() => {
    if (workspaceId) {
      loadRecentDocs(workspaceId);
    }
  }, [workspaceId, loadRecentDocs]);
```

**h. Warm preview cache for recent docs** (new `useEffect`). Add after the load effect:
```ts
  useEffect(() => {
    const fileData = useFileDataStore.getState();
    for (const doc of recentDocs) {
      const key = `${doc.panel}:${doc.path}`;
      if (!(key in fileData.contents)) {
        fileData.requestContent(doc.panel, doc.path);
      }
    }
  }, [recentDocs]);
```

**i. Update `runNavigation`** (~line 360). Replace:
```ts
  const runNavigation = useCallback((navigation: PendingNavigation) => {
    if (navigation.type === 'back') {
      onBack();
      return;
    }
    onSelectSibling(navigation.file);
  }, [onBack, onSelectSibling]);
```
with:
```ts
  const runNavigation = useCallback((navigation: PendingNavigation) => {
    if (navigation.type === 'back') {
      onBack();
      return;
    }
    onOpenFile(navigation.path, navigation.folder);
  }, [onBack, onOpenFile]);
```

**j. Update `requestNavigation`** (~line 368). Replace:
```ts
  const requestNavigation = useCallback((navigation: PendingNavigation) => {
    if (isDirty) {
      setPendingNavigation(navigation);
      return;
    }
    runNavigation(navigation);
  }, [isDirty, runNavigation]);
```
with:
```ts
  const requestNavigation = useCallback((navigation: PendingNavigation) => {
    if (isDirty) {
      setPendingNavigation(navigation);
      return;
    }
    cancelPreviewSelect();
    runNavigation(navigation);
  }, [isDirty, runNavigation, cancelPreviewSelect]);
```

**k. Replace sibling ribbon JSX with recent docs list** (~line 677). Replace:
```tsx
          {sidePanel === 'files' && (
            <div className="rv-office-document-ribbon-scroll">
              {siblings.map((sib) => (
                <OfficeDocumentTile
                  key={sib.path}
                  name={sib.name}
                  content={sib.content}
                  extension={sib.extension}
                  panel={PANEL}
                  folderPath={folder}
                  size="small"
                  active={sib.path === file.path}
                  onClick={() => requestNavigation({ type: 'sibling', file: sib })}
                />
              ))}
            </div>
          )}
```
with:
```tsx
          {sidePanel === 'files' && (
            <div className="rv-office-document-ribbon-scroll">
              {recentDocs.length === 0 ? (
                <div className="rv-office-versions-empty">
                  <span className="material-symbols-outlined">history</span>
                  <p>No recent documents</p>
                </div>
              ) : (
                recentDocs.map((doc) => {
                  const content = useFileDataStore.getState().contents[`${doc.panel}:${doc.path}`] || '';
                  return (
                    <OfficeDocumentTile
                      key={doc.path}
                      name={doc.name}
                      content={content}
                      extension={doc.name.split('.').pop()?.toLowerCase()}
                      panel={doc.panel}
                      folderPath={doc.folder}
                      size="small"
                      active={doc.path === file.path}
                      highlighted={doc.path === highlightedPath}
                      onClick={() => {
                        previewSelect(doc.path);
                        requestNavigation({ type: 'file', path: doc.path, folder: doc.folder });
                      }}
                    />
                  );
                })
              )}
            </div>
          )}
```

> **Note:** `useFileDataStore.getState().contents[...]` inside the render is acceptable here because it's a synchronous read from the Zustand store. The tile will re-render when `fileDataStore.contents` changes because `recentDocs` doesn't change, but the tile component reads its own content... actually, `OfficeDocumentTile` receives `content` as a prop. Since `recentDocs` doesn't change when content arrives, the tile won't re-render.
>
> **Fix:** Subscribe to `fileDataStore.contents` at the component level. Add this before the return statement:
> ```ts
>   const contents = useFileDataStore((s) => s.contents);
> ```
> Then in the map:
> ```ts
> const content = contents[`${doc.panel}:${doc.path}`] || '';
> ```
> This ensures re-render when content arrives.

**l. Update Escape key handler** (~line 417). The existing handler calls `requestNavigation({ type: 'back' })`. That's fine — no change needed.

### 2. `fusion-studio-client/src/components/office/OfficeGrid.tsx`

**a. Remove `siblings` prop and `handleSelectSibling`** (~line 102). Remove:
```ts
  const handleSelectSibling = useCallback((sib: FileWithContent) => {
    setSelectedFile(sib);
  }, []);
```

**b. Add `handleOpenFile`** after `handleFileClick` (~line 100). Add:
```ts
  const handleOpenFile = useCallback((path: string, folder: string) => {
    const fileData = useFileDataStore.getState();
    const cacheKey = `${PANEL}:${path}`;
    const cachedContent = fileData.contents[cacheKey] || '';

    if (!cachedContent) {
      fileData.requestContent(PANEL, path);
    }

    const name = path.split('/').pop() || path;
    const ext = name.split('.').pop()?.toLowerCase() || '';

    setCurrentFolder(folder);
    setSelectedFile({
      name,
      path,
      type: 'file',
      extension: ext,
      content: cachedContent,
    });
  }, []);
```

**c. Update `OfficeDocumentPage` call** (~line 112). Replace:
```tsx
        <OfficeDocumentPage
          key={selectedFile.path}
          file={selectedFile}
          siblings={documentFiles}
          folder={currentFolder}
          folderName={folderName}
          onBack={handleBackToFolder}
          onSelectSibling={handleSelectSibling}
        />
```
with:
```tsx
        <OfficeDocumentPage
          key={selectedFile.path}
          file={selectedFile}
          folder={currentFolder}
          folderName={folderName}
          onBack={handleBackToFolder}
          onOpenFile={handleOpenFile}
        />
```

### 3. `fusion-studio-client/src/components/office/OfficeDocumentTile.tsx`

**a. Add `highlighted` prop** (~line 16). Add to interface:
```ts
  highlighted?: boolean;
```

**b. Add highlighted class** (~line 78). Replace:
```ts
  if (props.active) classes.push('active');
```
with:
```ts
  if (props.active) classes.push('active');
  if (props.highlighted) classes.push('rv-office-doc-tile--highlighted');
```

### 4. `fusion-studio-client/src/components/office/OfficeDocumentTile.css`

**Add highlighted style** after the `.active` block (~line 31). Add:
```css
.rv-office-doc-tile--highlighted {
  border-color: var(--palette-accent, #22c55e);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--palette-accent, #22c55e) 30%, transparent),
    0 8px 24px rgba(0, 0, 0, 0.28);
}
```

---

## Smoke Tests

Build the client first:
```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

### Test 3.1 — Sibling ribbon removed
```
1. Open a markdown file in Office Viewer
2. Open side panel (filter_none button)
3. Expect: recent docs tiles or "No recent documents", NOT sibling ribbon
```

### Test 3.2 — Recent tile opens file instantly
```
1. Open doc A
2. Open side panel
3. Click doc B tile
4. Expect: doc B opens in editor immediately (< 200ms)
5. Expect: doc B tile gets `.active` highlight
```

### Test 3.3 — 3-second promotion delay
```
1. Open doc A
2. Open side panel, click doc B tile
3. Expect: doc B tile gets `.rv-office-doc-tile--highlighted` (green border)
4. Expect: list order unchanged for 3 seconds
5. Wait 3s
6. Expect: doc B moves to top of list, highlight removed
```

### Test 3.4 — Rapid click cancels first timer
```
1. Open doc A
2. Click doc B (timer starts)
3. Within 2s, click doc C
4. Expect: doc B never promoted
5. Wait 3s from doc C click
6. Expect: doc C promoted to top
```

### Test 3.5 — Preview renders from warm cache
```
1. Open doc A (content cached in fileDataStore)
2. Open side panel
3. Expect: doc A tile shows preview immediately, no spinner
```

### Test 3.6 — Deleted file graceful handling
```
1. Open doc A, close panel
2. Delete doc A from filesystem
3. Open side panel, click doc A tile
4. Expect: toast shows "File no longer exists" or file opens empty
```

### Test 3.7 — Dirty guard on navigation
```
1. Open doc A, make edits (don't save)
2. Click doc B in recent panel
3. Expect: dirty modal appears with "Save & Leave" / "Leave Without Saving" / "Cancel"
4. Click "Cancel"
5. Expect: stay on doc A, edits preserved
```

### Test 3.8 — Cross-folder navigation
```
1. Open a file in folder "todo"
2. Open side panel, click a file from folder "captures"
3. Expect: editor opens the captures file, folder context switches
```

---

## Report Template

After implementing Phase 3, copy and paste this filled-in report back to the parent session:

```markdown
## Phase 3 Implementation Report

### Files Modified
- [ ] `fusion-studio-client/src/components/office/OfficeDocumentPage.tsx`
- [ ] `fusion-studio-client/src/components/office/OfficeGrid.tsx`
- [ ] `fusion-studio-client/src/components/office/OfficeDocumentTile.tsx`
- [ ] `fusion-studio-client/src/components/office/OfficeDocumentTile.css`

### Smoke Test Results
| Test | Result | Notes |
|------|--------|-------|
| 3.1 Sibling ribbon removed | PASS / FAIL | |
| 3.2 Recent tile opens instantly | PASS / FAIL | |
| 3.3 3-second promotion delay | PASS / FAIL | |
| 3.4 Rapid click cancel | PASS / FAIL | |
| 3.5 Warm cache preview | PASS / FAIL | |
| 3.6 Deleted file handling | PASS / FAIL | |
| 3.7 Dirty guard | PASS / FAIL | |
| 3.8 Cross-folder nav | PASS / FAIL | |

### Issues Encountered
[Describe any deviations from spec, unexpected errors, or design changes made]

### Feature Complete?
[Is the recent docs system fully functional? List any remaining gaps.]
```
