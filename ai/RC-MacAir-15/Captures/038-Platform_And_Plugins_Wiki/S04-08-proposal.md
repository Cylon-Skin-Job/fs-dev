---
name: View Configuration And Agents
description: Separates editable view-instance resources from protected plugin behavior and current harness context loading.
metadata:
  source-files:
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/views/panel-paths.js
    - fusion-studio-server/lib/view-state/resolver.js
    - fusion-studio-server/lib/harness/opencode/index.js
    - fusion-studio-server/lib/harness/compat.js
    - fusion-studio-server/lib/ws/thread-ws-handlers.js
    - fusion-studio-client/src/components/ContentArea.tsx
  last-modified: "2026-09-21T13:37:22Z"
---

A workspace's **view instance** is the editable local configuration for one installed view. In the approved model, its folder contains ordinary configuration, a content-root reference, theme and state, an agent persona, AGENTS.md, skills, special sub-agent definitions and workflows supplied by a copied plugin template. It points to a protected **view plugin** that supplies display, content and tab behavior and declares capabilities. A workspace plugin selects the view plugins for a starting composition; it does not grant an instance new powers. See [View Architecture](../002-View_Architecture/PAGE.md) and [Workspace Compositions](../021-Workspace_Compositions/PAGE.md).

## Approved configuration boundary

Editable instance resources move outside `System` into the workspace `ai` tree. The exact destination and shared versus machine-specific placement are open (WV-O01). A person or assistant can tailor the instance's persona, skills, workflow, theme and content binding within the installed plugin's capabilities. A local edit must not independently add database access, unrestricted file access, background processes or executable display behavior. The protected plugin controls those permissions and behavior; changing that plugin requires the user-mediated plugin-edit route. The folder/declaration schema, binding validation and edit workflow remain open (WV-O04). Plugin-specific how-to knowledge belongs with the plugin, using a script or simple tool for predictable edits when possible.

A content root is distinct from the instance folder. A configured root may point elsewhere under supported current declarations, but the target must validate that binding against the plugin's granted scope. The user may change where a view reads content without turning its editable files into a new capability source. This is an approved boundary, not a claim that the full plugin enforcement path exists now.

## Approved agent orientation

The agent starts with its own view-instance folder as working directory, while knowing the project root and retaining authorized project-wide working access. System and protected plugin boundaries still apply; project scope does not authorize direct protected mutations. The server provisions the separate editable template copy and binding. An instruction file or copied template does not confer executable powers. [Plugin Templates And Instances](../../011-Platform_And_Plugins/002-Plugin_Templates_And_Instances/PAGE.md) owns that distinction.

The instance's own AGENTS and persona enter harness context. Its skills are exposed through the harness as an available catalog, with their bodies read on demand rather than necessarily pasted into initial context. Other views' instructions and skills are deliberately read when requested, not automatically injected into every view's context. Manual reads do not automatically rebind identity, change working directory or grant capabilities. Harness-specific discovery, context assembly, skill collision handling and enforcement remain WV-O06 mechanics; the intended orientation is settled.

## Current implementation and gap

Today `views/index.js` discovers numbered capsules in `ai/<machine>/System/Views/`, reads their `manifest.md`, `content.json` and styles, and `panel-paths.js` resolves access through that registry. `view-state/resolver.js` locates each capsule's `state/state.json` and merges it with workspace defaults. The renderer's built-in dispatch is still a fixed component map in `ContentArea.tsx`. This is current implementation, not the relocated instance or plugin-binding design.

**WV-G04 — view-local agent context:** in the inspected activation route, `thread-ws-handlers.js` passes the workspace manager's project root through `harness/compat.js` to OpenCode. The adapter uses that supplied `projectRoot` for `--dir` and the spawned process working directory; it does not switch that launch to a view-instance folder. These source paths and the view registry do not establish the intended local persona/AGENTS/skills/sub-agent/workflow assembly end to end. Adding files alone would not prove that a chat launched in that view receives them, and this bounded inspection is not proof that no other context mechanism exists. Harness/context integration must implement the settled orientation and resolve working-directory setup, discovery, assembly, skill collision handling and enforcement (WV-O06). No runtime verification is claimed.

**WV-G05 — capability enforcement and relocation:** the current registry, path resolver and fixed renderer do not implement plugin-defined permissions or the approved outside-System instance placement. The product work must bind each editable instance to an installed protected plugin and enforce capabilities at actual server/display interfaces. Existing purpose-built view-state and path checks still apply; their presence does not prove the entire future protection model, and this gap does not mean all current checks are absent. See [System Manager](../011-System_Manager/PAGE.md) for the protected side and [View Activity And Collections](../013-View_Activity_And_Collections/PAGE.md) for current state ownership.
