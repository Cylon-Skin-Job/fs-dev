# SPEC-02 — Governed UEB Subscription Controller

**Status:** `CANDIDATE — OWNER APPROVAL REQUIRED`  
**Prerequisite:** Owner-accepted SPEC-01  
**Mission:** Add a simple schema-validating fact-admission path to the existing UEB, then compile effective registry rows into one in-memory subscription generation that dispatches admitted facts through scoped, declarative filters to allowlisted built-in handlers.

## Applicable Code Standards

- Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- Routed pages:
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
  - `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`
- Approved supersessions: none. The UEB standards now encode the governed `publishFact` and bounded `required_ack` model used here.

## Observable Outcome

- the host composition root performs one mint-and-seal initialization before workspace/project modules or listeners start, using a closed producer/schema catalog; it injects an exact file-save publisher closure into the owning controller without exporting any generic publisher factory, producer selector, or catalog;
- the injected `publishFact({ reservation, body })` validates its fixed producer/schema and host-owned reservation, rejects identity fields inside `body`, assembles the envelope, deep-clones/freezes the admitted fact, and returns an exact delivery report without an accepted-reference lease;
- effective database rows compile into immutable runtime descriptors;
- exact event type plus closed resource operation/ingress-panel/kind predicates ignore irrelevant facts;
- handlers receive only a scoped context matching their granted capabilities;
- authority reductions remove their affected descriptors immediately; a complete set of additions/widenings/reconfigurations validates before atomic swap, and failed additive reload keeps only unchanged prior descriptors;
- disabled, pending, quarantined, revoked, invalid, ungranted, or unknown-handler entries receive nothing;
- one handler throw/rejection is diagnosed and does not stop later handlers or alter the source fact;
- MVP built-in handlers only persist or project through the exact capability methods in SPEC-01; they never receive raw DB, filesystem, sockets/session maps, EventEmitter, action-handler closures, fact emission, or command powers;
- TRIGGERS bus/file/cron behavior remains on its current direct compatibility paths and is not claimed governed.

## Runtime Contract

The admission boundary owns:

- schema lookup and exact validation;
- a closed built-in producer catalog; MVP contains only `system.file-save-controller` for `file.command_accepted@1` and `resource.mutated@1`;
- host event ID and `occurredAt` assignment either immediately or through the owning service's durable reservation repository;
- verification that a reserved identity belongs to the producer, schema, workspace, and operation before it is assembled with a body;
- deep clone/freeze and private accepted delivery;
- rejection diagnostics and a producer-visible false result;
- a result `{ admitted, eventId, deliveries[] }`, where each delivery names subscription/handler and reports `completed | invoked | failed | timed_out | skipped`, without exposing a capability object or payload;
- no serializable proof object, accepted-ref lease, causal capability, or historical proof.

The runtime exposes a one-time host bootstrap operation, not a string-selected factory. It mints publishers from a static catalog, injects the exact closure directly into each owning service, then irreversibly seals before any workspace-owned/dynamic module is loaded or any public socket begins accepting work. Duplicate or late bootstrap/mint attempts fail. Importing the public event-bus module after startup exposes legacy bus operations only and cannot acquire a publisher, name a producer, or enumerate publisher closures.

A raw candidate, WebSocket message, database row, legacy `emit`, project-loaded module, or arbitrary module import cannot select a producer, supply an event ID/timestamp in the body, or reach the private admitted-fact channel. SPEC-03's repository durably reserves both event IDs, the command-accepted timestamp, and—only after durable mutation success—the resource occurrence timestamp. Each opaque reservation is privately bound to the producer, schema version, workspace, operation, event ID, timestamp, and a canonical hash of every durable envelope/body input; changed replay input is rejected. The same injected producer closure can therefore replay the exact pending admission after restart without replacing an ID or time.

The controller owns:

- `start`, `stop`, `reload`, generation inspection, and diagnostics;
- schema version compatibility checks against SPEC-01;
- deterministic handler order from explicit priority plus subscription ID tie-break;
- capability construction from effective grants;
- at most one invocation per admitted event/subscription/admission attempt; an explicit replay of the same reserved event is delivered again and relies on subscriber idempotency;
- bounded diagnostic text without event payload dumping.

`required_ack` is permitted only for the locked `system.provenance-ledger` row. Its returned promise is observed for at most 2,000 ms. Success reports `completed`; rejection reports `failed`; the deadline reports `timed_out` and releases the source response while late settlement remains observed. Best-effort handlers report `invoked` once their call is safely started. Every eligible handler is still invoked in deterministic order after a sibling failure. Admission remains true even if delivery fails; the owning durable operation interprets the report and retains pending projection state for restart replay.

The MVP handles trusted built-in modules only. MVP-D14 explicitly supersedes the old `UEB-D01` arbitrary/untrusted executor and accepted-reference machinery for this scope. Handlers must return promptly and move database work to promises whose rejection is observed. A later untrusted-code runtime requires its own bounded executor SPEC.

## Compatibility Inventory

Before conversion, record every direct `on(...)` caller and classify it:

- migrated in this SPEC;
- migrated by SPEC-03 or SPEC-04;
- retained direct compatibility with named removal criteria;
- unrelated operational listener.

At minimum classify:

- `system.provenance-ledger` for same-SPEC handler/row/grant activation in SPEC-03;
- `system.resource-render-projection` for same-SPEC handler/row/grant activation in SPEC-04;
- all existing direct subscribers and TRIGGERS paths as retained compatibility with named removal criteria.

Do not claim all existing subscribers are governed if audit, transcription, workspace, wire, calendar, or other direct listeners remain.

## TRIGGERS Boundary

Do not change `trigger-loader.js` execution topology in this SPEC. In particular, do not pass editable workspace descriptors or current `actionHandlers` through a system-granted subscriber. The compatibility inventory must say that TRIGGERS is not yet governed. Its later migration requires one registry subject per executable definition and scoped named commands.

## Slices

### Slice 02a — Inventory, admission boundary, and compiler

Add the direct-listener inventory, sealed one-time host bootstrap, exact injected publisher closure, reservation verification, schema admission/private delivery, allowlisted handler catalog, filter parser/validator, scoped capability factory, and immutable generation compiler.

### Slice 02b — Controller lifecycle and subtractive-first atomic reload

Start after DB initialization, subscribe once, dispatch deterministically, isolate failures, stop cleanly, immediately remove invalidated authority, and swap only complete validated additive/reconfiguration generations.

### Slice 02c — Compatibility and failure acceptance

Prove legacy `emit/on` and TRIGGERS events cannot reach governed subscribers, preserve their current operational behavior, and exercise invalid admission, handler failure, reload, and shutdown.

## Expected Integration Areas

- new `fusion-studio-server/lib/subscriptions/`
- `fusion-studio-server/lib/startup.js`
- `fusion-studio-server/lib/triggers/trigger-loader.js` tests/inventory only; no execution refactor
- `fusion-studio-server/lib/event-bus.js` for the private admitted channel and sealed host bootstrap while preserving legacy compatibility exports
- new `fusion-studio-server/test/subscriptions/` tests

## Acceptance

Tests prove:

- one private accepted-fact controller subscription regardless of registry entry count;
- malformed, wrong-version, raw/caller-ID-forged, wrong-producer/reservation, and legacy-emitted objects cannot reach governed handlers;
- the public bus export and a late-loaded test/project module cannot mint or recover the legitimate file-save publisher; duplicate/late bootstrap is rejected after sealing;
- changing any body/envelope field covered by a durable reservation makes replay fail rather than admit a different fact under the reserved identity;
- exact filter selection and irrelevant-event rejection;
- deterministic order and at-most-once delivery per admission attempt, with explicit duplicate-attempt delivery for idempotency/recovery tests;
- pending/quarantined/revoked/ungranted rows remain inert;
- a revoked/disabled/checksum-invalid active row stops receiving before any failed additive reload, while unchanged prior rows remain active;
- scoped contexts omit ungranted powers;
- unknown handler and bad generation do not replace the current generation or rewrite lifecycle state;
- handler throw, rejected promise, and follow-up fact do not lose later deliveries or loop indefinitely;
- required-ack completion/failure/2,000-ms timeout and best-effort invocation are reported exactly without changing admission truth;
- legacy TRIGGERS actions cannot inherit governed system capabilities and remain behaviorally unchanged;
- existing bus/file-trigger and cron tests remain green.

Run at minimum:

```bash
cd fusion-studio-server
npm test -- --runInBand test/subscriptions
npm test -- --runInBand test/watch test/triggers
npm test
```

If no `test/triggers` path exists, the builder adds focused trigger-loader tests and records the actual command.

## Review Packet

Reviewers must inspect authority derivation, raw capability leakage, reload atomicity, duplicate listeners, recursive follow-up loops, promise rejection handling, shutdown, trigger behavior preservation, and any direct subscribers incorrectly claimed migrated.

## Out of Scope

Untrusted JavaScript, accepted-reference leases, causal graph proof, worker isolation, arbitrary regex/JS filters, TRIGGERS governance/migration, plugin import, Systems toggles, database table provisioning, retention schedulers, or migration of every current direct listener.
