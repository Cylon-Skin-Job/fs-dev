# Chat Harness Repair and Testing — intake and return point

> Owner-selected follow-on workfolder. Preparation does not approve product implementation.

## Assignment

The owner requested this home on October 5, 2026: “After that, I think the Open Code harness stuff needs to be in a new folder” and “Let's call it Chat harness repair and testing.” See [D-001](DECISIONS.md#d-001--create-the-follow-on-harness-home). Prepared by Codex side chat (ephemeral), 2026-10-05T16:19:23Z. No main session is designated or registered by provisioning.

The owner subsequently asked this chat to pull the existing OpenCode failure-mode work into this folder and ticket while the other folder finishes Chokidar removal and related repairs. [D-003](DECISIONS.md#d-003--bring-the-existing-opencode-failure-mode-work-into-this-ticket) records that bounded import.

## Desired outcome

Give follow-on OpenCode harness repair/testing its own durable home, with the prior investigation available here for discussion and later assignment. Detailed product outcomes and test acceptance conditions will be shaped with the owner here.

## Scope and dependencies

[Integration and Retirement](../chat-integration-and-retirement/TICKET.md) retains fixing and finishing the current last-build job, including necessary harness checks and concrete repairs within its approved scope. Its [October 5 handoff](../chat-integration-and-retirement/HANDOFF-CHOKIDAR-AND-HARNESS-2026-10-05.md) identifies CHAT-AR-SPEC-01, the current Chokidar-retirement/harness-launch job. Existing final verification and owner acceptance remain required; this split adds no Git publication or Alpha prerequisite.

Failure-mode evidence intake proceeds here now; broader subsequent product repair/testing follows current-build closeout. Source artifacts, identities and implementation records stay at their original paths. This folder does not take over or resume an existing investigation or orchestrator. [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work) owns the product sequence.

## Current disposition

Failure-mode intake populated; follow-on product execution awaits current-build closeout. The imported work is tracked as six sourced issues:

| Issue | Retained finding | Evidence state |
| --- | --- | --- |
| [I-001](ISSUES.md#i-001--structured-error-reporting-needs-a-bounded-proof) | Structured 401/429 errors become generic Fusion failures | Prior controlled probe and adapter replay |
| [I-002](ISSUES.md#i-002--retry-state-is-not-visible-through-the-tested-json-mode) | JSON mode omits retry status exposed by headless streaming | Prior controlled mode comparison |
| [I-003](ISSUES.md#i-003--accepted-prompt-recovery-and-fresh-reopen-have-unresolved-gaps) | Failed accepted prompts remain uncertain and may disappear on fresh reopen | Historical source findings; public-route reproduction outstanding |
| [I-004](ISSUES.md#i-004--attached-cli-can-miss-final-events-saved-by-the-headless-server) | Attached CLI misses final events already saved by the server | Prior controlled attach discrepancy; Fusion incident link unproved |
| [I-005](ISSUES.md#i-005--intermittent-together-socket-failure-has-unresolved-attribution) | Socket failure followed by successful retry | Historical log finding; reuse/fresh comparisons both passed |
| [I-006](ISSUES.md#i-006--metadata-lookup-failure-can-silently-select-another-harness) | Harness metadata failure can silently select Kimi | Conditional historical source path; incident execution unproved |

[CAPTURE](CAPTURE.md) retains the controlled-test matrix and open discussion. [REFERENCES](REFERENCES.md) binds the handoff, exact source-chat turns and historical investigator reports. Two named temporary probe files were absent at the import check; the surviving conversation summaries are preserved without claiming the raw fixtures or fingerprints were recovered.

Last evidence check: 2026-10-05T16:47:32Z. The handoff and implementation ledger report real chat verification pending; the separate chat **1. Chokidar Build Audit & Repair** was active at the check. Those are source/task observations, not current app health or a closeout claim. No new product probe, diagnosis or repair was performed for this intake.

## Next safe action

Continue the one-at-a-time failure-mode discussion here from I-001, the prior first item; the proposed error translation remains unapproved. Finish the current build in its existing home. Before assigning product repair/testing here, inspect its latest closeout/acceptance evidence, record the exact usable source/build/runtime baseline and residual findings, and recheck existing task ownership. Recreate missing controlled fixtures under that later assignment and agree on the first observable acceptance outcome. Mode selection and repair mechanisms remain open.

Intake consolidated by Codex side chat (ephemeral), 2026-10-05T16:59:29Z.
