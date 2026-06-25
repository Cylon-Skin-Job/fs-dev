# Tool Definition Spec Placeholder

This is intentionally unfinished for v2 template scaffolding.

Future direction:

```markdown
---
name: Calendar Tool
description: Query and update calendar data through a controlled terminal command.
metadata:
  icon-name: calendar_month
  display-label: Calendar Tool
  command: fusion-calendar
  access:
    calendar: read-write
    filesystem: none
---
```

Expected UI behavior:

- Tools can display in chat/tool menus with icon + display text.
- Example chips/items: `(icon) Loading Skill`, `(icon) Calendar Tool`, `(icon) Email Tool`, `(icon) Video Edit`.
- Tool commands are server-mediated and subject to safety constraints.
- Definitions should not grant raw terminal access by default.
- Approved tool definitions are the only way AI may alter Fusion Studio's protected internal SQLite databases.
- Generic harness scripting must be blocked from writing to internal SQLite databases.
- SQLite write tools must be named, allowlisted, permission-scoped, audited, and mediated by the server.
