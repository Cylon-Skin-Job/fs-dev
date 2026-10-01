# Logger architecture hold and rebase

Status: **planning predecessor retained; not ready for implementation dispatch**.
Direction recorded 2026-09-27 PDT / 2026-09-28 UTC.

## What changed

The owner placed this logger within the broader governed UEB/subscriber, real-time rendering, system event ledger/audit and plugin/view program. HL-01-6e4c29f469a4 remains an independently reviewed predecessor, not an approved implementation candidate for this revised direction. Its clean review covers its exact historical normative hashes only.

## Required rebase

- Inventory and reuse existing schemas and measurement owners. Specify genuinely new health observation schemas, units, clocks, identities, correlation and privacy rules; do not insert telemetry into an incompatible mutation schema.
- Extend the governed producer/admission/subscription/capability foundation where absent. Do not use a bespoke telemetry service or legacy chat bus subscription as a silent governance bypass. Existing governed capabilities are bounded; this is not currently plug-and-play.
- Diagnostics and logger share scalar derivation at each stage. Renderer receipt and server arrival remain different stages. UI-open/reset must not reset cumulative logger observations or double-count; raw opt-in Diagnostics remains separate and ephemeral.
- Distinguish required operational/provenance protection from best-effort sampled health. Do not make typing/rendering await health writes, or convert every sample into a durable primary-system ledger record.
- Keep separate SQLite retention and content-free boundaries; preserve personal notes/bookmarks/history in fusion.db. No raw recording import or export wiring.
- Plan a narrow host-owned adapter seam for future optional plugin packaging. Register views through the forthcoming plugin authority; expose protected server functions through granted capabilities, not ambient server/DB access. Exact sequencing is still to be designed.
- Revalidate N, intervals, queue/cap/overhead defaults against current code, then issue a new coherent candidate and independent review before implementation approval.

## Canonical follow-up

[Follow-up TICKET](../../../mission-control/launchpad/fusion-health-and-governed-observability/TICKET.md) owns new synthesis. This bundle preserves the predecessor planning artifacts and original decisions; do not create two competing executable plans. [CHAT-AR closure](../ROADMAP/SPEC-06-OWNER-CLOSURE-ADDENDUM.md) does not approve this logger or claim it currently covers residual defects.
