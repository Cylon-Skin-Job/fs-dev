# RCC-0108 SPEC-02 — Server Step Activity and Stream Frontier

**Status:** READY FOR IMPLEMENTATION

**Roadmap:** [RCC-0108 Implementation Roadmap](RCC-0108-ROADMAP.md)

**Parent contract:** [RCC-0108 Product Contract](RCC-0108-chat-working-step-activity.md)

**Prerequisite:** SPEC-01 accepted

**Risk:** High — this establishes the authoritative sequence used for reconnect correctness

## 1. Outcome

Translate real OpenCode step-start signals into provider-neutral `step_begin`, suppress blank new output parts, and publish every accepted in-flight mutation with the exact resulting `LiveTurnSnapshot.streamSeq`.

This SPEC owns the server half of Working activity and frontier correctness. It does not implement client hydration or presentation.

## 2. Normative Wire Contract

Every accepted client-facing in-flight message from `turn_begin` through `turn_end` carries:

```ts
{
  scope: 'project';
  threadId: string;
  turnId: string;
  streamSeq: number;
}
```

Additional rules:

1. `turn_begin` carries the initial positive integer `streamSeq`.
2. The runtime updates its reconstructible live projection and increments `streamSeq` exactly once before publishing a projection-changing event.
3. The emitted `chat:*` event, outbound wire message, and cloned snapshot expose the same resulting sequence.
4. Suppressed, duplicate, stale, identifier-less step, or otherwise rejected events do not increment or publish.
5. No code infers a sequence from WebSocket arrival order.
6. No `streamRevision` or equivalent second whole-turn sequence is permitted.
7. `activityRevision` changes only when Working state changes and can remain unchanged across ordinary output mutations.
8. State at sequence `N` is reconstructible from the snapshot at `N` or later. Runtime-owned tool/usage/helper projection needed for reconstruction cannot exist only in a connection-global accumulator.

## 3. Owned Implementation

### Slice A — Harness translation

1. Extend canonical harness types with:

```ts
type StepBeginEvent = {
  type: 'step_begin';
  timestamp?: number;
  stepId?: string;
  messageId?: string;
};
```

2. Translate OpenCode `step_start` and `part.type === 'step-start'`.
3. Preserve only a present finite numeric native timestamp; omit other timestamp values.
4. Preserve non-empty step/message identifiers.
5. Keep `step_begin` out of the useful-output predicate.
6. Do not add model/provider checks to shared code.

### Slice B — Identity and activity

1. Forward native `timestamp` unchanged through the bridge.
2. Derive source identity in the parent’s exact order before display-time normalization.
3. Check the full-turn runtime seen ledger before deriving `startedAt`.
4. Ignore an event with no stable identity source.
5. Normalize time once with one captured `now`.
6. Increment `activityRevision` only for a real Working set/replace or clear transition.
7. Carry server-issued identity, start time, revision, seen ledger, and activity/cursor in the live snapshot.

### Slice C — Renderable-output suppression

1. Suppress whitespace-only thinking/content only when it would create a new same-type part.
2. Suppress before accumulator, snapshot, bus, wire, or persistence mutation.
3. Do not clear Working for suppressed output.
4. Preserve later chunks exactly once a real same-type part exists.
5. Clear non-null Working on the first renderable thinking, content, or tool call and increment `activityRevision` once.

### Slice D — Sequenced publication

1. Add `streamSeq` to every in-flight broadcaster shape, including `status_update`, subagent, companion live error, and terminal publication.
2. Add the bound `turnId` where missing, including `status_update`.
3. Ensure each sequenced publication is represented by the corresponding runtime snapshot projection.
4. Retain terminal snapshots at their final frontier according to the parent contract.
5. Delete the direct legacy `StepBegin` router branch and `stepNumber`; do not add a shim.
6. Publish `chat:step_begin` through the existing compatibility bus only.

## 4. Expected File Surface

```text
fusion-studio-server/lib/harness/types.js
fusion-studio-server/lib/harness/opencode/json-event-translator.js
fusion-studio-server/lib/harness/opencode/index.js
fusion-studio-server/lib/thread/live-turn-snapshot.js
fusion-studio-server/lib/thread/thread-runtime-manager.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/canonical-chat-text-events.js
fusion-studio-server/lib/wire/canonical-chat-tool-events.js
fusion-studio-server/lib/wire/canonical-chat-terminal-events.js
fusion-studio-server/lib/wire/message-router.js
fusion-studio-server/lib/wire/wire-broadcaster.js
fusion-studio-server/test/harness/opencode/json-event-translator.test.js
fusion-studio-server/test/harness/opencode/harness-send-message.test.js
fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js
fusion-studio-server/test/wire/canonical-chat-event-applier.test.js
fusion-studio-server/test/wire/message-router.test.js
fusion-studio-server/test/wire/wire-broadcaster.test.js
fusion-studio-server/test/thread/thread-crud-live-turn.test.js
```

## 5. Required Tests

- Both OpenCode step-start spellings.
- Finite timestamp preservation and omission of missing/string/NaN/infinite values.
- Lower-bound, second-based, too-future, and valid timestamp normalization.
- Same future timestamp replay after `now` advances.
- Step-ID, message-ID, and timestamp identity precedence.
- A → B → delayed-A lifetime dedupe.
- Duplicate after visible activity cleared.
- No-stable-identity fallback.
- Blank initial thinking/content suppression and exact whitespace continuation.
- Step-only clean exit.
- Every accepted in-flight outbound message has matching `threadId`, `turnId`, and `streamSeq`.
- Snapshot at each emitted sequence reconstructs the state represented through that publication.
- No bump/publication for rejected or suppressed input.
- `activityRevision` changes independently and only for activity transitions.
- Compatibility-path isolation and no accepted-only relationships.

## 6. Exact Acceptance Gate

```bash
cd fusion-studio-server
npx jest --runInBand \
  test/harness/opencode/json-event-translator.test.js \
  test/harness/opencode/harness-send-message.test.js \
  test/wire/canonical-harness-event-bridge.test.js \
  test/wire/canonical-chat-event-applier.test.js \
  test/wire/message-router.test.js \
  test/wire/wire-broadcaster.test.js \
  test/thread/thread-crud-live-turn.test.js

if rg -n "case ['\"]StepBegin['\"]|stepNumber|streamRevision" lib; then
  echo "stale RCC-0108 symbols remain"
  exit 1
fi
```

## 7. Acceptance Criteria

SPEC-02 is accepted only when:

1. OpenCode step-start reaches shared code only as canonical `step_begin`.
2. The shared path contains no OpenCode syntax.
3. Identity dedupe occurs before time normalization.
4. The full-turn ledger prevents delayed replay.
5. Blank new thinking/content never mutates live or durable output.
6. Every accepted in-flight publication carries the exact resulting `streamSeq`.
7. Snapshot reconstruction and publication sequence are one atomic server contract.
8. `activityRevision` remains narrower than `streamSeq`.
9. The legacy direct branch, `stepNumber`, and any duplicate stream counter are absent.
10. Focused tests pass before SPEC-03 begins.

## 8. Handoff to SPEC-03

Record the final server wire union and snapshot shape. SPEC-03 extends `turn_end` and error snapshots without changing the frontier algorithm or adding an alternate terminal publication path.

## Supervisor Amendment (2026-08-25, post SPEC-01 acceptance review)

SPEC-01 delivered `threadRuntimeManager.applyLiveMutation(runtimeKey, {drainId, turnId}, mutator)` as the single gated mutation primitive returning the resulting `streamSeq`. Build all §2 publications on that API — do not add another accumulator or sequence site. See `RCC-0108-SPEC-01-report.md` §9 for the full implemented API surface.
