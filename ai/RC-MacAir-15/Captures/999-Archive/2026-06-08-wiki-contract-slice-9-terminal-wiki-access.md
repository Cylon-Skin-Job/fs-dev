# Wiki Contract Slice 9: Terminal Wiki Access

## Start Here: Do Not Broad-Search First

Work from this exact repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

Use these exact implementation files:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/wiki/wiki-tree.js      # create this
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/scripts/query-wiki.js       # create this
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/package.json                # optionally add npm script
```

Only inspect these existing files if needed for style/path patterns:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/resources/resolver.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/scripts/transcribe-file.js
```

Do not start by searching the whole repo. The old wiki migration produced many historical docs, logs, and retained `content/` folders that will waste context. This slice only needs a new scanner module and a new terminal script.

Run commands from this directory unless a command says otherwise:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
```

## Objective

Add deterministic terminal access to the standardized wiki tree.

The query path must read the canonical `Wiki/` + `PAGE.md` contract, not old `content/` JSON indexes.

Primary deliverable for this slice:
- A terminal-invokable script that can query wiki nodes for the current workspace or all known/default workspace roots.

Optional follow-up after the script works:
- Reuse the same scanner from an HTTP or WebSocket handler.

## Source Roadmap

Read only if you need background. Do not spend time mining them before implementation:

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-8-legacy-path-cleanup.md`

Expected prior state:
- All target workspaces have canonical `ai/<machine>/Wiki/PAGE.md` roots.
- Active wiki UI uses the `Wiki/` folder tree.
- Active code no longer depends on old wiki `content/` navigation.

## Exact Repo And Workspace Roots

Development repo:

```text
/Users/rccurtrightjr./projects/fs-dev
```

Server package:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
```

Known wiki roots to support for this slice:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/<machine>/Wiki
/Users/rccurtrightjr./projects/Fusion-Home/ai/<machine>/Wiki
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home/ai/<machine>/Wiki
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo/ai/<machine>/Wiki
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio/ai/<machine>/Wiki
/Users/rccurtrightjr./projects/solobooks/ai/<machine>/Wiki
/Users/rccurtrightjr./projects/media-editor/ai/<machine>/Wiki
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki
```

Important: `System Source Files` contains spaces. Quote paths in shell commands.

## Absolute Workspace Inputs To Hardcode For `--scope all`

For this slice, hardcode this exact list in `scripts/query-wiki.js` or a constant exported from `lib/wiki/wiki-tree.js`. Use existence checks so missing roots do not crash the command.

```js
const DEFAULT_WORKSPACE_ROOTS = [
  '/Users/rccurtrightjr./projects/fs-dev/System Source Files',
  '/Users/rccurtrightjr./projects/Fusion-Home',
  '/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home',
  '/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo',
  '/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio',
  '/Users/rccurtrightjr./projects/solobooks',
  '/Users/rccurtrightjr./projects/media-editor',
  '/Users/rccurtrightjr./projects/fs-dev',
];
```

Each workspace root resolves to:

```text
{workspaceRoot}/ai/<machine>/Wiki
```

Exception: if an input path already ends in `/Wiki`, treat it as the wiki root directly.

## Recommended Implementation Shape

Create a reusable scanner module first:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/wiki/wiki-tree.js
```

Then create a terminal script:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/scripts/query-wiki.js
```

Add an npm script if useful:

```json
"wiki": "node scripts/query-wiki.js"
```

Keep the scanner independent from Express/WebSocket so terminal access does not require the app server to be running.

Create `lib/wiki/` if it does not exist. Use CommonJS (`require`, `module.exports`) because `fusion-studio-server/package.json` has `"type": "commonjs"`.

Recommended exports from `lib/wiki/wiki-tree.js`:

```js
module.exports = {
  DEFAULT_WORKSPACE_ROOTS,
  wikiFolderNameToLabel,
  resolveWikiRoot,
  scanWikiTree,
  flattenWikiTree,
  queryWiki,
};
```

## Scanner Responsibilities

The scanner should:
- Accept one or more workspace root paths.
- Resolve each wiki root as `{workspaceRoot}/ai/<machine>/Wiki` unless the input path already points directly at a `Wiki` directory.
- Walk folders to supported depth.
- Treat each navigable folder as a node with `PAGE.md`.
- Sort child folders by raw filesystem name.
- Strip numeric prefixes from labels using the same display convention as the client.
- Replace `_` with space.
- Preserve dashes and case.
- Return machine-readable JSON.

Suggested node shape:

```js
{
  workspaceId: 'fs-dev',
  workspacePath: '/Users/.../fs-dev',
  wikiRoot: '/Users/.../ai/<machine>/Wiki',
  nodePath: '001-Project/001-Home',
  pagePath: '/Users/.../Wiki/001-Project/001-Home/PAGE.md',
  label: 'Home',
  depth: 2,
  hasPage: true,
  body: '...', // only when requested
  children: []
}
```

Output can either be a flat list or a tree. Prefer flat list by default for terminal/AI consumption, with `children` omitted unless `--format tree` is requested.

## CLI Requirements

Support these minimum arguments:

```text
--workspace <path-or-id>
--scope current|all
--include-body
--format json|tree
--section <label-or-path-fragment>
--article <label-or-path-fragment>
--limit <n>
```

Minimum acceptable first version:
- `--workspace <absolute-path>`
- `--scope current`
- `--scope all` using a hardcoded/discovered default list for known migrated roots
- `--include-body`
- JSON output

Do not make terminal access depend on browser state.

Argument parsing can be minimal manual parsing of `process.argv`. Do not add a new dependency for argument parsing.

## Current Workspace Resolution

For this slice, define “current” as one of:

1. Explicit `--workspace /absolute/path` passed by user.
2. If omitted, default to `process.cwd()` and search for `ai/<machine>/Wiki` under it.

Do not read or modify `system_config.last_active_workspace_id` in the database for this first terminal version.

Future server/API integration can use `workspace-controller` active workspace state.

## All Scope Resolution

For `--scope all`, include known migrated roots from this handoff.

Preferred approach:
- Build a small default root list inside the script, with existence checks.
- Also allow extra roots through repeated `--workspace` args if easy.

Do not fail the whole command if one known workspace is absent. Return a warning entry or skip with warning.

## Filtering Semantics

Filters should be deterministic and simple.

Recommended:
- `--section` matches label or node path substring for depth 1 nodes and their descendants.
- `--article` matches label or node path substring for any depth >= 2 node.
- Matching should be case-insensitive.
- Preserve output order from filesystem sort.

Avoid fuzzy matching in this slice.

## Body Loading

Default:
- Return metadata only.

With `--include-body`:
- Include `body` from each node's `PAGE.md`.

Missing `PAGE.md`:
- Set `hasPage: false` and include an `error` field.
- Do not synthesize content.
- Do not fall back to old content files.

## Explicit Non-Goals

- Do not use old `content/index.json`, `topics.json`, article `index.json`, `sections`, `articles`, or `groups`.
- Do not remove old retained content trees.
- Do not change the active wiki React UI.
- Do not change DB-backed Fusion overlay wiki behavior.
- Do not depend on the server being running for terminal access.
- Do not modify workspace database active-workspace state.

## Verification Commands

Run from:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
```

Module syntax:

```bash
node -e "require('./lib/wiki/wiki-tree')"
node --check scripts/query-wiki.js
```

Export smoke check:

```bash
node - <<'NODE'
const wiki = require('./lib/wiki/wiki-tree');
console.log(Object.keys(wiki).sort().join('\n'));
NODE
```

Current workspace metadata query:

```bash
node scripts/query-wiki.js --workspace "/Users/rccurtrightjr./projects/fs-dev" --scope current
```

Current workspace with body:

```bash
node scripts/query-wiki.js --workspace "/Users/rccurtrightjr./projects/fs-dev" --scope current --include-body --limit 5
```

System Source Files query:

```bash
node scripts/query-wiki.js --workspace "/Users/rccurtrightjr./projects/fs-dev/System Source Files" --scope current --section System --include-body --limit 10
```

All migrated roots:

```bash
node scripts/query-wiki.js --scope all --limit 20
```

Filter check:

```bash
node scripts/query-wiki.js --workspace "/Users/rccurtrightjr./projects/fs-dev" --article "Code Standards" --include-body
```

Expected:
- JSON output parses.
- Output paths point at `Wiki/**/PAGE.md`.
- No output paths point at `ai/<machine>/Wiki`.
- Ordering follows numeric prefixes/raw folder order.

Quick JSON parse check:

```bash
node scripts/query-wiki.js --workspace "/Users/rccurtrightjr./projects/fs-dev" --scope current --limit 3 > /tmp/wiki-query.json
node -e "JSON.parse(require('fs').readFileSync('/tmp/wiki-query.json', 'utf8')); console.log('json ok')"
```

## Tests

If adding tests is straightforward, add focused tests for:
- label conversion
- tree walking
- missing `PAGE.md`
- metadata-only vs `--include-body`
- filtering

Likely location:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/test/wiki/
```

If test setup is too costly, document why and rely on the verification commands above.

## Report Back Format

When done, report:

- Files changed.
- CLI usage examples that work.
- Output schema implemented.
- How `current` and `all` scopes are resolved.
- Verification commands run and results.
- Whether tests were added.
- Any limitations or follow-up needed for HTTP/WS integration.

## Success Criteria

- Terminal command can query a single workspace wiki without the app server running.
- Terminal command can query all known migrated wiki roots.
- Output is deterministic JSON.
- Optional body inclusion works.
- Results use only canonical `Wiki/**/PAGE.md` paths.
- No old JSON/content navigation is used.
