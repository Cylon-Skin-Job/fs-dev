# Plugin foundation — references

> Source map for this prepared folder; citations do not transfer authority or certify current runtime behavior.

## Owner direction and prior work

### REF-001 — Newer product vision

- **Kind:** prior_work
- **Status:** inspected
- **Source:** [plugin vision](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>)
- **Locator:** Linked file and named sections; see source for exact records.
- **Revision:** SHA-256 `67e1899c239274230c1053b1cdc39613cf6b1074a0f0784e3a13adbae334d179` observed 2026-09-29; the prior setup read had no immutable hash.
- **Checked:** 2026-09-29, bounded reread of §§3.1 and 4.9–4.12; prior setup read 2026-09-27/28.
- **Supports:** Flat package tree, privilege split, template/instance distinction; design intent, not implementation evidence.
- **Limitations:** Source may contain dated status; recheck current bytes and direct owner decisions before executable planning.
- **Related:** [TICKET](TICKET.md), [ISSUES](ISSUES.md).

### REF-002 — fs-dev plugin suite

- **Kind:** prior_work
- **Status:** inspected
- **Source:** [decisions](../../../Captures/030-Plugin_System/decisions.md), [issues](../../../Captures/030-Plugin_System/issues.md), and [capture map](../../../Captures/030-Plugin_System/capture-map.md)
- **Locator:** Linked file and named sections; see source for exact records.
- **Revision:** Current file observed during 2026-09-27/28 setup; no immutable content hash recorded.
- **Checked:** 2026-09-27/28, bounded document read.
- **Supports:** Prior choices and open gates; several path descriptions predate the newer vision.
- **Limitations:** Source may contain dated status; recheck current bytes and direct owner decisions before executable planning.
- **Related:** [TICKET](TICKET.md), [ISSUES](ISSUES.md).

### REF-003 — Platform exceptions

- **Kind:** prior_work
- **Status:** inspected
- **Source:** [plugin integration overview](../../../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-overview.md)
- **Locator:** Linked file and named sections; see source for exact records.
- **Revision:** Current file observed during 2026-09-27/28 setup; no immutable content hash recorded.
- **Checked:** 2026-09-27/28, bounded document read.
- **Supports:** Platform-owned Plugins governance, shell and file-detail boundaries; candidate integration sequence only.
- **Limitations:** Source may contain dated status; recheck current bytes and direct owner decisions before executable planning.
- **Related:** [TICKET](TICKET.md), [ISSUES](ISSUES.md).

### REF-004 — Recent plugin-first statement

- **Kind:** user_quote
- **Status:** inspected
- **Source:** [Run roadmap supervisor](codex://threads/01a0c1c8-6e85-7f83-8d67-2cb5c1476007), recent owner turn about building plugin infrastructure sooner.
- **Locator:** Owner turn 01a0e58c-d90c-7913-a27a-19ce61dc9193, message 01a0e58c-d97c-7a60-9e62-9578dd7e553d; read through the task reader during this setup.
- **Revision:** 2026-09-27/28 conversation; turn and message locators recorded above.
- **Checked:** 2026-09-27/28, bounded task read and direct supervisor handoff.
- **Supports:** Early plugin foundation is owner direction; the supervisor's proposed proof and sequence remain unapproved details.
- **Limitations:** The phrase ai/plug-ins does not settle the exact installed root against the later plugin vision’s System/plugins convention.
- **Related:** [D-002](DECISIONS.md), [I-001](ISSUES.md).

### REF-005 — Current owner conversation on app functions

- **Kind:** user_quote
- **Status:** inspected
- **Source:** Owner messages in this plugin-foundation conversation on 2026-09-29, beginning with the scripts/triggers boundary search and continuing through “let's encode this into our plan” and the follow-up on outcomes, rate limits and System reads.
- **Locator:** Current conversation; no separate task/message UUID was supplied or invented.
- **Revision:** 2026-09-29 conversation through the owner's Chokidar and per-repo record-selection direction.
- **Checked:** 2026-09-29, direct conversation.
- **Supports:** [D-003 through D-013](DECISIONS.md), the proposed call shape and latency/recovery/thumbnail/calendar-export/snapshot/notification discussion in [CAPTURE](CAPTURE.md), and [I-004 through I-019](ISSUES.md).
- **Limitations:** Questions and assistant recommendations are not promoted to owner decisions; exact runtime and event contracts remain open.
- **Related:** [INTENT](INTENT.md), [TICKET](TICKET.md).

### REF-006 — Current System/UEB and UI-action contracts

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** [UEB](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md), [System database boundary](../../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md), [UI Action Provenance Module](../../../Wiki/010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md), and [backend command-surface design](../../../Captures/032-Plugin_Backend/backend-architecture.md).
- **Locator:** UEB command/fact boundary and current adoption limits; System boundary; UI-action current versus future work; backend architecture §§4–5.
- **Revision:** SHA-256 on 2026-09-29: UEB `02a9e2aaf7bd507a5ffd129c262a1a328dc5f096944f552fc1cd2578d9870774`; System decisions `eb673397e881d241858ac47d4ad513c97d843f491f1190cbaf525e4a0f987eee`; UI action `d036f9470ee0e4a2a1fe5bc38fa4d156e9e67f2bf88e05fda522cfc5d95c43da`; backend architecture `79631f233222e41dbb64813d8508b123930c37320963d2aced42e1fa27bd2bfc`.
- **Checked:** 2026-09-29, bounded document reads; no runtime or code verification.
- **Supports:** Named commands versus admitted facts, System DB ownership, current UI-action limit, and a stable app-owned command surface.
- **Limitations:** Existing accepted UEB publishers/subscribers are bounded built-ins; general plugin execution, UI-action publication and plugin subscription grants are not implemented by these sources.
- **Related:** [D-003 through D-006](DECISIONS.md), [I-004 through I-009](ISSUES.md).

### REF-007 — Current bounded file recovery coverage

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** [File Versioning](../../../Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md) and [Resource Mutation Provenance](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md).
- **Locator:** Current mechanisms, required save preimage and future coverage; closed save fact payload.
- **Revision:** SHA-256 on 2026-09-29: File Versioning `a9fe2d2eefa7ebf57d4e3447abc5361c1e946ca959375f567417387f15b29ba6`; Resource Mutation `501ae0e7c454f65ab6c4e9309766e1331af8f5c3f525c09ab2df35cef8b2416a`.
- **Checked:** 2026-09-29, bounded document reads; no runtime or code verification.
- **Supports:** Current preimage/observation scope and why complete app replay or deleted-file recovery cannot be inferred from the existing ledger.
- **Limitations:** Documents describe bounded accepted behavior; future app-domain event and snapshot policies remain undecided.
- **Related:** [I-008](ISSUES.md), [D-006](DECISIONS.md).

### REF-008 — Current Fusion shell retention check

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** [UI Action Provenance](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md), [Screenshot Capture](../../../Wiki/004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md), and current server/client owners: `fusion-studio-server/lib/ledger/event-ledger.js`, `fusion-studio-client/src/lib/save-action-context.ts`, `fusion-studio-server/lib/file-mutations/reported-ui-context.js`, `fusion-studio-server/lib/workspace/screenshot-service.js`, `fusion-studio-server/lib/db/migrations/020_workspace_screenshots.js`.
- **Locator:** Legacy ledger whitelist/actor inference; save context reader/sanitizer; screenshot table write and storage description.
- **Revision:** SHA-256 on 2026-09-29: UI Action Wiki `43bc7920fdbfa72111d5a9c8ec40c2a642b2097424fabd84c2260eef985a7bac`; Screenshot Wiki `f2c246f03da1f9b6858f7dd28019368bc9a05de4f83a9a0dc8ab6cbaa9bae7a5`; event-ledger `c5b68f7646535182a75f24be88783a631f8492b16904ddeedfcf480240cd08ca`; client context `661694ffe969bfab723faa85c6d102dd12a09bf2f6e263e0629502f4b0c04deb`; server context `6d43a5c89bb38fb5c35d87d21787aa6d05db1c3fc3a7fe3c2dc6a435af6004ce`; screenshot service `b7faa23ad0c976c30d1b84e12cffd0d4d0156225592853e5912958f29dc63287`; migration `9de0e57822eec1d2224e79f52d307609b6501a5f86d21b50df001271f123a25b`.
- **Checked:** 2026-09-29, bounded source/document read; no runtime test or exhaustive shell action inventory.
- **Supports:** Partial current shell retention and a concrete screenshot-content copy in `fusion.db`.
- **Limitations:** Does not establish all shell event producers or assert that every actual gesture reaches the legacy ledger; the Wiki distinguishes current optional save context from future general UI-action provenance.
- **Related:** [I-010](ISSUES.md), [CAPTURE](CAPTURE.md), [D-006](DECISIONS.md).

### REF-009 — Existing Office thumbnail sidecar and attachment display

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** Current `fusion-studio-client/src/lib/officeThumbnails.ts`, `fusion-studio-client/src/state/officeThumbnailStore.ts`, `fusion-studio-client/src/components/office/OfficeDocumentTile.tsx`, `fusion-studio-server/lib/ws/workspace-request-handlers.js`, `fusion-studio-server/lib/http/panel-file-route.js`, and `fusion-studio-client/src/components/chat/ChatLinkAttachments.tsx`.
- **Locator:** Office `.thumbnails` constant/path/cache key and update store; server move/delete and allowed dot-directory handling; attachment icon presentation.
- **Revision:** SHA-256 on 2026-09-29: office path `ce818b4504f0421863ccbc54c47062fcaccc189b1a80a78520ce72676ce3d8e3`; thumbnail store `5ab2f8e87504cde77d02b5f0d96a29805419ccfedfea1e340275e29e9b446d0a`; Office tile `5d79823f1f8b2e768f4233db26c5ac8014585a730aa4316cd754d4d678ad49d0`; workspace handlers `2fe0eda3c252f6eb4c2c7c21f4614ed658dd3a5d598fb8be6ea66e2981bb5458`; panel file route `f01939bbfc8d19e5952456c0ce6122da98ce0995e8052d703f931fa7a6978f1a`; chat attachments `15283b76bacab28d8b37881fc176a8854351b17c9f10c240c3f577ac36aa7731`.
- **Checked:** 2026-09-29, bounded source read; no runtime test or exhaustive UI comparison.
- **Supports:** Current `.thumbnails` convention, now explicitly confirmed by the owner, and distinct Office/attachment consumers for the shared card contract.
- **Limitations:** Does not establish a shared thumbnail API, full card design or plugin close hook today.
- **Related:** [I-011](ISSUES.md), [D-008](DECISIONS.md).

### REF-010 — Current presentation, view-instance and tab/file boundaries

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** [Composable Presentation](../../../Wiki/011-Platform_And_Plugins/003-Composable_Presentation/PAGE.md), [View Architecture](../../../Wiki/001-Workspaces_And_Views/002-View_Architecture/PAGE.md), and [Tabs, Drawers And Files](../../../Wiki/011-Platform_And_Plugins/004-Tabs_Drawers_And_Files/PAGE.md); bounded current Office/Capture component inspection in `fusion-studio-client/src/components/office/OfficeGrid.tsx`, `OfficeDocumentTile.tsx` and `fusion-studio-client/src/components/capture/CaptureTiles.tsx`.
- **Locator:** Configure/compose/protected component and explicit data/action host; definition/instance/content-root distinction; collection-to-canonical-file/current-or-new-tab flow; existing Office folder/document tile and star/pin controls.
- **Revision:** SHA-256 on 2026-09-29: Composable Presentation `f0999475c112d81379d356ecbea6d1ae02d0ed6492cb6ae4b359887c7fc954d7`; View Architecture `4c25f961c92e94be69e3641bf8dc15212091fd4351cda2417c12ec2d63614945`; Tabs, Drawers And Files `3d38d07483700508acb5b5233855502a1e1104c5cb591efb0dd223443efabeaa`. Office/Capture component reads were bounded search, without a recorded whole-file revision; [REF-009](REFERENCES.md) records the Office tile revision.
- **Checked:** 2026-09-29, bounded document and code read; no runtime verification.
- **Supports:** Shared configurable client presentation versus server-owned data/actions, protected plugin definition and editable view instance, validated content root, and shell/canonical-file ownership of tab placement and opening.
- **Limitations:** These sources do not implement the newly requested full preview matrix, folder-collection configuration grammar, or a general plugin loader. Office/Capture implementation details were only sampled.
- **Related:** [D-009 and D-010](DECISIONS.md), [I-012 and I-013](ISSUES.md), [CAPTURE](CAPTURE.md).

### REF-011 — Current chat attachment and File Explorer icon precedents

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** `fusion-studio-client/src/components/chat/ChatLinkAttachments.tsx`, `fusion-studio-client/src/components/file-explorer/FileNode.tsx`, `FileTreeNode.tsx`, and `fusion-studio-client/src/lib/file-utils.ts`.
- **Locator:** Chat attachment icon, label and type layout; File Explorer file node's `getFileIcon` call; folder/file dispatch; extension/filename icon mapping and default.
- **Revision:** SHA-256 on 2026-09-29: chat attachments `15283b76bacab28d8b37881fc176a8854351b17c9f10c240c3f577ac36aa7731`; FileNode `2c19497c92d0119f0eb55caae78515f2a7b9777c9afbe5518c4dee8bb5c3c446`; FileTreeNode `696cc85fbc7ab076e6760c01d848571f6f7ee183182f8f10017212b50429063f`; file-utils `ea51546d60b6ceaa9036230ff64ea34683823c7a88513543a2620505fe80e23c`.
- **Checked:** 2026-09-29, bounded source read; no runtime or visual verification.
- **Supports:** Existing chat attachment and File Explorer icon precedents named by the owner for small cards and icon mode.
- **Limitations:** These components do not already implement the requested shared card or 8.5 × 11 thumbnail preview.
- **Related:** [D-009](DECISIONS.md), [I-012](ISSUES.md), [CAPTURE](CAPTURE.md).

### REF-012 — Current Files tab, Capture preview and Office click paths

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** [Files View](../../../Wiki/001-Workspaces_And_Views/007-File_View/PAGE.md), [Tabs, Drawers And Files](../../../Wiki/011-Platform_And_Plugins/004-Tabs_Drawers_And_Files/PAGE.md), and current `fusion-studio-client/src/components/file-explorer/FileViewer.tsx`, `fusion-studio-client/src/components/capture/CaptureTiles.tsx`, `DocumentPreviewModal.tsx`, and `fusion-studio-client/src/components/office/OfficeGrid.tsx`.
- **Locator:** Files collection versus canonical file surface; file tab content path; Capture card preview and new-tab header action; Office click's selected-path update.
- **Revision:** SHA-256 on 2026-09-29: Files View `0846d488a4f60f05f69a4afd981775df4865a9bb46926d75e7305b707fde679c`; Tabs, Drawers And Files `3d38d07483700508acb5b5233855502a1e1104c5cb591efb0dd223443efabeaa`; FileViewer `d9790b5acc8299937ebea21e65a81123f82797be992ebd85036c7af3daefcaea`; CaptureTiles `0da933a98857c9fc833e87fe1300307ed50978a97fd9076ca54b84749cfb92e3`; DocumentPreviewModal `72c361af007ae407dce6332a0dc99299a902cf5eb7e31d35e365148713287438`; OfficeGrid `9289fc41f90e5bba48094b45b0048e6ec02c803c077b413d24f030abfb7d8cf5`.
- **Checked:** 2026-09-29, bounded document and code inspection; no runtime verification.
- **Supports:** Existing partial file-tab, Capture preview/send-to-tab and Office selected-document paths, and the existing owner separation for future reuse.
- **Limitations:** Does not establish a universal server-backed file tab, raw/rendered toggle across file types, view-only enforcement for every preview or Office card click opening a new tab today.
- **Related:** [D-011 and D-012](DECISIONS.md), [I-013 and I-014](ISSUES.md), [CAPTURE](CAPTURE.md).

### REF-013 — Calendar connector gap and provider export feasibility

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** [Calendar View](../../../Wiki/001-Workspaces_And_Views/016-Calendar_View/PAGE.md), [Fusion Home Calendar Viewer](../../../Wiki/009-Fusion_Home/002-Calendar_Viewer/PAGE.md), [plugin vision §4.9–4.11](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>), current `fusion-studio-server/lib/calendar/index.js`, `db-writer.js` and `fusion-studio-server/lib/http/calendar-routes.js`; official [Google calendars.insert](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert), [Google events.insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [Apple EventKit access](https://developer.apple.com/documentation/eventkit/accessing-the-event-store), [EKEventStore](https://developer.apple.com/documentation/eventkit/ekeventstore), and [EKCalendar](https://developer.apple.com/documentation/eventkit/ekcalendar).
- **Locator:** Mounted Calendar demo and deferred store writes; optional sync to `fusion.db`; prior JSON/add-to-calendar and native connector direction; external calendar/event creation and Apple source/permission model.
- **Revision:** SHA-256 on 2026-09-29: Calendar View `3994815e9be4d446c3d3e235a5738d3b6f62d5c6a4def7ca76bf594a4d25c2b4`; Fusion Home Calendar `734ec5ebdeb175940e5df0e7f1b381a036975b1e6b73e83957c297b0a7702d84`; plugin vision `67e1899c239274230c1053b1cdc39613cf6b1074a0f0784e3a13adbae334d179`; calendar index `3677e7563383c9e4c0b56077212247a7dab838a7492a1cc6ea4849b44804407b`; DB writer `159b5d646fd16c6272567ecfbf030da1c5258d5e65b142ecbd2bbcb0140e5529`; HTTP routes `165281dd7ae9994ac5f792929079c8ee428fe7ec10fab538ad65586f0fbc022d`. Official online references checked 2026-09-29; their later revisions are external and are not frozen here.
- **Checked:** 2026-09-29, bounded local source/document inspection and official provider documentation browse; no live provider account or runtime test.
- **Supports:** Local JSON plus discretionary export is architecturally feasible, while the current Fusion Calendar code lacks a complete write connector and its optional DB sync conflicts with the desired app-data boundary.
- **Limitations:** Provider APIs do not choose the product's source-of-truth, export mapping, consent scope or ongoing sync policy; Apple Calendar's selected source may be local or a connected account, and source writability must be checked at runtime.
- **Related:** [I-015](ISSUES.md), [D-003, D-004 and D-006](DECISIONS.md), [CAPTURE](CAPTURE.md).

### REF-014 — Current snapshots, tool evidence and workspace data path

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** [File Versioning](../../../Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md), [Tool Call Provenance](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/002-Tool_Call_Provenance_Schema/PAGE.md), [Correlation And Causality](../../../Wiki/010-Events_And_Ledger/007-Correlation_And_Causality/PAGE.md), [UI Action Provenance Module](../../../Wiki/010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md), and [Server And Runtime](../../../Wiki/002-Server_And_Runtime/PAGE.md); direct directory check of `ai/RC-MacAir-15/Data/` and `ai/RC-MacAir-15/System/` in the current repo.
- **Locator:** Required mediated-save preimage; sparse, deduplicated post-tool observations; tool candidate parser limits and exchange binding; reported versus observed correlation; future general UI actions; current System DB and workspace content boundaries.
- **Revision:** SHA-256 on 2026-09-29: File Versioning `a9fe2d2eefa7ebf57d4e3447abc5361c1e946ca959375f567417387f15b29ba6`; Tool Call `e8f14a689d2fcc6f54f43aa1d92f25018c2bbf3d39e77d6a2b582ebfc0ce2a70`; Correlation `a01fdd8e3fae33e86db22a418b5dd7fa8fb1494286ae40c6a01a44b13b746809`; UI Action `d036f9470ee0e4a2a1fe5bc38fa4d156e9e67f2bf88e05fda522cfc5d95c43da`; Server And Runtime `f01ff1ad164dd230981bf2c689479389f219dd233c0a727caa4d1322c880e8f2`. Directory existence checked at the same date; it is not an immutable layout revision.
- **Checked:** 2026-09-29, bounded documentation and filesystem read; no runtime verification or migration test.
- **Supports:** Current snapshots live in System `fusion.db`; tool/file evidence has bounded correlation rather than universal causality; general UI action publication is future work; current repo has `ai/<machine>/Data/` and no `ai/<machine>/System/Data/`.
- **Limitations:** Does not decide the proposed new snapshot DB path, migration, tab-open capture semantics, eligible file types or whether specific raw tool arguments remain available after Chat deletion.
- **Related:** [I-016 and I-017](ISSUES.md), [I-008 and I-009](ISSUES.md), [CAPTURE](CAPTURE.md).

### REF-015 — Notification service direction and System retention boundary

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** [plugin vision §4.15](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>) and [Events And Ledger decisions](../../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md); bounded filename search in current `fusion-studio-client/src` and `fusion-studio-server/lib` for notification/bell owners.
- **Locator:** Platform-owned notification service, event-bus input and bell/inbox/OS delivery as owner direction; System history preservation and explicit user-controlled cleanup policy.
- **Revision:** SHA-256 on 2026-09-29: plugin vision `67e1899c239274230c1053b1cdc39613cf6b1074a0f0784e3a13adbae334d179`; Events decisions `eb673397e881d241858ac47d4ad513c97d843f491f1190cbaf525e4a0f987eee`. Code filename search was bounded and has no immutable revision record.
- **Checked:** 2026-09-29, bounded document read and code filename search; no runtime verification.
- **Supports:** Routing a future storage-size System fact into platform notifications is consistent with the owner direction; automatic removal needs an explicit user-controlled data lifecycle contract.
- **Limitations:** Does not prove a production notification service, threshold detector, quota setting or dump/archive implementation exists; exact threshold units and “dump” semantics remain the owner's open choice.
- **Related:** [I-018](ISSUES.md), [I-016](ISSUES.md), [CAPTURE](CAPTURE.md).

### REF-016 — Existing Chokidar workspace watcher and change-storm limits

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** Current `fusion-studio-server/package.json`, `fusion-studio-server/lib/watch/core.js`, `fusion-studio-server/lib/watch/workspace-watcher.js`; [Change Storm Control](../../../Wiki/010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md), [Resource Events And Render Sync](../../../Wiki/010-Events_And_Ledger/005-Resource_Events_And_Render_Sync/PAGE.md); official [Chokidar README](https://github.com/paulmillr/chokidar/blob/main/README.md).
- **Locator:** Chokidar 5 dependency; shared per-path watcher options and `all` delivery; workspace excludes, rename heuristic and legacy `file:changed`; distinction between watcher freshness and governed file mutation; Chokidar event normalization, `atomic` and `awaitWriteFinish` options.
- **Revision:** SHA-256 on 2026-09-29: package `3833f2758cec00e0e4be6ba561def3732ed15f2796452b041d25bfb2c4e0389e`; core `3f0ea12c0732d0e44721709e21681358514aae7145c96d7763e81996829b8ba2`; workspace watcher `acd4b8a7e58223c5c3fa0259f7c2d6471b618e769e98b24b2b3ed0c9104511b3`; Change Storm `4444008ca7e067c7503c64ccea49c2e292e3b89464c4fc2008903c65acf840e5`. Render Sync read on 2026-09-29 without a recorded whole-file hash; online Chokidar README checked 2026-09-29 and not frozen to a commit here.
- **Checked:** 2026-09-29, bounded source/document read and official library documentation browse; no runtime or load test.
- **Supports:** Historical evidence for the superseded D-013 option: a Chokidar-backed observation mode could reuse the then-existing watcher foundation, but it would detect normalized eligible filesystem events rather than every intermediate mutation or cause. The checked watcher and ledger paths also inform the separate retirement analysis under D-016.
- **Limitations:** The Chokidar capture option is no longer current direction under D-015/D-016. This source does not establish a production snapshot mode/config, complete watcher coverage, exact per-repo path, safe broad snapshot reads, performance under large repos or user-selectable System ledger retention today.
- **Related:** [D-013](DECISIONS.md), [I-016 and I-019](ISSUES.md), [CAPTURE](CAPTURE.md).

### REF-017 — Git host file limits and consistent SQLite copies

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** Official [GitHub large-file limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github), [GitLab.com Free push limit](https://docs.gitlab.com/user/free_push_limit/), [GitLab push rules](https://docs.gitlab.com/user/project/repository/push_rules/), and SQLite [Online Backup API](https://www.sqlite.org/backup.html) and [VACUUM INTO](https://www.sqlite.org/lang_vacuum.html).
- **Locator:** GitHub regular-Git warning/block thresholds; GitLab.com Free new-file threshold and configurable project rules; SQLite live-database consistent-copy methods.
- **Revision:** Official online documentation checked 2026-09-29; external pages are not frozen to a commit here.
- **Checked:** 2026-09-29, bounded official documentation browse; no Git host push or live-database backup test.
- **Supports:** GitHub warns above 50 MiB and blocks above 100 MiB for regular Git files. GitLab.com Free rejects newly pushed files at 100 MiB or larger; Premium/Ultimate project push rules may set a different maximum. SQLite can create a consistent separate database copy while the source remains open, so Git need not track the writable live file.
- **Limitations:** Host docs do not set Fusion's 80/100 MB product policy, make 100 MB a universal GitLab ceiling, guarantee a Git push will succeed, or choose backup cadence, artifact location, history maintenance, restore behavior or privacy controls. An untested design does not prove current Fusion backup/push implementation.
- **Related:** [D-014](DECISIONS.md), [I-016, I-018 and I-020](ISSUES.md), [CAPTURE](CAPTURE.md).

### REF-018 — Owner snapshot clarification from chat/harness diagnosis

- **Kind:** user_quote
- **Status:** inspected
- **Source:** Direct owner messages in the bounded chat/harness diagnosis conversation, incorporated at the owner's explicit request on 2026-10-03 by Codex side chat (ephemeral).
- **Locator:** Messages beginning “I’m okay with simply recording the thing that caused the snapshot” and “Well, I meant as a fall back,” then “We’d make snapshotting system owned, plug ins grant the permissions / source and destination,” ending “Add this to that document set.” No new session UUID or history boundary is asserted.
- **Revision:** Visible conversation through the 2026-10-03 incorporation request; exact quoted excerpts above, not a full history checkpoint. The prior snapshot/Chokidar discussion remains REF-005, REF-014 and REF-016.
- **Checked:** 2026-10-03, direct conversation and bounded reread of this folder's current records. Incorporation time: 2026-10-03T08:50:45Z.
- **Supports:** System-owned snapshot execution, repo-local SQLite direction, plugin source/destination and grant seam, preserved user-edit versions, trigger/harness snapshots, approximately 30-minute fallback retaining both copies, linked evidence without causal attribution, and the owner's target of Chokidar removal before continued harness integration work.
- **Limitations:** No approved schema/path/migration or implemented scanner is established. Trigger completion/mutation declarations were suggested but their grammar, failure behavior and exact cadence remain open. Current producer coverage, live Alpha state and replacement freshness behavior were not reverified by this documentation update. The fallback does not preserve every intermediate edit or establish exact mutation time/actor. No product build, grant, Git push, Alpha operation or checkpoint advancement occurred.
- **Related:** [D-015](DECISIONS.md), [I-016, I-017 and I-019](ISSUES.md), [CAPTURE](CAPTURE.md), [INTENT](INTENT.md), [TICKET](TICKET.md).

### REF-019 — Owner separates current Chokidar retirement from future snapshots

- **Kind:** user_quote
- **Status:** inspected
- **Source:** Direct owner messages in **Map Fusion–OpenCode chat failure states**, local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, on 2026-10-03.
- **Locator:** Messages beginning “Okay, we need to disable that file:changed event ledger,” “But the half hour snapshots and event triggers are future work,” and “Note the need to add future snapshot work in our plugin-foundation folder.” Discussion amendment: [owner direction](../chat-integration-and-retirement/planning/chokidar-retirement-and-harness-launch/reports/owner-direction-file-changed-ledger.md).
- **Revision:** Visible owner dialogue through the explicit plugin-foundation incorporation request, 2026-10-03; a bounded current-conversation incorporation, not a history checkpoint.
- **Checked:** 2026-10-03T12:06:57Z by Codex side chat (ephemeral); current records reread before writing.
- **Supports:** Retire the ledger's `file:changed` recording; remove Chokidar and verify actual chat operation now; retain half-hour/event-triggered snapshots and repository-local SQLite direction as separate future work in plugin-foundation. Scanner readiness and trigger migration do not gate current removal.
- **Limitations:** Does not establish an implemented snapshot service, exact DB location/schema/migration, completed chat fix or implementation approval. Existing First Draft validation predates these scope amendments. No product code, runtime, database contents, checkpoint or deployment was changed.
- **Related:** [D-015 and D-016](DECISIONS.md), [I-016, I-017 and I-019](ISSUES.md), [INTENT](INTENT.md), [TICKET](TICKET.md).

### REF-020 — Apple Calendar and Mail change signals and current Fusion seam

- **Kind:** source_of_truth
- **Status:** inspected
- **Source:** Official Apple [EventKit change notifications](https://developer.apple.com/documentation/eventkit/updating-with-notifications), [EventKit access](https://developer.apple.com/documentation/eventkit/accessing-the-event-store), [MailKit](https://developer.apple.com/documentation/mailkit), [Mail message action handler](https://developer.apple.com/documentation/mailkit/memessageactionhandler), [Mail rule scripts](https://support.apple.com/guide/mail/automate-mail-tasks-mlhlp1120/mac), [Scripting Bridge](https://developer.apple.com/documentation/scriptingbridge), [Apple Events usage description](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappleeventsusagedescription), and [Mail retrieval settings](https://support.apple.com/en-ie/guide/mail/cpmlprefgen); bounded read of current `fusion-studio-server/lib/calendar/index.js`, `lib/watch/calendar-watcher.js`, `lib/calendar/apple/reader.js`, `apple/sync.js`, `lib/calendar/db-writer.js`, `lib/calendar/google/poller.js`, and `lib/background-services/config.js`.
- **Locator:** EventKit store change notification and refetch requirement; Calendar permission; MailKit on-download callback; user Mail rule script; Apple Events app automation; Mail's own retrieval cadence; current Apple Calendar private SQLite watcher/read and `fusion.db` projection; current five-minute Google poller and opt-in configuration.
- **Revision:** SHA-256 on 2026-10-03: Calendar index `3677e7563383c9e4c0b56077212247a7dab838a7492a1cc6ea4849b44804407b`; calendar watcher `60dd2503592e65bab15c61b62b39b09957a91704f5cfb6f2ae640b163024044c`; Apple reader `f0a8448d6629e43e2fd658030d51786130b28a4c554f1b243915b41489ba47b9`; Apple sync `b2f571af00173e8d843f3e48024c9e6ffc511f26efb568492dbdcdcda05a7d31`; DB writer `159b5d646fd16c6272567ecfbf030da1c5258d5e65b142ecbd2bbcb0140e5529`; Google poller `eee8e2cd76476f899e3e69bce3f5cdee34e7643a68710e3dcbbb100f41e6ffe3`; background config `da4f8365c3eee743d7580f3e828cc3c89d35840544d3b518590210176c189401`. Official pages checked 2026-10-03 and are not frozen here.
- **Checked:** 2026-10-03, bounded current-code read and official Apple documentation browse; no live Mail/Calendar permission, notification, latency or handle-count test. Local `sdef` inspection was unavailable because this host's active developer directory lacks full Xcode.
- **Supports:** EventKit can notify a running authorized client that Calendar data changed, after which it must refetch; this does not require watching Calendar files. MailKit can invoke an enabled extension as Mail downloads messages, and user-configured Mail rules can invoke scripts on matching incoming messages. Apple Events/Scripting Bridge offer a separate app-automation read path. Current Fusion Apple Calendar path uses a Chokidar directory subscription, reads Apple's private SQLite and copies calendars/events to `fusion.db`, while its Google Calendar path polls every five minutes.
- **Limitations:** The cited Mail arrival hooks do not establish a supported notification for every mailbox read, move, delete or account sync change; bounded Mail polling is a planning inference that needs a prototype. EventKit notifications do not promise remote-provider delivery time or identify individual changes. Apple Mail's retrieval cadence can dominate end-to-end latency. The owner's reported 16,000 open handles and chat-pipe failure were not independently diagnosed in this review; another session owns that investigation/removal. The inspected code is a source snapshot, not proof of the running checkout after that session's edits.
- **Related:** [D-019](DECISIONS.md), [I-021](ISSUES.md), [CAPTURE](CAPTURE.md), [INTENT](INTENT.md).
