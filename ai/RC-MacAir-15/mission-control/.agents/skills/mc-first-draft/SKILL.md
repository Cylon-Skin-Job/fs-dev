---
name: mc-first-draft
description: Author a provisional planning skeleton from an assigned conversation, documents, existing draft or Launchpad packet with candidate vertical slices, smoke scenarios, source constraints, and decision or research gaps. Use for early shaping before executable SPEC creation; does not approve roadmaps or implement product code.
---

# First Draft

This remains the leaf author. For a managed draft-only process, use [mc-draft-supervisor](../mc-draft-supervisor/SKILL.md); it assigns the shared stage and independent validation. Roadmap Creator assigns its draft stage directly. Do not acquire supervisor or dispatch authority from either route.

Make the packet concrete enough for a productive shaping conversation. Completion means a useful draft with visible uncertainties, not an approved roadmap or an executable SPEC. Use the assigned domain folder and output path; do not take over its fronting session or central MC records. Follow the shared [session contract](../../../session-contract.md).

Use the shared [investigation contract](../../../investigation-contract.md) to frame recommended research requests. The assigned manager (Launchpad or an authorized planning stage orchestrator) selects and assigns investigations; this role returns questions and their planning consequences without dispatching workers. Under staged creation, also read the [shared planning contract](../mc-roadmap-creator/references/planning-contract.md) and return to that stage manager. A missing fact that invalidates the framing belongs in a pre-draft readiness question; other uncertainties can remain visible in the skeleton for follow-up.

If the handoff includes an inline `mc-preflight` report, verify its input basis and carry its unresolved questions into the draft. Its readiness label is not approval or a substitute for grounding the sources below. A missing report is not a reason to discard a separately authorized direct assignment; check input sufficiency and return the minimum missing input when necessary.

## Ground the skeleton

Read the prepared packet, applicable AGENTS.md, referenced owner decisions, current User Preferences, relevant wiki overview/contracts, and the repository's standards router. Resolve the preferences source through the shared planning contract or explicit packet; a missing source is a visible constraint gap. Record exact source paths and revisions or observation dates. Separate owner direction, approved contracts, current implementation evidence, proposals, and unknowns. File age alone does not establish supersession. Expose contradictions rather than choosing intent silently.

In Fusion Studio, resolve the active machine's standards router at `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Read the router fully and the routed standards pages that can constrain the proposed work. For chat/thread/harness work, read the active Chat wiki overview required by the repository AGENTS.md. Do not substitute an old Capture or an inactive machine's wiki for current authority. If a required source is missing, record its impact; do not claim the affected constraint is checked.

Before framing a product choice as unanswered, check the proposal/decision chain and applicable contracts; use [bounded conversation evidence](../../../conversation-evidence.md) when original wording or later revisions could resolve it. Preserve exact available locators and retrieval limits in the draft.

Use targeted source inspection only when authorized and needed to answer a question that could change the skeleton. Otherwise return a bounded research request naming the question, likely source, evidence needed, and planning decision it affects. A First Draft assignment does not authorize deep codebase exploration or spawning researchers. Record who should resolve each gap: owner, domain session, or bounded technical investigation.

## Depth rule

Describe observable outcomes and major boundaries now. Defer file/function plans, exhaustive edge cases, detailed test commands, estimates, task checklists, and final SPEC boundaries until the relevant intent and architecture are settled. Preserve such details when the packet already establishes them; do not erase real constraints for brevity.

Go deeper only when an uncertainty could change scope, slice boundaries, ordering, compatibility/data safety, shared ownership, or the observable success condition. Resolve it from available authoritative evidence or mark the affected structure conditional. Do not invent a solution to make the draft appear finished.

## Draft structure

Use the domain's existing record conventions. One draft document is usually sufficient; link existing ledgers rather than duplicating them. Include:

1. **Status and basis:** `FIRST_DRAFT`, packet/source revisions, approved outcomes, scope boundaries, and what is still proposed.
2. **Capability skeleton:** tentative capability groups and milestone/SPEC boundaries only where useful; each proposed outcome maps back to intent. Show uncovered intent. Do not force a fixed number of SPECs or roadmaps.
3. **Candidate slice cards:** small end-to-end increments using the format below. Give candidates stable local IDs without presenting them as approved SPEC/slice identifiers.
4. **Dependencies and likely impact:** shared contracts, providers/consumers, ordering constraints, possible parallel work and conflicts. Mark each claim observed, inferred, or unknown and link its basis. Unknown overlap cannot justify declaring parallel work safe.
5. **Decision/research queue:** prioritized questions, affected candidates, why each matters, resolver, and whether it blocks shaping or must be settled before release. Deferral requires a named later resolution point; disclosed gaps do not become release-ready by being listed.
6. **Return:** what is ready to discuss, what remains conditional, recommended next action, changed paths, and checks actually performed.

### Candidate slice card

Keep each card to a short paragraph or a handful of bullets:

- **Outcome:** actor or system trigger → observable result, tied to a source requirement or labeled proposal.
- **End-to-end path:** the major boundaries crossed, such as UI → service → storage → displayed result. Use relevant boundaries, not a requirement to touch every layer.
- **Prerequisite:** capability/contract needed first, with provider and evidence if known. State what observable condition would make it available; use an open question when that condition is undecided.
- **Smoke scenario:** starting condition → action → visible evidence of success. Name a significant failure behavior if known; identify undefined failure intent as a question. This is a proposed check, never evidence of a passed test.
- **Nearby regression and constraints:** an existing behavior to preserve, applicable wiki/standards constraints, and the main suspected shared surface.
- **Open question / excluded scope:** the decision or lookup that could change this card, and what this increment deliberately leaves for later.

A vertical slice delivers a narrow observable capability across the required boundaries. A database-only or UI-only task is not automatically a vertical slice. If foundational work is necessary, label it an enabler, identify its consuming slice and verification idea, and explain why it cannot reasonably be included there. Do not invent a user-visible result for infrastructure.

Illustrative only: “A user saves one setting and sees the same value after reopening the screen.” The path could cross UI, service and storage; the smoke scenario is set → save → reopen → observe persistence; a nearby regression is another setting remaining unchanged. Scope selection and invalid-value behavior remain questions unless established by the packet. This example is not product scope.

## Bring constraints in progressively

| Stage | Appropriate specificity |
|---|---|
| First Draft | Relevant wiki contracts and routed standards; suspected affected subsystems, consumers, data/compatibility risks and concurrency conflicts; candidate slices and observable smoke scenarios. Explicit evidence gaps. |
| Shaping and bounded research | Resolve questions that change structure; verify current behavior, shared ownership and dependencies; revise the proposed boundaries with evidence. |
| SPEC/Roadmap Creator | Trace affected code/contracts and regression surfaces; define executable slices, exact prerequisites, failure/migration behavior, checks and pass criteria using current sources. |
| Independent Release Validation | Independently assess the release candidate's intent coverage, standards, dependency/blast-radius analysis and verification evidence. Use `mc-planning-validator` in release mode; this is separate from the draft stage gate and owner approval. |

Blast radius starts with likely affected behavior and consumers, including shared state, persistence, APIs/events, lifecycle and concurrent changes where relevant. A code dependency list alone does not establish user impact. Smoke scenarios demonstrate basic capability; later focused regression, failure, migration or security checks remain necessary where the actual change warrants them. Never claim smoke coverage proves the complete impact is safe.

## Draft validation and handoff

Before returning, check that every candidate traces to intent or is labeled proposed; describes a meaningful end-to-end outcome or justified enabler; has observable smoke evidence or a visible testability gap; identifies plausible prerequisites/impact; and exposes decisions that could change its structure. This is a self-check of draft usefulness. Return the exact assignment, current source/output revisions, self-check evidence and open questions for independent worker-handoff review under the [shared planning contract](../mc-roadmap-creator/references/planning-contract.md). The accountable manager assigns that reviewer and later a separate draft-stage reviewer; the author does not dispatch either or certify its own pass.

Return `FIRST_DRAFT_AUTHORED` when the skeleton and gaps support a useful conversation, explicitly awaiting independent handoff review. `FIRST_DRAFT_READY_FOR_DISCUSSION` is the manager's status after worker and draft-stage validation; the leaf author must not claim it from a self-check. In a standalone assignment, return provisional work and the required review packet if no authorized manager/reviewer route exists. Return `NEEDS_INPUT` when the packet cannot support a meaningful skeleton, identifying the minimum missing input and retaining useful partial work. Open questions are expected; no status authorizes execution. Recommend discussion/research before handing the shaped packet to `mc-roadmap-creator`; do not invoke Creator, dispatch sessions, or start builds merely because the draft is authored.
