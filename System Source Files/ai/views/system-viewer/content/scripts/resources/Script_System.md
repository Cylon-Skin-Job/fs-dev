---
title: Script System
description: Script discovery, execution, and sandboxing.
icon: code
---

# Script System

## Discovery

`lib/runner/run-folder.js` scans `scripts/` for executable files.

## Execution

Scripts run in a subprocess with:
- `PROJECT_ROOT` env var set to active workspace
- 45-minute timeout
- stdout/stderr captured and returned to caller

## Security

Scripts are NOT sandboxed. The enforcement system (`lib/enforcement.js`) blocks agents from creating/modifying scripts without user approval.
