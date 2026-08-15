# ROADMAP: Theme + State Refactor

**Purpose:** Move global settings from `ai/<machine>/System/styles/` to `ai/<machine>/System/styles/`. Extract tint rules from scattered per-view CSS into a single global `tints.css`. Move per-view layout CSS from `open-robin-client/src/components/**/` to `ai/<machine>/Views/{view-folder}/styles/layout.css`.

**Philosophy:** The user controls styling through a simple GUI (sliders + toggles) that works for 95% of cases. Global CSS lives in `ai/<machine>/System/styles/`. Per-view CSS lives in `ai/<machine>/Views/{view-folder}/styles/` and handles layout only. The server does not contain CSS — it reads files from disk and serves them as text. If a user wants to hand-edit CSS, they drop a file in the appropriate folder.

**Do not modify server logic to generate CSS.** The server's only job is: read file → send text. CSS generation happens via `theme-css-generator.js` (Node module, not server logic) and static files.

---

## Current Architecture (Before Refactor)

### How CSS flows from disk to browser

```
Disk                          Server (reads, does not transform)        Client (injects)
----                          ----------------------------------        ----------------
ai/<machine>/System/styles/themes.css  →  server.js reads via fs.readFile  →  fetchViewsRootFile(ws, 'styles/themes.css')
ai/<machine>/System/styles/views.css   →  server.js reads via fs.readFile  →  fetchViewsRootFile(ws, 'settings/views.css')
ai/<machine>/System/styles/components.css → server.js reads via fs.readFile → fetchViewsRootFile(ws, 'settings/components.css')

ai/<machine>/Views/{view-folder}/styles/layout.css  → server.js reads via fs.readFile  → fetchPanelWorkspaceFile(ws, viewer, 'styles/layout.css')
ai/<machine>/Views/{view-folder}/styles/themes.css  → server.js reads via fs.readFile  → fetchPanelWorkspaceFile(ws, viewer, 'styles/themes.css')
```

**Server code that reads CSS files (server.js lines 188-202):**
```js
let globalCss = '';
try {
  const globalCssPath = path.join(projectRoot, 'ai', 'views', 'settings', 'themes.css');
  globalCss = await fsPromises.readFile(globalCssPath, 'utf8');
} catch { globalCss = ''; }

let viewCss = '';
try {
  const viewCssPath = path.join(projectRoot, 'ai', 'views', viewName, 'settings', 'themes.css');
  viewCss = await fsPromises.readFile(viewCssPath, 'utf8');
} catch { viewCss = ''; }
```

**Theme generation (themes-service.js):**
```js
function cssPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'views', 'settings', 'themes.css');
}
function themesPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'views', 'settings', 'themes.json');
}
```

**Client code that loads CSS (useSharedWorkspaceStyles.ts):**
```ts
const SHARED_LAYERS: { id: string; path: string }[] = [
  { id: 'themes',     path: VIEWS_SETTINGS_STYLES_THEMES },     // 'styles/themes.css'
  { id: 'components', path: VIEWS_SETTINGS_STYLES_COMPONENTS }, // 'settings/components.css'
  { id: 'views',      path: VIEWS_SETTINGS_STYLES_VIEWS },      // 'settings/views.css'
];

function fetchViewsRootFile(ws: WebSocket, pathUnderViews: string): Promise<string> {
  return fetchPanelFile(ws, '__panels__', pathUnderViews); // resolves to ai/<machine>/Views/{pathUnderViews}
}

function fetchPanelWorkspaceFile(ws: WebSocket, panelId: string, pathUnderView: string): Promise<string> {
  return fetchPanelFile(ws, '__panels__', `${panelId}/${pathUnderView}`); // resolves to ai/<machine>/Views/{panelId}/{pathUnderView}
}
```

**Server resolution of `__panels__` (server.js lines 274-278):**
```js
if (panel === '__panels__') {
  const viewsRoot = views.getViewsRoot(projectRoot); // returns path.join(projectRoot, 'ai', 'views')
  if (fs.existsSync(viewsRoot)) return viewsRoot;
  return null;
}
```

So `fetchViewsRootFile(ws, 'styles/themes.css')` resolves to `{projectRoot}/ai/<machine>/System/styles/themes.css`.
And `fetchPanelWorkspaceFile(ws, 'wiki-viewer', 'styles/layout.css')` resolves to `{projectRoot}/ai/<machine>/Views/<wiki-view-folder>/styles/layout.css`.

**Theme watcher (lib/watcher/filters/theme-json-regenerator.js):**
Watches `ai/<machine>/System/styles/themes.json` and regenerates `ai/<machine>/System/styles/themes.css`.

**Startup regeneration (lib/startup.js lines 116-118):**
On every boot, regenerates `ai/<machine>/System/styles/themes.css` from the active theme.

### Current file locations

**Global settings (currently at `ai/<machine>/System/styles/`):**
- `ai/<machine>/System/styles/themes.json` — themes
- `ai/<machine>/System/styles/themes.css` — generated
- `ai/<machine>/System/styles/views.css` — global view chrome
- `ai/<machine>/System/styles/components.css` — global components
- `ai/<machine>/System/styles/state.json` — workspace state default
- `ai/<machine>/System/styles/cli.json` — CLI config
- `ai/<machine>/System/styles/THEME_SYSTEM_AUDIT.md` — docs

**Per-view CSS in client source (wrong location, mixes layout + colors):**
- `open-robin-client/src/components/wiki/wiki.css`
- `open-robin-client/src/components/tickets/tickets.css`
- `open-robin-client/src/components/agents/agents.css`
- `open-robin-client/src/components/tile-row/tile-row.css`
- `open-robin-client/src/components/capture/capture.css`

**Per-view CSS already in correct location (layout only):**
- `ai/<machine>/Data/File-Viewer/styles/layout.css` ✅

**Per-view state (correct location):**
- `ai/<machine>/Views/<wiki-view-folder>/styles/state.json`
- `ai/<machine>/Agents/state/state.json`
- `ai/<machine>/Data/File-Viewer/state/state.json`

**Missing per-view settings folders:**
- `ai/<machine>/Views/tickets-viewer/settings/` — does not exist
- `ai/<machine>/Views/*-doc-viewer/settings/` — exists but has no `layout.css`

---

## Target Architecture (After Refactor)

### New folder structure

```
ai/
├── settings/                          ← NEW: global settings folder
│   ├── themes.json                    ← moved from ai/<machine>/System/styles/
│   ├── themes.css                     ← moved from ai/<machine>/System/styles/
│   ├── tints.css                      ← NEW: global tint selector catalog
│   ├── views.css                      ← moved from ai/<machine>/System/styles/
│   ├── components.css                 ← moved from ai/<machine>/System/styles/
│   ├── variables.css                  ← NEW: variable defaults (moved from client)
│   └── state.json                     ← workspace state default (moved from ai/<machine>/System/styles/)
│
└── views/
    ├── settings/                      ← KEEP: cli.json, THEME_SYSTEM_AUDIT.md only
    │
    ├── wiki-viewer/
    │   ├── settings/
    │   │   ├── state.json             ← per-view state override (already exists)
    │   │   ├── layout.css             ← NEW: layout-only CSS (moved from wiki.css)
    │   │   └── layout.json            ← already exists
    │   └── ...
    │
    ├── tickets-viewer/
    │   ├── settings/
    │   │   ├── state.json             ← NEW: per-view state (was workspace default)
    │   │   └── layout.css             ← NEW: layout-only CSS (moved from tickets.css)
    │   └── ...
    │
    ├── agents-viewer/
    │   ├── settings/
    │   │   ├── state.json             ← already exists
    │   │   ├── layout.css             ← NEW: layout-only CSS (moved from agents.css)
    │   │   └── layout.json            ← already exists
    │   └── ...
    │
    ├── doc-viewer/
    │   ├── settings/
    │   │   ├── layout.css             ← NEW: layout-only CSS (moved from tile-row.css + capture.css)
    │   │   └── layout.json            ← already exists
    │   └── ...
    │
    └── file-viewer/
        ├── settings/
        │   ├── state.json             ← already exists
        │   ├── layout.css             ← already exists ✅
        │   └── layout.json            ← already exists
        └── ...
```

### New CSS flow

```
Global CSS:
  ai/<machine>/System/styles/themes.css      → fetchViewsRootFile(ws, 'styles/themes.css')
  ai/<machine>/System/styles/views.css       → fetchViewsRootFile(ws, 'settings/views.css')
  ai/<machine>/System/styles/components.css  → fetchViewsRootFile(ws, 'settings/components.css')
  ai/<machine>/System/styles/tints.css       → fetchViewsRootFile(ws, 'settings/tints.css')
  ai/<machine>/System/styles/variables.css   → fetchViewsRootFile(ws, 'settings/variables.css')

Per-View CSS:
  ai/<machine>/Views/{view-folder}/styles/layout.css  → fetchPanelWorkspaceFile(ws, viewer, 'styles/layout.css')
```

**Key change:** The server path resolution for `__panels__` stays the same (resolves to `ai/<machine>/Views/`), but global CSS moves to a new fetch mechanism that resolves to `ai/<machine>/System/styles/`.

**Do NOT change `__panels__` resolution.** It correctly resolves to `ai/<machine>/Views/` for per-view discovery. Instead, add a new pseudo-panel `__settings__` that resolves to `ai/<machine>/System/styles/`.

---

## Chunk-by-Chunk Execution Plan

### Chunk 0: Create `ai/<machine>/System/styles/` and Seed It
**Goal:** Create the target folder and populate it with copies of existing global files.

**Files to create:**
```bash
mkdir -p ai/<machine>/System

# Copy (don't move yet) global files
cp ai/<machine>/System/styles/themes.json ai/<machine>/System/styles/themes.json
cp ai/<machine>/System/styles/themes.css ai/<machine>/System/styles/themes.css
cp ai/<machine>/System/styles/views.css ai/<machine>/System/styles/views.css
cp ai/<machine>/System/styles/components.css ai/<machine>/System/styles/components.css
cp ai/<machine>/System/styles/state.json ai/<machine>/System/state/state.json
```

**Files to create new:**
- `ai/<machine>/System/styles/tints.css` — empty file for now
- `ai/<machine>/System/styles/variables.css` — copy from `open-robin-client/src/styles/variables.css`

**Smoke test:** Verify all files exist in both locations.
```bash
ls -la ai/<machine>/System/styles/
ls -la ai/<machine>/System/styles/
```

**Risk:** None. This is purely additive.

---

### Chunk 1: Add `__settings__` Pseudo-Panel to Server
**Goal:** Teach the server to resolve a new `__settings__` pseudo-panel to `ai/<machine>/System/styles/`.

**File:** `open-robin-server/server.js`

**Current code (lines 271-291):**
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

**Add after the `__panels__` block:**
```js
  // __settings__ pseudo-panel: resolves to ai/<machine>/System/styles/ (for global theme/settings)
  if (panel === '__settings__') {
    const settingsRoot = path.join(projectRoot, 'ai', 'settings');
    if (fs.existsSync(settingsRoot)) return settingsRoot;
    return null;
  }
```

**Smoke test:**
1. Restart server
2. Verify server starts without error
3. (Optional) Add a temporary console.log in the resolution to confirm `__settings__` resolves correctly

**Risk:** Low. Additive change, no existing code path affected.

---

### Chunk 2: Add `fetchSettingsFile` to Client
**Goal:** Teach the client to fetch files from `ai/<machine>/System/styles/` via the new `__settings__` pseudo-panel.

**File:** `open-robin-client/src/lib/panels.ts`

**Add after `fetchViewsRootFile`:**
```ts
/** Fetch a file under ai/<machine>/System/styles/ via the __settings__ pseudo-panel. */
export function fetchSettingsFile(ws: WebSocket, pathUnderSettings: string): Promise<string> {
  return fetchPanelFile(ws, '__settings__', pathUnderSettings);
}
```

**Add new constants after existing ones:**
```ts
export const SETTINGS_STYLES_THEMES     = 'themes.css' as const;
export const SETTINGS_STYLES_COMPONENTS = 'components.css' as const;
export const SETTINGS_STYLES_VIEWS      = 'views.css' as const;
export const SETTINGS_STYLES_TINTS      = 'tints.css' as const;
export const SETTINGS_STYLES_VARIABLES  = 'variables.css' as const;
```

**Smoke test:**
1. Build client
2. Verify TypeScript compiles (no errors)
3. No runtime test yet — the hook hasn't been updated to use it

**Risk:** Low. Pure addition, no existing usage changed.

---

### Chunk 3: Update `useSharedWorkspaceStyles` to Load from `ai/<machine>/System/styles/`
**Goal:** Redirect global CSS loading from `ai/<machine>/System/styles/` to `ai/<machine>/System/styles/`.

**File:** `open-robin-client/src/hooks/useSharedWorkspaceStyles.ts`

**Current imports:**
```ts
import {
  fetchPanelWorkspaceFile,
  fetchViewsRootFile,
  VIEWS_SETTINGS_STYLES_COMPONENTS,
  VIEWS_SETTINGS_STYLES_THEMES,
  VIEWS_SETTINGS_STYLES_VIEWS,
} from '../lib/panels';
```

**New imports:**
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

**Current `SHARED_LAYERS`:**
```ts
const SHARED_LAYERS: { id: string; path: string }[] = [
  { id: 'themes',     path: VIEWS_SETTINGS_STYLES_THEMES },
  { id: 'components', path: VIEWS_SETTINGS_STYLES_COMPONENTS },
  { id: 'views',      path: VIEWS_SETTINGS_STYLES_VIEWS },
];
```

**New `SHARED_LAYERS`:**
```ts
const SHARED_LAYERS: { id: string; path: string; fetcher: 'settings' | 'views' }[] = [
  { id: 'themes',     path: SETTINGS_STYLES_THEMES,     fetcher: 'settings' },
  { id: 'components', path: SETTINGS_STYLES_COMPONENTS, fetcher: 'settings' },
  { id: 'views',      path: SETTINGS_STYLES_VIEWS,      fetcher: 'settings' },
  { id: 'tints',      path: SETTINGS_STYLES_TINTS,      fetcher: 'settings' },
  { id: 'variables',  path: SETTINGS_STYLES_VARIABLES,  fetcher: 'settings' },
];
```

**Current `fetchAndInject`:**
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

**New `fetchAndInject`:**
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

**Also update `reloadThemesLayer` to use `fetchSettingsFile`:**
```ts
export function reloadThemesLayer(ws: WebSocket) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const themeLayer = SHARED_LAYERS.find(l => l.id === 'themes');
  if (!themeLayer) return;
  fetchSettingsFile(ws, themeLayer.path)
    .then((css) => {
      // ... rest unchanged
    })
    .catch((err) => console.error('[SharedStyles] themes reload failed:', err));
}
```

**Smoke test:**
1. Build client
2. Restart server
3. Open app
4. Verify global CSS still loads (colors, chat chrome, components all render correctly)
5. Check DevTools Network tab — verify no 404s for `__settings__` fetches
6. Check DevTools Elements tab — verify 5 `<style>` tags with ids `ws-shared-styles-themes`, `ws-shared-styles-components`, `ws-shared-styles-views`, `ws-shared-styles-tints`, `ws-shared-styles-variables`

**Risk:** Medium. Changes the CSS loading path. If broken, the app renders unstyled.

---

### Chunk 4: Redirect Theme Service to `ai/<machine>/System/styles/`
**Goal:** Make the server read/write themes to `ai/<machine>/System/styles/` instead of `ai/<machine>/System/styles/`.

**Files to change:**

**4a. `open-robin-server/lib/theme/themes-service.js`**

Current:
```js
function themesPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'views', 'settings', 'themes.json');
}
function cssPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'views', 'settings', 'themes.css');
}
```

New:
```js
function themesPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'settings', 'themes.json');
}
function cssPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'settings', 'themes.css');
}
```

**4b. `open-robin-server/lib/startup.js` (line 116-118)**

Current: no explicit path — calls `themesService.generateCss(projectRoot, id)` which uses `cssPath()` internally.

No change needed IF `themes-service.js` was updated. But verify the startup code regenerates to the new path.

**4c. `open-robin-server/lib/watcher/filters/theme-json-regenerator.js`**

Current: calls `themesService.generateCss(projectRoot, activeId)` which uses `cssPath()` internally.

No change needed IF `themes-service.js` was updated. But verify.

**4d. `open-robin-server/server.js` (lines 188-202)**

Current:
```js
let globalCss = '';
try {
  const globalCssPath = path.join(projectRoot, 'ai', 'views', 'settings', 'themes.css');
  globalCss = await fsPromises.readFile(globalCssPath, 'utf8');
} catch { globalCss = ''; }
```

New:
```js
let globalCss = '';
try {
  const globalCssPath = path.join(projectRoot, 'ai', 'settings', 'themes.css');
  globalCss = await fsPromises.readFile(globalCssPath, 'utf8');
} catch { globalCss = ''; }
```

**Smoke test:**
1. Restart server
2. Change a slider in ThemePicker
3. Verify `ai/<machine>/System/styles/themes.css` is updated (check timestamp)
4. Verify `ai/<machine>/System/styles/themes.css` is NOT updated
5. Refresh page — verify new theme colors render

**Risk:** Medium. If the path is wrong, theme changes don't persist.

---

### Chunk 5: Update Client Path References
**Goal:** Find all client-side hardcoded references to `ai/<machine>/System/styles/` and update them.

**Files to search and update:**

**5a. `open-robin-client/src/components/App.tsx` (line 162)**
Current comment:
```tsx
// ai/<machine>/System/styles/themes.css (workspace) with optional overrides at
// ai/<machine>/Views/<view>/styles/themes.css.
```
New comment:
```tsx
// ai/<machine>/System/styles/themes.css (workspace) with optional overrides at
// ai/<machine>/Views/<view>/styles/themes.css.
```

**5b. `open-robin-client/src/styles/variables.css` (line 90)**
Current comment:
```css
/* Theme tokens live in ai/<machine>/System/styles/themes.css (loaded at runtime by
 * useSharedWorkspaceStyles). That file is the canonical home for every
 * theme-editable CSS custom property. Per-view overrides go in
 * ai/<machine>/Views/<view>/styles/themes.css and win via the cascade. */
```
New comment:
```css
/* Theme tokens live in ai/<machine>/System/styles/themes.css (loaded at runtime by
 * useSharedWorkspaceStyles). That file is the canonical home for every
 * theme-editable CSS custom property. Per-view overrides go in
 * ai/<machine>/Views/<view>/styles/themes.css and win via the cascade. */
```

**5c. `open-robin-client/src/components/Robin/ThemeDetail.tsx` (lines 167, 179)**
Current:
```tsx
<code>ai/<machine>/System/styles/themes.css</code>
<code>ai/<machine>/Views/&#123;viewer-name&#125;/styles/themes.css</code>
```
New:
```tsx
<code>ai/<machine>/System/styles/themes.css</code>
<code>ai/<machine>/Views/&#123;viewer-name&#125;/styles/themes.css</code>
```

**Smoke test:** Build client, verify no TypeScript errors.

**Risk:** Low. Comments and UI text only.

---

### Chunk 6: Delete Old Global Files from `ai/<machine>/System/styles/`
**Goal:** Remove the now-duplicate global files from `ai/<machine>/System/styles/`.

**Files to delete:**
```bash
rm ai/<machine>/System/styles/themes.json
rm ai/<machine>/System/styles/themes.css
rm ai/<machine>/System/styles/views.css
rm ai/<machine>/System/styles/components.css
rm ai/<machine>/System/styles/state.json
```

**Files to KEEP in `ai/<machine>/System/styles/`:**
- `cli.json` — CLI config (not theme-related)
- `THEME_SYSTEM_AUDIT.md` — documentation (move to `ai/<machine>/System/styles/` or keep)

**Smoke test:**
1. Refresh page
2. Verify everything still renders correctly
3. Change a slider — verify theme updates
4. Check server logs — verify no "file not found" errors

**Risk:** Medium. If any code path still references the old location, it breaks.

---

### Chunk 7: Create `ai/<machine>/System/styles/tints.css`
**Goal:** Extract all tint rules from per-view CSS into a single global file.

**Current tint rules scattered across:**
- `open-robin-client/src/components/tickets/tickets.css` — `.rv-panel[data-tint-cards="true"] .rv-ticket-column`, `.rv-panel[data-tint-content-panels="true"] .rv-ticket-column`
- `open-robin-client/src/components/tile-row/tile-row.css` — `.rv-panel[data-tint-content-panels="true"] .rv-tile-grid`
- `ai/<machine>/Data/File-Viewer/styles/layout.css` — `.rv-panel[data-tint-content-panels="true"] .file-explorer-empty`, `.rv-panel[data-tint-content-panels="true"] .file-explorer-main:empty`
- `open-robin-client/src/components/wiki/wiki.css` — `.rv-panel[data-tint-cards="true"] .rv-wiki-topic-item.active`, `.rv-panel[data-tint-navigation="true"] .file-tree-item`
- `open-robin-client/src/components/App.css` — `.rv-panel[data-tint-left="true"]`, `.rv-panel[data-tint-right="true"]`, etc.

**All of these use `.rv-panel[data-tint-*]` which is wrong.** They should use `body[data-tint-*]`.

**New file `ai/<machine>/System/styles/tints.css`:**
```css
/* ═══════════════════════════════════════════════════════════════════════════
   Global Tint Rules
   ═══════════════════════════════════════════════════════════════════════════
   These rules respond to body[data-tint-*] attributes set by the active theme.
   They apply universally across every view. Per-view CSS never defines tint
   responses.
*/

/* ── Content Panels ── */
body[data-tint-content-panels="true"] .rv-ticket-column {
  background: var(--sidebar-surface-bg, #161616);
}

body[data-tint-content-panels="true"] .rv-tile-grid {
  background: var(--sidebar-surface-bg, #161616);
}

body[data-tint-content-panels="true"] .file-explorer-empty,
body[data-tint-content-panels="true"] .file-explorer-main:empty {
  background: var(--sidebar-surface-bg, #161616);
}

/* ── Cards ── */
body[data-tint-cards="true"] .rv-ticket-column {
  background: var(--ws-content-bg, #0d0d0d);
}

body[data-tint-cards="true"] .rv-ticket-column-header {
  border-bottom-color: var(--ws-panel-border, #333);
}

body[data-tint-cards="true"] .rv-ticket-column-count {
  background: var(--ws-panel-border, #333);
}

body[data-tint-cards="true"] .rv-ticket-card {
  background: var(--ws-sidebar-bg, #111);
  border-color: var(--ws-panel-border, #333);
}

body[data-tint-cards="true"] .rv-ticket-card:hover {
  border-color: var(--ws-primary, #facc15);
  background: color-mix(in srgb, var(--ws-sidebar-bg, #111) 90%, var(--ws-primary, #facc15));
}

body[data-tint-cards="true"] .rv-ticket-card.active {
  border-color: var(--ws-primary, #facc15);
}

/* ── Navigation ── */
body[data-tint-navigation="true"] .file-tree-item,
body[data-tint-navigation="true"] .tree-label,
body[data-tint-navigation="true"] .rv-fp-tree-item {
  color: var(--accent-dim);
}

body[data-tint-navigation="true"] .tree-icon,
body[data-tint-navigation="true"] .rv-fp-folder-filled,
body[data-tint-navigation="true"] .rv-fp-folder-outline {
  color: var(--accent-dim);
}

/* ── Left Panel ── */
body[data-tint-left="true"] .threads-sidebar {
  /* ... add actual selectors from App.css ... */
}

/* ── Right Panel ── */
body[data-tint-right="true"] .right-column {
  /* ... add actual selectors from App.css ... */
}

/* ── Chat Borders ── */
body[data-tint-border-chat="true"] .chat-messages,
body[data-tint-border-chat="true"] .chat-input-wrapper,
body[data-tint-border-chat="true"] .message-user-content,
body[data-tint-border-chat="true"] .rv-send-button-group {
  border: 1px solid var(--border-color);
}

/* ── Thread Borders ── */
body[data-tint-border-threads="true"] .chat-item {
  /* ... add actual selectors ... */
}
```

**Then remove the corresponding rules from:**
- `open-robin-client/src/components/tickets/tickets.css`
- `open-robin-client/src/components/tile-row/tile-row.css`
- `ai/<machine>/Data/File-Viewer/styles/layout.css`
- `open-robin-client/src/components/wiki/wiki.css`
- `open-robin-client/src/components/App.css`

**Smoke test:**
1. Build client, restart server
2. Flip each toggle in ThemePicker
3. Verify visual effect still works in every view
4. Verify no orphaned `.rv-panel[data-tint-*]` rules remain in any CSS file

**Risk:** High. This touches many CSS files. Wrong selectors = broken styling.

---

### Chunk 8: Move Per-View CSS to Correct Location
**Goal:** Move layout CSS from `open-robin-client/src/components/**/` to `ai/<machine>/Views/{view-folder}/styles/layout.css`.

**For each view:**

**8a. Wiki (`components/wiki/wiki.css` → `ai/<machine>/Views/<wiki-view-folder>/styles/layout.css`)**
1. Create `ai/<machine>/Views/<wiki-view-folder>/styles/layout.css`
2. Copy layout-only rules from `wiki.css` (grid structure, padding, flex, positioning)
3. Remove color/border/tint rules (now in `ai/<machine>/System/styles/tints.css`)
4. Remove the old `wiki.css` import from `WikiExplorer.tsx`
5. `useViewLayoutStyles('wiki-viewer')` is already called in `WikiExplorer.tsx` ✅

**8b. Tickets (`components/tickets/tickets.css` → `ai/<machine>/Views/tickets-viewer/styles/layout.css`)**
1. Create `ai/<machine>/Views/tickets-viewer/settings/` folder
2. Create `layout.css`
3. Copy layout-only rules
4. Remove color/border/tint rules
5. Remove old `tickets.css` import

**8c. Agents (`components/agents/agents.css` → `ai/<machine>/Agents/styles/layout.css`)**
1. Create `layout.css`
2. Copy layout-only rules
3. Remove color/border/tint rules
4. Remove old `agents.css` import

**8d. Capture/Doc Viewer (`components/tile-row/tile-row.css` + `components/capture/capture.css` → `ai/<machine>/Views/*-doc-viewer/styles/layout.css`)**
1. `ai/<machine>/Views/*-doc-viewer/settings/` exists but has no `layout.css`
2. Create `layout.css`
3. Move tile-row layout rules and capture layout rules
4. Remove color rules
5. Remove old imports

**Smoke test per view:**
1. Navigate to the view
2. Verify layout renders correctly (columns, grids, padding, positioning)
3. Verify colors still render correctly (they come from global CSS)
4. Verify toggle effects still work

**Risk:** High per view. Layout breakage is immediately visible.

---

### Chunk 9: Final Cleanup
**Goal:** Delete old client CSS files, verify no orphaned imports.

**Files to delete (after confirming all rules were moved):**
- `open-robin-client/src/components/wiki/wiki.css`
- `open-robin-client/src/components/tickets/tickets.css`
- `open-robin-client/src/components/agents/agents.css`
- `open-robin-client/src/components/tile-row/tile-row.css`
- `open-robin-client/src/components/capture/capture.css`

**Verify no orphaned imports:**
```bash
grep -r "wiki.css\|tickets.css\|agents.css\|tile-row.css\|capture.css" open-robin-client/src/components/
```

**Smoke test:**
1. Full app walkthrough: every view, every toggle, every slider
2. Verify no console errors
3. Verify no 404s in Network tab

**Risk:** Medium. Orphaned imports cause build failures.

---

## Full File Inventory

### Server files to change
| File | Change |
|------|--------|
| `open-robin-server/server.js` | Add `__settings__` pseudo-panel; update global CSS path |
| `open-robin-server/lib/theme/themes-service.js` | Update `themesPath()` and `cssPath()` |
| `open-robin-server/lib/startup.js` | Verify it calls updated `themes-service` |
| `open-robin-server/lib/watcher/filters/theme-json-regenerator.js` | Verify it calls updated `themes-service` |

### Client files to change
| File | Change |
|------|--------|
| `open-robin-client/src/lib/panels.ts` | Add `fetchSettingsFile()`, `SETTINGS_STYLES_*` constants |
| `open-robin-client/src/hooks/useSharedWorkspaceStyles.ts` | Use `fetchSettingsFile` for global layers |
| `open-robin-client/src/components/App.tsx` | Update comment |
| `open-robin-client/src/styles/variables.css` | Update comment |
| `open-robin-client/src/components/Robin/ThemeDetail.tsx` | Update path references |

### CSS files to create/move
| File | Action |
|------|--------|
| `ai/<machine>/System/styles/themes.json` | Copy from `ai/<machine>/System/styles/` |
| `ai/<machine>/System/styles/themes.css` | Copy from `ai/<machine>/System/styles/` |
| `ai/<machine>/System/styles/views.css` | Copy from `ai/<machine>/System/styles/` |
| `ai/<machine>/System/styles/components.css` | Copy from `ai/<machine>/System/styles/` |
| `ai/<machine>/System/state/state.json` | Copy from `ai/<machine>/System/styles/` |
| `ai/<machine>/System/styles/variables.css` | Copy from `open-robin-client/src/styles/variables.css` |
| `ai/<machine>/System/styles/tints.css` | **NEW**: Extract from per-view CSS |
| `ai/<machine>/Views/<wiki-view-folder>/styles/layout.css` | **NEW**: Move from `components/wiki/wiki.css` |
| `ai/<machine>/Views/tickets-viewer/styles/layout.css` | **NEW**: Move from `components/tickets/tickets.css` |
| `ai/<machine>/Agents/styles/layout.css` | **NEW**: Move from `components/agents/agents.css` |
| `ai/<machine>/Views/*-doc-viewer/styles/layout.css` | **NEW**: Move from `components/tile-row/tile-row.css` + `components/capture/capture.css` |

### CSS files to delete
| File | Reason |
|------|--------|
| `ai/<machine>/System/styles/themes.json` | Moved to `ai/<machine>/System/styles/` |
| `ai/<machine>/System/styles/themes.css` | Moved to `ai/<machine>/System/styles/` |
| `ai/<machine>/System/styles/views.css` | Moved to `ai/<machine>/System/styles/` |
| `ai/<machine>/System/styles/components.css` | Moved to `ai/<machine>/System/styles/` |
| `ai/<machine>/System/styles/state.json` | Moved to `ai/<machine>/System/styles/` |
| `open-robin-client/src/components/wiki/wiki.css` | Moved to `ai/<machine>/Views/<wiki-view-folder>/styles/layout.css` |
| `open-robin-client/src/components/tickets/tickets.css` | Moved to `ai/<machine>/Views/tickets-viewer/styles/layout.css` |
| `open-robin-client/src/components/agents/agents.css` | Moved to `ai/<machine>/Agents/styles/layout.css` |
| `open-robin-client/src/components/tile-row/tile-row.css` | Moved to `ai/<machine>/Views/*-doc-viewer/styles/layout.css` |
| `open-robin-client/src/components/capture/capture.css` | Moved to `ai/<machine>/Views/*-doc-viewer/styles/layout.css` |

---

## Pre-Flight Checklist (Before Starting)

- [ ] Read and understand `open-robin-client/src/hooks/useSharedWorkspaceStyles.ts`
- [ ] Read and understand `open-robin-server/server.js` lines 271-291 (`resolveProjectRootForPanel`)
- [ ] Read and understand `open-robin-client/src/lib/panels.ts` (`fetchViewsRootFile`, `fetchPanelWorkspaceFile`)
- [ ] Read and understand `open-robin-server/lib/theme/themes-service.js`
- [ ] Verify `ai/<machine>/Data/File-Viewer/styles/layout.css` exists and loads correctly (this is the working example)
- [ ] Verify `useViewLayoutStyles('file-viewer')` is called somewhere (check FileExplorer component)
- [ ] Confirm server restart procedure: `cd open-robin-client && npm run build`, then restart server

## Rollback Plan

If any chunk breaks:
1. The old files in `ai/<machine>/System/styles/` are kept until Chunk 6
2. The old client CSS files are kept until Chunk 9
3. If Chunk 3 breaks (client loading), revert `useSharedWorkspaceStyles.ts` to use `fetchViewsRootFile`
4. If Chunk 4 breaks (theme service), revert `themes-service.js` paths
5. If Chunk 7 breaks (tints.css), the old `.rv-panel[data-tint-*]` rules still exist in client CSS as fallback
