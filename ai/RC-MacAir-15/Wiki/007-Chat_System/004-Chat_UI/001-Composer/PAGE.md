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
- Current-head OpenCode thread fork belongs in the composer meta row, nested in
  the icon strip immediately left of the microphone button.
- Composer Fork is available only for idle OpenCode threads with a saved
  `harness_config.opencodeSessionId`; prompt acceptance, streaming, stopping,
  and finalization are all non-idle states.

The composer should not infer persistence success from the last visible token.

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

## Fork Placement

Composer icon row target:

```text
Clipboard   Screenshots   Recent Files   Emoji   Fork   Mic
```

Fork uses `fork_right` and creates a new pending fork thread named:

```text
Fork: {{Original name}}
```

The new thread stores pending OpenCode fork metadata until the user sends the
first prompt. The first prompt consumes that metadata and runs OpenCode with:

```text
--session <sourceOpenCodeSessionId> --fork
```

The new Fusion thread also receives copied saved exchanges from the source
thread up to the fork point so it visually opens with the same prior
conversation history. A brief empty/loading state while the database copy and
thread hydration complete is acceptable. Fork hydration must not rely on the
empty new-thread `thread:created` clear path unless copied exchanges are
hydrated immediately afterward.
