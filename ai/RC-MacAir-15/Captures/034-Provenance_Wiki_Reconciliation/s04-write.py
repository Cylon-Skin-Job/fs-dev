"""Documentation authoring only; not an acceptance check. Exclusive preimages and drift guard."""
from pathlib import Path
from datetime import datetime
import hashlib, json, difflib, re
C=Path('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation')
W=Path('ai/RC-MacAir-15/Wiki/010-Events_And_Ledger')
def sha(b): return hashlib.sha256(b).hexdigest()
pages=[
('003-Provenance_Model/001-Chat_Metadata_Provenance_Schema/PAGE.md',[
'fusion-studio-server/lib/thread/HistoryFile.js','fusion-studio-server/lib/audit/audit-subscriber.js','fusion-studio-server/lib/wire/canonical-chat-event-applier.js','fusion-studio-server/lib/agent-provenance/turn-authority.js','fusion-studio-server/lib/agent-provenance/exchange-bind-repository.js','fusion-studio-server/lib/agent-provenance/exchange-binder.js','fusion-studio-server/lib/agent-provenance/query-repository.js','fusion-studio-server/lib/db/migrations/036_agent_tool_provenance.js'],'''Status: source inspected on 2026-09-19 in the development checkout. Full Chat persistence and the bounded agent provenance overlay are implemented as separate owners. Broader common chat-event envelopes, raw-output publication and universal UI-action linkage remain proposals. Existing tests were inspected, not rerun; this page makes no runtime or installed Alpha claim.

Use this page to understand the provenance boundary before following the [Chat System](../../../007-Chat_System/000-Overview_and_References/PAGE.md) into its owning persistence and lifecycle contracts.

## Current Chat storage and disclosure

`audit/audit-subscriber.js` receives the legacy `chat:turn_end` event and builds exchange metadata including `turnId`, completion reason, partial state, capture/save times, message/plan/context/token data and, when present and validated, a safe terminal error. Its pending key includes workspace, root, workspace epoch, session and turn. The metadata aggregator contributes the existing attachment, mention and file-mutation metadata. These collectors and legacy attribution are not a governed causal graph.

`HistoryFile.addExchange` stores user input, the full assistant parts JSON and metadata in `exchanges` in System's `fusion.db`. Tool arguments and results can remain in assistant parts. The bounded provenance index does not replace that transcript, sanitize it by implication, or impose the older proposed accepted-reference rules on all existing Chat JSON. A summary that omits raw material is not evidence that no raw material exists elsewhere in Chat storage.

The activity index stores normalized tool identity, lifecycle, clocks, optional argument/result SHA-256 fingerprints, candidate path metadata and observation state. Public activity queries return those bounded summaries and, only after successful binding, an `exchange_tool_part` detail reference. They do not return raw arguments, results or checkpoint bytes. Fingerprints discriminate locally retained values; they are neither a redaction certificate nor a captured-output artifact. Consult [Tool Call Provenance](../002-Tool_Call_Provenance_Schema/PAGE.md) for terminal processing and candidate limits.

## Identity and authority

| Identity | Current meaning and boundary |
|---|---|
| `workspaceId`, `threadId`, `turnId` | Server-captured authority for one accepted prompt and its activity. `threadId` remains the chat session, transcript and live-routing key. |
| `threadGroupId` | The visible Thread/body of work; membership and Main/Side presentation do not retarget recorded activity. It is not an activity query filter today. |
| `viewId` | Immutable owning view binding. Null denotes the workspace Legacy population, not the current active view. |
| `surfaceId` | One transient mounted Chat instance; not a durable provenance ID or session authority. |
| Tab/component placement | View-owned context, distinct from group, session and mounted-surface identity. Closing a placement is not deleting its session. |
| `activityId`, `eventId` | Host-generated durable activity/fact identities; `toolCallId` is the bounded provider call identity within the captured turn/harness context. |

`createAgentTurnAuthorityRef` captures the canonical workspace root plus its digest and device/inode identity at prompt acceptance. The activity persists the private root identity so observation/reconciliation can enforce it after restart. Active navigation or a later workspace switch cannot supply replacement authority. Provider session IDs, a rendered tab and a connection ID are not substitutes for this tuple.

The approved Chat/tab conformance direction keeps these identities separate and degrades missing optional surface context without blocking a valid Chat action. It is not proof that every Chat action emits provenance. View-bound action context and Legacy absence rules belong to the Chat owner; current tool facts carry session/turn identity, not a universal group/view/tab/surface envelope. Current mediated-save reported context is covered by [Resource Mutation Provenance](../003-Resource_Mutation_Provenance_Schema/PAGE.md), not by inventing prompt or tool UI causes.

The shell's private live `trusted-shell` role is a transport/action authorization boundary described by Chat. It is not persisted into provenance or the UEB. A save origin marked `transport_only` describes the historical fact's assurance; it does not prove that the current socket skipped shell authentication, nor does it establish an authenticated human author.

## Exchange binding and failure

With binding authority present, `HistoryFile.addExchange` inserts the exchange and `agent_exchange_bind_jobs` row in the same transaction. Failure to insert the required job rolls back that exchange transaction. After commit the singleton binder is signalled. This is separate from fail-open activity reservation: provenance capture failure does not rewrite an already executed tool result, but the paired exchange/job write has a transactional requirement.

`exchange-bind-repository.js` checks the saved session/time, exact workspace/session/turn activity set, one matching tool part per call, terminal expansion version/completeness, and each available argument/result fingerprint. Duplicate or incomplete detail, hash mismatch or an existing different binding yields a conflict instead of retargeting the activity. Missing fingerprints are skipped; they are not reconstructed from partial output. Successful binding records `exchangeId`, `exchangeSavedAt` and `exchangeBoundAt`; it does not change the earlier fact's clocks or causal meaning.

Binding drains one job at a time in yielded batches of 100 with a bounded one-second startup pass. Retryable database failure receives one delayed retry after bounded immediate attempts; exhausted/nonretryable work stays pending and is suppressed until restart. Startup uses durable jobs rather than scanning every historical exchange. Exchange deletion clears the nullable activity binding and its binding times and removes the associated bind job; checkpoints remain. This is bounded behavior, not a promise that every System history table is append-only. See the [System database boundary](../../../002-Server_And_Runtime/PAGE.md#system-database-boundary) for preservation direction and current lifecycle gaps.

## Approved direction and open work

Keep durable chat history, activity and snapshots within System; keep view worksurface state with its owning view. Preserve history by default and make cleanup an explicit user policy. A checkpoint remains an audit/recovery copy rather than a live source.

Broader chat event registration, native-reference publication, captured-output/redaction policy, general resource sidecars, causal relationships, restore and retention details require their own feature decisions. Do not infer those APIs from this page or reopen the already accepted bounded activity/checkpoint behavior. [Assistant Query And Review Loops](../../009-Assistant_Query_And_Review_Loops/PAGE.md) distinguishes current transports from future audit UI and assistant loops.
'''),
('003-Provenance_Model/002-Tool_Call_Provenance_Schema/PAGE.md',[
'fusion-studio-server/lib/harness/opencode/index.js','fusion-studio-server/lib/harness/opencode/json-event-translator.js','fusion-studio-server/lib/harness/opencode/resource-extractor.js','fusion-studio-server/lib/wire/canonical-harness-event-bridge.js','fusion-studio-server/lib/wire/canonical-chat-event-applier.js','fusion-studio-server/lib/agent-provenance/activity-owner.js','fusion-studio-server/lib/agent-provenance/activity-repository.js','fusion-studio-server/lib/agent-provenance/candidate-fingerprints.js','fusion-studio-server/lib/agent-provenance/resource-observer.js','fusion-studio-server/lib/agent-provenance/checkpoint-repository.js','fusion-studio-server/lib/agent-provenance/announced-activity-reconciler.js','fusion-studio-server/native/secure-file-observer/index.js','fusion-studio-server/native/secure-file-observer/secure_file_observer.c'],'''Status: source inspected on 2026-09-19 in the development checkout. Configured OpenCode terminal activity, bounded candidates, governed facts and sparse observation checkpoints are implemented. General tool/native-reference events and captured-output contracts remain proposals. Tests are assertions inspected, not rerun; native availability and live rendering were not tested here.

## Current ingress and terminal capture

The OpenCode adapter in `harness/opencode/index.js` parses JSON lines and feeds `OpenCodeJsonEventTranslator`. `translateToolUse` accepts a bounded own `part.callID` and tool name, and only `part.state.status` of `completed` or `error`, for `tool_snapshot`. `part.id` is not the tool-call identity. Invalid/over-bound identity or other status produces fixed diagnostics and the legacy Chat fallback, without a new provenance activity. Provider status maps directly to provenance status; exit metadata, Chat `isError` and protected-Settings display transformations do not redefine it.

The canonical harness bridge carries the snapshot through the accepted turn's immutable route and lifecycle fence to `applyTerminalToolSnapshot`. The applier evaluates any result-phase Settings transformation, prepares the final JSON-safe result and asks `activity-owner.js` to reserve the normalized activity before expanding the existing Chat call → arguments → result sequence. Terminal-derived arguments do not take a pre-execution Settings stop branch. A tool terminal snapshot is an ordered event inside the turn; it does not end the turn or prevent later text/tools.

Reservation captures `activityId`, `eventId`, workspace/session/turn/harness/provider/call identity, normalized and native tool names, direct terminal status, clocks, optional complete-value fingerprints and retained candidate edges. The synchronous transaction atomically stores `agent_tool_activities`, `agent_tool_resource_edges` and the observation job when needed. Its two-second cancellation gate and at most five immediate zero-busy-wait attempts bound the wait. Failure emits a fixed diagnostic and resumes Chat delivery; late old-generation work cannot mutate the current turn. This observational failure does not undo or reclassify external tool execution.

## Clocks and interruption

Host `observedAt` is receipt time. Optional provider-reported execution start/end and terminal-envelope times remain separate; they are not independently verified execution clocks. In the terminal-only path, announcement, available arguments and terminal observation share the snapshot receipt time. Later resource observation, reconciliation, exchange save and exchange binding have their own clocks. A duration inferred from receipt times would not measure provider execution.

Storage supports `announced`, `completed`, `error`, `blocked` and `interrupted`, but current OpenCode capture normally enters as a complete terminal snapshot. Synthetic incremental capture is disabled by default in the applier; its announced/argument/blocked branches are not evidence of production incremental OpenCode coverage. A stop before any terminal snapshot can leave no new activity for that tool. Existing in-memory announced activity can be closed on interruption; startup reconciliation closes durable abandoned announced rows as interrupted, retaining stored authority and known phase times without inventing provider terminal times, results or candidates lost with memory. Full partial-turn Chat persistence remains the Chat owner's separate contract.

## Candidate extraction is bounded evidence

`extractOpenCodeCandidates` recognizes structured `read`, `write` and `edit` with exact `filePath`/`file_path` fields; disagreeing or invalid fields yield no candidates. For `bash`, the parser reads a command string as data and never runs a shell. It supports a constrained literal command/operand and redirection grammar, including selected forms of cat/head/tail/wc/stat/file, grep/rg, touch/rm/unlink/truncate/tee and cp/mv. Unknown commands, ambiguous options, dynamic expansions, substitutions, globs and unsupported segments can be missed. Result-file hints and recursive argument/path discovery are not active.

Candidate identity is lexical against the prompt-captured canonical root. Paths that escape the workspace or are invalid become fingerprint/reason-only durable edges without retaining the raw rejected path in this index. This is not a guarantee about what the full Chat arguments retain. Path aliases and access/extraction tuples are deduplicated; at most 64 unique candidates are retained and detection of the 65th sets `reported=65`, `retained=64`, `truncated=true`. It does not count all remaining paths. Invalid or over-65,536-byte shell input yields no candidates and no truncation flag. Neither zero candidates nor `truncated=false` proves exhaustive file coverage or no mutation.

Access family/kind is an extracted report of intended access, not proof of a read or write. Pre-observation invalid/outside/blocked candidates close as skipped at attempt zero. Accepted canonical paths proceed to observation only after their owning tool fact is admitted.

## Governed fact, observer and checkpoints

`activity-repository.js` constructs `agent.tool_completed@1` with top-level fact/workspace/operation/time fields, `origin` (`agent_harness`, `adapter_observed`), `thread`, `tool`, `timing`, bounded `resources` and `candidatesTruncated`. Optional argument/result hashes fingerprint complete values already retained by Chat, with bounded hashing that can omit a fingerprint. They do not expose raw values or approve a general output artifact schema. The host-owned publisher verifies durable reservation and the locked schema; admission is distinct from ledger storage, observation completion and renderer receipt.

The observer uses a durable queue and the same workspace/path coordinator as mediated saves, without intercepting external tool execution. It permits at most four paths globally and one per activity, with a 16-disposition batch and bounded startup pass. Save-priority lock misses consume no filesystem attempt. Each claimed path group has at most three timeout attempts; lease recovery consumes an already reserved attempt. Work that cannot settle remains explicitly pending/failed/conflicting under bounded retries rather than an unbounded polling loop.

Safe observation requires the bundled asynchronous Darwin Node-API addon and required descriptor-relative flags. The native implementation pins/verifies the root and traverses with `openat`/`fstatat`, rejecting unsafe symlink/nonregular/racing outcomes. If the addon is unavailable, the job records `secure_open_unavailable` before workspace pathname lookup; there is no JavaScript pathname fallback and no registry/checkpoint mutation. Missing/replaced workspace authority, observation timeouts, permission/I/O failures, parent/final symlinks, nonregular files, files over 10 MiB and unsupported text are explicit failed/skipped outcomes, not successful empty observations. A safely established absent path is a separate successful `absent` state.

Eligible bytes must be exact, NUL-free UTF-8 up to 10 MiB. `checkpoint-repository.js` stores deduplicated exact bytes in `agent_snapshot_blobs` and sparse path-scoped checkpoints in `agent_resource_snapshots`. A read can establish the first checkpoint. First observation has no invented prior state; a changed bytes/absent state references the prior observed checkpoint and reserves `resource.state_observed@1`. Unchanged state reuses the existing snapshot and emits no new observation fact, while retaining the new activity/edge. The prior checkpoint may be much older than this tool and is not a pre-tool image. Concurrent external writes remain possible between execution and observation, so change does not prove authorship. Absent state has no live resource identity; a later file can acquire a successor identity while the path checkpoint chain remains continuous.

Same-activity edges stay queryable, but one observation per path uses write-over-read-over-execute-over-unknown dominance. Every successful observation, including unchanged, creates a durable renderer projection job. [Resource Events And Render Sync](../../005-Resource_Events_And_Render_Sync/PAGE.md) traces its v2 invalidation and central File Viewer consumer. [Assistant Query And Review Loops](../../009-Assistant_Query_And_Review_Loops/PAGE.md) traces ledger, query and restart behavior; [Chat Metadata Provenance](../001-Chat_Metadata_Provenance_Schema/PAGE.md) covers exchange binding.

## Approved scope and open work

The accepted overlay covers normalized activity and optional fingerprints, eligible exact observation checkpoints and the two named admitted facts. It does not register broad `chat.tool.*` events, provider-native reference publication, canonical file-version events, causal graph edges, general diffs/restore, snapshot-byte queries, captured-output storage or arbitrary plugin producers. Preserve historical evidence by default; broader lifecycle, disclosure and automation contracts need feature-specific decisions. No new interception, retention policy or complete tool/file census follows from the current implementation.
'''),
('009-Assistant_Query_And_Review_Loops/PAGE.md',[
'fusion-studio-server/lib/startup.js','fusion-studio-server/lib/ws/client-message-router.js','fusion-studio-server/lib/ws/agent-activity-route.js','fusion-studio-server/lib/ws/resource-provenance-route.js','fusion-studio-server/lib/agent-provenance/query-repository.js','fusion-studio-server/lib/ledger/resource-provenance-repository.js','fusion-studio-server/lib/agent-provenance/agent-ledger-repository.js','fusion-studio-server/lib/agent-provenance/fact-admission-reconciler.js','fusion-studio-server/lib/agent-provenance/renderer-projection-authority.js','fusion-studio-client/src/lib/ws/resource-provenance-protocol.ts','fusion-studio-client/src/lib/ws-client.ts','fusion-studio-client/src/lib/ws/file-handlers.ts','fusion-studio-client/src/state/fileDataStore.ts'],'''Status: source inspected on 2026-09-19 in the development checkout. Bounded agent-activity and mediated-save query transports exist. A mounted provenance history/audit UI and assistant review loop were not found in the inspected production client paths. Broader audit schemas and automation remain future work. Source/test inspection here is not a fresh runtime, native-addon or installed Alpha verification.

## Current producer to query chain

OpenCode terminal snapshots pass through the canonical translator/bridge/applier to activity reservation and candidate extraction. Admitted `agent.tool_completed@1` schedules observation; eligible first/changed states reserve `resource.state_observed@1`. The private admission path verifies source identity/hash and commits the agent source's admitted state before subscriber dispatch. A subscriber failure does not revoke admission, and admission alone proves neither ledger storage nor a completed observation.

`agent-ledger-repository.js` projects those two exact frozen fact JSON values into `event_log` and `event_resource_edges`. Tool facts correlate by activity ID and create edges only for accepted canonical paths, with access-derived roles. Observation facts correlate to their source activity and create an observed-file edge. Both leave `causation_id` null. Their producer rows own durable ledger state; this is not a general causal graph or proof that a tool caused every observed change. Legacy Chat/watcher ledger paths remain separate; see [Ledger Schema](../004-Ledger_Schema/PAGE.md).

## Query contracts and response consumers

| Transport | Current request and result boundary |
|---|---|
| `agent:activity:query` version 1 | Required subject `tool_calls` or `resource_edges`; selectors include canonical path/folder/file name, activity/session/turn/exchange/call/harness, tool names, statuses, access family/kind, changed-only, time range and cursor. Default limit 50, maximum 100. Returns `agent:activity:result` with bounded items and optional descending-keyset `nextCursor`, or `agent:activity:error`. |
| `resource:provenance:query` version 1 | Mediated-save mutation history with path/folder/file name, operation and reported view/tab/component/presenter/target filters plus `since`. Default limit 50, maximum 200. Returns `resource:provenance:result` items or `resource:provenance:error`; it is not a merged agent activity query. |

`client-message-router.js` delegates each query to its route. The server requires bounded request identity, version and workspace/epoch envelope, compares the connection's current workspace pair, validates the active registry schema and normalizes panel-relative selectors through the workspace path owner before repository access. Missing/stale workspace, malformed request and repository failure have distinct fixed errors; unavailable schema authority can close the socket. Reply delivery remains workspace-bound, so a completed query cannot be presented as a result for a newly selected workspace.

Agent tool summaries expose normalized names/IDs/status, separate timing fields, optional fingerprints, candidate counts/truncation, distinct accepted-path counts, changed counts, fact states and a detail reference only when exchange binding succeeded. Resource-edge results expose access/extraction basis, observation state/reason, canonical path when accepted and snapshot metadata when available. `changedOnly` means a changed observation, not first observation, successful write, or causal attribution. Neither subject returns raw arguments, raw results, private root authority or snapshot bytes. Following a bound detail reference is a separate Chat disclosure path, not permission to publish those values into the ledger.

The resource query's client helper `queryResourceProvenance` checks advertised protocol support, mints a request ID and records the current workspace pair. `ws-client.ts` calls `handleResourceProvenanceResponse`; strict response checks, pending-request pairing and epoch checks protect resolution. Disconnect/workspace transitions retire pending queries. This helper and response handler are plumbing: a bounded search across `fusion-studio-client/src` found the helper definition but no production caller. The same search found no `agent:activity` client request/response consumer. Therefore neither a mounted query/history screen nor an assistant-facing query tool is established by these server routes. Existing tests/fixtures are not production UI callers.

## Freshness is a separate consumer

After a successful resource observation, a durable renderer job uses the dominant edge ID as stable projection identity. First/changed state publishes `resource:changed` version 2 only when its checkpoint fact is admitted; otherwise it sends identity-safe `resource:refresh_required`. Unchanged state can publish v2 under the admitted tool fact without a new checkpoint fact. A v2 send failure attempts the bounded recovery path. Accepted send/buffer, fallback or no matching recipient can settle the job; none is client acknowledgment.

The workspace-bound publisher reaches `file-handlers.ts`, which validates the v1/v2 union and delegates to `fileDataStore`. The store rejects stale workspace/epoch, deduplicates identity and closes on conflicting projection identity, invalidates the canonical File Viewer path/parent tree and refetches interested content. Both the policy-ready File document presenter and legacy File Viewer read that store. Even unchanged agent checkpoint bytes can require a refetch after another writer changed central state. This is visible file freshness, not a provenance history UI.

Targeted projection acts on File Viewer cache and has no dirty-flag guard there; it does not directly overwrite Office/Email editor buffers. Reconnect hydration separately preserves dirty File Viewer entries while refreshing clean ones. Do not generalize either mechanism to every editor, infer all-view conflict handling, or treat a server event/send as proof of visible rendering. See [Resource Events And Render Sync](../005-Resource_Events_And_Render_Sync/PAGE.md) for the inspected consumer and failure detail.

## Restart and reconciliation

Startup installs activity, admission, observation, ledger, exchange-binding and renderer owners before public work, runs bounded startup passes and then enables yielded continuations. Durable rows/jobs retain pending truth across process loss; recovery does not rediscover every historical exchange or file. Announced activity is terminalized as interrupted without fabricated provider clocks or raw inputs lost with memory. Exchange jobs bind only verified complete detail; observation jobs require admitted activity and revalidate stored root authority. A changed/replaced root cannot retarget an old job.

Ledger work claims and charges at most three durable cycles, each with bounded immediate attempts. Earlier failures schedule delayed retries; exhausted work becomes failed and semantic mismatch becomes conflict. Claim/lease recovery consumes the charged attempt instead of inventing another unlimited cycle. Admission, binding and scheduler transition failures also use bounded retries and exact-key suppression until restart. Persistent failures can leave pending/conflict/failed evidence, so restart is recovery opportunity rather than a guarantee of completion. Renderer retry exhaustion relies on reconnect hydration for freshness. Shutdown cancels unstarted timers and bounds owner draining before database close.

## Approved direction and future review loops

The durable goal is to search what happened, which session/tool or user action was involved, what state was observed and what evidence supports a proposed improvement. Keep actual mutations and their action context searchable while excluding ambient navigation/scroll telemetry from durable history. Current mediated-save context is a historical snapshot, not current view state or authenticated human causation. The approved Chat/tab identity contract does not itself emit universal Chat/UI facts.

Future assistant reviews should cite evidence, distinguish direct facts from correlation, and propose concrete changes for the appropriate owner. A query result is not authority to mutate files, change System configuration, start automation or restore a snapshot. Wider audit-query schemas, review-result storage, plugin invocation permissions, causal analysis, storm compaction, general versions/diffs/restore and lifecycle policy remain unimplemented or unresolved feature contracts. The existing sparse checkpoints and bounded summaries do not settle those choices. Preserve System history by default and resolve exact controls when building the relevant feature; see [System database boundary](../../002-Server_And_Runtime/PAGE.md#system-database-boundary).
''')]
manifest={'slice':'S04','at':datetime.now().astimezone().isoformat(),'pages':[],'deviations':['S04-D01 current owner-edited wiki metadata policy supersedes legacy V2 arrays on edited pages']}
diffs=[]
for rel,sources,body in pages:
 p=W/rel; old=p.read_bytes(); oldtext=old.decode(); now=datetime.now().astimezone(); stamp=now.strftime('%Y-%m-%d-%H%M%S'); version=p.parent/'.versions'/f'{stamp}.md'; version.parent.mkdir(exist_ok=True)
 with version.open('xb') as f: f.write(old)
 header=oldtext.split('---\n',2)[1]
 name=re.search(r'^name: (.*)$',header,re.M).group(1); description=re.search(r'^description: (.*)$',header,re.M).group(1)
 text='---\nname: '+name+'\ndescription: '+description+'\nmetadata:\n  source-files:\n'+''.join('    - '+s+'\n' for s in sources)+'  last-modified: "'+now.astimezone(__import__('datetime').timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')+'"\n---\n\n'+body
 blocks=re.findall(r'<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->',oldtext)
 if blocks: text+='\n'+'\n\n'.join(blocks)+'\n'
 assert p.read_bytes()==old, 'concurrent page drift; reread required'
 p.write_text(text)
 manifest['pages'].append({'path':str(p),'snapshot':str(version),'before_sha256':sha(old),'snapshot_sha256':sha(version.read_bytes()),'after_sha256':sha(p.read_bytes()),'written_at':now.isoformat()})
 diffs.extend(difflib.unified_diff(oldtext.splitlines(True),text.splitlines(True),fromfile=str(version),tofile=str(p)))
(C/'S04-CHANGE-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
(C/'S04-PAGES.diff').write_text(''.join(diffs))
print('Wrote',len(manifest['pages']),'pages with exclusive complete preimages')
