# RCC-0108 SPEC-04 — Client Routing and Frontier Restoration

**Status:** READY FOR IMPLEMENTATION

**Roadmap:** [RCC-0108 Implementation Roadmap](RCC-0108-ROADMAP.md)

**Parent contract:** [RCC-0108 Product Contract](RCC-0108-chat-working-step-activity.md)

**Prerequisite:** SPEC-03 accepted

**Risk:** High — this changes the live message gate, helper namespaces, and reconnect baseline

## 1. Outcome

Make the client safe for interleaved thread/turn streams and deterministic snapshot/live races before adding new presentation. A returned in-flight thread installs the server snapshot as already revealed and applies only contiguous later sequences exactly once.

This SPEC also creates the deterministic RCC-0108 Playwright WebSocket fixture and owns routing/frontier cases. SPEC-05 extends that existing artifact for presentation.

## 2. Client Frontier Algorithm

Key all frontier state by `threadId + turnId`.

### Turn initialization

- `turn_begin` resolves the explicit thread route first.
- A panel with no current turn initializes the supplied non-empty server `turnId`.
- The same `turnId` is an idempotent duplicate.
- A different active `turnId` is rejected without reset.

### Later live messages

- Every in-flight message through `turn_end` must match the addressed current turn before any store/helper mutation.
- Require a positive integer `streamSeq`.
- Do not use selected workspace/thread state to infer a missing route or turn.

### Snapshot hydration

For an accepted snapshot at `streamSeq = N`:

1. Install the snapshot atomically as an already-revealed baseline.
2. Restore the exact route/turn helper namespace represented by the snapshot.
3. Drop buffered/live events at or below `N`.
4. Buffer events above `N` by sequence until hydration finishes.
5. Drain exactly once in contiguous order starting at `N + 1`.
6. If a sequence is missing, keep later events buffered. A newer snapshot may advance the baseline through the gap.
7. Never guess, renumber, time-sort, or use `activityRevision` as the whole-turn order.

Preserve typed activity/cursor/seen-ledger/revision payloads through the routed frontier contract, but do not claim observable activity projection in this SPEC. SPEC-05 owns ledger union, strictly-greater activity revision application, stale-Working-resurrection proof, and presentation together. The revision field never suppresses otherwise valid content, thinking, tool, status, or terminal handling; `streamSeq` and the route/turn gate govern the whole message.

### Post-terminal messages

`chat-turn:saved` and metadata acknowledgements do not require a live `currentTurn`. Correlate them to pending/completed messages by `threadId + turnId` or `threadId + exchangeId`. They cannot mutate live helpers or activity.

## 3. Owned Implementation

### Slice A — Types and state boundaries

1. Split `src/types/index.ts` into focused chat, WebSocket, workspace, and view-state modules with re-export compatibility.
2. Add the parent’s activity, cursor, seen-ledger, activity revision, terminal error, diagnostic, and live snapshot shapes. This SPEC establishes their typed routing/frontier transport; SPEC-05 owns observable activity-state transition proof together with Working presentation.
3. Add required `streamSeq` to every in-flight wire union member.
4. Remove `stepNumber` and stale legacy `StepBegin` shapes.
5. Add frontier state and actions without pushing a multi-job file past 400 lines.

### Slice B — Routed handler modules

1. Keep `stream-handlers.ts` as a thin routed dispatcher.
2. Extract focused routing, tool, registry/frontier, and diagnostic handlers as needed. Route and buffer typed activity messages without mutating observable Working state; SPEC-05 adds the focused activity handler and owns strictly-greater revision behavior when it can be observed through presentation.
3. Key tool argument buffers, grouping/correlation, subagent state, and frontier buffers by thread/turn.
4. Initialize/reset/finalize only the addressed namespace.
5. Do not let `step_begin` reset tool/subagent state within the same assistant turn.
6. Apply the explicit turn gate before any helper/store call.

### Slice C — Snapshot and save correlation

1. Implement the exact frontier algorithm above.
2. Install completed/durable or terminal snapshots through the completed instant-rendering state path.
3. Install in-flight snapshot segments as already revealed.
4. Preserve the typed terminal-error envelope on the completed-message state only when durable history lacks the matching exchange. Do not require visible error presentation in this SPEC.
5. Merge the later save acknowledgement without creating a duplicate completed message or duplicate content. SPEC-05 owns the public proof that the retained envelope renders exactly one visible error.
6. Keep thread A hydration isolated from thread B.

### Slice D — Deterministic browser fixture and protocol proof

1. Create `e2e/working-activity.spec.ts`.
2. Create or reuse a focused deterministic WebSocket routing/proxy fixture without product-visible hooks.
3. Add `@routing` and `@frontier` cases only; do not require Working/error presentation or activity-resurrection assertions yet.
4. Drive explicit server-shaped messages with real `threadId`, `turnId`, `streamSeq`, and `activityRevision`.
5. Prove state through public UI/store-observable behavior available in the packaged client rather than a new production test API.

## 4. Expected File Surface

```text
fusion-studio-client/src/types/index.ts
fusion-studio-client/src/types/chat.ts
fusion-studio-client/src/types/websocket.ts
fusion-studio-client/src/types/workspace.ts
fusion-studio-client/src/types/view-state.ts
fusion-studio-client/src/state/panelStoreTypes.ts
fusion-studio-client/src/state/slices/chatSlice.ts
fusion-studio-client/src/lib/tool-grouper.ts
fusion-studio-client/src/lib/ws/stream-handlers.ts
fusion-studio-client/src/lib/ws/tool-stream-handlers.ts
fusion-studio-client/src/lib/ws/stream-helper-registry.ts
fusion-studio-client/src/lib/ws/subagent-stream.ts
fusion-studio-client/src/lib/ws/turn-lifecycle.ts
fusion-studio-client/src/lib/ws/thread-handlers.ts
fusion-studio-client/src/lib/ws/chat-diagnostic-handlers.ts
fusion-studio-client/e2e/working-activity.spec.ts
fusion-studio-client/e2e/support/working-activity-ws-fixture.ts
```

Fixture location may follow an existing e2e helper convention; record any path deviation.

## 5. Required Tests

### Routing

- Null-panel `turn_begin`.
- Same-ID duplicate begin.
- Different-active-ID begin rejection.
- Wrong-thread and wrong-turn message rejection before helper mutation.
- Explicit `turnId` enforcement for `status_update`.
- Interleaved A/B content, tool arguments, grouping, subagent, and terminal events.
- One turn’s terminalization does not clear another namespace.
- Post-terminal `chat-turn:saved` and metadata correlation.

### Frontier

- In-flight snapshot at N installs all baseline segments as already revealed.
- Events at/below N do not replay.
- Events N+1/N+2 apply exactly once in order.
- N+2 arriving before N+1 remains buffered.
- Newer snapshot advances through a buffered gap without duplication.
- Live event before hydration is buffered.
- Older snapshot cannot regress visible content/tool/terminal state.
- Whole-turn ordering follows `streamSeq` even when otherwise valid messages carry equal, lower, or greater `activityRevision`; the revision field cannot reorder or suppress non-activity output.
- Completed/durable return is instant.
- Terminal-snapshot/save race produces one completed message with no duplicate content. Visible terminal-envelope/error proof belongs to SPEC-05.
- Hydrating A cannot reset or delay B.

## 6. Exact Acceptance Gate

```bash
cd fusion-studio-client
npx eslint \
  src/types/index.ts \
  src/types/chat.ts \
  src/types/websocket.ts \
  src/types/workspace.ts \
  src/types/view-state.ts \
  src/state/panelStoreTypes.ts \
  src/state/slices/chatSlice.ts \
  src/lib/tool-grouper.ts \
  src/lib/ws/stream-handlers.ts \
  src/lib/ws/tool-stream-handlers.ts \
  src/lib/ws/stream-helper-registry.ts \
  src/lib/ws/subagent-stream.ts \
  src/lib/ws/turn-lifecycle.ts \
  src/lib/ws/thread-handlers.ts \
  src/lib/ws/chat-diagnostic-handlers.ts
npm run build
npx playwright test e2e/working-activity.spec.ts --grep "@routing|@frontier" --workers=1

if rg -n "stepNumber|case ['\"]StepBegin['\"]|type: ['\"]StepBegin['\"]|streamRevision" src; then
  echo "stale RCC-0108 symbols remain"
  exit 1
fi
```

If ESLint reports that a predicted file was not required and therefore does not exist, remove only that nonexistent path from the recorded command and document the implementation-equivalent owning file. Do not omit lint for a changed file.

## 7. Acceptance Criteria

SPEC-04 is accepted only when:

1. All in-flight client mutations pass explicit thread/turn/sequence validation.
2. Turn initialization and post-terminal acknowledgements use their separate approved correlation rules.
3. Tool/grouping/subagent/frontier state is isolated by thread/turn.
4. Snapshot baseline and contiguous live drain produce no replay, gap, duplicate, or regression.
5. Activity revision cannot reorder or suppress otherwise valid whole-turn output; SPEC-05 owns strictly-greater activity projection and stale-Working-resurrection proof once activity is observable.
6. Completed and terminal returns take the instant completed-message path without duplicate content; SPEC-05 proves exactly one visible terminal error from the retained envelope.
7. The deterministic Playwright artifact exists and all `@routing`/`@frontier` cases pass.
8. The client build and stale-symbol sweep pass before SPEC-05 begins.

## 8. Handoff to SPEC-05

Record the typed activity/terminal message delivery contract, retained terminal-envelope state, deterministic fixture API, and accepted tags. SPEC-05 completes the activity-state transition surface, proves strictly-greater revision behavior through the public Working UI, proves the retained envelope renders exactly one visible error through the public error UI, and extends the same Playwright file without product-only hooks.
