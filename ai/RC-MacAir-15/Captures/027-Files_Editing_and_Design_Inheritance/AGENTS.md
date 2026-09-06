# AGENTS.md — Files, Editing, and Design Inheritance Capture

## Curator Role

Maintain this folder as pre-roadmap working memory for the Files, Code Editor,
shared editing infrastructure, conditional layout logic, and their integration
with Tabs, Chat, and Provenance.

## Locations

- Repository root: `../../../..`
- Current Wiki: `../../Wiki`
- Working folder: this directory
- Related coordination: `../002-SPECs/TABS-PROVENANCE-COORDINATION/`
- Related Chat roadmap: `../025-Chat_Composition_Roadmap/`
- Related tab placement package: `../026-Tab-Target-Placement/`
- Historical Office editor work: `../009-Office-Editor-Temp/`

## Authority and Document Boundaries

- `CAPTURE.md` is contextual working memory for synthesis, provenance, and open loops.
- `INTENT.md` records owner purpose, outcomes, constraints, and non-goals.
- `DECISIONS.md` records only explicit owner choices; do not infer decisions from
  tentative wording.
- `ISSUES.md` records only verified actionable problems or contradictions.
- `PROPOSALS.md` records candidate actions or designs and never grants approval.
- `LAYOUT_LOGIC.md` maintains the conditional presentation model, hierarchy
  semantics, and unresolved configuration branches. It is analysis and must cite
  `DECISIONS.md` rather than replacing decision authority.
- `EDITING_MODEL.md` maintains the pure-Markdown capability boundary, reusable
  editor core, host policies, block interaction, and Office-preservation boundary.
  It is analysis; `DECISIONS.md` remains authoritative and `ISSUES.md` owns
  verified implementation problems.
- `BULLETIN.md` records only coordination that must survive the current chat.
- `index.json` is static routing metadata and must not carry live project status.

Current code and tests govern implemented behavior. The current Wiki governs
documented architecture where code does not contradict it. Earlier captures are
prior-work sources, not automatic authority for this capture. Owner statements
govern desired behavior and explicit decisions at the authority level recorded
in the appropriate document.

## Editing and Concurrency

- Read `index.json`, then `BULLETIN.md`, then every file listed in the target's
  `read_before` field before editing a content document.
- Re-read a target immediately before editing and preserve concurrent changes.
- Use neutral stable record IDs and never renumber them.
- Preserve source backlinks when routing a Capture record.
- Do not edit product code, the canonical Wiki, roadmaps, SPECs, or external
  systems from this folder without separate owner authorization.
- A side chat's assignment defines its exact write lease. Record durable
  cross-document conflicts or handoffs in `BULLETIN.md`; do not log routine work.

## Index and Verification

Update `index.json` whenever a document or indexed `##` section is added, removed,
renamed, or repurposed. After every structural or content update, run the Second
Brain index validator. After routing capture records, also run the capture backlink
check.
