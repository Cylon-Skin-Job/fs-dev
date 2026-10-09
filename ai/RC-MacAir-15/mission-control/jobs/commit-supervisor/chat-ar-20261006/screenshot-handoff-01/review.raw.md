REVIEW_COMPLETE — **FINDINGS**. The screenshot repair is not CLEAN.

Fresh independent worker-handoff reviewer: `/root/screenshot_handoff_review_01`, manager `/root`. Actual CWD/controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Candidate: `/private/tmp/chat-ar-integration-r6pe5gmi/candidate`, branch `codex/chat-retirement-and-startup-repair`, HEAD/target `3356e1b73cc5d44028eac5baa02fd542a8bbc385`.

**Material finding: retained component chats attach screenshots after their owning view becomes inactive.**

Severity: **high**. Confidence: **high**.

All four materiality dimensions are established:

1. **Violated criterion:** the assigned repair requires capture for the active visible chat and cancellation on actual owner/activity changes during capture or save. Original CHAT-AR-SPEC-01 A-03, R-04, §6.S2 and §8.5 preserve direct capture, the correlated saved PNG and the pending attachment. The repair SPEC preserves explicit view/group/session/surface ownership and existing selection isolation.
2. **Affected path:** component-backed Main and Side Chat → `ChatSurfaceComponentMount` → `useChatSessionHost` → `ConnectedChatComposer` → `captureAndAttachScreenshot`.
3. **Observable impact:** switching to another view during either await still saves/attaches to the now-hidden component session and displays “Screenshot attached to chat.” The required cancellation does not occur.
4. **Direct evidence and reproduction:** current source establishes the retained mount and incorrectly active token; read-only execution of the current controller reproduces attachment during both phases for both hosts.

Exact source chain:

- `App.tsx:308–313` renders every configured `WorkspacePanel` and changes its `isActive` prop on view selection.
- `App.css:219–236` hides inactive panels with `visibility: hidden`; this does not unmount them.
- `WorkspacePanel.tsx:79–87` passes activity to `ViewChatShell`, but retains `ContentArea` without passing activity.
- `ContentArea.tsx:60–64` retains the component-tab presentation.
- `ChatSurfaceComponentMount.tsx:122–135` calls `useChatSessionHost` without `isActive` and supplies `screenshotSelection="session"`.
- `useChatSessionHost.ts:64` defaults activity to true; its resulting component chat remains active.
- `ConnectedChatComposer.tsx:61–72` consequently keeps the screenshot mount token current.
- `chatScreenshotCapture.ts:63–69` validates Side placement existence but not active owning view. Lines 71–76 skip `currentPanel` validation for mounted Main components, and session scope skips rail selection.

Reproduction path:

1. Open a component-backed Main or Side chat in view A.
2. Start Take screenshot and defer Electron capture completion, or complete capture and defer the correlated save acknowledgment.
3. Switch the product to view B while leaving A’s component placement open.
4. Resolve capture and acknowledge its matching request, or acknowledge the already pending save.
5. The attachment is added to A’s hidden session instead of cancelling.

The read-only Node reproduction transformed the current TypeScript in memory, used the actual relocated placement parser and valid open placement data, and controlled only state/store sinks, capture and acknowledgment delivery. Its four results were:

```text
capture / primary: attachmentAdded=true, returnedAttachment=true
capture / side-tab: attachmentAdded=true, returnedAttachment=true
save / primary: attachmentAdded=true, returnedAttachment=true
save / side-tab: attachmentAdded=true, returnedAttachment=true
```

Each result had `currentPanel="view-b"`, owning view A, and the success toast. This was a controller reproduction plus production lifecycle inspection, not a native-app smoke.

The new tests cover activity/unmount cancellation through `ViewChatHost`, and placement-close/unmount cancellation through component mounts. They omit the production case where an inactive view retains its component mount. The correction must bind component capture lifetime to owning-view activity while retaining independence from unrelated Main rail selection.

**Coverage and evidence**

I inspected the unstaged production/test delta, the new placement reader, all screenshot callers, the actual accepted New Chat handler, population selectors, worksurface lookup, descriptor validation, component/tab lifetime and server save acknowledgment routing. No additional material issue was established in that bounded surface.

The relocated parser’s interface/functions were compared with the candidate’s staged `sideChatBridge.ts` preimage: `relocatedParserBytesEqual=true`. Request-ID matching, acknowledged saved-path attachment, workspace targeting, Legacy fallback and unrelated-view selection isolation remain represented in the current controller/tests. The added component-registration fixture capability preserves its prompt/thread-ID and no persisted/outbound surface-ID assertions.

Current reviewed SHA-256 values; paths below are relative to `fusion-studio-client/`:

| Assigned path | SHA-256 |
|---|---|
| `src/screenshots/chatScreenshotCapture.ts` | `90c7517d8edfb393914592f20015931ba556c83dc8e314ac9412ae3da139f902` |
| `src/components/chat/ConnectedChatComposer.tsx` | `f182a4dc6b2a6b4c35507fa84347ab875cd4b5c162ae94388c2850d9422fd6df` |
| `src/components/chat/ChatSurface.tsx` | `eddbcc616a6b4ccfbf211db031901dcb9fc22ec32d6bbbe0ccd50b8c1ff807f8` |
| `src/components/chat/ChatSurfaceComponentMount.tsx` | `b9202119baf0caa6ea08022ba2e6a322ec8c15e874d7d82d68ad8a4b20b12127` |
| `src/components/chat/sideChatBridge.ts` | `dba500d3f7e28e3b845bc7b2c05478edd361325fb6c9b86cb7366a0f9834a8af` |
| `src/components/chat/useSideChatRailAdapter.ts` | `2a1205bd426604f805eb7fe2b93ce8f3be65f1a18207bba7653d6534c01d317a` |
| `src/lib/chat/side-chat-placements.ts` | `93878e20774164e6c0e5840caba3ffcb0c135829e08d945500bf8ad72ddad7b9` |
| `e2e/prompt-ownership.slice-c.spec.ts` | `733f5a7cdc902a68c75c906338a042340209abf34205ab385f89b691e47ad699` |
| `e2e/threaded-chat-host.spec.ts` | `0e2cfbb9ffa5813404c6b7fd74ae9e10fbe17318d73de8941839d2b26f015965` |
| `e2e/chat-composer-screenshot-menu.spec.ts` | `93db83a1f751645778b55f4c54b50d5372fbfd4a9acc8e363b8b71bb23a1f03a` |
| `e2e/chat-component-registration.spec.ts` | `6f944b2dc873e518c8cd10cf8503e0527677f0f119fa0927006cdf63aca5ceb1` |

Finding dependency hashes:

```text
App.tsx                    ae70d077983470b3030d56162c35aa196dd184518e1cbe18bfb92e6f41c21745
App.css                    c0fd68b9abec905158b49c623fc07ae7fa52e5d4424cbed447786771adce582e
WorkspacePanel.tsx         4a70a0ee092c2250bb3dae8188b856f1b2d895658d768d35084fdbf30628961a
ContentArea.tsx            f3b02f929a2baf1ba18025b41883bf351759815c2204537ccf61454e66ef1327
useChatSessionHost.ts      611e9bc29e766ec3baa030c0d74e554757b3b48bd0bb627947f66d5a54751e68
chatSurfaceSlice.ts        9d531ceded3b03ac602b70ad8b0298765f07ddd594467b0c3d2bba48c2bb67d9
worksurfaceSlice.ts        e569ffc1fd037bd382ea3f233d586077b7664ef4e4f71f1435ec5cb5ea348b46
```

Authority consulted: session contract, Commit Supervisor skill/full workflow and Wiki handoff boundaries, SPEC Review Gate, applicable AGENTS, original and repair SPECs and approval receipts, completed-work owner acceptance, current Chat overview, full standards hub/all eight routed pages, User Preferences, Screenshot Capture article and linked Wiki procedures. Original SPEC hash: `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`; repair SPEC hash: `0d7a3176cca89b017162970b2fe8f28a5c8b902547fba48f797a2cc68060ac3c`.

Checks actually performed: read-only Git identity/diff inspection, bounded `git diff --check` (passed), source reads/searches, SHA-256 capture, in-memory parser-preimage comparison and the four controller reproductions. I did not rerun build or Playwright, operate the app/provider/database, edit/stage files, dispatch agents or read a writer handoff report.

Raw evidence inspected under `jobs/commit-supervisor/chat-ar-20261006/screenshot-repair/`:

- `client-build.log`: completed Vite build; chunk-size warning. SHA-256 `b91c88666b5cc0b00f9c4742533a7925d005b0f9c856c90f5838e786825e8a1c`.
- `screenshot-focused-rerun.log`: 26 passed. SHA-256 `945939e21f3e56edac80c924770898de51e4101d6ed3940b84a2cade31dd9f6d`.
- `chat-cumulative.log`: 97 passed, 1 failed because the component-registration fixture emitted no prompt. SHA-256 `63eb307e9c383e517abfb272e602568ae09a52db260d9c90f6def7cd4a2b1786`. The current fixture admission correction was inspected, but its fresh cumulative outcome was not established before this terminal finding report. Exact invocation/port receipts were not present in the inspected log excerpts.

The placement-reader relocation and fixture admission setup are bounded mechanical deviations; their final classification remains with the manager. Whole-candidate review, settled Wiki acceptance, native runtime handoff and publication readiness are outside this gate.

Lifecycle: fresh independent read-only session, inherited root model/effort without override, no author conversation or prior reviewer history used, no descendants, no writes. Material evidence was promptly reported to `/root`; this response is terminal.
