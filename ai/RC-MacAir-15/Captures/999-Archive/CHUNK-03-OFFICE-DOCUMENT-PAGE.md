# Chunk 3: Office Document Page (Crepe Editor)

**Project:** fs-dev (Fusion Studio)  
**Scope:** Office Document Editor — Phase 3  
**Depends on:** Chunk 1 (Save Infrastructure), Chunk 2 (Office Document Tile)  
**Blocks:** Chunk 4, Chunk 5  

---

## Context

Fusion Studio is an Electron app with a React client. The `office-viewer` panel currently routes file clicks to `FilePageView`, which shows a topbar with a code/markdown toggle and renders content via `CodeView`. We are deleting that paradigm.

This chunk replaces the detail view for `.md` files in `office-viewer` with a full WYSIWYG word processor using **Milkdown/Crepe**. Non-markdown files continue to use `FilePageView`.

---

## What This Chunk Builds

1. Install and integrate `@milkdown/crepe` in the client.
2. Create `OfficeDocumentPage` component — the full document editing surface.
3. Wire auto-save (debounced 3s) and manual save (Ctrl+S).
4. Update `OfficeGrid` to route `.md` files to `OfficeDocumentPage`.
5. Extract shared topbar chrome from `FilePageView` into a reusable component (or copy it if extraction is too invasive).

---

## Chunk 1 Retrofit: Add `pendingSaves` to `fileDataStore`

Before building the editor surface, augment `fileDataStore.ts` to prevent stacked saves during auto-save debounce:

```ts
interface FileDataState {
  // existing...
  pendingSaves: Set<string>;

  saveFile: (panel: string, path: string, content: string) => void;
  // ...
}

export const useFileDataStore = create<FileDataState>((set, get) => ({
  // existing...
  pendingSaves: new Set(),

  saveFile: (panel, path, content) => {
    const key = cacheKey(panel, path);
    if (get().pendingSaves.has(key)) return; // Skip if already in-flight
    set((s) => {
      const pending = new Set(s.pendingSaves);
      pending.add(key);
      return { pendingSaves: pending };
    });
    sendWs({ type: 'file_save', panel, path, content });
  },

  handleSaveResponse: (panel, path, success, error) => {
    const key = cacheKey(panel, path);
    set((s) => {
      const pending = new Set(s.pendingSaves);
      pending.delete(key);
      const dirtyFlags = { ...s.dirtyFlags };
      if (success) delete dirtyFlags[key];
      return { pendingSaves: pending, dirtyFlags };
    });
    if (!success) {
      console.error(`[fileDataStore] Save failed for ${key}:`, error);
    }
  },
  // ...
}));
```

---

## Files to Create / Modify

### Dependency Installation

```bash
cd fusion-studio-client
npm install @milkdown/crepe
```

Also import Crepe styles:
```ts
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css'; // or frame-dark.css
```

### New File: `fusion-studio-client/src/components/office/OfficeDocumentPage.tsx`

**Props:**
```tsx
interface OfficeDocumentPageProps {
  file: FileWithContent;
  siblings: FileWithContent[];
  folder: string;
  folderName?: string;
  onBack: () => void;
  onSelectSibling: (file: FileWithContent) => void;
}
```

**Responsibilities:**
- Mount a Crepe editor instance when the component mounts.
- Load `file.content` as the initial Markdown.
- Track dirty state via `fileDataStore`.
- Auto-save: debounce 3000ms after last Crepe `onChange`. Skips if a save is already in-flight (`pendingSaves`).
- Manual save: Ctrl+S forces immediate save (flushes debounce).
- Topbar with: back button, filename, copy-path button, save button, export button (export is a no-op until Chunk 4).
- Sibling ribbon at bottom (reuse existing ribbon markup from `FilePageView`).

**Crepe integration pattern:**
```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import { useFileDataStore } from '../../state/fileDataStore';

export function OfficeDocumentPage({ file, siblings, folder, folderName, onBack, onSelectSibling }: OfficeDocumentPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const saveFile = useFileDataStore((s) => s.saveFile);
  const setDirty = useFileDataStore((s) => s.setDirty);

  // Initialize Crepe
  useEffect(() => {
    if (!containerRef.current) return;

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: file.content,
    });

    crepe.on((listener) => {
      listener.markdownUpdated((ctx, markdown, prevMarkdown) => {
        if (markdown !== file.content) {
          setIsDirty(true);
          setDirty('office-viewer', file.path, true);
          // Auto-save debounce handled separately
        }
      });
    });

    crepe.create().then(() => {
      crepeRef.current = crepe;
    });

    return () => {
      crepe.destroy();
      crepeRef.current = null;
    };
  }, [file.path, file.content]);

  // Auto-save debounce
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    if (!crepeRef.current) return;
    const markdown = await crepeRef.current.getMarkdown();
    await saveFile('office-viewer', file.path, markdown);
    setIsDirty(false);
    setDirty('office-viewer', file.path, false);
  }, [file.path, saveFile, setDirty]);

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  return (
    <div className="rv-office-document-page">
      {/* Topbar */}
      <div className="rv-office-document-topbar">
        <button className="rv-office-document-back" onClick={onBack}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="rv-office-document-filename">{folderName ? `${folderName} / ${file.name}` : file.name}</span>
        <div className="rv-office-document-actions">
          <button onClick={() => copyResourcePath('office-viewer', file.path)} title="Copy path">
            <span className="material-symbols-outlined">link_2</span>
          </button>
          <button onClick={handleSave} disabled={!isDirty} title="Save">
            <span className="material-symbols-outlined">save</span>
          </button>
          <button title="Export (coming soon)">
            <span className="material-symbols-outlined">download</span>
          </button>
        </div>
      </div>

      {/* Editor surface */}
      <div className="rv-office-document-editor">
        <div ref={containerRef} />
      </div>

      {/* Sibling ribbon */}
      <div className="rv-office-document-ribbon">
        {/* Reuse FilePageView ribbon markup, but with OfficeDocumentTile for .md siblings */}
      </div>
    </div>
  );
}
```

### New File: `fusion-studio-client/src/components/office/OfficeDocumentPage.css`

- `.rv-office-document-page` fills the content area.
- `.rv-office-document-topbar` mirrors `FilePageView` topbar styling.
- `.rv-office-document-editor` provides the document surface background and padding.
- Crepe's default theme should be overridden to match the app's dark theme variables.

### Modified File: `fusion-studio-client/src/components/office/OfficeGrid.tsx`

In the detail view branch (`currentFolder && selectedFile`), check if the file is `.md`:

```tsx
if (currentFolder && selectedFile) {
  const folderName = currentFolder.split('/').pop() || currentFolder;
  const isMarkdown = selectedFile.extension === 'md' || selectedFile.name.endsWith('.md');

  if (isMarkdown) {
    return (
      <OfficeDocumentPage
        file={selectedFile}
        siblings={files}
        folder={currentFolder}
        folderName={folderName}
        onBack={handleBackToFolder}
        onSelectSibling={handleSelectSibling}
      />
    );
  }

  // Non-markdown files still use FilePageView
  return (
    <FilePageView
      file={selectedFile}
      siblings={files}
      panel={PANEL}
      folder={currentFolder}
      folderName={folderName}
      showRibbon={false}
      onBack={handleBackToFolder}
      onSelectSibling={handleSelectSibling}
    />
  );
}
```

---

## Acceptance Criteria

- [ ] `@milkdown/crepe` is installed and bundled.
- [ ] Clicking a `.md` file in office-viewer opens `OfficeDocumentPage` with Crepe.
- [ ] The document renders as a WYSIWYG page (not raw markdown, not code).
- [ ] The code/markdown toggle is gone from the office-viewer flow (still exists in `FilePageView` for doc-viewer).
- [ ] Typing in Crepe triggers dirty state.
- [ ] Auto-save fires 3s after stopping typing.
- [ ] Ctrl+S forces immediate save.
- [ ] Save writes the Markdown back to disk via Chunk 1's pipeline.
- [ ] Non-markdown files in office-viewer still open in `FilePageView`.
- [ ] Sibling ribbon shows at bottom.

---

## Notes

- **Do not implement text color or custom marks** — out of scope for Phase 1.
- If extracting the topbar from `FilePageView` is risky, duplicate the markup in `OfficeDocumentPage` for now. A refactor to extract shared `FilePageChrome` can happen later.
- Crepe's default light theme may clash with the app's dark theme. Override CSS variables or use `frame-dark.css`.
- The `getMarkdown()` API is async in Crepe. Make sure `handleSave` awaits it.
- Consider lazy-loading `OfficeDocumentPage` with `React.lazy()` to keep the initial office-viewer bundle small.
