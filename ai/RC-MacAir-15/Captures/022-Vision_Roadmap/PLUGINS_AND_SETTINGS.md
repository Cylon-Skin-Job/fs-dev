# Plugins and Settings Model

> Broad analysis of lightweight core settings and optional plugin-delivered capabilities. Owner decisions remain authoritative in DECISIONS.md; this document does not define plugin manifests, security architecture, distribution, or implementation.

## Product Principle

Settings is not intended to grow into a monolithic control panel for every possible Fusion capability. The core provides a small, useful configuration surface. Plugins add deeper customization, operational systems, and new hooks by composing existing product primitives.

The user should be able to install an advanced capability without losing visibility into what it adds or control over how it connects to the rest of the system.

The intended Plugins view borrows the legibility of a browser extension manager while reusing the modular Capture Home layout. Introductory text sits above a scrollable, sectioned card grid. The source is one folder deep: each first-level folder becomes a visible section and its files become cards. Card width and presentation can be configured instead of fixing the view permanently at two columns. Cards retain an icon, name, description, enable switch, and lightweight metadata. Clicking the Plugins `+` action opens the approved Browse overlay. The view does not expose a visual sideload action.

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

The broader required manifest remains open, but the protected local architecture
separates presentation from installed source:

```text
ai/<machine>/System/
├── Views/<plugins-view>/       # Plugins view capsule and configuration
└── plugins/                    # Inspectable installed and sideloaded packages
    └── <package-id>/
```

The locked Browse catalog is stored separately in SQLite. Every template and
interface module represented by that catalog or installed root is itself a plugin. View
templates contain the copyable configuration needed to create or adapt a
ready-to-use view instance. Home displays, Content-tab displays, and sidebar
modules are reusable plugins called from view configuration through stable
identities. Plugins may declare other templates or modules as dependencies.
The folder model preserves portability and inspectability while allowing Fusion
to validate what each template or module contains and intends to do. The
view-oriented package family is the first defined plugin family; workflows,
Agent Profiles, and other folder-shaped capabilities can use the same distribution
and installation boundary as their contracts are settled.

**Code Space** is the reference aggregate plugin. It requires File Tree Drawer,
File Editor Content tab, Capture Home, Capture Content tab, Wiki Content tab,
and the templates needed to assemble the resulting experience. The aggregate
does not privately reproduce those capabilities; installation resolves and
presents its dependency set through the registry and consent flow.

Plugin cards reuse the Ticket card interaction model. A configured card may
preview first and then open as a full Content tab. The initial Plugin Content
presenter uses one Markdown document as the descriptive body, places basic
switches and a browsable source folder beneath it, and lets source files open in
additional tabs through the File Viewer Content presenter. This makes the
inspectable folder part of the product surface without turning the detail tab
into another file editor.

The same Home-layout module is not intrinsically tied to one domain. Capture
uses top text and a one-folder-deep section grid; Plugins specializes the cards
with permission and installation behavior; an Email-inbox layout can be reused
for an Issues inbox while each instance supplies its own data source and
permissions.

The same principle applies to protected System configuration. View definitions,
component assemblies, templates, and related customization can be represented
as versioned declarative files under System while referring to content elsewhere
in the workspace. Stable component/type identifiers make the declaration
portable without embedding the component implementation into every view.

The Plugins capsule presents two deliberately different sources. **Browse**
queries a locked SQLite catalog whose entries have Fusion-approved provenance.
**Installed** reads inspectable package folders under `System/plugins/`, including
packages materialized from Browse and compatible folders the user has authored,
received, downloaded, or imported. Right-click Add View, Duplicate View, and
`+ Project` draw from registered definitions through Fusion's validated
configuration and creation services. Merely placing a folder in the installed
root does not register, authorize, activate, approve, or add it to Browse. Once
Provenance supplies that fuller foundation, built-in views can be progressively
reduced to configurations over these modules.

## Universal Event Bus Hooks

Any plugin hook into or out of the Universal Event Bus appears as a UI toggle. This includes subscriptions that receive events and emissions or actions that publish or react through the bus.

The Plugins view presents installed capabilities as browser-extension-like cards organized into readable sections. Switches on the right distinguish trigger permissions from output permissions, making both what can wake a plugin and what consequences it can produce visible without requiring the user to understand raw event internals.

Exact hook naming and detail levels remain open, but the card-and-section presentation and the presence of separate trigger/output controls are settled.

## Dependencies and Shared Resources

A plugin can declare another plugin or resource package that completes its capability. Installing the higher-level plugin may prompt the user to install the missing dependency, but registration, downloads, permission grants, and activation remain explicit.

Templates, Home presenters, preview presenters, Content presenters, and drawer
modules participate in this same dependency model. A dependency declaration
does not silently grant the required module's permissions; every newly required
capability still passes through registry, compatibility, and consent handling.

Large local resources such as model weights are reusable system capabilities. Once installed, registered, and authorized, compatible plugins and routines can connect to them instead of downloading private copies. Dependency presentation should make source, size, compatibility, and consequence understandable before the user proceeds.

Local speech-to-text demonstrates the model. A preconfigured microphone pipeline can send audio into an STT capability, pass the text through a user-editable regex formatter, and return it to the composer. The connection may be present before the weights are installed; the user explicitly runs the download or installation step. A later video-transcription plugin can reuse those weights and request additional voice-detection, speaker-separation, or timestamp resources as separate dependencies.

## Registry and Consent Boundary

A future database registry will be the authority behind plugin installation, UI presentation, activation, and execution. RC plans to connect this registry after the related Provenance work.

The registry distinguishes three materially different states:

1. A folder exists on disk.
2. Fusion recognizes and registers the plugin.
3. The user consents to activation, hooks, permissions, and execution.

The first state alone grants no execution authority. An unregistered plugin that was downloaded or copied into a folder must not silently gain UI presence, enable UEB hooks, run scripts, or otherwise become active.

The registry-backed UI should give the user a clear path to inspect a discovered bundle, understand its requested capabilities, register it, configure defaults, grant or deny permissions, activate it, and later revoke that authority.

### Provenance Sequencing

The first Tabs as Containers SPEC does not consume plugin or view-folder
configuration. It adds only the generic component-content and empty-tab host
contract on top of the completed Universal View Tab Bar. Existing views remain
on their current adapters, and the following chat work may register Side Chat
as a first-party consumer of that contract.

Full plugin-driven component registration and declarative conversion of existing
views wait for Provenance. The early host may expose a narrow injected resolver
seam, but it must not establish a temporary dynamic registry, direct folder
loader, or configuration contract that would force the views through two
migrations.

### Browse, Installed, and Trust Boundary

Fusion stores the curated **Browse** package catalog in SQLite while materializing
or discovering **Installed** plugins as ordinary protected files under
`ai/<machine>/System/plugins/`. The Plugins view folder is therefore not the
installed plugin source of truth.

The Browse catalog accepts text-oriented package material—Markdown,
configuration, relative folder paths, and scripts—but no images or nested
database files. Storing the package as addressable file entries rather than only
one opaque archive would allow the Plugins view to query metadata, render
Markdown previews, inspect dependencies, and display source before installation.
The exact SQLite representation remains an implementation decision.

Browse is locked to Fusion-approved catalog entries. A local, authored, shared,
or downloaded folder cannot write itself into Browse or acquire the same
provenance merely by being copied into the installed root. Catalog presence
still grants no execution authority. A script in Browse is inert data and
cannot execute from the catalog. Installation must validate the manifest,
relative paths, package identity and version, hashes or other provenance,
dependencies, and requested permissions before materializing a readable copy in
the protected installed-plugin root. Registration and consent still occur
through the database registry after that validation boundary.

Compatible folders obtained outside Browse use a filesystem-only sideload path.
The user drags or copies the folder into `System/plugins/`, after which its
settings can be provisioned and the applicable validation, registration,
permission, consent, and activation steps can occur. Fusion provides no visual
sideload command or source picker. This supports sharing a view, workflow,
Agent Profile, or other plugin-shaped folder without allowing that openness to
weaken the curated Browse channel.

The interface does not need provenance badges. Clicking `+` and choosing from
Browse is the approved route; filesystem placement is outside that route. The
registry may retain origin information needed for enforcement or diagnostics,
but the ordinary plugin presentation does not decorate packages with approval
or sideload labels.

Under this split, the responsibilities are:

- SQLite is the queryable, locked Browse catalog and distribution cache.
- `System/plugins/` is the inspectable installed-package source.
- the Plugins capsule under `System/Views/` presents and configures both;
- the registry remains authoritative for registration, activation, permissions,
  and consent; and
- System Manager remains the approved upstream catalog source rather than the
  only place the Browse UI can read package contents.

This makes Browse fast and offline-friendly while keeping installed
packages transparent to users and assistants. SQLite itself is not a security
boundary: catalog updates still require provenance, validation, versioning, and
safe materialization rules.

## System Manager Bootstrap

**System Manager** is the prerequisite plugin and the distribution root for the rest of the plugin ecosystem. It is not installed as an ordinary loose folder. Fusion downloads its repository and registers that repository as a workspace before any other plugin can be installed.

The System Manager workspace contains:

- a fully developed System Wiki; and
- the approved upstream plugin bundles and their configuration declarations.

Fusion authenticates and imports or synchronizes that approved source into the
locked local SQLite Browse catalog. Users may also install a bundle from another
source, but doing so requires dragging or copying its folder into the installed
root and then provisioning it. Inspection, validation, testing, permission
review, and consent still precede activation. Such packages remain outside
Browse even after activation.

This gives Fusion a known, registered workspace from which it can discover plugin offerings and system documentation while preserving the rule that arbitrary folders are not executable merely because they exist.

## Local Viewer and Configuration Projection

Fusion's local Plugins viewer is intentionally thin. It presents the locked
SQLite Browse catalog and the protected installed-plugin root, then uses each
registered package's declarations to construct controls such as UI toggles. The
view capsule does not become another package store or an independent source of
provenance.

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
- Which card metadata best communicates permissions, version, and update state without turning the grid into a technical dashboard?
- Which settings and capabilities must remain core rather than optional?
- What manifest declares a plugin's resources, hooks, permissions, defaults, UI extensions, and dependencies?
- How do cards present trigger permissions separately from output, tool, and data-access permissions without becoming overwhelming?
- How are shared local weights and similar resources scoped, versioned, stored, updated, and reclaimed?
- Are plugins installed globally, per workspace, or with both scopes?
- How are plugin conflicts, ordering, and multiple extensions to the same menu or setting resolved?
- What permission and trust review applies to scripts, regex, tools, and outbound UEB hooks?
- How are unregistered-but-discovered folders shown without accidentally treating them as installed?
- What proof or validation does the registry require before presenting a consent flow?
- How is the System Manager repository authenticated, updated, pinned, restored, or used offline?
- Is System Manager itself visible and controllable in the Plugins viewer, or treated as protected bootstrap infrastructure?
- What is the exact reconciliation sequence for projecting authoritative registry state back into configuration?
- Should Browse store each package file as an addressable text record, a
  validated archive, or both for different purposes?
- How are SQLite catalog updates authenticated, versioned, rolled back, and
  reconciled with already installed package versions?
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
- How does the assistant present and apply a selective comparison between two
  view capsules through the validated configuration UI without receiving direct
  System write access?
- What compatibility, version-selection, cycle-detection, and failure rules
  govern dependency-bearing template and presenter plugins?
- What exact configuration fields identify optional Home and preview presenters,
  the expanded-tab presenter, data source, permissions, and dependencies?
- How are intelligent defaults explained, and can installation offer a simple versus advanced configuration path?
- Which automatic naming rules run locally and deterministically, and which may send thread context to a configured LLM?
- Does automatic naming occur only at creation, after the first accepted message, or whenever stronger identifying context appears?
