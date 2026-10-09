# SPEC-04 Slice 04B Builder Review Packet

Review only current 04B bytes in the shared dirty checkout. This is a fresh, read-only spec-review-gate pass. Do not edit files. Treat unrelated owner/worker changes as current authorized bytes and report only material 04B correctness, contract, verification, or evidence findings.

Authority:

- `ROADMAP/SPEC-04.md`, Slice 04B
- `ROADMAP/{AUTHORITY-AND-DECISIONS,ARCHITECTURE,GUIDANCE,VALIDATION,ISSUES}.md`
- current Chat wiki and routed standards
- accepted SPEC-01/02/03 reports
- accepted 04A report, source digest `d7b6fce3625a9869597ba5c1e2a27d5d13bd2fff872aada8b1f9090fa8bd8837`, and orchestrator pass 4

Candidate identity:

- branch `agent/exact-workspace-paths`
- HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`
- exact 11-file manifest: `SOURCE-SHA256.txt`
- implementation/evidence account: `SLICE-04B-IMPLEMENTATION-REPORT.md`

Review emphasis:

1. stable content/metadata revision identity and scoped invalidation;
2. bounded mounted-row derived formatting lifetime, retirement, hydration/edit invalidation;
3. zero completed formatting during 20fps live frontier and preservation of public UI state;
4. exact RCC-0108 stream/snapshot/reveal/finalization and terminal persistence/deduplication;
5. equal accepted snapshot re-projection is limited to the sanctioned open-race rebuild and preserves original `startedAt` without admitting stale revisions;
6. no virtualization, no `LiveSegmentRenderer` split, no production probe, no scope expansion;
7. evidence authenticity, cleanup, skipped focus timing, the one disclosed out-of-scope stale SPEC-05 diagnostic text assertion, and all deviation/downstream accounting.

Return `CLEAN` only if no material 04B finding remains. Otherwise return `NOT CLEAN` with exact file/line, consequence, and required repair.
