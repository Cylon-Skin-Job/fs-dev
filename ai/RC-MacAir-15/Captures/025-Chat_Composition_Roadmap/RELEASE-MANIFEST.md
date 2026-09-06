# Chat Composition Roadmap — Release Manifest

**Candidate ID:** `CHAT-COMPOSITION-a07c15a4d1b153f9`  
**Candidate status:** `AWAITING_OWNER_APPROVAL`  
**Prepared:** 2026-09-03  
**Clean-room verdict:** `CLEAN`

## 1. Candidate Identity

The candidate ID is derived from the first 16 hexadecimal characters of the
SHA-256 of the ordered lines `<artifact-sha256><two spaces><artifact-path>`, with
paths relative to this bundle. The complete aggregate is:

```text
a07c15a4d1b153f9c75269bba9bb4e3ed44f9cee1bcbf2c5d477a63dc89e04f6
```

Ordered normative artifacts:

| Order | Artifact | SHA-256 |
|---:|---|---|
| 01 | `BUNDLE-INDEX.md` | `1756aeef52979d4375a6c4546bc66b17901c9e0bb7ce61e008db9eaa4f7f3b80` |
| 02 | `DECISIONS.md` | `b6227d9cb078046871c5af47ed49c54c3e88e3fc047b6ea522714d3073bdcd56` |
| 03 | `ISSUES.md` | `b0a8c38e2dcb8011f5aad9c1f82649be3ee7f409f1d3c475f346f69438f6356a` |
| 04 | `GUIDANCE.md` | `d1827a47fb29fbc018833dad85a55f705beb53a44c4ff4fe588a1e109439e0c4` |
| 05 | `ROADMAP.md` | `ccf52a089382b2e33dd48144aee6e1814644f15d4ae16bb4614427d26e1e166a` |
| 06 | `SPEC-01-THREAD-GROUP-FOUNDATION.md` | `f73ddf0e389d0db5f13b5277f0153278a3e447f6112d636bef26b2015363f587` |
| 07 | `SPEC-02-COMPOSABLE-CHAT-SURFACES.md` | `34c4cd1fbd4cffd949be25a3bdcd3ca2870ee1bede523a1f9bcd66069f956b7c` |
| 08 | `SPEC-03-THREAD-WORKSURFACE-CONTINUITY.md` | `e18ba9f4231245792f4d958ab90951c7ed8c19f7a84a9f6674e49a7b08ceb966` |
| 09 | `SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md` | `4ee617394aacf7e882f8e48c6b022a787cfea81f1964dbfb920d21a7de48c3a3` |

`CLEAN-ROOM-REVIEW.md` and this manifest are evidence/identification artifacts,
not normative inputs to their own candidate hash.

## 2. Ordered Roadmap

1. **SPEC-01 — Thread Group Foundation**  
   Gate: owner-accepted Agent Tool Provenance.  
   Outcome: stable view IDs, trusted shell authority, durable one-member Thread
   Groups, migration, public lifecycle, group actions, and Fork retirement.
2. **SPEC-02 — Composable Chat Surfaces**  
   Gates: owner-accepted SPEC-01 and independently accepted Generic Component
   Tab Host.  
   Outcome: explicitly addressed Main Chat/Legacy surfaces, ThreadRail, isolated
   session/surface state, and `fusion.chat-surface` registration.
3. **SPEC-03 — Thread Worksurface Continuity**  
   Gate: owner-accepted SPEC-02.  
   Outcome: view-owned group-keyed content state, acknowledged switching,
   conflict/restart behavior, managed placement lane, and deletion cleanup.
4. **SPEC-04 — Move Chat to Side Chat**  
   Gate: owner-accepted SPEC-03.  
   Outcome: unchanged old chat in a recoverable Side Chat tab, new empty Main
   Chat peer, repeated Move, member access, and Secondary Chat retirement.

No following SPEC may begin before the preceding SPEC is explicitly accepted by
the owner.

## 3. Resolved Owner Decisions

This candidate propagates `CHAT-RD-001` through `CHAT-RD-016` from
`DECISIONS.md`, including:

- four single-domain SPECs;
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

Resolved implementation findings are recorded as `CHAT-I-001` through
`CHAT-I-033` in `ISSUES.md`.

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
| General remote-account authentication | Separate from SPEC-01's local trusted Fusion-shell boundary |
| Permanent deleted-group Provenance browsing | Dedicated retained-membership/history decision |

None of these deferrals is required to demonstrate the four accepted outcomes.

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

`CLEAN-ROOM-REVIEW.md` records the latest clean review for these exact normative
hashes. Verdict: **CLEAN — no material release blocker found.**

## 7. Approval Record

- **Owner approval:** pending
- **Required approval wording:** approve candidate
  `CHAT-COMPOSITION-a07c15a4d1b153f9`
- **Implementation before approval:** prohibited

After approval, execution may begin through either:

1. `$orchestrator` with the first approved SPEC after its external gate clears;
   or
2. `$roadmap-implementation-supervisor` with this approved roadmap, which will
   enforce sequential SPEC acceptance.
