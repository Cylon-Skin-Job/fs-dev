# Schema Derivation

Use this reference to decide how a working-memory folder should grow without turning domain examples into a fixed template library.

## Start From Semantic Needs

Ask:

1. What outcome or artifact is being produced?
2. What evidence, inputs, or existing work support it?
3. Which claims require distinct authority?
4. Which stages need durable state or cross-chat handoffs?
5. What must be reviewed, verified, or accepted?
6. What should remain reusable after the current project ends?

Map answers to existing documents before inventing new ones.

## Preserve the Kernel Roles

The common kernel separates:

- conversational synthesis and open loops (`conversational_memory`);
- owner purpose, outcomes, goals, constraints, and non-goals (`owner_intent`);
- explicit owner choices (`owner_decisions`);
- verified actionable problems (`verified_issues`); and
- candidate actions (`candidate_actions`).

The familiar filenames are `CAPTURE.md`, `INTENT.md`, `DECISIONS.md`, `ISSUES.md`, and `PROPOSALS.md`, but an existing folder may use other names. Route by the indexed `kind` and declared authority, not filename alone.

The [starter templates](../../../../template/AGENTS.md#use-the-starter-documents-to-guide-discussion) supply concrete section prompts and record fields for these roles. Adapt categories to the current work and retain source attribution. The issue role includes documented consequential ambiguity, missing intent and interpretation drift; it does not require pretending an unresolved product choice is a software defect.

## Earn an Extension

Add or split a document only when all of these are true:

1. Substantive content exists now.
2. No current document can hold it without blurring its role.
3. It has a distinct semantic purpose.
4. It has a distinct authority boundary.
5. It has a distinct update lifecycle, readership, or handoff use.
6. Its relationship to other documents can be stated concisely.

If only the subject differs, prefer a new `##` category or record field. If authority or lifecycle differs, prefer a separate document.

## Choose a Stable Kind

Use a concise snake-case role that remains meaningful if the human filename changes. Common roles include:

- `evidence_corpus`
- `prior_work_map`
- `source_comparison`
- `claim_map`
- `deliverable_structure`
- `working_draft`
- `production_map`
- `change_surface`
- `interface_contracts`
- `data_schema`
- `work_queue`
- `test_strategy`
- `risk_register`

Invent a new kind when none fits. Define it in the folder-local `AGENTS.md` and `index.json`; do not expand the global vocabulary merely for one folder.

## Compose Genre, Domain, and Procedure

Treat these as independent axes:

- Genre suggests deliverables and production stages.
- Domain supplies terminology, source standards, and risk controls.
- Procedure describes the present operation and can recur across genres.

A medical tutorial can combine research-writing and media-production examples with a high-stakes medical evidence overlay. A technical article can combine software and research-writing. Do not create a monolithic profile for every combination.

## Apply Assurance Proportionately

Increase structure when an error could materially harm people, money, rights, safety, or reputation. High-assurance work may earn source audits, claim-to-source mapping, explicit limitations, correction or retraction checks, and independent verification. Treat those as evidence controls, not as owner decisions.

## Complete a Schema Change

For every new or repurposed document:

1. State its authority boundary in a leading blockquote.
2. Use `##` headings for stable facets or categories and `###` for records.
3. Define `kind`, `authority`, `lifecycle`, `read_before`, sections, and any record schema in `index.json`.
4. Add its boundary and dependencies to local `AGENTS.md`.
5. Preserve source backlinks when moving content.
6. Validate the folder with the local Memory Maintenance index helper.
