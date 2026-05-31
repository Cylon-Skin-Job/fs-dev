# WebContentsView Migration

This article describes the migration of the `custom-viewer` app container from an iframe to `WebContentsView` — the officially supported, crash-isolated architecture.

---

## Why Migrate?

The `custom-viewer` is designed as an app container: the user pastes in their Node server address, dismisses the chrome bar, and the app fills the panel. If that app crashes, it must not take down Fusion Studio.

The iframe could not provide this guarantee. `WebContentsView` can.

---

## What Changes

### Before (Iframe)

```tsx
// BrowserView.tsx
<iframe
  src={currentUrl}
  sandbox="allow-scripts allow-same-origin allow-popups"
/>
```

- Runs in same renderer process as Fusion Studio
- Manual history stack in React refs
- Limited navigation observability
- Chrome bar overlay rendered in HTML

### After (WebContentsView)

```tsx
// WebContentsBrowser.tsx
<div ref={containerRef} />
// ResizeObserver reports bounds to main process via IPC
// Main process creates and positions the WebContentsView
```

- Runs in separate renderer process
- Native `webContents` navigation API
- Per-view DevTools
- No chrome bar (app container mode)

---

## Files Involved

| File | Role |
|------|------|
| `electron/browser-panels.cjs` | Main-process panel manager |
| `electron/main.cjs` | IPC handler registration |
| `src/components/browser/WebContentsBrowser.tsx` | Renderer lifecycle component |
| `src/components/ContentArea.tsx` | Route `custom-viewer` to WebContentsBrowser |
| `ai/views/custom-viewer/index.json` | Panel config (`mode: "app"`) |

---

## Phase 1 Scope

- [ ] Create `electron/browser-panels.cjs`
- [ ] Register IPC handlers in `electron/main.cjs`
- [ ] Create `WebContentsBrowser.tsx`
- [ ] Wire up `ResizeObserver` → IPC → `setBounds()`
- [ ] Handle show/hide lifecycle on panel switch
- [ ] Handle crash recovery (`render-process-gone`)
- [ ] Update `ContentArea.tsx` routing
- [ ] Ensure `custom-viewer/index.json` has `mode: "app"`

## Phase 2 Scope (Future)

- [ ] `window.fusionStudio` injected API via preload script
- [ ] Navigation events forwarded to renderer (title, URL, favicon)
- [ ] Per-view DevTools toggle
- [ ] Multiple `custom-viewer` instances
- [ ] Overlay handling (resize/hide when modals appear)

---

## For AI Agents

**If you are implementing the WebContentsView migration:**

1. Read `docs/CUSTOM_VIEWER_WEBCONTENTSVIEW_SPEC.md` — it has the exact implementation details.
2. The main process must own the `WebContentsView` lifecycle. Never create it from the renderer.
3. Bounds must come from the renderer's `ResizeObserver`. Do not hardcode pixel values.
4. On panel switch, hide (do not destroy) the view to preserve state.
