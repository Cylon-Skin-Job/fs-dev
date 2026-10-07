# Mission Control — Handoff

**Capture:** cross-roadmap integration concept · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** defining coordination principles and continuity; no live controller activated
**Updated:** 2026-09-27 (PDT)
**Trickle-down:** newer chat takes precedence · **Roll-up:** decisions and dependencies to 030

## Current state

Start with [mission-control.md](mission-control.md). MC-T01 is complete: the owner confirmed per-SPEC acceptance remains and supplied the hierarchy Mission Control → Roadmap Supervisor → SPEC Orchestrator → Slice Builder, with Branch Manager → Sub Agents. Mission Control understands job scope and assigns its owner; each manager directs its subordinates. Milestone test/walkthrough agents will follow owner-defined standards in later design.

MC-T02 and MC-T03 are complete. [Registry](registry.md) and [bulletin](bulletin.md) use the flat-Markdown Capture convention. [Domain routing](domain-routing.md) assigns jobs by accountable role and defines an intake packet for roadmaps chosen later. The registry has three unassigned roadmap slots; no project roadmaps have been inferred from plugin proposals. No profile, HTML artifact or automation exists yet.

[coordination-system.md](coordination-system.md) proposes the registry/bulletin, bounded specialist handoffs, ticket relationships, HTML hierarchy and hourly recovery cycle. These are design proposals. No Mission Control profile, artifact, live registry, build dispatch or timer has been activated by this session. Earlier five-track/plugin-journey proposals are retained background.

[ticket-inventory.md](ticket-inventory.md) records a bounded survey: 40 registry entries (29 open/11 closed), 41 Markdown IDs, and RCC-0104 absent from the registry. No ticket state was changed or adjudicated.

Checked in directly with the named chat supervisor and recorded its handoff in [chat-reconciliation.md](chat-reconciliation.md). CHAT-AR 01–03 accepted, 04 active, 05–06 pending at capture time. The original plugin handoff's post-CHAT-04 branch assumption is superseded. Accepted chat changes remain uncommitted in a dirty shared checkout.

## Next conversation

The owner is building Mission Control itself through sequential owner-managed chats. Use [todo.md](todo.md) as the work list and [registry.md](registry.md) as current task state. The three product roadmaps are selected and assigned later, after MC is ready. MC-T01 through MC-T03 are complete.

Read [role-hierarchy-and-guardrails.md](role-hierarchy-and-guardrails.md) for the full proposed process tree, roles, file-set/Git awareness, fail-forward rule, attended remote-publishing boundary and agent/skill path index. It supplements the concise owner-confirmed hierarchy in mission-control.md. The [User Profile Wiki article](../../Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md) now supplies standing owner preferences for Mission Control and the roadmap roles; it supersedes the tentative `USER.md` duplication idea. The SPEC progression rule preserves per-SPEC owner acceptance. Roadmaps may carry unresolved edge cases only when later work will not impair or compound the fix; otherwise, hold the affected work and ask the owner. Mission Control keeps routine work moving while surfacing material decisions and deviations at the right level of detail.

Next owner-managed chat: MC-T04, domain-agent profile and Capture workflow. Supply [mission-control.md](mission-control.md), [domain-routing.md](domain-routing.md), the MC-T04 section of [todo.md](todo.md), and the existing Capture conventions. Keep the domain-agent profile separate from product-roadmap assignments, which remain future inputs.

Do not create chats, start agents, install profiles or activate monitoring merely because later TODO items exist. The owner clarified that per-SPEC acceptance checkpoints remain. Preflight, First Draft and agent profiles remain future design work.

## Constraints and coordination

Keep all content flat Markdown under the numbered Capture folder, following the existing plugin suite contract; no JSON sidecars or nested roadmap scaffolding were created. The Second Brain source/authority and bounded research workflow was applied within that existing document convention.

Only documentation is in scope. Preserve the external design corpus, product code, active chat roadmap, runtime files and unrelated edits. Do not grant plugin authority from portable UI descriptors, duplicate current chat extraction, or infer a published baseline from accepted uncommitted work. No commit, push, Alpha operation or product launch was requested.

## Previous handoffs

Earlier September 22 checkpoint focused on plugin integration and five candidate tracks. The subsequent Mission Control direction supersedes its instruction to select a plugin milestone next. The dated chat/source reconciliation remains available when relevant.
