# Threads and Views Model

> Broad analysis of the relationship among navigation, views, threads, side chats, and restored working context. Owner decisions remain authoritative in DECISIONS.md; this document does not prescribe storage, APIs, migrations, or implementation.

## Navigation Relationship

Chat, thread navigation, and the active content view are three composable parts of the Fusion Studio shell. A view may show all three, hide chat while retaining its thread list, hide the thread list while retaining chat, or occupy the full window without either one.

This separation simplifies the meaning of threads. When chat is hidden, the thread list still works as a menu of saved content-worksurface states. Selecting a thread restores the place in the view where that work was left. When both chat and threads are hidden, the view behaves like a full-screen application rather than a special chat state.

The intended desktop navigation still places view navigation beside the thread list on the left. Their adjacency provides orientation without making either one an inseparable part of the content surface:

- view navigation answers where the user is in Fusion Studio;
- the thread list presents the conversations or saved working contexts belonging to that view; and
- the content surface presents the actual material being used.

The creation control is also view-defined. Its label and icon may remain **New Chat** in a general-purpose view or become **New Routine**, **New Agent**, **New Plugin**, or another domain-specific action. The different words do not require unrelated creation systems; they are presentations of a reusable launch action configured by the view.

The current direction places Routines, Agent Profiles, and Plugins as a distinct lower group in navigation. They use the same composable conversation and creation primitives as other views, but their labels and defaults make them feel like editors for reusable system capabilities rather than ordinary project chats.

View capsules themselves belong under `ai/<machine>/System/Views/`. Their
declared primary content folders remain independent. A Wiki view can therefore
point to `ai/<machine>/Wiki`, workspace-root `Wiki/`, or another supported
location; moving the definition into System does not force the content into an
ignored or machine-local tree.

Projects no longer require a special Project Manager layer above ordinary views. The user creates a project directly in side navigation, producing another numbered Project Viewer capsule such as `001-project-viewer`, `002-project-viewer`, and so on. Each capsule has its own immutable manifest ID and project content-root binding even though the numbered folder name remains presentation and ordering metadata. Multiple projects therefore reuse one Project Viewer type while behaving as distinct views.

## View-Bound Thread Identity

Threads are currently workspace-wide. The new direction binds each thread to an individual view.

This makes a thread more than a conversation that happens somewhere in the workspace. It becomes the durable conversational context of a particular view. The view provides the product surface and capabilities; the thread preserves the conversation and content-worksurface state associated with work in that surface.

Each view may organize its threads through configurable collections. The initial collection is named **Threads**, but a view may rename it, add more, or remove it. The view configuration uses `mode: "folders" | "tags"`, defaulting to folders. Thread metadata always retains multiple stable collection-ID assignments with server-issued ranks. Folder mode shows only the highest-ranked valid assignment; tag mode shows every valid assignment and may place the thread in multiple groupings. Choosing a different folder raises that assignment to the newest rank without deleting the lower-ranked metadata, so switching back to tags restores those memberships.

Fusion always injects a non-removable **Archive** collection. It is the effective home for every thread with no currently valid configured assignment. The Archive button clears every assignment rather than setting a separate archived flag. Removing a configured folder or tag never deletes its threads: dormant metadata can remain, but a thread with no valid configured assignment appears in Archive. Restoring the same configuration ID can restore that membership unless the user explicitly cleared it through Archive.

Thread rows use the shared menu opened from either right-click or the existing kebab. A **Collections** item with the `sub_header` icon opens the collection list in a right-side pop-out. Folder mode presents a true radio group and closes after moving the checkmark to the selected folder. Tag mode presents independent checkboxes with the same checkmark visual and keeps the pop-out open for multiple selections. Archive remains a separate clear-all action rather than a selectable tag.

The visible thread is the stable umbrella for one body of work. It normally has
one underlying chat session but may contain several peer sessions after a
primary chat is moved to a side tab. The umbrella owns membership and the
history of which peer was primary. The existing `threadId` continues to route
one chat session; the visible umbrella, owning view, and mounted UI surface have
separate identities.

## Per-Thread View State

Each thread preserves the content worksurface state of its bound view. Examples explicitly named by RC include:

- which tabs were open;
- which documents, files, pages, or browser locations were open;
- view-specific selections and navigation locations;
- scroll positions; and
- other content state needed to resume the work exactly where it was left.

Only the content worksurface needs this continuity contract. Chat visibility, thread-list visibility, and other surrounding shell chrome do not need to become part of the saved work context merely to make the thread resumable.

A folder may be assigned to a view, thread, or launched work item as its worksurface. That binding gives the assistant and UI a useful starting place and body of related material, but it is not a hard filesystem, permission, or reasoning boundary. The assistant may still use other authorized workspace resources when the work requires them.

The owning view folder stores these snapshots by visible-thread identity. The
thread database owns the umbrella and chat membership but does not duplicate
the content snapshot. The exhaustive list of view-specific state fields remains
bounded by each view's adapter. The durable requirement is experiential:
returning to a thread restores the content surface closely enough that it feels
like continuing rather than reconstructing yesterday's setup.

## Experience Consequences

View binding and per-thread content state create a foundation for features that would be harder to express with workspace-wide conversations. A thread can reopen into a recognizable place, preserve the materials that gave its conversation meaning, and allow navigation, content, and chat to operate as one context.

Fusion Home's grouping adds a density consideration to view binding. Several related but individually low-density capabilities—such as Email, Calendar, To Do, Notes, and Contacts—will share a Productivity Suite view rather than each owning a separate left-navigation icon and thread population. This makes the bound view a meaningful domain context rather than a miniature application boundary.

RC is considering one daily thread for the Productivity Suite and a daily thread when lower-density views such as Health & Fitness are opened. That idea remains provisional until the complete Thread Management behavior is described.

The system-wide inbox introduces a deliberate workspace-level exception to ordinary view thread lists. Its navigation shows one entry per workspace, and each entry restores one persistent chat dedicated to handling that workspace's escalated notification cards. The workspace name therefore acts as both the system-inbox filter and the identity of its notification-handling thread; the panel does not expose all of the workspace's normal view-bound threads.

On phones, view-bound threading becomes spatially explicit inside the slide-out navigation surface. The active workspace's view icons appear along the left; selecting an icon changes the active view and swaps the adjacent thread list to that view's conversations. The workspace-name header changes the workspace boundary, while Notifications mode temporarily replaces the ordinary view/thread navigation with persistent workspace notification chats.

The phone's chat-to-app transition preserves the same identity. The round current-view button beside the composer opens the active app view without implying a different thread, and the collapsed robot control keeps chat visibly attached to that view context.

Side chats provide local conversational space without requiring a second global thread system. **Move Chat to Side Chat** places the current primary in a content tab and creates a cold, durable, completely empty primary peer inside the same visible thread. The tab centers the same complete chat component, including its list/menu control, and does not add another thread list.

This gives the user two continuation paths. The new empty primary may begin a genuinely new subject, or explicit **Send to Chat** plus later resume guidance can bring selected prior material forward when the old conversation is full or has become too broad. Fusion does not merge transcripts, clone provider context, or pretend that two conversations share one context window.

Project creation and thread creation are now separate flows. **Create Project** lives in side navigation and establishes the Project Viewer, its content root, and any project-level configuration once. **New Chat** within that view creates only another view-bound thread and its initial conversation. It does not create a folder, copy an `AGENTS.md`, place starter documents, create another view, or pass an unresolved folder ID through thread startup.

A Project Viewer can foreground familiar Markdown such as intake, intent, decisions, issues, and transcripts while still allowing ordinary nested folders and files. Four, five, or six primary threads can share that one project worksurface, and each visible thread can retain two or three side-chat peers without changing the project's folder binding. The Project Viewer otherwise follows the same content-tab, thread-list, worksurface-restoration, and composable-chat behavior as any other viewer.

The harness's existing workspace/project root remains the default working directory. A Project Viewer may carry one explicit CWD override to its already-bound project root, but every thread in that view inherits the resolved view policy. New Chat never calculates, creates, or negotiates a new working directory. View-specific instructions remain view configuration and do not have to be selected indirectly through the working directory.

View-level conversation configuration belongs in the view folder. Workspace-wide defaults and view-specific overrides should use one understandable configuration approach rather than unrelated mechanisms. The existing `content.json` is the canonical versioned representation for the view's chat presentation: it can carry the New label and icon plus collection mode, stable IDs, labels, display order, and default assignment. Purpose-built GUI editors and direct user editing share that schema. Broader instruction, working-directory, transcript, and precedence fields remain open.

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
- How should workspace defaults, installed view defaults, user changes, and per-launch overrides compose?
- What configuration format in a view folder can remain inspectable without forcing every view to expose the same controls?
- What exact protected-root capability and user-presence mechanism distinguishes trusted Fusion UI writes from agent/harness file operations?
- What fields and confirmation should the separate **Create Project** flow require when it establishes a Project Viewer's name, content root, optional starter content, and CWD policy?
- Which pieces of the shared Project Viewer presentation are fixed product structure and which are supplied by each project-view capsule?
- What transcript format, naming rule, and retention behavior should be available independently of automatic thread naming?
- How do mobile and desktop represent the same view-bound thread when their available layouts differ?
- How will an inbox item open the correct view-bound thread and restored worksurface when chat is embedded directly in the inbox?
- When is a new daily view thread created, and when should an earlier daily thread resume, archive, or coexist with longer-lived threads?
- Does one daily thread span every capability inside a suite, and how does it preserve which sub-surface was active?
- How do content-created, ticket-created, daily, manual, side-chat, and longer-lived threads coexist and sort inside one view?
- How is the persistent system-inbox chat related to ordinary view-bound threads when a notification opens its source work?
- When the phone switches from chat to app mode, which parts of thread-specific content state restore immediately and which wait until the user opens them?
