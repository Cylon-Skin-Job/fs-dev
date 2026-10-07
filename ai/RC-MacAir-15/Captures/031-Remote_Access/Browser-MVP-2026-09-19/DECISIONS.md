# Browser remote access — authority and decisions

Status: proposed execution candidate; implementation not authorized by this document.

## Authority

`owner_decision` means explicit direction in the current conversation. `spec_contract` means a previously accepted contract. `source_of_truth_contract` means the active wiki. `active_code_constraint` is feasibility, not permission. `implementation_choice` resolves technical means within the requested behavior. `proposal` requires approval through the candidate gate.

| ID | Class | Contract |
|---|---|---|
| BR-D01 | owner_decision | Initial release is one central home Fusion instance accessed by authorized browsers on other laptops. |
| BR-D02 | owner_decision | The host machine identity, ai/<machine> configuration/views, database, workspaces and chat are authoritative. A browser does not create another machine subtree or independent workspace database. |
| BR-D03 | owner_decision | Explicitly authorized MVP sessions have full regular access. Introduce a real centralized permission interface with one full-access policy; do not build scopes, regex enforcement, OpenCode hooks or elevated system views. |
| BR-D04 | owner_decision | Server unavailable means no editing or new operations. No offline synchronization or automatic mutation replay. |
| BR-D05 | owner_decision | Future collaborators are explicitly authorized trusted people; scoped access is a future agreement/guardrail, not a claim of hostile-user or shell isolation. |
| BR-D06 | owner_decision | Fusion-to-Fusion remote web surfaces, mobile adaptation/PWA, native apps, sensors, sharing and unattended jobs are future work. |
| BR-D07 | owner_decision | Prefer multiple domain-bounded SPECs over one SPEC spanning unrelated concerns. |
| BR-D08 | implementation_choice grounded in discussed MVP | Tailscale installed and signed in on both computers; Tailscale Serve supplies a private HTTPS origin. No Firebase, public ingress, router forwarding, API key or embedded Tailscale SDK. |
| BR-D09 | spec_contract | Preserve trusted-shell fd-3/HMAC proof, exact Electron descriptor, generation fencing and deferred product activation. Remote browser authority is a sibling, not forged trusted-shell. |
| BR-D10 | implementation_choice | One Node runtime, one SQLite owner, one product router graph and one renderer build. Add a separate exact-loopback HTTP/WS browser listener inside that process. Tailscale targets only that listener. This avoids exposing legacy local HTTP endpoints or changing shell authentication. |
| BR-D11 | implementation_choice | Pair a browser profile using a short-lived invitation plus host-side confirmation; remember it using a Secure HttpOnly host-only cookie. Store only credential digests and metadata server-side. No persistent credential in a URL or browser JS storage. |
| BR-D12 | implementation_choice | Enrollment/revocation administration originates in the existing trusted local shell. Authorized browsers get full ordinary product access and self-logout; they cannot mint enrollment invitations or change the remote listener/Tailscale setup. This protects the bootstrap channel, not a workspace permission tier. |
| BR-D13 | proposal | Mac host mode keeps Electron main and its authenticated server child running with no open window, with optional login startup. Full Quit/Stop Host stops service. A separate launchd daemon, Linux headless package and attachment of Electron to an external daemon are deferred. |
| BR-D14 | proposal | Recommended candidate assumption: retain the existing shared active workspace for MVP and clearly indicate that switching affects connected clients. Independent workspace selection requires its own lifecycle SPEC; do not imply existing per-socket fields already implement it. |
| BR-D15 | implementation_choice | Tailnet Lock is recommended and documented; activation/signing/recovery stay operator-owned. Do not claim it is enabled merely because Tailscale connects. |
| BR-D16 | source_of_truth_contract | Credential state stays out of content, provider environments, UEB and provenance. Existing System mutations and file-save protections remain owned by their narrow services. |

| BR-D17 | proposal consistent with remote-server intent | Already accepted browser turns continue after browser/network loss, logout/revocation or shared workspace switch; full server quit/explicit Stop still terminate normally. Dedicated SPEC-04 changes existing socket-owned retirement. |

## Reconciliation with the earlier draft

The parent folder is the September 12 draft candidate, not an implementation baseline. Preserve it unchanged. This candidate replaces its execution scope only if approved. Its RA-RD-009 LAN-first/Tailscale-later sequence becomes Tailscale-first deployment here; routable bind and perimeter-only trust are excluded. Its desktop SSH-tunnel/iframe and phone SPECs are deferred. Its long-lived token-in-fragment provisioning is replaced with an expiring invitation and an HttpOnly session; HTTP and WS are both protected. Its raw token Keychain storage is not required for one-way-verifiable browser credentials. Its remote-mutation forbid switch is not implemented: owner requested full-access placeholder policy. Its fixed reviewer/model instructions are replaced by GUIDANCE.md in this candidate. No historical approval is invented.

The accepted 025 trusted-shell contract's exclusive product-mutation eligibility is extended only to authenticated browser principals for ordinary supported product actions. Trusted-shell identity/proof itself remains unchanged. This is the precise supersession authorized by BR-D03, not blanket permission to weaken System, harness, file, tab or provenance contracts.

## What full access means

Full-access permits all registered supported product actions/resources after authentication. Existing validation, view readiness, workspace binding, busy checks, secret handling and source-owned safety rules still apply. It does not enable retired actions, grant an agent the UI's credentials, bypass protected writes, install missing browser capabilities, or turn raw localhost clients into owners. Unknown actions/policies and revoked credentials fail closed. Future grants can be added behind the same interface; this release must not claim future scope enforcement exists.
