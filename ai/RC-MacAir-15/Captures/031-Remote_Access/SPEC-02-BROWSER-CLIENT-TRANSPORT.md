# SPEC-02 — Browser Client Transport

**Status:** `DRAFT_CANDIDATE — REVIEW REQUIRED`
**Domain owner:** Renderer runtime transport bootstrap
**Prerequisite:** accepted SPEC-01
**Blocks:** SPEC-03, SPEC-04, SPEC-06 (and phone usability)
**Does not depend on:** pairing, tokens, tunnels, iframes, or PWA assets

## 1. Objective

Make the served web client function in a plain browser: when a page is served
by the Fusion Studio host, the renderer bootstraps its runtime transport from
its own page origin and reaches `ready`, connects the WebSocket, and renders a
functional workspace. The Electron lane keeps its accepted exact-loopback
descriptor contract untouched.

At acceptance, Electron behavior is unchanged; a browser opened at the host's
served origin (or the tunnel loopback origin) loads the real application.

## 2. Authorities And Baseline

Read before implementation:

- bundle planning docs; RA-RD-003, RA-RD-006, RA-RD-009; RA-I-002, RA-I-007,
  RA-I-010, RA-I-012, RA-I-013;
- Code Standards: Architecture Routing, WebSocket Protocol, Testing And Smoke
  Slices;
- accepted SPEC-00 transport contract and its renderer tests;
- `fusion-studio-client/src/lib/runtime-transport.ts`, `src/types/electron.d.ts`,
  `src/hooks/useWebSocket.ts`, `src/components/App.tsx` disconnected branch,
  `electron/shell-protocol.cjs` (CSP reference only — do not edit),
  `fusion-studio-server/server.js` static serving.

Record at dispatch: baseline commit, the transport unit tests, Electron
descriptor tests, and the disconnected-shell test if present.

## 3. Scope

### In scope

- a browser bootstrap lane in the runtime transport: absence of
  `window.electronAPI` no longer produces a permanent `disconnected` state when
  the page itself is served by a Fusion runtime origin;
- descriptor derivation from `window.location` for the browser lane:
  `httpOrigin` = page origin; `webSocketUrl` = same host/port with `ws:`/`wss:`
  scheme; a stable synthetic generation derived from the origin (documented
  pattern, e.g. base64url SHA-256 prefix of origin, so restart does not change
  it);
- lane-aware descriptor validation: the Electron lane retains the exact
  `http://127.0.0.1:<port>` / `ws://127.0.0.1:<port>` contract; the browser
  lane validates a well-formed http/https origin with matching ws/wss URL,
  and only forms descriptors that connect to the same origin the page was
  served from;
- server-resource and HTTP helpers resolving against the lane origin with no
  hardcoded ports, addresses, or `localhost` fallbacks;
- reconnect behavior suitable for browser use: the existing reconnect
  machinery drives the browser lane; page visibility/restore must not leave a
  permanently dead socket (verification includes a lock/unlock-style
  disconnect/restore simulation in the browser smoke);
- a served-page browser smoke: start the server against a built `dist`,
  navigate a browser (Playwright) to the served origin, prove `workspace:init`
  arrives, the shell renders a workspace view, a panel renders, and Material
  Symbols assets load (`/material-symbols`).

### Out of scope

- tokens/pairing (SPEC-03) — the smoke runs on loopback or a trusted-network
  bind without token verification, or with verification disabled until SPEC-03
  lands;
- iframe display mode (SPEC-04/05);
- PWA manifest (SPEC-06);
- Electron-only features (`capturePage`, `exportDocument`): they remain
  unavailable and must degrade without breaking the browser page;
- any change to the shell document, its CSP, or the Electron preload contract.

## 4. Contract

1. **Lane selection.** Electron-present → Electron lane, unchanged. Otherwise
   browser lane if and only if the document was served over http/https with a
   usable origin; file:// or other schemes remain disconnected with a visible
   state.
2. **Origin binding.** The browser-lane descriptor's http origin is exactly
   `window.location.origin`; the WebSocket URL is the same authority with the
   matching ws scheme. No other origin is constructible.
3. **Electron lane preservation.** Every existing Electron-lane validation
   test passes unmodified; the exact-loopback rule and generation-shape checks
   remain in force for that lane.
4. **No hardcoding.** No new literal `127.0.0.1`, `localhost`, or `3001` in
   shared or browser-lane paths; ports derive from the page origin.
5. **Failure branches.** Missing/invalid origin → visible disconnected state,
   bounded console message; WebSocket refusal → existing reconnect/backoff
   behavior, no modal; server restart → reconnect converges (existing
   generation machinery); page restored from suspension → reconnect converges.
6. **Server resources.** Icon/font/asset mounts resolve through the lane
   origin; the smoke proves Material Symbols render in the served page.

## 5. Dependency-Ordered Slices

### Slice 02A — Lane split and browser descriptor bootstrap

- Introduce explicit lane resolution in the transport; keep the Electron path
  behavior identical.
- Implement browser-lane descriptor derivation/validation and generation.
- Unit tests: Electron lane byte-contract preserved; browser lane derives from
  a fake `window.location`; invalid schemes refused; resource/HTTP helpers use
  lane origin.
- Expected areas: `runtime-transport.ts`, `types/electron.d.ts` if the
  descriptor type needs lane metadata, transport unit tests.

### Slice 02B — Served-page browser smoke and degradation

- Playwright browser smoke against a server-served `dist` on loopback: init,
  workspace render, panel render, icon mount, reconnect after forced server
  restart or socket kill.
- Prove Electron-only actions degrade visibly but harmlessly in browser mode
  (no crashes, no unhandled rejections).
- Expected areas: browser smoke test config/spec, small renderer guards where
  the smoke exposes a crash, transport docs.

## 6. Required Verification

1. `cd fusion-studio-server && npm test`
2. `cd fusion-studio-client && npm run build`
3. Focused transport unit suites (Electron lane preserved; browser lane new).
4. Playwright served-page smoke (02B) with reconnect evidence.
5. Electron descriptor/shell tests unchanged and passing.
6. Manual: open the served origin in a real browser; confirm workspace and
   chat render and a terminal reconnect case.

## 7. Expected Changed Areas

- `fusion-studio-client/src/lib/runtime-transport.ts`;
- `fusion-studio-client/src/types/electron.d.ts` (lane typing only, Electron
  API shapes unchanged);
- browser smoke test files + config;
- minimal renderer guards exposed by the smoke;
- docs note on browser-lane behavior and limitations.

## 8. Definition Of Done

- Browser page reaches functional `ready` and renders a workspace; Electron
  lane unchanged and proven; no hardcoded origins in lane code; reconnect and
  degradation behaviors proven; all checks pass; deviations recorded; no later
  SPEC behavior present.
