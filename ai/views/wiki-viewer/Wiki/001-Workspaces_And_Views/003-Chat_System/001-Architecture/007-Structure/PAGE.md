---
name: Chat System Structure
description: File and module map for chat system work. Use this page to find the server, client, harness, WebSocket, renderer, and state modules involved in chat.
metadata:
  incoming-edges:
    - Chat System Overview
    - Chat System Architecture
  outgoing-edges:
    - Chat System Runtime Model
    - Chat System Rendering Model
    - Chat System Protocol
    - Chat System UI Surface
  source-files:
    - fusion-studio-server/lib/thread
    - fusion-studio-server/lib/wire
    - fusion-studio-server/lib/ws
    - fusion-studio-server/lib/chat-metadata
    - fusion-studio-client/src/components/chat
    - fusion-studio-client/src/lib/chat-file-links
    - fusion-studio-client/src/lib/ws
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-client/src/state/slices/chatSlice.ts
  connected-skills: []
  related-trigger-files: []
---

Current file/module map for chat work.

## Server

| File | Role |
|---|---|
| `fusion-studio-server/lib/thread/thread-crud.js` | `thread:open`, `thread:open-assistant`, create/open policy |
| `fusion-studio-server/lib/thread/thread-runtime-controller.js` | prompt acceptance, warm/send, stop |
| `fusion-studio-server/lib/thread/thread-runtime-manager.js` | runtime state and live turn ownership |
| `fusion-studio-server/lib/thread/live-turn-snapshot.js` | in-memory live turn snapshot |
| `fusion-studio-server/lib/thread/thread-runtime-automation.js` | background automation prompt hooks |
| `fusion-studio-server/lib/thread/ThreadIndex.js` | SQLite thread metadata |
| `fusion-studio-server/lib/thread/HistoryFile.js` | SQLite exchange read/write |
| `fusion-studio-server/lib/thread/ChatFile.js` | markdown compatibility and link/view workflows |
| `fusion-studio-server/lib/chat-metadata/exchange-metadata-registry.js` | collector registration and merge behavior |
| `fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js` | turn-end metadata aggregation |
| `fusion-studio-server/lib/chat-metadata/collectors/attachments.js` | send-to-chat attachment metadata |
| `fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js` | repo-validated file mention metadata |
| `fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js` | turn-correlated file mutation metadata |
| `fusion-studio-server/lib/cli-config/*` | `cli.json` harness policy and display metadata |
| `fusion-studio-server/lib/harness/opencode/*` | OpenCode JSON run harness and translator |
| `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js` | canonical harness event bridge |
| `fusion-studio-server/lib/wire/canonical-chat-event-applier.js` | chat mutation, event bus, live snapshot, persistence handoff |
| `fusion-studio-server/lib/wire/wire-broadcaster.js` | event bus to WebSocket routing |
| `fusion-studio-server/lib/ws/client-message-router.js` | client message dispatch |
| `fusion-studio-server/lib/ws/thread-ws-handlers.js` | thread websocket handlers |

## Client

| File | Role |
|---|---|
| `fusion-studio-client/src/components/chat/useChatArea.ts` | chat handlers, send/stop state, warm intent |
| `fusion-studio-client/src/components/chat/ChatLinkAttachments.tsx` | pending send-to-chat attachment pills |
| `fusion-studio-client/src/components/ChatInput.tsx` | textarea, send key handling, filename autocomplete integration |
| `fusion-studio-client/src/hooks/useFileAutocomplete.ts` | filename autocomplete hook |
| `fusion-studio-client/src/components/chat/ChatAreaHeader.tsx` | compact header actions |
| `fusion-studio-client/src/components/Sidebar.tsx` | thread list and New Thread surface |
| `fusion-studio-client/src/components/CliPickerDropdown.tsx` | multi-harness picker when policy enables 2+ harnesses |
| `fusion-studio-client/src/components/LiveSegmentRenderer.tsx` | sequential live reveal |
| `fusion-studio-client/src/components/InstantSegmentRenderer.tsx` | completed history render |
| `fusion-studio-client/src/components/ToolCallBlock.tsx` | shared tool shell |
| `fusion-studio-client/src/lib/ws/thread-handlers.ts` | thread list/open/hydration handlers |
| `fusion-studio-client/src/lib/ws/stream-handlers.ts` | live stream event routing |
| `fusion-studio-client/src/lib/chat-action.ts` | client-side chat action event payloads |
| `fusion-studio-client/src/lib/chat-file-links/*` | attachment labels, filtering, and autocomplete matching |
| `fusion-studio-client/src/state/chatFileLinkStore.ts` | RAM-only pending attachments and autocomplete candidates |
| `fusion-studio-client/src/lib/ws/assistant-parts.ts` | assistant part reconstruction |
| `fusion-studio-client/src/state/slices/chatSlice.ts` | keyed chat state and finalization |
| `fusion-studio-client/src/config/harness.ts` | client harness metadata and fallback policy |
| `fusion-studio-client/src/lib/tool-renderers/` | per-tool presentation |
| `fusion-studio-client/src/lib/reveal/` | reveal engine |
| `fusion-studio-client/src/lib/text/` | markdown/text rendering |
| `fusion-studio-client/src/lib/timing.ts` | timing profile defaults |

## Removed Paths

- visible typing cursor
- `CURSOR_HTML`
- `injectCursor`
- `.rv-typing-cursor`
- `showCursor`
- inactive `lib/segment-renderers/`
- static chunk strategy layer
- frontend pressure gauge / instant reveal branch
- Kimi wire runtime path
