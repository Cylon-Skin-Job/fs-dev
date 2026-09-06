# Current Code Inventory

## Server Event and Startup Paths

| Path | Current role | Constraint for roadmap |
|---|---|---|
| `fusion-studio-server/lib/event-bus.js` | Singleton EventEmitter with `emit`, `on`, loop depth, and safe listener invocation | Extend; do not replace |
| `fusion-studio-server/lib/startup.js` | Starts DB, direct subscribers, broadcasters, workspace controller, watcher, triggers, and cron | Registry/controller must start after DB and before new facts can emit |
| `fusion-studio-server/lib/triggers/trigger-loader.js` | Scans `TRIGGERS.md`; directly registers bus listeners; returns file filters and cron entries | Remains explicit compatibility debt; do not wrap editable definitions in a system-granted adapter |
| `fusion-studio-server/lib/watch/workspace-watcher.js` | Project chokidar observation, trigger filter execution, `file:changed` emission | Existing compatibility only; not MVP provenance authority |
| `fusion-studio-server/lib/watch/core.js` | Central chokidar instances by path | No new watcher |

## Server File Mutation Paths

| Path | Current role | Gap |
|---|---|---|
| `fusion-studio-server/lib/file-explorer.js` | tree/content requests; save; folder/document create | SPEC-03 converts save only; create routes remain compatibility |
| `fusion-studio-server/lib/ws/workspace-request-handlers.js` | move/rename/delete and direct `file_changed` broadcast | Remains compatibility until a later multi-resource SPEC |
| `fusion-studio-server/lib/ws/client-message-router.js` | routes file requests and mutations | Must delegate in-scope commands through the new controller |
| `fusion-studio-server/lib/ws/redaction-map.js` | Builds the log-safe copy of inbound WebSocket messages | Add `file_save.content` redaction before generic serialization while preserving original handler input |
| `fusion-studio-server/lib/views/panel-paths.js` and `lib/views/index.js` | Resolve workspace/panel roots; current session `rootFolder` can be client-supplied, and different panels can alias the same physical file | Derive the active workspace root from the server registry, convert aliases to one canonical workspace-relative path, and never treat `set_panel.rootFolder` as mutation authority |
| `fusion-studio-server/lib/file-ops.js` | move-with-archive primitive | May remain a bounded filesystem primitive behind the controller |

Other server write paths exist (themes, view state, tickets, wiki audit, sync, screenshots, workspace bootstrap, Office palette). They are outside this MVP unless required by a listed SPEC and must not be claimed migrated.

## Current Ledger and Database

| Path | Current role | Gap |
|---|---|---|
| `fusion-studio-server/lib/db.js` | Knex/better-sqlite3 singleton; runs migrations | Use migrations; temp `FUSION_APP_USER_DATA` isolates runtime tests |
| `fusion-studio-server/lib/db/migrations/029_event_ledger.js` | `event_log`, `event_resource_edges`, `event_tags` | Evolve rather than replace; add operation/version/origin/query support |
| `fusion-studio-server/lib/ledger/event-ledger.js` | Stores three event types with sanitized JSON | Replace whitelist with registered MVP event subscriber behavior |
| `fusion-studio-server/lib/ledger/event-ledger-subscriber.js` | Direct `on('*')` listener | Migrate behind subscription controller |
| `fusion-studio-server/test/ledger/event-ledger.test.js` | Existing ledger behavior | Preserve legacy row/query compatibility where applicable |

## Renderer Resource Paths

| Path | Current role | Gap |
|---|---|---|
| `fusion-studio-client/src/state/fileDataStore.ts` | Central panel/path tree/content cache, request correlation, dirty state, save state, invalidation/refetch | Extend the read-only File Viewer key for typed projections/recovery; do not use MVP projection to adopt Office/Email dirty buffers |
| `fusion-studio-client/src/lib/ws/file-handlers.ts` | Central WS file message handler | Handles `file_changed`, but only when panel/path exist |
| `fusion-studio-client/src/lib/ws-client.ts` | One renderer WebSocket and centralized message routing | Reuse for `resource:changed` |
| `fusion-studio-client/src/state/fileStore.ts` | File Viewer tabs plus separate tree/content state | Retain tab/navigation identity only; remove resource-data ownership |
| `fusion-studio-client/src/hooks/useFileTree.ts` | File Viewer component-owned WS listener | Remove after cutover |
| `fusion-studio-client/src/lib/file-tree.ts` | Sends requests and writes `fileStore` | Adapt to central file-data actions or retire |
| `fusion-studio-client/src/components/file-explorer/FileExplorer.tsx` | Mounts private listener and renders tree/viewer | Subscribe to central state instead |
| `fusion-studio-client/src/components/file-explorer/FileViewer.tsx` | Renders active tab's stored content | Select central content by panel/path |
| `fusion-studio-client/src/state/activeResourceStore.ts` | Secondary active-resource hint | Fold into selectors or keep only if it has a distinct non-cache responsibility |

## Existing Verification

- Server: `npm test` in `fusion-studio-server`.
- Client: `npm run build` in `fusion-studio-client`.
- Existing file-viewer Playwright files are mostly source/store contract tests; SPEC-04 must add an isolated live server/browser proof.
- `fusion-studio-server/test/ws/workspace-folder-mutations.test.js` covers current folder mutation responses.
- `fusion-studio-server/test/watch/workspace-watcher.test.js` covers watcher behavior and must not be repurposed as mediated mutation proof.

## Dirty Worktree Exclusions At Planning Time

The following pre-existing files were outside the planning bundle and must remain untouched by roadmap preparation and future packet assembly unless a SPEC explicitly needs them:

- `ai/RC-MacAir-15/System/state/state.json`
- `ai/RC-MacAir-15/System/styles/themes.css`
- `ai/RC-MacAir-15/System/styles/themes.json`
- `ai/RC-MacAir-15/Views/001-capture-viewer/state/state.json`
- `ai/RC-MacAir-15/Views/002-file-viewer/state/state.json`
