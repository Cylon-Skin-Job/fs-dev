# SPEC-07 — Tailscale setup and remote acceptance

Status: DRAFT candidate. Prerequisite: accepted SPEC-06.

## Execution packet

Read BUNDLE-INDEX.md, DECISIONS.md, ROADMAP.md, GUIDANCE.md and ISSUES.md in this directory. GUIDANCE.md's fresh builder/reviewer lifecycle applies to each slice below without exception. Each slice is a complete public-route increment, including necessary integration and its checks. A new builder handles the next slice only after orchestrator review is clean. Record every deviation and its consumers. Owner acceptance is required before the following SPEC.

Baseline: record the accepted current commit, relevant dirty paths and existing test results at dispatch. The planning snapshot is not a frozen execution branch. No live profile/DB mutations in fixtures. No migration may rewrite existing machine identities, workspaces, transcripts or view state. New module names below are proposed owner locations; if existing owners suffice, use them and report the mapping.

## Exact code standards

Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Read fully, plus:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

## Objective and scope

Provide a concrete guided setup from installed Tailscale to verified private Fusion URL and paired laptop. Tailscale owns network enrollment/HTTPS/relay. Fusion owns authenticated browser ingress, invitation and product session. No Tailscale API token stored in Fusion, public Funnel, routable bind, SSH tunnel, remote desktop iframe or phone layout.

## Authorities and expected areas

BR-D08/D10/D11/D15. Existing local settings/header controls and Electron command adapter; SPEC-02 remote registration/settings service; SPEC-03 ingress configuration. New narrow Tailscale adapter executes fixed commands using argument arrays and bounded output/timeouts, not interpolated shell strings. Follow current official docs listed in BUNDLE-INDEX and recheck supported CLI syntax/version at implementation.

## Setup contract

1. Local settings explain install/sign-in Tailscale on host and client to the same tailnet. Detect installed/running/signed-out/unreachable CLI separately, identify host DNS name and supported version. Tailscale identity is connectivity metadata, never Fusion login authority.
2. Inspect existing Serve configuration. Derive proposed HTTPS origin from observed host DNS, validate and let user review. Configure SPEC-03 external origin/loopback port through the local owner. Refuse loopback port collision/local Electron target. If origin changes, close current remote sockets and require pairing at the new origin; old origin cookies never transfer.
3. Show exact proposed Serve mapping: HTTPS private origin → SPEC-03 browser loopback listener. User clicks Enable to apply. Use supported persistent Serve mode (`--bg`) when appropriate, but preserve unrelated mappings. Existing same endpoint owned by another application requires an explicit choice; do not overwrite/reset configuration silently. Show manual command path if installation/permissions prevent managed setup.
4. Verify actual response identity and readiness through the HTTPS origin, not merely exit code. Show address/copy and pairing QR/link ONLY when mapping targets the authenticated listener for this server UUID. Private origin returns pairing shell, not workspace data. First-use HTTPS enablement may require a Tailscale browser approval; present that as their setup step.
5. User opens address/QR on authorized tailnet laptop, completes Fusion pairing and host confirmation. Remote status clearly separates Tailscale connectivity, Fusion server availability and browser authorization.
6. Disable removes only Fusion-owned mapping if it is still identical to the recorded mapping; otherwise report drift and leave unrelated Serve config intact. Always close Fusion browser listener regardless of external cleanup outcome. Never use `tailscale serve reset` as generic cleanup.

No app-generated invitation contains a durable credential. Link uses fragment, short expiry and No-Referrer pairing page from SPEC-02. QR copy is user-mediated; no clipboard secret collection. Record only nonsecret setup metadata. No unattended mutation of Tailnet ACL, device enrollment or Tailnet Lock recovery state.

## Tailnet Lock and availability runbook

Explain that encrypted relays cannot read payloads but coordination metadata and availability remain with Tailscale. Recommend Tailnet Lock with verified initial signing state and user-controlled recovery secrets. A successful HTTPS connection does not prove Lock status; show checked/unknown truthfully and do not upload disablement keys. Owner configures Tailnet access rules and sleep settings using documented operator instructions. Do not disable OS security, certificate verification or Firewall to make checks pass. No claim of no-cloud-metadata or hostile-harness isolation.

## Slices

### 07A — Detection and safe Serve mapping

Add setup/status controller/UI and narrow adapter. Fixture outputs cover missing CLI, signed-out, disabled HTTPS, mismatched DNS, preexisting mapping, stale mapping and denied OS privilege. Successful setup proxies only browser ingress and preserves other services; failure rolls back only this operation's owned changes. Tests ensure argv is not shell-interpreted and diagnostic output contains no auth key/cookie.

Check: `cd fusion-studio-client && node --test electron/tailscale-adapter.test.cjs`; `npx playwright test --config=playwright.remote.config.ts e2e/remote-setup.spec.ts`; client build. Server settings-route integration tests use `cd fusion-studio-server && npx jest --runInBand test/remote-access/setup-config.test.js`.

### 07B — Pairing handoff, runbook and real two-machine proof

Finish address/QR, host status and documentation in a product help/runbook location selected from repository docs conventions. Exercise all final ROADMAP outcomes using a scratch workspace on one Mac host and a second laptop on another network with Tailscale installed. Verify actual Serve forwarded Host/Origin behavior and adjust header validation only within SPEC-03's fixed-origin/no-header-authority contract. Record topology, app/Tailscale/browser versions, loopback targets, profile/machine identity, direct/relay status if observable, pairing/revoke and outage results with secrets omitted.

Automated checks: `cd fusion-studio-client && npx playwright test --config=playwright.remote.config.ts`; build, full server suite and GUIDANCE targeted Electron checks. Manual checks: Chrome/Chromium and Safari laptop, full shell alongside browser, window-close/quit/relaunch, signed-out/offline, unauthorized second browser, file write/readback, live chat/drop/reconnect/Stop and revoked HTTP/WS. A relay can be tested where available; never claim relay testing if only direct path was observed.

## Migration, failure and final acceptance

Settings added by prior SPECs; any setup ownership record is additive and excludes secrets. No automatic install/push/Alpha deployment. Tailscale setup writes require the user's Enable action in the resulting product; implementation testing uses isolated config or explicitly authorized operator setup. Missing physical second machine/network makes final runtime evidence pending, not roadmap complete. Remote disable/offline cannot silently expose plain HTTP or public access. Final report proves ROADMAP acceptance and lists explicit future gates. Regression surface: local settings, external-process execution and shared Tailscale host configuration.
