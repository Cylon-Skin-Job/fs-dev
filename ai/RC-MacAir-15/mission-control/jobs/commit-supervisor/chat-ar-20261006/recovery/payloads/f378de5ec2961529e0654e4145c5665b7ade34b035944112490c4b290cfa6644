---
name: Events And Ledger Structure
description: File and module map for event bus, ledger, watcher, resource sync, metadata collectors, and future versioning work.
metadata:
  incoming-edges:
    - Events And Ledger
  outgoing-edges:
    - Events Universal Event Bus
    - Events Resource Events And Render Sync
    - Events Ledger Schema
  source-files:
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/lib/ledger
    - fusion-studio-server/lib/watch
    - fusion-studio-server/lib/chat-metadata
    - fusion-studio-client/src/lib/ws
    - fusion-studio-client/src/state/fileDataStore.ts
  connected-skills: []
  related-trigger-files: []
---

Current file/module map for events, resource sync, provenance, and ledger work.

## Server

| File | Role |
|---|---|
| `fusion-studio-server/lib/event-bus.js` | Universal Event Bus pub/sub. |
| `fusion-studio-server/lib/watch/core.js` | Central chokidar watcher manager. |
| `fusion-studio-server/lib/watch/workspace-watcher.js` | Workspace filesystem observation and UEB file-change emission. |
| `fusion-studio-server/lib/ledger/event-ledger-subscriber.js` | Durable event ledger subscriber. |
| `fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js` | Chat turn file mutation metadata collection. |
| `fusion-studio-server/lib/ws/workspace-request-handlers.js` | File move/rename/delete command paths that need canonical resource event emission. |
| `fusion-studio-server/lib/file-explorer.js` | File create/save paths and legacy file change emission. |

## Client

| File | Role |
|---|---|
| `fusion-studio-client/src/lib/ws/file-handlers.ts` | Current file WebSocket response and change handling. |
| `fusion-studio-client/src/state/fileDataStore.ts` | Central file tree/content cache and invalidation state. |
| `fusion-studio-client/src/components/wiki/WikiExplorer.tsx` | Current private Wiki tree/content loading path. |
| `fusion-studio-client/src/state/wikiStore.ts` | Wiki selection, content, history, and view state. |
| `fusion-studio-client/src/hooks/usePanelData.ts` | Generic per-view WebSocket data hook targeted for migration. |
