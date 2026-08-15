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
