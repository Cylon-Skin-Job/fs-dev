# Launchpad and Work Folders

> Owner vision, updated October 2. This records intended product behavior; it is not a claim about current Fusion implementation or an instruction to migrate existing folders.

## Workspace templates and shared entry point

The four main workspace templates are **Fusion Home**, **Code Workspace**, **Research Library** and **Media Studio** (earlier called Media Editor in this discussion). All have **Launchpad up top**.

Launchpad absorbs the current Capture experience and broadens its purpose: project management, note-taking and riff capture, vacation planning and other bounded work. It is useful beyond software delivery. The owner has not specified the detailed layout of every workspace template or required every kind of work to pass through a software roadmap process.

Use **workspace/project** for the outer container and **Work Folder** for a named body of work within it. A Work Folder is not another workspace. This distinction addresses the ambiguity of calling both things a project.

Capture and Notes are superfluous as separate product destinations in this model: use a Work Folder for that material. Tickets also goes away as a separate destination; ticket work lives in Work Folders. The existing Capture viewer supplies the reusable interface, while Work Folder is the user-facing concept.

## Focused managers — October 2 refinement

The owner narrows the earlier Mission Control concept into three named managers:

| Manager | Owner-defined responsibility |
|---|---|
| Inbox Manager | An inbox of alerts flagged for user attention. It carries forward the CURRENT/UPCOMING attention experience, app-database records, synopses and links to approval/reply in the associated chat. |
| Branch Manager | Visually represent roadmap and SPEC work, divergence into separate worktrees, merges, commits and publication to GitHub; help stage work from separate Work Folders and determine when to branch and merge. |
| System Manager | Manage Wiki and context, and ensure interoperability. |

This supersedes treating the attention inbox as the whole Mission Control view. The placement of the three managers in Launchpad, and whether Mission Control remains an umbrella name, are not yet specified. The earlier shell sketch below records the September starting point rather than choosing that placement.

### Branch Manager visual work graph

The owner proposes agent-populated JSON describing the big picture: how and when work from separate folders is staged, where it diverges into worktrees, and where it comes together for integration. The display uses connected lines and named circles. It covers roadmap/SPEC completion and acceptance, merge-SPEC generation and acceptance, merge completion, commits and GitHub publication.

Owner sketch, preserved as an illustration rather than an executable sequence:

```text
○ Roadmap … Completion & Acceptance
│
○ Merge SPEC Generation & Acceptance
│
○ Merge Completion and Commits
│
○───────────────────○
│                   │
○ Provenance        ○ Chat System
```

The sketch establishes the visual language and example labels. Edge direction, time direction and the exact dependencies between those examples have not been chosen.

**Working proposal:** JSON could describe named nodes, relationships and references to the relevant Work Folders, roadmaps, SPECs, threads, worktrees and Git records. The agent supplies the plan and updates its account of progress; the view renders the graph. Planned steps, work reported complete and recorded owner acceptance should remain distinguishable. Dependencies and actual Git ancestry are different relationships even when both appear in the graph.

The attention layer remains in the app database. JSON is a proposed representation for the Branch Manager graph; the owner has not chosen whether it is stored as a file or in the database. The graph can connect several auditable Work Folders while retaining each folder's identity. No JSON schema, roadmap, SPEC or Git operation is being created at this stage.

## Basic Code Workspace shape

The owner describes this basic code-repository workspace:

```text
Code Workspace
├── Launchpad
│   ├── Mission Control
│   └── New Work Folder → named Work Folders
├── File Explorer (Code Editor)
├── Wiki
├── Browser
├── Agents
└── Plug-Ins
```

This records the main destinations and their relationship, not a pixel-level sidebar design. Capture, Notes and Tickets do not remain separate destinations alongside Launchpad. Notes, intake and ticket investigation remain useful activities within Work Folders.

Fusion Home can also have its own apps. Research Library can have the JSON Library view. The owner sees Media Studio as a place where the Launchpad idea may evolve further; that exploration is explicitly deferred. The Code Workspace shape does not prescribe all the apps or views in the other templates.

## Fusion Home — everyday planning and collection

The owner identifies vacation planning, goal planning, study planning and workout planning as examples of work within **Fusion Home**. These are examples to support, not an exhaustive fixed catalog or separate workspace types.

A person may simply bring external research into a Work Folder, add new rows for assorted information and create artifacts. The folder must be useful for gathering and developing material before there is a formal plan or a defined deliverable. This extends References beyond generated work from other agents to include externally gathered material; exact placement and presentation remain to be shaped.

**Working interpretation:** a Work Folder can grow from a loose collection into a structured plan when useful. Its template can offer a starting arrangement without requiring the full software-delivery lifecycle. A vacation folder might collect destination notes and research, then produce an itinerary; a study folder might gather reading material and produce a study aid. These examples illustrate the direction, not approved feature lists.

The owner clarified that fs-dev's existing Capture viewer already provides the interface: folder headings with horizontal rows of document tiles. Reuse that interface, scoped to one Work Folder, with its internal folders supplying the rows. Adding rows for assorted information extends this familiar experience. The basic row presentation is established; supported artifact types and research-import mechanics can be shaped separately.

## First concrete experience — Code Workspace

The September entry-point concept places Launchpad at the top of a Code Workspace, with **Mission Control** above a **New Work Folder** button. The October 2 refinement names Inbox Manager, Branch Manager and System Manager; their precise placement remains to be shaped. The Work Folder creation flow carries forward:

The creation flow is:

1. The owner clicks New Work Folder.
2. Fusion asks for a name.
3. Fusion creates the named Work Folder and a new thread.
4. That thread opens with the existing Capture viewer interface as its default, adapted to scope it to that single Work Folder.

The headings in the scoped view represent subfolders inside that Work Folder. They do not each open another large Capture collection containing dozens of documents. The new experience should keep the current body of work understandable without presenting the whole Captures root.

This describes the user experience. Exact filesystem paths, persistent IDs, creation transactions and mapping to existing thread groups/sessions remain technical design questions. Do not infer them from the UI hierarchy alone.

## Work Folder anatomy

The owner proposes these internal areas:

```text
Named Work Folder
├── Intake
├── Checkpoints
├── References
├── Drafts
├── Roadmap
└── Reports
```

| Area | Recorded intent |
|---|---|
| Intake | The capture, decisions and other working-memory documents already developed in the setup workflow. |
| Checkpoints | Readable checkpoints of where the work stands, supporting re-entry. |
| References | Generated material produced by other agents. |
| Drafts | Named place for draft material; exact contents and lifecycle remain to be shaped. |
| Roadmap | Named place for roadmap material when the work needs it; exact SPEC/slice arrangement remains open. |
| Reports | Named place for reports; distinction from agent-produced reference material remains to be shaped. |

These are proposed Work Folder structure and display headings, not six new top-level Captures. Whether every template creates all six areas immediately or only when needed remains open.

The present repository rule requiring flat Markdown in Capture 039 still governs this design record. The future nested Work Folder model is product direction, not permission to silently reorganize existing Captures now.

## Work Folder as one auditable object

**Owner direction:** the thread family and the files in a Work Folder form one single auditable object. The Work Folder unifies the conversations through which work happens and the documents and artifacts that work produces. Its associated attention items, approvals and responses connect back to that same body of work.

The intended audit experience is to trace what was requested, which agent or person acted, what material informed the work, what was approved and what resulted. This is a product-level unity across app-database records and folder files; it does not require putting every file's contents in the database. How identities and historical versions support that trace remains a later design question.

## Work Folder templates and tickets

Work Folders can have different templates. The owner named a simple one-shot bug template and a ticket template for work that may need investigation and approval.

**Ticket = Work Folder** is the intended product model, with no separate Tickets destination. A ticket's discussion, intake, investigation and subsequent work should be understood as one bounded body of work. This does not yet decide migration from existing ticket files/registries, compatibility, identifiers, or what historical statuses mean.

The templates should express the appropriate kind of work. A proposed implication is to avoid requiring a vacation plan, note or simple bug to populate a full software roadmap structure. Exact template defaults and transitions remain open.

## Checkpoints and conversational continuity

The owner suggests readable Markdown checkpoints could remove the need to track a last chat ID for re-entry: read the latest checkpoint or a small number of recent checkpoints instead.

Record this as a continuity proposal. It selects a desired readable resume experience; it does not yet establish checkpoint production, completeness, freshness or how uncheckpointed work is recovered. It also does not settle whether internal cursor bookkeeping is retained, or change the durable identities used to route live chats and assignments.

Do not carry the existing Codex checkpoint helper's cursor mechanism into Fusion as a fixed requirement. Equally, do not claim that a human-readable summary already guarantees complete recovery. Those mechanics can be investigated when the experience is shaped enough to require them.

## Inbox Manager and agent attention

The October 2 refinement assigns the earlier Mission Control attention view to **Inbox Manager**. Its inbox contains alerts flagged for user attention. The owner identified these attention categories, with flexible prioritization according to context and user instructions:

1. Builds frozen because they need input.
2. Approvals needed before the next step, such as a review or audit.
3. Proposed merges awaiting a decision.
4. Housekeeping, including Wiki updates.

The owner proposes **CURRENT** and **UPCOMING** groupings. Working interpretation: CURRENT means an item needs attention now; UPCOMING means a known follow-up is waiting on a prerequisite. These describe attention items, not whether a build process is currently running. A proposed merge awaiting the owner's decision can therefore be CURRENT while its dependent Wiki update is UPCOMING.

Owner example: **“Update wiki — Pending Merge Acceptance.”** The pending item names what it is waiting for. Once that prerequisite is satisfied, the proposed behavior is to move the follow-up into CURRENT if action is still needed. Satisfying a prerequisite does not itself grant approval for the next action.

**Owner direction — flexible attention management:** the earlier Mission Control concept makes the decisions about what to surface, how to prioritize and group it under CURRENT or UPCOMING, and when an alert or notification is useful to the user. These decisions can adapt to the user's instructions and the work's context. The groupings provide a simple presentation, while Mission Control exercises judgment about the items within them.

The owner suggests giving Mission Control scripts it can run. Possible supporting operations include gathering status, updating attention items and delivering notifications; these are examples, not a selected implementation. Scripts would provide dependable operations for Mission Control to use while it retains flexibility in deciding how to keep the user informed. This attention-management discretion preserves the existing approval requirements for the underlying work.

**Owner direction — app database and direct chat actions:** this attention/notification layer lives in the app database. Attention items connect directly to the associated chat and provide a synopsis so the user can understand what is needed, give an approval, or compose a response to the agent and hit Send. The intended flow is: open an attention item, read the synopsis, then approve or reply in the linked chat context.

This establishes app-database persistence for the attention layer and a direct path from an alert to the conversation and action it concerns. Work Folder documents retain their previously described role. The specific link format and interaction layout can be shaped later.

Mission Control monitors the Draft agent, Roadmap Creator, Preflight and Roadmap Supervisor, allowing the owner to return when input or attention is needed. This extends the earlier coordination vision into the Launchpad experience.

The Work Folder gives the owner a place to inspect the work and its artifacts. Mission Control provides awareness of agent activity and coordination. Existing owner-acceptance requirements remain in force; monitoring does not itself approve new scope or complete a gate.

Exact child-thread placement, cross-Work-Folder dependencies, monitoring scope and whether each workspace template has the same Mission Control arrangement are not yet specified. The Code Workspace example should not silently decide all other templates.

## Next shaping questions

Use the existing Capture viewer as the Work Folder default-page baseline, the app-database attention list for Inbox Manager and the proposed visual work graph for Branch Manager. System Manager manages Wiki, context and interoperability. Attention items lead directly to chat context with a synopsis and approval/reply actions. Continue shaping that interaction and how the owner switches between a Work Folder's conversation and subfolders. Then clarify template defaults, checkpoint semantics and the relationship between References and Reports.

Main entry: [master vision](vision.md). Resume: [handoff](handoff.md).
