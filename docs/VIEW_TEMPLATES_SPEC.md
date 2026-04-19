# View Templates — Spec

**Status:** Draft — ready for implementation.
**Owner:** Open Robin core.
**Prerequisite for:** New workspaces loading correctly out of the box.
**Depends on:** `DB_RELOCATION_SPEC.md` (landed — DB is app-level at `server/data/robin.db`).

---

## 1. Purpose

When a new workspace is bootstrapped, it needs working views — code viewer, wiki, tickets, agents. Today, bootstrap creates an empty `ai/views/` with a stub `index.json` that declares `code-viewer` but never creates the actual folder or its config files. The workspace opens broken.

The real view configurations (index.json, content.json, theme, display type, chat config) shouldn't be duplicated from the current project. They should live in the system DB as **templates** — the canonical definitions of what each core view looks like. Bootstrap reads these templates and writes the necessary files into the new workspace.

**After this:**
- Core view definitions live in the DB (`view_templates` table)
- Bootstrap reads templates, creates folders, writes `index.json` + `content.json`
- Any new workspace gets working code-viewer, wiki, issues, and agents out of the box
- Updating a template (e.g. changing the wiki icon) updates it for future workspaces without touching existing ones

---

## 2. What a view needs to work

From the existing open-robin views, the minimum viable config per view is:

| File | Purpose | Required |
|---|---|---|
| `index.json` | View identity: id, label, icon, type, rank, theme, settings | Yes |
| `content.json` | Display type + chat config | Yes |
| `chat/threads/` | Thread storage directory | Yes (if view has chat) |
| `settings/` | View-specific settings | Optional (created empty) |
| `content/` | View content (wiki pages, ticket files, etc.) | Optional (created empty for types that need it) |

Everything else (README, SPEC, PROMPT, scripts, checkpoints, sessions, state) is workspace-specific and NOT templated.

---

## 3. Data model

### 3a. `view_templates` table (new — migration 010)

```sql
CREATE TABLE view_templates (
  id          TEXT PRIMARY KEY,        -- e.g. 'code-viewer'
  label       TEXT NOT NULL,           -- e.g. 'Code'
  icon        TEXT NOT NULL,           -- Material Symbols icon name
  type        TEXT NOT NULL,           -- display type: 'file-explorer', 'wiki-viewer', etc.
  rank        INTEGER NOT NULL,        -- sort order in tools panel
  description TEXT,                    -- tooltip / subtitle
  index_json  TEXT NOT NULL,           -- full index.json content (JSON string)
  content_json TEXT NOT NULL,          -- full content.json content (JSON string)
  dirs        TEXT NOT NULL,           -- JSON array of subdirectories to create, e.g. ["chat/threads", "settings"]
  is_core     INTEGER DEFAULT 1,      -- 1 = ships with app, 0 = user-created
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Why store the full JSON strings?** Because `index.json` has nested settings, theme objects, and view-type-specific config that varies across view types. Normalizing this into columns would be fragile. The template table is a blob store with just enough metadata (id, label, type, rank) for queries.

### 3b. Seed data (migration 010)

The migration seeds the four core view templates. The `index_json` and `content_json` values are the canonical configs — derived from the working open-robin views but stripped of workspace-specific data (no thread counts, no checkpoint settings, no api.json).

**code-viewer:**
```js
{
  id: 'code-viewer',
  label: 'Code',
  icon: 'code_blocks',
  type: 'file-explorer',
  rank: 1,
  description: 'Browse and edit source files',
  index_json: JSON.stringify({
    version: '1.0',
    id: 'code-viewer',
    folderName: 'code-viewer',
    label: 'Code',
    description: 'Browse and edit source files',
    type: 'file-explorer',
    icon: 'code_blocks',
    rank: 1,
    settings: {
      theme: {
        primary: '#00d4ff',
        sidebar_bg: '#0a1a1f',
        content_bg: '#0d0d0d',
        panel_border: '#00d4ff33'
      }
    }
  }),
  content_json: JSON.stringify({
    display: 'file-explorer',
    chat: { type: 'threaded', position: 'right' }
  }),
  dirs: JSON.stringify(['chat', 'chat/threads', 'settings']),
  is_core: 1,
}
```

**wiki-viewer:**
```js
{
  id: 'wiki-viewer',
  label: 'Wiki',
  icon: 'full_coverage',
  type: 'wiki-viewer',
  rank: 4,
  description: 'Living reference layer — topics and pages',
  index_json: JSON.stringify({
    version: '1.0',
    id: 'wiki-viewer',
    folderName: 'wiki-viewer',
    label: 'Wiki',
    description: 'Living reference layer — topics and pages',
    type: 'wiki-viewer',
    icon: 'full_coverage',
    rank: 4,
    settings: {
      theme: {
        primary: '#ec4899',
        sidebar_bg: '#1a1020',
        content_bg: '#0d0d0d',
        panel_border: '#ec489933'
      }
    }
  }),
  content_json: JSON.stringify({
    display: 'navigation',
    chat: { type: 'rolling-daily', position: 'popup' }
  }),
  dirs: JSON.stringify(['chat', 'chat/threads', 'content', 'settings']),
  is_core: 1,
}
```

**issues-viewer:**
```js
{
  id: 'issues-viewer',
  label: 'Issues',
  icon: 'business_messages',
  type: 'ticket-board',
  rank: 3,
  description: 'Ticket tracking and routing',
  index_json: JSON.stringify({
    version: '1.0',
    id: 'issues-viewer',
    folderName: 'issues-viewer',
    label: 'Issues',
    description: 'Ticket tracking and routing',
    type: 'ticket-board',
    icon: 'business_messages',
    rank: 3,
    settings: {
      theme: {
        primary: '#facc15',
        sidebar_bg: '#1a1808',
        content_bg: '#0d0d0d',
        panel_border: '#facc1533'
      }
    }
  }),
  content_json: JSON.stringify({
    display: 'tabbed',
    chat: { type: 'rolling-daily', position: 'right' }
  }),
  dirs: JSON.stringify(['chat', 'chat/threads', 'content', 'settings', 'scripts']),
  is_core: 1,
}
```

**agents-viewer:**
```js
{
  id: 'agents-viewer',
  label: 'Agents',
  icon: 'smart_toy',
  type: 'agent-tiles',
  rank: 5,
  description: 'Background agent command center',
  index_json: JSON.stringify({
    version: '1.0',
    id: 'agents-viewer',
    folderName: 'agents-viewer',
    label: 'Agents',
    description: 'Background agent command center',
    type: 'agent-tiles',
    icon: 'smart_toy',
    rank: 5,
    settings: {
      theme: {
        primary: '#ef4444',
        sidebar_bg: '#1a0a0a',
        content_bg: '#0d0d0d',
        panel_border: '#ef444433'
      }
    }
  }),
  content_json: JSON.stringify({
    display: 'tiled-rows',
    chat: { type: 'rolling-daily', position: 'right' }
  }),
  dirs: JSON.stringify(['chat', 'chat/threads', 'content', 'settings']),
  is_core: 1,
}
```

---

## 4. Template service

### 4a. File

```
lib/workspace/template-service.js
```

Pure data — reads from the `view_templates` table. No events, no bus.

```js
const { getDb } = require('../db');

async function listCoreTemplates() {
  return getDb()('view_templates').where('is_core', 1).orderBy('rank', 'asc');
}

async function getTemplate(id) {
  return getDb()('view_templates').where('id', id).first();
}

async function listAllTemplates() {
  return getDb()('view_templates').orderBy('rank', 'asc');
}

module.exports = { listCoreTemplates, getTemplate, listAllTemplates };
```

---

## 5. Bootstrap changes

### 5a. `bootstrap-service.js` rewrite

Bootstrap becomes template-driven. Instead of hardcoded `DIRS` and `FILES`, it reads templates from the DB and scaffolds each view:

```js
const fs = require('fs');
const path = require('path');
const templateService = require('./template-service');

/**
 * Scaffold a workspace from view templates.
 * Creates ai/views/ with a working folder + config for each core template.
 * Idempotent — existing files are left alone.
 *
 * @param {string} repoPath — absolute, canonicalized
 */
async function bootstrap(repoPath) {
  const viewsDir = path.join(repoPath, 'ai', 'views');
  fs.mkdirSync(viewsDir, { recursive: true });

  const templates = await templateService.listCoreTemplates();

  // Build index.json from templates
  const indexPath = path.join(viewsDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    const index = {
      version: '1.0',
      id: 'views',
      folderName: 'views',
      label: 'Views',
      type: 'root',
      icon: 'dashboard',
      rank: 1,
      children: templates.map(t => t.id),
      settings: {},
    };
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  // Scaffold each view
  for (const template of templates) {
    const viewDir = path.join(viewsDir, template.id);
    fs.mkdirSync(viewDir, { recursive: true });

    // index.json
    const viewIndex = path.join(viewDir, 'index.json');
    if (!fs.existsSync(viewIndex)) {
      fs.writeFileSync(viewIndex, template.index_json, 'utf8');
    }

    // content.json
    const viewContent = path.join(viewDir, 'content.json');
    if (!fs.existsSync(viewContent)) {
      fs.writeFileSync(viewContent, template.content_json, 'utf8');
    }

    // Subdirectories
    const dirs = JSON.parse(template.dirs || '[]');
    for (const dir of dirs) {
      fs.mkdirSync(path.join(viewDir, dir), { recursive: true });
    }
  }

  // Chat folder (workspace-universal threads)
  fs.mkdirSync(path.join(viewsDir, 'chat', 'threads'), { recursive: true });
}
```

**Key change:** `bootstrap` is now `async` because it reads from the DB. The workspace controller already calls it in an async context, so this fits naturally.

### 5b. `isValidWorkspaceRoot` stays simple

```js
function isValidWorkspaceRoot(repoPath) {
  return fs.existsSync(path.join(repoPath, 'ai', 'views', 'index.json'));
}
```

No change — it just checks for the existence of `index.json`. The content doesn't matter for validation.

---

## 6. What happens on "Add Project"

1. User selects a folder via the picker.
2. `workspace:add_requested` → workspace controller.
3. Controller calls `await bootstrap(repoPath)`.
4. Bootstrap reads 4 core templates from DB.
5. Creates `ai/views/` with `index.json` listing all 4 views.
6. Creates `code-viewer/`, `wiki-viewer/`, `issues-viewer/`, `agents-viewer/` — each with `index.json`, `content.json`, and required subdirectories.
7. Creates `chat/threads/` for workspace-universal chat.
8. Controller adds workspace to registry, emits events.
9. Client discovers panels → finds 4 working views → loads.

---

## 7. Existing workspaces are untouched

Bootstrap is idempotent — it only writes files that don't already exist. Open Robin's existing views (with all their accumulated content, threads, wiki pages, tickets, agents) are left alone. The templates are only written into fresh views.

If a user adds a repo that already has `ai/views/` with different views, those are kept. Bootstrap only fills in missing views from the templates.

---

## 8. Files changed

| File | Change |
|---|---|
| `lib/db/migrations/010_view_templates.js` | **New** — creates `view_templates` table, seeds 4 core templates |
| `lib/workspace/template-service.js` | **New** — ~20 lines, reads templates from DB |
| `lib/workspace/bootstrap-service.js` | Rewrite — reads templates, scaffolds views. Now async. |
| `lib/workspace/workspace-controller.js` | `await bootstrap(repoPath)` — already async, just add `await` if missing |

**Total:** 2 new files, 2 files edited.

---

## 9. Verification

1. **Fresh workspace:** Delete `karens-lab/ai/` entirely. Switch to karens-lab (or remove + re-add). Bootstrap creates 4 working views. Panel discovery finds all 4. App loads.

2. **Existing workspace:** Switch to open-robin. All existing views preserved. No files overwritten.

3. **Clean install:** Delete `server/data/robin.db`. Restart. Migrations create fresh DB with 4 templates. Add a project → bootstrap creates full view set. Works immediately.

4. **Template query:** `sqlite3 data/robin.db "SELECT id, label, rank FROM view_templates ORDER BY rank;"` shows all 4 core views.

---

## 10. Future: user-defined templates

The `is_core` flag distinguishes built-in templates from user-created ones. A future "Create View" UI could let the user define a new view template (`is_core: 0`), which would then be scaffolded into every new workspace alongside the core views. Out of scope for now.
