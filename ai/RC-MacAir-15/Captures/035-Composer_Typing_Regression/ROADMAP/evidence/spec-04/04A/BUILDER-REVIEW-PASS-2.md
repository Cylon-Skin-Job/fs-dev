# SPEC-04 Slice 04A Builder Review — Repair Pass 2

- Reviewer: `/root/spec04_slice04a/review_04a_repair_pass2`
- Role: fresh read-only `clean-room-reviewer`
- Candidate: 21/21 manifest hashes verified; manifest digest `acfa1c557001142d066d834a0e0c64053727af3a8734e06fd517a88ab0ed756a`
- Terminal disposition: **NOT CLEAN**
- Lifecycle: terminal completion confirmed by reviewer final result. `close_agent` is unavailable in this runtime, so no closure call could be attempted; this is lifecycle evidence only.

## Material finding

R1 recorded opaque nonzero `wsSent` values in three production typing windows but did not assert zero or retain decoded frame types. This violated the required zero network/canonical event-bus writes during ASCII typing and made the report's zero-prompt-frame claim unauthenticated. The bounded correction was to capture decoded outbound frame types only across the exact `keyboard.type` interval after focus/warm setup and quiescence, enforce an empty list, repair any typing-time trigger, rerun R1, and reseal affected hashes/evidence.

## Verified closed findings

- CDP coverage discovery/calibration independently covered all six zero targets plus `ChatAreaFooter`, the missing-target regression failed closed, and no production observation hook/global existed.
- `useLegacyChatHost` no longer subscribed to the full thread collection; exact primitive fallbacks and the unrelated-row locality regression were sound.

## Advisories

- Correct the stale legacy-host line count from 529/530 to the current 546 lines.
- Runner manifests do not bind every helper/product input; the sealed source manifest remains the current-byte identity.
- 04B/04C gates remain properly deferred.

The finding was validated and repaired forward. This pass is retained and is not reclassified by later review.
