# Theme System Refactor — Master SPEC

**Status:** Planning  
**Applies to:** `open-robin` theme, settings, and layout system  
**Replaces:** `ai/views/settings/THEME_SYSTEM_AUDIT.md` (this spec supersedes it)  

---

## 1. Objective & Scope

### What we are building

A single-source-of-truth theme and settings system that lives entirely in the filesystem (`ai/views/**/settings/`). No database involvement for themes, layout, or CSS.

- **Themes:** Sliders + accent → `themes.json` → generated `themes.css`
- **Overrides:** Power users edit `themes.css` or `themes.json` directly; the system respects their edits
- **Per-view overrides:** Optional `ai/views/<view>/settings/themes.css` scopes to that view only
- **Layout:** Per-view `layout.json` (chat width, threads collapsed, etc.) served by the workspace

### What we are NOT building

- A new UI for the Robin system panel (Robin is being obsoleted; header icons replace it)
- A CSS-in-JS solution or runtime CSS engine
- New theme presets or a marketplace
- Animation/tweening for theme transitions

### Robin panel obsolescence

The Robin panel's theme tab is going away. The entire `lib/robin/theme-css.js` preset system and all DB theme storage become dead code.

**Remove:**
- `lib/robin/theme-css.js` (move to `archive/`)
- Theme handlers from `lib/robin/ws-handlers.js`:
  - `robin:theme-update-system`
  - `robin:theme-update-workspace`
  - `robin:theme-inherit`
  - `robin:theme-apply-diverged`
- Theme query functions from `lib/robin/queries.js`:
  - `getSystemTheme`
  - `updateSystemTheme`
  - `getWorkspaceTheme`
  - `upsertWorkspaceTheme`
- The `applyThemeToNewSystem` bridge function

**Preserve:**
- `robin:theme-load` (read-only state for过渡期) OR remove entirely if no callers
- All wiki, tab, and context handlers
- Theme wiki content in `system_wiki` table

**Do NOT drop DB tables yet.** Just stop writing to them. Migration can be a later cleanup chunk.

---

## 2. Target Architecture

### Server (`open-robin-server/lib/theme/`)

```
lib/theme/
├── color-math.js              ← NEW. hexToHsl, hslToHex, computeSyntaxPalette, clamp
├── theme-css-generator.js     ← NEW. Orchestrator: entry → CSS string. Imports segments.
├── panel-css.js               ← NEW. --bg-*, --panel-*, --sidebar-* surfaces
├── content-css.js             ← NEW. --document-*, --document-code-bg
├── text-css.js                ← NEW. --text-*, --icon-dim
├── border-css.js              ← NEW. --border-*, --neutral-chrome-border
├── accent-css.js              ← NEW. --theme-primary, --chrome-accent, --cli-accent
├── workspace-css.js           ← NEW. --ws-sidebar-bg, --ws-content-bg
├── syntax-css.js              ← NEW. --hljs-* (imports color-math.js)
├── themes-service.js          ← STRIPPED. File I/O, CRUD, activation, queue ONLY
└── layout-service.js          ← NEW. Read/write per-view layout.json
```

**Size targets:**
- No file over 150 lines
- `themes-service.js` under 120 lines
- `theme-css-generator.js` under 80 lines

### Client (`open-robin-client/src/lib/theme/`)

```
src/lib/theme/
├── color-math.d.ts            ← NEW. TypeScript declarations for server color-math.js
├── live-preview.ts            ← NEW. applyLivePreview, clearLivePreview, LIVE_PREVIEW_TOKENS
└── theme-api.ts               ← NEW. saveTheme(), activateTheme(), fetchThemes()
```

```
src/components/
└── ThemePicker.tsx            ← STRIPPED. React UI only. Imports live-preview + theme-api.
```

**Size targets:**
- `ThemePicker.tsx` under 250 lines
- `live-preview.ts` under 150 lines

### Settings file tree (workspace filesystem)

```
ai/views/settings/
├── themes.json                ← Single source of truth for theme state
├── themes.css                 ← Generated from themes.json ONLY
├── layout.json                ← NEW. Global layout defaults (optional)
└── components.css             ← Existing. Unaffected.

ai/views/<view>/settings/
├── themes.css                 ← OPTIONAL. Manual per-view override.
├── layout.json                ← NEW. Per-view layout state.
└── ...                        ← Existing files (layout.css, state.json) unaffected.
```

---

## 3. Data Flow

### 3.1 Dropdown save (normal flow)

```
User drags slider
  → ThemePicker.onChange → debounced(250ms)
  → theme-api.saveTheme() → WS theme:save
  → server: themes-service.save(entry)
  → 1. Write themes.json atomically (tmp → rename)
  → 2. theme-css-generator.render(entry)
  → 3. Write themes.css atomically
  → 4. Broadcast theme:state to all clients
  → Client receives broadcast → refreshes <link rel="stylesheet"> href
  → Live preview already showed it via applyLivePreview
```

### 3.2 Direct edit (power user flow)

```
User edits ai/views/settings/themes.css
  → No code path touches this file until dropdown is used again
  → Next dropdown save → themes.css is regenerated from themes.json
  → User's custom edits are overwritten (expected — they chose to use the tool)

User edits ai/views/settings/themes.json
  → Watcher picks up modify event
  → Server validates JSON, finds active theme, regenerates themes.css
  → Broadcast theme:state to clients
```

### 3.3 Per-view override flow

```
Client loads view = "wiki-viewer"
  → GET /api/view-config?panel=wiki-viewer
  → Server returns:
      { globalCss: "...themes.css contents...",
        viewCss: "...wiki-viewer/settings/themes.css or null...",
        layout: { ...wiki-viewer/settings/layout.json or {}... } }
  → Client injects globalCss first, then viewCss (cascade wins)
  → Client applies layout JSON to view state
```

### 3.4 Server boot flow

```
server.js starts
  → startup.js runs
  → If themes.css missing OR themes.json mtime > themes.css mtime:
    → Read themes.json → find active theme → regenerate themes.css
  → Serve themes.css statically
  → Register watcher for themes.json changes
```

---

## 4. Interface Contracts

### 4.1 color-math.js

```js
function hexToHsl(hex) → [h, s, l]
function hslToHex(h, s, l) → string
function clamp(n, min = 0, max = 100) → number
function computeSyntaxPalette(accent, contentLuminance, contentContrast) → { keyword, function, number, string, class, section, comment, base }
```

**Constraints:**
- Pure functions only. No I/O, no DOM, no side effects.
- Must work in Node.js (CommonJS) and be importable by Vite (client).

### 4.2 Segment CSS modules (panel-css.js, content-css.js, etc.)

```js
function render(entry) → string   // CSS fragment, no wrapping block
```

Each module receives the full `entry` object and returns a string of CSS declarations (no selector). Example:

```js
// panel-css.js
function render(entry) {
  const { luminance, panelContrast, bgTint, accent } = entry;
  // ... compute surfaces ...
  return `
  --bg-solid: ${floor};
  --bg-primary: ${floor};
  --bg-secondary: ${surf};
  // ...
  `;
}
```

### 4.3 theme-css-generator.js

```js
function render(entry) → string   // Full :root { ... } CSS block
```

Orchestrator. Imports all segment modules, calls each `render(entry)`, wraps in `:root { }`, adds comment header.

### 4.4 themes-service.js

```js
async function list(projectRoot) → ThemeEntry[]
async function activate(projectRoot, id) → ThemeEntry[]
async function save(projectRoot, entry) → ThemeEntry[]
async function deleteTheme(projectRoot, id) → ThemeEntry[]
async function generateCss(projectRoot, id) → void
```

**Constraints:**
- No color math. No CSS generation logic. Only file I/O, validation, queueing.
- Calls `themeCssGenerator.render(entry)` to produce CSS string.
- Reads/writes `ai/views/settings/themes.json` and `ai/views/settings/themes.css`.

### 4.5 layout-service.js

```js
async function getLayout(projectRoot, viewName) → object
async function setLayout(projectRoot, viewName, layout) → object
```

Reads/writes `ai/views/<view>/settings/layout.json`. Returns `{}` if file missing.

### 4.6 live-preview.ts

```ts
function applyLivePreview(
  accent: string,
  luminance: number,
  panelContrast: number,
  bgTint: number,
  contentLuminance: number,
  contentContrast: number,
  contentTint: number,
  borders: number,
  chromeTint: number,
): void

function clearLivePreview(): void
```

**Constraints:**
- Must produce CSS variable values **identical** to `theme-css-generator.js` output.
- Uses `computeSyntaxPalette` from shared `color-math.js`.
- Writes to `document.documentElement.style`.

---

## 5. Chunk Breakdown

### Parallel groups

```
Group A (parallel):
  Chunk 1: Extract color-math.js + fix contrast spread
  Chunk 4: Extract client live-preview.ts + fix drift

Group B (depends on Group A):
  Chunk 2: Server CSS segmentation
  Chunk 3: Override system (per-view CSS + layout)

Group C (depends on Groups A + B):
  Chunk 5: Robin deprecation + ThemePicker cleanup
```

---

### Chunk 1: Extract color-math.js + fix contrast spread

**Scope:**
- Create `open-robin-server/lib/theme/color-math.js`
- Create `open-robin-server/lib/theme/color-math.d.ts`
- Remove `hexToHsl`, `hslToHex`, `computeSyntaxPalette`, `clamp` from `themes-service.js`
- Remove `hexToHsl`, `hslToHex`, `computeSyntaxPalette`, `clamp` from `ThemePicker.tsx`
- Import shared module in both files
- Fix `computeSyntaxPalette` spread so Content Contrast slider is perceptible

**Acceptance criteria:**
- [ ] `color-math.js` exists, is pure, has no I/O
- [ ] `themes-service.js` imports from it; no color math remains in file
- [ ] `ThemePicker.tsx` imports from it; no color math remains in file
- [ ] Content Contrast at 0%, 50%, 100% produces visibly different syntax colors in both light and dark modes
- [ ] TypeScript compiles without errors
- [ ] Server starts without errors
- [ ] themes.css output is structurally identical except for `--hljs-*` values

**Files touched:**
- `open-robin-server/lib/theme/color-math.js` (new)
- `open-robin-server/lib/theme/color-math.d.ts` (new)
- `open-robin-server/lib/theme/themes-service.js` (modify)
- `open-robin-client/src/components/ThemePicker.tsx` (modify)

---

### Chunk 2: Server CSS segmentation

**Scope:**
- Create segment modules: `panel-css.js`, `content-css.js`, `text-css.js`, `border-css.js`, `accent-css.js`, `workspace-css.js`, `syntax-css.js`
- Create `theme-css-generator.js` as orchestrator
- Strip `themes-service.js` to file I/O + CRUD only (remove `renderSlugToCss`)
- Ensure `themes.css` output is **byte-identical** to pre-chunk output (no behavior change)

**Acceptance criteria:**
- [ ] Each segment module is under 150 lines and has one job
- [ ] `theme-css-generator.js` is under 80 lines
- [ ] `themes-service.js` is under 120 lines
- [ ] `themes.css` generated for 3 test themes matches pre-chunk output exactly
- [ ] Server starts, theme save/activate still work

**Files touched:**
- `open-robin-server/lib/theme/theme-css-generator.js` (new)
- `open-robin-server/lib/theme/panel-css.js` (new)
- `open-robin-server/lib/theme/content-css.js` (new)
- `open-robin-server/lib/theme/text-css.js` (new)
- `open-robin-server/lib/theme/border-css.js` (new)
- `open-robin-server/lib/theme/accent-css.js` (new)
- `open-robin-server/lib/theme/workspace-css.js` (new)
- `open-robin-server/lib/theme/syntax-css.js` (new)
- `open-robin-server/lib/theme/themes-service.js` (modify)

---

### Chunk 3: Override system (per-view CSS + layout)

**Scope:**
- Create `layout-service.js`
- Add endpoint: `GET /api/view-config?panel=<name>`
  - Returns `{ globalCss, viewCss, layout }`
- Client: load per-view CSS after global CSS
- Client: apply per-view layout JSON
- Watcher: on `themes.json` modify, regenerate `themes.css` without requiring dropdown use

**Acceptance criteria:**
- [ ] Creating `ai/views/wiki-viewer/settings/themes.css` with `--text-primary: red` makes wiki view text red without affecting other views
- [ ] Creating `ai/views/file-viewer/settings/layout.json` with `{ chatWidth: 400 }` is returned by the API
- [ ] Editing `ai/views/settings/themes.json` by hand triggers CSS regeneration via watcher
- [ ] The generator NEVER touches per-view CSS files

**Files touched:**
- `open-robin-server/lib/theme/layout-service.js` (new)
- `open-robin-server/lib/ws/theme-handlers.js` or `server.js` (modify for endpoint)
- `open-robin-client/src/lib/ws-client.ts` or relevant view loader (modify)
- `open-robin-server/lib/watcher/` (modify for themes.json watcher hook)

---

### Chunk 4: Client live-preview extraction

**Scope:**
- Create `open-robin-client/src/lib/theme/live-preview.ts`
- Move `applyLivePreview`, `clearLivePreview`, `LIVE_PREVIEW_TOKENS` out of `ThemePicker.tsx`
- Fix drift: align all text values, opacities, and tint logic with server `renderSlugToCss` output
- Create `open-robin-client/src/lib/theme/theme-api.ts` with `saveTheme()`, `activateTheme()`
- Strip `ThemePicker.tsx` to UI only

**Acceptance criteria:**
- [ ] `live-preview.ts` exists and is under 150 lines
- [ ] `ThemePicker.tsx` is under 250 lines
- [ ] Live preview produces values identical to server-generated CSS for the same entry
  - Test: compare `--text-primary`, `--text-secondary`, `--text-dim`, `--text-subtle`, `--hljs-keyword` for 3 themes
- [ ] Theme save/activate still work end-to-end
- [ ] No stale comments (remove "stub for now" comment)

**Files touched:**
- `open-robin-client/src/lib/theme/live-preview.ts` (new)
- `open-robin-client/src/lib/theme/theme-api.ts` (new)
- `open-robin-client/src/components/ThemePicker.tsx` (modify)

---

### Chunk 5: Robin deprecation + ThemePicker cleanup

**Scope:**
- Remove theme handlers from `lib/robin/ws-handlers.js`
- Remove theme queries from `lib/robin/queries.js`
- Move `lib/robin/theme-css.js` to `archive/`
- Remove `applyThemeToNewSystem` bridge
- Verify no callers remain for `robin:theme-update-system`, etc.
- Final cleanup: remove any dead imports

**Acceptance criteria:**
- [ ] `lib/robin/theme-css.js` moved to archive
- [ ] `lib/robin/ws-handlers.js` has no theme update/write handlers
- [ ] `lib/robin/queries.js` has no theme query functions
- [ ] Robin panel wiki/tabs/context handlers still work
- [ ] No DB writes during theme operations
- [ ] Server starts without errors

**Files touched:**
- `open-robin-server/lib/robin/ws-handlers.js` (modify)
- `open-robin-server/lib/robin/queries.js` (modify)
- `open-robin-server/lib/robin/theme-css.js` (move to archive)

---

## 6. Shared Conventions

### Code standards (from enforcement)
- One job per file. No "and" in the one-sentence description.
- No file over 400 lines. Target under 150 for new modules.
- No premature abstractions. Extract only when a second consumer exists.
- Delete, don't deprecate. No `_unused`, no backwards-compat shims.

### Naming
- Files: `feature-segment.js`, `feature-service.js`
- CSS vars: `--palette-name`, `--bg-name`, `--text-name`
- Functions: `render()`, `compute()`, `clamp()` — verbs

### Paths
- Global settings: `<projectRoot>/ai/views/settings/`
- Per-view settings: `<projectRoot>/ai/views/<view>/settings/`
- Server lib: `open-robin-server/lib/theme/`
- Client lib: `open-robin-client/src/lib/theme/`

### No database rule
- Theme data lives in `themes.json`
- Layout data lives in `layout.json`
- CSS lives in `themes.css`
- No rows are inserted/updated in `system_theme` or `workspace_themes`
- DB tables may be left in place for now; just stop writing to them

---

## 7. Verification Matrix

| Check | Chunk | How to verify |
|-------|-------|---------------|
| Content Contrast slider visible | 1 | Load dark theme, drag contrast 0→100. `--hljs-keyword` lightness should span ≥30 points. |
| Live preview = server CSS | 4 | For same entry, compare all `--hljs-*` and `--text-*` values. Should match exactly. |
| Direct CSS edit persists | 3 | Edit `themes.css`, wait 10s, verify file unchanged. Use dropdown → verify overwritten. |
| Direct JSON edit triggers regen | 3 | Edit `themes.json` by hand, verify `themes.css` updates via watcher. |
| Per-view CSS overrides | 3 | Create `wiki-viewer/settings/themes.css` with `--text-primary: red`. Only wiki view turns red. |
| Per-view layout loads | 3 | Create `file-viewer/settings/layout.json` with `{ sidebarOpen: false }`. API returns it. |
| No DB theme writes | 5 | Trigger theme save. Check `robin.db` — no `updated_at` change in `system_theme`. |
| Server boot regen | 2 | Delete `themes.css`, restart server. File recreated on boot. |
| File size compliance | All | `wc -l` every new/modified file. No file >400 lines. |

---

## 8. Report Format for Chunk Sessions

Each worker session should return:

```markdown
# Chunk X Report

## Files changed
- created: path/to/new/file.js (lines)
- modified: path/to/old/file.js (+lines, -lines)
- deleted/moved: path/to/old/file.js

## Acceptance criteria
- [x] Criterion 1 — how verified
- [x] Criterion 2 — how verified
- [ ] Criterion 3 — blocked by / skipped because

## Gotchas / deviations
- Anything that diverged from the spec and why

## Next chunk notes
- Any interfaces that changed and need to be communicated to next session
```
