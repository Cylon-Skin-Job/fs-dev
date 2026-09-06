# Threads and Views Model

> Broad analysis of the relationship among navigation, views, threads, side chats, and restored working context. Owner decisions remain authoritative in DECISIONS.md; this document does not prescribe storage, APIs, migrations, or implementation.

## Navigation Relationship

Chat, thread navigation, and the active content view are three composable parts of the Fusion Studio shell. A view may show all three, hide chat while retaining its thread list, hide the thread list while retaining chat, or occupy the full window without either one.

This separation simplifies the meaning of threads. When chat is hidden, the thread list still works as a menu of saved content-worksurface states. Selecting a thread restores the place in the view where that work was left. When both chat and threads are hidden, the view behaves like a full-screen application rather than a special chat state.

The intended desktop navigation still places view navigation beside the thread list on the left. Their adjacency provides orientation without making either one an inseparable part of the content surface:

- view navigation answers where the user is in Fusion Studio;
- the thread list presents the conversations or saved working contexts belonging to that view; and
- the content surface presents the actual material being used.

Conversation creation and domain-object creation are now separate. New Chat starts a conversation inside an established view and performs no folder or starter-file work. A view may separately expose **Create Routine**, **New Agent**, **New Plugin**, or another domain action that establishes the relevant content before any conversation uses it.

The current direction places Routines and Plugins as a distinct lower group in navigation. They use the same composable conversation and creation primitives as other views, but their labels and defaults make them feel like editors for reusable system capabilities rather than ordinary project chats. Agent Profiles participates in the same capability model, but its permanent location in the revised navigation remains open.

View capsules themselves belong under `ai/<machine>/System/Views/`. Their
declared primary content folders remain independent. A Wiki view can therefore
point to `ai/<machine>/Wiki`, workspace-root `Wiki/`, or another supported
location; moving the definition into System does not force the content into an
ignored or machine-local tree.

The implementation boundary is deliberately split. A System View Capsule
Control-Plane Foundation owns the canonical path, journaled registry cutover,
and protection of Fusion's generic file routes. View-Configured Thread
Collections consumes that accepted foundation and owns only effective
collection configuration, assignment persistence, Archive, filtering, and row
menus. Workspace/view prompt composition remains a separate future domain.

The existing Capture surface is renamed **Project Manager**. It does not become a special ownership layer above ordinary views: the user creates a project from its left-side plus, producing another numbered Project Viewer capsule such as `001-project-viewer`, `002-project-viewer`, and so on. Each folder receives the chosen name and icon and is registered and listed as a view with its own immutable manifest ID and project content-root binding. Multiple projects therefore reuse one Project Viewer type while behaving as distinct views.

The Project Viewer opens with its folder as the frontmost tab. A left-hand navigator places the project's Markdown files first and its subfolders below, making it quick to scan and jump among primary documents while retaining groupings such as Transcripts or Research. The template also points the user and assistant toward the available patterns for adding more files and folders when the work earns them.

The underlying folder-and-guidance pattern can be used in other folder-backed views. Project Viewer adds one exceptional composition privilege: other views and arbitrary project-relevant surfaces—including side agents—may open as tabs in its header. This privilege does not turn the folder pattern itself into a project-only structure.

The shared tab strip establishes navigation and chrome, but a tab is more than
its label and close button. A newly created tab is an empty container that can
host one of the components made available by the active view. The empty
container presents launcher buttons from configuration stored with that view,
so a Project Viewer can offer a broad set while a narrower view can expose only
the components appropriate to its purpose. The view selects and orders what is
available; it does not require chat or another component to invent a separate
tab host.

That same view configuration resolves the initial container shown for a newly
created thread when no saved worksurface exists. Content and chrome are separate
choices. A view may load its Home module and present that single surface beneath
centered identity, or skip Home, load the selector immediately, and show that
first container as a tab from the start. The plus action is simpler and does
not repeat this initial choice: whenever enabled, it always creates another
empty selector container using the view's configured list.

Containers have three presentation kinds rather than view-specific tab
systems. **Home** is a centered app-style landing module whose presenter-owned
background fills the container to its top. **Content** presents two shell-owned
rails—Tabs, then File Location and Path—followed by the body supplied by the
target's presenter. **Empty** is a shell-owned tab and configured picker. The
centered identity used for Home and the icon-and-text label used in the tab
strip share the same icon size and typography; only their location changes.

Style ownership changes only when the shared tab rail appears. A single
centered Home owns the entire view region beneath the global top header, so its
canvas color extends behind the centered identity and all the way to the top.
This gives Kanban and Capture Home the intended immersive fill. Once tabs
exist, the shell owns the tab rail and derives its surface from the owning
view's Content Background; a hosted presenter cannot restyle that rail.

Below the tab rail, Home begins its presenter-owned styling immediately and
does not show a location row. Content always receives a shell-owned File
Location and Path rail and then begins the presenter-owned body. Capture
Markdown, Wiki pages, and File Explorer files therefore use identical top
rails even when the originating view defaults to Home. Tabbed Empty remains
shell-owned and places its picker directly beneath Tabs. The global header
remains outside this container stack in every case.

Any of these three kinds can be the configured initial presentation. Wiki has
no Home and starts as a visible Content tab on the Wiki Guide, with its file
location in the second rail and the plus control immediately to the right of
the tab. Capture is the reference Home configuration and begins as one centered
Home canvas. File Explorer is the reference Empty configuration and starts with
the shell-owned picker already presented as a tab. Tickets will also start as
Home.

When a Home view opens its first additional surface, the shell reveals the tab
rail and moves the former centered Home to the left as the first Home tab. The
Home presenter then begins immediately beneath that rail and still has no path
rail. Capture Markdown and an expanded Ticket open beside it as Content and use
the universal Tabs, File Location and Path, and presenter-owned Content stack.
The originating view's Home styling never leaks into the opened Content tab.

Email, Calendar, and comparable productivity capabilities use this same split
inside Productivity Suite. Email begins as Home. Expanding a draft full-size
makes Email Home the first tab and opens the draft as Content. Browsing or
opening another message and composing new mail remain actions of Email Home;
the draft tab stays focused on the opened item. Calendar and similar tools can
apply the same relationship between their Home surface and expanded items.
This presentation pattern does not require each capability to own a separate
left-navigation identity or thread population.

The same registered targets can be exposed selectively by other views. A view
may configure an Email Inbox drawer whose message rows submit Content targets,
and a companion action may open Email Home as a hosted Home tab. The surrounding
view remains the owner of the thread, shell, and restored worksurface. It does
not mount Email's thread list or a nested application shell. Email is therefore
one example of a general configuration pattern: drawer sources launch registered
Home or Content targets through the shared find-or-open placement contract.

A Home module can be a capture list, file/project list, card grid, settings
surface, or another useful landing page. Frequent domain creation actions live
there. Empty-tab selectors do not create collections, projects, folders, files,
or comparable domain objects; they open a module, select an existing resource,
or instantiate the selected hosted component. This keeps domain creation inside
the surface that understands it rather than binding it to New Thread or tab
chrome.

Capture Home supplies an initial reusable layout contract: descriptive text at
the top, followed by a one-folder-deep hierarchy rendered as a scrolling grid.
Each first-level folder becomes a section and its files become cards. Card width
and display treatment are configuration rather than a fixed part of the layout.
Plugins Home can reuse that layout while supplying plugin-specific card behavior;
an Email-inbox layout can likewise be reused for an Issues inbox with a different
data source and permission set.

Cards can share Ticket's optional preview-to-tab interaction without sharing
Ticket data. A Plugin card may preview and then open a Plugin Content presenter.
That presenter uses one Markdown document for its descriptive body, shows basic
switches and the plugin's source folder beneath it, and sends selected source
files to the File Viewer Content presenter in other tabs.

This creates a reusable placement boundary. A browser, terminal, document,
folder surface, Wiki surface, another hosted view, side agent, or chat can all
participate as components without becoming alternate tab implementations.
Exactly which entries form the first supported catalog, and which are broad
component types versus view-specific configurations of one type, remain to be
settled.

The eventual reusable definitions behind that boundary come from registered
plugins. The Plugins view remains a capsule under `System/Views/`, locked Browse
reads Fusion-approved packages from SQLite, and inspectable installed packages
live under `System/plugins/`. View templates, Home displays, Content displays,
and sidebar modules can later resolve by stable identity through that registered
catalog without making the Plugins view folder itself the package source.

Templates and presenters in that library are first-class plugins and may depend
on one another. A view's declarative presentation chain can identify an optional
Home presenter, an optional preview presenter, the presenter used for an
expanded tab, its data source, and its required permissions and dependencies.
The exact schema names remain open; “opens in tab as” resolves to a registered
presenter identity rather than requiring every resource to share one renderer.

This hierarchy also keeps Duplicate View small. If a duplicate begins from its
template defaults and the user later asks to copy selected settings from another
view, the assistant can inspect both capsules and guide the user through the
validated System editor. It does not need direct System write access, and the
product does not need to anticipate every selective-copy combination in the
Duplicate action itself.

Side Chat creation consumes this foundation in two stages: the tab system
creates a container, and the chat domain creates or selects the chat session to
mount there. **Move Chat to Side Chat** is hard-blocked until the separately
owned Tabs as Containers SPEC is implemented and accepted. Later **Send to Side
Chat** flows inherit the same dependency. Neither feature makes modular chat
responsible for container creation, empty-tab presentation, launcher behavior,
component registration, lifecycle, or the component list.

The first Tabs as Containers implementation deliberately stops before the
plugin and view-configuration layers. It builds on the committed shell rail,
adds a generic host capable of holding component-backed content, and settles the
empty-container lifecycle. Existing views remain on their current adapters.
The serializable reference, injected first-party resolver, correlated fill, and
legacy fallback are approved in P-014. Composable Chat follows as a separate
SPEC that registers the portable `ChatSurface` without placing a production
Side Chat. Move Chat to Side Chat is a third SPEC that consumes both accepted
prerequisites. Full dynamic registration and declarative conversion of existing
views wait for Provenance rather than targeting an interim system.

View-native material follows the same placement model. A sidebar, Home module,
preview, empty-tab picker, or other navigation source can pass a typed resource
target to the shared tab host with either an **Open in Current Tab** or **Open
in New Tab** disposition. Sources may choose a default and expose the other as
an alternate action, but they do not directly mutate the tab collection.

The host resolves duplicates before applying the requested disposition. A
stable target identity combines the presenting component with the underlying
resource identity. If that target is already open in the worksurface, Fusion
activates its existing tab and asks the component to reveal, select, or
recenter the resource. The component owns those content-specific details; the
tab host only owns matching, placement, and activation.

**Open in Current Tab** is deliberately non-destructive. After the duplicate
check, the host fills the current tab only when it is empty. A populated
current tab is unavailable, so the host creates a new tab and opens the target
there. Its complete order is therefore: activate and recenter an existing
matching tab; otherwise fill an empty current tab; otherwise open a new tab.
No Home, pinned, dirty-content, or component-specific replacement exception is
needed because this navigation flow never replaces non-empty content.

Placement and presentation remain separate. A typed target carries the
view-owned presenter as well as stable resource identity, so the tab host does
not choose a renderer from the filename alone. Capture Home is a standalone
module, while Markdown reached from Capture opens with Capture's rendered
document appearance. A file reached through File Explorer opens with File
Explorer's fullscreen, syntax-highlighted display and editing behavior. The
same resource can therefore participate in different product presentations
without requiring different tab infrastructure.

Clicking a Capture, Issue, card, project, file, or setting may still open a
popup or preview first. Its tab action asks the originating module to present
the same resource rather than copying preview DOM. Picker-style launchers can
leave a container waiting while a drawer supplies the resource. File
Explorer's File tree is one such sidebar source: it can fill the current tab or
open the selected file in a new tab.

Capture and Ticket cards use this same path directly. Their former fullscreen
Expand control becomes **Open in New Tab**. The action submits the same typed
target as a sidebar: an existing presenter-and-resource match is activated and
centered first; otherwise the host creates a new Content tab. The originating
card or preview does not perform its own tab search, deduplication, or
placement.

Those views still keep their preview modes. Preview is an originating-view
interaction policy, not another container presentation. Capture remains
Note-like by previewing ordinary selections first and exposing the tab action
from there; Tickets can likewise preserve their preview before full opening.
Office documents can later choose direct-to-tab behavior on ordinary selection.
In both policies, any full presentation is a Content tab and uses the same
shared match-and-center-or-create operation.

The bounded reference set proves all three presentations. File Explorer has no
Home module: its new thread opens a selector as a visible Empty tab with **Open
File** and **New Side Chat**. Open File reveals the File tree drawer and fills
that waiting tab. Capture opens its Home beneath centered identity. Pressing
plus preserves that surface as the left Home tab, reveals the strip, and opens
a new Empty tab offering **Capture Home** and **New Side Chat**. Wiki opens the
Wiki Guide as a Content tab from the start and places plus to its right. Tickets
will follow Capture: Ticket Home begins centered, then moves to the left Home
tab when an expanded Ticket opens beside it as Content. Browser and Terminal
remain natural next components, while each view's configuration may choose a
narrower or broader selector list.

Capture does not need a File-tree sidebar merely to replace its former
fullscreen file route. Capture Home can open selected material in another tab
using the same Capture presentation. Project Manager can independently expose
a Bulletin sidebar whose claimed items default to new-tab placement; selecting
a duplicate activates and recenters the already-open target.

Wiki uses a narrower navigation pattern. Ordinary Wiki page navigation does
not produce Capture-style popups or previews. A link can expose a right-click
tab action: if the target remains inside the Wiki folder, the tab uses the Wiki
presenter; if the target is a file outside that folder, the tab uses File
Explorer's single-file presenter and does not open the File-tree drawer.

Project Viewer uses the same primitives as a configured unified workspace. Its
view configuration can provide several slide-out launcher options that open
registered Home modules or presenters—such as the Wiki Guide Content target,
Capture Home, and Browser—into ordinary tabs. Standalone files linked from a Capture document or
another project surface open beside them through the presenter carried by the
target. The Project thread, Main Chat, and worksurface remain the owning
context; opening another view's Home module does not import that view's thread
list or create a nested shell. Project's wider catalog is expressed through
configuration rather than a separate tab or routing implementation.

Configured drawers receive distinct right-edge action icons rather than
sharing one generic drawer symbol. The action row reuses the top workspace
header's shared button sizing, glyph sizing, gaps, and trailing inset so view
controls align with global chrome. Files uses a folder icon. The Home-surface
catalog and Bulletin use their own semantic, configured icons and accessible
labels; their final symbols remain to be selected.

Because these drawers exclusively launch content into tabs, they are workspace
chrome rather than a separately themed navigation layer. The drawer surface
uses Workspace Background, ordinary treatment follows Workspace Chrome, and
the active drawer button uses Workspace Chrome Accent. Content rendered in the
tabs has only Background, Foreground, Accent, and Content Contrast settings.
Contrast jointly attenuates content headers, body text, and derived borders;
Foreground supplies attenuated structural treatment for Home or Wiki
navigation.

The right drawer starts below the persistent top header and consumes layout
width, pushing and narrowing the content container to the left rather than
covering it. Its header icon therefore appears visually attached to the top of
the drawer. The active accented icon toggles that drawer closed. Selecting a
different drawer icon switches the same region directly to the newly selected
drawer, with at most one drawer open.

The app-launcher drawer exposes only self-contained targets that resolve
directly to Home or Content and do not depend on another sidebar. Targets that
land on Empty do not appear there. Project Viewer can combine that launcher
with separate Files and Bulletin drawers, its own configured Home default, and
its configured Empty-tab picker. Narrower views use the same machinery with a
smaller configuration rather than receiving hardcoded exclusions.

## View-Bound Thread Identity

Threads are currently workspace-wide. The new direction binds each thread to an individual view.

This makes a thread more than a conversation that happens somewhere in the workspace. It becomes the durable conversational context of a particular view. The view provides the product surface and capabilities; the thread preserves the conversation and content-worksurface state associated with work in that surface.

Each view may organize its threads through configurable collections. The initial collection is named **Threads**, but a view may rename it, add more, or remove it. The view configuration uses `mode: "folders" | "tags"`, defaulting to folders. Thread metadata always retains multiple stable collection-ID assignments with server-issued ranks. Folder mode shows only the highest-ranked valid assignment; tag mode shows every valid assignment and may place the thread in multiple groupings. Choosing a different folder raises that assignment to the newest rank without deleting the lower-ranked metadata, so switching back to tags restores those memberships.

Fusion always injects a non-removable **Archive** collection. It is the effective home for every thread with no currently valid configured assignment. The Archive button clears every assignment rather than setting a separate archived flag. Removing a configured folder or tag never deletes its threads: dormant metadata can remain, but a thread with no valid configured assignment appears in Archive. Restoring the same configuration ID can restore that membership unless the user explicitly cleared it through Archive.

Thread rows use the shared menu opened from either right-click or the existing kebab. A **Collections** item with the `sub_header` icon opens the collection list in a right-side pop-out. Folder mode presents a true radio group and closes after moving the checkmark to the selected folder. Tag mode presents independent checkboxes with the same checkmark visual and keeps the pop-out open for multiple selections. Archive remains a separate clear-all action rather than a selectable tag.

The visible thread is the stable umbrella for one body of work. It normally has
one underlying chat session but may contain several peer sessions after the
Main Chat is moved to a Side Chat tab. The umbrella owns membership and the
internal history of which peer was primary. The existing `threadId` continues to route
one chat session; the visible umbrella, owning view, and mounted UI surface have
separate identities.

Within a project, several visible threads can share the same folder-backed view,
and each can hold a Main Chat plus peer Side Chats. A side agent can be presented
in a project tab while remaining visibly related to the relevant thread family
and its invoked Agent Profile.

## Per-Thread View State

Each thread preserves the content worksurface state of its bound view. Examples explicitly named by RC include:

- which tabs were open;
- which documents, files, pages, or browser locations were open;
- view-specific selections and navigation locations;
- scroll positions; and
- other content state needed to resume the work exactly where it was left.

For Project Viewer, this state can include the selected Markdown document,
expanded folder locations, bulletin visibility, and the set of auxiliary tabs
open around the default folder surface.

Only the content worksurface needs this continuity contract. Chat visibility, thread-list visibility, and other surrounding shell chrome do not need to become part of the saved work context merely to make the thread resumable.

A folder may be assigned to a view, thread, or launched work item as its worksurface. That binding gives the assistant and UI a useful starting place and body of related material, but it is not a hard filesystem, permission, or reasoning boundary. The assistant may still use other authorized workspace resources when the work requires them.

The owning view folder stores these snapshots by visible-thread identity. The
thread database owns the umbrella and chat membership but does not duplicate
the content snapshot. The exhaustive list of view-specific state fields remains
bounded by each view's adapter. The durable requirement is experiential:
returning to a thread restores the content surface closely enough that it feels
like continuing rather than reconstructing yesterday's setup.

Every view capsule includes a readable `README.md` as the orientation entry
point for conversations bound to it. The README tells the assistant which view
is active. Its last few lines form a short common navigation footer that points
to that view's canonical configuration and prompt, explains that other view
capsules live beside it in the same navigable System tree, and describes the
read-only sibling-listing script. From the resulting list, the assistant can
selectively read another view's README, prompt, and configuration and follow
any declared source-folder binding when a user asks about a different Fusion
capability.

A workspace-level folder in System mirrors the view capsule's orientation and
configuration structure at workspace scope. Its README explains the workspace,
its configuration provides inherited defaults, and its navigation guidance
points toward the workspace's broader content and view tree. The active view
then specializes that base with its own README, configuration, and source-folder
binding. The conceptual order is workspace first and view second: the workspace
teaches the assistant how to move around the whole workspace, while the view
teaches it how to work in the current place. The workspace README also explains
the complete convention—layout, inheritance, prompt composition, configuration
locations, sibling discovery, and source-folder navigation—so the hierarchy is
self-describing rather than dependent on hidden application knowledge.

Prompt assembly makes that order literal. Both levels use `prompt.md`; Fusion
supplies the workspace prompt first and appends the active view prompt at its
tail before handing the combined system context to the configured
harness/provider. The exact OpenRouter or adapter request field must be verified
during later implementation work, but it does not change the visible two-file
contract.

The README is routing and orientation, not a second configuration or prompt
source. The versioned configuration and referenced prompt remain authoritative
for behavior. View-specific guidance is prioritized for the active
conversation, while a small shared System Wiki provides a wider map of Fusion
Studio, the configured harness environment, and cross-app capabilities. New
view-panel packages add their own discoverable Wiki entry in the repository so
the wider system can understand them without injecting every view's
documentation into every prompt.

## Experience Consequences

View binding and per-thread content state create a foundation for features that would be harder to express with workspace-wide conversations. A thread can reopen into a recognizable place, preserve the materials that gave its conversation meaning, and allow navigation, content, and chat to operate as one context.

Fusion Home's grouping adds a density consideration to view binding. Several related but individually low-density capabilities—such as Email, Calendar, To Do, Notes, and Contacts—will share a Productivity Suite view rather than each owning a separate left-navigation icon and thread population. This makes the bound view a meaningful domain context rather than a miniature application boundary.

RC is considering one daily thread for the Productivity Suite and a daily thread when lower-density views such as Health & Fitness are opened. That idea remains provisional until the complete Thread Management behavior is described.

The system-wide inbox introduces a deliberate workspace-level exception to ordinary view thread lists. Its navigation shows one entry per workspace, and each entry restores one persistent chat dedicated to handling that workspace's escalated notification cards. The workspace name therefore acts as both the system-inbox filter and the identity of its notification-handling thread; the panel does not expose all of the workspace's normal view-bound threads.

On phones, view-bound threading becomes spatially explicit inside the slide-out navigation surface. The active workspace's view icons appear along the left; selecting an icon changes the active view and swaps the adjacent thread list to that view's conversations. The workspace-name header changes the workspace boundary, while Notifications mode temporarily replaces the ordinary view/thread navigation with persistent workspace notification chats.

The phone's chat-to-app transition preserves the same identity. The round current-view button beside the composer opens the active app view without implying a different thread, and the collapsed robot control keeps chat visibly attached to that view context.

Side Chats provide local conversational space without requiring a second global thread system. **Move Chat to Side Chat** places the current Main Chat in a content tab and creates a cold, durable, completely empty Main Chat peer inside the same visible thread. The tab centers the same complete chat component, including its list/menu control, and does not add another thread list.

This gives the user two continuation paths. The new empty Main Chat may begin a genuinely new subject, or explicit **Send to Chat** plus later resume guidance can bring selected prior material forward when the old conversation is full or has become too broad. Fusion does not merge transcripts, clone provider context, or pretend that two conversations share one context window.

Project creation and thread creation are now separate flows. **Create Project** lives in side navigation and establishes the Project Viewer, its content root, and any project-level configuration once. **New Chat** within that view creates only another view-bound thread and its initial conversation. It does not create a folder, copy an `AGENTS.md`, place starter documents, create another view, or pass an unresolved folder ID through thread startup.

A Project Viewer can foreground familiar Markdown such as intake, intent, decisions, issues, and transcripts while still allowing ordinary nested folders and files. Four, five, or six threads can share that one project worksurface, and each visible thread can retain two or three Side Chats without changing the project's folder binding. The Project Viewer otherwise follows the same content-tab, thread-list, worksurface-restoration, and composable-chat behavior as any other viewer.

The harness's existing workspace/project root remains the default working directory. A Project Viewer may carry one explicit CWD override to its already-bound project root, but every thread in that view inherits the resolved view policy. New Chat never calculates, creates, or negotiates a new working directory. View-specific instructions remain view configuration and do not have to be selected indirectly through the working directory.

View-level conversation configuration belongs in the view folder. Workspace-wide defaults and view-specific overrides should use one understandable configuration approach rather than unrelated mechanisms. The existing `content.json` is the canonical versioned representation for the view's chat presentation: it can carry the New label and icon plus collection mode, stable IDs, labels, display order, and default assignment. Purpose-built GUI editors and direct user editing share that schema. The adjacent `README.md` points humans and assistants to those settings, the authoritative view prompt, and any source folders without copying their contents. Broader instruction, working-directory, transcript, and precedence fields remain open.

Because these settings can govern permissions and thread creation, the future
System folder is an authority boundary rather than ordinary agent-writable
workspace content. Agents may read the effective policy and explain desired
changes, but only a trusted, user-mediated Fusion interface may write it.
Fusion-owned state persistence can still update view state through narrow
services; that does not grant the harness a generic System write capability.

New-thread creation follows the same boundary. The server accepts a direct user
action or a separately user-authorized automation, not model output or a
request that supplies its own enlarged configuration or permissions.

Saving a transcript is a separate configurable capability. A view can provide a real destination folder or request creation of a folder under a chosen location, while a launched worksurface can pass its own folder binding as the destination.

Automatic thread naming is intentionally separable from the core conversation component. The **Auto-Rename Chat Threads** plugin can own configurable attachment-aware, ticket-aware, and LLM-assisted naming policies while the core supplies explicit names and source-provided titles. Rich attachment icons and overlapping multi-file markers are a plausible later visual enhancement rather than a prerequisite for the first composable-chat pass.

Together, these choices let the same conversation component appear as a normal view chat, a side-chat tab, an expandable inbox reply surface, or a domain-specific creation flow without losing where the conversation belongs.

## Open Questions

- Can a primary thread ever move between views, or is its view binding permanent?
- Can one thread intentionally reference or control content in another view while remaining bound to its own view?
- When a side chat continues prior work, how much of the earlier conversation should the helper summarize and how is that handoff shown to the user?
- Which content-state fields are universal and which are owned by a particular view type?
- What rank-compaction threshold and deterministic repair behavior should the later collection implementation use?
- Which matching workspace and view artifacts are inherited or merged, and which identity or runtime-state artifacts must remain local to their own level?
- What are the field-level precedence and conflict rules among workspace defaults, active-view specialization, user changes, and per-launch overrides?
- Where does the minimal shared System Wiki live, and how does a view package register its corresponding Wiki entry for discovery?
- What exact protected-root capability and user-presence mechanism distinguishes trusted Fusion UI writes from agent/harness file operations?
- What fields and confirmation should the separate **Create Project** flow require when it establishes a Project Viewer's name, content root, optional starter content, and CWD policy?
- How does the universal four-file folder template advertise and validate additional file or subfolder patterns outside Project Viewer?
- Which pieces of the shared Project Viewer presentation are fixed product structure and which are supplied by each project-view capsule?
- Which components belong in the first empty-tab catalog, and which views expose each one by default?
- Does an empty, still-unfilled tab persist with the thread's worksurface across restart?
- When a configured component is missing, disabled, or awaiting permission, does its launcher stay visible with a diagnostic or disappear?
- How do side-agent tabs, hosted views, the bulletin drawer, and raw bulletin JSON participate in per-thread restoration?
- What transcript format, naming rule, and retention behavior should be available independently of automatic thread naming?
- How do mobile and desktop represent the same view-bound thread when their available layouts differ?
- How will an inbox item open the correct view-bound thread and restored worksurface when chat is embedded directly in the inbox?
- When is a new daily view thread created, and when should an earlier daily thread resume, archive, or coexist with longer-lived threads?
- Does one daily thread span every capability inside a suite, and how does it preserve which sub-surface was active?
- How do content-created, ticket-created, daily, manual, side-chat, and longer-lived threads coexist and sort inside one view?
- How is the persistent system-inbox chat related to ordinary view-bound threads when a notification opens its source work?
- When the phone switches from chat to app mode, which parts of thread-specific content state restore immediately and which wait until the user opens them?
