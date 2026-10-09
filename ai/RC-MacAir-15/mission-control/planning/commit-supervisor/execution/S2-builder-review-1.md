# S2 builder review 1 lifecycle

Reviewer `/root/s2_builder/s2_builder_review_1`; fresh `clean-room-reviewer`,
fork_turns=none, inherited root model/effort, no override. Terminal findings
result confirmed by list_agents at 2026-10-04T08:48:15Z. close_agent unavailable
in tool surface; no closure call possible. Non-conflicting read-only completed
child. Builder independently reproduced both findings; raw evidence is
S2-review-1-reproductions.json. No candidate repair preceded terminal check.

## Raw reviewer return

**FINDINGS — S2 builder-owned gate. Two material findings remain.**

Reviewer: `/root/s2_builder/s2_builder_review_1`, fresh read-only runtime child. Actual CWD/controller home `C`: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Implementation root: `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`.

All ten artifact hashes match `S2-current-files.json`. S1 artifacts remain unchanged, including the original 129-line workflow prefix. No candidate files were edited, no agents were spawned, and no previous reviewer conclusions were consulted.

1. **S2-F1 — Final review accepts handoff evidence covering no repaired path.**  
   **Severity:** material. **Confidence:** high.

   **Violated criterion:** S2 requires fresh assignment-specific worker-handoff review and current-byte evidence. The workflow states that missing dependencies are incomplete evidence and that missing handoff evidence prevents a clean final result ([workflow.md:230](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/references/workflow.md:230)).

   **Evidence:** [review_packet.py:161](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/scripts/review_packet.py:161) accepts a handoff from its current dependencies, kind, result and `fresh_independent` flag. It never requires those dependencies to cover the repaired path.

   **Reproduction:** Load retained `S2-smoke/fresh-final.json`; replace `evidence[1].dependencies` with only `{"authority": packet["candidate"]["authority"]}`; run the public CLI. Actual output:

   ```json
   {
     "state": "review-complete",
     "result": "clean",
     "gaps": [],
     "unaffected": ["behavior", "F1-handoff"]
   }
   ```

   **Observable impact:** The rehearsal reports a clean final result for F1 even though its handoff evidence identifies no reviewed `code.py` bytes. It also cannot invalidate that handoff when the repaired bytes change. This breaks the required handoff/current-byte simulation; it does not establish an actual agent gate.

   **Required correction:** Require handoff dependencies to cover the original repaired assignment and current affected paths, while retaining support for legitimately narrow handoffs.

2. **S2-F2 — An intent/prerequisite hold drops findings supplied in raw reviews.**  
   **Severity:** material. **Confidence:** high.

   **Violated criterion:** S2 requires preservation of raw findings and stable dispositions while holding affected work and continuing authorized independent progress. See [workflow.md:174](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/references/workflow.md:174) and [workflow.md:270](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/references/workflow.md:270).

   **Evidence:** [review_packet.py:78](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/scripts/review_packet.py:78) returns immediately for an issue, before collecting raw reviews and their findings at line 98.

   **Reproduction:** Load retained `S2-smoke/initial-material.json`; add the `issue` object from retained `S2-smoke/missing-intent.json`; run the public CLI. Actual output:

   ```json
   {
     "state": "needs-owner",
     "result": "insufficient-evidence",
     "raw_reports": [],
     "findings": [],
     "dispositions": {},
     "repair_packet": null
   }
   ```

   The input contains a current, validated material finding F1 in `reviews[0].findings`.

   **Observable impact:** The returned hold packet loses the supplied review and F1, preventing the consumer from preserving its disposition or routing an independent correction from this result. The input remains intact, but the harness return omits required information.

   **Required correction:** Preserve and assess supplied raw reviews/findings before returning the hold. Keep affected work held and retain independently actionable findings.

Both reproductions used disposable JSON fixtures and `/opt/homebrew/bin/python3.12 -B <script> --packet <fixture>`.

Verification passed: 15 S2 tests, 21 S1 regression tests, all three skill validators, TOML/AST/link/static checks, and replay of all seven retained public CLI smokes with matching outputs. No reviewed bytes changed during this pass.

All five lenses were covered. Standards, role boundaries, conditional specialist routing, leaf repairs, distinct worker/final gates, existing builder/SPEC/roadmap scopes, S1 preservation and deferred S5 registration are otherwise consistent. Wiki and runtime execution remain assigned to later slices; synthetic evidence was never treated as actual agent proof.

This result is **not CLEAN** and does not constitute orchestrator acceptance. The two harness corrections are bounded technical repair work; no owner decision or additional authorization is needed.
