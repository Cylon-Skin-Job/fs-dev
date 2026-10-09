---
name: wiki-update
description: Coordinate a manually requested Wiki Update through research, repair and independent audit. Use when the user invokes Wiki Update in this wiki home; not for ordinary page edits or merely discussing the workflow.
---

# Wiki Update Supervisor

Read [the shared contract](../../wiki-session-contract.md) and Wiki AGENTS.md. The current manually invoked session is the supervisor; do not spawn another supervisor as an extra layer. Establish the user's bounded scope and source baseline, then create the run assignment and progress record.

## Research

Spawn a fresh `wiki-research-worker` with `.agents/skills/wiki-research/SKILL.md` and the assignment packet. It delegates bounded source/page investigations and returns a synthesized article disposition map and evidence. Check coverage of new/deleted/renamed source and missing articles, not merely matches in metadata. Resolve report contradictions; request targeted additional evidence before treating unsupported claims as repair instructions.

## Repair

Assign `wiki-repair-worker` the reconciled research, exact article ownership and existing finding IDs. It delegates disjoint edits and owns cross-page integration, preimages, timestamps and scoped mechanical checks. Keep the run record current while the worker operates. The supervisor does not become an unrecorded competing article writer.

## Independent audit and repair loop

Spawn a fresh `wiki-auditor`, using `.agents/skills/wiki-audit/SKILL.md`, with the original scope/baseline and current output. Do not reuse an author or researcher as final auditor, and do not give it a prior conclusion as an answer to reproduce. Supply raw evidence and report locations; audit first establishes its own coverage before comparing the other reports. The auditor may delegate independent bounded checks.

Reconcile every material finding into findings.md. Send concrete findings to Repair; use Research when facts or coverage are uncertain. After repair, run a fresh independent audit pass on affected evidence plus integration/omission coverage. Preserve findings across passes. Do not turn a source/intent conflict into a guessed product decision. If progress stalls, report the specific unresolved evidence or owner choice rather than repeating identical passes.

## Final handoff

Verify article hashes and source baseline still match the final clean audit. Check that original assignments and new material findings all have dispositions. A no-change update still needs evidence and independent scope review, but no timestamps or versions should change. Write handoff.md and report changed/retained articles, checks, scope limitations and remaining product gaps. No Mission Control interaction or automatic publishing is required.
