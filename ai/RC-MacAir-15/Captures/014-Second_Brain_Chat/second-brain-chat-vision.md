# Second Brain Chat — AGI-ish Consumer Chat Vision

Status: CAPTURE — product vision; predecessor was a Firebase chat app with threading, abandoned at the memory-retrieval wall
Captured: 2026-07-13

## The Wall That Started It

Inline memory retrieval in a chat app is too error-prone: one model, mid-response, deciding whether to recall, what to recall, and how to weave it in — no checks on any of it. Basic RAG sends chunks and the AI awkwardly connects something to something else. Retrieval cannot live in the hot path of a chat turn.

## The Architecture

**Pay the comprehension cost at write-time, not read-time.** The second brain is a materialized view of the conversation.

### Write side — artifacts per turn
- Background models generate structured artifacts after every chat turn: "show me places to stay in France" → a typed piece of information in a structured artifact.
- Linked to chat ID; tags applied with weights (travel: 9).
- Stored in a shared artifact store attached to the thread, **versioned between requests** — new facts supersede old ones; old are kept; nothing lost.

### Read side — the inverse query
- When a tag activates (travel comes up again), background AIs ask the *opposite* question: what will the fronting AI need? Anticipatory prefetch driven by conversation shape, not keyword match.
- The fronting AI never searches; it walks in prepared. It has a second brain.
- **Fail-open like provenance:** if the background brain isn't ready when the next question lands, the fronting AI answers without it and the artifacts catch up. Memory can never block a chat turn.

### Announce-before-recall
- "I'm going to pull up anything I have on that." / "I see we talked about this two weeks ago, I'm going to pull that up."
- Not politeness — a **checkpoint**. The user can veto wrong recall before it poisons the answer. Every recall is a curation opportunity: corrections are new facts.

## Issues & Contradictions — Two Tiers

- Just like the issues queue inside working folders: one **global** issues/contradictions tracker, one **per-thread**.
- Thread-scoped = working set; global = long game.
- Fronting AI sees a handful, **progressive disclosure** style — headlines with option to pull detail.
- Enables: user says X → pull up the contradiction from two weeks ago → ask for follow-up.

## Relevance Decay = Review Tickets

No opaque decay function silently deleting. Decay is a **reviewed decision with an artifact**:
- A ticket like "run over the wiki, look at my chats, decide X, Y, Z" — then there's an artifact showing things were changed.
- Garbage collection with provenance; nothing-is-lost applied to forgetting itself.
- This is the SPEC-38 audit loop (query → review → recommendation → ticket → evidence) pointed at memories.

## Routines — Layman's Skills, Helper-Injected

- Routines are the consumer version of skills.
- **Not loaded at start** — background helpers scan and inject them automatically when live conversation state matches: tags, topic ID, entity extraction assembling little wiki-like graphs, from which helpers derive contradictions/issues and send them to the queue.
- Inversion: today's skill systems make the fronting model decide what to load (it must know what it doesn't know). Here the background brain decides — the routine arrives because the graph lit up.
- **Tuning an AI = editing a folder of routine files and trigger conditions.** No fine-tuning, no prompt surgery. The personality is a directory. A layman can do it.

### The Review Routine (meta)
- "Hey, ask the user if they would be willing to do a review, if the timing seems right."
- The system schedules its own maintenance conversations — the loop that keeps every other loop honest, initiated politely, timed by conversational awareness.

## Source of Truth — The Consumer-Chat Epistemology Problem

Code has a source of truth: the codebase. Conquer context for code first because truth is derivable there. A consumer chat app has no codebase — **the only source of truth is the user.**

Software dev knows this (the owner decision); consumer chat needs a built-in mechanism for getting source from the author — announce-before-recall, review routines, contradiction follow-ups — or the loops get drifty **because they are self-referential**: artifacts derived from artifacts derived from artifacts, with no external anchor. Every design element above that touches the user (announce, veto, review, follow-up on contradictions) is a source-of-truth acquisition mechanism, not UX decoration.

## Method Note — Why Files First

Deliberate decision: stop building abstracted server logic you can't see into. Markdown and folder hierarchies force you to see the system and think about it. (Influence: harness-engineering / skills-hierarchies material.) The wiki progression: hierarchy first → add edges later → then source files. Visibility is the debugging surface for architecture itself.

## Lineage

The chat app is Fusion Studio with the developer removed — same organs, consumer body:
- Structured artifacts per turn → capture
- Tags/topics/entities → wiki graph
- Issues & contradictions queued → tickets (`../012-App_Federation/app-federation-and-ticket-boundary.md`)
- Background convergence → clean-room loops (`../013-Convergence_Loops/adversarial-document-convergence.md`)
- Curation with artifacts → review routines
- Solid preferences → GUIDANCE.md
- Injected capabilities → routines-as-skills
- Write path for artifacts per turn → the post-provenance end_turn cascade (one-directional, DAG-scoped)

## Open Threads

>> Timing model for "when does the review routine judge the timing right"?
>> Tag-weight drift: do weights themselves get review tickets?
>> How much of the artifact store schema can reuse the provenance event/ledger schema verbatim?
