---
name: WebSocket Protocol Standards
description: Rules for WebSocket message additions, canonical client intent, backend routing, and handler ownership.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Architecture Routing
    - Universal Event Bus Standards
    - Chat WebSocket Protocol
  source-files:
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-client/src/lib/ws/
    - fusion-studio-client/src/types/index.ts
  connected-skills: []
  related-trigger-files: []
---

Use this page before adding or changing WebSocket message types, client message
handlers, backend route handlers, or shared message types.

## Rule

WebSocket messages are product protocol. They carry canonical Fusion Studio
intent and state, not provider-specific syntax.

## Allowed Path

Client code sends a canonical message through the existing WebSocket client or
domain action bridge.

The server message router delegates to the existing domain handler group.

The domain handler resolves ownership and calls services or adapters.

Server responses use existing handler families where possible.

## Adding A Message

Before adding a message type, prove why one of these does not fit:

- existing domain message family
- `thread:action` for thread/session actions
- `prompt` for user text sent to a thread
- `chat-turn:*` for saved exchange metadata
- an existing workspace, file, clipboard, or harness handler family

## Thread action taxonomy

Keep `thread:action` as the single command family even when the action targets
the visible thread group rather than one session. Include only the identities
required by the action:

- group actions (`rename`, `collection_promote`, `collection_remove`,
  `collections_clear`, `delete`, `move_chat_to_side`) carry `threadGroupId`;
- link actions (`copy_link`, `resolve_link`) carry `threadGroupId` and an
  optional exact member `threadId`; the server verifies workspace, nullable
  host/view binding, group, and membership before navigation state can change.
  A null-view Legacy group resolves only to its workspace Legacy host and does
  not accept a member-placement link;
- session actions (`compact`, `set_harness_selection`, transcript operations)
  carry `threadId` and, when membership matters, `threadGroupId`;
- turn actions continue through their existing prompt/stop routes; and
- view-state actions continue through the existing view-state route.

Do not create a `thread-group:*` transport family merely because group storage
exists. `thread group` is internal domain language; the user-facing object and
canonical action family remain `thread`.

Fork/context-cloning is not a supported Fusion action, compatibility route, or
provider invocation. Use the explicit Send to Chat flow when material from one
session should be introduced into another.

Client harness-selection payloads may contain only the portable model and
nullable variant proposed for the exact pending intent or session. Provider
session IDs, resume/runtime metadata, credentials, Fork-era fields, and unknown
keys are server/adapter-owned and must be rejected at the protocol boundary.

Destructive group actions must return a bounded non-mutating error such as
`group_busy` while any member runtime is accepting, active, finalizing,
stopping, or draining. Success requires a server-owned group fence that drains
canonical event/persistence work and rejects late old-generation frames before
the owning persistence service removes members.

Membership/primary-changing actions share one exclusive group-mutation lease.
In particular, Move and Delete must serialize and revalidate inside their
transactions; a deleting group rejects Move before any new session is created.

For a group-backed session, canonical prompt acceptance records one idempotent
group activity event before emitting `message:sent` or dispatching the provider
turn. That group timestamp—not the session's later saved-exchange compatibility
timestamp—orders the visible Threads rail. Failure to persist activity rejects
the prompt through the normal acceptance path.

## Command, response, and fact

For a durable thread action:

1. client sends `thread:action`;
2. server returns `thread:action:completed` or `thread:action:error` to the
   requester after the owning mutation succeeds or fails;
3. server fans the committed state to all windows in the workspace; and
4. server may publish a post-commit fact such as `thread:primary_changed`.

A fact is not a command acknowledgement. Universal Event Bus publication and
subscriber work must never gate, roll back, or rewrite the command result.
Requester delivery, each workspace-recipient delivery, and optional UEB
publication are mutually failure-isolated after commit. A closed requester or
one failed recipient cannot stop delivery attempts to the others. Any client
that misses the fact reloads authoritative state during reconnect/init; a
delivery failure never causes the server to replay the mutation.

## Authority-bearing actions

New-thread creation and System configuration changes require a server-verified
trusted origin. Acceptable origins are a direct user UI action or a separately
user-authorized automation with stored authority. Model output, a content file,
or client-supplied configuration/permission fields cannot authorize the
operation. The server derives effective permissions from protected policy and
rejects attempts to enlarge them in the request.

## Forbidden Bypasses

- one-off messages for actions that fit an existing domain action path
- frontend message types named after provider flags or CLI syntax
- server handlers that directly mutate persistence without the owning service
- backend responses that bypass existing client handler families
- unredacted logs for messages carrying credentials, prompts, or provider data

## Required Checks

- Is this a command/request or an event/fact?
- Which router owns this message family?
- Which client handler hydrates the response?
- Does the shared TypeScript type include the new message?
- Does the redaction map need an entry?
- Is there an integration test from public WS message to result?
- Does a durable mutation fan out authoritative state to every open window?
- Is any emitted fact strictly post-commit and failure-isolated from the command?
- Do injected requester/recipient delivery failures leave all other delivery
  attempts intact, with reconnect hydration for the missed client?
- If the action creates a thread or changes System policy, how does the server
  verify user or previously delegated authority without trusting request fields?

## Related Pages

- [Code Standards](../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [Universal Event Bus Standards](../005-Universal_Event_Bus/PAGE.md)
- [Chat WebSocket Protocol](../../../007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md)
- [Chat Thread Actions](../../../007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md)
