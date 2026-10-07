# SPEC-05 — Client-Aware Remote Surface

**Status:** `DRAFT_CANDIDATE — REVIEW REQUIRED`
**Domain owner:** Client-kind propagation, host-drawn remote indicator, exit protocol, and the paired-device capability extension
**Prerequisite:** accepted SPEC-04; R1 resolved (owner, 2026-09-12) as RA-RD-011
**Blocks:** roadmap completion (this is the last surface SPEC)
**Does not depend on:** PWA assets

## 1. Objective

The host knows a connection is remote from its authenticated connection and
renders the remote indicator itself in its own header. The remote client's
only privileged parent interaction — exiting to local mode — is a narrowly
scoped, validated `postMessage`. Per the resolved R1 (RA-RD-011), a
token-paired `remote-device` carries full mutation capability equal to the
trusted shell, subject to a server config that can forbid remote mutation
capability; pairing is the trust boundary, and the config is the owner's
kill-switch.

## 2. Authorities And Baseline

Read before implementation:

- bundle planning docs; RA-RD-003, RA-RD-004, RA-RD-006, RA-RD-011 (resolved
  R1); RA-I-005, RA-I-006, RA-I-012, RA-I-016;
- accepted SPEC-00 `trusted-shell-authority.js` and the three consuming
  modules; accepted SPEC-03 role/kind assignment;
- accepted SPEC-04 `RemoteViewer`/mode gate;
- `server.js` connection initialization (`initializeConnection`), `lib/ws/connection-init.js`
  `buildWorkspaceInit`, `lib/ws/workspace-session.js`, and the client stores
  that hydrate `workspace:init`.

Record at dispatch: baseline commit, the authority-consumer tests, connection
init tests, and SPEC-04 smoke evidence.

## 3. Scope

### In scope

- **Client kind:** every connection carries a server-derived kind (`local` for
  the fd-3 trusted shell; `remote` for token-verified sessions; standalone
  untrusted connections remain `untrusted`/unlabeled); stored per session only
  — no server-global state.
- **Payload propagation:** `workspace:init` (existing initialization
  plumbing) carries the client kind; the client stores it and the host
  instance renders the remote indicator from it. No new WebSocket family.
- **Host-drawn indicator:** the remote instance's header shows a remote
  connection chip/label (final label fixed in the slice, e.g. "Remote —
  {device label}") attributable to host state, plus a Disconnect action.
- **Exit protocol:** Disconnect sends a structured `postMessage` to the
  parent; the parent accepts it only from the active `RemoteViewer` frame
  window with an exact paired origin and a strictly shaped payload, then exits
  remote mode. The sandbox gains nothing and top navigation remains
  impossible. Because remote mode draws no local chrome, the slice fixes and
  documents the local fallback(s): a keyboard shortcut handled by the shell
  window and app restart (the remote-drawn Disconnect remains the primary
  path).
- **Paired-device capability implementation (RA-RD-011):**
  - generalize the mutation gate so every non-shell-auth mutation route
    accepts `trusted-shell` OR `remote-device` capability; this includes the
    privileged thread routes (the explicit owner-authorized extension of the
    accepted SPEC-00 gate, recorded as a contract change in RA-RD-011);
  - add the server config `FUSION_REMOTE_MUTATIONS` (fixed name): when set to
    forbid, `remote-device` sessions receive the mirrored bounded denials
    (`VIEW_MUTATION_DENIED`-equivalent) and read/chat behavior continues
    unaffected; when permitted (default when remote access is enabled), the
    capability applies;
  - tests prove no payload can assert either role, that the shell lane is
    unchanged and is still the only path to `trusted-shell`, and per-route
    positive/negative capability coverage for both roles and the forbid
    state;
  - record the authorized contract change as a deviation addendum appended to
    the accepted 025 SPEC-00 implementation report
    (`025-Chat_Composition_Roadmap/SPEC-00-IMPLEMENTATION-REPORT.md`) in that
    report's deviation-record style, citing RA-RD-011 and the owner
    authorization date; do not edit 025 normative SPEC files or the
    acceptance report's existing verdict lines.
- **Screenshot verification:** determine whether Electron `capturePage`/shell
  capture composites a full-viewport iframe correctly; record the result and,
  if blank, document the remote-capture fallback as a bounded future item
  (implementation only if cheap and local; otherwise documented deferral).

### Out of scope

- changing the shell-auth protocol, its HMAC proof, or the rule that no
  payload can assert `trusted-shell`;
- multi-remote windows or simultaneous remote surfaces;
- mobile/PWA presentation (SPEC-06);
- new server-global state or a "host is in remote mode" concept;
- export parity and other D-3 items.

## 4. Contract

1. **Server-derived only.** Client kind and role are derived from
   authentication, never from payloads; tests include payload-assertion
   attempts against both lanes.
2. **Initialization compatibility.** Kind rides `workspace:init` with a
   backward-compatible absent value treated as local for existing clients
   (the Electron shell on an old build must not misrender).
3. **Indicator ownership.** The indicator is rendered by the host instance
   from its own state; the laptop shell draws no remote chrome in remote mode.
4. **Exit validation.** The parent verifies `event.source` is the live
   `RemoteViewer` frame, `event.origin` equals the frame's expected origin,
   and the message payload shape is exact; anything else is ignored. The frame
   cannot navigate the parent (sandbox unchanged).
5. **Capability parity and forbid gate (RA-RD-011).** `remote-device` and
   `trusted-shell` hold equal mutation capability by default; the
   `FUSION_REMOTE_MUTATIONS` forbid value denies remote mutation capability
   uniformly at the gate, with bounded denials and unchanged read behavior.
   The forbid state is server-authoritative and per-server, never
   per-payload.
6. **No regression.** All accepted authority-consumer tests pass; local mode
   behavior visible to a user is unchanged; the shell lane remains the only
   path to `trusted-shell`.

## 5. Dependency-Ordered Slices

### Slice 05A — Client kind propagation and host indicator

- Kind tracking per session in the connection init path; `workspace:init`
  field; client store + header chip + tests (absent → local; remote → chip).
- Expected areas: `server.js`/`lib/ws/` init path, `connection-init.js`,
  client store(s) hydrating init, header components (+ css), focused tests.

### Slice 05B — Exit protocol

- Frame→parent `postMessage` and parent validation + exit wiring; negative
  tests (wrong source, wrong origin, malformed payload, cross-frame); local
  escape hatch documented/tested.
- Expected areas: `RemoteViewer`, App mode gate, shared message shaper, tests.

### Slice 05C — Paired-device capability and forbid gate

- Extend the gate module + consumers so mutation routes accept either role;
  add the `FUSION_REMOTE_MUTATIONS` forbid state; update the
  authority-consumer tests; add per-route capability tests for both roles and
  the forbid state; re-run SPEC-00 authority evidence; write the deviation
  addendum to the 025 SPEC-00 implementation report named in §3.
- Expected areas: `lib/ws/trusted-shell-authority.js`, the three consumers,
  server config surface, focused route tests, 025 SPEC-00 report deviation
  addendum.

### Slice 05D — Screenshot/compositing verification

- Capture the remote view from the local shell; record result; implement the
  bounded fallback only if local and cheap; otherwise record a documented
  deferral with the exact observed behavior.
- Expected areas: evidence doc; possibly a small capture-path adjustment.

## 6. Required Verification

1. `cd fusion-studio-server && npm test`
2. `cd fusion-studio-client && npm run build`
3. Authority-consumer suites (all three consumers) + role-assertion negative
   tests.
4. Connection-init/session tests including kind propagation and absent-kind
   compatibility.
5. Electron smoke: remote mode shows the host-drawn indicator; Disconnect
   exits to local via the validated message; an invalid message is ignored;
   screenshot behavior recorded.
6. Regression: SPEC-00 shell evidence and SPEC-04 smoke unchanged.

## 7. Expected Changed Areas

- server init/session path + `connection-init.js`;
- `lib/ws/trusted-shell-authority.js` and the three consumers;
- server config surface (`FUSION_REMOTE_MUTATIONS`);
- client init-hydrating store(s), header components/css;
- `RemoteViewer` + App mode gate (exit handling);
- authority and init tests; screenshot evidence doc; 025 SPEC-00 report
  deviation addendum.

## 8. Definition Of Done

- Kind is server-derived and propagated without a new family; the host draws
  the indicator; exit is validated and the only remote→local command;
  `remote-device` holds capability parity per RA-RD-011 with the
  `FUSION_REMOTE_MUTATIONS` forbid gate proven per route; screenshots are
  resolved or explicitly deferred with evidence; the authorized contract
  change is recorded as a 025 SPEC-00 report deviation addendum; all checks
  pass; deviations recorded; no SPEC-06 behavior present.
