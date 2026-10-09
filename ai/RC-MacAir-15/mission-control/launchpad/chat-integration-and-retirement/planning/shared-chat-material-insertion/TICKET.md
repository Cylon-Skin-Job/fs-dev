# CHAT-MATERIAL-01 — Shared chat material insertion

> CHAT-MATERIAL-PLAN-01 revision 1. Provisional candidate authored under the October 7, 2026 owner request. Implementation hold: **“Don't build.”** Codex side chat (ephemeral), leaf `/root/chat_material_candidate_stage/candidate_author`.

## Outcome and scope

One existing Chat action owner resolves and validates destinations for material insertion, then writes prepared text or attachments through the existing session-owned stores. Global controls target the active open Main or Side Chat at the click; composer controls target their own chat. A delay never changes that destination. Only a genuine originating-composer binding/lifetime change or invalid destination cancels insertion; another view or chat gaining focus does not.

This is one new ticket with one dependency-ordered [SPEC](SPEC.md), not a reopening of the completed retirement/startup-repair build. [OWNER-REQUEST](OWNER-REQUEST.md) is the original authority; parent [D-009](../../DECISIONS.md#d-009--prepare-the-next-shared-chat-material-insertion-ticket-and-spec) records this assignment. [The completed-build handoff](../../HANDOFF-COMPLETED-BUILD-2026-10-07.md) establishes the accepted baseline and historical evidence limits only.

## Package index and authority

| Artifact | Purpose | Authority/status |
|---|---|---|
| TICKET.md | Scope, intent coverage, issue/dependency disposition and return point | Normative proposed ticket contract; provisional |
| SPEC.md | Observable contract, source map, slices, checks, Wiki handoff and implementation gates | Normative executable candidate; provisional |
| OWNER-REQUEST.md | Direct current owner product instruction and planning-only hold | `owner_decision`; external authority with its own fingerprint |
| PLANNING.md | Creation Supervisor coordination and ownership | Non-normative coordination; separate writer |
| CANDIDATE.json | Ordered TICKET.md/SPEC.md byte identity | Identity only; not approval |
| reports/author-source-evidence.json | Source fingerprints, actual dirty scope and author self-check | Evidence; no independent verdict |
| Manager-owned investigation/review reports | Accepted research and separate worker/stage/release gates | Their exact coverage and identities govern reuse |

Accepted planning evidence: [manager synthesis](reports/ACCEPTED-SYNTHESIS.md), [standards/Wiki investigation](reports/STANDARDS-WIKI-INVESTIGATION.md) with [its fresh worker review](reports/STANDARDS-HANDOFF-REVIEW-01.md), and [verification investigation](reports/VERIFICATION-INVESTIGATION.md) with [its separate fresh worker review](reports/VERIFICATION-HANDOFF-REVIEW-01.md). Their acceptance permits source-backed incorporation; it is not review of this assembled ticket/SPEC. VER-A01/A02/A03 are propagated into visible SystemViewer disposition, real delayed text/focus/callback acceptance and full-server/build evidence accounting respectively.

Controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`. Output: this folder. Read-only planning source: `/Users/rccurtrightjr./projects/fs-dev`, `main`, HEAD `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`. Source tree and working-byte hashes are in the evidence report. The source root is the primary development checkout, separately verified from memory CWD. No Alpha checkout is an implementation source.

The leaf author owns only this ticket, SPEC.md, CANDIDATE.json and reports/author-source-evidence.json. The stage manager owns reviewer dispatch and its reports; the Creation Supervisor owns owner questions and approval routing. Shared CWD grants no main-session identity, central record ownership, checkpoint or delegation authority.

## Intent coverage

| Requirement | Authority | Planned coverage |
|---|---|---|
| R-01 Reuse chat action, draft and attachment owners | Owner request; User Preferences reuse guidance; State standards | SPEC architecture and slices M1–M3 |
| R-02 Global actions target the active open chat, Main or Side | Owner request | M1 active-mounted projection; A01–A05 |
| R-03 Every composer action targets that composer's chat | Owner request | M2 and M3; A06–A09 |
| R-04 Resolve/snapshot before source preparation; delay never redirects | Owner request | Shared begin/commit contract; A07–A12 |
| R-05 Cancel real rebind/unmount/closed placement/invalid destination | Owner request | Shared validity, irreversible lifetime token; A09–A13 |
| R-06 Other focus/view changes preserve a still-valid captured owner | Owner request; manager clarification within that scope | A07/A08/A10; replace obsolete focus-cancellation checks |
| R-07 Sources prepare independently; preserve screenshot correlation | Owner request; direct save protocol | M3 and A10–A14 |
| R-08 Compose only; preserve ordinary Send acceptance/persistence/provenance | Owner request; Chat Overview/Identity/Composer | A15–A17; no material-action send/new-chat options |
| R-09 Inventory all material entry points and close bypasses | Owner request | SPEC caller/disposition map; M2 completion sweep |
| R-10 Renew affected checks and independent review proportionately | Owner request; maintained shared-chat testing minimum; planning and implementation contracts | SPEC §7 mandatory fresh M3/final full-server Jest and client build, affected verification/invalidation and handoff gates; historical equality cannot waive the new required runs |

These are planned dispositions, not delivered or accepted implementation. Exact acceptance definitions live in SPEC.md.

## Source-backed diagnosis

`src/lib/chat-action-controller.ts` already stages attachments and appends text through `chatFileLinkStore` and `chatComposerDraftStore`. `chat-action.ts` currently captures only the selected group/Main row in a view. `SendToChatButton` also passes its resource panel as `sourceViewId`, conflating source and destination. `chatScreenshotCapture.ts` independently validates a screenshot owner and writes pending attachments, with a global Main/Legacy fallback and focus-derived guards.

Composer gallery attachments go through `useChatSessionActions.handleAddAttachment`; clipboard/recent-file/microphone text reaches a mutable input ref through `handleInsertText`. Clipboard values and the most-recent-file request are awaited before that callback, so resolving only inside the callback is too late. Diagnostic Ask AI already composes via the shared action owner, but its retrieval/lifetime seam belongs in the inventory. Ordinary typing, system paste and filename autocomplete remain editor operations.

The current state separates selected Main groups, service-managed open Side placements, view focus and mounted surfaces. A Side placement selection is not proof that its composer was most recently active; neither is stale `currentThreadId`. M1 supplies the missing transient active-mounted projection through the existing Chat state owner and connected host callbacks. It adds no second draft/attachment store or generic routing framework.

## Dependencies and issue disposition

| ID | Authority and scope | State | Resolver/release condition |
|---|---|---|---|
| CM-001 Global active chat resolution lacks a shared Main/Side projection | `active_code_constraint`, R-02 | `propagated_pending_review` | M1 implements source-backed activation/focus registration; active-open/no-target tests pass |
| CM-002 Screenshot and local composer callbacks bypass common insertion validation | `active_code_constraint`, R-01/R-09 | `propagated_pending_review` | M2/M3 remove in-scope bypasses; inventory/stale-symbol checks and public route tests pass |
| CM-003 Delayed text sources snapshot too late | `active_code_constraint`, R-04 | `propagated_pending_review` | M2 captures before selected-item/top-item preparation; deferred delivery/cancellation checks pass |
| CM-004 Existing Wiki/tests describe Main-only fallback and focus cancellation | Current source/Wiki; superseded for exact R-02/R-06 scope | `propagated_pending_review` | M3 updates affected assertions/articles and obtains fresh review |
| CM-005 Future send/new-chat modes | Explicit owner exclusion | `deferred` | Owner resolves in a separately authorized ticket; no current release dependency or mode implementation |
| CM-006 General UI-action provenance/health/harness work | Existing approved directions or proposals with separate homes | `deferred` | Respective owner-selected tickets/approved SPECs; no bypass/new event/schema in this SPEC |
| CMH-001 Historical equality exception weakened the maintained fresh full-server minimum | Candidate worker-handoff review 01; Testing/Operations hub and Smoke Tests child | `author_repaired_pending_fresh_worker_review` | SPEC §7/M3/final now require fresh full-server Jest and fresh client build on actual integration inputs/results/limits; new fresh affected worker review must validate repair |

CM-005/006 defer future capabilities, not an unfinished insertion edge case. The planned narrow begin/commit contract leaves later explicit modes and governed events possible without duplicating stores, changing identities or carrying a legacy screenshot insertion owner. Such follow-on work must re-inventory then-current owners and obtain its own decisions. All R-01–R-10 behavior is required now; no delayed cancellation/isolation requirement is deferred.

CMH-001 disposition is appended after the unchanged [first candidate worker review](reports/CANDIDATE-HANDOFF-REVIEW-01.md) returned REVISE on `sha256:f68de0235fa3bf24e3d11cfd0ece3599c113c0fc0fa06de24fa1bb7e2807ed4d`. The author's bounded repair removes the full-server reuse exception, propagates mandatory fresh commands through M3/final acceptance and retains the old 832-binding evidence only for historical/unchanged original claims. Prior investigator/reviewer interpretations grant no waiver; their original receipts are preserved. The repaired candidate remains provisional pending a new fresh worker-handoff reviewer and separate fresh stage/release review.

Order: owner-approved current candidate and refreshed source → M1 global path → M2 composer source convergence → M3 screenshots and complete acceptance/Wiki handoff → final SPEC review → owner acceptance. Shared action/identity/host files make slice writes sequential. No speculative parallelism is authorized.

## Boundaries and handoff

Keep server-owned prompt admission, `message:sent`, transcript persistence, attachment normalization and provenance; keep source preparation in screenshot/clipboard/recent-file/microphone/diagnostic owners. No DB migration, provider syntax, new WebSocket action, general `ui.action` publisher, health subscription, macOS watcher restoration, Alpha operation or old SPEC acceptance change is planned.

SystemViewer's distinct **New Workspace → name/source form → Create** invokes `workspace-manager.workspace-creation` to prepare a workspace-agent chat. It has no ordinary Send to Chat control. That explicit existing workspace workflow is separately classified and protected, not adopted as a future material mode. Diagnostic **Ask AI** is an in-scope compose-only insertion and joins the shared validity contract. An ordinary material-add discovered during implementation cannot be exempted merely because old code uses a send/create enum; return a deviation or owner question if its actual visible intent is ambiguous.

The provisional candidate awaits manager-assigned independent worker-handoff review, a separate fresh candidate-stage review and fresh release review. Source/evidence gaps or material owner questions return through the stage manager. After those gates, the Creation Supervisor presents the exact candidate for owner approval; **“Don't build” remains effective until the owner assigns/approves implementation**. A pass label alone is not that approval.

For an approved single SPEC, the direct route is `mc-orchestrator`; an owner may also use `mc-roadmap-implementation-supervisor` with an externally prepared approved packet. Neither is invoked by this plan. Implementation requires fresh builders, builder-owned and separate orchestrator-owned clean-room review, complete deviation accounting, and owner acceptance of the finished SPEC. Commit/publication/deployment remain separately gated.
