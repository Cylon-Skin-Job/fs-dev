---
name: Chat Testing And Operations
description: Vertical smoke tests, browser Playwright, Electron Playwright, and Fusion restart guidance for chat work.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Smoke Tests
    - Chat Browser Playwright
    - Chat Electron Playwright
    - Fusion Restart
  source-files:
    - fusion-studio-client/playwright.config.ts
    - fusion-studio-server/server.js
  connected-skills: []
  related-trigger-files: []
---

Use this section before validating chat changes.

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

Privileged-thread changes additionally prove the decoded public route through
the thread-domain guard: trusted New Chat, exact-session resume, Rename,
Delete, Touch, Warm, and prompt-triggered activation reach their existing
owners; raw/standalone/request-asserted authority
receives one fixed denial before manager, provider, persistence, mirror, UEB,
or fan-out effects; and passive open is asserted against real SQLite and mirror
bytes to prove it does not write resume/MRU or list state. Public-route tests
also submit foreign-workspace IDs to passive open, assistant activation, Warm,
prompt, Rename, Delete, and Touch and assert no foreign data or durable/provider
effect. A deterministic A-to-B window canary proves passive open/list/link and
search cannot use A's manager after B binds and resume normally only
after B's matching panel manager is installed. Deterministic lifecycle tests cover post-switch live-root resolution,
concurrent B/C activation ordering, workspace switching during an awaited
activation, binding-time Rename/Delete/Touch, binding during awaited
Create/Resume, prompt persistence/provider admission ordering, and injected
session-open failure. They also exercise same workspace/thread identifiers at
different roots and epochs, explicit idle-owner epoch adoption, same-wire
owner restoration when predecessor retirement fails, and target exit during
an awaited predecessor close. Workspace-switch canaries also prove the old provider
delivery owner is unregistered and suspended before the new bind frame, and
that a delayed assistant-resume list cannot disclose the retired manager; they require one final owner,
no orphan child, and no readiness frame before ownership commits. Fork is tested as an
unconditional no-effect denial for public requests, inbound configuration, and
stored legacy provider state. AST-based static spawn inventory and real child
canaries cover every harness/CLI launch family,
showing that required allowlisted values arrive while shell authority and
unknown host values do not. The canaries also prove probes receive no provider
credentials and Codex, Claude, Gemini, Qwen, Kimi, and multi-provider OpenCode
runtime children receive only their documented adapter credential sets. The
static gate fails closed on CommonJS and ESM imports, dynamic imports and
built-in-module acquisition, detached or wrapped launch references, mutable or
shadowed builder/environment bindings, prebuilt environment objects, and
options spreads or computed properties that could replace the verified
environment owner.
Same-thread-id two-workspace canaries additionally cover lifecycle state,
status/audit correlation, exact manager-root and adapter-session identity,
exactly targeted watcher mutation collection, unique-active-turn attribution,
ambiguous/partial watcher suppression, lifecycle fan-out, and provider
output/exit/retirement after client ownership transfer. Executable adapter
tests consume canonical iterators and exercise provider stop signals; prompt
selection tests prove explicit nullable variants clear prior state.
Held-effect canaries prove workspace retirement and shutdown do not outrun
asynchronous audit or legacy event-ledger work.
The isolated agent-tool provenance route never creates a thread from public
input: startup provisions one fixed provider-free fixture thread before listen,
and raw fixture requests can only passively select that exact identity in its
process-provisioned workspace. A real two-workspace switch canary omits the new
panel installation and proves the stale-manager window returns the fixed
unavailable response with no history, authority, filesystem, database, UEB,
ledger, result, or fan-out effect.

<!-- children:start -->
## Children

- [Chat Smoke Tests](001-Smoke_Tests/PAGE.md) - Vertical-slice smoke testing guidance for chat changes.
- [Chat Browser Playwright](002-Playwright_Browser/PAGE.md) - Browser Playwright configuration and when to use it for chat validation.
- [Chat Electron Playwright](003-Playwright_Electron/PAGE.md) - Target structure for future Electron Playwright coverage.
- [Fusion Restart](004-Fusion_Restart/PAGE.md) - Fusion restart script behavior and when to use it for chat validation.
<!-- children:end -->
