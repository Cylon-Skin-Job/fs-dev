# SPEC-05 — Browser workspace client and recovery

Status: DRAFT candidate. Prerequisite: accepted SPEC-04 and resolved BR-D14.

## Execution packet

Read BUNDLE-INDEX.md, DECISIONS.md, ROADMAP.md, GUIDANCE.md and ISSUES.md in this directory. GUIDANCE.md's fresh builder/reviewer lifecycle applies to each slice below without exception. Each slice is a complete public-route increment, including necessary integration and its checks. A new builder handles the next slice only after orchestrator review is clean. Record every deviation and its consumers. Owner acceptance is required before the following SPEC.

Baseline: record the accepted current commit, relevant dirty paths and existing test results at dispatch. The planning snapshot is not a frozen execution branch. No live profile/DB mutations in fixtures. No migration may rewrite existing machine identities, workspaces, transcripts or view state. New module names below are proposed owner locations; if existing owners suffice, use them and report the mapping.

## Exact code standards

Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Read fully, plus:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

## Objective and scope

Run the existing React workspace application in a laptop browser, using same-origin authenticated HTTP/WS and full-access authorization. Preserve visual language and existing server-owned product behaviors. No mobile redesign, PWA/service worker, native phone APIs, offline mutation queue, alternate renderer build, Electron remote iframe mode or independent machine configuration.

## Authorities and expected areas

BR-D01/D02/D04/D06, resolved BR-D14. Existing owners: `fusion-studio-client/src/lib/runtime-transport.ts`, `shell-auth-client.ts`, `ws-client.ts`, `view-capsule-projection.ts`, `src/lib/ws/`, `src/state/`, `src/types/electron.d.ts`, existing connected app/header/settings hosts and built-in view components. Read Chat overview, Runtime Model, Thread Actions, WebSocket Protocol, State/Rendering wiki contracts. Add isolated `playwright.remote.config.ts` rather than using an existing config that starts against a real profile.

## Transport contract

Use explicit discriminated desktop-shell vs browser transport modes, selected from the trusted document scheme/bootstrap context. `fusion-shell://app` always takes the exact Electron descriptor path; absent/malformed preload/descriptor means disconnected, never browser fallback. Browser entry is the expected HTTPS served app with validated bootstrap shape; derive https/wss same-origin URLs, with no server/user supplied arbitrary socket endpoint. Do not widen the existing shell descriptor validator to accept internet origins.

Authenticated `/remote/session` bootstrap supplies non-secret server UUID, machine display identity, current runtime generation, auth state, CSRF token and supported client capability information. Browser pairing is a bounded pre-product route from SPEC-02. Browser WS cookie authentication is recognized via the sibling initialization path, not `shell-auth:*`. HTTP/WS/resource URL creation remains behind runtime transport. Missing Electron API is expected only in browser mode, not an excuse to skip security.

Retain per-generation cancellation of fetches, streamed responses, event handlers and sockets. Restart requires fresh bootstrap/generation before accepting frames; reconnect uses bounded backoff with jitter and visible offline/auth-required state. 401/revoked session clears product stores and returns to pairing without infinite reconnect loops. 403 unsupported/denied is not transient retry. Connection loss disables sends/saves and never reports success; existing unsent draft may stay in memory but no queued mutation is auto-submitted after reconnect. Uncertain command result is disclosed and refreshed from server; never retry prompt automatically.

## Product and capability contract

Required laptop flows: workspace list/switch under BR-D14, built-in views, file tree/read/save through existing supported editor route, thread list/open/create/send/live output/Stop, authoritative history and view state hydration, ordinary workspace/view/config operations that already have server handlers. Authorization parity does not add unsupported features or turn demo-only features into real integrations.

Inventory every `window.electronAPI`, `fusion-studio:`/`fusion-shell:` resource dependency and native `<webview>` consumer. Record each as browser-equivalent, host-server operation or explicitly unavailable. Add narrow browser equivalents required for the above flows. Native export/print/email dispatch, OS screenshot capture, desktop filesystem picker, embedded browser webview and arbitrary custom local apps may remain unavailable with explicit capability messaging. Server paths always mean host paths; choosing a laptop file is not permission to send its local path as a host path. Do not execute arbitrary workspace HTML/scripts in privileged browser origin. Preserve native shell projection/binding; browser must use server-resolved authenticated content resources and supported built-in mounts.

Browser header shows connected server/machine and full-access status, distinguishing it from any independently installed local Fusion. Device label does not change machine identity. Server UUID partitions any existing client-local storage used for drafts/navigation, preventing accidental cross-server reuse. No authoritative workspace/thread DB or durable offline clone is introduced.

Workspace selection and durable view state remain shared if BR-D14 is accepted as proposed; show a concise indication before switching that it affects connected clients. Local focus/unsent draft is not broadcast; existing view-state persistence is unchanged. On shared switch, invalidate old workspace requests/epochs and hydrate the newly bound workspace; never render late A responses into B.

## Slices

### 05A — Served pairing and transport bootstrap

Build login/pairing screen, authenticated bootstrap, browser transport and cookie/CSRF client use through existing controllers. Serve actual dist via SPEC-03 fixture (no preload injected). Pair/approve/reload and open workspace. Missing/malformed shell descriptor remains disconnected. Tests cover secure origin/resource derivation, auth-required/offline and no cookie in JS/logs.

Check: `cd fusion-studio-client && npm run build`; `npx playwright test --config=playwright.remote.config.ts e2e/runtime-transport.spec.ts e2e/shell-auth-client.spec.ts e2e/remote-browser-bootstrap.spec.ts`.

### 05B — Workspace, file and chat vertical flows

Complete capability inventory/adapters and header status. Exercise scratch file read/edit/save/readback and chat open/create/prompt/live/Stop through real routes with deterministic harness fixture. Confirm server ai/<machine> paths and existing DB ownership unchanged. Test two clients and all relevant workspace/view state semantics under BR-D14; supported built-in content loads without custom protocol. Unavailable native controls explain the capability rather than silently doing nothing or opening the server's native dialogs unexpectedly.

Check: `cd fusion-studio-client && npx playwright test --config=playwright.remote.config.ts e2e/remote-browser-workspace.spec.ts e2e/remote-browser-chat.spec.ts e2e/remote-browser-capabilities.spec.ts`; build. Server integration tests for any new resource route are required in its owning module.

### 05C — Disconnect, restart, revoke and stale-state recovery

Run against same production composition with network interrupts, server restart, revoked credential and shared-workspace switch. Assert no auto-replayed prompt/save; accepted turn survives browser drop; history/live overlay and correct Stop target return; revoked UI clears on detection. Assert old-generation/old-workspace response cannot mutate current stores. Verify local Electron side-by-side, including unread/live thread behavior, without mirroring browser draft/focus.

Check: `cd fusion-studio-client && npx playwright test --config=playwright.remote.config.ts e2e/remote-browser-recovery.spec.ts e2e/runtime-transport.spec.ts e2e/shell-auth-client.spec.ts`; build and full server suite for integration changes.

## Compatibility and final acceptance

No migrations to thread/view state or new browser machine roots. All planned test files are new except named existing transport/shell tests. Baseline broken native-only flows must be documented, not silently asserted supported. Confirm actual served Chrome/Chromium and Safari laptop UI, with browser console free of missing-preload errors during required flows. Existing desktop retains full behavior and strict shell auth. Product no-store semantics do not claim erasure of downloads or developer-tool captures. Regression surface: transport, workspace hydration, chat lifecycle, resource URLs and connected view hosts.
