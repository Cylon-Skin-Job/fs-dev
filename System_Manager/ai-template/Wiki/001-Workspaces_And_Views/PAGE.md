---
name: Workspaces And Views
description: Navigation map for product workspace architecture and user-facing view surfaces.
metadata:
  incoming-edges:
    - Wiki Guide
  outgoing-edges:
    - Workspace Paradigm
    - View Architecture
    - Chat System
    - Wiki View
    - Browser
    - Custom Iframe
    - File View
    - Agent View
    - Issues View
    - Voice Input
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Use this section for product/workspace/view architecture and user-facing surfaces.

## Children

- [Workspace Paradigm](001-Workspace_Paradigm/PAGE.md) - conceptual rulebook for workspace identity, ownership, activation, and boundaries.
- [View Architecture](002-View_Architecture/PAGE.md) - how views are discovered, mounted, served, and related to workspace content roots.
- [Chat System](003-Chat_System/PAGE.md) - chat runtime from the user's perspective, rendering model, protocol references, and lessons.
- [Wiki View](004-Wiki_View/PAGE.md) - folder-first wiki architecture, interface, frontmatter, and terminal access.
- [Browser](005-Browser/PAGE.md) - general internet-capable browser surface for web navigation, testing, and automation.
- [Custom Iframe](006-Custom_Iframe/PAGE.md) - local-server iframe display for user-created custom views; not for internet browsing.
- `007-File_View/` - file browsing and file-viewer behavior.
- `008-Agent_View/` - planned/underdeveloped agent surface.
- `009-Issues_View/` - planned/partial ticketing surface.
- [Voice Input](010-Voice_Input/PAGE.md) - mic input, Whisper transcription, deterministic cleanup rules, and voice-to-chat behavior.

## Migration Sources

- [Chat System](003-Chat_System/PAGE.md)
- [Wiki View](004-Wiki_View/PAGE.md)
- Legacy Browser Views content was split into [Browser](005-Browser/PAGE.md) and [Custom Iframe](006-Custom_Iframe/PAGE.md).

This page is intentionally a short navigation map. Durable architecture content should live in child pages as the migration proceeds.
