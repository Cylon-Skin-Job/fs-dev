---
name: "Provenance Planning Baseline"
description: "Provenance Planning Baseline for the documentation-only provenance reconciliation."
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Preparation baseline

Prepared 2026-09-19 in `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`. BASELINE.json records full refs, 27 page hashes, and dirty paths. The preceding interrupted turn performed reads only; it made no wiki edit. This preparation creates files only in Capture 034.

## Branch discovery

`git fetch origin` and `git fetch gitlab` succeeded. The latter discovered `gitlab/spec-bs-001-validation-findings`. No checkout, merge, pull, push, or worktree creation occurred. The worktree inventory lists only this development checkout; installed Alpha/source are distinct baselines and were not inspected or certified.

Read-only branch audit used all fetched local/remote refs, ancestry, branch-only diffs from merge-base, and relevant file comparisons. Result: no newer provenance/System-persistence implementation absent from HEAD was found in the inspected surface.

| Ref / revision | Disposition and source evidence |
|---|---|
| `codex/prov01-accepted-source` / `acf12da`; `codex/prov01-integration` / `2a275a3` | Both ancestors of HEAD; accepted baseline already included. |
| `main`, `origin/main` / `7372933` | Ancestor, ten commits behind preparation HEAD. |
| `origin/agent/exact-workspace-paths` | Equal to preparation HEAD after fetch. |
| `agent/oe009-complete-office-work` / `5434527`; `gitlab/main` / `bafc1ed` | Divergent older promotion lineage. Changed older DB module, event-ledger implementation and migrations match HEAD. Branch audit/finalization, collector removal and workspace-aware Git versioning behaviors are present at HEAD (`lib/audit/audit-subscriber.js`, `lib/chat-metadata/collectors/file-mutations.js`, `lib/versioning.js`). These refs lack later provenance/agent bootstrap and protected-path behavior. |
| `gitlab/spec-bs-001-validation-findings` / `3d7e43f` | Unique validation commits `ad1d4ce` and `3d7e43f` change capture/evidence records, not server `lib/` or renderer `src/`. Same older implementation lineage. |
| `archive/rcc-0108-dirty-state` / `8880257` | Branch-only change is a supervisor ledger, no product implementation. |
| `archive/universal-view-tab-bar-wip` / `6565c01` | Relevant agent-provenance, file-mutations, subscriptions, event-registry, ledger, resource query and renderer protocol content matches accepted `acf12da`; HEAD adds later work. Divergent ancestry is not missing newer behavior. |

All remaining inventoried local refs are ancestors. BRIDGE-01 commit `16ccecf` and accepted view-platform commit `46cd6dc` are already incorporated. Confidence is high for this bounded provenance/persistence surface, not a claim that every unrelated branch feature is equivalent. Fetched refs cannot establish undisclosed/unpushed work in another checkout.

## Source map for execution recheck

| Contract | Read current owners end to end |
|---|---|
| System DB | `fusion-studio-server/lib/db.js`; migrations 029, 033–036, 040 and later relevant migrations; actual consumers, not migration declarations alone |
| Governed events | `lib/startup.js`, `lib/event-bus.js`, `lib/event-registry/`, `lib/subscriptions/` |
| Save recovery | `lib/file-mutations/`, public `lib/ws/file-save-route.js`, router/File Explorer delegation; client `state/fileDataStore.ts` and its callers |
| Save UI context | client `lib/save-action-context.ts`; server `lib/file-mutations/reported-ui-context.js`; schema seeds and migration 040; resource query repository |
| Storage/query | `lib/ledger/`, `lib/ws/resource-provenance-route.js`; agent query route/repository and client protocol consumers |
| Tool observation | `lib/harness/opencode/`, canonical harness/wire bridge, `lib/agent-provenance/`, startup and subscriptions |
| Visible freshness | server resource projection → client `lib/ws/{resource-projection-protocol.ts,file-handlers.ts}` → `state/{fileDataStore.ts,file-data-read-model.ts}` → File Viewer components |
| System target gap | migration 022; `lib/calendar/{index.js,db-writer.js,apple/sync.js,google/sync.js}`; startup; `server.js`; `lib/http/calendar-routes.js`; client `state/calendarStore.ts` |

Paths abbreviated `lib/` above are under `fusion-studio-server/`; client paths are under `fusion-studio-client/src/`. Confirm current names at execution; source discovery is part of S00.

## Evidence limits and concurrent ownership

This plan used source/document inspection, Git inspection, and planning-document validation. No product tests, provider calls, UI smoke, live DB inspection, app launches, or Alpha verification were performed. Existing test/report results are historical or unrun assertions unless freshly checked under a separately authorized scope.

Chat reconciliation owns `Wiki/007-Chat_System`, the shared `Workspaces_And_Views/013-View_Activity_And_Collections` page, and Capture 033. Office harness work and workspace state are dirty too. Preserve all these writes; their drift is not attributable to this task. Do not freeze their hashes as a condition that forbids other sessions progressing.

The documented TOC generator `fusion-studio-server/scripts/sync-wiki-tocs.js` is absent. This SPEC avoids structural changes and preserves marker blocks byte-for-byte. Do not invent a generator or mutate all wiki navigation.
