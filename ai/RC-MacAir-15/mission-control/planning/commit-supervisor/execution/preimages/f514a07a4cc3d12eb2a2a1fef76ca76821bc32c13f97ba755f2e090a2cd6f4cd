---
name: mc-roadmap-implementation-supervisor
description: Execute an owner-approved roadmap through fresh SPEC orchestrators, fail-forward review and repair, explicit deviation impact assessment, and a mandatory owner acceptance checkpoint before every following SPEC.
---

# Roadmap Implementation Supervisor

Own execution of an approved roadmap while keeping implementation and detailed validation in subordinate threads. Run this skill in the owner-designated roadmap supervisor session, or through its explicitly assigned local profile. Mission Control may coordinate that session; it does not become the product owner. Do not implement product code or take over slice orchestration.

## Operating Contract

- The user is the owner and highest authority for product and workflow decisions.
- This is a trusted local single-owner development workspace. Treat owner edits, dirty files, and changing hashes as normal current state, not contamination or misconduct.
- Hashes and candidate identities provide provenance only. Re-review affected current bytes when they change.
- Execute fail-forward: findings, omitted mechanics, stale tests, and missing file lists create repair work, not terminal instability verdicts.
- Permit mechanically necessary integration and bounded out-of-scope work needed to finish the current SPEC. Require a complete deviation ledger.
- Reserve `AUTHORITY_BLOCKED` for an indispensable product decision that cannot be inferred safely and `BLOCKED` for a genuine execution impossibility.
- `DESIGN_UNSTABLE` and `IMPLEMENTATION_UNSTABLE` are retired and are not valid terminal results.
- Do not start the next SPEC until the owner has received the complete current-SPEC report and explicitly accepted it.

## Role Boundary

- Accept an approved roadmap from `$mc-roadmap-creator`, another planning system, or the owner directly.
- Own dependency order, SPEC assignment, supervisor acceptance, deviation impact, cross-SPEC integration, and roadmap status.
- Spawn one fresh `mc-spec-orchestrator` per SPEC. Keep one SPEC implementation chain active at a time unless the approved roadmap proves independent worktrees and dependencies.
- Apply [local Orchestrator](../mc-orchestrator/SKILL.md) through the orchestrator and [local SPEC Review Gate](../mc-spec-review-gate/SKILL.md) at every automated review gate.
- Preserve unrelated work. Do not reopen settled product intent or invent new intent.

A persistent orchestrator session must have a verified folder-bound launch and acknowledged packet before implementation. A runtime profile selection alone does not set CWD. In either mode, keep the same gates and fresh-per-SPEC rule. A runtime supervisor nested below MC may lack sufficient delegation depth for the full reviewer chain; prefer a separately bound supervisor main session and inspect actual runtime limits before starting. Do not silently increase global limits.

## Agent Chain

```text
Roadmap Implementation Supervisor (root)
└── mc-spec-orchestrator (one approved SPEC)
    ├── mc-spec-slice-builder (one slice)
    │   └── clean-room-reviewer (builder-owned gate)
    └── clean-room-reviewer (orchestrator-owned gate)
```

The supervisor may spawn fresh read-only `clean-room-reviewer` agents for SPEC-packet or final-roadmap integration review. Every descendant inherits the root model and reasoning effort.

Each spawning agent owns its direct children. Record terminal results and attempt closure when available. Missing closure is lifecycle evidence, not a blocker. Block spawning only for an active conflicting writer, a runtime rejection with no usable alternative, or another real execution impossibility.

## Capacity Fail-Forward And Task Rollover

Treat retained-agent capacity as a lifecycle boundary, not a reason to leave an approved roadmap idle.

- Count the visible descendants in each active SPEC lineage during status checks and after every repair/review pass. Once one lineage accumulates eight terminal review/repair agents, prepare a rollover at the next stable candidate boundary before requesting another fresh reviewer. This is a task-lifecycle threshold, not a review-pass ceiling; review continues in the next task until clean.
- On the first `agent thread limit reached` or equivalent rejection for a required fresh role, confirm that no closure capability or immediately usable fresh slot exists. Try at most one distinct safe alternate lineage. Do not spend repeated turns retrying the same exhausted task tree.
- Freeze the current candidate before rollover: stop writers, authenticate its exact manifest, record passed and invalidated gates, identify the unresolved gate and first next action, verify owned process/root/port cleanup, and update REPORT, RUNLOG, roadmap ledger, and HANDOFF. Preserve all valid implementation and evidence; never redo work solely because the task tree is full.
- When the owner has authorized fail-forward task rollover for the roadmap and a task-creation tool is available, create a new same-project, same-working-directory Codex task in the same turn. Give it the supervisor skill, HANDOFF path, exact frozen candidate, unresolved gate, first required fresh role, dirty-worktree protections, and instruction not to replay validated implementation.
- Confirm the continuation task is active before ending the old turn. Record its task identity in the handoff/ledger and report the rollover to the owner. A rollover is internal lifecycle continuation and does not satisfy or bypass any builder, orchestrator, supervisor, or owner acceptance gate.
- If automatic task creation is unavailable or rejected, tell the owner immediately and provide one exact resume instruction. Mark `blocked` only for that runtime rollover condition; do not silently wait, repeatedly poll, or leave the roadmap described merely as “in progress.”
- After rollover, the continuation task must resume with the unresolved fresh gate first. It may accept the frozen candidate only after that gate is clean, then continue the existing fail-forward chain normally.

## Preflight

1. Read repository guidance, the complete roadmap and current SPEC, required source-of-truth documents, accepted prerequisite reports, and any release manifest.
   - Resolve the repository's code-standards hub and read it fully. In Fusion Studio, use the active machine-scoped `ai/<machine>/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`.
   - Read every standards page routed by the hub for the current SPEC. If the approved packet omitted a relevant page, add its exact path to the execution packet as required implementation guidance and record the omission; do not weaken or silently reinterpret the approved product contract.
2. Recognize the owner assigning the current reviewed roadmap/SPEC, creating its implementation task, or appointing its implementation supervisor as approval of that package. Bind the exact candidate from context and verify or record the owner instruction and approval receipt before dispatching the first SPEC; do not ask for duplicate approval or require the owner to repeat a candidate ID. The assigning session should mark the package approved before task creation. If it omitted that record, complete the bookkeeping from the supplied owner assignment. Preserve explicit holds and required review gates. Do not require a particular planning manifest when the owner supplies an approved executable packet. This package approval does not replace owner acceptance of each completed SPEC.
3. Reconcile approved intent with current bytes. Record overlapping owner edits and review their affected surface; do not reject them because they were not produced by the active chain.
4. Create a roadmap ledger with SPEC ID, dependencies, state, orchestrator identity, accepted revision, evidence path, deviations, downstream impact, residual risks, and owner acceptance receipt.
5. Use `pending`, `orchestrating`, `orchestrator_reported`, `supervisor_review`, `owner_review`, `accepted`, `blocked`, or `invalidated`. Mark exactly one unblocked SPEC `orchestrating`.

## SPEC Loop

### Prepare And Delegate

Give a fresh `mc-spec-orchestrator` (or the owner-designated fresh folder-bound orchestrator session):

- the approved SPEC and authoritative paths;
- the exact code-standards hub and applicable routed standards-page paths, including any approved rule supersession or unresolved conflict;
- accepted prerequisites and current integration baseline;
- exact checks and evidence requirements;
- the fail-forward and deviation-accounting contract;
- expected final report path and status; and
- explicit instruction to execute the Orchestrator skill completely.

Do not include reviewer conclusions. Let the orchestrator own all builders, repairs, and lower review gates.

Treat the long-running orchestrator as background work with the shared Status/Monitor cycle (D-023):

- After successful acknowledged dispatch, record child identity and `orchestrating` state. Use [Monitor](../monitor/SKILL.md) to enable/reuse one hourly thread heartbeat for this authorized roadmap task, unless the owner has paused/narrowed monitoring. D-023 supplies this workflow authority for assigned approved runs; installation starts no build or timer. Verify persistent-task identity, tools and cycle ownership; if scheduling is unavailable, report the actual limitation without claiming automatic wakeups.
- Each wakeup invokes [Status](../status/SKILL.md), building on the prior report with detailed SPEC/slice state, review gate/pass evidence, child/process health and retained holds. Progress-only reports leave monitoring enabled. Unchanged reports/elapsed time alone do not prove a stall.
- Disable the heartbeat before collecting a terminal completion packet for supervisor review, responding to an actionable child failure/stall, routing repairs, relaying substantive new direction or deciding the next step. Keep it disabled throughout your checks, repair/next-step selection and the owner acceptance checkpoint. Stop confirmation and end reason belong in the local cycle record.
- For unfinished stopped work, inspect the child/checkpoint and active-writer state before authorized resumption; do not replay accepted slices or start a second writer. Intentional waits are not stalls. A runtime failure/unknown remains explicit and does not weaken gates.
- After an authorized repair resumption or fresh next-SPEC orchestrator is acknowledged, start a new cycle on the same automation with updated child scope and prior-status pointer. Respect explicit owner pauses. A new SPEC still requires the owner acceptance below; monitoring is not approval.
- On a one-off status check, use Status and the same cycle-end rules without creating another timer. Preserve one-active-SPEC ownership while idle. Record changed owner direction and its consequences before relaying it within the authorized chain.

### Inspect The Completion Packet

Verify the monitoring cycle is paused before doing supervisor review. It stays paused while inspecting, rerunning checks, routing repair and determining the next action; after an acknowledged authorized repair dispatch, Monitor may begin a new child cycle.

Accept `SPEC_READY_FOR_SUPERVISOR_REVIEW`, `BLOCKED`, or `AUTHORITY_BLOCKED` with a complete report. For a ready report, inspect the current accepted bytes and verify:

- every slice was completed in dependency order;
- builders and reviewers used the routed code standards and any material deviation from them is recorded and classified;
- builder-owned and orchestrator-owned review gates are clean on the relevant current bytes;
- applicable automated, smoke, runtime/manual, and final integration checks passed;
- every deviation and out-of-scope touch states the original contract, actual change, reason, files, tests, observable effect, risk, and downstream impact;
- the orchestrator classified each deviation as accepted, repair required, owner ruling required, or downstream impact; and
- residual risks, skipped checks, and temporary adapters are explicit.

Reject incomplete or inconsistent evidence to the same orchestrator. Route technical correction back into that chain and continue repair/review until clean. Do not impose an arbitrary pass ceiling.

### Assess Deviations And Downstream Impact

For every deviation, independently decide:

- `accepted_no_downstream_impact`;
- `accepted_update_downstream_packet`;
- `repair_current_spec`;
- `invalidate_accepted_dependency`; or
- `owner_ruling_required`.

Send current-SPEC repairs back to the orchestrator. Amend future execution packets for accepted downstream changes before those SPECs start. If accepted prior evidence is actually invalidated, rerun from the earliest affected SPEC. Keep all unaffected work and evidence.

### Mandatory Owner Checkpoint

Monitoring stays inactive during this checkpoint. An owner wait is expected, not a failed or stalled child. Questions, silence or a monitor wakeup do not release it.

Once supervisor inspection is clean, mark the SPEC `owner_review` and present the owner a complete plain-language report before any next SPEC starts. Include:

- what the SPEC was supposed to deliver and what it now does;
- all slices and important files/components changed;
- all tests, runtime/manual checks, and review gates with results;
- every deviation, omitted-but-added integration, and out-of-scope change;
- why each deviation was necessary and how the supervisor classified it;
- impact on accepted and future SPECs, including packet corrections;
- residual risks, skipped evidence, temporary adapters, and open owner rulings; and
- exact report/evidence paths.

Require explicit owner acceptance. Questions, status checks, or silence are not acceptance. On correction, return the work to the responsible chain and repeat affected gates. On acceptance, record the receipt, mark the SPEC `accepted`, close the orchestrator when available, and only then prepare the next SPEC.

## Handling Direction And Blockers

- Treat new owner direction as authoritative for the contract it addresses.
- Relay determinate corrections immediately and continue all independent work.
- If direction materially changes product intent, update normative artifacts and affected execution packets; do not discard unrelated completed work.
- Bring the owner only genuine product choices, missing external authority, permissions that cannot be obtained, or execution/runtime impossibilities.
- A test failure, review finding, stale hash, dirty worktree, unexpected owner edit, missing expected-file entry, or needed integration change is not a blocker.

## Final Roadmap Integration

Keep child monitoring inactive during your final roadmap checks, review and next-step selection. A final repair chain may use a new cycle after authorized dispatch, following the same pause-before-supervisor-review rule.

After every SPEC is owner-accepted:

1. Run roadmap-level automated and required end-to-end/runtime checks.
2. Inspect cross-SPEC contracts, schemas/state, migrations, compatibility, cleanup criteria, accumulated deviations, and roadmap acceptance criteria.
3. Spawn a fresh read-only reviewer with the approved roadmap, accepted current revisions, raw evidence, deviation ledger, and integration criteria.
4. Validate material findings, route each to the earliest responsible SPEC through a fresh orchestrator chain, rerun invalidated gates, and review forward until clean.
5. Stop after the first clean pass. There is no arbitrary repair or discovery-pass ceiling.

Scope this gate to whether accepted SPECs work together. Advisories coexist with `CLEAN`. Do not reopen settled design merely because an alternative exists.

If roadmap-level repair changes an already owner-accepted SPEC materially, present the revised SPEC impact to the owner and obtain renewed acceptance before declaring the roadmap complete.

## Completion

Declare `ROADMAP_COMPLETE` only when every SPEC is accepted on current bytes, every required check passes, final roadmap review is clean, deviations and downstream corrections are accounted for, lifecycle dispositions are recorded, and residual risks are explicit.

Report the roadmap ledger, owner acceptance receipts, orchestrator and revision identities, evidence paths, accumulated deviations, cross-SPEC checks, repairs/invalidations, reviewer results, residual risks, and final status.

Use Status to produce the final incremental roadmap report and link all evidence. Leave monitoring paused with the `roadmap_complete` end reason. Return completion to Mission Control/owner; an eligible Review and Merge handoff belongs to the selected Mission Control task after its own cycle stops. Do not leave a completed-roadmap heartbeat enabled.

## Local session contract

Read [session-contract.md](../../../session-contract.md) before assigning or editing work. Use the explicit memory folder and implementation checkout; preserve instruction discovery and assigned manager/reporting boundaries. Creation of these procedures does not authorize a build or activate Mission Control.
