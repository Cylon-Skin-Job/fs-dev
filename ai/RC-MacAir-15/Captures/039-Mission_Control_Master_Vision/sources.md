# Mission Control — Source and Authority Map

> Navigation and provenance. A linked proposal, task status or source inspection is not automatically approved product behavior.

## Owner and conversation sources

- October 2 narrowing in this fork: Inbox Manager, Branch Manager and System Manager. Inbox Manager holds alerts flagged for user attention. Branch Manager shows roadmap/SPEC work, worktrees, branching, merges, commits and GitHub publication, potentially through agent-populated JSON rendered as named circles and lines. The owner supplied the Roadmap / Merge SPEC / Merge Completion / Provenance / Chat System sketch. The owner then clarified that System Manager manages Wiki and context and ensures interoperability. Graph direction and JSON storage remain unspecified. This direction supersedes presenting the attention inbox as the whole Mission Control experience.

- September 26 auditability principle: thread families and the files in a Work Folder form one single auditable object. The connected attention/approval experience supplies context for tracing the work as a whole.
- September 26 persistence and interaction direction: the Mission Control attention/notification layer lives in the app database, with direct links into chat, a synopsis, and approval or compose-and-send actions for the user.
- September 26 attention-management clarification: Mission Control makes these decisions with flexibility for user alerts/notifications; scripts it can run are a possible supporting mechanism. Detailed script operations remain examples, not an implementation choice.
- September 26 Mission Control view direction: an attention list for frozen builds needing input, approvals before next steps, proposed merges, and housekeeping. Owner suggests CURRENT/UPCOMING and gives “Update wiki — Pending Merge Acceptance.” Actionable versus waiting semantics and prerequisite-driven transition are recorded as working interpretations in [Launchpad and Work Folders](launchpad-and-work-folders.md).
- Latest September 26 clarification in this fork: Work Folder makes separate Capture/Notes and Tickets destinations unnecessary. Code Workspace retains File Explorer (Code Editor), Wiki, Browser, Agents and Plug-Ins alongside Launchpad. Fusion Home can have apps, Research Library can have the JSON Library view, and Media Studio exploration is deferred.
- Current fork: [Mission Control](codex://threads/01a0ddfd-81fe-7e03-8786-e514d762a797). September 26 direction establishes this master vision as the way fs-dev will absorb Mission Control concepts.
- Subsequent September 26 owner vision in this fork defines four workspace templates, Launchpad absorbing Capture, the Code Workspace Mission Control/New Work Folder entry, scoped folder views, Ticket = Work Folder and candidate internal areas/checkpoint behavior. Preserved in [launchpad-and-work-folders.md](launchpad-and-work-folders.md); exact technical mechanics remain open.
- Original conversation: [🚀 Mission Control](codex://threads/01a0cc30-3d70-78d2-9abd-1e80f7f758e7). Its durable setup records are in Capture 037; use those records before loading conversation history.

## Existing Mission Control work

| Source | Use |
|---|---|
| [037 charter](../037-Plugin_Integration_And_Parallel_Roadmaps/mission-control.md) | Role, hierarchy, depth boundary, missing-intent requirement and proposed principles. |
| [037 TODO](../037-Plugin_Integration_And_Parallel_Roadmaps/todo.md), [registry](../037-Plugin_Integration_And_Parallel_Roadmaps/registry.md), [handoff](../037-Plugin_Integration_And_Parallel_Roadmaps/handoff.md) | Current setup assignments; MC-T01–03 recorded complete at the September 26 read. This Capture does not advance them. |
| [Domain routing](../037-Plugin_Integration_And_Parallel_Roadmaps/domain-routing.md) | Accountable roles, memory homes and future-roadmap intake. |
| [Coordination design](../037-Plugin_Integration_And_Parallel_Roadmaps/coordination-system.md), [bulletin](../037-Plugin_Integration_And_Parallel_Roadmaps/bulletin.md) | Registry/bulletin responsibilities, hierarchy, dependencies and proposed supervision. |
| [Integration jobs](../037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md) | Branch/integration role, requirements escalation, First Draft and independent Preflight. |
| [Ticket inventory](../037-Plugin_Integration_And_Parallel_Roadmaps/ticket-inventory.md) | Dated examples of supersession, coverage and source discrepancies; recheck before acting. |

037 has minor status-text inconsistencies noted during the fork's initial review: charter/bulletin wording lags the registry/TODO, and MC-T04 still refers to Second Brain. These do not establish a new product requirement or authorize this fork to rewrite setup records. Current local Launchpad, Capture and Checkpoint instructions are the relevant prototypes to examine when needed.

## Fusion sources

- Existing Capture interface: [CaptureTiles.tsx](../../../../fusion-studio-client/src/components/capture/CaptureTiles.tsx) and [TileRow.tsx](../../../../fusion-studio-client/src/components/tile-row/TileRow.tsx). The owner's September 26 clarification identifies this viewer as the interface baseline. A bounded source read confirms folder headings and horizontal document-tile rows; single-Work-Folder scoping is intended adaptation, not verified current behavior.
- [Platform And Plugins](../../Wiki/011-Platform_And_Plugins/000-Platform_And_Plugins/PAGE.md): current composition model with source-inspected foundations, target direction and open choices separated.
- [Workspaces And Views](../../Wiki/001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md): context and presentation ownership; consult for affected questions.
- [Chat System](../../Wiki/007-Chat_System/000-Overview_and_References/PAGE.md): chat identity and runtime source route; reconcile with newer accepted chat work before making implementation claims.
- [Code Standards](../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md): routing hub for future bounded technical assignments, not a reason to perform a general code audit here.
- [Fusion Server capture](../001-Captures/fusion-server-knowledge-sync-and-instance-identity.md): adjacent long-range direction, not a chosen prerequisite or deployment plan for Mission Control.

## Evidence boundary

This initial capture synthesizes documents and owner discussion. It does not certify implementation, current runtime health, profile behavior or completion of any product roadmap. Read only the sources needed for the next question. Preserve source-native decisions and IDs rather than duplicating their authority here.
