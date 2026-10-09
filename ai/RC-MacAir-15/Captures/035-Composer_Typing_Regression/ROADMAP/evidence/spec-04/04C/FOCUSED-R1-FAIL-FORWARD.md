# 04C Focused R1 Fail-Forward Evidence

## Short R1 disposition

The first unlocked current-byte full-render run, `chat-arch-1790226538113-ec3ff261d5`, failed its process exit because one `R1-WARM-F2-F3` window measured 2,567 ms against the unchanged 2,550-ms short-window limit. The remaining nine windows were 1,908–2,086 ms. Every window retained exact text and valid focus before/after; aggregate input p95 was at most 0.8 ms, next-rAF p95 at most 16.5 ms and max 18.7 ms, with zero long tasks, outbound frames, formatter calls, or `MessageList`/`InstantSegmentRenderer`/`ChatAreaHeader`/`ThreadRail`/`ContentArea` renders.

The unchanged-source exact rerun `chat-arch-1790226813486-07f8ef9936` passed all ten windows at 1,920–1,999 ms. The unchanged-source complete render run `chat-arch-1790227008022-0bead4164a` then passed all ten windows at 1,967–1,985 ms and completed F1, composer correctness, R7, and R9. After the five-minute oracle repair described below, final-manifest full render `chat-arch-1790228222155-271e516a9a` passed all ten windows at 1,961–2,008 ms plus every remaining render case.

The isolated 17-ms overshoot had no accompanying renderer latency, render, formatting, traffic, retention, or focus symptom, and it did not reproduce in twenty unchanged-source windows or the ten final-harness windows. It is classified as host scheduling jitter, not a product defect. The 2,550-ms short threshold was not changed.

## Five-minute fail-forward and repair

Initial focused five-minute run `chat-arch-1790227216527-e454ea363e` measured 351,503 ms and two typing-interval outbound frames. It exposed two independent oracle defects:

- the runner used `configuredDurationMs * 1.15` (345,000 ms), while `VALIDATION.md` requires wall time no greater than 1.5 times the configured per-character delay budget; for 9,520 characters at 32 ms the approved bound is 456,960 ms;
- the measurement began before the scheduled workspace screenshot bootstrap completed, so its two traffic frames were not caused by draft typing.

Diagnostic run `chat-arch-1790227741979-09f18c2150` retained the zero-frame assertion and decoded every measured outbound frame. It recorded exactly `screenshot:capture` at +289.1 ms and `screenshot:request` at +294.3 ms, proving the boundary crossing without filtering or waiving traffic. Its 351,542-ms wall time passed the corrected authority-derived budget; the frame assertion still failed.

The repaired runner now observes the ordered bootstrap lifecycle `screenshot:capture` outbound, `screenshot:updated` inbound, `screenshot:request` outbound, and `screenshot:data` inbound, then requires the total WebSocket sequence to remain stable for 500 ms. Evidence is bounded at 2,048 bootstrap frames and fails closed on overflow, missing lifecycle, or timeout. Only after that boundary does the runner create measurement evidence. It captures every measured outbound frame in a separate bounded 64-entry decoded trace and still requires the count to be exactly zero; there is no type filter.

Final five-minute run `chat-arch-1790228438993-225fac9ea0` passed:

- ordered screenshot lifecycle at traffic sequences 888–891, followed by the required 500-ms quiet boundary;
- 9,520/9,520 input and rAF samples, exact retained text, and prompt hash only (content not recorded);
- wall 351,517 ms against the approved 456,960-ms budget;
- input p95 1.4 ms/max 2.2 ms; next-rAF p95 17.7 ms/max 21.0 ms;
- zero long tasks, typing-time outbound frames, evidence overflow, formatter calls, or history/header/rail/content renders;
- focus true before and after; SQLite quick-check `ok`; fixture/profile/run roots removed; zero lingering owned PIDs.

Raw receipts remain under `ROADMAP/evidence/spec-01/01B/<run-id>/`.
