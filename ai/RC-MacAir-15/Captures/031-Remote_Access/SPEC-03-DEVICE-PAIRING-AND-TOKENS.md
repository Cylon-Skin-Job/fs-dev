# SPEC-03 — Device Pairing And Tokens

**Status:** `DRAFT_CANDIDATE — REVIEW REQUIRED`
**Domain owner:** Remote device trust, Secrets Manager store, and upgrade-time verification
**Prerequisite:** accepted SPEC-02
**Blocks:** SPEC-04, SPEC-05, SPEC-06
**Does not depend on:** iframes, desktop targets, PWA assets

## 1. Objective

Establish the remote trust lane: the host mints long-lived per-device tokens,
provisioned by QR/deep link, stored as Keychain values behind Secrets Manager
index rows, presented by clients at WebSocket upgrade, verified before the
upgrade completes, and revocable individually. Trusted-shell authority and the
fd-3 bootstrap are untouched; a remote client can never assert `trusted-shell`.

## 2. Authorities And Baseline

Read before implementation:

- bundle planning docs; RA-RD-005, RA-RD-006, RA-RD-007, RA-RD-008; RA-I-001,
  RA-I-005, RA-I-006, RA-I-008, RA-I-009;
- accepted SPEC-00 `shell-auth.js`, `shell-auth-dispatch.js`,
  `trusted-shell-authority.js` (reference only for the sibling boundary);
- `lib/secrets/index.js` aggregator contract, `lib/secrets/api-keys/backend.js`
  (index+Keychain+rollback pattern), `lib/secrets/clipboard/keychain.js`
  (`/usr/bin/security` pattern), `lib/secrets.js` (`KEY_PATTERN`, `ACCOUNT`);
- `server.js` WebSocket server construction and upgrade path,
  `lib/ws/product-session-registry.js`, `lib/ws/transport-connection-registry.js`;
- migration directory head (re-determine at dispatch; do not hardcode).

Record at dispatch: baseline commit, `lib/secrets` tests, shell-auth suite
(which must remain behaviorally byte-identical), and migration head.

## 3. Scope

### In scope

- a `remote-device` sub-module appended to the Secrets Manager aggregator:
  - SQLite index table (migration adds it; next free number determined at
    dispatch) holding device label, token hash, created/last-seen timestamps,
    and revocation state — never the token value;
  - Keychain value storage using the existing `/usr/bin/security` pattern
    (`ACCOUNT=fusion-studio`, service `remote-device:<id>`), with an injectable
    seam for tests;
- pairing mint: a trusted-shell-authored message family (e.g.
  `pairing:create_request` / `pairing:list_request` / `pairing:revoke_request`)
  that mints a token, returns a deep link
  `{origin}/#pair={base64url(JSON {v,label,token})}`, and lists/revokes
  devices; QR rendering is a client concern in SPEC-05/06, this SPEC returns
  the link;
- upgrade-time verification: a token presented in `Sec-WebSocket-Protocol`
  is validated before upgrade completion — resolve device by token prefix,
  constant-time compare of the stored hash, reject with bounded 401 on any
  failure; success sets the non-enumerable session role `remote-device` and
  client kind `remote`;
- dispatch integration: a connection proven by token skips shell auth and
  initializes; when remote trust is enabled, every unproven upgrade is refused
  before the product connection is constructed;
- revocation: deleting the index row + Keychain entry; an established or
  subsequent connection from a revoked device is closed on next verification
  or reconnect; no re-keying of other devices;
- refusal/redaction rules: tokens never appear in URLs, query strings, logs,
  error text, or analytics; refusal messages are bounded and uniform.

### Out of scope

- R1 mutation authority (SPEC-05, owner decision);
- token expiry/rotation;
- multi-host registries or cross-host pairing;
- account systems, passwords, OAuth, or any identity beyond possession+proximity;
- QR image rendering libraries (client side);
- changes to shell-auth files, other than a dispatch seam that selects lanes
  (shell-auth itself must remain behaviorally identical and its suite
  untouched).

## 4. Contract

1. **Mint authority.** Only a `trusted-shell` session may mint, list, or
   revoke device tokens. No public HTTP route exposes any pairing operation.
2. **Token shape.** A token is a high-entropy URL-safe string with a
   retrievable device prefix; the stored hash is SHA-256 over the full token;
   comparison is constant-time. Raw tokens exist only in the mint response to
   the trusted shell, the Keychain value, and the provisioned client store.
3. **One role, one lane.** Token success sets exactly `remote-device` (plus
   client kind). It never sets `trusted-shell`; no message typed `shell-auth:*`
   is ever processed on a remote session; a payload cannot assert any role.
4. **Upgrade gate.** With remote trust enabled and a non-loopback bind, an
   upgrade without a valid token is refused pre-upgrade with a bounded status;
   it never enters the product session registry. With trust disabled, behavior
   equals accepted SPEC-01 semantics (trusted-network mode).
5. **Revocation semantics.** Revocation removes the device atomically
   (index + Keychain with rollback); subsequent verification fails closed.
6. **Secret hygiene.** Token values are never logged; index rows never contain
   values; test isolation uses temporary service names/databases and never the
   real Keychain namespace or `data/fusion.db`.

## 5. Dependency-Ordered Slices

### Slice 03A — Secrets sub-module and migration

- Migration + index table; backend module (mint, verify-hash, list, revoke)
  with rollback-safe atomicity; injectable Keychain seam; unit tests including
  duplicate/rollback/revocation cases.
- Expected areas: `lib/secrets/remote-device/**`, migration file, migration
  oracle test, focused unit tests.

### Slice 03B — Pairing handlers and mint/deep-link contract

- Trusted-shell-gated `pairing:*` handlers; deep-link payload builder and
  validation; refusal for untrusted callers (bounded error, no state change);
  tests prove only trusted-shell may mutate and the link is deterministic for
  fixed inputs.
- Expected areas: `lib/secrets/remote-device/handlers.js`, `lib/secrets/index.js`
  aggregator, client-message or router registration, focused tests.

### Slice 03C — Upgrade-time verification and dispatch integration

- Pre-upgrade token verification per §4.3/§4.4; role/kind assignment; dispatch
  lane selection; refusal evidence (bounded 401, no product session);
  revocation live behavior; tests including wrong-token, revoked, malformed,
  role-assertion attempts, and shell lane untouched.
- Client counterpart in this slice: the browser lane supplies the token from a
  bootstrap token source (fragment `#pair=` parsing + origin-scoped storage),
  injected as the WebSocket subprotocol; tests for fragment consumption,
  scrubbing, and reconnection with the stored token.
- Expected areas: server upgrade path (server.js or a dedicated ws module),
  `shell-auth-dispatch.js` lane selection seam, transport token source,
  focused tests both sides.

## 6. Required Verification

1. `cd fusion-studio-server && npm test`
2. `cd fusion-studio-client && npm run build`
3. Focused: secrets sub-module unit suites; upgrade verification suite;
   dispatch lane tests; shell-auth suite unchanged and passing.
4. Served-page smoke extension: paired token connects; unpaired/revoked/
   malformed refused with bounded result; fragment is scrubbed from the URL
   after storage; token never present in server logs during the smoke.
5. Restart evidence: mint survives restart (index + Keychain), revocation
   survives restart.
6. Migration oracle includes the new migration.

## 7. Expected Changed Areas

- `fusion-studio-server/lib/secrets/remote-device/**` (new);
- `fusion-studio-server/lib/secrets/index.js` aggregator;
- one new migration + migration oracle test;
- server upgrade path and/or `lib/ws/` module for verification;
- `shell-auth-dispatch.js` lane-selection seam (shell-auth itself untouched);
- client token bootstrap source + transport subprotocol injection + tests;
- docs note on pairing and revocation.

## 8. Definition Of Done

- Mint/list/revoke work only from trusted shell; remote clients authenticate
  at upgrade only, are bounded-refused otherwise, and receive exactly the
  `remote-device` role; revocation is immediate and durable; secrets hygiene
  proven; shell-auth unchanged; all checks pass; deviations recorded; no later
  SPEC behavior present.
