# Chunk 1: Add `__settings__` Pseudo-Panel to Server

**Goal:** Teach the server to resolve a new `__settings__` pseudo-panel to `ai/<machine>/System/styles/`.

**Prerequisites:** Chunk 0 complete (`ai/<machine>/System/styles/` exists with files).

**Context:** The client loads global CSS via `fetchPanelFile(ws, '__panels__', 'styles/themes.css')` which resolves to `ai/<machine>/System/styles/themes.css`. We need a new resolution path for `ai/<machine>/System/styles/`. The simplest way: add a `__settings__` pseudo-panel that resolves to `ai/<machine>/System/styles/`.

**File to change:** `open-robin-server/server.js`

**Current code (lines 271-291, `resolveProjectRootForPanel` function):**
```js
function resolveProjectRootForPanel(ws, panel) {
  const projectRoot = getProjectRoot(ws);
  if (!projectRoot) return null;

  // __panels__ pseudo-panel: resolves to ai/<machine>/Views/ (for client discovery)
  if (panel === '__panels__') {
    const viewsRoot = views.getViewsRoot(projectRoot);
    if (fs.existsSync(viewsRoot)) return viewsRoot;
    return null;
  }

  const index = panelIndex.get(panel);
  if (index?.projectRoot) return index.projectRoot;

  // Fallback: raw ai/<machine>/Views/{id}/ folder (for views not yet in the system)
  const fallback = path.join(views.getViewsRoot(projectRoot), panel);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}
```

**Change:** Add this block **immediately after** the `__panels__` block and **before** `const index = ...`:

```js
  // __settings__ pseudo-panel: resolves to ai/<machine>/System/styles/ (for global theme/settings)
  if (panel === '__settings__') {
    const settingsRoot = path.join(projectRoot, 'ai', 'settings');
    if (fs.existsSync(settingsRoot)) return settingsRoot;
    return null;
  }
```

**Resulting code should look like:**
```js
function resolveProjectRootForPanel(ws, panel) {
  const projectRoot = getProjectRoot(ws);
  if (!projectRoot) return null;

  // __panels__ pseudo-panel: resolves to ai/<machine>/Views/ (for client discovery)
  if (panel === '__panels__') {
    const viewsRoot = views.getViewsRoot(projectRoot);
    if (fs.existsSync(viewsRoot)) return viewsRoot;
    return null;
  }

  // __settings__ pseudo-panel: resolves to ai/<machine>/System/styles/ (for global theme/settings)
  if (panel === '__settings__') {
    const settingsRoot = path.join(projectRoot, 'ai', 'settings');
    if (fs.existsSync(settingsRoot)) return settingsRoot;
    return null;
  }

  const index = panelIndex.get(panel);
  if (index?.projectRoot) return index.projectRoot;

  // Fallback: raw ai/<machine>/Views/{id}/ folder (for views not yet in the system)
  const fallback = path.join(views.getViewsRoot(projectRoot), panel);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}
```

**Smoke test:**
1. Restart the server
2. Verify it starts without error (no crash on boot)
3. (Optional) Add temporary debug logging to confirm `__settings__` resolves:
   ```js
   console.log('[Debug] __settings__ resolves to:', path.join(projectRoot, 'ai', 'settings'));
   ```

**Risk:** Low. Additive change, no existing code path affected.

**Next chunk:** Chunk 2 — Add `fetchSettingsFile` to client.
