# Getting Started

Welcome to **Fusion Studio** — a local AI agent workbench. This is not a chat app. It is a control panel for running AI agents against your code, managing workspaces, and tracking work through a structured pipeline.

---

## What You're Looking At

Fusion Studio has four main panels:

| Panel | Purpose |
|-------|---------|
| **Files** | Browse and edit code. Chat is threaded per file. |
| **Issues** | Ticket board — incoming work, assigned agents, completion tracking. |
| **Wiki** | This page. Living reference docs for architecture, decisions, and how-tos. |
| **Agents** | Live view of background agents, their status, and pending tickets. |

The **Fusion button** (bottom-right corner) opens the system overlay — chat with your primary agent, switch harnesses (Kimi, Claude Code, Codex, etc.), and access settings.

---

## Core Concepts

### Workspaces
A workspace is a project root on disk. Fusion Studio can switch between them. Each workspace has its own threads, tickets, and wiki.

See: [Workspaces Explained](Workspaces-Explained)

### Agents
AI assistants that run inside Fusion Studio. There are two kinds:
- **Foreground agents** — the one you're chatting with right now in the Fusion overlay.
- **Background agents** — autonomous workers that process tickets from the Issues board.

### The Pipeline
Work moves through stages:

```
Launch → Preflight → Build → Approval → Complete
```

- **Launch** — Create a spec for what you want built.
- **Preflight** — Plan the implementation, check for risks.
- **Build** — Code it.
- **Approval** — Validate it matches the spec.
- **Complete** — Merge, document, done.

### Skills
Reusable capabilities that extend what agents can do. Examples: `bulletin` (task tracking), `wiki` (knowledge base), `email` (quick chat). Skills live in the `skills/` folder.

---

## Common Tasks

### Restart the server
```bash
bash ~/Projects/Fusion-Home/restart-fusion.sh
```

### Switch workspaces
Use the workspace switcher in the Fusion overlay (gear icon → Workspaces).

### Start a new thread
In any panel with chat, click **+ New Thread**. Threads can be:
- **Project scope** — about the whole workspace
- **View scope** — about the current file/panel

### File a ticket
In the Issues panel, click **+ New Ticket**. Tickets route to background agents by type and domain.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ + Shift + F` | Open Fusion overlay |
| `⌘ + K` | Quick command palette |
| `Esc` | Close overlay / popup |

---

## Where Your Data Lives

| File / Folder | What It Is |
|---------------|-----------|
| `fusion-studio-server/data/fusion.db` | SQLite database — workspaces, threads, tickets, wiki index |
| `ai/views/chat/threads/` | Markdown chat history (per user, per view) |
| `ai/views/wiki-viewer/content/` | Wiki pages (collections, topics, pages) |
| `/tmp/fusion-studio.log` | Server log |
| `/tmp/fusion-studio.pid` | Server process ID |

---

## Next Steps

1. Read [Workspaces Explained](Workspaces-Explained) to understand your project map.
2. Explore the Wiki panel — click through topics to learn the system.
3. Open the Fusion overlay and say hello to your agent.

---

*Last Updated: 2026-05-10*
*Updated By: wiki-agent*
*Related Task: home-collection-creation*
