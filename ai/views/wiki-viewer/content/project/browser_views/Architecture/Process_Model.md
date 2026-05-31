# Process Model

This article describes how renderer processes, the main process, and IPC interact in the browser view system.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Main Process                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              BrowserWindow (Electron)                │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Fusion Studio HTML UI                      │   │   │
│  │  │  (React, renderer process A)                │   │   │
│  │  │                                              │   │   │
│  │  │  ┌─────────────────────────────────────┐   │   │   │
│  │  │  │  Measurement <div>                  │   │   │   │
│  │  │  │  ResizeObserver → IPC (bounds)     │   │   │   │
│  │  │  └─────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  WebContentsView                            │   │   │
│  │  │  (User app, renderer process B)             │   │   │
│  │  │                                              │   │   │
│  │  │  • Separate webContents                     │   │   │
│  │  │  • Own session, cookies, storage            │   │   │
│  │  │  • Crash does not affect process A          │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  browser-panels.cjs (Map: panelId → WebContentsView)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Renderer Process A: Fusion Studio UI

This is the standard Electron renderer process that runs the React application.

**Responsibilities:**
- Render the measurement `<div>` that defines where the `WebContentsView` should appear
- Run `ResizeObserver` and report pixel bounds to main via IPC
- Handle panel switches: send `show` / `hide` IPC messages
- Display crash overlays when main reports a panel crash
- Render the chrome bar (for iframe browser mode)

**Security:**
- `contextIsolation: true`
- `nodeIntegration: false`
- Cannot directly access `WebContentsView` APIs

---

## Renderer Process B: User App

This is the `WebContentsView`'s renderer process. It is completely isolated from Process A.

**Characteristics:**
- Loads the user-provided URL
- Runs standard web APIs (no Node.js access unless explicitly enabled)
- Owns its own cookies, `localStorage`, `IndexedDB`, and session
- Can crash independently of Process A

**Communication with Process A:**
- Direct DOM access is impossible (different processes)
- Communication must go through the main process via IPC
- Future: a `window.fusionStudio` injected API via preload script

---

## Main Process: browser-panels.cjs

The main process owns and manages `WebContentsView` instances.

**API Surface:**

```javascript
// Create a new panel (does not show it yet)
createBrowserPanel(mainWindow, panelId, url)

// Show the panel at specific bounds
showBrowserPanel(panelId, bounds)  // bounds = { x, y, width, height }

// Hide the panel (preserves state)
hideBrowserPanel(panelId)

// Destroy the panel (cleanup)
destroyBrowserPanel(panelId)

// Update bounds on resize
updateBrowserPanelBounds(panelId, bounds)
```

**Storage:**
- Panels are stored in a `Map<string, WebContentsView>` keyed by `panelId`
- Hiding a panel removes it from the window's content view but keeps the reference
- Destroying a panel deletes the reference and frees the renderer process

---

## IPC Protocol

### Renderer → Main

| Message | Payload | Purpose |
|---------|---------|---------|
| `browser-panel:create` | `{ panelId, url }` | Create and load a new WebContentsView |
| `browser-panel:show` | `{ panelId, bounds }` | Add to window and set bounds |
| `browser-panel:hide` | `{ panelId }` | Remove from window (preserve state) |
| `browser-panel:destroy` | `{ panelId }` | Destroy the WebContentsView |
| `browser-panel:update-bounds` | `{ panelId, bounds }` | Resize on window resize |

### Main → Renderer

| Message | Payload | Purpose |
|---------|---------|---------|
| `browser-panel:crashed` | `{ panelId }` | Notify that the panel's renderer crashed |
| `browser-panel:title-updated` | `{ panelId, title }` | Forward page title changes (optional) |

---

## Bounds Management

The main process does not know the pixel coordinates of the content area. Bounds are driven entirely by the renderer.

**Flow:**
1. Renderer renders a `<div ref={containerRef}>` in the content area
2. `ResizeObserver` watches the div
3. On resize, renderer calls `getBoundingClientRect()` to get `{ x, y, width, height }`
4. Renderer sends `browser-panel:update-bounds` to main
5. Main calls `view.setBounds(bounds)`

**Safety rules:**
- If bounds are zero or invalid, main hides the view
- If IPC is delayed, the view may briefly show at old bounds — acceptable
- On panel switch, renderer sends `hide` before bounds become stale

---

## Z-Index and Overlays

`WebContentsView` paints using the native Chromium compositor, which means it appears **on top of HTML content**.

**Implications:**
- Fusion Studio dropdowns, modals, and tooltips would be hidden behind the view
- The sticky secondary chat panel would be obscured

**Mitigation:**
- Phase 1 assumes no overlays cover the app container
- Phase 2: when overlays appear, renderer sends `hide` or reduced bounds
- Alternatively: overlays are handled within the user app itself
