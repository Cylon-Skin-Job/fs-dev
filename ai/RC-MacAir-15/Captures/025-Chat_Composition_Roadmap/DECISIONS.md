# Chat Composition Roadmap Decisions

> These records capture explicit owner direction and reconciled choices for this
> roadmap candidate. They become implementation authority only after the owner
> approves the exact release candidate.

## Owner Decisions

### CHAT-RD-001 — Use five single-domain SPECs

- **Authority:** owner decision
- **Status:** propagated

The refreshed roadmap has five implementation SPECs: Trusted Fusion Shell
Authority, Thread Group Foundation, Composable Chat Surfaces, Thread Worksurface
Continuity, and Move Chat to Side Chat. Shell connection authority is separate
from the Thread Group domain. Schema and public group behavior stay together;
renderer composition and view-state worksurface persistence remain separated
because they have different owners and failure modes.

### CHAT-RD-002 — Provenance acceptance gates Thread Group work

- **Authority:** owner decision
- **Status:** propagated

SPEC-01 begins only after the Agent Tool Provenance implementation is explicitly
owner-accepted. An approved planning candidate or partially implemented worktree
does not satisfy the gate.

### CHAT-RD-003 — Accepted tab infrastructure gates renderer completion

- **Authority:** owner decision
- **Status:** propagated

SPEC-02 begins only after both SPEC-01 and the Generic Component Tab Host are
independently accepted. SPEC-03 and SPEC-04 follow SPEC-02. Chat does not absorb
generic empty-tab, launcher, or component-host behavior.

### CHAT-RD-004 — Keep identity domains separate

- **Authority:** owner decision plus source-of-truth contract
- **Status:** propagated

`threadGroupId` identifies the visible body of work. `threadId` identifies one
chat session and remains the live-routing and Provenance identity. `turnId` and
`exchangeId` retain their current meanings. `surfaceId` is transient mounted UI
identity. `tabId`, `componentInstanceId`, and `sideChatPlacementId` are separate
placement identities. No identity is reconstructed from another one's string,
a title, folder name, panel selection, or current global chat.

### CHAT-RD-005 — Use Thread Group as canonical implementation vocabulary

- **Authority:** owner decision
- **Status:** propagated

The user-visible object remains a Thread. Internal schema and protocol fields
use Thread Group and `threadGroupId`. “Thread family” may explain the umbrella
concept but does not become a second schema or message namespace.

### CHAT-RD-006 — Main Chat and Side Chat are presentation terms

- **Authority:** owner decision
- **Status:** propagated

User-facing copy says Main Chat and Side Chat. Sessions are peer members of the
group and do not store mutable parent/child/sibling roles. Append-only primary
events record which member was presented as Main Chat.

### CHAT-RD-007 — Remove Fork before group activation

- **Authority:** owner decision
- **Status:** propagated

Fork/context cloning is removed from UI, public protocol, server services,
harness configuration, OpenCode arguments, tests, and active plans before the
group-backed public list activates. No alias or compatibility escape hatch may
create an ungrouped session.

### CHAT-RD-008 — Preserve current eager New Chat in this roadmap

- **Authority:** later explicit owner scope decision
- **Status:** propagated

This roadmap makes the existing `thread:open-assistant` create path atomically
create a one-member group while preserving its current eager behavior. The
separate Pending New Chat SPEC later replaces that behavior with a renderer-RAM
intent and provider-signal-gated commit. It is not embedded here.

This narrowly supersedes the earlier D-168 packaging rule for this roadmap. The
owner subsequently directed that this phase add nothing extra to thread
creation, preserve the harness's current project-root behavior, and isolate the
minimum chat work into three or four single-domain SPECs. It does not reject the
Pending New Chat product idea; it changes its release boundary.

### CHAT-RD-009 — Preserve Provenance under session identity

- **Authority:** owner decision plus accepted-prerequisite contract
- **Status:** propagated

Grouping, view navigation, Main/Side presentation, tab placement, and group
deletion never rewrite a recorded tool activity's workspace/thread/turn
authority. Thread or exchange deletion may clear the optional exchange detail
binding exactly as Provenance defines, but it may not cascade into agent
activities, resource edges, checkpoints, blobs, admitted facts, or ledger rows.

### CHAT-RD-010 — Persist only the content worksurface

- **Authority:** owner decision
- **Status:** propagated

The owning view capsule stores content-only state keyed by `threadGroupId`, such
as tabs, documents, locations, selections, and scroll positions. It does not
store transcript, chat runtime, drafts, thread-list visibility, or chat/shell
chrome. SQLite owns group structure but not a duplicate worksurface snapshot.
Serialized component-tab placement—including a Side Chat descriptor—is content
layout, not transcript/runtime state, and lives in a separately revised
service-managed lane so ordinary adapter saves cannot erase it.

### CHAT-RD-011 — Side Chat movement creates an empty new Main Chat

- **Authority:** owner decision
- **Status:** propagated

Move Chat to Side Chat keeps the old session unchanged, places it in a content
tab, and creates a cold, durable, empty Main Chat peer in the same group. It
copies only a server-validated portable model/variant selection. It copies no
transcript, prompt, exchange, provider session, summary, attachment, draft,
runtime, resume, or Fork state.

### CHAT-RD-012 — Call the placement identity `sideChatPlacementId`

- **Authority:** owner-directed schema clarification
- **Status:** propagated

The Move-specific durable placement key is `sideChatPlacementId`, not the bare
`projectionId`. This prevents collision with Agent Tool Provenance's renderer
delivery `projectionId`. Internal outbox implementation names may differ only if
the public/serialized meaning stays explicit.

## Reconciled Implementation Choices

### CHAT-RD-013 — Fill stable view IDs before group binding

- **Authority:** owner decision plus source-of-truth contract
- **Status:** propagated

Before group backfill, the central registry atomically assigns an opaque
`metadata.view-id` to every discovered capsule missing a valid ID. Existing
valid IDs are grandfathered. Invalid/duplicate/unwritable capsules stop with a
repair-required diagnostic; they never fall back to a mutable folder suffix.
Folder rename/reorder therefore preserves identity. This roadmap does not
relocate capsules or implement the future protected System tree. A retained
session with no exact registry-resolved binding becomes Legacy only after this
preflight succeeds; no active panel, title, or folder name is used to guess.

### CHAT-RD-014 — Do not require transitive UI purity

- **Authority:** implementation choice constrained by current code
- **Status:** propagated

`ChatSurface` is an explicit portable presentation boundary and the connected
host owns stores, WebSocket actions, and application services. This roadmap does
not force every existing leaf such as voice, attachments, reply chrome, or Todo
to become dependency-free. It does require every behavior to address the
explicit mounted `threadId`/`surfaceId` rather than a global current chat.

### CHAT-RD-015 — Gate authority-bearing thread commands at activation

- **Authority:** routed WebSocket standard plus owner security intent
- **Status:** propagated

Before Thread Groups become public, Fusion establishes a narrow server-verifiable
Fusion-shell connection role. Eager new-thread creation, group mutations, and
Move require that role in addition to server-derived workspace and validated
view/group/session ownership. Client payloads, content, model output, and harness
messages cannot grant it. This satisfies the active command-authority standard
without absorbing the future protected-System permission model or a general
remote-account authentication platform.

### CHAT-RD-016 — Historical group lookup after Delete is deferred

- **Authority:** scope choice
- **Status:** propagated

Deleted sessions retain their immutable Provenance facts under workspace and
`threadId`. This roadmap does not add permanent deleted-group membership solely
to browse those facts by a removed `threadGroupId`. Bounded deletion/action
tombstones exist only for recovery and retry.

### CHAT-RD-017 — Extract trusted shell authority before Thread Groups

- **Authority:** code standards plus single-domain roadmap scoping
- **Status:** proposed for owner approval in the refreshed candidate

The Electron secure-origin migration, centralized runtime endpoint, one-use
connection proof, privileged-route guard, and child-environment isolation form
one transport-security domain. They are extracted from Thread Group Foundation
into `SPEC-00-TRUSTED-FUSION-SHELL-AUTHORITY.md`.

SPEC-00 changes no Thread Group, component-tab, bridge, Provenance-event,
worksurface, or Side Chat behavior. Thread Group Foundation consumes its
accepted `trusted-shell` connection role instead of implementing a second
authentication path. This keeps each SPEC independently judgeable and prevents
the thread-group builder from also owning an Electron origin/transport rewrite.
