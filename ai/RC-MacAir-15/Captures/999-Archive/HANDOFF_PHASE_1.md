# Phase 1 Handoff: Server Foundation for Recent Docs

## Project Context

- **Project root**: `/Users/rccurtrightjr./projects/fs-dev`
- **Server**: `fusion-studio-server/` (Node.js, Express, WebSocket on port 3001)
- **Database**: SQLite at `fusion-studio-server/data/fusion.db`, accessed via Knex + better-sqlite3
- **Migrations**: `fusion-studio-server/lib/db/migrations/` — zero-padded sequential JS files
- **Migration numbering**: `001`–`020` used (018 is missing). **Next is `021`**.
- **Server startup**: `lib/startup.js` bootstraps DB, handlers, then returns them to `server.js`
- **WS routing**: `lib/ws/client-message-router.js` receives per-connection `getXHandlers` closures and routes by `msg.type.startsWith('prefix:')`
- **Pattern to follow**: `lib/secrets/clipboard/` — `index-table.js` (DB layer) + `handlers.js` (WS map) + `handlers.test.js` (Jest)

## Phase 1 Scope

Create the database table, the DB access layer, the WebSocket handlers, and wire them into the server bootstrap. **No client code in Phase 1.**

---

## Files to Create (3)

### 1. Migration: `fusion-studio-server/lib/db/migrations/021_recent_docs.js`

```js
/**
 * Migration 021 — Recently opened documents tracker
 *
 * Adds: recent_docs table for office-viewer document history.
 * FIFO 20 per workspace, enforced in application code (index-table.js).
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

### 2. DB Layer: `fusion-studio-server/lib/recent-docs/index-table.js`

```js
/**
 * recent_docs CRUD — Knex data access for the recent documents table.
 *
 * One job: read and write recent_docs rows. No WS logic, no validation beyond schema.
 *
 * Schema lives in migration 021_recent_docs. Columns:
 *   id, workspace_id, file_path, folder, name, panel, opened_at
 */

'use strict';

const { getDb } = require('../db');

const TABLE = 'recent_docs';
const COLUMNS = ['id', 'workspace_id', 'file_path', 'folder', 'name', 'panel', 'opened_at'];

/**
 * List recent docs for a workspace, ordered by most recently opened first.
 * @param {string} workspaceId
 * @param {number} [limit=20]
 * @returns {Promise<{ items: object[], total: number }>}
 */
async function list(workspaceId, limit = 20) {
  const items = await getDb()(TABLE)
    .select(COLUMNS)
    .where({ workspace_id: workspaceId })
    .orderBy('opened_at', 'desc')
    .limit(limit);

  const totalRow = await getDb()(TABLE)
    .where({ workspace_id: workspaceId })
    .count('* as count')
    .first();

  return { items, total: totalRow ? Number(totalRow.count) : 0 };
}

/**
 * Record (upsert) a file as opened, then prune to FIFO limit.
 * @param {string} workspaceId
 * @param {string} filePath
 * @param {string} folder
 * @param {string} name
 * @param {string} panel
 * @param {number} openedAt — Unix timestamp in ms
 */
async function record(workspaceId, filePath, folder, name, panel, openedAt) {
  const db = getDb();
  await db.transaction(async (trx) => {
    await trx(TABLE)
      .insert({
        workspace_id: workspaceId,
        file_path: filePath,
        folder,
        name,
        panel,
        opened_at: openedAt,
      })
      .onConflict(['workspace_id', 'file_path'])
      .merge(['opened_at']);

    const rowsToKeep = await trx(TABLE)
      .select('id')
      .where({ workspace_id: workspaceId })
      .orderBy('opened_at', 'desc')
      .limit(20);

    const keepIds = rowsToKeep.map((r) => r.id);
    if (keepIds.length > 0) {
      await trx(TABLE)
        .where({ workspace_id: workspaceId })
        .whereNotIn('id', keepIds)
        .del();
    }
  });
}

/**
 * Clear all recent docs for a workspace.
 * @param {string} workspaceId
 * @returns {Promise<number>} — rows deleted
 */
async function clear(workspaceId) {
  return getDb()(TABLE).where({ workspace_id: workspaceId }).del();
}

module.exports = { list, record, clear, TABLE, COLUMNS };
```

### 3. WS Handlers: `fusion-studio-server/lib/recent-docs/handlers.js`

```js
/**
 * Recent docs — WebSocket handler map.
 *
 * One job: map recent_docs:* messages to index-table calls, broadcast
 * updated state to all connected clients.
 *
 * Follows the clipboard handlers pattern (lib/secrets/clipboard/handlers.js).
 */

'use strict';

const indexTable = require('./index-table');

function createRecentDocsHandlers({ getAllClients }) {
  function broadcast(type, workspaceId, items, total) {
    const payload = JSON.stringify({
      type,
      workspaceId,
      items,
      total,
    });
    for (const ws of getAllClients()) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  function sendError(ws, workspaceId, message) {
    ws.send(JSON.stringify({
      type: 'recent_docs:error',
      workspaceId,
      error: message,
    }));
  }

  async function broadcastList(workspaceId) {
    const { items, total } = await indexTable.list(workspaceId);
    broadcast('recent_docs:updated', workspaceId, items, total);
  }

  return {
    'recent_docs:list': async (ws, msg) => {
      try {
        const workspaceId = msg.workspaceId;
        if (!workspaceId) {
          sendError(ws, msg.workspaceId, 'workspaceId is required');
          return;
        }
        const limit = Number.isInteger(msg.limit) ? msg.limit : 20;
        const { items, total } = await indexTable.list(workspaceId, limit);
        ws.send(JSON.stringify({
          type: 'recent_docs:list',
          workspaceId,
          items,
          total,
        }));
      } catch (err) {
        console.error('[RecentDocs] list error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },

    'recent_docs:record': async (ws, msg) => {
      try {
        const { workspaceId, path, folder, name, panel } = msg;
        if (!workspaceId || !path || !folder || !name || !panel) {
          sendError(ws, workspaceId, 'Missing required fields');
          return;
        }
        await indexTable.record(workspaceId, path, folder, name, panel, Date.now());
        await broadcastList(workspaceId);
      } catch (err) {
        console.error('[RecentDocs] record error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },

    'recent_docs:clear': async (ws, msg) => {
      try {
        const workspaceId = msg.workspaceId;
        if (!workspaceId) {
          sendError(ws, msg.workspaceId, 'workspaceId is required');
          return;
        }
        await indexTable.clear(workspaceId);
        broadcast('recent_docs:cleared', workspaceId, [], 0);
      } catch (err) {
        console.error('[RecentDocs] clear error:', err.message);
        sendError(ws, msg.workspaceId, err.message);
      }
    },
  };
}

module.exports = createRecentDocsHandlers;
```

---

## Files to Modify (3)

### 4. `fusion-studio-server/lib/startup.js`

**Add import** near the other handler imports (~line 28):

```js
const createRecentDocsHandlers = require('./recent-docs/handlers');
```

**Create handlers** after `clipboardHandlers` (~line 115):

```js
  const recentDocsHandlers = createRecentDocsHandlers({ getAllClients });
```

**Add to return object** (~line 176):

```js
  return { fusionHandlers, clipboardHandlers, themeHandlers, secretsHandlers, screenshotHandlers, recentDocsHandlers };
```

### 5. `fusion-studio-server/server.js`

**Add import** near the other handler imports (~line 27):

```js
const createRecentDocsHandlers = require('./lib/recent-docs/handlers');
```

**Add mutable ref** near the other `let` declarations (~line 530):

```js
let recentDocsHandlers = {};
```

**Destructure from startup** in the `.then()` (~line 542):

```js
    recentDocsHandlers = result.recentDocsHandlers;
```

**Pass to router** in the `createClientMessageRouter()` call (~line 437):

```js
    getRecentDocsHandlers: () => recentDocsHandlers,
```

### 6. `fusion-studio-server/lib/ws/client-message-router.js`

**Add parameter** to the JSDoc and destructuring:

In the JSDoc block (~line 55), add:
```js
 * @param {() => object} deps.getRecentDocsHandlers
```

In the destructuring (~line 76), add:
```js
  getRecentDocsHandlers,
```

**Add routing block** after the clipboard routing block (~line 463):

```js
      // ---- Recent docs manager ----

      if (clientMsg.type.startsWith('recent_docs:')) {
        const handler = getRecentDocsHandlers()[clientMsg.type];
        if (handler) {
          await handler(ws, clientMsg);
          return;
        }
      }
```

---

## Smoke Tests

After all files are created/modified, run these in order:

### Test 1.1 — Migration
```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npx knex migrate:latest
sqlite3 data/fusion.db ".schema recent_docs"
```
**Expected output:** `CREATE TABLE recent_docs (...)` with all 7 columns and the two indexes.

### Test 1.2 — Server boots without crash
```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node server.js
```
**Expected:** `[DB] fusion.db initialized` in logs, no errors, port 3001 listening.

### Test 1.3 — WS list returns empty array
Connect via browser devtools or wscat:
```js
socket.send(JSON.stringify({ type: 'recent_docs:list', workspaceId: 'test-ws-1' }));
```
**Expected response:**
```json
{"type":"recent_docs:list","workspaceId":"test-ws-1","items":[],"total":0}
```

### Test 1.4 — Record + updated broadcast
```js
socket.send(JSON.stringify({
  type: 'recent_docs:record',
  workspaceId: 'test-ws-1',
  panel: 'office-viewer',
  path: 'todo/README.md',
  folder: 'todo',
  name: 'README.md'
}));
```
**Expected:** `recent_docs:updated` broadcast with the item at `items[0]`, `total: 1`.

### Test 1.5 — FIFO prune to 20
Send 22 distinct `recent_docs:record` messages for the same workspace, then send `recent_docs:list`.
**Expected:** `total === 20`. The two oldest items are absent.

### Test 1.6 — Upsert (same path twice)
Record `doc-A.md`, wait for broadcast. Record `doc-A.md` again with a newer timestamp. Check DB:
```bash
sqlite3 data/fusion.db "SELECT COUNT(*) FROM recent_docs WHERE workspace_id = 'test-ws-1' AND file_path = 'doc-A.md';"
```
**Expected:** `1` row. The `opened_at` should be the second (later) timestamp.

### Test 1.7 — Clear
```js
socket.send(JSON.stringify({ type: 'recent_docs:clear', workspaceId: 'test-ws-1' }));
```
**Expected:** `recent_docs:cleared` broadcast. Subsequent `recent_docs:list` returns `items: [], total: 0`.

---

## Report Template

After implementing Phase 1, copy and paste this filled-in report back to the parent session:

```markdown
## Phase 1 Implementation Report

### Files Created
- [ ] `fusion-studio-server/lib/db/migrations/021_recent_docs.js`
- [ ] `fusion-studio-server/lib/recent-docs/index-table.js`
- [ ] `fusion-studio-server/lib/recent-docs/handlers.js`

### Files Modified
- [ ] `fusion-studio-server/lib/startup.js`
- [ ] `fusion-studio-server/server.js`
- [ ] `fusion-studio-server/lib/ws/client-message-router.js`

### Smoke Test Results
| Test | Result | Notes |
|------|--------|-------|
| 1.1 Migration | PASS / FAIL | |
| 1.2 Server boot | PASS / FAIL | |
| 1.3 Empty list | PASS / FAIL | |
| 1.4 Record + broadcast | PASS / FAIL | |
| 1.5 FIFO prune | PASS / FAIL | |
| 1.6 Upsert | PASS / FAIL | |
| 1.7 Clear | PASS / FAIL | |

### Issues Encountered
[Describe any deviations from spec, unexpected errors, or design changes made]

### Next Phase Readiness
[Is the server layer solid enough to hand off Phase 2 (client store + WS plumbing)?]
```
