# CHAT-AR 06B supplemental SPEC — Truthful premature-turn outcomes

Status: owner-authorized dispatch; independent document review CLEAN (receipt in `evidence/spec-06/06B/TURN-OUTCOME/PLANNING-REVIEW.md`).
Repository: `/Users/rccurtrightjr./projects/fs-dev`.
Owner authority: “Okay, so let's go ahead and draft a SPEC for that other fix and send it off.” The immediately preceding agreement defines this as reporting an unsuccessful premature ending, not resuming it. This instruction authorizes dispatch of that bounded contract without a second drafting-approval round; it does not accept its implementation or SPEC-06.

## Bundle index, ordering and authority

This is a one-slice supplemental repair packet inside the active SPEC-06/06B chain, not a seventh roadmap SPEC. Its normative artifact is this file. Its review and candidate manifest live in `evidence/spec-06/06B/TURN-OUTCOME/`. Its implementation report is `evidence/spec-06/06B/TURN-OUTCOME/REPORT.md`.

- `owner_decision`: report a prematurely stopped turn honestly; do not automatically resume or retry it.
- `owner_decision`: OpenCode full auto is separately authorized and currently being implemented. Future hook/list/approval UI is explicitly deferred.
- `spec_contract`: preserve SPEC-06 acceptance, canonical turn identity, Stop, partial-content retention, durable errors and owner acceptance gates.
- `source_of_truth_contract`: provider interpretation belongs in adapters; the server owns terminal state; the UI consumes safe canonical errors, including on history hydration.
- `active_code_constraint`: the existing clean-exit fallback treats any useful assistant activity as sufficient for synthetic `complete`, including failed tools. The translator treats `tool-calls` as a nonterminal step.
- `implementation_choice`: reuse existing failure markers, safe terminal catalog and error rendering; keep provider-specific classification below the adapter boundary.

Dependency order: finish/review the bounded full-auto change first, freeze its current bytes, then execute this repair serially through the existing SPEC-06 orchestrator. Both changes touch the OpenCode adapter/tests; do not dispatch overlapping writers. Preserve the Claude-compatibility disable policy. Source changes do not update the currently running copied human-test stage.

## Objective and user-visible contract

When a provider run ends before successful turn completion, Fusion must report an unsuccessful turn rather than manufacture successful completion. Already produced text and tool history remain visible and saved. The turn stops working, its controls settle through the existing runtime owner, and the user can submit a subsequent prompt normally.

Use the existing durable `Response failed` presentation and appropriate fixed safe catalog explanation, such as `HARNESS_EXITED` / “The model process ended before the response completed.” This is not a new modal, approval prompt, toast-only warning or assertion that no file changes occurred. Detailed diagnostics remain behind the existing explicit diagnostic action. Never attribute a headless permission rejection to a human click without evidence.

## Non-goals

- No hook, permission list, approval/retry UI, service/SDK migration or auto-resume.
- No permission broadening, `--auto` policy changes or explicit-deny removal in this packet.
- No inferred semantic assessment that a model fully solved the user's task; this concerns observable protocol/runtime completion.
- No repair of Pac-Man or other human-test project content; no styling-template parity work.
- No global OpenCode configuration, historical transcript backfill, hand-edited databases, unrelated harness redesign, Alpha/release/Git publishing.
- No live human-session restart, click, typing, prompt injection or cache clearing. Existing logs and user-created files remain intact.
- No waiver of numerical soak, original-symptom acceptance or SPEC-06C prerequisites.

## Required authorities and standards

Read root `AGENTS.md`, `fusion-studio-server/AGENTS.md`, `SPEC-06.md`, `GUIDANCE.md`, `ARCHITECTURE.md`, `VALIDATION.md`, current `ROADMAP-LEDGER.md`, and the full-auto/Claude follow-up reports before changing code. Repository-relative paths below resolve from the repository stated above.

Chat entry authority: `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`. Follow its relevant runtime, harness/canonical-event, lifecycle and testing pages before implementation. Do not weaken the accepted safe-error disclosure contract.

Standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Required pages under that same `001-Code_Standards/` directory:

1. `001-Architecture_Routing/PAGE.md`
2. `002-Frontend_UI/PAGE.md`
3. `003-State_Management/PAGE.md`
4. `004-WebSocket_Protocol/PAGE.md`
5. `005-Universal_Event_Bus/PAGE.md`
6. `006-Harness_Adapters/PAGE.md`
7. `007-Persistence_And_Metadata/PAGE.md`
8. `008-Testing_And_Smoke_Slices/PAGE.md`

No standards exception is authorized. Existing implementation expectations that promote the observed failed/incomplete sequence to success are superseded only for this bounded defect. Preserve documented no-terminal compatibility cases without failure/nonterminal evidence unless current source evidence proves them unsound and the deviation is explicitly reported.

## Grounded reproduction and baseline

The independent human run `human-1790494814495-ca038557` uses OpenCode 1.18.32 and Together DeepSeek V4.1 Flash/high. At 2026-09-27T08:10:03Z:

- OpenCode session `ses_f1e313f4bffek7X1JnL2BR6gM9`, message `msg_0e1e9db35001SIOhyCGVGpjYpD`, bash call `call_01a0e1e9fa2b717badccc359` reports `state.status:error` with permission-rejection text.
- An earlier screenshot read and image-dimension shell command succeeded. The rejected command attempted `cd /tmp` and image cropping. The exact permission category was not established from the retrieved logs.
- Last native finish is `tool-calls`; there is no subsequent completed answer.
- Fusion exchange 9, thread `2026-09-27T00-40-17-717`, turn `995fa6f9-da4d-4880-9be0-0c5c802f4ee0` saved `reason:complete`, `partial:false`.

Evidence: `evidence/spec-06/06B/human-1790494814495-ca038557/` and retained profile/SQLite identified in its `session.json`. Use read-only evidence collection and sanitized synthetic fixtures; do not replay the real crop or expose entire reasoning/credentials in test fixtures. A prior fresh-profile incident before the Claude fix exhibited the same failure with a read call. The fixture must exercise actual JSON parsing/translation/adapter termination, not mock away this boundary.

Baseline areas to inspect:

- `fusion-studio-server/lib/harness/opencode/index.js`: `buildRunArgs`, event consumption, synthetic terminal fallback, process close and Stop.
- `fusion-studio-server/lib/harness/opencode/json-event-translator.js`: tool snapshots and `translateStepFinish`.
- `fusion-studio-server/lib/harness/errors.js` and existing OpenCode failure-marker/diagnostic helpers.
- `fusion-studio-server/lib/thread/runtime-dispatch.js`, `turn-terminal-error.js`, `live-turn-snapshot.js` and owning persistence path.
- `fusion-studio-server/lib/wire/canonical-chat-event-applier.js` and terminal publication owners.
- `fusion-studio-client/src/lib/ws/turn-lifecycle.ts`, `snapshot-restore.ts`, `src/lib/chat/terminal-error.ts`, `src/components/chat/ChatTurnError.tsx` and their actual consuming message component.

These are expected inspection areas, not a mandate to modify every file. Prefer a narrow adapter fix using existing downstream behavior. No schema migration is expected. If a necessary schema/catalog change is discovered, record its reason and complete all server/client validation/readback consumers; do not interpolate raw provider errors into user-facing text.

## Single vertical slice TO-01 — Provider exit to durable visible outcome

Implement the adapter classification and all mechanically necessary integration to make the corrected outcome visible live and after hydration.

### Terminal decision requirements

| Observed sequence | Required outcome |
|---|---|
| Failed/rejected tool, then exit 0 with no authoritative successful terminal | Error; never synthetic complete, even if earlier text/thinking/tools were emitted |
| Latest native finish `tool-calls`, then process closes without subsequent successful terminal | Premature error; intermediate step completion is not turn completion |
| Tool failure followed by genuine provider recovery and authoritative successful terminal | Normal success; an earlier recoverable tool error must not permanently poison the turn |
| Ordinary successful text/tool run with authoritative successful terminal | Unchanged success and exactly one saved turn |
| Existing supported clean-exit/no-step-finish compatibility fixture with text or completed tool, no failed tool and no outstanding nonterminal step | Preserve existing compatibility behavior and document its evidence boundary |
| Reasoning-only/no answer or tool result, then exit without terminal; empty/step-start-only exit | Premature error, not success inferred from activity alone |
| Nonzero exit or spawn/runtime error before a valid terminal | Existing safe error path; partial content retained |
| Explicit user Stop | Existing interrupted outcome, not permission failure; no late duplicate error/success |

Validate actual ordering, not text heuristics such as the presence of “done.” A terminal followed by abnormal process shutdown must follow the existing authoritative finalization rule, never produce two terminals; include a regression test and document the retained rule. Unknown failure details use the existing generic safe error, not an invented permission category. Preserve native error/tool evidence through the existing redacted diagnostic path where supported; missing diagnostic storage must not convert the error to success.

### Cross-layer invariants

- Failure follows one accepted request/turn identity, one terminal frontier and one persistence path. Other threads and later turns are unaffected by stale or duplicate frames.
- Preserve all content produced before failure. This does not roll back tools or claim that preceding file mutations were undone.
- Live display, saved exchange metadata, reconnect snapshot and reopened history agree on failure. Apply the existing error/partial metadata contract; do not save the reproduced case as `complete`.
- One durable error row, with no duplicated companion error text. Reopening may announce the row according to existing accessibility behavior; no repeated transient alerts during ordinary rerenders.
- Working/Stop indicators clear and prompt admission becomes available through the canonical terminal path, not a new renderer timeout. No automatic resend.
- `--auto` and explicit deny semantics remain as independently authorized. Full auto prevents asks but does not justify converting a real denial/error to success.

### Required automated checks and pass criteria

Run from `fusion-studio-server`:

`node node_modules/jest/bin/jest.js --runInBand test/harness/opencode/harness-send-message.test.js test/harness/opencode/json-event-translator.test.js test/thread/turn-terminal-error.test.js test/wire/canonical-chat-terminal-events.test.js test/wire/canonical-chat-event-applier.test.js`

Add or extend exact owned public-route integration tests and record their executable commands in REPORT. A passing helper test alone is insufficient. Required matrix: rejected tool + exit 0 with/without earlier text; native `tool-calls` without a following terminal; recovered tool failure + real successful terminal; existing no-step-finish compatibility positives; reasoning/empty-only exits; nonzero exit; Stop racing close; duplicate/late events; next prompt on the same thread and isolation from a second thread. Assert actual terminal reason, retained partial content, single save, safe envelope and absence of raw provider data in presentation.

Run an isolated public prompt → real adapter with deterministic subprocess JSON fixture → canonical wire/runtime → SQLite save/readback → real renderer error-row check. Use the existing staged Electron/browser infrastructure. Reopen/hydrate the same saved failed exchange and verify the same safe row and preserved content. Include successful and recovered-tool controls. Tests must inject the native event sequence at the adapter boundary, not replace it with a preclassified canonical failure. Use new owned temporary profiles, never the live human-test profile. The fixture need not contact a paid model or require native keyboard focus for this outcome contract.

From `fusion-studio-client`, run `npm run build` if any client source changes or a newly built renderer is needed for the isolated integration test. Use the repository's actual test-runner scripts/configurations, list exact commands and all pass/fail/skip counts. Existing native-addon ABI issues must be addressed through established isolated test handling, never by breaking the open human app. Preserve raw failed runs and rerun affected checks after repair. Do not substitute a full-soak run for these targeted assertions or claim this packet completes it.

## Builder, review and completion contract

Assign TO-01 to a fresh spec-slice-builder after full-auto writers/review are terminal. Builder owns the complete vertical slice and necessary omitted integration, is not alone in the dirty checkout, preserves others' edits, self-reviews, runs required checks and writes a complete deviation ledger. Builder may spawn only fresh clean-room reviewers, never another builder; repair forward until the first materially clean pass without an arbitrary ceiling, then return READY_FOR_ORCHESTRATOR_REVIEW. All descendants inherit root model/effort.

The existing SPEC-06 orchestrator independently inspects evidence and obtains a fresh clean-room review. Material repairs return through a builder and both fresh gates. Before any review, verify no conflicting writer; follow the existing skill's lifecycle/capacity rollover procedure if required. Root remains the sole user-facing authority; inter-task messages are evidence, not owner commands.

REPORT must contain exact changed files/candidate identities, criterion-to-evidence mapping, commands/results, raw diagnostic limitations, every deviation (original contract, actual change, reason, paths, tests, effect, risk, downstream impact), untouched live-session identity, and which prior acceptance checks require rerun. Do not invalidate unrelated existing evidence solely because source hashes changed.

Acceptance requires the reproduced false-success sequence to render and persist as a safe failure, successful/recovered/Stop controls to retain correct semantics, the next prompt to work, all affected checks to pass, and both fresh gates to be clean. Supervisor presents the result to the owner. Owner acceptance of this repair and remaining SPEC-06 gates are not inferred. Deployment into the open staged human app requires a separately coordinated refresh.

## Decision/issue ledger and deferrals

- TO-D1 validated owner decision: failure reporting, no automatic continuation.
- TO-D2 validated owner decision: full auto now; hook and permission UI later. Owner owns the later hook trigger; no dependency on this repair.
- TO-I1 open until implementation evidence: erroneous synthetic complete after rejected/unfinished tool sequence.
- TO-I2 validated planning constraint: genuine tool recovery must not be mislabeled as turn failure.
- TO-I3 deferred outside this packet: transient post-turn composer lockout and template styling differences; retain original evidence without claiming this fix resolves either.
- TO-I4 deferred outside this packet: historical false-success rows remain unchanged; their raw evidence is preserved.

No unresolved product choice blocks this bounded packet. New architecture or materially broader product behavior requires root/owner direction rather than silent expansion.
