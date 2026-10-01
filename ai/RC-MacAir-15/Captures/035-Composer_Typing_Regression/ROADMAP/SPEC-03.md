# SPEC-03 — Action routing and host responsibilities

Program: CHAT-AR. Status: DRAFT CANDIDATE; not implementation authority.

## Objective, scope and non-goals

Replace ambient fire-and-forget chat actions with explicit target and completion ownership, then remove host command/listener responsibilities. Preserve current product actions, eager New Chat and current menu behavior. This is not a new command bus or general UI redesign.

Expected areas: lib/chat-action.ts, SendToChatButton, SystemViewer and every discovered chat-action caller, prompt resolution transport, thread creation request/response correlation, useLegacyChatHost/useViewChatHost, chat group/header/menu hooks and shared menu integration. Mechanical server request correlation is owned here; harness/provider policies are unchanged.

## Authority and prerequisites

Repository-relative paths resolve from `/Users/rccurtrightjr./projects/fs-dev`. Mandatory local packet dependencies: `ROADMAP.md`, `BUNDLE-INDEX.md`, `AUTHORITY-AND-DECISIONS.md`, `ARCHITECTURE.md`, `GUIDANCE.md`, `VALIDATION.md` and `ISSUES.md` in this folder. Read the current Chat Wiki overview and routed standards before changes.

Prerequisite: exact candidate approval and explicit owner acceptance of SPEC-02. Use its integrated bytes and evidence as the accepted baseline; preserve unrelated dirty work.

Code-standards hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Required routed pages:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

No new standards exception is preapproved. AUTHORITY-AND-DECISIONS records proposed supersessions and preserved contracts. Old accepted source contracts are indexed in BUNDLE-INDEX; this SPEC cannot silently change them.

## Ordered slice packets

Every slice incorporates the complete fresh-builder, self-review, deviation, builder-owned and independent orchestrator review contract in GUIDANCE. Fresh builder per slice; only fresh clean-room reviewers may be spawned by that builder; repair forward until first clean without a pass ceiling. All descendants inherit root model/effort. Each listed check alias resolves to exact commands and pass criteria in VALIDATION.

### 03A — Explicit action owner and real completion

**Prerequisite:** Owner accepted 02.

**Owned behavior, integration and failure branches:** Define typed action target captured when invoked: exact source workspace/view/group/session as applicable, explicit current or new intent and insert or send delivery. Use the established chat-action boundary with one application-owned registered consumer and a result promise/status. No per-mount global listener ownership. An unavailable target/consumer returns visible failure; success means insertion actually applied or submission controller acknowledged its defined result, never merely event dispatch. Migrate actual File/Wiki/Office SendToChatButton callers and diagnostic Ask AI append. Ask AI inserts only; mounting diagnostics never inserts or sends. Two mounts and later view switches cannot redirect the captured action. Keep portable controls unaware of stores/socket/provider details.

**Required verification:** V-ACTIONS R5 current-target/insert/send and diagnostic cases; V-BUILD; real public UI readback and notification assertion. Pass: exact intended draft/attachment changes once, no false success toast and no sibling mutation. Use the server acceptance result for send-success claims; enqueue-only feedback must say pending.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 03B — Correlated asynchronous creation and prompt resolution

**Prerequisite:** 03A clean and integrated.

**Owned behavior, integration and failure branches:** Migrate SystemViewer new-chat action and all template/prompt-based actions to the same owner. Capture destination at invocation, correlate creation/prompt-resolution replies by request ID and workspace generation, and own cancellation/timeout outside DOM mounts. Preserve eager creation: lack of provider output cannot postpone the group/session creation contract. An unrelated thread:opened never satisfies the command. Close/unmount before new creation acceptance cancels the pending action intent where safely possible; if creation already committed, retain the server-created group but never inject/send into a later unrelated destination. Return a truthful cancelled or completed-at-original-target result. System new-chat eligibility follows its existing creation contract; Move-only eligibility must not be reused to prohibit it. No silent fallback to global current chat. Remove nested anonymous listeners and correlated operation resources after every terminal path.

**Required verification:** V-ACTIONS R5 System/new/template and R6 all lifecycle cases; creation public-route tests plus V-BUILD. Pass: unrelated opens cannot capture the action; timeout/reconnect/switch/unmount produce one exact outcome, no remaining listener/timer and no unwanted prompt dispatch.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

### 03C — Group commands and mount-local interactions

**Prerequisite:** 03B clean and integrated.

**Owned behavior, integration and failure branches:** Extract group/header commands (member selection, rename, move, close, model actions) into focused controllers using acknowledged server actions; retain server eligibility/busy rejection and exact identities. Move refs, focus/autocomplete/scroll/menu interactions to their mount-local owners and shared menu system. Preserve Copy, diagnostics, drag/drop, attachments and keyboard actions. Remove retired global action listeners and ensure each existing entry point has one registered consumer. Produce an import/ownership table; remaining aggregate history/draft projection is explicitly handed to 04, not described as finished architecture.

**Required verification:** Full V-ACTIONS; V-SUBMIT; V-BUILD; existing thread group rail/source, group Move/worksurface cleanup and chat surface isolation tests. Pass: actual menus/actions preserve behavior and pending controllers hold no DOM resources; no double registration across duplicate mounts.

**Handoff:** Record changed paths, criterion-to-evidence mapping, all deviations/downstream effects and a materially clean fresh builder-owned review; return `READY_FOR_ORCHESTRATOR_REVIEW`. Orchestrator independently inspects/reviews; material repairs repeat both fresh reviews.

## SPEC integration and owner acceptance

All discovered callers are inventoried as migrated or removed with evidence. No current production action relies on excluded Legacy listeners, ambient-current lookup after an await, or optimistic success notification. AR-003/004 have regression evidence; owner accepts before 04.

The orchestrator reports all deviations and affected downstream assumptions. The owner must explicitly accept this SPEC before the following SPEC starts; direct `$orchestrator` and supervisor execution enforce the same boundary.
