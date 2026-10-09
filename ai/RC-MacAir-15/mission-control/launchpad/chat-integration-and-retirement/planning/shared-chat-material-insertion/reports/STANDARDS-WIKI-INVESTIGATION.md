# Shared chat material insertion — standards and Wiki investigation

> CHAT-MATERIAL-PLAN-01 revision 1; investigation SWI-01 revision 1. Codex side chat (ephemeral), runtime child `/root/chat_material_candidate_stage/standards_wiki_investigator`, accountable to `/root/chat_material_candidate_stage`. Authored 2026-10-07T09:34:54Z. Outcome: answered within the bounded question; **authored output awaiting independent worker-handoff review**. No independent pass or candidate approval is claimed.

## Answer and planning consequence

The current guidance supports one renderer material-insertion contract in the existing chat action owner, using the existing workspace/session-keyed draft and attachment stores. Sources prepare material; the existing insertion owner resolves and snapshots a destination, validates that exact destination, then writes through established store actions. Connected composer hosts provide their explicit identity and lifetime; portable menu/presentation components receive callbacks. Main and Side Chat use the same session identity rules.

**Inference/recommendation:** this consolidation requires no new governed capability foundation if its scope stays within private renderer preparation/insertion and reuses unchanged screenshot-save, prompt-acceptance and provenance owners. It must document those existing boundaries and their legacy status. A new public plugin/agent insertion API, server mutation route, governed publisher/subscriber, new retained UI-action record or new permission grant would change that conclusion and require explicit schema/capability planning. None is required by the current owner request. Future auto-send/new-chat modes are excluded; existing unrelated modes in the action bridge are not authorization to expand them.

Two current articles contain claims that the next implementation must revise: Composer and Screenshot Capture describe global Main/Legacy targeting and composer cancellation caused by unrelated active-view focus. The owner now requires active open chat targeting globally, exact composer targeting locally, and cancellation for composer/owner change, closure or invalid destination. The later SPEC should also assign the Structure owner map and Testing route-coverage updates. This report does not edit any Wiki page or reopen the accepted previous build.

## Identity, authority and operations

Actual memory CWD was verified with `pwd` as `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`. The assigned output folder is its `planning/shared-chat-material-insertion/` descendant. Controller home was explicit and verified at `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`, containing the required session, stage and shared planning contracts. Source root was separately verified with Git as `/Users/rccurtrightjr./projects/fs-dev`, primary development checkout, `main` at `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb` at entry and fingerprint time. It is read-only for this assignment.

The sole owned write is this report. The runtime exposes unrestricted filesystem execution with approval policy `never`; successful read-only commands establish actual local source access. That capability does not enlarge the assignment. No product test/build, runtime operation, database read/write, Wiki edit, Git mutation, central record, checkpoint action or nested delegation was performed. Root model/effort were inherited without an override. The worker identity above is a runtime task path, not a persistent main-thread UUID; no main identity was claimed.

Full reads: applicable root, controller, memory, Wiki and server `AGENTS.md`; session/investigation/stage/shared planning contracts; output `PLANNING.md` and `OWNER-REQUEST.md`; local TICKET/index/BULLETIN/INTENT; completed-build handoff; Preferences; Code Standards hub and all eight routed standards pages; Taxonomy and Provenance hubs; Chat Overview, Decisions, Identity/Persistence, Thread Identity, Chat UI, Composer, Testing/Operations, Structure and Screenshot Capture. Bounded code reads covered the action bridge/consumer, screenshot owner, connected composer, surface-ID helper, owner-keyed stores and screenshot save handler. A narrow `rg` inspection of session actions/menu/gallery references supplied orientation only, not a comprehensive entry-point inventory; that remains the author's responsibility.

Authority classifications:

| Source | Classification and consequence |
|---|---|
| `OWNER-REQUEST.md`, Product instruction / Planning-only instruction | `owner_decision`: exact global/composer rules, Main/Side parity, capture-before-await, revalidation, source preparation, insertion default and explicit “Don't build.” Supersedes conflicting older helper/Wiki behavior only within this scope. |
| Preferences, current Code Standards and domain Wiki contracts | `source_of_truth_contract`: reusable ownership, layers, identity, state, server acceptance/persistence/provenance and verification requirements. Current owner instructions take precedence. |
| Existing action/screenshot/store code | `active_code_constraint`: demonstrated extension seams and old behavior requiring change; code does not overrule product intent. |
| October 7 completed-build handoff | Accepted-baseline evidence/context: prior retirement/startup job is complete at the assigned commit; original acceptance and evidence remain historical facts. It is not acceptance of this new controller behavior. |
| Suggested module seam and absence of a foundation dependency | `implementation_choice` recommendation and conditional inference; subject to independent review and the author's complete trace. |
| General UI-action/health/plugin capabilities in governance hubs; later auto-send/new-chat options | `proposal`/future direction, outside this SPEC. No new operational dependency is inferred from their availability. |

## Standards application and coverage

Wiki paths below are relative to `ai/RC-MacAir-15/Wiki/`; exact bytes appear in the fingerprint section.

| Current source / exact rule | Required application to this candidate |
|---|---|
| `000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md`, Scope and the 80/20 Preference (27–31), Reuse, Services, and Abstraction (33–37), Software Design Philosophy, Intake/Shaping/Delivery | Reuse the existing actions/stores; describe the complexity removed by one shared destination contract. Keep the smallest demonstrated abstraction; avoid a general framework for hypothetical modes. Preserve a repairable deferral only with its consequences/resolver/release condition. Main/Side and delayed ownership are explicit requirements, not optional polish. Keep one job per file and the under-400-line design goal. |
| `005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`, Hard Routing Rule (32–55), Modularity Rules (75–82), Architecture Layers (86–113), Portable components/connected hosts (131–147) | Identify the existing action consumer first. Extend its cohesive destination/insertion responsibility; if a focused private helper is warranted, state why that seam is needed and keep it subordinate to the same owner. Do not add another store/controller as a competing owner. Presentation emits callbacks, controllers avoid DOM, stores keep state. Delete replaced insertion bypasses as migration completes; do not preserve a second production path. |
| `001-Architecture_Routing/PAGE.md`, Rule, Required Questions, Forbidden Bypasses, New Route Exception | Record frontend action owner, screenshot preparation/save owner, store owner and unchanged prompt/provenance path. A new server/WS route would need evidence the current path cannot fit. There is no demonstrated reason for such a route for a RAM composer insertion. |
| `002-Frontend_UI/PAGE.md`, Rule, Allowed/Forbidden Responsibilities, Chat identity/action scope, Shared menu semantics | Composer/menu presentation receives explicit identity and callbacks from connected hosts. No reusable component discovers its destination from global state. `viewId`, group, session and mounted surface remain distinct. Shared menu mechanisms/selection semantics and accessibility survive routing changes; no visual redesign is requested. |
| `003-State_Management/PAGE.md`, Rule/Ownership, identity and Forbidden Bypasses | `workspaceId + threadId` remains the draft/attachment owner. Client stores legitimately own local attachments, selected IDs and render state; backend retains durable thread/runtime/permission authority. Derive destination validity through existing hydrated owners rather than persist a second selection/placement map. Do not patch view worksurface state to insert material. Local insertion success does not claim backend acceptance. |
| `004-WebSocket_Protocol/PAGE.md`, Allowed Path, Adding A Message, Command/response/fact, Authority-bearing actions | Keep existing screenshot request/response and prompt families. Snapshotting a renderer destination is not authorization for server work. Preserve server workspace/path/acceptance checks. A saved response is distinct from local attachment insertion and future prompt acceptance. Do not add new-chat/auto-send or client asserted authority. |
| `005-Universal_Event_Bus/PAGE.md`, Commands/facts, Current governed contract, Legacy/scoped supersessions, New-capability adoption | Existing renderer `fusion:chat-action` is a local command bridge, not governed UEB admission. Existing screenshot protocol is not automatically `resource.mutated@1`. Do not manufacture new UI/health facts, publishers or subscriptions for this consolidation. Explicitly record legacy boundary status and migration of replaced local insertion paths without claiming a platform-wide governed migration. |
| `006-Harness_Adapters/PAGE.md`, Rule / Not Adapter Responsibilities | No provider-specific branching, CLI syntax or adapter work is needed for destination/insertion. Preserve canonical attachment/prompt behavior and server acceptance. Existing harness rules are preservation constraints, not a reason to expand scope into harness repair. |
| `007-Persistence_And_Metadata/PAGE.md`, Rule, Persistence owners, durable identity, Protected System target | Do not change SQLite, mirrors, exchange collectors or view-state ownership merely to add prepared material to RAM drafts/attachments. Existing screenshot service still owns its saved PNG. Preserve exact attachment metadata for later server-owned acceptance and provenance. Do not expose screenshot or System writers as generic agent capabilities. |
| `008-Testing_And_Smoke_Slices/PAGE.md`, Rule / Slice Shape / Required Coverage By Risk / Forbidden Test Gaps | Later checks must start at user entry points, pass through the shared owner and observe exact target store changes; helper-only tests are insufficient for routing consolidation. Prove old bypasses removed. Capture/save correlation requires source preparation route assertions; native capture needs Electron evidence. Plan checks now; none were run here. |

The existing bounded files are below the 400-line goal: bridge 85, screenshot owner 210, draft store 77, attachment store 257, connected composer 160 lines; session actions were counted at 324. These counts indicate room for a cohesive extension, not permission to grow one module into multiple responsibilities. The app consumer currently mixes insertion with existing send/create orchestration; the author should specify a small internal destination/insertion seam rather than enlarge every responsibility.

## Governance assessment and grounded options

Observed code:

- `src/lib/chat-action.ts:51` captures one group/current-primary address before dispatch; `:70` uses the established `fusion:chat-action` bridge. `src/lib/chat-action-controller.ts:15` validates the captured hydrated address; `:59` adds through `chatFileLinkStore`, `:72` appends through `chatComposerDraftStore`; `:120` owns one app-lifetime consumer. These demonstrate an existing insertion owner.
- `src/state/chatComposerDraftStore.ts:13` and `src/state/chatFileLinkStore.ts:38` key by workspace/session. Their owner actions, revision and attachment-generation semantics remain existing state authority.
- `src/screenshots/chatScreenshotCapture.ts:33` resolves Main then `currentThreadId`; `:65` rejects a non-current view; `:86` correlates saved replies by request ID; `:145` captures and saves; `:192` directly adds to the attachment store. This last direct insertion is the consolidation seam, while capture/save stay source-owned.
- `src/components/chat/ConnectedChatComposer.tsx:58–76` currently binds the screenshot token to active-view selection as well as identity/mount; it must separate unrelated focus from lifetime under the current request. `surfaceId` remains transient UI identity, never durable/wire authority.
- `fusion-studio-server/lib/screenshot/ws-handlers.js`, `prepareFileScreenshot` and `screenshot:file-capture`, validates the active workspace/protected path, saves and returns request ID plus saved path. It emits no new governed fact in this inspected route. This is existing source preparation, not a foundation that insertion should replace.

Contract classification for the recommended design:

| Stage | Owner / contract kind | Governance consequence |
|---|---|---|
| User click + exact destination snapshot | Existing renderer chat action owner; local command | Use explicit global-versus-composer invocation. Snapshot active open Main or Side at invocation globally; composer callers supply their own exact owner. No new publisher/grant. |
| Material preparation | Source owner; screenshot uses existing native capture plus server save command/response | Preserve request-ID/saved-path correlation and path/workspace authority. Other sources retain preparation. No new schema claim. |
| Revalidation + insertion | Same renderer chat action owner; local mutation/projection through existing RAM stores | Validate captured owner and originating composer lifetime without re-resolving focus. Cancellation is bounded and must not silently retarget or create a chat. No new durable System record. |
| Later user Send | Existing prompt/receipt/server/persistence/provenance owners | Remains outside insertion completion; do not interpret an inserted pill/text as accepted prompt or saved exchange. |

Taxonomy `Current registered vocabulary` and `Direction and proposals`, Provenance `Current carriers and identities` / `Open design`, and UEB standards explicitly separate the four current admitted facts from legacy Chat, generic UI action and proposed health/plugin contracts. **Inference:** neither shared renderer validation nor moving an existing RAM store write behind its existing app consumer introduces a new cross-capability governed boundary. The SPEC must state this rationale and preserve source command boundaries; this is not a blanket exception for future material workflows.

Recommended option: extend the established app consumer with one reusable captured-destination/validation/insertion contract; keep source preparation separate and provide composer lifetime through the connected host. A cohesive private helper may implement that contract if needed, without another owner or store. The alternative of a new server/controller/capability catalog has no demonstrated benefit for the settled local insertion outcome and would introduce unnecessary authority/dependency scope. If complete author tracing finds a genuinely new boundary, name the missing capability and hold that affected scope until reviewed dependency or same-SPEC extension is defined.

No additional owner product decision was found necessary to answer this bounded question. Global active-open-chat resolution and validity semantics still require the author's exact code trace. Focus change alone must not redirect delayed global work or invalidate an unchanged live composer; a composer that actually changes/closes or a destination that becomes invalid must cancel. A hidden retained composer is not automatically closed merely because another view is focused.

## Exact later Wiki work and evidence renewal

These are implementation-time assignments; current behavior must not be rewritten as implemented while the “Don't build” hold remains.

| Exact page and affected current claim | Required later update / retained facts |
|---|---|
| `007-Chat_System/004-Chat_UI/001-Composer/PAGE.md:25`, Workspace And Thread Ownership at `:49–51` | Expand screenshot-only owner language to shared prepared-material insertion and identify the existing action consumer/connected host seams. Replace separate global Main/Legacy behavior and unrelated-focus/hidden-view cancellation with the global active-open-chat and composer-specific lifetime rules. Retain workspace/session draft/attachment ownership, pending-acceptance protection, server `message:sent`, plain textarea text and metadata pills. Name actual implementation modules in source metadata. |
| `004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md:26–30`, In-app captures and attachments | Describe source capture/save versus shared destination/insertion owner. Remove selected-Main/current-Legacy global fallback claim; global and composer cameras follow the same invocation rule as other material. Replace active-view/inactive focus cancellation with exact destination/composer validity. Retain native focused-window capture, workspace PNG save, request correlation, safe cancellation and possible already-saved gallery artifact. Retain gallery, separate preview, retired import and privacy/storage claims. |
| `007-Chat_System/007-Structure/PAGE.md`, Client rows `:194`, `:244–247` and source metadata | Add/update exact action consumer and private helper roles and connected composer/source screenshot role. Make one shared destination/insertion owner discoverable while preserving store ownership and the separate product-send boundary. Use actual concrete files after implementation, not planned names. |
| `007-Chat_System/005-Testing_And_Operations/PAGE.md`, renderer/Side Chat validation paragraphs and source metadata | Add actual isolated shared-material entry tests and native screenshot route checks with coverage of global Main/Side, composer ownership, delayed focus change, real closure/owner change, invalid targets, correlation and view isolation. Record tests as assertions or dated evidence with limits; do not imply this planning report ran them. Do not alter unrelated accepted startup/auth/provider requirements. |
| `007-Chat_System/000-Overview_and_References/PAGE.md`, core ownership/identity paragraphs; `001-Identity_And_Persistence/PAGE.md` Identity Map; `001-Thread_Identity/PAGE.md` Identity And Action Ownership | Their Main/Side peer, exact session, view/group/surface separation and no-global-reconstruction claims already constrain the change. Review for consistency; no identity redesign is needed. A brief shared insertion link/ownership sentence in Overview is useful only if it helps routing. Update metadata only for files actually governing a changed claim. |
| `007-Chat_System/000-Overview_and_References/002-Decisions/PAGE.md`, Send to chat Is Attachment Metadata; `004-Chat_UI/PAGE.md`, Input And Warm Intent / Composer Context Row | Keep file references as pills and text insertion as text; preserve intended warm-on-insertion behavior without treating warm as acceptance. A dated owner-request destination rule may be added during scoped implementation documentation, classified correctly. No broad cleanup of stale unrelated host decisions is requested by this report. |

Wiki `AGENTS.md` requires complete preimages in `.versions/`, concrete `metadata.source-files`, actual edit timestamps, preserved snapshots and source-backed current/future classification. A later Wiki writer must read the local Style Guide, Updating Wikis and Audit Workflow before writing. These instructions are identified here, not invoked as a new Wiki supervisory run.

The completed-build handoff retains its 34 focused screenshot tests, broader renderer/server results, three real native PNG captures and exact accepted tree. **Inference:** changing global selection, lifetime predicates and insertion ownership invalidates their use as proof of the new behavior. Preserve the historical receipts unchanged; renew affected route/correlation/composer/global/focus/native checks and independent review on later implementation bytes. Unchanged server save/protection/provenance evidence may be retained only with recorded dependency/byte coverage. Neither this report nor planning validation is runtime recertification. The owner-waived historical 45-minute soak remains unperformed and is not reinstated.

## Fingerprints, limits and return

Fingerprint time: 2026-10-07T09:34:54.705582+00:00. Relevant product and guidance paths were clean; the only dirty path in the scoped Wiki families was `007-Chat_System/005-Testing_And_Operations/004-Fusion_Restart/PAGE.md`, the separately pending restart-support package, outside this investigation's claims. Whole-checkout status also contained unrelated runtime/view/config/theme, Wiki audit state, Launchpad/controller records, Capture035 diagnostics, restart helpers and backups. All were preserved; no commit SHA alone is used to identify untracked planning authority.

The following table records actual SHA-256 bytes, not approval or runtime evidence. Paths are relative to the verified source root.

| Source | SHA-256 |
|---|---|
| `AGENTS.md` | `41dc4e9dc4d58e7505cb6fc37b500129502231293894b5f90eda9398315e001d` |
| `fusion-studio-server/AGENTS.md` | `00d56bfd0e50a512bd1d8e76110c6882ce7d9cbdac58782839ee6426c1d54fd2` |
| `ai/RC-MacAir-15/mission-control/AGENTS.md` | `d4dce1ca561b013641ca999d4183a73be739b408cfa5e518c750af783420de6d` |
| `ai/RC-MacAir-15/mission-control/session-contract.md` | `d82d5a815a94f8c27b64d1d90aa0085790e3d98408c011e86d6126dd1bd9b570` |
| `ai/RC-MacAir-15/mission-control/investigation-contract.md` | `908f7f438b1ea06636d43f10527b7500b97e19a517d68445e0d3bc41d4d60a26` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-planning-stage/SKILL.md` | `fbef99148a1b863543dd85ccdc6a3a115808232534a282c670a001b56e147de5` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-roadmap-creator/references/planning-contract.md` | `ce471fe594051c7c375c1f371c0ebe4af18b65639f740ad3d95c918a70b9e5ad` |
| `ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement/planning/shared-chat-material-insertion/PLANNING.md` | `d43a9a2844620ccbef7193c14d3196a8c8ba695f5d2910f0d969789c1d946337` |
| `ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement/planning/shared-chat-material-insertion/OWNER-REQUEST.md` | `71dd8441f4ee79f9c0688ec335de0a553d9dfd6f4a6b2b60a93d8f222a529c1d` |
| `ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement/AGENTS.md` | `886fe0f833d9eacc055166f5a6184f7d39c330ef772f860a8b438d0fb1e08825` |
| `ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement/HANDOFF-COMPLETED-BUILD-2026-10-07.md` | `a4b4895940f72e3352446770625023e7c925a1369fb5f611dd03b478d742ee89` |
| `ai/RC-MacAir-15/Wiki/AGENTS.md` | `9d353611f3b5ac94efa92048d1c0f8879d71786bcf1b641f915a0f695f5ef697` |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md` | `45fa9f630563d79935d5a461b308c823c0db3ded5c23817ba6d4c8a06c794ed5` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` | `de3995c68ae84f3b0fa389c6af0327e21dd08f30ac9ffbc7548b76f80ac393d7` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md` | `4c5fcbf62912c9e8ff6d3d0e1ec07016145e1f1c90c792a162dfcc3ca1b0bfba` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md` | `18a093c333a610ec8d2c77661b29744f1fae6e9ca8f4e113148fee10a0d9fc18` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md` | `2b4e55ed7580659b35a91d13f5a7b781960c659868027dd8b6ea6f79e609b105` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md` | `5b77528cec69d60c11c0487a349ec1cfb0b9a47eb69c213dedd1fbf1797dbad6` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md` | `25689bb9d2540fff061040ed14f5dc9789a4d9ceaa49662a4e0a1e448f5b0ee0` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md` | `5ece90e88dac136f7ec464b0219a3eb242b7837d118dbbdaba57de673b8a5919` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md` | `bd3e7be468289ac0a6ee6502cd8b9fc340f03fd7568deb59370ed00cc3b2a7a3` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md` | `e7319750bd27b7ccdad8e5e451b9779044e8fc7a713fc6d461113b409b39018d` |
| `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md` | `a89486b49f342c611331ec9874908d4a47aa0c4ace9dde968762b63936f23d14` |
| `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md` | `3558d01fb05ea0a0c926b2432bcf538d2c68dfb21306e915b55ad5b037c07861` |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` | `696afb2d3ec027256e783957c3461eb03300db0b97b34b3e62162977c22ed42f` |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/002-Decisions/PAGE.md` | `b0be25a9a244ce38b1427f6dd5b2f63dcac4806a5fe7b9eee47816cd848fb6ed` |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/001-Identity_And_Persistence/PAGE.md` | `afdbf7bb3403cdf176a6fad3867536bdb68c1587e1ba36a5997aba362781d977` |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/001-Identity_And_Persistence/001-Thread_Identity/PAGE.md` | `fc47978978f624aff5cb348df6a0b3dd3a490993fd8da008435b9583cd715c16` |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/PAGE.md` | `06b897d771c58ce2ce25612f2cfaaf71c1aef24f4028eb4ea0eaac8134837891` |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/001-Composer/PAGE.md` | `6c5c3847270c0bef52f0e858216f54d602472a9400cddcf2c97a39c5d15e437e` |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/PAGE.md` | `15799e9a2e44e64a6cc84c2c22eb5c269748296f7889d43295b665f15fe0a8d1` |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/007-Structure/PAGE.md` | `7e437183acb807a6c6579ebc834ed2f8df1e1f94b39a027d034c0e6db0ac9966` |
| `ai/RC-MacAir-15/Wiki/004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md` | `57b85d4acc3034dbc2a64fec9994effa98386419d41bcd6dcc526fbcd6a96d18` |
| `fusion-studio-client/src/lib/chat-action.ts` | `ee4b84aa06b763dc9e06ac6cc28860e1c7f0b78a62189092eefbbfcecb0b54a9` |
| `fusion-studio-client/src/lib/chat-action-controller.ts` | `7a23aa9ee58c4724bf7db42b4ad5fc521f66c3505610177b7971b6a72cc5ef89` |
| `fusion-studio-client/src/screenshots/chatScreenshotCapture.ts` | `18eb2caf9261a19d30ad35c5ac36a64c51ee22e08567e8cfb2ac48d84e9b12f1` |
| `fusion-studio-client/src/components/chat/ConnectedChatComposer.tsx` | `b3dcd745e057d9e8d350f6623d8a0b697f47b69778af1e29fc95946c0f758463` |
| `fusion-studio-client/src/components/chat/useChatSurfaceIdentity.ts` | `65c2484cff546f497c5b028f9d1a304af9d20e9872838c7b1190956b02bc09f1` |
| `fusion-studio-client/src/state/chatComposerDraftStore.ts` | `0e71377c3ec9fd2473aa895b27f566e80a582b7df82e473f38ae89ce48e280ac` |
| `fusion-studio-client/src/state/chatFileLinkStore.ts` | `c32cbb3e85afc696b0a47412d5d26ca41cad9d247dc3e351666e766a768e0374` |
| `fusion-studio-server/lib/screenshot/ws-handlers.js` | `8d11853e29ee8f0264090145aaf1d461384caeac6b58797a63cb687869756254` |

All recorded source hashes were rechecked unchanged at 2026-10-07T09:37:39.583954+00:00, with source HEAD still matching the assignment.

Limitations: no running app, Alpha, provider, browser, tests, build, catalog runtime or persistence readback was inspected/executed. Current articles include their own historical/source-only limits. Bounded code inspection establishes extension seams and the current focus restriction; it does not replace the author's complete entry-point inventory or prove the new global active-open-chat resolver already exists. No missing historical conversation was inferred because the exact direct owner request is preserved in the current planning packet. No broad Wiki audit, health design or governance migration is claimed.

Changed files: this report only. Stopping reason: the standards/governance decision and exact Wiki claim scope are sufficiently supported for candidate authoring. Next safe action: the stage manager assigns a fresh `mc-planning-validator` with `mode: worker-handoff`, `deliverable_kind: investigation`, original assignment, this report and raw hashed sources; after acceptance, incorporate the findings into the one ticket/SPEC. Stage and release review remain separate. Implementation stays held.
