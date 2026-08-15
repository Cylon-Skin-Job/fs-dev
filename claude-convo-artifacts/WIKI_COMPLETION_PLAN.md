# Wiki Work — Completion Plan

> Derived from chat pairs CP69–CP81 of conversation `82cb9603-bc44-4f01-a56f-ee2c8bd781a6.jsonl`.
> Citations: `[CP# @L<jsonl-line>]`. Direct quotes in double quotes.
> **Scope guard:** this plan only describes how to finish the wiki work. It does not authorize editing anything outside this artifacts folder — that awaits the user's go-ahead.

---

## ⚡ EXECUTION STATUS — UPDATED (skeleton built)

The breadcrumb skeleton has been **executed** (user approved "Both" = apply doc fixes + build skeleton; "Top-level section"; "Move whole, Milkdown/Crepe as Document_Editor's children"; "hand-fix links + children, commit later"). **Nothing was committed.**

### DONE in this pass (final structure after the user's view-vs-editor correction)
The user corrected the model: **4 actual views** (Office, Calendar, ToDo, Email) + **editor surfaces split out of the Office view** (Documents, Sheets, Pdf_2_Html) each as its own top-level article. **`009-Fusion_Home/`** now contains:

- `000-Fusion_Home/PAGE.md` — heading: templated-workspace framing + a "Views vs. Editor Surfaces" model + hand-maintained children list grouped by Views / Editor surfaces.
- **Views:** `001-Office_Viewer/` (built out; view-level — grid, layout, search, starred/pinned, thumbnails, paper brightness) with stub sub-articles `001-Layout_And_Rendering/`, `002-Search/`, `003-Starred_And_Pinned/`; `002-Calendar_Viewer/`, `003-Email/`, `004-ToDo/` (stubs).
- **Editor surfaces (built within Office view):** `005-Documents/` (renamed from "Document Editor", moved to top-level peer of Office_Viewer; built out) with children `001-Milkdown/`, `002-Crepe/` (stubs) and `003-Lessons/` (moved from Office_Viewer, renamed "Office Lessons"→"Lessons"); `006-Sheets/`, `007-Pdf_2_Html/` (stubs, described as editor surfaces not views).
- **Removed:** the speculative `007-Utilities/` stub (not in the user's 4-view model).
- **Old `014-Office_Viewer/`** remains a redirect; its links now point to Office_Viewer + Documents (the Document_Editor sub-path it used to cite no longer exists).
- **Inbound links** in `002-View_Architecture` and `000-Workspaces_And_Views` already point to `009-Fusion_Home/001-Office_Viewer/`; the `## Children` defect is fixed (owned children in `## Children`, cross-links in `## Related Pages`); `000-Workspaces_And_Views` intro light-reframed ("Defaults vs. Templated Workspaces").
- **Verification:** 84 markdown links across 17 files all resolve; no stale `Document Editor` article references (one section *heading* "## Document Editor" remains in Office_Viewer as a concept label that links to Documents — intentional).

### Calls made without asking (user prefers direct chat over question prompts)
- View article names kept as `Office_Viewer` / `Calendar_Viewer` (`_Viewer` suffix preserves the CP80 disambiguation between *view* and *editor* article). Tell me to drop the suffix and I will.
- `Lessons` moved under `Documents` (it is editor-traps content → belongs with its subject).

### NOT done (deferred to the 2-day SPEC, or needs a decision)
- **System_Manager header** — left untouched. It already has a sparse `PAGE.md` (description "Table of contents for System Manager"); per "don't go digging in," only a peer cross-link from Fusion_Home was added. A real "templated workspace" framing pass is SPEC work.
- **Run the TOC sync script** — intentionally NOT run (it regenerates `<!-- section-toc -->` blocks across the *whole* wiki, and the whole `Wiki/` folder is currently git-untracked → unrecoverable if it mis-fires). Fusion_Home uses a hand-maintained children list instead (matching the Workspaces_And_Views precedent). The script can be run later, after committing, to add Fusion_Home to the top-level Wiki Guidance TOC.
- **Legacy folder TOC** `001-Workspaces_And_Views/PAGE.md:25` still links to the old `014-Office_Viewer` path — it's script-generated (description starts with "Table of contents for"), so left alone; the redirect keeps it resolving.
- **Commit** — deferred per user ("We will commit later"). The Office bug-fix + color work is ALSO still uncommitted (D4).
- **Open structural question still on the table:** whether `Document_Editor` should eventually be split into separate Milkdown/Crepe deep-dives (today they are stubs *under* Document_Editor, per the user's "Crepe and Milkdown should be its children"). The user's 2-day SPEC will populate them.

---

## Executive summary — where things stand

Wiki work began at **CP69** ("Edit the Office Wiki…") and ended at **CP81** when the session hit its session limit mid-`find` on the System Manager tree. The arc splits cleanly:

1. **Office Viewer sub-articles (CP69–CP71): DONE** but with one confessed placement defect.
2. **Memories inquiry (CP72–CP76): DONE, no file changes** — findings only (the "Robin" ghost diagnosis).
3. **Wiki structure restructure (CP77–CP81): PROPOSED ONLY — nothing executed.** The scope was progressively narrowed across CP78 → CP79 → CP80 → CP81 and is now much smaller than it first appeared.

**Critical framing from the user (CP81):** "I am literally planning to run that SPEC in two days and go long and deep on building the wiki then. I just don't want your context and knowledge to disappear into the ether. This was a pain in the ass to get working. We need bread crumbs." `[CP81 @L1568]`

**So the bar for today is breadcrumbs, not a finished wiki.** The user's larger goal (CP79): "I need any code editor to be able to find context, not just CC. So I have to put your memories into external files." `[CP79 @L1546]`

---

## A. Already DONE during the session

| # | Item | Location | Citation |
|---|------|----------|----------|
| A1 | Office Viewer wiki tree examined; chat-system Lessons paradigm studied as the template | `Wiki/007-Chat_System/000-Overview_and_References/003-Lessons/PAGE.md` | `[CP69 @L1382]` |
| A2 | **Document Editor sub-article created** (deep-dive: Core Rule = never write into ProseMirror contentDOM; editor composition; table node view; column-only resize overlay + commit-on-release; bg colors via stylesheet; the 3-tier picker; sibling `metadata.tables` / `metadata.tableColors`) | `014-Office_Viewer/001-Document_Editor/PAGE.md` | `[CP71 @L1413]` |
| A3 | **Office Lessons sub-article created** (10 imperative "don't relearn this" lessons, styled like the Chat Lessons page) | `014-Office_Viewer/003-Lessons/PAGE.md` | `[CP71 @L1413]` |
| A4 | Main Office Viewer PAGE.md **corrected** — old "Table Geometry" section wrongly claimed row resizing + showed `rows: [...]` frontmatter; rewritten to columns-only + colors with sibling frontmatter; sub-articles linked | `014-Office_Viewer/PAGE.md` | `[CP71 @L1413]` |
| A5 | Memories inspected; diagnosed the "Robin" ghost (~45 memory files; "Robin" appears in ~20 of them, including `MEMORY.md`; memories are *pushed* every session, skills are *pulled*) | `~/.claude/projects/-Users-rccurtrightjr-/memory/` | `[CP72–CP76 @L1459–L1508]` |
| A6 | Wiki Guidance + Creating Wikis pages consumed; the operative model distilled | `000-Wiki_Guidance/PAGE.md`, `000-Wiki_Guidance/002-Creating_Wikis/PAGE.md` | `[CP77 @L1520]` |

---

## B. Confessed defect to fix FIRST (small, surgical)

At **CP77** the assistant confessed it placed the two new sub-articles in the wrong list: "I dropped Document Editor + Office Lessons into the existing **`## Related Pages`** section, but per the guide those are *owned children* and belong in a **`## Children`** list — Related Pages is for cross-links to other sections." `[CP77 @L1520]`

> ⚠️ Note: this fix may be mooted by the restructure in section C (the sub-articles are likely moving/re-dissolving). Decide C before spending effort here. If C is deferred, fix this first.

---

## C. The pending restructure — NARROWED scope (the real deliverable)

The scope was refined across four turns. The LATEST, authoritative spec is from **CP81**, which supersedes the broader CP78/CP79 drafts:

- **Rename:** the new domain is **`Fusion_Home`**, NOT "Office Suite." `[CP81 @L1568]` — *"OH! Call it Fusion_Home instead of Office Suite! Explain that it is a templated 'Workspace' that ships with the app, and contains these other views that do not automatically drop into new repos and workspaces (but can be added by user interaction)."*
- **Per-view top-level articles,** not sub-folders: `Office_Viewer`, `Calendar_Viewer`, etc. *"I do believe that each doc type probably needs it's own top level page… We can link them in Office_Viewer."* `[CP80 @L1566]` Each shown as "Name(link) and Description of each." `[CP80 @L1566]` / `[CP81 @L1568]`
- **Only THREE things to catalogue today** `[CP81 @L1568]` — *"We only need to catalogue: Workspace and Views, Fusion Home, System Manager."*

  1. **Fusion_Home** — new domain; **move the hard-won Office editor knowledge here** so it survives (`Document_Editor` + `Lessons` content from A2/A3).
  2. **Workspaces And Views** — reframe its heading as the **defaults** a user actually needs: Capture, File Explorer, Wiki, Issues, Agents. `[CP81 @L1568]`
  3. **System Manager** — **stub the header only** + pull in obviously-matching articles. **Explicit constraint:** "Don't go digging into System Manager either. But do stub the header." `[CP81 @L1568]`

- **Out of scope:** Web Design Studio ("doesn't affect fs-dev code base and therefore isn't in this domain" `[CP81 @L1568]`). The full per-app deep-dives (Sheets, Pdf→Html, Email, Calendar, ToDo internals) are deferred to the 2-day SPEC.

### How to complete C (recommended sequence)

1. **Lock the tree shape** with the user first — see open questions in section E. Do NOT create folders until §E is answered; the assistant explicitly gated on this: "Three calls I need from you before I create folders." `[CP79 @L1546]` (those calls were partially answered by CP80/81 — confirm the residue).
2. **Create the `Fusion_Home` heading + section front page** (`000-Fusion_Home/PAGE.md`) with the "templated workspace that ships with the app" framing `[CP81 @L1568]` and a `<!-- section-toc -->` marker block `[CP77 @L1520]`.
3. **Move content** from `014-Office_Viewer/001-Document_Editor/` and `003-Lessons/` into the new structure. Proposed homes (confirm): `Fusion_Home/Office_Viewer/` with `001-Document_Editor` + `003-Lessons` as children; OR dissolve Document_Editor into a Milkdown/Crepe breakdown per the assistant's CP79 sketch `[CP79 @L1546]`.
4. **Stub the sibling views** as top-level articles under `Fusion_Home`: `Calendar_Viewer`, `Sheets`, `Pdf_2_Html`, `Email`, `ToDo`, `Utilities` — each Name + Description only. Leave a breadcrumb that deep content comes in the 2-day SPEC.
5. **Retire/redirect `014-Office_Viewer`** so the old path doesn't dangle.
6. **Reframe `Workspaces_And_Views` heading** to the defaults list (Capture, File Explorer, Wiki, Issues, Agents).
7. **Stub `System_Manager` heading** + pull in only obviously-matching existing articles; do not audit deeply.
8. **Hand-maintain `## Children` lists** for any new owned sub-articles — the sync script does NOT manage these `[CP77 @L1520]`.
9. **Run the TOC sync script manually** to seed the `<!-- section-toc -->` blocks: `node fusion-studio-server/scripts/sync-wiki-tocs.js <workspace>` `[CP77 @L1520]`.

### Format constraint (important)
The assistant flagged at **CP79** that `Captures/001-Captures/wiki-audit-decisions.md` is mostly **"agreed, not yet implemented"** — the `type` field, computed edges, `<!-- children:start/end -->` markers, and audit script **do not exist yet**. Today's live tooling only maintains `<!-- section-toc -->` blocks with hand-maintained `## Children`. `[CP79 @L1546]` **Build in the current live format**, not the aspirational one, unless the user says to pioneer it.

---

## D. Pre-existing loose ends carried into the wiki task (from CP68)

These predate the wiki pivot but are part of "leaving breadcrumbs" and were left open:

| # | Item | Status | Citation |
|---|------|--------|----------|
| D1 | `assets/README.md` still has the degraded body (`<br />` soup / fused text) — won't self-heal | Open | `[CP68 @L1374]` |
| D2 | Office component CSS still lives in `OfficeDocumentPage.css` with a couple hardcoded z-indexes (Code Standards nod) | Open, not urgent | `[CP68 @L1374]` |
| D3 | Offered to save a memory of the root-cause pattern (editable-DOM writes vs. table chrome) | Not saved (though `office-table-resize-design` + `electron-renderer-log-path` WERE saved this session) | `[CP68 @L1374]`, `[CP72 @L1459]` |
| D4 | The whole bug-fix + color work is **uncommitted**; assistant asked "should I commit this work — it's a real, self-contained win sitting uncommitted" | Unanswered in-convo | `[CP68 @L1374]` |

---

## E. Open questions that need the user before building (the assistant's gates)

From `[CP79 @L1546]`, partially resolved by CP80/CP81 — residue to confirm:

1. **Placement of `Fusion_Home`** — new top-level section (e.g. `009-Fusion_Home`), or nested under Workspaces And Views? (CP81's "three things to catalogue" list treats Fusion Home as a peer of Workspaces And Views and System Manager, suggesting **top-level** — confirm.)
2. **`Office_Viewer` internals** — does `Office_Viewer` itself host the Milkdown/Crepe deep-dive (as CP79 proposed for "Office Home"), or does Milkdown/Crepe stay as the `Document_Editor` article moved intact? I.e., **dissolve the existing Document_Editor article, or move it whole?**
3. **The `## Children` vs `## Related Pages` defect (B)** — fix-in-place now, or let it be absorbed by the move in C?
4. **Should the Office/bug-fix work be committed (D4) before or after the wiki move?** The wiki move is content-only (PAGE.md files) and is itself worth a separate commit.

---

## F. Recommended order of operations (when the user says go)

1. Resolve §E questions (quick chat — no code).
2. (Optional, only if C is deferred) Fix the `## Children` defect from §B in `014-Office_Viewer/PAGE.md`.
3. Commit the existing Office bug-fix + color work (D4) as its own self-contained commit so it isn't entangled with wiki moves.
4. Execute C steps 2–9 (the breadcrumb skeleton).
5. Decide on D1 (assets/README cleanup) and D3 (root-cause memory) — both small, both can wait for the 2-day SPEC.

> **Awaiting user instructions.** Nothing outside this artifacts folder has been or will be edited until directed.
