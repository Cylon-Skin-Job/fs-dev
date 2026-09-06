# Projects and Launchpad Model

> Broad analysis of project creation, template cloning, Project Viewer identity, its default folder surface, conversation families, Launchpad composition, and project-hosted tabs. Owner decisions remain authoritative in DECISIONS.md; this document does not define a template schema, filesystem transaction, view implementation, or delivery sequence.

## Product Role

Projects use ordinary Fusion view infrastructure rather than a special project-management shell. Each created project is a folder treated as its own Project Viewer, with the same view capabilities for content, threads, chat, saved worksurfaces, configuration, and navigation.

The working-folder structure beneath that experience is universal: the same folder, starter-document, semantic-guidance, and incremental-extension pattern is technically usable in other folder-backed contexts. Project Viewer is distinguished by its product presentation and its ability to host an unrestricted set of project-relevant tabs, not by making the underlying folder pattern proprietary to Projects.

The key simplification is that project creation and conversation creation are different operations. **Create Project** creates the folder and view. Starting or opening a chat merely creates or selects a conversation inside that existing view.

## Default Projects Location

Fusion provides a default Projects location for user-created projects. It is the destination in which the project-creation flow instantiates a registered project template unless the product later allows another explicit destination.

The Projects location organizes domain objects, not conversation sessions. A project can exist before any chat is active, and all of its conversations remain associated with the same project folder and view identity.

## Create Project Flow

The side-navigation plus control opens a compact creation pop-up. The user:

1. supplies the project name;
2. chooses the project icon; and
3. confirms creation.

Fusion then clones the selected or default project template, creates the project folder, registers it as a Project Viewer, and places the new project entry above the plus control in side navigation.

The conversation system is not responsible for this filesystem work. A chat launched after project creation receives an already-established project view context.

## Project Template

Creating a project clones the registered default project template into the Projects location. How the user installs, inspects, or replaces that registered template remains open.

The Project Viewer's presentation configuration comes from the protected
`System/Views/plug-ins/views/view-templates/` library used by Add View and
Duplicate View. `+ Project` can therefore create the project folder and
instantiate its Project Viewer from the same reusable view source. Templates
are registered plugins too: the selected project offering can declare both its
view template and four-file project-content template as dependencies, whether
they are packaged together or supplied by separate reusable plugin bundles.

The initial template contains four universally useful starting files so the project opens with a carefully shaped Launchpad-like working structure. Their exact names and required content remain to be confirmed rather than inferred here.

The template also includes a discoverable way to find the available patterns or instructions for creating additional files and subfolders as the work earns them. The four initial files are a strong beginning, not a closed schema; growth remains guided and understandable instead of requiring the user or assistant to invent every artifact from scratch.

Templates may also carry the Skills, orientation, and semantic explanation that make the resulting project understandable to its assistant and user. Updating the registered template affects later project creation; how existing projects receive template improvements remains open.

## View and Folder Identity

The cloned project folder is treated as a view. The folder supplies the project's content root and starting worksurface, while the Project Viewer supplies the product capabilities associated with views.

Opening a project therefore immediately restores its own view environment rather than starting a generic workspace chat. Project identity remains stable even if its presentation label or ordering changes.

## Default Folder Tab

The frontmost tab in Project Viewer is the project folder itself. Its primary interaction is a left-hand navigation listing the project's Markdown files so the user can scan them, open them quickly, and jump among the project's working documents without leaving the project context.

The navigator places Markdown files at the top and subfolders beneath them. This keeps the project's principal readable memory immediately available while giving transcripts, research, and future earned groupings a predictable lower section.

This is deliberately a direct content surface rather than a project dashboard. The folder may contain useful subfolders—such as **Transcripts**, **Research**, or other project-specific groupings—and the same navigator exposes that hierarchy without forcing all project material into one flat list.

The default folder tab anchors the project even when other tabs are open. Returning to it brings the user back to the project's readable source material and supporting files.

## Bulletin Access

The project's bulletin is available through a slide-out bar for fast situational awareness without displacing the open document. Selecting a claimed item asks the shared tab host to open that resource in a new tab by default. If a matching target is already open in the current worksurface, Fusion activates that tab and asks its component to recenter or reveal the item rather than creating a duplicate. The underlying bulletin data is also inspectable as JSON from the default folder tab.

These are two presentations of the same project memory: a convenient product surface for routine use and a transparent file representation for inspection, portability, or assistant access. Whether the JSON is directly editable or projected from another source of truth, along with its exact shape and synchronization behavior, remains future design work.

## Conversation Families

A Project Viewer can hold multiple visible threads based around the same project folder. Each visible thread can in turn contain its main chat and multiple peer side chats in one family grouping.

The chat component is composable enough to move into a side-chat tab while remaining a sibling of the main chat beneath the same visible thread. This gives a project several levels of organization without inventing another conversation system:

- one project folder and view;
- multiple visible threads within that project;
- one main chat plus multiple peer side chats within each thread; and
- saved content worksurface state for each visible body of work.

Side agents use the same visible composition model. A side agent can open in a project tab and remain associated with the relevant thread family, rather than becoming an invisible background entity or moving into a separate agent-management product area. The tab supplies a place to inspect and interact with its work; the invoked Agent Profile remains a reusable capability mask rather than a persistent being.

## Launchpad as a Default Composition

Launchpad emerges from the ordinary project model. A project template containing the starting files, suitable Skills, and semantic orientation gives the user a Launchpad experience without requiring a bespoke Launchpad runtime.

The user creates a project, opens its Project Viewer, and already has the initial materials and conversational capabilities needed to capture, shape, and discuss the work. The Project Viewer's ordinary multi-thread and side-chat abilities provide the parallel conversational space Launchpad needs.

This makes Launchpad a default project composition that can evolve through templates and plugins rather than a separate hard-coded product category.

## Project-Hosted Tabs

The Project Viewer has one exceptional product privilege: its view configuration may expose an unusually broad catalog of project-relevant content surfaces. Configured slide-out launcher options can open registered Home modules and presenters such as Wiki Home, Capture Home, Browser, tools, research surfaces, and side agents in the ordinary tab strip. Files linked from Capture documents or other project material can open beside them through their assigned presenter.

That lets a project gather relevant Fusion surfaces inside its own working context while retaining one project folder and conversation family. A hosted Home module contributes its content presentation only: the Project thread, current chat, and saved worksurface remain the owning shell context, and the hosted module does not bring another view's thread list with it.

This unified workspace requires no Project-specific tab host or nested-view runtime. It is a broad configuration over the shared container, placement, presenter, and composable-chat foundations. Other folder-backed views can use the same universal document-and-subfolder structure and generic host without automatically receiving Project's broad configured catalog. The boundary remains product-level and intentional. The exact eligible component catalog, permissions, state ownership, and mobile presentation remain future design work.

Project's right-edge drawer launchers use one icon per configured drawer rather than one generic slide-out control. Their button size, glyph size, gaps, and trailing inset reuse the top workspace header action contract. The Files drawer uses a folder icon; the Home-surface catalog and Bulletin use distinct semantic icons supplied by configuration. Exact symbols for those latter drawers remain open.

These drawers are styled as workspace chrome rather than a separate navigation category. Their surface uses Workspace Background, and the active drawer icon uses Workspace Chrome Accent. An open drawer begins below the global header and consumes width, shifting the Project content container left. Clicking the active icon closes it; clicking another drawer icon swaps the open drawer directly.

Project Viewer can default to its own Home presentation, configure the picker shown by Empty tabs, and expose separate Files, Bulletin, and app-launcher drawers. The app launcher contains only registered targets that open directly as a self-contained Home or Content presentation and do not require another sidebar. It can therefore open Wiki, Capture, Browser, and other eligible surfaces while Files and Bulletin retain purpose-built drawers. This composition is Project's broad configuration of the same three container kinds used everywhere: Empty, Home, and Content.

## Project Manager Identity

The existing **Capture** product surface is renamed **Project Manager**. This keeps the familiar note-taking, riffing, and brain-dump working style but names the broader purpose directly instead of requiring a hidden promotion from Capture into another product concept.

Project Manager's left-side plus opens the folder name and icon pop-up. The resulting folder is registered, listed, and treated as a view. Project Manager is therefore the user-facing product identity for creating and working with these folder-backed project views, not a manager layer that owns a second kind of project object above them.

Each bound view has its own configuration. That view folder contributes view-specific system guidance when its conversations run, along with the other view behavior already being shaped in the in-progress conversation/view configuration SPEC. This capture records the product relationship without reopening the SPEC or defining prompt assembly.

## Open Questions

- What are the four required starting files in the default project template?
- Which initial subfolders, if any, ship with the template, and which are created only when needed?
- Where is the catalog or guidance for adding earned files and subfolders surfaced, and how do plugins extend it?
- Can users choose among several project content templates, or is one Launchpad-oriented content template initially canonical?
- Where does the default Projects location live, and can the user select another destination?
- What validation occurs before a user-authored template becomes available to Create Project?
- How are project folder names, display names, icons, and immutable view identities related?
- What happens if template cloning succeeds but view registration fails, or vice versa?
- How are template updates offered to projects that were already created?
- Which Skills and semantic orientation ship with the default Launchpad composition?
- Which views and auxiliary surfaces may be hosted as Project Viewer header tabs, and can plugins add eligible types?
- Which icons should ship for the Home-surface catalog and Bulletin drawers?
- How is a side agent tab related to the main chat, a side-chat sibling, its Agent Profile, and any delegated task identity?
- Is the bulletin JSON directly editable, projected from another source of truth, or both under controlled synchronization?
- How are hosted-view state, permissions, and navigation represented on mobile?
- Can a project export or clone its complete template without copying conversations, permissions, secrets, or local state?
- How is existing Capture content migrated or renamed when the product surface becomes Project Manager?
