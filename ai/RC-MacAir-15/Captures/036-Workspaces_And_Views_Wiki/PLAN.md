---
name: Workspaces and Views Wiki Plan
description: Owner direction, proposed article structure, and implementation gaps for rebuilding the Workspaces and Views wiki.
metadata:
  source-files:
    - fusion-studio-server/lib/workspace/workspace-controller.js
    - fusion-studio-server/lib/workspace/create-service.js
    - fusion-studio-server/lib/workspace/ai-paths.js
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/views/workspace-registry-writer.js
    - fusion-studio-client/src/components/ContentArea.tsx
    - fusion-studio-server/lib/view-state/thread-worksurface.js
    - fusion-studio-server/lib/harness/opencode/index.js
  last-modified: "2026-09-21T08:54:49Z"
---

# Workspaces and Views Wiki Plan

Status: planning record for discussion before a documentation SPEC. This is not an implementation SPEC, an approved execution bundle, or authorization to change product code. Owner direction below was supplied in this conversation on 2026-09-21. Current observations are bounded source inspection of the development checkout, not runtime verification or Alpha certification.

## Purpose

Rebuild this wiki section around the intended workspace/view/plugin model. Explain approved direction plainly while separately identifying existing behavior and unfinished implementation. The completed wiki should later support extracting unfinished work into a master plan; this document does not schedule that work or certify its completeness.

## Owner-approved direction

1. Views become plugins. A view plugin contains a sample view folder/template plus supporting resources. Plugins can contain additional folders; a future schema gives recognized folders and declarations meaning to the server and its registration/storage machinery. The exact schema is not yet settled.
2. Workspace plugins declare workspace compositions, such as a code-repository workspace with six selected views and dependencies on the corresponding view plugins. Users can adjust the composition, such as selecting four of the six. The six-view example is not an approved default inventory.
3. Provisioning is server-owned. Creating a workspace resolves its declared view plugins, copies their view templates into the workspace, and initializes required configuration and state. Adding a view uses the corresponding server-owned mechanism. AI is not required to improvise this predictable installation procedure.
4. The installed view folder contains its agent persona, specific skills, sub-agent definitions, workflows, instance configuration, theme, and state. It points to its plugin for display/content/tab behavior. It is more than a thin pointer.
5. Installed view folders move out of protected System and into the workspace ai tree so agents can modify their supported configuration and local agent resources. The exact destination path and machine-scoping treatment remain unresolved; do not silently choose ai/Views or ai/<machine>/Views.
6. View plugins remain inside System. Their implementation and capabilities are protected from ordinary agent modification. Plugin changes require the user to enter the plugin management/editing flow. This is an intended boundary, not a claim of complete current enforcement.
7. Editable view configuration cannot grant new database access, file authority, background execution, or executable display capabilities. It configures behavior within the plugin's approved capabilities. Plugin-reference changes and content-root changes cannot be authority bypasses. The enforcement mechanisms still need specification and verification.
8. A plugin carries its own usage/customization/maintenance instructions and scripts. Use deterministic scripts or simple tools for predictable changes; AI interprets requests and coordinates those operations where useful. Keep specialized instructions with the plugin and copied instance resources rather than reproducing every procedure in the central wiki.
9. Plan the wiki according to this intended model. Explicitly preserve the difference between approved direction, observed implementation, and unfinished work.

## Current implementation and the provisioning correction

Plugin-based workspace/view provisioning described above is not implemented. Existing create-service code already performs narrower bundled-template scaffolding from System_Manager/ai-template. Existing Add View similarly copies a bundled template. That older copying behavior must not be presented as completion of the proposed plugin provisioning model, nor should the wiki incorrectly claim that no server-side scaffolding exists at all.

Other inspected facts:

- Workspace registration points to a canonical project folder and rejects duplicate registrations of that folder. Git is not required. Add Project currently requires an existing ai directory; Create New accepts a missing or empty target.
- Add Project now registers first and prepares views/bootstrap afterward. A registration can exist with unavailable views. The current Adding Workspaces article describes an older sequence.
- View discovery uses ai/<machine>/System/Views today. Stable identity comes from metadata.view-id; numeric folder prefixes order the views. Content-root resolution is separate from the capsule location.
- The current normal Add View path permits one installation per template identity. Built-in React dispatch is keyed by fixed view IDs. Repeated independently configured instances backed by one plugin definition require further product work.
- Current default creation selects capture-viewer, file-viewer, wiki-viewer, issues-viewer, and agents-viewer. The old doc-viewer identifier in the wiki is stale.
- Workspace/view state and per-Thread/group worksurface state have separate ownership. Chat System remains the authority for group/session identity, Side Chats, and current versus intended chat placement.
- The inspected OpenCode launch uses the project root as cwd. A view folder containing persona/skills does not establish that the harness discovers or assembles them. End-to-end per-view context loading must be separately verified or classified as unfinished.
- Template declarations alone do not prove rendered behavior or a finished view. Some still name popup chat positions; some catalog entries lack dedicated built-in renderer mappings. A human-readable catalog must distinguish available implementation, placeholders, and target behavior.

## Proposed wiki structure

Reuse and rebuild the existing Workspaces And Views section rather than add a competing section. Exact numbering is deferred to the documentation SPEC.

| Article | Purpose |
|---|---|
| Overview | Explain project folder, workspace registration, view plugin/definition, installed view instance, content root, and tab in plain language. Route to the intent and current-reference articles. |
| Vision and Decisions under the overview | Preserve the owner-approved model above, with explicit unfinished behavior and genuinely unresolved choices. |
| Project Folders and Workspaces | Explain registration, folder binding, machine identity, ribbon membership, and the difference between attaching and creating. |
| Workspace Compositions and Provisioning | Explain intended workspace plugins, selected view dependencies, server-owned creation, and the narrower existing template scaffolding. |
| View Plugins and Installed Views | Explain definition versus copied instance, the protected plugin/editable instance boundary, and one definition supporting multiple instances as direction. |
| Content, Configuration, and Agent Resources | Explain content roots, instance configuration, persona/skills/sub-agents/workflows, and the boundary between configuration and authority. Link shared platform and harness details to their owners. |
| Tabs and Remembered State | Explain content tabs, view state, and per-Thread content continuity at a human level. Link to Chat System instead of redefining its identities or unfinished UI decisions. |
| View Catalog | Short factual introductions to current views, with status, content source, code references, and pointers to their specialized documentation. |
| Developer Map | A compact source-owner map for discovery, registration, provisioning, mounting, and state. Keep specialist internals with their owner. |

The main knowledge articles must not narrate future behavior in an unqualified present tense. Keep explicit labels for current implementation and approved target wherever they meet. Existing authoring guidance separates intent from knowledge; the overview's intent articles can carry the full target model while technical references report the current code and link to the relevant target.

## Unfinished-work recording

Use a small, consistent body section on each affected article: approved behavior, current limitation, remaining capability, owning subsystem, and unresolved decisions if any. Record a bounded source-inspection date/scope separately from last-modified. Do not introduce relationship-edge metadata or treat a timestamp as evidence of implementation.

Initial subjects to track, without assigning build order:

- Recognized plugin folder/declaration schema and workspace composition/dependency handling.
- Server provisioning from installed view plugins, including configuration/state initialization and visible failure handling.
- Relocation of editable view instances outside System, with existing identity/state preserved as specified by later implementation work.
- Multiple view instances backed by one definition, including renderer dispatch independent of an instance's unique identity.
- Loading view-local agent resources into the actual harness context.
- Enforcing the protected-plugin/editable-instance boundary across supported mutation and configuration paths; existing protection must be inspected rather than assumed absent or complete.
- Lifecycle behavior for plugin changes and existing copied instances: updates, disablement, removal, and retained customization.

A later master-plan effort can collect these entries. This wiki pass does not need to settle every product question first and does not claim to enumerate all unfinished work across Fusion.

## Open decisions that must remain visible

- Exact installed-view path and whether project content is shared across machines while configuration/state remains local.
- What updates to a plugin template do to an already customized installed view.
- Exact dependency behavior when a required plugin is missing, disabled, or incompatible; the owner's example assumes dependencies are already installed.
- Plugin/view binding and editable configuration schemas, validation, and the user-mediated plugin editing lifecycle.
- Whether adding an existing ordinary folder should initialize ai automatically. This is an assistant recommendation from the investigation, not an owner-adopted requirement.

## Assimilation and documentation boundaries

Retain useful explanations from Workspace Paradigm, View Architecture, Adding Workspaces, View Activity And Collections, and shared themes/state references after checking their claims. Replace duplicate ownership explanations with links. Relocate view-specific technical knowledge only when its destination exists and links can be repaired; do not discard useful Office/Wiki/editor details merely to shorten navigation.

Plugin usage recipes belong with the plugin. The central wiki explains how to find them and the platform contract they must obey. Chat System and Events And Ledger remain their own authorities. The earlier plugin design archive and captures are research inputs; the owner's newer direction supersedes conflicting claims that instances must remain thin or stay inside System. Do not rewrite unrelated plugin captures or other sessions' execution evidence as part of this planning record.

## Requirements for the later documentation SPEC

Define exact page ownership and a keep/rewrite/move/archive map, retain exact predecessor snapshots, protect concurrent changes, preserve or regenerate navigation through its owning tooling, check links and source-file paths, and apply the current source-files/last-modified schema with no authored edges. Explain every stale assertion corrected and every remaining product gap. No product code, server restart, database migration, publishing, or Alpha operation belongs in the documentation SPEC unless separately authorized.
