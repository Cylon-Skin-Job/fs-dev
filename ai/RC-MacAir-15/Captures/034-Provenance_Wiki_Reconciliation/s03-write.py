from pathlib import Path
import re,json,hashlib,datetime,difflib
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
W=Path('ai/RC-MacAir-15/Wiki/010-Events_And_Ledger')
pages={}
def add(rel,sources,description,body): pages[W/rel/'PAGE.md']=(sources,description,body.strip()+'\n')
S='fusion-studio-server/'
F='fusion-studio-client/'
status='Status: source inspected on 2026-09-19 in the development checkout. Current behavior below is the bounded implementation, not a fresh runtime result. Existing test assertions were inspected, not rerun; installed Alpha was not checked.'
add('005-Resource_Events_And_Render_Sync',[
 F+'src/components/office/OfficeDocumentPage.tsx',F+'src/components/email/EmailDocumentPage.tsx',F+'src/components/documentSaveAcknowledgement.ts',F+'src/state/fileDataStore.ts',F+'src/lib/ws/file-handlers.ts',F+'src/lib/ws/resource-projection-protocol.ts',F+'src/components/ContentArea.tsx',F+'src/components/view-tabs/ViewTabBar.tsx',F+'src/components/view-tabs/viewTabAdapters.ts',F+'src/components/view-tabs/fileConnectedAdapter.ts',F+'src/components/file-explorer/FileDocumentPresenter.tsx',F+'src/components/file-explorer/FileViewer.tsx',S+'lib/ws/client-message-router.js',S+'lib/ws/file-save-route.js',S+'lib/file-mutations/save-controller.js',S+'lib/file-mutations/fact-replay.js',S+'lib/subscriptions/handlers/resource-render-projection.js',S+'lib/ws/resource-projection-publisher.js',S+'lib/ws/workspace-session.js'],
'Trace mediated text saves through governed projections to the two mounted File Viewer consumers; distinguish reconnect and dirty-buffer limits.',f'''
{status}

Use this page before changing save routing or File Viewer freshness. The implemented path uses the existing WebSocket, governed subscriptions and central Zustand state. It does not establish universal freshness for every view or filesystem writer.

## Current save-to-render path

1. Production `OfficeDocumentPage.handleSave` and `EmailDocumentPage.handleSave` serialize their document, capture its dirty revision and await `fileDataStore.saveFile`; milestone actions also use `documentSaveAcknowledgement`. These are save callers. The current File Viewer presenters display content and have no save editor control. A fixture submitting a save from another socket or directly through the store is not a production File Viewer edit gesture.
2. With the advertised save protocol, `saveFile` creates `file_save@1` with a request ID and current workspace ID/epoch, snapshots optional reported UI context, and sends through the existing socket. The server message router delegates to `file-save-route.handleFileSave`, which checks the active server session pair and locked request schema. The pair is a stale-intent precondition, never client authority to choose a root.
3. `save-controller.save` resolves workspace/panel/path authority, validates exact UTF-8 text, serializes the physical target, reserves the operation and prepares its durable preimage before invoking the atomic writer. A missing target is create; an existing eligible regular file is modify. See [File Versioning](../006-File_Versioning/PAGE.md) for eligibility and failure boundaries.
4. The save owner attempts `file.command_accepted@1` after reservation and `resource.mutated@1` only after successful replacement. Durable reservation verification and schema validation admit frozen facts. Command-fact publication failure may remain pending without stopping a protected save; this does not waive required operation/preimage storage.
5. The seeded `system.provenance-ledger` subscription projects the resource fact into System history. The separate best-effort `system.resource-render-projection` handler derives `resource:changed@1` with canonical workspace-relative path and File Viewer scope. Admission, ledger storage, handler invocation and visible delivery are separate outcomes.
6. `resource-projection-publisher` selects matching open workspace sessions, injects each recipient's epoch, validates the registered projection and rechecks its pair before the workspace-bound send. During binding, the existing bounded queue orders bind frames before replies/projections; failure or overflow closes for reconnect. A send or zero-recipient result is not a client acknowledgment.
7. `ws-client` dispatches to `file-handlers`; strict v1/v2/recovery guards reject malformed projections by closing the connection. `fileDataStore.handleResourceChanged` rejects stale pairs and deduplicates exact identities; conflicting identity closes through the handler. `applyTargetedProjection` drops the addressed File content and parent tree caches/errors/pending reads, then requests that parent tree and, if previously cached, pending or of interest, that content.
8. Under a ready File tab policy, `ContentArea` mounts `ViewTabBar`, whose connected File adapter supplies `FileDocumentPresenter`. The fallback `FileExplorer` mounts `FileViewer`. Both select `file-viewer:<path>` from `fileDataStore` and render through `FileContentRenderer`; the addressed presenter requests content on path/generation changes. Updated store state reaches React without a private per-view socket listener or DOM patch.

## Current failures and recovery

| Point | Result and freshness behavior |
|---|---|
| Invalid/stale request, unsupported target/text or reservation failure | No replacement; request rejected. No successful mutation fact or save-driven refresh is invented. |
| Required preimage/prepare failure | Accepted operation fails before replacement; original bytes remain, resource fact is not emitted. The save promise rejects. |
| Rename occurred but replacement identity or directory durability is uncertain | `outcome_unknown`, `retrySafe: false`; no successful resource fact. Targeted recovery may refetch observed state without deciding that the save succeeded. |
| Resource fact publication fails after a completed write | Save stays successful with provenance pending; controller attempts `resource:refresh_required` with `fact_publish_failed`. Pending durable work is eligible for startup reconciliation; the mutation is not replayed. |
| Render handler absent or publication fails | Controller can request `projection_unavailable`; the invoked handler attempts `projection_failed` recovery on its own publication failure. The best-effort render outcome is not part of the save response's provenance-complete calculation. |

Recovery uses the same addressed store invalidation path. It is an instruction to refetch, not an admitted mutation or a durable receipt that the client saw the change. If both projection and recovery delivery fail, reconnect is the remaining freshness route. Postwrite ledger conflict/pending state and optional Git-checkpoint failure do not undo the filesystem write. A successful save response can coexist with stale UI or a warning.

## Reconnect and dirty-state limits

`workspace-handlers` installs workspace ID and epoch together and calls `beginWorkspaceGeneration`. File reads match request ID, local generation and both workspace fields, so delayed A→B→A replies cannot become current merely because the workspace ID matches. Disconnect retires in-flight correlations and rejects pending saves. Same-workspace reconnect invalidates/refetches known File trees and clean content while preserving dirty cached content and its metadata/navigation; a different-workspace generation resets the File data cache and dirty flags.

Targeted `resource:changed` and `resource:refresh_required` handling has no dirty-content guard: `applyTargetedProjection` deletes/refetches the addressed File cache even when that key is dirty. Do not generalize reconnect protection into remote-conflict staging, merge, undo preservation or a `recoveryRemote` buffer. Save acknowledgments clear a dirty flag only when its captured dirty revision still matches; navigation helpers drain newer document edits before leaving. These are distinct protections.

`resource:changed@2` carries an agent state observation, including unchanged observations; it drives File invalidation, not tool-authorship inference. Both versions target only `file-viewer`, so Office/Email caches and local editor buffers are not directly replaced by this projection. A cross-panel save can therefore refresh a File Viewer alias without guaranteeing that every editor showing those bytes refreshes.

## Compatibility and future direction

Separate create-document/folder, rename, move, delete, Office sidecars and arbitrary external writes are not mediated-save coverage. Legacy `file_changed` and watcher `file:changed` paths remain for compatibility; the successful mediated-save broadcast was replaced by the governed projection. Watcher timing does not establish canonical mutation identity or causal authorship.

The approved direction is centralized, narrow invalidation from governed facts with truthful recovery and state-owned rendering. General Wiki/style/config/registry freshness, lifecycle projection unions, watcher-generation executors and remote dirty-conflict staging described in older designs are proposals beyond this implementation. Wider operation and view coverage needs an owning contract; it is not activated by this page.
''')
add('006-File_Versioning',[
 S+'lib/file-mutations/save-controller.js',S+'lib/file-mutations/path-authority.js',S+'lib/file-mutations/text-codec.js',S+'lib/file-mutations/atomic-writer.js',S+'lib/file-mutations/file-operation-repository.js',S+'lib/file-mutations/file-version-repository.js',S+'lib/file-mutations/reconciliation.js',S+'lib/file-mutations/checkpoint-adapter.js',S+'lib/agent-provenance/checkpoint-repository.js',S+'lib/agent-provenance/resource-observer.js',S+'lib/versioning.js'],
'Distinguish required mediated-save preimages, post-tool observation checkpoints and Git checkpoints from future general versioning and restore.',f'''
{status}

## Current mechanisms

| Mechanism | What is retained | What it does not establish |
|---|---|---|
| Mediated UTF-8 save | `file_operations` durable command/mutation state and `file_versions` exact before bytes or explicit absent preimage | General before/after versions for every filesystem operation, a canonical version event or restore UI |
| Agent observation | Sparse path-linked `agent_resource_snapshots` and deduplicated exact UTF-8 `agent_snapshot_blobs` after eligible observation | A pre-tool snapshot, proof that the tool changed those bytes, or a diff |
| Existing Git checkpoint adapter | Reason-based `versioning.commitIfChanged` after successful save for session end, checkpoint or milestone | The required preimage guarantee or general System snapshot restoration |

These stores have separate identities and owners. The save response's `checkpointState` describes the optional Git step, not an agent checkpoint or the required preimage. Its failure is a warning after the write. Snapshots are System audit/recovery copies under the [System boundary](../../002-Server_And_Runtime/PAGE.md#system-database-boundary); they do not replace the live file or connected app as authority.

## Required save preimage and replacement

The supported command is one validated Unicode-scalar, NUL-free JSON string encoded exactly as UTF-8, at most 10 MiB. Existing bytes must also be at most 10 MiB, fatal-decode and round-trip exactly as NUL-free UTF-8. Empty text and a UTF-8 BOM are supported. Unsupported encodings/binary content, oversized preimages, directories and final symlinks are rejected before replacement. Parents must exist and resolve within both the authoritative workspace and panel roots; an in-root parent alias can normalize to the physical path. Protected-path checks further constrain the target and generated Git/temp paths.

`path-authority.resolve` derives the physical workspace-relative path and fingerprint. The shared path serialization and a second resolution precede `file-operation-repository.reserve`; the operation binds host-generated operation, command, event, resource and file-version IDs plus request origin/intent/content hash. The same connection/request with identical binding replays its stored terminal result without repeating replacement or checkpoint side effects. This is not a blanket guarantee for newly generated requests or reconnect retries.

The controller reads an existing preimage through bounded no-follow file access. `prepare` transactionally inserts the complete preimage row and changes the operation to prepared. A missing target stores `absent` with no bytes/hash and becomes create-by-save. Only after durable attempt registration does `atomic-writer.replace` create an exclusive operation temp, write and sync it, verify temp/parent/final identity and old-content hash, rename once and sync the directory. This narrows races but does not provide a platform-independent compare-and-swap against arbitrary external writers across the final pathname rename window.

## Failure and restart truth

Required reservation, preimage or prepare failure prevents replacement. For example, invalid old UTF-8 leaves those original bytes unchanged, records a failed accepted operation and returns `failed_before_replace`; no `resource.mutated` fact is emitted. Command admission is a separate axis: it may remain pending while the durable protected save continues.

An error after rename can mean `outcome_unknown` with `retrySafe: false`; the controller cannot safely call it a failed unperformed mutation. Startup reconciliation fails accepted/unprepared work, marks unattempted prepared work failed, and records attempted prepared work as unknown with bounded current-state evidence. Matching the intended postimage hash does not upgrade that unknown operation to success or rerun its mutation. Succeeded operations can replay pending facts/ledger work with their original IDs; temp cleanup is separately tracked.

If replacement succeeds but durable success recording fails, the current response remains a successful write with pending provenance after bounded persistence attempts. A restart can still find prepared/attempted state and report unknown. Response snapshots/cache prevent immediate duplicate side effects where available; they cannot make unavailable durable state certain. After successful replacement, publication, ledger, projection or Git-checkpoint failures never justify blindly replaying the write.

## Observation checkpoints and future versioning

The agent observer runs after reported activity, using its captured workspace authority and the secure native observation boundary. Missing native support fails observation rather than falling back to unsafe pathname capture. Eligible exact UTF-8 bytes are bounded at 10 MiB. First observation creates a checkpoint; a changed bytes/absent state creates another linked to the prior observed snapshot; unchanged state reuses the checkpoint. A read can establish the first baseline. The earlier observed checkpoint is not necessarily the state immediately before a tool ran.

The approved bounded save and agent contracts already permit their exact snapshots and hashes. Older general policy prerequisites must not be applied as blanket prohibitions to these stores. Broader `file.version` events, general diffs, restore commands/UI, arbitrary binary/large-file eligibility, deletion/rename/move coverage and lifecycle policy remain outside this implementation. Preserve history by default; exact retention, redaction/export and restore conflict/provider permissions require decisions when those features are specified. Restoring is a separate permitted write to the authoritative source, not editing a historical copy.

See [File Version Provenance Schema](../003-Provenance_Model/005-File_Version_Provenance_Schema/PAGE.md) for current record fields and [Resource Events And Render Sync](../005-Resource_Events_And_Render_Sync/PAGE.md) for the consumer path.
''')
add('007-Correlation_And_Causality',[
 S+'lib/file-mutations/fact-reservation-bindings.js',S+'lib/file-mutations/reported-ui-context.js',S+'lib/ledger/resource-provenance-repository.js',S+'lib/ledger/event-ledger.js',S+'lib/chat-metadata/collectors/file-mutations.js',S+'lib/agent-provenance/checkpoint-repository.js',S+'lib/agent-provenance/agent-ledger-repository.js'],
'Interpret durable operation links, reported UI context and observed resource history without turning temporal association into causal proof.',f'''
{status}

## Current evidence and its meaning

The mediated save knows its owning command and replacement attempt. `operationId`, `commandId`, `commandAcceptedEventId`, resource identity and preimage identity are derived from durable reservations, not a caller's invented causal graph. The ledger uses the operation as `correlation_id` and leaves `causation_id` null. This is strong evidence of Fusion's own save workflow, while the transport-only local connection remains an unauthenticated origin.

Optional `origin.reportedUiContext` records the reported workspace/view/tab/component/presenter/target at save time. The server derives workspace authority and bounds the context; it does not authenticate a human, verify that a tab caused the operation or turn `targetKey` into physical path authority. Unknown/stale/oversized context is omitted or degraded without denying valid work. Missing context stays missing. Historical context survives a tab's disappearance and does not write back to live tab state. See [Resource Mutation Provenance Schema](../003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md).

Agent activity IDs and resource edges connect a reported tool invocation to a later bounded observation. First/changed/unchanged refers to the previous observed checkpoint, not a verified before/after interception of that tool. A post-tool hash, write-like argument or matching path does not prove a successful write or sole authorship; another writer can act between checkpoints. Observation ledger rows retain source linkage with null causation. Keep reported provider clocks distinct from server observation clocks and record absence/failure instead of inventing an earlier image.

## Legacy correlation is separate

The legacy `file:changed` collector associates a change with an active turn only when workspace/root match and either the full epoch/thread/turn tuple matches or exactly one eligible turn exists for that workspace/root. Partial turn identity is rejected; ambiguous overlapping turns are not guessed. Its `fileMutations` metadata remains an association, not a governed tool-to-mutation proof.

The legacy ledger can default a `file:changed` actor to `user` when stronger actor data is absent. That is current heuristic code, not authenticated attribution and not the approved standard for a new provenance producer. A watcher reports an observed filesystem change; it cannot establish a human or assistant cause from timing alone.

## Approved direction and open contracts

Record useful independent facts even when causality is unknown. Prefer verified operation linkage where the owner actually has it, and label reported/observed/inferred evidence honestly. Do not require the old proposed accepted-reference API or confidence verdict before recording the accepted save/agent facts.

General UI-action/tool/harness/automation causal graphs, confidence policies and cross-domain proof interfaces remain future contracts. The earlier priority list of possible causes was a proposal, not a runtime resolver. A future correlation feature must define its evidence and uncertainty explicitly; it must not promote time proximity, a raw provider ID or an embedded upstream ID into direct causation.
''')
add('003-Provenance_Model/003-Resource_Mutation_Provenance_Schema',[
 S+'lib/event-registry/schemas/file-command-accepted-v1.json',S+'lib/event-registry/schemas/resource-mutated-v1.json',S+'lib/file-mutations/fact-reservation-bindings.js',S+'lib/file-mutations/reported-ui-context.js',S+'lib/file-mutations/file-operation-repository.js',S+'lib/ledger/resource-provenance-repository.js',S+'lib/ws/file-save-route.js',S+'lib/ws/resource-provenance-route.js',F+'src/lib/save-action-context.ts',F+'src/lib/ws/resource-provenance-protocol.ts'],
'Read the implemented mediated-save facts and optional reported context, distinct from broader resource-mutation schema proposals.',f'''
{status}

## Current closed save facts

The registered `file.command_accepted@1` and `resource.mutated@1` schemas describe one mediated text-save operation. The command fact follows durable acceptance; the mutation fact requires successful replacement. They do not use the older proposed common `eventFamily`/`ids`/`provenance`/`resourceMutation` envelope.

| Field | Current meaning |
|---|---|
| `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `workspaceId`, `operationId` | Reservation-bound host identity and time; exact event name and version 1 |
| `commandId` | Owning durable save command in both facts |
| `origin` | `kind: local_client`, server connection ID, `assurance: transport_only`, optional `reportedUiContext` |
| `resource` | Host `resourceId`, `kind: file`, canonical workspace-relative `path`, plus ingress `access.panel` and `access.path` |
| Command `intent` | `kind: save`; optional save reason, milestone and client action ID within validation bounds |
| Mutation `commandAcceptedEventId` | Reserved command-acceptance identity; not proof that its separate admission axis completed |
| Mutation `mutation` | `kind: create` or `modify`, with optional save reason/milestone |
| Mutation `fileVersionId` | Operational required-preimage row identity; not a canonical version event |

There are no concrete content hashes or snapshot bytes in `resource.mutated@1`. Required preimage bytes/hash and intended-after hash live in owning System records; bounded query results expose preimage metadata. Create-by-save has an absent preimage. Other mutation commands and watcher events have not acquired this schema. See [File Versioning](../../006-File_Versioning/PAGE.md) and [Render Sync](../../005-Resource_Events_And_Render_Sync/PAGE.md).

## Optional reported UI context

`fileDataStore.saveFile` calls synchronous `readSaveActionContext(panel)` at command time. It requires a current workspace and registered panel; it reads matching connected File owner state for optional active component-tab fields. Other registered save panels can contribute workspace/view context without those File component fields. It does not infer identities from an unrelated active tab or capture all UI actions.

The carrier permits `workspaceId`, `viewId`, `viewInstanceId`, `tabId`, `componentTypeId`, `componentInstanceId`, `presenterId` and `targetKey`. Identifier caps are 128 UTF-8 bytes and target key is 512. The current reader does not fabricate `viewInstanceId`. Server sanitization requires a usable view ID for retained context, derives workspace from the session, strips unknown/invalid optional fields, and drops the whole subtree for a bad or mismatching supplied workspace. Null/missing context may be omitted silently; degraded/mismatched input uses fixed diagnostics. Sanitization precedes locked request-schema validation so optional context failure does not reject an otherwise valid save. This exception does not relax path/content/operation validation or required preimage storage.

`reported-ui-context` maps retained fields to `file_operations` columns. `fact-reservation-bindings` reconstructs them in command and resource facts, and the resource ledger transaction copies them to `resource_provenance_events` beside the canonical payload. `resource-provenance-repository.query` returns the stored context and preimage metadata; view/tab/component/presenter/target selectors filter those historical columns. It does not reread live tab configuration to reconstruct the past, return snapshot bytes or change tab state.

The typed query runs through `resource:provenance:query/result/error` with server-bound workspace/epoch validation and bounded results. The client protocol helper and response registration exist; the inspected client source has no production invocation of `queryResourceProvenance`, so this transport is not evidence of a mounted audit/history screen. Query UI belongs to later work.

## Meaning and future scope

The context is reported comparison evidence, not an authenticated actor, permission, causal verdict or resource identity. T1 domain mutations and their T2 action context are the durable direction; ambient T3 navigation/focus/scroll is not retained by this carrier. This implementation does not emit a general `ui.action`, assign a universal UI action ID, or cover all panels, prompt attachments or commands.

Broader resource schemas, watcher provenance, automation causes and graph edges remain proposals requiring their owning contracts. The exact supported save snapshot/context behavior already has authority; an older blanket hash prohibition or accepted-reference gate does not disable it. Preserve unknown attribution rather than guessing, as explained in [Correlation And Causality](../../007-Correlation_And_Causality/PAGE.md).
''')
add('003-Provenance_Model/005-File_Version_Provenance_Schema',[
 S+'lib/db/migrations/035_file_provenance.js',S+'lib/db/migrations/036_agent_tool_provenance.js',S+'lib/file-mutations/file-version-repository.js',S+'lib/file-mutations/file-operation-repository.js',S+'lib/agent-provenance/checkpoint-repository.js',S+'lib/ledger/resource-provenance-repository.js',S+'lib/file-mutations/checkpoint-adapter.js'],
'Identify current save-preimage and agent-checkpoint records without implying a universal file-version event or restore contract.',f'''
{status}

## Current operational preimage record

Migration `035_file_provenance.js` owns `file_versions` alongside the save operation/resource/projection tables. `file-version-repository.insertInTransaction` is called by operation preparation before replacement, not by a post-mutation universal version subscriber. Reserved IDs alone do not mean the mutation succeeded or its resource fact was admitted.

| Stored column | Meaning |
|---|---|
| `file_version_id`, `operation_id`, `resource_id`, `resource_event_id` | Host-generated identities bound to the reserved save operation and its prospective resource fact |
| `preimage_kind` | Exact `bytes` or `absent` state before replacement |
| `snapshot_bytes`, `sha256`, `encoding`, `byte_length` | Exact eligible before bytes, SHA-256, `utf-8` and byte length; absent has null bytes/hash/encoding and zero length |
| `captured_at` | Preparation-time capture timestamp |

The transaction couples the row to prepared operation state. Reusing an established file-version identity with different data conflicts. The public resource-provenance query joins snapshot metadata, not bytes; the repository's internal `readSnapshotBytes` method is not a public restore command. No after snapshot or computed/stored diff is added by this row. Intended-after hash/length are operation binding data, not a general after-version artifact.

## Current agent checkpoint record

Migration `036_agent_tool_provenance.js` owns the separate `agent_resource_snapshots` and `agent_snapshot_blobs`. `checkpoint-repository` stores an eligible post-activity bytes/absent observation, its path/workspace, activity/observation/event/snapshot identities, observed clock and previous snapshot link. Exact byte content is deduplicated by hash with byte-equality checking. First/changed state creates a snapshot and `resource.state_observed@1`; unchanged state reuses the snapshot and adds no new observation fact. It can still drive renderer invalidation.

A first read may establish a baseline. A prior checkpoint is a prior observation, not guaranteed pre-tool content. These snapshots do not mint save `fileVersionId` values or canonical `file.version` events. The observer's native security and eligibility checks can fail without a checkpoint; bounded metadata then records the failure rather than fabricating bytes. Agent timing/capture detail belongs to the tool provenance owner.

## Direction and unimplemented schema

System owns historical recovery/audit copies; the authoritative file or connected app owns live content. Restoration requires a separately permitted mutation to that source. Existing reason-based Git checkpoints remain a third mechanism, not universal snapshot restoration.

General version events, before/after/diff/restore lineage, version graph edges and change-storm batches are unimplemented design areas. The former universal example was a proposal and is not a payload callers may send. Binary/generated/large-file eligibility, retention/deletion, redaction/export, restore coverage and conflicts require feature-specific decisions. Preserve history by default; no new pruning policy or restore operation is approved here. The bounded save and agent snapshot/hash contracts are already implemented and must not be blocked by older general policy proposals.

See [File Versioning](../../006-File_Versioning/PAGE.md), [Resource Mutation Provenance](../003-Resource_Mutation_Provenance_Schema/PAGE.md) and [System Database Boundary](../../../002-Server_And_Runtime/PAGE.md#system-database-boundary).
''')
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest={'slice':'S03','at':datetime.datetime.now().astimezone().isoformat(),'pages':[],'deviations':[]}
diffs=[]
assert not (C/'S03-CHANGE-MANIFEST.json').exists(),'initial write already completed'
for p,(sources,description,body) in pages.items():
 old=p.read_bytes();text=old.decode();front=text.split('---',2)[1]
 front=re.sub(r'description:.*', 'description: '+description,front)
 front=re.sub(r'  source-files:[\s\S]*?(?=  connected-skills:)', '  source-files:\n'+''.join('    - '+x+'\n' for x in sources),front)
 blocks=re.findall(r'<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->',text)
 new=('---'+front+'---\n\n'+body+(' \n'.join(blocks) if blocks else '')).encode()
 p.parent.joinpath('.versions').mkdir(exist_ok=True)
 stamp=datetime.datetime.now().astimezone().strftime('%Y-%m-%d-%H%M%S');snap=p.parent/'.versions'/f'{stamp}.md'
 with snap.open('xb') as f:f.write(old)
 assert p.read_bytes()==old,f'concurrent edit: {p}'
 p.write_bytes(new)
 manifest['pages'].append({'path':str(p),'snapshot':str(snap),'before_sha256':sha(old),'snapshot_sha256':sha(snap.read_bytes()),'after_sha256':sha(new)})
 diffs.extend(difflib.unified_diff(text.splitlines(True),new.decode().splitlines(True),fromfile=str(snap),tofile=str(p)))
(C/'S03-CHANGE-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
(C/'S03-PAGES.diff').write_text(''.join(diffs))
print('Wrote',len(pages),'pages with exclusive exact pre-edit snapshots')
