---
name: Events And Ledger
description: Durable map for Fusion Studio events, Universal Event Bus, ledger provenance, resource mutations, file versioning, and future system-improvement loops.
metadata:
  incoming-edges:
    - Wiki Guidance
  outgoing-edges:
    - Events And Ledger Vision
    - Events And Ledger Decisions
    - Events Universal Event Bus
    - Events Taxonomy
    - Events Provenance Model
    - UI Action Provenance Module
    - Events Ledger Schema
    - Events Resource Events And Render Sync
    - Events File Versioning
    - Events Correlation And Causality
    - Events Change Storm Control
    - Events Assistant Query And Review Loops
    - Events And Ledger Structure
    - Chat Harness And Event Flow
    - Universal Event Bus Standards
    - Resource Event Sync Controller
    - Universal Ledger File Versioning and Provenance
  source-files:
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/lib/ledger/event-ledger-subscriber.js
    - fusion-studio-server/lib/watch/workspace-watcher.js
    - fusion-studio-server/lib/watch/core.js
    - fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
  connected-skills: []
  related-trigger-files: []
---

Start here before changing event emission, event subscription, ledger storage,
file/resource mutation tracking, provenance, or any feature that turns system
activity into durable knowledge.

Events And Ledger is the system memory layer for Fusion Studio. It connects
runtime facts from the Universal Event Bus, chat turns, tool calls, UI actions,
triggers, scheduler runs, resource mutations, and future file versions into a
queryable history. The short-term purpose is reliable resource/render sync. The
long-term purpose is a knowledge graph of system behavior that can support
forensic debugging, restore, optimization suggestions, and recursive
self-improvement.

This section is broader than chat. Chat remains one producer and consumer of
events, but the ledger must also understand workspace resources, views, files,
folders, render invalidation, automation, background workers, and external
changes observed through the filesystem.

Orient with [Vision](001-Vision/PAGE.md) and [Decisions](002-Decisions/PAGE.md) before designing event names, metadata fields, provenance rules, resource sync behavior, or ledger subscribers.

<!-- section-toc:start -->
## Guidance and Preferences

- [Vision](001-Vision/PAGE.md) - Product and developer goals for event provenance, ledger history, file versioning, render/resource sync, and future assistant-led system analysis.
- [Decisions](002-Decisions/PAGE.md) - Durable decisions for Fusion Studio events, Universal Event Bus usage, resource/render sync, ledger provenance, and future file versioning.

## Technical Articles in this Wiki Section

- [Universal Event Bus](../001-Universal_Event_Bus/PAGE.md) - Canonical firehose rules for Fusion Studio events, subscriber boundaries, and producer responsibilities.
- [Event Taxonomy](../002-Event_Taxonomy/PAGE.md) - Categories for UI actions, chat lifecycle, tool calls, harness events, triggers, scheduler runs, resource mutations, render events, and external observations.
- [Provenance Model](../003-Provenance_Model/PAGE.md) - How event metadata records actor, observer, confidence, causal IDs, UI context, tool call IDs, trigger run IDs, script run IDs, and external changes.
- [Ledger Schema](../004-Ledger_Schema/PAGE.md) - SQLite event table concerns for payload storage, indexes, retention, correlation IDs, and graph-style relationships between events.
- [Resource Events And Render Sync](../005-Resource_Events_And_Render_Sync/PAGE.md) - How file and folder mutations flow through UEB into cache invalidation and React/Zustand state without private per-view listeners.
- [File Versioning](../006-File_Versioning/PAGE.md) - How resource mutation events will attach to before and after snapshots, diffs, restore, and file history.
- [Correlation And Causality](../007-Correlation_And_Causality/PAGE.md) - How the system links watcher observations to UI actions, tool calls, trigger runs, scheduler scripts, and nearby file versions.
- [Change Storm Control](../008-Change_Storm_Control/PAGE.md) - How high-frequency file changes are compacted or summarized so the ledger remains useful.
- [Assistant Query And Review Loops](../009-Assistant_Query_And_Review_Loops/PAGE.md) - How future workers can inspect conversations, tool calls, file versions, and failures to surface concrete improvements.
- [Structure](../010-Structure/PAGE.md) - File and module map for event bus, ledger, watcher, resource sync, metadata collectors, and future versioning work.
- [UI Action Provenance Module](../011-UI_Action_Provenance_Module/PAGE.md) - Central client module contract for capturing UI-origin command context, normalized resources, and handoff to server-owned UI action provenance.
<!-- section-toc:end -->

## Related Existing Pages

- [Provenance Schema Cross-Article Findings](../../../Captures/008-Provenance-Temp/provenance-schema-findings.md) - Active correction and unresolved-issue log. Together with owner direction in chat on 2026-07-15, it is the authority for the current schema-alignment corrections; decision-tagged findings remain open.
- [Chat Harness And Event Flow](../../007-Chat_System/002-Harness_And_Event_Flow/PAGE.md)
- [Chat Universal Event Bus](../../007-Chat_System/002-Harness_And_Event_Flow/003-Universal_Event_Bus/PAGE.md)
- [Canonical Events](../../007-Chat_System/002-Harness_And_Event_Flow/002-Canonical_Events/PAGE.md)
- [Universal Event Bus Standards](../../005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md)
- [Persistence And Metadata Standards](../../005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md)
- [Provenance Spec Set Map](../../../Captures/008-Provenance-Temp/00-provenance-spec-set-map.md)
- [Provenance Implementation Master Plan](../../../Captures/008-Provenance-Temp/01-provenance-implementation-master-plan.md)
- [Resource Event Sync Controller Spec](../../../Captures/008-Provenance-Temp/32-resource-event-sync-controller.md)
- [Universal Ledger File Versioning Spec](../../../Captures/008-Provenance-Temp/33-universal-ledger-file-versioning.md)
- [UI Action Provenance Module Spec](../../../Captures/008-Provenance-Temp/34-ui-action-provenance-module.md)
- [Universal Ledger Storage, Edges, and Indexes Spec](../../../Captures/008-Provenance-Temp/35-universal-ledger-storage-edges-indexes.md)
- [Harness, Tool, and Native Reference Provenance Spec](../../../Captures/008-Provenance-Temp/36-harness-tool-native-ref-provenance.md)
- [Automation, Trigger, Scheduler, Script, and Agent Provenance Spec](../../../Captures/008-Provenance-Temp/37-automation-trigger-scheduler-provenance.md)
- [Audit Query and Review Provenance Loops Spec](../../../Captures/008-Provenance-Temp/38-audit-query-review-provenance-loops.md)
- [Change Storm Control and Compaction Spec](../../../Captures/008-Provenance-Temp/39-change-storm-control-compaction.md)
- [Provenance Schema Registry and Event Validation Spec](../../../Captures/008-Provenance-Temp/40-provenance-schema-registry-validation.md)
