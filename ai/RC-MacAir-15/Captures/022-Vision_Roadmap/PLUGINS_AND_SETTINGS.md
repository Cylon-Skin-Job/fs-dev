# Plugins and Settings Model

> Broad analysis of lightweight core settings and optional plugin-delivered capabilities. Owner decisions remain authoritative in DECISIONS.md; this document does not define plugin manifests, security architecture, distribution, or implementation.

## Product Principle

Settings is not intended to grow into a monolithic control panel for every possible Fusion capability. The core provides a small, useful configuration surface. Plugins add deeper customization, operational systems, and new hooks by composing existing product primitives.

The user should be able to install an advanced capability without losing visibility into what it adds or control over how it connects to the rest of the system.

The intended Plugins view borrows the legibility of a browser extension manager: a small sidebar and a centered grid of compact cards, roughly two across, with an icon, name, description, enable switch, and lightweight metadata. **New Plugin** or **Add Plugin** can be the view-specific presentation of the shared New action; the final wording remains open.

## Core Workspace Appearance

Core Fusion supports substantial but approachable appearance changes on a per-workspace basis through:

- a primary color;
- a secondary color; and
- a small set of sliders.

The exact slider meanings remain open. The principle is that ordinary workspace theming should not require installing a plugin or configuring dozens of individual color tokens.

## Theme Customization Plugin

The optional **Theme Customization** plugin expands the appearance system substantially. Installing it adds:

- a **Custom** section positioned between Light and Dark;
- literal color pickers for granular appearance values; and
- right-click menu entries in relevant product surfaces for contextual customization.

The plugin extends the same workspace appearance system rather than creating an unrelated theme editor.

## Operational Capability Plugins

Plugins can also enable operational systems. Examples named by RC include:

- **Inbox Alerts**;
- **Heartbeats**;
- **Auto-Rename Chat Threads**; and
- **Wiki Maintainer**.

Wiki Maintainer demonstrates composition: one plugin may install or configure ticket schedulers, Agent Profiles, trigger-created tickets, durable state, templates, and event hooks as a coherent capability.

Auto-Rename Chat Threads keeps naming policy outside the core conversation component. It can reconnect the existing LLM-assisted naming capability and add deterministic rules for tickets, attachments, attachment-only requests, and filename-plus-summary prompts. The plugin owns whether and when automatic renaming runs; explicit titles and source-provided identity remain available without it.

## Personal Context and Wiki Variants

Plugins can extend Wiki into additional personal-context surfaces rather than requiring every knowledge experience to use one fixed Wiki form.

The planned **Context Manager** plugin provides:

- a semantic history;
- an indexable history; and
- a bounded amount of basic user data.

Its exact placement remains open. It could appear as a second Wiki tab or as a distinct Wiki type within the wider knowledge experience.

**User Profile** is another candidate Wiki variant. It may provide a more deliberately shaped user-facing profile rather than the broader historical context of Context Manager, but its exact responsibilities are not yet approved.

All extraction into these personal-context surfaces is opt-in. The user controls at least two distinct boundaries:

1. what information Fusion is allowed to record; and
2. what recorded information Fusion is allowed to surface in context.

Installation of the plugin does not itself authorize extraction. These controls belong within the wider registry-backed consent model and must remain understandable and reversible at the product level.

## Folder-Based Bundles

A plugin is fundamentally a folder of inspectable resources. It may contain:

- Markdown instructions or documentation;
- scripts;
- configuration;
- regular expressions;
- templates;
- state conventions; and
- other resources required by the capability.

A bundle may also contribute a custom view using one of the supported view profiles. This is the bridge between plugin installation and front-end composability: installing a folder can add behavior, configuration, and a content surface without making every extension part of Fusion's core navigation code.

The exact required manifest and directory contract remain open. The folder model should preserve portability and inspectability while allowing the system to validate what the plugin contains and intends to do.

The same principle applies to protected System configuration. View definitions,
component assemblies, templates, and related customization can be represented
as versioned declarative files under System while referring to content elsewhere
in the workspace. Stable component/type identifiers make the declaration
portable without embedding the component implementation into every view.

## Universal Event Bus Hooks

Any plugin hook into or out of the Universal Event Bus appears as a UI toggle. This includes subscriptions that receive events and emissions or actions that publish or react through the bus.

The toggle surface should make plugin behavior legible without requiring the user to understand raw event internals. Exact hook naming, grouping, and detail levels remain open.

## Registry and Consent Boundary

A future database registry will be the authority behind plugin installation, UI presentation, activation, and execution. RC plans to connect this registry after the related Provenance work.

The registry distinguishes three materially different states:

1. A folder exists on disk.
2. Fusion recognizes and registers the plugin.
3. The user consents to activation, hooks, permissions, and execution.

The first state alone grants no execution authority. An unregistered plugin that was downloaded or copied into a folder must not silently gain UI presence, enable UEB hooks, run scripts, or otherwise become active.

The registry-backed UI should give the user a clear path to inspect a discovered bundle, understand its requested capabilities, register it, configure defaults, grant or deny permissions, activate it, and later revoke that authority.

## System Manager Bootstrap

**System Manager** is the prerequisite plugin and the distribution root for the rest of the plugin ecosystem. It is not installed as an ordinary loose folder. Fusion downloads its repository and registers that repository as a workspace before any other plugin can be installed.

The System Manager workspace contains:

- a fully developed System Wiki; and
- a Plugins folder containing the other available plugin bundles and their configuration declarations.

The catalog in that registered repository is the approved, low-friction library presented when a user browses available plugins. Users may also install a bundle from another source, but doing so is an explicit untrusted-source path that relies on inspection, validation, testing, permission review, and consent before activation.

This gives Fusion a known, registered workspace from which it can discover plugin offerings and system documentation while preserving the rule that arbitrary folders are not executable merely because they exist.

## Local Viewer and Configuration Projection

Fusion's local Plugins viewer is intentionally thin. It points to the relevant configuration folder in the registered System Manager workspace and uses those declarations to construct plugin controls such as UI toggles. The viewer does not become a second independent plugin catalog.

Configuration is a readable and writable projection of plugin settings, but the database registry remains authoritative for activation and permission state. When a user changes a toggle, Fusion persists the state through the registry and writes the resulting state to configuration.

Purpose-built GUI editors and direct user access to the JSON are two editing
surfaces for the same canonical schema. Both save through Fusion's validation
and privileged configuration service, report invalid declarations without
activating them, and preserve the last-known-good effective configuration.
OpenCode and later harnesses may read the effective configuration and guide the
user, but cannot call that privileged write path or mutate System through a
generic filesystem tool.

Portable configuration and local authority are separate. Export or clone may
carry declarative defaults, requested capabilities, templates, and stable
component references. It does not carry secret values, recorded consent,
granted permissions, active sessions, thread history, or ordinary view/runtime
state. A cloned view receives a new immutable instance ID, and requested
privileges require fresh consent before activation.

Reconciliation does not force every mismatch to disabled. Instead, the database's recorded state wins. Most importantly, a permission declared as granted in configuration but not granted in the database is unauthorized; the server overwrites the configuration to remove that grant. Configuration therefore cannot become a second path for granting consent.

## Installation Defaults and Customization

Installing a plugin applies intelligent defaults for its UEB hooks and other relevant settings. Defaults should make the plugin useful immediately while remaining changeable by the user.

The installation experience therefore has two responsibilities:

1. establish a sensible working configuration; and
2. reveal the meaningful controls and event connections the user may want to customize.

## Composition Examples

- Theme Customization composes workspace color state, extended controls, and contextual menus.
- Inbox Alerts composes inbox classifications, notification presentation, and UEB subscriptions.
- Heartbeats composes thread controls, monitored variables, opt-in event filtering, actions, and sleep/wake state.
- Auto-Rename Chat Threads composes thread events, attachment metadata, configurable naming rules, and optional LLM-assisted titles.
- Wiki Maintainer composes schedules, tickets, Agent Profiles, triggers, validation workflows, state, and event history.

These examples share primitives but remain independently installable capabilities.

## Open Questions

- Is the navigation surface permanently named Settings Manager, Plugins, or a combination such as Settings & Plugins?
- Is the primary creation action labeled New Plugin, Add Plugin, or changed according to whether the user is authoring or installing?
- Which card metadata best communicates source, trust, permissions, version, and update state without turning the grid into a technical dashboard?
- Which settings and capabilities must remain core rather than optional?
- What manifest declares a plugin's resources, hooks, permissions, defaults, UI extensions, and dependencies?
- Are plugins installed globally, per workspace, or with both scopes?
- How are plugin conflicts, ordering, and multiple extensions to the same menu or setting resolved?
- What permission and trust review applies to scripts, regex, tools, and outbound UEB hooks?
- How are unregistered-but-discovered folders shown without accidentally treating them as installed?
- What proof or validation does the registry require before presenting a consent flow?
- How is the System Manager repository authenticated, updated, pinned, restored, or used offline?
- Is System Manager itself visible and controllable in the Plugins viewer, or treated as protected bootstrap infrastructure?
- What is the exact reconciliation sequence for projecting authoritative registry state back into configuration?
- Can registration, consent, and activation be revoked independently?
- How are plugin updates versioned, previewed, rolled back, or pinned?
- What happens to plugin-created state, tickets, schedules, profiles, and UI settings when a plugin is disabled or removed?
- Does Context Manager appear as a second Wiki tab, a distinct Wiki type, or another plugin-defined knowledge surface?
- Which source categories can Context Manager extract from, and how granular is the opt-in boundary?
- Can the user review, edit, exclude, expire, or delete individual context records and derived semantic entries?
- How are “record” permission and “surface” permission represented separately and changed over time?
- What distinguishes Context Manager from a possible User Profile Wiki in purpose, data, and presentation?
- What import/export package and compatibility metadata should carry portable
  configuration and component dependencies between workspaces?
- How are intelligent defaults explained, and can installation offer a simple versus advanced configuration path?
- Which automatic naming rules run locally and deterministically, and which may send thread context to a configured LLM?
- Does automatic naming occur only at creation, after the first accepted message, or whenever stronger identifying context appears?
