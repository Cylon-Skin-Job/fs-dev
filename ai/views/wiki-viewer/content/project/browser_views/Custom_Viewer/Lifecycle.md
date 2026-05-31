# Lifecycle

This article describes the full lifecycle of a `WebContentsView` panel: creation, visibility, state preservation, and destruction.

---

## States

```
┌─────────┐   create    ┌─────────┐   show    ┌─────────┐
│  None   │ ──────────► │ Hidden  │ ───────► │ Visible │
└─────────┘             └─────────┘          └─────────┘
                              ▲                   │
                              │ hide              │ crash
                              │                   ▼
                              │             ┌─────────┐
                              └──────────── │ Crashed │
                                reload      └─────────┘
                              │
                              ▼
                        ┌─────────┐
                        │ Destroy │
                        └─────────┘
```

---

## None → Hidden (Create)

**Trigger:** React mounts `WebContentsBrowser` for the first time.

**Renderer:**
```typescript
useEffect(() => {
  window.electronAPI.send('browser-panel:create', { panelId, url });
}, []);
```

**Main:**
```javascript
const view = new WebContentsView();
view.webContents.loadURL(url);
views.set(panelId, view);
// View exists but is not attached to any window
```

---

## Hidden → Visible (Show)

**Trigger:** `ResizeObserver` fires with valid bounds.

**Renderer:**
```typescript
const observer = new ResizeObserver((entries) => {
  const { x, y, width, height } = entries[0].contentRect;
  window.electronAPI.send('browser-panel:show', {
    panelId,
    bounds: { x, y, width, height },
  });
});
```

**Main:**
```javascript
mainWindow.contentView.addChildView(view);
view.setBounds(bounds);
```

---

## Visible → Hidden (Hide)

**Trigger:** React unmounts `WebContentsBrowser` (user switches to another panel).

**Renderer:**
```typescript
useEffect(() => {
  return () => {
    window.electronAPI.send('browser-panel:hide', { panelId });
  };
}, []);
```

**Main:**
```javascript
mainWindow.contentView.removeChildView(view);
// Reference is preserved. State (scroll, form inputs) survives.
```

---

## Hidden → Visible (Restore)

**Trigger:** User switches back to the panel.

**Renderer:**
- Re-mounts `WebContentsBrowser`
- Re-creates `ResizeObserver`
- Sends `browser-panel:show` with new bounds

**Main:**
- Re-adds existing view to window
- Sets bounds

**State preserved:** Yes. The view was only removed from the window, not destroyed.

---

## Visible → Crashed

**Trigger:** User app causes renderer process crash.

**Main:**
```javascript
view.webContents.on('render-process-gone', (event, details) => {
  mainWindow.webContents.send('browser-panel:crashed', { panelId });
});
```

**Renderer:**
- Shows crash overlay: *"This app has crashed. [Reload]"*
- Reload button sends `browser-panel:create` with the same URL

---

## Any → Destroy

**Trigger:** Workspace removal, panel deletion, or application quit.

**Renderer:**
```typescript
useEffect(() => {
  return () => {
    window.electronAPI.send('browser-panel:destroy', { panelId });
  };
}, []);
```

**Main:**
```javascript
mainWindow.contentView.removeChildView(view);
view.webContents.destroy();
views.delete(panelId);
```

---

## State Preservation Summary

| Operation | DOM State | JS State | localStorage | Network |
|-----------|-----------|----------|--------------|---------|
| Hide / Show | ✅ Preserved | ✅ Preserved | ✅ Preserved | ❌ Interrupted |
| Crash / Reload | ❌ Lost | ❌ Lost | ✅ Preserved | ❌ Interrupted |
| Destroy / Recreate | ❌ Lost | ❌ Lost | ✅ Preserved | ❌ Interrupted |

---

## For AI Agents

**If you are debugging lifecycle issues:**

- Panel not showing? Check if bounds are valid (non-zero width/height).
- Panel showing at wrong position? Verify `ResizeObserver` is firing and sending correct coordinates.
- Panel disappears on switch? Ensure `hide` is being sent on unmount, not `destroy`.
- Panel state lost on switch? Ensure `destroy` is not being called on unmount.
