---
name: Chat Metadata Provenance Schema
description: Schema guidance for connecting exchange metadata, tool calls, resource mutations, ledger events, UI context, and future file versions.
metadata:
  source-files:
    - fusion-studio-server/lib/thread/HistoryFile.js
    - fusion-studio-server/lib/audit/audit-subscriber.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-server/lib/agent-provenance/turn-authority.js
    - fusion-studio-server/lib/agent-provenance/exchange-bind-repository.js
    - fusion-studio-server/lib/agent-provenance/exchange-binder.js
    - fusion-studio-server/lib/agent-provenance/query-repository.js
    - fusion-studio-server/lib/db/migrations/036_agent_tool_provenance.js
  last-modified: "2026-09-19T11:52:20Z"
---

Status: source inspected on 2026-09-19 in the development checkout. Full Chat persistence and the bounded agent provenance overlay are implemented as separate owners. Broader common chat-event envelopes, raw-output publication and universal UI-action linkage remain proposals. Existing tests were inspected, not rerun; this page makes no runtime or installed Alpha claim.

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
