---
title: Apple Calendar
description: Read and create events through Apple Calendar.
icon: calendar_month
---

# Apple Calendar

Read and create events through Apple Calendar. Fusion Studio uses Apple's EventKit framework for safe, sync-aware access.

---

## How It Works

- **Read:** EventKit API
- **Write:** EventKit API
- **Permission:** Calendar

EventKit handles iCloud, Google, and Exchange calendars correctly. Direct SQLite access is possible but bypasses sync and risks corruption.

---

## Required Permission

In order for Fusion Studio to access your calendars, it must be authorized under **System Settings → Privacy & Security → Calendars**.

The first time the Calendar connector is enabled, macOS displays a system dialog asking for access. If access was previously denied, the toggle must be turned on manually in System Settings.

---

## Status Reference

| Color | Meaning |
|-------|---------|
| **Gray** | Connector is off. |
| **Yellow** | Waiting for permission or syncing for the first time. |
| **Green** | Connected and active. |
| **Red** | Error. Check that Calendar access is granted in System Settings. |
