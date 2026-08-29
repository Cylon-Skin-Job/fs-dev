# RCC-0108 SPEC-03 Orchestrator Ledger — Server Terminal Errors and Diagnostics

**Orchestrator:** spec-orchestrator
**Worktree:** /Users/rccurtrightjr./projects/fs-dev-rcc-0108 · branch agent/rcc-0108-roadmap · nothing committed (isolation contract preserved)
**Baseline:** 4f972c5 + accepted SPEC-01/SPEC-02 uncommitted bytes (authoritative integration baseline)
**Arrival gate state:** SPEC-02 gate 7 suites / 211 passed; full suite 82 suites / 813 passed / 1 pre-existing skip / 0 failed; boot smoke clean.

## Authority stack applied

owner decisions queue (R5/R5A/R6/R7/R8) > parent §4–8 (esp. §4.13/§4.13.1) > roadmap §5.5 + SPEC-03 > Chat Wiki/Code Standards > current code > ticket.
Binding handoff from SPEC-02 report §9: extend turn_end/error snapshots WITHOUT changing the frontier algorithm and WITHOUT an alternate terminal publication path; turn_end remains the SOLE sequenced terminal publication; route companion auth_error/error into bound terminalization where a target turn exists; disabled legacy adapters stay unsequenced (decision #11).

## Slice ledger

| Slice | Scope | Prereqs | State |
|---|---|---|---|
| A | Harness markers: provider-neutral HarnessRuntimeError (lib/harness/errors.js NEW); OpenCode boundary-only native→marker translation (auth/timeout/process-close) + optional already-redacted candidate; remove shared -32004 + auth-message classifiers from thread-runtime-controller.js and wire/message-router.js; raw err objects off companion notifications | SPEC-02 accepted | **ACCEPTED** (builder ses_fc2ae639affewY7doExyp4rV8F READY; builder-owned review ses_fc28a731cffejw13EgTD1vMpJo CLEAN 1st; orchestrator inspection CLEAN (477 gate green reproduced; absence sweep clean; route guard 5/5; full suite 84 suites/1196 passed/1 pre-existing skip); acceptance review ses_fc27d5a1dffepvib2AojpXFvQF CLEAN 1st — 0 material, 5 advisories) |
| B | Terminal normalization & durability: lib/thread/turn-terminal-error.js NEW (catalog reconstruction 4 codes + unknown fallback + safe-envelope validator); failure-path terminalization through terminalizeTurn(key,{drainId,turnId},status) — reason 'error', partial:true; terminalError on error turn_end + error snapshot only; partial output preserved; snapshot retained until save catches up; persist only exchange.metadata.terminalError via audit-subscriber; chat-turn:saved merge unchanged; pre-begin failures create no exchange | A | **ACCEPTED** (builder ses_fc27398bbffevsEOYXoIFSIcUD READY; builder-owned review ses_fc26082f2ffe7zjVPuuYH2RU79 CLEAN 1st; orchestrator inspection CLEAN — gate reproduced 289/289, single-bump/single-publication + force-null non-error verified in bytes; acceptance review ses_fc2570be5ffedAIsuUz00GWX31 CLEAN 1st — 0 material, 3 residual-risk advisories) |
| C | Diagnostic table & service: migration 034_harness_error_diagnostics.js NEW; lib/thread/harness-diagnostic-service.js NEW (closed V1 re-validation; bounds 128B ids/4KiB message/16KiB stderr tail/≤16 markers/24KiB serialized/30-day retention/500 per workspace/5000 total; one-transaction purge+evict+insert; startup cleanup; best-effort — never blocks terminalization); diagnosticId onto envelope through existing validate-then-publish chain (redactor already landed in Slice A under opencode/) | B | **ACCEPTED** (resume run 2; builder ses_fc01a0c06ffegiVTJ5CVjOhJzy READY; builder-owned review ses_fc00bc81effeadyeTV7g71VTKN CLEAN 1st; orchestrator inspection CLEAN — 10-suite gate reproduced 362/362, wiring/migration/startup-hook bytes verified, no material findings; acceptance review ses_fc003be47ffe7RKCsr760CKIYq CLEAN 1st — 0 material, 4 advisories; full suite 87/1274/1 pre-existing skip reproduced by reviewer; migration 034 verified applied in dev DB readonly) |
| D | Retrieval & publication: lib/ws/chat-turn-diagnostic-handlers.js NEW registered in client-message-router ahead of metadata dispatch (no fallthrough); exact workspaceId+threadId+turnId+diagnosticId ownership; one ≤24KiB report or ONE fixed value-free unavailable response; integration test through real router/handler/service; malformed no-fallthrough; reports excluded from thread:open/lifecycle/history/logs/metadata; streamSeq contract preserved on error turn_end | C | **ACCEPTED** (resume run 3; builder ses_fbf2507cfffeTvJBDlwx4PLVKX READY — adopted ungated candidate bytes byte-stable, zero edits, zero deviations; builder-owned review ses_fbf214afdffe3fP1qOhoCAQM7O CLEAN 1st — 0 material, 3 advisories; orchestrator inspection CLEAN — hashes e013ea03…/78923d99…/67e7f4ae…/6ea84503… verified, router diff vs HEAD exactly +13 insertions/3 hunks additive-only, focused gate 12 suites/389 passed reproduced independently, own sweeps: -32004 absent, classifier vocab absent, diagnostics refs absent from thread-open/history/lifecycle/logs/metadata modules, handler = exactly 2 send sites + 0 console; acceptance review ses_fbf19b6f7ffeF7HPA8NJb6ygi4 CLEAN 1st — 0 material, 2 advisories, byte-state re-hashed identical post-review) |

## Child subagent registry (append-only)

| # | Role | Agent | Task ID | Terminal result |
|---|---|---|---|---|
| 1 | Slice A builder | spec-slice-builder | ses_fc2ae639affewY7doExyp4rV8F | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 2 | Slice A builder-owned review | clean-room-reviewer (spawned by builder) | ses_fc28a731cffejw13EgTD1vMpJo | CLEAN first pass; 0 material; 5 advisories (terminal) |
| 3 | Slice A orchestrator acceptance | clean-room-reviewer | ses_fc27d5a1dffepvib2AojpXFvQF | CLEAN first pass; 0 material; 5 advisories (terminal) |
| 4 | Slice B builder | spec-slice-builder | ses_fc27398bbffevsEOYXoIFSIcUD | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 5 | Slice B builder-owned review | clean-room-reviewer (spawned by builder) | ses_fc26082f2ffe7zjVPuuYH2RU79 | CLEAN first pass; 0 material; 2 advisories (terminal) |
| 6 | Slice B orchestrator acceptance | clean-room-reviewer | ses_fc2570be5ffedAIsuUz00GWX31 | CLEAN first pass; 0 material; residual-risk advisories only (terminal) |
| 7 | Slice C builder | spec-slice-builder | ses_fc01a0c06ffegiVTJ5CVjOhJzy | READY_FOR_ORCHESTRATOR_REVIEW (terminal) |
| 8 | Slice C builder-owned review | clean-room-reviewer (spawned by builder) | ses_fc00bc81effeadyeTV7g71VTKN | CLEAN first pass; 0 material; 3 advisories (terminal) |
| 9 | Slice C orchestrator acceptance | clean-room-reviewer | ses_fc003be47ffe7RKCsr760CKIYq | CLEAN first pass; 0 material; 4 advisories (terminal) |
| 10 | Slice D builder (resume run 3) | spec-slice-builder | ses_fbf2507cfffeTvJBDlwx4PLVKX | READY_FOR_ORCHESTRATOR_REVIEW (terminal); zero byte edits — adopted ungated run-2 candidate bytes byte-stable after validation; zero deviations; cmds: 2 suites/27 passed, focused gate 12 suites/389 passed |
| 11 | Slice D builder-owned review | clean-room-reviewer (spawned by builder #10) | ses_fbf214afdffe3fP1qOhoCAQM7O | CLEAN first pass; 0 material; 3 advisories; re-derived all 4 hashes + live-reran both jest validations (terminal) |
| 12 | Slice D orchestrator acceptance | clean-room-reviewer | ses_fbf19b6f7ffeF7HPA8NJb6ygi4 | CLEAN first pass; 0 critical / 0 high / 0 material; 2 advisories; hashes recomputed identical pre/post review (terminal) |

## Slice D accepted deviations and advisories (orchestrator classifications, resume run 3)

New deviations: NONE. Builder claimed zero out-of-scope touches; builder-owned reviewer and orchestrator acceptance reviewer each independently found none. The router edit (+13 insertions, additive-only, dispatch-ahead-of-metadata) is inside the SPEC §5 expected file surface.

Slice D carried-forward advisories (non-blocking, coexist with CLEAN):
- (builder gate A1) integration suite stubs `uuid` under Jest ESM — documented precedent (`thread-runtime-controller` crypto.randomUUID); UUID semantics covered by accepted Slice C service suite — advisory only.
- (builder gate A2) router generic inbound `[WS] Message type:` log fires for diagnostic requests too — logs only opaque type/IDs, contents provably never logged (canary spies) — advisory only.
- (builder gate A3 / acceptance adv 2) unavailable frames echo request identifiers verbatim when non-empty strings (non-strings normalize to null); roadmap §5.5 permits opaque route/diagnostic identifiers in logs; length-bound echo would be defense-in-depth polish — advisory only; SPEC-04 consumers must know the `null` echo convention for absent/non-string fields.
- (acceptance adv 1) handler test title "…agrees…is accepted" reads opposite to its wire assertion because the stubbed service default outcome is unavailable; the meaningful assertion (service seam reached with server-resolved workspaceId) is present and correct — test-name clarity polish only.

## Final SPEC integration evidence (resume run 3)

| Check | Command | Verbatim result |
|---|---|---|
| Full server suite | `npm test -- --runInBand` (fusion-studio-server/) | Test Suites: 89 passed, 89 total · Tests: 1 skipped, 1302 passed, 1303 total · Snapshots: 0 · Time: 9.715s — **0 failed**. Δ vs Slice-C reference 87/1274/1-skip: +2 suites (the two new diagnostic suites, 27 tests) + 1 passing test added to test/thread/harness-diagnostic-service.test.js shortly after the run-2 measurement (mtime Aug 26 14:20, inside the SPEC §7 gate; green in every rerun incl. acceptance-reviewer live run). No unrelated failures to document. |
| Boot smoke | `node server.js` (backgrounded, temp log) | `[DB] fusion.db initialized`, all subscriber starts, `[WorkspaceController] Restored workspace: fs-dev`, `[Server] Running on http://localhost:3001`, `SERVER_READY:3001`; alive ≥7s; terminated cleanly. Env-conditioned ENOENT lines (RCs-Air-2 agent-triggers/themes.json/modals optional files) pre-existing machine noise, unchanged vs prior accepted boots. |
| SPEC §7 focused gate | see below | Run independently 3× (orchestrator inspection, builder #10, final reviewer #13): **12 suites / 389 passed / 0 failed** each time. |
| Final integration review | fresh clean-room-reviewer #13 ses_fbf11cf37ffexK0rHpvoFccQ2q | **CLEAN first pass** — 0 critical/0 high/0 material; 5 carried-forward advisories reconfirmed live; 1 new advisory D-F1; cross-slice questions 1–7 answered HOLDS/VERIFIED with file:line evidence; Slice D hashes recomputed identical; 55 dirty porcelain entries and HEAD unchanged across review; nothing staged. |

| # | Role | Agent | Task ID | Terminal result |
|---|---|---|---|---|
| 13 | Final SPEC integration review | clean-room-reviewer | ses_fbf11cf37ffexK0rHpvoFccQ2q | CLEAN first pass; 0 material; 1 new advisory (D-F1); envelope/publication/table-isolation/raw-material/seams/bounds all verified HOLDING on current integrated bytes (terminal) |

## D-F1 disposition (final-integration advisory, run 3)

test/wire/wire-broadcaster.test.js — created NEW by SPEC-02 (compliant 343L at its acceptance), crossed 400L (now 411L) during SPEC-03 Slice B/C gate-suite additions. R9 binds new/extracted files of the owning SPEC; for SPEC-03 this file is edited-baseline (precedents S3-A-D4/S3-B-D4: smallest-correct-change on baseline bytes; splitting green required-test coverage adds churn without contract benefit). Classification: **accepted_no_downstream_impact** — documentation-level ledger-gap closure only; no product criterion violated; carried forward for SPEC-05's final line-boundary audit (roadmap parent criterion 22) alongside existing dispositions for prompt-canonical-route.integration.test.js (546L, SPEC-01 DEV-3) and thread-runtime-controller.js (498L).

## SPEC-04 downstream packet impact (from final integration review, binding handoff)

Handoff surfaces stable on current bytes: service exports/DIAGNOSTIC_UNAVAILABLE frame (harness-diagnostic-service.js:361–372), closed validator rules (turn-terminal-error.js:123–153), snapshot shape incl. null-init (live-turn-snapshot.js:36–56), wire shapes pinned by suites. SPEC-04 must: consume the frozen retrieval/request shapes unchanged; preserve absent-key = no-envelope semantics and the null-echo unavailable convention; not loosen validation; keep sole-route report access; satisfy roadmap §5.5 sentence 2 client-side (suppress EVERY retrieved diagnostic report field before console logging or captured-log forwarding; only type/marker/opaque IDs may be logged); never auto-request diagnostics; gate View-details/Copy/Ask-AI on valid diagnosticId; composer-only Ask AI. Classification of these obligations: **downstream_impact** (planned successor requirements, not corrections).

**Terminal state run 3:** ALL SLICES ACCEPTED (A/B/C inherited runs 1–2; D accepted run 3) · final integration CLEAN · SPEC_READY_FOR_SUPERVISOR_REVIEW · supervisor owns SPEC review, owner presentation, and acceptance.

## Slice C accepted deviations (orchestrator classifications, resume run 2)

S3-C-D1 service re-validation uses correct-then-cap (truncate out-of-bounds fields + record allowlisted marker; whole-rejection only when the 24KiB cap still cannot be met) rather than rejecting out-of-bounds candidates whole — mirrors accepted redactor policy; structural invalidity still rejects whole — accepted_no_downstream_impact.
S3-C-D2 additive export revalidateCandidate (precedent S3-A-D6; also genuinely consumed by getDiagnosticReport retrieval re-validation) — accepted_no_downstream_impact.
S3-C-D3 truncation markers deduped in addition to ≤16 allowlist cap (narrower reading; matches redactor createMarkerRecorder semantics) — accepted_no_downstream_impact.
Note (not a deviation): reserve-slot eviction makes the 500/5000 caps hold AFTER insertion (hard-ceiling reading of R5A); tests assert post-insert invariant.

Slice C handoff facts for Slice D: getDiagnosticReport({workspaceId, threadId, turnId, diagnosticId}) → frozen {status:'available', report, reportJson(≤24KiB serialized)} | frozen {status:'unavailable'} (DIAGNOSTIC_UNAVAILABLE export; never throws; every missing/expired/mismatched/malformed/internal-error case is the same single outcome). Constants exported: TABLE, RETENTION_MS, MAX_ROWS_PER_WORKSPACE, MAX_ROWS_TOTAL. Envelope shape now {kind, code, message(exact catalog), recoverable:true, diagnosticId?} — diagnosticId present only when genuine marker + valid candidate + persistence succeeded; key omitted otherwise (never null); identical on wire turn_end, terminal snapshot, persisted exchange.metadata.terminalError, chat-turn:saved metadata. streamSeq/single-bump/single-publication untouched.

Slice C acceptance-reviewer advisories carried forward: thread-runtime-controller.js now 498L (edited baseline; R9 binds new/extracted only; precedents S3-A-D4/S3-B-D4 — future modularization candidate); awaited persist adds bounded latency only (never-throw contract verified); no-report-in-logs rests on construction (fixed identifiers + err.message only — verified in source); getDiagnosticReport ships ahead of its Slice D route (additive, currently unreachable from any wire path).

## Slice B accepted deviations

S3-B-D1 defensive try/catch around synthesis calls (markReady/companion can never be skipped) — accepted_no_downstream_impact.
S3-B-D2 validator additionally rejects kind/code cross-row mismatch (narrower acceptance) — accepted_no_downstream_impact.
S3-B-D3 pinned shape: wire/persisted metadata OMIT terminalError key on non-error terminals; snapshots ALWAYS carry the field (null init) — accepted_no_downstream_impact. SPEC-04 note: absent key = no envelope.
S3-B-D4 thread-runtime-manager.js baseline growth 393→402L (options carrier param into terminalizeTurn) — accepted_no_downstream_impact.

Slice B handoff facts: TurnTerminalError identical on wire/snapshot/metadata {kind, code, message(exact catalog text), recoverable:true, diagnosticId?}; terminalizeTurn(key, identity, status='complete', options={terminalError}); completeLiveTurn(snapshot, status='complete', terminalError=null) re-validates + force-nulls non-'error'; error chat:turn_end = SPEC-02 union + terminalError (key omitted otherwise); published seq === retained seq; chat-turn:saved correlation {turnId, exchangeId, seq, ts, partial, reason, metadata incl terminalError}.

## Slice A accepted deviations (orchestrator classifications)

S3-A-D1 two extra focused opencode-boundary files (failure-marker-builder.js, configured-secrets-provider.js) — authorized delegation — accepted_no_downstream_impact.
S3-A-D2 secrets provider lazy-require + initialize({getConfiguredSecrets}) injection seam — documented decision — accepted_no_downstream_impact.
S3-A-D3 absence sweep bans classifier constructs (not the required fixed-message constant) — stronger structural detection — accepted_no_downstream_impact.
S3-A-D4 updated pre-existing test suites exceed 400L (976/1034) — R9 binds new/extracted files only; smallest-correct-change on baseline bytes — accepted_no_downstream_impact (no precedent for new files).
S3-A-D5 router comment avoids literal -32004 outside boundary — accepted_no_downstream_impact.
S3-A-D6 additive exports createConfiguredSecretsProvider/isOpenCodeNativeAuthFailure — accepted_no_downstream_impact.

Slice A acceptance-reviewer advisories carried to later slices: structured candidate fields trusted-structured at service revalidation (C); describe-seam split advisory for oversized baseline suites (non-binding); auth-vocabulary heuristic contained in boundary; control-char policy documented; exit→close stop race identical to baseline.

## Deviation ledger (append-only)

(none yet)

## Resume run 3 — 2026-08-26 (arrival evidence)

Runs 1–2 ended in infrastructure/session failures (run 1 disconnect mid-Slice-C; run 2 death mid-Slice-D), not review failures. Slices A/B/C acceptance records above are untouched. Arrival preflight on resume:

- Worktree `/Users/rccurtrightjr./projects/fs-dev-rcc-0108`, branch `agent/rcc-0108-roadmap`, HEAD `4f972c563948213e3b459ed52f3d2f69ca203b99` unchanged; ~55 dirty files preserved, isolation contract intact.
- Slice D candidate bytes found PRESENT but UNGATED (no builder handoff, no review of any kind): lib/ws/chat-turn-diagnostic-handlers.js (117L NEW), registration in lib/ws/client-message-router.js (+factory L91, dispatch-ahead-of-metadata L121–130), test/ws/chat-turn-diagnostic-handlers.test.js (225L), test/ws/chat-turn-diagnostic-route.integration.test.js (326L).
- Orchestrator preflight byte-read confirms: single `chat-turn:diagnostic:get` message type; server-side workspace resolution via ThreadWebSocketHandler.getState(ws).threadManager.workspaceId (matches thread-crud.js precedent); one report or ONE fixed value-free unavailable response {type, threadId, turnId, diagnosticId}; dispatch ahead of metadata with explicit no-fallthrough return covering unknown diagnostic types too; structural tests assert diagnostics excluded from thread-open/history/lifecycle/metadata modules.
- Service-side frozen Slice C export contract verified verbatim on current bytes: TABLE, RETENTION_MS, MAX_ROWS_PER_WORKSPACE, MAX_ROWS_TOTAL, DIAGNOSTIC_UNAVAILABLE, persistDiagnosticReport, getDiagnosticReport, revalidateCandidate (harness-diagnostic-service.js:361–373). All consumed seams exist.
- Arrival test evidence (run 3): `npx jest --runInBand test/ws/chat-turn-diagnostic-handlers.test.js test/ws/chat-turn-diagnostic-route.integration.test.js` → Test Suites: 2 passed, Tests: 27 passed, 0 failed.
- Plan: own ungated bytes through the normal chain — fresh spec-slice-builder adopts them (repair only on validated findings; settled design not to be replayed), earn builder-owned review, then orchestrator inspection + acceptance review, then final SPEC integration (full suite `npm test -- --runInBand` vs Slice-C reference 87 suites / 1274 passed / 1 pre-existing skip, boot smoke, final-integration reviewer).

## Notes

- Migrations dir has a pre-existing duplicate 021 pair (021_recent_docs.js, 021_screenshot_source_folder.js). Next migration number is 034. Duplicate is out of scope; do not repair.
- Shared -32004/auth-message classifier sites found: thread-runtime-controller.js:314, wire/message-router.js:97 (+ pinned tests message-router.test.js:67,134-141).
- Raw error objects currently cross to clients: controller auth_error sends `error: err`; router forwards `error: msg.error`. Both are lifecycle/notification paths — must be value-minimized under the hard constraint.
- audit-subscriber persists every turn_end with metadata spread-through (aggregator spreads existingMetadata) → metadata.terminalError flows if placed on auditMetadata/event.
- completeLiveTurn clears usage/transients and bumps once; terminalError must ride the same single terminal mutation without a second bump or alternate publication path.
