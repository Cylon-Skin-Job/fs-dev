---
name: Chat Composer
description: Composer behavior, send/stop/finalization button states, and attachment/input rules.
metadata:
  source-files:
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
  last-modified: "2026-09-28T04:56:08Z"
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

Screenshot capture snapshots `{workspaceId, threadId, surface}` before its
first await and revalidates that owner after capture and save. If the chat
changes, the attachment is cancelled with a fixed safe status rather than
being added to the new chat.

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
