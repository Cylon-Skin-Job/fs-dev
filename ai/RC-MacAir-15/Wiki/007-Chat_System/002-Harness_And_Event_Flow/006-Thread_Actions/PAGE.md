---
name: Chat Thread Actions
description: Canonical path for user-initiated visible-thread and chat-session actions.
metadata:
  incoming-edges:
    - Chat Harness And Event Flow
    - Architecture Routing
    - WebSocket Protocol Standards
    - Harness Adapter Standards
  outgoing-edges:
    - Chat WebSocket Protocol
    - Harness Boundary
    - Universal Event Bus
  source-files:
    - fusion-studio-client/src/components/chat/
    - fusion-studio-server/lib/ws/thread-ws-handlers.js
    - fusion-studio-server/lib/harness/
  connected-skills: []
  related-trigger-files: []
---

Thread actions are user-initiated operations on a visible thread group or one
underlying chat session. They are not ordinary prompt text and they are not
provider-native protocol.

New Chat, assistant activation/resume, every durable `thread:action` mutation,
Warm, and prompt-triggered runtime activation are admitted only for a
live server-private `trusted-shell` connection. This transport guard does not
trust request fields or event/provenance metadata and does not replace the
normal workspace/thread ownership checks. Legacy Fork/context cloning is
unavailable for trusted and untrusted clients and is not part of the action
taxonomy. Public creation configuration is closed to portable `model` and
`variant` selection; stored Fork-era provider state is inert at runtime
activation.

Implemented actions:

- `rename` — group scope, title only;
- `delete` — group scope, runtime-safe and Provenance-safe;
- `copy_link` — group scope, versioned application URI with durable identities only;
- `resolve_link` — group or exact current-member target, opens Main Chat, Legacy-safe;
- `view_markdown` — exact member, validated ThreadManager mirror path;
- `set_harness_selection` — exact member, portable `{model, variant}` only;
- `move_chat_to_side` — SPEC-04;
- `compact` — exact session.

The obsolete `thread:touch` MRU bump was removed end to end: group `updated_at`
is the sole visible-list MRU owner and is advanced only by creation and accepted
prompts.

## Canonical Message

Thread actions enter the backend through a canonical product message. Durable
actions carry a caller-minted `requestId`; group actions carry
`threadGroupId` and may carry the exact `threadId` as member context.

```json
{
  "type": "thread:action",
  "action": "rename",
  "requestId": "...",
  "threadGroupId": "...",
  "threadId": "...",
  "name": "New title"
}
```

Use canonical Fusion Studio action names. Do not name messages after provider
flags or command syntax. The superseded public `thread:rename` and
`thread:delete` routes were removed with no aliases; Rename/Delete are reachable
only through `thread:action`.

## Ownership

Frontend:

- renders the action in the correct scope
- disables only for generic UI/runtime conditions
- sends canonical action intent

Backend thread action handler:

- resolves workspace, view, thread group, session membership, runtime state,
  and harness only when the action needs one
- validates that the action is currently allowed
- routes Fusion-owned group actions to the thread-group domain service
- delegates only provider-backed session actions to the harness adapter
- persists Fusion-owned state through normal managers
- returns `thread:action:completed` or `thread:action:error` with the echoed
  `requestId`, `action`, and authoritative identities
- fans committed state out to every window in the workspace

## Idempotency And Delete Recovery

- Each durable action is keyed by `{workspaceId, requestId}`. Same
  request/same canonical input replays the stored result; different input under
  the same `requestId` returns `request_mismatch`. Envelopes, results, and
  fan-out carry durable identities only and never `surfaceId`.
- The canonical target/payload hash covers the action plus the supplied group
  and member identities and, for `rename`, the title, so reuse with different
  input cannot silently produce a different effect.
- `delete` takes one group mutation lease, checks every member, and returns a
  non-mutating `group_busy` while a member runtime is accepting, active
  (in-flight), finalizing, stopping, or draining. A merely warm idle provider is
  not busy; Delete fences and retires it.
- Delete records mirror deletion and a group-scoped cleanup tombstone before
  canonical rows vanish, deletes session/group/member/exchange state in one
  transaction, and retries mirror cleanup after commit and across restart.
  Provenance facts are retained; only the optional exchange binding clears.
- While the bounded tombstone holds, a Delete with a new `requestId` resolves
  the retained aggregate (not `not_found`, not a rerun), resumes idempotent
  repair, and records the aggregate under the new `requestId` so replay survives
  tombstone expiry. Past expiry an unseen request receives ordinary
  `not_found`.

Harness adapter:

- translates canonical action into provider syntax
- preserves provider session identity
- reports unsupported actions clearly

## Action Semantics

| Action | Product scope | OpenCode translation |
|---|---|---|
| `rename` | Change the group title only; never rewrites session/provider identity, historical Provenance, or the visible-list MRU clock | none; Fusion-owned |
| `delete` | Fence every member runtime, retain Provenance facts, delete group/member/session/exchange state, and recover mirror cleanup through a bounded tombstone | none; Fusion-owned |
| `copy_link` | Return the version-1 `fusion-thread-group:` application URI for the group with the validated sole/current member | none; Fusion-owned |
| `resolve_link` | Validate the URI/ids, resolve the authoritative group + current primary, and open Main Chat; Legacy resolves to the null-view host | none; Fusion-owned |
| `view_markdown` | Return the validated exact-member `Data/Chatlogs/threads/<threadId>.md` mirror path through ThreadManager | none; Fusion-owned |
| `set_harness_selection` | Validate `{model, variant}` against current server policy, persist by `threadId`, and fan out the acknowledged value; harness binding stays server-owned | none; Fusion-owned |
| `move_chat_to_side` | Move the current primary session into a content tab and create a cold, empty primary peer in the same visible thread | none; Fusion-owned |
| `compact` | Compact provider context for future turns; visible Fusion history remains | `opencode run --session <id> --command compact` |

Group actions carry `threadGroupId`. Session actions carry `threadId` and may
also carry `threadGroupId` when membership must be checked. Live chat output
continues to route by `threadId`.

## Events

Thread actions are commands. They are not UEB events.

After an action changes durable state or session state, the backend may emit a
post-commit fact such as `thread:primary_changed` or `thread:compacted` for
subscribers. Fact publication never gates the action response or fan-out.

## Forbidden Bypasses

- frontend harness-specific checks such as `harnessId === "opencode"`
- one-off `thread-group:*` or `thread:compact` handlers when `thread:action` fits
- provider CLI flags in frontend code
- direct DB mutation that skips thread managers or metadata paths
- treating compact as a per-reply action
- routing `move_chat_to_side` through a harness adapter

## Required Tests

- frontend action sends canonical `thread:action`
- backend routes action through the thread action handler
- Fusion-owned actions use the group service and never invoke a harness
- provider-backed actions reach the adapter and emit provider args
- unsupported harness/action returns visible canonical error
- restart/hydration behavior is covered when durable state changes
- multi-window clients receive the same committed primary transition

## Related Pages

- [Chat Harness And Event Flow](../PAGE.md)
- [Chat WebSocket Protocol](../004-WebSocket_Protocol/PAGE.md)
- [Harness Boundary](../001-Harness_Boundary/PAGE.md)
- [Universal Event Bus](../003-Universal_Event_Bus/PAGE.md)
- [Architecture Routing](../../../005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md)
- [Harness Adapter Standards](../../../005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md)
