# WORKFLOW MODEL — Tickets, Containers, Agents, and Review

> Working synthesis of proposed semi-automated and in-the-loop workflows. DECISIONS.md remains authoritative and PROPOSALS.md owns candidate lifecycle; this document does not authorize ticket, Wiki, or agent-system changes.

## Containerized Ticket Work

A substantial ticket can own a folder-shaped working container rather than a single flat instruction record.

The container may hold:

- source evidence and triggering events;
- intent, decisions, issues, and proposals;
- domain-specific working documents;
- assignments and handoffs;
- edit or implementation artifacts;
- validation results and unresolved findings; and
- a durable outcome summary.

The first suitable AI to wake inside a new container can survey the triggering material, derive the local schema, populate the initial context, and then hand bounded work to the specialist agent.

## Wiki Update Lifecycle

A candidate Wiki-update lifecycle is:

1. Code merges without the corresponding Wiki changes.
2. A rule, user, fronting agent, or review process files a Wiki-update ticket.
3. The ticket creates a folder container with links to the merged change and affected documentation.
4. The first AI surveys the source, hydrates the container, and identifies authority, coverage, and contradictions.
5. A Wiki-edit agent receives a bounded assignment.
6. An orchestrator works through a checklist covering sources, document targets, links, terminology, and validation.
7. Remaining issues return either to another automated pass or to the user.
8. A clean pass closes the ticket with evidence and a concise outcome.

This reuses the Launchpad and Second Brain pattern without assuming that every ticket needs the full capture kernel.

## Fronting Agent Delegation

Fronting agents may eventually be able to:

- recognize that a durable ticket or container is warranted;
- explain the proposed scope to the user;
- generate the ticket with source links and authority boundaries;
- delegate independent work to background agents;
- maintain the user's conversational checkpoint;
- surface only decisions or blockers that require owner judgment; and
- reconcile results back into the visible ticket and conversation.

Ticket creation must not silently grant broader write, data, or implementation permission than the user supplied.

For conversational research, the fronting agent performs the initial broad search before delegation. If the user asks it to look deeply into the subject, that search and the surrounding conversation become the seed packet for a background-agent swarm. The swarm's reconciled output returns to the same conversation and to the subject's durable database-backed Launchpad container rather than becoming an unrelated report.

## AFK and In-the-Loop Modes

The same workflow can support two operating modes.

**AFK mode**

- The ticket proceeds through pre-authorized stages while the user is away.
- Agents stop at declared approval or confidence thresholds.
- Completed steps, changes, sources, retries, and remaining issues are visible when the user returns.

**In-the-loop mode**

- The user can open the active ticket and converse with its fronting agent.
- The agent presents bounded issues or choices at the stage where they matter.
- The user answers, clarifies, edits, or changes scope.
- The ticket resumes from that checkpoint rather than restarting.

The modes should share state and evidence. Entering the ticket interactively should not create a parallel workflow that races the AFK process.

A conditional supervisory routine can bridge the two modes. While AFK work is active, it observes authoritative run state on events or a configured heartbeat and reports material changes through Robin. When a run reaches an owner checkpoint, the user can answer in Robin and continue that same run rather than opening a competing execution path.

Continuation needs exact semantics: **resume** advances a paused run from its checkpoint; **retry** repeats a bounded failed step; **restart** creates a new attempt from a declared earlier boundary; and **replace** transfers a lease from one worker to another. Each action must preserve run lineage, idempotency, side-effect receipts, and the owner's granted scope.

## Validation and Owner Checkpoints

Validation can repeat autonomously within a bounded budget:

1. perform the edit or analysis;
2. run structural and source checks;
3. return remaining findings;
4. repair findings that do not require owner judgment;
5. stop with the smallest unresolved set; and
6. resume after the user answers or edits.

The system may return two remaining issues, accept user input, and run another pass until clean. It must distinguish deterministic validation failure, agent disagreement, low confidence, missing authority, and an actual owner decision.

## Background Worker Library

Robin can provide its own background-worker UI containing active and inactive templates for available work types.

- Active templates are installed and eligible for dispatch.
- Inactive templates remain discoverable without consuming runtime attention.
- Users can download additional agents.
- Users can modify installed templates in place.
- Templates can declare tools, scopes, triggers, confidence thresholds, output contracts, and compatible container kinds.
- A template change should be reviewable and may itself create a Robin notification.

Downloaded or edited agents must not inherit unrestricted data access merely because they are visible inside the System Manager.

## Recurring Apps and Scripts

An app may be a durable presentation around a recurring script or workflow.

Routines generalizes this pattern. A routine is an executable extension attached to appropriate memory nodes, with a durable definition, a separate identity for every run, and explicit projections into domain apps. It may guide a few conversational steps, assemble missing status through background workers, or adapt a learning workflow from accumulated state.

The Weekly Review example could:

- create a fresh checklist on schedule or request;
- include fixed recurring items;
- add heuristic prompts based on recent state;
- add items derived from actual database records;
- delegate safe background checks;
- preserve completion and deferral history; and
- surface exceptional items for user discussion.

The app, script, ticket container, and background workers should share one run identity so the user can see what generated each item and what happened next.

Routine background refinement may use authorized conversation and execution history to maintain issues, heuristics, schemas, and future suggestions. Automatic context refresh, routine-definition changes, scheduled invocation, and autonomous writes remain separate authorization levels.

## Open Design Questions

- Which ticket types earn containers and which remain flat records?
- Who may create a ticket automatically, and when must the user confirm first?
- What schema does the first AI derive versus inherit from the ticket type?
- How are AFK and interactive leases coordinated so agents cannot race?
- What checklist and validation budget applies to Wiki work?
- How are owner questions, confidence thresholds, and approval gates represented?
- How are downloaded or edited worker templates signed, sandboxed, versioned, and restored?
- What data and tool permissions attach to templates, containers, runs, and individual steps?
- How do recurring apps create tickets without flooding Robin with routine items?
- How do routine definitions, memory-node attachments, run leases, domain projections, receipts, and refinement workers share state without racing or duplicating work?
- What authoritative state and subscription contract lets supervisory routines monitor builds and orchestrators without relying on stale polling alone?
