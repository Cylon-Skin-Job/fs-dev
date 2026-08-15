# Runtime-2S: Target-Aware Sending State Repair

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Why This Repair Exists

Runtime-2R fixed the immediate input-clear and pending-target matching bugs.
However, `useChatArea` still uses component-local `isSending` for visible
orb/stop state.

Current risk:

1. User sends from thread A.
2. Runtime acceptance is pending.
3. User browses to thread B.
4. Acceptance event for A arrives.
5. `useChatArea` correctly matches pending A, but then calls `setIsSending(true)`
   in the currently mounted chat area.
6. Thread B can show the orb/stop state even though B is not sending. Since A's
   stream segments route to A, B may never clear that local `isSending`.

This is the last Runtime-2 client repair before Runtime-3 live snapshots.

## Objective

Make post-acceptance sending/orb/stop UI target-aware so a prompt accepted for
thread A cannot light up or stick the composer for thread B.

## Scope

Do:

- Replace or wrap component-local `isSending` with target-aware state.
- Ensure `showOrb` and `isTurnActive` are true only for the currently rendered
  thread.
- Ensure acceptance for A after browsing to B clears pending state without
  showing B's orb/stop UI.
- Ensure A still shows active state when viewing A after acceptance and before
  first segment.
- Ensure sending state clears when routed segments arrive for the same target.

Do not:

- Implement live snapshot overlay.
- Implement server-owned stop/interrupt.
- Add warm-on-focus/insertion.
- Change server prompt routing unless a directly related issue is discovered.
- Redesign all chat state.

## Current Code Seams

Inspect:

- `fusion-studio-client/src/components/chat/useChatArea.ts`
  - `isSending`
  - `pendingPromptRef`
  - `fusion:prompt-accepted`
  - `fusion:prompt-acceptance-failed`
  - `showOrb`
  - `isTurnActive`
- `fusion-studio-client/src/components/ChatArea.tsx`
  - passes `showOrb` to `MessageList`
  - passes `isTurnActive` through `ChatAreaFooter`
- `fusion-studio-client/src/components/chat/ChatAreaFooter.tsx`
  - swaps send button vs stop button based on `isTurnActive`
- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
  - stream messages already route by explicit `scope` + `threadId`

## Acceptable Approaches

### Preferred Minimal Approach

Use a target ref/state for accepted-but-not-yet-streaming prompts:

```ts
const [sendingTarget, setSendingTarget] = useState<{
  scope: Scope;
  threadId: string;
} | null>(null);
```

Then derive:

```ts
const isSendingForCurrentThread =
  sendingTarget?.scope === scope &&
  sendingTarget.threadId === currentThreadId;

const showOrb =
  (isSendingForCurrentThread || currentTurn?.status === "streaming") &&
  segments.length === 0;

const isTurnActive = !!currentTurn || isSendingForCurrentThread;
```

On accepted event for pending target:

- clear pending prompt
- clear input
- set `sendingTarget` to accepted target
- do not set a plain boolean that applies to whatever thread is currently shown

When segments arrive:

- only clear `sendingTarget` if it matches the currently rendered route and
  `segments.length > 0`
- or clear on a routed event custom signal if the worker chooses to add one

On failure:

- clear pending prompt
- if the failure target matches `sendingTarget`, clear `sendingTarget`
- preserve input text

### Store-Based Approach

If the local hook approach becomes awkward, add a small per-target pending state
to the chat slice. Keep it narrowly scoped. Do not build a general runtime state
store in this slice.

## Required Behavior

1. Send from A, stay on A:
   - pending loader while warming
   - user bubble on acceptance
   - orb/stop state only for A until first segment

2. Send from A, browse to B before acceptance:
   - B must not show A's orb or stop button after A is accepted
   - B send button must not remain disabled because A accepted
   - A's user bubble must still be committed to A by `message:sent`

3. Return to A after acceptance but before first segment:
   - A may show orb/stop state if no segment has arrived yet

4. First segment for A:
   - A's pre-stream sending state clears
   - normal `currentTurn`/segments rendering owns the UI

5. Acceptance failure:
   - no phantom user bubble
   - composed text remains
   - no thread remains stuck with disabled send button or orb

## Required Tests / Checks

If a suitable React/hook test pattern exists, add focused tests for:

1. Accepted event for A while current thread is B does not make B active.
2. Accepted event for A sets sending target for A.
3. Segments for A clear A's sending target.
4. Failure clears pending state and preserves text.

If no harness exists, document that and cover the manual smoke below.

## Acceptance Searches

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
rg -n "const \\[isSending|setIsSending\\(true\\)|showOrb|isTurnActive|sendingTarget|pendingPromptRef" fusion-studio-client/src/components/chat/useChatArea.ts
```

Expected:

- no plain `setIsSending(true)` in an acceptance handler
- `showOrb` and `isTurnActive` are derived from a target match
- pending prompt matching remains target-based

## Validation

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/components/chat/useChatArea.ts src/components/chat/ChatAreaFooter.tsx src/components/ChatArea.tsx
```

Repo:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Restart:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Manual smoke:

1. Send from thread A and stay on A.
2. Verify the send loader becomes user bubble/orb, then normal stream.
3. Send from A and immediately browse to B before acceptance.
4. Verify B does not show A's orb/stop state and does not stay disabled.
5. Return to A and verify A has the accepted user bubble and appropriate active
   state.
6. Trigger a warm/auth failure if practical and verify the composed text remains
   and no thread is stuck disabled.

## Worker Report Requirements

Report:

- Files changed.
- Whether target-aware sending state is local or store-backed.
- Build/lint results.
- `git diff --check` result.
- Restart smoke result.
- Manual smoke observations for browse-during-pending behavior.
