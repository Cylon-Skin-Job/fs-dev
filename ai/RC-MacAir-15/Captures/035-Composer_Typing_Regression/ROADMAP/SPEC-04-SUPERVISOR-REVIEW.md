# SPEC-04 supervisor review

Candidate: `CHAT-AR-4641ca5897f0`. Review date: 2026-09-24 PDT. State: `owner_review`; SPEC-05 remains blocked pending explicit owner acceptance.

## Contract and integrated result

SPEC-04 was to separate draft, completed-history, live-turn and workspace-content observation lifetimes; preserve shared-draft, submission, action, routing and finalization behavior; and retire the aggregate Legacy host and duplicate production docks. Its ordered slices 04A–04C delivered those boundaries on the accepted SPEC-01–03 baseline. The canonical handoff is `SPEC-04-IMPLEMENTATION-REPORT.md`; slice reports, review records and raw receipts are under `evidence/spec-04/` and the shared isolated runner artifact tree.

The final shell gives `ConnectedChatComposer` exact draft/submission observation, stable message revisions and bounded mounted-history formatting caches, an exact active-view session host, and a sibling `ContentArea` boundary. The Legacy host/hook and content-local worksurface docks are deleted. Automatic null-view list/open and inactive-view reconnect sweeps are removed while explicit historical null-view reads and cleanup remain supported. No SPEC-05 work was started.

## Evidence inspected

- The orchestrator returned `SPEC_READY_FOR_SUPERVISOR_REVIEW` after all three slices reached clean builder-owned and independent orchestrator-owned review. The final fresh integration reviewer returned `CLEAN` on the integrated manifest, current source, cross-slice contracts, final receipts, deviations and owner gate.
- Supervisor independently verified all 64 current hashes and four declared deletions against `evidence/spec-04/INTEGRATED-SOURCE-SHA256.txt`. Its digest is `4a14fc89ab94fc82b401d1b77f54caaedb0e8e70e82ddbf72996c8ecefc764e9`; the canonical implementation-report hash is `a70c71e95832550d1ad73d3a3b936e35c33fa7d57f6b246616c311530f5b3068`. Scoped `git diff --check` passes. The checkout remains uncommitted at baseline HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, with unrelated owner/concurrent work preserved.
- Full V-RENDER `chat-arch-1790228222155-271e516a9a` passed F1, all ten focused short R1 windows, composer correctness, R7 and R9. Final short walls were 1,961–2,008 ms against the unchanged 2,550-ms limit; input p95 was at most 0.7 ms, next-rAF p95 at most 16.9 ms and max 18.3 ms; text retention and focus held; long tasks, typing-time outbound frames, formatter work and draft-induced history/header/rail/content renders were zero.
- The five-minute run `chat-arch-1790228438993-225fac9ea0` passed 9,520/9,520 input and rAF samples with exact text. It measured 351,517 ms against the approved 456,960-ms budget, input p95/max 1.4/2.2 ms, next-rAF p95/max 17.7/21.0 ms, zero long tasks, zero measured outbound frames, zero history/header/rail/content/formatter work, valid focus before and after, SQLite quick-check `ok`, removed fixture roots and no lingering owned PID.
- Final integration reruns passed V-ACTIONS (`chat-arch-1790229825954-c2235cb769`), V-SUBMIT (`chat-arch-1790229996244-f9de301ac6`), V-SHELL (`chat-arch-1790230105635-f4e233ea08`), V-ISOLATION 18/18, architecture/oracle/lifecycle 21/21, host/identity/observation 64/64, side/worksurface integration 44/44 and the 1,940-module client build.
- The first unlocked full-render attempt retained one isolated 2,567-ms wall-only excursion, 17 ms above the unchanged limit. Its other signals were clean, and thirty unchanged-source/final-manifest windows passed without threshold changes. It is retained as non-reproduced host scheduling jitter, not hidden as a product repair.
- The first focused sustained run correctly failed on two delayed screenshot-bootstrap frames. The repaired oracle waits for the bounded ordered capture/updated/request/data lifecycle and a stable 500-ms traffic sequence before creating measurement evidence, then records every typing-interval frame without type filtering and still requires exactly zero. The wall formula was corrected to the authority-owned `characters × delay × 1.5` rule. The clean builder and orchestrator reviews independently verified this fail-forward repair.

## Deviation decisions and downstream packet corrections

| Departure | Classification | Downstream action |
| --- | --- | --- |
| Connected composer/history/header leaf boundaries and cohesive shell/router touches beyond the narrow expected list | `accepted_no_downstream_impact` | Required to establish the approved lifetimes; UI behavior and accepted SPEC-02/03 contracts remain covered. |
| Shared runner artifact roots and executable R7/five-minute cases | `accepted_update_downstream_packet` | SPEC-06 should reuse the authenticated, isolated runner contracts and retained raw evidence rather than invent a new oracle. |
| Fail-closed positive CDP calibration, decoded exact typing-interval traffic capture and staged-window focus prerequisite | `accepted_update_downstream_packet` | Later R1/native/soak work must preserve positive target calibration, exact unfiltered traffic evidence and refusal to measure without valid focus. |
| Equal accepted-snapshot projection rebuild | `accepted_no_downstream_impact` | Limited to the exact current turn; ordinary stale equal/lower snapshots remain rejected. |
| Legacy host/hook, duplicate docks, null-view bootstrap and inactive reconnect sweeps removed | `criterion_required` | No compatibility exception remains. Historical persisted null-view data stays readable/cleanable through explicit routes only. |
| Sustained wall-formula and screenshot-quiescence repair | `accepted_update_downstream_packet` | SPEC-06 must retain the VALIDATION 1.5× budget and observable ordered bootstrap/quiet boundary without filtering measured traffic. |
| Real outer-rail worksurface/Side Chat migration | `accepted_no_downstream_impact` | Persistence, relaunch restoration, isolated delete and exact active-view discovery remain covered. |

No accepted prerequisite was invalidated and no new owner design decision is required. The downstream corrections are verification and integration contracts for SPEC-06, not changes to the approved product direction.

## Residual risks and owner gate

The required SPEC-04 surface is green. The whole-program/full-boot suite is not represented as universally green: the retained owned-boot result is 129/130 because one out-of-scope SPEC-05-facing diagnostic assertion expects stale status text while the accepted visible denial behavior is newer. V-ALL, the full server suite, native/IME input, the 45-minute mixed soak and explicit owner reproduction of the original freeze remain SPEC-05/06/program gates and are not claimed here.

No live development or Alpha database/profile, fixed port 3001, destructive migration, commit, push, Alpha operation or SPEC-05 implementation was used.

SPEC-04 meets its independent-rendering-lifetime acceptance boundary on current evidence. The owner must explicitly accept this review before the supervisor may dispatch SPEC-05 in a fresh independent orchestrator task.
