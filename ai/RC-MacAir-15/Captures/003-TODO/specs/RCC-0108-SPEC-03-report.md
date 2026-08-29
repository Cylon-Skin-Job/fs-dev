# RCC-0108 SPEC-03 Final Report — Server Terminal Errors and Diagnostics

**Orchestrator run:** 3 (runs 1–2 lost to infrastructure/session failures — disconnect mid-Slice-C, death mid-Slice-D; never a review failure)
**Date:** 2026-08-26
**Worktree:** `/Users/rccurtrightjr./projects/fs-dev-rcc-0108` · branch `agent/rcc-0108-roadmap` · HEAD `4f972c563948213e3b459ed52f3d2f69ca203b99` · nothing committed (isolation contract preserved; 55 dirty porcelain entries before and after)
**Status:** `SPEC_READY_FOR_SUPERVISOR_REVIEW`
**Companion ledger:** [RCC-0108-SPEC-03-orchestrator-ledger.md](RCC-0108-SPEC-03-orchestrator-ledger.md) (append-only; authoritative identity/deviation record)

---

## 1. What SPEC-03 delivers now

Server-side failure of an accepted turn is now terminalized exactly once with a fixed provider-neutral catalog, safe partial-output preservation, and a bounded redacted diagnostic reachable only through one focused retrieval route:

1. **Harness markers (Slice A):** provider-neutral `HarnessRuntimeError` (`lib/harness/errors.js`); OpenCode translates native authentication/timeout/process-close signals to markers **only inside its adapter boundary**, attaching an optional already-redacted diagnostic candidate. Shared `-32004` and auth-message classifiers removed from `thread-runtime-controller.js` and `wire/message-router.js`; raw error objects off companion notifications.
2. **Terminal normalization & durability (Slice B):** `lib/thread/turn-terminal-error.js` reconstructs exactly four catalog outcomes + generic `MODEL_RESPONSE_FAILED` fallback from genuine markers only; failure-path terminalization through the existing bound machinery (`terminalizeTurn(key,{drainId,turnId},status)` + `CanonicalDrainControl`) → `reason:'error'`, `partial:true`; terminalError rides the single error `turn_end` and terminal snapshot; partial output preserved; snapshot retained until durable save; persist-only `exchange.metadata.terminalError` via audit-subscriber; pre-begin failures create no exchange.
3. **Diagnostic table & service (Slice C):** migration `034_harness_error_diagnostics.js` + `lib/thread/harness-diagnostic-service.js` with closed V1 re-validation, R5A bounds (128B ids / 4KiB message / 16KiB stderr tail / ≤16 allowlisted markers / 24KiB serialized report / 30-day retention / 500-per-workspace / 5000 total), one-transaction purge+evict+insert, startup cleanup, best-effort never-blocks-terminalization persistence returning server-generated UUID `diagnosticId`.
4. **Retrieval route (Slice D):** focused `chat-turn:diagnostic:get` registered in the public client WebSocket router ahead of metadata dispatch with explicit no-fallthrough; exact workspaceId+threadId+turnId+diagnosticId ownership with request-time server-resolved workspace authority; ONE validated ≤24 KiB report or THE single fixed value-free unavailable response for every denial class including internal failures; reports excluded from thread-open/lifecycle/history/logs/metadata.

`turn_end` remains the sole sequenced terminal publication. streamSeq untouched. Stop/intentional cancellation remain interrupted.

## 2. Slice-by-slice state

| Slice | State | Builder | Builder-owned review | Orchestrator acceptance |
|---|---|---|---|---|
| A — Harness markers | **ACCEPTED** (run 1) | ses_fc2ae639affewY7doExyp4rV8F READY | ses_fc28a731cffejw13EgTD1vMpJo CLEAN 1st (0 material) | ses_fc27d5a1dffepvib2AojpXFvQF CLEAN 1st (0 material, 5 advisories); gate 477 green reproduced; full suite then 84/1196/1-skip |
| B — Terminal normalization & durability | **ACCEPTED** (run 1) | ses_fc27398bbffevsEOYXoIFSIcUD READY | ses_fc26082f2ffe7zjVPuuYH2RU79 CLEAN 1st (0 material) | ses_fc2570be5ffedAIsuUz00GWX31 CLEAN 1st (0 material); gate 289/289; single-bump/single-publication verified in bytes |
| C — Diagnostic table & service | **ACCEPTED** (run 2) | ses_fc01a0c06ffegiVTJ5CVjOhJzy READY | ses_fc00bc81effeadyeTV7g71VTKN CLEAN 1st (0 material) | ses_fc003be47ffe7RKCsr760CKIYq CLEAN 1st (0 material); full suite then 87/1274/1-skip; migration 034 verified applied readonly |
| D — Retrieval & publication | **ACCEPTED** (run 3 — this run) | ses_fbf2507cfffeTvJBDlwx4PLVKX READY (adopted ungated run-2 candidate bytes byte-stable; zero edits) | ses_fbf214afdffe3fP1qOhoCAQM7O CLEAN 1st (0 material, 3 advisories) | ses_fbf19b6f7ffeF7HPA8NJb6ygi4 CLEAN 1st (0 critical/0 high/0 material, 2 advisories) |

Run-3 Slice D provenance: bytes arrived present but UNGATED after run 2's death. Owned through the normal chain this run — builder validation found nothing to repair (settled design not replayed); candidate identity pinned by SHA-256: handler `e013ea03bc1c298c…`, router `78923d998a308e2e…`, handlers.test `67e7f4aefb722874…`, route.integration.test `6ea84503a2da8c0e…`. Router diff vs HEAD is exactly +13 insertions across 3 hunks (require / factory / dispatch block), additive-only, no publication path touched. All hashes recomputed identical by reviewer #12 pre/post runs and reviewer #13 at integration.

All 13 direct child subagents recorded in the ledger registry (#1–#13), every one terminal; none superseded or conflicting.

## 3. Changed/new-file manifest (SPEC-03-authored)

**NEW files (15):**
| File | Lines |
|---|---|
| fusion-studio-server/lib/harness/errors.js | 151 |
| fusion-studio-server/lib/harness/opencode/failure-marker-builder.js *(deviation S3-A-D1)* | 130 |
| fusion-studio-server/lib/harness/opencode/configured-secrets-provider.js *(deviation S3-A-D2)* | 35 |
| fusion-studio-server/lib/harness/opencode/harness-diagnostic-redactor.js | 356 |
| fusion-studio-server/lib/thread/turn-terminal-error.js | 182 |
| fusion-studio-server/lib/thread/harness-diagnostic-service.js | 373 |
| fusion-studio-server/lib/db/migrations/034_harness_error_diagnostics.js | 41 |
| fusion-studio-server/lib/wire/canonical-chat-terminal-events.js | 107 |
| fusion-studio-server/lib/ws/chat-turn-diagnostic-handlers.js | 117 |
| fusion-studio-server/test/harness/harness-runtime-error.test.js | 258 |
| fusion-studio-server/test/harness/opencode/harness-diagnostic-redactor.test.js | 321 |
| fusion-studio-server/test/thread/turn-terminal-error.test.js | 182* |
| fusion-studio-server/test/thread/harness-diagnostic-service.test.js | 373* |
| fusion-studio-server/test/ws/chat-turn-diagnostic-handlers.test.js | 225 |
| fusion-studio-server/test/ws/chat-turn-diagnostic-route.integration.test.js | 326 |

\* test file lengths as reviewed this run; all new/extracted production AND test files ≤400L per R9.

**MODIFIED files attributable to SPEC-03 (18):**
`lib/harness/types.js`, `lib/harness/opencode/index.js`, `lib/harness/opencode/json-event-translator.js` (Slice-A-era boundary wiring; authorized mechanical integration under accepted Slice A gate), `lib/startup.js` (mechanical startup-cleanup hook, verified at `startup.js:70–71`), `lib/thread/live-turn-snapshot.js`, `lib/thread/thread-runtime-manager.js`, `lib/thread/thread-runtime-controller.js`, `lib/thread/thread-runtime-automation.js`, `lib/wire/message-router.js` (classifier removal site), `lib/wire/wire-broadcaster.js`, `lib/ws/client-message-router.js` (+13L Slice D registration), plus tests `test/harness/opencode/harness-send-message.test.js`, `test/thread/audit-subscriber-chatlog-finalize.test.js`, `test/thread/thread-runtime-controller.test.js`, `test/thread/thread-runtime-automation.test.js`, `test/wire/canonical-chat-event-applier.test.js`, `test/wire/message-router.test.js` edits, `test/wire/wire-broadcaster.test.js` (D-F1 growth, below).

Manifest counts: **15 new + 18 modified = 33 SPEC-03-attributed code/test files.**
Remaining dirty entries (22 server + 6 docs incl. prior ledgers/reports/SPEC amendments) are accepted-uncommitted SPEC-01/SPEC-02 bytes sharing this roadmap branch — owned by their own reports (`RCC-0108-SPEC-01-report.md`, `RCC-0108-SPEC-02-report.md`), not re-attributed here.

## 4. Commands and verbatim results (run 3)

| # | Command | Result |
|---|---|---|
| 1 | `npx jest --runInBand test/ws/chat-turn-diagnostic-handlers.test.js test/ws/chat-turn-diagnostic-route.integration.test.js` (arrival baseline) | Test Suites: 2 passed · Tests: 27 passed · 0 failed (0.484s) |
| 2 | Same two suites (builder #10 validation) | 2 passed / 27 passed (0.417s) |
| 3 | Full SPEC §7 gate, 12 suites (builder #10) | Test Suites: 12 passed · Tests: 389 passed · 0 failed (2.717s) |
| 4 | Full SPEC §7 gate rerun (orchestrator inspection, independent) | 12 passed / 389 passed / 0 failed (2.684s) |
| 5 | Same gate (final-integration reviewer #13 live rerun) | 12 passed / 389 passed / 0 failed (2.716s) |
| 6 | Two diag suites (acceptance reviewer #11/#12 live reruns) | 2/27 each time (0.395s); #12 spot-check harness-diagnostic-service + wire-broadcaster: 2 suites / 33 passed |
| 7 | `npm test -- --runInBand` (full suite) | **Test Suites: 89 passed, 89 total · Tests: 1 skipped, 1302 passed, 1303 total · 0 failed** (9.715s). Δ vs post-Slice-C reference 87/1274/1-skip: +2 suites (+27 tests, the two diagnostic suites) + 1 passing test added to `test/thread/harness-diagnostic-service.test.js` shortly after run-2's measurement (mtime Aug 26 14:20; inside the §7 gate; green in every rerun). No unrelated/pre-existing failures to document. The 1 skipped test is the same single pre-existing skip as every arrival reference. |
| 8 | `node server.js` boot smoke (temp log, killed after verification) | `[DB] fusion.db initialized`, subscriber starts, `[WorkspaceController] Restored workspace: fs-dev`, `[Server] Running on http://localhost:3001`, `SERVER_READY:3001`; stayed alive ≥7s; terminated cleanly. Pre-existing environment-conditioned ENOENT lines only (RCs-Air-2-scoped agent-triggers/themes.json/modals optionals absent from this worktree machine name) — identical class of noise as prior accepted boots; no SPEC-03-related errors. |
| 9 | Absence sweeps (orchestrator + reviewers) | `-32004`: zero hits outside `lib/harness/opencode/` boundary (+ untouched HEAD kimi baseline test bytes, historical non-retrofit). Auth-message/classifier vocabulary: zero hits in shared thread/wire/ws code. Diagnostics references in ordinary paths (thread-crud/messages/ThreadWebSocketHandler/live-turn-snapshot/audit-subscriber/wire-broadcaster/chat-turn-metadata-handlers): zero hits. Handler: exactly 2 `ws.send` sites, 0 `console.*`. |

## 5. Deviations — totals and classifications

**Total: 13 inherited accepted deviations (Slices A–C, prior runs) + 0 new product deviations in run 3 + 1 advisory-grade documentation item closed this run (D-F1).**

Inherited (classification `accepted_no_downstream_impact` for all):
- S3-A-D1 two extra focused opencode-boundary files · S3-A-D2 secrets-provider lazy-require + injection seam · S3-A-D3 absence sweep bans classifier constructs rather than fixed-message constant · S3-A-D4 pre-existing oversized test suites updated (>400L; R9 binds new/extracted only) · S3-A-D5 router comment avoids literal -32004 outside boundary · S3-A-D6 additive exports
- S3-B-D1 defensive try/catch around synthesis calls · S3-B-D2 validator rejects kind/code cross-row mismatch · S3-B-D3 pinned shape: wire/persisted metadata omit terminalError on non-error terminals; snapshots always carry field (null-init) · S3-B-D4 thread-runtime-manager.js baseline growth 393→402L
- S3-C-D1 correct-then-cap re-validation mirrors redactor policy · S3-C-D2 additive export revalidateCandidate (consumed by retrieval too) · S3-C-D3 truncation-marker dedupe
- Non-deviation note standing: reserve-slot eviction makes caps hold AFTER insertion (hard-ceiling reading of R5A).

New this run:
- **None.** Zero deviations across Slice D builder handoff, builder-owned review, acceptance review, and final integration; reviewer-verified independently ("nothing beyond builder claims" / "no unrecorded deviation").
- **D-F1 (advisory, closed):** `test/wire/wire-broadcaster.test.js` created by SPEC-02 compliant (343L), crossed 400L during Slice B/C gate additions (now 411L). Edited-baseline file for SPEC-03; classification `accepted_no_downstream_impact`; ledger row appended as required; carried forward to SPEC-05's parent-criterion-22 line-boundary audit.
- Carried advisories (coexist with all CLEAN verdicts): uuid ESM stub in integration suite (documented precedent); generic inbound `[WS] Message type:` log also fires for diagnostic requests (opaque type/IDs only; contents provably never logged); unavailable frames echo non-empty-string identifiers verbatim / normalize others to `null` (roadmap §5.5 permits opaque echo; convention binding on consumers); one handler test title reads opposite to its correct assertion (polish); companion transport notifications value-minimized string-only by recorded disposition; awaited persist adds bounded latency only (never-throw contract verified).

## 6. Residual risks · skipped checks · temporary adapters

**Residual risks:**
- No server rate limiting on the retrieval route; denial responses are constant-shape and DB-light (workspace gate precedes any service call), consistent with sibling routes.
- Route safety partly rests on Slice C's accepted never-throw/cap contracts; if violated later, the handler's blanket catch still collapses everything to the fixed unavailable frame (throw-collapse proven by canary test).
- Migration availability of 034 is required at startup via normal migration chain (verified applied in dev DB readonly during Slice C).
- Boot-smoke ENOENT noise is environmental (machine-name-scoped optional files absent in dev worktree), unchanged from prior accepted boots.

**Skipped checks:**
- None within SPEC-03 scope. Client build / Playwright work deliberately NOT started — roadmap §7 assigns client-route/frontier gates to SPEC-04 and working/error/diagnostic UI + full Playwright lane to SPEC-05. (No other SPEC was begun.)

**Temporary adapters:**
- None. Nothing to remove.

## 7. Downstream packet impacts — SPEC-04 (and SPEC-05 touchpoints)

Frozen, do-not-loosen surfaces consumed by SPEC-04 (all verified on current integrated bytes):

1. **Diagnostic retrieval shapes (wire):**
   - request `{type:'chat-turn:diagnostic:get', threadId, turnId, diagnosticId, workspaceId?}` — ID-only; `workspaceId` optional and must agree with the server-resolved value (or be omitted).
   - available `{type:'chat-turn:diagnostic:report', threadId, turnId, diagnosticId, report}` — `report` = closed V1 object, serialized ≤24576 bytes (service-guaranteed, asserted on-wire).
   - unavailable `{type:'chat-turn:diagnostic:unavailable', threadId, turnId, diagnosticId}` — ONE fixed value-free frame for every denial class; echoed identifiers are `null` when the field was absent/non-string (client must code to this convention).
2. **Envelope availability contract:** `TurnTerminalError {kind, code, message(exact catalog text), recoverable:true, diagnosticId?}` is identical on wire turn_end, terminal snapshot, persisted `exchange.metadata.terminalError`, and chat-turn:saved merge. `diagnosticId` key PRESENT only when persistence genuinely succeeded, OMITTED otherwise (never null). Absent-key = no-envelope semantics (S3-B-D3): wire/persisted metadata OMIT `terminalError` on non-error terminals; snapshots ALWAYS carry the field (null-init). Closed validator rules at `turn-terminal-error.js:123–153`.
3. **MANDATORY client-side log suppression (roadmap §5.5 sentence 2):** the client MUST suppress EVERY retrieved diagnostic report field before console logging or captured-log forwarding. Only the message type, the fixed unavailable marker, and opaque route/diagnostic identifiers may ever be logged. This obligation is entirely unimplemented client-side today and is uniquely satisfying-by-construction server-side — SPEC-04 owns it end-to-end in its stream/log path.
4. **Retrieval discipline:** never request a diagnostic merely because an error row mounted; View details / Copy diagnostic / Ask AI to troubleshoot offered ONLY when a valid `diagnosticId` exists (parent §4.13.1); Ask AI places the report into the composer for user review/editing and NEVER sends automatically (owner decision R5A).
5. **Unchanged invariants SPEC-04 builds on:** streamSeq is the sole whole-turn sequence; error turns flush-then-finalize with exactly one terminal error mount after partial output; post-terminal chat-turn:saved correlation exempt from the live-current-turn gate; disabled legacy adapters stay unsequenced.
6. **For SPEC-05's audits:** line-boundary dispositions carried forward (wire-broadcaster.test.js 411L D-F1; prompt-canonical-route.integration.test.js 546L SPEC-01 DEV-3; thread-runtime-controller.js 498L).

Impact classification: planned successor requirements (**downstream impact**), no corrections owed back into SPEC-03.

## 8. Required supervisor/owner items

None outstanding from this SPEC. Owner decision queue R1–R10 remains fully resolved/closed. Supervisor owns SPEC review, owner presentation, and acceptance; no owner ruling was needed during run 3 and none is requested now.

---

## Terminal status

**`SPEC_READY_FOR_SUPERVISOR_REVIEW`**

— All slices accepted (A/B/C runs 1–2 inherited; D run 3), final integration review CLEAN first pass, full suite 89/89 suites with 1302 passed / 1 pre-existing skip / 0 failed, boot smoke clean, zero open deviations, nothing committed, unrelated dirty work preserved.
