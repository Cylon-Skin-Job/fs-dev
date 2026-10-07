---
name: Chat Wiki Reconciliation Handoff
description: Source-inspected wiki baseline, evidence limits, and inputs for remaining product specifications.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Planning handoff

The Chat wiki now separates source-inspected implementation, owner-directed future behavior, and unresolved choices for the reconciliation themes. This is a documentation handoff for preparing remaining product specifications. It does not approve or implement those specifications. Builder review and root acceptance status are recorded below and in EXECUTION.md; no runtime health is inferred.

## Baseline and preservation

Development checkout `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`; source/document inspection dated 2026-09-19. EXECUTION-BASELINE.json is immutable, SHA-256 `b68afcb2f6e31b898b759e7115e6a64eb7749ec5cf7a48e118730737848dd916`; it records all 39 original article bytes, raw dirty status and 1,668 protected hashes. SPEC.md remains approved hash `93b23cfc35c17e79a818cac59fe50d3d8e94d60f158d4150d8f9ac0a6543197b`; its preparation status was superseded by explicit owner execution dispatch, not rewritten.

The checkout was already dirty. September 19 Decisions, Changelog and UI intent corrections predate execution and remain preserved in the baseline and exact predecessor snapshots. Unrelated Office implementation/test/capture work, machine-scoped Capture/File runtime view state and other captures also predate execution; they are not this task's changes. The protected hash/inventory checks verify preservation of recorded files. Ignored runtime data is not comprehensively inventoried, and no runtime data was deliberately edited. No product code, tests, config, database, AGENTS, historical composition packet or installed Alpha file was changed by this reconciliation.

## Part outcomes

| Part | Outcome | Evidence |
|---|---|---|
| 0 | Fresh reproducible baseline and dirty-context preservation | PART-00.md, EXECUTION-BASELINE.json |
| 1 | Visible Thread/group, session, transient surface and durable placement identities separated | PART-01.md |
| 2 | Three group ordering causes and idempotency distinguished from session timestamps | PART-02.md |
| 3 | Group/primary links, exact member placement, menu consumer and missing link consumer separated | PART-03.md |
| 4 | Qualified list/open/create examples; primary hydration and unknown-session fallback exposed | PART-04.md |
| 5 | Five docks/eight capabilities, Legacy default, current controls and corrected owner intent distinguished; retired window shell traced | PART-05.md |
| 6 | Deleted owners/config/directory metadata corrected; composition history dated without installation claims | PART-06.md, PART-06-SOURCE-AUDIT.json |
| 7 | All 38 Chat pages plus direct View Activity read; Compact stub, test-evidence limits and lingering composition slice dependencies reconciled | PART-07.md, PART-07-SWEEP.json, PART-07-CHECKS.json |

Parts 0–7 have orchestrator acceptance, and the separate final integration review is complete; see the root receipt below. The historical composition packet's draft headings do not negate its recorded acceptance/commits, nor constitute approval for the future candidates below.

## Durable entry points

Start with [Chat Overview](../../Wiki/007-Chat_System/000-Overview_and_References/PAGE.md), then [Runtime Model](../../Wiki/007-Chat_System/006-Runtime_Model/PAGE.md) and [Structure](../../Wiki/007-Chat_System/007-Structure/PAGE.md). Use [Thread Identity](../../Wiki/007-Chat_System/001-Identity_And_Persistence/001-Thread_Identity/PAGE.md) for identity/action ownership, [Protocol](../../Wiki/007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md) for actual request/response and link gaps, [Chat UI](../../Wiki/007-Chat_System/004-Chat_UI/PAGE.md) for host/control status, and [Decisions](../../Wiki/007-Chat_System/000-Overview_and_References/002-Decisions/PAGE.md) for the latest owner intent. These articles explain current behavior without requiring a prior slice packet.

## Established source findings

A visible Thread is a group of peer sessions. Group identity owns title, immutable view binding, membership, primary selection and ordering; session `threadId` owns transcript/runtime/prompt/Stop and live routing. Move preserves the existing session and creates an empty Main peer. Creation, accepted prompt and accepted Move advance the group clock; repeated Move/reopen/close do not. A tab close retains a closed placement descriptor without deleting the session.

Normal workspace chat remains null-view Legacy. Capture, File, Wiki, Office and Email have production View Threads docks. Issues, Agents and Browser are server-capable for Side Chat placements but have no production dock. Side Chat mounts one ChatSurface with no nested ThreadRail. Current LEFT `dock_to_right` / Show threads toggles the owning outer dock; RIGHT `event_list` / More options opens the current menu, including a Show threads item. Current wiring is distinct from owner intent.

The former floating/minimized Secondary Chat shell was deleted in `554bedf`; it can be recovered from the parent commit. Shared useFloatingWindow drag/resize and EmailComposeWindow/Layer mechanics survive. No generic non-chat window container is implemented.

## Future planning candidates — not approved product specifications

| Candidate | Current evidence and remaining boundary |
|---|---|
| Exact-member link read/focus/reopen | `thread-groups/link-service.js` resolves/persists a non-primary placement, but `src/lib/ws/thread-handlers.ts` has no matching `resolve_link` placement consumer. Already-open can stay unselected; a persisted reopen does not prove visible reopening. Connect qualified reads/selection without promotion, MRU advance or cross-workspace guessing. |
| Exact non-primary open/activation | `thread-crud.js` resolves a member but hydrates `projection.currentPrimaryThreadId`; existing-session assistant activation shares the path. Separate exact member hydration/activation from group-row open. Provider `opencodeSessionId` reuse is a different identity concern. |
| Unknown explicit session target | Public assistant-open normalization accepts threadId; absent-everywhere session-only ID can fall through to newly minted group/session creation. Explicit missing group and foreign session fail. Reconcile the fallback with intended no-replacement behavior using the public route. |
| Remove Side Chat LEFT control/slider | Owner explicitly wants the LEFT Show threads control and sliding thread-panel behavior removed from Side Chat tabs, keeping the RIGHT list button. Current code/tests still wire/assert the left toggle. Preserve Main Chat navigation and unrelated controls; assess the current menu's Show threads callback under the same intended behavior. |
| Default chat host | Owner has not decided whether view-bound hosts replace Legacy as normal production chat. Do not infer this from tab placement direction. |
| Retained RIGHT list behavior | Future shared behavior of RIGHT event_list / More options is undefined; do not implement a guessed list or revive a thread slider from the old contract. |
| Generic non-chat windows | Recover/retain minimize-to-button and reopen for non-chat content. Owner decisions remain content types, persistence, placement ownership, native OS window use, sticky-right and animation. Old in-app overlay is not a native-window requirement, and chat must stay tab-based. |
| Pending New Chat/provider admission | Creation currently eagerly commits session plus group before provider readiness. Renderer connecting state is not Pending New Chat. Provider-signal-gated commit remains deferred design work. |
| Compact | Composer ContextMeter renders an inert stub; public durable action allowlist and service omit compact. Earlier provider command examples are unimplemented guidance, not verified syntax or new owner approval. Specify semantics and provider capability before implementation; per-reply Compress is a separate stub. |
| Header URI clipboard history | Header Copy Link writes acknowledged URI directly through navigator.clipboard; it does not use managed history. Reply copy/Chat ID use their own managed helper. Align Header with clipboard policy in separately authorized product work. |

## Evidence and limits

PART-07-SWEEP.json records each of 39 pages as changed and checked or read and consistent for the bounded reconciliation themes. No material unresolved contradiction in those themes is knowingly carried. The final validator parses every article with the installed gray-matter dependency, resolves local links/fragments, checks all code-source entries, JSON examples, exact snapshot chains, generated blocks, all 1,668 protected hashes, product inventory and unchanged authorities. Final counts and identities are in PART-07-CHECKS.json. The source audit from Part 6 had 289 entries; Part 7 adds two actual Compact owners, so the Chat total is 291, plus 11 in direct View Activity.

No server tests, client builds, browser/Electron runtime smoke, app launches/restarts or Alpha operations were performed. Inspected existing tests are assertions, not today's passing results; historical counts remain historical. The documentation review does not certify unrelated security, rendering, persistence or harness internals. Operational guidance such as restart scripts and proposed test lanes was read for consistency, not executed. No concrete unrelated defect making an inherited section unsafe was established by this bounded review.

Protected generated summaries retain old wording: UI Header “thread-id copy” and Harness actions naming Compact are qualified immediately outside their unchanged blocks. The missing TOC generator was not replaced. Standards pages outside this task still use Compact as architectural design examples; those must not override the active Chat article's explicit unimplemented status. Generic portal-menu migration remains separate future work. No unsupported live or installed behavior claim follows from source inspection.

## Deviation and carry disposition

The authoritative classifications for Parts 0–6 are in EXECUTION.md. Full original text, replacements, evidence and review receipts remain in each PART report. This consolidated map keeps every reported carry visible for later review.

| Origin | Disposition and downstream resolution |
|---|---|
| 0 D0/D1 | Accepted: root owns ledger; reproducible baseline helper added. Strict original equality is superseded by final cumulative validation after intentional edits. |
| 1 D1/D2/D4 | Accepted: helper manifests and real owner pointers; removed temporary verification output, no surviving outside artifact. |
| 1 D3 | Downstream impact fulfilled by ordering, protocol/create, source cleanup and final sweep. |
| 2 D1/D2 | Accepted: evidence helper and actual source pointers. |
| 2 D3 | Downstream impact fulfilled by Parts 3/4/6/7. |
| 3 D1/D2 | Accepted: direct View Activity close descriptor correction and evidence/source pointers. |
| 3 D3 | Downstream impact retained as exact-member link product candidate above. |
| 3 D4 | Downstream later-theme work fulfilled by Parts 4–7. |
| 4 D1/D2 | Accepted: precise correlation wording and source/helper integration. |
| 4 D3/D4 | Downstream impact retained as member hydration and unknown-session creation candidates above. |
| 4 D5 | UI/source/Compact consistency fulfilled by Parts 5–7. |
| 5 D1/D2/D3 | Accepted: URI/clipboard/Legacy preview correction, unsupported precommit disabled-component promise removed, source/evidence additions. Clipboard gap retained above. |
| 5 D4 | Downstream UI/window/default-host choices and earlier product gaps retained above; generated summary qualified in Part 6. |
| 6 D1/D2 | Accepted: source audit/helper plus removed temporary discovery file; protected UI summary qualified externally. |
| 6 D3 | Compact classification and whole-section consistency fulfilled in Part 7. |
| 7 D1 | Accepted: integrated verifier, sweep/snapshot manifests and handoff evidence beyond prose edits, required for reproducibility. No runtime adapter. |
| 7 D2 | Accepted: bounded dependent testing/Electron-lane qualifiers, external generated Compact qualifier and old composition-label normalization. No new behavior or authority. |
| 7 D3 | Downstream impact: all future product candidates and unresolved choices above remain for subsequent planning, not implementation in this task. |

## Execution changed paths

The following articles changed relative to the fresh execution baseline, not merely relative to Git HEAD. All have exact predecessor snapshots for every editing stage in PART-01 through PART-07-SNAPSHOTS.json. Evidence files live only in this capture; original preparation documents remain unchanged.

- `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/001-Vision/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/002-Decisions/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/004-Changelog/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/001-Identity_And_Persistence/001-Thread_Identity/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/001-Identity_And_Persistence/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/003-Rendering_And_Lifecycle/005-Reply_Payloads/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/001-Composer/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/002-Thread_Header/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/005-Menus_And_Modals/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/004-Chat_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/001-Smoke_Tests/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/003-Playwright_Electron/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/006-Runtime_Model/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/007-Structure/PAGE.md`

## Root-owned final acceptance and integration status

**SPEC_READY_FOR_OWNER_REVIEW — documentation reconciliation complete.** All eight parts passed builder review, independent orchestrator inspection and checks, and fresh acceptance review. Part 7 acceptance reviewer `/root/accept_part_7` and separate final integration reviewer `/root/final_chat_wiki_integration` each returned CLEAN at the first materially clean pass. All agents are terminal; closure capability is unavailable. Full identities, classifications and acceptance evidence are in EXECUTION.md and the part reports.

Root and final reviewer independently reproduced **2,450 passing document/protection checks**, zero errors/warnings, with exact recorded-result agreement and scoped diff clean. All seven handoff links resolve. The current 39 article hashes are recorded in PART-07-CHECKS.json (SHA-256 `3cd47abdc5e43587dafbfd62441a5e7b6a53f595aeffae7bc3ec5b350073e3e0`); 20 articles changed during execution. Final receipts changed only this handoff and the execution ledger, not reviewed wiki content.

Downstream assessment: **requires downstream correction** for the source-observed product gaps and **requires owner ruling** for the explicitly undecided product choices when subsequent specifications are prepared. These are planning inputs, not approved implementation scope. No temporary adapter remains. Verification is source/document-only; runtime, builds, server/browser/Electron suites and Alpha were not run. The stated limits above remain in force. No subsequent product SPEC has begun.
