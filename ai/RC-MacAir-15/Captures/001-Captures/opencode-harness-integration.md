# OpenCode as First-Class Harness — Dispatcher, Wiki, Changelog Gate

**Date:** 2026-07-04
**Status:** Capture from design riff. Companion to `file-mutation-injection.md` (which specs the three enforcement hooks this generalizes).

## Context

We ship a containerized OpenCode as part of the product. That makes its internals product code: the harness must be understood, wiki'd, and version-gated like anything we wrote ourselves. Repo facts (verified 2026-07-04): `github.com/sst/opencode`, **MIT license** (containerized shipping is clean; attribution required), TypeScript monorepo (`packages/`), **no CHANGELOG.md — release notes live on GitHub Releases**, 830 releases, latest v1.17.13 (2026-07-01). Ships near-daily.

## 1. Hooks-as-API: the dispatcher

Instead of N standalone plugins, one plugin registers **every available hook** and funnels them into a single delegating script that routes to a scripts folder by whatever logic we add. This is the UEB pattern applied at the CLI boundary — same shape as `watch/core.js` (one chokidar instance, many subscribers) and `lib/event-bus.js` (one bus, many listeners). OpenCode's hook surface becomes an event API we own.

```
.opencode/plugins/dispatcher.js     ← registers ALL hooks, normalizes to {hook, payload, session}
        │
        ├─ routes.json (manifest)   ← hook → [script...] with per-route policy
        │
        └─ scripts/                 ← one job per script, segmented, wiki'd
            ├─ gate-read-before-edit.js
            ├─ gate-realpath-writelock.js
            ├─ report-working-set.js
            └─ ...
```

- **Two route classes, different physics.** `tool.execute.before` is synchronous and blocking — gate routes run inline and must be fast. Everything else is observe-only — telemetry routes are async fire-and-forget (stream to the Open Robin server; the informational wire gets richer for free).
- **Per-route failure policy, declared in the manifest and wiki'd:** a gate script that errors → fail-closed (block the tool call) for security gates, fail-open for advisory ones. Never implicit.
- **Segment it and wiki it like anything else:** each route/script gets the documentation convention (`name`, `description`, `when`) and a wiki page; the manifest is the TOC. This is route documentation, not a universal event/provenance block; canonical events still use the shared envelope plus registered extensions, as clarified by the [2026-07-15 provenance findings](../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat.
- The three bespoke hooks from `file-mutation-injection.md` (read-before-edit gate, realpath write-lock, working-set reporter) become the first three routes — this answers that capture's distribution open thread.
- **HTML artifacts:** produce visual docs alongside — hook API surface map, dispatcher routing diagram — as content-system artifacts in the workspace.

## 2. Repo as workspace: clone → sweep → wiki

Clone the repo, add it as a workspace, run a full sweep, build a wiki — system-level knowledge of how the harness works. This is the knowledge-partitioning doctrine in action: external/live CLI knowledge gets researched and frozen into our wiki, never guessed.

Sweep targets (sections of the eventual OpenCode wiki):

- Plugin/hook system internals — what actually fires when, what `tool.execute.before` can really mutate, error semantics (does a thrown hook fail-open or fail-closed on their side?)
- Permission system — does the glob matcher resolve realpath? (The bypass question from the hook kit.)
- Tool execution pipeline — does the edit tool enforce read-before-edit natively? (Docs silent; read the source.)
- Session/compaction model — what `experimental.session.compacting` exposes
- Server/wire surface — what the SDK `client` in plugin context can reach

The wiki pages carry `source-files` refs into the cloned repo **at a pinned tag** — which wires them straight into the audit freshness machinery.

## 3. Changelog gate: before any container bump

Same doctrine as wiki-audit Decision 7 (source freshness via git), pointed at a vendored dependency:

1. Container pins an exact version tag.
2. Before bumping: `gh release list` from pinned → target; walk every release note in between (near-daily cadence means a bump may span dozens of releases).
3. Filter for our contact surface: plugin/hook API, permission system, tool pipeline, anything our dispatcher or wiki pages touch.
4. Re-sweep the touched areas of the cloned repo at the new tag; update the wiki pages; re-run the dispatcher's smoke tests against the new version.
5. Only then bump the container.

A version bump *is* a staleness event for every OpenCode wiki page — the pinned-tag source refs make that mechanical, not judgment.

## Open Threads

>> Dispatcher language: OpenCode plugins are JS/TS run under Bun — dispatcher is a Bun module; do route scripts stay in-process (fast, shared state) or shell out (isolation, any language)?
>> Manifest schema: per-route policy fields (sync/async, fail-open/closed, timeout)?
>> Where does the cloned repo workspace live, and does the sweep reuse the code-audit-sidecar tooling once it exists?
>> Does OpenCode's plugin API version independently of the app version — is there a stability contract to track in the changelog gate?
>> Upstream contribution angle: if the dispatcher pattern is broadly useful, is any of it worth PRing upstream instead of maintaining as bespoke?
