# Browser View Spec

A unified view type that serves two purposes:
1. **Full browser** — for AI automation, testing, general web navigation
2. **App container** — locked to a user-managed local server, presenting as a native app panel

---

## Config File

Each browser view is a folder under `ai/views/{id}/` containing an `index.json`:

```json
{
  "id": "amazon-shopper",
  "label": "Amazon Shopper",
  "type": "browser",
  "icon": "public",
  "url": "https://amazon.com",
  "mode": "browser",
  "chrome": {
    "urlBar": true,
    "tabs": true,
    "navButtons": true
  }
}
```

### Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `id` | yes | — | View identifier |
| `label` | yes | — | Display name in view switcher |
| `type` | yes | `"browser"` | Must be `"browser"` |
| `icon` | no | `"public"` | Material icon name |
| `url` | yes | — | Current/initial URL to load |
| `homepage` | no | — | Default URL on fresh load |
| `fullscreen` | no | `false` | Hide all chrome (URL bar, nav, bookmarks) |
| `chrome.urlBar` | no | `true` | Show address bar (when not fullscreen) |
| `chrome.tabs` | no | `true` | Show tab bar (v2) |
| `chrome.navButtons` | no | `true` | Show back/forward/reload (when not fullscreen) |

### Display Modes

**Normal**
- Chrome bar visible (URL bar, nav buttons, bookmarks)
- User can navigate freely
- Use case: AI automation, testing, general browsing

**Fullscreen**
- All chrome hidden
- iframe takes entire panel
- Use case: App container (user backend on localhost)
- Toggled via button or config

---

## UI Layout

### Normal
```
┌─────────────────────────────────────────┐
│ [←] [→] [↻]  https://amazon.com   [⛶] │  ← chrome bar
├─────────────────────────────────────────┤
│ [Home] [Bookmarks...]                   │  ← bookmarks bar (v2)
├─────────────────────────────────────────┤
│                                         │
│         iframe (external URL)           │
│                                         │
└─────────────────────────────────────────┘
```

### Fullscreen
```
┌─────────────────────────────────────────┐
│         iframe (external URL)           │  ← no chrome, full panel
└─────────────────────────────────────────┘
```

**App default appearance:** `fullscreen: true` + `homepage` set.

---

## Security Rules

### URL Validation
- Allowed schemes: `http://`, `https://`, `localhost`
- Blocked schemes: `javascript:`, `data:`, `file:`, `vbscript:`, `about:`, `fusion-studio://`
- Blocked: IP addresses except `127.0.0.1` and `localhost`
- In `mode: "app"`: navigation to a different origin than `url` is blocked

### Sandbox
- Iframe uses `sandbox="allow-scripts allow-same-origin allow-popups"`
- `allow-popups` enables new windows (for OAuth flows in apps)
- No `allow-top-navigation` — iframe cannot redirect the parent window

### CSP / Main Process
- Main Electron window keeps `webSecurity: true`, `nodeIntegration: false`
- Browser view iframe is isolated from main app data
- Bookmark and landing page rendering uses `textContent` only (no HTML injection)

---

## API Surface (Future)

For apps that need Fusion Studio integration, inject a minimal API:

```js
window.fusionStudio = {
  // Read-only system queries
  query: (sql) => postMessageToParent({ type: 'query', sql }),

  // Calendar
  calendar: { list: () => ..., create: (e) => ..., update: (id, e) => ..., delete: (id) => ... },

  // Email
  email: { list: () => ..., send: (msg) => ... },

  // Todo
  todo: { list: () => ..., create: (t) => ..., update: (id, t) => ..., complete: (id) => ... },

  // Workspace context
  getWorkspacePath: () => ...,
};
```

Phase 1 does NOT include this API. It is a standalone browser/app container only.

---

## Phase 1 Scope

- [ ] New `BrowserView` React component
- [ ] Register `"browser"` type in `ContentArea.tsx`
- [ ] Chrome bar: URL input, back/forward/reload buttons
- [ ] `mode: "browser"` — free navigation
- [ ] `mode: "app"` — locked to declared URL
- [ ] `chrome.*` flags show/hide chrome elements
- [ ] URL validation (block dangerous schemes)
- [ ] Navigation blocking in app mode

## Phase 2 Scope (Future)

- [ ] Multi-tab browser
- [ ] Bookmarks JSON in view folder
- [ ] Landing page (`landing.html` in view folder)
- [ ] `window.fusionStudio` injected API
- [ ] History persistence

---

## Example Views

### Full Browser (AI Automation)
```
ai/views/amazon-shopper/index.json
{
  "id": "amazon-shopper",
  "label": "Amazon",
  "type": "browser",
  "url": "https://amazon.com",
  "mode": "browser",
  "chrome": { "urlBar": true, "navButtons": true }
}
```

### App Container (User Backend)
```
ai/views/video-editor/index.json
{
  "id": "video-editor",
  "label": "Video Editor",
  "type": "browser",
  "url": "http://localhost:4000",
  "mode": "app",
  "chrome": { "urlBar": false, "navButtons": false }
}
```

---

## State & Lifecycle

### What happens when you switch away from a browser view?

React unmounts the `<iframe>` element. This destroys the iframe's browsing context — the page is effectively closed.

**What is LOST:**
- DOM state (scroll position, open modals, form inputs)
- JavaScript runtime state (variables, event listeners)
- `sessionStorage`
- In-flight network requests

**What PERSISTS:**
- `localStorage` (stored per-origin by Chromium)
- Cookies
- Backend state (user's Node server keeps running)
- `indexDB` / Cache API

**What this means:**
When you switch back to the browser view, the iframe **reloads from scratch**. The page makes fresh requests to the backend. Whether it "looks like you left it" depends entirely on the app restoring its own state from `localStorage` or the backend.

### User's Node Server Lifecycle

**We do NOT kill the user's Node server on workspace switch.** The server is independent of the view lifecycle. It runs until:
- The user stops it manually
- The workspace is removed
- Fusion Studio quits (future: graceful shutdown)

### Preserving Browser State (Future)

If we want tabs to persist their state across view switches, we'd need to keep hidden iframe elements in the DOM (like Chrome keeps background tabs) or switch to Electron `<webview>` tags. This is Phase 2 complexity.

## Open Questions

1. Should `fullscreen` allow sub-path navigation? (e.g., `localhost:4000/project/123`)
2. Should the URL bar show the actual URL or a simplified display?
3. Do we need a "refresh on workspace switch" behavior?
