# Shared planning contract

This contract governs standalone First Draft supervision and roadmap creation, their shared stage orchestrators, authors and validators. It does not replace the separate approved-SPEC implementation gates. Read it with the assigned procedure and `<controller_home>/session-contract.md`.

## Roles and ownership

| Responsibility | Procedure | Local profile |
|---|---|---|
| Draft-only continuity, acceptance/routing and discussion handoff | `mc-draft-supervisor` | `mc-draft-supervisor` |
| Creation continuity, acceptance/routing and owner handoff | `mc-roadmap-creator` | `mc-roadmap-creation-supervisor` |
| One bounded stage, its specialists, writer and validation | `mc-planning-stage` | `mc-planning-stage-orchestrator` |
| Provisional skeleton and questions | `mc-first-draft` | `mc-first-draft` |
| Executable roadmap/SPEC candidate authoring | `mc-roadmap-author` | `mc-roadmap-author` |
| Independent worker-handoff, draft, candidate-stage or release validation | `mc-planning-validation` | `mc-planning-validator` |

The owner assigns the main planning session. Within an authorized planning run, its supervisor may assign stage work and reviewers using available delegation tools; stages may assign bounded specialists, one author and validators. Follow actual runtime and session restrictions. This does not authorize starting unrelated persistent tasks, operational MC, implementation, remote Git, or side-chat delegation. A user request to install/rebuild these definitions is not a planning run.

Use a runtime child when supported; use another persistent task only when the owner explicitly authorized that task creation and the tool supports it. Give an owner-managed session the same packet when requested. Verify the effective role/CWD; naming a subfolder does not launch there. Profiles inherit root model/effort and permissions. Do not raise global depth or concurrency settings. If a named profile is unavailable, an available general agent may receive its full role/skill contract within existing delegation authority. If no independent reviewer can run, preserve the candidate and report the missing gate; never self-certify it.

The supervisor owns coordination records and the appropriate owner-facing return: discussion handoff for draft-only work, or eventual exact-candidate approval request for executable planning. A Draft Supervisor uses only the shared first-draft stage; a Creation Supervisor assigns that stage directly when needed, without nesting supervisors. A stage owns its stage report and assignments; its single author owns the named draft/bundle. Investigators own only their reports. Validators inspect sources and write only their assigned review report; they neither repair nor approve the candidate. Prefer independent research in parallel, followed by author synthesis. Separate author areas require explicit disjoint ownership and one integration writer. Source read access is shared; write authority is not.

## Inputs and source authority

Accept a prepared First Draft, existing SPEC/roadmap, or conversation plus documents. Launchpad and a historical preflight report are optional entry sources, not prerequisites for an explicitly authorized direct planning task. Check missing inputs proportionately with inline `mc-preflight`. A simple settled packet may bypass draft generation; record its intake acceptance and preserved questions. Do not manufacture multiple SPECs or a shaping ceremony.

Every assignment carries:

- Planning ID/revision, role/stage, outcome and excluded scope; `controller_home`, memory/output folder and separate read-only source checkout/branch.
- Governing owner instructions, intent/decision/proposal links, exact input paths and revisions/hashes, known gaps and previously accepted stage evidence.
- Current User Preferences, Code Standards hub and routed articles, required domain overview, applicable approved contracts and explicit supersessions.
- Assigned writer/report paths, accountable manager, validation mode/coverage, dependencies, allowed operations and stop conditions.
- Known main history thread/host or checkpoint path, available conversation locators and missing-history limits; runtime child/task identity only after verified dispatch.

Use the current machine-scoped Fusion Wiki when applicable: `Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md` and `Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Authors and validators read the router and all relevant routed pages fully; supervisors need the guidance and returned coverage map, not every source detail. Include domain-specific required overviews. Refer to maintained standards instead of copying rules into a second authority.

Follow `<controller_home>/conversation-evidence.md` before escalating apparent missing intent. Check PROPOSALS → DECISIONS and current Wiki/contracts, then original conversation context and relevant later revisions as needed. A current owner instruction supersedes only its stated scope. Separate `owner_decision`, `spec_contract`, `source_of_truth_contract`, `active_code_constraint`, `implementation_choice` and `proposal`. Evidence, inference, search ranking and author confidence do not create approval.

## Stage returns and durable continuity

Use the assigned folder's existing records rather than creating competing ledgers. For a new planning-only output folder, a compact `PLANNING.md` may hold coordination and links; create it only when an actual planning assignment exists. Stage and review reports may live in separately owned `reports/` paths. Create substantive records as work occurs, not empty per-agent folders. Use Memory Maintenance when adding indexed content/schema.

Every stage returns its ID/revision, actual source/output fingerprints, work completed, raw evidence/report links, independent reviewer identities and verdicts, findings with dispositions, unresolved intent, invalidated evidence, next safe action and exact owned changes. Distinguish `STAGE_VALIDATED`, `NEEDS_OWNER`, `NEEDS_EVIDENCE` and `RUNTIME_BLOCKED`. Stage 1 may be validated for discussion with explicit gaps; its report must say whether Stage 2 can begin and which portions remain conditional. A partial report preserves useful work without claiming stage completion.

The supervisor checkpoint records current stage/assignment, actual children and writers, accepted outputs and evidence, pending owner/dependency conditions, last check versus last progress, source changes, next safe action and operations not to replay. An execution checkpoint is not a conversation-history checkpoint and does not advance CHECKPOINT.json. Before resumption or replacement, inspect current task/writer state; an intentional owner wait is not a crashed run. No timer, heartbeat or automatic persistent-task rollover is created by this workflow.

## Validation and repair rules

Use the dedicated planning validator, not the implementation SPEC gate or ordinary `clean-room-loop`, for these gates. Reuse clean-room independence and materiality, with planning-specific acceptance thresholds. Each completed production stage needs an independent validation pass. Release needs a fresh validator independent of authors, investigators and earlier reviewers of the package, even when earlier evidence is clean. One role can examine several perspectives, but each perspective needs explicit evidence/coverage; split bounded specialist reviews when distinct expertise or breadth warrants it. Avoid mechanically spawning four reviewers for every simple SPEC.

Before accepting a substantive worker output, its accountable manager assigns `mc-planning-validator` with `mode: worker-handoff` and `deliverable_kind: draft`, `candidate` or `investigation`. Draft and candidate authors always return self-checked authored outputs awaiting this gate. Decision-bearing investigation reports also require it before their conclusions are accepted/incorporated. A small factual lookup may use a manager's direct source check instead: record the evidence and why no intent, impact, feasibility or ordering judgment requires independent review. Do not apply this exemption to drafts, executable candidates or substantive reports.

Worker review checks fidelity to the bounded assignment, substantiation, disclosed limits and a usable return packet. Stage review separately checks the assembled result: integration of accepted evidence, contradictions, seams and coverage across assignments. Release checks the complete executable package across stages/SPECs. These are distinct scopes; do not rerun the same isolated review merely to add another approval label. A worker pass cannot substitute for stage acceptance or release readiness.

The manager owns reviewer dispatch, finding reconciliation, repair routing and the handoff record. Authors and investigators remain leaf workers and cannot declare their own independent pass. Record deliverable ID/kind, assignment/output/source revisions, reviewer identity/report and disposition. `WORKER_HANDOFF_VALIDATED` permits acceptance of the assigned output; an honest partial report or conditional draft may pass without resolving its disclosed questions. A standalone worker without an authorized review route returns provisional work and the missing gate. Installation does not supply delegation authority.

Every gate runs in a newly created session with no inherited author/manager conversation or prior reviewer history. Supply the explicit role/skill contract and a bounded raw-source packet. A reviewer must not have authored the deliverable or supplied its underlying investigation; stage reviewers must be fresh relative to worker reviewers, and release reviewers relative to all earlier package reviewers. A repair pass also uses a new reviewer. If the runtime cannot provide this independence, return the missing capability rather than reuse a contaminated session.

Reviewers receive the assigned contract, original intent/decisions, current artifacts and raw source/test evidence, including factual known limitations and earlier gate identities/coverage where needed to verify prerequisites. Do not give them the desired verdict or prior reviewers' diagnoses as instructions. Managers retain the finding ledger and reconcile fresh reports afterward; do not hide normative issues or owner decisions to create artificial independence. Reviewers independently substantiate consequential claims rather than treating a prior pass label as evidence.

A material finding names violated authority or an actually missing necessary decision, affected scope, realistic consequence, and direct evidence. Style preferences and speculative future work remain advisory. Classify impact and confidence separately. Missing owner intent can block release but remain an honest question in a discussion-ready draft.

Owners of the affected work repair material findings on current bytes. Preserve every finding ID/disposition and propagate material decisions across draft, SPECs, dependencies, checks and Wiki-change assignments. Recheck only invalidated work with a fresh reviewer, then confirm the gate's full coverage against the current candidate. Stop after the first materially clean pass; do not add ceremonial repeated passes. Continue repair while it makes concrete progress. On owner/evidence/runtime waits or repeated failure of the same repair without material progress, checkpoint, identify the root question and route a bounded investigation or owner decision; do not loop indefinitely or erase valid work.

A deferral names unresolved scope, resolver, downstream consumers, future resolution trigger, hold/release condition and evidence that intervening work will not impede or compound the fix. Otherwise hold affected progression and bring the owner the tradeoff. Required intent, safety or dependency gaps do not become optional by being listed. Independent work may proceed within authority; disclosure alone is not release readiness.

## Candidate identity and owner acceptance

This section applies to executable roadmap/SPEC candidates. A discussion draft records source/output revisions and independent draft-review evidence; it does not require a release manifest or implementation approval ceremony. Draft completion does not authorize candidate creation.

Identify normative outputs with ordered relative paths and SHA-256 content hashes. The [candidate helper](../scripts/candidate_manifest.py) creates/checks this inventory inside the assigned bundle root. Keep the manifest, review reports, mutable coordination log and approval receipt outside that normative set to avoid circular hashes. Include roadmap/order, SPECs/slices, normative constraints and acceptance definitions; an author must not omit a governing output to avoid review. Referenced external authorities keep their own recorded revisions and freshness checks.

The author supplies the manifest and proposed normative set; validators verify its completeness as well as its bytes. The helper proves identity only, never completeness, semantics, review or approval. Gate reports name candidate ID, exact covered artifacts/source revisions, reviewer identity and evidence. Changing artifacts after review requires a new manifest and affected validation; a changed hash is normal provenance, not itself a defect. Reuse valid unaffected evidence with explicit coverage accounting.

```text
python3 <controller_home>/.agents/skills/mc-roadmap-creator/scripts/candidate_manifest.py create --root <assigned-bundle> --files <normative-path> <another-normative-path>
python3 <controller_home>/.agents/skills/mc-roadmap-creator/scripts/candidate_manifest.py check <assigned-bundle>/CANDIDATE.json
```

`create` writes the manifest in the assigned bundle; only its current author may run it. `check` is read-only and exits unsuccessfully when files are missing/changed or the inventory is invalid. Never recreate a manifest merely to make old evidence appear current: changed content must follow the validation/approval rules.

The final `RELEASE_READY` report is addressed to the designated MC/owner-facing recipient independently of the author. During construction use the owner-designated manager, not a nonexistent operational MC session. The Creation Supervisor may schedule the fresh reviewer and route repairs but must preserve its report unchanged. Release review checks the whole contract; specialist findings remain attributable.

After release validation passes on current bytes, present the candidate ID, outcomes, evidence, deferrals and remaining limits. The owner's direction to assign the current reviewed package, create its implementation task, or appoint its implementation supervisor is explicit approval of that package. Resolve the candidate ID from the current context; the owner need not repeat the ID or say “approved.” Before creating or assigning the task, record the owner's actual instruction, exact candidate/scope and approval receipt, mark the package `APPROVED_FOR_IMPLEMENTATION`, and include that receipt in the dispatch packet. Do not send an approval-pending packet or ask for the same approval again. If receiving an already assigned task whose receipt was omitted, record the supplied owner assignment before dispatching implementation; missing bookkeeping is not missing approval.

An assignment to draft, review or prepare a package authorizes that assigned stage. It does not skip required release validation or resolve a genuinely ambiguous choice between packages. Preserve any explicit owner hold. A vague acknowledgment, prior draft approval, `CLEAN` or `RELEASE_READY` alone is not execution approval. Package assignment does not pre-accept completed SPECs or authorize unrelated publishing/deployment. A normative change invalidates the old receipt for the affected candidate: obtain affected validation and renewed approval for the new ID (including an owner assignment of that revised package), without discarding valid earlier evidence.

Return `CANDIDATE_READY_FOR_OWNER_APPROVAL` while waiting; `APPROVED_FOR_IMPLEMENTATION` requires the recorded approval. Planning stops at handoff. Offer the existing direct `mc-orchestrator` route for one SPEC or `mc-roadmap-implementation-supervisor` for the bundle; do not start either. Preserve the existing owner acceptance between implementation SPECs.
