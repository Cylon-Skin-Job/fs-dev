# SPEC-05 contract and evidence matrix

State: all slices and final SPEC integration checks/review CLEAN. FINAL-VERIFICATION.json, FINAL-EVIDENCE-AUDIT.json and FINAL-REVIEW-02.md support completion. Supervisor/owner acceptance remains separate.

| Criterion | Owner / slice | Required evidence | State |
|---|---|---|---|
| Session create/delete/capacity primitives have narrow initialized dependencies | 05A lifecycle | Source/dependency map, actual route tests | 05A accepted; 05A/ORCHESTRATOR-ACCEPTANCE.md |
| Group membership/primary/activity/exclusive lease remain singular | 05A group | DB rollback at each write, duplicate/concurrent one mutation | 05A accepted; 05A/ORCHESTRATOR-ACCEPTANCE.md |
| Passive open zero harness warm; eager create, selected identity, close/capacity/busy preserved | 05A | Backend lifecycle/activation/authenticated public route + V-SUBMIT | 05A accepted; 05A/ORCHESTRATOR-ACCEPTANCE.md |
| Receipt/activity atomic acceptance, claim-before-dispatch unchanged | 05A/C + accepted 02 | Receipt SQL fault/readback/restart and V-SUBMIT | 05A–C preserved;05D cumulative and fresh acceptance CLEAN |
| Mirror projection/write/delete journals/restart belong to narrow owner | 05B | SQL/file/ACK failure matrix and exact readback | 05B accepted; 05B/ORCHESTRATOR-ACCEPTANCE.md |
| Delete cascades receipts, fences late callbacks; no resurrected session/group | 05B | Busy/fence/provider failure and restart/late callback tests | 05B accepted; 05B/ORCHESTRATOR-ACCEPTANCE.md |
| Move preserves source history/link/export, creates cold empty Main portable selection | 05B | Actual action + session/member/file/outbox readback | 05B accepted; 05B/ORCHESTRATOR-ACCEPTANCE.md |
| Activation distinct from turn admission/dispatch/Stop/cleanup | 05C | Narrow imports and public behavior | 05C accepted;05C/ORCHESTRATOR-ACCEPTANCE.md |
| Canonical runtime manager only; immutable generation/thread/turn/drain | 05C | Interleaving/replacement/late old generation tests | 05C accepted;05C/ORCHESTRATOR-ACCEPTANCE.md |
| Interactive/automation use shared drain APIs without fabricated client receipt | 05C | Runtime automation, canonical bridge/applier tests | 05C accepted;05C/ORCHESTRATOR-ACCEPTANCE.md |
| Terminal persistence failure and exact Stop have bounded recovery | 05C/05D | Fault + saved partial readback, replacement cleanup, delayed save beyond effect grace and bounded delivery lifetime | Current05A/C/D expanded recovery accepted; root05D acceptance CLEAN |
| Facade contains no moved policies/transactions/formatting/recovery | 05D | Acyclic owner map, <=400 new/extracted production modules |05D accepted|
| Final gates and UI create/Send/Stop/Move/delete/reconnect | 05D/integration | Full V-BACKEND/V-SUBMIT/V-ACTIONS/V-BUILD, native pretest full isolated npm test -- --runInBand, architecture |05D accepted; final SPEC gate CLEAN|
| Affected Chat Wiki server sections current, concurrent provenance retained | 05D | Bounded source-backed documentation diff |05D accepted|
| Independent builder/orchestrator/final review; classified deviations | Every gate | Fresh identities, raw review records, exact manifests, terminal lifecycle |05D accepted; final SPEC gate CLEAN|

Prohibited throughout: live profiles/databases, port 3001, owner Fusion window, unrelated processes, destructive migration, commit/push, Alpha operations, SPEC-06 execution.
