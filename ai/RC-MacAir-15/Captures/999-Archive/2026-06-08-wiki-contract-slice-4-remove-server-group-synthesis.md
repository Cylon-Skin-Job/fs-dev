# Wiki Contract Slice 4: Remove Server Group Synthesis

## Objective

Remove legacy wiki-specific `groups` synthesis from the generic server file explorer.

The active wiki viewer now discovers folders under `ai/<machine>/Wiki` using `file_tree_request` and loads selected `PAGE.md` files using `file_content_request`. The server should no longer synthesize old `index.json` group payloads for `wiki-viewer`.

## Source Roadmap

Read first:

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-1-root-resolution.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-2-folder-tree-data-model.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-3-viewer-loader-rewrite.md`

Expected prior state:
- `wiki-viewer` resolves to `Wiki/` when present.
- Active wiki UI uses `WikiNode` state.
- `WikiExplorer` uses `file_tree_request` for folder discovery.
- Active wiki UI no longer parses `index.json`, `topics.json`, `_Guide.md`, `sections`, `articles`, or `groups`.

## File To Change

- `fusion-studio-server/lib/file-explorer.js`

## Legacy Code To Remove

In `fusion-studio-server/lib/file-explorer.js`, remove old wiki fallback behavior:

- `buildWikiGroups(basePath, requestPath)`
- The block that enriches existing wiki article `index.json` with synthetic `groups`
- The `ENOENT` fallback that returns synthetic `{ version: '1.0', groups: synthetic }` for missing wiki article `index.json`

Known current references from audit:

- `buildWikiGroups` around line 222
- `// Wiki fallback: synthesize groups when article index.json lacks them`
- `idx.groups`
- `JSON.stringify({ ...idx, version: idx.version || '1.0', groups: synthetic }, null, 2)`
- `JSON.stringify({ version: '1.0', groups: synthetic }, null, 2)`

## Required Behavior After Cleanup

Generic file explorer behavior must remain intact:

- `file_tree_request` returns folder/file nodes.
- `file_content_request` returns file contents.
- Missing files return normal failure responses.
- Directories requested as content still return `EISDIR`.
- Path safety checks remain unchanged.
- Agents dashboard schedule enrichment remains unchanged.
- Recent files behavior remains unchanged.

Expected missing wiki `index.json` behavior after cleanup:
- `file_content_request` for a missing `index.json` should return the normal file-content error response.
- It should not return synthesized wiki groups.

## Explicit Non-Goals

- Do not change client wiki behavior.
- Do not migrate wiki content.
- Do not remove old `content/` folders.
- Do not alter DB-backed Fusion overlay wiki behavior.
- Do not change path resolution rules from Slice 1.
- Do not change file explorer behavior for non-wiki panels except by removing the wiki-only special case.

## Verification Steps

1. Syntax/module check:

```bash
node -e "require('./fusion-studio-server/lib/file-explorer')"
```

2. Search for removed legacy terms:

```bash
grep -n "buildWikiGroups\|synthesize groups\|idx.groups\|groups: synthetic" fusion-studio-server/lib/file-explorer.js
```

Expected:
- No matches.

3. Build or run relevant server tests if available and fast.

Suggested targeted checks:

```bash
npm test -- --runInBand file-explorer
```

If no such test target exists, report that and at least run the module syntax check.

4. Client build is optional for this server-only slice unless a client file is touched. If touched, run:

```bash
cd fusion-studio-client
npm run build
```

## Manual Behavior Check If App Is Running

If practical, use the app or WebSocket logs to confirm:

- `file_tree_request` for `wiki-viewer` still works.
- `file_content_request` for `PAGE.md` still works.
- `file_content_request` for a missing wiki `index.json` returns a normal error, not synthesized groups.

## Report Back Format

When done, report:

- Files changed.
- Exact legacy code removed.
- Verification commands run and results.
- Whether any wiki-specific behavior remains in `file-explorer.js`.
- Any blockers for Slice 5.

## Success Criteria

- `file-explorer.js` no longer contains wiki group synthesis.
- Generic file tree/content behavior remains intact.
- Missing wiki `index.json` no longer produces synthetic groups.
- No client behavior was changed.
- No content migration occurred.
