# SPEC-01 Implementation Report — Agent Tool Provenance

**Orchestrator status:** `OWNER_ACCEPTED`  
**Owner acceptance:** accepted 2026-09-04

## Authority and candidate

- Approved candidate: `AGENT-TOOL-PROV-616b34ab8f748fd2`
- Approved normative aggregate: `616b34ab8f748fd247a2ff3cb31f6bfa5d1c3483a48a43f845e07db1751d36cb`
- Accepted predecessor aggregate: `15c18e67df1d9a69ef96fea6819ade662de23b1f41234c824eb2e92351237590`
- Dispatch/current Git revision: `806b33521907ed4b51cf792d5ef664fe319ea349`
- Worktree: `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar`
- Accepted slice digests before 01f: 01a `f612d147ecb4fa710928f222fdf7011b997120d92cf1a7c503dbd2b86eec7383`; 01b `b4a184285791fc3dfc17055a013b9ffbe9bf9a2369bef43b63c524f2e960665e`; 01c `7767339c6e8d5bf65397d6553f9aa5717dbd240f1f93560124f3c22ad1d586b0`; 01d `3700a5e868aa586f1b00f866c19631ff2df1c1bd2a19c158ac0a9901408d1746`; 01e `2359d01db23e2124970a31241873f77ee3b334503a388c65ace728d95357f177`.
- Slice 01f 19-product-path digest: `c82ab338862d3b54d9c93efe1f5a7111cdaad2c724df91560c377705e986e62e`.
- Digest derivation: emit the newline-terminated `shasum -a 256 <path>` output for the 19 paths in the exact order in this report, concatenate those lines, then run `shasum -a 256` over the result. This report is excluded from that product digest.

Product bytes remain uncommitted. Accepted 01a–01e bytes and unrelated owner/runtime changes were preserved. The orchestrator-owned implementation ledger was not changed by the 01f builder.

## Delivered outcome

The six accepted implementation slices now provide the approved Agent Tool Provenance path: immutable turn authority and honest provider/host clocks; bounded OpenCode terminal capture and conservative resource extraction; durable activities, resource edges, observations, sparse snapshots, admission and ledger projection; secure native post-tool observation; durable renderer projection and recovery; strict activity queries with exchange binding; and client `resource:changed@2` invalidation through the existing File Viewer central store.

Slice 01f specifically adds:

- a closed client v2 discriminated union and strict validator for the immutable server schema, including UUID, conditional checkpoint, absent/bytes, path, timestamp, projection/source identity, and unknown-key rejection;
- version-directed WebSocket handling that keeps v1 unchanged, rejects malformed/unknown versions, applies current workspace/epoch isolation, and closes on conflicting stable projection identity;
- central-store v2 idempotency keyed only by the dominant edge `projectionId`, exact-payload fingerprinting, and the existing targeted parent-tree/content invalidation/refetch behavior for `first_observation`, `changed`, `unchanged`, and `absent`;
- no new UI panel and no Office/Email dirty-buffer mutation;
- a production-inert, marker/nonce/test-mode-only deterministic fixture ingress that constructs allowlisted OpenCode-shaped edit/read/error/running-interruption events internally and uses the real translator, canonical turn path, activity owner, governed admission/ledger, secure observer, renderer scheduler, bind buffer/socket, activity query, exchange save/binder, and File Viewer;
- a guarded live launcher using two dynamic non-3001 ports and the same temporary profile/database across startup and restart, with exact locked schema/subscription/grant authority comparison;
- live proof for bytes A → mediated B → agent-observed A, first/changed/unchanged bytes, analogous absent interleaving, explicit snapshot reuse, provider timestamp preservation and missing terminal clocks, read/write/thread/path query examples, exchange binding, stable-ID replay dedupe, and no watcher or external harness delivery.

## Acceptance mapping

| Contract | Evidence |
|---|---|
| Exact client v2 contract | Four source tests exercise every union branch, unknown/missing fields, UUID/source mismatch, path/time bounds, stale pair, exact replay, and conflict close |
| Existing bind/socket route | Server 01d scheduler remains unchanged; agent live observes v2 through the production workspace bind buffer/socket and browser WebSocket handler |
| Central File Viewer refresh | Main live scenario visibly renders first A, mediated B, unchanged A, error/interruption partial bytes, absent first, mediated absent B, then unchanged absent removal |
| Admitted gates/fallback | Existing 01d scheduler suites cover admitted first/changed and tool-authorized unchanged plus pending/conflict/projection-failure/unavailability identity-free v1 fallback; mediated live reruns fact-publication failure |
| Stable identity/dedupe | Source tests prove exact v2 replay is a no-op and conflicting reuse closes; live test replays the same received projection twice and observes zero reads |
| Sparse checkpoint dedupe | Live assertions prove both bytes unchanged edges reuse the first snapshot, absent unchanged reuses the absent snapshot, and DB totals remain four observations/snapshots and three blobs for seven tools |
| Timestamps and binding | Fixed OpenCode start/end/envelope times survive completed/error snapshots; running interruption retains its reported announce/argument time and omits terminal provider clocks; at least six activities bind to committed exchanges |
| Query disclosure | Live path/thread/read/write/changed-only queries return references/summaries without raw arguments, results, bytes, or roots |
| Same-database startup | Second dynamic-port launch reuses the first profile/database, returns persisted admitted activity, and exact-compares all locked schema, subscription, and grant authority rows |
| Isolation | Launcher and server require nonce-matching markers for root/profile/two workspaces, guard all child-process and filesystem-watch entry points, hash protected developer DB/profile/workspace/test output before/after, and clean only the marker-owned OS-temp root |
| Regression/package | Full server, full source suite, production client build, Electron directory package, packaged native observer, and accepted mediated-save live proof pass |

## Self-review and repairs

- Repaired TypeScript narrowing in the version-directed File Viewer handler by producing a narrowed v1/v2 union before store dispatch.
- Replaced a broad thread index import with the direct CommonJS `ThreadWebSocketHandler` module so the isolated fixture did not cross an unrelated ESM dependency boundary.
- Extended isolated-runtime test DB mocks with the exact query-chain surface required by locked-authority auditing.
- Repaired the interruption fixture after self-review: its OpenCode-shaped running envelope now passes through the real translator; the guarded test adapter explicitly seeds only the in-flight activity/arguments that the production terminal-only capture path cannot obtain without a terminal snapshot, then the shared turn finalizer owns interruption.
- Strengthened live coverage from aggregate snapshot counts to exact bytes/absent snapshot-ID reuse and deterministic running-event clock assertions.
- Builder gate 01 found that inbound fixture logging exposed the authorization nonce. The shared WebSocket redaction map now redacts `nonce` before serialization, while its test proves the original routed frame remains unchanged.
- `git diff --check` passed. Manual inspection verified no edit to the 01d v2 schema, publisher, projection capability, scheduler, seed, or observer subscription.

## Verification evidence

All paths are relative to the worktree. Commands were run from the named package directory.

| Command | Result |
|---|---|
| `cd fusion-studio-server && npm test` | Passed on final cumulative rerun: 138 suites; 1,432 passed, 1 existing skip, 1,433 total; native observer rebuilt first |
| `cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts` | Passed: 58/58 |
| `cd fusion-studio-client && npm run build` | Passed: TypeScript and Vite production build; 1,818 modules transformed |
| `cd fusion-studio-client && npm run electron:pack` | Passed: native observer rebuild, client build, AI resources, Pandoc check, unsigned Darwin arm64 directory package |
| `cd fusion-studio-client && node e2e/provenance/run-packaged-native-observer.mjs` | `PACKAGED_NATIVE_OBSERVER_OK:arm64:141`; actual packaged `spawnServer` resolution reported `SECURE_FILE_OBSERVER_READY:darwin:arm64:141:descriptor-swap-v1` |
| `cd fusion-studio-client && node e2e/provenance/run-agent-tool-live.mjs` | `AGENT_TOOL_LIVE_PROVENANCE_OK`; two unique dynamic non-3001 ports; exact same-DB authority stable; deterministic OpenCode translator fixture; watchers/external harnesses disabled and audited; protected state unchanged; marker-owned cleanup |
| `cd fusion-studio-client && node e2e/provenance/run-file-viewer-live.mjs` | `FILE_VIEWER_LIVE_PROVENANCE_OK`; normal plus injected fact-publication-failure on unique dynamic non-3001 ports; protected state unchanged; marker-owned cleanup |
| Focused server tests | Passed before review: fixture route, isolated runtime, client router, and startup integration, 4 suites/39 tests; after the nonce repair, redaction map, client router, and fixture route, 3 suites/33 tests |
| Focused client v2 source spec | Passed: 4/4 |

Known non-failing output: Node/Jest `--localstorage-file` warning; Node child-process `DEP0190`; Vite existing `gray-matter` eval and large-chunk warnings; unsigned Electron package default icon/metadata warnings. The single server skip is pre-existing. The first post-redaction full-server run encountered the accepted 01d native replacement-race assertion once; no product/native byte was changed, its isolated 10/10 rerun passed, and the complete 1,433-test rerun above passed.

## Exact Slice 01f product-path manifest

```text
1d2c97f7695c2c28463eefeb13a7fff31b979a2b96b6acf93ff71495fe3a3a7f  fusion-studio-client/e2e/agent-resource-projection-source.spec.ts
a8261a8b77bb19bb4638e43f9ff1a338cd04a011952fd95ebdba89b42248749a  fusion-studio-client/e2e/provenance/agent-tool-live.spec.ts
c79d5143a92e23976f1ca65f1f5dba5db3c2bed8b187b71a485054b1bf30db00  fusion-studio-client/e2e/provenance/run-agent-tool-live.mjs
8de2b0f85b22cbf26675086fa9e28c150a90a935b1691d61029a2726b81da5ce  fusion-studio-client/playwright.agent-tool.config.ts
4b9ab92c43e7db225474ac8a6e8dff4e4b9c404c87dd94dd34d40e5e0ea38bd5  fusion-studio-client/playwright.source.config.ts
51e2b93a8ea75d22444ddaea1f1bb741bfa436494390b5f99e6ed682cce6920d  fusion-studio-client/src/lib/ws/file-handlers.ts
571ef9ead16583f756d47b244fca4101002a023371b6ac39b48c90faae53b278  fusion-studio-client/src/lib/ws/resource-projection-protocol.ts
914a4e6cca8493c542ecae85d7c191238f01ae445d2bcac1c3f825308915bd74  fusion-studio-client/src/state/file-data-read-model.ts
136b16cd6132ae0044107267d772f11bba01be674bede597b34915730080d43a  fusion-studio-client/src/state/fileDataStore.ts
caf7e37da4bf05d1145c8a80140595401f46a16a65ae0f256651b9ad10725874  fusion-studio-client/src/types/file-explorer.ts
9137bdd260e9d410d3f7f85947ba4be1eee90f172365ce61e9f46afb451de872  fusion-studio-server/lib/startup.js
17a1a8dd69f0c039ec5a3206ec5501cfa0a0091f95699a975e2d1615e48d8bfb  fusion-studio-server/lib/testing/agent-tool-fixture-route.js
ed5c2c598bf4b94b0f3f154754d747af8ede7068688cf0fb57b2366d9128aa9a  fusion-studio-server/lib/testing/isolated-provenance-runtime.js
c4142de3db1df5436f88a87ff9c5aeeba523ad8aa371d392423156b650af2dc9  fusion-studio-server/lib/ws/client-message-router.js
282c0c963faf46562bb1fe6643409defbacb49fef4246681d032f319f04e4d6f  fusion-studio-server/lib/ws/redaction-map.js
d3ef30a64480b5f0e4e7dfa5228ab12a7bb1ec3a42c183e0d390508cb0922c24  fusion-studio-server/server.js
53b8ad6b231c3da67a5fd6b55fb3f36019a50555e4e97b370da9a782bfc5b1a9  fusion-studio-server/test/runtime/agent-tool-fixture-route.test.js
a768358368157c6eb8676471a1908788e0a45dc2f93ee5ff4e0b6c06d098438b  fusion-studio-server/test/runtime/isolated-provenance-runtime.test.js
14ef1f81acf74266c2aba91bb417c812b8e7bb61027f7fde9cde3f5d4f3f2440  fusion-studio-server/test/ws/redaction-map.test.js
```

## Deviation and out-of-scope accounting

### 01f-D01 — Guarded deterministic server fixture ingress

- Expected boundary: 01f owns a guarded live fixture while final server v2 authority from 01d remains immutable.
- Actual touch: added one test-only route and narrow startup/server/router plumbing so an isolated launched server can receive only an allowlisted fixture name and internally construct OpenCode-shaped events.
- Reason: full adapter-to-visible-File-Viewer proof cannot use source-level injection or a real external harness. The production route factory returns `null`; any message outside isolated mode closes policy-violating clients.
- Observable effect: none in production. In nonce/marker/test mode only, the fixed fixture catalog can mutate two hardcoded paths under the isolated workspace.
- Downstream impact: compatible testing infrastructure only; future fixture additions must remain closed and marker-gated.
- Proposed classification: `accepted_bounded_integration`.

### 01f-D02 — Isolated startup authority audit extension

- Expected boundary: prove same-database startup without locked checksum drift.
- Actual touch: existing isolated-runtime audit now serializes all locked system schema/subscription/grant identity and checksum/scope rows; its mock tests gained the needed read-only chain.
- Reason: comparing counts would not prove exact authority stability.
- Observable effect: an additional test-profile JSON audit section only; no production runtime behavior.
- Downstream impact: positive reusable acceptance evidence; no contract change.
- Proposed classification: `accepted_bounded_integration`.

### 01f-D03 — Accepted predecessor client-file overlaps

- Expected boundary: v2 extends the existing v1 File Viewer protocol/store path without changing v1.
- Actual touch: the shared types, protocol validator, handler, read-model fingerprint, central store, and source config necessarily overlap accepted predecessor files.
- Reason: a parallel store/listener would violate the single-source and canonical-routing requirements.
- Observable effect: only valid v2 adds targeted refetch/dedupe; v1 behavior remains byte-compatible and its live proof passes.
- Downstream impact: compatible; consumers may use the exported v1|v2 union.
- Proposed classification: `mechanically_necessary_overlap`.

### 01f-D04 — Report artifact

- Actual touch: this implementation report was added under the approved capture folder and excluded from the product digest.
- Reason: explicitly required final handoff artifact.
- Observable/downstream effect: documentation only.
- Proposed classification: `workflow_artifact`.

### 01f-D05 — Shared WebSocket nonce redaction

- Expected boundary: every credential-bearing WebSocket field is redacted before diagnostic serialization.
- Actual touch: accepted 01e `redaction-map.js` and its focused test now include the guarded fixture `nonce` while leaving the routed original intact.
- Reason: builder gate 01 reproduced the live authorization nonce verbatim in inbound server logs.
- Observable effect: isolated logs contain `[redacted]`; fixture authorization still receives the exact nonce.
- Downstream impact: compatible privacy hardening at the shared logger; no message or route contract changes.
- Proposed classification: `required_security_repair`.

No immutable 01d v2 server schema, publisher, capability, scheduler, seed, or observer subscription was changed. No UI panel, watcher, real harness adapter process, developer profile, developer database, real workspace content, Alpha installation, commit, publish, or deployment was touched. Prior-slice deviations and their downstream allocations remain authoritative in `IMPLEMENTATION-LEDGER.md`; 01f does not reinterpret them.

## Adapters, skipped checks, and residual risks

- Temporary adapter: the deterministic fixture route is permanently production-inert and available only inside the guarded acceptance mode. It is retained as regression infrastructure; removal criterion is replacement by an equally isolated adapter-boundary harness fixture capable of proving interruptions without a real process.
- Skipped required checks: none.
- Manual unrestricted Electron UI operation was not used; the guarded Playwright live renderer exercised the real browser WebSocket/File Viewer path, and the packaged launcher separately exercised the actual Electron `spawnServer` native-addon resolution path. This avoids touching a user profile while satisfying runtime acceptance.
- Runtime/native evidence is Darwin arm64, Node ABI 141. The accepted 01d non-Darwin packaging follow-up remains unchanged.
- The live adapter explicitly seeds an in-flight activity for the running OpenCode-shaped interruption because the product capture path is deliberately terminal-snapshot-owned. The real shared finalizer, repository, observation, fact, projection, and binding owners process the interruption after that narrow seed.
- The existing package warnings and single server skip remain outside this slice; no new failure is hidden by them.
- Owner decision required: none.

## Review and lifecycle record

- Builder self-review: complete, with the repairs recorded above.
- Builder gate 01 reviewer `/root/slice_01f/slice_01f_builder_gate_01`: terminal `REPAIR_REQUIRED`; found fixture authorization nonce disclosure through inbound WebSocket logging. The exact shared redaction repair is recorded above.
- Builder gate 02 reviewer `/root/slice_01f/slice_01f_builder_gate_02`: terminal `CLEAN` on the current 19-product-path digest `c82ab338862d3b54d9c93efe1f5a7111cdaad2c724df91560c377705e986e62e`; first materially clean repaired-byte pass, so the builder gate stopped.
- Slice 01f orchestrator acceptance reviewer `/root/slice_01f_orchestrator_review_01`: terminal `CLEAN` on the same product digest and report SHA `6b1f201417be79ebe9005e546a91288f29828f6fcdfa538d510b25a561645dc6` after independently rerunning the full server, source Playwright, client build, Electron package, packaged native observer, agent live, and mediated-save live commands.
- Reviewer lifecycle: both reviewer threads are terminal and non-conflicting. A reviewer-close operation is unavailable in this environment; that missing lifecycle operation is recorded as evidence only and is not a blocker.
- All six slice acceptance reviews are now terminal `CLEAN`; their exact identities, repair lineage, current digests, deviations, and downstream impacts are recorded in `IMPLEMENTATION-LEDGER.md`.
- Final integrated reviewer `/root/spec01_final_integration_review_01` returned terminal `CLEAN` after authenticating the approved candidate, predecessor, accepted slice lineage, current report/ledger, and integrated product bytes. It independently reran the full server suite, source Playwright, client build, Electron package, packaged native observer, guarded agent live, and guarded mediated-save live commands, with no required check skipped.
- Final integrated verification: 138/138 server suites with 1,432 passed and one existing skip; 58/58 source Playwright tests; client production build; unsigned Darwin arm64 Electron directory package; `PACKAGED_NATIVE_OBSERVER_OK:arm64:141`; `AGENT_TOOL_LIVE_PROVENANCE_OK`; and `FILE_VIEWER_LIVE_PROVENANCE_OK` all passed.
- The final reviewer found no unexplained cross-slice drift, no protected profile/database/workspace mutation, and no remaining target process, tested-port listener, marker-owned temporary directory, or live-test handle. It classified the integrated SPEC ready for owner review and explicitly not owner-accepted.

## Owner Acceptance Receipt

The owner explicitly accepted the SPEC-01 Agent Tool Provenance implementation on 2026-09-04. This receipt changes documentation only; the final reviewer authenticated the pre-receipt report as SHA-256 `a91c246c9559de21188d264502dd01a6e5b91f1cc768d4f22aa9265fa9085520`, and the reviewed product bytes remain unchanged.

`OWNER_ACCEPTED`
