# SPEC-02 — Prompt submission and recovery

Program: CHAT-AR. Status: DRAFT CANDIDATE; not implementation authority.

## Objective, scope and non-goals

Give each deliberate Send one session-owned attempt and an authoritative outcome. This SPEC implements ARCHITECTURE's proposed AR-P01/P02 contract only after exact candidate approval resolves it. Own prompt enqueue, correlated acknowledgements, durable admission receipts and uncertainty recovery. No automatic resend, provider exactly-once claim or new transcript authority.

Expected areas: chat submission state/controller (new narrow modules), chatSlice transport, ws-client connection retirement, thread-handlers, composer pending presentation, canonical prompt/thread-action router, thread-runtime-controller admission seam, thread-messages, group activity repository/service, new receipt repository and platform migration. Keep external provider syntax behind adapters.

## Authority and prerequisites

Repository-relative paths resolve from `/Users/rccurtrightjr./projects/fs-dev`. Mandatory local packet dependencies: `ROADMAP.md`, `BUNDLE-INDEX.md`, `AUTHORITY-AND-DECISIONS.md`, `ARCHITECTURE.md`, `GUIDANCE.md`, `VALIDATION.md` and `ISSUES.md` in this folder. Read the current Chat Wiki overview and routed standards before changes.

Prerequisite: exact candidate approval and explicit owner acceptance of SPEC-01. Use its integrated bytes and evidence as the accepted baseline; preserve unrelated dirty work.

Code-standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Required routed pages:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

No new standards exception is preapproved. AUTHORITY-AND-DECISIONS records proposed supersessions and preserved contracts. Old accepted source contracts are indexed in BUNDLE-INDEX; this SPEC cannot silently change them.

## Ordered slice packets

Every slice incorporates the complete fresh-builder, self-review, deviation, builder-owned and independent orchestrator review contract in GUIDANCE. Fresh builder per slice; only fresh clean-room reviewers may be spawned by that builder; repair forward until first clean without a pass ceiling. All descendants inherit root model/effort. Each listed check alias resolves to exact commands and pass criteria in VALIDATION.

### 02A — Session attempt ownership and truthful transport outcome

**Prerequisite:** Owner accepted 01.

**Owned behavior, integration and failure branches:** Replace void/silent transport handling with a typed enqueue result that distinguishes definitively not enqueued from ambiguous outcome. Extract immutable attempt ownership from the aggregate host into workspace/thread-qualified session state, surviving remount. Introduce requestId on production prompt/acceptance/error envelopes and validate it at boundaries. The server echoes the accepted attempt with exact server turnId; eliminate text equality as acceptance ownership. UI gates only after successful enqueue; no target/disconnect/throw-before-enqueue preserves editable draft and gives not-sent feedback. Accepted cleanup uses submitted revision and attachment IDs, so later edits remain. Two same-session surfaces display one attempt; another session stays independent. In this slice, run lost-ACK cases in characterize mode until 02B; no claim of durable recovery yet.

**Required verification:** V-BUILD; V-SUBMIT restricted to R2 and R4 enqueue/correlation/snapshot cases using runner `--cases` with the concrete IDs established in 01; prompt public-route and thread handler regressions. Pass: no pending spinner when transport cannot enqueue; duplicate/late ACK cannot clear a different draft or add duplicate bubbles.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 02B — Durable admission and serialized recovery

**Prerequisite:** 02A clean and integrated.

**Owned behavior, integration and failure branches:** Deliver the platform receipt migration, repository, narrow admission service and authenticated status/cancel-fence action within existing thread:action routing. Reserve before activation awaits; compare canonical fingerprints; serialize duplicate admission and recovery for the same key, including delayed original delivery. Recovery absent creates a tombstone, never an unfenced not-found inference. Recheck fences after awaits. Accepted receipt plus group acceptance activity commit atomically before ACK/dispatch; require a transaction-capable group operation instead of nested independent transactions. Claim dispatch durably before external invocation and never replay after crash. Return duplicate acceptance/status idempotently with original turnId. Reject mismatched fingerprints, invalid IDs and unauthorized workspace/thread access. Old reserved generation is safely cancelled on startup; accepted requests remain accepted with truthful interrupted/unknown execution status. Retain tombstones for session lifetime and delete through the authorized session owner. Preserve existing exchanges and null-view rows; no fabricated request backfill. Test fresh migration and upgrade of a copied pre-receipt fixture, including rollback/restart of interrupted transaction.

**Required verification:** V-SUBMIT R3/R4 durable cases; new `test/ws/prompt-submission-recovery.integration.test.js` through `npm test -- --runInBand --runTestsByPath test/ws/prompt-submission-recovery.integration.test.js` in staged server; existing prompt-canonical-route, privileged-thread-public-route and group lifecycle tests. Pass: each fault point has one receipt/activity/bubble and at most one Fusion dispatch, or a durable rejected/cancelled receipt with no dispatch. No private snapshot in logs.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 02C — Recovery UI and terminal lifecycle integration

**Prerequisite:** 02B clean and integrated.

**Owned behavior, integration and failure branches:** Wire session attempts into reconnect/status recovery and the 15-second pending deadline. Disconnection or ambiguity releases textarea editing and shows explicit unknown/recovering status while unresolved resend remains gated. Definitive rejection/cancellation enables a new deliberate attempt; acceptance reconciles the bubble once and clears only its submitted snapshot. Bound status requests/listeners to request and connection generation; use reconnect-triggered and user-requested checks with bounded backoff while connected, no busy polling. Visible unknown state may persist during an outage; do not display a perpetual acceptance spinner or invent a rejection. Acceptance followed by activation/dispatch failure keeps the accepted user identity and produces safe actionable failure through the established terminal/error presentation. Preserve RCC-0108 pre-begin rule: no fabricated assistant transcript row. After begin, preserve partial output and existing save/reveal handshake. Cover close/reopen, server restart, late old ACK and edited draft during recovery.

**Required verification:** Full V-SUBMIT; V-BUILD; R7 pre/post-begin errors and delayed save acknowledgement; existing working-activity and prompt ownership suites from VALIDATION. Pass: all R2–R4 owned assertions enforce, attempts/listeners/timers settle correctly, user bubble authority stays server-owned and no status recovery automatically repeats provider work.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

## SPEC integration and owner acceptance

Full submission suite passes across pre-enqueue, before acceptance commit, after commit/before ACK, before/after dispatch claim and before/after first output. Record schema/wire contract, failure-state evidence, source owner map, migration readback and all deviations. SPEC-03 consumes the controller's exact attempt API; no caller reinstalls pending refs.

The orchestrator reports all deviations and affected downstream assumptions. The owner must explicitly accept this SPEC before the following SPEC starts; direct `$orchestrator` and supervisor execution enforce the same boundary.
