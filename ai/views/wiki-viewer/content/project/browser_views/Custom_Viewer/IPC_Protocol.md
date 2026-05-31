# IPC Protocol

This article documents the exact IPC messages used between the renderer and main process for `WebContentsView` panel management.

---

## Renderer → Main

### `browser-panel:create`

Creates a new `WebContentsView`, loads the URL, but does **not** show it.

```typescript
window.electronAPI.send('browser-panel:create', {
  panelId: 'custom-viewer',
  url: 'http://localhost:4000',
});
```

**Main process action:**
```javascript
const view = new WebContentsView();
view.webContents.loadURL(url);
views.set(panelId, view);
```

### `browser-panel:show`

Adds the view to the window and sets its pixel bounds.

```typescript
window.electronAPI.send('browser-panel:show', {
  panelId: 'custom-viewer',
  bounds: { x: 320, y: 64, width: 960, height: 720 },
});
```

**Main process action:**
```javascript
const view = views.get(panelId);
mainWindow.contentView.addChildView(view);
view.setBounds(bounds);
```

### `browser-panel:hide`

Removes the view from the window but preserves the reference.

```typescript
window.electronAPI.send('browser-panel:hide', {
  panelId: 'custom-viewer',
});
```

**Main process action:**
```javascript
const view = views.get(panelId);
mainWindow.contentView.removeChildView(view);
```

### `browser-panel:update-bounds`

Updates the view's size and position. Sent on every `ResizeObserver` callback.

```typescript
window.electronAPI.send('browser-panel:update-bounds', {
  panelId: 'custom-viewer',
  bounds: { x: 320, y: 64, width: 960, height: 720 },
});
```

**Main process action:**
```javascript
const view = views.get(panelId);
view.setBounds(bounds);
```

### `browser-panel:destroy`

Destroys the `WebContentsView` and frees its renderer process.

```typescript
window.electronAPI.send('browser-panel:destroy', {
  panelId: 'custom-viewer',
});
```

**Main process action:**
```javascript
const view = views.get(panelId);
mainWindow.contentView.removeChildView(view);
view.webContents.destroy();
views.delete(panelId);
```

---

## Main → Renderer

### `browser-panel:crashed`

Sent when the view's renderer process dies.

```javascript
mainWindow.webContents.send('browser-panel:crashed', {
  panelId: 'custom-viewer',
});
```

**Renderer action:** Show crash overlay with reload button.

### `browser-panel:title-updated` (Phase 2)

Forwarded from `webContents.on('page-title-updated')`.

```javascript
mainWindow.webContents.send('browser-panel:title-updated', {
  panelId: 'custom-viewer',
  title: 'Video Editor',
});
```

---

## Message Flow: Panel Switch

```
User clicks "Custom Viewer" in panel switcher
  → React mounts WebContentsBrowser
    → send 'browser-panel:create'  (if not exists)
    → send 'browser-panel:show'    (with current bounds)

User clicks "Wiki"
  → React unmounts WebContentsBrowser
    → send 'browser-panel:hide'

User clicks "Custom Viewer" again
  → React remounts WebContentsBrowser
    → send 'browser-panel:show'    (re-adds existing view)
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Bounds are `{0,0,0,0}` | Main hides the view |
| IPC sent for non-existent panelId | Main logs warning, no-op |
| View crashes | Main emits `browser-panel:crashed`, renderer shows overlay |
| Window resizes | Renderer detects via ResizeObserver, sends `update-bounds` |
