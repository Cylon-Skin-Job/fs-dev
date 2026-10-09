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
  last-modified: "2026-10-06T22:15:19Z"
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

The Add menu's **Take screenshot** action snapshots this composer's exact workspace, view, Thread group, chat session and mounted-surface lifetime before its first await. The view's Main Chat follows the selected Thread group and current primary session; an explicit Main content component keeps its hydrated session independently of the outer rail. A Side Chat keeps its own session and open service-managed placement when Main Chat selection changes.

Ownership is checked before capture, after native capture and after the correlated saved-PNG response. A changed destination workspace, owning view or chat session, an inactive or unmounted composer, or a closed Side Chat placement cancels attachment with a fixed safe status. Changing the selected Thread group also cancels a view-bound Main capture. Content components retained in a hidden view are cancelled too; returning to the same view or session does not revive that old capture. If saving has already begun, its PNG can remain in the gallery, but no attachment is added to another chat. The global header camera has its own Main Chat/Legacy resolution; [Screenshot Capture](../../../004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md#in-app-captures-and-attachments) owns that behavior and the separate gallery and workspace-preview paths.

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
