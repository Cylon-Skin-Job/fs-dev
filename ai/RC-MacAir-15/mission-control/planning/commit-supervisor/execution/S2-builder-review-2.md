# S2 builder review 2 lifecycle

Reviewer `/root/s2_builder/s2_builder_review_2`; fresh clean-room-reviewer,
fork_turns=none, root model/effort inheritance/no override. Terminal FINDINGS
confirmed by list_agents at 2026-10-04T08:59:52Z before repair. close_agent
unavailable; completed read-only child is non-conflicting. The ten reviewed
artifact preimages/manifest/checks/smoke are retained in
S2-builder-pass-2-authority/. Builder independently validated both reproductions;
raw durable inputs/results: S2-review-2-reproduction-inputs/ and
S2-review-2-reproductions.json.

## Raw reviewer return

**S2 builder gate: FINDINGS — two material issues; repair required.**

Reviewer: `/root/s2_builder/s2_builder_review_2`; manager: `/root/s2_builder`. Actual CWD/controller home is `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Implementation root is `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`.

This was one independent read-only sweep against S2 and its immediate dependencies. No prior reviewer reports were read, files edited, agents spawned or approval requested. Root model/effort were inherited without override. This return completes the reviewer turn; no closure tool is available.

1. **CR-S2-01 — A shortened handoff packet can validate an incompletely reviewed repair.** Severity: **material**. Confidence: **high**. Disposition: **open / repair_required**.

   Violated criterion: [SPEC S2](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/planning/commit-supervisor/SPEC.md:135) requires coherent repair followed by fresh worker-handoff review. The [workflow](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/references/workflow.md:263) explicitly requires coverage of every original assigned path.

   Evidence: [review_packet.py:106](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/scripts/review_packet.py:106) checks reviewer coverage against only the packet-level `assigned_paths`. At line 168, a `repair-reported` finding bypasses further acceptance checks; lines 185–188 advance every such finding.

   Reproduction: retain a finding’s original assignment `["code.py", "adapter.py"]`, supply packet-level assignment `["code.py"]`, and provide a clean reviewer covering only `code.py`. The CLI exits 0 with `HANDOFF_VALIDATED`, `result="clean"`, `gaps=[]`, and advances F1 to `handoff-validated`, although `adapter.py` has no handoff coverage.

   Observable impact: the harness certifies an entire repair from a partial assignment gate. It must withhold acceptance for omitted original assignment paths or leave the affected finding open.

2. **CR-S2-02 — A historical rejection suppresses a newly validated same-ID material finding.** Severity: **material**. Confidence: **high**. Disposition: **open / repair_required**.

   Violated criterion: [SPEC S2](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/planning/commit-supervisor/SPEC.md:135) requires separate raw findings, stable dispositions and current-byte materiality. The workflow requires [same-ID history to reopen](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/references/workflow.md:191) and [unresolved material findings to prevent clean](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/references/workflow.md:243).

   Evidence: [review_packet.py:133](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-commit-supervisor/scripts/review_packet.py:133) retains the first duplicate at equal severity. Lines 152–153 skip that historical finding when it is unvalidated and its disposition is `not-supported`, before checking the current finding IDs.

   Reproduction: preserve an old F1 with `validated=False` and an evidenced `not-supported` disposition. Add a fresh current reviewer’s F1 at the same severity with `validated=True` and all four materiality dimensions. The CLI exits 0 with `REVIEW_COMPLETE`, `result="clean"`, `gaps=[]`, no repair packet, and the disposition remains `not-supported`.

   Observable impact: a fresh supported material claim disappears from routing merely because its stable ID previously held an unsupported claim. Current evidence must remain unresolved or receive an explicitly applicable current rejection; historical raw evidence must remain preserved.

Both reproductions use the shipped fixtures and public CLI. From the controller home:

```python
import copy, json, runpy, subprocess, sys, tempfile
from pathlib import Path

m = runpy.run_path(".agents/skills/mc-commit-supervisor/tests/test_review_packet.py")
cases = {}

p = m["base_packet"]("worker-handoff")
p["candidate"]["owned"]["code.py"]["worktree"] = "fixed"
p["candidate"]["owned"]["adapter.py"] = {"worktree": "still-bad"}
f = m["material"]()
f["assigned_paths"].append("adapter.py")
p["findings"] = [f]
p["dispositions"] = {"F1": [{"status": "repair-reported"}]}
p["evidence"][0]["dependencies"] = copy.deepcopy(p["candidate"])
p["reviews"][0]["dependencies"] = {
    "authority": p["candidate"]["authority"],
    "owned": {"code.py": p["candidate"]["owned"]["code.py"]},
}
cases["assignment-coverage"] = p

p = m["base_packet"]("final")
old = m["material"]()
old.update(validated=False, evidence="prior/unsupported.log")
p["findings"] = [old]
p["dispositions"] = {
    "F1": [{"status": "not-supported", "validation_evidence": "prior/rejection.log"}]
}
p["reviews"][0].update(result="findings", findings=[m["material"]()])
cases["new-current-evidence"] = p

with tempfile.TemporaryDirectory(prefix="s2-clean-review-") as tmp:
    for name, packet in cases.items():
        path = Path(tmp) / (name + ".json")
        path.write_text(json.dumps(packet))
        r = subprocess.run(
            [sys.executable, "-B", str(m["SCRIPT"]), "--packet", str(path)],
            capture_output=True, text=True,
        )
        o = json.loads(r.stdout)
        print(name, r.returncode, o["return"], o["result"], o["gaps"])
```

Fresh verification passed:

- `/opt/homebrew/bin/python3.12 -B -m unittest discover -s .agents/skills/mc-commit-supervisor/tests -p 'test*.py' -v`: **39 tests passed**.
- `/opt/homebrew/bin/python3.12 -B planning/commit-supervisor/execution/S2-static-checks.py`: passed before and after reproduction, including all ten current hashes, TOML, links, unchanged config, S1 artifacts and the 129-line workflow prefix.
- All nine supplied public CLI smoke cases reproduced their saved results exactly; input hashes matched. Recorded skill validators passed.

All five lenses were covered. Behavior & Verification produced the two findings above. Standards Compliance, Integrations & Dependencies, Forward Compatibility and Wiki Impact produced no additional material finding within S2. The written role boundaries, conditional-specialist routing, hold packets and existing builder/SPEC/roadmap scopes are coherent.

The helper/tests are bounded mechanical S2 additions. No actual subordinate runtime-agent chain is certified; `agent_gate_proof=false` remains accurate, and S6 owns that evidence. The two findings affect S2 harness correctness and its later rehearsal consumers. No advisories or authority blockers were identified.
