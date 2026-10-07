# SPEC-03 — Protected browser HTTP and WebSocket ingress

Status: DRAFT candidate. Prerequisite: accepted SPEC-02.

## Execution packet

Read BUNDLE-INDEX.md, DECISIONS.md, ROADMAP.md, GUIDANCE.md and ISSUES.md in this directory. GUIDANCE.md's fresh builder/reviewer lifecycle applies to each slice below without exception. Each slice is a complete public-route increment, including necessary integration and its checks. A new builder handles the next slice only after orchestrator review is clean. Record every deviation and its consumers. Owner acceptance is required before the following SPEC.

Baseline: record the accepted current commit, relevant dirty paths and existing test results at dispatch. The planning snapshot is not a frozen execution branch. No live profile/DB mutations in fixtures. No migration may rewrite existing machine identities, workspaces, transcripts or view state. New module names below are proposed owner locations; if existing owners suffice, use them and report the mapping.

## Exact code standards

Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Read fully, plus:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

## Objective and scope

Expose a disabled-by-default browser listener bound to exact IPv4 loopback in the SAME Node process/runtime. Tailscale Serve will target it. Protect every product read, resource, mutation and socket before it reaches existing services. Do not broaden the legacy Electron listener bind, trust proxy identity headers or duplicate business logic/runtime/database.

## Authorities and expected areas

BR-D09/D10/D16, Chat overview and existing shell SPEC/report. Owners: `server.js`, `lib/startup.js`, `lib/startup-loopback.js`, `lib/shutdown.js`, `lib/ws/{shell-auth-dispatch,product-session-registry,transport-connection-registry,deferred-product-connection,server-runtime-activation,client-message-router}.js`, HTTP routers and static mounts, `lib/views/panel-paths.js`. Add dedicated browser listener/admission module, reuse product activation and route factories. The two-listener technical choice keeps the accepted local shell surface intact; it is not a second application backend.

## Contract

Persist remote enable flag, canonical external HTTPS origin and fixed nonzero browser loopback port under System configuration; all writes local trusted-shell-only. Validate origin as a bare https origin, without path/query/userinfo/fragment. Require a distinct available port from the Electron runtime port; reject conflict and malformed settings without changing local service. Configure outer origin explicitly; never derive authority from Host, forwarded headers, Tailscale identity headers or an unverified request. Deployment maps only this listener. Client sees no internal port.

Remote listener is unavailable until DB/startup audit/domain handler owners/runtime barrier are ready. No insecure fallback if credentials, origin or config are invalid. Disabling closes browser listener, pending claims, sockets and resource streams; registrations persist for later re-enable. Desktop remains available. Remote mode is allowed only in a managed authenticated host runtime for MVP; naked standalone `node server.js` does not obtain owner or remote access merely by environment flags.

Public allowlist: pairing/login HTML and its built code/style/icon/font assets, bounded enrollment endpoints and non-sensitive health/readiness status. Product data, configuration, filesystem, screenshots, transcription, capability/harness metadata, calendar and user CSS are protected. SPA fallback must not turn unknown API paths into success HTML. Before protected HTTP or WS dispatch, verify browser cookie and mint a private principal through SPEC-01. All remote requests use registered action/resource authorization; no implicit allow for future handlers. Remote shell-auth/admin frames are refused. Shell-origin spoofing at the browser listener never selects the local authentication lane.

Reuse existing deferred product connection, transport registry, workspace bind and activation barrier. Extend product registry with a browser authentication-kind branch requiring the privately minted verified principal; do not simply allow a client-provided `connectionRole` string. No product factory, history, watcher initialization or recipient membership before remote authentication. Apply existing bounded frame sizes/timeouts, close/cleanup supervision and generation fencing to both ingress types.

Only exact configured HTTPS Origin is accepted for WebSocket upgrades and remote state-changing HTTP. Reject absent/null/foreign Origin for these browser operations. Require a session-bound CSRF token on authenticated HTTP mutations; fetch it through authenticated same-origin session bootstrap, never log it. No permissive CORS. Safe reads need a valid cookie except public allowlist. Reject misleading Host/forwarded routing values according to the documented Serve header contract verified in SPEC-07; proxy headers may explain transport but never confer authority. Request cookies are redacted before logging. No request-body authentication secrets in access logs.

Remote responses use no-store for sensitive data and session/pairing documents; no service worker/cache of private content. Workspace-authored HTML must not execute as privileged same-origin script: content-disposition or sandboxed opaque-origin presentation with a restrictive CSP, preserving source-owned path checks. Do not promote arbitrary custom views, localhost apps or script content into the authenticated shell origin. SPEC-05 maps unsupported custom surfaces visibly; native Electron content policy remains intact.

Revocation is checked at each HTTP request and each WS command before domain dispatch and before publishing further product payloads to that registration. Disconnect affected sockets/long-lived streams promptly; no credential renewal. Queued but not accepted commands are denied. Already accepted domain operations are not rolled back. SPEC-04 subsequently changes remote accepted-turn lifetime so revocation detaches a browser without terminating the shared turn; SPEC-03 must expose the teardown reason and integration seam but does not implement that lifetime change early. Document bytes already sent cannot be recalled.

## Slices

### 03A — Listener plus protected HTTP resources

Compose shared route factories behind separate local/browser middleware stacks. Add route inventory proving protection of every remotely mounted HTTP/static/resource endpoint; unknown routes denied. Start isolated production composition behind test HTTPS proxy. Pair through real routes, fetch scratch resource authenticated, deny same request unauthenticated/revoked. Test path traversal, untrusted HTML containment, cookie/CSRF/origin checks, disabled listener and port conflict. Do not expose production settings until coverage complete.

Check: `cd fusion-studio-server && npx jest --runInBand test/remote-access/http-ingress.test.js test/remote-access/route-inventory.test.js test/remote-access/listener-lifecycle.test.js test/http/panel-file-route.test.js test/http/view-config-route.test.js`.

### 03B — Authenticated WS activation and policy dispatch

Share product connection factory without duplicate runtime state. Connect browser through actual upgrade and cookie verification, enter existing initialization barrier/workspace epoch path, then exercise full-access reads and thread/file mutations via normal handlers. Shell fd-3 remains local-only. Verify copied role/policy/body/header claims cannot bypass authentication, and no remote access to enrollment administration. Test auth-expiry/pending close, restart generation and initialization failure cleanup.

Check: `cd fusion-studio-server && npx jest --runInBand test/remote-access/ws-ingress.test.js test/remote-access/route-inventory.test.js test/ws/shell-auth-public-route.test.js test/ws/shell-auth-recipient-isolation.test.js test/ws/server-runtime-activation.test.js`.

### 03C — Revocation, shutdown and mixed-client regression

Test real HTTP request and WS fan-out/queued command denial after durable revoke, disable and shutdown. Attach one local shell, authorized browser and unauthenticated socket: only eligible recipients receive data. At this stage preserve current turn cleanup; SPEC-04 owns the new survival behavior. Re-run this boundary after SPEC-04 integration. Do not force-cancel already committed operations. Exercise all registered action categories and prove no HTTP bypass around WS policy. Run full server suite and GUIDANCE Electron targeted tests.

Check: `cd fusion-studio-server && npx jest --runInBand test/remote-access/revocation-integration.test.js test/remote-access/mixed-client.test.js test/remote-access/listener-lifecycle.test.js`; full server tests; Electron targeted checks.

## Migration and compatibility

Config uses SPEC-02 storage; extend with additive migration if needed. Default disabled means upgrading existing desktop profiles opens no port beyond existing local service. Never migrate raw local untrusted sessions into owner registrations. Invalid remote settings isolate their failure instead of corrupting local descriptor. All local endpoints retain their accepted behavior; local HTTP is NOT claimed to acquire remote protection and MUST NEVER be the Serve target.

## Final SPEC acceptance

All remotely reachable surfaces are classified and fail closed; remote sessions cannot impersonate shell; full-access product route parity is verified; auth and lifecycle races have public-route tests. Remote owner origin is fixed and resources do not leak through SPA/static bypasses. Regression surface: route mount ordering, startup/shutdown, session/broadcast recipient eligibility and shared domain dispatch.
