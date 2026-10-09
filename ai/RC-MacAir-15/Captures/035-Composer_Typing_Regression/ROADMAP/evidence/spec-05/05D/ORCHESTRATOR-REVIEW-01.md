# Root05D acceptance review01 — NOT CLEAN

Reviewer /root/review05d_acceptance terminal, read-only, no descendants; close_agent unavailable. Candidate76-file f079fcdabb0aed5ba157064c3444dd25788f80337193044b67b4908b7a0aba5b;103-path union1f665f229d24da605618cf5a8410c13fa20fc4ed59e87670dd0474cc696b0f64. All hashes and1605 full-server/root-runtime dependencies independently match.

F1 high: accepted pre-turn_begin drain retirement, bounded provider stop fails, iterator later settles and exact provider emits exit. SessionLifecycle.closeSession calls retireActiveDrain before provider/session release; canonical manager caches rejected retirementPromise, and Stop rejects subsequent STOPPING. Exit reconciliation and explicit retry cannot suspend/release the exact session. No idle timer remains; runtime/drain/session remain STOPPING, blocking admission/Move/Delete despite proven exit. Normal terminal-cleared drains are not implicated. Existing late-exit tests omitted activeDrain.

Coordinated in-memory Node reproduction uses actual SessionManager/SessionLifecycle/Runtime/Stop/canonical controls with metadata and provider boundary stubs; no files/DB/provider/window. Exit0, output:

```json
{"firstError":"Canonical drain retirement failed","lateError":"Canonical drain retirement failed","retryError":"Canonical drain retirement failed","providerExitObserved":true,"sessionRetained":true,"sessionState":"stopping","runtimeState":"stopping","activeDrainRetained":true,"suspends":0,"stopCalls":1,"idleTimers":0}
```

Exact reproduction command is in the reviewer's terminal task response; mechanically equivalent preserved source is ORCHESTRATOR-REVIEW-01-REPRO.cjs (run from repository root). Root independently traced the same three source owners and validates builder_repair. Required: observed-exit recovery of exact retained drain without weakening active Stop or replacement isolation; real sequence regression plus delayed completion/metadata failure/replacement bounds. ReopenD09 and affected05A/C/D gates; classify new accounting explicitly. Passing other gates remain raw evidence, not a waiver. No additional material finding/advisory.

Raw inspected gates: full nativepretest212/3162 +existingKimi skip, backend, submit, actions, architecture17 and clientbuild. RetainD07/D12/D16 unknown limits and30s delivery deadline. No owner acceptance or06 authorization.
