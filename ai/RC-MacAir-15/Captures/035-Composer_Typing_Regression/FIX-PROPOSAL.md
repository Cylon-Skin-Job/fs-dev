# Composer render isolation — proposed product change

Status: DEFERRED pending architectural assessment, per subsequent owner direction. The owner did not approve this bounded implementation approach. This is a bounded proposal from the direct investigation, not an approved SPEC or a completed implementation receipt.

## Problem and intended result

Typing a draft currently rerenders unchanged chat history. In the current view-bound shell it also rerenders the sibling content view. Keep the shared session draft and view-bound host, while preventing these unchanged subtrees from doing work on every character.

## Proposed scope

- `fusion-studio-client/src/components/MessageList.tsx`: React.memo using normal shallow prop equality, retaining live store subscriptions and every existing input prop.
- `fusion-studio-client/src/components/ContentArea.tsx`: React.memo using the existing panel prop, retaining its own and descendant store subscriptions.
- A meaningful regression test proving plain draft changes do not mutate unchanged transcript/content DOM, and that actual history, stream, finalization, metadata, and content updates still render.
- Update the investigation evidence with the final source fingerprint and results after the owner-approved implementation workflow.

The exact experimental diff is `EXPERIMENTAL-RENDER-BOUNDARIES.patch`. It is applied only in `/tmp/fs-composer-candidate`; the development source is untouched.

## Completed experimental verification

The two-boundary candidate builds and passes 10/10 existing rendered chat-surface isolation cases using a fixture-only config. A five-minute settled realistic run retained 9,520 typed characters with input p95 0.6 ms and no long tasks or WS traffic. A matched settled current-build control took 36.5 seconds for 68 characters with 136 long tasks and zero WS traffic. These results support the bounded proposal, while owner-window/OS-input verification remains outstanding.

## Required verification for implementation

1. Build the current development candidate.
2. Run the rendered chat-surface isolation cases for drafts, Send, interleaved live frames, Stop, readiness, models, attachment ownership, menus, and collapse/state continuity. Use a fixture-only config; do not boot the default server against a live DB.
3. Run the existing view-bound shell smoke in a new isolated profile.
4. Run the deterministic no-unrelated-render regression and confirm genuine store updates remain visible.
5. Repeat the realistic content + largest actual transcript typing measurement for five minutes, retaining wall time, exact draft text, input latency, rAF latency, long-task count, and incoming/outgoing message types.
6. Keep startup-loading results distinct from settled operation. A fast rAF number with slow wall time or long tasks is a failure.
7. Complete OS-input/owner verification and investigate any remaining stalls; do not equate synthetic-input success with resolution of the owner's hard freeze.

## Acceptance boundary

The investigation brief requires: “Product changes go through the established SPEC/orchestrator discipline; this investigation may proceed directly, but a fix that changes product behavior needs the owner's acceptance.” This proposal preserves the requested production host. Approval should authorize the bounded implementation through that discipline; it must not be inferred from silence or from acceptance of the diagnosis alone.

No commit/push or Alpha work is included. The confirmed earlier shared-draft regression and the recent owner-observed onset must remain distinguished in the completion report.
