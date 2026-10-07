# Issues and explicit deferrals

| ID | Authority | Status | Affected artifacts / resolution and dependency impact |
|---|---|---|---|
| BR-I01 | active_code_constraint | validated | Browser transport currently requires Electron; SPEC-05 adds explicit sibling mode, preserving strict shell failure behavior. |
| BR-I02 | active_code_constraint | validated | WS shell gates do not secure all HTTP routes. SPEC-03 must inventory and protect every browser-reachable product surface before exposure. |
| BR-I03 | active_code_constraint | validated | Product registry currently accepts managed trusted-shell or standalone untrusted only. SPEC-03 extends activation using verified browser principals without loosening pending-recipient isolation. |
| BR-I04 | active_code_constraint / proposal | propagated_pending_review | Shared server activeWorkspace plus global HTTP resolution. Candidate proposes retaining shared selection (BR-D14), highlighted for owner approval after optional question. Independent selection would add a workspace-lifecycle SPEC and change HTTP resource context/tests. No answer is treated as approval. |
| BR-I05 | active_code_constraint / proposal | propagated_pending_review | Mac window-close already leaves Electron main alive; Quit stops child. SPEC-06 formalizes optional host mode/login startup, not a separate daemon. Candidate approval resolves BR-D13. |
| BR-I06 | owner_decision / spec_contract | propagated_pending_review | Extend ordinary mutation eligibility to verified full-access browser principals, preserving exact shell proof and System owner guards. SPEC-01/03 record affected wiki/025 report addendum at implementation; do not overwrite existing approved history. |
| BR-I07 | active_code_constraint | validated | Earlier draft is untracked, concurrent docs/code dirty; preserve parent and unrelated changes. Source snapshot is evidence only, re-inventory at dispatch. |
| BR-I08 | implementation_choice | propagated_pending_review | Separate loopback ingress in one runtime replaces earlier routable binding proposal. SPEC-03 owns mount-order inventory and tests; SPEC-07 targets only this ingress. |
| BR-I09 | implementation_choice | propagated_pending_review | Electron custom protocol cannot be assumed in browsers; SPEC-05 classifies all affected surfaces. No unsafe same-origin promotion of workspace HTML/scripts. |
| BR-I10 | implementation_choice | propagated_pending_review | Full-access registration is browser-profile identity, not hardware attestation. Device label is display metadata. Cookie loss/profile reset requires new pairing. |

| BR-I11 | active_code_constraint / proposal | propagated_pending_review | Current socket cleanup terminates its owned provider. SPEC-04 explicitly implements BR-D17; browser recovery and host lifecycle depend on its acceptance. |

## Non-blocking deferrals

Owner for product deferrals: Fusion product owner; implementation owner assigned when the future gate is invoked.

| ID | Deferred work | Future trigger / boundary |
|---|---|---|
| BR-F01 | Mobile layout, PWA installation/offline caching | Owner requests phone release after browser MVP; no service worker or offline edits here. |
| BR-F02 | Fusion-to-Fusion webview/iframe and remote targets | Owner requests desktop remote mode; revisit origin/storage/exit protocol then. |
| BR-F03 | Scoped collaborator policies, permission editor, view elevation, regex and OpenCode hooks | Owner requests bounded access; full-access interface exists but no shell sandbox claims. |
| BR-F04 | Unattended agents/watchdogs | Separate job authorization/lifecycle contract; connection recovery does not authorize autonomous retries. |
| BR-F05 | Native iOS/Android, Capacitor, embedded networking, HealthKit, capture/sensor integrations | Explicit native-client roadmap; current HTTP/WS interfaces can be reused. |
| BR-F06 | Public internet, Firebase signaling, automatic router mapping | Not part of this deployment model; new threat model required. |
| BR-F07 | Boot-before-login daemon, Linux/Windows dedicated host package | Owner requests platform/service expansion; MVP is Mac user-session host mode. |
| BR-F08 | Native print/export/screenshot/browser-webview parity | Capability inventory in SPEC-05; disabled native-only actions are disclosed, not permission denials. |
| BR-F09 | Enforced malicious-agent filesystem isolation | Separate process/OS isolation design; full-access hooks are not this guarantee. |
| BR-F10 | Multiple independent workspace selections | Only deferred if BR-D14 shared selection is accepted; otherwise promote to required SPEC before finalizing. |

No remaining review finding may be silently relabeled a deferral if it prevents the current outcomes. Security boundary defects in the new ingress are release blockers, not future hardening.
