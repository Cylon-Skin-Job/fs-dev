# Launchpad investigation contract

> Shared operating contract established under D-009, with standing main-Launchpad dispatch authority under D-010. Launchpad defines project-specific questions and assignments within these boundaries. This document does not launch sessions or install specialist profiles.

## Ownership and authority

The owner-designated main Launchpad session owns the investigation plan, readiness decisions, assignment scope and synthesis. First Draft recommends questions; investigators provide evidence and options. Mission Control receives compact coordination consequences and pointers, while detailed reports stay with the domain.

Use the [session contract](session-contract.md) for identity, CWD, source checkout, delegation and writing authority. The owner creates and assigns main domain sessions. Under D-010, an owner-designated main Launchpad session has standing authority to start and manage bounded investigators for its active project without asking for approval per assignment. This applies during construction as well as later operation, subject to current session/tool restrictions. It does not authorize starting another main domain, a product build or an operational controller. Side conversations do not gain delegation authority from this contract. The first MC session and hourly loop remain off until the system is fully built.

Under D-018, an explicitly authorized Roadmap Creation stage may use these specialty, packet and evidence rules with its stage orchestrator as the accountable research manager. That scope is defined by the [shared planning contract](.agents/skills/mc-roadmap-creator/references/planning-contract.md); it does not seize Launchpad records or inherit authority over other work. This allows direct planning from conversation/documents without running Launchpad first. The side-chat and actual delegation limits remain unchanged.

The fronting agent may select or combine specialties and compose a one-off assignment without creating a permanent profile. Repeated needs can justify a later reusable definition. Do not claim a named specialty below is an installed agent. Product choices remain with the owner; a technical recommendation is not approval. Existing authorization permits routine technical decisions within settled intent without asking the owner again.

## Dispatch and follow-up

When a bounded investigation can materially inform the next planning decision, the main Launchpad session prepares its assignment and starts an appropriate investigator. This is standing authorization to dispatch, steer, request focused follow-up and receive reports from its own investigators. It is not authority to contact unrelated sessions or external people. Use available supported tools; do not bypass tool restrictions or assume that an instruction grants missing runtime capabilities.

Before dispatch, check the domain’s active assignments and completed evidence for overlap. Reuse a suitable active investigation or sufficient existing answer instead of duplicating work. Select an actually available profile appropriate to the question. If no specialist profile exists, use an available general research-capable agent with the specialty responsibilities, this contract and the bounded packet explicitly supplied; do not invent a profile name. A missing bespoke profile alone is not a reason to ask the owner for permission.

Prefer bounded runtime children for these investigations. If using a separate persistent task, comply with that tool’s task-creation and project/CWD requirements. Never claim that a requested folder is the actual CWD until verified. Supply absolute controller-home, contract, source and report paths; ensure the investigator reads applicable instructions. If the current session cannot delegate, return the prepared packet and the specific limitation rather than claiming a launch.

Record the work ID, returned session identity and kind, input revisions, owned report path, state, last check/progress and next action in the domain’s existing records. Confirm scope and CWD acknowledgment before treating a worker as ready to write. Independent questions may run in parallel within actual capacity; sequence dependent questions. Do not create an hourly loop as part of dispatch.

Track returns and incorporate findings before declaring the affected question resolved. Launchpad may issue bounded follow-ups or replace an interrupted investigator under the stop/resume rules below, within the original project scope. Do not automatically restart an intentional hold or owner-decision wait. Stop further investigation when sufficient evidence supports the next decision, and bring consequential unresolved product choices to the owner.

## When and how deeply to investigate

Default flow: prepared packet → Launchpad readiness check → First Draft → selected investigations → discussion and revision → planning handoff.

| Point | Trigger | Appropriate depth |
|---|---|---|
| Before First Draft | A missing fact could invalidate the framing: existing capability, authoritative behavior, or a major architectural constraint. | Minimum orientation needed to make a useful skeleton. No comprehensive repository survey. |
| After First Draft | A candidate outcome exposes uncertainty about feasibility, standards, dependencies, impact or testability. | Bounded investigation tied to a specific draft decision. |
| During revision | New evidence or owner direction changes an assumption or boundary. | Recheck affected conclusions and their consumers; preserve still-valid evidence. |

Launchpad asks: “Can we produce a useful skeleton with uncertainty clearly marked?” If yes, draft. If no, identify the minimum missing input; route intent questions to the owner and factual questions to investigation. Research into alternatives is useful before an owner choice only when it informs that choice.

Assign investigation only when its answer can change a next decision about scope, structure, ordering, compatibility, shared ownership or observable success. State that decision in the packet. Deepen only as needed to answer it. When a question is answered sufficiently, stop; when an answer requires materially broader scope, return partial findings and a proposed bounded extension. Do not turn incidental discoveries into an unrequested audit.

## Selectable specialties

These are responsibility definitions for assignments, not mandatory passes or installed profile names. Use only the specialties relevant to the question.

| Specialty | Responsibility | Required distinction |
|---|---|---|
| Intent and Authority Investigator | Check workfolder records, proposal/decision links, current Wiki/contracts and targeted conversation evidence before escalating an apparent missing decision; use [conversation-evidence.md](conversation-evidence.md). | Distinguish an explicit answer, application of an existing contract, inference, conflict and a bounded negative finding. Search does not confer approval. |
| Code Investigator | Inspect current behavior and implementation paths for a feasibility question; identify grounded options and constraints. | Current code is evidence of behavior, not authority for product intent. |
| Standards Reviewer | Read the applicable standards router and routed rules; compare the proposed approach and identify compliant options or conflicts. | Cite the exact rule and affected proposal; recommended exceptions require the applicable owner authority. |
| Dependency and Impact Reviewer | Trace providers, consumers, shared contracts/state, compatibility and concurrent work relevant to the question. | Distinguish verified dependencies from suspected impact and record observable prerequisite release conditions. |
| Package Reconciler | Compare decisions, requirements and draft sections; identify contradictions and authority-backed repairs. | Reconcile against established authority; conflicting or missing owner intent remains a question. |
| Verification Planner | Assess whether candidate outcomes and regressions can be observed; propose smoke and deeper checks where warranted. | A proposed check is not a passed check; smoke coverage does not establish complete regression safety. |

Capture, Checkpoint and Memory Maintenance remain focused procedures for their existing purposes. This contract replaces the broad research/reconciliation portion of Second Brain v1 without creating another umbrella agent.

## Assignment packet

Extend the existing [assignment and return packet](record-templates.md#assignment-and-return-packet), reusing fields already present. Store substantive assignments in the domain's indexed records with stable local work IDs. Do not create empty investigation folders or populate the central registry with every research detail.

```text
Investigation ID / assignment revision / accountable Launchpad session:
Specialty or combination / procedure or installed profile, if applicable:
Question / decision the answer can change / affected candidate or requirement IDs:
Stage: before draft, after draft, or revision / priority and reason:
Authority / controller home / verified memory CWD / source checkout:
Input packet and source revisions / relevant dirty-file fingerprints or dated observations:
Named starting sources / permitted search boundaries / exclusions:
Designated main history UUID/host or checkpoint registry / relevant turn locators / unavailable history:
Prerequisites and unresolved assumptions / permitted conditional alternatives:
Expected answer and evidence / stopping condition / effort bound if needed:
Allowed operations / exact owned report path or return-only destination:
Recipient / delivery method authorized by the assignment:
State / last checked / last progress / next action:
```

Specify a useful answer, not a desired conclusion. Provide relevant raw sources and known authority, not just another agent's summary. Default operations are source inspection and writing the assigned report only. Running tests, prototypes or commands that change code, runtime state or external systems requires that operation to be in scope. Separate documentation-repair authority from investigation authority.

An investigator verifies scope and source identity before work. If a required input is missing, inspect independent authorized inputs and return the gap; do not silently choose another checkout, source revision or product interpretation. No nested delegation is implied.

## Parallel work and source changes

Launchpad may prepare independent questions in parallel when each can be answered without the other's result. Shared read access is acceptable; give reports separate write paths and preserve a common input baseline. Identify shared assumptions explicitly. If one answer determines another assignment's premise, sequence them or authorize clearly labeled conditional alternatives. Unknown overlap is not proof of independence.

Investigators do not edit the shared draft, canonical wiki, product code, decision ledger or MC registry by default. A Package Reconciler may receive a subsequent document-repair assignment naming the exact files/sections and governing decisions. Verify writer ownership before those edits; never overwrite concurrent work to restore the reviewed snapshot.

Report source revisions and material changes noticed during work. For dirty inputs, a commit SHA alone is insufficient: identify the relevant content using a fingerprint or a dated observation with explicit freshness limits. On return, Launchpad checks whether changed inputs invalidate the conclusions and requests only the affected recheck. An investigator can finish a valid report while the draft still needs revision.

## Report and synthesis

Return a compact conclusion followed by evidence sufficient to inspect it. Use a separate assigned report or the requesting conversation when no durable write was authorized.

```text
Investigation ID / assignment revision / author / timestamp:
Outcome: answered, partial, needs owner decision, or blocked:
Answer to the question / planning consequence:
Sources actually inspected and revisions / search limits / checks actually run:
Findings: evidence-backed observations, inferences, and unknowns kept separate:
Options and tradeoffs / recommendation labeled as such:
Contradictions or risks / authority and affected candidate or requirement IDs:
Proposed draft changes / questions requiring owner judgment:
Changed files / stopping reason / next safe action:
```

Negative findings include their search boundary: “not found in these paths” does not prove global absence. Disclose unavailable sources and untested claims. An answered question may yield no viable option; do not invent one to report success.

The accountable manager checks whether the report answers its assignment with sufficient evidence, fits the input revision and preserves authority distinctions. An investigator returns an authored report awaiting acceptance; `answered` describes its own result, not independent validation. Before accepting/incorporating a substantive decision-bearing report, the manager assigns a fresh leaf [Planning Validator](.agents/skills/mc-planning-validation/SKILL.md) with `mode: worker-handoff`, `deliverable_kind: investigation`, the original question/criteria, current report and raw source packet. Use the [shared planning contract's independence and repair rules](.agents/skills/mc-roadmap-creator/references/planning-contract.md#validation-and-repair-rules). The investigator cannot dispatch or self-certify this gate. A small factual lookup may instead receive a direct manager source check, with its evidence and exemption reason recorded; consequential intent, feasibility, impact or ordering conclusions require independent review.

Record the report's ID/revision, actual reviewer identity/report and `WORKER_HANDOFF_VALIDATED`, or the source-check exemption. A faithful partial report can pass while leaving its question unresolved; never release affected work on a fidelity verdict alone. If review cannot run within existing session/runtime authority, preserve the authored report and mark acceptance pending. Route repairs to its author and use a fresh reviewer against repaired bytes, retaining unaffected evidence.

Record the disposition: incorporated with links to affected draft sections, follow-up needed, deferred with reason and resolution point, or superseded with a replacement link. Keep receipt, independent handoff review, manager acceptance and incorporation distinct so a successor can identify unfinished synthesis. Do not mark a product decision approved merely because its supporting research is accepted.

Before calling intent missing, follow [conversation-evidence.md](conversation-evidence.md): inspect PROPOSALS/DECISIONS and applicable contracts, then retrieve the relevant conversation when it can settle the question. Return an ambiguous main-thread question through Launchpad; do not repeatedly ask the owner from individual investigators.

Resolve conflicts by examining sources and authority, not by voting among agents. Apply established decisions where unambiguous; return competing product intentions or consequential unspecified behavior to the owner with options and implications. Preserve unresolved contradictions visibly in the draft.

Report to MC only when coordination needs it: a cross-domain dependency, shared ownership conflict, changed ordering, hold/release condition or owner decision. Include the consequence, evidence pointer and next action. A saved bulletin entry is not delivered notification; use only an authorized communication route.

Documentation changes also warrant the focused [Document Sweep](.agents/skills/mc-document-sweep/SKILL.md): compare the package against its previous reviewed state after material batches or structural changes. Use its report as investigation evidence, preserving coverage limits and unresolved findings; do not equate its baseline with approval.

## Stop, resume and handoff

Stop when the bounded question is sufficiently answered, the declared scope/effort bound is reached, required evidence is unavailable, or owner intent determines the next step. Preserve useful partial findings. Do not repeatedly investigate a question whose answer is already supported; reopen it only for a changed input, material contradiction or an identified evidence gap.

Before replacing a stopped session, check its actual state and report. Distinguish active work, intentional wait, completed report awaiting synthesis and interrupted work. Verify the previous writer is inactive or has handed off; resume the next unfinished action with source revisions and evidence intact. Never fabricate session identity or completion from silence.

Launchpad may recommend Creator handoff when structural questions are resolved or explicitly deferred with their consequences and required resolution points. Report research completion separately from planning readiness. Independent Release Validation later evaluates the candidate under its own contract; specialist reports and Launchpad's intake checks do not count as that gate. No handoff here authorizes implementation.
