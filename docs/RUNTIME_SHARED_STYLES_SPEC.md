# Runtime Shared Styles — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Prerequisite for:** `VIEW_TEMPLATES_SPEC.md` (CSS needs to load at runtime before we store defaults in the DB).

---

## 1. Purpose

`views.css` — the chat/thread chrome that every view depends on — is currently baked into the JS bundle via a Vite `@views` alias that points to open-robin's `ai/views/`. This means:

- A different workspace cannot provide its own `views.css`
- The styles are frozen at build time
- When we ship Electron, the `@views` alias won't resolve (the open-robin repo won't exist on the user's machine)

Code-viewer already solved this for itself: it loads `themes.css`, `components.css`, and `layout.css` at runtime over WebSocket via `useCodeViewerWorkspaceStyles`. This spec extends that pattern to all views.

**After this:**
- All views load the shared style layer (themes + components + views) at runtime from the active workspace
- Each view can optionally have its own `settings/styles/layout.css`
- The `@views` build-time import is removed
- Switching workspaces loads that workspace's CSS

---

## 2. The shared style layer

Three CSS files under `ai/views/settings/styles/` apply to every view:

| File | What it does |
|---|---|
| `themes.css` | Theme variable overrides (workspace-level accent colors, backgrounds) |
| `components.css` | Shared component styles (tooltips, badges, modals, toasts) |
| `views.css` | Chat column, thread sidebar, message bubbles, composer, thread list |

These are the **workspace-shared** styles. They're not per-view — they apply globally within the workspace. Code-viewer already loads `themes.css` and `components.css` at runtime. This spec adds `views.css` to the same mechanism and extends it to all views.

---

## 3. The per-view layer

Each view can optionally have:

```
ai/views/<viewer>/settings/styles/layout.css
```

Today only `code-viewer` has one (file explorer split layout). Other views will add theirs over time. The per-view CSS is scoped to `[data-panel="<viewer>"]` so it doesn't leak.

---

## 4. Changes

### 4a. Remove build-time `@views` import

In `src/main.tsx`, remove:
```ts
import '@views/settings/styles/views.css';
```

This is the line that bakes open-robin's `views.css` into the bundle. After removal, `views.css` is loaded at runtime like everything else.

### 4b. Remove the `@views` Vite alias (if no other consumers)

Check if anything else uses `@views`. If `main.tsx` line 4 was the only consumer, remove the alias from `vite.config.ts`:
```ts
'@views': path.resolve(__dirname, '../ai/views'),
```

If other imports use it, leave it for now and address in a follow-up.

### 4c. New hook: `useSharedWorkspaceStyles`

Replace the code-viewer-specific `useCodeViewerWorkspaceStyles` with a universal hook that every view calls. This hook loads the three shared CSS files once (not per-view — they're workspace-global).

```
src/hooks/useSharedWorkspaceStyles.ts
```

```ts
import { useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import { fetchViewsRootFile } from '../lib/panels';

const SHARED_LAYERS = [
  { id: 'themes',     path: 'settings/styles/themes.css' },
  { id: 'components', path: 'settings/styles/components.css' },
  { id: 'views',      path: 'settings/styles/views.css' },
];

const STYLE_PREFIX = 'ws-shared-styles-';

// Track whether shared styles are already loaded (global, not per-component)
let loadedForWs: WebSocket | null = null;

/**
 * Load the workspace-shared style layer (themes + components + views).
 * Safe to call from multiple components — loads once per WebSocket connection.
 * Reloads when the connection changes (workspace switch triggers reconnect or
 * rediscovery, which resets the WS reference).
 */
export function useSharedWorkspaceStyles() {
  const ws = usePanelStore((s) => s.ws);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (loadedForWs === ws) return; // already loaded for this connection

    let cancelled = false;

    Promise.all(SHARED_LAYERS.map((layer) => fetchViewsRootFile(ws, layer.path)))
      .then((contents) => {
        if (cancelled) return;
        loadedForWs = ws;
        SHARED_LAYERS.forEach((layer, i) => {
          const css = contents[i]?.trim();
          const styleId = `${STYLE_PREFIX}${layer.id}`;
          document.getElementById(styleId)?.remove();
          if (css) {
            const el = document.createElement('style');
            el.id = styleId;
            el.textContent = css;  // NOT scoped — these are global workspace styles
            document.head.appendChild(el);
          }
        });
      })
      .catch((err) => {
        console.error('[SharedStyles] Failed to load workspace styles:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [ws]);
}
```

**Key difference from the old hook:** These styles are NOT scoped to `[data-panel=...]`. They are workspace-global — chat chrome, thread list, etc. apply everywhere. The `scopePanelCss` wrapper is not used here.

### 4d. New hook: `useViewLayoutStyles`

Optional per-view layout CSS. Loaded and scoped to the view's `data-panel` attribute.

```ts
import { useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import { fetchPanelWorkspaceFile } from '../lib/panels';
import { scopePanelCss } from '../lib/scopePanelCss';

const STYLE_PREFIX = 'ws-view-layout-';

/**
 * Load optional per-view layout CSS from ai/views/<panelId>/settings/styles/layout.css.
 * Scoped to [data-panel="<panelId>"] so it doesn't leak to other views.
 * Silently no-ops if the file doesn't exist (ENOENT).
 */
export function useViewLayoutStyles(panelId: string) {
  const ws = usePanelStore((s) => s.ws);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    let cancelled = false;
    const styleId = `${STYLE_PREFIX}${panelId}`;

    fetchPanelWorkspaceFile(ws, panelId, 'settings/styles/layout.css')
      .then((css) => {
        if (cancelled) return;
        const trimmed = css?.trim();
        if (!trimmed) return;
        document.getElementById(styleId)?.remove();
        const el = document.createElement('style');
        el.id = styleId;
        el.textContent = scopePanelCss(css, panelId);
        document.head.appendChild(el);
      })
      .catch(() => {
        // ENOENT / timeout — no layout.css for this view, that's fine
      });

    return () => {
      cancelled = true;
      document.getElementById(styleId)?.remove();
    };
  }, [panelId, ws]);
}
```

### 4e. Update `App.tsx` — load shared styles once at the app level

Add `useSharedWorkspaceStyles()` at the top of the `App` component, so the shared layer loads once regardless of which view is active:

```tsx
function App() {
  useWebSocket();
  useSharedWorkspaceStyles();  // ← new: load themes + components + views CSS from workspace
  // ... rest of App
}
```

### 4f. Update `FileExplorer.tsx` — switch from old hook to new

Replace:
```tsx
import { useCodeViewerWorkspaceStyles } from '../../hooks/usePanelWorkspaceStyles';
// ...
useCodeViewerWorkspaceStyles();
```

With:
```tsx
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
// ...
useViewLayoutStyles('code-viewer');
```

The shared layer is already loaded by App. FileExplorer only needs its per-view `layout.css`.

### 4g. Other content components — add per-view layout hook

Each content component (WikiExplorer, TicketBoard, AgentTiles) gets the layout hook. Today they don't have a `layout.css`, so it no-ops. But the wiring is in place for when they do:

```tsx
// In WikiExplorer.tsx, TicketBoard.tsx, AgentTiles.tsx:
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
// ...
useViewLayoutStyles('wiki-viewer');  // or 'issues-viewer', 'agents-viewer'
```

### 4h. Clean up old hooks

Delete or deprecate `useCodeViewerWorkspaceStyles` and `usePanelWorkspaceStyles` from `src/hooks/usePanelWorkspaceStyles.ts`. They are replaced by `useSharedWorkspaceStyles` + `useViewLayoutStyles`.

### 4i. Reload on workspace switch

When `workspace:switched` fires and `rediscoverPanels` runs, the WebSocket reference in the store updates (or the same WS is reused). The `useSharedWorkspaceStyles` hook watches the `ws` reference. If it changes, styles reload. If the same WS is reused, force a reload by resetting `loadedForWs = null` in the workspace switch handler:

```ts
// In workspace-handlers.ts, case 'workspace:switched':
import { resetSharedStyles } from '../../hooks/useSharedWorkspaceStyles';
// ...
resetSharedStyles();  // force reload from new workspace on next render
```

Export a `resetSharedStyles` function from the hook module:
```ts
export function resetSharedStyles() {
  loadedForWs = null;
  SHARED_LAYERS.forEach((layer) => {
    document.getElementById(`${STYLE_PREFIX}${layer.id}`)?.remove();
  });
}
```

---

## 5. What about new workspaces that don't have CSS files?

When bootstrap creates a new workspace, it doesn't have `settings/styles/` yet. The fetch will fail with ENOENT. The hooks handle this gracefully — `views.css` catch block says "keep going." The app renders with the built-in component CSS (from `App.css`, `index.css`, etc.) which provides a usable baseline.

The VIEW_TEMPLATES_SPEC (next step) will store default CSS in the DB and have bootstrap write the shared CSS files into new workspaces. But the runtime loading mechanism from THIS spec needs to be in place first.

---

## 6. Files changed

| File | Change |
|---|---|
| `src/main.tsx` | Remove `import '@views/settings/styles/views.css'` |
| `vite.config.ts` | Remove `@views` alias (if no other consumers) |
| `src/hooks/useSharedWorkspaceStyles.ts` | **New** — `useSharedWorkspaceStyles` + `useViewLayoutStyles` + `resetSharedStyles` (~80 lines) |
| `src/components/App.tsx` | Add `useSharedWorkspaceStyles()` call |
| `src/components/file-explorer/FileExplorer.tsx` | Switch to `useViewLayoutStyles('code-viewer')` |
| `src/components/wiki/WikiExplorer.tsx` | Add `useViewLayoutStyles('wiki-viewer')` |
| `src/components/tickets/TicketBoard.tsx` | Add `useViewLayoutStyles('issues-viewer')` |
| `src/components/agents/AgentTiles.tsx` | Add `useViewLayoutStyles('agents-viewer')` |
| `src/hooks/usePanelWorkspaceStyles.ts` | Delete (replaced) |
| `src/lib/ws/workspace-handlers.ts` | Add `resetSharedStyles()` on workspace switch |

**Total:** 1 new file (~80 lines), ~8 files edited, 1 file deleted.

---

## 7. Verification

1. **Build succeeds** with no `@views` alias.
2. **Open open-robin workspace.** Chat/thread chrome renders correctly (loaded at runtime from `ai/views/settings/styles/views.css`, not bundled).
3. **Open code-viewer.** File explorer layout still works (per-view `layout.css` loads).
4. **Open wiki/issues/agents.** Shared styles apply. No per-view layout yet (no-ops silently).
5. **Switch to karens-lab.** Shared styles reload (or gracefully degrade if the CSS files don't exist there yet).
6. **DevTools → Elements → `<head>`.** Style tags: `ws-shared-styles-themes`, `ws-shared-styles-components`, `ws-shared-styles-views`, `ws-view-layout-code-viewer`.
