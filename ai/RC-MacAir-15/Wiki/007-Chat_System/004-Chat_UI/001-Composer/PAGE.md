---
name: Chat Composer
description: Composer behavior, send/stop/finalization button states, and attachment/input rules.
metadata:
  source-files:
    - fusion-studio-client/src/lib/chat/side-chat-placements.ts
    - fusion-studio-client/src/state/slices/chatSurfaceSlice.ts
    - fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx
    - fusion-studio-client/src/components/chat/ChatSurface.tsx
    - fusion-studio-client/src/components/chat/ChatComposerAddMenu.tsx
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - fusion-studio-client/src/components/chat/useChatSessionHost.ts
    - fusion-studio-client/src/components/chat/useChatSessionActions.ts
    - fusion-studio-client/src/components/chat/ConnectedChatComposer.tsx
    - fusion-studio-client/src/state/chatComposerDraftStore.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-client/src/screenshots/chatScreenshotCapture.ts
    - fusion-studio-client/src/hooks/useFileAutocomplete.ts
    - fusion-studio-client/src/lib/chat-file-links/file-autocomplete-match.ts
    - fusion-studio-client/src/lib/chat-action-controller.ts
    - fusion-studio-client/src/lib/chat-action.ts
    - fusion-studio-client/src/lib/chat-material-target.ts
    - fusion-studio-client/src/lib/chat-material-commit.ts
    - fusion-studio-client/src/state/slices/mountedChatState.ts
    - fusion-studio-client/src/components/chat/useMountedChatBinding.ts
    - fusion-studio-client/src/components/chat/useComposerMaterialSource.ts
    - fusion-studio-client/src/lib/chat-material-source.ts
  last-modified: "2026-10-07T20:18:16Z"
---

The composer is the user input and turn control surface. `ChatAreaFooter.tsx` presents the input and Send/Stop/finalization states. `useChatSessionHost.ts` composes the session identity and presentation; `useChatSessionActions.ts` supplies exact-session send, Stop, attachment and diagnostic Ask AI actions, and `ConnectedChatComposer.tsx` subscribes to the addressed draft, attachments and submission state; `chatComposerDraftStore.ts` and `chatFileLinkStore.ts` retain their respective owner-keyed data.

## Rules

- The user bubble is committed on server `message:sent`, not optimistic click.
- `Send to chat` attachments render as metadata-backed pills above the input.
- The textarea stays plain user text.
- During finalization after output end or Stop, the button area can show a
  spinning pinwheel visual and remain unavailable until the saved exchange ack.
- Send initiation is not acceptance or completion. Pending/unknown submission and finalization keep the composer gated; acknowledgements and exact-session recovery determine when another prompt is viable.

The composer should not infer persistence success from the last visible token.

## Workspace And Thread Ownership

Draft text, pending prompt acceptance, retry text, and pending attachments are
owned by the exact `workspaceId + threadId`, not by the currently visible
panel. Switching threads immediately displays that owner's draft. Prompt send
snapshots the accepted composer text and attachment IDs; success clears only
that exact owner/accepted set, while failure preserves a retryable draft and
attachments. A late acknowledgement for thread A cannot mutate thread B.
Pending acceptance survives an owning chat surface's temporary unmount/remount,
including a side-chat content-tab switch, because the exact session owns it.

## Prepared material ownership

Global **Send to Chat** and the header camera synchronously capture the last actually active, open, mounted Main or Side composer in the foreground view before preparing their source. A resource's panel and content root select the source; they do not select the destination. Missing, stale, closed or unhydrated activity produces unavailable feedback without falling back to Main, Legacy or `currentThreadId`.

Every Add-menu camera, saved screenshot, clipboard selected/top item, recent selected/top file and microphone operation captures its own committed composer binding before preparation. Diagnostic **Ask AI** captures that same owner before retrieval and appends its validated redacted report. The existing Chat action consumer validates the immutable workspace/view/group/session/surface tuple, mount generation, workspace binding and exact open Side placement, then commits prepared text or one attachment synchronously through the existing draft or attachment store. These material operations only compose for review; they do not Send or create a chat.

Another chat or view gaining focus does not cancel an operation whose originating composer remains mounted, hydrated and bound. Main content components and open Side placements keep their exact sessions independently of unrelated outer Main selection. Actual rebind, unmount, closure, session or hydration loss, workspace binding retirement, or Side placement replacement invalidates the operation permanently; returning with the same strings cannot revive an older generation. View-bound Main selection changes its actual binding and cancels older work. Pending prompt acceptance blocks insertion; an unknown outcome allows composition but still blocks another Send.

Cursor replacement uses the latest exact-owner draft and current selection only when its live binding, value, revision and offsets agree. Intervening typing is retained; stale selection safely appends prepared text. Presentation restores caret only through that live owner and never steals focus from another active editor. Duplicate mounts share session drafts/pills but retain independent menu, selection and lifetime state. Existing eligible composer and screenshot warming targets the captured thread; warming remains separate from local insertion and server acceptance. Global resource and diagnostic insertion add no warm path.

Camera capture/save remains source-owned. It checks shared validity after native capture before saving, then uses the correlated saved absolute path at shared commit. Cancellation before save sends no save request; cancellation after save may leave a gallery PNG without any pill. [Screenshot Capture](../../../004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md#in-app-captures-and-attachments) describes correlation and the separate gallery/preview paths.

## Diagnostic Ask AI

The terminal-error **Ask AI** action retrieves and validates the redacted
report only after the click, then appends it to the exact owner's composer for
review/editing. It never sends. It cannot overwrite a prompt awaiting
server-owned acceptance; the action stays retryable after that acceptance
settles.

## Filename Autocomplete

Filename autocomplete is plain textarea text, not a mention or attachment
system.

- The ghost suffix is advisory until accepted.
- `Tab` and non-shift `Enter` accept the active suggestion.
- `Space` does not accept the suggestion; it must remain available for rejecting
  ghost text and continuing a new word.
- The ghost overlay renders the full typed prefix invisibly plus the visible
  suffix. Keep it typography-compatible with the textarea so wrapping and cursor
  position stay aligned.

## Conversation continuation

The composer does not clone or inherit another chat's context. **Send to Chat**
is the explicit path for bringing selected prior material into this composer.
Moving a primary chat to a side tab creates a separate, cold, empty primary
composer and does not prefill it.
