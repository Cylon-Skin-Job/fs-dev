# OE-009 Recovery Candidate Manifest RC2

**Candidate:** `OE-009-RECOVERY-RC2`
**State:** `APPROVED`
**Parent:** `OE-009-RECOVERY-RC1`
**Prepared:** 2026-07-20
**Approval:** explicit owner approval, 2026-07-21
**Release-control policy:** living documents; hash-freeze ceremony retired by owner ruling 2026-07-16

## Candidate Members

1. [RECOVERY-AMENDMENT-RC2.md](RECOVERY-AMENDMENT-RC2.md)
2. [SPEC-05R2-CUSTOM-PALETTE-DURABILITY-IDENTITY.md](SPEC-05R2-CUSTOM-PALETTE-DURABILITY-IDENTITY.md)

## Incorporated Authorities

- [RECOVERY-ROADMAP.md](RECOVERY-ROADMAP.md)
- [SPEC-05R-CUSTOM-PALETTE-RECOVERY.md](SPEC-05R-CUSTOM-PALETTE-RECOVERY.md)
- [SPEC-05-CUSTOM-COLOR-SYNC.md](SPEC-05-CUSTOM-COLOR-SYNC.md)
- [SPEC-04R-WORKSPACE-OFFICE-REHYDRATION.md](SPEC-04R-WORKSPACE-OFFICE-REHYDRATION.md)
- [GUIDANCE.md](GUIDANCE.md)
- [VERIFY-03-GEOMETRY-SMOKE.md](VERIFY-03-GEOMETRY-SMOKE.md)
- [ROADMAP-LEDGER.md](ROADMAP-LEDGER.md)
- [REVIEW-HISTORY.md](REVIEW-HISTORY.md)
- `/Users/rccurtrightjr./projects/Fusion-Home/oe009-run/SPEC-04R/SUPERVISOR-REVIEW.md`
- `/Users/rccurtrightjr./projects/Fusion-Home/oe009-run/SPEC-05R/REPORT.md`

## Issue and Decision Ledger

| ID | Classification | Resolution |
|---|---|---|
| RC2-01 | `spec_contract` | Owned durability debt is confirmed only against the same target and complete trusted write context; equal bytes are insufficient. |
| RC2-02 | `implementation_choice` | Identity-only equal replacement supersedes old debt and requires a fresh durable owned write inside the current episode, without reset/multiplication. |
| RC2-03 | `source_of_truth_contract` | SPEC-04R remains the accepted prerequisite; original SPEC-05 behavior and VERIFY-03/SPEC-06 gates remain unchanged. |

No open owner product decision exists. Owner approval is required only to authorize
this new candidate and fresh automated review budget after the terminal 05R gate.

## Approval Effect

Owner approval naming `OE-009-RECOVERY-RC2`, recorded 2026-07-21, authorizes the
Roadmap Implementation Supervisor to create one fresh SPEC-05R2 execution packet and
spawn one fresh SPEC orchestrator. Approval does not accept current worktree bytes,
waive any original SPEC-05 criterion, reuse prior review passes, complete VERIFY-03,
or open SPEC-06.

## Required Release Evidence

- fresh planning clean-room verdict on the exact current two candidate members;
- explicit owner approval naming `OE-009-RECOVERY-RC2`;
- fresh changed implementation identities relative to terminal 05R composite;
- clean builder, slice-acceptance, and final SPEC adaptive gates;
- exact original/recovery automated suites and eight Electron variants;
- supervisor acceptance and roadmap-ledger reconciliation; and
- later VERIFY-03 plus cross-SPEC recovery gate before SPEC-06.
