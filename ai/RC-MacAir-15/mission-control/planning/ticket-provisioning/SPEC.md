# SPEC TP-001 — Template-based ticket provisioning and board mirroring

> Provisional candidate authored at the owner's request on October 7, 2026. Status: `CANDIDATE_AUTHORED`; independent planning review and implementation approval remain pending. This document specifies future work and creates no live workfolder, agent, timer, or product implementation.

Author: Codex side chat (ephemeral), 2026-10-08T02:35:21Z.

## 1. Objective and owner direction

Make one maintained template and a deterministic script responsible for preparing ticket workfolders. Before provisioning, a build's board seed supplies its description. After successful provisioning, the ticket owns the summary displayed by the HTML. Detailed evidence, decisions, assignment boundaries and review records remain in the workfolder.

The original owner direction in this side conversation is:

- “Could it work, to mirror the tope half of the ticket to the html?” The owner identifies checklist, prerequisites and coordination as shared content, with the remaining categories staying in the ticket.
- “We can treat html as \"seed source\" when making a new folder, then reverse ownership when the folder is created.”
- “What if we made folder replication into a script, and just got everything right in our template folder?”
- “Let's SPEC it out.” This authorizes this planning document, not implementation or the live pilot.

The template/seed/ticket ownership transition is `owner_decision`. The formats, filenames, CLI and recovery protocol below are proposed `implementation_choice` details of this candidate, not separately recorded owner approvals. This side conversation has no verified main-history UUID; it uses the visible post-boundary statements and inspected files, without registering or advancing a history cursor.

## 2. Sources, standards and current baseline

Controller home (`MC`): `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.

Repository (`REPO`): `/Users/rccurtrightjr./projects/fs-dev`, resolved with `git rev-parse --show-toplevel`. Read-only source HEAD: `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`. Relevant MC/template files are untracked in this checkout; HEAD alone does not identify their content. [INPUTS.json](INPUTS.json) records the exact input bytes and absolute paths. Recheck input freshness before execution; preserve concurrent edits rather than resetting them.

Board artifact directory (`BOARD`): `/Users/rccurtrightjr./.codex/visualizations/2026/10/07/01a115b3-5392-7d71-86f7-e9965319fde5`.

| Source | Established constraint or observation |
| --- | --- |
| `MC/AGENTS.md`, `MC/session-contract.md` | Side-chat boundaries; static indexes; no invented sessions; distinct preparation, review, implementation, acceptance and publication. D-023 governs current role/cycle behavior. |
| `MC/launchpad/template/{AGENTS.md,index.json,TICKET.md}` and sibling starter documents | Existing reusable structure. Index validation passes for nine content documents; inspected local links and referenced procedures resolve. No live checkpoint belongs in the template. |
| `MC/.agents/skills/mc-memory-maintenance/{SKILL.md,references/records.md,scripts/validate_index.py}` | Adapt local roles and paths, preserve source-to-destination ownership, validate sections and document roles. |
| `MC/ticket-workflow.md` | Proportionate ticket workflow and distinct evidence/intent/proposal records. Its historical D-004 activation sentence needs narrowly scoped reconciliation with current home instructions. |
| `MC/managers/workfolder-manager/{AGENTS.md,handoff.md}` | Workfolder management has an existing responsibility home. Catalog cutover and numbering remain separate pending work; do not create a competing central registry or allocator. |
| `BOARD/fusion-studio-timeline.html` | Scope, checklist and dependency descriptions are inline JavaScript. Checklist ticks are browser-local notes. Existing IDs are stable; planned order is #1 → #3 → #2 before parallel lanes. |
| `BOARD/*.workflow.json`, `BOARD/workflow-update.py`, `BOARD/workflow-ui.js`, `BOARD/HTML-UPDATER.md` | Existing status persistence, locking, atomic file replacement, embedded snapshots and periodically refreshed sidecars. Folder attachment currently records provisioning only; there is no ticket-summary importer. |
| `MC/launchpad/chat-harness-repair-and-testing/TICKET.md` | Upstream harness evidence and its own return point. This inspection is not a fresh completion or acceptance claim. |
| `REPO/ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` | Required chat source for the pilot. Visible thread groups and individual sessions have distinct identities; eager New Chat is current behavior and pending accepted-send creation remains future work. |

Applicable guidance, read for this candidate, is the active machine Wiki under `REPO/ai/RC-MacAir-15/Wiki/`:

- User Preferences: `000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md`.
- Code Standards hub: `005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`.
- Routed standards: sibling `001-Architecture_Routing/PAGE.md`, `002-Frontend_UI/PAGE.md`, `003-State_Management/PAGE.md`, `007-Persistence_And_Metadata/PAGE.md`, and `008-Testing_And_Smoke_Slices/PAGE.md`.

Apply existing-owner reuse, one durable owner, narrow file responsibilities, preserved history, recoverable projections, and public-entry/readback verification. The runtime-specific portions do not license bypasses: this SPEC changes local MC files and static previews only. No new Fusion server route, DB write, WebSocket message, UEB capability, provider adapter or installed app integration is designed here. Future runtime integration must use its then-current governed owners and standards; a local script is not that platform capability.

## 3. Scope, dependencies and exclusions

Deliver:

1. An explicit summary contract and provisionable template with declared variables and file roles.
2. A public local CLI for previewing, provisioning and synchronizing workfolders.
3. Board seed extraction/migration, ticket-owned description rendering and repeatable refresh.
4. Recovery and concurrency checks through the public CLI.
5. A disposable end-to-end pilot, followed by provisioning build #2 only under the approved implementation assignment.

Prerequisites for execution: current candidate review/approval, a writer assignment covering the MC helper/template and selected board artifacts, fresh source fingerprints, and an uncontested destination. Workfolder preparation may precede the upstream harness handoff. Chat Session Management product implementation still requires verified harness repairs, test outcomes and lifecycle/activation findings from build #3.

Exclude product chat implementation, new agent/session creation, checkpoint registration, autonomous scheduling, operational MC activation, central catalog/numbering migration, Git/worktree operations, publishing and Alpha operations. Do not retrofit existing live workfolders automatically. Do not build a browser-based ticket editor; the preview consumes persisted content. Direct agent/editor changes to the ticket remain supported through synchronization.

Coordinate ownership of `MC/launchpad/template/`, the Memory Maintenance helper area and `BOARD/` before execution. The board writer must preserve unrelated workflow observations and project definitions. No central registry, root index, root decisions or manager handoff is an incidental write target.

## 4. Ownership and shared summary contract

### 4.1 Template, seed, ticket and display

The template owns document structure and instructions, never live progress. A board seed owns a not-yet-provisioned build's initial summary. A successfully provisioned ticket owns subsequent summary content. Board JSON and HTML become projections for that build; retained seed snapshots are historical sources, not alternate editable authorities.

Introduce `BOARD/build-seeds.json` as the structured seed input for the existing board content. Migrate all existing description fields faithfully, including consumer prerequisites, existing-foundation prerequisites and coordination; preserve IDs, order, labels and graph relationships. Do not reinterpret seed prose as approved product intent. Remove migrated inline description/checklist/dependency arrays as production content owners; presentation aliases and graph layout may remain where they are.

Use the primary `BOARD/upcoming-builds.workflow.json` project record for summary-source binding. The two other existing board records mirror that binding and summary, while preserving their own workflow fields. This binding is a board-content pointer, not a new workfolder catalog or session registry.

Extend the existing board state/version handling through its normal writer. Migrate v1 states without discarding fields or observations; writers, snapshot readers and refresh callbacks must agree on the new version before live publication. Only the selected build's summary/provisioning fields change during cutover. Other workflow progress, threads, outcome, integration and evidence remain intact.

### 4.2 Ticket summary

Add the first indexed H2, `## Board Summary`, to `TICKET.md`. Bound its body by exactly one `<!-- ticket-summary:start -->` and `<!-- ticket-summary:end -->` pair. The block contains structured, readable Markdown; the parser reads only this defined block and never executes content.

Fields are schema version, unchanged native build ID, title, objective, checklist, prerequisites, consumer prerequisites, coordination and planned order. Each checklist item has a stable ticket-local ID, text and checked state. Dependency/coordination records have stable IDs, target kind (`build`, `source` or `none`), target locator and a condition/reason. Changing text or order never changes an existing ID. New records receive the next unused local ID; deleted IDs are not reassigned.

Use these exact labels/subsections: `Schema`, `Build ID`, `Title`; H3 `Objective`, `Checklist`, `Prerequisites`, `Consumer Prerequisites`, `Coordination`, `Planned Order`. Schema value is `ticket-summary/v1`. Checklist lines use `- [ ] TASK-001 — text` / `- [x] TASK-001 — text`. Dependency sections use numbered record bullets with indented bold-label `Kind`, `Target`, and `Condition` or `Reason` fields; an empty section uses `None identified in the current summary.` Required build targets must resolve to known seed/build IDs, not a guessed UUID. Renderers receive a validated JSON projection of these fields.

The remaining eight TICKET categories and sibling records retain their existing jobs. The summary links to accepted intent/decisions where available; changing it cannot manufacture owner approval. The checked state represents recorded checklist completion, not certification of verification, integration or acceptance. Preserve workflow-step icons and integration styling as their separate evidence-backed display contract.

For synchronization, compute a SHA-256 digest of the summary block and a whole-ticket digest. The projection records `sourceKind`, seed identity/revision, absolute ticket path when bound, summary digest, source whole-file digest and synchronization time. The primary binding retains the observed ID high-water marks and retired IDs for each summary-record namespace, so deleting the highest-numbered record cannot permit reuse. These are ticket-local record identities, not the separate global ticket-number allocator. Store changing values in the primary board binding and the generated folder's `PROVISIONING.json`, never in static `index.json`. Do not use summary refresh time as `lastProgressAt` or mark a workflow stage done from a checkbox.

### 4.3 Template preparation

Add `template-manifest.json` declaring a template version, allowlisted content/support files, optional extensions, permitted literal placeholders and the summary parser version. It contains no live paths, task IDs, cursors, locks, logs or secrets. Template copying follows this manifest, not an unrestricted recursive clone.

Declare project title, native build ID and relative controller/repository/wiki roots as explicit replacement values. Adapt local entry guidance and relative procedure links for the actual destination depth. Do not perform general search/replace across arbitrary project prose. Reject unresolved required placeholders or invalid generated links before publishing the folder.

The default provisioned set is the local AGENTS/index/BULLETIN, TICKET, CAPTURE, INTENT, DECISIONS, ISSUES, PROPOSALS and REFERENCES. REFERENCES has a substantive seed-source record. CHANGE_SURFACE and CONTRACTS are explicit optional extensions; if omitted, remove their index entries/dependencies consistently. Replace inert template titles/preambles and question prompts in live copies with source-backed content or honest not-yet-established state. Never fabricate decisions, findings, approvals or assigned identities to fill sections.

Populate TICKET's summary from the seed; CAPTURE points to the imported starting context, and REFERENCES records original artifact paths, seed revision/digests, import time and limitations. Detailed accepted intent remains not yet established unless the input includes an actual authority source. The seed's “Decide…”/“Design…” tasks remain open work. Do not import localStorage checklist ticks as completion evidence.

## 5. Public CLI and provisioning behavior

Place the durable public entry under `MC/.agents/skills/mc-memory-maintenance/scripts/ticket_workfolder.py`. Accept explicit absolute controller/template/board/destination roots, project ID and expected seed/binding revisions. Support:

- `plan`: validate inputs; return the seed, file/substitution plan, destination and predicted writes without creating directories, lock files, snapshots or sidecars.
- `provision`: perform the validated copy and ownership cutover; report whether created, already provisioned, or repair required.
- `sync`: reread a bound ticket, validate its summary and refresh all selected board projections. No template recopy or detailed-ticket rewrite.
- `watch`: explicitly started foreground synchronization loop over the primary board's bound tickets. Default interval two seconds; content digests prevent unchanged rewrites. It starts no agents/timers and exits on interruption. No watcher is implicitly launched by provisioning.

`provision --dry-run` is the same non-mutating operation as `plan`. `provision --resume` operates only on a matching durable provisioning receipt; it never treats an arbitrary existing directory as disposable. Commands return structured JSON with operation/build ID, source/output digests, actual changed paths, authoritative owner, projection disposition and next action. Required failures exit nonzero. A no-op retry exits successfully without creating another folder or marking progress.

Required option names are `--controller-home`, `--template`, `--board-root`, `--project`, `--destination`, `--expected-seed-revision`, `--expected-board-revision`, and `--extensions`. `plan`/`provision` require the project and destination; template defaults to the explicit controller home's `launchpad/template`. Write provisioning requires the two revisions returned by `plan`; resume verifies the receipt as well. `sync` requires one project; `watch` consumes the bound set and supports `--interval` (seconds). The implementation documentation uses this interface, for example:

```text
python3 /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/.agents/skills/mc-memory-maintenance/scripts/ticket_workfolder.py plan \
  --controller-home '/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control' \
  --board-root '/Users/rccurtrightjr./.codex/visualizations/2026/10/07/01a115b3-5392-7d71-86f7-e9965319fde5' \
  --project 2 \
  --destination '/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-session-management'
```

Roots in the published examples are caller inputs, not hardcoded runtime defaults. Source snapshots give the seed its revision; unknown authority is not inferred from that counter. A `plan` is neither a reserved destination nor authorization to execute it.

Proposed responsibility seams: the entry file parses commands; `ticket_summary.py` parses/validates/serializes summary content; `ticket_provisioning.py` owns folder preparation/recovery; `ticket_board.py` adapts validated summaries to the existing board writer. Avoid a generic template engine, event bus or service hierarchy. Keep each file focused and below the maintained size guidance where practicable.

### 5.1 Successful provisioning

1. Read and validate manifest, seed/build ID, current source binding, actual roots and destination. Check input fingerprints and expected revisions. Reject unsupported symlink/traversal targets and source/destination overlap rather than copying through them.
2. Acquire the operation's destination lease. The board adapter owns its existing lock internally: reread/validate there, release it before copying, then revalidate at the cutover write. Never hold that lock while invoking a command that reacquires it. All write commands use destination lease before board-writer lock; additional boards are handled separately in fixed board-ID order. The read-only plan does not acquire filesystem locks.
3. Copy the declared files into a private sibling staging directory, apply declared substitutions, import the summary/source reference and write `PROVISIONING.json`. Preserve an immutable snapshot of the seed used. Validate index, summary, allowed files, paths and unresolved placeholders. No template mutation occurs.
4. Publish the validated folder without replacing an existing destination. The receipt identifies this exact build, source/template fingerprints, destination and cutover disposition. A crash after this point is distinguishable from a foreign folder.
5. Through the existing board writer, atomically commit the primary project's ticket binding, imported summary and verified workfolder attachment. This is the summary ownership commit point. Provisioning marks only `workfolder-created`; it does not light other stages, register a main chat or release an implementation prerequisite.
6. Generate the primary display and mirror the summary/binding to the other selected existing boards under each writer lock. Mark the receipt complete or projection repair required. The primary binding is authoritative even if a derived board/render update fails.

### 5.2 Failure, retry and concurrency

- Before folder publication: failure leaves the seed authoritative and no published folder; remove only this operation's private staging files. Preserve the reusable template and other folders.
- After folder publication but before primary binding: report `FOLDER_READY_BINDING_PENDING`; seed remains authoritative. Resume verifies the matching receipt and present ticket bytes, then completes cutover. Never regenerate or overwrite the published ticket, including owner edits made while waiting. A changed seed/binding requires reconciliation of this candidate rather than silently importing newer content.
- After primary binding but before a derived output succeeds: report `TICKET_AUTHORITATIVE_PROJECTION_REPAIR_REQUIRED`. Retry renders from the current ticket/primary binding; never switch back to seed or remove the folder.
- Existing same-build, same-path binding: verify it and synchronize; do not clone again. Same build bound elsewhere, foreign existing destination, invalid/missing receipt or changed template after interrupted preparation produces a clear non-mutating conflict. A moved/missing bound ticket is reported for explicit reconciliation, with the previous binding/history retained.
- Ticket edits during sync: reread/hash before publishing; if the candidate source changed, retry from current bytes or report conflict. Patch summary fields into fresh board state under its existing lock and preserve concurrent workflow updates. Recheck expected revisions; never replace unrelated state from a stale snapshot.
- Malformed or identity-mismatched ticket summary: preserve the last valid projection, identify the validation error/source, and make no invented substitute. Do not fall back to the historical seed after cutover.

This protocol promises atomic individual file replacement and deterministic cross-file recovery, not a fictitious atomic transaction across folders and three boards. Failures and committed authority are explicit in CLI output and durable receipts.

## 6. Refresh, rendering and migration

Extend `BOARD/workflow-update.py` with summary cutover/synchronization commands using its existing lock, atomic writer and render owner. The durable CLI calls that adapter with validated data and expected revisions; it does not implement another unlocked board-state writer. Normal status commands preserve the new summary fields. Update HTML-UPDATER and status-agent instructions so status-only work cannot redefine description ownership.

The HTML reads the bound summary projection for title/description/checklist/prerequisites/coordination/order. It exposes a ticket link after provisioning. Preserve the horizontal lanes/rejoins, name-only cards, existing modal geometry/scrolling, hover workflow and exact Material Symbols/status semantics. Keep DOM text insertion safe; imported descriptions are data, not HTML or code.

Summary checklist ticks are read-only projections in the preview. Remove localStorage as their authoritative production path, retaining old browser notes untouched rather than importing or deleting them. No browser-to-filesystem write bridge is added. Authorized agents/editors can change the ticket and run `sync`; when `watch` is running, ordinary saved edits also propagate without a separate agent call. Synchronization is idempotent, and the existing sidecar refresh interval makes successfully synchronized changes visible within its next refresh, including an open modal.

Document how the owner/main session starts and stops the foreground watcher. “Live” means watcher/source synchronization is active plus browser refresh; browser polling alone does not read tickets. Without a watcher, explicit `sync` remains the refresh route. An interrupted watcher has no effect on ownership or durable content.

Seed migration first records original HTML digests and exact content inventory. Preserve all build definitions and non-summary fields; compare every migrated summary and relationship to the original source. Generate safe seed/projection snapshots for file-URL loading rather than requiring fetch permissions or a new server. When sources differ across the three boards, preserve their actual differences and report them; do not assume shared project numbers prove identical content. The primary seed is the Upcoming-Builds source unless the owner selects another source explicitly.

Existing attached live workfolders keep their prior bindings/status until separately adopted. During this migration, their descriptions may remain seed-owned with a visible legacy-source disposition; mere folder attachment is not proof that their tickets contain the new summary contract. Do not mass-edit them. This exception preserves current records and does not apply to newly provisioned folders. Future adoption checks the actual ticket and an explicit migration assignment, then uses the same cutover protocol.

## 7. Dependency-ordered slices and write ownership

| Slice | Observable deliverable | Owned areas | Smoke / release condition |
| --- | --- | --- | --- |
| S1 — Template and preview plan | Public `plan` returns a complete valid folder plan from a seed, with no filesystem writes. | Template manifest, declared placeholders, TICKET summary/index/entry contract; summary parser and read-only CLI path; narrow D-004 reference correction in ticket-workflow. | Valid template/index; summary round trip; omitted extension consistency; missing fields/paths rejected; dry-run tree and file hashes unchanged. |
| S2 — Seed-backed board descriptions | All three previews render validated seed summaries through the existing projection owner, preserving their original content and status. | BOARD seed file, workflow writer/readers/snapshots, summary rendering and updater documentation. | Every migrated item/relationship compared; local-file reload and open-modal refresh; status updates preserve summaries and vice versa; unsafe text stays literal. |
| S3 — Provision and ownership cutover | Public CLI creates a valid disposable ticket folder and switches that build from seed to ticket ownership. | Provisioning module/receipt, CLI write path, existing board cutover adapter and public-entry recovery tests. | New copy, no-op retry, collision and injected failure before/after commit; resume preserves edited tickets and unrelated state. S1/S2 accepted first. |
| S4 — Continuous mirror and pilot | Saved ticket summary edits reach each preview; build #2 can be provisioned by the same proven command. | Sync/watch path, operational instructions/tests and only the new pilot folder/selected #2 board fields during approved execution. | Direct-save watcher test, explicit-sync fallback, malformed/stale edit behavior, detailed-content preservation, clean watcher exit and full pilot checks. S3 accepted first. |

No parallel writers on shared helper/template/board files. Fresh builders own individual slice assignments; coordinate any mechanically necessary integration explicitly. A slice cannot declare ownership of central MC records, live sibling tickets or product code.

## 8. Acceptance and verification

The proposed automated entry suite is `MC/.agents/skills/mc-memory-maintenance/tests/test_ticket_workfolder.py`, exercising the CLI subprocess with disposable controller/template/board roots and real filesystem readback. Do not mock away copying, locks, atomic replacement, projection failure or recovery. Separate template/summary fixtures may support these tests, but helper-only passes cannot establish provisioning correctness.

| ID | Required assertion |
| --- | --- |
| A01 | Template index and declared paths validate; there are no live identities/cursors; optional-file omission produces a consistent index and contract. |
| A02 | `plan` and `provision --dry-run` create no files/directories/locks and change no input bytes, including failed validation. |
| A03 | Published folder contains the selected template documents, actual roots, faithful seed summary, source snapshot/receipt and substantive seed reference; unresolved required placeholders are absent. |
| A04 | Build ID and checklist/dependency IDs survive text edits and reordering. IDs are unique and deleted local IDs are not reused. |
| A05 | Only successful cutover switches the binding; only the provisioning step changes. No session/thread, stage completion, approval or prerequisite satisfaction is invented. |
| A06 | Same-build retry preserves ticket contents/history; foreign destination and conflicting binding fail without overwrites. |
| A07 | Inject failure before folder publication, after publication before primary binding, and after binding before other projections. Readback and resume establish the correct owner in every case, without duplicate folders. |
| A08 | Concurrent status/summary writers preserve both updates or reject stale input. Interrupted-operation recovery preserves owner edits already made to the published ticket. |
| A09 | Valid summary edits change each selected display; non-summary ticket edits and sibling-record edits are never overwritten and do not change the summary projection. |
| A10 | Invalid/mismatched/missing bound tickets retain last valid content and report error; no seed fallback or silent migration occurs. |
| A11 | All migrated seed content/relationships match their sources; each board's unrelated statuses, evidence and project definitions survive. Legacy localStorage ticks do not establish completion. |
| A12 | Names, prerequisites, checked items and ticket links refresh in open/closed modal and after reload; lanes, modal bounds, hover status/icons and committed-folder styling remain usable. Markup-looking text cannot execute. |
| A13 | Watcher notices ordinary saved changes, avoids unchanged rewrites, shuts down on interruption and reports errors; explicit sync works without it. No agent, app server, heartbeat or timer is started. |
| A14 | Live #2 pilot uses the same tested CLI, registers only its actual workfolder, leaves placeholder/warm-session choices unresolved, and leaves its harness execution prerequisite unfulfilled absent verified evidence. |

Required execution commands, from `MC`, after the corresponding implementation exists:

```text
python3 .agents/skills/mc-memory-maintenance/scripts/validate_index.py launchpad/template
python3 -m unittest discover -s .agents/skills/mc-memory-maintenance/tests -p 'test_ticket_*.py' -v
python3 .agents/skills/mc-memory-maintenance/scripts/ticket_workfolder.py --help
```

The CLI must provide complete runnable `plan`, disposable `provision`, `sync`, `watch`, `--resume` and live-pilot examples in `MC/.agents/skills/mc-memory-maintenance/references/ticket-provisioning.md`, using explicit roots/project IDs and quoted paths. Public-entry tests invoke these exact examples with disposable roots. Validate the new live folder using the existing index helper. Perform browser readback against disposable copied previews first, then the approved selected artifacts; report refresh latency, preserved UI behavior and actual evidence.

The approved live pilot targets `MC/launchpad/chat-session-management`, native build ID `2`. Reread the seed and destination immediately before invocation. Its summary retains the original task distinctions; especially, presaved New Chat DB placeholders and warm OpenCode sessions remain proposed choices. Include the Chat wiki and harness handoff as source pointers, without importing private conversations or assigning a main UUID. If the target already exists by execution time, do not overwrite it; use the existing-binding/reconciliation branch.

This SPEC changes no client/server runtime source. Client build, server suite and Electron/Alpha launches are not default verification for this scope. If implementation requires runtime code, treat that as a material scope/dependency change and obtain affected planning review before proceeding. Verification reports record exact candidate/input hashes, commands, outcomes, pre-existing warnings, tested recovery points and remaining limits. Do not claim these planned checks have already passed.

## 9. Documentation, adoption and final integration

Update template entry/index, Memory Maintenance usage and `references/ticket-provisioning.md`, the existing board updater/status instructions, and the ticket workflow's applicable source/ownership wording. Keep D-023 role selection distinct from provisioning. Do not rewrite unrelated central governance or canonical product Wiki as local tooling documentation.

The pilot's REFERENCES links the existing Chat overview and harness ticket; its substantive change surface/contracts remain a responsibility of its later project session. Future product/plugin-view provisioning is a separate consumer: it may reuse the explicit summary/provisioning contract only through an approved integration and identity/governance design. Do not claim this local helper implements Fusion's thread-created template capability or System protection.

Final integration requires A01–A14, coherent template/schema/writer/reader versions, all four accepted slices, source-backed migration and recovery reports, and the complete selected-board readback. Report every deviation and its code/document/consumer effect. Present the completed work for owner acceptance; publication and Alpha operations retain their separate gates.

For later approved execution, each slice receives one fresh `mc-spec-slice-builder`, which implements necessary integration, self-reviews, runs checks, records deviations and obtains a materially clean builder-owned review before returning `READY_FOR_ORCHESTRATOR_REVIEW`. It may spawn only fresh `clean-room-reviewer` reviewers, never another builder. The orchestrator independently inspects each slice with separate fresh reviewers; repair forward and stop at the first materially clean pass. Material repairs repeat the affected builder and orchestrator gates. Descendants inherit root model/effort; no arbitrary pass count certifies acceptance.

One approved SPEC can be assigned directly to `mc-orchestrator` or to `mc-roadmap-implementation-supervisor`; creator provenance is not an extra execution prerequisite. Planning worker-handoff, stage and release validation still remain distinct from owner implementation approval, final owner acceptance and Git publication. No following SPEC starts without its required owner checkpoint.

## 10. Authored handoff and remaining gates

The normative candidate set is this SPEC and INPUTS.json; CANDIDATE.json identifies their bytes. PLANNING.md is the mutable author/self-check handoff and is excluded from that set.

No new product decision is required merely to author this candidate. Structured Markdown, default optional-file policy, primary-board binding and the explicit foreground watcher are proposed technical choices for review. They do not claim prior owner approval or runtime feasibility proof. No required provisioning/mirror behavior is deferred; existing-live-folder adoption and runtime/browser editing remain the explicit excluded scopes above.

Next safe action: an authorized main planning manager checks source freshness, assigns independent worker-handoff review of this candidate, reconciles findings, then obtains separate fresh stage/release validation and exact-candidate owner approval before execution. This side chat cannot dispatch those reviewers and has not self-certified any gate. Read [PLANNING.md](PLANNING.md) for the actual self-check and review disposition.
