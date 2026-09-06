# Vision Roadmap Proposals

> Candidate product, experience, and system directions. Proposals remain unapproved until linked to an explicit owner decision.

## Inbox and Attention

### P-005 — Add secondary metadata beneath workspace names

- **Category:** inbox
- **Status:** proposed
- **Source:** CAP-099
- **Addresses:** CAP-093, CAP-097

Give each workspace entry in the system-wide inbox an optional secondary metadata line. The specific fields remain open and should be selected for attention value without making the workspace list noisy.

## Navigation and UI Flow

### P-006 — Choose the mobile workspace-picker presentation

- **Category:** interaction
- **Status:** proposed
- **Source:** CAP-105
- **Addresses:** CAP-004

Choose a mobile-native presentation for switching workspaces from the workspace-name header. Dropdown, slide-up sheet, full-screen picker, and adaptive variants remain candidates; the tap target and workspace-switching purpose are already settled.

### P-007 — Choose the Context Manager Wiki presentation

- **Category:** interaction
- **Status:** proposed
- **Source:** CAP-114
- **Addresses:** CAP-111, CAP-112

Present Context Manager either as a second tab within Wiki or as a distinct Wiki type. The choice should preserve a clear relationship to Wiki without obscuring that Context Manager has different history, indexing, and consent behavior.

## Chat and Threading

### P-002 — One daily thread for grouped or lower-density views

- **Category:** chat_threading
- **Status:** proposed
- **Source:** CAP-025
- **Addresses:** CAP-019, CAP-024, CAP-026

Use a single daily thread across the consolidated Productivity Suite, and create or resume a daily thread when a lower-density view such as Health & Fitness is opened. The proposal remains provisional pending RC's complete Thread Management model.

### P-012 — Implement chat routing as one canonical operation

- **Category:** chat_threading
- **Status:** proposed
- **Source:** CAP-153
- **Addresses:** D-010, D-081, D-125

Represent the settled chat-routing behavior with one canonical operation whose
inputs select the destination (`parent`, `new-side-chat`, or `new-thread`), the
delivery mode (`compose` or `send`), an ordered attachment/content payload, and
optional trailing text. Thin UI helpers may expose named convenience actions,
but creation, destination resolution, draft population, and immediate dispatch
should not become separate implementations for every product surface.

## Mobile and Cross-Device Experience

No proposals have been recorded yet.

## System Landscape

### P-001 — HTML artifacts with appendable templates

- **Category:** system_landscape
- **Status:** proposed
- **Source:** CAP-013
- **Addresses:** CAP-001, CAP-012

Represent inbox content as HTML artifacts produced from prefilled templates with empty placeholders. Provide bounded operations that append the next section and allow an AI process to fill its content. The metadata representation is deliberately unresolved in CAP-014.

### P-008 — Add a User Profile Wiki variant

- **Category:** system_landscape
- **Status:** proposed
- **Source:** CAP-115
- **Addresses:** CAP-111, CAP-113

Offer **User Profile** as another plugin-added Wiki variant, governed by the same opt-in extraction and user-controlled recording and surfacing boundaries as Context Manager. Its precise distinction from semantic history remains to be shaped.

### P-013 — Split the SQLite Browse catalog from installed plugin files

- **Category:** system_landscape
- **Status:** approved
- **Source:** CAP-180
- **Addresses:** D-045, D-052, D-159, D-160, D-164, D-165

Store a curated, text-only plugin package catalog in SQLite for the Plugins
view's Browse experience. Catalog packages may contain Markdown, configuration,
relative folder paths, and scripts, but not images or nested database files.
Catalog scripts remain inert data.

Installing a package validates its manifest, identity, version, paths,
provenance, dependencies, and requested permissions before materializing an
inspectable copy under `ai/<machine>/System/plugins/`. The Plugins view capsule
under `System/Views/` presents the Browse catalog and installed root, while the
database registry remains authoritative for registration, activation,
permissions, and consent.

D-164 adopts this split and sharpens Browse into a locked Fusion-approved trust
channel. It preserves the protected System boundary, folder inspectability
after installation, dependency-bearing plugins, and the System Manager
repository as the approved upstream source. Compatible folders obtained or
created elsewhere may be dragged or copied into the installed root, but they do
not enter Browse or inherit Fusion-approved provenance. The Plugins `+` action
opens Browse; Fusion provides no visual sideload action or approval badge.

### P-014 — Add a component-container host behind the committed tab rail

- **Category:** system_landscape
- **Status:** approved
- **Source:** CAP-183
- **Addresses:** D-126, D-133, D-166, D-167

Extend the committed Universal View Tab Bar with a portable content host rather
than teaching the rail about component kinds. A tab record carries a
serializable component reference with opaque tab and component-instance IDs;
it never stores a React element, component function, app-global store, or
plugin import path. An injected resolver turns an allowed reference into the
portable component and explicit props or reports it unavailable. The initial
resolver can contain only first-party code registrations; Provenance can later
supply the authorized dynamic implementation without changing the tab host.

Model an empty tab as an unfilled container rather than a component. A launcher
selection reserves that exact tab and, after any synchronous or asynchronous
work succeeds, atomically fills it while retaining tab ID, order, activation,
and focus. A correlation token prevents late completion from filling a tab that
was closed or repurposed. Filled containers cannot be overwritten through the
empty-fill route, and an unknown or unavailable component renders an inert
recoverable state instead of executing or deleting anything.

Keep current Capture and File behavior on their existing adapters through a
legacy-content fallback. This SPEC should alter no view folder, view
configuration, plugin folder, plugin registry, SQLite schema, chat behavior, or
server protocol. Component-host and state-machine tests provide the proof until
the following Composable Chat SPEC registers `ChatSurface` as a first-party
type and the later Move Chat to Side Chat SPEC becomes its first production tab
consumer. RC approved this shape by authorizing the bounded SPEC on 2026-09-03.

### P-010 — Use Capture as the progressive on-ramp to Projects

- **Category:** system_landscape
- **Status:** rejected
- **Source:** CAP-143
- **Addresses:** CAP-005, CAP-119

The proposal would have kept Capture as a low-ceremony surface that later promoted or handed work into Projects. RC rejected that transition model in CAP-146 and instead chose to rename the Capture product surface **Project Manager** while keeping each created folder registered and listed as a view.

### P-003 — Durable workflow state folder with JSON checkpoints

- **Category:** workflow
- **Status:** proposed
- **Source:** CAP-058
- **Addresses:** CAP-059

Give a reusable workflow a state folder whose individual processes update a shared JSON checkpoint. A recurring workflow can use the checkpoint to determine which unit to process next and what prior work has completed.

### P-004 — Since-last-run retrieval through event bus and ledger

- **Category:** workflow
- **Status:** proposed
- **Source:** CAP-058
- **Addresses:** CAP-059

Provide a tool that queries the event bus and event ledger for activity matching bounded search parameters since the workflow's previous invocation. This may replace or complement explicit JSON checkpoint state for incremental work.

### P-009 — Allow routines to invoke other routines

- **Category:** workflow
- **Status:** proposed
- **Source:** CAP-144
- **Addresses:** CAP-119

Allow a routine node or output to invoke another installed routine so reusable automation fragments can be chained. The model must preserve visible causality and eventually address recursion, loops, permissions, failure propagation, and shared state before it becomes settled direction.

## Future Planning Families

### P-011 — Split the view-control work into three single-domain SPECs

- **Category:** planning_family
- **Status:** approved
- **Source:** CAP-151
- **Addresses:** CAP-120, CAP-126, CAP-148, CAP-149, CAP-150

Keep the existing composable threaded-chat SPEC as the first foundation. Replace
the current second SPEC's combined scope with three bounded implementation
families:

1. **System Workspace and View Capsule Foundation** — establish the canonical
   `System` tree, relocate view capsules, create the workspace-level counterpart,
   centralize path resolution, bootstrap and migrate the layout, and enforce the
   Fusion-owned mutation boundary. It deliberately excludes prompt injection,
   collection persistence, and thread-list UI.
2. **Workspace/View Prompt Composition** — resolve the thread's authoritative
   view binding, assemble workspace `prompt.md` followed by view `prompt.md`, and
   deliver the result through the canonical harness option and each adapter's
   supported mechanism. It deliberately excludes filesystem relocation and
   collection UI.
3. **View-Configured Thread Collections** — retain only effective collection
   configuration, ranked collection assignments, derived Archive behavior, and
   the thread-list/menu presentation from the current second SPEC.

The capsule foundation is the shared prerequisite. Prompt composition and thread
collections may then proceed as sibling SPECs because neither needs to own the
other's implementation domain. D-169 approves the domain split. The current
bundle authors the capsule foundation and reduced collections SPEC; prompt
composition remains a separately scoped future SPEC rather than being pulled
into either one.
