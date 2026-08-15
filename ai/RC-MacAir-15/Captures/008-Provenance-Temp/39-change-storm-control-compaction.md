# SPEC-39 - Change Storm Control and Compaction

Status: DISCUSSION DRAFT

## Mission

Prevent high-frequency file changes from flooding the Universal Ledger, file version tables, and future assistant context while preserving enough evidence to prove that the storm happened and inspect representative state.

## Wiki Sources

- [Events Change Storm Control](../../Wiki/010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md)
- [Events And Ledger Decisions](../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md)
- [Universal Ledger File Versioning](../../Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md)
- [Events Provenance Model](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md)

## Related Specs

- [SPEC-32 - Resource Event Sync Controller](32-resource-event-sync-controller.md)
- [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md)
- [SPEC-35 - Universal Ledger Storage, Edges, and Indexes](35-universal-ledger-storage-edges-indexes.md)
- [SPEC-37 - Automation, Trigger, Scheduler, Script, and Agent Provenance](37-automation-trigger-scheduler-provenance.md)
- [SPEC-40 - Provenance Schema Registry and Event Validation](40-provenance-schema-registry-validation.md)

## Scope

This spec covers compaction policy, storm detection windows, storm-batch event shape, retention hooks, and subscriber behavior for ledger/versioning persistence.

It does not stop producers from emitting facts. Producers still emit canonical events; ledger and versioning subscribers decide what to persist in full, summarize, compact, or skip.

Storm control is subscriber-side durability policy. Detection, batching, compaction, or persistence failure must not block or roll back the resource mutations, tool calls, or automation that produced the changes. On failure, preserve safe uncompacted metadata when capacity permits or record a diagnostic/drop count; never invent a cause and never make the source interaction depend on compaction availability.

## Policy Rules

- Producers preserve facts.
- Subscribers filter, compact, summarize, or drop intermediate snapshots according to explicit policy.
- Storm control starts in ledger/versioning subscribers.
- Storm records use the shared provenance envelope.
- First persisted storm batches use `eventFamily: 'file.version'` and `eventType: 'file.version.change_batch'`.
- A separate storm event family requires a future explicit decision.

## Storm Batch Shape

```js
{
  schemaVersion,
  eventId,
  eventFamily: 'file.version',
  eventType: 'file.version.change_batch',
  eventPhase: 'persist',
  occurredAt,
  lifecycle,
  ids,
  actor,
  provenance,
  context,
  changeStorm: {
    stormId,
    reason,
    startedAt,
    endedAt,
    durationMs,
    count,
    persistedEventCount,
    compactedEventCount,
    droppedSnapshotCount,
    affectedPaths: [],
    affectedResourceIds: [],
    firstEventId,
    lastEventId,
    representativeEventIds: [],
    representativeFileVersionIds: [],
    causeSummary: {
      byConfidence: {
        direct,
        correlated,
        inferred,
        unknown
      },
      byCause: [
        {
          causeKey,
          causeId,
          count,
          confidence: 'direct' | 'correlated' | 'inferred' | 'unknown'
        }
      ],
      byActor: [
        {
          actorType,
          actorId,
          count
        }
      ]
    },
    representativeBeforeHash,
    representativeAfterHash,
    policy: {
      changesPerMinuteLimit,
      maxVersionsPerFilePerWindow,
      maxBlobBytes,
      retentionMode
    }
  },
  resources: [],
  redaction
}
```

Representative hashes require the redaction/hash policy from SPEC-33. Snapshot or diff references require the snapshot/diff policy from SPEC-33.

## Detection Windows

Owner-decision inputs for `ULV-D04`:

```text
changes_per_minute_per_workspace
changes_per_minute_per_path
max_versions_per_file_per_window
max_total_blob_bytes_per_window
max_events_per_actor_per_window
storm_window_ms
quiet_window_ms
max_affected_paths_per_batch
max_affected_resource_ids_per_batch
max_representative_event_ids_per_batch
max_representative_file_version_ids_per_batch
max_cause_entries_per_batch
max_actor_entries_per_batch
max_resources_per_batch
max_compacts_edges_per_batch
max_batch_rows_per_window
max_diagnostic_entries_per_batch
max_serialized_summary_bytes
max_active_windows_global
max_active_windows_per_workspace
max_tracked_group_keys_global
max_buffered_member_refs_global
max_detector_timers_global
max_detector_diagnostics_global
max_pending_reconciliation_tasks_global
max_detector_state_bytes
```

No default value or threshold/capacity semantics are approved. `ULV-D04` must set each value, units/boundaries, grouping key, window transition, quiet/reset behavior, and configuration owner before window detection is implemented. Its global detector policy must bound active windows, workspace/key cardinality, buffered member refs, timers, diagnostics, pending reconciliation, and aggregate in-memory/serialized state even when every event uses a unique path/actor and no per-key threshold fires. It must define deterministic admission, coalescing, eviction, expiry, cleanup, overflow/follow-up, and crash/restart persistence-or-discard semantics, including which counts survive and how omitted membership remains honestly discoverable. For every bounded array/edge/row/diagnostic set it must also define deterministic ordering/selection, deduplication, first/last preservation, overflow counters/flags and their exact payload locations, whether omitted IDs remain discoverable through a follow-up query, and behavior when a byte cap is reached. It must define byte measurement/encoding for both persisted summaries and aggregate detector state plus precedence when caps conflict. Capacity pressure may degrade/omit storm metadata or schedule an approved bounded follow-up, but it never suppresses/delays a source resource fact, drops a version artifact before accepted 35f, or combines unrelated keys into false attribution. Implementers must not invent server defaults or call either the detector or summary bounded until this complete policy closes.

## Attribution Handling

Storm batches preserve attribution from the events they compact:

- Every live ID-bearing input comes from an accepted canonical delivery ref. Historical members require opaque `AcceptedLedgerRowRef` capabilities returned only after the trusted repository revalidates accepted status, stored safe payload, schema/policy version, identity columns, and payload hash. A raw row/status string never qualifies, and the compactor never accepts raw runtime/candidate IDs or rejected diagnostics as storm members.
- `firstEventId`, `lastEventId`, and representative event/domain IDs use each member capability's own event/domain selectors. Any `affectedResourceIds`, cause/actor summary IDs, top-level attribution, or edge target embedded inside a member requires a SPEC-39-registered exact target/source `acceptedPayloadPointer` binding against that live ref or historical capability; whole-object copying and raw pointer reads are forbidden. Missing/unregistered values are omitted and counted under unknown/incomplete diagnostics outside ID arrays.

- If all compacted events share a direct cause, keep that cause on the storm record.
- If events have mixed causes, set `provenance.confidence: 'inferred'` or `unknown` as appropriate and store cause counts in `changeStorm.causeSummary`.
- For mixed causes or mixed actors, omit top-level `provenance.cause`; use a non-specific top-level actor unless all compacted events share one actor, and keep per-cause/per-actor detail only in `changeStorm.causeSummary`.
- If events are watcher-only external changes, do not infer UI/tool/automation causation.
- Keep `actor`, `context`, and `resources[]` when representative and safe.
- Project affected paths/resources into `resources[]` and/or `ledger_event_resources`, and index `changeStorm.reason`, so storm queries do not depend on full JSON scans.

## Ledger Edges

The ledger should create:

- `compacts` edges from the storm batch to compacted event IDs where retained.
- `represents` edges to affected resources and representative versions.
- No `caused_by` edge until owner-approved/back-validated `LED-D03`. After closure, only its exact builder-verified pointer/domain/confidence matrix may qualify; “safely correlated” endpoints remain correlation evidence unless that decision explicitly permits the branch.

## Persistence Behavior

First implementation:

1. After `ULV-D04` closes, always keep a compact summary within every approved item/edge/row/diagnostic/serialized-byte bound and expose its approved overflow diagnostics.
2. Keep first and last event IDs when available.
3. Keep representative before/after hashes only when redaction/hash policy permits.
4. Skip intermediate snapshots once the threshold is exceeded.
5. Preserve enough counts and paths to diagnose runaway scripts, formatters, triggers, or watchers.

## Migration Slices

### Slice 39a - Owner Decision Settlement (No Implementation)

Obtain owner approval for `ULV-D04`'s exact threshold/window values; global active-window/workspace/key/member/timer/diagnostic/reconciliation/in-memory capacities; every persisted summary/edge/row/diagnostic/byte capacity; deterministic admission/coalescing/eviction/expiry/cleanup/selection/deduplication/truncation/overflow/follow-up and crash/restart semantics; byte measurement; cap precedence; and configuration owner/location. The decision must prove detector overflow cannot suppress/delay source facts, drop artifacts before 35f, or create false attribution. Update SPEC-33, SPEC-39, the master/map, and wiki, then run the decision clean-room loop. This slice produces an approved decision record only and changes no runtime.

### Slice 39b - Versioning Subscriber Windowing

Blocked until `ULV-D04` is owner-approved and back-validated. Then teach SPEC-33's versioning subscriber to identify storm windows using only those approved values/semantics.

### Slice 39c - Storm Batch Persistence

Do not persist storm batches until ULV-D03, ULV-D04, ULV-D05, and ULV-D10 are owner-approved/back-validated, SPEC-35b canonical storage is accepted, and branchwise registry Slice 40b2d3 is active. Snapshot or diff references additionally require ULV-D02 and active 40b2d2.

Only then persist `file.version.change_batch` events and `changeStorm` payloads through SPEC-35b. Do not write `compacts`, `represents`, or any other storm edge before SPEC-35d is accepted, and do not compact or drop any event/version artifact before SPEC-35f is accepted.

### Slice 39d - Edge and Query Support

After SPEC-35d and SPEC-40c are accepted, add only the approved `compacts` and `represents` traversal/query support, including revalidated historical members. Any `caused_by` branch additionally requires owner-approved/back-validated LED-D03. Without 40c, 39c may persist accepted live storm batches but 39d does not start and no raw ledger row/ID substitutes for a historical capability.

### Slice 39e - Retention Enforcement

Blocked until accepted SPEC-35f and owner-approved/back-validated `ULV-D05`. Retention that touches snapshots/diffs/blobs additionally requires `ULV-D02`, `ULV-D03`, and `ULV-D10`; storm-artifact retention also requires `ULV-D04` and active 40b2d3. Only then apply the exact approved retention policy.

## Completion Criteria

- High-frequency changes cannot create unbounded file-version or ledger rows.
- Storm batches preserve time range, affected paths, counts, attribution, and representative state where safe.
- Producers remain simple canonical event emitters.
- Audit queries can identify storm windows and trace representative changes.
- Slice 39b runs `cd fusion-studio-server && npm test -- --runInBand test/provenance/storm-windowing-boundaries.test.js`; using the exact approved ULV-D04 values, cover every per-key and global detector threshold/window/count/state-byte boundary at minus-one, exact, and plus-one. Include adversarial one-event-per-unique-path/actor/workspace streams, sustained load, simultaneous paths/workspaces, global key/window/member/timer/diagnostic/reconciliation exhaustion, rapid quiet/reset/window transitions, concurrent arrivals at a boundary, deterministic admission/coalescing/eviction/expiry/overflow/follow-up, cleanup, crash/restart/replay, and identical outcomes across repeated runs. Assert exact live state/cardinality/byte counts throughout and prove overflow never suppresses/delays source facts, drops artifacts before accepted 35f, or merges unrelated attribution.
- Slice 39c runs `cd fusion-studio-server && npm test -- --runInBand test/provenance/storm-persistence-bounds.test.js`; assert exact maximum event/version/summary/diagnostic rows and serialized bytes, cap-precedence behavior, overflow counters/flags, first/last preservation, follow-up discoverability, transaction rollback/retry/idempotency, and that detection before accepted 35f never suppresses, compacts, or drops any source/version artifact.
- Slice 39d runs `cd fusion-studio-server && npm test -- --runInBand test/provenance/storm-edge-bounds.test.js`; assert exact per-batch/global edge caps, deterministic representative selection, duplicate/conflict behavior, concurrent batches, restart/replay, and query reachability for every omitted-but-follow-up-discoverable member. Test every registered `acceptedPayloadPointer` target/source pair plus wrong source pointer, wrong target, scalar/type mismatch, unregistered pair, whole-object copy, live-ref success, and revalidated-historical success.
- Slice 39e runs `cd fusion-studio-server && npm test -- --runInBand test/provenance/storm-retention-compaction.test.js`; assert the approved retention boundaries, concurrent cleanup, restart/replay, exact remaining row/edge/artifact counts, crash-safe transaction boundaries, and that only accepted 35f policy can compact/drop artifacts.
- All four slices also run `cd fusion-studio-server && npm test -- --runInBand test/provenance/storm-failure-isolation.test.js`, which proves detection/compaction/storage/redaction failure never affects producers and never leaks unsafe representative material/hashes. It seeds raw/rejected/unpublished IDs plus malformed/mismatched ledger rows; none enter arrays, summaries, attribution, or edges.
