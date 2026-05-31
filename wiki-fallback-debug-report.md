# Wiki Fallback Debug Report

## Original Problem

The user wanted the fs-dev wiki viewer to render articles from folder structure when `index.json` is missing or empty. The explicit `index.json` should override the folder scan when present. Specifically, `/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/project/Coding-CLIs/Coding_CLI_Harness.md` was not rendering in the right sidebar — there were subfolders (`Architecture/`, `Kimi_Investigation/`, `Path_Forward/`) with `.md` files inside, but the right sidebar showed nothing.

## What Was Found

### Root Cause: Case Mismatch Between Article ID and Folder Name

In `content/project/index.json`:
```json
{ "id": "coding-clis", "title": "Coding CLIs", "folder": "Coding-CLIs", "guide": "Coding_CLI_Harness.md" }
```

The `activeArticle` ID is `"coding-clis"` (lowercase) but the filesystem folder is `Coding-CLIs` (mixed case). The client was comparing the path segment from the server response (`Coding-CLIs`) against `activeArticle` (`coding-clis`) and silently discarding the content because they didn't match.

Every other article in `project/index.json` uses lowercase IDs that exactly match their folder names (e.g., `browser_views` → `browser_views/`). `coding-clis` → `Coding-CLIs/` was the **only mismatch**.

## Changes Made

### 1. Server: `fusion-studio-server/lib/file-explorer.js`

**Added `buildWikiGroups(basePath, requestPath)`** — a helper that scans the article folder and synthesizes a `groups` array from subfolder structure:
- Reads the article directory (`{section}/{article}/`)
- Each subfolder becomes a group
- Each `.md` file inside a subfolder becomes an article
- Sorts alphabetically

**Modified `handleFileContentRequest`** to synthesize groups in two cases:
1. When `index.json` exists but has no `groups` array (or `groups` is empty)
2. When `index.json` is missing entirely (`ENOENT`)

**Also handles empty/whitespace JSON files** — treats them as missing.

**Current `buildWikiGroups` behavior (as of last edit):**
- Preserves exact casing from folder names and filenames
- `id`: exact folder name or exact filename (no `.md`)
- `title`: exact name with underscores replaced by spaces (case preserved)
- No lowercase normalization

### 2. Client: `fusion-studio-client/src/components/wiki/WikiExplorer.tsx`

**Fixed case-sensitivity bug for markdown content** (lines ~90-100):
```tsx
const articleMeta = articles.find((a) => a.id === article);
const expectedFolder = articleMeta?.folder || article;
if (mdMatch[1] !== section || mdMatch[2] !== expectedFolder) return;
```

**Fixed case-sensitivity bug for `index.json` responses** (lines ~70-80):
```tsx
const article = articlesBySection[sectionId]?.find(
  (a) => a.folder === folderName || a.id === folderName
);
const articleId = article?.id || folderName;
setArticleGroups(articleId, idx.groups || []);
```

**Removed client-side group caching** (`loadedGroupsRef`) so the client always re-requests `index.json` when switching articles.

**Reverted complex WebSocket tree-scanning fallback** — removed all recursive `file_tree_request` / `file_tree_response` logic from the client after realizing the server should handle folder scanning.

## Current State

### What Works
- `buildWikiGroups` standalone test produces correct output:
  ```json
  [
    { "id": "Architecture", "title": "Architecture", "articles": [...] },
    { "id": "Kimi_Investigation", "title": "Kimi Investigation", "articles": [...] },
    { "id": "Path_Forward", "title": "Path Forward", "articles": [...] }
  ]
  ```
- The client build succeeds (`npm run build` completes with no TypeScript errors)
- The server syntax is valid (`node -c` passes)
- The `Coding-CLIs/index.json` file has been **deleted** to test the missing-JSON path

### What Does NOT Work

**After server restart, the right sidebar is still completely empty for Coding CLIs.**

The server IS receiving the request (confirmed in Electron log):
```
[server] [WS →]: {"type":"file_content_request","panel":"wiki-viewer","path":"project/Coding-CLIs/index.json"}
```

But the right sidebar shows nothing. The client receives a `file_content_response` but either:
1. The response contains empty groups
2. The client is storing/looking up the groups under the wrong key
3. The response is not valid JSON and the client's `JSON.parse` is silently failing

## Sources of Confusion

### 1. Dual Server Architecture

There are **two** `node server.js` processes running simultaneously:
- **Standalone server** (port 3001): Started by `restart-fusion.sh` script. Serves static files from `dist/`.
- **Electron-spawned server** (random port, currently 56032): Started by `electron/server-spawn.cjs` with `PORT=0`. The Electron app connects to THIS server, not the standalone one.

The restart script kills and restarts the standalone server, but the **Electron-spawned server is what the client actually uses**. Both processes load `file-explorer.js` from disk at startup, so both SHOULD have the new code after restart.

**But**: When the restart script kills Electron with `pkill -9`, the child server process spawned by Electron becomes orphaned and may survive. There were observations of TWO `node server.js` processes after restart. It's unclear if the old Electron-spawned server is being fully terminated before the new one starts.

### 2. Client Build and Caching

The restart script runs `npm run build` which produces `dist/assets/index-{hash}.js`. The Electron-spawned server serves these built files. However:
- Vite's build output hash was `index-AwpyS9gv.js` both before and after the build
- This could mean the bundle content didn't change significantly, OR Vite's hash algorithm produced the same hash for the revised code
- The client bundle is 3.3 MB — it's possible some code is tree-shaken or the changes are too small to affect the hash

### 3. No Response Logging

The server logs incoming WebSocket messages (`[WS →]`) but does NOT log outgoing `file_content_response` content. There's no easy way to see what the synthesized JSON actually looks like when sent over the wire without adding temporary `console.log` statements.

### 4. Restart Script Kill Effectiveness

The restart script attempts to kill processes via:
1. PID file (`/tmp/fusion-studio.pid`)
2. `pkill -9 -f "fusion-studio-server/server\.js"`
3. `lsof -ti:$PORT | xargs kill -9`

But `pkill -f` regex matching is subtle. If the process was spawned by Electron with a full absolute path (`/opt/homebrew/bin/node /Users/.../server.js`), the regex `fusion-studio-server/server\.js` may or may not match depending on how `pkill -f` reports the command line on macOS.

Additionally, `lsof -ti:$PORT` kills the standalone server on port 3001, but the Electron-spawned server is on a random port — `lsof` wouldn't find it unless it happens to also be on 3001.

### 5. Folder Naming Conventions

The user wants a unified convention going forward:
- All wiki folders and markdown files are **case-sensitive**
- Underscores represent spaces in display names
- `id` fields should exactly match folder/filenames

This means `project/index.json` needs updating:
```json
// OLD
{ "id": "coding-clis", "folder": "Coding-CLIs" }
// NEW
{ "id": "Coding-CLIs", "folder": "Coding-CLIs" }
```

But this hasn't been done yet. The client currently tries to match by `folder` OR `id`, which covers this temporarily.

## Open Questions

1. **Is the Electron-spawned server actually running the new `file-explorer.js`?** The process was started after the file edit, but there's no definitive way to verify without adding a log statement and restarting.

2. **Why does the client show nothing on the right even though the server should be synthesizing groups?** Is the synthesized JSON malformed? Is the client's `JSON.parse` failing silently? Is there a mismatch between how the groups are stored (`articleId` key) vs how they're looked up (`activeArticle`)?

3. **Does `buildWikiGroups` get called at all when `index.json` is missing?** The `ENOENT` branch in `handleFileContentRequest` should trigger it, but without logging, this is unconfirmed.

4. **Are there old built artifacts shadowing the source changes?** The client `dist/` folder contains a built bundle. Could an old `dist/assets/index-*.js` be cached or served from a different location?

5. **Does the `project/index.json` still reference the old lowercase ID?** Even with the server synthesizing groups, if the client loads `project/index.json` and sees `"id": "coding-clis"`, then the client's `activeArticle` is `coding-clis`. The server synthesizes groups and the client stores them. If there's ANY mismatch in the lookup chain, the sidebar stays empty.

## Files Modified

| File | Purpose |
|------|---------|
| `fusion-studio-server/lib/file-explorer.js` | Added `buildWikiGroups()` and synthesis fallback in `handleFileContentRequest` |
| `fusion-studio-client/src/components/wiki/WikiExplorer.tsx` | Fixed case-sensitive path matching; removed group caching; reverted tree-scan logic |
| `ai/views/wiki-viewer/content/project/Coding-CLIs/index.json` | **DELETED** to test missing-JSON fallback |
| `ai/views/wiki-viewer/content/project/Coding-CLIs/Coding_CLI_Harness.md` | Added YAML frontmatter (not the real fix, but done early) |

## Recommended Next Steps

1. **Add logging to `handleFileContentRequest`** in `file-explorer.js` to confirm the synthesis path is hit and to see the exact JSON being sent
2. **Verify only one `node server.js` process is running** after restart — kill any strays manually
3. **Update `project/index.json`** to use exact-case IDs that match folder names
4. **Test the synthesized JSON directly** via a WebSocket client script that connects to the actual Electron-spawned server port
5. **Consider modifying `restart-fusion.sh`** to explicitly kill the Electron-spawned child server (maybe by tracking its PID or killing all `node server.js` processes before starting Electron)
