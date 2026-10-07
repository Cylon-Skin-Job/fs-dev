---
name: Events Assistant Query And Review Loops
description: How future workers can inspect conversations, tool calls, file versions, and failures to surface concrete improvements.
metadata:
  source-files:
    - fusion-studio-server/lib/startup.js
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-server/lib/ws/agent-activity-route.js
    - fusion-studio-server/lib/ws/resource-provenance-route.js
    - fusion-studio-server/lib/agent-provenance/query-repository.js
    - fusion-studio-server/lib/ledger/resource-provenance-repository.js
    - fusion-studio-server/lib/agent-provenance/agent-ledger-repository.js
    - fusion-studio-server/lib/agent-provenance/fact-admission-reconciler.js
    - fusion-studio-server/lib/agent-provenance/renderer-projection-authority.js
    - fusion-studio-client/src/lib/ws/resource-provenance-protocol.ts
    - fusion-studio-client/src/lib/ws-client.ts
    - fusion-studio-client/src/lib/ws/file-handlers.ts
    - fusion-studio-client/src/state/fileDataStore.ts
  last-modified: "2026-09-19T11:52:20Z"
---

Status: source inspected on 2026-09-19 in the development checkout. Bounded agent-activity and mediated-save query transports exist. A mounted provenance history/audit UI and assistant review loop were not found in the inspected production client paths. Broader audit schemas and automation remain future work. Source/test inspection here is not a fresh runtime, native-addon or installed Alpha verification.

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
