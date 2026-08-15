# CHANGE SURFACE — Shared Office-Reference Paper Behavior

> Working map of the current code, consumers, contracts, and verification boundaries needed to turn the approved Office-reference paper direction into an implementation-ready plan. This document records analysis, not implementation authorization.

## Purpose and Authority

This document bounds the files and runtime surfaces that must be understood before writing the paper-behavior specification. Current code and reproducible behavior establish implementation facts; `DECISIONS.md`, `INTENT.md`, and approved proposals establish desired direction and scope.

## Shared Paper Contract

The approved product contract is the current Office result (D-20/P-016): a warm paper base (`#faf9f6`) with dark paper ink and a brightness-dependent dark mute overlay. The brightness value is normalized to `0..100`; `100` means no overlay and `0` means the maximum configured overlay (`0.2` alpha). The paper presentation is intentionally independent of the surrounding workspace theme; the surrounding editor/grid chrome remains theme-driven.

Current implementation facts:

- `fusion-studio-client/src/lib/officePaperBrightness.ts` owns the only shared numeric logic today: `normalizeOfficePaperBrightness()` and `officePaperMuteAlpha()`. It does not own the paper base, ink, overlay RGB, or CSS application.
- Office page CSS (`components/office/OfficeDocumentPage.css:413-443`) hardcodes the page base/ink and applies the overlay through a `::after` pseudo-element. Office grid CSS (`components/office/OfficeGrid.css:1-60`) defines the same mute variables and applies an overlay to page/tile previews.
- Office grid/page React entry points (`OfficeGrid.tsx:505-506, 843-844`; `OfficeDocumentPage.tsx:95-96, 376-384`) normalize/persist brightness and inject only `--rv-office-paper-mute-alpha` on their shell/page style.
- Email grid React (`components/email/EmailGrid.tsx:900-905, 1196-1203`) reuses the numeric helpers but its CSS (`EmailGrid.css:11-26`) independently derives paper with `color-mix(in srgb, #faf9f6 84%, var(--rv-email-content-fill) 16%)`, defines duplicate mute/ink/line variables, and applies those vars to Email reading/compose surfaces. This is the divergence recorded by I-11.

Smallest shared boundary to design: a client-side paper presentation module (likely extending `officePaperBrightness.ts`, or a sibling module) that exposes canonical constants/tokens and deterministic derivation for base paper, ink/line colors, mute overlay, and normalized brightness. Consumers should receive either a class/style-variable bundle or a hook/helper that applies the same CSS variables; the exact function/module/hook/component shape is intentionally a later technical-design choice. CSS should consume the emitted variables rather than repeat `#faf9f6`, overlay RGB, or `color-mix` recipes.

## Consumer Map

| Consumer | Current entry points | Current behavior/divergence | Shared-contract relationship |
|---|---|---|---|
| Office editor page | `components/office/OfficeDocumentPage.tsx`; `OfficeDocumentPage.css` (`.rv-office-document-editor .milkdown`) | Canonical warm base/ink plus `::after` mute overlay; capture temporarily hides that overlay with `.rv-office-paper-filter-capture-clean`. | Primary reference consumer; should call the shared derivation. The temporary capture state is a source-image concern, not a different displayed-paper variant. |
| Office grid and previews | `components/office/OfficeGrid.tsx`; `OfficeGrid.css`; `OfficeDocumentTile.css` | Grid shell injects brightness alpha; tile preview uses `--rv-office-thumbnail-paper: #faf9f6` and its own `::after` mute overlay. `OfficeDocumentPage.tsx` saves a clean Markdown screenshot, then `OfficeDocumentTile.tsx` displays it beneath the tile overlay. | Must subscribe to the same paper variables. The clean saved PNG prevents a baked-in brightness level; the displayed thumbnail receives the current slider-controlled overlay on top. |
| Email reading/compose | `components/email/EmailGrid.tsx`; `EmailSurface.css`; `EmailCompose.css`; `EmailReadingPane.tsx` | Uses shared numeric brightness helper but independently mixes paper toward workspace fill and duplicates mute/ink/line variables. | Must remove independent base-color mixing and consume Office-standard variables. Reading and compose remain paper surfaces; surrounding Email chrome remains separate. |
| Email document editor | `components/email/EmailDocumentPage.css` (`.rv-email-document-editor .milkdown`) | Hardcodes `#faf9f6`/`#1c1c1c` and has no paper mute overlay, despite being rendered inside the Email shell. | Needs explicit subscription to the shared paper vars if it is in scope as a paper-like surface; current code is a second divergence not called out by EmailGrid's derivation. |
| Email thumbnails | `components/email/EmailDocumentTile.css`; `EmailDocumentTile.tsx` | Preview hardcodes a separate `color-mix` thumbnail paper and has no brightness overlay. | Must consume the same base/mute variables if thumbnails are included in P-016 (owner direction explicitly includes thumbnails). |
| Future paper-like surfaces | No current registry/API; examples are any document/page/thumbnail that presents paper. | No shared subscription mechanism exists today beyond CSS variable inheritance. | New consumers should apply the shared paper contract at their root and avoid local color derivation; technical design should document the stable entry point. |

The existing `EmailSurface` prop path (`EmailGrid` → `EmailSurface` → `EmailReadingPane`) carries brightness only for the control; CSS variables are inherited from the `rv-email-shell` style. Office uses the analogous `rv-office-shell` style. This suggests a shared style-variable bundle can preserve the current state/persistence paths while removing duplicated presentation recipes.

## Supporting Theme and Style Dependencies

The paper contract is renderer-local and does not require server theme generation. Relevant dependencies are:

- `components/office/OfficeGrid.tsx` and `components/email/EmailGrid.tsx` obtain per-panel brightness from `usePanelStore` view state; server defaults/persistence are `fusion-studio-server/lib/view-state/defaults.js`, `resolver.js`, and `writer.js` (`officePaperBrightness`/`emailPaperBrightness`, both default `100`).
- `components/PaperBrightnessControl.tsx` and `.css` are the shared control UI. Its numeric range already uses `officePaperBrightness.ts`, but its dropdown still depends on unresolved theme tokens (`--surface-elevated`, `--neutral-chrome-hover`) documented in I-6; paper contract work must not silently redesign this control.
- Office and Email editor page styles import Crepe's dark frame unconditionally in `components/office/useCrepeEditor.ts` and `components/email/useCrepeEditor.ts`; P-007 is separate. The paper primitive must not own Crepe selection/slash-menu chrome or surrounding editor backgrounds.
- `OfficeDocumentPage.tsx` thumbnail capture intentionally removes the visual mute overlay before PNG capture. The saved PNG is therefore a clean source image; `OfficeDocumentTile.css` reapplies the current slider-controlled overlay when that image is displayed. This prevents brightness from being baked into the capture and must remain true through refactoring. The path includes the saved `.thumbnails` sidecar (`lib/officeThumbnails.ts`, server `workspace-request-handlers.js`).
- Workspace/server style transport (`useSharedWorkspaceStyles.ts`, `connection-init.js`, `workspace-broadcaster.js`) supplies theme CSS but currently has no paper-specific contract. Do not add server tokens unless technical design proves a cross-renderer need.
- Existing hardcoded fallback colors in Office/Email CSS should be treated as migration targets for this contract only where they define paper presentation; unrelated chrome literals, Office steel-blue palette, and dead style layers remain out of scope.

## Verification and Acceptance

Acceptance should verify the same computed paper result in both app modes and across each consumer, with brightness at `100`, a midpoint, and `0`:

1. Office editor page and Office grid/tile preview use the same warm base, ink, and mute alpha; surrounding editor/grid chrome may differ by theme.
2. Email reading pane, compose window, Email document editor, and Email thumbnails no longer derive workspace-mixed paper; their computed paper variables match Office at the same brightness.
3. A future-style fixture can subscribe by applying the documented shared primitive and receives the same variables without copying CSS recipes.
4. Thumbnail capture remains clean, and every displayed thumbnail receives the shared slider-controlled overlay at render time; brightness is never baked into the saved PNG.
5. Existing brightness persistence and `PaperBrightnessControl` keyboard/value behavior remain unchanged.
6. Crepe chrome, Office steel-blue controls, Email accent buttons, and general theme tokens are not regressed; those belong to P-007/P-006/P-001/P-014 and need their own acceptance checks.

Current evidence supports Office and Email reading/compose source/runtime checks, and isolated checks for Office popover/Crepe/PaperBrightnessControl. Mounted Email accent controls and live editor transient chrome remain fixture-limited (B-012/B-013). A later implementation spec should add a DOM fixture or browser test that mounts every consumer because the current harness cannot prove inheritance through all nested surfaces.

## Open Boundaries

No product decision is currently missing: D-20 fixes the Office output and P-016/P-013 approve the shared ownership and consumer scope. Technical choices to resolve during plan/spec work are:

- whether the shared boundary is a pure value/variable factory, a React hook, or a small wrapper component; and whether the CSS variable names are renamed from `rv-office-*`/`rv-email-*` to neutral paper names;
- how the shared primitive distinguishes a clean capture source from the displayed thumbnail presentation without exposing a second user-facing paper mode;
- how to expose the primitive to future non-React or CSS-only surfaces without coupling them to panel state.

Explicit non-goals for this change surface: implementing code; changing persisted view-state schema; redesigning the brightness control; theme-token cleanup (P-001/P-002/P-003/P-004/P-014); Crepe mode parity (P-007); Office steel-blue migration (P-006); dead CSS/legacy migration (P-009); or editing the canonical Wiki.
