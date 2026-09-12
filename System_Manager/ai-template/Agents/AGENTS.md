# Agents

You are inside **Fusion Studio**, a desktop IDE built on Electron + React. This panel manages autonomous background agents that execute work from the ticketing system.

## Where You Are

```
fs-dev/
├── ai/
│   └── <machine>/
│       ├── System/Views/         ← View capsules and sidebar icons
│       ├── Wiki/                 ← Living reference layer
│       ├── Issues/               ← Ticket board (dispatch source)
│       └── Agents/               ← You are here
│           ├── Background Workers/   ← Default agents shipped with the app
│           │   ├── wiki-manager/
│           │   ├── code-manager/
│           │   └── ops-manager/
│           ├── Chat Assistants/
│           ├── Expert Helpers/
│           └── registry.json         ← Agent registry (id → folder mapping)
├── fusion-studio-server/         ← Node.js WebSocket + API server
└── fusion-studio-client/         ← Electron + React frontend
```

## How It Works

1. Tickets are created in `ai/<machine>/Issues/inbox/` as `RCC-NNNN.md`
2. When a ticket is assigned to a bot name, the dispatch watcher fires
3. The runner looks up the bot name in `registry.json` → finds the agent folder
4. The runner spawns an orchestrator from the agent's `prompt.md` with the ticket as context
5. The orchestrator delegates steps to sub-agents, evaluates results, retries or approves
6. On completion, the orchestrator closes the ticket and updates `tickets.json`

## Agent Folder Convention

Each agent is a folder inside a category (`Background Workers/`, `Chat Assistants/`, `Expert Helpers/`).

```
agents/{Category}/{agent-id}/
├── prompt.md       ← Single instruction file (YAML frontmatter + prompt body)
├── LESSONS.md      ← Agent's living notebook (appended after each run)
├── MEMORY.md       ← Persistent facts the agent carries across runs
├── SESSION.md      ← Current session state
├── HISTORY.md      ← Run history log
├── workflows/      ← Named workflow definitions
├── runs/           ← Execution history (created by the runner)
│   └── {timestamp}/
│       ├── ticket.md       (frozen copy of triggering ticket)
│       ├── prompt.md       (frozen copy of prompt at execution time)
│       ├── manifest.json   (run metadata: status, timing, outcome)
│       ├── run-index.json  (step-by-step progress tracker)
│       ├── 00-validate.md  (evidence card: preflight check)
│       ├── 01-{step}.md    (evidence card per step)
│       └── ...             (retries: 01-{step}.retry-1.md)
└── settings/       ← Agent-specific configuration
```

## Key Resources

- **Wiki:** `ai/<machine>/Wiki/` — folder-first `PAGE.md` documentation
- **Tickets:** `ai/<machine>/Issues/` — board state via `content/tickets.json`, individual tickets as `RCC-NNNN.md` in `inbox/`, `open/`, `complete/`, `archive/`
- **Registry:** `ai/<machine>/Agents/registry.json` — maps agent IDs to folder paths and current status

## Rules

- Agents read broadly but write only within their declared scope
- The orchestrator delegates to sub-agents — it does not do the work itself
- Sub-agent context is discarded after each step; the orchestrator accumulates decisions
- If confidence drops below the threshold defined in `prompt.md`, stop and mark the ticket blocked
- Never commit directly — report results, let the operator commit
