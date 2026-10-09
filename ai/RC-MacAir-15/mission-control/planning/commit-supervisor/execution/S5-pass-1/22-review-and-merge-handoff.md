# Commit Supervisor — structure and creation handoff

> [D-024](decisions.md#d-024--commit-supervisor-and-one-integrated-workflow-spec) renames the top-level role and requests a single executable workflow SPEC. The older Review and Merge wording/identifiers below retain their historical provenance. Use [SPEC-COMMIT-SUPERVISOR-01](planning/commit-supervisor/SPEC.md) for the current implementation candidate after its independent release review; no replacement roles are installed merely by this handoff.

Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. S5 cutover now routes entry/profile links below to the canonical [Commit Supervisor](.agents/skills/mc-commit-supervisor/SKILL.md). Historical prose, hierarchy and source fingerprints describe the earlier discussion/installation; they do not claim the retired identifiers remain discoverable. Actual rehearsal remains S6; see [deployment](deployment.md).

> Owner-directed handoff for a separate, owner-managed setup chat. Recorded by Codex side chat (ephemeral), 2026-10-04T06:00:36Z (2026-10-03 PDT). This document creates no session, monitoring cycle or integration job. No session UUID is asserted.

## Assignment and first response

Create/refine Mission Control's Review and Merge workflow, its agent responsibilities, independent evaluation gates and durable job records. Extend the existing local skill/profile; do not treat this as a request to integrate a live build. The owner will manage the new chat.

**In your first substantive response, recreate the complete hierarchy below inline in the conversation as a readable tree or Mermaid diagram.** Do not merely link to this file or say that you read it. Explain which review roles belong to managers, where authors remain leaf workers, and which Review and Merge responsibilities still need definition. Include the implementation supervisor's own final-roadmap review. Then proceed within the assigned setup scope, surfacing consequential unspecified intent instead of claiming a finished workflow.

Memory home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.
Product development checkout, for separately authorized future integration: `/Users/rccurtrightjr./projects/fs-dev`.
These are separate responsibilities even though the memory home is inside this repository. Verify actual startup CWD and applicable instructions; a profile does not select a folder.

Suggested opening prompt for the owner to paste into the new chat:

> Read review-and-merge-handoff.md in the Mission Control home. Recreate its hierarchy inline for me first. Then create/refine the Review and Merge workflow using our existing definitions, clean-room review principles and owner gates. Keep the work scoped to workflow, skills, profiles and supporting records; do not run a live integration or monitoring cycle.

## Current hierarchy

This is the installed role structure, not a list of running sessions. The owner can assign workflows directly. Mission Control coordinates them within its actual dispatch authority; it does not automatically launch every branch.

```text
Owner / designated Mission Control session
│
├── First Draft Supervisor — mc-draft-supervisor
│   └── Planning Stage Orchestrator — first-draft
│       ├── Bounded investigators — report writers only
│       ├── First Draft author — mc-first-draft
│       ├── Fresh Planning Validators — worker-handoff
│       │   └── Review individual substantive reports / authored draft
│       └── Separate fresh Planning Validator — draft stage
│           └── Review assembled coverage, evidence synthesis and seams
│
├── Roadmap Creation Supervisor — mc-roadmap-creation-supervisor
│   ├── Optional first-draft stage — same structure as above
│   ├── Planning Stage Orchestrator — candidate
│   │   ├── Bounded investigators — report writers only
│   │   ├── Roadmap/SPEC author — mc-roadmap-author
│   │   ├── Fresh Planning Validators — worker-handoff
│   │   │   └── Review individual substantive reports / authored candidate
│   │   └── Separate fresh Planning Validator — candidate-stage
│   │       └── Review assembled executable stage
│   └── Separate fresh Planning Validator — release
│       └── Review complete package / cross-SPEC readiness
│
├── Roadmap Implementation Supervisor — mc-roadmap-supervisor
│   ├── Fresh SPEC Orchestrator per SPEC — mc-spec-orchestrator
│   │   ├── Fresh Slice Builders — mc-spec-slice-builder
│   │   │   └── Fresh clean-room reviewers — builder-owned gate
│   │   └── Fresh clean-room reviewers — orchestrator-owned gates
│   │       └── Slice acceptance and final SPEC integration
│   └── Fresh clean-room reviewer — final-roadmap integration
│       └── Supervisor may also commission SPEC-packet review
│
└── Review and Merge — mc-review-and-merge
    ├── Integration-unit / prerequisite / source-baseline assessment
    ├── Candidate preparation and bounded repairs
    ├── Required independent integration evaluation
    ├── Owner checkpoint — waiting-owner before commit / push
    └── Authorized publication / integration receipt and dependency effects
```

The last branch lists responsibilities of the existing Review and Merge role. Its decomposition into subordinate agents is **not yet installed**. Do not describe those responsibilities as existing child profiles.

Draft Supervisor is a standalone entry, not a child of Roadmap Creator. Both reuse the same stage procedure. Planning validators are manager-assigned siblings of authors/investigators; authors and investigators remain leaf workers. Implementation builders retain their distinct permission to commission their own clean-room reviewers. Planning rules do not remove that permission.

## Review principles to preserve

The planning sequence established under D-022 is self-check → independent worker-handoff review → separate stage validation → independent release validation → owner approval of the executable package. Handoff acceptance, implementation correctness and landed integration are separate facts.

| Gate | Question | Threshold |
|---|---|---|
| Planning worker handoff | Did the individual output satisfy its bounded assignment with grounded evidence and a usable packet? | Draft/candidate authors and substantive decision-bearing reports require review. Small factual lookups may use a documented manager source check. |
| Draft stage | Does the assembled skeleton faithfully support discussion? | Explicit open intent and conditional structure can pass; detailed executable contracts are not required. |
| Candidate stage | Does the assembled executable packet cover the assigned outcomes coherently? | Contracts, dependencies, standards, decisions and verification must be usable at this stage. |
| Planning release | Is the complete current package ready for owner approval? | Full required coverage and cross-SPEC seams; no silently invented necessary intent. |
| Integration evaluation | Does the prepared combined candidate satisfy the accepted integration unit on the exact proposed baseline? | Define this explicitly in Review and Merge; prior planning/build passes do not certify conflict resolutions or the combined candidate. |

Reuse clean-room discipline, not identical checklists at every level. Reviewers start in fresh sessions without inherited author/manager conversation or previous reviewer history. Give them the bounded assignment, original authority, current artifacts and raw evidence, not a preferred verdict. Use distinct reviewers at successive gates and fresh reviewers after repairs. Managers retain the findings ledger and reconcile reports afterward. Findings need violated authority or necessary missing intent, direct evidence, affected scope and concrete consequence. Speculative polish stays advisory.

A faithful partial investigation can pass report fidelity while its unanswered question still holds dependent work. A missing reviewer/runtime capability leaves the gate unmet; it does not permit self-certification. Stop after the first materially clean pass, preserve unaffected evidence, and checkpoint real owner/evidence/dependency waits instead of endlessly restarting them.

## Existing Review and Merge and remaining design

The current [skill](.agents/skills/mc-commit-supervisor/SKILL.md) and [thin profile](.codex/agents/mc-commit-supervisor.toml) already define bounded intake, preparation, required independent evaluation, owner wait and authorized publication receipts. [MC-T09](todo.md#mc-t09--build-the-commit-supervisor) remains open for the fuller workflow and isolated rehearsal. Extend those definitions instead of creating a competing Branch Manager authority.

Define a concrete assignment/return packet and checkpoint schema: accepted work IDs/SPEC grouping, exact source and target, dirty-input fingerprints, candidate identity/location, baseline history, applicable standards, writer ownership, prerequisite release evidence, actual checks, review findings/dispositions, permitted repairs and exact next action. Keep job reports separate from central monitoring state.

Consider bounded subordinate responsibilities only where they add useful separation: evidence/prerequisite investigation; preparation/conflict resolution; independent combined-candidate review. Decide which belong to the manager, which justify a child, and their write/delegation boundaries. Label proposed roles clearly until installed. Reuse existing investigator/reviewer capabilities when sufficient; do not add a profile merely for each checklist heading.

Make integration evaluation explicit. Define its authority/coverage lenses, exact candidate identity, reviewer independence, repair routing, pass/hold/incomplete outcomes and how changed inputs invalidate evidence. Keep planning release validation separate from code/integration review. New requirement-definition reports follow the planning worker-handoff rules; a planning verdict alone cannot validate an integrated code candidate.

The setup's [bounded Wiki handoff](.agents/skills/mc-commit-supervisor/references/wiki-handoff.md) now specifies integration reuse of the existing Wiki Research/Repair/Audit article procedures: settled source identity, original coverage beyond metadata, one leaf editor and a separate manager-assigned fresh documentation gate. The manual Wiki Supervisor and its broader worker delegation remain a separate manual invocation. Article preimages/metadata/timestamps, generated-block staging without operational state and source/page drift checks are explicit; factual scanning and tooling relocation remain separately scoped. Definition and disposable fixture evidence do not prove the later actual Wiki reviewer or running-app handoff.

When a missing capability or unspecified intent blocks integration, preserve the candidate and issue record, name the affected prerequisite/consumer, and return a bounded question or requirements investigation. Its evaluated report can become input to an owner-assigned Draft/Creation workflow and later implementation. The merge job waits with an observable release condition. Neither it nor MC manufactures an approved new SPEC or launches a prerequisite build just because a gap was found.

Resolve grouping and hold policy from accepted SPECs/dependencies: one completed SPEC is not always a complete integration unit, and unrelated SPECs need not wait without evidence. Account for incompatible/shared changes and consumer adoption. Do not impose a universal all-SPEC completion rule. Where policy truly needs owner intent, present the exact choice and consequence.

## Authority and coordination boundaries

D-023 is newer than the earlier Alert-Monitor proposal. `$mission-control` selects the coordination role; shared Status observes incremental work and Monitor manages recurrence. MC stops its whole cycle before announcing/performing a next action and on a tracked build completion, including Review and Merge dispatch. It does not automatically re-arm after the handoff. A supervisor's child cycle and mandatory per-SPEC owner checkpoint remain separate.

Review and Merge runs as a separate persistent same-memory-folder task when actually assigned. It neither becomes MC nor owns central monitor state. Verify task identity/CWD and existing writers before any actual job. Deduplicate by source work IDs, candidate fingerprint and target revision. An intentionally idle `waiting-owner` task must not be restarted as a failed run.

Preserve the owner gate **before any commit-producing operation or push**, including ordinary merge, cherry-pick and rebase. Preparation must not move a shared target branch or overwrite unrelated dirty work. Distinguish commit authority, push, PR creation, PR merge, landed integration and Alpha deployment; preparation/reviewer success supplies none of those approvals. After an authorized Fusion Studio GitHub push, follow repository instructions to ask about Alpha; do not update it automatically.

Report capability landed separately from consumer adoption. Record dependency release evidence and intended notification recipient; a bulletin is not delivered notification. Use only authorized communication routes. No standalone definition here grants messaging or task-creation authority outside the applicable assignment/tool contract.

## Read order and completion evidence

1. Current [AGENTS.md](AGENTS.md), [session contract](session-contract.md), and [D-021/D-022/D-023](decisions.md). Preserve newer scoped owner revisions.
2. This hierarchy and the [shared planning contract](.agents/skills/mc-roadmap-creator/references/planning-contract.md), especially validation/repair rules; [Planning Validator](.agents/skills/mc-planning-validation/SKILL.md) for handoff thresholds.
3. Existing Review and Merge skill/profile above, [MC-T09](todo.md#mc-t09--build-the-commit-supervisor), [assignment templates](record-templates.md), [investigation contract](investigation-contract.md), and [deployment status](deployment.md).
4. [Mission Control procedure](.agents/skills/mission-control/SKILL.md) for dispatch/cycle boundaries. Consult the existing implementation [supervisor](.agents/skills/mc-roadmap-implementation-supervisor/SKILL.md), [orchestrator](.agents/skills/mc-orchestrator/SKILL.md) and [builder](.agents/skills/mc-spec-slice-builder/SKILL.md) only to verify relevant integration boundaries.
5. For actual skill/profile edits use the installed Skill Creator guidance. Use [Memory Maintenance](.agents/skills/mc-memory-maintenance/SKILL.md) for record/index changes. Use the [conversation evidence contract](conversation-evidence.md) when a consequential intent claim needs original context; avoid broad product-code research for workflow setup.

Expected return: recreated inline hierarchy; final role/ownership/gate design; updated relevant local definitions and records; evidence that skill metadata, profiles, links and static index validate; explicit owner questions and untested behavior. An isolated rehearsal may be planned/exercised only within the receiving session's actual authorized scope and runtime limits. Do not claim live agent behavior from structural checks or mark MC-T09 complete without its demonstrated acceptance evidence.

During this handoff's preparation, D-022 planning definitions had passed structural checks, but live planning reviewers were not exercised. Review and Merge's existing behavior also remained unexercised. No live product candidate is selected by this handoff.
