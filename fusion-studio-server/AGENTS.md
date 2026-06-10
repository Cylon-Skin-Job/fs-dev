# AGENTS.md - Fusion Studio Server

> Agent-focused orientation for the Fusion Studio backend.

## What This Server Is

`fusion-studio-server/` is the Node.js backend for Fusion Studio. It provides HTTP APIs, WebSocket routing, SQLite persistence, workspace/file/wiki/resource services, and chat/thread orchestration for configured AI harnesses.

The server is not Kimi-specific. Harness-specific protocol details live behind adapters in `lib/harness/` and canonical wire/thread routing in `lib/wire/`, `lib/ws/`, and `lib/thread/`.

## Key Paths

| Area | Path |
|------|------|
| Entry point | `server.js` |
| Startup/bootstrap | `lib/startup.js` |
| Database singleton | `lib/db.js` |
| DB migrations | `lib/db/migrations/` |
| Thread runtime | `lib/thread/` |
| WebSocket routing | `lib/ws/` |
| Wire event handling | `lib/wire/` |
| Harness adapters | `lib/harness/` |
| Workspace services | `lib/workspace/` |
| Wiki services | `lib/wiki/` |
| Resource services | `lib/resources/` |
| Current chat reference | `../ai/views/wiki-viewer/Wiki/001-Project/002-Chat/PAGE.md` |

## Runtime Model

- The Electron app can spawn this server as a managed child process.
- The server can also run directly with `node server.js` for development.
- WebSocket clients connect from the React renderer.
- The server owns prompt acceptance, thread lifecycle, persistence, and stop/interrupt behavior.
- Harness adapters translate provider/CLI-specific streams into Fusion Studio's canonical event model.

## Chat And Harness Rules

Before changing chat, thread, harness, prompt, live stream, or stop logic, read:

`../ai/views/wiki-viewer/Wiki/001-Project/002-Chat/PAGE.md`

Current model:

- `cli.json` is the harness policy. In the current default config, OpenCode is the only listed/enabled harness, so New Thread creates an OpenCode thread directly and no harness picker is shown.
- Passive browsing uses `thread:open`; it hydrates history and live snapshot state without spawning a harness process.
- Assistant activation and new thread creation use `thread:open-assistant`.
- Prompt acceptance is server-owned. The user bubble is committed on `message:sent`, not on optimistic client send.
- Live streams route by `threadId`.
- Active in-memory turns can overlay SQLite history when a thread is revisited.
- Stop is server-owned. Interrupted turns persist as partial assistant exchanges.

## Database

The database is `fusion.db`, managed by `lib/db.js`.

- Dev path: `fusion-studio-server/data/fusion.db`
- Packaged/user-data path: `${FUSION_APP_USER_DATA}/server-data/fusion.db`
- Migrations directory: `lib/db/migrations/`
- Query modules should receive/use the initialized Knex instance rather than creating independent connections.

Do not describe the active database with any older database filename. The active database is `fusion.db`.

## Commands

```bash
npm install
node server.js
npm test
```

Run commands from `fusion-studio-server/` unless a task says otherwise.

## Editing Guidance

- Keep harness-specific code behind harness adapters.
- Keep canonical chat/thread behavior in thread, wire, and WebSocket routing modules.
- Do not touch archived legacy files for active behavior.
- Do not hand-edit `data/fusion.db`; add migrations or service/query changes.
- Preserve concurrent worktree changes.

## Historical Names

Older docs and archived code may mention previous product or directory names. Treat those as historical. The active backend is `fusion-studio-server`.
