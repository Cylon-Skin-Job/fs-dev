# TO-01 builder report — truthful premature-turn outcomes

Status: **READY_FOR_ORCHESTRATOR_REVIEW**. Implementation, applicable checks and first fresh builder-owned review are complete; gate **CLEAN** with no material findings or required repairs. This report does not accept full SPEC-06/06B, authorize 06C, or authorize refreshing the human app.

## Authority, baseline and exact changes

Implemented the single slice TO-01 in approved `SPEC-06B-TURN-OUTCOME.md`, candidate CHAT-AR-TO-a5ef3ffe74d7, SHA256 a5ef3ffe74d7c72bcaf0ce9f5ebb8c062adb0add2557d71621d75fa9a6f7ca11. Root dispatch confirms owner GO after full-auto review. Root/server AGENTS, mandatory roadmap dependencies, standards hub and all eight routed standards, Chat entry/harness/canonical/runtime/Stop/testing authorities, current ledger and full-auto/Claude reports were read. No separate spec-slice-builder SKILL.md exists in installed skills; the injected builder role and GUIDANCE supply that contract. `spec-review-gate/SKILL.md` was read completely; user-facing clean-room-loop was not used.

Primary development root is `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, migration head 045. `preflight.json` records the large existing dirty worktree. Owner/current bytes were preserved. Accepted predecessor OPENCODE-AUTO has 1964 source entries, digest 559e477742fd8436d7fc702786aefd465166b07fdd0b9eb37e5e251d8f5ee844. `before/` preserves every changed existing file (plus an unchanged harness test snapshot).

Current `source.json`: 1968 entries, SHA256 **2bedc37c0dd1b4373df5f90d2dbcde2e74059521f14b6346525ab7596d94ecc7**. `build.json`: 200 entries, unchanged SHA256 **b070d633863382e48ea2f6d677a92cfe65b9a4dea79caa87975711c109c70b03**. `delta.json` records these exact eight changes and their predecessor/current hashes:

| Path | Change |
|---|---|
| fusion-studio-server/lib/harness/opencode/index.js | Replaces broad useful-activity fallback with adapter outcome evidence; supplies diagnostic-only native tool detail |
| fusion-studio-server/lib/harness/opencode/turn-outcome.js | New 46-line native completion-evidence owner |
| fusion-studio-server/lib/harness/opencode/failure-marker-builder.js | Selected tool error enters the existing redactor as diagnostic message only; no classification heuristic change |
| fusion-studio-server/test/harness/opencode/turn-outcome.test.js | New native parser/adapter matrix and diagnostic bounds checks |
| fusion-studio-client/e2e/chat-architecture/electron-case-helpers.mjs | Opt-in realServer and executable path for isolated actual-adapter staging; defaults unchanged |
| fusion-studio-client/e2e/chat-architecture/run.mjs | Explicit TO-01 case, source identities and truthful workload declaration |
| fusion-studio-client/e2e/chat-architecture/turn-outcome-native.cjs | Deterministic native JSON subprocess, no canonical failure injection/model call |
| fusion-studio-client/e2e/chat-architecture/turn-outcome-electron.mjs | Authenticated public composer→real adapter→runtime→SQLite→actual renderer/readback matrix |

All additional builder artifacts stay under TURN-OUTCOME; runner raw artifacts use its established `evidence/spec-01/01B/chat-arch-*` location. Planning MANIFEST/PLANNING-REVIEW and supervisor ledgers are not edited. No client production, schema, permission, global config, historical exchange, human-test content or Alpha change.

## Implementation and retained rules

Native failed tool status (including `status:error` with `metadata.exit:0`), nonzero tool exit, unresolved tool call, or outstanding native `tool-calls` finish forbids synthetic completion. Reasoning/step-start/empty text alone cannot qualify. Text or completed tools with no failure/nonterminal evidence retain the existing no-step-finish compatibility behavior. This is a protocol compatibility boundary, not an assessment of whether the requested task was solved.

A translated authoritative terminal still wins over earlier recoverable tool failure. Native successful terminal followed by nonzero process shutdown retains the existing rule: the iterator may throw its process marker, but the already-terminal canonical drain prevents another terminal/save or reclassification. Duplicate terminal and late text similarly cannot append to the closed turn. Stop remains owned by existing runtime/retirement code and yields interrupted partial history, without adapter-created failure.

The marker maps through existing runtime-dispatch, canonical terminal owner, SQLite HistoryFile path, safe envelope validation, live finalization/history hydration and MessageList→ChatTurnError. No alternate terminal, timer, persistence writer or frontend provider logic was added. Existing redactor receives the full selected native tool error before its bounds; provider text never selects a new permission category or gets interpolated into the catalog. Only the most recent string `state.error` is retained as fallback diagnostic message when stderr is absent. Existing redactor first-line/message bounds and storage availability apply; arbitrary provider objects are not serialized. Diagnostic loss does not change the failure outcome.

## Criterion-to-evidence mapping

| Approved criterion | Evidence |
|---|---|
| Rejected tool, earlier text/tool, zero exit; explicit error plus exit 0 | Native unit matrix; integration `denied` and `denied-only` persist error/partial with safe HARNESS_EXITED |
| Native tool-calls or unfinished tool without final terminal | Unit cases; integration `tool-calls`, `pending` |
| Genuine recovery and normal success | Unit recovery cases; integration `recovered`, `success` retain native stop success/no error row |
| Legacy no-step-finish text/completed-tool compatibility | Existing harness tests + new matrix + integration `compat-text`, `compat-tool` preserve complete |
| Reasoning-only, empty/step-start, nonzero/spawn/runtime failure | New matrix; integration `reasoning`, `empty`, `nonzero`; existing harness spawn/runtime tests |
| Explicit Stop, exact subprocess retirement, next prompt | Integration `stop`: interrupted/partial, no late output; PID 2085 absent at 1790498265996 after request 1790498265514 (482ms observation upper bound); later A success |
| Authoritative terminal followed by abnormal exit, duplicate/late frames | Unit regression + integration `terminal-nonzero`, `duplicate`: one terminal/save, no late text |
| Identity, one acceptance/terminal/save, second-thread isolation | All 16 sends verify prompt/request/turn correspondence, one message:sent/turn_end/chat-turn:saved/exchange; exact B selection gets success/no A error and leaves A rows unchanged; return to A leaves B unchanged |
| Retained partial content/tool history and safe live/history row | Integration SQLite assistant parts + live DOM assertions, fresh-document reload/public thread open, screenshots |
| No duplicated error or raw native presentation | Exact error-row counts/title/code/message/alert role, entire panel lacks NATIVE_PRIVATE_DENIAL; wire envelope equals saved closed safe envelope |
| Controls settle through canonical path, no auto resend | Stop hidden/composer enabled, 16 actual fixture invocations/16 deliberate public prompts; no renderer timeout implementation |
| --auto and Claude disable preserved | Existing actual-spawn suite; native executable refuses missing --auto/Claude disable and logs actual invocation receipt |

Saved history/reconnect uses the same safe envelope and retained assistant parts; existing canonical terminal and applier tests pin retained snapshot agreement, sequence boundaries and stale/duplicate rejection. Reopening may mount the existing alert anew; no new alert lifecycle was introduced.

## Exact checks and runtime evidence

From `fusion-studio-server`:

```sh
node node_modules/jest/bin/jest.js --runInBand test/harness/opencode/harness-send-message.test.js test/harness/opencode/json-event-translator.test.js test/harness/opencode/turn-outcome.test.js test/harness/opencode/harness-diagnostic-redactor.test.js test/thread/turn-terminal-error.test.js test/wire/canonical-chat-terminal-events.test.js test/wire/canonical-chat-event-applier.test.js
```

`focused-final.log`: **7 suites / 292 tests PASS, 0 fail, 0 skip**, 2.213s. This includes all five SPEC-required suites plus the new outcome matrix and existing diagnostic redactor suite. Earlier focused-02: 233/6 PASS; focused-03: 292/7 PASS. focused-01 ran the five existing suites after a shell heredoc used the wrong working-directory prefix and failed to create the new test; it is not new-test evidence. That setup error was corrected before focused-02. Existing warning: Node `--localstorage-file` without a valid path.

```sh
node node_modules/jest/bin/jest.js --runInBand test/ws/prompt-canonical-route.integration.test.js
```

`public-route-regression.log`: **1 suite / 5 tests PASS, 0 fail, 0 skip**. Existing interleaved two-thread public-route/drain/Stop controls; its declared mocks do not replace the new real-adapter Electron proof.

From repository root:

```sh
node --test fusion-studio-client/e2e/chat-architecture/runner-lifecycle.test.mjs fusion-studio-client/e2e/chat-architecture/human-session.test.mjs
node fusion-studio-client/e2e/chat-architecture/run.mjs --suite backend --mode enforce --cases TO-01-NATIVE-OUTCOME
```

`fixture-checks.log`: **16 PASS, 0 fail/cancel/skip/todo**, 5.091s. Runner ownership/fault/lifetime and exact-owned cleanup tests remain green.

Final builder integration **chat-arch-1790498243763-d99a2c1549**, raw directory `evidence/spec-01/01B/chat-arch-1790498243763-d99a2c1549/`: **one case / 16 public sends PASS**, 28.974s, exit 0, no timeout/interruption/leaked PIDs, owned run root removed. `turn-outcome-result.json` retains every receipt, exchange, terminal and observed protocol frame. SQLite quick_check `ok`; profile/workspace/stage and port removed. `turn-outcome-identity.json` proves actual copied adapter source hash, executable hash, profile, ephemeral port and Electron process identity. `turn-outcome-native-invocations.ndjson` proves actual subprocess argv policy per send. Real `server.js`, authentication, router, wire/runtime, database and built production renderer were used. No native keyboard focus requirement or paid inference.

`turn-outcome-live.png` and `turn-outcome-hydrated.png` visually show retained partial text, collapsed tool history, one Response failed/HARNESS_EXITED catalog row and available composer. The builder inspected the actual screenshot rendering (same unchanged renderer/presentation); no visual redesign.

`git diff --check` on changed tracked production paths passed. Product module lengths are 383/46/131 lines, each with bounded responsibility. `node --check` passed for the new integration case. Current full source/build identities were recomputed from predecessor inventory plus all four new files.

## Preserved failed runs and repairs

No failed raw run was overwritten; `integration-01.log` through `integration-07.log` and `run-history.json` index original receipts.

1. 1790497850865-7f0979e63e: async Stop-visibility predicate negated a Promise; first saved failure existed. Fixed awaiting the visibility result.
2. 1790497896144-0212671ee9: tool-history oracle expected `tool` instead of actual canonical persisted `tool_call`; fixed oracle to the real schema.
3. 1790497935018-768c1cdf4c: 13 outcomes passed, direct Stop receipt read hit SQLite lock. Failed teardown initially observed exact fixture native PID80395; it self-exited by its 20s fixture deadline and later exact ps confirmed absent. No claim this run proved Stop retirement. Added bounded SQLITE_BUSY read retry and exact-owned cleanup escalation before deleting roots.
4. 1790498026870-9cb4fcd28a: 14 outcomes passed; New Chat persistence did not establish B selection. Raw prompt shows A received the intended B control; no peer isolation credit. Added exact rendered thread identity wait.
5. 1790498104305-33a622729d: exact identity wait correctly refused the unselected B before wrong send. Explicit public B rail selection added.
6. 1790498167176-45a282de59: 13 outcomes passed; Stop readback again hit SQLite lock during retirement. Moved exact native-child-absent and existing composer-release assertions before Stop readback; retries remain read-only, SQLITE_BUSY-only, 50ms intervals/5s bound, with all other errors propagated. No product lock fix or cause attribution claimed.
7. 1790498243763-d99a2c1549: all16 PASS on frozen current bytes. Exact Stop retirement is proven before fixture cleanup and separately from any cleanup signal.

Self-review corrected a pre-redaction truncation risk before final checks: selected native error now reaches the existing redactor in full. A secret spanning the actual 4096-byte message boundary is removed before bounds. Null JSON remains ignored consistently with translator behavior. Root's independent in-progress observations helped pin these cases; they do not substitute for the required fresh reviewer.

## Deviation ledger — proposals only

Each record carries all eight required fields. Orchestrator classification remains authoritative.

**D1 — bounded adapter evidence helper; proposed accepted.** (1) Original: prefer narrow adapter fix, expected paths advisory. (2) Actual: new turn-outcome.js owns native fallback evidence. (3) Reason: keep index below400 lines and separate evidence from spawn/iteration. (4) Paths: index.js/turn-outcome.js and new unit test. (5) Tests:292 focused plus16 real sends. (6) Effect: incomplete native output fails truthfully; successful/recovered/compatibility paths retained. (7) Risk: fallback remains protocol compatibility, not semantic task completion. (8) Downstream: current server must be loaded; provider-specific details remain below adapter; later 06C documentation should describe narrowed compatibility boundary.

**D2 — diagnostic fallback message; proposed accepted.** (1) Original: preserve native error evidence through existing redacted diagnostics where supported. (2) Actual: failure marker accepts selected nativeDetail only when stderr absent. (3) Reason: OpenCode rejection is in state.error, which existing tool snapshot presentation omits. (4) Paths: outcome helper, index, failure-marker-builder, unit test. (5) Tests: diagnostic boundary/bounds and full redactor suite; real saved safe diagnosticId/wire/UI. (6) Effect: fixed safe catalog is unchanged; existing explicit diagnostic lookup can retain selected redacted detail. (7) Risk: first-line/bounded/latest-string detail only; diagnostic failure still loses detail safely. (8) Downstream: no catalog/schema/renderer change, no inferred human rejection or permission category.

**D3 — actual-adapter isolated fixture; proposed accepted.** (1) Original: native subprocess→public route→SQLite→real renderer required; staged default replaces adapter. (2) Actual: helper opt-in realServer/openCodePath, runner explicit case, new native executable and integration script. (3) Reason: execute unchanged production adapter without paid inference, keeping real auth/runtime/persistence/renderer. (4) Paths: four E2E files and bounded evidence directories. (5) Tests:16 fixture tests, final16 sends; raw failed oracle/setup/readback/cleanup receipts retained. (6) Effect: native protocol classification is exercised rather than injected canonically; default fixture behavior unchanged. (7) Risk: deterministic native grammar coverage is not a real-provider/model soak; ephemeral read locks bounded/reported. (8) Downstream: repeat exact registered TO-01 command for changed adapter/outcome fixture dependencies; no performance-credit claim.

**D4 — check selection/reused renderer; proposed accepted/downstream impact.** (1) Original: client build required if source changes or newly built renderer needed. (2) Actual: reused exact accepted200-entry renderer build; direct focused Jest avoids unrelated native rebuild. (3) Reason: no renderer source changed, existing Node/native deps and isolated Electron stage work; live human runtime must stay intact. (4) Paths: evidence only; no dependency/build mutation. (5) Tests:292focused,5route,16fixture,16native sends,200build hashes. (6) Effect: targeted proof includes current real renderer; no full-suite/performance claim. (7) Risk: broad full-server/soak/owner symptom gates remain outside TO-01. (8) Downstream: no invalidation of unrelated VRENDER04/accepted06A/05 evidence merely from hashes; adapter outcomes and this integration must rerun for relevant future edits. Full06B/06C gates remain pending.

## Runtime boundaries, skipped checks and residual risks

Untouched human session: `human-1790494814495-ca038557`, driver68194/Electron68197, port64841, retained temp root `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/human-1790494814495-ca038557-SYwgRn`, including its profile/workspace/stage. Only session evidence and exact process identities were read; no human-window input, prompt, attachment, restart, cache clear, copied-stage change or profile/DB edit. `untouched-human-and-cleanup.json` records this boundary and PID80395 absence. No global config, Alpha, Git publication, historical false-success rewrite, service migration, permission/hook/UI or automatic resend/resume.

Activation requires a separately coordinated refresh/staging of a server loaded from these current bytes; the already-open copied human server remains unchanged. The next fresh or resumed provider invocation then receives the fix. Earlier false-success rows stay unchanged. This repair does not resume the denied operation or undo tool effects.

Skipped: renderer build (unchanged verified build reused), full npm test/native pretest (not required for this bounded adapter lane; direct focused tests and isolated actual server used), full V-ALL/V-RENDER/V-SOAK, native/IME and owner symptom/manual acceptance, real paid provider replay, Alpha/release. These are not waived or counted as complete. Transient post-turn lockout, template styling and full06B/06C remain outside scope. No standards exception or temporary production bypass was introduced.

## Builder review lifecycle

No child reviewer existed before this builder's first pass; the builder subtree inventory confirmed that before spawn. Fresh read-only clean-room-reviewer `/root/builder_to01/review_to01_1` received no inherited parent conversation, the current packet/evidence/standards and raw deviations, without prior reviewer conclusions or model/effort override.

Pass 1 terminal result: **CLEAN**, no material findings, required repairs, additional deviations or invalidated evidence. The reviewer independently verified all eight delta hashes, all 1968 source entries and all 200 build entries against current files; inspected adapter parsing/translation/classification, redaction, canonical terminal ownership, persistence/snapshots and renderer consumption; audited the 292 focused, 5 public-route and 16 fixture checks; inspected both successful 16-send native integration receipts, hydrated screenshot and preserved failed runs. D1–D4 remain proposals for the orchestrator's authoritative classification. Deterministic-provider and human-activation limits remain unchanged.

Lifecycle: reviewer final response and subsequent `list_agents` both recorded terminal/completed status. `close_agent` is absent from the exposed collaboration API and a fresh tool inventory search returned no match, so closure could not be attempted; this is recorded unavailability, not an active reviewer or blocker. The reviewer reported no mutations, launches, builds, provider calls, native interaction or descendants. No product/fixture bytes changed during or after review. Review stopped at this first materially clean pass; only this evidence receipt was finalized afterward.
