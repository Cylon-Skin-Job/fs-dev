---
name: Chat Testing And Operations
description: Vertical smoke tests, browser Playwright, Electron Playwright, and Fusion restart guidance for chat work.
metadata:
  last-modified: "2026-10-07T20:18:16Z"
  source-files:
    - fusion-studio-server/lib/startup.js
    - fusion-studio-server/test/runtime/isolated-provenance-runtime.test.js
    - fusion-studio-server/test/watch/watcher-retirement.test.js
    - fusion-studio-server/test/event-registry/startup-integration.test.js
    - fusion-studio-server/test/views/view-readiness-coordinator.test.js
    - fusion-studio-server/test/views/view-relocation-recovery.test.js
    - fusion-studio-server/test/ledger/event-ledger.test.js
    - fusion-studio-server/test/screenshot-file-capture-request-id.test.js
    - fusion-studio-server/test/screenshot-protected-view-path.test.js
    - fusion-studio-server/test/calendar/apple-listener-retirement.test.js
    - fusion-studio-server/test/triggers/trigger-loader.test.js
    - fusion-studio-server/test/triggers/cron-scheduler.test.js
    - fusion-studio-server/test/shutdown.test.js
    - fusion-studio-server/test/chat-metadata/file-mutations-collector.test.js
    - fusion-studio-server/test/ws/file-save-route.test.js
    - fusion-studio-server/test/subscriptions/file-provenance-bootstrap.test.js
    - fusion-studio-server/test/resources/file-provenance-integration.test.js
    - fusion-studio-server/test/agent-provenance/fact-authority-and-ledger.test.js
    - fusion-studio-server/test/wire/canonical-chat-tool-events-provenance.test.js
    - fusion-studio-server/lib/views/readiness-startup.js
    - fusion-studio-server/lib/views/readiness-runtime.js
    - fusion-studio-server/lib/views/readiness-coordinator.js
    - fusion-studio-server/lib/views/relocation-service.js
    - fusion-studio-server/lib/workspace/workspace-controller.js
    - fusion-studio-server/lib/testing/isolated-provenance-runtime.js
    - fusion-studio-server/test/runtime/workspace-startup-integrity.test.js
    - fusion-studio-server/test/views/readiness-startup.test.js
    - fusion-studio-client/e2e/provenance/run-file-viewer-live.mjs
    - fusion-studio-client/e2e/provenance/guarded-proof-lifecycle.mjs
    - fusion-studio-client/e2e/provenance/guarded-proof-lifecycle.test.mjs
    - fusion-studio-client/e2e/provenance/file-viewer-live-resource.spec.ts
    - fusion-studio-client/playwright.provenance.config.ts
    - fusion-studio-client/playwright.chat-architecture.config.ts
    - fusion-studio-client/e2e/threaded-chat-host.spec.ts
    - fusion-studio-client/playwright.config.ts
    - fusion-studio-client/e2e/chat-send-transport.spec.ts
    - fusion-studio-client/e2e/trusted-shell-auth-smoke.mjs
    - fusion-studio-client/e2e/chat-send-native-scenario.mjs
    - fusion-studio-client/e2e/prompt-submission-recovery.spec.ts
    - fusion-studio-client/e2e/chat-recovery-native-scenario.mjs
    - fusion-studio-server/server.js
    - fusion-studio-client/e2e/chat-material-insertion.spec.ts
    - fusion-studio-client/e2e/support/chat-material-fixture.tsx
    - fusion-studio-client/e2e/support/chat-material-source-fixture.ts
    - fusion-studio-client/e2e/support/chat-material-screenshot-cases.ts
    - fusion-studio-client/e2e/chat-material-native-scenario.mjs
    - fusion-studio-client/e2e/chat-architecture/electron-case-helpers.mjs
    - fusion-studio-client/e2e/chat-architecture/stage-fixture.mjs
---

Use this section before validating chat changes.

This page describes validation requirements and assertions in existing test sources, not current passing results. The September 19 documentation reconciliation inspected selected tests and source paths without running server suites, browser/Electron smoke, builds, or Alpha. Older “proves” and “coverage” wording below describes intended assertions; it does not certify this checkout or every listed test.

Session resume coverage must distinguish stored provider-session reuse from public member selection. Current `thread:open` and existing-session `thread:open-assistant` hydrate the exact validated member; a group-only request resolves the current primary. Single-member/current-primary tests alone do not establish exact Side Chat hydration. Coverage must also open a non-primary member after Move, restore its exact history on reconnect, and verify that `historyOnly` does not change Main selection, pending Main opens, or provider ownership; see [Runtime Model](../006-Runtime_Model/PAGE.md#new-thread-and-activation). Server link success likewise does not establish renderer focus/reopening; see [Group and exact-member links](../002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md#group-and-exact-member-links).

Fusion Studio is a single-machine Electron workspace app with a browser
renderer and a Node server. Browser Playwright is useful for focused renderer
and server assertions. Electron Playwright or the Fusion Home restart script is
needed when the app shell itself matters.

Trusted shell endpoint/origin work additionally runs the focused Electron Node
tests under `electron/*.test.cjs`, the `runtime-transport.spec.ts` browser
contract, an isolated Electron launch whose committed main-frame URL is
`fusion-shell://app/`, and packaged startup from a temporary profile. Browser
Playwright's HTTP page is a test surface only and is not a production endpoint
fallback.

Connection-authentication changes additionally run the Electron launch/signing
and bootstrap-pipe tests, server bootstrap/auth/dispatch tests, and
`shell-auth-client.spec.ts`. Combined focused-route and runtime-smoke evidence
must observe authentication before `workspace:init`,
raw/custom-origin/replay/expiry denial, pending-socket exclusion from product
factories, fan-out, and workspace binding, exactly-once post-init cleanup, and
no product construction or acknowledgement before the full server runtime
activation barrier, plus fresh authentication after a server
restart. Neither nonce nor proof bytes may appear in captured logs.
Real upgraded-socket coverage also exercises unanswered expiry, abnormal close,
protocol-sized pre-authentication rejection, and shutdown of both pending and
active transports while awaiting asynchronous product cleanup. The restart
smoke emits only a fixed success marker, never either launch generation.
Authentication master,
generation, challenge, proof, nonce, authorization, and derived-signature
fields are recursively suppressed at diagnostic ingress. General client-message
logs retain no requester-controlled envelope values; `client_log` message level,
message, and data are wholly suppressed rather than treated as trusted diagnostics.
The server request boundary also minimizes logs emitted by async descendant
handlers before console or durable-log output. The installed server log sink
also projects startup and background console calls to fixed level markers, and
the background-service durable failure log independently stores only a fixed
service and failure marker, never service names or thrown error details.
Electron parses readiness internally while forwarding only fixed server-child
stdout/stderr markers. Product-handler rejection frames use fixed messages
rather than reflected request values. Renderer receive diagnostics
project ordinary product frames to type only; the accepted PROV diagnostic
responses retain only their fixed opaque-identifier allowlists, with a second
renderer-handler boundary for downstream message diagnostics. Electron treats
all renderer and child-frame console text plus source metadata as untrusted and
persists only a fixed level marker; textual prefixes never authorize passthrough.
The rotating wire diagnostic records only fixed traffic markers, never raw
harness frames.

Privileged-thread changes additionally prove the decoded public route through the thread-domain guard: trusted New Chat, current-primary session resume, Rename, Delete, Copy Link, Resolve Link, View Markdown, model selection, Warm, and prompt-triggered activation reach their existing owners; raw/standalone/request-asserted authority receives one fixed denial before manager, provider, persistence, mirror, UEB, or fan-out effects; and passive open is asserted against real SQLite and mirror bytes to prove it does not write resume/MRU or list state. Public-route tests also submit foreign-workspace IDs to passive open, assistant activation, Warm, prompt, Rename, Delete, Copy Link, and model selection and assert no foreign data or durable/provider effect. A deterministic A-to-B window canary proves passive open/list/search cannot use A's manager after B binds and resume normally only after B's matching panel manager is installed. Deterministic lifecycle tests cover post-switch live-root resolution, concurrent B/C activation ordering, workspace switching during an awaited activation, binding-time Rename/Delete/Copy Link/model selection, binding during awaited Create/Resume, prompt persistence/provider admission ordering, and injected session-open failure. They also exercise same workspace/thread identifiers at different roots and epochs, explicit idle-owner epoch adoption, same-wire owner restoration when predecessor retirement fails, and target exit during an awaited predecessor close. Workspace-switch canaries also prove the old provider delivery owner is unregistered and suspended before the new bind frame, and that a delayed assistant-resume list cannot disclose the retired manager; they require one final owner, no orphan child, and no readiness frame before ownership commits. Fork is tested as an unconditional no-effect denial for public requests, inbound configuration, and stored legacy provider state. AST-based static spawn inventory and real child canaries cover every harness/CLI launch family, showing that required allowlisted values arrive while shell authority and unknown host values do not. The canaries also prove probes receive no provider credentials and Codex, Claude, Gemini, Qwen, Kimi, and multi-provider OpenCode runtime children receive only their documented adapter credential sets. The static gate fails closed on CommonJS and ESM imports, dynamic imports and built-in-module acquisition, detached or wrapped launch references, mutable or shadowed builder/environment bindings, prebuilt environment objects, and options spreads or computed properties that could replace the verified environment owner. Same-thread-id two-workspace canaries additionally cover lifecycle state, status/audit correlation, exact manager-root and adapter-session identity, exactly targeted watcher mutation collection, unique-active-turn attribution, ambiguous/partial watcher suppression, lifecycle fan-out, and provider output/exit/retirement after client ownership transfer. Executable adapter tests consume canonical iterators and exercise provider stop signals; prompt selection tests prove explicit nullable variants clear prior state. Held-effect canaries prove workspace retirement and shutdown do not outrun asynchronous audit or legacy event-ledger work. The isolated agent-tool provenance route never creates a thread from public input: startup provisions one fixed provider-free fixture thread before listen, and raw fixture requests can only passively select that exact identity in its process-provisioned workspace. A real two-workspace switch canary omits the new panel installation and proves the stale-manager window returns the fixed unavailable response with no history, authority, filesystem, database, UEB, ledger, result, or fan-out effect.

Existing Thread Group activity/MRU test assertions cover one accepted prompt writes exactly one `prompt:{threadId}:{turnId}` activity and advances the group clock once; a retry of the same thread/turn never advances twice; open/warm/completion/Stop/Rename never advance; a failed activity persist rejects the prompt through the normal acceptance path; and Legacy (`viewId: null`) population ordering stays deterministic. Canonical `thread:action` test assertions cover Copy Link/Resolve Link/View Markdown/model selection traverse the registered route with same-request replay, different-input `request_mismatch`, versioned-URI round-trip, Legacy resolution without borrowing the active view, mirror-path validation, model/variant acceptance and rejection, fan-out, restart survival, and `surfaceId`-free envelopes. Search tests prove the group join returns `threadGroupId`, visible group name, and authoritative view binding without replacing exact exchange/session identity.

Existing Move/Side Chat coverage includes server integration for `move_chat_to_side` creation/group-commit/outbox/recovery and `thread:members`/`open_member_in_side`, plus the focused Playwright specs `e2e/move-chat-to-side-chat.spec.ts`, `e2e/side-chat-placement-recovery.spec.ts`, and `e2e/side-chat-isolation.spec.ts` (with `e2e/side-chat-adapterless-native.spec.ts` covering native and adapterless hosts). All run under the isolated `playwright.chat03.config.ts` (fresh port and `/tmp` profile, never port 3001 or the dev DB). `node e2e/side-chat-electron-smoke.mjs` exercises the real Electron shell on a throwaway profile and temp workspace: Move, empty replacement Main Chat, close/reopen with the same lifetime placement id, relaunch readback, repeated Move, outer-rail toggle from a Side Chat, and the hard assertion that the retired secondary chat is absent.

The outer-rail assertion targets the current left-hand `dock_to_right` / Show threads control. It is evidence of the older implementation contract, not approval to retain that control: owner direction removes it and the sliding thread-panel behavior from Side Chat tabs while keeping the right-hand `event_list` / More options button. Future product work must update the corresponding assertions; the right button’s shared behavior remains undefined. See [Chat UI](../004-Chat_UI/PAGE.md#owner-direction-list-behavior-still-to-be-defined).

For product implementation affecting these shared chat contracts, the broader validation minimum includes `cd fusion-studio-server && npx jest --runInBand` and `cd fusion-studio-client && npm run build`.

For renderer chat-send changes, also exercise the production `ws/product-send.ts` entry and `shell-auth-client.ts` queue/socket machinery with `e2e/chat-send-transport.spec.ts`: caller policy, fixed local results, stale same-ID binding, queue retirement, and native throw uncertainty. The isolated `node e2e/trusted-shell-auth-smoke.mjs` entry includes a deterministic provider scenario through real Electron authentication and public routes; it checks exact Main and Side prompt acknowledgements and durable action/exchange readback in a disposable profile/workspace. Those send checks do not certify live OpenCode failure attribution or an Alpha installation.

For receipt inquiry changes, build the client, then run `npx playwright test --config=playwright.chat-architecture.config.ts e2e/prompt-submission-recovery.spec.ts e2e/chat-send-transport.spec.ts e2e/prompt-ownership.slice-c.spec.ts e2e/thread-bootstrap-order.spec.ts e2e/visible-wait.spec.ts` from the client and `npm test -- --runInBand --runTestsByPath test/ws/prompt-submission-recovery.integration.test.js` from the server. The recovery spec uses the production send-result boundary for refusal, uncertainty and auth-queue cases, fake time for the 15-second start, five-second inquiry and bounded retries, and the isolated browser composer for scheduled/manual status and existing feedback. The default Playwright config is outside this isolated route and can contact a live development server.

The default `node e2e/trusted-shell-auth-smoke.mjs` entry now also runs `chat-recovery-native-scenario.mjs` in a disposable profile, workspace and SQLite database. A staged test-only server fault drops `message:sent` while preserving durable acceptance; the browser's real authenticated socket then checks one refused inquiry, one manual receipt readback, and one uncertain post-enqueue inquiry. The native case checks exact status/prompt counts and one durable receipt/exchange per attempt; it does not prove live provider failure causes, eventual reconnect after the injected socket throw, or Alpha health. Temporary fixture data and owned processes are removed afterward.

## Shared prepared material validation

`e2e/chat-material-insertion.spec.ts` exercises public global resource buttons, real composer controls, the installed Chat action consumer, existing exact-session stores and rendered text/pills. Its source fixtures control preparation delays without replacing destination validation or store mutation. Assertions cover active Main/Side, own-composer and adapterless placement targeting, source/destination separation, retained-focus survival, irreversible rebind/unmount/workspace/hydration/placement cancellation, latest-draft cursor behavior, pending/unknown acceptance, concurrent correlated screenshot results and all terminal cleanup paths. `threaded-chat-host.spec.ts` retains New Chat and exact component coverage while replacing Main/Legacy fallback and focus-only cancellation expectations. Screenshot menu layout assertions supplement these production route observations.

After a fresh client build, `node e2e/chat-material-native-scenario.mjs` runs the compiled shell in marker-owned profile/workspace staging on an ephemeral owned server port with explicit profile and machine identities. It captures actual global and own-composer Main/Side PNGs through Electron/preload and the current screenshot save handler, including native-adapted and adapterless hosts; reads signature, dimensions, hash and correlated saved path; observes the exact rendered pill and non-target preservation; and exercises actual gallery/resource staging. Insertion causes no prompt or New Chat frame. Subsequent public Send checks no optimistic bubble, exact server ACK clearing and SQLite exchange/attachment metadata readback. Its deterministic staged harness and bounded admission/ACK delay seams isolate acceptance regression; they do not certify a public provider, Alpha or transient draft restart persistence. Capture/save and persistence owners remain actual, and cleanup is confined to marker-owned fixture roots/PIDs.

The architecture renderer lane uses a free test-owned `CHAT_TRANSPORT_TEST_PORT` with `reuseExistingServer: false`; it must not reuse an owner server/profile/database. Current shared-chat changes require a fresh full-server `npx --no-install jest --runInBand` and fresh client `npm run build` from the assigned integration checkout, in addition to focused screenshot request/path protection and prompt recovery checks. Direct Jest does not run npm's native-observer pretest. If its ignored addon is absent in a fresh worktree, build unchanged native observer source locally through `build:native-observer`, without rebuilding shared modules, and bind its source/artifact/actual consumption separately. Each receipt records current source/build/dependency identity, exact commands/results, warnings and fixture limits; dated passes and equal historical hashes do not discharge fresh required runs.

## Startup retirement and guarded provenance

Startup or workspace-readiness changes run the production-entry `test/runtime/workspace-startup-integrity.test.js`, strict registry `test/runtime/isolated-provenance-runtime.test.js`, retirement `test/watch/watcher-retirement.test.js`, startup-order `test/event-registry/startup-integration.test.js`, and `test/views/readiness-startup.test.js`, together with coordinator/recovery, ledger, direct screenshot, Calendar, trigger, shutdown and save/tool provenance regressions. Source/dependency sweeps verify the retired workspace, screenshot-folder and Apple directory watchers remain absent. Ready-startup scratch canaries verify components/actions, legacy chat/ticket/agent/system event triggers, cron and runner setup under the held readiness lease. They do not launch a real autonomous worker.

After building the renderer, `node e2e/provenance/run-file-viewer-live.mjs` from the client runs normal and fact-publication-failure scenarios against the actual isolated server. Each scenario uses `NODE_ENV=test`, `Test-Provenance`, exactly two registered scratch workspaces, a marker-owned profile, a fresh non-3001 port and `reuseExistingServer: false`. The audit expects all seven startup effects and runtime harness HTTP revalidation to be blocked, with zero effect factories, filesystem watchers or children. The browser assertions retain registry authority, mediated-save/prewrite protection, postwrite recovery and narrowly scoped refresh behavior.

The launcher compares protected developer databases, the normal profile database, workspace bytes and repository Playwright output on both success and failure. Before nonce-checked scenario cleanup, it retains the content-free isolated audit and safe failure artifacts in a separate marker-owned temporary evidence directory. Raw traces receive only size/hash receipts because they can contain authentication material; their payloads are not copied. A failure keeps its original phase and error boundary, and evidence-finalization failure retains the original owned scenario directory for investigation. These fixture checks do not establish actual public provider operation.

Public OpenCode acceptance additionally uses the ordinary authenticated Electron shell with a disposable profile and an actually registered and selected scratch workspace. Observe the first and second New Chat selections, real prompt acceptance and canonical completion, the exact durable exchange, and passive reopening of the same thread. Provider-free fixtures, startup readiness, connection indicators, generic spawn success and redacted error markers cannot substitute for those observations. Any unperformed manual runtime step remains an explicit acceptance gap.

<!-- children:start -->
## Children

- [Chat Smoke Tests](001-Smoke_Tests/PAGE.md) - Vertical-slice smoke testing guidance for chat changes.
- [Chat Browser Playwright](002-Playwright_Browser/PAGE.md) - Browser Playwright configuration and when to use it for chat validation.
- [Chat Electron Playwright](003-Playwright_Electron/PAGE.md) - Target structure for future Electron Playwright coverage.
- [Fusion Restart](004-Fusion_Restart/PAGE.md) - Fusion restart script behavior and when to use it for chat validation.
<!-- children:end -->
