# Chat transport simplification — ready package held for owner

## Current status

**CANDIDATE_READY_FOR_OWNER_APPROVAL.** Roadmap Creation and independent candidate-stage/release validation are complete. Owner instruction: “Hold the SPECs until ready. We will start the Implementation in another task.” The completed package remains here. No implementation task was created and no product implementation was started.

Candidate ID: `sha256:cf93d5d2b63073ccc16ca432bf8fab9fe8f4284fb3c1320b457d2ed8b7a34a54`.

Planning authorization D-007 is not approval of these resulting executable bytes. **Exact-candidate approval is pending.** No approval receipt exists. Record explicit owner approval against this ID before implementation; preserve explicit owner acceptance between each implemented SPEC. This mutable handoff is outside the normative manifest and does not alter the reviewed requirements.

## Package and order

Start with [ROADMAP](ROADMAP.md) and [CANDIDATE.json](CANDIDATE.json). The seven-file normative set also includes [shared contracts](CONTRACTS.md), [ownership and verification](OWNERSHIP-AND-VERIFICATION.md), [source identities](SOURCES.json), and:

1. [SPEC-01 — Focused transport owners](SPEC-01.md): two slices separate cohesive server ingress and client connection/response responsibilities.
2. [SPEC-02 — Unified chat send boundary](SPEC-02.md): one transport owner for the 13 identified caller groups, preserving each admission policy and delivery uncertainty.
3. [SPEC-03 — Receipt inquiry send outcomes](SPEC-03.md): consume definite/uncertain inquiry outcomes, manage the existing wait and late-response eligibility, never replay the original prompt.

No new product decision remains unresolved in the plan. R1–R4 are resolved at planning threshold. Actual implementation, source/build capture and required checks remain future work. Preserve the two-second hourglass, provider retry ownership and server-owned acceptance/Stop.

## Independent evidence

- [Candidate stage report](reports/CANDIDATE-STAGE-REPORT.md): STAGE_VALIDATED; SHA-256 `9eb8451372eeedc7d7edfcad00e7a9ad8178a14fa0387e0fc69cc00bf4d1a65e`.
- [Fresh candidate-stage review](reports/CANDIDATE-VALIDATION-01.md): CANDIDATE_STAGE_VALIDATED; SHA-256 `c47ff242bc6ee4dcb3f9a638669800427a96dd3e9c2f52ea99a4b54221cec35f`.
- [Separate fresh release review](reports/RELEASE-VALIDATION-01.md): RELEASE_READY; SHA-256 `1443b9be5225a621fbd2e9c987c5c0d43005fd1128731f14b76e45e232625091`.

Both independent gates cover all four perspectives and found no material issue. Seven normative files and all 112 bound external source identities match. Advisory CSV01-A1 is already covered: implementation checks must demonstrate eventual qualified thread-list/restored-history loading after a stale-binding refusal, not only absence of stale writes. It adds no transport replay policy.

## Separate implementation task intake

When the owner starts that task, supply this handoff and the approved candidate/receipt. Use `$mc-roadmap-implementation-supervisor` with ROADMAP for the sequence, or `$mc-orchestrator` with one approved SPEC and its complete accompanying packet. Neither is invoked here.

Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Memory/output home is this folder's Chat Integration ancestor. Product checkout: `/Users/rccurtrightjr./projects/fs-dev`, dirty `agent/exact-workspace-paths` at planning HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Recheck actual checkout, source drift and concurrent writers before edits; HEAD alone is not the baseline. Capture approved current source and fresh build/evidence hashes. Changed normative bytes require affected review and renewed exact-candidate approval.

V1–V9 are required future checks, not planning passes. The native smoke fixture must first be isolated from live workspace cleanup as assigned in C1-B. Preserve the owner's running app and database. No Git/Alpha operation is granted by this handoff.

D-005's broader Fusion/OpenCode failure map remains with the owner-resumed later task after this sequence is built and accepted. Temporary diagnostic logging retains its governed-subscriber delete/migrate obligation. This sequence does not release unresolved recovery contracts to plugin consumers or declare the earlier incidents solved.

Recorded 2026-09-28T23:46:15.455967+00:00 by the owner-facing Creation Supervisor. Next safe action: hold this exact package until owner approval and separate-task implementation intake.

## Successor supervisor task

Owner explicitly requested a new task in this same folder and a roadmap supervisor. Created local task `01a0eaa0-a843-7680-a962-f5ab2c971cce`, titled “Supervise chat transport implementation,” in project `06d43426-d4f7-4667-9199-2ca9a73879bf` using the saved local folder directly. Recorded 2026-09-29T00:46:50.976322+00:00. It is assigned the Roadmap Implementation Supervisor role inline and receives this exact candidate, complete handoff, deferrals and review evidence. Initial work is supervisor intake/source checks and the pending exact-candidate approval checkpoint. Task creation does not record implementation approval. This planning task retains no active product writer; the successor owns its implementation coordination after intake.
