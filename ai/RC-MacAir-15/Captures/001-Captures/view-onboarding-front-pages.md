# View Onboarding Front Pages — Office_Viewer as First Instance

**Date:** 2026-07-04
**Status:** Capture from design riff. The office suite's agent-orientation page, and the general pattern it instantiates.

## The Idea

Every view domain gets a heading `PAGE.md` that is **agent onboarding**: the mental model in a few lines, a spatial map of the view, pointers to deep knowledge, and the tool surface available in that context. It's Decision 14's guidance layer (pre-flight injection — this is what rides the wire when the agent lands in the view, per the Robin shared-context design), built entirely from the existing article anatomy.

## Office_Viewer PAGE.md — the sketch

**Lead (the mental model, ~4 lines):**
- Docs = Markdown.
- Sheets = JSON — readable as such.
- Editing = Milkdown + a system of tags inserted/removed via UI: a basic word processor deliberately stripped of the 80% of features most people never use.
- Heavy formatting is not the editor's job — that's what HTML artifact → PDF is for.

**Body:**
- Basic format syntax rules (the tag vocabulary, what the UI chrome maps to).
- ASCII art of the view layout. The agent can't see the screen; ASCII is the cheapest screenshot. The map names the regions; `get_user_view` reports what's in them right now.

**Generated tail:**
- The "check the following docs for in-depth domain knowledge and skills" list is a standard `<!-- children:start/end -->` marker (Decision 3) filled from child frontmatter — never hand-written:
  - User Tools
  - Syntax and Formatting
  - Export Documents
  - Import from DOCX
  - Import from PDF

**Tool surface:** `get_user_view`, `get_user_activity`, `view_version`, etc. — see below.

## The New Slot: Documenting the Tool Surface

The four-zone anatomy has no zone for "tools available in this context." Two options:

1. **Authored, in the body** — simple, works today, rots when tools change.
2. **Generated marker block** (`<!-- tools:start/end -->`) — script-filled from wherever tool definitions live (capabilities layer), each entry carrying the tool-documentation convention (`name` / `description` / `when`). This is not a universal event/provenance block; any canonical event representation still requires the shared envelope and a registered domain extension. Clarification follows the [2026-07-15 provenance findings](../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat. Drift-proof exactly like children markers.

**Lean: authored first, marker when drift bites** — per the anti-overthink clause (Decision 18) and demand-driven growth rule. But design tool definitions with name/description/when from day one so the marker upgrade is a script change, not a data migration.

## Why This Pattern Earns Its Keep

- **Progressive disclosure:** the front page is cheap context (mental model + map + pointers); depth lives in children, fetched on demand. Injection stays affordable.
- **80/20 product doctrine on record:** the office suite simulates a word processor minus the crap; the artifact→PDF pipeline absorbs the exceptional cases. Sheets stay JSON because agents read JSON natively — the format IS the API.
- **`view_version` closes a loop:** it reads the snapshot/versioning tables from the full-permissions safety architecture — the office suite's undo/history and the AI's forensics are the same substrate.
- **Generalizes immediately:** capture-viewer, wiki-viewer, agents-viewer, calendar — every view wants the same four things: mental model, layout map, children, tools. This page shape is the template.

## Open Threads

>> Tool definitions' home: where do get_user_view / get_user_activity / view_version get defined with name/description/when — capabilities layer? One registry per view or one global with view scoping?
>> get_user_activity semantics: how far back, what granularity, and does it read the ledger or its own trail?
>> Does the onboarding page get injected whole, or lead-only with the body available on request? (Injection budget question.)
>> Is the ASCII layout map authored or generated from the view's layout definition? (Authored first; same demand-driven rule.)
>> Template: should view scaffolding (folder-creation trigger) stamp a skeleton onboarding PAGE.md for every new view?
