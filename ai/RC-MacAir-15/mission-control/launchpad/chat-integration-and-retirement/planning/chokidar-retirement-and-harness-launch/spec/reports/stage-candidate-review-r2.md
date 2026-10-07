# Independent Candidate-Stage Review (Repair Pass 2)

## Review record

- **Mode:** `candidate-stage`
- **Planning ID:** `CHAT-AR-SPEC-CHOKIDAR-RETIREMENT-001`
- **Scope:** Fresh review of the repaired SPEC-01 candidate and current manifest across all four candidate-stage perspectives. This is not release validation or implementation approval.
- **Reviewer:** `/root/spec_candidate_stage/candidate_stage_recheck` (fresh leaf reviewer; did not author the candidate or the prior review)
- **Recipient:** `/root/spec_candidate_stage`
- **Reviewed:** 2026-10-03 14:26 UTC
- **Memory CWD:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`
- **Read-only implementation checkout:** `/Users/rccurtrightjr./projects/fs-dev`; branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`. The checkout is extensively dirty overall. The SPEC-listed product source paths had no current status entries when checked.
- **Write ownership:** This report only. No candidate, product, test, Wiki, database, checkpoint, shared or sibling records were changed.
- **Runtime capability:** Verified shell access to the assigned memory CWD, repository root/branch/HEAD, current candidate bytes, source reads and manifest check; report path is within assigned writable output. No delegation, application/runtime, provider, Alpha or checkpoint action was attempted.

## Candidate identity and inspected evidence

- Normative SPEC: `spec/SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md`, SHA-256 `5db704433ef8996d8737f056eceb45a8318fc35d42db484e76f35f645111cb7a`.
- Manifest: `spec/CANDIDATE.json`, SHA-256 `f6126daaefb2c0d468c3af1411b80797fc330378a404b268f85ca5a885560e1c`.
- Candidate ID: `sha256:456ff6a031a5ed779ea8535365aff283bd6187589007f8e26963b649dbefdc3a`.
- `candidate_manifest.py check spec/CANDIDATE.json` returned `matches: true`, with no mismatches. The manifest lists the single SPEC as normative; manifest, coordination document and reports are outside the normative set. This check establishes byte identity, not semantic completeness.
- Candidate PLANNING: `spec/PLANNING.md`, SHA-256 `872c1187f9778f04f24de02945b86edf52b87c5eae5af3cc3e989fee3bfd3298`.
- Accepted First Draft rev. 2: SHA-256 `98329563e1ac24d1eeaa5753ad9490c10057cf9e9a065e912663ae1f3e907a9c`; its independent review `177264f784c3765e3ff05e44fad02737bf42ea8b6b1fcfe5f4abe81280dd9ff4` is `DRAFT_VALIDATED_FOR_DISCUSSION`.
- Current Plugin Foundation source fingerprints rechecked: `DECISIONS.md` `727d55583268cc8fca1a0cd21aa1b059fefdbc9c125cc3434d97d9941750308e`; `ISSUES.md` `1e268cb7a699e71ae7f3669c0f60158601ba581153e175407ea2ef4722c0d868`; `REFERENCES.md` `8b8e1498877e440080d631c6ef1d071e96af617d0d495383a808965d10c5b6dd`. These contain current D-019/D-020, I-021/I-022 and REF-020.
- Raw intent was independently checked using built-in `read_thread` on local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, “Map Fusion–OpenCode chat failure states.” Current “Send to SPEC creation” instruction and settled turns concerning narrow `file:changed` ledger retirement, future snapshots not gating current retirement, obsolete screenshot-folder monitoring, conditional Apple Calendar listener removal and preserving Google polling were confirmed. No thread-history boundary or checkpoint state was changed.
- Re-read the current User Preferences, Code Standards hub and all routed articles used for cleanup, event behavior, persistence, harness and smoke planning; the mandatory Chat overview; Chat Harness Boundary, Runtime Model, Chat Testing and Operations, Screenshot Capture, and Calendar View. Their current fingerprints match those stated in the SPEC. Relevant current rules include reuse of existing owners and no new route without a need, preserving server-owned prompt acceptance and exchange persistence, and testing the public route with durable readback.
- Current actual Plugin Foundation `INTENT.md` and `TICKET.md` fingerprints are `034d8ea1fc3a5e34be7ec3faa9d831b52eab157d065f757fb385186e701148bd` and `6e6b56e88742c93edc6783aac58bb6ecba63b4071a28eb061652080905143fe7`; the SPEC table lists older values for these two contextual documents. The decision/issue/reference files that carry the operative D-019/D-020/I-021/I-022/REF-020 trace are current as cited. This is recorded as a non-blocking provenance advisory below.
- Inspected source/test contracts in SPEC §§1–11, its four ordered slices and RV2-A01 assignment; sampled the source inventory and current scoped worktree status for package/lock, shared and broad watchers, startup, screenshot direct/watch paths, Calendar, workspace lifecycle, OpenCode adapter, screenshot client, ledger/subscriber and chat metadata collector. Existing source fingerprints and their disposition are recorded in SPEC §3. No runtime tests were run; those are properly assigned to approved implementation.

## Four-perspective coverage

| Perspective | Sources and evidence examined | Conclusion and limits |
|---|---|---|
| **Intent, authority and coverage** | Original owner conversation; owner amendment and accepted First Draft; SPEC §§1–4, 7, 9–11; current D-015/D-016/D-019/D-020, I-021/I-022 and REF-020. The candidate commits to Chokidar/watch-registration/startup-refresh removal, only `file:changed` ledger-write removal, then real public chat proof. It explicitly says the Apple watcher is the sole current automatic Apple refresh callback, imported rows remain and may stale, and Google remains separate. | Owner scope and supersession are represented accurately. Snapshot/fallback/UEB delivery is future work and no gate; Together retry/warm-up is unconfirmed and separate. Calendar interim impact and its separately owned I-021/I-022 future resolution are now explicit. No new owner choice is silently inferred. |
| **Architecture, standards and preferences** | Full current User Preferences and Code Standards hub/routed Architecture Routing, WebSocket Protocol, UEB, Harness Adapters, Persistence and Metadata, and Testing/Smoke pages; mandatory Chat overview; chat runtime/harness/test contracts; Screenshot and Calendar owner pages; SPEC §§2, 5–7. | The one-SPEC structure is cohesive and adds no new protocol, route, detector, storage schema, or replacement watcher. It preserves canonical prompt/thread routing, existing persistence owner, the direct screenshot public flow, event/cron ownership, and independent save/tool observation. Candidate scope aligns with narrow abstractions and test-at-public-boundary rules. No architectural blocker found. |
| **Dependencies, blast radius and brittleness** | Current source inventory and scoped status; SPEC §§3, 5–9. Checked relevant flows for package dependency, watcher lifecycle/startup, screenshot source refresh vs. direct capture, Apple callback vs. Google poll, selective ledger behavior, file metadata collection and OpenCode conditional investigation. Calendar current authorities D-019/D-020 and issue ownership I-021/I-022 were read directly. | S1–S4 order handles downstream detachment before shared watcher/dependency removal and preserves unrelated producers/consumers. Apple no-wait/no-race proof and interim stale-row consequence are explicit; its replacement is not a prerequisite. The candidate does not assert descriptor count or leaked handles as root cause. No material dependency or blast-radius gap found. |
| **Verification, evidence and handoff** | Current manifest and helper check; SPEC §§4–11; routed testing/chat contracts; documentation ownership/timing table; candidate-stage input/review context. | Acceptance checks are observable and appropriately deferred to an approved implementation: direct ledger and screenshot contracts, Apple no-wait plus preserved Google/Calendar surface, startup/trigger inventory, and authenticated public chat with actual OpenCode process/session, completed response, durable exchange and readback. A generic spawn, startup readiness, `wire_ready`, or FD observation cannot pass chat acceptance. Wiki/test/source-map updates have owners and timing; candidate does not claim tests or runtime verification were performed. Manifest's one-SPEC inventory is complete for this bounded package. |

## Findings and advisory

No unresolved material finding remains from the prior candidate-stage review. The repaired SPEC now correctly cites and propagates D-019/D-020 and I-021/I-022/REF-020, including the precise interim Calendar behavior and non-gating future native-monitoring work.

### Advisory CS-R2-A01 — Refresh contextual Plugin Foundation fingerprints before release

- **Severity:** advisory; **confidence:** high.
- The SPEC §3 table gives `INTENT.md` hash `a245a4d8…` and `TICKET.md` hash `1e43d555…`; current bytes hash to `034d8ea1…` and `6e6b56e8…`. Those current documents also reflect D-019/D-020, which are accurately traced in the candidate through the current `DECISIONS.md`, `ISSUES.md` and `REFERENCES.md` hashes. The mismatch therefore does not alter this stage verdict or the represented interim Calendar contract.
- Before release approval, either refresh these two hashes or remove them from the current-authority row if they are not required inputs. The SPEC already directs the implementer to refresh external authority hashes and check newer owner direction before execution.

## Deferral, freshness and limitations

- D-019 correctly rules out treating the approximately 30-minute repository-file snapshot fallback as Mail/Calendar freshness. D-020's plugin-owned native listener/query under System scheduling and governed UEB admission remains future direction, not current implementation. I-021/I-022 retain the bounded connector proof and open latency, permission, resource, lifecycle and admission contracts. None gates removal here.
- The Apple listener's removal intentionally ends current automatic Apple Calendar sync/refresh; cached imported rows may become stale. Calendar UI/routes and the shared broadcaster remain, while separately enabled Google polling is preserved. Candidate text does not imply Apple Calendar is deleted or replacement native monitoring is built.
- Local descriptor-boundary reproduction remains diagnostic evidence only; actual production pipe descriptor identity/leak is unproven. No production runtime, public chat, provider, Alpha or test claim was attempted in this review.
- Source checkout is dirty outside the scoped product list. This review did not modify or inspect unrelated concurrent files.
- The contextual `INTENT.md`/`TICKET.md` hash mismatch is non-blocking at candidate stage because current operative records are directly traced and implementation is explicitly required to refresh authorities; release review should confirm the final provenance row is accurate.

## Verdict

**`CANDIDATE_STAGE_VALIDATED`** — complete four-perspective review of the current candidate found no unresolved material candidate-stage issue. The repaired Calendar direction is faithful, bounded, and non-gating. One non-blocking contextual fingerprint advisory is recorded above. This verdict does not grant release readiness, owner scope approval, implementation approval, or permission to start product work.
