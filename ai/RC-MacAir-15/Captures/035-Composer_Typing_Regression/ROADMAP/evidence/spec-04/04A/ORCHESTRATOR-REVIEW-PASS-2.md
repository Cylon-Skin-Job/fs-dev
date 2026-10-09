# SPEC-04 04A Orchestrator Review — Pass 2

Disposition: **FINDINGS**

The repaired 21-file manifest and all three prior repair findings were verified.
Independent build, coverage-authenticity, and V-ISOLATION reruns passed.

## Material finding

**R1 wall-time enforcement depends on unverified OS focus.**

Two independent full R1 attempts over the final manifest failed all ten windows
only on the wall budget. Both receipts recorded `runtime.focused=false`; input
p95, rAF latency, exact retention, decoded outbound frames, coverage discovery,
formatter/render counts, and long tasks were otherwise clean. Wall durations
were approximately 4.2–4.5 seconds versus approximately 1.9 seconds in the
builder's focused run.

- Failed run `chat-arch-1790134943915-593b3bc5bd`.
- Focus-attempt retry `chat-arch-1790135231454-f851d1f150`.
- Builder clean focused run `chat-arch-1790133916558-82b5890715`.

The runner records focus only after all measurements and does not establish or
assert it before applying the wall-clock threshold. An external activation loop
did not make the staged Electron window report focused. The timing gate is
therefore nondeterministic across otherwise equivalent current-byte runs.

Required repair: make the isolated R1 harness establish and verify the staged
Electron window's focus immediately before timing each window, or fail early
with a precise focus-unavailable result. Retain the existing wall threshold;
do not waive or inflate it. Record per-window focus evidence, rerun full R1,
reseal the manifest/evidence, and obtain a fresh builder-owned clean-room review.
No product behavior change is requested.
