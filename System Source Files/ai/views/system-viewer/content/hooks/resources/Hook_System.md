---
title: Hook System
description: Hook registry, invocation, and CLI bridging.
icon: link
---

# Hook System

## Registry

`lib/harness/registry.js` maintains the hook registry. Hooks are loaded from `System Files/hooks/` at startup.

## Invocation

Hooks are invoked via the event bus:
```
emit('hook:invoke', { hookId: 'git-status', args: [] })
```

## Output Parsing

Hooks define an `output` field:
- `lines` — split stdout by newline
- `json` — parse as JSON
- `raw` — return untouched stdout

## Error Handling

Non-zero exit codes emit `hook:error` with `exitCode`, `stderr`, and `signal`.
