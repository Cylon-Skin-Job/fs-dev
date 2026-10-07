# Plugin foundation — issues

> Sourced gaps and consequential unresolved intent; no implementation defect is inferred from a planning question.

## Scope and contracts

### I-001 — Installed package home

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** [plugin vision](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>); current setup conversation and linked predecessor records.
- **Observation:** The recent owner phrasing ai/plug-ins and the newer vision’s flat System/plugins/<plugin-id>/ convention have not been reconciled to one exact installed path.
- **Affected scope:** Plugin foundation and named consumers.
- **Consequence:** Discovery, registration, updates and folder ownership depend on the path.
- **Resolution needed:** Choose one canonical installed root and clarify machine versus workspace scope.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Recheck cited current sources and bring the specific choice or finding into this folder.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).

### I-002 — First proving plugin

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** [plugin vision](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>); current setup conversation and linked predecessor records.
- **Observation:** The historical inbox example and the proposed logger proof are candidates; the owner has not selected the first proof.
- **Affected scope:** Plugin foundation and named consumers.
- **Consequence:** The first contract slice cannot be minimized against a concrete consumer yet.
- **Resolution needed:** Select a bounded real plugin and its observable enable/disable/denial journey.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Recheck cited current sources and bring the specific choice or finding into this folder.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).

### I-003 — Contract drift

- **Category:** scope and contracts
- **Type:** inconsistency
- **Severity:** unassessed
- **Status:** open
- **Source:** [plugin vision](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>); current setup conversation and linked predecessor records.
- **Observation:** Older fs-dev decisions describe category subdirectories; the later plugin vision explicitly makes installed categories derived and paths flat.
- **Affected scope:** Plugin foundation and named consumers.
- **Consequence:** A roadmap could freeze contradictory package grammar.
- **Resolution needed:** Reconcile classification, atomic package unit, manifest and permission vocabulary before executable planning.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Recheck cited current sources and bring the specific choice or finding into this folder.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).

### I-004 — Callable function completion contract

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 request to encode the direct app-command flow and question whether calls need separate async/normal lists; [UEB command/fact contract](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md); [backend command-surface design](../../../Captures/032-Plugin_Backend/backend-architecture.md).
- **Observation:** One asynchronous renderer-to-server callable interface with immediate-result and background-run completion modes is a working recommendation, not yet a frozen manifest or runtime contract.
- **Affected scope:** Plugin function declaration, result handling, lifecycle and first proof; background-run and event contracts have sibling owners.
- **Consequence:** A first implementation could accidentally put every click through a queued subscriber or make long-running work block a view request.
- **Resolution needed:** Define callable identity, inputs/results, completion-mode declaration, run ID, time/budget, cancellation, idempotency, failure/receipt and grant checks; set per-plugin/capability invocation rates, accounting and overload responses; choose a proof that exercises the smallest necessary subset.
- **Owner:** Owner for product choices; assigned main folder session for plugin contract and dependency routing.
- **Next:** Carry the proposed two-mode shape into the first-proof discussion and request exact sibling contracts before executable planning.
- **Related:** [D-003](DECISIONS.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-005 — Plugin access to meaningful UI actions

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 custom-view and UI-event discussion; [UI Action Provenance Module](../../../Wiki/010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md).
- **Observation:** The owner wants approved plugin subscriptions to meaningful UI actions, but the general UI-action publisher and plugin subscription/emission interface are future work. Current mediated-save context is narrower.
- **Affected scope:** Plugin subscription declaration and grants; governed UI-action event schemas belong to the event owner.
- **Consequence:** A plugin manifest cannot treat raw clicks or reported tab context as an already-authorized durable event feed.
- **Resolution needed:** Name the first eligible UI action, its host owner, payload/context and grant; distinguish direct calls from subscribed facts and route producer/schema work to the existing event owner.
- **Owner:** Owner for product choices; assigned main folder session for plugin contract and dependency routing.
- **Next:** Include one concrete UI action in the first-proof discussion only if that proof requires it.
- **Related:** [D-003](DECISIONS.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-006 — System read query event policy

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 question about async inner-DB reads and separate event-bus logging; [plugin vision §4.11](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>); [UEB command/fact boundary](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md).
- **Observation:** Plugin-facing System queries can be asynchronous and return typed outcomes without automatically turning every read into a durable UEB fact. Earlier owner direction says reads stay liberal and light; the new question may call for an exception for sensitive audit/log queries.
- **Affected scope:** Plugin query grants and rate controls; event schema, retention and sensitive-field policy belong to the governed event owner.
- **Consequence:** Logging every read could flood the ledger or expose query detail; logging none could leave privileged audit access unreviewable.
- **Resolution needed:** Decide which query classes, if any, need access facts; whether those facts are durable or sampled operational telemetry; minimal metadata, redaction, retention and anti-spam policy.
- **Owner:** Owner for product choice; assigned main folder session for query contract and dependency routing.
- **Next:** Define the first scoped System query needed by a proving plugin, then route any access-fact requirement to the event owner.
- **Related:** [D-004 and D-005](DECISIONS.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-007 — Function and connector latency boundary

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 follow-up about avoiding tool-call holds and keeping native Mail/Calendar pass-through snappy; [current UEB delivery contract](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md); [plugin vision §§4.9–4.11](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>).
- **Observation:** The owner expressed a latency goal, but the exact response budget and required versus optional work on a function's critical path are not defined. Current governed delivery may await required acknowledgments, and mediated save must prepare a preimage before writing.
- **Affected scope:** Plugin function invocation and native connector query contract; UEB delivery, file-mutation recovery and connector implementation have separate owners.
- **Consequence:** A blanket no-wait rule could falsely report success or break required recovery; unbounded subscriber or native-source waits could make views and tools sluggish.
- **Resolution needed:** Define per-call latency budget, timeout/cancel behavior, first-result/pagination or streaming for live connector reads, and which required safety/evidence steps must finish before an outcome versus which optional projections may continue after it.
- **Owner:** Owner for product choices; assigned main folder session for plugin-facing contract and dependency routing.
- **Next:** Measure the first proving function and one live connector path against a stated response goal; reconcile any required UEB acknowledgment with the event owner before freezing the API.
- **Related:** [D-003 and D-005](DECISIONS.md), [I-004](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-008 — Audit payload retention and reconstruction claim

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 SoloBooks reconstruction example and uncertainty about saving input strings; [current System database boundary](../../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md); [file-versioning coverage](../../../Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md).
- **Observation:** The owner wants no app domain tables in `fusion.db` and hopes audit/recovery records might reconstruct an app-owned database or at least show variables sent. Whether inputs, before/after values, structured deltas or only metadata are retained is undecided. Current file snapshots cover bounded operations, not every deletion or app database mutation.
- **Affected scope:** Plugin/app command receipts and System audit interface; audit payload, snapshots, retention and restore belong to their existing event/recovery owners.
- **Consequence:** Metadata-only facts cannot replay missing values; full inputs or deltas are a secondary sensitive app-data copy. A promise to rebuild SoloBooks without complete ordered state and versioned semantics would be misleading.
- **Resolution needed:** Set the intended recovery tier: call trace only, field/value history, or reproducible app-state restoration; specify payload/redaction limits, schema and logic versions, ordering, initial checkpoint, snapshot location and retention. State precisely which losses remain unrecoverable.
- **Owner:** Owner for recovery/privacy choice; assigned main folder session for plugin receipt contract and dependency routing.
- **Next:** Use one real SoloBooks save/edit/delete sequence to identify the smallest record set needed for the chosen recovery tier, then route event and snapshot details to their owners.
- **Related:** [D-006](DECISIONS.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-009 — Literal scope of an audit/recovery-only System database

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 description of `fusion.db` as “purely for back up/snap shot recovery and audits”; [current System database boundary](../../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md).
- **Observation:** Current `fusion.db` also owns Fusion's thread/session identities, registrations, grants, subscriptions and mutable configuration. The no-app-domain-data rule does not by itself relocate those System operational records.
- **Affected scope:** Platform persistence outside this plugin folder if “purely” is literal; plugin foundation depends on registration and grant storage.
- **Consequence:** Treating the phrase as a database migration decision could silently conflict with the accepted System contract and active code.
- **Resolution needed:** Confirm whether the owner means no app domain data only, or also wants Fusion operational state moved out of `fusion.db` in a separate platform planning assignment.
- **Owner:** Owner for platform scope; assigned main folder session to route the answer.
- **Next:** Preserve current System ownership until the owner clarifies; do not plan a storage migration from this folder alone.
- **Related:** [D-006](DECISIONS.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-010 — Workspace preview images in `fusion.db`

- **Category:** scope and contracts
- **Type:** inconsistency
- **Severity:** unassessed
- **Status:** closed
- **Source:** Owner's 2026-09-29 no-app-data direction [D-006](DECISIONS.md); [Screenshot Capture Wiki](../../../Wiki/004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md); current `fusion-studio-server/lib/workspace/screenshot-service.js` and migration `020_workspace_screenshots.js`, checked in [REF-008](REFERENCES.md).
- **Observation:** The carousel's workspace-preview PNG is stored as a blob in `fusion.db` and can visually contain app data. The owner explicitly classified this preview as System shell data in [D-007](DECISIONS.md).
- **Affected scope:** System storage boundary and workspace carousel owner; plugin foundation depends on how the no-app-data rule treats preview/snapshot copies.
- **Consequence:** Resolved classification: carousel previews are a bounded System exception, not app domain tables. No move follows from D-006.
- **Resolution needed:** Resolved by [D-007](DECISIONS.md); broader screenshot retention controls remain shell-owned and are not decided here.
- **Owner:** Owner for storage/privacy choice; assigned shell/carousel owner for any product change; this folder records and routes the dependency.
- **Next:** Preserve current carousel storage while routing any future shell retention change to its owner.
- **Related:** [D-006 and D-007](DECISIONS.md), [I-008 and I-009](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-011 — Shared thumbnail API and close-time plugin contribution

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 thumbnail/card direction and subsequent correction [D-008](DECISIONS.md); current Office sidecar paths checked in [REF-009](REFERENCES.md).
- **Observation:** The owner confirmed the existing `.thumbnails` per-folder cache and wants a shared API for thumbnails, bounded Markdown card excerpts, file-type icons and folder/Office-style cards, with optional plugin refresh on close. A shared contract does not yet exist.
- **Affected scope:** Plugin contribution and callable lifecycle in this folder; file/content presentation, Office cards, chat attachments, thumbnail storage and close-event ownership are sibling contracts.
- **Consequence:** Independent implementations could duplicate rendering rules or run plugin code on an ambiguous close signal.
- **Resolution needed:** Define file/folder identity, bounded card variants, excerpt rendering, thumbnail generation result, cache/invalidations and which close event invokes an approved provider. Specify whether close is UI tab close, document close, view deactivation or another host event, and require a bounded outcome without blocking unrelated UI work. Preserve `.thumbnails`.
- **Owner:** Owner for product choices; assigned main folder session for plugin-facing contribution and dependency routing; file/view/attachment owners for implementations.
- **Next:** Draft one shared card/thumbnail contract from an Office document, a folder and a chat attachment before freezing plugin manifest grammar; route the close signal to its owner.
- **Related:** [D-008](DECISIONS.md), [I-004 and I-007](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-012 — Shared preview modes and file-type renderer limits

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 file-display direction [D-009](DECISIONS.md); existing Office tile checked in [REF-009](REFERENCES.md); presentation boundary in [REF-010](REFERENCES.md).
- **Observation:** The owner chose a shared square/rectangle card language and distinct Markdown, HTML, image and Office document preview modes. The owner further fixed the small-card chat-attachment precedent, large-card width-fit thumbnail behavior, miniature 8.5 × 11 thumbnail page frame and File Explorer icon precedent. Card/panel/modal previews are view-only; a separate canonical file tab handles full-file modes and editing under [D-011](DECISIONS.md). The exact preview descriptor, renderer availability and fallback behavior are not defined.
- **Affected scope:** File renderer, thumbnail service, shared client cards, Office/Capture/Launchpad, and plugin-facing preview contribution.
- **Consequence:** Each consumer could interpret “raw,” “rendered,” “whole page” and card overflow differently or expose HTML preview content unsafely.
- **Resolution needed:** Define supported file-type/mode matrix for card preview separately from file-tab display, bounded excerpt/overflow behavior, 8.5 × 11 page-frame scaling/fit and crop behavior across small/large cards, HTML isolation, fallback when rendering fails, and cache invalidation under `.thumbnails`. Reuse File Explorer icon mapping and the chat attachment layout language; keep Office documents' card thumbnails rendered-only per [D-009](DECISIONS.md).
- **Owner:** File/presentation owners for shared rendering contract; plugin-foundation session for contribution/grant seam.
- **Next:** Draft one preview descriptor against a Markdown file, HTML file, image, Office document and folder; validate with existing file-surface owners.
- **Related:** [D-008 and D-009](DECISIONS.md), [I-011](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-013 — Folder-centered view configuration and host actions

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 folder-centered view description [D-010](DECISIONS.md); current view and shell ownership in [REF-010](REFERENCES.md).
- **Observation:** The owner specified folder root, one-depth subfolder cards or categories, card sizing, star/pin actions, and preview-versus-new-tab click behavior. Office and Capture/Launchpad are contrasting presets under [D-012](DECISIONS.md), but no exact instance configuration or action contract exists.
- **Affected scope:** Plugin definition/instance binding, authorized folder listing, shared collection, navigation state, shell placement and canonical file surface.
- **Consequence:** A package might acquire filesystem or tab authority merely through editable view configuration, or duplicate Office/Capture collection logic.
- **Resolution needed:** Define validated content-root binding, one-depth category/card behavior and combined layout field if useful, file/folder presentation defaults, view-only card/panel/full-width-modal host choice, Office new-tab and Capture preview/header-send dispositions, star and pin action ownership, return route and tab target. Keep declarative instance configuration separate from protected plugin code and grants.
- **Owner:** View/shell/file owners for instance and interaction contracts; plugin-foundation session for package/contribution grammar.
- **Next:** Trace one folder with files and immediate subfolders through Office and Capture, then name the minimum shared configuration and host callbacks for the first proof.
- **Related:** [D-010 and D-012](DECISIONS.md), [I-001, I-012 and I-014](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-014 — Server-backed canonical file tab and raw/rendered modes

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 single-file tab and editing boundary [D-011](DECISIONS.md); current Files and shell contracts checked in [REF-012](REFERENCES.md).
- **Observation:** The owner wants a reusable tab for any supported document, image or PDF, supplied by server file functions, with a raw/rendered switch at the top and editing only in the tab. Current file tab, rendering and Capture new-tab action are partial foundations, not a complete shared per-type capability.
- **Affected scope:** Canonical file surface/type registry, server content and save services, shell tab identity/placement, Office and Capture collection actions and plugin view hosting.
- **Consequence:** A collection could gain an alternate editor, raw mode could mean different things for binary types, or two views could open incompatible tabs for the same file.
- **Resolution needed:** Specify server response and capability descriptors, supported file-type/mode matrix and default/disabled toggle behavior, source/raw representation for images and PDFs if any, view-only versus editable mode, tab identity and placement, dirty-buffer/return/close behavior, and canonical save/history path. Do not infer that every type has a useful raw rendering.
- **Owner:** File surface, server file service and shell/tab owners; plugin-foundation session for the contribution and caller seam.
- **Next:** Trace one Markdown, HTML, image and PDF from card click or preview-header send through tab open, mode switch and edit/save capability; reconcile with current file registry before executable planning.
- **Related:** [D-011 and D-012](DECISIONS.md), [I-012 and I-013](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-015 — Local JSON logs and Calendar export destination

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 question about local food/journal/mood logs and discretionary export or switch to a dedicated Google/Apple Calendar; existing Calendar status and provider APIs checked in [REF-013](REFERENCES.md).
- **Observation:** App-owned JSON entries can provide a local calendar-style log. Google Calendar and Apple EventKit have calendar/event creation paths, but Fusion's current Calendar integration is not a finished write-back connector. “Switch” could mean one-time historical export, export plus future one-way writes, or replacing JSON as the authoritative store.
- **Affected scope:** Plugin service capability and grants, Calendar connector, app-owned file storage, external account/source selection, audit receipts and any future migration or sync design.
- **Consequence:** Treating export as storage migration or sync could duplicate entries, lose rich log fields, silently publish sensitive notes, or put app data into `fusion.db` through the current sync writer.
- **Resolution needed:** Choose the source of truth after export and whether later edits/deletes propagate; define user-selected destination/source, included entry range and field mapping, consent/grant for external writes, stable local-to-external IDs and retry/reconciliation behavior. Keep local JSON and connector state app-owned, and record bounded System receipts without a second app-data store.
- **Owner:** Owner for product/storage/export choice; Calendar connector owner for provider behavior; plugin-foundation session for named capability and grant seam.
- **Next:** Draft a one-way local-JSON-to-dedicated-calendar proof with one dated entry and a repeat export, then ask the owner which ongoing-write behavior is intended before specifying sync.
- **Related:** [D-003, D-004 and D-006](DECISIONS.md), [I-004, I-007 and I-008](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-016 — Repo-local snapshot database and tab capture policy

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 proposal, updated by the System-owned repository-local SQLite and retained-content direction in [D-015](DECISIONS.md) / [REF-018](REFERENCES.md); historical layout/versioning check in [REF-014](REFERENCES.md).
- **Observation:** D-015 settles System execution/enforcement and repository-local SQLite content/version storage outside `fusion.db`, with approved plugin source/destination declarations. Exact path, machine/workspace scope and migration or coexistence with current save preimages and agent checkpoints remain unresolved. The 2026-09-29 layout evidence is historical, not a fresh runtime verification.
- **Affected scope:** File versioning/recovery, workspace layout, System persistence, tab-open behavior, storage lifecycle and plugin access to snapshot references.
- **Consequence:** A move could break prewrite protection or recovery links; tab-open snapshots might falsely imply tab/agent authorship; a missed open cannot recover intermediate changes.
- **Resolution needed:** Choose the exact store path and machine/workspace scope; preserve existing user-edit preimages and stable recovery links during migration/coexistence. Define eligible file types/limits, content copies, version IDs/hash/deduplication, baseline initialization, capture windows and deleted-file retention so the fallback has both observed copies. Define an explicit restore contract and storage read/write grant validation. Preserve D-015's non-causal links and distinguish the writable local store from D-014's Git-published copy; publication remains I-020. Optional tab-open capture semantics remain open.
- **Owner:** Owner for storage and capture choice; file-versioning/System/workspace owners for implementation; plugin-foundation session for reference/capability seam only.
- **Next:** Trace one user edit/save, harness or trigger snapshot, uninstrumented external edit, fallback scan and deletion with retained before/after bytes and references; select path/migration with the file-versioning/System/workspace owners before changing storage.
- **Related:** [D-013 through D-015](DECISIONS.md), [I-008, I-009, I-014 and I-017 through I-020](ISSUES.md), [CAPTURE](CAPTURE.md), [REF-014 and REF-018](REFERENCES.md).

### I-017 — Content-light UI and app-row evidence with agent links

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 UI/app-row proposal and later direction to retain linked snapshot/file/events without declaring causality in [D-015](DECISIONS.md) / [REF-018](REFERENCES.md); historical producer limits in [REF-014](REFERENCES.md).
- **Observation:** The owner has settled that the initiating event, snapshot reason and observed file/version changes may be linked without causal claims. Unmatched tool/UI records or mutations are audit clues, not automatic error findings. Existing UI/tool records and app-owned row history remain distinct; exact admitted linkage schemas and audit presentation are still open, and this update does not verify new producers.
- **Affected scope:** Governed UEB schemas, UI command adapters, plugin result/receipt contract, app-owned row IDs, agent tool linkage and query/review presentation.
- **Consequence:** Inferring a committed mutation from tool text or assigning overlapping changes to one event could falsely claim causality. Metadata-only facts cannot restore omitted file contents; linking evidence must not broaden an app-owned database into a second System live store.
- **Resolution needed:** Define stable event/operation, workspace, file/version and snapshot identities; capture times/comparison windows; initiating versus contextual links; incomplete/missing evidence and overlap presentation. Preserve D-015's association-only contract and support user/assistant audit without automatic causal/error verdicts. Keep raw tool logs in their Chat-owned records, eligible file contents in the snapshot store and app-row versioning in its owning app database; settle UI/UEB producers with their owners.
- **Owner:** Event/UI-action and agent-provenance owners for schemas and linkage; app owner for database history; plugin-foundation session for callable/result seam.
- **Next:** Trace a matching event/file observation, an unmatched event, an unmatched file change and overlapping operations, showing exactly which links and copies exist without causal labels.
- **Related:** [D-003 through D-006 and D-015](DECISIONS.md), [I-005, I-008, I-016 and I-019](ISSUES.md), [CAPTURE](CAPTURE.md), [REF-014 and REF-018](REFERENCES.md).

### I-018 — Snapshot DB size event, notification and dump policy

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 proposal to notify when the proposed snapshot DB reaches about 1 GB and offer a higher limit or automatic dump; notification direction and retention boundary checked in [REF-015](REFERENCES.md).
- **Observation:** A storage-threshold crossing can be a System fact consumed by the future platform notification service. The owner has not defined the exact unit/threshold, what “N number” counts, or whether “dump” means export/archive, local pruning, or both. The full notification service is a target, not verified current functionality. This proposed 1 GB local-store threshold is separate from the 80/100 MB Git-copy policy in [D-014](DECISIONS.md) and [I-020](ISSUES.md).
- **Affected scope:** Repo-local snapshot DB capacity, System event schema/admission, notification routing and read state, archive/export/retention policy, recovery links and plugin-facing notification hooks.
- **Consequence:** Repeated threshold checks could spam the inbox; silent pruning could erase recovery history; a failed archive could leave an apparently resolved quota alert while storage remains full.
- **Resolution needed:** Define measured bytes and threshold/hysteresis, one notification per crossing or unresolved condition, user actions and named commands, exact dump destination/eligibility/verification and pruning policy, stable version links after archival, failure behavior, and default behavior before the user chooses. Preserve history by default until a user-controlled cleanup rule is explicit.
- **Owner:** System storage/versioning and notification owners for behavior; event owner for schema; plugin-foundation session for any future plugin capability seam only.
- **Next:** Trace one 1 GB crossing, notification dismissal or limit raise, and a separately authorized archive/dump path before making an executable retention contract.
- **Related:** [I-016 and I-020](ISSUES.md), [I-008 and I-009](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-019 — Per-repo capture and System-record selection config

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** Historical per-repo retention configuration in D-013, with capture alternatives superseded by [D-015](DECISIONS.md) / [REF-018](REFERENCES.md); prior watcher evidence remains [REF-016](REFERENCES.md).
- **Observation:** The target is preserved user-edit versioning, trigger/harness event snapshots and an approximately 30-minute fallback, with System execution and approved plugin source/destination declarations. Chokidar removal is owner direction, not completed work. The trigger mutation declaration/completion signal was suggested by the owner; exact event/completion grammar and future replacement of file-change-trigger inputs/live freshness remain open. D-016 places this work after, rather than as a prerequisite for, current Chokidar removal and chat verification.
- **Affected scope:** Plugin declaration/grant seam, System snapshot service, trigger/harness completion producers, scan scheduling, workspace/machine boundaries, live freshness and file-trigger inputs, optional ledger retention and capacity policy.
- **Consequence:** Future capture/subscription work must distinguish detecting external mutations from observing completed trigger outputs: a completion-only scan cannot start a trigger whose input is an external file change. Under D-016 this future replacement does not gate the current Chokidar removal/chat verification assignment. Unbounded or overlapping scans can consume resources; source/destination self-observation can recurse, and unreadable paths can produce false deletions. Existing preimages and core System records must remain protected.
- **Resolution needed:** Define declarations and approved grants for exact sources/destinations, workspace/machine scope, excludes and snapshot-store self-exclusion. Specify trigger mutation capability/completion signals, harness snapshot events, failed/interrupted/missing completion handling, fallback cadence/configuration and baseline capture, bounded/coalesced scanning, consistency/overlap policy and incomplete-scan reporting. Specify future observation freshness and fallback-detected file-trigger input delivery in the separate snapshot/subscription assignment; do not require that work before current Chokidar removal. Preserve required save preimages and define optional snapshot/ledger retention separately; coordinate I-018 capacity and I-020 publication.
- **Owner:** Owner for selectable record scope; watcher/file-version/System-ledger owners for policy and implementation; plugin-foundation session for contribution/grant seam only.
- **Next:** Retain this as future work under D-016. When separately assigned, trace a user save, managed trigger, harness operation and unsignalled external edit through primary capture and fallback, then define approved scope, retained bytes, bounded resources and subscription delivery. Current Chokidar retirement/chat verification may proceed without this scanner or migration; the directed `file:changed` ledger retirement does not require a replacement watcher feed.
- **Related:** [D-013 and D-015](DECISIONS.md), [I-016 through I-018 and I-020](ISSUES.md), [CAPTURE](CAPTURE.md), [REF-016 and REF-018](REFERENCES.md).

### I-020 — Default Git publication of repo snapshot copies

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-09-29 80 MB warning, default GitHub/GitLab push, no pull-overwrite and 100 MB stop direction [D-014](DECISIONS.md); provider and SQLite backup references checked in [REF-017](REFERENCES.md).
- **Observation:** A consistent backup artifact can be produced from the live SQLite database and published through Git. Under D-015, that artifact can contain retained source-file bytes. The live database and artifact must have separate identities so Git pull/checkout cannot import remote bytes into the active store. GitHub's regular-Git warning begins over 50 MiB and block over 100 MiB; GitLab.com Free limits new files at 100 MiB, but GitLab limits may differ by tier, instance and project rule. Repeated binary copies can also grow repository history beyond the size of the latest file.
- **Affected scope:** Repo-local snapshot store, Git remote sync, backup/export and restore, System notifications, protected per-repo config, repository history and recovery links.
- **Consequence:** Tracking the live DB risks an inconsistent SQLite copy and allows checkout/pull to replace active state. Treating 100 MB as a universal provider limit can create failed pushes; stopping local capture at the Git ceiling would lose versions despite available local capacity. Pushing full copies repeatedly can make the repository expensive to clone. Default publication may also expose retained file contents to a remote audience wider than the approved snapshot source scope, with copies remaining in Git history.
- **Resolution needed:** Choose decimal MB versus MiB and inclusive cutoff, measured artifact bytes versus live DB bytes, consistent-copy method and validation, artifact path/ignore rule for the live DB and WAL, configured-remote detection, publication cadence/branch and status, behavior without a remote or on authentication/non-fast-forward failure, provider-specific lower caps, and history strategy. Define which approved source bytes may enter the Git artifact and how remote visibility is evaluated before default publication, preserving the owner's default-push direction. Define explicit restore/import separately; ordinary Git pull/checkout never replaces the live DB. Keep the 1 GB local-capacity and dump policy separate in [I-018](ISSUES.md).
- **Owner:** Owner for backup/publication defaults and exact threshold semantics; System storage/versioning and Git-sync owners for implementation; plugin-foundation session for capability boundary only.
- **Next:** Specify one local snapshot write, consistent export, successful push, pull of a newer remote artifact, threshold crossing and failed push, showing that local capture and live DB identity survive throughout.
- **Related:** [D-014 and D-015](DECISIONS.md), [I-008, I-016 and I-018](ISSUES.md), [CAPTURE](CAPTURE.md), [REFERENCES](REFERENCES.md).

### I-021 — Low-resource Apple Mail and Calendar change monitoring

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-10-03 Apple-first monitoring question and reported open-handle/chat-pipe failure [D-019](DECISIONS.md); current Fusion Calendar path and official Apple capabilities checked in [REF-020](REFERENCES.md).
- **Observation:** The repo-file 30-minute snapshot fallback is too slow for mail/calendar freshness. A running authorized EventKit client can receive Calendar-store change notifications and refetch the relevant range. For Mail, an enabled MailKit action extension or a user Mail rule can signal matching new downloads, but those sources do not establish full mailbox-change coverage; a bounded AppleScript/Scripting Bridge query is a candidate reconciliation fallback. The current Fusion Apple Calendar connector instead watches Apple's Calendar directory, reads its private SQLite and projects events into `fusion.db`, conflicting with the desired native-source/no-app-domain-data boundary. The Google Calendar poller is already a separate five-minute path. No latency or handle budget has been chosen or measured.
- **Affected scope:** Native macOS connector boundary, Apple permissions/extension enablement, background monitor lifecycle, UEB invalidation/fetch contract, Mail/Calendar view freshness, assistant read tools, System data boundary and resource budgets. Linux/Windows adapters are later work.
- **Consequence:** A filesystem watcher can recreate handle pressure; a Mail arrival-only hook misses read/move/delete or messages obtained while the hook is inactive; long polling can make views stale; broad repeated queries can burden Mail. Apple Mail's own account refresh cadence may dominate arrival latency even if Fusion detects promptly after download. Copying native domain rows into `fusion.db` would preserve the old storage conflict.
- **Resolution needed:** Choose a measurable new-mail and calendar-change latency target in focused and background states, and what happens when Mail is closed or permission is denied. Define whether the first proof covers new arrivals only or all mailbox mutations; select an EventKit bridge and a Mail arrival signal plus bounded reconciliation query, with one in-flight query per connector, deduplication, backoff and explicit resource/handle budget. Specify source identities/cursors, the no-duplicate-domain-store rule, metadata-only change/invalidation facts and on-demand content fetch, grant and Apple permission UX. Keep the 30-minute repository snapshot scan in [D-015](DECISIONS.md) separate. Treat MailKit/Mail rules as alternatives requiring proof, not as settled product requirements.
- **Owner:** Owner for latency/coverage priorities; native Mail/Calendar connector owners for mechanism and permissions; event/view owners for invalidation; plugin-foundation session for service-capability and grant seam only.
- **Next:** Plan a bounded Mac proof: observe one Calendar event edit through EventKit, one incoming Mail message and one read/move action through the proposed Mail signal/reconciliation path; measure end-to-end delay, open descriptors and behavior with Mail closed. Reconcile the current Calendar private-DB projection with [D-006](DECISIONS.md) before a connector implementation plan.
- **Related:** [D-006, D-019 and D-020](DECISIONS.md), [I-007, I-015 and I-022](ISSUES.md), [CAPTURE](CAPTURE.md), [REF-020](REFERENCES.md).

### I-022 — Plugin listener, scheduler and governed event contract

- **Category:** scope and contracts
- **Type:** missing_intent
- **Severity:** unassessed
- **Status:** open
- **Source:** Owner's 2026-10-03 plugin-owned Mail/Calendar listener and System interval direction [D-020](DECISIONS.md); earlier async callable, UI-event and producer boundaries in [D-003 and D-005](DECISIONS.md), [REF-005 and REF-006](REFERENCES.md), and [plugin vision §4.7](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>).
- **Observation:** Earlier records cover UI/agent calls to named server functions, asynchronous caller outcomes, and admitted facts delivered to authorized subscribers. The new direction adds a plugin-owned background listener or scheduled callback as a fact producer. Current governed UEB admission has only bounded built-in publishers/subscribers, while legacy `emit/on` cannot create admitted facts. EventKit signals only that the Calendar store changed; Mail arrival hooks and polls likewise require source-specific verification before claiming an actual item change.
- **Affected scope:** Protected plugin manifest and service capabilities, native bridge packaging, System scheduler and lifecycle, producer registration/grants, UEB schema/admission/provenance, trigger subscription, view invalidation and notification delivery.
- **Consequence:** Letting a plugin publish an arbitrary event could forge provenance or create write authority through a trigger. Tying the listener to a view would stop monitoring when its tab closes. Treating every polling tick or raw EventKit notification as a durable item-change fact could spam the ledger or falsely report a change. Inline subscriber work could delay source checks or UI outcomes.
- **Resolution needed:** Define the plugin declaration for a native listener, source and granted observation scope; System interval registration/change/revocation, idle/background lifecycle, concurrency and budget; native callback versus scheduled poll completion/outcome; verified-change identity and dedupe; producer reservation/admission and server-assigned actor/context; event schema, retention/ledger policy and delivery guarantees; bounded authorized view refresh and downstream trigger behavior; failure/retry/overflow behavior. Keep UI command results separate from UEB publication and distinguish bus delivery from durable ledger recording.
- **Owner:** Plugin-foundation session for package/capability/grant/lifecycle seam; System scheduler/native-connector owners for execution; governed event and UI/trigger owners for producer, schema, delivery and subscribers.
- **Next:** Trace one Calendar store notification and one Mail scheduled poll through plugin verification, host admission, subscriber invalidation, optional trigger command and failure path. Use that proof to choose the minimum manifest/grant/scheduler contract; route event schema and durability to the governed-event owner before executable planning.
- **Related:** [D-003, D-005 and D-020](DECISIONS.md), [I-004, I-005 and I-021](ISSUES.md), [CAPTURE](CAPTURE.md), [REF-005, REF-006 and REF-020](REFERENCES.md).
