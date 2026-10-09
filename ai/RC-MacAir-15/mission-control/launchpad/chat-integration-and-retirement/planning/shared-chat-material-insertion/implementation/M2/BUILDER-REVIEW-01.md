**REVIEW_COMPLETE — material finding. M2 is not CLEAN.**

Reviewer: `/root/m2_builder/builder_review_01`. Scope: builder-owned review of CHAT-MATERIAL-SPEC-01 M2 and immediate M1 dependencies. Read-only; no edits, builds, tests, delegation, or app/Git mutations performed.

1. **Material — direct Ask AI overwrites diagnostic source failure with composer failure.**
   - **Violated criterion:** SPEC §4.1(6) preserves source-specific failure presentation; M2 preserves diagnostic retrieval behavior while moving destination capture before retrieval.
   - **Exact evidence:** [ChatDiagnosticDetails.tsx:115](/Users/rccurtrightjr./.codex/worktrees/chat-material-01/fs-dev/fusion-studio-client/src/components/chat/ChatDiagnosticDetails.tsx:115) sets `unavailable` when retrieval returns null or formatting fails. Exceptions also become null. The lazy preparation then returns null; [useChatSessionActions.ts:248](/Users/rccurtrightjr./.codex/worktrees/chat-material-01/fs-dev/fusion-studio-client/src/components/chat/useChatSessionActions.ts:248) records source failure and returns false. [ChatDiagnosticDetails.tsx:159](/Users/rccurtrightjr./.codex/worktrees/chat-material-01/fs-dev/fusion-studio-client/src/components/chat/ChatDiagnosticDetails.tsx:159) consequently overwrites `unavailable` with `composer-unavailable`.
   - **Observable impact:** A healthy composer displays “Check the chat target and try again” for an unavailable or rejected diagnostic report. View, Copy, and Ask AI become enabled again because the disabled condition recognizes `unavailable`, not `composer-unavailable`. No draft mutation or report leak is evidenced.
   - **Reproduction:** In a valid mounted chat, click **Ask AI directly**, then deliver the exact diagnostic unavailable response, a malformed report rejected by validation, or a retrieval failure. The final state incorrectly reports composer failure. Clicking View first retains the correct unavailable state. This is a source-traced reproduction; I did not execute it.
   - **Bounded correction:** Preserve the unavailable state when lazy report preparation fails; retain composer-unavailable for destination/insertion failure. Renew the direct Ask AI failure assertions through the actual connected callback.

No other material finding emerged in this sweep.

Current candidate provenance checks passed: SPEC/TICKET match approval hashes; all sealed product hashes match current bytes; START preimages match; M2-slice.patch reconstructs exactly; unchanged M1 inputs remain unchanged. Final build and renderer receipts bind current changed bytes and unchanged recorded dependencies, and their log hashes match. The recorded results are build exit 0 and **163 renderer checks passed**. Existing diagnostic failure assertions exercise View, so they do not discharge the finding above.

The remaining M2 implementation satisfies the inspected ownership seams: synchronous source begin, one existing consumer/store path, irreversible lifetime rejection including genuine retained-DOM reuse, focus survival, latest-draft selection/append, admission and warm handling, and mic cancellation. Proposed deviations **M2-D01–D08** remain recorded proposals; this review grants no classification or scope approval.

Direct cameras, native PNG/save verification, final Wiki work, mandatory final server checks, whole-SPEC acceptance, and publication remain outside this M2 certification. Browser fixtures do not certify physical microphone or native capture behavior.

Terminal lifecycle: **REVIEW_COMPLETE / findings**. `close_agent` is unavailable. The builder owns persistence of this result and bounded repair routing.
