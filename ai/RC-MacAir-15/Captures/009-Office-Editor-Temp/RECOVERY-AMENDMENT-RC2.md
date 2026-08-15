# OE-009 Recovery Amendment RC2

**Status:** `APPROVED`
**Candidate:** `OE-009-RECOVERY-RC2`
**Parent:** `OE-009-RECOVERY-RC1`
**Prepared:** 2026-07-20
**Approved:** 2026-07-21 by explicit owner approval
**Execution model:** living amendment packet; no hash-freeze ceremony

## Outcome

Recover the terminal SPEC-05R durability-identity failure through a fresh changed
candidate, complete the unchanged original SPEC-05 contract, and preserve the
already accepted SPEC-04R workspace-rehydration baseline.

## Evidence Requiring This Amendment

SPEC-05R Slice 05R.1 exhausted discovery `3/3` and reserved confirmation `1/1`.
The terminal reviewer proved that equal canonical bytes under a replacement target
inode or replacement trusted parent/target identity can clear destination durability
debt even though the coordinator-owned rename's write context no longer exists.
The candidate reported success, emptied debt, marked the owned token verified, and
left no timer. This violates the approved rule that byte equality is not durability
confirmation.

Exact retained evidence:

- terminal composite `8f92619d02efa63e830b8d5dc50d25c669faa697bc053813940638e2ac9a32c2`;
- `/Users/rccurtrightjr./projects/Fusion-Home/oe009-run/SPEC-05R/REPORT.md`;
- `/Users/rccurtrightjr./projects/Fusion-Home/oe009-run/SPEC-05R/RUNLOG.md`; and
- terminal reviewer `/root/spec05r/slice_05r_1/slice_05r_1_reserved_confirmation`.

## Authority Order

1. Current owner direction and approval of candidate `OE-009-RECOVERY-RC2`.
2. [SPEC-05R2-CUSTOM-PALETTE-DURABILITY-IDENTITY.md](SPEC-05R2-CUSTOM-PALETTE-DURABILITY-IDENTITY.md) for the narrow identity-bound repair and fresh execution mechanics.
3. [SPEC-05R-CUSTOM-PALETTE-RECOVERY.md](SPEC-05R-CUSTOM-PALETTE-RECOVERY.md) for the unchanged retry-recovery and completion contract.
4. [SPEC-05-CUSTOM-COLOR-SYNC.md](SPEC-05-CUSTOM-COLOR-SYNC.md) and [GUIDANCE.md](GUIDANCE.md) for the complete original product and shared engineering contract.
5. Accepted [SPEC-04R-WORKSPACE-OFFICE-REHYDRATION.md](SPEC-04R-WORKSPACE-OFFICE-REHYDRATION.md) behavior as the prerequisite integration baseline.
6. Current roadmap/SPEC orchestration and adaptive-review skills for process mechanics.

No amendment sentence weakens an original SPEC-05 or SPEC-05R criterion. A conflict
outside the explicit durability-identity repair is an owner ruling, not builder
discretion.

## Ordered Work

| Order | Packet | Dependency | Completion effect |
|---:|---|---|---|
| 1 | [SPEC-05R2-CUSTOM-PALETTE-DURABILITY-IDENTITY.md](SPEC-05R2-CUSTOM-PALETTE-DURABILITY-IDENTITY.md) | accepted SPEC-04R | SPEC-05 becomes accepted only after identity repair, picker cutover, full integration, eight Electron variants, and supervisor acceptance |
| Gate | [VERIFY-03-GEOMETRY-SMOKE.md](VERIFY-03-GEOMETRY-SMOKE.md) | independent of 05R2; required before SPEC-06 | closes the remaining SPEC-03 evidence residual or produces a new amendment if a product defect appears |

SPEC-06 remains blocked until both rows complete successfully.

## Recovery Invariants

- The same destination and complete trusted write context—not equal bytes—must prove
  durability for an owned rename.
- Replacement identity retires the old debt as superseded and requires a fresh
  trusted write/durability operation; it cannot verify the original owned write.
- Identity-only equal replacement does not multiply/reset the logical retry episode.
- Genuine external byte/flag changes, registry changes, and new user intents retain
  the existing reset semantics.
- The accepted SPEC-04R rehydration/correlation behavior remains green.
- No live workspace/config/database, SPEC-06 behavior, versioning, provenance, or
  generalized retry framework enters scope.

## Execution and Final Gate

Run SPEC-05R2 through one fresh SPEC orchestrator and fresh slice builders. Every
builder owns a fresh adaptive reviewer gate; the orchestrator independently inspects
and accepts each slice and runs a fresh final SPEC integration gate. The supervisor
alone accepts SPEC-05 and updates the roadmap ledger.

After SPEC-05R2 acceptance, the recovery roadmap still requires VERIFY-03 and a
cross-SPEC final gate before SPEC-06 can begin.

## Approval Requirement

The owner explicitly approved candidate `OE-009-RECOVERY-RC2` on 2026-07-21.
Approval authorizes a fresh review budget on a materially changed candidate; it does
not accept current worktree bytes or erase prior failures.
