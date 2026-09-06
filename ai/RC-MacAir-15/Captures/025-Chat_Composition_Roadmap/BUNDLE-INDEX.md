# Chat Composition Roadmap Bundle Index

**Bundle status:** `DRAFT_CANDIDATE`  
**Prepared:** 2026-09-03  
**Owner:** Fusion Studio product owner  
**Execution:** sequential SPEC orchestration with explicit owner acceptance between SPECs

## 1. Outcome

This bundle turns Fusion Studio's current one-global-chat presentation into a
view-bound, explicitly addressed chat system that can later mount the same chat
surface in a content tab. It does so through four independently judged domains:

1. durable Thread Groups and their public application behavior;
2. composable renderer chat surfaces;
3. group-keyed content worksurface continuity; and
4. Move Chat to Side Chat.

The first domain waits for the owner-accepted Agent Tool Provenance
implementation. The renderer domains also wait for the independently accepted
Generic Component Tab Host implementation. Neither in-progress worktree is an
accepted prerequisite merely because code is present.

## 2. Normative Bundle Artifacts

| Order | Artifact | Purpose | Status |
|---:|---|---|---|
| 00 | `DECISIONS.md` | Owner decisions and reconciled bundle choices | draft |
| 00 | `ISSUES.md` | External gates, resolved conflicts, and deferrals | draft |
| 00 | `GUIDANCE.md` | Builder, reviewer, deviation, and acceptance lifecycle | draft |
| 00 | `ROADMAP.md` | Dependency order and roadmap completion contract | draft |
| 01 | `SPEC-01-THREAD-GROUP-FOUNDATION.md` | Thread Group persistence, migration, lifecycle, and public protocol | draft |
| 02 | `SPEC-02-COMPOSABLE-CHAT-SURFACES.md` | Explicit renderer chat and thread-rail composition | draft |
| 03 | `SPEC-03-THREAD-WORKSURFACE-CONTINUITY.md` | View-state ownership, switching, recovery, and deletion cleanup | draft |
| 04 | `SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md` | Multi-member transition and Side Chat component placement | draft |
| gate | `CLEAN-ROOM-REVIEW.md` | Review result for the exact current candidate | clean |
| gate | `RELEASE-MANIFEST.md` | Ordered hashes, candidate ID, deferrals, and approval record | awaiting owner approval |

## 3. Authority Order

1. Explicit owner direction in the conversation and `DECISIONS.md`.
2. The approved current candidate after owner approval.
3. Active Fusion Studio Code Standards and Chat System Wiki.
4. Owner-approved external prerequisite implementations and their acceptance
   reports.
5. Active code and tests as feasibility constraints, not product authority.
6. Source SPECs and Vision Roadmap records as requirements provenance.

## 4. Source Inputs

### Owner intent and prior contracts

- `../022-Vision_Roadmap/DECISIONS.md`
- `../022-Vision_Roadmap/THREADS_AND_VIEWS.md`
- `../022-Vision_Roadmap/THREAD_MANAGEMENT.md`
- `../002-SPECs/COMPOSABLE_THREADED_CHAT_SPEC.md`
- `../002-SPECs/MOVE_CHAT_TO_SIDE_CHAT_SPEC.md`
- `../002-SPECs/PENDING_CHAT_INTENT_SPEC.md`
- `../002-SPECs/GENERIC_COMPONENT_TAB_HOST_SPEC.md`
- `../002-SPECs/SYSTEM_VIEW_CAPSULE_FOUNDATION_SPEC.md`
- `../002-SPECs/VIEW_CONFIGURED_THREAD_COLLECTIONS_SPEC.md`

### External prerequisite candidate under implementation

- `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar/ai/RC-MacAir-15/Captures/024-Agent-Tool-Provenance/RELEASE-MANIFEST.md`
- `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar/ai/RC-MacAir-15/Captures/024-Agent-Tool-Provenance/IMPLEMENTATION-LEDGER.md`
- `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar/ai/RC-MacAir-15/Captures/024-Agent-Tool-Provenance/SPEC-01-AGENT-TOOL-PROVENANCE.md`

### Current architecture

- `../../../../AGENTS.md`
- `../../Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`
- current code under `fusion-studio-server/lib/thread/`,
  `fusion-studio-server/lib/ws/`, `fusion-studio-client/src/components/`,
  `fusion-studio-client/src/state/`, and `fusion-studio-client/src/lib/ws/`

## 5. Code Standards Routing

All SPECs use this exact hub:

- `../../Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`

| SPEC | Routed standards pages |
|---|---|
| 01 | Architecture Routing; WebSocket Protocol; Universal Event Bus; Harness Adapters; Persistence And Metadata; Testing And Smoke Slices |
| 02 | Architecture Routing; Frontend UI; State Management; WebSocket Protocol; Testing And Smoke Slices |
| 03 | Architecture Routing; State Management; WebSocket Protocol; Persistence And Metadata; Testing And Smoke Slices |
| 04 | Architecture Routing; Frontend UI; State Management; WebSocket Protocol; Universal Event Bus; Harness Adapters; Persistence And Metadata; Testing And Smoke Slices |

No bundle decision supersedes those standards. Where a source SPEC contained a
broader security, plugin, configuration, or Pending New Chat design, this bundle
defers it rather than silently weakening the applicable standard.

## 6. Dependency Map

```text
Owner-accepted Agent Tool Provenance
                 |
                 v
SPEC-01 Thread Group Foundation
                 |
                 +-------------------------------+
                                                 |
Independently accepted Generic Component Tab Host|
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

## 7. Explicit Deferrals

The following are not hidden inside this roadmap:

- Pending New Chat and provider-signal-gated commit;
- thread Collections/folder-or-tag configuration;
- System/View capsule relocation and protected-root enforcement after SPEC-01's
  narrow stable-ID preflight;
- Send to Parent Chat, Send to New Side Chat, and Send to New Thread;
- Auto-Rename Chat Threads;
- transcript export destinations;
- project/folder/template creation and CWD overrides;
- plugins, dynamic component registration, trust, permissions, and installation;
- protected-System permissions and general remote-account authentication beyond
  SPEC-01's narrow Fusion-shell command gate; and
- permanent deleted-group browsing of historical Provenance.

Each deferral remains independently specifiable. None is required to prove the
four outcomes in this bundle.
