# SPEC-01 — Host Service And Bind

**Status:** `DRAFT_CANDIDATE — REVIEW REQUIRED`
**Domain owner:** Server process configuration and binding
**Prerequisite:** accepted SPEC-00 trusted-shell authority; recorded clean baseline
**Blocks:** every later SPEC in this bundle
**Does not depend on:** pairing, browser transport, Electron, or any UI behavior

## 1. Objective

Allow the Fusion Studio server to listen on an explicit, validated routable
host when the operator opts in, while preserving exact loopback as the default
and failing closed on invalid combinations. At acceptance, existing local
behavior is byte-for-byte unchanged; a deliberately configured host serves the
same server + client build on the LAN (later tailnet) interface.

## 2. Authorities And Baseline

Read before implementation:

- `BUNDLE-INDEX.md`, `DECISIONS.md` (RA-RD-008, RA-I-003, RA-I-011),
  `ISSUES.md`, `GUIDANCE.md`, `ROADMAP.md`;
- repository `AGENTS.md` and server `AGENTS.md`;
- Code Standards: Architecture Routing, Persistence And Metadata, Testing And
  Smoke Slices;
- `lib/startup-loopback.js`, `lib/startup.js` listen path, `server.js` static
  and route mounts, `lib/http/shell-cors.js`;
- accepted SPEC-00 requirement that server listen and shell origins are exact
  IPv4 loopback.

Record at dispatch: baseline commit, dirty paths (`RA-I-015`), the exact bind
tests, and the CORS/listen smoke evidence.

## 3. Scope

### In scope

- an explicit serve-host configuration accepted by the server at startup;
- validation of that configuration (canonical IPv4/IPv6 literal or documented
  name forms only; no empty, wildcard-without-trust, malformed, or ambiguous
  values);
- refusal semantics: when a routable host is configured without the future
  device-trust enable, the server either (a) refuses to start with a bounded,
  documented error, or (b) starts only when the operator sets an explicit
  "trusted-network" acknowledgement; the choice is fixed in this SPEC's
  contract below;
- unchanged loopback default with all existing behavior and tests passing;
- operator-visible startup logging of the resolved bind host and trust mode,
  bounded and redaction-safe;
- documentation of the macOS Local Network prompt (`RA-I-011`) as expected
  operator behavior.

### Out of scope

- device tokens, pairing, QR (SPEC-03);
- any change to shell-auth, the fd-3 bootstrap, or trusted-shell;
- CORS changes for shell origin handling (the shell origin contract is
  unchanged; browser same-origin requests need no new CORS);
- HTTPS/TLS termination (deferral D-1);
- reverse proxies, Serve, or firewall product code;
- client code of any kind.

## 4. Contract

### 4.1 Configuration surface

The bind host is supplied by `FUSION_SERVE_HOST` (fixed name; the server
README and operator notes document it). The value is parsed and validated by a
pure function with its own tests. Absent or empty configuration resolves to
`127.0.0.1`.

### 4.2 Trust-mode gate

A non-loopback host is accepted only when the server is also explicitly told
device trust is enabled (`FUSION_REMOTE_ACCESS=1`) **or** the operator sets an
explicit trusted-network acknowledgement (`FUSION_TRUSTED_NETWORK=1`).
Otherwise startup fails closed with a bounded error identifying both the host
and the missing enable—never a silent fallback to loopback and never a silent
exposure. The precise refusal output is an acceptance criterion.

### 4.3 Unchanged loopback contract

With no configuration, the server binds `127.0.0.1`; SPEC-00 listen evidence,
CORS allowlists, shell origin behavior, and every accepted test remain
unregressed. No new default route, no CORS wildcard, no `localhost` fallback.

### 4.4 Failure branches

- malformed host value → bounded refusal naming the value class, non-zero exit;
- routable host without enable → bounded refusal (per §4.2), non-zero exit;
- routable host with enable but bind failure (address in use, interface
  absent) → existing startup failure path, bounded log, non-zero exit;
- loopback default → identical behavior to baseline.

## 5. Dependency-Ordered Slices

### Slice 01A — Serve-host parsing, validation, and trust-mode resolution

- Extract/adjust the loopback helper into a pure validated resolver
  (`startup-loopback.js` or its successor module) covering loopback,
  routable literal, malformed, and unset inputs.
- Resolve trust mode from configuration with fail-closed behavior.
- Unit tests for every input class and refusal message class.
- Expected areas: `lib/startup-loopback.js`, `lib/startup.js`, config surface,
  focused unit tests.

### Slice 01B — Listen-path integration and operator evidence

- Wire the resolver into the startup listen path; keep all loopback behavior
  identical.
- Startup log lines for resolved host + trust mode, redaction-safe.
- Integration evidence: loopback default smoke unchanged; configured routable
  bind on a test interface (e.g. loopback alias or the machine's LAN address)
  with curl/browser HTTP request succeeding; refusal case evidence for §4.2.
- Operator notes: macOS Local Network prompt, sleep/autostart pointers
  (deferral D-2), and the explicit nature of the opt-in.
- Expected areas: `lib/startup.js`, server README/operator doc, focused tests.

## 6. Required Verification

1. `cd fusion-studio-server && npm test`
2. `cd fusion-studio-client && npm run build` (no client change expected; proves
   the server change did not disturb the shared build)
3. Focused: resolver unit tests for loopback/routable/malformed/unset.
4. Integration: loopback default startup smoke (unchanged evidence) and one
   explicit routable bind request from a second interface; refusal evidence for
   routable-without-enable.
5. Accepted-test regression: SPEC-00 listen/CORS evidence and the shell-auth
   suite unchanged.

## 7. Expected Changed Areas

- `fusion-studio-server/lib/startup-loopback.js` (or successor resolver);
- `fusion-studio-server/lib/startup.js` (listen wiring and logs);
- server config/README/operator documentation;
- focused server tests.

## 8. Definition Of Done

- Default behavior provably unchanged; routable bind requires explicit opt-in;
  invalid combinations fail closed with bounded output; all required checks
  pass; every deviation recorded; no later-SPEC behavior present.
