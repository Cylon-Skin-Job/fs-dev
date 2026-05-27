---
title: Connectors
description: Bridge to external apps — Mail, Calendar, Notes, Reminders, Google, and Slack.
icon: linked_services
---

# Connectors Guide

How to enable Fusion Studio to interact with calendar, email, notes, tasks, and other apps.

---

## What Connectors Do

Connectors bring external apps inside Fusion Studio.

**For you:** Once a connector is enabled, you can read and manage Mail, Calendar, Reminders, and Notes without leaving Fusion Studio. Create a draft, check your schedule, or add a task — all from the same workspace.

**For the AI:** Connectors give the AI tools to act on your behalf. It can read your calendar to suggest meeting times, check unread mail to surface priorities, or create reminders from conversation context. The AI operates within the permissions you grant, never exceeding them.

**For automations:** Triggers and scripts can use connectors to run hands-free workflows — send a Slack update when a build finishes, create a calendar block for focus time, or file a draft reply based on a template.

---

## Enabling Connectors

Each connector requires a specific permission before Fusion Studio can access the underlying app. MacOS connectors need approval in **System Settings → Privacy & Security**. Google and Slack connectors use OAuth, which presents its own sign-in prompt.

The individual connector guides describe exactly which permission is required and where to find it.

---

## Available Connectors

- [Apple Mail](MacOS_Connectors/mail.md)
- [Apple Calendar](MacOS_Connectors/calendar.md)
- [Apple Reminders](MacOS_Connectors/reminders.md)
- [Apple Notes](MacOS_Connectors/notes.md)
- [Gmail](Google_OAuth/gmail.md) (coming soon)
- [Google Calendar](Google_OAuth/google_calendar.md) (coming soon)
- [Google Tasks](Google_OAuth/google_tasks.md) (coming soon)
- [Slack](Slack/slack.md) (coming soon)
