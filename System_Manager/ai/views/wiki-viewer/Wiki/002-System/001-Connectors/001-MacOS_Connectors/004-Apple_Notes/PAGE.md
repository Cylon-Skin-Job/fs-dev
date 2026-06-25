---
title: Apple Notes
description: Read and write notes through Apple Notes.
icon: note_stack
---

# Apple Notes

Read and write notes through Apple Notes. Fusion Studio uses AppleScript because Notes does not expose a modern developer API.

---

## How It Works

- **Read:** AppleScript
- **Write:** AppleScript
- **Permission:** Automation (AppleEvents)

Direct SQLite access is possible for metadata, but the note body lives in a gzip-compressed proprietary binary blob that changes between MacOS versions. AppleScript returns clean text and is the stable choice.

---

## Required Permission

In order for Fusion Studio to read and write notes, **Automation** must be enabled.

**System Settings → Privacy & Security → Automation → Fusion Studio → Notes**

The first time a note is created, macOS may display a one-time dialog asking if Fusion Studio can control Notes. Click **OK**.

> **Important:** If the one-time dialog is dismissed with **Don't Allow**, access can be restored by returning to **System Settings → Privacy & Security → Automation**, locating Fusion Studio → Notes, and turning the toggle back on.

---

## Status Reference

| Color | Meaning |
|-------|---------|
| **Gray** | Connector is off. |
| **Yellow** | Waiting for permission or syncing for the first time. |
| **Green** | Connected and active. |
| **Red** | Error. Check that Automation for Notes is granted in System Settings. |
