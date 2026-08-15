# SPEC-31 — App-Wide Symlink Support

**Origin:** `ai/<machine>/Captures/001-Captures/wiki-audit-decisions.md` — Decision 12 + Checklist A2
**Status:** READY FOR 31a.1 AND 31a.2; 31a.3+ REQUIRE THE DISCOVERY NOTES BELOW
**Blast radius:** Medium. Touches shared filesystem scanning, file-viewer, capture-viewer, wiki, and selected startup loaders. Each slice must stop at its checkpoint.
**Execution model:** Orchestrator assigns one chunk per worker session. The user + orchestrator review every smoke result before the next chunk starts. Never proceed past a failed smoke test.

---

## Mission

Make symlinked folders and files first-class citizens everywhere Fusion Studio scans or displays the filesystem. Once a symlink exists in a workspace, Fusion Studio treats it as a real resource for browsing, reading, editing, grepping, querying, wiki scanning, prompt loading, trigger loading, and AI context.

The boundary is on the **addition/creation side**, not the read/use side:

- Manually created inbound symlinks are user intent, including symlinks to folders outside the repo.
- Fusion UI should not offer an easy path for creating inbound symlinks whose targets are outside the workspace/repo.
- AI/tool-created symlinks are governed by Open Router Hooks (`RCC-0110`).
- Future import copies external content into a workspace; import does not create inbound symlinks.

The architectural centerpiece is extracting the file-explorer's inline symlink handling into shared filesystem helpers, then moving recursive scanners onto that shared contract.

## Readiness Notes

Implementation may begin with Slice 31a.1 and Slice 31a.2. Later slices are also scoped, but workers must treat their discovery notes as part of the task before editing.

- Slice 31a.3 intentionally requires discovering the current capture, Office, and wiki opened-resource load paths before changing UI components.
- Slice 31d must include both `fusion-studio-server/lib/views/index.js` and the parallel V2 registry writer paths in `fusion-studio-server/lib/views/workspace-registry-writer.js` where view-folder availability/listing uses non-following directory checks.
- Client metadata must reach opened resources, not just tree rows. In file-viewer this means `FileTreeNode`, `FileInfo`, `EditorTab.file`, and `FileContentResponse` all need enough symlink metadata to preserve `isSymlink` and `symlinkTarget` through open, content response, active-tab render, and persisted tab restore.

---

## Non-Negotiable Rules

- **Symlinks behave like real files/folders.** Do not hide symlinks merely because their targets resolve outside the repo.
- **Broken links are skipped.** A broken symlink should not crash a scanner or render as an actionable row.
- **Runtime scans are reads.** Runtime scanners never emit events. Change notification rides the existing chokidar -> `workspace-watcher` -> UEB `file:changed` rail. Generator scripts such as TOC sync may keep writing their existing generated marker blocks.
- **No SQLite, polling, or daemon.** The filesystem is the source of truth; classification happens at request/scan time.
- **No auto-repair.** Never delete, rewrite, or "fix" symlinks created outside Fusion Studio.
- **Recursive scans guard by realpath.** Per-run visited-realpath guards prevent cycles and diamond duplicates.
- **One-level UI listings can show all links.** Cycle guards are for automatic recursion, not ordinary folder row rendering.
- **Opened descendants inherit symlink status.** If a folder is symlinked, every opened child resource under that linked folder gets the symlink indicator.
- **No realpath tab/session dedupe.** Visible path remains the UI identity for this spec.
- **Realtime editing is out of scope.** Today realtime editing exists only in the Office/editor path; global UEB/chokidar refresh/spinner behavior is a future build.
- **No versioning behavior.** The future resource-versioning ledger will classify provenance as `chat_assistant`, `system`, or `app_ui`; external edits detected by watcher classify as `system`.

---

## User-Facing Symlink Policy

### Indicators

Visible symlink indicators appear on opened resources, not tree rows.

- **File-viewer:** replace the redundant file-language badge (`code` + `Markdown`, `Shell`, etc.) with `folder_match` + `Symlink` when the active file is under a symlinked path. The text is title case, not all caps and not bold.
- **Capture-viewer:** show icon-only `folder_match` to the left of existing right-side header actions when an opened file resource is under a symlinked path.
- **Wiki:** show icon-only `folder_match` to the left of existing right-side header actions when an opened page is under a symlinked path.
- **Office folder headers:** when a folder-level header already has right-side actions such as link/send-to-chat, show icon-only `folder_match` to the left of those actions when the opened folder path is symlinked.

Shared tooltip/popover copy:

```text
This resource is linked. Source: <resolved resource path>. Edits here update the same underlying file.
```

Always show the resolved final resource path, not merely the symlinked ancestor folder.

### Future Creation UX

Future symlink creation is a user-facing right-click menu, not part of this scanner spec:

All menu options create a symlink that points back to the selected Fusion resource. The selected resource is the target/source; the user chooses where the new link is placed.

- `Create symlink -> External Symlink` creates an outward link at a user-chosen external location. It uses the OS file/folder picker for the external link location.
- `Create symlink -> Within {{Workspace}}` creates a link inside the current workspace. It uses Fusion Studio's internal picker for the link location.
- `Create symlink -> Another Workspace` creates a link inside another workspace. It first shows a choose-workspace step, then uses the internal picker for the link location in that workspace.

Fusion-created symlinks must reject obvious recursive loops:

```text
repo/docs/self -> repo/docs
repo/docs/link-back -> repo
```

Suggested copy:

```text
Cannot create this symlink because it would point to a parent folder and create a recursive loop.
```

Do not attempt full graph validation for every possible multi-link cycle; recursive scanners own runtime safety.

---

## Shared Filesystem Contract

### `fusion-studio-server/lib/fs/dirents.js`

Extract the link-aware classification currently embedded in `fusion-studio-server/lib/file-explorer.js`.

```js
async function classifyEntry(parentDir, dirent)
function classifyEntrySync(parentDir, dirent)

// Returns:
// {
//   name:      dirent.name,
//   isDir:     boolean,   // through symlink
//   isFile:    boolean,   // through symlink
//   isSymlink: boolean,   // symlink or Windows junction fallback
//   realPath:  string|null|undefined
//              // symlink: resolved target/source path; broken link: null;
//              // non-symlink: undefined
// }
```

Behavior:

1. Read `dirent.isDirectory()`, `dirent.isFile()`, and `dirent.isSymbolicLink()` first.
2. If not reported as symlink but is dir/file, `lstat` the full path. If lstat says symlink, treat it as a symlink. This preserves the Windows junction fallback already in file-explorer.
3. If symlink, `stat` through the link for actual type and `realpath` for the resolved target/source path.
4. Broken symlink: `{ isSymlink: true, isDir: false, isFile: false, realPath: null }`.
5. Swallow lstat errors and treat the entry as its original dirent type, matching current file-explorer behavior.

Also export:

```js
function isInsidePath(rootPath, targetPath)
```

Use it for logical containment checks such as `isPathAllowed`. It must use `path.relative()`, not string prefix checks. Do not use it to hide user-created symlink targets outside the repo.

### `fusion-studio-server/lib/fs/cycle-guard.js`

```js
function createCycleGuard()
// returns { shouldEnter(realPath) -> boolean }
```

Semantics:

- Per-run, in-memory guard.
- Used only by recursive lookup/indexing/generated-output scans.
- Before entering the walk root, resolve its realpath and call `shouldEnter(rootRealPath)`.
- Before recursively entering any child directory, resolve that child's realpath and call `shouldEnter(childRealPath)`.
- `false` means skip.

This prevents:

- ancestor loops (`link -> parent`)
- multi-link cycles
- diamond duplicates (`A/shared -> real`, `B/shared -> same real`)

Which visible path wins is traversal-order dependent and has no semantic meaning. One-level UI listings can still show every visible link. Future "appears in multiple places" metadata belongs to the wiki audit/query layer, not this scanner foundation.

Recursive walkers must resolve `fs.realpath` / `realpathSync` for every directory before entering it. `classifyEntry.realPath` may be reused for symlinked directories, but ordinary directories still need a realpath when the walker can enter symlinked folders elsewhere in the same scan.

### `resolveSymlinkInfo(basePath, requestPath)`

Add a helper where opened-resource metadata is assembled, likely near file-explorer content handling first and shared later if capture/wiki need it.

Required behavior:

- Walk from the content root/panel root to the requested resource.
- Detect whether the final segment or any ancestor is a symlink.
- If any symlink is encountered, return:

```js
{
  isSymlink: true,
  symlinkTarget: fs.realpathSync(finalResourcePath)
}
```

- If no symlink is encountered, omit symlink metadata.
- Broken links fall through the normal file read/list failure path.

Optional internal fields such as `symlinkRootPath` or `symlinkRootTarget` may be added only if needed; UI currently needs only `isSymlink` and final `symlinkTarget`.

---

## Slice 31a.1 — Core Classifier and Tests

**Goal:** Build the shared contract with no app behavior changes.

### Files

| File | Change |
|---|---|
| `fusion-studio-server/lib/fs/dirents.js` | NEW |
| `fusion-studio-server/lib/fs/cycle-guard.js` | NEW |
| `fusion-studio-server/test/fs/dirents.test.js` | NEW |

### Tests

Create fixtures in `os.tmpdir()`:

- regular dir
- regular file
- link -> dir
- link -> file
- broken link
- link -> link -> dir
- cycle
- diamond
- external-target link (for example `/tmp/...`)

Assert sync and async classification, broken-link shape, external-target link visibility, and guarded recursive walk termination.

### Verification

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- test/fs
```

**CHECKPOINT:** report test results and changed files.

---

## Slice 31a.2 — File-Viewer Adoption

**Goal:** Adopt the classifier in file-viewer paths and prove symlink behavior end to end in file-viewer.

### Files

| File | Change |
|---|---|
| `fusion-studio-server/lib/file-explorer.js` | consume classifier; delete inline lstat/stat block; fix recent-files; tighten logical containment; emit symlink metadata on tree/content responses |
| `fusion-studio-client/src/types/file-explorer.ts` | add `isSymlink?: boolean` and `symlinkTarget?: string` to tree/content/opened-file metadata: `FileTreeNode`, `FileInfo`, and `FileContentResponse` |
| `fusion-studio-client/src/lib/file-tree.ts` | preserve symlink metadata when opening/fetching |
| `fusion-studio-client/src/state/fileStore.ts` | preserve symlink metadata in tabs and content application |
| `fusion-studio-client/src/components/file-explorer/FileViewer.tsx` | replace language badge with `folder_match` + `Symlink` when active resource is linked |

### Steps

1. `handleFileTreeRequest`: replace the inline symlink detection block with `await classifyEntry(targetPath, entry)`. Broken links are skipped. Include `symlinkTarget` on symlink nodes; omit the key otherwise. Do not add visible tree badges/tooltips.
2. `handleRecentFilesRequest`: replace raw `entry.isDirectory()` / `entry.isFile()` with `classifyEntry`. Skip broken links. Add a per-run cycle guard. Keep the existing depth cap, hidden-folder rules, excluded folder list, and `node_modules` behavior.
3. `handleFileContentRequest`: use ancestor-aware `resolveSymlinkInfo(basePath, requestPath)` so files under a symlinked folder get symlink metadata.
4. `isPathAllowed`: keep logical path containment against the panel root, replace `startsWith` with `isInsidePath`, and collapse decorative symlink Pass 2 into a policy comment. Reads follow symlinks regardless of target.
5. Keep `getProjectRoot` in the file-explorer factory; virtual V2 content still uses it.
6. Client: carry `isSymlink` / `symlinkTarget` through tree node conversion, tab open, content response, persisted tab restore where applicable, and active file metadata. `EditorTab.file` uses `FileInfo`, so `FileInfo` is the authoritative opened-resource type.
7. `FileViewer`: remove the redundant language-name badge. Render `folder_match` + `Symlink` with the shared tooltip only when the active file is symlinked.

Tree response symlink metadata is server/API metadata only. Do not add client tree rendering behavior beyond preserving existing open behavior.

### Smoke

```bash
cd /Users/rccurtrightjr./projects/fs-dev
mkdir -p .tmp/symlink-smoke-target && echo hi > .tmp/symlink-smoke-target/note.md
ln -s "$(pwd)/.tmp/symlink-smoke-target" .tmp/symlink-smoke-link
ln -s /nonexistent/path .tmp/symlink-smoke-broken
mkdir -p /tmp/fusion-symlink-external-smoke && echo external > /tmp/fusion-symlink-external-smoke/external.md
ln -s /tmp/fusion-symlink-external-smoke .tmp/symlink-smoke-external
```

Verify:

- `.tmp/symlink-smoke-link` appears as a folder.
- `.tmp/symlink-smoke-broken` is absent.
- `.tmp/symlink-smoke-external` appears as a folder.
- Expanding links shows `note.md` and `external.md`.
- Opening `.tmp/symlink-smoke-link/note.md` shows `folder_match Symlink` and tooltip source resolves to `.tmp/symlink-smoke-target/note.md`.
- Opening `.tmp/symlink-smoke-target/note.md` directly shows no symlink indicator.
- Opening `.tmp/symlink-smoke-external/external.md` works and tooltip shows `/tmp/.../external.md`.
- Recent files can include linked files after they are touched/opened.

Cleanup:

```bash
rm .tmp/symlink-smoke-link .tmp/symlink-smoke-broken .tmp/symlink-smoke-external
rm -rf .tmp/symlink-smoke-target /tmp/fusion-symlink-external-smoke
```

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

**CHECKPOINT:** report smoke result, build result, and changed files.

---

## Slice 31a.3 — Capture, Office, and Wiki Opened-Resource Indicators

**Goal:** Apply the same opened-resource indicator policy outside file-viewer.

### Files

Worker must discover current component names before editing. Expected areas:

- capture-viewer opened-file/header components
- Office folder header component(s)
- wiki opened-page/header components
- any server/client metadata path these surfaces use to load opened resources

Discovery is not optional for this slice. Before editing, report the actual load path and header component path for each surface, then update only those paths. If a surface reuses `file_content_response`, preserve the shared `isSymlink` / `symlinkTarget` fields instead of inventing a surface-specific shape.

### Steps

1. Find the opened-resource load paths for capture-viewer, Office folder headers, and wiki page view.
2. Propagate symlink metadata for opened resources, including descendants under symlinked folders.
3. Render icon-only `folder_match` to the left of existing right-side header controls.
4. Use the shared tooltip copy.
5. Do not add symlink chrome to tree/list/tile rows.

### Smoke

- Open a symlinked markdown capture: icon appears; tooltip source is final resolved file path.
- Open the canonical file directly: no icon.
- Open a symlinked Office folder: icon appears left of link/send-to-chat actions.
- Open a wiki page through a symlinked folder/path: icon appears; tooltip source is final resolved page path.
- Native resources show no icon.

**CHECKPOINT:** report component paths touched and smoke evidence.

---

## Slice 31b — Wiki Scanners

**Goal:** Make wiki tree/query and TOC sync follow symlinked folders and terminate safely.

### Files

| File | Sites |
|---|---|
| `fusion-studio-server/lib/wiki/wiki-tree.js` | child-folder filters and recursive scan |
| `fusion-studio-server/scripts/sync-wiki-tocs.js` | heading lookup, description extraction, TOC children, recursive walk |

### Steps

1. Use `classifyEntrySync` for directory decisions.
2. Skip broken links.
3. Use per-run cycle guards for recursive walks.
4. Preserve all existing filters: dot-prefix skip, `000-` rules, sorting, generated marker behavior.
5. `directoryExists` using `statSync` already follows links; leave it unless needed.
6. Symlinked folder labels come from the link name.

### Gotchas

- `sync-wiki-tocs.js` writes `PAGE.md`; through a symlinked folder, writes land in the target. Smoke targets must be disposable.
- 9xx-band exclusion is future audit behavior, not part of this symlink slice.
- `query-wiki.js` consumes `wiki-tree.js`; do not duplicate scanner logic there.

### Smoke

```bash
cd /Users/rccurtrightjr./projects/fs-dev
mkdir -p /tmp/wiki-smoke-target
printf -- '---\nname: Smoke Article\ndescription: Symlink smoke fixture.\n---\n\nBody.\n' > /tmp/wiki-smoke-target/PAGE.md
ln -s /tmp/wiki-smoke-target ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/998-Symlink_Smoke
ln -s "$(pwd)/ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views" /tmp/wiki-smoke-target/loop
node fusion-studio-server/scripts/sync-wiki-tocs.js .
```

Verify:

- Script terminates.
- TOC lists **Symlink Smoke** once.
- App wiki sidebar shows the node after restart.
- Diff contains only expected marker-block changes.

Cleanup and reseal:

```bash
rm ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/998-Symlink_Smoke
rm -rf /tmp/wiki-smoke-target
node fusion-studio-server/scripts/sync-wiki-tocs.js .
```

Revert fixture-generated TOC churn after inspection if needed.

**CHECKPOINT:** report result and any TOC diffs.

---

## Slice 31c — Write-Lock Enforcement + Open Router Hooks Dependency Note

**Goal:** Keep the creation/addition boundary enforceable for AI/tool actions.

### Scope

This slice does not block reading user-created symlinks. It prevents AI/tool paths from bypassing protected locations or creating unsafe symlinks.

### Files

| File | Change |
|---|---|
| `fusion-studio-server/lib/enforcement.js` | realpath resolution before protected segment rules |
| `fusion-studio-server/test/enforcement.test.js` | symlink fixtures |

Do not invent the Open Router Hooks implementation in this slice. If that hook surface does not already exist, record the dependency on `RCC-0110` and implement only the enforcement portion that has an existing choke point.

### Enforcement Design

`checkSettingsBounce(toolName, parsedArgs)` keeps today's logical segment test, then resolves absolute existing paths and deepest-existing ancestors before retesting protected segments. Relative paths keep today's behavior exactly.

This is about protected write targets, not symlink read visibility.

### Gotchas

- Do not cache realpath checks in enforcement; live filesystem reads are required for safety.
- Keep Windows-safe `/[/\\]/` segment splitting.
- On resolution failure, fall back to the logical-path verdict.
- Existing mocks that stub `checkSettingsBounce` should keep passing.

### Smoke

Jest matrix:

- direct write into protected folder bounces
- write via symlink -> protected folder bounces
- write via symlink -> normal folder allowed
- new-file path under symlink -> protected folder bounces by deepest-existing ancestor
- relative path behavior unchanged
- broken link falls back

Live check:

- Create a link to a protected folder.
- Ask AI/tool path to write through it.
- Confirm the restricted bounce.

**CHECKPOINT:** report whether Open Router Hooks existed and what was enforced now vs deferred to `RCC-0110`.

---

## Slice 31d — Mechanical Scanner Sweep

**Goal:** Move remaining relevant scanners onto the shared classifier. Preserve behavior except the file/dir question now follows symlinks.

All sync unless noted.

| # | File / site | Notes |
|---|---|---|
| 1 | `fusion-studio-server/lib/tickets/loader.js` | Keep depth rules; symlinked status dirs scan. |
| 2 | `fusion-studio-server/lib/components/component-loader.js` | Symlinked modal dirs load. |
| 3 | `fusion-studio-server/lib/prompts/prompt-registry.js` | Recursive; add cycle guard. |
| 4 | `fusion-studio-server/lib/triggers/trigger-loader.js` | Recursive; add cycle guard; keep `node_modules`/`.git` skips. |
| 5 | `fusion-studio-server/lib/views/index.js` | Fix `lstatSync(...).isDirectory()` view-root bug and view-folder listing checks to follow links where appropriate. |
| 6 | `fusion-studio-server/lib/view-state/defaults.js` | Find-first filters use classifier. |
| 7 | `fusion-studio-server/lib/view-state/resolver.js` | Same pattern as defaults. |
| 8 | `fusion-studio-server/lib/ws/workspace-request-handlers.js` `folder:browse` | Async; symlinked dirs are selectable. |
| 9 | `fusion-studio-server/lib/chat-metadata/collectors/file-mentions.js` | Iterative recursive search; classify before push; add realpath guard with existing budget. |
| 10 | `fusion-studio-server/lib/watch/workspace-context.js` | Folder/file counting uses classifier. |
| 11 | `fusion-studio-server/lib/views/workspace-registry-writer.js` | Mirror the view-root and view-folder listing fixes from `lib/views/index.js`; keep template/scaffold copy behavior unchanged. |

### Intentional Non-Following Whitelist

Do not "fix" code that intentionally copies/scaffolds by lstat and skips symlinks, including template/scaffold copy paths. Those are safety behavior, not scanner bugs.

### Smoke

1. Full server tests green.
2. Symlink a folder containing `PROMPT.md` into prompt root; restart; prompt appears.
3. Symlink a folder containing `TRIGGERS.md` into workspace; restart; trigger loads.
4. Folder picker lists symlinked directories.
5. File mention search can find a file under a symlinked folder.
6. Cleanup fixtures and restart; registries return to baseline.

**CHECKPOINT:** report remaining raw `isDirectory()` / `isFile()` hits with justification.

---

## Slice 31e — Watcher Verification

**Goal:** Prove chokidar/UEB behavior; no code expected unless a check fails and the orchestrator approves a follow-up.

Current expectation: `lib/watch/core.js` defaults chokidar to `followSymlinks: true`, and `workspace-watcher.js` emits UEB `file:changed`.

Use a disposable script (scratch, not committed) around the watcher/event-bus path. Verify:

1. Link create emits under linked path.
2. Link remove emits delete after existing debounce.
3. Write through repo-internal link: record path(s) and whether double-fire occurs.
4. Write through external-target link: event appears under linked path.
5. Broken link does not crash or storm.
6. Symlink cycle does not wedge.
7. `awaitWriteFinish` latency is expected.

Append a short findings table to this spec only if the user wants the findings preserved; otherwise report in chat and ticket follow-ups for anomalies.

**CHECKPOINT:** report findings and ask for decisions on anomalies.

---

## Slice 31f — UEB Dual-Name Cleanup (`file_changed` vs `file:changed`) — Severable

**Goal:** Remove duplicate bus event names if investigation confirms it is safe.

Known issue:

- Watcher emits standards-compliant `file:changed`.
- File-explorer save emits bus `file_changed`.
- `file_changed` is also a WebSocket message type; do not change the WS message in this slice.

### Steps

1. Investigate current bus consumers of `file_changed`.
2. Confirm file-mutation collector can rely on watcher `file:changed`.
3. If safe, delete file-explorer's bus `emit('file_changed', ...)`.
4. Remove unused `emit` injection if orphaned.
5. Delete duplicate collector subscription.
6. If `panel` from the underscore payload is load-bearing, stop and report instead of improvising.

### Smoke

- Save a file from app editor.
- Watcher echo arrives as `file:changed`.
- File-mutations collector records exactly one mutation.
- Event ledger sees the save.
- `grep -rn "on('file_changed'" fusion-studio-server/lib` returns nothing.

**FINAL CHECKPOINT.**

---

## Final Review Checklist

- [ ] `fusion-studio-server/lib/file-explorer.js` inline lstat/stat classification block deleted.
- [ ] `isPathAllowed` uses `path.relative()` containment and no decorative symlink pass.
- [ ] No visible symlink chrome added to file tree rows.
- [ ] Opened symlink descendants show indicators with final resolved resource path.
- [ ] External-target manual symlinks are visible/readable.
- [ ] Broken symlinks are skipped.
- [ ] Recursive scans use realpath guards.
- [ ] No scanner auto-removes user-created symlinks.
- [ ] Intentional non-following copy/scaffold code is documented, not "fixed."
- [ ] Smoke fixtures removed.
- [ ] Client build passes.
- [ ] Relevant server tests pass.

Useful verification:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server && npm test
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client && npm run build
grep -rn "on('file_changed'" /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/
```
