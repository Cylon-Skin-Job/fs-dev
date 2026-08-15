# Office Editor SPEC Bundle

**Bundle status:** `APPROVED — LIVING`
**Fail-forward revision:** `OWNER APPROVED 2026-07-22`
**Candidate ID:** `OE-009-RC1` (historical provenance identifier)
**Execution state:** Continue from `ROADMAP-LEDGER.md` on current bytes
**Scope:** Office editor table operations, table presentation, and workspace custom-color palettes

This is the entry point for the dependency-ordered Office Editor SPEC bundle. There is deliberately no monolithic Office Editor SPEC.

## Current Authority

Interpret authority in this order:

1. explicit current owner direction;
2. current `GUIDANCE.md` and `ROADMAP.md`;
3. the current SPEC packet, including any owner-supersession notice;
4. current Wiki architecture; and
5. active-code constraints, which inform feasibility but do not redefine product intent.

`REVIEW-HISTORY.md`, `ROADMAP-LEDGER.md`, retired recovery packets, old reports, run logs, and release manifests provide traceability. They do not override the current authority above. Hashes and candidate IDs identify reviewed bytes only; changed hashes never block dispatch or acceptance.

## Builder Contract

A fresh builder receives one current SPEC packet, current `GUIDANCE.md`, accepted prerequisites, and the exact validation/deviation requirements needed for that slice. Expected files are advisory, not an allowlist.

The builder:

- completes slices in order;
- performs mechanically necessary and bounded integration omitted from the packet;
- records every deviation and out-of-scope touch;
- repairs failed tests and validated review findings;
- reviews current bytes until the first clean pass without an arbitrary pass ceiling; and
- returns `READY_FOR_ORCHESTRATOR_REVIEW`, `AUTHORITY_BLOCKED` for an indispensable owner decision, or `BLOCKED` for a genuine execution impossibility.

The orchestrator independently inspects and validates the work, classifies deviations and downstream impact, routes corrections, and returns the completed SPEC to the supervisor. The supervisor presents the complete result to the owner. The next SPEC cannot start until the owner explicitly accepts the current SPEC.

## Bundle Documents

- [ROADMAP.md](ROADMAP.md) — current dependency graph, execution order, and acceptance workflow.
- [GUIDANCE.md](GUIDANCE.md) — current shared engineering, testing, fail-forward, and reporting rules.
- [ROADMAP-LEDGER.md](ROADMAP-LEDGER.md) — current execution state, accepted prerequisites, retired routes, and residuals.
- [REVIEW-HISTORY.md](REVIEW-HISTORY.md) — chronological owner rulings and historical execution evidence; later rulings supersede conflicting earlier entries.
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — decision traceability; current owner supersessions inside that file retire conflicting historical entries.
- `SPEC-00` through `SPEC-11` — individual implementation packets listed by the roadmap. Current owner-supersession notices override conflicting historical packet bodies.
- [RELEASE-MANIFEST.md](RELEASE-MANIFEST.md) and recovery manifests — retired release-control archaeology only. They are never execution gates.
- [CAPTURE.md](CAPTURE.md), [DECISIONS.md](DECISIONS.md), and [ISSUES.md](ISSUES.md) — requirements-session evidence, not builder instructions.

## Explicit Exclusions

This bundle does not implement or modify:

- document versioning, revision history, checkpoints, or undo-stack persistence outside ordinary ProseMirror history;
- provenance schemas, provenance capture, ledger integration, or provenance event work;
- native DOCX/XLSX/PPTX editing or import; or
- unrelated Office search, recent-document, thumbnail, save-pipeline, or general editor defects.

SPEC-11 owns only the narrow presentation-aware Print/PDF/DOCX bridge required by the ratified table contracts.

## Dispatch And Completion

An owner-approved roadmap/SPEC and its current authority are sufficient for dispatch. No hash match, freeze, candidate regeneration, manifest ceremony, clean-worktree requirement, or fixed review budget is required.

Implementation proceeds fail-forward until current bytes satisfy the approved observable behavior and required checks. Every deviation remains visible through builder, orchestrator, supervisor, and owner review. Only explicit owner acceptance completes a SPEC and unlocks the next one.
