# SPEC-04 — Independent rendering lifetimes

Program: CHAT-AR. Status: DRAFT CANDIDATE; not implementation authority.

## Objective, scope and non-goals

Separate draft, completed history, live turn and workspace-content observation lifetimes. Remove the aggregate host shape after 02/03 extracted commands. Satisfy measured workload gates without sacrificing shared draft semantics, current UI or live finalization. The old two-memo experiment is evidence, not the implementation contract.

Expected areas: App/PanelContent, ChatArea, ChatSurface/contract, useViewChatHost/useLegacyChatHost/LegacyChatHost retirement, composer leaf/store selectors, MessageList, InstantSegmentRenderer and revision helpers, existing live renderer integration, ContentArea/rail boundary. LiveSegmentRenderer's explicit cohesive exemption remains; don't mechanically split it.

## Authority and prerequisites

Repository-relative paths resolve from `/Users/rccurtrightjr./projects/fs-dev`. Mandatory local packet dependencies: `ROADMAP.md`, `BUNDLE-INDEX.md`, `AUTHORITY-AND-DECISIONS.md`, `ARCHITECTURE.md`, `GUIDANCE.md`, `VALIDATION.md` and `ISSUES.md` in this folder. Read the current Chat Wiki overview and routed standards before changes.

Prerequisite: exact candidate approval and explicit owner acceptance of SPEC-03. Use its integrated bytes and evidence as the accepted baseline; preserve unrelated dirty work.

Code-standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Required routed pages:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

No new standards exception is preapproved. AUTHORITY-AND-DECISIONS records proposed supersessions and preserved contracts. Old accepted source contracts are indexed in BUNDLE-INDEX; this SPEC cannot silently change them.

## Ordered slice packets

Every slice incorporates the complete fresh-builder, self-review, deviation, builder-owned and independent orchestrator review contract in GUIDANCE. Fresh builder per slice; only fresh clean-room reviewers may be spawned by that builder; repair forward until first clean without a pass ceiling. All descendants inherit root model/effort. Each listed check alias resolves to exact commands and pass criteria in VALIDATION.

### 04A — Composer-local observation

**Prerequisite:** Owner accepted 03.

**Owned behavior, integration and failure branches:** Mount an explicitly connected composer leaf that observes only its workspace/session draft and required attachment/submission projections. Parent shell/host must not subscribe to the draft, full session map or live tokens. Controller commands snapshot draft state at invocation. Preserve same-session shared draft across duplicate mounts, isolated other-session drafts, caret/selection, composition, autocomplete, paste/drop and resize. Split the aggregate ChatSurfaceModel into presentation contracts with stable references; do not recreate it through multiple hooks in the same parent. Add render/formatter assertions demonstrating draft-only work stays local.

**Required verification:** V-RENDER R1 draft/duplicate mount and input correctness cases; V-SUBMIT; V-ISOLATION; V-BUILD. Pass: zero draft-induced history formatter/history commits and zero sibling header/rail/ContentArea renders with exact text retained, as defined in ARCHITECTURE.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 04B — Completed-history and live-turn observation

**Prerequisite:** 04A clean and integrated.

**Owned behavior, integration and failure branches:** Give completed messages stable content/metadata revision identity; cache derived formatting within bounded history/session lifetime. Live frontier updates do not format completed history. Relevant metadata invalidates only the affected message. Keep exact thread/turn/stream sequence, restore snapshot and queued reveal/finalization behavior from RCC-0108. Terminal error and interrupted-turn rendering remain durable and deduplicated. Caches must invalidate on real edits/hydration and release retired entries. Preserve scroll anchoring, history selection/copy, tool expansion, links, existing search/bookmarks and reduced-motion behavior; prove each relevant behavior on actual UI. Do not add virtualization unless the approved measured gate demands it and preserve the listed behaviors.

**Required verification:** V-RENDER history/live cases; R7; existing working-activity, terminal-error, routing/frontier and copy/scroll tests in VALIDATION; V-BUILD. Pass: completed formatters remain quiet during 20fps live output; metadata updates are scoped; no missing/duplicate final message and no stale render cache.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 04C — Production shell isolation and aggregate host retirement

**Prerequisite:** 04B clean and integrated.

**Owned behavior, integration and failure branches:** Finish explicit view/session host composition. ContentArea is a sibling that does not rerender for chat draft or unrelated live updates. Select only needed view population state; hidden mounts do not initiate redundant list/open/warm commands. Remove useLegacyChatHost and production Legacy compatibility mode, migrate all callers and eliminate orphan contract exports/listeners. Preserve historical persisted null-view data through existing read/cleanup routes without adding a hidden Legacy production surface. Audit changed files/dependencies for one job and <=400-line rule, with exact explicit cohesive exceptions. Run matched warm/settled realistic history+workspace measurements and five-minute continuous typing, separately from startup/streaming.

**Required verification:** Full V-RENDER; V-ACTIONS; V-SUBMIT; V-ISOLATION; V-SHELL via runner; V-BUILD; enforce architecture-contract source checks. Pass: all idle and streaming short/5-minute performance gates, no source aggregate owner or unbounded cache, no hidden duplicate production placement.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

## SPEC integration and owner acceptance

Publish final client responsibility/dependency map, before/after matched metrics and public UI regressions. AR-001/005 cannot close on filename splits or a fast empty composer. Original owner freeze remains a final 06 gate even if deterministic checks pass.

The orchestrator reports all deviations and affected downstream assumptions. The owner must explicitly accept this SPEC before the following SPEC starts; direct `$orchestrator` and supervisor execution enforce the same boundary.
