# COMPOSITION02 — corrected native composition retest

Run `chat-arch-1790480161136-42069438e6`, frozen B20 source1957 SHA326555b1e0b465e19a0170a2e032dcac0e02b51ee9f6f80048425ceea3bff9c8/build200 SHAb070d633863382e48ea2f6d677a92cfe65b9a4dea79caa87975711c109c70b03. Both fresh B20 code gates CLEAN before launch; B20-REPORT/B20-BUILDER-REVIEW and root acceptance review retain lifecycle. No source/build/test overlap.

Command: `/usr/bin/caffeinate -d node fusion-studio-client/e2e/chat-architecture/run.mjs --suite native --mode enforce --cases R9-NATIVE-COMPOSITION-CONTROL`. Exec98546, stdout composition-02.log; raw under roadmap/evidence/spec-01/01B/runID. Runner2430/supervisor2442/finalElectron3153/window1. Profile ownedroot/native-profile; workspace ownedroot/native-workspace/native-input, ownedroot `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/chat-arch-1790480161136-42069438e6-mkULua`. Initial thread2026-09-26T20-36-05-558. READY03:36:07.571UTC; observer ended03:46:07.639UTC,600068ms. Case608302ms/exit0, no timeout/interruption/leak. Fixed10minute/hard15minute unchanged.

Supervisor exclusively operated native CUA on the exact marked isolated window. Initial connection attempts timed out before input; recovery succeeded within the existing window, without extending it or changing fixture/settings. This capability delay is not a product failure. Builder only read durable raw/progress and made no UI input. No owner symptom acceptance is implied.

## Corrected first-event ownership

Final raw native-composition-control-result.json:443 retained records, zero overflow/truncation, observerRemovedtrue. Both separated and same-call pairs retain all trusted/untrusted events.

- Composer Escape first events7/85, sequences9/116: trusted keydown229/isComposingtrue, unprevented. Later ordinary Escape events13/91, sequences15/122 still see singleaccent. Blur follows that second ordinary key (sequence16 for first pair), unlike COMPOSITION01 where blur preceded the second key. Later snapshots may show BODY focus because ordinary Escape has already run; that does not mean the first key blurred.
- Composer Enter first events43/126, sequences59/176: trusted229/composingtrue; same-event later snapshots67/184 remain defaultPreventedfalse. Later ordinary Enter events49/132, sequences65/182 are defaultPreventedtrue in snapshots69/186; blur follows second ordinary delivery. This directly contrasts pre-repair COMPOSITION01 first events66/144 becoming prevented. Second ordinary delivery remains normal behavior, not suppressed by a timer or latch.
- Unhandled control retains its original pass-through behavior, including untrusted compositionend and separately delivered ordinary key. These are not assigned to product code. No assertion about the original freeze or all duplicate/native events follows.

## Other exercised methods and limits

Native U.S. Option+e then e commits exacté on both surfaces: realcomposer events168→171trustedinput→172untrustedend; control187→190→191 matches. Backspace first composing206 passes through and retainsaccent through end210, then ordinary212→deleteContentBackward214 leavesempty; control229/235/237 matches. This is a recorded composition-plus-ordinary-delete method, not proof of a distinct native IME cancellation event.

Native typing retained exact `native check 2468`; native paste trustedinput event311/sequence440 retained exact combined `native check 2468 — café 🙂`. OrdinaryEnter event312 submitted that text. Supervisor separately observed exact user bubble/Stop, clickedStop→Send, created/opened newchat with empty composer/Start conversation. Final raw composer snapshot has new thread2026-09-26T20-43-24-212 and emptytext. Native button/row observations come from supervisor CUA receipt; textarea trace alone is not full request/turn-state proof. App filename autocomplete has affected real-component browser coverage and will be covered by current render correctness; no extra native autocomplete method was invented in this run.

Actual event and later-task snapshots are correlated by eventId; per-frame clocks are retained without cross-document subtraction. DOMfocus may be emulated and is not a native foreground/timing gate. Textarea-scoped observation may miss later events after disabling/remount; native final outcomes alone are not used to infer first-key behavior. The separate control is an explicitly labeled diagnostic and never replaces realcomposer acceptance. CharacterPalette/OScompletion are optional methods, not additional mandated gates.

## Cleanup, disposition and remaining work

COMPOSITION-02-CLEANUP.json at03:46:33.642UTC confirms exactowned root/PIDs2430/2442/3153 absent; SQLitequickcheckok, port/rootsremoved, leakedOwnedPids empty, all1957source/200build hashes match. Protected supervisor55084alive and untouched.

B20 actual first-composing-key repair is supported by paired native evidence in addition to23browser tests/build. Runtime helper status is diagnostic completion, not automatic fullnative/06Bacceptance. Root owns normative method/acceptance disposition. Current V-RENDER/five-minute and true45minute V-SOAK remain pending on rebuilt candidate; explicit timestamped owner original-symptom judgment remains separate. Prior VRENDER03 is historical. No06C or automatic follow-on; next current VRENDER requires root GO after cleanup. No new deviation/sourcechange in this run; preserve all COMPOSITION01/NATIVE05/SOAK03 red evidence.
