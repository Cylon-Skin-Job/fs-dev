---
name: Chat Decisions
description: Durable decisions for Fusion Studio chat. Use this page before changing harness policy, runtime ownership, prompt acceptance, stop behavior, metadata, or thinking display.
metadata:
  last-modified: "2026-09-19T10:34:31Z"
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Identity And Persistence
    - Chat Harness And Event Flow
    - Chat Rendering And Lifecycle
    - Chat Lessons
  source-files:
    - fusion-studio-server/lib/thread/chatlog-mirror.js
    - fusion-studio-server/lib/thread/session-lifecycle.js
    - fusion-studio-server/lib/thread/ThreadManager.js
    - fusion-studio-server/lib/cli-config/resolver.js
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/harness/opencode/index.js
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-server/lib/harness/types.js
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/lib/tool-renderers/index.ts
    - fusion-studio-client/src/lib/tool-renderers/shared/error-display.ts
    - fusion-studio-client/src/lib/tool-renderers/shell.ts
    - fusion-studio-client/src/lib/catalog-visual.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-server/lib/thread/thread-crud.js
    - fusion-studio-server/lib/thread/thread-harness-config-policy.js
    - fusion-studio-server/lib/ws/thread-ws-handlers.js
  connected-skills: []
  related-trigger-files: []
---

Durable architectural decisions for chat.

## 2026-09-19 — Side Chat Tabs And Non-Chat Windows

**Authority:** explicit owner clarification. **Implementation status:** mixed; see the [Chat UI current behavior and remaining work](../../004-Chat_UI/PAGE.md#main-chat-side-chat-and-move).

- Moving Main Chat to Side Chat places that session in a content tab. Side Chats do not acquire their own left-column thread list.
- Owner correction: only the right-hand list button remains in Side Chat tabs. The left-hand Show threads control and the sliding thread-panel behavior are absent from the intended tab experience. In current code these are distinct controls: right-hand `event_list` (labeled More options) and left-hand `dock_to_right` (labeled Show threads). The right-hand button’s future shared behavior will be defined later. Current code still exposes the left-hand toggle; removing it for Side Chat tabs is remaining product work.
- The former floating/minimized chat presentation must not return as a chat mode. Chat tabs are the new paradigm.
- Preserve or recover the windowed-container capability for non-chat content, including minimizing to a small button and reopening the window. The former chat shell was deleted; only shared window mechanics and the email compose example remain in active code. A reusable content container is remaining work.

This clarification changes the intended future list-button contract and separates reusable window behavior from the retired Secondary Chat feature. It does not define new button behavior, choose content types, persistence, placement ownership, native OS windows, sticky-right behavior or animation, or imply that the remaining work has been implemented. The deleted shell was an in-app overlay; it does not establish an OS-native window requirement. Whether view-bound chat replaces the current normal Legacy workspace host was left unresolved here; the owner resolved it in the decision below. See the [current production host map](../../004-Chat_UI/PAGE.md#current-production-hosts-and-move-eligibility) before treating the tab direction as a completed default-host migration.

## 2026-09-19 — View-Bound Chat Is The Default Production Host

**Authority:** explicit owner direction. **Implementation status:** target; production currently still mounts the Legacy workspace host.

View-bound chat becomes the default production experience: each view's chat column shows that view's own thread population with its side chats and group-keyed worksurface tabs, the same set whether the View Threads dock is open or closed, and a different set for a different view. The workspace Legacy host (`viewId: null`) retires as the production composition. Existing `view_id NULL` groups are not carried forward — local chat data is wiped rather than migrated. The View Threads dock is no longer required as the entry point; its disposition and the retained right-hand list-button contract remain open.

## Visible Threads And Chat Sessions Have Separate Identities

The visible Thread is a durable body of work, internally a Thread Group. It owns its title, immutable workspace/view binding, membership, primary selection, and visible ordering. Rename/Delete target this group; prompt/Stop and live events target an exact chat session by `threadId`. Main Chat and Side Chat are presentations of peer sessions, not separate conversation types.

Move preserves the existing session and creates an empty Main peer without copying conversation context. Closing a Side Chat tab changes its durable placement, not the session or membership. View content continuity is group-keyed in the owning view capsule; `viewId: null` is the separate Legacy population with no view worksurface. Mounted `surfaceId` is transient and never session authority. See [Thread Identity](../../001-Identity_And_Persistence/001-Thread_Identity/PAGE.md) for the identity map.

## `cli.json` Is Harness Policy

`ai/<machine>/System/config/cli.json` controls default, allowed, and displayed harnesses.
Do not add a separate `harness-policy.json`.

## OpenCode Is The Current Normal-User Harness

The current config is OpenCode-only. New Thread creates OpenCode directly. Kimi
remains as implementation/plugin reference, but it is not displayed or allowed
for new thread creation unless `cli.json` is changed.

## Passive Browse Is Separate From Activation

Use `thread:open` for passive hydration of the visible group's current primary, and trusted `thread:open-assistant` for assistant activation and new creation. A list selects one workspace/view population; null or omitted view means Legacy and never the active view. Existing-session compatibility open currently hydrates the primary even when a different validated member was supplied, so it must not be treated as exact Side Chat access.

New Chat currently commits a session and one-member group eagerly, with explicit view binding or null-view Legacy binding, before provider readiness. Pending New Chat/provider-signal-gated commit is deferred. Unknown explicit group and foreign session targets fail, while an unknown session-only ID can still create a new group/session; this source-observed fallback conflicts with the intended no-replacement rule for explicit unknown targets and is a product follow-up. See the [Runtime creation contract](../../006-Runtime_Model/PAGE.md#new-thread-and-activation) for the complete current branches, separately from future intent.

## Backend Lifecycle Ownership — September 24, 2026

Approved CHAT-AR SPEC-05 assigns workspace-qualified delegation to ThreadManager,
session policy to SessionLifecycle, group transaction/lease lifetimes to group
owners, disposable projection recovery to ChatlogMirror, and exact runtime state
to the existing ThreadRuntimeManager. Prompt receipts, completed exchanges and
file-backed worksurfaces keep their separate durable owners. This is an
implementation ownership change preserving eager creation, passive open,
server-owned acceptance/Stop and existing Main/Side identities; it is not a
provider rewrite or a new data-retention policy.

## Server Owns Prompt Acceptance

The server accepts a prompt through runtime readiness and emits `message:sent`.
The client commits the user bubble after acceptance.

## `Send to chat` Is Attachment Metadata

`Send to chat` creates removable link attachment pills, not raw textarea path
text. The prompt can carry structured attachment metadata, and the harness sees
a compact attached-reference block.

Copy path/link controls remain separate and continue to copy paths.

## Filename Autocomplete Is Plain Text

Filename autocomplete inserts plain filename text only. It never creates an
attachment, mention object, or hidden metadata.

Autocomplete candidates are RAM-only and limited to files with extensions that
do not end in `.md`.

Autocomplete acceptance is explicit: `Tab` and non-shift `Enter` accept the
ghost suggestion. `Space` does not accept it, because space is needed to reject
the suggestion and keep typing a new word.

## Harness Adapters Normalize Tool Status

Provider-native status fields must be normalized in the harness adapter before
they reach the universal backend interpreter. `statusMessage` means optional
displayable diagnostic/status text; it is not a command label or raw provider
title.

For OpenCode shell calls, nonzero `metadata.exit` drives `isError`. If
`state.title` duplicates the shell command, the OpenCode adapter suppresses it
instead of letting the UI render the command twice.

## Tool Error Chrome Stays Neutral

Tool failures should not turn collapsed tool chrome into red error badges. Keep
the normal tool icon/label and render the failure inside the expanded dropdown.

`ToolCallBlock` does not receive `isError`; `lib/tool-renderers/index.ts` wraps
all tool renderers with the shared error formatter. Tool-specific context such
as command, file path, pattern, query, URL, or agent type belongs in the shared
error context catalog, not in one-off renderer branches.

## Exchange Metadata Is Collector-Based

`exchanges.metadata` stores turn metadata such as `attachments`, `mentions`, and
`fileMutations`. New extraction work should be added as a chat metadata
collector instead of growing runtime, audit, or persistence modules into a
monolith.

## Server Owns Stop

Stop emits a synthetic interrupted terminal event server-side and persists the
partial assistant turn through the normal persistence path.

## Live Snapshot Bridges Active Turns

Switching threads or workspaces should not stall a live turn. The server keeps
an in-memory `liveTurn` snapshot that the client overlays on durable history.

## Do Not Fake Thinking

Visible thinking requires actual thinking text. `tokens.reasoning` is usage
metadata, not a thought trace.

## OpenCode Clean Exit Can Synthesize Completion

If OpenCode exits code `0` after useful output but without `step_finish`, the
harness synthesizes `turn_end` and marks `terminalSource`.

## Existing Threads Are Not Migrated By Policy

Changing `cli.json` affects new thread creation and UI selection. It does not
rewrite existing `harness_id` values.
