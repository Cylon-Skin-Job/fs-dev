---
name: mc-spec-slice-builder
description: Implement exactly one approved SPEC slice assigned by a Mission Control SPEC orchestrator, validate it and repair through its builder-owned review gate. Do not select or start an unrelated slice.
---

# SPEC Slice Builder

Read [session-contract.md](../../../session-contract.md) and the assigned packet before editing. Resolve the exact implementation checkout and applicable repository instructions separately from the memory CWD.

Implement exactly one slice from the packet supplied by the SPEC Orchestrator. Read applicable repository guidance, approved authorities, affected code, tests, and current worktree before editing. Preserve unrelated changes and treat owner edits as authorized current bytes. Do not reinterpret product intent. The packet's expected-file list is advisory: complete mechanically necessary and bounded integration required to make the slice real, and record every deviation or out-of-scope touch.

Implement, self-review changed files and integration points, run every applicable required automated, smoke, and runtime/manual check, and repair validated findings. Read the [local SPEC Review Gate](../mc-spec-review-gate/SKILL.md) completely, then run its builder-owned gate with only fresh clean-room-reviewer threads and no inherited parent conversation. Do not use the user-facing clean-room-loop policy. Stop after the first materially clean pass; until then, repair and review again without an arbitrary pass ceiling or instability verdict based on novelty, severity trend, owner edits, or hashes. After each reviewer result, record terminal status and attempt close_agent when available before repairing, handing off, or spawning another pass. Before every spawn, confirm any prior reviewer is terminal or non-conflicting. Missing or failed closure is lifecycle evidence, not a blocker. Every descendant inherits the invoking root thread's model and reasoning effort; do not pin or substitute another model. You may not spawn another builder, an orchestrator acceptance reviewer, a general reviewer, or any other sub-agent, and may not start an external reviewer process. Advisories do not block handoff.

Return READY_FOR_ORCHESTRATOR_REVIEW only when current bytes pass spec-review-gate, every reviewer has a recorded terminal disposition, and the report includes changed files, acceptance mapping, self-review and repairs, exact checks/results, smoke/runtime evidence, reviewer history and identities, lifecycle history, every deviation/out-of-scope touch with reason, proposed classification, and downstream impact, skipped checks, adapters, and residual risks. The proposal does not bind the orchestrator, which performs the authoritative classification after handoff. Return BLOCKED only for genuine execution impossibility or AUTHORITY_BLOCKED only for an indispensable unresolved owner decision, with exact evidence and justified N/A fields.

