# LESSONS — Engineering, Debugging, Product

Source: `82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl` (82 chat pairs). Citations: `[CP# @L#]`. Both bug hunts (cursor CP0–CP22, color+click CP47–CP68) covered in depth.

---

## Theme 1 — The ProseMirror Editable-DOM Principle (the unifying lesson)

- **THE generalizable principle, named at CP68:** "Writing `background-color` onto the `<td>` cells put data inside ProseMirror's editable content, and ProseMirror fought back… The fix was to stop touching the cells entirely and paint them from an injected stylesheet, tagging only the table chrome — the exact same 'don't fight the editor, work outside it' principle that fixed the resize drag earlier." [CP68 @L1374]

- **Milkdown/ProseMirror treat any DOM manipulation inside the editable subtree as a potential document edit.** Writes to cell `style.height` inside the table are interpreted as edits and trigger rebuilds. [CP13 @L367] The lever for presentational writes is `ignoreMutation`. [CP13 @L367] [CP18 @L436]

- **Columns (`<colgroup>`) live outside the editable content; cell writes live inside it.** This asymmetry made row resizing intrinsically more toxic than column resizing in this editor. [CP17 @L402]

- **Resize writes to table *chrome* (outside editable content); colors originally wrote to `<td>` cells (inside editable content).** This is *why* resize never caused the selection-collapse bug that colors did. [CP55 @L1171] [CP67 @L1338]

- **Tag the table, paint via an injected stylesheet — never write into the cells.** The CP67 fix. [CP67 @L1338]

## Theme 2 — Bug Hunt 1: Cursor / Resize Loop (CP0–CP22)

### Failed hypotheses (and why each failed)

- **Hypothesis: the surgical fix (scroll target + scoped cursor + in-place handles) would resolve the bug.** Implemented CP1 @L84–L137. Failed: CP3 @L165 — "It's still not working. It looks like a cursor even when it's exactly on the line. I can click and I get the handlebar, but then I'm not able to drag anything with it." The surgical fixes addressed real bugs but missed the underlying ProseMirror feedback loop entirely.

- **Hypothesis: pointer capture would fix the broken drag.** Added CP7 @L232–L240 on the theory that "editable content hijacks a drag." Failed: CP8 @L250 — "Nothing changes visually. It switches from a cursor to a drag handle bar, but nothing happens." The drag-bar "pressed state" was a false-positive signal: "it happens on any mousedown and does **not** confirm the drag logic ran." [CP8 @L253]

- **Hypothesis: making `ignoreMutation` ignore attribute mutations would break the loop.** Implemented CP13 @L368. Failed alone: CP14 @L389 — "The loop is still running — 6,771 rebuilds and climbing, still `got=undefined`. So ignoring attribute mutations wasn't enough; something else is driving the constant rebuild." The fix only landed once combined with the overlay redesign and baked-in colgroup at CP18.

### Root causes discovered

- **Scroll-event capture-phase semantics.** The listener sat on a descendant of the actual scroller; because scroll events do not bubble and capture-phase only sees events where the listener's element is on the path *to* the target, a parent-above scroller never triggered it. [CP0 @L70]

- **`replaceChildren()` destroys the element under a stationary pointer.** Removing the exact `<button>` under the cursor and creating a new one does not make the browser re-evaluate the cursor until the next mouse move, causing the affordance to flicker back to default. [CP0 @L70]

- **Global cursor forcing leaks and sticks.** `body.<class> *` selectors paint the cursor on the entire app; inline locks on `documentElement`/`body` get stuck if cleanup is skipped. [CP0 @L70]

- **The ProseMirror feedback loop (the real villain).** Geometry layer writes row-height inline styles onto cells inside editable content → `ignoreMutation` says "style change = document edit" → ProseMirror rebuilds the whole table → MutationObserver fires → geometry re-applies → loop. [CP13 @L367] It ran constantly, even idle (6,771 rebuilds counted with `resizing=false`). [CP14 @L389]

- **`got=undefined` mid-drag = ProseMirror tearing the table down out from under the drag.** Drag math was sound (`want` 76→96px, `tableW` 664→684px) but re-measuring the table showed zero rows and a collapsed `colgroup` (8 → 2). [CP12 @L344]

### Debugging techniques that worked

- **On-screen HUD readout for cursor state.** A small black box with green text in the top-right corner showing `pt`, `top`, `curs`, `hit`, `dist col/row`, `body`, `layer/drag`. [CP3 @L175–L193] Proved the cursor affordance was actually fixed (CP7 readings showed `curs col-resize` / `row-resize` correctly) but exposed a logging-order bug: "body none / layer no are misleading because I logged them *before* the code sets them." [CP5 @L206]

- **File-based logging via the renderer console — the diagnostic breakthrough.** Discovering that `electron/main.cjs` pipes the renderer console to `/var/folders/.../electron-renderer.log` eliminated the user-as-reader bottleneck: "I can instrument with `console.log`, have you do a single drag, and read the results myself." [CP11 @L293] Produced the `[RESIZE]` and `[TABLENV]` traces that nailed the root cause at CP12–CP14.

- **Asking the user to read a single transient state value (`drag yes/no`) rather than a continuous readout.** Converted the HUD to a persistent drag log after the live-read version proved unreadable mid-drag. [CP8 @L254]

- **Counting `construct`/`destroy` log lines as a loop detector.** CP13 @L364 and CP14 @L385 used `grep -ac "TABLENV] construct"` to quantify the churn — turning "feels fragile" into "6,771 rebuilds while idle."

### Generalizable takeaways

- **Cursor affordances and drag logic are independent.** The cursor was fixed (CP7) while the drag was still completely broken (CP8). Treating them as one bug wastes cycles.

- **Pressed-state UI is not proof of logic execution.** A button's `:active` highlight fires on any mousedown regardless of whether the drag handler ran. [CP8 @L253]

- **If a system is rebuilding constantly, the fix may be to stop rebuilding it, not to make the rebuild cheaper.** The assistant was mid-instrumentation when the user inverted the problem. [CP16 @L398] [CP22 @L567]

- **The "works outside the table" observation was the seed of the entire fix.** User noticed early: "I notice we're not having a problem constructing these outside of the table. This could be a solution. Just limiting the line movement to outside the table." [CP6 @L224] The assistant credited this as the clue that "the reason it 'works outside the table' is that out there the handle sits over nothing editable." [CP7 @L232]

## Theme 3 — Bug Hunt 2: Color + Click Regression (CP47–CP68)

### Failed hypotheses (and why each failed)

- **Hypothesis: bloat / file size.** Ruled out at CP47 — largest file 479 lines, "a page owning a lot, not bloat from this." [CP47 @L972]

- **Hypothesis: accumulated click-garbage from the resize saga.** Ruled out at CP49 — "audit's clean — every listener is legit and paired with cleanup." [CP49 @L1022]

- **Hypothesis (CP51, partially right): invisible virtual caret.** The caret WAS invisible (`--prosemirror-virtual-cursor-color` bound to the dark Crepe theme, drawn light-on-light on the fixed-light paper). [CP51 @L1079] Fix made the caret visible — but that was a symptom, not the cause.

- **Hypothesis (CP53, correction): CSS specificity loss.** The first caret fix didn't take because `.ProseMirror-focused` sets the variable directly on the `.ProseMirror` element; the override on `.milkdown` one level up "never wins." [CP53 @L1116] This fix DID work (caret visible) but still wasn't the root cause.

- **Hypothesis (CP55, wrong): `applyColors` stomping selection via ProseMirror's DOM observer.** Diagnosis was directionally interesting (color writes into editable cells DO cause problems) but the idempotent fix didn't resolve the caret-jump. [CP55 @L1171] [CP57 @L1206]

- **Hypothesis (CP58, wrong): editor recreated on autosave.** Overturned at CP61 — `[EDITOR-EFFECT]` fired once; the editor was NOT re-creating on save. [CP58 @L1237] [CP61 @L1274]

### The decisive isolation tests

- **"Try a different document."** Proposed explicitly at CP57 [CP57 @L1206]; the user's result at CP65 collapsed the search space: "I went to another document and clicked, and it worked fine." [CP65 @L1307] → "Other documents work fine. So the editor code is *not* broken — I've been chasing a ghost."

- **Reproduce by coloring a cell.** User: "lmao I reproduced the bug in the new document by trying to color a cell. No color and click is broken now." [CP66 @L1335] [CP67 @L1338] This proved the two symptoms were ONE bug, triggered by the color action itself — not pre-existing document rot.

### Root cause

- **Writing `background-color` into `<td>` cells (inside ProseMirror's editable content) provokes re-render + selection collapse.** "painting a cell writes `background-color` *into* a `<td>*, which lives inside ProseMirror's editable content. ProseMirror reacts by re-rendering the cell (wiping the color) and resetting the selection to the end." [CP67 @L1338]

### Debugging techniques that worked

- **Renderer-log probes paid off repeatedly.** Each probe narrowed the problem: clicks landing on real content `p`, `h2` (ruled out overlay intercept) [CP49 @L1022]; `hasFocus=true` + `caretInEditor=true` (ruled out focus loss) [CP51 @L1079]; `textLen` climbing (ruled out swallowed input) [CP55 @L1171]; caret pinned to `y=1177` — bottom (proved mispositioning) [CP55 @L1171]; `[EDITOR-EFFECT]` fired once (ruled out recreation) [CP61 @L1274].

- **Reading the actual saved file was a key clue.** Line 107 of the assets README was `## Quick Referencejkhjkhkjhkjhkjj` — "Your typed garbage got appended to the **last heading**, at the very end." [CP58 @L1250] Both confirmed the "caret to end" symptom and (initially, wrongly) suggested document corruption from save round-trips.

- **Counting log lines to verify loop claims.** "a spinning loop would be tens of thousands [of lines]" — the actual log was 170 lines. [CP61 @L1274]

### Generalizable takeaways

- **Don't trust a single confirmed diagnosis when multiple symptoms are unexplained.** The hunt cycled through at least three wrong root causes. The caret-color fix and the idempotent-apply fix were both retained as correct-in-themselves even though neither was the root cause. [CP55 @L1171] [CP58 @L1237] [CP68 @L1374]

- **Connect seemingly-separate symptoms.** The user initially treated "color not applying" and "cursor not clicking" as separate issues, deferring the color bug to flesh out the menu first: "adding color to the cells never worked, but I wanted to flesh out the details of the menu first… I could tell from the picker that the color was being saved even if it wasn't applied to the page. There may be an error on my part not to have connected the two." [CP65 @L1307] The color-saving-but-not-applying behavior was a tell that the color write path was misbehaving; the caret breakage was a downstream effect. Deferring a "cosmetic" bug while chasing an "interaction" bug cost hours because they shared a root cause. [CP67 @L1338]

- **"Color saved to frontmatter but not painted" is itself a high-signal symptom.** It means the persistence path works but the application path is fighting the editor. [CP65 @L1307]

## Theme 4 — CSS / Specificity Lessons

- **CSS variable inheritance can silently defeat an override.** A variable set directly on `.ProseMirror` will beat the same variable set on `.milkdown` (parent), even if the parent rule "looks like it should apply." Fix: set on the same element at higher specificity. [CP53 @L1116]

- **Virtual-caret invisibility is silent.** Milkdown's `ProseMirror virtual-cursor-enabled` class replaces the native blinking caret with a virtual one and hides the native via `caret-color: transparent`. If the virtual color is bound to a theme that doesn't match the paper, the caret is "placed correctly, editable, focused, but invisible." [CP51 @L1079]

## Theme 5 — Override-Cascade Design (color feature)

- **The yellow-column-meets-green-row thought experiment cracked the cascade.** The user walked through the intersection explicitly ("dead center cell they want to make different") to discover that fixed precedence (row-always-beats-column) is wrong — what matters is *which one the user meant most recently*. [CP23 @L582] [CP24 @L590]

- **Recency beats hierarchy for "paint" operations.** "A user that has a yellow column intersecting a green row who says 'Paint the Column X' has declared an override intent." Painting is promotion. [CP24 @L590]

- **Self-healing property of the cascade model over stamping-every-cell:** because a row color is one *rule* (not a snapshot painted onto each cell), adding a new row to a colored column inherits the column color with zero re-work. [CP23 @L584]

- **The lever for memory recall / cascade promotion is the description / rank field.** A vague description = poor recall; a precise rank = correct promotion. (Cross-domain pattern: same shape in the memory system [CP75 @L1500] and the color cascade [CP29 @L615].)

## Theme 6 — Deliberate Non-Over-Engineering

- **No cell promotion logic.** User caught the assistant over-designing and cut it: "We don't need to worry about promoting single cells because they always override. There is no promotion." [CP27 @L606]

- **No skip-if-identical optimization on re-stamp.** User rejected the "only write if something changed" optimization in favor of always re-stamping — simpler code, and the modal-closes-per-action flow makes racing impossible anyway. [CP27 @L606]

- **Hard override v1, defer blend.** Auto-blend-at-intersection would "tend to look like accidents"; an explicit intersection cell can still be any blend the user picks. Storage doesn't change if blend is added later, so no painting into a corner. [CP23 @L584]

- **Rank counter delegated to engineering discretion.** User explicitly refused to over-specify: "Whatever mechanism is most efficient." [CP29 @L613]

## Theme 7 — UI / UX Lessons

- **Modal closes on three things and three things only** — outside click, color click, No-fill click — and reopening requires right-clicking again. This single rule (CP31) is what made the user confident racing the computer wasn't a concern. [CP31 @L640] [CP27 @L606]

- **Two-menu interaction: submenu semantics, not swap semantics.** Dismissing menu 1 when menu 2 opens "feels like a swap"; keeping menu 1 up "feels like a submenu." The picker's committing click is the single dismiss point for both. [CP42 @L879]

- **Native OS panel is non-modal on macOS** — a UX hazard: the OS panel lingers after the picker closes, and commit-on-first-change can grab a color "a beat early while you're still dragging." [CP46 @L967]

- **"No fill" placement matters:** top, full-width, borderless-but-hover-visible — copied directly from Google Docs. [CP35 @L654]

- **Reference-gathering from real apps as primary design method.** The entire picker UX (None placement, circle swatches, divider tiers, `add_circle` for custom, global saved colors) was lifted from a Google Docs screenshot the user hunted down mid-design, after first considering Apple Pages. [CP35 @L654] [CP37 @L661] User: "Google hasn't even already built exactly the way I'm envisioning."

- **The user iterates menu labels verbally across consecutive turns** (CP25 "Remove Color/Match Row/Match Column" → CP26 "Change Background/Match Last Edit") — design refinements surface as language refinements. [CP25 @L592] [CP26 @L594]

## Theme 8 — Reuse-vs-Build

- **Verify what an existing component actually is before committing to "reuse it."** The assistant initially assumed the theme "slider menu" was a flat-color spectrum; reading `ThemePicker.tsx` revealed it's a palette *deriver* whose only flat-color control is the native `<input type="color">`. [CP40 @L695]

- **Reuse the *mechanism* + palette, not the React component,** when the target surface is imperative DOM. The office context menu is imperative; `ThemePicker.tsx` is React. [CP27 @L623]

- **The codebase already has both styling patterns** — inline content marks for text runs, container metadata for geometry — and matching feature to existing pattern (cell fill → container metadata, mirroring column widths) avoided a whole class of serializer/editor-fight bugs. [CP22 @L571]

## Theme 9 — Product Lessons: Stale Memories Silently Corrupting Context

- **Stale memories are sneaky because the index line alone is enough to resurface a dead concept.** "the *description line* is enough to keep resurfacing a dead concept like Robin without the whole file ever being 'opened.'" [CP75 @L1500]

- **Memories are frozen snapshots with no staleness notion.** "a 2026-02 fact and a 2026-07 fact sit at equal weight." [CP76 @L1508] The assistant's own instructions "warn me they may be stale and to verify against the code. Clearly I haven't been aggressive enough about that." [CP73 @L1475]

- **The memory system has the shape of the user's wiki thesis but none of the guardrails.** "It's like the Claude Code team tried to [do] what I want to do with the wiki, but zero visibility by the user, so contradictions just rot context." [CP76 @L1508]

- **The Robin ghost is "Evidence-Gated Execution with the evidence gate removed"** — "Facts go in on write, never get re-validated against reality, and keep firing." [CP76 @L1508]

- **What memory lacks vs. the user's wiki:** no edges (memory has hand-written `[[links]]`, nothing checks them); no consistency pass (no dedup/contradiction detection); no versioning / "living vs. frozen"; zero visibility. [CP76 @L1508]

- **Strategic response decided:** externalize memories into portable wiki files so any code editor (not just Claude Code) can find context. [CP79 @L1546]

## Theme 10 — Collaboration Dynamics

- **The "works outside the table" observation was the seed of the entire fix.** [CP6 @L224] [CP7 @L232]

- **The user's reframing cracked it while the assistant was still instrumenting.** Two user interrupts (CP9 @L262, CP15 @L396) redirected away from the assistant's instrument-then-fix loop; CP16 @L398 arrived as a fresh redesign proposal that bypassed further diagnosis.

- **The assistant explicitly credited the user at the close.** "Your 'do it outside the table / drop row resizing / grab with the pointer' instincts were what actually cracked it." [CP21 @L562] And: "that 'why don't we just not rebuild it constantly' is *exactly* the fix. You cut straight to it while I was still elbow-deep in cursor CSS." [CP22 @L571]

- **The user iteratively sharpened the design across three turns** — drop rows (CP16), drag in the margin and commit on release (CP17), grab with the pointer not the bar (CP19), then remove the bars entirely (CP20, CP21). Each turn cut more machinery.

- **The user defers a "cosmetic" bug to chase an "interaction" bug, then discovers they share a root cause.** [CP65 @L1307] [CP67 @L1338] Lesson for collaboration: surface *all* observed anomalies early, even ones that seem unrelated.
