# INTENT — Project Vision

> Owner-directed purpose, desired outcomes, enduring goals, success conditions, constraints, and non-goals. This document establishes direction but does not authorize implementation.

## Purpose

Evolve Fusion Studio into a privacy-respecting container for a deeply useful personal and work assistant: one that can maintain continuity across time and domains, transparently assemble missing context, coordinate background work, and remain grounded in user-controlled sources.

Use the Launchpad and Second Brain workflow as an immediate prototype for the broader knowledge-maintenance model rather than treating it as an isolated documentation utility.

## Desired Outcomes

- Robin exists as a constant system-level assistant above workspaces rather than as the System Manager workspace.
- Robin can orient from a system manual and indexed knowledge, receive cross-workspace tickets and events, summarize activity, and offer grounded source lookup.
- Deep investigation and durable personal-memory behavior are understandable, user-initiated, inspectable, correctable, removable, and periodically reviewable without making users design schemas.
- Fusion Studio can organize personal, business, research, creative, and software work through modular capabilities without requiring every module or breaking the shared schema.
- Sensitive operational data remains inside the Electron application's unified SQLite database and cannot accidentally enter a repository.
- Personal knowledge can be navigated hierarchically, traversed through semantic edges, assembled in background context packets, and traced back to raw chats, events, records, documents, research, or code.
- Memory nodes are visible database-backed versions of the Launchpad container pattern, capable of earning subject-specific sections, tags, schemas, and subnodes as understanding deepens.
- Historical ChatGPT conversations can eventually be imported, searched, enriched, and used to create a grounded narrative of RC's development alongside AI.
- Launchpad, workspace harness chat, and Robin global chat have distinct roles while sharing durable artifacts and grounded context.
- One capability can present as a web or mobile app, Robin overlay, or desktop workspace view without forking its underlying data and command model.
- Wiki and other structured work can run through folder-shaped ticket containers in either semi-automated AFK mode or an interactive user-checkpoint mode.
- Robin exposes a discoverable, user-extensible library of active and inactive background-worker templates.
- Routines turns relevant memory nodes into conversational, stateful workflows that can guide simple behaviors, coordinate context and tools, write to appropriate domain apps, and improve from prior runs.
- The Routines app provides one cross-cutting place to discover and run routines while the same routine remains available inside the health, learning, project, household, or other memory nodes it serves.

## Enduring Goals

- Provide a semi-sentient assistant experience that knows what is relevant today, preserves what remains relevant across time, and at least knows where to retrieve information not present in immediate context.
- Let the assistant develop genuine continuity and rapport without hiding surveillance-like processing, overstating certainty, or pretending to possess knowledge it cannot ground.
- Give users understandable mental segments for their lives and work while allowing useful connections across those segments.
- Make autonomous AI work feel visible and governable: completed actions, changes, sources, and reasons should be reviewable without forcing the user to supervise every execution live.
- Allow domain-specific conventions and sub-skills to coexist with AI judgment so new information structures can emerge without reducing human experience to one universal taxonomy.

## Success Conditions

- A new user can understand that ordinary questions receive a broad first pass and that requesting a deep investigation makes the subject durable for future recall, without being asked to approve internal graph or schema mechanics.
- Entity, topic, timeline, and summary changes can be inspected, corrected, approved where necessary, and traced to source records.
- Overnight catch-up and incremental background processing expose what ran, what changed, and what requires review.
- Calendar, email, tasks, contacts, customer and invoice data, chat history, and other sensitive app records remain database-only under enforceable repository guards.
- Optional modules can be enabled or removed through explicit contracts and migrations without corrupting unrelated data.
- Robin can answer quickly from indexes and summaries, recognize when grounding is insufficient, and offer or launch a bounded source lookup.
- A requested deep investigation can seed background agents from the initial search and conversation, produce a source-grounded node, and improve that same node when the subject recurs.
- Cross-workspace notifications can be grouped, silenced, redirected, reviewed, and tied to the originating action.
- Cross-workspace history is read only within a visible user-approved scope; a deep-research request authorizes durable recall of the subject but does not expand which sources may be read.
- A ticket can move between AFK and interactive execution without losing evidence, duplicating work, or racing active agents.
- Apps and views share explicit state, command, and permission contracts while adapting navigation and presentation to each surface.
- A routine can resume from prior state, distinguish reported from verified completion, expose every app or tool interaction, and preserve why its instructions or heuristics changed.
- Users can enable automatic routine behavior incrementally without automatic context refresh silently becoming autonomous cross-app action.
- A future roadmap can be produced from coherent intent, decisions, risk analysis, memory and privacy models, and a bounded System Manager concept without reconstructing this conversation.

## Constraints

- Privacy, trust, explainability, and user control are product architecture concerns, not later polish.
- Explicit owner decisions in DECISIONS.md are authoritative; conceptual models and proposals cannot silently expand them.
- Sensitive real user data must not be placed in this capture, the repository, JSON fixtures, logs, or documentation examples.
- Personal or business working documents remain ignored by default unless the user deliberately chooses repository inclusion.
- External inference providers, recursive model lookup, or remote processing must not receive sensitive material merely because they are faster; their role and consent model remain undecided.
- Cross-workspace search, app data sharing, downloaded agents, and user-modified worker templates require explicit capabilities rather than ambient access.
- Routine aliases, background refinement, app writes, API operations, tool calls, scripts, schedules, and automatic actions require bounded capabilities and user-visible receipts.
- Fusion Studio remains the application shell and orchestrator; model and harness providers are replaceable dependencies.

## Non-goals

- Invisible background profiling or entity extraction.
- Requiring ordinary users to understand embeddings, graphs, recursive lookup, context windows, or database architecture before making an informed choice.
- Asking users to create or approve individual categories, entity types, graph nodes, or database schemas as part of ordinary conversation.
- Requiring users to operate a workflow editor while a conversational routine is running.
- Treating one automation switch as permission for context refresh, definition changes, scheduled invocation, and autonomous actions at once.
- Treating one handcrafted taxonomy as a complete model of human experience.
- Preserving the System Manager as an ordinary workspace.
- Storing sensitive operational data in repository files for implementation convenience.
- Claiming Robin is literally sentient or certain when it is operating from inference, summaries, or incomplete context.
- Beginning product implementation, database migration, Wiki editing, or roadmap creation from this capture alone.
