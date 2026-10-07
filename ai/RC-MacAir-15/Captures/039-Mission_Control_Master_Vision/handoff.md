# Mission Control Master Vision — Handoff

**Updated:** 2026-10-02 (PDT)
**Phase:** product vision capture and shaping
**Task home:** `01a0ddfd-81fe-7e03-8786-e514d762a797`

## Start here

Read [vision.md](vision.md), then follow [sources.md](sources.md) selectively. The owner established this fork to add a Mission Control master vision Capture describing how fs-dev will absorb the concepts developed so far.

Capture 037 remains the Codex-based Mission Control setup work and its TODO/registry. Capture 039 is the Fusion product-vision home. The distinction prevents this fork from accidentally taking over the original tasks or treating their implementation outside Fusion as shipped Fusion features.

## Settled and open

Settled for this fork: create and maintain this vision home; preserve owner direction and source provenance; stay at product/coordination level, without authoring roadmaps or conducting deep codebase searches. The existing hierarchy and per-SPEC owner acceptance are carried forward from 037.

New owner direction: four main templates (Fusion Home, Code Workspace, Research Library, Media Editor), each with Launchpad up top. Launchpad absorbs Capture into a general work experience. In Code Workspace, Mission Control is the top Launchpad thread, with New Work Folder beneath it. Naming a new Work Folder creates a thread whose default Capture-style view is scoped to that folder. Headings represent its internal subfolders, not whole Capture collections. Ticket = Work Folder. See [launchpad-and-work-folders.md](launchpad-and-work-folders.md).

Proposed internal areas: Intake, Checkpoints, References, Drafts, Roadmap, Reports. Intake holds capture/decisions and related working-memory documents; References holds other agents' generated material. There are different Work Folder templates for one-shot bugs and investigation/approval tickets. Readable Markdown checkpoints may replace last-chat-ID tracking for re-entry; exact mechanics remain unresolved.

Open: detailed Work Folder navigation, template defaults, workspace/portfolio scope, packaging, state/identity ownership, role/runtime portability, authority, checkpoint completeness and relationship to Fusion Server. Do not reinterpret the readable-checkpoint proposal as removing operational chat identities. No existing folders or tickets have been migrated.

## Next conversation

**October 2 refinement takes precedence:** the owner narrows the concept to Inbox Manager, Branch Manager and System Manager. Inbox Manager receives alerts flagged for user attention. Branch Manager visually represents roadmaps, SPECs, worktree divergence, merges, commits and GitHub publication. The owner proposes agent-populated JSON for a graph of named circles and lines showing how work from separate folders is staged, branched and merged. The sketch and source distinctions are recorded in launchpad-and-work-folders.md. System Manager manages Wiki and context and ensures interoperability, as clarified by the owner immediately afterward.

Continue shaping this graph at the product level. Do not create a roadmap, JSON schema or implementation. JSON storage, graph direction and manager placement are not chosen. CURRENT/UPCOMING and the existing database/chat-action direction carry into Inbox Manager. The auditable Work Folder principle remains. Earlier Mission Control references below describe the prior concept and must be read through this refinement.

Latest owner principle: the thread family and files in a Work Folder form one single auditable object. Associated attention items, approvals and responses connect to that body of work. Preserve this as the product model; traceability across conversations, decisions and artifacts is the intent, with historical-version and identity mechanics still to be designed.

Latest owner direction: the attention/notification layer lives in the app database. Items provide a synopsis and direct links into the associated chat so the user can give approval or compose a response to the agent and hit Send. Preserve this as a settled storage direction for this layer; link format and detailed interaction layout remain to be shaped. Work Folder document storage is not changed by this decision.

Latest clarification: Mission Control decides what needs to be surfaced, prioritized, grouped and notified, with flexibility to suit the user and context. The owner suggests optional scripts it can run to support this. CURRENT/UPCOMING are presentation groupings managed with agent judgment; do not turn the illustrative categories into a rigid notification policy. Underlying work approvals remain as previously established. No scripts or automation have been created.

Latest owner direction: Mission Control's tabbed view is an attention list covering builds frozen for input, approvals before review/audit or another next step, proposed merges, and housekeeping such as Wiki updates. The owner proposes CURRENT and UPCOMING, exemplified by “Update wiki — Pending Merge Acceptance.” Working interpretation: CURRENT needs attention now; UPCOMING awaits a named prerequisite. Transition to CURRENT when unblocked is a proposed behavior, not an approved automation contract. See the Mission Control section in launchpad-and-work-folders.md.

Work Folder replaces separate Capture/Notes and Tickets destinations. The basic Code Workspace has Launchpad, File Explorer (Code Editor), Wiki, Browser, Agents and Plug-Ins. Fusion Home can have its own apps; Research Library can have the JSON Library view. The owner now calls the media template Media Studio and defers exploring how Launchpad evolves there. Continue from this simplified product shape; do not reintroduce separate Capture, Notes or Tickets destinations.

Latest owner clarification: the existing Capture viewer in fs-dev already provides the interface. Reuse its folder headings and document-tile rows, scoped to a single Work Folder. Do not reopen the basic row presentation as an undefined design question. A bounded source read confirms that presentation; it does not establish that Work Folder scoping or row creation is already implemented.

Fusion Home supports vacation, goal, study and workout planning, as well as simply collecting external research, adding rows for assorted information and creating artifacts. This is preserved in launchpad-and-work-folders.md. Keep the experience open-ended; do not presume every folder needs a formal plan.

Continue the Work Folder experience: conversation, subfolder navigation, agent activity and when the owner returns to Mission Control. Draft agent, Roadmap Creator, Preflight and Roadmap Supervisor can be monitored from MC. Keep this usable for note-taking and vacation planning as well as coding; do not impose a roadmap on every Work Folder. If research becomes necessary, frame a bounded assignment; do not dispatch the original setup backlog.

## Work performed and limits

Created vision, source map, this handoff and changelog, then added the owner-described Launchpad/Work Folder model. The earlier cross-link from 037 remains. No setup task state, agent profile, automation, product code, Wiki, ticket or Git publication changed.
