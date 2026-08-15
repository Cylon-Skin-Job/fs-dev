# Consensus Mode

Status: CAPTURE — next build target; version 1.0 of the second brain
Captured: 2026-07-13

## What It Is

A view: an AI on the left, an AI on the right, and a panel between them that is just an **iframe**. The artifact rendered in the middle is the **consensus object** — the two AIs don't agree in the abstract, they converge on a thing, and the iframe makes the thing visible while it's being worked over.

This is the adversarial-convergence loop (`../013-Convergence_Loops/adversarial-document-convergence.md`) given a body: interviewer on one side, builder on the other, and the shared folder that made the Deepseek loop work is now a live render the user watches evolve. It is also the second brain's fronting/background split made visible (`../014-Second_Brain_Chat/second-brain-chat-vision.md`) — the background builder isn't hidden; it's the right-hand panel.

## Mechanics

- **Left AI** — conversational, faces the user.
- **Right AI** — builder; its sub-agents own their little domains and edit **HTML instead of Markdown**, with very quick access to the rest of the artifacts and very easy linking. Becomes its own little mini knowledge graph.
- **Middle panel** — iframe rendering the current artifact. User can paste stuff in.
- **A bunch of templates** — same principle as wiki tickets: the template is the contract; sub-agents populate known shapes instead of designing pages. This keeps a hundred generated artifacts feeling like one product.

## Why HTML (not Markdown)

1. **Links make it a graph without a schema.** HTML artifacts linking to HTML artifacts, rendered clickable, are a navigable knowledge graph built as a side effect of authoring. Hierarchy first, edges later — the wiki progression, with the edges as UI.
2. **The iframe is a privilege boundary, not just a display.** Sandboxed by construction: an artifact can render, link, and look good, but can't touch the app, stores, or other panels. The capability model gets its read-only render tier for free; anything an artifact wants to DO must cross a controlled boundary (ticket principle, enforced by the browser).
3. **The theme system makes generated pages native.** HTML artifacts styled entirely through CSS variables inherit the user's theme automatically — the Universal Design Spec token system was quietly built for this.

## Office / Non-Coder Use

Not just for planning code. Usable like Canva: a layout with clickable links, each opening other attached HTML artifacts.

Distinguished ancestor: **HyperCard** — stacks of linked cards, authorable by non-programmers, mixing content and light interactivity. Consumer framing: *HyperCard where the cards write themselves while you talk.* Slots directly into the platform vision (home-office suite: docs, brochures, email, sheets) — linked HTML artifacts become the universal content type, serving both a developer squaring wiki articles and someone laying out a flyer.

## Design Rule — Single Writer in the Middle

Decide early who owns writes to the middle panel. If both AIs mutate the artifact directly, it's the two-timelines problem from the sync design. The clean answer: the artifact is a file; the right AI's builder owns writes; the left AI files requests; versions between edits; nothing lost. Consensus mode works **because** the middle is single-writer with visible history.

## Projects — Scoped Thread Histories

A **projects dropdown** at the top of the view. Threads live only in this view, attached only to their project — an isolated thread history just for these artifacts. Conversations may happen elsewhere, but the working threads are contained. It's a project-management-shaped idea: each project holds its artifacts, its thread history, its issues queue, its templates.

**Why this matters beyond organization:**
- **It partially answers the domain-scoped recall problem** (open thread below): the project is the domain container. Recall, artifacts, issues, and contradictions inherit the boundary — the second brain for a project feeds only on that project's threads, so drift is bounded per-corpus instead of needing a global relevance model.
- Third appearance of the same settled scoping instinct: workspace-scoped chat threads in fs-dev (RCC-0095), data containers in federation, project-contained threads here. Threads are belongings of a scope, never a global list — effectively a standard now.
- Consumer framing: a PM tool where the documents write themselves during conversation. "Project" is instantly understood and explains thread containment without a manual.

## Relationship to the Second Brain

Consensus mode is **v1.0 of the second brain** — it integrates aspects of it, but the point is to *watch the thing out in the open*: the artifact pipeline, recall, and curation running visibly in a panel instead of abstracted on a server. Same reason the wiki was built as markdown and folders — visibility is the debugging surface for architecture.

## Open Threads

>> Different domains in different contexts want different types of information pulled up — the recall/injection tuning problem, observed live in this view. Projects (above) provide the coarse boundary; what does finer-grained, context-scoped recall configuration look like *within* a project?
>> Template library: which shapes first? (Planning doc, comparison, layout/flyer, linked index card?)
>> How does the user's paste-in get classified into the artifact graph?
>> Left AI → right AI request format: first consumer of the ticket-style request boundary inside a single view?
