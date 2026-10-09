# S2 builder review 3 lifecycle

Fresh reviewer /root/s2_builder/s2_builder_review_3, clean-room-reviewer,
fork_turns=none, root inheritance/no override. Terminal FINDINGS confirmed by
list_agents at 2026-10-04T09:16:29Z before repairs. No close_agent available;
completed read-only child is non-conflicting. Reviewed ten artifact preimages,
manifest/checks/smoke retained at S2-builder-pass-3-authority/. Independently
validated builder reproduction: S2-review-3-reproduction-inputs/ and
S2-review-3-reproductions.json.

## Raw reviewer return

FINDINGS — one material issue. The S2 builder gate is not CLEAN.

Reviewer `/root/s2_builder/s2_builder_review_3` independently reviewed the ten identities in `execution/S2-current-files.json`. Actual CWD: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Git root, branch and HEAD match the assignment. Root model/effort were inherited without override. No candidate files were edited, agents spawned, or prior reviewer reports consulted. This is builder review, not orchestrator acceptance.

**CR-S2-R3-01 — An evidence-backed advisory reclassification still demands repair.**

- **Severity:** material. **Confidence:** high.
- **Violated criterion:** [SPEC.md:135](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/planning/commit-supervisor/SPEC.md:135) requires materiality handling. [workflow.md:181](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/references/workflow.md:181) requires evidence-backed reclassification while preserving raw claims. [Review Gate:57](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-spec-review-gate/SKILL.md:57) permits advisories with CLEAN.
- **Exact evidence:** [review_packet.py:147](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/scripts/review_packet.py:147) selects the highest historical severity. Lines 176–180 honor an advisory only when the selected raw finding itself has advisory severity; they do not honor a current, evidence-backed `advisory` disposition. Line 199 subsequently routes that preserved historical material claim to repair.
- **Observable impact:** after independent validation reclassifies a claim as optional polish, the command still requests an unnecessary repair. Withdrawing material validation instead produces `unmet-gate`. Preserving the original raw finding therefore prevents the intended advisory outcome.

Reproduction from controller home, using the supplied final fixture:

```python
import copy, json, subprocess, tempfile
from pathlib import Path

c = Path.cwd()
p = json.loads((c / "planning/commit-supervisor/execution/"
                    "S2-smoke-pass-3/fresh-final.json").read_text())
original = copy.deepcopy(p["findings"][0])
p["evidence"] = [p["evidence"][0]]
p["dispositions"]["F1"].append({
    "status": "advisory",
    "actor": "fixture-final-orchestrator",
    "time": "2026-10-04T00:00:00Z",
    "candidate": copy.deepcopy(p["candidate"]),
    "dependencies": copy.deepcopy(p["candidate"]),
    "finding_evidence": original["evidence"],
    "validation_evidence": "fixture/reclassification.md",
    "reason": "Independent validation establishes optional polish",
    "next_action": "Retain advisory; no repair required",
})
note = copy.deepcopy(original)
note.update(severity="advisory", validated=False,
            impact="Optional polish; accepted behavior passes")
p["reviews"][0].update(result="findings", findings=[note])

with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / "packet.json"
    path.write_text(json.dumps(p))
    run = subprocess.run([
        "/opt/homebrew/bin/python3.12", "-B",
        str(c / ".agents/skills/mc-commit-supervisor/scripts/review_packet.py"),
        "--packet", str(path),
    ], capture_output=True, text=True)
    out = json.loads(run.stdout)
    print(out["state"], out["result"],
          out["repair_packet"]["finding_ids"],
          out["dispositions"]["F1"][-1]["status"])
    assert out["findings"][0] == original
```

Actual output: `repair findings ['F1'] advisory`, exit 0, with no evidence gaps. Expected: a clean review retaining the advisory and unchanged original claim, provided no current supported material claim remains. A correction must still reopen genuinely supported fresh material evidence.

Verification otherwise passed:

- Independently reran all **43 cumulative S1/S2 tests**.
- Reran `S2-static-checks.py`: current hashes, TOML, AST, links, S1 preservation, unchanged config, branch and HEAD passed.
- Reran all **11 retained public CLI smoke cases**; complete responses matched their recorded outputs.
- Inspected recorded skill-validator commands and successful logs.
- Confirmed the original 129-line S1 workflow prefix and accepted S1 artifacts remain unchanged.

All five lenses were covered. The skill/profile contracts retain leaf repair ownership, fresh manager-assigned handoff and final gates, dependency invalidation, bounded holds, and existing builder/SPEC/roadmap scopes. No concrete risk required an additional specialist. No additional material finding was identified.

The synthetic harness correctly retains `agent_gate_proof=false`; actual agent/runtime proof remains S6 work. This report is terminal reviewer output; closure is manager-owned and no closure tool is exposed here.
