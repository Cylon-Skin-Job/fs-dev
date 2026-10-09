# SPEC-04 Slice 04A — Orchestrator Review Pass 3

Reviewer: `/root/spec04_04a_acceptance_final`, fresh orchestrator-owned read-only `clean-room-reviewer`.

Candidate identity: 23/23 hashes verified from `SOURCE-SHA256.txt`; manifest digest `2b6208a648ee63c0e876512182b87b61437bc8b3d9fd25fc5630f85db43f6594`.

Disposition: **FINDINGS**.

## Material finding

The CDP coverage calibration still failed open when every required function name was present but its calibration invocation count was zero. `summarizePreciseCoverage()` recorded discovery independently from invocation, `assertCoverageTargetsDiscovered()` checked names only, and `calibrateCoverageTargets()` did not require each of the seven `R1_COVERAGE_TARGETS` to execute during calibration.

Current retained production evidence showed nonzero calibration counts for all seven targets, but the shared oracle itself could falsely accept a dead same-named bundled function while the active implementation was renamed or no longer exercised. That violates the required authentic, fail-closed R1 zero-work observation boundary.

Required bounded repair:

- Require every `R1_COVERAGE_TARGETS` calibration invocation count to be greater than zero.
- Add a deterministic regression in which all names are present with zero coverage counts and calibration must fail.
- On the locked host, rerun the full 04A command and prove calibration succeeds before a structured pre-timing `R1_FOCUS_UNAVAILABLE` result.
- Rerun helper/authenticity and composer input/locality checks.
- Reseal the affected source manifest and repeat fresh builder-owned and orchestrator-owned review.

## Verified closed areas

The reviewer found the 04A production split, exact primitive selectors, decoded typing-interval outbound-frame oracle, deterministic staged-window focus prerequisite, unchanged wall threshold, structured locked-host refusal, and prior repair accounting substantively correct. No material product defect was reported. Later 04B/04C gates remain out of scope.
