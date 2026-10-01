# SPEC-02 supervisor review

Candidate: `CHAT-AR-4641ca5897f0`. Review date: 2026-09-21 PDT. State: `accepted`; the owner explicitly replied “Accepted. Continue.” after receiving the complete SPEC-02 checkpoint on 2026-09-21. This acceptance satisfies the prerequisite for SPEC-03; it does not waive the recorded later-SPEC Working Activity failure or residual advisories.

## Contract and integrated result

SPEC-02 was to give each deliberate Send a session-owned, correlated attempt and an authoritative recovery path: truthful pre-enqueue outcome, durable receipt and duplicate fencing, then a visible 15-second uncertainty state that preserves editing without resending. The three ordered slices 02A–02C delivered those behaviors. The approved SPEC-02/roadmap/architecture/validation hashes still match `RELEASE-MANIFEST.md`, and the current integrated 39-file source manifest at `evidence/spec-02/SPEC-02-SOURCE-SHA256.txt` verifies on current bytes. HEAD remains `88637d11c65be53d4f2ad0f049f64a07fa3db1de` on `agent/exact-workspace-paths`; the work is uncommitted and preserves unrelated owner/concurrent changes.

Primary report: `SPEC-02-IMPLEMENTATION-REPORT.md`. Slice reports: `evidence/spec-02/02A/SLICE-02A-IMPLEMENTATION-REPORT.md`, `evidence/spec-02/02B/SLICE-02B-IMPLEMENTATION-REPORT.md`, and `evidence/spec-02/02C/SLICE-02C-IMPLEMENTATION-REPORT.md`.

## Evidence checked by supervisor

- 02A, 02B and 02C each have a fresh builder-owned clean-room gate and a separate clean orchestrator-owned gate on relevant current bytes. The final fresh cross-slice reviewer returned CLEAN on all 39 integrated hashes. Prior material findings were repaired through the owning builders and reviewed again.
- Client build passed. The authenticated full V-SUBMIT `evidence/spec-01/01B/chat-arch-1790002646830-5e53da75bd/` passed its seven R2–R4 selected cases and eight enforced subcases, with owned root removed and no leaked process. Public and fault R7 runs `chat-arch-1790002736972-b0516cc63f` and `chat-arch-1790002751215-6649405850` passed. The 02B SQLite migration/upgrade/rollback/restart matrix passed 5/5; the final focused staged backend run `evidence/spec-01/01C/server-focused-1790002885800-65fe9143/` passed 161/161 in ten suites, with no leaked owned PIDs and removed root.
- The final private staged client run `evidence/spec-01/01C/boot-1790002766964-6ab509b2/` selected 123 cases: 122 passed, zero setup failures, and one product assertion failed with exit 1 propagated. The exact failure is the previously recorded Working Activity in-flight/revealed-baseline case assigned to SPEC-04/06. It is not represented as a passing suite or silently waived.
- The 39-path diff check passed. New production owners remain within the routed 400-line guidance: session store 99 lines, recovery controller 399, receipt repository 64, admission service 160, migration 26. Current files and selected test ownership match the integrated source manifest.
- No live development/Alpha profile or database, port 3001, owner-window diagnostic, commit, push, or Alpha operation was used. Test profiles/workspaces/SQLite and processes were owned and cleaned up.

## Deviation decisions and downstream packet corrections

The complete original-contract/actual-change/reason/files/tests/observable-effect/risk ledger is in `SPEC-02-IMPLEMENTATION-REPORT.md` and the slice reports. Supervisor disposition:

| Departure | Classification | Downstream action |
| --- | --- | --- |
| Session store, immutable draft revisions and attachment insertion generations added around expected host/router/composer areas | `accepted_update_downstream_packet` | SPEC-03 must consume the exact workspace/thread attempt API and preserve newer edits and stable-ID reattachments. |
| Temporary absent-request-ID compatibility in 02A, removed in 02B | `accepted_no_downstream_impact` | No production legacy admission remains. Keep fixtures using exact IDs. |
| Startup receipt sweep, passed transaction into group activity, receipt-owned ACK, and bounded post-commit failure state | `accepted_update_downstream_packet` | SPEC-05 must preserve one atomic receipt/activity commit, claim-before-dispatch, startup fencing and session-owned receipt cleanup. |
| Authenticated workspace-handler reconnect preservation and exact turn-ID hydration merge | `accepted_update_downstream_packet` | SPEC-03 must preserve binding before status dispatch and turn-based bubble deduplication; later stream changes must retain it. |
| Exact request-qualified pre-begin Stop/activity release and post-begin companion ownership in files beyond the expected list | `accepted_update_downstream_packet` | SPEC-03/04 must keep request/turn correlation; a late A failure cannot clear or suppress B. |
| Updated staged ACK, Side Chat and renderer fixture adapters to carry authoritative workspace/request/turn identity and await rendered UI | `accepted_no_downstream_impact` | Test-only mechanical integration; no production contract relaxation. |
| Removed inert aggregate `pendingPromptAcceptance`/`retryPromptDraft` production state | `accepted_update_downstream_packet` | SPEC-03 must not reintroduce per-mount pending refs; use the session attempt store. |

No accepted prerequisite is invalidated and no new owner ruling is required. The provisional SPEC-01 test status spelling was reconciled to authenticated `thread:action` / `prompt_receipt_status`, without a new message family. The downstream corrections above are execution-packet guidance and must be included in the relevant fresh orchestrator tasks; the approved normative candidate bytes remain unchanged.

## Residual risks and owner gate

One unchanged Working Activity client assertion remains red for SPEC-04/06. One independent 02B run and two intermediate 02C runs encountered intermittent read locks in disposable SQLite fixtures; raw failures remain recorded, and unchanged-byte retries plus the full submission suite passed without weakened assertions. This is an advisory fixture reliability risk to watch in later test runs, not a demonstrated product defect. An outer workspace lease denial lacks direct attempt correlation, so the client leaves an unresolved attempt gated until authoritative status; a dispatch claim cannot prove external provider execution, and recovery never automatically replays it. Full server suite, performance/soak, native owner symptoms and Alpha smoke were not SPEC-02 acceptance gates and were not claimed.

SPEC-02 meets its submission/recovery acceptance boundary on current evidence. Owner acceptance was received on 2026-09-21; dispatch SPEC-03 in a fresh independent orchestrator task while preserving the downstream corrections above.
