---
title: Skill System
description: Skill loading, invocation, and registry mechanics.
icon: psychology
---

# Skill System

## Skill Loading

Skills are discovered at startup by scanning `System Files/skills/` and `~/.kimi/skills/`.

### Skill Structure
```
skills/
├── SKILL.md          # instructions, examples, reference
├── scripts/          # optional helper scripts
└── assets/           # optional templates
```

### SKILL.md Format
- `## Contents` — what the skill provides
- `## Reason` — when to invoke
- `## Intention` — what the user says to trigger

## Registry

The skill registry is maintained in-memory. No persistence layer — skills are filesystem-only.

## Invocation

Users invoke skills by:
1. Slash commands (`/build`, `/plan`, `/validate`)
2. Natural language triggers ("check my work", "did we miss anything?")

## Pipeline Integration

The `build` skill reads orchestrated plans from `pipeline/build/` and executes steps with embedded validation scripts.
