# Supervisor native input observations — NATIVE05

Run `chat-arch-1790477152225-c8bfffedfc`, authenticated Electron PID 61914 / window 1, disposable Native Input Fixture, original thread `2026-09-26T19-45-56-740`. Raw evidence under `../spec-01/01B/chat-arch-1790477152225-c8bfffedfc/`. Manual window 2026-09-27 02:46:01.659–02:56:01.659 UTC. Agent actions are not owner acceptance.

CUA app selection initially timed out; a fresh binding succeeded without launching another app. Native AX confirmed `fusion-shell://app/`, Native Input Fixture and the existing exact keyboard/paste test text. All interactions used native CUA; no user/system settings or live-profile state was changed.

## Observed actions

1. Cleared only the disposable composer. Option+e exposed accent preedit `´`; subsequent e yielded exact `é`. Raw events include trusted compositionstart/update and insertCompositionText, but compositionend was untrusted. This is not a blanket native IME pass.
2. With committed `é`, Option+e exposed `é´`; Escape yielded `é´´` and focus moved to HTML body. Cancellation failed the intended result. Raw performance timestamps span 114876–119592 ms for this trial.
3. Cleared the disposable text. Edit menu exposed Emoji & Symbols, Writing Tools and disabled contact/password AutoFill, but no completion command. Emoji & Symbols, Control+Command+Space, and the app's Add emoji to recents entry point did not expose a character palette in inspected AX/screenshot. The latter focused Emoji selection capture. No Character Palette insertion or OS autocomplete accept/cancel pass is claimed; normative requirement versus optional chosen test method must be reconciled separately.
4. Typed `Native CUA send and stop check` into the composer and clicked Send. Composer cleared and Stop generating appeared. Clicking Stop restored Send; exact user text appeared in history. Only the deterministic fixture provider was involved. This is a bounded functional observation, not complete request-state timing evidence.
5. New chat created `2026-09-26T19-50-14-269` asynchronously. Explicitly selected its visible row and observed Start a conversation with empty composer. Switching therefore occurred; initial immediate unchanged AX did not mean creation failed.
6. In that empty conversation, Option+e then Backspace returned the composer to empty and retained focus. Raw events show compositionend(false) followed by ordinary trusted deleteContentBackward, so this does not independently prove IME cancellation semantics.
7. Option+e then Return submitted the accent instead of merely finishing composition: native AX showed user text `´`, emptied composer and Stop generating. Supervisor clicked Stop; Send returned. Raw events show trusted preedit at about 327924.7 ms, untrusted compositionend at 333648.6 ms and later empty composer.

## Attribution limits and next work

The existing observer does not retain keydown flags. All observed compositionend events were untrusted, unlike the starts/updates/composing-input events. Product inspection identified unguarded global Escape blur and composer Enter handling, but these observations alone do not prove that an actually composing keydown reached those handlers: native control tooling or Chromium might commit preedit before delivering the key. Supervisor explicitly required a paired unhandled control and precise event-order evidence before attributing or repairing the anomaly. No untrusted-event suppression or timing workaround is authorized merely to make this tool pass.

Observed unexpected text/submission remains unresolved, not accepted. Keyboard/paste historical passes and these bounded CUA results must remain distinct from owner symptom judgment, full sustained acceptance, exact native composition proof and any optional Palette/OS-completion checks.
