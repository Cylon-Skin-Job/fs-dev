---
name: Chat Message List
description: Message orchestration, where completed reply chrome mounts, and how live/history renderers are composed.
metadata:
  incoming-edges:
    - Chat UI
    - History Rendering
  outgoing-edges:
    - Reply Action Chrome
  source-files:
    - fusion-studio-client/src/components/MessageList.tsx
    - fusion-studio-client/src/components/InstantSegmentRenderer.tsx
    - fusion-studio-client/src/components/LiveSegmentRenderer.tsx
    - fusion-studio-client/src/components/chat/ChatTurnError.tsx
    - fusion-studio-client/src/components/chat/ChatDiagnosticDetails.tsx
  connected-skills: []
  related-trigger-files: []
---

`MessageList` chooses between live and history renderers.

## Rule

Whole-message UI belongs at the message level. Do not mount reply chrome inside
`InstantSegmentRenderer` or `LiveSegmentRenderer`.

For completed assistant messages, mount reply chrome after
`InstantSegmentRenderer` and pass the message source ref, segments, metadata,
disabled state, and callbacks.

Disabled shell states are allowed for finalizing or legacy missing-id messages,
but active actions require a viable `exchangeId`.

## Working And Terminal Errors

`MessageList` passes only the addressed thread's transient Working activity to
the live renderer. Completed/history rows never receive it. An in-flight
snapshot baseline renders instantly without reply chrome until its live tail
terminalizes.

For a completed failed turn, the order is:

```text
InstantSegmentRenderer output
  -> one validated ChatTurnError (one role="alert")
    -> diagnostic actions when a valid diagnosticId exists
      -> completed reply chrome
```

The immediate message envelope wins over validated metadata fallback, so both
sources can never render twice. View, Copy, and Ask AI appear only for a valid
opaque diagnostic ID and fetch only on activation. They display/copy/insert the
same client-validated bounded redacted report; unavailable data uses one fixed
safe state. Diagnostic controls stay outside the alert region.
