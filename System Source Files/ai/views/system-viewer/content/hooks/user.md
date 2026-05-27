---
title: Hooks
description: CLI integration points that bridge Fusion Studio with external tools.
icon: link
---

# Hooks

CLI integration points that let agents call external tools and receive structured output. Define a hook once, then invoke it by name from any agent.

---

## How Hooks Work

1. Define a hook in `System Files/hooks/` with a JSON manifest.
2. The manifest specifies the CLI command, arguments, and output format.
3. Agents call hooks by name via the event bus.

## Hook Manifest

```json
{
  "id": "git-status",
  "command": "git",
  "args": ["status", "--short"],
  "output": "lines"
}
```
