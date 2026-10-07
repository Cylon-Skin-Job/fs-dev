# Plugin Integration — The 50,000-Foot View

**Capture:** cross-roadmap integration concept · **Parent:** [Plugin System](../030-Plugin_System/plugin-system-vision.md)
**Status:** exploration; proposed track boundaries, not approved roadmaps or SPECs
**Updated:** 2026-09-22 (PDT)
**Trickle-down:** explicit owner decisions and current accepted chat contracts · **Roll-up:** integration choices and dependencies to the plugin root

## Owner direction and authority

**Mission Control scope update:** The owner's subsequent instruction makes this session responsible for coordination principles and durable continuity across three roadmaps, without authoring roadmaps or performing deep code searches. Start with [mission-control.md](mission-control.md). The proposals below remain background, not the current assignment or an adopted roadmap structure.

The owner requested a new fs-dev Capture to connect the separate plugin design work to current chat work and develop a concept for multiple concurrent roadmaps, each containing multiple SPECs. First establish the high-level view. The owner explicitly clarified: **“Newer chat supercedes contents of that folder.”** Therefore newer chat direction takes precedence over conflicting plugin-folder assumptions; old documents remain provenance, not instructions to recreate superseded architecture.

This capture connects existing work in 030-Plugin_System, 032-Plugin_Backend, and 029-Composable_Views. It does not replace those records or approve the proposed decomposition below. Current code establishes what exists; owner direction and accepted contracts establish what must be preserved. The active CHAT-AR roadmap's pending work is a dependency, not completed behavior.

## The product we are trying to enable

The source vision is a workspace in which a person describes an app, the assistant assembles a view from reusable capabilities, the person previews and edits it, and provisioning activates the capabilities it needs. A plugin supplies a reusable definition or capability; a workspace view is an instance with its own content, presentation, and state.

The integration concept has five major parts:

1. **Fusion platform:** workspace identity, shell, file presentation, canonical chat/runtime/persistence ownership, authorization and narrow service APIs.
2. **Plugin system:** declared contributions, registration, capability grants, enable/disable/revoke, verification and visible failures. The Plugins management surface remains platform-owned under PLUG-D003.
3. **View composition:** reusable presentation and declarative bindings assembled into workspace instances; chat is consumed through explicit identity and action contracts.
4. **Workspace and agent configuration:** workspace types, skills, agents and scope resolution; the platform assembles approved configuration at activation boundaries.
5. **Background capabilities:** triggers, connectors, watched roots and managed runtimes, consuming the same authorization and service boundaries.

This is a proposed responsibility map, not a settled package taxonomy. Platform file renderers/type registration and shell chrome stay platform-owned under PLUG-D005/D009. Making chat reusable does not transfer its persistence, runtime or command authority into an editable plugin.

## What changed since the original handoff

The original handoff waited for the final CHAT-04 of the earlier composition roadmap. The newer program is **CHAT-AR**, with six SPECs. SPEC-01–03 are accepted on current uncommitted development bytes; SPEC-04 is active; SPEC-05–06 are pending. Current SPEC-04 is not the old final CHAT-04.

The supervisor directly confirmed exact-target actions, recoverable prompt submission, explicit view/group/session identity, and pending frontend/backend ownership changes. See [Chat reconciliation](chat-reconciliation.md). Its recommended stable integration baseline is after SPEC-06 acceptance and final CHAT-AR integration review; this is a planning recommendation, not a new owner-approved release gate.

Independent design can proceed now. Later approved implementation outside chat's owned seams may proceed in isolated worktrees with explicit integration gates. Chat-dependent backend extraction must consume CHAT-AR SPEC-05's owners instead of creating a competing decomposition. Canonical provenance publication has separate gates; it should not unnecessarily block plugin authorization work.

## Proposed first integrated proof

Candidate for discussion: **one complete plugin journey**. Register one small plugin, inspect and approve its capabilities, instantiate it in a view, use one narrow platform service and one exact-target chat action, disable/re-enable it, and demonstrate a visible rejection when authority is absent or approved bytes change.

This proof would connect the parallel tracks early and expose incompatible assumptions before a large catalog is built. The specific example and whether this outcome precedes broad view conversion remain open. Local models, broad connector coverage, app-domain databases and notification expansion need not all ship in that first proof.

## Decisions to shape next

1. **First outcome:** one complete plugin journey, conversion of existing views, or a services foundation? The first is the assistant's recommendation, not an owner decision.
2. **First-party boundary:** beyond already-settled platform chrome/trust/file surfaces, which bundled applications become installable plugins and which stay code-owned? Q13 remains material.
3. **Initial package contract:** what counts as plugin capability versus editable content/configuration, and what is the installable unit? Reconcile historical category/flat-folder and skill-unit descriptions before freezing grammar.
4. **First service and view:** select a small capability with clear data ownership and few overlaps with active chat/Office work. Choose it before extraction.
5. **Integration policy:** agree on contract ownership, isolated worktrees, migration allocation and cross-roadmap acceptance. Proposed mechanics are in [Parallel roadmap concept](parallel-roadmap-concept.md).

## Reading path

- [Mission Control master vision](../039-Mission_Control_Master_Vision/vision.md): September 26 fork capturing how Fusion Studio will absorb these concepts. This folder retains the existing setup work; the new Capture owns the product-vision discussion.
- [Parallel roadmap concept](parallel-roadmap-concept.md): candidate tracks, dependency waves and coordination.
- [Chat reconciliation](chat-reconciliation.md): direct task handoff, changes and protected seams.
- [Source map and unresolved discrepancies](source-map.md): archive, existing captures and authority distinctions.
- [Handoff](handoff.md): continuation point; [changelog](changelog.md): durable updates.
