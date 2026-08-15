---
title: Skills
description: Workspace-local AI skills, when to use them, and where they live.
---

# Skills

Skills are project-local behavior guides for AI assistants. They help the assistant choose the right mode before acting.

## Location

Workspace skills live at:

```text
.claude/skills/<skill-name>/SKILL.md
```

This location is intentionally portable: Claude-compatible tools and OpenCode can discover skills from `.claude/skills`.

## Default Skills

- `clarify` - ask one question at a time until intent and decisions are explicit.
- `curiosity` - explore ideas without rushing into implementation.
- `captures` - save loose ideas or lightweight to-do items for later.
- `wiki` - read, update, and cross-link workspace wiki pages.
- `issues-ticketing` - manage local issues and reusable ticket templates.
- `spec` - shape implementation intent into specs and vertical slices.
- `pre-flight` - prepare specs for targeted handoff slices with smoke tests.
- `background-agents` - prepare autonomous worker handoffs and evidence loops.
- `review` - evaluate completed or proposed work for risks and missing validation.
- `git` - inspect repository state, auth, remotes, sync, and commit flow.
- `system` - respect protected system boundaries and System Manager ownership.

## Rule Of Thumb

Use skills to choose the right posture:

- Exploring? Use `curiosity`.
- Unsure? Use `clarify`.
- Saving loose ideas? Use `captures`.
- Planning implementation? Use `spec`, then `pre-flight`.
- Reviewing? Use `review`.
- Touching protected system behavior? Use `system`.

## Notes

Do not put secrets in skill files. Use skills for guidance, references, and safe workflow boundaries.
