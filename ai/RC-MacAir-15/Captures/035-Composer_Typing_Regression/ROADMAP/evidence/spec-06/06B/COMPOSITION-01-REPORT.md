# COMPOSITION01 outcome — paired native causal evidence

Run chat-arch-1790478658279-b18e60618b under reviewed B19source1955SHA4c4b9512e6d8dc3c157c5ac605c07817ec20e5f4685036cc5db342adb2e1adc4/build200SHA6c06602b58f8dc0e4a9b1ed6588c5670b8e628b21044040a581e9e9d55f05234. Exact command and fullcase metadata in composition-01.log/run-manifest.json. Native paired window03:11:04.807–03:21:04.844UTC (600037ms), finalownedPID32601/window1. Supervisor CUA alone entered paired sequences; no builderinput, sourcechange, tests or builds overlapped. Exit0 means diagnostic completed only.

Raw native-composition-control-result.json contains204records,0overflow/0truncation, both frame UUIDs/timeOrigins and per-record wall/performance clocks, capture and later-task rows keyedbyeventId. Cleanup removed observer/iframe; COMPOSITION-01-CLEANUP.json at03:21:34.045UTC proves ownedroot/PIDs31883,31895,32601 absent, SQLitequickcheckok/port+rootsremoved/lingering[], all1955source/200build hashes unchanged, supervisor55084 protected/alive.

Both separated and same-CUA-call pairs show a product composing-key interception distinct from the later ordinary delivery:

- Unhandled control Escape captureseq11/event9 andseq112/event81: trustedkeyCode229/isComposingtrue, remains defaultPreventedfalse and controlfocused. Subsequent untrustedcompositionend and keyup precede a second normalEscape. Control retains a singleaccent.
- Real composer Escape captureseq63/event46 andseq139/event101: trusted229/composingtrue; compositionend/blur occurs before the later normalEscape. Later-task rows71/149 show bodyfocus and duplicatedaccent. App.tsx unconditionally blurs on Escape. The first composing-key ownership violation is supported; this does not prove every duplicateaccent or compositionend cause.
- Unhandled control Enterseq39/event28 andseq169/event121 remain unprevented. A compositionend and keyup precede another ordinaryEnter; the finalcontrol text is accent+newline. This establishes a second normal delivery that must not be suppressed with arbitrary timing/extra-key heuristics.
- Real composer Enterseq91/event66 andseq199/event144 are trusted229/composingtrue. The SAMEevent later-task snapshots94/204 show defaultPreventedtrue and bodyfocus. Supervisor observed promptsubmission. ChatInput's unguarded Enter branch owns preventDefault and Send/Stop. This is direct evidence supporting a bounded composing-key guard before autocomplete/Enter handling.

Supervisor authorized minimal productguards only for actually composing keys, including justified229fallback; retain normal noncomposing keys and do not suppress the second ordinarydelivery, filter untrusted events, or add timers. The tool/OS/Chromium provenance of all untrustedcompositionends and double delivery remains unproven. A corrected first composing-key route may still be followed by a normal tool-deliveredkey with normal product behavior; report both honestly.

No native correctness, full45minute soak, original-freeze cause, or owner symptom acceptance is inferred. B20 guard red/green, build, affectedrender/native and soak evidence must follow on the repairedcandidate. Allpre-repair evidence retained;06Cbarred.
