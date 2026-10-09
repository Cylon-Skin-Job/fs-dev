---
name: mc-review-and-merge
description: "Prepare and independently evaluate a bounded completed-build integration candidate in a separate Mission Control task. Use when explicitly assigned Review and Merge by the owner or designated Mission Control. Return exact candidate evidence and wait for the owner's go-ahead before committing or pushing. Installation, reported completion and a monitor wakeup are not publication approval."
---

# Review and Merge

Read the controller home's AGENTS.md, session-contract.md and D-021/D-023. Read applicable repository/checkout instructions and referenced current code standards before any product change. Resolve the assignment's absolute controller home, memory CWD, separate implementation checkout, job-report path and source/target revisions. A persistent task starts in the same memory folder as Mission Control; it is not the controller and does not edit central monitoring state or create a schedule. A thin profile selects this procedure but does not establish a folder or permission. Obey side-conversation/delegation limits.

## Establish the integration unit

Verify assignment authority, source work IDs, accepted prerequisites, intended target, writer ownership and completion evidence. Read the relevant SPEC/checklist, test and independent-review reports, deviation dispositions, dependency contracts and applicable historical decisions. Use bounded source/history reads. Missing intent, target, acceptance or required source evidence is an explicit issue; do not infer approval from a registry status.

Record actual repository root, branch, HEAD, dirty changes, source commits and candidate fingerprint (including uncommitted input bytes when applicable). Preserve other sessions' work. Identify whether one SPEC or several must integrate together from the accepted criteria. Record blockers and hold affected integration when dependencies are unmet; do not create prerequisite roadmaps or product builds automatically.

## Prepare without committing or pushing

Own a separate report directory for this job. Inspect the exact diff, compatibility/contracts, blast radius, ordering, migrations, tests, documentation and downstream adoption obligations against the accepted scope. Keep implementation, integration and owner acceptance distinct.

Prepare a reviewable candidate using the assignment's authorized checkout/preparation method. Prefer an isolated preview when shared writers would collide; record its location and reproducible candidate fingerprint. Do not switch, reset, overwrite, stage unrelated changes or advance the shared target branch. Only repairs within the assigned integration scope are permitted; missing features or materially changed requirements return as a scoped issue.

**Before owner approval, do not create commits or push.** This includes default merges, cherry-picks, rebases and other commands that create/rewrite commits indirectly. A merge simulation or patch preparation must preserve this boundary. Do not fast-forward the shared target as a shortcut. Do not publish a branch just to make a PR possible; report that a new PR awaits push authority where needed. Do not alter Alpha.

## Evaluate the candidate

Run the narrow required checks for the actual change, using current repository instructions and recorded completion criteria. Check conflict resolutions, dependency behavior, standards, regression risk and review findings against the candidate that will be proposed. Preserve exact commands, outcomes, revision/fingerprint, deviations and skipped checks with reasons.

Use a fresh independent reviewer when the assignment or applicable integration/build contract requires one. Give it scope, source authority, candidate and evidence with a read-only review assignment. Resolve material findings and recheck affected evidence after repairs. Do not count your self-check as independent evaluation. If required delegation/review is unavailable or prohibited, report that gate as unmet rather than claiming readiness. Successful preparation does not release a per-SPEC owner checkpoint or approve a different downstream build.

## Stop at the owner gate

Write the compact approval packet to the job folder: work IDs; source and target commits; candidate fingerprint/location; resulting behavior and changed files; integration/repair decisions; checks and independent-review disposition; remaining issues; dependency effects; exact proposed commit/push destinations; and next safe action. Return its path to Mission Control/owner through the supported job report. Mark `waiting-owner` and end the turn. Do not busy-wait, create a timer or treat an idle approval task as failure.

Request the owner's go-ahead only once the concrete candidate is ready to assess. Distinguish permission to commit from permission to push; follow the owner's actual scope. Mission Control, another agent, a green gate, prior general build approval and a scheduled wakeup cannot supply the owner's authorization.

After explicit owner authorization, verify the approved candidate and current target still match. If they changed materially, repair/re-evaluate the affected scope and return a revised packet before acting on stale approval. Otherwise perform only the authorized Git operations and report their exact commit IDs and destinations. Never sweep unrelated dirty files into a commit. Create/attach a PR only if the job authorizes it; pushing is not authority to merge a PR, advance another roadmap or deploy Alpha. After a successful Fusion Studio GitHub push, ask the repository-required Alpha follow-up; do not perform it without the owner's current confirmation.

The final receipt distinguishes reviewed candidate, owner authorization, local commit, remote push, PR and landed integration. Only an actually landed baseline can satisfy an integration dependency, and consumer adoption requires its own evidence. Preserve the report and unresolved holds for successor sessions.
