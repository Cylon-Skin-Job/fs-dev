# Tabs, Provenance, and Chat Coordination

**Created:** 2026-09-03  
**Status:** active nonnormative coordination  
**Scope:** dependency, interface, and blocker tracking across the Tabs, Provenance, and Chat implementation lanes

This folder is a coordination surface. It does not supersede an approved SPEC, release manifest, implementation report, Code Standard, Chat Wiki article, or owner decision. A note here can identify a required change, but it cannot silently amend another lane's contract.

## Files and writers

| File | Writer | Purpose |
|---|---|---|
| [DEPENDENCY-LEDGER.md](DEPENDENCY-LEDGER.md) | coordination owner | Current dependency graph, gates, status, and evidence paths. |
| [INTERFACE-CONTRACT.md](INTERFACE-CONTRACT.md) | coordination owner after lane reconciliation | Shared identities, ownership boundaries, and join contracts. |
| [OWNER-DECISIONS.md](OWNER-DECISIONS.md) | owner-facing coordination thread | Accepted directions and unresolved owner choices. |
| [TABS-HANDOFF.md](TABS-HANDOFF.md) | Tabs worker | Tabs exports, requirements, findings, and blockers. |
| [PROVENANCE-HANDOFF.md](PROVENANCE-HANDOFF.md) | Provenance worker | Provenance exports, requirements, findings, and blockers. |
| [CHAT-HANDOFF.md](CHAT-HANDOFF.md) | Chat worker | Chat exports, requirements, findings, and blockers. |

Workers read every file but edit only their lane handoff. This avoids simultaneous edits to one shared document and permits the coordination owner to reconcile conflicting claims before changing the shared contract or dependency ledger.

## Update protocol

1. A lane records a finding in its handoff with a stable lane-prefixed ID.
2. The finding names the exact contract, dependency, affected SPEC/view, blocking effect, and evidence path.
3. The coordination owner classifies it as `no_cross_lane_change`, `contract_update`, `dependency_update`, `owner_ruling`, or `repair_required`.
4. Only accepted reconciliations enter `INTERFACE-CONTRACT.md` or `DEPENDENCY-LEDGER.md`.
5. Any normative change is made in the owning SPEC or authority document and follows that artifact's review/approval process.

Different Git worktrees do not synchronize this folder automatically. Workers operating elsewhere must use this folder's absolute path or return their findings for transcription:

`/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-COORDINATION/`

## Scope rule

- Tabs owns containers, component presentation, placement, and worksurface tab state.
- Provenance owns observed actions/facts, resource edges, snapshots, event admission, ledger/query surfaces, and future registration/permission authority.
- Chat owns thread groups, sessions, chat runtime, `ChatSurface`, Pending New Chat, and group-keyed content continuity.
- A bridge SPEC owns only the agreed context passed between those domains.
- Each product view is adopted through its own later SPEC; no foundation worker converts views opportunistically.

