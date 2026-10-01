# SPEC-04 Implementation Report — Independent rendering lifetimes

Candidate: `CHAT-AR-4641ca5897f0`  
Baseline HEAD: `88637d11c65be53d4f2ad0f049f64a07fa3db1de`  
Branch: `agent/exact-workspace-paths`  
State: **ready for supervisor review; owner acceptance not yet requested or inferred**

## Integrated outcome

SPEC-04 is implemented in required order 04A → 04B → 04C. Draft, completed-history, live-turn and workspace-content observation now have explicit lifetimes. The connected composer owns only its exact workspace/session draft and submission projections. Completed messages carry stable content/metadata revision identities with bounded mounted-history formatting caches. Live frontier work does not reformat completed history. The production shell composes the active view chat and `ContentArea` as siblings, selects only the required view population, and has no aggregate Legacy compatibility host or duplicate built-in chat dock.

Every required SPEC-04 gate is green on the integrated candidate. The final current-byte full V-RENDER and five-minute gates passed with valid foreground focus, exact text retention, zero typing-time network frames, zero long tasks, and zero draft-induced completed-history/header/rail/content/formatter work. V-ACTIONS, V-SUBMIT, V-ISOLATION, V-SHELL, architecture contracts and V-BUILD also pass. No product defect remains known within the executed SPEC-04 acceptance surface.

This report does not close the program's original owner freeze symptom. Native/IME and owner symptom acceptance plus the 45-minute mixed soak remain SPEC-06/program gates. SPEC-05 has not started.

## Responsibility and dependency map

| Lifetime / responsibility | Final owner | Dependencies and preserved contracts |
| --- | --- | --- |
| Exact draft, caret/input semantics, attachment and submission projection | `ConnectedChatComposer` and connected composer leaves | Workspace/thread identity, SPEC-02 attempt receipts, invocation-time draft snapshot, same-session duplicate-mount sharing |
| Session commands and surface presentation | `ChatSessionHost`, `useChatSessionHost`, `useChatSessionActions`, stable `chatSurfaceContract` | SPEC-03 exact target/action/request correlation, server ACK/error authority, Stop ownership |
| Exact view population and MRU open | active `useViewChatHost` instance | One view-qualified `thread:list`; inactive/null-view hosts issue no list/open/warm work |
| Completed history and derived formatting | `MessageList`, `InstantSegmentRenderer`, stable message revisions and mounted-row caches | Scoped metadata invalidation, hydration/edit invalidation, cache release on retired rows, copy/search/tool/link behavior |
| Live frontier and finalization | live routing/renderer plus exact session host | Accepted RCC-0108 ordering, snapshot restore, partial interrupted turns, delayed save ACK, no duplicate final message |
| Shell placement | `WorkspacePanel` with sibling chat shell and `ContentArea` | Draft/live changes terminate below the shell/content sibling boundary; exact view config only |
| Worksurface and Side Chat placement | outer `ThreadRail` and acknowledged worksurface controller | Group-specific persistence, relaunch restoration, isolated delete, exact active-view discovery |
| Historical null-view data | existing explicit store/server read and cleanup routes | Readable/cleanable without a hidden production Legacy surface or automatic selection/open |
| Retired aggregate surfaces | deleted `LegacyChatHost`, `useLegacyChatHost`, `ViewWorksurfaceDock` and CSS | No production `legacy-main`, duplicate built-in dock, aggregate owner, orphan listener, or hidden compatibility mount |

## Slice ledger

### 04A — Composer-local observation

Implemented a connected composer leaf with exact primitive selectors, invocation-time snapshots and stable presentation contracts. Same-session duplicate mounts share draft; other sessions remain isolated. Draft edits do not rerender completed history, formatters, header, rail or content.

Fail-forward review repaired five material verification/ownership gaps: fail-open coverage discovery, whole-thread-collection observation, opaque unenforced network counts, focus-sensitive wall enforcement, and same-named zero-invocation calibration. The final 23-path slice manifest digest is `d7b6fce3625a9869597ba5c1e2a27d5d13bd2fff872aada8b1f9090fa8bd8837`. Builder review pass 5 and independent orchestrator acceptance pass 4 are `CLEAN`.

### 04B — Completed history and live-turn observation

Added stable message content/metadata revisions and bounded component-lifetime formatting caches. Completed formatting stays quiet during 20 fps live output; metadata invalidates only the intended message; content replacement/hydration cannot reuse stale formatting; retired rows release entries. Working Activity return preserves the server-owned original start time, and existing live/Stop/finalization durability remains intact.

The final 11-path slice manifest digest is `77803db53182f921ae2c562e3e4000ff5ce33462158c9c39eb24b5c8d3986c5a`. Builder review pass 1 and independent orchestrator acceptance pass 1 are `CLEAN`.

### 04C — Production shell isolation and aggregate-host retirement

Added the explicit `WorkspacePanel`/session composition, made `ContentArea` a sibling, retired the Legacy host/hook and content-local docks, removed automatic null-view list/open and inactive reconnect sweeps, preserved explicit historical reads, and migrated real worksurface/Side Chat integration to the production outer rail.

Builder review pass 1 found two material omissions—remaining null-view startup list/open and an Electron smoke still targeting the deleted dock. Both were repaired, and the stronger shell oracle then exposed and removed the inactive five-view reconnect sweep. Focused timing later exposed two test-oracle defects: an invented five-minute 1.15× duration cap and queued screenshot bootstrap crossing measurement start. The corrected runner uses the approved 1.5× configured-character-delay rule and a bounded, ordered, fail-closed screenshot lifecycle quiescence boundary; it then captures every measured frame and still requires zero.

The final 43-path plus four-deletion slice manifest digest is `21eb00b014cf37b7a710c59a0be97016b91ef55ec9c2b0f8f1e551caadbeaa44`; the slice-report hash is `e343aa14a6aeaf9bb6d1f2cdec2afcccd23aa3cac876b92fa891f671137311bc`. Fresh builder review pass 3 and independent orchestrator acceptance pass 2 are `CLEAN`.

## Integrated source identity

`evidence/spec-04/INTEGRATED-SOURCE-SHA256.txt` is the current union of every accepted 04A/04B/04C source and verification path after final integration. It contains 64 current hashes plus four required deletions. All hashes and deletions were independently reverified; scoped `git diff --check` passes. Manifest digest:

`4a14fc89ab94fc82b401d1b77f54caaedb0e8e70e82ddbf72996c8ecefc764e9`

The checkout remains intentionally uncommitted and dirty. Unrelated owner/concurrent work was preserved. No commit, push or Alpha operation was performed.

## Final verification ledger

| Gate | Final result |
| --- | --- |
| Full V-RENDER | PASS — `chat-arch-1790228222155-271e516a9a`; F1, ten short R1 windows, composer correctness, R7 and R9 |
| Five-minute continuous R1 | PASS — `chat-arch-1790228438993-225fac9ea0`; 9,520 characters, valid focus and clean owned cleanup |
| V-ACTIONS | PASS — final integration run `chat-arch-1790229825954-c2235cb769` |
| V-SUBMIT | PASS — final integration run `chat-arch-1790229996244-f9de301ac6` |
| V-ISOLATION | PASS — 18/18 on final integration bytes |
| V-SHELL | PASS — final integration run `chat-arch-1790230105635-f4e233ea08`; exactly one active-view startup list, zero null-view lists and zero startup opens |
| Architecture/oracle/lifecycle contracts | PASS — 21/21; explicit-host inventory, five-minute formula/quiescence, fixtures and owned cleanup |
| Host/identity/observation lane | PASS — 64/64 |
| Side Chat/worksurface integration lane | PASS — 44/44 plus both isolated Electron smokes |
| Historical null-view read-only regression | PASS — explicit rows hydrate with zero hidden selection/open |
| V-BUILD | PASS — TypeScript/Vite, 1,940 modules |
| Integrated source identity / whitespace | PASS — 64 hashes, four deletions, scoped `git diff --check` |

The build retains pre-existing non-fatal advisories for `gray-matter` eval, mixed Capture static/dynamic imports, and large chunks.

## Before/after matched evidence

| Metric | SPEC-01 reproduced baseline | Final SPEC-04 current bytes |
| --- | --- | --- |
| Short R1 text | 68/68 retained | 68/68 retained in all ten final windows |
| Short wall time | 7,178–7,369 ms | 1,961–2,008 ms; limit 2,550 ms |
| keydown-to-input p95 | Baseline retained but renderer-blocked | ≤0.7 ms; limit 3 ms |
| next-rAF p95 | 86.6–96.1 ms | ≤16.9 ms; limit 20 ms |
| next-rAF max | Baseline breach associated with long tasks | ≤18.3 ms; limit 50 ms |
| long tasks >50 ms | 68 per window | 0 |
| React commits | 204–205 per window | composer-local work only; sibling/history coverage counts 0 |
| DOM mutations | 11,084 per window | confined to composer-local draft work |
| Completed formatter work | thousands of entries / draft amplification | 0 during draft typing and live-only frames |
| Typing-time WebSocket sends | not an authenticated zero oracle | 0 with decoded, fail-closed exact-interval capture |

Final sustained typing recorded 9,520/9,520 input and rAF samples, exact retained text, 351,517 ms wall time against the approved 456,960-ms budget, input p95/max 1.4/2.2 ms, next-rAF p95/max 17.7/21.0 ms, zero long tasks, zero measured outbound frames, and zero history/header/rail/content/formatter calls. Focus was true before and after; SQLite quick-check was `ok`; owned roots were removed and no owned PID remained.

The first unlocked full-render attempt had one 2,567-ms warm window, 17 ms above the unchanged short threshold. Its other nine windows and all renderer, retention, traffic and focus signals were clean. An exact unchanged-source rerun, an unchanged-source full rerun and the final-manifest full run produced thirty passing windows without changing the 2,550-ms limit. The non-reproduced excursion is retained as host scheduling jitter, not hidden or counted as a product repair.

## Review and fail-forward lifecycle

- 04A used a fresh builder. Builder reviews progressed through original clean, repair finding, clean network repair, clean focus repair and clean positive-calibration repair. Independent orchestrator reviews found the coverage/selector, focus and positive-calibration defects; each was routed to the owning builder and both review layers repeated. Final orchestrator acceptance: `CLEAN`.
- 04B used a fresh builder. Its first fresh builder review was `CLEAN`; independent orchestrator acceptance was separately `CLEAN`.
- 04C used a fresh builder. Builder pass 1 returned findings, pass 2 was clean after product/integration repair, and focused harness changes invalidated that seal; fresh pass 3 reviewed the resealed candidate and returned `CLEAN`. The first independent orchestrator review correctly refused acceptance while the Mac was locked and timing had not begun. After the owner unlocked the Mac, a new independent reviewer accepted the current focused candidate as `CLEAN`.
- A final fresh integration reviewer is required to inspect this integrated manifest, cross-slice contracts, final gate receipts, report and deviation ledger before handoff. Its disposition is recorded in `evidence/spec-04/FINAL-INTEGRATION-REVIEW.md`.

No review finding was waived, converted to an expected failure, or hidden by selector removal. Failed attempts and structured focus-unavailable receipts remain in raw evidence.

## Deviation and downstream-impact ledger

| ID / departure | Orchestrator disposition | Observable effect and downstream impact |
| --- | --- | --- |
| D-04A-1 connected history/header leaves beyond the narrow expected list | `accepted_no_downstream_impact` | Mechanically necessary leaf boundaries; enabled 04B without changing UI behavior |
| D-04A-2 and D-04B-1 shared runner artifact roots | `accepted_no_downstream_impact` | Evidence compatibility only; no product route or profile effect |
| D-04A-3 inherited aggregate host length | `closed_by_04C` | No exception remains; the Legacy host/hook is deleted |
| R-04A-1 fail-closed production coverage calibration | `accepted_update_downstream_packet` | All R1 consumers inherit authentic discovered/positive target calibration |
| R-04A-2 exact primitive compatibility selectors | `closed_by_04C` | Prevented unrelated-row invalidation until Legacy retirement; compatibility host now deleted |
| R-04A-3 decoded exact typing-interval WS oracle | `accepted_update_downstream_packet` | R1/06 must retain zero-frame, type-only diagnostic evidence without prompt content |
| R-04A-4 staged-window focus prerequisite | `accepted_update_downstream_packet` | Timing fails before measurement when focus is unavailable; no threshold weakening |
| R-04A-5 strictly positive CDP calibration | `accepted_update_downstream_packet` | Same-named dead/uninvoked functions cannot authenticate a later zero count |
| D-04B-2 equal accepted snapshot projection rebuild | `accepted_no_downstream_impact` | Exact current-turn explicit rebuild only; ordinary equal/lower snapshots remain rejected |
| D-04B-3 executable R7 history/live case | `accepted_update_downstream_packet` | Full V-RENDER and later integration inherit completed-history/live-frontier assertions |
| 04C executable five-minute case registration | `accepted_update_downstream_packet` | SPEC-06 can reuse/extend the live soak inventory; no 45-minute claim is made here |
| 04C wall-formula and screenshot-quiescence oracle repair | `accepted_update_downstream_packet` | Restores exact VALIDATION authority; waits for observable bootstrap completion, filters nothing, and still requires zero measured frames |
| 04C worksurface/Side Chat caller and smoke migration | `accepted_no_downstream_impact` | Preserves persistence/relaunch/delete behavior through the real outer rail |
| 04C removal of null/inactive hidden command owners | `criterion_required` | Exact active-view host is the only population requester; historical explicit reads remain |
| 04C subtractive >400-line content-view touches | `accepted_no_downstream_impact` | Capture/Office/Email changes only remove duplicate dock bytes; no unrelated refactor |
| 04C cohesive workspace/thread router touches | `accepted_no_downstream_impact` | Strictly subtractive hidden-command retirement; extracted changed modules remain ≤400 |

No departure invalidates an accepted SPEC-01/02/03 contract or requires a new owner design decision. The `accepted_update_downstream_packet` items are evidence/validation contracts that SPEC-06 must preserve.

## Advisories, skipped later gates and residual risk

The required SPEC-04 gate set is green; the whole program/full-boot suite is not represented as universally green. The retained owned-boot result is 129/130: one stale out-of-scope SPEC-05-facing diagnostic assertion expects the old status text while current accepted behavior renders the newer visible denial. That test still proved one prompt, unchanged draft and no overwrite. SPEC-04 did not alter the diagnostic behavior merely to make stale text pass.

V-ALL, the full server suite, the 45-minute mixed soak, native/IME input, and explicit owner symptom acceptance were not required to close SPEC-04 and were not claimed. The 45-minute and native/owner gates remain SPEC-06/program work. The current five-minute idle case is passing and provides a reusable fail-closed oracle for that later work.

No live development or Alpha profile/database, owner Fusion window, fixed port 3001, destructive migration, commit, push, Alpha sync/build/install/restart, or SPEC-05 implementation was used.

## Handoff boundary

SPEC-04 is ready for supervisor review. The supervisor/owner must independently inspect this report and explicitly accept SPEC-04 before the roadmap implementation supervisor may dispatch SPEC-05. This orchestrator does not make that acceptance decision.

Terminal handoff token: `SPEC_READY_FOR_SUPERVISOR_REVIEW`
