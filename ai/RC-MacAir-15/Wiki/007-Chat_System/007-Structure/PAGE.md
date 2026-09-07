---
name: Chat Structure
description: File and module map for chat system work. Use this page to find the server, client, harness, WebSocket, renderer, and state modules involved in chat.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Identity And Persistence
    - Chat Harness And Event Flow
    - Chat Rendering And Lifecycle
    - Chat UI
  source-files:
    - fusion-studio-server/lib/thread
    - fusion-studio-server/lib/wire
    - fusion-studio-server/lib/ws
    - fusion-studio-server/lib/harness/types.js
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-server/lib/chat-metadata
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/components/chat
    - fusion-studio-client/src/lib/chat-file-links
    - fusion-studio-client/src/lib/tool-renderers
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
| `fusion-studio-server/lib/thread/thread-lifecycle-controller.js` | exact workspace/thread/turn lifecycle state and idle timers |
| `fusion-studio-server/lib/thread/live-turn-snapshot.js` | in-memory live turn snapshot |
| `fusion-studio-server/lib/thread/canonical-drain-context.js` | immutable accepted route data and exact non-serializable drain control |
| `fusion-studio-server/lib/thread/turn-terminal-error.js` | fixed safe terminal-error catalog and validator |
| `fusion-studio-server/lib/thread/harness-diagnostic-service.js` | bounded dedicated diagnostic persistence, cleanup, and exact-owner retrieval |
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
| `fusion-studio-server/lib/harness/types.js` | canonical harness event field contract |
| `fusion-studio-server/lib/harness/opencode/*` | OpenCode JSON run harness and translator |
| `fusion-studio-server/lib/harness/opencode/json-event-translator.js` | OpenCode-native event/status normalization |
| `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js` | canonical harness event bridge |
| `fusion-studio-server/lib/wire/canonical-chat-event-applier.js` | chat mutation, event bus, live snapshot, persistence handoff |
| `fusion-studio-server/lib/wire/wire-broadcaster.js` | event bus to WebSocket routing |
| `fusion-studio-server/lib/ws/workspace-broadcaster.js` | exact-bound workspace and thread-lifecycle fan-out |
| `fusion-studio-server/lib/event-bus.js` | legacy bus plus bounded exact-turn asynchronous-effect drain |
| `fusion-studio-server/lib/ws/client-message-router.js` | client message dispatch |
| `fusion-studio-server/lib/ws/thread-ws-handlers.js` | thread websocket handlers |
| `fusion-studio-server/lib/ws/chat-turn-diagnostic-handlers.js` | explicit diagnostic request route and fixed unavailable response |
| `fusion-studio-server/lib/shell-bootstrap.js` | bounded one-read inherited launch-master bootstrap owner |
| `fusion-studio-server/lib/ws/shell-auth.js` | per-connection challenge, HMAC verification, and private role owner |
| `fusion-studio-server/lib/ws/shell-auth-dispatch.js` | authentication-before-initialization transport boundary |
| `fusion-studio-server/lib/ws/deferred-product-connection.js` | proof-gated product graph construction and exactly-once close cleanup |
| `fusion-studio-server/lib/ws/product-session-registry.js` | post-initialization product-recipient publication boundary |
| `fusion-studio-server/lib/ws/server-runtime-activation.js` | startup-complete barrier before per-connection product initialization |
| `fusion-studio-server/lib/ws/transport-connection-registry.js` | all-upgraded-socket lifecycle and shutdown owner, separate from product recipients |
| `fusion-studio-server/lib/ws/redaction-map.js` | recursive authentication-field and diagnostic-ingress suppression |
| `fusion-studio-server/lib/ws/privileged-thread-guard.js` | private live-role admission for current privileged thread routes and unconditional Fork denial |
| `fusion-studio-server/lib/harness/child-environment.js` | closed common plus adapter-specific environment policy for every harness/CLI child |
| `fusion-studio-server/lib/thread/thread-harness-config-policy.js` | portable public selection validation and stored Fork-state runtime sanitization |

## Client

| File | Role |
|---|---|
| `fusion-studio-client/electron/runtime-descriptor.cjs` | immutable launch-generation endpoint descriptor |
| `fusion-studio-client/electron/shell-protocol.cjs` | exact `fusion-shell://app` asset and CSP owner |
| `fusion-studio-client/electron/shell-navigation-policy.cjs` | main/subframe/popup shell-origin boundary |
| `fusion-studio-client/electron/runtime-ipc.cjs` | current-main-frame-only descriptor IPC |
| `fusion-studio-client/electron/shell-launch-authority.cjs` | per-launch master, generation, and one-use proof signer |
| `fusion-studio-client/electron/shell-proof-ipc.cjs` | guarded current-main-frame signing IPC |
| `fusion-studio-client/src/lib/runtime-transport.ts` | validated renderer endpoint, socket, HTTP/resource, and generation-cancellation owner |
| `fusion-studio-client/src/lib/shell-auth-client.ts` | transient renderer challenge/proof handshake and pre-auth initialization buffer |
| `fusion-studio-client/src/components/chat/useChatArea.ts` | chat handlers, send/stop state, warm intent |
| `fusion-studio-client/src/components/chat/ChatLinkAttachments.tsx` | pending send-to-chat attachment pills |
| `fusion-studio-client/src/components/ChatInput.tsx` | textarea, send key handling, filename autocomplete acceptance |
| `fusion-studio-client/src/components/ChatArea.css` | chat layout plus autocomplete ghost overlay geometry |
| `fusion-studio-client/src/hooks/useFileAutocomplete.ts` | filename autocomplete hook |
| `fusion-studio-client/src/components/chat/ChatAreaHeader.tsx` | compact header actions |
| `fusion-studio-client/src/components/Sidebar.tsx` | thread list and New Thread surface |
| `fusion-studio-client/src/components/CliPickerDropdown.tsx` | multi-harness picker when policy enables 2+ harnesses |
| `fusion-studio-client/src/components/LiveSegmentRenderer.tsx` | sequential live reveal |
| `fusion-studio-client/src/components/chat/WorkingActivity.tsx` | transient elapsed Working presentation and stable accessibility status |
| `fusion-studio-client/src/components/chat/ChatTurnError.tsx` | one safe turn-terminal error row |
| `fusion-studio-client/src/components/chat/ChatDiagnosticDetails.tsx` | explicit View/Copy/Ask AI diagnostic controls |
| `fusion-studio-client/src/components/InstantSegmentRenderer.tsx` | completed history render |
| `fusion-studio-client/src/components/ToolCallBlock.tsx` | shared tool shell |
| `fusion-studio-client/src/lib/ws/thread-handlers.ts` | thread list/open/hydration handlers |
| `fusion-studio-client/src/lib/ws/stream-handlers.ts` | live stream event routing |
| `fusion-studio-client/src/lib/ws/activity-stream-handler.ts` | seen-ledger/revision-gated Working transitions and snapshot restoration |
| `fusion-studio-client/src/lib/ws/frontier.ts` | per-thread/turn snapshot/live stream frontier |
| `fusion-studio-client/src/lib/ws/chat-diagnostic-handlers.ts` | explicit diagnostic request registry and exact-route response validation |
| `fusion-studio-client/src/lib/chat-action.ts` | client-side chat action event payloads |
| `fusion-studio-client/src/lib/chat-file-links/*` | attachment labels, filtering, and autocomplete matching |
| `fusion-studio-client/src/state/chatFileLinkStore.ts` | RAM-only pending attachments and autocomplete candidates |
| `fusion-studio-client/src/state/chatComposerDraftStore.ts` | workspace/thread-owned composer drafts |
| `fusion-studio-client/src/lib/ws/assistant-parts.ts` | assistant part reconstruction |
| `fusion-studio-client/src/lib/ws/tool-result-helpers.ts` | live tool result normalization for frontend segments |
| `fusion-studio-client/src/state/slices/chatSlice.ts` | keyed chat state and finalization |
| `fusion-studio-client/src/config/harness.ts` | client harness metadata and fallback policy |
| `fusion-studio-client/src/lib/tool-renderers/` | per-tool presentation |
| `fusion-studio-client/src/lib/tool-renderers/shell.ts` | shell command/output/status dropdown presentation |
| `fusion-studio-client/src/lib/catalog-visual.ts` | tool chrome icon/color/error visual definitions |
| `fusion-studio-client/src/components/ToolsPanel.css` | shared tool block and shell output/status styling |
| `fusion-studio-client/src/lib/reveal/` | reveal engine |
| `fusion-studio-client/src/lib/text/` | markdown/text rendering |
| `fusion-studio-client/src/lib/timing.ts` | timing profile defaults |

`fusion-studio-server/lib/startup-loopback.js` validates the exact listener
host/port boundary. `fusion-studio-server/lib/http/shell-cors.js` is the sole
HTTP CORS grant for the shell origin. Connection authentication is separate
from both, and no authentication owner publishes a fact.

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
