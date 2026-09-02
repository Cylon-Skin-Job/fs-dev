---
name: Chat Composer
description: Composer behavior, send/stop/finalization button states, and attachment/input rules.
metadata:
  incoming-edges:
    - Chat UI
  outgoing-edges:
    - Stop And Interrupted Turns
  source-files:
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-client/src/state/chatComposerDraftStore.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-client/src/screenshots/chatScreenshotCapture.ts
    - fusion-studio-client/src/hooks/useFileAutocomplete.ts
    - fusion-studio-client/src/lib/chat-file-links/file-autocomplete-match.ts
  connected-skills: []
  related-trigger-files: []
---

The composer is the user input and turn control surface.

## Rules

- The user bubble is committed on server `message:sent`, not optimistic click.
- `Send to chat` attachments render as metadata-backed pills above the input.
- The textarea stays plain user text.
- During finalization after output end or Stop, the button area can show a
  spinning pinwheel visual and remain unavailable until the saved exchange ack.
- Send returns only after the turn is fully viable for the next prompt.

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
