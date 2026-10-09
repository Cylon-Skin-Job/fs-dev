# SPEC-04 Slice 04A Post-Repair Builder Review Packet

## Candidate

- Repository: `/Users/rccurtrightjr./projects/fs-dev`
- Branch/HEAD: `agent/exact-workspace-paths` / `88637d11c65be53d4f2ad0f049f64a07fa3db1de`
- Shared dirty checkout: review only the 21 current files sealed by `SOURCE-SHA256.txt` and the associated 04A evidence. Preserve all unrelated bytes; read-only review, no edits.
- Current manifest digest: `2afb3c2e2086ab9cf46e8058ff90538e150473ec9509bc05dfd301423b4882b9`.

## Authority and scope

Review against `AGENTS.md`; release candidate `CHAT-AR-4641ca5897f0`; `SPEC-04.md` slice 04A; the approved roadmap bundle; accepted SPEC-01/02/03 implementation reports, reviews, evidence, and integrated manifests; Chat Wiki overview; and routed code standards 001/002/003/004/008. The complete implementation/deviation/check ledger is `SLICE-04A-IMPLEMENTATION-REPORT.md`.

This is the mandatory fresh builder review after the orchestrator acceptance reviewer `/root/spec04_04a_acceptance` returned **FINDINGS**, retained verbatim in `ORCHESTRATOR-REVIEW-PASS-1.md`. Verify those material findings are actually closed on current bytes:

1. CDP zero assertions must fail closed. Discovery is tracked independently from invocation count, all six zero targets plus the `ChatAreaFooter` positive control must be calibrated in the unmodified production bundle, and a deterministic missing/misspelled-target regression must fail. No production observer/global/bypass may exist.
2. `useLegacyChatHost` must not subscribe the parent to the whole `threads` collection. Explicit production metadata must remain exact, omitted-metadata fixture compatibility may return only exact stable primitives, and unrelated-row replacement must cause zero target parent/header/history/sibling/formatter work while retaining exact text.

Also verify original 04A behavior: exact composer-local draft/attachment/submission observation; stable split contracts; invocation-time command snapshots; duplicate-mount sharing and other-session isolation; caret/selection/IME/autocomplete/paste/drop/resize/emoji semantics; zero draft-induced completed-history formatter/history commits and sibling header/rail/ContentArea renders; and preserved SPEC-02/03 dispatch/action/correlation/group/view-bound New Chat contracts. Do not require 04B Working Activity repair or 04C retirement.

The next fresh reviewer must also verify the repair of builder review pass 2, retained in `BUILDER-REVIEW-PASS-2.md`: each WebSocket is wrapped on construction; the workload waits for combined render/network quiescence; decoded type-only outbound evidence is captured solely while `keyboard.type` is active; enforcement requires the decoded list and count to be empty; and the full default run `chat-arch-1790133916558-82b5890715` records no outbound frames in all ten windows. The failed fast run `chat-arch-1790133762042-1f0b66bf59` decoded `screenshot:request` and failed, demonstrating that the new check rejects real delayed setup traffic rather than silently filtering it.

## Current-byte gates

- Coverage authenticity unit: PASS 2/2.
- V-BUILD: PASS, 1,940 modules.
- V-ISOLATION: PASS 16/16, including unrelated-row locality.
- Full production R1 + correctness after the network-oracle repair: PASS, `chat-arch-1790133916558-82b5890715`; all seven functions discovered; ten windows exact; zero decoded outbound frames in the exact typing interval; zero forbidden render/formatter/long-task work; worst input p95 0.8 ms; worst rAF p95 14.0 ms; positive control 680 total; correctness 2/2; cleanup clean.
- V-SUBMIT: PASS 7/7, `chat-arch-1790132658943-7015bf5aaa`.
- Identity/threaded focused regressions: PASS 29/29.
- Scoped diff check, 21/21 manifest verification, and no-production-probe sweep: PASS.

Post-repair raw evidence is in the `repair-*` files in this directory. Primary immutable runner artifacts remain in the shared runner-owned `evidence/spec-01/01B/<run-id>` directories, as ledgered in the implementation report.

## Disposition requested

Apply the four-part materiality rule from `spec-review-gate`. Report material findings with authority citation, current-byte evidence, consequence, and bounded correction; separate advisories. Return exactly one disposition: `CLEAN`, `NOT CLEAN`, `BLOCKED`, or `AUTHORITY_BLOCKED`. Do not edit files.
