# 05C in-progress source inspection

Product repairs routed to builder05c; root makes no product edits.

1. Exact retirement callback must capture drainId and runtime ownership. Check ownership after finalization and before stopping provider, after provider wait, after session retirement. Removed runtime and replacement-then-clear must invalidate old callbacks. Builder has added identity/revision guards and tests; awaiting current final evidence.
2. Prompt admission first `!wire || !current()` branch made later stale-binding cleanup unreachable, leaving still-owned IN_FLIGHT state on transport retirement. Builder repaired and added retirement-after-reservation regression; cumulative504+ tests passed later checkpoint.
3. Stop fallback whole-manager reach-through violated explicit owner dependencies. Builder replaced with transport capability projection; inspect final source/manifests at gate.
4. Terminalized drain could accept later canonical mutations after terminal publication failure. Builder added terminalized gate, exact turn match and tests with retained snapshot; cumulative506 checkpoint passed.
5. Current dispatch/automation finally only clears terminalized turns. Pre-begin provider failure or empty iterator leaves no turn; runtime becomes READY with retained activeDrain. Resource busy reports draining forever, Delete rejects, ordinary Stop rejects READY. Routed to builder with required failure/empty-iterator regressions and owned orphan cleanup; pending repair/evidence. Preserve replacement no-op and failure-to-stop fences.

These are validated source-level concerns within05C, not authority changes. Final dispositions depend on current-byte evidence and independent reviews.

Finding5 disposition: builder confirmed old factory-shape tests expected retained pre-begin record. Root authorized bounded correction: inspect identity/control during dispatch, then require completed owned orphan cleanup; preserve STOPPING on real retirement failure. This corrects stale test assumptions under05C lifecycle contract, not an owner intent change. Current submission2 finishes before repair; final cumulative backend/submission and fresh review follow.

Finding5 repair visible: both iterator-finally owners clear exact current drain when state is not STOPPING, using captured revision ownership. Four empty/pre-begin failure tests and corrected claim-time shape assertions pass cumulative23/510 in backend9. Builder then added two failed-provider-stop fence regressions; current-byte final cumulative evidence pending. No additional known product issue from inspection.

All current repair gates passed before root acceptance review: builder backend10 and root independent backend each23/512 with matching source; full submission4 all7 and root distinct-receipts repeat passed. Failed-stop regressions confirm STOPPING/drain/busy retained when termination fails. Submission3 one readback-lock timeout remains unexplained evidence limitation; unchanged full rerun and independent targeted repeat did not reproduce. Fresh acceptance review in progress; no known open material source finding.
