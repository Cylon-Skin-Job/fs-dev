REVIEW_COMPLETE — `initial` — **CLEAN within the assigned restart boundary**. No validated material finding remains. One advisory compatibility limitation is recorded below.

Reviewer: `/root/all_pending_initial_review/restart_boundary`; manager: `/root/all_pending_initial_review`; assigning supervisor: `/root`. Fresh independent clean-room session, read-only, inherited root model/effort, no overrides, no delegation, no product edits, no native/runtime actions, terminal on this return. The profile prohibits file edits, so this report is returned inline for the manager to preserve verbatim at `jobs/commit-supervisor/all-pending-20261008/initial-review/restart-boundary-raw.md`.

Candidate: `/private/tmp/fusion-main-consolidation-95vxg0_h/candidate`; verified Git root; HEAD/baseline `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`. Frozen identity: `/private/tmp/fusion-main-consolidation-95vxg0_h/candidate-identity-01.json`, SHA-256 `6e8487a5173edc192f8f3d112b137f1ff0b6e0f6b603ceb94036adc003281762`. Covered restart/helper/article bytes remained unchanged through final readback.

Authority and coverage: supplied owner instruction “Commit everything and make main up to date”; current `assignment.json`; outside-candidate `assembly.json`; candidate root/server/Wiki instructions; controller `session-contract.md`; complete assigned review skill, workflow and review gate; SPEC S4 criteria; full code-standards hub and Architecture Routing, Persistence And Metadata, and Testing And Smoke Slices routes. Review remained bounded to restart files, the restart article, focused restart tests, and immediate Electron/server/connection seams.

All five lenses:

| Lens | Coverage and conclusion |
|---|---|
| Behavior & Verification | Reviewed argument resolution, default/explicit/inherited profiles, preflight, build-before-stop ordering, process selection, PID drift checks, bounded termination, cache/port deletion, launch, live identity validation, connection sampling and failure receipts. Build failure precedes process stop/cache clearing. Failed verification withholds readiness and retains evidence. No material defect established. |
| Standards Compliance | Helpers have cohesive target/process/probe/coordinator responsibilities. Existing npm build, Electron main and server-spawn owners are reused. The probe observes existing shell state. No new product route or storage bypass was introduced in this boundary. |
| Integrations & Dependencies | `main.cjs:37–38,218–222`, `server-spawn.cjs:162–170,261–289`, `port-file.cjs`, `db.js:14–17`, logging ownership, and machine resolution agree with target profile/database assumptions. Local Electron and Playwright are required; unsupported identity/probe evidence refuses readiness. |
| Forward Compatibility | Considered the actual S5/S6 and integration runtime consumers. Candidate copies must include all four helpers and their selected local dependencies. No obstructed approved consumer contract was established; hypothetical future launch forms were excluded. |
| Wiki Impact | The current restart article accurately describes profile precedence, database mode, selected cleanup, local runtime ownership, two-second initialized-shell sampling, evidence locations, failure behavior, dry-run limits and Alpha exclusion. No material omission established. |

The initialized-shell claim has source support: `fusion-studio-client/src/components/App.tsx:194–196` suppresses the connected shell until workspace initialization; the probe then requires exactly one visible connected indicator, samples it eleven times over two seconds, and rechecks main/server/listener/renderer identity.

**Advisory RB-A1 — Relative package launch is unrecognized by restart ownership selection**

- Severity: `advisory`; confidence: high for selector behavior, with actual native launch reproduction excluded by assignment.
- Evidence: `fusion-studio-client/package.json:13–14` launches `electron electron/main.cjs`; installed Electron `cli.js` passes arguments unchanged. `scripts/fusion-restart-processes.mjs:48,91–94,114–116` recognizes the absolute main entry. Consequently, a relative-entry main is omitted, and its renderer triggers the ancestry refusal at line 143.
- Read-only reproduction: injected records used the selected executable, client CWD, profile, machine, absolute server child and renderer ancestry. With main command `<target.bin> electron/main.cjs`, selection returned `profile renderer has unverified ancestry: 113`. Changing only the main entry to `<target.main>` selected `[111,112,113]`.
- Observable consequence: an app launched through the package command can require manual shutdown before canonical restart.
- Materiality disposition: the refusal preserves runtime state. S4 explicitly requires rejecting unrecognized/ambiguous ownership; the supplied criteria do not establish mandatory acceptance of this launch shape. Safe relative-entry recognition or documentation clarification remains optional and does not block CLEAN.

Verification and evidence limits:

- Independently read the current 328-line focused restart test file, including CLI/profile resolution, wrong identities/listeners, disconnected shell, link refusal, failure preservation, PID reuse and OS exit-race coverage. The suite was not run by this reviewer because its disposable-process tests exceed the assigned runtime boundary.
- Historical raw S6-closeout receipts record exit 0 and empty stdout/stderr for `bash -n` and all four helper syntax checks.
- Historical `rehearsal-20261004-s6/evidence/fix-xy-runtime-raw-files/{target,verified}.json` records a different disposable candidate’s real runtime identity and connection samples. It is historical seam evidence, not current-candidate readiness.
- Current cumulative checks and later isolated runtime handoff remain owned by the root. This initial bounded result does not certify them.
- No prior reviewer conclusion was used. No current runtime readiness, publication, Alpha deployment, or owner acceptance is granted.

Reviewed file identities:

| Path | SHA-256 |
|---|---|
| `restart-fusion.sh` — mode 0755 | `b855f5d829d85b6fda20864c081c25f56f73bebc54e325e70826ec5e42622952` |
| `scripts/fusion-restart.mjs` | `c16922b21b05951dc81fa6f15296f37ace628216a231e8fb09fc41bea6abe3b4` |
| `scripts/fusion-restart-target.mjs` | `0852f2a56dd9c08b33fa8703f79ecde30494ca3e9e24967e3578699b7bd3bf2d` |
| `scripts/fusion-restart-processes.mjs` | `d2c536e6cc7219587240301a0f428266a8770fa765b79c7edf278c070be2c181` |
| `scripts/fusion-restart-probe.mjs` | `238e53a0df75a5442ead92cc83301893459ffd2e6eb87946d94816d9daac4f4e` |
| Restart article `004-Fusion_Restart/PAGE.md` | `ccf7a76b4201ce3f5a95b29816f72f85cf1506b6f94172a581c100170dd4b94e` |
| Focused `test_restart_runtime.mjs` | `9b4bb189ebff26ceaf9b899abafa75400ebbd5e9157f0a45468640d87459ad85` |

Existing S4-D1 documents the four-helper extraction and its downstream copy/dependency obligation; this review introduced no implementation deviation. The only reporting deviation is inline delivery under the read-only profile, acknowledged by the manager. No repair or investigation packet is required.
