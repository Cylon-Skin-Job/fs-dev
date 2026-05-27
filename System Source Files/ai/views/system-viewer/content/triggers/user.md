---
title: Triggers
description: Event-driven automation hooks that fire on filesystem or schedule events.
icon: bolt
---

# Triggers

Automated actions that fire when specific events occur. Use these to build hands-off workflows like auto-formatting on save or scheduled backups.

---

## Trigger Types

| Type | Event Source | Example |
|------|-------------|---------|
| **File** | Filesystem watcher | Auto-lint on `.js` save |
| **Schedule** | Cron expression | Daily backup at 2 AM |
| **Chat** | Message pattern | Create ticket on "TODO:" |
| **Bus** | Event bus event | Notify on `ticket:claimed` |

## Managing Triggers

Triggers are defined in `System Files/ai/views/agents-viewer/triggers/` and loaded at startup.
