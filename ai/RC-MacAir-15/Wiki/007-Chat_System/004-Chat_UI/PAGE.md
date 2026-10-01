---
name: Chat UI
description: Composer, thread header, message list, reply chrome, menus, modals, and chat styling rules.
metadata:
  source-files:
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/components/chat/ChatAreaFooter.tsx
    - fusion-studio-client/src/components/chat/ChatAreaHeader.tsx
    - fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx
    - fusion-studio-client/src/components/chat/ChatSurface.tsx
    - fusion-studio-client/src/components/chat/useChatSessionHost.ts
    - fusion-studio-client/src/components/chat/useChatSessionActions.ts
    - fusion-studio-client/src/components/chat/ConnectedChatHeader.tsx
    - fusion-studio-client/src/hooks/useFloatingWindow.ts
    - fusion-studio-client/src/components/email/EmailComposeWindow.tsx
    - fusion-studio-client/e2e/side-chat-adapterless-native.spec.ts
    - fusion-studio-client/src/components/MessageList.tsx
    - fusion-studio-client/src/styles/dropdown.css
    - ai/<machine>/System/styles/views.css
    - fusion-studio-client/src/components/ChatArea.tsx
    - fusion-studio-client/src/components/WorkspacePanel.tsx
    - fusion-studio-client/src/components/chat/ViewChatHost.tsx
    - fusion-studio-client/src/components/chat/ThreadedChat.tsx
    - fusion-studio-client/src/components/chat/useViewChatHost.ts
    - fusion-studio-client/src/components/chat/useSideChatRailAdapter.ts
    - fusion-studio-client/src/components/capture/CaptureTiles.tsx
    - fusion-studio-client/src/components/file-explorer/FileExplorer.tsx
    - fusion-studio-client/src/components/wiki/WikiExplorer.tsx
    - fusion-studio-client/src/components/office/OfficeGrid.tsx
    - fusion-studio-client/src/components/email/EmailGrid.tsx
    - fusion-studio-client/src/components/email/EmailComposeLayer.tsx
    - fusion-studio-server/lib/thread-groups/chat-capable-views.js
    - fusion-studio-server/lib/thread-groups/move-service.js
    - fusion-studio-server/lib/thread-groups/placement-delivery.js
  last-modified: "2026-09-28T04:56:08Z"
---

Use this section before changing visible chat controls, chat menus, message
chrome, composer behavior, or chat-specific styling.

## Standing UI Rules

- Preserve the current chat/composer visual language.
- New class names are allowed for customization, but they must use the same
  workspace/system CSS variables as the existing chat footer and thread menus.
- Visible stubs in dev builds are inert: no click handler, no backend message,
  and no toast unless they are using a shared active-action fallback.
- Presentational components receive state and callbacks. Side effects belong in
  hooks/controllers or small action/API modules.
- Icon buttons and menu items need `aria-label` and `title`.

## New Thread

In the current OpenCode-only config, New Thread is direct. It does not open a
harness selector.

The harness picker is conditional:

- one enabled harness in `cli.json`: hide picker, create directly
- two or more enabled harnesses in `cli.json`: show picker

## Sidebar And Header

The sidebar owns thread list actions. The chat header owns compact/collapsed
actions. Both should respect the same harness policy and not invent separate
selection behavior.

The thread rows and kebab menus render through the portable `ThreadRail`. It receives one explicit `{workspaceId, viewId}` population, its selected visible group, and callbacks, and emits canonical row intents (open by `threadGroupId`; rename/delete/copy-link/view-markdown through `thread:action`). It requests no list and touches no store; only the active connected host solicits its population. Preserve row `aria-label`, title, keyboard, and focus behavior and the existing rail CSS variables.

Thread row clicks are passive browse actions. They should hydrate the selected
thread without warming or spawning a harness.

## Main Chat, Side Chat, And Move

Main Chat and Side Chat are presentation terms for peer members of one thread group. The current primary member renders as Main Chat; a non-primary member can render as Side Chat in a view content tab through the composable `fusion.chat-surface` path. Neither role is stored on the session.

### Current Production Hosts And Move Eligibility

Source-inspected in the development checkout during this cleanup; no runtime or Alpha check was performed. `WorkspacePanel.tsx` mounts one `useViewChatHost` through its `ViewChatShell`. `Sidebar` and `ChatArea` are sibling shell regions for that view's thread population. Changing views changes the population; collapsing the rail does not change group/session ownership. The null-view Legacy host and the former `ViewWorksurfaceDock` are no longer the production composition.

The server permits Side Chat placements in Capture, Files, Wiki, Office, Email, Issues, Agents and Browser. Capability remains distinct from a successful mounted placement. Native tab owners retain their ownership; `useSideChatRailAdapter` supplies a runtime-only root for adapterless views while a Side Chat placement is open.

`useChatSessionHost` supplies the Main-host/group/session/primary-sequence/model-selection part of Move eligibility. `ConnectedChatHeader` additionally gates active/finalizing turns, sending, pending or unknown submission and accepted execution still awaiting resolution. The renderer's enabled state is not authority. Server `moveChatToSide` validates ownership, supported view, current primary and sequence, runtime idleness and creatable model policy. Rejections do not fall back to another target. Placement delivery follows the committed transition and can fail separately without rolling it back. See [Thread Actions](../002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md).

A Side Chat renders one session in a content tab, without a left-column thread list or nested `ThreadRail`. Closing its tab closes the placement; it does not delete the session or group membership.

### Current Header Controls

`ChatSurfaceComponentMount` renders a `ChatSurface`, whose connected header renders `ChatAreaHeader`. For Side Chat the host marks threads collapsed, so the shared header still displays the left-hand `dock_to_right` / Show threads control and the right-hand `event_list` / More options control. `useChatSessionActions` currently wires Show threads to `toggleCollapsed(viewId, 'leftSidebar')`: it changes the owning view's outer sidebar, not a nested Side Chat rail. The right-hand button opens the shared portal menu, whose Show/Hide threads action invokes that same callback. The old worksurface-dock callback is no longer the current owner.

### Owner Direction: List Behavior Still To Be Defined

Owner clarification and correction on 2026-09-19: Side Chats remain individual chats without their own left-column threads. Only the right-hand list button is retained from the two list/thread controls. Side Chat tabs must not have the left-hand Show threads button or its sliding thread-panel behavior. The right-hand button’s future shared behavior will be defined later and applied to Side Chats. Current code still renders and wires the left-hand outer-sidebar toggle, so its removal remains product work. This correction does not redesign Main Chat navigation or other unrelated header actions.

### Windowed Content Is Separate From Side Chat

Chat moves into content tabs. The old floating/minimized Secondary Chat is retired as a chat presentation. Owner direction on 2026-09-19 is to retain or recover its windowed-container capability for non-chat content, including the ability to minimize to a small button and reopen the content window. This is desired product behavior, not a claim that a generic content-window host exists today.

Source and Git inspection at `88637d1` found that commit `554bedf` removed `SecondaryChat.tsx`, `SecondaryHeader.tsx`, `SecondaryDockButton.tsx`, `secondarySlice.ts`, and `secondary-tracker.ts`. The old implementation combined floating, minimized, and sticky-right modes with chat-specific state; it was not retained as a generic container. Its implementation remains recoverable from that commit's parent. The shared `useFloatingWindow.ts` drag/resize hook remains in use by `EmailComposeWindow.tsx`; together with `EmailComposeLayer.tsx` and its compose store, email provides an existing minimize/restore/expand example. The removed shell rendered an in-app overlay, not a native OS window. Content types, container/placement ownership, persistence, native OS window use, and whether sticky-right or the old animation should carry over remain undefined. Future container work must keep chat's tab placement separate from this non-chat window capability.

### Default Production Host (Owner Direction 2026-09-19)

The approved view-bound production composition is now present in source. Each view owns its thread population and group-keyed worksurface continuity. The earlier direction to retire the workspace Legacy host does not authorize this documentation cleanup to delete any chat data.

The former View Threads dock has been removed from source. Still open are the retained right-hand list button's future shared action and the non-chat window choices above. Removing the Side Chat left-hand toggle remains a separate product change.

## Input And Warm Intent

Cold threads warm on intent to send:

- input focus
- paste
- helper/composer insertion
- send fallback

The send button should freeze while acceptance is pending. The warm/connecting
indicator should be visually distinct from the in-flight turn orb.

## Composer Context Row

The composer has a compact row above the textarea:

- left: context usage block fixed at `120px`
- right: attachment strip, right-justified and allowed to use remaining width

Attachment pills come from `Send to chat` actions. They use:

- `link_2` icon
- compact labels such as `file:server.js` or `wiki:chat:architecture`
- clipped single-line text with a right-side fade
- hover-only circular `X` removal control

Attachment pills are not inserted into textarea text. Removing a pill before
send removes its metadata.

## Filename Autocomplete

Filename autocomplete is narrow and plain text only.

- Candidate sources are RAM-only open file tabs and metadata-hydrated files.
- Candidates must have an extension and must not end in `.md`.
- Ghost text can complete the current filename token.
- `Tab` or non-shift `Enter` accepts the active suggestion and inserts a trailing
  space.
- `Space` never accepts ghost text. It should let the user reject the suggestion
  and continue typing a new word.
- The ghost overlay must mirror textarea typography, wrapping, and prefix text so
  the suggestion appears at the same visual cursor location as the typed text.

Do not add inline `@` behavior, picker modals, wiki/doc/ticket suggestions, or
structured metadata from typed autocomplete.

## Orb And Turn State

The orb represents an in-flight assistant turn for the currently rendered
thread. It should not light up for another thread while the user is browsing
elsewhere.

If a background turn completes while the user is away, returning to that thread
should show the completed turn or the latest live snapshot, not restart a
delayed render from the last visible token.

## Stop

Stop should feel like CLI Escape:

- interrupt quickly
- settle currently available content
- persist the partial assistant turn
- allow follow-up prompt

The client should not discard the partial exchange or leave two user bubbles
without assistant content.

## Small UI Details

- Minor layout and spacing decisions belong here, not in runtime docs.
- Do not use in-app explanatory text to describe implementation details.
- Keep New Thread copy generic while OpenCode is the only normal-user harness.
- If multiple harnesses are enabled, picker labels come from resolved `cli.json`
  display metadata.

<!-- children:start -->
## Children

- [Chat Composer](001-Composer/PAGE.md) - Composer behavior, send/stop/finalization button states, and attachment/input rules.
- [Chat Thread Header](002-Thread_Header/PAGE.md) - Header Copy Link, Side Chat controls and the owning view’s collapsed thread rail.
- [Chat Message List](003-Message_List/PAGE.md) - Message orchestration, where completed reply chrome mounts, and how live/history renderers are composed.
- [Reply Action Chrome](004-Reply_Action_Chrome/PAGE.md) - Standing pattern for per-assistant-reply action chrome, icon order, stubs, disabled states, and fallbacks.
- [Chat Menus And Modals](005-Menus_And_Modals/PAGE.md) - Dropdown, pop-up, modal, component boundary, accessibility, and styling rules for chat UI.
- [Tool Call Rendering](006-Tool_Call_Rendering/PAGE.md) - How tool calls render inside chat messages, and the standing rule for failed tool calls.
<!-- children:end -->
