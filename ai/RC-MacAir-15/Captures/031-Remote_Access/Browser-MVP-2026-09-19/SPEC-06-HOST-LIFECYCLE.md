# SPEC-06 — Mac host lifecycle

Status: DRAFT candidate. Prerequisite: accepted SPEC-05; approval of BR-D13.

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

Make the Mac's existing Electron-main/server-child topology an explicit supported host mode that works with no visible window. Avoid introducing a separate daemon or duplicate process owner. Distinguish closing a window, disabling remote access, stopping the host and quitting the application. No watchdog for agents, launchd boot-before-login, automatic sleep-policy changes or Linux service packaging.

## Authorities and expected areas

BR-D02/D04/D13. `fusion-studio-client/electron/main.cjs`, `server-spawn.cjs`, `shell-launch-authority.cjs`, runtime descriptor and single-instance handling, preload IPC/menus/settings; `fusion-studio-server/lib/startup.js`, `shutdown.js`, `workspace/ai-paths.js`, `lib/db.js`. Existing Mac `window-all-closed` does not quit; before-quit currently supervises child cleanup. Preserve that authority and teardown sequence.

## Contract

Local owner enables host mode in settings. Show machine identity, selected profile and availability conditions. Closing last window keeps main/server running, maintains shell-auth owner in main for later local window, and leaves browser service available. Reopen brings the same runtime/profile into a trusted shell; it does not create a second server/DB. Provide clear local menu status and Stop Host/quit semantics. Stop Host cleanly stops runtime; restart is explicit. Remote disable closes browser ingress but not local application/server work. Do not redefine global Quit to secretly leave a daemon running.

Optional Start at Login launches the same signed/packaged app in host mode without opening a window. Register only on explicit owner toggle; disabling removes only Fusion's own login registration. Preserve selected profile identity and machine identity through configuration, not copied live DBs. Respect single-instance/profile locks; competing startup must refuse/activate existing instance, not migrate DB or silently choose another port/profile. Existing dev/Alpha profile separation remains exact; no install changes in this SPEC.

Store host preferences through an owning configuration service. Electron-only launch preferences may use existing Electron preferences owner; do not create a second owner for machine name/database path. If keychain/native permissions are unavailable before user login/unlock, show bounded status rather than pretending background service is ready. Host mode is a logged-in user-session service; no promise to serve before login or while the computer is asleep.

Closing a browser or a desktop window observing a server-owned browser-accepted turn does not kill that turn. Ordinary local-shell-owned sessions retain the existing close/retirement behavior, as required by SPEC-04; host mode keeps the server process available but does not change those local-turn semantics. Full Quit/Stop Host uses existing staged shutdown/draining and interrupted-turn persistence, closes both listeners/transports, and retires shell authority. Relaunch creates fresh runtime generation with unchanged durable server UUID/registrations. Crash recovery is existing process supervision plus explicit status; this SPEC does not restart jobs or replay prompts.

## Slices

### 06A — Windowless host behavior and local controls

Implement host setting/menu state and explicit close/reopen/stop behavior using main-process lifecycle owner. Verify one child and one profile across last-window close and reopen, live browser operation while closed, and honest offline state after Stop. Unit tests use process seams; real isolated Electron smoke checks lifecycle and browser connection.

Check: `cd fusion-studio-client && node --test electron/host-mode.test.cjs electron/server-spawn.test.cjs electron/shell-launch-authority.test.cjs electron/runtime-descriptor.test.cjs`; build. New `e2e/remote-host-lifecycle.spec.ts` is launched through isolated remote fixture config with Electron executable/profile options recorded by fixture owner.

### 06B — Login startup, shutdown and profile durability

Add opt-in login startup and cleanup using supported Electron app APIs. Test correct app/profile args, disable ownership, duplicate-instance refusal and error status using injected OS adapter; run actual packaged/development test-profile login launch smoke without changing user's login settings. Exercise clean quit, crash/relaunch as supported, failed port bind and invalid profile. Confirm same test workspace/machine/database and browser registration survive relaunch; no Alpha/live data touched.

Check: `cd fusion-studio-client && node --test electron/host-mode.test.cjs electron/host-login-startup.test.cjs electron/server-spawn.test.cjs`; `npx playwright test --config=playwright.remote.config.ts e2e/remote-host-lifecycle.spec.ts`; client build and full server suite if shutdown/startup changed.

## Final SPEC acceptance and regression surface

Windowless host continues serving; full quit actually stops; login startup is explicit and reversible; identity and credentials persist; no duplicate runtime owner. Manual sleep/network outage is reported as unavailable, not data loss. Desktop local launches without host mode retain previous visible behavior. Regression surface: Electron instance lock, window/menu/preload, server-child environment and shutdown. Report native login validation limits; mock-only proof cannot certify login startup.
