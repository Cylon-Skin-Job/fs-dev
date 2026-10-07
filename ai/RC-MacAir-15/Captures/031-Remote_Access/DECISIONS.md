# Remote Access Roadmap — Decisions

**Status:** `DRAFT_CANDIDATE`

Every material conclusion in this bundle cites one authority class:

- `owner_decision` — explicit direction from the product owner;
- `spec_contract` — behavior required by an accepted SPEC;
- `source_of_truth_contract` — durable product or architecture intent;
- `active_code_constraint` — current implementation fact affecting feasibility;
- `implementation_choice` — technical choice under one approved observable
  contract; or
- `proposal` — material new product choice requiring owner approval.

---

## RA-RD-001 — Host is a permanent sleep-disabled machine

- **Authority:** owner_decision
- **Status:** settled
- **Decision:** The serving machine is intended to be an always-on Mac Mini
  with sleep disabled. Laptop-as-host is not a supported topology.
- **Consequence:** Availability semantics, tunnel lifetime, and "host offline"
  messaging are designed around a mostly-always-up host. Sleep is handled by
  deployment configuration (deferral D-2), not product code.

## RA-RD-002 — One server capability, three client types

- **Authority:** owner_decision
- **Status:** settled
- **Decision:** The host runs one fusion-studio-server. Phone (browser), laptop
  remote mode (iframe of the served web client), and any future client are
  clients of that one server. There is no second server implementation.
- **Consequence:** Browser bootstrap (SPEC-02) and token trust (SPEC-03) are
  server-side capabilities consumed by every remote client type; the served
  `dist/` bundle must remain the single client artifact.

## RA-RD-003 — Remote mode is either/or with local, per client

- **Authority:** owner_decision
- **Status:** settled
- **Decision:** A client displays either its local instance or the remote
  host's instance, never both. Entering remote mode unmounts the local
  surface; exiting remote mode unmounts the remote surface (both full-surface
  switches unmount). The local app's server, watchers, triggers, and
  background work continue running regardless of which surface is displayed.
- **Consequence:** No dual-authority client state. Background work liveness is
  a server lifecycle property (verified by baseline tests), not a function of
  displayed surface; SPEC-04 and SPEC-05 assert it but do not re-architect it.

## RA-RD-004 — Remote surface is a full-viewport iframe; the host draws its own remote indicator

- **Authority:** owner_decision
- **Status:** settled
- **Decision:** In remote mode the remote instance is displayed as one
  full-viewport iframe that includes its own header and dropdowns. The host
  instance (the serving computer) renders the remote-connected indicator in
  its own header, drawn from server-authoritative client-kind state; the local
  client draws no local chrome in remote mode.
- **Consequence:** No header control bridging is required. Client kind must be
  known server-side (SPEC-05) and reflected in the initial workspace payload.
  The iframe's exit path is a narrowly scoped `postMessage` back to the parent
  (SPEC-05); the sandbox remains unchanged and never grants top navigation.

## RA-RD-005 — Device trust is a long-lived paired token, provisioned by QR/deep link, revocable per device

- **Authority:** owner_decision
- **Status:** settled
- **Decision:** Pairing requires physical proximity and possession (scan or
  open link on the host's screen). Tokens are long-lived until revoked;
  revocation from either side (host settings) removes the device. Token values
  live in the host's macOS Keychain via Secrets Manager; an index row carries
  metadata and a hash.
- **Consequence:** SPEC-03 owns mint/verify/revoke. There is no expiry-based
  re-pairing requirement. "Lost device" recovery is revocation, not password
  change.

## RA-RD-006 — Remote trust is a sibling lane to trusted-shell, never an extension of it

- **Authority:** owner_decision + spec_contract (CHAT-RD-015, CHAT-I-013) +
  active_code_constraint
- **Status:** settled
- **Decision:** The accepted trusted-shell role remains loopback/fd-3/HMAC
  only. Remote clients authenticate as a distinct role (`remote-device`)
  under SPEC-03. The design must never let a payload, URL, or request field
  assert `trusted-shell`, and must never pass a remote client through the
  fd-3 bootstrap path.
- **Consequence:** SPEC-03 adds a sibling credential path and refuses all
  shell-auth message families from remote clients; SPEC-05 grants the
  `remote-device` full mutation capability per RA-RD-011, subject only to the
  forbid gate. Desktop remote mode reaches the host over a loopback SSH tunnel
  precisely because the shell document's `connect-src` and descriptor contract
  permit only its own loopback origin.

## RA-RD-007 — Token handling: upgrade-header transport, hash at rest, constant-time compare

- **Authority:** implementation_choice under owner security intent
- **Status:** settled for SPEC-03 (contract-level, not file-level)
- **Decision:** The token is presented at WebSocket upgrade in the
  `Sec-WebSocket-Protocol` header and verified before the upgrade completes;
  unauthorized upgrades are refused with a bounded 401 and never transition
  into the product session map. HTTP provisioning (QR minting) is available
  only to a trusted-shell connection and is never exposed on a public route.
  Tokens are never placed in query strings or logged.
- **Consequence:** The browser client and iframe client each carry the token
  in the same header; the server's verification lives beside (not inside) the
  shell-auth owner.

## RA-RD-008 — Loopback default preserved; routable binding is explicit opt-in

- **Authority:** owner_decision + accepted SPEC-00 constraint
- **Status:** settled
- **Decision:** The server continues to bind `127.0.0.1` by default. Routable
  binding requires an explicit serve-host configuration and proceeds only when
  the operator has also enabled device trust (pairing) or is intentionally
  running trusted-network-only. A misconfigured combination fails closed and
  reports clearly; it never silently falls back to loopback or silently
  exposes an unauthenticated server.
- **Consequence:** SPEC-01 owns binding and refusal semantics; SPEC-03 owns the
  trust enable. LAN MVP order: SPEC-01 → SPEC-02 → SPEC-03 → SPEC-04 → phone.

## RA-RD-009 — LAN first, Tailscale layer later, PWA last

- **Authority:** owner_decision
- **Status:** settled
- **Decision:** Build and validate on the home LAN first, then layer Tailscale
  as a network extension (no product architecture change), then PWA polish.
- **Consequence:** The roadmap order is SPEC-01 → 02 → 03 → 04 → 05 → 06 with
  the Tailscale runbook as deferral D-1. No SPEC hardcodes addresses; clients
  derive origins from configured targets (SPEC-04) or the page origin
  (SPEC-02).

## RA-RD-010 — Host-side legacy symbol cleanup is inherited but separate

- **Authority:** spec_contract (SPEC-00 report final impact assessment)
- **Status:** settled (deferred to its owning lane)
- **Decision:** SPEC-00's report assigns "remove inert Fork-era symbols" to
  025 SPEC-01, not this bundle. This bundle does not touch them.
- **Consequence:** None for this roadmap; recorded so builders do not absorb it.

## RA-RD-011 — Paired devices have full mutation capability; a server config can forbid it

- **Authority:** owner_decision (2026-09-12: "I would want to be able to do
  whatever I want to do on my own machine"; "It needs to have the capability.
  We can set a config to forbid it.")
- **Status:** settled — resolves former R1
- **Decision:** A token-paired `remote-device` session has the same mutation
  capability as the trusted shell by default: workspace add/switch and the
  previously shell-only privileged thread routes all admit either role. A
  server configuration (`FUSION_REMOTE_MUTATIONS`; final surface fixed in
  SPEC-05) can forbid remote mutation capability, in which case remote
  sessions fall back to mirrored-equivalent bounded denials while view and
  chat read behavior continues. The forbid state is server-authoritative and
  per-server, never per-payload.
- **Explicit contract change recorded (supersedes for remotes only):** 025
  SPEC-00 gated privileged thread mutations on trusted-shell alone because no
  remote trust lane existed. This owner decision extends that gate to admit
  `remote-device`; the trusted-shell path, its HMAC proof, and its
  payload-cannot-assert-role rule are unchanged. This expansion is exactly the
  "broader protected-System permission model / general remote authentication"
  that CHAT-RD-015 and CHAT-I-013 deferred; the owner has now explicitly
  authorized it, and it must be recorded in the 025 lane's deviation surface
  when this bundle's SPEC-05 implements.
- **Consequence:** The capability matrix is uniform: any non-shell-auth
  mutation route accepts `trusted-shell` or `remote-device` capability, with
  remote capability subject only to the forbid gate. Pairing remains the trust
  boundary; revocation removes the capability with the device. SPEC-05
  implements the extended gate with full negative coverage; SPEC-03 supplies
  the role.

---
