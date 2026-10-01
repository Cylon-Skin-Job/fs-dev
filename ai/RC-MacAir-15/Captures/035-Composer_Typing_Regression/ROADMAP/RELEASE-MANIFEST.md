# Release manifest

Candidate: **CHAT-AR-4641ca5897f0**

Current status: **owner-closed with explicit residuals**, per [SPEC-06 closure addendum](SPEC-06-OWNER-CLOSURE-ADDENDUM.md). No further implementation handoff is authorized by this historical manifest.

Original approval: **OWNER APPROVED — released for implementation handoff.** Clean planning review complete; exact normative hashes verified at approval recording. The hashes below identify that original planning candidate, not current post-implementation documents. Closure notices in ROADMAP.md and SPEC-06.md intentionally change their bytes; no new passing candidate is implied.

## Exact artifact identity

The normative set is the 13 files below. Sort relative paths lexicographically; concatenate each path, a tab, its SHA-256 and a newline (UTF-8); hash the concatenation. Candidate ID is CHAT-AR plus the first 12 hex characters. Full aggregate SHA-256: `4641ca5897f094a0c9b6d9d341cd48b29cc886dc1c6afdb30e052341ef800d0e`. CANDIDATE-HASHES.json is the machine-readable equivalent. This manifest, hashes file, source provenance and review reports are metadata/evidence, excluded to avoid recursive hashing.

| Artifact | SHA-256 |
| --- | --- |
| ARCHITECTURE.md | `e05ea606bb6285fe6d1cd7b9e26186e5f4b8531a451dbff5d0efe37673556abe` |
| AUTHORITY-AND-DECISIONS.md | `8be31dd38c9da7316d8c2c1a124c742b99656901e05a6f3a35196cae55625362` |
| BUNDLE-INDEX.md | `9870db94fca4ee1933fe6ae8175f4f4fbbce82acbaaf643db63c5d19718207c2` |
| GUIDANCE.md | `648790eb974cffc64f1df4658187ff3ebf504024fadf6ff410b37145cb42269e` |
| ISSUES.md | `d0e0d781730d91643461042cfb5417951a69d73c123ba01ed7e1c315273acbe9` |
| ROADMAP.md | `15b177d94e13fccb2a23de74701b9f9217773eaa49e46310b91e8328ce4fbe27` |
| SPEC-01.md | `80359e87794a4e51fad4b483bbc366e45f13534de7cd1bb2b8e6ae40eb16c9ed` |
| SPEC-02.md | `aa88f904558616a8e9973c6400e4b9b794e5568c840e2695bc0dd3ec28a235e7` |
| SPEC-03.md | `3bc841255f0fbc40a2333973d3f2d5a08e4770c2a2090d89bd11f7262993312d` |
| SPEC-04.md | `61dc5ab171ffc0f4f19ad8a65bb2c7403ffb817f5793adb34e8d57bec3928c21` |
| SPEC-05.md | `b04dc041755c579b41e7260035c86bfb8574013cb9eb962733ab74528a9b89e8` |
| SPEC-06.md | `6a47f0a43d11b6bfbb5fdf12a41a33233808b70a73f836483bd3ee97fa419554` |
| VALIDATION.md | `0eaeaeb39bf4e252acae5fb73e296ce84f313ca4964ba8d69f8d1d5976a44abb` |

## Order and authority

Roadmap: ROADMAP.md. Execute SPEC-01 → SPEC-02 → SPEC-03 → SPEC-04 → SPEC-05 → SPEC-06, with explicit owner acceptance before every following SPEC. Each packet includes GUIDANCE, ARCHITECTURE, VALIDATION, AUTHORITY-AND-DECISIONS, ISSUES and BUNDLE-INDEX. Direct `$orchestrator` and `$roadmap-implementation-supervisor` routes preserve exactly those contracts.

Resolved existing direction/contracts: AR-D01–06. On 2026-09-20 the owner approved this exact candidate in direct response to the approval request explicitly naming CHAT-AR-4641ca5897f0 and AR-P01–03. Therefore AR-P01 (authoritative recovery before resend), AR-P02 (15-second transition from pending to editable recovery), and AR-P03 (specified realistic workloads, numeric performance gates and 45-minute soak) are now approved owner decisions with their already-reviewed contracts unchanged.

Approval resolves the candidate's awaiting-owner statuses, including AR-010. Draft/proposal/awaiting-approval labels inside the hashed planning snapshot describe its pre-approval state; this dated approval receipt records their resolution without altering reviewed bytes. All implementation defects and per-SPEC acceptance gates remain open.

## Deferrals and future gates

AR-F01 Alpha/distribution/Git publishing: product owner may request separately after acceptance. AR-F02 general provenance/event-bus redesign: separate provenance program. AR-F03 pending New Chat redesign: separate owner scope. AR-F04 unrelated Office/non-chat God files: their owning programs. AR-F05 mandatory virtualization: trigger only if measured gates require it while preserving current interactions. ISSUES explains why these are nonblocking; none waives chat regression or final symptom acceptance.

## Required completion evidence

Per slice: implemented paths, exact tests/results, fixture/source identity, criterion mapping, full deviations and downstream effects, builder-owned clean review and independent orchestrator clean review. Per SPEC: integrated public-route/readback proof, current artifact review and explicit owner acceptance. Program: all six acceptances; enforced R1–R8 and structural contracts; R9 native input/original-symptom acceptance; 45-minute workload metrics; preserved upgrade/recovery data; current wiki reconciliation; no unresolved material blocker. No product tests or benchmarks are claimed run during this planning-only turn.

## Review and approval record

Planning review: CLEAN by fresh read-only `/root/roadmap_review` on all 13 matching normative hashes. See CLEAN-ROOM-REVIEW.md. No material findings; one nonblocking preservation-boundary advisory recorded. Any normative change updates the living candidate and requires only affected review again. Hash change is provenance, not an impediment to needed repairs.

Owner approval: **recorded 2026-09-20**, America/Los_Angeles. The owner replied “Approved.” and reiterated “Approved” to the immediately preceding request naming this candidate and its three proposals. This is approval of the exact presented candidate, not an inferred decision from silence. All 13 normative hashes match the clean reviewed candidate.

Implementation dispatch: not started. Next handoff is SPEC-01 through `$orchestrator`, or the approved roadmap through `$roadmap-implementation-supervisor`. Owner acceptance is still required before each following SPEC. Commit/push/Alpha authority: not included.
