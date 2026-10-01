# Plugin System — Handoff

**Capture:** root handoff · **Parent:** [`plugin-system-vision.md`](./plugin-system-vision.md)
**Updated:** 2026-09-15

## Current state

- The plugin program's captures now live in fs-dev:
  [`030-Plugin_System/`](./plugin-system-vision.md) (root vision + system) and
  [`../032-Plugin_Backend/`](../032-Plugin_Backend/backend-architecture.md)
  (backend architecture). The plug-ins repo is the archive/catalog-to-be and is
  linked, not moved.
- The chat roadmap (025) is complete and owner-accepted; a small advisory-repair
  SPEC (`SPEC-05-ADVISORY-REPAIRS.md`) is executing in a separate session; the
  chat update is not yet committed/pushed.
- No fs-dev code exists for the plugin system. Mockup SPEC-01 is still a draft
  in the plug-ins archive awaiting owner approval.

## Next actions (in order)

1. Owner review of this suite and the backend capture.
2. Execute/land the chat repair SPEC; review; commit/push decision (owner call).
3. **Classification session** — resolve `PLUG-I001` (policy vs contribution vs
   content vs platform; preinstalled-first-party question). This gates consent
   treatment and the manifest grammar.
4. Owner approval of the Plugins-view mockup; dispatch it in an isolated
   worktree per its build discipline (additive-only, flag-gated, no migrations).
5. Backend modularization target selection (`PLUG-I008` seam, backend capture
   §5) — pick the first server capability to extract behind a stable command
   surface.

## Constraints to carry

- Nothing here is an approved SPEC; fs-dev `AGENTS.md`, the Wiki, and accepted
  SPECs remain platform authority.
- No commit/amend/push without explicit owner request; preserve unrelated
  worktree bytes; isolated ports/profiles for any test work.
- Provenance publication for new families remains gate-blocked; design around
  it, don't couple to it (backend capture §2).

## Previous handoffs

None — first handoff of this suite (2026-09-15).
