# Fusion-launched OpenCode Claude compatibility policy

Implementation frozen for fresh builder review. This bounded owner-requested follow-up does not accept full SPEC06/06B or authorize restarting the human session.

## Authority and result

The owner explicitly requested durable narrow disabling of Claude compatibility for Fusion-launched OpenCode, preserving legitimate OpenCode settings/skills, credentials, other harnesses and the running human session. The existing server-owned child-environment builder is the correct owner. It now forces `OPENCODE_DISABLE_CLAUDE_CODE=1` only for `opencode`, after the closed allowlist and override selection. Caller/host false/empty values cannot re-enable fallback discovery. No global shell setting, home file, permission, provider argument, `--auto`, or dependency changed.

Exact installed OpenCode is1.18.32; binary hash/path are in identity.json. The current official rules page advertises the flag: https://opencode.ai/docs/rules/#claude-code-compatibility . Its absence from packages/core/src/flag/flag.ts is not absence of support: the version-pinned packages/opencode/src/effect/runtime-flags.ts maps it to disableClaudeCodePrompt/disableClaudeCodeSkills. Version-pinned skill/index.ts removes only .claude from external scan while retaining .agents, native config directories, explicit paths and built-in skill. session/instruction.ts excludes global ~/.claude/CLAUDE.md and project CLAUDE.md while preserving AGENTS.md/native rules. Full upstream sources, URLs and hashes are retained in upstream/ and upstream.json. Explicitly configured custom paths are not rewritten or prohibited; this disables implicit compatibility, not a filesystem security boundary.

## Changed paths and identity

- fusion-studio-server/lib/harness/child-environment.js: enforced OpenCode-only child policy.
- fusion-studio-server/test/harness/child-environment.test.js: default/override resistance, native config/credential preservation, no other-family policy leakage.
- fusion-studio-server/test/harness/opencode/harness-send-message.test.js: actual adapter spawn receives policy.

Exact predecessor bytes are in before/. delta.json identifies exactly these three changes from the HUMAN candidate. source.json has1964 entries SHA256 fce657085b6658dac3de5ea828a3afc6e0829281f32239d2989771f9ad2b3686. build.json has200 unchanged entries SHA256 b070d633863382e48ea2f6d677a92cfe65b9a4dea79caa87975711c109c70b03. No renderer build or running staged source was changed.

## Acceptance mapping and checks

From fusion-studio-server:

`node node_modules/jest/bin/jest.js --runInBand test/harness/child-environment.test.js test/harness/child-environment-inventory.test.js test/harness/opencode/harness-send-message.test.js`

Final focused-tests-final.log:3suites/117tests passed,0skip,1.388s. Tests exercise central-family credential/authority isolation, actual child spawn, default/false/empty override resistance, all other harness families, and AST inventory of every production child-launch owner. Initial focused-tests.log passed117 before the explicit spawn assertion was added. Existing Node warning: --localstorage-file was provided without a valid path. Direct focused Jest deliberately avoids an unrelated native-addon rebuild while the human session remains open; this is not an npm-test/native-pretest/full-server claim.

From repository root:

`node ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/spec-06/06B/CLAUDE-COMPAT/discovery-smoke.cjs`

Installed binary, no model request: actual `opencode debug skill` fresh processes using predecessor versus current production environment builder. discovery-result.json passes all4runs:

- Isolated home/project baseline7skills: builtin plus global/project .claude, .agents and native OpenCode sentinels.
- Current5skills: only both .claude sentinels removed; both .agents and both native sentinels plus builtin retained.
- Actual production child environment baseline32skills; current7skills. Every non-Claude name/location retained; zero .claude location remains.
- Marked disposable root removed; no personal skills/configuration modified. No credentials, raw skill content, env dump or stderr content retained; receipts contain only skill names/locations and status/counts. Temporary raw stdout is0600 and removed with the marked root.

First discovery attempt is retained as discovery-result-01-failed.json: isolated comparison passed, but large actual-home stdout through a pipe produced truncated JSON despite exit0. Evidence collection switched only its stdout destination to a regular owned file descriptor; the subsequent complete parse/discovery passed. This is not claimed as a product defect or fixed OpenCode CLI bug.

Self-review: verified flag support at the exact tagged runtime consumer, native/.agents scan retention, instruction fallback behavior, post-override enforcement, unchanged secret allowlist, actual production spawn callsite, and snapshot/delta accuracy. No product failure was suppressed. No live UI/typing/provider prompt/restart occurred for this follow-up.

## Deviation record (proposed accepted bounded integration)

1. Original authority: SPEC06/06B validation plus new explicit owner request to prevent Fusion OpenCode implicitly consuming Claude compatibility; original slice did not prescribe this policy.
2. Actual: force supported OpenCode-only child flag and add focused boundary tests/discovery evidence.
3. Reason: current central allowlist drops the host variable; owner requires durable application policy rather than shell workaround.
4. Files: three exact source/test paths above; bounded CLAUDE-COMPAT evidence directory.
5. Tests/evidence:117focused tests, actual adapter spawn assertion,4real discovery runs, version-pinned source and executable identity.
6. Observable effect: fresh Fusion-launched OpenCode excludes implicit .claude skills/CLAUDE.md while .agents/native skills/config/credentials remain available; other harness families unchanged.
7. Risk/limits: explicitly configured paths and already loaded transcript content are not erased; future OpenCode versions must retain documented flag semantics. No actual prompt-instruction inspection/model run was added; prompt exclusion is verified in exact-version source. No adjacent completion defect addressed.
8. Downstream: a server loaded from changed bytes and a fresh OpenCode conversation are needed. Full06B remains incomplete; no06C. Existing VRENDER04 remains valid for unchanged renderer/typing dependency surface, not proof of the new real-provider policy.

## Runtime refresh and residual scope

The live human driver64110/Electron64115 uses a copied server stage and continues recording untouched. A new chat inside that old stage alone will not apply this source change. After owner finishes, a newly staged/restarted development server using current bytes is required, followed by a genuinely new thread/provider session; a resumed provider transcript may already contain Claude skill text. Do not restart now, silently transplant source into the stage, or erase any transcript. Together credentials/config are unmodified; no new model request was needed for discovery.

No temporary production adapter introduced. Human-session cleanup ownership and retained logs remain as documented in HUMAN-SESSION-REPORT.md. No automated soak/rebuild/native UI/release was run for this narrow change.

## Fresh review

Builder-owned fresh clean-room review pending at packet creation. Lifecycle/result will be appended; root owns acceptance classification.

### Builder gate terminal

Fresh `/root/builder06b/review06b_claude1` returned CLEAN, no material findings/repairs required. Independently checked1964source/200build/threepredecessors+delta, actual spawn/envsnapshot integration, pinned1.18.32 runtime consumers,117test receipts, allfour discovery runs and preserved first collection failure. Read-only, no tests/edits/process/UI actions or descendants. All prior children were terminal/non-conflicting before dispatch; close_agent is unavailable (tool inventory confirmed), recorded as lifecycle evidence only. Stop at this first materially clean pass. READY_FOR_ORCHESTRATOR_REVIEW for this bounded policy follow-up only; full06B remains incomplete and human app intentionally stays open.
