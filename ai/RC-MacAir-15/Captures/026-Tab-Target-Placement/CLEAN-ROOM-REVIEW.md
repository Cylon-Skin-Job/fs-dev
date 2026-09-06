# TABS-03 Clean-Room Review

**Status:** `CLEAN — AWAITING OWNER APPROVAL`  
**Reviewed:** 2026-09-05  
**Mode:** Fresh read-only current-byte review

## Scope

The reviewer read the complete TABS-03 bundle, shared Tabs/Provenance
coordination contracts, TABS-01/TABS-02/TABS-02A SPECs and implementation
reports, the repository guidance and routed code standards, and the relevant
active component-tab code/tests and client package scripts.

The review checked owner-intent fidelity, dependency gates, exact target
identity, disposition order, degraded-state compatibility, strict validation,
state/effect ownership, commit acknowledgement, concurrent placement, failure
privacy, verification feasibility, scope containment, and the exported
BRIDGE-01 boundary.

## Review loop and repairs

Fresh passes identified and the bundle repaired:

- an early reference to resolver output before creation-time resolution;
- ambiguity between invalid collection ownership and recoverable invalid,
  unavailable, legacy, or unaddressed tab bodies/presentation;
- incomplete atomic commit acknowledgement and concurrency-lane duration;
- missing exact shape and byte bounds for resolver-supplied tab display fields;
- an unconditional regression gate for a test already documented as
  non-hermetic in the accepted TABS-02A evidence;
- undefined `requestId` recovery for partially valid malformed requests;
- a stale invariant range after concurrency requirements were added;
- contradictory zero-exit wording around the diagnostic runtime test; and
- a missing exact 256-byte `requestId` bound.

Each material repair was recorded in `DECISIONS.md` or `ISSUES.md`. The reviewer
then reread the latest bytes rather than relying on the prior diagnosis.

## Historical pre-refresh result

The final reviewer verdict was:

> CLEAN — no material findings in the latest planning bundle, shared
> coordination contracts, prerequisite surfaces, standards, or active-code
> feasibility.

## Current-candidate refresh

Fresh reviewer `tabs_03_candidate_review_1` returned `NEEDS_REPAIR` on
2026-09-04. It found one material dependency-status contradiction in SPEC §14:
the final dispatch-gate sentence still called TABS-02A acceptance pending even
though the predecessor is owner-accepted. The sentence now identifies only the
refreshed TABS-03 clean-room verdict and exact candidate approval as remaining
gates. The normative candidate was re-fingerprinted as
`TABS-03-368499fab9ff1071`; a fresh reviewer must inspect those repaired bytes.

The review-agent lifecycle reached a terminal result. A separate close action
is unavailable in this environment.

Fresh reviewer `tabs_03_candidate_review_2` then returned `NEEDS_REPAIR`. It
found that the normative algorithm could treat a structurally valid exact
target with a temporarily unavailable renderer/body as either matchable or
skipped. The SPEC, decision ledger, issue ledger, invariants, and required tests
now make rendering availability non-authoritative: a valid addressed descriptor
and correlated shell always participate in exact matching, while structurally
invalid, legacy, and unaddressed records remain protected and skipped. This
prevents duplicate targets during degraded rendering.

After pass 2, the then-current normative bytes were candidate
`TABS-03-f48054c64d786ea9`, which the third reviewer inspected. The second
review-agent lifecycle reached a terminal result; a separate close action is
unavailable.

Fresh reviewer `tabs_03_candidate_review_3` returned `NEEDS_REPAIR`. It found
that §7.3's phrase “any malformed active record” could reject the same protected
nested-invalid record that §7.2 required `current` to skip and append around.
The active-identity rule now rejects only malformed outer collection or
active-identity ownership. A uniquely identified active record with protected
nested component/tab-presentation/shell invalidity remains unfillable and
causes append. Slice 1 and the public-host matrix now require that exact case.

The resulting normative bytes are candidate `TABS-03-9683fd552866ec41`.
All three independently authorized reviewer passes reached terminal results;
each produced one material finding that is now repaired. The default
three-reviewer budget is exhausted, so a fresh extended certification pass
requires explicit owner authorization. Separate agent-close control is
unavailable in this environment.

On 2026-09-05, the owner authorized `loop until clean`, extending review until
the first materially clean fresh pass, subject to the skill's anti-spiral and
substantive-blocker stops.

Fresh reviewer `tabs_03_candidate_review_4` independently inspected candidate
`TABS-03-9683fd552866ec41` and returned `CLEAN` with no material findings. It
reproduced all ten manifest hashes, aggregate
`9683fd552866ec4126d19f2c7cd6b2a4c32a8d72911792387f5f4caa8ceb2b46`,
candidate ID, the accepted 22-path TABS-02A preflight
`f91b7cb7eb6263040c39c1931fbeef401c68c98e4157476c32eb6636f2210a35`,
and scoped documentation integrity. The reviewer reached a terminal result;
separate agent-close control is unavailable.

## Current final result

> CLEAN — no material findings in candidate
> `TABS-03-9683fd552866ec41`.

This certifies the planning candidate only. Product implementation and runtime
proof remain governed by the SPEC's slice, test, build, review, and final owner
acceptance gates.

## Advisories

- RC accepted TABS-02A on 2026-09-04. The dependency-status reconciliation and
  exact preflight command are included in the now-clean candidate.
- `e2e/view-tab-runtime.spec.ts` remains governed by its separately documented
  diagnostic expected-outcome rule.
- The current clean verdict certifies the exact candidate bytes. Explicit owner
  approval still authorizes dispatch.
