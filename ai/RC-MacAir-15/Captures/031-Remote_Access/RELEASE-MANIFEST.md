# Remote Access Roadmap — Release Manifest

**Candidate ID:** `REMOTE-ACCESS-29cca342511773dc`
**Candidate status:** `AWAITING OWNER APPROVAL`
**Prepared:** 2026-09-12
**Clean-room verdict:** `CLEAN — 2 fresh independent passes` (full bundle, then focused re-review of repaired artifacts)

## 1. Candidate Identity

The candidate ID is the first 16 hexadecimal characters of the SHA-256 of the
ordered lines `<artifact-sha256><two spaces><artifact-path>`, with paths
relative to this bundle, lines sorted by path. The complete aggregate is:

```text
29cca342511773dcdfc8084a7c68f3ed1e42b3125994efe602d6ab88f3f15205
```

Ordered normative artifacts:

| Order | Artifact | SHA-256 |
|---:|---|---|
| 01 | `BUNDLE-INDEX.md` | `67ec1b0addb8becd25918f120d211f33bdc62916fbd828dee4e3bafc011ef5f1` |
| 02 | `DECISIONS.md` | `33801463d01c00b6e849b2978b2762feb08d9758f8c3d90da18b6cff84c18359` |
| 03 | `GUIDANCE.md` | `5efc459a8eeda1b138aa1e2940f014e8c0d55d6897a3f53da7ab8b126ccebbb0` |
| 04 | `ISSUES.md` | `c1ed409b15b2272ced47eb8e920264a3beb73cba4632e7c62da8950724da7b4f` |
| 05 | `ROADMAP.md` | `2f1149cf5d3e7e21c61ec526b5b9259ac1e5565c269c8bf9b4b19a46d1ec30b6` |
| 06 | `SPEC-01-HOST-SERVICE-AND-BIND.md` | `b9993055ea6477e34177cba8c2579eeb9bcc2a1d57c7a2311c4996a96c8a0832` |
| 07 | `SPEC-02-BROWSER-CLIENT-TRANSPORT.md` | `75326aca0b89715eb1dc315fbe1468ed3bbd69a00feaf6fc9d03f0c89986c2f3` |
| 08 | `SPEC-03-DEVICE-PAIRING-AND-TOKENS.md` | `6f110ca163be3c7d1537a69abf6aaec4162ab62d7a4cd98e8963799463e6a231` |
| 09 | `SPEC-04-REMOTE-CONNECTION-MANAGEMENT.md` | `58b7db86ab88c4b797b336eed747fc2072855cde10eb2429d7d0b6ce32d92bc7` |
| 10 | `SPEC-05-CLIENT-AWARE-REMOTE-SURFACE.md` | `b4ce5837d9f019834358c5b339627a2eefb5c884f6dc78a782f31a6c523a29c2` |
| 11 | `SPEC-06-PWA-AND-PHONE-SHELL.md` | `3255ee376d1cc40d7c79f719ed87b46dac371d9df4c995200df850ed9e34530c` |

`CLEAN-ROOM-REVIEW.md` and this manifest are evidence/identification artifacts,
not normative inputs to their own candidate hash.

## 2. Ordered Roadmap

1. **SPEC-01 — Host Service And Bind**
   Outcome: explicit `FUSION_SERVE_HOST` opt-in with loopback default, trust
   gate (`FUSION_REMOTE_ACCESS` / `FUSION_TRUSTED_NETWORK`), fail-closed
   refusals, operator evidence.
2. **SPEC-02 — Browser Client Transport**
   Gate: accepted SPEC-01.
   Outcome: same-origin browser bootstrap lane; Electron exact-loopback
   descriptor lane preserved; served-page smoke with reconnect.
3. **SPEC-03 — Device Pairing And Tokens**
   Gate: accepted SPEC-02.
   Outcome: Secrets Manager `remote-device` sub-module, trusted-shell-only
   mint/list/revoke, QR deep link, upgrade-time token verification, immediate
   revocation, secret hygiene.
4. **SPEC-04 — Remote Connection Management**
   Gate: accepted SPEC-03.
   Outcome: managed non-interactive SSH tunnel, target store + deep-link
   ingestion, full-viewport `RemoteViewer`, unmount-both mode switch, local
   background work continuity.
5. **SPEC-05 — Client-Aware Remote Surface**
   Gate: accepted SPEC-04; R1 resolved as RA-RD-011.
   Outcome: server-derived client kind, host-drawn remote indicator, validated
   exit `postMessage`, paired-device capability parity with the
   `FUSION_REMOTE_MUTATIONS` forbid gate, the authorized contract change
   recorded as a 025 SPEC-00 report deviation addendum, screenshot
   compositing resolved or explicitly deferred.
6. **SPEC-06 — PWA And Phone Shell**
   Gates: accepted SPEC-02 and SPEC-03 (independent of SPEC-04/05 and R1;
   execution order may be 06-before-04 only with owner approval recorded here).
   Outcome: manifest/icons/iOS metadata, phone pairing screen, bounded phone
   shell CSS, resume reconnect, Tailscale runbook (D-1).

## 3. Resolved Owner Decisions

| ID | Decision | Status |
|---|---|---|
| RA-RD-001 | Permanent sleep-disabled host (Mac Mini) | settled |
| RA-RD-002 | One server, three client types | settled |
| RA-RD-003 | Either/or surfaces per client; unmount both; background work unaffected | settled |
| RA-RD-004 | Full-viewport iframe; host draws the remote indicator | settled |
| RA-RD-005 | Long-lived paired token; QR/deep-link provisioning; per-device revocation | settled |
| RA-RD-006 | Remote trust is a sibling lane; trusted-shell untouched | settled |
| RA-RD-007 | Upgrade-header token transport; hash at rest; constant-time compare | settled |
| RA-RD-008 | Loopback default; routable bind is explicit opt-in | settled |
| RA-RD-009 | LAN first, Tailscale layer later, PWA last | settled |
| RA-RD-010 | Fork-era cleanup belongs to the 025 lane; untouched here | settled |
| RA-RD-011 | Paired devices hold full mutation capability; `FUSION_REMOTE_MUTATIONS` can forbid it (resolves former R1) | settled (owner, 2026-09-12) |

## 4. Explicit Non-Blocking Deferrals

| ID | Deferral | Future gate |
|---|---|---|
| D-1 | Tailscale join, MagicDNS, Tailscale Serve HTTPS origin, re-pair at origin change | After SPEC-06 acceptance; runbook delivered by SPEC-06 slice 06D |
| D-2 | Host sleep-disable and autostart (login item/launchd) | Host stands up; documented in SPEC-01 operator notes |
| D-3 | Full native-capability parity on remote clients (export, native capture flows, offline) | After remote MVP daily use; separate roadmap |
| D-4 | Multi-user hub/collaboration from `machine-sync-sharing-model.md` | No trigger; not authorized by this bundle |

## 5. Required Evidence For Completion

Per SPEC: builder/orchestrator clean gates, the minimum commands
(`npm test` server; `npm run build` client), each SPEC's targeted checks, and
owner acceptance. Roadmap completion additionally requires the six integrated
outcomes in `ROADMAP.md` §6, including revoked-device termination evidence and
unregressed accepted contracts.

## 6. Approval

To release this candidate, the owner approves the exact candidate ID:

> **Approved candidate: `REMOTE-ACCESS-29cca342511773dc`**

Any normative change after approval updates this living candidate, records the
decision or deviation, and requires fresh review of only the affected
artifacts. Changed hashes are not a blocker.

R1 is resolved (RA-RD-011, owner 2026-09-12): paired devices hold full
mutation capability by default with `FUSION_REMOTE_MUTATIONS` as the forbid
switch; SPEC-05 implements it and records the authorized contract change as a
025 SPEC-00 report deviation addendum. All SPECs, including SPEC-05, may
dispatch in order after candidate approval.

**Downstream invocation options after approval:**

1. `$orchestrator` with one approved SPEC (e.g.
   `SPEC-01-HOST-SERVICE-AND-BIND.md`) for direct execution; or
2. `$roadmap-implementation-supervisor` with this approved roadmap for
   sequential SPEC-by-SPEC execution with owner acceptance between SPECs.
