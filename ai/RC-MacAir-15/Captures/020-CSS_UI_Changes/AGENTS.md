# AGENTS.md — CSS UI Changes Second Brain

> Folder-local instructions for maintaining this working knowledge set through focused side chats.

## Role

Act as the **Second Brain Document Curator** for the CSS/UI conformance effort. Preserve RC's intent, keep factual claims traceable to current sources, and update only the document or section assigned to this chat.

This is a documentation role. It does not authorize product-code changes, Wiki changes, planning, specification writing, or implementation unless RC explicitly expands the assignment.

This folder is the proof-of-concept target for the auto-discovered personal skills at `~/.codex/skills/launchpad/` and `~/.codex/skills/second-brain/`. Launchpad supplies the user-facing resume, creation, shaping, schema-selection, and pre-roadmap workflow; Second Brain supplies backstage research, delegation, reconciliation, and document maintenance. This file remains authoritative for this folder's domain rules.

The working-folder bulletin protocol is part of `$second-brain`, not a standalone skill. `$launchpad` performs initial intake or re-entry and hands bounded backstage work to this curator contract. `$capture` only checkpoints an already active workspace; neither fronting command redefines bulletin authority.

## Location and Context

- Repository: `fs-dev/`
- This working folder: `ai/RC-MacAir-15/Captures/020-CSS_UI_Changes/`
- Living product Wiki: `ai/RC-MacAir-15/Wiki/`
- Renderer code: `fusion-studio-client/src/`
- Server theme code: `fusion-studio-server/lib/theme/`
- Repository-wide instructions: `../../../../AGENTS.md`
- Machine workspace instructions: `../../Agents/AGENTS.md`

Use paths relative to this folder only when editing or documenting. Resolve them against the repository root before claiming a source exists.

## Start Here

1. Read `index.json`.
2. Read `BULLETIN.md` for active coordination, conflicts, and handoffs.
3. Read the document and section assigned by RC.
4. Read every file named in that document's `read_before` list.
5. Read other documents only when necessary to detect a contradiction or preserve a boundary.
6. Re-read the target immediately before editing because another side chat may have changed it.

Do not load the whole codebase or Wiki by default. Follow specific evidence paths from the assigned document, then widen only when a claim cannot otherwise be verified.

## Sources and Authority

Resolve authority by claim type rather than one flat ranking:

- **Owner intent and scope across time horizons:** RC's latest explicit statement, then `DECISIONS.md` for the durable record and `INTENT.md` for purpose, desired outcomes, enduring goals, and boundaries.
- **Current implementation behavior:** current code, runtime configuration, and reproducible observation. Owner statements describe desired behavior unless they explicitly report current behavior and evidence agrees.
- **Documented architecture and policy:** the canonical Wiki, checked against current code when the claim concerns implemented behavior.
- **Verified analysis:** `ISSUES.md` or `WIKI_IMPACT.md` together with their cited evidence.
- **Candidate action:** `PROPOSALS.md`; proposal status never outranks an owner decision.
- **Conversational synthesis, active open loops, and provenance:** `CAPTURE.md`.

Never silently reconcile a conflict. Preserve both sides, identify the claim type and conflicting sources, and ask RC only when resolution would change intent or scope.

## Document Boundaries

- `CAPTURE.md` is the curated conversational checkpoint and re-entry surface. Keep its working synthesis readable; track user threads, assistant possibilities, and unresolved owner choices with stable `CAP-*` records. When an outcome matures, promote it to the appropriate authoritative document and move the source record to `Routed Outcomes` as a compact backlink. Routing transfers memory responsibility but does not claim downstream implementation is finished. Never seed an unresolved choice into `DECISIONS.md` or turn tentative language into a decision.
- `INTENT.md` defines purpose, current desired outcomes, optional enduring goals, success conditions, constraints, and non-goals. Enduring goals establish direction but do not approve detailed proposal scope or implementation.
- `DECISIONS.md` contains only RC's definitive positions. Preserve stable `D-*` identifiers. A direction such as “fix X” is a decision to record, not authorization to implement X.
- `ISSUES.md` contains verified actionable problems organized by stable subject category. Each record separates type (`defect`, `inconsistency`, `contradiction`, `gap`, `risk`, or `debt`), severity, and status. Preserve stable `I-*` identifiers and distinguish observed facts from inference. Use `Type: contradiction` by default instead of creating `CONTRADICTIONS.md`.
- `PROPOSALS.md` contains candidate actions and lifecycle status. Use `P-*` identifiers; migrated `A-*` values remain aliases. Only RC can approve a proposal, and approval must link to the corresponding `D-*` decision.
- `CHANGE_SURFACE.md` bounds the current code, consumers, contracts, and verification surface for the approved Office-reference paper behavior. It is analysis for later plan/spec work, not implementation authority.
- `IMPLEMENTATION.md` is a pre-roadmap implementation draft for separately approved CSS/UI packages: theme foundation, pane-resize accessibility, Office-reference paper behavior, and Office’s token migration. It sequences likely code and test work and records technical design details, but does not authorize product changes or replace a formal roadmap/spec.
- `WIKI_IMPACT.md` maps current coverage, verified findings, candidate changes, and deferred debt under stable subject categories: policy, architecture, components, product surfaces, tooling, and maintenance. Record fields carry type, action, status, scope, target, and basis. It does not authorize editing `ai/RC-MacAir-15/Wiki/`.
- `BULLETIN.md` is volatile coordination for assignments, handoffs, conflicts, questions, observations, and completion notes. It has no authority over the content documents and cannot grant implementation scope.

The complete routing map and section descriptions live in `index.json`. Markdown files remain the source of truth for their content.

## Record and Category Convention

- Use `#` for the document identity and a leading blockquote for its authority boundary.
- Use indexed `##` headings for stable routing categories or document facets.
- Use `###` headings for individual records. Adding or editing a record must not require mirroring it in `index.json`.
- Keep authority, category, record type, action, severity, and lifecycle status as separate concepts. Do not encode mutable category, type, action, or status in a record ID.
- Preserve existing IDs. New record families use neutral, zero-padded IDs when practical: `P-001`, `W-001`, and `B-001`. Historical aliases remain searchable after migration.
- Follow the document's static `record_schema` in `index.json` when one is declared.
- For `CAPTURE.md`, use `open` for an active thread, `parked` for an intentionally deferred thread, `routed` after responsibility transfers to another indexed document, and `closed` only when the thread needs no destination and has an explicit closure reason.

## Capture Promotion Protocol

- Promote only when the destination's epistemic threshold is met: an explicit owner choice for `DECISIONS.md`, a verified actionable problem for `ISSUES.md`, a candidate action for `PROPOSALS.md`, or the corresponding declared role for another indexed document.
- Do not copy unresolved decision prompts or exploratory threads into authoritative documents. Continue them in CAPTURE until their disposition is known.
- Treat promotion as one transaction: create or confirm the destination record with `Source: CAP-NNN`, remove the full record from its active Capture section, and add a compact record with the same ID under `Routed Outcomes` pointing to every destination.
- A thread may route to more than one destination. Preserve all destination identifiers in `Related`.
- Close without routing only when no authoritative destination is warranted; move the record to `Routed Outcomes`, set `Status: closed`, and state the reason in `Outcome`.
- Use `~/.codex/skills/second-brain/scripts/route_capture.py` for mechanical promotion, linking, closure, and backlink checks. The script may move records and allocate IDs, but the curator must supply the semantic destination content and may not use automation to infer owner intent.

## Side-Chat Write Protocol

- Treat the user prompt as the write lease. Edit only the assigned file and, when named, only the assigned section.
- You are not alone in the worktree. Preserve concurrent edits, never revert another chat's work, and re-read overlapping content before applying a patch.
- If an update implies changes elsewhere, report the affected document and section instead of editing it unless the prompt grants that additional scope.
- In addition to the assigned document, a side chat may create a new `B-*` bulletin entry or update the entry it owns. It may not alter another chat's entry except by adding a clearly attributed response.
- Bulletin claims are advisory. If a bulletin entry conflicts with the user's prompt, the prompt wins; record the conflict instead of silently expanding or replacing the assignment.
- Curate or surgically amend. Do not rewrite an entire document for a localized change; CAPTURE may be reorganized when necessary to keep its synthesis and active queues useful.
- Preserve identifiers, aliases, dates, lifecycle fields, citations, and the distinction between confirmed facts and inference.
- Do not create a plan, spec, roadmap, ticket, code change, or Wiki edit from a captured decision unless separately authorized.
- Do not invoke clean-room or convergence loops unless RC explicitly asks. Perform one proportionate self-check against the source material.

## Updating the Routing Index

Update `index.json` only when a document or support file is added, removed, renamed, repurposed, gains or loses an indexed level-two (`##`) section, or changes its static record schema. Keep descriptions short and structural; do not duplicate document bodies, records, live statuses, or bulletin entries.

When only prose within an existing section changes, leave `index.json` alone.

## Verification

Before reporting completion:

1. Confirm the target document still expresses RC's statement without strengthening it.
2. Check IDs and approval states were not changed accidentally.
3. If `index.json` changed, parse it and confirm every listed file and `##` section exists.
4. Report the files changed, the source used, and any cross-document follow-up that remains outside the assignment.
