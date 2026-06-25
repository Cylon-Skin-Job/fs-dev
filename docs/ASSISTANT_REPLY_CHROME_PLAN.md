# Assistant Reply Chrome Spec

Finalized spec for adding per-reply action chrome to assistant chat turns. This
document captures the desired UX, source-of-truth decisions, implementation
boundaries, vertical slices, and smoke tests. It is not an implementation.

## Goal

Append a compact action row to the bottom of each completed assistant reply.
The first active feature is copying the assistant reply text while excluding
tool output. The same extracted reply text should later be reusable by other
services such as text-to-speech.

The feature is modular: text extraction, action/controller helpers, and visible
UI chrome are separate responsibilities.

## Current Desired Chrome

Visible assistant reply chrome, left to right:

```text
content_copy   text_to_speech   bookmark   more_horiz
```

Actions:

| Visible icon | Action | Initial behavior |
|---|---|---|
| `content_copy` | Copy reply text | Active |
| `text_to_speech` | Text-to-speech | Stub |
| `bookmark` or saved type icon | Bookmark reply | Active bookmark/note modal |
| `more_horiz` | More menu | Opens menu |

More menu items:

| Menu item | Icon | Initial behavior |
|---|---|---|
| Compress | `compress` | Stub |
| Fork | `fork_right` | Stub |
| Chat ID | `link_2` | Copy chat-turn id using the existing copy-link interaction paradigm |
| Notes | `add_notes` or `sticky_note_2` | Active note editor; label is stateful |
| Create Ticket | `local_activity` | Stub |

Earlier visible `fork_right` and Chat ID controls are now hidden inside the
ellipsis menu.

Final active/stub matrix for this build:

Active:

- `content_copy`
- bookmark button/modal
- ellipses `Chat ID`
- ellipses `Add Note` / `View Note`

Visible but unusable stubs:

- `text_to_speech`
- ellipses `Compress`
- ellipses `Fork`
- ellipses `Create Ticket`

Stub rows and buttons are inert: no click handler, no toast, and no backend
message. Active actions that unexpectedly lack required data use the shared
guard and show `Error: Data Unavailable`.

## Chat Architecture Constraints

The active Chat System wiki is:

```text
ai/views/wiki-viewer/Wiki/001-Workspaces_And_Views/003-Chat_System/PAGE.md
```

Related bookmark/notes metadata spec:

```text
System_Manager/view-templates/default/ai/docs/003-SPECs/002-Chat_Turn_Bookmarks_And_Notes_Metadata.md
```

Relevant guardrails from the wiki:

- The persistent identity is the thread.
- Live streams route by `threadId`.
- Completed turns hydrate from SQLite exchanges.
- The client renders completed history through `InstantSegmentRenderer`.
- Live turns finalize only after both `turn_end` and live reveal completion.
- Prompt acceptance, stop, and persistence are server-owned.

The chrome is per assistant message and belongs directly under the rendered
assistant content. During streaming, the live reply should not show finished
reply actions. After assistant output ends, or after Stop is clicked, the chrome
may render as a disabled visual shell while the server finalizes and saves the
exchange. Actions become usable only after the saved SQLite exchange ack
arrives with `exchangeId`.

Stronger completion rule for this feature:

```text
chat turn complete = assistant output ended + exchange saved to SQLite + chat id available
```

Do not activate assistant reply chrome until the saved exchange id is viable. A
completed chat turn that cannot be saved to SQLite is a bug to fix, not a state
where reply chrome should silently act without a chat id.

After assistant output ends, or after the user clicks Stop, the bottom composer
control should enter a forced-completion state until this completion gate
passes. In that state the button area shows the fast completion pinwheel GIF at
`/assets/chat-completing-pinwheel.gif` instead of Send. This is intentionally
separate from the CSS spinner used by the Stop button while the chat is still
streaming. During normal finalization it is unclickable. If finalization/save
fails, the same control remains in the spinning stop/finalization visual state
but is clickable again so the user can attempt to force-stop/finalize again.

It is acceptable for persistence and metadata acknowledgement to finish after
the last token renders. The UI may present disabled completed-reply chrome in
that window, but it must not restore the Send button or activate chrome actions
until the saved exchange is confirmed.

## Where To Get Reply Text

Do not scrape rendered DOM.

The best normal source is the client message data model, specifically completed
assistant message `segments`.

Why:

- SQLite stores assistant output in `exchanges.assistant` as JSON:

  ```json
  { "parts": [...] }
  ```

- `fusion-studio-server/lib/thread/HistoryFile.js` reads those rows and returns
  exchange objects.
- `thread:opened` sends rich `exchanges` to the client.
- `fusion-studio-client/src/lib/ws/thread-handlers.ts` converts each assistant
  part to a renderable `StreamSegment`.
- Completed live turns are finalized into `Message` objects with `segments` in
  `fusion-studio-client/src/state/slices/chatSlice.ts`.
- `StreamSegment.type` already distinguishes text from tools.

So the reusable extraction primitive should filter the data model:

```ts
const replyMarkdown = segments
  .filter(segment => segment.type === 'text')
  .map(segment => segment.content)
  .join('');
```

Default behavior:

- Include `text` segments.
- Exclude tool segments such as `shell`, `read`, `write`, `edit`, `grep`,
  `glob`, `fetch`, `web_search`, `subagent`, and `todo`.
- Exclude `think` segments unless a future feature explicitly needs thinking.
- Prefer markdown as the copy payload so code fences, lists, and links survive.
- Generate a plain-text variant from the same payload for TTS.

## SQLite And Source References

Buttons should not query SQLite directly for normal local actions. The client
already has the canonical assistant text in `msg.segments`.

However, messages should carry enough source information for future server-side
features. A useful shape:

```ts
interface AssistantReplySourceRef {
  threadId: string;
  messageId: string;
  exchangeSeq?: number;
  exchangeId?: number;
}
```

`threadId` is routing/context. It is not the Chat ID shown in reply chrome.
The Chat ID should identify the saved chat pair/exchange. The SQLite schema has
`exchanges.id` as the primary exchange id and also has a unique
`thread_id + seq` pair. The current client `ExchangeData` exposes `seq` but not
`id`, so implementation should expose `exchangeId` to the client before reply
chrome becomes active. Do not copy `threadId` as Chat ID.

Use `segments` for immediate local actions:

- copy to clipboard
- client-side TTS
- local bookmark draft

Use the source ref later when a backend service needs to re-fetch or audit the
persisted exchange:

- server-side TTS generation
- durable bookmarks, per `002-Chat_Turn_Bookmarks_And_Notes_Metadata.md`
- notes linked to an exchange, per `002-Chat_Turn_Bookmarks_And_Notes_Metadata.md`
- fork/thread branching from an exact exchange

This keeps the UI decoupled from SQLite while still making the server-owned
record addressable.

Bookmark and notes persistence should follow the metadata spec: bind user
bookmark/note objects to the saved chat pair by storing structured fields on the
exchange metadata object. The reply chrome can expose the entry points, but the
durable model should live in the post-save exchange metadata update service.

## Proposed Module Boundaries

Text extraction:

```text
fusion-studio-client/src/lib/chat/reply-text.ts
```

Responsibilities:

- accept `StreamSegment[]`
- collect reply markdown from text segments only
- optionally derive plain text for TTS
- return one reusable payload

Suggested payload:

```ts
interface AssistantReplyTextPayload {
  markdown: string;
  plainText: string;
  hasText: boolean;
}
```

Action/controller helpers:

```text
fusion-studio-client/src/components/chat/useAssistantReplyChromeController.ts
fusion-studio-client/src/lib/chat/reply-chrome-actions.ts
fusion-studio-client/src/lib/chat/reply-metadata-api.ts
```

Responsibilities:

- `useAssistantReplyChromeController.ts` owns modal open/close state and wires
  presentational callbacks to action/API modules.
- `copyReplyText(payload, source)` uses `writeAndRecord()`
- `speakReplyText(payload, source)` is an inert stub in this build
- `compressReply(payload, source)` is an inert stub in this build
- `forkReply(source)` is an inert stub in this build
- `copyChatId(source)` should mirror the existing top chat menu copy-link
  interaction pattern while copying a chat/exchange id, not the thread id
- `createTicketFromReply(source)` is an inert stub in this build
- shared action guard shows `Error: Data Unavailable` when an active action
  unexpectedly lacks required data

Visible chrome:

```text
fusion-studio-client/src/components/chat/AssistantReplyChrome.tsx
fusion-studio-client/src/components/chat/AssistantReplyChrome.css
fusion-studio-client/src/components/chat/AssistantReplyBookmarkModal.tsx
fusion-studio-client/src/components/chat/AssistantReplyNoteModal.tsx
```

Responsibilities:

- render the four visible icon buttons
- render the ellipsis menu
- emit callbacks supplied by a hook/controller
- stay presentational and small

The component should receive data and callbacks rather than fetch data or call
services/API modules directly:

```ts
interface AssistantReplyChromeProps {
  source: AssistantReplySourceRef;
  segments?: StreamSegment[];
  metadata?: Record<string, unknown>;
  disabled?: boolean;
  onCopyReply: () => void;
  onOpenBookmark: () => void;
  onCopyChatId: () => void;
  onOpenNotes: () => void;
}
```

## Mount Point

Mount reply chrome from:

```text
fusion-studio-client/src/components/MessageList.tsx
```

For completed assistant messages:

```tsx
<InstantSegmentRenderer segments={msg.segments} />
<AssistantReplyChrome
  source={{
    threadId,
    messageId: msg.id,
    exchangeSeq: msg.exchangeSeq,
    exchangeId: msg.exchangeId
  }}
  segments={msg.segments}
  metadata={msg.metadata}
  disabled={!msg.exchangeId || msg.replyChromeFinalizing}
/>
```

Do not mount the chrome inside `InstantSegmentRenderer`; that renderer operates
on individual segment groups and would make whole-reply chrome harder to reason
about.

Do not mount the chrome inside `LiveSegmentRenderer`; live turns should only get
the chrome after finalization converts them into completed assistant messages.

## Styling

Shared message styles currently live in:

```text
ai/system/styles/views.css
```

Existing chat chrome references to imitate:

```text
fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
fusion-studio-client/src/components/ChatArea.css
fusion-studio-client/src/components/chat/ChatAreaHeader.tsx
fusion-studio-client/src/styles/dropdown.css
```

The visual target is the current chat/composer aesthetic:

- the chat thread, input field, and chat text area keep their separate
  background surfaces from theme tokens
- icons follow the same theme slug flow as the composer/footer icons
- idle icon color should use `--chrome-accent` with `--text-dim` fallback
- icon button surfaces should use `--neutral-chrome-bg` and
  `--neutral-chrome-border` where a button surface is needed
- hover state should use existing glass/hover tokens such as `--glass-sm` or
  `--hover-modal-row-hover-bg`
- menu surfaces should match the thread ellipses menu aesthetic; new classes are
  allowed, but they must consume the same variables as `.rv-dropdown` and
  `.rv-dropdown-item`
- menu item icons should use the existing Material Symbols sizing from
  `dropdown.css`
- CSS authored for this feature must use `.rv-`-prefixed class names and every
  color, spacing, radius, shadow, z-index, and transition value must be a CSS
  variable with a fallback, for example `var(--chrome-accent, var(--text-dim,
  currentColor))`.

Suggested classes:

```css
.rv-assistant-reply-chrome
.rv-assistant-reply-action
.rv-assistant-reply-more
.rv-assistant-reply-menu
.rv-assistant-reply-menu-item
```

Design intent:

- compact, quiet, left-aligned under assistant reply content
- no card around the chrome
- icon-only visible controls with `title` and `aria-label`
- use Material Symbols names listed above
- do not hide the chrome just because the reply has no text payload; active
  text-dependent actions should use the shared guard and show
  `Error: Data Unavailable` if invoked without usable text
- menus for reply chrome should look like the existing chat/thread ellipses
  menus, not like a new modal style; class names can differ as long as they use
  the same variables
- the bookmark/note editor can be a pop-up, but its buttons, inputs, borders,
  and icon colors should still use the same chat chrome tokens

Bookmark visual state:

- `metadata.bookmark === null` or missing: render empty `bookmark`.
- `metadata.bookmark.type === "flag"`: render `bookmark_flag` with fill.
- `metadata.bookmark.type === "star"`: render `bookmark_star` with fill.
- `metadata.bookmark.type === "heart"`: render `bookmark_heart` with fill.
- The rendered icon reflects the saved bookmark type, not a separate boolean.

Accessible labels:

- Copy reply: `Copy reply`
- Text-to-speech stub: `Text to speech`
- Bookmark empty: `Add bookmark`
- Bookmark flag: `Flagged`
- Bookmark star: `Starred`
- Bookmark heart: `Liked`
- Chat ID: `Chat ID`
- Notes missing: `Add Note`
- Notes present: `View Note`
- Compress stub: `Compress`
- Fork stub: `Fork`
- Create Ticket stub: `Create Ticket`

Every icon button/menu item gets an explicit `aria-label` and `title`.

## Locked Decisions

- Chat ID copies SQLite `exchanges.id`, never `threadId`.
- The saved-exchange ack message is `chat-turn:saved`.
- Reply chrome may render as a disabled shell during finalization; actions
  activate only after `chat-turn:saved` attaches `exchangeId`.
- Bookmark and note metadata are independent fields on `exchanges.metadata`.
- Bookmark modal edits both bookmark and note for convenience.
- Notes-only modal reads/writes only `metadata.note`.
- Notes attach to the whole exchange only; selected text ranges are out of
  scope for this build.
- Empty/whitespace note saves as `note: null`.
- Server owns bookmark/note timestamps.
- Active actions use `writeAndRecord()` for app clipboard writes.
- Current stubs are visible but unusable: TTS, Compress, Fork, Create Ticket.

## Implementation Plan

Shape this as vertical slices with a narrow smoke test after each slice. Follow
the Code Standards wiki:

- one job per file
- keep each new file under 400 lines; split earlier if a file cannot be
  described in one sentence without "and"
- no view component imports server/API services directly
- extract only when a second consumer exists
- keep CSS scoped to the component or existing runtime style surface with
  `.rv-` prefixes and CSS variables
- keep chat runtime semantics intact: no optimistic persistence; the reply
  chrome may render as a disabled visual shell during finalization, but actions
  stay inert until the saved-exchange ack provides `exchangeId`

## Verification Environment Notes

There are two different launch paths a worker should understand:

- Browser/Playwright path: `fusion-studio-client/playwright.config.ts` runs
  specs in `fusion-studio-client/e2e` against `http://localhost:3001`. It starts
  `node ../fusion-studio-server/server.js` automatically and uses
  `reuseExistingServer: true`. There is no npm script; run focused tests from
  `fusion-studio-client` with `npx playwright test <spec> --workers=1`.
- Electron/Playwright target: add a separate
  `fusion-studio-client/playwright.electron.config.ts` and
  `fusion-studio-client/e2e-electron/` lane when automating real app-shell
  checks. It should run single-worker, after `npm run build`, and launch
  `electron/main.cjs` with isolated `FUSION_APP_USER_DATA` plus
  `FUSION_LOCAL_MACHINE=playwright-e2e`.
- Electron/manual smoke path: Fusion Home owns the restart script at
  `/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh`. It kills
  prior Fusion/Electron/server processes, builds `fusion-studio-client`, launches
  Electron through macOS LaunchServices, waits for the Electron-owned server
  port file, and prints the live server URL.

Use browser Playwright for focused renderer/server assertions. Use Electron
Playwright or the Fusion Home restart script when validating the real Electron
shell or when client bundle changes must be reflected in the running app. The
restart script is outside this repo and opens a GUI app, so it may require an
elevated/approved tool run.

## Current Codebase Facts

These are the relevant existing seams the worker should use rather than
rediscovering them.

Server:

| Area | File | Current fact |
|---|---|---|
| DB lifecycle | `fusion-studio-server/lib/db.js` | Exports `initDb`, `getDb`, `closeDb`, and canonical `DB_PATH`; tests must call `initDb()` before using `HistoryFile`. |
| Exchange table | `fusion-studio-server/lib/db/migrations/001_initial.js` | `exchanges.id` already exists as the primary key; `thread_id + seq` is unique and indexed. |
| Exchange CRUD | `fusion-studio-server/lib/thread/HistoryFile.js` | Reads/writes `exchanges`; currently returns `seq`, `ts`, `user`, `assistant`, `metadata`, but not `id`. |
| Turn-end persistence | `fusion-studio-server/lib/audit/audit-subscriber.js` | Persists exchanges after `chat:turn_end`, then emits `chat:exchange_metadata`. This is for turn-end metadata only. |
| Metadata collectors | `fusion-studio-server/lib/chat-metadata/*` | Aggregates attachments, file mentions, and file mutations at turn end. Bookmark/note edits are post-persistence and should not be modeled as turn-end collectors. |
| WS thread handlers | `fusion-studio-server/lib/ws/thread-ws-handlers.js` | Routes `thread:*` messages to thread handlers. A new `chat-turn:*` family needs its own handler branch in `client-message-router.js`. |
| WS redaction | `fusion-studio-server/lib/ws/redaction-map.js` | Any new WS message carrying note body text must be added to `RULES` so server logs do not capture user note content. |

Terminology note: this feature uses WebSocket/application protocol messages
between renderer and server, plus canonical chat events after harness output has
already been translated. It must not add or depend on raw Kimi wire protocol
parsing. Existing files may still contain the word `wire` for historical or
internal transport reasons; do not treat that as permission to route this
feature through Kimi-specific protocol code.

Client:

| Area | File | Current fact |
|---|---|---|
| WS message type union | `fusion-studio-client/src/types/index.ts` | `WebSocketMessageType` is a closed union. Add every new `chat-turn:*` message type here. |
| Exchange type | `fusion-studio-client/src/types/index.ts` | `ExchangeData` currently has `seq`, not `exchangeId`. It should gain optional `exchangeId`. |
| Message type | `fusion-studio-client/src/types/index.ts` | `Message` currently has optional `segments`, but no `exchangeId`, `exchangeSeq`, or metadata field. |
| History hydration | `fusion-studio-client/src/lib/ws/thread-handlers.ts` | `convertExchangesToMessages()` maps rich exchanges to user/assistant messages and is the right place to attach `exchangeId`, `exchangeSeq`, and metadata to assistant messages. |
| Live finalization | `fusion-studio-client/src/state/slices/chatSlice.ts` | `finalizeTurn()` turns live segments into a completed assistant message. It may not have the SQLite `exchangeId` immediately. |
| Metadata broadcast handling | `fusion-studio-client/src/lib/ws/stream-handlers.ts` | `exchange_metadata` currently only hydrates autocomplete candidates; it does not update message metadata. |
| Generic WS request helpers | `fusion-studio-client/src/lib/ws-client.ts` | `sendFusionMessage` and `onFusionMessage` already support request/response-style modules such as clipboard. New client APIs can follow that pattern. |
| Clipboard write | `fusion-studio-client/src/clipboard/clipboard-api.ts` | `writeAndRecord()` already writes to the system clipboard and records history. Use it for every app-initiated system clipboard write in this feature. |
| Existing dropdown aesthetic | `fusion-studio-client/src/styles/dropdown.css` | Thread/header menus use token-driven dropdown variables; reply menus may use new classes but should consume the same variables. |

Client state helpers to add:

```ts
setMessageExchangeSaved(threadId, turnId, payload)
updateMessageMetadata(threadId, exchangeId, metadata)
```

Rules:

- `setMessageExchangeSaved` updates the just-finalized assistant message by
  `threadId + turnId`, attaching `exchangeId`, `seq`, `ts`, and `metadata`.
- `updateMessageMetadata` updates loaded assistant messages by
  `threadId + exchangeId`.
- Do not update by array index alone.
- Do not update by `threadId` alone.
- If the target message is not loaded, do nothing and rely on future SQLite
  hydration.

## Harness And Event Flow

This feature must stay outside raw harness protocol parsing. It starts after the
chat turn has become canonical app state and after SQLite has saved the
exchange.

### Backend Harness Interpreter

Current normal harness policy is OpenCode. The backend harness path is:

```text
OpenCode CLI JSON output
  -> fusion-studio-server/lib/harness/opencode/json-event-translator.js
  -> canonical harness events
  -> fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
  -> fusion-studio-server/lib/wire/canonical-chat-event-applier.js
  -> universal event bus chat:* events
```

Important facts:

- `OpenCodeJsonEventTranslator` maps provider-native JSON into canonical events
  such as `turn_begin`, `content`, `thinking`, `tool_call`,
  `tool_call_args`, `tool_result`, `status_update`, and `turn_end`.
- `canonical-harness-event-bridge.js` converts flat canonical harness events
  into the `{ type, payload }` shape consumed by the chat applier.
- `canonical-chat-event-applier.js` is vendor-agnostic. It explicitly does not
  parse raw Kimi protocol messages or import Kimi normalizers.
- The applier emits `chat:*` events on the universal event bus.
- `audit-subscriber.js` listens to `chat:turn_end` and persists the SQLite
  exchange.
- `wire-broadcaster.js` also listens to `chat:*` events and fans them out to
  the correct WebSocket client by `threadId`.

Do not add bookmark/note/reply-chrome behavior to harness interpreters. The
feature is UI and exchange metadata behavior layered on persisted canonical chat
turns.

### Universal Event Bus

The server universal event bus is:

```text
fusion-studio-server/lib/event-bus.js
```

It is the server cross-module pub/sub backbone. Chat turn lifecycle events,
metadata persistence, WebSocket fan-out, and future automations meet here.

For this feature:

- Do not bypass the bus for normal chat turn lifecycle.
- Do not add raw harness protocol events to the bus.
- Use post-persistence metadata update handlers for user-authored bookmark/note
  edits.
- The save acknowledgement is required for chrome viability.
- The save acknowledgement message is `chat-turn:saved` and is sent after
  SQLite `addExchange()` succeeds.
- `chat-turn:saved` includes `threadId`, `turnId`, `exchangeId`, `seq`, `ts`,
  `partial`, `reason`, and `metadata`.

### Frontend Stream Interpreter

The frontend stream interpreter is:

```text
fusion-studio-client/src/lib/ws/stream-handlers.ts
fusion-studio-client/src/lib/ws/turn-lifecycle.ts
fusion-studio-client/src/lib/tool-grouper.ts
fusion-studio-client/src/lib/instructions.ts
```

Frontend flow:

```text
WebSocket chat messages
  -> stream-handlers route by explicit threadId
  -> turn-lifecycle manages currentTurn / pendingTurnEnd
  -> stream-handlers builds StreamSegment[]
  -> MessageList chooses LiveSegmentRenderer or InstantSegmentRenderer
```

Important facts:

- `stream-handlers.ts` rejects routed stream messages without `threadId`.
- Text becomes `StreamSegment` type `text`.
- Thinking becomes `StreamSegment` type `think`.
- Tool names are expected to already be canonical; `toolNameToSegmentType()`
  maps canonical names only and warns on unknown names.
- `tool-grouper.ts` manages grouped tool rendering and must not be bypassed.
- Reply text extraction should operate on finalized `Message.segments`, not on
  DOM output and not on raw harness events.

### Legacy Kimi Concern

Some code and docs still contain historical names such as `wire`,
`compatibleStdout`, or Kimi references. For this feature:

- Treat `wire` in active chat files as internal transport/fan-out terminology,
  not as raw Kimi protocol authority.
- Do not add frontend raw Kimi aliases.
- Do not parse provider-native output in frontend code.
- Do not route bookmark/note metadata through `harness/kimi/*` or raw
  compatibility stdout.
- Use canonical chat events, exchange metadata, and WebSocket application
  messages only.

## Clipboard Policy

Any copy action inside Fusion Studio that writes to the system clipboard should
also write to clipboard history. This feature must use the existing clipboard
history API instead of calling `navigator.clipboard.writeText()` directly.

Required consumers:

- reply text copy: `writeAndRecord(replyMarkdown, 'assistant-reply')`
- Chat ID copy: `writeAndRecord(chatId, 'assistant-reply-chat-id')`
- note copy: `writeAndRecord(noteDraft, 'assistant-reply-note')`

## Dependencies And Ordering

Hard dependencies:

1. `exchangeId` exposure and `chat-turn:saved` must happen before reply chrome
   actions become active.
2. Message type updates must happen on both server and client before any
   `chat-turn:*` requests are sent.
3. Server redaction rules must land in the same slice as any WS message that
   carries note body text.
4. Metadata update service must preserve unrelated metadata keys before UI
   bookmark/note persistence is enabled.
5. Client state must retain exchange metadata before persisted bookmark visual
   state can survive thread switches/reloads.

Soft dependencies:

- Reply text extraction can be built before bookmark/note persistence because
  it only needs local `segments`.
- The disabled visible chrome shell can be built before every action is wired.
- Active bookmark/note UI should ship only with the metadata update path.

## Gotchas And Silent-Fail Risks

### Exchange Id Timing

For historical messages, `thread:opened` can hydrate `exchangeId` once
`HistoryFile._toExchange()` exposes it. For the just-finished live turn, the
current flow sends `turn_end` to the client before SQLite persistence
acknowledgement reaches the client. `finalizeTurn()` can therefore create the
completed assistant message before the client has a persisted exchange id.
That is not acceptable for reply chrome.

Current implementation facts:

- Stop uses `stopRuntimeTurn()`, which synthesizes canonical `turn_end` with
  `reason: "interrupted"` and `partial: true`.
- That synthetic `turn_end` goes through the same `chat:turn_end` event and
  `audit-subscriber` SQLite persistence path as normal completion.
- `HistoryFile.addExchange()` currently inserts the row but does not return or
  broadcast the inserted SQLite `id`.
- `wire-broadcaster` currently sends `turn_end` immediately from
  `chat:turn_end`, while `audit-subscriber` persists asynchronously and later
  emits `chat:exchange_metadata` without `exchangeId`.

Mitigation:

- Make SQLite persistence return the saved exchange row including `id`.
- Send `chat-turn:saved` with `exchangeId`, `seq`, `ts`, `partial`, `reason`,
  and `metadata`.
- Use an explicit pending-saved-exchange state that keeps the bottom composer in
  forced-completion mode until the ack arrives. The completed assistant message
  may show disabled chrome during this state.
- During forced completion, the button area shows an unclickable spinning
  pinwheel GIF. It is not Stop and it is not Send.
- If forced completion fails, the spinning stop/finalization control becomes
  clickable again so the user can retry finalization. Do not swap back to Send
  until `chat-turn:saved` arrives.
- Stopped/interrupted turns must follow the same save-then-chrome gate.
- Do not use `threadId` as fallback Chat ID.

### `exchange_metadata` Currently Does Not Update Messages

`stream-handlers.ts` uses `exchange_metadata` only for autocomplete candidate
hydration. If bookmark/note updates reuse or extend this event without updating
message state, the UI can save successfully but remain visually stale until
thread reload.

Mitigation:

- Add a dedicated `chat-turn:metadata:updated` client handler or extend the
  stream handler deliberately.
- Update the matching assistant `Message` in the `projectChats[threadId]` slot.

### Metadata Merge Can Accidentally Drop Existing Fields

Exchange metadata already carries fields such as `attachments`, `mentions`,
`fileMutations`, `contextUsage`, and `tokenUsage`. A naive update that replaces
the whole JSON object will silently erase those fields.

Mitigation:

- Server update service must read current metadata, patch only `bookmark` and/or
  `note`, and write the merged object.
- Tests must include existing unrelated metadata and assert it survives.

### Legacy Metadata Shape

`HistoryFile._toExchange()` already defends against legacy metadata stored as
`[]` by converting arrays to `{}`. New update service must do the same. If it
assumes an object, old rows can crash updates or overwrite metadata oddly.

Mitigation:

- Add one shared local normalizer in the exchange metadata service.
- Do not broaden `HistoryFile` into a metadata behavior owner just to reuse its
  parse snippet.

### Closed Client Message Union

The client `WebSocketMessageType` union is closed. If the worker adds server
messages without extending the union, TypeScript can fail in unrelated-looking
handler code or developers may cast around the type and lose safety.

Mitigation:

- Add `chat-turn:metadata:update`, `chat-turn:metadata:updated`, and
  `chat-turn:metadata:error` to the union in the same slice as the handlers.

### WS Router Prefix Registration

Server `client-message-router.js` dispatches message families by prefix. Adding
handler files alone will do nothing unless the router delegates `chat-turn:*`.

Mitigation:

- Add a `chat-turn:` branch near the other delegated managers.
- Keep the handler file one job: validate request, call metadata service, send
  response.

### Note Text In Logs

Note bodies are user-authored content and can include sensitive text. The WS
debug logger redacts only message types listed in `redaction-map.js`. A new note
update request without redaction can silently persist note bodies into
`server-live.log`.

Mitigation:

- Add redaction for inbound/outbound note body paths such as `note.body`,
  `metadata.note.body`, `patch.note.body`, and response payload equivalents.
- Add redaction-map Jest coverage in the same slice.

### View/Service Layer Boundary

The Code Standards wiki says views should not call services/API directly. The
existing codebase has pragmatic client API modules such as `clipboard-api.ts`
that components use. For this feature, keep the component presentational and put
WS/clipboard calls in a small hook/controller or `reply-chrome-actions.ts`, not
inside the JSX body.

Mitigation:

- `AssistantReplyChrome.tsx` accepts callbacks.
- `AssistantReplyBookmarkModal.tsx` and `AssistantReplyNoteModal.tsx` accept
  `onSave`, `onCopyNote`, etc.
- A colocated hook or parent controller wires those callbacks to API/action
  modules.

### Existing Browser Bookmark Domain Is Different

`components/browser/BookmarkDialog.tsx` has an anchored pop-up pattern, but it
is browser-bookmark specific. Reusing its state or persistence would conflate
browser bookmarks with chat-turn bookmarks.

Mitigation:

- Only extract anchored-dismiss mechanics if needed as a second consumer.
- Do not import browser bookmark store/actions into chat reply code.

### Icon Availability And Naming

The app commonly renders Material Symbols by name. If a new icon name is wrong,
the UI can show text fallback or missing glyphs without throwing.

Mitigation:

- Verify these names during UI smoke: `content_copy`, `text_to_speech`,
  `bookmark`, `more_horiz`, `compress`, `fork_right`, `link_2`,
  `add_notes`, `sticky_note_2`, `local_activity`, `bookmark_flag`,
  `bookmark_star`, `bookmark_heart`, `copy_content`, `delete_sweep`,
  `rotate_left`.

### Background Thread State

Chat state is keyed by `threadId`. Metadata updates for a thread that is not
currently visible must update that thread's `projectChats[threadId]` slot and
must not mutate the active thread by accident.

Mitigation:

- Every client update action and handler must route by explicit `threadId`.
- Tests/manual smoke should update a background thread and verify the visible
  thread does not change.

### Empty Text Payload

Assistant messages can be tool-only. Rendering enabled copy/TTS chrome for a
message with no `text` segments will produce empty clipboard/TTS behavior.

Mitigation:

- `reply-text.ts` returns `hasText`.
- Active text-dependent actions use the shared guard and show
  `Error: Data Unavailable` if invoked without usable text.

### Slice 1: Saved Exchange Ack And Chat IDs

Goal: make every completed assistant message addressable by a saved chat-turn
id before completed reply chrome actions can activate.

Server changes:

- Update `HistoryFile._toExchange()` to include SQLite `exchanges.id`.
- Update `HistoryFile.addExchange()` to return the inserted `id`.
- Update the event/message emitted after persistence to `chat-turn:saved` with
  `exchangeId`, `seq`, `ts`, `partial`, `reason`, and `metadata`.
- Treat missing `exchangeId` after turn completion as an error state, not as a
  reason to copy `threadId`.

Client changes:

- Extend `ExchangeData` with optional `exchangeId`.
- Extend `Message` with optional `exchangeId`, `exchangeSeq`, and
  `metadata?: Record<string, unknown>`.
- Map `exchange.exchangeId` and `exchange.seq` in `convertExchangesToMessages()`.
- Ensure live turns do not activate completed reply chrome until
  `chat-turn:saved` provides `exchangeId`.
- Ensure stopped/interrupted turns use the same saved-exchange gate.

Smoke tests:

- Server Jest: `HistoryFile.addExchange()` returns an id, and `read()` returns
  exchanges with the same id.
- Server/client smoke: stopped interrupted turn persists and produces a saved
  exchange id before completed reply chrome would be eligible to render.
- Client build: `npm run build` in `fusion-studio-client`.

### Slice 2: Reply Text Payload And Copy Action

Goal: add a reusable reply-text extractor and one active consumer: Copy.

New client files:

```text
fusion-studio-client/src/lib/chat/reply-text.ts
fusion-studio-client/src/lib/chat/reply-chrome-actions.ts
```

Responsibilities:

- `reply-text.ts` accepts `StreamSegment[]` and returns `{ markdown, plainText,
  hasText }`.
- It includes only `text` segments and excludes tools and `think`.
- `reply-chrome-actions.ts` implements `copyReplyText(payload, source)`.

Existing function to reuse:

- Use `writeAndRecord(text, 'assistant-reply')` from
  `fusion-studio-client/src/clipboard/clipboard-api.ts` instead of writing
  another clipboard wrapper. That function already writes to the system
  clipboard and records clipboard history.

Smoke tests:

- Client build: `npm run build` in `fusion-studio-client`.
- If an existing client unit-test harness is available, add a focused extractor
  test for mixed text/tool segments. Do not create a new test harness solely for
  this extractor slice.

### Slice 3: Completed Reply Chrome Shell

Goal: show post-turn chrome as a disabled shell during finalization or legacy
missing-id states, and activate it only on assistant messages whose exchange is
saved and has a chat id.

New client files:

```text
fusion-studio-client/src/components/chat/AssistantReplyChrome.tsx
fusion-studio-client/src/components/chat/AssistantReplyChrome.css
fusion-studio-client/src/components/chat/useAssistantReplyChromeController.ts
```

Boundaries:

- `AssistantReplyChrome.tsx` is presentational: accepts `source`, `payload`,
  button state, and callbacks.
- `useAssistantReplyChromeController.ts` wires callbacks to
  `reply-chrome-actions.ts`, owns local modal open/close state, and keeps
  side-effect calls out of the presentational component.
- Do not mount inside `InstantSegmentRenderer` or `LiveSegmentRenderer`.
- Mount from `MessageList.tsx` after `InstantSegmentRenderer` for completed
  assistant messages.
- If a completed assistant message lacks `exchangeId`, render the chrome as a
  disabled visual shell. During active finalization, keep the composer in
  forced-completion mode until `chat-turn:saved` updates state.
- Reuse the existing dropdown aesthetic for the more menu. New reply-specific
  classes are fine, but their colors, borders, background, hover, radius, and
  spacing should come from the same variables used by `.rv-dropdown` and
  `.rv-dropdown-item`.
- Every authored CSS value uses a CSS variable with a fallback; do not hardcode
  color, spacing, radius, shadow, z-index, or transition values.
- Action icons should visually rhyme with the icons below the chat input:
  token-driven `--chrome-accent` color, compact hit targets, and subtle hover.

Visible controls:

```text
content_copy   text_to_speech   bookmark   more_horiz
```

More menu:

```text
compress
fork_right
link_2 Chat ID
add_notes Add Note / sticky_note_2 View Note
local_activity Create Ticket
```

Smoke tests:

- Open a completed thread and confirm every completed assistant message with
  text shows exactly one chrome row.
- Send a new prompt and confirm chrome appears only after the turn finalizes,
  not while the live renderer is streaming. While SQLite save acknowledgement is
  pending, chrome may be visible but must be disabled.
- Confirm the composer shows an unclickable spinning pinwheel GIF while save
  acknowledgement is pending, then swaps to Send only after exchange save and
  chrome viability.
- Client build.

### Slice 4: Chat ID Copy

Goal: make the `link_2` Chat ID menu item copy the saved chat-turn id.

Behavior:

- Use the existing top-menu thread copy-link UX as the paradigm: icon,
  click-to-copy, toast feedback.
- Do not copy `threadId`.
- Copied value: SQLite `exchanges.id`.

Implementation:

- Add `copyChatId(source)` in `reply-chrome-actions.ts`.
- Use `writeAndRecord(chatId, 'assistant-reply-chat-id')`; do not call
  `navigator.clipboard.writeText()` directly.
- If `exchangeId` is unavailable, Chat ID copy is not viable and chrome should
  be disabled. If an active action somehow reaches this path without required
  data, show `Error: Data Unavailable`.

Smoke tests:

- Completed historical message copies `exchangeId`.
- Finalized live message does not render chrome until `exchangeId` is present.
- Client build.

### Slice 5: Exchange Metadata Update Path

Goal: persist bookmark/note edits after a turn has already been saved.

Server files:

```text
fusion-studio-server/lib/chat-metadata/exchange-metadata-update-service.js
fusion-studio-server/lib/ws/chat-turn-metadata-handlers.js
```

Responsibilities:

- `exchange-metadata-update-service.js`: read and update the JSON metadata for
  one exchange by `exchangeId`, verifying that the supplied `threadId` owns it.
- Preserve unrelated metadata keys such as attachments, mentions,
  fileMutations, contextUsage, and tokenUsage.
- Apply bookmark/note patch semantics:
  - selected bookmark type writes `metadata.bookmark`
  - no selected bookmark removes/nulls `metadata.bookmark`
  - note body writes `metadata.note`
  - empty/whitespace saved note writes `metadata.note = null`
  - server owns `createdAt` and `updatedAt`
- `chat-turn-metadata-handlers.js`: handles client update requests and sends
  a metadata-updated response.

WebSocket message names:

```text
chat-turn:metadata:update
chat-turn:metadata:updated
chat-turn:metadata:error
```

Client request:

```ts
{
  threadId: string;
  exchangeId: number;
  patch: {
    bookmark?: { type: "flag" | "star" | "heart" } | null;
    note?: { body: string } | null;
  };
}
```

Server response:

```ts
{
  threadId: string;
  exchangeId: number;
  metadata: Record<string, unknown>;
}
```

Reasoning:

- This is post-persistence user metadata, not a turn-end collector.
- It should not be added to `audit-subscriber.js`.
- It should not make `HistoryFile` own bookmark/note behavior beyond generic
  row read/write helpers if needed.

Smoke tests:

- Server Jest: patching bookmark preserves existing `attachments`.
- Server Jest: toggling bookmark off removes only `metadata.bookmark` and keeps
  `metadata.note`.
- Server Jest: notes-only update modifies only `metadata.note`.
- Server smoke: `npm test` targeted to the new service/handler tests.

### Slice 6: Bookmark And Note Editor

Goal: implement the bookmark pop-up and notes-only pop-up against the metadata
update path.

New client files:

```text
fusion-studio-client/src/components/chat/AssistantReplyBookmarkModal.tsx
fusion-studio-client/src/components/chat/AssistantReplyNoteModal.tsx
fusion-studio-client/src/lib/chat/reply-metadata-api.ts
```

Boundaries:

- The modal components are presentational: they accept open-time draft values
  and callbacks such as `onSave`, `onCancel`, `onCopyNote`, `onClearNote`, and
  `onRevertNote`.
- The controller/hook owns modal state and calls `reply-metadata-api.ts` or
  `reply-chrome-actions.ts`; modal JSX must not import API or clipboard modules.
- `reply-metadata-api.ts` owns only WebSocket metadata request/response calls.

Behavior:

- Bookmark button opens editor with radio group plus note input.
- Notes menu item opens the same note input/chrome/buttons without radios.
- Notes menu item is stateful:
  - `metadata.note == null`: `add_notes` + `Add Note`
  - `metadata.note` truthy: `sticky_note_2` + `View Note`
- Radio buttons:
  - `bookmark_flag` -> `flag`
  - `bookmark_star` -> `star`
  - `bookmark_heart` -> `heart`
- Clicking the selected radio toggles it off.
- Save with no selected radio removes bookmark but leaves note unchanged unless
  the note draft was also changed and saved.
- `copy_content` emits the note-copy callback; the controller/action helper
  copies the draft note text using
  `writeAndRecord(noteDraft, 'assistant-reply-note')`.
- `delete_sweep` clears the draft note input.
- `rotate_left` appears only after note text changes and restores only the note
  text to its open-time value.
- No per-keystroke server writes.
- Saving empty/whitespace-only note sends `note: null`.
- Notes-only editor reads/writes only `metadata.note` and must never modify
  `metadata.bookmark`.
- The editor should use the same token family as chat chrome and thread menus:
  `--neutral-chrome-bg`, `--neutral-chrome-border`, `--chrome-accent`,
  `--text-primary`, `--text-dim`, `--glass-sm`, and existing radius/spacing
  variables.
- Avoid introducing a separate visual language for the editor.

Existing function/component to evaluate for extraction:

- `components/browser/BookmarkDialog.tsx` already has an anchored pop-up with
  outside-click close behavior, but its form and domain are browser-bookmark
  specific.
- If the implementation needs the same anchored-dismiss behavior, extract only
  the shared shell or hook as a second consumer, for example:

  ```text
  fusion-studio-client/src/components/anchored-popover/useAnchoredDismiss.ts
  ```

- Do not reuse browser bookmark state, browser bookmark labels, or browser
  bookmark persistence.

Smoke tests:

- Bookmark modal opens with empty note and no selected radio on an unmarked
  exchange.
- Existing note pre-fills both bookmark editor and notes-only editor.
- Toggle selected radio off, Save, reload thread, bookmark remains absent and
  note remains.
- Clear note, Save, reload thread, note is `null`/absent.
- Client build.

### Slice 7: Metadata Hydration And Visual State

Goal: make persisted bookmark/note state visible after reloads and thread
switches.

Client changes:

- Ensure assistant messages retain exchange metadata during
  `convertExchangesToMessages()`.
- Use `metadata.bookmark?.type` to choose the visible bookmark icon state:
  empty `bookmark` when null/missing, filled `bookmark_flag`,
  `bookmark_star`, or `bookmark_heart` when saved.
- Notes-only editor reads from message metadata, not from a separate local cache.
- Apply `chat-turn:metadata:updated` responses to the matching message in
  per-thread chat state.

Smoke tests:

- Add bookmark/note, switch threads, switch back: state is still visible.
- Refresh/reopen app, open thread: state hydrates from SQLite metadata.
- Metadata update for a background thread does not mutate the visible active
  thread incorrectly.
- Client build plus targeted server tests.

### Slice 8: Final Integration Smoke

Goal: verify the complete vertical path.

Manual smoke:

1. Start browser smoke through Playwright, or restart the real Electron app with
   `/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh` for final
   visual validation.
2. Open a historical thread with completed assistant replies.
3. Copy reply text; confirm tools are excluded.
4. Copy Chat ID; confirm it is SQLite `exchanges.id`, not thread id.
5. Add a bookmark type plus note, Save, reload thread, confirm metadata
   persisted.
6. Open Notes from ellipsis, edit only note, Save, confirm bookmark unchanged.
7. Toggle bookmark off from bookmark editor, Save, confirm note unchanged.
8. Send a new prompt; confirm chrome appears only after finalization.
9. Stop a streaming turn; confirm the composer swaps to the unclickable
   pinwheel, partial exchange saves, receives a chat id, and only then renders
   chrome and restores Send.

Automated smoke:

- `npm test` in `fusion-studio-server`.
- `npm run build` in `fusion-studio-client`.
