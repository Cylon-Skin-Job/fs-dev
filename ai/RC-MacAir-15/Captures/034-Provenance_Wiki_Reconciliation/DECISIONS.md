---
name: "Provenance Reconciliation Authority And Decisions"
description: "Provenance Reconciliation Authority And Decisions for the documentation-only provenance reconciliation."
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Authority and decisions

## Owner decisions recorded from this conversation, 2026-09-19

| ID | Settled contract | Authority / state |
|---|---|---|
| PW-D01 | `fusion.db` is SQLite and is **System**. It owns mutable Fusion system configuration as well as durable history. | owner_decision / propagated_pending_review |
| PW-D02 | System includes chat sessions/threads, families/groups, chosen thread metadata, registrations, permissions, subscriptions, ledger, provenance, versions, snapshots, and recovery records. Do not conflate user wording “families” with a new schema or rename existing thread-group identities. | owner_decision / propagated_pending_review |
| PW-D03 | Connected apps/services remain authoritative for their live email/calendar/notes and similar content. Views display and act on that source through integrations. Fusion's System DB is not a second live application-content store. | owner_decision / propagated_pending_review |
| PW-D04 | Workspace apps may use Markdown, JSON, CSV, or a separate workspace SQLite database. Such a database is workspace content, not `fusion.db`. System DB ownership does not require moving all existing file-backed configuration/view state into SQLite. | owner_decision / propagated_pending_review |
| PW-D05 | Plugins use defined system interfaces and approved capabilities; they may generate governed system events. They cannot create arbitrary System tables, use System as app storage, or grant themselves authority. Platform-owned schema evolution remains distinct from plugin access. | owner_decision / propagated_pending_review |
| PW-D06 | Historical snapshots are auditing/recovery copies, not a live editable replacement source. Restoring to an authoritative source is a separate permitted operation; no universal restore mechanism or new snapshot policy is approved here. | owner_decision / propagated_pending_review |
| PW-D07 | Preserve durable history by default; cleanup is an explicit user-controlled policy. This does not make mutable system configuration immutable or establish that existing delete APIs are absent. Exact lifecycle rules remain future work. | owner_decision / propagated_pending_review |
| PW-D08 | Reconcile documentation only; preserve dirty/concurrent work, snapshot substantive wiki edits, preserve navigation, and do not touch product code, tests, DBs, app processes, Alpha, commits, or publishing. Chat and its named shared page/artifacts remain owned elsewhere. | owner_decision / propagated_pending_review |
| PW-D09 | Future specs consult checked wiki guidance first; do not re-ask settled decisions. Ask only about material contradictory or missing owner intent, not facts answerable by source inspection. | owner_decision / propagated_pending_review |

The preceding conversation explicitly confirmed both mutable System control records and durable history. “Frozen history” is a purpose description, not a claim of cryptographic immutability, enforced append-only storage, or a ban on every existing deletion route.

## Source and contract hierarchy

Classify evidence as `owner_decision`, `spec_contract`, `source_of_truth_contract`, `active_code_constraint`, `implementation_choice`, or `proposal`. New owner direction supersedes only its exact subject. Source proves implementation, not desirability. Tests present in the tree prove intended assertions only. Historical reports are dated receipts; neither their clean result nor draft headers prove today's behavior or approval state.

Capture 023 `DECISIONS.md` MVP-D09/D14/D15 approves the bounded save-only snapshot and trusted admission model. MVP-D14 supersedes older accepted-reference, causal-confidence, and broader file-versioning gates only for the four MVP SPECs. Its preimage rows are not canonical general file-version events.

Capture 024 `DECISIONS.md` ATP-D15/D16/D17 narrowly overlays tool observational facts, bounded checkpoint storage, and two admitted ledger facts. It does not approve all older `chat.tool.*`, native-ref, captured-output, automation, causal-graph, restoration, or retention branches. Consult implementation/integration acceptance records as well as planning headers.

`Captures/002-SPECs/TABS-PROVENANCE-BRIDGE/` supplies BRIDGE-01 accepted context-carrier behavior and BRIDGE-02 Chat conformance contracts. BRG-D09 reuses the mediated-save carrier; it does not implement the proposed `ui.action` subsystem. Preserve the explicit distinction between a historical context snapshot and current view-state ownership, and between reported local-client context and authenticated human causation.

Capture 008 remains planning/history input. Translate still-supported durable intent into understandable prose; do not preserve every old exact executor, lease, envelope, or capacity as approved future direction. Classify an unconfirmed design as proposal or unresolved rather than making it mandatory. Capture 030 explicitly has mixed authority levels and Capture 032 is design-phase, not implementation proof. New PW-D01–07 apply to their exact storage/interface boundary, not wholesale plugin design approval.

## Non-blocking product deferrals

| ID | Unresolved scope / future trigger | Owner |
|---|---|---|
| PW-O01 | Exact retention/deletion tiers, durations, user controls, redaction/export/encryption and interaction with current delete behavior; resolve before a data-lifecycle feature SPEC. Preservation direction is already settled. | Product owner |
| PW-O02 | Restore coverage, UI, conflict handling, provider capabilities, and snapshot eligibility beyond existing bounded implementations; resolve before a restore/integration SPEC. | Product owner |
| PW-O03 | General plugin registration/emission/permission grammar and extension ABI; resolve before activation of arbitrary plugins. The no-arbitrary-System-storage boundary is settled. | Product owner / plugin program |
| PW-O04 | Broad automation/audit/storm/canonical-file-version/causal-graph contracts left open after exact accepted overlays; resolve only when a future build requires them. | Product owner |
| PW-O05 | Calendar's System DB content projection conflicts with PW-D03. Record current behavior and target gap; removal/migration/alternative data access is a later product SPEC. Do not drop tables or data in this task. | Product owner / calendar implementation owner |

These deferrals do not block accurate documentation: state what is current, what is approved, and what is unapproved. A new genuine ambiguity blocking a truthful sentence is recorded and asked narrowly while independent slices continue. Do not turn every future feature detail into an approval question.
