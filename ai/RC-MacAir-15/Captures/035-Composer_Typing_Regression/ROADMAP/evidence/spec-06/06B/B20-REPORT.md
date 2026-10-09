# B20 — preserve native composing-key ownership

Status: implementation, self-review, affected browser checks and client build complete; fresh builder review CLEAN. Native retest, current V-RENDER/five-minute, true V-SOAK and explicit owner symptom acceptance remain pending. No Electron launch is authorized by this report. This is a bounded correction within 06B, not slice acceptance.

Frozen candidate: B20-IDENTITY.json; 1,957 source entries SHA256 `326555b1e0b465e19a0170a2e032dcac0e02b51ee9f6f80048425ceea3bff9c8`; 200 build entries SHA256 `b070d633863382e48ea2f6d677a92cfe65b9a4dea79caa87975711c109c70b03`. Exact five-path delta B20-CHANGED-PATHS.json against B19-IDENTITY-source.json. Three exact modified predecessors in B20-BEFORE and B20-BEFORE-MANIFEST.json. Two new paths have no predecessor. The generated build is separately inventoried, not represented as unchanged.

## Authority and evidence

SPEC-06 06B: “Exercise native/OS input and IME on isolated candidate as well as synthetic events.” “Every observed lost input/stuck state/resource-growth breach blocks completion.” VALIDATION56: “Test emoji, autocomplete, IME/composition and paste separately for correctness.” Supervisor authorized the B20 minimal actual-composing-key ownership correction after completed paired COMPOSITION01 and cleanup, as recorded in root DEVIATION-DECISIONS.md. No timer, second-key suppression or broad event heuristic is authorized.

Read AGENTS, complete code-standards hub/routed pages, Chat overview and composer/testing authority. Accepted view-bound hosts/receipt ownership supersede historical Legacy-host wiki descriptions; no standards exception is introduced. Current workspace root remains /Users/rccurtrightjr./projects/fs-dev; dirty predecessor work is preserved.

COMPOSITION-01-REPORT.md and raw run `chat-arch-1790478658279-b18e60618b` establish actual trusted composing Escape/Enter events (keyCode229/isComposingtrue) reaching the real composer. Actual App Escape blurred during the first composing event; actual composer Enter became defaultPrevented and triggered Send. Paired unhandled iframe control did not intercept those first events. Untrusted compositionend and a later separate ordinary key delivery also occurred in the control. The correction therefore addresses only the actual composing event. It does not claim the origin of duplicate accents, every untrusted end, second ordinary delivery or the original freeze. No second ordinary key is suppressed. COMPOSITION01 cleanup and unchanged pre-repair identity are in COMPOSITION-01-CLEANUP.json.

## Changed behavior and paths

- src/lib/composition-key.ts: pure shared predicate returns native isComposing OR legacy keyCode229. The fallback is justified by actual native229 event observations; no state, timing, trust filter, listener or DOM mutation.
- src/components/App.tsx: global Escape returns before blur for a composing key; ordinary Escape and panel navigation behavior retained.
- src/components/ChatInput.tsx: actual textarea key handler returns before autocomplete acceptance and Enter Send/Stop for a composing key. Ordinary Enter/Tab, Shift+Enter, Send/Stop button callbacks, draft ownership and server receipt paths unchanged.
- e2e/app-composition-keys.spec.ts: mounts the actual App, with unrelated direct service hooks/visual children stubbed. The real document keyboard effect is neither copied nor replaced. Ordinary Escape first calibrates listener installation; isComposingtrue/normal27 and isComposingfalse/229 each retain focus, then ordinary Escape still blurs. Synthetic browser mechanics, not native proof.
- e2e/chat-surface-isolation.spec.ts: four real ChatSessionHost tests independently exercise nativeEvent.isComposing and229 fallback, no prompt submission/no Stop/no autocomplete interception, exact retained draft, ordinary Stop and autocomplete afterward. Existing full-file ordinary Send/Stop/ownership tests remain included.

## Verification and retained failures

All commands below run from fusion-studio-client; no runtime or build overlap.

1. `node node_modules/@playwright/test/cli.js test e2e/chat-surface-isolation.spec.ts e2e/app-composition-keys.spec.ts --grep 'composition keys|actual App preserves' --config playwright.chat-architecture.config.ts`: b20-red-02.log, exit1. Four actual composer assertions fail on defaultPrevented. App harness initially failed unrelated Rollup dependency resolution, not a product red proof.
2. App-only same config: b20-red-03.log, exit1, fixture resolver incorrectly stubbed react/jsx-runtime; fixed fixture to preserve React imports. b20-red-04.log, exit1, actual App composing Escape focus assertion fails after ordinary Escape calibration succeeds. b20-red-01.log retained earlier wrong-cwd/no-tests setup failure, never counted as a product regression.
3. `node node_modules/@playwright/test/cli.js test e2e/chat-surface-isolation.spec.ts e2e/app-composition-keys.spec.ts --config playwright.chat-architecture.config.ts`: b20-green-01.log, exit0, 23 passed in8.6s, no skips. Includes real owner and existing normal action/isolation regressions.
4. `npm run build`: b20-build-01.log, exit0; build-preload, TypeScript and Vite succeeded; 1,944 modules, Vite3.86s. Warnings retained: gray-matter eval, CaptureTiles static/dynamic import overlap, >500kB chunks. No downloads/dependency changes.

Self-review compared all five paths to exact predecessors, traced React nativeEvent and document event integration, verified zero changes to prompt/Stop callbacks, no new listeners/timers/state and preserved normal second delivery. Emoji popup presentation listener is unchanged; this repair targets composition Escape defocus and composer action interception established by paired evidence. Production owners remain334 App/347 ChatInput lines; the6-line shared predicate keeps the identical native-key policy in both existing keyboard owners. The existing large chat-surface integration fixture is extended to reuse its real-host/wire harness rather than duplicate its accepted setup; this is a bounded test-file extension, not a new production owner. No server change: prior full-server/boot evidence remains valid for unchanged server dependencies; no redundant full server run for this keyboard-only correction.

## Acceptance map, invalidation and next runtime

Composing Escape ownership → actual App red04/green01; composer composing Enter/Tab/Stop ownership → four red02/green01 tests. Ordinary behavior → complete23-test green01. Build/type integration → build01 and current source/build manifests. Actual native composition correctness → PENDING corrected candidate retest using existing paired fixture and exact same supervisor CUA methods. Inspect first composing event defaultPrevented and blur ordering relative to second ordinary key; later-task final focus/Send alone cannot establish first-event failure. Textarea-scoped observer may miss a second event once disabled/unfocused; retain that boundary.

VRENDER03 and older native acceptance numbers now historical because product/build changed. Current full V-RENDER includes five-minute probe and must rerun after native correction verification. True45minute soak remains pending, with accepted B18 native Delete closure checkpoints for every full-soak Delete boundary. SOAK03 rAF50.9ms failure remains blocking historical evidence without inferred cause. All numeric/focus/traffic/resource/duration gates remain unchanged. Explicit owner original-symptom receipt remains indispensable; no 06C or completion claim.

## Deviation B20 (proposed accepted bounded correction; root classifies)

Original SPEC text: native/OS input and IME must be exercised; every observed lost input blocks completion. Actual: add minimal product guards and two browser-test changes plus new predicate beyond anticipated fixture-only diagnostics. Reason: directly evidenced first composing Escape/Enter interception in paired native COMPOSITION01, confirmed at real owner boundaries by red tests. Files: exact five paths above. Tests: red02/red04, green01, build01; affected native/render/soak pending. Effect: composition owns only keys bearing native composing evidence. Risk: legacy229 is a deprecated signal, retained as explicit compatibility fallback; the independently delivered ordinary second key can still perform normal action. No timer heuristic and no assertion that end-to-end native behavior is already accepted. Downstream: refreshed build invalidates affected performance/native numbers; 06B and06C gates remain closed. Temporary adapter: no new production adapter; isolated App visual/hook stubs are test-only, B19 paired iframe remains diagnostic-only and is removed at cleanup. No release/Alpha/live data/settings/process changes.

## Review lifecycle

Fresh builder /root/builder06b/review06b_keys1 returned terminal CLEAN with no findings/advisories on the frozen candidate. Independently verified all1957source/200build entries, exact five-path delta/three predecessors, actual keyboard-owner guards, raw red02/red04/green01/build01 and bounded paired-native interpretation. No edits/tests/builds/native/app interactions or descendants. Terminal status recorded; close_agent unavailable, so no closure call can be made. Prior B19 reviewer terminal CLEAN, no active conflicting writer; close_agent unavailable in tool inventory. Root independently reviews acceptance scope separately. No full06B CLEAN claim.

## Completed corrected native run

COMPOSITION02 normaldeadline/exit0 and exactownedcleanup complete; see COMPOSITION-02-REPORT.md/CLEANUP.json. Paired443event raw trace supports first-key ownership correction. Currentrender/fullsoak and explicitowner acceptance remain pending. Prior pending-native statements above describe prelaunch gate; runtime disposition is bounded in the separate report. No source changes after freeze.
