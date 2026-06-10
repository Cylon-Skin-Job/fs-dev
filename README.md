# Fusion Studio

Fusion Studio is a desktop workspace application built with Electron, React, and Node.js. It manages project workspaces, file/wiki/document views, chat threads, and AI harness integration around local or configured assistant runtimes.

AI inference is handled by configured harnesses. Fusion Studio owns the shell, routing, persistence, rendering, workspace state, and local app integration.

## Project Structure

```
fs-dev/
├── fusion-studio-client/       # Electron app + React/Vite renderer
│   ├── electron/               # Main process, preload, protocol, server spawn
│   └── src/                    # UI components, stores, WebSocket client, view mounting
├── fusion-studio-server/       # Node/Express/WebSocket backend
│   ├── server.js               # Server entry point
│   ├── lib/                    # db, workspace, thread, wire, harness, wiki, resources
│   └── data/                   # Runtime dev data, including fusion.db
├── ai/                         # Development workspace content and project wiki
├── System Source Files/        # Bundled/default system workspace source files
└── docs/                       # Specs, handoffs, architecture notes
```

## Architecture

| Layer | Path | Responsibilities |
|------|------|------------------|
| Electron main | `fusion-studio-client/electron/` | Native app lifecycle, server process, custom protocol |
| Renderer | `fusion-studio-client/src/` | React UI, Zustand state, WebSocket client, view mounting |
| Server | `fusion-studio-server/` | Persistence, workspace services, thread runtime, harness routing |

The current chat/thread model is documented in:

`ai/views/wiki-viewer/Wiki/001-Project/002-Chat/PAGE.md`

## Development

### Client / Electron

```bash
cd fusion-studio-client
npm install
npm run build
npm run electron:dev
```

### Server

```bash
cd fusion-studio-server
npm install
node server.js
npm test
```

## Database

The active SQLite database is `fusion.db`, managed by `fusion-studio-server/lib/db.js`.

- Dev path: `fusion-studio-server/data/fusion.db`
- Packaged/user-data path: `${FUSION_APP_USER_DATA}/server-data/fusion.db`
- Migrations: `fusion-studio-server/lib/db/migrations/`

## Key References

- `AGENTS.md` - agent-facing project guidance
- `docs/FUSION_STUDIO_OVERVIEW.md` - broad application overview
- `docs/FUSION_STUDIO_ARCHITECTURE_OUTLINE.md` - architecture outline
- `ai/views/wiki-viewer/Wiki/001-Project/002-Chat/PAGE.md` - current chat/harness/thread model

## Historical Naming

This project previously used other product and directory names. Active code now lives under `fusion-studio-client/` and `fusion-studio-server/`, and the product name is Fusion Studio.
