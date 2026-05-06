# SPEC-27: Move Tints from State System to Theme System

**Status:** Draft — awaiting chunking and scheduling
**Scope:** Architecture refactor — no user-facing behavior changes
**Risk:** Medium — touches state persistence, theme generation, and UI across all views

---

## 1. Problem Statement

Tints (boolean toggles for visual surfaces: leftPanel, rightPanel, cards, contentPanels, borders.threads, borders.chat) are currently stored in `state.json` as per-view UI state and applied via `data-tint-*` attributes on `.rv-panel`.

This violates the project's design language: **tints are styles, not state**. State is layout geometry (widths, collapsed, popup position, current thread). Styles are colors, backgrounds, borders, tinting — everything in `themes.json`.

The per-view tint architecture causes:
- Toggles flip when switching views (each `.rv-panel` has its own `data-tint-*`)
- CSS rules are scoped to `.rv-panel[data-tint-*="true"]`, preventing universal application
- A `setTint(view, path, value)` action that writes per-view patches when the behavior should be workspace-wide
- Confusion between theme sliders (universal) and tint toggles (per-view but should be universal)

## 2. Target Architecture

```
themes.json (single workspace-wide source of truth)
├── accent, luminance, panelContrast, bgTint, etc.  (existing sliders)
└── tints: {                                       (moved from state.json)
      leftPanel:     boolean,
      rightPanel:    boolean,
      cards:         boolean,
      contentPanels: boolean,
      borders: {
        threads: boolean,
        chat:    boolean,
      }
    }

state.json (layout state only)
├── widths, collapsed, popup, currentThreadId, secondaryThreadId
└── (NO tints)
```

**CSS emission:**
- `theme-css-generator.js` emits a `:root` block AND a global tint rules block
- Global tint CSS lives in `ai/views/tints.css` (or injected into `themes.css`)
- Rules use `body[data-tint-*="true"]` selectors — universal, not per-panel
- View folders can override by dropping a CSS file with the same selectors

**Client store:**
- `panelStore.ts`: remove `tints` from `ViewUIState`, `DEFAULT_VIEW_UI_STATE`, `setTint`
- `panelStore.ts`: add `workspaceTints` or read from active theme directly
- ThemePicker toggles save to theme, not state

## 3. Files to Change

### Server-side (Node)

| File | Change |
|------|--------|
| `open-robin-server/lib/theme/themes-service.js` | Accept `tints` in theme save/activate; regenerate CSS on tint change |
| `open-robin-server/lib/theme/theme-css-generator.js` | Emit tint CSS rules (not just variables) |
| `open-robin-server/lib/theme/tint-css.js` | **NEW** — generate `body[data-tint-*="true"] .selector { ... }` rules from theme entry |
| `open-robin-server/lib/view-state/resolver.js` | Remove `tints` from `ViewUIState` shape resolution |
| `open-robin-server/lib/view-state/writer.js` | Remove tint leaf routing from `writeViewStatePatch` |

### Client-side (React/TypeScript)

| File | Change |
|------|--------|
| `open-robin-client/src/types/index.ts` | Remove `tints` from `ViewUIState`; add `tints` to `ThemeEntry` |
| `open-robin-client/src/state/panelStore.ts` | Remove `tints` from `DEFAULT_VIEW_UI_STATE`; remove `setTint`; remove `TintPath` |
| `open-robin-client/src/components/App.tsx` | Read tints from active theme, apply `data-tint-*` to `<body>` not `.rv-panel` |
| `open-robin-client/src/components/ThemePicker.tsx` | Tint toggles save to theme (not `setTint`); remove view-state tint reads |

### CSS

| File | Change |
|------|--------|
| `ai/views/tints.css` | **NEW** — global tint rules for all views |
| `open-robin-client/src/components/tickets/tickets.css` | Remove `.rv-panel[data-tint-*]` rules; add `body[data-tint-*]` overrides if needed |
| `open-robin-client/src/components/tile-row/tile-row.css` | Remove `.rv-panel[data-tint-*]` rules |
| `open-robin-client/src/components/wiki/wiki.css` | Remove `.rv-panel[data-tint-*]` rules |
| `ai/views/file-viewer/settings/layout.css` | Remove `.rv-panel[data-tint-*]` rules |
| `ai/views/settings/views.css` | Remove `.rv-panel[data-tint-*]` rules (chat borders, thread borders) |

### Data Migration

| File | Change |
|------|--------|
| `ai/views/settings/state.json` | Move `tints` object out into `ai/views/settings/themes.json` active theme |
| `ai/views/settings/themes.json` | Add `tints` block to every theme entry; default all false |

## 4. Detailed Design

### 4.1 Theme Entry Shape

```ts
export interface ThemeEntry {
  id: string;
  label: string;
  accent: string;
  luminance: number;
  panelContrast?: number;
  bgTint?: number;
  contentLuminance?: number;
  contentContrast?: number;
  contentTint?: number;
  borderLuminance?: number;
  borderTint?: number;
  chromeLuminance?: number;
  chromeTint?: number;
  accentLuminance?: number;
  accentTint?: number;
  chatBubbleChrome?: boolean;
  navAccent?: boolean;
  // NEW: moved from state.json
  tints?: {
    leftPanel?: boolean;
    rightPanel?: boolean;
    cards?: boolean;
    contentPanels?: boolean;
    borders?: {
      threads?: boolean;
      chat?: boolean;
    };
  };
  builtin: boolean;
  active: boolean;
}
```

### 4.2 tint-css.js (new server module)

```js
function render(entry) {
  const tints = entry.tints || {};
  const rules = [];

  if (tints.leftPanel) {
    rules.push('body[data-tint-left-panel="true"] .threads-sidebar { background: var(--sidebar-surface-bg); }');
    // ... actual selectors from current CSS
  }
  if (tints.contentPanels) {
    rules.push('body[data-tint-content-panels="true"] .rv-ticket-column { background: var(--sidebar-surface-bg); }');
    rules.push('body[data-tint-content-panels="true"] .rv-tile-grid { background: var(--sidebar-surface-bg); }');
    rules.push('body[data-tint-content-panels="true"] .file-explorer-empty { background: var(--sidebar-surface-bg); }');
    rules.push('body[data-tint-content-panels="true"] .file-explorer-main:empty { background: var(--sidebar-surface-bg); }');
  }
  // ... etc for each tint

  return rules.length ? `\n/* Tints */\n${rules.join('\n')}` : '';
}
```

**Alternative:** Instead of emitting rules from JS, emit a single block of conditional rules in a static `tints.css` file that uses CSS custom properties:

```css
/* ai/views/tints.css — static file, reads from :root variables set by theme */
body { --tint-content-panels: 0; }
body[data-tint-content-panels="true"] { --tint-content-panels: 1; }

.rv-ticket-column {
  background: var(--bg-solid);
}
body[data-tint-content-panels="true"] .rv-ticket-column {
  background: var(--sidebar-surface-bg);
}
```

This is cleaner — the JS only sets `data-tint-*` attributes (or CSS vars), and the CSS is static.

### 4.3 App.tsx Change

```tsx
// Read tints from active theme, not per-view state
const activeTheme = usePanelStore(s => s.themes.find(t => t.active));
const tints = activeTheme?.tints || DEFAULT_TINTS;

// Apply to body via effect (or render a BodyTints wrapper)
useEffect(() => {
  const body = document.body;
  body.setAttribute('data-tint-left-panel', tints.leftPanel ? 'true' : 'false');
  body.setAttribute('data-tint-right-panel', tints.rightPanel ? 'true' : 'false');
  body.setAttribute('data-tint-cards', tints.cards ? 'true' : 'false');
  body.setAttribute('data-tint-content-panels', tints.contentPanels ? 'true' : 'false');
  body.setAttribute('data-tint-border-threads', tints.borders?.threads ? 'true' : 'false');
  body.setAttribute('data-tint-border-chat', tints.borders?.chat ? 'true' : 'false');
}, [tints]);
```

### 4.4 ThemePicker Change

Tint toggles become theme properties (like `navAccent`, `chatBubbleChrome`):

```tsx
const [tints, setTints] = useState(activeTheme?.tints ?? DEFAULT_TINTS);

// In flushPending:
saveTheme({
  ...themeFields,
  tints: {
    leftPanel: tints.leftPanel,
    rightPanel: tints.rightPanel,
    cards: tints.cards,
    contentPanels: tints.contentPanels,
    borders: { threads: tints.borders.threads, chat: tints.borders.chat },
  },
});
```

## 5. Chunks

### Chunk A: Server — Theme Schema + CSS Generation
- Add `tints` to theme entry shape in `types/index.ts` (shared)
- Create `open-robin-server/lib/theme/tint-css.js`
- Wire into `theme-css-generator.js`
- Update `themes-service.js` to accept and persist `tints`
- Migrate existing `state.json` tints into `themes.json` active theme

### Chunk B: Client — Remove Tint State
- Remove `tints` from `ViewUIState`, `DEFAULT_VIEW_UI_STATE`
- Remove `TintPath` type, `setTint` action from `panelStore.ts`
- Remove `data-tint-*` per-panel attributes from `App.tsx`
- Add body-level tint attribute application (effect in App.tsx or new component)

### Chunk C: Client — ThemePicker Integration
- Move tint toggles from `setTint(currentPanel, ...)` to theme save flow
- Tint state becomes local state in ThemePicker (like sliders)
- Include `tints` in `flushPending` / `saveTheme` call

### Chunk D: CSS — Globalize Selectors
- Create `ai/views/tints.css` with all `body[data-tint-*]` rules
- Remove `.rv-panel[data-tint-*]` rules from:
  - `tickets.css`
  - `tile-row.css`
  - `wiki.css`
  - `layout.css`
  - `views.css`
- Verify no orphaned `data-tint-*` references in view CSS

### Chunk E: Verification
- Build client, restart server
- Verify toggles persist across view switches
- Verify workspace `state.json` no longer has `tints`
- Verify `themes.json` has `tints` in active theme

## 6. Gotchas

1. **Data migration:** `state.json` currently has `tints` at top level. On first boot after this change, the old `tints` in `state.json` must be migrated to the active theme in `themes.json`. The server should do this automatically or we do a one-time manual migration.

2. **Per-view override files:** Some views may have per-view override files with `tints` pinned. These overrides become irrelevant. The view-state resolver should ignore `tints` when merging.

3. **CSS specificity:** `body[data-tint-*="true"]` has lower specificity than `.rv-panel[data-tint-*="true"] .target`. Check that view-specific CSS overrides still work.

4. **ThemePicker live preview:** Tints applied to `<body>` via `useEffect` should update immediately when toggled, without waiting for server CSS regeneration. The `data-tint-*` attribute approach handles this naturally.

5. **Default values:** All tints default to `false` (neutral). Existing users with `tints.cards: true` or `tints.leftPanel: true` in `state.json` must have those values migrated to their active theme.

## 7. Open Questions

- Should `tints.css` be a static file (loaded once) or generated into `themes.css` (regenerated on theme switch)?
  - **Recommendation:** Static file at `ai/views/tints.css`. The selectors don't change; only the `data-tint-*` attributes on `<body>` change. Static file = simpler, no regeneration cost.

- Should we keep `data-tint-*` attributes or use a single CSS custom property?
  - **Recommendation:** Keep `data-tint-*` attributes. They are explicit, debuggable in DevTools, and map 1:1 to toggle names.

---

**Next step:** Chunk A can start immediately (server-side, no client deps). Chunks B–D require A to be complete. Chunk E verifies everything.
