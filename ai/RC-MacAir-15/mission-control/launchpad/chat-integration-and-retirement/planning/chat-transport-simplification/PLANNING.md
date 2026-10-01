# Chat transport simplification — First Draft coordination

## Assignment and authority

Planning ID: CHAT-SIMPLE-DRAFT-001, revision 1. The owner explicitly requested: “Let’s run first draft, then review and prep for Roadmap.” This authorizes First Draft, independent draft review, documentation reconciliation/sweep and roadmap input preparation. Executable roadmap creation and product implementation follow a later handoff.

Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Memory home: its `launchpad/chat-integration-and-retirement` folder. Read-only source checkout: `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, dirty at HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Input identities are recorded in `SOURCE-SNAPSHOT.json`; HEAD alone does not contain this implementation.

The current owner conversation is the direct authority for D-004/D-005 and this run. Historical source supervisor task: `01a0c1c8-6e85-7f83-8d67-2cb5c1476007`. No checkpoint registry or history cursor is created. The parked same-folder follow-up task `01a0ea32-f152-77a2-afc2-b73e8976685a` acknowledged its intake and stopped without edits; it owns no current shared writer role.

## Scope and preflight

Destination: first-draft. Status: READY_WITH_EXPLICIT_GAPS. Inputs: local TICKET, INTENT, DECISIONS D-003/D-004/D-005, CAPTURE, ISSUES I-001/I-005–I-011, REFERENCES and the two investigation reports; current User Preferences, Code Standards router/routed standards and Chat overview; current transport entry and submission source. The last completed document sweep predates the new owner direction and must be refreshed before Creator handoff.

Three agreed candidate outcomes: simplify the server `client-message-router.js` and client `ws-client.ts` responsibilities; unify chat command sends through an acknowledged client boundary; fix the ignored false return for receipt-status sends. The author may recommend dependency order and exact slices within these three candidates. Preserve one user-text prompt route, request/connection identity, server acceptance, typed enqueue uncertainty, live stream sequencing, existing two-second visible-wait hourglass and provider-owned retries. Do not design a new logging framework or broaden into complete recovery UX, provider retry control, accepted-receipt hydration, Side Chat redesign, or general legacy retirement.

Guidance mapping: reuse/deep modules and one job per file constrain router extraction; backend state authority and exact thread identity constrain unified transport; public-route smokes must cover each changed boundary; existing canonical message families and governed capability direction rule out a new general bus or provider-specific client protocol. Current owner deferral parks the complete Fusion/OpenCode failure map. The draft must identify evidence that intervening refactors preserve its repair options; a concrete conflict blocks only affected progression and returns the choice to the owner.

Gaps assigned to the stage: assess overlap/order of the three candidates, identify current transport outcome contracts without collapsing `uncertain` into `not sent`, and bound deferral/consumer impacts. These are shaping questions, not a request for exhaustive failure analysis or executable test commands. Missing native/runtime reproduction of I-007/I-008/I-009 remains explicit and is not a readiness claim.

## Writers and progress

Root owns this coordination file, SOURCE-SNAPSHOT.json, later ROADMAP-PREP.md and local memory reconciliation. The stage orchestrator owns reports/STAGE-REPORT.md and its bounded assignments. One child author owns FIRST-DRAFT.md. Independent validators own their reports only. A later document-sweep reviewer owns its .document-sweeps run only. All agents share the dirty checkout and must preserve other writers’ edits.

Stage dispatched to runtime child `/root/draft_stage` (`mc-planning-stage-orchestrator`), which acknowledged the assignment and source/memory boundaries. It manages the bounded research, single author and fresh validator. Root's initial read-only verification found all 28 recorded input hashes current. No product edit, build, test send, app restart, database mutation, Git publication, Alpha operation, MC activation or recurring monitor is part of this planning run.

## Handoff

Require the author’s provisional outcomes/slices, observable smoke scenarios, source/standards coverage, dependency/deferral reasoning and stable questions. Require fresh independent `DRAFT_VALIDATED_FOR_DISCUSSION` on exact draft bytes and stage return. Root then reconciles documentation, commissions the affected sweep, and runs roadmap-creation preflight. Stop at the reviewed draft and concrete Roadmap preparation packet.

## Supervisor disposition

The completed stage returned DRAFT_VALIDATED_FOR_DISCUSSION with no material findings. Root read the draft, investigator reports, independent validation and final stage report; accepted the stage for discussion and Roadmap preparation. Root independently matched all 28 intake hashes before memory reconciliation, draft `6e14ca1119c403754629dd463c838c62ccbe89b98ac7da9d6b2893d50f3f0393`, validation `c3f484628b94a215a641fdf9f0e8281c2a9ae8fca1067e41937d90acb9ea2688` and stage report `c3e45b7004e956f0eeca376dbfa520363b6ad65cf39933ba4e7dc729f0d1b873`. Stage and all children are complete; no pending artifact writer remains.

D-006 and REF-013 record this run. Memory reconciliation updates current disposition, candidate order and R1–R4 while preserving prior evidence and open issues. Original SOURCE-SNAPSHOT remains an immutable intake record; later local-memory changes are intentional and will be covered by the new document sweep. The draft and product inputs are unchanged. Final roadmap-creation preflight and the sweep disposition will be written to ROADMAP-PREP.md after review; this coordination record is frozen for that sweep.
