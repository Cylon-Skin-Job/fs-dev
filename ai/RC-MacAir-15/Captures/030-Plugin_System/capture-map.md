# Capture Map — Plugin System Suite

**Capture:** cross-read hub for the plugin-system captures · **Parent:** [`plugin-system-vision.md`](./plugin-system-vision.md)
**Status:** living index · **Updated:** 2026-09-22
**Trickle-down:** none (index) · **Roll-up:** update when captures are added or move

---

## Active captures

| Capture | Purpose | Status |
|---|---|---|
| [`./plugin-system-vision.md`](./plugin-system-vision.md) | Root program vision: thesis, plugin definition, P1–P7, layer map, program sequence | Working vision |
| [`./capture-system.md`](./capture-system.md) | Trickle-down / roll-up conventions, changelog + handoff rules, cross-read rules | Binding for this suite |
| [`./decisions.md`](./decisions.md) | Root owner decisions (`PLUG-D###`) | Living record |
| [`./issues.md`](./issues.md) | Root open questions and gates (`PLUG-I###`) | Living record |
| [`../032-Plugin_Backend/backend-architecture.md`](../032-Plugin_Backend/backend-architecture.md) | Backend capture: gates split, layer architecture, command-surface contract, modularization plan | Working architecture |
| [`../037-Plugin_Integration_And_Parallel_Roadmaps/integration-overview.md`](../037-Plugin_Integration_And_Parallel_Roadmaps/integration-overview.md) | High-level integration with newer CHAT-AR work; candidate concurrent roadmap tracks and shared contracts | Exploration; no implementation approval |

Per-view captures are created as execution begins and will appear here.

## Source archives (read-only design corpus)

| Source | Path |
|---|---|
| Vision / flow doc | `~/projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md` |
| Design record (kickoff §1–§3) | `~/projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/plugin-system-kickoff.md` |
| Provenance conformance research | `~/projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/provenance-research.md` |
| Current-state observations | `~/projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/OBSERVATIONS.md` |
| Plugins-view mockup SPEC (draft) | `~/projects/plug-ins/ai/RC-MacAir-15/Captures/002-Specs/PLUGINS-VIEW-MOCKUP/` |
| Playground wireframes | `~/projects/plug-ins/ai/RC-MacAir-15/Captures/004-Playground/` |

The plug-ins repo (`~/projects/plug-ins`) remains the design archive and future
catalog; the next work happens in these fs-dev captures and in fs-dev code.

## Related fs-dev captures

| Capture | Relationship |
|---|---|
| [`../029-Composable_Views/`](../029-Composable_Views/) | L1–L6 platform track the plugin system builds on |
| [`../012-App_Federation/`](../012-App_Federation/) | Registration, capability grants, tickets |
| [`../016-Per_View_Agents/`](../016-Per_View_Agents/) | View territory, protocol, skills scoping |
| [`../018-Local_Model_Toolbox/`](../018-Local_Model_Toolbox/) | Declared capabilities, pipelines, staged execution |
| [`../019-System_Manager/`](../019-System_Manager/) | Bundled defaults vs catalog tier (open question) |
| [`../023-MVP-Provenance-Subscriptions/`](../023-MVP-Provenance-Subscriptions/), [`../024-Agent-Tool-Provenance/`](../024-Agent-Tool-Provenance/) | Provenance platform antecedents |
| [`../025-Chat_Composition_Roadmap/`](../025-Chat_Composition_Roadmap/) | Trusted-shell authority (SPEC-00) that plugins build on; chat road complete |

## Platform anchors

| Anchor | Use |
|---|---|
| `../../Wiki/010-Events_And_Ledger/` | Provenance model, ledger schema, open retention/storm decisions |
| `../../Wiki/005-Enforcement/001-Code_Standards/` | Routed code standards (architecture, persistence, testing) |
| `../../Wiki/006-System_Manager/001-Workspaces_&_Views/005-Skills_And_Tools/` | Empty — documentation gap to fill when skills ship (OBSERVATIONS O8) |
| `../../AGENTS.md` | Repo-level working rules |
