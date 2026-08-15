# PROPOSALS — CSS UI Changes

> Candidate actions derived from evidence and owner direction. Status describes proposal lifecycle; only an explicit owner decision can approve a proposal, and approved proposals link to `DECISIONS.md`. Historical `A-*` identifiers are retained as aliases after the D-14 migration.

## Theme Contracts and Tokens

### P-001 — Set `color-scheme` from the theme system

- **Alias:** A-1
- **Category:** theme_contract
- **Status:** approved
- **Source:** I-4
- **Decision:** D-21
- **Addresses:** I-4; contributes to I-2

Set `color-scheme: light | dark` on `:root` in the generator and `live-preview.ts` alongside the other token writes so native slider tracks, scrollbars, checkboxes, and color inputs follow the app theme.

### P-002 — Retire the legacy theme seed

- **Alias:** A-2
- **Category:** theme_contract
- **Status:** proposed
- **Source:** I-15; split from the previously combined P-002 by D-21
- **Addresses:** I-15

Retire the obsolete database-backed theme seed only after the active file-backed token contract is stable. D-21 moved the active-token portion of the previous proposal into approved P-017; database/migration work remains a separate maintenance package.

### P-003 — Make scrollbar tokens mode-aware

- **Alias:** A-3
- **Category:** theme_contract
- **Status:** approved
- **Source:** D-6
- **Decision:** D-6
- **Addresses:** scrollbar portion of I-2

Emit light-mode variants of `--scrollbar-track`, `--scrollbar-thumb`, and `--scrollbar-thumb-hover` from the server generator and client mirror. This remains intentionally narrower than P-014.

### P-004 — Replace hardcoded white-alpha glass literals

- **Alias:** A-4
- **Category:** theme_contract
- **Status:** proposed
- **Source:** I-3
- **Addresses:** I-3

Introduce mode-aware glass-panel tokens and replace fixed white-alpha gradients and borders across shared chrome, Fusion, Secrets, ThemePicker, workspace styles, and per-view layouts.

### P-008 — Add semantic status and diff tokens

- **Alias:** A-8
- **Category:** theme_contract
- **Status:** proposed
- **Source:** I-10
- **Addresses:** I-10

Define shared semantic colors for additions, removals, warnings, and errors, then replace dark-tuned literals in diff rendering and warning surfaces.

### P-014 — Make glass, overlay, and on-accent tokens mode-aware

- **Alias:** A-14
- **Category:** theme_contract
- **Status:** approved
- **Source:** split from the unapproved portion of historical A-3
- **Decision:** D-21
- **Addresses:** non-scrollbar portion of I-2; I-9

Emit mode-aware glass and overlay families plus a semantic on-accent foreground token from both token writers. Keep this separate from approved P-003 so approval cannot expand by association.

### P-017 — Complete the active theme-token contract

- **Category:** theme_contract
- **Status:** approved
- **Source:** I-1, I-5, I-6; active-token portion split from P-002 by D-21
- **Decision:** D-21
- **Addresses:** I-1, I-5, I-6

Define the missing shared surface, accent, overlay, and control-supporting tokens in the server generator, client preview, and baseline fallbacks so fallbacks no longer act as hidden dark-mode definitions. Preserve the existing background, text, and accent calculations. Legacy database-seed retirement remains in P-002.

## Shared Components and Accessibility

### P-005 — Create one shared Slider component

- **Alias:** A-5
- **Category:** component
- **Status:** proposed
- **Source:** I-4, I-5, I-12
- **Addresses:** I-4, I-5, I-12

Use a thin React wrapper over `input[type="range"]` with required accessible labeling and one themed pseudo-element stylesheet. Route ThemePicker, PaperBrightnessControl, and the hue slider through the shared contract.

### P-010 — Create a universal color picker

- **Alias:** A-10
- **Category:** component
- **Status:** proposed
- **Source:** D-7 and I-12
- **Addresses:** I-12; advances VISION

Evolve the Office color picker into a shared component for any color-variable editing surface, including theme controls. D-7 approves the direction; detailed scope remains proposed.

### P-011 — Establish a universal menu paradigm

- **Alias:** A-11
- **Category:** component
- **Status:** proposed
- **Source:** D-7
- **Addresses:** menu inconsistencies contributing to I-3 and I-6

Standardize sections, dividers, typography, icons, borders, hover and active effects, submenu wiring, and apply-and-close, apply-and-keep-open, and partial-close behavior. D-7 approves the direction; detailed scope remains proposed.

### P-012 — Establish a standardized popup system

- **Alias:** A-12
- **Category:** component
- **Status:** proposed
- **Source:** D-7
- **Addresses:** one-off modal and popup styling

Define constrained shared popup layouts with typed content and warning slots. New requirements should become reusable component types rather than stand-alone popups. D-7 approves the direction; detailed scope remains proposed.

### P-015 — Make resize handles accessible separators

- **Alias:** A-15
- **Category:** accessibility
- **Status:** approved
- **Source:** I-16
- **Decision:** D-25
- **Addresses:** I-16

Give resize handles separator semantics, keyboard resizing, focusability, orientation and value metadata where applicable, and visible focus treatment.

### P-016 — Create a shared paper-presentation primitive

- **Category:** component
- **Status:** approved
- **Source:** D-19, D-20
- **Decision:** D-19, D-20
- **Addresses:** I-11 and future cross-surface drift

Create one reusable paper-presentation contract that Office and Email call directly and that thumbnails and future paper-like surfaces can subscribe to. Centralize the derivation and application of the Office-standard warm-paper base plus brightness/muting behavior; choose the concrete function, module, hook, or component boundary during technical design. Approval covers the shared ownership, Office-reference behavior, and consumer scope.

## Surface Integration

### P-006 — Retire the Office steel-blue palette

- **Alias:** A-6
- **Category:** surface
- **Status:** approved
- **Source:** I-8
- **Decision:** D-22
- **Addresses:** I-8

Replace Office-specific steel-blue literals and dark fallbacks with shared theme-derived chrome tokens.

### P-007 — Key Crepe chrome to app theme mode

- **Alias:** A-7
- **Category:** surface
- **Status:** deferred
- **Source:** I-7 and D-20
- **Decision:** D-23
- **Addresses:** I-7

Load light or dark Crepe chrome according to the active mode while keeping the document paper separate and governed by the shared Office-reference contract under D-19 and D-20. Deferred by D-23: the current Crepe menus remain until a later shared menu-components package replaces their functionality.

### P-013 — Align paper consumers with the Office standard

- **Alias:** A-13
- **Category:** surface
- **Status:** approved
- **Source:** D-20, CAP-007, I-11, and B-008
- **Decision:** D-20
- **Addresses:** I-11

Treat the current Office warm-paper base and brightness/muting behavior as the reference output. Remove Email's independent workspace-color mixing and route Office, Email, thumbnails, and future paper-like surfaces through the shared P-016 contract so they stay synchronized when the Office-standard behavior evolves.

## Maintenance

### P-009 — Remove dead CSS and isolated leftovers

- **Alias:** A-9
- **Category:** maintenance
- **Status:** proposed
- **Source:** I-13, I-14, I-15
- **Addresses:** I-13, I-14, I-15

Delete or wire the dead token palette, resolve the unused `office-viewer.css` layer, correct the white Markdown icon, and retire related obsolete leftovers without bundling unrelated feature work.
