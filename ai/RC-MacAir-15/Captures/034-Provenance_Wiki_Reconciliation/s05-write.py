"""Documentation authoring only; exclusive current preimages, no product execution."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, difflib, re
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
W=Path('ai/RC-MacAir-15/Wiki/010-Events_And_Ledger')
def sha(b): return hashlib.sha256(b).hexdigest()
pages=[]
def page(path,sources,body): pages.append((path,sources.split(),body))
page('003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md','''fusion-studio-server/lib/startup.js fusion-studio-server/lib/triggers/trigger-loader.js fusion-studio-server/lib/triggers/cron-scheduler.js fusion-studio-server/lib/triggers/script-runner.js fusion-studio-server/lib/watcher/actions.js fusion-studio-server/lib/runner/index.js fusion-studio-server/lib/runner/run-folder.js fusion-studio-server/lib/event-registry/seed-catalog.js''','''Status: source inspected on 2026-09-19 in the development checkout. Legacy triggers, cron jobs and agent-run records exist; a general governed automation run/match schema and executor are not implemented. Future contracts below are distinct from current runtime behavior. No product tests or runtime were run.

## Current operational automation

`startup.js` composes the workspace watcher and action handlers, reads the Agents registry, then calls `loadTriggers`. The loader scans registered agent folders, active view capsules and `ai/components` for `TRIGGERS.md`. File-change blocks become watcher filters; chat/ticket/agent/system blocks register legacy colon-topic bus listeners; cron blocks go to `createCronScheduler`. A missing/unreadable registry or load failure is caught by startup and does not establish that any trigger is active on this machine.

The scheduler checks supported daily or cron expressions every minute, uses an in-memory same-minute guard, optionally retries a failed condition and calls the ticket creator. This is not a durable exactly-once scheduler across restart. Ticket creation can apply the existing auto-hold behavior. Script-backed file filters call `runScript` before the ticket action and merge its result into template variables. The current runner invokes the function synchronously, returns `result || null`, and catches load/call errors. Its declared timeout constant is not enforced, and it does not await a returned Promise. These facts do not approve future captured-output semantics.

The separate agent runner creates timestamp-named run folders and a manifest, tracks active runs and emits legacy `agent:run_started`, `agent:run_completed`, `agent:run_failed` and `agent:run_stalled` events. Those operational IDs and file records are not a registered common automation fact or proof of a governed causal relationship. The [Universal Event Bus](../../001-Universal_Event_Bus/PAGE.md) explains the legacy/governed split; the current registry has save and tool-observation facts, with no generic automation producer.

## Settled direction

Automation history should make triggered scripts, scheduled jobs, imports/syncs, background agents and system work distinguishable from UI actions, assistant tool activity and unknown external changes. Every eventual canonical automation fact must contain durable `automation.runId` and `automation.kind`. This common-field requirement is settled; it does not settle each kind's ID generation, handoff, lifecycle or schema.

Future provenance observes automation without authorizing, duplicating, suppressing or failing its execution. Missing attribution remains unknown or unlinked. Provenance/redaction failure must omit unsafe output and derived hashes/previews while retaining a safe non-sensitive core and diagnostic when possible. This automation-specific direction does not remove the existing mediated save's required prewrite recovery protection or promise that all current admission work is nonwaiting.

Preserve durable history by default under the [System boundary](../../../002-Server_And_Runtime/PAGE.md#system-database-boundary). System owns configuration, grants and historical records; connected services keep authoritative live content. Plugins need defined interfaces and approved capabilities, cannot self-grant or create arbitrary System app tables, and are not admitted merely by placing a trigger file or manifest on disk. Existing raw trigger closures remain compatibility behavior; a future governed migration must register each executable definition as its own permission subject and invoke scoped named commands.

## Open contracts and their feature triggers

| Feature to build | Decision still required |
|---|---|
| Governed run/match publication | Per-kind run ID owner, timing, format and operational handoff; exact event/phase/lifecycle branches, subtype IDs, actor/context, sensitive fields, safe omission, bounds and restart/replay/deduplication/cancel semantics. No production generator or registry API follows from the common-field requirement alone. |
| Direct file-trigger causality | How one operational watcher match links to independently admitted evidence without waiting, duplicate execution or invented cause; handoff lifetime, ordering, fanout, rename and missing/late/rejected evidence. |
| Captured script output | Raw return versus normalized return/stdout/stderr, falsy values, Promise handling, lifecycle outcomes and timeout enforcement; shared output contract, serialization, redaction, hashes/bytes, truncation and external storage. Current tool fingerprints do not settle this output policy. |
| Arbitrary plugin execution/emission | Registration and consent grammar, capability grants, revocation, host-owned publisher boundary and bounded isolation. Existing trusted built-ins do not confer plugin execution or raw bus access. |

The older common envelope, accepted-reference machinery, exact executor capacities and result/subtype fields are proposals outside the accepted save and tool-observation scopes. Resolve only the choices needed by the feature being specified. [Resource Mutation](../003-Resource_Mutation_Provenance_Schema/PAGE.md), [Ledger Event](../004-Ledger_Event_Provenance_Schema/PAGE.md) and [File Version](../005-File_Version_Provenance_Schema/PAGE.md) describe the narrower implemented owners.
''')
page('003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md','''fusion-studio-client/src/lib/save-action-context.ts fusion-studio-client/src/components/view-tabs/fileConnectedTabs.ts fusion-studio-client/src/state/fileDataStore.ts fusion-studio-server/lib/ws/file-save-route.js fusion-studio-server/lib/file-mutations/reported-ui-context.js fusion-studio-server/lib/file-mutations/file-operation-repository.js fusion-studio-server/lib/file-mutations/fact-reservation-bindings.js fusion-studio-server/lib/ledger/resource-provenance-repository.js fusion-studio-client/src/lib/ws/resource-provenance-protocol.ts''','''Status: source inspected on 2026-09-19 in the development checkout. Optional `reportedUiContext` on mediated saves is implemented. A general `ui.action` event, `uiActionId` envelope and per-view prompt-attachment provenance adapters are not implemented. Tests were inspected, not rerun; no app or Alpha behavior is certified.

## Current save-context contract

`fileDataStore.saveFile` calls `readSaveActionContext(panel)` for the versioned save request. The argument is the initiating document's panel, not an inferred currently focused panel. The synchronous reader requires a current workspace ID and a matching registered panel configuration. It reports workspace/view identity and reads tab/component details only from a live connected File owner matching that workspace and view. Missing owner, non-component tab, missing values or read failure omits fields or the whole context; it never invents identities or writes view state.

| Field | Current handling |
|---|---|
| `workspaceId` | Renderer echo; server derives authority from the captured session workspace/epoch. A supplied mismatching or invalid echo omits context. |
| `viewId` | Required for retained context; renderer checks panel registration. Server checks scalar shape, not actual current panel/tab existence. |
| `tabId`, `componentTypeId`, `componentInstanceId`, `presenterId` | Optional connected-owner values, each limited to 128 UTF-8 bytes. |
| `viewInstanceId` | Supported optional carrier field, not populated by the current reader. |
| `targetKey` | Optional opaque component target, up to 512 UTF-8 bytes; not path authority or a resource ID. |

Workspace/view and other identifier strings use the same 128-byte scalar bound. The server's `sanitizeReportedUiContext` drops unknown or malformed fields, requires usable view identity and substitutes the server workspace. It emits fixed noncanonical omission/degradation diagnostics. Sanitization precedes schema validation so optional context cannot reject an otherwise valid save. Syntactically valid tab/component values can still be stale or fabricated; the server does not verify the existence of the current tab. The save's workspace/epoch, content and path authorization remain independently enforced.

## Persistence and query chain

The save route passes sanitized context to the save owner. `file-operation-repository.js` stores its dedicated reported-context columns; `fact-reservation-bindings.js` reconstructs context from that durable operation into `file.command_accepted@1` and `resource.mutated@1`. The resource ledger projection stores the admitted mutation payload and query columns. Resource provenance queries return it under `origin.reportedUiContext`; the client response validator checks the bounded shape and current workspace pair.

This is a historical snapshot. Later tab closure or configuration changes do not rewrite the record, and provenance writes nothing back into the view's live `state.json`. `queryResourceProvenance` and response plumbing exist, but the bounded production client search finds no caller mounting a history/audit display. A query transport does not establish a user-facing UI.

Origin remains a reported local-client fact with `transport_only` assurance, not authenticated human identity or a direct causal proof. A tab, component, connection or target key is not a grant. Required save preimages and optional context have different failure rules; see [Resource Mutation Provenance](../003-Resource_Mutation_Provenance_Schema/PAGE.md) and [Ledger Event Provenance](../004-Ledger_Event_Provenance_Schema/PAGE.md).

## Approved granularity and remaining design

T1 domain mutations are durable/searchable; T2 UI action context belongs with the mutation as evidence. T3 ambient interaction such as focus, opening a tab, navigation or reordering is not durably recorded as provenance. Potential reaction-only telemetry is a separate future bus decision; scroll/geometry is excluded. These are coverage goals, not a claim that every current command emits history.

Keep workspace, immutable view, visible thread group, chat session, transient surface and tab/component identities separate. Tab/component identity belongs in context, never actor identity. The adopted actor taxonomy recognizes human, assistant, trigger, scheduler, script, sync, import, agent, system, external and unknown; it does not turn reported context into authenticated authorship. [Chat Metadata Provenance](../001-Chat_Metadata_Provenance_Schema/PAGE.md) describes the current Chat boundary.

The [UI Action Provenance Module](../../011-UI_Action_Provenance_Module/PAGE.md) retains the first Wiki/File direction and its unresolved implementation boundary. Before broader UI-action publication, decide the actual command coverage, identity/relationship schema, server admission, sensitive-field policy, executor capacities and lifecycle, and the live context selectors for each view. Older token, accepted-reference and safe-core examples are design input, not current wire contracts. They neither block accepted save context nor authorize a new producer.
''')
page('003-Provenance_Model/008-Audit_Query_And_Review_Provenance_Schema/PAGE.md','''fusion-studio-server/lib/ws/resource-provenance-route.js fusion-studio-server/lib/ws/agent-activity-route.js fusion-studio-server/lib/ledger/resource-provenance-repository.js fusion-studio-server/lib/agent-provenance/query-repository.js fusion-studio-server/lib/event-registry/seed-catalog.js fusion-studio-client/src/lib/ws/resource-provenance-protocol.ts fusion-studio-client/src/lib/ws-client.ts''','''Status: source inspected on 2026-09-19 in the development checkout. Bounded save-provenance and agent-activity query transports exist. Saved audit/query/review facts, recommendation schemas and a mounted provenance audit UI are not implemented in the inspected paths. No product tests or runtime were run.

## Current query boundary

`resource:provenance:query` passes through the existing WebSocket router to `resource-provenance-route.js`: it validates the active server workspace/epoch and registered schema, normalizes the requested panel/path, and asks `resource-provenance-repository.js` for mutation summaries. Results include operation/resource/version identity, snapshot metadata and optional reported UI context, without snapshot bytes. Default limit is 50, capped at 200.

`agent:activity:query` uses its own registered route and `query-repository.js` for bounded activity/observation summaries, exact selectors and cursor pagination. Its default is 50, capped at 100. It does not return raw tool arguments/results or checkpoint bytes. An available detail reference points to existing Chat exchange storage; it is not a new captured-output artifact. Both routes report invalid, stale, unavailable or failed requests rather than changing historical operations. Current schemas do not create an audit run merely because a query was issued.

The client has `queryResourceProvenance`, strict result/error validation, pending-request handling and workspace retirement. The source search finds no production invocation of that helper and no agent-activity client consumer. Existing File Viewer resource invalidation is a rendering path, not audit/history presentation. See [Assistant Query And Review Loops](../../009-Assistant_Query_And_Review_Loops/PAGE.md) for the complete query and consumer limitations.

## Product direction

A useful audit should explain what changed, where the evidence came from, what is missing and which conclusions are uncertain. A future review may combine saved actions, tool observations, history and snapshots, then retain an understandable evidence set and recommendation. Temporal association is not causation; first observations are not preimages. Review confidence describes the conclusion, distinct from confidence in an event's attribution.

Audits are downstream observations. Missing evidence, query failure or recommendation persistence failure must not change the source operation being reviewed. Recommendations do not grant permission to execute changes, create arbitrary System app tables or give an assistant/plugin raw database or bus access. Durable audit history belongs to [System](../../../002-Server_And_Runtime/PAGE.md#system-database-boundary); live application content remains at its authoritative source.

## Open before a saved-audit or review-loop feature

The owner must settle the query types and typed/redacted filters; exact event/lifecycle and incomplete/unavailable/cancel states; evidence/result identities and relationship validation; confidence meaning; recommendation and ticket ownership; disclosure/redaction; deterministic filter/result/text/graph/byte bounds and overflow; pagination and follow-up discoverability. A broader graph query also needs a separately approved causal/edge contract. Old accepted-reference APIs and candidate result arrays are proposals, not prerequisites retroactively imposed on today's bounded queries.

A query UI must specify its real callers, response consumers and presentation of missing evidence. An autonomous review loop must additionally specify its trigger, allowed actions and approval boundary. Retention, deletion, restore and export require their own user-controlled lifecycle decisions; preserve history by default meanwhile. [File Version Provenance](../005-File_Version_Provenance_Schema/PAGE.md), [Chat Metadata](../001-Chat_Metadata_Provenance_Schema/PAGE.md) and [Ledger Event Provenance](../004-Ledger_Event_Provenance_Schema/PAGE.md) describe available evidence without implying those future schemas exist.
''')
page('008-Change_Storm_Control/PAGE.md','''fusion-studio-server/lib/watch/workspace-watcher.js fusion-studio-server/lib/watch/core.js fusion-studio-server/lib/event-bus.js fusion-studio-server/lib/event-registry/seed-catalog.js fusion-studio-server/lib/agent-provenance/checkpoint-repository.js''','''Status: source inspected on 2026-09-19 in the development checkout. Watcher filtering, rename heuristics, legacy bus guards and bounded tool checkpoints exist. A governed storm detector, durable storm-batch schema and compaction policy are not implemented in the inspected owners. No runtime or load test was run.

## Current mechanisms and limits

The workspace watcher excludes selected generated/runtime paths, sends matching changes to its filters and emits legacy `file:changed`. It treats a delete/create in the same directory within two seconds as a rename candidate. This is a heuristic, not proof of a filesystem rename or common cause. The watch core and legacy bus have their own delivery/coalescing/chain controls; those do not create a durable change-storm summary or guarantee bounded historical growth.

Current mediated saves preserve eligible exact preimages. Tool observation stores sparse eligible checkpoints and reuses unchanged state. These narrower mechanisms have their own admission, retry and failure rules, documented in [File Versioning](../006-File_Versioning/PAGE.md). Neither registers a general storm batch or authorizes dropping existing history. The registry's four built-in fact types contain no storm event.

## Direction and proposals

The product goal is to retain evidence that a high-frequency burst occurred without flooding history or future assistant context. Summaries should make their time span, affected resources, counts, missing detail and representative state understandable. Mixed actors or causes must remain mixed/unknown instead of becoming a false single attribution. Compaction belongs with history consumers; it must not suppress or roll back the source work.

A batch event, summary schema, sampling strategy and representative first/last versions are design proposals. Earlier version-event names and accepted-reference examples are not current APIs or approved capacity defaults. The accepted save preimage and tool checkpoint/hash policies remain valid in their exact scopes; a blanket ban on all hashes would be incorrect, as would extending them to arbitrary storm output.

## Decisions before storm detection or compaction

A future feature must settle grouping keys, thresholds/windows and configuration ownership; global detector/key/timer/buffer limits; persisted path/identity/summary/serialized-byte limits; deterministic admission, ordering, deduplication, coalescing, expiry and overflow; first/last selection and discoverability of omitted detail; crash/restart behavior; redaction and eligible representative content. Sustained unique-key traffic must be accounted for as well as bursts on one file. No numerical capacity is approved by this page.

Deleting or compacting snapshots additionally requires the explicit user-controlled retention policy and recovery guarantees. Preservation by default is already settled; exact tiers, durations and user controls are not. Historical copies support audit/recovery, while restore is a separately permitted write to the authoritative source. The [Ledger Schema](../004-Ledger_Schema/PAGE.md) and [System boundary](../../002-Server_And_Runtime/PAGE.md#system-database-boundary) own those distinctions. Do not reopen that storage boundary merely to design a storm feature.
''')
page('011-UI_Action_Provenance_Module/PAGE.md','''fusion-studio-client/src/lib/save-action-context.ts fusion-studio-client/src/state/fileDataStore.ts fusion-studio-client/src/components/view-tabs/fileConnectedTabs.ts fusion-studio-client/src/components/SendToChatButton.tsx fusion-studio-client/src/lib/chat-action.ts fusion-studio-client/src/components/chat/useLegacyChatHost.ts fusion-studio-client/src/state/slices/chatSlice.ts fusion-studio-client/src/lib/resource-path.ts fusion-studio-server/lib/ws/file-save-route.js fusion-studio-server/lib/file-mutations/reported-ui-context.js fusion-studio-server/lib/event-registry/seed-catalog.js fusion-studio-server/lib/subscriptions/admission.js''','''Status: source inspected on 2026-09-19 in the development checkout. The general UI Action Provenance Module described by this page is future work. The implemented counterpart is the optional mediated-save context reader and carrier; it is not a universal command wrapper, a `ui.action` publisher or a prompt-attachment adapter. Tests were inspected, not rerun; no runtime claim is made.

## Current owners

`readSaveActionContext` reads current workspace, registered initiating panel and matching connected File tab/component identity. `fileDataStore.saveFile` attaches it to the versioned `file_save` request. The server route sanitizes it independently of save validation, and the save/ledger owners retain it as a historical snapshot. It does not infer authenticated human causation, change current tab state or gate valid work on optional context. [UI Action And Context Provenance](../003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md) defines the exact fields and query boundary.

Production Office and Email document save paths call the shared store; current File Viewer consumers read content and stage attachments rather than exposing a mediated text-save editor. A generic reader accepting a registered panel does not mean every view supplies tab context. The reader's connected-owner source is specifically the File owner, and it omits unavailable or mismatching detail.

`SendToChatButton` resolves a resource attachment and dispatches the existing browser chat action. `useLegacyChatHost` stages that attachment for the workspace/session and, on actual send, snapshots pending attachments into `sendMessage`; `chatSlice` sends the ordinary `prompt`. These are operational Chat paths. Source and registry searches find no general UI-action envelope or publisher in that path. Attachment staging, navigation and actual prompt sending must not be advertised as emitting `ui.action` today.

## Approved direction and first pair

T1 domain actions should be searchable; T2 context records where an action occurred; T3 ambient interaction is not durable provenance. View/tab/component context remains separate from actor, resource authority and Chat session identity. Historical context belongs in System while the live view state stays with its view. Context omission must not fabricate a more precise identity.

Wiki and File Viewer were selected as the first pair for a future shared UI-action design. Its proposed initial command is sending a prompt with resources, described as `chat.send_with_resource`. The intended distinction is useful: active context is captured at actual send, while each attachment is a subject that may have been staged earlier or in another panel. Attachment origin must not silently replace active context. That selection and principle do not mean the adapters, command name or schema are installed.

A future shared boundary should make buttons, menus, shortcuts and other gestures for the same command use one context policy. It must inventory actual callers before claiming coverage. All-button, all-panel, autosave, drag/drop, command-palette and file-operation coverage are not current facts. Move/create/delete, prompt attachment and preview generation need their own owning command and policy; the current save carrier does not migrate them by implication.

## Design choices before implementation

The detailed universal envelope, workspace-token allocator, canonical UI IDs, accepted-reference slots, redaction safe-core and executor capacities from earlier designs are unimplemented proposals. Before building a broader UI-action feature, settle its exact coverage, context selectors and missing-state behavior; command-to-fact identity/relationships; server workspace/path validation; sensitive metadata policy and failure handling; bounded scheduling/cancellation/restart; and actual tests through the source command and query consumer. Do not infer a wire API or capacity from an illustrative design.

Keep commands in their existing domain owners and facts in governed admission. The current host seals four publishers for save and tool observation; three of those fact types have seeded subscribers, while command acceptance has no seeded ledger subscriber. Raw legacy bus emission, a renderer field or a plugin manifest cannot grant a new publisher. Plugin registration/emission and permission grammar remain future feature choices. The [System boundary](../../002-Server_And_Runtime/PAGE.md#system-database-boundary) already settles that plugins use defined interfaces and approved capabilities, cannot self-grant and cannot make System a live application database.

Broader optional UI metadata should not fail a valid source command. This does not supersede required mediated-save preimage storage or claim that current admission never awaits validation/subscribers. [Resource Mutation Provenance](../003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md) separates prewrite protection from postwrite recovery. [Events And Ledger Decisions](../000-Events_And_Ledger/002-Decisions/PAGE.md) records the settled targets and remaining product decisions.

## Children

- [Wiki Viewer UI Context](001-Wiki_Viewer_UI_Context/PAGE.md) — current navigation/attachment owners and future adapter boundary.
- [File Viewer UI Context](002-File_Viewer_UI_Context/PAGE.md) — current connected-owner save context and future prompt adapter boundary.
- [Provenance Model](../003-Provenance_Model/PAGE.md) — shared evidence and identity distinctions.
''')
page('011-UI_Action_Provenance_Module/001-Wiki_Viewer_UI_Context/PAGE.md','''fusion-studio-client/src/state/wikiStore.ts fusion-studio-client/src/components/wiki/PageViewer.tsx fusion-studio-client/src/components/wiki/TopicList.tsx fusion-studio-client/src/components/SendToChatButton.tsx fusion-studio-client/src/lib/resource-path.ts fusion-studio-client/src/components/chat/useLegacyChatHost.ts fusion-studio-client/src/lib/save-action-context.ts''','''Status: source inspected on 2026-09-19 in the development checkout. Wiki navigation and resource attachment staging exist; a Wiki `ui.action` context adapter does not. This page preserves the chosen first-pair direction without claiming the proposed prompt schema is implemented. No runtime or product test was run.

## Current Wiki path

`wikiStore` owns selected/viewed paths, including `viewedPagePath`. The page and topic surfaces pass a panel-relative target to their file actions or `SendToChatButton`. `createResourceChatAttachment` resolves that target using the server-hydrated panel content root; the button dispatches a Chat action with insertion delivery. The current Chat host stages the attachment and later sends pending resources through the ordinary prompt path. No general UI-action fact is created by this sequence.

Navigation/selection and attachment staging are not themselves durable mutation provenance. The inspected Wiki reader surfaces do not expose direct file create/save/move/rename/delete commands. The generic mediated-save reader can carry workspace/view identity for a registered initiating panel, but its tab/component detail comes only from a matching connected File owner. It does not read `wikiStore.viewedPagePath` or supply a Wiki-specific save/prompt adapter.

## First-pair design direction

Wiki and File Viewer remain the selected first pair for future prompt-with-resource provenance. Capture active context at actual send separately from attachment subjects: a user may stage a topic and navigate to another page, or stage a resource in a different panel. Neither subject origin nor a staged path is proof of the current active page.

| Candidate input | Design boundary, not current adapter output |
|---|---|
| Active Wiki view/panel | Read the actual owning registered view at send; do not substitute another surface's identity. |
| Viewed page | `viewedPagePath` is the existing selector to evaluate; resolve any reported path beneath the server's authoritative workspace/content root. |
| Tab, route, selected resource identity | Do not invent values from navigation history, React keys, path strings or attachment IDs. Missing fields stay absent/unknown under the future schema. |
| Attachment subjects | Keep separately validated operational attachments and their order unchanged when optional provenance omits unavailable detail. |

Before implementation, confirm selectors against the then-current view/tab architecture and approve exact schema, admission, sensitive-path handling, limits and failure semantics. The earlier literal view IDs, route-null table and token-bound resource mappings are design proposals, not a production ABI. Optional provenance cannot become a second prompt validator or retry a send whose transport outcome is unknown.

The [UI Action Provenance Module](../PAGE.md) owns shared direction; [UI Action And Context Provenance](../../003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md) owns the implemented save carrier. Prompt acceptance, session/group/surface identity and attachment lifecycle remain with [Chat System](../../../007-Chat_System/000-Overview_and_References/PAGE.md). A future adapter must verify staging, send-time capture, cross-panel subjects and honest missing context through those real owners before claiming coverage.
''')
page('011-UI_Action_Provenance_Module/002-File_Viewer_UI_Context/PAGE.md','''fusion-studio-client/src/components/view-tabs/fileConnectedTabs.ts fusion-studio-client/src/lib/save-action-context.ts fusion-studio-client/src/state/fileDataStore.ts fusion-studio-client/src/components/file-explorer/FileViewer.tsx fusion-studio-client/src/components/file-explorer/FileDocumentPresenter.tsx fusion-studio-client/src/components/SendToChatButton.tsx fusion-studio-client/src/lib/resource-path.ts fusion-studio-client/src/components/chat/useLegacyChatHost.ts''','''Status: source inspected on 2026-09-19 in the development checkout. The connected File owner supplies optional tab/component context to mediated saves; File reading and Chat attachment staging exist. A File prompt-with-resource `ui.action` adapter is not implemented. Tests were inspected, not rerun; no live UI or Alpha claim is made.

## Current context source

`readActiveFileConnectedTabContext` reads the mounted connected File runtime's current collection and active component descriptor. `readSaveActionContext(panel)` uses it only when its workspace and view match the save's initiating registered panel. It copies bounded `tabId`, `componentTypeId`, `componentInstanceId`, `presenterId` and optional `targetKey`; no matching component yields only available workspace/view context. The accessor's active tab is not a canonical resource identity, and `targetKey` does not authorize a filesystem path.

The reader does not reconstruct tab identity from global legacy file-store tabs, navigation history, an attachment ID or a React key. The server sanitizer checks bounded shape and workspace echo, not actual current tab existence. The saved record is a historical snapshot with no live view-state writeback. [UI Action And Context Provenance](../../003-Provenance_Model/007-UI_Action_And_Context_Provenance_Schema/PAGE.md) gives the full reader → store → save route → durable operation/fact → query chain.

The policy-ready `FileDocumentPresenter` and fallback `FileViewer` consume the central File content store. They are readers/attachment surfaces, not current mediated text-save editors. Production Office/Email saves use the store; their initiating panel does not automatically match the connected File owner. Thus the carrier's support for File tab context is not evidence of a File save gesture or all-view context coverage.

## Current attachments and future pair

`SendToChatButton` resolves panel-relative attachment paths through `resource-path` and stages them through the Chat action bridge. At send time the current Chat host reads workspace/session-owned pending attachments and uses the ordinary prompt route. Tree navigation, tab changes, staging and prompt send do not currently emit a general `ui.action` fact.

File and Wiki Viewer are the selected first pair for future prompt-with-resource provenance. The proposed `chat.send_with_resource` intent would distinguish the active File context at send from each attached subject, which can come from another panel or an earlier selection. A configured File content root may be a subdirectory; a future adapter must respect authoritative root resolution rather than assume a panel-relative path is already workspace-relative.

Before building that adapter, approve current-owner selectors, context/subject schema and absence behavior, server admission/path validation, sensitive-field policy, bounds and scheduling/failure semantics. The earlier activity-tab mapping and private-token envelope are proposals; they must be checked against the connected-owner architecture before implementation. Do not promote a tab/path/attachment ID to a resource ID or causal link. Optional context capture must preserve the independently accepted prompt/attachment operation, including its order.

The [UI Action Provenance Module](../PAGE.md) owns shared design. Future acceptance must exercise staging separately from actual send, matching and unavailable connected owners, cross-panel subjects, stale workspace context, persistence/query and a real display consumer. Existing save-context tests do not certify that future prompt adapter or an audit UI.
''')
manifest={'at':datetime.now(timezone.utc).isoformat(),'pages':[]}; diffs=[]
for rel,sources,body in pages:
 p=W/rel; old=p.read_bytes(); before=sha(old)
 front=re.match(r'---\n([\s\S]*?)\n---\n',old.decode()).group(1)
 name=re.search(r'^name: (.*)$',front,re.M).group(1)
 desc=re.search(r'^description: (.*)$',front,re.M).group(1)
 # Only known legacy metadata is present; preserve stable name/description and all navigation blocks.
 assert not re.search(r'^  (?!incoming-edges:|outgoing-edges:|source-files:|connected-skills:|related-trigger-files:|last-modified:|  -)[A-Za-z]',front,re.M)
 stamp=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
 text='---\nname: '+name+'\ndescription: '+desc+'\nmetadata:\n  source-files:\n'+''.join('    - '+s+'\n' for s in sources)+'  last-modified: "'+stamp+'"\n---\n\n'+body
 blocks=re.findall(r'<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->',old.decode())
 if blocks: text+='\n'+'\n\n'.join(blocks)+'\n'
 folder=p.parent/'.versions'; folder.mkdir(exist_ok=True)
 snap=folder/(datetime.now().strftime('%Y-%m-%d-%H%M%S')+'.md')
 with snap.open('xb') as out: out.write(old)
 assert sha(p.read_bytes())==before, 'concurrent edit; preserve and reread'
 p.write_text(text)
 manifest['pages'].append({'path':str(p),'snapshot':str(snap),'before_sha256':before,'snapshot_sha256':sha(snap.read_bytes()),'after_sha256':sha(p.read_bytes()),'at':stamp})
 diffs.extend(difflib.unified_diff(old.decode().splitlines(True),text.splitlines(True),fromfile=str(snap),tofile=str(p)))
(C/'S05-CHANGE-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
(C/'S05-PAGES.diff').write_text(''.join(diffs))
print('Wrote',len(pages),'pages with exact exclusive preimages')
