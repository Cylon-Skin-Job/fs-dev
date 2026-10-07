---
name: Background Agents
description: Trigger-driven background workers in Fusion Studio. Covers the TRIGGERS.md system that is built today, the worker/workflow folder model, and the long-term outlook for trigger-started agents.
metadata:
  incoming-edges:
    - Home
    - Workspaces
    - Automation And Agents
  outgoing-edges:
    - Ticket Routing
    - Run Auditing
  source-files:
    - fusion-studio-server/lib/triggers/trigger-loader.js
    - fusion-studio-server/lib/triggers/trigger-parser.js
    - fusion-studio-server/lib/triggers/cron-scheduler.js
    - fusion-studio-server/lib/watcher/actions.js
    - ai/<machine>/Agents/Background Workers/
  connected-skills: []
  related-trigger-files: []
---

Background agents are trigger-driven workers. A worker watches for events through
its own `TRIGGERS.md` files and reacts to them. The trigger files are visible,
editable artifacts inside each worker's folder, not monitoring logic buried in
the server.

This page separates three things deliberately:

- **In place now** — the trigger system that is built and runs at boot.
- **The paradigm** — how triggers are meant to start and drive workers.
- **Long-term outlook** — the parts that are designed but not yet built.

> Status note: the previous execution engine dispatched tickets from a watcher
> buried in the server and spawned a CLI to run them. That engine has been
> retired. The trigger system replaces the buried monitoring; a trigger file
> watching a folder or ticket is the intended entry point now.

---

## In Place Now

The trigger system is real and loaded at server startup
(`startup.js` -> `loadTriggers()`). What exists today:

### Worker Folders

Each background worker is a self-contained folder under
`ai/<machine>/Agents/Background Workers/`. A worker owns settings, workflows,
memory, and run records.

```
ai/<machine>/Agents/Background Workers/
└── wiki-manager/
    ├── settings/
    │   ├── PROMPT.md          ← worker identity / system prompt
    │   ├── TRIGGERS.md        ← worker-level triggers
    │   └── styles.css
    ├── workflows/
    │   ├── Wiki Update/
    │   │   ├── TRIGGERS.md    ← workflow-specific triggers
    │   │   ├── WORKFLOW.md    ← execution rules / guardrails
    │   │   └── LESSONS.md
    │   ├── Wiki Audit/
    │   └── Edge Consistency/
    ├── chat/ , threads/       ← the worker's chat threads
    ├── runs/                  ← run records
    ├── HISTORY.md
    ├── LESSONS.md
    ├── MEMORY.md
    └── SESSION.md
```

A worker (for example `wiki-manager`, `ops-manager`, `code-manager`) is a manager
that owns several workflows. Each workflow is a named unit of work with its own
triggers and rules. This is the current shape: one worker, many workflows — not
one agent per job.

### TRIGGERS.md

A `TRIGGERS.md` file holds one or more trigger blocks, each a YAML section
delimited by `---` markers (parsed by `trigger-parser.js`). Triggers can live at
the worker `settings/` level or inside a specific workflow.

```markdown
---
name: source-file-change
type: file-change
events: [modify, create, delete]
match: "fusion-studio-server/lib/**/*.js"
exclude: ["ai/<machine>/Views/*-doc-viewer/**"]
prompt: PROMPT_01.md
message: |
  Source file changed: {{filePath}} ({{event}})
---

---
name: daily-freshness
type: cron
schedule: "daily 09:00"
prompt: PROMPT_02.md
message: |
  Scheduled freshness check.
---
```

Supported trigger types today:

| Type | Fires when |
|---|---|
| `file-change` | A watched path matches on `modify` / `create` / `delete` |
| `cron` | A schedule elapses (with optional `condition` and `retry`) |
| `chat` / `ticket` / `agent` / `system` | A matching event is emitted on the event bus |

Common fields: `name`, `type`, `events`, `match`, `exclude`, `condition`,
`schedule`, `retry`, `prompt`, `message`, `action`. Message and template fields
support `{{var}}` substitution from the event context (for example `{{filePath}}`,
`{{event}}`).

### Trigger Actions

When a trigger fires it runs an action. The default action is `create-ticket`.
The built-in handlers (`lib/watcher/actions.js`) are:

| Action | What it does |
|---|---|
| `create-ticket` | Write a ticket from the trigger's template |
| `log` | Log the event, no side effects |
| `notify` | Broadcast a file-change event to clients |
| `send-message` | Send a message into an **already-active** chat session |
| `webhook-post` | Fire-and-forget HTTP POST to an external URL |
| `show-modal` | Show a modal overlay on connected clients |
| `drop-file` | Write a templated file inside the project root |

A trigger may also run a `script` / `function` before its action, whose return
value is merged into the template variables.

These actions are real and dispatched at runtime. Note what is **not** in this
list: spawning a fresh autonomous worker session. Today a trigger can create a
ticket or message a session that is already running; it cannot yet start a new
agent on its own.

---

## The Paradigm

Triggers are the entry point for background work, and they are meant to be read
and edited by the user directly. The intended model:

- A worker declares its triggers in `TRIGGERS.md` files inside its own folder.
- A trigger watches a folder, a ticket, or an event.
- When it fires, it resolves its template context and follows the logic written
  in the trigger and the referenced workflow.
- The work is recorded under the worker's `runs/`, and the worker's memory files
  (`HISTORY.md`, `LESSONS.md`, `MEMORY.md`, `SESSION.md`) carry state between
  runs.

The point of moving this into visible `TRIGGERS.md` files was to let the user see
exactly what a worker watches and what it will do, instead of relying on hidden
server-side monitoring.

---

## Long-Term Outlook

These pieces are designed but not yet built. They are described here as direction,
not current behavior.

- **Trigger-started agents.** A trigger will be able to start a background worker
  session, not just create a ticket or message an active one. The execution
  engine for this is not implemented yet (the retired CLI runner is not the
  path forward).
- **Ticket-edit monitoring.** A trigger will watch edits to tickets and react to
  changes in their state or body, so ticket activity can drive a worker directly.
- **@-tag resolution.** A trigger will resolve `@` tags (for example mentioning a
  worker or a target) and route the work accordingly. No tag-resolution logic
  exists in code today.
- **Workflow-driven runs.** A started worker will follow the steps in the
  matched `workflows/{name}/WORKFLOW.md`, accumulating context across steps and
  saving each step under `runs/`.

Until the execution engine lands, background workers exist as folders, triggers,
and workflows that fire the built-in actions above. The autonomous run loop is
outlook, not implemented behavior.

---

## Design Decisions

### Triggers are visible files, not buried monitoring

The earlier system watched tickets from a dispatch loop inside the server. That
hid the behavior. `TRIGGERS.md` files put the watch conditions and actions where
the user can read and change them, next to the worker they belong to.

### A worker owns workflows

A worker is a manager with several named workflows rather than a single fixed
job. Each workflow carries its own triggers, rules (`WORKFLOW.md`), and lessons,
so behavior can be added or swapped without rewriting the worker.

### Workers keep their own memory

`HISTORY.md`, `LESSONS.md`, `MEMORY.md`, and `SESSION.md` live in the worker
folder. Runs are recorded under `runs/`. State belongs to the worker, not to a
central registry.

---

## Related

- [Ticket Routing](../022-Ticket_Routing/PAGE.md) — how tickets are created and routed
- [Run Auditing](../019-Run_Auditing/PAGE.md) — inspecting recorded runs
