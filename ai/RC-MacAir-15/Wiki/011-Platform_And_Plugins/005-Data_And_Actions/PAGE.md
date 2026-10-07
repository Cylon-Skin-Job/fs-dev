---
name: Data Sources, Commands And Outcome Facts
description: Explains app-owned content versus System storage and the distinct mutation, provenance and recovery boundaries.
metadata:
  source-files:
    - fusion-studio-server/lib/file-mutations/save-controller.js
    - fusion-studio-server/lib/file-mutations/fact-replay.js
    - fusion-studio-server/lib/file-mutations/fact-reservation-bindings.js
    - fusion-studio-server/lib/file-mutations/reported-ui-context.js
    - fusion-studio-server/lib/subscriptions/admission.js
  last-modified: "2026-09-23T13:50:37Z"
---

A presentation component displays data and offers actions. Its host placement does not make it the owner of that data or give it permission to change the source. The approved model supports local files, CSV/JSON, application-owned SQLite and authorized connectors while keeping controlled access and mutations with their owning services and adapters.

## Content and System have different owners

Application files and separate workspace SQLite databases are application content. Connected applications remain authoritative for their live content. `fusion.db` is platform System storage for Fusion configuration, controls and durable history, including chat, ledger, provenance and recovery records. The filesystem `System/` tree and the database are related ownership surfaces, not identical stores; this boundary does not require every existing file-backed setting or view state to move into SQLite.

Plugins use defined interfaces and approved capabilities. They cannot use System as an application database, add arbitrary System tables, inherit an ambient database handle or grant themselves authority. A historical snapshot is an audit/recovery copy; restoring it is a separate permitted write to the authoritative source. This is approved direction, not a claim of complete enforcement or universal retention. The [System database boundary](../../002-Server_And_Runtime/PAGE.md#system-database-boundary) owns details and existing storage exceptions.

## Commands perform work and facts describe outcomes

A UI component emits intent through its host's explicit action. An authorized command reaches the existing server owner, which validates and performs the operation, using an adapter where source-specific translation is needed. A fact describes a transition that actually occurred: acceptance, a completed mutation, failure or observation. A command-accepted fact may precede mutation; it does not claim that the write succeeded. A logged tool call also does not prove a successful write.

The event bus distributes facts; it is not a transaction executor or a substitute for an owning command. A subscriber that needs further work must use an authorized operation with its normal validation. Presentation contributions acquire no raw bus or database capability merely by being registered. [Events And Ledger decisions](../../010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md) and the [Universal Event Bus standard](../../005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md) own the exact distinctions among commands, admission, delivery, persistence and client freshness.

## Current source-inspected save boundary

The inspected `save-controller.js` reserves a mediated save operation, reads the eligible preimage and calls durable preparation before invoking replacement. Required operation/preimage protection failure prevents mutation. This is the bounded mediated `file_save` path, not a guarantee for every filesystem operation, external store or tool write; its eligibility and failure contracts remain with [Events And Ledger](../../010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md#accepted-implementation-boundaries).

Optional reported UI context has a different role. The controller passes it through `originFromInput` in `fact-reservation-bindings.js` to `sanitizeReportedUiContext` in `reported-ui-context.js`. Malformed or oversized fields degrade or disappear, and a mismatching workspace echo is omitted without denying an otherwise valid save. This context is observational information, not authorization or authenticated human attribution.

After replacement, `finishSuccess` and `fact-replay.js` handle resource-fact publication separately from the source-write result. The replay path only attempts a mutation fact for a succeeded operation and tracks publication/projection trouble for recovery. A successful write may carry pending provenance rather than being reported as if no write occurred. A genuinely uncertain replacement outcome has its own recovery state; do not translate that into confirmed success or safe blind retry.

The inspected admission module seals four trusted built-in publisher identities for save and agent-observation facts. It verifies reserved input and schema before private delivery; that bounded route is not a general plugin publisher factory. Admission alone does not prove delivery, ledger storage or renderer receipt. These are source-inspected observations of the named producer/consumer routes, not a runtime verification or a universal atomicity guarantee.

## Keep protection and observation distinct

Required prewrite protection, optional context and postwrite recovery must remain separate when another adapter is designed. The [authoritative timing rules](../../005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md#failure-timing-and-required-protection) reject a blanket rule that provenance can never delay work. They also reject treating a postwrite subscriber problem as an undo of completed source work.

Post-tool observations cannot manufacture a pre-tool image or establish causation from timing alone. Save preimages and observation checkpoints have different coverage; neither is a universal history/restore service. General external-store failure, retry, transaction and provenance integration remain adapter-specific work under [open choices](../000-Platform_And_Plugins/001-Decisions/PAGE.md#open-choices-and-decision-gates), without cross-store atomicity promises. [Unfinished Work](../000-Platform_And_Plugins/002-Unfinished_Work/PAGE.md) owns the platform gap route. Return to [Tabs, Drawers And Files](../004-Tabs_Drawers_And_Files/PAGE.md) for presentation ownership or continue to [Custom Iframe Composition](../006-Custom_Iframe_Composition/PAGE.md) for the narrow-operation target.
