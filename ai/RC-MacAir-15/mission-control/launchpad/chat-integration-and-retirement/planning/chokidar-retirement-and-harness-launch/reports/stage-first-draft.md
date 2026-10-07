# Stage Report — First Draft: Chokidar retirement and OpenCode launch recovery

## Assignment and checkpoint

- **Planning ID:** CHAT-AR-FD-CHOKIDAR-OPEN-CODE-001
- **Stage:** `stage:first-draft`
- **Return:** `FIRST_DRAFT_READY_FOR_DISCUSSION`
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`
- **Memory CWD:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`
- **Read-only source checkout:** `/Users/rccurtrightjr./projects/fs-dev`
- **Source revision:** branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c` (verified at stage start and final check).
- **Owner intent source:** Built-in `read_thread`, local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, title “Map Fusion–OpenCode chat failure states”; stored CWD matched the assigned folder. Relevant settled pages were read; no checkpoint cursor was advanced.
- **Final draft:** [FIRST-DRAFT.md](../FIRST-DRAFT.md), SHA-256 `86e4dfa898587cdb4f7c4b0edb46ed8cec5a9a77a27e8e8e48e2198bd1487a06).
- **Recipient:** Owner, through the First Draft supervisor.
- **Write ownership observed:** This report only; author owned FIRST-DRAFT.md; reviewers owned their separate reports. Supervisor-owned PLANNING.md and shared Launchpad/MC records were not edited.

The product checkout contained extensive unrelated dirty and untracked content (intake documented 488; subsequent status listings differed as untracked files appeared). It was preserved. All inspected target product paths were clean in scoped `git status` at final validation; their fingerprints match the candidate. No product code or tests were changed/run. No app/server, database, provider, Alpha, remote Git, publishing, or deployment operation occurred.

## Assignments and reports

- **Stage orchestrator:** this assigned runtime child, `/root/first_draft_stage`; owned coordination and this report.
- **Author:** `/root/first_draft_stage/draft_author`, runtime child with no persistent UUID exposed. Owned only `../FIRST-DRAFT.md`. Delivered four provisional candidate cards, observable proposed smokes, dependencies, source/standards coverage, fingerprints and decision/research questions.
- **Initial independent reviewer:** `/root/first_draft_stage/draft_validator`, runtime child. Owned only [independent-draft-review.md](independent-draft-review.md), SHA-256 `51395ec3ec37f4d5cc7ee5d146070df1901587673d16a4bf1c6fc62ea7fe3ef3`. Verdict `REVISE`; finding DRAFT-01 identified ambiguity between plugin permission declarations and System-approved grants.
- **Fresh independent reviewer:** `/root/first_draft_stage/fresh_draft_reviewer`, runtime child. Owned only [fresh-independent-draft-review.md](fresh-independent-draft-review.md), SHA-256 `912cb3454fd1abd63f7ff1cab4c218440701d39d8bdba91777dbac60ca2ed107`. Verdict `REVISE`; finding F-01 identified an open suspension option inconsistent with the owner's settled delayed-trigger behavior.
- **Final fresh independent reviewer:** `/root/first_draft_stage/final_draft_reviewer`, runtime child. Owned only [final-independent-draft-review.md](final-independent-draft-review.md), SHA-256 `cbafb2e50712ee02e4a96b1230b232c687f3407f85d80863f15f7090319e4692`. Verdict `DRAFT_VALIDATED_FOR_DISCUSSION`, no material findings, on the exact final hash above.

Actual runtime delegation succeeded for the author and successive independent reviewers. Each was a distinct runtime child; durable Codex thread UUIDs were not exposed. Effective access was verified through the operations each child actually performed; repository config was not treated as proof of session permissions.

## Coverage and candidate summary

The draft retains four discussion-level seams:

1. **CD-01:** Broad Chokidar observation and consumer dispositions, conditional on preserving watcher-fed behavior and dependency/readiness for the separately authorized fallback. It records current root/lifecycle and consumer questions without asserting a leak or choosing a replacement.
2. **CD-02:** Retire the old macOS screenshot-folder monitor while preserving the direct in-app capture, correlation, save and chat attachment path; identify incidental refresh behavior for follow-up.
3. **CD-03:** Retire the optional Apple Calendar directory listener only if no startup/UI path waits or races on its callback; keep unfinished Calendar functionality and separately opted-in Google polling distinct.
4. **CD-04:** Address the synchronous OpenCode spawn failure and verify real child/session, canonical stream and persistence while keeping the user-facing failure truthful. The descriptor boundary is a strong explanation, not a proven production FD identity, Chokidar leak or sufficient fix.

The candidate marks smokes as proposals, provides a source/standards coverage map and explicit owner questions, and stops before executable SPECs. It preserves SPEC-06 acceptance, defers Together.ai retry and unconfirmed server warm-up, and does not imply that the repository-local scanner or SQLite schema/path/migration exists.

## Finding ledger and dispositions

| Finding | Review | Disposition and evidence |
|---|---|---|
| DRAFT-01 | Initial reviewer, high-confidence material authority ambiguity: “plugins declare/grant permissions” could imply self-granting. | **Repaired.** Author now states plugins provide permission/grant configuration and authorized source/destination declarations; System validates and enforces approved grants. Exact schema/path/migration remain unresolved and general scanner remains excluded. Final reviewer independently covered D-015 and found no material issue. |
| F-01 | Fresh reviewer, high-confidence material intent mismatch: P0 offered suspension of external-change triggers despite owner accepting fallback-detects-mutation, then matching subscribed trigger runs. | **Repaired.** Draft fixes fallback-then-trigger as behavior and reframes P0 around dependency order/readiness. General scanner implementation/schema remain a dependency/out of scope. Final reviewer confirmed fidelity and found no material issue. |

Both earlier reviewer reports remain unchanged. The final independent report covers the exact repaired draft and reports no material finding. No findings remain unresolved for discussion validation. The unresolved owner/evidence questions in the draft are shaping questions, not silently promoted decisions; in particular, broad retirement remains conditional until fallback sequencing/readiness and consumer disposition are evidenced.

## Source and evidence limits

The candidate records SHA-256 fingerprints for authority, standards, domain contracts, source files and disposable experiments. The final independent reviewer independently checked the current candidate hash and the cited core source fingerprints, including watcher package/core/startup/workspace lifecycle, screenshot, Calendar and OpenCode adapter paths. Current User Preferences and Code Standards hub bytes were used despite broader dirty/untracked repository state.

The evidence supports the local synchronous `spawn_throw EBADF` incident before PID/session/provider contact, and isolated Node/libuv/macOS probes support a numeric descriptor-range boundary. Live production pipe descriptors were not traced, and a Chokidar leak was not established. Native directory watching evidence is feasibility-only and does not select an architecture. Existing user-save preimages, sparse admitted post-tool snapshots and shadow Git checkpoints are not a general workspace scanner. No tests or runtime validation are claimed.

Original owner direction controls over stale/contradictory historical folder proposals only within the stated scope. Plugin Foundation D-015/REF-018 and applicable routed Code Standards, User Preferences, Chat, UEB, file-versioning, resource-event/correlation, screenshot, Calendar and harness contracts were included in author/reviewer coverage. The final reviewer’s detailed hashes and coverage are in its report.

## Stop condition and next safe action

**Stage status: `FIRST_DRAFT_READY_FOR_DISCUSSION`.** The independently validated artifact is discussion-ready. The owner may discuss/revise shaping questions; a separate explicit authorization is required before SPEC/candidate creation. This report does not create executable SPECs/roadmaps, approve product scope, certify product behavior, or authorize implementation. The required sequence remains **First Draft → SPEC → owner approval → implementation**.

No next stage was launched. No checkpoint registry or conversation-history boundary was changed. Preserve the source checkout's unrelated dirty work and all three review reports. Do not replay product/runtime operations from this stage.
