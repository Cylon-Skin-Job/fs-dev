---
name: Universal Event Bus Standards
description: Rules for using the server-side universal event bus without confusing commands, facts, chat lifecycle, and provider protocol.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Architecture Routing
    - WebSocket Protocol Standards
    - Chat Universal Event Bus
  source-files:
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-server/lib/wire/wire-broadcaster.js
    - fusion-studio-server/lib/audit/audit-subscriber.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before emitting, subscribing to, or bypassing universal event bus
events.

## Rule

The event bus carries facts after something happened. It is not the command
transport for user requests.

## Topics And Canonical Payloads

Use flat `domain:action` strings only as bus topics. A canonical payload has a unique `eventId`; dotted `eventType` plus `eventFamily` is classification. Do not treat the colon topic as event identity or classification.

Payloads use product vocabulary and include the smallest useful context:

- entity ID, such as `threadId`, `ticketId`, or `workspaceId`
- workspace or scope when ownership matters
- non-sensitive metadata needed by subscribers
- no raw secrets
- no raw provider protocol

Migrated canonical publication accepts only an opaque `PreparedCanonicalCandidate`, canonical-clones/deep-freezes its safe event, binds its allowlisted identity to an opaque ref, and freezes one `{ acceptedRef }` context. `prepareCanonicalCandidate` is the sole accepted-only relationship constructor: it consumes upstream refs, inserts registered event/domain IDs, and records private pointer/ref proof; copying an `inspectAcceptedRef` string is insufficient. Every task uses exact ABI `listener(frozenEvent, deliveryContext)` with the same event/context/ref; bare-ref argument two is invalid. Identity-sensitive consumers use `assertAcceptedDelivery`. Mismatched, forged, unbound, or raw relationships fail. False admission exposes no event/ref/context and queues nothing. Tasks re-enter async chain context.

## Failure Isolation

Canonical publication is a provenance side effect, not command authorization, success, or a prerequisite to execution. After operational validation accepts a command, the operational path starts before initiating provenance is submitted to the supervised admission executor; the command/response chain never invokes or awaits provenance or an accepted-ref promise. Downstream producers use an already-filled command-scoped ref slot or omit the relationship without waiting. Mutation facts do not exist before the owning mutation succeeds; their provenance/recovery work is scheduled only after success and outside the mutation result/response chain. Missing metadata follows the omission/diagnostic path without lookup or retry.

The command slot is a private per-command object, never keyed by renderer IDs. Only frozen-registry producers can acquire leases while the command scope is open. `peekAccepted()` is non-blocking; pending/terminal/late branches return no ref. Producers release leases in `finally`, the command closes acquisition in `finally`, and the supervised admission task always settles or runs its cancellation finalizer. Slot/ref state is deleted only after close, terminal admission, and zero leases. Exact APIs, reasons, races, and tests are normative in SPEC-40.

Optional enrichment is used only when already available. After admission, UEB enqueues every listener as a separate supervised-executor task; it never calls listener code in the admission/source-operation stack or awaits returned promises. All callbacks are queued before task execution, each task re-enters the captured async-chain context, and rejections are diagnosed with deterministic test draining. Subscriber callbacks must use async I/O and offload unbounded CPU work; synchronous filesystem/database/provider I/O is forbidden. Ledger, versioning, audit, compaction, and other subscribers cannot hold the operation response open. Failures or unavailable dependencies never reject, delay, roll back, or rewrite the source result.

Only operational authentication, authorization, command shape, provider protocol, target/workspace resolution, and path safety may gate execution. A value used operationally can still be optional in provenance; failure to project or persist it after acceptance cannot retroactively fail the operation.

Rejected or suppressed candidates expose no accepted reference. Raw candidate/runtime IDs must not enter downstream ID-bearing origins, causes, mirrors, edges, or evidence. Subscriber failure does not revoke an accepted reference.

After a resource mutation/observation, pre-admission rejection/throw/suppression exposes no ref/delivery; post-admission projection failure preserves the accepted ref/frozen event for other subscribers. Both invoke non-canonical `resource:refresh_required`. Clients preserve navigation/history/scroll/dirty/optimistic/undo state; clean entries replace and dirty entries use `recoveryRemote`/`conflict_pending`. Reconnect cannot claim false freshness. Recovery is never canonical.

## Chat Lifecycle

The target chat lifecycle goes through registered canonical chat events. During first-package 40b1, however, the existing `canonical-chat-event-applier.js` name is historical: its `chat:*` emissions are a named legacy compatibility path, not SPEC-40 canonical admission. They may continue feeding existing chat persistence, metadata collectors, automation, and WebSocket fan-out, but they must not call `publishCanonical`, receive `AcceptedCanonicalRef`/delivery context, set canonical admission status, enter canonical-only ledger/subscribers, or carry new accepted-only relationships such as `uiActionId`.

SPEC-40b2 must register the exact affected chat types/redaction policies, migrate the applier to prepared-candidate publication, and remove this exception before chat facts or UI cause/result links are treated as canonical. Tests in 40b1 spy on canonical publication/ledger ingress and prove legacy `chat:*` has no accepted delivery, not merely that one field is absent.

## Commands Versus Events

Commands enter through WebSocket handlers, controllers, or scheduled jobs.

Events are emitted after the command succeeds, fails, or changes state.

Examples:

| User request | Command path | Event/fact path |
|---|---|---|
| Send prompt | `prompt` WS message | `chat:*` lifecycle events |
| Compact thread | `thread:action` with `action: compact` | optional `thread:compacted` fact |
| Move primary chat to a side tab | `thread:action` with `action: move_chat_to_side` | optional `thread:primary_changed` fact |
| Add secret | `secrets:*` WS handler | `secret:added` fact |

## Forbidden Bypasses

- emitting raw OpenCode, Kimi, or other provider events
- using the event bus as a request/response API
- persisting chat exchanges outside the canonical turn-end path
- emitting facts before the owning mutation succeeds
- adding listener side effects without loop and failure considerations

## Required Checks

- Is this a fact or a request?
- Who owns the mutation that makes the fact true?
- Which subscribers need the event?
- Could the event loop back into the same action?
- Does the payload expose secrets, prompts, or provider-native data?
- Are core construction, redaction, validation, admission, and invalidation projection bounded, synchronous, and free of I/O, with their outcome unable to gate the operation?
- Is optional enrichment already available rather than fetched, and are listener callbacks queued outside the admission/operation stack with async rejections observed but not awaited?
- Do subscriber tests forbid synchronous filesystem/database/provider I/O and prove one pending listener cannot prevent later queued listeners from running?
- Can a rejected or suppressed candidate leak an ID into a cause, mirror, edge, or evidence field?
- After a valid resource mutation or safely established watcher observation, does every failed publication/projection branch invoke freshness recovery without changing the operation or observed fact?

## Related Pages

- [Code Standards](../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md)
- [Chat Universal Event Bus](../../../007-Chat_System/002-Harness_And_Event_Flow/003-Universal_Event_Bus/PAGE.md)
- [Canonical Events](../../../007-Chat_System/002-Harness_And_Event_Flow/002-Canonical_Events/PAGE.md)
