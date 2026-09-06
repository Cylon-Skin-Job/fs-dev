# TABS-03 Implementation And Review Guidance

## Dispatch prerequisites

Implementation may begin only when:

1. the owner has accepted the exact TABS-02A implementation baseline;
2. the owner has approved the candidate ID in `RELEASE-MANIFEST.md`; and
3. the worker verifies that the accepted baseline still matches or records an
   explicit preflight deviation before editing.

## Slice lifecycle

Each slice is assigned to a fresh `spec-slice-builder`. That builder:

1. owns only the slice files and mechanically necessary integration;
2. preserves concurrent/user changes and never reverts unrelated work;
3. implements the slice, self-reviews it, and runs the slice checks;
4. records every deviation and downstream effect;
5. obtains fresh builder-owned `clean-room-reviewer` passes, repairing forward
   until the first materially clean pass; and
6. returns only when `READY_FOR_ORCHESTRATOR_REVIEW` or genuinely blocked.

A builder may spawn only fresh `clean-room-reviewer` agents, never another
builder. There is no arbitrary review-pass ceiling. Every descendant inherits
the invoking root task's model and reasoning effort.

## Orchestrator lifecycle

The SPEC orchestrator independently inspects the delivered slice, checks the
working-tree delta, reruns required evidence, and obtains fresh orchestrator-
owned clean-room review. Findings are repaired forward through the owning
builder until the first clean pass. A new builder owns each new slice.

Material acceptance repairs return through a builder, a fresh builder-owned
review, and a fresh orchestrator-owned review. The orchestrator reports all
deviations, compatibility effects, exact changed paths, evidence, and residual
deferrals.

After final SPEC integration, the implementation supervisor presents the whole
TABS-03 result to the owner and obtains explicit acceptance before dispatching
BRIDGE-01 or any later roadmap package.

## Implementation guardrails

- Keep React presentation prop-driven; UI sources emit one typed placement
  intent and do not reproduce matching or placement logic.
- Keep one connected owner for mutable tab state. Do not add a Zustand store,
  context singleton, event bus, or service for this package.
- Validate hostile/unknown inputs before reading nested values or invoking
  callbacks. Reject accessors, symbols, inherited properties, unknown fields,
  unsafe keys, excess depth/size, and invalid IDs consistently with the generic
  host.
- Never use labels, breadcrumbs, filenames, extensions, paths, or DOM IDs as
  identity.
- Never replace a populated tab, consume a reserved Empty tab, or mutate state
  after a rejected request.
- Do not publish UEB/provenance facts or add server routes as “integration.”
- Do not adopt a production view during TABS-03.

## Deviation policy

Mechanically necessary integration inside the stated changed areas is allowed
when it preserves all observable contracts. Any change to matching identity,
dedupe order, disposition semantics, failure behavior, identity minting,
reservation ownership, provenance boundary, production adoption, or dependency
order is material and requires owner review before acceptance.
