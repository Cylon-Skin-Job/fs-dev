# COMPOSITION02 native revalidation

2026-09-27 UTC; agent-operated, not owner acceptance. Run `chat-arch-1790480161136-42069438e6`, PID 3153/window 1, exact title `ISOLATED COMPOSITION CONTROL — chat-arch-1790480161136-42069438e6`. Frozen B20 source `326555b1e0b465e19a0170a2e032dcac0e02b51ee9f6f80048425ceea3bff9c8`, build `b070d633863382e48ea2f6d677a92cfe65b9a4dea79caa87975711c109c70b03`; targeted 23 checks pass at both levels and both fresh reviews CLEAN before launch.

Native-control initialization timed out three times (including a runtime reset), without sending input. CUA inventory then succeeded and binding observed `com.github.Electron` succeeded. Exact test title authenticated. No settings change, Codex restart, permission change or alternative native-input technology used.

## Exact paired action receipts

Fresh trial clears only disposable field before Option+E and specified next key. Separated sequences insert an accessibility observation between keys; batched sequences do not.

| Trial | Epoch-ms bounds | Visible outcome |
| --- | --- | --- |
| Composer separated Escape | 1790480420352–1790480428230 | Single accent, eventual body focus; no duplication |
| Control separated Escape | 1790480436402–1790480444021 | Single accent, control focus |
| Composer separated Return | 1790480451242–1790480458936 | Submitted; agent Stop complete 1790480464700 |
| Control separated Return | 1790480470206–1790480478305 | Accent plus newline, control focus |
| Composer batched Escape | 1790480491216–1790480493301 | Single accent, eventual body focus |
| Control batched Escape | 1790480500230–1790480502256 | Single accent, control focus |
| Composer batched Return | 1790480508179–1790480510214 | Submitted; agent Stop complete 1790480515832 |
| Control batched Return | 1790480522274–1790480524303 | Accent plus newline, control focus |
| Composer commit (E) | 1790480532312–1790480534317 | Exact `é`, focused |
| Control commit (E) | 1790480540428–1790480542447 | Exact `é`, focused |
| Composer Backspace | 1790480548344–1790480550371 | Empty, focused |
| Control Backspace | 1790480556256–1790480558230 | Empty, focused |

## Independently inspected raw ordering

Raw `../spec-01/01B/chat-arch-1790480161136-42069438e6/native-composition-control-result.json`: 443 events, zero overflow/truncation at supervisor inspection. First composing Escape event 7/sequence 9 and batched event 85/sequence 116 remain unprevented; single accent remains through later ordinary Escape sequences 15/122. Blur occurs only after the ordinary key (16/123), unlike pre-repair COMPOSITION01.

First composing Enter event 43/sequence 59 and batched event 126/sequence 176 remain unprevented in their correlated later snapshots 67/184. Only later ordinary Enter events 49/132 are prevented (69/186); final submission is after that ordinary key. Do not label this final submission a composing-key failure. Later-task focus snapshots include effects of the second key; inspect order rather than treating those snapshots as synchronous.

Both commit trials retain exact `é`. Untrusted compositionend remains explicit. Backspace includes composing passthrough, untrusted end, then ordinary Backspace with deleteContentBackward; this proves paired parity and deletion, not a native IME cancellation method. No second-key suppression or trust filtering was introduced. This establishes the narrowly evidenced repair, not all physical IME behavior or original sustained-freeze acceptance.

## Current-build native smoke

Native typeText 1790480573446–1790480575576 produced exact `native check 2468`. Native paste 1790480580475–1790480581900 appended exact ` — café 🙂`, producing `native check 2468 — café 🙂`; CUA paste restores clipboard formats. Ordinary Return 1790480589250–1790480590594 produced that exact user bubble, emptied composer and exposed Stop. Agent Stop completed 1790480597437 and restored Send.

New chat clicked 1790480603654–1790480605894, followed by fresh native observation of new `2026-09-26T20-43-24` row (zero messages). Agent selected that observed row; completion 1790480619884. Final full accessibility observation showed `Start a conversation`, empty composer and Send. All sends targeted the deterministic disposable fixture.

No further native action after those receipts. Normal fixed-window cleanup remains builder-owned. Current VRENDER and real 45-minute soak remain outstanding. Owner original-symptom receipt is still mandatory before 06C; no acceptance inferred from these agent actions.

## Closure

Normal completion 03:46:07.639 UTC, observation 600,068 ms. Final 443 events, zero overflow/truncation, observer removed. Supervisor independently inspected case exit 0, 608,302 ms, no timeout/interruption/leaked owned PIDs, root removed; also verified PID 3153 and exact temporary root absent. Orchestrator independently verified all owned PIDs, SQLite quick-check, ports and frozen source/build. New thread exact identity is `2026-09-26T20-43-24-212`. No further native session is required solely to repeat the already observed methods; affected current-build performance and real soak still follow.
