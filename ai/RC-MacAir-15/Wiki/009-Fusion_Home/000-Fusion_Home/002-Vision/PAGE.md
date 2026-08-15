---
name: Fusion Home Vision
description: Where Fusion Home is headed - the templated workspace that ships with the app and showcases office apps running on the shared SQLite layer, with progressive disclosure.
metadata:
  incoming-edges:
    - Fusion Home
  outgoing-edges:
    - Fusion Home
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Bite-size vision for the Fusion Home domain. Details live in the view and
editor-surface articles.

## What Fusion Home Shows

Fusion Home is the **templated workspace that ships with Fusion Studio**. Its job
is to showcase a handful of office apps that run on the shared SQLite layer —
[Documents](../../005-Documents/PAGE.md), [Sheets](../../006-Sheets/PAGE.md),
[Pdfs](../../007-Pdfs/PAGE.md), [Artifacts](../../008-Artifacts/PAGE.md) — hosted by
the [Office Viewer](../../001-Office_Viewer/PAGE.md), alongside standalone views
([Calendar](../../002-Calendar_Viewer/PAGE.md), [Email](../../003-Email/PAGE.md),
[ToDo](../../004-ToDo/PAGE.md)).

These apps do **not** drop into new workspaces automatically; they can be added
by user action. Fusion Home is a peer to
[System Manager](../../../006-System_Manager/PAGE.md), which shows how Capture and
basic file/code management get catalogued.

## Progressive Disclosure

The structure mirrors progressive disclosure: the Fusion Home heading gives the
model (views vs. editor surfaces); each app article gives the user-facing
behavior; each sub-article (e.g. [Tables](../../005-Documents/004-Tables/PAGE.md))
goes technical. A reader can stop at the depth they need.

## Where It's Going

- Fill out the stub views (Calendar, Email, ToDo) and editor surfaces (Sheets,
  Pdfs, Artifacts) as each is built.
- Keep the Office Viewer's own sub-articles (layout, search, starred/pinned) as
  the canonical home for view-level behavior.
- Treat this Vision page as the durable "why," not the "how."
