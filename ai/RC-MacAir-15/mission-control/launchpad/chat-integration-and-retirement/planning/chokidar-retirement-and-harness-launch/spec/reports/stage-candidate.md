# Stage 2 Candidate Creation — Stage Report

## Assignment and return

- **Planning ID:** `CHAT-AR-SPEC-CHOKIDAR-RETIREMENT-001`
- **Stage:** `stage:candidate`
- **Stage result:** `STAGE_VALIDATED`
- **Manager / return recipient:** `/root` (Creation Supervisor; owner-facing planning session)
- **Stage orchestrator:** `/root/spec_candidate_stage`
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`
- **Memory CWD:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`
- **Read-only source checkout:** `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c` at stage checks.
- **Output ownership:** Candidate author owns normative SPEC and `CANDIDATE.json`; this stage owns this report; each candidate-stage reviewer owns its separate report. Coordination input `spec/PLANNING.md` remained read-only.
- **Runtime verification:** The actual memory CWD and distinct checkout root/branch/HEAD were checked. Candidate files and the authorized report path were writable. The product tree is extensively dirty overall; assigned product/source paths remained clean at checks. No product runtime, tests, DB, provider, chat, Alpha, Wiki, checkpoint, or publishing operation was performed.

## Accepted inputs and current candidate

Accepted First Draft revision 2 and its independent validation were reused without repeating draft generation: `../FIRST-DRAFT.md` SHA-256 `98329563e1ac24d1eeaa5753ad9490c10057cf9e9a065e912663ae1f3e907a9c`; `../reports/independent-draft-review-revision-2.md` SHA-256 `177264f784c3765e3ff05e44fad02737bf42ea8b6b1fcfe5f4abe81280dd9ff4`, verdict `DRAFT_VALIDATED_FOR_DISCUSSION`. The accepted preflight `../reports/preflight-spec-handoff-revision-2.md` (`de1ddfb43b211c0fd7e976c15fbc3be3c9f5f1791974946a8f43899b75dea337`) carried PF-04 and RV2-A01 into candidate work. The current owner amendment, parent preparation packet and supporting sweep remain unchanged sources.

The candidate is one bounded SPEC, with ordered slices for selective legacy ledger recording, screenshot/Apple Calendar listener retirement, broad Chokidar/workspace watcher and startup removal while preserving independent startup functions, and integrated automated/documentation plus actual public-chat verification. The real chat check requires normal shell authentication, actual OpenCode child/session, assistant response, persisted exchange and history readback. A failed real chat check must be diagnosed within the bounded approved work; descriptor counts, generic child spawn, `wire_ready`, or server health cannot substitute. No new detector or snapshot service/readiness gate is introduced. Interim Apple Calendar refresh loss and possibly stale imported rows are explicit; Google opt-in polling and Calendar surface/routes remain distinct. Separate native Calendar/Mail monitoring direction is assigned to future plugin-foundation work and is not a gate. Canonical Wiki and product sources are read-only during this stage.

## Author and independent validation chain

- **Candidate author:** `/root/spec_candidate_stage/candidate_author`, assigned only normative candidate documents and manifest.
- **Normative SPEC:** [`SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md`](../SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md), SHA-256 `5db704433ef8996d8737f056eceb45a8318fc35d42db484e76f35f645111cb7a`.
- **Candidate manifest:** [`CANDIDATE.json`](../CANDIDATE.json), SHA-256 `f6126daaefb2c0d468c3af1411b80797fc330378a404b268f85ca5a885560e1c`.
- **Candidate ID:** `sha256:456ff6a031a5ed779ea8535365aff283bd6187589007f8e26963b649dbefdc3a`.
- `candidate_manifest.py check` passes with `matches: true`, no mismatches. The candidate helper establishes byte identity only; candidate completeness and semantics are covered by the independent gate.
- **First independent reviewer:** `/root/spec_candidate_stage/candidate_stage_validator`; report [`stage-candidate-review.md`](stage-candidate-review.md), SHA-256 `4a923872a620fdb38a957dd3684da80787ebb24af77bd988182d52f9a39b586b`. Verdict `REVISE`, finding CS-01.
- **Repair:** The author updated the candidate source trace to current D-019/I-021/REF-020, explicitly stated that retiring the sole Apple Calendar watcher callback ends interim automatic Apple sync/refresh while existing imported rows may become stale, retained the no-wait/no-race and Google-poll checks, and routed replacement native monitoring to separately owned future I-021 work without gating Chokidar removal.
- **Source freshness during repair:** Plugin-foundation authority bytes advanced again to include D-020/I-022. The author refreshed them before re-review. Current SHA-256s at final stage check: `DECISIONS.md` `727d55583268cc8fca1a0cd21aa1b059fefdbc9c125cc3434d97d9941750308e`, `ISSUES.md` `1e268cb7a699e71ae7f3669c0f60158601ba581153e175407ea2ef4722c0d868`, `REFERENCES.md` `8b8e1498877e440080d631c6ef1d071e96af617d0d495383a808965d10c5b6dd`. D-020/I-022 are represented as future plugin-owned native listeners under System scheduling/UEB admission, with lifecycle/admission choices open and no current-scope expansion.
- **Fresh repair reviewer:** `/root/spec_candidate_stage/candidate_stage_recheck`, independent of author and first reviewer; report [`stage-candidate-review-r2.md`](stage-candidate-review-r2.md), SHA-256 `0deda021a22ab07ae3a04b660c1ec8e04770bc0f128db8ee6c6b51b0fd2ee3f0`. Verdict `CANDIDATE_STAGE_VALIDATED`, four perspectives complete, no remaining material finding.

## Coverage, dispositions, and limits

The final reviewer independently examined all four required perspectives against current owner intent, current routed preferences/standards/domain contracts, the source inventory, candidate manifest, dependency and verification contracts, and non-code update ownership:

1. **Intent, authority and coverage:** settled scope is preserved; CS-01 was repaired in current candidate bytes. Future snapshots, trigger/subscription redesign, native Calendar/Mail monitoring, Together.ai retry/warm-up and unrelated accepted work are explicitly separated.
2. **Architecture, standards and preferences:** no replacement watcher, new route/protocol, schema or persistence migration is introduced. Existing server-owned chat acceptance/persistence, direct screenshot, independent event/cron consumers and separate Google poller remain correctly owned.
3. **Dependencies and blast radius:** ordered slices retire dependent registrations before shared dependency removal and preserve unrelated producers/consumers. Apple callback's interim behavior loss is explicit; no production descriptor cause is asserted.
4. **Verification and handoff:** tests, startup inventories, Wiki/source maps and focused checks have implementation owners/timing. A later approved implementation must prove actual public OpenCode chat after removal; the candidate does not claim runtime or test success.

Disposition of known items:

- **PF-04:** resolved for executable planning. Candidate inventories exact imports/registrations/lifecycle and startup consequences; screenshot direct-flow refresh calls/acknowledgements; Apple no-wait/no-race proof; and a concrete later public-chat check with failure diagnosis.
- **RV2-A01:** resolved. Candidate assigns affected watcher/startup source maps, ledger/resource-event descriptions, screenshot and Calendar Wiki updates, related tests/inventories, and timing during implementation after behavior is stable.
- **CS-01:** resolved by author repair and fresh validation; interim Apple Calendar refresh loss and future I-021 route are explicit.
- **CS-R2-A01:** non-blocking advisory for release review. Candidate's contextual plugin-foundation `INTENT.md` and `TICKET.md` hashes are stale, while current operative `DECISIONS.md`, `ISSUES.md`, and `REFERENCES.md` hashes containing D-019/D-020/I-021/I-022/REF-020 are accurate. Release reviewer should refresh those two contextual hashes or remove them from the current-authority row if unnecessary. This did not affect the candidate-stage verdict.
- **Unresolved owner choices:** none block this candidate. Later native Calendar/Mail latency, permission, resource, lifecycle and admission choices remain in separate future work, not silently resolved here.
- **Evidence limits:** actual OpenCode public chat verification belongs to approved implementation; the prior sparse FD-boundary reproduction does not prove the production pipe identity, a leak, or that Chokidar removal alone is sufficient. Scoped product paths were clean at the recorded HEAD; unrelated dirty work was preserved.

## Next safe action

The candidate-stage gate is complete on the exact candidate ID above. The Creation Supervisor should verify the current manifest and arrange a separate fresh `mode: release` reviewer, distinct from both candidate author and candidate-stage reviewers. Release review should include advisory CS-R2-A01. If release validation passes, return the exact reviewed candidate to the owner for approval. Stop here: this report does not approve implementation, and no implementation task or product work has begun.
