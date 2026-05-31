# Browser View Fix Spec

**Status:** Ready for implementation handoff  
**Scope:** All browser-related view components (`BrowserView`, `BrowserViewer`, `BrowserChrome`, `BrowserViewerChrome`)  
**Priority:** Critical — fixes app crashes, broken forms, and layout failures  

---

## Current State

The project has **two parallel browser implementations**:

| Component | Tech | Use Case | File |
|-----------|------|----------|------|
| `BrowserView` | `<iframe>` | General browsing + app container (`custom-viewer`) | `src/components/browser/BrowserView.tsx` |
| `BrowserViewer` | `<webview>` | Native browser panel (`browser-viewer`) | `src/components/browser/BrowserViewer.tsx` |

Both have critical issues that prevent reliable use. This spec details the exact fixes.

---

## Part A: Iframe BrowserView (`custom-viewer`) — Critical Fixes

### A1. Add Missing Sandbox Tokens

**File:** `src/components/browser/BrowserView.tsx`  
**Line:** ~202  
**Current:**
```html
sandbox="allow-scripts allow-same-origin allow-popups"
```

**Problem:** User-built apps cannot submit forms. `window.alert/confirm/prompt` are blocked. File downloads fail.

**Fix:** Change to:
```html
sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
```

Also add `allowfullscreen` to the iframe tag:
```html
<iframe
  ref={iframeRef}
  className="rv-browser-iframe"
  src={currentUrl}
  title={config.name || panelId}
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
  allowfullscreen
  onLoad={handleLoad}
/>
```

### A2. Change `custom-viewer` Default to App Mode

**File:** `ai/views/custom-viewer/index.json`

**Current:**
```json
"mode": "browser"
```

**Problem:** The `custom-viewer` is intended as an app container. In `browser` mode, a link can navigate away and the user has no way back (especially with chrome hidden).

**Fix:**
```json
"mode": "app"
```

### A3. Fix Cross-Origin URL Sync

**File:** `src/components/browser/BrowserView.tsx`  
**Lines:** 124–169 (`handleLoad`)

**Problem:** `iframe.contentWindow.location.href` throws for cross-origin frames. The URL bar never updates when the user navigates inside a cross-origin site. The manual history stack gets out of sync.

**Fix:** Accept that cross-origin navigation cannot be observed from the parent. Restructure `handleLoad`:

1. **Same-origin apps** (localhost, matching origin): Read `location.href`, update URL bar, push to history stack.
2. **Cross-origin apps**: Skip location reading. Do NOT push to history stack. The URL bar remains on the initially loaded URL. Document this limitation.

```typescript
const handleLoad = useCallback(() => {
  const iframe = iframeRef.current;
  if (!iframe) return;

  let loadedUrl: string | null = null;
  let isCrossOrigin = false;

  try {
    loadedUrl = iframe.contentWindow?.location.href || null;
  } catch {
    isCrossOrigin = true;
  }

  if (!loadedUrl || loadedUrl === 'about:blank') {
    return;
  }

  // App mode: enforce origin lock (same-origin only)
  if (mode === 'app') {
    const allowedOrigin = getUrlOrigin(initialUrl);
    const loadedOrigin = getUrlOrigin(loadedUrl);
    if (allowedOrigin && loadedOrigin && loadedOrigin !== allowedOrigin) {
      console.warn('[BrowserView] App mode blocked navigation to different origin:', loadedOrigin);
      pendingNavRef.current = initialUrl;
      setCurrentUrl(initialUrl);
      return;
    }
  }

  // Only update history for same-origin navigations we can observe
  if (isCrossOrigin) {
    return;
  }

  if (pendingNavRef.current === loadedUrl) {
    pendingNavRef.current = null;
    setCurrentUrl(loadedUrl);
    return;
  }

  const stack = historyRef.current;
  const idx = historyIndexRef.current;
  historyRef.current = [...stack.slice(0, idx + 1), loadedUrl];
  historyIndexRef.current = historyRef.current.length - 1;
  setCurrentUrl(loadedUrl);
}, [mode, initialUrl]);
```

### A4. Disable Back/Forward in App Mode

**File:** `src/components/browser/BrowserView.tsx`  
**Lines:** 66–67

**Problem:** In `mode: "app"`, the back/forward buttons operate on the manual history stack, which is meaningless if the app handles its own routing via JavaScript.

**Fix:** Set `canGoBack` and `canGoForward` to `false` when `mode === 'app'`:

```typescript
const canGoBack = mode !== 'app' && historyIndexRef.current > 0;
const canGoForward = mode !== 'app' && historyIndexRef.current < historyRef.current.length - 1;
```

Also disable the back/forward buttons in `BrowserChrome.tsx` when in app mode (or hide them entirely via props).

### A5. Fix Reload Fallback

**File:** `src/components/browser/BrowserView.tsx`  
**Lines:** 108–121 (`handleReload`)

**Current fallback:**
```typescript
iframe.src = 'about:blank';
requestAnimationFrame(() => {
  iframe.src = src;
});
```

**Problem:** Setting `src` to `about:blank` then back loses POST state, scroll position, and form data. The `requestAnimationFrame` timing is brittle.

**Fix:** For same-origin, always use `contentWindow.location.reload()`. For cross-origin where that throws, use a direct `src` re-assignment WITHOUT the `about:blank` intermediate step:

```typescript
const handleReload = useCallback(() => {
  const iframe = iframeRef.current;
  if (!iframe) return;
  try {
    iframe.contentWindow?.location.reload();
  } catch {
    // Cross-origin: force reload by re-assigning src
    const currentSrc = iframe.src;
    iframe.src = currentSrc;
  }
}, []);
```

### A6. Rename Component to Avoid Confusion

**File:** `src/components/browser/BrowserView.tsx`

**Problem:** The name `BrowserView` collides with Electron's deprecated `BrowserView` API (capital B, capital V), which was replaced by `WebContentsView`. This confuses maintainers.

**Fix:** Rename the component to `IframeBrowser` or `EmbeddedBrowser`.

**Files to update:**
- `src/components/browser/BrowserView.tsx` → `src/components/browser/IframeBrowser.tsx`
- `src/components/browser/BrowserView.css` → `src/components/browser/IframeBrowser.css`
- `src/components/ContentArea.tsx` — update import

The class names in CSS (`.rv-browser-view`, etc.) can remain for now to avoid a larger refactor.

---

## Part B: Webview BrowserViewer (`browser-viewer`) — Critical Fix

### B1. Webview Height Fails in Flexbox

**File:** `src/components/browser/BrowserViewer.tsx`  
**File:** `src/components/browser/browser-viewer.css`

**Problem:** The `<webview>` element renders at ~25% height inside the flexbox layout, regardless of CSS attempts (flex, absolute positioning, inline styles).

**Root cause:** `<webview>` guest view surfaces do not reliably inherit sizes from flexbox/grid distribution. This is a known, years-old Electron/Chromium limitation.

**Fix:** Use `ResizeObserver` to explicitly set pixel dimensions on the `<webview>` element.

**Implementation:**

```tsx
// In BrowserViewer.tsx
import { useEffect, useRef } from 'react';

// Inside the component:
const containerRef = useRef<HTMLDivElement>(null);
const webviewRef = useRef<HTMLWebViewElement>(null);

useEffect(() => {
  const container = containerRef.current;
  const webview = webviewRef.current;
  if (!container || !webview) return;

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    webview.style.width = `${width}px`;
    webview.style.height = `${height}px`;
  });

  observer.observe(container);
  return () => observer.disconnect();
}, []);
```

The wrapper div (`containerRef`) must be the flex item that fills the container. The `<webview>` inside gets explicit pixel dimensions and no flex-related sizing.

**CSS change:** Remove any `flex: 1`, `height: 100%`, or absolute positioning rules from the `<webview>` itself. Let the wrapper div handle layout; the webview gets inline pixel styles only.

---

## Part C: Documentation Requirements

### C1. Add X-Frame-Options / CSP Note

Add a comment in `BrowserView.tsx` (or a README) explaining that user servers must allow framing:

```
// NOTE: User apps must send headers allowing iframe embedding:
//   X-Frame-Options: ALLOWALL
//   OR Content-Security-Policy: frame-ancestors 'self' http://localhost:*;
// Default Express/Helmet configs often block this.
```

### C2. Security Trust Model Comment

Add a comment above the iframe sandbox explaining the trust model:

```
// SECURITY: allow-same-origin + allow-scripts means same-origin apps have
// full access to their origin's cookies, localStorage, and DOM. This is
// intentional for a developer tool where the user loads their own server.
// Cross-origin apps are naturally restricted by the Same-Origin Policy.
```

---

## Part D: Files to Modify (Checklist)

- [ ] `src/components/browser/BrowserView.tsx` — sandbox, allowfullscreen, reload fix, handleLoad fix, rename to `IframeBrowser.tsx`
- [ ] `src/components/browser/BrowserView.css` — rename to `IframeBrowser.css`
- [ ] `src/components/browser/BrowserChrome.tsx` — disable back/forward in app mode
- [ ] `src/components/ContentArea.tsx` — update import path after rename
- [ ] `src/components/browser/BrowserViewer.tsx` — add ResizeObserver for pixel sizing
- [ ] `src/components/browser/browser-viewer.css` — remove flex sizing from webview
- [ ] `ai/views/custom-viewer/index.json` — change `mode` to `"app"`
- [ ] `docs/BROWSER_VIEW_SPEC.md` — update to reflect fixes

---

## Decisions Already Made (Do Not Revisit)

1. **`<webview>` is discouraged by Electron.** We only keep `BrowserViewer` for the existing `browser-viewer` panel. No new features should use `<webview>`.
2. **`WebContentsView` is the future path for app containers.** For the `custom-viewer` app container, a future migration to `WebContentsView` (separate renderer process, explicit bounds via main-process IPC) is the long-term architecture. The fixes in this spec are the immediate stabilizing work on the iframe system.
3. **No manual history for cross-origin content.** The parent cannot observe cross-origin iframe navigation. We accept this limitation rather than building fragile workarounds.
