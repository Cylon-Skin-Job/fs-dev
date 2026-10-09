# TO-01 — ready for supervisor review

The owner-authorized premature-turn outcome repair is implemented and accepted at the orchestrator gate. When OpenCode exits after a failed or unfinished tool, an intermediate tool-calls finish, or reasoning-only/empty activity without a valid final response, Fusion now records an error instead of manufacturing successful completion. Existing partial text and tool history remain visible and saved with the fixed safe “Response failed” row, including after reopening the chat.

Normal success, genuine recovery after a tool failure, supported clean-exit compatibility, Stop, subsequent prompts and separate-chat isolation retain their required behavior. The existing first authoritative terminal remains final even if the process later exits abnormally. The repair does not resume operations or assess whether an answer semantically solved the task.

## Exact scope and identity

Eight changed paths: three OpenCode adapter product files, one adapter boundary test, and four owned integration fixture files. The new helper is copied with the server; there are no client product, schema or configuration changes. Full --auto and Claude-import disabling remain intact. REPORT.md contains the complete file list and criterion mapping; delta.json and before/ retain exact provenance.

Source: 1,968 files, manifest SHA256 2bedc37c0dd1b4373df5f90d2dbcde2e74059521f14b6346525ab7596d94ecc7.
Unchanged renderer build: 200 files, manifest SHA256 b070d633863382e48ea2f6d677a92cfe65b9a4dea79caa87975711c109c70b03.
Root independently verified every entry, the eight-path delta from the accepted auto candidate, and all four modified-file predecessor copies. See ROOT-IDENTITY-INSPECTION.json.

## Verification and review

Builder and root each passed:

- 292 focused tests across seven suites, including the native JSON adapter matrix and diagnostic redaction.
- Five existing public-route regression tests.
- 16 fixture ownership/lifecycle tests.
- All 16 public sends in the isolated native-JSON Electron integration: actual production adapter, authenticated prompt route, canonical runtime/wire, SQLite save/readback and real renderer live/reopened error rows.

Builder integration: chat-arch-1790498243763-d99a2c1549, 28.974 seconds.
Root integration: chat-arch-1790498299924-f332d1cd8c, 32.897 seconds.
Both runs exited successfully with no owned process leaks, SQLite quick-check success, and temporary profile/workspace/stage/port removal. Raw runs remain under evidence/spec-01/01B/. Root Stop observation found the exact native child absent within a recorded 475 ms upper bound before cleanup; this is one fixture result, not a general timing guarantee. No paid model or real permission-grant replay was used.

Fresh builder reviewer /root/builder_to01/review_to01_1 and fresh orchestrator reviewer /root/review_to01 both returned CLEAN with no material findings or additional deviations. Both are terminal and read-only. Gates stopped at their first clean pass; close_agent is unavailable and lifecycle is recorded. Root reviewer also visually inspected the successful root-run live and hydrated screenshots and checked receipt/terminal/save correlation. No implementation changes followed either review.

Early failed fixture attempts remain retained and explained in REPORT.md. They establish oracle, selection, readback and cleanup repairs; they are not presented as passing end-to-end evidence. Independent inspection also removed premature diagnostic truncation and preserved null-JSON tolerance before the final gates.

## Classified integration and downstream effect

D1 (adapter evidence helper) and D2 (redacted diagnostic fallback) are accepted necessary adapter integration, grouped as TO-INT1. D3 (actual-adapter isolated fixture) is accepted necessary verification integration, TO-INT2. D4 (targeted checks and unchanged renderer reuse) is accepted as contract-compliant verification scope. All eight required deviation fields and explicit classifications are in ROOT-INSPECTION.md and REPORT.md. No standards exception or temporary production bypass was introduced.

Downstream assessment: compatible deviation. Later documentation should describe the narrowed clean-exit compatibility rule and existing first-terminal rule. Rerun this focused outcome lane when its adapter/fixture dependencies change. Unrelated historical rendering/native evidence is not invalidated solely because the source manifest changed. Full SPEC-06/06B, numerical soak, explicit owner acceptance and 06C remain pending.

## Activation and remaining limits

The live human session human-1790494814495-ca038557 remains untouched: driver 68194, Electron 68197, existing profile, project, transcript and copied server stage preserved. Root's post-test process readback confirmed those exact human processes remain and the owned integration processes are gone.

Activation requires a separately coordinated refresh that loads the updated server directory, including turn-outcome.js. The existing renderer build can be reused. New or resumed sends then use both --auto and this outcome fix; a fresh profile or chat is not inherently required. Already saved false-success rows remain unchanged, and rejected operations are never silently replayed. No runtime refresh is authorized or performed by this handoff.

Hooks, approval UI, automatic continuation, styling, transient composer lockout, historical backfill, Alpha and Git publishing remain outside this repair. Full server/native pretest, renderer rebuild, numerical soak and paid-provider replay were not run; the targeted scope and unchanged build are justified above.
