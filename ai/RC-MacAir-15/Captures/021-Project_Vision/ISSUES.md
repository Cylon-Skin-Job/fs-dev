# ISSUES — Project Vision

> Verified actionable product risks, gaps, and architectural inconsistencies identified from RC's stated experience and current direction. These are not implementation defects unless current sources later verify them as such.

## Trust, Consent, and Privacy

### I-001 — Invisible personal profiling creates a creepiness and trust risk

- **Category:** trust
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's experience pausing Raven OS
- **Related:** D-006, P-001, PRIVACY_AND_DATA.md

Entity extraction, relationship learning, routine detection, and historical enrichment can feel like surveillance when performed without visible intent, boundaries, or review.

### I-002 — Memory escalation is difficult to explain to ordinary users

- **Category:** consent
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** RC's Project Vision blurt
- **Related:** CAP-002, D-016, D-017, PRIVACY_AND_DATA.md

The product does not yet have a plain-language way to disclose that ordinary questions receive a broad first pass while requesting deeper investigation also makes the subject durable for future recall. That convention must be understandable without turning conversation into schema setup.

### I-003 — Sensitive data can escape through repository-shaped storage

- **Category:** privacy
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's data boundary and distrust concern
- **Related:** D-004, D-005, PRIVACY_AND_DATA.md

JSON files, fixtures, logs, generated exports, and workspace folders can accidentally enter version control unless the database-only and ignored-by-default boundaries are enforced structurally.

### I-004 — Entity and relationship memory can be wrong or harmful

- **Category:** privacy
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's proposal to learn about friends and maintain entity timelines
- **Related:** CAP-008, D-018, P-010

Inferred facts about people, relationships, or sensitive events can be inaccurate, stale, context-dependent, or inappropriate to surface. Provenance, correction, confidence, access, and deletion rules are not defined.

### I-013 — Cross-workspace search needs enforceable consent scope

- **Category:** privacy
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** D-010 and RC's cross-workspace history direction
- **Related:** CAP-020, PRIVACY_AND_DATA.md

The system has no defined capability model for which assistant may search which workspace, source class, time range, or conversation, nor how the user sees and revokes that grant.

### I-019 — Repeated schema offers could become coercive or noisy

- **Category:** consent
- **Type:** risk
- **Severity:** medium
- **Status:** resolved
- **Source:** D-011 and RC's first-layer recall proposal
- **Related:** CAP-002, D-016, D-017, MEMORY_MODEL.md

Resolved at the product-direction level by superseding D-011. Robin offers deeper investigation rather than repeatedly asking users to create categories, entities, databases, or graph structures. I-002 retains the narrower need to explain that a requested deep investigation becomes durable recall.

## Information and Memory Architecture

### I-005 — A universal human-experience taxonomy will become brittle

- **Category:** memory
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's difficulty predicting categories for the sum of human experience
- **Related:** CAP-003, P-004, P-006, MEMORY_MODEL.md

A fixed schema can overfit its original use cases and make new domains awkward. Completely free categorization can also fragment retrieval and interoperability.

### I-006 — Optional modules need schema-safe installation and removal

- **Category:** schema
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** RC's modular bookkeeping, CRM, Docs, email, calendar, code, and research vision
- **Related:** CAP-005, P-003

The stable platform kernel, module boundaries, migrations, dependencies, and data-retention behavior have not been defined.

### I-007 — Catch-up and continual enrichment need a transparent execution model

- **Category:** memory
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** RC's overnight catch-up and automatic-forward-processing concept
- **Related:** D-007, P-002

Historical-window selection, run manifests, progress, retries, partial failure, user review, and incremental scheduling remain unspecified.

### I-008 — Retrieved summaries can drift from grounded sources

- **Category:** memory
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's requirement for factual narrative and grounded lookup
- **Related:** CAP-003, CAP-007, P-004 through P-008, MEMORY_MODEL.md

Semantic summaries, entity profiles, narratives, and graph edges can lose nuance or become stale unless source identity, freshness, confidence, and correction propagate through derived layers.

## Product and Runtime Architecture

### I-009 — Broad-domain context assembly can make specialist agents slow

- **Category:** performance
- **Type:** risk
- **Severity:** medium
- **Status:** open
- **Source:** RC's concern about burdening code agents and research assistants
- **Related:** P-007, P-008

Robin may need context spanning workspaces and domains, but loading or checking everything inline would make conversations sluggish and pollute specialist context.

### I-010 — The current System Manager workspace concept conflicts with Robin's placement

- **Category:** architecture
- **Type:** inconsistency
- **Severity:** high
- **Status:** open
- **Source:** RC's decision to remove System Manager as a workspace; repository contains System_Manager
- **Related:** D-002, SYSTEM_MANAGER.md

The existing workspace-shaped identity and bundled files will eventually need migration or retirement, but no code or filesystem migration is authorized by this capture.

### I-011 — The system manual has no defined lifecycle or authority model

- **Category:** architecture
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** D-003 and CAP-004
- **Related:** SYSTEM_MANAGER.md

The manual's schema, source hierarchy, version history, edit authority, caching, retrieval, and relationship to live system state remain undefined.

### I-012 — Cross-workspace event and notification semantics are undefined

- **Category:** architecture
- **Type:** gap
- **Severity:** medium
- **Status:** open
- **Source:** RC's Robin notification and ticket concept
- **Related:** CAP-006, D-007, P-009, SYSTEM_MANAGER.md

Event producers, routing, severity, badge counts, grouping, silence scopes, acknowledgement, retention, and source grounding need a common contract.

### I-014 — Ticket containers need a lifecycle and ownership contract

- **Category:** architecture
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** RC's Wiki-container concept
- **Related:** CAP-018, P-012, WORKFLOW_MODEL.md

Container creation, first-agent hydration, inherited schema, write leases, specialist handoff, evidence, validation, and closure state are not defined.

### I-015 — AFK and interactive execution can race or diverge

- **Category:** architecture
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's dual-mode ticket concept
- **Related:** CAP-019, P-013, WORKFLOW_MODEL.md

Opening an active ticket for user interaction could conflict with an autonomous agent unless one shared state machine controls leases, pauses, checkpoints, and resume behavior.

### I-016 — Downloaded and user-edited agents expand the trust boundary

- **Category:** architecture
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** D-015
- **Related:** CAP-021, P-019, WORKFLOW_MODEL.md

Agent templates can carry prompts, tools, triggers, and data scopes. Download and in-place editing require versioning, review, sandboxing, rollback, and permission controls.

### I-017 — Portable apps and views lack a shared rendering contract

- **Category:** architecture
- **Type:** gap
- **Severity:** high
- **Status:** open
- **Source:** RC's mobile, web, Robin overlay, and workspace-view concept
- **Related:** CAP-020, P-015, INTERACTION_MODEL.md

Shared state and components are plausible, but navigation, layout slots, lifecycle, commands, breakpoints, and host capabilities are not defined.

### I-018 — Shared internal data does not imply shared permission

- **Category:** privacy
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's plan for multiple apps to share internal database data
- **Related:** CAP-020, P-018, INTERACTION_MODEL.md

Apps representing related objects may need shared data, but ambient database access could bypass workspace, source, consent, and sensitive-data boundaries.

### I-020 — Semantic routine aliases can collide or misfire

- **Category:** architecture
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's “Status” and “update my flash cards” invocation examples
- **Related:** CAP-029, P-021, ROUTINES_MODEL.md

Short or natural-language phrases may match multiple routines, ordinary conversation, or stale aliases. Starting the wrong stateful workflow could dispatch workers, expose context, or write data before the ambiguity is visible.

### I-021 — Routine composition expands cross-app and script authority

- **Category:** architecture
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** D-023 and RC's app, API, tool-call, and custom-script direction
- **Related:** CAP-030, P-018, P-022, ROUTINES_MODEL.md

A routine that can call apps, tools, APIs, and scripts spans secrets, read scopes, writes, failures, and data ownership. Without an explicit capability and transaction contract, conversational convenience could become ambient System Manager authority.

### I-022 — Routine records can overstate completion or certainty

- **Category:** trust
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's household, vitamin, hydration, and flashcard examples
- **Related:** P-020, P-022, P-024, ROUTINES_MODEL.md

A user's acknowledgement, a sensor or app record, an agent observation, and an inference are not equivalent evidence. Treating “yep, that's done” as verified completion can distort health, habit, learning, or other downstream records.

### I-023 — Background refinement can silently change routine intent

- **Category:** consent
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** D-024 and RC's background-refinement direction
- **Related:** CAP-031, P-023, P-025, ROUTINES_MODEL.md

Agents reviewing chats and prior runs may suggest useful changes, but automatic edits to steps, heuristics, schemas, triggers, or app interactions could drift from the user's intent or broaden behavior unless authority, review, versioning, and rollback are explicit.

### I-024 — Proactive heartbeat reports can become stale or noisy

- **Category:** architecture
- **Type:** risk
- **Severity:** medium
- **Status:** open
- **Source:** RC's hourly build and orchestrator monitoring idea
- **Related:** CAP-033, P-026, ROUTINES_MODEL.md, SYSTEM_MANAGER.md

Polling on a fixed cadence can repeat unchanged status, report stale snapshots, miss faster failures, or flood Robin when many runs are active. Status needs source timestamps, materiality thresholds, grouping, and event-driven wakeups where available.

### I-025 — Resume, retry, restart, and worker replacement can duplicate work

- **Category:** architecture
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's proposal to restart orchestrators through the System Manager
- **Related:** CAP-033, P-027, WORKFLOW_MODEL.md

Continuing from a checkpoint, retrying one failed step, restarting an entire run, and replacing a dead worker have different effects. Ambiguous controls or stale leases could duplicate mutations, discard progress, or create competing active runs.

### I-026 — Robin must not fabricate or broaden owner answers

- **Category:** consent
- **Type:** risk
- **Severity:** high
- **Status:** open
- **Source:** RC's proposal to answer an orchestrator through the System Manager
- **Related:** CAP-033, P-027, SYSTEM_MANAGER.md

Robin may transport and contextualize an owner's answer, but summarization, inferred intent, or prior preferences must not be represented as a new owner decision. The question, response, transformation, recipient, and granted continuation scope need explicit provenance.
