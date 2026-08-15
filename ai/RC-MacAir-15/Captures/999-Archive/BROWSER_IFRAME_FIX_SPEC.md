# Browser (Iframe) Fix Spec

**Status:** Ready for implementation  
**Scope:** Fix the iframe-based `BrowserView` component used for general web browsing (`mode: "browser"`)  
**Priority:** High — fixes broken forms, brittle reloads, and naming confusion  

---

## Objective

The iframe-based browser is the general-purpose web browser panel (AI automation, testing, free navigation). It is **NOT** the app container — that is handled separately by the `WebContentsView` migration for `custom-viewer`.

This spec covers the concrete fixes needed to make the iframe browser stable and usable.

---

## Current Files

| File | Purpose |
|------|---------|
| `src/components/browser/BrowserView.tsx` | Main iframe component |
| `src/components/browser/BrowserChrome.tsx` | Chrome bar (URL input, nav buttons) |
| `src/components/browser/BrowserView.css` | Styles |
| `src/components/browser/urlValidator.ts` | URL validation |
| `src/components/ContentArea.tsx` | Router — maps `type: "browser"` → `BrowserView` |

---

## Fix 1: Rename Component

**Why:** `BrowserView` collides with Electron's deprecated `BrowserView` API. This confuses maintainers.

**Rename:**
- `src/components/browser/BrowserView.tsx` → `src/components/browser/IframeBrowser.tsx`
- `src/components/browser/BrowserView.css` → `src/components/browser/IframeBrowser.css`

**Update import in:** `src/components/ContentArea.tsx`

CSS class names (`.rv-browser-view`, `.rv-browser-iframe`, etc.) can stay — only the file names and component names change.

---

## Fix 2: Add Missing Sandbox Tokens

**File:** `src/components/browser/IframeBrowser.tsx`  
**Current:**
```html
sandbox="allow-scripts allow-same-origin allow-popups"
```

**Problem:** Forms, modals, and downloads are blocked.

**Change to:**
```html
sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
allowfullscreen
```

`allowfullscreen` enables the Fullscreen API inside the iframe.

---

## Fix 3: Fix Cross-Origin URL Sync

**File:** `src/components/browser/IframeBrowser.tsx`  
**Function:** `handleLoad`

**Problem:** `iframe.contentWindow.location.href` throws for cross-origin frames. The URL bar never updates on cross-origin navigation. The history stack gets corrupted.

**Solution:** Accept that cross-origin navigation cannot be observed. Only sync the URL bar for same-origin frames.

**Replace `handleLoad` with:**
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
      console.warn('[IframeBrowser] App mode blocked navigation to different origin:', loadedOrigin);
      pendingNavRef.current = initialUrl;
      setCurrentUrl(initialUrl);
      return;
    }
  }

  // Cross-origin: cannot observe navigation, skip history sync
  if (isCrossOrigin) {
    return;
  }

  // Same-origin: sync with history stack
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

---

## Fix 4: Fix Reload Fallback

**File:** `src/components/browser/IframeBrowser.tsx`  
**Function:** `handleReload`

**Current fallback:**
```typescript
iframe.src = 'about:blank';
requestAnimationFrame(() => {
  iframe.src = src;
});
```

**Problem:** The `about:blank` intermediate step loses form state and POST data. `requestAnimationFrame` timing is brittle.

**Replace with:**
```typescript
const handleReload = useCallback(() => {
  const iframe = iframeRef.current;
  if (!iframe) return;
  try {
    iframe.contentWindow?.location.reload();
  } catch {
    // Cross-origin: force reload by re-assigning src directly
    const currentSrc = iframe.src;
    iframe.src = currentSrc;
  }
}, []);
```

---

## Fix 5: Disable Back/Forward in App Mode

**File:** `src/components/browser/IframeBrowser.tsx`  
**Current:**
```typescript
const canGoBack = historyIndexRef.current > 0;
const canGoForward = historyIndexRef.current < historyRef.current.length - 1;
```

**Problem:** In `mode: "app"`, back/forward operate on a meaningless manual history stack.

**Change to:**
```typescript
const canGoBack = mode !== 'app' && historyIndexRef.current > 0;
const canGoForward = mode !== 'app' && historyIndexRef.current < historyRef.current.length - 1;
```

Also pass `mode` to `BrowserChrome` so it can disable/hide nav buttons when in app mode.

---

## Fix 6: Document Trust Model & Framing Requirements

**File:** `src/components/browser/IframeBrowser.tsx`  
**Add comment above the iframe:**
```tsx
{/* 
  SECURITY NOTE: allow-same-origin + allow-scripts means same-origin apps 
  have full access to their origin's cookies, localStorage, and DOM. This 
  is intentional for a developer tool where the user loads their own server.
  Cross-origin apps are naturally restricted by the Same-Origin Policy.

  USER APP REQUIREMENT: The server must allow iframe embedding:
    X-Frame-Options: ALLOWALL
    OR Content-Security-Policy: frame-ancestors 'self' http://localhost:*;
  Default Express/Helmet configs often block this.
*/}
```

---

## Summary of File Changes

| File | Change |
|------|--------|
| `BrowserView.tsx` → `IframeBrowser.tsx` | Rename; update sandbox; fix `handleLoad`; fix `handleReload`; disable back/forward in app mode; add comments |
| `BrowserView.css` → `IframeBrowser.css` | Rename only (class names stay) |
| `BrowserChrome.tsx` | Respect `mode` prop to disable/hide nav buttons in app mode |
| `ContentArea.tsx` | Update import path |
| `urlValidator.ts` | No changes needed |

---

## Out of Scope

- `custom-viewer` is handled separately by the `WebContentsView` migration spec
- `browser-viewer` (the `<webview>` panel) is handled separately by its own height-fix spec
- Multi-tab browser (Phase 2)
- Bookmark system (Phase 2)
