# Components

This article documents the React components that make up the browser view system.

---

## IframeBrowser

**File:** `src/components/browser/IframeBrowser.tsx` (formerly `BrowserView.tsx`)

**Purpose:** Renders a sandboxed `<iframe>` with a collapsible chrome bar. Handles navigation events, URL validation, and origin lock in app mode.

**Props:**
```typescript
interface BrowserViewProps {
  config: PanelConfig;
}
```

**Settings read from `config`:**
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `url` | `string` | — | Initial URL to load |
| `homepage` | `string` | — | Default URL on fresh load |
| `mode` | `'browser' \| 'app'` | `'browser'` | Free navigation vs origin-locked |
| `chrome.urlBar` | `boolean` | `true` | Show address bar |
| `chrome.navButtons` | `boolean` | `true` | Show back/forward/reload |

**State:**
- `currentUrl` — URL displayed in the chrome bar and loaded in the iframe
- `isAddressBarHidden` — Whether the chrome bar is collapsed

**Refs:**
- `historyRef` — Manual history stack
- `historyIndexRef` — Current position in history
- `pendingNavRef` — Tracks programmatic navigations to avoid double-pushing

---

## BrowserChrome

**File:** `src/components/browser/BrowserChrome.tsx`

**Purpose:** Chrome bar overlay with back/forward/reload buttons, URL input, and address bar toggle.

**Props:**
```typescript
interface BrowserChromeProps {
  url: string;
  onUrlChange: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onToggleAddressBar: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  showUrlBar: boolean;
  showNavButtons: boolean;
  isAddressBarHidden: boolean;
  mode: 'browser' | 'app';
}
```

**Behavior:**
- URL input is `readOnly` in app mode
- Nav buttons are disabled when `mode === 'app'`
- Collapsed state hides the inner bar; hover restores it

---

## BrowserViewer

**File:** `src/components/browser/BrowserViewer.tsx`

**Purpose:** Renders an Electron `<webview>` tag with native navigation events.

**⚠️ Deprecated path.** Electron discourages `<webview>`. Only fix bugs; do not add features.

**Props:** Same as `IframeBrowser`.

**Key differences from `IframeBrowser`:**
- Uses `<webview>` instead of `<iframe>`
- Native `goBack()` / `goForward()` via webview API
- Per-webview DevTools
- Session isolation via `partition` attribute
- **Layout bug:** Does not reliably fill flexbox containers (use `ResizeObserver` pixel-sizing workaround)

---

## WebContentsBrowser

**File:** `src/components/browser/WebContentsBrowser.tsx` (planned)

**Purpose:** Lifecycle manager for `WebContentsView`-based app containers.

**Does NOT render HTML.** Instead:
- Renders a measurement `<div>`
- Uses `ResizeObserver` to report bounds to main process via IPC
- Sends `create`, `show`, `hide`, `destroy` lifecycle messages
- Displays crash overlays

**Props:** Same as `IframeBrowser`.

---

## ContentArea Routing

**File:** `src/components/ContentArea.tsx`

**Routing logic:**
```typescript
if (config?.hasAppHtml) {
  // Track 1: iframe view (view ships app/index.html)
  return <iframe src={`fusion-studio://${panel}/app/index.html`} />;
}

if (config?.type === 'browser') {
  // Track 2: iframe-based browser
  return <IframeBrowser config={config} />;
}

if (config?.type === 'browser-viewer') {
  // Track 2b: webview-based browser viewer
  return <BrowserViewer config={config} />;
}
```

**Future:** `custom-viewer` will route to `WebContentsBrowser` instead of `IframeBrowser`.
