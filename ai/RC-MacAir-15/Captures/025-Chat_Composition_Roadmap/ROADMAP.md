# Chat Composition Implementation Roadmap

**Roadmap status:** `DRAFT_CANDIDATE`  
**Prepared:** 2026-09-05
**Execution model:** sequential SPEC implementation and owner acceptance

## 1. Outcome

Deliver a composable, view-bound Fusion Studio chat system in five bounded
domains. First establish a trusted shell command boundary without changing chat
identity or UI behavior. Existing conversations then migrate without transcript loss. `threadId`
continues to own one chat session, live routing, turns, exchanges, runtime, and
Provenance. A new Thread Group owns the visible thread row, immutable view
binding, membership, primary history, title, and user-activity ordering.

The renderer then exposes explicitly addressed Main Chat surfaces and thread
rails, the owning view stores content-only continuity by Thread Group, and the
final SPEC uses the accepted component-tab host to move an unchanged chat into a
Side Chat tab while creating a fresh empty Main Chat.

## 2. Ordered SPECs

| Order | SPEC | Domain | Prerequisites |
|---:|---|---|---|
| 00 | `SPEC-00-TRUSTED-FUSION-SHELL-AUTHORITY.md` | Electron shell origin, runtime transport, connection authority, and privileged-route gate | integrated owner-accepted Agent Tool Provenance product baseline |
| 01 | `SPEC-01-THREAD-GROUP-FOUNDATION.md` | Thread Group persistence, lifecycle, migration, and public protocol | accepted SPEC-00; approved BRIDGE-01 and BRIDGE-02; owner-released accepted Tab Platform milestone |
| 02 | `SPEC-02-COMPOSABLE-CHAT-SURFACES.md` | Renderer chat/thread composition and identity isolation | accepted SPEC-01; independently accepted Generic Component Tab Host |
| 03 | `SPEC-03-THREAD-WORKSURFACE-CONTINUITY.md` | View-owned group-keyed content state and cross-store recovery | accepted SPEC-02 |
| 04 | `SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md` | One multi-member group transition and Side Chat tab placement | accepted SPEC-03 |

## 3. Dependency Graph

```text
Agent Tool Provenance implementation
   owner accepted and integrated
              |
              v
SPEC-00 Trusted Fusion Shell Authority
              |
              v
BRIDGE-01 + BRIDGE-02 approved
accepted Tab Platform milestone released
              |
              v
SPEC-01 Thread Group Foundation
              |
              +-------------------------------+
                                              |
Generic Component Tab Host                    |
independently accepted                        |
              |                               |
              +---------------+---------------+
                              v
SPEC-02 Composable Chat Surfaces
                              |
                              v
SPEC-03 Thread Worksurface Continuity
                              |
                              v
SPEC-04 Move Chat to Side Chat
```

The accepted Tab Platform exists before this roadmap dispatches. SPEC-00 does
not depend on tab or bridge behavior and must not edit either lane. SPEC-01
waits for the bridge contracts because Chat may not invent tab/provenance
context ad hoc; it still creates no tab placement or renderer chat surface.

## 4. Cross-SPEC Contracts

1. The visible user-facing Thread is a durable Thread Group. One chat session is
   a member identified by `threadId`.
2. Live chat output, Stop, transcript, usage, draft, model selection, exchanges,
   harness session, and tool Provenance remain session/turn addressed. Group and
   placement identities never route a live frame.
   Model/variant authority is the last server-acknowledged value for that exact
   `threadId`, never a panel-global or pending renderer choice.
3. Groups bind immutably to `{workspaceId, viewId}`. `viewId: null` means the
   workspace Legacy host and never means “use the active panel.”
4. Migration may reuse an existing `threadId` value as that session's initial
   `threadGroupId`, but the types remain non-interchangeable. Every new group and
   new session receives an independently minted opaque ID.
5. Primary is an append-only event history plus a transactional current-member
   cache. Sessions remain peers and acquire no mutable parent/sibling role.
6. Group MRU advances once for creation, once for each accepted user prompt,
   and once for each accepted Move Chat to Side Chat. Passive open, warming,
   provider completion, Stop, view navigation, Side Chat close, and member
   reopen do not reorder the rail.
7. `thread:action` is the only mutation family for group/session actions. Live
   prompt and Stop keep their existing dedicated routes.
8. Fork is absent before group-backed public activation and never returns in a
   later SPEC.
9. SQLite owns group structure. View state owns the content worksurface. A
   durable outbox coordinates cross-store cleanup/placement. The view-state
   service keeps adapter-owned content and service-managed placements in
   separate mutation lanes without duplicating the snapshot or rebuilding
   intentionally closed tabs from history.
10. `ChatSurface` receives explicit identity and callbacks. Connected hosts may
    use stores/services; the portable boundary may not discover a global current
    thread or current panel.
11. Main Chat and Side Chat are user-facing presentation terms. A Side Chat has
    no nested thread rail, but its shared list button can operate the outer
    view's rail.
12. Move never copies conversation context. Explicit Send to Chat is the future
    material-transfer mechanism and is outside this roadmap.
13. Provenance facts survive chat/group deletion according to the accepted
   Agent Tool Provenance retention contract.
14. A server-verified Fusion-shell connection role gates new-session creation
   and durable thread mutations. Payload fields, content, model output, and
   harness messages cannot grant that role.
15. A normal group/view switch completes only after the outgoing worksurface is
   acknowledged. Conflict, rejection, or timeout leaves it selected unless the
   user explicitly chooses a warned discard.
16. Shell authority is established once in SPEC-00 and consumed by later Chat
    routes. A workspace, view, tab, component, prompt, model, harness, raw
    localhost client, or request field can never assert that role.

## 5. Per-SPEC Acceptance

Every SPEC follows `GUIDANCE.md`:

1. verify exact external/internal accepted baseline;
2. use a fresh builder for each slice;
3. repair through the first clean builder-owned review;
4. independently inspect and repair through the first clean orchestrator-owned
   review;
5. run targeted, full-suite, build, restart, and applicable Electron checks;
6. report changed paths, warnings, deviations, downstream effects, and residuals;
7. receive supervisor review; and
8. obtain explicit owner acceptance before the next SPEC begins.

## 6. Roadmap Completion Gate

The roadmap is complete only when:

- all five SPECs are explicitly owner-accepted in order;
- the accepted Provenance deletion, prompt-authority, exchange-binding, and
  regression tests remain green;
- the accepted Generic Component Tab Host contract remains green and contains
  no chat-specific behavior;
- every retained chat is reachable through exactly one group or the explicitly
  bounded Legacy host;
- Main and Side Chats can operate concurrently without transcript, readiness,
  usage, model, draft, attachment, Stop, focus, or menu-state crossover;
- group switching and restart restore only content worksurface state;
- repeated Move produces one group with ordered peer sessions and an empty
  current Main Chat after each accepted action;
- closing a Side Chat removes placement only and restart does not resurrect it;
- old Fork and singleton Secondary Chat paths are absent; and
- final combined server tests, client build, targeted Playwright, restart
  readback, and Electron acceptance pass with warnings classified.

## 7. Downstream Work

After SPEC-01, Pending New Chat may be re-roadmapped against accepted
Provenance and the atomic group creation primitive. System View Capsule and
Collections work may also consume stable group/view identities through their
own dependencies. They do not need Move to Side Chat.

Auto Rename, Send to Chat expansion, plugins, project creation, transcript
export, view prompt inheritance, CWD overrides, protected-System permissions,
and automation authority remain separate roadmaps.

## 8. Parallel-Safe Work

Before implementation, read-only review and test-fixture design may proceed in
parallel. Product-code implementation is sequential within this roadmap.
External Provenance, Bridge, and Tab work retain their own owners; no chat
builder edits those lanes or assumes an unapproved shape.
