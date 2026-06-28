---
name: Chat System Compatibility Pointer
description: Compatibility pointer for the old Workspaces And Views chat page. Durable chat documentation now lives in the top-level Chat System domain.
metadata:
  incoming-edges:
    - Home
    - Workspaces
    - Workspace Agent Model
    - Workspace Index
    - Progressive Disclosure
    - Wiki Guide
    - Workspaces And Views
  outgoing-edges:
    - Chat System
  source-files:
    - fusion-studio-server/lib/thread/thread-runtime-controller.js
    - fusion-studio-server/lib/thread/thread-runtime-manager.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-client/src/lib/ws/stream-handlers.ts
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
  connected-skills: []
  related-trigger-files: []
---

Chat System is now a top-level wiki domain:

- [Chat System](../../007-Chat_System/PAGE.md)

Use the top-level domain for new chat documentation. The old architecture pages
under this folder are compatibility pointers:

- [Architecture](001-Architecture/PAGE.md)
- [Protocol](001-Architecture/004-Protocol/PAGE.md)
- [Rendering Model](001-Architecture/005-Rendering_Model/PAGE.md)
- [Runtime Model](001-Architecture/006-Runtime_Model/PAGE.md)
- [UI Surface](001-Architecture/008-UI_Surface/PAGE.md)

Do not add new chat lifecycle, protocol, metadata, chrome, or testing guidance
under this compatibility folder.
