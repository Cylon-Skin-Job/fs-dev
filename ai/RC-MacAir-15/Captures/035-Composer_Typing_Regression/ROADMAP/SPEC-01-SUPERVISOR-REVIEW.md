# SPEC-01 supervisor review

Candidate: `CHAT-AR-4641ca5897f0`. Review date: 2026-09-21 PDT. State: `accepted`. The owner replied “Accepted” to the full SPEC-01 supervisor checkpoint on 2026-09-21 at approximately 05:10 PDT. That receipt authorizes the next dependency-ordered SPEC; it does not waive recorded product-red or future gates.

## Contract and result

SPEC-01 was to reproduce chat/composer failures through isolated public routes, build a safe reusable test runner and fixtures, identify responsibility boundaries, and map every observed failure to its later owning SPEC. It was not to fix product behavior. The completion packet delivers slices 01A, 01B and 01C in order, with separate fresh builder and orchestrator clean-room gates for each, plus a clean final cross-slice review. The approved 13-file candidate hash set still matches `RELEASE-MANIFEST.md`; HEAD remains `88637d11c65be53d4f2ad0f049f64a07fa3db1de` on `agent/exact-workspace-paths`. Preexisting owner/concurrent product and wiki changes remain in place. The authored source scope is test infrastructure/fixtures, not production modules.

Primary report: `SPEC-01-IMPLEMENTATION-REPORT.md`. Detailed baseline: `evidence/spec-01/01C/SLICE-01C-BASELINE.md`. Slice 01B characterization: `evidence/spec-01/01B/SLICE-01B-REPORT.md`.

## Evidence checked by supervisor

- The latest authenticated, isolated V-BASE run `evidence/spec-01/01B/chat-arch-1789988002277-f573cf4379/` reports `passed`, with all 17 characterized cases and `ownedRunRootRemoved: true`. V-SHELL, client build, 10/10 final fixture isolation, 9/9 lifecycle, 2/2 architecture detector, and 2/2 regression parent-loss checks are reported green in the completion packet.
- The private staged focused backend run `evidence/spec-01/01C/server-focused-1789987825500-dc578845/result.json` reports success, 158/158 tests in ten suites, no leaked owned PIDs, and removed owned root.
- The private staged eight-suite client run `evidence/spec-01/01C/boot-1789987825502-49ee9169/` selected 115 cases: 114 passed and one failed product assertion, with zero setup failures. Its underlying exit code 1 propagated, no owned PIDs leaked, and the owned root was removed. The exact failed case is `working-activity.spec.ts > @working in-flight return restores original startedAt over an already-revealed baseline`; `.rv-working-activity` never appeared. This is classified as an owned baseline product defect for SPEC-04, with SPEC-06 rerun, not a successful regression suite or a waived failure.
- R1 settled typing retains all characters yet shows approximately 8-second wall time for 68 characters, next-rAF p95 86–96 ms, 68 long tasks, 204 React commits and 12,240 formatter entries per trial. R2 no-enqueue leaves retained but disabled input and an acceptance-pending wheel; R5 demonstrates no-result or premature-success action behavior. These are reproducible product-red observations assigned to later SPECs.
- R3/R4 receipt/correlation behavior is gated on the not-yet-implemented SPEC-02 contract. Production R6 lifetime is truthfully `blocked_missing_consumer` until SPEC-03 supplies the action consumer; dormant Legacy listener hazards are source-only. R9 native/owner hard-freeze symptoms remain unknown until SPEC-06. None is represented as a passing product gate.
- The test-owned client browser authentication shim does not prove Electron trusted-shell behavior. The separate authenticated V-BASE/V-SHELL runs supply that proof. No live profile/DB, port 3001, Alpha checkout/app, commit or push was used.

## Deviation decisions and future execution packet corrections

The complete original-contract/actual-change/reason/files/tests/effects/risks ledger is in `SPEC-01-IMPLEMENTATION-REPORT.md`. Supervisor disposition:

| Deviation group | Classification | Reason and downstream action |
| --- | --- | --- |
| 01A owned shell-smoke integration, Playwright discovery, staged exact-match fault seams, read-only dependency/resource links and added public fault cases | `accepted_no_downstream_impact` | Mechanically necessary, fixture-only integrations with isolated cleanup and no product API change. Preserve the owned runner entry for future checks. |
| 01B F3 Office/System fixture capsules, second disposable workspace, bounded rail/System setup diagnostics and rebind | `accepted_update_downstream_packet` | Needed to reach actual action callers without touching Office SPEC-12. SPEC-03 must keep File/Wiki/Office/System and source-switch callers in its public-route action matrix. |
| 01B runner case registration/source hashes, conditional R3/R4/R6/R9 probes, R5 result-order and diagnostic probes, longer bounded cumulative deadline | `accepted_update_downstream_packet` | Mechanically necessary oracle repairs. SPEC-02 must reconcile the provisional test `prompt_status` spelling with the approved authenticated `thread:action` family before enforcing 02B, preserving outcome/turn/receipt semantics. SPEC-03 must activate authenticated R6 and prove exact competing-response correlation, listener cleanup, and result-before-success; source-only Legacy probes cannot substitute. |
| 01C architecture detector and baseline report | `accepted_no_downstream_impact` | Requested characterization, not a claim that source checks replace behavioral gates. |
| 01C private staged focused-server and client-boot lanes, bounded `working-activity-ws-fixture.ts` projection update, owned parent-loss guardian | `accepted_update_downstream_packet` | Necessary to convert 57 setup-only old client failures into 115 executable outcomes while preserving assertions. SPEC-04 must repair and rerun the exact Working Activity red case; SPEC-06 must include it in final integrated regression. The browser shim remains supplemental to authenticated Electron checks. |

No accepted prior SPEC is invalidated; this is the first SPEC. No current-SPEC repair or new owner product ruling is required. The test adaptations do not supersede the approved product contracts. The downstream corrections above are supervisor execution guidance and must be included verbatim in the fresh relevant orchestrator packets; the approved candidate's normative bytes remain unchanged.

## Residual risks and owner gate

Expected product defects remain open for SPEC-02 through SPEC-06. Full V-ALL enforce, 45-minute soak, native/OS input, original freeze acceptance, and final wiki reconciliation were not SPEC-01 gates and were not run/claimed. Earlier failed setup/review runs are retained as audit history. There is one current product-red client assertion and several characterized R1/R2/R5 violations; their later owners are explicit.

SPEC-01 passes its characterization/test-infrastructure acceptance boundary and has the owner's explicit acceptance. Dispatch SPEC-02 in a fresh independent orchestrator task using the accepted bytes/evidence and the downstream packet corrections above.
