# Release manifest — PP-WIKI-01

Candidate: **PPW01-0159a35a4ecb7fd3**

Status: preparation CLEAN; owner approved candidate PPW01-0159a35a4ecb7fd3. See APPROVAL.md. Separate orchestrator dispatch is recorded in ORCHESTRATOR-SESSION.md.

Latest independent review: REVIEW-01.md, `/root/platform_wiki_spec_review_1`, CLEAN on the exact seven normative hashes below. Parent verified the returned hashes against current bytes. There were no material findings or normative repairs. This is preparation readiness, not execution completion.

Normative digest: `0159a35a4ecb7fd305eb719075fb9c30cea7527442fa820dd326f89b3f84b757`

Algorithm: SHA-256 of UTF-8 concatenation in the order below, each row `relative_path + NUL + lowercase_sha256 + LF`. Review/evidence/release status files are excluded.

| Artifact | SHA-256 |
|---|---|
| INDEX.md | `14edb6a33ab9c65d78692f3d98b363dd653058b207222784e0f7a8e273bf996f` |
| SPEC.md | `b1d56c64fbfa212af88f2bdf07dd7b8fac981351fe55424336374a52ab31e494` |
| DECISIONS.md | `75ead675332502323d6c26a6ad5c60d0cf05958964bcb28b0e13138e25503bc8` |
| PAGE-MAP.json | `7c464c197df867b01a6c956dec0a035b85801dce48aa348c63235f30357b05bd` |
| SLICES.md | `3a3b64e092dc9c355fde7db836db3007e0747d56704484c1947f206afb34cfff` |
| VALIDATION.md | `cb378938592dc583ca71492417db60339ae7e5e2df3f98695ab2ebf197ef0215` |
| SOURCES.json | `4179eca60351dcf3ceb5f1bc3406917542c06261673a262dc77076f3f39ac29b` |

Roadmap order: PP-WIKI-01 only. Slice order S00 → S01 → S02 → S03 → S04 → S05. Resolved owner intent D01-D12; nonblocking deferrals O01-O07 with subsystem/owner and future gates in DECISIONS. Acceptance requires AC01-AC08 and VALIDATION V1-V7, six separate builder/orchestrator review chains, final independent integration review, actual changed-page hashes and timestamp receipt. Preparation review does not satisfy execution gates.

Downstream: invoke `$orchestrator` with SPEC.md and this owner-approved candidate, or `$roadmap-implementation-supervisor` with INDEX.md and the same approved one-SPEC roadmap. A separate session is suitable after approval. No product implementation, commit/push, deployment, or subsequent SPEC authorized.
