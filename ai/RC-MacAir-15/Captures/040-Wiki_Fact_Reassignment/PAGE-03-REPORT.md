# Page 03 fact reassignment: Path Resolution

Status: REVIEW_READY (research report only; live wiki unchanged). Investigated 2026-09-28 04:00 UTC in primary `/Users/rccurtrightjr./projects/fs-dev`.

## 1. Assignment and evidence boundary

- Source: `ai/RC-MacAir-15/Wiki/001-Project/004-Path_Resolution/PAGE.md`, 4,562 bytes, SHA-256 `1a2b63979aeabe3140936928385111dd32490b713ce445e4f4860dac39a2b569`; filesystem modification time `2026-07-03T17:48:59Z` (not a factual verification date).
- Proposed principal owner: **new** `ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/007-Path_Resolution/PAGE.md` (path absent when inspected). It should explain current backend resolution and containment. The existing `002-Server_And_Runtime/PAGE.md#current-view-path-runtime` already has a short correct owner summary; avoid repeating that summary verbatim. Link the existing `001-Workspaces_And_Views/002-View_Architecture/PAGE.md#content-is-a-separate-binding` for the view/content distinction and `001-Workspaces_And_Views/004-Wiki_View/001-Architecture/005-System/PAGE.md#runtime-resolution` for wiki-only paths.
- Authorities read: Capture README and retirement triage; Wiki Guidance Style Guide, Creating Wikis, Updating Wikis, Audit Workflow; complete Code Standards router and Architecture Routing/Frontend UI; Server And Runtime; View Architecture; Wiki System. Current code inspected: `lib/views/panel-paths.js` SHA `701261e6…`, `lib/views/index.js` `3adaacc6…`, `lib/file-explorer.js` `2e92c602…`, `lib/fs/dirents.js` `78b0c933…`, `lib/fs/symlinks.js` `517f3c26…`, `lib/file-mutations/path-authority.js` `7bf9762e…`, `lib/http/panel-file-route.js` `f01939bb…`, `lib/wiki/wiki-tree.js` `3840e218…` (all under `fusion-studio-server/`); `src/lib/ws-client.ts` `799ea39d…` and `src/hooks/useWebSocket.ts` `ccc0ade8…` (under `fusion-studio-client/`). Full 64-character hashes were recorded by local SHA-256 command; abbreviations here identify the inspected bytes.
- Read-only source inspection and an existing focused test (`fusion-studio-server/test/resources/path-authority-and-atomic-writer.test.js`) support the findings. No app/server launch, test execution, network deployment, runtime configuration, installed Alpha, all mutation routes, or adversarial HTTP integration test was performed. Do **not** generalize one resolver's behavior to every entry point.

## 2. Source-section coverage

- Opening summary and `getWorkspacePath` diagram: P03-F001–F003.
- `coding-agent is special` and dated discovery lesson: P03-F002–F004.
- `__workspaces__ pseudo-workspace` and listed consumers: P03-F003–F004.
- `Security Check — Path Traversal` snippet: P03-F005–F006.
- `Symlink Risk` example and promised rejection: P03-F007–F008.
- Four `Solutions` and old deployment threat-model recommendation: P03-F009–F010.
- `Client-Side Architecture Layers`, exception and 2026-03-26 WebSocket lesson: P03-F011–F013.
- Four `Related` wiki slugs: P03-F014.

## 3. Claim map

All destination paths below are proposed until coordinator reconciliation. “Existing” means equivalent useful content is already live, not that the source claim is correct.

| ID | Original claim | Classification and evidence | Disposition and one canonical destination | Coverage/change; confidence |
|---|---|---|---|---|
| P03-F001 | `kimi-ide-server/server.js#getWorkspacePath` is the single workspace ID→path resolver. | Incorrect/superseded. Active server is `fusion-studio-server`; `lib/views/panel-paths.js#getPanelPath` delegates to `lib/views/index.js#resolveContentPath` and uses `workspace-controller` project roots. | Reject old function/layout; describe current chain in proposed Server And Runtime > Path Resolution, `## Panel and workspace roots`. | New prose needed; high for inspected read path. |
| P03-F002 | `coding-agent` maps to project root so file explorer sees whole project, with `workspace.json` at root. | Historical/superseded identity. `lib/views/index.js#resolveDefaultV2ContentPath` handles `file-viewer` as project/session root; no current `coding-agent` path branch in active resolver. | Preserve useful project-root behavior under proposed `## Panel and workspace roots`; leave old identifier and `workspace.json` anecdote in historical predecessor. | View Architecture already covers project/session root in brief; merge details, high. |
| P03-F003 | `__workspaces__` maps to `ai/workspaces/` and is not a tab. | Incorrect for current V2. `panel-paths.js` has `__panels__`, `__apps__`, `__settings__`, `__workspace__` branches; ordinary views resolve via numbered V2 capsules. | Reject old pseudo-panel. Proposed `## Virtual and compatibility panels` can mention current branches only if useful; Server And Runtime existing `## Current View Path Runtime` already mentions V2 aliases. | Existing partial, high. |
| P03-F004 | `discoverWorkspaces`, `loadWorkspaceConfig`, `hasUiFolder` use `__workspaces__/{id}`. | Historical/superseded. Current view resolution is via registry/capsules (`panel-paths.js`, `views/index.js`); `src/lib/panels.ts` still has `hasUiFolder` but probes panel UI through `fetchPanelFile`, not old pseudo-workspace. | Exclude as current fact; preserve dated lesson in predecessor's `.versions`/historical note. | No new prose, high for current claimed route; other legacy discovery code not exhaustively inventoried. |
| P03-F005 | A check in `server.js:321` uses `path.resolve(...).startsWith(basePath)` to prevent `../` traversal. | Incorrect/superseded implementation and weak general formula. `lib/file-explorer.js#isPathAllowed` uses `lib/fs/dirents.js#isInsidePath`, with `path.relative` and separator-aware check; `lib/views/index.js#assertPathInside` similarly guards configured relative roots. | Explain actual logical containment in proposed `## Read path containment`. | New prose; high. Literal `startsWith(basePath)` also risks sibling-prefix confusion. |
| P03-F006 | The check prevents `../../etc/passwd`. | Current fact only when scoped to inspected WebSocket tree/content paths: `file-explorer.js#handleFileTreeRequest/#handleFileContentRequest` reject logical escapes before filesystem reads. | Proposed `## Read path containment`, with entry-point scope. | New prose; high for inspected handlers, no universal security claim. |
| P03-F007 | `path.resolve()` follows symlinks and yields physical canonical paths. | Incorrect. Node `path.resolve` normalizes and makes paths absolute lexically; actual physical resolution is `fs.realpath`/`fs.realpathSync` as used in `lib/fs/dirents.js`, `lib/fs/symlinks.js`, `lib/file-mutations/path-authority.js`. | Explicit correction in proposed `## Symlinks: logical and physical paths`; remove old explanation from active source. | New prose essential; high. |
| P03-F008 | An external `sessions` symlink will be rejected by the read containment check. | Incorrect for inspected current WebSocket reads. `file-explorer.js#isPathAllowed` comments that reads follow user-created external symlinks; `handleFileContentRequest` uses `fs.stat/readFile`, and tree uses `fs.readdir`/`classifyEntry`; `resolveSymlinkInfo` reports physical target but does not enforce containment. | Proposed `## Symlinks: logical and physical paths`, warn that logical containment is **not** physical isolation. | New prose essential; high for inspected read path. |
| P03-F009 | Suggested remedies: realpath base, allowlist target, copy/mount, agents override. | Proposal tied to false diagnosis. Realpath of base alone does not prove child containment; agent override and threat-model recommendation have no current approval. | Do not migrate as prescriptions. If future policy changes, require explicit per-entry-point design under Architecture Routing and path-authority owner. | Historical-only; high as editorial disposition. |
| P03-F010 | A local-only pre-Electron IDE can accept options 1/4, network deployment needs 2. | Historical observation/proposal for prior product identity; no present authorization or present deployment analysis. | Exclude from live facts; historical predecessor only. | High. |
| P03-F011 | Frontend always flows `components → hooks → lib → state`, with imports constrained by layer. | Superseded/overbroad as a hard architecture rule. Current Code Standards router/Frontend UI Standards define explicit presentation and routing ownership; current `ws-client.ts` legitimately imports Zustand stores. | Link to Code Standards from a brief source route; do not create a second frontend standard inside Path Resolution. | Existing authoritative standard; high. |
| P03-F012 | `lib/ws-client.ts` imports `hooks/useFileTree` and `components/Toast`, creating a circularity risk. | Incorrect current fact. `hooks/useFileTree.ts` is absent; `ws-client.ts` imports `./ws/file-handlers`, while that module imports `../toast`; `components/Toast.tsx` mounts an imperative bridge in `lib/toast.ts`. | Exclude active exception claim; historical predecessor only. | High for named imports; source-wide dependency-cycle audit not done. |
| P03-F013 | Extracting a plain `lib/ws-client.ts` fixed old discovery deadlock and stale closure. | Historical lesson; current module is standalone and `hooks/useWebSocket.ts` is a thin wrapper over `connectWs`/`disconnectWs`, but the dated causal bug/fix is not verifiable from current code alone. | Retain only the current ownership sentence under existing WebSocket/client architecture if needed; keep dated causal claim historical. | High for current structure, unverified for old incident. |
| P03-F014 | `[[Workspaces]]`, `[[Workspace-Agent-Model]]`, `[[Chat]]`, `[[Workspace-Index]]` are useful related links. | Broken/ambiguous legacy slugs rather than validated Markdown paths. Current relevant owners are View Architecture, Server And Runtime, Wiki System, Chat Runtime. | Replace with actual relative Markdown links in source routing and new article; avoid unrelated Chat/agent link list unless prose uses it. | High for current file tree; exact legacy slug resolver behavior not tested. |

## 4. Integrated replacement prose (proposed)

### New `002-Server_And_Runtime/007-Path_Resolution/PAGE.md`

Suggested title: **Path Resolution And Containment**. Suggested description: “How current workspace/view paths are resolved for reads and writes, including symlink behavior and containment limits.” Exact `metadata.source-files` candidates: `fusion-studio-server/lib/views/panel-paths.js`, `fusion-studio-server/lib/views/index.js`, `fusion-studio-server/lib/file-explorer.js`, `fusion-studio-server/lib/fs/dirents.js`, `fusion-studio-server/lib/fs/symlinks.js`, `fusion-studio-server/lib/file-mutations/path-authority.js`, `fusion-studio-server/lib/http/panel-file-route.js`, `fusion-studio-server/lib/wiki/wiki-tree.js`. Include only files actually explained in final prose; stamp actual UTC edit time when created.

> ## Panel and workspace roots
>
> The server obtains a project root from the connection's workspace session or the active workspace registry. `getPanelPath` resolves named view panels through the numbered V2 capsules under `ai/<machine>/System/Views`; the view's `content.json` may bind content to a different root. `file-viewer` defaults to the project root or its connection-selected folder. `wiki-viewer` defaults to `ai/<machine>/Wiki`; Capture and Office have their own machine-scoped roots. See [View Architecture](../../001-Workspaces_And_Views/002-View_Architecture/PAGE.md#content-is-a-separate-binding) for the configuration model. `__panels__` and `__workspace__` serve V2 metadata, while `__apps__` and `__settings__` are explicit independent pseudo-panels; these are not ordinary view tabs.
>
> ## Read path containment
>
> WebSocket file-tree and file-content handlers resolve a requested path relative to the selected panel root and reject lexical escapes using a separator-aware `path.relative` check. Configured workspace-, machine-, and view-relative content roots likewise reject lexical escapes from their allowed roots. These checks constrain the path spelling. They do not by themselves confine physical symlink targets.
>
> ## Symlinks and mutation authority
>
> `path.resolve()` makes an absolute normalized path without following symlinks. `fs.realpath()` follows them. The WebSocket file browser deliberately follows readable user-created symlinks, including links outside the panel root; it reports symlink information where available. The file-mutation path authority has a different contract: it starts from the workspace registry, resolves real workspace/panel/parent paths, checks physical containment, and rejects a symlink as the final target. An existing legacy `file_save_request` handler in `file-explorer.js` has its own write path and resolves a final symlink before writing; do not imply the newer path authority governs every legacy mutation. The HTTP panel-file route also has its own resolver/`sendFile` path, so assess that entry point separately before making a global security promise.
>
> ## Wiki tooling
>
> `wiki-tree.js` resolves the V2 wiki content root through the view resolver for terminal queries and uses real paths for directory traversal/cycle protection. The Wiki System article owns wiki-specific folder and query conventions.

The HTTP sentence is deliberately bounded: `panel-file-route.js` resolves a directory with `fs.realpathSync`, uses the root-bound panel resolver, and delegates serving to Express `sendFile`. Source inspection did not certify a full HTTP containment guarantee. If this article stays smaller, omit that sentence and link to a separate HTTP owner, but do not claim all read routes have one security check.

### Existing `002-Server_And_Runtime/PAGE.md#current-view-path-runtime`

Keep as a concise navigation map. Add a direct link to the new article once it exists, and change `## Planned Children` treatment for `007-Path_Resolution/` from planned to actual. The current path-runtime bullets already cover view resolution and should remain an overview, not a competing full explanation.

### Existing `001-Project/004-Path_Resolution/PAGE.md`

After a complete `.versions` preimage, replace misleading current prose with a short route to the new canonical article plus a bounded historical note: “This page documented the old `kimi-ide-server`/`ai/workspaces` layout and a 2026-03-26 incident. Those paths and its symlink explanation do not describe current Fusion Studio. For current behavior, see [Path Resolution And Containment](../../002-Server_And_Runtime/007-Path_Resolution/PAGE.md).” No live deletion in this pass.

## 5. Exclusions

Do not carry over old `coding-agent` and `__workspaces__` branches, `workspace.json` discovery, `kimi-ide-server/server.js:321`, the `startsWith(basePath)` code sample, or the `/Users/you/.kimi/sessions` example as active facts. The example's predicted symlink rejection rests on the false statement that `path.resolve` calls `realpath`. The four “solutions” and local/network recommendation are unapproved design options; preserving them as current guidance would be misleading. Do not migrate the stale frontend import exception, old `useWebSocket` deadlock story, or unverified 2026-03-26 causal account as current architecture. Their historical record remains in the exact predecessor/snapshot.

## 6. Incoming references and shared ownership

- **Live wiki incoming exact path references: 2 pages.** `001-Project/PAGE.md` links the source in its child list; `002-Server_And_Runtime/PAGE.md` links it under Migration Sources. Both need a conscious redirect or retained route. The latter also reserves `007-Path_Resolution/` as planned. `001-Workspaces_And_Views/012-Viewer_Search/PAGE.md` links the Server And Runtime `#current-view-path-runtime` anchor, not this old page; preserve that anchor or update its link if moving text.
- **Issue dependency: 1 active issue text.** `ai/RC-MacAir-15/Issues/inbox/RCC-0102.md` names `001-Project/004` as an inaccurate page at lines 33 and 56. Keep the source route available; do not edit ticket state in this pass.
- **Shipped template trees: 2 copies of this old page and 2 Server And Runtime links** under `System_Manager/ai-template/Wiki/` and `System_Manager/ai-v2/RC-MacAir-15/Wiki/`. These are outside this page agent's live-wiki scope and block physical retirement if their references are expected to resolve after copying.
- Captures, `.versions`, prior inventories and diff/manifests contain historical references, including `020-CSS_UI_Changes/WIKI_LIST.md`/`WIKI_IMPACT.md` and the triage audit; these are evidence, not live navigation. Runtime cache and generated inventories were not modified.
- Legacy `[[Workspaces]]`, `[[Workspace-Agent-Model]]`, `[[Chat]]`, `[[Workspace-Index]]` in the source are slug-style examples with no validated current target in this report. Use explicit relative paths for retained navigation.
- Shared destination risk: agent 01 owns the Project navigation page; agent 03's proposed source redirect and agent 01's navigation rewrite must agree. Server And Runtime may also receive Background Services material from agents 05/12. View Architecture and Wiki System already own their specialist contracts; link, do not duplicate.

## 7. Unresolved items

1. **Researchable:** Confirm all current public write entry points before a *global* containment statement. This report verified `path-authority.js` and found a distinct legacy `file_save_request` route; the coordinator can keep article wording explicitly per route now. No owner decision needed for this editorial scope.
2. **Researchable:** Check the HTTP panel-file route with a focused route-level test if the final prose is to claim physical confinement. Current inspection supports only the bounded behavior stated above. Omit a universal claim pending evidence.
3. **Implementation choice outside this migration:** Whether external symlink reads should remain supported and whether legacy write paths should be consolidated with path authority. Existing source behavior is clear enough to document; this documentation pass should not silently choose new policy.
4. **No indispensable owner decision for the fact migration.** The new article under Server And Runtime is justified by the already planned child and code ownership. A concise section in the existing parent is possible, but its current navigation map is already busy; recommend the new leaf.

## 8. Retirement readiness

**Ready for physical retirement only after** the coordinator creates and verifies the canonical replacement, snapshots and converts this source to a successor route/historical note, repairs the two live wiki incoming links as appropriate, preserves Project navigation, and records the outside-scope issue/template references as retirement dependencies. The current page is not ready: it still presents false active symlink and obsolete path claims. No deletion or live-wiki edit was performed here.
