# SPEC-01 — Reproduction and architecture gates

Program: CHAT-AR. Status: DRAFT CANDIDATE; not implementation authority.

## Objective, scope and non-goals

Establish trustworthy reproductions through the real authenticated shell and public routes before production responsibilities move. Own test infrastructure, fixtures, metrics and an evidence-based responsibility map. No product bug fixes, live-profile testing or automatic classification of every large file as a God file.

Expected areas: `fusion-studio-client/e2e/chat-architecture/` (new), `fusion-studio-client/playwright.chat-architecture.config.ts` (new), existing composer probe and view-bound shell smoke, targeted client E2E fixtures and server integration tests. Production-visible hooks and auth bypasses are prohibited. Pure observation can use Playwright instrumentation without installing a production feature. Existing Office harness files are not owned; shared utilities require a documented mechanically necessary integration, not wholesale adoption.

## Authority and prerequisites

Repository-relative paths resolve from `/Users/rccurtrightjr./projects/fs-dev`. Mandatory local packet dependencies: `ROADMAP.md`, `BUNDLE-INDEX.md`, `AUTHORITY-AND-DECISIONS.md`, `ARCHITECTURE.md`, `GUIDANCE.md`, `VALIDATION.md` and `ISSUES.md` in this folder. Read the current Chat Wiki overview and routed standards before changes.

Prerequisite: exact candidate approval.

Code-standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Required routed pages:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

No new standards exception is preapproved. AUTHORITY-AND-DECISIONS records proposed supersessions and preserved contracts. Old accepted source contracts are indexed in BUNDLE-INDEX; this SPEC cannot silently change them.

## Ordered slice packets

Every slice incorporates the complete fresh-builder, self-review, deviation, builder-owned and independent orchestrator review contract in GUIDANCE. Fresh builder per slice; only fresh clean-room reviewers may be spawned by that builder; repair forward until first clean without a pass ceiling. All descendants inherit root model/effort. Each listed check alias resolves to exact commands and pass criteria in VALIDATION.

### 01A — Owned fixture and public-route runner

**Prerequisite:** No preceding slice.

**Owned behavior, integration and failure branches:** Deliver the NEW commands defined in VALIDATION. Build a disposable Electron profile, workspace, copied/staged server and migrated fixture DB, canonical deterministic adapter, authenticated shell connection, bounded lifecycle and inventory. The adapter replaces only external provider computation; actual routers/controllers/persistence execute. Implement fake-iterator fault scheduling at named gates and distinguish injected transport faults from server acceptance faults. Exercise empty composer typing and create/open/Send/Stop through the UI, then read back the fixture DB and UI. Demonstrate cleanup after success, assertion failure, timeout and interrupt. Refuse a live DB/profile, an existing unrelated PID or port 3001. Runner outputs source hashes, workload and process ownership before scenarios start.

**Required verification:** V-BUILD; V-BASE with empty F1; runner lifecycle tests (new `e2e/chat-architecture/runner-lifecycle.test.mjs`, execute `node --test fusion-studio-client/e2e/chat-architecture/runner-lifecycle.test.mjs`). Pass: real auth/route/readback works and all four cleanup cases leave no owned process or open fixture database.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 01B — Executable failure cases and observation boundaries

**Prerequisite:** 01A clean and integrated.

**Owned behavior, integration and failure branches:** Implement R1–R9 inventory, including F2 dense completed history, fixed F3 workspace load, F4 duplicate mounts, F5 streaming, no-enqueue/disconnect/lost response, actual source-view chat actions and unmount during request. Use characterize mode to record violations without fixing production code. Correlation/receipt scenarios that depend on SPEC-02 are executable future assertions marked blocked by that missing contract; do not fake a passing status endpoint. Separate actual reproduced defects, disproved hypotheses, unknown original symptoms and unimplemented future contracts. Record formatter counts and React commit evidence as well as wall time. Avoid collecting private prompt contents. Implement short enforcement groups so later SPECs can activate their owned assertions.

**Required verification:** V-BASE; V-ISOLATION; V-SHELL through owned runner. Pass: R1 has matched warm/settled measurements; R2/R5/R6 each have a reproducible public-route result; all other scenarios have concrete fixture/test IDs and either current evidence or exact owning later contract. Never treat unavailable observations as zero.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 01C — Baseline and responsibility gate

**Prerequisite:** 01B clean and integrated.

**Owned behavior, integration and failure branches:** Publish a baseline report mapping AR-001–011 to test IDs and ownership. Inspect imports, subscriptions, callbacks, transaction bodies and shared mutable objects for useLegacyChatHost, useViewChatHost, ThreadManager, thread-runtime-controller, ThreadWebSocketHandler, thread-runtime-automation and SessionManager. Classify responsibilities independently of physical size; identify the minimum required extraction and explicit cohesive exceptions. Record exact dirty overlap, existing migrations and all relevant current regression failures. Inventory current public action callers and listener owners. Establish diagram/table of allowed dependencies and source checks that detect aggregate host subscriptions, full-manager injection and duplicate runtime authorities; behavioral gates remain decisive. Do not relax target ownership or performance contracts on a baseline failure.

**Required verification:** V-BASE, V-BUILD, relevant existing regression suites listed in VALIDATION, and `node --test fusion-studio-client/e2e/chat-architecture/architecture-contract.test.mjs` (new, characterize/report lane for violations not yet repaired). Pass: downstream slices have concrete failing test IDs, no uncategorized affected failure, and fixture inventory/metrics are repeatable. Publish report for owner acceptance before 02.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

## SPEC integration and owner acceptance

SPEC-01 passes with a reliable baseline, not a clean product. All runner isolation checks pass; known defects remain mapped to owning SPECs. The source responsibility inventory and test IDs become handoff evidence, without silently changing approved target contracts. AR-007 remains open until final symptom acceptance. No dependency on unrelated Office SPEC-12 completion.

The orchestrator reports all deviations and affected downstream assumptions. The owner must explicitly accept this SPEC before the following SPEC starts; direct `$orchestrator` and supervisor execution enforce the same boundary.
