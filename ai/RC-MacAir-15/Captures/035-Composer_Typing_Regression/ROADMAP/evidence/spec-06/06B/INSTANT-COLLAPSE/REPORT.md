# Supplemental 06B — queued-item instant collapse

Status: **READY_FOR_ORCHESTRATOR_REVIEW**. Implementation, checks and first fresh builder independent gate **CLEAN**. Source-ready only; no human-app activation, acceptance of full 06B, or 06C authorization.

## Authority and current candidate

Authority: `../INSTANT-COLLAPSE-DIRECTION.md` (2026-09-27 owner direction) and serialized fresh builder dispatch. Read root AGENTS, Chat Overview, Rendering And Lifecycle, Live Rendering and Turn Finalization, current Code Standards hub/front page, Architecture Routing, Frontend UI, State Management and Testing And Smoke Slices. Read `/Users/rccurtrightjr./.codex/skills/spec-review-gate/SKILL.md` completely; applying its builder-owned gate, not clean-room-loop. Injected spec-slice-builder role provides the builder contract.

Primary development root `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Large owner worktree remains preserved. `before/` holds exact pre-edit product files; `candidate.diff` holds product delta; `delta.json` maps every changed source hash. Predecessor TO-01 source1968 SHA256 `2bedc37c0dd1b4373df5f90d2dbcde2e74059521f14b6346525ab7596d94ecc7`, build200 `b070d633863382e48ea2f6d677a92cfe65b9a4dea79caa87975711c109c70b03` retained in predecessor evidence.

Current `source.json`: **1969 entries**, SHA256 **32de225544d72a86dac75bf19926046cf57a8154d2a95550df8f7e10539d7216**. Current `build.json`: **200 entries**, SHA256 **405fe114c4a3d734112645b1305407f74d71b93620a7e520f47f45365fd4f192**. These hashes identify JSON inventory file bytes; each maps repository-relative paths to exact SHA256 file hashes. Source inventory is predecessor inventory plus the new test; exactly three entries differ. Build inventory is current dist plus predecessor native build inventory, whose nine entries are unchanged. No native rebuild/install ran.

## Changed files and behavior

- `fusion-studio-client/src/components/LiveSegmentRenderer.tsx`: one same-file keyed turn pipeline; latest last-renderable-index ref; read-only lookahead passed into shared thinking/tool phase controller; post-reveal hold/collapse waits become interruptible; effect-local cancellation retires shimmer/hold/collapse/gap/bypass continuations; once-only finish and index-bound frontier advancement. Completion effect remains in the same pipeline.
- `fusion-studio-client/src/components/ToolCallBlock.tsx`: duration CSS variable moves to shared wrapper so both body max-height/opacity and header arrow inherit the actual zero. Existing nullish duration fallback is retained.
- `fusion-studio-client/e2e/instant-collapse.spec.ts`: isolated production-rendered regression fixture and 16 behavioral cases. No duplicate collapse predicate or replacement controller.

A later nonempty text or nontext segment counts as queued output; an empty text placeholder and parser chunks inside the current item do not. A single O(n) derivation at the queue owner serves all tool lookups. Current reveal still runs to completion at existing speed. Queued output at that boundary skips the 500ms hold and 300ms collapse; arrival during either interval interrupts it and updates actual CSS to zero. The 100ms next-item gap remains. Lookahead listener retires before the gap, so completed manually opened rows remain open on unrelated renders or later output. Subagent bypass remains independent of reveal/hold/collapse/gap; completion updates retain existing collapse behavior.

Turn identity remount retires the old pipeline and its captured callback; parent completion remains effect-based and once-only. No store, server, adapter, terminal, saved ACK, text-controller, timing-profile or persistence change. The existing MessageList turn key, pendingTurnEnd gate, error immediate-finalization path, and saved metadata owners were inspected and remain unchanged. The extra inner turn key makes the component's explicit turnId contract safe when reused directly, even without a parent key.

## Acceptance mapping and runtime evidence

All new tests mount the actual production LiveSegmentRenderer through Vite in-memory IIFE, including real Orb, catalog, reveal controllers, ToolCallBlock and production CSS. Playwright Chromium owns each disposable page/context/browser. Browser clock controls time; render props emulate stream delivery. No server, Electron, global profile or paid provider adapter is launched. Playwright teardown owns exact browser cleanup; there is no external fixture directory/port/profile to clean.

| Criterion | Evidence in instant-collapse.spec.ts |
|---|---|
| Queued before reveal, thinking and tool shared path | `think` and `shell` cases assert expansion during reveal, complete second line before collapse, computed body and arrow durations zero |
| Correct next ordering, no duplicate frontier | 99ms no next mount / 100ms next mount; third tool never mounts while second text is incomplete, even after old delay expiry and rerenders |
| No-next timing retained | 499ms expanded / 500ms collapsed; final callback absent at899ms / exactly once at900ms (500+300+100) |
| Arrival during hold and collapse | +100ms and +600ms delivery adopts zero CSS immediately and preserves exact100ms gap |
| Latest queue after awaited reveal | Begin with current incomplete/no next; add next during reveal; no premature collapse; finish current and see zero |
| Same-length queue content update, parser distinction | Empty placeholder and multi-line current content leave hold intact; filling placeholder triggers immediate policy |
| Turn replacement/cancellation | Replace during hold boundary, +100ms hold, +600ms collapse, +850ms gap with same toolCallId; old callbacks never finalize A/B or reveal B's queued text; unmount hold never invokes final callback |
| User expansion preserved | Both already-queued rerenders and first late arrival after normal completion leave manually expanded row open |
| Subagent retained | Incomplete subagent expanded with waiting row; next mounts at1ms without normal delays; completed update collapses |
| Reduced motion retained | Media reduce runs actual production reveal and zero-duration queue policy; gap retained |
| Completion ownership/both orderings | Terminal-before-reveal case and reveal-before-terminal case each finalize exactly once; no premature completion |
| Stop/error/saved/session isolation | Unchanged existing chat-surface-isolation.spec.ts suite exercises real store and stream handlers, canonical error/saved updates and outbound Stop across two real mounted chat surfaces |

The existing isolation fixture uses declared fake OPEN transport and canned frames; it is an integration check of rendering/state boundaries, not a real-server or real-provider proof. New fixture does not inject animateTool, timing profile, completion predicate or CSS implementation. Computed browser CSS plus DOM phase/order observations provide runtime/manual-equivalent evidence for this timing-only change; no human-app interaction is claimed.

## Exact checks and results

From `fusion-studio-client`:

```sh
npx playwright test --config playwright.chat-architecture.config.ts e2e/instant-collapse.spec.ts e2e/chat-surface-isolation.spec.ts --output ../ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/spec-06/06B/INSTANT-COLLAPSE/playwright-05
npm run build
npx eslint src/components/LiveSegmentRenderer.tsx src/components/ToolCallBlock.tsx
```

- `tests-05.log`: **38 PASS**, 0 failed, 0 skipped, 17.7s:16 new +22 existing. Output under `playwright-05`. Pre-existing environment warning: NO_COLOR ignored because FORCE_COLOR set.
- `build-01.log`: **PASS**, preload build + TypeScript project build + Vite build (4.36s Vite). Existing large-chunk warning (>500kB); no native dependency rebuild. Product source frozen since this successful build; later repairs only touched fixture expectations/types.
- `lint.log`: **PASS**,0 errors;1 warning for existing first-line `react-hooks/set-state-in-effect` suppression now reported unused. Existing line retained to avoid unrelated cleanup.
- `git diff --check -- fusion-studio-client/src/components/LiveSegmentRenderer.tsx fusion-studio-client/src/components/ToolCallBlock.tsx`: **PASS**.
- Full predecessor source comparison: exactly three intended changes; all TO-01/full-auto/Claude source bytes preserved. Build native inventory unchanged.

## Self-review and preserved failed checks

Reviewed current queue interpretation, mount keys, timer ownership, every await exit, once-only callback guard, parent frontier/terminal effect, wrapper CSS inheritance and immediate MessageList/turn-lifecycle integration. Existing do-not-split exception keeps the 513-line completion pipeline in one file; no new controller/finalization owner. ToolCallBlock initially appeared zero-capable, but source inspection identified header-arrow scope outside body variable; shared-wrapper scope fixes both presentation consumers without CSS changes.

Raw failures are retained, not treated as product proof:

1. `tests-01.log`: test creation used repository-prefixed path while already in client cwd; no test file created, runner found no tests. Corrected working-directory path.
2. `tests-02.log` / `playwright-02`: all13 failed before mounting because Vite IIFE split CSS emitted no CSS asset for addStyleTag. Set `cssCodeSplit:false` to retain actual production styles.
3. `tests-03.log` / `playwright-03`: invalid fixture type `thinking` instead of canonical `think`;11 failed, shell/subagent2 passed. Corrected fixture and typed constructor as SegmentType to catch unsupported values. No product fallback added.
4. `tests-04.log` / `playwright-04`:11 passed/4 failed; replacement oracle incorrectly expected shell body before result while production correctly renders header only. Assertions now inspect header expansion plus frontier/no-completion, preserving awaitsResult semantics.
5. `tests-05.log`:38 passed after corrections. No failed product assertion remains.

## Deviations — proposals for orchestrator classification

All eight fields recorded for each record; classifications here do not bind orchestrator.

**D1 — turn-scoped lifecycle integration; proposed accepted.** (1) Original contract: shared tool collapse plus stale cancellation/replacement retirement, expected files advisory. (2) Actual: same-file keyed LiveTurnSegments wrapper, guarded parent frontier and cleanup for shimmer and subagent/skip timers as well as new hold/collapse waits. (3) Reason: stale onDone must not advance a replacement or fire twice; existing uncancelled waits/bypass timer could outlive item ownership. (4) Paths: LiveSegmentRenderer.tsx. (5) Checks:16 component cases,22 existing isolation cases,build,lint. (6) Effect: turn replacement retires old callbacks; normal timing/order unchanged. (7) Risk: no-turnId callers still rely on existing outer ownership; production MessageList supplies currentTurn.id. (8) Downstream: affected live render/replacement evidence superseded; finalization/store ownership unchanged.

**D2 — shared CSS variable scope; proposed accepted.** (1) Original contract: zero reaches actual presentation owner. (2) Actual: duration moves from body to wrapper. (3) Reason: arrow is a sibling of body and otherwise retains300ms CSS fallback. (4) Paths: ToolCallBlock.tsx. (5) Checks: real computed body0s/0s + arrow0s; no-next body0.3s;build. (6) Effect: body and arrow use same supplied duration, including history default300ms. (7) Risk: existing shell appearance/styles unchanged except authorized zero transition. (8) Downstream: applicable ToolCallBlock build/render evidence invalidated; instant history shares unchanged default.

**D3 — isolated fixture/evidence; proposed accepted/downstream impact.** (1) Original contract: real production component/controller matrix, affected checks/build, source-ready evidence. (2) Actual: one new standalone fixture test and bounded evidence directory; existing isolation suite reused. (3) Reason: deterministic browser time gives exact hold/gap/zero CSS proof without touching human Electron/native deps. (4) Paths: e2e/instant-collapse.spec.ts; INSTANT-COLLAPSE evidence; generated dist from required build. (5) Checks:38 PASS plus build/lint/diff and exact inventory. (6) Effect: documents timing behavior and preserves failed setups; does not activate running app. (7) Risk: browser-clock and injected stream/transport controls are declared adapters; no full-provider latency/soak/native input claim. (8) Downstream: current renderer build identity replaces prior build; rerun dependent render evidence when activating these bytes. No automatic full soak, owner acceptance, Alpha operation or 06C permission inferred.

No other out-of-scope touches. Generated dist is the required build output; predecessor inventories remain retained. Product expected files both used; no extra product helper or broad timing redesign.

## Boundaries, skipped checks and residual risks

Human driver68194/Electron68197, its copied stage/profile/transcript/current stage, remain untouched. No keyboard input, focus, app restart, test-app refresh, Alpha, Git operation, global hooks/permissions/config, native dependency alteration, paid inference or soak. Existing tests/build run only in development checkout and isolated browser fixture. Activation requires a separately coordinated current-renderer rebuild/stage refresh by the root; open copied human runtime still runs its previous bytes.

Skipped as outside bounded renderer scope: full server npm test/smoke and actual server replay (no server source changes), Electron launch/manual owner visual acceptance (explicitly prohibited), paid provider/long soak/native input, broad full-repository lint/tests, Alpha packaging/publishing. Existing22-case rendered integration supplies narrow Stop/error/saved regression coverage; previous real-server TO-01 evidence remains valid for unchanged server bytes and is not recertified for this new renderer build. No universal two-chunk cap, text speed adjustment, queue backlog redesign, or claim to resolve entire57-second delay.

## Builder review lifecycle

Pass1 reviewer `/root/builder_collapse/review_collapse_1` received the bounded raw contract/current source/tests/evidence/standards/deviations without inherited conversation or prior conclusions. No model or reasoning override. Before spawn, subtree inventory contained only builder; no prior reviewer/writer conflict.

Terminal result **CLEAN**, no material findings, required repairs, advisories or missing deviations. Reviewer independently verified all1969source/200build entries, exact3delta/before identities, queue/timer/CSS/manual/subagent/order/finalization integration and applicable build/lint evidence; reran actual production-renderer plus isolation suites: **38 passed,0failed,17.7s**, output `/tmp/fs-instant-collapse-review-1`. D1–D3 remain proposals for the orchestrator's authoritative classification. Reviewer reports no product edits, descendants, server/Electron launches or human-session interaction. No product/test bytes changed during or after review.

Reviewer final response and subsequent `list_agents` both establish **completed/terminal**. `close_agent` is absent from exposed collaboration API; inventory searches before spawn and after terminal result both returned no tool. Closure therefore unavailable, recorded as lifecycle evidence; no active reviewer remains. `review-lifecycle.json` retains the receipt. Stop at this first materially clean pass.

Root additionally independently repeated38tests PASS18.5s and build PASS4.53s, verified current1969/200 identities plus all baseline/delta hashes in ROOT-IDENTITY-INSPECTION.json; raw root-tests.log/root-build.log retained. This corroboration does not replace either independent gate. Root's orchestrator gate/authoritative deviation classification and owner-facing acceptance remain downstream.
