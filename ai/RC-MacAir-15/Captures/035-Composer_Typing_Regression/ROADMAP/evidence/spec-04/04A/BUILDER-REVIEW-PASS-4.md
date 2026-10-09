# SPEC-04 Slice 04A Builder Review — Focus Repair Pass 4

- Reviewer: `/root/spec04_slice04a/review_04a_focus_pass4`
- Role: fresh read-only `clean-room-reviewer`
- Candidate: 23/23 hashes verified; manifest digest `2b6208a648ee63c0e876512182b87b61437bc8b3d9fd25fc5630f85db43f6594`
- Terminal disposition: **CLEAN**
- Lifecycle: terminal completion confirmed by reviewer final result. `close_agent` is unavailable in this runtime, so no closure call could be attempted; this is lifecycle evidence only.

## Material findings

None.

## Verified

- Bounded retry-to-focus and structured `R1_FOCUS_UNAVAILABLE`; deterministic success, unavailable, and lost-focus tests pass.
- Only the isolated staged application and exact `fusion-shell://app/` BrowserWindow are targeted.
- Each measurement establishes focus, rechecks it immediately before `keyboard.type`, records establishment/before/after evidence, and rejects focus loss.
- The wall limit remains exactly `68 × 25 × 1.5`; it was not inflated or waived.
- Locked-host run `chat-arch-1790136116775-c09e77fb49` stopped before timing with exact focus-unavailable evidence and clean owned cleanup.
- Correctness run `chat-arch-1790136157276-44fa4c0199` passed helper/authenticity 5/5 and input/locality 2/2.
- Focused R1 `chat-arch-1790133916558-82b5890715` remains valid for unchanged product bytes and passed all ten windows under the unchanged wall threshold.
- Earlier coverage, exact-selector/locality, outbound-frame, original composer-local observation, duplicate-mount, input-semantics, snapshot, and SPEC-02/03 contracts remain sound.
- Final focus-related source contains no System Events, CUA, owner-window automation, live-profile access, product hook, or product behavior change.

## Deviations and advisory

- D-04A-1/D-04A-2 and R-04A-1 through R-04A-4: proposed accepted bounded mechanical integration, compatibility, and test-oracle work.
- D-04A-3: no criterion deviation; legacy host retirement remains 04C.
- Advisory: the locked host prevented a current successful real-window focus branch. The branch is deterministically covered, and prior focused performance evidence remains valid for unchanged product bytes. A future focused-host rerun would strengthen provenance but is not a material 04A blocker.

Final disposition: **CLEAN**.
