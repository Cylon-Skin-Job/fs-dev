# Handoff: Phase 2 — Bare hex/rgba → CSS token replacement

**Roadmap:** `docs/CODE_STANDARDS_CLEANUP_ROADMAP.md`
**Baseline commit:** `6d25472` (Phase 1 complete, pushed to origin/main)
**Goal:** Replace every bare hardcoded color value in CSS files with a CSS variable (or a documented exception comment). After this phase every non-definition hex/rgba in source CSS either reads from a token or carries an explicit `/* FIXED: ... */` comment explaining why it cannot.

**Prerequisite:** Phase 1 (chrome/accent swap) must be complete. `--accent-dim` is now the bright/active accent. `--chrome-accent` is now the dim/structural chrome. Use these correctly when choosing replacement tokens.

---

## Context for the incoming agent

Project root: `/Users/rccurtrightjr./projects/fs-dev`
- Client: `fusion-studio-client/` (React 19 + TypeScript + Vite)
- Server: `fusion-studio-server/` (Node.js on port 3001)
- Restart: `unset ELECTRON_RUN_AS_NODE && ~/projects/Fusion-Home/restart-fusion.sh`
- Build only: `cd fusion-studio-client && npm run build`

Calendar UI is intentionally disconnected. `fusion-studio-client/src/components/calendar/` is excluded from tsc and from the running app. Do not touch `CalendarViewer.css` — it is dead CSS attached to a disconnected component.

**Two CSS layers (read before acting):**
- **App layer:** `fusion-studio-client/src/**/*.css` + `ai/settings/*.css` (fs-dev project layer)
- **Fusion-Home layer:** `~/projects/Fusion-Home/ai/settings/*.css`

Any new token added to `fusion-studio-client/src/styles/variables.css` must also be added to `ai/settings/variables.css` (fs-dev project layer) and to `~/projects/Fusion-Home/ai/settings/variables.css`. These three files must stay in sync.

---

## Operating rules (non-negotiable)

1. Before touching any file, read it from disk. Never work from memory.
2. Verify line counts match this document before acting.
3. Smoke test after each chunk (build must pass; visual check for CSS chunks).
4. Commit each chunk separately.
5. After all chunks, write a one-paragraph summary of what changed and what (if anything) didn't match expectations.

---

## Smoke test (run after every chunk)

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client && npm run build
```

Must exit 0. For CSS-touching chunks, also launch and visually confirm:

```bash
unset ELECTRON_RUN_AS_NODE && ~/projects/Fusion-Home/restart-fusion.sh
```

Verify no surfaces lost their color (header chrome, sidebar, panel backgrounds, modal overlays, hover states).

---

## Violation categories

The audit found four categories of bare hardcoded colors:

| Category | Treatment |
|---|---|
| **A — Fixed intentional values** | Add `/* FIXED: reason */` comment. Do not replace. |
| **B — Neutral glass/overlay alphas** | Add tokens to `variables.css`, then replace. |
| **C — Accent-dependent alphas** | Replace with `color-mix(in srgb, var(--accent-dim) X%, transparent)`. |
| **D — Status-error alpha** | Replace with `color-mix(in srgb, var(--status-error) 10%, transparent)`. |

---

## Chunk 2.1 — Annotate intentional fixed values

**No color changes in this chunk.** Add `/* FIXED: ... */` comment after each fixed value to document the exception.

### `fusion-studio-client/src/components/office/OfficeDocumentTile.css`

Lines 58, 94–95, 110, 114, 118, 124, 128, 133 (and rgba lines 123, 129, 138).

All values in this block are in a **light document preview** context — the tile renders a paper-white page regardless of the app theme. This is intentional.

Add this block comment before `.rv-office-doc-tile-preview` (currently around line 53):
```css
/* FIXED: Document preview surfaces use paper-white (#faf9f6) and near-black
   text (#1c1c1c) unconditionally. These are not theme-adjustable; the tile
   simulates a printed page. Link colors (#2563eb, #1d4ed8) are standard
   web-blue, also fixed. rgba(0,0,0,...) borders are on a light surface. */
```

### `fusion-studio-client/src/components/office/OfficeDocumentPage.css`

Lines 387–388, 400, 440 (and rgba line 538).

Same light document page aesthetic as above. Add:
```css
/* FIXED: Document page surface (#faf9f6, #1c1c1c) — light paper aesthetic,
   not theme-adjustable. rgba(0,0,0,0.55) is a dark overlay on the light surface. */
```

### `fusion-studio-client/src/styles/document.css`

Lines 156–166 — file-type icon language brand colors.

Add before the `.rv-file-icon-*` block:
```css
/* FIXED: Language brand colors — JS yellow, TS/TSX blue, CSS/HTML brand hues, etc.
   These are canonical language identifiers, not theme-controlled. */
```

### `fusion-studio-client/src/components/App.css`

Lines 556 and 562 — `color: #000` on `.rv-tp-btn--primary` and its hover.

Context: this button has `background: var(--theme-primary)`. The `#000` foreground ensures legibility on a bright accent fill. There is no `--theme-primary-fg` token yet (deferred to Phase 5 when App.css is decomposed).

Add inline comment:
```css
  color: #000; /* FIXED: on-theme-primary fill; --theme-primary-fg token pending Phase 5 */
```

### `ai/settings/views.css`

Lines 239–241 — macOS traffic-light dot colors:
```css
.rv-secondary-tl--red    { background: #ff5f57; }
.rv-secondary-tl--yellow { background: #febc2e; }
.rv-secondary-tl--green  { background: #28c840; }
```

Add comment before this block:
```css
/* FIXED: macOS traffic-light canonical colors — not theme-adjustable. */
```

**Commit message for Chunk 2.1:**
```
chore(css): annotate intentional fixed color values — Phase 2 Chunk 2.1
```

---

## Chunk 2.2 — Add glass/overlay tokens to `variables.css` (all three copies)

Before any CSS replacement can happen, the target tokens must exist.

### New tokens to add

In `fusion-studio-client/src/styles/variables.css`, `ai/settings/variables.css`, and `~/projects/Fusion-Home/ai/settings/variables.css`, add the following block after the `--neutral-chrome-border` line:

```css
  /* Glass surface tokens — neutral white-alpha overlays for hover/interactive states.
   * Use --glass-xs for barely-there backgrounds, --glass-md for standard hover,
   * --glass-lg for strong hover or focused borders. */
  --glass-xs:  rgba(255, 255, 255, 0.04);
  --glass-sm:  rgba(255, 255, 255, 0.06);
  --glass-md:  rgba(255, 255, 255, 0.08);

  /* Overlay tokens — black-alpha darken layers for backdrops and modals. */
  --overlay-sm: rgba(0, 0, 0, 0.3);
  --overlay-md: rgba(0, 0, 0, 0.5);
  --overlay-lg: rgba(0, 0, 0, 0.7);
```

**Notes:**
- `rgba(255,255,255,0.03)` and `rgba(255,255,255,0.05)` → use `--glass-xs` and `--glass-sm` respectively (acceptable rounding; these differ by one human-imperceptible step).
- `rgba(255,255,255,0.10)` → use `--glass-md` (one step up; imperceptible).
- `rgba(0,0,0,0.55)` — only in `OfficeDocumentPage.css` which is a FIXED exception (Category A). No token needed.
- Do NOT add `rgba(255,255,255,0.12)` — that is `--neutral-chrome-border`, already defined.

The Fusion-Home commit for this chunk goes in the Fusion-Home repo:
```
chore(css): add glass/overlay tokens to variables.css — Phase 2 Chunk 2.2
```

**Commit message for fs-dev:**
```
chore(css): add glass/overlay tokens to variables.css — Phase 2 Chunk 2.2
```

---

## Chunk 2.3 — Replace bare rgba(255,255,255,...) and rgba(0,0,0,...) with tokens

**Files in scope (fs-dev):**

| File | Bare values present | Token replacement |
|---|---|---|
| `fusion-studio-client/src/components/App.css` | `rgba(255,255,255,0.05)`, `0.06`, `0.08`, `0.10`, `rgba(255,200,80,0.08)` | see notes |
| `fusion-studio-client/src/components/WorkspaceSwitcher.css` | `rgba(0,0,0,0.3)`, `rgba(255,255,255,0.04)`, `0.06`, `0.08` | `--overlay-sm`, `--glass-xs`, `--glass-sm`, `--glass-md` |
| `fusion-studio-client/src/components/FolderPicker.css` | `rgba(0,0,0,0.5)`, `rgba(255,255,255,0.08)`, `0.04` | `--overlay-md`, `--glass-md`, `--glass-xs` |
| `fusion-studio-client/src/components/WorkspaceRibbon.css` | `rgba(0,0,0,0.3)`, `rgba(255,255,255,0.08)`, `0.04` | `--overlay-sm`, `--glass-md`, `--glass-xs` |
| `fusion-studio-client/src/index.css` | `rgba(0,0,0,0.7)` | `--overlay-lg` |
| `fusion-studio-client/src/components/Modal/modal.css` | *(rgba(255,255,255,...) only if any; rgba(79,...) handled in 2.4)* | check on read |
| `fusion-studio-client/src/components/WorkspaceAddModal.css` | `rgba(0,0,0,0.5)`, `rgba(255,255,255,0.08)`, `0.04` | `--overlay-md`, `--glass-md`, `--glass-xs` |
| `ai/settings/views.css` | `rgba(255,255,255,0.06)`, `rgba(255,255,255,0.05)`, `rgba(0,0,0,0.5)` | `--glass-sm`, `--glass-xs`, `--overlay-md` |
| `ai/settings/file-viewer.css` | `rgba(255,255,255,0.1)` | `--glass-md` |

### Special cases in `App.css`

- `rgba(255, 200, 80, 0.08)` at line 1840 — an amber warning tint (unique value, not a glass token). Add a `/* warning-tint */` inline comment and leave the value as-is. This is a Category A exception.
- Read the file first — some lines that appeared bare in the grep may already have a `var()` wrapper upon inspection. Only replace bare occurrences.

### Method

For each file:
1. Read the file.
2. Identify each bare rgba value. Confirm it is NOT already inside a `var(...)` call.
3. Replace with the corresponding token: `var(--glass-xs)`, `var(--overlay-md)`, etc.
4. Fallback pattern (optional but preferred): `var(--glass-md, rgba(255, 255, 255, 0.08))`.

**Commit message for Chunk 2.3:**
```
refactor(css): replace bare glass/overlay rgba values with tokens — Phase 2 Chunk 2.3
```

---

## Chunk 2.4 — Replace accent-dependent rgba values with `color-mix`

These values hardcode a specific accent color (`rgba(79, 195, 247, ...)`) instead of reading from the theme accent variable.

**Files in scope:**
- `fusion-studio-client/src/components/Fusion/fusion.css` (large file — ~1160+ lines)
- `fusion-studio-client/src/components/Modal/modal.css`

### Replacement pattern

`rgba(79, 195, 247, X)` → `color-mix(in srgb, var(--accent-dim) Xpct%, transparent)`

Where `Xpct` is the alpha value × 100:

| Current value | Replacement |
|---|---|
| `rgba(79, 195, 247, 0.05)` | `color-mix(in srgb, var(--accent-dim) 5%, transparent)` |
| `rgba(79, 195, 247, 0.08)` | `color-mix(in srgb, var(--accent-dim) 8%, transparent)` |
| `rgba(79, 195, 247, 0.10)` | `color-mix(in srgb, var(--accent-dim) 10%, transparent)` |
| `rgba(79, 195, 247, 0.12)` | `color-mix(in srgb, var(--accent-dim) 12%, transparent)` |
| `rgba(79, 195, 247, 0.18)` | `color-mix(in srgb, var(--accent-dim) 18%, transparent)` |
| `rgba(79, 195, 247, 0.20)` | `color-mix(in srgb, var(--accent-dim) 20%, transparent)` |
| `rgba(79, 195, 247, 0.25)` | `color-mix(in srgb, var(--accent-dim) 25%, transparent)` |

**Also in `ai/settings/views.css`:** `rgba(239, 68, 68, 0.1)` — this is `--status-error` at 10% alpha.
Replacement: `color-mix(in srgb, var(--status-error) 10%, transparent)`

**Also in `fusion-studio-client/src/components/calendar/CalendarViewer.css`:** skip entirely — calendar is disconnected.

### Working in `fusion.css`

This is a large file. Before acting:
1. Read the entire file.
2. Grep for `rgba(79` to get all occurrences with line numbers.
3. Make each replacement one at a time (do not bulk-replace blindly — read each context to confirm it is truly an accent-tint background, not something else).
4. After all replacements, read the file again and confirm no bare `rgba(79` values remain.

**Commit message for Chunk 2.4:**
```
refactor(css): replace hardcoded accent rgba with color-mix(--accent-dim) — Phase 2 Chunk 2.4
```

---

## Exit gate for Phase 2

After all 4 chunks:

```bash
cd /Users/rccurtrightjr./projects/fs-dev && git log --oneline -6
```

Expected top 4: one commit per chunk (2.1–2.4).

```bash
cd fusion-studio-client && npm run build
```

Must exit 0.

```bash
unset ELECTRON_RUN_AS_NODE && ~/projects/Fusion-Home/restart-fusion.sh
```

Visual confirm: all panel backgrounds, hover states, modal backdrops, and office doc tiles look identical to before. The only possible visual delta is `fusion.css` accent tints shifting slightly if the active theme's accent differs from `#4fc3f7` — that is correct and expected (the tints now follow the user's theme).

```bash
git status
```

Must be clean (aside from runtime files `topics.json`, `workspace-cache.json`).

---

## What Phase 3 needs from Phase 2

Phase 3 (`.rv-` class prefix migration) is CSS-class naming work and has no dependency on Phase 2's color tokens. However, Phase 2 must be approved before Phase 3 starts so the token foundation is stable — class renames in Phase 3 touch many of the same CSS files and a clean baseline prevents conflicts.

**Approval process:**
1. Agent posts a 4-bullet summary (one per chunk) including visual smoke test result.
2. Project owner reviews in a new session.
3. Phase 3 handoff document is generated at the start of the Phase 3 session.
