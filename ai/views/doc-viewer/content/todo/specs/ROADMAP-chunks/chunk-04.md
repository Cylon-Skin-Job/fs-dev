# Chunk 4: Redirect Theme Service to `ai/settings/`

**Goal:** Make the server read/write themes to `ai/settings/` instead of `ai/views/settings/`.

**Prerequisites:** Chunk 3 complete (client loads global CSS from `ai/settings/`).

**Files to change:**

## 4a. `open-robin-server/lib/theme/themes-service.js`

**Current code:**
```js
function themesPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'views', 'settings', 'themes.json');
}
function cssPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'views', 'settings', 'themes.css');
}
```

**Change to:**
```js
function themesPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'settings', 'themes.json');
}
function cssPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'settings', 'themes.css');
}
```

## 4b. `open-robin-server/lib/startup.js`

Look for the theme regeneration code (around line 116). It likely calls `themesService.generateCss(projectRoot, activeId)`. Since `themes-service.js` was updated, no code change is needed here, BUT verify the startup code does not hardcode a path.

If you find a hardcoded path like:
```js
const cssPath = path.join(projectRoot, 'ai', 'views', 'settings', 'themes.css');
```
Change it to:
```js
const cssPath = path.join(projectRoot, 'ai', 'settings', 'themes.css');
```

## 4c. `open-robin-server/lib/watcher/filters/theme-json-regenerator.js`

Look for the theme regeneration code. It likely calls `themesService.generateCss(projectRoot, activeId)`. Since `themes-service.js` was updated, no code change is needed here. BUT verify it does not hardcode a path.

## 4d. `open-robin-server/server.js`

Look for the global CSS injection code (around lines 188-202):

**Current:**
```js
let globalCss = '';
try {
  const globalCssPath = path.join(projectRoot, 'ai', 'views', 'settings', 'themes.css');
  globalCss = await fsPromises.readFile(globalCssPath, 'utf8');
} catch { globalCss = ''; }
```

**Change to:**
```js
let globalCss = '';
try {
  const globalCssPath = path.join(projectRoot, 'ai', 'settings', 'themes.css');
  globalCss = await fsPromises.readFile(globalCssPath, 'utf8');
} catch { globalCss = ''; }
```

**Smoke test:**
1. Restart the server
2. Change a slider in the ThemePicker (e.g., Background Contrast)
3. Verify `ai/settings/themes.css` is updated (check file modification time: `ls -l ai/settings/themes.css`)
4. Verify `ai/views/settings/themes.css` is NOT updated (its timestamp should be from before the slider change)
5. Refresh the page in the browser — verify the new theme colors render

**Risk:** Medium. If the path is wrong, theme changes don't persist.

**Next chunk:** Chunk 5 — Update client path references.
