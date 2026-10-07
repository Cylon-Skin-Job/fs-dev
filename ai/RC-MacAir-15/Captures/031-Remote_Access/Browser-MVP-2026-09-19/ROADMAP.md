# Home-server browser MVP roadmap

Status: DRAFT — awaiting clean review and owner approval. Scope: seven domain SPECs, no product implementation in this planning task.

## Outcome

On a different network, an authorized laptop browser reaches the home Fusion instance through Tailscale HTTPS, works in its workspace/chat state, disconnects and returns without changing machine identity or creating another database. Host remains available without an open desktop window. Every paired session uses the full-access policy; unauthorized/revoked sessions cannot read product data or invoke operations.

## Order and domain ownership

| Order | SPEC | Owns | Prerequisite |
|---|---|---|---|
| 1 | SPEC-01-AUTHORIZATION-POLICY.md | Server principal/action policy and full-access evaluation | Current accepted shell baseline |
| 2 | SPEC-02-BROWSER-PAIRING.md | Browser registration, credential persistence, local approval/revocation | Accepted 01 |
| 3 | SPEC-03-REMOTE-INGRESS.md | Authenticated loopback browser HTTP/WS listener and shared product activation | Accepted 02 |
| 4 | SPEC-04-REMOTE-TURN-CONTINUITY.md | Accepted remote turn lifetime independent of browser socket | Accepted 03 |
| 5 | SPEC-05-BROWSER-WORKSPACE-CLIENT.md | Browser bootstrap, existing workspace UI, capabilities and recovery | Accepted 04 |
| 6 | SPEC-06-HOST-LIFECYCLE.md | Window-independent Mac host mode and login startup | Accepted 05 |
| 7 | SPEC-07-TAILSCALE-SETUP.md | Operator setup/status/address pairing and real network acceptance | Accepted 06 |

Dependency graph: `01 → 02 → 03 → 04 → 05 → 06 → 07`. Browser lane remains disabled to real users until 03, 04 and 05 are accepted; fixtures can exercise earlier foundations. User acceptance gates every SPEC. Domain boundaries allow small prerequisite seams, not early implementation of later features.

## Shared contracts

- One Node process/runtime, DB, workspace controller and renderer dist. Two loopback listeners separate local Electron ingress from remote-browser ingress; Tailscale proxies only the latter. No generic reverse proxy to legacy unauthenticated routes.
- Electron bootstrap and role stay exact. Server-created browser principal has `policyId: full-access`; payloads, device labels, Tailnet identity headers and reported provenance cannot create authority.
- Host profile and machine name are explicit and stable. No copying live databases, silently changing RC-Alpha, or creating browser-named ai subtrees.
- HTTP product reads/resources and mutations require the same browser registration as WS. Revocation affects existing sockets and subsequent HTTP requests, not just the next login.
- Shared workspace selection follows BR-D14; server durable content remains shared. Transient focus and unsent drafts are browser-local where existing state owners support them; no new per-browser persistent view-state store. Existing server-backed view state retains its shared behavior.
- A browser disconnect/reload does not Stop an accepted turn. Reconnect hydrates history/live snapshot; it does not resend unacknowledged prompts or saved edits. Full host process shutdown retains existing interrupted-turn semantics; no promise that a process-restarted agent keeps running.
- Remote is full regular access to supported operations, not universal native-feature parity. Existing Electron-only features get explicit unavailable messaging. No permission editor, hook engine, automation/watchdog, public signup or collaboration UI.

## Final acceptance (must be observed, not inferred from builds)

1. Local Electron still authenticates and works with browser access disabled and enabled; a missing/malformed shell descriptor never falls back to browser mode.
2. Enroll laptop A by single-use invitation and host confirmation. An unauthenticated tailnet laptop B sees only the pairing shell; direct API/resource/WS attempts expose no product data.
3. From A on a physically different network, list workspaces, open a view, read/save a scratch text file, create a chat, send a prompt, see live output and Stop. Confirm saved file and transcript on host.
4. Close/reopen browser and interrupt network during an accepted turn: reconnect restores authoritative state without duplicate prompt, duplicate write or false successful offline edit. Switch workspace with two clients according to the accepted BR-D14 contract and preserve workspace epochs.
5. Revoke A: no further authorized messages/requests, active socket/streams close, cached product UI clears on detection, re-pairing is required. Previously downloaded user data cannot be remotely erased; already accepted server jobs are not undone.
6. Close host window: browser remains functional. Explicitly quit host: browser shows offline and refuses mutations. Relaunch host profile: same DB, machine/config and remembered authorization return.
7. Tailscale disconnect, sign-out, missing binary, invalid Serve mapping and host sleep produce accurate troubleshooting; setup must never silently publish through Funnel or map the local Electron port.
8. Local build/server gates and Chrome/Chromium plus Safari laptop manual checks pass; record test versions and exact host profile. Mobile Safari/PWA acceptance is deferred.

All evidence is collected under a new implementation report per SPEC, plus final integration report. Planning review is not runtime evidence.

## Explicit deferrals

See ISSUES.md. Later work can add scoped policies, other native clients and host platforms behind these boundaries. None is a reason to expand this release. This candidate becomes the current browser-MVP plan only upon owner approval; parent draft remains historical planning context.
