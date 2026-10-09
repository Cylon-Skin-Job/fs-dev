# Mission Control — Resume here

## Current state

### S5 — Canonical Commit Supervisor installed; rehearsal pending

Recorded by Codex side chat (ephemeral), 2026-10-04T10:58:05.867587Z. [Owner-approved S1–S5 setup](planning/commit-supervisor/execution/approval-receipt.md) installs the sole [mc-commit-supervisor entry](.agents/skills/mc-commit-supervisor/SKILL.md) and subordinate review/repair routes. Historical Review and Merge names below describe earlier events. [Cutover evidence](planning/commit-supervisor/execution/S5/cutover-inventory.json) found no legacy job/writer/schedule needing transfer; no job IDs or intentional waits were renamed/restarted. [S5 report](planning/commit-supervisor/execution/S5-builder.md) is the setup evidence pointer. MC-T09 remains **installed; isolated rehearsal pending**. No operational MC role/timer, integration job, publication, acceptance cursor or Alpha action is created.


### 2026-10-03 — Latest role and cycle revision (D-023)

`$mission-control` now establishes the dedicated coordination role. `monitor` schedules hourly calls to shared `status`; it no longer selects Alert-Monitor. Status builds on prior reports, retaining valid progress/holds/unknowns with detailed SPEC/slice views and compact MC ticket summaries. MC stops its entire cycle before announcing/performing any next action and on any tracked build completion, including owner report or Review and Merge handoff. Other ongoing tickets remain visible; a new owner monitor directive is required to re-arm MC.

Roadmap Supervisors use the same skills for active orchestrators, pause while doing supervisor review/repair routing/next-step work or waiting for the owner, then resume a new cycle after authorized acknowledged child dispatch. Per-SPEC owner acceptance and Review and Merge's commit/push owner gate remain. Cycle records retain prior status and explicit end reasons; no live role, timer, task or Status snapshot was created by this setup. Read D-023 and deployment.md for current definitions and validation limits. D-022 and separate ticket/tools work remain unchanged.

### 2026-10-03 — Earlier role revision (D-021; activation superseded)

AGENTS.md now defaults to the general-purpose Mission Control Assistant. One intentionally selected Alert-Monitor owns monitoring; separate same-folder Review and Merge tasks prepare eligible completed builds and stop for the owner's approval before commit/push. Explicit-only local skills and the thin Review and Merge profile are installed. Registry/TODO/deployment distinguish installed definitions from unexercised runtime behavior. This setup does not start a timer, select a live persona, create a task or register a monitor UUID.

Native project listing confirmed the saved `🖥️ Mission Control` project uses this home's exact folder. Future task creation must re-resolve that project and verify the created task's actual startup CWD. Shared memory CWD and product checkout remain separate.

The owner manages handoff, archival, fresh task creation and pinning. In that fresh task, `/monitor` primes the persona (`$monitor` is the explicit skill entry if needed). A later intentional **monitor** directive enables one hourly thread heartbeat. Verify predecessor ownership and schedule before activation. Review tasks in `waiting-owner` are intentionally stopped; never restart or approve them on the owner's behalf. D-021 supersedes conflicting D-004 startup assumptions; earlier independent setup assignments below remain separate work.

The owner authorized this controller home and the existing TODO's adaptation to folder-bound Launchpad sessions. The charter, TODO, registry, domain routing and source references now live here. Capture 037 is retained; check source revisions before reconciling later changes. The root AGENTS.md is an entry contract, not a claim that MC-T11's full operational profile and rehearsal are finished.

MC-T01–03 were already marked complete in the imported records. The current MC-T02 follow-up established this home. MC-T04–12 remain open. Three future roadmap slots remain unassigned. No child session, product roadmap, integration job, checkpoint cursor or hourly automation was created. This side chat does not replace the parent Mission Control session.

The earlier universal D-004 launch hold is superseded by D-021/D-023. Setup still does not activate a role/timer or register a controller identity; those require the actual selected main task and supported runtime evidence.

The owner approved four distinct plugin-related Launchpad homes and added a separate CHAT-AR close-out home before parallel builds. [Registry workspace bindings](registry.md#workspace-and-session-bindings) now point to five prepared folders, including the earlier health folder. Their local TICKET/AGENTS/index packets record purpose, sources, cross-folder ownership and unresolved choices. No main session, product build, roadmap or monitoring was started by provisioning. The owner will settle exact scope, sequencing, installed plugin path, first proof and chat verification target within the folders. Accepted CHAT-AR work remains uncommitted in a dirty development checkout, so dependent implementation needs an exact baseline handoff; [chat close-out](launchpad/chat-integration-and-retirement/TICKET.md) owns that preparation.

The owner also authorized the separate First Draft role (D-008). Its definition and Creator intake boundary are installed; this is partial MC-T06 work, not completion of MC-T05/06. See [deployment.md](deployment.md) and the [First Draft procedure](.agents/skills/mc-first-draft/SKILL.md) for the candidate-slice format and progressive source/impact checks.

The shared [investigation contract](investigation-contract.md) is now defined under D-009 and linked from Launchpad, First Draft and the template. Launchpad selects bounded questions and incorporates separate reports; investigators supply evidence/options under the common contract. D-010 now gives the owner-designated main Launchpad session standing authority to dispatch and manage bounded investigators, including during construction, under the contract’s rules. Main domain sessions remain owner-managed and side-chat restrictions remain intact. Specialty profiles have not been installed or exercised; an available suitable general agent can receive the contract and specialty assignment.

D-011 adds [starter documents](launchpad/template/AGENTS.md#use-the-starter-documents-to-guide-discussion) with section prompts and record schemas. These recover the earlier five-document convention while including consequential ambiguity and missing intent in Issues. The template remains inert; owner-selected live folders are now prepared separately, with no history cursor advanced.

D-012 extends the starter pack with REFERENCES, CHANGE_SURFACE and CONTRACTS. They distinguish source kinds (including user quotes), code and non-code impact (including wiki), and guarantee authority versus observed adoption. Omit unused extension documents and index entries when adapting a live folder.

D-013 removes the personal Second Brain skill and adds [Document Sweep](.agents/skills/mc-document-sweep/SKILL.md). Launchpad uses it after material documentation batches/revisions and before planning handoff. It reviews document deltas, propagation and source coverage against a saved baseline, carrying gaps forward. Checkpoint stays an explicit history procedure. No live baseline or automation was created.

D-014 adds [TICKET.md](launchpad/template/TICKET.md) and the [ticket-session workflow](ticket-workflow.md): proportional repair/planning paths, review evidence in assignment directories, owner steering and MC oversight of unattended work. These are documented contracts; no live ticket or automation was started. MC-T08 now includes a bounded workflow pilot alongside reconciliation.

D-015 adds inline [Planning Preflight](.agents/skills/mc-preflight/SKILL.md) before First Draft or Roadmap Creation and updates the [role hierarchy](../Captures/037-Plugin_Integration_And_Parallel_Roadmaps/role-hierarchy-and-guardrails.md). It separates input readiness, stage Validation and independent Release Validation. The final role is now installed under D-018; its independent behavioral exercise remains MC-T05 work. No live preflight handoff or automation was activated.

D-016 adds the [conversation evidence contract](conversation-evidence.md), read-only tools in the existing session-hub-codex checkout and scoped MCP configuration. Agents can resolve an explicitly designated/registered main source, list CWD candidates, search recorded conversation text and read surrounding turns. PROPOSALS links to explicit DECISIONS; search/inference does not approve scope. Bounded CLI and MCP protocol checks passed; runtime injection into every session and live checkpoint registration remain unexercised.

D-018 rebuilds [Roadmap Creator](.agents/skills/mc-roadmap-creator/SKILL.md) into a Creation Supervisor with bounded stage orchestrators, leaf draft/candidate authors and independent stage/release validation. It accepts direct conversation/documents or a draft and does not require Launchpad. Planning definitions are installed; no product roadmap or agent run was started. Independent behavior exercises remain MC-T05/06 work.

D-019 installs the [First Draft Supervisor](.agents/skills/mc-draft-supervisor/SKILL.md), sharing the existing first-draft stage/author/validator chain. It returns an independently checked discussion draft and visible questions; it does not start Roadmap Creator. Definitions are installed; independent behavior remains unexercised.

## Next safe action

### Commit Supervisor SPEC — D-024

Current continuation: the assigned SPEC orchestrator accepts the current S5 packet, then performs approved S6 fixture preparation and isolated agent/runtime/recovery rehearsal. Use [execution ledger](planning/commit-supervisor/execution/slice-ledger.json) for accepted current revisions; setup acceptance does not approve any future integration candidate or Git operation. Earlier planning/creation paragraphs below retain their dates/provenance and no longer select the installed route.

The owner renamed the top-level Review and Merge role **Commit Supervisor** and requested [one integrated workflow SPEC](planning/commit-supervisor/SPEC.md), including appropriate clean-room gates. Its [planning record](planning/commit-supervisor/PLANNING.md) owns candidate identity and independent review status. The installed legacy identifiers remain until implementation. This assignment prepares the SPEC; MC-T09 stays open for workflow installation and isolated rehearsal. Use the reviewed candidate and record an owner implementation assignment before dispatching it. Existing commit/push, per-SPEC acceptance and D-023 cycle rules remain.

Planning completion, 2026-10-04T07:43:22Z: separate worker-handoff, candidate-stage and fresh [release review](planning/commit-supervisor/reports/release-review-1.md) passed with no material findings. Current candidate is ready for an owner implementation assignment through `$mc-orchestrator`; record that instruction as approval, without requesting a second confirmation. Six slices cover checkpoint/recovery, independent review/repair, Wiki, safe runtime, role migration/owner gate and actual agent/recovery rehearsal. Use the available Python 3.12 interpreter for `tomllib` checks. This is reviewed planning evidence, not installed workflow/runtime success.

### Review and Merge creation — separate owner-managed chat

Wiki protocol follow-up: [review-and-merge-design.md](review-and-merge-design.md) now identifies [the manual Wiki Update package](../Wiki/008-Workflows/002-Wiki_Update/PAGE.md), checked against its local instructions and session contract. It is distinct from Sync Wiki Context. The delegated handoff's proposed read-only source-hash freshness scan and script relocation remain separately scoped recommendations; no Wiki run, script change, automatic dispatch or new owner decision occurred. This closes the missing source reference without marking MC-T09 complete.

Owner-requested continuation: read [review-and-merge-handoff.md](review-and-merge-handoff.md). Recreate its full hierarchy inline first, then refine the existing Review and Merge skill/profile, integration evaluation and job records. The handoff distinguishes installed roles from proposed subordinate responsibilities and preserves D-022/D-023 plus the owner commit/push gate. This is workflow setup, not a live integration/monitor assignment; other continuation packets remain independently scoped. Recorded by Codex side chat (ephemeral), 2026-10-04T06:00:36Z.

### Latest role setup return point

In the fresh task at this home, invoke `$mission-control` and restore current assignments/report pointers from actual evidence. Selection does not schedule checks. A subsequent **monitor** directive enables/reuses one hourly Status cycle. Confirm predecessor ownership/schedule and the actual caller identity before registration. Stop confirmation must precede MC next actions/build-completion reports. Owner-managed archival/pinning remain separate. No existing timer was inspected or transferred in setup; runtime discovery/turnover is a launch step. Supervisors load D-023 plus their updated skill before an authorized roadmap run.

The ticket/tools split below is retained for its separately assigned scope. It does not block this general-assistant role or automatically launch either assignment.

### 2026-10-01 — Resume ticket workflow, skills and agent setup

**Current owner-selected continuation.** Prepare the next owner-managed setup session to change the ticket workflow, skills, profiles and supporting records. This handoff supersedes the earlier next-action paragraph below for this subject; it does not finish or replace unrelated MC setup tasks. Recorded by Codex side chat (ephemeral), 2026-10-02T00:04:16Z (2026-10-01 PDT). No verified side-chat UUID is asserted.

**Owner-directed split:** one continuation handles ticket work; a separate side chat evaluates tool use and protocols because Codex's built-in tools may now be sufficient. Updated by Codex side chat (ephemeral), 2026-10-02T00:07:07Z (2026-10-01 PDT). The two assignments below replace the earlier combined implementation sequence. Preparing these handoffs does not start either session.

#### Read first and restore intent

Read [D-020](decisions.md#d-020--owner-directed-ticket-changes-by-any-agent), [P-001](template-review.md#p-001--intake-shaping-and-numbered-ticket-conversations), the applicable [AGENTS.md](AGENTS.md), [ticket workflow](ticket-workflow.md), and the exact skill/profile being changed. Use [Memory Maintenance](.agents/skills/mc-memory-maintenance/SKILL.md) for folder/record operations and the installed Skill Creator procedure when actually editing a skill. Keep discovery bounded to this setup package and its relevant callers; product-code research and roadmap creation are not this assignment.

The owner's intended flow is intake → explicit checkpoint → fresh shaping session → one or several barebones tickets → separate parent discussions for ticket-scoped builds → side-chat checkpoints, support work and checklist contributions → refresh the broader conversation from durable results before returning to high-level discussion. The owner prefers this branching model to repeatedly feeding context into unrelated fresh chats.

Tickets remain mutable work boundaries. Any agent receiving the owner's request may add, revise, split, combine scope or close them without routing back through MC or a main session for repeat approval. An existing ticket can contribute part of its scope to an interim ticket, followed by another build ticket. Preserve the original intent, moved scope, remaining work and closure disposition. Shared-file coordination prevents write collisions; it is not an exclusive ticket-editing gate. This authority is settled; the remaining choices below must not reopen it.

#### State at this handoff

- This conversation saved P-001 in `template-review.md` and D-020 in `decisions.md`, and registered D-020's heading in the static index. Index validation passed. Existing live ticket scope/status, numbered filenames, allocation state and checkpoint boundaries have not been changed by the ticket-design work. No ticket-management skill/profile has been installed or run.
- Five live briefs were observed under `launchpad/`: `chat-integration-and-retirement`, `fusion-health-and-governed-observability`, `governed-events-and-ledger`, `plugin-foundation`, and `plugin-views-and-provisioning`, each currently using `TICKET.md`. Re-enumerate before migration to account for later work. `launchpad/template/TICKET.md` is inert and receives no live number.
- The owner requested numbering from `TICKET-10001.md`, adjustment of tickets across Mission Control, and a Bash command creating the next incremented ticket. The exact roster/storage convention and initial filename-to-number mapping are not yet adopted. Subsequent owner steering paused implementation so intent could be recorded and discussed; this turn authorizes handoff preparation.
- The personal `/Users/rccurtrightjr./.codex/skills/checkpoint/SKILL.md` now uses built-in `codex_app.read_thread`, native pagination and a state-only helper at `scripts/checkpoint_state.py`, with receipt guidance and six tested state-helper cases. The personal Launchpad startup guidance uses native identity verification and main-only startup registration. Those changes were made earlier in this side conversation; they are distinct from the unimplemented ticket migration.
- The local [mc-checkpoint](.agents/skills/mc-checkpoint/SKILL.md), [conversation evidence contract](conversation-evidence.md), [deployment record](deployment.md), and MCP exposure in [.codex/config.toml](.codex/config.toml) still describe/expose local database history recall. The local Launchpad has no `references/folder-startup.md` at the inspected path. Reconcile these local copies and callers with the newer native-reader rule; do not assume the personal-skill update already changed the MC package. Built-in tools supply recall; local tools may supply UUID candidates only.
- [Plan thread family view binding](codex://threads/01a0f9b4-eb49-7383-b46c-80af64a16b6b) acknowledged a hold on ticket mutations and returned a read-only assessment. It was then notified that numbering/migration also remain design-only. Inspect its latest activity before overlapping writes. The assessment supports the delivered CHAT-SIMPLE outcome while identifying residual work in the broader original intake; a merge does not automatically close that intake.
- The chat folder's existing history target is `01a0e6c9-e4e0-7872-9268-9a77a76f0c57` (Resume chat integration work). Read its current registry before any history work. Creating tickets or changing discussion sessions must not reset/rebind that registry as housekeeping.

#### Remaining design choices

Resolve only choices that affect the implementation: which parked conversation provides the high-level return point; how ticket parent sessions coexist with folder-wide shared-file ownership; where each parent history target/checkpoint state lives; the minimum roster and ticket/checklist shape; and where numbered files are stored. The earlier `tickets/<id>/TICKET.md` suggestion predates the owner's numbered-filename direction and is not binding. Keep filenames numbered even if ticket-specific evidence later warrants a subfolder.

Start tickets with number/title, purpose and scope, source intent/checkpoint, initial success conditions or questions, and a compact checklist/next action. Add detail as it is earned. Creating an intake ticket does not require a finished SPEC. Represent scope movement with source/destination links and explicit remaining obligations. Completed, superseded, duplicate and cancelled closures describe different outcomes; owner-directed closure must not imply undelivered work was delivered. Shared INTENT/DECISIONS/ISSUES remain authoritative with ticket applicability made clear.

#### Proposed ticket-management agent

The owner suggested a subagent that knows the rules, receives formatted instructions from the parent and performs ticket work. Candidate name: `mc-ticket-manager`. This is a proposal for a focused skill plus a thin profile, not a created or dispatched agent. Its absence must not prevent another agent from performing an owner-requested ticket edit directly using the same rules.

The caller supplies semantics and actual owner authority; the manager handles record mechanics, number allocation, ticket relations, provenance, routing and validation. It can create a basic ticket with open questions; it surfaces missing intent when the requested scope change cannot be represented honestly. It must not fill gaps by inventing product requirements, decide unrequested scope, approve implementation, claim semantic review from structural validation, or dispatch builds. Use one canonical rule source so direct and delegated edits behave alike.

Suggested request packet:

```text
Operation: create | revise | split | combine | close | reopen | checklist | reconcile
Owner request/source: exact instruction and verified locator when available
Controller home / target memory folder: absolute paths
Source ticket IDs/paths and expected revisions:
Requested outcome, scope additions/removals and exclusions:
Portions to move / destination or new ticket / remaining work:
Initial success conditions or unresolved intent:
Checklist changes and supporting evidence, if applicable:
Closure disposition, acceptance/verification evidence or explicit owner direction:
Dependencies, only where established:
Owned files / overlapping writer coordination:
Request identity for safe retry / return destination:
```

Use only fields relevant to the operation. Do not invent UUIDs or demand unavailable runtime identity to draft an ordinary intake. A request identity supports avoiding duplicate ticket creation after an uncertain outcome; it is not a conversation identity or a second ticket number.

The result should return ticket numbers/paths, a compact before/after scope map, changed links/checklist items, validation outcome, preserved residuals/open intent, and the next safe action. If a mutation fails, report what actually changed and whether a number was reserved; do not claim an all-or-nothing transaction unless the tooling implements one.

#### Handoff A — Numbered tickets and ticket-management workflow

**Purpose:** continue the ticket design with the owner, then implement the assigned ticket changes. Keep the barebones intake/shaping/ticket-parent model and D-020's direct editing authority. This assignment does not evaluate or replace conversation tools.

**Owned implementation surfaces when assigned:** `ticket-workflow.md`; `launchpad/template/TICKET.md` and its ticket-related guidance/index; the ticket roster and Bash allocation helper with focused fixtures; existing live ticket files and their migration/link/index updates; and a proposed new `mc-ticket-manager` skill/profile definition if the owner adopts it. Ticket-specific guidance in live local AGENTS may be updated while preserving startup/history rules. Re-read current files, identify active writers and preserve unrelated edits before modifying them.

**Work:**

1. Settle the smallest roster/storage/checklist choices needed to implement ticket operations. The owner's numbering direction starts at `TICKET-10001.md` across MC; make an explicit initial mapping rather than silently deriving it from titles or chat identities. Do not reopen the settled rule that any agent can act on the owner's ticket request.
2. Define creation, revision, split/combine, checklist and closure records from the request/result packet above. Preserve source intent, scope movement, residuals and closure dispositions. Ticket creation may retain open questions without requiring SPEC detail.
3. Implement the Bash entrypoint with locked allocation, collision rejection, durable reservation and safe retry/recovery. Never reuse retired/reserved IDs or overwrite existing tickets. Keep roster changes coordinated; structural tooling must not invent semantic scope or acceptance.
4. Re-enumerate live tickets, migrate their filenames with an old-path → numbered-path receipt, repair live references/index paths, and preserve original work IDs and evidence. Identify immutable reports/fingerprints before changing them. Renaming does not close or narrow a ticket; the reusable template receives no live number.
5. If adopted, implement the focused manager skill and thin profile while retaining direct use of the same rules. Return its proposed config mapping for parent integration. Do not spawn a test agent from a side conversation; actual profile availability/execution must be tested only in a permitted session.
6. Validate affected indexes/links and focused fixtures for simultaneous allocation, collisions, failed/retried creation, splits with residuals, closure without false delivery, and preserved checkpoint files. Return actual results and remaining limits.

**Return:** create a substantive `ticket-workflow-setup-report.md` in this MC home when there is a result. Include changed files, migration map, request/result examples, test evidence, open choices and proposed changes to parent-owned shared files. This report filename is an allocated deliverable, not an existing file or ticket identity. Register it only through the designated shared-index writer.

**Prompt for the ticket continuation:**

```text
Take Handoff A in /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/handoff.md. Read D-020 and P-001, restore the owner's intake → checkpoint → shaping → small numbered tickets → ticket-parent/side-chat model, and continue ticket-workflow setup with me. Handle numbered ticket rules, the Bash allocator, live-ticket migration and the proposed ticket-manager skill/profile within the agreed scope. Preserve intent, residuals and existing evidence; any agent can edit tickets at my request. Follow Handoff A's file ownership and return shared-file changes for parent integration. Tool/protocol evaluation belongs to Handoff B; do not change checkpoint sources or Codex tool configuration here. Keep research scoped to the workflow package and follow this session's actual side-chat restrictions.
```

#### Handoff B — Evaluate Codex tools and conversation protocols

**Purpose:** independently assess whether built-in Codex tools cover the actual MC workflow and recommend the minimum remaining custom support. The owner believes the internal tools may now be sufficient; test that claim against the requirements rather than preserving old infrastructure by default. Evaluation and a concrete protocol recommendation come first; do not silently turn this assignment into a tool/config migration.

**Owned write surface:** a substantive `tool-protocol-evaluation-report.md` in this MC home when findings exist. Existing skills, profiles, configuration, ticket files, registries and source databases are read-only for this evaluation. Proposed replacements/patches may be included in the report, with exact targets, for later assigned integration. The report filename is an allocated deliverable, not a placeholder to create now.

**Read only what matters:** the native-reader state above; `conversation-evidence.md`; local `mc-checkpoint` and Launchpad/startup callers; the personal Checkpoint/Launchpad changes; relevant portions of `.codex/config.toml`, `session-contract.md` and `deployment.md`; and current descriptions/schemas of the actually available built-in tools. Keep the evaluation out of product source. Do not assume tools exposed to this chat are exposed identically to every session type.

**Evaluate:**

1. Map the workflow's needs to built-in task listing, `read_thread`, status/wait, messaging and task/session tools actually available. Separate capability coverage from authorization and from what was exercised. Use bounded read-only probes on explicitly identified tasks; do not create/message/archive tasks, dispatch agents or advance history merely to test availability.
2. Check UUID discovery versus proof of caller/main identity, main versus side conversation visibility, history continuity and opaque pagination, turn boundaries/statuses, output summaries/truncation, focused source attribution, and stable checkpoint boundaries. A shared CWD or title remains a candidate, not proof of identity. Report inaccessible/ephemeral conversation limits honestly.
3. Define protocols for parked high-level chats, multiple ticket parents and bounded side contributions: verified source addresses, source selection, checkpoint registration/state location, explicit history reads, report return and owner-directed messaging. Keep ticket identity, conversation identity, source authority and writer ownership distinct.
4. Assess what built-in tools replace in the local MCP/CLI history reader. Native `read_thread` is the selected recall path; optional local UUID lookup is not a recall fallback. Identify whether UUID lookup still adds anything over native listing, and whether the state-only checkpoint helper remains necessary for local durable state. Built-in history access does not itself imply file/index management or an atomic ticket allocator.
5. Return a requirement → built-in tool/protocol → observed evidence/limitation → needed custom support table. Classify custom pieces as retain, narrow, retire or unresolved, with exact affected skills/config/callers and proposed changes. Preserve existing registry/cursor provenance; do not recommend resetting history to accommodate a new tool.

**Return:** an evidence-backed evaluation, proposed protocol edits and a scoped cutover plan with validation criteria. Name any ticket-history decisions Handoff A must defer, plus sufficient defaults for ticket work to proceed independently. Actual mutations outside the report require a subsequent owner assignment; the evaluation should make that work concrete and reviewable without requiring another broad discovery pass.

**Prompt for the tools side chat:**

```text
Take Handoff B in /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/handoff.md. Evaluate Codex's built-in tools and the protocols needed for our intake, checkpoint, shaping, ticket-parent and side-chat workflow. Native tools appear sufficient now; determine what custom tooling can be retired or narrowed and what local state/record helpers still earn their place. Use current tool schemas and bounded read-only probes, and write tool-protocol-evaluation-report.md with findings, limitations and concrete proposed edits. Existing tickets, skills, configuration, registries and databases remain read-only in this evaluation. Do not spawn agents, send test messages, create tasks or advance checkpoints. Follow the handoff's ownership split; Handoff A owns ticket implementation.
```

#### Parallel work and parent integration

Neither assignment is alone in the workspace. Preserve other sessions' changes and do not revert them. A owns ticket implementation; B owns its evaluation report. Neither writes the other's deliverable. Do not create either report as an empty placeholder.

The resuming parent/setup integrator owns changes to shared `handoff.md`, `decisions.md`, `template-review.md`, root `index.json`/AGENTS, `deployment.md`, `session-contract.md`, existing shared Launchpad/Memory Maintenance skill files, and `.codex/config.toml`. Both assignments return exact proposed edits for these targets instead of racing to write them. A's new manager profile may require an `[agents]` mapping; B may recommend changes to `[mcp_servers]`. One integrator applies both to the shared config. This is file coordination, not a restriction on D-020's owner-directed ticket operations; a later explicit reassignment may change ownership.

Ticket design, allocation fixtures and migration preparation can proceed while tool evaluation runs. A leaves checkpoint registration/history implementation to B's protocol findings and the integrator; no need to hold unrelated ticket work. Before a live rename, check active readers/writers and coordinate the cutover. After both return, the parent reconciles any affected links/source revisions, adopts or resolves material protocol choices, applies assigned skill/config changes, validates the package and records actual deployment/runtime limits. Document Sweep follows the applicable permitted workflow after meaningful integration; do not claim a prohibited independent agent run occurred.

The deliverables concern workflow setup. No product implementation, Mission Control activation, timer or live agent run is created by this handoff split.

### Earlier setup return point — retained context

The owner deferred Launchpad use and selected the D-018 Roadmap Creator rebuild. That installation and the D-019 standalone Draft Supervisor are complete; a future owner-managed session may exercise the new MC-T05/06 chain or work on another selected setup item. Return to MC-T04 and [template-review.md](template-review.md) when the owner chooses Launchpad. The template now defines the main domain session and bounded support side-chat roles (D-005). The [skills and agents inventory](skills-and-agents.md) is now available. Second Brain is legacy v1 (D-006); the approved local profiles/skills and extracted record helpers are now created (D-007). Read [deployment.md](deployment.md) for exact paths and validation status. The [domain-routing contract](domain-routing.md#governing-sessions-in-subordinate-folders) now separates shared role definitions, worker CWDs, session registration and MC governance. Namespaced automatic skill discovery has been confirmed by prompt rendering. Remaining work includes profile/explicit-skill activation checks, a verified folder-bound launch mechanism, a selected legacy-Capture migration and a bounded continuity example. The five prepared folders are source-linked; they are not a completed bulk migration or live continuity exercise. Do not launch all remaining tasks. The owner-assigned setup chat checks for concurrent edits and reconciles relevant Capture 037 updates before changing central records. Defer the first controller’s identity registration and registry ownership to launch after the system is fully built.

## Entry packet and open work

Read [decisions.md](decisions.md), [registry.md](registry.md), unresolved [bulletin.md](bulletin.md) and the relevant [TODO](todo.md) entry. [record-templates.md](record-templates.md) defines assignment/report/hold/resume fields. Existing integration and ticket research remain linked in [source-map.md](source-map.md); their historic snapshots are not fresh checks.

Full Access defaults are saved locally; effective settings in a newly launched controller/child session have not been exercised. Local skill discovery is documented in [codex-context.md](codex-context.md). Sixteen local skills and nine namespaced profiles are now created; no agent session was started.
