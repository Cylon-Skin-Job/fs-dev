# RCC-0108 — Canonical Step Activity and Transient Chat “Working…” State

**Status:** OWNER APPROVED — PACKAGED AND READY FOR IMPLEMENTATION

**Date:** 2026-07-20

**Implementation packaging completed:** 2026-07-22

**Origin:** `ai/RC-MacAir-15/Issues/inbox/RCC-0108.md`

**Deferred follow-up:** `ai/RC-MacAir-15/Issues/inbox/RCC-0112.md` — optional returned-thread catch-up animation polish after this SPEC's correctness contract is implemented

**Scope:** OpenCode harness translation, canonical chat event flow, live-turn snapshots, WebSocket routing, live chat rendering, turn-scoped error rendering, and user-invoked redacted harness diagnostics

**Risk:** High — this changes a cross-layer live-stream lifecycle, must bind canonical drains to immutable thread/turn context, and adds a dedicated diagnostic persistence boundary whose schema, redaction, retention, and retrieval limits require exact approval and a migration

**Scope authorization and packaging:** The expanded cross-layer product scope is intentional and owner-approved. Prompt-bound routing, thread/turn-keyed stream bookkeeping, transient Working activity, empty-output suppression, durable turn-terminal errors, and user-invoked redacted diagnostics form one agreed product outcome rather than accidental scope growth. The final packaging review completed on 2026-07-22 and placed the work into the dependency-ordered [RCC-0108 implementation roadmap](RCC-0108-ROADMAP.md) and five implementation SPECs. This document remains the authoritative product and technical contract; builders execute only through the linked implementation package and may not omit or reinterpret an approved invariant.

## 1. Mission

Give every active model step immediate, truthful feedback even when the model emits no visible reasoning tokens.

When a harness reports that a fresh model generation/API step has begun, Fusion Studio must show a transient animated hourglass with `Working… Ns`. The indicator is replaced by the first renderable thinking text, assistant text, or tool call from that step. A later model step, including the step after tool results, starts a fresh timer.

The implementation must preserve the harness boundary:

```text
provider/harness event
  -> harness-owned translator
  -> provider-neutral canonical step_begin
  -> canonical chat applier and event bus
  -> live-turn snapshot + routed WebSocket message
  -> transient renderer activity
```

OpenCode syntax must not leak into the shared interpreter, WebSocket client, or renderer.

If an accepted turn fails, replace the transient Working state with a routed inline error after any partial assistant/tool output. The error must use Fusion Studio's existing shared error-presentation vocabulary, survive history hydration, and never expose raw provider objects or stack traces. A user may explicitly retrieve a separately persisted, bounded, redacted diagnostic report for inspection, copying, or AI-assisted troubleshooting.

## 2. Problem and Confirmed Current Behavior

RCC-0108 was initially framed as an empty-thinking-block problem. Investigation established the more precise failure:

- Some models perform reasoning without streaming readable reasoning text.
- OpenCode may emit a `reasoning` part whose `text` is empty while retaining opaque/encrypted metadata.
- OpenCode emits `step_start` before a model step, but `OpenCodeJsonEventTranslator.translate()` currently ignores it.
- A `step_finish` can report reasoning token usage, but that usage is retrospective and cannot start or update a live timer.
- Existing text, thinking, tool-call, tool-argument, tool-result, and finish translations are structurally correct. This is not a tool-syntax mismatch.
- The canonical applier currently permits an empty `thinking` event to create a blank durable assistant part. That artifact must be eliminated independently of the Working indicator.
- The client already declares a legacy `step_begin` WebSocket type, but its only server producer bypasses the canonical chat path, omits routing identity, and is not an acceptable contract for this feature.
- Tool failures already use one shared error formatter and a consistent neutral-chrome/red-body presentation. General harness/runtime failures currently route through `error`/`auth_error` lifecycle messages, with an authentication toast, but do not produce a durable inline transcript error.

The reliable live signal available now is step activity, not readable chain-of-thought and not a live reasoning-token count.

## 3. Source of Truth and Architectural Constraints

Implementation must remain consistent with:

- `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/PAGE.md`
- the Harness Boundary and Canonical Events child pages under that section
- the current WebSocket Protocol, live rendering, lifecycle, and tool-rendering child pages
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- the Architecture Routing, Frontend UI, State Management, WebSocket Protocol, Universal Event Bus, Harness Adapter, Persistence and Metadata, and Testing and Smoke Slices standards under that section

The governing rules are:

1. Harness adapters translate provider-native syntax into canonical events.
2. The canonical chat interpreter contains no provider-specific parsing.
3. Live events route by explicit `threadId`; `turnId` protects turn identity within that route.
4. In-flight state may be restored from the server’s in-memory live-turn snapshot.
5. Durable history contains assistant content and tools, not presentation-only loading state.
6. Visible thinking represents actual readable thinking text. Fusion Studio must never fabricate a thought trace from activity or usage metadata.
7. The current `canonical-chat-event-applier.js` and its `chat:*` publications remain the documented pre-SPEC-40b2 chat compatibility path. RCC-0108 must not call `publishCanonical`, create or carry an `AcceptedCanonicalRef`, claim canonical-admission status, enter canonical-only ledger subscribers, or add accepted-only provenance relationships. `chat:step_begin` uses the same compatibility path as the existing chat lifecycle.
8. The implementation must preserve one job per file; line count is guidance, not the controlling rule. Split an oversized file only when it has more than one job. The Code Standards explicitly mark `LiveSegmentRenderer.tsx` as a one-job **DO NOT SPLIT** completion pipeline, so RCC-0108 must keep its completion dependency graph intact and may add tightly coupled orchestration there even though the file remains above 400 lines. §6 proposes extractions only for other files whose responsibilities are separable.
9. Every changed protocol boundary must have a public-route or fan-out test. Helper-only coverage is insufficient for the routing refactor.

### 3.1 WebSocket redaction decision

No new `redaction-map.js` entry is required for `step_begin` or `turn_end.terminalError` in this change:

- `step_begin` contains only provider-neutral identifiers and normalized time;
- the server terminal-error normalizer emits only the fixed safe catalog in §4.13;
- the current redaction map is used by the inbound WebSocket debug logger, while these two shapes are server-to-client lifecycle messages.

Tests must still prove that raw exceptions, stacks, stderr, provider objects, prompts, attachment contents, and secrets never enter `terminalError`, `chat:turn_end`, the outbound lifecycle message, exchange metadata, or a persisted diagnostic. Diagnostic retrieval returns only the server-validated redacted report and never the raw capture. If outbound lifecycle or diagnostic-response payload logging is added while this work is being implemented, the redaction decision must be revisited before merge.

The current client WebSocket boundary logs inbound message payloads before dispatch. RCC-0108 must therefore suppress or replace the diagnostic response payload in `redactMessageForLog()` before the central console call. Logging the message type, fixed unavailable marker, and opaque route/diagnostic identifiers is allowed; logging any retrieved report field or serialized report is not. Automated client acceptance must prove a successful diagnostic retrieval does not place the report in browser console or captured application logs.

## 4. Owner-Approved Product and Technical Decisions

The combined product scope and all technical decisions R1–R10 including R5A are owner-approved as of 2026-07-22. Sections 4–8 are the authoritative approved product and technical contract. The final packaging review is complete: implementation proceeds through the linked roadmap and five dependency-ordered SPECs. The owner will pause other SPEC implementation that overlaps the shared RCC-0108 server foundation while this work is active.

### 4.1 One canonical event, one presentation state

Add a provider-neutral canonical event named `step_begin`. It means:

> A harness has begun one fresh model generation/API call within the active assistant turn.

It does **not** mean that the model will expose reasoning, produce text, or call a tool.

The client derives one presentation-only activity from it:

```ts
type TurnActivity = {
  kind: 'working';
  turnId: string;
  identity: string;
  stepId?: string;
  messageId?: string;
  startedAt: number;
  activityRevision: number;
};

type TurnStepCursor = {
  identity: string;
  startedAt: number;
};
```

`TurnActivity` is not a `StreamSegment` and is never converted to one.

`TurnStepCursor` is separate transient bookkeeping for the most recently accepted step. It retains that identity/time after visible activity clears so rendering order remains stable. It is not the lifetime dedupe structure.

The server runtime also owns `seenStepIdentities: Set<string>` for the full active turn. `LiveTurnSnapshot` serializes that set as `seenStepIdentities: string[]`, and the client hydrates/maintains an equivalent per-thread/per-turn set. The ledger is transient, has no eviction within a turn, and is cleared only when that turn terminalizes or is superseded. This prevents an A → B → delayed-A sequence from treating A as fresh after B replaced the current cursor.

The runtime also owns a monotonic integer `activityRevision`, initialized to `0` at accepted `turn_begin`. Increment it before each actual activity transition: accepting a new step that sets/replaces Working, clearing non-null Working on the first renderable thinking/content/tool event, or clearing non-null Working on terminalization. The revision never decreases or resets within that turn. Snapshot activity state and every routed message whose handling may change activity carry the server's current revision. On content/thinking/tool messages, this revision gates only the derived activity mutation; it never suppresses otherwise valid renderable output.

### 4.2 Universal transient behavior

The live sequence is:

| Incoming event/state | Visible result | Activity result |
|---|---|---|
| `turn_begin` | Existing orb | No Working state yet |
| First `step_begin` | Orb begins its existing disposal; then `Working… Ns` | Set for this step |
| Non-empty `thinking` | Normal Thinking block | Clear Working |
| Non-empty `content` | Normal assistant text | Clear Working |
| `tool_call` | Existing tool display | Clear Working |
| Tool completes, then another `step_begin` | Existing tool remains; truthful `Working… Ns` follows it after queued reveal completes | Replace with new step identity/time |
| Empty/whitespace-only initial thinking | Nothing new | Keep Working |
| Normal `turn_end` or interrupt | Existing terminal behavior | Clear Working |
| Accepted turn ends in error/auth failure | Inline turn error after already-queued output | Clear Working |

This behavior is model-agnostic. A slow visible-thinking model, an opaque-thinking model, a direct-text model, and a tool-first model all take the same path.

### 4.3 Existing visuals

Reuse `HourglassFlow` at `size="sm"` and its existing 15-second drain/flip cycle. Use the same visual footprint and color vocabulary already used by tool rows. The visible label is `Working… Ns`, with elapsed whole seconds calculated from `startedAt`.

Do not create a new icon system or redesign tool chrome.

### 4.4 Orb interaction

The orb remains the initial request acknowledgement and debounce. `step_begin` counts as activity and starts orb disposal using the current animation path.

Working renders only after orb disposal completes. If renderable thinking, text, or a tool call arrives while the orb is collapsing, the activity is cleared and Working never flashes.

### 4.5 Ordering after tools

A new Working row must appear after all already-queued segments for the turn have been revealed. It must not cover, replace, or render ahead of an animating tool segment.

In `LiveSegmentRenderer`, render the activity only when:

- the orb is done;
- the activity belongs to the current turn;
- there is no newer renderable event that cleared it; and
- `revealedCount >= segments.length`.

### 4.6 Prompt-bound routing and turn state

One WebSocket may own more than one active thread runtime. Therefore, a canonical event drain must never derive its route or turn from mutable connection-wide fields such as `session.currentThreadId` or `session.currentTurn`.

For each accepted prompt, the runtime controller creates one bound canonical context from immutable acceptance data:

```ts
type CanonicalRouteContext = {
  workspaceId: string;
  workspace: string;
  projectRoot: string;
  scope: 'project';
  threadId: string;
  acceptedUserInput: string;
  attachments: Attachment[];
};

type CanonicalDrainControl = {
  drainId: string;
  runtimeKey: ThreadRuntimeKey;
  touchThreadSession: () => void;
  stopHarness: () => Promise<void>;
};
```

`CanonicalRouteContext` is immutable, serializable routing and accepted-prompt data. `CanonicalDrainControl` is the non-serializable control capability for that exact harness drain. It must close over the same thread runtime and harness session that accepted the prompt; it must not look up either through mutable connection selection.

At acceptance, the controller creates a UUID `drainId`, a deeply copied/frozen route context, and one control object. Attachment objects and the attachment array are copied before freezing so later client/session mutation cannot change accepted prompt data. The control object and harness objects never enter a serializable snapshot.

`ThreadRuntimeManager` is the single server owner of the active drain record for a runtime key:

```ts
type ActiveCanonicalDrain = {
  drainId: string;
  turnId: string | null;
  control: CanonicalDrainControl;
};
```

The manager must expose compare-by-identity operations with these semantics, regardless of exact method names:

- claim one active drain for `runtimeKey` before iteration begins;
- bind the server-generated `turnId` exactly once for the matching `drainId`;
- accept a later mutation only when both `drainId` and bound `turnId` match the active record;
- touch or stop only through the matching record's control;
- clear the active record only when `drainId` still matches (`clear-if-current`);
- make repeated terminalization for the same drain idempotent;
- reject a late event, exception callback, Stop completion, or cleanup callback from an old drain without touching or clearing a replacement drain.

Applying `turn_begin` returns `{ accepted: boolean, turnId?: string }`. When accepted, the bridge binds that returned server `turnId` to the active drain exactly once. Every later event from the iterator carries the same route, `drainId`, control, and bound turn identity into the applier. A rejected/spurious `turn_begin` does not bind a turn. Events before a successful binding, duplicate `turn_begin`, and events whose drain/turn no longer match are ignored with fixed value-minimized diagnostics.

All mutable canonical turn accumulation used by this path—accepted input/attachments, assistant text/parts, tool state, usage metadata, activity, terminal error, and terminalization—is owned by `ThreadRuntimeManager` and keyed by the bound runtime/turn. Do not add a second accumulator beside it. `LiveTurnSnapshot` is the serializable projection of that owner, not an independent source of truth.

The existing `LiveTurnSnapshot.streamSeq` is the authoritative monotonic stream frontier for the active turn and must survive this ownership/drain refactor. Do not add a duplicate `streamRevision`. `ThreadRuntimeManager` advances `streamSeq` as its canonical live snapshot changes, and every accepted routed in-flight publication carries the exact resulting sequence exposed by the corresponding snapshot. `streamSeq` orders the whole live-turn projection; the separate `activityRevision` in §4.1 orders only Working-state transitions and cannot substitute for it.

The runtime-owned accumulator retains the accepted user input and structured attachments as well as assistant parts and tool/usage state. The runtime retains the active drain record beside the serializable `LiveTurnSnapshot`; functions and harness objects must never be cloned into or sent with that snapshot. Clear the active drain with compare-by-`drainId` semantics on every terminal path.

Idle-session touches, enforcement-triggered cancellation, user Stop, and exception terminalization must use the bound drain control. In particular:

- a canonical event for thread A touches thread A's session lease even if the WebSocket currently displays thread B;
- a pre-execution enforcement bounce stops thread A's bound harness, never `session.wire` or another selected wire;
- Stop terminalizes from the runtime-owned accumulator and preserves accepted attachments; it must not reconstruct the canonical turn through connection-wide `session.currentTurn` or `session.assistantParts`;
- a late callback from a terminal drain cannot stop or mutate a replacement drain for the same thread.

The automation path creates the same bound context without a WebSocket. Harness adapters remain unaware of Fusion routing.

This route binding applies to every canonical event in a drain, not only `step_begin`. Every client-facing **in-flight drain message from `turn_begin` through `turn_end`**—content, thinking, tool call/arguments/result, subagent event, status update, step activity, companion live error, and terminal event—carries the bound `threadId` and `turnId`.

`turn_begin` is the initialization exception to the later-message current-turn gate. Resolve its explicit `threadId`, require a non-empty server `turnId`, then apply these rules atomically:

- if the addressed panel has no current turn, initialize that exact turn, its helper namespace, empty seen-step ledger, and `activityRevision: 0`;
- if it already has the same `turnId`, treat the message as an idempotent duplicate and do not reset state;
- if it has a different active `turnId`, drop the incoming begin diagnostically. The server must terminalize/supersede the prior turn before beginning another; a begin cannot silently replace a live client turn.

After successful initialization, every later in-flight message through `turn_end` must match the addressed current `turnId` before any live mutation. This prevents a stale message from the same thread from mutating a replacement turn without making legitimate initialization impossible.

Persistence acknowledgements are a separate post-terminal lifecycle family, not in-flight drain mutations. In particular, `chat-turn:saved` is correlated by explicit `threadId + turnId` to the pending/completed assistant message after `currentTurn` may already be null; it attaches `exchangeId`, `seq`, `ts`, `partial`, `reason`, and validated metadata and releases forced-completion/reply-chrome gating. `chat-turn:metadata:updated` correlates by `threadId + exchangeId`. Neither acknowledgement may mutate live stream helpers or activity, and an acknowledgement with no matching pending/completed message is a diagnostic drop. A routed companion `error`/`auth_error` arriving after terminalization may preserve notification behavior but cannot create or mutate transcript content.

### 4.7 Identity, duplicates, and stale events

The canonical and WebSocket event shapes are:

```ts
type StepBeginEvent = {
  type: 'step_begin';
  timestamp?: number;
  stepId?: string;
  messageId?: string;
};

type StepBeginWireMessage = {
  type: 'step_begin';
  scope: 'project';
  threadId: string;
  turnId: string;
  streamSeq: number;
  identity: string;
  stepId?: string;
  messageId?: string;
  startedAt: number;
  activityRevision: number;
};
```

Rules:

- The canonical applier accepts `step_begin` only while the bound target runtime has the matching active turn.
- The applier stamps the bound `threadId` and server-owned bound `turnId`; a harness cannot select the client route.
- The client applies the message only to its explicit `threadId` route and matching current `turnId`.
- Every accepted in-flight publication from `turn_begin` through `turn_end` carries the authoritative resulting `streamSeq`. `turn_begin` carries the initial sequence. A publication that changes the live projection increments `streamSeq` exactly once before broadcast; the wire message and cloned snapshot then expose the same value. A suppressed, duplicate, stale, or otherwise rejected event neither increments nor publishes. There is no inference from arrival order, client time, or `activityRevision`.
- Before temporal normalization, the server derives a stable source identity in this order: `step:<stepId>`, `message:<messageId>`, then `time:<String(timestamp)>` from the preserved finite native numeric timestamp. The timestamp fallback is required because OpenCode’s current `step_start` can omit both IDs.
- The server checks that source identity against the runtime's full-turn `seenStepIdentities` set **before** deriving a new `startedAt`. A seen identity is a duplicate and returns without changing activity, the current cursor, or the ledger. Therefore replaying A after B, or replaying the same future-dated/temporally invalid finite timestamp as `now` advances, cannot acquire a new identity or reset elapsed time.
- An event with no non-empty `stepId`, no non-empty `messageId`, and no finite numeric native `timestamp` has no replay-safe identity. The applier ignores it with the project’s normal diagnostic style; the existing orb-until-output behavior remains the fallback. An adapter must not claim step support unless it supplies at least one stable identity source.
- For a newly accepted source identity, the applier adds it to `seenStepIdentities`, derives `startedAt` once, increments `activityRevision`, stores the current `{ identity, startedAt }` cursor, and emits the same explicit `identity`, `startedAt`, and revision in `chat:step_begin`, `StepBeginWireMessage`, and `LiveTurnSnapshot`. A different unseen identity replaces activity and resets elapsed time. Clearing Working does not clear the cursor or seen ledger.
- The server is the authoritative lifetime dedupe gate. The client rejects an explicit server-issued identity already present in its matching turn's seen set as a defensive gate for duplicate delivery and snapshot/live-message races; it never reconstructs identity from a newly sampled client clock.
- Events for an old turn, a terminal turn, or a missing current turn are ignored with the project’s normal diagnostic style.
- Normalize display time once in the canonical applier and only after the source-identity duplicate check. With one captured `now = Date.now()`, accept a finite numeric harness timestamp only when it is at least `946684800000` (2000-01-01) and no more than `now + 60_000`; set `startedAt = Math.min(candidate, now)`. Otherwise use that captured `now`. This rejects second-based/non-date values and prevents negative elapsed time without making the normalized display time the replay identity.

The proposed field names, identity boundary, and time-normalization boundary are:

```text
native OpenCode event timestamp
  -> adapter canonical numeric `timestamp` (preserved when finite; otherwise omitted)
  -> bridge payload `timestamp` (preserved)
  -> canonical applier derives stable source `identity`, dedupes, then validates time once and derives `startedAt`
  -> runtime snapshot, chat:step_begin, WebSocket, and client use the server-issued `identity`, `startedAt`, and `activityRevision`
```

The adapter performs only primitive shape selection: preserve a finite numeric native value exactly and omit a missing, non-numeric, or non-finite value. It does not judge epoch units, age, or future skew and does not synthesize adapter time. The applier performs the only temporal normalization and uses its one captured `now` when a present identity-bearing candidate is temporally invalid. The bridge must not rename the field to `startedAt` before validation. Direct applier tests must still prove defensive handling of non-finite values even though conforming adapters omit them.

`Working… Ns` always reports elapsed time since authoritative `startedAt`. Because the orb transition or an already-queued tool reveal may delay the row, its first visible value is not guaranteed to be `0s`; showing the truthful elapsed value takes precedence over a zero-based first paint.

### 4.8 Empty thinking and content

An empty or whitespace-only thinking event that would create a new thinking part is non-renderable:

- do not append it to the bound turn’s assistant-part accumulator;
- do not append it to a live-turn snapshot;
- do not broadcast it;
- do not clear Working;
- do not persist it to SQLite/history.

Once a real thinking part exists, preserve subsequent streamed content according to the existing concatenation contract; this requirement must not trim or rewrite readable model output.

This suppression belongs in the canonical applier so every harness benefits.

Apply the same new-part rule to canonical `content`: an empty or whitespace-only content event that would create a new text part is non-renderable and must not be accumulated, snapshotted, broadcast, persisted, or used to clear Working. Once a real text part exists, preserve subsequent streamed chunks exactly according to the existing concatenation contract, including whitespace; do not trim or rewrite readable assistant output.

### 4.9 Persistence and reconnect behavior

Working is transient but reconnectable:

- Add `activity: TurnActivity | null` to the server’s **in-memory** `LiveTurnSnapshot`.
- Add `stepCursor: TurnStepCursor | null` to the same snapshot and client per-thread state. It is transient dedupe metadata, not rendered content.
- Add `seenStepIdentities: string[]` to the snapshot as the serializable projection of the runtime's full-turn set. The client keeps an equivalent set keyed by `threadId + turnId`; neither side evicts identities during an active turn.
- Add `activityRevision: number` to the snapshot and matching client turn state. Routed `step_begin`, renderable `thinking`/`content`/`tool_call`, and `turn_end` messages carry the current revision because they can set or clear activity.
- Add `terminalError: TurnTerminalError | null` to the live snapshot. Unlike Working, it is retained on an error-terminal snapshot until that snapshot is superseded; this covers reconnect between `turn_end` and saved-exchange acknowledgement.
- Initialize `activity`, `stepCursor`, and `terminalError` to `null`, `seenStepIdentities` to an empty set/list, and `activityRevision` to `0` at turn start.
- On accepted `step_begin`, add the identity to the ledger, increment the revision, and set `activity` and `stepCursor`; leave `terminalError` null.
- On the first renderable thinking/content/tool call while activity is non-null, increment the revision and clear `activity`. Retain `stepCursor` and `seenStepIdentities` until the turn terminalizes. Later output may carry the unchanged current revision and still renders normally.
- Clear `activity`, `stepCursor`, and `seenStepIdentities` on every terminal path and new-turn reset. Retain only a normalized `terminalError` on an error-terminal snapshot; all other terminal reasons retain `terminalError: null`.
- Include activity, cursor, seen ledger, activity revision, and terminal error in thread-open/live-snapshot responses.
- Preserve the existing monotonic `streamSeq` in every live snapshot. A `thread:opened` snapshot at sequence `N` is the authoritative reconstruction baseline through `N`, not a new sequence of unrevealed client events.
- Restore activity, cursor, revision, and the full seen ledger only when the snapshot status is `in_flight`, retaining the original `startedAt`. Initial hydration with no local matching turn state accepts the snapshot atomically. For a matching active turn, union snapshot identities into the local ledger, then compare revisions: a greater snapshot revision replaces the local activity/cursor/revision; an equal or lower revision cannot alter local activity/cursor/revision. Every matching live activity mutation follows the same greater-than rule. This prevents both an older A snapshot from replacing live B and a pre-content snapshot from resurrecting Working after newer renderable output cleared it.
- Restore a snapshot terminal error only when snapshot `status === 'error'` and the matching exchange is not yet present in hydrated durable history. Render/finalize it through the same completed-message path, then let `chat-turn:saved` merge the metadata without creating a second row.
- Never include Working activity, its cursor, or its seen-identity ledger in assistant parts, saved exchanges, SQLite rows, or `InstantSegmentRenderer` history. Never include a terminal error in assistant parts; persist it only in existing exchange metadata.

No database migration is required for Working, live snapshot, or terminal-envelope persistence. The separately approved diagnostic table in §4.13.1 requires one migration and does not alter the `exchanges` schema.

These exclusions apply to Working activity, its cursor, and its seen ledger. A terminal error is not transient activity: §4.13 persists its normalized envelope in existing exchange metadata so a failed turn remains intelligible in history.

#### 4.9.1 Return-to-thread catch-up contract

Thread navigation must resume from authoritative server progress, never from the renderer position that happened to be visible when the user left:

- If the turn completed and its durable exchange is available, reopening the thread hydrates the completed message through `InstantSegmentRenderer`; it must not remount a delayed live replay.
- If the turn remains in flight, the snapshot content through `streamSeq = N` is installed as an already-revealed catch-up baseline. Only routed mutations after `N` enter normal live reveal.
- If a terminal snapshot arrives before the durable save acknowledgement, finalize its accumulated output immediately through the completed-message path. The later `chat-turn:saved` acknowledgement attaches durable identity and metadata without replay or duplication.
- Snapshot and live-message races must produce no gaps, duplicates, or regressions. Every accepted in-flight message carries its server-issued `streamSeq`. Events at or below the accepted baseline are ignored as already represented. Events above it that arrive before hydration completes are buffered by `threadId + turnId + streamSeq`, then drained exactly once in contiguous sequence after the baseline is installed. A buffered gap remains pending until the missing sequence arrives or a newer authoritative snapshot advances the baseline through it; the client never guesses, renumbers, or applies across a gap.
- Applying a snapshot for thread A must not reset, pause, or drain thread B's live renderer or helper namespace.

This SPEC owns the frontier correctness and no-backlog-replay invariant because it changes live snapshots, routed in-flight messages, thread/turn stream isolation, reconnect restoration, and `LiveSegmentRenderer`. The exact cosmetic transition at the snapshot boundary—such as easing, a brief tail fade, or treatment of the newest partial segment—is deferred to RCC-0112 and must not weaken this contract.

### 4.10 Accessibility and timing

- Announce the Working status once when a step begins.
- Do not put the once-per-second visual label updates in an `aria-live` region.
- Keep a stable accessible label such as `Model working` while rendering the changing seconds as visual/`aria-hidden` text.
- Honor the existing reduced-motion behavior of `HourglassFlow`; add it if the reusable component does not currently satisfy it.
- Compute elapsed time from `startedAt`; do not increment a counter that drifts while a tab is backgrounded.

### 4.11 Harness fallback and token usage

Harnesses with a reliable native step-start signal may map it to canonical `step_begin`. Harnesses without one need no fabricated event; their existing orb-until-output behavior remains the fallback.

Do not display `step_finish.tokens.reasoning` as if it were a live counter. RCC-0108’s optional token-count wording is satisfied only if a future harness provides reliable, mid-step usage updates. The current feature displays elapsed time only.

### 4.12 Thread-keyed client stream bookkeeping

The client may receive interleaved live events for more than one thread on one WebSocket. Per-thread `PanelState` is not sufficient if supporting stream helpers remain connection-global.

Key tool-argument buffers, tool grouping/correlation, and subagent stream bookkeeping by `threadId` and active `turnId`. Their lifecycle is the complete active assistant turn. Every helper entry point accepts both keys; it must not infer either from selected UI state:

- initialize or reset only the addressed thread/turn on `turn_begin`;
- retain the namespace across every model step and tool cycle in that turn; `step_begin` must not reset it;
- content/thinking may break only that turn's active grouping sequence while retaining its tool-call correlation map;
- clear only that thread/turn on terminalization or when a newer turn supersedes it;
- reconnect restoration may rebuild renderable segments from the snapshot, but must not reset another thread's live helpers.

Thread B beginning or ending a turn must never clear thread A's tool argument buffer, grouping map, or subagent stream. Context/status projections that affect visible chat must likewise be selected by thread rather than overwritten from an unrelated background thread.

For `turn_begin`, first resolve the addressed `PanelState` by explicit `threadId` and apply §4.6's null/same/different initialization rules; do not require a turn that the message has not created yet. For every later routed in-flight drain message through the handling of `turn_end`, require `msg.turnId === panel.currentTurn.id` before calling a live store action or stream helper. `status_update` is included and therefore gains a required `turnId` on the server-to-client shape. Wrong-turn messages for a valid thread are diagnostic drops, not activity, grouping, context, or content updates. Messages that carry `activityRevision` use it only to gate activity-state projection after route validation. After terminalization clears `currentTurn`, handle `chat-turn:saved`, metadata acknowledgements, and notification-only companion errors through the post-terminal correlation rules in §4.6 rather than this live-current-turn gate.

### 4.13 Turn-scoped error routing and rendering

An error that occurs after canonical `turn_begin` belongs to that accepted turn. Normalize it on the server and carry it on the authoritative terminal event:

```ts
type TurnTerminalErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'MODEL_TIMEOUT'
  | 'HARNESS_EXITED'
  | 'MODEL_RESPONSE_FAILED';

type TurnTerminalError = {
  kind: 'runtime' | 'authentication';
  code: TurnTerminalErrorCode;
  message: string;
  recoverable: boolean;
  diagnosticId?: string;
};

type ErrorTurnEnd = {
  type: 'turn_end';
  threadId: string;
  turnId: string;
  reason: 'error';
  partial: true;
  terminalError: TurnTerminalError;
};
```

Routing and ownership rules:

- `turn_end.terminalError` is the sole source for an inline turn error. A companion routed `error` or `auth_error` message may preserve the existing notification/acceptance-failure behavior, but it must not create a second transcript row.
- The server must derive `threadId` and `turnId` from the prompt-bound canonical context. An unscoped transport error cannot guess a target turn and remains global diagnostic/notification state.
- A warm-up, validation, or harness failure before canonical `turn_begin` produces no assistant exchange and no inline error row. Preserve the accepted input and show the existing appropriate notification behavior.
- A failure after `turn_begin` terminalizes exactly once with `reason: 'error'`, `partial: true`, and the normalized error envelope, even when no assistant content was emitted.
- Render the error after all accumulated assistant and tool output. It replaces Working and never covers or precedes partial output; §4.13's immediate flush converts any still-queued reveal into completed instant rendering before the error mounts.
- A tool result with `isError: true` continues through the universal tool error formatter. It is not converted into a turn-terminal error unless the turn itself also fails.

Presentation must follow the existing shared tool-error vocabulary without pretending the failure is a tool call:

- neutral surrounding chat chrome/spacing;
- `Response failed` or `Authentication failed` as a semibold title using `var(--error, #ef4444)`;
- the safe catalog code in muted context text;
- a compact, deduplicated, pre-wrapped safe message in the same red/error treatment;
- one `role="alert"` announcement when the terminal error appears, not repeated by re-renders.

The implementation may extract/reuse shared compaction and dedupe helpers from `lib/tool-renderers/shared/error-display.ts`, but must not route a turn error through `ToolCallBlock`, add an error `StreamSegment`, or duplicate renderer-local error heuristics.

The server owns disclosure safety. The ordinary turn path persists and sends only the normalized terminal envelope and optional opaque `diagnosticId`. Raw `Error` objects, stacks, stderr dumps, encrypted reasoning metadata, secrets, and provider-specific JSON never enter chat payloads or exchange metadata. The separately approved diagnostic path below may persist and return only a bounded, server-redacted structured projection. The client compacts again as a defensive presentation limit; it does not decide whether provider data is safe.

Any specific harness-failure classification recognized above the generic fallback must be created at the owning harness boundary, never inferred from provider codes, names, or text in a controller, bridge, runtime manager, or terminal-error normalizer. Add provider-neutral `HarnessRuntimeError` in `lib/harness/errors.js` with this closed internal marker union:

```ts
type HarnessRuntimeErrorCode =
  | 'HARNESS_AUTHENTICATION_FAILED'
  | 'HARNESS_MODEL_TIMEOUT'
  | 'HARNESS_PROCESS_EXIT';
```

RCC-0108 guarantees native authentication, timeout, and process-close translation for **OpenCode**, the only enabled harness in the current workspace policy and the harness named in this SPEC's scope. The OpenCode-owned path may inspect native `-32004`, native error names/codes, or provider text solely to select a marker and construct the closed redacted diagnostic candidate below. It constructs a marker error containing the provider-neutral internal code, its fixed internal message, and at most that already-redacted candidate; no raw exception/provider object crosses the adapter boundary.

The shared marker type is available to other adapters, and an adapter already emitting a valid marker receives the same specific catalog outcome. RCC-0108 does not retrofit disabled/non-OpenCode adapters. A historical thread may still resume its stored harness; if that adapter throws an unmarked raw authentication, timeout, or exit error, shared code produces the safe generic `MODEL_RESPONSE_FAILED` terminal outcome. It must not parse the raw value to recover specificity. This preserves durable failure rendering and the harness boundary while making the narrower classification guarantee explicit.

The provider-neutral normalizer uses this closed display catalog:

| Classification input (server inspection only) | Output kind | Safe output code | Safe message | Recoverable |
|---|---|---|---|---|
| exact provider-neutral internal marker `HarnessRuntimeError.code === 'HARNESS_AUTHENTICATION_FAILED'` | `authentication` | `AUTHENTICATION_FAILED` | `Authentication failed. Check the configured harness credentials and try again.` | `true` |
| exact provider-neutral internal marker `HarnessRuntimeError.code === 'HARNESS_MODEL_TIMEOUT'` | `runtime` | `MODEL_TIMEOUT` | `The model response timed out before it completed.` | `true` |
| exact provider-neutral internal marker `HarnessRuntimeError.code === 'HARNESS_PROCESS_EXIT'` | `runtime` | `HARNESS_EXITED` | `The model process ended before the response completed.` | `true` |
| any other post-`turn_begin` exception | `runtime` | `MODEL_RESPONSE_FAILED` | `The model response failed before it completed.` | `true` |

Only the safe output codes above may enter `TurnTerminalError.code`; never pass through an arbitrary provider or internal marker code. Catalog messages are fixed constants, at most 300 Unicode code points, and contain no interpolated exception text. `kind`, `code`, `message`, and `recoverable` are reconstructed from the catalog rather than spread/cloned from input. The normalizer does not inspect raw exception codes, names, messages, causes, or stacks. User Stop and intentional cancellation remain `reason: 'interrupted'`, not a runtime failure.

`TurnTerminalError` is durable turn metadata, not assistant content. Carry it on the live/current turn and live snapshot long enough to finalize without a flash, copy it to the completed client message, and persist it as `exchange.metadata.terminalError`. History hydration renders the same component from that metadata. The terminal envelope still requires no new exchange column; the separate diagnostic table requires its own migration.

#### 4.13.1 Redacted harness diagnostics

The safe transcript catalog remains the default and automatic presentation. Detailed troubleshooting data uses a separate server-owned path:

```ts
type HarnessDiagnosticCandidateV1 = {
  version: 1;
  harnessId: string;
  modelId?: string;
  category: 'authentication' | 'timeout' | 'process_exit' | 'runtime';
  providerCode?: string;
  errorName?: string;
  exitCode?: number;
  signal?: string;
  message?: string;
  stderrExcerpt?: string;
  lastCanonicalEventType?: string;
  hadRenderableOutput: boolean;
  hadToolCalls: boolean;
  truncatedFields: string[];
};
```

- OpenCode may inspect the native failure only inside its adapter boundary. There it selects the provider-neutral marker and constructs this closed candidate using the approved redaction and bounds from R5A. Unknown keys are discarded rather than copied.
- A prompt-bound diagnostic service defensively validates the candidate, binds the authoritative `workspaceId + threadId + turnId`, persists only the validated safe projection in a dedicated diagnostics table, and returns a server-generated UUID `diagnosticId`.
- Do not store diagnostics in `event_log`, assistant parts, or the general exchange metadata object. Exchange metadata contains only the safe `TurnTerminalError`, whose optional `diagnosticId` is an opaque lookup reference.
- Raw exceptions, causes, stacks, stderr, provider JSON, prompts, attachments, environment values, and secrets are never persisted in the diagnostic table. The raw capture is discarded after the adapter produces the safe candidate.
- Diagnostic persistence is best-effort and outside the semantic success of turn terminalization. If validation, migration availability, insertion, or cleanup fails, the fixed safe terminal error still completes normally without `diagnosticId`.
- Retrieval is on demand through a focused `chat-turn:diagnostic:get` request carrying `threadId + turnId + diagnosticId`. The server verifies the diagnostic belongs to that route and returns only the stored validated report. Missing, expired, mismatched, or unavailable records receive one fixed value-free unavailable response.
- The error UI may offer **View details**, **Copy diagnostic**, and **Ask AI to troubleshoot** only when a valid diagnostic ID exists. “Ask AI” places the redacted report into the composer for user review/editing; it never sends a prompt automatically.
- The client never requests a diagnostic merely because an error row mounted, and no diagnostic report is included in thread-open/history hydration. This keeps troubleshooting details out of routine WebSocket, rendering, and model context paths.
- Apply the exact R5A-approved per-field limits, total serialized-byte limit, redaction behavior, retention duration, row capacity, cleanup timing, and retrieval limits.

The owner-approved R5A contract is: allowlist-only V1 construction with no error/provider-object traversal; exact configured-secret and sensitive-environment-value replacement; credential/token/private-key/URL-userinfo pattern redaction; `$HOME`/`$WORKSPACE` path-prefix rewriting; structured-only fallback if redaction fails; 128-byte short identifiers; a 4 KiB message prefix; a 16 KiB stderr tail; 16 fixed-name truncation markers; a 24 KiB serialized report; 30-day retention; 500 rows per workspace and 5,000 total; transactional expiry/oldest-first cap cleanup at startup and insertion; one-report 24 KiB retrieval; exact route/turn/ID ownership; and composer-only Ask AI behavior.

For this contract, a sensitive environment value is any non-empty value whose environment key matches the closed, case-insensitive key policy `(?:^|_)(TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|APIKEY|PRIVATE_KEY|ACCESS_KEY|SESSION|COOKIE|AUTH|CREDENTIALS?)(?:_|$)`, plus any OpenCode credential environment key explicitly read by the active adapter. Configured secrets come from the existing Fusion Studio secret/configuration owner rather than an environment scan. The redactor replaces exact values before applying pattern and path rewriting. Tests must cover every key-family alternative, an adapter-declared credential key, and a nearby non-sensitive key that must not be treated as a secret solely because it exists in the environment.

Error ordering uses the existing immediate partial-turn flush policy. On an error `turn_end`, clear Working, mark queued segments complete, copy the normalized error to the current turn, and atomically finalize the turn. `InstantSegmentRenderer` then renders all accumulated assistant/tool output synchronously, followed by one `ChatTurnError`, followed by reply chrome. Do not wait for remaining typing/tool animation, and do not mount the error inside `LiveSegmentRenderer`. Normal completion continues to use reveal-complete gating. This resolves the ordering invariant without allowing activity to strand terminal finalization.

## 5. Non-Goals

- Migrating OpenCode from its current JSON event stream to SSE or a different SDK.
- Displaying, reconstructing, or fabricating hidden chain-of-thought.
- Guessing model behavior from provider/model allowlists.
- Enabling reasoning flags or changing model configuration.
- Building a live token estimator from retrospective usage.
- Persisting Working to SQLite or historical assistant messages.
- Adding Working to `StreamSegment`, `AssistantPart`, or `InstantSegmentRenderer`.
- Redesigning the orb, tool renderer, or subagent waiting treatment.
- Redesigning tool-call error handling or adding per-tool error chrome.
- Adding a terminal error to `StreamSegment` or `AssistantPart`, or rendering raw provider errors/stacks in chat.
- Persisting or automatically sending raw provider errors, stderr, stacks, prompts, attachments, environment values, or secrets as diagnostics.
- Requiring every harness adapter to support `step_begin` in this change.
- Retrofitting disabled/non-OpenCode harness adapters with specific authentication, timeout, or process-exit markers. Historical threads using those adapters receive the generic safe terminal outcome unless the adapter already emits the shared marker.

## 6. Implementation Package

Implementation ownership and runnable gates are defined by:

1. [RCC-0108 implementation roadmap](RCC-0108-ROADMAP.md)
2. [SPEC-01 — Runtime drain ownership](RCC-0108-SPEC-01-runtime-drain-ownership.md)
3. [SPEC-02 — Server step activity and stream frontier](RCC-0108-SPEC-02-server-step-frontier.md)
4. [SPEC-03 — Server terminal errors and diagnostics](RCC-0108-SPEC-03-terminal-errors-diagnostics.md)
5. [SPEC-04 — Client routing and frontier restoration](RCC-0108-SPEC-04-client-routing-frontier.md)
6. [SPEC-05 — Presentation, acceptance, and documentation](RCC-0108-SPEC-05-presentation-acceptance.md)

The SPECs execute serially. Each owns its code surface, verification artifacts, and acceptance gate. `e2e/working-activity.spec.ts` and its deterministic WebSocket fixture are introduced in SPEC-04 before SPEC-05 extends and runs the presentation cases. No later SPEC may compensate for an unpassed earlier gate.

## 7. Expected File Surface

The implementation is expected to touch the following active files, subject to the smallest-correct-change rule:

```text
fusion-studio-server/lib/harness/types.js
fusion-studio-server/lib/harness/errors.js
fusion-studio-server/lib/harness/opencode/harness-diagnostic-redactor.js
fusion-studio-server/lib/harness/opencode/index.js
fusion-studio-server/lib/harness/opencode/json-event-translator.js
fusion-studio-server/lib/thread/live-turn-snapshot.js
fusion-studio-server/lib/thread/thread-runtime-manager.js
fusion-studio-server/lib/thread/thread-runtime-controller.js
fusion-studio-server/lib/thread/thread-runtime-automation.js
fusion-studio-server/lib/thread/turn-terminal-error.js
fusion-studio-server/lib/thread/harness-diagnostic-service.js
fusion-studio-server/lib/thread/canonical-drain-context.js
fusion-studio-server/lib/db/migrations/<next>_harness_error_diagnostics.js
fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
fusion-studio-server/lib/wire/canonical-chat-event-applier.js
fusion-studio-server/lib/wire/canonical-chat-text-events.js
fusion-studio-server/lib/wire/canonical-chat-tool-events.js
fusion-studio-server/lib/wire/canonical-chat-terminal-events.js
fusion-studio-server/lib/wire/wire-broadcaster.js
fusion-studio-server/lib/wire/message-router.js
fusion-studio-server/lib/audit/audit-subscriber.js
fusion-studio-server/test/harness/opencode/json-event-translator.test.js
fusion-studio-server/test/harness/opencode/harness-send-message.test.js
fusion-studio-server/test/harness/harness-runtime-error.test.js
fusion-studio-server/test/harness/opencode/harness-diagnostic-redactor.test.js
fusion-studio-server/test/wire/canonical-harness-event-bridge.test.js
fusion-studio-server/test/wire/canonical-chat-event-applier.test.js
fusion-studio-server/test/wire/message-router.test.js
fusion-studio-server/test/wire/wire-broadcaster.test.js
fusion-studio-server/test/ws/prompt-canonical-route.integration.test.js
fusion-studio-server/test/thread/thread-crud-live-turn.test.js
fusion-studio-server/test/thread/thread-runtime-controller.test.js
fusion-studio-server/test/thread/thread-runtime-automation.test.js
fusion-studio-server/test/thread/turn-terminal-error.test.js
fusion-studio-server/test/thread/harness-diagnostic-service.test.js
fusion-studio-server/test/thread/audit-subscriber-chatlog-finalize.test.js
fusion-studio-client/src/types/index.ts
fusion-studio-client/src/types/chat.ts
fusion-studio-client/src/types/websocket.ts
fusion-studio-client/src/types/workspace.ts
fusion-studio-client/src/types/view-state.ts
fusion-studio-client/src/state/panelStoreTypes.ts
fusion-studio-client/src/state/slices/chatSlice.ts
fusion-studio-client/src/state/slices/chatActivityState.ts
fusion-studio-client/src/lib/tool-grouper.ts
fusion-studio-client/src/lib/ws/stream-handlers.ts
fusion-studio-client/src/lib/ws/activity-stream-handler.ts
fusion-studio-client/src/lib/ws/tool-stream-handlers.ts
fusion-studio-client/src/lib/ws/stream-helper-registry.ts
fusion-studio-client/src/lib/ws/subagent-stream.ts
fusion-studio-client/src/lib/ws/turn-lifecycle.ts
fusion-studio-client/src/lib/ws/thread-handlers.ts
fusion-studio-client/src/lib/ws/chat-diagnostic-handlers.ts
fusion-studio-client/src/lib/ws-client.ts
fusion-studio-client/src/components/MessageList.tsx
fusion-studio-client/src/components/LiveSegmentRenderer.tsx
fusion-studio-client/src/components/chat/WorkingActivity.tsx
fusion-studio-client/src/components/chat/WorkingActivity.css
fusion-studio-client/src/components/chat/ChatTurnError.tsx
fusion-studio-client/src/components/chat/ChatTurnError.css
fusion-studio-client/src/components/chat/ChatDiagnosticDetails.tsx
fusion-studio-client/src/components/chat/ChatDiagnosticDetails.css
fusion-studio-client/src/components/chat/HourglassFlow.tsx
fusion-studio-client/src/components/chat/HourglassFlow.css
fusion-studio-client/src/lib/tool-renderers/shared/error-display.ts
fusion-studio-client/e2e/working-activity.spec.ts
fusion-studio-client/e2e/support/working-activity-ws-fixture.ts
ai/RC-MacAir-15/Wiki/007-Chat_System/**/PAGE.md
ai/RC-MacAir-15/Issues/inbox/RCC-0108.md
```

Do not alter the `exchanges` schema, historical assistant-part/segment model, or inactive legacy client/server directories. The only schema addition is the dedicated bounded diagnostics table approved through R5/R5A. History adds the separate turn-level error sourced from exchange metadata; diagnostic details are fetched only after explicit user action and are never part of normal history hydration.

## 8. Acceptance Criteria

The feature is complete only when all of the following are true:

1. OpenCode `step_start` reaches the main interpreter only as canonical `step_begin`.
2. The shared canonical path contains no OpenCode-specific event parsing.
3. Every client-facing `step_begin` has explicit `threadId`, current `turnId`, stable server-issued `identity`, `startedAt`, and monotonic `activityRevision`, all derived from a prompt-bound canonical context rather than mutable WebSocket selection state. The server checks source identity against a full-turn seen ledger before display-time normalization, an A → B → delayed-A replay cannot replace B, and an event without any stable identity source is ignored without replacing the fallback orb. Snapshot/live activity projection accepts only a strictly greater revision, so stale snapshots cannot regress a newer step or resurrect Working after renderable output cleared it.
   `turn_begin` initializes only an empty addressed panel, treats the same `turnId` as an idempotent duplicate, and rejects a different active ID. Every later in-flight drain message through `turn_end`, including `status_update`, carries the bound `threadId`/`turnId` and is rejected client-side when it does not match the addressed current turn. Post-terminal `chat-turn:saved` and metadata acknowledgements instead correlate to pending/completed messages by `threadId + turnId` or `threadId + exchangeId` after `currentTurn` clears.
4. An active step displays the existing animated hourglass and `Working… Ns` after the orb transition.
5. The first non-empty thinking text, assistant text, or tool call replaces Working through the normal flow.
6. A post-tool step starts a new timer and renders after the existing tool segment.
7. Empty/whitespace-only initial thinking or content produces no live segment, durable assistant part, blank history block, broadcast, or activity clear; whitespace continuation after a real same-type part is preserved exactly.
8. Duplicate/stale/wrong-route events cannot reset or leak activity across turns or threads, including a same-step duplicate after visible activity cleared and interleaved events from two active threads on one WebSocket. Client tool arguments, grouping, and subagent bookkeeping remain isolated by thread/turn for the full active assistant turn.
9. Stop, interruption, errors, authentication failure, and normal completion all clear activity and cannot strand finalization in interactive or headless automation runtimes.
10. Thread switching/reconnect restores an in-flight activity with its original start time.
11. Working is absent from SQLite, saved exchanges, assistant parts, and historical rendering.
12. Harnesses without step-start support retain current fallback behavior.
13. The changing second count is not announced once per second by assistive technology.
14. Focused server tests, client lint/build, deterministic Playwright coverage, and the full server suite have been run with results recorded.
15. The Chat system documentation and RCC-0108 reflect the implemented contract and evidence.
16. A harness/runtime/authentication failure after `turn_begin` produces exactly one routed error `turn_end`, clears Working, preserves partial output, and renders one inline terminal error after that output.
17. A pre-turn or unscoped transport failure produces no transcript error, while a post-turn companion `error`/`auth_error` cannot duplicate the inline row or mutate another turn.
18. Terminal errors use the existing shared error-presentation vocabulary, persist only as a normalized safe envelope in exchange metadata, rehydrate in history, announce once, and never expose raw provider objects, codes, text, stacks, or secrets. OpenCode authentication, timeout, and process-exit signals are classified in the OpenCode boundary; shared code consumes exact provider-neutral markers and contains no provider-code/message classifier. An unmarked failure from a resumable historical non-OpenCode adapter remains durable but uses `MODEL_RESPONSE_FAILED`.
19. Each accepted iterator has a unique `drainId`; every mutation, stop, terminalization, and cleanup is compare-checked against the active drain/turn so a late callback cannot affect a replacement drain.
20. A terminal error retained in a terminal live snapshot survives reconnect before save acknowledgement and merges with saved metadata without a duplicate row; `chat-turn:saved` still attaches `exchangeId` and releases completion/reply-chrome gating after the live turn has cleared.
21. `chat:step_begin` and affected chat lifecycle events remain on the documented pre-40b2 compatibility path and do not enter canonical admission or carry accepted-only relationships.
22. Every new/extracted file is at or below 400 lines and every touched file has one describable job. The explicitly exempt one-job `LiveSegmentRenderer.tsx` remains unsplit, and its effect-based exactly-once completion dependency graph is preserved by regression coverage.
23. The direct legacy `StepBegin` branch and `stepNumber` client field are deleted, and stale-symbol sweeps find no remaining compatibility shim.
24. `ThreadRuntimeManager` preserves the existing monotonic `LiveTurnSnapshot.streamSeq` as the authoritative whole-turn stream frontier; every accepted in-flight publication carries the resulting sequence, `activityRevision` remains a narrower Working-state ordering mechanism, and no duplicate `streamRevision` is introduced.
25. Returning to a completed thread renders the durable or terminal result immediately. Returning to an in-flight thread installs snapshot content through sequence `N` as already revealed and animates only mutations after `N`; it never resumes from the stale reveal position that was visible when the user left.
26. Snapshot/live-message races are deterministic: events at or below the accepted baseline are not replayed, events above it are applied exactly once in order, and hydration of one thread cannot reset or delay another thread.
27. The ordinary transcript, live snapshot, lifecycle messages, and exchange metadata contain only the fixed safe terminal-error catalog and optional opaque `diagnosticId`; they never contain a diagnostic report or raw provider failure material.
28. OpenCode can construct only the closed, bounded, redacted diagnostic candidate approved in R5A. The bound diagnostic service validates it again, persists it in the dedicated table, and returns it only for an exact `workspaceId + threadId + turnId + diagnosticId` match. Raw capture data is discarded rather than persisted.
29. Diagnostic validation, persistence, cleanup, expiry, or retrieval failure never blocks or changes terminalization. Missing/unavailable diagnostics produce one fixed safe response and no fallback raw-data path.
30. View and Copy expose only the retrieved redacted report. Ask AI places that report into the composer for user review and never sends automatically; mounting or hydrating an error never retrieves or injects diagnostic content.

## 9. Implementation Handoff

The expanded product scope and technical decisions are owner-resolved; `RCC-0108-implementation-readiness-issues.md` is the closed decision record. The final packaging review is complete and the linked implementation roadmap is ready. Builders must preserve unrelated dirty-worktree changes, implement in approved dependency order, and stop if current code contradicts an approved lifecycle rule rather than silently changing the contract.

Recommended order:

```text
SPEC-01 runtime drain ownership
  -> SPEC-02 server step activity and stream frontier
    -> SPEC-03 server terminal errors and diagnostics
      -> SPEC-04 client routing and frontier restoration
        -> SPEC-05 presentation, integrated acceptance, and documentation
```

The central invariant is simple: **step activity is truthful, transient state; readable thinking remains real model output; only harness adapters understand provider syntax.**
