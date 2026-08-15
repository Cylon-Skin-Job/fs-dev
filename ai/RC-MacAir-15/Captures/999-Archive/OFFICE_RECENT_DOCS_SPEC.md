# Office Recent Documents Spec

## 1. Overview

Replace the sibling ribbon in `OfficeDocumentPage` with a **Recently Opened Documents** panel. The panel slides out from the right, lists up to 20 recently opened markdown files across all office-viewer folders, and allows fast navigation between them. Previews are fetched on demand and cached client-side for instant re-opens.

**Scope:** Office-viewer panel only. Non-markdown files in office-viewer open in `FilePageView` and are **not** tracked in recent docs. Other panels (file-viewer, wiki-viewer, etc.) are unaffected.

---

## 2. Goals

- Preserve recently opened docs in SQLite with 20-item FIFO per workspace.
- Enable instant switching between recent docs via the existing `fileDataStore.contents` cache.
- Support "glance browsing" — clicking a recent doc opens it immediately, but the item only moves to the top of the list after a 3-second confirmation delay.
- Replace the sibling ribbon entirely in the document editor view.

---

## 3. Non-Goals

- Cross-panel recent files (e.g. file-viewer or wiki-viewer docs).
- Cross-workspace recent files (symlinks are the user-managed bridge).
- Full-text search across recent docs.
- Preview persistence in the database (only metadata is stored).
- Tracking non-markdown files opened via `FilePageView`.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (Renderer)                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ recentDocsStore │  │ fileDataStore   │  │ OfficeGrid  │  │
│  │  - recentDocs[] │  │  - contents{}   │  │             │  │
│  │  - highlighted  │  │  (single cache) │  │             │  │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘  │
│           │                    │                   │         │
│           └────────────────────┼───────────────────┘         │
│                                │                             │
│                                ▼                             │
│                         WebSocket                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Server (Node.js)                                           │
│  ┌────────────────────────┐  ┌────────────────────────────┐  │
│  │ client-message-router  │──│ recent-docs/handlers.js    │  │
│  │  routes recent_docs:*  │  │  - list                    │  │
│  └────────────────────────┘  │  - record                  │  │
│                              │  - clear                   │  │
│                              └────────────┬───────────────┘  │
│                                           │                  │
│                              ┌────────────▼───────────────┐  │
│                              │ recent-docs/index-table.js │  │
│                              │  - list()                  │  │
│                              │  - record()                │  │
│                              │  - clear()                 │  │
│                              └────────────┬───────────────┘  │
│                                           │                  │
│                              ┌────────────▼───────────────┐  │
│                              │ SQLite: fusion.db          │  │
│                              │  Table: recent_docs        │  │
│                              └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**One-cache rule:** `fileDataStore.contents` is the single source of truth for file content. `recentDocsStore` does **not** duplicate this cache. Recent tiles read preview content from `fileDataStore.contents[cacheKey]`; they request content via `fileDataStore.requestContent()` if missing.

---

## 5. Database Schema

### Migration: `021_recent_docs.js`

```js
/**
 * Migration 021 — Recently opened documents tracker
 *
 * Adds: recent_docs table for office-viewer document history
 */

exports.up = async function (knex) {
  await knex.schema.createTable('recent_docs', (t) => {
    t.increments('id').primary();
    t.text('workspace_id').notNullable();
    t.text('file_path').notNullable();
    t.text('folder').notNullable();
    t.text('name').notNullable();
    t.text('panel').notNullable();
    t.integer('opened_at').notNullable();

    t.index(['workspace_id', 'opened_at']);
    t.unique(['workspace_id', 'file_path']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('recent_docs');
};
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `workspace_id` | TEXT | Active workspace identifier |
| `file_path` | TEXT | Relative to office-viewer/content/ (e.g. `todo/README.md`) |
| `folder` | TEXT | Parent folder (e.g. `todo`) |
| `name` | TEXT | Filename (e.g. `README.md`) |
| `panel` | TEXT | Always `'office-viewer'` for now |
| `opened_at` | INTEGER | Unix timestamp (ms) — MRU sort key |

### FIFO 20 Enforcement

On every `record()` call, upsert then prune in a single transaction:

```js
async function record(workspaceId, filePath, folder, name, panel, openedAt) {
  const db = getDb();
  await db.transaction(async (trx) => {
    await trx('recent_docs')
      .insert({ workspace_id: workspaceId, file_path: filePath, folder, name, panel, opened_at: openedAt })
      .onConflict(['workspace_id', 'file_path'])
      .merge(['opened_at']);

    // Prune to 20 most recent
    const rowsToKeep = await trx('recent_docs')
      .select('id')
      .where({ workspace_id: workspaceId })
      .orderBy('opened_at', 'desc')
      .limit(20);

    const keepIds = rowsToKeep.map((r) => r.id);
    if (keepIds.length > 0) {
      await trx('recent_docs')
        .where({ workspace_id: workspaceId })
        .whereNotIn('id', keepIds)
        .del();
    }
  });
}
```

> **Why not raw SQL?** Project convention uses Knex fluent API (see `009_workspace_registry.js`, `harness-status-service.js`). Raw `ON CONFLICT` SQL works but breaks consistency.

> **Why a transaction?** Prevents a race where two concurrent `record()` calls both see ≤20 rows and both insert, briefly exceeding the limit.

---

## 6. WebSocket Protocol

### Client → Server

```ts
// Fetch recent docs list
{
  type: 'recent_docs:list',
  workspaceId: string,
  limit?: number        // default 20
}

// Record a file as opened (sent immediately from folder grid)
{
  type: 'recent_docs:record',
  workspaceId: string,
  panel: string,        // 'office-viewer'
  path: string,         // relative path
  folder: string,
  name: string
}

// Clear all recent docs for workspace
{
  type: 'recent_docs:clear',
  workspaceId: string
}
```

### Server → Client

```ts
// List response
{
  type: 'recent_docs:list',
  workspaceId: string,
  items: RecentDoc[],
  total: number
}

// Record confirmation + updated list (broadcast to all clients)
{
  type: 'recent_docs:updated',
  workspaceId: string,
  items: RecentDoc[],
  total: number
}

// Clear confirmation (broadcast to all clients)
{
  type: 'recent_docs:cleared',
  workspaceId: string
}

// Error response
{
  type: 'recent_docs:error',
  workspaceId: string,
  error: string
}
```

---

## 7. Client State Model

### `recentDocsStore.ts` (Zustand)

```ts
interface RecentDoc {
  id: number;
  workspaceId: string;
  path: string;
  folder: string;
  name: string;
  panel: string;
  openedAt: number;
}

interface RecentDocsState {
  recentDocs: RecentDoc[];
  highlightedPath: string | null;   // transient UI state for 3s delay

  setRecentDocs: (items: RecentDoc[]) => void;
  recordOpen: (doc: Pick<RecentDoc, 'workspaceId' | 'path' | 'folder' | 'name' | 'panel'>) => void;
  previewSelect: (path: string) => void;
  cancelPreviewSelect: () => void;
  loadRecentDocs: (workspaceId: string) => void;
}
```

### 3-Second Delay Logic

Timer state lives **inside the `create()` closure**, not at module scope (HMR-safe, reset-safe):

```ts
export const useRecentDocsStore = create<RecentDocsState>((set, get) => {
  let promoteTimer: ReturnType<typeof setTimeout> | null = null;
  let promoteTarget: string | null = null;

  return {
    recentDocs: [],
    highlightedPath: null,

    setRecentDocs: (items) => set({ recentDocs: items }),

    recordOpen: ({ workspaceId, path, folder, name, panel }) => {
      // Immediate — used by folder-grid clicks
      sendFusionMessage({ type: 'recent_docs:record', workspaceId, panel, path, folder, name });
    },

    previewSelect: (path) => {
      set({ highlightedPath: path });
      if (promoteTimer) clearTimeout(promoteTimer);
      promoteTarget = path;
      promoteTimer = setTimeout(() => {
        if (promoteTarget === path) {
          const doc = get().recentDocs.find((d) => d.path === path);
          if (doc) {
            sendFusionMessage({
              type: 'recent_docs:record',
              workspaceId: doc.workspaceId,
              panel: doc.panel,
              path: doc.path,
              folder: doc.folder,
              name: doc.name,
            });
          }
          set({ highlightedPath: null });
          promoteTarget = null;
        }
      }, 3000);
    },

    cancelPreviewSelect: () => {
      if (promoteTimer) clearTimeout(promoteTimer);
      promoteTimer = null;
      promoteTarget = null;
      set({ highlightedPath: null });
    },

    loadRecentDocs: (workspaceId) => {
      sendFusionMessage({ type: 'recent_docs:list', workspaceId });
    },
  };
});
```

> **Gotcha:** Module-level `let promoteTimer` would leak across HMR and store resets. The closure pattern matches how `fileDataStore` encapsulates `sendWs`.

### Preview Content — No Duplicate Cache

Recent tiles read preview content from `fileDataStore.contents[cacheKey(panel, path)]`.

When `recentDocsStore` receives a list:
1. For each item, check `fileDataStore.contents[cacheKey]`
2. **Hit** → tile renders immediately
3. **Miss** → call `fileDataStore.requestContent(panel, path)`
4. Tile re-renders automatically when `fileDataStore` populates `contents`

When workspace switches → `recentDocsStore.setRecentDocs([])` and `fileDataStore.clearAll()` already handles cache dumping.

---

## 8. UI Behavior

### Side Panel: "Recently Opened"

The `filter_none` side panel is repurposed. It now shows:
- A scrollable list of `OfficeDocumentTile` components
- Tiles are centered horizontally (already implemented)
- Each tile shows the light-page preview matching the editor (already implemented)
- Active tile shows `.active` border highlight + "Open" label (already implemented)
- **Highlighted** tile (3s timer running) shows `.rv-office-doc-tile--highlighted` border via CSS variable:
  ```css
  .rv-office-doc-tile--highlighted {
    border-color: var(--palette-accent, #22c55e);
  }
  ```

### Click Behaviors

| Source | Click Action | List Reorder |
|--------|-------------|--------------|
| **Folder grid** (`OfficeGrid`) | Opens file instantly | Immediate `recent_docs:record` |
| **Recent panel** | Opens file instantly | 3-second delay, then `recent_docs:record` |
| **Recent panel (second click < 3s)** | Opens new file, cancels first timer | Only second file promoted after 3s |

### Active State

The currently open file's tile is always `.active` (green border + "Open" label visible). The `highlightedPath` adds a temporary highlight to a tile that was just clicked but whose promotion timer is still running. If `highlightedPath === activePath`, the `.active` state wins visually.

---

## 9. Files to Create / Modify

### Create (5 files)

| File | Lines | Description |
|------|-------|-------------|
| `fusion-studio-server/lib/db/migrations/021_recent_docs.js` | ~25 | Create `recent_docs` table |
| `fusion-studio-server/lib/recent-docs/index-table.js` | ~60 | DB queries: list, record, clear |
| `fusion-studio-server/lib/recent-docs/handlers.js` | ~80 | WS message handlers + broadcast |
| `fusion-studio-client/src/state/recentDocsStore.ts` | ~70 | Zustand store + 3s delay logic |
| `fusion-studio-client/src/lib/ws/recent-docs-handlers.ts` | ~35 | Handle server responses |

### Modify (7 files)

| File | Change |
|------|--------|
| `fusion-studio-server/lib/startup.js` | `require('./recent-docs/handlers')`, create handlers, add to return object |
| `fusion-studio-server/server.js` | Import `createRecentDocsHandlers`, destructure from `startServer`, pass to router |
| `fusion-studio-server/lib/ws/client-message-router.js` | Add `getRecentDocsHandlers` param, route `recent_docs:*` prefix |
| `fusion-studio-client/src/types/index.ts` | Add `RecentDoc` interface, extend `WebSocketMessageType` union |
| `fusion-studio-client/src/lib/ws-client.ts` | Add `handleRecentDocsMessage(msg)` to `handleMessage()` pipeline |
| `fusion-studio-client/src/components/office/OfficeDocumentPage.tsx` | Remove `siblings`/`onSelectSibling` props; recent panel renders `recentDocsStore.recentDocs` |
| `fusion-studio-client/src/components/office/OfficeGrid.tsx` | `handleFileClick` sends `recent_docs:record` immediately for markdown files |

---

## 10. Server Wiring Details

The SPEC must not forget these three server files. They are load-bearing.

### `startup.js` — Create and return

```js
const createRecentDocsHandlers = require('./recent-docs/handlers');
// ...
const recentDocsHandlers = createRecentDocsHandlers({ getAllClients });
// ...
return { fusionHandlers, clipboardHandlers, themeHandlers, secretsHandlers, screenshotHandlers, recentDocsHandlers };
```

### `server.js` — Import and pass

```js
const createRecentDocsHandlers = require('./lib/recent-docs/handlers');
// ... (module-level mutable ref)
let recentDocsHandlers = {};
// ...
startServer({...})
  .then(result => {
    // ...
    recentDocsHandlers = result.recentDocsHandlers;
    // ...
  });
// ...
createClientMessageRouter({
  // ...
  getRecentDocsHandlers: () => recentDocsHandlers,
});
```

### `client-message-router.js` — Route

```js
function createClientMessageRouter({
  // ... existing deps ...
  getRecentDocsHandlers,
}) {
  // ...
  if (clientMsg.type.startsWith('recent_docs:')) {
    const handler = getRecentDocsHandlers()[clientMsg.type];
    if (handler) {
      await handler(ws, clientMsg);
      return;
    }
  }
}
```

> **Dependency gotcha:** `recent-docs/handlers.js` depends on `index-table.js` which depends on `db` which is initialized in `startup.js` step 1. The handlers are created in step 3, after DB init — safe.

---

## 11. Implementation Phases & Smoke Tests

### Phase 1: Server Foundation (DB + Handlers + Wiring)

**Files:** migration, `index-table.js`, `handlers.js`, `startup.js`, `server.js`, `client-message-router.js`

**Smoke Test 1.1 — Migration runs:**
```bash
cd fusion-studio-server && npx knex migrate:latest
sqlite3 data/fusion.db ".schema recent_docs"
# Expect: CREATE TABLE recent_docs (...)
```

**Smoke Test 1.2 — Handler registration:**
```bash
# Start server, watch logs for "[DB] fusion.db initialized"
# No crash on boot = wiring correct
```

**Smoke Test 1.3 — Record + List + FIFO prune:**
```js
// Via WebSocket (browser console or wscat)
socket.send(JSON.stringify({ type: 'recent_docs:list', workspaceId: 'test-ws' }));
// Expect: { type: 'recent_docs:list', items: [], total: 0 }

// Insert 22 docs
for (let i = 0; i < 22; i++) {
  socket.send(JSON.stringify({
    type: 'recent_docs:record',
    workspaceId: 'test-ws',
    panel: 'office-viewer',
    path: `doc-${i}.md`,
    folder: 'folder',
    name: `doc-${i}.md`
  }));
}

socket.send(JSON.stringify({ type: 'recent_docs:list', workspaceId: 'test-ws' }));
// Expect: total === 20, doc-0 and doc-1 absent (oldest pruned)
```

**Smoke Test 1.4 — Upsert semantics:**
```js
// Record doc-A, wait, record doc-A again
// Expect: only 1 row in DB, opened_at updated to second timestamp
```

---

### Phase 2: Client Store + WS Plumbing

**Files:** `recentDocsStore.ts`, `recent-docs-handlers.ts`, `types/index.ts`, `ws-client.ts`

**Smoke Test 2.1 — Store loads on connect:**
```
1. Open Office Viewer
2. Observe WS frame: { type: 'recent_docs:list', workspaceId: '...' }
3. recentDocsStore.recentDocs populates
```

**Smoke Test 2.2 — Folder-grid click records immediately:**
```
1. Click a markdown file in folder grid
2. Observe WS frame: { type: 'recent_docs:record', ... }
3. Observe WS frame: { type: 'recent_docs:updated', ... } with file at top
```

**Smoke Test 2.3 — Non-markdown files ignored:**
```
1. Click a `.json` file in folder grid
2. No `recent_docs:record` frame sent
```

**Smoke Test 2.4 — Workspace switch clears list:**
```
1. Switch workspace via workspace picker
2. recentDocsStore.recentDocs resets to []
3. New `recent_docs:list` frame sent for new workspace
```

---

### Phase 3: UI Integration

**Files:** `OfficeDocumentPage.tsx`, `OfficeGrid.tsx`, `OfficeDocumentPage.css` (highlight style)

**Smoke Test 3.1 — Sibling ribbon removed:**
```
1. Open a markdown file
2. Open side panel (filter_none button)
3. Expect: recent docs tiles, NOT sibling ribbon
4. No `siblings` prop warnings in console
```

**Smoke Test 3.2 — Recent tile opens file instantly:**
```
1. Open doc A
2. Open side panel, click doc B tile
3. Expect: doc B opens in editor immediately (< 200ms)
4. Expect: doc B tile gets `.active` highlight
```

**Smoke Test 3.3 — 3-second promotion delay:**
```
1. Open doc A
2. Open side panel, click doc B tile
3. Expect: doc B tile gets `.rv-office-doc-tile--highlighted`
4. Expect: list order unchanged for 3 seconds
5. Wait 3s
6. Expect: doc B moves to top of list, highlight removed
```

**Smoke Test 3.4 — Rapid click cancels first timer:**
```
1. Open doc A
2. Click doc B (timer starts)
3. Within 2s, click doc C
4. Expect: doc B never promoted
5. Wait 3s from doc C click
6. Expect: doc C promoted to top
```

**Smoke Test 3.5 — Preview renders from warm cache:**
```
1. Open doc A (content cached in fileDataStore)
2. Open side panel
3. Expect: doc A tile shows preview immediately, no spinner
```

**Smoke Test 3.6 — Deleted file graceful handling:**
```
1. Open doc A, close panel
2. Delete doc A from filesystem
3. Open side panel, click doc A tile
4. Expect: file opens with empty/ENOENT state, toast shows "File no longer exists"
```

---

## 12. Edge Cases

### File Deleted
- Recent doc entry remains in DB until pruned by FIFO
- Clicking a deleted file: `file_content_request` returns `ENOENT`
- UI shows toast: "File no longer exists"
- Client does **not** auto-delete from recent docs (FIFO handles it naturally)

### File Renamed
- Old path in recent docs becomes stale
- Next `record` with new path inserts a new row
- Old row stays until FIFO eviction
- **Future enhancement:** server file watcher could update paths, out of scope

### Workspace Switch
- `recentDocsStore.setRecentDocs([])` resets list
- `fileDataStore.clearAll()` dumps content cache (already happens on reconnect)
- New workspace's recent list fetched on first panel open

### Rapid Clicking (< 3s between clicks)
- Only the last-clicked file gets promoted
- Previous timers are cancelled
- All clicked files open instantly in the editor

### 20+ Unique Files Opened
- Oldest entries are silently pruned by the server transaction
- Client receives the trimmed list on `recent_docs:updated`

### HMR / Dev Reload
- Timer state lives in `create()` closure — safe across Zustand resets
- Module-level `sendFusionMessage` is stateless — safe

---

## 13. Future Enhancements (Out of Scope)

- Pinning favorites to the top of the recent list
- Full-text search across recent docs
- Cross-workspace recent files via symlinks
- Storing preview snippets in DB for faster cold starts
- Grouping by folder in the recent panel
- Auto-cleanup of stale (deleted) paths via file watcher
