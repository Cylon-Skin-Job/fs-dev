# Chunk 1: Save Infrastructure

**Project:** fs-dev (Fusion Studio)  
**Scope:** Office Document Editor — Phase 1  
**Depends on:** Nothing (foundation layer)  
**Blocks:** Chunk 2, Chunk 3  

---

## Context

Fusion Studio is an Electron app with a React client (Vite + React 19 + Zustand) and a Node/Express server. The office-viewer panel currently displays Markdown files as read-only code artifacts. We are converting it to a word-processor interface using Milkdown/Crepe.

Before any editing UI can exist, the client needs the ability to **write files back to disk** through the existing WebSocket channel. Currently only `file_content_request` (read) exists.

---

## What This Chunk Builds

1. A new WebSocket message type `file_save` (client → server)
2. A server handler that writes the file atomically (temp → rename)
3. A `file_save_response` message (server → client)
4. Zustand store methods in `fileDataStore` to send saves and track dirty state

---

## Files to Modify

### Server-side

**`fusion-studio-server/lib/ws/client-message-router.js`**
- Add a `file_save` case to the client message router.
- Resolve the full filesystem path using `getPanelPath(panel, path)`.
- Write atomically: write to `{path}.tmp` → `fs.renameSync` to final path.
- Emit a `file_changed` event on the event bus so caches invalidate.
- Send `file_save_response` back to the WebSocket.
- Handle errors (permission denied, disk full, etc.) and send them in the response.

**Example server handler pattern:**
```js
if (clientMsg.type === 'file_save') {
  const { panel, path: filePath, content } = clientMsg;
  try {
    const baseDir = getPanelPath(panel, ws);
    if (!baseDir) {
      ws.send(JSON.stringify({ type: 'file_save_response', success: false, error: 'Panel not found' }));
      return;
    }
    const fullPath = path.join(baseDir, filePath);
    const tmpPath = fullPath + '.tmp';
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, fullPath);
    emit('file_changed', { panel, path: filePath });
    ws.send(JSON.stringify({ type: 'file_save_response', success: true, path: filePath }));
  } catch (err) {
    ws.send(JSON.stringify({ type: 'file_save_response', success: false, path: filePath, error: err.message }));
  }
}
```

### Client-side

**`fusion-studio-client/src/state/fileDataStore.ts`**
- Add `dirtyFlags: Record<string, boolean>` to state.
- Add `setDirty(panel, path, dirty)` action.
- Add `saveFile(panel, path, content)` action that:
  - Sends `file_save` WS message
  - Clears dirty flag on `file_save_response` success
  - Logs/re-throws on error

**`fusion-studio-client/src/components/office/OfficeDocumentPage.tsx`** (placeholder for Chunk 3)
- In this chunk, create a minimal test component or hook that verifies the save pipeline end-to-end.
- A simple `<textarea>` wired to `fileDataStore.saveFile()` is sufficient to prove the pipeline works.

---

## Data Flow

```
User types → onChange → fileDataStore.setDirty('office-viewer', path, true)

Auto-save debounce (3s) OR Ctrl+S
  → fileDataStore.saveFile('office-viewer', path, content)
  → WS: { type: 'file_save', panel: 'office-viewer', path, content }
  → Server writes atomically
  → WS: { type: 'file_save_response', success: true, path }
  → fileDataStore.setDirty('office-viewer', path, false)
```

---

## Acceptance Criteria

- [ ] Server accepts `file_save` messages and writes files to the correct `ai/views/office-viewer/content/` path.
- [ ] Writes are atomic (no partial files visible to other readers).
- [ ] `file_changed` event fires after successful write.
- [ ] Client `fileDataStore` can send saves and clears dirty state on success.
- [ ] Errors propagate back to the client gracefully.
- [ ] A manual test (simple textarea in a throwaway component) confirms end-to-end save works.

---

## Notes

- The server already has `getPanelPath`, `emit`, and `on` available in `client-message-router.js` scope.
- The `file_changed` event is already consumed by `fileDataStore.invalidate()` — verify that saved files trigger a cache refresh.
- Do **not** build the Crepe editor in this chunk. Use a plain textarea or mock component to test the pipeline.
