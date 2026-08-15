# MEMORY MODEL — Personal Knowledge and Recall

> Working analytical model derived from RC's Project Vision. It organizes candidate memory layers and retrieval behavior; DECISIONS.md remains authoritative and PROPOSALS.md owns candidate lifecycle.

## Cognitive Scope

The desired assistant maintains three kinds of awareness:

1. what is relevant today;
2. what remains relevant across time; and
3. where to retrieve anything relevant that is not present in immediate context.

Its scope may include personal routines, calendar, communications, contacts, friends and other entities, workspaces, codebases, research, documents, business administration, creative ideas, tasks, decisions, and the history of the user's relationship with AI.

Awareness does not mean loading everything into every prompt. It means retaining navigable representations, provenance, and the ability to recognize a context gap.

## Memory Layers

The blurt implies several complementary layers:

- **Source records:** original chats, messages, events, calendar items, documents, research papers, code, tickets, and database records.
- **Fact storage:** small source-linked assertions with entity, time, confidence, and correction history.
- **Categorical summaries:** indexable summaries by topic, project, subject, entity, or period.
- **Semantic memory:** relationships, patterns, recurring concepts, and cross-source synthesis.
- **Entity and timeline views:** evolving information about a person, organization, subject, or relationship across time.
- **Narrative memory:** grounded accounts of how ideas, projects, and the user-assistant relationship developed.
- **Fast recall:** a small high-salience layer for information likely to matter in the current period or conversation.
- **System awareness:** indexes or graph nodes that tell Robin what exists even when the underlying content is not loaded.

Each derived layer must retain links to the records from which it was assembled.

## Hierarchy and Graph

A bounded hierarchy can provide understandable navigation:

1. broad category;
2. subcategory;
3. focused topic, subject, entity, or timeline;
4. links to actual chats, events, records, sources, or artifacts.

The hierarchy is not the only retrieval structure. Graph edges can connect concepts across branches, such as a person to a project, a decision to its originating conversation, or a research claim to several papers.

The hierarchy should stay shallow enough to browse. The graph should remain source-linked and typed enough to explain why an edge exists. The AI may invent local categories when the material does not fit a global vocabulary, but shared metadata should preserve interoperability.

The primary durable unit is a **memory node**: a database representation of the Launchpad and Second Brain container pattern for one topic, entity, project, or other subject. Its internal records can perform the same jobs as a folder's synthesis, sources, intent, decisions, issues, proposals, domain extensions, provenance, and earned schema. A large node may contain substantial subnodes of its own. Graph edges connect these maintained containers; they do not replace their internal structure.

Users should have a place to inspect a node, navigate its internal branches, trace sources, correct or remove information, and understand why it was refreshed.

Routines extend this same model into action. A routine can be attached as an executable facet or subnode of the topic, entity, project, health, learning, or other nodes it serves while retaining its own definition and run history. The Routines app is a cross-cutting catalog and runner for those attachments, not a separate memory architecture. Routine executions may update the attached node's context and project canonical results into domain apps without collapsing those records into one store.

## Retrieval and Promotion

A candidate staged retrieval flow is:

1. check immediate context and fast recall;
2. perform a broad, proportionate first-pass search across sources already available for the question;
3. synthesize an immediate answer with uncertainty and provenance;
4. offer to investigate the subject more deeply when additional work could materially help;
5. if requested, seed a bounded background-agent swarm with the initial search and conversation;
6. reconcile the grounded result into the subject's database-backed memory node;
7. make that node easy to recall in later conversations; and
8. refresh its summaries, tags, schema, and internal subnodes whenever the subject naturally recurs.

Conversational reuse may promote information into fast recall. Promotion should not erase the source layer and should eventually support decay, demotion, correction, and user pinning.

An ordinary first-pass answer does not automatically create a durable node. Asking for deep investigation does: it is treated as intent to remember the subject, not as permission to read new source classes. Source access, sensitive-data processing, remote-provider use, and cross-workspace retrieval remain separate capabilities.

## Enrichment Pipeline

Initial onboarding may require an explicit, observable catch-up across a user-approved historical window. Later enrichment may run incrementally from events or schedules.

Candidate operations include:

- entity extraction and resolution;
- fact and timeline extraction;
- topic and semantic classification;
- summary creation and refresh;
- cross-link and edge creation;
- cognitive-domain tagging of chat pairs;
- contradiction or stale-information detection;
- salience scoring and fast-recall promotion; and
- notification or review-item creation.

Background AIs may derive narrower tags, schemas, subnodes, search scopes, and update schedules from the subject and the user's conversation without asking the user to design the structure. Each derived structure should record its source scope, evidence rules, refresh trigger or cadence, output shape, review threshold, and retirement path. The ability to organize a node does not authorize expanding the underlying data scope.

The previously designed cognitive-domain schema must be recovered before it is treated as a contract. RC currently recalls examples resembling refine/define/shape, brainstorm/ideate, analyze/research, and ponder/imagine/philosophize.

## Source Grounding and Narrative

Imported ChatGPT history is both a searchable knowledge source and the primary evidence for a future narrative about RC's development with AI.

The narrative should:

- preserve chronology without pretending memory is complete;
- distinguish direct quotation, paraphrase, source claims, and later interpretation;
- link factual explanations of models, context, tokens, and memory to accurate sources;
- show how Raven, Fusion Studio, Launchpad, Second Brain, and Robin evolved; and
- remain revisable when newly imported conversations change the account.

This body of work may later earn CORPUS.md, CLAIM_MAP.md, or a dedicated narrative folder after the source conversations actually exist.

## Open Design Questions

- How does the Launchpad folder contract map into database objects for nodes, sections, records, sources, subnodes, tags, edges, salience, and provenance?
- Which categories are global, which are domain-provided, and which may be invented locally?
- How are contradictory facts, changing relationships, uncertain identity matches, and deletion propagated?
- How do recency, frequency, conversational reuse, user pinning, and importance affect fast recall?
- When is a graph/index lookup sufficient, and when must Robin inspect raw sources?
- Where could recursive language-model lookup or high-throughput inference safely help?
- What context-packet contract keeps fronting and specialist agents fast?
- How are enrichment runs audited, reverted, paused, resumed, and reviewed?
- How are executable routine attachments indexed, inherited, detached, and recalled across related memory nodes without duplicating their state or permissions?
