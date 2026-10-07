# SPEC-04 — Remote Connection Management

**Status:** `DRAFT_CANDIDATE — REVIEW REQUIRED`
**Domain owner:** Electron tunnel manager, desktop target store, full-surface mode switch
**Prerequisite:** accepted SPEC-03
**Blocks:** SPEC-05
**Does not depend on:** R1, PWA, Tailscale product code

## 1. Objective

The laptop's desktop client gains remote targets and a mode switch. Remote mode
displays the remote instance as one full-viewport iframe of the served web
client; local mode is the existing application; switching unmounts the
departing surface. Because the shell document's descriptor contract and
`connect-src` permit only its own loopback origin, the desktop reaches the host
over a managed loopback SSH tunnel; the iframe then loads the host's served
client from the tunnel origin.

## 2. Authorities And Baseline

Read before implementation:

- bundle planning docs; RA-RD-002, RA-RD-003, RA-RD-006, RA-RD-009; RA-I-004,
  RA-I-014, RA-I-015, RA-I-016;
- accepted SPEC-00 shell origin/CSP and Electron main inventory
  (`electron/main.cjs`, `server-spawn.cjs`, `authorized-ipc.cjs`,
  `preload.cjs`/`preload-source.cjs` and their inventory tests);
- `src/components/App.tsx` render branches and header composition,
  `src/components/HeaderActionsMenu.tsx` (existing destination menu),
  `src/components/iframe/IframeSurface.tsx`, `src/components/browser/CustomViewer.tsx`
  (policy reference — do not edit), `src/components/browser/urlValidator.ts`;
- `src/lib/runtime-transport.ts` from accepted SPEC-02.

Record at dispatch: baseline commit, Electron main unit tests, preload
inventory tests, App/header smoke tests, and SPEC-02 browser-lane evidence.

## 3. Scope

### In scope

- **Tunnel manager (Electron main):**
  - spawn `ssh -N -L <localPort>:127.0.0.1:<remotePort> <user@host>` in strict
    non-interactive mode (`BatchMode=yes`-equivalent, no password prompts, no
    TTY), with host/port/user sourced from the configured target;
  - local loopback port selection (ephemeral or configured) with collision
    handling; health check (TCP connect to local port) and bounded restart/
    backoff; deterministic teardown on exit, mode switch, and app quit;
  - bounded, redaction-safe logging (never token values);
  - IPC surface exposed through the existing authorized-IPC pattern and
    audited by the preload inventory tests.
- **Target store (renderer):**
  - persist remote targets (label, ssh host/user, remote port, deep-link
    origin+token from SPEC-03) in renderer-hosted state scoped to the app
    (origin-scoped storage or an Electron-main store; the slice fixes one and
    documents it);
  - deep-link ingestion: paste/scan a SPEC-03 deep link to add a target;
  - target validation: the iframe origin must equal the paired origin from the
    link (loopback tunnel origin or a paired https origin); the policy lives
    in a remote-validator module as a sibling of `CustomViewer`'s validator.
- **`RemoteViewer` surface (renderer):**
  - full-viewport consumer of `IframeSurface` with the remote validator and
    the paired token injected via the WebSocket subprotocol in the iframe's
    client bootstrap (SPEC-03 token source reads the fragment/storage inside
    the iframe document);
  - loading / disconnected / refused states with bounded retry, drawn locally
    only while the frame is not yet usable;
  - no header, no local chrome in remote mode.
- **Mode switch:**
  - a `Remote Access` destination added to the existing `HeaderActionsMenu`
    (or an equivalent header affordance wired through the existing menu
    system) listing targets, with Connect/Disconnect;
  - mode is a top-level render decision in `App.tsx`; entering remote mode
    unmounts the local surface tree; exiting remote mode unmounts
    `RemoteViewer` (both surfaces unmount, RA-RD-003); local re-render on exit
    is immediate; the local server and background work are untouched;
  - persisted last mode + target so a restart restores the chosen surface.

### Out of scope

- R1 mutation authority and the remote indicator (SPEC-05);
- PWA assets and phone shell (SPEC-06);
- changes to `CustomViewer.tsx` policy, the sandbox composable, or shell CSP;
- HTTPS/TLS or Tailscale product code;
- screenshot behavior inside remote mode (SPEC-05 verification concern);
- multi-target simultaneous connections (one active remote surface at a time).

## 4. Contract

1. **Tunnel lifecycle.** A target connection exists only while remote mode is
   active; teardown is deterministic on disconnect, mode switch, and quit; a
   killed tunnel surfaces a bounded disconnected state and retries with
   backoff, without corrupting local mode.
2. **No interactive auth.** Any ssh prompt state is impossible by
   configuration; failure to authenticate is a bounded, user-visible error.
3. **Origin policy.** `RemoteViewer` accepts only origins that match a paired
   target (tunnel loopback origin from the local tunnel or the pairing link's
   https origin). It never accepts arbitrary navigation; the iframe sandbox
   and navigation policy remain as accepted.
4. **Token flow.** The token travels from the target store into the iframe
   client's bootstrap (fragment or origin-scoped storage inside the iframe
   document) and is presented only in the WebSocket subprotocol; it is never
   placed in the outer shell URL, logs, or messages.
5. **Unmount both.** Entering remote mode removes the local surface from the
   tree; exiting removes `RemoteViewer`. No hidden live surface is retained.
6. **Local invariants.** While remote mode is active: the local server keeps
   running, its workspace/watch/trigger activity continues, and switching back
   renders the local surface immediately with current state.
7. **Failure branches.** Tunnel failure, token refusal, host offline, slow
   host: each yields a bounded, local loading/error state with retry; the
   switch back to local always works.

## 5. Dependency-Ordered Slices

### Slice 04A — Tunnel manager and IPC

- Implement manager + IPC + tests (spawn args, non-interactive guarantees,
  port collision, health/backoff, teardown, redaction); extend preload
  inventory tests.
- Expected areas: new `electron/remote-tunnel.cjs` (+ tests), `main.cjs`
  wiring, `preload*.cjs`/`authorized-ipc.cjs` additions, inventory tests.

### Slice 04B — Target store, deep-link ingestion, remote validator

- Renderer store + persistence choice + validation + tests; deep link parsing
  reused with SPEC-03's format (single parser module, tested once, imported by
  both).
- Expected areas: new `src/state/remoteTargets.ts`, `src/lib/remote-validator.ts`,
  shared link parser, focused tests.

### Slice 04C — RemoteViewer and mode switch

- Full-viewport viewer + App mode gate + header menu destination + persisted
  mode; Electron smoke: connect a target against a locally running host,
  enter/exit remote mode, prove unmount-both, prove local background work
  continues (watcher/trigger liveness assertion from baseline evidence) and
  immediate local re-render.
- Expected areas: `src/components/remote/RemoteViewer.tsx` (+ css),
  `src/components/App.tsx` mode gate, `HeaderActionsMenu` field, focused
  tests + Playwright/Electron smoke.

## 6. Required Verification

1. `cd fusion-studio-server && npm test`
2. `cd fusion-studio-client && npm run build`
3. Electron main unit tests (tunnel manager, spawn args, teardown) and preload
   inventory tests.
4. Renderer tests: store validation, deep-link parsing, mode gate, unmount
   behavior.
5. Electron smoke: local → remote → local with a real or fixture host; assert
   server/watcher continuity across the round trip; assert no token in logs.
6. Regression: accepted SPEC-02 browser lane and Electron descriptor tests
   unchanged.

## 7. Expected Changed Areas

- `fusion-studio-client/electron/remote-tunnel.cjs` (new) + main/preload/IPC
  wiring + inventory tests;
- `src/components/remote/**` (new);
- `src/state/remoteTargets.ts`, `src/lib/remote-validator.ts`, shared deep-link
  parser (new);
- `src/components/App.tsx` (mode gate), `HeaderActionsMenu.tsx` (destination),
  `HeaderActionsMenu.css`;
- focused Playwright/Electron smoke files.

## 8. Definition Of Done

- A paired laptop connects to a host via managed tunnel, remote mode is a
  single full-viewport remote instance, both surfaces unmount on switch, local
  work continues and returns immediately, targets are validated and persisted,
  tokens never leak, all checks pass, deviations recorded, no later-SPEC
  behavior present.
