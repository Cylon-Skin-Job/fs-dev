# SPEC-36 - Harness, Tool, and Native Reference Provenance

Status: DISCUSSION DRAFT

Schema correction authority: [2026-07-15 provenance cross-article findings](provenance-schema-findings.md) plus owner direction in chat on 2026-07-15. The end state favors reusable shared blocks and registered extensions; decision-tagged details remain open.

## Mission

Normalize harness and tool-call events into provider-neutral provenance records while preserving provider-native IDs for replay, dedupe, debugging, and audit trails.

The first connected harness is OpenCode, but the implementation must not make OpenCode IDs canonical Universal Ledger fields.

## Wiki Sources

- [Events Provenance Model](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md)
- [Tool Call Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/002-Tool_Call_Provenance_Schema/PAGE.md)
- [Chat Metadata Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/001-Chat_Metadata_Provenance_Schema/PAGE.md)
- [Resource Mutation Provenance Schema](../../Wiki/010-Events_And_Ledger/003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md)
- [Events And Ledger Decisions](../../Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md)

## Related Specs

- [SPEC-32 - Resource Event Sync Controller](32-resource-event-sync-controller.md)
- [SPEC-33 - Universal Ledger File Versioning and Provenance](33-universal-ledger-file-versioning.md)
- [SPEC-35 - Universal Ledger Storage, Edges, and Indexes](35-universal-ledger-storage-edges-indexes.md)
- [SPEC-40 - Provenance Schema Registry and Event Validation](40-provenance-schema-registry-validation.md)

## Scope

This spec covers canonical harness identity, tool-call events, native reference preservation, tool-resource extraction, and links from tool calls to chat turns, resource mutations, file versions, and ledger edges.

It does not define the chat UI, chat transcript storage, model selection, or tool execution semantics. It records what the harness and tools did in a way other systems can query.

## Open Owner Decision

| ID | Decision | Status / Required contract |
|---|---|---|
| TOOL-D01 | What is the exact canonical tool args/result/outcome/redaction contract? | OPEN - OWNER APPROVAL REQUIRED before SPEC-40b2b registers any `chat.tool.args|result` branch or any SPEC-36 slice emits/persists those fields. Define: (1) measured args/result/output domains, including provider-native result, normalized result, stdout, stderr, rendered content, or a combination; (2) tool-specific mapping into the owner-selected unified captured-output extension contract required by AUT-D01/provenance finding 3, whose exact shared-block choice/name/shape remains open; (3) deterministic normalization/encoding, hash, byte-count, truncation, external-storage, and redaction primitives without parallel tool-only names; (4) exact argument/result redaction policy IDs/versions, sensitive-data detection scope, top-level `redaction` relationship, omission vocabulary, registered failure-safe core or no-event behavior, and prevention of unsafe resource/result extraction; (5) provider exit code/signal/error normalization into exact canonical fields, `isError`, and `lifecycle.status`, including absent exit codes, spawn failure, provider error, cancellation, timeout, and transport loss; (6) exact `started|args|result` plus success/error/cancel/timeout/partial-stream presence matrix, including omitted versus `null|0|false`; (7) qualifying external-artifact proof and non-ID omission behavior; (8) unavailable/streaming/partial/failure behavior and bounded args/result metadata; and (9) tests proving observation/redaction failure never changes tool execution, streaming, result delivery, or operational provider routing. Hash input/algorithm remains blocked by the owner-approved hash policy. SPEC-36a audit and preparatory harness-identity/native-ref work may proceed without claiming args/result registration complete. |
| TOOL-D02 | What is the exact canonical harness identity and optional `chat.tool.started` contract independent of args/results? | OPEN - OWNER APPROVAL REQUIRED before 40b2b registers or activates any harness or started event, before accepted harness/tool refs exist, and before 36e persists that branch. Define exact event types/phases/lifecycle presence; current-record `harnessId`/`harnessRunId`/`harnessEventId`/`toolCallId` ownership and equality rules; actor/source/origin/observer values; provider/native-ref allowlist and redaction policy ID/version; safe-core versus no-event failure behavior; deterministic string/native-ref/array/serialized-byte bounds and overflow; ordering, sequence, dedupe, replay/reconnect/cancel behavior; accepted-only chat/upstream relationships; and fail-open tests. Slices 36a-36c remain inert evidence/helpers until this decision closes and is back-validated. |

## Canonical Identity

The names below are proposed provider-neutral vocabulary, not active canonical fields. `TOOL-D02` must approve their exact current-record ownership, equality, presence, and lifecycle branches before 40b2b registration or publication.

Canonical harness fields:

```js
{
  ids: {
    harnessId,
    harnessRunId,
    harnessEventId
  },
  tool: {
    toolCallId,
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
    }
  }
}
```

Rules:

- `harnessId` identifies the adapter or harness integration.
- `harnessRunId` identifies one durable harness invocation/session/run as normalized by the adapter.
- `harnessEventId` identifies one adapter-normalized event from that run.
- Provider-native IDs stay under `nativeRefs.<provider>`.
- Do not add `openCodeRunId`, `openCodeEventId`, or `openCodeSessionId` as canonical ledger columns.
- Do not add `opencode` as a provenance origin type.
- Raw provider/harness/tool IDs used by the runtime are not automatically publishable causes. The normalizer returns an accepted harness/tool reference only after the corresponding canonical event is accepted. Downstream canonical candidates receive IDs, ID-bearing origin, mirrors, and edge targets only through registered `prepareCanonicalCandidate` bindings that consume that ref; copying an inspected string is insufficient. On normalization/validation/publication failure, runtime behavior continues and downstream provenance uses an honest origin type without the rejected/unpublished IDs.

## Event Shapes

These shapes are design candidates only. `TOOL-D02` owns exhaustive harness/started registration and `TOOL-D01` owns args/result/outcome extensions; no implementation may infer optionality, redaction, bounds, or failure behavior from the examples.

### Harness Event

Harness lifecycle events use the common envelope with:

```js
{
  eventFamily: 'chat',
  eventType: 'chat.harness_event',
  ids: {
    harnessId,
    harnessRunId,
    harnessEventId,
    threadId,
    turnId
  },
  provenance: {
    source: { type: 'harness-adapter' },
    origin: { type: 'harness', id: '<harnessRunId>' },
    observedBy: { type: 'harness-adapter' },
    confidence: 'direct'
  },
  harness: {
    harnessId,
    harnessRunId,
    harnessEventId,
    provider,
    nativeRefs: {}
  }
}
```

### Tool Call Event

Tool calls use `eventFamily: 'chat.tool'` and the full common envelope defined by the wiki. The example below shows the intended persisted shape with emphasis on the tool-specific fields. The `chat.tool.args|result` branches are not registration-ready until `TOOL-D01` closes:

```js
{
  schemaVersion,
  eventId,
  eventFamily: 'chat.tool',
  eventType: 'chat.tool.started' | 'chat.tool.args' | 'chat.tool.result',
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
    nativeRefs,
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
    // TOOL-D01 + AUT-D01 must approve the owner-selected unified captured-output
    // extension contract (including whether it is one shared block) before
    // any args/result hash, byte, truncation, redaction, or storage field appears.
    resourceEventIds: [],
    // Future projection only; absent until file-version relationship registration.
    fileVersionIds: []
  },
  // Candidate sidecar only; finding 4 must settle its relationship to resources[].role.
  toolResources: {
    declaredTargets: [],
    read: [],
    written: [],
    deleted: [],
    renamed: [],
    returned: []
  },
  resources: [],
  redaction
}
```

## Tool Resource Extraction

The adapter should extract resource references in this priority order:

1. Explicit structured tool arguments.
2. Declared result files or provider result metadata.
3. Known tool semantics, such as edit/write/delete commands.
4. Watcher correlation using canonical resource events from SPEC-32, with correlation heuristics owned by SPEC-33/SPEC-35, when the tool caused filesystem changes but did not declare outputs.

Watcher correlation is never upgraded to direct confidence unless the tool call, server mutation ID, or harness event gives direct causation.

## Ledger Edges

The ledger writer from SPEC-35 creates these edges only from accepted canonical harness/tool references:

- `caused_by` from tool event to chat turn or harness event only after `LED-D03` approves the exact pointer/domain/confidence branch; accepted identities alone do not authorize it.
- `read`, `wrote`, or `mutated` edges from tool events to resources or resource mutation events.
- `versioned_as` edges from resource mutation events to file version events.
- `observed_by` edges from watcher-observed resource mutations to the watcher/subsystem observation. Tool correlation belongs in SPEC-33/SPEC-35 correlation evidence. A `caused_by` edge remains prohibited until `LED-D03` approves the exact pointer/confidence matrix; accepted tool identity alone is not causal proof. Do not use `observed_by` to point at tool calls.
- `queried` or `reviewed` edges later when audits inspect tool events.

## Redaction and Output Policy

After `TOOL-D01` closes, the applicable args/result slices store only the approved branches:

- Tool name and normalized category.
- The approved argument/result redaction state and failure-safe behavior.
- The approved owner-selected unified captured-output extension contract plus normalized exit/outcome fields. Tool-specific mappings may not independently redefine shared hash, byte, truncation, redaction, omission, or external-storage semantics; finding 3 still owns the exact block/name/shape choice.
- No argument or output hash is stored until the shared owner-approved hash policy defines allowed inputs, algorithm, secret/redaction treatment, and persistence.
- Structured resource references when safe.

`toolResources` remains a finding-4 candidate, not a registered second resource vocabulary. `fileVersionIds` is absent from canonical tool records until the owning file-version relationship, accepted-reference binding, bounds, and schema registration are approved; an empty array in an example is not early authorization.

Full tool output should not be persisted broadly by this spec. A SQL/runtime output row key is always query/storage-only and never enters canonical tool JSON, even when its owning write has an accepted ref. After `TOOL-D01` closes, a separately registered canonical output artifact/event may contribute its canonical event/domain/content ID and edge through SPEC-40; otherwise the approved branch may record a non-ID external-storage observation at the approved location plus a non-ID omission diagnostic. That observation never contains or proves a row/artifact ID. No derived hash is computed or persisted before the hash policy is approved.

Harness/tool provenance is observational. Missing native refs, resource extraction, hashes, byte counts, redaction metadata, or ledger availability does not block tool execution, harness streaming, result delivery, or chat rendering. The adapter records explicit omissions or diagnostics and preserves honest unknown attribution. If redaction cannot safely process output material, omit the material and any future policy-approved derived hash/preview while retaining the non-sensitive event core when possible.

A provider tool-call ID may still be operationally required by the harness protocol to route a tool result. That protocol check is separate from copying the ID into canonical provenance or ledger projections; a later provenance/storage failure cannot change the already-determined tool execution result.

Failure-injection tests must prove that normalization/validation/publication failure does not block tool/harness execution and does not leak raw IDs into downstream causes, ID-bearing origin, mirrors, native-ref projections, or ledger edges.

Required only in the later activation/integration slice after the applicable 40b2b registration: `cd fusion-studio-server && npm test -- --runInBand test/provenance/harness-tool-cause-propagation.test.js`.

## Migration Slices

### Slice 36a - Harness Event Audit

Inventory current OpenCode adapter output, canonical chat event applier behavior, tool render metadata, argument/result shapes, every output/result representation and truncation layer, stdout/stderr/signal/exit handling, redaction timing/policies/failures, byte-count source, external output storage, resource extraction, and phase/success/error/cancel/timeout/transport-loss branches. Record evidence for `TOOL-D01`; do not choose its semantics during implementation.

### Slice 36b - Canonical Harness Identity

Preparatory only while `TOOL-D02` and 40b2b harness/tool registration are absent: implement/test inert internal types and pure normalization helpers for `harnessId`, `harnessRunId`, and `harnessEventId` against 36a evidence. Do not mutate active adapter/chat/tool payloads, publish canonical events, expose accepted refs, or persist fields in this slice. Activation requires owner-approved/back-validated D02 and the exact owning 40b2b harness registration.

### Slice 36c - Native Ref Preservation

Preparatory only: implement/test a pure provider-native ref normalizer that can later produce the proposed `nativeRefs.opencode` branch. Do not change active payloads or ledger indexes. Canonical projection requires the exact owning 40b2b registration/redaction contract; ledger native-ref indexes require SPEC-35 ingestion for that registered safe branch.

### Slice 36d - Tool Resource Extraction

Blocked until `TOOL-D01` is owner-approved/back-validated and the exact `chat.tool.args|result` branches are registered in 40b2b. Then add only the approved redaction-safe structured resource extraction from args/results before watcher correlation, with the approved bounds/failure behavior. No pre-decision active extractor may infer or publish resources from sensitive args/results.

### Slice 36e - Ledger Links

Activation/persistence is branch-specific. Harness identity or `chat.tool.started` requires owner-approved/back-validated `TOOL-D02`, its exact 40b2b registration, and SPEC-35 accepted-delivery ingestion/native-ref/edge support. `chat.tool.args|result`, their resource extraction, and corresponding edges additionally remain blocked until `TOOL-D01`; hashes remain separately blocked by ULV-D10 or an approved tool hash policy. This slice excludes every `caused_by` edge unless `LED-D03` is owner-approved/back-validated for the exact pointer/domain/confidence branch and SPEC-35 implements that approved matrix; other approved noncausal edges may proceed independently. Run the cause-propagation check only for branches actually activated and report every deferred branch.

### Slice 36f - File Version Links

Blocked until the relevant 40b2b tool/harness branch, SPEC-35 edges, SPEC-33 file-version slice, and applicable ULV decisions exist. Then allow SPEC-33 to traverse accepted resource mutations/file versions back to activated tool/harness events; do not add direct links for preparatory-only identities.

## Completion Criteria

- Tool calls are durable ledger events, not only render metadata.
- Harness identity is provider-neutral.
- OpenCode-native IDs are preserved without becoming canonical fields.
- Resource reads/writes can be linked to tool calls when evidence exists.
- Tool-caused file versions can be traversed from file version to resource mutation to tool call to chat turn.
- Accepted-reference and failed-publication tests prove tool/harness execution continues while raw/rejected IDs remain absent from downstream origin, causes, mirrors, native projections, and edges.
- Redaction failure omits unsafe args/output material and derived hashes/previews without blocking tool execution or result delivery.
