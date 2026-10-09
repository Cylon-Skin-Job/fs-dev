# Isolated native / original-symptom receipt — pending

This checklist does not constitute acceptance. Run only when the owner is ready to participate, after autonomous gates/review are complete. Candidate hashes and completed gate references belong in IMPLEMENTATION-REPORT.md before handoff. No live Fusion/Alpha profile, owner window, port3001, unlock, settings change or dependency install is required or authorized by this recipe.

## Fresh renderer, ten-minute bounded window

From `/Users/rccurtrightjr./projects/fs-dev`:

```sh
FUSION_CHAT_ARCH_NATIVE_MANUAL_MS=600000 /usr/bin/caffeinate -d node fusion-studio-client/e2e/chat-architecture/run.mjs --suite native --mode enforce
```

The runner stages the current built candidate into marked disposable directories with migrated isolated SQLite, fixed F2 history and F3 inventory, canonical deterministic provider and ephemeral server port. `ISOLATED_NATIVE_MANUAL_READY` identifies the exact fixture PID/profile/workspace/thread; interact only with that window. The manual window lasts ten minutes and saves event/value observations every twenty seconds. Normal completion closes owned Electron/server children and removes fixture roots; verify native-input-result.json and run-result.json cleanup. Ctrl+C terminates the owned runner tree; do not quit/kill unrelated Fusion/Electron instances. The outer deadline is15minutes. A process-lifetime display assertion does not unlock or waive foreground checks.

The initial automated keyboard/paste results are separate from the manual receipt. Exit2 intentionally means owner/native acceptance remains pending; record the actual manual results and owner statement externally instead of treating an exit code as acceptance. A fresh renderer is not evidence of the same post-soak heap.

## Same renderer after the complete soak

If owner judgment must include the actual post-soak state, schedule an owner-ready run:

```sh
FUSION_CHAT_ARCH_POST_SOAK_MANUAL_MS=180000 /usr/bin/caffeinate -d node fusion-studio-client/e2e/chat-architecture/run.mjs --suite soak --duration-ms 2700000 --mode enforce
```

This performs the entire45-minute workload first, then opens a three-minute observation window only after all automated soak assertions pass, within the55-minute owned deadline. The READY identity labels this as the same post-soak renderer. The app is not left alive awaiting an absent owner. Restarting the separate native command does not recreate the post-soak heap.

## Minimum methods and expected results

Record method/input source, exact intended text, exact final text, timestamp and pass/fail for each; retain the generated trusted beforeinput/input/composition trace and any overflow count.

1. Physical OS keyboard: clear only the fixture composer, type `native keyboard 2227ebc2`, then space/punctuation to test word-boundary correction. Expected: all intended characters retained; any deliberate correction or unintended change explicitly recorded with event sequence. A later exact result does not explain06A's prior `2227ebc2nd` observation.
2. Native paste and emoji: paste `native paste 😀 café 日本語`; exercise Character Palette selection if available. Expected: exact single insertion and retained Unicode; no duplicate/lost characters. Clipboard paste alone is not IME evidence.
3. Autocomplete/text correction: use the actual OS method available to the owner and record suggestion acceptance/cancellation separately. Expected: only the deliberately accepted replacement occurs, with exact final text. Do not inspect personal replacement dictionaries.
4. Real IME: identify an actually available composing input method; start composition, update candidates, commit and cancel separate compositions. Expected: native composition events, correct committed text, canceled preedit absent, no accidental Send while composing. Synthetic browser composition events are insufficient. Current capability inventory established U.S. keyboard selection only; an unavailable real IME remains an external capability gap, not a passed item. No input-source/security configuration change is part of this recipe.
5. Send/state clarity: send a short synthetic prompt, observe pending acceptance, assistant working/streaming and finalization, then Stop and Send again. Expected: clear outcome, one accepted user message per request, editable recovery and no stuck wheel.
6. Original symptoms: type in long F2 history, switch groups/views, Move/Open/Close Side Chat and stream two sessions. Stop each independently. Expected: responsive typing, retained drafts, continued peer stream and no freeze during switching/streaming. For sustained-use judgment, use the same-post-soak mode above.

## Required owner receipt

Record exact candidate source/build hashes, runID/PID/lifetime mode, methods actually exercised, timestamps, all discrepancies, and an explicit owner statement addressing: typing responsiveness; Send outcome clarity; no freeze while switching/streaming; no freeze after sustained use. Record pending items verbatim. No response, an automated pass, or generic approval of code changes is not native/original-symptom acceptance.06B and06C remain gated until the explicit required receipt is accepted by root/supervisor.
