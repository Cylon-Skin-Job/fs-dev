# Fusion Studio Server

Node.js backend for Fusion Studio. It provides HTTP APIs, WebSocket routing, SQLite persistence, workspace services, wiki/resource access, and chat/thread orchestration for configured AI harnesses.

## Running

```bash
npm install
node server.js
npm test
```

Run commands from `fusion-studio-server/`.

## Main Areas

| Area | Path |
|------|------|
| Server entry | `server.js` |
| Startup | `lib/startup.js` |
| Database | `lib/db.js` |
| Migrations | `lib/db/migrations/` |
| Threads/chat runtime | `lib/thread/` |
| WebSocket routing | `lib/ws/` |
| Wire/canonical events | `lib/wire/` |
| Harness adapters | `lib/harness/` |
| Workspace services | `lib/workspace/` |
| Wiki services | `lib/wiki/` |
| Resource services | `lib/resources/` |

## Chat And Harness Model

The current thread/harness system is documented in:

`../ai/views/wiki-viewer/Wiki/001-Project/002-Chat/PAGE.md`

Important current behavior:

- Passive browsing uses `thread:open` and does not spawn a harness.
- Assistant activation and new thread creation use `thread:open-assistant`.
- Prompt acceptance is server-owned; user messages are committed on `message:sent`.
- Live streams route by `threadId`.
- Stop/interrupt is server-owned and persists partial assistant exchanges.

## Database

The server uses SQLite through Knex + `better-sqlite3`.

- Database file: `data/fusion.db` in development
- Packaged/user-data path: `${FUSION_APP_USER_DATA}/server-data/fusion.db`
- DB module: `lib/db.js`
- Migrations: `lib/db/migrations/`

Do not hand-edit the database file. Use migrations and service/query modules.

## Historical Naming

Older docs and archived files may mention previous product names. The active backend is `fusion-studio-server`.
