# S1 builder handoff

State: READY_FOR_ORCHESTRATOR_REVIEW. Current bytes passed the first fresh
builder-owned gate; no material finding or advisory remains.

## Assignment and binding

Work: SPEC-COMMIT-SUPERVISOR-01 / S1 only. Manager: runtime `/root`;
builder: `/root/s1_builder` (runtime child, not a persistent task UUID).
Controller home and verified memory CWD:
`/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.
Implementation root independently verified as `/Users/rccurtrightjr./projects/fs-dev`,
branch `agent/exact-workspace-paths`, HEAD
`d15792920731f85e45b743519d4af2b807d95a9c`. This is the primary development
checkout, not the Alpha mirror. Effective permissions are Full Access
(`danger-full-access`, approval policy `never`); assignment still limits writes.
Owner assignment/approval is recorded in `approval-receipt.md`; approved SPEC
candidate is `sha256:c12ff1fff3c391e5183eea219553c547a91e461d9cb114c21719b37cfe209d02`.
All source hashes match the approved baseline per manager preflight.

Read completely: exact session contract, builder/review-gate skills, SPEC,
repository and controller AGENTS, Skill Creator, active Code Standards hub,
Architecture Routing, Persistence And Metadata, Testing And Smoke Slices,
and User Preferences. No standard supersession. Existing legacy workflow and
local snapshot helpers were inspected for reuse; none preserves the required
separate Git index/worktree state. Existing legacy production entry remains
in place; S5 owns activation/migration.

## Changed artifacts and behavior

Seven new files under `.agents/skills/mc-commit-supervisor/`:

- `references/workflow.md`: required intake/ownership fields, isolated candidate
  method, immutable checkpoint, guarded restore and separate runtime recovery.
- `references/job-template.md`: useful owned record fields and progress/evidence
  boundaries; no empty job scaffolding or live job is created.
- `scripts/job_snapshot.py`: public capture/verify/guard/restore CLI, immutable
  payload manifest, ownership/expected-byte guard, consistency and provenance.
- `scripts/snapshot_state.py`: NUL-safe Git/path inventory and exact semantic
  fingerprints, safe-leaf/isolated binding and read-only source/ref/config checks.
- `scripts/snapshot_restore.py`: preflight collisions, selective owned index-stage
  reconstruction in the current isolated index, independent leaf replacement,
  index/status/worktree readback and guarded-state rollback on I/O failure.
- `tests/snapshot_fixture.py`: temporary independent clone from existing local
  commits, staged/unstaged dirty inputs and source/shared/sentinel checks.
- `tests/test_job_snapshot.py`: 21 public-CLI/invariant tests.

Current exact file identities and line counts are in `S1-current-files.json`.
Largest file is below 400 lines. Added execution evidence: `S1-tests.log`,
`S1-smoke.json`, this report and uniquely owned builder-review reports.
These are coordination evidence, outside the approved SPEC identity.

## Acceptance mapping

| S1 criterion | Current implementation and raw evidence |
|---|---|
| Required packet/state/checkpoint fields | workflow intake/recovery and job template; schema 1 manifest records root/Git dir/common dir, branch/HEAD/ref/config, ownership, target/source full IDs, authority hashes, recipe, runtime limits and immutable payloads |
| Capture and read-only verify | public capture/verify in exact CLI test and retained `S1-smoke.json`; payload hash readback, independent current-state/status match booleans |
| Guarded isolated restore | public guard/restore; exact root/common-dir binding, current owner/path/inactive-writer receipt, source/shared/ref/index/unrelated and expected-byte checks before replacement |
| Staged and unstaged text/binary on same path | CLI round trip checks independent hashes and actual stage versus working readback |
| Staged add/delete/rename, untracked and missing | fixture/CLI round trip plus missing-indexed-file test; rename owns old and new leaf; job-created removal declaration enforced |
| Mode, symlink, odd paths | index mode and working permission independently checked; symlink stage/working targets differ and restore exactly; tabs/newlines/quotes/shell characters treated as bytes/arguments |
| Index/readback equality including conflicts | complete stage/mode/blob/flag semantics; stage 1/2/3 payload round trip and assume-unchanged/skip-worktree flags tests; NUL-safe status readback |
| Capture consistency | before/after relevant worktree/index/ref/config/authority/input fingerprints and owned payload comparison; injected-state and actual writer-during-payload tests leave no completed checkpoint and retain writer bytes |
| Collision non-mutation | owned, unrelated index/worktree, wrong owner/conflicting writer, source/wrong clone, traversal/parent-link, corrupt payload, config drift and index-lock refusals retain current bytes/index/ref state |
| Payload/runtime boundaries | immutable checksum-addressed payloads, corruption and replacement tests; runtime recovery explicitly separate, no development/Alpha database/profile operation |
| Preservation of source/shared/unrelated | every fixture compares source refs/raw index and AGENTS/README byte sentinels; restored isolated unrelated README index/worktree remains equal; retained smoke evidence includes all readbacks |
| No new commits/ref movement | fixtures only clone existing local refs, populate isolated index and write local blobs; helper has no commit/reset/publication/ref-moving operation |

## Self-review and verification

First test run failed because Git check-ignore rejects the inherited literal
pathspec mode. Corrected only that command's environment to use its NUL literal
input interface. Then tightened owned-payload versus baseline consistency,
status/input/ref/config checks, capture writer lock, index flags, missing indexed
file, intent-to-add prerequisite, actual concurrent mutation and I/O rollback.

Final builder cumulative command:
`PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3.12 -B -m unittest discover -s .agents/skills/mc-commit-supervisor/tests -p 'test_job_snapshot.py' -v`
from the verified memory CWD. Result: 21 tests pass in 18.298s; exact raw log
`S1-tests.log`. All five Python files parse with Python 3.12 AST validation.

Public CLI smoke separately created a retained temporary clone/job, captured,
verified, mutated, guarded, injected a collision, verified refusal non-mutation,
recorded legitimate fresh guard, restored and verified exact semantic readback.
Exact results and retained job path: `S1-smoke.json`. Manifest hash:
`9123316530e5276c56fbb23163d3fa6af4b9138216cf24c7a83e14713a0fe273`.
Restored semantic fingerprint:
`4de34d77ad76e53ee526e0f119968cee794c58bb999d40ebaae3c74819ae8757`.
Code tests create no fixture/checkpoint commit and no remote operation.

No S1 required automated/smoke check is skipped. App build/runtime, skill
entry/frontmatter/TOML/index migration checks belong to later slices and are
not claimed. Normal development and Alpha processes/profiles were untouched.

## Builder gate and lifecycle

Fresh reviewer `/root/s1_builder/s1_builder_review_1`, role
`clean-room-reviewer`, `fork_turns=none`, raw source/current bytes/evidence packet,
inherited root model/effort and no override. Started only after confirming no
prior direct child. Terminal CLEAN at 2026-10-04T08:20:55Z; completed status
confirmed with `list_agents`. Raw result and lifecycle: `S1-builder-review-1.md`.
Reviewer independently reran 21 tests (18.233s) and the public retained smoke
verify. All seven current file hashes matched at review completion.
`close_agent` is absent from available tools, so no closure call was possible.
No additional pass after first CLEAN; no known material repair remains.

## Deviations and downstream impact

| Original SPEC text | Actual change / reason | Files / checks / effect / risk / proposed classification |
|---|---|---|
| “One snapshot/verify/isolated-restore responsibility; split only if cohesive complexity warrants it.” | Split state reading and restore mechanics from public checkpoint/CLI orchestration to keep purposeful responsibilities below 400 lines. | Three script files plus shared fixtures/tests; all 21 checks pass; no behavior/scope change; import boundaries tested by public CLI; proposed `accepted`, downstream impact none. |
| Planned capture, verify and restore entry points; restore requires current ownership and expected bytes. | Add `guard` CLI and ownership receipt to record the expected candidate state after an authorized repair, before recovery. | `job_snapshot.py`, restore module, docs/tests; stale guard collisions refuse without mutation; bounded mechanical integration, no new product choice; proposed `accepted`; downstream S6 uses guard before restore. |
| Preserve owned raw index/worktree semantics and report unmet recovery prerequisites. | Support all merge stages and index flags; explicitly reject owned directories/submodules/special files, parent links and intent-to-add rather than silently approximate them. Independent clone required; shared-common-dir linked worktree restore refused. | state/capture binding + docs/tests; conventional staged additions and all required leaf types pass; unsupported types return an explicit prerequisite; proposed `accepted` implementation boundary; known S6 fixtures fit supported scope, downstream impact none. |

No S2–S6 implementation, source product change, global configuration, runtime
adapter or temporary production shim is introduced. No unresolved owner intent.
Residual limits: writer inactivity/ownership is manager-verified external evidence;
the helper checks receipts and fingerprints, not agent processes. A process crash
or filesystem failure still requires inspecting the retained checkpoint/current
bytes and any stale owned index lock before resumption; rollback is best effort,
not runtime/database recovery. Payload directory permissions plus checksum
readback preserve evidence under the trusted local-owner contract. Only the
recorded isolated clone can receive a restore; reproduction on another clone
requires its own approved checkpoint. The retained temporary smoke clone has no
running process and preserves recovery evidence.

Next safe action after terminal clean builder gate: manager independent S1
inspection and fresh orchestrator acceptance review. S1 acceptance grants no
commit/publication/runtime readiness or subsequent SPEC approval.
