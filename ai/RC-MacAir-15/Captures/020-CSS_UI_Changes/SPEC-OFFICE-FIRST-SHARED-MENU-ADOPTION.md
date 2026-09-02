# SPEC — Office-First Shared Menu Adoption and Legacy Cleanup

> **Status:** Draft for owner review. This document defines an executable follow-on package but does not itself authorize product-code changes.
>
> **Scope:** Adopt the accepted shared menu component across the remaining ordinary Office action menus, migrate the complete legacy `showContextMenu()` caller set required to remove that renderer, preserve specialized form popovers, and prove the result through Office-first public behavior.

## Purpose and Authority

The completed shared-menu extraction established `fusion-studio-client/src/components/menu/` and proved it through the Office editor's insert, table, color, and custom-color action menus. That extraction deliberately deferred the rest of the application.

The next bounded step is to make the remainder of the Office view use the same action-menu paradigm without misclassifying sliders and forms as menus or leaving a second generic renderer behind.

This SPEC follows the owner direction to begin with Office, adapt its remaining menus, and remove code made unnecessary by the cutover. It also follows the established universal-menu direction in D-7 and the enduring goal in `INTENT.md`.

Current code remains authoritative for action order, labels, icons, enabled state, mutations, confirmation flows, output payloads, focus effects, and persistence unless this SPEC explicitly says otherwise. This package changes menu presentation and lifecycle ownership; it does not redesign Office commands.

### Prerequisite baseline

This package assumes the accepted shared component already provides:

- typed actions, separators, radio items, nested submenus, and external-child registration;
- pointer, element, and rectangle anchors;
- viewport clamping and child-menu flipping;
- keyboard traversal, cancellation restoration, and post-action focus handling;
- live descriptor updates with stable IDs;
- async single-flight behavior and stale-completion protection; and
- explicit `stay`, `back`, `close-current`, `close-levels`, and `close-all` outcomes.

The implementation must extend that contract only for a behavior proven necessary by a migrated consumer. It must not fork an Office-specific copy of the shared component.

## Current Inventory and Adoption Boundary

### Already migrated and not to be rebuilt

The following Office editor surfaces already use the shared component:

- ordinary editor insert context menu;
- specialized insert Table grid's shared dismissal registration;
- root and nested table context menus;
- Cell, Row, Column, and Border color palette registration;
- custom-color Remove child action menu; and
- the confirmed two-step custom-color Add workflow.

This SPEC may run their regression tests, but it must not recreate or independently redesign them.

### Remaining ordinary Office action menus

| Surface | Current owner | Current implementation | Required destination |
|---|---|---|---|
| Office sidebar **New** | `OfficeGrid.tsx` | React-rendered `.rv-dropdown`, local open state, document-level dismissal listeners | Shared root menu anchored to the New button |
| Document **Export** | `OfficeDocumentTopbar.tsx` plus state/listeners in `OfficeDocumentPage.tsx` | React-rendered root and hover submenus with Office-only CSS | Shared nested menu anchored to the Export button |
| Office file/folder right-click and ellipsis actions | `useFileTileMenu.ts` | Legacy `showContextMenu()` renderer | Shared root menu with pointer or element anchor |

These are action menus and must render through the shared action-menu component after migration.

### Shared legacy caller boundary

`useFileTileMenu.ts` is not Office-only. Its current consumers include Office, Capture, Email, and shared tile rows. `CaptureDocumentMenuButton.tsx` is the other direct `showContextMenu()` caller and is mounted by Capture, document preview, and ticket surfaces.

Deleting `fusion-studio-client/src/lib/contextMenu.ts` therefore requires a coordinated caller cutover. This SPEC includes those supporting caller migrations only to retire the old generic renderer without introducing an Office-only adapter or leaving two action-menu systems active.

The non-Office consumers retain their current domain actions, labels, optional icons, ordering, confirmation behavior, and focus results. They are supporting compatibility consumers, not a license to redesign Capture, Email, Ticket, or shared tile UI.

### Specialized popovers that remain specialized

The following Office controls are not action menus:

- Page Margins, which contains labeled numeric inputs; and
- Paper Brightness, which contains a range control and is shared with Email.

They must not be flattened into `MenuDescriptor` action rows. Their current compact presentation, value ownership, persistence, keyboard-native inputs, and mutual exclusion remain unchanged. Their local popup lifecycle stays in place until the separately directed standardized-popup system supplies a suitable root-popover contract.

Their CSS and listeners are not stale menu code under this SPEC.

## Shared Adoption Contract

### React consumer boundary

React surfaces may own trigger refs, domain callbacks, and descriptor composition. The shared menu tree owns the floating action-menu DOM, ARIA roles, focus traversal, placement, outside-pointer dismissal, Escape/Tab behavior, and teardown.

A migrated React consumer must not retain a second rendered menu tree or document-level dismissal effect. If a small reusable React hook is needed to manage the imperative handle and unmount cleanup, it belongs under `src/components/menu/`, remains domain-neutral, and must not import application stores, Office modules, services, WebSocket clients, or file actions.

### Invocation and anchoring

- Button-triggered menus use an element or captured rectangle anchor.
- Right-click menus use the pointer coordinates from the accepted event.
- Ellipsis menus anchor to the invoking button rather than reconstructing its position in each caller.
- Opening a menu closes or replaces any prior handle owned by that consumer.
- Unmounting the owning surface closes its open tree idempotently.
- A trigger that becomes disabled while its menu is open closes that tree without leaving focus in removed DOM.

### Focus and dismissal

- Opening from a button focuses the first enabled row unless a stable current item is explicitly requested.
- Escape closes the full tree and restores the exact invocation trigger.
- Tab closes synchronously, restores the invocation trigger as the navigation origin, and allows native Tab or Shift+Tab movement.
- Outside-pointer dismissal does not steal focus from the newly clicked target.
- Closing an accepted action preserves the action's resulting focus. If focus would otherwise remain in removed menu DOM, the caller supplies the appropriate post-action focus destination.
- Nested Export submenus use Arrow Right/Left and hover behavior from the shared contract.
- Disabled or pending actions cannot be activated twice.

### Descriptor and visual rules

- Every interactive row has a stable instance ID.
- Existing labels, Material icons, grouping, destructive tone, and order remain consumer-owned.
- A current action that has no icon is not assigned a new icon merely for visual uniformity.
- Separators are descriptors, not consumer DOM.
- The shared component's classes and CSS variables provide menu visuals. Office and legacy context-menu selectors are removed only after their final consumer is accepted.
- Consumers may style their trigger buttons, but must not restyle shared menu rows through view-specific descendant selectors.

### Legacy renderer retirement

The terminal state has no active import of `showContextMenu`, no injected `.rv-context-menu` stylesheet, and no compatibility wrapper that recreates its DOM or lifecycle.

`src/lib/contextMenu.ts` is deleted only after both of its direct caller paths have moved:

1. `useFileTileMenu.ts`; and
2. `CaptureDocumentMenuButton.tsx`.

If an additional active caller is discovered at execution time, it must be migrated and tested or deletion must stop and the deviation must return to the owner. Silent fallback to the legacy renderer is not allowed.

## Office Action Ownership

### Office sidebar New

Office retains the `OFFICE_NEW_MENU_ITEMS` ordering and the callbacks that open create/import flows. The shared component receives descriptors only.

Required current order and grouping:

1. New folder
2. separator
3. Import file
4. Import Folder
5. separator
6. New Document

The current product behavior of every row must be preserved. This SPEC does not implement a missing import workflow, change capitalization, reorder rows, or convert currently inert behavior into a new command.

Accepted actions close the menu once and call the corresponding Office callback once. Cancellation restores the New trigger.

### Document Export

Office retains output preparation, export/email/print APIs, presentation descriptors, busy state, errors, and payload ownership. The menu descriptor tree is:

- Export DOCX
  - Email
  - Folder
- Export PDF
  - Email
  - Folder
- Email Markdown
- separator
- Preview PDF

The first two rows are shared submenus. Pointer hover and Arrow Right open them; Arrow Left returns one level. Email Markdown and Preview PDF remain root actions.

When `exportingFormat` is non-null, the trigger and applicable actions remain unavailable. A user activation invokes exactly one existing output path. The menu closes according to the accepted action outcome without changing the generated body, presentation mode, table-presentation descriptor, filename, or format.

### File and folder actions

`useFileTileMenu.ts` retains composition and domain ownership for:

- Star / Unstar;
- Pin folder / Unpin folder;
- Rename;
- Archive / Restore; and
- Delete.

The hook continues to delegate mutations and dialogs to `viewCollections` and `useTileFileActions`. The shared component does not learn file paths, panels, workspaces, archive policy, or deletion policy.

Right-click and ellipsis invocation of the same target produce the same action set and effect. The only anchor difference is pointer versus trigger element.

### Capture document action support

`CaptureDocumentMenuButton.tsx` retains its current caller-controlled Rename, Archive, and Delete callbacks plus the existing Make a Copy row. This supporting migration changes its renderer and lifecycle only. It does not create missing Make a Copy behavior or alter which rows are present when optional callbacks are absent.

## Vertical Slices

### Slice ADOPT.1 — Office New menu

Move the Office sidebar New action menu from React-rendered `.rv-dropdown` DOM to the shared menu component.

Required behavior:

- The New button remains in its current location and styling.
- Pointer click, Enter, and Space open the shared root menu below the trigger.
- The six current rows/groups retain exact order, labels, icons, and callbacks.
- Arrow Up/Down, Home/End, Enter/Space, Escape, Tab, and outside click follow the shared contract.
- The menu clamps at narrow and short viewport edges.
- Repeated opening does not accumulate global listeners or orphan surfaces.
- Office create-folder and create-document flows receive exactly one invocation.
- Current Import file and Import Folder behavior is preserved without inventing functionality.
- `OfficeGrid.tsx` loses its local menu DOM, open-state effect, and document listeners.
- `.rv-office-new-dropdown`, `.rv-office-new-menu-item`, and `.rv-office-new-menu-separator` rules are removed when no longer used; trigger-only rules may remain.

If extracting a trigger/controller from the already-large `OfficeGrid.tsx` is necessary to keep one responsibility per file, do so rather than adding another lifecycle to that module.

**Slice gate:** client build; nonzero focused test selection; mounted Office home tests for pointer/keyboard opening, order, actions, cancellation, outside dismissal, collision, and repeat teardown; stale-symbol sweep for the old New menu DOM/listeners/CSS.

### Slice ADOPT.2 — Office Export nested menu

Convert the complete document Export tree to Office-built descriptors rendered by the shared component.

Required behavior:

- The existing Export trigger, title, busy icon, and disabled behavior remain.
- Root order and both DOCX/PDF child orders remain exact.
- Hover and keyboard submenu entry, one-level return, root cancellation, and collision follow the shared contract.
- DOCX/PDF Folder and Email, Email Markdown, and Preview PDF each dispatch exactly one existing output request.
- The exact Markdown body, filename, presentation mode, table descriptor, and format remain unchanged.
- Pending output cannot be invoked a second time.
- Rejection continues through the existing Office error path and does not falsely report success.
- `OfficeDocumentTopbar.tsx` remains a renderer of the trigger and page chrome; domain output work stays outside the shared menu package.
- `OfficeDocumentPage.tsx` loses export-only open state, refs, outside listeners, and cleanup once the shared handle owns them.
- Old Export root/submenu action-row CSS is removed after mounted equivalence is proven.

**Slice gate:** client build; shared component regression; mounted pointer and keyboard Export tests; existing Office output-payload and table-presentation-output suites updated to shared roles/stable IDs; stale-symbol sweep for the old Export DOM, hover submenu, listeners, and generic action CSS.

### Slice ADOPT.3 — Shared file actions and `showContextMenu()` retirement

Migrate `useFileTileMenu.ts` and `CaptureDocumentMenuButton.tsx` directly to the shared component, then delete the legacy renderer.

Required behavior:

- Office file/folder right-click and ellipsis menus use the shared surface.
- All current file/folder labels, conditional states, order, and destructive treatment remain.
- Right-click uses the pointer anchor; ellipsis uses the invoking element anchor.
- Escape/Tab restore the exact tile or ellipsis invocation target as appropriate.
- Accepted Star/Pin, Rename, Archive/Restore, and Delete paths run once and preserve their existing resulting focus, modal, and persistence behavior.
- Capture, Email, shared TileRow, preview, and ticket mounts affected by the same migrated callers retain their current behavior.
- Capture document action rows remain conditional exactly as today.
- No consumer adds its own generic row renderer, injected stylesheet, window placement, or tree-wide dismissal listeners.
- `src/lib/contextMenu.ts` is deleted after an execution-time import sweep proves there are no callers.
- `.rv-context-menu`, `.rv-context-menu-item`, and `.rv-context-menu-item-danger` disappear with that file.

This slice may add shared descriptor-composition helpers only when they are domain-neutral. File actions and collection mutations stay in their current hook/controllers.

**Slice gate:** client build; nonzero test selection; mounted Office file and folder menus by pointer and ellipsis; focused support checks for every actual non-Office mount reached through the changed callers; action-effect and focus evidence; import and runtime-style sweeps proving `showContextMenu()` is gone.

### Slice ADOPT.4 — Cumulative Office acceptance and cleanup

Audit the full Office view after all action-menu migrations.

Required behavior:

- The only Office action-menu renderer is the shared component.
- Insert, table, color Remove, New, Export, and file/folder action menus share one lifecycle/keyboard/positioning implementation.
- Margins and Paper Brightness remain correctly classified specialized popovers with no behavioral or visual regression.
- No migrated menu retains local document/window dismissal listeners, placement math, focus walker, action-row constructor, or generic menu stylesheet.
- No active shared-menu consumer imports Office, file-domain, store, WebSocket, editor, or output-service code into `src/components/menu/`.
- All migrated menus remain usable in light and dark themes through the shared token contract.

**Slice gate:** cumulative focused menu tests, build, stale-symbol and forbidden-import sweeps, changed-diff inspection, listener-leak checks, and an Office visual smoke in both light and dark modes.

## Verification and Acceptance

Run validation incrementally from `fusion-studio-client/`.

### ADOPT.1 gate

```bash
npm run build
npx playwright test --config=playwright.office.config.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-menu-adoption.spec.ts \
  --project=chromium --workers=1
```

### ADOPT.2 gate

```bash
npm run build
npx playwright test --config=playwright.office.config.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-menu-adoption.spec.ts \
  e2e/office-table-presentation-output.spec.ts \
  e2e/office-document-output-payloads.spec.ts \
  --project=chromium --workers=1
```

### ADOPT.3 gate

```bash
npm run build
npx playwright test --config=playwright.office.config.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-menu-adoption.spec.ts \
  e2e/office-shared-context-menu-consumers.spec.ts \
  --project=chromium --workers=1
```

### Final cumulative gate

```bash
npm run build
npx playwright test --config=playwright.office.config.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-shared-menu.spec.ts \
  e2e/office-menu-adoption.spec.ts \
  e2e/office-shared-context-menu-consumers.spec.ts \
  e2e/office-table-presentation-output.spec.ts \
  e2e/office-document-output-payloads.spec.ts \
  --project=chromium --workers=1
```

The two new test filenames are required public-route suites to be created by this package. Test contents, not filenames alone, determine acceptance.

Every gate must:

- fail if the intended selection matches zero tests;
- record exact commands, selected counts, durations, passes, failures, and warnings;
- distinguish a product defect from an invalid or stale test oracle with direct evidence;
- exercise pointer and keyboard invocation through mounted UI rather than helper-only fixtures;
- verify action effects, not only menu visibility;
- inspect focus after cancel, accepted actions, modal-opening actions, and outside pointer dismissal;
- verify root and nested collision at constrained viewport edges;
- inspect the changed diff for unrelated edits in the dirty worktree;
- search for forbidden domain imports in the shared component;
- search for removed selectors, constructors, listeners, state variables, and legacy imports; and
- report any consumer not reached through a mounted test.

### Final acceptance criteria

- Every ordinary action menu visible in the Office view renders through `src/components/menu/`.
- Office owns its commands and state; the shared component owns generic menu DOM and lifecycle.
- New and Export retain exact composition, keyboard behavior, output/action effects, and disabled states.
- Office file/folder right-click and ellipsis menus are behaviorally equivalent and use pointer/element anchors correctly.
- All actual callers needed to remove `showContextMenu()` are migrated without redesigning their product surfaces.
- `src/lib/contextMenu.ts` and its runtime-injected CSS are deleted with no active import or compatibility renderer remaining.
- Margins and Paper Brightness remain specialized form popovers and are not forced into action descriptors.
- Existing shared Office editor menus remain green.
- Shared menu styling remains token-driven and view-neutral.
- No non-menu control, native menu, or unrelated application dropdown is migrated accidentally.

## Non-Goals and Deferred Work

- Header Actions, Connectors, Chat, Workspace Ribbon, Calendar, Tools Panel, Sidebar thread menus, and unrelated `.rv-dropdown` consumers.
- Email document Export or Margins menus; only file-tile behavior necessarily reached through the shared changed caller is included.
- Replacing Page Margins, Paper Brightness, color grids, sliders, forms, dialogs, or native controls with action rows.
- Designing the future standardized root-popover component.
- Adding Import file, Import Folder, or Make a Copy functionality that does not currently exist.
- Changing file collection, archive, rename, delete, output, email, print, or persistence semantics.
- Changing Office editor commands, tables, palette persistence, paper presentation, brightness, or Markdown codecs.
- Redesigning menu geometry, icons, terminology, colors, or interaction timing.
- Deleting global dropdown styles still used by deferred consumers.
- Backend, database, WebSocket protocol, Electron native-menu, or Alpha deployment work.

The next adoption package must re-inventory the remaining Header, Chat, Workspace, Calendar, Email document, Tools Panel, Sidebar, and other active menu implementations at execution time.

## Implementer Handoff

For each slice, return:

- files created, changed, and deleted;
- one-sentence responsibility for every new module;
- the trigger-to-descriptor-to-domain-action ownership map;
- exact action outcomes selected by each consumer;
- pointer, keyboard, focus, collision, async, and teardown evidence;
- exact validation commands, counts, durations, results, and warnings;
- stale-symbol/import results proving replaced renderers and listeners are gone;
- mounted coverage for supporting non-Office callers changed by legacy-renderer retirement;
- deviations, compatibility seams, untested mounts, and downstream impact; and
- confirmation that specialized Margins and Brightness popovers were preserved rather than mislabeled as action menus.

Do not call this a site-wide menu migration. The terminal state is an Office-complete action-menu adoption, deletion of the legacy `showContextMenu()` renderer through its bounded caller set, and an explicit remaining-consumer inventory for later packages.
