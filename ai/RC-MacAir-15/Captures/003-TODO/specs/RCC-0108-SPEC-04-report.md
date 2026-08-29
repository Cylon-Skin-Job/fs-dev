# RCC-0108 SPEC-04 Final Report — Client Routing and Frontier Restoration

**Orchestrator run:** 3 (runs 1–2 lost to infrastructure: suspected stuck subagent + owner cancellation — never review failures; no durable run-2 changes)
**Date closed:** 2026-08-27
**Worktree:** `/Users/rccurtrightjr./projects/fs-dev-rcc-0108` · branch `agent/rcc-0108-roadmap` · HEAD `4f972c5` · nothing committed
**Ledger (append-only, authoritative):** [RCC-0108-SPEC-04-orchestrator-ledger.md](RCC-0108-SPEC-04-orchestrator-ledger.md)
**Terminal status: SPEC_READY_FOR_SUPERVISOR_REVIEW**

---

## 1. What SPEC-04 delivers

The client is now safe for interleaved thread/turn streams and deterministic snapshot/live races:

1. **Explicit routing gate (Slice B):** every in-flight message passes identity → sequence → addressed-current-turn validation *before any store/helper mutation*; turn_begin null/same/different-ID rules; wrong-thread/wrong-turn frames drop pre-mutation; namespace state keyed `threadId+turnId`; post-terminal `chat-turn:saved`/metadata correlate by `threadId+turnId`/`exchangeId` without touching live helpers.
2. **Exact §5.3 frontier (Slice C):** atomic already-revealed baseline install at N; drop ≤N; buffer >N by sequence; contiguous exactly-once drain from N+1; gaps never guessed (newer snapshot advances through them); older snapshots cannot regress; cross-thread hydration isolated; terminal-error envelope retained on the completed-message row when durable history lacks the exchange; save acks merge without duplication.
3. **Typed routed transport (Slice A):** focused type modules behind an index hub; all ten in-flight wire members require positive-integer `streamSeq` (sole whole-turn authority); `stepNumber`/`StepBegin` shapes deleted; `activityRevision` is mirror-only in client bytes (never compared, ordered, or suppressing).
4. **Mandatory diagnostic safety proven end-to-end (Slices B+D):** `redactMessageForLog()` allowlist on the sole central WS console path, proven through the packaged client's own log line (byte-exact allowlist, raw fields absent); retrieval entry point definition-only with zero auto-callers; null-echo denial resolution.
5. **Deterministic browser proof (Slice D):** Playwright WebSocket routing/proxy fixture (no product-visible hooks), 22 serial `--workers=1` tests covering every SPEC §5 Routing (8 bullets) + Frontier (11 bullets) bullet through public UI/store-observable behavior of the real packaged client.

## 2. Slice-by-slice gate chains

| Slice | Chain (children per registry §5) | Result |
|---|---|---|
| A — Types/state | builder #1 → self-review (5 findings fixed) → builder reviewer #2 CLEAN 1st pass → orchestrator inspection + reruns → acceptance reviewer #3 CLEAN 1st pass | **ACCEPTED** (run 1) |
| B — Routed handlers | builder #4 → self-review incl. critical design bug repaired pre-gate → builder reviewer #5 CLEAN 1st pass → orchestrator reruns + reviewer 42/42 behavioral proof → acceptance reviewer #6 CLEAN 1st pass | **ACCEPTED** (run 1) |
| C — Snapshot/save | builder #7 → self-review (4 defects pre-spawn) → builder reviewer #7 CLEAN 1st pass → orchestrator reruns → acceptance reviewer #9 FINDINGS (1 material F-C1) → in-slice repair + FC1 regression pair (smoke 88/88) → fresh reviewer #10 CLEAN 1st pass on repaired bytes (gate stopped) | **ACCEPTED** (run 1 + run-2 repair gate) |
| D — Fixture + protocol proof | orchestrator scaffold assessment (probe absent = correct S4-C-D6 cleanup; `${PANEL}` defect already fixed in frozen bytes; 400L zero-headroom noted) → builder #11 (22-test lane green after D-D3..D8/D10 repairs confined to owned bytes) → builder reviewer #12 CLEAN 1st pass → orchestrator full verbatim §6 rerun + residue investigation/remediation → acceptance reviewer #13 CLEAN 1st pass → final integration reviewer #14 CLEAN 1st pass (gate stopped) | **ACCEPTED** (run 3) |

Every gate stopped at its first clean pass. All 14 registered children terminated normally; no spawn rejections; single slice writer at all times.

## 3. Changed/new manifest (line counts at final revision)

**New client files:** `src/types/chat-wire.ts` 258 · `src/lib/ws/stream-helper-registry.ts` 330 · `src/lib/ws/tool-stream-handlers.ts` 252 · `src/lib/ws/chat-diagnostic-handlers.ts` 196 · `src/lib/ws/frontier.ts` 145 · `src/lib/ws/live-route.ts` 208 · `src/lib/ws/snapshot-restore.ts` 400 (at bound) · `e2e/working-activity.spec.ts` 400 (at bound) · `e2e/support/working-activity-ws-fixture.ts` 349 · `e2e/support/working-activity-wire.ts` 287 · `e2e/support/working-activity-scenario.ts` 214.
**Modified client files:** `src/types/index.ts` 22 (re-export hub) · `chat.ts` 296 · `websocket.ts` 187 · `workspace.ts` 177 · `view-state.ts` 233 · `src/state/slices/chatSlice.ts` 367 · `src/lib/tool-grouper.ts` 227 · `src/lib/ws/stream-handlers.ts` 415 (baseline growth, S4-C-D3) · `turn-lifecycle.ts` 229 · `subagent-stream.ts` 180 · `thread-handlers.ts` 269 · `src/lib/ws-client.ts` 412 (baseline; suppression seam export S4-B-D4).
All new/extracted files ≤400L (roadmap §5.7); baseline growth documented; `LiveSegmentRenderer.tsx` untouched.

## 4. Commands + verbatim results (final bytes, this run)

| Command (from `fusion-studio-client/`) | Result |
|---|---|
| `npx eslint` (SPEC §6 verbatim 15-path src list) | exit 0; all 15 predicted paths exist |
| `npm run build` | ✓ built in 3.55s (pre-existing chunk-size warning only; baseline was green) |
| `npx playwright test e2e/working-activity.spec.ts --grep "@routing\|@frontier" --workers=1` | **22 passed (25.8s)** — orchestrator; independently reproduced: acceptance #13 22 passed (26.1s), integration #14 22 passed (26.2s), builder ×3 (26.5/25.4/26.4s) |
| `rg -n "stepNumber\|case ['\"]StepBegin['\"]\|type: ['\"]StepBegin['\"]\|streamRevision" src` | zero hits (sweep clean); same pattern over 4 owned e2e files: zero hits |
| `npx playwright test e2e/thread-bootstrap-order.spec.ts --workers=1` | 1 passed (Node-runner continuity lane) |
| Full server suite | **Not re-run — SPEC-04 authored zero server bytes** (porcelain-attributed). Arrival reference stands: 89 suites / 1302 passed / 1 pre-existing skip / 0 failed. Delta vs reference: none attributable. |

Accepted-pin integrity re-verified this session: index.ts ca637e26 ✓ · chat.ts 9ed8b1ac ✓ · live-route.ts c8225ad8 ✓ · snapshot-restore.ts cca59e1b ✓.

## 5. Deviations (33 rows + 1 intra-slice repair)

**Inherited (runs 1–2, unchanged):** S4-A-D1..D9 (all `accepted`; two `accepted_no_downstream_impact`) · S4-B-D1..D6 (all `accepted`) · S4-C-D1..D6 (`accepted` ×4, `accepted` advisory for D6, **D4 = `downstream_impact`** cosmetic boundary split → RCC-0112) · **F-C1 `repair_required` → resolved within slice** (material finding repaired, fresh reviewer #10 CLEAN).

**New this run (S4-D-D1..D12, all `accepted`, full fields in ledger §6):** D1 probe deletion formalized · D2 support-helper convention · D3 view-state neutrality shim (hermeticity + stops owner-tree writes; masking residual carried to SPEC-05) · D4 per-thread `openHandled` barriers · D5 server-truthful `contextUsage` fraction frames · D6 §5-exact streaming expectations · D7 canonical-mirror A/B isolation redesign honoring slot-replacement · D8 `TurnBegin` subagent vocabulary · D9 e2e check mechanism = ESLint + Playwright (tsconfigs exclude e2e) · D10 spec pinned exactly 400L via in-file compensation · **D11/D12 orchestrator remediation:** run-1-era pre-shim fixture boots wrote runtime view state into owner `ai/**` workspace state; empirically contained (boot rewrites file but SHA stable ⇒ no value flow through shim); `ai/RC-MacAir-15/System/state/state.json` restored byte-identical to HEAD (now diffs empty); untracked `ai/RCs-Air-2/System/state/state.json` neutralized (`currentThreadId: null`); `Views/002-file-viewer/state/state.json` cosmetic tab churn left untouched (no fixture markers; mixed attribution — clobber risk outweighs cleanup value).

Zero `owner_ruling_required`. Zero `repair_required` outstanding.

## 6. Residual risks · skipped checks · temporary adapters

- **Risks:** D-D3 masking residual (suite proves state-neutral paths; persisted-view-state regressions invisible to it) · byte-exact console-format coupling in the redaction test (loud-fail maintenance cost only, D-A') · receive-side TS looseness for report-frame identifiers/`category` (runtime validation strict; UI reads defensively — C-A1/A2 informational) · B-A1 namespace re-creation window between turn_end release and async finalize (HEAD-equivalent exposure, coherence invariant documented) · 400L zero headroom on the spec file · lane depends on Playwright WS-route plumbing (documented trade-off; 6 independent green runs).
- **Skipped checks (with reasons):** full server suite (zero server bytes authored; arrival reference stands); full legacy Playwright suite (SPEC §6 defines the focused gate; two PRE-EXISTING unrelated failures — `chat-context-meter.spec.ts`, `typing-effect.spec.ts` — fail identically without SPEC-04 bytes, predating the branch; **flagged for supervisor disposition before SPEC-05's global gate**).
- **Temporary adapters:** none remaining (run-3 diagnostics taps and any probe artifacts removed; the only deliberate absence is the deleted throwaway probe, S4-D-D1).

## 7. SPEC-05 downstream packet impacts

1. **Fixture/tag contract:** extend THE SAME `e2e/working-activity.spec.ts` with `@working`/`@terminal-error`; reuse `installWaFixture` ops + scenario helpers + wire factories; per-thread `openHandled` settle API; every command `--workers=1`; 400L in-file compensation convention is mandatory from line one.
2. **Typed delivery contract:** `ChatInFlightWireMessage` (chat-wire.ts), `WsTurnEndMessage.terminalError?` (present only on genuine persistence success, never null), `LiveTurnSnapshot.terminalError` non-optional-null; usage mirror nullable-tolerant (never read usage from terminal snapshots).
3. **Retained envelope location:** completed-message row (`id === turnId`) carrying `terminalError` via `installCompletedInstantRow` retention + `applySavedExchangePayload` merge — SPEC-05 owns the exactly-one-visible-error public proof.
4. **Proof ownership landing in SPEC-05:** strictly-greater `activityRevision` presentation (revision is mirror-only today — no compare/order/suppress exists client-side); stale-Working-resurrection proof; optional one-line negative guard asserting no `chat-turn:diagnostic:get` in `sentFrames()` after an error-row mount (acceptance advisory).
5. **Caveats riding the packet:** D-D3 state-neutral-suite masking; C-A1/A2 defensive UI reads; B-A1 window; pre-existing lane failures listed above (supervisor owns disposition before the SPEC-05 global Playwright run); S4-C-D4 cosmetic boundary split → RCC-0112 (unchanged).

**Downstream impact classification: compatible deviations; none requiring correction; no owner ruling required.** SPEC-05 may begin after supervisor review per roadmap §6.

## 8. Evidence paths

- Ledger (append-only): `ai/RC-MacAir-15/Captures/003-TODO/specs/RCC-0108-SPEC-04-orchestrator-ledger.md` (§5 registry #1–14, §6 deviations, §7 final handoff facts)
- This report: `ai/RC-MacAir-15/Captures/003-TODO/specs/RCC-0108-SPEC-04-report.md`
- SPEC/roadmap/parent contract: same directory + `RCC-0108-ROADMAP.md` + `RCC-0108-chat-working-step-activity.md`
- Candidate bytes: hashes/line counts in ledger §3 Slice D state block and this report §3

---

**SPEC_READY_FOR_SUPERVISOR_REVIEW**
