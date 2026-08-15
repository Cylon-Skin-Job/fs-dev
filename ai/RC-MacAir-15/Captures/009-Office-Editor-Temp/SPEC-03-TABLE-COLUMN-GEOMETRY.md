# SPEC-03 — Table Column Geometry

**Domain:** Column-boundary resize behavior and width persistence  
**Depends on:** Accepted SPEC-02

## Objective

Make internal-border drags redistribute width between only the two adjacent columns while preserving total table width, and make left/right outer-edge width gestures resize only the outer column and table width under the owner-approved anchoring contract. Preserve the Office overlay/commit-on-release architecture, minimum widths, undo, zoom correctness, and frontmatter isolation.

## Existing Constraints

- `officeTableGeometry.ts` currently renders a handle only at each cell's right edge; the left outer edge is missing.
- Every current drag changes one column and therefore total table width.
- Widths are layout pixels persisted in `metadata.tables[].columns`.
- Current `readMeasuredLayouts()` reconstructs entries for every live table; replace that collection-wide writeback with target-entry merge/reindex operations so one resize cannot create/erase unrelated layout entries or sibling fields.
- The `<colgroup>` is baked into the Office node view. Drag preview stays in a body-level overlay and the table is written exactly once on pointer release.
- Row heights are content-sized and never manually persisted/resized. This SPEC derives one automatic minimum row height solely to establish the matching square column minimum.

## Geometry Contract

For internal boundary `i` between columns `i-1` and `i`, a signed delta `d` produces:

```text
left'  = left + d
right' = right - d
sum(columns') = sum(columns)
```

Clamp `d` so neither adjacent column drops below the square minimum below. Every non-adjacent column remains byte/numerically unchanged.

### Square minimum

At drag start, resolve the target table's canonical regular-cell minimum row height in unscaled CSS layout pixels:

```text
Hmin = ceil(max(computed min-height,
                 used line-height
                 + padding-block-start + padding-block-end))
Wmin = Hmin
```

Use the first physical cell in the first data row, never a spanning title cell, as the computed-style source. The GFM schema guarantees a data row. The canonical cell uses `box-sizing:border-box`; current/future table-edge presentation paint is inset/layout-neutral and is deliberately absent from this formula. SPEC-03 must make the legacy 1px grid obey that invariant, and SPEC-09's 1–4px real/dotted paint may not change row/column/table used geometry or the minimum. If `line-height: normal` or a non-pixel minimum requires used-value measurement, use an Office-owned detached/offscreen probe with the same computed typography and box rules; never insert a probe into editable ProseMirror DOM. Require finite positive values or cancel the gesture as a complete no-op.

The cell's total horizontal breathing room is exactly `0.5ch`, split as `0.25ch` on each inline side and contained inside—not added to—the square border box. A canonical empty/single-line cell at minimum is therefore a true `Hmin × Hmin` square at every later selected border width. Multiline or otherwise taller content may grow the row without changing `Wmin`; live content height and presentation stroke thickness never feed back into width. Sample `Hmin` once and freeze it for the gesture. Zoom affects only the client-to-layout conversion below.

Pointer conversion is exact. At drag start, require nonzero `table.offsetWidth` and resolve `scale = table.getBoundingClientRect().width / table.offsetWidth`. For current client coordinate x and start x0, `clientDx = x - x0` and `layoutDx = clientDx / scale`. Internal and right-outer gestures use `dRaw = round(layoutDx)`; left-outer uses `dRaw = round(-layoutDx)`, so moving either outer handle away from the table increases its adjacent column. Internal clamp is `d = clamp(dRaw, minimum - left, right - minimum)`. Either outer clamp is `d = max(dRaw, minimum - outerWidth)`. Persist only this integer effective d.

For either outer gesture, only its outer column changes and total table width changes by effective d. Let the pre-drag client rectangle be `[L,R]`, `C=(L+R)/2`, and `q=d*scale`. Alignment is authoritative: the post-alignment rectangle is Left `[L,R+q]`, Right `[L-q,R]`, or Center `[L-q/2,R+q/2]`. The right-handle guide is the resulting R boundary and the left-handle guide is the resulting L boundary. Thus under default Left, a left outward drag of `clientDx=-30` at scale 1 produces `d=+30`, grows only column 0/table by 30, and leaves the left guide at L; an inward `clientDx=+30` produces `d=-30` subject to minimum and also leaves that guide at L. The overlay never promises the raw pointer coordinate when alignment anchors another boundary. No position/offset field is persisted.

## Vertical Slices

### Slice 03.1 — Pure resize math

Extract/test a pure resize planner for internal, left-outer, and right-outer boundaries. Cover positive/negative deltas, the ratified minimum/clamps, 1/2/N columns, fractional zoom scale, the ratified anchoring preview, and invariant sums.

**Slice gate:** tests prove internal total equality, exactly two changed indexes internally, exactly one changed index externally, and no output below minimum. Numeric cases include scale 1 left `clientDx=-30/+30`, scale 0.8 `-24/+24`, and scale 1.25 `-37.5/+37.5`, all resolving to effective `+30/-30` before clamp, plus symmetric right-handle cases and exact clamped guide rectangles.

### Slice 03.2 — Complete overlay boundary model

Render `N+1` logical boundary targets for an N-column table: two outer edges and N-1 internal edges. Derive N from `TableMap.get(tableNode).width` and the `<colgroup>`, never `node.firstChild.childCount` or first-row physical cells; SPEC-08's one-cell spanning title must still yield all logical columns and handles. Keep grab targets in the body overlay, positioned from colgroup/logical-grid rectangles, with a consistent resize cursor and active guide.

Reconcile targets after row/column mutation, scroll, zoom, resize, and ProseMirror rebuild. Do not add handles inside editable DOM.

In the Node-side portion of `e2e/office-table-geometry.spec.ts`, construct a real installed-schema table node directly with one header cell `colspan=4` plus one four-cell data row. Pass it to the exported logical-column/node-view planner without Markdown serialization; assert `TableMap.width === 4`, four col definitions, and five boundary plans. This is a pure schema/logic case, not a persisted browser fixture; SPEC-08 owns the first real serialized/reopened title-row browser case.

**Slice gate:** browser assertions locate both outer handles and every internal handle for ordinary 1-, 2-, and 4-column tables at 80%, 100%, and 125% zoom; the constructed real-schema colspan case proves the logical count/plan without depending on the not-yet-installed SPEC-08 codec.

### Slice 03.3 — Commit, persistence, and history

On pointerup, dispatch SPEC-01's `OfficeTableMetadataStep` carrying the exact before/after width snapshots, apply the accepted snapshot to `<colgroup>` once through its plugin callback, persist one normalized layout update, and mark dirty once. The metadata Step itself is the ProseMirror history event for this document-unchanged operation. Internal changes undo/redo both adjacent widths together; outer changes restore the one outer width and table width. Do not add an independent geometry undo stack.

If the clamped effective widths equal the starting widths, finish cleanup without a Step, DOM/frontmatter write, dirty mark, or save. `pointercancel`, lost pointer capture, window blur, Escape, or a target table disconnected before release cancels the drag and performs the same complete no-op cleanup. Cancellation removes the guide/active body state, releases capture when possible, and reconciles handles from current live geometry; it never commits the last preview coordinate.

Retain and cumulatively verify SPEC-01's accepted column-structure result: a successful column insert/delete keeps a present saved width array aligned. On insert, the selected anchor column's persisted width (clamped to the ratified minimum) is copied into the exact new index, increasing total persisted width by that value; if the table had no layout entry, insertion creates none. On delete, the exact deleted index is removed, decreasing total by that width. All other indexes stay attached to the same logical columns. A failed mutation leaves width metadata byte-equivalent. A row-only mutation preserves the width array but refreshes `tableIndex`/fingerprint after the new header/content settles. Undo/Redo restores the matching pre/post array and identity with the structure.

Structural `metadata.tables` width/identity atomicity remains active from SPEC-01 alongside color. This packet activates direct resize commits and their geometry/history contract. `tableStyles` remains preserved but does not join row/column structural snapshots until SPEC-07.

Preserve `metadata.tableColors`, seeded/future `metadata.tableStyles`, unknown frontmatter, and unrelated table layouts.

**Slice gate:** DOM bounding boxes and parsed frontmatter agree within one layout pixel after drag, structural column insert/delete, undo, redo, save, and reopen. Zero-delta/clamped-zero, pointercancel, lost-capture, blur, Escape, and disconnected-target branches each prove zero Step/callback/dirty/save/frontmatter change and complete overlay cleanup.

### Slice 03.4 — Cross-feature and stress regression

Exercise minimum clamps, rapid sequential drags, structural insert/delete followed by drag, colored tables, horizontal scrolling, and single-column outer drags. Ensure no per-frame writes, observer loop, caret jump, or persisted row heights.

After accepted behavior passes, update only the exact Tables and Lessons `PAGE.md` paths listed under Expected Changed Areas.

**Slice gate:** all ordinary one-/three-/four-column and long-content fixtures plus the constructed spanning-schema planner case pass exact pointer/clamp/guide assertions and cumulative structure/color smokes. At the clamp, an ordinary canonical one-line cell's actual outer width and outer height are equal within one layout pixel at 80/100/125% zoom; computed inline padding is `0.25ch` per side; long content does not raise the frozen minimum. A pure box-model test passes synthetic 1px and 4px presentation-stroke inputs and proves they are excluded from identical `Hmin/Wmin` results; this adds no border UI/metadata. SPEC-08 cumulatively proves New line/title content, and SPEC-09 cumulatively proves actual stroke changes leave rectangles fixed. Write/observer counters remain bounded, save/reopen preserves layouts, and only verified behavior is documented.

## Expected Changed Areas

- `fusion-studio-client/src/components/office/officeTableGeometry.ts`
- `fusion-studio-client/src/components/office/officeTableNodeView.ts` for colspan-aware logical column count
- new `fusion-studio-client/src/components/office/officeTableResizePlan.ts`
- `fusion-studio-client/src/components/office/officeTableHistory.ts` only for the width snapshot payload
- `fusion-studio-client/src/components/office/OfficeDocumentPage.css`
- `fusion-studio-client/e2e/office-table-geometry.spec.ts`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/000-Fusion_Home/001-Lessons/PAGE.md`

## Acceptance Criteria

- Internal drags change exactly two adjacent columns by equal/opposite clamped amounts and preserve total table width.
- Outer drags change exactly one outer column and total width; a one-column table has only two outer handles.
- No column goes below the exact ratified `OD-008` minimum.
- The frozen minimum equals the canonical regular row's computed outer minimum height exactly; `0.5ch` inline padding remains inside a true square, while multiline content and layout-neutral 1–4px edge paint never change that minimum or create a feedback loop.
- Only the overlay guide moves during pointermove; table/colgroup writes occur once on pointerup.
- Zero-effective-delta and every cancellation/lost-target branch are cleanup-only no-ops with no history Step, persistence callback, dirty state, or save traffic.
- Undo/redo, save/reopen, editor rebuild, scroll, and zoom preserve exact accepted widths.
- Verified column insert/delete reindexes the width array at the exact mutation index; failed mutations do not change it.
- For a present layout, inserted width copies the selected anchor column and deletion removes the target width; a keyless table stays keyless.
- Row-only mutations preserve width values while refreshing identity, including the header-changing row-0 path.
- Pointer conversion/sign, clamps, and outer guide/committed rectangles exactly match the formulas above and ratified `OD-009`; no unapproved offset field is introduced.
- Geometry changes never erase color/style/unknown metadata or create row-height metadata.
- A target-table resize merges only that layout entry; it neither creates layouts for untouched/keyless tables nor reconstructs/erases unrelated entries.
- No rebuild loop, caret reset, or cell DOM mutation occurs.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/components/office/officeTableGeometry.ts src/components/office/officeTableNodeView.ts src/components/office/officeTableResizePlan.ts src/components/office/officeTableHistory.ts e2e/office-table-geometry.spec.ts
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts e2e/office-table-color-integrity.spec.ts e2e/office-table-geometry.spec.ts --project=chromium --workers=1
```

The Playwright test must assert numeric bounding boxes and persisted arrays; screenshots alone do not pass.
All pure resize-planner/minimum/identity matrices required by this packet live in `e2e/office-table-geometry.spec.ts` (Node-side Playwright tests may omit a page fixture). No additional unnamed test file is permitted.

## Manual Electron Smoke

Run `node e2e/office/run-isolated-electron.mjs --scenario=geometry --copies=8`. Drag every boundary type at normal and non-100% zoom, hit both ratified minimum clamps, exercise Escape/blur/cancel and zero-delta branches, verify the `OD-009` guide/anchor rectangles, undo/redo, save/reopen, and inspect that the guide moves smoothly while the table commits only on accepted release.

## Non-Goals

- Row-height resize or persistence.
- Changing table alignment (SPEC-10), cell text alignment, or overflow.
- New width units; persisted widths remain layout pixels.
- Live per-frame table resize, versioning, or provenance.

## Worker Handoff

Do not start until the orchestrator declares this exact packet released. Follow `GUIDANCE.md`. Report the row-minimum inputs/result, numeric pre/post widths, total sums, clamp evidence, anchor/guide rectangles, write-count evidence, and exact commands. Return `READY_FOR_ORCHESTRATOR_REVIEW` or `BLOCKED`.
