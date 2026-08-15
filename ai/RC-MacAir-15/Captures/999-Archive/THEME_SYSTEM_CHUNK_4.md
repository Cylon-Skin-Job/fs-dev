# Chunk 4: Extract client live-preview.ts + fix drift

**From:** THEME_SYSTEM_REFACTOR_SPEC.md §5.4  
**Goal:** Move live-preview logic out of ThemePicker.tsx into its own module and align it exactly with server-generated CSS.  
**Parallel with:** Chunk 1 (color-math extraction) — both need `color-math.js`, no overlap otherwise.

---

## Context

`ThemePicker.tsx` is 474 lines and does four jobs:
1. React UI rendering
2. Live preview CSS injection
3. Debounced save orchestration
4. Color math (being removed in Chunk 1)

The live preview (`applyLivePreview`) writes CSS variables directly to `document.documentElement.style`. It should match the server `renderSlugToCss` output exactly, but it currently drifts in several text values:

| Token | Server (`renderSlugToCss`) | Client (`applyLivePreview`) |
|-------|---------------------------|----------------------------|
| `--text-white` (light) | `#1a1a1a` | `#000000` |
| `--text-primary` (light) | `#1a1a1a` | `#1a1a1a` |
| `--text-primary` (dark) | `#ffffff` | `#e0e0e0` |
| `--text-secondary` | `0.72` opacity | `0.66` opacity |
| `--text-dim` base | `0.60` / `0.65` | `0.6` / `0.6` |
| `--text-subtle` base | `0.45` / `0.45` | `0.4` / `0.4` |
| Text tint | `isLight ? bgTint*0.4 : bgTint` | `bgTint` directly |

This chunk extracts the live-preview logic and fixes all drift to match the server.

---

## Files to create

### `open-robin-client/src/lib/theme/live-preview.ts`

Move these from `ThemePicker.tsx`:
- `LIVE_PREVIEW_TOKENS` array
- `clearLivePreview()`
- `applyLivePreview()` — with fixes (see below)

**Fixes to apply in `applyLivePreview`:**

1. Use imported `clamp` from `color-math.js` (Chunk 1 creates this):
```ts
import { computeSyntaxPalette, clamp } from '../../../open-robin-server/lib/theme/color-math.js';
```

2. Remove local `clamp` definition inside `applyLivePreview`.

3. Update `lumToHex` to use imported `clamp`:
```ts
function lumToHex(l: number): string {
  l = clamp(l, 0, 100) / 100;
  const v = Math.round(l * 255);
  return '#' + [v,v,v].map(x => x.toString(16).padStart(2,'0')).join('');
}
```

4. Fix text hierarchy to match server exactly:
```ts
// BEFORE (client):
const textDBase = isLight ? 'rgba(0, 0, 0, 0.6)'  : 'rgba(255, 255, 255, 0.6)';
const textSBase = isLight ? 'rgba(0, 0, 0, 0.4)'  : 'rgba(255, 255, 255, 0.4)';
const textDim = bgTint > 0 ? ... : textDBase;  // uses bgTint directly

// AFTER (match server):
const textP     = isLight ? '#1a1a1a' : '#ffffff';
const textSec   = isLight ? 'rgba(0, 0, 0, 0.72)' : 'rgba(255, 255, 255, 0.72)';
const textDBase = isLight ? 'rgba(0, 0, 0, 0.60)' : 'rgba(255, 255, 255, 0.65)';
const textSBase = isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)';
const textTint  = isLight ? Math.round(bgTint * 0.4) : bgTint;
const textDim   = textTint > 0 ? ... : textDBase;
const textSubtle = textTint > 0 ? ... : textSBase;
```

5. Set `--text-white` and `--text-primary` to the same `textP` value:
```ts
root.setProperty('--text-white',     textP);
root.setProperty('--text-primary',   textP);
root.setProperty('--text-secondary', textSec);
root.setProperty('--text-dim',       textDim);
root.setProperty('--text-subtle',    textSubtle);
```

Keep `hexToRgb`, `mixHex`, and `lumToHex` in this file since they're local utilities.

### `open-robin-client/src/lib/theme/theme-api.ts`

Create a thin API wrapper for theme WebSocket calls:

```ts
// Send theme:save via the panel store's WS connection
export function saveTheme(theme: ThemeEntry): void {
  // Use the existing panel store or ws-client to send
}

export function activateTheme(id: string): void {
  // Send theme:activate
}

export function fetchThemes(): Promise<ThemeEntry[]> {
  // Send theme:list and await response
}
```

**Note:** The exact implementation depends on how the panel store sends WS messages. Look at `usePanelStore` in `src/state/panelStore.ts` to see how `saveTheme` and `activateTheme` currently work. The goal is to decouple the UI component from knowing how messages are sent.

If the store already handles this cleanly, `theme-api.ts` can just re-export store actions with typed interfaces. If not, create standalone functions that use the global WS client.

---

## Files to modify

### `open-robin-client/src/components/ThemePicker.tsx`

1. Replace the color-math import (from Chunk 1) with:
```ts
import { applyLivePreview, clearLivePreview } from '../lib/theme/live-preview';
import { saveTheme, activateTheme } from '../lib/theme/theme-api';
```

2. Remove from this file:
- `LIVE_PREVIEW_TOKENS`
- `clearLivePreview()`
- `applyLivePreview()`
- `hexToRgb`, `mixHex`, `lumToHex` (moved to live-preview.ts)
- `computeSyntaxPalette`, `hexToHsl`, `hslToHex` (removed in Chunk 1)

3. Remove the stale comment:
```ts
// Content contrast = stub for now; stored but not wired to CSS generation yet.
```
This is false — contentContrast IS wired.

4. Update `flushPending` to call `saveTheme()` and `activateTheme()` from `theme-api.ts` instead of using panel store actions directly. If the store actions are the cleanest path, `theme-api.ts` can wrap them.

5. Keep the React UI, slider state, mode toggle, hex input, debounce logic, and `SliderRow` component.

**Target size:** Under 250 lines.

---

## What NOT to touch

- Do NOT modify `renderSlugToCss` on the server (that's Chunk 2).
- Do NOT create segment CSS modules (Chunk 2).
- Do NOT add per-view override loading (Chunk 3).
- Do NOT remove Robin panel code (Chunk 5).

---

## Acceptance criteria

- [ ] `live-preview.ts` exists, is under 150 lines, has one job
- [ ] `theme-api.ts` exists with typed `saveTheme()`, `activateTheme()`, `fetchThemes()`
- [ ] `ThemePicker.tsx` is under 250 lines
- [ ] Live preview text values match server exactly for the same theme entry
  - Test with a dark theme: compare `--text-white`, `--text-primary`, `--text-secondary`, `--text-dim`, `--text-subtle`
  - Test with a light theme: same tokens
  - All five must match byte-for-byte
- [ ] Live preview syntax colors match server exactly
  - Test: `--hljs-keyword`, `--hljs-comment`, `--hljs-base` for 2 themes
- [ ] Theme save/activate still work end-to-end
  - Drag slider → wait 250ms → verify `themes.json` updates → verify `themes.css` regenerates
- [ ] No stale "stub for now" comment remains
- [ ] TypeScript compiles without errors

---

## Verification method

Create a test that feeds the same entry to both systems:

```ts
// Pseudo-test — run in browser console or unit test
const entry = {
  accent: '#ac2c0c', luminance: 14, panelContrast: 50,
  bgTint: 12, contentLuminance: 14, contentContrast: 50,
  contentTint: 12, borders: 45, chromeTint: 18
};

// Server side (node):
const { renderSlugToCss } = require('./open-robin-server/lib/theme/themes-service');
const serverCss = renderSlugToCss(entry);

// Client side (apply live preview, then read computed styles):
applyLivePreview(entry.accent, entry.luminance, entry.panelContrast, ...);
const root = getComputedStyle(document.documentElement);

// Compare these tokens:
const tokens = ['--text-white','--text-primary','--text-secondary','--text-dim','--text-subtle','--hljs-keyword','--hljs-comment','--hljs-base'];
```

For now, manual comparison is fine. The goal is byte-for-byte match on the CSS variable values.

---

## Report format

Return your report in this format:

```markdown
# Chunk 4 Report

## Files changed
- created: open-robin-client/src/lib/theme/live-preview.ts (X lines)
- created: open-robin-client/src/lib/theme/theme-api.ts (X lines)
- modified: open-robin-client/src/components/ThemePicker.tsx (+X, -X)

## Acceptance criteria
- [x] criterion — how you verified
- [ ] criterion — why blocked

## Gotchas / deviations
- Anything unexpected

## Next chunk notes
- Any interface changes the next session should know about
```
