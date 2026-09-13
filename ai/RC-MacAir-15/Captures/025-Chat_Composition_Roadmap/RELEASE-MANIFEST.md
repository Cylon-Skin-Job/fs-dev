# Chat Composition Roadmap — Release Manifest

**Candidate ID:** `CHAT-COMPOSITION-2d34f8b45562f8f3`
**Candidate status:** `SPEC-00 ACCEPTED — OVERLAID CANDIDATE OWNER-APPROVED; CHAT-01 DISPATCH AUTHORIZED`
**Prepared:** 2026-09-05
**Overlay round:** 2026-09-13
**Clean-room verdict:** `PRIOR CANDIDATE CLEAN (2026-09-05); OVERLAID CANDIDATE CLEAN (2026-09-13)`

## 1. Candidate Identity

The candidate ID is derived from the first 16 hexadecimal characters of the
SHA-256 of the ordered lines `<artifact-sha256><two spaces><artifact-path>`, with
paths relative to this bundle. The complete aggregate is:

```text
2d34f8b45562f8f3034c6801c3409bc48bf3af56c13af4ad015ead9297713505
```

**Previous candidate:** `CHAT-COMPOSITION-e3d2c49f044cd7f7` (owner-approved
2026-09-05; aggregate `e3d2c49f044cd7f7d5c913a5e03ee3c9f92f50636f8455acb5bad01dc73a1dc7`)
remains the basis under which SPEC-00 was accepted. The overlaid candidate adds
`BRIDGE-02-CONFORMANCE-OVERLAY.md`, updates `ISSUES.md`, `BUNDLE-INDEX.md`,
`ROADMAP.md`, and `SPEC-01`–`SPEC-04`, and leaves `SPEC-00`, `DECISIONS.md`, and
`GUIDANCE.md` byte-unchanged.

Ordered normative artifacts:

| Order | Artifact | SHA-256 |
|---:|---|---|
| 01 | `BUNDLE-INDEX.md` | `11a4844d31fd7f6f619b4d1f992d42bca2518282a2512f472067e1f87fb6ea0b` |
| 02 | `DECISIONS.md` | `6c34943a9b53ef81e3020660313dabcd4697babd60e77287fc1b9928bfec2f7b` |
| 03 | `ISSUES.md` | `2e68120f5aa32f612b00c4469c32b0f224cebf0f66e9c2704e683d7748cd4e9a` |
| 04 | `GUIDANCE.md` | `60df8af9b089b14af10ae2eb82d726fc58e0f12b7f18f122a0f1b1ef35800405` |
| 05 | `BRIDGE-02-CONFORMANCE-OVERLAY.md` | `21978c82b67e01dcfc94fb53b926d56b45166774d34a72eb731b55384167842b` |
| 06 | `ROADMAP.md` | `6318e881db4bffb1d3610ff2170a3c59e37c14944c3f68db8d8cd3630fe7d72c` |
| 07 | `SPEC-00-TRUSTED-FUSION-SHELL-AUTHORITY.md` | `154c47db9f7181993751390468267e376470727937cdc8595d827e45b0b5ab0b` |
| 08 | `SPEC-01-THREAD-GROUP-FOUNDATION.md` | `df2b3cc8ef7f9eaea49b9e74f382d91ab69e36c8f0ed29e0e8bccddaa0013ade` |
| 09 | `SPEC-02-COMPOSABLE-CHAT-SURFACES.md` | `106e9468def9e6943e370357af2285f3d996f79fa63df2f1e009b9ce64b01721` |
| 10 | `SPEC-03-THREAD-WORKSURFACE-CONTINUITY.md` | `807f4350a201dcd148256aa2a472cf509c8b4b3c4d065f18b416588b017f002a` |
| 11 | `SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md` | `fae72715b29796dd4142f866ff757cc57b0a593062bc91734ede39a354ccfe87` |

The 11-file aggregate above is the SHA-256 of these eleven ordered
`<sha256><two spaces><path>` lines. The pre-overlay 10-file aggregate
`e3d2c49f044cd7f7…` was reproduced over the original ten-artifact list as a
sanity check before this overlay edit.

`CLEAN-ROOM-REVIEW.md` and this manifest are evidence/identification artifacts,
not normative inputs to their own candidate hash.

## 2. Ordered Roadmap

1. **SPEC-00 — Trusted Fusion Shell Authority** — owner-accepted and integrated
   (commit `1baaffa`, acceptance `7f0d3c8`, 2026-09-07).
   Gate: owner-accepted Agent Tool Provenance product bytes integrated into the
   implementation baseline.
   Outcome: secure Electron shell origin, centralized runtime endpoint,
   one-use connection proof, trusted-shell route guard, and child-process
   secret isolation without Thread Group or bridge behavior.
2. **SPEC-01 — Thread Group Foundation**
   Gates: accepted SPEC-00, owner-accepted BRIDGE-01 (`16ccecf`) and
   owner-approved BRIDGE-02 through `BRIDGE-02-CONFORMANCE-OVERLAY.md`, and the
   owner-released accepted Tab Platform milestone.
   Outcome: stable view IDs, consumption of accepted shell authority, durable one-member Thread
   Groups, migration, public lifecycle, group actions, and Fork retirement.
3. **SPEC-02 — Composable Chat Surfaces**
   Gates: owner-accepted SPEC-01 and independently accepted Generic Component
   Tab Host.  
   Outcome: explicitly addressed Main Chat/Legacy surfaces, ThreadRail, isolated
   session/surface state, and `fusion.chat-surface` registration.
4. **SPEC-03 — Thread Worksurface Continuity**
   Gate: owner-accepted SPEC-02.  
   Outcome: view-owned group-keyed content state, acknowledged switching,
   conflict/restart behavior, managed placement lane, and deletion cleanup.
5. **SPEC-04 — Move Chat to Side Chat**
   Gate: owner-accepted SPEC-03.  
   Outcome: unchanged old chat in a recoverable Side Chat tab, new empty Main
   Chat peer, repeated Move, member access, and Secondary Chat retirement.

The `BRIDGE-02-CONFORMANCE-OVERLAY.md` overlay is packet-wide: it binds
SPEC-01 through SPEC-04 as the consuming instrument of the BRIDGE-02
`ChatActionContext` contract.

No following SPEC may begin before the preceding SPEC is explicitly accepted by
the owner.

## 3. Resolved Owner Decisions

This candidate propagates `CHAT-RD-001` through `CHAT-RD-017` from
`DECISIONS.md`, including:

- five single-domain SPECs;
- Provenance and Generic Host acceptance gates;
- separate group/session/turn/exchange/surface/tab/placement identities;
- canonical Thread Group terminology and Main/Side presentation terms;
- Fork removal;
- current eager New Thread behavior for this bounded roadmap;
- session-owned Provenance and acknowledged model selection;
- content-only worksurface persistence with service-managed placement layout;
- empty replacement Main Chat on Move;
- stable `sideChatPlacementId`; and
- stable view-ID preflight plus narrow trusted-shell command authority.

Resolved and open implementation findings are recorded as `CHAT-I-001` through
`CHAT-I-035` in `ISSUES.md`.

## 4. Explicit Non-Blocking Deferrals

| Deferred domain | Future gate |
|---|---|
| Pending New Chat/provider-signal commit | Separate candidate after SPEC-01 and accepted Provenance reconciliation |
| Collections folder/tag behavior | Stable accepted Thread Group and view-config contracts |
| System/View relocation and protected root | Accepted SPEC-01 stable IDs and a dedicated System permission SPEC |
| Send to Parent/New Side/New Thread expansion | Accepted group/member/placement contracts from this roadmap |
| Auto-Rename Chat Threads | Dedicated plugin contract and installation/runtime authority |
| Transcript export | Dedicated destination, permissions, and recovery contract |
| Project/folder/template creation and CWD override | Dedicated project/view creation contract |
| Plugins and dynamic registration | Dedicated trust, permission, installation, and component discovery contracts |
| General remote-account authentication | Separate from SPEC-00's local trusted Fusion-shell boundary |
| Permanent deleted-group Provenance browsing | Dedicated retained-membership/history decision |

None of these deferrals is required to demonstrate the five accepted outcomes.

## 5. Required Completion Evidence

Each SPEC must produce:

- exact accepted baseline commit and prerequisite reports;
- one fresh builder per vertical slice;
- builder-owned and orchestrator-owned first-clean review evidence;
- changed paths and exact command results;
- targeted public-route, migration/state, fan-out, restart/readback, and Electron
  smoke evidence required by that SPEC;
- full server test and client build results;
- warnings, residual risks, deviations, and downstream impact assessment;
- updated routed Chat/View documentation; and
- explicit owner acceptance before the next SPEC.

Roadmap completion additionally requires the combined acceptance gate in
`ROADMAP.md` §6, including retained Provenance, Generic Host non-regression,
concurrent Main/Side isolation, worksurface restoration, repeated Move,
close-without-resurrection, and absence of Fork/old Secondary Chat paths.

## 6. Clean-Room Result

Candidate `CHAT-COMPOSITION-e3d2c49f044cd7f7` completed a fresh independent
read-only clean-room pass on 2026-09-05. The reviewer reproduced the exact
aggregate and all ten artifact hashes and reported `CLEAN — no material
findings`. That pass covered the pre-overlay candidate only. The overlaid
candidate `CHAT-COMPOSITION-2d34f8b45562f8f3` (aggregate
`2d34f8b45562f8f3034c6801c3409bc48bf3af56c13af4ad015ead9297713505`) completed a
fresh independent read-only clean-room pass on 2026-09-13 (reviewer
`ses_f6615c595ffetDxYDbCdRl98vA`, GLM 5.3 Flash high reasoning effort); the
reviewer reproduced the aggregate and all eleven artifact hashes and reported
`CLEAN — no material findings`; two non-blocking advisories were recorded
(prerequisite gate phrasing; before-state dead-path quotes in the BRIDGE-02 R-1
narrative). See `CLEAN-ROOM-REVIEW.md` for the scope, verified contracts, and
remaining execution gates.

## 7. Approval Record

- **Owner approval:** granted 2026-09-05 by the owner's direct instruction to
  start a new implementation session for candidate
  `CHAT-COMPOSITION-e3d2c49f044cd7f7`
- **Implementation gate:** satisfied by owner-accepted PROV-01 integration merge
  `d31fc8aeab0eae9cd622cad7b6db7b81a3498e87`, with integration acceptance
  recorded in `3110bd0`
- **Implementation before approval:** prohibited
- **Overlay round (2026-09-13):** the BRIDGE-02 conformance overlay
  (`BRIDGE-02-CONFORMANCE-OVERLAY.md`) was applied to this packet. SPEC-00
  acceptance and bytes are unchanged. Owner re-approval of this overlaid
  candidate — and owner approval of the BRIDGE-02 candidate — is required before
  CHAT-01 dispatch. No implementation is authorized by the overlay.
- **OVERLAID CANDIDATE OWNER-APPROVED — 2026-09-13.** Owner statement:
  “Approve.” The overlaid candidate `CHAT-COMPOSITION-2d34f8b45562f8f3` and the
  BRIDGE-02 living candidate `BRIDGE-1e722a9c6d30f6b5` are owner-approved. This
  satisfies the remaining owner-approval gate recorded in `ISSUES.md`
  `CHAT-I-035`; the packet's normative bytes are unchanged by this approval
  record (the manifest is excluded from its own candidate hash). CHAT-01
  (SPEC-01 Thread Group Foundation) may now dispatch through a fresh
  orchestrator; each following SPEC still requires explicit owner acceptance of
  its predecessor.

After approval, execution may begin through either:

1. `$orchestrator` with the first approved SPEC after its external gate clears;
   or
2. `$roadmap-implementation-supervisor` with this approved roadmap, which will
   enforce sequential SPEC acceptance.
