# Plugin System — Decisions

**Capture:** root decisions record · **Parent:** [`plugin-system-vision.md`](./plugin-system-vision.md)
**Status:** living record; entries carry their own authority level
**Updated:** 2026-09-15 · **Prefix:** `PLUG-D###`

> Authority levels: **owner-adopted** (explicit owner direction), **recorded
> direction** (design-session direction, owner-participant, not yet exercised),
> **pending** (proposed, not settled). Only owner-adopted entries are binding
> outside the design phase.

## PLUG-D001 — A plugin is a folder with a manifest

**Authority:** recorded direction (kickoff §2t, 2026-09-14)
A plugin is a packaged extension bundle: manifest declares typed contributions,
requests capabilities, runs an install/enable/consent lifecycle. Everything else
in the ai tree is content. The four-part test: bundle, declaration, lifecycle,
consequence. Hand-built capsules stay content; a shipped view bundle is a plugin.

## PLUG-D002 — Categories are kinds, not trust

**Authority:** recorded direction (kickoff §2b/§2t)
Top-level category folders are registry organization only. Any plugin, in any
category, may request anything; grants are per-plugin. The earlier
enforcement-matrix idea is superseded.

## PLUG-D003 — The Plugins view is the trust root

**Authority:** owner-adopted (kickoff §2l, 2026-09-14)
Hard-coded, not a plugin: no capsule, cannot be disabled, configured, or
exported; pinned alone at the bottom of the view list with a permanent shield.
The surface that governs plugins cannot itself be a plugin.

## PLUG-D004 — Plugin = definition; capsule = instance

**Authority:** recorded direction (kickoff §2g)
`System/plugins/<category>/<plugin>/` holds the definition; view capsules stay
thin (`manifest.md`, `content.json`, `state/`, `styles/`) and point at the
plugin. One plugin may back many capsules; disabling a plugin deactivates its
capsules.

## PLUG-D005 — File detail, renderers, and the type registry are platform

**Authority:** owner-adopted (kickoff §2u, 2026-09-14)
Plugins do not register file types or renderers. The type registry is
code-owned; the file-detail surface (render, raw-edit, history) is a platform
API; collections link into it; the iframe viewer is the sanctioned escape hatch
for arbitrary plugin UI.

## PLUG-D006 — Off is the signal; consent binds to bytes

**Authority:** recorded direction (kickoff §2m/§2v)
Per-file sha256 for code/config/schema (never data) is stored in the
server-side consent record, verified at load and on change. Mismatch fails
closed: plugin inactive, visible re-authorization, **Register Plug-In** with a
permission diff (retained / new / removed-and-wiped). Rewinding to approved
bytes restores the plain switch. On/off is free while hashes match.

## PLUG-D007 — Authority model: grants, tickets, extension points, locks

**Authority:** recorded direction (kickoff §2c)
Standing access is declared and toggle-approved; transactional access is
ticketed into the provider's inbox (no watcher ⇒ fail closed, visibly);
extension points are declarative doors (`accepts: ...` with a schema); territory
locks enforce server-side — foreign-tree writes bounce like the settings
write-gate unless the target is a declared extension point or ticket area.

## PLUG-D008 — Scopes: workspace and machine; same categories

**Authority:** recorded direction (kickoff §2s)
Workspace scope: `ai/<machine>/System/plugins/<category>/<plugin>/`. Machine
scope: a Fusion-managed home outside any repo (shipped defaults from
`System_Manager`). Catalog distributes into both; workspace → machine promotion
is one click; category names identical everywhere.

## PLUG-D009 — `shell` is platform-owned

**Authority:** owner-adopted (kickoff §2p, 2026-09-14)
Shell surfaces (tab strip, location rail, notification bell, badges) are
platform chrome: JSON-configured, never view-modularized, never a plugin
category.

## PLUG-D010 — Skills/agents inject per spawn; never symlink

**Authority:** recorded direction (kickoff §2r, VISION §5.1, harness-verified)
The server assembles per-spawn skills/agents from global → workspace → view
scopes via the harness config; global roots are harvested read-only; installs
are validated copies; off = `permission.skill` deny on next spawn; AGENTS.md
composition goes through the ordered `instructions` array.

## PLUG-D011 — Execution home moved to fs-dev captures

**Authority:** owner-adopted (2026-09-15)
The plugin program's working captures live here (`030-Plugin_System`,
`032-Plugin_Backend`, per-view captures to follow). `~/projects/plug-ins`
remains the design archive and future catalog repo. New work happens in fs-dev.

## PLUG-D012 — Plugins emit only through server-registered producers

**Authority:** pending (design synthesis from `provenance-research.md`, 2026-09-15)
Plugins never get raw bus publish access; the server registers producers on
their behalf and assigns actor/cause. Postures: fail-open, bounded/async-only,
consent hashes stay out of provenance fields, no plugin callbacks in capture or
command-response paths, no inline retry. Producer-registration design proceeds
now; canonical publication waits on platform gates (see backend capture §2/§6).
