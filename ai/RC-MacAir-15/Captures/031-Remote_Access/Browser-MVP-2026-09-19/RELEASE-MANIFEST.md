# Browser MVP release manifest

**Candidate:** `FUSION-BROWSER-MVP-1cb620be9a9c6a79`  
**Aggregate SHA-256:** `1cb620be9a9c6a798c0cff5f7525bf6a063c8ef7c0c8162528a1b74ded7b26b3`  
**Independent review:** CLEAN — see CLEAN-ROOM-REVIEW.md.  
**Owner approval:** APPROVED — the owner replied “I approve.” to the explicit approval request for this exact candidate and its three proposed boundaries.
**Bundle status:** RELEASED FOR IMPLEMENTATION HANDOFF; implementation has not started.

## Identity

Normative order is exactly the table below. Aggregate input is UTF-8 concatenation of each relative artifact path, NUL, lowercase SHA-256, LF. `artifact-hashes.json` contains the machine-readable equivalent. Evidence, manifest and hash-list files are excluded from the normative aggregate to avoid recursion. Source fingerprints in SOURCE-SNAPSHOT.json record inspected dirty-tree facts and are not frozen implementation baselines.

| Order | Artifact | SHA-256 |
|---:|---|---|
| 1 | BUNDLE-INDEX.md | `7e79dd92e2f6e86208bac8798097449d57e76222f348ff506fe8d9b73413e72a` |
| 2 | DECISIONS.md | `6ef1b97988c1a3c37b791f28afc3ea82791a80d1b380765251e0bbee5d95f573` |
| 3 | GUIDANCE.md | `575add9578336896a11620be83534552e2edd8ffc2204b1e07f6deee9d3d665e` |
| 4 | ISSUES.md | `5f350db84f4e73313694be4bd78c4b38a5a380f7be95796ccf7398f1d088d493` |
| 5 | ROADMAP.md | `202f190c07941460d86ac878d110aec31ea2c91ba4c9d0d996a7fff921e0b9c0` |
| 6 | SPEC-01-AUTHORIZATION-POLICY.md | `de8f8c72b9e4cd7c6edd1a46d875de7ab9810fd4dcca2a0e62f259cd7d636954` |
| 7 | SPEC-02-BROWSER-PAIRING.md | `610c55adfb679d570939b45bccdcd1515b738035d286a98c2fb311a6f7596246` |
| 8 | SPEC-03-REMOTE-INGRESS.md | `4a31cbec8ad72bdf512a33bbf58dfb7841a7db62ad6a9d59f5a09822c2df1a1d` |
| 9 | SPEC-04-REMOTE-TURN-CONTINUITY.md | `875ad7476761e03d28943d9c2e7766bdd1409422e7a894a390410354a53b0fe2` |
| 10 | SPEC-05-BROWSER-WORKSPACE-CLIENT.md | `ab91f11091a6e9112d502f28db57ec24e40c75e01fcca2f147feb0734c54d4b5` |
| 11 | SPEC-06-HOST-LIFECYCLE.md | `0cd24ba16ec016f2803f7051fb2dc8db9a72c0454968ae757b1ef3c3d37303fc` |
| 12 | SPEC-07-TAILSCALE-SETUP.md | `123431d748047268dff1e04c0f20e3521ab2ab83e5023097b9544d8886d2975b` |

## Execution order and gates

SPEC-01 → SPEC-02 → SPEC-03 → SPEC-04 → SPEC-05 → SPEC-06 → SPEC-07. Each SPEC requires owner acceptance of preceding implementation; candidate approval is not acceptance of future implementation results. GUIDANCE.md defines fresh builder and independent reviewer lifecycles and evidence requirements.

Owner decisions already resolved in conversation: BR-D01–BR-D07. Existing contract retained: BR-D09. Technical decisions ratified by candidate approval: BR-D08, BR-D10–BR-D12, BR-D15–BR-D16. Explicit product assumptions accepted by candidate approval: BR-D13 (Mac logged-in windowless host, explicit Quit stops service), BR-D14 (shared workspace selection for MVP), BR-D17 (server-owned accepted remote turn survives browser loss). BR-D13, BR-D14 and BR-D17 are now settled by the owner’s explicit approval. Independent workspace selection would be a subsequent scope change requiring affected review.

Non-blocking deferrals: BR-F01–BR-F10 in ISSUES.md, with owners and future triggers. No mobile/PWA, Fusion-to-Fusion iframe, collaborator scopes, hook/regex enforcement, unattended jobs, native phone collection, public ingress or boot-before-login daemon in this release.

## Required completion evidence

Each slice: changed paths, exact commands/results, warnings/residual risks, every deviation, clean builder review and clean independent orchestrator review. Each SPEC: integrated acceptance against its observable contracts and explicit owner acceptance. Roadmap: all eight ROADMAP final acceptance outcomes, actual two-machine/different-network Tailscale HTTPS proof, denied unauthenticated and revoked HTTP/WS access, file save/readback, chat continuity/Stop, host-window close versus Quit behavior, unchanged profile/machine/DB and local Electron regression checks. Fixture-only evidence cannot substitute for the physical-network gate.

No product tests/builds were run during planning. Document/reference/hash verification and independent planning review are the only current evidence. No real Tailscale enrollment, login-item change, Alpha operation, push or application deployment occurred.

## Approval and handoff

Approval recorded at `2026-09-19T12:36:11.035854+00:00` from the owner’s explicit reply in this conversation. Approval covers the exact candidate above, including BR-D13, BR-D14 and BR-D17. This manifest is the authoritative approval record; DRAFT/proposal/awaiting-approval wording in the hashed planning artifacts describes their pre-approval state and is resolved by this record without changing their reviewed bytes. A changed normative artifact produces a new identity and affected review; hashes track provenance, not a demand to discard sound work.

Approved handoff routes:

- Direct: `$orchestrator` with SPEC-01-AUTHORIZATION-POLICY.md, then later accepted-prerequisite SPECs.
- Supervised: `$roadmap-implementation-supervisor` with ROADMAP.md.

Do not invoke the parent September 12 roadmap as this candidate's implementation instruction.
