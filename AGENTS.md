# AGENTS.md - Fusion Studio

> Agent-focused orientation for Fusion Studio. This repository is the development checkout for the Fusion Studio desktop workspace app.

## Current Identity

Fusion Studio is an Electron + React + Node.js workspace application for managing project folders, AI-assisted chat threads, wiki/docs/views, file exploration, and local system resources.

It is not a model provider. AI work is delegated to configured harnesses such as OpenCode or other CLI/service adapters. Fusion Studio owns the workspace shell, persistence, routing, rendering, and orchestration around those harnesses.

## Repository Layout

```
fs-dev/
├── fusion-studio-client/       # Electron shell + React/Vite renderer
│   ├── electron/               # Electron main process, preload, protocol, server spawn
│   └── src/                    # React UI, stores, WebSocket client, view mounting
├── fusion-studio-server/       # Node/Express/WebSocket backend
│   ├── server.js               # HTTP + WebSocket entry point
│   ├── lib/                    # db, workspace, thread, wire, harness, wiki, resources
│   └── data/                   # Runtime server data; contains fusion.db in dev
├── ai/                         # Development workspace content and current project wiki
├── System_Manager/             # Bundled/default system manager workspace files
├── docs/                       # Specs, handoffs, architecture notes
└── README.md                   # Human-facing project overview
```

## Active Code Paths

| Area | Path |
|------|------|
| Renderer UI | `fusion-studio-client/src/` |
| Electron main/preload | `fusion-studio-client/electron/` |
| Server | `fusion-studio-server/` |
| Server libraries | `fusion-studio-server/lib/` |
| Current Chat architecture source of truth | `ai/<machine>/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` |
| Project overview | `docs/FUSION_STUDIO_OVERVIEW.md` |
| Architecture outline | `docs/FUSION_STUDIO_ARCHITECTURE_OUTLINE.md` |

Do not use old client or server directory names. The active directories are `fusion-studio-client/` and `fusion-studio-server/`.

## Development Commands

### Client

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

The Electron development path builds the renderer and starts the app shell, which manages the server process. When validating server code directly, use `fusion-studio-server/server.js`.

## Architecture Summary

Fusion Studio has three primary runtime layers:

| Layer | Path | Responsibilities |
|------|------|------------------|
| Electron main | `fusion-studio-client/electron/` | Window lifecycle, native APIs, custom protocol, server child process |
| Renderer | `fusion-studio-client/src/` | React UI, Zustand stores, WebSocket client, built-in view mounting, custom/browser iframe surfaces |
| Server | `fusion-studio-server/` | Business logic, SQLite, workspace registry, chat/thread routing, harness adapters, file/wiki/resource APIs |

The server owns persistence and orchestration. The renderer presents state and sends user intents. Electron provides local app integration and packages the client/server together.

## Chat And Harness Model

Read `ai/<machine>/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` before changing chat, threads, harness routing, prompt acceptance, live stream rendering, or stop/interrupt behavior.

Current rules:

- `cli.json` is the harness policy. In the current default config, OpenCode is the only listed/enabled harness, so New Thread creates an OpenCode thread directly and no harness picker is shown.
- The persistent identity is the thread, not the workspace tab or current view.
- Passive browsing uses `thread:open`; it hydrates history and live snapshot state without warming or spawning a harness process.
- Assistant activation and new thread creation use `thread:open-assistant`.
- Prompt acceptance is server-owned. The user bubble is committed on `message:sent`, not on optimistic client send.
- Live streams route by `threadId`. Workspace and view context describe where the thread belongs, but `threadId` is the routing key.
- Active in-memory turns can be overlaid on top of SQLite history when a thread is revisited.
- Stop is server-owned. Interrupted turns persist as partial assistant exchanges instead of disappearing.

## Database

The server uses SQLite through Knex + `better-sqlite3`.

- Canonical DB module: `fusion-studio-server/lib/db.js`
- Dev DB path: `fusion-studio-server/data/fusion.db`
- Packaged/user-data DB path: `${FUSION_APP_USER_DATA}/server-data/fusion.db`
- Migrations: `fusion-studio-server/lib/db/migrations/`

Do not describe the current system as using any older database filename. The active database is `fusion.db`.

## Workspace And Views

Each workspace is a folder on disk with an `ai/<machine>/` subtree. Fusion Studio reads workspace config, views, wiki content, styles, and state from that machine-scoped folder.

Built-in Fusion Studio views are React components mounted by the renderer. Iframes are for custom user-created HTML views, local embedded apps, and browser-style surfaces. Do not infer a migration from React built-ins to iframe built-ins unless current code and product direction both say so.

The V2 workspace layout is:

- `ai/<machine>/Views/<prefix>-<view-id>/` for view capsules, including `manifest.md`, `content.json`, `state/state.json`, and `styles/icon.md`.
- `ai/<machine>/Wiki`, `Captures`, `Issues`, and `Agents` for top-level product content.
- `ai/<machine>/System/{config,state,styles}` for workspace policy, state, and shared CSS.
- `ai/<machine>/Data` for generated/local runtime data such as chatlog mirrors and screenshots.

## Editing Guidance

- Prefer the smallest correct change.
- Preserve existing user/worker changes in the dirty worktree.
- Do not rewrite generated/cache/runtime files unless the task specifically targets them.
- For chat/thread/harness work, start from the Chat wiki tree under `ai/<machine>/Wiki/007-Chat_System/`.
- For database work, use migrations and query modules; do not hand-edit `fusion.db`.
- For frontend UI work, preserve the current visual language unless explicitly asked to redesign.

## Verification

Choose the narrowest verification that matches the change:

- Client build: `npm run build` in `fusion-studio-client/`
- Server tests: `npm test` in `fusion-studio-server/`
- Server smoke: `node server.js` in `fusion-studio-server/`
- Electron dev launch: `npm run electron:dev` in `fusion-studio-client/`

If verification is skipped because of time, missing dependencies, or a dirty/concurrent worktree, say so explicitly.

## Alpha Dogfood Installation On This Machine

Fusion Studio Alpha is developed and dogfooded from two separate Git checkouts on this machine. Do not assume that updating the development checkout also updates the Alpha source checkout or installed app.

| Purpose | Path |
|------|------|
| Primary development checkout | `/Users/rccurtrightjr./projects/fs-dev` |
| Alpha dogfood source checkout | `/Users/rccurtrightjr./Applications/Fusion-Studio-Alpha-Source` |
| Packaged Alpha build inside the source checkout | `/Users/rccurtrightjr./Applications/Fusion-Studio-Alpha-Source/fusion-studio-client/release/mac-arm64/Fusion Studio Alpha.app` |
| Installed dogfood app | `/Applications/Fusion Studio Alpha.app` |
| Alpha user data and live server log | `/Users/rccurtrightjr./Library/Application Support/Fusion Studio Alpha/` |
| Alpha machine-scoped workspace identity | `RC-Alpha` (uses each workspace's `ai/RC-Alpha/` subtree) |

At the start of work in either checkout, resolve the current repository root with `git rev-parse --show-toplevel` and compare it with the table above:

- In the primary development checkout, author and verify product changes, then commit and publish approved work to GitHub.
- In the Alpha source checkout, treat the repository as the dogfood build/deployment mirror. Use it for clean fast-forward pulls, Alpha builds, packaging, installation, and smoke testing. Do not originate independent product changes or commits there unless the user explicitly requests Alpha-only work.
- Keep this tracked `AGENTS.md` identical across both checkouts. Do not maintain a separate Alpha-only copy of these instructions.

The Alpha source checkout does not have a permanently named `alpha` branch. Before updating it, inspect its current branch and worktree with `git status -sb`. The normal update flow is:

1. Commit and push the approved development changes to a GitHub branch from the primary development checkout.
2. After every successful Fusion Studio GitHub push, proactively ask the user whether to fast-forward the Alpha source checkout and rebuild/reinstall the dogfood app. Do not make the user remember to request this follow-up.
3. Do not pull, build, or reinstall Alpha until the user confirms that follow-up in the current conversation.
4. After confirmation, verify the Alpha source checkout is clean and on the intended matching branch.
5. Fast-forward it with `git pull --ff-only origin <branch>`.
6. Treat the source pull and app installation as separate operations. Pulling does not rebuild or replace `/Applications/Fusion Studio Alpha.app`.
7. When the user confirms both operations, rebuild/package from the updated Alpha source checkout and replace the installed dogfood app through its established build/install workflow.

Alpha operations are also independently callable. Follow the exact scope the user requests:

- **Pull/sync Alpha:** fast-forward the Alpha source checkout only. Do not build, install, or restart unless requested.
- **Rebuild/reinstall Alpha:** package the source currently present in the Alpha checkout and replace the installed dogfood app. Do not pull first unless requested.
- **Restart Alpha:** quit and relaunch the installed dogfood app without pulling or rebuilding.
- **Update Alpha:** perform the combined clean flow: fast-forward the source checkout, rebuild/package, replace the installed app, and restart it.

Alpha runtime isolation has two independent parts, and both are required on every launch or restart:

- `FUSION_APP_USER_DATA=/Users/rccurtrightjr./Library/Application Support/Fusion Studio Alpha` selects Alpha's Electron profile, SQLite database, port file, and live server log.
- `FUSION_LOCAL_MACHINE=RC-Alpha` selects the `ai/RC-Alpha/` subtree inside every attached workspace. Omitting it can make Alpha appear to have missing or foreign workspace content even when the correct Alpha database is open.

The current Electron main process hardcodes the application name to `Fusion Studio`, so the Alpha bundle name and bundle identifier alone do not provide this runtime isolation. Launch or restart the installed dogfood app with both variables explicitly:

```bash
env \
  FUSION_APP_USER_DATA='/Users/rccurtrightjr./Library/Application Support/Fusion Studio Alpha' \
  FUSION_LOCAL_MACHINE='RC-Alpha' \
  open -n '/Applications/Fusion Studio Alpha.app'
```

Do not treat a running process as sufficient restart verification. Confirm all of the following before reporting Alpha healthy:

- the renderer process uses `--user-data-dir=/Users/rccurtrightjr./Library/Application Support/Fusion Studio Alpha`;
- `server-live.log` reports the expected workspace count and active workspace;
- workspace state and watcher activity resolve under `ai/RC-Alpha/`, not `ai/RCs-Air-2/` or another machine subtree;
- the renderer remains connected after the initial `workspace:init` message.

If Alpha shows no workspaces or content from another build after a restart, verify these two identity variables before changing the workspace registry, restoring SQLite, clearing caches, or reattaching folders. Rebuilding or replacing the `.app` bundle must not copy, move, or replace either profile's database under `Application Support`.

Before rebuild, reinstall, or restart, inspect the established Alpha scripts/package configuration and whether the app is running. Preserve recoverability when replacing the installed app, and verify the relaunched app path and basic startup health afterward.

For GitHub publishing, use the installed GitHub publishing workflow when available. Local checkout discovery, branch inspection, and fast-forward pulls are normal local Git operations.

## Historical Names

Older docs, handoffs, archived code, and chat transcripts may mention previous project names or previous directory names. Treat those as historical unless a current file or user instruction says otherwise.

The current product name is Fusion Studio. The current active code directories are `fusion-studio-client/` and `fusion-studio-server/`.
