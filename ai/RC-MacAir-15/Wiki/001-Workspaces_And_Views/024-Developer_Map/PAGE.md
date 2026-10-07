---
name: Workspaces And Views Developer Map
description: Current code entry points and documentation routes for workspace registration, view discovery, rendering, state, and bundled templates.
metadata:
  source-files:
    - fusion-studio-server/lib/workspace/workspace-controller.js
    - fusion-studio-server/lib/workspace/registry-service.js
    - fusion-studio-server/lib/workspace/create-service.js
    - fusion-studio-server/lib/workspace/bootstrap-service.js
    - fusion-studio-server/lib/workspace/ai-paths.js
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-server/lib/ws/workspace-request-handlers.js
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/views/view-id.js
    - fusion-studio-server/lib/views/workspace-registry-writer.js
    - fusion-studio-server/lib/views/panel-paths.js
    - fusion-studio-server/lib/view-state/resolver.js
    - fusion-studio-server/lib/harness/opencode/index.js
    - fusion-studio-client/src/components/WorkspaceCreateModal.tsx
    - fusion-studio-client/src/components/ContentArea.tsx
  last-modified: "2026-09-21T13:37:22Z"
---

Start with the [section overview](../000-Workspaces_And_Views/PAGE.md) for terminology. This map names current code owners for a source inspection; it does not certify a running build or imply that the [approved plugin model](../000-Workspaces_And_Views/001-Vision/PAGE.md) has shipped. `ai/<machine>/System/Views/` below is an observed current path. The editable-instance destination outside `System` is still an open design choice.

## Workspace registration and creation

`fusion-studio-client/src/components/WorkspaceCreateModal.tsx` presents Create New and the current bundled default choices. Server request routing enters `fusion-studio-server/lib/ws/client-message-router.js` and its `workspace-request-handlers.js`; `fusion-studio-server/lib/workspace/workspace-controller.js` validates, registers and activates folders through `registry-service.js`, while `create-service.js` copies bundled templates for a new workspace. `bootstrap-service.js` handles the narrower existing-folder bootstrap. `ai-paths.js` resolves machine-scoped paths. Read [Workspace Paradigm](../001-Workspace_Paradigm/PAGE.md), [Adding Workspaces](../003-Adding_Workspaces/PAGE.md) and [Workspace Compositions](../021-Workspace_Compositions/PAGE.md) together before changing the lifecycle. Workspace folder registration and plugin-aware provisioning are different operations (WV-G01–02).

## View definition, instance and render route

`fusion-studio-server/lib/views/index.js` discovers current numbered capsules and resolves content declarations; `view-id.js` and `workspace-registry-writer.js` own present identity/projection behavior, and `panel-paths.js` is a server access route. `fusion-studio-client/src/components/ContentArea.tsx` selects built-in components by known IDs and handles configured iframe surfaces. Inspect [View Architecture](../002-View_Architecture/PAGE.md) and [View Configuration And Agents](../022-View_Configuration_And_Agents/PAGE.md) before changing binding or capabilities (WV-G03, WV-G05). The protected plugin declaration and repeatable-instance dispatch are intended work, not code owners that already exist here.

## State, context and domain surfaces

`fusion-studio-server/lib/view-state/resolver.js` resolves current per-view state alongside workspace defaults. The [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md) article distinguishes current view state from [Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md) group/session authority; the [Server And Runtime](../../002-Server_And_Runtime/PAGE.md) and [Persistence And Metadata](../../005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md) pages carry broader service and durability boundaries. `fusion-studio-server/lib/harness/opencode/index.js` is the inspected harness launch route, not evidence that instance-local personas and skills are assembled (WV-G04). The [View Catalog](../023-View_Catalog/PAGE.md) routes to each of the 13 bundled template introductions and the System surface. Template manifests under `System_Manager/ai-template/templates/view-templates/` are provisioning inputs; a manifest alone does not establish a mounted feature.

## Specialist references and inspection limit

The deeper [Wiki architecture](../004-Wiki_View/001-Architecture/000-Architecture/PAGE.md), [Voice Input](../010-Voice_Input/000-Voice_Input/PAGE.md) and [Fusion Home](../../009-Fusion_Home/000-Fusion_Home/PAGE.md) documentation remains available for specialist details. Those articles were not recertified as part of this workspace/view reconstruction. [Events And Ledger](../../010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md) owns provenance and event contracts, including its calendar/storage findings. Follow the [Unfinished Work](../000-Workspaces_And_Views/003-Unfinished_Work/PAGE.md) index for the bounded capabilities still to build, then re-check the current producer and consumer code before using a wiki claim to implement them.
