# CHANGE SURFACE — Impact map template

> Inert starter: adapt to the assigned subject. Maps where behavior, information or coordination may need to change. Inclusion does not authorize modification, prove a dependency or establish completed work. No surfaces are mapped here.

Use `CS-` IDs by concern rather than one per file. H2 categories distinguish surfaces; H4 subsections inside records may separate producers, consumers, wiki targets or verification. Required bold-label bullet fields: **Category**, **Status**, **Source**, **Targets**, **Relationship**, **Basis**, **Evidence**, **Dependencies**, **Verification**, and **Related**. Status is identified, candidate, deferred, or superseded; this is mapping status, not implementation status. Evidence distinguishes inspected facts, inferred impact and unknowns.

Targets may be code, wiki pages, contracts, tests, configuration, data formats, workflows or tickets. Relationship names how they participate: producer, consumer, candidate change target, documentation, verification or coordination. Basis links the intent, issue, proposal or decision that makes the surface relevant. Dependencies name prerequisites, affected consumers and observable release conditions where known. Link contract and reference IDs; do not duplicate their definitions here. Keep delivery/acceptance in the responsible build or task records.

## Product Behavior and Interaction

Which user journeys or observable outcomes may change? Include downstream behavior and adjacent expectations even when the exact implementation files are still unknown. What should stay the same?

## Code, Services and Configuration

Where does the affected behavior currently live, and which producers and consumers share it? Identify code, services, events, configuration and lifecycle boundaries. A list of files is not a complete blast-radius analysis; preserve uncertain edges for investigation.

## Data and Compatibility

Which persisted formats, schemas, migrations, integrations or versions might be affected? What compatibility or recovery questions could alter the plan? Link substantial schema definitions rather than embedding another competing copy.

## Wiki and Documentation

Which wiki pages, standards, guides, examples or source-of-truth statements would need review? Describe the candidate action and why, preserving the distinction between current behavior and target behavior. A code change and its documentation update are separate obligations with separate evidence.

Keep modest wiki impact here. If an independently maintained WIKI_IMPACT document is warranted later, move detailed records there with provenance and retain links here rather than duplicating the plan.

## Planning, Tickets and Workflows

Which existing SPECs, tickets, agent instructions, handoffs or parallel assignments depend on this change? Identify potential conflicts and required coordination. A mapped ticket is not automatically covered, superseded or closed.

## Verification and Operational Surfaces

Which smoke scenarios, regression checks, fixtures, runtime environments, packaging or operational procedures need attention? Link proposed checks and actual evidence separately. Record any coupled release or adoption condition that prevents safe parallel work.
