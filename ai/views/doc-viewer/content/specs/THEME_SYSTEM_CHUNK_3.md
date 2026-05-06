# Chunk 3: Override system (per-view CSS + layout)

**From:** THEME_SYSTEM_REFACTOR_SPEC.md §5.3  
**Goal:** Enable per-view theme overrides and layout settings, and add a watcher hook so hand-editing `themes.json` triggers CSS regeneration.  
**Depends on:** Chunk 1 (color-math.js exists). Does NOT depend on Chunk 2 — this chunk adds new serving behavior, not CSS generation logic.  
**Parallel with:** Chunk 2 (server CSS segmentation) — no file overlap.

---

## Context

Currently:
- `themes.css` lives at `ai/views/settings/themes.css` and is global
- `themes.json` lives at `ai/views/settings/themes.json`
- The client loads CSS via WebSocket `file_content_request` for `settings/themes.css`
- Some views already have `layout.json` (e.g., `file-viewer/settings/layout.json`) but there is no unified serving mechanism

We want:
- Power users can drop `ai/views/<view>/settings/themes.css` to override tokens for that view only
- Each view can have `ai/views/<view>/settings/layout.json` for view-specific layout state
- Editing `themes.json` by hand triggers automatic CSS regeneration via the file watcher
- A single API endpoint returns global CSS + per-view CSS + layout for a given view

---

## Files to create

### `open-robin-server/lib/theme/layout-service.js`

**Job:** Read/write per-view layout JSON.

```js
const path = require('path');
const fs = require('fs').promises;

function layoutPath(projectRoot, viewName) {
  return path.join(projectRoot, 'ai', 'views', viewName, 'settings', 'layout.json');
}

async function getLayout(projectRoot, viewName) {
  const file = layoutPath(projectRoot, viewName);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function setLayout(projectRoot, viewName, layout) {
  const file = layoutPath(projectRoot, viewName);
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(layout, null, 2));
  return layout;
}

module.exports = { getLayout, setLayout };
```

**Target:** Under 50 lines.

---

## Files to modify

### `open-robin-server/server.js` — Add REST endpoint

The server already has Express routes (see `app.get('/api/harnesses', ...)`). Add a new route near the other `/api/*` routes:

```js
const layoutService = require('./lib/theme/layout-service');
const themesService = require('./lib/theme/themes-service');

app.get('/api/view-config', async (req, res) => {
  try {
    const projectRoot = getProjectRoot(); // use existing project root getter
    const viewName = req.query.panel;
    if (!viewName) {
      return res.status(400).json({ error: 'Missing panel query param' });
    }

    // Global CSS
    let globalCss = '';
    try {
      const globalCssPath = path.join(projectRoot, 'ai', 'views', 'settings', 'themes.css');
      globalCss = await fs.promises.readFile(globalCssPath, 'utf8');
    } catch {
      globalCss = '';
    }

    // Per-view CSS (optional)
    let viewCss = '';
    try {
      const viewCssPath = path.join(projectRoot, 'ai', 'views', viewName, 'settings', 'themes.css');
      viewCss = await fs.promises.readFile(viewCssPath, 'utf8');
    } catch {
      viewCss = '';
    }

    // Layout
    const layout = await layoutService.getLayout(projectRoot, viewName);

    res.json({ globalCss, viewCss, layout });
  } catch (err) {
    console.error('[ViewConfig] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
```

**Notes:**
- `getProjectRoot()` is already available in `server.js` scope (see existing usage).
- Use `fs.promises.readFile` with try/catch so missing files return empty strings instead of crashing.
- Place the route BEFORE the catch-all `app.get(/.*/, ...)` route at the end of `server.js`.

---

### Client — Load per-view CSS and layout

The client currently loads CSS via WebSocket `file_content_request`. For the new system, on view initialization, the client should:

1. **Fetch view config** from the new REST endpoint:
   ```ts
   const res = await fetch(`/api/view-config?panel=${viewName}`);
   const { globalCss, viewCss, layout } = await res.json();
   ```

2. **Inject global CSS** into a `<style id="global-theme">` element (or refresh the existing `<link>`). If using inline `<style>`, create it if it doesn't exist:
   ```ts
   let globalStyle = document.getElementById('global-theme') as HTMLStyleElement;
   if (!globalStyle) {
     globalStyle = document.createElement('style');
     globalStyle.id = 'global-theme';
     document.head.appendChild(globalStyle);
   }
   globalStyle.textContent = globalCss;
   ```

3. **Inject per-view CSS** into a `<style id="view-theme-${viewName}">` element:
   ```ts
   if (viewCss) {
     let viewStyle = document.getElementById(`view-theme-${viewName}`) as HTMLStyleElement;
     if (!viewStyle) {
       viewStyle = document.createElement('style');
       viewStyle.id = `view-theme-${viewName}`;
       document.head.appendChild(viewStyle);
     }
     viewStyle.textContent = viewCss;
   }
   ```

4. **Apply layout** to the view's state store or context.

**Where to add this in the client:**

Find where views are initialized. The client sends `set_panel` via WebSocket when switching views. Look for the panel/view initialization code — likely in a workspace or view controller. The exact file depends on the client's architecture. Common candidates:
- `src/lib/ws/workspace-handlers.ts`
- `src/hooks/useSharedWorkspaceStyles.ts`
- `src/components/App.tsx`

Add the fetch there when a panel becomes active. If the client already fetches `settings/themes.css` via WS, replace or supplement that path with the REST endpoint.

---

### Server — Watcher hook for manual themes.json edits

The server already has a file watcher watching `<projectRoot>`. When `themes.json` is modified directly (e.g., by a user editing it in their editor), the watcher should trigger CSS regeneration.

**Approach:** Add a programmatic watcher filter in `lib/startup.js` after the watcher is created:

```js
// In startup.js, after projectWatcher = createWatcher(projectRoot):
projectWatcher.addFilter({
  name: 'theme-json-regenerator',
  match: ['ai/views/settings/themes.json'],
  events: ['modify', 'rename'],
  action: async (vars) => {
    // Ignore temp files
    if (vars.basename.startsWith('themes.json.tmp')) return;
    if (!vars.filePath.endsWith('themes.json')) return;

    const root = getProjectRoot();
    if (!root) return;

    try {
      const themes = await themesService.list(root);
      const active = themes.find(t => t.active);
      if (active) {
        await themesService.generateCss(root, active.id);
        console.log('[Watcher] Regenerated themes.css after themes.json change');
      }
    } catch (err) {
      console.warn('[Watcher] themes.json regeneration failed:', err.message);
    }
  },
});
```

**Alternative:** If the watcher filter system doesn't support async actions directly, add the hook inside the existing watcher event handling or create a small `.js` filter module in `lib/watcher/filters/`.

**Key behavior:**
- Only trigger on the final `themes.json` file, not on `.tmp.*` files
- Regenerate `themes.css` from the active theme
- Log success/failure
- Do NOT broadcast `theme:state` to clients (the user edited the file directly; let them refresh)

---

## What NOT to touch

- Do NOT modify `color-math.js`, `live-preview.ts`, or `ThemePicker.tsx` (owned by Chunks 1 and 4).
- Do NOT modify `renderSlugToCss` or create segment modules (that's Chunk 2).
- Do NOT delete `lib/robin/theme-css.js` or remove Robin handlers (that's Chunk 5).
- Do NOT change the format of `themes.json`.

---

## Acceptance criteria

- [ ] `layout-service.js` exists, is under 50 lines, pure file I/O
- [ ] `GET /api/view-config?panel=wiki-viewer` returns `{ globalCss, viewCss, layout }`
  - `globalCss` contains the contents of `ai/views/settings/themes.css`
  - `viewCss` contains the contents of `ai/views/wiki-viewer/settings/themes.css` (if file exists) or `""`
  - `layout` contains the parsed JSON of `ai/views/wiki-viewer/settings/layout.json` (or `{}`)
- [ ] Creating `ai/views/wiki-viewer/settings/themes.css` with `:root { --text-primary: red; }` makes the wiki view's text red
  - Verify by loading the wiki view and checking computed styles
- [ ] Creating `ai/views/file-viewer/settings/layout.json` with `{ sidebarOpen: false }` is returned by the API
- [ ] Editing `ai/views/settings/themes.json` by hand triggers `themes.css` regeneration within 1 second
  - Verify: change a luminance value in themes.json, check that themes.css updates
- [ ] The generator does NOT touch per-view CSS files
- [ ] Server starts without errors

---

## Verification steps

**Test the API:**
```bash
curl "http://localhost:3001/api/view-config?panel=wiki-viewer"
```

**Test per-view override:**
```bash
mkdir -p ai/views/wiki-viewer/settings
echo ':root { --text-primary: red; }' > ai/views/wiki-viewer/settings/themes.css
curl "http://localhost:3001/api/view-config?panel=wiki-viewer"
```

**Test layout:**
```bash
mkdir -p ai/views/file-viewer/settings
echo '{ "chatWidth": 400 }' > ai/views/file-viewer/settings/layout.json
curl "http://localhost:3001/api/view-config?panel=file-viewer"
```

**Test watcher hook:**
```bash
# Edit themes.json by hand (e.g., change luminance of active theme)
vim ai/views/settings/themes.json
# Within 1 second, themes.css should update (check mtime)
stat ai/views/settings/themes.css
```

---

## Report format

```markdown
# Chunk 3 Report

## Files changed
- created: open-robin-server/lib/theme/layout-service.js (X lines)
- modified: open-robin-server/server.js (+X, -X)
- modified: open-robin-server/lib/startup.js (+X, -X)
- modified: <client view init file> (+X, -X)

## Acceptance criteria
- [x] criterion — how verified
- [ ] criterion — why blocked

## Gotchas / deviations
- Anything unexpected

## API sample output
Paste a sample response from `/api/view-config?panel=wiki-viewer`
```
