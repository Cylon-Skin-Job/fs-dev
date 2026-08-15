# Code Audit Sidecar — Deterministic Slop Detection

**Date:** 2026-07-04
**Status:** Idea capture from design riff. Not designed, not scheduled. Prerequisite: wiki articles fleshed out (the standards pages are the intent reference this system judges against).

## The Idea

A sidecar harness the agent itself calls. It runs deterministic, deliberately **over-broad** scans of the codebase against the Code Standards, then hands the agent back:

> "Here's something to evaluate. This was deterministically generated and over-broad to catch edge cases. It references code standards. Evaluate whether any of these are significant."

The agent (LLM) dismisses the false flags or escalates the real ones — against the standards *and their intent*, not just the letter.

## The Core Inversion

LLM search **samples** — it greps what it thinks to grep, reads what it thinks to read, and misses what it didn't think of. Deterministic enumeration is **exhaustive** — it cannot miss, but it cannot judge.

So flip the roles:

| Layer | Property | Job |
|---|---|---|
| Script (deterministic) | Total recall, zero judgment | Enumerate everything; over-flag by design; miss nothing |
| LLM (judgment) | Precision, contextual weighting | Dismiss false flags en masse; spot the one that matters |

Anything answerable as a binary gets codified into the script. Anything requiring weighted contextual bias is *presented* to the LLM with the relevant standard attached — the system never decides judgment calls itself, and never auto-fixes.

**This is the wiki audit pattern pointed at code.** Same shape as wiki-audit-decisions Decisions 6/8/18: script pass → change report → triage → LLM judgment against written skepticism criteria → reseal snapshot. The wiki audit is the prototype; this is the second consumer of the pattern. (Evidence-Gated Execution framing: this is the "Checks — deterministic" layer of Decision 14's three-layer lifecycle, for the code domain. Post-build, pre-commit.)

## What the Script Enumerates (binary tier — codified from Code Standards)

**Inventory + diff against last-run snapshot** (rebuildable state JSON, same doctrine as the wiki audit and the symlink work: derivable data is never authoritatively persisted, no SQLite):

- Module/service inventory: what exists, what exports what, who imports whom
- **New since last run:** files, routes, WS message types, event names, handlers, call sites (git-diff driven)
- **Line counts:** >400 = flag (minimum reason to split / maximum domain-creep tolerance); 200–400 = watchlist
- **Zombie sweep:** exports with zero importers; requires of deleted files; dangling references after renames (double-verify: structural match via ast-grep AND text match — broader than either alone)
- **Duplication:** same/near-same function names across modules; near-identical signatures (candidate duplicated services)
- **Layer violations from the import graph:** view importing service, controller touching DOM, component importing app-state — mechanically checkable
- **Protocol discipline:** new WS message type without a matching `handleMessage` switch arm (known silent-failure class); bus event names not matching `domain:action`
- **CSS:** hardcoded colors/z-index/spacing; missing `.rv-` prefix

Tooling already on the machine: `ast-grep` (`sg`) is the enumeration engine — structural search catches call sites that text grep misses (split arguments, reformatting). SPEC-31's zombie-removal ledger (`sg -p '$E.isDirectory()'` audit) is a hand-rolled one-off of exactly this system.

## What the LLM Judges (weighted tier — presented, never auto-decided)

- Is this 400+ line file one job or three? (The standard's own test: describable without "and")
- Is this duplication real, or coincidental similarity with different intents?
- Is this new route justified, or should the existing dispatcher own it? (Hard Routing Rule)
- Which of the 40 over-broad flags is the one that matters?

Each finding ships with a pointer to the standard it references. Once the wiki audit's source-path reverse index exists (Decision 19), the join is free: finding → source file → accountable wiki articles → guidance intent. The sidecar doesn't restate the standards; it cites them.

## The Loop (mirrors the wiki audit run loop)

1. **Script pass** — full enumeration, diff against snapshot, emit over-broad report grouped by check
2. **Triage** — LLM walks the report with the cited standards; dismisses false flags with one-line reasons; escalates significant findings
3. **Judgment** — significant findings become tickets/fix-tasks (human in loop for architecture calls, per standing rule: AI implements within documented patterns, never makes architecture decisions)
4. **Reseal** — new snapshot recorded after the run

Entry points: pre-commit checkpoint (Decision 14: checks fire post-build, commit gated) and agent-invocable on demand — the sidecar is something the working agent *calls*, not a CI gate bolted on outside.

## Boundary Clause (anti-overthink, same as wiki audit Decision 18)

The script only reads, enumerates, and reports. No auto-fix, no config DSL, no daemon, no scoring model. A new deterministic check is added only after a real miss demands it (demand-driven growth, same rule as the tag registry). The LLM tier never mutates code as part of the audit — findings become tasks, tasks go through the normal build loop with its own checks.

## Open Threads

>> Snapshot format: one state JSON like `.audit-state.json`, or per-domain (routes/exports/css) files?
>> Where does it live — `008-Workflows` sibling of the wiki audit, with prompts in the 900 band?
>> Does the wiki audit's universal script grow a third subcommand, or is this a separate script sharing the snapshot doctrine? (Decision 18's boundary says: no third subcommand until a need is proven — this might be the proven need, or might be its own tool.)
>> Relationship to export-safety skill and the WS-switch rule: those are per-edit guardrails; the sidecar is the periodic sweep. Same checks, two firing modes?
