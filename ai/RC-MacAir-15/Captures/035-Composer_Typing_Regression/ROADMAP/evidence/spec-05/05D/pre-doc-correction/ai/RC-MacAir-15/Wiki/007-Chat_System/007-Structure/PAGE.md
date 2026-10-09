---
name: Chat Structure
description: File and module map for chat system work. Use this page to find the server, client, harness, WebSocket, renderer, and state modules involved in chat.
metadata:
  last-modified: "2026-09-19T10:34:31Z"
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Identity And Persistence
    - Chat Harness And Event Flow
    - Chat Rendering And Lifecycle
    - Chat UI
  source-files:
    - fusion-studio-server/lib/wire/terminal-saved-delivery.js
    - fusion-studio-server/lib/wire/wire-broadcaster.js
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-client/src/lib/ws/thread-markdown.ts
    - fusion-studio-client/src/lib/ws/thread-history.ts
    - fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx
    - fusion-studio-server/lib/thread/thread-crud.js
    - fusion-studio-server/lib/thread/thread-open-handler.js
    - fusion-studio-server/lib/ws/thread-provider-binding.js
    - fusion-studio-server/lib/ws/thread-action-handler.js
    - fusion-studio-server/lib/thread-groups/mirror-repository.js
    - fusion-studio-server/lib/thread-groups/projection-outbox-repository.js
    - fusion-studio-server/lib/thread-groups/action-result-repository.js
    - fusion-studio-server/lib/thread-groups/startup-reconciliation.js
    - fusion-studio-server/lib/thread/session-metadata.js
    - fusion-studio-server/lib/thread/ThreadManager.js
    - fusion-studio-server/lib/harness/types.js
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-client/src/components/ChatArea.css
    - fusion-studio-client/src/state/chatFileLinkStore.ts
    - fusion-studio-client/src/state/slices/chatSlice.ts
    - fusion-studio-client/src/components/ChatArea.tsx
    - fusion-studio-client/src/hooks/useFloatingWindow.ts
    - fusion-studio-client/src/components/email/EmailComposeWindow.tsx
    - fusion-studio-client/src/components/email/EmailComposeLayer.tsx
  connected-skills: []
  related-trigger-files: []
---

Current file/module map for chat work. Directory and wildcard rows below identify module families; `source-files` metadata contains concrete code files only.

## Composition History

The group foundation was committed and accepted September 13 (`5f46d1a`). Composable surfaces were accepted September 13 and committed September 14 (`5073b10`). Worksurfaces were accepted September 14; Side Chat tabs and Secondary Chat retirement were accepted September 15 and committed with worksurfaces in `554bedf` that day. This history was documented September 19 from Git and acceptance records; it makes no installed-build or current runtime claim. See the [Changelog](../000-Overview_and_References/004-Changelog/PAGE.md) for the transition and later owner direction.

## Backend ownership update — September 24, 2026

CHAT-AR SPEC-05 preserves public thread identities, eager New Chat, passive open,
server acceptance and Stop. `ThreadManager` is a workspace-qualified facade;
its policies now have explicit owners:

| Owner | Responsibility |
|---|---|
| `session-lifecycle.js` / `session-repository.js` | Session creation/deletion primitives, capacity, exact provider activation/retirement and runtime fencing; SQL uses the caller's transaction |
| `session-metadata.js` / `ThreadIndex.js` | Session metadata mutations/queries; no raw index create/delete bypass |
| `thread-groups/session-transactions.js` | Initial group/singleton-delete transactions and session admission under the shared group mutation lease |
| `thread-groups/delete-transaction.js` | Whole-group transaction after busy checks and exact member fences; mirror intent, tombstone, session deletion and worksurface outbox commit together |
| `thread-groups/startup-reconciliation.js` | Stable-view preflight, ungrouped-session attachment and retry of pending file projections |
| `chatlog-mirror.js` / `mirror-journal.js` | Disposable Markdown projection and durable revision-conditional recovery intent; not a second exchange writer |
| `runtime-activation.js` / `runtime-session-activation.js` | Exact captured runtime/session activation ownership |
| `runtime-prompt-admission.js` / `runtime-dispatch.js` / `runtime-stop.js` | Interactive admission, accepted iterator/drain and Stop orchestration |
| `prompt-submission-service.js` / repository | Receipt admission/recovery; accepted receipt and group activity share a transaction before ACK/dispatch |
| `thread-runtime-manager.js` | Sole canonical runtime map and compare-current runtime-object/key/drain-revision checks |
| `automation-runtime-activation.js` / `automation-turn-context.js` / `automation-drain.js` | Headless use of the same runtime/drain authority, without fabricated client receipts |
| `ws/thread-action-handler.js` / `thread-action-protocol.js` | Existing authenticated action dispatch and canonical response serialization |
| `ws/thread-provider-binding.js` | Exact eager provider binding and readiness, exported by the existing WS facade for prompt reuse |

Dependency direction is transport → command/lifecycle owners → repositories or
canonical runtime APIs. Group operations receive named session capabilities,
not a whole ThreadManager. `SessionManager` retains provider sessions and idle
timers; `provider-termination.js` performs bounded process termination and owns
no runtime map. Action-result/tombstone, mirror-journal and projection-outbox SQL
have separate repositories behind the existing group repository API. Existing
file-backed placement/worksurface consumers remain the only view-state writers;
SQLite contains retry instructions, never copied worksurface snapshots.

Admission holds the same group mutation lease as Move/Delete and rechecks the
session after waiting. Interactive and automation prompts reserve IN_FLIGHT
before releasing admission; nested lease acquisition is avoided. Delete checks
all runtime generations, fences each member before SQL deletion, and cannot be
undone by late provider/status callbacks. Completed orphan drains clear unless
failed provider retirement still requires a genuine STOPPING fence.

No migration is added by SPEC-05. Migration 045 from SPEC-02 owns session-lifetime
submission receipts/tombstones; authorized deletion cascades their owning session.
`HistoryFile` remains the exchange writer and invalidates mirror intent in the
same transaction as the exchange. A stale export cannot acknowledge a newer
revision. File failures remain pending for activation/retry after storage recovers.
A failed canonical exchange save emits no saved ACK; the exact partial RAM
snapshot is retained, without promising durability across process loss.

The isolated validation inventory and fault/readback matrix are under
`Captures/035-Composer_Typing_Regression/ROADMAP/evidence/spec-05/05D/`.
Full server tests use real staged provider source and their declared mocks;
GUI checks use a deterministic provider adapter behind real Electron auth,
production routes, SQLite and files. This update does not certify SPEC-06
performance, soak, native-input or owner symptom acceptance, or an Alpha build.

## Server

| File | Role |
|---|---|
| `fusion-studio-server/lib/thread/thread-crud.js` | `thread:open`, `thread:open-assistant`, create/open policy, group-joined search |
| `fusion-studio-server/lib/thread/thread-runtime-controller.js` | public facade delegating activation/admission/dispatch/Stop to focused owners |
| `fusion-studio-server/lib/thread-groups/service.js` | Thread Group domain: listing/open resolution, activity/MRU, canonical `thread:action` actions; delegates Move and member access to focused modules |
| `fusion-studio-server/lib/thread-groups/move-service.js` | `move_chat_to_side` transaction and server-owned Move session-policy resolution |
| `fusion-studio-server/lib/thread-groups/member-service.js` | `thread:members` ordered read and idempotent `open_member_in_side` |
| `fusion-studio-server/lib/thread-groups/placement-delivery.js` | placement outbox consumer and member-placement coordinator |
| `fusion-studio-server/lib/thread-groups/chat-capable-views.js` | Code-owned chat-capable view set that gates Move and member access before commit |
| `fusion-studio-server/lib/thread-groups/ids.js` | Opaque id minting (thread id, group id, `sideChatPlacementId`) |
| `fusion-studio-server/lib/db/migrations/044_thread_group_placement_outbox.js` | Durable `open-side-chat-tab` placement outbox |
| `fusion-studio-server/lib/thread-groups/repository.js` | structural queries and activity/MRU transaction; single-sourced action/recovery/outbox repository exports |
| `fusion-studio-server/lib/thread-groups/action-identity.js` | canonical action target hashing and durable `ChatActionContext` sanitization |
| `fusion-studio-server/lib/thread-groups/application-link.js` | versioned group application URI build/parse with durable identities only |
| `fusion-studio-server/lib/thread-groups/group-mutation-lease.js` | per-group exclusive mutation serialization |
| `fusion-studio-server/lib/view-state/thread-worksurface.js` | group-keyed worksurface entry reads/writes, CAS, lane merge, and exact-entry removal |
| `fusion-studio-server/lib/thread-groups/worksurface-cleanup.js` | durable delete-cleanup outbox consumer that removes only the exact worksurface entry |
| `fusion-studio-server/lib/thread/thread-runtime-manager.js` | runtime state and live turn ownership |
| `fusion-studio-server/lib/thread/thread-lifecycle-controller.js` | exact workspace/thread/turn lifecycle state and idle timers |
| `fusion-studio-server/lib/thread/live-turn-snapshot.js` | in-memory live turn snapshot |
| `fusion-studio-server/lib/thread/canonical-drain-context.js` | immutable accepted route data and exact non-serializable drain control |
| `fusion-studio-server/lib/thread/turn-terminal-error.js` | fixed safe terminal-error catalog and validator |
| `fusion-studio-server/lib/thread/harness-diagnostic-service.js` | bounded dedicated diagnostic persistence, cleanup, and exact-owner retrieval |
| `fusion-studio-server/lib/thread/thread-runtime-automation.js` | background automation prompt hooks |
| `fusion-studio-server/lib/thread/ThreadIndex.js` | SQLite thread metadata |
| `fusion-studio-server/lib/thread/HistoryFile.js` | SQLite exchange read/write |
| `fusion-studio-server/lib/thread/ChatFile.js` | markdown compatibility and link/view workflows |
| `fusion-studio-server/lib/chat-metadata/exchange-metadata-registry.js` | collector registration and merge behavior |
| `fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js` | turn-end metadata aggregation |
| `fusion-studio-server/lib/chat-metadata/collectors/attachments.js` | send-to-chat attachment metadata |
| `fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js` | repo-validated file mention metadata |
| `fusion-studio-server/lib/chat-metadata/collectors/file-mutations.js` | turn-correlated file mutation metadata |
| `fusion-studio-server/lib/cli-config/*` | `cli.json` harness policy and display metadata |
| `fusion-studio-server/lib/harness/types.js` | canonical harness event field contract |
| `fusion-studio-server/lib/harness/opencode/*` | OpenCode JSON run harness and translator |
| `fusion-studio-server/lib/harness/opencode/json-event-translator.js` | OpenCode-native event/status normalization |
| `fusion-studio-server/lib/wire/canonical-harness-event-bridge.js` | canonical harness event bridge |
| `fusion-studio-server/lib/wire/canonical-chat-event-applier.js` | chat mutation, event bus, live snapshot, persistence handoff |
| `fusion-studio-server/lib/wire/wire-broadcaster.js` | event bus to WebSocket routing |
| `fusion-studio-server/lib/ws/workspace-broadcaster.js` | exact-bound workspace and thread-lifecycle fan-out |
| `fusion-studio-server/lib/event-bus.js` | legacy bus plus bounded exact-turn asynchronous-effect drain |
| `fusion-studio-server/lib/ws/client-message-router.js` | client message dispatch |
| `fusion-studio-server/lib/ws/thread-ws-handlers.js` | thread websocket handlers |
| `fusion-studio-server/lib/ws/chat-turn-diagnostic-handlers.js` | explicit diagnostic request route and fixed unavailable response |
| `fusion-studio-server/lib/shell-bootstrap.js` | bounded one-read inherited launch-master bootstrap owner |
| `fusion-studio-server/lib/ws/shell-auth.js` | per-connection challenge, HMAC verification, and private role owner |
| `fusion-studio-server/lib/ws/shell-auth-dispatch.js` | authentication-before-initialization transport boundary |
| `fusion-studio-server/lib/ws/deferred-product-connection.js` | proof-gated product graph construction and exactly-once close cleanup |
| `fusion-studio-server/lib/ws/product-session-registry.js` | post-initialization product-recipient publication boundary |
| `fusion-studio-server/lib/ws/server-runtime-activation.js` | startup-complete barrier before per-connection product initialization |
| `fusion-studio-server/lib/ws/transport-connection-registry.js` | all-upgraded-socket lifecycle and shutdown owner, separate from product recipients |
| `fusion-studio-server/lib/ws/redaction-map.js` | recursive authentication-field and diagnostic-ingress suppression |
| `fusion-studio-server/lib/ws/privileged-thread-guard.js` | private live-role admission for current privileged thread routes and unconditional Fork denial |
| `fusion-studio-server/lib/harness/child-environment.js` | closed common plus adapter-specific environment policy for every harness/CLI child |
| `fusion-studio-server/lib/thread/thread-harness-config-policy.js` | portable public selection validation and stored Fork-state runtime sanitization |

## Client

| File | Role |
|---|---|
| `fusion-studio-client/electron/runtime-descriptor.cjs` | immutable launch-generation endpoint descriptor |
| `fusion-studio-client/electron/shell-protocol.cjs` | exact `fusion-shell://app` asset and CSP owner |
| `fusion-studio-client/electron/shell-navigation-policy.cjs` | main/subframe/popup shell-origin boundary |
| `fusion-studio-client/electron/runtime-ipc.cjs` | current-main-frame-only descriptor IPC |
| `fusion-studio-client/electron/shell-launch-authority.cjs` | per-launch master, generation, and one-use proof signer |
| `fusion-studio-client/electron/shell-proof-ipc.cjs` | guarded current-main-frame signing IPC |
| `fusion-studio-client/src/lib/runtime-transport.ts` | validated renderer endpoint, socket, HTTP/resource, and generation-cancellation owner |
| `fusion-studio-client/src/lib/shell-auth-client.ts` | transient renderer challenge/proof handshake and pre-auth initialization buffer |
| `fusion-studio-client/src/components/chat/sideChatBridge.ts` | code-owned Side Chat bridge: composes managed placements into the ordered view rail and owns close-disposition wiring |
| `fusion-studio-client/src/components/chat/useSideChatRailAdapter.ts` | single composition seam above the view adapter lookup: native adapters keep their tab owner, adapterless chat-capable views get a runtime-only root while a Side Chat is open |
| `fusion-studio-client/src/types/threadGroupMember.ts` | portable `thread:members` projection contract (durable identities only) |
| `fusion-studio-client/src/components/chat/ChatSurface.tsx` | portable composable chat presentation boundary: explicit `ChatMountIdentity` + session model + action contract; imports no store/socket/controller/service |
| `fusion-studio-client/src/components/chat/chatSurfaceContract.ts` | `ChatMountIdentity`, `ChatSurfaceModel`, `ChatSurfaceActions`, and transient `surfaceId` minting (never persisted/sent) |
| `fusion-studio-client/src/components/chat/useChatSurfaceIdentity.ts` | mount-time `surfaceId` minting for a connected host (runtime mount generation) |
| `fusion-studio-client/src/components/chat/LegacyChatHost.tsx` | connected explicit Main Chat host for non-shell mounts (`host: 'legacy-main'`/`'main'`); the production shell chat is the view-bound host since the 2026-09-19 owner flip |
| `fusion-studio-client/src/components/chat/useLegacyChatHost.ts` | connected host hook: per-thread session reads, exact-target action adaptation, exact-session model pending/acknowledged correlation, surface-owned pending-new-thread connecting state, and an optional component-backed `surfaceId` override |
| `fusion-studio-client/src/components/chat/ThreadRail.tsx` | portable rail presentation: explicit population + selected group + row/menu callbacks, including the member submenu and exact-member Copy Link entry; imports no store/socket/controller/service |
| `fusion-studio-client/src/components/chat/ThreadedChat.tsx` | one explicit `ThreadRail` + selected group's Main Chat `ChatSurface` composition |
| `fusion-studio-client/src/components/chat/useViewChatHost.ts` | connected host for one explicit `{workspaceId, viewId}` population: qualified list/open, correlated requests, selected group → `ChatSurface` session; mounted once per panel by `App.tsx` as the production shell composition |
| `fusion-studio-client/src/components/chat/ViewChatHost.tsx` | connected view-bound `ThreadedChat` host consumed by the production `ViewWorksurfaceDock` (group selection) and by rendered fixtures |
| `fusion-studio-client/src/components/chat/ViewWorksurfaceDock.tsx` | collapsed production group-selection dock mounted by each participating built-in view |
| `fusion-studio-client/src/components/chat/WorksurfaceConflictBanner.tsx` | non-destructive conflict projection with Retry saving / Switch without saving |
| `fusion-studio-client/src/lib/worksurface/types.ts` | versioned adapter contract, entry envelope, and registered `state:worksurface_*` frames |
| `fusion-studio-client/src/lib/worksurface/registry.ts` | explicit code-owned adapter registry (`worksurfaceAdapterForView`) |
| `fusion-studio-client/src/lib/worksurface/builtins.ts` | first-party adapter registration (`file-viewer`, `wiki-viewer`, `capture-viewer`, `office-viewer`, `email-viewer`) |
| `fusion-studio-client/src/lib/worksurface/worksurfaceController.ts` | stable public facade for the acknowledgement-gated group switch, cutover, conflict, and reconnect state machine |
| `fusion-studio-client/src/lib/worksurface/worksurfaceRuntime.ts` | shared request tracking, per-view serialization slots, and timeout seam |
| `fusion-studio-client/src/lib/worksurface/worksurfaceRequests.ts` | capture stamping and registered get/put emission |
| `fusion-studio-client/src/lib/worksurface/worksurfaceSwitch.ts` | selection, binding, flush, and deferred-intent execution |
| `fusion-studio-client/src/lib/worksurface/worksurfaceFrames.ts` | result/error/changed handling, retry/discard, and reconnect reconciliation |
| `fusion-studio-client/src/lib/worksurface/worksurfaceFailures.ts` | conflict classification and non-destructive failure retention |
| `fusion-studio-client/src/lib/worksurface/fileViewerWorksurfaceAdapter.ts` | File Viewer adapter (`activity` tabs/active/recents/navigation) |
| `fusion-studio-client/src/lib/worksurface/wikiViewerWorksurfaceAdapter.ts` | Wiki Viewer adapter (`activity.navigation`) |
| `fusion-studio-client/src/lib/worksurface/captureViewerWorksurfaceAdapter.ts` | Capture Viewer adapter (mode, selections, scrolls, classic tabs, activity) |
| `fusion-studio-client/src/lib/worksurface/officeViewerWorksurfaceAdapter.ts` | Office Viewer adapter (mode, folder, selection, side panel, activity) |
| `fusion-studio-client/src/lib/worksurface/emailViewerWorksurfaceAdapter.ts` | Email Viewer adapter (mode, folder, selection, side panel, activity) |
| `fusion-studio-client/src/components/office/officeViewerPersistence.ts` | Office Viewer single persistence entry point (group-bound content vs display keys) |
| `fusion-studio-client/src/components/email/emailViewerPersistence.ts` | Email Viewer single persistence entry point (group-bound content vs display keys) |
| `fusion-studio-client/src/components/chat/chatComponentRegistration.tsx` | code-owned first-party `fusion.chat-surface` registration through the accepted Generic Host resolver seam; adds no production tab/launcher/placement |
| `fusion-studio-client/src/components/chat/chatSurfaceRegistrationContract.ts` | dependency-free descriptor-input contract: durable identities only, strict parse that rejects `surfaceId`/unknown/authority fields, and the component-backed `surfaceId` mint |
| `fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx` | connected `fusion.chat-surface` mount: hydrated workspace/view/group/member tuple validation, inert unavailable body, then the explicit-identity `ChatSurface` mount |
| `fusion-studio-client/src/state/slices/chatSurfaceSlice.ts` | per-`threadId` usage/readiness/harness-selection state, composite `{workspaceId, viewId}` group populations/selection, and per-request `thread:open` correlation |
| `fusion-studio-client/src/components/chat/ChatLinkAttachments.tsx` | pending send-to-chat attachment pills |
| `fusion-studio-client/src/lib/chat/reply-text.ts` | shared `extractAssistantReplyText` payload for assistant prose |
| `fusion-studio-client/src/lib/chat/reply-chrome-actions.ts` | reply, saved-exchange Chat ID and note clipboard actions |
| `fusion-studio-client/src/components/chat/useAssistantReplyChromeController.ts` | per-reply action and metadata orchestration |
| `fusion-studio-client/src/components/ChatInput.tsx` | textarea, send key handling, filename autocomplete acceptance |
| `fusion-studio-client/src/components/ChatArea.css` | chat layout plus autocomplete ghost overlay geometry |
| `fusion-studio-client/src/hooks/useFileAutocomplete.ts` | filename autocomplete hook |
| `fusion-studio-client/src/components/chat/ChatAreaHeader.tsx` | compact header actions |
| `fusion-studio-client/src/components/Sidebar.tsx` | production rail column: renders the connected view-bound rail projection for this panel's own view population (owner direction 2026-09-19) |
| `fusion-studio-client/src/components/ChatArea.tsx` | production chat column: renders the connected view-bound Main Chat projection for this panel's own view population (owner direction 2026-09-19) |
| `fusion-studio-client/src/components/CliPickerDropdown.tsx` | multi-harness picker when policy enables 2+ harnesses |
| `fusion-studio-client/src/components/LiveSegmentRenderer.tsx` | sequential live reveal |
| `fusion-studio-client/src/components/chat/WorkingActivity.tsx` | transient elapsed Working presentation and stable accessibility status |
| `fusion-studio-client/src/components/chat/ChatTurnError.tsx` | one safe turn-terminal error row |
| `fusion-studio-client/src/components/chat/ChatDiagnosticDetails.tsx` | explicit View/Copy/Ask AI diagnostic controls |
| `fusion-studio-client/src/components/InstantSegmentRenderer.tsx` | completed history render |
| `fusion-studio-client/src/components/ToolCallBlock.tsx` | shared tool shell |
| `fusion-studio-client/src/lib/ws/thread-handlers.ts` | thread list/open/hydration handlers plus acknowledged `thread:action` results (link/Markdown) |
| `fusion-studio-client/src/lib/ws/threadGroupRows.ts` | group projection → row mapping and canonical `thread:action` intent builders |
| `fusion-studio-client/src/lib/ws/stream-handlers.ts` | live stream event routing |
| `fusion-studio-client/src/lib/ws/activity-stream-handler.ts` | seen-ledger/revision-gated Working transitions and snapshot restoration |
| `fusion-studio-client/src/lib/ws/frontier.ts` | per-thread/turn snapshot/live stream frontier |
| `fusion-studio-client/src/lib/ws/chat-diagnostic-handlers.ts` | explicit diagnostic request registry and exact-route response validation |
| `fusion-studio-client/src/lib/chat-action.ts` | client-side chat action event payloads |
| `fusion-studio-client/src/lib/chat-file-links/*` | attachment labels, filtering, and autocomplete matching |
| `fusion-studio-client/src/state/chatFileLinkStore.ts` | RAM-only pending attachments and autocomplete candidates |
| `fusion-studio-client/src/state/chatComposerDraftStore.ts` | workspace/thread-owned composer drafts |
| `fusion-studio-client/src/lib/ws/assistant-parts.ts` | assistant part reconstruction |
| `fusion-studio-client/src/lib/ws/tool-result-helpers.ts` | live tool result normalization for frontend segments |
| `fusion-studio-client/src/state/slices/chatSlice.ts` | keyed chat state and finalization |
| `fusion-studio-client/src/config/harness.ts` | client harness metadata and fallback policy |
| `fusion-studio-client/src/lib/tool-renderers/` | per-tool presentation |
| `fusion-studio-client/src/lib/tool-renderers/shell.ts` | shell command/output/status dropdown presentation |
| `fusion-studio-client/src/lib/catalog-visual.ts` | tool chrome icon/color/error visual definitions |
| `fusion-studio-client/src/components/ToolsPanel.css` | shared tool block and shell output/status styling |
| `fusion-studio-client/src/lib/reveal/` | reveal engine |
| `fusion-studio-client/src/lib/text/` | markdown/text rendering |
| `fusion-studio-client/src/lib/timing.ts` | timing profile defaults |

`fusion-studio-server/lib/startup-loopback.js` validates the exact listener
host/port boundary. `fusion-studio-server/lib/http/shell-cors.js` is the sole
HTTP CORS grant for the shell origin. Connection authentication is separate
from both, and no authentication owner publishes a fact.

## Current Host And Window Boundaries

`ChatArea.tsx` still mounts the normal workspace Legacy host. Production View Threads docks are mounted by CaptureTiles, FileExplorer, WikiExplorer, OfficeGrid and EmailGrid at the paths in the [Chat UI host map](../004-Chat_UI/PAGE.md#current-production-hosts-and-move-eligibility). `ChatSurfaceComponentMount` renders Side Chat as one `ChatSurface`, without `ThreadedChat` or a nested rail. The server capability set includes additional adapterless views, which does not give them a visible dock.

The retired Secondary Chat shell is recoverable from the parent of Git commit `554bedf`, including its header, minimized button, state slice and tracker. It was an in-app overlay with chat-specific state. Active `useFloatingWindow.ts` supplies shared drag/resize mechanics to `EmailComposeWindow.tsx`; `EmailComposeLayer.tsx` and the compose store supply the email minimize/restore example. These are reusable mechanics and an example, not an existing generic non-chat window container. Future content types, persistence, placement ownership, native OS windows, sticky-right behavior and animation remain undecided; see [Windowed Content](../004-Chat_UI/PAGE.md#windowed-content-is-separate-from-side-chat).

## Removed Paths

- legacy singleton/floating Secondary Chat: `SecondaryChat.tsx`,
  `SecondaryHeader.tsx`, `SecondaryDockButton.tsx`, `state/slices/secondarySlice.ts`,
  `lib/secondary-tracker.ts`, the secondary `ChatArea` override, its
  `rightSecondary`/`popup`/`secondaryThreadId` view-state fields, resize handle,
  and its dedicated tests/styles. No compatibility alias remains.
- visible typing cursor
- `CURSOR_HTML`
- `injectCursor`
- `.rv-typing-cursor`
- `showCursor`
- inactive `lib/segment-renderers/`
- static chunk strategy layer
- frontend pressure gauge / instant reveal branch
- Kimi wire runtime path

### Terminal delivery and provider exit ownership (SPEC05D integration)

Stop waits for the existing bounded event-effect barrier for its exact
workspace/root/epoch/thread/turn before removing the provider route. This keeps
`chat-turn:saved` deliverable after the interrupted exchange commits. A three
second effect timeout retains STOPPING; a failed save never invents an ACK.
The session's active Stop-finalization token and existing close promise prevent
its provider-exit observer from starting competing retirement. Observed exits
are retained on that exact session; releasing the token schedules at most one
reconciliation if the session still exists. Reconciliation rechecks the exact
session after queued work and drain retirement. Metadata suspension completes
before provider admission is released; late cleanup cannot cool a replacement.

### Restored component history (SPEC05D integration)

A validated restored chat component issues `thread:open` with its explicit
`threadGroupId`, exact `threadId`, a request ID, and `historyOnly: true`.
`thread-open-handler.js` consumes captured read/metadata capabilities and reads
the resolved member, rather than substituting the group's current Main Chat.
The server echoes `historyOnly` and leaves connection selection/provider ownership
alone. `thread-history.ts` hydrates that session's history/live snapshot without
changing selected groups or consuming pending Main Chat opens. It is a read,
not assistant activation. `thread-handlers.ts` remains the message dispatcher;
`thread-markdown.ts` only opens the acknowledged mirror in File Viewer.

The bounded affected-owner graph is enforced by `backend-owner-contract.mjs`.
Unchanged dependencies outside its inventory (including the thread barrel,
registry, and worksurface cleanup) are external boundaries; this check does not
claim a complete repository dependency graph.

`wire/terminal-saved-delivery.js` owns a bounded transport-only late saved-ACK fallback after Stop's3s effect grace. It shares event-local successful-delivery receipts with the normal broadcaster, so only one real saved frame is sent. It holds no provider or canonical runtime state;30s expiry requires history/reconnect recovery for any later save. The existing event-effect wait accepts cancellation for listener/timer cleanup.
