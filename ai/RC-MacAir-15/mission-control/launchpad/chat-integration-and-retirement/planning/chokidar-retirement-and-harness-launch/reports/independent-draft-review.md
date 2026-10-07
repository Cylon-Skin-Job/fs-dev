# Independent First Draft Review

## Assignment, independence and identity

- Mode: draft.
- Scope: First Draft for Chokidar retirement and local OpenCode spawn recovery; all four validation perspectives.
- Candidate: CHAT-AR-CHOCO-001 (discussion label; revision not otherwise numbered), ../FIRST-DRAFT.md, SHA-256 0054d127193fd211a367aa9e7712f228fb9036f08ef572f02405c79d4e6d4ce2.
- Author: separate runtime child /root/first_draft_stage/draft_author, verified from current collaboration roster. Reviewer: /root/first_draft_stage/draft_validator. I did not author or edit the candidate. Neither child has a persistent Codex thread UUID in the runtime evidence available to this reviewer.
- Recipient: owner, returned through the First Draft Supervisor.
- Reviewed: 2026-10-03 09:48 UTC (2026-10-03, America/Los_Angeles local date).
- Controller home: /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control. Memory CWD: /Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement. Read-only source checkout: /Users/rccurtrightjr./projects/fs-dev.
- Source revision: branch agent/exact-workspace-paths, HEAD d15792920731f85e45b743519d4af2b807d95a9c. At review, the checkout had 168 tracked modified paths and substantial untracked content. All specifically inspected candidate source paths were clean in path-scoped git status; no concurrent change to those paths was observed.
- Actual runtime capabilities were checked separately: this child had shell read access, built-in read_thread access, and the assigned collaboration channel. The actual effective filesystem profile was not inferred from repository configuration. No tests, app/server restart, database/provider operation, product edit, remote operation, or write outside this assigned report was performed.

## Four-perspective coverage

| Perspective | Examined evidence | Conclusion | Limits |
|---|---|---|---|
| Intent, authority and coverage | Original owner thread 01a0ea32-f152-77a2-afc2-b73e8976685a, local, title “Map Fusion–OpenCode chat failure states”; built-in settled-turn pages at cursors 1290 and 1040, including owner turns about the 30-minute fallback, screenshot retirement, unfinished Calendar, First Draft → SPEC gate, and reversion. Current folder INTENT.md; Plugin Foundation D-015/REF-018; candidate bytes. | Candidate preserves scope, separates old screenshot-folder import from direct capture, separates Apple Calendar watch from Google polling, keeps broad failure map and Together retry out of scope, and treats absent scanner as a gating question. Reverted patch/tests are not represented as implementation. | Relevant settled pages were read; this is not an exhaustive history checkpoint. Older folder records were treated as context and not used to override the new explicit assignment/source turns. |
| Architecture, standards and preferences | Full User Preferences and Code Standards hub; full routed Architecture Routing, WebSocket Protocol, UEB, Harness Adapter, Persistence, Testing/Smoke Slices pages; Chat overview, File Versioning, Resource Events/Render Sync, Correlation/Causality, Screenshot Capture, Calendar View, Chat Harness Boundary and Chat WebSocket Protocol. Current D-015/REF-018. Current watcher/startup, screenshot handler, Calendar index and OpenCode adapter. | Draft maps existing owners and consumers, protects governed UEB boundaries, preserves bounded existing snapshots, avoids causal claims from watcher timing, and selects no replacement architecture. One material authority ambiguity is reported as DRAFT-01. | UI/state-management routes were not applicable to this non-UI draft. Some documentation describes bounded 2026-09-19 inspections, not fresh runtime certification. |
| Dependencies, blast radius and brittleness | Current package.json, watch/core.js, workspace-watcher.js, startup.js, screenshot/ws-handlers.js, watch/calendar-watcher.js, calendar/index.js, workspace-controller.js, harness/opencode/index.js, and client chatScreenshotCapture.ts; hashes checked against draft and path-scoped Git status clean. Raw Alpha observations, disposable spawn/native-boundary JSON, pinned apple-posix-spawn.c and native-directory-watch result summary. | Draft identifies broad watcher consumers, machine/root scope and cleanup, chat-turn attribution risks, screenshot refresh side effect, Calendar/provider distinction, and avoids asserting a Chokidar leak or traced production pipe IDs. CD-01 appropriately remains conditional: accepted fallback behavior is specified, but scanner is absent. | Failure and watcher feasibility evidence are dated experiments/observations, not current product tests or direct trace of the production pipe descriptor. Native fs.watch probe kept descriptor count at 17 with 2,000 fixtures, but emitted 1,071 raw events, so it demonstrates resource feasibility only, not semantic parity. |
| Verification, evidence and handoff | Proposed smoke cards; Testing/Smoke Slices; Chat contracts; raw incident artifacts; exact candidate hash rechecked after the pre-review Calendar clarification. | Four observable candidate paths and important regressions are represented. Smokes are labeled proposed, and the First Draft → SPEC → owner approval → implementation gate is explicit. Candidate identity is stable at the hash above. | No product tests were run or claimed. Calendar clarification was checked against final candidate bytes; no live Calendar/Google call was made. |

## Findings and dispositions

### DRAFT-01 — Clarify permission requests versus System grants

- Severity/confidence: material to the authority model; high confidence.
- Affected artifact: FIRST-DRAFT.md, Status and basis, second owner-direction bullet; related snapshot wording in source coverage.
- Evidence: Draft wording says “System owns snapshot execution and its repository-local SQLite ...; plugins declare/grant permissions and sources/destinations.” Current Plugin Foundation D-015 says plugins supply permission/grant configuration and authorized source/destination declarations, while System validates and enforces approved grants. Current Code Standards/UEB/Persistence distinguish permission requests from effective grants and prohibit plugins from granting themselves authority.
- Consequence: Read literally, the draft assigns plugins authority to grant their own snapshot access, changing the core owner/security boundary and misdirecting later SPEC shaping.
- Required resolution: Say plugins declare/request permissions and source/destination scope, while System validates and enforces separately approved grants. Keep exact store/schema/path unresolved and general snapshot implementation outside this draft.
- Disposition: Unresolved in reviewed bytes; edit candidate and request a fresh draft review.

No other material finding. Suggestions: none.

## Deferrals, untested claims and remaining conditions

- CD-01 remains conditional. Owner accepts delayed external-change detection with the approximately 30-minute scan preceding subscription-trigger execution. The scanner, lifecycle and repository-local store are absent from the reviewed baseline and outside this assignment. The draft properly treats broad Chokidar removal/trigger continuity as blocked until a narrow existing path, dependency ordering on a separately authorized fallback, or explicit suspension/deferment is resolved. Disclosure alone does not make implementation safe.
- CD-02/CD-03 remain proposed. Direct screenshot capture, correlated save/attachment, incidental refresh use, Calendar no-wait behavior and Google poll wiring need bounded executable-planning validation. Draft keeps unfinished Calendar UI distinct from listener retirement.
- CD-04 remains an unverified remedy. Raw evidence supports a macOS posix_spawn descriptor-number boundary: valid fd 10239 was accepted and 10240 rejected in native file-action calls; disposable Node 25.6.1/libuv 1.52.0 piped launches succeeded at lower ranges and synchronously returned EBADF at higher ranges. Alpha observations show accepted/claimed attempts followed by spawn_throw EBADF, no PID/session, and about 16,222 descriptors; sampled files extend beyond the Alpha machine subtree. This is a strong explanation, not proof of a Chokidar leak or that removal alone fixes OpenCode. Production pipe descriptor IDs were not traced.
- Existing user-save preimages, sparse admitted post-tool observations and shadow Git checkpoints are narrower mechanisms; they do not implement the general workspace scanner or fallback.
- Future screenshot System-event publication is outside this draft. Together.ai retry/provider warm-up remain separate and unconfirmed. No provider probes or runtime operations were performed by this review.
- Dirty/concurrent non-target checkout state remains. Fingerprinted target code matched the candidate at review. This is a discussion draft, not an executable candidate; no release manifest is required.

## Return

Verdict: REVISE. The discussion skeleton is otherwise useful and source-faithful, but the permission wording conflicts with the approved System-grant boundary. Correct the sentence and run a fresh independent review against the changed hash. Preserve CD-01's conditional hold. This verdict/draft does not authorize SPEC creation or implementation.

Exact candidate hash reviewed: 0054d127193fd211a367aa9e7712f228fb9036f08ef572f02405c79d4e6d4ce2.
Source checkout remained agent/exact-workspace-paths / d15792920731f85e45b743519d4af2b807d95a9c; inspected target paths had no working-tree changes.
