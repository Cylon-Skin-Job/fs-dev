# Local content-free health logging — planning bundle

Current status: **HELD for governed-architecture and shared-measurement rebase**; read [ARCHITECTURE-HOLD.md](ARCHITECTURE-HOLD.md). Implementation is NOT authorized. The scope/order below is the preserved predecessor, not a current executable plan. This status notice postdates the original review and changes this file's historical candidate hash.

Created 2026-09-27 from owner direction in the Roadmap supervisor conversation.

## Scope and dependency map

One SPEC, three dependency-ordered vertical slices:

1. **HL-01A — bounded store through real server lifecycle:** startup → validated observation → worker-owned separate SQLite → retention → manual readback after restart.
2. **HL-01B — content-free chat and application observations:** existing server/renderer/Electron owners → scalar projection → bounded transport/store → correlated manual readback.
3. **HL-01C — query workflow and integrated qualification:** local read-only queries, privacy probes, resource limits, paired performance comparison, and isolated smoke.

Order: current integrated CHAT-AR/RD-01/RD-02 source → A → B → C → SPEC report → explicit owner acceptance. This supplemental SPEC does not replace or accept CHAT-AR SPEC-06, reopen accepted SPECs 01–05, or authorize 06C/release/Alpha. It can be dispatched after this candidate is explicitly approved and the shared-file/runtime lane is handed off from SPEC-06. No plugin or Fusion Server implementation is a prerequisite.

## Bundle index

| Artifact | Purpose and authority |
| --- | --- |
| `INDEX.md` | Normative scope, dependency/standards map and handoff |
| `DECISIONS.md` | Normative owner decisions, engineering choices, issues and deferrals |
| `SPEC-HL-01.md` | Normative data, collection, retention, lifecycle and query contracts |
| `SLICES.md` | Normative builder packets and review responsibilities |
| `VALIDATION.md` | Normative acceptance matrix and concrete verification gates |
| `RELEASE-MANIFEST.md` | Derived candidate identity, review provenance and approval state |
| `reviews/` | Read-only review evidence; not independent product authority |

All relative paths below are relative to `/Users/rccurtrightjr./projects/fs-dev` unless qualified otherwise. This bundle lives at `ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/LOCAL-HEALTH-LOGGING/`.

## Authority and inspected baseline

- `AGENTS.md`, `fusion-studio-server/AGENTS.md`; primary development checkout verified, extensively dirty. Preserve owner/concurrent edits. HEAD alone does not identify the current implementation.
- Chat source of truth: `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`.
- System boundary: `ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/PAGE.md`.
- Existing accepted live-diagnostics contract: `ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/render-diagnostics/RD-02-CONTRACT.md`. Its raw native viewer stays ephemeral and separate; this SPEC does not persist its text.
- Planning background only: `ai/RC-MacAir-15/Captures/001-Captures/fusion-server-knowledge-sync-and-instance-identity.md`. Server knowledge ingestion, shared-folder permissions and scripts are not implemented by this SPEC.
- Current accepted product/build provenance: `ROADMAP/evidence/render-diagnostics/HUMAN-RESUME/ROOT-LAUNCH-REPORT.md` relative to the parent capture. Source manifest was 1,997 entries; build 200 entries, digest `d66e0386a57a084f896d515a63a48f87e8318c0b983433fbb47f753024d40d4e`. Later launcher changes are fixture-only. Reconcile current shared bytes at dispatch; do not reset to historical manifests.

## Mandatory standards routing

Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`.

All eight selected pages have been read during planning. Prefix below is `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/`:

| Exact page suffix | Applies to |
| --- | --- |
| `001-Architecture_Routing/PAGE.md` | A/B/C: named lifecycle, telemetry and manual-query owners; justify new paths |
| `002-Frontend_UI/PAGE.md` | B/C: passive connected-host observation, no UI redesign or persistence from presentation |
| `003-State_Management/PAGE.md` | B/C: read existing composer/reveal owners; never create a second completion owner |
| `004-WebSocket_Protocol/PAGE.md` | B/C: authenticated, bounded content-free client observation route |
| `005-Universal_Event_Bus/PAGE.md` | A/B/C: preserve existing governed/legacy ownership; telemetry is optional observation, not a new canonical ledger |
| `006-Harness_Adapters/PAGE.md` | B/C: provider syntax remains in adapters; no new provider invocation |
| `007-Persistence_And_Metadata/PAGE.md` | A/B/C: dedicated store/migrations, no primary-history rewrite or ambient plugin access |
| `008-Testing_And_Smoke_Slices/PAGE.md` | A/B/C: actual public/lifecycle route to durable readback, not helper-only tests |

Exact scoped supersession: the owner's separate diagnostics-store direction permits a new **platform-owned diagnostics connection and migrations**, rather than using the `lib/db.js` primary singleton mandated for ordinary System queries by server AGENTS. It does not permit a second primary connection, plugin ambient DB authority, or any change to chat persistence ownership. The owner's explicit rolling limits authorize deletion of this store's telemetry only, not general history cleanup.

## Current owners and feasibility map

| Concern | Existing surface / constraint |
| --- | --- |
| Primary DB | `fusion-studio-server/lib/db.js`, `lib/db/migrations/034_harness_error_diagnostics.js`, `lib/thread/harness-diagnostic-service.js`: error reports already have content-bearing reports and separate bounded retention. Do not copy or migrate them. |
| Startup/shutdown | `fusion-studio-server/lib/startup.js`, `lib/shutdown.js`: diagnostics registers optional bounded lifecycle cleanup without extending required owner deadlines. |
| Server chat | `lib/thread/runtime-prompt-admission.js`, `runtime-dispatch.js`, `provider-termination.js`, `runtime-stop.js`; `lib/wire/canonical-chat-event-applier.js`, `terminal-saved-delivery.js`: observe facts at their owner, never gate them. |
| Existing live diagnostics | `lib/thread/live-diagnostic-service.js`, `lib/ws/live-diagnostic-handlers.js`, `lib/harness/opencode/native-diagnostic-tap.js`: subscriber-gated ephemeral raw text, not a content-free always-on collector or disk sink. |
| Renderer observations | `fusion-studio-client/src/lib/reveal/progress.ts`, `lib/diagnostics/stream.ts`, `lib/ws/stream-handlers.ts`, `lib/ws/turn-lifecycle.ts`, `components/chat/ConnectedChatComposer.tsx`: reuse scalar progress after existing acceptance gates; raw diagnostic channels are not a storage source. |
| Native lifecycle | `fusion-studio-client/electron/main.cjs`, `server-spawn.cjs`, `preload-source.cjs` and existing preload build/IPC owners: renderer exit already has an owner; native sleep/wake observations require a bounded extension. `preload.cjs` is generated by `build-preload.mjs`, not an independently edited source. |
| Tests | `fusion-studio-server/test/ws/live-diagnostic-route.integration.test.js`, `test/thread/live-diagnostic-dispatch.test.js`; client `e2e/stream-diagnostics.spec.ts`, `e2e/visible-wait.spec.ts`, `e2e/instant-collapse.spec.ts`, `e2e/chat-architecture/` |

New `lib/health-logging/` owns ONLY the content-free store/service/worker. A new `chat-turn:health:batch` member is justified within the existing diagnostic/chat-turn routing domain: current report retrieval and native subscription neither accept numeric client observations nor provide always-on persistence. App/Electron-only lifecycle observation must use a named main-process owner and a private child channel, not a public generic file-write or arbitrary-JSON route. No raw-provider UEB topic is added.

## Handoff, review and release

The Roadmap Creator stops at an independently reviewed candidate and asks the owner to approve its exact ID. It does not implement or launch anything.

After approval, either invoke `$orchestrator` with `SPEC-HL-01.md`, or invoke `$roadmap-implementation-supervisor` with this approved one-SPEC bundle. Root/current model and reasoning effort are inherited by all descendants. Each new slice has a fresh `spec-slice-builder`; review/repair duties are in `SLICES.md`. Completed work must come back to the owner with deviations, evidence and explicit residuals. This plan does not authorize Git publishing, installed Alpha operations, a regular-profile restart, upload configuration, or changes to the retained human-test data.
