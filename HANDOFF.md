# Theme System Refactor — Handoff

**Date:** 2026-04-25  
**Status:** Content-layer complete. Ready for border + chrome expansion.  
**Code standards ref:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`

---

## What We Built (Summary by Chunk)

| Chunk | What | Status |
|-------|------|--------|
| 1 | Extracted `color-math.js` + `.d.ts`. Fixed contrast spread (30/35 → 50/55). Reduced `ThemePicker.tsx` (474→392) and `themes-service.js` (459→328). | ✅ |
| 2 | Segmented CSS generator into 8 modules. `themes-service.js` stripped to 113 lines (I/O only). Value-identical output for 45 properties. | ✅ |
| 3 | Added override system: `layout-service.js`, `GET /api/view-config?panel=<id>`, watcher `theme-json-regenerator.js`, client `useSharedWorkspaceStyles.ts`. | ✅ |
| 4 | Extracted `live-preview.ts` (147 lines) + `theme-api.ts` (18 lines). `ThemePicker.tsx` down to 206 lines. | ✅ |
| 5 | Deprecated Robin theme system. Moved `theme-css.js` to `archive/`. Removed 5 theme handlers from `ws-handlers.js`, 4 queries from `queries.js`. Stripped theme code from `RobinOverlay.tsx`. | ✅ |
| 6 | Renamed `--robin-*` CSS variables to generic tokens (`--card-bg`, `--card-hover`, `--input-bg`, `--chat-bg`, `--component-border`). Removed `--robin-primary`. | ✅ |
| OKLCH | Rewrote `computeSyntaxPalette` in OKLCH space via `culori`. Added `computeContentSurfaces` helper. Content contrast slider now controls token distance from bg without moving the bg. Light mode gets extra contrast distance (`minDist=0.15`, `maxDist=0.42` vs dark `0.10/0.35`). | ✅ |
| Luminance ranges | Changed slider ranges: dark 0–25 (was 0–40), light 75–100 (was 60–100). Snap offset updated from 60→75. | ✅ |
| Pure white | Max content luminance (100) + tint=0 → `#ffffff`. Tint>0 at max lum → tinted color. Smooth gradient (99→`#fcfcfc`). | ✅ |

---

## Current Architecture

### Server (`open-robin-server/lib/theme/`)

| File | Lines | Job |
|------|-------|-----|
| `color-math.js` | 246 | Pure math: OKLCH palette generation, surface mixing, `computeContentSurfaces`, `computeSyntaxPalette`. Shared by server + client. |
| `themes-service.js` | 113 | I/O + CRUD for `themes.json`. Orchestrates saves via serialized promise queue. |
| `theme-css-generator.js` | 26 | Orchestrator: imports all segment modules, concatenates into `:root {}` block. |
| `panel-css.js` | 52 | Surface + card variables (`--bg-*`, `--card-bg`, `--panel-bg`, etc.). |
| `content-css.js` | 9 | Content surfaces (`--document-surface-bg`, `--document-code-bg`). Delegates to `computeContentSurfaces`. |
| `text-css.js` | 28 | Text hierarchy (`--text-primary`, `--text-dim`, etc.). |
| `border-css.js` | 18 | Border variables (`--border-color`, `--neutral-chrome-border`). |
| `accent-css.js` | 26 | Accent + chrome (`--theme-primary`, `--chrome-accent`, `--cli-accent`, `--tile-color`). |
| `workspace-css.js` | 38 | Workspace overrides (`--ws-sidebar-bg`, `--ws-content-bg`, `--ws-panel-border`). |
| `syntax-css.js` | 20 | Syntax highlighting (`--hljs-*`). Calls `computeSyntaxPalette`. |
| `layout-service.js` | 26 | Per-view layout overrides (`layout.json` I/O). |

**Total server theme code:** ~672 lines across 11 files.

### Client (`open-robin-client/src/`)

| File | Lines | Job |
|------|-------|-----|
| `components/ThemePicker.tsx` | 206 | Popover UI: 6 sliders + color picker + mode toggle. Auto-saves to `user-current` theme (250ms debounce). |
| `lib/theme/live-preview.ts` | 147 | Writes CSS variables to `document.documentElement.style` for instant preview. Imports `computeContentSurfaces` + `computeSyntaxPalette` from server `color-math.js`. |
| `lib/theme/theme-api.ts` | 18 | Thin wrappers around panel store (`saveTheme`, `activateTheme`, `deleteTheme`, `fetchThemes`). |
| `hooks/useSharedWorkspaceStyles.ts` | ~40 | Fetches `themes.css` via WebSocket, injects as `<style>` tag. Per-view CSS + layout via `GET /api/view-config?panel=<id>`. |

---

## Key Patterns Established

### Pattern 1: Segment Module
Each CSS concern lives in its own file. One `render(entry)` function that returns a CSS fragment string. Orchestrator concatenates them.

```js
// panel-css.js
function render(entry) {
  const { accent, luminance } = entry;
  // ... compute values
  return `  --card-bg: ${hex};`;
}
module.exports = { render };
```

### Pattern 2: Shared Pure Math (`color-math.js`)
No I/O, no DOM. Used by both server (CSS generation) and client (live preview). CJS module with `.d.ts` types. Vite handles the cross-project import via `commonjsOptions.include`.

### Pattern 3: Catalog for Mode-Specific Behavior
When light/dark need different formulas, use a catalog object instead of inline `isLight ? a : b` spaghetti.

```js
const CONTENT_SURFACE_CATALOG = {
  dark:  { codeOffset: 8 },
  light: { codeOffset: 0 },
};
```

**Current catalogs:**
- `computeContentSurfaces`: `codeOffset` differs by `contentIsLight`
- `computeSyntaxPalette`: `minDist`/`maxDist` differs by `isLight` (bgL-based)

### Pattern 4: Watcher Auto-Regeneration
Programmatic filter `theme-json-regenerator.js` detects `themes.json` edits and regenerates `themes.css`. Manual CSS edits at `ai/views/<view>/settings/themes.css` are untouched.

### Pattern 5: Serialized Promise Queue
All file writes in `themes-service.js` go through a promise queue to prevent race conditions during rapid slider changes.

---

## The Contrast Model (Document This Carefully)

This is the mental model for how contrast works now. Replicate it for borders + chrome.

**Current behavior:**
1. `computeContentSurfaces` computes the actual bg hex (using `panelContrast`, NOT `contentContrast`).
2. `computeSyntaxPalette` receives the bg hex as `codeBgHex`.
3. `contentContrast` slider controls **distance from bg**, not the bg itself.
   - `dist = minDist + (maxDist - minDist) * (contrast/100)`
   - Light mode: `minDist=0.15`, `maxDist=0.42`
   - Dark mode: `minDist=0.10`, `maxDist=0.35`
4. Tokens sit at `bgL ± dist` depending on mode.
5. `contentTint` scales chroma (`0→greyscale`, `30→vibrant`).

**Why this works:** The bg stays fixed when contrast moves. Tokens sharpen/soften relative to it.

---

## Next Work: Borders + Chrome

**User's intention:** Apply the same luminance/tint/contrast heuristic to borders and chrome, with slightly different rules per layer.

### Proposed Structure

| Layer | Sliders | Behavior |
|-------|---------|----------|
| **Content** (done) | Luminance (75–100/0–25), Tint (0–30), Contrast (0–100) | Contrast = token distance from bg. Tint fades at max lum for pure white. |
| **Borders** (next) | Luminance (0–100), Tint (0–100?) | Light→dark gradient. Tint overlays accent. **No contrast slider** — saturation is the tint itself. |
| **Chrome** (next) | Luminance (0–100), Tint (0–100?) | Same as borders: light→dark base + tint overlay. |

### Pattern to Replicate

For borders and chrome, create new segment modules:

```
border-css.js     → already exists, currently uses `borders` slider
chrome-css.js     → new module (or extend accent-css.js)
```

Each gets its own `compute*Surfaces` helper in `color-math.js` (or a generic parameterized helper).

**Key insight from user:** Borders don't need a contrast slider. The tint IS the saturation control. Contrast on content makes sense because tokens need to differentiate from each other. Borders and chrome are single surfaces — they just need luminance + tint.

### Catalog Expansion

```js
const SURFACE_CATALOG = {
  content: { codeOffset: { dark: 8, light: 0 }, maxDist: { dark: 0.35, light: 0.42 } },
  border:  { /* TBD */ },
  chrome:  { /* TBD */ },
};
```

---

## Code Standards Compliance Audit

### ✅ Compliant

| Rule | Status | Evidence |
|------|--------|----------|
| One job per file | ✅ | Each segment module has one `render()`. `color-math.js` = pure math only. |
| Under 400 lines | ✅ | Largest file: `color-math.js` at 246 lines. `ThemePicker.tsx` at 206 lines. |
| No God files | ✅ | `themes-service.js` stripped from 459→113. `theme-css-generator.js` is just an orchestrator. |
| Delete, don't deprecate | ✅ | `theme-css.js` moved to `archive/`. Robin handlers removed, not commented out. |
| CSS variables with fallbacks | ✅ | All generated CSS uses `var(--token)` format. |
| No hardcoded colors in components | ✅ | `ThemePicker.tsx` uses CSS vars. |

### ⚠️ Non-Compliant / Flagged for Future Work

| Issue | Location | Why | Fix |
|-------|----------|-----|-----|
| **File over 400 lines (historical)** | `server.js` (1752 lines) | Pre-existing God file. Not touched by theme work. | Spec `01-server-js-decomposition.md` exists. Do LAST. |
| **Panel-css.js duplication** | `panel-css.js` has its own `luminanceToHex` and `surface` helpers. | Pre-existed before extraction. `color-math.js` now has the canonical versions. | Migrate `panel-css.js` to import `luminanceToHex` and `mixHex` from `color-math.js`. Removes ~15 lines of duplication. |
| **Inline styles in live preview** | `live-preview.ts` writes to `document.documentElement.style`. | Exception: theme picker needs instant preview. Clears on unmount so `themes.css` takes over. | Acceptable per "layer as little code as possible" rule. Not a component, it's a preview utility. |
| **Missing `.rv-` prefix in some CSS** | `document.css` has legacy `.token-*` classes. | Pre-existing. Not touched by theme work. | Spec `18-rv-prefix-migration.md` exists. |
| **Hardcoded colors in document.css** | `document.css` line 159: `.rv-file-icon-json { color: #f7df1e; }` | Intentionally not theme-controlled (JSON brand color). | User decision. Can be cataloged if desired. |

---

## Dependency Map

```
server/
  themes-service.js
    └─ theme-css-generator.js
         ├─ panel-css.js ── color-math.js (luminanceToHex, mixHex, clamp)
         ├─ content-css.js ── color-math.js (computeContentSurfaces)
         ├─ text-css.js
         ├─ border-css.js
         ├─ accent-css.js
         ├─ workspace-css.js ── color-math.js (luminanceToHex, mixHex)
         └─ syntax-css.js ── color-math.js (computeSyntaxPalette, computeContentSurfaces)

client/
  ThemePicker.tsx
    ├─ live-preview.ts ── color-math.js (computeSyntaxPalette, computeContentSurfaces, mixHex, luminanceToHex)
    └─ theme-api.ts ── panelStore
```

**Important:** `color-math.js` is the ONLY cross-project dependency. It lives in `open-robin-server/lib/theme/` but is imported by the client via relative path (`../../../../open-robin-server/lib/theme/color-math.js`). Vite config includes it in `commonjsOptions.include`.

---

## Gotchas & Silent Fails

1. **Server caches required modules.** Editing `color-math.js` does NOT affect the running server. Must restart after any `color-math.js` change.
2. **Client build stale.** The browser loads hashed JS filenames from `dist/`. If `npm run build` hasn't been run after a `color-math.js` change, the live preview uses old math while the server uses new math → visual jump.
3. **`themes.css` stale on server restart.** The server regenerates CSS on boot from the active theme in `themes.json`. If `themes.json` has old values, the regenerated CSS reflects old user settings.
4. **WS broadcast race.** `saveTheme()` then `activateTheme()` sends two WS messages. Between them, the store briefly has stale `activeId`. Not user-visible in practice.
5. **`computeContentSurfaces` uses `panelContrast` for bg spread.** If you change this back to `contentContrast`, the bg moves with the contrast slider again.

---

## Files Touched in This Session

### Server
- `open-robin-server/lib/theme/color-math.js` — OKLCH rewrite, catalog pattern, pure white cap
- `open-robin-server/lib/theme/color-math.d.ts` — New exports
- `open-robin-server/lib/theme/content-css.js` — Simplified to use `computeContentSurfaces`
- `open-robin-server/lib/theme/syntax-css.js` — Passes `documentCodeBg` to palette
- `open-robin-server/lib/theme/panel-css.js` — `--robin-*` rename
- `open-robin-server/lib/theme/accent-css.js` — Removed `--robin-primary`
- `open-robin-server/package.json` — Added `culori`

### Client
- `open-robin-client/src/components/ThemePicker.tsx` — Luminance ranges, slider mins/maxs
- `open-robin-client/src/lib/theme/live-preview.ts` — Uses `computeContentSurfaces`, passes bg to palette
- `open-robin-client/src/components/Robin/robin.css` — `--robin-*` → generic names
- `open-robin-client/vite.config.ts` — `commonjsOptions.include` (pre-existing, verify if still needed)

---

## Open Decisions

1. **Border/chrome slider ranges:** What are the min/max values? Same 0–100 for luminance? Different tint max?
2. **Border/chrome catalog shape:** Do borders need a `contrast` slider at all? User says no — tint is saturation.
3. **Panel-css.js cleanup:** Migrate its local `luminanceToHex` + `surface` helpers to use `color-math.js` exports?
4. **`--bg-secondary` = `--document-surface-bg` redundancy:** These are aliased. Should one be removed?
5. **Light mode contrast values:** Currently `minDist=0.15`, `maxDist=0.42`. User-approved but can be tuned.
