# Chunk 2: Office Document Tile

**Project:** fs-dev (Fusion Studio)  
**Scope:** Office Document Editor — Phase 2  
**Depends on:** Chunk 1 (Save Infrastructure)  
**Blocks:** Chunk 3  

---

## Context

Fusion Studio is an Electron app with a React client. The `office-viewer` panel shows folders at root, then files as tiles inside folders. Currently `OfficeGrid` uses the shared `DocumentTile` component for all files, which renders a scaled-down `CodeView` preview (syntax-highlighted code). This creates "little eye frames" for Markdown files.

We are changing the paradigm: Markdown files in the office viewer are **documents**, not code. The tiles should look like scaled-down document pages.

`DocumentTile` is used by `doc-viewer` and must remain unchanged.

---

## What This Chunk Builds

1. A new `OfficeDocumentTile` component that renders `.md` files as document thumbnails.
2. Non-markdown files in the office viewer still use the existing `DocumentTile`.
3. `OfficeGrid` updated to route the correct tile component per file type.

---

## Files to Create / Modify

### New File: `fusion-studio-client/src/components/office/OfficeDocumentTile.tsx`

**Responsibilities:**
- Render `.md` content as a scaled-down document page preview.
- For non-`.md` files, delegate to the existing `DocumentTile`.
- Keep the same outer card chrome as `DocumentTile` (footer, icon, click handling) OR create a similar shape.

**Implementation approach:**
```tsx
import { markdownToHtml } from '../../lib/transforms';
import { DocumentTile } from '../tile-row/DocumentTile';

interface OfficeDocumentTileProps {
  name: string;
  content: string;
  extension?: string;
  panel?: string;
  folderPath?: string;
  onClick?: () => void;
  active?: boolean;
  size?: 'default' | 'small';
}

export function OfficeDocumentTile(props: OfficeDocumentTileProps) {
  const ext = props.extension || props.name.split('.').pop()?.toLowerCase() || '';

  // Non-markdown files fall back to the existing code tile
  if (ext !== 'md' && ext !== 'markdown') {
    return <DocumentTile {...props} />;
  }

  // Markdown files: render as document page thumbnail
  const previewContent = useMemo(() => {
    if (!props.content) return '';
    const lines = props.content.split('\n');
    const truncated = lines.length > 50 ? lines.slice(0, 50).join('\n') + '\n...' : props.content;
    return markdownToHtml(truncated);
  }, [props.content]);

  return (
    <div className={`rv-office-doc-tile ${props.active ? 'active' : ''}`} onClick={props.onClick} title={props.name}>
      <div className="rv-office-doc-tile-preview">
        <div
          className="rv-office-doc-tile-document"
          dangerouslySetInnerHTML={{ __html: previewContent }}
        />
      </div>
      <div className="rv-office-doc-tile-footer">
        <span className="material-symbols-outlined rv-office-doc-tile-icon">description</span>
        <span className="rv-office-doc-tile-name">{props.name}</span>
      </div>
    </div>
  );
}
```

**CSS Requirements:**
- `.rv-office-doc-tile-preview` should be `overflow: hidden` with a fixed aspect ratio (e.g., `aspect-ratio: 8.5 / 11` for letter-like proportions, or `4 / 5` for compact).
- `.rv-office-doc-tile-document` should be rendered at a large base size (e.g., `width: 800px`) and then scaled down with `transform: scale(...)` to fit the preview container. This is the same technique `DocumentTile` uses for `CodeView`.
- Apply document CSS variables: `--document-bg`, `--text-primary`, etc.

**New File: `fusion-studio-client/src/components/office/OfficeDocumentTile.css`**

```css
.rv-office-doc-tile {
  /* Same card shape as DocumentTile */
}

.rv-office-doc-tile-preview {
  position: relative;
  overflow: hidden;
  aspect-ratio: 8.5 / 11;
  background: var(--document-bg, #161616);
  border-radius: 4px;
}

.rv-office-doc-tile-document {
  position: absolute;
  top: 0;
  left: 0;
  width: 800px;
  transform-origin: top left;
  padding: 24px;
  background: var(--document-bg, #161616);
  color: var(--text-primary, #e0e0e0);
  font-size: 14px;
  line-height: 1.6;
}

/* Scale is applied dynamically via inline style based on container width / 800 */
```

### Modified File: `fusion-studio-client/src/components/office/OfficeGrid.tsx`

Replace the `DocumentTile` usage in the folder view with `OfficeDocumentTile`:

```tsx
import { OfficeDocumentTile } from './OfficeDocumentTile';

// In the folder view render:
{files.map((file) => (
  <OfficeDocumentTile
    key={file.path}
    name={file.name}
    content={file.content}
    extension={file.extension}
    panel={PANEL}
    folderPath={currentFolder}
    onClick={() => handleFileClick(file)}
  />
))}
```

Keep `DocumentTile` for the bottom ribbon in `FilePageView` (that is handled by Chunk 3).

---

## Acceptance Criteria

- [ ] `OfficeDocumentTile` exists as its own module in `components/office/`.
- [ ] Markdown files render as document-page thumbnails (not code frames).
- [ ] Thumbnails use the same document CSS variables as the detail view will use.
- [ ] Non-markdown files in office-viewer still render via `DocumentTile` / `CodeView`.
- [ ] `doc-viewer` is untouched — its `DocumentTile` usage remains unchanged.
- [ ] Clicking a tile still routes to the detail view (even if detail view is still `FilePageView` at this stage).

---

## Notes

- Do **not** build the editor surface in this chunk. The detail view can still be `FilePageView` temporarily.
- The scaling math for `transform: scale(...)` should be calculated from `containerWidth / 800`. Use a `ResizeObserver` or measure on mount.
- Truncate content to ~50 lines to prevent performance issues with large files.
