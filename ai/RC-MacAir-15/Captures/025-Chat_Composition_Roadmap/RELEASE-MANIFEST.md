# Chat Composition Roadmap — Release Manifest

**Candidate ID:** `CHAT-COMPOSITION-e3d2c49f044cd7f7`
**Candidate status:** `OWNER APPROVED — SPEC-00 READY FOR IMPLEMENTATION`
**Prepared:** 2026-09-05
**Clean-room verdict:** `CLEAN — 1 fresh independent pass`

## 1. Candidate Identity

The candidate ID is derived from the first 16 hexadecimal characters of the
SHA-256 of the ordered lines `<artifact-sha256><two spaces><artifact-path>`, with
paths relative to this bundle. The complete aggregate is:

```text
e3d2c49f044cd7f7d5c913a5e03ee3c9f92f50636f8455acb5bad01dc73a1dc7
```

Ordered normative artifacts:

| Order | Artifact | SHA-256 |
|---:|---|---|
| 01 | `BUNDLE-INDEX.md` | `9d957a85d2a66ae72440b8b55b6c5d07fd5d7c35015f8d464a017cb2bbb1438b` |
| 02 | `DECISIONS.md` | `6c34943a9b53ef81e3020660313dabcd4697babd60e77287fc1b9928bfec2f7b` |
| 03 | `ISSUES.md` | `48924a4de82c8995b763ac7914a15fc84433f1921b31d77a2e5dd3849fec548b` |
| 04 | `GUIDANCE.md` | `60df8af9b089b14af10ae2eb82d726fc58e0f12b7f18f122a0f1b1ef35800405` |
| 05 | `ROADMAP.md` | `7af19e9ce1650aeb3d982d86fe93191b3ccca5d878cf8e9f62d36e535659df4f` |
| 06 | `SPEC-00-TRUSTED-FUSION-SHELL-AUTHORITY.md` | `154c47db9f7181993751390468267e376470727937cdc8595d827e45b0b5ab0b` |
| 07 | `SPEC-01-THREAD-GROUP-FOUNDATION.md` | `85daec5193dc5693c9e842f09f19a4f8e474e1af1060a341447b4ad9c46afe39` |
| 08 | `SPEC-02-COMPOSABLE-CHAT-SURFACES.md` | `34c4cd1fbd4cffd949be25a3bdcd3ca2870ee1bede523a1f9bcd66069f956b7c` |
| 09 | `SPEC-03-THREAD-WORKSURFACE-CONTINUITY.md` | `e18ba9f4231245792f4d958ab90951c7ed8c19f7a84a9f6674e49a7b08ceb966` |
| 10 | `SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md` | `4ee617394aacf7e882f8e48c6b022a787cfea81f1964dbfb920d21a7de48c3a3` |

`CLEAN-ROOM-REVIEW.md` and this manifest are evidence/identification artifacts,
not normative inputs to their own candidate hash.

## 2. Ordered Roadmap

1. **SPEC-00 — Trusted Fusion Shell Authority**
   Gate: owner-accepted Agent Tool Provenance product bytes integrated into the
   implementation baseline.
   Outcome: secure Electron shell origin, centralized runtime endpoint,
   one-use connection proof, trusted-shell route guard, and child-process
   secret isolation without Thread Group or bridge behavior.
2. **SPEC-01 — Thread Group Foundation**
   Gates: accepted SPEC-00, approved BRIDGE-01 and BRIDGE-02, and the
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
findings`. See `CLEAN-ROOM-REVIEW.md` for the scope, verified contracts, and
remaining execution gates.

## 7. Approval Record

- **Owner approval:** granted 2026-09-05 by the owner's direct instruction to
  start a new implementation session for candidate
  `CHAT-COMPOSITION-e3d2c49f044cd7f7`
- **Implementation gate:** satisfied by owner-accepted PROV-01 integration merge
  `d31fc8aeab0eae9cd622cad7b6db7b81a3498e87`, with integration acceptance
  recorded in `3110bd0`
- **Implementation before approval:** prohibited

After approval, execution may begin through either:

1. `$orchestrator` with the first approved SPEC after its external gate clears;
   or
2. `$roadmap-implementation-supervisor` with this approved roadmap, which will
   enforce sequential SPEC acceptance.
