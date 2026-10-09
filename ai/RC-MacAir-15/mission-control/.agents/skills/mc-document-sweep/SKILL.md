---
name: mc-document-sweep
description: Review how a Launchpad documentation package has changed since its last completed sweep, checking cross-document consistency, intent propagation, source coverage and newly introduced gaps. Use after a meaningful batch of issues or decisions, a structural revision, or before planning handoff. Does not checkpoint conversation history or approve a release.
---

# Document Sweep

Determine whether the current package still adequately expresses the work after its latest changes. A coherent diff is not proof of adequate context: challenge the source boundary as well as internal consistency. Use the exact assigned domain folder and follow its AGENTS.md, index and the shared [investigation contract](../../../investigation-contract.md). Do not activate the inert template.

## Trigger and scope

The main Launchpad session should request a sweep after a meaningful batch of issues or decisions has been incorporated, after a changed outcome/contract or major draft revision, and before recommending Creator handoff. A handful of related changes is a useful cue, not a fixed quota. A material contradiction warrants an earlier sweep. Avoid one sweep per edit; coalesce overlapping requests and check for an active reviewer. This is event-driven review during authorized work, not a timer or a recurring automation.

An assigned reviewer inspects sources and writes its own sweep report/state only. Launchpad owns incorporation into Issues, References, Change Surface, Contracts and the draft; grant any repairs as a separate exact write assignment. No product edits, canonical Wiki changes, nested delegation or external messages are implied. A main Launchpad session may dispatch the reviewer under D-010; side-session restrictions still apply.

## Establish a review baseline

Use [scripts/sweep_state.py](scripts/sweep_state.py), which preserves documentation text as well as hashes, so uncommitted changes and deletions remain comparable. It writes only `<domain>/.document-sweeps/`; this is operational review state, separate from index.json and CHECKPOINT.json. Never commit, stash or reset Git to obtain a baseline.

```text
python3 <skill>/scripts/sweep_state.py start <domain>
python3 <skill>/scripts/sweep_state.py diff <domain> <run-id>
```

`start` returns an immutable input snapshot, parent baseline and run ID. Coverage includes the local index, direct Markdown files (including unindexed additions), and indexed Markdown/JSON files within the folder. Nested unindexed documents and external code/wiki are not automatically snapshotted: inspect index changes and links for omissions, and record the external sources/versions examined in the report. Do not capture secrets, binaries or an entire repository. The helper rejects escaping indexed paths; request a corrected scope instead of broadening it silently.

With no previous baseline, read the current package and establish an initial review; do not invent historical changes. On later runs, read the preceding report and all unresolved findings as well as the diff. A prior baseline means reviewed, not clean. Missing or corrupt baseline state is a limitation, not permission to fabricate a comparison. Treat rename candidates as deletion/addition until identity is supported.

## Review changes and coverage

Read changed material in context and follow its affected links into unchanged documents. For each material change, track the relevant chain: owner intent/source → decision or issue → proposal/contract → affected code/wiki/consumer → draft or SPEC → verification. Mark links covered, unresolved, explicitly deferred or inapplicable, with reasons. Do not require every document to change for every edit.

Check these questions:

- **Intent:** Was meaning lost, strengthened or contradicted? Distinguish owner words from assistant paraphrases. Follow exact conversation sources when necessary to resolve meaning; clear owner revisions supersede only their stated scope. Missing history remains an evidence gap.
- **Propagation:** Did a decision, issue resolution, constraint, deletion or deferral reach every affected record? Are stale alternatives still presented as requirements? Did resolving one issue introduce another?
- **Source sufficiency:** Does the package's context map support the claims it now makes? Use bounded discovery beyond the named references when needed: relevant wiki indexes/standards routers, implementation entry points and producers/consumers. Check likely persistence, lifecycle and compatibility boundaries. A supplied reference list is not proof that relevant sources were found.
- **Impact:** Does CHANGE_SURFACE account for non-code effects, wiki updates, tests, dependent work and consumer adoption? Are required documentation changes assigned rather than assumed to accompany implementation?
- **Readiness:** Are smoke scenarios and success conditions still aligned with intent? Have unresolved choices or stale evidence been hidden behind a ready/complete label? Is a proposed contract being mistaken for implemented behavior?

Use current source evidence where it can alter a conclusion; record paths, revisions, search boundaries and limitations. If the necessary trace becomes substantial, return a precise follow-up investigation request and mark the affected coverage unresolved. Do not silently claim that an internal document comparison proved implementation facts. At planning handoff, revisit external evidence freshness even if local documentation has no diff.

Use [conversation-evidence.md](../../../conversation-evidence.md) for source resolution, exact conversation locators and proposal/decision reconciliation when a changed claim depends on history.

Checkpoint remains a separate explicit history-synthesis procedure. A targeted history read for this sweep does not advance its cursor and does not claim all intervening conversation was processed. Memory Maintenance owns schema/routing mechanics. Independent Release Validation remains a separate release gate; a sweep never replaces it.

## Report and carry findings forward

Write `report.md` inside the returned run directory. Include:

- Run/parent IDs, author/time, input snapshot and exact scope; initial review or change review.
- Material changes and their propagation across the package.
- Coverage table: changed claim/outcome, sources checked, consumers/documents/verification considered, and uncovered edges or justified limits.
- Findings with stable IDs, evidence, affected scope, consequence, severity, resolver and next action. Reuse prior finding IDs; distinguish new, persisting, resolved, superseded and deferred findings. Resolution needs evidence. A prior finding cannot vanish merely because its file did not change.
- Reconciliation requests for Issues or decisions, and bounded research requests where evidence is missing. Do not manufacture an owner choice to close the report.
- Separate review completeness (`complete`, `partial`, `stale`) from assessment (`no material gaps found within scope`, `gaps found`, `insufficient evidence`). List changed files and checks actually performed.

Return a concise synopsis of changed understanding, new/persisting gaps and next actions to Launchpad. A complete sweep may find blocking issues. If a necessary part of the assigned review could not be performed, mark it partial and preserve the prior baseline. If a completed assessment establishes that the package lacks evidence, it may be complete with gaps, provided those gaps and follow-ups are carried forward.

## Finish without losing work

```text
python3 <skill>/scripts/sweep_state.py finish <domain> <run-id> --complete
```

Call only after the assigned sweep is complete and its nonempty report is saved. The helper refuses if the input documentation or parent baseline changed. Keep the report as stale/partial and rebase the affected review; do not overwrite another reviewer or move the baseline to unreviewed bytes. The helper verifies snapshot integrity and records the report hash, but cannot judge semantic completeness or truth. If an interrupted finish leaves `finish.lock`, verify the prior process/writer is inactive before removing that stale lock under the review-state write assignment; never bypass an active reviewer.

Launchpad records the report's disposition and incorporates justified findings. Those resulting edits are new input for the next sweep; do not silently include them in the reviewed snapshot. Recheck affected material until the current planning step has sufficient evidence, while leaving owner waits and explicit deferrals visible. Never call the package globally complete on the strength of a document sweep.
