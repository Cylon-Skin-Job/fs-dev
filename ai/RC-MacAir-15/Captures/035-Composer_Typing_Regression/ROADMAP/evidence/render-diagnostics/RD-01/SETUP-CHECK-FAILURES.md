# Retained setup/compile failures from tool transcript

These are unsuccessful setup/check attempts, not claimed passing checks.

1. Root-cwd `npx tsc -b --pretty false` exited1 with “This is not the tsc command you are looking for” and guidance to install TypeScript. No install was performed. Corrected to existing `fusion-studio-client/node_modules/.bin/tsc` from client cwd.
2. Client-cwd `./node_modules/.bin/tsc -b --pretty false` exited2:
   - src/lib/reveal/progress.ts(17,15): TS1294 syntax not allowed when erasableSyntaxOnly enabled.
   - src/lib/reveal/progress.ts(53,15): same.
   - src/lib/reveal/progress.ts(53,57): same.
   Repaired parameter properties to explicit fields/assignments. Next exact command exited0; subsequent full builds pass.
3. First new fixture write was addressed `fusion-studio-client/e2e/visible-wait.spec.ts` while cwd already client: zsh “no such file or directory”. No file written. Corrected write to `e2e/visible-wait.spec.ts`. The following independent regression command did run (check-first.log51passed); it did not contain the then-missing new test.
4. First expanded route test invocation from root used client-local binary plus ../ai output path: zsh “no such file or directory” for the output log. No tests ran. Corrected client cwd command created check-route-first.log20passed.

Browser selector failure detail remains in check-visible-first.log:7 failed,8 passed. Production row contained hourglass_bottom/hourglass_top text plus Working…2s, so asserting entire row text equality was wrong. Targeted `.rv-working-activity-seconds`; succeeding controlled boundary assertions remain strict1999/2000.

Lint errors remain in lint-first.log (2 existing refs errors), lint-predecessor.log (same2), lint-final.log (new prop mutation detected in direct subagent observation). The new mutation was encapsulated in the observation object's directOutput method; lint-gate.log has0errors. No source lint exemption was added.

5. Current-candidate cumulative run check-current.log:76pass/1fail. The existing instant-collapse think case failed BEFORE fixture mounting at boot line48: clock.pauseAt(new Date()) rejected “Cannot fast-forward to the past”. This is an existing wall-clock setup race under concurrent test/build load, not a renderer assertion. Trace retained in playwright-current/instant-collapse-think-que-ee855-e-frontier-manual-expansion-fixture-only-chromium/trace.zip. Root's same-current-byte77 run independently passed. Builder repeats complete77 with no source change in check-confirm.log. No skipped test or relaxed oracle.
