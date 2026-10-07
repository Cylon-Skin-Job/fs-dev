# First Draft — Chokidar retirement and OpenCode launch recovery

## Status and basis

**Status:** `FIRST_DRAFT`, revision 2 of `CHAT-AR-FD-CHOKIDAR-OPEN-CODE-001` — a discussion skeleton for bounded retirement and subsequent actual chat verification. This is not an executable SPEC, implementation approval, or evidence that chat is fixed.

**Current planning target:** remove Chokidar, its watch registrations and obsolete dependent startup/refresh calls; disable only the ledger's recording of `file:changed`; verify the actual normal public chat path afterward; then finish the bounded retirement. Half-hour snapshots, new event-triggered snapshots and trigger migration are future work. Their readiness does not gate this removal, and this work does not recreate automatic file detection.

**Revision authority:** the [owner amendment](reports/owner-direction-file-changed-ledger.md), plugin-foundation [D-016](../../../plugin-foundation/DECISIONS.md#d-016--defer-snapshot-implementation-beyond-chokidar-removal) and [REF-019](../../../plugin-foundation/REFERENCES.md#ref-019--owner-separates-current-chokidar-retirement-from-future-snapshots) supersede revision 1's fallback-readiness hold and requirement to preserve file-change ledger recording. D-015 remains the future snapshot direction. PF-01/PF-02 in the [historical preflight](reports/preflight-spec-handoff.md) are addressed throughout the cards, dependencies and return below; PF-04 is technical work for later SPEC planning, not missing owner intent.

**Review identity:** [the prior independent report](reports/final-independent-draft-review.md) covers only revision 1, SHA-256 `86e4dfa898587cdb4f7c4b0edb46ed8cec5a9a77a27e8e8e48e2198bd1487a06`, before these scope corrections. Its clean verdict is historical. Current independent validation and supervisor disposition belong to the separate revision-2 review/stage reports linked by [PLANNING](PLANNING.md); this author does not claim that validation. No fallback-readiness or consumer-disposition owner decision remains open.

**Owner direction and boundaries:**

- Removing the watcher stops its automatic filesystem observations. The watcher-fed file filters/triggers, chat file-mutation metadata and external theme-refresh observations therefore cease receiving that producer's input. Account for obsolete coupling without replacing the detector or deleting independently functioning listeners. This consequence follows the current removal scope; do not ask the owner to authorize it again.
- Retire the ledger's `file:changed` recording. Preserve ledger recording of `workspace:switched` and `thread:state_changed`, as well as the separately governed save/tool provenance paths. Existing history is not a deletion target.
- Preserve independently functioning capabilities: cron and chat/ticket/agent/system event triggers, direct screenshot capture/attachment, mediated user-edit preimages/versioning, shadow Git checkpoints and admitted tool-completion resource observations. Removal of one producer does not authorize unrelated listener/function redesign.
- Retire the obsolete macOS screenshot-folder monitor; the in-app button remains. A future System event from the button is direction only and is not required here.
- The unfinished Apple Calendar directory listener may retire if no server/renderer code waits or races when it does not fire. Distinguish its watcher-driven sync from the separately opt-in Google poller and preserve independent Calendar paths. Calendar completion is outside this work.
- System-owned snapshots in repository-local SQLite separate from `fusion.db`, plugin source/destination declarations with System enforcement of approved grants, approximately half-hour fallback and event-triggered capture remain future work in plugin-foundation. Retain both observed copies and their comparison window; event/file links record association rather than causality. When that future detector exists, a discovered external change may then initiate the matching file trigger at the accepted delay. Exact storage/schema/migration and event/completion contracts remain open there, not here.
- Together.ai retry is separate and deferred; server warm-up is unconfirmed. No provider retry, transport redesign, high-descriptor stress exercise or failure-UX redesign is included by association.
- The owner requires **First Draft → SPEC → owner approval → implementation**. SPEC-06 remains owner-accepted with residuals and is not reopened. Accidental earlier production/test edits were exactly reverted; their temporary tests/patch are not an implementation or approved fix. No product code or runtime was changed by this revision.

**Verified locations:** memory CWD `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`; controller home `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`; read-only source checkout `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`. Applicable repository, server, MC and folder instructions were checked separately. No main-session/checkpoint identity is acquired by this author.

**Conversation source:** built-in `read_thread`, host local, thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, title **Map Fusion–OpenCode chat failure states**, confirmed against the assigned CWD. The bounded revision read covers the recent settled owner turns `01a10175-68e2-7331-bfb1-088491f953bb` (ledger retirement), `01a10176-97e1-7932-ace6-c77e2f8999c2` (current removal/future snapshots), and `01a101a8-ac8f-7542-b2c9-15a6a7117211` (plugin-foundation incorporation), plus the current correction assignment. Earlier screenshot/Calendar and investigation direction is carried by the assigned packet and prior draft's bounded history reads. This is not an exhaustive history checkpoint and advances no boundary.

**Evidence classification:** current owner directions govern scope; Wiki/standards govern the independent paths and existing chat contract; source hashes and prior audit describe the implementation; temporary descriptor probes describe an isolated mechanism. Native `fs.watch` is an unselected historical feasibility proposal, not the replacement architecture or a required investigation. The baseline still contains Chokidar. Its removal is proposed, not completed.

## Capability skeleton and candidate order

The cards describe parts of one bounded retirement and its observable verification. They do not prescribe multiple SPECs or an execution order. Screenshot and Calendar are retirement seams; shared watcher/dependency cleanup supports the later chat check. Exact code ownership, remaining references and narrow checks belong in SPEC planning. No snapshot/scanner or trigger migration dependency intervenes.

| Candidate area | Observable outcome | Current disposition |
|---|---|---|
| Shared watcher retirement | Normal startup/chat operation no longer creates Chokidar watches. Automatic observations from this producer stop; ledger file-change recording is retired. | Owner-settled removal; clean up only obsolete registrations/calls and preserve independent paths. |
| Screenshot-folder retirement | Old macOS folder additions are no longer imported; the direct screenshot button still saves and attaches its capture. | Owner-settled obsolete monitor; caller tracing remains a bounded SPEC task. |
| Apple Calendar listener retirement | Startup/current Calendar behavior proceeds without a filesystem callback; the independent opted Google path remains intact. | Owner permission includes the no-wait/no-race check; Calendar feature completion is excluded. |
| Chat verification after retirement | A normal public chat prompt reaches an actual OpenCode child, produces a response and persists a readable exchange. | Required proof after implementation; removal alone is not evidence of success. |

## Candidate slice cards

IDs `CD-01`–`CD-04` remain local shaping labels, not approved SPEC/slice identifiers. CD-01/CD-03 are retirement enablers consumed by CD-04, not invented standalone user features.

### CD-01 — Retire Chokidar and file-change ledger recording

- **Outcome:** Normal startup no longer loads/registers Chokidar watchers, obsolete watcher lifecycle calls are gone, and the ledger no longer records `file:changed`. Workspace/thread ledger records and independent event listeners continue through their existing owners. This enabler supports CD-04's actual chat outcome; its resource benefit is a hypothesis to verify there.
- **End-to-end path:** startup/workspace ownership → shared watch core and its registrations → cleanup of obsolete producer coupling; ledger subscription selection → preserved workspace/thread records. File-filter/trigger, chat metadata and theme consumers no longer receive automatic observations from the retired producer. Their independent functions are not redesign targets.
- **Prerequisite:** Current reference/caller coverage sufficient to remove the dependency without leaving startup/import errors or an awaited missing callback. This is technical SPEC work on the existing owners. No fallback, replacement watcher, repo snapshot database or UEB trigger migration is required first.
- **Smoke scenario (proposed):** Start through the normal app/server path and exercise ordinary workspace use with no retired watcher registration/import errors. Observe that Chokidar is absent from the owned runtime/dependency path, no watcher-based `file:changed` ledger record is created, and independent workspace/thread events still record normally. Verify the preserved save/tool and non-file-trigger paths using focused existing contracts, then use CD-04 to establish chat behavior. These are proposed checks, not passed tests.
- **Nearby regression / constraints:** Required save preimages, existing tool observations, shadow Git checkpoints, workspace/thread ledger history and independent cron/chat/ticket/agent/system trigger paths remain in scope for preservation. Governed save/tool facts and projections are distinct from the retired legacy file-change feed. A delayed future observation must not be retrospectively attached to a finished chat turn.
- **Technical follow-up / excluded scope:** SPEC planning traces live registrations, imports and obsolete cleanup calls, and documents which automatic observations stop. It does not revive the old consumer-disposition choice or fallback-readiness gate. No replacement detector, numbered-descriptor reservation, general scanner or listener overhaul is part of this card.

### CD-02 — Keep direct capture working while retiring screenshot-folder import

- **Outcome:** A newly appearing macOS screenshot no longer causes automatic import. The in-app button still captures the intended Fusion window, receives its matching file-save result and supplies a pending chat attachment.
- **End-to-end path:** capture action → Electron `capturePage` → correlated `screenshot:file-capture` request → server PNG write in the owning workspace's `ai/<machine>/Data/Screenshots/` → matching pending attachment. Remove only obsolete source-folder/hotkey watcher calls coupled to this direct route.
- **Prerequisite:** Preserve the existing request ID, workspace/thread ownership, protected path and attachment contracts. The exact fate of obsolete refresh requests/acknowledgements is a caller trace at SPEC time, not a new owner decision or pre-draft research gate.
- **Smoke scenario (proposed):** Capture with the in-app button, observe the correlated saved PNG and pending attachment for the intended chat, and confirm the old folder monitor is absent. Gallery contents or ribbon preview alone do not prove this attachment route.
- **Nearby regression / constraints:** Preserve direct screenshot capture/attachment and existing independent gallery/preview behavior. An old monitor import is not the button's replacement path. No automatic prompt send is added.
- **Technical follow-up / excluded scope:** Trace live callers of source-folder refresh and remove only obsolete coupling while preserving the direct capture response. New System event publication, gallery redesign and provenance producers remain future work.

### CD-03 — Remove Apple Calendar watching without a missing-callback wait

- **Outcome:** Startup and the current Calendar surface do not hang or race when the retired Apple filesystem listener never fires. The separately opted Google poller and other independent Calendar functions retain their existing paths. This startup enabler also supports CD-04.
- **End-to-end path:** Calendar provider/configuration ownership → removal of Apple watcher lifecycle → current startup/UI and passive sync consumer behavior. Google polling is a separate producer, not another Chokidar use to remove.
- **Prerequisite:** SPEC planning confirms there is no awaited watcher-only completion or startup/renderer coupling. Prior bounded audit found a passive `calendar:sync_complete` broadcaster and no awaited sync promise; that is source evidence, not a fresh runtime result.
- **Smoke scenario (proposed):** Start without the Apple listener and without a filesystem sync event; startup/current Calendar view reaches its ordinary state without hanging. Confirm a separately enabled Google path remains independently wired. The current mounted demo view is not a completed external Calendar integration.
- **Nearby regression / constraints:** Preserve the Calendar UI, independent query/sync services, provider gates and opted Google polling. Apple's watcher-initiated automatic sync ceases with its producer; do not introduce a replacement refresh contract or wait for Calendar completion.
- **Technical follow-up / excluded scope:** Verify the no-wait/no-race condition through actual callback/caller ownership at SPEC time. Only a concrete discovered dependency changes this technical framing; no broad Calendar/provider redesign is implied.

### CD-04 — Establish actual chat operation after retirement

- **Outcome:** After Chokidar retirement, a user sends through the normal public Fusion chat route, an actual OpenCode child starts using its established communication, a response reaches that chat and its exchange persists/readbacks correctly. This is the owner's completion condition for the bounded retirement.
- **End-to-end path:** trusted normal chat activation/send → server-owned acceptance → thread runtime/OpenCode adapter → actual child and canonical response stream → saved exchange and history readback. A helper spawn probe or `wire_ready` alone does not prove this route.
- **Prerequisite:** The bounded retirement is implemented under a separately approved SPEC. Current thread/workspace authority, adapter environment and chat acceptance/persistence contracts remain intact. No new spawn subsystem, synthetic failure scenario or high-FD stress suite is presumed necessary.
- **Smoke scenario (proposed):** With the retired watchers absent, use the normal app chat entry point, observe server acceptance and an actual child launch, receive the normal response for the intended `threadId`, then reopen/read history to establish persistence. The later SPEC chooses the narrow faithful public-route verification; this draft does not send a prompt or call a provider.
- **Nearby regression / constraints:** Preserve server acceptance (`message:sent`), thread/turn routing and frontier, adapter translation/environment isolation, existing stop and persistence ownership. Neither a reduced descriptor count nor a passing isolated probe certifies chat fixed. Do not infer a DB-size, threading, duplicate-key or invalid-workspace cause.
- **Technical follow-up / excluded scope:** If actual chat still fails, investigate that observed failure within the approved scope and report its concrete boundary instead of declaring removal sufficient. A separate speculative spawn/failure-UX architecture card, controlled failure/high-descriptor exercise and Together retry diagnosis are outside this draft.

## Source and standards coverage

Current User Preferences require faithful scope, the smallest suitable abstraction and explicit deferral consequences. Code Standards require reuse of existing owners, deletion of retired paths, public-route verification and honest current/future classification. New cross-capability producers would require governed schema/provenance/subscriber planning; this retirement does not create such a replacement. Existing independent protections remain required. Harness, WebSocket and Chat contracts keep server-owned authority/acceptance, canonical thread routing and adapter boundaries intact.

| Intent / concern | Evidence and contract | Coverage in revision 2 | Remaining limit |
|---|---|---|---|
| Remove Chokidar now | Latest owner conversation; amendment; plugin-foundation D-016/REF-019; current core/startup/package bytes | CD-01 stops automatic producer observations without a substitute or fallback hold. | Exact obsolete references/checks are SPEC technical work. |
| Disable only file-change ledger recording | Ledger-retirement owner turn and amendment; UEB distinction between legacy ledger and governed save/tool facts | CD-01 preserves workspace/thread records and existing independently governed provenance. | Production removal and focused subscriber verification have not run. |
| Future snapshots/storage/trigger migration | D-015/D-016, REF-018/REF-019, I-016/I-017/I-019 and plugin-foundation INTENT | Named future owners and separately authorized resolution point below. | General scanner absent; no path/schema/migration is chosen here. |
| User versioning and existing observations | File Versioning, Resource Events/Render Sync, Persistence and UEB standards | Existing save preimages, Git checkpoints and tool observations remain independent preservation constraints. | Their bounded coverage does not replace missing general external-file observation. |
| Screenshot retirement | Screenshot Capture page; prior direct-route source inspection | CD-02 preserves button/correlated PNG/attachment while removing obsolete coupling. | Caller tracing is a later SPEC task; no fresh runtime test. |
| Calendar listener | Calendar View page; prior watcher/broadcaster audit | CD-03 includes no-wait/no-race check and independent Google path. | Detailed current caller check belongs in SPEC planning. |
| Local launch failure | Prior adapter/source audit and disposable descriptor evidence | CD-04 requires actual child/response/persistence through normal public chat. | Production pipe identities, leak and removal sufficiency remain unproven. |
| Existing chat contract | Chat overview, Harness Boundary, Chat WebSocket Protocol; relevant routed standards | CD-04 preserves authority/acceptance/routing/environment/persistence. | No speculative transport/failure-UX work or provider-retry promise. |
| Planning gates | First Draft skill/session/shared planning contract, owner workflow instruction | Historical validation is distinguished from the revised candidate; supervisor obtains fresh review/sweep/preflight. | This author does not grant independent validation, SPEC creation or implementation approval. |

### Source identities and freshness

Revision read/check date: 2026-10-03. The current draft was read completely before revision and checked against its assigned SHA-256. The source checkout/branch/HEAD and memory CWD were independently resolved. The product-source identity checks below reuse prior bounded investigation rather than pretending to be a new exhaustive audit. Relevant product paths reported clean in scoped `git status`; the rest of the dirty checkout was preserved. No deep source search, test or runtime probe was needed for this scope correction.

**Authority and coordination bytes read:**
- PLANNING.md: `d6d1dfb4f6888f769fb443695324f598589841dd72aa70d2baaf9f45b6587092`.
- Owner amendment: `b564b62e86d968d56ae39e60f9f51be9e9e9cd5ff341dfcd901557fb5157e9e2`.
- Historical SPEC-handoff preflight: `1610645d872b115c67342fd3b55b040e6fa5a3f3cfe86102eab5d35553a6fb0a`.
- Plugin Foundation DECISIONS (D-015/D-016): `838000a77890343ed480a7bfa7eb76517ce21c027e7f9e94960e1e5ff7ddf182`.
- Plugin Foundation REFERENCES (REF-018/REF-019): `e8c5ba393f0c3d1f412756d45be83cf5e73798e838f58fd3b9dd6de4aecdfc49`.
- Plugin Foundation INTENT: `6f53f6517ed2248039ba52fcfaedfb1be939d0455351f0d09249e0d44b451ca5`.
- Plugin Foundation ISSUES (I-016/I-017/I-019): `a4e8daa4a4d85639cf9fd304710b397eb363e44fb61e5ef0ee2decfddf8cce73`.
- Session contract: `3660899b644a37f5709b59de9fd45001cc6ff9f3e6b7af6b8814949ec57929ac`.
- mc-first-draft/SKILL.md: `f486d1756d259954c251a4c75ba8f839251462e2d0d820ded815b8d7dee2d1e1`.
- Shared planning contract: `8fefc024a79cc1368f54392e63e6c5a2458c18823cf8dbe76986b150c34ca55f`.

**Current machine Wiki read in full:** User Preferences, Code Standards hub, the relevant routed Architecture Routing, WebSocket Protocol, UEB, Harness Adapters, Persistence And Metadata and Testing And Smoke Slices pages; required Chat overview; File Versioning, Resource Events/Render Sync and Correlation/Causality; Screenshot Capture, Calendar View, Chat Harness Boundary and Chat WebSocket Protocol. Each source retains its own evidence date; reading a contract today is not a runtime recertification. Exact paths and current SHA-256 identities follow.

- `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md`: `45fa9f630563d79935d5a461b308c823c0db3ded5c23817ba6d4c8a06c794ed5`.
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`: `de3995c68ae84f3b0fa389c6af0327e21dd08f30ac9ffbc7548b76f80ac393d7`.
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`: `4c5fcbf62912c9e8ff6d3d0e1ec07016145e1f1c90c792a162dfcc3ca1b0bfba`.
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`: `5b77528cec69d60c11c0487a349ec1cfb0b9a47eb69c213dedd1fbf1797dbad6`.
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`: `4407d595f6f926996bd8bcacb6b0117849606de61662acfe463c3d80f8f4f640`.
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`: `5ece90e88dac136f7ec464b0219a3eb242b7837d118dbbdaba57de673b8a5919`.
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`: `bd3e7be468289ac0a6ee6502cd8b9fc340f03fd7568deb59370ed00cc3b2a7a3`.
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`: `e7319750bd27b7ccdad8e5e451b9779044e8fc7a713fc6d461113b409b39018d`.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`: `696afb2d3ec027256e783957c3461eb03300db0b97b34b3e62162977c22ed42f`.
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md`: `a9fe2d2eefa7ebf57d4e3447abc5361c1e946ca959375f567417387f15b29ba6`.
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/005-Resource_Events_And_Render_Sync/PAGE.md`: `9a2ef429523306ec4f3384749dd7c3feefc4d8525e09f510bc6469dffe981259`.
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/007-Correlation_And_Causality/PAGE.md`: `a01fdd8e3fae33e86db22a418b5dd7fa8fb1494286ae40c6a01a44b13b746809`.
- `ai/RC-MacAir-15/Wiki/004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md`: `f2c246f03da1f9b6858f7dd28019368bc9a05de4f83a9a0dc8ab6cbaa9bae7a5`.
- `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/016-Calendar_View/PAGE.md`: `3994815e9be4d446c3d3e235a5738d3b6f62d5c6a4def7ca76bf594a4d25c2b4`.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/001-Harness_Boundary/PAGE.md`: `c2befc2bfc71701074fae823ea1c13f1f2d87f4e19702b01e78f9407f01d52e2`.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md`: `da50b4207e1fb71614a583c54bf89a3dafe42ce39024a40e62434f0826fdd1f9`.

**Product-source fingerprints checked against the prior bounded audit:**

- `fusion-studio-server/package.json`: `3833f2758cec00e0e4be6ba561def3732ed15f2796452b041d25bfb2c4e0389e`.
- `fusion-studio-server/lib/watch/core.js`: `3f0ea12c0732d0e44721709e21681358514aae7145c96d7763e81996829b8ba2`.
- `fusion-studio-server/lib/watch/workspace-watcher.js`: `acd4b8a7e58223c5c3fa0259f7c2d6471b618e769e98b24b2b3ed0c9104511b3`.
- `fusion-studio-server/lib/startup.js`: `9e6d99316fde584d08828685c3df762d1ea3e557d118b1e1207defe52993e382`.
- `fusion-studio-server/lib/screenshot/ws-handlers.js`: `4fe5c9bf3a55a59c0c68931cd6bb584154ad9229691ed6e173700684c137ac14`.
- `fusion-studio-server/lib/calendar/index.js`: `3677e7563383c9e4c0b56077212247a7dab838a7492a1cc6ea4849b44804407b`.
- `fusion-studio-server/lib/workspace/workspace-controller.js`: `4042bde78e7e6a7bfed1a6fd98828e8c82667632ef0143f09e3650d036ad2c27`.
- `fusion-studio-server/lib/harness/opencode/index.js`: `5dbe53e8f262661164dca0a87ab3f217ead35150629fd43ca42020685f9973e0`.
- `fusion-studio-client/src/screenshots/chatScreenshotCapture.ts`: `bd34c041e9f8fa6cfc7a328633af7c53566045b1e6e6c55ee61617d030a89687`.

**Incident evidence carried forward, not rerun:** `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/alpha-chat-launch-ebadf-ecobqazx/` contains the original descriptor reproduction, sparse native boundary probe and pinned libuv source. That prior evidence accepted FD 10239 and rejected 10240+ for macOS spawn file actions despite valid open descriptors; piped Node child launch failed at high numbers and recovered after fixture handles closed. Apple wrapper source locator: `https://github.com/apple-oss-distributions/xnu/blob/main/libsyscall/wrappers/spawn/posix_spawn.c`. The prior native-directory experiment at `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/native-directory-watch-check-3w9ilirn/result.json` is an unselected alternative, not a current requirement. These artifacts/online sources were not rerun or newly certified by this author.

## Dependencies, impact and deferred-work contract

**Observed in the prior audit; matching current source identities:** the shared core imports Chokidar, the package declares it, and startup registers one workspace watcher at the initial active repository root. Direct users are that workspace watcher, the old screenshot-folder monitor and optional Apple Calendar watcher. The workspace watch's file filters/triggers, legacy ledger, active-turn chat mutation collector and external theme regeneration receive its observations. A ticket-dispatch subscriber exists, but no active startup registration was found within the prior audit's boundary.

**Current disposition:** all Chokidar watch registrations and obsolete dependent calls are retirement targets. This stops their automatic external-file observations; the watcher-fed trigger/filter, metadata and external-theme inputs are not replaced here. Ledger `file:changed` recording is intentionally disabled. Preserve workspace/thread ledger subscriptions, other independent event subscribers and existing save/tool provenance. A source module's receipt of watcher input does not authorize deleting its unrelated functions.

**Launch inference and limits:** the prior Alpha incident had roughly 16,242 descriptors, mostly vnodes, with sampled paths beyond `ai/RC-Alpha` under the watched `fs-dev` root. Disposable spawn and sparse native probes support a numeric descriptor-boundary mechanism and make the watcher footprint the strongest explanation. The initial-root scope/lifecycle audit did not establish a leak; actual production pipe descriptor identities remain untraced. The required conclusion comes from CD-04's normal public chat result after retirement, not from assuming resource reduction is sufficient.

**Observed independent mechanisms:** mediated user-save preimages/file_versions, shadow Git checkpoints and admitted `agent.tool_completed` resource observations exist without Chokidar. Their existing protections and projections remain required. The reviewed baseline had no general repository-local scanner, managed trigger-completion capture or 30-minute fallback; removal creates no substitute coverage promise.

**Current technical dependencies:**

- Shared startup/import/lifecycle and ledger ownership must be reconciled narrowly at SPEC time, including removal of obsolete callbacks/effects and affected test/startup inventories. There is no new scanner/UEB migration dependency.
- Screenshot retirement must leave the correlated direct capture/write/attachment route intact while tracing its obsolete refresh coupling.
- Calendar retirement includes the no-wait/no-race check and independent Google provider path, not Calendar completion or a new Apple refresh policy.
- Normal chat activation/send must retain the existing server authority/acceptance, adapter environment, canonical stream and persistence paths. Detailed public-route verification belongs in the approved SPEC.
- Unknown overlap with other dirty product/Wiki work prevents declaring concurrent product edits safe. Later implementation verifies the current checkout and assigned ownership instead of cleaning unrelated work.

**Likely impact:** loss of the retired producers' automatic file/filter/trigger/metadata/theme and screenshot-import/Apple-sync observations; startup/import/callback cleanup; selective ledger subscription retirement; preservation of direct captures and independent event/provenance flows; chat resource pressure and actual launch result. No database-row purge, new snapshot store, provider retry redesign, runtime restart or Alpha deployment is authorized by this draft.

**Future work and resolution point:** plugin-foundation owns the contribution/grant seam; System/file-versioning owners implement separately authorized snapshot capture/storage; trigger/UEB owners plan future subscription delivery. D-015/D-016 and I-016/I-017/I-019 retain the need for event-triggered snapshots, approximately half-hour fallback, repo-local SQLite, both observed copies/windows and non-causal links. Their next resolution point is that separately authorized snapshot/subscription planning assignment. It chooses exact path/schema/migration, eligibility, completion signals, baseline/scanning scope and future file-trigger inputs before that feature's release; none is a current removal gate. The later scanner cannot recover changes occurring before it has a baseline, nor guarantee intermediate edits during the current observation gap. This retirement adds no substitute detector, schema or new coupling that would constrain the future design, and preserves the existing independent save/tool history that design may need.

The accepted future ordering remains: a fallback observes an eligible external file change, then the matching subscribed file trigger may run at the accepted delay. An event after a trigger finishes cannot by itself detect the external input that should start the trigger. This distinction remains a future design concern, without holding current retirement.

## Decision and research queue

No new owner scope decision is needed to revise this draft. The following current questions are bounded technical tasks for the receiving SPEC planner; they do not block shaping or require recreating file detection. Future questions are routed to their existing owners.

| Priority | Technical question / affected candidate | Why it matters | Resolver / resolution point |
|---|---|---|---|
| SPEC | Which imports, registrations, startup effects and lifecycle calls become obsolete when Chokidar is removed? CD-01 | Avoid dangling imports, callbacks or waits while preserving independent listeners; ledger `file:changed` retirement is settled. | SPEC planner traces current owners and affected inventories before executable release. No fallback-readiness or consumer-disposition owner question. |
| SPEC | Which source-folder refresh callers/acknowledgements remain independent of the retired screenshot monitor? CD-02 | Remove only obsolete coupling and preserve the button's correlated PNG/attachment result. | Narrow caller trace in SPEC planning; focused direct-route regression during later implementation. |
| SPEC | Is there any actual awaited Apple watcher-only completion or startup/renderer race? CD-03 | Owner permits retirement with no missing-callback hang; Google poller is independent. | SPEC planner verifies waits/provider gates; later implementation verifies ordinary startup/current surface without the event. |
| SPEC / verification | What narrow check faithfully exercises normal public chat, actual child/response and persistence after retirement? CD-04 | The prior descriptor probes do not certify the user route. If it still fails, its concrete observed boundary needs investigation. | SPEC planner defines the public-route smoke under existing chat contracts; implementation supplies actual evidence. No speculative separate spawn/failure-UX card or required stress exercise. |
| Future | What repo-local DB location, schema, migration, grants, eligibility and snapshot completion/cadence contract is chosen? | D-015 preserves intended copies/windows and association links, but no general service is built. | Plugin-foundation/System/file-versioning/UEB owners during separately assigned snapshot/subscription planning; held for that feature's release, not this removal. |
| Future | Which System fact should the direct screenshot button eventually publish? | Owner requested a future event note while permitting the existing button route now. | Screenshot/System/UEB owners when that event work is separately assigned; not a retirement gate. |

Together retry remains separately deferred and unconfirmed. Current evidence does not justify opening another provider diagnosis or asking the owner to settle warm-up.

## Author return and self-check

**Return:** `FIRST_DRAFT_READY_FOR_DISCUSSION`, revision 2 author handoff. The bounded skeleton now matches the settled removal scope. No current owner decision about snapshot sequencing or preserving watcher-fed observation remains open. Exact obsolete references, screenshot caller handling, Calendar no-wait semantics and public chat verification are visible SPEC technical tasks.

**Revision changes:** removed the fallback-readiness prerequisite/hold across CD-01, ordering, dependencies, smokes, questions and return; made selective ledger `file:changed` retirement explicit; named which automatic observations stop while preserving independent paths; bounded CD-04 to actual normal chat child/response/persistence without speculative architecture/failure or high-FD exercises; routed future snapshots/trigger migration to plugin-foundation with their own resolution point; distinguished old review evidence from this revision.

**Checks performed:** complete assigned draft/skill/session/planning-contract reads; applicable location/instruction verification; current User Preferences/Code Standards/relevant routed pages and required Chat/domain contract reads; bounded native owner-history retrieval; current amendment/preflight and plugin-foundation decision/reference/intent/affected issue reads; source branch/HEAD and scoped cleanliness checks; product-source hash comparison against the prior audit; exact input-byte check before the single owned rewrite. No product test, runtime/provider call or live chat verification was performed.

**Changed path:** `planning/chokidar-retirement-and-harness-launch/FIRST-DRAFT.md` only. No product, test, DB, runtime, provider, Alpha, publishing, sibling/shared-record or checkpoint write was performed by this author.

**Self-check:** each card traces to owner direction; retirement-only work is labeled as an enabler rather than a fabricated user feature; smokes are observable proposals; independent functionality and automatic observation loss are distinct; no future scanner readiness or repeated owner authorization is introduced; source facts, inference and limits remain separate; future work has named owners and a separate resolution point; actual chat success is unproven until verified. The previous draft's independent verdict is not reused for changed bytes.

**Next safe action:** the assigned stage manager obtains independent draft-mode validation on these exact revision-2 bytes. The supervisor then completes its scoped documentation sweep and fresh preflight. Later SPEC creation remains a separate owner-authorized stage, followed by exact-candidate approval before implementation. This author neither dispatches nor starts either stage.
