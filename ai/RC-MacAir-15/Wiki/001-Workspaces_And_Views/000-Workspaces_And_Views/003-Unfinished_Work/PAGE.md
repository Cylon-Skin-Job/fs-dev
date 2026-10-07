---
name: Unfinished Work In Workspaces And Views
description: Bounded register of workspace and view capabilities still needed for the approved plugin-based model.
metadata:
  source-files: []
  last-modified: "2026-09-23T13:50:37Z"
---

The [overview](../PAGE.md) separates the current application from the approved direction. This register collects the demonstrated or source-inspected limits that matter to that direction. It is a planning input, not an exhaustive app backlog or an implementation schedule. Each owning article supplies the fuller current behavior; the [Decisions](../002-Decisions/PAGE.md#open-product-choices) article keeps the product choices open. The code routes are in the [Developer Map](../../024-Developer_Map/PAGE.md). These limits were established by source inspection in the development checkout, not by running the product.

## WV-G01 — Attaching an ordinary folder

**Target:** If the owner chooses automatic initialization, an ordinary selected project folder can acquire a valid `ai` workspace tree through a defined server path. **Current limit:** Add Project requires an existing `ai` directory and rejects a folder without it; existing-folder bootstrap supplies only minimum machine-scoped `System` and `Data`, not the five default views. **Remaining capability:** decide whether automatic initialization is desired, then define the attach and bootstrap lifecycle. **Owner:** workspace controller and bootstrap service. **Decision gate:** WV-O05, before changing attach behavior. See [Workspace Paradigm](../../001-Workspace_Paradigm/PAGE.md#what-is-registered-today) and [Adding Workspaces](../../003-Adding_Workspaces/PAGE.md).

## WV-G02 — Plugin-aware composition and provisioning

**Target:** A workspace plugin declares an editable selection of view plugins; the server provisions instances from installed plugin templates and initializes their configuration and state. **Current limit:** Create New and Add View copy bundled templates; the `new` profile lists five default template IDs, and the Create New request does not carry a user-edited composition. **Remaining capability:** installed-plugin discovery, dependency resolution, selected-template copy, instance setup and lifecycle handling. **Owner:** workspace controller, create service and plugin platform. **Decision gates:** WV-O01–O04 before provisioning rules are implemented. See [Workspace Compositions](../../021-Workspace_Compositions/PAGE.md#approved-provisioning).

## WV-G03 — Repeatable instances of a view plugin

**Target:** More than one independently identified instance may refer to the same protected view plugin. **Current limit:** registry discovery and Add View require unique view IDs, while built-in rendering dispatches fixed IDs; the current `baseViewId` does not establish a separate repeatable definition identity. **Remaining capability:** distinct instance identity, validated plugin binding and renderer dispatch for multiple instances. **Owner:** view registry, renderer and plugin platform. **Decision gates:** WV-O04 for identity/binding schema and WV-O02 for instance update/remove lifecycle. See [View Architecture](../../002-View_Architecture/PAGE.md#current-view-discovery).

## WV-G04 — View-local agent context

**Target:** The agent starts in its own editable view-instance folder with project-root orientation and authorized project-wide working access, subject to protected System/plugin boundaries. Own AGENTS/persona enter harness context; own skills are available through the harness with bodies loaded as needed. Other-view instructions/skills are deliberately read when requested, without automatic identity, capability or working-directory changes. **Current limit:** the inspected OpenCode launch still uses the supplied project root for both `--dir` and process working directory; the inspected view-registry route does not establish assembly of instance-local resources. This is an unverified end-to-end context path, not proof that no other context mechanism exists. **Remaining capability:** implement the settled orientation through harness-specific working-directory setup, discovery, assembly, skill collision handling and enforcement at activation. **Owner:** harness and context assembly. **Decision gate:** WV-O06 for those mechanics before claiming end-to-end support; intended local context and manual cross-view reads are settled. See [View Configuration And Agents](../../022-View_Configuration_And_Agents/PAGE.md#current-implementation-and-gap).

## WV-G05 — Editable instance placement and capability binding

**Target:** Editable instance folders live outside `System`, reference a protected view plugin and stay within that plugin's declared capabilities. **Current limit:** the view registry still discovers `ai/<machine>/System/Views/` capsules, and fixed renderer dispatch does not enforce a new plugin-defined capability binding. Existing path and state checks remain real; this gap concerns the full intended plugin boundary. **Remaining capability:** relocate editable instances and validate plugin references, content bindings and authority at server and display interfaces. **Owner:** view registry, renderer and plugin platform. **Decision gates:** WV-O01 for placement/portability and WV-O04 for schema and enforcement workflow. See [View Configuration And Agents](../../022-View_Configuration_And_Agents/PAGE.md#current-implementation-and-gap) and [System Manager](../../011-System_Manager/PAGE.md).

## Coverage boundary

[Platform And Plugins unfinished work](../../../011-Platform_And_Plugins/000-Platform_And_Plugins/002-Unfinished_Work/PAGE.md) owns component hosting, shell/file reuse, hybrid iframe operations and external-store mediation gaps. Provisioning, instance identity, local context and placement remain under the WV IDs here.

The [View Catalog](../../023-View_Catalog/PAGE.md) labels mounted, configured-iframe, demo and template-only surfaces individually. A template-only entry does not add a new platform gap to this register by itself. [Chat System](../../../007-Chat_System/000-Overview_and_References/PAGE.md) and [Events And Ledger](../../../010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md) retain their own decisions and unfinished work. The older Wiki and Voice specialist trees remain available but were not recertified here.
