`REVIEW_COMPLETE — findings`

Initial candidate: `/private/tmp/chat-ar-integration-r6pe5gmi/candidate`, staged tree `44b2592705cdbc35620207e579113ede27a4a787`, based on target `3356e1b73cc5d44028eac5baa02fd542a8bbc385`. This result applies to that initial tree before repair. It is not a final integration review.

**IR-CHAT-001 — direct screenshot capture rejects the selected view chat**

Severity: **high**. Confidence: **high**, supported by source, diff, and reproducible execution.

All four materiality dimensions are satisfied:

1. **Violated criterion:** Original retirement SPEC R04/A03, S2 and §8.5 require preserving direct in-app capture, correlated saved PNG acknowledgment and pending attachment to the current chat. The startup repair’s preservation matrix retains that requirement.
2. **Affected path:** The changed [thread:created handler](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/ws/thread-handlers.ts:150) selects view-bound New Chat without updating legacy `currentThreadId`. The retained [screenshot ownership guard](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/screenshots/chatScreenshotCapture.ts:35) still compares the requested thread against that global field.
3. **Observable impact:** In a fresh view chat, or when a different legacy thread remains selected, **Add → Take screenshot** returns “Screenshot was not attached because the chat changed.” It rejects the operation before Electron capture, saved PNG acknowledgment or attachment.
4. **Direct evidence:** [ConnectedChatComposer](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/chat/ConnectedChatComposer.tsx:129) passes the visible workspace/thread owner. [thread-history](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/ws/thread-history.ts:57) selects view responses through `setCurrentThreadGroupId`; [chatSurfaceSlice](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/slices/chatSurfaceSlice.ts:516) updates only the per-view group map. The changed ordinary New Chat regression test explicitly preserves a different legacy selection.

Reproduction executed the actual TypeScript helper after an in-memory esbuild transform, with dependency stubs and no filesystem or app effects. For a selected `new-group`/`new-thread`, both global selection values produced:

```json
{"legacyCurrentThreadId":null,"result":null,"captureCalls":0,"toasts":["Screenshot was not attached because the chat changed."]}
{"legacyCurrentThreadId":"prior-thread","result":null,"captureCalls":0,"toasts":["Screenshot was not attached because the chat changed."]}
```

The exact command was delivered to the assigning orchestrator. This diagnostic isolates the ownership rejection; I did not operate a live screenshot UI.

The added `prompt-ownership.slice-c` screenshot test manually sets global `currentThreadId` to its requested thread. It verifies request correlation and saved-path attachment for that state, but does not exercise the newly selected view-chat seam. Server screenshot tests likewise do not cover renderer ownership selection.

The Screenshot Capture Wiki claims that direct capture attaches to the current chat. That claim is affected by this same defect, rather than constituting a separate finding.

Disposition: **open, repair required**. Observable release condition: direct screenshot capture works for the selected first and second view chats, produces the matching request acknowledgment and pending attachment, preserves view/Legacy selection isolation and content-save acknowledgment, and still cancels on an actual ownership change.

**Five-lens coverage**

| Lens | Actual coverage and result |
|---|---|
| Behavior & Verification | Inspected actual startup/listen registration, canonical workspace/root capture, readiness admission, lease lifetime, consumer invocation, negative controls, New Chat create/open selection, screenshot path and durable OpenCode readback. IR-CHAT-001 remains material. |
| Standards Compliance | Read the complete active standards hub and routes 001–008, applicable root/server/Wiki instructions, Chat overview and harness boundaries. Startup uses existing owners and routes. The screenshot guard diverges from the explicit visible-chat owner. No additional material standards issue identified. |
| Integrations & Dependencies | Inspected watcher retirement, retained event/cron/component/action/runner/theme/CLI consumers, Apple callback removal, Google polling, ledger exclusions, client/server identities, harness persistence and runtime proof lifecycle. Bound changed product and immediate unchanged dependencies to the initial candidate. |
| Forward Compatibility | Used only the approved retirement and repair contracts and their recorded deferred work. No requirement was inferred for replacement observation, future plugins or broader harness redesign. No additional material obstruction identified. |
| Wiki Impact | Inspected the affected claims in the original sixteen-article inventory plus repair Testing And Operations article; checked current startup/readiness, retired observation, Apple cache/Google polling, ledger and independent save/tool claims against source. Bound all seventeen articles to candidate/staged bytes. Screenshot support is implicated by IR-CHAT-001. This is not a settled Wiki audit or a review of every administrative document in the broader candidate. |

**Current-byte identity**

I independently verified:

- Source HEAD `d15792920731f85e45b743519d4af2b807d95a9c` and target have identical tree `9ed96e903f550fe4a45c203487296c6d4d500a14`.
- Candidate index equals supplied staged tree `44b2592705cdbc35620207e579113ede27a4a787`; no unresolved index stages.
- Frozen source inventory SHA-256 matches `206117508c5a1c706c987b698753bc138217b27061765d5328bbb403284cd1e2`.
- All 45 assigned product paths and eleven additional immediate dependencies match source, candidate working bytes and staged blobs.
- All seventeen affected Wiki inventory articles match source, candidate and staged blobs.
- All **746** comparisons in the final artifact fingerprint manifest match current source bytes, respecting declared prefix lengths. Historical administrative annotations were not treated as implementation changes.

Finding dependency SHA-256 values, identical in source and initial candidate:

| Artifact | SHA-256 |
|---|---|
| `thread-handlers.ts` | `7b45de46522d0cb67666bf63fe286474eb9c4e3fb6e6ee644ae5cf5e7058d81b` |
| `chatScreenshotCapture.ts` | `bd34c041e9f8fa6cfc7a328633af7c53566045b1e6e6c55ee61617d030a89687` |
| `ConnectedChatComposer.tsx` | `839baa3ace36b3dec18994e8a233157eb79452a13596f37f95908959e48d1d41` |
| `ChatComposerAddMenu.tsx` | `9d61acd10d826a53a2fed5d2c3b4a185721d5ef364632713454b679909a15cd1` |
| `thread-history.ts` | `31607f2180659c581df682c5a59bdffe008218738b3c69de08c30ca5aa9b90df` |
| `chatSurfaceSlice.ts` | `9d531ceded3b03ac602b70ad8b0298765f07ddd594467b0c3d2bba48c2bb67d9` |
| `panelStore.ts` | `a850cdf17368cb0af9c4d24a51ff100216afcc213ac1632e3dd1e604984c92f0` |

Other principal identities:

- Original retirement SPEC: `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`
- Repair SPEC: `0d7a3176cca89b017162970b2fe8f28a5c8b902547fba48f797a2cc68060ac3c`
- Repair SOURCES: `d124abc38a76f7e63011184387c6d2c5b6e5778333c4d29c146a8bb9d07cdaff`
- Completed-work owner acceptance: `b8141671f345a1c1e0bdef5ed37a699b6987cfaa19a00482fae2da393a3cb89a`
- Final artifact fingerprint manifest: `d05eb5ced16f402890a15660df3c58fcd215a46fe4bdbd534ff74d49efa7c40e`

The unchanged screenshot/composer/history/selection dependencies remain relevant because the changed New Chat path now leaves the legacy selection untouched.

**Commands and raw evidence**

I inspected raw command results and dependency/file manifests under R1, R2, R3 and final integration without adopting earlier reviewer verdicts:

- R1 saved startup preimage, focused checks and consumer smoke: inspected raw outcomes and verified recorded log hashes.
- R2 focused Jest command: eight suites, 117 tests passed. Isolated/async checks: twenty tests passed.
- R2 identity-only negative control: expected exit 1, two failures and eleven filtered skips. Actual ready stages had zero leases; actual unavailable startup nevertheless invoked consumers. These failures demonstrate that changing the effect name alone does not satisfy readiness ownership.
- Final cumulative focused Jest command, preserved exactly in `CUMULATIVE-CHECK-RESULT.json`: nineteen suites, 186 tests passed. Raw log SHA-256 `37f0298d4cf58c7f6a6888f1afc8fc990091b5ae19ab64fd4185d4d87ca8e535`. Before/after dependency comparisons showed no drift.
- `npm run build`: exit 0; inspected recorded build warnings.
- `node --test e2e/provenance/guarded-proof-lifecycle.test.mjs`: ten tests passed.
- `node e2e/provenance/run-file-viewer-live.mjs`: inspected both actual guarded server lanes, effect audit, HTTP refusal and protected resource checks. Scenario-specific skips were explicit.
- Recorded Playwright command for `threaded-chat-host.spec.ts` and `chat-send-transport.spec.ts`: 34 tests passed.
- `npm test -- --runInBand`: 221 suites, 3,265 tests passed and one skipped compatibility test; native-observer pretest succeeded.
- Production retirement sweep: no Chokidar import/dependency or retired watcher registration matches. The screenshot source-folder migration remains historical schema material.
- Source `git diff --check`: exit 0. Candidate’s 45-path product staged check: exit 0.
- Full staged check: exit 2 for 423 whitespace diagnostics in evidence/documentation files (`.md`, `.diff`, `.patch`, `.log`, `.py`), with zero assigned product-path diagnostics. These are advisory, not an additional material finding.

Readiness tests use actual startup/listen entry, real readiness/coordinator operations and lease accounting. External effect boundaries are stubbed; controlled-time cron checks are not live provider proof. Recorded normal canary cleanup sometimes needed an explicit deadline fallback, so I do not infer unconditional graceful shutdown from cleanup success.

The saved actual runtime receipts support two newly created usable chats, real OpenCode child/session completion, three durable exchanges across those threads and passive same-thread reopen without later activation. Scratch profile, registered/selected scratch workspace, executable/server identity and cleanup were attributable. User bytes were exact; assistant comparison explicitly normalizes the recorded newline difference. These receipts do not verify screenshots or general harness reliability.

The five restart files are runtime-only, unstaged support. I inspected them as immediate R3 execution dependencies; they are not included in this staged product verdict.

**Limits and lifecycle**

No new build, server suite, provider call, app operation, repair, staging or publication was performed. Existing raw checks remain usable for their unchanged dependency surface; IR-CHAT-001 exposes a renderer seam they did not cover. I did not review any subsequently repaired bytes.

Reviewer identity: `/root/chat_commit_initial_review/chat_raw_code_review_01`; parent: `/root/chat_commit_initial_review`; mode: initial. Fresh read-only assignment, root model/effort inherited without override, no delegated children and no prior reviewer conclusions used as authority. Terminal result: `REVIEW_COMPLETE findings`. `close_agent` is unavailable.

No files were written under the read-only runtime instruction. This response is the raw report for manager preservation at the assigned `initial-review/chat-code-review-01.raw.md` destination.

