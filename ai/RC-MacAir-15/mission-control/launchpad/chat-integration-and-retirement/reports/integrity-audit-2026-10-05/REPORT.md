# CHAT-AR build integrity audit — 2026-10-05

> Owner-requested investigation. Authored evidence and recommendations; no implementation acceptance, product repair, publication or deployment approval is granted here.

Author: Codex side chat (ephemeral). Observed 2026-10-05, approximately 16:10–16:30 UTC / 9:10–9:30 a.m. PDT. Product checkout: `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`, extensively dirty.

## Assessment

**The current Chokidar retirement build has two reproduced integration regressions and is not ready for acceptance. Its passing server suite and client build do not establish integrity across the changed startup boundary.** The required actual OpenCode conversation, persistence and reopening test also remains incomplete.

The evidence supports a targeted repair and renewed integration review. It does not establish that all earlier accepted chat work is defective. Of the 30 product-source files recorded in the earlier CHAT-SIMPLE final fingerprint manifest, 29 still match exactly; the sole changed product file is the documented New Chat repair. That is a bounded byte comparison, not an exhaustive recertification of the older build.

The owner reports that implementation ran on Luna rather than Sol. This audit does not independently establish every historical agent's model or infer correctness from a model name. One repair-review packet explicitly records an inherited root model/effort with no override. A fresh reviewer context is evidence of procedural independence; that packet supplies no evidence of a separately selected Sol review. The defects below are established through current source and executable probes.

## Scope, authority and evidence identity

The folder contains several generations of work. The active, unfinished build is [CHAT-AR-SPEC-01](../../planning/chokidar-retirement-and-harness-launch/spec/SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md), covering Chokidar retirement and required chat verification. Earlier CHAT-SIMPLE-01/02/03 have owner-acceptance receipts, a final integration report and a merge/deployment receipt. Historical SPEC-06 acceptance and residuals remain separate.

Inspected the local instructions, TICKET, index, BULLETIN, INTENT, relevant authority/implementation records, October 5 handoff, approved candidate and owner approval, slice ledger, S3/S4 reports, current changed product source, relevant tests, and the Chat overview. Used native task reads to verify that both the implementation orchestrator `01a1042c-09df-7473-a1e1-f458eee6b93d` and source investigation `01a0ea32-f152-77a2-afc2-b73e8976685a` were idle before the audit. No message or resumption was sent to either task.

Approved candidate: `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`. Normative SPEC SHA-256 recomputed and matched `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`. All three October 5 reviewed repair hashes matched the handoff: `thread-handlers.ts`, `threaded-chat-host.spec.ts`, and `chat-send-transport.spec.ts`.

The existing folder registration remains `01a0e6c9-e4e0-7872-9268-9a77a76f0c57`, host `local`, with `lastCheckpoint: null`. This audit makes no claim to that main identity and performs no registration, rebinding or history checkpoint. Its report owns only this new audit directory; existing ledgers and acceptance records are preserved.

## Reproduced findings

### IA-01 — P1: the renamed pipeline is rejected in normal production mode

Locations: `fusion-studio-server/lib/startup.js:669`, `lib/testing/isolated-provenance-runtime.js:19`, `:103`, and `:238`.

Startup calls `defineStartupEffect('workspace-automation-pipeline', ...)`. The effect registry still permits only the old `workspace-watcher-trigger-pipeline` name. `createEffectRegistry` validates names even when isolated testing is disabled; the normal production runtime uses that same registry.

A direct call through the real normal-mode runtime throws:

```text
unknown isolated provenance startup effect: workspace-automation-pipeline
factoryRan: false
```

The production startup `try/catch` logs the error and resolves its listen promise. Normal-mode `finalizeStartupAudit` is a no-op. Consequently the shell can connect while `_startPipeline` never runs. Component definitions, trigger action setup, event-trigger registration, cron scheduling and runner heartbeat startup inside that pipeline are skipped. This contradicts S3's preservation contract and its accepted implementation report. The changed loader can work correctly in isolation while never being reached by production startup.

In isolated provenance mode, the same rejected name also leaves the old required effect absent, so final startup coverage cannot pass. The existing guarded file-viewer integration launcher failed before its browser tests with server exit 1. Its console redacts server errors to `diagnostic_error`, so that log alone does not identify the exception; the independent registry/name probe establishes the exact mismatch.

Recommended repair: use one consistent effect identity in startup, the registry and the file-viewer audit expectation. Add an executable check that compares actual startup registrations with the real registry and verifies that the preserved automation factory is invoked in normal mode. Re-run the guarded production-server integration lane.

### IA-02 — P2: the remaining pipeline lost its view-readiness admission and lease

Locations: `fusion-studio-server/lib/startup.js:670`, `lib/views/readiness-startup.js:24`, and the retained `_startPipeline` consumers at `startup.js:760` and `:834`.

The retirement change removed the import and call to `startWorkspacePipelineWhenReady` and invokes `_startPipeline` directly. The removed wrapper guards view-owned operations: it ensures workspace view readiness, acquires a readiness lease, and declines to start the pipeline when the registry is unavailable. That is a view migration/availability contract beyond filesystem watcher activation.

`workspaceController.start()` does perform an earlier registered-workspace readiness pass. However, `ensureRegisteredWorkspaceReadiness` catches per-workspace failures and returns unavailable statuses; the controller does not use that result to prevent this pipeline. The earlier pass also does not hold a lease around the later script/root resolution. It is not equivalent to the deleted guard.

The saved probe uses the exact current `_startPipeline` function extracted from the production AST, the real view resolver, a disposable fixture workspace, and harmless stubs for the downstream scheduling/action effects. With the installed readiness owner explicitly unavailable:

- The existing wrapper returns `{started: false, reason: 'view_registry_unavailable'}` and makes zero factory calls.
- The current direct factory loads the fixture workspace's ticket script, loads components, reaches trigger registration and starts the stubbed runner monitor.
- The direct factory makes zero readiness requests and acquires zero leases.

This is a controlled admission-boundary reproduction, not a live workspace corruption incident. IA-01 currently masks this path in normal startup; simply repairing the name mismatch would expose it. No evidence attributes the owner's render delay to this regression.

Recommended repair: preserve the view-readiness/lease wrapper around the remaining automation factory while keeping watcher creation absent. Update retirement tests to assert watcher absence and retained readiness behavior separately. Test ready, unavailable and relocation/lease cases through the production startup boundary.

## Verification weaknesses and remaining gaps

The retirement boundary test at `test/watch/watcher-retirement.test.js:21` requires the readiness wrapper's name to be absent and at `:23` requires the new effect name to appear in source. The startup integration test likewise checks source order and the wrapper's absence. These tests do not run the changed registration against the real effect registry. The isolated-runtime unit tests iterate the registry's own expected-name array, so they can pass with a stale name. The old unavailable-readiness test still passes against a helper production startup no longer calls.

That explains how the full suite and multiple reported CLEAN reviews missed these regressions. It establishes inadequate coverage at this particular integration seam; it does not establish fabricated test results or deliberate misconduct. The rerun reproduced the reported full-suite count exactly.

The ledger correctly keeps whole S4 pending. Its mandatory public-route scenario requires an ordinary authenticated OpenCode prompt, actual child/session, completed response, durable exchange identity and normal same-thread reopening. There is no completed evidence for those criteria on the current bytes. Startup/connection receipts and 34 passing fixture tests cannot supply it.

The earlier smoke setup used an isolated SQLite profile but auto-selected the real fs-dev workspace. Shared workspace capsule state therefore was not isolated. A scratch workspace was prepared but not registered/selected. Multiple development windows and Alpha were also running in the dated handoff inventory. These are test-attribution and isolation gaps; this audit did not operate those apps or assert their current health.

The New Chat selection repair is source-grounded and its current reviewed hashes match. Its 34 focused tests passed independently. The defective legacy-selection branch predates retirement, but there is still no matched before/after comparison of the owner's known working artifact/profile/workspace. The reported render delay, high DOM count and resource footprint remain unresolved; neither new startup finding proves their cause.

## Checks performed in this audit

| Check | Actual result | Evidence |
|---|---|---|
| Full server `npm test -- --runInBand` | PASS: native observer pretest build, 219 suites, 3,244 passed, one skipped; 76.532 seconds | [server-suite.log](server-suite.log) |
| Client `npm run build` | PASS: preload, TypeScript and Vite; existing warning categories remain | [client-build.log](client-build.log) |
| Two focused chat fixture suites on isolated port 43189 | PASS: 34/34; 24.0 seconds; test-owned server with no reuse | [chat-fixtures.log](chat-fixtures.log) |
| Guarded `node e2e/provenance/run-file-viewer-live.mjs` | FAIL: production test server exits before browser tests | [provenance-live.log](provenance-live.log) |
| Real normal-mode registry and current factory admission probe | FAILS the required preservation contracts: IA-01 and IA-02 reproduced | [result](startup-contract-result.json), [reproducible probe](startup-contract-probe.cjs) |
| Approved SPEC and reviewed New Chat file fingerprints | PASS: unchanged reviewed bytes | [source evidence](SOURCE-EVIDENCE.json) |
| Earlier CHAT-SIMPLE final source fingerprint comparison | 61/64 match: product 29/30, tests 11/12, docs 21/22; all differences are the documented repair/retirement paths | [source evidence](SOURCE-EVIDENCE.json) |
| Production retired-import/API sweep | PASS: no checked Chokidar, deleted watcher, old screenshot refresh, or deleted filter API references in production client/server source | Source sweep in this audit |
| Scoped product diff whitespace | PASS | `git diff --check` |
| Working-memory index validation | PASS: six indexed documents | Memory Maintenance validation helper |
| Actual authenticated OpenCode/public UI response/persistence/reopen | NOT PERFORMED; required S4 criterion remains open | Current ledger and October 5 handoff |

The scoped tracked product-source/package diff is 20 files, 58 insertions and 1,039 deletions, net 981 lines removed. `thread-handlers.ts` grows by 15 lines. This supports the handoff's measured size statement; it is not a performance or correctness test. Earlier generated build fingerprints were not expected to match after the newer repair and this audit's rebuild.

Server warnings include the existing `--localstorage-file` warning and DEP0190. Client warnings include `gray-matter` eval, CaptureTiles mixed imports and a large minified chunk. No new warning repair was attempted.

## Recommended recovery sequence and limits

1. Hold final acceptance of CHAT-AR-SPEC-01. Return IA-01 and IA-02 to the responsible implementation owner for bounded repair and reconsideration of the S3 integration conclusion.
2. Align effect identity and restore view-readiness admission/lease without reintroducing a filesystem watcher. Replace the misleading source-only assertions with executable integration checks at those boundaries.
3. Re-run affected automation/readiness/shutdown checks, the guarded production-server integration lane, the full suite and the client build on the repaired bytes. Preserve exact hashes and record the discovered regressions and repair impact in the implementation ledger.
4. Identify one refreshed test app, profile and machine identity, register/select the actual scratch workspace, and complete every approved public OpenCode acceptance criterion. Respect the existing manual-test ownership and UI automation authorization boundary.
5. Obtain a fresh final integration review against the repaired source and actual runtime evidence, then return the concrete candidate for owner acceptance. Git publication and Alpha operations retain their own gates.

This audit wrote only its report, reproducible probe, fingerprints and test logs. It regenerated client/preload and native test build artifacts through the prescribed verification commands. It made no product-source repair, live owner-app action, provider prompt, Git commit/push, Alpha operation, main rebinding or checkpoint advance. The guarded integration run used its existing marker-owned disposable profile/workspaces and cleaned them on failure. Existing acceptance records were not edited.

The review covers the current retirement diff and immediate integration consumers, plus the earlier accepted source comparison. It is not an exhaustive new implementation review of every historical SPEC, a full provider error/retry audit, or a renderer performance diagnosis. An untested claim remains untested even when a related fixture passes.
