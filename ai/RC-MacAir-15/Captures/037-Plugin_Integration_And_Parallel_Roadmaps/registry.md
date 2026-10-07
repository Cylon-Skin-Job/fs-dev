# Mission Control Registry

**Capture:** Mission Control working memory · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** proposed registry, seeded for setup tasks only
**Updated:** 2026-09-24 (PDT)
**Trickle-down:** Mission Control charter · **Roll-up:** current work, dependencies and successor checkpoint

## Authority and editing

This Markdown file is the proposed compact current-state index for Mission Control. It is not the source of product requirements, ticket text, SPEC evidence or owner decisions. Each row links to the source that owns those facts.

During setup, the owner manages chats and reports outcomes here. In a later operating mode, the designated Mission Control session maintains current rows. Assigned agents return their results and do not concurrently rewrite the central registry. Append coordination requiring other sessions to [bulletin.md](bulletin.md). Record durable owner choices in the designated decision source, then link them here.

State means the current assignment/workflow position, not quality, delivery or approval. Keep implementation, integration and owner acceptance explicit in their own columns. Use source-native IDs unchanged; never mint a duplicate SPEC or ticket ID to fit this registry.

## Mission Control setup tasks

| ID | Task | State | Assigned chat | Depends on | Result / next action |
|---|---|---|---|---|---|
| MC-T01 | Finalize Mission Control's charter | complete | This owner-managed session; thread ID to be recorded when available | — | Owner confirmed per-SPEC acceptance checkpoint and role hierarchy. Reflected in mission-control.md. |
| MC-T02 | Establish registry, bulletin and handoff records | complete | This owner-managed session; thread ID to be recorded when available | MC-T01 | Flat-Markdown registry, bulletin and assignment/checkpoint packet established; owner continued to the next TODO. |
| MC-T03 | Define MC domain and future-roadmap interface | complete | This owner-managed session; thread ID to be recorded when available | MC-T02 | Role routing and future roadmap intake in domain-routing.md; product roadmap assignments remain deferred. |
| MC-T04 | Build domain-agent profile and Capture workflow | queued | — | MC-T01, MC-T02, MC-T03 | — |
| MC-T05 | Build independent Preflight profile | queued | — | MC-T01, MC-T02 | — |
| MC-T06 | Update SPEC/Roadmap Creator for First Draft and Preflight | queued | — | MC-T05 | — |
| MC-T07 | Build requirements-definition agent | queued | — | MC-T04, MC-T05, MC-T06 | — |
| MC-T08 | Build and pilot ticket reconciliation | queued | — | MC-T02, MC-T03, MC-T04 | — |
| MC-T09 | Build Branch/Integration agent | queued | — | MC-T01, MC-T02, MC-T05, MC-T07 | — |
| MC-T10 | Build navigable HTML skeleton | queued | — | MC-T02, MC-T03 | — |
| MC-T11 | Assemble MC profile and rehearse turnover | queued | — | MC-T01 through MC-T10 | — |
| MC-T12 | Configure hourly monitoring and recovery | queued | — | MC-T11 | — |

The separate TODO remains the task-scope/checklist source. This table records current state and handoff only; synchronize the task state there after owner-managed chats return results.

## Roadmap slots

Mission Control's own system is the current project. These are placeholders in its future input interface, not active product-roadmap work. Roadmap subjects and owners will be chosen and assigned after MC is ready; do not treat the blank slots as blocked MC-T02/03 work.

| Slot | Roadmap ID and name | Authoritative source | Supervisor chat | Current milestone/SPEC | State checked | Last evidence/source revision | Dependencies / next action |
|---|---|---|---|---|---|---|---|
| R1 | Unassigned | — | — | — | Not started | — | Future input; owner chooses after MC is ready. |
| R2 | Unassigned | — | — | — | Not started | — | Future input; owner chooses after MC is ready. |
| R3 | Unassigned | — | — | — | Not started | — | Future input; owner chooses after MC is ready. |

## Active assignments and integration

Add a row only when an owner-managed chat or later authorized MC session has actually been assigned. Use the source-native work ID and link its scope/checkpoint. Do not copy full plans or reports here.

| Work ID | Kind | Parent/roadmap | Assigned chat/session | State | Input/candidate revision | Blocking dependencies | Evidence/report | Next action / owner |
|---|---|---|---|---|---|---|---|---|
| — | No active roadmap assignments recorded | — | — | — | — | — | — | Populate only from verified assignment. |

### Assignment and resumption packet

For each actual assignment, retain these fields in its row or link a compact handoff containing them:

- **Assignment ID and scope:** source-native work ID, bounded question/outcome, owned write area and explicit exclusions.
- **Authority and inputs:** assigning owner, applicable decisions/instructions, source paths and revisions.
- **Ownership:** responsible role/person, Codex task/session ID when one exists, and active-writer check.
- **Dependencies:** required IDs, exact condition for release, affected consumers and current hold owner.
- **Evidence:** acceptance criteria, checks run, results, reports, deviations and remaining uncertainty.
- **Checkpoint:** last completed action, candidate/current revision, next safe action, and work that must not be repeated.
- **Lifecycle:** current state, last checked, last progress and transition evidence.

A returning agent or replacement reads the same packet before acting. A waiting assignment can have no active session. No one should infer an assignment/session ID that has not been created.

## State and evidence conventions

For assignments, use `queued`, `assigned`, `active`, `waiting-owner`, `waiting-dependency`, `review`, `ready`, `complete`, `cancelled` or `failed`, and use the source's exact term where an existing roadmap has a normative status vocabulary. `failed` means execution failed; a waiting task is not failed.

In reports, distinguish:

- **Implementation:** not started / active / reported complete / verified under named checks.
- **Integration:** not selected / preparing / PR ready / landed, with revision.
- **Acceptance:** pending / accepted, with the authority and receipt reference.
- **Adoption:** pending / confirmed for each consumer that depends on the new baseline.

For any periodically checked item, `State checked` is when the cited source status was last actually inspected. `Last progress` is the latest evidence of changed work. Do not infer status from an old registry row, an earlier chat summary or file location.
