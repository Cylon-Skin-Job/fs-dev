---
name: Stop And Interrupted Turns
description: Server-owned stop behavior and persistence rules for partial assistant replies.
metadata:
  incoming-edges:
    - Chat Rendering And Lifecycle
  outgoing-edges:
    - Turn Finalization
  source-files:
    - fusion-studio-server/lib/wire/terminal-saved-delivery.js
    - fusion-studio-server/lib/wire/wire-broadcaster.js
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/lib/thread/provider-termination.js
    - fusion-studio-server/lib/thread/runtime-stop.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - fusion-studio-client/src/state/slices/chatSlice.ts
  connected-skills: []
  related-trigger-files: []
---

Stop is server-owned.

When Stop is clicked, the server synthesizes an interrupted canonical
`turn_end`, persists the partial assistant exchange through the normal path, and
cools or stops the runtime.

`runtime-stop.js` owns Stop through the existing runtime command facade.
It captures the exact drain/provider and compares ownership after each await;
late retirement cannot stop or cool a replacement. Provider retirement failure
retains the STOPPING fence until proven termination through lifecycle retirement. Interactive and automation iterators share
the canonical drain API; completed empty/pre-begin-failed iterators release
owned orphan drains unless that retirement fence remains necessary.

## UI Rule

After Stop is clicked:

1. Streaming tokens stop or are being forced to stop.
2. The composer button area shows a spinning pinwheel/finalization visual.
3. The control is unclickable during normal finalization.
4. If finalization/save fails, the same visual becomes clickable again so the
   user can retry finalization.
5. Send returns only after `chat-turn:saved` confirms the exchange id.

Interrupted exchanges still need `exchangeId` before saved-turn chrome actions
can activate.

### Terminal delivery and provider exit ownership (SPEC05D integration)

Stop waits for the existing bounded event-effect barrier for its exact
workspace/root/epoch/thread/turn before removing the provider route. This keeps
`chat-turn:saved` deliverable after the interrupted exchange commits. A three
second effect timeout still terminates the captured provider and releases the
exact session after proven termination. A transport-only listener can forward
one genuine late saved ACK for up to30seconds; it is canceled on ACK, failed or
settled effects, Stop failure, connection close, or its deadline. A shared
event-local delivery receipt prevents duplicate normal/fallback sends. Exact
connection generation, runtime ownership and provider-session checks prevent
replacement delivery. After the deadline, eventual persistence requires normal
history/reconnect recovery; a failed save never invents an ACK. The existing
effect drain accepts cancellation so every fallback timer is released.
The session's active Stop-finalization token and existing close promise prevent
its provider-exit observer from starting competing retirement. Observed exits
are retained on that exact session; releasing the token schedules at most one
reconciliation if the session still exists. Reconciliation rechecks the exact
session after queued work and drain retirement. Metadata suspension completes
before provider admission is released; late cleanup cannot cool a replacement.


### Observed exit after failed drain retirement

An accepted drain can exist before `turn_begin`. If bounded Stop fails and its
exact provider later exits, SessionLifecycle waits up to five seconds for that
captured iterator to settle, including a rejected completion, instead of replaying
the cached failed Stop. It clears only the still-owned completed drain through
the canonical runtime API and suspends metadata before releasing the session.
Active Stop ownership and session/runtime/drain replacements are rechecked across
awaits and before/after metadata. Still-pending completion or failed metadata
retains the discoverable session for an explicit retirement retry; no saved ACK
is fabricated and no additional provider signal is sent after observed exit.
