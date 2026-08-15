# DECISIONS — Project Vision

> Durable owner decisions stated by RC. This is the sole document in this folder that establishes decision authority; specialized concept documents and proposals must link back here.

## Product Identity and Placement

### D-001 — Use Robin as the product-facing assistant identity

- **Date:** 2026-08-09
- **Category:** product
- **Status:** active
- **Source:** RC's Project Vision blurt; CAP-010
- **Decision:** Keep Raven as RC's private name for the GPT-4-era inspiration and use Robin as the Fusion Studio product-facing assistant identity, represented by a bird icon.

### D-002 — Place Robin above workspaces

- **Date:** 2026-08-09
- **Category:** architecture
- **Status:** active
- **Source:** RC's Project Vision blurt; CAP-010
- **Decision:** Retire the concept of the System Manager as an ordinary workspace. Robin is a constant system-level surface above workspaces and initially appears as a drop-down overlay.

### D-003 — Ground Robin with a SQLite system manual

- **Date:** 2026-08-09
- **Category:** architecture
- **Status:** active
- **Source:** RC's Project Vision blurt; CAP-010
- **Decision:** Create the Fusion Studio system manual as internal SQLite-backed knowledge and make it Robin's initial system grounding. The exact schema, versioning, and retrieval contract remain to be designed.

## Privacy and Data

### D-004 — Keep sensitive operational data in the unified application database

- **Date:** 2026-08-09
- **Category:** data
- **Status:** active
- **Source:** RC's “line in the sand”; CAP-009
- **Decision:** Store calendar, email, to-do, app-derived Mac data, chat history, customer names, contacts, invoices, and other sensitive personal or business records in Fusion Studio's internal unified SQLite database. Do not store them in JSON files or repositories where they could accidentally reach GitHub.

### D-005 — Keep working document folders out of repositories by default

- **Date:** 2026-08-09
- **Category:** data
- **Status:** active
- **Source:** RC's Project Vision blurt; CAP-009
- **Decision:** Treat user-created Docs-style working folders and similar content as an intermediate data class that is ignored by default. Include such content in a repository only after an explicit user choice.

### D-006 — Make personal memory and enrichment transparent and opt-in

- **Date:** 2026-08-09
- **Category:** privacy
- **Status:** active
- **Source:** RC's Project Vision blurt; CAP-011
- **Decision:** Gate entity extraction, richer retrieval, personal profiling, and comparable memory escalation behind understandable, optional, opt-in interactions. The assistant should explain why a capability would help the current task and later recall.

## Process and Governance

### D-007 — Make autonomous background changes reviewable

- **Date:** 2026-08-09
- **Category:** process
- **Status:** active
- **Source:** RC's Project Vision blurt; CAP-011
- **Decision:** Expose autonomous or recurring AI work through visible completed items, issues, tickets, notifications, or periodic review so the user can see what happened and approve or correct profile and information changes when appropriate.

### D-008 — Capture the project vision before implementation

- **Date:** 2026-08-09
- **Category:** process
- **Status:** active
- **Source:** RC request to create 021-Project_Vision
- **Decision:** Preserve this product realization in a dedicated Launchpad and Second Brain capture. Do not begin code, database, System Manager migration, Wiki, or roadmap work without a later explicit handoff.

### D-009 — Separate Launchpad from ordinary workspace harness chat

- **Date:** 2026-08-10
- **Category:** product
- **Status:** active
- **Source:** RC's Project Vision continuation; CAP-014
- **Decision:** Keep Launchpad as its own capture-and-shaping section. Let the rest of workspace chat function more like an OpenCode harness attached to direct work.

### D-010 — Require permission for cross-workspace chat-history reads

- **Date:** 2026-08-10
- **Category:** privacy
- **Status:** active
- **Source:** RC's Project Vision continuation; CAP-015
- **Decision:** Permit fronting assistants to read chat history across workspaces only when the user allows that access. Broad search tooling does not create standing cross-workspace permission.

### D-011 — Begin recall enrichment with an explicit post-retrieval offer

- **Date:** 2026-08-10
- **Category:** privacy
- **Status:** superseded
- **Source:** RC's Project Vision continuation; CAP-015
- **Decision:** After retrieving information, ask whether the user wants a new category, entity, type, or comparable structure added for faster recall next time. Do not silently create the first layer of personal schema.

Superseded by D-016 through D-019. Robin offers to investigate the subject more deeply rather than asking the user to create a storage structure.

### D-012 — Derive background schemas and schedules from direct user instruction

- **Date:** 2026-08-10
- **Category:** process
- **Status:** active
- **Source:** RC's Project Vision continuation; CAP-015
- **Decision:** Let background AIs define narrower schemas, search scopes, and update schedules from direct user instruction while applying the same evidence, provenance, and authority rules used by Launchpad and Second Brain.

### D-013 — Use the Robin app drawer as the primary web interaction model

- **Date:** 2026-08-10
- **Category:** architecture
- **Status:** active
- **Source:** RC's Project Vision continuation; CAP-014
- **Decision:** Give Robin a Raven OS-style app button that opens a modal or app drawer with chat as the default. Use this as the main interface paradigm for the planned web application, with menus and chat references able to open app content.

### D-014 — Keep desktop workspaces VS Code-like while Robin stays constant

- **Date:** 2026-08-10
- **Category:** architecture
- **Status:** active
- **Source:** RC's Project Vision continuation; CAP-014
- **Decision:** Keep desktop workspaces oriented around VS Code-like work with attached chat rather than imposing the phone-style app shell. Robin's System Manager surface remains constant above workspace changes.

### D-015 — Provide a user-extensible background-worker library in Robin

- **Date:** 2026-08-10
- **Category:** product
- **Status:** active
- **Source:** RC's Project Vision continuation; CAP-016
- **Decision:** Give Robin its own background-worker UI with active and inactive templates for available work types. Let users download additional agents and modify installed templates in place, subject to later safety and permission contracts.

### D-016 — Offer deeper investigation instead of memory-schema setup

- **Date:** 2026-08-10
- **Category:** product
- **Status:** active
- **Source:** RC's memory-node clarification; CAP-025
- **Decision:** Search broadly enough to answer and converse usefully, then offer to dig deeper when more work would help. Do not ask the user whether to create a knowledge graph, user database, category, entity type, or other internal schema structure.

### D-017 — Treat a requested deep investigation as durable-recall intent

- **Date:** 2026-08-10
- **Category:** privacy
- **Status:** active
- **Source:** RC's memory-node clarification; CAP-025
- **Decision:** When the user asks Robin to look deeply into a topic, assume they want that topic to be easily recalled in the future. Make this standing behavior visible to the user, while keeping source access, sensitive-data permissions, correction, and deletion as separate controls.

### D-018 — Represent memory nodes as Launchpad containers in the database

- **Date:** 2026-08-10
- **Category:** architecture
- **Status:** active
- **Source:** RC's memory-node clarification; CAP-025
- **Decision:** A memory node is the Launchpad and Second Brain folder structure represented in the internal database, with earned internal subnodes, tags, schemas, sources, and working records. Give users a place to inspect these nodes rather than presenting memory as an invisible or separate graph abstraction.

### D-019 — Seed deep research from the initial exchange and refine on recurrence

- **Date:** 2026-08-10
- **Category:** process
- **Status:** active
- **Source:** RC's memory-node clarification; CAP-025
- **Decision:** When deeper work is requested, seed the background-agent swarm with the initial search and conversation. Reconcile its grounded output into the subject's memory node, then improve and update that node whenever the user returns to the subject.

### D-020 — Put Routines inside the System Manager

- **Date:** 2026-08-10
- **Category:** product
- **Status:** active
- **Source:** RC's Routines direction; CAP-026
- **Decision:** Create Routines as a Robin System Manager app for conversationally invoking, running, inspecting, and refining small behaviors through complex stateful workflows.

### D-021 — Inject routines into the memory nodes they serve

- **Date:** 2026-08-10
- **Category:** architecture
- **Status:** active
- **Source:** RC's routine and memory-node clarification; CAP-026
- **Decision:** Treat a routine as an executable extension of the database-backed Launchpad memory-node model. A routine may have its own container and must also be attachable to the appropriate topic, entity, project, health, learning, or other memory nodes rather than living in an unrelated parallel system. A run injects the routine and the appropriate memory-node context together.

### D-022 — Preserve a routine's originating conversation and prior state

- **Date:** 2026-08-10
- **Category:** architecture
- **Status:** active
- **Source:** RC's Routines direction; CAP-026
- **Decision:** Retain the chat that spawned a routine, the issues and choices involved in shaping it, its maintained instructions and heuristics, prior executions, learned state, and future suggestions so later invocations continue from accumulated context.

### D-023 — Let routines compose explicitly selected apps, tools, APIs, and scripts

- **Date:** 2026-08-10
- **Category:** product
- **Status:** active
- **Source:** RC's Routines direction; CAP-026
- **Decision:** Let a routine interact with user-selected apps, tool calls, API operations, and custom scripts, and let it record results into appropriate domain stores. The routine must retain the declared operations and capabilities it uses rather than inheriting ambient access.

### D-024 — Keep automatic routine updates opt-in

- **Date:** 2026-08-10
- **Category:** privacy
- **Status:** active
- **Source:** RC's Routines direction; CAP-026
- **Decision:** Begin with manual or conversational routine use. Enable automatic updating only when the user chooses it; the exact boundaries among context refresh, routine modification, scheduled invocation, and autonomous action remain to be designed.
