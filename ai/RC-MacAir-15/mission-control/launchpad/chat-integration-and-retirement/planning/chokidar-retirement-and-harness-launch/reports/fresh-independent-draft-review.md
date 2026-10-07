# Fresh independent First Draft validation

## Review record

- **Mode:** `draft`
- **Candidate:** `planning/chokidar-retirement-and-harness-launch/FIRST-DRAFT.md`
- **Candidate identity:** SHA-256 `215951fe581bfb8c3d7d26b8608a071806cfccf029d216e22f36a2624c3dede1` (matches the assigned expected hash)
- **Reviewer:** `/root/first_draft_stage/fresh_draft_reviewer`, fresh leaf reviewer; no durable task UUID was exposed by the runtime. Candidate author and stage reviewer are separate roles.
- **Recipient:** assigning First Draft stage/supervisor; owner-facing result is for the owner in the planning session.
- **Reviewed:** 2026-10-03 09:54 UTC
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`
- **Memory CWD:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`
- **Read-only source checkout:** `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`.
- **Write ownership:** only this report path. I did not edit the draft, prior review, shared records, or source checkout.

I confirmed memory CWD and source checkout independently. The product checkout has extensive unrelated dirty and untracked content; path-scoped status for the reviewed Chokidar, startup, screenshot, and Calendar targets was clean at review. Actual runtime here exposed local read/write and Codex review tools; that is not evidence of product runtime health. No application, server, database, provider, Alpha, or test operation was run. No delegation was attempted by this leaf reviewer.

## Authority and evidence inspected

- Read the complete Mission Control `session-contract.md`, `mc-planning-validation/SKILL.md`, and shared planning contract at `mission-control/.agents/skills/mc-roadmap-creator/references/planning-contract.md`.
- Read this folder's `AGENTS.md`, `TICKET.md`, `index.json`, `INTENT.md`, and `BULLETIN.md` for local authority, current boundaries, and open handoffs.
- Read original owner conversation through built-in `read_thread` for local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, title “Map Fusion–OpenCode chat failure states.” Relevant direct owner wording included the delayed trigger sequence (“the mutation will get caught 30 minutes on the static check schedule, THEN the trigger will run if it was watching a file”), screenshot monitor retirement and future-event deferral (turn `01a1010f-a9b8-7202-b6f9-cbce3e36f2e7`), Calendar unfinished status and no-wait condition (turns `01a10110-bf61-7a70-9bce-4fc96aaa2c16`, `01a10111-9eb3-7632-8e09-2c016e6d4293`), and the owner's explicit First Draft → SPEC → approval → implementation correction. I also read the prior incident/research exchanges in that thread. This was a targeted settled-turn read, not a full history checkpoint; no checkpoint state was read or advanced.
- Read the complete current User Preferences, Code Standards hub, and all routed pages relevant here: Architecture Routing, WebSocket Protocol, Universal Event Bus, Harness Adapters, Persistence and Metadata, and Testing and Smoke Slices. Read the Chat System overview plus current screenshot and Calendar source paths and the OpenCode spawn path.
- Checked current Plugin Foundation `DECISIONS.md` D-015 and `REFERENCES.md` REF-018, and source/evidence referenced by the candidate. Raw incident evidence inspected in `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/alpha-chat-launch-ebadf-ecobqazx/` includes `observations.json`, `spawn-fd-repro.json`, and `native-spawn-fd-boundary.json`; the boundary probe reports acceptance at 10239 and rejection at 10240+. The native directory watcher experiment at `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/native-directory-watch-check-3w9ilirn/result.json` held descriptor count at 17 with 2,000 fixtures, while its events still required reconciliation. These are disposable probes, not product validation.

Selected current source fingerprints (SHA-256):

- `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md`: `45fa9f630563d79935d5a461b308c823c0db3ded5c23817ba6d4c8a06c794ed5`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`: `de3995c68ae84f3b0fa389c6af0327e21dd08f30ac9ffbc7548b76f80ac393d7`
- Routed standards, same paths named above: Architecture Routing `4c5fcbf62912c9e8ff6d3d0e1ec07016145e1f1c90c792a162dfcc3ca1b0bfba`; WebSocket Protocol `5b77528cec69d60c11c0487a349ec1cfb0b9a47eb69c213dedd1fbf1797dbad6`; UEB `4407d595f6f926996bd8bcacb6b0117849606de61662acfe463c3d80f8f4f640`; Harness Adapters `5ece90e88dac136f7ec464b0219a3eb242b7837d118dbbdaba57de673b8a5919`; Persistence and Metadata `bd3e7be468289ac0a6ee6502cd8b9fc340f03fd7568deb59370ed00cc3b2a7a3`; Testing and Smoke Slices `e7319750bd27b7ccdad8e5e451b9779044e8fc7a713fc6d461113b409b39018d`.
- Chat overview: `696afb2d3ec027256e783957c3461eb03300db0b97b34b3e62162977c22ed42f`; Plugin Foundation D-015 source `5710698d87f01b4ffa300481ad57bb556dac7f0d0333b9ff213272d775eef919`; REF-018 source `28718416b12a0a121c4dbe838193a130bb9abe50a54356deb9e54c139e4ae938`.
- Current code: `fusion-studio-server/lib/watch/core.js` `3f0ea12c0732d0e44721709e21681358514aae7145c96d7763e81996829b8ba2`; `lib/startup.js` `9e6d99316fde584d08828685c3df762d1ea3e557d118b1e1207defe52993e382`; `lib/screenshot/ws-handlers.js` `4fe5c9bf3a55a59c0c68931cd6bb584154ad9229691ed6e173700684c137ac14`; `lib/calendar/index.js` `3677e7563383c9e4c0b56077212247a7dab838a7492a1cc6ea4849b44804407b`; `lib/harness/opencode/index.js` `5dbe53e8f262661164dca0a87ab3f217ead35150629fd43ca42020685f9973e0`.

## Four-perspective coverage

| Perspective | Sources and evidence | Conclusion | Limits |
|---|---|---|---|
| Intent, authority, coverage | Folder assignment records; owner conversation and turns above; D-015/REF-018; candidate status, scope, CD-01–04, question queue. | Draft preserves most authority: Chokidar removal, no implicit general scanner, delayed trigger intent, user-save versioning, screenshot monitor retirement/direct capture, unfinished Calendar, separate Google poller, distinct Together retry, and First Draft → SPEC → approval → implementation. One P0 question weakens faithful propagation of the already-set trigger decision; see F-01. | Thread review was targeted to relevant settled turns, not an exhaustive checkpoint. No owner intent was inferred from code or search. |
| Architecture, standards, preferences | Full User Preferences, Code Standards hub and routed pages; Chat overview; `lib/watch/core.js`, startup, screenshot handler, Calendar startup and OpenCode spawn path. | The draft identifies existing owners and avoids choosing a replacement watcher prematurely. It separates legacy watcher topics from governed UEB admission, file-save preimages from a general scanner, provider adapter syntax from chat protocol, System snapshot storage from `fusion.db`, and screenshots/Calendar paths from unrelated features. It cites observable public-route smokes at draft-appropriate detail. | No design or implementation was validated. Existing standards pages retain their own evidence dates and scope. |
| Dependencies, blast radius, brittleness | Current imports/registrations and direct consumers; workspace root lifecycle; screenshot direct handler's `sourceFolderService.refresh()` and `hotkeyScreenshotWatcher.refresh()` calls; Calendar's separate Apple watcher and Google poller; raw descriptor probes. | Candidate captures material consumers, cleanup/switch scope, turn-attribution risk, screenshot side effects, Calendar no-wait condition, and uncertainty between FD mechanism and production cause. It does not claim that a Chokidar leak or its removal proves the launch fix. | Full behavioral contract for every legacy consumer and actual live production pipe descriptor numbers remain unverified; correctly held for later shaping/implementation evidence. |
| Verification, evidence, handoff | CD smoke scenarios; raw spawn/native-watch probes; source hashes; status/ownership boundaries. | Useful vertical-slice skeleton and handoff exist; smokes are visibly proposed, not reported as run. Candidate identity is exact. Open questions name affected cards, why answers matter, resolvers/evidence, and gate stage. The single material intent-framing defect is captured in F-01. | No tests, runtime checks, candidate manifest, release validation, or implementation approval are required or claimed at First Draft. |

## Findings

### F-01 — Preserve the settled delayed-trigger requirement as a constraint, not an open suspension choice

- **Severity / confidence:** Material for faithful planning scope; high confidence.
- **Classification:** `REVISE` (correctable draft defect; not missing owner intent).
- **Authority/evidence:** The original owner message in the built-in thread begins “Okay, this is getting messy. How does the screenshot watcher work and what does it do?” and states that on a missed immediate change, the 30-minute static check catches the mutation, **then** the file trigger runs. (The native reader excerpt used for this review did not preserve that message’s turn UUID.) This same direction is explicit in the new assignment and is restated accurately in the draft's owner-direction section and CD-01. The draft's P0 queue nevertheless asks whether external-change triggers are “explicitly suspended” before the fallback exists, presenting suspension as an unresolved owner option.
- **Affected artifact/scope:** `FIRST-DRAFT.md`, CD-01 prerequisite/open question and P0 decision row.
- **Consequence:** A later shaping/creation stage could treat loss of eventual trigger execution as an owner-approved option, dropping a required outcome or silently converting the accepted latency tradeoff into feature suspension. The draft correctly notes the fallback is absent and out of this assignment; that absence creates a sequencing/dependency question, not uncertainty about the stated behavior.
- **Required resolution:** Reframe the queue around how to sequence the Chokidar retirement against the separately authorized fallback or another already-approved observation path. State that removing the only trigger-input observation path before that dependency is available holds affected retirement, unless the owner explicitly changes the settled behavior. Do not create the fallback in this draft or imply it exists.
- **Disposition:** Unresolved in the reviewed bytes; no repair was attempted.

## Advisory notes

- The draft is appropriately explicit that its OpenCode smoke must exercise prompt acceptance, real child/session, canonical stream and persistence, while preserving truthful accepted-prompt failure behavior. Keep FD footprint as a strong explanation, not a proven production root cause.
- The direct screenshot route currently refreshes source-folder/hotkey state inside `screenshot:file-capture`; CD-02 correctly leaves that side effect for caller/contract lookup.
- Owner acceptance of the approximate 30-minute delay does not establish exact schema, scanner lifecycle, source/destination grant implementation or storage migration. D-015 keeps those as distinct System-owned planning dependencies; candidate does not implicitly implement them.

## Deferrals, source changes, and review limits

The draft's deferrals are generally bounded: general repository scanner and repository-local SQLite, future screenshot System event, Together.ai retry, and unselected native watcher/polling architecture remain outside this assignment. User-edit versions and admitted post-tool observations are not mislabeled as general workspace snapshots. Candidate correctly discloses dirty concurrent source content and reports only scoped source-path cleanliness. The source checkout still contains Chokidar and watcher registrations, as expected for planning.

I did not find a missing runtime capability that prevents this draft review. The full First Draft threshold is otherwise met, but F-01 is a material mismatch with direct owner direction. Required next step: stage routes this finding for a draft-only correction, then obtains a fresh independent draft review against the revised bytes. No owner approval for product scope or implementation is requested by this report.

## Verdict

**`REVISE`** — The draft is close to discussion-ready and its broad coverage is strong, but the P0 trigger question must preserve the settled delayed-trigger outcome and ask only the unresolved dependency/sequencing question. This verdict is for this exact candidate hash; it does not authorize SPEC creation, implementation, tests, product edits, or reopening SPEC-06.
