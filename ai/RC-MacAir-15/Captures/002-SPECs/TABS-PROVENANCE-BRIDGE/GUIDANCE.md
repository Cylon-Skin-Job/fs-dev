# TABS-PROVENANCE-BRIDGE — Implementation Guidance

**Applies to:** BRIDGE-01 (`SPEC-01-COMPONENT-TAB-ACTION-CONTEXT.md`).
**Does not apply to:** BRIDGE-02 (`SPEC-02-…`), which is contract-only and has no
implementation slices.

This bundle-local guidance states the mandatory lifecycle, sequencing, and
reporting rules for executing a SPEC in this bundle. It is subordinate to
`../../../../../AGENTS.md` and the routed code standards; where they conflict,
they win.

## 1. One slice, one fresh builder

- Each slice is owned by exactly one fresh `spec-slice-builder`, which
  implements the slice plus any mechanically necessary omitted integration.
- A builder may spawn only fresh `spec-gate-reviewer` subagents. It must never
  spawn another builder, an orchestrator, or a clean-room loop of its own.
- The builder self-reviews, runs the slice's required checks, records every
  deviation, and repairs forward until its first clean builder-owned review. No
  arbitrary pass ceiling.
- The builder returns `READY_FOR_ORCHESTRATOR_REVIEW` only after that first
  clean pass.

## 2. Independent review and integration

- The SPEC orchestrator independently inspects the slice and runs fresh
  `spec-gate-reviewer` passes, stopping after the first clean pass and otherwise
  routing repairs back through the owning builder.
- A new slice is handled by a new builder. Material acceptance repairs return
  through a builder, a fresh builder-owned review, and a fresh
  orchestrator-owned review.
- Each pipeline role runs on its pinned per-agent model and effort (configured
  in the agent definitions); do not substitute another model or effort.

## 3. Deviation accounting

- Every deviation from the SPEC is recorded with: contract clause, actual
  change, reason, tests/effect, and risk/downstream impact.
- A compatible deviation never requires an owner ruling; an incompatible or
  scope-changing deviation is returned to the owner before acceptance.
- No deviation may activate SPEC-34/SPEC-40 machinery, provenance rendering,
  retention, non-mutating telemetry, or edits to frozen TABS-03 placement types.

## 4. Reporting and acceptance

- The orchestrator reports all deviations and downstream effects.
- The supervisor presents the completed SPEC to the owner and obtains explicit
  acceptance before the next SPEC dispatches.
- BRIDGE-02 does not dispatch until BRIDGE-01 is owner-accepted.

## 5. Worktree and commit discipline

- Never commit unless RC asks; the working tree is the candidate.
- Preserve unrelated user/worker changes and generated/runtime files.
- Verification gates for this bundle are listed in `SPEC-01` §10 and
  `HANDOFF.md` §8.
