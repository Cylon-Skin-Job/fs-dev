# Release manifest — HL-01-6e4c29f469a4

Status: **historically reviewed CLEAN predecessor; HELD for architecture rebase**. The owner-directed governed UEB/subscriber and shared-measurement integration changes the planning basis; read [ARCHITECTURE-HOLD.md](ARCHITECTURE-HOLD.md) before any approval or dispatch. Historical hashes/reviews below remain valid only for the old candidate, not the revised direction. No implementation dispatch, product change or runtime operation is authorized.

## Identity

Candidate ID: `HL-01-6e4c29f469a4`

Full candidate digest: `6e4c29f469a47960d8a9c103c98620b678012b7112934d38b7d7c9fdf0bae35c`

Algorithm: in the order listed below, concatenate each repository-relative artifact path, NUL, its lowercase SHA-256, and newline; SHA-256 that UTF-8 sequence. The ID uses its first 12 hex characters. This derived manifest and review evidence are excluded to avoid self-reference.

| Normative artifact (relative to this bundle) | SHA-256 |
| --- | --- |
| INDEX.md | ed701fd34ce9c66a0d1f5b1217b7fbd3351be4f1b67df3536697e45a8034534a |
| DECISIONS.md | cf0dd8a975821f4b68401a7445226274797b07346a452edb753d1cf10b1f1af3 |
| SPEC-HL-01.md | b9690e35ff17b425684a79923774681e1d02b7b47af7d6a02175997eaa92ba4a |
| SLICES.md | d159eae46abb926fd3a96caf6115a11eefdf56b3ddd85a56d345291f53c4a35b |
| VALIDATION.md | 9abfdef661fc96aee47367ae1e89f24968a8690355d692cb4833592f0a771350 |

## Execution order and authority

One SPEC: `SPEC-HL-01.md`, slices HL-01A → HL-01B → HL-01C. Exact role/review/repair duties are in `SLICES.md`; standards and upstream/current-code dependencies are in `INDEX.md`.

Owner decisions HL-D01–HL-D08 are propagated. Engineering defaults HL-C01–HL-C07 are identified separately; this candidate includes initial N=1,000,000, decimal 2 GB physical budget, 30-day retention, 250 ms active renderer sampling and 5-second process sampling. All content-free and primary-store isolation invariants remain mandatory.

Implementation starts only after explicit owner approval of this candidate and shared source/runtime ownership handoff. Existing CHAT-AR SPEC-06 acceptance/06C, publishing and Alpha are not granted.

## Review provenance

- Review 01: fresh read-only reviewer `/root/review_health_spec_01`; one material offline-status contradiction, repaired. See `reviews/REVIEW-01.md`.
- Final current-candidate review: `/root/review_health_spec_02`, CLEAN, no material findings or required advisories. See `reviews/REVIEW-02-CLEAN.md`.
- The reviewer returned all five exact hashes above; root matched them at that review. The later architecture-hold notice changes INDEX.md; do not compare current bytes as if this were a newly reviewed candidate. The remaining predecessor scope is preserved for rebase. This is historical planning review, not product test evidence or implementation approval.

## Completion evidence required

All V1–V11 in `VALIDATION.md`: closed-schema/canary privacy; separate store/migrations/profile lifecycle; bounded queues/fault isolation; real age/count/physical-cap checks; authenticated producer routes; correct sampled units/clocks; deterministic read-only queries; regression/build/packaging; paired overhead evidence and isolated Electron smoke. Each slice requires fresh builder-owned and orchestrator-owned CLEAN gates. Final report lists all deviations, measurements, unsupported observations and residuals before owner acceptance.

## Non-blocking deferrals

Export/snapshots/upload/schedules/go-skip/server folder policy and remote APIs are deferred to owner-approved Server/plugin work. Plugin enforcement and distribution consent are deferred until that infrastructure exists. No bookmark migration, dashboard, raw-content archive or historical log import. The owner may later manage uploaded-folder retention server-side; there is no client archive policy in this candidate.

## Approval receipt

Not granted. Do not request implementation approval of this predecessor as the current plan. Rebase under ARCHITECTURE-HOLD.md, review the new candidate, then obtain explicit approval of that candidate. CHAT-AR SPEC-06 closure does not approve logger implementation.

## Handoff options after approval

1. `$orchestrator` with the absolute path to `SPEC-HL-01.md`.
2. `$roadmap-implementation-supervisor` with this approved bundle's `INDEX.md`.

Either route uses the same contract. Do not dispatch both or create concurrent owners of the same implementation.
