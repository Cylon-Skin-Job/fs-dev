# SPEC-04 Slice 04A Implementation Report

Status: **READY_FOR_ORCHESTRATOR_REVIEW**

Candidate: branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, shared dirty checkout. Exact current source identity is `SOURCE-SHA256.txt`.

## Outcome and changed behavior

The chat surface no longer carries one aggregate reactive session model through its parent. `ChatSurfaceModel` was replaced by stable shell, header, and composer presentation contracts. The memoized surface composes three explicitly addressed connected leaves:

- `ConnectedChatComposer` observes the exact `{workspaceId,threadId}` draft, attachments, submission state/feedback, and exact composer status/context/token projections.
- `ConnectedChatHistory` observes the exact thread's completed/live message projections and owns its scroll response.
- `ConnectedChatHeader` observes exact busy/submission gates required for Move without invalidating the parent surface.

`useLegacyChatHost` no longer reacts to draft, attachment, submission, history, current-turn, segment, context-usage, or token-usage changes for composer presentation. Identity, shell/header/composer contracts, actions, and refs are stable references. Send snapshots the invocation text, draft revision, attachment IDs/generations, and exact acknowledged model selection. Stop and Move snapshot current exact chat/submission/selection state at invocation. Existing action/result/correlation/group and view-bound New Chat contracts remain intact.

Duplicate mounts of one session share draft/attachment/submission truth while retaining mount-local DOM identity, refs, focus, caret/selection, composition state, autocomplete, and resize behavior. Other sessions remain isolated.

## Files

Production integration:

- `fusion-studio-client/src/components/chat/{chatSurfaceContract,useLegacyChatHost,useViewChatHost,useChatMountInteractions,ChatSurface,ConnectedChatComposer,ConnectedChatHistory,ConnectedChatHeader,ChatAreaFooter,ChatLinkAttachments,LegacyChatHost,ViewChatHost,ChatSurfaceComponentMount}.{ts,tsx}`
- `fusion-studio-client/src/components/ChatArea.tsx`

Test/runner integration:

- `fusion-studio-client/e2e/chat-surface-isolation.spec.ts`
- `fusion-studio-client/e2e/chat-architecture/{coverage-observation,coverage-observation.test,window-focus,window-focus.test,r1-electron,r1-composer-playwright,run,scenario-inventory}.mjs`

Every new/extracted production file is <=136 physical lines and has one bounded job. `LiveSegmentRenderer` was not touched.

## Acceptance mapping

| 04A criterion | Implementation/evidence |
| --- | --- |
| Composer-local exact observation | Exact-key selectors in `ConnectedChatComposer`; parent host contains no reactive composer/history/live-token subscriptions. |
| Stable presentation contracts | Split shell/header/composer interfaces and memoized projections/actions/refs; no aggregate model recreated through hooks. |
| Invocation-time snapshots | Send snapshots draft revision, attachment generations/IDs and acknowledged selection; Stop/Move snapshot exact current stores. |
| Duplicate-mount sharing and session isolation | V-ISOLATION cases 9–11 plus R1 correctness runner. |
| Caret/selection, IME, autocomplete, paste/drop, resize, emoji | New R1 composer input case exercises all named paths with exact retained text. |
| Zero history/formatter/sibling work | Ten production Electron windows: zero MessageList, InstantSegmentRenderer, ChatAreaHeader, ThreadRail, ContentArea, and `renderTextInstant`; 68 ChatAreaFooter function entries per window prove the CDP counter lane was active. Test-transform counters additionally prove zero `ConnectedChatHistory` renders. |
| Preserve SPEC-02/03 downstream contracts | V-SUBMIT 7/7; V-ISOLATION 15/15; identity/threaded host 29/29. |
| No production test bypass | Production probe experiment was removed; final source and dist contain no observer global. Test-only Vite transform and CDP instrumentation observe without changing product behavior. |

## Validation

- `npm --prefix fusion-studio-client run build` — PASS, V-BUILD, 1,940 modules.
- `cd fusion-studio-client && npx playwright test --config=playwright.chat-architecture.config.ts e2e/chat-surface-isolation.spec.ts` — PASS 15/15, V-ISOLATION.
- `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite render --mode enforce --cases R1-F2-F3-COMPOSER,R1-COMPOSER-CORRECTNESS` — PASS, run `chat-arch-1790129801137-307285764d`.
  - Ten production windows; exact text retained in all.
  - Max input p95 0.801 ms; max input 1.0 ms.
  - Max next-rAF p95 16.4 ms; max next-rAF 17.6 ms.
  - Zero long tasks; zero target renders; zero completed-history formatter calls; zero prompt WS frames.
  - Composer coverage positive control 68/window, 680 total.
  - Owned cleanup: no lingering process, SQLite quick check `ok`, port file and disposable roots removed.
  - Correctness cases PASS 2/2.
- `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite submit --mode enforce` — PASS all 7 cases, run `chat-arch-1790129982483-03bc3bcf93`.
- `cd fusion-studio-client && npx playwright test --config=playwright.chat-architecture.config.ts e2e/chat-surface-identity.spec.ts e2e/threaded-chat-host.spec.ts` — PASS 29/29.
- `git diff --check -- <04A integration files>` — PASS.

Retained failed evidence:

- `chat-arch-1790127572415-6c5024b0c0`: false positives from sticky React fiber flags and unavailable minified-name formatter lookup.
- `chat-arch-1790128100810-6b44e47cfc`: exact counters exposed unrelated async global markdown and dense hydration overlap; the oracle was repaired to wait for quiescence and target the completed-history formatter without weakening workload or thresholds.
- `chat-arch-1790129233544-9ca4fcbf69`: one temporary CDP experiment referenced an out-of-realm variable and exited nonzero; repaired before final no-hook run.
- Optional combined focused invocation: 35 pass / 5 infrastructure failures because page-backed Working Activity tests were run under the fixture-only config with no base URL (`page.goto('/')` failed before product execution). The valid identity/threaded subset was rerun and passed 29/29.

## Self-review and repairs

- Replaced the invalid sticky-fiber/minified-name oracle.
- Removed the intermediate production observation helper after applying SPEC-01/GUIDANCE; final counters are test-only.
- Added CDP positive control so zero target counts cannot mean disabled coverage.
- Restored inactive-panel gating during the host split.
- Confirmed no aggregate model, no full composer session subscription in the parent, no production observer/auth bypass, no source whitespace errors, and no new file over the slice structural limit.

## Builder review history and lifecycle

- Pass 1: `/root/spec04_slice04a/review_04a_pass1`, fresh read-only `clean-room-reviewer`, terminal completed, **CLEAN**, no material findings.
- Current manifest matched 19/19 files. No repair or evidence invalidation followed the clean review.
- `list_agents` confirmed terminal completion. `close_agent` is unavailable in this runtime; no closure attempt was possible. This is lifecycle evidence only.

## Deviations and out-of-scope touches

### D-04A-1 — Mechanically necessary connected history/header leaves

- Original: explicitly connected composer leaf for exact draft/file/submission projections.
- Actual: history and header were also extracted into exact connected leaves.
- Reason: required to remove live/history/busy subscriptions from the stable parent while preserving rendering, scroll, diagnostics, and Move eligibility.
- Files/tests/effect: connected leaf/contract/caller files; R1, V-ISOLATION, V-SUBMIT. No visual redesign; typing now invalidates only the composer leaf.
- Risk/downstream: low; gives 04B an isolated history/live boundary. Proposed classification: `accepted` mechanically necessary integration.

### D-04A-2 — Shared runner output root

- Original: evidence under `evidence/spec-04/04A/`.
- Actual: accepted runner primary artifacts remain in `evidence/spec-01/01B/<run-id>`; terminal logs/results and a bounded summary are copied here with exact run IDs.
- Reason: preserve accepted shared runner consumers and immutable evidence structure.
- Files/tests/effect: evidence only; no product effect.
- Risk/downstream: bookkeeping only. Proposed classification: `accepted` compatibility adapter.

### D-04A-3 — Existing host length

- Original: new/extracted production files <=400 lines.
- Actual: all new/extracted files comply; pre-existing touched `useLegacyChatHost.ts` remains 546 lines after the exact primitive compatibility selectors were added.
- Reason: full host retirement is 04C; 04A removed its aggregate reactive state without implementing later scope.
- Files/tests/effect: host; all gates pass.
- Risk/downstream: maintainability; 04C removal criterion unchanged. Proposed classification: `accepted` / no deviation.

No 04B/04C behavior, SPEC-05, database/migration, Alpha, live profile, port 3001, owner diagnostic, commit, push, destructive cleanup, auth bypass, fake transport, or production observer was added.

## Skipped checks, adapters, downstream effects, and residual risks

- Full V-RENDER, 5-minute typing, streaming, Working Activity, V-SHELL, V-ACTIONS, V-ALL, and soak were not run; they belong to 04B/04C or full SPEC-04. The exact 04A R1 subset required by the packet ran in enforce mode.
- The page-backed Working Activity portion of `prompt-ownership.slice-c` was not rerun using its legacy fixed-port configuration because this slice authorizes only ephemeral owned ports and Working Activity is 04B. Required submission/draft gates passed.
- Electron windows were visible but not OS-focused; recorded synthetic thresholds still passed. Native/owner acceptance is outside 04A.
- Test-only adapters: Vite source transform injects render counters only into the isolated fixture bundle; CDP precise function coverage observes the unmodified production bundle. Removal criterion: retain while R1 requires exact counts; no product cleanup is required because neither ships in production.
- Downstream 04B should optimize within `ConnectedChatHistory` and must retain SPEC-02 correlation/submission behavior. Downstream 04C can retire/split the remaining legacy host without recreating an aggregate model.

## Orchestrator review pass 1 repair

The first orchestrator acceptance review, `/root/spec04_04a_acceptance`, completed with **FINDINGS**. Its immutable record is `ORCHESTRATOR-REVIEW-PASS-1.md`. That disposition invalidated the prior builder handoff but not its retained evidence.

### Finding 1 — fail-open production coverage oracle

- Original finding: zero-count assertions initialized every requested function name to zero, so an undiscovered or misspelled target could pass. Only `ChatAreaFooter` had a positive control.
- Repair: added the test-only `coverage-observation.mjs` helper, separated target discovery from invocation counts, and added a production-bundle calibration reload/hydration phase. Enforcement now fails unless all seven functions are discovered: `renderTextInstant`, `MessageList`, `InstantSegmentRenderer`, `ChatAreaHeader`, `ThreadRail`, `ContentArea`, and positive-control `ChatAreaFooter`.
- Authenticity regression: `coverage-observation.test.mjs` proves a misspelled/missing target cannot pass and proves the exact target set can pass. `r1-composer-playwright.mjs` executes that test before its correctness workload and propagates a nonzero result.
- Product effect: none. Instrumentation remains test-only; production source and `dist` contain no observer hook or global.

### Finding 2 — whole-thread-collection parent observation

- Original finding: `useLegacyChatHost` returned `s.threads` from a Zustand selector and derived target metadata afterward, invalidating the session parent for any collection replacement.
- Repair: removed the collection-valued selector. Explicit production callers continue to supply exact group/name/sequence metadata. Compatibility callers that omit a field now use separate exact primitive selectors that may inspect the collection internally but return only the addressed thread's primitive value, so unrelated row replacement remains referentially stable.
- Locality regression: V-ISOLATION now replaces only an unrelated third thread row and asserts zero `ChatSurface`, `ConnectedChatHeader`, `ConnectedChatHistory`, `ChatAreaHeader`, `MessageList`, `InstantSegmentRenderer`, and formatter work for the target session while target text remains exact.
- Product effect: legacy fixture compatibility is preserved until 04C without restoring a cross-session parent subscription.

### Post-repair checks on current bytes

- `node --test fusion-studio-client/e2e/chat-architecture/coverage-observation.test.mjs` — PASS 2/2; missing/misspelled target fails closed.
- Focused V-ISOLATION duplicate-draft/unrelated-row selection — PASS 3/3 after repairing an initially incorrect test DOM selector; no product repair followed.
- `npm --prefix fusion-studio-client run build` — PASS, V-BUILD, 1,940 modules.
- `cd fusion-studio-client && npx playwright test --config=playwright.chat-architecture.config.ts e2e/chat-surface-isolation.spec.ts` — PASS 16/16, including unrelated-row locality.
- `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite render --mode enforce --cases R1-F2-F3-COMPOSER,R1-COMPOSER-CORRECTNESS` — PASS, production run `chat-arch-1790132465889-55fb162fbc`.
  - Calibration discovered all seven targets with nonzero counts: `renderTextInstant` 152, `MessageList` 4, `InstantSegmentRenderer` 32, `ChatAreaHeader` 20, `ThreadRail` 27, `ContentArea` 27, and `ChatAreaFooter` 18.
  - All ten production Electron windows retained exact text with zero forbidden renders, formatter calls, history commits, prompt WS frames, and long tasks.
  - Worst input p95 0.700001 ms; worst input 1.600001 ms; worst next-rAF p95 16.400000 ms; worst next-rAF 17.600000 ms; `ChatAreaFooter` positive-control total 680.
  - Cleanup confirmed no lingering process, SQLite quick check `ok`, and removal of owned roots/port file.
  - Correctness preflight/helper PASS 2/2 and Playwright input cases PASS 2/2.
- `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite submit --mode enforce` — PASS all seven, run `chat-arch-1790132658943-7015bf5aaa`.
- `cd fusion-studio-client && npx playwright test --config=playwright.chat-architecture.config.ts e2e/chat-surface-identity.spec.ts e2e/threaded-chat-host.spec.ts` — PASS 29/29.
- Scoped `git diff --check` — PASS.
- `rg "__fusionChatArchitectureProbe|render-observation" fusion-studio-client/src fusion-studio-client/dist` — no matches.
- Current 21-file source manifest verification — PASS 21/21. Manifest digest before evidence-only review records: `acfa1c557001142d066d834a0e0c64053727af3a8734e06fd517a88ab0ed756a`.

Post-repair raw evidence is retained as `repair-v-render-r1.log`, `repair-v-render-run-result.json`, `repair-v-render-r1-summary.json`, `repair-v-render-correctness.log`, `repair-v-render-correctness-result.json`, and `repair-v-submit-run-result.json`.

### Repair deviation and downstream ledger

- R-04A-1 — test-only fail-closed coverage calibration. Original SPEC requires exact zero render/formatter assertions. Actual change adds a pre-measurement production-bundle discovery/calibration phase and deterministic missing-target regression. Reason: make the required zero oracle authentic. Files: the two coverage helper/test files plus `r1-electron.mjs` and `r1-composer-playwright.mjs`. Tests/effect: full production R1 and correctness rerun; product behavior unchanged. Risk: low, with minified function-name dependence made explicit and fail-closed. Downstream: shared R1 consumers receive a stricter oracle. Proposed classification: `accepted` mechanically necessary test integration, not a product deviation.
- R-04A-2 — exact primitive compatibility selectors. Original SPEC prohibits parent subscription to full session maps. Actual change removes the collection-valued selector while retaining omitted-prop fixture compatibility through stable exact primitives. Reason: preserve accepted legacy fixtures until 04C without unrelated-row invalidation. Files: `useLegacyChatHost.ts`, `chat-surface-isolation.spec.ts`. Tests/effect: V-ISOLATION 16/16 plus V-SUBMIT and identity/threaded regressions; unrelated rows no longer reproject the target surface. Risk: low; compatibility selectors still scan the current collection only when explicit metadata is absent, but Zustand equality is on the returned primitive. Downstream: 04C may delete these fallback selectors with legacy-host retirement. Proposed classification: `accepted` bounded compatibility adapter.

Existing D-04A-1 through D-04A-3 remain unchanged. No new 04B/04C behavior, production observation hook, database/migration, Alpha, live-profile, port-3001, commit, push, auth bypass, or destructive operation was introduced. The repair did not expand skipped checks: later-slice/full-SPEC gates listed above remain intentionally deferred.

## Builder review pass 2 and network-oracle repair

Fresh reviewer `/root/spec04_slice04a/review_04a_repair_pass2` completed **NOT CLEAN**. It verified both orchestrator findings closed, but found that the old R1 result's opaque `wsSent` count was neither decoded nor enforced. The terminal result and lifecycle record are retained in `BUILDER-REVIEW-PASS-2.md`; `close_agent` was unavailable.

The finding was validated. The first exact-interval fast run, `chat-arch-1790133762042-1f0b66bf59`, failed as intended and decoded one `screenshot:request` during dense typing. That frame was delayed workspace screenshot hydration, not a prompt, but it still violated the zero-network interval. The runner now wraps each WebSocket when constructed, tracks every outbound-send sequence, waits for both render and network quiescence before measurement, captures only decoded frame types sent during the exact `keyboard.type` interval, and fails enforcement unless both the decoded list and compatibility count are empty. It records types rather than payloads, so no prompt or other content enters evidence.

- Fast proof after quiescence repair: `chat-arch-1790133862063-47efdd0fe4` — PASS all four windows with `outboundFrameTypes: []`, `wsSent: 0`.
- Full default R1 and correctness: `chat-arch-1790133916558-82b5890715` — PASS.
  - All ten windows retained exact text and recorded `outboundFrameObservationInterval: "keyboard.type"`, `outboundFrameTypes: []`, and `wsSent: 0`.
  - Zero formatter calls, target renders, and long tasks; `ChatAreaFooter` positive-control total 680.
  - Maximum input p95 0.8 ms / max 0.9 ms; maximum rAF p95 14.0 ms / max 17.9 ms.
  - All seven coverage targets discovered/calibrated; coverage authenticity 2/2 and input/locality correctness 2/2.
  - No leaked processes; SQLite quick check `ok`; owned port, fixture roots, and run root removed.
- V-BUILD rerun after the test-only repair — PASS, 1,940 modules.
- Scoped diff/no-production-probe checks — PASS.

R-04A-3 — exact typing-interval outbound-frame oracle. Original authority requires zero network/canonical event-bus writes during ASCII typing. Actual change adds test-only socket-construction wrapping, decoded type-only evidence, combined render/network quiescence, and a fail-closed empty-list assertion over the exact keyboard interval. Reason: authenticate the required boundary and distinguish delayed setup traffic without ignoring any in-window send. Files: `r1-electron.mjs`; evidence/report/manifest only. Observable product effect: none. Risk: low; application-level `WebSocket.send` calls are observed, while payload contents are deliberately not retained. Downstream: shared R1 now rejects any typing-time outbound frame and exposes its type for diagnosis. Proposed classification: `accepted` mechanically necessary test-oracle repair.

The stale D-04A-3 line count is corrected to 546. No product source changed in this repair, so previously passed V-ISOLATION, V-SUBMIT, identity/threaded, and original product V-BUILD remain valid; V-BUILD was nevertheless rerun and passed. The failed fast run is retained as evidence of the new gate failing closed.

## Final builder review and lifecycle

- Pass 1: `/root/spec04_slice04a/review_04a_pass1` — terminal **CLEAN** on the original 19-file candidate; later invalidated for handoff purposes by orchestrator findings, retained as history.
- Orchestrator acceptance pass 1: `/root/spec04_04a_acceptance` — terminal **FINDINGS**; both material findings repaired and verified closed.
- Repair pass 2: `/root/spec04_slice04a/review_04a_repair_pass2` — terminal **NOT CLEAN**; its outbound-network-oracle finding was validated and repaired.
- Repair pass 3: `/root/spec04_slice04a/review_04a_repair_pass3` — fresh read-only reviewer, terminal **CLEAN**, no material findings on the final 21-file candidate.
- Before each spawn, `list_agents` confirmed all prior reviewers were terminal/non-conflicting. `close_agent` is not available in this runtime, so closure calls could not be attempted; each terminal result is retained as lifecycle evidence.

The clean reviewer verified all three repair areas, original 04A acceptance, downstream SPEC-02/03 preservation, deviation accounting, evidence authenticity, scoped diff, and residual later-slice risk. Its immutable record is `BUILDER-REVIEW-PASS-3.md`.

Pass-3 source identity was 21/21 hashes in `SOURCE-SHA256.txt`, manifest digest `2afb3c2e2086ab9cf46e8058ff90538e150473ec9509bc05dfd301423b4882b9`. The focus-determinism repair supersedes that identity with the 23-file manifest recorded below.

## Orchestrator review pass 2 and focus-determinism repair

Orchestrator reviewer pass 2 completed **FINDINGS**, retained in `ORCHESTRATOR-REVIEW-PASS-2.md`. It verified the prior three repairs but reproduced a focus-sensitive wall-time failure: independent runs `chat-arch-1790134943915-593b3bc5bd` and `chat-arch-1790135231454-f851d1f150` recorded `runtime.focused=false`, otherwise clean input/rAF/render/formatter/network/long-task evidence, and wall durations of approximately 4.2–4.5 seconds. The earlier focused run `chat-arch-1790133916558-82b5890715` recorded `focused=true` and approximately 1.9-second walls. Because focus was only inspected after measurement, the unchanged wall threshold was nondeterministic.

The test-only repair adds a bounded focus contract and per-window focus evidence:

- Before every measurement, the runner calls `page.bringToFront()`, then uses the isolated staged Electron application's own `app.focus({ steal: true })` plus its exact `fusion-shell://app/` BrowserWindow `show`, `restore`, `moveTop`, `focus`, and `webContents.focus` operations.
- Measurement cannot begin until that exact window reports `focused: true`. Precise coverage then verifies focus again immediately before `keyboard.type`; before/after observations and establishment attempts/elapsed time are retained per window. Enforcement also rejects focus loss during typing.
- If focus cannot be obtained within the bounded interval, the runner stops before timing with code `R1_FOCUS_UNAVAILABLE`, the exact visible/minimized/focused/window identity observation, and normal owned cleanup. It does not apply the wall threshold to an unfocused window.
- `window-focus.test.mjs` deterministically proves retry-to-success, explicit bounded unavailable failure, and immediate pre-typing lost-focus rejection. The correctness runner now executes these alongside coverage authenticity.
- The existing wall threshold is unchanged. No owner Fusion window, profile, or product source is observed or manipulated.

Validation on the currently locked host:

- Helper/authenticity units — PASS 5/5.
- Requested full command `chat-arch-1790136116775-c09e77fb49` — deterministic pre-measurement stop with `R1_FOCUS_UNAVAILABLE` after 48 bounded attempts. Evidence records the exact staged window as available, visible, non-minimized, and unfocused; no timing window or wall-budget assertion ran. Cleanup: no lingering process, SQLite quick check `ok`, owned port/root/run-root removal complete.
- Computer-use state independently reported that the Mac was locked and automatic unlock was unavailable. Electron-native focus and a diagnostic PID-specific System Events attempt could not overcome the lock; the ineffective external fallback was removed from final source.
- Correctness was rerun independently because the combined runner intentionally stops after the focus prerequisite failure: `chat-arch-1790136157276-44fa4c0199` — PASS. Coverage/focus helper units 5/5 and composer input/locality Playwright cases 2/2; cleanup clean.
- The last valid focused full R1 remains `chat-arch-1790133916558-82b5890715`, whose ten windows passed the unchanged wall threshold and every 04A metric. Current product bytes are unchanged; only the focus oracle/helper and correctness preflight differ.

R-04A-4 — deterministic staged-window focus prerequisite. Original authority requires foreground status to expose throttling and the packet requires preserving the wall threshold. Actual change establishes and verifies exact staged-window OS focus immediately before each measurement or returns an explicit structured focus-unavailable result before timing. Reason: prevent background timer throttling from masquerading as a product wall regression. Files: `window-focus.mjs`, `window-focus.test.mjs`, `r1-electron.mjs`, `r1-composer-playwright.mjs`, evidence/report/manifest. Tests/effect: helper unit 3/3, combined authenticity 5/5, correctness 2/2, locked-state full command fails early deterministically; product behavior unchanged. Risk: low; focused execution remains required for wall evidence, while locked/headless environments now stop transparently rather than producing misleading measurements. Downstream: all R1 consumers inherit this explicit prerequisite. Proposed classification: `accepted` mechanically necessary test determinism repair.

No 04B/04C product behavior, production hook, wall-budget waiver, threshold inflation, owner-window action, live-profile/DB access, port 3001, commit, push, Alpha operation, or destructive migration was introduced.

## Final focus-repair review and lifecycle

- Orchestrator acceptance pass 2: `/root/spec04_04a_acceptance` — terminal **FINDINGS**; focus-sensitive wall enforcement was validated and repaired.
- Focus repair pass 4: `/root/spec04_slice04a/review_04a_focus_pass4` — fresh read-only reviewer, terminal **CLEAN**, no material findings on the final 23-file candidate.
- `list_agents` confirmed every prior reviewer terminal/non-conflicting before pass 4. `close_agent` remains unavailable in this runtime, so no closure call could be attempted; terminal records are retained as lifecycle evidence.

The clean reviewer verified exact staged-window focus ownership, immediate pre-typing verification, per-window evidence, unchanged wall threshold, structured locked-host failure, helper/correctness results, continuing validity of the focused performance run for unchanged product bytes, earlier repairs, original 04A criteria, deviations, and downstream risk. Its record is `BUILDER-REVIEW-PASS-4.md`.

Pass-4 source identity was 23/23 hashes in `SOURCE-SHA256.txt`, manifest digest `2b6208a648ee63c0e876512182b87b61437bc8b3d9fd25fc5630f85db43f6594`. The positive-calibration repair supersedes that identity with the current 23-file manifest recorded below.

## Orchestrator final finding and positive-calibration repair

The final acceptance review found that CDP calibration distinguished target-name discovery from measurement counts but still accepted a discovered function whose calibration count was zero. A dead same-named function could therefore calibrate and later make a zero measurement fail open.

The bounded test-only repair adds `assertCoverageTargetsCalibrated(summary, required)`. It first requires all seven names to be discovered, then requires every corresponding calibration invocation count to be finite and strictly greater than zero. `calibrateCoverageTargets` now uses this stronger assertion before returning. The deterministic regression supplies every exact target name with zero-count ranges and proves calibration rejects them; the positive case proves the same exact set with count one passes.

Current locked-host validation:

- Coverage plus focus helper units — PASS 6/6, including missing-name, all-names-zero, positive calibration, focus success, unavailable, and lost-focus paths.
- Requested full command `chat-arch-1790137441145-e6c35ab531` — positive calibration completed before the focus prerequisite:
  - `renderTextInstant` 152, `MessageList` 4, `InstantSegmentRenderer` 32, `ChatAreaHeader` 20, `ThreadRail` 27, `ContentArea` 27, `ChatAreaFooter` 18.
  - All seven exact names discovered; every invocation count strictly positive; zero measurement windows began.
  - Then stopped with structured `R1_FOCUS_UNAVAILABLE`, as required on the locked host, with clean process/SQLite/port/fixture/run-root cleanup.
- Correctness rerun `chat-arch-1790137472384-9ca7bcfa8d` — PASS; helper/authenticity 6/6 and input/locality 2/2, clean owned cleanup.

R-04A-5 — strictly positive CDP calibration. Original SPEC requires a fail-closed zero-render/formatter oracle. Actual change requires discovery and positive invocation of every one of the seven R1 coverage targets during calibration, with a deterministic all-names-present/zero-count rejection. Reason: exclude dead or otherwise unexecuted same-named functions from authenticating later zero measurements. Files: `coverage-observation.mjs`, `coverage-observation.test.mjs`, `r1-electron.mjs`, evidence/report/manifest. Observable product effect: none. Risk: low; calibration now deliberately fails if the production hydration workload stops executing any target. Downstream: shared R1 consumers inherit a stronger authenticity prerequisite. Proposed classification: `accepted` mechanically necessary test-oracle repair.

No product source, 04B/04C behavior, owner window/profile, live DB, port 3001, Alpha, commit/push, wall threshold, or destructive operation changed.

## Final positive-calibration review and lifecycle

- Latest orchestrator acceptance: terminal **FINDINGS**; zero-invocation same-name calibration was validated and repaired.
- Positive-calibration pass 5: `/root/spec04_slice04a/review_04a_calibration_pass5` — fresh read-only reviewer, terminal **CLEAN**, no material findings on the final 23-file candidate.
- `list_agents` confirmed every prior reviewer terminal/non-conflicting before pass 5. `close_agent` remains unavailable in this runtime, so no closure call could be attempted; all terminal records are retained as lifecycle evidence.

The clean reviewer verified strictly positive finite calibration, deterministic zero/dead-function rejection, production calibration evidence before locked-host focus failure, current correctness, every prior repair, original 04A criteria, production purity, deviations, and downstream risk. Its record is `BUILDER-REVIEW-PASS-5.md`.

Final source identity: 23/23 hashes in `SOURCE-SHA256.txt`; manifest digest `d7b6fce3625a9869597ba5c1e2a27d5d13bd2fff872aada8b1f9090fa8bd8837`.

Final builder disposition: **READY_FOR_ORCHESTRATOR_REVIEW**.
