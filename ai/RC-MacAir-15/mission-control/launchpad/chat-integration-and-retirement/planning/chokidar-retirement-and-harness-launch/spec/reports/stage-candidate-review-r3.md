# Candidate Stage Independent Recheck — Revision 3

## Assignment and identity

- **Mode:** `candidate-stage`
- **Scope:** Fresh independent recheck of the corrected candidate after its narrow Plugin Foundation provenance update; four perspectives.
- **Reviewer:** `/root/spec_candidate_stage/candidate_stage_final_recheck` (fresh leaf reviewer; not the author `/root/spec_candidate_stage/candidate_author` and not either prior candidate-stage reviewer).
- **Recipient:** `/root/spec_candidate_stage`.
- **Timestamp:** 2026-10-03 (America/Los_Angeles).
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.
- **Memory CWD:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement` (verified with `pwd`).
- **Separate source checkout:** `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`.
- **Write ownership:** This report only: `planning/chokidar-retirement-and-harness-launch/spec/reports/stage-candidate-review-r3.md`. Candidate and every other report were read-only.
- **Runtime capability:** Verified shell read access to assigned CWD, checkout root/branch/HEAD, candidate bytes, source files, and manifest helper; the assigned report path is writable. Repository status is extensively dirty overall, while the SPEC-listed implementation paths had no status entries. No delegation, product/test/Wiki/database writes, application/runtime/provider/chat operation, Alpha operation, checkpoint operation, or external message was attempted.

## Candidate identity and source freshness

- **Normative SPEC:** `spec/SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md`, SHA-256 `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3`.
- **Manifest:** `spec/CANDIDATE.json`, SHA-256 `8ef475f5d2a4043ab3e4ae36ebbb97e14dcc549dc9a9282866763ef42c74ce27`.
- **Candidate ID:** `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`.
- `candidate_manifest.py check spec/CANDIDATE.json` returned `matches: true`, no mismatches. The normative set contains the one SPEC; manifest, reports, and mutable coordination log are outside it. This is byte identity only; completeness was reviewed separately.
- Confirmed that the update from the prior reviewed candidate is limited to the two stale contextual Plugin Foundation fingerprints; the scope, requirements, slices, deferrals, acceptance criteria and implementation boundary are unchanged.
- Corrected `INTENT.md` and `TICKET.md` fingerprints are accurate against current bytes: `034d8ea1fc3a5e34be7ec3faa9d831b52eab157d065f757fb385186e701148bd` and `6e6b56e88742c93edc6783aac58bb6ecba63b4071a28eb061652080905143fe7`.
- Current operative Plugin Foundation records also match the candidate: `DECISIONS.md` `727d55583268cc8fca1a0cd21aa1b059fefdbc9c125cc3434d97d9941750308e`; `ISSUES.md` `1e268cb7a699e71ae7f3669c0f60158601ba581153e175407ea2ef4722c0d868`; `REFERENCES.md` `8b8e1498877e440080d631c6ef1d071e96af617d0d495383a808965d10c5b6dd`. Directly checked D-019/D-020, I-021/I-022 and REF-020 content.
- Other current inputs checked: accepted First Draft revision 2 `98329563e1ac24d1eeaa5753ad9490c10057cf9e9a065e912663ae1f3e907a9c`; its independent review `177264f784c3765e3ff05e44fad02737bf42ea8b6b1fcfe5f4abe81280dd9ff4`; owner amendment `b564b62e86d968d56ae39e60f9f51be9e9e9cd5ff341dfcd901557fb5157e9e2`; candidate preparation packet `spec/PLANNING.md` `872c1187f9778f04f24de02945b86edf52b87c5eae5af3cc3e989fee3bfd3298`; parent `PLANNING.md` `f3e8a8f92235c2014be3b2baa8fcca1ff2a7c0aee0b96168014a376afde21e89`.
- Used built-in `read_thread` on local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, “Map Fusion–OpenCode chat failure states.” Verified the current “Send to SPEC creation” direction and relevant settled turns: `01a10175-68e2-7331-bfb1-088491f953bb` (`file:changed` ledger disabled), `01a10176-97e1-7932-ace6-c77e2f8999c2` (snapshot/event-trigger work is future; remove Chokidar and establish chat), `01a101a8-ac8f-7542-b2c9-15a6a7117211` (future snapshot work routed to Plugin Foundation), and `01a1010f-a9b8-7202-b6f9-cbce3e36f2e7` (old screenshot monitor obsolete; Calendar callback may retire absent race/wait). No checkpoint/history boundary was changed.
- Read the current User Preferences, Code Standards hub and applicable routed standards (Architecture Routing, WebSocket Protocol, UEB, Harness Adapters, Persistence/Metadata, Testing/Smoke), plus the required Chat overview, Harness Boundary, Chat Testing and Operations, Runtime Model, Screenshot Capture and Calendar View. The User Preferences, Code Standards hub and Chat overview hashes are respectively `45fa9f630563d79935d5a461b308c823c0db3ded5c23817ba6d4c8a06c794ed5`, `de3995c68ae84f3b0fa389c6af0327e21dd08f30ac9ffbc7548b76f80ac393d7`, and `696afb2d3ec027256e783957c3461eb03300db0b97b34b3e62162977c22ed42f`. Relevant rules support reuse of existing owners, selective legacy event behavior, server-owned prompt acceptance/exchange persistence, no unwarranted new route or replacement abstraction, and public-route plus durable-readback verification.

## Four-perspective coverage

| Perspective | Evidence examined | Conclusion and limits |
|---|---|---|
| **Intent, authority and coverage** | Raw owner turns and amendment; accepted draft; current D-015/D-016/D-019/D-020, I-021/I-022, REF-018/019/020; SPEC §§1–4, 7, 9–11. | Scope is faithful: remove Chokidar and dependent registrations/refresh calls; disable only `file:changed` ledger recording; then prove normal public chat. Future snapshot storage, fallback/UEB trigger delivery, native Apple monitoring and Together retry/warm-up do not gate this work. D-019/D-020 and I-021/I-022 are represented without changing removal scope. Existing Apple rows may stale when the sole callback is retired, and Google polling/UI remain. No unresolved owner choice is silently converted to a requirement. |
| **Architecture, standards and preferences** | Full current standards and domain sources listed above; SPEC §§2, 5–7. | One bounded SPEC is justified. It adds no route/protocol, watcher replacement, schema, migration or new storage owner. It retains the existing prompt/thread/persistence/harness boundary, independent event/cron subscriptions, direct screenshot flow and separate Google poller. Slice order and stated removal boundaries align with narrow-change and public-route verification rules. No material architectural issue found. |
| **Dependencies, blast radius and brittleness** | Current SPEC §3 source inventory and scoped status; SPEC §§4–9; source paths for package, shared/broad watcher, startup, screenshot direct and watcher paths, Calendar, workspace lifecycle, OpenCode adapter, ledger/subscriber and chat metadata collector; current Plugin Foundation authorities. | S1–S4 detach narrow consumers before the shared watcher/dependency removal, preserve workspace/thread ledger durability, unrelated event producers and late-turn safeguards, and document automatic Apple refresh loss. Calendar no-wait/no-race proof is a release condition; I-021/I-022 remain separate future ownership. Actual production pipe identity/leak is not inferred from descriptor reproduction. No material dependency or blast-radius omission found. |
| **Verification, evidence and handoff** | Candidate manifest/helper; SPEC §§4–11; testing and chat contracts; test inventories, S1–S4 commands, public-chat steps and RV2-A01 docs assignment. | The candidate assigns focused ledger/screenshot/Calendar/startup/trigger checks and a public authenticated OpenCode chat scenario requiring a real process/session, completed response, durable exchange and history readback. Failure must be diagnosed from the observed boundary; helper spawn, FD count, server boot or `wire_ready` cannot pass. Tests and runtime checks are planned work, not claimed results. Wiki/source-map and startup/test inventory updates have owners and timing. The one-SPEC manifest is complete for this package. No runtime/test verification was performed in this review. |

## Findings and disposition

No unresolved material finding. The prior contextual fingerprint advisory is **resolved**: both corrected hashes match current bytes, and the operative decision/issue/reference hashes remain current. No scope change was introduced by the correction.

No new advisory is warranted. The previously established evidence limits remain explicit in the candidate: sparse descriptor-boundary evidence does not prove production pipe identity, a leak, or that Chokidar removal alone fixes chat; actual public OpenCode acceptance belongs to later approved implementation.

## Verdict

**`CANDIDATE_STAGE_VALIDATED`** — complete independent review of the current candidate found no unresolved material candidate-stage issue across all four perspectives. The correction is provenance-only and accurate. This verdict does not grant release readiness, owner approval, implementation approval, or permission to start product work.
