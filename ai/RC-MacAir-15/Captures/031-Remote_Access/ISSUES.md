# Remote Access Roadmap — Issues

**Status:** `DRAFT_CANDIDATE`

Lifecycle column values: `open`, `awaiting_owner`, `validated`, `deferred`,
`blocked`.

| ID | Issue | Authority | Lifecycle | Resolution / note |
|---|---|---|---|---|
| RA-I-001 | General remote authentication was explicitly deferred by accepted 025 SPEC-00; this bundle is that deferred lane. | spec_contract (CHAT-RD-015, CHAT-I-013) | validated | RA-RD-006 keeps trusted-shell untouched and adds a sibling `remote-device` path. |
| RA-I-002 | `validateRuntimeDescriptor` accepts only exact `http://127.0.0.1:<port>` / `ws://127.0.0.1:<port>`. | active_code_constraint | validated | SPEC-02 splits validation by lane: Electron lane keeps the exact-loopback contract; browser lane validates same-origin page descriptors. The Electron contract is not loosened. |
| RA-I-003 | The server binds exact IPv4 loopback and rejects any other host (`startup-loopback.js`). | active_code_constraint | validated | SPEC-01 makes the bind host explicit and validated while keeping loopback default and refusal semantics. |
| RA-I-004 | Shell document CSP restricts `connect-src` to its own local server origin; frames inherit nothing that helps a remote WebSocket. | active_code_constraint | validated | RA-RD-006: desktop remote display is a separate document lane (tunnel loopback origin or browser page); the shell document is never repointed at a remote origin. |
| RA-I-005 | Mutation routes gate on the non-enumerable `trusted-shell` role; remote clients must not be able to assert it. | spec_contract + active_code_constraint | resolved | R1 resolved (owner, 2026-09-12, RA-RD-011): `remote-device` holds full mutation capability equal to `trusted-shell` by default; SPEC-05 implements the capability extension with the forbid gate (`FUSION_REMOTE_MUTATIONS`) and full negative coverage. |
| RA-I-006 | Remote clients reach privileged view-mutation routes today only if they hold a role; standalone connections are untrusted. | active_code_constraint | resolved | Consequence of RA-I-005; SPEC-05 extends the gate module per RA-RD-011 so the previously shell-only privileged thread routes admit either role, subject only to the forbid gate; no route allowlist exists. |
| RA-I-007 | `window.electronAPI` absence currently produces a permanent `disconnected` runtime. | active_code_constraint | validated | SPEC-02 adds the browser bootstrap lane and must prove a served page reaches `ready`. |
| RA-I-008 | Device token values require OS-level secure storage on the host. | active_code_constraint | validated | Secrets Manager pattern (SQLite index + macOS Keychain via `/usr/bin/security`) is the accepted store; SPEC-03 adds the sub-module and a migration. |
| RA-I-009 | Migration numbering drifts between worktrees (025 ISSUES CHAT-I-003 precedent); head is `040_reported_ui_context.js` today. | active_code_constraint | validated | SPEC-03 determines the next free migration at dispatch; it never hardcodes a number in advance. |
| RA-I-010 | Material Symbols are served from a workspace-resolved mount (`startup.js:729`), not from the client bundle. | active_code_constraint | validated | Browser/phone client must receive icon assets from the host; SPEC-02 verification asserts icons render in a served page, with SPEC-06 covering the phone shell. |
| RA-I-011 | macOS Local Network/防火墙 prompt appears on first non-loopback bind; operators may misread it as a failure. | active_code_constraint | deferred | Documented in SPEC-01 operator-visible behavior; no product code. |
| RA-I-012 | Electron-only features (`capturePage`, `exportDocument`) no-op in the browser client. | active_code_constraint | deferred | Known limitation recorded for SPEC-02/06; screenshot-from-remote is a SPEC-05 verification concern (remote-capture fallback) and export parity is out of scope. |
| RA-I-013 | iOS Safari suspends WebSockets on lock/background and secure-context features (microphone for voice) require HTTPS. | active_code_constraint | deferred | Reconnect behavior for the browser lane is in scope for SPEC-02 verification; microphone/PWA secure-context behavior is in scope for SPEC-06. Tailscale Serve provides HTTPS via deferral D-1. |
| RA-I-014 | The iframe approach requires the laptop to reach the host's loopback over SSH; ssh must not prompt interactively. | active_code_constraint | validated | SPEC-04 requires key-based non-interactive auth, bounded health/restart semantics, and explicit failure surfacing. |
| RA-I-015 | Dirty worktree: `agent/exact-workspace-paths` carries unrelated modified paths (provenance coordination doc, view-tabs/file-data/playwright config). | active_code_constraint | validated | All SPECs preserve unrelated changes; builders must not revert or absorb them. |
| RA-I-016 | Two distinct clients on one host (host's own shell + remote sessions) must not confuse server-global state. | active_code_constraint | validated | SPEC-05 carries client kind per session; no server-global "remote mode" is introduced. |
| RA-I-017 | Tailscale, Serve, MagicDNS, and certificate provisioning are deployment configuration. | owner_decision | deferred | Deferral D-1 with runbook location and future trigger. |
| RA-I-018 | Sleep-disabled host configuration is deployment configuration. | owner_decision | deferred | Deferral D-2. |
| RA-I-019 | PWA storage on iOS is origin-scoped and cannot write the system Keychain directly. | active_code_constraint | deferred | SPEC-06 uses origin-scoped storage + iOS saved-credential path; native shell is out of scope. |
| RA-I-020 | `025` bundle lanes (Thread Groups, tabs, provenance) are active separately; remote work must not create new WebSocket families where accepted routes fit, or edit their accepted paths. | spec_contract | validated | SPEC-05 reuses the existing client message plumbing; all SPECs re-inventory overlaps at dispatch. |

## Deferrals

| ID | Deferral | Owner | Future trigger |
|---|---|---|---|
| D-1 | Tailscale joining, MagicDNS, Tailscale Serve with TLS, and the HTTPS origin for the phone. | Product owner (deployment) | Completion of SPEC-06 acceptance; runbook authored in this bundle's `GUIDANCE`-adjacent operations note inside SPEC-06 §operator notes. |
| D-2 | Host sleep-disable and login-item/launchd autostart for the host server. | Product owner (deployment) | Host machine stands up; documented as operator steps in SPEC-01. |
| D-3 | Full native-capability parity on remote clients (export-document, capturePage-native flows, offline use). | Product owner | After remote MVP is in daily use; separate roadmap. |
| D-4 | Hub/collaboration features from `machine-sync-sharing-model.md` (multi-user sharing, offline fork-on-conflict). | Product owner | No trigger yet; explicitly not authorized by this bundle. |
