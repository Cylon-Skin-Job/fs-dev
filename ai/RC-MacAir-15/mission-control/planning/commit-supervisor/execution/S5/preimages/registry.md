# Mission Control Registry

**Home:** Mission Control working memory · **Parent:** [Plugin System](../Captures/030-Plugin_System/plugin-system-vision.md)
**Status:** live setup registry; imported outcomes identified below
**Updated:** 2026-10-03 (PDT)
**Trickle-down:** Mission Control charter · **Roll-up:** current work, dependencies and successor checkpoint

## Authority and editing

This Markdown file is the compact current-state index for Mission Control. It is not the source of product requirements, ticket text, SPEC evidence or owner decisions. Each row links to the source that owns those facts.

The owner manages ordinary setup/maintenance chats; the assigned chat records outcomes within its scope after checking for concurrent edits. D-023 keeps this home's default role a general assistant; $mission-control explicitly selects the coordinator. It uses shared Status/Monitor skills. One designated MC task owns central monitoring/dispatch state; supervisors own local cycle records. Review and Merge tasks return job reports without concurrently rewriting that state. Append coordination requiring other sessions to [bulletin.md](bulletin.md). Record durable owner choices in the designated decision source, then link them here.

State means the current assignment/workflow position, not quality, delivery or approval. Keep implementation, integration and owner acceptance explicit in their own columns. Use source-native IDs unchanged; never mint a duplicate SPEC or ticket ID to fit this registry.

## Workspace and session bindings

A workspace is a durable memory home, not a thread. Sessions may be replaced without renaming it. Record a verified session UUID only after registration; a historical thread reference is not the caller's identity. Product implementation checkout/worktree must be recorded separately from the memory CWD.

| Workspace ID | Role | Canonical CWD relative to this home | Current verified session | Writer / assignment |
|---|---|---|---|---|
| MC | General assistant home; one explicit Mission Control role | `.` | No controller task registered by D-023 setup | Owner-managed general tasks; MC owns monitoring/dispatch state after verified role selection. |
| chat-integration-and-retirement | Launchpad work folder | `launchpad/chat-integration-and-retirement/` | None; prepared folder only | Owner-selected CHAT-AR close-out home; [intake](launchpad/chat-integration-and-retirement/TICKET.md) links Capture 035 and accepted residuals. Main session unassigned. |
| plugin-foundation | Launchpad work folder | `launchpad/plugin-foundation/` | None; prepared folder only | Owner-selected early plugin foundation home; [intake](launchpad/plugin-foundation/TICKET.md) links Capture 030 and newer plug-ins vision. Main session unassigned. |
| governed-events-and-ledger | Launchpad work folder | `launchpad/governed-events-and-ledger/` | None; prepared folder only | Owner-selected shared event/ledger home; [intake](launchpad/governed-events-and-ledger/TICKET.md) links current Wiki and backend capture. Main session unassigned. |
| plugin-views-and-provisioning | Launchpad work folder | `launchpad/plugin-views-and-provisioning/` | None; prepared folder only | Owner-selected view definition/instance home; [intake](launchpad/plugin-views-and-provisioning/TICKET.md) links the newer plug-ins vision and Capture 029. Main session unassigned. |
| fusion-health-and-governed-observability | Launchpad work folder | `launchpad/fusion-health-and-governed-observability/` | None; prepared folder only | Existing owner-requested CHAT-AR follow-up home, now scoped to observations, rendering measurements and health consumer; [intake](launchpad/fusion-health-and-governed-observability/TICKET.md). Main session unassigned. |

`launchpad/template/` is not a workspace assignment. The five folders are prepared memory homes, not active Codex sessions or product build assignments. No checkpoint cursor, implementation worktree, roadmap or SPEC execution is registered by provisioning.

For each domain folder, record stable workspace ID, purpose, relative CWD, source Capture and import revision when a migration occurs, local AGENTS/index, main-session role and verified identity/host, assigned work IDs, writer ownership, report path, and any separate implementation checkout. Its side chats share that domain CWD; they are bounded contributors, not additional domain workspace registrations. Attribute side contributions without inventing their UUIDs. Check effective Full Access when registering a session.

### Mission Control ownership and monitor cycles

- **Definitions:** [Mission Control](.agents/skills/mission-control/SKILL.md), shared [Status](.agents/skills/status/SKILL.md)/[Monitor](.agents/skills/monitor/SKILL.md) and [Review and Merge](.agents/skills/mc-review-and-merge/SKILL.md) installed under D-023; runtime exercise pending.
- **Monitor task / host:** unregistered by this setup; no UUID asserted.
- **Role / schedule:** not selected or activated by this setup. No heartbeat created; automation ID and next wakeup remain unassigned.
- **Launch path evidence:** native project listing on 2026-10-04T03:26:55Z returned saved project `🖥️ Mission Control`, ID `54fe8ed4-5911-4033-8f65-7d0126a4f29c`, with this home's exact absolute path. Re-resolve it before task creation; actual child startup CWD is still unexercised.
- **Cycle/status checkpoint:** none created by setup. On invocation, link the owned cycle record and prior/latest Status. Retain task/automation identity, current cycle ID/scope, confirmed and desired schedule state, last check/progress, owner pause, end event/time and next responsible role. MC stops the entire cycle for any tracked build completion or next-action announcement/execution; supervisors pause for review and re-arm only after authorized child dispatch.
- **Turnover:** verify the predecessor is inactive and its heartbeat paused/transferred before replacement activation. An old schedule is not presumed stopped because a chat was archived.

Review dispatch records carry source work IDs, candidate revision/fingerprint, target branch/revision, job-report path, actual task ID and lifecycle. Record dispatch intent before creating a task; reconcile an uncertain creation before retrying. `waiting-owner` means the review task is intentionally idle before commit/push, not a recovery candidate.

## Mission Control setup tasks

| ID | Task | State | Assigned chat | Depends on | Result / next action |
|---|---|---|---|---|---|
| MC-T01 | Finalize Mission Control's charter | complete | Imported source record; session UUID unverified | — | Owner confirmed per-SPEC acceptance checkpoint and role hierarchy. Reflected in mission-control.md. |
| MC-T02 | Establish registry, bulletin and handoff records | complete | Imported source record; session UUID unverified | MC-T01 | Flat-Markdown registry, bulletin and assignment/checkpoint packet established; owner continued to the next TODO. |
| MC-T03 | Define MC domain and future-roadmap interface | complete | Imported source record; session UUID unverified | MC-T02 | Role routing and future roadmap intake in domain-routing.md; product roadmap assignments remain deferred. |
| MC-T04 | Adapt existing Launchpad domain agent and workflow | owner-deferred | Codex side chat (ephemeral); owner-directed template work | MC-T01, MC-T02, MC-T03 | D-007 local skills/profiles and v1 helper extraction created; runtime discovery, selected migration and continuity example remain open in deployment.md/template-review.md. No operational MC session launched. |
| MC-T05 | Build independent Release Validation profile | installed; exercise pending | Codex side chat (ephemeral), D-018 setup | MC-T01, MC-T02 | Planning validator/profile installed; independent behavioral exercise remains. |
| MC-T06 | Update SPEC/Roadmap Creator for First Draft and Release Validation | installed; exercise pending | Codex side chat (ephemeral), D-018/019 setup | MC-T05 | Creation Supervisor and standalone Draft Supervisor (D-019), shared stages, leaf authors and validators installed; structural checks complete, no live run. |
| MC-T07 | Build requirements-definition agent | queued | — | MC-T04, MC-T05, MC-T06 | — |
| MC-T08 | Build and pilot ticket sessions and reconciliation | queued | — | MC-T02, MC-T03, MC-T04 | — |
| MC-T09 | Build Commit Supervisor | reviewed SPEC ready to assign; implementation/rehearsal pending | Owner-directed planning, D-024; no persistent integration job UUID registered | Existing accepted integration prerequisites; D-021/D-023/D-024 | [Integrated workflow SPEC](planning/commit-supervisor/SPEC.md) passed separate worker/stage/release reviews; [planning/review record](planning/commit-supervisor/PLANNING.md) holds exact identity/next step. Replacement-role implementation and isolated rehearsal remain required. |
| MC-T10 | Build navigable HTML skeleton | queued | — | MC-T02, MC-T03 | — |
| MC-T11 | Assemble MC profile and rehearse turnover | instructions installed; exercise pending | Codex side chat (ephemeral), D-023 setup | D-023 role split | General-assistant AGENTS and explicit mission-control entry installed; successor/runtime rehearsal remains. |
| MC-T12 | Configure hourly monitoring and recovery | procedure installed; inactive | Codex side chat (ephemeral), D-023 setup | Assigned role and authorized cycle activation | Shared incremental Status and hourly Monitor with role-specific ends/resumption installed; no automation created. |

The first three completion records were imported from Capture 037; this migration did not independently replay their acceptance evidence. The MC-T02 home adaptation is recorded in decisions and changelog.

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
