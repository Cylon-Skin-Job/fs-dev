# Chunk 1: Extract color-math.js + fix contrast spread

**From:** THEME_SYSTEM_REFACTOR_SPEC.md §5.1  
**Goal:** Extract duplicated color math into a single shared module and make the Content Contrast slider perceptible.  
**Parallel with:** Chunk 4 (client live-preview extraction) — both need `color-math.js`, no overlap otherwise.

---

## Context

The codebase has `computeSyntaxPalette()` duplicated in two files:
- `open-robin-server/lib/theme/themes-service.js` (lines ~93–165)
- `open-robin-client/src/components/ThemePicker.tsx` (lines ~74–121)

The Content Contrast slider is wired end-to-end but has no visible effect because `maxSpread` is too narrow (`isLight ? 30 : 35`). In light mode, tokens pile up against the clamp floor and look identical.

The fix: extract the function and its helpers to one file, then increase the spread range and adjust `baseLight` so there's headroom in both directions.

---

## Files to create

### `open-robin-server/lib/theme/color-math.js`

Extract these functions from `themes-service.js`:
- `hexToHsl(hex)` → `[h, s, l]`
- `hslToHex(h, s, l)` → `string`
- `clamp(n, min = 0, max = 100)` → `number`
- `computeSyntaxPalette(accent, contentLuminance, contentContrast)` → `{ keyword, function, number, string, class, section, comment, base }`

**Fix the formula in `computeSyntaxPalette`:**

Current (buggy):
```js
const baseLight = isLight
  ? Math.round(45 - 30 * lumNorm)
  : Math.round(60 + 30 * lumNorm);
const maxSpread = isLight ? 30 : 35;
```

New (fixed):
```js
const baseLight = isLight
  ? Math.round(45 - 20 * lumNorm)
  : Math.round(55 + 20 * lumNorm);
const maxSpread = isLight ? 50 : 55;
```

Also change the comment clamp from `[25, 75]` to `[10, 95]` for consistency with other tokens:
```js
const commentLight = clamp(baseLight + dir * spread * (visibilityOffsets.comment ?? 0), 10, 95);
```

**Constraints:**
- Pure functions only. No I/O, no DOM, no side effects.
- CommonJS exports: `module.exports = { hexToHsl, hslToHex, clamp, computeSyntaxPalette };`

### `open-robin-server/lib/theme/color-math.d.ts`

TypeScript declarations alongside the `.js` file so the client can import it:

```ts
export function hexToHsl(hex: string): [number, number, number];
export function hslToHex(h: number, s: number, l: number): string;
export function clamp(n: number, min?: number, max?: number): number;
export function computeSyntaxPalette(
  accent: string,
  contentLuminance: number,
  contentContrast: number
): Record<string, string>;
```

---

## Files to modify

### `open-robin-server/lib/theme/themes-service.js`

1. Add at top:
```js
const { clamp, computeSyntaxPalette } = require('./color-math');
```

2. Remove these local function definitions entirely:
- `hexToHsl`
- `hslToHex`
- `computeSyntaxPalette`
- The top-level `clamp(n, min = 0, max = 100)`

3. Remove the inner `clamp` inside `renderSlugToCss`:
```js
function clamp(n) { return Math.max(0, Math.min(100, n)); }
```
The imported `clamp` works here because it has default args.

Keep everything else: `hexToRgb`, `luminanceToHex`, file I/O, CRUD, queue.

### `open-robin-client/src/components/ThemePicker.tsx`

1. Add import at top:
```ts
import { computeSyntaxPalette, clamp } from '../../../open-robin-server/lib/theme/color-math.js';
```

2. Remove these local function definitions entirely:
- `hexToHsl`
- `hslToHex`
- `computeSyntaxPalette`

3. Remove the local `clamp` inside `applyLivePreview`:
```ts
const clamp = (n: number) => Math.max(0, Math.min(100, n));
```
Use the imported `clamp` instead.

Keep everything else: `hexToRgb`, `mixHex`, `lumToHex`, `applyLivePreview`, `clearLivePreview`, the React component.

---

## What NOT to touch

- Do NOT modify the CSS generation logic in `renderSlugToCss` (that's Chunk 2).
- Do NOT modify the live-preview surface/tint logic (that's Chunk 4).
- Do NOT delete `lib/robin/theme-css.js` (that's Chunk 5).
- Do NOT create `theme-css-generator.js` or segment modules yet.

---

## Acceptance criteria

- [ ] `color-math.js` exists at `open-robin-server/lib/theme/color-math.js`, is pure, has no I/O
- [ ] `color-math.d.ts` exists alongside it
- [ ] `themes-service.js` imports from it; no color math remains in the file
- [ ] `ThemePicker.tsx` imports from it; no `hexToHsl`, `hslToHex`, `computeSyntaxPalette` remain in the file
- [ ] Content Contrast at 0%, 50%, 100% produces visibly different syntax colors in **both** light and dark modes
  - Verify: for a dark theme (`contentLuminance: 14`), `--hljs-keyword` should span at least 30 lightness points across the contrast range
  - Verify: for a light theme (`contentLuminance: 96`), `--hljs-keyword` should span at least 15 lightness points
- [ ] TypeScript compiles: `cd open-robin-client && npx tsc --noEmit -p tsconfig.app.json` passes
- [ ] Server syntax check: `cd open-robin-server && node -c lib/theme/color-math.js && node -c lib/theme/themes-service.js` passes
- [ ] Server starts without errors: `node server.js` boots to `[Server] Running on http://localhost:3001`
- [ ] `themes.css` output is structurally identical except for `--hljs-*` values
  - Verify by comparing pre/post output for the same theme entry

---

## Verification script

Run this to check the contrast range:

```js
const { computeSyntaxPalette } = require('./open-robin-server/lib/theme/color-math');

function getKeywordLightness(accent, lum, contrast) {
  const p = computeSyntaxPalette(accent, lum, contrast);
  // Extract L from hex roughly — or just check the hex changes visibly
  return p.keyword;
}

// Dark theme
for (const cc of [0, 50, 100]) {
  console.log('dark contrast=' + cc, getKeywordLightness('#ac2c0c', 14, cc));
}

// Light theme
for (const cc of [0, 50, 100]) {
  console.log('light contrast=' + cc, getKeywordLightness('#0071e3', 96, cc));
}
```

**Expected:** The hex values should show clear lightness variation, not all clustering together.

---

## Report format

Return your report in this format:

```markdown
# Chunk 1 Report

## Files changed
- created: open-robin-server/lib/theme/color-math.js (X lines)
- created: open-robin-server/lib/theme/color-math.d.ts (X lines)
- modified: open-robin-server/lib/theme/themes-service.js (+X, -X)
- modified: open-robin-client/src/components/ThemePicker.tsx (+X, -X)

## Acceptance criteria
- [x] criterion — how you verified
- [ ] criterion — why blocked

## Gotchas / deviations
- Anything unexpected

## Next chunk notes
- Any interface changes the next session should know about
```
