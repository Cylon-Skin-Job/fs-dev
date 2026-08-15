# INTERACTION MODEL — Chat, Apps, Views, and Surfaces

> Working synthesis of the cross-device interaction paradigm from RC's Project Vision. DECISIONS.md remains authoritative; this model does not authorize UI implementation.

## Chat Surface Roles

Fusion Studio has two related but distinct conversational surfaces:

- **Launchpad** is its own section for capture-style ideation, shaping, durable re-entry, and progression toward more formal work.
- **Workspace chat** otherwise behaves like an OpenCode-style harness: it is attached to the active workspace and focuses on direct work in that context.
- **Robin chat** is the default System Manager surface and can discuss topics globally across workspaces, subject to explicit access boundaries.

The distinction is functional rather than cosmetic. Launchpad preserves and matures thought; harness chat works within a bounded workspace; Robin provides system-wide orientation, conversation, and transitions into apps or grounded source lookup.

## System Manager App Shell

Robin uses a Raven OS-style app paradigm.

- A persistent app button or bird icon opens a modal or app drawer.
- Chat is the default surface.
- A view menu can switch from chat into full app content.
- Items referenced in chat can open the corresponding content or app experience directly.
- Exiting an app returns to the default Robin conversation.
- The same shell becomes the principal interaction model for the planned web application.

The System Manager's presentation remains constant even while the underlying workspace changes.

## Workspace View Shell

Desktop workspaces remain closer to VS Code with chat attached than to a phone-style app shell.

- Workspace context stays primary.
- Chat remains visibly attached to the workspace.
- A caret or upward-control can slide the current view into or out of prominence.
- Views can be selected from a menu within the raised surface or from the chat menu.
- A selected app-capable surface can render as workspace content between chat and the left-side navigation or menu structure.

Robin does not force the workspace shell to adopt the System Manager's modal interaction model.

## Responsive Presentation Contract

An app and a view may be two presentations of the same underlying capability.

- On mobile or the web app, the capability can occupy a slide-up or full app surface.
- In Robin on desktop, it can appear as an overlay or app drawer.
- Inside a desktop workspace, it can render as a view panel beside the workspace chat.
- The underlying state, data contract, commands, and reusable components should remain shared where practical.
- Presentation-specific navigation and density may differ without forking the domain model.

A user who creates a mobile-capable view panel has effectively created a capability that can participate in the System Manager app shell as well.

## Navigation and Content Handoffs

Conversation can act as a launcher into richer content:

1. Robin or workspace chat references an item, app, ticket, entity, graph node, or document.
2. The user opens it from the conversation.
3. The relevant view or app becomes the main content surface.
4. Chat remains available as context or returns when the user exits.
5. The app can send a selected object or action back into chat for discussion.

Menus should expose equivalent destinations without requiring the item to be mentioned in chat first. Navigation state must preserve which workspace, app, view, record, and conversation the user came from.

## Shared Components and Data

Apps and views can reuse visual and behavioral components while sharing internal database data when they represent the same domain objects.

Shared access requires explicit contracts for:

- object identity and query boundaries;
- read and write capabilities;
- workspace and user scope;
- sensitive-data permissions;
- commands and mutations;
- event subscriptions;
- responsive presentation slots; and
- provenance when an AI action changes shared data.

Component reuse must not become implicit permission for one app or workspace to read all data represented by another.

## Example Apps

**Personal Inventory** could be the user-facing place to inspect memory nodes: database-backed Launchpad containers for topics, entities, projects, and other subjects. It can expose each node's internal synthesis, branches, tags, schemas, sources, and update history while also presenting edges among thoughts, excerpts, articles, entities, projects, and source records. Its visual language should distinguish it from ordinary folder-based workspaces.

**Weekly Review** could be an app backed by a script and checklist generator. It combines recurring template items, heuristically selected prompts, and actual database state, then records what was reviewed, deferred, or completed.

**Routines** is the cross-cutting catalog, conversational runner, and editor for executable memory-node extensions. A routine can also appear within the Health, Morning, Coding Learning, project, or other node it serves. The user can invoke it from chat, open its state and history as app content, or interact with a domain-specific projection such as vitamin icons, hydration progress, or flashcard statistics.

These examples demonstrate the shell and capability model; neither is approved for implementation.

## Open Design Questions

- What exactly belongs in Launchpad versus ordinary harness chat?
- How does the app button, bird icon, caret, drawer, overlay, and workspace view behave at each breakpoint?
- Does chat remain visible beside full app content, become collapsible, or temporarily yield the surface?
- What navigation state must survive switching between Robin, workspaces, apps, and views?
- Which component contracts are truly portable across web, mobile, Robin, and desktop workspaces?
- How are shared database capabilities requested, displayed, revoked, and audited?
- Can user-authored views declare app metadata safely without accessing unrelated internal data?
- What makes Personal Inventory visually and conceptually distinct from workspaces while preserving navigability?
- How does one routine appear consistently in the Routines catalog, Robin chat, attached memory nodes, domain apps, and mobile views without duplicating state?
