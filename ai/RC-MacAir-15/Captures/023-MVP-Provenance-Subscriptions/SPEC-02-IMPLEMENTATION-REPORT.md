# SPEC-02 Implementation Report — Governed UEB Subscription Controller

## Approved authority and current candidate

- Approved candidate: `MVP-PROV-SUB-3b8cb4f1e41df682`
- Approved 32-path aggregate SHA-256: `3b8cb4f1e41df682c56d03dbf39d8337ad318019e127106dce372fcab000f310`
- Dispatch and current Git revision: `806b33521907ed4b51cf792d5ef664fe319ea349`
- Worktree: `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar`
- Accepted SPEC-01 prerequisite aggregate: `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`
- Reproducible SPEC-02 22-path work-product aggregate: `06d9e15aba776aa73ce13c62c2dd9d12d78537820668c31dc56d3aa9cdaaa49f`
- Aggregate derivation: sort the 22 repository-relative paths below with `LC_ALL=C`; for each path emit the newline-terminated ASCII output of `shasum -a 256 <path>` (`64 lowercase hexadecimal characters`, two ASCII spaces, repository-relative path); concatenate the 22 lines with no header or footer; run `shasum -a 256` over those bytes.
- The final reviewer independently recomputed the approved authority aggregate, the accepted SPEC-01 aggregate, all 22 current SPEC-02 file identities, and the SPEC-02 aggregate with zero mismatches.
- Product bytes remain uncommitted on the revision above. Pre-existing planning, Wiki, runtime-state, style, package, and accepted SPEC-01 changes were preserved. `IMPLEMENTATION-LEDGER.md` was not modified by this orchestrator or its builders.

## Delivered outcome

SPEC-02 now provides:

- one singleton-bound, irreversibly sealed admission boundary with a lexical catalog containing only `system.file-save-controller` for `file.command_accepted@1` and `resource.mutated@1`;
- direct injection of exact publisher closures, without exporting a generic publisher factory, producer selector, catalog, private endpoint, or capability object;
- opaque reservation verification bound to producer, schema, event identity, time, workspace, operation, and a canonical SHA-256 of every durable envelope/body input;
- exact schema validation, rejection of body-supplied identity fields, canonical clone/deep freeze, and exact `{ admitted, eventId, deliveries }` results;
- a closed handler catalog, closed capability-provider catalog, exact capability scope normalization, active input/output schema validation, and immutable generation descriptors;
- scoped handler contexts that omit raw database, filesystem, socket/session registry, EventEmitter, command, publisher, trigger action, and unknown powers;
- one private admitted-fact controller endpoint regardless of registry row count;
- deterministic priority/ordinal dispatch, immutable fact/generation snapshots, once-per-descriptor delivery per admission attempt, and explicit replay delivery;
- isolation of synchronous throws, best-effort promise rejection, required-ack failure, exact 2,000-ms timeout, late settlement, and recursive legacy follow-up events;
- serialized reload, atomic complete-generation replacement, subtractive preservation of only authority-identical survivors, active-schema checksum fingerprinting, and empty-authority fail-closed behavior on registry-read failure;
- idempotent start/stop, reload/stop race containment, in-flight acknowledgement draining, and shutdown before watcher/database closure;
- startup ordering that initializes the accepted SPEC-01 registry, starts the empty controller, and seals admission before workspace modules, legacy subscribers, sockets/listen, watchers, or TRIGGERS loading;
- unchanged public UEB compatibility exports (`emit`, `on`, `bus`) and unchanged production TRIGGERS bus/file/cron topology;
- a current direct-listener compatibility inventory with explicit removal criteria and focused nongoverned TRIGGERS tests.

Production intentionally activates no governed handler, subscription, grant, or retained publisher in this SPEC. SPEC-03 owns the first atomic ledger activation and replacement of the fail-closed staging adapter; SPEC-04 owns renderer projection activation.

## Slice ledger

| Order | Slice | Builder | Delivered | Builder gate | Orchestrator gate | Accepted state |
|---|---|---|---|---|---|---|
| 02a | Inventory, admission boundary, compiler | `/root/spec_02_subscriptions/slice_02a` | Admission, sealing, capability/handler catalogs, immutable compiler, compatibility inventory, focused tests | Passes 1, 3, and 5 repaired findings; terminal clean pass after each repair, ending `CLEAN` | Acceptance passes 1 and 2 found material gaps; `/root/spec_02_subscriptions/slice_02a_acceptance_03` returned `CLEAN` | Accepted on current 02a hashes |
| 02b | Controller lifecycle and subtractive reload | `/root/spec_02_subscriptions/slice_02b` | Controller, authority fingerprint, staged startup, shutdown ordering, lifecycle/reload tests | Pass 1 `CLEAN`; after acceptance repair, `/root/spec_02_subscriptions/slice_02b/slice_02b_gate_pass_2` returned `CLEAN` | `/root/spec_02_subscriptions/slice_02b_acceptance_01` found registry-read fail-open; repaired; `/root/spec_02_subscriptions/slice_02b_acceptance_02` returned `CLEAN` | Accepted on repaired controller/test hashes |
| 02c | Compatibility and failure acceptance | `/root/spec_02_subscriptions/slice_02c` | Legacy/governed isolation, focused trigger-loader and cron tests, accurate direct-listener evidence | Pass 1 `CLEAN`; evidence-label correction; `/root/spec_02_subscriptions/slice_02c/slice_02c_gate_pass_2` returned `CLEAN` | Pass 1 `CLEAN` with documentation advisory; corrected; `/root/spec_02_subscriptions/slice_02c_acceptance_02` returned `CLEAN` | Accepted on corrected inventory hash |

Slices ran serially with one writer active at a time. No SPEC-03 or SPEC-04 product behavior was implemented.

## Review and repair history

### Slice 02a

- Builder review pass 1 found renderer payload mutation/widening and an incomplete renderer inventory entry; both were repaired.
- Orchestrator acceptance pass 1 found missing provider preflight; the compiler now verifies all required providers before generation activation.
- Builder pass 3 found incomplete enforcement of every handler-required grant and missing renderer output-schema authority; both were repaired.
- Orchestrator acceptance pass 2 found diagnostic scopes validated by key rather than exact normalized scope and an inventory that conflated the distinct TRIGGERS file/cron paths; both were repaired.
- Builder pass 5 returned terminal `CLEAN` on the repaired bytes.
- Final slice acceptance `/root/spec_02_subscriptions/slice_02a_acceptance_03` returned terminal `CLEAN`.
- Current focused cumulative evidence at acceptance: 12 suites, 128 tests passed.

### Slice 02b

- Builder pass 1 returned `CLEAN` after implementing lifecycle, immutable dispatch, deterministic delivery, bounded acknowledgement, serialized reload, staged startup, and shutdown integration.
- Orchestrator acceptance `/root/spec_02_subscriptions/slice_02b_acceptance_01` reproduced a high-severity fail-open: `getEffectiveState()` rejected before the subtractive reload handler, leaving the prior generation active after a possible revocation.
- The builder moved registry acquisition into fail-closed handling. A rejected registry read now installs an empty immutable next generation, emits only bounded diagnostic metadata, rethrows the infrastructure error, and cannot reactivate authority until a later successful explicit reload.
- The regression proves active delivery, rejected read/reload, empty generation, no post-recovery delivery, no implicit reactivation, and activation only after a successful explicit reload.
- Repaired builder gate `/root/spec_02_subscriptions/slice_02b/slice_02b_gate_pass_2` returned `CLEAN`; fresh orchestrator acceptance `/root/spec_02_subscriptions/slice_02b_acceptance_02` returned `CLEAN`.
- Current acceptance evidence: 15 suites, 153 tests passed; repaired controller hash `674ac608d56f130a79f808852d1f4a4b0469a7b8214457e57693b610840d6a6a`; repaired controller-test hash `824bee0bf888a9090563f120141a75d09cfcbbe568728ae8f51337af43cc1636`.

### Slice 02c

- Added `test/triggers/` because the approved minimum test path did not exist.
- Initial deterministic cron-test repair changed Jest timer calls to the required epoch-millisecond API and made spy teardown safe; no product byte changed.
- Builder gate pass 1 returned `CLEAN`.
- Orchestrator acceptance pass 1 returned `CLEAN` and advised that the inventory overstated `workspace-watcher.test.js` as dispatch/emission coverage.
- The builder corrected the inventory to describe that test as exclusion wiring and the new trigger-loader suite as the actual loader-produced filter/event/script/action-boundary evidence.
- Builder pass 2 and fresh orchestrator acceptance `/root/spec_02_subscriptions/slice_02c_acceptance_02` both returned terminal `CLEAN` on the corrected documentation hash.
- Production `trigger-loader.js`, `cron-scheduler.js`, `workspace-watcher.js`, and watcher filter topology remain byte-identical to the baseline.

### Final SPEC integration

- Fresh reviewer `/root/spec_02_subscriptions/spec_02_final_acceptance_01` performed one read-only final pass over the integrated current bytes and returned terminal `CLEAN` on its first pass.
- The reviewer independently authenticated the approved 32-path packet, accepted 27-path SPEC-01 prerequisite, and current 22-path SPEC-02 work product.
- The final gate explicitly inspected admission authority, capability leakage, output schemas, reload atomicity and subtraction, duplicate endpoints/listeners, promise observation, exact acknowledgement timing, recursion, stop/reload races, shutdown, startup seal ordering, TRIGGERS preservation, direct-listener claims, staging, and SPEC-03/04 scope exclusion.
- No material finding, owner ruling, predecessor regression, or unaccounted deviation remained.

### Lifecycle dispositions

- Every direct builder and orchestrator-owned reviewer reached a terminal result before a sibling writer or gate was spawned.
- Each builder accounted for its builder-owned reviewers and their terminal results.
- Superseded clean gates were treated as invalidated when later bytes changed; repaired current bytes received fresh clean-room review.
- No active writer/reviewer conflict remains.
- The runtime exposed no `close_agent` capability. Closure attempts were unavailable and recorded as lifecycle evidence rather than treated as a blocker.
- No builder delegated orchestration ownership; reviewer descendants were fresh, read-only clean-room threads.

## Final verification evidence

Commands were run from `fusion-studio-server/` unless another directory is stated. Raw command results are recorded in the builder, orchestrator, and reviewer transcripts and summarized here; no persistent raw-log artifact was created.

| Command/evidence | Final result |
|---|---|
| `npm test -- --runInBand test/subscriptions` | 5 suites passed; 69 tests passed |
| `npm test -- --runInBand test/watch test/triggers` | 3 suites passed; 7 tests passed |
| `npm test` | 93 suites passed; 824 passed, 1 skipped, 825 total |
| `npm run build` from `fusion-studio-client/` | Passed; TypeScript/Vite production build, 1,812 modules transformed |
| `node --check` for `lib/event-bus.js`, `lib/startup.js`, `lib/shutdown.js`, every `lib/subscriptions/*.js`, every `test/subscriptions/*.js`, and every `test/triggers/*.js` | Passed |
| `git diff --check` from the repository root | Passed |
| Ordered 22-line SPEC-02 manifest aggregate | `06d9e15aba776aa73ce13c62c2dd9d12d78537820668c31dc56d3aa9cdaaa49f`; all per-file hashes matched current bytes |
| Approved release authority authentication | 32 of 32 paths matched; aggregate `3b8cb4f1e41df682c56d03dbf39d8337ad318019e127106dce372fcab000f310` |
| Accepted prerequisite authentication | 27 of 27 paths matched; aggregate `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356` |
| Isolated temporary-profile startup smoke | Admission sealed; 4 schemas, 0 subscriptions; generation 1 empty; clean stop produced generation 2 empty; temporary profile removed |
| Rejected-registry-read lifecycle probe | Initial failure remained startup-fatal; repaired reload installed empty authority; later recovery required explicit successful reload |
| Public UEB surface check | Exact production compatibility exports remain `emit`, `on`, and `bus`; no publisher factory/catalog/private endpoint export |
| Production topology check | No production diff in trigger loader, cron scheduler, workspace watcher, or watcher filter loader |

Additional historical commands used during repair and gates:

- `npm test -- --runInBand test/subscriptions test/event-registry test/ledger/event-ledger.test.js test/watch test/shutdown.test.js` — pre-02c cumulative gate passed 15 suites and 153 tests on repaired 02b bytes.
- `npm test -- --runInBand test/triggers test/subscriptions/compatibility.test.js` — 3 suites and 7 tests passed.
- `npm test -- --runInBand test/watch test/triggers` — rerun after the inventory correction; 3 suites and 7 tests passed.
- Focused controller, admission, compiler, staged-bootstrap, startup-integration, shutdown, registry, ledger, watcher, trigger-loader, and cron suites all passed at their owning repair/review gates.

Known non-failing output:

- Jest/Node warning: `--localstorage-file` was provided without a valid path.
- Existing Node `DEP0190` child-process shell warning.
- Client build warnings for existing `gray-matter` eval use and large output chunks.
- The single existing skip is outside SPEC-02 at `test/harness/compat.test.js:194`.

## Exact current SPEC-02 changed-file manifest

```text
bf99ddfc19deeab360a619b440a574c4d96e13a7065018ba8eddbbbfda474876  ai/RC-MacAir-15/Captures/023-MVP-Provenance-Subscriptions/DIRECT-LISTENER-COMPATIBILITY.md
631ff373c39cad2970f5f633daee96be93320c40236c7a20912fa6c4f3893c00  fusion-studio-server/lib/event-bus.js
465691a7d00ff697038c4b8bd92a59d562a184af41e73831edca2285299d56e7  fusion-studio-server/lib/shutdown.js
91c1f43ae7585913aad6ed94704e4b0c83c11a0dd0a8ddccf58949978cfe6cb0  fusion-studio-server/lib/startup.js
f0d82b0a161d95702f5a3242f6edf82f7a93260502d41ba4f69b660a38b025cd  fusion-studio-server/lib/subscriptions/admission.js
0bc59c738a84d2a1878c65c8ad93c1083bf6d736676612f88dab72155b5dabc1  fusion-studio-server/lib/subscriptions/capability-factory.js
674ac608d56f130a79f808852d1f4a4b0469a7b8214457e57693b610840d6a6a  fusion-studio-server/lib/subscriptions/controller.js
575ed1bd222983518d65b0c2316f374f5b1fde218b24f4fa202172aa4d36fdd1  fusion-studio-server/lib/subscriptions/deep-freeze.js
531a8f3399ba80c149e166b4c7356dd13418b769567704a28b3e05644a9e1024  fusion-studio-server/lib/subscriptions/generation-compiler.js
13c285fe02b77356ea09dff95ad342356e10e1f9704153d5b6eff5a8b8654887  fusion-studio-server/lib/subscriptions/handler-catalog.js
7259865ed67ea2d4d18d0f1adf990939d563c96fbea84ce1f6857650c6534b79  fusion-studio-server/lib/subscriptions/host-bootstrap.js
c5fa4b2b56b0fe687f0681875f5d9aaeabaa778791e1b1151ed6d8d2f8e9ba2a  fusion-studio-server/lib/subscriptions/index.js
2611c4326fbcc0681648ba9f3b5a7366d991d18566652d1ed32832d94d9a5ffb  fusion-studio-server/lib/subscriptions/staged-bootstrap.js
18423dc46e1dd58f72c4bafc18e709ce2142334bd9fa47a0ca2deb32792d0dff  fusion-studio-server/test/event-registry/startup-integration.test.js
82cdc42403628edb4414d2c48b4b835504833115fab21ba58df76b8dd1f67e63  fusion-studio-server/test/shutdown.test.js
2b02653afd155ed1d27da6e8b4ed6a7e4142b027564ab5c965ee3c97a455f453  fusion-studio-server/test/subscriptions/admission.test.js
4fa2d6900ddac7748c2cd3a6158704cbd49a552c66753e260ebb0c1e66c78d0d  fusion-studio-server/test/subscriptions/compatibility.test.js
01adcfa59dab482424236ff4544416c8371b676ba27734705185408c959aa628  fusion-studio-server/test/subscriptions/compiler.test.js
824bee0bf888a9090563f120141a75d09cfcbbe568728ae8f51337af43cc1636  fusion-studio-server/test/subscriptions/controller.test.js
d11275fb5c301c7e66d7f488649cfec508e34e41420518e253db98ebb6cf9098  fusion-studio-server/test/subscriptions/staged-bootstrap.test.js
cef23ba844212b4975ad6eed2ddfd75b71685d890c8cf7b4d3613c5d96225734  fusion-studio-server/test/triggers/cron-scheduler.test.js
fab03b7cd585fac7605166f195899bbff7f6290ff2d4f404ec0be9d7e43a194a  fusion-studio-server/test/triggers/trigger-loader.test.js
```

`startup.js` and its startup-integration test intentionally overlap the accepted SPEC-01 manifest because SPEC-02 extends that load-bearing composition point. No other accepted SPEC-01 implementation file changed for SPEC-02. The implementation report itself is outside the product manifest.

## Deviation and out-of-scope accounting

### D-01 — Dedicated singleton-bound admission state

- Original contract: attach one private admitted-fact path and irreversible host bootstrap to the existing UEB while preserving legacy compatibility exports and avoiding a second bus.
- Actual change: admission/seal state lives in a dedicated subscriptions module keyed to the singleton legacy bus identity; admitted delivery is a private closure, not an EventEmitter topic.
- Reason: an exported or legacy-topic private channel could be recovered or forged by arbitrary imports. Singleton identity still enforces one host boundary without constructing another bus.
- Files: `event-bus.js`, `admission.js`, `host-bootstrap.js`, `index.js`, admission/compatibility tests.
- Tests: singleton sealing, duplicate/late bootstrap, public/late import non-recovery, legacy emission isolation, exact export surface.
- Observable effect: legacy callers retain identical `emit/on/bus` behavior but cannot reach admitted delivery or mint a publisher.
- Risk: the singleton object identity remains load-bearing; alternate isolated module graphs must use their own explicit test fixture rather than production minting.
- Downstream impact: positive for SPEC-03; its owning service receives exact injected closures. No impact on SPEC-04.
- Classification: `accepted` required security integration.

### D-02 — Injected reservation verifier and test-only opaque fixture

- Original contract: SPEC-02 verifies opaque durable reservations; SPEC-03 owns the durable reservation repository and mutation lifecycle.
- Actual change: the admission boundary accepts a closed verifier dependency. Tests use a WeakMap-backed opaque reservation fixture; production staging uses a verifier that rejects every reservation.
- Reason: exercise the complete binding and replay contract without prematurely implementing SPEC-03 persistence or exporting a serializable proof.
- Files: `admission.js`, `host-bootstrap.js`, `staged-bootstrap.js`, admission/staged-bootstrap tests.
- Tests: wrong reservation/producer/schema/workspace/operation, every changed durable input, exact replay, identity-field forgery, non-enumerability/non-serializability.
- Observable effect: production cannot admit facts yet; test fixtures prove the eventual exact contract.
- Risk: SPEC-03 must preserve the full canonical input binding and opacity when it supplies the durable implementation.
- Downstream impact: `requires downstream replacement` in SPEC-03; no owner decision required.
- Classification: `accepted` bounded prerequisite adapter.

### D-03 — Closed handler/provider/output-schema maps

- Original contract: allowlisted built-in handlers receive only exact granted capabilities and valid schema projections.
- Actual change: the compiler uses closed handler contracts, closed provider names, exact required grant scopes, and closed output projection schema maps; all providers and active referenced schemas are preflighted before activation.
- Reason: key-only or late provider checks could activate descriptors whose required power or output authority is unavailable.
- Files: `handler-catalog.js`, `capability-factory.js`, `generation-compiler.js`, compiler tests.
- Tests: unknown handler/provider/capability, missing or widened/narrowed scopes, unavailable provider, inactive input/output schema, output projection validation, frozen contexts.
- Observable effect: invalid authority never becomes an active descriptor and handlers receive no unknown power.
- Risk: future handler/capability additions require deliberate catalog and schema-contract review.
- Downstream impact: SPEC-03/04 must add their implementations/providers only with the locked rows and grants they activate.
- Classification: `accepted` required security integration.

### D-04 — Internal authority fingerprint for subtractive reload

- Original contract: a failed reload may preserve only proven-unchanged prior descriptors; reductions fail closed while additions/reconfigurations remain atomic.
- Actual change: each descriptor carries a private SHA-256 authority fingerprint over normalized subscription authority and every referenced active schema checksum.
- Reason: subscription ID alone cannot prove that grants, filters, handler configuration, or schema authority are unchanged.
- Files: `generation-compiler.js`, `controller.js`, compiler/controller tests.
- Tests: unchanged survivor retention, changed grant/filter/config/schema checksum removal, revoked/disabled/invalid removal, failed additive reload.
- Observable effect: only byte-authority-equivalent prior descriptors survive a partial failed reload.
- Risk: new authority-bearing fields must be included in the fingerprint contract.
- Downstream impact: positive; SPEC-03/04 reductions cannot silently retain stale authority.
- Classification: `accepted` required security integration.

### D-05 — Reject-all/discard-only staged production bootstrap

- Original contract: composition root seals admission before any dynamic module/listener/socket and directly injects publishers into the owning file-save controller; the durable owner does not exist until SPEC-03.
- Actual change: startup creates an empty controller and invokes a one-time staging bootstrap whose verifier rejects all reservations and whose exact publisher installer retains no publisher.
- Reason: meet the irreversible startup-order contract now without exposing a publisher or inventing the SPEC-03 save-controller/repository.
- Files: `startup.js`, `staged-bootstrap.js`, `startup-integration.test.js`, staged-bootstrap tests.
- Tests: exact two-publisher catalog is minted and discarded, no publisher recovery, no admission, seal-before-workspace/listener/watch/listen, late bootstrap rejection.
- Observable effect: the governed controller is structurally live but production delivery remains inert and no publisher survives startup.
- Risk: leaving this adapter in place after adding rows would keep governed facts inert.
- Downstream impact: `requires downstream replacement`; SPEC-03 must atomically install durable verification, exact file-save-owner publisher injection, handlers/providers, locked row, and grants before activation.
- Classification: `accepted` temporary fail-closed adapter.

### D-06 — Startup and shutdown composition integration

- Original contract: registry/controller/seal start after migrations and before other modules; clean stop occurs before watchers and SQLite close.
- Actual change: SPEC-02 extends accepted SPEC-01 `startup.js`/startup test and adds an optional compatibility-preserving `stopSubscriptions` shutdown dependency that production always supplies.
- Reason: these are the load-bearing composition and teardown points for one controller instance.
- Files: `startup.js`, `shutdown.js`, `startup-integration.test.js`, `shutdown.test.js`.
- Tests: exact source order, infrastructure-fatal startup, idempotent shutdown, governed stop before watcher/database close, in-flight drain.
- Observable effect: unsafe partial startup fails; shutdown refuses new governed delivery and drains tracked attempts before closing dependencies.
- Risk: direct test/alternate shutdown construction that omits the dependency receives the no-op default; production wiring is covered and supplies the real stop.
- Downstream impact: SPEC-03/04 reuse this lifecycle; no contract correction required.
- Classification: `accepted` mechanically necessary integration.

### D-07 — Focused TRIGGERS coverage and compatibility artifact

- Original contract: add focused `test/triggers` coverage if absent and record every direct listener/TRIGGERS compatibility path without refactoring trigger execution.
- Actual change: added bus/file trigger-loader and cron-scheduler suites plus a separate direct-listener inventory; corrected a stale watcher evidence label after review.
- Reason: `test/triggers` did not exist, and bus, file, and cron have distinct ownership/removal criteria.
- Files: `DIRECT-LISTENER-COMPATIBILITY.md`, `trigger-loader.test.js`, `cron-scheduler.test.js`, `compatibility.test.js`.
- Tests: workspace/condition filtering, exact action arguments, match/exclude/event selection, script handoff, cron parsing/scheduling/duplicate suppression/retry/failure isolation, and absence of governed capabilities.
- Observable effect: retained compatibility is now explicit and regression-tested; production topology is unchanged.
- Risk: none beyond normal maintenance of the inventory as direct callers change.
- Downstream impact: future TRIGGERS governance requires one subject per executable definition and scoped named commands; it must not grant the editable set as one system adapter.
- Classification: `accepted` required test/documentation integration.

### D-08 — Deterministic cron/script test isolation

- Original contract: preserve and test current cron and file-trigger behavior.
- Actual change: cron tests substitute shared safety/timer helpers, and the script path uses a controlled script-runner substitute while executing the real loader/parser/filter/scheduler modules.
- Reason: prove ownership, delays, duplicate suppression, retry, failure isolation, and handoff without wall-clock waits or workspace script side effects.
- Files: `cron-scheduler.test.js`, `trigger-loader.test.js`.
- Tests: the focused test files themselves plus the unchanged production full suite.
- Observable effect: deterministic acceptance evidence; no production behavior changes.
- Risk: real wall-clock scheduling was not separately exercised in this SPEC.
- Downstream impact: none.
- Classification: `accepted` benign test isolation.

No other design, sequencing, expected-path, predecessor, or out-of-scope deviation was found. No production authorization minter, upward grant route, second bus, arbitrary executor, accepted-reference lease, plugin import, Systems toggle, retention scheduler, TRIGGERS governance adapter, SPEC-03 ledger path, or SPEC-04 renderer path was introduced.

## Direct-listener compatibility disposition

The detailed current inventory and removal criteria live in `DIRECT-LISTENER-COMPATIBILITY.md`. Its terminal classifications are:

- planned governed activation: `system.provenance-ledger` in SPEC-03 and `system.resource-render-projection` in SPEC-04;
- retained legacy compatibility: event ledger wildcard coverage, workspace/thread state broadcasters, wire/chat lifecycle broadcaster, audit, transcription history, chat metadata file mutations, ticket dispatch, workspace command routing, thread lifecycle, harness status, and calendar broadcast;
- retained nongoverned TRIGGERS compatibility: editable bus definitions, file watcher/filter definitions including optional scripts, and cron registrations/scheduler execution;
- unrelated operational listeners: Node/WebSocket/process/child-process `EventEmitter.on` call sites, which are not UEB subscribers.

No retained direct caller is claimed governed. Every removal criterion requires registered schema/producer authority, a per-definition or subsystem registry subject, and the necessary scoped persistence/projection/named-command contract.

## Residual risks, skipped checks, and temporary adapters

- Production has zero active governed handlers/subscriptions and retains no publisher by design. This is safe but intentionally non-observable until SPEC-03 activation.
- SPEC-03 must replace both the reject-all verifier and discard-only installer atomically; it must preserve exact full-input reservation binding and inject publishers only into the save owner.
- SPEC-03/04 must activate each built-in handler together with its locked row, grants, providers, and output schemas. No partial activation is permitted.
- Handler/provider/output catalogs and the authority fingerprint are closed; future authority-bearing fields require explicit reviewed integration.
- Real wall-clock cron timing was not separately exercised; deterministic timer/safety boundary tests and the unchanged full production suite passed.
- Live `node server.js`, Electron launch, browser/manual UI, and Alpha dogfood operations were not run. They would start unrelated watchers/adapters and no UI product byte changed. The complete server suite, isolated startup smoke, and client production build ran instead.
- No Alpha pull, build, install, or restart was authorized or performed.
- Temporary production adapter: reject-all/discard-only `staged-bootstrap.js`, removal owned by SPEC-03.
- Test-only adapters: opaque WeakMap reservation fixture, controlled script-runner, and deterministic cron safety/timer substitutes.
- Existing Node/Jest/client warnings and the one unrelated skipped harness test remain as recorded above.

## Downstream assessment

- SPEC-03: `requires downstream replacement` for the staged bootstrap and `compatible deviation` for the closed admission/compiler/controller contracts. It must add the durable reservation repository, exact save-owner publisher injection, provenance-ledger handler/provider, locked subscription, and exact grants atomically. It must not expose publishers, add a production authorization minter, or retain editable trigger powers.
- SPEC-04: `compatible deviation`. It can add the renderer projection handler/provider/locked row/grants against the closed schema and capability contracts. It must not receive raw sockets/session maps or widen the renderer output projection schemas.
- Future TRIGGERS migration: `requires downstream redesign` only when separately approved. Use one registry subject per executable definition and scoped named commands; do not pass editable definitions or `actionHandlers` through system authority.
- Future handler/capability additions: `requires reviewed catalog integration` so provider availability, exact scope normalization, output schema authority, and fingerprint coverage remain complete.
- Owner ruling required: none.

SPEC_READY_FOR_SUPERVISOR_REVIEW
