---
name: Platform And Plugins
description: Start here for the approved roles of the shell, services, components, plugins, view instances and custom regions, with current foundations and open choices separated.
metadata:
  source-files: []
  last-modified: "2026-09-23T12:54:40Z"
---

Fusion Studio's approved composition model combines a useful built-in presentation library with protected plugin contributions. The platform hosts the result and controls access to data and actions. A view can configure familiar pieces, compose them into a useful working surface, and add a specialized component where those pieces are insufficient.

## How to read this section

**Approved direction** describes the intended product, not a claim that the plugin system is implemented. **Current source-inspected behavior** describes only the named code paths examined in the development checkout; it is not runtime verification. **Open choices** need a product or engineering decision before the relevant implementation. **Gaps** describe the remaining capability between current evidence and the approved direction.

These pages document that model. They do not report a product refactor, installation, or rollout. Read [Decisions](001-Decisions/PAGE.md) for settled boundaries and the choices still open, and [Platform Boundaries](../001-Platform_Boundaries/PAGE.md) for the division of responsibility and current renderer foundation.

## Six roles

The following roles describe the approved direction. They are responsibilities, not six required plugins or a fixed component inventory.

| Role | What it does |
|---|---|
| Shell | Hosts tabs, drawers and popup/window surfaces; owns navigation, focus and container lifecycle. |
| Platform services | Validate requests and provide controlled data access, actions, persistence and history through their owning server routes. |
| Standard components | Supply reusable client-side presentation such as collections and controls, receiving explicit data and actions from a host. |
| Plugin contributions | Package compositions and, where needed, specialized executable presentation under a defined, protected host contract. |
| Configured view instances | Hold a workspace's editable configuration and local agent resources, bound to an installed view plugin. |
| Custom iframe regions | Provide specialized embedded UI alongside standard pieces, with narrow authorized platform operations as a target. |

A **workspace** binds Fusion Studio to a project folder. A **view instance** configures a way of working within that workspace. A **tab** or **drawer** is a container for content, not another workspace or plugin. A **file** is content that can be opened in a platform file surface. A **plugin** supplies a definition or contribution; it is not the same thing as the copied instance or the data displayed by that instance. [Workspaces And Views](../../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md) owns workspace binding, instance context and the related gap records.

## Follow the composition

Start with [Plugin Templates And Instances](../002-Plugin_Templates_And_Instances/PAGE.md) for protected packages, copied editable resources and server provisioning. Continue to [Composable Presentation](../003-Composable_Presentation/PAGE.md) for configure → compose → implement a protected component, including an illustrative collection flow.

Then follow [Tabs, Drawers And Files](../004-Tabs_Drawers_And_Files/PAGE.md): a collection can open the canonical file surface in its current tab with a return route or in another tab. The collection retains its selection, filters and navigation; the file surface retains presentation and editing, and platform services retain save and history. [Data And Actions](../005-Data_And_Actions/PAGE.md) separates those operations from data sources and event facts. [Custom Iframe Composition](../006-Custom_Iframe_Composition/PAGE.md) explains the hybrid target without assuming a future bridge already exists.

For remaining work, use [Unfinished Work](002-Unfinished_Work/PAGE.md). Provisioning, instance placement and agent-context gaps stay with the [workspace and view register](../../001-Workspaces_And_Views/000-Workspaces_And_Views/003-Unfinished_Work/PAGE.md); they are not competing plugin status records.

## Specialist ownership

[Chat System](../../007-Chat_System/000-Overview_and_References/PAGE.md) owns chat identity, session lifecycle and placement. [Events And Ledger](../../010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md) owns event and provenance semantics. [Server And Runtime](../../002-Server_And_Runtime/PAGE.md#system-database-boundary) owns the System storage boundary. Existing Wiki, Voice, Chat and event specialist references remain available under their owning sections; a link here does not recertify all of their implementation claims.

<!-- section-toc:start -->
<!-- section-toc:end -->
