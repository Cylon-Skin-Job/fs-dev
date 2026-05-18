# Themes and State

This page defines the boundary between **theme** (global, workspace-wide style) and **state** (per-view layout geometry). AI agents must respect this boundary. Humans may manually override per-view CSS, but programmatic tinting or state injection into views is not supported.

---

## Two Systems, One Rule

| System | Stored In | Scope | What It Controls | Examples |
|--------|-----------|-------|------------------|----------|
| **Theme** | `ai/settings/themes.json` | Workspace-wide | Colors, surfaces, borders, typography, toggles | accent, luminance, panelContrast, bgTint, contentPanels, chatBorders, navAccent |
| **State** | `ai/views/**-viewer/settings/state.json` | Per-view only | Layout geometry, open/closed, position, size | sidebar width, chat collapsed, popup x/y, currentThreadId |

**The rule:** If it affects color or visual style, it is a **theme property** and applies to every view. If it affects position or visibility of a pane, it is **state** and stays inside the view where it was changed.

---

## How CSS Reaches the Browser

The client loads CSS through two channels managed by `useSharedWorkspaceStyles.ts`:

### 1. Global CSS (workspace-wide)

Global CSS is fetched via `fetchSettingsFile(ws, path)` which resolves to `ai/settings/{path}` on the server through the `__settings__` pseudo-panel. The client loads five layers on every workspace switch:

| Layer | Client Path | Server Path | Content |
|-------|-------------|-------------|---------|
| Themes | `themes.css` | `ai/settings/themes.css` | Generated from `themes.json` — variables only |
| Components | `components.css` | `ai/settings/components.css` | Global component styles |
| Views | `views.css` | `ai/settings/views.css` | Global view chrome (chat, sidebar, thread list) |
| Tints | `tints.css` | `ai/settings/tints.css` | Global tint selector catalog (`body[data-tint-*]`) |
| Variables | `variables.css` | `ai/settings/variables.css` | CSS variable defaults (fallbacks) |

**Load order is load-bearing.** `variables.css` must be injected **before** `themes.css` (and before any layer that overrides `:root` variables). Both files target `:root`; the last one injected wins. If `variables.css` loads after `themes.css`, the user's saved theme is silently overwritten by fallback values on every refresh. The canonical order is: `variables` → `themes` → `components` → `views` → `tints`.

**Server resolution:** The `__settings__` pseudo-panel in `server.js` resolves to `ai/settings/`. This is separate from `__panels__` which resolves to `ai/views/`.

### 2. Per-View CSS (scoped to one view)

Per-view CSS is fetched via `fetchPanelWorkspaceFile(ws, panelId, path)` which resolves to `ai/views/{panelId}/{path}` on the server through the `__panels__` pseudo-panel. Loaded when a view mounts:

| File | Server Path | Content |
|------|-------------|---------|
| `settings/layout.css` | `ai/views/{viewer}/settings/layout.css` | Layout only: widths, heights, flex/grid, visibility |
| `settings/themes.css` | `ai/views/{viewer}/settings/themes.css` | Optional per-view theme override (manual only) |

Per-view CSS is **scoped** to `[data-panel="{viewer}"]` so it never leaks to other views.

**No CSS is embedded in the server.** The server reads plain CSS files from disk and serves them as text over WebSocket. The client injects them into `<style>` tags.

---

## Theme System (Global)

The active theme in `ai/settings/themes.json` generates `ai/settings/themes.css`. This CSS is loaded once and applies to the entire workspace.

### Sliders (numeric)
- `luminance` — base panel background lightness
- `panelContrast` / `bgTint` — panel surface spread and accent blend
- `contentLuminance` / `contentContrast` / `contentTint` — document/code surfaces
- `borderLuminance` / `borderTint` — border color base
- `chromeLuminance` / `chromeTint` — chrome accent (active rows, buttons, icons)
- `accentLuminance` / `accentTint` — muted accent (inactive nav, dim icons)

### Toggles (boolean)
Toggles are theme properties, not state. They are saved to `themes.json` and regenerate `themes.css` on change.

| Toggle | Theme Key | What It Tints |
|--------|-----------|---------------|
| Content Panels | `tints.contentPanels` | All content panel surfaces universally (ticket columns, capture grid, empty states) → `sidebar-surface-bg` |
| Chat Border | `tints.borders.chat` | All chat chrome borders universally (messages, input, bubbles, buttons) → `border-color` |
| Thread Border | `tints.borders.threads` | All thread and row borders universally |
| Navigation | `navAccent` | All navigation elements universally (file trees, article lists, edge links, any future nav) → `accent-dim` |
| Chat Bubble | `chatBubbleChrome` | All message bubble backgrounds universally → `chrome-accent` |
| Cards | `tints.cards` | All card surfaces universally (tickets, wiki topics, etc.) → accent-tinted surfaces |
| Left Panel | `tints.leftPanel` | Left sidebar background tint universally |
| Right Panel | `tints.rightPanel` | Right column background tint universally |

### Semantic Variable Reference

Never use the raw theme color (`--theme-primary`) for UI chrome. The chrome sliders (`chromeLuminance`, `chromeTint`, `accentLuminance`, `accentTint`) exist so the user can adjust how the main color appears on interactive elements. Use the processed semantic variables instead:

| Element type | Variable | What the slider controls |
|--------------|----------|--------------------------|
| Section titles, active labels, primary buttons, selected states | `--accent-dim` | `accentLuminance` / `accentTint` |
| Inactive icons, secondary badges, dimmed chrome | `--chrome-accent` | `chromeLuminance` / `chromeTint` |
| Body text, paragraphs, descriptions | `--text-primary`, `--text-secondary` | `luminance` (via global text contrast) |
| Panel/card surfaces | `--surface-elevated`, `--surface-hover` | `panelContrast` / `bgTint` |
| Document/code surfaces | `--document-surface-bg`, `--document-bg` | `contentLuminance` / `contentContrast` |
| Borders, dividers, hairlines | `--border-subtle`, `--border-focus` | `borderLuminance` / `borderTint` |

**The rule:** if the element is chrome (title, label, icon, button, badge, nav link), target `--chrome-accent` or `--accent-dim`. If it is body text, target `--text-*`. Only decorative accents that must match the raw brand color regardless of slider settings may use `--theme-primary`.

**How it works:** The theme service reads the active theme, generates CSS variables, and the client sets `body[data-tint-*="true"]` attributes on `<body>`. Global CSS (`ai/settings/tints.css`) defines what changes under each attribute across the entire workspace. Per-view CSS does not participate in color, border, or surface changes.

---

## State System (Per-View)

State is resolved per-view. The system merges a **workspace default** with an optional **per-view override**.

- Workspace default: `ai/settings/state.json`
- Per-view override: `ai/views/{viewer}/settings/state.json`

If a per-view override file exists and contains a key, that value wins. Otherwise, the workspace default is used. The writer never creates per-view override files — only humans do.

### What Belongs in State
- `widths.leftSidebar`, `widths.leftChat`, `widths.rightCol`, `widths.rightSecondary`
- `collapsed.leftSidebar`, `collapsed.leftChat`
- `popup.x`, `popup.y`, `popup.width`, `popup.height`, `popup.open`, `popup.threadId`
- `currentThreadId`, `secondaryThreadId`

### What Does NOT Belong in State
- Any tint boolean (see Theme Toggles above)
- Any color, background, or border value
- Any slider value

If you find a tint, color, or slider in a per-view state file, it is a bug. Move it to `themes.json`.

---

## CSS Architecture

### Global CSS (`ai/settings/`)
These files are loaded once per workspace switch and apply everywhere:

- `ai/settings/themes.json` — canonical source of truth for all themes. The active theme has `"active": true`.
- `ai/settings/themes.css` — generated from `themes.json`, never hand-edited. Contains `:root` CSS variables.
- `ai/settings/tints.css` — static global tint rules (selector catalog), hand-edited. Defines all color, border, and background responses to `body[data-tint-*]` universally across every view.
- `ai/settings/views.css` — global view chrome (chat, sidebar, thread list)
- `ai/settings/components.css` — global component styles
- `ai/settings/variables.css` — CSS variable defaults (fallbacks when themes.css hasn't loaded yet)
- `ai/settings/cli.json` — CLI config (names, icons, accent colors, enabled/disabled)
- `ai/settings/state.json` — workspace default state (widths, collapsed, popup, thread IDs)

### Per-View CSS (`ai/views/{viewer}/settings/`)
Each view folder may contain layout CSS for geometry-specific rules:
- `ai/views/wiki-viewer/settings/layout.css`
- `ai/views/issues-viewer/settings/layout.css`
- `ai/views/agents-viewer/settings/layout.css`
- `ai/views/doc-viewer/settings/layout.css`
- `ai/views/file-viewer/settings/layout.css`

These files handle layout only: widths, heights, flex/grid structure, visibility, and positioning. They never define colors, borders, backgrounds, or respond to `body[data-tint-*]` for styling changes. All color and surface styling flows from global CSS.

### Per-View State (`ai/views/{viewer}/settings/state.json`)
Optional per-view state overrides. If present, keys here win over the workspace default in `ai/settings/state.json`.

### Manual Overrides
A human may drop a CSS file into a view's `settings/` folder to override a specific element for that view only. This is manual, intentional, and never done by AI agents programmatically. Example: a user wants ticket cards in the agent view to use a different hover color — they edit `ai/views/agents-viewer/settings/custom.css`.

---

## AI Agent Constraints

1. **Never write tint values to per-view state.** Tints are theme properties.
2. **Never generate per-view CSS programmatically.** Per-view CSS overrides are human-only.
3. **When adding a new toggle, add it to `ThemeEntry` and `themes.json`.** It becomes a theme property, not a state property.
4. **CSS rules for new toggles go in the global tint catalog** (`ai/settings/tints.css`), not scattered across view files.
5. **Global CSS defines all tint targeting.** Per-view CSS never scopes rules to `body[data-tint-*]`.
6. **Global files live in `ai/settings/`.** Per-view files live in `ai/views/{viewer}/settings/`. Never put global files in `ai/views/settings/` — that folder no longer exists.

---

## Common Mistakes

| Mistake | Why It's Wrong | Correct Approach |
|---------|---------------|----------------|
| Storing `contentPanels` in a per-view `state.json` | Tints are styles, not layout | Store in `themes.json` active theme |
| Applying `data-tint-*` per `.rv-panel` | Toggles should be workspace-wide | Apply to `<body>` once |
| Scoping tint CSS to `.rv-panel[data-tint-*]` | Breaks when switching views | Scope to `body[data-tint-*]` |
| Creating a new slider and wiring it to `--bg-solid` | Sliders should target semantic variables | Target `--sidebar-surface-bg`, `--document-surface-bg`, etc. |
| Using `contentContrast` to compute background spread | Content contrast is for syntax tokens only | Use `panelContrast` for background spread |
| Using `--theme-primary` for UI chrome (titles, labels, icons, buttons) | Bypasses the chrome sliders; user loses control of tinting | Use `--accent-dim` for active/primary chrome, `--chrome-accent` for inactive/secondary chrome |
| Putting color rules in `ai/views/{viewer}/settings/layout.css` | Per-view CSS is layout-only | Colors go in `ai/settings/tints.css` |
| Hardcoding a path like `ai/views/settings/themes.css` in the server | Global settings belong at `ai/settings/` | Use `ai/settings/` for global files |
| Referencing `ai/views/settings/` at all | That folder was deleted in the refactor | All global files are in `ai/settings/` |
| Loading `variables.css` after `themes.css` | Fallbacks override the active theme on refresh | Inject `variables` → `themes` → `components` → `views` → `tints` |
| Forgetting `contentPanels` in default tint objects | Toggle is `undefined` before state loads, causing missing attributes | Include `contentPanels: false` in both client and server defaults |

---

## Quick Reference: Where to Put Things

| Want to change... | File |
|-------------------|------|
| A color slider or toggle | `ai/settings/themes.json` → theme service regenerates `ai/settings/themes.css` |
| What elements respond to a toggle | `ai/settings/tints.css` (global selector catalog) |
| A pane width or collapse state | `ai/views/{viewer}/settings/state.json` (per-view) or `ai/settings/state.json` (workspace default) |
| A layout specific to one view | `ai/views/{viewer}/settings/layout.css` |
| A one-off override for one view | Manual CSS drop in that view's `settings/` folder |
| CLI names, icons, or accent colors | `ai/settings/cli.json` |
