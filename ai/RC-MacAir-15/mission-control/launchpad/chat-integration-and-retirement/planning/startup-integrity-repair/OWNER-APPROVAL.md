# Owner approval — CHAT-AR-REPAIR-01

Status: `APPROVED_FOR_IMPLEMENTATION`.

Recorded by Codex side chat (ephemeral), Creation Supervisor `/root`, at 2026-10-06T00:05:23Z. Approval source: the human owner in this chat, verified native task `01a10cda-f556-7733-954b-132a648d8d11`, host `local`, after the exact reviewed candidate was presented. Actual instruction: **“Approved. Send to an orchestrator.”** This receipt records that instruction; no duplicate confirmation is required.

## Exact approved candidate

- Work ID: `CHAT-AR-REPAIR-01`; planning `CHAT-AR-REPAIR-PLAN-01` revision 1.
- Candidate: `sha256:29749ceb65dab37535a047f64cbd57aa1ddd6f149191c1a4f6ae6d1bf31cf6e4`.
- [SPEC](SPEC-01-STARTUP-INTEGRITY-REPAIR.md): SHA-256 `0d7a3176cca89b017162970b2fe8f28a5c8b902547fba48f797a2cc68060ac3c`.
- [SOURCES](SOURCES.json): SHA-256 `d124abc38a76f7e63011184387c6d2c5b6e5778333c4d29c146a8bb9d07cdaff`.
- [Manifest](CANDIDATE.json), [stage return](reports/STAGE-REPORT.md) and [fresh release validation](reports/RELEASE-VALIDATION-01.md) identify the complete current package. Release report SHA-256 `85844e23b9d174055cd5e312df6e3a106140b1dc7c64f368a81b986375275761`, verdict `RELEASE_READY`, no material findings.
- Before recording approval, the candidate-helper check matched and all 28 intake/82 source fingerprints remained unchanged.

## Approved execution and boundaries

Execute R1 → R2 → R3 through the exact local `mc-orchestrator` procedure and fresh slice builders with their builder-owned and separate orchestrator/final review gates. Root will appoint one fresh runtime orchestrator, inheriting the invoking root's model/effort without override. This appoints the repair execution owner for the new bundle and bounded repair code/test/docs; it does not duplicate or transfer ownership of the original implementation ledger, historical reports or manual-test coordination.

The original implementation task `01a1042c-09df-7473-a1e1-f458eee6b93d` was checked through native `read_thread`: `notLoaded`, latest turn interrupted; no running chat writer was reported. The source/manual coordinator `01a0ea32-f152-77a2-afc2-b73e8976685a` was `notLoaded`, latest turn completed. These are current task observations, not proof that old app/server processes are stopped. Preserve existing runtime state and recheck task/writer/process attribution before overlapping operations. Original-report adoption must go through its existing owner or an acknowledged successor, as SPEC §5/§8 requires.

Carry CST-A02/RLV-A01 into R3: retain safe failure artifacts before the guarded fixture removes its marker-owned root, and check protected state on failure as well as success. Maintain faithful guards and both scenarios. Current original-job real OpenCode response, exact durable exchange and passive same-thread reopening must be proved in an attributed disposable profile AND registered/selected scratch workspace; owner-manual UI remains the chosen route and live Playwright/CDP fallback remains ungranted.

This approval authorizes the reviewed repair implementation and necessary verification. It does not pre-accept its completed work, close original S3/S4, authorize a following SPEC, Git commit/push/merge, Alpha operations, broader harness/health programs, monitoring or main/checkpoint changes. Return complete evidence/deviations/final integration for owner acceptance. Changed normative candidate contents require affected validation and renewed candidate authority under the planning contract; ordinary implementation mechanics/source drift follow the approved fail-forward and deviation rules.

This receipt is outside the normative inventory. Do not rewrite the approved SPEC, source inventory or independent review reports to change their identities.
