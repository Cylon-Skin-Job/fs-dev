---
name: Chat Wiki Reconciliation Part 0
description: Fresh execution inventory, preservation evidence, and builder gate for the documentation baseline.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Part 0 — Exact execution baseline

Builder: `/root/wiki_part_0`. Scope: approved SPEC Part 0 only. Owner dispatch authorizes execution despite the preparation-only wording in the unchanged specification. No wiki repair or product/runtime health is claimed. Orchestrator acceptance is pending; Parts 1–7 have not started.

## Candidate and changed paths

Fresh capture timestamp: `2026-09-19T01:55:28.857415-07:00`. Primary development root: `/Users/rccurtrightjr./projects/fs-dev`. HEAD: `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. Branch: `agent/exact-workspace-paths`. These identify development source bytes, not the installed Alpha app or runtime health.

All builder writes are new evidence files under this capture:

- `EXECUTION-BASELINE.json`: raw `git status --short`, HEAD/branch/root/date, 38 active Chat pages plus one separately counted View Activity article, SHA-256 and exact original bytes encoded as base64, preparation drift, and 1,668 protected-file hashes.
- `verify-part-00.py`: repeatable, read-only baseline verification helper; no product import or runtime execution.
- `PART-00.md`: this report, including gate receipt below.

The baseline SHA-256 is `b68afcb2f6e31b898b759e7115e6a64eb7749ec5cf7a48e118730737848dd916`. The preparation `BASELINE.json` and approved `SPEC.md` have their original hashes recorded in the fresh baseline and remain unchanged. `EXECUTION.md` was initialized and is maintained exclusively by the orchestrator. No page snapshots were needed because Part 0 edits no article. Existing `.versions` files are preserved and hashed.

## Acceptance mapping

| Part 0 obligation | Evidence and disposition |
|---|---|
| Confirm development checkout, HEAD, branch and dirty context | Git commands and fresh baseline fields record the exact development checkout. Existing dirty Decisions, Changelog and Chat UI pages, Office files, capture artifacts and two runtime view-state files are retained. |
| Inventory every active Chat page and direct View Activity article | 38 Chat pages excluding `.versions`; 1 related article; 39 SHA-256 records and complete base64 byte copies. Preparation comparison reports no added, removed, or changed page; HEAD and branch also match preparation. This is an independently captured inventory, not reuse of preparation values. |
| Read guidance, required baseline pages and first-repair sources | Reading record and source locators below. Existing tests were inspected as assertions only. Historical acceptance records were consulted only for chronology and deferred boundaries. |
| Initialize execution ledger and record checks | Root-owned `EXECUTION.md` already lists Parts 0–7, Part 0 in progress and all later parts not started. This report supplies Part 0 checks for root acceptance. |
| Preserve September 19 intent and unrelated bytes | Exact article equality includes the corrected right-hand-button direction. Protected hashes cover all tracked client/server files, existing dirty/untracked files outside capture 033 and inventoried pages, and existing Chat snapshots; 1,668 matched. |
| Reproducible baseline, no inferred Alpha/runtime health, no wiki repair claim | Read-only verifier checks stored bytes, live baseline identity, inventory, protected hashes and six generated blocks. Runtime/smoke/build evidence is explicitly N/A. |

## Reading record and bounded source context

Read root `AGENTS.md`, the complete capture `SPEC.md`, the complete `/Users/rccurtrightjr./.codex/skills/spec-review-gate/SKILL.md`, Wiki Guidance `001-Style_Guide/PAGE.md` and `003-Updating_Wikis/PAGE.md`, and the code-standards hub `005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` with `003-State_Management/PAGE.md` and `007-Persistence_And_Metadata/PAGE.md`. No nested AGENTS file applies to the affected capture or wiki paths. Identity routing is explicit in the hub and persistence standard; no separate identity standard is required.

Read Chat Overview, Runtime Model, Identity And Persistence, Thread Identity, Chat UI, Decisions (including the September 19 entry), and the direct View Activity article. Existing inconsistencies identified by the SPEC remain unrepaired and are not certified by this inventory.

Immediate first-repair source reads establish the following limited source context for the next builder, not a whole-section verification:

| Source path and symbol | Source-inspected context |
|---|---|
| `fusion-studio-server/lib/thread-groups/service.js`, `listGroups`, `resolveOpenTarget`, `resolveViewTarget`, `renameGroup`, `deleteGroup` | Exact workspace/view populations; null means Legacy; visible-group open resolves a session; group action facade delegates deletion. |
| `fusion-studio-server/lib/thread-groups/repository.js`, `toProjection`, `insertGroup`, `insertMember`, `_populationQuery`, `getGroupProjection` | Group projection carries workspace/view, name, primary, member count and group timestamps. Membership and primary are distinct from session identity; null population is explicitly queried. |
| `fusion-studio-server/lib/thread-groups/move-service.js`, `moveChatToSide`, `resolveMoveSessionPolicy` | Existing session remains the placement target; new Main is staged through the manager, gets peer membership and primary history; a durable placement instruction and one Move activity are recorded. |
| `fusion-studio-client/src/components/chat/chatSurfaceContract.ts`, `ChatMountIdentity`, `mintChatSurfaceId` | Workspace/view/group/session/mounted-surface identities remain distinct; transient surface generation belongs to the host. |
| `fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx`, `isTupleHydrated`, `ChatSurfaceReadyMount` | Descriptor tuple/placement validation precedes the connected host and direct ChatSurface mount. |
| `fusion-studio-client/src/lib/ws/threadGroupRows.ts`, `threadGroupRowFromProjection`, `threadOpenRequest` | Visible row preserves group identity while primary session identity routes chat; explicit group open and legacy exact-session compatibility are separate shapes. |
| `fusion-studio-client/src/components/chat/ChatAreaHeader.tsx:70`, `:95`; `useLegacyChatHost.ts:420`, `handleToggleThreads` | Left `dock_to_right` / Show threads and right `event_list` / More options are separate controls; the current side-tab left action toggles the owning view dock. |

The September 19 correction remains owner intent: only the right-hand `event_list` / More options control survives from the two list/thread controls in intended Side Chat tabs; left `dock_to_right` / Show threads and sliding thread-panel behavior must be removed in future product work. This task neither removes the current toggle nor defines the future right-hand behavior. Side Chats remain one chat in a content tab without their own left-column threads. Non-chat window capability remains separate future work.

Inspected assertions in `fusion-studio-server/test/thread/thread-group-repository.test.js:94–167` cover exact populations, unique membership, ownership resolution, explicit activity and rename ordering; this file was not run. Read historical acceptance/prerequisite sections of `025-Chat_Composition_Roadmap/CHAT-01-EXECUTION-LEDGER.md` and `CHAT-05-EXECUTION-LEDGER.md`, and relevant CHAT-04 acceptance/retirement records. Historical test counts are not current evidence. `git log -5 --format='%h %ad %s' --date=short -- fusion-studio-server/lib/thread-groups/service.js` reports foundation commit `5f46d1a` on 2026-09-13 and composition completion `554bedf` on 2026-09-15; stale planning headers do not negate those historical implementation records.

## Exact checks and results

Commands run from the repository root unless stated otherwise:

1. `git rev-parse --show-toplevel`, `git rev-parse HEAD`, `git branch --show-current`, `git status --short`: exit 0; root/revision/branch recorded above; full raw status is in `EXECUTION-BASELINE.json`.
2. Python standard-library baseline capture: enumerated active PAGE.md files, read current bytes, computed SHA-256, base64-encoded the 39 articles, independently read tracked product/current dirty paths, and compared preparation hashes. Exit 0; 38 + 1 pages, 1,668 protected records; zero page or revision/branch drift.
3. `python3 ai/RC-MacAir-15/Captures/033-Chat_Wiki_Reconciliation/verify-part-00.py`: exit 0; 1,793/1,793 checks passed; errors `[]`; 39 exact stored/current byte matches; 6 generated blocks unchanged; 1,668 protected hashes matched. The script prints the baseline candidate hash and can be rerun without writes.
4. `git diff --check -- ai/RC-MacAir-15/Wiki/007-Chat_System ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections ai/RC-MacAir-15/Captures/033-Chat_Wiki_Reconciliation`: exit 0 with no output. `node` loaded `./fusion-studio-client/node_modules/gray-matter` and parsed this report with its required name/description/metadata envelope: PASS, exit 0. Python inspection of all three new evidence files found no trailing whitespace and verified final newlines: PASS, exit 0. No changed wiki frontmatter or new wiki links exist in this slice. Final article source-pointer/link checks belong to the later owning parts; this inventory does not certify their current correctness.

The initial optional server-local parser discovery found no `fusion-studio-server/node_modules/gray-matter`; the existing parser is available under client `node_modules/gray-matter`, so no dependency installation is needed. One initial discovery command used an unmatched shell glob (`001-Wiki*`); it did not read or write files, and was replaced with exact guidance paths. These were discovery corrections, not omitted acceptance checks.

## Self-review, deviations, and downstream impact

Self-review checked captured path uniqueness, no `.versions` in the active-page inventory, base64 byte integrity, current-byte equality, the generated marker zones, preparation immutability, and the protected current worktree hashes. The marker checker was tightened before review to compare whole matched blocks rather than marker names; full-page byte equality independently protects all article content. No product repair was made or needed for Part 0.

- D0: Root created and owns `EXECUTION.md` rather than this builder creating it. Authority: orchestrator packet explicitly splits ownership to avoid concurrent writes. Observable effect: same required ledger with Part 0 evidence provided here; proposed classification `accepted`; downstream root must update acceptance/status after its gate.
- D1: Added `verify-part-00.py` beyond the report and raw baseline. Authority: allowed execution evidence under capture 033. Reason: make exact-byte and protected-file comparisons reproducible for the current gate. Observable effect: read-only local documentation check, no product behavior. Proposed classification `accepted`; downstream builders may reuse raw baseline data, but after intentional wiki edits this strict Part 0 equality verifier is expected to flag changed pages. Such drift is evidence to reconcile, not authority to revert owner edits.

No other deviation or out-of-scope touch; no runtime adapter, compatibility shim, application change, test change, database access, commit, push, app launch or Alpha operation. Stored article bytes can seed exact pre-edit comparisons; later builders must re-read current bytes and make their own exact pre-edit `.versions` snapshots when appropriate. A later owner edit must be preserved and the affected evidence refreshed.

Client build, server test suite, application smoke, Electron/manual runtime and Alpha checks are N/A and not run: Part 0 is evidence-only and the packet expressly excludes those actions. Manual inspection means source/document reading only, not runtime observation. Hash coverage excludes ignored runtime data; no runtime-health claim follows from preserved hashes. Whole-section consistency, source-pointer repair and future-product gaps remain Parts 1–7 scope. Preparation and execution matching does not mean the unrepaired wiki is accurate.

## Builder-owned review gate

Gate status: **CLEAN**, first pass; no material findings or repairs. Builder handoff: **READY_FOR_ORCHESTRATOR_REVIEW**. Gate scope is Part 0 artifacts and immediate preservation integration only; orchestrator acceptance remains pending.

Reviewer `/root/wiki_part_0/part0_review1` was spawned as `clean-room-reviewer` with `fork_turns: none`, without model or effort override. It received bounded raw authority and candidate paths, criteria, checks and reported deviations; no prior reviewer conclusions. Pre-spawn lifecycle inspection found no prior reviewer. The reviewer returned terminal CLEAN, then `collaboration.list_agents` confirmed its completed disposition before this handoff. Tool discovery for `close_agent` returned an empty list both before spawn and after completion, so closure cannot be called; this is lifecycle evidence, not a blocker. No active conflicting reviewer/writer exists in this builder subtree.

Reviewed candidate SHA-256 values:

- `EXECUTION-BASELINE.json`: `b68afcb2f6e31b898b759e7115e6a64eb7749ec5cf7a48e118730737848dd916`.
- `verify-part-00.py`: `ed9e3b47a6f631b3d347105d5a6d602252a2866da91613857a08d155c46d38ed`.
- `PART-00.md` before this receipt: `011a670768236d2ac1f6b65945382eb8dec954508d8c133d927c83c46170d7a4`.

Independent reviewer reproduced 1,793/1,793 passing checks, six preserved generated blocks and all 1,668 protected hashes; independently expanded dirty-path coverage found no uncovered dirty path outside capture 033. Scoped diff, gray-matter and untracked whitespace/newline checks passed. The reviewer verified required read records, source locators and corrected intent, and found D0/D1 appropriately proposed accepted. No advisories beyond the already recorded downstream limitation: intentional later wiki edits invalidate strict full-page baseline equality and require exact current-byte snapshots rather than reverting owner changes. No material finding remained.

This final receipt is the only post-review report edit; baseline and verifier bytes are unchanged. Final documentation validation and preservation checks were rerun after adding the receipt; final report hash is supplied in the handoff rather than recursively embedded here. No review-loop expansion or later part began.
