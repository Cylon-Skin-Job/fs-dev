# Chunk J — Issues-Viewer Full Redesign

**Phase:** 4.1 (first view migration + full polish)
**Depends on:** Chunk D (iframe view loader), Chunk E (theme token bridge)
**Spec written:** 2026-05-21
**Status:** Ready for handoff

← [ROADMAP-REVISED.md](../ROADMAP-REVISED.md)

---

## Context

This chunk does two things in one pass:

1. **Establishes the view convention** — Issues-viewer is the first view migrated from React to a self-contained HTML/CSS/JS iframe. The file structure and postMessage patterns defined here become the template for all subsequent view migrations.

2. **Full Issues-viewer redesign** — not a port of the current TicketBoard. The current implementation is skeletal (completed tickets never load, no create UI, no priority, detail panel breaks layout). This spec delivers the complete board.

The background session receiving this spec should implement the full feature set. Do not port the current TicketBoard — replace it.

---

## Part 1: View Convention (applies to all future migrations)

### File Structure

```
ai/views/issues-viewer/
├── index.json           ← identity, icon, rank (unchanged)
├── content.json         ← display type, chat config (unchanged)
├── app/
│   ├── index.html       ← thin shell: mounts #app, loads app.js
│   ├── app.js           ← entry point: initializes modules, handles postMessage
│   ├── style.css        ← structural layout only (no hardcoded colors)
│   ├── board/
│   │   ├── board.js           ← renders columns, handles column events
│   │   ├── board.styles.js    ← CSS string, injected once
│   │   └── board.template.js  ← column + card HTML builders
│   ├── drawer/
│   │   ├── drawer.js          ← slideout drawer: archive + templates tabs
│   │   ├── drawer.styles.js
│   │   └── drawer.template.js
│   ├── detail/
│   │   ├── detail.js          ← ticket detail panel: fields + comments
│   │   ├── detail.styles.js
│   │   └── detail.template.js
│   ├── create/
│   │   ├── create.js          ← create ticket modal
│   │   ├── create.styles.js
│   │   └── create.template.js
│   └── state/
│       └── store.js           ← module-level state (tickets, activeTicket, drawerOpen)
```

### postMessage Protocol

On load, the view sends:
```js
parent.postMessage({ type: 'view:ready', viewId: 'issues-viewer' }, 'fusion-studio://');
```

Shell responds with tokens:
```js
{ type: 'theme:tokens', tokens: { '--bg-primary': '#...', ... } }
```

View writes tokens to `:root`:
```js
window.addEventListener('message', (e) => {
  if (e.origin !== 'fusion-studio://') return;  // dev: also allow localhost
  if (e.data.type === 'theme:tokens') {
    Object.entries(e.data.tokens).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );
  }
});
```

File-change events arrive as:
```js
{ type: 'file:changed', path: 'ai/views/issues-viewer/open/RCC-0077.md', change: 'add' }
{ type: 'file:changed', path: 'ai/views/issues-viewer/open/RCC-0071.md', change: 'modify' }
{ type: 'file:changed', path: 'ai/views/issues-viewer/done/RCC-0065.md', change: 'add' }
```

View requests full ticket data from server via WebSocket (existing pattern — `usePanelData` equivalent).

### CSS Rules (all views)
- All colors via `var(--token, fallback)` — never hardcoded
- All class names prefixed `.rv-issues-*`
- Component styles injected once via flag
- No inline styles on elements

---

## Part 2: Issues-Viewer Feature Spec

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [≡] Issues                              [+ New]  [⚡ Interrupt ▾] │  ← toolbar
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  INBOX (3)          OPEN (5)           COMPLETED (12)             │  ← board
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ RCC-0074    │   │ RCC-0071    │   │ RCC-0060    │            │
│  │ ...         │   │ ...         │   │ ...         │            │
│  └─────────────┘   └─────────────┘   └─────────────┘            │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘

When ticket selected — detail panel slides in from right, columns compress:

┌─────────────────────────────────┬────────────────────────────────┐
│  INBOX    OPEN    COMPLETED     │  RCC-0071                       │
│  (compressed, still visible)    │  Title, fields, body, comments  │
│                                 │  [Move to Done] [Archive]       │
└─────────────────────────────────┴────────────────────────────────┘

Drawer open — slides in from left, overlays (does not push):

┌──────────────────────┬─────────────────────────────────────────┐
│  [Archive] [Templates│  Board (dimmed overlay behind drawer)   │
│  ─────────────────── │                                         │
│  RCC-0050            │                                         │
│  RCC-0049            │                                         │
│  ─────────────────── │                                         │
│  TEMPLATE: Bug       │                                         │
│  TEMPLATE: Feature   │                                         │
└──────────────────────┴─────────────────────────────────────────┘
```

---

### Ticket Schema (unchanged frontmatter, adding `priority`)

```yaml
---
id: RCC-0077
title: 'Short imperative title'
assignee: rccurtrightjr | kimi-bot | kimi-code | kimi-review | kimi-wiki
author: rccurtrightjr
created: 2026-05-21T10:00:00.000Z
state: open | claimed | closed
priority: interrupt | high | medium | backlog
blocks: RCC-0075          # optional
blocked_by: RCC-0074      # optional
gitlab_iid: 42            # optional
---

Body text in markdown.

## Comments

---
**rccurtrightjr** · 2026-05-21T10:30:00Z

Comment text here.

---
**kimi-bot** · 2026-05-21T10:35:00Z

Bot reply here.
```

Comments are appended to the body file (oldest at bottom of file). UI displays newest first.

---

### Columns

| Column | Source folder | Filter |
|--------|--------------|--------|
| **Inbox** | `inbox/` | `state: open`, assignee is human |
| **Open** | `open/` | `state: open \| claimed`, assignee is bot |
| **Completed** | `done/` | `state: closed` |

Column header: icon + label + count badge. "No tickets" empty state per column.

**Bot detection:** read from `ai/views/issues-viewer/settings/registry.json` (not hardcoded). Fall back to hardcoded set if file missing.

---

### Ticket Card

```
┌──────────────────────────────┐
│ ● RCC-0071              HIGH │  ← priority dot (color) + id + priority label
│ Handle Full Disk Access      │  ← title (truncate 2 lines)
│ 👤 rccurtrightjr    2d ago  │  ← assignee icon + name + relative time
└──────────────────────────────┘
```

Priority dot colors (CSS variables):
- `interrupt` → `var(--palette-red, #e53e3e)`
- `high` → `var(--palette-orange, #dd6b20)`
- `medium` → `var(--palette-yellow, #d69e2e)`
- `backlog` → `var(--text-dim, #666)`

Click card → open detail panel (slide in from right). Click again → close.

---

### Detail Panel

Slides in from right. Columns compress (flex layout — columns share remaining width).

```
┌─────────────────────────────────────────┐
│ ← [close]                  [▾ Actions] │
│                                         │
│  RCC-0071                               │
│  Handle Full Disk Access…               │
│                                         │
│  Priority   HIGH                        │
│  Assignee   rccurtrightjr              │
│  State      open                        │
│  Author     rccurtrightjr              │
│  Created    May 18 2026                 │
│  GitLab     #42  (if present)           │
│                                         │
│  ──────────────────────────────         │
│  Body (markdown rendered)               │
│                                         │
│  ──────────────────────────────         │
│  Comments (newest first)                │
│                                         │
│  kimi-bot · 10 min ago                  │
│  Bot reply...                           │
│                                         │
│  rccurtrightjr · 2h ago                 │
│  Original comment...                    │
│                                         │
│  [Add comment...]                       │
└─────────────────────────────────────────┘
```

**Actions dropdown** (`▾`):
- Move to Inbox
- Move to Open
- Move to Done
- Archive
- Copy ID

**Move behavior:** server moves the `.md` file between folders. No client-side animation needed — file-change event will trigger re-render via postMessage.

---

### Create Ticket Modal

Triggered by `[+ New]` toolbar button or `[+ New]` button in any column header.

```
┌──────────────────────────────────────────┐
│  New Ticket                           ✕  │
│                                          │
│  Title ________________________________  │
│                                          │
│  Priority  [○ Interrupt] [● High]        │
│            [○ Medium   ] [○ Backlog]     │
│                                          │
│  Assignee  [Me ▾]                        │
│                                          │
│  Body (markdown)                         │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│              [Cancel]  [Create Ticket]   │
└──────────────────────────────────────────┘
```

- ID auto-assigned by server (next in `RCC-` sequence, read from `tickets.json`)
- Assignee options: Me + any bot name from registry.json
- Routing: human assignee → `inbox/`, bot assignee → `open/`
- Server writes file, emits `file:changed` event, board re-renders

---

### Left Drawer

Toggle via `[≡]` hamburger in toolbar. Slides in from left as overlay (board dims behind it). Click outside or `[≡]` again to close.

**Two tabs: Archive | Templates**

#### Archive Tab
Lists tickets from `archive/` folder. Same card format, read-only. No column, just a vertical list sorted newest first.

Action per card: `[Restore]` — moves file back to `inbox/`.

#### Templates Tab
Lists `.md` files from `issues-viewer/templates/`. Displayed as simple rows:

```
  📋  Bug Report            [Use]
  📋  Feature Request       [Use]
  📋  Deploy Checklist      [Use]
```

`[Use]` → opens create modal pre-filled with template title + body. User sets assignee + priority, then creates.

Template file format (same as ticket, minus `id` and `created`):
```yaml
---
title: 'Bug Report'
priority: high
assignee: rccurtrightjr
---
**Steps to reproduce:**

**Expected:**

**Actual:**
```

---

### Trigger Integration

TRIGGERS.md entries that reference ticket templates use a new `type: ticket`:

```yaml
---
name: deploy-checklist
type: ticket
template: ai/views/issues-viewer/templates/deploy-checklist.md
assignee: rccurtrightjr
priority: interrupt
---
```

When this trigger fires, the server:
1. Reads the template file at the given path
2. Assigns a new ID (next in sequence)
3. Sets `created` to now, `state: open`, `priority` from trigger (overrides template default)
4. Writes to `inbox/` (human) or `open/` (bot) based on assignee
5. Emits `ticket:created` on event bus → board re-renders via postMessage

The trigger itself does not define ticket content — it only points to the template and sets assignee + priority. Template owns the title and body.

---

### Priority Filter (toolbar)

`[⚡ Interrupt ▾]` dropdown in toolbar filters board to show only that priority level (or All).

- All (default)
- ⚡ Interrupt only
- ↑ High and above
- → Medium and above
- ↓ Backlog (all)

Filter is session-only — resets on reload.

---

### Toolbar

```
[≡]  Issues                    [+ New]  [⚡ All ▾]
```

- `[≡]` — toggle drawer
- `Issues` — view title (static)
- `[+ New]` — open create modal
- `[⚡ All ▾]` — priority filter dropdown

---

## Server-Side Changes

### New route: `POST /api/tickets/create`
```json
{ "title": "...", "assignee": "...", "priority": "high", "body": "..." }
```
Returns `{ id: "RCC-0077", path: "open/RCC-0077.md" }`

### New route: `POST /api/tickets/move`
```json
{ "id": "RCC-0071", "to": "done" }
```
Moves file between `inbox/`, `open/`, `done/`, `archive/`.

### New route: `POST /api/tickets/comment`
```json
{ "id": "RCC-0071", "author": "rccurtrightjr", "body": "Comment text." }
```
Appends comment block to ticket file.

### Trigger handler: `type: ticket`
In `lib/triggers/` — new handler file `ticket-trigger.js`. Reads template, generates ID, writes file, emits event. One job, one file.

### `tickets.json` update
Currently only tracks open tickets. Extend to include `done` and `archive` sections:
```json
{
  "tickets": { "RCC-0071": { ... } },
  "last_updated": "...",
  "sequence": 77
}
```
`sequence` tracks the last-used ID number. Create route reads and increments atomically.

---

## Smoke Tests

- [ ] Board loads with Inbox / Open / Completed columns populated from filesystem
- [ ] Completed column loads tickets from `done/` folder (currently broken)
- [ ] Click card → detail panel slides in, columns compress, all three still visible
- [ ] Click card again → detail panel closes, columns expand back
- [ ] Detail panel renders ticket body as markdown (not raw text)
- [ ] Comments display newest first
- [ ] `[+ New]` → modal opens → fill form → submit → ticket appears in correct column
- [ ] Actions → Move to Done → file moves to `done/` → ticket disappears from Open, appears in Completed
- [ ] Actions → Archive → file moves to `archive/` → ticket disappears from board
- [ ] `[≡]` → drawer slides in, board dims
- [ ] Archive tab → restored ticket returns to Inbox
- [ ] Templates tab → `[Use]` → create modal prefilled
- [ ] Trigger fires (`type: ticket`) → template duplicated to correct column with new ID
- [ ] Priority filter → Interrupt only → only interrupt cards visible
- [ ] Theme token change (postMessage) → colors update without reload
- [ ] File-change event for new ticket → board updates without full reload
- [ ] Bot names read from `registry.json` — removing a bot name from registry removes it from assignee options
- [ ] `priority` missing from old ticket → renders as `backlog` (graceful default)

---

## Open Decisions

- [x] **ID prefix:** Assignee determines prefix. Human assignee → `RCC-` sequence. Bot assignee → bot-name prefix (e.g., `KIMI-`). Server reads prefix from `registry.json` per bot entry.
- [x] **Comment author:** Name of whoever wrote it — `rccurtrightjr` for human, `kimi-bot` for bot. Server stamps author field on `POST /api/tickets/comment`.
- [x] **Interrupt tickets:** Auto-injection into AI chats deferred to Phase 7 (AI-Native Layer). This chunk renders Interrupt priority visually only.
- [x] **Drag-and-drop:** Included. Cards are draggable between Inbox / Open / Completed columns. Drop calls `POST /api/tickets/move`. Native HTML5 drag API only — no library. Drag state lives in `store.js` (`draggingId`, `dropTarget`).
- [x] **Markdown editor:** Plain `<textarea>` for now. User will experiment with editor options live during the build session.

## Build Note

This spec is a foundation, not a contract. The user will drive iterations step by step during the live build session. Implement what is specified here — clean, modular, one job per file — then stop. Do not anticipate or add features beyond what is written. The user will direct what comes next in real time.
- [ ] **Markdown editor for body/comments:** Plain `<textarea>` for now, or a lightweight editor (e.g., CodeMirror lite)?
