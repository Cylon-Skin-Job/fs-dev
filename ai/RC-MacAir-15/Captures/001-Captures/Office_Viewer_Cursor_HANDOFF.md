# Office Viewer Cursor Handoff

**Date:** 2026-07-06
**Area:** Office viewer document editor table resizing
**Status:** Table resize works on click/drag, but cursor affordance still needs verification and likely another pass.

## Where We Left Off

The current focus is Office table resizing inside the document editor. The user can click and drag table row/column resize bands, but the stationary cursor affordance has been unreliable. The working theory is that the editable Crepe/Milkdown/ProseMirror page is still reasserting the normal text cursor or page cursor when the pointer is stationary, especially after scrolling the page underneath the mouse.

The latest patch tried to make the Office resize layer own the cursor state more aggressively. It may or may not fully solve the issue in-app; this is the next thing to verify manually.

## Files To Start With

- `fusion-studio-client/src/components/office/officeTableGeometry.ts`
- `fusion-studio-client/src/components/office/OfficeDocumentPage.css`
- `fusion-studio-client/src/components/office/useCrepeEditor.ts`
- `fusion-studio-client/src/components/office/officeTableNodeView.ts`
- `fusion-studio-client/src/lib/front-matter.ts`
- `fusion-studio-client/src/components/office/OfficeDocumentPage.tsx`

## Current Implementation

`officeTableGeometry.ts` is an Office-owned geometry layer installed by `useCrepeEditor.ts`.

It currently:

- discovers `.rv-office-table` tables rendered by the Office table node view;
- applies saved table layout metadata from `metadata.tables`;
- measures and writes column widths and row heights back to document frontmatter;
- calculates a minimum row/column size from font metrics and cell padding;
- uses a coordinate hit test around table right/bottom borders;
- renders resize buttons in `.rv-office-table-resize-layer`;
- uses a 28 px hit target around each row/column resize band;
- sets `data-active="true"` on the current resize handle;
- adds body classes `rv-office-table-column-resize-hover` and `rv-office-table-row-resize-hover`;
- locks inline cursor styles on `documentElement`, `body`, the editor root, the active table layer, the active table, and the table wrapper while a resize target is active;
- syncs cursor state from the last pointer position during scroll;
- ignores MutationObserver changes inside `.rv-office-table-resize-layer` so the layer does not rebuild itself from its own hover/active state.

`OfficeDocumentPage.css` currently:

- raises `.rv-office-table-resize-layer` above Crepe table affordances with `z-index: 140`;
- sets `cursor: col-resize !important` / `row-resize !important` on the resize handles;
- applies broad body-class cursor overrides to the Office editor subtree;
- hides Crepe table `.handle` and `.drag-preview` elements in Office table blocks.

## Important Context

The user does not want Crepe's native table handles or row/column hover controls. Office should feel like a word processor controlled by our UI:

- Right-click on a table cell opens Office's table menu.
- Row/column insert/delete logic still uses Milkdown table commands.
- Width/height resizing is our overlay/controller.
- Table geometry persists in Markdown frontmatter under `metadata.tables`.
- Markdown table content remains Markdown; do not switch to inline HTML/CSS unless explicitly redesigning the document model.

## Known Symptom

The exact user report was:

> on click it works, but stationary it shows a cursor. We gotta change that, it doesn't look like you can click and drag, but you can.

Then:

> I think the whole page triggers from pointer to cursor as soon as you scroll onto it, so we're fighting the page default now.

So do not spend time proving drag works. The bug is visual/affordance: the cursor needs to communicate row/column resize when the pointer is in the resize band and not moving.

## Verification Steps

1. Start Fusion and open an Office document with a table.
2. Move to a column boundary and stop moving the mouse.
3. Confirm whether the cursor remains `col-resize`.
4. Move to a row boundary and stop moving the mouse.
5. Confirm whether the cursor remains `row-resize`.
6. Scroll the document so a table boundary moves under the stationary pointer.
7. Confirm whether the cursor updates without requiring another pointer move.
8. Drag a column and row, save, reopen, and confirm frontmatter `metadata.tables` preserves the geometry.

## If The Cursor Still Fails

The next likely fix is to stop depending on body/editor cursor overrides and make explicit overlay hit bands own the pointer target.

Recommended next direction:

1. Render fixed or absolute overlay bands that exactly cover the active resize zones.
2. Keep those bands in the DOM while the table is hovered or while the pointer's last known position is inside/near the table.
3. Give the bands `pointer-events: auto` and direct `cursor: col-resize !important` / `row-resize !important`.
4. Start drag from the band itself, not from a document-level coordinate fallback.
5. Avoid rebuilding the band under the mouse during hover unless table geometry actually changed.

If the table scroll container or page scroll makes absolute positioning unreliable, append the resize layer to `document.body` using viewport coordinates from `getBoundingClientRect()`. That would make the overlay independent of ProseMirror's editable DOM and table wrapper stacking behavior.

## Watch Outs

- `activeLayer.replaceChildren()` can remove and recreate the actual element under the cursor. If the cursor flickers after movement stops, reduce rebuild frequency or update handle positions in place.
- ProseMirror selection/cursor behavior may continue to fight broad cursor styles because the editable document is the underlying target. Direct overlay targets are more deterministic.
- The current body-class cursor override may be too broad for normal editing if it ever gets stuck. Cleanup must remove both body classes and inline cursor locks.
- The MutationObserver must ignore the resize layer itself; otherwise active-state writes can create render loops.
- `officeTableGeometry.ts` is currently untracked in Git status in this workspace. Do not assume it is part of the committed baseline.

## Last Verification Run

After the latest cursor-lock patch:

- `npm run build` passed in `fusion-studio-client`.
- `fusion-studio-client/scripts/restart.sh` completed successfully.

Manual in-app cursor verification is still the open item.
