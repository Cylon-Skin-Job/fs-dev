# Chat Lane Handoff

**Writer:** Chat worker  
**Status:** owner-blocked on Tabs, Provenance, and their reconciled bridge contract

## Lane ownership

Chat owns visible thread groups, underlying chat sessions, the server-owned message lifecycle, `ChatSurface`, Pending New Chat, group actions, membership, chat runtime, and group-keyed content continuity. It does not own generic tab creation, empty launchers, component trust/permissions, or provenance inference.

## Current exported contract

- [Composable Threaded Chat](../COMPOSABLE_THREADED_CHAT_SPEC.md) currently separates `threadGroupId`, `threadId`, and `surfaceId`, creates a portable `ChatSurface`, and registers one first-party `fusion.chat-surface`-equivalent component without production tab placement. Its existing dependency header predates owner decision TPC-D08 and must be reconciled before dispatch.
- [Pending New Chat](../PENDING_CHAT_INTENT_SPEC.md) executes inside Composable Chat after its group commit primitive; it is not an independent prerequisite.
- [Move Chat to Side Chat](../MOVE_CHAT_TO_SIDE_CHAT_SPEC.md) depends on accepted Generic Host and Composable Chat. It adds the second member and durable placement projection.
- [View-Configured Thread Collections](../VIEW_CONFIGURED_THREAD_COLLECTIONS_SPEC.md) depends on Composable Chat and the [System View Capsule Foundation](../SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md), but not Move Chat to Side Chat.
- Chat live routing stays keyed by `threadId`; `threadGroupId` owns visible-thread/worksurface identity; `surfaceId` distinguishes concurrent mounts.
- Group-keyed worksurface state lives in the owning view capsule. SQLite does not duplicate the tab snapshot.

## Required incoming contracts

- From Tabs: accepted generic component host and later direct committed-descriptor placement for Side Chat.
- From Provenance: accepted foundation behavior plus the approved component/tab action-context bridge.
- From coordination: an approved Chat/Tab/Provenance integration contract and a reconciled, re-reviewed Chat execution packet.
- From the view control plane: stable view registry/path authority before configured thread collections.

## Seeded findings

| ID | Finding | Classification | Affected package | Evidence |
|---|---|---|---|---|
| CHAT-H01 | Composable Chat is owner-blocked on accepted Generic Host, accepted Agent Tool Provenance, and BRIDGE-01/BRIDGE-02. Its current header lists only the older Tabs dependency and therefore cannot authorize dispatch unchanged. | `dependency_update` | CHAT-01 | TPC-D08; Composable Chat header and D-168 |
| CHAT-H02 | `ChatSurface` is portable and may be mounted in different hosts, but its session still routes by `threadId`; placement cannot redefine chat identity. | `contract_update` | BRIDGE-02, CHAT-02 | Composable Chat B4–B10 |
| CHAT-H03 | One component descriptor omits transient `surfaceId`; the connected resolver derives it from `componentInstanceId` plus mount generation. | `contract_update` | BRIDGE-02 | Composable Chat section 2.3 |
| CHAT-H04 | Move Chat is the first specified production Side Chat placement and bypasses empty launchers. | `no_cross_lane_change` | CHAT-02 | Move Chat B8, B19 |
| CHAT-H05 | View Collections can proceed after Composable Chat and System View Capsule Foundation without waiting for Move Chat. | `dependency_update` | CHAT-03 | D-168, D-169, Collections header |
| CHAT-H06 | Provenance must not record one mounted `surfaceId` as durable membership or delete chat history when its tab closes. | `contract_update` | BRIDGE-02 | Chat identity and close-placement contracts |
| CHAT-H07 | Because Chat has not started, its action envelopes, component registration, group projection, and worksurface fan-out can conform to the accepted bridge instead of requiring a compatibility adapter afterward. | `contract_update` | BRIDGE-02, CHAT-01 | TPC-D08 |

## Worker update template

| ID | Date | Current revision/report | Export or discovery | Cross-lane need | Blocking? | Evidence path |
|---|---|---|---|---|---|---|
