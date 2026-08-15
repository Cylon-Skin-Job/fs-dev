# DECISIONS — Master Chronological List

Source: `82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl` (82 chat pairs). Citations: `[CP# @L#]`. Overlap CPs merged; no conflicts found in overlap regions.

---

## Theme 1 — Table-Resize Cursor Bug: Diagnosis & Root Cause (CP0–CP14)

- **First-blame root cause: scroll listener bound to the wrong element.** The geometry layer's only no-mouse-move cursor path (`syncCursorFromLastPointer()`) was wired to a scroll handler on `root` (the inner `containerRef` div), while the actual scroller is its parent `.rv-office-document-editor`: "But **that div is not the thing that scrolls.** The scroll container is its *parent*… So when you wheel-scroll the document, **`onRootScroll` never fires.**" [CP0 @L70] Authorized for fix in CP1 [CP1 @L81].

- **Second-blame: global cursor forcing was too broad.** CSS rules `body.rv-office-table-column-resize-hover *` / `body.rv-office-table-row-resize-hover *` paint the resize cursor on "every element in the whole application," and inline JS locks on `document.documentElement`/`document.body` "if cleanup is ever skipped (unmount mid-hover, a thrown error), they get *stuck*." [CP0 @L70]

- **The *true* root cause (CP13) was not a cursor problem at all — it was a ProseMirror rebuild feedback loop.** Geometry-layer row-height writes onto cells inside editable content → table node view's `ignoreMutation` treats style writes as document edits → ProseMirror rebuilds the whole table → MutationObserver re-fires → geometry re-applies → loop forever: "It's not a cursor problem at all — it's this loop." [CP13 @L367] Confirmed running idle (6,771 rebuilds, `resizing=false`) at CP14 @L389.

- **`got=undefined` mid-drag = ProseMirror tearing the table down out from under the drag.** Drag math was sound (`want` 76→96px, `tableW` 664→684px) but the re-measured table had zero rows and a collapsed `colgroup` (8 → 2): "ProseMirror is tearing down and rebuilding the table out from under the drag. I'm faithfully applying widths — to a table that Milkdown has already discarded and replaced." [CP12 @L344]

## Theme 2 — Table-Resize Fix Strategy & Architecture (CP1, CP16–CP22)

- **Surgical fix over the handoff's full document-body overlay rewrite (initial plan).** "I'd do this surgically rather than the full overlay-rewrite in the handoff — the three fixes above map cleanly to the three bugs." [CP0 @L70] User adopted verbatim: "do not do the full document-body overlay rewrite unless the scoped/surgical fixes fail. That keeps the blast radius small." [CP1 @L81]

- **Remove the global body/html cursor locks.** "Remove global body/html cursor locks and broad `body *` CSS cursor rules." [CP1 @L81] Implemented by deleting `cursorLockTargets`, `lockInlineCursor`, `unlockInlineCursor`, and the snapshot map; `setCursorState`/`clearCursorState` reduced to toggling two hover body-classes. [CP1 @L84–L116]

- **Scope the resize cursor to the Office editor.** `body.<class> *` → `body.<class> .rv-office-document-editor *`, plus a drag-only global variant `body.rv-office-table-resizing.<hover-class> *` so the cursor survives pointer straying outside the editor mid-drag but never bleeds while hovering. [CP1 @L116, CP1 @L149]

- **Update handles in place rather than `replaceChildren()` them.** "Handles updated in place, not rebuilt… A new `syncHandles()` reconciler adds/removes handle buttons only when the row/column *count* changes; otherwise it repositions the existing buttons." [CP0 @L70, CP1 @L149] Targets the "handles destroyed out from under the cursor" symptom. [CP0 @L70]

- **Switch from on-screen HUD diagnostics to file-based logging.** After the user could not reliably read the in-app debug box ("Nothing changes up there" [CP10 @L265]), the assistant discovered the renderer console is piped to a log file by `electron/main.cjs` and pivoted: "This changes everything — I can instrument with `console.log`, have you do a single drag, and read the results myself. No more reading tiny text." [CP11 @L293]

- **Bake the `<colgroup>` into the table node.** "make the `<colgroup>` a permanent part of the table instead of something we bolt on afterward (bolting it on is what keeps provoking the rebuild)." [CP17 @L402] Implemented in the node-view rewrite. [CP18 @L436]

- **Make `ignoreMutation` ignore presentational attribute mutations.** First attempted alone at CP13 @L368 (insufficient alone — CP14 @L389 confirmed loop still running), then folded into the final node-view rewrite. [CP18 @L436] This is what lets the geometry layer write widths/colors as inline styles without ProseMirror treating them as document edits.

- **Final architecture (the CP18 rewrite): columns-only overlay drag, guide in the non-editable margin, commit once on release.** "never lives inside ProseMirror's editable DOM." [CP21 @L546]

- **Strip all diagnostic logging and the HUD as part of the cleanup pass.** [CP21 @L510–L541]

- **Persist memory notes so no future session re-derives this.** Wrote `reference_electron_renderer_log.md` and `project_office_table_resize.md` and updated `MEMORY.md`. [CP21 @L547–L559]

## Theme 3 — Background-Color Override Cascade (CP22–CP29)

- **Storage approach: metadata, NOT in-content tags.** Initial (rejected) instinct: enclose cell content in a tag declaring the background — "I am thinking encase the content of each cell inside a tag that declares the background." [CP22 @L567] Rejected because a content-wrapping tag only paints the text box ("a highlighter swipe, not a filled cell"); row/column can't be wrapped (would require stamping every cell + re-stamping on column add); and the codebase already separates inline-content-marks for *text runs* vs the `metadata.tables` container-geometry pattern that colors should mirror. [CP22 @L571] Decision: "Let's go with the metadata approach." [CP23 @L582]

- **Storage shape — sparse maps per table.** `columnColors`, `rowColors`, `cellColors` keyed by index (cells keyed `"r,c"`); only colored entries stored. [CP23 @L584]

- **Sibling, not nested:** colors live in `metadata.tableColors` as a *sibling* to `metadata.tables` so column-width rewrites can never wipe colors. [CP40 @L705]

- **In-content tag model deferred to a future inline-highlight feature.** "Your tag idea is genuinely the right model — just for the inline-highlight feature, not for cell shading." [CP22 @L571]

- **Override cascade — evolved CP23→CP27.** CP23 starting point: fixed precedence cell > row > column. [CP23 @L582] CP24 reversal — "last in overrides": "It should be last in overrides. The cell's data overrides always. But row and column, whatever data is being overwritten in that moment takes precedent over what is there already." Proposed timestamping each paint and promoting on re-paint. [CP24 @L590]

- **Cell is the "lone exemption" — never subject to recency.** "The loan exemption being an intentionally filled-in cell." [CP25 @L592] [CP25 @L596]

- **Always re-stamp, even if same color — no skip-if-identical optimization.** "We should always re-stamp. They may be trying to override something that criss crossed unexpectantly. … We just re-stamp even if it's the same color again." [CP27 @L606] Locked: "every paint always re-stamps, cells are pure color with no stamp and no promotion." [CP27 @L608]

- **Remove-on-no-fill.** Row/column "None" = delete the entry; "Whatever else would override it still overrides it." [CP27 @L606]

- **No cell promotion logic — explicitly decided against over-engineering.** "We don't need to worry about promoting single cells because they always override. There is no promotion." [CP27 @L606]

- **Rank counter vs wall-clock timestamp — left to engineering discretion.** "feel free to use ranking instead of timestamp if you think that's better. Whatever mechanism is most efficient." [CP29 @L613] Assistant chose a monotonic integer rank (`stamp = max stamp in table + 1`) to dodge DST/clock-drift/same-ms ties. [CP29 @L615]

- **Final resolution rule:** `(1) explicit cell color always wins; (2) else, of rowColors[r] and columnColors[c], whichever has the newer rank wins; (3) else no fill.` [CP25 @L596] Hard override (no auto-blend at intersections) for v1 — blend is "a small additive rule on top" left for later. [CP23 @L584]

- **Filled-cell right-click options (CP25→CP26):** CP25 first draft "Remove Color / Match Row / Match Column" → CP26 final "colordot Change Background / Match Last Edit." [CP25 @L592] [CP26 @L594] "Match Last Edit" = delete the cell's explicit entry → falls back into the cascade (picks up newest row/column override). One control does both return-to-cascade and clear. [CP26 @L596]

## Theme 4 — Color Picker UX (CP22, CP31–CP46)

- **Source palette = Google Docs color set (the "pencils").** "grab the color profile of those pencils" [CP31 @L640] → confirmed via Google Docs screenshot: "the full Google palette (grays row + the 7-shade × 10-hue matrix — ~70 colors)." [CP38 @L668]

- **"No fill" / None button:** full-width, pinned at the **top**, prominent, "No border, but when you hover, you can see it." [CP35 @L654] [CP37 @L661] One click → clears + closes.

- **Icon for menu items = `colors` Material Symbol** (Cell/Row/Column background entries above Insert). [CP22 @L567] [CP38 @L668]

- **Icon for custom-color affordance = `add_circle`** Material Symbol at the bottom of the picker, sized to match the swatch circles. [CP37 @L661] [CP38 @L668]

- **Swatches rendered as circles**, circumference matched to the `add_circle` button. [CP37 @L661] [CP38 @L668]

- **Clicky / one-click-and-close flow.** Three dismiss conditions: "You click outside the area, the modal closes. You click 'No fill', the modal closes. You click a color, the modal closes." [CP31 @L640]

- **No "selector tool" (eyedropper).** "No selector tool." [CP37 @L661]

- **Uniform approach for both surfaces.** "I'm more than happy with the color picker and the slider menu, and I would prefer a uniform feeling and approach. If there's some reason that you can't tap into the same one, then let's change it for both." [CP40 @L681]

- **Reuse the native OS color panel** (the same mechanism the theme picker uses) for the custom-color escape hatch; build a brand-new shared in-app spectrum only if user asks. "I'll go native unless you say otherwise." [CP40 @L695] (Discovery: the theme "slider menu" is not a flat-color picker — it's a palette *deriver* whose only flat-color control is the native `<input type="color">`.)

- **Two-menu persistence (CP42):** menu 1 (right-click context menu) stays open when menu 2 (color picker popover) opens; the picker's actual color/None click dismisses *both*. "my first request, is that menu 1 does not disappear when you click and menu 2 appears. Let menu two click be the thing that dismisses them both." [CP42 @L876] Implemented as submenu semantics; outside-click still closes everything. [CP42 @L879]

- **Custom colors are app-global (localStorage), not per-document.** [CP44 @L908]

- **Per-document scraped hex colors live in a separate middle tier** between Defaults and Custom, with its own divider. "Let's put grab any color tags from the document put them above custom and below defaults. Use another divider." [CP44 @L908] Rationale: "a user can clean out the custom and still retain quick access to per doc colors." [CP44 @L908]

- **Final picker tier order:** `None → Defaults (Google grid) → divider → Document (scraped hexes) → divider → Custom (global, add_circle)`. [CP44 @L910]

- **"Easter Egg" `colors:` metadata** purely for pre-filling the Document middle section: "We can also just allow a 'colors' metadata purely for pre-filling that middle section, but it will be an Easter Egg. The auto features will cover 99%." [CP44 @L908]

- **Single scrape rule covers both `tableColors` (in-use colors) and `metadata.colors`** — "the middle section is just 'every hex code in the doc's metadata.'" [CP44 @L910]

- **Custom color persistence:** picking via `add_circle` applies to cell AND prepends to the Custom row (deduped, capped, most-recent-first). [CP43 @L898]

- **Known risk accepted:** the native OS color panel is non-modal on macOS — it lingers after the picker closes, and commit-on-first-change can grab a color "a beat early while you're still dragging." Fallback: in-popover hex field + preview. [CP46 @L967]

## Theme 5 — Second Bug (Color + Click): Root-Cause Decisions (CP47–CP68)

The hunt passed through several rejected diagnoses. Each "decision" is the conclusion reached at that step (several were later overturned).

- **CP47 — Not bloat, not a crash; it's an interaction regression.** "No errors in the log and no runaway file sizes (largest is `OfficeDocumentPage.tsx` at 479 — a bit over the 400 guideline but it's a page owning a lot, not bloat from this)." Overlay verified clean (`pointer-events: none`). [CP47 @L972]

- **CP49 — Audit clean, not accumulated cruft.** "every listener is legit and paired with cleanup; the only leftover 'garbage' is the `[CLICK]` probe I just added… No stray listeners from the resize saga survived." [CP49 @L1022]

- **CP51 — (First wrong diagnosis) Invisible virtual caret.** Probe proved the editor WAS working: "the click focused it, the window has focus, and a **caret was actually placed in the editor**." Diagnosis: Milkdown's `ProseMirror virtual-cursor-enabled` class hides the native caret (`caret-color: transparent`); `--prosemirror-virtual-cursor-color` was bound to `--crepe-color-outline` from the **dark** Crepe theme, but the office paper is fixed **light** (#faf9f6), so the caret was drawn light-on-light. [CP51 @L1079] First fix attempt: force a dark caret on light paper. [CP51 @L1079]

- **CP53 — (Correction) Specificity loss.** First caret fix didn't take: `.ProseMirror-focused { --prosemirror-virtual-cursor-color: var(--crepe-color-outline); }` is set **directly on the `.ProseMirror` element**, so the caret inherits that light value — the override on `.milkdown` one level up "never wins." Re-decision: "it wasn't a disabled feature rebelling — it was CSS inheritance. Let me put the override where it actually wins." [CP53 @L1116] (This fix DID make the caret visible — confirmed CP55: `vcColor=rgb(28, 28, 28)`.)

- **CP55 — (Second wrong diagnosis) `applyColors` stomping selection.** Smoking gun: "Your keystrokes *are* landing… but they're going to the end of the document instead of where you clicked. That means something is resetting the selection to the doc end." Caret pinned to `y=1177` — bottom. Diagnosis: "`applyColors` runs on **every** editor mutation and writes `background-color` onto **cells, which live inside ProseMirror's editable content**. Those writes make ProseMirror's DOM observer flush on every keystroke, and that's collapsing the selection to the end." Fix attempted: make `applyColors` **idempotent** — "only touch a cell when its color actually needs to change." [CP55 @L1171]

- **CP57 — Idempotent fix did NOT help; not the color writes.** "the idempotent fix not helping means it's *not* the color writes… the click often isn't even focusing the editor." Decisive test proposed: "Open a *different* office document — or make a new blank one — and try clicking mid-paragraph and typing there." [CP57 @L1206]

- **CP58 — (Third wrong diagnosis) Editor recreated on autosave.** After reading the file (found in `fusion-home`, not `fs-dev` — which is why search missed it [CP58 @L1237]): "the document itself is **structurally fine** — valid frontmatter, normal headings/lists/tables/code." Hypothesis: "the editor is being **recreated on every autosave** (which resets the selection to the end)." [CP58 @L1237]

- **CP61 — (Overturns CP58) Editor NOT recreating; autosave storm genuinely fixed.** "`[EDITOR-EFFECT]` fired **once**, so the editor is *not* re-creating on save — I was wrong about that." And: "no, there's no runaway loop happening right now. The whole renderer log is only **170 lines** — a spinning loop would be tens of thousands. The table rebuild storm is genuinely fixed… autosave fired a normal **3 times**, and the editor mounted **once**." [CP61 @L1274]

- **CP65 — (Breakthrough) Different document works; colors never applied; the two symptoms are connected.** User: "I went to another document and clicked, and it worked fine. This may be a good time to mention that adding color to the cells never worked… I could tell from the picker that the color was being saved even if it wasn't applied to the page." [CP65 @L1307] Assistant: "Other documents work fine. So the editor code is *not* broken — I've been chasing a ghost… **this specific document's content is corrupted/degraded**, and a broken doc structure explains *both*." The file showed "tell-tale rot: `<br />` on nearly every line, empty list items (`* <br />`), `![1.00]()`, and your typed garbage fused onto the last heading." [CP65 @L1309]

- **CP67 — (Final root cause) Coloring a cell CORRUPTS the document.** User reproduced on a fresh doc: "lmao I reproduced the bug in the new document by trying to color a cell. No color and click is broken now." [CP67 @L1338] Assistant: "coloring cell `'0,0': '#ffff00'` saved to frontmatter, but the cell (`| <br /> | <br /> |`) never got the color, and the whole doc is now caret-broken. So the bug is exactly what I feared but couldn't prove until now: **painting a cell writes `background-color` *into* a `<td>`, which lives inside ProseMirror's editable content.** ProseMirror reacts by re-rendering the cell (wiping the color) and resetting the selection to the end. Resize works because it writes to the table *chrome*, outside the editable content — colors don't get that luxury." [CP67 @L1338]

- **CP67 — THE FIX.** "The fix: **never touch the cells.** Instead, tag the table (outside the editable content, like resize does) and paint the colors through an injected stylesheet. The editable DOM is never modified." [CP67 @L1338]

- **CP68 — Confirmed working.** User: "It works and it's gorgeous." [CP68 @L1374] Final framing: "every symptom — invisible caret, 'clicks don't work,' typing jumping to the bottom, colors not sticking — was one root cause. **Writing `background-color` onto the `<td>` cells put data inside ProseMirror's editable content, and ProseMirror fought back** by re-rendering the cell (killing the color) and collapsing the selection to the end. The fix was to stop touching the cells entirely and paint them from an injected stylesheet, tagging only the table chrome — the exact same 'don't fight the editor, work outside it' principle that fixed the resize drag earlier." [CP68 @L1374]

## Theme 6 — The Autosave / "Spinning Out of Control" Bug (CP61)

- User asked directly: "You told me there was an autosave bug spinning out of control non-stop. Did we fix that?" [CP61 @L1274]
- **Decision: it WAS already fixed, and is NOT the current problem.** The "spinning out of control" was the **table rebuild storm (6,771 rebuilds)** from the first bug hunt. [CP61 @L1274] Verification: renderer log only 170 lines, no flood of rebuilds, autosave fired a normal 3 times, editor mounted once. [CP61 @L1274]

## Theme 7 — Wiki: Office Viewer Sub-Articles (CP69–CP71) [DONE]

- **CP69 — Edit the Office Wiki; copy the chat-system lessons paradigm.** "Edit the Office Wiki. You may, at your discretion, add additional pages describing different functions that we're building out. There is a lessons wiki attached to the chat system. You could copy that paradigm and attach it to the office viewer wiki." [CP69 @L1382]

- **CP71 — Two sub-articles decided.** "Add a sub-article to the office viewer specifically for working with the document editor. And add a sub-article of lessons." [CP71 @L1413]

- **Placement convention:** Lessons at `003-Lessons` (matching "Chat, Voice, Wiki View all use `003-Lessons`"); Document Editor at `001-`. [CP71 @L1413]

- **Main page correction:** the old "Table Geometry" section "still claimed row resizing and showed a `rows: [...]` frontmatter shape, both now wrong. It's rewritten to columns-only + colors, with the sibling frontmatter example." [CP71 @L1413]

## Theme 8 — Memories vs. Skills (CP72–CP76)

- **Storage:** individual markdown files, one per fact, in `~/.claude/projects/-Users-rccurtrightjr-/memory/`, plus one index file `MEMORY.md` with a single line per memory. [CP73 @L1475] Each file has frontmatter (`name`, `description`, `metadata.type`: user/feedback/project/reference) and a short body. ~45 individual memory files + the index = 46 `.md` files total. [CP73 @L1475] [CP74 @L1483]

- **Two-tier recall model:** Tier 1 — `MEMORY.md` is "always loaded… in my context at the start of every session." Tier 2 — the full files are "recalled on relevance" inside `<system-reminder>` blocks when the current topic matches a memory's `description` line. [CP75 @L1500]

- **Skills vs. memories:** "Skills are *pulled*: capabilities/instructions I invoke on demand… They only enter the conversation when triggered. Memories are *pushed*: `MEMORY.md` is loaded into my context **at the start of every session**, and relevant individual ones get surfaced as background notes. Nothing invokes them — they're ambient." [CP73 @L1475]

- **Why "Robin" persists after code cleanup:** "when you deleted Robin from the code, the *code* forgot Robin, but memories like `open-robin-is-harness`, `robin-shared-context`, and `knowledge-partitioning` are still sitting in that folder, still loaded every session, still whispering 'Robin' into my context. They're frozen snapshots of what was true when written." [CP73 @L1475] Robin appears in ~20 files including `MEMORY.md` itself; some are "Robin-the-assistant" (dead), others "open-robin-the-server" (may still be valid), so "a blind 'delete everything with Robin' would over-cut." [CP74 @L1483]

- **The recall lever:** "the recall is only as good as the `description` field. A vague description = poor recall; a description mentioning 'Robin' = Robin keeps surfacing." [CP75 @L1500]

- **User's product verdict on the memory system:** "It's like the Claude Code team tried to [do] what I want to do with the wiki, but zero visibility by the user, so contradictions just rot context." [CP76 @L1508] Assistant: "Evidence-Gated Execution with the evidence gate removed — Facts go in on write, never get re-validated against reality, and keep firing." [CP76 @L1508]

- **What memory lacks vs. the user's wiki:** no edges (user has incoming/outgoing edges + edge-consistency workflow; memory has hand-written `[[links]]`); no consistency pass (user has Wiki Audit; memory has no dedup/contradiction detection); no versioning / "living vs. frozen"; zero visibility. [CP76 @L1508]

- **No cleanup was performed.** Both a "fast nuke" and a "careful audit" path were offered [CP73 @L1475]; user did not authorize either and pivoted to wiki work.

## Theme 9 — Wiki Restructure: `Fusion_Home` (CP77–CP81) [PROPOSED, NOT COMPLETED]

- **CP77 — Wiki-guide model distilled.** Sections = `NNN-Name/` folders; a section's `000-` child is its front page (hand-written prose + script-maintained `<!-- section-toc:start/end -->` block); main articles = `NNN-Article/PAGE.md` with real content ending in `## Children` if sub-articles; sub-articles added to parent's `## Children` by hand; frontmatter carries graph (`incoming-edges`/`outgoing-edges` by page name, `source-files`, `connected-skills`, `related-trigger-files`). A section with a `000-` heading article must NOT also have a folder-level `PAGE.md`. The sync script (`node fusion-studio-server/scripts/sync-wiki-tocs.js <workspace>`) is manual-run only and maintains marker blocks, NOT `## Children` lists. [CP77 @L1520]

- **CP77 — Confession that CP71 sub-article placement was wrong.** "I got the Office sub-articles slightly wrong. I dropped Document Editor + Office Lessons into the existing **`## Related Pages`** section, but per the guide those are *owned children* and belong in a **`## Children`** list." [CP77 @L1520] (Never corrected before pivot.)

- **CP79 — Office Suite heading structure proposed:** "Office Suite /Lessons /Vision /Decisions /Changes" with sub-folders "Email, Calendar, ToDo, Office Home, Documents, Sheets, Pdf-2-Html, Utilities." LESSONS up top under the header; "Decisions, Lessons, Vision and Changes in bite size pieces for the whole domain, details in articles." Office Home can have sub-articles on Milkdown and Crepe. [CP79 @L1546]

- **CP79 — Strategic decision: externalize memories into wiki files.** "I need any code editor to be able to find context, not just CC. So I have to put your memories into external files and maybe we save a few pointers or save in Claude.md to consume the Wiki guide in lieu of having a memory index." [CP79 @L1546]

- **CP79 — Audit-decisions doc is mostly "agreed, not yet implemented."** "The `type` field, computed edges, `<!-- children:start/end -->` markers, and the audit script don't exist yet — today's live tooling only maintains `<!-- section-toc -->` blocks, and `## Children` is still hand-maintained. So I'll build in the **current** live format." [CP79 @L1546]

- **CP79 — Assistant's proposed tree (`009-Office_Suite`, later superseded):** `000-Office_Suite`, `001-Lessons`, `002-Vision`, `003-Decisions`, `004-Changes`, `005-Office_Home` (with `001-Milkdown`, `002-Crepe`), `006-Documents`, `007-Sheets`, `008-Pdf_2_Html`, `009-Email`, `010-Calendar`, `011-ToDo`, `012-Utilities`. Three open calls: placement (top-level vs under Workspaces And Views; retire `014-Office_Viewer`); Office Home vs Documents ambiguity; how to dissolve the existing Document Editor article. [CP79 @L1546]

- **CP80–CP81 — Disambiguation: per-view top-level pages.** "Perhaps to disambiguate, we do: Office_Viewer Calendar_Viewer etc. I do believe that each doc type probably needs it's own top level page… We can link them in Office_Viewer." [CP81 @L1568]

- **CP81 — RENAME: `Fusion_Home`, not Office Suite.** "OH! Call it Fusion_Home instead of Office Quite! Explain that it is a templated 'Workspace' that ships with the app, and contains these other views that do not automatically drop into new repos and wrokspaces (but can be added by user interaction)." [CP81 @L1568]

- **CP81 — Workspaces_and_Views reframe:** change heading to list the defaults: "Capture, File Explorer, Wiki, Issues, Agents." [CP81 @L1568]

- **CP81 — Scope locked to THREE cataloguing targets today:** "We only need to calalogue: Workspace and Views, Fusion Home, System Manager." [CP81 @L1568] Web Design Studio explicitly out of scope.

- **CP81 — System Manager handling:** "Don't go digging into System Manager either. But do stub the header. And maybe pull any articles in under it that seem to match." [CP81 @L1568]

- **CP81 — Reason for breadcrumbs, not full build:** "I am literally planning to run that SPEC in two days and go long and deep on build ing the wiki then. I just don't want your context and knwledge to dissapear into the ether. This was a pain in the ass to get working. We need bread crumbs." [CP81 @L1568]

## Theme 10 — Decisions About What NOT to Do

- **Do not bring back Crepe's native table handles.** "Do not bring back Crepe table handles. Office owns table resize/menu UI." [CP1 @L81]
- **Do not rewrite table content into HTML/CSS.** [CP1 @L81]
- **Do not revert unrelated dirty-worktree changes.** "The worktree is heavily dirty. Do not revert unrelated changes." [CP1 @L81]
- **Do not commit; user keeps commits.** "I left that to you since you keep commits on your side." [CP21 @L562]

---

## Callout — User Overrides of Assistant Recommendations

These are moments the user explicitly overrode or redirected the assistant's plan:

- **Drop horizontal (row) resizing entirely.** "Hell, I'm thinking we don't even do horizontal adjustments. I've always been annoyed by those." [CP16 @L398] The assistant had been treating row resize as a feature to preserve; the user unilaterally removed it. The assistant later called this "the single biggest win." [CP17 @L402]
- **The breakthrough: stop rebuilding the resize layer on every mouse move; drag a guide in the non-editable margin and commit once on release.** "If the problem is that it is being destroyed and rebuilt constantly, then why not this… We draw a dotted line… you drag the dotted line, and when you let go, you unclick, and the real line snaps to place. **One destroy and one redraw.**" [CP16 @L398] [CP17 @L400] The assistant was mid-instrumentation when the user inverted the problem. [CP16 @L398] [CP22 @L567]
- **Do not run the resize back through Milkdown/Crepe.** "We can do all of this without running it back through milked down or crates." [CP17 @L400]
- **Use the mouse pointer along the column line, not the drag bar.** [CP19 @L470]
- **Remove the drag bars entirely** (escalated from "hide inside the table" [CP20 @L503] to "We don't need those drag buttons at all" [CP21 @L507]).
- **"Last in overrides" reversal** — overrode the assistant's cell>row>column fixed precedence in favor of recency-based promotion. [CP24 @L590]
- **Always re-stamp, no skip-if-identical optimization** — overrode an efficiency optimization. [CP27 @L606]
- **No cell promotion logic** — cut over-engineering the assistant was proposing. [CP27 @L606]
- **Rank vs timestamp left to engineering discretion** — refused to over-specify. [CP29 @L613]
- **Rename Office Suite to Fusion_Home** mid-proposal. [CP81 @L1568]
- **Lock scope to three cataloguing targets** and defer the rest to a SPEC session two days later. [CP81 @L1568]

The assistant explicitly credited the user at the close of Arc 1: "Your 'do it outside the table / drop row resizing / grab with the pointer' instincts were what actually cracked it." [CP21 @L562] [CP22 @L571]

---

## Open / Unconfirmed Decisions

- **Office sub-articles' `## Related Pages` vs `## Children` placement** — confessed wrong at CP77 [CP77 @L1520]; never corrected before the pivot.
- **The entire `Fusion_Home` wiki restructure** (CP77–CP81) — proposed in detail, zero folders created. Conversation ended mid-action on a session-limit reset. [CP81 @L1568]
- **Reframing `Workspaces_and_Views` heading** to list defaults — proposed, not executed. [CP81 @L1568]
- **Stubbing the System Manager header** — proposed, not executed. [CP81 @L1568]
- **Memory cleanup (Robin ghost, etc.)** — both "fast nuke" and "careful audit" paths offered; neither authorized. [CP73 @L1475] [CP74 @L1483]
- **Native panel non-modal commit timing** — flagged as a known risk; no fix applied. [CP46 @L967]
- **`assets/README.md` degraded body** (`<br />` soup) — not cleaned. [CP68 @L1374]
- **Office component CSS still in `OfficeDocumentPage.css` with a couple hardcoded z-indexes** — not refactored. [CP68 @L1374]
- **`officeTableGeometry.ts` was untracked in git from the original handoff** and still lacks a committed baseline. [CP0 @L203] [CP21 @L1678]
- **Auto-blend at intersections** — explicitly deferred to a later version. [CP23 @L584]
- **Brand-new shared in-app color spectrum** — only to be built if the user asks (native OS panel is the current mechanism). [CP40 @L695]
