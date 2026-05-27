---
title: Trigger System
description: Trigger loading, dispatch, and event matching mechanics.
icon: bolt
---

# Trigger System

## Trigger Loader

`lib/triggers/trigger-loader.js` scans `agents-viewer/triggers/` for `.json` trigger definitions.

### Trigger Definition
```json
{
  "id": "auto-lint",
  "type": "file",
  "pattern": "*.js",
  "action": "run_script",
  "target": "scripts/lint.sh"
}
```

## Dispatch

The trigger dispatcher subscribes to the event bus:
- `file:modified` → matches `pattern` against path
- `cron:tick` → matches `schedule` expression
- `chat:message` → matches `regex` against content

## Execution

Matched triggers spawn via `lib/runner/run-folder.js` with a 45-minute timeout.
