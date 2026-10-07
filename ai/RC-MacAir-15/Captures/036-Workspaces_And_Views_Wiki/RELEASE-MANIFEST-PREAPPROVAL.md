# WV-01 release manifest

Candidate: **WV01-5108f8838c18f10b**

Status: **PREPARATION_CLEAN — AWAITING_OWNER_APPROVAL**. Owner has requested SPEC creation only. No wiki execution or orchestrator dispatch has occurred. Preparation review is complete despite the frozen normative documents' preparation-stage status labels. Approval must name this candidate before execution handoff; do not infer it from requesting the SPEC.

Created: 2026-09-21T11:43:13Z

## Identity

The ordered normative set below is hashed as UTF-8 lines of `relative-file-name`, two ASCII spaces, lowercase SHA-256, newline, in the exact listed order. SHA-256 of that byte sequence is `5108f8838c18f10b0313e1644feee121125c804b8b5b3a0f16e34a18858a8f8a`. The candidate prefix is its first 16 hex characters. All paths are relative to this capture. Manifest, PLAN, preparation checks and review records are excluded to avoid a recursive digest; they do not silently redefine the normative contracts.

```
INDEX.md  0babc1b888fa8275d0f04c084f62d7de15f9ea00c232d2dbe80854f10d09b646
SPEC.md  ebdc616b6d40bda3a079113e48a589d1014a6562c36926d3a13965c4be66bdcf
DECISIONS.md  4ed90cd3db56b49d6b4383908c845288bed96ea063019c5a0f8cb040dffe1f47
SLICES.md  f076dec10f44406c28e12948559f79bac6869df8efdef6b95f43c3b248091aa7
VALIDATION.md  fe018226809efc351c396b4547cce6df504b8d7854be44b283925dbbe76e6fa3
PAGE-MAP.json  62ff339a40af6c8d3100f01ae483262f81052198728795d31ae355ae55269bd6
SOURCES.json  c189baabf62bc21e3d668c48888c386ad9b63dffae2e4cac0553badeb8b6df38
```

## Review and decisions

Latest independent review: [REVIEW-01.md](REVIEW-01.md), **CLEAN**, no material findings, exact normative identities above. Parent verified every reported hash against current bytes. WV-D01–D09 and WV-I01–I02 are validated as propagated by this completed review; their frozen pending-review table labels are historical preparation state. This validation is not product implementation acceptance.

Preparation feasibility: [PREPARATION-CHECKS.json](PREPARATION-CHECKS.json). Complete page census and source checks; existing audit command ran twice in disposable staging with stable generated marker bodies and no live wiki byte changes. No product runtime tests.

## Order, authority and deferrals

One SPEC: [WV-01](SPEC.md). Order: S00 → S01 → S02 → S03 → S04 → S05. Prerequisite: explicit owner approval plus execution-time source/baseline refresh. No subsequent SPEC is authorized.

Non-blocking deferrals: WV-O01 exact location/machine content policy; WV-O02 update/customization lifecycle; WV-O03 dependency failure/version policy; WV-O04 schemas and editing/validation mechanisms; WV-O05 ordinary-folder initialization proposal; WV-O06 context assembly. Owners and future gates are in DECISIONS.md. Retained specialist references and their legacy internal TOC structure stay outside recertification; this limitation must remain visible. No product implementation is required to close the documentation SPEC.

## Required execution evidence

Exact execution baseline, per-edit predecessor snapshots, source/claim hash inventory, slice check reports, deviations and downstream effects, fresh builder-owned and independent orchestrator-owned reviews, scoped generated-navigation evidence, actual changed-page list, final timestamp receipt, final post-stamp hashes, integrated CLEAN review and owner-facing HANDOFF.md. Full criteria: SPEC AC01–AC10 and VALIDATION V1–V8. Preparation evidence is not a substitute.

## Handoff routes after approval

- `$orchestrator` with this folder's SPEC.md.
- `$roadmap-implementation-supervisor` with INDEX.md and the approved WV-01 one-SPEC roadmap.

Both use the same slice/review contract. Any normative amendment changes the candidate and requires affected review and owner approval of the revised candidate; preserve this release record when superseding it.
