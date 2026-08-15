# Assistant Reply Chrome Reorganization And Fork Integration Spec

**Archived:** This is a historical implementation plan. Do not use it as the
active source of truth for New Chat, Fork, or pending-chat persistence. Current
behavior is defined in `../PENDING_CHAT_INTENT_SPEC.md`.

This spec defines a delta against the existing assistant reply chrome build. It
does not re-specify reply chrome, saved exchange ids, copy, bookmark metadata,
or note metadata as new features. Those paths already exist.

The scope is:

1. Reorganize the assistant reply action icons.
2. Remove redundant reply-menu entries and the overflow menu.
3. Move Fork out of assistant reply chrome and into composer chrome.
4. Implement the real OpenCode current-head fork lifecycle.

The OpenCode fork lifecycle is the only substantial new product behavior in
this scope. The reply chrome work is mostly UI pruning plus deleting now-unused
note-only entry points.

## Current Build Baseline

The current build already has:

- Completed assistant reply chrome mounted from
  `fusion-studio-client/src/components/MessageList.tsx`.
- Reply text extraction in `fusion-studio-client/src/lib/chat/reply-text.ts`.
- Copy reply and Chat ID clipboard actions in
  `fusion-studio-client/src/lib/chat/reply-chrome-actions.ts`.
- Bookmark modal, note editor UI, and metadata persistence.
- Saved exchange ids from `chat-turn:saved`.
- Client metadata hydration from `chat-turn:metadata:updated`.
- Server metadata update handling in
  `fusion-studio-server/lib/chat-metadata/exchange-metadata-update-service.js`.
- Server redaction for note metadata messages.

The current reply chrome still renders an overflow menu:

```text
content_copy   text_to_speech   bookmark   more_horiz
```

Current overflow menu contents:

```text
compress       Compress      disabled stub
fork_right     Fork          disabled stub
link_2         Chat ID       active
add_notes /
sticky_note_2  Add/View Note active note-only editor
local_activity Create Ticket disabled stub
```

The current OpenCode harness does not implement pending forks. It only resumes
with a stored OpenCode session id:

```text
opencode run --format json --dir <projectRoot> --session <opencodeSessionId> "<prompt>"
```

## Desired End State

Assistant reply chrome should be a flat inline row:

```text
content_copy   text_to_speech   bookmark   link_2   compress
```

Actions:

| Icon | Action | End state |
|---|---|---|
| `content_copy` | Copy reply text | Active |
| `text_to_speech` | Text to speech | Visible disabled stub |
| `bookmark` / saved bookmark icon | Bookmark reply | Active bookmark modal with note field |
| `link_2` | Chat ID | Active; copies SQLite `exchanges.id` |
| `compress` | Compress | Visible disabled stub |

There is no assistant-reply overflow menu.

Remove from assistant reply chrome:

- `more_horiz`
- Overflow menu state and menu markup.
- `fork_right` Fork stub.
- `add_notes` / `sticky_note_2` separate Notes action.
- `local_activity` Create Ticket stub.

Notes remain supported as bookmark metadata. The note field continues to live
inside the bookmark modal. The separate notes-only modal/action is removed
because it is redundant.

Fork becomes a composer-level thread action. See:

```text
OPENCODE_THREAD_FORK_SPEC.md
```

## Reply Chrome Implementation Delta

Code standards source:

```text
ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/PAGE.md
ai/<machine>/Wiki/005-Enforcement/003-Chat_Styling_And_Workspace_CSS/PAGE.md
```

Apply these constraints while editing reply chrome:

- Keep `AssistantReplyChrome.tsx` presentational: it renders props and emits
  callbacks only. It must not import stores, WebSocket helpers, clipboard APIs,
  or metadata services.
- Keep metadata save/copy orchestration in
  `useAssistantReplyChromeController.ts` and the existing
  `fusion-studio-client/src/lib/chat/*` helpers.
- Delete removed menu/note-only code. Do not leave deprecated props,
  `_unused` helpers, inert wrappers, or comments that preserve removed behavior.
- If `AssistantReplyNoteEditor` remains shared by the bookmark modal, move that
  editor to a small shared file before deleting the note-only modal wrapper.
- Do not introduce a generic popover/menu abstraction for this one cleanup; only
  extract if a second current consumer exists.
- Keep all authored reply-chrome CSS in component-scoped `.rv-` classes, using
  CSS variables with fallbacks for colors, spacing, radius, shadow, z-index,
  and transitions.

Client files to change:

```text
fusion-studio-client/src/components/chat/AssistantReplyChrome.tsx
fusion-studio-client/src/components/chat/AssistantReplyChrome.css
fusion-studio-client/src/components/chat/AssistantReplyBookmarkModal.tsx
fusion-studio-client/src/components/chat/useAssistantReplyChromeController.ts
fusion-studio-client/src/components/chat/AssistantReplyNoteModal.tsx
fusion-studio-client/src/components/MessageList.tsx
```

Expected UI changes:

- Remove `menuOpen`, `rootRef`, outside-click handling, `MENU_ITEMS`, and
  `.rv-assistant-reply-more` menu rendering from `AssistantReplyChrome.tsx`.
- Render `link_2` as a normal inline icon button wired to `onCopyChatId`.
- Render `compress` as a disabled inline icon button with no click handler,
  no toast, and no backend message.
- Remove `onOpenNotes` from `AssistantReplyChromeProps`.
- Stop mounting `AssistantReplyNoteModal` from `MessageList.tsx`.
- Remove `openNoteEditor`, note-only modal props, and `activeEditor === "note"`
  state from `useAssistantReplyChromeController.ts`.
- Keep bookmark modal note editing intact.
- `AssistantReplyBookmarkModal.tsx` currently reuses `AssistantReplyNoteEditor`
  from `AssistantReplyNoteModal.tsx`; keep that shared note editor available or
  move it to a clearer shared file before deleting the note-only modal wrapper.
- Remove reply-menu CSS selectors once no component uses them.

Keep existing behavior:

- Copy reply still uses extracted text segments only.
- Chat ID still copies SQLite `exchanges.id`, never `threadId`.
- Bookmark icon still reflects saved bookmark metadata:
  - empty `bookmark` when missing/null
  - filled `bookmark_flag`
  - filled `bookmark_star`
  - filled `bookmark_heart`
- Active actions remain disabled until `exchangeId` exists.
- Active actions that unexpectedly lack required data still show:

  ```text
  Error: Data Unavailable
  ```

Delete only genuinely unused note-only code. Do not remove backend note
metadata support, because bookmark still owns note editing.

## Composer Fork Placement

Fork belongs in the composer icon row immediately left of the microphone
button:

```text
clipboard   screenshots   recent files   emoji   fork_right   mic
```

Composer Fork control:

- Icon: `fork_right`
- Tooltip/title: `Fork thread`
- Uses the same visual treatment as the other composer icon buttons.
- Disabled while the current thread is accepting a prompt, streaming, stopping,
  or finalizing.
- Disabled when the current thread is not OpenCode-backed.
- Disabled when the current thread lacks a saved
  `harness_config.opencodeSessionId`.

Clicking Fork is a server-owned thread action, not a reply action.

## OpenCode Fork Work

OpenCode exposes current-head session fork through:

```bash
opencode run --session <sessionID> --fork "prompt"
opencode run --continue --fork "prompt"
```

The installed CLI help describes `--fork` as requiring `--continue` or
`--session`. No confirmed OpenCode CLI option exists for forking from an
earlier individual message. This scope is current-head fork only.

Implementation source of truth:

```text
OPENCODE_THREAD_FORK_SPEC.md
```

Required backend behavior:

- Add `thread:fork` handling.
- Validate the source Fusion thread is OpenCode-backed and has
  `harness_config.opencodeSessionId`.
- Create a new Fusion thread named:

  ```text
  Fork: {{Original name}}
  ```

- Store pending fork metadata on the new thread's `harness_config`.
- Resolve the latest saved source exchange for provenance. This is not a
  per-reply fork; `sourceExchangeId` is metadata about the current head, not an
  OpenCode message-level branch point.
- Duplicate the source thread's Fusion exchange history into the new fork
  thread before or during navigation so the forked thread visually opens with
  the same prior conversation history.
- Switch the UI to the new fork thread after the fork thread is created. A
  brief empty/loading state while the database write and hydration complete is
  acceptable and can help signal that a new forked chat is opening.
- Do not run OpenCode when the fork button is clicked.
- On the first prompt in the pending fork thread, run OpenCode with:

  ```text
  --session <sourceOpenCodeSessionId> --fork
  ```

- Capture the returned OpenCode `sessionID` as the fork thread's active
  `opencodeSessionId`.
- Clear `pendingFork` and preserve durable `forkProvenance`.
- Follow-up prompts continue the new forked OpenCode session.
- Do not write directly to OpenCode's SQLite database.

## Verification

Implementation should proceed in vertical slices with a smoke check between
each:

1. Reply chrome cleanup: remove the overflow menu, inline Chat ID and Compress,
   remove reply-level Fork, Notes, and Create Ticket.
2. Composer Fork shell: render `fork_right` left of Mic with correct disabled
   states.
3. Server fork endpoint and history clone: create `Fork: {{Original name}}`,
   store `pendingFork`, and copy source exchanges into the fork thread.
4. Client fork click integration: send `thread:fork`, switch to the fork
   thread, and render duplicated history using a distinct `thread:forked` path
   or an explicit open-after-copy flow, not the empty `thread:created` clear
   path.
5. OpenCode pending fork harness path: first prompt emits
   `--session <sourceOpenCodeSessionId> --fork`, captures the new session id,
   clears `pendingFork`, and preserves `forkProvenance`.
6. Restart and first-send integration: pending fork metadata and copied history
   survive restart before first send.
7. Full regression smoke: reply chrome cleanup plus complete fork lifecycle.

Detailed slice requirements live in:

```text
OPENCODE_THREAD_FORK_SPEC.md
```

Focused checks for reply chrome:

1. Completed assistant replies show:

   ```text
   content_copy   text_to_speech   bookmark   link_2   compress
   ```

2. No `more_horiz` reply button renders.
3. No reply overflow menu renders.
4. Copy reply still excludes tool output.
5. Chat ID copies `exchangeId`.
6. Bookmark modal still saves bookmark and note metadata.
7. There is no separate Add/View Note action.
8. There is no Create Ticket action.
9. There is no Fork action under assistant replies.

Focused checks for fork:

1. Composer renders `fork_right` immediately left of Mic.
2. Fork is disabled for non-OpenCode, unsaved, prompt-acceptance, streaming,
   stopping, or finalizing threads.
3. Clicking Fork creates a new `Fork: {{Original name}}` thread with
   `pendingFork` metadata and no active fork thread `opencodeSessionId`.
4. The new fork thread opens and shows the duplicated source conversation
   history from Fusion's database.
5. Sending the first prompt in that thread invokes OpenCode with
   `--session <sourceOpenCodeSessionId> --fork`.
6. The returned OpenCode `sessionID` is saved as the fork thread's active
   `opencodeSessionId`.
7. `pendingFork` survives thread switches and app restart before first send.

Run the narrowest relevant checks after implementation:

```bash
cd fusion-studio-client
npm run build
```

```bash
cd fusion-studio-server
npm test
```
