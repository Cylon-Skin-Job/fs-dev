# Guarded production-server evidence

## Current state — 2026-10-06T09:03:59.622347+00:00

R1, R2 and R3 are accepted on current bytes. Whole-R3 builder and separate fresh acceptance gates are CLEAN; the actual authenticated OpenCode exchange, persistence, post-completion passive reopen, protected supported scratch stop and original S3/S4/ledger adoption are complete. No further human UI action is required. A fresh complete repair+original final integration and coordinated marker-owned cleanup remain required; completed-work owner acceptance is separate.

Next action: one new final reviewer independently inspects both entire approved contracts/current bytes/raw evidence and retained resources, followed by protected cleanup and exact receipt verification. [Actual R3 acceptance](R3/R3-ACCEPTANCE.json), [raw independent return](R3/R3-ACCEPTANCE-REVIEW-01-RAW.md), [original adoption](original-adoption-20261006/ADOPTION-MANIFEST.json), [sealed public proof](OPENCODE-PUBLIC-SMOKE.md) and [final cumulative checks](final-integration/CUMULATIVE-CHECK-RESULT.json) identify current facts. Earlier pending/unperformed/manual-only statements are dated history, superseded only within the completed scope.

## Earlier execution account and command evidence

Repair orchestrator `/root/startup_integrity_repair_orchestrator`, Codex side chat (ephemeral). Evidence inspected at 2026-10-06T01:19:02Z. This records R3 checks in progress; R3 builder/acceptance/final gates and the separate ordinary authenticated OpenCode smoke remain pending.

## Actual guarded run

From `/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client`, R3 ran the exact approved command after the successful client build:

```sh
node e2e/provenance/run-file-viewer-live.mjs
```

Exit 0. The launcher uses `playwright.provenance.config.ts`, `reuseExistingServer: false`, actual `fusion-studio-server/server.js`, NODE_ENV=test, Test-Provenance machine, isolated-v1 guards, owned profile/DB and two exact scratch registry entries. It did not attach to port 3001 or an owner server.

| Scenario | Actual port | Browser result | Audit and cleanup |
|---|---|---|---|
| normal | 52152 | Ordinary save/projection/narrow refresh/provenance/stale-duplicate/refetch/alias test and production workspace-bind ordering/overflow test passed; fact-failure case intentionally skipped for this scenario. 2 passed, 1 scenario skip. | Passed startup-audit phase; retained content-free audit; removed exact nonce-owned scenario root afterward. |
| fact-publish-failure | 52170 | Postwrite publication failure produced targeted recovery before visible refetch. 1 passed, 2 normal-only scenario skips. | Passed startup-audit phase; retained content-free audit; removed exact nonce-owned scenario root afterward. |

These are scenario-selected assertions, not omitted required scenarios. Both scenarios completed. Raw initial external log SHA-256 `0f0710652d831db19a9ad3002c5d977a8ae8c30ab688ffe9b75ecd4892ff93cc`, retained at `/private/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/chat-ar-r3-stage-5ko0edmk/guarded-launcher.log` and adopted by the builder with its other raw records.

## Independent receipt inspection

Orchestrator independently read both retained audits and both scenario receipts, checked their fingerprints and the evidence marker, and inspected actual browser result lines. [Raw independent inspection](R3/orchestrator-guarded-receipt-inspection.log). External evidence root `/private/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/fusion-provenance-evidence-opm2tF`, nonce `61e398be-e384-46c2-a025-d1f9ae1fcda8`, remains owned and retained through review.

Each audit records the seven independent expected startup names including `workspace-automation-pipeline`, exactly one start and blocked request per effect, zero factory and prohibited invocations, installed observation guards, zero child-process/watch attempts, and `harness-http-revalidation` start=blocked=1/factory=prohibited=0. DB exists, audited ports match actual ports, and both exact scratch workspace identities/canonical paths match each scenario root. Audit hashes: normal `0639aec65a144db9ed7bca92e0b1ed453f7909e14dfde4cde1eafe4229d2c5ef`; fact-publish-failure `7ab321d74180f2b03e444bbf302105247473ce674a09acd28c48abc33479fcf7`.

Both scenario receipts retain the audit before cleanup, status passed, phase startup-audit, cleanup owned-marker-verified. Normal receipt hash `54673b01eedc84781e4407a7161dc54dae192c54e98e597c0c4a534a4f9b94e7`; fact-publish-failure receipt `94aeadd17eba526498f8e092d1e4157fbfe4add858126c8eed9338f6700625ed`. The original scenario roots were removed; evidence roots and receipts remain.

Protected-state receipt SHA-256 `443c7edde75e7dbf6acef29d7cc4b207f651b4428f5e4294701b8da89c17e9c0`, outcome passed/comparison unchanged. Before and after match for development DB, ordinary profile DB, the entire developer `ai/RC-MacAir-15` tree and preexisting repository Playwright output. The builder's adopted safe copies are under [R3/guarded-safe-evidence](R3/guarded-safe-evidence/protected-state-receipt.json).

Before execution, runtime listing established root/planning/R1/R2 children terminal and only this orchestrator plus R3 active. These two writers explicitly froze all protected-tree writes from START_GUARDED_NO_WRITE_INTERVAL until INTERVAL_ENDED. Parent's terminal status supplied the absence of an active parent writer; elapsed time supplied no approval. Logs and scenario/evidence roots remained outside the protected tree during the run. Normal/Alpha/manual instances were preserved.

## Failure-path integration and limits

The orchestrator then independently reran the exact launcher on current bytes: exit 0, normal port **52246**, fact-publish-failure **52262**, both scenarios and protected equality passed. A second explicit two-writer no-write interval ended only after process completion. [Independent raw log](R3/orchestrator-guarded-launcher.log), SHA-256 `ef61a4561286b030c09510d575ee1746ad284de23853d396579ec4f2f7667d19`; [command result](R3/orchestrator-guarded-command-result.json). [Receipt manifest](R3/ORCHESTRATOR-GUARDED-RECEIPT.json) records retained roots/nonces and every adopted hash. Independent executable assertions checked all seven literal expected names, exact counters, runtime revalidation, installed guards, exact two-entry registry, removed original roots and all four protected before/after hashes. Adopted audits/receipts are under `R3/orchestrator-guarded-safe-evidence/`; the external owned run/evidence roots remain through review. This supplies an independent actual-server rerun; public-provider acceptance remains separate.

CST-A02/RLV-A01 required the fixture lifecycle repair: failed lanes previously deleted their audit/results and bypassed final protected comparison. The first helper copied safe audit/failure-context/images before owned cleanup, excluded raw synthetic authentication trace payload, compared protected state on both failure and success, and retained the root on artifact-retention failure. R3 self-review then found that trace hash/size metadata was serialized after deletion, so that metadata could be lost between cleanup and receipt persistence. The orchestrator validated this against actual code and returned the bounded persist-before-delete/error-preservation repair. Both successful guarded runs above remain dated results on that earlier helper; its failure-receipt ordering was not accepted. This invalidated the affected lifecycle/guarded checks until the corrected-helper evidence recorded below.

Orchestrator independently ran `node --test e2e/provenance/guarded-proof-lifecycle.test.mjs`: exit 0, all six cases passed. [Raw result](R3/orchestrator-lifecycle.log). Cases establish safe failed receipt retention, success retention, failed-lane protected drift/unchanged comparison, successful-lane drift refusal, and refusal of linked/changed-owned cleanup. The actual guarded run succeeded; no actual failed-lane receipt is falsely claimed from it. The fact-publish-failure scenario is an expected product recovery scenario, distinct from an unexpected failed launcher.

The bounded ordering correction is now implemented and independently inspected. Helper SHA-256 `4a84e765eb77e5d4f31ad09fd987106a2df190e51273f5643fcde6c6b321f736` persists the pending scenario/phase/artifact receipt before deletion and updates it atomically afterward. Pre-cleanup persistence failure retains the original root; final update failure retains the already persisted trace metadata. Finalization failures preserve the original scenario failure and protected comparison. Both builder and orchestrator obtained **10/10 lifecycle passes**, including ordering and injected write/update failures; [current independent raw result](R3/orchestrator-lifecycle-current.log).

Corrected-helper exact launcher reruns passed both scenarios: builder normal **52375** / fact-publish-failure **52389**; independent orchestrator normal **52422** / fact-publish-failure **52436**. Orchestrator again checked the seven literal names, all exact counters, installed guards, runtime blocked revalidation, exact two-entry registry, owned cleanup and all four protected hash equalities. All five fixture/config source hashes remained identical before/after its run. [Current raw log](R3/orchestrator-guarded-launcher-current.log), SHA-256 `5846371ccd9ee2cd321c4781705441b9a3d4b056120ba1d462cca22805a94734`; [exact result and source hashes](R3/orchestrator-guarded-command-result-current.json); [current receipt manifest](R3/ORCHESTRATOR-GUARDED-CURRENT-RECEIPT.json). Adopted current safe receipts remain under `R3/orchestrator-guarded-current-safe-evidence/`, and external evidence root `/private/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/fusion-provenance-evidence-Xrfzm4`, nonce `0176fd45-e9bd-4771-8d30-938a99cfdeee`, remains through review. Earlier helper runs and the finding remain historical provenance. Scenario-selected skip counts retain the same exact scope described above.

The guarded lane intentionally blocks harness factories. It supplies save/tool isolation and startup-accounting evidence; it does not supply actual OpenCode activation, completed exchange, public shell authentication or passive same-thread reopen. Those §7 gates and original-owner record adoption remain required. R3 deviations and whole-SPEC verdict await the complete builder packet and distinct independent gates.
