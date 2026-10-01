# Bundle index and dependency map

Status: candidate for owner review; execution prohibited before exact candidate approval. All paths below are repository-relative from `/Users/rccurtrightjr./projects/fs-dev`; local packet paths resolve from this ROADMAP directory.

## Normative artifact set

| Artifact | Purpose / authority | Consumers |
| --- | --- | --- |
| ROADMAP.md | Ordered outcome and acceptance gates; proposed execution plan under owner direction | All |
| AUTHORITY-AND-DECISIONS.md | Separates owner decisions, prior contracts, evidence and pending proposals | All |
| ARCHITECTURE.md | Target ownership, update boundaries and proposed recovery state machine | All implementation slices |
| GUIDANCE.md | Required builders/reviews/deviations/isolation and handoff process | Every SPEC and slice |
| VALIDATION.md | Exact runner commands, workload, public scenarios and numeric gates | Every SPEC and slice |
| ISSUES.md | Open defects/unknowns and explicit nonblocking deferrals | Acceptance/review |
| SPEC-01.md through SPEC-06.md | Independently executable packets plus mandatory dependencies | Ordered orchestrators |
| BUNDLE-INDEX.md | This authority/dependency/source map | All |

SOURCE-BASELINE.json and earlier investigation records are evidence, not normative product authority. RELEASE-MANIFEST.md identifies exact candidate hashes and approval status; review reports identify reviewed bytes and materiality results. A clean planning review is not product validation or approval.

## Order, shared contracts and acceptance

| SPEC | Requires | Owns / hands off | Shared regression obligations |
| --- | --- | --- | --- |
| 01 | Candidate approval resolving AR-P01–03 | Owned runner, fixture manifests, concrete test IDs, baseline responsibility/failure map | Real auth, route fidelity, process cleanup |
| 02 | Owner accepts 01 | Session attempt API, receipt schema/wire shapes, recovery and accepted snapshot semantics | Group activity transaction, canonical turn errors, data preservation |
| 03 | Owner accepts 02 | Explicit action target/result API, request lifecycle and focused command/DOM owners | Submit semantics, eager creation, actual source view callers |
| 04 | Owner accepts 03 | Leaf subscriptions, stable history revisions, independent live lane, retired aggregate host | Actions, shared drafts, stream frontier/reveal, content siblings |
| 05 | Owner accepts 04 | Narrow session/group/mirror/runtime services and ThreadManager facade | Receipts, canonical drain, leases, file outbox, all public chat operations |
| 06 | Owner accepts 05 | Integrated evidence, native symptom acceptance and current docs | All gates; previous clean evidence invalidated by relevant repairs is rerun |

Owner accepts each SPEC before the next. No layer-only handoff can substitute for each slice's public behavior/readback evidence. SPEC-01 establishes failing gates, later SPECs enforce owned cases, and 06 has no expected failure for program contracts. AR-007 remains open through owner symptom acceptance. AR-P01–03 remain proposals until explicitly accepted; no implementation begins with them unresolved.

## Standards router and exact routes

Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Each SPEC repeats its exact selected paths. Routing map:

### SPEC-01

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

### SPEC-02

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

### SPEC-03

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

### SPEC-04

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

### SPEC-05

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

### SPEC-06

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

## Prior normative contracts and reconciliation

- `AGENTS.md` and `fusion-studio-server/AGENTS.md`: runtime layering, server authority, active paths, profile isolation and preservation.
- `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` and its linked Chat Wiki tree: current product source of truth. Read relevant identity/persistence, composer, protocol/actions, rendering/lifecycle and runtime pages. SOURCE-BASELINE inventories exact paths/hashes.
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/DECISIONS.md`: retained eager New Chat and view/group identity decisions.
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-00-TRUSTED-FUSION-SHELL-AUTHORITY.md`: preserve its accepted observable contracts; only aggregate host implementation shape is proposed for supersession as recorded in AUTHORITY-AND-DECISIONS.
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-01-THREAD-GROUP-FOUNDATION.md`: preserve its accepted observable contracts; only aggregate host implementation shape is proposed for supersession as recorded in AUTHORITY-AND-DECISIONS.
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-02-COMPOSABLE-CHAT-SURFACES.md`: preserve its accepted observable contracts; only aggregate host implementation shape is proposed for supersession as recorded in AUTHORITY-AND-DECISIONS.
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-03-THREAD-WORKSURFACE-CONTINUITY.md`: preserve its accepted observable contracts; only aggregate host implementation shape is proposed for supersession as recorded in AUTHORITY-AND-DECISIONS.
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md`: preserve its accepted observable contracts; only aggregate host implementation shape is proposed for supersession as recorded in AUTHORITY-AND-DECISIONS.
- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-05-ADVISORY-REPAIRS.md`: preserve its accepted observable contracts; only aggregate host implementation shape is proposed for supersession as recorded in AUTHORITY-AND-DECISIONS.
- `ai/RC-MacAir-15/Captures/003-TODO/specs/RCC-0108-SPEC-01-runtime-drain-ownership.md`: preserve canonical drain, sequence, terminal and presentation contracts applicable to each touched path.
- `ai/RC-MacAir-15/Captures/003-TODO/specs/RCC-0108-SPEC-02-server-step-frontier.md`: preserve canonical drain, sequence, terminal and presentation contracts applicable to each touched path.
- `ai/RC-MacAir-15/Captures/003-TODO/specs/RCC-0108-SPEC-03-terminal-errors-diagnostics.md`: preserve canonical drain, sequence, terminal and presentation contracts applicable to each touched path.
- `ai/RC-MacAir-15/Captures/003-TODO/specs/RCC-0108-SPEC-04-client-routing-frontier.md`: preserve canonical drain, sequence, terminal and presentation contracts applicable to each touched path.
- `ai/RC-MacAir-15/Captures/003-TODO/specs/RCC-0108-SPEC-05-presentation-acceptance.md`: preserve canonical drain, sequence, terminal and presentation contracts applicable to each touched path.

These sources are not silently amended by implementation. Current production view-bound direction and owner architectural recovery direction supersede only the exact conflicts listed in AUTHORITY-AND-DECISIONS. Historical reports remain evidence of old validation; their old baseline-red labels do not waive current failures.

## Active code and schema map

- `fusion-studio-client/src/components/App.tsx`
- `fusion-studio-client/src/components/ChatArea.tsx`
- `fusion-studio-client/src/components/chat/useViewChatHost.ts`
- `fusion-studio-client/src/components/chat/useLegacyChatHost.ts`
- `fusion-studio-client/src/components/chat/ChatSurface.tsx`
- `fusion-studio-client/src/components/chat/chatSurfaceContract.ts`
- `fusion-studio-client/src/components/MessageList.tsx`
- `fusion-studio-client/src/components/InstantSegmentRenderer.tsx`
- `fusion-studio-client/src/state/chatComposerDraftStore.ts`
- `fusion-studio-client/src/state/slices/chatSlice.ts`
- `fusion-studio-client/src/lib/chat-action.ts`
- `fusion-studio-client/src/lib/ws/thread-handlers.ts`
- `fusion-studio-client/src/lib/ws-client.ts`
- `fusion-studio-server/lib/thread/ThreadManager.js`
- `fusion-studio-server/lib/thread/thread-runtime-controller.js`
- `fusion-studio-server/lib/thread/thread-runtime-manager.js`
- `fusion-studio-server/lib/thread/thread-runtime-automation.js`
- `fusion-studio-server/lib/thread-groups/service.js`

Additional consumers/callers are inventoried in SPEC-01 using source imports and dispatch registrations. `fusion-studio-server/lib/db/migrations/044_thread_group_placement_outbox.js` is the observed migration head. SPEC-02 uses the next free platform migration after rechecking current state; never reuse a number claimed by concurrent work. Receipt schema is owned there. SPEC-05 reuses the same repository/schema and cleanup owner, not a second receipt journal. Schema creation/upgrade, accepted group-activity atomicity and restart fences require public-route DB readback.

## Validation and evidence map

VALIDATION contains required commands and existing test inventory. New paths are explicitly marked deliverables, not claimed existing tools. SPEC-01 records exact selected test IDs and command expansions; later slices extend those files/runner manifest with owned contract checks. Test infrastructure can observe real boundaries and inject adapter faults but cannot bypass auth/production routers or install product-visible test APIs.

Existing evidence in parent folder: BRIEF.md (owner request), INVESTIGATION-2026-09-19.md and MEASUREMENTS-2026-09-19.json (observations), ARCHITECTURAL-ASSESSMENT.md (hypotheses to test), FIX-PROPOSAL.md and EXPERIMENTAL-RENDER-BOUNDARIES.patch (deferred experiment, no implementation authority). SOURCE-BASELINE.json identifies selected current source bytes and unrelated dirty paths. Do not copy private backup prompt contents into committed fixtures.

## Handoff routes

After exact candidate approval, `$orchestrator` may execute one SPEC using this mandatory packet, starting with SPEC-01. Alternatively `$roadmap-implementation-supervisor` may execute ROADMAP.md with RELEASE-MANIFEST.md, spawning fresh SPEC orchestrators and pausing for owner acceptance before each following SPEC. Both obey GUIDANCE, inherited model/effort, fresh independent reviews and complete deviation reporting. No product builder has been dispatched during roadmap creation.
