/**
 * @module useSharedWorkspaceStyles
 * @role Load workspace shared CSS (themes + components + views) and optional
 *       per-view layout CSS from ai/views over WebSocket.
 *
 * - useSharedWorkspaceStyles(): loads themes + components + views globally
 *   (unscoped, since chat chrome applies app-wide). Call once from App.
 * - useViewLayoutStyles(panelId): loads optional ai/views/{panelId}/settings/layout.css
 *   + optional ai/views/{panelId}/settings/themes.css (per-view theme override)
 *   scoped to [data-panel="{panelId}"]. Silently no-ops on ENOENT/timeout.
 * - resetSharedStyles(): clears the shared-load guard + style tags so the next
 *   render reloads from a newly-switched workspace.
 */

import { useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import {
  fetchPanelWorkspaceFile,
  fetchViewsRootFile,
  fetchSettingsFile,
  SETTINGS_STYLES_THEMES,
  SETTINGS_STYLES_COMPONENTS,
  SETTINGS_STYLES_VIEWS,
  SETTINGS_STYLES_FILE_VIEWER,
  SETTINGS_STYLES_DOC_VIEWER,
  SETTINGS_STYLES_TINTS,
  SETTINGS_STYLES_VARIABLES,
} from '../lib/panels';
import { scopePanelCss } from '../lib/scopePanelCss';

const SHARED_STYLE_PREFIX = 'ws-shared-styles-';

export function injectWorkspaceStyles(styles: Record<string, string>): void {
  const files = [
    'variables.css',
    'themes.css',
    'components.css',
    'views.css',
    'file-viewer.css',
    'doc-viewer.css',
    'tints.css',
  ];
  for (const file of files) {
    const css = styles[file]?.trim();
    const layerId = file.replace('.css', '');
    const styleId = `${SHARED_STYLE_PREFIX}${layerId}`;
    document.getElementById(styleId)?.remove();
    if (!css) continue;
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = css;
    document.head.appendChild(el);
  }
}
const VIEW_LAYOUT_STYLE_PREFIX = 'ws-view-layout-';

const SHARED_LAYERS: { id: string; path: string; fetcher: 'settings' | 'views' }[] = [
  // Load fallback defaults FIRST so theme + tint layers override them
  { id: 'variables',   path: SETTINGS_STYLES_VARIABLES,   fetcher: 'settings' },
  { id: 'themes',      path: SETTINGS_STYLES_THEMES,      fetcher: 'settings' },
  { id: 'components',  path: SETTINGS_STYLES_COMPONENTS,  fetcher: 'settings' },
  { id: 'views',       path: SETTINGS_STYLES_VIEWS,       fetcher: 'settings' },
  // Per-view chrome layers — global selectors keyed to a single view's classes.
  // Live in ai/settings/ so colors stay out of per-view layout.css files.
  { id: 'file-viewer', path: SETTINGS_STYLES_FILE_VIEWER, fetcher: 'settings' },
  { id: 'doc-viewer',  path: SETTINGS_STYLES_DOC_VIEWER,  fetcher: 'settings' },
  { id: 'tints',       path: SETTINGS_STYLES_TINTS,       fetcher: 'settings' },
];

// Guard against repeat loads from multiple consumers on the same WS connection.
// Bumped on workspace switch so the hook refetches even when the WS ref is stable.
let loadGeneration = 0;

function fetchAndInject(ws: WebSocket, generation: number): void {
  Promise.all(
    SHARED_LAYERS.map((layer) => {
      if (layer.fetcher === 'settings') {
        return fetchSettingsFile(ws, layer.path);
      }
      return fetchViewsRootFile(ws, layer.path);
    })
  )
    .then((contents) => {
      // Abort if a newer reload has started (e.g. another workspace switch)
      if (generation !== loadGeneration) return;
      SHARED_LAYERS.forEach((layer, i) => {
        const css = contents[i]?.trim();
        const styleId = `${SHARED_STYLE_PREFIX}${layer.id}`;
        document.getElementById(styleId)?.remove();
        if (!css) return;
        const el = document.createElement('style');
        el.id = styleId;
        el.textContent = css;
        document.head.appendChild(el);
      });
    })
    .catch((err) => {
      console.error('[SharedStyles] Failed to load workspace styles:', err);
    });
}

export function useSharedWorkspaceStyles() {
  const ws = usePanelStore((s) => s.ws);
  const generation = usePanelStore((s) => s.sharedStylesGeneration);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    loadGeneration += 1;
    fetchAndInject(ws, loadGeneration);
  }, [ws, generation]);
}

export function useViewLayoutStyles(panelId: string) {
  const ws = usePanelStore((s) => s.ws);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    let cancelled = false;
    const layoutStyleId = `${VIEW_LAYOUT_STYLE_PREFIX}${panelId}`;
    const themeStyleId = `${VIEW_LAYOUT_STYLE_PREFIX}${panelId}-theme`;

    // settings/layout.css — structural per-view chrome, scoped.
    fetchPanelWorkspaceFile(ws, panelId, 'settings/layout.css')
      .then((css) => {
        if (cancelled) return;
        const trimmed = css?.trim();
        if (!trimmed) return;
        document.getElementById(layoutStyleId)?.remove();
        const el = document.createElement('style');
        el.id = layoutStyleId;
        el.textContent = scopePanelCss(css, panelId);
        document.head.appendChild(el);
      })
      .catch(() => {
        /* ENOENT / timeout — no layout.css for this view, that's fine */
      });

    // settings/themes.css — optional per-view theme override. Same filename
    // as the workspace theme file; scoped to [data-panel="<id>"] so the
    // workspace cascade remains the default and only this view sees it.
    fetchPanelWorkspaceFile(ws, panelId, 'settings/themes.css')
      .then((css) => {
        if (cancelled) return;
        const trimmed = css?.trim();
        if (!trimmed) return;
        document.getElementById(themeStyleId)?.remove();
        const el = document.createElement('style');
        el.id = themeStyleId;
        el.textContent = scopePanelCss(css, panelId);
        document.head.appendChild(el);
      })
      .catch(() => {
        /* ENOENT — no per-view theme override, that's the common case */
      });

    // --- /api/view-config for per-view theme CSS + layout ---
    fetch(`/api/view-config?panel=${panelId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(({ viewCss, layout }) => {
        if (cancelled) return;

        // Inject per-view theme CSS from REST endpoint (supersedes WS fetch above if present)
        if (viewCss) {
          document.getElementById(themeStyleId)?.remove();
          const el = document.createElement('style');
          el.id = themeStyleId;
          el.textContent = scopePanelCss(viewCss, panelId);
          document.head.appendChild(el);
        }

        // Apply layout to store if non-empty
        if (layout && Object.keys(layout).length > 0) {
          const store = usePanelStore.getState();
          const current = store.viewStates[panelId];
          store.setViewState(panelId, { ...current, ...layout });
        }
      })
      .catch((err) => {
        console.warn(`[ViewLayoutStyles] /api/view-config failed for ${panelId}:`, err.message);
      });

    return () => {
      cancelled = true;
      document.getElementById(layoutStyleId)?.remove();
      document.getElementById(themeStyleId)?.remove();
    };
  }, [panelId, ws]);
}

export function resetSharedStyles() {
  // Don't pre-remove the existing <style> tags — leave them in place so the
  // page stays styled while fetchAndInject does its WS roundtrip. Once the
  // new content arrives, fetchAndInject swaps each tag atomically (remove old
  // + append new in the same synchronous block). This eliminates the flash
  // of unstyled chat/threads that lasted the duration of the WS fetch.
  const store = usePanelStore.getState();
  store.bumpSharedStylesGeneration();
}

// Reload only the themes layer (called when theme:state arrives). Components
// and views CSS don't change with theme switches, so refetching them is wasted
// work and prolongs the swap window.
export function reloadThemesLayer(ws: WebSocket) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const themeLayer = SHARED_LAYERS.find(l => l.id === 'themes');
  if (!themeLayer) return;
  fetchSettingsFile(ws, themeLayer.path)
    .then((css) => {
      if (!css) {
        document.getElementById(`${SHARED_STYLE_PREFIX}themes`)?.remove();
        return;
      }
      const styleId = `${SHARED_STYLE_PREFIX}themes`;
      document.getElementById(styleId)?.remove();
      const el = document.createElement('style');
      el.id = styleId;
      el.textContent = css;
      document.head.appendChild(el);
    })
    .catch((err) => console.error('[SharedStyles] themes reload failed:', err));
}
