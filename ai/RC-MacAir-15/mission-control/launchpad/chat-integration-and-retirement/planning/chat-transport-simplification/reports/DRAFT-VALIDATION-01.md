# Independent draft validation — CHAT-SIMPLE-DRAFT-001 revision 1

**Verdict: DRAFT_VALIDATED_FOR_DISCUSSION.** No material defect was found at First Draft depth. The three candidate outcomes faithfully preserve the current owner scope. R1–R4 remain technical planning obligations before executable release, not evidence of implementation readiness.

## Assignment, independence and identity

- Mode: `draft`; whole-draft review, all four perspectives. Recipient: `/root/draft_stage`.
- Reviewer: Codex side chat (ephemeral), runtime child `/root/draft_stage/validator`. Reviewed 2026-09-28T23:02:00Z. I did not author the draft or either stage investigation. Root model/effort were inherited without override.
- Candidate author: `/root/draft_stage/author`. Reviewed file: `FIRST-DRAFT.md`; SHA-256 `6e14ca1119c403754629dd463c838c62ccbe89b98ac7da9d6b2893d50f3f0393`.
- Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Verified memory CWD: its `launchpad/chat-integration-and-retirement` folder. Output folder: `planning/chat-transport-simplification` beneath memory.
- Separately verified source root: `/Users/rccurtrightjr./projects/fs-dev`; branch `agent/exact-workspace-paths`; HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`; dirty. This is the primary development checkout, not Alpha. Actual tool execution supported read-only shell inspection and the assigned report write; host permissions are unrestricted with approval policy never. These capabilities confer no additional task scope.
- Sole write ownership: this report, `reports/DRAFT-VALIDATION-01.md`. No product, canonical Wiki, shared memory or candidate edits; no children, tests, runtime mutations, implementation or owner approval.

Read completely: applicable repository/controller/memory AGENTS, controller session contract, mc-planning-validation skill, shared planning contract and conversation-evidence contract; PLANNING, SOURCE-SNAPSHOT, FIRST-DRAFT, D-004/D-005; current User Preferences, Code Standards router and all eight routed standards; Chat overview and Chat WebSocket Protocol; both current stage investigation reports and both earlier CHAT-AR investigation reports. TICKET, INTENT, BULLETIN, index and relevant CAPTURE/I-011/REF-012 material supplied continuity. Direct inherited owner messages establish the three chunks, deferral and authorization to draft/review/prepare; no historical proposal was promoted to an owner decision. Additional history retrieval was unnecessary for this bounded authority question.

## Four-perspective coverage

| Perspective | Examined evidence and conclusion | Limits |
|---|---|---|
| Intent, authority and coverage | Direct owner conversation; D-003/D-004/D-005; draft capability table, C1–C3 cards and deferral table. Exactly three outcomes remain: two entry-file responsibilities, one client send boundary, and the status-query result seam. Four cards are slices within those outcomes. The draft explicitly preserves the one existing text-prompt route, waived historical soak, accepted SPEC-06 and parked failure/retry UX. No required owner choice is disguised as settled. | Candidate order is a technical recommendation; draft review grants neither executable planning nor implementation approval. |
| Architecture, standards and preferences | User Preferences reuse/deep-module/deferral rules; all eight routed standards; Chat overview/protocol. Independently inspected `client-message-router.js:81–139,702–768,897–913`, `ws-client.ts:191–196,244–310,418–465`, `chatSlice.ts:344–400`, `shell-auth-client.ts:79–180` and recovery `:1–210`. Existing domain owners, central auth/generation ownership, receipt authority and distinct canonical message families substantiate the skeleton. C1 is justified by responsibilities, not file length alone. C2 preserves typed local outcomes and explicit identities. | Exact extraction modules and final API/type shape are correctly left for Creator; no complete source-compliance certification. |
| Dependencies, blast radius and brittleness | Direct source shows generic sender false can follow a caught send exception, true can mean pre-auth queue admission, while prompt send distinguishes `enqueued`, `uncertain`, `not_enqueued`. Recovery discards the result and arms its deadline. Server prompt route holds the workspace lease and same-attempt lock; receipt `project/status` at `prompt-submission-service.js:49–61,134–152` remain separate owners. The draft protects those differences, shared non-chat consumers, cleanup, old-generation rejection and no automatic prompt replay. C1 → C2 → C3 is explicitly a rework-minimizing recommendation, not invented semantic necessity. | Caller inventory and queue lifecycle remain R1/R2; complete migration coverage cannot be asserted yet. Earlier incident reports are dated evidence; this review does not identify the freeze/spawn cause. |
| Verification, evidence and handoff | Each card includes a public path and observable success/failure smoke. C1 openly identifies structural enablers and exercises user-visible parity; C2 covers Main/Side identity, durable acknowledgement/fan-out/readback and uncertainty; C3 covers definite refusal, ambiguous enqueue, reconnection and late matching response. R1–R4 identify resolver and resolution point. All 28 intake hashes matched at 2026-09-28T23:01:23Z; candidate and investigation fingerprints matched the assigned bytes. | Smokes are proposed, not run. Exact commands, changed-caller coverage and executable release checks remain later-stage work. No required portion of this draft-mode review is missing. |

## Findings and dispositions

No material `REVISE`, `NEEDS_OWNER` or `INCOMPLETE_REVIEW` finding.

**DV01-A1 — Advisory, medium impact if lost; high confidence.** Preserve R1/R3 when preparing Roadmap. The apparently simple false-result fix depends on a truthful local transport contract: `shell-auth-client.ts:97–115` conflates definite refusal and caught-send failure, and queues pre-auth frames. A boolean-only migration could incorrectly free a pending prompt or misstate delivery. The draft already addresses this in C2-A/C3-A and R1/R3, including conservative treatment of ambiguous status sends. **Disposition: adequately carried; no draft repair required.** Creator must settle the concrete contract and public-route evidence before release.

**DV01-A2 — Advisory, medium impact if omitted; high confidence.** Complete R2's bounded caller inventory before claiming unified chat sends. The boundaries report explicitly samples callers and names diagnostic/read-only senders as further inventory work. The draft accurately retains this gap and shared non-chat impact. **Disposition: adequately carried; no draft repair required.** This does not reopen the comprehensive provider failure-map task.

## Deferrals and remaining conditions

D-005 is meaningful at draft depth: the deferred task, resolver, trigger, affected consumers, preserved identity/receipt/runtime seams and conditions that would hold affected progression are explicit. Source ownership supports the limited inference that private transport extraction need not prevent later receipt projection or accepted-message hydration repair. It does not prove runtime safety or authorize plugin adoption of unresolved recovery contracts. R4 must revisit the actual planned modules and bytes before executable release.

The temporary diagnostic sink retains its delete/migrate trigger and content-free/best-effort constraints. Side Chat controls, broad retirement, resource attribution and accepted-response UX remain outside these candidates with existing owners. This conforms to the owner's current sequencing and the preference against compounding deferred work.

No fresh native OpenCode, UI, database, send, restart, build or product test was performed. Prior investigation runtime observations were not reproduced. No claim depends on a newly verified OpenCode retry count. Exact slice boundaries, caller ownership, queue behavior, affected checks and final dirty build baseline remain explicitly open technical work. There is no new owner decision required for discussion or Roadmap input preparation on the reviewed evidence.

## Source fingerprints and return

- `SOURCE-SNAPSHOT.json`: `4756ff742ff7a4fa71927246aeded7660335caf0279e69e8994724b0413345f1`; all 28 listed inputs matched during independent comparison.
- `reports/STANDARDS-REPORT.md`: `165fd0bd0e4c586c34dc63272dd5effa74b355c0f2bf6383cf26c2ae59d54d41`.
- `reports/BOUNDARIES-REPORT.md`: `48f26c7f9e1fd27f7a38e57de3326d50269cd63de3d94135b13e8fac04fbfd68`.
- Additional independently inspected `shell-auth-client.ts` identity is recorded in the boundaries report; candidate and recorded intake sources were unchanged at review. Historical reports identify their own older incident/source snapshots and are not a current runtime certificate.

Changed only this report. Return unchanged to `/root/draft_stage`; the manager may reconcile documentation and prepare Roadmap inputs with R1–R4 preserved. Stop after this report. **DRAFT_VALIDATED_FOR_DISCUSSION** is the independent verdict for the exact draft hash above.
