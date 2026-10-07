# Remote Access Implementation Roadmap

**Roadmap status:** `DRAFT_CANDIDATE`
**Prepared:** 2026-09-12
**Execution model:** sequential SPEC implementation and owner acceptance

## 1. Outcome

A host Fusion Studio (permanent Mac Mini) serves remote clients without
changing local behavior:

1. The server can bind an explicit routable host when the operator opts in,
   with loopback remaining the default and unsafe combinations failing closed.
2. A page served by the host bootstraps the runtime transport without
   Electron, using a same-origin browser lane while the Electron lane keeps its
   exact accepted descriptor contract.
3. A paired device token, provisioned by QR/deep link and stored via Secrets
   Manager, authenticates remote clients at WebSocket upgrade; devices are
   individually revocable, and tokens never transit URLs or logs.
4. The laptop's desktop client gains remote targets and a tunnel manager; the
   header actions menu switches full surfaces — remote mode is a full-viewport
   iframe, local mode is the existing app, both unmounting on switch.
5. The host knows a connection is remote and draws the remote indicator in its
   own header; a narrowly scoped exit path returns the client to local mode.
6. The phone gets a PWA home-screen shell and pairing screen over the same
   server capability.

Tailscale is a deployment deferral (D-1), not product code: at completion the
same client builds work on LAN today and on a tailnet later with only the
configured origin changing.

## 2. Ordered SPECs

| Order | SPEC | Domain | Prerequisites |
|---:|---|---|---|
| 01 | `SPEC-01-HOST-SERVICE-AND-BIND.md` | Opt-in routable bind, refusal semantics, operator evidence | accepted SPEC-00 authority; clean baseline recorded |
| 02 | `SPEC-02-BROWSER-CLIENT-TRANSPORT.md` | Same-origin browser bootstrap lane; Electron lane contract preserved | accepted SPEC-01 |
| 03 | `SPEC-03-DEVICE-PAIRING-AND-TOKENS.md` | Secrets Manager device sub-module, QR/deep-link provisioning, upgrade-time verification, revocation | accepted SPEC-02 |
| 04 | `SPEC-04-REMOTE-CONNECTION-MANAGEMENT.md` | Desktop target store, SSH tunnel manager, full-surface mode switch (unmount both) | accepted SPEC-03 |
| 05 | `SPEC-05-CLIENT-AWARE-REMOTE-SURFACE.md` | Client-kind propagation, host-drawn remote indicator, exit protocol, paired-device capability parity with forbid gate | accepted SPEC-04; R1 resolved as RA-RD-011 |
| 06 | `SPEC-06-PWA-AND-PHONE-SHELL.md` | PWA manifest/icons, pairing screen, phone shell CSS | accepted SPEC-03; accepted SPEC-02; independent of R1 |

## 3. Dependency Graph

```text
accepted SPEC-00 trusted-shell authority
(agent/exact-workspace-paths, 2026-09-07)
              |
              v
SPEC-01 Host Service And Bind
              |
              v
SPEC-02 Browser Client Transport
              |
              v
SPEC-03 Device Pairing And Tokens
        |               |
        |               +----------------------+
        v                                      v
SPEC-04 Remote Connection Management      SPEC-06 PWA And Phone Shell
        |
        v
SPEC-05 Client-Aware Remote Surface
(RA-RD-011 resolved: capability parity + forbid gate)
```

SPEC-06 may execute any time after SPEC-02 and SPEC-03 are accepted; it does
not depend on SPEC-04 or SPEC-05 and does not consume RA-RD-011. The
recommended execution order remains numeric; a deliberate reordering of 06
before 04 is permitted only with owner approval recorded in the release
manifest.

## 4. Cross-SPEC Contracts

1. **One server, one client bundle.** The host serves `fusion-studio-client/dist`
   and the existing HTTP/WS application. No SPEC adds a second server or a
   separate remote client build.
2. **Loopback default.** Binding is `127.0.0.1` unless an explicit serve-host
   is configured; a routable bind is valid only when device trust is enabled
   or the operator explicitly accepted network-perimeter trust, and invalid
   combinations fail closed with a bounded, documented error.
3. **Two trust lanes, one role model.** `trusted-shell` remains exactly as
   accepted: non-enumerable session role set only by the fd-3 HMAC handshake.
   `remote-device` is a sibling role set only by successful token verification
   at upgrade. No payload, URL, or request field may assert either role, and no
   remote client may traverse shell-auth message families. Per the resolved
   RA-RD-011, `remote-device` holds full mutation capability equal to
   `trusted-shell` by default, with the server config `FUSION_REMOTE_MUTATIONS`
   able to forbid remote mutation capability.
4. **Token handling.** Tokens are long-lived, per-device, provisioned only over
   a trusted-shell connection, stored as Keychain values with hash-bearing
   index rows, compared in constant time, transported only in the
   `Sec-WebSocket-Protocol` upgrade header, and never logged.
5. **Descriptor lanes.** The Electron runtime descriptor remains exact
   `127.0.0.1` http/ws. The browser lane derives its descriptor from the page
   origin and is valid only for pages served by the same origin it connects
   to. A browser page never receives or fabricates the Electron lane.
6. **Either/or surfaces.** A client displays local or remote, never both, and
   unmounts the departing surface. Background server work continues while a
   surface is unmounted; this is asserted, not re-implemented.
7. **Server-authoritative client kind.** A remote session's kind is known
   server-side from its authenticated connection and reflected in the initial
   workspace payload; the remote indicator is drawn by the host instance. The
   client kind rides existing initialization plumbing; no new message family.
8. **Exit is the only remote→local command.** The full-viewport iframe's only
   privileged parent interaction is a validated `postMessage` exit request. The
   sandbox and navigation policy are unchanged and never grant top navigation.
9. **No address hardcoding.** No client code embeds a host address; origins
   come from configured targets or the page origin, so LAN → Tailscale is a
   configuration change only.
10. **Per-connection state only.** No server-global "remote mode" is
    introduced; concurrent host-local and remote sessions retain independent
    roles and kinds.

## 5. Per-SPEC Acceptance

Every SPEC follows `GUIDANCE.md`:

1. one fresh `spec-slice-builder` per slice, builder-owned fresh review until
   clean, returning `READY_FOR_ORCHESTRATOR_REVIEW`;
2. orchestrator-owned fresh `spec-gate-reviewer` passes until clean, returning
   `READY_FOR_SUPERVISOR_REVIEW`;
3. supervisor presentation to the owner and explicit `ACCEPTED` per SPEC
   before the next SPEC dispatches;
4. the minimum whole-SPEC commands plus each SPEC's targeted checks; and
5. no SPEC begins a later SPEC's behavior.

## 6. Roadmap Completion

The roadmap is complete when every SPEC is accepted and the integrated state
satisfies:

1. a served browser page on a routed LAN origin reaches a connected,
   functional workspace through the browser lane;
2. an unpaired origin receives bounded refusal and no product session;
3. a paired phone and a paired laptop remote mode both reach the host, with
   revocation demonstrably terminating access;
4. the laptop's remote mode is a full-viewport remote instance including its
   own header and remote indicator, and switching back restores the local
   instance immediately with background work uninterrupted throughout;
5. the local desktop path, trusted-shell authority, and all protected accepted
   contracts (025/026 lanes) are unregressed; and
6. the Tailscale runbook (D-1) and sleep configuration (D-2) are documented as
   operator steps with no code dependency on them.

## 7. Explicit Deferrals

See `ISSUES.md` D-1 through D-4. None blocks any SPEC.
