# SPEC-04 Slice 04A Builder Review — Repair Pass 3

- Reviewer: `/root/spec04_slice04a/review_04a_repair_pass3`
- Role: fresh read-only `clean-room-reviewer`
- Candidate: 21/21 hashes verified; manifest digest `2afb3c2e2086ab9cf46e8058ff90538e150473ec9509bc05dfd301423b4882b9`
- Terminal disposition: **CLEAN**
- Lifecycle: terminal completion confirmed by reviewer final result. `close_agent` is unavailable in this runtime, so no closure call could be attempted; this is lifecycle evidence only.

## Material findings

None.

## Verified

- CDP discovery is independent from invocation counts, covers all six zero targets plus `ChatAreaFooter`, and the missing-target regression fails closed.
- No production observer/global remains.
- `useLegacyChatHost` has no whole-`threads` subscription; omitted metadata selectors return stable addressed primitives, and unrelated-row replacement produces zero target parent/header/history/sibling/formatter work.
- WebSockets are wrapped at construction; measurement waits for render/network quiescence, captures decoded type-only sends solely during `keyboard.type`, and rejects any captured frame.
- Failed run `chat-arch-1790133762042-1f0b66bf59` rejected `screenshot:request`; final run `chat-arch-1790133916558-82b5890715` has zero outbound frames in all ten windows.
- Original 04A draft locality, duplicate-mount sharing, input semantics, stable contracts, invocation snapshots, and SPEC-02/03 preservation are supported by current source and evidence.
- Coverage authenticity 2/2, V-ISOLATION 16/16, identity/threaded 29/29, V-BUILD, V-SUBMIT 7/7, full production R1, scoped diff, and manifest verification are coherent and passing.

## Deviation dispositions and advisories

- D-04A-1 through D-04A-3 and R-04A-1 through R-04A-3: proposed accepted as bounded mechanically necessary connected-leaf, compatibility, and test-oracle work with no later-slice product expansion.
- Advisory: runner manifests do not bind every helper/product input; the sealed 21-file source manifest is the candidate identity.
- Advisory: native focused-window acceptance, five-minute typing, 04B history/live work, and 04C host retirement remain downstream gates.

Final disposition: **CLEAN**.
