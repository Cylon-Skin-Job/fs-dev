# Chunk 1 Report — Table-Resize Cursor Bug Hunt (CP0–CP22)

Source: `82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl`, CP0 @L11 through CP22 @L567.
Scope: discovery of the Office Viewer table resize cursor bug, the failed surgical fixes, the diagnostic deep-dive that exposed a ProseMirror feedback loop, and the user-driven redesign (overlay grab strip, columns-only, commit-on-release) that resolved it.

---

## 1. DECISIONS

### Root-cause decisions

- **The cursor bug's first-blame root cause was the scroll listener on the wrong element.** Assistant traced the geometry layer's only no-mouse-move cursor update path (`syncCursorFromLastPointer()`) to a scroll handler bound to `root` (the inner `containerRef` div), while the real scroller is its parent `.rv-office-document-editor`: "But **that div is not the thing that scrolls.** The scroll container is its *parent*, `.rv-office-document-editor`… So when you wheel-scroll the document, **`onRootScroll` never fires.**" [CP0 @L70] This was the hypothesis the user authorized fixing in CP1.

- **A second root cause was identified as global cursor forcing being too broad.** Two mechanisms were blamed for the "weird cursor behaviors elsewhere on the page": CSS rules `body.rv-office-table-column-resize-hover *` / `body.rv-office-table-row-resize-hover *` that paint the resize cursor on "every element in the whole application," and inline JS locks on `document.documentElement`/`document.body` that "if cleanup is ever skipped (unmount mid-hover, a thrown error), they get *stuck*." [CP0 @L70]

- **The *true* root cause was discovered at CP13 and was not a cursor problem at all** — it was a ProseMirror rebuild feedback loop. The geometry layer writes row heights as inline styles on table cells inside editable content; the table node view's `ignoreMutation` treated those style writes as document edits; ProseMirror rebuilt the whole table; the MutationObserver re-fired; the geometry layer re-applied the styles; loop forever: "It's not a cursor problem at all — it's this loop." [CP13 @L367] The loop was confirmed running idle (6,771 rebuilds and climbing, `resizing=false`) at CP14 @L389.

### Fix-strategy decisions

- **Surgical fix over the handoff's full document-body overlay rewrite (initial plan).** Assistant: "I'd do this surgically rather than the full overlay-rewrite in the handoff — the three fixes above map cleanly to the three bugs." [CP0 @L70] The user adopted this verbatim in the CP1 brief [CP1 @L81], including the instruction: "do not do the full document-body overlay rewrite unless the scoped/surgical fixes fail. That keeps the blast radius small." [CP1 @L81]

- **Decision to remove the global body/html cursor locks.** Brief item 2: "Remove global body/html cursor locks and broad `body *` CSS cursor rules." [CP1 @L81] Implemented by deleting `cursorLockTargets`, `lockInlineCursor`, `unlockInlineCursor`, and the snapshot map; `setCursorState`/`clearCursorState` were reduced to toggling the two hover body-classes. [CP1 @L84–L116]

- **Decision to scope the resize cursor to the Office editor.** Replaced `body.<class> *` with `body.<class> .rv-office-document-editor *`, plus a drag-only global variant `body.rv-office-table-resizing.<hover-class> *` so the cursor survives pointer straying outside the editor mid-drag but never bleeds while hovering. [CP1 @L116, CP1 @L149]

- **Decision to update handles in place rather than `replaceChildren()` them.** "Handles updated in place, not rebuilt… A new `syncHandles()` reconciler adds/removes handle buttons only when the row/column *count* changes; otherwise it repositions the existing buttons." [CP0 @L70, CP1 @L149] This targeted the "handles destroyed out from under the cursor" symptom. [CP0 @L70]

- **Pointer capture was deferred, then added, then made moot by the redesign.** First skipped: "Pointer capture (item 5): skipped on purpose. The drag-scoped global cursor rule plus the existing window-level pointermove/pointerup capture listeners already make the drag robust." [CP1 @L149] Reversed at CP7 once drag itself was identified as broken: "there's a standard fix for 'editable content hijacks a drag': **pointer capture**." [CP7 @L232] Ultimately irrelevant after the redesign moved the drag off the editable DOM.

- **Decision to switch from on-screen HUD diagnostics to file-based logging.** After the user could not reliably read the in-app debug box ("Nothing changes up there" [CP10 @L265]), the assistant discovered the renderer console is piped to a log file by `electron/main.cjs` and pivoted: "This changes everything — I can instrument with `console.log`, have you do a single drag, and read the results myself. No more reading tiny text." [CP11 @L293]

### User-driven design decisions (these overrode assistant recommendations)

- **USER DECISION: drop horizontal (row) resizing entirely.** "Hell, I'm thinking we don't even do horizontal adjustments. I've always been annoyed by those. We let those size by whatever the largest text is in whichever container." [CP16 @L398] The assistant had been treating row resize as a feature to preserve; the user unilaterally removed it. The assistant later called this "the single biggest win" because row-height writes (to cells inside editable content) were the worst ProseMirror-toxic operation: "Columns use a `<colgroup>` that sits *outside* the editable content, so they're far less toxic." [CP17 @L402]

- **USER DECISION (the breakthrough): stop rebuilding the resize layer on every mouse move; drag a guide in the non-editable margin and commit once on release.** "If the problem is that it is being destroyed and rebuilt constantly, then why not this… We draw a dotted line going up out of the content area, out of the box, above it. We have the drag bar on the dotted line… you drag the dotted line, and when you let go, you unclick, and the real line snaps to place. **One destroy and one redraw.**" [CP16 @L398, CP17 @L400] The assistant accepted wholesale: "Your redesign is exactly right, and now I can tell you *precisely* why it works." [CP17 @L402]

- **USER DECISION: do not run the resize back through Milkdown/Crepe.** "We can do all of this without running it back through milked down or crates." [CP17 @L400] Confirmed by the assistant's final design: the overlay is a `<body>`-level element in screen coordinates that "never lives inside ProseMirror's editable DOM." [CP21 @L546]

- **USER DECISION: use the mouse pointer along the column line, not the drag bar.** "We should use mouse pointer instead of the drag bar. Those little UI drag elements you made, are doing the visual anchoring now." [CP19 @L470] The assistant extended each handle into a full-height invisible grab strip with the bar as a top marker. [CP19 @L473]

- **USER DECISION: remove the drag bars entirely.** First request: "Make those drag buttons go away when you are inside the table." [CP20 @L503] Then escalated: "We don't need those drag buttons at all. This solution made us so that it drags from within the cells from the top everywhere. We fixed it." [CP21 @L507] The cleanup pass deleted the bars and the unused `GUIDE_CLASS` constant. [CP21 @L510–L526]

- **Decision to bake the `<colgroup>` into the table node.** To kill the idle rebuild storm separately from the drag-time loop: "make the `<colgroup>` a permanent part of the table instead of something we bolt on afterward (bolting it on is what keeps provoking the rebuild)." [CP17 @L402] Implemented in the node-view rewrite. [CP18 @L436]

- **Decision to make `ignoreMutation` ignore presentational attribute mutations.** First attempted alone at CP13 @L368 (insufficient on its own — CP14 @L389 confirmed loop still running), then folded into the final node-view rewrite. [CP18 @L436] This is what lets the geometry layer write widths/colors as inline styles without ProseMirror treating them as document edits.

- **Decision to strip all diagnostic logging and the HUD as part of the cleanup pass.** [CP21 @L510–L541]

- **Decision to persist memory notes so no future session re-derives this.** Wrote `reference_electron_renderer_log.md` and `project_office_table_resize.md` and updated `MEMORY.md`. [CP21 @L547–L559]

### Decisions about what NOT to do

- **Do not bring back Crepe's native table handles.** Brief: "Do not bring back Crepe table handles. Office owns table resize/menu UI." [CP1 @L81]
- **Do not rewrite table content into HTML/CSS.** Brief item: "Do not rewrite table content into HTML/CSS." [CP1 @L81]
- **Do not revert unrelated dirty-worktree changes.** Brief: "The worktree is heavily dirty. Do not revert unrelated changes." [CP1 @L81]
- **Do not commit; user keeps commits.** "I left that to you since you keep commits on your side." [CP21 @L562] Also flagged earlier: "officeTableGeometry.ts was untracked in git, so there's no baseline to diff against — worth git add-ing it." [CP0 @L203, CP1 @L486, CP21 @L1678]

---

## 2. LESSONS

### Failed hypotheses (and why each failed)

- **Hypothesis: the surgical fix (scroll target + scoped cursor + in-place handles) would resolve the bug.** Implemented at CP1 @L84–L137. Failed: CP3 @L165 reported "It's still not working. It looks like a cursor even when it's exactly on the line. I can click and I get the handlebar, but then I'm not able to drag anything with it." The surgical fixes addressed real bugs but missed the underlying ProseMirror feedback loop entirely.

- **Hypothesis: pointer capture would fix the broken drag.** Added at CP7 @L232–L240 on the theory that "editable content hijacks a drag." Failed: CP8 @L250 — "Nothing changes visually. It switches from a cursor to a drag handle bar, but nothing happens." The drag-bar "pressed state" was a false-positive signal: "it happens on any mousedown and does **not** confirm the drag logic ran." [CP8 @L253]

- **Hypothesis: making `ignoreMutation` ignore attribute mutations would break the loop.** Implemented at CP13 @L368. Failed alone: CP14 @L389 — "The loop is still running — 6,771 rebuilds and climbing, still `got=undefined`. So ignoring attribute mutations wasn't enough; something else is driving the constant rebuild." The fix only landed once combined with the overlay redesign and baked-in colgroup at CP18.

### Root causes discovered

- **Scroll-event capture-phase semantics.** The listener sat on a descendant of the actual scroller; because scroll events do not bubble and capture-phase only sees events where the listener's element is on the path *to* the target, a parent-above scroller never triggered it. [CP0 @L70]

- **`replaceChildren()` destroys the element under a stationary pointer.** Removing the exact `<button>` under the cursor and creating a new one does not make the browser re-evaluate the cursor until the next mouse move, causing the affordance to flicker back to default. [CP0 @L70]

- **Global cursor forcing leaks and sticks.** `body.<class> *` selectors paint the cursor on the entire app; inline locks on `documentElement`/`body` get stuck if cleanup is skipped. [CP0 @L70]

- **The ProseMirror feedback loop (the real villain).** Geometry layer writes row-height inline styles onto cells inside editable content → `ignoreMutation` says "style change = document edit" → ProseMirror rebuilds the whole table → MutationObserver fires → geometry re-applies → loop. [CP13 @L367] It ran constantly, even idle (6,771 rebuilds counted with `resizing=false`). [CP14 @L389]

- **`got=undefined` mid-drag = ProseMirror tearing the table down out from under the drag.** The drag math was sound (`want` 76→96px, `tableW` 664→684px) but re-measuring the table showed zero rows and a collapsed `colgroup` (8 → 2): "ProseMirror is tearing down and rebuilding the table out from under the drag. I'm faithfully applying widths — to a table that Milkdown has already discarded and replaced." [CP12 @L344]

### Debugging techniques that worked

- **On-screen HUD readout for cursor state.** A small black box with green text in the top-right corner showing `pt`, `top`, `curs`, `hit`, `dist col/row`, `body`, `layer/drag`. [CP3 @L175–L193] It proved the cursor affordance was actually fixed (CP7 @L232 readings showed `curs col-resize` / `row-resize` correctly on lines and in the margin) but exposed a logging-order bug: "body none / layer no are misleading because I logged them *before* the code sets them." [CP5 @L206]

- **File-based logging via the renderer console.** Discovering that `electron/main.cjs` pipes the renderer console to `/var/folders/.../electron-renderer.log` was the diagnostic breakthrough: "I can instrument with `console.log`, have you do a single drag, and read the results myself." [CP11 @L293] This eliminated the user-as-reader bottleneck and produced the `[RESIZE]` and `[TABLENV] construct/destroy` traces that nailed the root cause at CP12–CP14.

- **Asking the user to read a single transient state value (`drag yes/no`) rather than a continuous readout.** Converted the HUD to a persistent drag log after the live-read version proved unreadable mid-drag. [CP8 @L254]

- **Counting `construct`/`destroy` log lines as a loop detector.** CP13 @L364 and CP14 @L385 used `grep -ac "TABLENV] construct"` to quantify the churn — turning "feels fragile" into "6,771 rebuilds while idle."

### Generalizable takeaways

- **Milkdown/ProseMirror treat any DOM manipulation inside the editable subtree as a potential document edit.** Writes to cell `style.height` inside the table are interpreted as edits and trigger rebuilds. [CP13 @L367] The lever for presentational writes is `ignoreMutation`. [CP13 @L367, CP18 @L436]

- **Columns (`<colgroup>`) live outside the editable content; cell writes live inside it.** This asymmetry made row resizing intrinsically more toxic than column resizing in this editor. [CP17 @L402]

- **Cursor affordances and drag logic are independent.** The cursor was fixed (CP7) while the drag was still completely broken (CP8). Treating them as one bug wastes cycles.

- **Pressed-state UI is not proof of logic execution.** A button's `:active` highlight fires on any mousedown regardless of whether the drag handler ran. [CP8 @L253]

- **If a system is rebuilding constantly, the fix may be to stop rebuilding it, not to make the rebuild cheaper.** The assistant was mid-instrumentation when the user inverted the problem. [CP16 @L398, CP22 @L567]

### Collaboration dynamics that affected the outcome

- **The "works outside the table" observation was the seed of the entire fix.** The user noticed early: "I notice we're not having a problem constructing these outside of the table. This could be a solution. Just limiting the line movement to outside the table." [CP6 @L224] The assistant credited this as the clue that "the reason it 'works outside the table' is that out there the handle sits over nothing editable." [CP7 @L232]

- **The user's reframing cracked it while the assistant was still instrumenting.** Two user interrupts (CP9 @L262, CP15 @L396) redirected away from the assistant's instrument-then-fix loop; CP16 @L398 arrived as a fresh redesign proposal that bypassed further diagnosis.

- **The assistant explicitly credited the user at the close.** "Your 'do it outside the table / drop row resizing / grab with the pointer' instincts were what actually cracked it." [CP21 @L562] And at CP22 @L571: "that 'why don't we just not rebuild it constantly' is *exactly* the fix. You cut straight to it while I was still elbow-deep in cursor CSS."

- **The user iteratively sharpened the design across three turns** — drop rows (CP16), drag in the margin and commit on release (CP17), grab with the pointer not the bar (CP19), then remove the bars entirely (CP20, CP21). Each turn cut more machinery.

---

## 3. WORK / CHANGES

### Files READ (with purpose)

- **`Office_Viewer_Cursor_HANDOFF.md`** [CP0 @L24] — original handoff describing the bug and prior fix attempts; the assistant's entry point.
- **`officeTableGeometry.ts`** [CP0 @L30] — initial trace of the resize/cursor system; re-read multiple times during debugging [CP3 @L168, CP3 @L176, CP8 @L254, CP11 @L298, CP11 @L309, CP11 @L314] to trace the click→drag flow and locate insertion points for instrumentation.
- **`OfficeDocumentPage.css`** [CP0 @L38] — to find the cursor rules and scroll-container styling; re-read at CP18 @L415 and @L422 to scope the exact replacement block.
- **`useCrepeEditor.ts`** [CP0 @L46] — to confirm `containerRef` wiring and editor install/cleanup lifecycle.
- **`officeTableNodeView.ts`** [CP0 @L51] — to understand the table wrapper's DOM structure and `ignoreMutation` behavior; re-read at CP18 @L429 before the full rewrite.
- **`OfficeDocumentPage.tsx`** [CP0 @L59] — to confirm the scroll-container relationship and find leftover cursor-class references.
- **`scripts/restart.sh`** [CP11 @L274] — to locate where renderer logs are written.
- **`electron/main.cjs`** [CP11 @L287, CP11 @L290] — to find the exact renderer-log path (`/var/folders/.../electron-renderer.log`).
- **`MEMORY.md`** [CP21 @L547] — to append references to the new memory notes.

### Bash commands run (selected)

- `find … -name 'officeTableGeometry.ts'` and similar locates [CP0 @L18, CP0 @L28].
- `grep -rn "addEventListener('scroll'"` [CP0 @L67] — confirmed scroll-listener attachments.
- `grep -n "inlineCursor|lockInlineCursor|…"` [CP1 @L121] — verified no dangling references after removing the lock machinery.
- `npm run build` [CP1 @L129, CP18 @L448] — `tsc -b && vite build`; both passed (the >500 kB chunk warning was pre-existing).
- `bash scripts/restart.sh` (many): CP1 @L137, CP2 @L157, CP3 @L190, CP5 @L216, CP7 @L242, CP12 @L320, CP13 @L354, CP18 @L458, CP19 @L495, CP21 @L542 — each rebuilt and relaunched Electron.
- `grep -a "\[RESIZE\]" /var/folders/.../electron-renderer.log` [CP12 @L336] — exposed `got=undefined` and the collapsed colgroup.
- `grep -aE "\[TABLENV\]|\[RESIZE\]" …` [CP13 @L364] — exposed the `construct/destroy` loop pattern.
- `grep -ac "TABLENV] construct"` [CP14 @L385] — counted 6,771+ rebuilds.
- `grep -rnE "GRAB_OFFSET|GUIDE_CLASS|console\.log|TABLENV|RESIZE\]|debugEl|…"` [CP21 @L534] — final cleanliness check confirming no debug leftovers.

### Files EDITED / WRITTEN

**CP1 surgical-fix pass** — all in `officeTableGeometry.ts` and `OfficeDocumentPage.css`:
- Added `getScrollParent()` helper; moved the scroll listener from `root` to the nearest `overflow:auto` ancestor (`.rv-office-document-editor`), with `window` fallback. [CP1 @L85–L116]
- Removed the entire inline-lock mechanism (`cursorLockTargets`, `lockInlineCursor`, `unlockInlineCursor`, snapshot map/type). [CP1 @L91–L101]
- Replaced `renderLayer()`'s `replaceChildren()` with a `syncHandles()` reconciler that repositions existing handles and only adds/removes when row/column count changes. [CP1 @L101]
- Replaced `body.<class> *` cursor rules with `body.<class> .rv-office-document-editor *` plus drag-only global variant. [CP1 @L116]

**CP3–CP8 diagnostic instrumentation** in `officeTableGeometry.ts`:
- Added an on-screen debug box (top-right, black with green text) showing `pt/top/curs/hit/body/layer/drag`. [CP3 @L182–L188]
- Fixed logging order so the readout reflects state *after* code updates it [CP5 @L207], added a `dist col/row` line. [CP5 @L214]
- Converted the HUD to a persistent drag log that survives mouseup. [CP8 @L260]

**CP7 pointer capture** in `officeTableGeometry.ts`:
- Added `setPointerCapture` on drag start. [CP7 @L233–L240]

**CP11–CP13 file logging** in `officeTableGeometry.ts` and `officeTableNodeView.ts`:
- Added tagged `console.log` instrumentation across the drag path [CP11 @L304–L316].
- Added `[TABLENV] construct/destroy` logging to the node view [CP12 @L345–L352].
- Added the first `ignoreMutation` fix to ignore attribute mutations [CP13 @L368].

**CP18 full redesign** (the rewrite):
- `OfficeDocumentPage.css` [CP18 @L425] — replaced the old resize CSS block (lines 476–590) with overlay-based styles for the grab-bar/guide-line.
- `officeTableNodeView.ts` [CP18 @L436] — **full file write**: `<colgroup>` baked into the table node so widths persist from creation; `ignoreMutation` updated to ignore presentational writes.
- `officeTableGeometry.ts` [CP18 @L440] — **full file write**: replaced the in-editor handle model with an overlay-above-the-table model (columns only, drag a guide, commit once on release).
- Re-added two temporary log lines for verification [CP18 @L452–L456], later stripped in CP21.

**CP19 full-height grab strip** in `officeTableGeometry.ts` and `OfficeDocumentPage.css`:
- Extended each handle into a full-height invisible grab strip with the bar as a top marker and a hover guide line. [CP19 @L474–L491]

**CP21 cleanup pass** — bars removed, diagnostics stripped:
- `OfficeDocumentPage.css` [CP21 @L511] — removed the bar styles.
- `officeTableGeometry.ts` [CP21 @L518–L526] — removed bars, spanned the grab strip exactly over the table (no top overhang), removed the unused `GUIDE_CLASS` constant, removed diagnostic logs.
- `officeTableNodeView.ts` [CP21 @L527–L529] — removed the construct/destroy diagnostic logs.

**CP21 memory notes written**:
- `reference_electron_renderer_log.md` [CP21 @L549] — documents the renderer log path for future debugging.
- `project_office_table_resize.md` [CP21 @L552] — captures the final design and the ProseMirror-loop root cause.
- `MEMORY.md` [CP21 @L559] — edited to reference both new notes.

### Reverted / removed

- The inline cursor-lock machinery (`cursorLockTargets`, `lockInlineCursor`, `unlockInlineCursor`, snapshot map). [CP1 @L91–L101]
- The `body.<class> *` global cursor CSS rules. [CP1 @L116]
- The `replaceChildren()` call in `renderLayer()`. [CP1 @L101]
- The on-screen HUD/debug box and all `console.log` instrumentation (added CP3–CP13, removed CP21). [CP21 @L510–L541]
- The top anchor bars (added CP18, removed CP21 per user). [CP21 @L511–L526]
- Row resizing entirely (per user decision at CP16; codified in the CP18 rewrite).

### State at the end of this chunk

At CP21 @L546 and the CP22 @L567 celebration, the bug hunt is conclusively over:

- **Cursor shows ↔ on column lines and stays put** during hover and scroll. [CP21 @L546]
- **Dragging actually resizes columns** — the column line can be grabbed anywhere inside the cells, dragged, and snapped on release; committed once on mouseup, then saved to frontmatter. [CP21 @L546]
- **The idle background table-rebuild loop is dead** (killed by the baked-in `<colgroup>` and the `ignoreMutation` fix). [CP21 @L546]
- **Row resizing is intentionally gone**; rows auto-size to content. [CP21 @L546]
- **All diagnostics, HUD, and logging are stripped.** [CP21 @L534 cleanliness check passed.]
- **Three files remain uncommitted** at the user's discretion: `officeTableGeometry.ts` (rewritten), `officeTableNodeView.ts` (colgroup baked in, `ignoreMutation` fix), `OfficeDocumentPage.css` (overlay styles). [CP21 @L562] `officeTableGeometry.ts` was untracked in git from the original handoff and still lacks a committed baseline. [CP0 @L203]

The CP22 @L567 user message — "This is fucking amazing. I can't believe we did it. Yeah, but when you said it was rebuilding constantly with every movement, I thought, why don't we just not rebuild it constantly then?" — closes the bug-hunt arc and immediately pivots to the next feature: cell/row/column background colors in the right-click menu. That colors feature (CP22 onward) is out of scope for this chunk.
