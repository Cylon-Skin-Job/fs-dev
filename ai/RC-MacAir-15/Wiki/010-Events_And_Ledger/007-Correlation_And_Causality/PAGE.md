---
name: Events Correlation And Causality
description: Interpret durable operation links, reported UI context and observed resource history without turning temporal association into causal proof.
metadata:
  source-files:
    - fusion-studio-server/lib/file-mutations/fact-reservation-bindings.js
    - fusion-studio-server/lib/file-mutations/reported-ui-context.js
    - fusion-studio-server/lib/ledger/resource-provenance-repository.js
    - fusion-studio-server/lib/ledger/event-ledger.js
    - fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
    - fusion-studio-server/lib/agent-provenance/checkpoint-repository.js
    - fusion-studio-server/lib/agent-provenance/agent-ledger-repository.js
  last-modified: "2026-09-19T11:52:20Z"
---

Status: source inspected on 2026-09-19 in the development checkout. Current behavior below is the bounded implementation, not a fresh runtime result. Existing test assertions were inspected, not rerun; installed Alpha was not checked.

## Current evidence and its meaning

The mediated save knows its owning command and replacement attempt. `operationId`, `commandId`, `commandAcceptedEventId`, resource identity and preimage identity are derived from durable reservations, not a caller's invented causal graph. The ledger uses the operation as `correlation_id` and leaves `causation_id` null. This is strong evidence of Fusion's own save workflow, while the transport-only local connection remains an unauthenticated origin.

Optional `origin.reportedUiContext` records the reported workspace/view/tab/component/presenter/target at save time. The server derives workspace authority and bounds the context; it does not authenticate a human, verify that a tab caused the operation or turn `targetKey` into physical path authority. Unknown fields and malformed/oversized values are omitted or degraded without denying valid work; a mismatching workspace echo drops the context. The renderer omits tab fields from an unavailable or nonmatching connected owner, but the server does not verify that a syntactically valid tab/component ID still exists. Missing context stays missing. Historical context survives a tab's disappearance and does not write back to live tab state. See [Resource Mutation Provenance Schema](../003-Provenance_Model/003-Resource_Mutation_Provenance_Schema/PAGE.md).

Agent activity IDs and resource edges connect a reported tool invocation to a later bounded observation. First/changed/unchanged refers to the previous observed checkpoint, not a verified before/after interception of that tool. A post-tool hash, write-like argument or matching path does not prove a successful write or sole authorship; another writer can act between checkpoints. Observation ledger rows retain source linkage with null causation. Keep reported provider clocks distinct from server observation clocks and record absence/failure instead of inventing an earlier image.

## Legacy correlation is separate

The legacy `file:changed` collector can associate an independently supplied change with an active turn only when workspace/root match and either the full epoch/thread/turn tuple matches or exactly one eligible turn exists for that workspace/root. Partial turn identity is rejected; ambiguous overlapping turns are not guessed. Its `fileMutations` metadata remains an association, not a governed tool-to-mutation proof. The generic workspace watcher that previously supplied broad external changes is retired, so this collector no longer promises general external file observations.

The legacy ledger ignores `file:changed`, so its former fallback actor attribution no longer applies. An independent observation still could not establish a human or assistant cause from timing alone.

## Approved direction and open contracts

Record useful independent facts even when causality is unknown. Prefer verified operation linkage where the owner actually has it, and label reported/observed/inferred evidence honestly. Do not require the old proposed accepted-reference API or confidence verdict before recording the accepted save/agent facts.

General UI-action/tool/harness/automation causal graphs, confidence policies and cross-domain proof interfaces remain future contracts. The earlier priority list of possible causes was a proposal, not a runtime resolver. A future correlation feature must define its evidence and uncertainty explicitly; it must not promote time proximity, a raw provider ID or an embedded upstream ID into direct causation.
