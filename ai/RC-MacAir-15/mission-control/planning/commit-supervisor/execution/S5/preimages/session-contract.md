# Session and execution contract

## Identify the assignment

Resolve the absolute controller home from the assignment or the unique applicable MC ancestor containing this file and its local skills. Record the exact memory folder, assigned work ID and role, manager, report path and separate implementation checkout. Read applicable instructions at both locations. A memory CWD is not permission to edit the nearest repository checkout by accident. The role’s skill is the authoritative procedure; do not infer scope from a profile name.

Main domain sessions and side chats obey their local two-role contract. Runtime child IDs and persistent task UUIDs are distinct; record the correct kind. A skill or custom profile does not launch itself, set CWD, change a session’s identity or make a bulletin into a messaging service.

Follow [conversation-evidence.md](conversation-evidence.md) when source intent is unclear. Assignments carry the designated main history thread/host and checkpoint path when known, separately from the worker identity. Resolve conflicts or ambiguous CWD matches without inventing a role; read-only evidence lookup does not register a task, advance a cursor or require Checkpoint invocation.

## Assign and return

Use the packet in [record-templates.md](record-templates.md). Include absolute controller_home and memory-folder paths, implementation checkout/branch if applicable, source revisions, exact local skill path, named profile when spawning, accepted prerequisites, write ownership, stopping conditions and report destination. Confirm actual CWD and applicable instructions before writes. An assigned worker acknowledges role, scope and first action.

MC coordinates roadmap dependencies; the supervisor owns its SPEC chain; the orchestrator owns its slice chain. Direct owner direction remains authoritative. Return changed files, checks, evidence, deviations, unresolved intent and next safe action without rewriting central registry state outside the assignment. Owner acceptance remains mandatory between SPECs. A hold request requires acknowledgment or authorized interruption before reallocating the writer.

D-023 keeps ordinary sessions as general assistants and explicitly selects the Mission Control role through `$mission-control`. MC may assign persistent same-folder Review and Merge tasks for eligible completed builds after its cycle is confirmed paused. Include exact skill, candidate/target revisions, job-report ownership, prerequisites and stop before commit/push. Verify created-task CWD. Review and Merge returns `waiting-owner`; no controller/monitor may approve publication or restart that expected wait.

Use the shared `status` and `monitor` skills for incremental observation and hourly cycles. Status is read/record/report work, not dispatch or approval. MC stops the whole cycle before informing the owner of any next action or performing one, and on any tracked build completion; other ongoing tickets remain in its report. MC requires a new owner directive to re-arm. Supervisors pause during their own review/next-step selection/owner wait and resume a new cycle only after acknowledged authorized child dispatch. Preserve per-SPEC owner acceptance. Cycle records include ownership, scope, actual/desired schedule state, previous/latest Status pointers and explicit end reason; report paths are separately owned per role/job.

For pre-roadmap research and reconciliation, use the [investigation contract](investigation-contract.md). Launchpad owns questions, assignments and synthesis; specialists return bounded evidence and options. Its packet extends the common fields above. D-010 grants the owner-designated main Launchpad session standing authority to dispatch and manage its bounded investigators; it does not grant shared-document writing rights, side-chat delegation or product execution authority.

For an authorized planning run, use the [shared planning contract](.agents/skills/mc-roadmap-creator/references/planning-contract.md): `mc-roadmap-creation-supervisor` runs the public creator skill, `mc-planning-stage-orchestrator` manages one stage, `mc-first-draft` or `mc-roadmap-author` owns the output, and `mc-planning-validator` independently evaluates it in the assigned mode. The creation supervisor owns approval routing; the existing `mc-roadmap-supervisor` owns later implementation. Launchpad is not required for direct planning. Installation does not authorize a run. For a standalone draft-only job, `mc-draft-supervisor` owns discussion handoff and assigns the same first-draft stage; `mc-first-draft` remains its leaf author. Neither a validated draft nor owner feedback starts executable planning automatically.

## Runtime and portability

Use local `mc-first-draft`, `mc-roadmap-supervisor`, `mc-spec-orchestrator` and `mc-spec-slice-builder` profiles for the corresponding spawned roles. The shared global `clean-room-reviewer` remains a dependency; verify it is available before a required gate. A main supervisor can run its skill without a TOML spawn. Role definitions do not provision a folder-bound session; use a supported launch path and verify it. Do not launch agents in a side conversation where delegation is prohibited.

Preserve the invoking root model/effort. Profiles inherit session permissions and local Full Access defaults; verify actual host settings rather than inferring them from a file. Check actual delegation capacity/depth before a build. Do not pin models or raise global limits as part of installing this package.

A build session outside this directory ancestry needs an explicit absolute procedure source and appropriate runtime profile deployment. Do not assume a shell `cd` reloads startup instructions or inherited skill discovery. The present package config is scoped to trusted MC/descendant launch contexts, not every checkout on the machine.

## Construction and recovery

D-023 replaces the Alert-Monitor mapping with the explicit Mission Control role and shared Status/Monitor skills. Setup does not select a role, enable a timer, dispatch work or complete runtime validation. Check existing writers, valid evidence and unfinished action before resuming; preserve identity/cursor provenance and accepted progress across replacement tasks/cycles. Pause the predecessor's heartbeat before transferring ownership. One heartbeat per owning task is reused across cycles; supervisors' local records remain separate from MC's central records. A pause failure is unconfirmed stopping, not permission to dispatch a duplicate action.
