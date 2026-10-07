---
name: Platform Ownership And Extension Boundaries
description: Separates shell hosting, server services, reusable presentation and plugin instances while retaining canonical file, Chat and System owners.
metadata:
  source-files:
    - fusion-studio-client/src/components/ContentArea.tsx
    - fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx
  last-modified: "2026-09-23T13:50:37Z"
---

## Approved ownership model

The platform supplies stable hosting and permission rules, a useful standard presentation library and controlled operations. Plugins can extend what is presented within those rules. Client-side presentation and server-owned authority remain separate: “platform-owned” identifies responsibility, not a requirement that UI execute on the server.

| Responsibility | Owner and boundary |
|---|---|
| Container, navigation, focus and lifecycle | The shell owns tabs, drawers and popup/window hosts. A content contribution participates in the host's lifecycle instead of creating a second tab store. |
| Controlled data and actions | Owning server services validate access and perform persistence and mutations. Adapters translate authorized operations for their data source. |
| Reusable presentation | Standard or plugin-contributed components receive explicit data, identity and action callbacks from a connected host. They draw UI and emit user intent. |
| Canonical file presentation | The platform file surface and code-owned file-type registry retain file rendering/editing responsibility. Save and history stay with platform services. |
| Protected plugin definition | A plugin packages implementation and declared contributions under the platform's capability rules, along with template payload. |
| Editable instance | A configured copy binds to the installed plugin and supplies local configuration and agent resources; it cannot grant itself capabilities or executable authority. |

## Extending presentation

A reusable card or layout is a presentation component. A service that reads data or saves a file is a privileged operation owner. A canonical file-type renderer decides how the platform presents a supported file. Those are different extension boundaries.

The approved customization path is to configure standard components, compose them declaratively, then implement a specialized component in a protected plugin if necessary. A useful library ships with the platform; each small control need not be installed as its own plugin. A contribution consumes explicit inputs and actions through its host. It must not discover workspace identity, global stores, network routes or a database handle on its own. A connected host may adapt existing state and actions, as described in the [portable-component standard](../../005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md#portable-components-and-connected-hosts).

This extension model preserves the platform's canonical file renderer and type registry. It does not authorize arbitrary executable imports or establish an implemented registration interface. Host ABI, supported data/action shapes, compatibility and isolation remain [open choices](../000-Platform_And_Plugins/001-Decisions/PAGE.md#open-choices-and-decision-gates). See [Composable Presentation](../003-Composable_Presentation/PAGE.md) for the illustrative composition route.

## File and collection ownership

In the approved flow, a collection can open the platform file surface in its current tab, keeping a return route, or in another tab. The collection owns its selection, filters and navigation history. The file surface owns file presentation and editing; server services own save and history. Reuse these owners rather than implementing another editor or save path in a collection. Existing identity, focus and lifecycle owners remain authoritative. General duplicate-tab, dirty-buffer, restoration and close policies are not chosen here. [Tabs, Drawers And Files](../004-Tabs_Drawers_And_Files/PAGE.md) develops this boundary.

## Instance and capability ownership

The approved server provisioning path copies an installed plugin's template into an editable instance, binds the instance to the protected plugin and initializes configuration/state. The copied persona, AGENTS.md, skills and applicable workflows/sub-agent definitions are local resources, not privileged implementation. Workspace compositions can customize the selected view dependencies. Editable instances belong outside System; neither a future folder name nor copied template bytes confer authority. The exact placement and binding schema remain open. See [Plugin Templates And Instances](../002-Plugin_Templates_And_Instances/PAGE.md) and the existing [workspace gaps](../../001-Workspaces_And_Views/000-Workspaces_And_Views/003-Unfinished_Work/PAGE.md).

Own-view working directory and local harness context are approved intended behavior, alongside authorized project-wide working access. Other-view resources are deliberately read when needed. Such instruction reads neither cross protected System/plugin boundaries nor grant new capabilities. [View Configuration And Agents](../../001-Workspaces_And_Views/022-View_Configuration_And_Agents/PAGE.md) owns context implementation evidence and the remaining WV-G04 mechanics.

## Data and custom regions

Presentation can use local files, application-owned SQLite, CSV/JSON or authorized connectors without taking ownership of those sources. `fusion.db` remains platform System storage, separate from an application's live content. Authorized commands perform mutations, facts describe actual transitions or results, and the bus distributes those facts; it does not execute transactions. Preserve required prewrite protection, optional-context degradation and postwrite recovery as distinct boundaries under [Events And Ledger decisions](../../010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md). General external-store mediation and plugin publishers remain unfinished targets, not capabilities implied by component registration. Follow [Data And Actions](../005-Data_And_Actions/PAGE.md).

The custom-region target allows specialized iframe UI alongside standard host pieces and narrow authorized platform operations. It gives no unrestricted server, Node or database access. An iframe-side UI library is optional future work, and embedding alone does not establish a working bridge or complete isolation model. Follow [Custom Iframe Composition](../006-Custom_Iframe_Composition/PAGE.md).

## Current source-inspected foundation

In the inspected development source, `ContentArea.tsx` dispatches fixed built-in view IDs through `CONTENT_COMPONENTS` to React components. Built-ins take precedence over old iframe artifacts. Separate branches select a local `app/index.html` iframe, the custom iframe wrapper or the browser wrapper; unknown panels render a placeholder. These branches describe current routing, not plugin provisioning or a general contributed-component loader.

`ContentFrame` wraps routed content with layout controls and `ViewTabBar`. The latter resolves the connected view adapter, renders the tab strip and delegates the content panel. This is a concrete renderer-side hosting foundation; it is not evidence that every intended container or future plugin host is already available. The server's validation, data and persistence responsibility remains the [architecture boundary](../../005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md#allowed-path); no refactor moving UI to server execution is implied.

These observations are limited to the named source routes and were not runtime-tested. They do not establish end-to-end plugin provisioning, local harness-context assembly, an iframe bridge or complete System protection. [Unfinished Work](../000-Platform_And_Plugins/002-Unfinished_Work/PAGE.md) records platform gaps; [Workspaces And Views](../../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md) retains instance and provisioning ownership.

## Chat stays with Chat

Chat owns its group, session and placement semantics. The [Side Chat decision](../../007-Chat_System/000-Overview_and_References/002-Decisions/PAGE.md#2026-09-19--side-chat-tabs-and-non-chat-windows) keeps one session in a content tab, retains the right-hand list button and excludes the removed left thread-list/slider target. Generic non-chat containers and custom-region examples do not change that contract or create a new launcher inventory. Current Chat implementation status belongs to its own section, not this bounded platform source inspection.
