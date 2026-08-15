# ISSUES — CSS UI Changes

> Verified actionable problems from the 2026-08-09 read-only audit. Stable level-two headings route by subject category; each record separately declares issue type, severity, and status. Contradictions live here as an issue type unless they earn a distinct reconciliation corpus. Exploratory questions remain in `CAPTURE.md`, and cross-chat blockers belong in `BULLETIN.md`.

## Architecture and Theme Runtime

### I-1 — Phantom tokens with dark fallbacks

- **Category:** architecture
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** bounded current-source search across `fusion-studio-client/src/`, `fusion-studio-server/lib/theme/`, and `ai/RC-MacAir-15/{System,Views}` on 2026-08-10
- **Related:** P-002

Revalidation confirmed that the current token contract remains incomplete. Twelve representative missing names account for 170 current `var()` references: `--surface-hover` (49), `--transition-fast` (28), `--surface-elevated` (18), `--bg-surface` (16), `--border-subtle` (10), `--font-size-sm` (10), `--z-dropdown` (9), `--font-size-xs` (9), `--error` (6), `--neutral-chrome-hover` (5), `--modal-border` (5), and `--accent` (5). No definition for any of those names was found in the active client, server theme renderers, or active workspace style tree.

The similarly named values in `fusion-studio-server/lib/db/migrations/003_workspace_themes.js:52-74` are an old SQLite seed, not part of the current `themes.json` → `themes-service.js` → `theme-css-generator.js` → workspace `themes.css` chain. In the running renderer, `--surface-hover`, `--surface-elevated`, and `--accent` all resolved to the empty string while their consumers fell through to local literals. This verifies the gap for the representative family; the broader unregistered-token population was not promoted to an exact count because component-local and dynamically assigned variables require record-by-record classification.

### I-2 — White-alpha glass tokens never invert

- **Category:** architecture
- **Type:** defect
- **Severity:** high
- **Status:** open
- **Source:** `styles/variables.css:28-49`; `theme-css-generator.js:1-23`; `live-preview.ts:13-39`; `styles/dropdown.css:51-53`; `lib/contextMenu.ts:49-61`; `index.css:53-77`; active renderer and generated Cal light-theme checks on 2026-08-10
- **Related:** P-003, P-014

`--glass-xs/sm/md` and `--scrollbar-thumb(-hover)` remain fixed white-alpha defaults. Neither the server generator's seven fragments nor the client live-preview token list emits mode-aware replacements. The shared dropdown uses `--glass-sm` for hover, the context menu uses `--glass-md` for both hover and focus while removing the outline, and the global WebKit/Firefox scrollbar rules consume the same fixed scrollbar pair.

The running `user-current` dark theme resolved the tokens to white at 0.06/0.08/0.12/0.22 alpha as expected. Generating the built-in Cal light theme (`luminance: 100`, `accent: #242424`) leaves those defaults unchanged; sRGB compositing against its generated chrome produces approximately 1.03:1 for dropdown hover, 1.05:1 for context-menu hover/focus, and 1.07:1 for the scrollbar thumb. Those light-state values are generator-based measurements rather than a persisted live theme switch, but they confirm that the contract cannot invert and that the affected states are effectively indistinguishable on representative light surfaces.

An isolated, non-persisting Chromium harness loaded the active `variables.css`, generated Cal light CSS, `dropdown.css`, and the global scrollbar rules. It resolved `--glass-sm` to fixed `rgba(255,255,255,0.06)` and the scrollbar thumb to fixed `rgba(255,255,255,0.12)`; hovering a shared dropdown item produced the same white-alpha background on the light sidebar. The harness therefore directly confirms the unobserved light hover/scrollbar states without changing saved theme state. The context-menu source injects the same fixed `--glass-md` for hover/focus and explicitly sets `outline: none`; no mounted context-menu could be opened in the isolated page, so its runtime geometry remains unobserved.

### I-3 — Hardcoded white liquid-glass panels

- **Category:** architecture
- **Type:** contradiction
- **Severity:** high
- **Status:** open
- **Source:** CSS audit across shared and per-view surfaces
- **Related:** P-004

White-alpha panels are hardcoded in `WorkspaceRibbon.css`, `secrets.css`, `ThemePicker.css`, workspace `views.css`, `capture-viewer.css`, `fusion.css`, and per-view layout files. The overlays become white-on-white in light themes.

### I-4 — Native controls lack an active color scheme

- **Category:** architecture
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** client/workspace-wide `color-scheme` search; `index.css:12-23`; `ThemePicker.css:457-462`; active renderer on 2026-08-10
- **Related:** P-001, P-005

No `color-scheme` declaration or runtime assignment exists in the current client or workspace style tree, and the server generator does not emit one. The running dark renderer reported `getComputedStyle(document.documentElement).colorScheme === "normal"`. ThemePicker ranges set only `accent-color`; they still have no explicit WebKit or Mozilla track/thumb contract. Native controls therefore continue to use the user-agent scheme rather than the active Fusion Studio mode. The dark runtime was observed directly; the corresponding light state is source-confirmed but was not activated because the current ThemePicker persists mode changes.

The isolated Cal light harness also reported `colorScheme: "normal"`; an unstyled native range resolved `accent-color: auto`, confirming that no light-specific native track/thumb contract is applied even when generated light tokens are present. This harness did not persist or activate a workspace theme.

### I-5 — Hue-slider accent never follows the theme

- **Category:** architecture
- **Type:** defect
- **Severity:** high
- **Status:** open
- **Source:** current definition/use search; `OfficeDocumentPage.css:718,891,909,975,1158`; server generator and client live-preview output lists
- **Related:** P-002, P-005

`--accent` still has no definition in the active theme chain. Its five current references are all in `OfficeDocumentPage.css`; the hue slider at line 891 therefore resolves `accent-color` to the fixed `#9ab0c8` fallback, and the related focus/active borders use the same fallback. No Office hue control was mounted in the inspected runtime view, so the rendered control itself remains visually unobserved; the cascade result is source-deterministic for every generated theme.

### I-9 — Black text can land on dark accent colors

- **Category:** architecture
- **Type:** defect
- **Severity:** high
- **Status:** open
- **Source:** `ThemePicker.css:553-562`; `BookmarkDialog.css:92-100`; `accent-css.js`; generated current and Cal theme outputs on 2026-08-10
- **Related:** P-014

ThemePicker primary buttons still hardcode `color: #000` on `--theme-primary`, and the browser bookmark primary button hardcodes black on the unchanged base `--color-primary`. The generator now provides `--chrome-accent-fg` for chrome-filled surfaces, but it still provides no foreground token paired with `--theme-primary` or `--color-primary`.

Calculated contrast is 3.51:1 for black on the active `#995014` theme primary, 1.35:1 for black on the built-in Cal light theme's `#242424` primary, and 3.31:1 for black on the bookmark button's `#39628e` base color. All are below 4.5:1 for normal text. The values come from current generated tokens and exact CSS literals; the affected dialogs were not mounted during the runtime check.

The isolated light harness did not mount ThemePicker or BookmarkDialog, so it could not add a visual dialog observation. Their source remains deterministic: both primary actions still use `color: #000` on theme-primary surfaces, and no paired foreground token is emitted.

### I-10 — Status and diff colors are dark-tuned

- **Category:** architecture
- **Type:** inconsistency
- **Severity:** medium
- **Status:** open
- **Source:** `lib/tool-renderers/shared/diff-display.ts:32-39`; `secrets/secrets.css:397-403`; `Fusion/fusion.css:1048-1053`; generated current and Cal document backgrounds on 2026-08-10
- **Related:** P-008

Diff rows still emit fixed inline green/red foregrounds with matching 0.08-alpha backgrounds. Against the active dark document background, calculated foreground contrast is 5.35:1 for additions and 3.50:1 for removals; against the generated Cal light document background it falls to 1.19:1 and 1.84:1 respectively. Fixed warning tints also remain in the Secrets duplicate prompt and Fusion diverged-card border rather than deriving from a mode-aware semantic status family.

These are exact source and generated-background calculations, not observations of a mounted diff or warning surface. They nevertheless verify that the same literals cannot provide consistent contrast across supported modes.

## Product Surfaces

### I-6 — PaperBrightnessControl dropdown is always dark

- **Category:** surface
- **Type:** defect
- **Severity:** high
- **Status:** open
- **Source:** `PaperBrightnessControl.css:24,40,42,79`; 2026-08-10 source and runtime recheck
- **Related:** P-002

The control still uses `--surface-elevated` and `--neutral-chrome-hover`, and a bounded search found no canonical definition in the client styles, server theme code, or workspace styles. Its `#202020` and white-alpha fallbacks therefore remain the effective definitions. The running dark-mode Email surface showed the expected dark dropdown, but the light-mode dropdown could not be isolated because the already-open theme editor obscured it. Source confidence is high; direct light-mode visual confirmation remains incomplete.

An isolated Chromium light-theme harness (2026-08-13; `PaperBrightnessControl.css` loaded with Office-reference `#faf9f6` paper variables and no `--surface-elevated` definition) computed the open dropdown background as `rgb(32, 32, 32)` (`#202020`) and the ring fill as the same fallback. The range input retained the browser light track/thumb treatment, but the containing dropdown is definitively dark. This confirms the source-derived defect without changing persisted theme state; a mounted Email/Office control was not required for the CSS result.

### I-7 — Crepe editor chrome is pinned dark

- **Category:** surface
- **Type:** contradiction
- **Severity:** high
- **Status:** open
- **Source:** `components/office/useCrepeEditor.ts:9`; `components/email/useCrepeEditor.ts:11`; `@milkdown/crepe/lib/theme/frame-dark/style.css`
- **Related:** P-007

Both editor integrations still import `frame-dark.css` unconditionally. The installed theme assigns dark values such as `--crepe-color-background: #1a1a1a`, `--crepe-color-surface: #121212`, and `--crepe-color-hover: #232323`, while both document pages compensate with a fixed `#faf9f6` paper and dark ink. The runtime pass confirmed that the document sheet stays light in both app modes; selection-only and block-edit Crepe controls were not forced open, so the source-level contradiction is verified but the full chrome appearance remains only partially observed.

The same isolated Chromium light-theme harness loaded the installed `frame-dark` and common block-edit styles with a representative `.milkdown` tree. Computed values remained `--crepe-color-surface: #121212` for the slash menu, `#121212` for its background, and `#232323` for the hovered menu item. A block handle without its transient show state has no painted background, so that specific hover surface could not be observed without a live Crepe interaction. The light-mode transient chrome therefore remains source-confirmed as dark, with direct selection/block-handle screenshots still blocked by the absence of a mounted editor harness.

### I-8 — Office maintains a steel-blue palette island

- **Category:** surface
- **Type:** inconsistency
- **Severity:** high
- **Status:** open
- **Source:** `OfficeDocumentPage.css:623-1158`; 2026-08-10 bounded literal scan
- **Related:** P-006

The current stylesheet contains 42 occurrences in the steel-blue/dark fallback family (`rgba(154, 176, 200, ...)`, `#9ab0c8`, `#dce7f1`, `#1c2a36`, `#7890a8`, and `#4a86e8`). They remain concentrated in the color popover, custom-color controls, table/column chrome, and focus treatments. The light-mode Office document was exercised, but the color popover and column-grab guide were not reproducibly opened during this pass; the implementation island is high-confidence source evidence, while the previously reported near-invisibility remains visually unconfirmed.

In the isolated Chromium light-theme harness, `OfficeDocumentPage.css` rendered the color popover with the Office paper variable (`#faf9f6`) when `--rv-office-content-fill` was set to the D-20 reference. Its “None” row used the steel-blue fallback text `#4a4a4a`; the active column-grab guide pseudo-element painted at opacity `1` with `1.5px dashed rgba(36, 92, 140, 0.85)`. These computed states are visible against the warm paper in isolation, but no live document table/color-popover mount was available, so pointer positioning and actual in-app trigger reachability remain unverified.

### I-11 — Email paper diverges from the Office reference

- **Category:** surface
- **Type:** inconsistency
- **Severity:** medium
- **Status:** open
- **Source:** D-20; `OfficeDocumentPage.css:413-449`; `EmailGrid.css:12-26`; `EmailSurface.css:200-262`; `EmailCompose.css:12-78`; `officePaperBrightness.ts:1-16`; 2026-08-10 light/dark runtime pass
- **Related:** P-013, P-016

D-20 makes the current Office paper behavior canonical. Office uses a fixed warm-paper base of `#faf9f6` plus the shared brightness overlay. Email starts from the same warm value but independently mixes it toward `--rv-email-content-fill` before applying the overlay, so its result can drift from the Office reference. The slider caps the shared overlay at `0.2` alpha.

The runtime pass exercised the Office editor, Email reading pane, and Email compose window in both app modes. All remained mode-independent light surfaces, but Email was visibly grayer than Office in dark mode, especially at the saved minimum brightness value of `0`. Dark ink, hover chrome, and message controls remained legible at that minimum. The verified issue is Email's independent base-color derivation and resulting divergence from the Office standard, not demonstrated text unreadability.

The isolated light-theme pass did not mount an Email compose/reading interaction with accent-backed controls. Source inspection confirms the compose send button uses `var(--palette-accent, #4a7dff)` with `var(--text-on-accent, #ffffff)` (`EmailCompose.css:138-139`), while paper controls use the independent `rv-email-*` variables. Consequently no new runtime contrast claim is made for those controls; their direct light-mode appearance remains blocked pending a mounted Email fixture. The Office popover/column-guide observations above do not resolve this independent Email derivation issue.

## Components and Interaction

### I-12 — Slider implementations are inconsistent

- **Category:** component
- **Type:** inconsistency
- **Severity:** medium
- **Status:** open
- **Source:** `ThemePicker.tsx:196-250`; `ThemePicker.css:442-469`; `PaperBrightnessControl.tsx:82-104`; `PaperBrightnessControl.css:84-113`; `officeCustomColorEditor.ts:88-99`; `OfficeDocumentPage.css:887-893`; 2026-08-10 dark-theme runtime accessibility inspection
- **Related:** P-005, P-010

- Three independent native-range implementations remain, with no shared Slider component.
- ThemePicker now renders 12 `SliderRow` ranges, not the previously recorded 13. The shared row places a visual `<span>` after each input but supplies no `aria-label`, `aria-labelledby`, or associated `<label>`. In the running dark-theme picker, the accessibility tree exposed all 12 as unnamed sliders with native Increment and Decrement actions.
- PaperBrightnessControl and the Office custom-color hue range each supply an accessible label. Both retain native range keyboard semantics; the hue slider remains imperative DOM rather than React.
- Styling and focus treatment still diverge. ThemePicker uses only `accent-color` at full width; the Office hue range uses a separate `accent-color` and 14px height; PaperBrightnessControl uses an 18px-high, 96px frame, scaled browser thumbs, and the only explicit `:focus-visible` rule of the three. ThemePicker and Office otherwise rely on user-agent track, thumb, and focus rendering.
- The running dark-theme picker showed visible tracks and thumbs. Light-theme runtime appearance was not exercised because this picker auto-saves and activates mode changes; light-mode parity remains unverified rather than inferred.

- An isolated Cal light page exercised the shared dropdown hover and a native range without mounting ThemePicker. The dropdown hover remained fixed white-alpha (`rgba(255,255,255,0.06)`) against generated light chrome, and the range reported browser `accent-color: auto`; no explicit track/thumb or focus-visible rule was present. ThemePicker's mounted light state, its 12 labels, and its saved theme behavior remain unobserved because opening it in-app persists the mode.

### I-16 — Resize handles are pointer-only

- **Category:** component
- **Type:** gap
- **Severity:** medium
- **Status:** open
- **Source:** `ResizeHandle.tsx:117-165`; `App.css:270-309`; 2026-08-10 runtime accessibility inspection
- **Related:** P-015

The current shared drag primitive returns pointer handlers, `data-pane`, and a CSS class only; its four wrappers render bare `<div>` elements. They still have no separator semantics, focusability, orientation or value metadata, keyboard resizing, or keyboard commit path. CSS provides hover and active feedback but no focus treatment. In the running app, the visible pane dividers were absent from the accessibility tree, confirming that assistive technology and keyboard navigation cannot reach them.

The isolated light harness did not mount a resizable pane, so no new light focus rendering could be observed. Source confidence remains high that the shared handle has no focusable element or focus style in either mode.

## Maintenance and Migration

### I-13 — Dracula token CSS is dead

- **Category:** maintenance
- **Type:** debt
- **Severity:** low
- **Status:** open
- **Source:** `fusion-studio-client/src/styles/variables.css:53-61`; `ai/RC-MacAir-15/System/styles/variables.css:51-59`; `fusion-studio-client/src/styles/document.css:86-151`; current syntax-renderer search on 2026-08-10
- **Related:** P-009

The nine `.token-*` selectors and their Dracula `--token-*` variables remain in both the bundled client defaults and the active workspace defaults, but the current renderer path uses `highlight.js`: `lib/transforms/code.ts` and `lib/transforms/frontmatter.ts` emit `.hljs-*`, while `server/lib/theme/syntax-css.js` and `client/src/lib/theme/live-preview.ts` produce only `--hljs-*` and `--hljs-md-*`. A bounded search found no current Prism dependency or non-CSS `.token-*` producer outside archived material, so this parallel palette remains dead.

### I-14 — The office-viewer workspace layer is dead

- **Category:** maintenance
- **Type:** debt
- **Severity:** low
- **Status:** open
- **Source:** `fusion-studio-client/src/hooks/useSharedWorkspaceStyles.ts:33-71`; `fusion-studio-server/lib/ws/connection-init.js:54-58`; `fusion-studio-server/lib/ws/workspace-broadcaster.js:31-39`; `ai/RC-MacAir-15/System/styles/office-viewer.css:1-120`; loader-reference search on 2026-08-10
- **Related:** P-009

`ai/RC-MacAir-15/System/styles/office-viewer.css` is omitted from the client shared-layer list and both server preload/broadcast lists; a bounded live-code search found no import or filename reference. Its header identifies it as Capture-viewer chrome and claims that nothing is hardcoded, yet lines 23, 74-80, and 102-115 contain fixed white-alpha borders, gradients, highlights, and fallbacks. The file remains an unused, internally contradictory near-duplicate rather than an active Office layer.

### I-15 — Isolated literals and legacy seed remain

- **Category:** maintenance
- **Type:** debt
- **Severity:** low
- **Status:** open
- **Source:** `fusion-studio-client/src/styles/document.css:153-165`; `fusion-studio-client/src/components/file-explorer/FileViewer.tsx:80`; `fusion-studio-client/src/components/Pinwheel.tsx:27-30`; `fusion-studio-client/src/components/capture/CaptureTiles.tsx:237-241`; `fusion-studio-server/lib/db.js:25-45`; `fusion-studio-server/lib/db/migrations/003_workspace_themes.js`; `fusion-studio-server/lib/theme/themes-service.js:1-107`; current consumer search on 2026-08-10
- **Related:** P-002, P-009

Three residue classes remain, with narrower current impact than the earlier audit implied:

- `document.css:163` still fixes `.rv-file-icon-md` to white, but the current FileViewer generates `file-icon-${extension}` without the `rv-` prefix and no matching `.rv-file-icon-*` consumer was found. The literal is presently dead or selector-mismatched rather than a confirmed visible white icon.
- `Pinwheel.tsx:29` still defaults to `#2d9bf5`, but the sole current caller passes `var(--accent-dim, var(--theme-primary, #39628e))`; the component default is not exercised by that caller.
- `db.js` still runs every migration through `migrate.latest()`, so a fresh database executes migration 003 and provisions the legacy `system_theme`/`workspace_themes` schema and default theme seed. The active `themes-service.js` is explicitly file-backed with no DB dependency. Later migrations remove the seven placeholder workspaces but retain `workspace_themes`, which current registry cleanup still references, so retiring this residue requires an explicit migration rather than deleting the historical file.
