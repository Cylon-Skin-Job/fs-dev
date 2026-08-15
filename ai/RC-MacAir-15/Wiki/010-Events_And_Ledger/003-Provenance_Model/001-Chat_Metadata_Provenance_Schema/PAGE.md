---
name: Chat Metadata Provenance Schema
description: Schema guidance for connecting exchange metadata, tool calls, resource mutations, ledger events, UI context, and future file versions.
metadata:
  incoming-edges:
    - Events Provenance Model
    - Events And Ledger
  outgoing-edges:
    - Events Provenance Model
    - Events Correlation And Causality
    - Events File Versioning
    - Chat Identity And Persistence
    - Chat Harness And Event Flow
  source-files:
    - fusion-studio-server/lib/thread/HistoryFile.js
    - fusion-studio-server/lib/audit/audit-subscriber.js
    - fusion-studio-server/lib/chat-metadata/collectors/attachments.js
    - fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js
    - fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-update-service.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-server/lib/ledger/event-ledger.js
  connected-skills: []
  related-trigger-files: []
---

> **Schema correction authority (2026-07-15):** Apply the [provenance cross-article findings](../../../../Captures/008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat. Decision-tagged chat/resource/output choices remain open under `CHAT-D01` and the named cross-domain gates.

Use this page before changing `exchanges.metadata`, chat tool-call events, chat audit subscribers, or file mutation metadata.

Chat metadata is one leg of the provenance graph. It should connect a persisted exchange to the runtime turn, tool calls, UI context, resource mutations, ledger events, and future file versions without forcing later audits to infer everything from rendered assistant text.

## Current Metadata Shape

`exchanges.metadata` is the current extension point. It is persisted as JSON and already carries fields such as:

```js
{
  messageId,
  planMode,
  contextUsage,
  tokenUsage,
  turnId,
  reason,
  partial,
  capturedAt,
  savedAt,
  attachments: [],
  mentions: [],
  fileMutations: [],
  bookmark,
  note,
  chatMirror: { threadId, exchangeId, seq, turnId }
}
```

All ID-bearing chat projections obey the shared accepted-reference discipline. Canonical candidates receive accepted-only relationships only through `prepareCanonicalCandidate`, which consumes the upstream ref and records private proof; copying a string from inspection/runtime state never qualifies. `chat.runtime` includes harness/tool domain IDs and provider-native refs only through the applicable registered bindings. When no accepted reference is already available, preserve independently safe provider/model/plan-mode facts, omit IDs/native refs, and never wait.

The first Wiki/File package's 40b1a stage does not yet register canonical chat events. Existing `chat:*` facts remain a named compatibility path and receive no `uiActionId`. Open owner decision `CHAT-D01` blocks SPEC-40b2a registration and migration. It must approve exact event types and phase/lifecycle presence; IDs, payload fields, mirrors, current-record identities, and accepted-only relationships; optional UI cause/result pointer bindings; redaction policy/version and sensitive prompt/content/attachment/native-ref handling; failed-redaction safe-core versus no-event behavior; deterministic text/collection/serialized-byte bounds and overflow; ordering/dedupe/replay/idempotence; and legacy coexistence/removal/backfill. Until then, the schema below is design guidance rather than an executable registration contract, and no implementation may choose its open values or mutate/backfill existing chat facts.

One non-authoritative migration option is to preserve selected legacy keys while adding a versioned structure for provenance and queryability. `CHAT-D01` has not chosen that option, coexistence duration, removal, or backfill.

## Exchange Metadata Envelope

The following is a design candidate, not an executable contract: add a versioned envelope inside exchange metadata using the shared provenance envelope from [Events Provenance Model](../PAGE.md), then add a `chat` payload for exchange-specific facts. Whether any existing loose keys coexist, are removed, or are backfilled remains entirely open under `CHAT-D01`.

The exchange metadata envelope is a projection of the turn event. `eventId` equals `chat.turnEventId`. `chat.exchangeSavedEventId` identifies the separate persistence event for saving the exchange.

```js
{
  schemaVersion: 2,
  eventId,
  eventFamily: 'chat',
  eventType: 'chat.turn',
  eventPhase,
  occurredAt,
  ids: {
    workspaceId,
    machineId,
    machineName,
    threadId,
    exchangeId,
    turnId,
    messageId,
    rootEventId,
    parentEventId,
    correlationId,
    causationId,
    harnessId,
    harnessRunId,
    harnessEventId
  },
  lifecycle: {
    startedAt,
    endedAt,
    durationMs,
    status
  },
  actor: {
    type,
    id
  },
  provenance: {
    source,
    origin,
    observedBy,
    confidence,
    cause: {
      uiActionId,
      toolCallId,
      harnessId,
      harnessRunId,
      harnessEventId,
      automationRunId,
      auditQueryId
    }
  },
  context: {
    scope,
    viewId,
    panelId,
    activeTabId,
    activeDocumentPath,
    activeResourcePath,
    selectedResourceId,
    route
  },
  chat: {
    seq,
    savedAt,
    reason,
    partial,
    turnEventId,
    exchangeSavedEventId,
    // Finding 8 / CHAT-D01 must decide derivation vs redaction-surviving summary.
    hasToolCalls,
    contextUsage,
    tokenUsage,
    runtime: {
      harnessId,
      harnessRunId,
      harnessEventId,
      provider,
      model,
      nativeRefs: {
        opencode: {
          sessionId,
          providerRunId,
          nativeEventId,
          messageId
        }
      },
      planMode
    }
  },
  resources: [],
  // Finding 4 / CHAT-D01 candidate; not registered until its relationship to
  // shared resources[] roles and authority/derivation rules are approved.
  chatResources: {
    attachments: [],
    mentions: [],
    mutations: [],
    resourceEventIds: []
  },
  tools: [],
  redaction
}
```

## Resource Mutation Entries

Resource mutations attached to a chat exchange should record both path facts and attribution facts:

```js
{
  eventId,
  resourceEventId,
  resourceId,
  resourceType,
  path,
  oldPath,
  observerEventType,
  operation,
  observedAt,
  confidence,
  causeIds: {
    toolCallId,
    uiActionId,
    harnessId,
    harnessRunId,
    harnessEventId,
    triggerRunId,
    schedulerRunId,
    scriptRunId,
    automationRunId,
    agentRunId,
    auditQueryId
  }
}
```

Watcher-observed mutations should not claim direct causation without accepted proof. If a future canonical chat projection includes compact `causeIds` from a resource event, each target/source pair requires an explicitly registered `acceptedPayloadPointer` binding against that live ref or revalidated historical capability; whole-object or raw-pointer copying is forbidden. Correlation alone never upgrades to causality.

`causeIds` is a compact projection alias. Its registry entry must declare exact source pointers, member equivalence, presence, and redaction behavior; it does not create new cause semantics. Trigger/scheduler/script/agent members remain `AUT-D03`/finding-1 candidates.

Legacy collectors may still emit `event` during migration. New schema readers should map that value to `observerEventType`.

`connectionId`, `clientId`, and receiver connection IDs remain transport/routing state, not first-slice canonical chat context or ledger fields. They are not authorization, user identity, or causal identity. The server may use its own routing state in non-canonical diagnostics without requiring the renderer to echo it or making prompt acceptance depend on it.

## Tool Call Metadata

Tool calls should be queryable from exchange metadata even when the visible assistant parts change. Store compact per-tool summaries:

```js
{
  toolCallId,
  parentToolCallId,
  name,
  canonicalName,
  providerName,
  category,
  startedAt,
  endedAt,
  durationMs,
  status,
  isError,
  declaredTargets: [],
  read: [],
  written: [],
  deleted: [],
  renamed: [],
  returned: [],
  resourceEventIds: []
}
```

Compact tool resource buckets remain finding-4 candidates; they do not mirror canonical schema until the owner decides their relationship to shared `resources[]` and SPEC-40 registers the projection. Domain `fileVersionIds` remains absent until the owning file-version relationship schema, accepted-reference binding, bounds, and registration are approved.

## Tool Event Linkage

Canonical tool-call events are defined in [Tool Call Provenance Schema](../002-Tool_Call_Provenance_Schema/PAGE.md). Chat metadata stores stable IDs/native refs only from an accepted canonical tool reference. If tool-event publication fails, it may retain a non-ID summary/diagnostic but must not persist rejected IDs. For shell, write, edit, and patch tools, resource inference should prefer explicit parsed arguments, then declared result files, then watcher correlation as a fallback.

## Query Goals

This schema should support questions like:

- Which chat turn changed a file?
- Which tool call produced this mutation?
- Was the mutation attribution direct, correlated, inferred, or unknown?
- Which files were read or written during an exchange?
- Which failed tool calls were followed by edits to the same path?
- Which UI context was active when the user sent the prompt or tool-producing action?
- Which ledger events and future file versions belong to this turn?

## Known Gaps To Close

- Pending audit state should be keyed by turn identity, not only thread identity.
- File mutation events need workspace identity before they can be safely correlated across active workspaces.
- Chat/tool events need durable ledger records, not only rendered assistant parts.
- File-change metadata must not default actor attribution to `user` when the watcher only observed a change.
- Tool events should preserve canonical harness IDs, provider-keyed `nativeRefs` or provider-specific payloads, approved outcome/redaction metadata, and target resources. OpenCode-specific IDs stay in native refs, not top-level canonical fields. `TOOL-D01` must close before `chat.tool.args|result` registration defines args/result redaction, exit/signal/outcome normalization, output byte/truncation/external-storage metadata, branches, and bounds. Argument/output hashes remain omitted as `policy_unapproved` until ULV-D10 or a separate owner-approved tool hash policy is closed.
- Finding 3 must select the unified captured-output extension contract jointly with `TOOL-D01`/`AUT-D01`; chat metadata cannot invent its own output metrics.
- Finding 4/`CHAT-D01` must settle `chatResources` authority and derivation relative to `resources[]`.
- Finding 8/`CHAT-D01` must settle whether `chat.hasToolCalls` is a pure derivation or an independently retained redaction-safe summary.
- Nested metadata needs validation and redaction rules before broad write paths depend on it.
