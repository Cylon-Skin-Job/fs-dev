---
name: Chat Wiki Reconciliation Spec Review
description: Primary audit and independent clean-room review record for the documentation specification, not execution acceptance of the wiki repair.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Specification Review

## Scope and authority

User requested a multi-part spec to reconcile Chat wiki inconsistencies one issue at a time, then an independent clean-room loop over that spec. The latest correction retains only the right-hand list button in Side Chat tabs, removing the intended left-hand thread-panel toggle/slider. Future right-button behavior remains undefined. This is document review, not automated SPEC implementation.

Artifact: `SPEC.md` in this directory, with preparation inventory `BASELINE.json`. Direct integration artifacts: the three September 19 wiki edits in Chat Decisions, Changelog, and Chat UI. Historical snapshots preserve both the initial clarification and the later corrected button distinction. Product files are untouched by this task.

## Primary audit

- Reconstructed the documentation-only scope and the latest owner direction; divided execution into Part 0 baseline and Parts 1–7 for terminology, ordering, links, request examples, UI transition, pointers/history, and consistency/handoff.
- Checked immediate source behavior for group ordering, exact-member link resolution, public request normalization/dispatch boundaries, the two distinct header controls, and surviving floating-window mechanics. Future execution must recheck its current baseline and may not treat preparation observations as full runtime verification.
- Preparation inventory: 38 active Chat pages plus the directly related View Activity article, with SHA-256 values and dirty-worktree context in `BASELINE.json`.
- `gray-matter` frontmatter parsing: 4/4 passed for SPEC and the three locally updated wiki pages using the installed client dependency. Initial attempt at a server-local gray-matter path failed because that package is client-owned; corrected the lookup without installing dependencies.
- Scoped `git diff --check` on Chat wiki: passed. New specification inspected separately because ordinary diff omits untracked files.
- Provisional assessment: no material issue identified in the plan; all wiki execution remains deferred. This is the primary audit seed, not independent acceptance.

## Review lifecycle

Default authorized budget: up to three completed fresh reviewer passes; no extensions. Stop after the first materially clean pass. Reviewers are read-only, inherit the invoking model/effort, and receive no parent history or earlier review conclusions. Persisted model/effort fields will be recorded if the runtime supplies them. No close-agent tool is available; record closure as unavailable after terminal results.

### Pass 1

- Reviewer: `/root/chat_wiki_spec_review_1`, fresh `clean-room-reviewer`, `fork_turns=none`; model/effort inherited, persisted fields not exposed by the runtime.
- Reviewed SPEC SHA-256: `9af7e35519042d2634c63157ed948d6f5ac7f3d12f5370b78df02208c2e2db60`.
- Terminal result: NOT CLEAN, one P2 material finding. Closure: unavailable (no close-agent capability).
- Finding: Part 3 prescribed exact-member link visible focus as implemented, but `thread-handlers.ts` focuses placements only for `open_member_in_side`, not `resolve_link`; an already-open placement produces no state mutation and the server skips Main Chat hydration for a non-primary target.
- Primary validation: inspected `thread-handlers.ts` action branches, `thread-ws-handlers.js` resolve dispatch, `link-service.js`, and `placement-delivery.js` early return. Accepted the finding. Source-derived scenario: resolving an already-open but unfocused Side Chat can return success without selecting the tab. No runtime reproduction claimed.
- Repair: Part 3 now separates server outcome, client handling, and intended presentation; requires documenting current integration gaps and handing off product follow-up, without changing product code or forcing parity with menu behavior. Final handoff scope includes missing exact-member link focus/reopen integration if still present.
- Reviewer also verified all 39 baseline hashes, document parsing, relative link targets, and scoped whitespace. No advisory requiring action.

### Pass 2

- Reviewer: `/root/chat_wiki_spec_review_2`, fresh `clean-room-reviewer`, `fork_turns=none`; model/effort inherited, persisted fields not exposed by the runtime. Pass 1 was confirmed terminal before dispatch.
- Reviewed SPEC SHA-256: `93b23cfc35c17e79a818cac59fe50d3d8e94d60f158d4150d8f9ac0a6543197b`.
- Reviewed BASELINE SHA-256: `6189687e5da45aab085a2fa5934497f3a6e034796ab10be9f1c4a3a7907585c4`.
- Terminal result: CLEAN, no material blockers or decision-relevant advisories. Closure: unavailable (no close-agent capability); no active conflicting reviewer.
- Independent checks: all 39 inventory hashes; root/server instructions and wiki guidance; source paths for identity, Move ordering, link resolution, header controls, placement, and production docks; existing test assertions; retired Secondary Chat history; frontmatter parsing; integration links/fragments; generated-block preservation; scoped whitespace checks.
- Primary affected checks after repair: revised SPEC and review record frontmatter/whitespace passed; scoped wiki diff check passed. Seven integration links/fragments resolved; all three wiki originals have exact saved snapshots; generated blocks remained unchanged. No product code or runtime verification was added.

## Final disposition

**CLEAN — specification review only.** Two completed fresh passes out of the default three-pass budget; no extensions, failed setup attempts, or unresolved material findings. One material issue was corrected between passes. Both reviewers reached terminal status. Model/effort were inherited; persisted values were unavailable. Agent closure was unavailable and did not prevent review.

The reviewed SPEC hash above identifies the final artifact; no substantive change followed Pass 2. The existing wiki is still awaiting Parts 0–7. Its current contradictions and product gaps are not declared repaired by this result. Runtime testing, product implementation, Alpha operations, commits, and publishing remain outside this completed task.
