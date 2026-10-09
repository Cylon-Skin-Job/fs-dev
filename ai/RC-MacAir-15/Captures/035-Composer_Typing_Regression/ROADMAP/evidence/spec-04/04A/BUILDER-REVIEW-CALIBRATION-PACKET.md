# SPEC-04 Slice 04A Positive-Calibration Builder Review Packet

## Candidate

- Repository: `/Users/rccurtrightjr./projects/fs-dev`
- Branch/HEAD: `agent/exact-workspace-paths` / `88637d11c65be53d4f2ad0f049f64a07fa3db1de`
- Shared dirty checkout: review only the 23 paths sealed by `SOURCE-SHA256.txt`; do not edit or disturb unrelated/current bytes.
- Manifest digest: `d7b6fce3625a9869597ba5c1e2a27d5d13bd2fff872aada8b1f9090fa8bd8837`.

## Required fresh review

Read `/Users/rccurtrightjr./.codex/skills/spec-review-gate/SKILL.md` completely and apply its four-part materiality rule. Review against `AGENTS.md`, release candidate `CHAT-AR-4641ca5897f0`, SPEC-04 slice 04A, the approved roadmap bundle, accepted SPEC-01/02/03 reports/manifests, Chat Wiki overview, routed standards, and `SLICE-04A-IMPLEMENTATION-REPORT.md`.

The latest acceptance finding was narrowly test-oracle related: CDP calibration required all target names to be discovered but did not require their calibration invocation counts to be positive. A dead same-named function could authenticate a later zero.

Independently verify the repair:

- `assertCoverageTargetsCalibrated` requires every one of the seven `R1_COVERAGE_TARGETS` both to be discovered and to have a finite invocation count strictly greater than zero.
- `calibrateCoverageTargets` uses this stronger assertion before returning calibration evidence.
- The deterministic regression provides all exact names with zero-count ranges and must fail; missing-name and positive-count cases must continue to behave correctly.
- Locked-host run `chat-arch-1790137441145-e6c35ab531` must show every target positively invoked before structured `R1_FOCUS_UNAVAILABLE`, with no measurement window and clean cleanup.
- Correctness run `chat-arch-1790137472384-9ca7bcfa8d` must pass helper/authenticity 6/6 and input/locality 2/2.

Also confirm every earlier repair remains sound: exact staged focus prerequisite and unchanged wall threshold; typing-interval outbound-frame rejection; no whole-`threads` parent subscription; unrelated-row locality; composer-local observation and duplicate-mount/input semantics; no production observer or product behavior; and preserved SPEC-02/03 contracts. Do not require 04B/04C.

Return material findings with authority/current-byte evidence/consequence/bounded correction, separate advisories and deviation dispositions, reviewer identity, and exactly one final disposition: `CLEAN`, `NOT CLEAN`, `BLOCKED`, or `AUTHORITY_BLOCKED`. No edits.
