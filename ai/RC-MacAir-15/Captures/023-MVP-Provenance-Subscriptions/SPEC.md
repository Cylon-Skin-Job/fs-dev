# MVP Provenance and Governed Subscriptions SPEC Bundle

**Bundle status:** `CANDIDATE — OWNER APPROVAL REQUIRED`  
**Implementation authority:** None until the owner approves the exact release candidate ID  
**Scope:** Database-backed event/subscription authority, a governed UEB subscription runtime, one mediated text-file-save provenance path with before snapshots, and File Viewer live rendering through central Zustand state

## Outcome

This bundle establishes the smallest architecture that Fusion Studio can build on without redoing event delivery, permissions, provenance, or renderer refresh:

```text
local client intent at the current transport assurance
  -> server command controller
  -> capability and schema checks
  -> durable before snapshot when the operation is in the MVP snapshot class
  -> owning file mutation
  -> server-authored resource fact
  -> existing UEB firehose
  -> database-governed subscription controller
      -> minimal provenance ledger subscriber
      -> renderer resource-projection subscriber
  -> existing WebSocket connection
  -> central Zustand file-data store
  -> File Viewer selector
  -> React re-render without menu refresh
```

The UEB carries facts. Commands do not travel through the UEB. Subscribers may invoke a separately authorized named command, and any result becomes a new fact.

## Authority Order

Interpret requirements in this order:

1. the owner's decisions recorded in this bundle's `DECISIONS.md`;
2. this exact hashed bundle after approval;
3. the active Code Standards hub at `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` and the exact routed pages in `ROADMAP.md` and each SPEC;
4. durable decisions in `../022-Vision_Roadmap/DECISIONS.md`, especially D-043 through D-046 and D-052 through D-053;
5. the current Events and Ledger Wiki, except where this approved bundle explicitly narrows or supersedes its MVP implementation sequence;
6. active code and tests as implementation constraints, not product intent;
7. `../008-Provenance-Temp/`, `../010-ModularizeDB-Temp/`, `../012-App_Federation/`, and `../019-System_Manager/` as source evidence and future-horizon design material.

Conversation text is source material, not an unversioned execution authority. Any later owner correction must be written into the affected bundle documents, assigned or linked to a decision ID, re-hashed, and re-reviewed before an orchestrator may act on it.

The broad `008-Provenance-Temp` plan remains useful future design input. Upon approval of this bundle's exact candidate ID, the conditional notices shipped in the 008 map, TODO index, and affected Wiki pages atomically make this bundle the sole MVP implementation-planning authority. Its accepted-reference cells, proof leases, exhaustive causal confidence gates, watcher migration, full chat/tool schemas, storm control, and complete ledger graph then remain deferred hardening rather than MVP prerequisites.

## Bundle Documents

- [ROADMAP.md](ROADMAP.md) — dependency order, milestones, and owner gates.
- [GUIDANCE.md](GUIDANCE.md) — shared implementation, review, safety, and deviation rules.
- [DECISIONS.md](DECISIONS.md) — reconciled owner decisions and their source classification.
- [ISSUES.md](ISSUES.md) — verified current gaps and explicitly deferred questions.
- [CODE-INVENTORY.md](CODE-INVENTORY.md) — current paths, constraints, and tests builders must start from.
- [SPEC-01-DATABASE-REGISTRY.md](SPEC-01-DATABASE-REGISTRY.md) — locked system catalog, schema/subscription definitions, requests, and grants.
- [SPEC-02-SUBSCRIPTION-CONTROLLER.md](SPEC-02-SUBSCRIPTION-CONTROLLER.md) — database-compiled UEB subscription runtime and explicit compatibility boundary.
- [SPEC-03-MEDIATED-FILE-PROVENANCE.md](SPEC-03-MEDIATED-FILE-PROVENANCE.md) — mediated text-file save, mutation facts, ledger queries, stable resource identity, and before snapshots.
- [SPEC-04-FILE-VIEWER-LIVE-RENDER.md](SPEC-04-FILE-VIEWER-LIVE-RENDER.md) — renderer projection, central Zustand cutover, and first live proof.
- [RELEASE-MANIFEST.md](RELEASE-MANIFEST.md) — exact reviewed candidate paths and hashes.

## MVP Completion

The MVP is complete only when SPEC-01 through SPEC-04 are implemented and explicitly accepted in order, and the File Viewer runtime proof demonstrates that an app-mediated UTF-8 text-file save changes the already-open document without menu refresh, while the same operation is queryable by path and linked to its before snapshot.

## Explicit Exclusions

This bundle does not implement:

- arbitrary external filesystem-change provenance or a promise to live-refresh such changes;
- macOS Calendar, Email, or other connector ingestion;
- full chat, exchange, harness, or tool-call provenance;
- per-keystroke history;
- arbitrary JavaScript subscribers, raw SQL access, raw database handles, or raw UEB access for iframe/custom views;
- plugin discovery/import, a Systems permission UI, or configuration write-through;
- automatic permission grants from files, assistant edits, scripts, or supervisor AIs;
- a generic causal inference engine, confidence booleans, accepted-reference leases, or path/time proximity promoted to fact;
- Office dirty-buffer conflict handling or the general reusable editor controller;
- create/move/rename/delete provenance conversion, directory-tree snapshots, large/binary-file restore, retention/compaction, or a restore UI;
- replacement of React built-in views with iframe views.

## Dispatch Rule

No implementation may begin from this candidate. After clean-room review, the owner must approve the exact candidate ID in `RELEASE-MANIFEST.md`. Roadmap execution then uses `$roadmap-implementation-supervisor`, one SPEC at a time, with explicit owner acceptance before the next SPEC.
