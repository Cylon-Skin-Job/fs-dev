---
title: Skills
description: Reusable capabilities that extend Fusion Studio and CLI agents.
icon: psychology
---

# Skills

Self-contained capabilities that extend what Fusion Studio and CLI agents can do. Each skill is a directory with a `SKILL.md` file that defines its behavior.

---

## How Skills Work

1. Place a skill directory in `System Files/skills/`.
2. Include a `SKILL.md` with instructions, examples, and reference material.
3. Invoke the skill by name from pipeline bots or directly from chat.

## Active Skills

| Skill | Scope | Description |
|-------|-------|-------------|
| `check` | Project | Final validation before implementation |
| `plan` | Project | Structured planning workflow |
| `build` | Project | Plan execution with validation checkpoints |
| `guidance` | Project | Code quality guardian |
| `validate` | Project | Retrospective gap detection |

## Creating a Skill

See `projects/skill-command/skills/README.md` for the skill creation guide.
