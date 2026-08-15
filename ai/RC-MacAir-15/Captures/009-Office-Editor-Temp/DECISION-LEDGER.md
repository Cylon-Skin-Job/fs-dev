# Office Editor Decision and Issue Ledger

**Bundle status:** `APPROVED — LIVING`
**Candidate ID:** `OE-009-RC1`  
**Release state:** `APPROVED`  
**Purpose:** Decision traceability for cross-SPEC work. Explicit current owner direction and `GUIDANCE.md` override conflicting historical entries.

> **OWNER SUPERSESSION — 2026-07-21:** The palette watcher/convergence/fanout/retry/journal design is retired. `sync_enabled` is a source selector only. True uses the one machine-global `System_Manager/global-configs/office-custom-color-pallete/colors.json`; false uses the workspace-local `ai/<machine>/System/config/colors.json`. Add/Remove write only the selected source; toggling preserves both arrays; drift is irrelevant; workspace open/switch reads the selected source without continuous watching. No merge, fanout, convergence, reconciliation, retry scheduler, removal journal, timestamp, or background recovery machinery is current authority. The revised rows below replace their historical versions.

## 1. Lifecycle and Classification

Resolution authority is `grounded_correction`, `owner_decision`, or `implementation_choice`. Dependency impact is `release_blocking`, `slice_blocking`, or `deferred_non_blocking`.

Lifecycle values are `open`, `awaiting_owner`, `decided_unpropagated`, `propagated_pending_review`, `validated`, `deferred`, or `blocked`.

All required owner decisions are ratified. Each row's current state controls; the 2026-07-21 palette supersession replaces the older OD/GD/IC palette text rather than reopening it.

## 2. Owner-Resolved Questions Pending Validation

| ID | Exact question | Grounded constraint and recommended ruling | Affected | Impact | State |
|---|---|---|---|---|---|
| OQ-001 | When the context menu is opened directly on the one-cell `<th colspan="N">` title row, what should the row/column structure commands do? | Ratified owner contract: treat the span as a title row, not as an arbitrary clicked logical column. Keep `Add title row`, `Insert Row Above`, `Delete Row Above`, `Insert Column Left`, `Insert Column Right`, `Delete Column Left`, and `Delete Column Right` visible but disabled, with no explanation text/tooltip. SPEC-08 exposes one exact title-context `Delete Row` action for the current row; it uses the ordinary generic header-deletion/promotion protocol and removes the title. Title Cell Background still targets `(0,0)`, Column Background still targets logical column 0 under GD-011, and overlay resize handles remain available. | 01, 08 | `release_blocking` | `propagated_pending_review` |

## 3. Owner Decisions

Decisions were recorded and clarified by the product owner on 2026-07-11.

| ID | Exact ratified contract | Affected | State |
|---|---|---|---|
| OD-001 | Preserve the GFM schema: one header row plus at least one data row. Generic row-0 insertion creates a new conventional header and demotes the former header. Deleting any header promotes the immediately following row—never the last row—and is disabled unless a data row remains. Invalid structural actions stay visible/disabled with explanation; one logical column is the minimum. | 01-03, 08 | `propagated_pending_review` |
| OD-002 | The only header-related menu feature is **Add title row**. It inserts one blank full-width `<th colspan="N">` at row 0 and demotes the former header. The item stays visible and is disabled whenever row 0 has one physical cell, including one-column tables, regardless of other rows. There is no Remove Title/Header or Footer action; ordinary Delete Row removes it under OD-001. | 06, 08-11 | `propagated_pending_review` |
| OD-003 | Never migrate/read/clear legacy Custom localStorage. A workspace local config selects its source: true uses the machine-global palette; false uses its preserved local array. First mutation materializes only the selected missing file. No workspace seeds, joins, copies, or synchronizes another workspace. | 04-05 | `validated` |
| OD-004 | Border width and color are independent. Width is exactly `1|2|3|4px`; there is no opacity or width-level None. Color None retains the selected width, renders a dotted `#ccc` guide at that width only in the editor, and produces no output border. A real color is solid at the selected width on every surface. | 09, 11 | `propagated_pending_review` |
| OD-005 | WYSIWYP for Print/PDF: Overflow remains clipped without ellipsis, Truncate remains clipped with ellipsis, and New line remains wrapped/native-break. DOCX stays reflowable/full-content. | 07, 11 | `propagated_pending_review` |
| OD-006 | Custom UI is a ten-column by two-row first-20 projection. `+` is absent whenever the selected complete array has 20+ colors and returns only at 19. Valid entries 21+ remain stored; reads never truncate/rewrite them. Right-click a visible Custom swatch for one nearby `Remove`. True removes only from the machine-global file; false removes only from the local file; neither changes existing document fills. | 04-05 | `validated` |
| OD-007 | Confirmed whole-table removal is one ordinary editor history action. Undo restores content plus all table metadata; Redo removes them again. | 06 | `propagated_pending_review` |
| OD-008 | The column minimum is a true square: `Wmin` equals the canonical one-line Office cell's automatic minimum outer border-box row height `Hmin`. Total `0.5ch` inline padding is inside that square (`0.25ch` per side), not added outside. Content-expanded rows do not feed back into the clamp; no row height is persisted or manually resized. | 03, 08-10 | `propagated_pending_review` |
| OD-009 | Table placement is authoritative and wrapper-relative: keyless defaults Left; Left/Center/Right reapply after outer resize. Document/paragraph alignment controls content flow, not table placement. Tables never float/wrap prose and no position offset is stored. | 03, 10 | `propagated_pending_review` |
| OD-010 | Remove table uses an application modal. Initial focus is Cancel; Tab is contained; Escape/Cancel are complete no-ops; outside click does not dismiss; focus returns to the invoking editor. | 06 | `propagated_pending_review` |
| OD-011 | The Sync Enabled/Disabled row is always visible. The flag selects global versus local; toggling writes only the local flag, preserves both arrays, and immediately switches the displayed source. | 05 | `validated` |
| OD-012 | Add a standalone presentation-output bridge. Preview/Print and PDF preserve selected overflow; PDF/DOCX/Print merge title rows; color None is absent from output; numeric real/default borders render at selected width in Print/PDF/DOCX and emailed equivalents. DOCX remains reflowable. Markdown remains canonical GFM plus frontmatter. | 11 | `validated` |
| OD-013 | Alignable blocks follow page alignment by current value. Map page Left→Left, Center→Center, Right→Right, and Justify→Center for the current table consumer. On effective `P_old` → `P_new`, every consumer effectively equal to `P_old` follows; differing consumers remain value-pinned. Pinning has no durable flag/rank, so a formerly pinned consumer rejoins when the page later matches it and follows the next page change. Center↔Justify is a table no-op; Center→Left/Right moves effective-Center followers. The policy is consumer-neutral, but SPEC-10 wires only tables; dividers, images, and code blocks adopt it in later work. Direct table alignment remains target-only. | 10, future block consumers | `propagated_pending_review` |

## 4. Grounded Contracts

| ID | Contract | Authority | Affected | State |
|---|---|---|---|---|
| GD-001 | Custom colors live in the selected file: global at `System_Manager/global-configs/office-custom-color-pallete/colors.json`, local at `ai/<machine>/System/config/colors.json`; never in document frontmatter or active localStorage. | Owner supersession 2026-07-21; OD-003 | 04-05 | `validated` |
| GD-002 | `sync_enabled` selects one palette source. There is no synchronization or convergence behavior. | Owner supersession 2026-07-21; OD-003/006/011 | 05 | `validated` |
| GD-003 | Picker sources are None, Google, and the selected file-backed Custom array. Existing document `tableColors` still renders but is never scraped into the picker. | `DECISIONS.md:26-29`; owner supersession 2026-07-21 | 04-05 | `validated` |
| GD-004 | A top-level Table submenu owns table-wide settings and Remove table; Cell/Row/Column actions remain in the root menu. | `DECISIONS.md:31-36`; `CAPTURE.md:391-395` | 06-10 | `validated` |
| GD-005 | Internal resize is equal/opposite adjacent-column redistribution; outer resize changes only the outer column and table width. | `DECISIONS.md:38-41` | 03, 10 | `validated` |
| GD-006 | Modes are Overflow, Truncate, and New line; new/keyless tables default Overflow; Fit Text is absent. | `DECISIONS.md:43-47` | 07, 11 | `validated` |
| GD-007 | Structural commands preflight one undispatched transaction and attach activated renderer transforms before one dispatch/first paint. | `DECISIONS.md:49-52`; `CAPTURE.md:80-88` | 01-03, 06-10 | `validated` |
| GD-008 | Remove table warning is exactly `All data inside the table will be lost.`; cancel is no-op; confirm removes only the captured table. | `CAPTURE.md:42-63`; OD-010 | 06 | `validated` |
| GD-009 | No versioning work and no provenance implementation/dependency; provenance elsewhere is preparation only. | Current owner direction | All | `validated` |
| GD-010 | Presentation code never imperatively writes editable cell/row DOM; use table chrome/descendant CSS and bounded ProseMirror-owned codecs. | Current Tables/Lessons Wiki | 07-10 | `validated` |
| GD-011 | Color cascade stays: explicit cell wins; otherwise higher rank; equal row/column rank resolves row. | Current Tables contract/renderer | 02, 08+ | `validated` |
| GD-012 | A semantic table-cell hard break round-trips as `<br>`; single-line modes present one space and New line presents a break without mode-driven content mutation. | `CAPTURE.md:332-337`; active codec constraints | 07, 11 | `validated` |
| GD-013 | Current Office and Email editors send indistinguishable document IPC shapes containing body Markdown; therefore OD-004/005/012 require an explicit optional Office-mode bridge. Absence of both mode fields preserves Email/other legacy callers; Office mode is independently source-bound and never falls back. | `office/useDocumentActions.ts:50-76,110-164`; `email/useDocumentActions.ts:50-76,110-164`; `document-handlers.cjs:31-80,88-155,203-214` | 11 | `validated` |

## 5. Bounded Implementation Choices

| ID | Choice boundary | Required outcome |
|---|---|---|
| IC-001 | Structure command/coordinator layout | Preflight exact next `TableMap`, attach immutable active-domain snapshots, dispatch once; failure/no-op is byte-equivalent. |
| IC-002 | Modal component layout | Exact OD-010 focus/dismissal contract outside editable DOM; Confirm is one supported transaction. |
| IC-003 | Shared table identity helper | Centralize current index/fingerprint fallback; preserve unknowns; do not invent persistent IDs. |
| IC-004 | `tableStyles` controller/module layout | Normalize/merge only owned fields, preserve siblings/unknowns, and support overflow/title marker/border/alignment. |
| IC-005 | Palette refresh lifecycle | Read the target workspace selector and selected source on open/switch/explicit refresh or acknowledged current-app mutation. Do not install a continuous palette watcher. |
| IC-006 | Palette ordering/projection | Preserve normalized selected-file order; UI alone projects the first 20. Never merge arrays across files or workspaces. |
| IC-007 | Disabled-action wording | State the actual boundary; never silently hide a generally valid command. |
| IC-008 | Title-row GFM codec | Literal `titleRow:true` only; N-cell GFM surrogate, alignment vector from logical/demoted columns, pre-paint rehydration, and stale continuation-content fail-closed. |
| IC-009 | Cold invalid selected palette | Return unavailable/error with zero writes and preserve bytes. A later open/switch/refresh may observe correction; there is no background watcher. |
| IC-010 | Invalid unselected palette | Ignore it. Only the selector and selected source participate in the current operation; never validate, rewrite, or report drift from the unselected array. |
| IC-011 | Pointer/layout math | `scale = clientWidth/offsetWidth`; internal/right use `round(clientDx/scale)`, left uses the opposite sign; freeze square minimum at pointerdown and guide the alignment-result boundary. |
| IC-012 | Table-cell hardbreak codec/node view | Exact table-cell `<br>` parse/stringify and stable explicit/inline node-view branches; no mode-driven content rewrite. |
| IC-013 | Palette removal | Perform one ordinary bounded mutation of the selected file. No fanout, removal journal, retry lifecycle, or recovery coordinator. |
| IC-014 | Output transformation internals | Atomically project body/full Markdown plus an ephemeral descriptor; bind it with whole-body/table-source SHA-256, logical width, and converter semantic matrices; structurally parse GFM/Pandoc JSON/HTML/DOCX with declared direct dependencies; bridge canonical DOCX table-cell breaks from trusted Pandoc `RawInline` to `LineBreak`; preserve the no-mode legacy branch; never regex tables or accept renderer HTML/CSS/path/arguments. |
| IC-015 | Border/minimum reconciliation | Render 1–4px real/dotted edge paint inset and layout-neutral inside the fixed SPEC-03 border box. `Hmin/Wmin`, row/cell/table used rectangles, and persisted widths do not depend on presentation stroke thickness. |

## 6. Deferred Non-Blocking Items

| ID | Item | Future gate/owner/trigger | Why non-blocking | State |
|---|---|---|---|---|
| DF-001 | Stable persistent table IDs across duplicate-table reordering | Office owner; trigger table move/reorder or reproduced misattachment | Current roadmap has no table reorder and tests in-place isolation | `deferred` |
| DF-003 | Fit Text overflow | Product owner plus shrink algorithm | Exact mode list excludes it | `deferred` |
| DF-004 | Native Office import/edit | Separate native-format roadmap | SPEC-11 exports presentation but does not import/edit DOCX | `deferred` |
| DF-005 | Generic save retry/in-flight queue defects | Save-reliability roadmap | Table smokes assert successful save/reopen without redesigning lifecycle | `deferred` |
| DF-006 | Shift-Enter semantic table-cell hardbreak authoring | Office owner; explicit editing request | SPEC-07 preserves existing `<br>` but does not add input behavior | `deferred` |
| DF-007 | Cell-background and table-alignment fidelity in PDF/DOCX | Output owner; trigger explicit expansion beyond OD-012 | SPEC-11 bridge is intentionally title/border/overflow only | `deferred` |
| DF-008 | Presentation-output formatting refinement | After the remaining feature work is complete, at owner direction | Owner accepted SPEC-11 on 2026-08-14 with known imperfect formatting and explicitly prioritized completing other features first | `deferred` |

## 7. Source-Question Disposition Coverage

| Raw issue group | Final disposition |
|---|---|
| Row-0 insertion/deletion/minima/silent failures | OD-001 + SPEC-01: custom preflight, immediate-next promotion, two-row/one-column minimum, visible disabled explanations. |
| Header/Footer/title meaning | OD-002 + SPEC-08: Add title row only, one spanning top cell, no Remove/Footer, generic deletion. |
| Color reindex/cascade/history | GD-007/GD-011 + SPEC-01/02/08: structure-safe shifts begin with the command cutover; direct color/cascade cleanup follows; spanning title stays anchored `(0,0)`; every action is one composite history event. |
| Resize minimum/outer anchoring | OD-008/009 + SPEC-03/10: true-square automatic minimum and authoritative wrapper alignment. |
| Legacy/browser/document palette sources | OD-003 + GD-001/003 + SPEC-04/05 owner supersession: atomic no-migration picker cutover to the selected global or local file. |
| Sync selector/toggle/removal/over-20 | OD-003/006/011 + SPEC-05 owner supersession: true selects global, false selects local, toggle preserves arrays, 10×2 UI, and Remove mutates only the selected file. |
| Remove table modality/Undo | OD-007/010 + GD-008 + SPEC-06. |
| Overflow/hardbreak/print/export | OD-005/012 + GD-006/012/013 + SPEC-07/11: selected Print/PDF mode, reflowable DOCX, bounded output bridge. |
| Border None/width/color/opacity | OD-004 + SPEC-09/11: independent width/color, no opacity, editor dotted, output absent. |
| Alignment/floating/wrapping | OD-009 + SPEC-10: keyless Left, wrapper-relative, no float/prose wrap/offset. |
| Plus-icon mismatch | Active code correction in SPEC-01: `add_2` → common `add`. |
| Merge/split/select-table/extra operations | Explicit SPEC-01 non-goals; no hidden future requirement. |

## 8. Grounded Corrections to Historical Capture

- Overflow defaults to clipping without ellipsis, not the stale Truncate heading.
- `officeColorPopover` is `.ts`, not `.tsx`.
- Existing color reindex helpers are repaired/orchestrated rather than duplicated in a guessed file.
- Insert Row Above alone currently uses `add_2`; normalize to `add`.
- Geometry currently uses first-row/right-edge assumptions; it must use logical `TableMap`/colgroup boundaries and both outer edges.
- Chromium does not turn `<br>` into a space under `nowrap`; SPEC-07 requires the bounded hardbreak codec/node view.
- Stock GFM serialization drops `colspan`; SPEC-08 requires the bounded marker/surrogate codec.
- Current output pipelines ignore `tableStyles`; SPEC-11 is required for actual Print/PDF/DOCX behavior.
