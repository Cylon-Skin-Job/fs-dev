# Office Document Editor & Export SPEC

**Status:** Draft  
**Scope:** `office-viewer` panel only  
**Target:** fs-dev fusion-studio-client + fusion-studio-server  

---

## 1. Problem Statement

The `office-viewer` panel currently treats Markdown files as code artifacts. Users see:
- **Tiles:** Scaled-down syntax-highlighted code previews (`CodeView` inside `DocumentTile`).
- **Detail view:** `FilePageView` with a toggle switch to flip between raw code and rendered Markdown.

This is the wrong paradigm for documents. Markdown in the office viewer should **be** the document format, not a file format to be inspected. The office viewer is for specs, scratch notes, todos, and design documents — content that should look and behave like pages, not source code.

---

## 2. Goals & Non-Goals

### Goals
- [G1] Markdown files in `office-viewer` render as **document pages** by default (WYSIWYG via Milkdown/Crepe).
- [G2] **Delete** the code/markdown toggle in the office-viewer detail view. No raw markdown view.
- [G3] **Tiles** render as scaled-down document page thumbnails (using the same document CSS), not code frames.
- [G4] Users can **edit** documents inline with a word-processor interface.
- [G5] Users can **export** documents to PDF and DOCX.
- [G6] Preserve the existing folder navigation (root folders → folder tiles → document page).
- [G7] Architecture: maximize reuse via shared routes/controllers; fork only where office-viewer diverges.

### Non-Goals
- [NG1] No changes to `doc-viewer`, `wiki-viewer`, `file-explorer`, or other panels.
- [NG2] No real-time collaboration (out of scope).
- [NG3] No migration away from Markdown as source of truth.
- [NG4] No support for editing non-Markdown files in the document surface (`.js`, `.png`, etc. still use existing viewers).

---

## 3. Current Architecture

```
ai/views/office-viewer/content/
  ├── specs/
  │   └── sample-markdown.md
  ├── todo/
  ├── captures/
  └── ...

OfficeGrid (panel = 'office-viewer')
  → Root: folder cards
  → Folder: DocumentTile per file (CodeView preview)
  → File: FilePageView (toggle: code ↔ markdown)
```

**Shared components affected:**
| Component | Current Users | Office-Viewer Change |
|-----------|--------------|----------------------|
| `DocumentTile` | doc-viewer, others | Unchanged |
| `OfficeDocumentTile` | office-viewer only | New module: document-page thumbnails for `.md` |
| `OfficeDocumentPage` | office-viewer only | New module: Crepe editor surface for `.md` |

---

## 4. Target Architecture

### 4.1 Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│  Shared Infrastructure (Routes & Controllers)                       │
│  ─────────────────────────────────────────────────────────────────  │
│  • fileDataStore        (tree/content cache, WS messages)           │
│  • useFolderFiles       (folder listing hook)                       │
│  • WS handlers          (file_tree_request, file_content_request)   │
│  • Server file I/O      (read/write content)                        │
│  • Export API           (/api/export)                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ OfficeGrid    │    │ OfficeDocument  │    │ OfficeDocument  │
│ (own module)  │───►│ Tile            │    │ Page            │
│               │    │ (submodule)     │    │ (own module)    │
└───────────────┘    └─────────────────┘    └─────────────────┘
        │                     │                     │
        │              ┌──────┴──────┐              │
        │              ▼             ▼              ▼
        │      DocumentTile   CodeView        Crepe Editor
        │      (shared)       (shared)        (Milkdown)
        │           │              │                │
        │           └──────────────┘                │
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ markdownToHtml  │
                    │ (shared)        │
                    └─────────────────┘
```

### 4.2 Decision: Share vs. Fork

| Concern | Strategy | Rationale |
|---------|----------|-----------|
| **File data cache** | **Shared** (`fileDataStore`) | Panel-agnostic cache; office-viewer uses the same WS messages. |
| **Folder listing** | **Shared** (`useFolderFiles`) | No divergence in how folders are listed. |
| **Tile chrome** | **Shared** (`DocumentTile`) | Same card shape, footer, icon map, click handling. |
| **Tile preview body** | **Diverge** (`OfficeDocumentTile`) | Office-viewer `.md` tiles render as scaled document pages. `doc-viewer` keeps `DocumentTile` / `CodeView` unchanged. |
| **Detail page chrome** | **Shared** (`FilePageView` topbar/back/actions) | Same back button, filename, copy-path action. |
| **Detail page body** | **Diverge** (`OfficeDocumentPage`) | Office-viewer `.md` files get Crepe surface; doc-viewer keeps `CodeView`. |
| **Save logic** | **Shared** (new `file_save` WS message) | All panels can save; server handler is panel-agnostic. |
| **Export logic** | **Shared** (`/api/export` route) | Format-driven, not panel-driven. |

---

## 5. Component Design

### 5.1 `OfficeDocumentTile` — Own Module

Forked from `DocumentTile` for office-viewer document thumbnails.

```tsx
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
```

**Behavior:**
- If extension is `.md`:
  - Render `markdownToHtml(previewContent)` inside a scaled-down `.rv-office-doc-tile-preview` container.
  - Apply document CSS variables (`--document-bg`, `--text-primary`, etc.).
  - Scale via CSS `transform: scale(...)` inside an overflow-hidden container, same as current tile mechanics.
- Otherwise: delegate to `DocumentTile` for images/code/etc.

**Why a fork?** The rendering paradigm is fundamentally different. Doc-viewer tiles show code/source; office-viewer tiles show document pages. Keeping them separate prevents prop-sprawl and lets each module evolve independently.

### 5.2 `OfficeDocumentPage` — Own Module

Replaces `FilePageView` for `.md` files in `office-viewer`.

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

**Structure:**
```
┌────────────────────────────────────────┐
│ ←  filename.md              [🔗][💾]   │  ← topbar (shared chrome)
├────────────────────────────────────────┤
│                                        │
│   ┌──────────────────────────────┐     │
│   │                              │     │
│   │    Crepe Editor Surface      │     │  ← WYSIWYG
│   │    (Markdown → ProseMirror)  │     │
│   │                              │     │
│   └──────────────────────────────┘     │
│                                        │
├────────────────────────────────────────┤
│ [thumb] [thumb] [thumb] [thumb]        │  ← sibling ribbon
└────────────────────────────────────────┘
```

**Topbar actions:**
- Back arrow (shared)
- Filename (shared)
- Copy path (shared)
- **Save** (floppy icon): serializes Crepe → Markdown → `file_save` WS message
- **Export** (download icon): opens export menu (PDF / DOCX)

**Editing state:**
- `isDirty`: true when Crepe content diverges from loaded file
- `isSaving`: true during save
- Auto-save: debounced 3s after last keystroke

### 5.3 `OfficeGrid` — Own Module (modified)

Updates to existing `OfficeGrid`:
- Use `OfficeDocumentTile` for `.md` files.
- Use `DocumentTile` for non-markdown files.
- Route `.md` file clicks to `OfficeDocumentPage` instead of `FilePageView`.
- Keep `FilePageView` for non-markdown files (images, code, etc.).

---

## 6. Milkdown / Crepe Integration

### 6.1 Why Crepe
- Word-processor feel out of the box (slash menu, drag handles, plus button).
- MIT license (no export paywall).
- ProseMirror plugin system supports custom marks (text color, highlights).
- React bindings exist (`@milkdown/react` or `Crepe` direct API).

### 6.2 Custom Marks (Text Color) — Deferred
Out of scope for Phase 1. When needed later:
- Serialize as inline HTML: `<span style="color: #e74c3c;">red text</span>`.
- `marked` already renders this in read-only contexts.
- Add a ProseMirror `textColor` mark plugin to Crepe for editing.

### 6.3 Non-Markdown Files in Office
Crepe only handles `.md`. For `.png`, `.js`, etc., `OfficeGrid` falls back to `FilePageView` (unchanged). No toggle needed because non-markdown files never had a markdown mode.

---

## 7. Save Pipeline

### 7.1 New WebSocket Message: `file_save`

**Client → Server**
```json
{
  "type": "file_save",
  "panel": "office-viewer",
  "path": "specs/sample-markdown.md",
  "content": "# Heading\n\nBody text..."
}
```

**Server → Client**
```json
{
  "type": "file_save_response",
  "success": true,
  "path": "specs/sample-markdown.md"
}
```

### 7.2 Server Handler
- Write to disk at resolved content path.
- Atomic write: temp file → rename.
- Emit `file_changed` event so `fileDataStore` invalidates its cache.
- Return success/error.

### 7.3 Client Flow
```
User types in Crepe
  → Crepe onChange → markdown string
  → setIsDirty(true)

User types in Crepe
  → debounce(3000ms) since last onChange
  → fileDataStore sends WS file_save
  → await file_save_response
  → setIsDirty(false)
  → (no toast for auto-save; subtle indicator only)

User presses Ctrl+S
  → flush debounce immediately
  → fileDataStore sends WS file_save
  → await file_save_response
  → setIsDirty(false)
  → toast: "Saved"
```

---

## 8. Export Pipeline

### 8.1 Strategy: Electron Main Process + Bundled Pandoc

Because the user wants everything to ship in the Electron binary, we handle export in the **Electron main process** rather than the separate Node server. This gives us direct access to bundled platform binaries.

**IPC Flow:**
```
Client (Renderer)
  → ipcRenderer.invoke('export-document', { format, content, filename })
  → Electron Main
    → write temp .md to app.getPath('temp')
    → spawn bundled pandoc binary
    → read generated file → base64
  → return base64 to renderer
  → renderer creates Blob → triggers download
```

**Bundling Pandoc:**
1. Download platform-specific Pandoc binaries (macOS/Windows/Linux) during build.
2. Place them in `fusion-studio-client/electron/resources/pandoc/`.
3. In `electron-builder` config (or manual build script), include `resources/pandoc` in the app package.
4. At runtime, resolve the binary path:
   ```js
   const pandocPath = path.join(process.resourcesPath, 'pandoc', 'pandoc');
   ```
5. Spawn via `child_process.spawn(pandocPath, [...args])`.

**Why main process instead of server:**
- The Node server (`fusion-studio-server`) runs as a separate process and may not have access to Electron's `process.resourcesPath`.
- Bundling binaries for the server is harder than bundling for Electron.
- IPC is already established (`capture-page`, `capture-rect`). Adding `export-document` is trivial.
- Works in both dev and production without PATH configuration.

**Why Pandoc:**
- Handles tables, images, code blocks, footnotes natively.
- No browser `Buffer` issues (runs in Node main process).
- Plain formatting is the default; no templates needed.

**Why not `prosemirror-docx`:** Held as Phase 2 if Pandoc output lacks pixel-perfect control.

**Build-time dependency:**
Add a `scripts/download-pandoc.js` that fetches the correct Pandoc release for the build platform and places it in `electron/resources/pandoc/`. Cross-platform CI builds download all three binaries.

### 8.2 UI
- Export button in `OfficeDocumentPage` topbar.
- Dropdown: Export PDF, Export DOCX.
- Loading state while server generates file.

---

## 9. Implementation Phases

### Phase 1: Save Infrastructure (1 day)
- [ ] Add `file_save` WS handler to server (`client-message-router.js`).
- [ ] Add `file_save_response` handler to `fileDataStore`.
- [ ] Test end-to-end save with a mock component.

### Phase 2: Document Tile (1–2 days)
- [ ] Create `OfficeDocumentTile` component.
- [ ] Implement document preview body for `.md` files (`markdownToHtml` + document CSS + scale transform).
- [ ] Update `OfficeGrid` to use `OfficeDocumentTile` for `.md` files, `DocumentTile` for others.
- [ ] Verify non-markdown tiles still use `CodeView`.

### Phase 3: Document Page (2–3 days)
- [ ] Install `@milkdown/crepe` in client.
- [ ] Create `OfficeDocumentPage` component:
  - Topbar (reuse `FilePageView` chrome or extract shared `FilePageChrome`).
  - Crepe mount/unmount lifecycle.
  - Dirty state tracking.
  - Save wiring.
- [ ] Update `OfficeGrid` to route `.md` files to `OfficeDocumentPage`.
- [ ] Remove markdown toggle from office-viewer flow (not from `FilePageView` itself — doc-viewer still uses it).

### Phase 4: Export (1–2 days)
- [ ] Add `download-pandoc.js` build script to fetch Pandoc binaries.
- [ ] Bundle Pandoc in `electron/resources/pandoc/`.
- [ ] Add `export-document` IPC handler in `electron/main.cjs`.
- [ ] Add `export-document` preload API in `electron/preload.cjs`.
- [ ] Add Export button + dropdown to `OfficeDocumentPage`.
- [ ] Wire renderer IPC call → main process Pandoc spawn → Blob download.

### Phase 5: Polish (1 day)
- [ ] Keyboard shortcuts (Ctrl+S save, Esc back to folder).
- [ ] Dirty-state warning when navigating away.
- [ ] Loading/error toasts.
- [ ] Empty state for new documents.

---

## 10. State Changes

### `fileDataStore` additions
```ts
interface FileDataState {
  // existing...

  /** Track dirty documents: key = "panel:path" */
  dirtyFlags: Record<string, boolean>;

  saveFile: (panel: string, path: string, content: string) => void;
  setDirty: (panel: string, path: string, dirty: boolean) => void;
}
```

### `OfficeGrid` local state
```ts
interface OfficeGridState {
  currentFolder: string | null;
  selectedFile: FileWithContent | null;
  // No viewMode needed — removed
}
```

---

## 11. API Spec

### IPC: `export-document`

**Renderer → Main**
```ts
const result = await ipcRenderer.invoke('export-document', {
  format: 'docx',      // 'docx' | 'pdf'
  content: '# Title\n\nBody...',
  filename: 'Sample Document'
});
```

**Main → Renderer**
```ts
{
  success: true,
  base64: 'UEsDBBQABgAI...',  // base64-encoded file bytes
  filename: 'Sample Document.docx'
}
```

**Error response**
```ts
{
  success: false,
  error: 'Pandoc not found in bundle'
}
```

**Client download flow:**
```ts
const blob = new Blob(
  [Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))],
  { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
);
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = result.filename;
a.click();
URL.revokeObjectURL(url);
```

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Crepe bundle size (+~150KB) | Medium | Lazy-load `OfficeDocumentPage` chunk; only load Crepe when opening a doc. |
| Pandoc binary missing from bundle | High | Build script fails CI if download fails; runtime check shows "Export unavailable" if binary missing. |
| ProseMirror ↔ Markdown round-trip loss | High | Test suite for custom marks; fallback to raw HTML serialization for unsupported nodes. |
| Document tile performance (rendering HTML per tile) | Medium | Truncate to first 50 lines + 1 heading; use `useMemo` for `markdownToHtml`. |
| File write conflicts | Low | Atomic write (temp + rename); optional file-watcher conflict detection. |

---

## 13. Decisions (Resolved)

| Question | Decision |
|---|---|
| **Auto-save vs. manual save?** | **Auto-save**, debounced 3s. Ctrl+S forces immediate save. |
| **Pandoc bundling** | **Bundle with Electron binary**. Export runs in main process via IPC, using `process.resourcesPath` to locate the binary. No host dependency. |
| **New document creation** | **Out of scope**. Use dummy `.md` files for initial testing. Future feature. |
| **Template system** | **Plain formatting**. No branded headers/logos for Phase 1. |
| **Office document tiles** | **Fork to `OfficeDocumentTile`**. Separate module from `DocumentTile`; no shared `renderMode` prop. |

---

## 14. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| TBD | Fork `FilePageView` for office-viewer | Office-viewer needs a completely different content surface (Crepe vs CodeView). Doc-viewer keeps existing behavior. |
| TBD | Fork `DocumentTile` into `OfficeDocumentTile` | Office-viewer tiles render document pages; doc-viewer tiles render code. Different paradigms, separate modules. |
| TBD | Electron main-process Pandoc for export | Bundles in binary; no host dependency; leverages existing IPC; works in dev and production. |
| TBD | Inline HTML for text color (deferred) | `marked` already supports it; backward compatible; zero changes to other panels. Phase 2 feature. |
