# CAPTURE — Project Vision

> Curated conversational checkpoint and re-entry surface for the Project Vision blurt. Preserve open threads and provenance here; explicit owner decisions, verified risks, and candidate mechanisms belong in their indexed destinations.

## Working Synthesis

This capture records the realization that the Second Brain and Launchpad experiments are not merely documentation conveniences. They are a small, transparent model of the larger personal-assistant and knowledge architecture RC originally imagined as Raven OS and now sees as part of Fusion Studio.

**The original Raven OS ambition.** Raven was conceived as a personal chat companion and day-to-day assistant that could develop rapport by learning the user's schedule, routines, calendar, email, communications, projects, interests, and relationships. It could perform entity extraction, maintain information about friends and other entities, and retrieve anything relevant today or across time. The desired experience is a semi-sentient assistant: not omniscient in its immediate prompt, but aware that relevant knowledge exists and able to retrieve grounded context when needed.

**The trust problem.** Quietly profiling a person, their contacts, communications, routines, and history felt creepy even when the intended benefit was genuine. Memory and enrichment therefore need to be inspectable, explainable, and governed by understandable user actions. RC first imagined semantic prompts for enabling retrieval, entity extraction, profiles, or other memory layers, then clarified a simpler convention: Robin answers from a broad first pass and offers to look deeply; requesting the deep investigation also expresses the user's desire for durable recall of that subject. Initial catch-up may still require an observable pass across a user-approved historical window, and later processing needs visibility into what ran and changed.

**Fusion Studio as the privacy-respecting container.** RC paused Raven and began building Fusion Studio as a way for people to divide their work and life into understandable segments. A workspace may hold bookkeeping, expenses, CRM, invoices, documents, email, calendar, code tasks, research libraries, issues, and recurring AI-executed work without requiring every user to enable every module. The product should support modules that can be added or removed without breaking the underlying schema. Issues and completed-item views can make autonomous work visible after the user returns.

**The personal knowledge model.** A future personal Wiki or equivalent database model could contain small facts, semantic categories and branches, subject and entity timelines, topic summaries, and links to raw chats, events, records, research, documents, and codebases. The navigational structure may be hierarchical for orientation while also carrying graph edges for associative traversal. A useful working pattern is up to three classification levels followed by links to the underlying record at the fourth level. Recall itself can affect salience: when retrieved information becomes part of a new user conversation, it may be promoted into a short-term fast-recall store.

**Multiple memory forms.** RC is envisioning fact-based storage, semantic memory, categorical topic or entity summaries, narrative history, and a fast-recall layer operating together. Chat pairs may eventually carry metadata describing cognitive domains such as refine/define/shape, brainstorm/ideate, analyze/research, and ponder/imagine/philosophize; the exact prior schema must be recovered from ChatGPT history. That imported history also contains the narrative of RC learning about model memory, context windows, tokens, and limits from GPT-4. The eventual narrative should be personally meaningful, informational, factually accurate, and grounded in source conversations.

**Retrieval architecture.** A carefully indexed hierarchical Wiki, a graph, recursive language-model lookup, very-high-throughput inference, and direct access to grounded records are complementary rather than mutually exclusive. The system can check an index or graph first, recognize missing context, offer to inspect the source material, and assemble bounded context in background work so code agents, research assistants, and other specialists remain responsive.

**The data boundary.** RC drew a firm line between repository-safe project material and sensitive operational data. Calendar, email, to-do items, app-derived Mac data, chat history, customer names, contacts, invoices, and other sensitive personal or business records belong in Fusion Studio's internal SQLite database, not JSON files or repositories that might reach GitHub. Working documents and user-created document folders occupy an intermediate layer: ignored by default, with an explicit choice required before adding them to a repository.

**Robin as the System Manager.** The former System Manager workspace should become a constant system-level assistant above all workspaces. Raven remains RC's private name for the inspiration; the product-facing assistant is Robin, represented by a bird icon and initially appearing as a drop-down overlay. Robin begins with the system manual as grounding, can receive tickets or events from any workspace, can notify the user about changes such as modified skills or scripts, and can summarize, silence, defer, group, or redirect notifications. Robin should answer first from its indexed knowledge and graph, then offer to inspect grounded sources when necessary.

**Connection to Launchpad and Second Brain.** The process being developed here—derive a local schema, separate authority types, use background agents to fill missing context, preserve provenance, and keep the user in a fronting conversation—is the prototype for a memory node. The folder contract becomes database structure rather than literal files. Domain examples and sub-skills can provide reusable conventions while leaving enough semantic freedom for the AI to invent local categories when the user's material does not fit a fixed taxonomy.

**Chat and surface paradigm.** RC now distinguishes Launchpad as its own capture-and-shaping section from ordinary workspace chat, which should behave more like an OpenCode harness attached to a VS Code-like desktop workspace. Robin uses a different, constant Raven OS-style app shell: a bird or app button opens a modal or drawer, chat is the default, referenced content can become a full app experience, and the same capability may render as a mobile/web app, a Robin overlay, or a desktop workspace view. INTERACTION_MODEL.md preserves this cross-surface model.

**Ticket containers and semi-automated work.** The same schema-governed folder pattern may extend into the ticketing system. A Wiki ticket created after code merges without documentation could create a container; the first AI hydrates it from grounded sources before handing work to a Wiki editor, while an orchestrator follows a checklist and validation cycle. Tickets can run AFK within declared gates or become interactive when the user opens them, answers the remaining issues, and lets the next pass continue. WORKFLOW_MODEL.md preserves this lifecycle and the proposed active/inactive background-worker template library.

**Search first, deepen on request, and remember the subject.** Fronting assistants search broadly enough to answer the immediate question and converse usefully, subject to the source permissions already in force. They do not ask whether the user wants a knowledge graph, a database, or a new schema category. Instead, they offer to dig deeper. When the user requests that deeper investigation, the initial search and conversation seed a swarm of background agents, and the request carries the assumption that the subject should become easy to recall later.

**Memory nodes are database-backed Launchpad containers.** A topic, entity, project, or other subject becomes a durable node whose internal organization is the Launchpad and Second Brain folder pattern represented in the database: a readable synthesis, sources, intent, decisions, issues, proposals, domain-specific extensions, provenance, and earned tags or schemas as appropriate. The user gets a place to inspect these nodes. Each node can grow extensive internal subnodes and is improved whenever the subject returns to conversation. Graph edges remain useful for connecting nodes, but the node's substance is the maintained container rather than an opaque graph record.

**Routines make memory executable.** Routines is a System Manager app for injecting conversational workflows and repeatable behaviors into the memory nodes where they belong. A routine is not a separate architecture layered beside memory. It is an executable extension of the same database-backed Launchpad model: it can hold the originating chat, intent, prior state, steps, heuristics, schema, issues, decisions, proposed refinements, app integrations, tools, scripts, and execution receipts. The standalone app provides a cross-cutting place to find and run routines while a vitamin routine can also appear inside Health or Morning nodes and a flashcard routine inside a Coding Learning node.

**Routine execution and adaptation.** A routine may be a short companion-like sequence—clean the bedroom, grab the trash, get the mail, then review vitamins—or a stateful command such as “Status” or “update my flash cards.” Robin resolves the semantic invocation, loads the routine and attached memory-node context, identifies missing information, dispatches background work through a receipt or bulletin-like mechanism, responds conversationally, and preserves the results. Domain apps retain canonical data such as vitamin intake, hydration, calendar events, or flashcard statistics. Background processes may inspect approved conversation and run history for friction, changed intent, and improvement suggestions while always retaining prior state.

**Automation remains earned.** Manual and conversational execution comes first. A user may later enable automatic updates, schedules, or event triggers for an individual routine. Context refresh, routine modification, scheduled invocation, and autonomous app actions are separate levels and should not collapse into one switch.

**Supervisory routines.** The same architecture can supervise builds, automated orchestrators, and other long-running work. A conditional routine can remain dormant when nothing is active, wake on an hourly heartbeat while watched runs exist, inspect grounded status, and report proactively through Robin. If an orchestrator is waiting for owner input, Robin can present the exact question, carry the user's answer back to the originating run, and resume it. Restarting from scratch, resuming a paused run, retrying a failed step, and replacing a dead worker are different actions and must retain the original run identity, authority, leases, and receipts.

## User Threads to Resume

### CAP-001 — Recover the cognitive-domain schema and ChatGPT history

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** Locate the prior cognitive-domain schema and the historical ChatGPT conversations that document RC's progression from learning about model memory and context limits to designing Fusion Studio.
- **Related:** MEMORY_MODEL.md
- **Resume with:** Search or export ChatGPT history; if no supported route exists, evaluate a user-controlled web extraction method. Preserve raw provenance, recover the exact cognitive-domain vocabulary, and decide how imported chats enter the internal database.

### CAP-002 — Design understandable consent escalation

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** Explain the standing convention that ordinary questions receive a broad first-pass search, while asking Robin to look deeply into a subject also means preserving that subject for easier future recall.
- **Related:** D-016, D-017, I-001, I-002, PRIVACY_AND_DATA.md
- **Resume with:** Define where this convention is disclosed, how source permissions remain separate, how users inspect or remove a node, and how declining a deeper investigation affects ordinary answers.

### CAP-003 — Choose the hybrid memory and retrieval architecture

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** Evaluate how database-backed Launchpad containers, hierarchical indexes, graph edges, semantic summaries, source records, fast recall, recursive lookup, and high-throughput inference should cooperate.
- **Related:** I-004, I-007, I-008, P-004 through P-008, MEMORY_MODEL.md
- **Resume with:** Define the Launchpad-folder-to-database mapping, retrieval stages, node refresh rules, confidence and freshness metadata, context budgets, and when source inspection is mandatory.

### CAP-004 — Define the system manual lifecycle

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** The system manual should live in SQLite and ground Robin, but its schema, versioning, editing authority, retrieval strategy, and update notifications remain undefined.
- **Related:** D-003, I-010, SYSTEM_MANAGER.md
- **Resume with:** Separate stable system instructions, current system state, procedures, user preferences, and change history.

### CAP-005 — Make modules schema-safe

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** Bookkeeping, expenses, CRM, invoices, Docs, email, calendar, code tasks, research libraries, and issues must be addable or removable without corrupting a unified data model.
- **Related:** I-005, P-003
- **Resume with:** Identify a stable platform kernel, module-owned tables and migrations, capability discovery, dependency rules, and export boundaries.

### CAP-006 — Define Robin's notification and ticket contract

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** Robin should receive cross-workspace tickets and system events, show badge notifications, summarize work, and support per-workspace or per-trigger suppression and bundling.
- **Related:** D-007, P-009, SYSTEM_MANAGER.md
- **Resume with:** Define event sources, routing, severity, badge-count semantics, grouping, silence durations, review records, and acknowledgement state.

### CAP-007 — Build the grounded personal narrative

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** Turn the historical conversations about GPT-4, memory, context, and the path to Fusion Studio into a narrative that is both personal and factually grounded.
- **Related:** CAP-001, MEMORY_MODEL.md
- **Resume with:** Recover sources first, decide audience and form, then use a research-writing profile with claims linked to original chats.

### CAP-008 — Define rapport without pretending or surveillance

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** Shape a Robin persona that can become intimately useful and develop rapport while remaining honest about inference, memory, uncertainty, and user control.
- **Related:** I-001, I-011, INTENT.md, PRIVACY_AND_DATA.md
- **Resume with:** Separate tone and continuity from claims of sentience, define uncertainty language, and make relationship or entity inferences inspectable and correctable.

### CAP-013 — Verify the existing chat-metadata and harness groundwork

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Summary:** RC recalls that chat-thread metadata already has database groundwork and that OpenCode can call configured APIs directly, but the exact current schema, config, and wiring have not been verified.
- **Related:** MEMORY_MODEL.md, SYSTEM_MANAGER.md
- **Resume with:** Inspect the current chat database migrations, thread metadata, harness configuration, and supported direct API path before turning the remembered groundwork into architecture claims.

### CAP-018 — Define the Wiki ticket-container lifecycle

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Shape the folder container created when a Wiki ticket responds to merged code that lacks documentation, including first-agent hydration, edit-agent handoff, orchestration, and closure evidence.
- **Related:** I-014, P-012, WORKFLOW_MODEL.md
- **Resume with:** Define triggers, inherited versus derived schema, source bundle, write leases, checklist, validation, and final Wiki evidence.

### CAP-019 — Define AFK and interactive ticket checkpoints

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Determine how one ticket can run semi-automatically while the user is away and also pause for interactive issue resolution without forking or racing the workflow.
- **Related:** I-015, P-013, WORKFLOW_MODEL.md
- **Resume with:** Specify stage leases, pause and resume state, approval thresholds, validation budgets, and how the smallest unresolved issue set is presented.

### CAP-020 — Define the portable app and view contract

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Formalize how one capability can render as a mobile/web app, Robin overlay, or desktop workspace view while sharing data and components.
- **Related:** I-017, I-018, P-015, P-018, INTERACTION_MODEL.md
- **Resume with:** Separate shared domain state and commands from responsive navigation, surface slots, workspace scope, and data capabilities.

### CAP-021 — Define the background-worker template ecosystem

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Design Robin's active and inactive template catalog, downloadable workers, in-place modification, dispatch compatibility, permissions, and review.
- **Related:** D-015, I-016, P-019, WORKFLOW_MODEL.md
- **Resume with:** Define manifests, signatures, versions, tool and data scopes, sandboxing, template inheritance, activation, rollback, and change notifications.

### CAP-022 — Shape Personal Inventory

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Explore Personal Inventory as the user-facing place to inspect database-backed memory nodes, their Launchpad-like internal branches, and the edges among thoughts, text fragments, articles, entities, projects, and source records.
- **Related:** P-016, MEMORY_MODEL.md, INTERACTION_MODEL.md
- **Resume with:** Define how a node's container sections and subnodes render, how users inspect sources and corrections, and how its hierarchy and edges remain visually distinct from workspaces.

### CAP-023 — Shape the Weekly Review app

- **Origin:** user
- **Type:** thread
- **Status:** open
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Explore Weekly Review as a script-backed app that generates a checklist from templates, heuristics, actual data, and recurring work.
- **Related:** P-017, WORKFLOW_MODEL.md, INTERACTION_MODEL.md
- **Resume with:** Define schedule and manual launch, checklist sources, run identity, AI autonomy, user checkpoints, persistence, and notification behavior.

### CAP-024 — Bound Launchpad versus harness chat

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** The high-level division is decided, but the exact feature and navigation boundary between Launchpad, ordinary workspace harness chat, and Robin global chat remains undefined.
- **Related:** D-009, INTERACTION_MODEL.md
- **Resume with:** Classify capture, direct execution, global discussion, background delegation, artifacts, history, and view launching across the three surfaces.

### CAP-028 — Define the minimum Routine kernel

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's 2026-08-10 Routines concept
- **Summary:** Define the smallest shared database contract that lets a routine retain origin, intent, instructions, heuristics, schemas, issues, prior state, run receipts, improvements, and attachments to appropriate memory nodes without constraining simple and complex routines to one rigid shape.
- **Related:** D-021, D-022, I-005, ROUTINES_MODEL.md
- **Resume with:** Separate routine definition, memory-node attachments, run sessions, domain projections, version history, and earned extensions.

### CAP-029 — Design semantic routine invocation and receipts

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's “Status” routine example
- **Summary:** Define how Robin recognizes a routine from short or natural-language phrases, loads prior state and heuristics, identifies missing context, requests bounded background work, waits or reports progress, and reconciles receipts before replying.
- **Related:** I-020, P-021, ROUTINES_MODEL.md
- **Resume with:** Define alias confidence, collision handling, routine versus ordinary-conversation intent, receipt authority, partial results, cancellation, and resume behavior.

### CAP-030 — Define the Routine app and tool capability contract

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's composable app, API, tool-call, and custom-script direction
- **Summary:** Let a routine coordinate user-selected apps, APIs, tool calls, and custom scripts while keeping secrets, read and write scopes, canonical data ownership, errors, and audit receipts explicit.
- **Related:** D-023, I-018, I-021, P-018, P-022, ROUTINES_MODEL.md
- **Resume with:** Define manifests, capability grants, domain ownership, cross-store transactions, secrets, script versions, dry runs, failures, rollback, and user-visible action history.

### CAP-031 — Define routine refinement and automation levels

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's background-refinement and opt-in auto-update direction
- **Summary:** Background processes may compare approved conversation and run history against the routine's maintained intent, propose improvements, and eventually update or invoke the routine automatically when the user enables the appropriate level.
- **Related:** D-024, I-023, P-023, P-025, ROUTINES_MODEL.md
- **Resume with:** Separate contextual preparation, suggestion generation, definition updates, scheduled conversational starts, and autonomous writes; define approval, review, pause, and rollback for each.

### CAP-033 — Define supervisory run control through Robin

- **Origin:** user
- **Type:** question
- **Status:** open
- **Source:** RC's hourly build and orchestrator supervision idea
- **Summary:** Define how Robin monitors active builds and orchestrators, reports progress proactively, presents a blocked run's exact question, relays the user's answer, and safely resumes, retries, restarts, or replaces work without duplicating execution or inventing owner authority.
- **Related:** I-024, I-025, I-026, P-026, P-027, ROUTINES_MODEL.md, WORKFLOW_MODEL.md
- **Resume with:** Define watch activation, heartbeat cadence, status freshness, notification thresholds, run identity, pause and lease state, question envelopes, answer provenance, and exact resume/retry/restart semantics.

## Assistant Possibilities

No assistant-originated possibilities have been added. The current candidate mechanisms came from RC's blurt and remain proposals unless they were explicitly recorded as decisions.

## Decision Queue

No single unresolved owner choice is ready for a binary disposition. The active user threads above need shaping before they should be converted into decision prompts.

## Routed Outcomes

### CAP-009 — Establish the private-data storage boundary

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's “line in the sand” in the Project Vision blurt
- **Summary:** Keep sensitive operational and personal data in Fusion Studio's internal database and keep working document folders out of repositories by default.
- **Related:** D-004, D-005
- **Outcome:** Routed to DECISIONS.md. The detailed boundary and open enforcement questions are mapped in PRIVACY_AND_DATA.md.

### CAP-010 — Reframe the System Manager as Robin

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's Project Vision blurt
- **Summary:** Replace the System Manager workspace concept with a constant system-level assistant named Robin, privately inspired by Raven, grounded by a SQLite system manual.
- **Related:** D-001, D-002, D-003
- **Outcome:** Routed to DECISIONS.md and synthesized in SYSTEM_MANAGER.md.

### CAP-011 — Require transparent opt-in memory governance

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's Project Vision blurt
- **Summary:** Memory, entity extraction, enrichment, and autonomous background changes must be introduced transparently, gated by user choice, and periodically reviewable.
- **Related:** D-006, D-007
- **Outcome:** Routed to DECISIONS.md and elaborated in PRIVACY_AND_DATA.md.

### CAP-012 — Preserve the candidate memory and coordination mechanisms

- **Origin:** user
- **Type:** idea
- **Status:** routed
- **Source:** RC's Project Vision blurt
- **Summary:** Preserve the concrete candidate mechanisms without treating them as approved architecture.
- **Related:** P-001, P-002, P-003, P-004, P-005, P-006, P-007, P-008, P-009, P-010, P-011
- **Outcome:** Routed to PROPOSALS.md; related conceptual models live in SYSTEM_MANAGER.md and MEMORY_MODEL.md.

### CAP-014 — Adopt distinct Launchpad, workspace-chat, and Robin surfaces

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Keep Launchpad as its own shaping section, keep ordinary desktop workspace chat harness-like, and make Robin a constant app-style global surface that becomes the main web interaction model.
- **Related:** D-009, D-013, D-014
- **Outcome:** Routed to DECISIONS.md and synthesized in INTERACTION_MODEL.md.

### CAP-015 — Gate cross-workspace recall and schema enrichment

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Require user permission before cross-workspace chat-history reads, begin with post-retrieval offers to add recall structures, and base later background schemas and schedules on direct user instruction.
- **Related:** D-010, D-011, D-012
- **Outcome:** Routed to DECISIONS.md and reflected in PRIVACY_AND_DATA.md and MEMORY_MODEL.md. Its post-retrieval schema prompt was later superseded by CAP-025 and D-016 through D-019; D-010's source-access boundary remains active.

### CAP-016 — Give Robin a user-extensible worker library

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Give the System Manager its own background-worker UI with active and inactive templates, downloadable agents, and user modification in place.
- **Related:** D-015
- **Outcome:** Routed to DECISIONS.md and elaborated in WORKFLOW_MODEL.md.

### CAP-017 — Preserve the new workflow and app mechanisms

- **Origin:** user
- **Type:** idea
- **Status:** routed
- **Source:** RC's 2026-08-10 Project Vision continuation
- **Summary:** Preserve the Wiki container, dual ticket modes, fronting-agent delegation, portable app/view shell, Personal Inventory, Weekly Review, shared app contracts, and worker-template mechanisms without treating their details as approved architecture.
- **Related:** P-012, P-013, P-014, P-015, P-016, P-017, P-018, P-019
- **Outcome:** Routed to PROPOSALS.md and synthesized in INTERACTION_MODEL.md and WORKFLOW_MODEL.md.

### CAP-025 — Replace schema prompts with deepening and durable topic nodes

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's 2026-08-10 clarification of the memory-node model
- **Summary:** Search broadly for the immediate conversation, offer to investigate more deeply, treat a requested deep investigation as a desire for easy future recall, seed background agents from the first search and conversation, and represent the resulting subject as a visible database-backed Launchpad container that grows on later mentions.
- **Related:** D-016, D-017, D-018, D-019
- **Outcome:** Routed to DECISIONS.md and reconciled across INTENT.md, MEMORY_MODEL.md, PRIVACY_AND_DATA.md, SYSTEM_MANAGER.md, INTERACTION_MODEL.md, and WORKFLOW_MODEL.md. D-011 was superseded.

### CAP-026 — Establish Routines as executable memory-node extensions

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC's 2026-08-10 Routines concept and memory-node clarification
- **Summary:** Put Routines inside the System Manager, represent each routine through the database-backed Launchpad model, inject routines into the memory nodes they serve, retain their originating conversation and prior state, allow explicit app/tool/script composition, and keep automatic updates opt-in.
- **Related:** D-020, D-021, D-022, D-023, D-024
- **Outcome:** Routed to DECISIONS.md and synthesized in ROUTINES_MODEL.md.

### CAP-027 — Preserve the candidate Routine mechanisms

- **Origin:** user
- **Type:** idea
- **Status:** routed
- **Source:** RC's 2026-08-10 Routines examples
- **Summary:** Preserve the companion runner, semantic aliases, bulletin-like context receipts, cross-app records, background refinement, adaptive flashcards, layered automation, and the household, vitamin, hydration, Status, and learning examples without treating every mechanism as settled architecture.
- **Related:** P-020, P-021, P-022, P-023, P-024, P-025
- **Outcome:** Routed to PROPOSALS.md and developed in ROUTINES_MODEL.md.

### CAP-032 — Preserve conditional orchestrator-watch routines

- **Origin:** user
- **Type:** idea
- **Status:** routed
- **Source:** RC's 2026-08-10 build and orchestrator supervision idea
- **Summary:** Use a routine that wakes hourly while builds or automated orchestrators are active, reports grounded status proactively, lets the user answer blocked orchestrators through Robin, and resumes or restarts the appropriate run afterward.
- **Related:** P-026, P-027
- **Outcome:** Routed to PROPOSALS.md and developed in ROUTINES_MODEL.md, SYSTEM_MANAGER.md, and WORKFLOW_MODEL.md. Run-control authority and safety remain open in CAP-033 and ISSUES.md.

## Capture History

- **2026-08-09 — Project Vision blurt:** Created the capture from RC's realization connecting Raven OS, Fusion Studio, Robin, privacy-respecting personal memory, modular workspaces, the personal Wiki/graph, and Launchpad/Second Brain as a prototype for the larger system.
- **2026-08-10 — Interaction and workflow expansion:** Recorded the Launchpad/harness/Robin surface split, portable app and view shell, permissioned cross-workspace retrieval, post-retrieval schema offers, Wiki ticket containers, AFK and in-the-loop execution, the worker-template library, Personal Inventory, and Weekly Review.
- **2026-08-10 — Search, deepen, and remember clarification:** Replaced per-topic schema prompts with broad first-pass search, an offer to investigate deeply, implied durable recall when that offer is accepted, background swarms seeded by the initial exchange, and visible memory nodes modeled as Launchpad containers in the database.
- **2026-08-10 — Routines realization:** Added Routines as the executable extension of the memory-node model: conversational workflows injected into relevant nodes, stateful semantic invocation, composable apps and scripts, background refinement, cross-domain data projection, and user-enabled automation.
- **2026-08-10 — Supervisory routines:** Extended Routines to conditional heartbeat monitoring of builds and orchestrators, proactive Robin status, owner-answer relay, and controlled continuation of blocked work.
