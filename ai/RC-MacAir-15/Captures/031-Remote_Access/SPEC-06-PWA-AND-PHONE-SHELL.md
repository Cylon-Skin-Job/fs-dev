# SPEC-06 — PWA And Phone Shell

**Status:** `DRAFT_CANDIDATE — REVIEW REQUIRED`
**Domain owner:** Installable web app shell, phone pairing screen, mobile viewport CSS, and the Tailscale operator runbook
**Prerequisite:** accepted SPEC-02 and accepted SPEC-03
**Blocks:** nothing in this bundle (may execute before or after SPEC-04/05 with owner approval of the reorder)
**Does not depend on:** R1, tunnels, or the desktop mode switch

## 1. Objective

The phone can pair by scanning/opening a deep link, store the token, and use
the served client as a home-screen web app over the same server capability.
Discoverability comes from the platform install flow (iOS "Add to Home
Screen"); the bundle adds the manifest, icons, pairing screen, and the minimal
viewport CSS required to use the existing UI on a phone.

## 2. Authorities And Baseline

Read before implementation:

- bundle planning docs; RA-RD-002, RA-RD-009; RA-I-010, RA-I-012, RA-I-013,
  RA-I-019;
- accepted SPEC-02 browser lane and smoke; accepted SPEC-03 token bootstrap
  (fragment `#pair=` parsing + origin-scoped storage) — reuse, do not
  duplicate;
- `fusion-studio-client/index.html`, `vite.config.ts` (`base`), `public/`
  contents, `src/main.tsx` bootstrap, existing responsive rules inventory;
- `server.js` static serving and cache headers (`dist` `<assets>` immutable,
  `index.html` no-cache).

Record at dispatch: baseline commit, client build, SPEC-02 smoke, SPEC-03
token tests, and the current index.html/manifest absence.

## 3. Scope

### In scope

- **PWA manifest** (`public/manifest.webmanifest` or equivalent Vite-public
  asset): name/short name, `display: standalone`, `start_url` (page origin
  via relative path), `theme_color`/`background_color` from existing theme
  tokens or safe defaults, and icons (192/512, maskable as available).
- **iOS/install metadata** in `index.html`: `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`,
  `apple-touch-icon` (+ sizes), `theme-color`, manifest link, viewport
  additions only if required for the shell (no user-scalable suppression
  without owner approval).
- **Pairing screen (phone, first run):** when the page has no stored token and
  a `#pair=` fragment is present, consume it via the shared SPEC-03 parser,
  store origin+token in origin-scoped storage, scrub the fragment from the
  address bar, and continue into the app; when neither token nor fragment
  exists, show a bounded "not paired" state with instructions and no retry
  storm. When a stored token exists, the normal app renders.
- **Phone shell CSS (bounded):** app shell viewport safety (safe-area insets,
  `100dvh` handling), header/tools-panel/composer usability at phone widths
  using the existing token system, and touch-target minimums for the header
  and composer controls. This is the minimum to make the existing UI usable —
  not a redesign; no component is restructured.
- **Resume reconnect:** verification that backgrounding/locking the phone and
  returning reconnects the browser lane (consuming SPEC-02 behavior) and that
  the token persists across reloads.
- **Service worker:** added only as a minimal, versioned shell (installable
  and update-safe, no aggressive caching of API/token surfaces); if the
  builder can show it is unnecessary for the acceptance criteria, record the
  omission as a documented deviation and defer.
- **Operator notes (deferral D-1 runbook):** document Tailscale join,
  MagicDNS, `tailscale serve` HTTPS with the stable `*.ts.net` origin,
  re-pairing guidance when the origin changes, iOS install steps, and the
  secure-context requirement for microphone/voice features.

### Out of scope

- full mobile redesign of any view;
- Capacitor/native shells, native Keychain APIs, push notifications, offline
  app mode beyond install+reload resilience;
- Tailscale product code or automatic certificate handling;
- changes to the desktop layout.

## 4. Contract

1. **Install integrity.** The served origin presents a valid manifest, icons,
   and iOS metadata; the installed app opens standalone at the app start URL
   and reaches the paired workspace.
2. **Fragment hygiene.** A `#pair=` fragment is consumed once, stored, and
   removed from the visible URL; it never reaches server logs (fragments are
   client-only by construction) and is never re-sent after storage.
3. **Not-paired behavior.** Missing token/fragment shows the bounded pairing
   instructions; no infinite reconnect loop, no error modal storm.
4. **Unchanged desktop.** No desktop CSS/layout behavior changes; responsive
   rules are scoped to phone-width breakpoints and the app shell only.
5. **Resume behavior.** Reload and background/restore preserve the token and
   converge to connected without manual repair.
6. **Secure-context honesty.** The operator notes state which features require
   HTTPS (Serve) and which work on plain-HTTP LAN; microphone features are
   documented as requiring the TLS origin.

## 5. Dependency-Ordered Slices

### Slice 06A — Manifest, icons, and install metadata

- Add manifest + icons + index.html metadata; verify Vite build copies and
  serves them with correct cache behavior; tests: manifest validity,
  icon reachability, metadata presence.
- Expected areas: `fusion-studio-client/public/**`, `index.html`, maybe
  `vite.config.ts` (`base` verify), focused tests.

### Slice 06B — Pairing screen and token lifecycle on the phone

- First-run pairing UI + shared parser reuse + storage + fragment scrub +
  not-paired state; tests: consume-once, scrub, persistence, not-paired.
- Expected areas: `src/components/remote/PairingScreen.tsx` (+ css),
  bootstrap hook in `main.tsx` or App, focused tests.

### Slice 06C — Phone shell CSS and resume verification

- Safe-area/viewport/touch minimums; Playwright mobile-emulation smoke +
  resume/reconnect evidence; desktop regression screenshots for header
  composition unchanged.
- Expected areas: app shell CSS (`index.css`/`App.css` scoped rules), smoke
  files, evidence docs.

### Slice 06D — Operator runbook (Tailscale deferral D-1)

- Write the runbook into the bundle/docs location named by the slice
  (server README or bundle operations note); no product code.
- Expected areas: documentation only.

## 6. Required Verification

1. `cd fusion-studio-server && npm test`
2. `cd fusion-studio-client && npm run build`
3. Manifest/metadata tests + served-asset checks.
4. Playwright mobile-emulation served-page smoke: pairing fragment → stored →
   app renders; reload persists; background/restore reconnects.
5. Desktop regression: existing electron/desktop smoke unaffected.
6. Manual (operator): iOS Add to Home Screen over the LAN origin; repeat via
   the Tailscale Serve origin per the runbook when D-1 is executed (evidence
   recorded in the SPEC's report, not required for acceptance if the tailnet
   is not yet stood up — the LAN install is the acceptance evidence).

## 7. Expected Changed Areas

- `fusion-studio-client/public/manifest.webmanifest` + icons;
- `fusion-studio-client/index.html`;
- `src/components/remote/PairingScreen.tsx` (+ css) and bootstrap hook;
- app-shell CSS scoped to phone breakpoints;
- Playwright mobile smoke files; operator runbook doc.

## 8. Definition Of Done

- A phone on the served origin pairs once, installs to the home screen, opens
  standalone, persists the token, reconnects on resume, and the existing UI is
  usable at phone width with desktop unchanged; the Tailscale runbook is
  documented as the D-1 operator step; all checks pass; deviations recorded;
  no desktop redesign present.
