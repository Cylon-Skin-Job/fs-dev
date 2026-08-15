# Chunk 3 Report — CP44 through CP81

Second bug hunt (cursor/click broken + color not applying), its root cause and fix (CP47–CP68), then the pivot to wiki work: Office Viewer sub-articles, the memories-vs-skills inquiry, and a proposed (but unfinished) Fusion_Home wiki restructure (CP69–CP81). The conversation ENDS at CP81 mid-action on a session-limit reset.

---

## 1. DECISIONS

### 1.1 Color picker final shape (CP44–CP46, overlap with chunk 2)

- **Three-tier picker decided:** "None → Defaults (Google grid) → divider → Document (scraped hexes) → divider → Custom (global, `add_circle`)." [CP44 @L908] The Document tier is "every hex code in the doc's metadata" — one scrape rule covers colors actually in use (in `tableColors`) AND a power-user `metadata.colors: [...]` array. [CP44 @L908]
- **Custom is global** (localStorage), survives across docs; clearing Custom never touches the Document tier. [CP44 @L908]
- A `colors` metadata field is an "Easter Egg" purely for pre-filling the middle section — "auto features will cover 99%." [CP44 @L908]

### 1.2 Second bug hunt — root-cause decisions (CP47–CP68)

The hunt passed through several rejected diagnoses before the true root cause was isolated. Each "decision" below is the conclusion reached at that step (several were later overturned).

- **CP47 — Not bloat, not a crash.** "No errors in the log and no runaway file sizes (largest is `OfficeDocumentPage.tsx` at 479 — a bit over the 400 guideline but it's a page owning a lot, not bloat from this). So this isn't a crash or bloat — it's an interaction regression." [CP47 @L972] Overlay verified clean (`pointer-events: none`). [CP47 @L972]
- **CP49 — Audit clean, not accumulated cruft.** "The audit's clean — every listener is legit and paired with cleanup; the only leftover 'garbage' is the `[CLICK]` probe I just added… No stray listeners from the resize saga survived. So this isn't accumulated cruft." [CP49 @L1022] Clicks were landing on real content (`p`, `h2`).
- **CP51 — (First wrong diagnosis) Invisible virtual caret.** Probe proved editor WAS working: "The editor **is** working — the click focused it, the window has focus, and a **caret was actually placed in the editor**." [CP51 @L1079] Diagnosis: Milkdown's `ProseMirror virtual-cursor-enabled` class replaces the native blinking caret with a virtual one and hides the native (`caret-color: transparent`); `--prosemirror-virtual-cursor-color` was bound to `--crepe-color-outline` from the **dark** Crepe theme, but the office paper is fixed **light** (#faf9f6), so the caret was drawn light-on-light — "placed correctly, editable, focused, but invisible." [CP51 @L1079] Fix attempted: force a dark caret on light paper (one CSS line). [CP51 @L1079]
- **CP53 — (Correction) Specificity loss.** First caret fix didn't take because of CSS inheritance: `.ProseMirror-focused { --prosemirror-virtual-cursor-color: var(--crepe-color-outline); }` is set **directly on the `.ProseMirror` element**, so the caret inherits that light value — the override on `.milkdown` one level up "never wins." [CP53 @L1116] Re-decision: "it wasn't a disabled feature rebelling — it was CSS inheritance. Let me put the override where it actually wins" — same element, higher specificity. [CP53 @L1116] (This fix DID make the caret visible — confirmed later at CP55: `vcColor=rgb(28, 28, 28)`.)
- **CP55 — (Second wrong diagnosis) `applyColors` stomping selection.** Smoking gun: "Your keystrokes *are* landing… but they're going to the end of the document instead of where you clicked. That means something is resetting the selection to the doc end." [CP55 @L1171] Probe showed caret pinned to `y=1177` — bottom. [CP55 @L1171] Diagnosis: "`applyColors` runs on **every** editor mutation and writes `background-color` onto **cells, which live inside ProseMirror's editable content**. Those writes make ProseMirror's DOM observer flush on every keystroke, and that's collapsing the selection to the end. (The resize layer writes to table *chrome* outside the editable content, which is why it never did this.)" [CP55 @L1171] Fix attempted: make `applyColors` **idempotent** — "only touch a cell when its color actually needs to change." [CP55 @L1171]
- **CP57 — Idempotent fix did NOT help; not the color writes.** "the idempotent fix not helping means it's *not* the color writes… the click often isn't even focusing the editor." [CP57 @L1206] Assistant leans toward user's "Crepe is co-opting something" instinct and proposes the decisive test: open a *different* office document — "If a fresh doc behaves normally → this specific document got into a bad state… If a fresh doc is *also* broken → it's live code intercepting clicks." [CP57 @L1206]
- **CP58 — (Third wrong diagnosis) Editor recreated on autosave.** After reading the file (`/Users/rccurtrightjr./projects/fusion-home/ai/RC-MacAir-15/Office/assets/README.md` — found in `fusion-home`, not `fs-dev`, which is why search missed it [CP58 @L1237]): "the document itself is **structurally fine** — valid frontmatter, normal headings/lists/tables/code. So it's not corruption; the editor is genuinely dumping every keystroke at the document's end." [CP58 @L1237] New hypothesis: "the editor is being **recreated on every autosave** (which resets the selection to the end). Our color/width saves write frontmatter and could be re-triggering the editor's effect." [CP58 @L1237]
- **CP61 — (Overturns CP58) Editor NOT recreating; autosave storm genuinely fixed.** Log answered recreation theory: "`[EDITOR-EFFECT]` fired **once**, so the editor is *not* re-creating on save — I was wrong about that." [CP61 @L1274] On the autosave-storm question: "no, there's no runaway loop happening right now. The whole renderer log is only **170 lines** — a spinning loop would be tens of thousands. The table rebuild storm is genuinely fixed (no flood of rebuilds), autosave fired a normal **3 times**, and the editor mounted **once**." [CP61 @L1274]
- **CP65 — (Breakthrough) Different document works; colors never applied.** User: "I went to another document and clicked, and it worked fine. This may be a good time to mention that adding color to the cells never worked… I could tell from the picker that the color was being saved even if it wasn't applied to the page." [CP65 @L1307] Assistant's new conclusion: "Other documents work fine. So the editor code is *not* broken — I've been chasing a ghost… And I think you're right that they're connected: **this specific document's content is corrupted/degraded**, and a broken doc structure explains *both* — ProseMirror can't map a click into a malformed doc (so the caret falls to the end), and the tables likely didn't render as real `.rv-office-table` elements (so `applyColors` had nothing to paint)." [CP65 @L1307] The file showed "tell-tale rot: `<br />` on nearly every line, empty list items (`* <br />`), `![1.00]()`, and your typed garbage fused onto the last heading. That's what repeated save round-trips did to it." [CP65 @L1307]
- **CP67 — (Final root cause) Coloring a cell CORRUPTS the document.** User reproduced on a fresh doc: "lmao I reproduced the bug in the new document by trying to color a cell. No color and click is broken now." [CP67 @L1338] Assistant reads `/users/rccurtrightjr./projects/fusion-home/ai/RC-MacAir-15/Office/captures/README.md`: "coloring cell `'0,0': '#ffff00'` saved to frontmatter, but the cell (`| <br /> | <br /> |`) never got the color, and the whole doc is now caret-broken. So the bug is exactly what I feared but couldn't prove until now: **painting a cell writes `background-color` *into* a `<td>`, which lives inside ProseMirror's editable content.** ProseMirror reacts by re-rendering the cell (wiping the color) and resetting the selection to the end. Resize works because it writes to the table *chrome*, outside the editable content — colors don't get that luxury." [CP67 @L1338]
- **CP67 — THE FIX.** "The fix: **never touch the cells.** Instead, tag the table (outside the editable content, like resize does) and paint the colors through an injected stylesheet. The editable DOM is never modified." [CP67 @L1338] (Implemented via Edit on `officeTableColors.ts` [CP67 @L1338]; teardown cleanup added.)
- **CP68 — Confirmed working.** User: "It works and it's gorgeous." [CP68 @L1374] Assistant's final framing: "every symptom — invisible caret, 'clicks don't work,' typing jumping to the bottom, colors not sticking — was one root cause. **Writing `background-color` onto the `<td>` cells put data inside ProseMirror's editable content, and ProseMirror fought back** by re-rendering the cell (killing the color) and collapsing the selection to the end. The fix was to stop touching the cells entirely and paint them from an injected stylesheet, tagging only the table chrome — the exact same 'don't fight the editor, work outside it' principle that fixed the resize drag earlier." [CP68 @L1374]

### 1.3 The autosave / "spinning out of control" bug

- User asked directly: "You told me there was an autosave bug spinning out of control non-stop. Did we fix that? I thought it was part of the build, but maybe it was forgotten?" [CP61 @L1274]
- **Decision: it WAS already fixed, and is NOT the current problem.** The "spinning out of control" was the **table rebuild storm (6,771 rebuilds)** [CP61 @L1274]. Verification: renderer log only 170 lines, no flood of rebuilds, autosave fired a normal 3 times, editor mounted once. [CP61 @L1274] "So that 'spinning out of control' bug is not what's biting us now — this is a much quieter, single-editor selection problem." [CP61 @L1274]

### 1.4 Wiki decisions — Office Viewer sub-articles (CP69–CP71) [DONE]

- **CP69 — Edit the Office Wiki; copy the chat-system lessons paradigm.** User: "Edit the Office Wiki. You may, at your discretion, add additional pages describing different functions that we're building out. There is a lessons wiki attached to the chat system. You could copy that paradigm and attach it to the office viewer wiki." [CP69 @L1382]
- **CP71 — Two sub-articles decided.** User: "Add a sub-article to the office viewer specifically for working with the document editor. And add a sub-article of lessons. I'll sort out finding a better home for it later." [CP71 @L1413]
- **Placement convention decided:** Lessons at `003-Lessons` to match existing convention ("Chat, Voice, Wiki View all use `003-Lessons`"), Document Editor at `001-`. [CP71 @L1413]
- **Main page correction decided:** the old "Table Geometry" section "still claimed row resizing and showed a `rows: [...]` frontmatter shape, both now wrong. It's rewritten to columns-only + colors, with the sibling frontmatter example." [CP71 @L1413]
- **CP77 — Confession that CP71 placement was slightly wrong.** After reading the actual wiki guide: "I got the Office sub-articles slightly wrong. I dropped Document Editor + Office Lessons into the existing **`## Related Pages`** section, but per the guide those are *owned children* and belong in a **`## Children`** list — Related Pages is for cross-links to other sections." [CP77 @L1520] (User did not direct a fix before pivoting.)

### 1.5 Memories vs. skills — conclusions (CP72–CP76)

- **Storage:** individual markdown files, one per fact, in `~/.claude/projects/-Users-rccurtrightjr-/memory/`, plus one index file `MEMORY.md` with a single line per memory. [CP73 @L1475] Each file has frontmatter (`name`, `description`, `metadata.type`: user/feedback/project/reference) and a short body. [CP73 @L1475] ~45 individual memory files + the index = 46 `.md` files total. [CP74 @L1483]
- **Two-tier recall model:** "Tier 1 — the index (always loaded): `MEMORY.md`… in my context at the start of every session." "Tier 2 — the full files (recalled on relevance): each of those one-liners points to a full `.md` file with much more text — frontmatter plus a body that, for feedback/project types, includes **Why** and **How to apply** detail and `[[links]]` to related memories. Those fuller bodies get pulled into the conversation as background notes (inside `<system-reminder>` blocks) when the current topic matches — the matching is done off each memory's `description` line." [CP75 @L1500]
- **Skills vs. memories:** "Skills are *pulled*: capabilities/instructions I invoke on demand… They only enter the conversation when triggered. Memories are *pushed*: `MEMORY.md` is loaded into my context **at the start of every session**, and relevant individual ones get surfaced as background notes. Nothing invokes them — they're ambient." [CP73 @L1475]
- **Why "Robin" persists after code cleanup:** "when you deleted Robin from the code, the *code* forgot Robin, but memories like `open-robin-is-harness`, `robin-shared-context`, and `knowledge-partitioning` are still sitting in that folder, still loaded every session, still whispering 'Robin' into my context. They're frozen snapshots of what was true when written." [CP73 @L1475] Robin appears in ~20 of the files including `MEMORY.md` itself; some are "Robin-the-assistant" (dead), others are "open-robin-the-server" (may still be valid), so "a blind 'delete everything with Robin' would over-cut." [CP74 @L1483]
- **The recall lever:** "the recall is only as good as the `description` field. A vague description = poor recall; a description mentioning 'Robin' = Robin keeps surfacing. That's the lever for the cleanup." [CP75 @L1500]
- **User's product verdict on the memory system:** "It's like the Claude Code team tried to [do] what I want to do with the wiki, but zero visibility by the user, so contradictions just rot context." [CP76 @L1508] Assistant agreed it is "an unvalidated, invisible knowledge graph that quietly rots, which is the exact failure mode your architecture exists to prevent. The Robin ghost isn't a bug in the concept, it's the concept without the guardrails you already designed" — and framed it as "Evidence-Gated Execution with the evidence gate removed." [CP76 @L1508]
- **What memory lacks vs. the user's wiki (per assistant):** no edges (user has incoming/outgoing edges + edge-consistency workflow; memory has hand-written `[[links]]`, nothing checks them); no consistency pass (user has Wiki Audit; memory has no dedup/contradiction detection); no versioning / "living vs. frozen" (memory has no notion of stale); zero visibility. [CP76 @L1508]
- **No cleanup was performed.** The assistant offered both a "fast nuke" and a "careful audit" path [CP73 @L1475]; the user instead pivoted to wiki work without authorizing deletion.

### 1.6 Wiki restructure decisions (CP77–CP81) [PROPOSED, NOT COMPLETED]

- **CP77 — Wiki-guide model distilled (the rules the restructure must follow):** Sections = `NNN-Name/` folders; a section's `000-` child is its front page (hand-written prose + script-maintained `<!-- section-toc:start/end -->` block); main articles = `NNN-Article/PAGE.md` with real content ending in `## Children` if sub-articles; sub-articles added to parent's `## Children` by hand; frontmatter carries graph (`incoming-edges`/`outgoing-edges` by page name, `source-files`, `connected-skills`, `related-trigger-files`). A section with a `000-` heading article must NOT also have a folder-level `PAGE.md`. The sync script (`node fusion-studio-server/scripts/sync-wiki-tocs.js <workspace>`) is manual-run only and maintains marker blocks, NOT `## Children` lists. [CP77 @L1520]
- **CP78–CP79 — Office Suite heading structure proposed:** "Office Suite /Lessons /Vision /Decisions /Changes" with sub-folders "Email, Calendar, ToDo, Office Home, Documents, Sheets, Pdf-2-Html, Utilities." [CP79 @L1546] LESSONS up top under the header; "Decisions, Lessons, Vision and Changes in bite size pieces for the whole domain, details in articles." [CP79 @L1546] Office Home can have sub-articles on Milkdown and Crepe. [CP79 @L1546]
- **CP79 — Strategic decision: externalize memories into wiki files.** User: "I need any cod editor to be able to find context, not just CC. So I have to put your memories into external files and maybe we save a few pointers or save in Claude.md to consume the Wiki guide in lieu of having a memory index." [CP79 @L1546]
- **CP79 — Audit-decisions doc is mostly "agreed, not yet implemented."** Assistant flag: "that decisions doc is mostly 'agreed, not yet implemented.' The `type` field, computed edges, `<!-- children:start/end -->` markers, and the audit script don't exist yet — today's live tooling only maintains `<!-- section-toc -->` blocks, and `## Children` is still hand-maintained. So I'll build in the **current** live format." [CP79 @L1546]
- **CP79 — Assistant's proposed tree (the `009-Office_Suite` plan, later superseded):** `009-Office_Suite/` with `000-Office_Suite`, `001-Lessons`, `002-Vision`, `003-Decisions`, `004-Changes`, `005-Office_Home` (with `001-Milkdown`, `002-Crepe`), `006-Documents`, `007-Sheets`, `008-Pdf_2_Html`, `009-Email`, `010-Calendar`, `011-ToDo`, `012-Utilities`. Three open calls: placement (top-level vs under Workspaces And Views; retire `014-Office_Viewer`); Office Home vs Documents ambiguity; how to dissolve the existing Document Editor article. [CP79 @L1546]
- **CP80–CP81 — Disambiguation: per-view top-level pages.** User: "Perhaps to disambiguate, we do: Office_Viewer Calendar_Viewer ect. I do believe that each doc type probably needs it's own top level page… We can link them in Office_Viewer. Individual Doc editor views present thier own complexity and have been rendered as top level articles: Name(link) and Description of each." [CP81 @L1568] This fact to be presented both in the suite header and within Office_Viewer. [CP81 @L1568]
- **CP81 — RENAME: `Fusion_Home`, not Office Suite.** User: "OH! Call it Fusion_Home instead of Office Quite! Explain that it is a templated 'Workspace' that ships with the app, and contains these other views that do not automatically drop into new repos and wrokspaces (but can be added by user interaction)." [CP81 @L1568]
- **CP81 — Workspaces_and_Views reframe decided:** later change its heading to list the defaults: "Capture, File Explorer, Wiki, Issues, Agents." [CP81 @L1568] Rationale: "A handful of Views in Fusion Home behave as Office Apps, completing the circuit." [CP81 @L1568]
- **CP81 — Scope locked to THREE cataloguing targets today:** "We only need to calalogue: Workspace and Views, Fusion Home, System Manager." [CP81 @L1568] Web Design Studio explicitly out of scope ("does not affect fs-dev code base and therefore isn't in this domain"). [CP81 @L1568]
- **CP81 — System Manager handling decided:** "Don't go digging into System Manager either. But do stub the header. And maybe pull any articles in under it that seem to match." [CP81 @L1568]
- **CP81 — Reason for breadcrumbs, not full build:** "I am literally planning to run that SPEC in two days and go long and deep on build ing the wiki then. I just don't want your context and knwledge to dissapear into the ether. This was a pain in the ass to get working. We need bread crumbs." [CP81 @L1568]
- **CP81 — Assistant confirmed locked scope:** rename to `Fusion_Home` (templated workspace shipping with the app, holds office-app views running on SQLite that don't auto-drop into new repos/workspaces but can be user-added; each view its own top-level article catalogued in the Fusion Home heading); only three things to catalogue today (Fusion Home new domain with the hard-won Office editor knowledge moved in; Workspaces And Views reframed as defaults; System Manager stubbed). [CP81 @L1568]

---

## 2. LESSONS

### 2.1 Debugging lessons from the second bug hunt

- **Don't trust a single confirmed diagnosis when multiple symptoms are unexplained.** The hunt cycled through at least three wrong root causes before the true one: invisible virtual caret (CP51, partially right — caret WAS invisible but that was a symptom not the cause), `applyColors` stomping the selection via ProseMirror's DOM observer (CP55, wrong — idempotent fix didn't help), and editor recreation on autosave (CP58, wrong — `[EDITOR-EFFECT]` fired once). The caret-color fix and the idempotent-apply fix were both retained as correct-in-themselves even though neither was the root cause. [CP55 @L1171] [CP58 @L1237] [CP68 @L1374]
- **The decisive isolation test was "try a different document."** The assistant proposed it explicitly at CP57 ("Open a *different* office document — or make a new blank one — and try clicking mid-paragraph and typing there") and the user's result at CP65 ("I went to another document and clicked, and it worked fine") collapsed the search space: "Other documents work fine. So the editor code is *not* broken — I've been chasing a ghost." [CP57 @L1206] [CP65 @L1307]
- **The second decisive move was reproducing by coloring a cell.** User: "lmao I reproduced the bug in the new document by trying to color a cell. No color and click is broken now." [CP66 @L1335] This proved the two symptoms (color not applying + cursor not clicking) were ONE bug, triggered by the color action itself — not pre-existing document rot.
- **False leads explicitly enumerated.** Bloat/file size — ruled out at CP47 (largest file 479 lines, "a page owning a lot, not bloat"). Accumulated click-garbage from the resize saga — ruled out at CP49 ("audit's clean — every listener is legit and paired with cleanup"). A disabled Milkdown/Crepe feature "rebelling" — ruled out at CP53 ("it wasn't a disabled feature rebelling — it was CSS inheritance"). Crepe co-opting click routing — user's instinct at CP56/CP57, acknowledged as "genuinely important" but ultimately the mechanism was different (ProseMirror fighting editable-DOM writes, not Crepe click-routing). [CP47 @L972] [CP49 @L1022] [CP53 @L1116] [CP57 @L1206]
- **The breakthrough realization was that the symptoms were connected through document corruption caused by the color action.** CP67: "coloring a cell *corrupts the document*, which then breaks the caret. Both bugs are one bug." [CP67 @L1338]
- **The generalizable principle (named at CP68):** "Writing `background-color` onto the `<td>` cells put data inside ProseMirror's editable content, and ProseMirror fought back… The fix was to stop touching the cells entirely and paint them from an injected stylesheet, tagging only the table chrome — the exact same 'don't fight the editor, work outside it' principle that fixed the resize drag earlier." [CP68 @L1374]
- **The renderer-log probe pattern paid off repeatedly.** Each probe narrowed the problem: clicks landing on real content (ruled out overlay intercept), `hasFocus=true` + `caretInEditor=true` (ruled out focus loss), `textLen` climbing (ruled out swallowed input), caret pinned to `y=1177` (proved mispositioning), `[EDITOR-EFFECT]` fired once (ruled out recreation). [CP49 @L1022] [CP51 @L1079] [CP55 @L1171] [CP61 @L1274]
- **Reading the actual saved file was a key clue.** Line 107 of the assets README was `## Quick Referencejkhjkhkjhkjhjj` — "Your typed garbage got appended to the **last heading**, at the very end." [CP58 @L1237] This both confirmed the "caret to end" symptom and (initially, wrongly) suggested document corruption from save round-trips.

### 2.2 The autosave-loop lesson

- The "spinning out of control non-stop" bug was the **table rebuild storm (6,771 rebuilds)**, already fixed before this chunk. [CP61 @L1274] The lesson from CP61 is to verify loop claims against the log rather than assume: "a spinning loop would be tens of thousands [of lines]" — the actual log was 170 lines. [CP61 @L1274]
- A related false lead: the assistant hypothesized the editor was "being recreated on every autosave (which resets the selection to the end)" [CP58 @L1237] — overturned by the `[EDITOR-EFFECT]` probe firing once. [CP61 @L1274]

### 2.3 Product lessons — stale memories silently corrupting context

- **Stale memories are sneaky because the index line alone is enough to resurface a dead concept.** "the *description line* is enough to keep resurfacing a dead concept like Robin without the whole file ever being 'opened.'" [CP75 @L1500]
- **Memories are frozen snapshots with no staleness notion.** "a 2026-02 fact and a 2026-07 fact sit at equal weight." [CP76 @L1508] The assistant's own instructions "warn me they may be stale and to verify against the code. Clearly I haven't been aggressive enough about that." [CP73 @L1475]
- **User's observation on the memory system's core flaw:** "It's like the Claude Code team tried to [do] what I want to do with the wiki, but zero visibility by the user, so contradictions just rot context." [CP76 @L1508] I.e., it has the shape of the user's wiki thesis (always-loaded index + fat linked files behind it, recall keyed off a description) but none of the guardrails (edges, consistency pass, versioning, visibility).
- **The Robin ghost is "Evidence-Gated Execution with the evidence gate removed"** — "Facts go in on write, never get re-validated against reality, and keep firing." [CP76 @L1508]
- **Strategic response decided:** externalize memories into portable wiki files so any code editor (not just Claude Code) can find context, with CLAUDE.md pointing at the wiki guide "in lieu of having a memory index." [CP79 @L1546]

### 2.4 Connecting seemingly-separate symptoms

- The user initially treated "color not applying" and "cursor not clicking" as separate issues, deliberately deferring the color bug to flesh out the menu first: "adding color to the cells never worked, but I wanted to flesh out the details of the menu first and then direct your attention toward whatever was missing… I also wasn't too concerned because I could tell from the picker that the color was being saved even if it wasn't applied to the page. There may be an error on my part not to have connected the two." [CP65 @L1307]
- The lesson: the color-saving-but-not-applying behavior was a tell that the color write path was misbehaving, and the caret breakage was a downstream effect of the same write. The assistant confirmed at CP67: "coloring a cell *corrupts the document*, which then breaks the caret. Both bugs are one bug." [CP67 @L1338] Deferring a "cosmetic" bug (color not painting) while chasing an "interaction" bug (caret) cost hours because they shared a root cause.

---

## 3. WORK / CHANGES

### 3.1 Color picker completion (CP44–CP46) [DONE]

- `Edit: fusion-studio-client/src/lib/front-matter.ts` — the scraper [CP44 @L908]
- `Write: fusion-studio-client/src/components/office/officeColorPopover.ts` — the three-tier popover [CP44 @L908]
- `Edit: fusion-studio-client/src/components/office/useCrepeEditor.ts` (×3) — plumb `getDocumentColors` through the editor hook [CP44 @L908]
- `Edit: fusion-studio-client/src/components/office/OfficeDocumentPage.tsx` (×3) — provide the callback scraping live frontmatter [CP44 @L908]
- `Edit: fusion-studio-client/src/components/office/OfficeDocumentPage.css` (×3 across CP44/CP46) — flex rows + dividers for Document/Custom sections [CP44 @L908] [CP46 @L954]
- `Bash: npm run build` + `bash scripts/restart.sh` [CP46 @L954]
- Final picker: None → Defaults (Google grid) → divider → Document (scraped hexes, palette duplicates filtered, hidden if none) → divider → Custom (global localStorage + `add_circle`). [CP46 @L954]

### 3.2 Second bug hunt — files read/edited (CP47–CP68)

Files read / inspected during the hunt:
- `Read: 005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` (user-supplied) [CP47 @L972]
- `Bash` greps of the renderer log at `/var/folders/.../electron-renderer.log` (multiple) [CP47 @L972] [CP49 @L1022] [CP50 @L1059] [CP51 @L1079] [CP55 @L1171] [CP59 @L1267] [CP61 @L1274] [CP62 @L1299]
- `Read: useCrepeEditor.ts` (slices) [CP47 @L972]
- `Bash` audits of office module for leftover console.log/DEBUG/HUD and event listeners [CP49 @L1022]
- `Bash` grep of `node_modules/@milkdown/crepe` for `virtual-cursor|caret-color` [CP51 @L1079]
- `Bash: cat node_modules/@milkdown/crepe/lib/theme/common/cursor.css` [CP53 @L1116]
- `Read: /Users/rccurtrightjr./projects/fusion-home/ai/RC-MacAir-15/Office/assets/README.md` (the degraded doc) [CP58 @L1237]
- `Read: /users/rccurtrightjr./projects/fusion-home/ai/RC-MacAir-15/Office/captures/README.md` (the reproduction doc) [CP67 @L1338]
- `Read: officeTableColors.ts` (slices +60, +210) [CP67 @L1338]

Debug probes added to and removed from `useCrepeEditor.ts`:
- `[CLICK]` probe (what's under cursor) [CP47 @L972] → removed at CP51 [CP51 @L1079]
- body-class + editability probe [CP49 @L1022] → removed
- focus + selection probe (`[CLICKAFTER]`) [CP50 @L1059] → removed at CP51 [CP51 @L1079]
- caret-element + keystroke probe (`[KEY]`, `[CARET]`) [CP54 @L1146] → removed
- editor-recreation probe (`[EDITOR-EFFECT]`) [CP58 @L1237] → removed at CP65 [CP65 @L1307]
- click-spot-vs-caret-landing probe (`[CARET:click@]`) [CP61 @L1274] → removed at CP65 [CP65 @L1307]
- All probes stripped at CP65: "let me rip out all the debug probes I added (the editor code is fine)" [CP65 @L1307]

Fixes applied (in order):
1. **Dark-caret CSS fix (CP51, retained):** `Edit: OfficeDocumentPage.css` — force a dark caret on the light paper. [CP51 @L1079]
2. **Specificity-corrected caret fix (CP53, retained):** `Edit: OfficeDocumentPage.css` — move the override onto the `.ProseMirror` element itself at higher specificity so it actually wins against `.ProseMirror-focused { --prosemirror-virtual-cursor-color: var(--crepe-color-outline); }`. [CP53 @L1116]
3. **Idempotent `applyColors` (CP55, retained as correct-even-though-not-the-root-cause):** `Edit: officeTableColors.ts` — only touch a cell when its color actually needs to change. [CP55 @L1171]
4. **THE ROOT-CAUSE FIX (CP67):** `Edit: officeTableColors.ts` (twice — main logic + teardown cleanup) — stop writing `background-color` into `<td>` cells; instead tag the table (outside editable content, like resize) and paint colors through an injected stylesheet. "The editable DOM is never modified." [CP67 @L1338]
- `Bash: npm run build` + `bash scripts/restart.sh` after the fix [CP67 @L1338]
- `Bash` clean-build verification at CP65 after probe removal [CP65 @L1307]

**What made CP68's "it works and it's gorgeous":** the CP67 stylesheet-injection fix to `officeTableColors.ts` — painting colors via an injected stylesheet tagged only on the table chrome, never writing into the editable `<td>` cells. [CP67 @L1338] [CP68 @L1374]

Final state at CP68: "✅ Cell / row / column background with the cascade (cell → newest-rank row/column), applied via stylesheet. ✅ Three-tier picker… ✅ Colors persist to `metadata.tableColors`; caret and editing untouched. ✅ All debug probes stripped out; the dark-caret fix and idempotent apply stayed." [CP68 @L1374]

Two loose ends flagged (not actioned): `assets/README.md` still has degraded body (`<br />` soup); office component CSS still in `OfficeDocumentPage.css` with a couple hardcoded z-indexes. [CP68 @L1374]

### 3.3 Wiki work — Office Viewer sub-articles (CP69–CP71) [DONE]

- `Bash` finds: Office Viewer at `001-Workspaces_And_Views/014-Office_Viewer`; chat lessons paradigm at `007-Chat_System/000-Overview_and_References/003-Lessons`. [CP69 @L1382]
- `Read: 014-Office_Viewer/PAGE.md` [CP69 @L1382]
- `Read: 007-Chat_System/000-Overview_and_References/003-Lessons/PAGE.md` (to copy the paradigm) [CP69 @L1382]
- `Bash` read of Voice_Input Architecture PAGE head (linking/TOC conventions) [CP69 @L1382]
- **`Write: 014-Office_Viewer/001-Document_Editor/PAGE.md`** — deep-dive: Core Rule (never write into ProseMirror's editable content DOM), editor composition, custom table node view (baked-in colgroup, `ignoreMutation` on attributes), column resize (columns-only, overlay drag, commit-on-release), table background colors (cascade, stylesheet application, four-tier picker), sibling `metadata.tables`/`metadata.tableColors` shapes. [CP71 @L1413]
- **`Write: 014-Office_Viewer/003-Lessons/PAGE.md`** — 10 imperative "things not to relearn" styled exactly like the Chat Lessons page: never write into editable cells, write only to table chrome, colors via stylesheet, no row resizing, ignore attribute mutations, bake the colgroup, drag-then-commit, the virtual-caret color fix, sibling frontmatter, the renderer-log debugging trick. [CP71 @L1413]
- `Edit: 014-Office_Viewer/PAGE.md` (×4) — corrected the outdated "Table Geometry" section (was claiming row resizing + `rows: [...]` frontmatter) to columns-only + colors with sibling frontmatter; linked both sub-articles from Related Pages and frontmatter edges. [CP71 @L1413]
- `Bash` verify of final tree. [CP71 @L1413]
- **Note:** TOC-sync markers NOT touched (section uses manual "Related Pages" links, not a marker block). [CP71 @L1413]
- **Known defect (confessed at CP77):** sub-articles were placed in `## Related Pages` but per the wiki guide belong in `## Children` — not yet corrected. [CP77 @L1520]

### 3.4 Memories inquiry (CP72–CP76) — files inspected, no changes made

- `Read: /Users/rccurtrightjr./.claude/projects/-Users-rccurtrightjr-/memory/MEMORY.md` [CP72 @L1459]
- `Bash` listing of the memory directory (name, size, modified) [CP74 @L1483]
- `Bash` grep showing "Robin" appears in ~20 memory files including `MEMORY.md` itself [CP74 @L1483]
- **No memory files were created, edited, or deleted.** The assistant offered both a "fast nuke" and a "careful audit" path [CP73 @L1475] [CP74 @L1483]; the user did not authorize either and pivoted to wiki work.

### 3.5 Wiki restructure (CP77–CP81) — PROPOSED/STARTED, NOT COMPLETED

**What was DONE in this sub-phase:**
- `Bash` find of `000-Wiki_Guidance/` tree [CP77 @L1520]
- `Read: 000-Wiki_Guidance/PAGE.md` (the guide) [CP77 @L1520]
- `Read: 000-Wiki_Guidance/002-Creating_Wikis/PAGE.md` [CP77 @L1520]
- `Read: /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/Captures/001-Captures/wiki-audit-decisions.md` [CP79 @L1546]
- `Bash` find of `006-System_Manager` tree (maxdepth 2) — **the last action before the session limit hit** [CP81 @L1568]

**What was PROPOSED but NOT executed:**
- The `009-Office_Suite/` tree (CP79) — superseded by the Fusion_Home rename at CP81 before any folders were created. [CP79 @L1546]
- The `Fusion_Home` domain with per-view top-level pages (Office_Viewer, Calendar_Viewer, Sheets, Pdf→Html, Email, ToDo, Utilities), LESSONS up top under the header, Decisions/Vision/Changes bite-size structure, sub-folders for Email/Calendar/ToDo/Office Home/Documents/Sheets/Pdf-2-Html/Utilities. [CP81 @L1568]
- Reframing `Workspaces_and_Views` heading to list defaults (Capture, File Explorer, Wiki, Issues, Agents). [CP81 @L1568]
- Stubbing the System Manager header and pulling in obviously-matching articles. [CP81 @L1568]
- Moving the hard-won Office editor knowledge into Fusion_Home so it survives. [CP81 @L1568]
- Correcting the Office sub-articles' `## Related Pages` → `## Children` placement (confessed at CP77, never actioned). [CP77 @L1520]

**The conversation ENDS at CP81** with the assistant's `Bash` find of `006-System_Manager` followed immediately by: "You've hit your session limit · resets 10:20pm (America/Los_Angeles)." [CP81 @L1568] No Fusion_Home folders, no System Manager stub, no Workspaces_and_Views reframe, and no `## Children` correction were created. The only wiki artifacts actually written in this chunk remain the two Office Viewer sub-articles and the main-page edit from CP71.

---

## End of chunk 3
