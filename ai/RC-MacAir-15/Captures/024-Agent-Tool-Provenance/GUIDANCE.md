# Agent Tool Provenance Implementation Guidance

## Authority Order

1. Explicit owner decisions in `DECISIONS.md`.
2. Observable contracts in `SPEC-01-AGENT-TOOL-PROVENANCE.md`.
3. Accepted predecessor behavior identified in `ROADMAP.md`.
4. The existing Events/Ledger, Tool Call Provenance, ledger-schema, and File Versioning Wiki pages identified in `ROADMAP.md`, as narrowly overlaid by ATP-D15 through ATP-D17.
5. Routed Code Standards listed in the SPEC.
6. Active code constraints in `CODE-INVENTORY.md`.

Current code behavior is not authority to weaken the approved outcome. Mechanically necessary integration omitted from an expected-path list remains in scope when required to make the slice work.

## Mandatory Slice Lifecycle

Every slice goes to a fresh `spec-slice-builder`. The builder owns the assigned slice and necessary bounded integration, is not alone in the codebase, preserves concurrent/user work, implements forward, runs required checks, documents every deviation, and obtains a materially clean builder-owned review before returning `READY_FOR_ORCHESTRATOR_REVIEW`.

The builder may spawn only fresh `clean-room-reviewer` threads, never another builder. Review has no arbitrary pass ceiling: repair forward and re-review until the first clean pass, then stop.

The SPEC orchestrator independently inspects the work and uses fresh clean-room reviewers, stopping after the first clean pass and otherwise routing repairs until clean. Each new slice gets a new builder. Material acceptance repairs return through a builder, fresh builder-owned review, and fresh orchestrator-owned review. Every descendant inherits the invoking root thread model and reasoning effort.

The orchestrator reports all deviations and downstream effects. The supervisor independently evaluates the completed SPEC and must obtain explicit owner acceptance before any later SPEC.

## Review Priorities

- Facts versus causal claims.
- Raw-data minimization and progressive disclosure.
- Workspace/path/symlink containment.
- Timestamp naming and clock provenance.
- Async ordering, interruption, duplicate terminal events, and crash reconciliation.
- Exact UEB publisher/subscriber capability boundaries.
- Snapshot sparsity/content deduplication and same-path concurrency.
- Durable renderer-projection crash recovery and no-recipient/fallback truth.
- Immutable-root lexical path admission before descriptor-relative observation.
- Mid-turn reservation cancellation and global shutdown phase composition.
- Final-form locked schema/subscription installation across slice boundaries.
- Query isolation, pagination, and strict protocol validation.
- Existing mediated-save and File Viewer regressions.
- Isolation from live database, profile, workspaces, watchers, and real harness processes.

## Status Vocabulary

- `AUTHORITY_BLOCKED`: an indispensable owner choice is absent from the approved packet.
- `BLOCKED`: execution is genuinely impossible after safe in-scope alternatives are exhausted.
- Dirty files, moved code, failed tests, review findings, and bounded integration work are not blockers; reconcile and report them.
