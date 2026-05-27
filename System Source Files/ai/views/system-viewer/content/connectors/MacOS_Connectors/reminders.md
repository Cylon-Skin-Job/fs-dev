---
title: Apple Reminders
description: Read and create tasks through Apple Reminders.
icon: task_alt
---

# Apple Reminders

Read and create tasks through Apple Reminders. Fusion Studio uses Apple's EventKit framework for sync-safe access.

---

## How It Works

- **Read:** EventKit API
- **Write:** EventKit API
- **Permission:** Reminders

EventKit is the only sync-safe approach. Direct SQLite bypasses iCloud sync and risks corruption. EventKit is also ~3,000× faster than AppleScript.

---

## Required Permission

In order for Fusion Studio to access your reminders, it must be authorized under **System Settings → Privacy & Security → Reminders**.

If Fusion Studio does not appear in the list, enabling the connector triggers the system prompt. A previous denial can be reversed by manually turning the toggle on in System Settings.

---

## Status Reference

| Color | Meaning |
|-------|---------|
| **Gray** | Connector is off. |
| **Yellow** | Waiting for permission or syncing for the first time. |
| **Green** | Connected and active. |
| **Red** | Error. Check that Reminders access is granted in System Settings. |
