# SPEC-01 — Startup Integrity Repair and Current-Build Completion

- **SPEC ID:** `CHAT-AR-REPAIR-01`
- **Planning ID/revision:** `CHAT-AR-REPAIR-PLAN-01`, revision 1
- **Status:** provisional authored candidate; independent worker-handoff, candidate-stage and release review, then owner implementation approval remain required.
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`
- **Memory/bundle:** `launchpad/chat-integration-and-retirement/planning/startup-integrity-repair/` under that home.
- **Product checkout:** `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`; dirty current bytes are identified in [SOURCES.json](SOURCES.json). HEAD alone does not identify them.
- **Author/manager:** runtime child `/root/repair_candidate_stage/repair_author`, assigned by `/root/repair_candidate_stage`; Codex side chat (ephemeral). This is not the registered folder main.
- **Normative set/order:** this SPEC and `SOURCES.json`; one SPEC, ordered slices R1 → R2 → R3. `CANDIDATE.json` identifies bytes only. Coordination, reports and approval receipts are outside the normative set.

## 1. Outcome, authority and relationship to the current job

Repair the current startup composition so the preserved workspace automation pipeline is registered under one valid effect identity and enters view-owned work only after readiness admission while holding the existing view-readiness lease. Keep Chokidar and its retired consumers absent. Prove the repaired production boundaries with executable regression tests, the guarded production-server provenance lane and the still-required real authenticated OpenCode conversation/persistence/reopening scenario.

This is an additive repair contract for unfinished [CHAT-AR-SPEC-01](../chokidar-retirement-and-harness-launch/spec/SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md), approved candidate `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`, original SPEC hash `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`. Preserve its normative bytes and [owner receipt](../chokidar-retirement-and-harness-launch/spec/OWNER-APPROVAL.md). The original S3 preservation and test contracts continue; its earlier `accepted` report is dated evidence now contradicted at the startup seam. S4 and whole-job final integration remain unfinished. Original A-05's removal of a replacement-detector/readiness prerequisite concerns future watcher/snapshot delivery; it does not replace the retained view migration/operation lease or authorize a bypass of that owner. This repair does not reopen original S1/S2, older CHAT-SIMPLE owner acceptance, SPEC-06 acceptance with residuals, merge/deployment receipts or unrelated consumer baselines.

| Authority | Classification | Binding effect |
|---|---|---|
| Direct owner instruction “Let's create a repair SPEC,” carried in [PLANNING.md](PLANNING.md) and [INPUT-PACKET.json](INPUT-PACKET.json) | `owner_decision` | Author and independently review one repair candidate. It does not approve implementation. |
| CHAT-AR [D-008](../../DECISIONS.md#d-008--narrow-to-the-current-build-and-separate-follow-on-harness-work), current INTENT | `owner_decision` | Finish fixing this current build and existing checks here; route subsequent broad harness work to `../chat-harness-repair-and-testing/TICKET.md` relative to the domain folder. |
| Original SPEC §6.S3, §6.S4, §7, §8 | `spec_contract` | Preserve components/actions, post-listen event/cron triggers, runner monitor, retirement and independent save/tool evidence; actual authenticated OpenCode response/exchange/readback and final docs/review remain mandatory. |
| Current Chat overview and routed standards in §3 | `source_of_truth_contract` | Server owns runtime admission, prompt acceptance, durable identity and exchanges. Use existing owners, public-route tests and bounded changes. |
| Current source, saved raw probe/results and guarded-lane log in §2/SOURCES | `active_code_constraint` | Establish the two startup regressions and current verification gap. Audit conclusions/pass labels alone do not establish implementation correctness. |
| Keep `workspace-automation-pipeline` as the sole effect name and reuse `startWorkspacePipelineWhenReady` | `implementation_choice` | Align existing startup/registry/fixture ownership; restore view admission without a watcher. No public protocol, governance schema or product capability is added. |

No material new product proposal or owner question is identified. A materially broader remedy discovered during implementation must return through the implementation manager and owner; do not convert it into an implicit amendment.

Accepted bounded input: [CLOSURE-AUTHORITY-I01.md](reports/CLOSURE-AUTHORITY-I01.md), SHA-256 `bf607733aede2a218999966a6624d4bd43c55a1a9f48934b4d412862f6e8d5a5`, accepted by the stage manager after fresh worker-handoff review `/root/repair_candidate_stage/i01_handoff_review` ([report](reports/CLOSURE-AUTHORITY-WORKER-REVIEW-01.md), SHA-256 `b7c59f5c12da52fdc5dad96ef87087f4038184813a21e8481ef9c87fdf21a042`). Its original-authority locators and ownership/closure synthesis are propagated in §1, §5 and §7–9. It supplies no author, candidate-stage, release or implementation verdict; IA-01/IA-02 code substantiation remains the author's direct-source/probe work below.

## 2. Independently checked evidence and its limits

Raw sources: [audit probe](../../reports/integrity-audit-2026-10-05/startup-contract-probe.cjs), [saved result](../../reports/integrity-audit-2026-10-05/startup-contract-result.json), [source evidence](../../reports/integrity-audit-2026-10-05/SOURCE-EVIDENCE.json), [guarded lane failure](../../reports/integrity-audit-2026-10-05/provenance-live.log), and current product/test bytes in SOURCES. The author read the probe, inspected the real source and reran only that permitted benign probe in a disposable OS temporary directory. Its output again reported the following. The author did not run product tests/builds, operate apps or call a provider.

| Finding | Direct source and raw observation | Consequence and limit |
|---|---|---|
| IA-01, effect identity mismatch | `lib/startup.js:669` defines `workspace-automation-pipeline`. `lib/testing/isolated-provenance-runtime.js` expected array contains `workspace-watcher-trigger-pipeline`; `createEffectRegistry` rejects unknown names before invoking the factory in both modes. The real normal runtime probe throws `unknown isolated provenance startup effect: workspace-automation-pipeline`; factory remains false. | The post-listen catch logs/continues, so normal server startup can resolve without components/triggers/runner. Isolated final audit also requires the missing old name and cannot complete. Guarded-lane log shows exit 1 before browser tests; its redacted console markers alone cannot identify the exception. |
| IA-02, lost readiness admission/lease | Startup directly calls `_startPipeline`; retained `views/readiness-startup.js` would ensure readiness and acquire/release the runtime lease. The exact current factory resolves issue/agent roots and script, loads components/triggers and starts runner. With a real installed unavailable readiness owner and benign downstream effects, the saved/rerun probe reaches those four effects with zero added readiness requests and zero leases; the existing wrapper returns unavailable with zero factory calls. | IA-01 masks this in ordinary startup. Name correction alone would expose the bypass. This is a controlled seam reproduction, not a live corruption incident or proof of the owner's render-delay cause. |
| Earlier workspace readiness is insufficient | `workspace-controller.start()` awaits `ensureRegisteredWorkspaceReadiness`, whose per-workspace catch converts failures into unavailable statuses. The controller does not gate this later pipeline on that return value. It holds no later pipeline lease. | Reuse the operation-level wrapper; a registry startup pass cannot replace admission and protection during root/script resolution. |
| Existing tests miss the composition | Watcher-retirement and event-registry startup tests require the wrapper name absent and new name present in text. Isolated-runtime tests iterate their own expected array. The old unavailable test calls only the now-disconnected wrapper. | Keep useful source absence/order checks but replace the incorrect absence requirement and add executable tests through `startup.start()` and its listen callback. Helper tests/AST extraction alone cannot release this repair. |

The rerun result is in the disposable root recorded in SOURCES and author report. It provides diagnostic reproduction only. Future implementation must deliver full startup and real-server proof. Existing full-suite/build/34 fixture passes are genuine dated evidence from their logs, but do not prove these seams or live OpenCode. The original New Chat repair hashes are preserved baseline, not a new smoke pass. Renderer delay, high DOM count and resource use have no proved cause here.

| Issue | Authority/affected scope | Candidate lifecycle and release condition |
|---|---|---|
| IA-01 | Original S3 preservation; startup/registry/guarded audit | `propagated_pending_review`: bounded R1 contract authored; requires reviewed implementation and positive production-boundary proof. Not repaired by planning. |
| IA-02 | Retained readiness owner and original S3 preserved consumers; startup/view leases | `propagated_pending_review`: bounded R2 contract authored; requires positive unavailable/ready/retirement evidence independent of IA-01 masking. |
| REPAIR-EV-01 | Testing/Smoke standards; source-only and orphan-helper coverage | `propagated_pending_review`: R1/R2 negative and production-entry tests plus R3 actual-server lane required. |
| REPAIR-EV-02 | Original §6.S4/§8.8 and current manual-test ownership | `open`: actual authenticated OpenCode/exchange/reopen proof remains mandatory; retain attributed expected manual wait or runtime blocker until §7 is met. |
| REPAIR-INT-01 | Original S3/S4 ledger, RV2-A01 docs and final integration | `propagated_pending_review`: explicit writer/reassessment/adoption/final gates in §8–9; no inferred ownership transfer or current job completion. |

## 3. Guidance coverage and implementation owners

All paths in this section are under the product checkout. Read current versions completely before implementation; refresh hashes and reconcile exact newer direction. SOURCES records the author's coverage and hashes; standards remain external authorities rather than copied rulebooks.

| Fully read authority | Application to this SPEC |
|---|---|
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md` | Reuse existing server owners; smallest useful abstraction; preserve later repair options and bounded deferrals; owner attention at material intent and approval gates. |
| `Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` under the same machine root | Router, file responsibility and governed-capability rule. No blanket exemption is assumed. |
| Routed `001-Architecture_Routing/PAGE.md` | Existing startup/effect/readiness owners fit. Do not create another startup dispatcher, public route or generic process service. |
| Routed `002-Frontend_UI/PAGE.md` and `003-State_Management/PAGE.md` | Preserve New Chat selection/save-ACK behavior, explicit view/group/thread/surface identity, server readiness ownership and normal hydration. No UI redesign or duplicate client readiness gate. |
| Routed `004-WebSocket_Protocol/PAGE.md` | Preserve authenticated canonical public routes and production recipient/activation ordering; no protocol extension. |
| Routed `005-Universal_Event_Bus/PAGE.md` | Keep legacy triggers separate from governed admission; retain exact save/tool publisher, subscriber, grant and shutdown boundaries. Do not revive broad file events or add telemetry. |
| Routed `006-Harness_Adapters/PAGE.md` | Actual OpenCode smoke uses the existing adapter; no provider syntax in UI, fake provider substitution or inferred success from process launch. |
| Routed `007-Persistence_And_Metadata/PAGE.md` | Existing readiness/view registry and ThreadManager/HistoryFile own mutation/readback. No DB migration, manual production SQL writes or duplicate persistence owner. |
| Routed `008-Testing_And_Smoke_Slices/PAGE.md` | Test public startup and chat routes, state/effects and durable readback; do not mock away registry/readiness composition. |
| `Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` | Required Chat overview; preserve acceptance, authentication, passive open, prompt/turn identity, completed exchange ownership and history hydration. |
| `Wiki/007-Chat_System/002-Harness_And_Event_Flow/001-Harness_Boundary/PAGE.md`, `005-Testing_And_Operations/PAGE.md`, `006-Runtime_Model/PAGE.md` | Provider normalization, safe runtime evidence, ordinary shell route and exact same-thread reopening; fixture passes have their stated limits. |
| `Wiki/010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md`, `003-Provenance_Model/PAGE.md`, `003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md` | No new schema, producer, subscriber grant or governed executor. Four existing save/tool facts and legacy operational automation remain distinct; observation does not imply causation. |
| `Wiki/002-Server_And_Runtime/006-Background_Services/PAGE.md`, `Wiki/003-Automation_And_Agents/005-Background_Agents/PAGE.md` | Correct post-listen pipeline claims against repaired evidence; retain interim Apple absence, independent Google polling and legacy-worker limits. |

The routed-page base is `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/`. No inactive machine copy is merged. No rule is superseded by this candidate. `startup.js` is an existing >400-line composition file; keep wiring-only repairs there and reuse the cohesive readiness module. Put new tests/fixture support in focused files, splitting fixture setup from assertions when needed. Do not undertake unrelated startup decomposition.

Existing owner graph: `server.js` → `startup.start` → real isolated effect registry → `views/readiness-startup` → runtime/coordinator/relocation owner → `_startPipeline` → existing component/actions/trigger/cron/runner consumers. The workspace controller supplies the canonical active workspace ID/root. The guarded provenance launcher/Playwright lane owns isolated profile/workspaces and audit expectations. Electron/server shell authentication and existing Chat services own public smoke; the renderer never substitutes its own admission or exchange writer.

## 4. Requirements, preservation and bounded scope

| ID | Requirement | Slice/evidence |
|---|---|---|
| REQ-01 | Exactly one valid `workspace-automation-pipeline` identity across startup, real registry and guarded browser expectation. Unknown/duplicate names still reject; isolated mode still blocks all factories. | R1 startup canaries and strict audit |
| REQ-02 | At the post-listen production call site, capture the active root/workspace ID through existing controller ownership, ensure readiness, acquire the verified lease and hold it through all synchronous pipeline initialization. Unavailable/preparing/retiring readiness cannot reach view-root/script/component/trigger/runner work. | R2 startup.ready/unavailable/lease tests |
| REQ-03 | Normal ready startup actually reaches preserved components, action wiring, event/cron registration and runner monitor. No active workspace keeps the established no-op result. Preserve existing bounded exception handling; release an acquired lease on success or failure. | R1/R2 effect/state assertions |
| REQ-04 | Keep Chokidar/deleted watchers/file-change filters, old screenshot source refresh, Apple directory callback and watcher shutdown hooks retired. Boot theme and CLI bootstrap remain. | R1–R3 absence/order/preservation matrix |
| REQ-05 | Tests exercise actual `startup.start()`/listen registration with real effect registry and real readiness wrapper/runtime/coordinator. Include failing preimage evidence and faithful guarded actual-server integration. | §6 negative/positive matrix, R3 lane |
| REQ-06 | Ordinary authenticated UI New Chat/activation and real OpenCode prompt complete, persist exact exchange and reopen same thread on repaired bytes using isolated profile and registered/selected scratch workspace. First and second New Chat select the exact usable chat. | R3 §7; mandatory gate |
| REQ-07 | Retain original implementation provenance, reassess contradicted S3 confidence, record every repair/test deviation and affected documentation/source-map adoption, refresh final integration before owner acceptance. | R3 §8–9 |

| Preserved contract | Required proof / unchanged scope |
|---|---|
| Components/actions and optional issue script | Ready startup test reads scratch modal and issue-script marker under lease, observes existing action wiring. Missing optional script keeps existing bounded behavior. No autonomous ticket dispatcher is silently activated. |
| Chat/ticket/agent/system event triggers | Production startup fixture has benign `TRIGGERS.md` blocks for all four; real loader registers listeners and each topic reaches the expected scratch action once, with no duplicate registration. Unit loader regressions also pass. |
| Cron and runner monitor | Ready fixture registers a cron block; actual scheduler using controlled time invokes only the scratch ticket creator. Observe runner heartbeat start through its existing owner with controlled timers; no actual worker/provider is launched. Unavailable case reaches neither. |
| Theme/CLI bootstrap, workspace handling and shutdown | Existing startup ordering and shutdown tests pass. No changed signal/drain ordering for turns, audit, ledger, subscriptions or databases; no watcher callback reinstated. No new global fail-fast policy or retry system. |
| Direct screenshot and Google Calendar | Correlated direct saved PNG/protected-view tests and existing no-Apple-wait/Google opt-in assertions pass. Gallery/ribbon/pending attachment remain; Google polling/broadcaster remain; cached Apple rows can stale. No external Calendar call in automated canaries. |
| Legacy ledger/history | `file:changed` remains excluded; workspace/thread history and drain persist. Do not globally suppress the topic or erase records. |
| Independent save/tool provenance | Existing required prewrite save protections, optional context, admitted post-tool observations, shadow checkpoints, projection/recovery and shutdown remain. Guarded normal/fact-publish-failure real-server scenarios and focused save/tool route checks pass. No new event/subscriber/grant or schema. |
| New Chat/Chat identity | Preserve current reviewed handler/fixture behavior, correlation/Legacy/view isolation, save/conflict/ACK and adapterless exact pending open. Selection fixture tests plus actual public smoke pass. |

Non-goals: provider/Together retry, warm-up/error/liveness/accepted-without-exchange redesign; a rendering-performance program; snapshot/scanner/native Calendar replacement; new logging, health subscriptions or telemetry; protocol/persistence schema changes; history cleanup; rollback to retired watchers; Git/Alpha/monitoring/checkpoint operations. D-003 keeps the historical 45-minute soak waived while preserving its unperformed historical status; this repair does not reinstate a soak or a descriptor stress program. Concrete in-scope failures may receive the mechanically necessary local repair under original §6.S4, with fresh gates and deviation accounting. A wider remedy requires owner routing and does not waive required acceptance.

## 5. Preconditions, execution boundaries and slice policy

Only an independently reviewed, owner-approved current candidate may execute. An owner assignment of the reviewed exact candidate counts as approval under the shared planning contract; record its receipt before dispatch. Original approval does not silently approve these new normative bytes. Planning stops at handoff.

Before edits or app operations, implementation verifies memory CWD/controller home, actual root/branch/HEAD and scoped current hashes, dirty-path ownership, applicable instructions, current standards and original task/writer status. Original orchestrator `01a1042c-09df-7473-a1e1-f458eee6b93d` and source task `01a0ea32-f152-77a2-afc2-b73e8976685a` are retained ownership pointers, not this author's identity. Recheck them; an old idle observation is not a transfer. The owner-facing manager arranges a bounded acknowledged continuation or explicit transfer before a second writer overlaps product paths, original ledger or manual-test operations. Do not message/resume tasks solely because this SPEC exists.

R1 and R2 both affect startup composition; execute sequentially with one active writer. R3 consumes their materially clean integrated outputs. Do not parallelize those overlapping writers. No new roadmap hierarchy or following SPEC is introduced.

Each slice uses a fresh `mc-spec-slice-builder`, which implements its assigned slice including mechanically necessary omitted integration, self-reviews, runs required checks, records every deviation and downstream effect, and obtains a materially clean builder-owned review before returning `READY_FOR_ORCHESTRATOR_REVIEW`. Builders may spawn only fresh `clean-room-reviewer` children, never another builder. Stop at the first clean pass; repair forward without an arbitrary pass ceiling. The SPEC orchestrator independently inspects changes and uses fresh `clean-room-reviewer` passes, stopping at the first clean pass and otherwise routing repairs until clean. New slices use new builders. Material acceptance repairs return through a builder, fresh builder-owned review and fresh orchestrator-owned review. Every descendant inherits the invoking root model and reasoning effort; do not pin/override them from a profile. Verify actual runtime capabilities separately.

## 6. Dependency-ordered executable slices

### R1 — Register and invoke the preserved automation effect

**Own:** `fusion-studio-server/lib/testing/isolated-provenance-runtime.js`, minimal wiring in `lib/startup.js`, `test/runtime/workspace-startup-integrity.test.js` (new), affected `test/runtime/isolated-provenance-runtime.test.js`, watcher-retirement/startup-integration assertions, and `fusion-studio-client/e2e/provenance/file-viewer-live-resource.spec.ts` expectation. Test fixture support may be added under `test/runtime/fixtures/` with one fixture responsibility. Do not copy or replace the entire startup implementation.

Keep `workspace-automation-pipeline` as the sole current name. Replace the old expected name in the real registry and guarded browser expectation. If a shared private identity constant is useful, justify its demonstrated consumers; a source-string assertion or iterating that shared list cannot be the only test. Keep strict unknown/duplicate validation and exactly-once start accounting. Do not remove the automation effect from audit coverage or exempt it from guards to make the lane pass.

Add an executable integration canary invoking the exported actual `startup.start()` with its normal post-listen callback and the actual disabled/normal effect runtime. Use disposable marker-owned profile/DB/workspace, unique loopback port and isolated module state; fixtures contain no credentials or real workspace roots. Unrelated external owners may be benign stubs, but do not replace startup, effect definition/registry, listen callback, pipeline dispatch or downstream acceptance assertions. Assertions must show real normal-mode invocation reaches the preserved pipeline, rather than merely seeing a healthy listen/return. R2 adds full ready admission coverage to this same production boundary. Do not introduce new public instrumentation/protocol.

Exercise actual startup registrations in isolated-v1 as well: all seven expected startup effects have exactly one start/blocked request, zero factory invocations/prohibited attempts, with observation guards installed and zero global watch/child attempts. Missing, unknown, duplicate, or attempted prohibited effect fails audit. Use separate process/module state and restore guards/timers/listeners on success/failure. Existing isolated-runtime tests remain supporting coverage; the guarded real-server lane in R3 supplies full bootstrap integration.

**Required negative proof:** before editing, save exact audited startup/runtime/readiness source bytes in a marker-owned disposable preimage fixture and confirm their SOURCES hashes; do not reconstruct old bytes from memory or reset the checkout. If current sources have advanced and exact preimages are unavailable, report that evidence gap and recover the bounded raw source through the manager before claiming negative proof. Run the new startup-entry canary against exact audited startup/runtime bytes and retain the expected failing assertion that automation was never invoked; retain the real registry rejection. Do not mutate the shared checkout or suppress that error. The saved AST probe is supporting diagnosis, not this canary. Tests pass only on repaired current bytes. Record fixture/source/test hashes and exact commands/results.

**Focused command**, from `fusion-studio-server/` after fixture implementation:

```sh
npx jest --runInBand --runTestsByPath test/runtime/workspace-startup-integrity.test.js test/runtime/isolated-provenance-runtime.test.js test/watch/watcher-retirement.test.js test/event-registry/startup-integration.test.js
```

Pass requires executable production registration/invocation assertions and isolated refusal/accounting, not only textual matches. Maintain useful ordering/retirement checks. Remove tests that assert the readiness wrapper must be absent when R2 reconnects it.

### R2 — Admit view-owned startup under the existing lease

**Own:** minimal `lib/startup.js` import/call wiring to retained `lib/views/readiness-startup.js`; that wrapper only if a mechanically necessary await/error detail is demonstrated; startup-integrity tests/fixture support plus relevant readiness/retirement assertions. Existing readiness runtime/coordinator and relocation service remain owners; no alternate readiness service or filesystem watch is introduced.

Inside the same registered effect factory, return/await `startWorkspacePipelineWhenReady({ sessions, getProjectRoot, getWorkspaceId: workspaceController.getActiveWorkspaceId, startPipeline: _startPipeline })` or its equivalent through the same owner. Identity/root must come from the established workspace controller; never use another selected UI view or infer workspace identity from a path. Keep operation-level ensureReady and `withViewReadinessLease`. All existing view-root/script resolution and synchronous pipeline work occurs inside that lease. If any necessary integration becomes asynchronous, await the complete initialization inside the callback so release cannot outrun it. Do not enlarge the lease to the lifetime of running cron/runner work.

Unavailable/preparing/retiring/conflicted readiness makes zero downstream initialization effects and returns existing bounded `view_registry_unavailable`; startup's established bounded error behavior remains. With no active workspace, preserve the no-root no-op. Non-relocation pipeline errors release the lease and propagate to the existing startup catch; do not swallow them in a new success marker. Do not retry/migrate outside the coordinator or invent a watcher-replacement prerequisite.

Extend the real startup-entry canary. Keep real effect registry, wrapper/runtime/coordinator and view resolution. The existing relocation fixture/service can supply verified ready or genuine conflict fixtures; spies may wrap real methods to observe counts but must not fabricate readiness/leases. If an unrelated startup owner needs a stub, list it and why it is outside the changed seam. Keep actual component/trigger/cron consumers for effect proof; harmless scratch script/actions and controlled timers contain effects.

| Case | Required assertion through actual startup/listen registration |
|---|---|
| Ready registered scratch workspace | ensureReady precedes lease acquisition; correct root/workspace/machine; lease count is one while view roots/scripts, components, triggers and runner start; invocation happens once; count returns to zero after initialization. Real loader parses scratch event/cron definitions and consumers behave as §4 requires. |
| Earlier registered-workspace pass fails | A genuine unavailable/conflict case is retained by controller; the later operation refuses pipeline effects. This must not pass only because IA-01 prevents every invocation. |
| Preparation held pending | No consumer runs before readiness resolves. After verified resolution, one lease protects initialization and then releases. |
| Retirement/lease contention | Trigger the real coordinator retirement during admitted initialization through a controlled scratch callback: removal waits while the lease is held, rejects new leases/late admission, and completes after release. Include an unavailable/retiring-before-acquire case with zero effects. Preserve relocated canonical root and ID; no old-root script is loaded. |
| Pipeline throws / no workspace | Inject harmless downstream initialization failure and assert finally-release plus existing error branch. Root/ID null causes no view work and no lease. |

**Masking control/negative proof:** IA-01 prevents unmodified audited startup from reaching IA-02. Retain the exact audited-byte probe result (direct factory reaches effects while wrapper declines). Additionally run the new startup-entry readiness canary on a disposable copy of those audited bytes with only the effect-name mismatch corrected; record that sole identity-only delta and every hash. It must fail because unavailable readiness still reaches consumers or ready initialization lacks a lease. Never present that counterfactual as pristine audited production. Run the same case on repaired current bytes with no changed-seam mocks; it must pass. This isolates the masked defect instead of allowing a name failure to masquerade as readiness safety.

**Focused command**, from server:

```sh
npx jest --runInBand --runTestsByPath test/runtime/workspace-startup-integrity.test.js test/views/view-readiness-coordinator.test.js test/views/view-relocation-recovery.test.js test/triggers/trigger-loader.test.js test/triggers/cron-scheduler.test.js test/event-registry/startup-integration.test.js test/watch/watcher-retirement.test.js test/shutdown.test.js
```

Pass requires actual startup.ready/unavailable/held/retirement/release proof and unchanged retirement/shutdown invariants. An orphan-helper test is insufficient.

### R3 — Validate repaired integration, actual OpenCode and evidence adoption

**Own:** implementation evidence under `planning/startup-integrity-repair/implementation/`, affected production-boundary fixture integration only if required, documentation changes in §8 after focused behavior is stable. Coordinate original report/ledger incorporation with its owner. Any material code repair found here returns through a fresh builder and both independent gates.

Run the exact guarded production-server lane from `fusion-studio-client/`:

```sh
npm run build
node e2e/provenance/run-file-viewer-live.mjs
```

Both `normal` and `fact-publish-failure` scenarios must complete. Preserve marker/nonce ownership checks; fresh non-3001 ports; NODE_ENV=test, Test-Provenance machine; owned isolated DB/profile and exactly two scratch registry workspaces; `reuseExistingServer: false`; startup effect coverage and zero factory/watch/child attempts; harness runtime effect blocked accounting; locked registry authority/provenance assertions; mediated-save preimage and postwrite recovery; narrow refresh/readback; protected developer profile/DB/workspace/output hashes and marker-verified cleanup. Update the expected automation identity consistently; do not weaken guards, mock the production server, turn off failed assertions or omit a scenario. Keep logs safe; fixed redacted error markers are not causal proof. Preserve failing artifacts and exact failure boundary if it still cannot start.

From `fusion-studio-server/`, run:

```sh
npx jest --runInBand --runTestsByPath test/runtime/workspace-startup-integrity.test.js test/runtime/isolated-provenance-runtime.test.js test/watch/watcher-retirement.test.js test/event-registry/startup-integration.test.js test/views/view-readiness-coordinator.test.js test/views/view-relocation-recovery.test.js test/ledger/event-ledger.test.js test/screenshot-file-capture-request-id.test.js test/screenshot-protected-view-path.test.js test/calendar/apple-listener-retirement.test.js test/triggers/trigger-loader.test.js test/triggers/cron-scheduler.test.js test/shutdown.test.js test/chat-metadata/file-mutations-collector.test.js test/ws/file-save-route.test.js test/subscriptions/file-provenance-bootstrap.test.js test/resources/file-provenance-integration.test.js test/agent-provenance/fact-authority-and-ledger.test.js test/wire/canonical-chat-tool-events-provenance.test.js
npm test -- --runInBand
```

`npm test` includes `pretest` native-observer build; report it and all warnings. From client, use a freshly reserved unoccupied safe `CHAT_TRANSPORT_TEST_PORT` (never 3001) with the isolated architecture lane:

```sh
CHAT_TRANSPORT_TEST_PORT=<reserved-port> npx playwright test --config=playwright.chat-architecture.config.ts e2e/threaded-chat-host.spec.ts e2e/chat-send-transport.spec.ts
```

Record the actual numeric port and command. This lane is fixture coverage for the preserved New Chat repair, not live UI fallback authorization. Do not use default config that can attach to an owner server. Run the retirement import/dependency/source sweep in original §6.S3; verify no `watch/core`, workspace/screenshot/Apple watcher, Chokidar import/direct dependency or abandon hook in production, while the readiness wrapper now remains. Do not infer watch absence from an effect name alone.

Complete §7 on current repaired bytes after these checks. Finish §8 evidence/docs and obtain fresh final integration §9. No skipped required check can become a pass through old reports. If native UI/credentials/external provider/runtime is unavailable, return `RUNTIME_BLOCKED` or the exact expected owner manual wait with evidence; keep whole original S4/job acceptance held.

## 7. Required public OpenCode scenario and runtime isolation

The source task retains owner-manual test coordination; Playwright/CDP live UI fallback permission is ungranted. Preserve that choice. An isolated automated regression suite does not grant input authority over the owner app. Use owner manual UI (with corresponding safe runtime/persistence receipts) or a subsequently explicitly approved UI fallback. Recheck app/process attribution before every live observation. Do not close the older normal development instance without coordination or touch Alpha to simplify testing.

1. Record current repaired source/build hashes, one development app path/window, main/server/renderer PIDs, actual ports, profile realpath and `FUSION_LOCAL_MACHINE`. Use a marker-owned disposable profile and scratch workspace outside the product checkout/normal profile. A scratch path merely prepared on disk is insufficient.
2. Register and select that exact scratch workspace through existing supported workspace ownership; retain registry ID/canonical repo_path, selected workspace and matching `workspace:init`/panel/machine evidence before New Chat. Confirm readiness uses its machine subtree and that view capsule/state writes land there. The isolated profile must not auto-select fs-dev or another real workspace. Do not copy the owner database or hand-edit real System state; normal registration and protected scratch fixtures suffice.
3. Start/restart through the established development workflow with explicit repo, selected machine and scratch user-data; follow its current skill/instructions during execution. Use ordinary production/default startup mode for this smoke, without isolated-v1 provenance guards or test-only provider/fixture variables: those correctly block harness factories in the separate guarded lane. Verify `fusion-shell://app/`, normal shell authentication before init, continuing renderer connection, correct scratch binding and no secret/proof capture. Startup receipt is only attribution, not chat success.
4. In a registered chat-capable scratch view, create the first and then second New Chat. Verify each accepted create/open selects the exact new usable `threadGroupId`/`threadId` through existing selection/save-ACK path, preserving view binding. Record which selected thread receives the test prompt.
5. Send one short nonsensitive ordinary prompt through product UI. Retain safe request/ACK/turn correlation, server `message:sent`, actual OpenCode child PID/session identity and normal completed canonical assistant response. Do not record credentials, raw provider frames or unrelated chat content.
6. Confirm durable `exchanges` identity, thread/workspace ownership, turn/sequence and terminal completion through supported readback/test instrumentation/read-only scratch inspection. The accepted user input and assistant response must exist as the exact completed exchange, not only RAM or a receipt. Retain provider session ownership without publishing private configuration.
7. Navigate away/reopen that same thread through normal passive `thread:open`/history hydration or reconnect. Confirm the exact exchange returns, accepted user and completed assistant are visible, thread/provider ownership is unchanged, no replacement thread or duplicate exchange exists, and passive reopen does not spawn another turn or count as activation proof.
8. Stop only the scratch app/server via established shutdown; preserve evidence through review, then clean only marker-owned scratch resources. Protect normal/Alpha profiles, databases, shared capsule state and unrelated apps.

Pass requires all steps on attributed repaired bytes. Server ready, connection receipt, `wire_ready`, empty New Chat, generic child, fake provider, lower descriptor count, fixture pass or owner click without matching identities cannot substitute. An observed failure receives at most the bounded reproduction needed to distinguish a repeated concrete local failure. A separately deferred provider/network/rendering issue retains exact evidence and owner routing; broad investigation moves to the harness folder after current-job closeout, while this acceptance remains blocked until the required success is evidenced or the owner changes its exact contract.

## 8. Implementation evidence, deviation and documentation ownership

Repair orchestrator owns additive reports under this bundle's `implementation/`: `SOURCE-FINGERPRINTS.json`, `STARTUP-NEGATIVE-PROOF.md`, `STARTUP-REPAIR-REPORT.md`, `REGRESSION-RESULTS.md`, `GUARDED-SERVER-PROOF.md`, `OPENCODE-PUBLIC-SMOKE.md`, `SLICE-AND-DEVIATION-LEDGER.md`, and `SPEC-FINAL-REPORT.md`. Create substantive records as evidence occurs, not empty placeholders. Include exact command outcomes, fixture roots/ownership/cleanup, app/profile/workspace identities, source/build/test hashes, reviewer identities/reports, changed paths, limitations and every deviation's original text/reason/check/downstream effect.

The original implementation owner retains `../chokidar-retirement-and-harness-launch/spec/implementation/SLICE-AND-DEVIATION-LEDGER.md` and its historical S1–S4 reports. After reviewed repair evidence, that owner (or explicit acknowledged successor) appends a current `S3-startup-integrity-reassessment.md` and `S4-repaired-integration-report.md` in the original implementation directory and incorporates repair links/dispositions into its ledger. Record IA-01 effect-name omission, IA-02 readiness removal, test assertion/fixture gaps and resulting repairs as newly discovered integration findings/deviations; do not preserve “S3 deviations: none” as a current unqualified conclusion. Preserve the dated original reports and their accepted state as history, D-01/D-02/D-03, original approval/hash, and S4 pending manual-test chronology. Do not relabel prior CLEAN as current proof. Only new runtime/full integration evidence can close the contradicted seam and S4. A second repair orchestrator cannot overwrite those records without writer transfer.

The R3 builder owns focused canonical Wiki/source-map updates in `ai/RC-MacAir-15/`, after current-source reread/concurrent-writer checks and stable focused outcomes, before final integration. Update only changed claims; no broad reformatting. Required targeted adoption:

| Exact affected path | Update/check |
|---|---|
| `Wiki/002-Server_And_Runtime/006-Background_Services/PAGE.md` | Describe valid automation effect, real post-listen view-readiness admission/lease, unavailable behavior and demonstrated preserved components/triggers/runner; distinguish startup claims from measured runtime. Preserve Apple interim and shutdown limitations. |
| `Wiki/003-Automation_And_Agents/005-Background_Agents/PAGE.md` | Correct startup reachability/source-files; preserve event/cron/file-change distinction and no autonomous-worker guarantee. |
| `Wiki/010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md` | Correct pipeline reachability/readiness without claiming governed automation admission or durable exactly-once scheduling. |
| `Wiki/002-Server_And_Runtime/PAGE.md`, startup/readiness module descriptions and affected test inventories | Keep the source-owner map accurate; retired watchers absent, retained readiness module actively called, consistent effect identity. |
| `Wiki/007-Chat_System/005-Testing_And_Operations/PAGE.md` | Add the meaningful production startup/guarded-lane coverage and actual smoke evidence scope where appropriate; do not claim live provider success from fixtures. |

Original SPEC §6.S4 RV2-A01's entire documentation assignment remains a required verification inventory. The R3 builder checks its 16 Wiki paths against actual removal/preservation and new evidence, refreshing only invalidated descriptions: Background Services; Background Agents; Chat Runtime Model; Screenshot Capture; Calendar View; UEB Standards; Events/Ledger Decisions, Universal Event Bus, Taxonomy, Provenance Model, Resource Events/Render Sync, Correlation/Causality, Change Storm Control, Structure; Automation Run Provenance; Server/Runtime hub. Record each exact path/current hash and disposition (`unchanged accurate` or scoped update). Keep direct capture, Apple cached-row caveat, Google, legacy ledger whitelist, independent save/tool evidence, noncausal limits and future schema/grant scope intact. This is not permission to rewrite unrelated proposals.

Repair evidence reports are not canonical product docs. Original runtime evidence acceptance is not achieved by writing a Wiki sentence. The owner-facing domain manager incorporates the reviewed next state into TICKET/REFERENCES/BULLETIN under its own record ownership; repair builders do not acquire the registered main or checkpoint boundary. No CHECKPOINT/index/schema change is part of this SPEC.

## 9. Final integration, release conditions and holds

The repair orchestrator returns `SPEC_READY_FOR_OWNER_REVIEW` only after fresh final integrated clean-room review covers current repair/retirement bytes, all R1/R2 negative/positive seams, guarded lane, full suite/build, preservation matrix, actual public OpenCode persistence/reopening, exact original evidence/deviation incorporation and canonical docs/source-map adoption. Reviewers independently inspect current source/raw receipts; earlier S3/S4 labels are not a verdict instruction. Material findings repair through the builder/orchestrator gates before current final review. Report all deviations and downstream impact; do not publish Git or operate Alpha.

Original CHAT-AR-SPEC-01 whole-S4/current-job completion additionally requires its accountable owner's refreshed final integrated review and explicit owner acceptance. A single fresh review may cover both repair and original integration only when its packet/report explicitly covers both complete contracts/current bytes and exact evidence; separate labels without scope cannot supply a gate. Repair acceptance alone does not close the original job. If a supervisor is used, it presents completion to the owner and obtains explicit acceptance before a following implementation SPEC. There is no automatic next SPEC here.

| Hold/deferral | Resolver, trigger and release condition | Why bounded work does not compound it |
|---|---|---|
| Actual authenticated provider smoke/manual result | Original runtime test coordinator and implementation owner; attributed scratch profile AND registered/selected scratch workspace, all §7 evidence; whole S4/job acceptance held until pass or exact owner contract amendment. | Mandatory, not deferred polish. Startup repairs/test changes do not replace the scenario. |
| Broader OpenCode/Together error/retry/recovery | `chat-harness-repair-and-testing/TICKET.md` after current job finishes; separately authorized plan/implementation and affected runtime proof. | Existing adapter/canonical/persistence contracts and temporary diagnostic delete/migrate marker stay intact; no alternate provider architecture introduced. Concrete blocking smoke failure remains reported here. |
| Renderer delay/resource symptoms | Owner/current implementation owner for a directly reproduced scenario blocker; broader program separately assigned. | No renderer timing/selection redesign here; reviewed New Chat bytes retained. Capture exact current runtime evidence if symptoms block §7. Cause is open. |
| Snapshot/file-trigger/native Apple replacement | Plugin Foundation/System/native connector owners under original D-015–D-020/I-021/I-022; separately approved schema/grants/lifecycle and proof before consumer release. | No restored watcher or substitute detector. Existing save/tool paths and explicit observation/Apple freshness gaps remain; view readiness is an existing migration lease, not replacement observation. |
| Governed health/logging/subscriptions | Health folder and its owner assignment; approved schema/provenance/consumer contracts and implementation. | No new publisher, telemetry or diagnostic retention; existing temporary trace migration/deletion duty preserved. |
| Publishing/deployment | Explicit candidate publication instruction and repository workflow; Alpha separately confirmed after any authorized push. | Neither Full Access, implementation approval nor review supplies Git/Alpha permission. |

No migration or destructive data cleanup is planned. Preserved exchanges/history, workspace/view state and independent provenance stay under their owners. If a source revision changes during execution, recheck affected tests/standards/authority and freshness; retain valid unaffected evidence with exact scope. Required evidence or material intent missing at a gate yields a documented hold, not a waived criterion.

## 10. Author self-check and planning handoff

Author self-check: one bounded repair SPEC; raw findings independently substantiated; owner/spec/source/code/choice classes separated; all routed guidance read and mapped; existing readiness/effect owners reused; masked negative proof explicitly controlled; actual startup boundary and faithful real-server tests required; each preservation consumer has verification; no watcher/protocol/schema/harness program added; both scratch profile and selected registered workspace required; original S3/S4 provenance/docs/final acceptance preserved; exact writer and live-UI boundaries visible; no unresolved material owner choice silently assumed. This is not an independent verdict.

Return `CANDIDATE_AUTHORED` to the stage manager with manifest ID, SOURCES/coverage, self-check and report. The manager assigns independent `worker-handoff` candidate review, repairs, then a separate fresh candidate-stage validator. The Creation Supervisor assigns a fresh release validator independent of author/investigator/prior reviewers, then presents current candidate for owner approval. No implementation begins from author's status or file existence.

After owner approval, existing routes are direct `$mc-orchestrator` with this one SPEC or `$mc-roadmap-implementation-supervisor` with this approved single-SPEC packet; the latter accepts externally prepared owner-approved packets and requires no creator provenance. Neither route is invoked by planning. Owner acceptance of completed work and original-job closeout remain separate.
