# Remote Access Roadmap Bundle Index

**Bundle status:** `DRAFT_CANDIDATE`
**Prepared:** 2026-09-12
**Owner:** Fusion Studio product owner
**Execution:** sequential SPEC orchestration with explicit owner acceptance between SPECs

## 1. Outcome

Deliver remote access to a Fusion Studio host machine (the intended permanent
host is a sleep-disabled Mac Mini) through three client relationships over one
server capability:

1. a **browser client** — the server already serves the built web client from
   `dist/`; the browser client currently disconnects because the runtime
   transport requires the Electron-only descriptor. It must bootstrap without
   Electron;
2. a **desktop remote client** — the laptop's Fusion Studio gains a remote
   target affordance in its header actions menu (extending the existing menu
   system) that, in remote mode, displays a full-viewport iframe of the remote
   instance and unmounts the local surface;
3. a **phone client** — Mobile Safari at the host's address, later wrapped as a
   home-screen PWA.

Trust for remote clients is a **paired device token** (QR/deep-link
provisioning, long-lived, individually revocable) stored in the host's
Secrets Manager (SQLite index + macOS Keychain values) and verified at WebSocket
upgrade time. Per the resolved RA-RD-011, a paired `remote-device` holds full
mutation capability (a server config can forbid it). This is the "general
remote authentication" lane that `025-Chat_Composition_Roadmap` SPEC-00
explicitly deferred; it is additive and must never weaken the accepted
trusted-shell authority.

Tailscale itself is deployment configuration, not product code: this bundle
makes the host servable and remotely reachable on a LAN or tailnet; the Tailscale
runbook is a documented deferral with an explicit future trigger.

## 2. Normative Bundle Artifacts

| Order | Artifact | Purpose | Status |
|---:|---|---|---|
| 00 | `DECISIONS.md` | Owner decisions and reconciled bundle choices | draft |
| 00 | `ISSUES.md` | Gates, feasibility facts, and deferrals | draft |
| 00 | `GUIDANCE.md` | Builder, reviewer, deviation, and acceptance lifecycle | draft |
| 00 | `ROADMAP.md` | Dependency order and roadmap completion contract | draft |
| 01 | `SPEC-01-HOST-SERVICE-AND-BIND.md` | Opt-in routable host binding with loopback default preserved | draft |
| 02 | `SPEC-02-BROWSER-CLIENT-TRANSPORT.md` | Browser bootstrap lane and descriptor contract, Electron lane strict | draft |
| 03 | `SPEC-03-DEVICE-PAIRING-AND-TOKENS.md` | Secrets Manager device tokens, QR provisioning, upgrade-time verification | draft |
| 04 | `SPEC-04-REMOTE-CONNECTION-MANAGEMENT.md` | Desktop remote targets, tunnel manager, mode switch | draft |
| 05 | `SPEC-05-CLIENT-AWARE-REMOTE-SURFACE.md` | Client-kind propagation, remote indicator, mutation authority extension | draft |
| 06 | `SPEC-06-PWA-AND-PHONE-SHELL.md` | PWA manifest, pairing screen, mobile shell CSS | draft |
| gate | `CLEAN-ROOM-REVIEW.md` | Review result for the exact current candidate | draft |
| gate | `RELEASE-MANIFEST.md` | Ordered hashes, candidate ID, deferrals, and approval record | draft |

## 3. Authority Order

1. Explicit owner direction in the conversation and `DECISIONS.md`.
2. The approved current candidate after owner approval.
3. Accepted `025-Chat_Composition_Roadmap` SPEC-00 trusted-shell authority and
   its implementation report (`OWNER_ACCEPTED — INTEGRATED`, acceptance
   `agent/exact-workspace-paths`, 2026-09-07).
4. Active Fusion Studio Code Standards and the Chat System wiki pages SPEC-00
   updated.
5. Active code and tests as feasibility constraints, not product authority.
6. `001-Captures/machine-sync-sharing-model.md` as requirement provenance for
   the Tailscale deferral only.

## 4. Source Inputs

### Owner intent

- Conversation of 2026-09-12 (this session): architecture settled across
  host/tunnel/Tailscale discussion, paired-token decision, full-screen
  iframe, unmount-both surfaces, server-drawn remote indicator.
- `../001-Captures/machine-sync-sharing-model.md` — Tailscale appears in the
  product's own architecture records as the networking layer for future
  remote/hub work.

### Accepted authority consumed

- `../025-Chat_Composition_Roadmap/SPEC-00-TRUSTED-FUSION-SHELL-AUTHORITY.md`
- `../025-Chat_Composition_Roadmap/SPEC-00-IMPLEMENTATION-REPORT.md`
- `../025-Chat_Composition_Roadmap/DECISIONS.md` — CHAT-RD-015 ("without
  absorbing … a general remote-account authentication platform") and
  `../025-Chat_Composition_Roadmap/ISSUES.md` CHAT-I-013 ("general remote
  authentication remain separate").

### Current architecture

- `../../../../AGENTS.md`, `~/projects/fs-dev/fusion-studio-server/AGENTS.md`,
  `~/projects/fs-dev/fusion-studio-client/AGENTS.md` (if present)
- Code surfaces enumerated in each SPEC's "Authorities And Baseline" section.

## 5. Structural Facts The Bundle Depends On

These were verified in the implementation checkout on 2026-09-12 and are
feasibility constraints, not product authority:

1. `server.js` already serves `fusion-studio-client/dist` and the full HTTP API
   plus SPA fallback (`server.js:134-177`). No new web server is needed.
2. The server binds exact IPv4 loopback (`startup.js:55`,
   `startup-loopback.js`) and rejects any other host by construction.
3. The renderer transport requires the Electron-only descriptor:
   `runtime-transport.ts:286` disconnects without `window.electronAPI`, and
   `validateRuntimeDescriptor` accepts only exact `127.0.0.1` http/ws URLs
   (`runtime-transport.ts:51-59`).
4. The trusted-shell role is a non-enumerable `session.connectionRole ===
   'trusted-shell'` set only by the fd-3 HMAC handshake
   (`lib/ws/shell-auth.js`), and mutation routes gate on it
   (`lib/ws/trusted-shell-authority.js`; consumed by
   `client-message-router.js`, `workspace-request-handlers.js`,
   `privileged-thread-guard.js`).
5. Standalone launch (no fd-3 authority) already exists and runs untrusted:
   `shell-auth-dispatch.js` initializes standalone connections with the
   non-enumerable `untrusted` role only.
6. The iframe machinery is policy-free at the surface layer
   (`IframeSurface`); `CustomViewer.tsx` owns the localhost-only policy.
7. `lib/secrets/index.js` is a designed aggregator ("future sub-modules …
   append to the handler map"), and the API-keys backend already implements
   SQLite index + Keychain value storage with rollback-safe atomicity.
8. Migration head is `040_reported_ui_context.js`; the next migration number is
   **not** reserved and must be re-determined at dispatch.
9. `index.html` has no PWA metadata; the client ships Material Symbols via a
   server mount at `/material-symbols` resolved from the fixed `fusion-home`
   workspace row (`startup.js:729-739`), so remote clients receive icons
   independent of the active workspace.
10. Shell CSP permits remote frames (`frame-src fusion-studio: http: https:
    data: blob:`) but restricts the shell document's `connect-src` to its own
    local server origin (`shell-protocol.cjs:48`) — remote connections are
    therefore a separate document lane (tunnel loopback or browser page), never
    the shell document.

## 6. Bundle Boundaries

- This bundle does not modify `lib/ws/shell-auth.js`, `shell-bootstrap.js`,
  `shell-protocol.cjs`, `shell-navigation-policy.cjs`, or `CustomViewer.tsx`
  policy behavior. SPEC-05 extends `trusted-shell-authority.js` and its
  consumers per the owner-authorized RA-RD-011 (paired-device capability
  parity with a forbid gate) and never weakens the trusted-shell role, its
  HMAC proof, or the payload-cannot-assert-role rule.
- This bundle does not implement Tailscale, Tailscale Serve, MagicDNS, or
  certificate provisioning; those are deployment runbook steps (deferral D-1).
- This bundle does not implement multi-host synchronization, hub collaboration,
  offline fork-on-conflict, or the machine-sync model's later features.
- This bundle does not redesign chat, threads, tabs, or provenance.
- Mobile visual redesign beyond the app-shell CSS required to make the existing
  UI usable in a phone viewport is out of scope for everything except the
  explicitly bounded responsive work of SPEC-06.
