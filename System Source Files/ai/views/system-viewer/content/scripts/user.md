---
title: Scripts
description: Standalone automation scripts for repetitive tasks and workflows.
icon: code
---

# Scripts

Standalone executables that automate tasks. Trigger them manually, schedule them with triggers, or call them from agents.

---

## Running Scripts

1. Place scripts in `System Files/scripts/`.
2. Mark them executable (`chmod +x`).
3. They appear in the Scripts tab for manual execution.

## Script Environment

Scripts receive the workspace root as `$PROJECT_ROOT` and can write to `System Files/ai/system/state/`.
