# Plugin foundation — decisions

> Explicit owner choices only; source approval is limited to the recorded scope.

## Owner direction and boundaries

### D-001 — Prepare this Launchpad folder

- **Source:** Owner approval in the current Mission Control setup conversation following the four-folder discussion; the chat close-out folder was added before provisioning.
- **Status:** active
- **Scope:** Prepare this distinct durable memory home for plugin foundation. The owner will sort out detailed scope and sequencing in the new folders. No product plan, SPEC or implementation is approved by this decision.

### D-002 — Build a minimum plugin foundation early

- **Source:** Owner statement in [Run roadmap supervisor](codex://threads/01a0c1c8-6e85-7f83-8d67-2cb5c1476007): “If we build the plug in stuff sooner rather than later, we can make ai/plug-ins hold them from the start.” The supervisor's subsequent plugin-first sequence is a proposal, not the owner's full approved roadmap.
- **Status:** active
- **Scope:** Treat an early usable plugin foundation as the design direction so new capabilities need not start as built-ins. The exact installed root, minimum contract, first proving plugin and implementation order remain open in [ISSUES](ISSUES.md).

### D-003 — Call app-owned writes through named server functions

- **Source:** Owner discussion in this folder's 2026-09-29 conversation: custom views should call server functions, use their own databases and logic, and receive results through UI and event subscriptions; the owner then said, “let's encode this into our plan. I like this.” The command/fact distinction follows the [current UEB contract](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md).
- **Status:** active
- **Scope:** A view button or agent invokes a registered, authorized function through Fusion's server. The app's owning service validates and commits its own file or database mutation and returns a bounded result; an admitted outcome fact can then reach the ledger and authorized subscribers. A subscriber may initiate further work only through another authorized named command. An arbitrary event is not itself write authority. This is design direction for the plugin contract, not a claim that general plugin execution or emission is implemented.

### D-004 — Keep plugin writes out of the System database

- **Source:** Owner discussion in this folder's 2026-09-29 conversation: “use their own db” and “we don't really need db write access”; reconciled with the [System database boundary](../../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md).
- **Status:** active
- **Scope:** Plugins do not receive direct write access or a raw handle to `fusion.db`. Approved, scoped queries may expose System audit and log information. Fusion-owned services remain the writers of System configuration, grants, receipts and history; an app-owned service owns mutations to its separate data store. GUI and agent actions supply intent and context, not direct database authority. Exact query capabilities and app-store transport remain to be designed.

### D-005 — Return an outcome for every plugin call and bound invocation rates

- **Source:** Owner's 2026-09-29 follow-up in this folder: “all calls to the server, should be outputting something” and “we should have some rate limit.”
- **Status:** active
- **Scope:** Every plugin-facing function or query invocation returns a typed, bounded outcome, including success, denial, failure or accepted background run identity. The server checks registration, grant and rate/budget policy before executing effects; a returned outcome is evidence for the caller, not the source of write authority. Exact rate limits, accounting keys, overload response and retry rules remain open in [I-004](ISSUES.md). This does not require one durable UEB event per read.

### D-006 — Keep app domain state outside `fusion.db`

- **Source:** Owner's 2026-09-29 clarification in this folder: “I am not storing any ‘app’ data on the db, not even native installed apps”; consistent with the [System database boundary](../../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md) and the earlier [plugin vision §4.11](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>).
- **Status:** active
- **Scope:** No plugin, bundled first-party app, or native connector uses `fusion.db` for its live domain tables or authoritative app rows. App-owned files/SQLite or the connected native service remain the source of live app data. Fusion may retain System-owned control state and governed audit/recovery records under its existing contract; whether any audit input values or snapshot bytes constitute an unacceptable second copy of app data is open in [I-008](ISSUES.md). A literal audit/recovery-only System database would also affect current Fusion operational state and is separately unresolved in [I-009](ISSUES.md).

### D-007 — Classify carousel workspace PNGs as System data

- **Source:** Owner's 2026-09-29 clarification in this folder: “on the PNGs, that is ‘System’. That feeds the carousel.”
- **Status:** active
- **Scope:** Workspace-preview screenshots retained for the Fusion carousel are permitted System shell data even when the visible preview includes app content. This resolves the classification question in [I-010](ISSUES.md) without treating preview PNGs as an app's live domain store or authorizing arbitrary app-content mirroring into `fusion.db`. Existing retention and carousel behavior remain separate shell-owned concerns.

### D-008 — Use existing folder-local thumbnails for shared card presentation

- **Source:** Owner's 2026-09-29 direction in this folder for folder-local thumbnails, a thumbnail/content-card API, shared attachment presentation and plugin participation in refreshing a thumbnail on close; subsequent correction: “Leave it. respect what's in code” and “.thumbnails is fine.”
- **Status:** active
- **Scope:** Preserve the existing folder-local `.thumbnails` sidecar convention for file thumbnails. Target a reusable presentation capability that can supply thumbnails, bounded rendered Markdown excerpts, file-type icons and folder/Office-style cards. Permit a registered plugin to provide or refresh a file thumbnail at a defined close lifecycle point through the platform host contract. Exact API, close semantics, safety/grants and cache invalidation remain open in [I-011](ISSUES.md). This folder owns only the plugin contribution/service seam; view, file, attachment and thumbnail storage implementations belong to their respective owners. No `.thumbs` rename or migration is requested.

### D-009 — Share configurable file and folder card presentation

- **Source:** Owner's 2026-09-29 file-display direction in this conversation: square and rectangular cards; raw/rendered Markdown and HTML previews; image thumbnails; rendered-only Office document previews; common Office/Capture card chrome and actions. The owner then specified that small cards resemble chat-pasted file attachments, large file thumbnails fit width, thumbnails use a miniature 8.5 × 11 page frame, and icons reuse the File Explorer paradigm. The existing Office implementation and [Composable Presentation](../../../Wiki/011-Platform_And_Plugins/003-Composable_Presentation/PAGE.md) establish current and target boundaries.
- **Status:** active
- **Scope:** Design one reusable card/preview capability that Office and Capture (later Launchpad), as well as approved plugin views, can configure. Support small and large cards within the square/rectangular collection language. A small card follows the chat attachment pattern: a folder icon for a folder; a File Explorer-style icon or raw/rendered/thumbnail preview for a file, with remaining space for filename and other card details. A large folder card still shows a folder icon; a large file thumbnail fits the card width. Thumbnail mode frames the preview as a miniature 8.5 × 11 page. Markdown raw preview is a shrunk whole page; its rendered card preview emphasizes the title with bounded first lines. HTML can preview code as a whole page or its rendered page. Images have thumbnails. Other file types use a whole-page preview where supported. Office documents use only a thumbnail of the rendered on-screen page, never raw Markdown/card text. Share the visual/action language for stars, expansion and related card controls. Exact renderer support and preview fallbacks remain open in [I-012](ISSUES.md). This is presentation direction, not permission for a plugin to read arbitrary paths or replace the canonical file renderer.

### D-010 — Configure a folder-centered plugin collection

- **Source:** Owner's 2026-09-29 description of a view folder pointing to a plugin and a configurable folder-centered display; [View Architecture](../../../Wiki/001-Workspaces_And_Views/002-View_Architecture/PAGE.md) and [Tabs, Drawers And Files](../../../Wiki/011-Platform_And_Plugins/004-Tabs_Drawers_And_Files/PAGE.md) distinguish instance, content root and shell placement.
- **Status:** active
- **Scope:** A view instance references the protected plugin and a selected authorized content root. Its configuration can present immediate subfolders as folder objects alongside files, or as headings/categories with at most one subfolder depth; configure file and folder card size/presentation and whether a file click shows a view-only card/modal preview or opens a file tab. Star a document and pin a folder to navigation through named host actions. The plugin/view supplies collection behavior and configuration; the shell owns tab placement and the canonical file surface owns file opening and editing. [D-011 and D-012](DECISIONS.md) clarify tab and example configurations. The exact configuration grammar and interaction rules remain open in [I-013](ISSUES.md); this does not assert that the current fixed built-in dispatch is already a general plugin loader.

### D-011 — Make the file tab the shared full-file and editing surface

- **Source:** Owner's 2026-09-29 clarification in this conversation: individual tabs should show a single document, image or PDF using the current File Viewer/code-editor guts, supplied by server file functions; a top-of-tab switch selects raw or rendered display; cards and panels are view-only and editing occurs in the file's own tab. [Files View](../../../Wiki/001-Workspaces_And_Views/007-File_View/PAGE.md) and [Tabs, Drawers And Files](../../../Wiki/011-Platform_And_Plugins/004-Tabs_Drawers_And_Files/PAGE.md) identify the current and target file owners.
- **Status:** active
- **Scope:** Provide a reusable, server-backed single-file tab for supported documents, images and PDFs, with a visible raw/rendered control where a meaningful mode exists. The server owns validated file retrieval and save services; the client file surface presents the supplied content and mode, using the existing File Viewer/editor foundation. Cards, in-view panels and full-width preview modals present file content without editing it. Opening or sending a preview to a file tab is the route to edit under canonical file-type and save rules. Exact per-type raw representation, toggle availability, tab identity and service contract remain open in [I-014](ISSUES.md). This direction does not claim the current File Viewer already supports every type or toggle.

### D-012 — Treat Office and Capture as configurations of the shared collection

- **Source:** Owner's 2026-09-29 Office/Capture comparison in this conversation: Office card clicks open files in new tabs like Google Docs; Capture/Launchpad card clicks show a card or full-width modal, with a header action to send to a tab. Both can hold mixed file types.
- **Status:** active
- **Scope:** Office configures the common card/thumbnail collection to open a clicked file in a new canonical file tab, with raw-style card defaults where applicable. Markdown and HTML may live in Office; HTML opened in a tab can switch to rendered display. Capture (later Launchpad) configures the same collection for rendered-style card defaults, immediate subfolders as one-depth headings, and view-only card/full-width modal preview on click with an explicit header action to open the file in its own tab. An Office document in Capture remains preview-only until sent to a tab; Markdown in Office opens in a tab by default. “Office document” preview restrictions in [D-009](DECISIONS.md) are file-type rules, while “Office” here names a view configuration. Exact preset fields and modal/card host mechanics remain open in [I-013](ISSUES.md); neither preset adds a second editor.

### D-013 — Offer per-repo file capture and record-retention choices

- **Source:** Owner's 2026-09-29 follow-up: “Chokidar as option. You can get all mutations or just the system recorded edits via tab” and users can limit internal DB records through configuration beside the proposed snapshot database. Current watcher behavior and accepted retention boundaries are checked in [REF-016](REFERENCES.md).
- **Status:** capture alternatives superseded by D-015; optional record-retention boundary remains active
- **Scope:** Expose a repo-local, System-owned configuration choice between recording eligible canonical tab saves and also observing eligible filesystem changes through Chokidar. The broad mode means all changes the watcher can observe within its configured scope; it does not claim every intermediate write, an authenticated actor or app-database mutations. Let the user choose which optional observation/record classes are retained in the proposed repo-local snapshot store and System ledger, with the configuration located alongside that store. Keep necessary live file-change delivery distinct from durable recording. Exact path, categories, defaults, retention effects and reconciliation with currently required save preimages and System records remain open in [I-016 and I-019](ISSUES.md). This folder records the plugin-facing boundary; file-versioning, watcher, ledger and System owners implement the policy.


The 2026-10-03 direction in [D-015](DECISIONS.md) replaces the Chokidar/tab-only alternatives with preserved user-edit versions, trigger/harness snapshots and a periodic fallback. The paragraph above remains the historical 2026-09-29 source; it is not a requirement to keep Chokidar.

### D-014 — Push a repo snapshot copy by default; protect the live database

- **Source:** Owner's 2026-09-29 direction in this folder: default the proposed repo database to flag at 80 MB, push it to GitHub/GitLab by default, never pull to override the database, and warn at 80 MB that GitHub/GitLab snapshot pushes stop above 100 MB. Provider limits and safe SQLite backup methods checked in [REF-017](REFERENCES.md).
- **Status:** active
- **Scope:** For a repo with a configured GitHub or GitLab remote, make remote publication of a consistent snapshot-database copy the default backup behavior. Keep the writable local database distinct from the Git-published copy. Git fetch/pull or checkout may update the copy in the repository, but must never automatically restore it into or overwrite the live database; restoration is a separate explicit operation. Raise a size warning at the owner-stated 80 MB threshold, explaining that the default Git publication route stops at the owner-stated 100 MB ceiling. When the copy reaches the effective ceiling, stop its new Git publication and report that status while local capture continues. Apply a stricter provider/repository limit when required. Exact byte units, copy path, push cadence and branch, remote-unavailable/conflict behavior, and history growth are open in [I-020](ISSUES.md). This does not authorize a Git push now or alter the separate proposed 1 GB local-capacity notification in [I-018](ISSUES.md).

### D-015 — System-owned repo snapshots with linked events and a periodic fallback

- **Source:** Owner clarification in the chat/harness diagnosis conversation, recorded 2026-10-03: preserve user-edit versioning and snapshots for trigger/harness events; use about 30 minutes as a fallback with both copies; keep event/file links without declaring causality; “We’d make snapshotting system owned, plug ins grant the permissions / source and destination.” The owner then explicitly requested incorporation into this document set. See [REF-018](REFERENCES.md).
- **Status:** active
- **Scope:** System owns snapshot execution and enforcement, with file-content/version storage in a repository-local SQLite separate from `fusion.db`. Plugins supply the permission/grant configuration and authorized source/destination declarations; System validates and enforces the approved grants rather than treating plugin self-declaration as authority. Preserve existing user-edit versioning and required save preimages. Trigger and harness events prompt snapshots; periodic scans at approximately 30-minute intervals are a fallback for otherwise missed changes, not a replacement for those event captures. Retain the previous and newly observed content copies, file/version references, capture times/comparison window, snapshot reason, and links to the initiating and relevant recorded events. These links establish association, not mutation causality; unmatched events or file changes are audit clues for the user/assistant rather than automatic fault or causal findings. The fallback records observed before/after states, not every intermediate edit or exact mutation time. Snapshot implementation is future work and does not gate the current Chokidar removal/chat verification assignment, as clarified in [D-016](DECISIONS.md). Removing Chokidar is the owner's current target; this supersedes D-013's Chokidar/tab-only capture alternatives while retaining its optional record-retention configuration boundary. Exact store path, machine/workspace scope, migration, supported content/limits, declaration/completion grammar, overlap/failure behavior, scan cadence/configuration and replacement of watcher-driven freshness/trigger inputs remain open in [I-016, I-017 and I-019](ISSUES.md). [D-014](DECISIONS.md) continues to govern separate Git backup copies. This records direction and does not claim implementation or authorize plugin/System database migration in this documentation assignment.

### D-016 — Defer snapshot implementation beyond Chokidar removal

- **Source:** Owner's 2026-10-03 clarification in local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`: half-hour snapshots and event triggers are future work; current work is removing Chokidar, establishing that it no longer breaks chat, and moving on. The owner explicitly requested this future work be noted in plugin-foundation. See [REF-019](REFERENCES.md).
- **Status:** active
- **Scope:** Carry D-015's System-owned repository-local SQLite snapshot direction as future work: event-triggered captures plus approximately half-hour fallback captures, preserving both observed copies and non-causal event/file links. This folder owns the plugin capability/grant seam; System/file-versioning owners implement capture and storage through separately authorized planning. Snapshot readiness, new event-trigger delivery, trigger migration and replacement file detection are not prerequisites for the current Chokidar retirement and actual chat-path verification. The owner also directed disabling the ledger's `file:changed` recording; unrelated listeners and existing independently functioning save/version/tool-observation paths remain separately scoped. This supersedes earlier sequencing that required fallback readiness before watcher retirement, not D-015's future design direction. Exact store path, scope, schema, migration and completion/cadence contracts remain open. No implementation, schedule or operational monitor is created by this record.

### D-017 — Plan the successor work in this folder

- **Source:** Owner's 2026-10-03 correction in this conversation: “Chokidar is being removed in another session as soon as the SPEC is ready. Our job is planning what comes next.”
- **Status:** active
- **Scope:** This conversation and plugin-foundation folder focus on shaping the work after Chokidar retirement, especially the protected plugin capability/grant seam for D-015's future System-owned snapshots and its dependencies. Another session owns the Chokidar-removal SPEC and later execution/chat verification under its own approval flow. Planning here may proceed while that SPEC is prepared; future snapshot implementation and completion are not prerequisites for retirement. Do not treat another session's work as performed or approved because it is described here. The exact first proving plugin and order among the broader foundation capabilities remain open.

### D-018 — Use Launchpad and Capture for a multi-step roadmap

- **Source:** Owner's 2026-10-03 clarification in this conversation: this is a long Launchpad and Capture discussion for a multi-step roadmap; discussion is not an invocation to change code; the work will proceed through preflight, First Draft and Roadmap Creation.
- **Status:** active
- **Scope:** Keep this conversation in pre-roadmap shaping and durable Capture while the owner and session explore scope, sequence, decisions and gaps. Prepare planning inputs, then use the separate preflight, First Draft and Roadmap Creation procedures at their appropriate handoffs. None of those stages is product implementation approval. Do not interpret design discussion, a captured idea, or the mention of a future stage as authorization to edit product code, run a build/deployment, or execute a SPEC. Preserve individual stage outputs and owner checkpoints as the roadmap matures.

### D-019 — Treat Apple Mail and Calendar monitoring separately from repo snapshots

- **Source:** Owner's 2026-10-03 discussion in this conversation: Fusion begins on Apple systems, Mail and Calendar data should come from the native Mac apps, full native app integration is outside this planning scope, and a 30-minute repository-file fallback is too slow for new mail or calendar changes. The owner reported about 16,000 open handles during the Chokidar failure and wants timely monitoring without that resource pattern. Current code and supported Apple signals were checked in [REF-020](REFERENCES.md).
- **Status:** active
- **Scope:** Keep Apple Mail and Calendar as the initial native sources of live domain data, consistent with [D-006](DECISIONS.md); leave Linux and Windows adapters for later. Do not apply the repo-local 30-minute file-snapshot fallback to Mail or Calendar freshness. Plan a separate, bounded native-connector monitoring capability that can report new mail and calendar changes to Fusion without recursive file watching or direct dependence on private Mail/Calendar database paths. The desired detection latency, connector mechanism and exact change coverage remain open in [I-021](ISSUES.md). The reported handle count is a design constraint to investigate and measure, not a diagnosis established by this folder. This decision does not expand the current roadmap to full Mail/Calendar read/write tools or implementation.

### D-020 — Let plugins own native listeners under System scheduling and UEB admission

- **Source:** Owner's 2026-10-03 follow-up in this conversation: Mail and Calendar are plugins; a System interval function can schedule them, but the actual listener belongs in the plugin and feeds real changes to the event bus, where their flag/provenance can be subscribed to by other plugins or triggers. Earlier async callable and command/fact direction is recorded in [D-003 and D-005](DECISIONS.md), [CAPTURE](CAPTURE.md), and [REF-005 and REF-006](REFERENCES.md); the earlier [plugin vision §4.7](</Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md>) proposes interval registration and bus subscription/emission.
- **Status:** active
- **Scope:** A protected Mail or Calendar plugin owns its native-source listener or bounded query logic and may request System-managed interval/one-shot scheduling through a declared, granted capability. Its background work belongs to the enabled plugin's server-side lifecycle, not the mounted view's focus lifetime. On a confirmed source change, the plugin submits a typed observation to Fusion's governed producer boundary; Fusion checks registration, grant, schema, rate/budget and evidence, assigns the trusted envelope/provenance and admits a UEB fact. Authorized subscribers, including another plugin, a trigger and the relevant view-refresh projection, can react to that fact. A downstream mutation still uses an independently authorized named command. A UI-initiated plugin function continues to return a bounded outcome asynchronously to its caller; its admitted outcome fact is a separate publication path. Exact schedule contract, producer identity, event schemas, delivery/durability, lifecycle and source-diff criteria remain [I-022](ISSUES.md). This is planning direction, not a claim that arbitrary plugin listeners, emitters or subscribers exist in the current runtime.
