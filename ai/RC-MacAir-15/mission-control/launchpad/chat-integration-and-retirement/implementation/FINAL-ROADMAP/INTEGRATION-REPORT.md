# CHAT-SIMPLE-ROADMAP-001 final integration evidence

## Candidate and accepted inputs

The approved candidate is `sha256:cf93d5d2b63073ccc16ca432bf8fab9fe8f4284fb3c1320b457d2ed8b7a34a54`. SPEC-01, SPEC-02 and SPEC-03 each have a terminal orchestrator, clean SPEC review and explicit owner acceptance in their respective `implementation/SPEC-xx/` folders. The final [fingerprint manifest](FINGERPRINTS.json) checks seven unchanged normative artifacts, 64 distinct current source/doc/test paths including the separately authorized V8 repair, and 130 generated client outputs. Thirteen overlaps were superseded by an accepted later SPEC; none drifted from its latest accepted hash. Product checkout: `/Users/rccurtrightjr./projects/fs-dev`, dirty `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`.

## Final integrated checks

All commands below ran on the current integrated checkout on 2026-09-29 UTC with Node `v25.6.1`, npm `11.9.0` and installed checkout dependencies. Browser checks used `playwright.chat-architecture.config.ts`, its test-owned port 43177 and `reuseExistingServer:false`. The native smoke used disposable profile/workspaces. No live app, Alpha installation or owner DB was intentionally operated.

| Gate | Current integrated result |
| --- | --- |
| V1 client `npm run build` | Passed, 1957 Vite modules; existing eval, mixed static/dynamic import and large-chunk warnings. Generated output hashes match the manifest. |
| V2 server public ingress | Five suites, 103 tests passed. |
| V3 client lifecycle/response | 85 isolated browser tests passed. |
| V4 server owner integration | Six suites, 83 tests passed. |
| V5 public parity | Required assertions are embedded in V3/V6 and the isolated native smoke; accepted SPEC packets document Main/Side exact routing, ACK-owned bubble, history/stop/wait checks. No separate V5 command exists. |
| V6 unified sends | 91 isolated browser tests passed. |
| V7 receipt recovery | 61 isolated browser tests passed; server receipt plus V9 server set: eight suites, 69 tests passed. |
| V8 full server `npx jest --runInBand --silent` | **Passed after the separately authorized narrow repair:** 218/218 suites, 3,248 tests passed, one skipped. The prior single failure was the OpenCode child-environment AST inventory assertion. |
| V9 Electron tests | Ten passed. |
| V9 native `node e2e/trusted-shell-auth-smoke.mjs` | The initial final run timed out waiting for disposable public New Chat during C3 setup; a clean retry passed. After the V8 repair, another isolated run passed `TRUSTED_SHELL_AUTH_SMOKE_OK`, covering authenticated Electron, C2 public sends/actions and C3 receipt fault cases. The initial timeout remains a transient evidence limit; its cause was not established. |
| Static retirement | Reviewed remaining raw `.send`/`sendFusionMessage` and thread/diagnostic matches. Chat product sends use `sendChatProduct`; remaining raw sends are non-chat surfaces, the physical ws-client lane or protocol definitions. The `TEMP CHAT-AR I-007` delete/migrate marker and `temp_chat_boundary_v1` sink remain. A scoped `git diff --check` found one unrelated pre-existing trailing blank line in `e2e/office/fixture-lifecycle.test.mjs`. |

The original V8 failure matched the SPEC-01 pre-implementation dirty baseline and was reproduced in SPEC-02/03 and the first final run. On separate owner authorization, a fresh worker changed only `fusion-studio-server/lib/harness/opencode/index.js`: the run spawn now calls the same central environment builder directly in its inline `env` option. The inventory test and builder were unchanged. The diagnostic snapshot and error-stage reporting remain. [Builder evidence](V8-REPAIR-BUILDER.md) and [fresh independent review](V8-REPAIR-REVIEW.md) record the cause, code impact, focused checks and CLEAN verdict. Full V8 now passes on current bytes. This was a narrow verification-gate repair outside the three CHAT-SIMPLE slices; it does not change their accepted product contract or reopen the deferred broad OpenCode failure map.

| Out-of-scope repair accounting | Disposition |
| --- | --- |
| Original requirement and reason | V8 requires the full server suite; the earlier unrelated OpenCode launch used a prepared environment variable that the security inventory could not verify. The owner separately authorized repair of this one completion-gate failure. |
| Actual change and file | `fusion-studio-server/lib/harness/opencode/index.js` now invokes the existing central builder directly inside the run `spawn` options with the same family and override. No inventory assertion, allowlist, schema, provider policy or external API changed. |
| Checks and observable effect | Focused 9 suites/322 tests, independent five suites/204 tests, full V8 218 suites/3,248 passing tests and post-repair native smoke passed. The same frozen allowlisted environment reaches the child; user-visible chat behavior is unchanged. |
| Risk and downstream impact | No real-provider session was run in this gate; focused and isolated native checks bound the evidence. The repair is classified `accepted_no_downstream_impact`: it changes neither C1–C3 contracts nor their accepted bytes. The pre-repair V8 failure is resolved, and no renewed SPEC acceptance is needed. |

## Cross-SPEC reconciliation and residuals

- C1's connection/auth owner installs the private product-send capability. C2's 13 migrated chat send families enter that capability and receive `enqueued`, `not_enqueued` or `uncertain` without claiming server acceptance. C3 consumes the same typed result for receipt inquiry; it retains unknown send gates, uses exact attempt/binding identity, and never replays prompts. V3/V4/V6/V7/V9 exercise the integrated path.
- Server receipt projection/status schema, public routes, provider dispatch ownership and migration remain at their accepted boundaries. No new schema or external consumer API was added by C3. The temporary logging marker remains for later governed observability work. Deferred D-005 failure attribution/accepted-no-exchange work and unrelated plugin consumer baselines remain deferred as the roadmap states.
- Accumulated deviations and downstream effects are recorded in each SPEC report, supervisor review and owner receipt. C1's truthful admission fed C2; C2's typed receipt result and late-reply seam fed C3. C3's 447-line cohesive recovery controller and bounded unqualified-error delay were accepted without another downstream SPEC. No current hash mismatch requires renewed SPEC acceptance.
- The prior SPEC-02 two invalid default-config browser invocations may have reached port 3001; owner-state effect remains unconfirmed. Those runs were excluded from evidence. C3 and final browser runs used the isolated config. The native uncertain-send fixture proves no replay and retained unknown state, but does not prove eventual reconnect readback in that injected throw case. First-run final native fixture timeout remains unexplained despite the clean retry.

## Review and disposition

Fresh read-only reviewer `/root/final_roadmap_review` returned **CLEAN** on the 63-source pre-repair cross-SPEC integration. It inspected C1 ingress/lifecycle, C2's SEND-01–13 callers and private send contract, C3 receipt/binding recovery, Wiki, deviations and acceptance records; and found no material CHAT-SIMPLE defect or missing integration. Fresh `/root/v8_harness_review` independently found the narrow additional OpenCode repair CLEAN and reran five focused suites (204 tests passed). Fresh post-repair roadmap reviewer `/root/final_roadmap_post_v8_review` returned **CLEAN** on all 64 current source/doc/test paths, 130 build and seven normative artifacts, inspected the updated repair/deviation accounting, and found no material blocker or need to renew accepted SPEC approvals.

Final status: **`ROADMAP_COMPLETE`**. All three SPECs are owner accepted on current bytes; required automated, isolated browser/native, full V8 and independent review gates now pass; the owner-authorized extra repair and all downstream effects are accounted for. The SPEC-02 possible port-3001 owner-state effect, native uncertain-send reconnect-readback limit, and initial disposable native setup timeout remain explicit residual evidence limits. They do not establish a current integration defect or authorize the deferred D-005/health/plugin consumer work. No Git publication, Alpha update or live app restart was performed.
