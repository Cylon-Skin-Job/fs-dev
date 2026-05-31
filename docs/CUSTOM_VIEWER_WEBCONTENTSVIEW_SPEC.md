# Custom Viewer — WebContentsView Migration Spec

**Status:** Ready for implementation  
**Scope:** Replace the iframe-based `custom-viewer` with a `WebContentsView`-based app container  
**Priority:** Critical — provides crash isolation for user-built apps  
**Electron Version:** `^42.0.1` (WebContentsView is stable)  

---

## Objective

The `custom-viewer` panel is an app container: the user pastes in their Node server address, dismisses the chrome bar, and the loaded app fills the panel edge-to-edge. It must behave like a native Fusion Studio panel.

**Why not iframe?** A standard `<iframe>` runs in the same Chromium renderer process as Fusion Studio's UI. If a user app crashes (infinite loop, memory exhaustion, GPU fault), the entire Fusion Studio window dies. This is unfixable with iframe attributes or CSS.

**Why not `<webview>`?** Electron officially discourages the `<webview>` tag due to stability issues.

**Solution:** `WebContentsView` — an officially supported Electron API that creates a separate `WebContents` with its own renderer process. If the user app crashes, only the panel dies. Fusion Studio stays alive.

---

## Architecture

```
Renderer Process                              Main Process
─────────────────                            ─────────────
┌─────────────────┐
│  Fusion Studio  │                         ┌─────────────┐
│    HTML UI      │  ── IPC: bounds ───►    │  Browser    │
│                 │                         │   Window    │
│  ┌───────────┐  │  ◄── measurement       └──────┬──────┘
│  │  <div>    │  │      (ResizeObserver)         │
│  │ ref={m}   │  │                               │
│  └───────────┘  │                        ┌──────┴──────┐
└─────────────────┘                        │ WebContents │
                                           │    View     │  ← separate renderer
                                           │  (custom-   │     process
                                           │   viewer)   │
                                           └─────────────┘
```

### Rules

1. **Renderer owns visibility.** A measurement `<div>` sits in the content area. `ResizeObserver` reports exact pixel bounds to main via IPC. Main calls `view.setBounds()` with those numbers.
2. **Main owns lifecycle.** A Map stores `panelId → WebContentsView`. When the panel switches away, main **removes** the view from the window (preserving state). When the user switches back, main re-adds it.
3. **Default to safe.** If bounds are zero/invalid, or IPC is missing, main hides the view.
4. **Crash isolation.** A crash in the `WebContentsView` renderer emits `render-process-gone` on the view's `webContents`, NOT the main window. The panel shows a crash overlay; Fusion Studio stays alive.

---

## Files to Create / Modify

### New: `electron/browser-panels.cjs`

A main-process module that manages `WebContentsView` instances for browser panels.

**Exports:**
```javascript
function createBrowserPanel(mainWindow, panelId, url)
function showBrowserPanel(panelId, bounds)   // bounds = { x, y, width, height }
function hideBrowserPanel(panelId)
function destroyBrowserPanel(panelId)
function updateBrowserPanelBounds(panelId, bounds)
function getBrowserPanelUrl(panelId)
```

**Implementation notes:**
- Use `new WebContentsView()` to create the view
- Load URL via `view.webContents.loadURL(url)`
- Add to window via `mainWindow.contentView.addChildView(view)`
- Set bounds via `view.setBounds(bounds)`
- Listen to `view.webContents.on('render-process-gone', ...)` for crash handling
- Store views in a `Map` keyed by `panelId`

### New: `electron/preload-browser.cjs` (optional)

If the user app needs to communicate with Fusion Studio (future API), a preload script can be injected. For Phase 1, no preload is required.

### Modify: `electron/main.cjs`

**Changes:**
1. Import and initialize `browser-panels.cjs`
2. Register IPC handlers:
   - `browser-panel:create` → `createBrowserPanel`
   - `browser-panel:show` → `showBrowserPanel`
   - `browser-panel:hide` → `hideBrowserPanel`
   - `browser-panel:destroy` → `destroyBrowserPanel`
   - `browser-panel:update-bounds` → `updateBrowserPanelBounds`
3. On window resize, inform renderer to re-report bounds (or renderer handles this via ResizeObserver)

### New: `src/components/browser/WebContentsBrowser.tsx`

React component that replaces the iframe for `custom-viewer`.

**Responsibilities:**
1. Render a measurement `<div>` that fills the content area
2. Use `ResizeObserver` to report bounds to main via `window.electronAPI` (or IPC)
3. On mount: send `browser-panel:create` and `browser-panel:show`
4. On unmount: send `browser-panel:hide` (do NOT destroy — preserve state for panel switching)
5. On workspace removal / panel close: send `browser-panel:destroy`
6. Handle crash overlay: if main reports `render-process-gone`, show a "This app has crashed" placeholder with a reload button

**IPC contract (renderer → main):**
```typescript
// Create + show on mount
window.electronAPI.send('browser-panel:create', { panelId, url });
window.electronAPI.send('browser-panel:show', { panelId, bounds });

// Hide on unmount (preserve state)
window.electronAPI.send('browser-panel:hide', { panelId });

// Update bounds on resize
window.electronAPI.send('browser-panel:update-bounds', { panelId, bounds });

// Destroy on cleanup
window.electronAPI.send('browser-panel:destroy', { panelId });
```

**IPC contract (main → renderer):**
```typescript
// Crash notification
mainWindow.webContents.send('browser-panel:crashed', { panelId });

// Optional: URL/title updates
mainWindow.webContents.send('browser-panel:title-updated', { panelId, title });
```

### Modify: `src/components/ContentArea.tsx`

**Change:** Route `custom-viewer` (or any panel with `type: 'webcontents-browser'`) to `WebContentsBrowser` instead of `BrowserView`.

For Phase 1, this can be a hardcoded check for `panel === 'custom-viewer'`, or a new `type` field in `index.json`.

### Modify: `ai/views/custom-viewer/index.json`

**Change:** Ensure `mode: 'app'` is set. The `WebContentsBrowser` component should respect this (no navigation chrome, origin lock enforced by the view's URL, not by iframe sandbox).

---

## Phase 1 Scope

- [ ] Create `electron/browser-panels.cjs`
- [ ] Register IPC handlers in `electron/main.cjs`
- [ ] Create `src/components/browser/WebContentsBrowser.tsx`
- [ ] Wire up `ResizeObserver` → IPC → `setBounds()`
- [ ] Handle show/hide lifecycle on panel switch
- [ ] Handle crash recovery (`render-process-gone`)
- [ ] Update `ContentArea.tsx` to route `custom-viewer` to `WebContentsBrowser`
- [ ] Ensure `custom-viewer/index.json` has `mode: 'app'`

## Phase 2 Scope (Future)

- [ ] `window.fusionStudio` injected API via preload script
- [ ] Navigation events forwarded to renderer (title, URL, favicon)
- [ ] Per-view DevTools toggle
- [ ] Multiple `custom-viewer` instances (different panel IDs)
- [ ] Graceful handling of sticky overlay UI (resize view when secondary chat appears)

---

## Z-Index / Overlay Considerations

`WebContentsView` paints on top of HTML. For the app-container use case (chrome hidden, full panel), this is acceptable — the app IS the content.

If Fusion Studio UI needs to appear over the app (e.g., a global modal or dropdown), the renderer must temporarily hide the view via `browser-panel:hide` or reduce its bounds. Phase 1 can assume no overlays cover the app container.

---

## Security

- `contextIsolation: true` and `nodeIntegration: false` remain in `main.cjs`
- The `WebContentsView` does NOT inherit Node integration from the parent
- User apps are isolated by standard Chromium sandboxing (separate renderer process)
- No `<iframe sandbox>` attributes apply — `WebContentsView` is a native Chromium view, not an HTML element
