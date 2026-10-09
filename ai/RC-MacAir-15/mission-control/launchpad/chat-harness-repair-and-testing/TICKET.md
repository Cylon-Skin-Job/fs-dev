# Chat Harness Repair and Testing — intake and return point

> Owner-selected follow-on workfolder. Preparation does not approve product implementation.

## Assignment

The owner requested this home on October 5, 2026: “After that, I think the Open Code harness stuff needs to be in a new folder” and “Let's call it Chat harness repair and testing.” See [D-001](DECISIONS.md#d-001--create-the-follow-on-harness-home). Prepared by Codex side chat (ephemeral), 2026-10-05T16:19:23Z. No main session is designated or registered by provisioning.

The owner subsequently asked this chat to pull the existing OpenCode failure-mode work into this folder and ticket while the other folder finishes Chokidar removal and related repairs. [D-003](DECISIONS.md#d-003--bring-the-existing-opencode-failure-mode-work-into-this-ticket) records that bounded import.

On October 8, the owner directed **Map Fusion–OpenCode chat failure states** to pass the complete handoff here. [D-004](DECISIONS.md#d-004--receive-the-completed-build-and-alpha-incident-handoff) records receipt under the existing documentation assignment; it does not assign a product build or rebind main/history identity.

## Desired outcome

Give follow-on OpenCode harness repair/testing its own durable home, with the prior investigation available here for discussion and later assignment. Detailed product outcomes and test acceptance conditions will be shaped with the owner here.

## Scope and dependencies

[Integration and Retirement](../chat-integration-and-retirement/TICKET.md) retains the original build's implementation, acceptance and operation records. Its [completed-build handoff with October 8 Alpha addendum](../chat-integration-and-retirement/HANDOFF-COMPLETED-BUILD-2026-10-07.md) supersedes the October 5 waiting status: CHAT-AR-SPEC-01 and CHAT-AR-REPAIR-01 are owner accepted and independently integrated, committed and pushed to `main` at `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb` (tree `1c80f83c6c4b2b61e42c4dbb988c1f942b672ade`). Development was rebuilt/restarted; Alpha was expressly synced/rebuilt/reinstalled/restarted. [REF-007](REFERENCES.md#ref-007--accepted-build-closeout-and-publication-packet) binds the separate acceptance, review, runtime and publication receipts. No action remained unfinished in that completed-build assignment.

The current-build prerequisite in [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work) is satisfied. Follow-on product repair/testing remains unassigned and needs its own settled scope and authority. Historical pending gates are preserved as dated evidence; do not resume them or repeat completed Git/Alpha operations. Original sources/tasks remain in place. Other source-folder projects, health/logging, native Calendar and plugin snapshot work retain their separate scope.

## Current disposition

Failure-mode intake reconciled with the accepted build; ready for one-at-a-time discussion, with product execution unassigned. The six existing issue IDs remain:

| Issue | Retained finding | Evidence state |
| --- | --- | --- |
| [I-001](ISSUES.md#i-001--structured-error-reporting-needs-a-bounded-proof) | Specific errors become generic Fusion failures | Prior controlled 401/429 probes plus Alpha model lookup → UnknownError → generic exit chain |
| [I-002](ISSUES.md#i-002--retry-state-is-not-visible-through-the-tested-json-mode) | JSON mode omits retry status exposed by headless streaming | Prior controlled mode comparison |
| [I-003](ISSUES.md#i-003--accepted-prompt-recovery-and-fresh-reopen-have-unresolved-gaps) | Failed accepted prompts remain uncertain and may disappear on fresh reopen | Historical source findings; public-route reproduction outstanding |
| [I-004](ISSUES.md#i-004--attached-cli-can-miss-final-events-saved-by-the-headless-server) | Attached CLI misses final events already saved by the server | Prior controlled attach discrepancy; Fusion incident link unproved |
| [I-005](ISSUES.md#i-005--intermittent-together-socket-failure-has-unresolved-attribution) | Socket failure followed by successful retry | Historical log finding; reuse/fresh comparisons both passed |
| [I-006](ISSUES.md#i-006--metadata-lookup-failure-can-silently-select-another-harness) | Harness metadata failure can silently select Kimi | Conditional historical source path; incident execution unproved |

[CAPTURE](CAPTURE.md) retains the controlled-test matrix and open discussion. [REFERENCES](REFERENCES.md) binds the handoff, exact source-chat turns and historical investigator reports. Two named temporary probe files were absent at the import check; the surviving conversation summaries are preserved without claiming the raw fixtures or fingerprints were recovered.

**Alpha follow-on:** the October 7 incident used obsolete `fireworks-ai/accounts/fireworks/models/deepseek-v4-flash-0731`. Two native sessions launched successfully and exited 1 before output; a separate scratch reproduction exposed `ProviderModelNotFoundError`, wrapped as `UnknownError` in OpenCode JSON and shown as `HARNESS_PROCESS_EXIT` in Fusion. This is distinct from HTTP 401/429 and historical pre-PID `spawn EBADF`; original Alpha diagnostics did not save the detailed native error. See [REF-008](REFERENCES.md#ref-008--alpha-model-failure-and-authorized-configuration-correction).

On October 8 the source chat changed only Alpha fs-dev's `harnesses.opencode.model` to `togetherai/deepseek-ai/DeepSeek-V4.1-Flash`. This receiver independently read back that value at 2026-10-09T00:52:11Z (October 8 PDT). **A real Alpha response after the correction remains unverified.** Existing runtime snapshots and explicit per-thread overrides may retain another selection. Accepted R3 success/persistence/passive-reopen evidence closes the completed-build scenario; it does not verify this later configuration's adoption or close the separate failure-recovery gaps.

Last evidence check: October 8 PDT; source fingerprints and sealed closeout members verified 2026-10-09T00:52:11Z. Historical PIDs and startup/deployment receipts are dated evidence, not present action targets or fresh app/provider health checks. No new product probe, code/configuration change, restart or provider send was performed by this receiver.

## Next safe action

Continue from I-001, keeping HTTP 401, exhausted HTTP 429 and local model lookup failure distinct across underlying error → OpenCode JSON → Fusion message. That mapping is a proposal for discussion. A later bounded Alpha check must verify newly activated/new-thread model adoption, any per-thread override and a real completed/persisted response; no live action is dispatched here. Before planning repair/testing, bind actual dirty source/config/runtime bytes to the accepted commit, recreate missing fixtures as needed, and settle the observable acceptance outcome. Mode selection and recovery mechanisms remain open.

Intake consolidated by Codex side chat (ephemeral), 2026-10-05T16:59:29Z.

October 8 handoff reconciled by Codex side chat (ephemeral), 2026-10-09T00:56:36Z.
