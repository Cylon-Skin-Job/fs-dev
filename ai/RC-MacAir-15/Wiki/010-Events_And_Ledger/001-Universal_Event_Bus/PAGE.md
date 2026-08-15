---
name: Events Universal Event Bus
description: Canonical firehose rules for Fusion Studio events, subscriber boundaries, and producer responsibilities.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Events And Ledger Decisions
    - Universal Event Bus Standards
    - Chat Universal Event Bus
  source-files:
    - fusion-studio-server/lib/event-bus.js
  connected-skills: []
  related-trigger-files: []
---

Use this page before adding a new event producer, event subscriber, or cross-system event path.

The Universal Event Bus is the canonical firehose for application facts. Events are emitted after something happened. They are not a request/response API and should not become a second command router.

## Boundaries

- Producers emit facts with enough metadata for subscribers to decide relevance.
- Subscribers filter, compact, persist, broadcast, or trigger follow-up work.
- Canonical candidates pass schema validation or a validated-or-diagnosed publisher before canonical-only subscribers act. Record validation never becomes authorization or failure of the already-valid source operation.
- Canonical publication accepts only a privately registered `PreparedCanonicalCandidate`. `prepareCanonicalCandidate` strips caller-supplied proof fields, consumes upstream refs, and privately proves each registered atomic accepted-only relationship group. A missing, copied, stale, forged, mismatched, wrong-workspace, or otherwise unbound proof omits the whole affected relationship group with fixed value-free diagnostic `accepted_relationship_unbound`; it does not suppress an otherwise valid relationship-free base fact or affect the source operation. Whole-candidate suppression is reserved for an invalid required fact core, an unsanitizable base after relationship removal, an unrelated final schema error, or UEB failure. Admission clones/freezes the safe event, binds its allowlisted identity to an opaque ref, and freezes one `{ acceptedRef }` context. Every D01-admitted listener task calls exact ABI `listener(frozenEvent, deliveryContext)` with the same event/context/ref; bare-ref argument two is invalid. UEB returns `{ published: true, acceptedRef }` before listener code. Identity-sensitive consumers require `assertAcceptedDelivery`. A false publication result exposes no event/ref/context and queues nothing. Legacy `emit()` is non-migrated only.
- Source commands never await admission or a ref. A private per-command slot exposes only leased non-blocking `peekAccepted()` to frozen-registry producers. Command/producer `finally` paths close/release it; late/pending/terminal branches omit relationships, and private state is deleted only after close, terminal admission, and zero leases. SPEC-40 owns the exact slot API and race tests.
- Async listener chains preserve depth/trigger context across `await` boundaries using async-scoped context rather than process-global synchronous state. Concurrent root emissions remain isolated. Subscriber throws/rejections are logged and do not revoke an already true publish result.
- Resource sync, ledger persistence, metadata collectors, and future versioning consume accepted canonical events. TRIGGERS.md file-change execution remains on its one fail-open workspace-watcher path; mutation handlers do not add a second matcher, and canonical automation/resource events observe and correlate it without authorizing execution.
- New watchers or private event buses should not be added when the existing UEB pipeline can carry the event.

`UEB-D01` is OWNER APPROVAL REQUIRED before SPEC-40a/40b1a or first-package assembly. It must define exact admission/listener executor item and byte capacities, concurrency/fairness, enqueue/eviction/drop behavior, cancellation finalizers, per-task event/context/ref retained-byte and lifetime caps, never-settling isolation, and listener saturation. Byte accounting defines measured representation/encoding, object/container overhead, shared-event/context/ref apportionment, queued/active/cancelling ownership, charge/release points, cap precedence, and bounded cap-plus-one measurement. Every command has a bounded private owner cell whose atomic `open_empty|open_slot -> closed` transition makes completion/cancel/throw win safely over late installation; owner-cell initialization failure disables only provenance. UI preflight allocates no slot/link until all bounded data is ready; nullable slot allocation failure installs/offers nothing; install after close terminalizes/releases the new slot; and only after successful install does the fixed module-private offer receive the branded slot synchronously. Only its D01-created link enters task ownership. D01 defines global owner-cell/live-slot count/byte caps, per-slot/per-producer lease caps, repeated acquisition, slot/ref/lease lifetime, and the private nonserializable `AcceptedRefSlotTaskLink` representation/item/byte charge, atomic link-creation/admission-or-finalization transition, single-settlement rule, partial-state release, leaked-cell/link/lease expiry/forced cleanup, slot-registry shutdown, restart, and fixed value-free overload/leak diagnostics. Slot/lease exhaustion returns absent/null and releases bounded provenance state. Link creation/measurement/setup failure, rejection, or overflow invokes the internal fixed link finalizer, settles an installed slot once, terminates only provenance work, independently skips saturated listener deliveries, and never backpressures or retries a source operation. No queued owner cell/slot handle, caller callback, runnable, finalizer, or command-context handle is permitted. No capacity/accounting/default may be inferred.

## Related Pages

- [Decisions](../000-Events_And_Ledger/002-Decisions/PAGE.md)
- [Universal Event Bus Standards](../../005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md)
- [Chat Universal Event Bus](../../007-Chat_System/002-Harness_And_Event_Flow/003-Universal_Event_Bus/PAGE.md)
