# Browser MVP bundle index

Status: planning candidate; exact release identity and approval state in RELEASE-MANIFEST.md.

Working directory: `/Users/rccurtrightjr./projects/fs-dev` (primary development checkout). Inspected baseline commit: `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, branch `agent/exact-workspace-paths`, 2026-09-19. Worktree contains unrelated Office fixture changes, wiki corrections and untracked captures. This plan lives in a new subfolder; no previous draft or product source was edited.

Active documentation tree: `ai/RC-MacAir-15/`. Evidence: current source-inspected wiki baseline, active capture/cli configuration and `workspace/ai-paths.js` resolver (explicit FUSION_LOCAL_MACHINE, system_config local_machine_name, hostname fallback). This is the planning source tree, not a claim that every running app uses this machine identity. Alpha remains RC-Alpha; deployment pins its own host identity. No arbitrary inactive-tree standards merged.

## Normative artifact map

| Artifact | Purpose / authority |
|---|---|
| DECISIONS.md | Current owner decisions, precise supersessions and technical proposals |
| GUIDANCE.md | Mandatory slice/orchestrator/review/acceptance lifecycle |
| ISSUES.md | Material issues, open choice and non-blocking future gates |
| ROADMAP.md | SPEC order, shared contracts and final acceptance |
| SPEC-01-AUTHORIZATION-POLICY.md | Full-access principal/action policy |
| SPEC-02-BROWSER-PAIRING.md | Credential enrollment, persistence and revocation |
| SPEC-03-REMOTE-INGRESS.md | Protected HTTP/WS listener and admission |
| SPEC-04-REMOTE-TURN-CONTINUITY.md | Accepted turn execution independent of browser lifetime |
| SPEC-05-BROWSER-WORKSPACE-CLIENT.md | Browser transport, capability adaptation and recovery |
| SPEC-06-HOST-LIFECYCLE.md | Windowless logged-in Mac host mode |
| SPEC-07-TAILSCALE-SETUP.md | Private HTTPS setup, runbook and two-machine acceptance |
| BUNDLE-INDEX.md | Artifact/dependency/source map |

`SOURCE-SNAPSHOT.json` records read-only source fingerprints (evidence, not approval of all source bytes). `CLEAN-ROOM-REVIEW.md` records independent review. `RELEASE-MANIFEST.md` binds normative ordered paths/hashes to approval. These evidence/manifest files are excluded from their own recursive hash input.

## Source-of-truth and standards paths

All paths below are repository-relative. Each SPEC selects its exact standards pages; this is the union. Chat lifecycle sources are reference contracts rather than proof of a successful current runtime test.

- `AGENTS.md`
- `fusion-studio-server/AGENTS.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`
- `ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/006-Runtime_Model/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md`
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-00-TRUSTED-FUSION-SHELL-AUTHORITY.md`
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-00-IMPLEMENTATION-REPORT.md`

## Source feasibility map

- `fusion-studio-server/server.js`
- `fusion-studio-server/lib/startup.js`
- `fusion-studio-server/lib/startup-loopback.js`
- `fusion-studio-server/lib/shell-bootstrap.js`
- `fusion-studio-server/lib/shutdown.js`
- `fusion-studio-server/lib/ws/shell-auth-dispatch.js`
- `fusion-studio-server/lib/ws/product-session-registry.js`
- `fusion-studio-server/lib/ws/trusted-shell-authority.js`
- `fusion-studio-server/lib/ws/client-message-router.js`
- `fusion-studio-server/lib/ws/workspace-session.js`
- `fusion-studio-server/lib/ws/workspace-broadcaster.js`
- `fusion-studio-server/lib/workspace/workspace-controller.js`
- `fusion-studio-server/lib/workspace/ai-paths.js`
- `fusion-studio-server/lib/http/panel-file-route.js`
- `fusion-studio-server/lib/http/view-config-route.js`
- `fusion-studio-server/lib/thread/ThreadWebSocketHandler.js`
- `fusion-studio-server/lib/thread/ThreadManager.js`
- `fusion-studio-server/lib/thread/live-turn-snapshot.js`
- `fusion-studio-client/src/lib/runtime-transport.ts`
- `fusion-studio-client/src/lib/view-capsule-projection.ts`
- `fusion-studio-client/electron/main.cjs`
- `fusion-studio-client/electron/server-spawn.cjs`
- `fusion-studio-client/package.json`
- `fusion-studio-server/package.json`

Existing tests and exact invocation are in GUIDANCE.md. Existing migration head is `044_thread_group_placement_outbox.js`; re-resolve at dispatch. New tests named in SPECs do not exist yet and are implementation deliverables. Existing default Playwright config reuses localhost:3001 and is unsuitable for remote acceptance; the planned isolated config must launch fresh test-only profiles.

Critical facts: the renderer currently has no browser descriptor lane; all managed product WS initialization is shell-auth-gated; current HTTP routers have no browser registration middleware; product registry recognizes only managed trusted-shell/standalone untrusted; workspace switching is server-global; socket cleanup terminates its activated provider; Mac closes windows without quitting but full Quit drains/stops the server child. Each fact has a named SPEC rather than an assumed configuration-only fix.

## Dependencies and compatibility

Policy → registration → protected ingress → turn continuity → browser UI → host lifecycle → Tailscale setup. Each consumes the preceding accepted baseline. No proposed browser feature authorizes changing unrelated tabs/Side Chat placement, System protected writes, provenance publishers or provider syntax. Current thread/turn routing stays keyed by threadId with workspace/root/generation fences. SPEC-04 alone owns the documented remote accepted-turn lifetime exception.

Parent `../ROADMAP.md`, `../DECISIONS.md`, `../GUIDANCE.md`, `../BUNDLE-INDEX.md` and `../RELEASE-MANIFEST.md` were consulted as historical draft input. They are not co-normative with this candidate. The old routable/LAN, SSH iframe and mobile sequence must not be accidentally executed as prerequisites. Approval of this candidate selects its narrower execution contract; the parent remains intact.

## External references checked during planning

- [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve): private HTTPS and first-time HTTPS enablement.
- [Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve): status JSON and persistent background mapping; recheck version at implementation.
- [Tailnet Lock](https://tailscale.com/docs/features/tailnet-lock): signed device enrollment, initial-state verification, recovery ownership.
- [Tailnet Lock threat model](https://tailscale.com/docs/concepts/tailnet-lock-whitepaper): availability and initial-trust limitations.
- [Electron app lifecycle/login settings](https://www.electronjs.org/docs/latest/api/app): login startup requires platform/version testing. Repo currently declares Electron ^42.0.1; do not blindly adopt latest-version examples or assume macOS supports Windows path/args settings. Detect login launch and host preference explicitly.

No external docs grant permission to enroll devices, mutate Tailscale settings or deploy Alpha during planning. Source references are not product promises beyond the SPEC contracts.
