# RCC-0108 SPEC-01 — Runtime Drain Ownership

**Status:** READY FOR IMPLEMENTATION

**Roadmap:** [RCC-0108 Implementation Roadmap](RCC-0108-ROADMAP.md)

**Parent contract:** [RCC-0108 Product Contract](RCC-0108-chat-working-step-activity.md)

**Prerequisites:** None

**Risk:** High — this moves canonical turn authority away from connection-selected mutable state

## 1. Outcome

Establish one prompt-bound runtime owner before adding new step or error behavior. Interactive and automation turns use the same immutable route context and exact drain control. A stale callback cannot mutate, stop, terminalize, touch, or clear a replacement drain.

This SPEC changes ownership and routing only. It does not add `step_begin`, terminal diagnostics, or client presentation.

## 2. Required Contract

Implement parent §4.6 and the roadmap’s one-owner contract:

- Create an immutable, deeply copied `CanonicalRouteContext` from accepted prompt data.
- Create a non-serializable `CanonicalDrainControl` that closes over the exact thread runtime and harness session.
- Assign one UUID `drainId` before iterator consumption.
- Let `ThreadRuntimeManager` own the active drain record, accepted input/attachments, assistant parts, tool/usage state, and terminalization state.
- Keep functions and harness objects outside `LiveTurnSnapshot`.
- Make accepted `turn_begin` return its server `turnId` and bind it once to the matching drain.
- Compare `drainId + turnId` for every later canonical mutation.
- Use compare-if-current cleanup on every terminal path.
- Preserve the existing `LiveTurnSnapshot.streamSeq`; do not add a second frontier counter.

## 3. Owned Implementation

### Slice A — Module boundaries

1. Keep `canonical-chat-event-applier.js` as the provider-neutral dispatcher/factory.
2. Extract separable text/thinking, tool, and terminal mutation jobs into focused modules.
3. Keep every new/extracted server file at or below 400 lines.
4. Preserve the pre-SPEC-40b2 `chat:*` publication path.

### Slice B — Bound route and control

1. Add `canonical-drain-context.js`.
2. Copy the attachment array and each attachment object before freezing.
3. Freeze the route context recursively for the supported plain-data shapes.
4. Keep control callbacks and the harness session out of serializable state.
5. Claim the drain before the first iterator event in interactive and automation prompt acceptance.

### Slice C — Runtime authority

1. Add active-drain claim, one-time bind, compare-current read/mutate, idempotent terminalization, and clear-if-current operations.
2. Move canonical accumulator reads/writes from `session.currentTurn`, `session.assistantParts`, selected thread, selected wire, and pending-prompt fields to the runtime.
3. Keep selected connection fields only for UI selection/legacy connection concerns outside canonical authority.
4. Ensure a rejected or duplicate `turn_begin` cannot bind or reset a drain.

### Slice D — Stop, enforcement, and cleanup

1. Touch only the originating thread session lease.
2. Stop only the bound harness through the matching control.
3. Preserve accepted structured attachments during Stop/interruption.
4. Make late iterator errors, Stop completions, terminal callbacks, and `finally` cleanup diagnostic no-ops when their drain is no longer current.
5. Apply the same rules to headless automation.

## 4. Expected File Surface

```text
fusion-studio-server/lib/thread/thread-runtime-manager.js
fusion-studio-server/lib/thread/thread-runtime-controller.js
fusion-studio-server/lib/thread/thread-runtime-automation.js
fusion-studio-server/lib/thread/live-turn-snapshot.js
fusion-studio-server/lib/thread/canonical-drain-context.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/canonical-chat-text-events.js
fusion-studio-server/lib/wire/canonical-chat-tool-events.js
fusion-studio-server/lib/wire/canonical-chat-terminal-events.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/test/thread/thread-crud-live-turn.test.js
fusion-studio-server/test/thread/thread-runtime-controller.test.js
fusion-studio-server/test/thread/thread-runtime-automation.test.js
fusion-studio-server/test/wire/canonical-chat-event-applier.test.js
fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js
fusion-studio-server/test/ws/prompt-canonical-route.integration.test.js
```

The list is predictive, not permission to miss a necessary integration file.

## 5. Required Tests

- One non-mocked public `prompt` WebSocket route test with a fake canonical harness iterator. Do not mock the controller/bridge/applier boundary being changed.
- Two interleaved active threads on one WebSocket retain their own route, input, attachments, harness control, and lease touch.
- Stop on A cannot stop B and preserves A’s accepted attachments.
- Enforcement rejection on A stops A’s bound harness only.
- Old drain A followed by replacement drain B: late A event, error, Stop completion, and cleanup cannot mutate or clear B.
- `turn_begin` binds once; rejected, spurious, and duplicate begins do not rebind.
- Interactive and automation terminal paths clear only their current drain.
- The live snapshot remains serializable and contains no function/harness/control object.

## 6. Exact Acceptance Gate

```bash
cd fusion-studio-server
npx jest --runInBand \
  test/wire/canonical-harness-event-bridge.test.js \
  test/wire/canonical-chat-event-applier.test.js \
  test/thread/thread-crud-live-turn.test.js \
  test/thread/thread-runtime-controller.test.js \
  test/thread/thread-runtime-automation.test.js \
  test/ws/prompt-canonical-route.integration.test.js
```

## 7. Acceptance Criteria

SPEC-01 is accepted only when:

1. `ThreadRuntimeManager` is the sole mutable canonical turn owner.
2. Every iterator is claimed before iteration and has a unique `drainId`.
3. The accepted server `turnId` binds exactly once to the current drain.
4. All post-begin mutations compare the current drain and turn.
5. Stop, enforcement, lease touch, exception handling, and cleanup use the bound control.
6. Late callbacks cannot affect a replacement drain.
7. Interactive and automation behavior pass the same ownership tests.
8. Accepted input and attachments survive interruption without connection-global reconstruction.
9. The existing `streamSeq` survives unchanged as the single whole-turn frontier.
10. No provider parsing or accepted-only canonical-admission relationship is introduced.
11. The exact gate passes and evidence is recorded before SPEC-02 begins.

## 8. Handoff to SPEC-02

Record the runtime API names actually implemented, the shape of the serializable live snapshot, and the exact method that applies a live mutation and returns its resulting `streamSeq`. SPEC-02 must build on those APIs rather than introducing another accumulator or sequence.
