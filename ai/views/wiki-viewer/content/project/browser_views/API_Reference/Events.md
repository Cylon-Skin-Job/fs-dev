# Events

This article documents the DOM events and IPC events used by the browser view system.

---

## Iframe Events

### DOM Events (on iframe element)

| Event | Fires When | Handler |
|-------|-----------|---------|
| `onLoad` | iframe finishes loading | `handleLoad` — syncs URL bar, enforces origin lock |

**Note:** There is no `onBeforeNavigate`, `onDidNavigate`, or `onPageTitleUpdated` for iframes. Navigation inside the iframe is largely invisible to the parent.

### Custom Events (none)

The iframe browser does not emit custom events. State changes are handled through React props and refs.

---

## Webview Events

### DOM Events (on webview element)

| Event | Fires When | Data |
|-------|-----------|------|
| `did-start-loading` | Page starts loading | — |
| `did-stop-loading` | Page stops loading | — |
| `did-finish-load` | Navigation done | — |
| `did-navigate` | Navigation to new URL | `{ url }` |
| `page-title-updated` | Title changes | `{ title }` |
| `dom-ready` | Document loaded | — |
| `console-message` | Guest logs to console | `{ level, message, line, sourceId }` |

**Note:** These events are rich but unreliable due to Electron's discouragement of `<webview>`.

---

## WebContentsView Events

### Main Process Events (on view.webContents)

| Event | Fires When | Handler |
|-------|-----------|---------|
| `did-navigate` | Navigation to new URL | Forward URL to renderer (Phase 2) |
| `page-title-updated` | Title changes | Forward title to renderer (Phase 2) |
| `render-process-gone` | Renderer crashes | Send `browser-panel:crashed` to renderer |

### IPC Events (Renderer ↔ Main)

See [Custom Viewer / IPC Protocol](../Custom_Viewer/IPC_Protocol.md) for the full message reference.

---

## React Component Events

### IframeBrowser → BrowserChrome

| Callback | Triggered By | Purpose |
|----------|-------------|---------|
| `onUrlChange(url)` | User submits URL in chrome bar | Navigate to new URL |
| `onBack()` | User clicks back button | Move back in history stack |
| `onForward()` | User clicks forward button | Move forward in history stack |
| `onReload()` | User clicks reload button | Reload current page |
| `onToggleAddressBar()` | User clicks toggle button | Show/hide chrome bar |

---

## For AI Agents

**If you need to observe navigation in the iframe browser:**

- Same-origin: Use `onLoad` and read `contentWindow.location.href`.
- Cross-origin: You cannot observe navigation. Consider migrating to `WebContentsView`.

**If you need rich navigation events:**

- Use `WebContentsView` (custom-viewer). It exposes `did-navigate`, `page-title-updated`, etc.
- Do not build new features on `<webview>`. It is officially discouraged.
