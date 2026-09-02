# SPEC — Shared Menu Component Extraction

> **Status:** Draft for owner review. This document defines an executable implementation package but does not itself authorize product-code changes.
>
> **Scope:** Extract the mature general-purpose menu machinery from the Office page implementation into one portable shared component, make Office consume it, and prove the component through Office. Site-wide adoption and deletion of other menu implementations are deferred to a later SPEC.

## Purpose and Authority

Fusion Studio currently repeats menu rendering, positioning, dismissal, focus, and submenu behavior across several implementations. The Office table context menu contains the most complete behavior, but `officeTableContextMenu.ts` also combines that reusable machinery with Office table rules and editor mutations.

This SPEC implements the owner direction recorded in D-7, the universal-menu intent in `INTENT.md`, and P-011's proposed component direction, narrowed by the latest owner instruction:

- use the Office page menu as the behavioral reference;
- extract only the reusable menu framework now;
- leave Office-specific commands and state in Office;
- support nested side menus and explicit click outcomes;
- change custom-color Add so it returns to the refreshed palette instead of applying the color and closing; and
- defer every non-Office consumer migration and legacy-menu deletion to a later site-wide package.

Current code and tests remain authoritative for existing Office table behavior except where this SPEC records the custom-color Add change above.

## Scope Boundary

### In scope

- A portable shared menu component under `fusion-studio-client/src/components/menu/`.
- Typed action, separator, radio-choice, submenu, external-child trigger, disabled, destructive, and secondary-label descriptors needed by the current Office menus.
- One menu-tree owner for root menus, side submenus, and nested side submenus.
- Pointer-relative and element-relative anchoring, child-menu placement, viewport collision handling, and repositioning on resize.
- Pointer interaction, outside-click dismissal, keyboard navigation, focus movement, cancellation restoration, and preservation of successful command focus/selection.
- An explicit action-outcome protocol for staying open, returning to a prior menu, closing selected hierarchy levels, and closing the entire tree.
- Registration of specialized external child surfaces so the Office table-layout grid and color palette can remain logically inside an open menu tree without being rendered as ordinary action menus.
- Live descriptor refresh for shared action-menu surfaces while the tree remains open; specialized external surfaces retain their own refresh and internal-focus ownership.
- Office insert-context-menu, Office table-context-menu, and Office custom-color removal action-menu rendering through the shared component.
- The custom-color Add workflow described in this SPEC.
- Removal of the superseded Office-only menu rendering, submenu, positioning, dismissal, and keyboard code after the shared path is accepted.

### Deferred follow-on scope

- Capture ellipsis menus and `showContextMenu()`.
- Office and Email file/folder ellipsis and right-click menus.
- React `.rv-dropdown` consumers in Header, Chat, Workspace Ribbon, Calendar, and Email.
- Native HTML `<select>` controls and native Electron/macOS menus.
- A global common-action catalog.
- Site-wide deletion of `contextMenu.ts`, `dropdown.css`, or any other non-Office implementation.

The deferred items are consumers of a later adoption SPEC. They are not fallback consumers, compatibility targets, or permission to add adapters in this extraction.

## Reference Behavior and Existing Debt

The reference system is the Office page menu family implemented by:

- `fusion-studio-client/src/components/office/officeTableContextMenu.ts`
- `fusion-studio-client/src/components/office/officeInsertMenu.ts`
- `fusion-studio-client/src/components/office/officeColorPopover.ts`
- the associated menu rules in `fusion-studio-client/src/components/office/OfficeDocumentPage.css`

The table menu already provides the important behavioral model:

- root and nested menus rendered over the page;
- pointer-relative placement with viewport clamping;
- side-menu flipping when the right edge lacks space;
- menu-item and menu-item-radio semantics;
- disabled-state handling;
- Arrow Up/Down focus movement;
- Arrow Right submenu entry;
- Arrow Left return to the parent menu;
- Escape closure of the entire stack with editor-focus restoration; and
- logical ownership of the color popover so clicks inside it do not dismiss the table menu.

The current implementation violates the intended modular boundary because its 1,000-plus-line table-menu module owns reusable DOM rendering and interaction mechanics alongside Office context capture, table validity, metadata mutations, color handoff, and editor focus. The insert menu and color-removal menu separately reproduce portions of the same surface machinery.

The extraction must preserve the mature behavior while moving ownership; it must not copy that behavior into another monolithic file.

## Shared Component Contract

### Required responsibility split

The implementation may choose exact filenames, but the resulting files must each have one describable job. The expected boundary is:

| Responsibility | Shared owner |
|---|---|
| Public descriptors, anchors, outcomes, and handle types | menu types module |
| Root/item/separator/submenu DOM rendering | menu surface component |
| Tree ancestry, registered child surfaces, updates, and closure | menu tree/lifecycle module |
| Root and child placement with collision handling | pure menu-positioning module |
| Component-scoped visual rules and variables | menu surface stylesheet |
| Office context capture, descriptor composition, and command callbacks | Office modules |

The shared component may create DOM and accept configuration/callbacks. It must not import Office modules, application stores, WebSocket clients, services, controllers, editor state, or network code.

### Data flow

```text
Office context capture
        |
        v
Office descriptor composition ----> Office action callbacks
        |
        v
Shared MenuSurface
  - DOM and ARIA
  - menu tree
  - position/collision
  - focus/keyboard
  - outcome handling
```

The shared component sees labels, icons, state, child descriptors, and callbacks. It never interprets a table command or decides whether an Office mutation is valid.

### Descriptor minimum

The shared descriptor union must cover only behavior proven by the Office reference:

- action item with stable instance ID, label, Material icon, callback, enabled/disabled state, optional disabled reason, and normal/destructive tone;
- separator;
- submenu trigger with child descriptors;
- radio item with checked state;
- a bounded external-child trigger that gives Office the rendered row anchor and a tree-registration lifetime without giving the shared renderer the external content; and
- optional secondary text for current values such as border width, color, or overflow mode.

Every interactive descriptor has a stable instance ID so open ancestry and focus can survive descriptor refresh. Every actionable Office row retains an icon or, for a radio choice, its existing checked-state indicator. An empty visual slot used only to preserve radio alignment is not presented to assistive technology.

The external-child hook is a narrow lifecycle and anchoring seam, not an arbitrary HTML/render callback. It must support only the current Office activation modes: the insert Table row opens its grid on hover while retaining its existing default click action, and Office color rows open their palette on activation. Color grids, number inputs, sliders, and table-layout grids remain outside the action-row renderer.

### Action outcome protocol

An action callback returns an outcome synchronously or asynchronously:

```ts
type MenuOutcome =
  | { kind: 'stay' }
  | { kind: 'back' }
  | { kind: 'close-current' }
  | { kind: 'close-levels'; count: number }
  | { kind: 'close-all' };
```

Normative behavior:

- `stay` preserves the active tree and permits descriptor refresh without losing the logical invocation target.
- `back` closes one side-menu level and focuses its parent trigger. At the root it is a no-op. Same-surface drill-down navigation is not part of this extraction.
- `close-current` closes the active floating menu surface and focuses the closest surviving parent item. At the root it is equivalent to `close-all`.
- `close-levels` requires a positive integer `count` and closes that many floating menu surfaces starting with the active surface. `count: 1` is equivalent to `close-current`; larger values are clamped at the root. If closure reaches the root, the tree performs the same post-action focus handling as `close-all`.
- `close-all` closes the entire tree and preserves the action callback's resulting focus and selection. If focus would otherwise remain in a removed menu node, the component uses a consumer-supplied post-action focus callback that must focus the owning surface without restoring the pre-action selection.
- Disabled actions run no callback and produce no outcome.
- While an asynchronous action callback is pending, that action cannot be activated a second time. A rejected or thrown callback is not treated as success; the tree remains open at the same logical level and the Office caller reports the failure through its existing path.
- Pointer and keyboard activation are normalized so one user activation invokes the callback exactly once. An outcome that resolves after its tree was closed or replaced is ignored and cannot restore stale focus or recreate a surface.

The consumer separately supplies an exact invocation-restoration callback for cancellation paths. Normal accepted Office mutation commands use `close-all` so a mutation-created selection is not rolled back; Escape uses the cancellation callback. Submenu triggers open or enter their child and do not implicitly dismiss the tree.

### Menu-tree and external-surface ownership

The component owns one root tree and any action-menu descendants it renders. It must also expose a bounded way for the caller to register a specialized external surface as a child of a stable menu item. The registered content remains Office-owned, while the shared tree owns cross-surface dismissal and teardown.

Registration means:

- pointer events inside the registered element are treated as inside the tree;
- the registration supplies a teardown callback that is invoked when the root tree closes;
- Escape still closes the full nonmodal tree and invokes that teardown;
- registration is removed idempotently when the element closes or the root tree is destroyed;
- a shared child action menu may be opened from an invoker inside the registered surface and remains part of the same tree; and
- the shared component does not render, inspect, or import the external surface's contents.

The shared tree is the sole owner of tree-wide outside-pointer and Escape listeners while an external surface is registered. The specialized controller may keep its internal listeners, positioning, and focus logic, but it must not install competing global dismissal listeners for the same open tree.

This is how the Office insert table-layout grid and color palette remain open beside their parent menus without turning the grid, swatches, or custom-color editor into menu rows. It also lets the custom-swatch Remove action use a shared child menu anchored to the external swatch.

### Update and focus contract

The returned menu handle must allow the owner to refresh shared-menu descriptors while preserving the root invocation, open ancestry, checked state, and active item when those stable IDs still exist. It must also allow focus to move to a shared menu item by stable instance ID after refresh. If an open item or ancestor no longer exists, the handle closes only the invalid descendant levels and focuses the closest surviving trigger.

The handle does not query or focus content inside a registered external surface. After a palette mutation is confirmed, the Office palette controller refreshes its own specialized DOM and focuses the confirmed swatch; the shared tree only preserves registration, ancestry, and dismissal ownership during that refresh.

### Keyboard and focus contract

- Opening a root menu focuses its first enabled item unless the caller requests a specific current item.
- Arrow Down/Up move cyclically among enabled items in the active menu.
- Home/End focus the first/last enabled item.
- Arrow Right or pointer hover opens an available submenu and may focus its first enabled item when entered from the keyboard.
- Arrow Left in a child performs `back`; Arrow Left at the root is a no-op.
- Enter and Space activate the focused item.
- Escape closes the entire nonmodal tree and runs the exact supplied invocation-restoration callback.
- Tab closes the entire tree, restores the supplied invocation target synchronously as the navigation origin, and does not prevent the browser's normal Tab or Shift+Tab movement.
- Outside-pointer dismissal does not restore the invocation target or prevent the pointer event; the newly clicked surface keeps its normal focus behavior.
- Closing one child restores focus to its parent trigger. Closing multiple levels focuses the nearest surviving logical trigger.

### Positioning contract

- Root menus support a pointer anchor and an element/rectangle anchor.
- Every root and child remains at least 8px inside the viewport.
- A child opens to the right when it fits and flips to the left otherwise.
- A child is vertically clamped without changing its logical parent.
- Resize repositions the tree without losing context, checked state, or invocation focus.
- Placement values are handled by the positioning module rather than repeated in Office.

### Visual contract for this extraction

The shared component owns the Office-reference menu geometry and exposes all values through component-scoped CSS variables with fallbacks. It must not create a second global menu stylesheet.

This extraction establishes the semantic aliases already recorded in the style guide:

- menu surface background derives from `--side-panel-surface-bg`;
- outer border derives from `--side-panel-foreground-color`;
- normal labels, icons, secondary text, and dividers derive from a mode-aware menu foreground based on `--text-primary`;
- destructive actions derive from `--status-error`; and
- hover/focus derive from the shared interactive-surface token made available by the active theme foundation, with a safe component fallback until that token exists.

Geometry values still marked open in the style guide are not silently ratified by this SPEC. Preserve the Office reference's current effective menu padding and radius as component fallbacks, name the variables neutrally, and leave later owner confirmation able to change the single shared definition.

## Office Ownership Contract

Office retains exclusive ownership of:

- context capture and the exact editor/table invocation target;
- table structure and title-row rules;
- current color, border, alignment, and overflow state;
- disabled-state reasons;
- ordering and grouping of Office commands;
- ProseMirror transactions, metadata steps, dirty state, save scheduling, and undo/redo;
- opening and rendering the color palette and custom-color editor; and
- reporting domain failures.

Office supplies descriptors and callbacks to the shared component. The shared component never calls a ProseMirror command, store action, custom event, or color service directly.

### Custom-color Add addendum

The current `officeColorPopover.ts` Add completion applies the new color by calling the pick path and then closes the palette. That behavior is superseded for this workflow.

After the user confirms a new custom color:

1. Office sends the existing palette Add mutation and waits for its accepted, server-confirmed projection.
2. The new color is not applied to the document or captured table target.
3. The palette and parent menu tree remain logically open.
4. The custom-color editor returns to the prior palette view.
5. The lower custom palette is refreshed from confirmed state.
6. The confirmed swatch is visible and receives focus. If the Add was accepted idempotently because the color already existed, the existing matching swatch receives focus.
7. Only a later swatch click applies that color through the existing Office color action; an accepted application then closes the intended menu tree and restores the editor target.

If the palette, document, workspace, or menu tree closes or changes before the Add acknowledgement returns, the confirmed store projection may still settle through the existing protocol, but the stale completion must not reopen a surface, move focus, or apply the color.

This changes picker presentation behavior only. It does not alter palette persistence, source selection, mutation protocol, table-color policy, metadata history, or undo semantics. Removing a custom color retains its current product behavior unless a separate owner decision changes it; the one-row removal action merely renders through the shared action-menu component.

## Vertical Slices

### Slice MENU.1 — Shared root surface through the Office insert menu

Create the portable types, component-scoped styles, root renderer, root positioning, basic focus/dismissal lifecycle, external-child registration seam, and action-outcome plumbing. Cut the ordinary action portion of `officeInsertMenu.ts` over to the shared component. Keep the table-layout grid's DOM, selection, and insertion behavior specialized; move its tree-wide dismissal ownership into the shared tree.

Required behavior:

- Right-clicking ordinary Office document content opens the shared root surface at the pointer.
- Table, Image, Divider, Bullet List, Ordered List, and Check List remain in their current order and groups with their current icons and callbacks.
- The surface stays inside all viewport corners.
- Arrow Up/Down, Home/End, Enter/Space, Escape, Tab, outside click, and focus restoration follow the shared contract.
- Hovering the Table item opens the specialized table grid, clicking the Table item retains the existing default table insertion, and selecting a grid cell retains the existing row/column insertion behavior.
- The grid registers against the Table item, clicks inside it are treated as inside the tree, and root closure tears it down. The grid is not rendered as menu rows and does not retain a second global outside-pointer or Escape listener.
- The old insert-menu DOM builder, root positioning, tree-wide dismissal listeners, and action-row CSS are removed once the shared path passes.

**Slice gate:** client build passes; shared-component contract tests exercise root outcomes and focus; focused Office menu tests exercise pointer and keyboard opening, ordinary actions, and the table grid from the public editor surface; a stale-symbol sweep finds no active old insert action-menu renderer or duplicated generic menu CSS.

### Slice MENU.2 — Nested Office table menu tree

Extend the shared component to own recursive side menus, radio choices, secondary labels, tree-aware collision handling, hierarchy focus, and every defined outcome. Convert the complete table context menu tree to Office-built descriptors rendered by the shared component.

Required behavior:

- Root Table, Cell/Row/Column Background, Insert, and Delete groups retain their existing composition and state rules.
- The Table submenu retains Add title row, border size/color, alignment, overflow, and Remove table in the accepted order.
- Border-size and overflow nested submenus retain their checked state and radio semantics.
- Pointer hover and Arrow Right open the correct child; Arrow Left returns exactly one level; root Arrow Left is a no-op.
- Escape from any level closes the entire tree and restores the exact editor cell/selection.
- Disabled title-row and structural actions remain visible/disabled exactly as the current Office rules and focused tests require.
- Every accepted table command dispatches the same Office mutation once and preserves history, selection, dirty state, and persistence behavior.
- All old table-menu DOM constructors, menu arrays, focus walkers, submenu placement, outside-click listeners, and generic menu CSS are removed from Office after equivalence is proven.

The Office table module may remain an integration owner, but it must no longer be the owner of both menu mechanics and table behavior. If it cannot be described in one sentence without combining responsibilities, split descriptor composition from invocation/action orchestration.

**Slice gate:** the component contract suite proves all five outcomes as distinct behaviors; all focused table structure, remove, alignment, border, overflow, title-row, geometry, and color-integrity tests pass through the public Office editor surface; corner-collision and pointer/keyboard submenu tests prove the Office integration rather than a helper-only fixture.

### Slice MENU.3 — Palette return flow, Office menu cleanup, and component acceptance

Use the shared tree's external-surface contract for Office color integration. Convert the custom-color one-row removal menu to a shared child action surface in the same tree. Implement the custom-color Add addendum and complete cumulative cleanup.

Required behavior:

- Opening Cell, Row, Column, or Border color keeps the parent menu tree alive while the palette is in use.
- Clicking inside the palette or custom editor is not treated as an outside click.
- Adding a color waits for confirmed palette state, returns to the palette, does not apply the color, does not close the tree, and focuses the confirmed lower-palette swatch.
- Clicking the confirmed swatch later applies the color once to the originally captured target, records the normal Office history/dirty/save effects, and closes according to the selected shared outcome.
- A rejected Add keeps the palette stable and reports through the existing Office error path without applying a color or falsely returning success.
- Right-click or keyboard invocation of the custom-swatch Remove action uses the shared surface and preserves the existing Remove mutation behavior.
- Destroying the editor, closing the root menu, switching documents, or closing the palette leaves no menu node, registered external surface, global listener, timer, or stale focus target.

**Slice gate:** focused palette client, selected-source sync, persistence, and Office table color tests pass with the new two-step Add-then-apply flow; cumulative Office and shared-component menu tests pass; build and stale-symbol sweeps confirm Office has one action-menu renderer and no duplicate generic menu mechanics.

## Verification and Acceptance

Run validation incrementally from `fusion-studio-client/`.

### Slice MENU.1

```bash
npm run build
npx playwright test --config=playwright.office.config.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-shared-menu.spec.ts \
  e2e/office-table-structure.spec.ts \
  e2e/office-table-remove.spec.ts \
  --project=chromium --workers=1
```

### Slice MENU.2

```bash
npm run build
npx playwright test --config=playwright.office.config.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-shared-menu.spec.ts \
  e2e/office-table-structure.spec.ts \
  e2e/office-table-remove.spec.ts \
  e2e/office-table-alignment.spec.ts \
  e2e/office-table-borders.spec.ts \
  e2e/office-table-overflow.spec.ts \
  e2e/office-table-title-row.spec.ts \
  e2e/office-table-geometry.spec.ts \
  e2e/office-table-color-integrity.spec.ts \
  --project=chromium --workers=1
```

### Slice MENU.3 and final cumulative gate

```bash
npm run build
npx playwright test --config=playwright.office.config.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-shared-menu.spec.ts \
  e2e/office-palette-client.spec.ts \
  e2e/office-palette-persistence.spec.ts \
  e2e/office-palette-sync.spec.ts \
  e2e/office-table-structure.spec.ts \
  e2e/office-table-remove.spec.ts \
  e2e/office-table-alignment.spec.ts \
  e2e/office-table-borders.spec.ts \
  e2e/office-table-overflow.spec.ts \
  e2e/office-table-title-row.spec.ts \
  e2e/office-table-geometry.spec.ts \
  e2e/office-table-color-integrity.spec.ts \
  --project=chromium --workers=1
```

Every gate must also:

- fail if the intended test selection matches zero tests;
- report changed files and exact commands/results;
- distinguish pre-existing warnings from new warnings;
- inspect the changed diff for unrelated edits;
- search for old Office generic menu constructors, listeners, and CSS selectors that should have been removed; and
- report residual behavior not exercised through a mounted Office editor.

`e2e/shared-menu-component.spec.ts` is the focused contract suite for outcome semantics and isolated lifecycle edges that Office does not naturally invoke. `e2e/office-shared-menu.spec.ts` is the mounted public-editor integration suite for insert actions, table-grid registration, shared selectors/ARIA, keyboard traversal, dismissal, and the two-step palette flow. Contract-harness success never substitutes for the Office integration evidence.

Build success alone does not prove menu behavior. Acceptance requires pointer and keyboard traversal through the public Office editor, all four viewport corners, focus restoration, nested-menu closure levels, async Add success/failure, and exact Office command effects.

### Final acceptance criteria

- Office insert and table action menus render through one portable shared component.
- The component contains no Office, store, service, WebSocket, editor, or network imports.
- Office retains all domain composition and mutation ownership.
- Root, side, and nested side menus use one rendering, positioning, lifecycle, and keyboard implementation.
- `stay`, `back`, `close-current`, `close-levels`, and `close-all` are implemented and verified as distinct outcomes in the shared-component contract suite; Office integration tests verify every outcome Office actually selects.
- Specialized color and table-layout widgets remain specialized while participating in the shared dismissal tree where required.
- Custom-color Add returns to a refreshed palette and never applies the new color until the user clicks its swatch.
- Existing Office table commands, radio/current states, disabled rules, history, save behavior, and invocation focus remain correct.
- Office duplicate generic menu mechanics and styles are deleted after cutover.
- No non-Office menu consumer is migrated or deleted.

## Non-Goals and Deferred Work

- No site-wide menu migration.
- No common action catalog.
- No replacement of Capture, Email, Header, Chat, Workspace Ribbon, Calendar, or native controls.
- No deletion of non-Office menu implementations.
- No conversion of color grids, table-layout grids, sliders, forms, or dialogs into action rows.
- No backend, database, WebSocket, palette-source, or persistence changes.
- No table-command, metadata-schema, history, undo/redo, or Markdown codec changes.
- No geometry decision for values still marked open in the style guide.
- No unrelated Office token, paper, Crepe-theme, or steel-blue cleanup.

The later adoption SPEC must re-inventory active menus at execution time, migrate consumers in bounded slices, and delete each replaced implementation only after its public behavior is accepted.

## Implementer Handoff

For each slice, return:

- files created, changed, and deleted;
- the responsibility of every new shared file in one sentence;
- the Office descriptor-to-action ownership map;
- the exact action outcomes exercised;
- pointer, keyboard, collision, focus, and async palette evidence;
- exact validation commands, durations, results, and warnings;
- stale-symbol results proving the replaced Office machinery is gone; and
- deviations or residual risks.

Do not report the component as site-wide or canonical-in-use outside Office. The terminal state of this SPEC is a proven shared component with Office as its first consumer and reference implementation.
