# Office Document Editor — Implementation Chunks

**Project:** fs-dev (Fusion Studio)  
**Scope:** `office-viewer` panel only  
**Status:** Ready for implementation  

---

## How to Use These Chunks

Each chunk is a self-contained specification that can be handed to an implementation agent (human or AI) in a separate session. They preserve the full context needed to build that piece without requiring knowledge of the other chunks.

**Read them in order.** Each chunk lists its dependencies and what it blocks.

---

## Chunk Index

| # | File | Scope | Depends On | Blocks |
|---|------|-------|------------|--------|
| 1 | [`CHUNK-01-SAVE-INFRASTRUCTURE.md`](CHUNK-01-SAVE-INFRASTRUCTURE.md) | WS `file_save` + dirty state tracking | — | 2, 3, 4, 5 |
| 2 | [`CHUNK-02-OFFICE-DOCUMENT-TILE.md`](CHUNK-02-OFFICE-DOCUMENT-TILE.md) | Document-page thumbnails | 1 | 3 |
| 3 | [`CHUNK-03-OFFICE-DOCUMENT-PAGE.md`](CHUNK-03-OFFICE-DOCUMENT-PAGE.md) | Crepe editor surface | 1, 2 | 4, 5 |
| 4 | [`CHUNK-04-EXPORT-PIPELINE.md`](CHUNK-04-EXPORT-PIPELINE.md) | Pandoc bundling + IPC export | 1, 3 | 5 |
| 5 | [`CHUNK-05-POLISH.md`](CHUNK-05-POLISH.md) | Shortcuts, toasts, transitions | 1–4 | — |

---

## Master Architecture Decisions

These decisions apply to all chunks:

1. **Panel isolation:** Only `office-viewer` changes. `doc-viewer`, `wiki-viewer`, `file-explorer` remain untouched.
2. **Fork, don't prop-spray:** `OfficeDocumentTile` and `OfficeDocumentPage` are new modules. We do not add `renderMode` props to shared components.
3. **Markdown is source of truth:** Crepe serializes to Markdown on save. No proprietary JSON format.
4. **Auto-save:** Debounced 3s. Ctrl+S forces immediate save.
5. **Export bundled:** Pandoc ships inside the Electron binary. Export runs in the main process via IPC. No host dependencies.
6. **Text color deferred:** Custom ProseMirror marks are out of scope for Phase 1.

---

## Shared Files Reference

| File | Path | Role |
|------|------|------|
| `fileDataStore` | `src/state/fileDataStore.ts` | Zustand store for file trees/content/dirty flags |
| `useFolderFiles` | `src/hooks/useFolderFiles.ts` | Hook for listing files in a folder |
| `DocumentTile` | `src/components/tile-row/DocumentTile.tsx` | Shared code-preview tile (unchanged) |
| `FilePageView` | `src/components/capture/FilePageView.tsx` | Shared file viewer (unchanged for doc-viewer) |
| `OfficeGrid` | `src/components/office/OfficeGrid.tsx` | Office-viewer root component (modified in Chunks 2–3) |
| `markdownToHtml` | `src/lib/transforms/markdown.ts` | Shared marked wrapper |
| `client-message-router.js` | `fusion-studio-server/lib/ws/client-message-router.js` | Server WS router |
| `electron/main.cjs` | `fusion-studio-client/electron/main.cjs` | Electron main process |
| `electron/preload.cjs` | `fusion-studio-client/electron/preload.cjs` | Preload script |

---

## New Files to Create

| File | Chunk | Role |
|------|-------|------|
| `src/components/office/OfficeDocumentTile.tsx` | 2 | Document thumbnail tile |
| `src/components/office/OfficeDocumentTile.css` | 2 | Tile styles |
| `src/components/office/OfficeDocumentPage.tsx` | 3 | Crepe editor document view |
| `src/components/office/OfficeDocumentPage.css` | 3 | Editor page styles |
| `scripts/download-pandoc.js` | 4 | Build-time Pandoc downloader |
| `electron/resources/pandoc/` | 4 | Bundled Pandoc binaries |

---

## Orchestration Checklist

Before starting each chunk, verify:

- [ ] **Chunk 1:** `file_save_response` works end-to-end with a mock textarea.
- [ ] **Chunk 2:** Tiles look like document pages, not code frames.
- [ ] **Chunk 3:** Crepe loads, edits persist after reload, auto-save fires.
- [ ] **Chunk 4:** Export produces valid DOCX/PDF on a clean machine with no Pandoc installed.
- [ ] **Chunk 5:** No console errors, smooth transitions, all shortcuts work.
