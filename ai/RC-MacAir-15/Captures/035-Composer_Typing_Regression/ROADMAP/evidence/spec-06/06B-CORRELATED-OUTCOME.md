# B12 correlated setup outcome

## Current B12 outcome — 2026-09-26T02:12Z

The one authorized correlated diagnostic is complete. Overall 06B remains **BLOCKED on unmet foreground execution evidence**, with native methods and explicit owner original-symptom acceptance separately pending. 06C has not begun. Runtime lane is released; no retry or full performance sequence followed. Prior “no launch yet” sections are historical preparation records, superseded by this outcome.

Candidate remains source 1,938 files SHA256 `15cfad74ac567e31fb87ca19af050b0e84a77fff1fb4f26080e1a5dc9fc923aa`; build 200 files SHA256 `6c06602b58f8dc0e4a9b1ed6588c5670b8e628b21044040a581e9e9d55f05234`. Eight fixture/test paths changed, no production bytes. Builder and root each passed ten Node tests and two Chromium tests. Fresh builder `/root/builder06b/review06b_correlated1` and root `/root/review06b_correlated1` returned terminal CLEAN for this bounded implementation; runtime evidence does not alter that result or certify foreground capability. Builder is now terminal BLOCKED; closure tool unavailable. No source changed after freeze/review/run.

Run `chat-arch-1790388395442-4951860497` began 02:06:35.442 UTC, lasted 126.079 seconds and exited 1. Setup notice was delivered before GO, exact READY identity relayed, and no agent pointer was injected. Root independently confirmed unlocked desktop at 02:06:09.457 UTC. The only entered instrumented phase was owner acquisition. No successful trusted-pointer plus stable-focus acquisition receipt was produced; reload/calibration/settling/typing never began and `measurementStarted:false`. This does not establish that the owner never clicked: the failed helper receipt does not persist the last pointer state.

Root independently read all 384 timeline events and raw summaries:

| UTC | Recorded event |
|---|---|
| 02:06:41.580 | Owner-acquisition phase starts |
| 02:06:41.590–41.591 | Only intercepted calls: initial window.show and window.moveTop |
| 02:06:42.940 | Main window.hide event; visible true, focused true, appHidden false |
| 02:06:43.1283–43.1374 | Initial document's screenshot capture/updated/request/data source times, projected from same-document timeOrigin; not final calibration bootstrap |
| 02:06:43.251 | Main window.blur and app.browser-window-blur; focused false |
| 02:08:39.707 | Acquisition phase ends with Electron evaluation error |
| 02:08:39.709 | Diagnostic complete/closing marker |
| 02:08:40.744 | Explicit driver close request after observer restoration |
| 02:08:41.048 | Owned Electron process exits 0 |
| 02:08:41.369–41.508 | Close completion and fixture cleanup completion |

The 119 main-process samples contain one focused=true sample followed by 118 focused=false samples; all show visible=true, minimized=false and appHidden=false. All 119 renderer samples retain hasFocus=true and visibilityState=visible. One renderer document was recorded; there was no diagnostic reload phase. The early native-window API focus loss is therefore separately recorded from planned cleanup almost two minutes later, and extends beyond one isolated hide event. Native-window/renderer disagreement remains explicit; neither DOM focus nor isVisible=true overrides the approved native focus gate.

No installed wrapper recorded window.hide/app.hide/minimize/restore/focus or subsequent show calls during this interval. This is an absence within declared interception coverage, not proof of an OS/external actor or absence of every possible native/bypassing call. The observed main/renderer disagreement and early acquisition interruption are new attribution evidence; the initiating cause remains unresolved.

The acquisition error is `electronApplication.evaluate: Execution context was destroyed, most likely because of a navigation.` Read-only inspection of installed `playwright-core/lib/server/chromium/crExecutionContext.js` shows `rewriteError` uses that message for non-JavaScript/non-session-closed errors generally; it does not prove navigation. The raw underlying protocol error is not retained. The renderer remained on one observed document; the error is on main-process evaluation, so those facts must not be conflated.

The trace reports zero journal/source overflow, zero write/emission/observation errors and no recorded poll gaps, with `complete:true` for its bounded scope. That flag means the declared recording scope completed; it is not a setup/focus/performance pass. Main/renderer observers were deliberately restored before final app close; durable driver markers establish the closure tail.

Cleanup reports quick-check success, removed roots/port and no lingering/leaked owned processes. Root at 02:10:32.009 UTC independently confirmed the exact owned root and recorded PIDs 44886, 44898 and 45584 absent (`06B/B12-ROOT-CLEANUP.json`). No other process inventory/termination, live profile, settings change or deployment occurred. Supervisor-owned eight-hour display assertion was left untouched.

The requested diagnostic answers the cleanup-timing ambiguity for this run: the early focus event precedes intentional closure and precedes final reload/bootstrap/settle. It does not resolve the focus initiator or underlying evaluation error, reproduce a successful watched setup, or complete any performance/native gate. No repeated ambiguous visual report is requested. Further runtime work requires a concrete next diagnostic direction within the supervisor's controlled scope; this single-run authorization is exhausted. Current full V-RENDER, valid five-minute input, full 45-minute V-SOAK, real native methods and timestamped owner symptom receipt remain required. B12 remains accepted bounded fixture integration without an acceptance waiver.

