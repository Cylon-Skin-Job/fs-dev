# Local Model Toolbox, Agent Mail & Staged Pipelines

Status: CAPTURE — the freebies tier + ingestion pipeline pattern + democratization thesis
Captured: 2026-07-13

## Why Provenance Came First

All the hooks don't work until provenance works. An automation platform without provenance is a haunted house — emails triggering calendar events and voice notes filing themselves are terrifying unless every action answers "who did this, from what cause, where's the evidence." Consent toggles, glass panes, and the ticket boundary are only trustworthy promises when the ledger can prove they were kept. The provenance pause wasn't plumbing before the fun stuff; it was building what makes the fun stuff acceptable to a human.

## The Freebies Tier

Bundle everything useful that runs in **Transformer.js**, free and local:

- Speech-to-text (Whisper-class) + text-to-speech
- OCR
- Speaker diarization (labeled-speaker transcripts, then STT over them)
- Embeddings for the vector-database path

The main app requires a code plan or API key; the freebies deliver value before anyone touches one. Local models inherit the not-creepy stance automatically and cost nothing per user. **Free tier does the magic tricks; the code plan unlocks the big brains.**

### The Democratization Thesis

It took a year and a half of hours-upon-hours to assemble this stack knowledge. Most people don't have that time — but they're smart enough to know exactly what they want ("some emails should create a calendar event"). That's not a naive wish; it's a well-specified requirement from someone who shouldn't need to learn what RAG is. **The product is the assembly, not the models.** Import that PDF → markdown, or → HTML artifact to start changing things around? Research article → vector database → run enrichment? All one tap, no stack knowledge.

## Agent Mail — The Universal Ingestion Port

Agent Mail gives the assistant its own email address it checks via CLI. Email is the lowest-common-denominator API — everything on earth can send one — so this becomes the universal inbound hook: forward anything to your assistant.

**Hard rule before the first email-triggered automation ships:** inbound mail is attacker-reachable, untrusted input. *Email content is data, never instructions.* An email can only trip a watcher explicitly built and registered for its pattern (ticket boundary applied to the inbox), and anything it proposes arrives as a staged ticket like everything else.

## The Pipeline Pattern — Voice Note Example

Diarize → transcribe → categorize (tags/topics/entities) → route to the applicable repo/knowledge section → drop in as an artifact → summarize with possible application/usage in a report → **present one or two tickets, ready to run.**

### Staged, Not Executed

"Provisionally acted upon" means the system does all the work up to the boundary, then stops and holds the finished action out for a tap. Automation proposes, the human disposes, evidence attached. A user who's never heard of a capability model experiences it as "it did everything except the part I'd want to decide" — the entire security architecture delivered as a feature.

## Toolbox Needs a Manifest, Not a Pile

Each local model is a declared capability: name, what it consumes, what it produces, and where outputs land. That is a capability-registry contract, not a universal event/provenance block; canonical events still require the shared envelope plus registered extensions, as clarified by the [2026-07-15 provenance findings](../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat. Pipelines are then **compositions of declared capabilities** rather than hardcoded chains — a future user or their AI can wire OCR → markdown artifact → vector store → enrichment without that exact path having been built.

## Relationships

- Ticket boundary (staging, inbox watchers): `../012-App_Federation/app-federation-and-ticket-boundary.md`
- Second brain (artifacts, categorization, announce-before-recall): `../014-Second_Brain_Chat/second-brain-chat-vision.md`
- Office/home suite (email/calendar the pipelines feed): `../017-Office_And_Home_Suite/office-and-home-suite-roadmap.md`
- Provenance master plan (the trust substrate): `../008-Provenance-Temp/01-provenance-implementation-master-plan.md`
