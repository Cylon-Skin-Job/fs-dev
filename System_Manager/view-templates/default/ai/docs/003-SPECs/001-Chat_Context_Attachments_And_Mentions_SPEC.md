---
title: Chat Link Attachments And Filename Autocomplete Spec
status: draft
created-from: conversation
related-files:
  - fusion-studio-client/src/components/SendToChatButton.tsx
  - fusion-studio-client/src/lib/chat-action.ts
  - fusion-studio-client/src/components/chat/useChatArea.ts
  - fusion-studio-client/src/components/ChatInput.tsx
  - fusion-studio-client/src/state/fileStore.ts
  - fusion-studio-client/src/state/slices/chatSlice.ts
related-wiki: []
---

# Chat Link Attachments And Filename Autocomplete Spec

## Purpose

Replace noisy path insertion from `Send to chat` with a small link attachment pill above the chat input, and add narrow filename autocomplete while typing in chat.

This is intentionally not a broad context attachment system.

Autocomplete is limited to non-markdown code/files:

- Include files with extensions.
- Exclude files ending in `.md`.
- Exclude wiki pages, tickets, docs, recent docs, screenshots, URLs, folders, agents, threads, and database records from autocomplete.

`Send to chat` is broader because buttons exist across many system surfaces. It should create a pill for the clicked resource using a simple typed reference syntax.

## Product Model

There are two user-visible behaviors.

1. `Send to chat` creates a removable link attachment pill above the input.
2. Typing a filename prefix in chat can autocomplete to a known non-`.md` file from a small RAM candidate set.

No inline `@` mention behavior is part of this spec.

## Current Behavior

`SendToChatButton` resolves a panel-relative path to an absolute path and inserts the raw path into the current chat composer.

This is useful but messy. It produces path text the user has to visually parse and manually delete.

## Desired Send-To-Chat Behavior

Clicking `Send to chat` creates a pill-shaped link attachment above the user input area.

Visual shape:

```text
[ link_2 wiki:chat:architecture ]
```

The pill should:

- Sit above the chat input area.
- Use the `link_2` icon immediately before the reference label.
- Carry the same design language as copy-link controls elsewhere.
- Show a compact typed reference as the primary label.
- Be underlined or otherwise read visually as a link/reference.
- Be removable.

Hover remove behavior:

- When the user hovers the pill, show a small circular `X` button over the top-right edge.
- Use the same general removal paradigm as removing workspaces from the ribbon.
- Clicking `X` removes that attachment from the pending chat message.

Send behavior:

- Sending the chat includes normal user text plus structured metadata for remaining attachment pills.
- Removing a pill before send removes its metadata.
- The visible pill is not inserted into the textarea as raw path text.

## Composer Top Row Layout

Place a compact top row directly above the user input area.

Layout:

```text
[ context usage block, 120px wide ] [ right-justified attachment strip ]
[                         textarea / user input                          ]
```

Context usage block:

- Sits above the input on the left.
- Has a fixed width and max width of `120px`.
- Contains the context percentage bar on top.
- Shows token/percent text beneath the bar.
- Bar thickness should be doubled from the old footer bar.
- This is cosmetic only; fixing provider-specific token/context accuracy is out of scope.

Attachment strip:

- Sits in the same top row, to the right of the context usage block.
- Takes the remaining row width.
- Right-justifies attachment pills.
- Leaves the left `120px` context block untouched.
- If pills consume the whole remaining width, overflow should happen inside each pill rather than forcing layout expansion.

Pill overflow behavior:

- Pill text has `10px` left and right padding.
- Text is single-line and clipped inside the pill.
- Add a `10px` overlay on the right side of the pill.
- The overlay uses a gradient from transparent to an opaque color matching the pill background.
- The fade sits above the disappearing end of the text, creating a left-to-right fade at the clipped edge.
- The hover remove `X` remains positioned over the top-right edge of the pill.

## Send-To-Chat Reference Syntax

Use compact, token-like reference labels with no spaces around separators.

Recommended form:

```text
kind:segment
kind:segment:child
```

Examples:

```text
wiki:chat
wiki:chat:architecture
folder:src
folder:src:components
file:server.js
ticket:00035
doc:api-contract
```

Reasons:

- No spaces makes the label read like a true reference, not prose.
- Colon-separated hierarchy is easy to scan and parse.
- The first segment declares the resource kind.
- Later segments describe the resource location within that kind.

Do not use:

```text
wiki: chat: architecture
```

The spaces look less like a reference and make parsing/selection more ambiguous.

### Wiki Reference Labels

Wiki send-to-chat labels come from wiki folder names, not wiki frontmatter.

Rules:

- Ignore wiki frontmatter names for this feature.
- Use folder path segments.
- Remove numeric ordering prefixes such as `001-`, `003-`, or any `00*-` style prefix.
- Lowercase the label.
- Normalize spaces and underscores in folder names to a compact slug.
- Use `:` between hierarchy segments.
- Do not include `PAGE.md`.

Examples:

```text
001-Chat/PAGE.md -> wiki:chat
001-Chat/Architecture/PAGE.md -> wiki:chat:architecture
001-Chat/Runtime_Model/PAGE.md -> wiki:chat:runtime-model
```

If exact folder normalization needs to preserve underscores instead of converting them to dashes, decide that before implementation. The recommended default is kebab-style segments because they are compact and readable in a pill.

### Ticket Reference Labels

Ticket send-to-chat labels use the ticket number only.

Rules:

- Use `ticket:` as the kind prefix.
- Use a five-digit, zero-padded ticket id.
- Ignore the rest of the ticket filename.
- Target filename convention is five numerals followed by the ticket name, such as `00035-Ticket.md`.

Examples:

```text
00035-Ticket.md -> ticket:00035
00003-Fix_Chat.md -> ticket:00003
```

Ticket filename cleanup may happen separately. The target reference label format is still `ticket:00035`.

### Doc Reference Labels

`doc:` refers to markdown documents generally.

This includes Doc Viewer items and raw markdown files that are not better represented by a more specific typed resource such as `wiki:` or `ticket:`.

Rules:

- Use `doc:` as the kind prefix.
- Use a compact slug derived from the document filename or display name.
- Remove the `.md` extension from the label.
- Preserve enough source metadata to resolve the actual markdown path/item later.

Example:

```text
API Contract.md -> doc:api-contract
Design_Notes.md -> doc:design-notes
```

## Copy Link / Copy Path Actions Are Protected

Leave copy-file-path and copy-link controls alone.

This spec only changes `Send to chat`.

Example design distinction:

- `link_2` above a file/doc can continue to copy a link/path.
- `Send to chat` sends the same kind of link/reference to the chat as a removable pill.

Do not repurpose copy controls into chat attachments.

## Filename Autocomplete Behavior

While typing in chat, the composer can suggest known non-`.md` files by filename.

Example:

```text
User types: ser
Ghost text: server.js
```

Accepted keys:

- `Tab`
- `Space`
- `Enter`

Acceptance behavior:

- Locks in the suggested filename.
- Inserts one trailing space.
- Advances the cursor after that space.
- Does not create an inline `@` mention.
- Does not open a broad picker.

The autocomplete should feel like filename completion, not a context mention system.

## Candidate Sources

The autocomplete candidate set is RAM-only and intentionally narrow.

Include:

- Open file explorer tabs in the current workspace.
- Non-`.md` file paths or filenames mentioned in the active chat thread, after validation against the current repo/workspace.
- New file tabs opened after the last refresh.
- Non-`.md` file links/paths sent through `Send to chat` in the active thread.

Exclude:

- Any file ending in `.md`.
- Recent docs.
- Currently open docs.
- Wiki pages.
- Tickets.
- Folder paths.
- URLs.
- Screenshots.
- Tool call bodies.
- Unvalidated example filenames from assistant text.
- Repo-wide search results not mentioned in the thread or open as tabs.

## Metadata-Backed Thread Warm Refresh

Refresh the RAM candidate set when a thread becomes current and warm-up occurs.

Use persisted exchange metadata as the primary source. Do not rescrape the full chat text on every thread change.

Warm-up appears to happen when:

- The user clicks inside the chat input.
- The user pastes into the chat input.
- The existing chat warm path runs for a current thread.

Refresh behavior:

- Read recent/current thread exchanges from SQLite.
- Use each exchange `metadata.attachments`, `metadata.mentions`, and `metadata.fileMutations`.
- Keep only autocomplete candidates that are existing files with extensions that do not end in `.md`.
- Merge metadata-derived candidates with currently open file tabs.
- Store the result in RAM.

Legacy fallback:

- If old exchanges have no mention metadata, a one-time scrape may be used as a compatibility fallback.
- New exchanges should not require full-thread rescraping.

Lag during the first typing moments after a new thread becomes active is acceptable.

## Turn-End Refresh

After `turn_end`, process only the just-completed exchange.

Turn-end behavior:

- Scrape the just-completed user and assistant text, excluding tool calls.
- Discard markdown formatting.
- Extract potential filenames and paths.
- Validate extracted candidates against the current repo/workspace.
- Store validated results in the exchange metadata `mentions` field.
- Include pending send-to-chat pill metadata in the exchange metadata `attachments` field.
- Include file mutation metadata for files changed during the turn in the exchange metadata `fileMutations` field.
- Refresh RAM from the new exchange metadata plus open file tabs.

This keeps autocomplete aware of files mentioned in the latest exchange without needing persistence beyond exchange metadata or broad search.

New file tabs opened after `turn_end` should also be added to RAM immediately.

Closed tabs do not need special handling immediately. They can be cleaned up on the next warm refresh. If a closed tab was mentioned in chat, it can remain as a candidate because it is still thread-relevant.

## Workspace And Thread Scope

The cache is RAM-only.

Do not persist this candidate set to SQLite or local storage.

Do not build a complex invalidation system for workspace switches.

Expected behavior:

- When a thread warms, refresh from current thread exchange metadata and current workspace open file tabs.
- Switching workspaces and then opening/warming a thread should naturally replace the RAM candidate set.
- Open file tabs from the current workspace should be part of the refreshed candidate set.

## Matching Rules

Matching is filename-oriented.

Rules:

- Match against basename first.
- Optionally match against repo-relative path as a secondary signal.
- Matching is case-insensitive.
- Case match can break ties.
- Prefix match beats middle match.
- Open tabs outrank thread-mentioned files.
- More recently opened tabs outrank older open tabs.
- Thread-mentioned candidates can be ordered by most recent mention.

Do not implement:

- `@` prefix matching.
- Wiki label aliases.
- Ticket numeric matching.
- Frontmatter aliases.
- Ghost fill from broad repo search.

## Attachment Metadata

Pending link attachment pills should preserve:

- `kind`
- `label`
- `path`
- `sourceName`
- Optional caller metadata when available.

Example:

```json
{
  "kind": "wiki",
  "label": "wiki:chat:architecture",
  "path": "ai/wiki/001-Chat/Architecture/PAGE.md",
  "sourceName": "Architecture"
}
```

The metadata comes from `Send to chat`, not from arbitrary typed filename autocomplete.

Autocomplete inserts plain filename/path text only. It never creates an attachment pill or structured attachment metadata.

The assistant is expected to use the filename text and available repo context/tools to locate the file when needed.

## Autocomplete Label Rules

For filename autocomplete:

- Display the basename by default.
- Preserve source casing.
- Preserve extension.
- Do not include `.md` files.
- Do not mutate the actual path.

If two candidate files share the same basename, the UI may disambiguate with a compact parent path.

Example:

```text
server.js
lib/server.js
```

## Server And Harness Serialization

The client should be able to send attachment pill metadata with a prompt.

Current client/server behavior is text-only:

```json
{
  "type": "prompt",
  "threadId": "...",
  "user_input": "..."
}
```

Target behavior:

```json
{
  "type": "prompt",
  "threadId": "...",
  "user_input": "Explain this startup flow.",
  "attachments": [
    {
      "kind": "wiki",
      "label": "wiki:chat:architecture",
      "path": "ai/wiki/001-Chat/Architecture/PAGE.md",
      "sourceName": "Architecture"
    }
  ]
}
```

Decision:

- Do both.
- Serialize a compact attachment/reference block into the harness prompt so the assistant can see the attached refs.
- Persist structured metadata on the SQLite exchange so the UI and RAM refresh can use it without parsing prompt text.

No implementation slice may expand file contents automatically unless explicitly approved.

## Exchange Metadata

SQLite exchanges already have a JSON `metadata` column. Use it as the durable source for chat-link attachment and filename autocomplete refresh data.

Target exchange metadata shape:

```json
{
  "attachments": [
    {
      "kind": "wiki",
      "label": "wiki:chat:architecture",
      "path": "ai/wiki/001-Chat/Architecture/PAGE.md",
      "sourceName": "Architecture"
    }
  ],
  "mentions": [
    {
      "kind": "file",
      "label": "server.js",
      "path": "fusion-studio-server/server.js",
      "source": "turn-text"
    }
  ],
  "fileMutations": [
    {
      "event": "modified",
      "path": "fusion-studio-server/server.js",
      "source": "file-save",
      "ts": 1760000000000
    }
  ],
  "contextUsage": 12345,
  "tokenUsage": {}
}
```

Fields:

- `attachments`
  - Pending send-to-chat pills that were sent with the user request.
  - May include `wiki:`, `ticket:`, `doc:`, `folder:`, or `file:` references.
- `mentions`
  - Repo-validated file mentions extracted from the user/assistant text for that exchange.
  - Used to rebuild filename autocomplete RAM without scraping the full thread.
  - Autocomplete hydration still excludes `.md`.
- `fileMutations`
  - Files created, modified, deleted, or renamed during the turn.
  - Used to refresh RAM and make changed files available without rescanning full chat text.
  - May include `.md` for audit completeness, but autocomplete hydration filters `.md` out.

Existing behavior verified in code:

- `exchanges.metadata` already exists in SQLite.
- Existing metadata currently stores generic turn/audit data such as `contextUsage`, `tokenUsage`, `messageId`, and `planMode`.
- File changes are already recorded globally through `file:changed` events and the event ledger.
- File changes are not currently attached to individual exchange metadata.

Required change:

- Preserve existing turn/audit metadata.
- Add `attachments`, `mentions`, and `fileMutations` into the same metadata object.
- Prefer metadata on thread warm; only scrape legacy exchanges when metadata is missing.
- Use turn-end processing to populate new metadata going forward.

## Event-Bus-First Metadata Architecture

Preserve the existing universal event bus pattern.

Events should continue to flow through the event bus. Behavior should be added by subscribing to events, not by turning chat runtime, thread persistence, or the audit subscriber into monoliths.

The exchange metadata system should be modular and additive:

- Chat/runtime emits domain events.
- File/watch systems emit file mutation events.
- Metadata collectors subscribe to those events.
- Each collector contributes one focused metadata slice.
- A small composer/aggregator merges collector output into `exchanges.metadata`.

Do not hardcode all metadata extraction directly into:

- `thread-runtime-controller.js`
- `canonical-chat-event-applier.js`
- `audit-subscriber.js`
- `HistoryFile.js`

Those modules may route, emit, or persist metadata, but they should not own every extraction rule.

Recommended server modules:

```text
fusion-studio-server/lib/chat-metadata/exchange-metadata-registry.js
fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
fusion-studio-server/lib/chat-metadata/collectors/attachments.js
fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js
fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
```

Responsibilities:

- `exchange-metadata-registry.js`
  - Owns collector registration.
  - Allows later collectors such as RAG keywords, entity extraction, symbols, or citations to be added without editing a monolith.
- `exchange-metadata-aggregator.js`
  - Runs registered collectors for a completed exchange.
  - Merges collector output with existing audit metadata.
  - Ensures collector failures are isolated and logged without blocking turn persistence.
- `collectors/attachments.js`
  - Contributes `metadata.attachments` from the prompt/send-to-chat payload.
- `collectors/file-mentions.js`
  - Contributes `metadata.mentions` from the just-completed user/assistant exchange text.
- `collectors/file-mutations.js`
  - Contributes `metadata.fileMutations` from file mutation events correlated to the active turn.

Future collector examples:

- `collectors/rag-keywords.js`
- `collectors/entities.js`
- `collectors/code-symbols.js`
- `collectors/citations.js`

Collector contract:

```ts
interface ExchangeMetadataCollector {
  id: string;
  collect(input: ExchangeMetadataInput): Promise<Record<string, unknown>> | Record<string, unknown>;
}
```

Collector input should include:

- `threadId`
- `turnId`
- `workspaceId`
- `userInput`
- `assistantParts`
- Existing audit metadata.
- Prompt payload metadata such as `attachments`.
- Relevant event-bus events correlated to the turn.

Collector output should be shallow metadata contributions keyed by field name:

```json
{
  "mentions": [],
  "fileMutations": []
}
```

Merge rules:

- Preserve existing metadata fields.
- Collector output must not overwrite unrelated collector fields.
- If two collectors write the same field, the registry must define the merge strategy explicitly.
- Default array fields append and de-duplicate by stable identity such as `kind + path + label`.
- Default object fields shallow-merge only when explicitly allowed.

Event correlation:

- File mutation events should continue to be emitted on the universal event bus.
- A turn-scoped collector can subscribe/cache relevant `file:changed` events while a turn is active.
- On `chat:turn_end`, the aggregator asks the collector for file mutations correlated to that turn/thread/workspace.
- The global event ledger remains useful for audit; exchange metadata stores the turn-local subset needed for chat/autocomplete refresh.

## Existing Code To Reuse

Do not build a disconnected feature.

- `fusion-studio-client/src/lib/chat-action.ts`
  - Extend this for attachment actions from `Send to chat`.
- `fusion-studio-client/src/components/SendToChatButton.tsx`
  - Change supported sends from raw path insertion to attachment pill creation.
- `fusion-studio-client/src/components/ChatInput.tsx`
  - Keep this as the composer shell.
  - Add filename autocomplete behavior here through a focused hook.
- `fusion-studio-client/src/components/chat/useChatArea.ts`
  - Continue routing chat actions and warm intent.
  - Do not put matching/ranking logic here.
- `fusion-studio-client/src/state/fileStore.ts`
  - Use open file tabs as the primary candidate source.

Verified implementation paths live under:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
```

The template spec lives under `System_Manager/view-templates/default`, but the runnable client/server code is not inside that template directory.

## Current Code Findings

- `fusion-studio-client/src/components/SendToChatButton.tsx`
  - Resolves a panel-relative path with `resolveAbsolutePath()`.
  - Dispatches `ChatActionPayload` with string `content`.
  - Shows `Path sent to chat`.
- `fusion-studio-client/src/lib/chat-action.ts`
  - Defines `ChatActionPayload` as string-content or prompt-template action.
  - Has no attachment payload shape yet.
- `fusion-studio-client/src/components/chat/useChatArea.ts`
  - Listens for `CHAT_ACTION_EVENT`.
  - Inserts string content into `ChatInputRef` or sends string content to the current/new thread.
- `fusion-studio-client/src/components/ChatInput.tsx`
  - Owns textarea text state and exposes `insertText`, `replaceText`, `getText`, and `clearText`.
  - Currently sends `onSend(text.trim())`.
- `fusion-studio-client/src/state/fileStore.ts`
  - Holds file tabs and active tab state.
- `fusion-studio-client/src/state/slices/chatSlice.ts`
  - Sends WebSocket messages as `{ type: 'prompt', threadId, user_input: text }`.
- `fusion-studio-server/lib/ws/client-message-router.js`
  - Routes `prompt` messages through `threadRuntimeController.acceptPromptThroughRuntime()`.
- `fusion-studio-server/lib/thread/thread-runtime-controller.js`
  - Tracks accepted user messages with `ThreadWebSocketHandler.handleMessageSend({ content: clientMsg.user_input })`.
  - Sends only `clientMsg.user_input` to the harness with `wire._sendMessage(clientMsg.user_input, {})`.
- `fusion-studio-server/lib/thread/thread-messages.js`
  - Persists user messages as markdown content only.
  - No user-message attachment metadata path exists yet.
- `fusion-studio-server/lib/thread/HistoryFile.js`
  - Persists rich exchanges into SQLite with a JSON `metadata` column.
- `fusion-studio-server/lib/audit/audit-subscriber.js`
  - Persists exchange metadata on `chat:turn_end`.
- `fusion-studio-server/lib/ledger/event-ledger.js`
  - Records global `file:changed` events, but these are not currently attached to individual chat exchanges.

## Recommended Modules

```text
fusion-studio-client/src/lib/chat-file-links/file-link-types.ts
fusion-studio-client/src/lib/chat-file-links/file-link-filter.ts
fusion-studio-client/src/lib/chat-file-links/send-to-chat-reference-label.ts
fusion-studio-client/src/lib/chat-file-links/thread-file-scrape.ts
fusion-studio-client/src/lib/chat-file-links/file-autocomplete-match.ts
fusion-studio-client/src/state/chatFileLinkStore.ts
fusion-studio-client/src/hooks/useFileAutocomplete.ts
fusion-studio-client/src/components/chat/ChatLinkAttachments.tsx
fusion-studio-server/lib/chat-metadata/exchange-metadata-registry.js
fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
fusion-studio-server/lib/chat-metadata/collectors/attachments.js
fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js
fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
```

Responsibilities:

- `file-link-types.ts`
  - Owns attachment and autocomplete candidate types.
- `file-link-filter.ts`
  - Owns extension filtering, `.md` exclusion, and repo validation helpers.
- `send-to-chat-reference-label.ts`
  - Owns typed reference label creation for `Send to chat` pills.
- `thread-file-scrape.ts`
  - Extracts candidate filenames/paths from current thread text, excluding tool calls and markdown formatting.
- `file-autocomplete-match.ts`
  - Owns filename prefix/middle matching and sort rules.
- `chatFileLinkStore.ts`
  - Owns RAM candidate set and pending attachment pills.
- `useFileAutocomplete.ts`
  - Owns composer text/cursor integration for filename autocomplete.
- `ChatLinkAttachments.tsx`
  - Renders removable pill-shaped send-to-chat link attachments above the input.
- `exchange-metadata-registry.js`
  - Owns collector registration and field merge strategies.
- `exchange-metadata-aggregator.js`
  - Runs collectors on `chat:turn_end` and merges output with existing audit metadata.
- `collectors/attachments.js`
  - Contributes `metadata.attachments`.
- `collectors/file-mentions.js`
  - Contributes `metadata.mentions`.
- `collectors/file-mutations.js`
  - Contributes `metadata.fileMutations`.

## Anti-Patterns

- Do not implement manual `@` mentions.
- Do not add a mention picker modal.
- Do not include wiki pages, tickets, docs, or markdown files in filename autocomplete.
- Do not use recent docs.
- Do not use broad repo-wide search as a candidate source.
- Do not persist candidates to SQLite/local storage.
- Do not change copy-file-path links/buttons.
- Do not preload file contents.
- Do not add server repo search.
- Do not put matching/ranking logic directly in `ChatInput.tsx` or `useChatArea.ts`.
- Do not turn `audit-subscriber.js` into the metadata extraction monolith.
- Do not bypass the universal event bus for file mutation metadata.

## Vertical Implementation Slices

### Slice 1: Link Attachment Pill From Send To Chat

Objective:

Change supported `Send to chat` actions from raw path insertion to removable typed-reference attachment pills above the chat input.

Required context and memory:

- Copy-path behavior must remain unchanged.
- `Send to chat` can appear on many resource types.
- Pills use compact typed labels such as `file:server.js`, `wiki:chat`, and `wiki:chat:architecture`.
- The pill is metadata-backed and removable.

Files or directories likely affected:

```text
fusion-studio-client/src/lib/chat-action.ts
fusion-studio-client/src/components/SendToChatButton.tsx
fusion-studio-client/src/components/chat/useChatArea.ts
fusion-studio-client/src/components/ChatInput.tsx
fusion-studio-client/src/components/chat/ChatLinkAttachments.tsx
fusion-studio-client/src/state/chatFileLinkStore.ts
fusion-studio-client/src/lib/chat-file-links/file-link-types.ts
fusion-studio-client/src/lib/chat-file-links/file-link-filter.ts
fusion-studio-client/src/lib/chat-file-links/send-to-chat-reference-label.ts
```

Implementation boundaries:

- Add an attachment action payload.
- Render a composer top row above the input.
- Place the `120px` context usage block on the left of that row.
- Place right-justified attachment pills in the remaining row space.
- Show `link_2` before the label.
- Show hover `X` removal on the top-right edge.
- Clip overflowing pill text inside the pill with a `10px` right fade overlay.
- Do not implement autocomplete in this slice.
- Do not change copy path controls.
- Do not add wiki/doc/ticket resources to filename autocomplete.

Smoke test:

Click `Send to chat` for `server.js` and for a wiki page such as `001-Chat/Architecture/PAGE.md`. Confirm `[link_2 file:server.js]` and `[link_2 wiki:chat:architecture]` pills appear above the input to the right of the `120px` context block, the textarea remains focused, hovering shows an `X`, clicking `X` removes each pill, and no raw path is inserted.

Pass conditions:

- Supported send-to-chat resources create removable pills.
- Context usage remains above the input on the left in a `120px` block.
- Attachments are right-justified in the remaining top-row space.
- Long pill labels clip with a right-side fade instead of expanding layout.
- Wiki labels use folder names, strip numeric prefixes, lowercase, and ignore frontmatter.
- Copy-path controls still copy raw paths.
- Existing string chat actions still work.

Fail conditions:

- The pill appears inside the textarea.
- Attachment pills push or resize the context usage block.
- Long pill text expands the composer instead of clipping with fade.
- Copy-path behavior changes.
- Wiki labels use frontmatter titles instead of folder path segments.

Handoff notes:

Start with `SendToChatButton`, `chat-action.ts`, `useChatArea.ts`, and `ChatInput.tsx`.

### Slice 2: RAM Candidate Store From Open File Tabs

Objective:

Maintain a RAM-only autocomplete candidate set from currently open file explorer tabs, limited to files with extensions that do not end in `.md`.

Required context and memory:

- `fileStore` holds open tabs and active tab state.
- Open tabs outrank thread-mentioned candidates.
- New tabs opened after `turn_end` should be added immediately.

Files or directories likely affected:

```text
fusion-studio-client/src/state/fileStore.ts
fusion-studio-client/src/state/chatFileLinkStore.ts
fusion-studio-client/src/lib/chat-file-links/file-link-filter.ts
fusion-studio-client/src/lib/chat-file-links/file-link-types.ts
```

Implementation boundaries:

- RAM only.
- Open file tabs only for this slice.
- Exclude `.md`.
- Do not include docs, recent docs, wiki, tickets, folders, or repo-wide scan results.

Smoke test:

Open `server.js` and `README.md` in file tabs. Confirm `server.js` appears in the candidate set and `README.md` does not.

Pass conditions:

- Candidate set updates when a supported file tab opens.
- `.md` tabs are excluded.
- No persistence is added.

Fail conditions:

- Recent docs are included.
- Wiki/ticket/doc paths are included.
- Candidate refresh requires repo-wide search.

Handoff notes:

Keep this small and local. It should be easy to inspect in store state.

### Slice 3: Filename Autocomplete In Chat Input

Objective:

Add filename autocomplete in the chat composer from the RAM candidate set.

Required context and memory:

- No `@` prefix.
- No picker modal.
- Typing a prefix like `ser` can ghost `server.js`.
- `Tab`, `Space`, or `Enter` accepts.

Files or directories likely affected:

```text
fusion-studio-client/src/components/ChatInput.tsx
fusion-studio-client/src/hooks/useFileAutocomplete.ts
fusion-studio-client/src/lib/chat-file-links/file-autocomplete-match.ts
fusion-studio-client/src/state/chatFileLinkStore.ts
```

Implementation boundaries:

- Use a focused hook; do not put matching logic directly in `ChatInput.tsx`.
- Match filenames, not wiki labels or tickets.
- Do not create attachment pills from typed autocomplete.
- Preserve normal Enter-to-send when no autocomplete candidate is active.

Smoke test:

With `server.js` in open tabs, type `ser`, confirm ghost text suggests `server.js`, press `Tab`, and confirm `server.js ` is inserted with the cursor after the space.

Pass conditions:

- `Tab`, `Space`, and `Enter` accept an active filename suggestion.
- Normal typing works when no suggestion exists.
- Manual `@` typing does nothing special.
- `.md` files are never suggested.

Fail conditions:

- A modal opens.
- Broad repo files appear without being open/mentioned.
- Enter sends the chat while an autocomplete suggestion is active.

Handoff notes:

Pay close attention to existing Enter-to-send behavior in `ChatInput.tsx`.

### Slice 4: Thread Warm Metadata Hydration

Objective:

On thread warm/current-thread refresh, hydrate RAM candidates from exchange metadata and open file tabs without rescraping the full thread.

Required context and memory:

- Existing rich exchanges already return `metadata`.
- Use `metadata.mentions`, `metadata.attachments`, and `metadata.fileMutations`.
- Validate metadata paths against the current repo/workspace before using them as autocomplete candidates.
- Lag during first typing after thread switch is acceptable.

Files or directories likely affected:

```text
fusion-studio-client/src/components/chat/useChatArea.ts
fusion-studio-client/src/lib/ws/thread-handlers.ts
fusion-studio-client/src/state/chatFileLinkStore.ts
fusion-studio-client/src/lib/chat-file-links/file-link-filter.ts
fusion-studio-client/src/state/fileStore.ts
```

Implementation boundaries:

- Metadata is the primary source.
- Full-thread scraping is legacy fallback only when metadata is absent.
- Do not include `.md` in autocomplete hydration.
- Do not include wiki/ticket/doc attachments as autocomplete candidates unless they also point to a non-`.md` file.

Smoke test:

Switch to a thread with exchange metadata mentioning `server.js` and `fake-example.js`. Confirm `server.js` is added only if it exists in the repo/workspace, and `fake-example.js` is ignored.

Pass conditions:

- Refresh runs on thread warm/current-thread activation.
- Valid metadata-backed non-`.md` files become candidates.
- Full thread text is not scraped for new exchanges that already have metadata.
- Legacy exchanges without metadata can still be handled by fallback.

Fail conditions:

- Random examples become candidates without repo validation.
- Markdown files are included.
- Candidate set from a previous workspace remains after metadata warm refresh.

Handoff notes:

This slice should make thread switching cheap: metadata in, RAM candidates out.

### Slice 5: Turn-End Metadata Capture And Send Metadata

Objective:

After `turn_end`, capture metadata for the just-completed exchange and send pending attachment pill metadata with prompts.

Required context and memory:

- Newly mentioned files should become candidates after assistant/user exchange completion.
- Pending pills should send metadata with the user prompt.
- Removing a pill before send removes metadata.
- File mutations during the turn should be captured into exchange metadata.

Files or directories likely affected:

```text
fusion-studio-client/src/state/chatFileLinkStore.ts
fusion-studio-client/src/state/slices/chatSlice.ts
fusion-studio-client/src/components/chat/useChatArea.ts
fusion-studio-client/src/lib/chat-file-links/thread-file-scrape.ts
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/thread/thread-runtime-controller.js
fusion-studio-server/lib/thread/thread-messages.js
fusion-studio-server/lib/thread/HistoryFile.js
fusion-studio-server/lib/audit/audit-subscriber.js
fusion-studio-server/lib/ledger/event-ledger.js
fusion-studio-server/lib/chat-metadata/exchange-metadata-registry.js
fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
fusion-studio-server/lib/chat-metadata/collectors/attachments.js
fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js
fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js
```

Implementation boundaries:

- Do not expand file contents.
- Preserve text-only prompt compatibility.
- Keep candidate refresh RAM-only.
- Preserve existing metadata fields such as `contextUsage`, `tokenUsage`, `messageId`, and `planMode`.
- Add `attachments`, `mentions`, and `fileMutations` to exchange metadata.
- Use the metadata registry/aggregator and focused collectors.
- Keep file mutations flowing through the universal event bus.
- Do not hardcode all extraction logic directly in `audit-subscriber.js`.

Smoke test:

Send a message with a `file:server.js` or `wiki:chat:architecture` pill attached. Confirm the WebSocket prompt includes `attachments`. After the turn ends, confirm the exchange metadata includes `attachments`, repo-validated `mentions`, and any file mutations from the turn. Confirm the RAM candidate set refreshes from that metadata.

Pass conditions:

- Attachment metadata reaches the server.
- Text-only prompts still work.
- Last-exchange metadata updates RAM candidates.
- `.md` mentions remain excluded.
- File mutations are recorded in exchange metadata when available.

Fail conditions:

- Metadata is only visual and never sent.
- Removed pills still send metadata.
- File contents are automatically expanded.
- Existing audit metadata is overwritten instead of merged.
- Metadata extraction is implemented as one large audit-subscriber block instead of collectors.

Handoff notes:

Harness serialization is decided: inject a compact attachment/reference block into prompt text and persist structured metadata on the exchange.

### Slice 6: Focused Verification

Objective:

Verify the narrowed end-to-end behavior.

Smoke test:

1. Open `server.js` and `README.md` as file tabs.
2. Confirm only `server.js` is an autocomplete candidate.
3. Click `Send to chat` for `server.js`.
4. Confirm a pill appears above the input with `link_2 file:server.js`.
5. Hover the pill and remove it with `X`.
6. Click `Send to chat` for a wiki page and confirm a `link_2 wiki:...` pill.
7. Click `Send to chat` again and send a message.
8. Confirm prompt metadata includes the link attachment.
9. Type `ser`, accept `server.js` with `Tab`, and confirm text insertion.
10. Confirm copy-path behavior still copies paths.

Pass conditions:

- No manual `@` behavior appears.
- No picker modal appears.
- No `.md` file is suggested by autocomplete.
- Raw `.md` file send-to-chat behavior follows the explicit implementation decision.
- No recent docs are included.
- Copy-path behavior is unchanged.

Fail conditions:

- Wiki/ticket/doc/recent-doc autocomplete candidates appear.
- `.md` files are suggested.
- Candidate cache persists in a way that survives an active thread warm refresh incorrectly.

## Assumptions

- “Recently touched” is no longer a persistent or broad recency model.
- Candidate recency is limited to open file tabs and repo-validated active-thread mentions.
- Thread warm refresh uses exchange metadata first, not full chat rescraping.
- Turn-end processing scrapes only the just-completed exchange and writes `mentions`.
- Turn-end processing also records `attachments` and `fileMutations` in exchange metadata.
- Recent docs are excluded.
- Open docs are excluded.
- Markdown files are excluded from autocomplete.
- Typed send-to-chat resources may be backed by markdown files, such as `wiki:` references.
- Markdown send-to-chat resources that are not `wiki:` or `ticket:` use `doc:`.
- Attachment pills are created by `Send to chat`, not by typed autocomplete.
- Send-to-chat pills may represent non-autocomplete resources such as wiki pages using typed reference labels.
- Typed autocomplete inserts filename text only.
- Accepted autocomplete never creates structured metadata; the assistant can find the file from the plain text filename.
- Copy-path controls are separate from `Send to chat` controls.

## Open Questions

None currently.

## Protected Changes Requiring Explicit Approval

- Changing copy-file-path links, buttons, or clipboard behavior.
- Implementing manual `@` mention typing.
- Adding a mention picker modal.
- Including recent docs, open docs, wiki pages, tickets, or markdown files in filename autocomplete.
- Adding repo-wide autocomplete search.
- Persisting autocomplete candidates.
- Expanding referenced file contents automatically.
- Changing chat history format in a backward-incompatible way.
