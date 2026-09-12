# Orchestrator Guidance

## Dispatch model

Use one fresh orchestrator for VIEW-01. After its report is independently
reviewed and owner-accepted, use a new fresh orchestrator for VIEW-02. Do not
give one worker concurrent ownership of both domains.

## Mandatory preflight for each SPEC

1. Resolve and record repository root, branch, HEAD, and dirty paths.
2. Read repository `AGENTS.md`, the SPEC, this bundle's decisions/issues, and
   every routed code-standard page.
3. Re-inventory active paths and tests; do not trust this survey as byte
   identity.
4. Reproduce accepted prerequisite identity using TABS-03's implementation
   report and the exact immutable-commit/ledger commands in this bundle's
   release manifest.
5. Treat a mismatch as a reconciliation trigger, not automatic failure. Explain
   whether it is an accepted downstream change or an unexplained contract drift.
6. Record attributable paths before editing and preserve unrelated changes.

## VIEW-01 lifecycle

- Build the protected-route resolver and migration coordinator before changing
  the canonical path returned to ordinary consumers.
- Add the durable journal migration before executing any filesystem move.
- Exercise old-only, new-only, both, and neither fixtures before moving the live
  development capsule tree.
- Move the live tree through the same product service used for fixtures; do not
  manually rearrange only the known capsules.
- Update template destinations and active documentation only after code and
  recovery tests pass.
- Verify the live tree and preserve all pre-existing state/theme bytes by
  inventory digest and explicit dirty-path comparison.

## VIEW-02 lifecycle

- Add one strict server-side parser and normalized wire projection before
  consuming tab policy in React.
- Keep the generic shell and placement controller unchanged unless an actual
  accepted-contract defect is demonstrated. A local convenience mismatch is
  solved in the connected adapter.
- Extract Capture- and File-specific adapters/controllers into focused modules
  rather than expanding `viewTabAdapters.ts` or an existing controller beyond
  the code standards.
- Convert one adopter at a time. Run focused behavior and public-shell tests for
  Capture before File Explorer.
- Preserve the existing state owner and prove acknowledged, observable atomic
  placement commits. Do not add a generic Zustand store.
- Add only code-owned launchers. Side Chat must not appear, even disabled.

## Fail-forward review

Each implementation uses the SPEC orchestrator's independent-review policy.
Material findings are repaired and re-reviewed by a fresh reviewer. The report
must classify every deviation as compatible, approved, blocking, or deferred;
it must not silently broaden the SPEC.

## Required implementation report contents

- exact source candidate ID and prerequisite evidence;
- implementation and merge commits;
- attributable changed-path inventory;
- migration/config schema actually shipped;
- public contracts exported or consumed;
- every test/build/visual command and result;
- crash/restart and durability evidence;
- dirty-path preservation evidence;
- deviations and residual risks;
- exact post-implementation fingerprint instructions and result;
- explicit statement that direct unsandboxed host writes remain out of scope.

## Acceptance checkpoints

VIEW-01 acceptance is owner-controlled and does not authorize VIEW-02 until its
report is accepted. VIEW-02 acceptance requires the owner-facing visual walk in
the SPEC. BRIDGE-01 remains blocked until the owner explicitly accepts VIEW-02
and declares the view-platform milestone complete.
