# Chunk D — View Loader (iframe)

← [ROADMAP-REVISED.md](../ROADMAP-REVISED.md)

**Phase:** 2.3
**Depends on:** Chunk C (`fusion-studio://` custom protocol)
**Ticket:** RCC-0085

---

## Goal

Replace the static React component map in `ContentArea.tsx` with a dynamic dual-track loader. Views that ship an `app/index.html` entry point mount inside an iframe served over `fusion-studio://`; all other panels continue to render through their existing built-in React components. Zero disruption during the transition.

---

## Decision Log

| # | Question | Resolution |
|---|----------|------------|
| 1 | Where does the iframe live? | Inside `ContentArea.tsx`, not a new `PanelWrapper`. The existing `PanelWrapper` in `App.tsx` already handles warm-panel layout (all panels in DOM, CSS `active` toggle). `ContentArea` is the content leaf — it decides *what* to render. |
| 2 | How does the client know a view has `app/index.html`? | Probe during panel discovery (`loadPanelConfig` in `lib/panels.ts`). The server already answers `file_content_request` for arbitrary paths; the client fetches `{panelId}/app/index.html` and sets `hasAppHtml: true` on success. |
| 3 | What replaces `views-watcher.js`? | Nothing on the backend. The workspace-wide watcher (`workspace-watcher.js`) already emits `file:changed` for every path under the project root, including `ai/views/`. Delete the dedicated `views-watcher.js` and remove its startup call. Any future consumer that needs view-specific events should listen to `file:changed` and filter for `ai/views/` paths. |
| 4 | Warm vs lazy iframe creation? | Warm. `App.tsx` already renders every panel into the DOM; inactive panels are hidden with `opacity: 0; visibility: hidden`. Iframes inherit this for free — they load once on workspace init and stay warm. |
| 5 | postMessage security — whose responsibility? | Documented here, enforced in Chunk E (theme bridge) and in every view iframe. The shell will broadcast to `fusion-studio://*`; each view must validate `event.origin === 'fusion-studio://'` before acting on incoming messages. |

---

## Files Changed

| File | Change |
|------|--------|
| `fusion-studio-server/lib/watch/views-watcher.js` | **Delete** — redundant; workspace watcher already covers `ai/views/` |
| `fusion-studio-server/lib/startup.js` | Remove `views-watcher` require + `startViewsWatcher()` call |
| `fusion-studio-client/src/lib/panels.ts` | Add `hasAppHtml?: boolean` to `PanelConfig`; probe for `app/index.html` in `loadPanelConfig` |
| `fusion-studio-client/src/components/ContentArea.tsx` | Dual-track render: `config.hasAppHtml` → `<iframe src="fusion-studio://{panel}/app/index.html">`; else fall through to existing static component map |
| `fusion-studio-client/src/components/App.css` | Add `.rv-view-iframe` rule: `width: 100%; height: 100%; border: none;` |

---

## Backend Changes

### 1. Delete `lib/watch/views-watcher.js`

This file maintained its own chokidar subscription on `ai/views/` and emitted `views:added`, `views:removed`, `views:changed`. No code in the codebase subscribes to those events. The workspace watcher (`workspace-watcher.js`) already watches the entire project root and emits `file:changed` for every path, including `ai/views/`. Deleting this eliminates redundant chokidar instances and aligns with the code-standard rule: *one job per file, extract only when a second consumer appears*.

### 2. Update `lib/startup.js`

Remove:
```js
const { start: startViewsWatcher } = require('./watch/views-watcher');
```

Remove:
```js
let viewsWatcherUnsub = null;
if (fs.existsSync(viewsPath)) {
  viewsWatcherUnsub = startViewsWatcher(projectRoot);
} else {
  console.log('[Server] ai/views not found — views watcher skipped');
}
```

No replacement code is needed. If a future feature needs to react to view-folder changes, it should `on('file:changed', ...)` and filter `context.relativePath.startsWith('ai/views/')`.

---

## Frontend Changes

### 3. Panel Discovery — `lib/panels.ts`

Add to `PanelConfig`:
```ts
/** True if panel ships an app/index.html iframe entry point */
hasAppHtml?: boolean;
```

In `loadPanelConfig`, after the `hasUiFolder` probe, add:
```ts
const hasAppHtml = await fetchPanelFile(ws, panelAlias, `${panelId}/app/index.html`)
  .then(() => true)
  .catch(() => false);
```

Include `hasAppHtml` in the returned config object.

**Rationale:** Probing during discovery means the client knows the render path before the user ever switches to the panel. No async flash-of-wrong-content. The probe is a single `file_content_request` round-trip per panel, same mechanism already used for `ui/module.js` and `index.json`.

### 4. ContentArea — `components/ContentArea.tsx`

Replace the body of `ContentArea` with dual-track logic:

```tsx
export const ContentArea: React.FC<ContentAreaProps> = ({ panel }) => {
  const configs = usePanelStore((state) => state.panelConfigs);
  const config = configs.find((c) => c.id === panel);

  // Track 1: iframe view (view ships app/index.html)
  if (config?.hasAppHtml) {
    return (
      <main className="rv-content-area">
        <iframe
          className="rv-view-iframe"
          src={`fusion-studio://${panel}/app/index.html`}
          title={config.name || panel}
          sandbox="allow-scripts allow-same-origin"
        />
      </main>
    );
  }

  // Track 2: built-in static React component
  const StaticComponent = CONTENT_COMPONENTS[panel];

  return (
    <main className="rv-content-area">
      {StaticComponent ? (
        <StaticComponent />
      ) : (
        <div className="rv-content-placeholder">
          <h3 className="rv-content-placeholder-heading">
            {config?.name || panel}
          </h3>
          <p className="rv-content-placeholder-body">
            Content area for {(config?.name || panel).toLowerCase()} panel.
          </p>
        </div>
      )}
    </main>
  );
};
```

**Notes:**
- `sandbox="allow-scripts allow-same-origin"` lets the iframe run JS and access `localStorage` / `sessionStorage` on the `fusion-studio://` origin, but blocks top-level navigation and form submission.
- The `title` prop is for accessibility.
- No `postMessage` listener in the shell yet — that lands in Chunk E (theme token bridge).

### 5. App.css — iframe sizing

Add one rule:
```css
.rv-view-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-solid);
}
```

Because `.rv-content-area > * { flex: 1; min-height: 0; min-width: 0; }`, the iframe fills the content area by default. The explicit rule makes it robust.

---

## Security Notes

### Origin Validation (for view authors)

Every view that listens to `message` events from the shell MUST validate origin:

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'fusion-studio://') return;
  // ...handle message
});
```

The `fusion-studio://` protocol is registered with `secure: true` and `standard: true` in `protocol-handler.cjs`, so `event.origin` will be exactly `fusion-studio://` (no hostname in the origin string for custom protocols in Electron).

### Shell → Iframe Broadcast Pattern (Chunk E preview)

Chunk E will add a `window.postMessage` broadcast from the shell to all warm iframes:

```ts
const iframes = document.querySelectorAll('.rv-view-iframe');
iframes.forEach((iframe) => {
  iframe.contentWindow?.postMessage({ type: 'theme:tokens', tokens }, '*');
});
```

The `*` targetOrigin is safe here because:
1. The iframe `src` is controlled by the shell (`fusion-studio://` protocol handler).
2. The view iframe validates `event.origin === 'fusion-studio://'` on receipt.
3. No sensitive data travels in the theme tokens (they are public CSS values).

---

## Smoke Tests

- [ ] App boots cleanly after deleting `views-watcher.js` — no "module not found" errors in server logs.
- [ ] `git grep views-watcher` returns zero hits outside of `docs/` and `specs/` (archival).
- [ ] Panel discovery still completes; `panelConfigs` populated correctly.
- [ ] Views without `app/index.html` render exactly as before (React component map).
- [ ] A view with `app/index.html` renders an iframe with correct `fusion-studio://` URL.
- [ ] Inactive-panel iframes are in DOM but hidden (`opacity: 0; visibility: hidden`).
- [ ] Switching to a panel with an iframe is instant (no load flash).
- [ ] No CORS errors in DevTools for `fusion-studio://` iframe loads.

---

## Follow-on Work

| Chunk | What |
|-------|------|
| E | Theme token bridge — shell reads `ai/system/styles/themes.json`, broadcasts computed CSS tokens to active view iframe via `postMessage`. |
| J | Issues-viewer redesign — first view to ship as an iframe-based app. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-22 | Initial spec written. |
