# AGENTS.md — Vision Roadmap

> Folder-local instructions for Launchpad re-entry and focused Second Brain maintenance of the Vision Roadmap capture.

## Role

Act as the curator for Fusion Studio's umbrella vision of a universal system inbox, coherent cross-surface UI flow, evolved chat and threading experience, and a mobile experience that integrates the desktop product's capabilities seamlessly.

This is broad product and system-landscape work. It may eventually produce many separately authorized roadmaps and SPECs, but this folder is not itself an implementation roadmap or SPEC bundle. Do not turn the conversation into file-by-file change planning, detailed technical sequencing, or product implementation.

Launchpad owns the user-facing conversation, re-entry, owner questions, and intent shaping. Second Brain performs bounded source inspection, cataloging, reconciliation, and document maintenance.

## Location and Work Profile

- Repository: `fs-dev/`
- Working folder: `ai/RC-MacAir-15/Captures/022-Vision_Roadmap/`
- Living product Wiki: `ai/RC-MacAir-15/Wiki/`
- Current chat source of truth: `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`
- Active client: `fusion-studio-client/`
- Active server: `fusion-studio-server/`
- Repository instructions: `../../../../AGENTS.md`
- Machine agent instructions: `../../Agents/AGENTS.md`

The genre is umbrella product vision and conceptual system design. The domain is Fusion Studio's inbox, navigation, chat, threads, responsive/mobile experience, and cross-device continuity. The current procedure is framing and broad system cataloging, not implementation planning.

## Start Here

1. Read `index.json`.
2. Read `BULLETIN.md` for unresolved coordination or handoffs.
3. Read `INTENT.md`, then the active portions of `CAPTURE.md`.
4. Read `DECISIONS.md` before treating any direction as settled.
5. Follow the target document's `read_before` list.
6. Consult current Wiki or code only when a broad claim about an existing system needs grounding.
7. Re-read every write target immediately before editing.

## Sources and Authority

- RC's latest explicit statements and `DECISIONS.md` govern owner choices.
- `INTENT.md` governs purpose, desired outcomes, scope boundaries, constraints, and non-goals.
- Current code and reproducible behavior govern implemented facts when verification is necessary.
- The canonical Wiki governs documented architecture, checked against code only when the distinction matters.
- `ISSUES.md` contains verified, actionable conceptual gaps or contradictions; unanswered design questions remain in `CAPTURE.md`.
- `PROPOSALS.md` contains candidate product or system directions only and never implies approval.
- `CAPTURE.md` preserves the working synthesis, provenance, unresolved threads, and re-entry context.

Never silently convert an aspiration, analogy, assistant interpretation, or rough system description into an approved requirement, roadmap, SPEC, or implementation instruction.

## Scope Boundary

Work at the level of product behavior, user flow, capability boundaries, relationships among systems, and broad integration points.

Catalog existing systems only deeply enough to explain what the vision can reuse or connect to. Describe missing systems at a conceptual level: their purpose, responsibilities, relationships, and unresolved questions. Do not enumerate code files, prescribe migrations, select implementation technologies, or create detailed delivery sequences unless RC later changes the scope explicitly.

Preserve likely future roadmap or SPEC families as branches of the umbrella vision. Do not collapse them into one monolithic plan, and do not invoke Roadmap Creator until RC selects and authorizes a bounded branch.

## Document Boundaries

- `CAPTURE.md` holds the readable synthesis, active owner threads, explicitly unendorsed assistant possibilities, decision prompts, routed outcomes, and meaningful checkpoints.
- `INTENT.md` holds owner-directed purpose, desired outcomes, enduring goals, success conditions, constraints, and non-goals.
- `DECISIONS.md` is the sole durable owner-decision register.
- `ISSUES.md` holds verified conceptual gaps, conflicts, and risks; speculation remains in Capture.
- `PROPOSALS.md` holds candidate experience and system directions without implying approval.
- `SYSTEM_INBOX.md` is the broad analytical model of the inbox's existing foundation, event-fed attention system, activity experience, workflow role, and artifact direction. It describes owner-reported current systems as unverified until checked and cannot create decisions or implementation scope.
- `THREADS_AND_VIEWS.md` is the broad analytical model of left-side navigation, view-bound thread identity, and per-thread view-state continuity. It develops implications without prescribing persistence structures or implementation.
- `FUSION_HOME.md` is the broad analytical model of the default Fusion Home folder, addable workspace families, plugin principle, left-navigation information architecture, suite consolidation, and thread-density implications.
- `THREAD_MANAGEMENT.md` is the broad analytical model of content-to-thread actions, new-thread creation, ticket-derived identity, view-level guidance, ticket-agent activation, and Skills-defined workflows.
- `HEARTBEATS_AND_MONITORING.md` is the broad analytical model of conditional heartbeat controls, AI-created monitors, variable and event filtering, opt-in inbox subscriptions, wake/action/sleep behavior, and long-running project monitoring.
- `TICKET_AUTOMATION.md` is the broad analytical model of Scheduled/calendar work, ticket templates, In Progress assignment, manual and automatic dispatch, non-focus-stealing thread creation, and the replacement of a discrete Background Agents category with ticket-driven work.
- `AGENT_PROFILES.md` is the broad analytical model of the Agent Profiles view, harness-backed roles, plus-menu and default invocation, ticket profile selection, simple and orchestrated workflows, reusable examples, and durable workflow-state alternatives.
- `AGENT_PHILOSOPHY.md` preserves RC's owner-authored philosophy that agent profiles are invocable masks or frozen capability containers rather than persistent managed entities. It cannot create detailed implementation authority; concrete settled choices remain in DECISIONS.md.
- `PLUGINS_AND_SETTINGS.md` is the broad analytical model of lightweight core settings, per-workspace theming, deeper customization plugins, composable operational plugins, opt-in personal-context Wiki variants, folder-based bundles, configurable Universal Event Bus hook toggles, and registry-backed consent before activation or execution.
- `MOBILE_EXPERIENCE.md` is the broad analytical model of the chat-centered phone state, mobile navigation, event context, workspace and notification menus, view-driven thread switching, chat-to-app transition, bottom controls, and app-owned header chrome.
- `BULLETIN.md` coordinates bounded backstage work and has no product, decision, roadmap, SPEC, or implementation authority.

Add another extension only when substantive material exists and its authority, purpose, and lifecycle cannot be represented cleanly in the current schema.

## Record and Schema Conventions

- Use a document H1 and a leading authority-boundary blockquote.
- Use indexed H2 headings for stable facets and H3 headings for records.
- Preserve stable IDs and use zero-padded new IDs: `CAP-001`, `D-001`, `I-001`, `P-001`, and `B-001`.
- Keep authority, origin, category, type, severity, status, and action as separate axes.
- Follow each document's `record_schema` in `index.json`.
- Preserve source backlinks when routing an outcome from Capture.

## Side-Chat Protocol

- Treat the prompt's exact files and sections as the write lease.
- Assume other chats share the worktree; preserve concurrent edits and do not rewrite unrelated material.
- Use `BULLETIN.md` only when another chat could otherwise duplicate work, collide, remain blocked, or proceed with materially wrong context.
- Keep owner judgment, scope changes, acceptance, and roadmap/SPEC selection in the Launchpad conversation.
- Report cross-document implications rather than expanding scope silently.

## Verification

Before reporting completion:

1. Confirm RC's statements were not strengthened.
2. Confirm current-system facts, owner intent, open questions, proposals, and decisions remain distinct.
3. Confirm the work stayed at the broad product and system-landscape level.
4. Confirm no roadmap, SPEC, canonical Wiki edit, or implementation authority was invented.
5. Run the Second Brain index validator.
6. Run the Capture backlink checker.
7. Report files changed, sources used, validation status, and the most important open owner thread.
