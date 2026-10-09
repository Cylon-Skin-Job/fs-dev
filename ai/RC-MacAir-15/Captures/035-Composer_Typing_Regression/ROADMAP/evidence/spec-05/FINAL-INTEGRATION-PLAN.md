# SPEC05 final integration plan (pending slice acceptance)

Run only after all05 slices have current acceptance, one workload at a time in owned isolated fixtures. No owner profile/window, fixed3001, dependency download, commit/push/Alpha or06 gates. Native server pretest remains mandatory.

1. `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite backend --mode enforce` — six active cases including actual six-flow UI, graph sensitivity, exact Side hydration, runtime, mirror recovery and lifecycle.
2. `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite submit --mode enforce` — all seven authenticated receipt/acceptance cases.
3. `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite actions --mode enforce` — all six action cases.
4. `npm --prefix fusion-studio-client run build`.
5. `node fusion-studio-client/e2e/chat-architecture/owned-regression-launcher.mjs server-full` — stages real provider source and runs unfiltered `npm test -- --runInBand` with native pretest under owned temp root.
6. Architecture/runner lifecycle tests if current evidence is invalidated; otherwise independently verify current hashes and existing final raw receipt (no extra test repetition merely for count).

Capture each command, exit, artifact run ID, source dependency comparison and cleanup. Full current integration source manifest is the union of05A–D inventories using current dirty-worktree bytes; retain per-slice baseline/current manifests separately. Inspect required cross-slice contracts and every deviation before dispatching a fresh final clean-room reviewer with raw evidence and current source, without prior reviewer conclusions. No supervisor/owner acceptance is inferred.
