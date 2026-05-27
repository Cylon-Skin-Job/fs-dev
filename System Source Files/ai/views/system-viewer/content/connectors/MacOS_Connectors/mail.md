---
title: Apple Mail
description: Read message metadata and manage drafts through Apple Mail.
icon: mail
---

# Apple Mail

See your emails and create drafts without opening Mail.app. Fusion Studio reads from Mail's internal database and sends draft commands directly to the app.

---

## What This Means

**Read message metadata** — Fusion Studio can see who sent you mail, the subject line, when it arrived, and whether you have read it. It does this by reading Mail's internal database file directly, which is fast and does not require Mail.app to be open.

**Manage drafts** — Fusion Studio can create new draft emails that appear in your Mail drafts folder. It does this by sending commands to Mail.app through AppleScript, which is the safe way to write data into Mail.

**Why two different approaches?** Reading directly from the database is ~1,400× faster than asking Mail.app for every message. But writing directly to the database risks corrupting it, so drafts are created through AppleScript — the same way a user clicking buttons in Mail.app would create them.

---

## How It Works

- **Read:** SQLite on `~/Library/Mail/V10/MailData/Envelope Index`
- **Write:** AppleScript (drafts only)
- **Permission:** Full Disk Access

---

## Required Permission

In order for Fusion Studio to read from the Mail database, **Full Disk Access** must be enabled.

**System Settings → Privacy & Security → Full Disk Access → Fusion Studio**

If Fusion Studio is not in the list, add it via the **+** button. macOS may prompt for a restart after the change.

> **Note:** If Fusion Studio is running when the permission is changed, macOS typically requests a quit and relaunch before the change takes effect.

---

## Status Reference

| Color | Meaning |
|-------|---------|
| **Gray** | Connector is off. |
| **Yellow** | Waiting for permission or syncing for the first time. |
| **Green** | Connected and active. |
| **Red** | Error. Check that Full Disk Access is granted in System Settings. |
