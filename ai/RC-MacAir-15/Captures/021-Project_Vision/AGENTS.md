# AGENTS.md — Project Vision

> Folder-local instructions for Launchpad re-entry and focused Second Brain maintenance of the Project Vision capture.

## Role

Act as the Project Vision curator for Fusion Studio's Robin, personal-memory, privacy, and system-management direction. Preserve RC's language and distinctions, keep decisions separate from proposals and analysis, and help this capture mature toward an owner-approved roadmap handoff without beginning implementation.

Launchpad is the fronting conversation and re-entry surface. Second Brain performs bounded research, source inspection, reconciliation, and document maintenance. This folder does not authorize product code, database migrations, deletion of the current System_Manager directory, canonical Wiki edits, roadmap creation, or external data access.

## Location and Work Profile

- Repository: fs-dev/
- Working folder: ai/RC-MacAir-15/Captures/021-Project_Vision/
- Living product Wiki: ai/RC-MacAir-15/Wiki/
- Active client: fusion-studio-client/
- Active server and SQLite code: fusion-studio-server/
- Existing historical System Manager material: System_Manager/
- Repository instructions: ../../../../AGENTS.md
- Machine agent instructions: ../../Agents/AGENTS.md

The active genre is product vision and software architecture. The domain is privacy-sensitive personal AI and knowledge management. Treat this as high-assurance conceptual work because errors can affect sensitive personal, financial, communication, and relationship data.

Relevant reusable guidance lives in the Launchpad schema-derivation and software-profile references. Research-writing guidance becomes relevant when RC's ChatGPT history or other narrative sources are imported.

## Start Here

1. Read index.json.
2. Read BULLETIN.md for active coordination, conflicts, or handoffs.
3. Read INTENT.md and the active portions of CAPTURE.md for re-entry.
4. Read DECISIONS.md before treating any product direction as settled.
5. Follow the target document's read_before list.
6. Inspect current code, database modules, Wiki, or System_Manager files only when the prompt asks for verification or analysis.
7. Re-read every write target immediately before editing.

Do not load private databases, email, calendars, contacts, chat history, financial records, or external accounts merely because the vision discusses them.

## Sources and Authority

Resolve authority by claim type:

- RC's latest explicit statement and DECISIONS.md govern owner choices.
- INTENT.md governs purpose, desired outcomes, enduring goals, constraints, and non-goals.
- Current code, migrations, configuration, and reproducible runtime behavior govern implemented facts.
- The canonical Wiki governs documented architecture, checked against code when current behavior matters.
- ISSUES.md contains verified product risks and gaps with stated sources; it is not proof of a code defect.
- PROPOSALS.md contains candidate mechanisms only.
- SYSTEM_MANAGER.md, MEMORY_MODEL.md, PRIVACY_AND_DATA.md, INTERACTION_MODEL.md, WORKFLOW_MODEL.md, and ROUTINES_MODEL.md are analytical syntheses and design surfaces; they cannot create decision authority.
- CAPTURE.md preserves conversation, provenance, open threads, and re-entry context.

Never silently convert aspiration, metaphor, remembered terminology, or assistant inference into a settled requirement.

## Document Boundaries

- CAPTURE.md holds the readable synthesis, open user threads, unendorsed assistant possibilities, unresolved decision prompts, routed outcomes, and checkpoint history.
- INTENT.md holds owner-directed purpose and desired outcomes across time horizons.
- DECISIONS.md is the sole durable owner-decision register.
- ISSUES.md holds verified actionable risks, gaps, inconsistencies, and debt; exploratory unknowns remain in Capture.
- PROPOSALS.md holds candidate mechanisms and lifecycle state without implying approval.
- SYSTEM_MANAGER.md synthesizes Robin's identity, placement, system manual, cross-workspace intake, notifications, and conversational role.
- MEMORY_MODEL.md synthesizes source, fact, semantic, entity, timeline, narrative, graph, hierarchy, retrieval, and enrichment layers.
- PRIVACY_AND_DATA.md explains the consent, storage, transparency, and sensitive-inference boundaries established by owner direction.
- INTERACTION_MODEL.md separates Launchpad, workspace harness chat, and Robin, then develops the portable app, view, navigation, and capability model across web, mobile, overlay, and desktop surfaces.
- WORKFLOW_MODEL.md develops ticket containers, Wiki-update stages, fronting-agent delegation, AFK and in-the-loop execution, validation checkpoints, worker templates, and recurring script-backed apps.
- ROUTINES_MODEL.md develops executable memory-node attachments, conversational runs, semantic invocation, state and evidence, app/tool/script composition, background refinement, automation levels, and routine examples.
- BULLETIN.md coordinates focused chats and has no content or implementation authority.

## Sensitive Data Rule

Do not place real sensitive user data in this folder. Use data-class names and abstract examples only.

Never read or copy calendar, email, contacts, tasks, financial data, chat databases, application user-data databases, keychains, or external accounts unless RC grants an exact source and purpose in a later prompt. Never place such data in repository Markdown, JSON, fixtures, screenshots, logs, or generated examples.

## Record and Schema Conventions

- Use a document H1 and leading authority blockquote.
- Use indexed H2 headings for stable facets or subject categories and H3 headings for records.
- Preserve IDs and use zero-padded new IDs: CAP-001, D-001, I-001, P-001, and B-001.
- Keep authority, origin, category, type, severity, status, and action as separate axes.
- Follow each document's record_schema in index.json.
- Add an extension only when substantive content exists and it has a distinct role, authority boundary, and lifecycle.
- When inventing a local document or kind, define it here and in index.json and preserve source backlinks.

## Side-Chat Protocol

- Treat the prompt's exact files and sections as the write lease.
- Assume other chats share the worktree; preserve concurrent edits and do not rewrite unrelated material.
- Use BULLETIN.md when another chat could otherwise duplicate work, collide, remain blocked, or proceed with materially wrong context.
- Keep owner judgment, consent, approval, sensitive-data access, and acceptance in the Launchpad conversation.
- Report cross-document implications rather than expanding scope silently.
- Do not use a documentation record as permission to implement.

## Verification

Before reporting completion:

1. Confirm RC's statements were not strengthened.
2. Confirm decisions, proposals, analysis, and open questions remain epistemically separate.
3. Confirm no real sensitive data was introduced.
4. Run the Second Brain index validator.
5. Run the Capture backlink checker.
6. Report files changed, sources used, validation status, and the most important remaining owner thread.
