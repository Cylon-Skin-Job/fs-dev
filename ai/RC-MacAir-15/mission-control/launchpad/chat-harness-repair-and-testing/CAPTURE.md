# Chat Harness Repair and Testing — working synthesis

> Source-backed intake of prior OpenCode findings; not a history checkpoint, fresh reproduction or implementation plan.

## Current understanding

The owner is organizing the next few weeks one project folder at a time. Integration and Retirement finishes the current last build; subsequent OpenCode harness repair/testing uses this home. Other proposed projects remain separate discussion topics. See [DECISIONS](DECISIONS.md).

The owner now explicitly asked to bring the existing failure-mode work into this folder and ticket while the current build continues elsewhere ([D-003](DECISIONS.md#d-003--bring-the-existing-opencode-failure-mode-work-into-this-ticket)). Phase: evidence intake and framing. Follow-on implementation still awaits current-build closeout.

The [source handoff](../chat-integration-and-retirement/HANDOFF-CHOKIDAR-AND-HARNESS-2026-10-05.md#other-opencode-harness-issues-retained-for-later-work) retains six findings. Targeted reads of **Map Fusion–OpenCode chat failure states**, `01a0ea32-f152-77a2-afc2-b73e8976685a` (local), recovered the original probe summaries and later discussion. They describe inspected source and controlled OpenCode v1.18.32 probes, not freshly reproduced behavior on a current baseline:

| Finding | Evidence limits |
| --- | --- |
| [I-001](ISSUES.md#i-001--structured-error-reporting-needs-a-bounded-proof): structured errors lost at the adapter boundary | Controlled 401/429 frames did not become canonical Fusion events; no conclusion about the live key. |
| [I-002](ISSUES.md#i-002--retry-state-is-not-visible-through-the-tested-json-mode): retry visibility differs by mode | Run JSON and headless streaming exposed different retry evidence; mode choice remains open. |
| [I-003](ISSUES.md#i-003--accepted-prompt-recovery-and-fresh-reopen-have-unresolved-gaps): accepted-prompt recovery/readback gap | Source-based finding; exact public route still needs reproduction. Earlier false-send handling was separately fixed. |
| [I-004](ISSUES.md#i-004--attached-cli-can-miss-final-events-saved-by-the-headless-server): attach-mode completion gap | Controlled attachment missed events saved by the headless server; no proven link to the live incident. |
| [I-005](ISSUES.md#i-005--intermittent-together-socket-failure-has-unresolved-attribution): intermittent Together/socket failure | Attribution remains unresolved; comparison probes succeeded and key fallback was not established. |
| [I-006](ISSUES.md#i-006--metadata-lookup-failure-can-silently-select-another-harness): model/harness metadata fallback | Conditional silent Kimi fallback in inspected source; no proven incident causation. |

[REF-002](REFERENCES.md#ref-002--october-5-harness-and-build-handoff) binds the handoff revision; [REF-004](REFERENCES.md#ref-004--targeted-source-conversation-reads) supplies exact turn/message locators. The original controlled local-provider results were reported as:

| Fixture response | Provider attempts | Direct `opencode run --format json` result |
| --- | ---: | --- |
| Success | 1 | Text and completion; exit 0 |
| 429, then success | 2 | Success; no retry notification |
| 401 rejection | 1 | Structured error; exit 1; no retry |
| Persistent 429 | 6 | Structured error after five retries; exit 1 |

Headless event streaming reported retry attempts 1–5 and incremental text omitted by the tested direct JSON mode. Offline replay of terminal 401/429 frames through the then-current Fusion adapter emitted no canonical event and fell back to generic exit classification. Attached CLI output separately missed final events that the server had recorded. The source discussion described backoff/Retry-After and retryable socket closure. This is the prior tested version's behavior; no decision to change modes or own provider retries was made here.

Recovery has two distinct edges in [CHAT-AR-INV-001 F1/F2](../chat-integration-and-retirement/investigations/CHAT-AR-INV-001/report.md): claimed receipt readback remains `unknown_after_dispatch_claim` after `provider_failed` while the foreground error clears the status watch/control; and a fresh renderer with no exchange/live turn may lack the accepted prompt. The second edge was not reproduced through the public reopen route. Preserve server-owned acceptance, exact `threadId`, duplicate prevention and no automatic redispatch when shaping a later check. [CHAT-AR-INV-002](../chat-integration-and-retirement/investigations/CHAT-AR-INV-002/report.md) separately describes conditional fallback to Kimi after a harness metadata lookup error. [REF-005](REFERENCES.md#ref-005--historical-recovery-and-fallback-investigations) preserves the reports' revisions and older source baseline.

For Together, the recovered September 30 discussion reports a socket-close failure at 3:14:50 p.m. PDT, retry at 3:14:52 and completion at 3:14:53 in “Resume SB-COMMS-001 run from frozen revision”; “SB-PICKER-001 owner checkpoint & roadmap close” had a similar connection error. One session loaded config before its last edit and the other afterward; both used the inspected Together model. Credential inspection found one selected key and no observed rotation. Later comparisons reported 8/8 successes with normal reuse and 8/8 with fresh connections, zero retries, with idle pauses up to 30 seconds. Packet capture was unavailable; socket sampling did not establish which peer closed the failed connection. These facts leave provider/network/reuse/warm-up attribution unresolved. Preliminary Python-route HTML 403 results did not establish provider authentication failure because native OpenCode succeeded.

At 2026-10-05T16:46:22Z, the handoff's `observations.json` and connection-comparison `summary.json` were both absent at their named temporary paths. The historical investigator reports and source-chat text survive; exact raw probe fixtures/native frames/fingerprints were not recovered. Future reproduction must record a new fixture and baseline rather than silently treating these summaries as raw evidence.

The local launch failure (`spawn EBADF` before a returned PID), Chokidar removal, New Chat selection repair, startup integrity concerns, render delay and required real-chat acceptance remain owned by Integration and Retirement. [REF-006](REFERENCES.md#ref-006--current-build-dependency-and-concurrency-observation) records the dated build ledger and active audit chat. No accepted current-build closeout was established by this import.

## Open discussion

The prior owner direction was “Hand these to me one at a time and let’s look at them bit by bit.” The first discussed item was structured-error translation; mapping it through the existing error contract was an assistant proposal. Continue that discussion here without treating it as implementation approval.

Open choices: the safe canonical/user-visible error result; reliable evidence for retry versus terminal failure; recovery/readback behavior before any exchange exists; relevant supported harness modes; whether the historical attach discrepancy matters to Fusion's actual launch path; and a bounded way to distinguish intermittent provider/network failures. No mode change, replacement retry loop or broad harness redesign is selected. Product acceptance scenarios remain to be settled after reconciling the accepted build baseline.

## Routed outcomes

Creation and sequence are recorded in [D-001/D-002](DECISIONS.md); the source folder's [D-008](../chat-integration-and-retirement/DECISIONS.md#d-008--narrow-to-the-current-build-and-separate-follow-on-harness-work) owns its narrowed remit. [D-003](DECISIONS.md#d-003--bring-the-existing-opencode-failure-mode-work-into-this-ticket) routes the prior work here as I-001–I-006 with supporting references. This ticket is the current follow-on intake; original evidence remains at its original paths.

Prepared by Codex side chat (ephemeral), 2026-10-05T16:19:23Z; expanded 2026-10-05T16:59:29Z. Coverage: named handoff, two historical investigator reports, selected settled source-chat turns and a compact build-task observation. This is bounded retrieval, not exhaustive history reconciliation; no checkpoint state was created or advanced.
