# Wiki Contract Slice 1: Root Resolution

## Objective

Make `wiki-viewer` resolve to the new canonical wiki root:

```text
ai/<machine>/Wiki
```

instead of the legacy root:

```text
ai/<machine>/Wiki
```

This is the first vertical slice in `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`.

## Context

The product decision is that every workspace wiki uses the same folder-first contract:

```text
Wiki/
├── PAGE.md
└── 001-Section_Name_Folder/
    ├── PAGE.md
    └── 001-Article_Name_Folder/
        ├── PAGE.md
        └── 001-Right_Sidebar_Section_Folder/
            ├── PAGE.md
            └── 001-Article_Folder/
                └── PAGE.md
```

This slice does not implement the tree viewer and does not migrate wiki content. It only changes resolution/copy-path behavior so future slices have the correct root.

## Files To Inspect First

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `fusion-studio-server/lib/views/index.js`
- `fusion-studio-client/src/lib/resource-path.ts`
- `fusion-studio-server/server.js` around `getPanelPath()` and panel root calculation

## Expected Code Changes

### Server

Update `fusion-studio-server/lib/views/index.js` in `resolveContentPath()`.

Current behavior:
- Any non-file view resolves to `viewRoot/content` if it exists.
- Otherwise it resolves to the view root.

Target behavior:
- `file-viewer` remains special and resolves to the project root/session root.
- `wiki-viewer` resolves to `viewRoot/Wiki` when that folder exists.
- Other views continue using the existing generic `content/` rule.

Important: do not change all views from `content` to `Wiki`; only `wiki-viewer` gets the new root.

### Client

Update `fusion-studio-client/src/lib/resource-path.ts`.

Current mapping:

```ts
'wiki-viewer': 'ai/<machine>/Wiki'
```

Target mapping:

```ts
'wiki-viewer': 'ai/<machine>/Wiki'
```

## Explicit Non-Goals

- Do not migrate any workspace wiki content.
- Do not rewrite `WikiExplorer` yet.
- Do not change `wikiStore` yet.
- Do not remove server wiki group synthesis yet.
- Do not change DB-backed Fusion overlay wiki behavior.
- Do not add a permanent fallback from `Wiki` to `content`.
- Do not modify unrelated dirty worktree files.

## Temporary Fallback Policy

Avoid fallback if possible.

If tests or runtime behavior require a temporary fallback because no `Wiki/` folders exist yet, document it explicitly in the result and mark it for deletion after content migration. Do not silently preserve `content/` as an equivalent long-term root.

Preferred behavior for this slice:
- If `wiki-viewer/Wiki` exists, resolve to it.
- If it does not exist, resolution may fall back to the view root rather than old `content/`, matching the generic fallback behavior.

## Verification Steps

Run these after changes.

1. Inspect server path resolution manually.

Recommended quick check:

```bash
node - <<'NODE'
const views = require('./fusion-studio-server/lib/views');
const root = process.cwd();
console.log(views.resolveContentPath(root, 'wiki-viewer'));
NODE
```

Expected once a `Wiki/` folder exists:

```text
.../ai/<machine>/Wiki
```

2. Confirm non-wiki views still resolve normally.

Use the same script for a known view with `content/`, such as `doc-viewer` or another filesystem-backed view present in the workspace.

3. Confirm client path mapping.

Search for this exact old mapping:

```text
ai/<machine>/Wiki
```

Expected in active client code:
- No `resource-path.ts` mapping to the old wiki root.

4. Run a build if client TypeScript changed.

```bash
cd fusion-studio-client
npm run build
```

5. Run relevant server tests if available and fast.

At minimum, ensure no syntax error in the changed server module:

```bash
node -e "require('./fusion-studio-server/lib/views')"
```

## Report Back Format

When done, report:

- Files changed.
- Exact behavior changed.
- Verification commands run and results.
- Whether any fallback to old `content/` remains.
- Any blockers for Slice 2.

## Success Criteria

- `wiki-viewer` root resolution prefers `Wiki/`.
- Non-wiki views still use existing behavior.
- Wiki copy/send path resolution points at `ai/<machine>/Wiki`.
- No content migration has been attempted.
- No DB-backed Fusion overlay wiki behavior changed.
