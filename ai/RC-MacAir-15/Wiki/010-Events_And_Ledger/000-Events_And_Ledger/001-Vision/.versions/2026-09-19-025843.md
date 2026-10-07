---
name: Events And Ledger Vision
description: Product and developer goals for event provenance, ledger history, file versioning, render/resource sync, and future assistant-led system analysis.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Chat Harness And Event Flow
    - Universal Event Bus Standards
    - Resource Event Sync Controller
    - Universal Ledger File Versioning and Provenance
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Fusion Studio should be able to explain what happened inside itself.

The ledger is not just a log. It is the beginning of a system knowledge graph:
chat turns, tool calls, UI actions, triggers, scheduler runs, file mutations,
resource refreshes, render invalidations, version snapshots, and review outcomes
should connect through durable IDs and provenance metadata.

## Product Goals

- A user can ask why a file changed and trace the answer to a UI action, tool
  call, trigger run, scheduler script, or unknown external change.
- A user can restore a file version even when the relevant harness context is
  buried, lost, interrupted, or unrelated to Git status.
- A user can inspect whether a failure came from the assistant, a trigger,
  a scheduler, an external editor, a filesystem operation, or app UI behavior.
- File and folder changes can refresh rendered views without destroying the
  current DOM, selection, scroll, active tab, or navigation state.
- Future background workers can review conversations, tool calls, file changes,
  and outcomes to surface concrete improvement suggestions.
- Future self-improvement loops can evaluate whether agents followed prompts,
  whether skills would be better than ad hoc instructions, and where the app can
  optimize repeated workflows.

## Developer-Level Principles

- Events are facts after something happened. Commands may cause events, but the
  Universal Event Bus is not a request/response API.
- Provenance must separate observation from causation. Chokidar can observe a
  file change; it usually cannot prove who caused it.
- Direct initiators should carry durable IDs in `provenance.cause`: UI action
  IDs, tool call IDs, harness ID/run/event IDs, trigger run IDs, script run IDs,
  scheduler run IDs, automation run IDs, agent run IDs, or audit query IDs.
  Chat thread IDs, chat turn IDs, resource event IDs, root/parent event IDs, and
  correlation IDs belong under `ids`, domain payloads, or ledger edges.
- Unknown external changes should stay honest. If a change was not linked to UI,
  assistant, trigger, scheduler, script, or known system work, the ledger should
  mark it external or unknown instead of guessing.
- Resource/render sync and file versioning should consume the same canonical
  events. Views should not build isolated listener paths that drift from ledger
  provenance.
- Ledger subscribers can filter, compact, and summarize. Producers should
  preserve facts and avoid discarding metadata before subscribers can decide what
  matters.
- High-frequency file changes need storm control. The system must preserve that
  a storm happened without flooding the ledger or future assistant context.

## Event Graph Vision

The durable graph should eventually support paths like:

```text
file version
  -> resource mutation event
  -> tool call id
  -> chat turn
  -> thread
  -> related mutations
  -> earlier/later versions
  -> likely cause or regression explanation
```

and:

```text
button_click:send_to_chat
  -> view:capture-viewer
  -> active document
  -> chat attachment metadata
  -> generated tool calls
  -> resulting file mutations
```

and:

```text
trigger run
  -> script execution
  -> output files
  -> wrong destination
  -> restore or corrective action
```

## Near-Term Boundary

The immediate resource-sync work should not build the full ledger, but it must
not block it. Resource events need stable IDs, clear observed-by/provenance
fields, workspace and path identity, known causal IDs, and enough before/after
metadata for future versioning.

The full ledger/versioning work can follow as a separate build once the event
contract is stable enough to consume.

## Why This Matters

Without meticulous event categories, future sessions will need the same context
dump repeatedly. With them, the system can answer from its own history:

- What changed?
- Who or what caused it?
- Which view or document was active?
- Which tool call, chat turn, trigger, or script was involved?
- What changed before and after?
- Which nearby change likely caused the failure?
- Should this become a rule, a skill, a trigger, a UI affordance, or a code fix?
