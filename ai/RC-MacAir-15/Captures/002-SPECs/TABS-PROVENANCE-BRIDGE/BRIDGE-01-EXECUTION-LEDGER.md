# BRIDGE-01 (SPEC-01) — Execution Ledger

**Bundle:** TABS-PROVENANCE-BRIDGE · **Candidate:** `BRIDGE-d13b0d39d691ec58` (approved 2026-09-12)
**Baseline commit:** `333d49e3bf2a6bcaeb8f7cdfd6b5ae64b85cee56`
**Orchestrator:** primary session acting as spec orchestrator (owner-appointed, direct run)
**Gates:** SPEC-01 §10 (client build, server `npx jest --maxWorkers=2`, durable smoke, mediated-save + PROV-01 regressions)
**Hard constraints:** never commit/amend/push; preserve unrelated bytes; frozen TABS-03 `componentTabPlacement*` types untouched; no SPEC-34/40, rendering, retention, or non-mutating telemetry; BRIDGE-02 gated.

## Inherited-work note

An earlier dispatch of this SPEC (fresh `spec-orchestrator` subagent) was cancelled by the
owner mid-flight because the owner directed that this session run the orchestrator role
directly (fewer subagent levels). That cancelled attempt left **unreviewed candidate bytes**
in the working tree (last writes ~05:46; no builder handoff, no gate review, no report).
Every inherited byte is treated as current-but-unverified: each slice is being re-owned by a
fresh `spec-slice-builder`, validated against SPEC-01 line by line, repaired as needed, and put
through the full builder + orchestrator gate sequence. Nothing inherited is accepted on trust.

Pre-existing unrelated bytes (present before any dispatch; never touched):
- `M ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-COORDINATION/OWNER-DECISIONS.md`
- `?? ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-BRIDGE/` (this bundle)
- `?? ai/RC-MacAir-15/Captures/031-Remote_Access/` (separate concurrent worker artifact)

## Slices

| Slice | Scope | Inherited bytes | Builder | Builder gate | Orchestrator gate | State |
|---|---|---|---|---|---|---|
| 01A | Client context contract + renderer adapter + carrier population + client source tests | save-action-context.ts; fileConnectedTabs.ts; fileDataStore.ts; types/file-explorer.ts; resource-provenance-protocol.ts; 2 e2e source specs; playwright.source.config.ts | builder `ses_f6a3cbf5dffe5aAF484IGuLTwJ`; reviewer `ses_f6a364d9cffeV1c8kzOK1wKJxI` CLEAN (1 pass) | `ses_f6a338494ffeToifBK6u1LEHRS` CLEAN (1 pass) | **accepted** (2026-09-12) |
| 01B | Server validation, schemas, migration 040, persistence, query path, server tests | reported-ui-context.js; 040 migration; file-save-route.js; save-controller.js; file-operation-repository.js; fact-reservation-bindings.js; resource-provenance-repository.js; resource-provenance-route.js; 4 schemas; schema-validator.js; server tests | builder `ses_f6a31a3dbffeVrpZTWl5VJy0mn` (no edits: inherited bytes validated and kept); reviewer `ses_f6a2c1aa7ffeCtKAWMElq27mFU` CLEAN (1 pass) | `ses_f6a281861ffecrs6lKfIMnN8GS` CLEAN (1 pass) | **accepted** (2026-09-12) |
| 01C | Integration proof (live save/close/switch/restart) + SPEC implementation report | e2e/bridge/*; playwright.bridge.config.ts | builder `ses_f6a24f8a7ffe0E1fpBTT0X5hhv` (D-02 fixture repair); reviewer `ses_f67bbe538ffe3BkQFBpNVROGmY` CLEAN (1 pass) | final integration `ses_f67b38dc4ffeTGyjD8FYH8Tajx` CLEAN (1 pass) | **accepted** (orchestrator); owner review pending |

## Deviations

(recorded with contract clause, actual change, reason, tests/effect, risk/downstream impact, classification)

- **D-01 — live-proof boundary (01C)** — contract clause: SPEC-01 §10 "e2e/Electron proof". Actual: real client modules + real WebSocket + real server + real SQLite + store-level close/switch; no Electron/browser UI drive. Reason: File view is read-only, so a UI-originated mediated save is not reachable; strongest feasible proof. Tests/effect: all §2 outcomes established; browser save-control wiring not exercised. Risk/downstream: future UI-drive proof optional. Classification: **accepted** (compatible deviation, owner informed).
- **D-02 — shared test-fixture repair (01C, out of SPEC expected areas)** — contract clause: mechanically necessary integration (GUIDANCE §5; SPEC-01 §10 check 5). Actual: additive generation-gated `setWorkspaceBinding`/`replaceViewCapsuleProjection` stubs in `fusion-studio-client/e2e/support/trusted-shell-browser-fixture.ts`. Reason: pre-existing fixture predates the view-platform projection gate; accepted mediated-save/agent-tool live proofs fail at bootstrap without them. Tests/effect: `FILE_VIEWER_LIVE_PROVENANCE_OK`, `AGENT_TOOL_LIVE_PROVENANCE_OK`; other generations still fail closed. Risk/downstream: absorb in a future harness consolidation. Classification: **accepted** (mechanically necessary, test-hardware only).
- **D-03 — tautological launcher manifest assertion (01C)** — advisory; no effect on proof validity.
- **F-04/F-05 — launcher printed constants / success-path comparison (01C)** — advisories; failed guards throw before printing, so no passing run is overstated.

No deviation activates SPEC-34/40 machinery, provenance rendering, retention, non-mutating telemetry, or frozen TABS-03 placement types.

## Lifecycle log

- 2026-09-12 06:13 — preflight complete; inherited bytes assessed; ledger opened.
- 2026-09-12 06:2x — slice 01A: fresh builder owned inherited client bytes; one in-scope guard repair (echo requires workspaceId+viewId); builder gate CLEAN pass 1. Orchestrator reruns: `npm run build` PASS; `npx playwright test --config=playwright.source.config.ts` 65 passed; all 8 file hashes matched. Orchestrator acceptance reviewer CLEAN pass 1. 01A accepted.
  - 01A fingerprint aggregate: `9edbcb7a34f5296afacb5ca6b7b9917810b00eee1a0d3c6644e1205b3d57cb99`
- 2026-09-12 06:3x — slice 01B: fresh builder validated all 25 inherited server bytes and made no edits; builder gate CLEAN pass 1. Orchestrator reruns: full `npx jest --maxWorkers=2` 198/198 suites, 2898 passed / 1 pre-existing skip / 0 failed; all 25 hashes matched. Orchestrator acceptance reviewer CLEAN pass 1. 01B accepted.
  - 01B fingerprint aggregate: `3ac10490a0e73687eaa33ab304b24d28c93d8bb7dbbc72ab44005d8fc3d20d45`
- 2026-09-12 07:0x — slice 01C: fresh builder validated/finished the inherited harness, repaired D-02, authored the implementation report; builder gate CLEAN pass 1. Orchestrator reruns: build PASS; source suite 65 passed; bridge live exit 0 `BRIDGE_01_INTEGRATION_OK`; file-viewer live exit 0 `FILE_VIEWER_LIVE_PROVENANCE_OK`; durable smoke `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK` (gate hash unchanged); full server suite 198/198, 2898 passed. Final integration reviewer `ses_f67b38dc4ffeTGyjD8FYH8Tajx` CLEAN pass 1. 01C accepted; D-01/D-02 accepted, D-03/F-04/F-05 advisory.
- 2026-09-12 07:0x — final identity: HEAD `333d49e3…` unchanged; approved bundle fingerprint `d13b0d39…` exact; 37-path changed-set aggregate `39b4b559…` reproduced. Report finalized (orchestrator section). **Not owner-accepted; READY FOR INDEPENDENT OWNER-SIDE REVIEW. BRIDGE-02 remains gated.**
