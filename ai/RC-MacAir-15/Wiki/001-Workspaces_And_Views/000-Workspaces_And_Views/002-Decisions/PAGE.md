---
name: Workspace And View Decisions
description: Approved plugin and instance boundaries, precise supersessions, and product choices that remain open.
metadata:
  source-files: []
  last-modified: "2026-09-23T13:50:37Z"
---

## Approved direction

- **Views become plugins.** A view plugin contributes templates, display/content/tab behavior, capability declarations, and maintenance resources. The folder and declaration schema that identifies those contributions is not yet settled.
- **Workspace plugins declare composition.** They select and depend on view plugins, while allowing the composition to be edited. An example with six possible views and four selected views does not set a universal inventory.
- **The server provisions instances.** It copies the selected installed plugins' view templates and initializes required configuration and state. The existing bundled-template copy path is a current implementation, not proof that plugin-aware provisioning has shipped.
- **Instances carry copied local agent resources.** The protected plugin supplies a template; the server copies it into a separate editable instance and binds that instance to the installed dependency. The copy can contain persona, AGENTS.md, skills, special sub-agent definitions, workflows, ordinary configuration, theme, and state. Copied instructions and configuration do not become privileged executable code.
- **Agent orientation is view-local within the project.** The agent starts with its own view-instance working directory and project-root orientation/access, within authorized project scope and protected System/plugin boundaries. Own AGENTS/persona enter harness context; own skills are exposed through the harness with bodies read as needed. Other-view instructions/skills are manually read when requested, not eagerly injected; reads do not automatically change identity, working directory or capabilities. WV-O06 now concerns harness-specific mechanics, not this intended behavior.
- **Plugin presentation uses platform hosts.** A useful standard library can be configured and composed, and protected plugins can contribute registered presentation components with explicit data/actions. The shell owns tabs, drawers and popup/window lifecycle. Collections can open the canonical file surface in the current tab with a return route or another tab, retaining selection/filter/navigation state; file editing and platform save/history keep their owners. See [Platform Boundaries](../../../011-Platform_And_Plugins/001-Platform_Boundaries/PAGE.md) and [Tabs, Drawers And Files](../../../011-Platform_And_Plugins/004-Tabs_Drawers_And_Files/PAGE.md).
- **Editable instances move outside System.** The exact `ai` destination and which resources are shared across machines remain open. Capability-bearing plugins remain protected in System and are changed through a deliberate, user-mediated plugin path.
- **Ordinary configuration stays within granted capabilities.** Editing a local instance must not create new database or file authority, background-process rights, or executable display behavior. A path on disk is not itself permission enforcement; the future binding and validation mechanisms need explicit design.
- **Plugin knowledge travels with its plugin.** Predictable maintenance work should use scripts or simple tools. AI can coordinate or interpret work that needs judgment; it need not perform every deterministic tweak itself.
- **The wiki distinguishes established facts from design.** Current behavior and unfinished work are both useful inputs to later planning. A recent page timestamp records an edit, not code verification or completion of the target model.

## Superseded interpretations

The older proposed rule placing every installed view under `ai/<machine>/System/Views` is superseded as a **target**. That remains the observed current code path until the product changes. The older thin-instance interpretation is superseded: local persona, skills, workflows, and configuration belong with the editable instance. A blanket claim that every persona or skill edit requires privileged System modification is likewise superseded. None of these changes grants unrestricted execution, changes System's data ownership or state services, or makes all workspace content trusted.

## Open product choices

1. **Instance location and portability:** choose the exact destination and which local resources are shared versus machine-specific before relocation.
2. **Instance lifecycle:** decide how customized copied instances receive updates and how disabling or removing one works before implementing that lifecycle.
3. **Dependencies:** decide behavior for missing, disabled, or incompatible view plugins and version matching before plugin-based provisioning.
4. **Schemas and enforcement:** define plugin folders/manifests, instance configuration, binding validation, and the user-mediated plugin-edit workflow before capability/provisioning implementation.
5. **Attaching an existing folder:** decide whether an ordinary project folder without `ai` is initialized automatically. That is a proposal, not an approved requirement.
6. **Agent context mechanics (WV-O06):** define harness-specific working-directory setup, discovery and assembly of local context, skill collision handling and enforcement before claiming end-to-end support. The view-local orientation, own AGENTS/persona context, skills available on demand and deliberate manual other-view reads are settled above; this gate does not require a new skill override/precedence model. See [View Configuration And Agents](../../022-View_Configuration_And_Agents/PAGE.md#approved-agent-orientation).

These are decision gates, not reasons to treat the approved direction as current behavior. For the observed implementation and its bounded gaps, follow the [section overview](../PAGE.md).
