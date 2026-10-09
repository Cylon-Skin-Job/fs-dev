# B18 — full-soak native Delete closure synchronization

Status: bounded B18 implementation/checks and fresh builder review CLEAN; root fresh review also reported CLEAN. Full-soak native closure remains unexecuted. No full06B acceptance.

## Authority and evidence

SPEC06/06B requires the real public lifecycle workload, at least20 equivalent settled cycles, genuine45minutes, strict input/focus/resource oracles, and explicit owner acceptance. Root/supervisor authorized this bounded fixture correction after SOAK03's native CUA observation of a residual `Delete this conversation?` sheet despite durable Delete. Supervisor Cancel removed that sheet and exact native app/window focus subsequently acquired. This is direct evidence of a fixture closure-observation gap, not proof that the sheet caused the separate50.9ms rAF breach or historical freezes.

Installed Playwright1.58.2 `lib/server/dialog.js` marks a dialog handled and removes it from DialogManager before awaiting `_onHandle`; Chromium uses `Page.handleJavaScriptDialog`. Its resolved accept promise alone does not observe macOS native AX sheet disappearance. No dependency bytes are modified. ChoiceA preserves this existing public/CDP acceptance and adds explicit native closure confirmation afterward; it does not replace presentation or persistence routes.

## Exact interface

Full-soak opt-in: `FUSION_CHAT_ARCH_DELETE_NATIVE_MS=120000`;0/default preserves prior cases. Lifecycle-only rejects this opt-in. All warmup, streaming cleanup and repeated-cycle Deletes receive the same checkpoint. There is no20-checkpoint ceiling: the existing loop continues throughout the fixed45minute workload. Each boundary is outside measured typing; the overall55minute deadline is unchanged.

After exact expected confirm acceptance resolves, SQL group absence and detached row are established. The helper binds the current page's exact owned BrowserWindow and PID. It writes `delete-native-NNNN-ready.json` under the raw run evidence directory before emitting `DELETE_NATIVE_READY` with status waiting, operator agent, ownerAcceptance false, runId,pid,windowId,title,profile,workspace,groupId,sequence,nonce,startedAt,deadlineAt,ackPath. It performs no native UI actions.

Supervisor reads the fresh request, matches the owned PID/window, uses CUA to freshly inspect native UI, and either verifies no sheet or Cancels only the exact residual Delete confirmation followed by a fresh no-sheet observation. Unknown UI produces a failed ACK; no arbitrary dismissal/activation is authorized by this mechanism.

Write a complete JSON file at the exact `ackPath` (prefer atomic creation). Success ACK:

```json
{
  "runId": "COPY_FROM_READY",
  "pid": 123,
  "windowId": 1,
  "groupId": "COPY_FROM_READY",
  "sequence": 1,
  "nonce": "COPY_FROM_READY",
  "deadlineAt": 1234567890123,
  "operator": "agent",
  "ownerAcceptance": false,
  "status": "closed",
  "action": "none",
  "nativeSheetAbsent": true,
  "unknownDialog": false,
  "observedAt": 1234567890000
}
```

`action` is only `none` or `cancel-matching-residual`. `observedAt` is the actual fresh native absence observation's epoch milliseconds, at/after READY and at/before receipt consumption. For unknown UI use matching identity with `status:failed`, `unknownDialog:true`; this immediately fails closed. ACKs are unique per sequence and nonce; wrong/stale/future/malformed/missing receipts fail. The120s deadline includes the ACK wait and subsequent2s stable actual native appActive/windowfocused/visible/unminimized/notapphidden observation. It is not a pointer gate or an owner symptom receipt. `DELETE_NATIVE_ACQUIRED` or `DELETE_NATIVE_FAILED` ends the boundary and updates its durable receipt. A native observation failure preserves the last completed observation through the reviewed B17 observer. Observer buffers do not accumulate in the renderer; one Node dialog listener is removed on teardown, per-sequence evidence stays on disk.

## Changed paths / deviation proposal

Exact predecessors are in B18-BEFORE plus B18-BEFORE-MANIFEST.json. Planned delta: new soak-delete-native.mjs and its Node tests; soak-actions.mjs threads the optional checkpoint through public Delete/lifecycle; soak-electron.mjs enables only opted-in full soak, handles expected dialogs through the controller and disposes it; run.mjs adds helper provenance. No product, shared measurement/bootstrap, build, fixtures, numeric thresholds, duration or lifecycle count is changed.

Proposed classification B18: accepted bounded fixture integration. Original criterion requires repeated public Delete with equivalent settled resources and strict focus. Actual change adds explicit agent-native closure evidence where CDP/durable data alone proved insufficient. Risk: CUA coordination may consume deadline or be unavailable; this is explicit failure, not an injected pass. Downstream: full45minute evidence must run on frozen B18;06C remains barred until all06B criteria and timestamped owner receipt. Temporary adapter retirement: remove native closure coordination only when the public fixture's native sheet retirement has a reliable equivalent proven observation; never substitute a product confirmation stub.

VRENDER03 remains selectively valid because its actual runtime dependency path does not execute the new soak helper, modified Delete/lifecycle functions or soak program. Historical broad run-manifest entries differ; do not claim every old provenance hash equals B18. SOAK03 red metrics remain retained and unwaived.

## Checks and review

Completed after NATIVE05's exclusive runtime: focused Node tests, self-review, complete source/build freeze and fresh builder-owned clean-room review (receipts below). No Electron B18 launch before root independent fresh gate/preflight/GO. No unchanged production rebuild planned.

NATIVE05 is a separately authorized existing10minute native capability session. Its1950 existing-source plus200 build dependency bytes are frozen for that entire session under NATIVE-05-FROZEN manifests; only the new unexecuted B18 helper/tests and evidence can change concurrently. It is explicitly not a globally frozen B18 candidate. Existing native checks are unchanged, and supervisor alone owns CUA during its READY window.

Exact original authority carried: SPEC06 §06B states “Every observed lost input/stuck state/resource-growth breach blocks completion.” VALIDATION's45minute paragraph requires “remaining time repeats lifecycle interactions” and “No hung attempt state, uncaught error, leaked owned process, or monotonic listener/cache/session-count growth across 20 repeated open/close cycles.” B18 changes only the fixture observation/synchronization needed to establish those equivalent settled boundaries; it neither caps the continuing loop at20 nor treats a native acknowledgement as a numeric or owner acceptance waiver.

Implementation frozen for inspection at2026-09-27T02:48:28.409UTC:1952source entries manifestSHA2565408a67e8409d896ea3a5ded6336917ca5aab88d802a0cedcdf4b0131b575143;200build entriesSHA2566c06602b58f8dc0e4a9b1ed6588c5670b8e628b21044040a581e9e9d55f05234. Five paths exactly match B18-CHANGED-PATHS.json. At initial freeze checks/review were pending; subsequent completed gate receipts follow.

Focused verification completed after Native05cleanup: `node --test fusion-studio-client/e2e/chat-architecture/soak-delete-native.test.mjs fusion-studio-client/e2e/chat-architecture/soak-foreground-handoff.test.mjs fusion-studio-client/e2e/chat-architecture/soak-preparation.test.mjs fusion-studio-client/e2e/chat-architecture/observation-contract.test.mjs` → exit0,29passed/0failed/0skipped,2137.87225ms. Raw b18-unit-01.log. Coverage includes exact ACK identity/freshness/failure/missing/malformed receipt, acceptedPromise→durable→READY ordering, nativefocus stability and failure, unexpected dialog/noaccept, original CDP failure, listener disposal, full-soak opt-in and every lifecycle branch, preserved preparation/bootstrap/measurement contracts. No product rebuild or Electron B18 launch performed; neither is claimed.

Self-review checked all three predecessor diffs and both new modules, current installed Playwright dialog ownership and exactcaller inventory. No numerical/sample/oracle weakening or new UIaction exists. All native operations remain supervisor CUA outside typing. Sourcefreeze remains unchanged. Fresh builder reviewer /root/builder06b/review06b_delete1 dispatched with no inherited conversation, read-only and no descendants; focused test receipt supplied after runtimecleanup. Prior reviewers terminal; close_agent tool unavailable. Reviewer terminal CLEAN; no material findings.

Fresh builder reviewer /root/builder06b/review06b_delete1 terminal CLEAN, all1952source/200build/exact5delta/3predecessors verified. No materialfindings; advisory stale pendingwording corrected here. Readonly/noexecution/noedits/nodescendants. Root independently reported32Nodepasses2150.548125ms (ORCHESTRATOR-06B-delete-unit.log) and its fresh /root/review06b_delete1 terminalCLEAN; authoritative classification remainsroot-owned. close_agent unavailable; terminal lifecycle recorded. Overall06B stays incomplete: actual45minute workload and composition correctness causaldisposition/ownerreceipt pending. B19 causaldiagnostic authorized separately; no product fix inferred from NATIVE05.

Bounded implementation handoff: READY_FOR_ORCHESTRATOR_REVIEW for B18 mechanics only, with all applicable prelaunch checks and fresh builder gate complete. The owning root has separately reported its CLEAN review; actual45minute runtime and nativecomposition disposition remain required before overall06B completion. Runtime lane released idle after NATIVE05, supervisor caffeinate untouched.
