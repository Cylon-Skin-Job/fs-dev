# Runtime-2R: Acceptance UI Repair

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

## Why This Repair Exists

Runtime-2 moved prompt acceptance through the server runtime and removed the
optimistic user bubble from the send button path. The server side looks mostly
correct after review, including `handleMessageSend()` returning `true` on
success.

However, the client still has acceptance-state bugs:

1. `ChatInput` clears textarea text immediately when Enter sends.
2. `useChatArea` clears pending state only when the acceptance event matches
   the currently selected thread, not the thread that was pending when Send was
   clicked.

That means:

- Enter can still lose input before server acceptance.
- Warm/accept failure after Enter can leave the user with no composed text.
- If the user sends from thread A, then browses to thread B before acceptance,
  the acceptance/failure event for A can be ignored and the composer can stay
  stuck in warming/disabled state.

## Objective

Make the client acceptance UI truly target-bound and non-optimistic for both
send-button and Enter-key sends.

This is a repair slice. Do not expand into Runtime-3 live snapshots or Runtime-4
stop semantics.

## Scope

Do:

- Ensure no send path clears the input until server acceptance.
- Track the pending prompt target at send time:

```ts
{
  scope: "project" | "view";
  threadId: string;
  text: string;
}
```

- Use that pending target, not the current selected thread, to clear
  acceptance pending state on `fusion:prompt-accepted` and
  `fusion:prompt-acceptance-failed`.
- Keep the send button/dropdown disabled while acceptance is pending.
- Preserve the composed text on acceptance failure.
- Add focused tests if a local frontend test pattern exists; otherwise document
  the manual smoke explicitly.

Do not:

- Implement live snapshot overlay.
- Implement server-owned stop.
- Add warm-on-focus/insertion unless it is already present and needs only a
  small bug fix.
- Change server prompt routing unless a directly related bug is discovered.

## Current Code Seams

Inspect:

- `fusion-studio-client/src/components/ChatInput.tsx`
  - `handleSend()` currently calls `setText('')` immediately after `onSend()`.
- `fusion-studio-client/src/components/chat/useChatArea.ts`
  - `isAcceptancePending`
  - `acceptancePendingRef`
  - `fusion:prompt-accepted` listener
  - `fusion:prompt-acceptance-failed` listener
  - `handleSend()`
- `fusion-studio-client/src/components/chat/SendButtonGroup.tsx`
  - already avoids clearing text in the click path; preserve this.
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
  - `message:sent` commits the user bubble and dispatches
    `fusion:prompt-accepted`.
- `fusion-studio-client/src/lib/ws/stream-handlers.ts`
  - `auth_error` / `error` dispatch `fusion:prompt-acceptance-failed`.

## Required Behavior

### Enter Key

Pressing Enter to send must:

1. call `onSend(text.trim())`
2. keep textarea text visible while acceptance is pending
3. disable/freeze input/button while pending
4. clear textarea only after accepted event for the pending target
5. leave textarea text intact after failure

### Send Button

Clicking Send must keep the Runtime-2 behavior:

- no optimistic bubble
- no immediate clear
- small spoke/wheel warming indicator
- disabled against double-click
- clear only after acceptance

### Browse During Pending Acceptance

If the user sends from A, then browses to B before acceptance:

- `message:sent` for A still commits the user bubble into A's chat state
  through `thread-handlers.ts`.
- The acceptance pending UI must clear when A's acceptance/failure event arrives.
- The event match must use the pending target captured at send time, not
  `currentThreadId` after browsing.
- Do not start a B prompt accidentally.

## Suggested Implementation

In `useChatArea.ts`, replace the boolean-only ref with a target ref:

```ts
const pendingPromptRef = useRef<{
  scope: Scope;
  threadId: string;
  text: string;
} | null>(null);
```

On send:

- if `pendingPromptRef.current` exists, return
- resolve target thread ID
- set `pendingPromptRef.current = { scope, threadId: tid, text }`
- set `isAcceptancePending(true)`
- call `sendMessage(text, scope, tid)`

On accepted:

- compare event detail to `pendingPromptRef.current`
- if it matches, clear pending ref/state, clear input, set `isSending(true)`,
  and mark `justSentRef`

On failed:

- compare event detail to pending target when detail includes route metadata
- clear pending ref/state
- do not clear input
- set `isSending(false)`

In `ChatInput.tsx`, remove the immediate `setText('')` from its Enter send
path. Keep `clearText()` as an imperative method so `useChatArea` can clear on
acceptance.

## Required Tests / Checks

At minimum, add or update tests if the project has a suitable local pattern for
React component/store tests. Cover:

1. Enter-key send does not clear input before accepted event.
2. Accepted event clears input.
3. Failed event keeps input text.
4. Pending target A clears pending state even if current selected thread is B.

If no frontend test pattern exists, document that and run the manual smoke below.

## Acceptance Searches

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
rg -n "setText\\(''\\)|clearText\\(\\)|currentThreadId\\) return|detail\\.threadId !== currentThreadId|acceptancePendingRef" fusion-studio-client/src/components/ChatInput.tsx fusion-studio-client/src/components/chat/useChatArea.ts fusion-studio-client/src/components/chat/SendButtonGroup.tsx
```

Expected:

- `ChatInput.tsx` does not clear text immediately after `onSend`.
- `clearText()` is still available and used only after acceptance.
- accepted/failed matching is based on pending target, not current selection.
- no boolean-only acceptance ref remains if a target ref replaced it.

## Validation

Frontend:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npx eslint src/components/ChatInput.tsx src/components/chat/useChatArea.ts src/components/chat/SendButtonGroup.tsx src/components/chat/ChatAreaFooter.tsx src/lib/ws/thread-handlers.ts src/lib/ws/stream-handlers.ts
```

Full server tests are not required unless server files are touched. If server
files are touched:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
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

1. Send with the send button from a cold/browsed thread.
2. Verify input does not clear until the user bubble appears.
3. Send with Enter from a cold/browsed thread.
4. Verify input does not clear until the user bubble appears.
5. During send-button or Enter pending state, double-click/press Enter again;
   verify no duplicate user bubble/prompt.
6. Send from A, immediately browse to B, wait for acceptance; verify the UI
   does not remain stuck in warming.
7. If practical, trigger warm/auth failure and verify input text remains.

## Worker Report Requirements

Report:

- Files changed.
- Exact pending-target approach.
- Whether frontend tests were added or why manual smoke was used instead.
- Build/lint results.
- `git diff --check` result.
- Restart smoke result.
- Manual smoke observations, especially Enter-key and browse-during-pending
  behavior.
