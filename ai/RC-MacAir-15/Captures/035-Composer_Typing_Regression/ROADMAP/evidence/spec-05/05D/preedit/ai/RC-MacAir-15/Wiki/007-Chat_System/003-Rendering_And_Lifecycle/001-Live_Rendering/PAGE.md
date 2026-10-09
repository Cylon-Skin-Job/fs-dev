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
    - fusion-studio-client/src/components/chat/WorkingActivity.tsx
    - fusion-studio-client/src/lib/ws/tool-result-helpers.ts
    - fusion-studio-client/src/lib/ws/turn-lifecycle.ts
    - fusion-studio-client/src/lib/ws/stream-handlers.ts
    - fusion-studio-client/src/lib/ws/activity-stream-handler.ts
    - fusion-studio-client/src/state/slices/chatActivityState.ts
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

## Transient Working Activity

Provider-neutral `step_begin` projects one transient `TurnActivity` outside
`StreamSegment` and `AssistantPart`. After the existing orb disposal,
`LiveSegmentRenderer` shows `HourglassFlow size="sm"` plus
`Working… Ns` only when the activity belongs to the current turn and all
queued segments have revealed. Output arriving during orb collapse clears the
activity, so Working never flashes. A post-tool step waits behind the revealed
tool row.

Elapsed whole seconds are recomputed from the server `startedAt`, preserving
the original time across thread return. The changing seconds are aria-hidden;
one stable `Model working` status is announced per appearance. Reduced-motion
mode keeps the status visible and clamps the hourglass animation.

The seen-step ledger is unioned for the full active turn. Only a strictly
greater `activityRevision` may set, replace, clear, or restore Working. Equal or
lower revisions cannot resurrect it, while valid content/tool handling still
follows `streamSeq` unconditionally.

`LiveSegmentRenderer.tsx` remains the documented one-job, do-not-split
completion pipeline. Pure presentation children may be extracted, but its
effect-based exactly-once completion graph stays intact.
