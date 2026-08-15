# PRIVACY AND DATA — Project Vision

> Analytical map of RC's owner-directed privacy and storage boundaries. DECISIONS.md is authoritative; this document explains implications and preserves unresolved safeguards.

## Trust Problem

The assistant's usefulness grows with access to calendars, email, contacts, communications, routines, friends, work, finances, research, and history. The same access creates a surveillance-shaped experience if collection, inference, retention, and use happen quietly.

The product must assume that users may distrust AI companies and may reasonably reject sensitive data sitting on a remote server. Trust must come from understandable boundaries, visible processing, source grounding, and meaningful control rather than reassurance alone.

## Consent Model

D-006 requires optional, opt-in memory and enrichment. A useful consent interaction should be:

- contextual: offered when a capability would materially help;
- specific: name the data, operation, scope, and expected benefit;
- comprehensible: explain in ordinary language rather than infrastructure terminology;
- bounded: cover a purpose, source set, historical window, entity class, or duration;
- reversible: support pausing, future refusal, correction, and deletion;
- non-coercive: declining should not disable unrelated product value; and
- reviewable: let the user see what was created or changed.

Consent to an ordinary first-pass search is not automatically consent to entity extraction, deep background research, remote inference, autonomous action, indefinite retention, or cross-workspace use.

Cross-workspace chat-history search requires an explicit user-approved scope even when Robin or a fronting agent has broad search tools. Robin does not ask users to create knowledge graphs, databases, categories, or entity types. It asks whether they want a deeper investigation.

Requesting that deeper investigation is treated as intent to preserve the subject for easy future recall in a visible database-backed memory node. The product should disclose that standing convention clearly without interrupting every topic with a schema prompt. This implied retention remains bounded to the subject and does not grant new source access, remote processing, unrelated profiling, or autonomous action.

## Storage Boundary

| Data class | Default storage | Repository behavior |
|---|---|---|
| Calendar, email, tasks, app-derived Mac data | Internal Fusion Studio SQLite database | Never repository files |
| Contacts, customer names, invoice and financial records | Internal Fusion Studio SQLite database | Never repository files |
| Chat history and database-backed topic, entity, timeline, and memory-node containers | Internal Fusion Studio SQLite database | Never repository files |
| Routine definitions, attachments, run history, app and tool receipts, and sensitive habit or health projections | Internal Fusion Studio SQLite database and the applicable domain-owned tables | Never repository files |
| System manual and internal assistant state | Internal Fusion Studio SQLite database | Never repository files |
| Code, project Markdown, research papers, intentionally repository-owned documents | Workspace filesystem | Governed by the workspace and repository |
| Docs-style personal or business working folders | Filesystem or managed document storage, ignored by default | Explicit opt-in before repository inclusion |
| Derived summaries, indexes, embeddings, or graph data containing sensitive material | Internal database or equivalently protected local store | Never repository files by default |

This table records direction, not a verified implementation. Future work must inspect every export, backup, fixture, log, cache, temporary file, and debugging surface that could bypass it.

## Transparency and Review

Background work should leave a comprehensible record of:

- what triggered the run;
- which approved data scope it used;
- what sources were read;
- which facts, summaries, entities, timelines, edges, or profile fields changed;
- what confidence or ambiguity remains;
- what action was taken autonomously;
- whether review or approval is required; and
- how to correct, revert, suppress, or delete the result.

Issues, completed-item views, Robin notifications, and periodic reviews are candidate surfaces for this transparency. The surface should summarize rather than overwhelm while preserving links to exact evidence.

Ticket containers, apps, views, and background-worker templates should expose the capabilities they actually used. Sharing an internal database or appearing inside Robin must not create implicit cross-workspace or cross-domain access.

Routine receipts must distinguish what the user reported, what an app verified, what an agent observed, and what the system inferred. A conversational acknowledgement that vitamins, hydration, household steps, or learning work are complete must not be silently upgraded into stronger evidence. Background review of chat for routine refinement also needs a declared source scope and cannot expand merely because the routine is attached to several memory nodes.

## Sensitive Inference

Facts about friends, relationships, health, finances, communications, routines, or other entities may be sensitive even when derived from data the user lawfully controls.

The system needs explicit rules for:

- confidence and source display;
- correction and disputed assertions;
- identity resolution and mistaken merges;
- data about people who are not the primary user;
- sensitive-category detection;
- time-bounded facts and changing relationships;
- information that should not be promoted or surfaced casually;
- export, deletion, and retention; and
- whether any remote model may process the material.

The user must be able to distinguish something they stated, something a source recorded, and something the AI inferred.

## Open Design Questions

- What is the default retention and deletion policy for every sensitive data class?
- Can consent be granted per source, purpose, entity, workspace, operation, historical window, or schedule?
- What happens to derived summaries and edges when source data is corrected or deleted?
- How are local backups encrypted and restored without creating uncontrolled copies?
- Which operations may use external model providers, and what redaction or local-only mode is required?
- How will repository guards detect sensitive files, exports, logs, or fixtures before commit?
- What periodic review cadence is useful without becoming notification fatigue?
- How do users inspect and correct information about friends or other entities?
- Where should the product explain that requesting a deep investigation also makes the subject durable for future recall, and how can users change that standing behavior?
- What permission UI makes app, view, ticket, and worker capabilities understandable without exposing infrastructure jargon?
- How are routine-specific health, habit, learning, and household records retained, corrected, exported, or deleted across the routine node and domain apps?
- What user-facing controls distinguish routine context refresh, instruction changes, scheduled invocation, and autonomous actions?
