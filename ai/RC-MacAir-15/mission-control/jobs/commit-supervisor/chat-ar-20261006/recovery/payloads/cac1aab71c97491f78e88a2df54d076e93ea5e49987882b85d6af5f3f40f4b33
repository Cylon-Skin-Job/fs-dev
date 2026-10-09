---
name: Events Change Storm Control
description: How high-frequency file changes are compacted or summarized so the ledger remains useful.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Events Ledger Schema
    - Events File Versioning
  source-files:
    - fusion-studio-server/lib/watch/workspace-watcher.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before persisting high-volume file mutation events.

The ledger must preserve that a change storm happened without flooding durable storage or future assistant context. Formatters, generated builds, loops, triggers, schedulers, and external tools can produce many mutations quickly.

`ULV-D04` remains owner-blocked before storm detection, batch persistence, or compaction. In addition to window thresholds, it must approve global detector caps for active windows, tracked workspace/group keys, buffered member refs, timers, diagnostics, pending reconciliation, and aggregate in-memory/serialized state; hard persisted caps for affected path/resource arrays, representative event/version IDs, cause/actor/resource entries, compacting edges, rows per window, diagnostics, and serialized summary bytes; deterministic admission/coalescing/eviction/expiry/cleanup/ordering/selection/deduplication; first/last preservation; overflow counters/flags and follow-up discoverability; crash/restart persistence-or-discard behavior; byte serialization/encoding; cap-conflict precedence; and configuration ownership. Adversarial unique-key or sustained load must remain bounded. Overflow may degrade storm metadata but cannot suppress/delay source facts, drop artifacts before accepted 35f, or merge unrelated keys into false attribution. No implementation may invent defaults or call either the detector or summary bounded before that decision closes.

## Policy Shape

- Producers should emit facts.
- Ledger/versioning subscribers should decide when to compact, summarize, or drop intermediate snapshots.
- Storm records should preserve time range, affected paths, count, actor/provenance, and representative before/after state when available.
- Mixed-cause or mixed-actor storms should summarize attribution in `changeStorm.causeSummary` instead of inventing a single precise top-level cause.
- Limits should be explicit: changes per minute, max versions per file per window, max blob size, and retention behavior.

## First Versioning Slice Shape

Until explicitly promoted to a separate event family, storm batches are versioning/ledger compaction events:

- `eventFamily: 'file.version'`
- `eventType: 'file.version.change_batch'`
- Domain payload key: `changeStorm`

`changeStorm` should include affected paths, count, started/ended timestamps, reason, first/last event IDs, `causeSummary`, and representative before/after hashes or snapshot IDs when available. `causeSummary` should preserve per-confidence, per-cause, and per-actor counts. If compacted events have mixed causes, omit top-level `provenance.cause`; if compacted events have mixed actors, use a non-specific top-level actor and keep actor detail in `changeStorm.causeSummary`.

Every live ID-bearing storm member must come from an accepted canonical delivery ref. A historical member requires an opaque fully revalidated `AcceptedLedgerRowRef`. First/last/representative own identities use ordinary event/domain selectors. Cause/actor/resource IDs embedded in a member require SPEC-39-registered exact target/source `acceptedPayloadPointer` bindings against that capability; whole-object/raw-pointer copies and raw row/status strings never qualify. Raw runtime/candidate IDs, tampered rows, and rejected diagnostics remain outside arrays/summaries as unknown or incomplete diagnostics.

Slice 39d historical edge/query support cannot begin until SPEC-35d and SPEC-40c are accepted. Earlier live storm persistence does not authorize reading raw ledger IDs or rows as historical proof.

Storm-batch persistence/compaction requires explicit file type/size eligibility, threshold, retention, and redaction/hash decisions. Representative hashes require the redaction/hash policy; snapshot or diff references require the snapshot/diff policy decision before persistence.
