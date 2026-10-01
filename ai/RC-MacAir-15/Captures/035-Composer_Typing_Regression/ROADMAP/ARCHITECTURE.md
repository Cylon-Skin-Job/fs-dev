# Target ownership and update contracts

All new or changed implementation must satisfy these observable contracts. Exact module names are implementation choices; transferring full-manager objects or reassembling all subscriptions in one hook is not an acceptable extraction.

## Client owners

| Owner | Owns | Must not own |
| --- | --- | --- |
| Production shell composition | Select active view and mount explicit hosts/content siblings | Draft string, full transcript, token-by-token subscription, provider commands |
| View population controller | Scoped list/selection and group navigation commands | Composer text, live segments, global-current fallback |
| Session submission controller | Immutable send snapshot; exact attempt state machine; transport outcome/recovery; accepted snapshot cleanup | DOM refs, menu listeners, Markdown rendering, provider syntax |
| Composer connected leaf | Exact session draft/attachment projections and composition-local caret/autocomplete/resize | Full history or sibling content; deciding server acceptance |
| Completed-history presentation | Per-message immutable content/metadata projections and revision-bound formatting | Draft subscription, provider readiness, command lifecycle |
| Live-turn presentation | Exact thread/turn frontier and existing reveal/finalization handshake | Reformatting completed messages on every live token |
| Group/header actions | Exact group/session commands and acknowledged outcomes | Draft storage or transcript processing |
| Mount-local interaction layer | DOM refs, menu/focus behavior using shared menu module, scroll anchoring | Socket request listeners, persistence, command state machine |
| Existing chat action bridge | Explicit target captured at invocation and one registered command consumer; completion/error result | Fire-and-forget success, choosing a later global current chat |

A shared draft remains one workspace/session-owned string. The observation point moves to the composer leaf. Two mounts of the same session observe the same draft; other sessions, headers, history, rails and workspace content remain quiet. The submission controller reads a snapshot at command invocation; it does not subscribe a parent to every character. Pending/retry/accepted snapshots cannot overwrite newer draft edits.

The final shared session host accepts explicit workspaceId, nullable viewId where supported, threadGroupId, threadId and transient surfaceId. It has no Legacy mode, ambient-current fallback, hidden second production placement, or effect that installs global command listeners per mount. Renaming useLegacyChatHost is not completion: remove its bundled responsibilities and orphaned consumers.

## Update invariants

- ASCII typing performs zero network or canonical event-bus writes. Existing emoji-recents recording is a separate approved action, measured separately.
- A draft-only update causes zero completed-message formatting invocations, zero MessageList/history commit work, and zero sibling ContentArea/rail/header renders. Composer-local layout is permitted and measured.
- One thread's live frame updates only that thread's active-turn consumers. Completed message content is immutable by revision; metadata edits invalidate only relevant message presentation.
- Hidden panels do not repeat active-view list/open/warm commands. Multiple explicit mounts may each present the session, but command consumption is singular and identity-qualified.
- Store-to-render projection uses stable references. Cache keys include the real content/metadata revision; cache retention ends with the owning history/session lifetime. Do not use an unbounded global Markdown cache.
- Preserve existing scroll, selection, text copy, links, tool expansion, search/bookmarks and live completion behavior. Virtualization is not required: first satisfy these work boundaries; introduce it only if measured requirements cannot be met while preserving those behaviors.

## Server owners

| Owner | Responsibility |
| --- | --- |
| Existing WS domain routers | Authenticate, validate canonical request, capture workspace generation, delegate, deliver correlated results |
| Prompt submission service | Attempt admission/receipt and its durable outcome; no DOM or provider syntax |
| Runtime activation controller | Exact session warm/activation ownership using existing threadRuntimeManager and wire lifecycle |
| Turn/drain controller | Exact turn/drain admission, dispatch, Stop and terminal cleanup; no session/group CRUD or mirror generation |
| Session lifecycle service | Canonical session creation/deletion primitives and capacity policy via SessionManager; transaction-capable narrow API |
| Thread-group service | Group membership/primary/activity and exclusive mutation leases; delegates session primitives without cloning their rules |
| Mirror recovery service | Chatlog formatting/write/delete journals and idempotent recovery |
| Worksurface/placement recovery owners | Existing file-backed view-state services and outbox application; no copied SQLite worksurface snapshots |
| Repositories/migrations | SQL implementation with passed transaction handles; no event/renderer/provider behavior |
| ThreadManager facade | Workspace-qualified delegation to the above; no duplicated policies, transaction bodies, mirror formatting, or recovery loops |

Do not replace ThreadManager with several services that all receive the entire original manager and mutate its fields. Dependencies must be narrow and acyclic; lease acquisition and transaction lifetime stay with the command owner. The thread runtime manager remains the runtime-state authority; do not make a second runtime map when splitting orchestration.

## Submission state machine (AR-P01 recommended proposal)

Client attempt identity is `{workspaceId, threadId, requestId}`; requestId is unique per deliberate send, stable across status recovery. Snapshot text, attachment IDs and acknowledged portable model/variant once. Two identical texts sent deliberately are different requests. A duplicate delivery of one request is not another turn.

| State/event | Required behavior |
| --- | --- |
| No active target or transport rejects before enqueue | Report not sent, preserve editable draft, no acceptance spinner/receipt claim |
| Transport enqueue succeeds | One pending attempt owns the snapshot and 15-second timer; temporary acceptance-disabled controls preserve current behavior |
| Correlated acceptance | Apply user bubble once under server-issued turnId; clear only the matching submitted draft revision and attachment IDs; release pending gate |
| Correlated rejection | Preserve text/attachments, release pending gate, show actionable failure |
| Disconnect, timeout, or ambiguous enqueue | Show delivery status unknown/recovering; allow editing; do not allow resend of unresolved attempt; no automatic provider replay |
| Status recovery says accepted | Reconcile acceptance even if original ACK was lost; do not start another provider invocation |
| Recovery proves rejected/cancelled-before-acceptance | Release resend gate; user may deliberately send the current draft under a new requestId |
| Accepted turn fails before/after output | Preserve accepted identity; expose existing safe terminal error/partial-turn behavior. Do not relabel as never sent |
| Late response for old attempt/session/mount | Update only that exact attempt/owner; cannot clear a newer draft, attachment set, pending attempt, or another thread |
| Unmount/remount | Attempt survives in session-owned state; DOM listeners do not own its lifetime |

A 15-second UI timer is not proof of rejection. Recovery uses the existing thread:action family with a narrow authenticated session action, not a new message family or event-bus command route. `prompt` gains requestId; `message:sent` and acceptance errors echo it with thread/turn identity. Lockstep packaged client/server deployment is the target; there is no permanent uncorrelated fallback in the new production client.

## Durable receipt and failure semantics

SPEC-02 adds an owning platform migration for a submission receipt keyed by workspace/thread/requestId, including canonical request fingerprint, server turnId when assigned, server epoch/generation, bounded outcome/reason, and timestamps. Store the accepted snapshot needed to reconstruct an acknowledgement (same privacy/authorization as chat history); it is an acceptance journal, not an independently editable transcript or a second exchange writer. Exact SQL names/indexes are implementation choices. Accepted receipt transition and group-activity recording must share one transaction-capable owner, before ACK/provider dispatch. Do not pretend current ThreadManager.addMessage already durably stores accepted text.

Admission reserves a request before awaiting activation. Same key/different fingerprint is rejected. Same-key duplicate delivery/status never invokes the provider twice. Record dispatch claimed before invoking the external provider; recovery never replays that claim after crash. This guarantees no duplicate Fusion dispatch for a recovered request, not exactly-once execution inside an external provider.

A status response of absent is not proof of rejection: a delayed original request can still arrive. Recovery must serialize with admission for the same key and either return the existing receipt or create a cancellation tombstone that fences later admission. In-progress reserved work rechecks the fence after every await and before acceptance/dispatch. Server restart resolves old reserved attempts as cancelled/rejected before accepting new work; previously accepted/dispatch-claimed attempts remain accepted with an interrupted/unknown execution status and cannot auto-replay.

Receipt access is workspace/thread authorized through existing trusted-shell checks. No client-chosen table, ambient DB, payload logs, provider credentials, or authority bypass. Completed exchanges remain owned by existing canonical persistence. Receipt/exchange hydration must deduplicate by turn/request identity. Existing data is preserved; no backfill invents request identity for old exchanges. Receipts/tombstones are retained for their session lifetime in this program, including across process restart, and removed only through the owning authorized session cleanup. No time-expiry may make an old request executable again while its session exists.

## Structural acceptance

New/extracted production files stay at or below 400 physical lines and one responsibility, as the routed checklist requires. A longer existing cohesive module explicitly exempted by current standards (notably LiveSegmentRenderer) is not split mechanically. Any other genuinely necessary exception must identify the exact rule, cohesive responsibility, evidence and owner-approved deviation. Scope all changed controllers and their newly extracted dependencies; counting only the thin facade is insufficient. Source/import checks supplement, not replace, behavioral and render-work tests.
