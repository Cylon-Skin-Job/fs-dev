# Adversarial Document Convergence

Status: CAPTURE — methodology record; the system is in its infancy
Captured: 2026-07-13

## What This Is

The working method that produced the provenance wiki section and its SPEC set: run independent cold readers against a corpus of files until the finding rate hits zero, where every loop's output (issues, decisions, contradictions) is itself a file the next loop can read.

Files-first is the load-bearing property. Capture folders are the working folders; because everything is a folder of markdown, every agent — interviewer, issue-hunter, clean-room auditor — reads the same evolving state and leaves durable artifacts behind. (Same property that makes tickets-as-folders work: context travels with the artifact.)

## The Loop, As Actually Run

1. **Info dump** — talk to an interviewer model (Deepseek V4 Pro), unstructured brain dump.
2. **Sub-agents against the transcript** — check for anything left out, contradictions; produce markdown docs: issues list, decisions list, etc. One doc per concern.
3. **Two models in complementary roles:**
   - A big model reads everything and **creates issues**.
   - The interviewer asks the issues back **one at a time** — reading current capture/decision docs, contradiction and issue docs, crafting each next question from the live state, adding clarifications to the docs.
4. **Rewrite + audit cycle** — the big model checks for updates, rewrites SPEC and ROADMAP, runs clean-room loops hunting contradictions and things that don't work together.
5. **Coverage pass** — after the wiki section was drafted (from a shared folder), a separate agent re-read all transcripts and produced files, hunting anything missing from the wiki → added to issues.
6. **Unification passes** — "do the 9 sub-articles overlap and share ideas under different names? Collapse and use shared language wherever possible." (That one ran 8 hours.)

Loops run in many directions: transcript→doc coverage, doc→doc contradiction, doc→wiki completeness, wiki→wiki language unification.

## Why It Works

**The dangerous gap is never the missing piece — it's the guessable piece.** A cold reader has no conversation memory, so every place it guesses or asks is a place an implementing agent would have guessed silently and possibly wrong. The loops don't primarily find errors; they find *ambiguity that would have compiled*. The final SPEC drafts' unusual specificity (exact caps, enumerated step counts) is what a document looks like after every guessable hole is closed.

Convergence terminates for documents because contradiction-hunting has a fixpoint: eventually the corpus agrees with itself.

## Byproducts That Became Standards

- **GUIDANCE.md** — solid preferences and decided user intent, recorded so agents don't re-ask; includes chat-history rationale for how intent was decided.
- Decision docs, issues docs, contradiction docs as first-class artifact types.
- The wiki deviation rule: any case-specific deviation is not duplicated elsewhere, or it becomes a standard.

## Turning the Loops on the Codebase

The method must change in one fundamental way: **documents converge by consistency; code converges by evidence.** An open-ended "find problems" loop over raw code never terminates — every pass regenerates plausible findings (observed: Codex clean-room audits still finding stuff after 6 hours). Code loops need an oracle that says true/false:

1. **The wiki as oracle — drift detection.** "Find every place the code violates <standards subpage>" is bounded and terminating. The 8 Code Standards subpages are the partition: one loop per surface. Each finding is either a code fix or, per the deviation rule, a new standard.
2. **The SPEC-00 harness as oracle — behavior.** Executable scenarios make behavioral findings checkable instead of opinion-shaped.

Precedent: the 2026-04-06 compliance audit (22 specs in the Code Standards page) was v1 of a codebase loop — run before the convergence protocol and unified wiki existed. V2 = that audit re-run per wiki surface, clean-room verified, findings filed as tickets in folders.

**Cost rule:** loop value concentrates where wrong assumptions are expensive — protocol, state, persistence, enforcement. Playground code doesn't deserve an 8-hour convergence pass. The standards map is the priority list.

## Future: Chat Cascades (post-provenance)

Once provenance is done, chat transcripts become a tool call, and `end_turn` in one chat can set off one or several others — **all scoped in one direction** — then synthesize, fix, add issues, note decisions. This turns the manual ritual into infrastructure.

The one-directional scoping is the critical constraint: it makes the chat graph a DAG — no loop storms, no mutually retriggering chats. Same principle as the ticket boundary: an `end_turn` doesn't command the next chat, it files a request something else chose to watch for (see `../012-App_Federation/app-federation-and-ticket-boundary.md`).

## Relationships

- Ticket boundary / federation: `../012-App_Federation/app-federation-and-ticket-boundary.md`
- Provenance master plan (the method's biggest output so far): `../008-Provenance-Temp/01-provenance-implementation-master-plan.md`
- Clean-room skill: `$clean-room-loop` (fresh cold Opus reviewer until clean) — the per-slice acceptance gate in the roadmap-orchestrator protocol.
- Editor lesson that seeded the principle: "the almost-right version of the machinery is the dangerous version" (six review cycles on SPEC-01).
