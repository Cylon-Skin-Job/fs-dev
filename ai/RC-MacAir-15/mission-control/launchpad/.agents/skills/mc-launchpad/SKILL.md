---
name: mc-launchpad
description: Resume or create a durable pre-roadmap working-memory project and act as its user-facing conversational controller. Use when the user explicitly invokes /mc-launchpad or $mc-launchpad to start or resume this workflow, and on follow-up turns in a conversation already established as a Launchpad session, to survey an existing capture folder, restore current state and open threads, continue shaping intent and decisions, initialize an owner-selected domain folder under mission-control/launchpad when none exists, evolve the local schema from earned needs and relevant work-profile examples, frame bounded research or documentation assignments for side chats, or assess readiness for Roadmap Creator. Never start a new Launchpad workspace from unrelated ordinary conversation without explicit invocation.
---

# Launchpad

Act as the fronting agent for an evolving body of work. Stay in conversation with the user, restore continuity across sessions, maintain a light conversational checkpoint, and help the folder mature toward a useful artifact or a Roadmap Creator handoff.

Start a new working-memory project only after explicit invocation or the owner’s explicit assignment of a prepared domain folder to its main session. The folder’s main session already carries the fronting role through AGENTS.md. Side chats follow only their bounded assignment. Continue related main-session work until the user changes mode or hands it off.

## Preserve the Layer Boundary

- Let Launchpad own re-entry, conversation, phase recognition, owner questions, lightweight capture, schema intent, and handoff readiness.
- Use [Memory Maintenance](../../../../.agents/skills/mc-memory-maintenance/SKILL.md) for authorized folder/schema operations. Frame research as bounded support assignments; do not invoke the v1 umbrella or assume side-chat delegation is permitted.
- Use `$mc-capture` only as an explicit checkpoint inside an already active Launchpad folder.
- Do not implement product work, edit a canonical Wiki, create a roadmap, or treat a proposal as approved without separate authorization.

## Resolve or Create the Working Folder

1. Use the exact folder named by the owner or current assignment. Otherwise use the established domain CWD and its local contract.
2. Read applicable repository and folder instructions, then its index. If the selected domain is incomplete, repair that contract within scope; do not climb to MC’s own index or pick a sibling by recency.
3. New domain folders belong under the selected MC home’s `launchpad/`, with an owner-selected or clearly derived descriptive name. Never overwrite a folder or treat `template/` as live. Do not use legacy numbered-Capture allocation.
4. Use [Memory Maintenance](../../../../.agents/skills/mc-memory-maintenance/SKILL.md) to adapt the template and initialize or migrate the substantive local records with provenance and validation.
5. When multiple targets remain genuinely plausible, resolve that ambiguity before writes. Do not relocate an existing Capture merely because the new root exists.

## Survey an Existing Folder

Read in this order:

1. `index.json` for routing and dependencies.
2. `BULLETIN.md` for unresolved coordination, blockers, and handoffs.
3. `INTENT.md` or the indexed owner-intent equivalent.
4. The working synthesis and active records in `CAPTURE.md` or the indexed re-entry equivalent.
5. Active owner decisions, verified issues, proposals, and domain documents needed to understand the current branch of work.
6. Named current sources only when necessary to verify whether the folder has drifted.

Do not indiscriminately load an entire repository, Wiki, corpus, or capture history. Follow the index and widen the survey only when the current state cannot otherwise be understood.

## Restore Orientation

Infer the current working phase from the folder rather than requiring a rigid status field. Useful phase labels include `exploring`, `framing`, `investigating`, `resolving`, `shaping`, and `handoff-ready`; projects may move backward, branch, or occupy more than one phase.

At re-entry, briefly tell the user:

- what the work is trying to accomplish;
- what has been explicitly settled;
- which questions, threads, or contradictions remain open;
- what backstage work is pending or recently completed;
- the inferred current phase; and
- the most useful next conversational thread.

Store evolving phase context in the readable working synthesis when useful. Do not put live phase or completion state in `index.json`.

## Continue the Conversation

- Riff, explain, compare, and ask owner questions at the user's pace.
- Notice user-originated threads displaced by later riffs and preserve them for re-entry.
- Keep assistant-originated possibilities visibly unendorsed until the user adopts or routes them.
- Record explicit owner choices in the decision authority; do not strengthen tentative language.
- Keep exploratory unknowns in Capture until they meet another document's threshold.
- Refresh the working synthesis at meaningful checkpoints rather than logging every exchange.
- Prefer one focused next question or branch over presenting a ceremony of workflow choices.

Use the section prompts in the [starter documents](../../../template/AGENTS.md#use-the-starter-documents-to-guide-discussion) as attention cues, not a questionnaire. At meaningful transitions, check for displaced user threads, missing intent, conflicts with prior decisions, and assistant interpretation drift. Keep casual exploration in Capture; record consequential ambiguity in Issues with sources, affected scope and the exact question. Clear owner revisions supersede the relevant earlier decision without redundant confirmation; unclear revisions stay visibly unresolved.

Apply the shared [record rules](../../../../.agents/skills/mc-memory-maintenance/references/records.md) whenever a Capture thread becomes an owner decision, verified issue, proposal, or another authoritative outcome.

## Select Work Profiles and Procedures

Classify the work along independent axes rather than forcing it into one exclusive category:

- **Genre:** the artifact being produced, such as a code change, report, article, tutorial, presentation, decision memo, or creative work.
- **Domain:** the body of knowledge and evidence rules, such as software, medicine, law, finance, history, or education.
- **Procedure:** the current operation, such as source discovery, comparison, claim mapping, requirements analysis, outlining, drafting, storyboarding, or verification.

Read [schema-derivation.md](references/schema-derivation.md) whenever deciding whether to add, split, merge, or invent a document convention.

Load only the relevant worked examples:

- For code, architecture, interfaces, migrations, or implementation planning, read [software.md](references/software.md).
- For evidence collection, reports, academic work, cited articles, or literature comparison, read [research-writing.md](references/research-writing.md).
- For tutorials, video, audio, demonstrations, scripts, storyboards, or production planning, read [media-production.md](references/media-production.md).
- For selecting a backstage operation or another installed skill, read [operating-procedures.md](references/operating-procedures.md).

Combine profiles when the work crosses boundaries. Treat examples as precedent, not as a closed list of allowed documents or kinds.

## Evolve the Local Schema

Create a new document only when substantive material exists and it has a role, authority boundary, and update lifecycle that no existing document can carry cleanly. Give the document a descriptive human filename and a stable machine-readable `kind`; invent a local convention when the examples do not fit.

Whenever the schema changes:

1. Define the document's purpose, authority, categories, lifecycle, and dependencies.
2. Update the folder-local `AGENTS.md` boundaries.
3. Register the document and exact `##` sections in `index.json`.
4. Preserve provenance when moving material from another document.
5. Run `python3 <MC-home>/.agents/skills/mc-memory-maintenance/scripts/validate_index.py <working-folder>`.

Do not create empty files in anticipation of possible future work.

Use [conversation-evidence.md](../../../../conversation-evidence.md) before presenting an apparent missing decision. Check proposal/decision records and current contracts first; retrieve bounded conversation context when it can resolve the question. A shared CWD narrows candidates but does not identify the main task. Preserve source locators, approval scope, later supersession and history gaps; targeted retrieval is not an automatic Checkpoint.

## Send Work Backstage

Use the shared [investigation contract](../../../../investigation-contract.md) when assessing investigation readiness, framing questions, assigning support or incorporating findings. The main Launchpad session owns that plan and synthesis; First Draft recommends questions. Before drafting, investigate only missing facts that prevent a useful skeleton. After drafting, select bounded questions tied to decisions; during revision, recheck only affected conclusions.

Choose relevant specialties or compose a one-off assignment using the contract's packet and report fields. Parallelize independent questions only when dispatch is authorized, with separate report ownership and explicit input baselines. Investigators inspect sources and return evidence/options; the shared draft remains with its assigned writer. Preserve contradictions and owner questions instead of treating research completion as planning readiness.

Under D-010, the owner-designated main Launchpad session should start and manage bounded investigators whenever their answers can materially inform the next project decision, without requesting approval for each assignment. Follow the contract’s dispatch rules: check existing work first, use an actually available suitable profile or a general agent with explicit specialty instructions, record returned identities and input revisions, track reports and issue bounded follow-ups as needed. Main domain sessions remain owner-managed. Current conversation/tool restrictions apply, and side chats gain no delegation authority. Incorporate supported findings into the domain records, record each report's disposition, and bring the owner only consequential unresolved choices. Report compact cross-domain coordination consequences to MC when applicable.

## Review documentation changes

Use [Document Sweep](../../../../.agents/skills/mc-document-sweep/SKILL.md) after a meaningful batch of recorded issues/decisions, a changed outcome or contract, a major draft revision, and before recommending Creator handoff. Coalesce related changes; do not run on every turn or on an arbitrary timer. Under D-010, the main session may assign an available investigator the exact sweep procedure and domain folder. Keep report writing separate from the shared draft.

The sweep compares saved document inputs, checks propagation and challenges source sufficiency beyond the supplied packet when justified. Read its carried findings, incorporate supported Issues/References/Change Surface updates, and record remaining owner or research questions. A completed sweep with gaps is not planning approval. The next sweep includes any resulting documentation edits. Do not invoke Checkpoint automatically or advance its cursor for this review.

## Recognize Handoff Readiness

Run [Planning Preflight](../../../../.agents/skills/mc-preflight/SKILL.md) inline before recommending or preparing an authorized First Draft or Roadmap Creation handoff. Use the intended destination's threshold: First Draft needs enough grounding for a useful skeleton with questions; Creator needs coherent scope and settled or validly deferred material choices. An existing draft is optional; conversation and source documents may be sufficient for a simple SPEC.

Reuse current Document Sweep findings and check affected source freshness. The existing sweep requirement before Creator handoff remains; preflight does not dispatch that reviewer or duplicate a current sweep. Return `READY`, `READY_WITH_EXPLICIT_GAPS` or `NEEDS_PREPARATION`, with exact source inputs, limitations, carried issue IDs, destination/release blockers and the minimum next action. Incorporate findings through existing domain records when authorized; no new ledger or automatic Checkpoint is required.

Preflight checks input readiness. Validation checks each process's output; independent Release Validation assesses the final candidate. Name the proposed receiving procedure and handoff documents. Use `mc-draft-supervisor` for a managed draft-only assignment and `mc-roadmap-creator` for executable planning; `mc-first-draft` remains the author inside the shared draft stage. A passing preflight does not invoke First Draft, Roadmap Creator or implementation automatically and does not grant owner approval.

## Report Durable Changes

When Launchpad writes files, report the working folder, documents changed or created, any schema convention invented, validation status, and the most important open thread. Keep the final response self-contained so another session can re-enter from the folder alone.

## Coordination boundary

Read the relevant parts of [session-contract.md](../../../../session-contract.md). Return compact findings, evidence and open decisions through the assigned channel. MC stays inactive until system construction is complete; local domain work does not waive that launch condition.
