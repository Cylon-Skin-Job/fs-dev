---
name: Live Rendering
description: Live streaming turn rendering, reveal completion, and why finished-turn UI is not mounted inside the live renderer.
metadata:
  incoming-edges:
    - Chat Rendering And Lifecycle
  outgoing-edges:
    - Turn Finalization
  source-files:
    - fusion-studio-client/src/components/LiveSegmentRenderer.tsx
    - fusion-studio-client/src/lib/ws/tool-result-helpers.ts
    - fusion-studio-client/src/lib/ws/turn-lifecycle.ts
    - fusion-studio-client/src/lib/ws/stream-handlers.ts
  connected-skills: []
  related-trigger-files: []
---

Live rendering is for the current streaming assistant turn.

`LiveSegmentRenderer` handles animated reveal and completion detection for the
current turn. It is not the place to mount whole-reply controls that require a
saved exchange id.

## Rule

Finished-turn UI should appear only after the live turn is finalized into a
completed assistant `Message`. During streaming, do not render completed reply
chrome or saved-exchange actions.

If visual chrome is shown during finalization, it must be disabled until the
saved exchange acknowledgement arrives.

Live shell results should consume canonical `toolStatus` the same way history
hydration consumes persisted `statusMessage`. Do not let live and reloaded
history render different shell diagnostics for the same canonical result.
