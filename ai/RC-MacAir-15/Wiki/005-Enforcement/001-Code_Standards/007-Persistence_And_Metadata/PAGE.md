---
name: Persistence And Metadata Standards
description: Rules for SQLite writes, migrations, thread managers, metadata, file mirrors, and durable state updates.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Architecture Routing
    - State Management Standards
  source-files:
    - fusion-studio-server/lib/db.js
    - fusion-studio-server/lib/thread/
    - fusion-studio-server/lib/chat-metadata/
  connected-skills: []
  related-trigger-files: []
---

Use this page before changing SQLite tables, migrations, thread metadata,
exchange metadata, workspace state, or file-backed mirrors.

## Rule

Use the owning manager or service for durable state. Direct database writes are
allowed only when the caller also preserves every mirror, metadata contract, and
event expectation owned by the normal path.

## Persistence Owners

- migrations own schema changes
- thread managers own thread metadata and chat file mirrors
- canonical chat turn persistence owns exchange rows
- metadata services own saved exchange metadata patches
- workspace services own workspace registry and state cache writes
- a thread-group domain service owns visible-thread membership, primary-role
  history, and group-level mutations while preserving normal thread-manager
  mirrors for every session it creates
- view-state services own group-keyed content worksurfaces in each view
  capsule's `state/state.json`

## Durable identity boundaries

- A view capsule's immutable identity is `metadata.view-id` in `manifest.md`,
  qualified by `workspaceId`. The target capsule root is
  `ai/<machine>/System/Views/`. Folder name, numeric prefix, ordering, and
  display name may change without changing that identity.
- A visible thread group owns membership, ordering, title, archive state, view
  binding, and current-primary history in SQLite.
- An underlying `threads` row owns one chat session and its transcript/runtime
  identity. Creating one must use `ThreadManager` or a transaction-capable
  primitive owned by `ThreadManager`, including the Markdown mirror and
  session-limit policy. Another domain service must not copy those invariants.
- The owning view capsule stores content worksurfaces. Do not duplicate those
  snapshots in the thread-group tables.

## View definition versus content root

The capsule is control-plane configuration; `content.json` declares the
separate content root. A content root may live under `ai/<machine>/`, at
workspace root, or at another supported location. Moving or ignoring the
capsule does not move, ignore, or rewrite its content. All consumers resolve
both through the owning view registry instead of concatenating physical paths.

## Protected System target boundary

System is intended to be readable but not directly writable by agents.
OpenCode is the first explicitly named protected harness; the same rule applies
to later harnesses. New code must keep every System mutation behind a narrow
Fusion-owned service and must not expose that service as generic file access to
a harness. Configuration and permission changes require a trusted,
user-mediated UI path. Automatic application state writes may use dedicated
state services, but they do not confer configuration or filesystem mutation
authority.

Purpose-built GUI editors and direct user JSON editing operate on one canonical,
versioned schema and validated write service. Portable configuration may carry
declarations and stable component references. Clone/import must mint new
instance identity and exclude secrets, consent/grants, sessions, thread history,
and local runtime/view state; requested capabilities require fresh consent.

Filesystem placement alone is not enforcement. The future protected-root work
must cover direct writes, rename/move/delete, links, traversal, alternate file
APIs, and any agent-callable proxy. Until that threat model lands, documentation
must not claim that the current tree is already tamper-proof.

## Cross-store recovery

When one user action changes both SQLite thread structure and file-backed view
state, the SQLite transition includes a durable projection-outbox instruction,
not a duplicate view-state snapshot. The view-state write follows through its
normal service and acknowledges that instruction. If it fails, the command
reports the committed structure and marks view-state repair required; it does
not roll back by hand or leave an ambiguous primary.

Recovery retries only unapplied outbox instructions with an idempotency key. Do
not reconstruct every historical placement from membership/history: doing so
would resurrect tabs the user intentionally closed. A crash between applying
view state and acknowledging the outbox is safe because replay focuses or
preserves the existing tab rather than duplicating it.

## Forbidden Bypasses

- writing `fusion.db` by hand
- inserting thread rows without preserving file-backed chat mirrors
- editing exchange metadata without the saved-turn metadata path
- changing schema without a migration
- updating canonical state from a renderer or component
- treating an in-memory mutation as durable before persistence succeeds
- duplicating view-local worksurface state in SQLite
- creating an underlying chat session through a raw insert that skips the
  thread manager's Markdown mirror or session-limit policy
- letting a harness mutate System through a generic file API or an
  agent-callable proxy to a privileged UI/service route

## Required Checks

- Which manager normally writes this data?
- Does this write require a migration?
- Are there filesystem mirrors or cache files paired with the DB row?
- Does a WebSocket or UEB notification need to follow the write?
- What happens if persistence fails after an external provider action succeeds?
- Does hydration still read the new state after app restart?
- If a paired view-state write fails after the SQLite commit, is recovery
  deterministic and idempotent?

## Related Pages

- [Code Standards](../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [State Management Standards](../003-State_Management/PAGE.md)
- [Chat User Metadata](../../../007-Chat_System/001-Identity_And_Persistence/005-User_Metadata/PAGE.md)
- [Chat Runtime Model](../../../007-Chat_System/006-Runtime_Model/PAGE.md)
