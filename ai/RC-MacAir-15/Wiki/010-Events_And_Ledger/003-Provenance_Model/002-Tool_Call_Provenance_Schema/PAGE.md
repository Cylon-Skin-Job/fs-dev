---
name: Tool Call Provenance Schema
description: Schema guidance for connecting canonical tool calls to chat turns, resources, ledger events, file versions, and audits.
metadata:
  incoming-edges:
    - Events Provenance Model
    - Chat Metadata Provenance Schema
  outgoing-edges:
    - Chat Metadata Provenance Schema
    - Resource Mutation Provenance Schema
    - Ledger Event Provenance Schema
  source-files:
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-server/lib/harness/opencode/index.js
  connected-skills: []
  related-trigger-files: []
---

> **Schema correction authority (2026-07-15):** Apply the [provenance cross-article findings](../../../../Captures/008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat. Decision-tagged output and resource-sidecar choices remain open.

Use this page before changing canonical tool-call events, harness translators, tool rendering metadata, or tool-to-resource attribution.

Tool-call provenance covers the boundary from provider/harness tool events into canonical chat events, UEB, exchange metadata, resource mutation correlation, and ledger records.

## Boundary

Tool calls should be identifiable independently of rendered assistant text. They should connect to the chat turn that produced them, the provider/native event that reported them, resources they targeted or changed, and ledger/file-version records created later.

Open owner decision `TOOL-D02` blocks canonical harness identity and `chat.tool.started` registration/activation until exact phase/lifecycle presence, current-record IDs, actor/provenance, native-ref redaction/failure behavior, bounds, ordering/dedupe/replay/reconnect/cancel semantics, relationships, and fail-open tests are approved. `TOOL-D01` separately blocks args/result/outcome branches. Until D02 closes, identity/native-ref helpers are inert and no accepted harness/tool ref or persisted canonical started event exists.

## Domain Payload

The following is a design candidate, not an executable registration contract. `TOOL-D02` must settle the exact harness/started branches and `TOOL-D01` the args/result/outcome extensions; no implementation may infer presence, bounds, redaction, or lifecycle behavior from this example.

```js
{
  schemaVersion,
  eventId,
  eventFamily: 'chat.tool',
  eventType,
  eventPhase: 'start' | 'args' | 'result',
  occurredAt,
  lifecycle,
  ids,
  actor,
  provenance,
  context,
  tool: {
    toolCallId,
    parentToolCallId,
    harnessId,
    harnessRunId,
    harnessEventId,
    provider,
    nativeRefs: {
      opencode: {
        providerRunId,
        nativeEventId,
        sessionId,
        messageId
      }
    },
    name,
    canonicalName,
    providerName,
    category,
    sequence,
    argsChunkSeq,
    argsComplete,
    argsRedaction,
    isError,
    exitCode,
    // TOOL-D01 + AUT-D01 + finding 3 must approve the owner-selected unified
    // captured-output extension contract before any output metrics appear.
    resourceEventIds: [],
    // fileVersionIds remains absent until its owning relationship registration.
  },
  resources: [],
  // Finding 4 candidate; not registered until its resources[] relationship is approved.
  toolResources: {
    declaredTargets: [],
    read: [],
    written: [],
    deleted: [],
    renamed: [],
    returned: []
  },
  redaction
}
```

Tool names should use `tool.name`, `tool.canonicalName`, and `tool.providerName`. Avoid standalone `toolName` fields. Compact summaries may project those canonical fields as `name`, `canonicalName`, and `providerName`.

Harness IDs are canonical and provider-neutral. Provider-specific IDs from OpenCode or another harness belong under provider-keyed `tool.nativeRefs`; do not add canonical fields such as `openCodeRunId` or `openCodeEventId`.

Operational provider IDs are not automatically publishable causes. Downstream events use tool/harness IDs, ID-bearing origin, mirrors, and ledger edges only from a canonical harness/tool event that was accepted. If normalization, validation, or publication fails, tool execution/result delivery continues and downstream provenance omits those rejected/unpublished IDs.

SQL/runtime output row keys are always query/storage-only and never enter canonical tool JSON. A separately registered canonical output artifact/event may contribute its canonical event/domain/content ID and edge through SPEC-40 proof. Any future external-storage observation approved by `TOOL-D01` is non-ID metadata and never contains or proves that row/artifact identity.

`toolResources` is not yet a canonical second resource vocabulary. Finding 4 must settle whether it becomes a registered sidecar or is folded into shared `resources[]` roles, including authority, derivation, and redaction rules. `fileVersionIds` remains absent until the owning file-version relationship schema, accepted-reference binding, bounds, and registration are approved.

## Connections

- Chat metadata stores compact tool summaries in `tools[]`.
- Resource mutation events can point back to `provenance.cause.toolCallId` when an accepted canonical tool event directly caused a change.
- File versions link to the source resource event through builder-proven `createdFromResourceEventId`, parent event ID, correlation, and `versioned_as`, then traverse that accepted resource event for earlier tool/UI/automation attribution. They may project safe non-ID context/type/confidence but do not transitively copy embedded root/causation, actor/origin IDs, or causes without separately held original proof.
- UI context comes from the prompt/send action that initiated the turn through `provenance.cause.uiActionId` and `context`.
- Audits can query tool-to-file chains, failed tool calls followed by edits, and provider/runtime behavior by turn.

## Gaps To Close

- Tool events are emitted for rendering but are not consistently recorded in the ledger.
- Resource inference from args, result payloads, and watcher events is not normalized.
- Provider-native IDs, exit codes, redaction state, and target resources are not durable enough for later audits. Argument/output hashes remain absent until the owner-selected unified captured-output contract and applicable hash/redaction policy define safe inputs, algorithm, redaction treatment, and persistence.
- `TOOL-D01` requires owner approval before any `chat.tool.args|result` registration/persistence: jointly with `AUT-D01` and finding 3, select the unified captured-output extension contract (including whether it is one shared block), then define exact tool mapping; args/result/output domains and normalization/encoding; redaction policy IDs/versions, detection, shapes, omissions, failure-safe/no-event behavior, and safe resource extraction; byte/truncation measurement and layer semantics; exit code/signal/provider error normalization into `isError`/`lifecycle.status`; complete phase/outcome presence; external-artifact qualification without row-ID leakage; unavailable/partial/stream/error/cancel/timeout behavior and bounds; and fail-open tests. This does not block the first Wiki/File resource/render package.
