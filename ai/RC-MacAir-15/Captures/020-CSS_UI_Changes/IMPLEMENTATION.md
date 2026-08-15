# IMPLEMENTATION — Approved CSS/UI Packages

> A pre-roadmap implementation draft for the owner-approved CSS/UI packages below. It describes likely work and verification; it does not authorize product-code changes or replace a roadmap or formal specification.

## Purpose and Authority

This draft turns the currently approved theme foundation (D-21; P-001, P-003, P-014, and P-017), pane-resize accessibility (D-25; P-015), Office-reference paper behavior (D-19, D-20; P-013 and P-016), and Office token migration (D-22; P-006) into implementation-ready outlines. Each package has its own required behavior, sequence, verification, and boundaries so approval of one does not silently enlarge another.

The broader CSS/UI capture is still shaping. In particular, broad glass replacement, status/diff colors, a shared Slider, Crepe parity, resize accessibility, and legacy cleanup are not approved by this draft.

## Theme Foundation Package

### Required Behavior

- The server-generated theme and the immediate Theme Picker preview publish the same complete shared light/dark token set. Existing calculations for background, text, and accent colors remain unchanged.
- The active mode is stated through `color-scheme: light` or `color-scheme: dark`, so browser-native controls follow the app rather than the operating-system default.
- Shared controls receive mode-aware values for scrollbars, hover/focus layers, and overlays. Light mode must no longer inherit dark-mode white-on-white treatments.
- Primary accent surfaces have a readable paired foreground, rather than hardcoding black text on every accent color.
- The Office hue slider and its related focus/active fallbacks use the active theme accent instead of the fixed steel-blue fallback.
- A saved theme and a temporary Theme Picker preview resolve the same values for the same inputs.

### Proposed Implementation Sequence

1. **Define the complete active token contract.** Extend the server theme fragments/generator under `fusion-studio-server/lib/theme/` with the currently missing shared surface, control-supporting, accent, glass/overlay, on-accent, and scrollbar values. Keep the existing background, text, and accent calculations as inputs; do not revive the old database seed.
2. **Mirror that contract in immediate preview.** Update `fusion-studio-client/src/lib/theme/live-preview.ts` to write exactly the generated token family and active `color-scheme` while a user adjusts the Theme Picker. Update baseline fallbacks in `fusion-studio-client/src/styles/variables.css` so absence of generated CSS does not quietly become a dark-only definition.
3. **Apply the shared values to the first consumers.** Make the global native-control and scrollbar rules in `fusion-studio-client/src/index.css` read the active mode and scrollbar values. Update shared hover/focus use in `fusion-studio-client/src/styles/dropdown.css` and `fusion-studio-client/src/lib/contextMenu.ts`, plus the affected primary-accent consumers and Office hue slider fallback in `components/office/OfficeDocumentPage.css`.
4. **Keep the boundary narrow.** Replace only the shared token consumers required by D-21. Do not sweep unrelated hardcoded glass panels, change warning/diff colors, or introduce a new shared Slider component in this package.

### Verification Plan

1. Add focused generator and preview tests using one dark and one light fixture. Assert the two outputs contain the same token names and values for identical theme inputs, including active `color-scheme`.
2. In a mounted or browser fixture, verify native ranges, checkboxes, color inputs, and scrollbars report the active mode and visibly use mode-appropriate track/thumb values in both modes.
3. Verify shared dropdown and context-menu hover/focus states remain distinguishable in light and dark modes, and that primary-accent buttons use the paired readable foreground.
4. Verify the Office hue slider resolves the active accent and no longer falls through to `#9ab0c8` for normal operation.
5. Save a light theme, reload it, and compare the resolved values with a non-persisting live preview of the same inputs. Run the relevant client/server tests, then `npm run build` in `fusion-studio-client/`.

### Non-Goals and Open Technical Details

This package does not include P-004's broad hardcoded-glass sweep, P-008 semantic status/diff colors, P-005 shared Slider work, or P-002's remaining database-seed retirement. It also does not decide Crepe parity, Office steel-blue controls beyond the hue-slider fallback, paper behavior, or dead CSS cleanup.

No owner decision is needed to continue. The roadmap/spec owner must choose the final token names and exact light/dark alpha values, the smallest test harness location, and whether the paired on-accent foreground extends first to `--theme-primary`, `--color-primary`, or both. Those choices must preserve D-21's output and preview/save alignment.

## Pane Resize Accessibility Package

### Required Behavior

- The four shared pane dividers become reachable by keyboard and understandable to assistive technology: the Threads/sidebar divider, primary-chat divider, sticky secondary-chat divider, and File Explorer right-side file-tree divider.
- Each divider has a focusable vertical-separator control with a clear name for the pane it resizes, its orientation, and current width information where that information is exposed by the selected separator pattern.
- Left and right arrow keys resize the focused pane in the direction that matches its visible edge. The implementation uses the existing `clampPaneWidth` limits, so keyboard operation cannot exceed the current minimum and maximum widths.
- A focused divider has a visible, mode-aware focus treatment. Pointer dragging, its 9px hit target, its existing direction rules, and saved-width behavior remain unchanged.
- Keyboard changes use the existing store update and commit path, so the resulting width is retained exactly as it is after a pointer drag.

### Proposed Implementation Sequence

1. **Build after Theme Foundation.** Use the shared focus, border, and active values published by D-21; do not add another fixed light/dark fallback family for the divider.
2. **Extend the one shared resize primitive.** In `fusion-studio-client/src/components/ResizeHandle.tsx`, keep `useResizeDrag`, `clampPaneWidth`, `setPaneWidth`, and `commitPaneWidths` as the single geometry and persistence path. Add keyboard handling and accessible separator properties at that shared boundary rather than duplicating behavior across wrappers.
3. **Give each wrapper its own accurate label and direction.** Preserve the current wrapper-to-width mapping: `LeftSidebarResize` for Threads/sidebar (`leftSidebar`, right edge), `LeftChatResize` for primary chat (`leftChat`, right edge), `RightSecondaryResize` for sticky secondary chat (`rightSecondary`, left edge), and `RightColResize` for File Explorer's file tree (`rightCol`, left edge). Use the existing edge metadata to make the arrow-key direction natural for each divider.
4. **Keep existing insertion points and geometry.** Continue mounting the first two wrappers from `fusion-studio-client/src/components/App.tsx`, the sticky-secondary wrapper from `fusion-studio-client/src/components/SecondaryChat.tsx`, and the file-tree wrapper from `fusion-studio-client/src/components/file-explorer/FileExplorer.tsx`. Add focus styling in `fusion-studio-client/src/components/App.css` without moving the divider, changing grid placement, or reducing its pointer hit target.
5. **Commit keyboard changes through the same path.** A completed key operation must call the same `commitPaneWidths(panel)` path used at the end of a drag. Avoid a second persistence mechanism or a change to the view-state schema.

### Verification Plan

1. Add focused tests for the shared primitive: each wrapper has the intended accessible name, vertical separator role/orientation, focusability, and current width metadata where applicable.
2. For all four dividers, tab to the control and use both arrow directions. Verify the correct pane grows or shrinks, the existing `clampPaneWidth` bounds apply, and the final keyboard width is committed.
3. Verify visible focus and readable divider/focus contrast in light and dark themes after Theme Foundation values are applied.
4. Repeat the current pointer-drag checks: left/right drag direction, pointer capture and cancellation, 9px hit target, and committed saved width must behave exactly as before.
5. Reload the relevant workspace/view after both a keyboard resize and a pointer resize; confirm the saved width returns for Threads/sidebar, primary chat, sticky secondary chat, and the File Explorer file tree. Run the focused client tests and `npm run build` in `fusion-studio-client/`.

### Non-Goals and Open Technical Details

This package does not change default widths, pane layout or grid placement, divider location or hit-target geometry, Office table-column resizing, the Email compose resize bar, or any broader layout redesign. It does not approve the separate shared numeric Slider package, a color-picker change, or a menu-components system.

No owner decision is needed. The roadmap/spec owner must select the exact keyboard step size and whether Page Up/Page Down or Home/End are useful additions, provided the arrow-key behavior, current clamping, pointer parity, and persistence requirements above remain intact.

## Paper Package

### Required Behavior

- Every paper surface uses the Office result: warm `#faf9f6` paper, dark ink, and the existing dark mute overlay controlled by paper brightness.
- Office and Email no longer keep separate recipes for paper color, ink, divider color, or mute-overlay alpha. They receive those values from one reusable renderer-side boundary.
- A displayed thumbnail is a paper surface. It uses the same base and the same current slider-controlled overlay as its parent surface.
- The saved Office thumbnail PNG stays clean. Capture temporarily removes the editor overlay only while the PNG is made; the tile then applies the current overlay when it displays that image. This keeps an old capture from baking in a past brightness value.
- The existing brightness range, `0`–`100` normalization, maximum mute alpha of `0.2`, Office/Email saved brightness values, and `PaperBrightnessControl` interaction remain unchanged.
- Future paper-like React or CSS consumers can apply the same boundary at their root instead of copying a color recipe.

### Proposed Implementation Sequence

1. **Create one neutral paper-value boundary.** Extend or replace `fusion-studio-client/src/lib/officePaperBrightness.ts` with a neutral, renderer-local module. It should keep the current normalization and alpha calculation, own the Office-standard values (`#faf9f6`, dark ink, divider, mute RGB/alpha), and expose one CSS-variable style bundle for a supplied brightness value. The existing Office-named exports may remain as temporary compatibility aliases while consumers move.
2. **Make Office consume that boundary first.** Update `fusion-studio-client/src/components/office/OfficeGrid.tsx` and `OfficeDocumentPage.tsx` to apply the shared style bundle at their existing shell/page roots. Replace paper-presentation literals and Office-only variable declarations in `OfficeGrid.css`, `OfficeDocumentPage.css`, and `OfficeDocumentTile.css` with neutral shared variables. Keep Office visually unchanged.
3. **Keep thumbnail capture and display as two separate steps.** Preserve `OfficeDocumentPage.tsx`'s temporary `rv-office-paper-filter-capture-clean` capture class and the matching rule in `OfficeDocumentPage.css`: it produces the clean source PNG. Update `OfficeDocumentTile.css` so the displayed preview reads the shared paper variables and applies the shared overlay after the image is loaded. Do not remove the displayed-tile overlay or bake it into the saved PNG.
4. **Move Email surfaces onto the same variables.** Update `fusion-studio-client/src/components/email/EmailGrid.tsx` to use the shared style bundle rather than independently setting only mute alpha. Remove the workspace-color mixing and duplicated paper variables from `EmailGrid.css`, `EmailSurface.css`, and `EmailCompose.css`; reading and compose paper should resolve to the Office standard. Update `EmailDocumentPage.css` to consume the same paper values and overlay where it presents document paper.
5. **Bring Email thumbnails into the shared behavior.** Update `fusion-studio-client/src/components/email/EmailDocumentTile.tsx` and `EmailDocumentTile.css` so their preview base, ink, and render-time overlay use the shared variables. Remove the separate `color-mix` thumbnail-paper recipe. The exact Email thumbnail source mechanism is not changed by this work; only its displayed paper presentation is aligned.
6. **Document the stable consumer entry point.** Name the neutral module and CSS variables so a future paper-like surface can apply the returned style bundle to its root. Keep it renderer-local unless a concrete non-renderer consumer proves a broader transport contract is needed. Do not add server theme tokens or change the Office/Email view-state schema merely to share presentation values.

### Verification Plan

1. Add focused unit coverage for normalization and mute alpha at `100`, a midpoint, `0`, invalid input, and clamped values. Also assert the shared style bundle uses the Office-standard base, ink, and overlay values.
2. Add a mounted DOM or browser fixture with an Office page, Office tile, Email reading surface, Email compose surface, Email document page, and Email tile. At the same brightness, assert that each displayed paper surface resolves the same base, ink, and mute-overlay variables in both app modes.
3. In the Office fixture, capture a thumbnail at a dimmed brightness and confirm: the saved PNG does not contain the mute overlay, while the displayed tile does; then change brightness and confirm the same saved image updates visually through its overlay alone.
4. Exercise `PaperBrightnessControl` with pointer and keyboard input. Confirm its current `0`–`100` behavior and the separate Office and Email persistence paths still round-trip without a schema migration.
5. Run the narrow client test suite for the new module and fixtures, then `npm run build` in `fusion-studio-client/`. Manually or through the fixture, inspect brightness at `100`, midpoint, and `0` in light and dark themes.
6. Confirm non-goals have not changed: Crepe menus and selection chrome, Office steel-blue controls, general light-theme tokens, Email accent buttons, and unrelated card/shell chrome remain governed by their own work items.

### Non-Goals and Open Technical Details

This package does not approve a redesign of the brightness control, broader theme-token repair, Crepe light/dark parity, Office's steel-blue controls, or a change to persisted view-state data.

No owner decision is needed to continue this paper work. The roadmap/spec owner must choose whether the neutral boundary is a value-and-style factory only or also has a small React hook; neutral variable names and a temporary compatibility plan for `--rv-office-*` and `--rv-email-*`; the Email document-page root that limits its overlay to document paper; and the exact test harness. A factory is sufficient for current roots and keeps CSS-only consumers possible.

## Office Token Package

### Required Behavior

- Office’s historical steel-blue and dark fallback family is replaced with the shared theme values supplied by the Theme Foundation package. Office must consume those values; it must not define a competing token set.
- The replacement covers the Office color popover and custom-color controls, table insert and context menus, the active table/column-resize guide, and table confirmation dialog chrome.
- Existing controls and their interactions remain the same: color selection and saved custom colors, table insertion and context actions, column resizing, focus handling, and confirmation actions continue to use their current DOM and command paths.
- Document and table data, table layout/geometry, and persistence are unchanged. This is a presentation migration, not a document-model or editor-command change.
- D-20 paper behavior remains intact. A popover or menu that sits on document paper uses the shared Office paper value; the token migration must not alter paper brightness, the render-time thumbnail overlay, or the clean thumbnail PNG capture.
- Crepe’s menus and transient controls are excluded under D-23. This package must not alter `frame-dark.css`, Crepe imports, or editor-menu behavior.

### Proposed Implementation Sequence

1. **Finish Theme Foundation first.** Define and publish the shared values needed for elevated chrome, neutral text, borders/dividers, hover and focus layers, accent/focus treatment, modal overlay, and readable accent foreground. Keep their server-generated and immediate-preview outputs aligned under D-21.
2. **Replace the concentrated Office CSS fallbacks.** In `fusion-studio-client/src/components/office/OfficeDocumentPage.css`, migrate the literals and fallbacks concentrated around the table column guide and the color/table-control blocks (roughly lines 594–1158). Replace the steel-blue family (`#9ab0c8`, `#dce7f1`, `#1c2a36`, `#7890a8`, `#4a86e8`, and related blue RGBA values) with the Theme Foundation tokens. Use the shared paper variables where a surface is explicitly document paper; do not replace unrelated Office toolbar, export, or dirty-state styling as part of this package.
3. **Keep the existing DOM/control boundaries.** Verify the DOM modules that create or position these controls continue to request the same classes and events: `officeTableGeometry.ts`, `officeColorPopover.ts`, `officeCustomColorEditor.ts`, `officeInsertMenu.ts`, `officeTableContextMenu.ts`, and `officeTableConfirmDialog.ts`. `useCrepeEditor.ts` remains the integration point only; it should not receive a Crepe-mode change.
4. **Remove only proven presentation fallbacks.** Keep custom document colors, color-palette values, semantic destructive colors, and intentional user-selected swatch colors intact. A fallback may be removed only after its shared replacement exists in both saved-theme and live-preview paths.

### Verification Plan

1. In light and dark fixtures with the same Office document, open the color popover, custom-color editor, table insert menu, table context menu, and table confirmation dialog. Check readable text, borders, hover states, active swatches, and keyboard focus.
2. Exercise the active column-resize guide in a mounted Office table and confirm it remains visible and correctly positioned without the fixed steel-blue dash color.
3. Select a built-in and a custom table color, save/reopen the document, insert/remove table rows or columns, resize a column, and confirm a destructive action. Verify the document content, table geometry, commands, and persisted color values are unchanged.
4. At brightness `100`, a midpoint, and `0`, confirm paper-rooted popovers keep the D-20 warm paper and the existing brightness result. Capture an Office thumbnail and confirm it remains clean on disk while its displayed tile still applies the current overlay.
5. Search the owned CSS zone for the retired steel-blue fallback family, allowing only intentional user content/palette values that the implementation explicitly documents. Run the relevant client tests and `npm run build` in `fusion-studio-client/`.

### Non-Goals and Open Technical Details

This package does not change Crepe menu parity (D-23), the shared paper implementation, broad glass cleanup, status/diff colors, shared Slider work, resize-handle accessibility, legacy cleanup, or Office document/table data and commands.

No owner decision is needed. The roadmap/spec owner must map the final Theme Foundation token names to each current Office selector and choose the narrowest mounted test fixture that can open the transient Office controls. Those details must preserve D-22’s token-consumer boundary and D-20’s paper behavior.
