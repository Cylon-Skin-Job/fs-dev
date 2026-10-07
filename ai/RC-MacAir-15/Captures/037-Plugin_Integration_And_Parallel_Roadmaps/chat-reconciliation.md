# Chat Work — Plugin Integration Reconciliation

**Capture:** cross-roadmap integration concept · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** dated evidence and planning implications; not certification of the running product
**Updated:** 2026-09-22 (PDT)
**Trickle-down:** newer chat supersedes conflicting plugin-folder assumptions · **Roll-up:** plugin dependency corrections

## Direct check-in and baseline

Read and contacted [Run roadmap supervisor](codex://threads/01a0c1c8-6e85-7f83-8d67-2cb5c1476007) at the owner's request. Its direct response confirmed the following snapshot. Canonical status remains the [CHAT-AR supervisor ledger](../035-Composer_Typing_Regression/ROADMAP/ROADMAP-LEDGER.md); consult it again before implementation.

Development checkout: `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Accepted changes are uncommitted and the checkout contains substantial concurrent work. An ordinary branch/worktree from HEAD would not include all accepted current behavior. Migration 045 is present. No claim is made that these bytes are published to main or installed in Alpha.

## What is accepted and what remains

| CHAT-AR SPEC | Supervisor-confirmed state | Effect on plugin planning |
|---|---|---|
| 01 — Evidence and isolation | Owner-accepted | Reuse authenticated isolated verification patterns and executable regression gates. |
| 02 — Submission and recovery | Owner-accepted | Session-owned attempts and durable receipts; exact request/workspace/thread/turn correlation; unknown/recovery UI; admission/restart fencing; no automatic provider replay. |
| 03 — Actions and lifetimes | Owner-accepted | One app-owned exact-target action consumer; result before success for File/Wiki/Office/diagnostic actions; correlated System New Chat; acknowledged group/header commands; mount-local interactions. |
| 04 — Rendering boundaries | Active, not accepted | Composer-local observation, completed-history/live-turn lifetimes, Working Activity repair, aggregate-host retirement and measured performance. 04A's R1 gate passed; repair/review is still active. |
| 05 — Backend ownership | Pending | Session lifecycle, group transactions, mirror recovery, activation and turn/drain services are assigned to CHAT-AR. Do not duplicate that extraction in the plugin program. |
| 06 — Integrated acceptance | Pending | Integrated tests, sustained input/native acceptance, compatibility retirement and source-of-truth reconciliation remain. |

The original composition roadmap under Capture 025 and the current CHAT-AR roadmap under Capture 035 have different SPEC numbering. The older “after CHAT-04” instruction is not a usable branch condition for current work.

## Contracts to preserve

- `threadGroupId` identifies the visible body/group; `threadId` identifies one session's history/runtime and Send/Stop target. Workspace and immutable view binding are explicit; `surfaceId` identifies only a transient UI mount.
- New production chat is view-bound and eager; historical null-view data remains readable and cleanable. Historical data compatibility does not authorize a hidden Legacy production host. Older Wiki language describing the transitional Legacy placement is scheduled for reconciliation.
- Chat actions capture their target at invocation and return a truthful result. Selection changes during an await cannot redirect them. Plugins cannot infer success from dispatching a UI event.
- Prompt attempts preserve exact receipts, acceptance/activity transaction ownership, deduplication, claim-before-dispatch and restart fencing. Unknown delivery permits editing but gates resend until authoritative recovery. The provider is not automatically replayed.
- The server owns acceptance, persistence, Stop, runtime authority, group eligibility and stream sequencing. `thread:action`, `prompt`, and trusted `thread:open-assistant` remain canonical routes; commands are not event-bus facts.
- Portable UI consumes explicit identities/presentation/callbacks. Connected consumers may use existing state/actions, but mounted views cannot install additional global command consumers or make parent shells observe every character/token.
- Trusted-shell authority does not automatically become plugin authority. Plugin grants require narrow Fusion-owned mediation for System/configuration, database, secrets, runtime and harness access.

## Reserved seams and integration conditions

The supervisor identified these moving areas: client `components/chat/**`, ChatArea/MessageList/InstantSegmentRenderer, App/PanelContent/ContentArea composition, chat draft/submission/attachment stores, `lib/chat-action*`, chat controllers and WS handlers; server `lib/thread/**`, `lib/thread-groups/**`, thread routing, receipt recovery/services and migration 045; chat architecture/Side Chat/Move/worksurface/Electron test fixtures; Chat Wiki and Capture 035 roadmap artifacts.

This capture grants no write lease over those areas. Detailed plugin plans should link to their accepted interfaces and revisit ownership at handoff. Supervisor advice: reconcile shared UI/registration work after SPEC-04 acceptance at minimum; use post-SPEC-06 acceptance and final integration review as the stable chat baseline. An explicitly approved earlier executable branch needs isolation and a mandatory later reconciliation gate.

The plugin management mockup also touches shared shell/panel registration, including server panel-path resolution. Calling it UI-only or assuming only two shared-file touches would understate integration work.

## Evidence and limits

Besides the direct supervisor handoff, inspected the ledger, CHAT-AR architecture/authority documents and SPEC-05/06 packets, Chat Wiki overview, and current `chat-action.ts`, `chatSubmissionStore.ts`, `chatSurfaceContract.ts`, and `chatSurfaceRegistrationContract.ts`. Current code confirms explicit action results, session-qualified attempts and descriptor identity validation. Pending host/backend outcomes are taken from the approved roadmap and supervisor, not claimed as already completed.

No product tests were rerun for this documentation task. Reported acceptance/performance results belong to the chat supervisor's evidence; this capture is not an independent runtime certification.
