# SPEC-05 — Backend lifecycle and persistence ownership

Program: CHAT-AR. Status: DRAFT CANDIDATE; not implementation authority.

## Objective, scope and non-goals

Decompose demonstrated multi-responsibility backend owners while preserving canonical runtime, persistence and recovery authority. Scope includes ThreadManager and separable policy/orchestration in thread-runtime-controller; other inventoried managers change only where the required ownership graph demands it. Do not rewrite cohesive subsystems or move entire manager objects into helper files.

Expected areas: ThreadManager, SessionManager boundary, thread group/session services and query modules, mirror/recovery owner, runtime activation and turn/drain orchestration, ThreadWebSocketHandler delegation, automation integration, receipt service from 02, existing outbox/file-backed view-state services. No provider-specific rewrites, second runtime map, separate worksurface SQL copy or general provenance redesign.

## Authority and prerequisites

Repository-relative paths resolve from `/Users/rccurtrightjr./projects/fs-dev`. Mandatory local packet dependencies: `ROADMAP.md`, `BUNDLE-INDEX.md`, `AUTHORITY-AND-DECISIONS.md`, `ARCHITECTURE.md`, `GUIDANCE.md`, `VALIDATION.md` and `ISSUES.md` in this folder. Read the current Chat Wiki overview and routed standards before changes.

Prerequisite: exact candidate approval and explicit owner acceptance of SPEC-04. Use its integrated bytes and evidence as the accepted baseline; preserve unrelated dirty work.

Code-standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Required routed pages:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

No new standards exception is preapproved. AUTHORITY-AND-DECISIONS records proposed supersessions and preserved contracts. Old accepted source contracts are indexed in BUNDLE-INDEX; this SPEC cannot silently change them.

## Ordered slice packets

Every slice incorporates the complete fresh-builder, self-review, deviation, builder-owned and independent orchestrator review contract in GUIDANCE. Fresh builder per slice; only fresh clean-room reviewers may be spawned by that builder; repair forward until first clean without a pass ceiling. All descendants inherit root model/effort. Each listed check alias resolves to exact commands and pass criteria in VALIDATION.

### 05A — Session lifecycle and group transaction boundary

**Prerequisite:** Owner accepted 04.

**Owned behavior, integration and failure branches:** Move canonical session create/delete/capacity primitives into a narrow lifecycle owner using initialized repositories/transaction handles and SessionManager. Group service retains membership/primary/activity and exclusive mutation lease ownership; callers receive explicit operations, not manager internals. Refactor vertical create/open/warm and close routes through the new boundary; preserve passive open with zero harness warm, eager New Chat, capacity/busy results and selected session identity. Acceptance activity and receipt transaction from 02 remain atomic. Prove rollback at each DB failure and exactly one session/group mutation under duplicate/concurrent commands.

**Required verification:** V-BACKEND create/open/warm/close/capacity; existing thread-group-lifecycle, thread-activation-lifecycle and privileged-thread-public-route integration tests; V-SUBMIT. Pass: same public behavior/readback, no duplicate lifecycle policy or full-manager dependency, narrow transaction APIs.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 05B — Mirror and deletion recovery owner

**Prerequisite:** 05A clean and integrated.

**Owned behavior, integration and failure branches:** Move chatlog projection, write/delete journals and startup recovery into a focused mirror owner, retaining existing canonical DB/exchange ownership. Integrate delete/Move through existing mutation lease, drain fences and worksurface outbox contracts; do not clone view state into SQL. Inject failures between SQL commit, file operation and outbox acknowledgement, restart and retry. Authorized deletion cleans submission receipts with the owning session; late provider/status callbacks cannot resurrect a deleted group/session. Preserve same-thread history links/export, Main/Side membership, old source session after Move, new empty Main and cold portable model copy. Fix necessary defects exposed by the extraction through the same public routes.

**Required verification:** V-BACKEND R8 mirror/delete/Move/restart; thread-group-delete-recovery, thread-manager-chatlog-sync, thread-group-move-side-chat and thread-group-worksurface-cleanup focused suites. Pass: idempotent recovery and exact DB/file readback, no stale runtime resurrection or abandoned receipt reopening.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 05C — Activation and turn/drain orchestration

**Prerequisite:** 05B clean and integrated.

**Owned behavior, integration and failure branches:** Separate runtime activation ownership from accepted-turn admission/dispatch/Stop/terminal cleanup, with SPEC-02 submission service owning only attempt receipts. Keep ThreadRuntimeManager sole canonical state authority. Use immutable workspace generation/thread/turn/drain identities and compare-current cleanup. Interactive and automation share the established canonical drain APIs; automation need not fabricate a client request receipt. ThreadWebSocketHandler becomes transport/session binding with focused delegation where inventory proves separable business policies. Test interleaved threads, replacement drain, activation failure, terminal persistence failure and late old-generation callbacks. No extracted service may reach arbitrary fields on a parent God object.

**Required verification:** V-BACKEND R7/R8 runtime cases; thread-runtime-controller, thread-runtime-automation, thread-crud-active-turn-reconnect, canonical bridge/applier and prompt-canonical-route suites; full V-SUBMIT. Pass: Stop/cleanup affects only its exact drain and acceptance/terminal semantics remain intact.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 05D — Facade closure and integrated backend verification

**Prerequisite:** 05C clean and integrated.

**Owned behavior, integration and failure branches:** Remove moved transaction bodies, policy duplicates, mirror formatting/recovery loops and dead adapters from ThreadManager; leave workspace-qualified narrow delegation. Review all newly extracted dependencies and changed managers for single responsibility and line limits, not only the facade. Publish acyclic dependency map with lease, transaction, runtime and durable-write owners identified. Run the complete server suite in isolated test environment plus actual UI create/Send/Stop/Move/delete/reconnect. Reconcile affected server Chat Wiki sections without overwriting concurrent provenance edits.

**Required verification:** Full V-BACKEND, V-SUBMIT, V-ACTIONS, V-BUILD; full isolated server `npm test -- --runInBand`; architecture-contract checks. Pass: no affected baseline-red failure, no hidden second owner, no unbounded pending cleanup, focused services pass real route/readback tests.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

## SPEC integration and owner acceptance

ThreadManager no longer mixes independent policies, and extracted runtime owners have explicit dependencies. Full server suite and public UI regressions pass or genuinely unrelated failures have exact explicit owner dispositions. Publish owner map, fault matrix, migrations/recovery evidence and deviations before owner acceptance for 06.

The orchestrator reports all deviations and affected downstream assumptions. The owner must explicitly accept this SPEC before the following SPEC starts; direct `$orchestrator` and supervisor execution enforce the same boundary.
