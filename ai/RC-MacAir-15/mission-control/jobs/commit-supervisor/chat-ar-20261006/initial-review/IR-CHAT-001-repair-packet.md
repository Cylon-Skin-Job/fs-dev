# Initial review finding IR-CHAT-001

- Mode: initial; reviewer/orchestrator `/root/chat_commit_initial_review`.
- Origin: fresh read-only child `/root/chat_commit_initial_review/chat_raw_code_review_01`; full raw terminal report pending.
- Candidate: `/private/tmp/chat-ar-integration-r6pe5gmi/candidate`, target `3356e1b73cc5d44028eac5baa02fd542a8bbc385`, initial staged tree `44b2592705cdbc35620207e579113ede27a4a787`.
- Disposition proposed to manager: `open`, independently validated. Severity `high`; confidence `high`. No necessary owner choice identified.

## Finding and materiality

Ordinary view-bound New Chat selects the new group/session through its qualified view state, leaving legacy `currentThreadId` null or on an older chat. The composer supplies its actual visible thread to `captureAndAttachScreenshot`, but that unchanged controller rejects it against the legacy global selection before calling Electron capture.

All four materiality dimensions are satisfied:

1. Original CHAT-AR-SPEC-01 A-03, R-04, S2 and §8.5 explicitly preserve direct in-app screenshot capture, exact saved PNG correlation and pending chat attachment. CHAT-AR-REPAIR-01 §4 preserves the same screenshot/attachment contract.
2. Affected execution: `src/lib/ws/thread-handlers.ts:150` → qualified create/open selection; `src/lib/ws/thread-history.ts:57` → qualified group selection; `src/state/slices/chatSurfaceSlice.ts:516` → per-view state; `src/components/chat/ConnectedChatComposer.tsx:129` and `ChatComposerAddMenu.tsx:45` → explicit current composer owner; `src/screenshots/chatScreenshotCapture.ts:35` and `:115` → global-only owner rejection.
3. Realistic impact: after ordinary New Chat in a view-bound host, the composer screenshot action returns “Screenshot was not attached because the chat changed.” without capturing, saving or adding an attachment. The visible chat did not change.
4. Direct evidence: current source trace, the existing ordinary create/open test which retains `currentThreadId='legacy-selected'`, and independent execution of the actual esbuild-transpiled screenshot helper. All eight immediate source/test dependencies match source and frozen candidate exactly.

## Independent reproduction and limits

From the source product CWD, Node evaluated the actual screenshot helper in memory with only external store/socket/Electron/attachment/toast dependencies supplied. The view state selected `new-group`; the composer requested `new-thread`.

| Legacy global selection | Result | Capture / save requests / attachments |
|---|---|---|
| null | null; chat-changed toast | 0 / 0 / 0 |
| prior-thread | null; chat-changed toast | 0 / 0 / 0 |
| new-thread (positive control) | returned saved attachment; attached toast | 1 / 1 / 1 |

The current added `prompt-ownership.slice-c.spec.ts` screenshot test sets `currentThreadId=THREAD_A` manually. It establishes request-ID/path correlation in that state and does not exercise the preserved qualified New Chat/composer seam.

Raw independent execution: [screenshot-owner-validation.json](screenshot-owner-validation.json), SHA-256 `1eb1ff4be39920ffa390e3b73b1fdd29a4e9d14d34741e08e3e9fb60b4c3c465`; Node stdin exit 0, tool chunk `a654e6`. Exact source/candidate dependencies: [screenshot-owner-candidate-dependencies.json](screenshot-owner-candidate-dependencies.json), SHA-256 `a1631b900ac58ebfa5a6e87741c27a9ae8cf9f4ba61b9129fbe845afaf8cb4a6`.

No live app, provider, screenshot or user-data operation was performed. The diagnostic supplies direct controller effect proof and a traced product caller, not a live UI replay.

## Bounded repair packet

Resolver: assigning Commit Supervisor `/root`, through its leaf repair worker and a separate fresh handoff reviewer. The review orchestrator owns no repairs.

Required behavior: a screenshot from the visible view-bound composer after ordinary accepted New Chat must capture and add only its correlated saved path to that exact workspace/thread. Preserve rejection when its actual workspace/view/thread owner changes during capture or save, maintain independent view isolation, and preserve any intentional legacy/global header behavior. Use established current selection/controller owners; no new provider, protocol or persistence capability is required.

Required evidence: a meaningful existing-harness regression through the ordinary qualified create/open/composer path, including null/older legacy selection, correct pending attachment ownership and owner change/other-view isolation. Rerun invalidated screenshot/composer/selection checks and cumulative candidate checks appropriate to the mechanically necessary change. Preserve unaffected raw server/retirement/guarded/real-provider evidence with documented dependency scope.

Release condition: bounded repair reported with current bytes/raw checks, clean fresh manager-assigned worker-handoff review against this original finding and actual seam, then fresh whole-candidate final review. Deferred material findings cannot pass the candidate.

Source and evidence remain unchanged. One staged-tree identity read used `git write-tree` once and matched the already supplied prepared tree; no commit, staging, ref, source or worktree mutation was performed. Subsequent identity reads use the manager's frozen record.

