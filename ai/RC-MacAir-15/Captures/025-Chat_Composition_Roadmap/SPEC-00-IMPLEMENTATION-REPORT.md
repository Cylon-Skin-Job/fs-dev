# SPEC-00 Trusted Fusion Shell Authority — Implementation Report

**Status:** `OWNER_ACCEPTED — INTEGRATED`

**Approved candidate:** `CHAT-COMPOSITION-e3d2c49f044cd7f7`

**Normative aggregate:** `e3d2c49f044cd7f7d5c913a5e03ee3c9f92f50636f8455acb5bad01dc73a1dc7`

**Starting implementation baseline:** `39a694f7f766d2d4d8405953294526e698c75d15`

**Implementation commit:** `1baaffa1c785fdb762fb63948cb02a600c957f71`

**Owner acceptance:** granted and integrated into `agent/exact-workspace-paths`
on 2026-09-07.

## Preflight

- Owner approval is recorded in `RELEASE-MANIFEST.md`; execution is limited to SPEC-00.
- The normative aggregate and all ten ordered artifact hashes reproduce exactly.
- The accepted PROV-01 source commit is `acf12dafe7499b04995617e5d9c1512775e5ba12`, tree `09014e63aa4d58bd93ff13e39e794548758ba48c`, with integration merge `d31fc8aeab0eae9cd622cad7b6db7b81a3498e87` and owner acceptance `3110bd0` in the current ancestry.
- The PROV-01 source-authority aggregate reproduces from its immutable release manifest as `616b34ab8f748fd247a2ff3cb31f6bfa5d1c3483a48a43f845e07db1751d36cb`. The current integrated path ledger matches every non-deleted current byte, and its 275 changed-file integrated aggregate reproduces as `b10150cd731bf09ed44cc1aec14a8e3f99b16db05f3c677ce805acc6a132c80a`.
- The protected accepted TABS-03 22-path fingerprint reproduces as `59d6e036026ad0c609b1c40a271951671ee24075fbb1aa6637b2f5e4d6a14666`; its implementation and integration commits are present in current ancestry.
- The starting worktree was clean and detached at the approved implementation baseline.
- Active-code inventory confirms the current public shell, transport, proof, route, and child-environment gaps described by SPEC-00. No prerequisite contradiction or execution impossibility remains.

## Slice Ledger

| Slice | Scope | Prerequisite | Acceptance criteria and checks | Builder / builder review | Orchestrator review | Current revision | Deviations / downstream impact | State |
|---|---|---|---|---|---|---|---|---|
| 00A | Runtime endpoint and secure shell origin | Approved baseline and accepted PROV-01 | SPEC §12 00A, §13 applicable checks, Electron unit/dev/package proof, client build, protected-contract regressions | `/root/spec00_slice00a`; final builder gate `slice00a_builder_gate_10` CLEAN after seven material repair rounds and one orchestrator-requested test-harness repair | `/root/spec00_slice00a_acceptance_2` CLEAN; prior reviewer `spec00_slice00a_acceptance_1` was interrupted without a verdict after an extended nonresponsive wait | `SPEC00A-885bcfdbfdad8082`; 52 paths; aggregate `885bcfdbfdad80823273f72178f50249b0b3e94d81df9c543f1203bc7ef7b627` | Bounded test-only `captures-archive.spec.ts` Electron-descriptor fixture; no product fallback, original assertions retained. Existing full-server diagnostic-cleanup test intermittently failed in the complete matrix and passed 15/15 on immediate focused rerun. | accepted |
| 00B | One-use connection authentication | Accepted 00A | SPEC §12 00B, §13 proof/replay/restart/redaction checks, Electron/server public-route proof | `/root/spec00_slice00b`; final builder gate `slice00b_builder_gate_22` CLEAN after fail-forward repair of authentication, lifecycle, redaction, private-role, compatibility, and test-fixture findings | `/root/spec00_slice00b_acceptance_5` CLEAN; four prior orchestrator reviews found and drove repairs for pre-auth manager/recipient/product construction, shutdown/ack/cleanup/redaction, and outbound renderer gating | `SPEC00B-907455ffee1f0504`; 77 paths; aggregate `907455ffee1f05046427edc5cfcd076cbb7aede7afe9519fce173624cdb9cdc0` | Mechanically necessary transport shutdown, logging/redaction, lifecycle projection, standalone FIFO, and PROV browser-fixture adaptations; no product or inbound test authority. Known full-suite diagnostic cleanup flake passed 15/15 in isolation. | accepted |
| 00C | Privileged thread gate and child isolation | Accepted 00B | SPEC §12 00C, §13 trusted/untrusted mutation, passive-read isolation, Fork denial, child canaries, provider/restart/package checks | predecessor `/root/spec00_slice00c`, resumed `/root/spec00_slice00c_resume`, repair `/root/spec00_slice00c_repair_1`; final builder gate `repair1_builder_gate_1` CLEAN | `/root/spec00_slice00c_acceptance_2` found one cross-turn mutation-attribution defect; repaired candidate acceptance `/root/spec00_slice00c_acceptance_3` CLEAN | `SPEC00C-28fef9222a9524ce`; 97 paths; aggregate `28fef9222a9524ce3ac4c772b431c99115cbe2a6cc4d93a3ba2841034c9c5975` | D1–D7 below; all accepted-compatible. Ambiguous simultaneous watcher observations intentionally omit `fileMutations` rather than invent causality. | accepted |

Only one slice writer may be active. Later SPECs and bridge lanes remain out of scope.

## Slice 00A Acceptance

- Electron owns the canonical `fusion-shell://app` document, confines shell assets to that scheme, and rejects shell-origin use by subframes, popups, child windows, stale frames, and the separate `fusion-studio:` content scheme.
- The immutable runtime descriptor is closed, exact-loopback, and main-frame/generation bound. One renderer transport owner now constructs every production WebSocket, HTTP, and server-resource endpoint without a page-origin, relative-URL, port-3001, `localhost`, or other fallback.
- Generation retirement cancels sockets, queued events, HTTP bodies, and all inventoried response owners before reconnect and normal `workspace:init` hydration. Missing or malformed authority produces a visible disconnected shell.
- Server readiness and listening are bound to exact IPv4 `127.0.0.1`; shell CORS and CSP use exact allowlists with no wildcard or `localhost`; navigation and authority-denial logs are bounded.
- Development and packaged smoke evidence exercised exact shell startup and server-port rotation. The builder reproduced 43 Electron, 10 renderer transport, 19/34 focused server, 115 TABS cumulative, 58 PROV client, build, package, live CORS/listen, and restart checks. The orchestrator independently reproduced the key focused matrices, build, candidate identity, protected identity, and the repaired 24/24 production matrix.
- The protected TABS-03 fingerprint remains exactly `59d6e036026ad0c609b1c40a271951671ee24075fbb1aa6637b2f5e4d6a14666`. No accepted TABS attributable path was edited, and no tab, bridge, actor, permission, causal, event, or Provenance authority was introduced.
- Builder review gates 1–6 each found and repaired material authority/restart ownership defects; gate 7 was clean. The orchestrator then required a browser-fixture repair so the accepted production matrix exercised the new explicit runtime authority without a product fallback. Two superseded reviewer runs were interrupted when their reviewed bytes changed; current-byte gate 10 and the fresh orchestrator acceptance review were clean.

## Slice 00B Acceptance

- Electron creates one per-server-launch master and generation, transfers the bounded bootstrap record once through inherited fd 3, closes it before readiness, and exposes proof signing only to the exact current committed shell main frame and generation. Managed and packaged launches fail closed; deliberate standalone launch remains untrusted.
- The proof protocol binds the closed version, generation, connection ID, server nonce, renderer nonce, and expiry shape with HMAC-SHA256 and constant-time comparison. Challenges and proofs are one use; replay, cross-connection, wrong-origin, wrong-frame, wrong-generation, expiry, malformed, reordered, delegated, and request-asserted authority attempts close with bounded fixed results.
- Pending managed sockets are owned by a transport-only registry but remain absent from product session, recipient, and target maps. Product, wire, lifecycle, workspace, manager, filesystem, and database owners are constructed only after proof. Shutdown and restart terminate pending and active upgraded sockets and await exactly-once product cleanup.
- Initialization, payload-bound transition, transport activation, product-session activation, server active state, and authentication acknowledgment now complete in that order. The renderer admits only the proof before acknowledgment; inbound and outbound product frames are bounded, generation-owned, released once after activation, and retired on denial, close, overflow, replacement, disconnect, or generation rotation.
- The live `trusted-shell` role is non-enumerable, connection-private, synchronously retired, and explicitly excluded from product turn contexts, lifecycle state, renderer stores, persistence, UEB, ledgers, errors, and diagnostics. A deliberately standalone connection keeps its existing untrusted read behavior through a separate bounded initialization FIFO that cannot be reached by managed authentication.
- Authentication material and requester-controlled equivalents are suppressed through request descendants, wire/background/reflected errors, renderer console paths, Electron durable logging, and server-child forwarding. Pre-auth managed frames are bounded to 4 KiB before the established authenticated product ceiling is restored; real oversized-frame coverage proves fixed closure without a process crash or payload leak.
- The final builder evidence passed 162 focused server tests, 53 Electron tests, 26 renderer authentication/runtime tests, 58 PROV source tests, 115 TABS cumulative tests, client build, package, isolated PROV live paths, and development and packaged restart/reauthentication smokes. The fresh orchestrator reviewer independently passed 224 server tests, 53 Electron tests, 25 isolated renderer tests plus delayed-auth/restart smoke, client build, and 58 PROV tests.
- The accepted candidate and 77-path fingerprint reproduce exactly as `SPEC00B-907455ffee1f0504` / `907455ffee1f05046427edc5cfcd076cbb7aede7afe9519fce173624cdb9cdc0`. The protected TABS-03 fingerprint remains `59d6e036026ad0c609b1c40a271951671ee24075fbb1aa6637b2f5e4d6a14666`, and the accepted PROV live fixture semantics remain intact.
- Test-only browser adapters reproduce the Electron descriptor/authentication edge for Capture and PROV browser suites without forwarding a synthetic role or proof to production. Logging, thread-lifecycle projection, transport shutdown, and standalone FIFO touches are accepted as mechanically necessary 00B containment. No privileged route guard, Fork policy, child-environment policy, tab, bridge, provenance actor, permission, causal, event, or later-SPEC authority was introduced.
- Fail-forward reviews were material: early gates found pre-proof manager/database construction and product fan-out; later gates found pending-socket shutdown, acknowledgment ordering, cleanup, redaction, diagnostic sinks, payload limits, role retention, accepted PROV fixture compatibility, outbound product races, and standalone initialization compatibility. Every finding was repaired; builder gate 22 and orchestrator acceptance 5 were clean on the same final bytes. Superseded clean results, byte-drift dispositions, one tool-error review, and interrupted reviews are retained as lifecycle evidence but are not acceptance evidence.
- Operational advisory: the checked-in development restart helper ignored worktree-selection arguments during one excluded attempt. The inadvertently launched process was stopped, the unrelated long-running port-3001 server remained untouched, and isolated development/package launchers supplied the accepted runtime evidence.

## Slice 00C Acceptance

- Every decoded thread/session mutation is guarded by the server-owned, non-enumerable `trusted-shell` connection role before manager, persistence, mirror, provider, event, or fan-out work. Trusted New Chat, exact-session resume, Rename, Delete, Touch, Warm, prompt, Stop, response, and turn-metadata paths retain their supported behavior; fixed bounded denial is used for untrusted or stale authority.
- Passive open remains non-activating and non-mutating. Open, list, link, search, and diagnostic reads require the exact current workspace id, canonical root, manager, and connection epoch, preventing retained workspace-A state from serving a workspace-B connection while the replacement manager is pending.
- Per-connection operation leases serialize workspace binding with durable thread actions and provider admission. Activation, ownership transfer, rollback, Stop, process exit, disconnect, workspace retirement, headless automation, and shutdown now retire the exact provider/wire/drain owner without false readiness, stale delivery, cross-client termination, or orphan children.
- Canonical provider events, lifecycle state, audit correlation, ledger work, file-mutation metadata, and requester acknowledgements carry or resolve exact workspace/root/epoch/thread/turn ownership. Replacement binding and shutdown wait for tracked downstream effects rather than allowing old-workspace persistence or fan-out to complete afterward.
- File-mutation collection is fail-closed: a complete workspace/root/epoch/thread/turn tuple targets one live turn; partial tuples are rejected; an ordinary watcher observation is collected only when exactly one live turn matches its workspace/root. Ambiguous simultaneous observations are omitted because SPEC-00 grants no causal attribution authority.
- Public and persisted harness configuration is closed to portable `model` plus nullable `variant`. Explicit null clears the prior variant. Provider session ids, credentials, unknown fields, and Fork-era metadata cannot enter activation. The public Fork route is always unavailable, and stored Fork state is stripped before provider use; retained Fork symbols are inert pending SPEC-01 cleanup.
- One central child-environment builder supplies every inventoried runtime and probe launch. The fail-closed AST inventory covers CommonJS/ESM acquisition, aliases, detached/wrapped references, dynamic/global/built-in access, shadowing, prebuilt or mutable environments, spreads, and computed replacement. It authenticates exactly 16 approved launch sites; probes receive no provider credentials and adapters receive only their documented credential sets.
- Migration 037 adds canonical root and epoch identity to diagnostic persistence; legacy nullable diagnostic rows are deliberately unavailable because they cannot prove an exact live binding. The isolated Agent Tool fixture remains process-provisioned, provider-free, exact-workspace/thread bound, and test-only; it exports no product or provenance authority.
- The predecessor builder repaired the initial privileged-route, passive-read, Fork, environment, workspace-transition, provider ownership, diagnostic, and fixture surfaces through eighteen material gates; its final gate ended only with the prior usage limit and produced no acceptance verdict. The resumed builder then repaired live-provider reuse, drain quiescence, foreign search, Stop/resume races, headless shutdown, legacy CLI emissions, workspace fan-out, audit/ledger/file-mutation routing, adapter iterators/stops, manager root identity, nullable variants, canonical route tuples, and acknowledgement routing. Its gate 12 was CLEAN on `SPEC00C-41cd175edbb7e5a8`.
- Fresh orchestrator acceptance `/root/spec00_slice00c_acceptance_2` found the remaining simultaneous-turn watcher attribution defect. Fresh repair builder `/root/spec00_slice00c_repair_1` produced `SPEC00C-28fef9222a9524ce`; builder reviewer `repair1_builder_gate_1` returned CLEAN after 124 focused tests and the full server suite, and fresh orchestrator reviewer `/root/spec00_slice00c_acceptance_3` returned CLEAN on the same 97 exact paths.
- The accepted 00C manifest is `/tmp/spec00c-repair1.manifest` for this orchestration run, with ordered-path-list SHA-256 `c0cdc629b9aff10b811fa7511d3895305b290fd6b379bea12f9ff9a02fb318e8` and manifest SHA-256 `28fef9222a9524ce3ac4c772b431c99115cbe2a6cc4d93a3ba2841034c9c5975`. All 97 paths authenticated before and after the clean acceptance gate.

## Final Integration

All three slices are accepted on current integrated bytes. The final product/test/documentation union excludes this report to avoid a circular digest and contains 195 paths. Its lexicographically ordered path list hashes to `d4f04fb4df880c41f530f281d3f09d3e0013ebf47f691279a24c7df602acb00f`; the corresponding ordered `SHA-256  path` manifest hashes to `f77820d48883361ee1209a64c309e6e2249b914b4032a00d5294a0a28189b72e`.

| Check | Final current-byte result |
|---|---|
| Normative authority | 10/10 ordered artifacts; exact aggregate `e3d2c49f044cd7f7d5c913a5e03ee3c9f92f50636f8455acb5bad01dc73a1dc7` |
| Accepted slice identities | 00A `885bcfdbfdad80823273f72178f50249b0b3e94d81df9c543f1203bc7ef7b627`; 00B `907455ffee1f05046427edc5cfcd076cbb7aede7afe9519fce173624cdb9cdc0`; 00C `28fef9222a9524ce3ac4c772b431c99115cbe2a6cc4d93a3ba2841034c9c5975` |
| Server full suite | 177/177 suites; 2,495 passed, one intentional skip, 2,496 total after the final 00C repair |
| Final repair-focused server matrix | File-mutation selector 6/6; related audit/metadata/event/watcher/canonical matrix 124/124; orchestrator focused rerun 33/33 |
| Electron tests | Recursive current-byte matrix 115/115; required top-level matrix 53/53 |
| PROV-01 source suite | 58/58 passed |
| TABS-03 exact suites | Public 12/12; cumulative 115/115; production Capture/File 24/24 |
| Client production build | Passed; 1,872 modules transformed |
| Electron directory package | Passed; unsigned Darwin arm64 package with current server bytes |
| Packaged native observer | `PACKAGED_NATIVE_OBSERVER_OK:arm64:141`; ready-descriptor swap path passed |
| Development auth/restart smoke | `TRUSTED_SHELL_AUTH_SMOKE_OK`; authentication preceded hydration and authority rotated after forced server restart |
| Packaged auth/restart smoke | `TRUSTED_SHELL_AUTH_SMOKE_OK`; fresh proof and new endpoint/generation observed after restart |
| Agent Tool live provenance | `AGENT_TOOL_LIVE_PROVENANCE_OK` on unique ports 54082/54130; same-database restart authority stable; external harnesses/watchers disabled and audited |
| File Viewer live provenance | `FILE_VIEWER_LIVE_PROVENANCE_OK` on unique ports 54083/54129 for normal and fact-publication-failure scenarios |
| Static child launch inventory | Exactly 16 approved launch sites; environment and bypass canaries passed |
| Formatting and identity | `git diff --check` passed; accepted 00C manifest and all protected hashes reauthenticated after live checks |

The required checks were not skipped. The one server skip is the established intentional test skip; scenario-selective skips inside the two live launchers are how each launcher runs its mutually exclusive normal/restart or failure scenario and both final launcher markers passed. No external provider network turn was used; deterministic adapter/process and canonical event-chain evidence exercised provider behavior without granting test authority to production.

The TABS production launcher uses the established development server fixture and adds one generated theme token while running. The orchestrator detected that mutation on both invocations and restored `themes.css` to exact protected bytes immediately afterward. Final protected hashes are: theme CSS `a0d366c5f3fb81d60ab9d82257a7d831ddfc4a613bedd5771e47c440059cdbc7`, theme JSON `9114b00bd7d82f12199730fc1ebe639116ba3f8ab7ad748b9df3fec91ad2687f`, File Viewer state `46d7b881feb1fd9babb7d65c72337a5be34caf6fd02f8e7284d3b3d58c901df9`, and diagnostic screenshot `0e944a2a6d11af7864a28f816e160251bab097cd67c017ae24f12f01d4c6d53f`. The unrelated server at port 3001/PID 67185 was never stopped, restarted, or reused by isolated SPEC runtime checks.

Fresh whole-SPEC reviewer `/root/spec00_final_integration_1` returned `CLEAN` with no material findings. It independently authenticated the normative authority, all three accepted slice identities, the exact 195-path union, PROV-01’s immutable source and integrated-baseline identities, TABS-03, protected files, and scope exclusions. It passed 177 server suites (2,495 tests plus one intentional skip), recursive/top-level Electron 115/53, isolated renderer authority 26, PROV source 58, TABS cumulative 115 including public 12, focused 00C authority 95, client build, and final diff checks. One unrelated Office-export timing test failed only during a parallel Electron attempt, then passed 32/32 alone and inside the serialized 115/115 matrix. A first browser invocation inherited the repository default port-3001 configuration; its result was discarded, the material matrix was rerun on isolated port 4177, and the existing port-3001 process was not stopped, restarted, or mutated. The reviewer accepted the exact current-byte package/native/restart/live evidence without repeating those destructive-cost checks and declared SPEC-00 ready for owner review.

## Deviations And Downstream Impact

### 00A-D1 — Browser fixtures consume explicit test authority

- **Original SPEC text:** production has one Electron-owned `fusion-shell://app` origin and one validated descriptor owner, with no page-origin or fixed-host fallback.
- **Actual change:** browser-only Capture and renderer contract fixtures install an explicit test descriptor/transport adapter because Playwright pages do not have Electron preload.
- **Reason:** the accepted Capture/TABS and renderer source suites must exercise the new required authority without weakening production.
- **Files:** `fusion-studio-client/e2e/captures-archive.spec.ts`, `e2e/runtime-transport.spec.ts`, `e2e/shell-auth-client.spec.ts`, and `e2e/support/trusted-shell-browser-fixture.ts`.
- **Tests:** runtime transport/auth source tests, TABS 12/115/24, PROV 58, build, development/package smoke.
- **Observable effect:** tests provide a conspicuous bounded authority fixture; production code has no fallback and still fails disconnected when Electron authority is absent.
- **Risk:** a test helper could accidentally become production authority; source inventory and production builds prove it is not imported by product code.
- **Downstream impact/classification:** `accepted`; test-only compatible deviation, no later correction required.

### 00B-D1 — Transport shutdown, logging, and standalone compatibility integration

- **Original SPEC text:** pending/authenticated sockets must be separately owned, authentication material must not leak, and deliberate standalone reads must remain available without trusted authority.
- **Actual change:** transport registry, deferred product connection, payload boundary, startup/shutdown supervision, logging/redaction, renderer diagnostic projection, and standalone initialization FIFO were integrated across existing shared modules.
- **Reason:** the proof boundary cannot be secure if pending sockets enter product fan-out, cleanup races process exit, requester values reach logs, or standalone traffic falls through the managed-auth path.
- **Files:** the new `fusion-studio-server/lib/ws/{transport-connection-registry,deferred-product-connection,websocket-payload-boundary,server-runtime-activation,request-diagnostic-context}.js` owners plus thin integration in `server.js`, startup/shutdown, logging, connection initialization/router/redaction, Electron renderer/server logging, and focused tests.
- **Tests:** 00B focused server/Electron/renderer gates, full server, recursive Electron, auth replay/expiry/close/shutdown checks, build/package, development and packaged restart smoke.
- **Observable effect:** pre-auth managed sockets remain transport-only; cleanup is awaited; logs carry fixed diagnostics; standalone clients retain only their bounded untrusted compatibility path.
- **Risk:** broad shared lifecycle integration could regress shutdown or diagnostics; full suites and restart/package evidence are green.
- **Downstream impact/classification:** `accepted`; mechanically necessary compatible deviation. No role or proof becomes product/persistent state.

### 00C-D1 — Broader workspace/thread/harness lifecycle integration

- **Original SPEC text:** “Apply the single connection guard before mutation effects,” preserve current chat lifecycle, and prevent unauthorized manager, provider, persistence, mirror, UEB, or fan-out effects.
- **Actual change:** exact workspace/root/manager/epoch leases and ownership were added across thread managers, runtime controllers, session/wire registries, workspace broadcaster, lifecycle, watcher, audit, ledger, shutdown, automation, diagnostics, and isolated fixtures.
- **Reason:** a guard at ingress alone could not prevent stale workspace reads, cross-client provider termination, transfer races, false readiness, or asynchronous old-workspace effects.
- **Files:** 00C’s thread, wire, workspace, event-bus, audit/ledger, watcher, harness adapter, fixture, and corresponding test paths in the 97-path manifest.
- **Tests:** repair-chain matrices, 177-suite server run, transition/transfer/stop/shutdown tests, live Agent/File proofs, package/restart smoke.
- **Observable effect:** every authorized operation and live provider effect uses one exact current binding; old owners quiesce before replacement.
- **Risk:** broader lifecycle coupling and deliberate omission of causally ambiguous simultaneous watcher observations.
- **Downstream impact/classification:** `accepted`; mechanically necessary. SPEC-01 may rely on these invariants but may not reinterpret them as group, bridge, provenance, or tab authority.

### 00C-D2 — Diagnostic migration 037

- **Original SPEC text:** diagnostics must remain bounded, explicit, current-workspace reads; no Thread Group or Provenance schema may enter SPEC-00.
- **Actual change:** migration `037_harness_diagnostic_binding_identity.js` adds canonical project-root and workspace-epoch columns for diagnostic binding.
- **Reason:** workspace id/thread id alone cannot prove that a persisted diagnostic belongs to the exact current root and connection generation.
- **Files:** migration 037, diagnostic service/handler, migration and diagnostic tests.
- **Tests:** migration inventory, diagnostic service, public diagnostic route, A-to-B stale-read canaries, full server.
- **Observable effect:** new diagnostics are exact-bound; legacy nullable rows return unavailable rather than being guessed current.
- **Risk:** old diagnostic rows are intentionally unreadable through the exact route.
- **Downstream impact/classification:** `accepted`; mechanically necessary, limited to diagnostic retrieval and migration ordering. It creates no general provenance schema.

### 00C-D3 — Migration inventory oracle update

- **Original SPEC text:** expected changed areas are non-exclusive and required verification must cover current integrated migrations.
- **Actual change:** `fusion-studio-server/test/event-registry/migration.test.js` recognizes migration 037.
- **Reason:** the deterministic migration oracle must include the new schema step.
- **Files/tests:** that test path; full migration and server suites.
- **Observable effect:** stale or missing migration registration fails the suite.
- **Risk:** none beyond ordinary test maintenance.
- **Downstream impact/classification:** `accepted`; test-only integration, no downstream correction.

### 00C-D4 — Six Chat source-of-truth pages updated

- **Original SPEC text:** code-standards compliance and the current Chat architecture remain binding; expected changed areas did not enumerate documentation.
- **Actual change:** Overview, WebSocket Protocol, Thread Actions, Testing and Operations, Runtime Model, and Structure now document shell trust, exact route/lifecycle ownership, child environments, Fork closure, diagnostics, and fail-closed watcher attribution.
- **Reason:** the active Chat source of truth must describe the implemented contract that subsequent work consumes.
- **Files:** the six modified pages under `ai/RC-MacAir-15/Wiki/007-Chat_System/`.
- **Tests:** source inventories plus all behavioral suites cited by the pages.
- **Observable effect:** documentation matches current implementation, including omission of ambiguous/partial file observations.
- **Risk:** future work may overread internal exact-route metadata as new public authority; the pages explicitly deny that inference.
- **Downstream impact/classification:** `accepted`; expected documentation integration. Later SPECs consume but may not expand these authorities implicitly.

### 00C-D5 — Canonical incremental events carry the exact internal route tuple

- **Original SPEC text:** current chat lifecycle must not regress, while authority must fail before stale/cross-workspace effects.
- **Actual change:** canonical text, thinking, tool, subagent, step, terminal, and applier paths carry immutable workspace id, canonical root, epoch, thread, turn, and drain ownership needed by exact broadcaster lookup.
- **Reason:** exact delivery otherwise drops legitimate incremental output or permits a transferred/stale owner to publish.
- **Files:** canonical chat text/tool/terminal/applier modules, message router/process manager/broadcaster, CLI adapters, and focused tests.
- **Tests:** real applier-to-event-bus-to-process-manager-to-broadcaster chains, adapter iterator/stop tests, transfer/exit/retirement canaries, full server and live Agent proof.
- **Observable effect:** valid content/tool streams continue to the exact current client; stale streams are suppressed. Public client payload shapes are unchanged.
- **Risk:** internal route metadata must not be treated as actor, permission, causal, or canonical-admission proof.
- **Downstream impact/classification:** `accepted`; bounded cross-slice adaptation, no downstream correction.

### 00C-D6 — Audit-derived acknowledgements use exact recipient routing

- **Original SPEC text:** requester delivery follows the authorized product mutation and must not replay or broaden it; current persistence behavior must remain intact.
- **Actual change:** `exchange_metadata` and `chat-turn:saved` acknowledgements resolve the exact originating workspace/root/epoch connection after audit persistence.
- **Reason:** a bare thread-id broadcast collides across workspaces, while dropping acknowledgements leaves the active renderer stale after successful persistence.
- **Files:** audit subscriber, event/effect owners, workspace/wire broadcasters, canonical applier and integration tests.
- **Tests:** real audit-save-to-scoped-broadcaster coverage, same-thread-id workspace canaries, held-effect drains, full server/live proofs.
- **Observable effect:** the correct renderer receives saved exchange identity/sequence/metadata; unrelated clients receive nothing.
- **Risk:** delivery failure can still leave a successfully persisted mutation requiring later hydration, as the SPEC permits.
- **Downstream impact/classification:** `accepted`; mechanically necessary, no schema or public message-shape expansion.

### 00C-D7 — Inert Fork-era symbols remain

- **Original SPEC text:** “Fork is not a supported capability in this implementation”; legacy cloning must be inaccessible, and SPEC-01 remains out of scope.
- **Actual change:** the public route and every inbound/stored/runtime activation path fail closed or strip Fork state, but some unreachable service/provider symbols remain in source.
- **Reason:** deleting the broad legacy implementation belongs to SPEC-01; SPEC-00 owns reachability and authority closure only.
- **Files:** Fork denial/config policy tests and retained legacy OpenCode/service code identified by the 00C audit.
- **Tests:** unconditional public denial, unknown/inbound config rejection, stored-state sanitization, zero provider/persistence/event effects.
- **Observable effect:** no trusted or untrusted caller can Fork or clone a provider session.
- **Risk:** maintenance/readability residue, not runtime authority.
- **Downstream impact/classification:** `accepted` advisory. SPEC-01 should remove the inert symbols without weakening SPEC-00’s denial.

### Final impact assessment

All deviations are compatible with the approved SPEC and require no owner ruling. SPEC-01 inherits one explicit cleanup: remove inert Fork-era implementation symbols while preserving unconditional unavailability. BRIDGE-01 and BRIDGE-02 receive no authority from this work. SPEC-00 exports only trusted Fusion shell origin, runtime endpoint, bootstrap/proof, connection role, privileged guard, restart/redaction, child-environment, and the exact lifecycle mechanics necessary to enforce them. It exports no tab, bridge, provenance actor, permission, causal, admission, or event authority.

No temporary production adapter was added. Test-only browser and deterministic provider fixtures remain deliberately conspicuous and production-inert; their removal criterion is replacement by equally isolated evidence that exercises the same Electron/adapter boundaries. Residual risk is limited to documented omission of ambiguous simultaneous watcher observations and normal unsigned development packaging warnings. No required check is skipped and no later SPEC has begun.
