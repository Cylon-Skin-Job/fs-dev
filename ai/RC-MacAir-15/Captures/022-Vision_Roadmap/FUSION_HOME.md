# Fusion Home Model

> Broad analysis of Fusion Home's role, addable workspace families, plugin principle, navigation structure, suite consolidation, and thread-density implications. Owner decisions remain authoritative in DECISIONS.md; this document does not define plugin contracts or implementation.

## Product Role

Fusion Home is the default folder presented when Fusion Studio is downloaded. It gives the product a useful personal and system-management center before the user adds any specialized workspace.

Fusion Home is not intended to contain every specialized workflow in one undifferentiated surface. It provides the common home capabilities, system entry points, and personal suites, while additional workspaces can supply deeper domain environments.

## Addable Workspace Families

The initial addable workspace families named by RC are:

- **Code workspace** for software projects.
- **Bookkeeping workspace** for financial and accounting work.
- **Media Studio** for media creation and production.
- **Research Library** for research collections and knowledge work.
- **System Manager** for system-level administration, system knowledge, and plugin distribution.

These are product families, not detailed templates or implementation specifications. Their exact default views, capabilities, and plugin bundles remain to be shaped later.

## System Manager Bootstrap Workspace

System Manager has a more specific distribution role than the other addable workspace families. It is a repository-backed plugin that Fusion downloads and registers as a workspace, and it must be installed before any other plugin.

The workspace supplies two foundational resources:

- a fully developed **System Wiki**; and
- a **Plugins** folder containing the catalog of other plugin bundles.

This makes System Manager the trusted bootstrap and distribution workspace for the wider plugin ecosystem, not merely another settings view. The exact onboarding and repository-update experience remain to be shaped later.

## Plugin Principle

Fusion Home and the wider product direction adopt the Deep-Sea-inspired principle that **everything is a plugin**.

At this vision level, the principle means product capabilities, suites, views, agents, workflows, and specialized workspace experiences should be conceptually composable rather than treated as permanent monolithic features. This capture does not define what technically qualifies as a plugin, how plugins are packaged, or which boundaries are universal.

Background Agents will not remain a separate product category. Agent execution is expressed through tickets and their visible threads, while **Agent Profiles** remains the place to define and manage reusable execution capabilities.

That view manages capability definitions, not persistent agent beings. It can surface harness-backed roles, Skills, subagent patterns, and reusable workflows that a ticket or thread invokes as needed.

Settings follows the same composition principle. Core settings remain compact, while installed plugins add deeper configuration, context-menu actions, event subscriptions, schedules, profiles, and other optional behavior.

Wiki follows the composition principle as well. Plugins may add related knowledge surfaces such as Context Manager or a possible User Profile without requiring those experiences to become unrelated top-level applications. Whether they appear as Wiki tabs or distinct Wiki types remains open.

## Left Navigation Structure

The existing Capture surface is renamed **Project Manager**, and its navigation begins with the user's projects:

1. Individually created Project Viewer entries appear at the top.
2. A plus control beneath them opens the Create Project pop-up for a name and icon.
3. A divider separates project creation from the ordinary application views.
4. Normal views follow, including Issues, Office Suite, Productivity Suite, Health & Fitness, Recipes/Meals/Shopping, Wiki, File Explorer, Browser, and other installed surfaces.
5. A later visual gap separates the lower system-composition group, including Routines and Plugins.

Agent Profiles remains part of the overall system capability model, but its exact position within this revised hierarchy is still open. Settings may be presented through Plugins or retain a distinct entry as the product language settles.

The earlier four-group list and use of Capture as a separate product identity are superseded by this Project Manager and project-first hierarchy. Exact ordering among ordinary apps, final labels, icons, and the Office Suite's presentation-builder naming can still be refined.

## Project Creation and Launchpad Composition

Create Project clones the registered default template into Fusion's Projects location, registers the resulting folder as its own Project Viewer, and places its chosen name and icon above the plus control.

The template begins with four universally useful Markdown files and points to the available patterns for creating additional files and subfolders when the project needs them. In the Project Viewer's default folder tab, Markdown files appear first and folders such as Transcripts or Research appear below.

The folder structure is broadly reusable in other folder-backed contexts. Project Viewer distinguishes itself by allowing other views and arbitrary project-relevant surfaces to open as header tabs. Combined with view-bound threads, peer side chats, Skills, and semantic orientation, this ordinary composition supplies Launchpad without a special Launchpad runtime.

Each registered view folder has configuration that contributes view-specific system guidance to conversations bound to it. The detailed configuration and prompt behavior are already being handled by the in-progress conversation/view SPEC and remain outside this umbrella document.

## Suite Consolidation

The current paradigm treats productivity capabilities as separate apps. The new direction consolidates Email, Calendar, To Do, Notes, and Contacts into a single Productivity Suite.

This change is motivated partly by thread binding. Each individual productivity capability may not contain enough conversational or contextual density to justify its own left-navigation identity and separate population of view-bound threads. The suite provides a larger, coherent daily context while retaining the ability to present its internal tools distinctly.

Those internal tools can still use the shared Home presentation. Email begins
as a centered Home surface. When a draft is expanded full-size, Email Home
becomes the first tab and the draft opens as an ordinary Content tab. Email Home
remains the sole surface for browsing or opening another message and invoking
Compose for new mail; the expanded draft is focused on that one item. Calendar
and comparable tools can use the same Home-to-Content relationship without
becoming separate left-navigation views or separate thread populations.

Other views can selectively expose these capabilities without duplicating the
suite. For example, a configured Email Inbox drawer can launch a message as
Content, while a separate action opens Email Home as a hosted Home tab. The
calling view keeps its own thread and shell. This uses the shared drawer,
target, and tab contracts rather than embedding a second Productivity Suite
runtime.

The same density principle may apply to other grouped domains. It should guide the level at which a view becomes a durable conversational context without requiring every low-level tool to become its own isolated app.

## Thread Density Implications

RC is considering a single daily thread for all Productivity Suite activity and a daily thread whenever a user opens the Health & Fitness Tracker. This suggests that some views may use time-bounded ambient threads instead of requiring the user to create and name a new thread for every interaction.

The daily-thread pattern is not yet settled. Thread creation, reuse, rollover, archival, naming, and the relationship between daily and long-lived threads belong to the forthcoming Thread Management explanation.

## Open Questions

- What distinguishes Fusion Home as a folder from specialized workspaces in the user's mental model?
- Which capabilities are present by default, and which are installed or enabled as plugins?
- Can the user reorganize the default navigation groups or replace their constituent plugins?
- Where should Agent Profiles sit in the revised project-first and lower-system navigation hierarchy?
- Does the Settings Manager label remain the permanent navigation name, or does Plugins become the primary user-facing label?
- How do suites expose internal tools without recreating separate-app fragmentation inside the suite?
- What is the final name of the Office Suite's page/presentation-building capability?
- How do daily suite threads relate to manually created, longer-lived, or task-specific threads?
- Does each specialized workspace family ship as a template, plugin bundle, downloadable product profile, or another conceptual unit?
- How does the user install, inspect, or replace the registered universal project template?
- How is existing Capture content presented or migrated when Capture is renamed Project Manager?
- How is the required System Manager download presented during first-run onboarding, recovery, and offline use?
