# Owner-directed OpenCode auto mode

Frozen source-ready packet; running human app is untouched. No service migration, permission UI, approval hook, global policy/config change or adjacent completion repair.

## Authority and behavior

Owner explicitly superseded the prior no-auto feasibility direction: “Open Code runs in full auto... hook later” and “Just set the auto for now.” Production buildRunArgs now begins `['run','--auto','--format','json']`. This unconditional adapter policy covers every new, warm-resumed and cold-resumed turn. Existing dir/model/variant/thinking/pure/session/prompt order and values remain unchanged. Stop/retirement/parser/translator/environment paths are untouched; the separately accepted OPENCODE_DISABLE_CLAUDE_CODE=1 policy remains intact. Other harness adapters and owner configuration files are unchanged.

Exact OpenCode1.18.32 source supports the meaning: [run.ts801–819](https://github.com/anomalyco/opencode/blob/v1.18.32/packages/opencode/src/cli/cmd/run.ts#L801) responds once to permission.asked when auto is true; [permission/index.ts72–100](https://github.com/anomalyco/opencode/blob/v1.18.32/packages/opencode/src/permission/index.ts#L72) returns DeniedError for explicit deny before creating/publishing a pending ask. Thus auto permits ask requests without a Fusion dialog; it does not override explicit deny, install an always rule, or implement a future approval hook. Source snapshots/hashes are preserved in sibling PERMISSION-FEASIBILITY/packages and sources.json. No actual permission-triggering/model test was run or claimed for this patch; root explicitly confirmed source review is sufficient for this bounded flag change.

## Exact delta and identity

Two changed paths, complete predecessor snapshots in before/:

- fusion-studio-server/lib/harness/opencode/index.js: one argv initializer line adds --auto.
- fusion-studio-server/test/harness/opencode/harness-send-message.test.js: exact spawned argv expectations and one test title reflect auto for new/resumed/configured turns.

source.json1964entries SHA256559e477742fd8436d7fc702786aefd465166b07fdd0b9eb37e5e251d8f5ee844. build.json200entries unchanged SHA256b070d633863382e48ea2f6d677a92cfe65b9a4dea79caa87975711c109c70b03. delta.json is exactly those two paths against CLAUDE-COMPAT source. identity.json contains exact before/after hashes. No current running stage bytes changed.

## Checks and self-review

From fusion-studio-server:

`node node_modules/jest/bin/jest.js --runInBand test/harness/opencode/harness-send-message.test.js`

red-02.log:13fail/39pass/52total,0.888s, before production change. Failures directly show missing --auto on new/resumed/model/variant/thinking/pure argv. Earlier red.log is a retained setup error from an explicitly named nonexistent jest.config.js path; no test ran in that attempt. Corrected by running existing Jest from server cwd without config override.

`node node_modules/jest/bin/jest.js --runInBand test/harness/child-environment.test.js test/harness/child-environment-inventory.test.js test/harness/opencode/harness-send-message.test.js`

green.log:3suites/117tests PASS,0skip,1.427s. Actual mocked spawn boundary covers first prompt, persisted/next-turn --session continuity, workspace capture, per-thread model/variant, thinking/pure, captured policy environment, stopped-turn/retirement/error behavior; family credential/authority isolation and AST launch inventory remain green. Existing warning: --localstorage-file provided without a valid path. Direct focused Jest avoids unrelated native pretest rebuild while human session is open; no full npm-test/native-pretest claim.

Self-review compared exact two-file delta and production sole buildRunArgs→spawn owner. No fallback argv path bypasses the initializer for message turns. No permission config, auto-disable override, persisted always permission, other-harness argv, secret or Stop change introduced. Client build/full suite/soak/provider run skipped as outside this server-only one-line dependency surface and explicit runtime restriction. Full06B and misleading completion remain separately unresolved.

## Eight-field deviation (proposed accepted owner-directed integration)

1. Original authority: earlier feasibility sought pending-tool approval with no --auto; current explicit owner quotes above supersede that product direction for now.
2. Actual: unconditional supported --auto on Fusion OpenCode run commands.
3. Reason: owner requests autonomous execution now, with approval hook deferred rather than service/UI migration.
4. Files: exact two adapter/test paths and bounded OPENCODE-AUTO evidence.
5. Tests: red13missing-flag failures, green117focused tests, pinned upstream deny-before-ask/auto-once semantics.
6. Observable effect: new/resumed OpenCode ask requests auto-approve once; explicit denies still reject. No user approval UI is promised.
7. Risk/limits: model-requested tools requiring ask may now execute automatically under owner-authorized policy; explicit deny and actual provider/tool errors can still produce the separately unresolved misleading-completion symptom. No persistent allowlist or global permission bypass. Native/runtime flag effect is source-supported, not newly executed inference proof.
8. Downstream: updated server code must be loaded before new/resumed provider launches use flag. Current staged human app remains old for auto mode; no restart authorized in this implementation task. Future approval hook is separate work; no06C/full06B acceptance follows.

## Activation requirement and review

A newly staged/restarted Fusion server loaded from these current bytes is required; changing checkout alone does not update the live copied stage or module cache. Thereafter the next new or resumed OpenCode invocation gets --auto. Unlike already loaded instruction text, this argv flag does not inherently require discarding prior conversation history. It cannot retroactively approve/revive the already rejected tool or completed turn; do not silently resend it. Restart/provider interaction awaits separate owner runtime direction.

Fresh builder-owned review pending at freeze; current human driver68194/Electron68197, profile and recording remain untouched. Root owns final classification/acceptance.

### Builder gate terminal: CLEAN

Fresh `/root/builder06b/review06b_auto1` returned CLEAN/no material findings or repairs. Verified exact two-file delta/hashes, actual sole argv→spawn route,13expected red failures/117green tests, pinned explicit-deny and auto-once semantics, owner authority/eight-field deviation/activation limits. Read-only/no tests/builds/provider/UI/runtime actions/descendants. Terminal lifecycle recorded; close_agent unavailable. Stop after first materially clean pass. READY_FOR_ORCHESTRATOR_REVIEW for this bounded owner-directed follow-up only.
