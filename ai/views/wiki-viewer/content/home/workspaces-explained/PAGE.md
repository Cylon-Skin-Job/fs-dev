# Workspaces Explained

A **workspace** is a project root on your local disk. Fusion Studio treats each workspace as an isolated context — its own threads, tickets, wiki topics, and agent configuration.

---

## The Workspace Registry

Workspaces are stored in the Fusion Studio database (`fusion.db`). Each entry tracks:

| Field | Meaning |
|-------|---------|
| `id` | Short slug — `fs-dev`, `fusion-home`, `karens-lab`, etc. |
| `label` | Human name — "FS Dev", "Fusion Home", "Karen's Lab" |
| `repo_path` | Absolute path to the project root on disk |
| `color` | UI accent color (optional) |

---

## Your Current Workspaces

| ID | Label | Path | Role |
|----|-------|------|------|
| `fs-dev` | FS Dev | `~/Projects/fs-dev` | **Primary dev workspace** — Fusion Studio itself. This is where you build and iterate on the studio code. |
| `fusion-home` | Fusion Home | `~/Projects/Fusion-Home` | **Hub & orchestration** — Restart scripts, hub configuration, cross-project tooling. The "mission control" workspace. |
| `karens-lab` | Karen's Lab | `~/Projects/karens-lab` | **Secondary project** — Independent work, experiments, or a client project. |
| `media-editor` | Media Editor | `~/Projects/media-editor` | **Secondary project** — Another independent project workspace. |

---

## How Switching Works

When you switch workspaces in the Fusion overlay:

1. The client sends a `workspace:switch` message to the server.
2. The server loads the new workspace's context from the DB.
3. All panels refresh — threads, tickets, wiki topics, and file tree update to the new workspace.
4. Your chat context changes. The agent now knows about the new project's code, not the old one.

**Important:** Switching workspaces does not close open files. It changes the *context* the agent uses to answer questions.

---

## Workspace Types

### Dev Workspace
A project you actively code in. Has:
- Full file tree access
- Threaded chat per file
- Wiki collection for architecture docs
- Issues board for tracking work

Example: `fs-dev`

### Hub Workspace
A coordination workspace. Has:
- Cross-project scripts (like `restart-fusion.sh`)
- Shared configuration
- Minimal code — mostly orchestration

Example: `fusion-home`

### Client / Secondary Workspace
An isolated project with its own codebase, threads, and tickets. Fully independent from the dev workspace.

Examples: `karens-lab`, `media-editor`

---

## Creating a New Workspace

1. Create the project directory on disk.
2. In the Fusion overlay, open **Settings → Workspaces → Add Workspace**.
3. Enter the workspace ID, label, and absolute path.
4. The workspace is registered in `fusion.db` and appears in the switcher.

---

## Workspace Cache

Fusion Studio maintains a runtime cache (`workspace-cache.json`) for each workspace. This stores:
- Current panel state
- Open threads
- View layouts and widths
- Popup positions

The cache is keyed by workspace ID and persists across server restarts.

---

## Best Practices

- **One repo, one workspace.** Don't register the same directory under multiple workspace IDs.
- **Use short IDs.** `fs-dev` is easier to type and reference than `fusion-studio-development`.
- **Keep hub scripts in Fusion Home.** Cross-project utilities (restart scripts, deploy scripts) belong in the hub, not duplicated in each workspace.
- **Name the workspace after the repo.** If the GitHub repo is `fs-dev`, the workspace ID should be `fs-dev`.

---

*Last Updated: 2026-05-10*
*Updated By: wiki-agent*
*Related Task: home-collection-creation*
