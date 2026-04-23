# Theme Picker — Spec

**Status:** Draft — ready for handoff.
**Owner:** Open Robin core.
**Precedes implementation of:** the header color-picker button + the file-write pipeline.
**Depends on:**
- `docs/TOKEN_CONTRACT_SPEC.md` — defines the editable token surface and the slug schema.
- `ai/views/settings/themes.json` — the 59-slug builtin catalog (already exists).
- `ai/views/settings/themes.css` — generated output file (already exists).
- `useSharedWorkspaceStyles` + `resetSharedStyles()` — already wired for runtime CSS reload.
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

Wire the theme catalog (`themes.json`) to a header UI so the user can switch, create, and delete workspace themes without touching files directly. Any change immediately regenerates `themes.css` and broadcasts a live reload to every open client.

**What "a theme" means in this spec:**
A JSON entry in `ai/views/settings/themes.json` — one accent color, a luminance level, optional border/card intensity defaults, a human-readable label. See TOKEN_CONTRACT_SPEC §6 for the full schema.

**What "applying a theme" means:**
Server marks the chosen entry `"active": true`, regenerates `themes.css` from its values, and every connected client hot-reloads their shared styles.

---

## 2. Non-goals

- **No SQLite.** Storage is `themes.json` only — consistent with state.json/cli.json.
- **No preview mode in v1.** Activating a theme commits it immediately. Preview (hover to see, click to commit) can be a v2 addition.
- **No per-view picker.** The picker writes the workspace-level theme. Per-view overrides are a power-user file-drop (already wired); the picker doesn't touch them.
- **No Robin-overlay theme panel removal in this spec.** That's a follow-up cleanup once the picker ships and users have migrated. No breakage either way — both surfaces write the same file.
- **No typography or animation surface.** The picker edits only the tokens in TOKEN_CONTRACT §4 (accent + chrome fills). Font/transition control is a separate future spec.
- **No syntax-theme picker.** That's a separate `syntax-themes.json` catalog, separate spec.

---

## 3. UI

### 3a. Header button

A small circular swatch in `rv-header-right`, placed between the existing Robin button and the edge. The swatch fill reflects the current `--theme-primary` so it's immediately recognisable as "what theme am I on."

```
[☰ Connected]              [stack] [raven] [●]
                                            ↑
                                  swatch — current accent
```

Clicking the swatch toggles the picker popover. Keyboard: `Escape` closes it.

### 3b. Picker popover

Anchored to the swatch button. Width: 320px. Structure top-to-bottom:

```
┌─────────────────────────────────────────┐
│  ●● ●● ●● ●● ●● ●●   ← brand presets   │
│  ●● ●● ●● ●● ●● ●●                     │
│  ── ── ── ── ── ──   ← custom slots    │
│  [🎨] [#00d4ff     ] [🔖]              │
│  ━━━━━━━━━━━━━━━━━━  Luminance 10%     │
│  ━━━━━━━━━━━━━━━━━━  Chrome tint 12%   │
│  ━━━━━━━━━━━━━━━━━━  Border accent 0%  │
│  ━━━━━━━━━━━━━━━━━━  Card highlights 0%│
│              [Save as new]  [Apply]     │
└─────────────────────────────────────────┘
```

**Preset chips:** one chip per `themes.json` entry, ordered as in the file (builtins first, then user-created). Active theme has a white border ring. Hovering shows a tooltip with the theme label. Clicking activates immediately (no confirm).

**Custom slots:** 6 empty dashed slots. The `[🔖]` button next to the hex input saves the current accent+settings into the next empty slot. Filled slots are clickable (select) and show a `×` on hover (remove). Persisted to `localStorage` under `theme-picker-custom-slots` — client-side only (not part of `themes.json` unless explicitly saved).

**Sliders:** luminance (0-100), chrome tint (0-30), border accent (0-100), card highlights (0-100). Sliders update the live preview of the workspace behind the popover as they're dragged.

**"Apply":** activates the current swatch + slider state as the theme. If no named slug matches exactly, generates an anonymous theme, applies it, and leaves the save dialog available.

**"Save as new":** prompts for a label, writes a new entry to `themes.json` with `"builtin": false`, activates it.

### 3c. Per-view indicator

A subtle `stack` icon (already in the mockup) in the header signals when the currently-active view has a `settings/themes.css` override file. Tooltip: "This view has a local theme override." Clicking it does nothing in v1 — it's informational. Future: clicking opens the per-view themes.css in the file editor.

---

## 4. WebSocket message protocol

All messages are standard request-response over the existing WS connection.

### 4a. `theme:list` (C → S)

```json
{ "type": "theme:list" }
```

Server responds immediately with `theme:state`.

### 4b. `theme:state` (S → C)

Sent in response to `theme:list`, and broadcast to all clients after any mutation.

```json
{
  "type":     "theme:state",
  "themes":   [...],           // full ThemeEntry[] in file order
  "activeId": "tron"           // id of the entry with active: true, or null
}
```

Client hydrates `panelStore.themes` + `panelStore.activeThemeId` and calls `resetSharedStyles()` to reload `themes.css`.

### 4c. `theme:activate` (C → S)

```json
{ "type": "theme:activate", "id": "tron" }
```

Server: sets `"active": true` on the entry, clears all others, regenerates `themes.css`, writes both files, broadcasts `theme:state`. Responds with `theme:state` to the requesting client (same as broadcast — one message covers both).

Error if `id` not found: server sends `theme:error { message }` to the requesting client only.

### 4d. `theme:save` (C → S)

```json
{
  "type": "theme:save",
  "theme": {
    "id":        "my-warm",
    "label":     "Warm Night",
    "accent":    "#ff6600",
    "luminance": 8,
    "borders":   30,
    "cards":     15,
    "builtin":   false
  }
}
```

Server: upserts the entry (insert if id not found, replace-in-place if found). `builtin` is always forced `false` on save — the picker cannot overwrite a builtin. After upsert, if the saved theme's `id` matches the currently active theme, regenerate `themes.css` and broadcast. Otherwise just broadcast `theme:state` with the updated catalog.

### 4e. `theme:delete` (C → S)

```json
{ "type": "theme:delete", "id": "my-warm" }
```

Server: rejects if `builtin: true` (responds with `theme:error`). Otherwise removes entry from `themes.json`. If the deleted theme was active, activates the first builtin instead (OLED Black or whatever is first in file order), regenerates `themes.css`. Broadcasts `theme:state`.

### 4f. `theme:error` (S → C)

```json
{ "type": "theme:error", "message": "Cannot delete a builtin theme." }
```

Sent to the requesting client only. The picker surfaces this as an inline error message.

---

## 5. Server

### 5a. `lib/theme/themes-service.js` (new)

One job: read/write `themes.json` and regenerate `themes.css`. All file operations are atomic (tmp + rename).

```js
// Public API
async function list(projectRoot)
  // → ThemeEntry[]

async function activate(projectRoot, id)
  // Sets active:true on id, clears others, regenerates themes.css
  // → ThemeEntry[] (updated list)

async function save(projectRoot, entry)
  // Upserts entry (builtin forced false). Regenerates themes.css if it was active.
  // → ThemeEntry[] (updated list)

async function deleteTheme(projectRoot, id)
  // Rejects builtins. Falls back to first builtin if active deleted.
  // → ThemeEntry[]

async function generateCss(projectRoot, id)
  // Reads the active slug, writes themes.css
  // → void

function renderSlugToCss(entry)
  // Pure: entry → CSS string. Used by generateCss and tests.
  // → string
```

**`renderSlugToCss` derivation** (mirrors TOKEN_CONTRACT §6):

```js
function renderSlugToCss({ accent, luminance, borders = 0, cards = 0 }) {
  const [r, g, b] = hexToRgb(accent);
  const floor = luminanceToHex(luminance); // hsl(0, 0, L%) → hex
  return `/* Generated by THEME_PICKER_SPEC. Do not edit — re-generated on theme switch. */
:root {
  --theme-primary:      ${accent};
  --theme-primary-rgb:  ${r}, ${g}, ${b};
  --theme-border:       rgba(${r}, ${g}, ${b}, 0.38);
  --theme-border-glow:  rgba(${r}, ${g}, ${b}, 0.68);
  --ws-primary:         var(--theme-primary);
  --ws-primary-rgb:     var(--theme-primary-rgb);

  --ws-sidebar-bg:   color-mix(in srgb, ${floor} 92%, ${accent} 8%);
  --ws-content-bg:   color-mix(in srgb, ${floor} 96%, ${accent} 4%);
  --ws-panel-border: rgba(${r}, ${g}, ${b}, 0.20);
}`;
}
```

`borders` and `cards` from the slug are **not written to themes.css** — they are picker UI defaults (how far to initialise the sliders), not CSS tokens. The picker reads them when loading a theme and positions the sliders; they don't feed any CSS variable. The border/card intensity the user actually drags to is applied as `data-tint-*` attributes by `PanelWrapper` (already wired by TINTS_SPEC).

### 5b. WS message router

Add handlers to `open-robin-server/lib/ws/client-message-router.js`:

```js
if (msg.type === 'theme:list')     handleThemeList(ws, session, projectRoot);
if (msg.type === 'theme:activate') handleThemeActivate(ws, session, projectRoot, msg);
if (msg.type === 'theme:save')     handleThemeSave(ws, session, projectRoot, msg);
if (msg.type === 'theme:delete')   handleThemeDelete(ws, session, projectRoot, msg);
```

Each handler calls the service, then broadcasts `theme:state` to all clients via the existing `getAllClients()` helper. Any error sends `theme:error` to the requesting socket only.

### 5c. Startup

On server start (after `workspaceController.start()`), ensure the active theme's `themes.css` is current:

```js
const themesService = require('./lib/theme/themes-service');
const themes = await themesService.list(projectRoot);
const active = themes.find(t => t.active);
if (active) await themesService.generateCss(projectRoot, active.id);
```

This re-derives `themes.css` from `themes.json` on every boot, so the CSS is never stale even if someone edited `themes.json` directly while the server was down.

### 5d. `workspace:init` extension

Include the theme catalog in the workspace-init payload so clients get the full list without a separate `theme:list` round-trip:

```json
{
  "type":     "workspace:init",
  "themes":   [...],
  "activeThemeId": "tron",
  ...existing fields...
}
```

---

## 6. Client

### 6a. Store (`panelStore.ts`)

```ts
// New slots
themes:          ThemeEntry[];
activeThemeId:   string | null;
hydrateThemes:   (themes: ThemeEntry[], activeId: string | null) => void;
activateTheme:   (id: string) => void;    // sends theme:activate + optimistic local update
saveTheme:       (entry: ThemePartial) => void;
deleteTheme:     (id: string) => void;
```

`activateTheme` sets `activeThemeId` optimistically and sends the WS message. On `theme:state` broadcast, the full list is re-hydrated. If the optimistic id doesn't match the server's response (error case), the store self-corrects on the broadcast.

### 6b. WS handler (`lib/ws/theme-handlers.ts`, new)

```ts
export function handleThemeMessage(msg: WSMessage) {
  if (msg.type === 'theme:state') {
    usePanelStore.getState().hydrateThemes(msg.themes, msg.activeId);
    resetSharedStyles(); // re-fetches themes.css from the server
  }
  if (msg.type === 'theme:error') {
    showToast(msg.message);
  }
}
```

Called from the existing WS message dispatcher.

### 6c. `workspace:init` handler

Extend the existing workspace-init handler to also call `hydrateThemes(payload.themes, payload.activeThemeId)`. No extra round-trip needed.

### 6d. Components (new)

**`ThemePickerButton.tsx`** — the swatch in the header. Reads `activeThemeId` + `themes` from the store to derive the current accent. Renders a circular swatch. Clicking toggles the popover.

**`ThemePicker.tsx`** — the popover. Full implementation matches the popover variant in `ai/views/doc-viewer/content/playground/theme-picker-mockup.html`. Internal state: dragged slider values (not committed until "Apply"). Committed values (`theme:activate`, `theme:save`) flow through the store actions.

**`ThemePickerButton` placement:** inside the existing `<header>` in `App.tsx`, in `rv-header-right`:

```tsx
<div className="rv-header-right">
  <ThemePickerButton />
  <button className="rv-robin-icon-btn" onClick={...}>
    <span className="material-symbols-outlined">raven</span>
  </button>
</div>
```

### 6e. `ThemeEntry` type (`types/index.ts`)

```ts
export interface ThemeEntry {
  id:         string;
  label:      string;
  accent:     string;         // hex #RRGGBB
  luminance:  number;         // 0-100
  borders?:   number;         // 0-100 slider default; default 0
  cards?:     number;         // 0-100 slider default; default 0
  builtin:    boolean;
  active:     boolean;
}
```

---

## 7. Slider state vs theme fields

The four sliders in the picker (luminance, chrome tint, border accent, card highlights) are **session state**, not persisted unless the user explicitly saves.

| Slider | Initialised from | Persisted where |
|--------|-----------------|-----------------|
| Luminance | `theme.luminance` on activation | `theme.luminance` in `themes.json` on save |
| Chrome tint | 12% (app default) | (future: add `tint` field to slug schema) |
| Border accent | `theme.borders ?? 0` | `theme.borders` in `themes.json` on save |
| Card highlights | `theme.cards ?? 0` | `theme.cards` in `themes.json` on save |

**Chrome tint is intentionally not in the slug schema in v1.** It controls how much the accent bleeds into the chrome neutrals — defaults to 12% for all themes, user drags to taste, not persisted per-theme. Add `"tint"` to the slug schema in a follow-up if usage data suggests per-theme tint defaults are valuable.

---

## 8. `themes.json` read/write atomics

The service reads the full file into memory, mutates the array, writes tmp → rename. Concurrency is low (one user) so no locking needed. Both `themes.json` and `themes.css` are written in sequence; if the CSS write fails, `themes.json` remains updated (the CSS can be regenerated on next boot — see §5c).

```js
async function writeThemesJson(projectRoot, themes) {
  const file = path.join(projectRoot, 'ai', 'views', 'settings', 'themes.json');
  const tmp  = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify({ version: '1.0', themes }, null, 2));
  await fs.rename(tmp, file);
}
```

---

## 9. Files changed

| File | Action |
|------|--------|
| `open-robin-server/lib/theme/themes-service.js` | new — list, activate, save, delete, generateCss, renderSlugToCss |
| `open-robin-server/lib/ws/client-message-router.js` | add 4 handlers (theme:list/activate/save/delete) |
| `open-robin-server/lib/ws/theme-handlers.js` | new — thin WS adapter calling the service |
| `open-robin-server/lib/startup.js` | ensure themes.css current on boot (§5c) |
| `open-robin-server/server.js` | add `themes` + `activeThemeId` to workspace:init payload |
| `open-robin-client/src/types/index.ts` | add `ThemeEntry`; add 4 WS message types |
| `open-robin-client/src/state/panelStore.ts` | add `themes`, `activeThemeId`, store actions |
| `open-robin-client/src/lib/ws/theme-handlers.ts` | new — handles `theme:state` + `theme:error` |
| `open-robin-client/src/lib/ws-client.ts` | dispatch to theme-handlers |
| `open-robin-client/src/lib/ws/workspace-handlers.ts` | hydrate themes from `workspace:init` |
| `open-robin-client/src/components/ThemePickerButton.tsx` | new |
| `open-robin-client/src/components/ThemePicker.tsx` | new |
| `open-robin-client/src/components/App.tsx` | add `<ThemePickerButton />` to header |
| `open-robin-client/src/components/App.css` | swatch button styles |

No migrations. No new DB tables. `ai/views/settings/themes.json` and `themes.css` already exist.

---

## 10. Rollout

Each step is independently committable. Steps 1-3 are server-only and the client continues working (no regression). Steps 4-6 add the UI.

1. **`themes-service.js` + unit tests** — `renderSlugToCss` is a pure function, easy to test. `list/activate/save/delete` can be exercised with a temp dir fixture.
2. **Router handlers + startup boot** — server handles the four WS message types; `workspace:init` extended.
3. **Verify server** — manually send `theme:activate { id: "tron" }` via a WS test tool; confirm `themes.json` updates + `themes.css` is regenerated.
4. **Client store + WS handler + workspace-init hydration** — store slots populated; `theme:state` handler calls `resetSharedStyles()`. No visible UI yet; themes persist across refresh because CSS is regenerated on boot.
5. **`ThemePickerButton` + `ThemePicker`** — the header swatch and popover. Wired to store actions.
6. **Smoke test** (see §11).
7. **Optional cleanup** — remove theme section from Robin overlay (superseded; left until user confirms they're happy with the picker).

---

## 11. Acceptance

- Server starts; `themes.css` is regenerated from the active slug in `themes.json` even if the file was hand-edited while the server was down.
- Client connects; `workspace:init` includes `themes` + `activeThemeId`; the store is hydrated.
- User clicks the swatch in the header; popover opens showing all 59 builtin chips + 6 custom slots.
- Hovering a chip shows the theme label in a tooltip.
- Clicking a chip (`tron`): `themes.json` updates (`"active": true` on tron), `themes.css` regenerates with `#00e5ff` accent and electric-blue-border derivations, WS broadcast fires, CSS hot-reloads. Every surface picks up the new theme without a page refresh.
- Border accent slider defaults to 85% when Tron is activated (from `theme.borders: 85`).
- User edits hex to `#ff0000`, clicks "Save as new", types "Red Alert" as label: a new entry `{ "id": "red-alert", "label": "Red Alert", "builtin": false, ... }` appears in `themes.json`; it shows up in the picker's chip grid.
- User clicks the `×` on "Red Alert" → entry removed from `themes.json`, first builtin activated.
- User attempts to delete a builtin → `theme:error` → toast "Cannot delete a builtin theme."
- Manually adding an entry to `themes.json` + server restart → entry appears in the picker.
- `tsc -b --noEmit` passes. `npm run build` passes. Server starts without warnings.

---

## 12. Open questions

1. **Tint field in slug schema.** Chrome tint (how much accent bleeds into chrome greys) defaults to 12% for all themes in v1. If a theme like Tron feels better at 0% tint (pure blacks with only the border lines), adding `"tint": 0` to the slug would snap the slider there on activation. Low cost — add to schema and `renderSlugToCss` skips it (it's a UI slider default, not a CSS token). Recommended for v1.5 after observing which themes need it.
2. **Preview on hover.** Hovering a chip previews the accent in the swatch button + behind the popover without committing. Requires a temporary `--theme-primary` override on the document root, removed on mouse-leave. Nice UX but adds complexity; defer to v2.
3. **Order of slugs in the picker.** Currently: OLED Black, Tron first, then alphabetical by id. Could group: dark themes → light themes → custom. The `luminance` field makes this trivial. Defer until the picker ships and we see how the grid reads.
4. **Robin overlay theme section.** Currently exists; after the picker ships, it becomes redundant. Remove it in a cleanup commit once the user confirms the picker covers the use case.
5. **Custom slot persistence.** The 6 custom hex slots in the popover are persisted to `localStorage` in v1 (client-only). If the user switches browsers or machines, they're lost. Moving them to `themes.json` as `"builtin": false` entries would make them workspace-portable. Simple enough to do from day 1 — just write them as entries on every "bookmark" click. Recommended.

---

/Users/rccurtrightjr./projects/open-robin/docs/THEME_PICKER_SPEC.md
