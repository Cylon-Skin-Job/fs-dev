---
name: Events File Versioning
description: How resource mutation events will attach to before and after snapshots, diffs, restore, and file history.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Events Provenance Model
    - Events Ledger Schema
    - Universal Ledger File Versioning and Provenance
  source-files:
    - fusion-studio-server/lib/ledger/event-ledger-subscriber.js
  connected-skills: []
  related-trigger-files: []
---

> **Schema correction authority (2026-07-15):** Apply [provenance schema finding 5](../../../Captures/008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat. The metadata/hash-only label does not approve concrete file-version hashes; the separate-policy branch remains an owner decision.

Use this page before designing SQLite file version storage.

File versioning should be a ledger subscriber over canonical resource events. It should not become a second filesystem watcher, a Git wrapper, or a parallel mutation source of truth.

Metadata/hash-only version rows are not a policy-free fallback. `ULV-D03` must approve which file types, sizes, and classes may receive any version record, including binary/generated/large/temp/ignored/symlink/unsupported handling. `ULV-D05` must approve retention/deletion for metadata rows, edges, and indexes as well as snapshots/diffs/blobs. Together with `ULV-D10` hash/redaction approval, both block metadata/hash-only persistence. `ULV-D12` additionally requires owner approval of the exact non-batch event types, phase/lifecycle and envelope presence, identity/idempotency, bounds, ordering/dedupe/replay/retry/restart, safe failure branches, and subscriber/ledger transaction boundaries; conceptual generic/unknown fields are not defaults. SPEC-35b storage must be accepted and live-ref-only registry Slice 40b2d1 must be active before live metadata emission; before 40b2d1h, restart/replay uses D12's approved omit/diagnose/defer branch and performs no raw-ID backfill. Historical replay/backfill additionally requires accepted SPEC-40c and active 40b2d1h. SPEC-35d is required before version edges. Content artifacts additionally require `ULV-D02` and active 40b2d2. Storm batches require ULV-D03/D04/D05/D10, accepted SPEC-35b, and active 40b2d3; 39d historical edge/query support requires accepted 35d and 40c, and compaction/drop requires accepted 35f.

## Future Responsibilities

- Capture before/after snapshots or blobs for eligible file mutations.
- Store diffs or derived summaries where useful.
- Link each version to the canonical resource event that caused or observed it.
- Preserve reachability to UI actions, assistant tool calls, harness ID/run/event, trigger, scheduler, script, automation run, sync/import, agent, system, audit, or external observations through the accepted source resource event. Copy an earlier identity directly only when the version producer separately holds and builder-binds that original live accepted ref or a revalidated historical capability; never transitively copy embedded upstream IDs from the resource event.
- Support restore and forensic query workflows without depending on Git status.

The resource-sync work must preserve event identity and provenance hooks, but version storage belongs to the versioning build unless explicitly folded in.
