# Custom Theme CSS

This page is a recipe for an AI agent helping a user fully customize Open
Robin's appearance with a hand-written CSS file. It bypasses the slider
system entirely — useful when the user wants exact colors, custom borders,
brand alignment, or anything the sliders can't express.

> **Scope:** end-user customization only. For changes to *how* themes work
> (variable contracts, generator math, scoping rules), the binding doc is
> [Themes-And-State](../enforcement/themes-and-state) under Enforcement.
> That page constrains the code; this page describes a user workflow.

---

## What the sliders actually do

The picker exposes five slider groups. They all write to the active theme in
`ai/settings/themes.json` and trigger a regeneration of `ai/settings/themes.css`
on the server. The generator is in `open-robin-server/lib/theme/`.

| Group (picker label) | Sliders / toggles | Variables emitted |
|---|---|---|
| **Panel** | Background Contrast, Luminance, Tint | `--bg-solid`, `--bg-primary`, `--bg-secondary`, `--sidebar-surface-bg`, `--chat-surface-bg`, `--panel-chrome-bg`, `--neutral-chrome-bg`, `--panel-bg`, `--text-dim` (tinted) |
| **Content** | Content Contrast, Luminance, Tint, **Theme code** toggle | `--document-bg`, `--document-surface-bg`, `--hljs-*`, `--hljs-md-*`, `--content-attenuated`, `--content-emphasized`, `--content-link`, `--content-border`, `--content-highlight` |
| **Border** | Luminance, Tint | `--neutral-chrome-border`, `--border-color`, `--file-viewer-chrome-border`, `--component-border` |
| **Accent** *(picker label — variable family is `--chrome-*`)* | Luminance, Tint, **Chat bubble** toggle | `--chrome-accent`, `--cli-accent`, `--tile-color`, `--chat-bubble-bg`, `--chat-bubble-fg`, `--chrome-accent-fg` |
| **Chrome** *(picker label — variable family is `--accent-*`)* | Luminance, Tint | `--accent-dim`, `--icon-dim`, `--nav-icon-color`, `--nav-text-color` |

Plus accent color (single hex) and Light/Dark Mode toggle. The light/dark mode
clamps the panel and content luminance ranges.

The generator math lives in:

- `open-robin-server/lib/theme/color-math.js` — primitives, surface and content
  derivations, syntax palette, content-emphasized/link/border helpers.
- `open-robin-server/lib/theme/{panel,content,text,border,accent,workspace,syntax}-css.js`
  — fragment generators that emit blocks of `:root` rules.
- `open-robin-server/lib/theme/theme-css-generator.js` — concatenates fragments
  into the final `:root` block of `themes.css`.

When a slider moves, the client also writes the same derivations live via
`open-robin-client/src/lib/theme/live-preview.ts` so the user sees changes
without waiting for the round trip.

---

## How CSS reaches the browser

`useSharedWorkspaceStyles` in the client loads a fixed sequence of files
from `ai/settings/` over WebSocket and injects them into `<head>`. Order is
load-bearing — later layers can override earlier ones:

1. `variables.css` — fallback defaults for every theme variable.
2. `themes.css` — the active theme, generated from `themes.json`.
3. `components.css` — global component styles.
4. `views.css` — global view chrome (chat, sidebar, threads list, etc.).
5. `file-viewer.css` — file-viewer color layer.
6. `doc-viewer.css` — doc-viewer color layer.
7. `tints.css` — `body[data-tint-*]` toggle catalog (last so toggles win).

**This list is the cascade order.** Anything in a later file overrides the
earlier files for the same selector + property.

---

## Recipe: drop in a fully-custom theme without touching sliders

The user has a specific palette in mind. They don't want to fight the slider
math. The clean workflow:

### 1. Author a new CSS file under `ai/settings/`

Name it after the intent — `custom-noir.css`, `user-warm.css`, etc. Two valid
shapes, both supported:

**Shape A: override CSS variables only.** Keep the cascade clean — the
existing `views.css`, `tints.css`, etc. consume your variables.

```css
/* ai/settings/custom-noir.css — example */
:root {
  --bg-solid:           #0a0a0a;
  --bg-primary:         #0a0a0a;
  --bg-secondary:       #161616;
  --sidebar-surface-bg: #0f0f0f;
  --chat-surface-bg:    #0f0f0f;
  --document-bg:        #1a1a1a;
  --document-surface-bg:#1d1d1d;

  --text-primary:       #f5f5f5;
  --text-dim:           #888;
  --text-secondary:     #b0b0b0;

  --neutral-chrome-border: #2a2a2a;
  --border-color:          #2a2a2a;

  --theme-primary:      #c97cf6;
  --chrome-accent:      #b264e0;
  --accent-dim:         #5a5a5a;

  --content-emphasized: #d8b4ff;
  --content-link:       #ffb3ff;
  --content-highlight:  rgba(216, 180, 255, 0.16);
}
```

**Shape B: full takeover.** Override variables AND specific selectors. Use
this when the user wants behavior that the variable contract can't express
(e.g., a different chat-message border, custom font on h1, gradient panels).
Just make sure your selectors match what's already in the codebase — see
the cascade order above.

### 2. Register the new file in the loader

Edit `open-robin-client/src/lib/panels.ts` to add a constant:

```ts
export const SETTINGS_STYLES_CUSTOM_NOIR = 'custom-noir.css' as const;
```

Then add the layer in `open-robin-client/src/hooks/useSharedWorkspaceStyles.ts`
to its `SHARED_LAYERS` array. **Order matters** — for a full takeover, place
your file AFTER `themes.css` so it overrides; for a baseline-with-toggles,
place it BEFORE `tints.css` so tint toggles still apply on top.

```ts
{ id: 'custom-noir', path: SETTINGS_STYLES_CUSTOM_NOIR, fetcher: 'settings' },
```

### 3. Archive the file the user is replacing (manual step today)

If the user is swapping in a custom theme to replace an existing one:
move the prior file into an `ai/settings/_archive/` folder with a date
suffix. Example: `themes.css` (when replaced wholesale) becomes
`_archive/themes.2026-05-03.css`. The loader doesn't load `_archive/`,
so the file is preserved without affecting the cascade. **Today this is
manual** — see the TODO list below for the planned auto-archive.

### 4. Refresh

Today, the new file shows up after the next workspace switch or a hard
reload. **Today this is manual** — see the TODO list below for hot-reload.

---

## How the cascade reacts to file changes

Two things happen:

- **Slider edits** call `theme:save` over WebSocket → server rewrites
  `themes.json`, regenerates `themes.css`, sends `theme:state` back. Client's
  `theme-handlers.ts` catches it and calls `reloadThemesLayer`, which atomically
  swaps just the `themes.css` `<style>` tag. Other layers (variables, components,
  views, file-viewer, doc-viewer, tints, anything you added) stay mounted.
- **File drops in `ai/settings/`** are *not* watched today. The loader fetches
  each layer once per workspace switch. Adding a new file requires either
  registering it in `SHARED_LAYERS` (so it joins the next reload) and refreshing,
  or hot-swapping a file the loader already knows about (themes/variables/views/
  components/tints/file-viewer/doc-viewer).

---

## TODOs

These are open items relevant to this workflow. Wire them up when you get
asked, or surface them when the user expresses pain that one of these would
have prevented.

- [ ] **Hot-reload on settings file drop.** Watch `ai/settings/` (server-side
      `chokidar` or fs.watch); on change, push a `settings:reloaded` WS message
      keyed to the changed file, and have the client re-fetch + atomically swap
      the corresponding `<style>` tag (mirror what `reloadThemesLayer` does for
      `themes.css`). For files not yet in `SHARED_LAYERS`, push a discovery
      message and append a new layer dynamically.
- [ ] **Auto-archive for replaced settings files.** When a settings file is
      written or replaced (whether by the slider system or a user/agent edit),
      move the prior version to `ai/settings/_archive/<name>.<ISO-date>.css`.
      Simple versioning: keep last N versions per file (default N=5), oldest
      auto-pruned. Surface the archive in the UI as "previous theme files"
      so the user can roll back without touching the filesystem. The
      `themes.json.bak` and `state.json.bak` we drop today are a precursor;
      generalize them into a real archive subdirectory.

---

## Where this differs from `enforcement/themes-and-state`

| | This page (System Tools / Custom Theme CSS) | Enforcement / Themes-And-State |
|---|---|---|
| Audience | An AI agent helping a user customize the app | An AI agent writing/changing app code |
| Scope | Drop a CSS file, edit JSON | Variable contract, file boundaries, write rules |
| Authority | Recipe (followed when user asks) | Constraint (enforced on every change) |

If the user is asking *"how do I make my app look the way I want?"* — this
page. If you're being asked to *modify the theming system itself* — that's
`enforcement/themes-and-state`. The two never override each other; this page
is downstream of those rules.
