# Chunk 3: Update `useSharedWorkspaceStyles` to Load from `ai/settings/`

**Goal:** Redirect global CSS loading from `ai/views/settings/` to `ai/settings/`.

**Prerequisites:** Chunk 2 complete (client has `fetchSettingsFile`).

**File to change:** `open-robin-client/src/hooks/useSharedWorkspaceStyles.ts`

**Changes:**

1. **Update imports** to include the new function and constants:

   Current imports:
   ```ts
   import {
     fetchPanelWorkspaceFile,
     fetchViewsRootFile,
     VIEWS_SETTINGS_STYLES_COMPONENTS,
     VIEWS_SETTINGS_STYLES_THEMES,
     VIEWS_SETTINGS_STYLES_VIEWS,
   } from '../lib/panels';
   ```

   New imports:
   ```ts
   import {
     fetchPanelWorkspaceFile,
     fetchViewsRootFile,
     fetchSettingsFile,
     VIEWS_SETTINGS_STYLES_COMPONENTS,
     VIEWS_SETTINGS_STYLES_THEMES,
     VIEWS_SETTINGS_STYLES_VIEWS,
     SETTINGS_STYLES_THEMES,
     SETTINGS_STYLES_COMPONENTS,
     SETTINGS_STYLES_VIEWS,
     SETTINGS_STYLES_TINTS,
     SETTINGS_STYLES_VARIABLES,
   } from '../lib/panels';
   ```

2. **Update `SHARED_LAYERS`:**

   Current:
   ```ts
   const SHARED_LAYERS: { id: string; path: string }[] = [
     { id: 'themes',     path: VIEWS_SETTINGS_STYLES_THEMES },
     { id: 'components', path: VIEWS_SETTINGS_STYLES_COMPONENTS },
     { id: 'views',      path: VIEWS_SETTINGS_STYLES_VIEWS },
   ];
   ```

   New:
   ```ts
   const SHARED_LAYERS: { id: string; path: string; fetcher: 'settings' | 'views' }[] = [
     { id: 'themes',     path: SETTINGS_STYLES_THEMES,     fetcher: 'settings' },
     { id: 'components', path: SETTINGS_STYLES_COMPONENTS, fetcher: 'settings' },
     { id: 'views',      path: SETTINGS_STYLES_VIEWS,      fetcher: 'settings' },
     { id: 'tints',      path: SETTINGS_STYLES_TINTS,      fetcher: 'settings' },
     { id: 'variables',  path: SETTINGS_STYLES_VARIABLES,  fetcher: 'settings' },
   ];
   ```

3. **Update `fetchAndInject`:**

   Current:
   ```ts
   function fetchAndInject(ws: WebSocket, generation: number): void {
     Promise.all(SHARED_LAYERS.map((layer) => fetchViewsRootFile(ws, layer.path)))
       .then((contents) => {
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
   ```

   New:
   ```ts
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
   ```

4. **Update `reloadThemesLayer`** (if it exists in the file):

   Find the function `reloadThemesLayer` and update it to use `fetchSettingsFile`:
   ```ts
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
   ```

**Smoke test:**
1. Build the client: `cd open-robin-client && npm run build`
2. Restart the server
3. Open the app in a browser
4. Verify global CSS still loads:
   - Colors render correctly (chat chrome, sidebar, panels)
   - Check DevTools Elements tab — verify 5 `<style>` tags exist with ids:
     - `ws-shared-styles-themes`
     - `ws-shared-styles-components`
     - `ws-shared-styles-views`
     - `ws-shared-styles-tints`
     - `ws-shared-styles-variables`
   - Check DevTools Network tab — verify no 404 errors for `__settings__` fetches

**Risk:** Medium. Changes the CSS loading path. If broken, the app renders unstyled.

**Next chunk:** Chunk 4 — Redirect theme service to `ai/settings/`.
