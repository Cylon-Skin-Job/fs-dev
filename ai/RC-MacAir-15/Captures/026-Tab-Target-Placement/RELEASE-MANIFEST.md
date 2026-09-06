# TABS-03 Release Manifest

**Candidate ID:** `TABS-03-9683fd552866ec41`  
**Candidate status:** `CLEAN — AWAITING OWNER APPROVAL`  
**Prepared:** 2026-09-04  
**Clean-room verdict:** `CLEAN`

## 1. Candidate identity

The candidate ID is the prefix `TABS-03-` plus the first 16 hexadecimal
characters of the SHA-256 of the ordered lines
`<artifact-sha256><two spaces><artifact-path>`. Paths are relative to this
bundle. The complete aggregate is:

```text
9683fd552866ec4126d19f2c7cd6b2a4c32a8d72911792387f5f4caa8ceb2b46
```

| Order | Normative artifact | SHA-256 |
|---:|---|---|
| 01 | `README.md` | `d646f75b29edb2e84f9d0c7931cf14e1f3d3598558052fa7f4f99e157dd7caab` |
| 02 | `DECISIONS.md` | `b6c6725b336da146c8d235ad532300e2842b82cbd2b6a69a298c13cace52f705` |
| 03 | `ISSUES.md` | `f3e82d09173e266be14af8fbf0a9673f6114b177d057020e970f24eabbebac7b` |
| 04 | `CODE-INVENTORY.md` | `2974e0ecb3bc0432869be6a84ec531b2625d1ec9a3b23dd3b0d32fd9bb1a54dd` |
| 05 | `IMPLEMENTATION-GUIDANCE.md` | `11a4471d3f54bbf653d4d4762d1678380a7461e4e20c1d0240d5c53f428e2e65` |
| 06 | `TAB_TARGET_PLACEMENT_SPEC.md` | `1d598106b8dbf47d548f4de459e3d868441c1bfbbebe08782c7201d49a53a44f` |
| 07 | `../002-SPECs/TABS-PROVENANCE-COORDINATION/INTERFACE-CONTRACT.md` | `0dfde7328fd91062d044ae39b92b41f72fbf78c3746dbf39b40b60baa5f2c299` |
| 08 | `../002-SPECs/TABS-PROVENANCE-COORDINATION/OWNER-DECISIONS.md` | `e5b813df2b4c834689154436856ff7982b8b216ad781aef6349a0c1b916a1234` |
| 09 | `../002-SPECs/TABS-PROVENANCE-COORDINATION/DEPENDENCY-LEDGER.md` | `ba2377d2e302a5776c3f193333fe76f5f4c431d6f44ea27d657715598fca908f` |
| 10 | `../002-SPECs/TABS-PROVENANCE-COORDINATION/TABS-HANDOFF.md` | `4fd39cc98db361ddf3b2bda3d01878fc4be6d98d93d5aeb2a5fbdd154217f44e` |

`CLEAN-ROOM-REVIEW.md` and this manifest are evidence/identification artifacts,
not normative inputs to their own candidate hash. Prerequisite SPECs/reports,
Vision decisions, repository guidance, routed standards, and active code/tests
are external authorities/evidence and are not rewritten into this candidate.

## 2. Roadmap order

1. Refresh the current-byte clean-room review and obtain owner approval of this
   exact TABS-03 candidate. TABS-02A is already owner-accepted.
2. Implement TABS-03 Slice 1 — placement contract, validation, pure transition.
3. Implement TABS-03 Slice 2 — connected controller and reveal boundary.
4. Implement TABS-03 Slice 3 — public host proof and regression closure.
5. Obtain owner acceptance of the completed TABS-03 implementation.
6. Begin BRIDGE-01 only under its separately reviewed and approved SPEC.

No TABS-03 implementation may start until this exact candidate is independently
clean and owner-approved. The TABS-02A implementation prerequisite was accepted
on 2026-09-04.

## 3. Resolved decision IDs

This candidate propagates `TTP-D01` through `TTP-D19`, including:

- one source-independent placement route;
- `presenterId + targetKey` exact identity;
- existing-target matching before resolution and disposition;
- non-destructive Current and deduplicating New behavior;
- protected reserved/degraded/legacy/unaddressed tabs;
- controller-minted tab/component-instance identities;
- strict request, resolver, presentation, snapshot, result, and error bounds;
- atomic acknowledged commits and per-host concurrent serialization;
- post-commit presenter reveal with safe failure; and
- explicit separation from UEB, provenance, persistence, control-plane, Chat,
  and production-adopter authority.

Resolved implementation findings are `TTP-I01` through `TTP-I21` in
`ISSUES.md`. TTP-I01 remains a dispatch prerequisite rather than an undefined
behavior.

## 4. Explicit non-blocking deferrals

| Issue | Deferred domain | Future gate |
|---|---|---|
| TTP-I06 | Production Capture/File/Wiki/other adoption | One separately approved `VIEW-*` SPEC per adopter |
| TTP-I07 | Actor/time/action admission and provenance publication | Accepted TABS-03 plus separately approved BRIDGE-01 |
| TTP-I08 | Durable worksurface persistence/restart hydration | Dedicated schema, migration, and hydration SPEC |
| TTP-I09 | Dynamic registration, permissions, consent, revocation | DB-authoritative control-plane package |

The known `view-tab-runtime.spec.ts` fixture limitation is not hidden scope; it
is governed by the exact diagnostic rule in SPEC §11 and deterministic
Capture/File/public-host regressions remain blocking.

## 5. Required completion evidence

- one fresh builder per slice and first clean builder-owned review;
- orchestrator inspection and first clean orchestrator-owned review;
- exact focused/regression commands and passing counts;
- typecheck, targeted lint, build, and diff-check results;
- public-host fill, append, dedupe/activate/reveal, concurrency, degraded-state,
  and safe-failure evidence;
- exact changed-path inventory and relevant-byte aggregate fingerprint;
- deviation and downstream-impact accounting;
- explicit proof that no production adapter, server, UEB, provenance,
  persistence, or Chat surface was adopted; and
- explicit owner acceptance before BRIDGE-01 or another dependent package.

## 6. Clean-room result

Fresh reviewer `tabs_03_candidate_review_4` independently inspected the exact
candidate bytes identified above and reported:

> CLEAN — no material findings.

The reviewer reproduced all ten normative artifact hashes, aggregate
`9683fd552866ec4126d19f2c7cd6b2a4c32a8d72911792387f5f4caa8ceb2b46`,
candidate ID `TABS-03-9683fd552866ec41`, and the accepted 22-path TABS-02A
preflight. The complete review scope, prior findings, and repair trail are in
`CLEAN-ROOM-REVIEW.md`. Explicit owner approval remains required before
orchestration.

## 7. Downstream invocation routes after approval

- Direct: invoke `$orchestrator` with the absolute path to
  `TAB_TARGET_PLACEMENT_SPEC.md` after current-candidate review and owner
  approval.
- Supervised: invoke `$roadmap-implementation-supervisor` with this approved
  bundle; it must stop for explicit owner acceptance after TABS-03.

Approval must name candidate `TABS-03-9683fd552866ec41`. Any normative edit
after approval changes the living candidate, requires regenerated hashes, and
requires affected review again.
