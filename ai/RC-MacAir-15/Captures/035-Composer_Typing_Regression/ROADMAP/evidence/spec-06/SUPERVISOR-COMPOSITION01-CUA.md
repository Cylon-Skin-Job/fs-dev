# COMPOSITION01 supervisor native comparison

2026-09-27 UTC. Agent-operated native CUA; not owner acceptance.

Run `chat-arch-1790478658279-b18e60618b`, Electron PID 32601, window 1, title `ISOLATED COMPOSITION CONTROL — chat-arch-1790478658279-b18e60618b`. Same disposable renderer contains the real composer and an unhandled textarea inside its labeled control iframe. No product changes during observation.

Raw passive trace: `../spec-01/01B/chat-arch-1790478658279-b18e60618b/native-composition-control-result.json` (relative to this report). Preserve trust flags and both key deliveries. No overflow/truncation observed in the 204-event snapshot inspected independently by the supervisor.

| Trial | Action bounds, epoch ms | Visible result |
| --- | --- | --- |
| Control separated Escape | 1790478757364–1790478766707 | Single accent, control focus retained |
| Control separated Return | 1790478773605–1790478780482 | Accent plus newline, control focus retained |
| Composer separated Escape | 1790478798353–1790478968254 | Accent duplicated, focus moved to HTML/body |
| Composer separated Return | 1790478973427–1790478980745 | Composer emptied, Stop generating appeared; agent stopped response by 1790478988675 |
| Control batched Escape | 1790479010829–1790479012892 | Single accent, control focus retained |
| Composer batched Escape | 1790479019224–1790479021270 | Accent duplicated, focus moved to HTML/body |
| Control batched Return | 1790479027528–1790479029540 | Accent plus newline, control focus retained |
| Composer batched Return | 1790479035545–1790479037583 | Composer emptied, Stop generating appeared; agent stopped response by 1790479043083 |

Each fresh trial clears only its disposable field, then native Option+E followed by Escape or Return. Separated trials include an accessibility observation between keys; batched trials do not. Outcomes repeat without that observation gap.

## Causal boundary

Supervisor directly inspected raw events. Composer Escape sequence 63 is trusted keydown, keyCode 229, isComposing true; compositionend 64 (untrusted) and blur 65 occur before second ordinary Escape 69. Duplicate accent exists by sequence 69. Batched sequences 139/140/145/149 reproduce it. This supports interference by the global Escape handler during the first composing key, not merely a later ordinary Escape.

Composer Enter sequence 91 is trusted keydown, keyCode 229, isComposing true. Its same-event later snapshot 94 has defaultPrevented true and body focus; only this composing Enter was recorded before send disabled the field. Batched 199/204 repeats it. Plain-control composing Enter remains unprevented and focused. This supports composer shortcut interception during composition.

Control also receives a later ordinary key after an untrusted compositionend, with an intervening keyup. The repair must not hide that later ordinary delivery using timing suppression or blanket trust filtering. These observations do not establish behavior of every physical IME, and do not prove the original sustained freeze fixed.

Authorized same-chain bounded repair: ignore actual composing keyboard events in relevant app/composer shortcut handlers; retain normal-key behavior. Require regression tests, both fresh reviews, rebuild, affected renderer/native verification, then the genuine 45-minute workload. Root remains responsible for native CUA and Delete acknowledgments; no new owner click/GO is necessary for that automated work. Separate final owner original-symptom acceptance remains mandatory.

## Diagnostic closure

Finished normally at 03:21:04.844 UTC, 600,037 ms observation, 204 events, no overflow/truncation, observer removed. Run-result independently inspected: case exit 0, no timeout/interruption/leaked owned PIDs, owned root removed. Supervisor confirmed PIDs 31883/31895/32601 absent and exact owned root absent. Diagnostic PASS means evidence collection completed, not product acceptance. B20 repair follows on the same builder chain; earlier affected runtime evidence must be refreshed for changed product bytes.
