# Browser View Spec

A unified view type that serves two purposes:
1. **Full browser** — for AI automation, testing, general web navigation
2. **App container** — locked to a user-managed local server, presenting as a native app panel

The `custom-viewer` panel is the primary app-container use case: the user pastes in their Node server address, dismisses the chrome bar, and treats the iframe as a true native app. Forward/back navigation is the app's own responsibility (handled via its own JavaScript/backend).

---

## Config File

Each browser view is a folder under `ai/<machine>/Views/{id}/` containing an `index.json`:

```json
{
  "id": "custom-viewer",
  "label": "Custom Viewer",
  "type": "browser",
  "icon": "app_registration",
  "url": "https://example.com",
  "mode": "app",
  "chrome": {
    "urlBar": true,
    "tabs": false,
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

**Normal (`mode: "browser"`)**
- Chrome bar visible (URL bar, nav buttons)
- User can navigate freely
- Use case: AI automation, testing, general browsing

**App Container (`mode: "app"`)**
- Origin-locked: navigation to a different origin than `url` is blocked
- Chrome can be hidden (collapsible overlay)
- iframe fills entire panel edge-to-edge
- Use case: User-built Node server app, workflow tools, visual pipelines

---

## UI Layout

### Normal
```
┌─────────────────────────────────────────┐
│ [←] [→] [↻]  https://amazon.com   [⛶] │  ← chrome bar
├─────────────────────────────────────────┤
│                                         │
│         iframe (external URL)           │
│                                         │
└─────────────────────────────────────────┘
```

### Fullscreen / App Mode (chrome hidden)
```
┌─────────────────────────────────────────┐
│                                         │
│         iframe (external URL)           │  ← no chrome, full panel
│                                         │
└─────────────────────────────────────────┘
```

**App default appearance:** `fullscreen: true` + `homepage` set.

---

## Security Rules

### URL Validation
- Allowed schemes: `http://`, `https://`, `localhost`
- Blocked schemes: `javascript:`, `data:`, `file:`, `vbscript:`, `about:`, `fusion-studio://`
- Blocked: IP addresses except `127.0.0.1` and `localhost`
- In `mode: "app"`: navigation to a different origin than `url` is blocked and redirected back

### Sandbox
The iframe uses the following sandbox tokens:

```html
<iframe sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
```

| Token | Purpose |
|-------|---------|
| `allow-scripts` | User apps run JavaScript |
| `allow-same-origin` | Same-origin apps can access their own storage/cookies |
| `allow-popups` | OAuth flows, new windows from user apps |
| `allow-forms` | **Required.** Form submission in user-built apps |

**Consider adding (v2):**
- `allow-modals` — Enables `window.alert()`, `confirm()`, `prompt()`
- `allow-downloads` — File generation/export from user apps

**What is intentionally omitted:**
- `allow-top-navigation` — iframe cannot redirect the parent Fusion Studio window

### Trust Model
Since `allow-scripts` + `allow-same-origin` are both present, a same-origin app has full access to its own origin's cookies, localStorage, and can communicate with the parent via `postMessage`. This is the correct model for a **developer tool** where the user intentionally points to their own server, but it is not a security jail. Cross-origin apps are naturally restricted by the browser's same-origin policy.

### CSP / Main Process
- Main Electron window keeps `contextIsolation: true`, `nodeIntegration: false`
- Browser view iframe cannot access Node.js APIs through the parent

---

## Crash Isolation & Renderer Process

### The Hard Truth
A standard `<iframe>` runs in the **same Chromium renderer process** as the parent page. If a user-built app causes a renderer crash (infinite loop, memory exhaustion, GPU fault), **the entire Fusion Studio window goes down** — not just the panel.

**Options for true crash containment:**

| Approach | Crash Isolated? | Effort | Recommendation |
|----------|----------------|--------|----------------|
| Standard `<iframe>` (current) | ❌ No | — | Acceptable for trusted internal apps |
| Cross-origin iframe (different port) | ⚠️ Maybe (Chromium site isolation) | Zero | Not guaranteed, not controllable |
| `<webview>` tag | ✅ Yes | Medium | **Electron officially discourages this** |
| `WebContentsView` | ✅ Yes | High | **Officially recommended by Electron** |

### Graceful Crash Recovery (What We CAN Do)
Since we cannot prevent a same-origin iframe from sharing the renderer process, we add resilience at the main-process level:

1. **Detect crashes:** `mainWindow.webContents.on('render-process-gone', ...)` already exists in `electron/main.cjs` and auto-reloads the window.
2. **Preserve iframe state:** The crash destroys all iframe runtime state. What persists:
   - `localStorage` / `IndexedDB` (per-origin, survives reload)
   - Cookies
   - Backend state (user's Node server keeps running)
3. **User communication:** On reload, show a toast/notice: *"The app encountered an error and was reloaded."*

### Future: WebContentsView Migration
If crash isolation becomes a hard requirement (e.g., user apps are untrusted, or one buggy app must not kill the studio), the path is `WebContentsView`:
- Created in the **main process**
- Own `WebContents` with separate renderer process
- Sized explicitly via `setBounds()`
- Requires IPC for all chrome-bar communication

This is a significant architectural change and is out of scope for Phase 1.

---

## User App Developer Guide (Documentation)

User-built apps must satisfy these requirements to load inside Fusion Studio:

### 1. Allow Framing
The user's Node server must permit iframe embedding:
```http
# Required headers
X-Frame-Options: ALLOWALL
# OR (preferred)
Content-Security-Policy: frame-ancestors 'self' http://localhost:*;
```

Default security middleware (Helmet, Express's `frameguard`) often blocks this.

### 2. Fullscreen API
If the app uses `element.requestFullscreen()`, the iframe needs the `allowfullscreen` attribute:
```html
<iframe ... allowfullscreen />
```

### 3. Web Notifications / Permissions
Notifications, camera, microphone, and geolocation are **denied by default** inside an iframe. If user apps need these, Fusion Studio must implement `session.setPermissionRequestHandler()` in the main process and delegate per-origin permissions. (Future feature.)

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

If we want tabs to persist their state across view switches, we'd need to keep hidden iframe elements in the DOM (like Chrome keeps background tabs) or switch to Electron `WebContentsView`. This is Phase 2 complexity.

---

## Phase 1 Scope

- [x] New `BrowserView` React component
- [x] Register `"browser"` type in `ContentArea.tsx`
- [x] Chrome bar: URL input, back/forward/reload buttons
- [x] `mode: "browser"` — free navigation
- [x] `mode: "app"` — locked to declared URL
- [x] `chrome.*` flags show/hide chrome elements
- [x] URL validation (block dangerous schemes)
- [x] Navigation blocking in app mode
- [ ] **Add `allow-forms` to iframe sandbox**
- [ ] **Default `custom-viewer` to `mode: "app"`**
- [ ] **Document CSP / X-Frame-Options requirement for user apps**
- [ ] **Add `allowfullscreen` to iframe tag**

## Phase 2 Scope (Future)

- [ ] Multi-tab browser
- [ ] Bookmarks JSON in view folder
- [ ] Landing page (`landing.html` in view folder)
- [ ] `window.fusionStudio` injected API
- [ ] History persistence
- [ ] `allow-modals` and `allow-downloads` sandbox tokens
- [ ] Permission delegation (notifications, camera, microphone)
- [ ] `WebContentsView` crash-isolation migration (if required)

---

## Example Views

### Full Browser (AI Automation)
```
ai/<machine>/Views/amazon-shopper/index.json
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
ai/<machine>/Views/video-editor/index.json
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

## Open Questions

1. Should `fullscreen` allow sub-path navigation? (e.g., `localhost:4000/project/123`)
2. Should the URL bar show the actual URL or a simplified display?
3. Do we need a "refresh on workspace switch" behavior?
4. Is renderer crash isolation a hard requirement, or can we accept same-process risk for Phase 1?
